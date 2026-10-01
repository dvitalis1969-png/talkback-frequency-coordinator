const fs = require('fs');
let content = fs.readFileSync('components/ZonalTalkbackTab.tsx', 'utf-8');

content = content.replace(
`      if (
        c.talkbackStrategy === "subzones" &&
        c.subzones &&
        c.subzones.length > 0
      ) {
        c.subzones.forEach((sz, subIdx) => {`,
`      if (
        c.talkbackStrategy === "subzones" &&
        c.subzones &&
        c.subzones.length > 0
      ) {
        if (c.pairCount > 0 || (c.customPairCount && c.customPairCount > 0) || c.simplexTxCount > 0 || c.simplexWalkieCount > 0 || (c.customSimplexTxCount && c.customSimplexTxCount > 0) || (c.customSimplexWalkieCount && c.customSimplexWalkieCount > 0)) {
          serviceConfigs.push({
            ...baseConfig,
            pairCount: c.pairCount,
            customPairCount: c.customPairCount || 0,
            simplexTxCount: c.simplexTxCount || 0,
            simplexWalkieCount: c.simplexWalkieCount || 0,
            customSimplexTxCount: c.customSimplexTxCount || 0,
            customSimplexWalkieCount: c.customSimplexWalkieCount || 0,
          });
          virtualMapping.push({ parentIdx, isSubzone: false });
        }
        c.subzones.forEach((sz, subIdx) => {`
);

fs.writeFileSync('components/ZonalTalkbackTab.tsx', content);
