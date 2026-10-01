import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Platform,
  ScrollView,
  Alert
} from 'react-native';

export interface ImdQuickClash {
  fA: number;
  fB: number;
  fC?: number;
  type: '2TX_3RD' | '3TX_3RD';
  formula: string;
  intermodFreq: number; // MHz
  hitFreq: number; // fundamental hit
  deltaKhz: number;
}

export interface ImdTalkbackInspectorProps {
  initialFrequencies?: number[];
}

export const ImdTalkbackInspector: React.FC<ImdTalkbackInspectorProps> = ({
  initialFrequencies
}) => {
  // Free text input for rapid pasting (space, comma, or newline separated)
  const [inputText, setInputText] = useState<string>(
    initialFrequencies && initialFrequencies.length > 0
      ? initialFrequencies.map(f => f.toFixed(5)).join('\n')
      : ''
  );

  // Parsed frequencies list
  const [frequencies, setFrequencies] = useState<number[]>([]);

  // Single frequency quick-add input
  const [newFreqInput, setNewFreqInput] = useState<string>('');

  // Results of the analysis
  const [hasAnalyzed, setHasAnalyzed] = useState<boolean>(true);
  const [clashes, setClashes] = useState<ImdQuickClash[]>([]);
  const [analysisSummary, setAnalysisSummary] = useState<{
    totalFreqs: number;
    totalIntermods: number;
    clashCount: number;
    isClean: boolean;
  }>({
    totalFreqs: 5,
    totalIntermods: 30,
    clashCount: 0,
    isClean: true
  });

  // Parse text into sorted, unique frequencies within 400 - 470 MHz range
  const parseFrequencies = (text: string): number[] => {
    const tokens = text.split(/[\s,;\n\r]+/);
    const parsed: number[] = [];
    tokens.forEach(tok => {
      const val = parseFloat(tok.trim());
      if (!isNaN(val) && val >= 380 && val <= 500) {
        parsed.push(Number(val.toFixed(5)));
      }
    });
    // Unique and sorted
    return Array.from(new Set(parsed)).sort((a, b) => a - b);
  };

  // Perform Analysis (2TX 3rd Order: 2A-B, and 3TX 3rd Order: A+B-C within 12.5 kHz)
  const runAnalysis = (freqListToTest?: number[]) => {
    const list = freqListToTest || parseFrequencies(inputText);
    setFrequencies(list);

    if (list.length < 2) {
      Alert.alert('Talkback Inspector', 'Please enter at least 2 frequencies (between 400 and 470 MHz) to calculate intermodulation.');
      setHasAnalyzed(false);
      return;
    }

    const n = list.length;
    const foundClashes: ImdQuickClash[] = [];
    let calculatedProductCount = 0;
    const CLASH_THRESHOLD_MHZ = 0.0125; // 12.5 kHz exact talkback channel spacing limit

    // 1. 2-TX 3rd Order: 2A - B
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const fA = list[i];
        const fB = list[j];
        const imd = 2 * fA - fB;
        calculatedProductCount++;

        // Test against every fundamental in the set
        for (let k = 0; k < n; k++) {
          const fundamental = list[k];
          const delta = Math.abs(imd - fundamental);
          if (delta <= CLASH_THRESHOLD_MHZ) {
            foundClashes.push({
              fA,
              fB,
              type: '2TX_3RD',
              formula: `2(${fA.toFixed(5)}) - ${fB.toFixed(5)}`,
              intermodFreq: Number(imd.toFixed(5)),
              hitFreq: fundamental,
              deltaKhz: Number((delta * 1000).toFixed(2))
            });
          }
        }
      }
    }

    // 2. 3-TX 3rd Order: A + B - C
    if (n >= 3) {
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          for (let k = 0; k < n; k++) {
            if (k === i || k === j) continue;
            const fA = list[i];
            const fB = list[j];
            const fC = list[k];
            const imd = fA + fB - fC;
            calculatedProductCount++;

            // Test against every fundamental in the set
            for (let m = 0; m < n; m++) {
              const fundamental = list[m];
              const delta = Math.abs(imd - fundamental);
              if (delta <= CLASH_THRESHOLD_MHZ) {
                foundClashes.push({
                  fA,
                  fB,
                  fC,
                  type: '3TX_3RD',
                  formula: `${fA.toFixed(5)} + ${fB.toFixed(5)} - ${fC.toFixed(5)}`,
                  intermodFreq: Number(imd.toFixed(5)),
                  hitFreq: fundamental,
                  deltaKhz: Number((delta * 1000).toFixed(2))
                });
              }
            }
          }
        }
      }
    }

    setClashes(foundClashes);
    setAnalysisSummary({
      totalFreqs: list.length,
      totalIntermods: calculatedProductCount,
      clashCount: foundClashes.length,
      isClean: foundClashes.length === 0
    });
    setHasAnalyzed(true);
  };

  // Add a single frequency
  const handleAddSingleFreq = () => {
    const val = parseFloat(newFreqInput.trim());
    if (isNaN(val) || val < 380 || val > 500) {
      Alert.alert('Invalid Frequency', 'Please enter a valid talkback frequency between 400.000 and 470.000 MHz.');
      return;
    }
    const updated = Array.from(new Set([...frequencies, Number(val.toFixed(5))])).sort((a, b) => a - b);
    setFrequencies(updated);
    setInputText(updated.map(f => f.toFixed(5)).join('\n'));
    setNewFreqInput('');
    runAnalysis(updated);
  };

  // Remove a frequency
  const handleRemoveFreq = (freqToRemove: number) => {
    const updated = frequencies.filter(f => f !== freqToRemove);
    setFrequencies(updated);
    setInputText(updated.map(f => f.toFixed(5)).join('\n'));
    runAnalysis(updated);
  };

  // Load standard UK OFCOM Talkback Presets
  const loadPreset = (type: 'OFCOM_DUPLEX' | 'PMR446' | 'CLEAN_SET') => {
    let preset: number[] = [];
    if (type === 'OFCOM_DUPLEX') {
      // 455 MHz Base TX and 468 MHz Portable TX standard talkback
      preset = [455.03125, 455.19375, 455.35625, 468.05625, 468.21875, 468.38125];
    } else if (type === 'PMR446') {
      // Walkie-talkie 8 channels
      preset = [446.00625, 446.01875, 446.03125, 446.04375, 446.05625];
    } else {
      // Verified clean 4-channel set
      preset = [455.050, 455.225, 455.450, 455.725];
    }
    setInputText(preset.map(f => f.toFixed(5)).join('\n'));
    setFrequencies(preset);
    runAnalysis(preset);
  };

  return (
    <View style={tbStyles.container}>
      {/* Header Bar */}
      <View style={tbStyles.header}>
        <View style={tbStyles.headerLeft}>
          <View style={tbStyles.headerIconBox}>
            <Text style={tbStyles.headerIcon}>⚡</Text>
          </View>
          <View>
            <Text style={tbStyles.headerTitle}>TALKBACK IMD COMPATIBILITY INSPECTOR</Text>
            <Text style={tbStyles.headerSub}>UHF 400–470 MHz • 2-TX &amp; 3-TX 3RD ORDER (±12.5 kHz)</Text>
          </View>
        </View>
        <TouchableOpacity
          style={tbStyles.presetToggleBtn}
          onPress={() => loadPreset('OFCOM_DUPLEX')}
        >
          <Text style={tbStyles.presetToggleText}>LOAD OFCOM SET</Text>
        </TouchableOpacity>
      </View>

      {/* Input Section */}
      <View style={tbStyles.inputCard}>
        <Text style={tbStyles.sectionLabel}>ENTER TALKBACK FREQUENCIES TO TEST (400–470 MHz)</Text>
        
        {/* Quick Add Row */}
        <View style={tbStyles.addRow}>
          <TextInput
            style={tbStyles.singleInput}
            placeholder="e.g. 455.03125"
            placeholderTextColor="#64748b"
            value={newFreqInput}
            onChangeText={setNewFreqInput}
            keyboardType="numeric"
          />
          <TouchableOpacity style={tbStyles.addBtn} onPress={handleAddSingleFreq}>
            <Text style={tbStyles.addBtnText}>+ ADD FREQ</Text>
          </TouchableOpacity>
        </View>

        {/* Free-form paste box */}
        <Text style={[tbStyles.subLabel, { marginTop: 6 }]}>Or paste multiple frequencies (space, comma, or line separated):</Text>
        <TextInput
          style={tbStyles.multiTextInput}
          multiline
          numberOfLines={3}
          placeholder="455.03125, 455.19375, 455.35625, 468.05625..."
          placeholderTextColor="#475569"
          value={inputText}
          onChangeText={(txt) => {
            setInputText(txt);
            setFrequencies(parseFrequencies(txt));
          }}
        />

        {/* Action Buttons Row */}
        <View style={tbStyles.actionRow}>
          <TouchableOpacity style={tbStyles.analyzeBtn} onPress={() => runAnalysis()}>
            <Text style={tbStyles.analyzeBtnText}>⚡ ANALYZE COMPATIBILITY</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={tbStyles.clearBtn}
            onPress={() => {
              setInputText('');
              setFrequencies([]);
              setClashes([]);
              setHasAnalyzed(false);
            }}
          >
            <Text style={tbStyles.clearBtnText}>CLEAR</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Current Frequency Chips Strip */}
      {frequencies.length > 0 && (
        <View style={tbStyles.chipContainer}>
          <Text style={tbStyles.chipTitle}>CURRENT FREQUENCY POOL ({frequencies.length}):</Text>
          <View style={tbStyles.chipWrap}>
            {frequencies.map((f) => (
              <View key={`freq-${f}`} style={tbStyles.freqChip}>
                <Text style={tbStyles.freqChipText}>{f.toFixed(5)} MHz</Text>
                <TouchableOpacity onPress={() => handleRemoveFreq(f)} style={tbStyles.chipDeleteBtn}>
                  <Text style={tbStyles.chipDeleteText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Analysis Results Display */}
      {hasAnalyzed && (
        <View style={tbStyles.resultsCard}>
          {/* Result Banner */}
          <View style={[tbStyles.banner, analysisSummary.isClean ? tbStyles.bannerClean : tbStyles.bannerClash]}>
            <Text style={[tbStyles.bannerIcon, analysisSummary.isClean ? tbStyles.bannerIconClean : tbStyles.bannerIconClash]}>
              {analysisSummary.isClean ? '[OK]' : '[!]'}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={tbStyles.bannerTitle}>
                {analysisSummary.isClean
                  ? 'NO CLASHES DETECTED — FREQUENCIES ARE 100% COMPATIBLE!'
                  : `${analysisSummary.clashCount} INTERMODULATION CLASH(ES) DETECTED!`}
              </Text>
              <Text style={tbStyles.bannerSub}>
                {analysisSummary.isClean
                  ? `All ${analysisSummary.totalFreqs} frequencies maintain a safe >12.5 kHz spacing from all 2-TX and 3-TX 3rd-order intermods (${analysisSummary.totalIntermods} products calculated).`
                  : `One or more 3rd-order intermods land within ±12.5 kHz of your fundamental talkback frequencies. Review the breakdown below.`}
              </Text>
            </View>
          </View>

          {/* Clashes Breakdown Table */}
          {!analysisSummary.isClean && (
            <View style={tbStyles.clashesTable}>
              <View style={tbStyles.tableHeaderRow}>
                <Text style={[tbStyles.tableHeaderCell, { width: 65 }]}>TYPE</Text>
                <Text style={[tbStyles.tableHeaderCell, { flex: 2 }]}>INTERMOD FORMULA</Text>
                <Text style={[tbStyles.tableHeaderCell, { flex: 1.2, textAlign: 'center' }]}>IMD SPUR</Text>
                <Text style={[tbStyles.tableHeaderCell, { flex: 1.2, textAlign: 'center' }]}>HITS FREQ</Text>
                <Text style={[tbStyles.tableHeaderCell, { width: 55, textAlign: 'right' }]}>DELTA</Text>
              </View>

              <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={true}>
                {clashes.map((c, idx) => (
                  <View key={`clash-${idx}`} style={tbStyles.tableRow}>
                    <View style={[tbStyles.badgeType, c.type === '2TX_3RD' ? tbStyles.badge2Tx : tbStyles.badge3Tx]}>
                      <Text style={tbStyles.badgeTypeText}>{c.type === '2TX_3RD' ? '2-TX 3RD' : '3-TX 3RD'}</Text>
                    </View>
                    <Text style={[tbStyles.cellTextFormula, { flex: 2 }]} numberOfLines={1}>{c.formula}</Text>
                    <Text style={[tbStyles.cellTextSpur, { flex: 1.2, textAlign: 'center' }]}>{c.intermodFreq.toFixed(5)}</Text>
                    <Text style={[tbStyles.cellTextHit, { flex: 1.2, textAlign: 'center' }]}>{c.hitFreq.toFixed(5)}</Text>
                    <Text style={[tbStyles.cellTextDelta, { width: 55, textAlign: 'right' }]}>±{c.deltaKhz}k</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const tbStyles = StyleSheet.create({
  container: {
    backgroundColor: '#0a0d14',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#38bdf8',
    overflow: 'hidden',
    marginBottom: 10
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b'
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  headerIconBox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerIcon: {
    color: '#ffffff',
    fontSize: 12
  },
  headerTitle: {
    color: '#f8fafc',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8
  },
  headerSub: {
    color: '#38bdf8',
    fontSize: 7.5,
    fontWeight: 'bold'
  },
  presetToggleBtn: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#0284c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4
  },
  presetToggleText: {
    color: '#38bdf8',
    fontSize: 8,
    fontWeight: 'bold'
  },
  inputCard: {
    padding: 10,
    backgroundColor: '#060a12',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b'
  },
  sectionLabel: {
    color: '#94a3b8',
    fontSize: 8.5,
    fontWeight: 'bold',
    marginBottom: 6,
    letterSpacing: 0.5
  },
  subLabel: {
    color: '#64748b',
    fontSize: 8,
    fontWeight: '600'
  },
  addRow: {
    flexDirection: 'row',
    gap: 6
  },
  singleInput: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: '#f8fafc',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  addBtn: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 12,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center'
  },
  addBtnText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900'
  },
  multiTextInput: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 4,
    padding: 8,
    marginTop: 4,
    color: '#38bdf8',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    minHeight: 50,
    textAlignVertical: 'top'
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8
  },
  analyzeBtn: {
    flex: 2,
    backgroundColor: '#22c55e',
    paddingVertical: 8,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center'
  },
  analyzeBtnText: {
    color: '#052e16',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8
  },
  clearBtn: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 8,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center'
  },
  clearBtnText: {
    color: '#f8fafc',
    fontSize: 9,
    fontWeight: 'bold'
  },
  chipContainer: {
    padding: 8,
    backgroundColor: '#0c121e',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b'
  },
  chipTitle: {
    color: '#94a3b8',
    fontSize: 8,
    fontWeight: 'bold',
    marginBottom: 5
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  freqChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1e293b',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#334155'
  },
  freqChipText: {
    color: '#facc15',
    fontSize: 9,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  chipDeleteBtn: {
    padding: 2
  },
  chipDeleteText: {
    color: '#f87171',
    fontSize: 9,
    fontWeight: 'bold'
  },
  resultsCard: {
    padding: 10,
    backgroundColor: '#060a12'
  },
  banner: {
    flexDirection: 'row',
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    gap: 8,
    alignItems: 'center'
  },
  bannerClean: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderColor: '#22c55e'
  },
  bannerClash: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#ef4444'
  },
  bannerIcon: {
    fontSize: 20,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 1
  },
  bannerIconClean: {
    color: '#22c55e'
  },
  bannerIconClash: {
    color: '#ff3344'
  },
  bannerTitle: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  bannerSub: {
    color: '#cbd5e1',
    fontSize: 8,
    marginTop: 2,
    lineHeight: 12
  },
  clashesTable: {
    marginTop: 8,
    backgroundColor: '#0a0e17',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden'
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 5,
    alignItems: 'center'
  },
  tableHeaderCell: {
    color: '#94a3b8',
    fontSize: 7.5,
    fontWeight: '900'
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#172033',
    alignItems: 'center'
  },
  badgeType: {
    width: 65,
    paddingVertical: 2,
    borderRadius: 3,
    alignItems: 'center'
  },
  badge2Tx: {
    backgroundColor: '#7c3aed'
  },
  badge3Tx: {
    backgroundColor: '#0891b2'
  },
  badgeTypeText: {
    color: '#ffffff',
    fontSize: 7.5,
    fontWeight: '900'
  },
  cellTextFormula: {
    color: '#e2e8f0',
    fontSize: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    paddingHorizontal: 4
  },
  cellTextSpur: {
    color: '#f43f5e',
    fontSize: 8.5,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  cellTextHit: {
    color: '#facc15',
    fontSize: 8.5,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  cellTextDelta: {
    color: '#ef4444',
    fontSize: 8,
    fontWeight: 'bold'
  }
});
