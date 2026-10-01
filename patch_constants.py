import re

with open('constants.ts', 'r') as f:
    content = f.read()

# Replace any threeTone: 0.050 with threeTone: 0.000 for IEMs
# Since we only want to do this for IEMs, let's just regex all recommendedThresholds where type is 'iem'
def replacer(match):
    block = match.group(0)
    if "'iem'" in block or "type: 'iem'" in block:
        block = block.replace("threeTone: 0.050", "threeTone: 0.000")
        block = block.replace("threeTone: 0.025", "threeTone: 0.000") # Just in case
    return block

content = re.sub(r'\{[^{}]*type:\s*\'iem\'[^{}]*\}', replacer, content)

# But wait, the regex above might not match if the definition spans multiple lines and nested braces.
# Let's just do a simpler search and replace for the multi-line PSM1000 declarations.
content = re.sub(r'(name:\s*\'Shure PSM 1000\'[^{]*recommendedThresholds:\s*\{\s*fundamental:\s*0\.375,\s*twoTone:\s*0\.250,\s*threeTone:\s*)0\.050', r'\g<1>0.000', content)
content = re.sub(r'(type:\s*\'iem\'[^{]*recommendedThresholds:\s*\{\s*fundamental:\s*[0-9.]+,\s*twoTone:\s*[0-9.]+,\s*threeTone:\s*)0\.050', r'\g<1>0.000', content)


with open('constants.ts', 'w') as f:
    f.write(content)
