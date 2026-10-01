import re

with open('services/rfService.ts', 'r') as f:
    content = f.read()

# Let's find exactly the block to replace
target_text = """        } else {
            // BACKTRACK
            target.candIndex = 0; 
            currentIdx--;
            if (currentIdx >= 0) {
                assigned.pop();
            }
            backtrackCount++;
        }"""

replacement = """        } else {
            // BACKTRACK
            target.candIndex = 0; 
            
            // DYNAMIC RANDOM RESTART: If we are stuck in a deep local minimum, shuffle to break out
            if (backtrackCount > 0 && backtrackCount % 5000 === 0) {
                target.candidates = [...target.candidates].sort(() => Math.random() - 0.5);
            }
            
            currentIdx--;
            if (currentIdx >= 0) {
                assigned.pop();
            }
            backtrackCount++;
        }"""

# Use a more flexible regex to catch it
content = re.sub(r'\} else \{\s+// BACKTRACK\s+target\.candIndex = 0;\s+currentIdx--;\s+if \(currentIdx >= 0\) \{\s+assigned\.pop\(\);\s+\}\s+backtrackCount\+\+;\s+\}', replacement, content)

with open('services/rfService.ts', 'w') as f:
    f.write(content)
