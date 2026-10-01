import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  TextInput, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView, 
  useWindowDimensions, 
  Share, 
  Alert, 
  Modal,
  SafeAreaView,
  StatusBar
} from 'react-native';
import Svg, { Line, Rect, Text as SvgText, G, Circle, Path, Polygon } from 'react-native-svg';

// ================= VECTOR HARDWARE PADLOCK ICON =================
export const HardwarePadlockIcon: React.FC<{ locked: boolean; size?: number }> = ({ locked, size = 16 }) => {
  if (locked) {
    return (
      <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
        <Path d="M 6.5 8 V 4.5 C 6.5 2.5 13.5 2.5 13.5 4.5 V 8" stroke="#facc15" strokeWidth="2" strokeLinecap="round" />
        <Rect x="3.5" y="8" width="13" height="10" rx="2" fill="#ca8a04" stroke="#fde047" strokeWidth="1.2" />
        <Circle cx="10" cy="11.8" r="1.3" fill="#422006" />
        <Path d="M 9.3 12.3 L 10.7 12.3 L 10.4 15.2 L 9.6 15.2 Z" fill="#422006" />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Path d="M 6.5 7.5 V 4 C 6.5 2 0.5 2 0.5 4 V 6.8" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
      <Rect x="3.5" y="8" width="13" height="10" rx="2" fill="#1e293b" stroke="#64748b" strokeWidth="1.2" />
      <Circle cx="13.5" cy="8" r="1.1" fill="#0f172a" />
      <Circle cx="10" cy="11.8" r="1.3" fill="#0f172a" />
      <Path d="M 9.3 12.3 L 10.7 12.3 L 10.4 15.2 L 9.6 15.2 Z" fill="#0f172a" />
    </Svg>
  );
};

// ================= DATA TYPES =================
export type DeviceType = 'MIC' | 'IEM';
export type TVChannelStatus = 'available' | 'blocked' | 'mic-only' | 'iem-only';

export interface ChannelRequestGroup {
  id: string;
  name: string;
  type: DeviceType;
  equipmentKey: string;
  quantity: number;
  zoneId: string;
  linearDigitalMode?: boolean;
}

export interface CoordinatedChannel {
  id: string;
  groupId: string;
  channelName: string;
  zoneId: string;
  zoneName: string;
  type: DeviceType;
  equipmentName: string;
  freq: number; // in MHz
  locked: boolean;
  hasClash: boolean;
  clashReason?: string;
  tvChannel?: number;
  powerDbm: number;
}

export interface ZoneConfig {
  id: string;
  name: string;
}

export interface IntermodProduct {
  freq: number;
  type: '2-Tone' | '3-Tone';
  formula: string;
  sources: string[];
  hasClash: boolean;
}

const PRESET_EQUIPMENT_OPTIONS = [
  { key: 'shure-ad-g56', name: 'Shure Axient Digital (G56: 470-636 MHz)', type: 'MIC' as DeviceType, min: 470.125, max: 635.875, step: 0.025, digital: true },
  { key: 'shure-ad-g57', name: 'Shure Axient Digital (G57: 470-616 MHz)', type: 'MIC' as DeviceType, min: 470.125, max: 615.875, step: 0.025, digital: true },
  { key: 'shure-ad-k55', name: 'Shure Axient Digital (K55: 606-694 MHz)', type: 'MIC' as DeviceType, min: 606.125, max: 693.875, step: 0.025, digital: true },
  { key: 'shure-psm1000-g10', name: 'Shure PSM 1000 (G10: 470-542 MHz)', type: 'IEM' as DeviceType, min: 470.125, max: 541.875, step: 0.025, digital: false },
  { key: 'shure-psm1000-j8e', name: 'Shure PSM 1000 (J8E: 554-626 MHz)', type: 'IEM' as DeviceType, min: 554.125, max: 625.875, step: 0.025, digital: false },
  { key: 'shure-psm1000-k10e', name: 'Shure PSM 1000 (K10E: 596-668 MHz)', type: 'IEM' as DeviceType, min: 596.125, max: 667.875, step: 0.025, digital: false },
  { key: 'shure-ulxd-g51', name: 'Shure ULX-D (G51: 470-534 MHz)', type: 'MIC' as DeviceType, min: 470.125, max: 533.875, step: 0.025, digital: true },
  { key: 'sennheiser-d6000-a1a4', name: 'Sennheiser D6000 (A1-A4: 470-558 MHz)', type: 'MIC' as DeviceType, min: 470.200, max: 557.875, step: 0.025, digital: true },
  { key: 'sennheiser-2000iem-aw', name: 'Sennheiser 2000 IEM (Aw: 516-558 MHz)', type: 'IEM' as DeviceType, min: 516.125, max: 557.875, step: 0.025, digital: false },
  { key: 'wisycom-mtk952', name: 'Wisycom MTK952 (Wideband IEM: 470-694 MHz)', type: 'IEM' as DeviceType, min: 470.125, max: 693.875, step: 0.025, digital: false },
  { key: 'wisycom-mrk16', name: 'Wisycom MRK16 / MTP60 (Wideband Mics)', type: 'MIC' as DeviceType, min: 470.125, max: 693.875, step: 0.025, digital: false }
];

const UK_TV_CHANNELS: Record<number, [number, number]> = {
  21: [470, 478], 22: [478, 486], 23: [486, 494], 24: [494, 502],
  25: [502, 510], 26: [510, 518], 27: [518, 526], 28: [526, 534],
  29: [534, 542], 30: [542, 550], 31: [550, 558], 32: [558, 566],
  33: [566, 574], 34: [574, 582], 35: [582, 590], 36: [590, 598],
  37: [598, 606], 38: [606.5, 613.5], 39: [614, 622], 40: [622, 630]
};

export default function RadioMicIemPlannerApp() {
  const { width: windowWidth } = useWindowDimensions();
  const canvasWidth = Math.max(320, windowWidth - 32);

  // Active view: 'PLANNER' | 'SPECTRUM' | 'INTERMODS' | 'TV_GRID'
  const [activeTab, setActiveTab] = useState<'PLANNER' | 'SPECTRUM' | 'INTERMODS' | 'TV_GRID'>('PLANNER');

  // Zones
  const [zones, setZones] = useState<ZoneConfig[]>([
    { id: 'z1', name: 'Main Stage' },
    { id: 'z2', name: 'Stage B / Acoustic' },
    { id: 'z3', name: 'In-Ear Transmit Rack' }
  ]);
  const [activeZoneFilter, setActiveZoneFilter] = useState<string>('ALL');

  // Channel Request Groups
  const [requestGroups, setRequestGroups] = useState<ChannelRequestGroup[]>([
    { id: 'grp_1', name: 'Lead Vocals & Guest Mics', type: 'MIC', equipmentKey: 'shure-ad-g56', quantity: 8, zoneId: 'z1', linearDigitalMode: true },
    { id: 'grp_2', name: 'Artist & Band In-Ear Monitors', type: 'IEM', equipmentKey: 'shure-psm1000-g10', quantity: 6, zoneId: 'z1', linearDigitalMode: false },
    { id: 'grp_3', name: 'Stage B Acoustic Mics', type: 'MIC', equipmentKey: 'sennheiser-d6000-a1a4', quantity: 4, zoneId: 'z2', linearDigitalMode: true }
  ]);

  // Results
  const [channels, setChannels] = useState<CoordinatedChannel[]>([]);
  const [isCoordinating, setIsCoordinating] = useState<boolean>(false);

  // TV Channel Exclusions
  const [tvChannelStates, setTvChannelStates] = useState<Record<number, TVChannelStatus>>({
    24: 'blocked', 27: 'blocked', 31: 'blocked'
  });

  // Spectrum Display Controls
  const [centerFreq, setCenterFreq] = useState<number>(510.00000);
  const [span, setSpan] = useState<number>(40.0);
  const [showTwoTone, setShowTwoTone] = useState<boolean>(true);
  const [showThreeTone, setShowThreeTone] = useState<boolean>(true);

  // Canvas Geometry
  const CANVAS_HEIGHT = 200;
  const TOP_MARGIN = 22;
  const BOTTOM_MARGIN = 26;
  const PLOT_HEIGHT = CANVAS_HEIGHT - TOP_MARGIN - BOTTOM_MARGIN;
  const NOISE_FLOOR_DBM = -95;
  const REF_LEVEL_DBM = 0;

  const startFreq = centerFreq - span / 2;
  const stopFreq = centerFreq + span / 2;

  const freqToX = useCallback((f: number) => {
    if (span <= 0) return 0;
    return ((f - startFreq) / span) * canvasWidth;
  }, [startFreq, span, canvasWidth]);

  const dbmToY = (dbm: number) => {
    const clamped = Math.max(NOISE_FLOOR_DBM, Math.min(REF_LEVEL_DBM, dbm));
    const ratio = (clamped - NOISE_FLOOR_DBM) / (REF_LEVEL_DBM - NOISE_FLOOR_DBM);
    return TOP_MARGIN + PLOT_HEIGHT * (1 - ratio);
  };

  const getTvChannel = useCallback((freq: number): number | undefined => {
    for (const [chStr, range] of Object.entries(UK_TV_CHANNELS)) {
      const ch = parseInt(chStr, 10);
      if (freq >= range[0] && freq <= range[1]) return ch;
    }
    return undefined;
  }, []);

  // Intermod Calculations
  const intermodProducts = useMemo(() => {
    const list: IntermodProduct[] = [];
    const active = channels.filter(c => c.freq > 0);
    const n = active.length;
    if (n < 2) return list;

    // 2-Tone IMD
    if (showTwoTone) {
      for (let a = 0; a < n; a++) {
        for (let b = 0; b < n; b++) {
          if (a === b) continue;
          const fA = active[a].freq;
          const fB = active[b].freq;
          const p = Math.round((2 * fA - fB) * 100000) / 100000;
          if (p >= startFreq - 2 && p <= stopFreq + 2) {
            // Collision threshold <= 0.005 MHz (5 kHz passband)
            const clash = active.some(c => Math.abs(c.freq - p) <= 0.005);
            list.push({
              freq: p,
              type: '2-Tone',
              formula: `2*(${fA.toFixed(3)}) - ${fB.toFixed(3)}`,
              sources: [active[a].channelName, active[b].channelName],
              hasClash: clash
            });
          }
        }
      }
    }

    // 3-Tone IMD
    if (showThreeTone && n >= 3) {
      for (let a = 0; a < n; a++) {
        for (let b = a + 1; b < n; b++) {
          for (let c = 0; c < n; c++) {
            if (c === a || c === b) continue;
            const fA = active[a].freq;
            const fB = active[b].freq;
            const fC = active[c].freq;
            const p = Math.round((fA + fB - fC) * 100000) / 100000;
            if (p >= startFreq - 2 && p <= stopFreq + 2) {
              const clash = active.some(ch => Math.abs(ch.freq - p) <= 0.005);
              list.push({
                freq: p,
                type: '3-Tone',
                formula: `${fA.toFixed(3)} + ${fB.toFixed(3)} - ${fC.toFixed(3)}`,
                sources: [active[a].channelName, active[b].channelName, active[c].channelName],
                hasClash: clash
              });
            }
          }
        }
      }
    }

    return list;
  }, [channels, showTwoTone, showThreeTone, startFreq, stopFreq]);

  // Collision Audit with threshold <= 0.005 MHz
  const auditClashes = useCallback((list: CoordinatedChannel[]): CoordinatedChannel[] => {
    return list.map(target => {
      if (target.freq <= 0) return { ...target, hasClash: false, clashReason: undefined };

      // Fundamental spacing check (350kHz for mic, 375kHz for IEM)
      const fThresh = target.type === 'MIC' ? 0.350 : 0.375;
      for (const other of list) {
        if (other.id === target.id || other.freq <= 0) continue;
        const delta = Math.abs(target.freq - other.freq);
        if (delta < fThresh - 0.0001) {
          return {
            ...target,
            hasClash: true,
            clashReason: `Fundamental conflict with ${other.channelName} (Δ ${(delta * 1000).toFixed(0)} kHz)`
          };
        }
      }

      // 2TX and 3TX IMD collision (threshold <= 0.005 MHz)
      for (let a = 0; a < list.length; a++) {
        for (let b = 0; b < list.length; b++) {
          if (a === b) continue;
          const ca = list[a];
          const cb = list[b];
          if (ca.id === target.id || cb.id === target.id || ca.freq <= 0 || cb.freq <= 0) continue;

          const imd2 = 2 * ca.freq - cb.freq;
          if (Math.abs(target.freq - imd2) <= 0.005) {
            return {
              ...target,
              hasClash: true,
              clashReason: `2TX 3rd IMD clash with ${ca.channelName}/${cb.channelName} @ ${imd2.toFixed(3)} MHz`
            };
          }

          for (let c = 0; c < list.length; c++) {
            if (c === a || c === b) continue;
            const cc = list[c];
            if (cc.id === target.id || cc.freq <= 0) continue;
            const imd3 = ca.freq + cb.freq - cc.freq;
            if (Math.abs(target.freq - imd3) <= 0.005) {
              return {
                ...target,
                hasClash: true,
                clashReason: `3TX 3rd IMD clash with ${ca.channelName}/${cb.channelName}/${cc.channelName}`
              };
            }
          }
        }
      }

      // TV channel exclusion
      const tvCh = getTvChannel(target.freq);
      if (tvCh && tvChannelStates[tvCh] === 'blocked') {
        return { ...target, hasClash: true, clashReason: `Inside blocked TV Ch ${tvCh}` };
      }

      return { ...target, hasClash: false, clashReason: undefined };
    });
  }, [getTvChannel, tvChannelStates]);

  // Master Frequency Generation
  const runCoordination = useCallback(() => {
    setIsCoordinating(true);

    setTimeout(() => {
      const newChannels: CoordinatedChannel[] = [];
      const placed: { freq: number; type: DeviceType; isDigital: boolean }[] = [];

      // Retain locked frequencies
      channels.forEach(ch => {
        if (ch.locked && ch.freq > 0) {
          newChannels.push(ch);
          placed.push({
            freq: ch.freq,
            type: ch.type,
            isDigital: !!requestGroups.find(g => g.id === ch.groupId)?.linearDigitalMode
          });
        }
      });

      // Allocate groups
      requestGroups.forEach(grp => {
        const zone = zones.find(z => z.id === grp.zoneId) || zones[0];
        const preset = PRESET_EQUIPMENT_OPTIONS.find(p => p.key === grp.equipmentKey) || PRESET_EQUIPMENT_OPTIONS[0];

        const min = preset.min;
        const max = preset.max;
        const step = preset.step;
        const isDigital = !!grp.linearDigitalMode;
        const power = grp.type === 'IEM' ? -10 : -18;

        const candidateFreqs: number[] = [];
        for (let f = min; f <= max + 0.0001; f = Math.round((f + step) * 10000) / 10000) {
          const tvCh = getTvChannel(f);
          if (tvCh && tvChannelStates[tvCh] === 'blocked') continue;
          candidateFreqs.push(f);
        }

        for (let q = 1; q <= grp.quantity; q++) {
          const chId = `${grp.id}_ch_${q}`;
          if (newChannels.some(c => c.id === chId)) continue;

          let bestFreq = 0;
          const fGuard = grp.type === 'MIC' ? 0.350 : 0.375;

          for (const cand of candidateFreqs) {
            // Fundamental separation
            if (placed.some(p => Math.abs(p.freq - cand) < fGuard - 0.0001)) continue;

            // IMD checks
            let imdConflict = false;
            if (!isDigital) {
              for (let a = 0; a < placed.length; a++) {
                for (let b = 0; b < placed.length; b++) {
                  if (a === b) continue;
                  const imd2 = 2 * placed[a].freq - placed[b].freq;
                  if (Math.abs(cand - imd2) <= 0.005) {
                    imdConflict = true;
                    break;
                  }
                  const newImd2 = 2 * cand - placed[a].freq;
                  if (placed.some(p => Math.abs(p.freq - newImd2) <= 0.005)) {
                    imdConflict = true;
                    break;
                  }
                }
                if (imdConflict) break;
              }
            }

            if (!imdConflict) {
              bestFreq = cand;
              break;
            }
          }

          if (bestFreq === 0 && candidateFreqs.length > 0) {
            bestFreq = candidateFreqs[q % candidateFreqs.length];
          }

          newChannels.push({
            id: chId,
            groupId: grp.id,
            channelName: `${grp.name} #${q}`,
            zoneId: zone.id,
            zoneName: zone.name,
            type: grp.type,
            equipmentName: preset.name,
            freq: bestFreq,
            locked: false,
            hasClash: false,
            tvChannel: getTvChannel(bestFreq),
            powerDbm: power
          });

          if (bestFreq > 0) {
            placed.push({ freq: bestFreq, type: grp.type, isDigital });
          }
        }
      });

      const audited = auditClashes(newChannels);
      setChannels(audited);

      // Auto-fit spectrum
      if (audited.length > 0) {
        const valids = audited.filter(c => c.freq > 0).map(c => c.freq);
        if (valids.length > 0) {
          const minF = Math.min(...valids);
          const maxF = Math.max(...valids);
          const cF = Math.round(((minF + maxF) / 2) * 1000) / 1000;
          setCenterFreq(cF);
          setSpan(Math.max(15, Math.ceil((maxF - minF + 6) / 5) * 5));
        }
      }

      setIsCoordinating(false);
    }, 100);
  }, [channels, requestGroups, zones, getTvChannel, tvChannelStates, auditClashes]);

  useEffect(() => {
    if (channels.length === 0) runCoordination();
  }, []);

  const toggleLock = (channelId: string) => {
    setChannels(prev => prev.map(c => c.id === channelId ? { ...c, locked: !c.locked } : c));
  };

  const nudgeChannel = (channelId: string, deltaKhz: number) => {
    setChannels(prev => {
      const updated = prev.map(c => {
        if (c.id !== channelId) return c;
        const newFreq = Math.round((c.freq + deltaKhz / 1000) * 100000) / 100000;
        return { ...c, freq: newFreq, tvChannel: getTvChannel(newFreq) };
      });
      return auditClashes(updated);
    });
  };

  const shareCoordination = async () => {
    const text = [
      "RADIO MIC & IEM COORDINATION PLAN",
      "==================================",
      ...channels.map((c, i) => `${i + 1}. [${c.type}] ${c.channelName} (${c.zoneName}): ${c.freq.toFixed(4)} MHz ${c.tvChannel ? `(TV Ch ${c.tvChannel})` : ''} - ${c.hasClash ? 'CLASH' : 'CLEAR'}`)
    ].join('\n');

    try {
      await Share.share({ message: text, title: "Radio Mic & IEM Plan" });
    } catch (e) {
      Alert.alert("Share", text);
    }
  };

  const clashCount = useMemo(() => channels.filter(c => c.hasClash).length, [channels]);

  const visibleChannels = useMemo(() => {
    if (activeZoneFilter === 'ALL') return channels;
    return channels.filter(c => c.zoneId === activeZoneFilter);
  }, [channels, activeZoneFilter]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#020617" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
        
        {/* Header Bar */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>RADIO MIC & IEM PLANNER</Text>
            <Text style={styles.subtitle}>Tactical Wireless Coordination & Spectrum Suite</Text>
          </View>
          <View style={styles.headerButtons}>
            <TouchableOpacity style={styles.actionBtnPrimary} onPress={runCoordination} disabled={isCoordinating}>
              <Text style={styles.actionBtnText}>{isCoordinating ? 'RUNNING...' : 'COORDINATE'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtnSecondary} onPress={shareCoordination}>
              <Text style={styles.actionBtnTextSec}>SHARE</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* View Switcher Tabs */}
        <View style={styles.tabBar}>
          {(['PLANNER', 'SPECTRUM', 'INTERMODS', 'TV_GRID'] as const).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabItem, activeTab === tab && styles.tabItemActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'PLANNER' ? 'Desk' : tab === 'SPECTRUM' ? 'Scope' : tab === 'INTERMODS' ? 'Intermods' : 'TV Grid'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView style={styles.contentScroll} contentContainerStyle={{ paddingBottom: 60 }}>
          
          {/* ================= TACTICAL SPECTRUM ANALYZER CANVAS ================= */}
          <View style={styles.spectrumCard}>
            <View style={styles.spectrumControls}>
              <Text style={styles.specParamText}>CF: <Text style={styles.specParamVal}>{centerFreq.toFixed(3)}</Text> MHz</Text>
              <Text style={styles.specParamText}>SPAN: <Text style={styles.specParamVal}>{span.toFixed(1)}</Text> MHz</Text>
              <View style={styles.zoomButtons}>
                <TouchableOpacity style={styles.zoomBtn} onPress={() => setSpan(Math.max(5, span - 10))}>
                  <Text style={styles.zoomBtnText}>+</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.zoomBtn} onPress={() => setSpan(Math.min(250, span + 10))}>
                  <Text style={styles.zoomBtnText}>-</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.zoomBtn} onPress={() => setCenterFreq(Math.round((centerFreq - 5) * 1000) / 1000)}>
                  <Text style={styles.zoomBtnText}>&lt;</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.zoomBtn} onPress={() => setCenterFreq(Math.round((centerFreq + 5) * 1000) / 1000)}>
                  <Text style={styles.zoomBtnText}>&gt;</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* SVG Spectrum Scope */}
            <View style={styles.svgContainer}>
              <Svg width={canvasWidth} height={CANVAS_HEIGHT}>
                {/* Horizontal Grid Lines */}
                {[0.25, 0.5, 0.75].map((r, i) => (
                  <Line
                    key={`gy_${i}`}
                    x1={0}
                    y1={TOP_MARGIN + PLOT_HEIGHT * r}
                    x2={canvasWidth}
                    y2={TOP_MARGIN + PLOT_HEIGHT * r}
                    stroke="#1e293b"
                    strokeWidth={0.8}
                    strokeDasharray="4, 4"
                  />
                ))}

                {/* Baseline */}
                <Line
                  x1={0}
                  y1={TOP_MARGIN + PLOT_HEIGHT}
                  x2={canvasWidth}
                  y2={TOP_MARGIN + PLOT_HEIGHT}
                  stroke="#334155"
                  strokeWidth={1.5}
                />

                {/* Carrier Peaks */}
                {channels.map((car, idx) => {
                  if (car.freq < startFreq - 2 || car.freq > stopFreq + 2) return null;
                  const x = freqToX(car.freq);
                  const isIem = car.type === 'IEM';
                  const peakY = dbmToY(car.powerDbm);
                  const baseY = TOP_MARGIN + PLOT_HEIGHT;
                  const leftX = x - 7;
                  const rightX = x + 7;

                  const strokeColor = car.hasClash ? '#ef4444' : (isIem ? '#38bdf8' : '#facc15');
                  const fillColor = car.hasClash ? 'rgba(239, 68, 68, 0.75)' : (isIem ? 'rgba(56, 189, 248, 0.25)' : 'rgba(250, 204, 21, 0.25)');

                  const pathData = `M ${leftX - 5} ${baseY} Q ${leftX} ${baseY} ${x - 2} ${peakY + 2} L ${x} ${peakY} L ${x + 2} ${peakY + 2} Q ${rightX} ${baseY} ${rightX + 5} ${baseY} Z`;

                  return (
                    <G key={`car_${car.id}_${idx}`}>
                      <Path d={pathData} fill={fillColor} stroke={strokeColor} strokeWidth={car.hasClash ? 2.5 : 1.6} />
                      <Circle cx={x} cy={peakY} r={car.hasClash ? 4 : 2.8} fill={strokeColor} />
                      <SvgText
                        x={x}
                        y={peakY - 5}
                        fill={car.hasClash ? '#ef4444' : strokeColor}
                        fontSize="8"
                        fontWeight="bold"
                        fontFamily={Platform.OS === 'ios' ? 'Courier' : 'monospace'}
                        textAnchor="middle"
                      >
                        {car.hasClash ? '[! CLASH] ' : ''}{car.freq.toFixed(3)}
                      </SvgText>
                    </G>
                  );
                })}

                {/* Intermod Product Stems and Arrows */}
                {intermodProducts.map((imd, i) => {
                  if (imd.freq < startFreq || imd.freq > stopFreq) return null;
                  const x = freqToX(imd.freq);
                  const topY = dbmToY(imd.type === '2-Tone' ? -48 : -58);
                  const color = imd.hasClash ? '#ef4444' : (imd.type === '2-Tone' ? '#f43f5e' : '#e11d48');

                  return (
                    <G key={`imd_${i}`}>
                      <Line
                        x1={x}
                        y1={topY}
                        x2={x}
                        y2={TOP_MARGIN + PLOT_HEIGHT}
                        stroke={color}
                        strokeWidth={imd.hasClash ? 2.2 : 1.4}
                        strokeDasharray={imd.type === '2-Tone' ? 'none' : '3, 2'}
                      />
                      <Polygon
                        points={`${x - 4},${topY + 7} ${x + 4},${topY + 7} ${x},${topY}`}
                        fill={color}
                        stroke="#ffffff"
                        strokeWidth={0.8}
                      />
                    </G>
                  );
                })}
              </Svg>
            </View>

            {/* Spectrum Legend */}
            <View style={styles.legendRow}>
              <Text style={[styles.legendItem, { color: '#facc15' }]}>● Mics (Amber)</Text>
              <Text style={[styles.legendItem, { color: '#38bdf8' }]}>● IEMs (Cyan)</Text>
              <Text style={[styles.legendItem, { color: '#f43f5e' }]}>▼ 2TX/3TX IMD</Text>
              {clashCount > 0 && (
                <Text style={[styles.legendItem, { color: '#ef4444', fontWeight: 'bold' }]}>⚠️ {clashCount} CLASH</Text>
              )}
            </View>
          </View>

          {/* ================= TAB 1: COORDINATION DESK / LEDGER ================= */}
          {activeTab === 'PLANNER' && (
            <View style={styles.deskContainer}>
              
              {/* Channel Ledger Header & Zone Filter */}
              <View style={styles.ledgerHeader}>
                <Text style={styles.sectionTitle}>FREQUENCY LEDGER ({channels.length} CH)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.zoneFilterRow}>
                  <TouchableOpacity
                    style={[styles.zoneFilterBtn, activeZoneFilter === 'ALL' && styles.zoneFilterBtnActive]}
                    onPress={() => setActiveZoneFilter('ALL')}
                  >
                    <Text style={styles.zoneFilterText}>ALL</Text>
                  </TouchableOpacity>
                  {zones.map(z => (
                    <TouchableOpacity
                      key={z.id}
                      style={[styles.zoneFilterBtn, activeZoneFilter === z.id && styles.zoneFilterBtnActive]}
                      onPress={() => setActiveZoneFilter(z.id)}
                    >
                      <Text style={styles.zoneFilterText}>{z.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Channels List */}
              {visibleChannels.map((ch, idx) => (
                <View key={ch.id} style={[styles.channelRow, ch.hasClash && styles.channelRowClash]}>
                  <View style={styles.channelRowLeft}>
                    <Text style={styles.channelNum}>{idx + 1}</Text>
                    <View>
                      <Text style={styles.channelName}>{ch.channelName}</Text>
                      <Text style={styles.channelMeta}>{ch.zoneName} · {ch.type}</Text>
                    </View>
                  </View>

                  <View style={styles.channelRowRight}>
                    <Text style={[styles.channelFreq, { color: ch.hasClash ? '#ef4444' : ch.type === 'IEM' ? '#38bdf8' : '#facc15' }]}>
                      {ch.freq.toFixed(4)} MHz
                    </Text>

                    {/* Nudge Buttons */}
                    <View style={styles.nudgeContainer}>
                      <TouchableOpacity style={styles.nudgeBtn} onPress={() => nudgeChannel(ch.id, -25)}>
                        <Text style={styles.nudgeBtnText}>-25k</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.nudgeBtn} onPress={() => nudgeChannel(ch.id, 25)}>
                        <Text style={styles.nudgeBtnText}>+25k</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Padlock */}
                    <TouchableOpacity onPress={() => toggleLock(ch.id)} style={styles.padlockBtn}>
                      <HardwarePadlockIcon locked={ch.locked} size={15} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ================= TAB 2: INTERMOD MATRIX ================= */}
          {activeTab === 'INTERMODS' && (
            <View style={styles.intermodCard}>
              <Text style={styles.sectionTitle}>3RD ORDER INTERMOD AUDIT ({intermodProducts.length})</Text>
              <Text style={styles.intermodNote}>Threshold: &le; 0.005 MHz (5 kHz passband) flags direct on-channel collision.</Text>
              
              {intermodProducts.slice(0, 50).map((imd, i) => (
                <View key={`imd_item_${i}`} style={[styles.imdRow, imd.hasClash && styles.imdRowClash]}>
                  <Text style={[styles.imdType, { color: imd.type === '2-Tone' ? '#f43f5e' : '#e11d48' }]}>{imd.type}</Text>
                  <Text style={styles.imdFreq}>{imd.freq.toFixed(4)} MHz</Text>
                  <Text style={styles.imdFormula}>{imd.formula}</Text>
                  <Text style={[styles.imdStatus, { color: imd.hasClash ? '#ef4444' : '#64748b' }]}>
                    {imd.hasClash ? '⚠️ HIT' : 'CLEAR'}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* ================= TAB 3: TV GRID ================= */}
          {activeTab === 'TV_GRID' && (
            <View style={styles.tvGridCard}>
              <Text style={styles.sectionTitle}>DTV WHITE-SPACE GRID (UK OFCOM)</Text>
              <Text style={styles.intermodNote}>Tap a channel block to toggle Blocked / Available.</Text>

              <View style={styles.tvGridContainer}>
                {Object.entries(UK_TV_CHANNELS).map(([chStr, range]) => {
                  const ch = parseInt(chStr, 10);
                  const isBlocked = tvChannelStates[ch] === 'blocked';
                  return (
                    <TouchableOpacity
                      key={`tv_ch_${ch}`}
                      style={[styles.tvBox, isBlocked ? styles.tvBoxBlocked : styles.tvBoxAvailable]}
                      onPress={() => {
                        setTvChannelStates(prev => ({
                          ...prev,
                          [ch]: isBlocked ? 'available' : 'blocked'
                        }));
                      }}
                    >
                      <Text style={styles.tvChNum}>Ch {ch}</Text>
                      <Text style={styles.tvChState}>{isBlocked ? 'BLOCKED' : 'AVAILABLE'}</Text>
                      <Text style={styles.tvChRange}>{range[0]}-{range[1]}M</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#020617' },
  container: { flex: 1, backgroundColor: '#020617', paddingHorizontal: 12 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b'
  },
  title: { fontSize: 16, fontWeight: '900', color: '#ffffff', letterSpacing: 1 },
  subtitle: { fontSize: 10, color: '#64748b', marginTop: 2 },
  headerButtons: { flexDirection: 'row', gap: 6 },
  actionBtnPrimary: {
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6
  },
  actionBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 11 },
  actionBtnSecondary: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6
  },
  actionBtnTextSec: { color: '#94a3b8', fontWeight: 'bold', fontSize: 11 },
  tabBar: { flexDirection: 'row', backgroundColor: '#0f172a', padding: 4, borderRadius: 8, marginVertical: 8 },
  tabItem: { flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 6 },
  tabItemActive: { backgroundColor: '#4f46e5' },
  tabText: { fontSize: 11, fontWeight: 'bold', color: '#64748b' },
  tabTextActive: { color: '#ffffff' },
  contentScroll: { flex: 1 },
  spectrumCard: {
    backgroundColor: '#090d16',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 8,
    marginBottom: 12
  },
  spectrumControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6
  },
  specParamText: { color: '#64748b', fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  specParamVal: { color: '#ffffff', fontWeight: 'bold' },
  zoomButtons: { flexDirection: 'row', gap: 4 },
  zoomBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4
  },
  zoomBtnText: { color: '#cbd5e1', fontWeight: 'bold', fontSize: 12 },
  svgContainer: { backgroundColor: '#020617', borderRadius: 8, overflow: 'hidden' },
  legendRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#1e293b' },
  legendItem: { fontSize: 10, fontWeight: '600', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  deskContainer: { backgroundColor: '#090d16', borderRadius: 10, borderWidth: 1, borderColor: '#1e293b', padding: 10 },
  ledgerHeader: { marginBottom: 10 },
  sectionTitle: { fontSize: 12, fontWeight: '900', color: '#ffffff', letterSpacing: 0.8, marginBottom: 4 },
  zoneFilterRow: { flexDirection: 'row', gap: 6, marginVertical: 4 },
  zoneFilterBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4, backgroundColor: '#1e293b' },
  zoneFilterBtnActive: { backgroundColor: '#4f46e5' },
  zoneFilterText: { color: '#ffffff', fontSize: 10, fontWeight: 'bold' },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b'
  },
  channelRowClash: { backgroundColor: 'rgba(239, 68, 68, 0.15)' },
  channelRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  channelNum: { color: '#64748b', fontSize: 11, width: 20, textAlign: 'center', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  channelName: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' },
  channelMeta: { color: '#64748b', fontSize: 9 },
  channelRowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  channelFreq: { fontSize: 12, fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  nudgeContainer: { flexDirection: 'row', gap: 3 },
  nudgeBtn: { backgroundColor: '#1e293b', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3 },
  nudgeBtnText: { color: '#cbd5e1', fontSize: 9, fontWeight: 'bold' },
  padlockBtn: { padding: 4 },
  intermodCard: { backgroundColor: '#090d16', borderRadius: 10, borderWidth: 1, borderColor: '#1e293b', padding: 10 },
  intermodNote: { color: '#64748b', fontSize: 10, marginBottom: 8 },
  imdRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  imdRowClash: { backgroundColor: 'rgba(239, 68, 68, 0.2)' },
  imdType: { fontSize: 10, fontWeight: 'bold', width: 45 },
  imdFreq: { color: '#ffffff', fontSize: 11, fontWeight: 'bold', width: 85, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  imdFormula: { color: '#94a3b8', fontSize: 9, flex: 1 },
  imdStatus: { fontSize: 10, fontWeight: 'bold' },
  tvGridCard: { backgroundColor: '#090d16', borderRadius: 10, borderWidth: 1, borderColor: '#1e293b', padding: 10 },
  tvGridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tvBox: { width: '23%', padding: 6, borderRadius: 6, borderWidth: 1, alignItems: 'center' },
  tvBoxAvailable: { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: '#10b981' },
  tvBoxBlocked: { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: '#ef4444' },
  tvChNum: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' },
  tvChState: { fontSize: 8, fontWeight: 'bold', color: '#94a3b8', marginVertical: 2 },
  tvChRange: { color: '#64748b', fontSize: 7, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }
});
