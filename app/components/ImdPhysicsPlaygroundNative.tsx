import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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

export interface PlaygroundCarrier {
  id: string;
  label: string;
  freq: number; // MHz
  powerDbm: number;
  type: 'BASE_TX' | 'BELTPACK' | 'MIC' | 'IEM';
  color: string;
  isKeyed?: boolean;
}

export interface ImdProduct {
  freq: number;
  order: 3 | 5;
  toneType: '2-Tone' | '3-Tone';
  formula: string;
  sourceIds: string[];
  amplitude: number; // relative dB
}

export interface ImdPhysicsPlaygroundProps {
  initialCarriers?: PlaygroundCarrier[];
  onExportToPlan?: (carriers: PlaygroundCarrier[]) => void;
}

const PRESET_CARRIERS: Record<string, PlaygroundCarrier[]> = {
  TRAP_3TX: [
    { id: 'tx-1', label: 'TX 1 (Base)', freq: 500.000, powerDbm: 20, type: 'BASE_TX', color: '#38bdf8' },
    { id: 'tx-2', label: 'TX 2 (Base)', freq: 505.000, powerDbm: 20, type: 'BASE_TX', color: '#c084fc' },
    { id: 'tx-3', label: 'TX 3 (Mic)', freq: 510.000, powerDbm: 14, type: 'MIC', color: '#fb923c' },
  ],
  TALKBACK_DUPLEX: [
    { id: 'tb-base', label: 'BASE TX (PL 1)', freq: 455.031, powerDbm: 24, type: 'BASE_TX', color: '#c084fc' },
    { id: 'tb-pack', label: 'PACK TX (PL 1)', freq: 468.056, powerDbm: 14, type: 'BELTPACK', color: '#22d3ee' },
    { id: 'tb-base2', label: 'BASE TX (PL 2)', freq: 455.193, powerDbm: 24, type: 'BASE_TX', color: '#a855f7' },
    { id: 'host-mic', label: 'HOST MIC', freq: 468.018, powerDbm: 14, type: 'MIC', color: '#f43f5e' },
  ],
  DENSE_4TX: [
    { id: 'c-1', label: 'DIR BASE', freq: 457.256, powerDbm: 20, type: 'BASE_TX', color: '#38bdf8' },
    { id: 'c-2', label: 'SM BASE', freq: 457.306, powerDbm: 20, type: 'BASE_TX', color: '#34d399' },
    { id: 'c-3', label: 'LX BASE', freq: 457.381, powerDbm: 20, type: 'BASE_TX', color: '#fbbf24' },
    { id: 'c-4', label: 'A1 BASE', freq: 457.431, powerDbm: 20, type: 'BASE_TX', color: '#f43f5e' },
  ]
};

export const ImdPhysicsPlayground: React.FC<ImdPhysicsPlaygroundProps> = ({
  initialCarriers,
  onExportToPlan
}) => {
  const [carriers, setCarriers] = useState<PlaygroundCarrier[]>(() => {
    return initialCarriers && initialCarriers.length > 0 ? initialCarriers : PRESET_CARRIERS.TRAP_3TX;
  });

  const [magneticSnap, setMagneticSnap] = useState<boolean>(true);
  const [show5thOrder, setShow5thOrder] = useState<boolean>(false);
  const [safetyMarginKhz, setSafetyMarginKhz] = useState<number>(50); // 25, 50, 100 kHz
  const [activeCarrierId, setActiveCarrierId] = useState<string | null>(null);

  const [canvasWidth, setCanvasWidth] = useState<number>(330);
  const CANVAS_HEIGHT = 180;
  const TOP_MARGIN = 20;
  const BOTTOM_MARGIN = 20;
  const PLOT_HEIGHT = CANVAS_HEIGHT - TOP_MARGIN - BOTTOM_MARGIN;

  // Calculate Ruler Bounds based on carriers
  const freqs = carriers.map(c => c.freq);
  const low = freqs.length > 0 ? Math.min(...freqs) : 490.0;
  const high = freqs.length > 0 ? Math.max(...freqs) : 520.0;
  const padding = Math.max(3.0, (high - low) * 0.35);
  const minFreq = Number((low - padding).toFixed(2));
  const maxFreq = Number((high + padding).toFixed(2));
  const span = Math.max(1, maxFreq - minFreq);

  const freqToX = (f: number) => {
    return Math.max(0, Math.min(canvasWidth, ((f - minFreq) / span) * canvasWidth));
  };

  const xToFreq = (x: number) => {
    return Number((minFreq + (x / canvasWidth) * span).toFixed(5));
  };

  // Real-Time Intermodulation Calculation (2-Tone 3rd, 3-Tone 3rd, 5th Order)
  const imdProducts = useMemo<ImdProduct[]>(() => {
    const list: ImdProduct[] = [];
    const n = carriers.length;
    if (n < 2) return list;

    // 1. 2-Tone 3rd Order: 2A - B, 2B - A
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const A = carriers[i];
        const B = carriers[j];
        const val = 2 * A.freq - B.freq;
        const isContinuous = A.type === 'BASE_TX' && B.type === 'BASE_TX';
        const amp = isContinuous ? -15 : -28;

        list.push({
          freq: Number(val.toFixed(5)),
          order: 3,
          toneType: '2-Tone',
          formula: `2(${A.label}) - ${B.label}`,
          sourceIds: [A.id, B.id],
          amplitude: amp
        });

        // 5th Order: 3A - 2B
        if (show5thOrder) {
          const val5 = 3 * A.freq - 2 * B.freq;
          list.push({
            freq: Number(val5.toFixed(5)),
            order: 5,
            toneType: '2-Tone',
            formula: `3(${A.label}) - 2(${B.label})`,
            sourceIds: [A.id, B.id],
            amplitude: amp - 15
          });
        }
      }
    }

    // 2. 3-Tone 3rd Order: A + B - C
    if (n >= 3) {
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          for (let k = 0; k < n; k++) {
            if (k === i || k === j) continue;
            const A = carriers[i];
            const B = carriers[j];
            const C = carriers[k];
            const val = A.freq + B.freq - C.freq;
            const baseCount = (A.type === 'BASE_TX' ? 1 : 0) + (B.type === 'BASE_TX' ? 1 : 0) + (C.type === 'BASE_TX' ? 1 : 0);
            const amp = baseCount >= 2 ? -18 : -32;

            list.push({
              freq: Number(val.toFixed(5)),
              order: 3,
              toneType: '3-Tone',
              formula: `${A.label} + ${B.label} - ${C.label}`,
              sourceIds: [A.id, B.id, C.id],
              amplitude: amp
            });
          }
        }
      }
    }
    return list;
  }, [carriers, show5thOrder]);

  // Collision Detection
  const collisionReport = useMemo(() => {
    const hits: {
      carrierId: string;
      carrierLabel: string;
      carrierFreq: number;
      product: ImdProduct;
      deltaKhz: number;
      severity: 'DIRECT_HIT' | 'NEAR_MISS';
    }[] = [];

    const safetyMarginMhz = safetyMarginKhz / 1000;
    const directHitThresholdMhz = 0.025; // 25 kHz

    for (const c of carriers) {
      for (const p of imdProducts) {
        if (p.sourceIds.includes(c.id) && p.sourceIds.length === 1) continue;

        const delta = Math.abs(c.freq - p.freq);
        if (delta <= safetyMarginMhz) {
          hits.push({
            carrierId: c.id,
            carrierLabel: c.label,
            carrierFreq: c.freq,
            product: p,
            deltaKhz: Number((delta * 1000).toFixed(1)),
            severity: delta <= directHitThresholdMhz ? 'DIRECT_HIT' : 'NEAR_MISS'
          });
        }
      }
    }

    const directCount = hits.filter(h => h.severity === 'DIRECT_HIT').length;
    const nearCount = hits.filter(h => h.severity === 'NEAR_MISS').length;
    const clashingCarrierIds = new Set(hits.map(h => h.carrierId));

    return { hits, directCount, nearCount, clashingCarrierIds };
  }, [carriers, imdProducts, safetyMarginKhz]);

  // Magnetic Clean-Pocket Finder
  const findCleanPocket = (targetFreq: number, carrierId: string) => {
    const searchWindow = 1.2;
    const step = 0.025;
    for (let offset = 0; offset <= searchWindow; offset += step) {
      for (const dir of [0, 1, -1]) {
        if (offset === 0 && dir !== 0) continue;
        if (offset > 0 && dir === 0) continue;
        const testFreq = Number((targetFreq + offset * dir).toFixed(5));
        if (testFreq < minFreq || testFreq > maxFreq) continue;

        const carrierConflict = carriers.some(c => c.id !== carrierId && Math.abs(c.freq - testFreq) < 0.25);
        if (carrierConflict) continue;

        let isClean = true;
        for (const p of imdProducts) {
          if (!p.sourceIds.includes(carrierId)) {
            if (Math.abs(p.freq - testFreq) < 0.08) {
              isClean = false;
              break;
            }
          }
        }
        if (isClean) return testFreq;
      }
    }
    return targetFreq;
  };

  // Dragging Carrier Responder
  const activeCarrierIdRef = useRef<string | null>(null);
  activeCarrierIdRef.current = activeCarrierId;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const tapX = evt.nativeEvent.locationX;
        const tapFreq = xToFreq(tapX);
        // Find closest carrier
        let closest: PlaygroundCarrier | null = null;
        let minDist = 999;
        carriers.forEach(c => {
          const dist = Math.abs(c.freq - tapFreq);
          if (dist < minDist) {
            minDist = dist;
            closest = c;
          }
        });
        if (closest && minDist < span * 0.15) {
          setActiveCarrierId((closest as PlaygroundCarrier).id);
        }
      },
      onPanResponderMove: (evt) => {
        const curId = activeCarrierIdRef.current;
        if (!curId) return;
        const tapX = Math.max(10, Math.min(canvasWidth - 10, evt.nativeEvent.locationX));
        let newFreq = xToFreq(tapX);

        if (magneticSnap) {
          newFreq = findCleanPocket(newFreq, curId);
        }

        setCarriers(prev =>
          prev.map(c => (c.id === curId ? { ...c, freq: Number(newFreq.toFixed(5)) } : c))
        );
      },
      onPanResponderRelease: () => {
        // Keep active selection
      }
    })
  ).current;

  // Nudge Carrier Frequency
  const nudgeCarrier = (id: string, deltaMhz: number) => {
    setCarriers(prev =>
      prev.map(c => {
        if (c.id !== id) return c;
        let newFreq = Number((c.freq + deltaMhz).toFixed(5));
        if (magneticSnap) {
          newFreq = findCleanPocket(newFreq, id);
        }
        return { ...c, freq: newFreq };
      })
    );
  };

  return (
    <View style={imdStyles.container}>
      {/* Header Bar */}
      <View style={imdStyles.header}>
        <View style={imdStyles.headerLeft}>
          <Text style={imdStyles.headerTitle}>IMD COLLISION PHYSICS PLAYGROUND</Text>
          <Text style={imdStyles.headerSub}>DRAG CARRIERS &amp; WATCH LIVE INTERMOD SPURS</Text>
        </View>
        <View style={imdStyles.headerRight}>
          <TouchableOpacity
            style={[imdStyles.scoreBadge, collisionReport.directCount > 0 ? imdStyles.scoreBadgeClash : imdStyles.scoreBadgeClean]}
          >
            <Text style={imdStyles.scoreBadgeText}>
              {collisionReport.directCount > 0 ? `${collisionReport.directCount} DIRECT CLASHES!` : '0 CLASHES (CLEAN)'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Physics Toggles & Presets Strip */}
      <View style={imdStyles.toolbar}>
        <View style={imdStyles.btnGroup}>
          <TouchableOpacity
            style={[imdStyles.toggleBtn, magneticSnap && imdStyles.toggleBtnEmerald]}
            onPress={() => setMagneticSnap(!magneticSnap)}
          >
            <Text style={imdStyles.toggleBtnText}>MAGNETIC SNAP: {magneticSnap ? 'ON' : 'OFF'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[imdStyles.toggleBtn, show5thOrder && imdStyles.toggleBtnAmber]}
            onPress={() => setShow5thOrder(!show5thOrder)}
          >
            <Text style={imdStyles.toggleBtnText}>5TH ORDER: {show5thOrder ? 'ON' : 'OFF'}</Text>
          </TouchableOpacity>
        </View>

        {/* Presets Button Row */}
        <View style={[imdStyles.btnGroup, { marginTop: 4 }]}>
          <TouchableOpacity
            style={imdStyles.presetBtn}
            onPress={() => setCarriers(PRESET_CARRIERS.TRAP_3TX)}
          >
            <Text style={imdStyles.presetBtnText}>PRESET: 3TX TRAP</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={imdStyles.presetBtn}
            onPress={() => setCarriers(PRESET_CARRIERS.TALKBACK_DUPLEX)}
          >
            <Text style={imdStyles.presetBtnText}>PRESET: DUPLEX TB</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={imdStyles.presetBtn}
            onPress={() => setCarriers(PRESET_CARRIERS.DENSE_4TX)}
          >
            <Text style={imdStyles.presetBtnText}>PRESET: DENSE 4TX</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* The Interactive Spectrum Stage */}
      <View
        style={imdStyles.stageContainer}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 50) setCanvasWidth(w);
        }}
        {...panResponder.panHandlers}
      >
        <Svg width={canvasWidth} height={CANVAS_HEIGHT}>
          {/* Graticule Background */}
          {Array.from({ length: 9 }).map((_, i) => {
            const x = (canvasWidth / 8) * i;
            return (
              <Line
                key={`imd-grid-${i}`}
                x1={x}
                y1={TOP_MARGIN}
                x2={x}
                y2={TOP_MARGIN + PLOT_HEIGHT}
                stroke="rgba(168, 85, 247, 0.15)"
                strokeWidth="1"
                strokeDasharray="2,3"
              />
            );
          })}

          {/* Clash Red Shading Zones */}
          {collisionReport.hits.map((hit, idx) => {
            const cx = freqToX(hit.carrierFreq);
            return (
              <Rect
                key={`clash-zone-${idx}`}
                x={cx - 10}
                y={TOP_MARGIN}
                width={20}
                height={PLOT_HEIGHT}
                fill="rgba(239, 68, 68, 0.25)"
              />
            );
          })}

          {/* IMD Intermodulation Spur Spikes */}
          {imdProducts.map((p, idx) => {
            if (p.freq < minFreq || p.freq > maxFreq) return null;
            const px = freqToX(p.freq);
            const is2Tone = p.toneType === '2-Tone';
            const color = is2Tone ? '#c084fc' : '#22d3ee';
            const spikeHeight = is2Tone ? 40 : 25;
            const groundY = TOP_MARGIN + PLOT_HEIGHT;

            return (
              <G key={`imd-spur-${idx}`}>
                <Line
                  x1={px}
                  y1={groundY}
                  x2={px}
                  y2={groundY - spikeHeight}
                  stroke={color}
                  strokeWidth="1.2"
                  strokeDasharray="2,1"
                />
                <Circle cx={px} cy={groundY - spikeHeight} r={2} fill={color} />
              </G>
            );
          })}

          {/* Physical Draggable Carrier Peaks */}
          {carriers.map((c) => {
            if (c.freq < minFreq || c.freq > maxFreq) return null;
            const cx = freqToX(c.freq);
            const groundY = TOP_MARGIN + PLOT_HEIGHT;
            const peakY = groundY - 70;
            const isSelected = activeCarrierId === c.id;
            const isClashing = collisionReport.clashingCarrierIds.has(c.id);
            const color = isClashing ? '#ef4444' : isSelected ? '#38bdf8' : c.color || '#a855f7';

            return (
              <G key={`carrier-node-${c.id}`}>
                {/* Triangular RF Mast */}
                <Polygon
                  points={`${cx - 10},${groundY} ${cx + 10},${groundY} ${cx},${peakY}`}
                  fill={`${color}33`}
                  stroke={color}
                  strokeWidth={isSelected ? '2' : '1.2'}
                />
                <Circle cx={cx} cy={peakY} r={isSelected ? 5 : 3.5} fill="#ffffff" stroke={color} strokeWidth="2" />
                <SvgText
                  x={cx}
                  y={Math.max(TOP_MARGIN + 9, peakY - 8)}
                  fill={color}
                  fontSize="9"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {c.label} ({c.freq.toFixed(3)})
                </SvgText>
              </G>
            );
          })}
        </Svg>
      </View>

      {/* Selected Carrier Tuning Strip */}
      <View style={imdStyles.bottomTuner}>
        <Text style={imdStyles.tunerLabel}>CARRIER FREQUENCY FINE NUDGE (TAP TO SELECT &amp; TUNE)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={imdStyles.carrierChipRow}>
          {carriers.map(c => {
            const isSel = activeCarrierId === c.id;
            const isClash = collisionReport.clashingCarrierIds.has(c.id);
            return (
              <View
                key={`chip-${c.id}`}
                style={[
                  imdStyles.carrierChip,
                  isSel && imdStyles.carrierChipSelected,
                  isClash && imdStyles.carrierChipClash
                ]}
              >
                <TouchableOpacity onPress={() => setActiveCarrierId(c.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={imdStyles.chipLabel}>{c.label}:</Text>
                  <Text style={imdStyles.chipFreq}>{c.freq.toFixed(5)}</Text>
                </TouchableOpacity>
                <View style={imdStyles.chipBtnGroup}>
                  <TouchableOpacity style={imdStyles.miniBtn} onPress={() => nudgeCarrier(c.id, -0.025)}>
                    <Text style={imdStyles.miniBtnText}>-25k</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={imdStyles.miniBtn} onPress={() => nudgeCarrier(c.id, 0.025)}>
                    <Text style={imdStyles.miniBtnText}>+25k</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
};

const imdStyles = StyleSheet.create({
  container: {
    backgroundColor: '#0a0b12',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#9333ea',
    overflow: 'hidden',
    marginBottom: 10
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#170b28',
    borderBottomWidth: 1,
    borderBottomColor: '#2e1065'
  },
  headerLeft: {
    flex: 1
  },
  headerTitle: {
    color: '#e9d5ff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1
  },
  headerSub: {
    color: '#a855f7',
    fontSize: 7.5,
    fontWeight: 'bold'
  },
  headerRight: {
    alignItems: 'flex-end'
  },
  scoreBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1
  },
  scoreBadgeClean: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderColor: '#22c55e'
  },
  scoreBadgeClash: {
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    borderColor: '#ef4444'
  },
  scoreBadgeText: {
    color: '#ffffff',
    fontSize: 8.5,
    fontWeight: '900'
  },
  toolbar: {
    padding: 6,
    backgroundColor: '#0f0a1c',
    borderBottomWidth: 1,
    borderBottomColor: '#2e1065'
  },
  btnGroup: {
    flexDirection: 'row',
    gap: 6
  },
  toggleBtn: {
    flex: 1,
    backgroundColor: '#1e1b4b',
    paddingVertical: 5,
    borderRadius: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3730a3'
  },
  toggleBtnEmerald: {
    backgroundColor: '#064e3b',
    borderColor: '#34d399'
  },
  toggleBtnAmber: {
    backgroundColor: '#451a03',
    borderColor: '#f59e0b'
  },
  toggleBtnText: {
    color: '#ffffff',
    fontSize: 8.5,
    fontWeight: 'bold'
  },
  presetBtn: {
    flex: 1,
    backgroundColor: '#2e1065',
    paddingVertical: 4,
    borderRadius: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#581c87'
  },
  presetBtnText: {
    color: '#d8b4fe',
    fontSize: 8,
    fontWeight: 'bold'
  },
  stageContainer: {
    width: '100%',
    height: 180,
    backgroundColor: '#07050f'
  },
  bottomTuner: {
    padding: 8,
    backgroundColor: '#120b22',
    borderTopWidth: 1,
    borderTopColor: '#2e1065'
  },
  tunerLabel: {
    color: '#a855f7',
    fontSize: 8,
    fontWeight: 'bold',
    marginBottom: 4,
    letterSpacing: 0.5
  },
  carrierChipRow: {
    flexDirection: 'row',
    gap: 6
  },
  carrierChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1e1b4b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#3730a3'
  },
  carrierChipSelected: {
    borderColor: '#38bdf8',
    backgroundColor: '#0c2431'
  },
  carrierChipClash: {
    borderColor: '#ef4444',
    backgroundColor: '#450a0a'
  },
  chipLabel: {
    color: '#e2e8f0',
    fontSize: 8.5,
    fontWeight: 'bold'
  },
  chipFreq: {
    color: '#facc15',
    fontSize: 9,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  chipBtnGroup: {
    flexDirection: 'row',
    gap: 3
  },
  miniBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 2
  },
  miniBtnText: {
    color: '#f8fafc',
    fontSize: 7.5,
    fontWeight: 'bold'
  }
});
