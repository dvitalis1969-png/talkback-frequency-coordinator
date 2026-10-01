import re

with open('services/rfService.ts', 'r') as f:
    content = f.read()

# We need to replace the `let remainingWmasMics = allocatedWmasMicCount;` to `resultsMap.set(act.id, { ...act, frequencies: newFreqs });`
# with our backtrack logic.

start_str = "        let remainingWmasMics = allocatedWmasMicCount;"
end_str = "        resultsMap.set(act.id, { ...act, frequencies: newFreqs });"

start_idx = content.find(start_str)
end_idx = content.find(end_str)

if start_idx == -1 or end_idx == -1:
    print("Could not find markers for generateFestivalPlan")
    exit(1)

replacement = """        let remainingWmasMics = allocatedWmasMicCount;
        let remainingWmasIems = allocatedWmasIemCount;

        const actBacktrackTargets: BacktrackTarget[] = [];
        const unaddedLocked = lockedFreqs.filter(lf => !matchedExistingIds.has(lf.id!));
        const baseValidationPool = [...staticPool, ...otherActsPool, ...unaddedLocked];

        const micValidationPool = [...baseValidationPool];
        houseMicPool.forEach(hf => micValidationPool.push({ ...hf, _ignoreImdWithCandidate: hf.zoneIndex !== stageIdx }));
        const ignoreMicImd = act.houseIemsImdWithActMics !== true;
        houseIemPool.forEach(hf => micValidationPool.push({ ...hf, _ignoreImdWithCandidate: ignoreMicImd || hf.zoneIndex !== stageIdx }));

        const iemValidationPool = [...baseValidationPool];
        houseIemPool.forEach(hf => iemValidationPool.push({ ...hf, _ignoreImdWithCandidate: hf.zoneIndex !== stageIdx }));
        const ignoreIemImd = act.houseMicsImdWithActIems !== true;
        houseMicPool.forEach(hf => iemValidationPool.push({ ...hf, _ignoreImdWithCandidate: ignoreIemImd || hf.zoneIndex !== stageIdx }));

        for (const bucket of requestTypes) {
            // WWB-Style: Hardest First Sorting (IEMs before Mics)
            const shuffledReqs = [...bucket.reqs].sort((a,b) => {
                const profA = db[a.equipmentKey] || db['custom'];
                const profB = db[b.equipmentKey] || db['custom'];
                let scoreA = profA?.type === 'iem' ? 1000 : 0;
                let scoreB = profB?.type === 'iem' ? 1000 : 0;
                const thA = a.useManualParams ? { fundamental: a.manualFundamental ?? 0.35, threeTone: a.manualThreeTone ?? 0.05 } : getFinalThresholds({ equipmentKey: a.equipmentKey, compatibilityLevel: a.compatibilityLevel }, db, globalOverrides);
                const thB = b.useManualParams ? { fundamental: b.manualFundamental ?? 0.35, threeTone: b.manualThreeTone ?? 0.05 } : getFinalThresholds({ equipmentKey: b.equipmentKey, compatibilityLevel: b.compatibilityLevel }, db, globalOverrides);
                scoreA += (thA.fundamental * 100) + (thA.threeTone * 10);
                scoreB += (thB.fundamental * 100) + (thB.threeTone * 10);
                return scoreB - scoreA;
            });

            for (const req of shuffledReqs) {
                const thresholds = req.useManualParams ? { 
                    fundamental: req.manualFundamental ?? 0.35, 
                    twoTone: req.manualTwoTone ?? 0.05, 
                    threeTone: req.manualThreeTone ?? 0.05, 
                    fiveTone: req.manualFiveTone ?? 0, 
                    sevenTone: req.manualSevenTone ?? 0 
                } : getFinalThresholds({ equipmentKey: req.equipmentKey, compatibilityLevel: req.compatibilityLevel }, db, globalOverrides);
                const profile = db[req.equipmentKey] || db['custom'];
                const minFreq = (req.equipmentKey === 'custom' && req.customMin) ? req.customMin : profile.minFreq;
                const maxFreq = (req.equipmentKey === 'custom' && req.customMax) ? req.customMax : profile.maxFreq;
                
                const matches = lockedFreqs.filter(f => {
                    if (matchedExistingIds.has(f.id!)) return false;
                    const fType = f.type || 'mic';
                    if (fType !== bucket.type) return false;
                    if (f.sourceRequestId && req.id && f.sourceRequestId === req.id) return true;
                    if (f.equipmentKey === req.equipmentKey) return true;
                    if (!f.sourceRequestId) return true;
                    return false;
                }).slice(0, req.count);
                
                matches.forEach(m => {
                    matchedExistingIds.add(m.id!);
                    newFreqs.push(m);
                });
                
                const targetToFind = Math.max(0, req.count - matches.length);
                const isWmasProfile = profile?.type === 'wmas';

                if (targetToFind > 0) {
                    const finalExclusions = getEquipmentAwareExclusions(actExclusions, isWmasProfile ? 'wmas' : bucket.type, triStates, region);
                    let candidates = getCandidates(minFreq, maxFreq, profile?.tuningStep || 0.025, finalExclusions, inclusionRanges || null);
                    
                    if (calculationStrategy === 'bottom-up') {
                    } else if (calculationStrategy === 'top-down') {
                        candidates.reverse();
                    } else if (calculationStrategy === 'high-density') {
                        const pattern = Math.random();
                        if (pattern > 0.75) {
                            candidates.reverse();
                        } else if (pattern > 0.5) {
                            const centerCand = [];
                            let l = Math.floor(candidates.length / 2) - 1; let r = Math.floor(candidates.length / 2);
                            while (l >= 0 || r < candidates.length) {
                                if (r < candidates.length) centerCand.push(candidates[r++]);
                                if (l >= 0) centerCand.push(candidates[l--]);
                            }
                            candidates = centerCand;
                        } else if (pattern > 0.25) {
                            const edgeCand = [];
                            let l = 0; let r = candidates.length - 1;
                            while(l <= r) {
                                if (l === r) { edgeCand.push(candidates[l]); break; }
                                edgeCand.push(candidates[l++]); edgeCand.push(candidates[r--]);
                            }
                            candidates = edgeCand;
                        }
                    } else {
                        // Keep grid
                    }

                    actBacktrackTargets.push({
                        id: String(req.id),
                        type: bucket.type as 'mic' | 'iem',
                        equipmentKey: req.equipmentKey,
                        thresholds,
                        zoneIndex: stageIdx,
                        candidates,
                        candIndex: 0,
                        count: targetToFind,
                        validationPool: bucket.type === 'mic' ? micValidationPool : iemValidationPool,
                        linearMode: req.linearMode,
                        baseFreqObj: {
                            type: bucket.type,
                            sourceRequestId: req.id,
                            manualThresholds: req.useManualParams ? thresholds : undefined,
                            compatibilityLevel: req.compatibilityLevel,
                            equipmentKey: req.equipmentKey,
                            source: 'act' as const,
                            zoneIndex: stageIdx,
                            locked: false,
                            linearMode: req.linearMode,
                            label: req.label || act.actName
                        }
                    });
                }
            }
        }

        // Execute backtrack for this entire act
        onProgress?.({ found: 0, processed: frequenciesProcessed, total: prioritySortedActs.length, totalRequested, status: `Allocating ${act.actName}...` });
        
        const backtrackFound = await executeWwbBacktrack(
            actBacktrackTargets,
            matrix ? distances : [[0]], // Use provided distances if matrix exists
            db,
            globalOverrides,
            abortSignal,
            actIntermodMatrix,
            act.id
        );
        
        for (const f of backtrackFound) {
            newFreqs.push({
                ...f,
                id: `A-${runNonce}-${act.actName.slice(0,3).toUpperCase()}-${newFreqs.length}`,
            });
            frequenciesProcessed++;
        }
        
        // Add manual frequencies that were not generated by a specific request
        lockedFreqs.forEach(f => {
            if (!f.sourceRequestId && !matchedExistingIds.has(f.id!)) {
                newFreqs.push(f);
                matchedExistingIds.add(f.id!);
            }
        });

"""

content = content[:start_idx] + replacement + content[end_idx:]

with open('services/rfService.ts', 'w') as f:
    f.write(content)
