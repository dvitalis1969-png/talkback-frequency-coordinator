import re

with open('services/rfService.ts', 'r') as f:
    content = f.read()

# Fix executeWwbBacktrack signature
old_sig = """export const executeWwbBacktrack = async (
    targets: BacktrackTarget[],
    distances: number[][],
    db: Record<string, EquipmentProfile>,
    globalOverrides?: Record<string, Partial<Thresholds>>,
    abortSignal?: AbortSignal,
    actIntermodMatrix?: Record<string, Record<string, boolean>>,
    actId?: string
): Promise<Frequency[]>"""
new_sig = """export const executeWwbBacktrack = async (
    targets: BacktrackTarget[],
    distances: number[][],
    db: Record<string, EquipmentProfile>,
    globalOverrides?: Record<string, Partial<Thresholds>>,
    abortSignal?: AbortSignal,
    matrix?: boolean[][],
    distanceWeightingEnabled: boolean = true
): Promise<Frequency[]>"""
content = content.replace(old_sig, new_sig)

# Fix isExhaustiveCompatibleMutual call in executeWwbBacktrack
old_call = """            const check = isExhaustiveCompatibleMutual(
                val, target.thresholds, target.zoneIndex, activePool, distances, db, globalOverrides, 10, target.linearMode, actIntermodMatrix, actId
            );"""
new_call = """            const check = isExhaustiveCompatibleMutual(
                val, target.thresholds, target.zoneIndex, activePool, distances, db, globalOverrides, 10, target.linearMode, matrix, distanceWeightingEnabled
            );"""
content = content.replace(old_call, new_call)

# Fix generateFestivalPlan call
old_fest_call = """        const backtrackFound = await executeWwbBacktrack(
            actBacktrackTargets,
            matrix ? distances : [[0]], // Use provided distances if matrix exists
            db,
            globalOverrides,
            abortSignal,
            actIntermodMatrix,
            act.id
        );"""
new_fest_call = """        const backtrackFound = await executeWwbBacktrack(
            actBacktrackTargets,
            matrix ? distances : [[0]],
            db,
            globalOverrides,
            abortSignal,
            matrix,
            distanceWeightingEnabled
        );"""
content = content.replace(old_fest_call, new_fest_call)

with open('services/rfService.ts', 'w') as f:
    f.write(content)
