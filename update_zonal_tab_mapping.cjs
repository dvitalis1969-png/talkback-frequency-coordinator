const fs = require('fs');
let content = fs.readFileSync('components/ZonalTalkbackTab.tsx', 'utf-8');

content = content.replace(
`        customRxMin: c.customRxMin,
        customRxMax: c.customRxMax,`,
`        customRxMin: c.customRxMin,
        customRxMax: c.customRxMax,
        customRanges: c.customRanges,`
);

fs.writeFileSync('components/ZonalTalkbackTab.tsx', content);
console.log("Updated ZonalTalkbackTab.tsx mapping");
