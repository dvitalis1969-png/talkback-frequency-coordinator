const fs = require('fs');
let data = fs.readFileSync('constants/guides.ts', 'utf8');

const regex1 = /,\s*\{\s*title:\s*"Visual Tuning Preview"[\s\S]*?physics:\s*"The preview models 3rd-order IMD products[\s\S]*?"\s*\}/g;

data = data.replace(regex1, '');
fs.writeFileSync('constants/guides.ts', data);
console.log("Removed Visual Tuning Preview");
