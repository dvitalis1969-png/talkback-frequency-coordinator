const fs = require('fs');

const scopeCode = fs.readFileSync('app/components/GlassCockpitScopeNative.tsx', 'utf8');
const imdCode = fs.readFileSync('app/components/ImdPhysicsPlaygroundNative.tsx', 'utf8');
let mainCode = fs.readFileSync('app/index.tsx', 'utf8');

function stripImports(code, tag) {
  const lines = code.split('\n');
  const nonImports = lines.filter(l => !l.startsWith('import '));
  return `// ================= INLINE COMPONENT: ${tag} =================\n` + nonImports.join('\n');
}

const strippedScope = stripImports(scopeCode, 'GLASS COCKPIT SCOPE (REACT NATIVE)');
const strippedImd = stripImports(imdCode, 'IMD PHYSICS PLAYGROUND (REACT NATIVE)');

const insertMarker = '// ================= EMBEDDED SELF-CONTAINED SUB-COMPONENTS & RF MATH =================';
const insertIdx = mainCode.indexOf(insertMarker);

if (insertIdx === -1) {
  console.error('Insert marker not found!');
  process.exit(1);
}

mainCode = mainCode.substring(0, insertIdx) + strippedScope + '\n\n' + strippedImd + '\n\n' + mainCode.substring(insertIdx);

mainCode = mainCode.replace(
  "const [topPanelMode, setTopPanelMode] = useState<'COORDINATOR' | 'MATRIX' | 'MAP' | 'PTT_SIM'>('COORDINATOR');",
  "const [topPanelMode, setTopPanelMode] = useState<'COORDINATOR' | 'GLASS_SCOPE' | 'IMD_PLAYGROUND' | 'MATRIX' | 'MAP' | 'PTT_SIM'>('COORDINATOR');"
);
mainCode = mainCode.replace(
  "// View state: 'COORDINATOR' | 'MATRIX' | 'MAP' | 'PTT_SIM'",
  "// View state: 'COORDINATOR' | 'GLASS_SCOPE' | 'IMD_PLAYGROUND' | 'MATRIX' | 'MAP' | 'PTT_SIM'"
);

const rockerInsertMarker = '{/* 2. ZONE 2D VISUALIZER BUTTON */}';
const rockerButtonsCode = `{/* 2. GLASS COCKPIT SCOPE BUTTON */}
            <TouchableOpacity 
              activeOpacity={0.8}
              style={[
                styles.rockerBtn, 
                topPanelMode === 'GLASS_SCOPE' ? styles.rockerBtnActiveIndigo : styles.rockerBtnIdle
              ]} 
              onPress={() => setTopPanelMode('GLASS_SCOPE')}
            >
              <View style={styles.rockerTopRow}>
                <View style={[
                  styles.rockerLedDot, 
                  topPanelMode === 'GLASS_SCOPE' ? styles.rockerLedDotIndigoActive : styles.rockerLedDotOff
                ]} />
                <Text style={[
                  styles.rockerStatusText, 
                  topPanelMode === 'GLASS_SCOPE' ? styles.rockerStatusTextIndigo : styles.rockerStatusTextIdle
                ]}>
                  {topPanelMode === 'GLASS_SCOPE' ? 'CRT SCOPE' : 'STANDBY'}
                </Text>
              </View>
              <Text style={[
                styles.rockerTitle, 
                topPanelMode === 'GLASS_SCOPE' ? styles.rockerTitleActive : styles.rockerTitleIdle
              ]}>
                GLASS SCOPE
              </Text>
              <Text style={styles.rockerSubtitle}>
                ROTARY JOG &amp; OBW
              </Text>
            </TouchableOpacity>

            {/* 3. IMD PHYSICS PLAYGROUND BUTTON */}
            <TouchableOpacity 
              activeOpacity={0.8}
              style={[
                styles.rockerBtn, 
                topPanelMode === 'IMD_PLAYGROUND' ? styles.rockerBtnActivePurple : styles.rockerBtnIdle
              ]} 
              onPress={() => setTopPanelMode('IMD_PLAYGROUND')}
            >
              <View style={styles.rockerTopRow}>
                <View style={[
                  styles.rockerLedDot, 
                  topPanelMode === 'IMD_PLAYGROUND' ? styles.rockerLedDotPurpleActive : styles.rockerLedDotOff
                ]} />
                <Text style={[
                  styles.rockerStatusText, 
                  topPanelMode === 'IMD_PLAYGROUND' ? styles.rockerStatusTextPurple : styles.rockerStatusTextIdle
                ]}>
                  {topPanelMode === 'IMD_PLAYGROUND' ? 'PHYSICS LAB' : 'STANDBY'}
                </Text>
              </View>
              <Text style={[
                styles.rockerTitle, 
                topPanelMode === 'IMD_PLAYGROUND' ? styles.rockerTitleActive : styles.rockerTitleIdle
              ]}>
                IMD PLAYGROUND
              </Text>
              <Text style={styles.rockerSubtitle}>
                TOUCH CARRIERS
              </Text>
            </TouchableOpacity>

            `;

const rIdx = mainCode.indexOf(rockerInsertMarker);
if (rIdx !== -1) {
  mainCode = mainCode.substring(0, rIdx) + rockerButtonsCode + mainCode.substring(rIdx);
} else {
  console.error('Rocker insert marker not found!');
  process.exit(1);
}

const viewInsertMarker = '{/* ACTION BUTTONS */}';
const viewRenderCode = `{/* MODE 5: GLASS COCKPIT SPECTRUM SCOPE */}
          {topPanelMode === 'GLASS_SCOPE' && (
            <View style={{ marginTop: 10, borderRadius: 10, overflow: 'hidden' }}>
              <GlassCockpitScope
                initialCenterFreq={parseFloat(centerFreqStr) || centerFreq}
                initialSpan={span}
                carriers={spectrumCarriers.map(c => ({
                  freq: c.freq,
                  label: c.label,
                  type: c.type,
                  powerDbm: c.powerDbm || -18,
                  zoneName: c.zoneName,
                  color: c.type === 'BASE_TX' ? '#c084fc' : c.isKeyed ? '#34d399' : '#38bdf8'
                }))}
                onCenterChange={(newFreq) => setCenterFreqStr(newFreq.toFixed(5))}
                onSpanChange={(newSpan) => setSpan(newSpan)}
              />
            </View>
          )}

          {/* MODE 6: IMD COLLISION PHYSICS PLAYGROUND */}
          {topPanelMode === 'IMD_PLAYGROUND' && (
            <View style={{ marginTop: 10, borderRadius: 10, overflow: 'hidden' }}>
              <ImdPhysicsPlayground
                initialCarriers={
                  spectrumCarriers.length >= 2
                    ? spectrumCarriers.slice(0, 6).map((c, idx) => ({
                        id: 'carrier-' + idx,
                        label: c.label,
                        freq: c.freq,
                        powerDbm: c.powerDbm || (c.type === 'BASE_TX' ? 24 : 14),
                        type: c.type === 'BASE_TX' ? 'BASE_TX' : 'BELTPACK',
                        color: c.type === 'BASE_TX' ? '#c084fc' : '#38bdf8'
                      }))
                    : undefined
                }
                onExportToPlan={(cleanCarriers) => {
                  Alert.alert(
                    'Clean Pocket Transferred',
                    'Transferred ' + cleanCarriers.length + ' clean carriers to current project memory.'
                  );
                }}
              />
            </View>
          )}

          `;

const vIdx = mainCode.indexOf(viewInsertMarker);
if (vIdx !== -1) {
  mainCode = mainCode.substring(0, vIdx) + viewRenderCode + mainCode.substring(vIdx);
} else {
  console.error('View insert marker not found!');
  process.exit(1);
}

fs.writeFileSync('app/index.tsx', mainCode, 'utf8');
fs.writeFileSync('app/index.txt', mainCode, 'utf8');
console.log('Successfully updated app/index.tsx and app/index.txt! Total lines:', mainCode.split('\n').length);
