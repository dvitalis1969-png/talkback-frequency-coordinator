import re

with open('services/rfService.ts', 'r') as f:
    content = f.read()

old_block = """        let currentTrialFound = 0;
        // Optimization: Shuffle request order each trial to explore better packing combinations
        const trialRequests = trial % 10 === 0 ? requests : shuffleArray(requests);

        for (let i = 0; i < trialRequests.length; i++) {"""

new_block = """        let currentTrialFound = 0;
        // WWB-Style: Create backtrack targets instead of shuffling
        const backtrackTargets: BacktrackTarget[] = [];
        
        for (let i = 0; i < requests.length; i++) {
            const trialRequests = requests; // keep original names in loop"""

# Wait, this requires a more precise replacement. Let's extract the loop logic in resolveGeneratorRequests and generateFestivalPlan.
