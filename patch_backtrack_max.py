import re

with open('services/rfService.ts', 'r') as f:
    content = f.read()

# Track bestAssigned in executeWwbBacktrack
old_loop = """    let currentIdx = 0;
    let backtrackCount = 0;
    const maxBacktracks = 25000;
    const assigned: Frequency[] = [];

    while (currentIdx < individualTargets.length && currentIdx >= 0) {"""
new_loop = """    let currentIdx = 0;
    let backtrackCount = 0;
    const maxBacktracks = 25000;
    const assigned: Frequency[] = [];
    let bestAssigned: Frequency[] = [];

    while (currentIdx < individualTargets.length && currentIdx >= 0) {"""
content = content.replace(old_loop, new_loop)

old_found = """        if (found) {
            currentIdx++;
        } else {"""
new_found = """        if (found) {
            currentIdx++;
            if (assigned.length > bestAssigned.length) {
                bestAssigned = [...assigned];
            }
        } else {"""
content = content.replace(old_found, new_found)

old_return = """    }
    return assigned;
};"""
new_return = """    }
    // If we completed the search or hit the limit, return the best we found
    return assigned.length === individualTargets.length ? assigned : bestAssigned;
};"""
content = content.replace(old_return, new_return)

with open('services/rfService.ts', 'w') as f:
    f.write(content)
