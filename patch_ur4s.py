import re

with open('constants.ts', 'r') as f:
    content = f.read()

content = re.sub(r'(name:\s*\'Shure UR4S[^{]*threeTone:\s*)0\.000', r'\g<1>0.050', content)

with open('constants.ts', 'w') as f:
    f.write(content)
