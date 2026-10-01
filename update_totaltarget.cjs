const fs = require('fs');
let content = fs.readFileSync('components/ZonalTalkbackTab.tsx', 'utf-8');

content = content.replace(
`      if (c.talkbackStrategy === "subzones" && c.subzones) {
        return (
          sum +
          c.subzones.reduce(
            (szSum, sz) =>
              szSum +
              sz.pairCount +
              (sz.customPairCount || 0) +
              (sz.simplexTxCount || 0) +
              (sz.simplexWalkieCount || 0) +
              (sz.customSimplexTxCount || 0) +
              (sz.customSimplexWalkieCount || 0),
            0,
          )
        );
      }`,
`      if (c.talkbackStrategy === "subzones" && c.subzones) {
        return (
          sum +
          c.subzones.reduce(
            (szSum, sz) =>
              szSum +
              sz.pairCount +
              (sz.customPairCount || 0) +
              (sz.simplexTxCount || 0) +
              (sz.simplexWalkieCount || 0) +
              (sz.customSimplexTxCount || 0) +
              (sz.customSimplexWalkieCount || 0),
            0,
          ) +
          (c.pairCount || 0) +
          (c.customPairCount || 0) +
          (c.simplexTxCount || 0) +
          (c.simplexWalkieCount || 0) +
          (c.customSimplexTxCount || 0) +
          (c.customSimplexWalkieCount || 0)
        );
      }`
);

fs.writeFileSync('components/ZonalTalkbackTab.tsx', content);
