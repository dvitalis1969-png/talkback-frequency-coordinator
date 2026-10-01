import re

with open('services/rfService.ts', 'r') as f:
    content = f.read()

start_marker = "export const resolveGeneratorRequests = async ("
end_marker = "export const generateSiteInfrastructure = async ("

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print("Could not find markers")
    exit(1)

new_func = """export const resolveGeneratorRequests = async (
    requests: GeneratorRequest[],
    lockedConstraints: Frequency[],
    db: Record<string, EquipmentProfile>,
    exclusions: { min: number, max: number }[],
    inclusions: { min: number, max: number }[] | null,
    advanced: boolean,
    useGlobalThresholds: boolean,
    onProgress: (p: number) => void,
    manualConstraints: Frequency[],
    globalOverrides?: Record<string, Partial<Thresholds>>,
    generatorGlobalThresholds?: { fundamental: string; twoTone: string; threeTone: string; fiveTone?: string; sevenTone?: string },
    ignoreManualIMD: boolean = false,
    triStates?: Record<number, TVChannelState>,
    region: 'uk' | 'us' = 'uk',
    siteThresholds?: Thresholds,
    calculationStrategy: 'even-distribution' | 'bottom-up' | 'top-down' | 'high-density' = 'even-distribution'
): Promise<Frequency[]> => {
    
    const dummyDist = [[0]];
    const runNonce = Math.random().toString(36).substring(2, 6).toUpperCase();

    // Base Pool
    const unifiedPool: Frequency[] = [...manualConstraints, ...lockedConstraints].map(f => {
        const profile = db[f.equipmentKey || 'custom'] || db['custom'];
        let thToUse: Thresholds;
        if (ignoreManualIMD) {
            thToUse = { fundamental: siteThresholds?.fundamental || f.manualThresholds?.fundamental || profile?.recommendedThresholds?.fundamental || 0.35, twoTone: 0, threeTone: 0, fiveTone: 0, sevenTone: 0 };
        } else {
            thToUse = siteThresholds || f.manualThresholds || getFinalThresholds(f, db, globalOverrides);
        }
        return {
            ...f,
            zoneIndex: f.zoneIndex ?? 0,
            manualThresholds: thToUse
        };
    });

    const backtrackTargets: BacktrackTarget[] = [];

    for (let i = 0; i < requests.length; i++) {
        const req = requests[i];
        const count = parseInt(String(req.count)) || 0;
        const alreadyFoundForThisReq = unifiedPool.filter(f => f.sourceRequestId === String(req.id)).length;
        const targetToFind = Math.max(0, count - alreadyFoundForThisReq);
        
        if (targetToFind <= 0) continue;

        let reqThresholds: Thresholds;
        if (useGlobalThresholds && generatorGlobalThresholds) {
            reqThresholds = { 
                fundamental: isNaN(parseFloat(generatorGlobalThresholds.fundamental)) ? 0.35 : parseFloat(generatorGlobalThresholds.fundamental), 
                twoTone: isNaN(parseFloat(generatorGlobalThresholds.twoTone)) ? 0.05 : parseFloat(generatorGlobalThresholds.twoTone), 
                threeTone: isNaN(parseFloat(generatorGlobalThresholds.threeTone)) ? 0.05 : parseFloat(generatorGlobalThresholds.threeTone), 
                fiveTone: isNaN(parseFloat(generatorGlobalThresholds.fiveTone)) ? 0 : parseFloat(generatorGlobalThresholds.fiveTone), 
                sevenTone: isNaN(parseFloat(generatorGlobalThresholds.sevenTone)) ? 0 : parseFloat(generatorGlobalThresholds.sevenTone) 
            };
        } else if (req.useManualParams === true) {
            reqThresholds = { 
                fundamental: isNaN(parseFloat(String(req.manualFundamental))) ? 0.35 : parseFloat(String(req.manualFundamental)), 
                twoTone: isNaN(parseFloat(String(req.manualTwoTone))) ? 0.05 : parseFloat(String(req.manualTwoTone)), 
                threeTone: isNaN(parseFloat(String(req.manualThreeTone))) ? 0.00 : parseFloat(String(req.manualThreeTone)), 
                fiveTone: isNaN(parseFloat(String(req.manualFiveTone))) ? 0 : parseFloat(String(req.manualFiveTone)),
                sevenTone: isNaN(parseFloat(String(req.manualSevenTone))) ? 0 : parseFloat(String(req.manualSevenTone))
            };
        } else {
            reqThresholds = getFinalThresholds({ equipmentKey: req.key, compatibilityLevel: req.compatibilityLevel }, db, globalOverrides);
        }
        if (!advanced) {
            reqThresholds.fiveTone = 0;
            reqThresholds.sevenTone = 0;
        }

        const profile = db[req.key] || db['custom'];
        const tuningStep = profile?.tuningStep || 0.025;
        const typeToUse = req.type || (profile?.type as TxType) || 'generic';
        const finalExclusions = getEquipmentAwareExclusions(exclusions, typeToUse, triStates, region);
        
        let candidates = getCandidates(parseFloat(String(req.customMin)), parseFloat(String(req.customMax)), tuningStep, finalExclusions, inclusions);
        
        if (calculationStrategy === 'bottom-up') {
            // Already sorted
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
            // WWB-Style: Keep strict grid sequential array, do NOT shuffle!
        }

        backtrackTargets.push({
            id: String(req.id),
            type: typeToUse as 'mic' | 'iem',
            equipmentKey: req.key,
            thresholds: reqThresholds,
            zoneIndex: 0,
            candidates,
            candIndex: 0,
            count: targetToFind,
            validationPool: unifiedPool,
            linearMode: req.linearMode,
            baseFreqObj: {
                type: typeToUse,
                sourceRequestId: String(req.id),
                equipmentKey: req.key,
                compatibilityLevel: req.compatibilityLevel,
                label: req.label,
                manualThresholds: (useGlobalThresholds || req.useManualParams) ? reqThresholds : undefined,
                zoneIndex: 0,
                locked: false,
                linearMode: req.linearMode
            }
        });
    }

    if (onProgress) onProgress(0.5);
    
    // Execute backtracking search
    const foundFreqs = await executeWwbBacktrack(backtrackTargets, dummyDist, db, globalOverrides, undefined, undefined, undefined);
    
    const finalPool = [...unifiedPool, ...foundFreqs];
    if (onProgress) onProgress(1);
    
    return finalPool;
};

"""

content = content[:start_idx] + new_func + content[end_idx:]

with open('services/rfService.ts', 'w') as f:
    f.write(content)
