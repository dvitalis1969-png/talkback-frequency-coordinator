const fs = require('fs');

let mainCode = fs.readFileSync('app/index.tsx', 'utf8');
const inspectorCode = fs.readFileSync('app/components/ImdTalkbackInspector.tsx', 'utf8');

// Strip imports from inspector code
const lines = inspectorCode.split('\n');
const strippedInspector = lines.filter(l => !l.startsWith('import ')).join('\n');

// 1. Replace the entire ImdPhysicsPlayground block with ImdTalkbackInspector
const startMarker = '// ================= INLINE COMPONENT: IMD PHYSICS PLAYGROUND (REACT NATIVE) =================';
const endMarker = '// ================= EMBEDDED SELF-CONTAINED SUB-COMPONENTS & RF MATH =================';

const sIdx = mainCode.indexOf(startMarker);
const eIdx = mainCode.indexOf(endMarker);

if (sIdx === -1 || eIdx === -1) {
  console.error('Markers not found! sIdx:', sIdx, 'eIdx:', eIdx);
  process.exit(1);
}

const replacement = '// ================= INLINE COMPONENT: TALKBACK IMD INSPECTOR (SIMPLIFIED) =================\n' + strippedInspector + '\n\n';

mainCode = mainCode.substring(0, sIdx) + replacement + mainCode.substring(eIdx);

// 2. Update rocker button labels from 'IMD PLAYGROUND' to 'IMD INSPECTOR'
mainCode = mainCode.replace(
  "{topPanelMode === 'IMD_PLAYGROUND' ? 'PHYSICS LAB' : 'STANDBY'}",
  "{topPanelMode === 'IMD_PLAYGROUND' ? 'INSPECTOR' : 'STANDBY'}"
);
mainCode = mainCode.replace(
  ">IMD PLAYGROUND<",
  ">IMD INSPECTOR<"
);
mainCode = mainCode.replace(
  ">TOUCH CARRIERS<",
  ">400-470 CLASH CHK<"
);

// 3. Update the view render from ImdPhysicsPlayground to ImdTalkbackInspector
const renderStartMarker = "{/* MODE 6: IMD COLLISION PHYSICS PLAYGROUND */}";
const renderEndMarker = "{/* ACTION BUTTONS */}";

const rStart = mainCode.indexOf(renderStartMarker);
const rEnd = mainCode.indexOf(renderEndMarker);

if (rStart !== -1 && rEnd !== -1) {
  const newRenderBlock = `{/* MODE 6: TALKBACK IMD COMPATIBILITY INSPECTOR */}
          {topPanelMode === 'IMD_PLAYGROUND' && (
            <View style={{ marginTop: 10, borderRadius: 10, overflow: 'hidden' }}>
              <ImdTalkbackInspector
                initialFrequencies={
                  spectrumCarriers.length >= 2
                    ? spectrumCarriers.map(c => c.freq)
                    : undefined
                }
              />
            </View>
          )}

          `;
  mainCode = mainCode.substring(0, rStart) + newRenderBlock + mainCode.substring(rEnd);
  console.log('Replaced render block successfully');
} else {
  console.error('Render markers not found!');
  process.exit(1);
}

mainCode = mainCode.replace(
  "description: '100% pure React Native all-in-one file with Glass Cockpit Scope & IMD Physics Playground fully inlined. Works out of the box in Expo without any HTML or missing import errors.',",
  "description: '100% pure React Native all-in-one file with Glass Cockpit Scope & Simplified Talkback IMD Inspector (400-470MHz). Works out of the box in Expo without any HTML or missing import errors.',"
);

fs.writeFileSync('app/index.tsx', mainCode, 'utf8');
fs.writeFileSync('app/index.txt', mainCode, 'utf8');
console.log('Updated app/index.tsx and app/index.txt! Total lines:', mainCode.split('\n').length);
