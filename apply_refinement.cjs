const fs = require('fs');

let code = fs.readFileSync('app/index.tsx', 'utf8');

// ================= 1. REMOVE GLASS COCKPIT SCOPE COMPONENT =================
const glassScopeStart = '// ================= INLINE COMPONENT: GLASS COCKPIT SCOPE (REACT NATIVE) =================';
const imdInspectorStart = '// ================= INLINE COMPONENT: TALKBACK IMD INSPECTOR (SIMPLIFIED) =================';

const gsIdx = code.indexOf(glassScopeStart);
const imdIdx = code.indexOf(imdInspectorStart);

if (gsIdx === -1 || imdIdx === -1) {
  console.error('Scope / IMD markers not found! gsIdx:', gsIdx, 'imdIdx:', imdIdx);
  process.exit(1);
}

// Remove everything from glassScopeStart up to imdInspectorStart
code = code.substring(0, gsIdx) + code.substring(imdIdx);
console.log('Removed Glass Cockpit Scope inline component code');

// ================= 2. UPDATE TOPPANELMODE TYPE & STATE =================
code = code.replace(
  "// View state: 'COORDINATOR' | 'GLASS_SCOPE' | 'IMD_PLAYGROUND' | 'MATRIX' | 'MAP' | 'PTT_SIM'",
  "// View state: 'COORDINATOR' | 'IMD_PLAYGROUND' | 'MATRIX' | 'MAP' | 'PTT_SIM'"
);
code = code.replace(
  "const [topPanelMode, setTopPanelMode] = useState<'COORDINATOR' | 'GLASS_SCOPE' | 'IMD_PLAYGROUND' | 'MATRIX' | 'MAP' | 'PTT_SIM'>('COORDINATOR');",
  "const [topPanelMode, setTopPanelMode] = useState<'COORDINATOR' | 'IMD_PLAYGROUND' | 'MATRIX' | 'MAP' | 'PTT_SIM'>('COORDINATOR');"
);

// ================= 3. REMOVE GLASS COCKPIT ROCKER BUTTON =================
const glassBtnStart = "{/* 2. GLASS COCKPIT SCOPE BUTTON */}";
const imdBtnStart = "{/* 3. TALKBACK IMD INSPECTOR BUTTON */}";

const gbIdx = code.indexOf(glassBtnStart);
const ibIdx = code.indexOf(imdBtnStart);

if (gbIdx !== -1 && ibIdx !== -1) {
  code = code.substring(0, gbIdx) + "{/* 2. TALKBACK IMD INSPECTOR BUTTON */}\n" + code.substring(ibIdx + imdBtnStart.length);
  console.log('Removed Glass Scope rocker button');
} else {
  console.error('Glass rocker button markers not found!');
  process.exit(1);
}

// ================= 4. REMOVE GLASS COCKPIT RENDER BLOCK =================
const glassRenderStart = "{/* MODE 5: GLASS COCKPIT SPECTRUM SCOPE */}";
const imdRenderStart = "{/* MODE 6: TALKBACK IMD COMPATIBILITY INSPECTOR */}";

const grIdx = code.indexOf(glassRenderStart);
const irIdx = code.indexOf(imdRenderStart);

if (grIdx !== -1 && irIdx !== -1) {
  code = code.substring(0, grIdx) + "{/* MODE 5: TALKBACK IMD COMPATIBILITY INSPECTOR */}\n" + code.substring(irIdx + imdRenderStart.length);
  console.log('Removed Glass Scope render block');
} else {
  console.error('Glass render markers not found!');
  process.exit(1);
}

// ================= 5. REVISE IMDTALKBACKINSPECTOR: 5 DECIMAL PLACES & NO OFCOM PRESET BUTTON =================

// Replace default frequencies text and arrays to 5 decimal places:
code = code.replace(
  "    initialFrequencies && initialFrequencies.length > 0\n      ? initialFrequencies.map(f => f.toFixed(4)).join('\\n')\n      : '455.03125\\n455.19375\\n455.35625\\n468.05625\\n468.21875'",
  "    initialFrequencies && initialFrequencies.length > 0\n      ? initialFrequencies.map(f => f.toFixed(5)).join('\\n')\n      : '455.03125\\n455.19375\\n455.35625\\n468.05625\\n468.21875'"
);

// In 2-TX 3rd formula:
code = code.replace(
  "formula: `2(${fA.toFixed(4)}) - ${fB.toFixed(4)}`,",
  "formula: `2(${fA.toFixed(5)}) - ${fB.toFixed(5)}`, "
);

// In 3-TX 3rd formula:
code = code.replace(
  "formula: `${fA.toFixed(4)} + ${fB.toFixed(4)} - ${fC.toFixed(4)}`,",
  "formula: `${fA.toFixed(5)} + ${fB.toFixed(5)} - ${fC.toFixed(5)}`, "
);

// In handleAddSingleFreq:
code = code.replace(
  "setInputText(updated.map(f => f.toFixed(4)).join('\\n'));",
  "setInputText(updated.map(f => f.toFixed(5)).join('\\n'));"
);

// In handleRemoveFreq:
code = code.replace(
  "setInputText(updated.map(f => f.toFixed(4)).join('\\n'));",
  "setInputText(updated.map(f => f.toFixed(5)).join('\\n'));"
);

// In chip display:
code = code.replace(
  "<Text style={tbStyles.freqChipText}>{f.toFixed(4)} MHz</Text>",
  "<Text style={tbStyles.freqChipText}>{f.toFixed(5)} MHz</Text>"
);

// In table cell spur & hit:
code = code.replace(
  "<Text style={[tbStyles.cellTextSpur, { flex: 1.2, textAlign: 'center' }]}>{c.intermodFreq.toFixed(4)}</Text>",
  "<Text style={[tbStyles.cellTextSpur, { flex: 1.2, textAlign: 'center' }]}>{c.intermodFreq.toFixed(5)}</Text>"
);
code = code.replace(
  "<Text style={[tbStyles.cellTextHit, { flex: 1.2, textAlign: 'center' }]}>{c.hitFreq.toFixed(4)}</Text>",
  "<Text style={[tbStyles.cellTextHit, { flex: 1.2, textAlign: 'center' }]}>{c.hitFreq.toFixed(5)}</Text>"
);

// Remove loadPreset function definition:
const loadPresetMarkerStart = "  // Load standard UK OFCOM Talkback Presets";
const loadPresetMarkerEnd = "  return (";
const lpStart = code.indexOf(loadPresetMarkerStart);
const lpEnd = code.indexOf(loadPresetMarkerEnd);

if (lpStart !== -1 && lpEnd !== -1) {
  code = code.substring(0, lpStart) + code.substring(lpEnd);
  console.log('Removed loadPreset function definition');
} else {
  console.error('loadPreset markers not found!');
  process.exit(1);
}

// Remove the LOAD OFCOM SET button from the header:
const headerButtonBlock = `        <TouchableOpacity
          style={tbStyles.presetToggleBtn}
          onPress={() => loadPreset('OFCOM_DUPLEX')}
        >
          <Text style={tbStyles.presetToggleText}>LOAD OFCOM SET</Text>
        </TouchableOpacity>`;

if (code.includes(headerButtonBlock)) {
  code = code.replace(headerButtonBlock, "");
  console.log('Removed LOAD OFCOM SET button from UI');
} else {
  console.log('Header button block direct string not found, trying regex/flexible match');
  const btnStart = code.indexOf("<TouchableOpacity\n          style={tbStyles.presetToggleBtn}");
  const btnEnd = code.indexOf("</TouchableOpacity>", btnStart);
  if (btnStart !== -1 && btnEnd !== -1) {
    code = code.substring(0, btnStart) + code.substring(btnEnd + "</TouchableOpacity>".length);
    console.log('Removed LOAD OFCOM SET button via index search');
  }
}

// Update the export description
code = code.replace(
  "description: '100% pure React Native all-in-one file with Glass Cockpit Scope & Simplified Talkback IMD Inspector (400-470MHz). Works out of the box in Expo without any HTML or missing import errors.',",
  "description: '100% pure React Native all-in-one file with 5-decimal place Talkback IMD Compatibility Inspector (400-470MHz). Works out of the box in Expo without any errors.',"
);

fs.writeFileSync('app/index.tsx', code, 'utf8');
fs.writeFileSync('app/index.txt', code, 'utf8');
console.log('Successfully updated app/index.tsx and app/index.txt! Total lines:', code.split('\n').length);
