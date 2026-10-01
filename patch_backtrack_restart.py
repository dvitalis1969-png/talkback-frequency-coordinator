import re

with open('services/rfService.ts', 'r') as f:
    content = f.read()

old_loop = """        if (found) {
            currentIdx++;
            if (assigned.length > bestAssigned.length) {
                bestAssigned = [...assigned];
            }
        } else {
            // BACKTRACK
            target.candIndex = 0; 
            currentIdx--;
            if (currentIdx >= 0) {
                assigned.pop();
            }
            backtrackCount++;
        }"""

new_loop = """        if (found) {
            currentIdx++;
            if (assigned.length > bestAssigned.length) {
                bestAssigned = [...assigned];
            }
        } else {
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

content = content.replace(old_loop, new_loop)

# Increase max backtracks to give it more time to find the solution
content = content.replace("const maxBacktracks = 25000;", "const maxBacktracks = 500000;")

with open('services/rfService.ts', 'w') as f:
    f.write(content)
