import re

with open('services/rfService.ts', 'r') as f:
    content = f.read()

old_sort = """            const shuffledReqs = [...bucket.reqs].sort(() => Math.random() - 0.5);"""
new_sort = """            // WWB-Style: Hardest First Sorting
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
            });"""

content = content.replace(old_sort, new_sort)

with open('services/rfService.ts', 'w') as f:
    f.write(content)
