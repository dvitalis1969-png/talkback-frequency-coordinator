const fs = require('fs');
let code = fs.readFileSync('constants/guides.ts', 'utf8');

if (!code.includes('tvLookup:')) {
  code = code.replace(/};\s*$/, `    tvLookup: [\n        {\n            title: "TV Channel Lookup",\n            description: "Find available TV channels based on location and clearance criteria.",\n            markdown: "### How to use\\n1. Select your region.\\n2. Enter location details.\\n3. Review occupied and available channels."\n        }\n    ]\n};\n`);
  fs.writeFileSync('constants/guides.ts', code);
  console.log('patched guides.ts');
}
