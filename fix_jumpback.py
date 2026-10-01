import re

with open('services/rfService.ts', 'r') as f:
    content = f.read()

target_text = """                const jumpBack = Math.min(currentIdx, Math.floor(Math.random() * 3) + 1);
                for(let j=0; j<jumpBack; j++) {
                    currentIdx--;
                    if (currentIdx >= 0) assigned.pop();
                }"""

replacement = """                const jumpBack = Math.min(currentIdx, Math.floor(Math.random() * 5) + 1);
                for(let j=0; j<jumpBack; j++) {
                    individualTargets[currentIdx].candIndex = 0;
                    currentIdx--;
                    if (currentIdx >= 0) assigned.pop();
                }"""

content = content.replace(target_text, replacement)

with open('services/rfService.ts', 'w') as f:
    f.write(content)
