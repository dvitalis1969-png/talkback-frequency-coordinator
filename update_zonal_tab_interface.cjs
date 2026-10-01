const fs = require('fs');
let content = fs.readFileSync('components/ZonalTalkbackTab.tsx', 'utf-8');

content = content.replace(
`  customTxMax?: number;
  customRxMin?: number;
  customRxMax?: number;`,
`  customTxMax?: number;
  customRxMin?: number;
  customRxMax?: number;
  customRanges?: { id: string; txMin: number; txMax: number; rxMin: number; rxMax: number }[];`
);

fs.writeFileSync('components/ZonalTalkbackTab.tsx', content);
console.log("Updated ZonalTalkbackTab.tsx interface");
