const fs = require('fs');
let content = fs.readFileSync('services/rfService.ts', 'utf-8');

// Replace multiline objects
content = content.replace(/fundamental:\s*req\.manualFundamental\s*\|\|\s*0\.35/g, 'fundamental: req.manualFundamental ?? 0.35');
content = content.replace(/twoTone:\s*req\.manualTwoTone\s*\|\|\s*0\.05/g, 'twoTone: req.manualTwoTone ?? 0.05');
content = content.replace(/threeTone:\s*req\.manualThreeTone\s*\|\|\s*0\.05/g, 'threeTone: req.manualThreeTone ?? 0.05');
content = content.replace(/fiveTone:\s*req\.manualFiveTone\s*\|\|\s*0/g, 'fiveTone: req.manualFiveTone ?? 0');
content = content.replace(/sevenTone:\s*req\.manualSevenTone\s*\|\|\s*0/g, 'sevenTone: req.manualSevenTone ?? 0');

// Replace single line declarations
content = content.replace(/fundamental:\s*req\.manualFundamental\s*\|\|\s*0\.35,\s*twoTone:\s*req\.manualTwoTone\s*\|\|\s*0\.05,\s*threeTone:\s*req\.manualThreeTone\s*\|\|\s*0\.05/g, 'fundamental: req.manualFundamental ?? 0.35, twoTone: req.manualTwoTone ?? 0.05, threeTone: req.manualThreeTone ?? 0.05');

fs.writeFileSync('services/rfService.ts', content);
