import re

with open('services/rfService.ts', 'r') as f:
    content = f.read()

target_code = """        for (const bucket of requestTypes) {
            const shuffledReqs = [...bucket.reqs].sort(() => Math.random() - 0.5);
            for (const req of shuffledReqs) {"""

# Replace `candidates = shuffleArray(candidates);` inside generateFestivalPlan
old_shuffle = """                        // Default (<0.25) remains natural Top-Down array
                    } else {
                        candidates = shuffleArray(candidates);
                    }"""

new_shuffle = """                        // Default (<0.25) remains natural Top-Down array
                    } else {
                        // WWB-Style: Keep strict grid sequential array, do NOT shuffle!
                        // candidates = candidates; 
                    }"""
content = content.replace(old_shuffle, new_shuffle)

with open('services/rfService.ts', 'w') as f:
    f.write(content)
