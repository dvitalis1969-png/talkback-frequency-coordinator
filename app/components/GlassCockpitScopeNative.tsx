import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Platform,
  PanResponder,
  ScrollView,
  Alert
} from 'react-native';
import Svg, { Line, Rect, Text as SvgText, G, Circle, Path, Polygon } from 'react-native-svg';

export interface ScopeCarrier {
  freq: number;
  label: string;
  type?: 'BASE_TX' | 'PORT_TX' | 'IFB' | 'WALKIE' | 'MIC' | 'IEM';
  powerDbm?: number;
  zoneName?: string;
  color?: string;
}

export interface GlassCockpitScopeProps {
  initialCenterFreq?: number;
  initialSpan?: number;
  carriers?: ScopeCarrier[];
  onCenterChange?: (freq: number) => void;
  onSpanChange?: (span: number) => void;
}

export const GlassCockpitScope: React.FC<GlassCockpitScopeProps> = ({
  initialCenterFreq = 506.0,
  initialSpan = 16.0,
  carriers = [],
  onCenterChange,
  onSpanChange
}) => {
  const [centerFreq, setCenterFreq] = useState<number>(initialCenterFreq);
  const [span, setSpan] = useState<number>(initialSpan);
  const [activeMarker, setActiveMarker] = useState<1 | 2>(1);
  const [marker1Freq, setMarker1Freq] = useState<number>(initialCenterFreq);
  const [marker2Freq, setMarker2Freq] = useState<number>(initialCenterFreq + 1.5);
  
  // Calipers / Occupied Bandwidth Mask
  const [calipersEnabled, setCalipersEnabled] = useState<boolean>(true);
  const [caliperWidthKhz, setCaliperWidthKhz] = useState<number>(200); // 200 kHz standard OBW
  
  // Audio Demod Simulation
  const [audioMuted, setAudioMuted] = useState<boolean>(true);
  const [jogStepKhz, setJogStepKhz] = useState<number>(25); // 12.5, 25, 50, 100 kHz

  const [canvasWidth, setCanvasWidth] = useState<number>(330);
  const CANVAS_HEIGHT = 200;
  const TOP_MARGIN = 20;
  const BOTTOM_MARGIN = 24;
  const PLOT_HEIGHT = CANVAS_HEIGHT - TOP_MARGIN - BOTTOM_MARGIN;
  const NOISE_FLOOR_DBM = -100;
  const REF_LEVEL_DBM = 0;

  useEffect(() => {
    if (initialCenterFreq && Math.abs(initialCenterFreq - centerFreq) > 0.001) {
      setCenterFreq(initialCenterFreq);
    }
  }, [initialCenterFreq]);

  useEffect(() => {
    if (initialSpan && Math.abs(initialSpan - span) > 0.01) {
      setSpan(initialSpan);
    }
  }, [initialSpan]);

  const startFreq = centerFreq - span / 2;
  const stopFreq = centerFreq + span / 2;

  const handleUpdateCenter = (newCenter: number) => {
    const clamped = Math.max(100, Math.min(1000, Number(newCenter.toFixed(5))));
    setCenterFreq(clamped);
    if (onCenterChange) onCenterChange(clamped);
  };

  const handleUpdateSpan = (newSpan: number) => {
    const clamped = Math.max(1, Math.min(120, Number(newSpan.toFixed(2))));
    setSpan(clamped);
    if (onSpanChange) onSpanChange(clamped);
  };

  // Convert Freq to X
  const freqToX = (f: number) => {
    if (span <= 0) return 0;
    return ((f - startFreq) / span) * canvasWidth;
  };

  // Convert dBm to Y
  const dbmToY = (dbm: number) => {
    const clamped = Math.max(NOISE_FLOOR_DBM, Math.min(REF_LEVEL_DBM, dbm));
    const ratio = (clamped - NOISE_FLOOR_DBM) / (REF_LEVEL_DBM - NOISE_FLOOR_DBM);
    return TOP_MARGIN + (1 - ratio) * PLOT_HEIGHT;
  };

  // Touch & Pan Responder on Spectrum Canvas
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const tapX = evt.nativeEvent.locationX;
        const tappedFreq = Math.round((startFreq + (tapX / canvasWidth) * span) * 10000) / 10000;
        if (activeMarker === 1) {
          setMarker1Freq(tappedFreq);
        } else {
          setMarker2Freq(tappedFreq);
        }
      },
      onPanResponderMove: (evt) => {
        const tapX = evt.nativeEvent.locationX;
        const tappedFreq = Math.round((startFreq + (tapX / canvasWidth) * span) * 10000) / 10000;
        if (activeMarker === 1) {
          setMarker1Freq(tappedFreq);
        } else {
          setMarker2Freq(tappedFreq);
        }
      }
    })
  ).current;

  // Next Peak Step
  const handleNextPeak = (direction: 'LEFT' | 'RIGHT') => {
    const currentM = activeMarker === 1 ? marker1Freq : marker2Freq;
    const sorted = [...carriers].filter(c => c.freq >= startFreq && c.freq <= stopFreq).sort((a, b) => a.freq - b.freq);
    if (sorted.length === 0) return;
    let target = null;
    if (direction === 'RIGHT') {
      target = sorted.find(c => c.freq > currentM + 0.05) || sorted[0];
    } else {
      const reversed = [...sorted].reverse();
      target = reversed.find(c => c.freq < currentM - 0.05) || sorted[sorted.length - 1];
    }
    if (target) {
      if (activeMarker === 1) setMarker1Freq(target.freq);
      else setMarker2Freq(target.freq);
    }
  };

  // Jog Wheel Step Center Freq
  const handleJog = (steps: number) => {
    const deltaMhz = (steps * jogStepKhz) / 1000;
    handleUpdateCenter(centerFreq + deltaMhz);
  };

  // Delta calculation
  const deltaKhz = Math.round((marker2Freq - marker1Freq) * 10000) / 10;
  const isCaliperBreached = useMemo(() => {
    if (!calipersEnabled) return false;
    const halfWidthMhz = (caliperWidthKhz / 2) / 1000;
    const activeFreq = activeMarker === 1 ? marker1Freq : marker2Freq;
    const leftLimit = activeFreq - halfWidthMhz;
    const rightLimit = activeFreq + halfWidthMhz;
    // Check if other carriers intrude into this caliper mask
    return carriers.some(c => Math.abs(c.freq - activeFreq) > 0.005 && c.freq >= leftLimit && c.freq <= rightLimit);
  }, [calipersEnabled, caliperWidthKhz, activeMarker, marker1Freq, marker2Freq, carriers]);

  return (
    <View style={scopeStyles.container}>
      {/* Scope Header */}
      <View style={scopeStyles.header}>
        <View style={scopeStyles.headerLeft}>
          <View style={scopeStyles.pulsingDot} />
          <Text style={scopeStyles.title}>GLASS COCKPIT SPECTRUM SCOPE</Text>
        </View>
        <View style={scopeStyles.headerRight}>
          <Text style={scopeStyles.badgeText}>CRT PHOSPHOR</Text>
          <Text style={scopeStyles.badgeText}>OBW MASK</Text>
        </View>
      </View>

      {/* Frequency & Span Status Bar */}
      <View style={scopeStyles.statusBar}>
        <View style={scopeStyles.statItem}>
          <Text style={scopeStyles.statLabel}>CENTER</Text>
          <Text style={scopeStyles.statVal}>{centerFreq.toFixed(5)} MHz</Text>
        </View>
        <View style={scopeStyles.statItem}>
          <Text style={scopeStyles.statLabel}>SPAN</Text>
          <Text style={scopeStyles.statVal}>{span.toFixed(2)} MHz</Text>
        </View>
        <View style={scopeStyles.statItem}>
          <Text style={scopeStyles.statLabel}>M1</Text>
          <Text style={[scopeStyles.statVal, { color: '#38bdf8' }]}>{marker1Freq.toFixed(5)}</Text>
        </View>
        <View style={scopeStyles.statItem}>
          <Text style={scopeStyles.statLabel}>M2</Text>
          <Text style={[scopeStyles.statVal, { color: '#facc15' }]}>{marker2Freq.toFixed(5)}</Text>
        </View>
        <View style={scopeStyles.statItem}>
          <Text style={scopeStyles.statLabel}>DELTA</Text>
          <Text style={[scopeStyles.statVal, { color: deltaKhz >= 0 ? '#4ade80' : '#f87171' }]}>
            {deltaKhz >= 0 ? `+${deltaKhz}` : deltaKhz} kHz
          </Text>
        </View>
      </View>

      {/* SVG Spectrum Screen with Graticule & Calipers */}
      <View
        style={scopeStyles.screenContainer}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 50) setCanvasWidth(w);
        }}
        {...panResponder.panHandlers}
      >
        <Svg width={canvasWidth} height={CANVAS_HEIGHT}>
          {/* Background Grid Lines (10 Horizontal, 8 Vertical) */}
          {Array.from({ length: 9 }).map((_, i) => {
            const x = (canvasWidth / 8) * i;
            return (
              <Line
                key={`grid-x-${i}`}
                x1={x}
                y1={TOP_MARGIN}
                x2={x}
                y2={TOP_MARGIN + PLOT_HEIGHT}
                stroke="rgba(34, 211, 238, 0.15)"
                strokeWidth="1"
                strokeDasharray="2,3"
              />
            );
          })}
          {Array.from({ length: 6 }).map((_, i) => {
            const y = TOP_MARGIN + (PLOT_HEIGHT / 5) * i;
            return (
              <Line
                key={`grid-y-${i}`}
                x1={0}
                y1={y}
                x2={canvasWidth}
                y2={y}
                stroke="rgba(34, 211, 238, 0.15)"
                strokeWidth="1"
                strokeDasharray="2,3"
              />
            );
          })}

          {/* Center Frequency Reticle Marker */}
          <Line
            x1={canvasWidth / 2}
            y1={TOP_MARGIN}
            x2={canvasWidth / 2}
            y2={TOP_MARGIN + PLOT_HEIGHT}
            stroke="rgba(34, 211, 238, 0.4)"
            strokeWidth="1.5"
          />

          {/* Calipers / Occupied Bandwidth Mask Envelope */}
          {calipersEnabled && (() => {
            const activeFreq = activeMarker === 1 ? marker1Freq : marker2Freq;
            const halfMhz = (caliperWidthKhz / 2) / 1000;
            const x1 = Math.max(0, freqToX(activeFreq - halfMhz));
            const x2 = Math.min(canvasWidth, freqToX(activeFreq + halfMhz));
            const maskWidth = Math.max(4, x2 - x1);
            return (
              <G>
                <Rect
                  x={x1}
                  y={TOP_MARGIN}
                  width={maskWidth}
                  height={PLOT_HEIGHT}
                  fill={isCaliperBreached ? 'rgba(239, 68, 68, 0.25)' : 'rgba(56, 189, 248, 0.15)'}
                  stroke={isCaliperBreached ? '#ef4444' : '#38bdf8'}
                  strokeWidth="1"
                  strokeDasharray="3,2"
                />
                <SvgText
                  x={x1 + maskWidth / 2}
                  y={TOP_MARGIN + 12}
                  fill={isCaliperBreached ? '#f87171' : '#38bdf8'}
                  fontSize="9"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {isCaliperBreached ? `BREACH (${caliperWidthKhz}k)` : `OBW ${caliperWidthKhz}k`}
                </SvgText>
              </G>
            );
          })()}

          {/* RF Carriers Traces with Phosphor Skirts */}
          {carriers.map((c, idx) => {
            if (c.freq < startFreq || c.freq > stopFreq) return null;
            const cx = freqToX(c.freq);
            const peakY = dbmToY(c.powerDbm || -18);
            const floorY = TOP_MARGIN + PLOT_HEIGHT;
            const skirtWidth = 14;

            const pathD = `M ${cx - skirtWidth} ${floorY} Q ${cx - 2} ${peakY + 10} ${cx} ${peakY} Q ${cx + 2} ${peakY + 10} ${cx + skirtWidth} ${floorY} Z`;
            const color = c.color || (c.type === 'BASE_TX' ? '#c084fc' : '#38bdf8');

            return (
              <G key={`carrier-trace-${idx}`}>
                <Path d={pathD} fill={`${color}33`} stroke={color} strokeWidth="1.5" />
                <Circle cx={cx} cy={peakY} r={3} fill="#ffffff" stroke={color} strokeWidth="1.5" />
                <SvgText
                  x={cx}
                  y={Math.max(TOP_MARGIN + 9, peakY - 6)}
                  fill={color}
                  fontSize="8"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {c.label || c.freq.toFixed(3)}
                </SvgText>
              </G>
            );
          })}

          {/* Marker 1 (Cyan Triangle & Vertical Hairline) */}
          {marker1Freq >= startFreq && marker1Freq <= stopFreq && (() => {
            const mx = freqToX(marker1Freq);
            return (
              <G>
                <Line x1={mx} y1={TOP_MARGIN} x2={mx} y2={TOP_MARGIN + PLOT_HEIGHT} stroke="#38bdf8" strokeWidth="1" strokeDasharray="4,2" />
                <Polygon points={`${mx - 5},${TOP_MARGIN} ${mx + 5},${TOP_MARGIN} ${mx},${TOP_MARGIN + 8}`} fill="#38bdf8" />
                <SvgText x={mx} y={TOP_MARGIN + 18} fill="#38bdf8" fontSize="8" fontWeight="bold" textAnchor="middle">M1</SvgText>
              </G>
            );
          })()}

          {/* Marker 2 (Yellow Triangle & Vertical Hairline) */}
          {marker2Freq >= startFreq && marker2Freq <= stopFreq && (() => {
            const mx = freqToX(marker2Freq);
            return (
              <G>
                <Line x1={mx} y1={TOP_MARGIN} x2={mx} y2={TOP_MARGIN + PLOT_HEIGHT} stroke="#facc15" strokeWidth="1" strokeDasharray="4,2" />
                <Polygon points={`${mx - 5},${TOP_MARGIN} ${mx + 5},${TOP_MARGIN} ${mx},${TOP_MARGIN + 8}`} fill="#facc15" />
                <SvgText x={mx} y={TOP_MARGIN + 18} fill="#facc15" fontSize="8" fontWeight="bold" textAnchor="middle">M2</SvgText>
              </G>
            );
          })()}
        </Svg>
      </View>

      {/* Tactical Rotary Jog Wheel & Quick Tuning Strip */}
      <View style={scopeStyles.controlsRow}>
        {/* Jog Wheel Steppers */}
        <View style={scopeStyles.jogBox}>
          <Text style={scopeStyles.controlLabel}>ROTARY JOG TUNE ({jogStepKhz} kHz)</Text>
          <View style={scopeStyles.btnGroup}>
            <TouchableOpacity style={scopeStyles.stepBtn} onPress={() => handleJog(-4)}>
              <Text style={scopeStyles.stepBtnText}>&lt;&lt; -100k</Text>
            </TouchableOpacity>
            <TouchableOpacity style={scopeStyles.stepBtn} onPress={() => handleJog(-1)}>
              <Text style={scopeStyles.stepBtnText}>&lt; -{jogStepKhz}k</Text>
            </TouchableOpacity>
            <TouchableOpacity style={scopeStyles.stepBtn} onPress={() => handleJog(1)}>
              <Text style={scopeStyles.stepBtnText}>+{jogStepKhz}k &gt;</Text>
            </TouchableOpacity>
            <TouchableOpacity style={scopeStyles.stepBtn} onPress={() => handleJog(4)}>
              <Text style={scopeStyles.stepBtnText}>+100k &gt;&gt;</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Marker & Caliper Toggles */}
        <View style={scopeStyles.toggleBox}>
          <View style={scopeStyles.btnGroup}>
            <TouchableOpacity
              style={[scopeStyles.toggleBtn, activeMarker === 1 && scopeStyles.toggleBtnActiveCyan]}
              onPress={() => setActiveMarker(1)}
            >
              <Text style={scopeStyles.toggleBtnText}>MARKER 1</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[scopeStyles.toggleBtn, activeMarker === 2 && scopeStyles.toggleBtnActiveYellow]}
              onPress={() => setActiveMarker(2)}
            >
              <Text style={scopeStyles.toggleBtnText}>MARKER 2</Text>
            </TouchableOpacity>
          </View>

          <View style={[scopeStyles.btnGroup, { marginTop: 6 }]}>
            <TouchableOpacity
              style={[scopeStyles.toggleBtn, calipersEnabled && scopeStyles.toggleBtnActiveEmerald]}
              onPress={() => setCalipersEnabled(!calipersEnabled)}
            >
              <Text style={scopeStyles.toggleBtnText}>
                OBW CALIPER: {calipersEnabled ? `${caliperWidthKhz}k` : 'OFF'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={scopeStyles.stepBtn}
              onPress={() => setCaliperWidthKhz(w => (w === 200 ? 100 : w === 100 ? 25 : 200))}
            >
              <Text style={scopeStyles.stepBtnText}>WIDTH</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[scopeStyles.toggleBtn, !audioMuted && scopeStyles.toggleBtnActivePurple]}
              onPress={() => {
                setAudioMuted(!audioMuted);
                Alert.alert(
                  audioMuted ? 'Demod Tone Enabled' : 'Demod Tone Muted',
                  `Listening to carrier at ${(activeMarker === 1 ? marker1Freq : marker2Freq).toFixed(5)} MHz.`
                );
              }}
            >
              <Text style={scopeStyles.toggleBtnText}>{audioMuted ? 'AUDIO MUTE' : 'DEMOD LIVE'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
};

const scopeStyles = StyleSheet.create({
  container: {
    backgroundColor: '#0a0e17',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0284c7',
    overflow: 'hidden',
    marginBottom: 10
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b'
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  pulsingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#22d3ee'
  },
  title: {
    color: '#e2e8f0',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1
  },
  headerRight: {
    flexDirection: 'row',
    gap: 6
  },
  badgeText: {
    color: '#38bdf8',
    fontSize: 8,
    fontWeight: 'bold',
    backgroundColor: '#082f49',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#0284c7'
  },
  statusBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    backgroundColor: '#060a12',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b'
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  statLabel: {
    color: '#64748b',
    fontSize: 8,
    fontWeight: 'bold'
  },
  statVal: {
    color: '#f8fafc',
    fontSize: 9,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  screenContainer: {
    width: '100%',
    height: 200,
    backgroundColor: '#030712'
  },
  controlsRow: {
    padding: 8,
    backgroundColor: '#0f172a',
    borderTopWidth: 1,
    borderTopColor: '#1e293b'
  },
  jogBox: {
    marginBottom: 6
  },
  controlLabel: {
    color: '#94a3b8',
    fontSize: 8,
    fontWeight: 'bold',
    marginBottom: 4,
    letterSpacing: 0.5
  },
  btnGroup: {
    flexDirection: 'row',
    gap: 6
  },
  stepBtn: {
    flex: 1,
    backgroundColor: '#1e293b',
    paddingVertical: 5,
    borderRadius: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155'
  },
  stepBtnText: {
    color: '#cbd5e1',
    fontSize: 9,
    fontWeight: 'bold'
  },
  toggleBox: {},
  toggleBtn: {
    flex: 1,
    backgroundColor: '#1e293b',
    paddingVertical: 5,
    borderRadius: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155'
  },
  toggleBtnActiveCyan: {
    backgroundColor: '#082f49',
    borderColor: '#38bdf8'
  },
  toggleBtnActiveYellow: {
    backgroundColor: '#422006',
    borderColor: '#facc15'
  },
  toggleBtnActiveEmerald: {
    backgroundColor: '#064e3b',
    borderColor: '#34d399'
  },
  toggleBtnActivePurple: {
    backgroundColor: '#3b0764',
    borderColor: '#c084fc'
  },
  toggleBtnText: {
    color: '#f8fafc',
    fontSize: 8.5,
    fontWeight: 'bold'
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#0284c7',
    paddingVertical: 5,
    borderRadius: 4,
    alignItems: 'center'
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 8.5,
    fontWeight: '900'
  }
});
