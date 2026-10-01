import re

with open('services/rfService.ts', 'r') as f:
    content = f.read()

target_text = r"\} else \{\s+// BACKTRACK\s+target\.candIndex = 0;\s+// DYNAMIC RANDOM RESTART: If we are stuck in a deep local minimum, shuffle to break out\s+if \(backtrackCount > 0 && backtrackCount % 5000 === 0\) \{\s+target\.candidates = \[\.\.\.target\.candidates\]\.sort\(\(\) => Math\.random\(\) - 0\.5\);\s+\}\s+currentIdx--;\s+if \(currentIdx >= 0\) \{\s+assigned\.pop\(\);\s+\}\s+backtrackCount\+\+;\s+\}"

replacement = """        } else {
            // BACKTRACK
            target.candIndex = 0; 
            
            // DYNAMIC RANDOM RESTART: If we are stuck in a deep local minimum, we need to completely scramble
            // the remaining targets to break out of the DFS trap.
            if (backtrackCount > 0 && backtrackCount % 2000 === 0) {
                // Shuffle candidates for the CURRENT and ALL PREVIOUS targets to completely reset the search tree path
                for (let k = 0; k <= currentIdx; k++) {
                    individualTargets[k].candidates = [...individualTargets[k].candidates].sort(() => Math.random() - 0.5);
                }
                // Force it to jump further back to break the local minimum faster
                const jumpBack = Math.min(currentIdx, Math.floor(Math.random() * 3) + 1);
                for(let j=0; j<jumpBack; j++) {
                    currentIdx--;
                    if (currentIdx >= 0) assigned.pop();
                }
            } else {
                currentIdx--;
                if (currentIdx >= 0) {
                    assigned.pop();
                }
            }
            backtrackCount++;
        }"""

content = re.sub(target_text, replacement, content)

with open('services/rfService.ts', 'w') as f:
    f.write(content)
