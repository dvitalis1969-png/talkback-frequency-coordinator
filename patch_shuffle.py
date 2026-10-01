import re

with open('services/rfService.ts', 'r') as f:
    content = f.read()

# Fix 1: generateCompatibleFreqs
content = re.sub(
    r"(\/\/ even-distribution\n\s+)candidates = shuffleArray\(candidates\);",
    r"\1if (profile?.type !== 'iem') candidates = shuffleArray(candidates);",
    content
)

# Fix 2: inside resolveMultiZoneRequest
content = re.sub(
    r"(if \(calculationStrategy === 'even-distribution'\) {\n\s+)candidates = shuffleArray\(candidates\);",
    r"\1if (config.type !== 'iem') candidates = shuffleArray(candidates);",
    content
)

# Fix 3: resolveGeneratorRequests (around line 1190)
content = re.sub(
    r"(} else {\n\s+)candidates = shuffleArray\(candidates\);\n(\s+})\n(\s+backtrackTargets\.push\(\{)",
    r"\1if (typeToUse !== 'iem') candidates = shuffleArray(candidates);\n\2\n\3",
    content
)

# Fix 4: generateSiteInfrastructure (house/constants)
# Line 1398: "} else { \n candidates = shuffleArray(candidates); \n }"
content = re.sub(
    r"(} else {\n\s+)candidates = shuffleArray\(candidates\);\n(\s+})\n(\s+let found = 0;)",
    r"\1if (typeToUse !== 'iem') candidates = shuffleArray(candidates);\n\2\n\3",
    content
)

# Fix 5: generateFestivalPlan (constants/house pre-calc)
# Line 1590: "} else { \n candidates = shuffleArray(candidates); \n }"
content = re.sub(
    r"(} else {\n\s+)candidates = shuffleArray\(candidates\);\n(\s+})\n(\s+let found = 0;\n\s+let checksSinceYield = 0;)",
    r"\1if (bucket.type !== 'iem') candidates = shuffleArray(candidates);\n\2\n\3",
    content
)

# Fix 6: generateFestivalPlan (act non-backtrack mode, though we use backtrack mostly now)
# Line 1989
content = re.sub(
    r"(} else {\n\s+)candidates = shuffleArray\(candidates\);\n(\s+})\n(\s+let found = 0;\n\s+let checksSinceYield = 0;\n\s+for)",
    r"\1if (bucket.type !== 'iem') candidates = shuffleArray(candidates);\n\2\n\3",
    content
)

# Fix 7: generateFestivalPlan (backtrack mode)
# Line 2326
content = re.sub(
    r"(} else {\n\s+)candidates = shuffleArray\(candidates\);\n(\s+})\n(\s+actBacktrackTargets\.push)",
    r"\1if (bucket.type !== 'iem') candidates = shuffleArray(candidates);\n\2\n\3",
    content
)


with open('services/rfService.ts', 'w') as f:
    f.write(content)
