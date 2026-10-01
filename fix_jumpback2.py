import re

with open('services/rfService.ts', 'r') as f:
    content = f.read()

target_text = """            // DYNAMIC RANDOM RESTART: If we are stuck in a deep local minimum, we need to completely scramble
            // the remaining targets to break out of the DFS trap.
            if (backtrackCount > 0 && backtrackCount % 2000 === 0) {"""

replacement = """            // DYNAMIC RANDOM RESTART: If we are stuck in a deep local minimum, we need to completely scramble
            // the remaining targets to break out of the DFS trap.
            if (backtrackCount > 0 && backtrackCount % 2000 === 0 && currentIdx > 0) {"""

content = content.replace(target_text, replacement)

with open('services/rfService.ts', 'w') as f:
    f.write(content)
