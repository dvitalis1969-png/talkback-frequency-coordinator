const fs = require('fs');
let content = fs.readFileSync('components/MultizoneTab.tsx', 'utf-8');

content = content.replace(
`                        fundamental: Number(req.manualFundamental) || 0.35,
                        twoTone: Number(req.manualTwoTone) || 0.075,
                        threeTone: Number(req.manualThreeTone) || 0.05,`,
`                        fundamental: isNaN(Number(req.manualFundamental)) ? 0.35 : Number(req.manualFundamental),
                        twoTone: isNaN(Number(req.manualTwoTone)) ? 0.075 : Number(req.manualTwoTone),
                        threeTone: isNaN(Number(req.manualThreeTone)) ? 0.05 : Number(req.manualThreeTone),`
);

content = content.replace(
`                                    ? { fundamental: group.manualFundamental || 0, twoTone: group.manualTwoTone || 0, threeTone: group.manualThreeTone || 0 }`,
`                                    ? { fundamental: group.manualFundamental ?? 0, twoTone: group.manualTwoTone ?? 0, threeTone: group.manualThreeTone ?? 0 }`
);

fs.writeFileSync('components/MultizoneTab.tsx', content);
