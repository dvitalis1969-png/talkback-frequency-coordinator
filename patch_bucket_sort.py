import re

with open('services/rfService.ts', 'r') as f:
    content = f.read()

old_bucket = """        const requestTypes: {reqs: EquipmentRequest[], type: 'mic' | 'iem'}[] = [{ reqs: act.micRequests || [], type: 'mic' }, { reqs: act.iemRequests || [], type: 'iem' }];
        if (Math.random() > 0.5) requestTypes.reverse();"""

new_bucket = """        const requestTypes: {reqs: EquipmentRequest[], type: 'mic' | 'iem'}[] = [{ reqs: act.micRequests || [], type: 'mic' }, { reqs: act.iemRequests || [], type: 'iem' }];
        // WWB-Style: ALWAYS process IEMs before Mics (Hardest First)
        requestTypes.reverse();"""

content = content.replace(old_bucket, new_bucket)

with open('services/rfService.ts', 'w') as f:
    f.write(content)
