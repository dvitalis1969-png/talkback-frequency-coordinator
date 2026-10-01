const fs = require('fs');
let content = fs.readFileSync('components/ZonalTalkbackTab.tsx', 'utf-8');

content = content.replace(
`        const resPairs = res.pairs.map((p) => ({
          ...p,
          groupName: m.isSubzone
            ? m.subzoneName
            : talkbackZoneConfigs[m.parentIdx].name,
        }));`,
`        const resPairs = res.pairs.map((p) => ({
          ...p,
          groupName: m.isSubzone
            ? p.groupName.includes("(Custom)") ? \`\${m.subzoneName} (Custom)\` : m.subzoneName
            : p.groupName.includes("(Custom)") ? \`\${talkbackZoneConfigs[m.parentIdx].name} (Custom)\` : talkbackZoneConfigs[m.parentIdx].name,
        }));`
);

fs.writeFileSync('components/ZonalTalkbackTab.tsx', content);
