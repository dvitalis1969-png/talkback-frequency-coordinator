import re

with open('services/rfService.ts', 'r') as f:
    content = f.read()

# Fix signature
content = content.replace("    distanceWeightingEnabled: boolean = true,\n    candidateType: 'mic' | 'iem' | 'comms' | 'generic' = 'generic'\n): { conflicts: Conflict[], reason?: 'fundamental' | 'imd2' | 'imd3' | 'imd5' | 'imd7' } => {",
                          "    distanceWeightingEnabled: boolean = true\n): { conflicts: Conflict[], reason?: 'fundamental' | 'imd2' | 'imd3' | 'imd5' | 'imd7' } => {")

# Fix targetFreq instantiation
target_new = """const targetFreq: Frequency = { 
        type: candidateType as any,
        id: 'candidate', 
        value: candidateValue,"""
target_old = """const targetFreq: Frequency = { 
        id: 'candidate', 
        value: candidateValue,"""
content = content.replace(target_new, target_old)

# Fix line 583
content = re.sub(r"dummyDist, db, globalOverrides, 10, fTarget\.linearMode, matrix, distanceWeightingEnabled, fTarget\.type as any\)",
                 r"dummyDist, db, globalOverrides, 10, fTarget.linearMode, matrix, distanceWeightingEnabled)", content)

# Fix line 812
content = re.sub(r"val, target\.thresholds, target\.zoneIndex, activePool, distances, db, globalOverrides, 10, target\.linearMode, matrix, distanceWeightingEnabled, target\.type as any\)",
                 r"val, target.thresholds, target.zoneIndex, activePool, distances, db, globalOverrides, 10, target.linearMode, matrix, distanceWeightingEnabled)", content)

# Fix line 876
content = content.replace("isExhaustiveCompatibleMutual(val, thresholds, 0, results, dummyDist, db, globalOverrides, 10, false, undefined, true, bucket.type as any)",
                          "isExhaustiveCompatibleMutual(val, thresholds, 0, results, dummyDist, db, globalOverrides, 10, false)")

# Fix line 1048
content = content.replace("isExhaustiveCompatibleMutual(val, thresholds, zIdx, allResolvedFreqs, distances, db, globalOverrides, 10, config.linearMode, compatibilityMatrix, distanceWeightingEnabled, config.type as any)",
                          "isExhaustiveCompatibleMutual(val, thresholds, zIdx, allResolvedFreqs, distances, db, globalOverrides, 10, config.linearMode, compatibilityMatrix, distanceWeightingEnabled)")

# Fix line 1439
content = content.replace("isExhaustiveCompatibleMutual(val, thresholds, zoneIdx, siteFreqs, distances, db, globalOverrides, 10, req.linearMode, matrix, true, bucket.type as any)",
                          "isExhaustiveCompatibleMutual(val, thresholds, zoneIdx, siteFreqs, distances, db, globalOverrides, 10, req.linearMode, matrix)")

# Fix line 1627
content = content.replace("isExhaustiveCompatibleMutual(val, thresholds, zoneIdx, validationPool, distances, db, globalOverrides, 10, req.linearMode, matrix, distanceWeightingEnabled, bucket.type as any)",
                          "isExhaustiveCompatibleMutual(val, thresholds, zoneIdx, validationPool, distances, db, globalOverrides, 10, req.linearMode, matrix, distanceWeightingEnabled)")

# Fix line 2034
content = content.replace("isExhaustiveCompatibleMutual(val, thresholds, zoneIdx, validationPool, distances, db, globalOverrides, 10, req.linearMode, matrix, distanceWeightingEnabled, bucket.type as any)",
                          "isExhaustiveCompatibleMutual(val, thresholds, zoneIdx, validationPool, distances, db, globalOverrides, 10, req.linearMode, matrix, distanceWeightingEnabled)")

# Fix line 2454
content = content.replace("isExhaustiveCompatibleMutual(target.value, th, zIdx, pool, distances, db, globalOverrides, 10, target.linearMode, matrix, distanceWeightingEnabled, target.type as any)",
                          "isExhaustiveCompatibleMutual(target.value, th, zIdx, pool, distances, db, globalOverrides, 10, target.linearMode, matrix, distanceWeightingEnabled)")

with open('services/rfService.ts', 'w') as f:
    f.write(content)
