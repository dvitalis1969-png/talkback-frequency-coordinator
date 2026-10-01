const fs = require('fs');
let content = fs.readFileSync('services/rfService.ts', 'utf-8');

content = content.replace(
`                    fundamental: parseFloat(String(req.manualFundamental)) || 0.35, 
                    twoTone: parseFloat(String(req.manualTwoTone)) || 0.05, 
                    threeTone: parseFloat(String(req.manualThreeTone)) || 0.00, 
                    fiveTone: parseFloat(String(req.manualFiveTone || '0')) || 0,
                    sevenTone: parseFloat(String(req.manualSevenTone || '0')) || 0`,
`                    fundamental: isNaN(parseFloat(String(req.manualFundamental))) ? 0.35 : parseFloat(String(req.manualFundamental)), 
                    twoTone: isNaN(parseFloat(String(req.manualTwoTone))) ? 0.05 : parseFloat(String(req.manualTwoTone)), 
                    threeTone: isNaN(parseFloat(String(req.manualThreeTone))) ? 0.00 : parseFloat(String(req.manualThreeTone)), 
                    fiveTone: isNaN(parseFloat(String(req.manualFiveTone))) ? 0 : parseFloat(String(req.manualFiveTone)),
                    sevenTone: isNaN(parseFloat(String(req.manualSevenTone))) ? 0 : parseFloat(String(req.manualSevenTone))`
);

fs.writeFileSync('services/rfService.ts', content);
