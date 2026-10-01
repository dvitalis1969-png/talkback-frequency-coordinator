import re

with open('services/rfService.ts', 'r') as f:
    content = f.read()

old_resolve_shuffle = """        // Optimization: Shuffle request order each trial to explore better packing combinations
        const trialRequests = trial % 10 === 0 ? requests : shuffleArray(requests);"""

new_resolve_shuffle = """        // WWB-Style: Hardest First Sorting
        const trialRequests = [...requests].sort((a,b) => {
            const profA = db[a.key] || db['custom'];
            const profB = db[b.key] || db['custom'];
            let scoreA = profA?.type === 'iem' ? 1000 : 0;
            let scoreB = profB?.type === 'iem' ? 1000 : 0;
            const thA = a.useManualParams ? { fundamental: parseFloat(String(a.manualFundamental)) || 0.35, threeTone: parseFloat(String(a.manualThreeTone)) || 0.05 } : getFinalThresholds({ equipmentKey: a.key, compatibilityLevel: a.compatibilityLevel }, db, globalOverrides);
            const thB = b.useManualParams ? { fundamental: parseFloat(String(b.manualFundamental)) || 0.35, threeTone: parseFloat(String(b.manualThreeTone)) || 0.05 } : getFinalThresholds({ equipmentKey: b.key, compatibilityLevel: b.compatibilityLevel }, db, globalOverrides);
            scoreA += (thA.fundamental * 100) + (thA.threeTone * 10);
            scoreB += (thB.fundamental * 100) + (thB.threeTone * 10);
            return scoreB - scoreA;
        });"""

content = content.replace(old_resolve_shuffle, new_resolve_shuffle)

old_cand_shuffle = """                } else if (pattern > 0.25) {
                    const edgeCand = [];
                    let l = 0; let r = candidates.length - 1;
                    while(l <= r) {
                        if (l === r) { edgeCand.push(candidates[l]); break; }
                        edgeCand.push(candidates[l++]); edgeCand.push(candidates[r--]);
                    }
                    candidates = edgeCand;
                }
            } else {
                candidates = shuffleArray(candidates);
            }"""

new_cand_shuffle = """                } else if (pattern > 0.25) {
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
                // candidates = candidates;
            }"""
content = content.replace(old_cand_shuffle, new_cand_shuffle)

with open('services/rfService.ts', 'w') as f:
    f.write(content)
