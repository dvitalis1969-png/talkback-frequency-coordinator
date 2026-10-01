const fs = require('fs');
let content = fs.readFileSync('services/rfService.ts', 'utf-8');

content = content.replace(
`                    fundamental: parseFloat(generatorGlobalThresholds.fundamental) || 0.35, 
                    twoTone: parseFloat(generatorGlobalThresholds.twoTone) || 0.05, 
                    threeTone: parseFloat(generatorGlobalThresholds.threeTone) || 0.05, 
                    fiveTone: parseFloat(generatorGlobalThresholds.fiveTone || '0') || 0, 
                    sevenTone: parseFloat(generatorGlobalThresholds.sevenTone || '0') || 0 `,
`                    fundamental: isNaN(parseFloat(generatorGlobalThresholds.fundamental)) ? 0.35 : parseFloat(generatorGlobalThresholds.fundamental), 
                    twoTone: isNaN(parseFloat(generatorGlobalThresholds.twoTone)) ? 0.05 : parseFloat(generatorGlobalThresholds.twoTone), 
                    threeTone: isNaN(parseFloat(generatorGlobalThresholds.threeTone)) ? 0.05 : parseFloat(generatorGlobalThresholds.threeTone), 
                    fiveTone: isNaN(parseFloat(generatorGlobalThresholds.fiveTone)) ? 0 : parseFloat(generatorGlobalThresholds.fiveTone), 
                    sevenTone: isNaN(parseFloat(generatorGlobalThresholds.sevenTone)) ? 0 : parseFloat(generatorGlobalThresholds.sevenTone) `
);

fs.writeFileSync('services/rfService.ts', content);
