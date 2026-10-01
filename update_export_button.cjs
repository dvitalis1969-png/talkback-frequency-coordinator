const fs = require('fs');

let code = fs.readFileSync('app/index.tsx', 'utf8');

// 1. In styles, add green/emerald active styles for export button or teal/emerald
const exportStyles = `  rockerBtnActiveTeal: {
    backgroundColor: '#042f2e',
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderTopColor: '#115e59',
    borderLeftColor: '#115e59',
    borderBottomWidth: 2,
    borderRightWidth: 1,
    borderBottomColor: '#14b8a6',
    borderRightColor: '#14b8a6',
    transform: [{ translateY: 2 }],
  },
  rockerLedDotTealActive: {
    backgroundColor: '#14b8a6',
    shadowColor: '#14b8a6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  rockerStatusTextTeal: {
    color: '#2dd4bf',
  },`;

if (!code.includes('rockerBtnActiveTeal:')) {
  code = code.replace(
    '  rockerBtnActiveAmber: {',
    exportStyles + '\n  rockerBtnActiveAmber: {'
  );
}

// 2. Replace the rocker buttons layout and the standalone call sheet toolbar
const oldRockerBarEnd = `            {/* 4. ZONE DISTANCE MATRIX BUTTON */}
            <TouchableOpacity 
              activeOpacity={0.8}
              style={[
                styles.rockerBtn, 
                topPanelMode === 'MATRIX' ? styles.rockerBtnActiveAmber : styles.rockerBtnIdle
              ]} 
              onPress={() => setTopPanelMode('MATRIX')}
            >
              <View style={styles.rockerTopRow}>
                <View style={[
                  styles.rockerLedDot, 
                  topPanelMode === 'MATRIX' ? styles.rockerLedDotAmberActive : styles.rockerLedDotOff
                ]} />
                <Text style={[
                  styles.rockerStatusText, 
                  topPanelMode === 'MATRIX' ? styles.rockerStatusTextAmber : styles.rockerStatusTextIdle
                ]}>
                  {topPanelMode === 'MATRIX' ? 'ACTIVE' : 'STANDBY'}
                </Text>
              </View>
              <Text style={[
                styles.rockerTitle, 
                topPanelMode === 'MATRIX' ? styles.rockerTitleActive : styles.rockerTitleIdle
              ]}>
                MATRIX
              </Text>
              <Text style={styles.rockerSubtitle}>
                {zones.length} ZONES
              </Text>
            </TouchableOpacity>
          </View>

          {/* QUICK TOOLBAR: CREW CALL SHEET & MULTI-ZONE DISPATCH */}
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.callSheetTriggerBtn]}
              onPress={() => setCallSheetModalVisible(true)}
            >
              <Text style={styles.callSheetTriggerBtnText}>📋 OPEN CREW FREQUENCY CALL SHEET &amp; CSV EXPORT</Text>
            </TouchableOpacity>
          </View>`;

const newRockerBarEnd = `            {/* 4. ZONE DISTANCE MATRIX BUTTON */}
            <TouchableOpacity 
              activeOpacity={0.8}
              style={[
                styles.rockerBtn, 
                topPanelMode === 'MATRIX' ? styles.rockerBtnActiveAmber : styles.rockerBtnIdle
              ]} 
              onPress={() => setTopPanelMode('MATRIX')}
            >
              <View style={styles.rockerTopRow}>
                <View style={[
                  styles.rockerLedDot, 
                  topPanelMode === 'MATRIX' ? styles.rockerLedDotAmberActive : styles.rockerLedDotOff
                ]} />
                <Text style={[
                  styles.rockerStatusText, 
                  topPanelMode === 'MATRIX' ? styles.rockerStatusTextAmber : styles.rockerStatusTextIdle
                ]}>
                  {topPanelMode === 'MATRIX' ? 'ACTIVE' : 'STANDBY'}
                </Text>
              </View>
              <Text style={[
                styles.rockerTitle, 
                topPanelMode === 'MATRIX' ? styles.rockerTitleActive : styles.rockerTitleIdle
              ]}>
                MATRIX
              </Text>
              <Text style={styles.rockerSubtitle}>
                {zones.length} ZONES
              </Text>
            </TouchableOpacity>

            {/* 5. EXPORT & CREW CALL SHEET BUTTON */}
            <TouchableOpacity 
              activeOpacity={0.8}
              style={[
                styles.rockerBtn, 
                callSheetModalVisible ? styles.rockerBtnActiveTeal : styles.rockerBtnIdle
              ]} 
              onPress={() => setCallSheetModalVisible(true)}
            >
              <View style={styles.rockerTopRow}>
                <View style={[
                  styles.rockerLedDot, 
                  callSheetModalVisible ? styles.rockerLedDotTealActive : styles.rockerLedDotOff
                ]} />
                <Text style={[
                  styles.rockerStatusText, 
                  callSheetModalVisible ? styles.rockerStatusTextTeal : styles.rockerStatusTextIdle
                ]}>
                  {callSheetModalVisible ? 'OPEN' : 'CALL SHEET'}
                </Text>
              </View>
              <Text style={[
                styles.rockerTitle, 
                callSheetModalVisible ? styles.rockerTitleActive : styles.rockerTitleIdle
              ]}>
                EXPORT
              </Text>
              <Text style={styles.rockerSubtitle}>
                crew frequencies
              </Text>
            </TouchableOpacity>
          </View>`;

if (code.includes(oldRockerBarEnd)) {
  code = code.replace(oldRockerBarEnd, newRockerBarEnd);
  console.log('Successfully replaced matrix & toolbar with uniform 6-button grid');
} else {
  console.error('oldRockerBarEnd not found!');
  process.exit(1);
}

fs.writeFileSync('app/index.tsx', code, 'utf8');
fs.writeFileSync('app/index.txt', code, 'utf8');
console.log('Done! Total lines:', code.split('\n').length);
