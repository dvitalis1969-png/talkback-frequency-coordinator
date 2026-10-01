import re

with open('services/rfService.ts', 'r') as f:
    content = f.read()

# 1. Inject WWB Backtrack Core before generateCompatibleFreqs
backtrack_code = """
export interface BacktrackTarget {
    id: string;
    type: 'mic' | 'iem';
    equipmentKey: string;
    thresholds: Thresholds;
    zoneIndex: number;
    candidates: number[];
    candIndex: number;
    baseFreqObj: Partial<Frequency>; 
    validationPool: Frequency[];
    linearMode?: boolean;
    count: number;
}

export const executeWwbBacktrack = async (
    targets: BacktrackTarget[],
    distances: number[][],
    db: Record<string, EquipmentProfile>,
    globalOverrides?: Record<string, Partial<Thresholds>>,
    abortSignal?: AbortSignal,
    actIntermodMatrix?: Record<string, Record<string, boolean>>,
    actId?: string
): Promise<Frequency[]> => {
    // Expand requested counts into individual targets
    const individualTargets: BacktrackTarget[] = [];
    for (const t of targets) {
        for (let i = 0; i < t.count; i++) {
            individualTargets.push({
                ...t,
                candIndex: 0,
                baseFreqObj: { ...t.baseFreqObj, label: t.baseFreqObj.label ? `${t.baseFreqObj.label} ${i + 1}` : undefined }
            });
        }
    }

    // 1. Sort WWB Style (Hardest First: IEMs, then largest thresholds)
    individualTargets.sort((a, b) => {
        const typeA = a.type || db[a.equipmentKey]?.type || 'generic';
        const typeB = b.type || db[b.equipmentKey]?.type || 'generic';
        let scoreA = (typeA === 'iem') ? 1000 : 0;
        let scoreB = (typeB === 'iem') ? 1000 : 0;
        scoreA += (a.thresholds.fundamental * 100) + (a.thresholds.twoTone * 20) + (a.thresholds.threeTone * 10);
        scoreB += (b.thresholds.fundamental * 100) + (b.thresholds.twoTone * 20) + (b.thresholds.threeTone * 10);
        return scoreB - scoreA;
    });

    let currentIdx = 0;
    let backtrackCount = 0;
    const maxBacktracks = 25000;
    const assigned: Frequency[] = [];

    while (currentIdx < individualTargets.length && currentIdx >= 0) {
        if (abortSignal?.aborted) throw new Error('AbortError');
        if (backtrackCount > maxBacktracks) break; // Timeout fallback
        
        if (backtrackCount % 1000 === 0 && backtrackCount > 0) {
            await new Promise(r => setTimeout(r, 0)); // yield
        }

        const target = individualTargets[currentIdx];
        let found = false;

        // Active pool contains the base pool + previously assigned frequencies in this pass
        const activePool = [...target.validationPool, ...assigned];

        while (target.candIndex < target.candidates.length) {
            const val = target.candidates[target.candIndex];
            
            const check = isExhaustiveCompatibleMutual(
                val, target.thresholds, target.zoneIndex, activePool, distances, db, globalOverrides, 10, target.linearMode, actIntermodMatrix, actId
            );

            target.candIndex++;

            if (check.conflicts.length === 0) {
                assigned.push({
                    ...target.baseFreqObj,
                    value: val,
                    id: `${target.id}-${currentIdx}`
                } as Frequency);
                found = true;
                break;
            }
        }

        if (found) {
            currentIdx++;
        } else {
            // BACKTRACK
            target.candIndex = 0; 
            currentIdx--;
            if (currentIdx >= 0) {
                assigned.pop(); 
            }
            backtrackCount++;
        }
    }

    return assigned;
};

"""
content = content.replace("export const generateCompatibleFreqs = (", backtrack_code + "export const generateCompatibleFreqs = (")

with open('services/rfService.ts', 'w') as f:
    f.write(content)
