import re

with open('services/rfService.ts', 'r') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "if (typeToUse !== 'iem') candidates = shuffleArray(candidates);" in line:
        if i > 1200: # Skip the one in resolveGeneratorRequests which is correct
            lines[i] = line.replace("typeToUse", "bucket.type")

with open('services/rfService.ts', 'w') as f:
    f.writelines(lines)
