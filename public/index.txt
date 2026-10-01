import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  TextInput, 
  KeyboardAvoidingView, 
  Platform, 
  PanResponder, 
  ScrollView, 
  useWindowDimensions, 
  Share, 
  Alert, 
  Modal,
  Linking
} from 'react-native';
import Svg, { Line, Rect, Text as SvgText, G, Circle, Path, Polygon } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
// ================= VECTOR HARDWARE PADLOCK ICON =================
export const HardwarePadlockIcon: React.FC<{ locked: boolean; size?: number }> = ({ locked, size = 16 }) => {
  if (locked) {
    // CLOSED / LOCKED PADLOCK: Solid metallic amber/golden lock with closed U-shackle
    return (
      <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
        {/* Shackle: Closed loop firmly seated in both sockets */}
        <Path
          d="M 6.5 8 V 4.5 C 6.5 2.5 13.5 2.5 13.5 4.5 V 8"
          stroke="#facc15"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Padlock Body */}
        <Rect
          x="3.5"
          y="8"
          width="13"
          height="10"
          rx="2"
          fill="#ca8a04"
          stroke="#fde047"
          strokeWidth="1.2"
        />
        {/* Keyhole */}
        <Circle cx="10" cy="11.8" r="1.3" fill="#422006" />
        <Path d="M 9.3 12.3 L 10.7 12.3 L 10.4 15.2 L 9.6 15.2 Z" fill="#422006" />
      </Svg>
    );
  }

  // UNLOCKED / OPEN PADLOCK: Shackle flipped 180 degrees open with a clear, wide gap
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      {/* Shackle: Swung/flipped 180° open to the left, leaving the right hole open and vacant */}
      <Path
        d="M 6.5 7.5 V 4 C 6.5 2 0.5 2 0.5 4 V 6.8"
        stroke="#94a3b8"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Padlock Body - Slate steel */}
      <Rect
        x="3.5"
        y="8"
        width="13"
        height="10"
        rx="2"
        fill="#1e293b"
        stroke="#64748b"
        strokeWidth="1.2"
      />
      {/* Right socket hole clearly exposed and vacant */}
      <Circle cx="13.5" cy="8" r="1.1" fill="#0f172a" />
      {/* Keyhole */}
      <Circle cx="10" cy="11.8" r="1.3" fill="#0f172a" />
      <Path d="M 9.3 12.3 L 10.7 12.3 L 10.4 15.2 L 9.6 15.2 Z" fill="#0f172a" />
    </Svg>
  );
};

// ================= DEDICATED SPECTRUM ANALYZER & COMPATIBLE SETS SCREEN =================

export interface CustomCarrierInput {
  id: string;
  tx: number;
  rx: number;
  label: string;
  type: 'DUPLEX' | 'BASE_TX' | 'WALKIE';
  txBw: number; // in MHz, default 0.0125 (12.5 kHz)
  rxBw: number;
  active: boolean;
  locked: boolean;
}

export interface CompatibilityConflict {
  type: 'Fundamental' | '2-Tone IMD' | '3-Tone IMD';
  carrierA: string;
  carrierB?: string;
  carrierC?: string;
  targetCarrier: string;
  productFreq: number;
  targetFreq: number;
  diffKhz: number;
  thresholdKhz: number;
}

export interface RestrictedSpotFreq {
  freq: number;          // Center frequency in MHz
  bandwidthKhz: number;  // Bandwidth in kHz (typically 12.5, 25, or 50)
  region: string;
  description: string;
}

export interface RestrictedFreqRange {
  startFreq: number; // MHz
  stopFreq: number;  // MHz
  region: string;
  description: string;
}

// ================= HARDCODED RESTRICTED SPOT FREQUENCIES =================
export const RESTRICTED_SPOT_FREQUENCIES: RestrictedSpotFreq[] = [
  // Restricted UK-Wide (12.5 kHz)
  { freq: 455.10625, bandwidthKhz: 12.5, region: 'UK_WIDE', description: 'Restricted UK-Wide' },
  { freq: 455.20625, bandwidthKhz: 12.5, region: 'UK_WIDE', description: 'Restricted UK-Wide' },
  { freq: 455.24375, bandwidthKhz: 12.5, region: 'UK_WIDE', description: 'Restricted UK-Wide' },
  { freq: 455.26875, bandwidthKhz: 12.5, region: 'UK_WIDE', description: 'Restricted UK-Wide' },
  { freq: 455.40625, bandwidthKhz: 12.5, region: 'UK_WIDE', description: 'Restricted UK-Wide' },
  { freq: 455.43125, bandwidthKhz: 12.5, region: 'UK_WIDE', description: 'Restricted UK-Wide' },
  { freq: 455.44375, bandwidthKhz: 12.5, region: 'UK_WIDE', description: 'Restricted UK-Wide' },
  { freq: 447.45625, bandwidthKhz: 12.5, region: 'UK_WIDE', description: 'Restricted UK-Wide' },
];

// ================= HARDCODED RESTRICTED SPECTRUM RANGES =================
export const RESTRICTED_FREQUENCY_RANGES: RestrictedFreqRange[] = [
  { startFreq: 450.45625, stopFreq: 450.78125, region: 'UK_WIDE', description: 'Restricted UK-Wide' },
  { startFreq: 451.58125, stopFreq: 451.61875, region: 'UK_WIDE', description: 'Restricted UK-Wide' },
  { startFreq: 451.78125, stopFreq: 451.81875, region: 'UK_WIDE', description: 'Restricted UK-Wide' },
  { startFreq: 451.36875, stopFreq: 451.46875, region: 'UK_WIDE', description: 'Restricted UK-Wide' },
  { startFreq: 452.13125, stopFreq: 452.26875, region: 'UK_WIDE', description: 'Restricted UK-Wide' },
  { startFreq: 452.33125, stopFreq: 452.91875, region: 'UK_WIDE', description: 'Restricted UK-Wide' },
  { startFreq: 465.46875, stopFreq: 466.15625, region: 'UK_WIDE', description: 'Restricted UK-Wide' },
  { startFreq: 466.19375, stopFreq: 466.34375, region: 'UK_WIDE', description: 'Restricted UK-Wide' },
  { startFreq: 466.43125, stopFreq: 466.58125, region: 'UK_WIDE', description: 'Restricted UK-Wide' },
  { startFreq: 466.68125, stopFreq: 466.74375, region: 'UK_WIDE', description: 'Restricted UK-Wide' },
];

// ================= UK EXCLUSIONS STATE & SUBSCRIBERS =================
let ukExclusionsGlobal = false;
const ukExclusionListeners = new Set<(enabled: boolean) => void>();

if (typeof window !== 'undefined' && window.localStorage) {
  try {
    const saved = window.localStorage.getItem('rf_uk_exclusions_enabled');
    if (saved !== null) {
      ukExclusionsGlobal = saved === 'true';
    }
  } catch (e) {}
}

export function getUkExclusionsEnabled(): boolean {
  return ukExclusionsGlobal;
}

export function setUkExclusionsEnabled(enabled: boolean): void {
  ukExclusionsGlobal = enabled;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem('rf_uk_exclusions_enabled', enabled ? 'true' : 'false');
    } catch (e) {}
  }
  ukExclusionListeners.forEach(fn => {
    try { fn(enabled); } catch (e) {}
  });
}

export function subscribeUkExclusions(listener: (enabled: boolean) => void): () => void {
  ukExclusionListeners.add(listener);
  return () => {
    ukExclusionListeners.delete(listener);
  };
}

/**
 * Check whether a frequency falls within any restricted spot frequency or range.
 * If UK Exclusions is disabled, all restrictions are bypassed unless forceCheck is true.
 */
export function isFrequencyRestricted(
  freqMhz: number,
  selectedRegion: string = 'UK_ALL',
  forceCheck?: boolean
): { isRestricted: boolean; reason?: string } {
  if (!ukExclusionsGlobal && !forceCheck) {
    return { isRestricted: false };
  }
  if (!freqMhz || freqMhz <= 0) return { isRestricted: false };

  // 1. Check Spot Frequencies (12.5 kHz slot = ±6.24 kHz)
  for (let i = 0; i < RESTRICTED_SPOT_FREQUENCIES.length; i++) {
    const spot = RESTRICTED_SPOT_FREQUENCIES[i];
    const halfBwMhz = (spot.bandwidthKhz / 2000);
    if (Math.abs(freqMhz - spot.freq) <= halfBwMhz - 0.0001) {
      return {
        isRestricted: true,
        reason: `Spot frequency ${spot.freq.toFixed(5)} MHz is restricted (${spot.description})`
      };
    }
  }

  // 2. Check Ranges (allows adjacent 12.5 kHz frequency just outside the range)
  for (let i = 0; i < RESTRICTED_FREQUENCY_RANGES.length; i++) {
    const range = RESTRICTED_FREQUENCY_RANGES[i];
    if (freqMhz >= range.startFreq - 0.001 && freqMhz <= range.stopFreq + 0.001) {
      return {
        isRestricted: true,
        reason: `Frequency ${freqMhz.toFixed(5)} MHz falls inside restricted range ${range.startFreq.toFixed(5)} - ${range.stopFreq.toFixed(5)} MHz (${range.description})`
      };
    }
  }

  return { isRestricted: false };
}


export const DISCRETE_TALKBACK_PAIRS: Record<number, { tx: number; rx: number }[]> = {
  455: [
    { tx: 455.00625, rx: 468.38125 },
    { tx: 455.03125, rx: 468.05625 }, { tx: 455.09375, rx: 468.39375 }, { tx: 455.11875, rx: 468.41875 },
    { tx: 455.13125, rx: 468.43125 }, { tx: 455.19375, rx: 468.01875 }, { tx: 455.21875, rx: 468.49375 },
    { tx: 455.23125, rx: 468.50625 }, { tx: 455.28125, rx: 468.29375 }, { tx: 455.25625, rx: 468.19375 },
    { tx: 455.33125, rx: 468.34375 }, { tx: 455.38125, rx: 468.31875 }, { tx: 455.41875, rx: 468.45625 }
  ],
  457: [
    { tx: 457.25625, rx: 467.25625 }, { tx: 457.26875, rx: 467.26875 }, { tx: 457.28125, rx: 467.28125 },
    { tx: 457.29375, rx: 467.29375 }, { tx: 457.30625, rx: 467.30625 }, { tx: 457.31875, rx: 467.31875 },
    { tx: 457.33125, rx: 467.33125 }, { tx: 457.34375, rx: 467.34375 }, { tx: 457.35625, rx: 467.35625 },
    { tx: 457.36875, rx: 467.36875 }, { tx: 457.38125, rx: 467.38125 }, { tx: 457.39375, rx: 467.39375 },
    { tx: 457.40625, rx: 467.40625 }, { tx: 457.41875, rx: 467.41875 }, { tx: 457.43125, rx: 467.43125 },
    { tx: 457.44375, rx: 467.44375 }, { tx: 457.45625, rx: 467.45625 }, { tx: 457.46875, rx: 467.46875 }
  ]
};

export const UK_DUPLEX_PRESETS = [
  {
    id: 'uk_dedicated_457_467',
    name: 'UK Dedicated 457 / 467 MHz (18 Dedicated Pairs - Base TX Low)',
    category: 'UK_OFCOM',
    description: 'Standard UK Ofcom Talkback duplex pairing (+10.050 MHz split). Base stations transmit LOW (457 MHz), portable units transmit HIGH (467 MHz).',
    txMin: '457.25625',
    txMax: '457.46875',
    rxMin: '467.25625',
    rxMax: '467.53125',
    split: '+10.050',
    bw: '12.5',
    pairCount: '18',
    discreteBand: 457,
    duplexMode: 'BASE_LOW',
    pairs: DISCRETE_TALKBACK_PAIRS[457]
  },
  {
    id: 'uk_dedicated_455_468',
    name: 'UK Dedicated 455 / 468 MHz (13 Dedicated Pairs - Base TX Low)',
    category: 'UK_OFCOM',
    description: 'Official UK Ofcom dedicated OB & News talkback pairs (~13.35 MHz split). Base stations transmit LOW (455 MHz), portable hand units transmit HIGH (468 MHz).',
    txMin: '455.00625',
    txMax: '455.41875',
    rxMin: '468.01875',
    rxMax: '468.50625',
    split: '+13.350',
    bw: '12.5',
    pairCount: '13',
    discreteBand: 455,
    duplexMode: 'BASE_LOW',
    pairs: DISCRETE_TALKBACK_PAIRS[455]
  }
];

export const EU_DUPLEX_PRESETS = [
  {
    id: 'eu_dedicated_467_457',
    name: 'EU Standard 467 / 457 MHz (18 Dedicated Pairs - Base TX High)',
    category: 'EU_EUROPE',
    description: 'Mainland European standard talkback duplex pairing (-10.050 MHz split). Base stations transmit HIGH (467 MHz), portable units transmit LOW (457 MHz).',
    txMin: '467.25625',
    txMax: '467.46875',
    rxMin: '457.25625',
    rxMax: '457.53125',
    split: '-10.050',
    bw: '12.5',
    pairCount: '18',
    discreteBand: 467,
    duplexMode: 'BASE_HIGH',
    pairs: [
      { tx: 467.25625, rx: 457.25625 }, { tx: 467.26875, rx: 457.26875 }, { tx: 467.28125, rx: 457.28125 },
      { tx: 467.29375, rx: 457.29375 }, { tx: 467.30625, rx: 457.30625 }, { tx: 467.31875, rx: 457.31875 },
      { tx: 467.33125, rx: 457.33125 }, { tx: 467.34375, rx: 457.34375 }, { tx: 467.35625, rx: 457.35625 },
      { tx: 467.36875, rx: 457.36875 }, { tx: 467.38125, rx: 457.38125 }, { tx: 467.39375, rx: 457.39375 },
      { tx: 467.40625, rx: 457.40625 }, { tx: 467.41875, rx: 457.41875 }, { tx: 467.43125, rx: 457.43125 },
      { tx: 467.44375, rx: 457.44375 }, { tx: 467.45625, rx: 457.45625 }, { tx: 467.46875, rx: 457.46875 }
    ]
  },
  {
    id: 'eu_dedicated_468_455',
    name: 'EU Dedicated 468 / 455 MHz (13 Dedicated Pairs - Base TX High)',
    category: 'EU_EUROPE',
    description: 'Official European OB & News talkback duplex pairs (~13.35 MHz split). Base stations transmit HIGH (468 MHz), portable hand units transmit LOW (455 MHz).',
    txMin: '468.01875',
    txMax: '468.50625',
    rxMin: '455.00625',
    rxMax: '455.41875',
    split: '-13.350',
    bw: '12.5',
    pairCount: '13',
    discreteBand: 468,
    duplexMode: 'BASE_HIGH',
    pairs: [
      { tx: 468.38125, rx: 455.00625 },
      { tx: 468.05625, rx: 455.03125 }, { tx: 468.39375, rx: 455.09375 }, { tx: 468.41875, rx: 455.11875 },
      { tx: 468.43125, rx: 455.13125 }, { tx: 468.01875, rx: 455.19375 }, { tx: 468.49375, rx: 455.21875 },
      { tx: 468.50625, rx: 455.23125 }, { tx: 468.29375, rx: 455.28125 }, { tx: 468.19375, rx: 455.25625 },
      { tx: 468.34375, rx: 455.33125 }, { tx: 468.31875, rx: 455.38125 }, { tx: 468.45625, rx: 455.41875 }
    ]
  },
  {
    id: 'eu_standard_469_459',
    name: 'EU Standard 469 / 459 MHz (10 MHz Split - Base TX High)',
    category: 'EU_EUROPE',
    description: 'European CEPT/ETSI 10 MHz duplex allocation. Base stations transmit 469 MHz, portable receivers listen on 469 MHz / transmit on 459 MHz.',
    txMin: '469.01250',
    txMax: '469.98750',
    rxMin: '459.01250',
    rxMax: '459.98750',
    split: '-10.000',
    bw: '12.5',
    pairCount: '12',
    duplexMode: 'BASE_HIGH',
    pairs: [
      { tx: 469.01250, rx: 459.01250 }, { tx: 469.08750, rx: 459.08750 }, { tx: 469.16250, rx: 459.16250 },
      { tx: 469.23750, rx: 459.23750 }, { tx: 469.31250, rx: 459.31250 }, { tx: 469.38750, rx: 459.38750 },
      { tx: 469.46250, rx: 459.46250 }, { tx: 469.53750, rx: 459.53750 }, { tx: 469.61250, rx: 459.61250 },
      { tx: 469.68750, rx: 459.68750 }, { tx: 469.76250, rx: 459.76250 }, { tx: 469.83750, rx: 459.83750 }
    ]
  }
];

export interface CustomCarrierInput {
  id: string;
  tx: number;
  rx: number;
  label: string;
  type: 'DUPLEX' | 'BASE_TX' | 'WALKIE';
  txBw: number; // in MHz, default 0.0125 (12.5 kHz)
  rxBw: number;
  active: boolean;
  locked: boolean;
  duplexDirection?: 'BASE_LOW' | 'BASE_HIGH';
}

export interface CompatibilityConflict {
  type: 'Fundamental' | '2-Tone IMD' | '3-Tone IMD';
  carrierA: string;
  carrierB?: string;
  carrierC?: string;
  targetCarrier: string;
  productFreq: number;
  targetFreq: number;
  diffKhz: number;
  thresholdKhz: number;
}

interface Props {
  onApplyToPlan?: (carriers: { tx: number; rx: number; label: string; isSimplex: boolean; type?: string }[]) => void;
  onClose?: () => void;
}

export const DedicatedSpectrumAnalyzerScreen: React.FC<Props> = ({
  onApplyToPlan,
  onClose
}) => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isLandscape = windowWidth > windowHeight;

  // ----------------------------------------------------
  // 1. CARRIER POOL (User entered or preset)
  // ----------------------------------------------------
  const [carriers, setCarriers] = useState<CustomCarrierInput[]>([]);

  // Regulatory Region Mode (GB UK vs EU Europe)
  const [regulatoryRegion, setRegulatoryRegion] = useState<'GB_UK' | 'EU_EUROPE'>('GB_UK');

  // Step size state for channel ledger nudge (in kHz)
  const [ledgerStepKhz, setLedgerStepKhz] = useState<number>(12.5);

  // Duplex direction
  const [newDuplexDirection, setNewDuplexDirection] = useState<'BASE_LOW' | 'BASE_HIGH'>('BASE_LOW');

  // Keypad Target Types & Selection
  type KeypadTarget =
    | 'center_freq'
    | 'center_step'
    | 'span_zoom'
    | 'span_step'
    | 'kp_base_tx'
    | 'kp_port_tx'
    | 'kp_duplex_bw'
    | 'kp_simplex_base_tx'
    | 'kp_simplex_base_bw'
    | 'kp_walkie_tx'
    | 'kp_walkie_bw';

  const [activeKeypadTarget, setActiveKeypadTarget] = useState<KeypadTarget>('kp_base_tx');

  // Keypad Direct Frequency Entry Values
  const [kpBaseTx, setKpBaseTx] = useState<string>('455.50000');
  const [kpPortTx, setKpPortTx] = useState<string>('468.50000');
  const [kpDuplexBw, setKpDuplexBw] = useState<string>('12.5');

  const [kpSimplexBaseTx, setKpSimplexBaseTx] = useState<string>('453.02500');
  const [kpSimplexBaseBw, setKpSimplexBaseBw] = useState<string>('12.5');

  const [kpWalkieTx, setKpWalkieTx] = useState<string>('456.00000');
  const [kpWalkieBw, setKpWalkieBw] = useState<string>('12.5');

  // Free-form batch paste input
  const [batchInputText, setBatchInputText] = useState<string>('');
  const [showBatchBox, setShowBatchBox] = useState<boolean>(false);

  // ================= PRESETS STATE & BESPOKE STORAGE =================
  const [presetModalVisible, setPresetModalVisible] = useState<boolean>(false);
  const [presetTab, setPresetTab] = useState<'UK_OFCOM' | 'EU_EUROPE' | 'BESPOKE'>('UK_OFCOM');
  const [bespokeDuplexPresets, setBespokeDuplexPresets] = useState<any[]>([]);
  const [newBespokeName, setNewBespokeName] = useState<string>('');

  // Handle switching regulatory mode (UK Base Low <-> EU Base High)
  const handleToggleRegulatoryRegion = (region: 'GB_UK' | 'EU_EUROPE') => {
    setRegulatoryRegion(region);
    setNewDuplexDirection(region === 'EU_EUROPE' ? 'BASE_HIGH' : 'BASE_LOW');
  };

  // Invert / Swap all loaded duplex carriers (Base Low <-> Base High)
  const handleInvertAllCarriers = () => {
    const hasDuplex = carriers.some(c => c.type === 'DUPLEX' && c.rx > 0);
    if (!hasDuplex) {
      Alert.alert('No Duplex Channels', 'Add duplex channels first to swap Base TX and Portable RX frequencies.');
      return;
    }
    setCarriers(prev => prev.map(c => {
      if (c.type !== 'DUPLEX' || !c.rx) return c;
      const newDir: 'BASE_LOW' | 'BASE_HIGH' = c.tx < c.rx ? 'BASE_HIGH' : 'BASE_LOW';
      return {
        ...c,
        tx: c.rx,
        rx: c.tx,
        duplexDirection: newDir
      };
    }));
    setStatusMsg('⇄ Swapped TX and RX on all duplex channels!');
  };

  // Invert single carrier
  const handleSwapSingleCarrier = (id: string) => {
    setCarriers(prev => prev.map(c => {
      if (c.id !== id || c.type !== 'DUPLEX' || !c.rx) return c;
      const newDir: 'BASE_LOW' | 'BASE_HIGH' = c.tx < c.rx ? 'BASE_HIGH' : 'BASE_LOW';
      return {
        ...c,
        tx: c.rx,
        rx: c.tx,
        duplexDirection: newDir
      };
    }));
  };

  // Complete Reset / Clear all carriers from the spectrum analyzer
  const handleClearAllCarriers = () => {
    if (carriers.length === 0) {
      setStatusMsg('ℹ️ Carrier ledger is already empty.');
      return;
    }
    setCarriers([]);
    setMarker1(null);
    setMarker2(null);
    setBatchInputText('');
    setStatusMsg('✓ Cleared all spectrum carriers. Ready for new entries or presets.');
  };

  const loadBespokePresets = async () => {
    try {
      const raw = await AsyncStorage.getItem('rf_bespoke_duplex_presets');
      if (raw) {
        setBespokeDuplexPresets(JSON.parse(raw));
      }
    } catch (e) {
      console.log('Error loading bespoke presets:', e);
    }
  };

  useEffect(() => {
    loadBespokePresets();
  }, []);

  const isDuplexPairSelected = (tx: number, rx: number) => {
    return carriers.some(c => 
      c.active && 
      Math.abs(c.tx - tx) < 0.0001 && 
      (c.type !== 'DUPLEX' || Math.abs(c.rx - rx) < 0.0001)
    );
  };

  const toggleDuplexPair = (p: { tx: number; rx: number }, presetName: string, pairIndex?: number) => {
    const existsIdx = carriers.findIndex(c => 
      Math.abs(c.tx - p.tx) < 0.0001 && 
      (c.type !== 'DUPLEX' || Math.abs(c.rx - p.rx) < 0.0001)
    );
    if (existsIdx >= 0) {
      setCarriers(prev => prev.filter((_, idx) => idx !== existsIdx));
    } else {
      const labelNum = pairIndex !== undefined ? pairIndex + 1 : carriers.length + 1;
      const shortPreset = presetName.includes('457') ? '457' : (presetName.includes('455') ? '455' : 'DPX');
      const newCarrier: CustomCarrierInput = {
        id: `carrier_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        label: `CH ${labelNum} (${shortPreset})`,
        tx: p.tx,
        rx: p.rx,
        txBw: 0.0125,
        rxBw: 0.0125,
        type: 'DUPLEX',
        active: true,
        locked: false
      };
      setCarriers(prev => [...prev, newCarrier]);

      // Ensure view includes this pair
      const minF = Math.min(p.tx, p.rx);
      const maxF = Math.max(p.tx, p.rx);
      if (span < (maxF - minF) + 2.0 || centerFreq < minF - 1 || centerFreq > maxF + 1) {
        const newCenter = Number(((minF + maxF) / 2).toFixed(5));
        const newSpan = Math.max(span, Math.min(24.0, Number(((maxF - minF) + 3.0).toFixed(2))));
        setCenterFreq(newCenter);
        setCenterFreqInput(newCenter.toFixed(5));
        setSpan(newSpan);
        setSpanInput(newSpan.toFixed(2));
      }
    }
  };

  const addAllPresetPairs = (preset: any) => {
    if (!preset.pairs || preset.pairs.length === 0) return;
    const newItems: CustomCarrierInput[] = [];
    const shortPreset = preset.name.includes('457') ? '457' : (preset.name.includes('455') ? '455' : 'DPX');
    
    preset.pairs.forEach((p: { tx: number; rx: number }, idx: number) => {
      const alreadyExists = carriers.some(c => 
        Math.abs(c.tx - p.tx) < 0.0001 && 
        (c.type !== 'DUPLEX' || Math.abs(c.rx - p.rx) < 0.0001)
      ) || newItems.some(c => Math.abs(c.tx - p.tx) < 0.0001);
      if (!alreadyExists) {
        newItems.push({
          id: `carrier_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 4)}`,
          label: `CH ${idx + 1} (${shortPreset})`,
          tx: p.tx,
          rx: p.rx,
          txBw: 0.0125,
          rxBw: 0.0125,
          type: 'DUPLEX',
          active: true,
          locked: false
        });
      }
    });

    if (newItems.length > 0) {
      setCarriers(prev => [...prev, ...newItems]);
      const allTx = [...carriers, ...newItems].filter(c => c.active).map(c => c.tx);
      const allRx = [...carriers, ...newItems].filter(c => c.active && c.type === 'DUPLEX').map(c => c.rx);
      const all = [...allTx, ...allRx];
      if (all.length > 0) {
        const minF = Math.min(...all);
        const maxF = Math.max(...all);
        const newCenter = Number(((minF + maxF) / 2).toFixed(5));
        const newSpan = Math.max(18.0, Number(((maxF - minF) + 3.0).toFixed(2)));
        setCenterFreq(newCenter);
        setCenterFreqInput(newCenter.toFixed(5));
        setSpan(newSpan);
        setSpanInput(newSpan.toFixed(2));
      }
    }
  };

  const saveCurrentAsBespokePreset = async () => {
    const trimmed = (newBespokeName || '').trim();
    if (!trimmed) {
      Alert.alert('Missing Name', 'Please enter a name for your custom bespoke preset.');
      return;
    }
    const activePairs = carriers
      .filter(c => c.active && c.type === 'DUPLEX' && c.tx > 0 && c.rx > 0)
      .map(c => ({ tx: c.tx, rx: c.rx }));
    
    if (activePairs.length === 0) {
      Alert.alert('No Duplex Pairs', 'You must have at least one active duplex pair in the spectrum to save as a preset.');
      return;
    }

    const txs = activePairs.map(p => p.tx);
    const rxs = activePairs.map(p => p.rx);
    const txMin = Math.min(...txs).toFixed(5);
    const txMax = Math.max(...txs).toFixed(5);
    const rxMin = Math.min(...rxs).toFixed(5);
    const rxMax = Math.max(...rxs).toFixed(5);
    const avgSplit = (activePairs.reduce((acc, p) => acc + (p.rx - p.tx), 0) / activePairs.length).toFixed(3);

    const newPreset = {
      id: `bespoke_dup_${Date.now()}`,
      name: trimmed,
      category: 'BESPOKE',
      description: `Custom Split (${avgSplit} MHz), Base: ${txMin}-${txMax} MHz, Port: ${rxMin}-${rxMax} MHz (${activePairs.length} pairs)`,
      txMin,
      txMax,
      rxMin,
      rxMax,
      split: avgSplit.startsWith('-') ? avgSplit : `+${avgSplit}`,
      bw: '12.5',
      pairCount: String(activePairs.length),
      pairs: activePairs
    };

    const updated = [newPreset, ...bespokeDuplexPresets];
    setBespokeDuplexPresets(updated);
    await AsyncStorage.setItem('rf_bespoke_duplex_presets', JSON.stringify(updated));
    setNewBespokeName('');
    setPresetTab('BESPOKE');
    setStatusMsg(`Saved bespoke preset "${trimmed}"!`);
  };

  const deleteBespokePreset = async (presetId: string) => {
    const updated = bespokeDuplexPresets.filter(p => p.id !== presetId);
    setBespokeDuplexPresets(updated);
    await AsyncStorage.setItem('rf_bespoke_duplex_presets', JSON.stringify(updated));
    setStatusMsg('Deleted bespoke preset.');
  };

  // ----------------------------------------------------
  // 2. DISPLAY & SPECTRAL WINDOW CONTROLS
  // ----------------------------------------------------
  const [centerFreq, setCenterFreq] = useState<number>(461.50000);
  const [centerFreqInput, setCenterFreqInput] = useState<string>('461.50000');
  const [centerStepMhz, setCenterStepMhz] = useState<number>(0.100);
  const [centerStepInput, setCenterStepInput] = useState<string>('0.100');

  const [span, setSpan] = useState<number>(20.0);
  const [spanInput, setSpanInput] = useState<string>('20.0');
  const [spanStepMhz, setSpanStepMhz] = useState<number>(2.0);
  const [spanStepInput, setSpanStepInput] = useState<string>('2.0');

  // Toggle visualization layers
  const [showTwoTone, setShowTwoTone] = useState<boolean>(true);
  const [showThreeTone, setShowThreeTone] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [fillSpikes, setFillSpikes] = useState<boolean>(true);
  const [traceMode, setTraceMode] = useState<'LIVE' | 'MAX_HOLD'>('LIVE');

  // UK Exclusions toggle state
  const [ukExclusionsEnabled, setUkExclusionsEnabledState] = useState<boolean>(getUkExclusionsEnabled());

  useEffect(() => {
    return subscribeUkExclusions((enabled) => {
      setUkExclusionsEnabledState(enabled);
    });
  }, []);

  const toggleUkExclusions = () => {
    const next = !ukExclusionsEnabled;
    setUkExclusionsEnabledState(next);
    setUkExclusionsEnabled(next);
    setStatusMsg(next ? 'UK Exclusions Enabled: Regulatory keep-out zones & exclusion rules active.' : 'UK Exclusions Disabled: All spectrum available.');
  };

  // Markers & Delta state
  const [isDeltaMode, setIsDeltaMode] = useState<boolean>(false);
  const [marker1, setMarker1] = useState<number | null>(null);
  const [marker2, setMarker2] = useState<number | null>(null);
  const [deltaStep, setDeltaStep] = useState<1 | 2>(1);

  // Max Hold peaks
  const [maxHoldPeaks, setMaxHoldPeaks] = useState<{ freq: number; dbm: number }[]>([]);

  // Calculation / Audit state
  const [hasAudited, setHasAudited] = useState<boolean>(false);
  const [conflicts, setConflicts] = useState<CompatibilityConflict[]>([]);
  const [isAutoCalculating, setIsAutoCalculating] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>('Ready - Clean spectrum. Enter custom frequencies or load from Presets.');

  // SVG Dimensioning
  const [canvasWidth, setCanvasWidth] = useState<number>(330);
  const CANVAS_HEIGHT = 200;
  const TOP_MARGIN = 22;
  const BOTTOM_MARGIN = 26;
  const PLOT_HEIGHT = CANVAS_HEIGHT - TOP_MARGIN - BOTTOM_MARGIN;
  const NOISE_FLOOR_DBM = -100;
  const REF_LEVEL_DBM = 0;

  const startFreq = centerFreq - span / 2;
  const stopFreq = centerFreq + span / 2;

  const freqToX = (f: number) => {
    if (span <= 0) return 0;
    return ((f - startFreq) / span) * canvasWidth;
  };

  const dbmToY = (dbm: number) => {
    const clamped = Math.max(NOISE_FLOOR_DBM, Math.min(REF_LEVEL_DBM, dbm));
    const ratio = (clamped - NOISE_FLOOR_DBM) / (REF_LEVEL_DBM - NOISE_FLOOR_DBM);
    return TOP_MARGIN + PLOT_HEIGHT * (1 - ratio);
  };

  // ----------------------------------------------------
  // 3. MATHEMATICS ENGINE (FROM TALKBACK SUITE)
  // ----------------------------------------------------
  // Formulas:
  // Fundamental guard band: 18.75 kHz (0.01875 MHz)
  // 3rd Order IMD avoidance window: 12.0 kHz (0.0120 MHz) - <12.0 kHz is clash, >=12.5 kHz adjacent channel is clear
  // 2-TX 3rd order: 2*f1 - f2
  // 3-TX 3rd order: f1 + f2 - f3
  const FUNDAMENTAL_GUARD_MHZ = 0.01875;
  const IMD_GUARD_MHZ = 0.0120;

  // Active radiating transmitters (TX frequencies)
  const activeTxList = useMemo(() => {
    return carriers
      .filter(c => c.active && c.tx > 0)
      .map(c => ({
        id: c.id,
        label: `${c.label} TX`,
        freq: Number(c.tx.toFixed(5)),
        type: c.type,
        bw: c.txBw
      }));
  }, [carriers]);

  // Active receiver frequencies (RX frequencies that need protection)
  const activeRxList = useMemo(() => {
    return carriers
      .filter(c => c.active && c.type === 'DUPLEX' && c.rx > 0)
      .map(c => ({
        id: c.id,
        label: `${c.label} RX`,
        freq: Number(c.rx.toFixed(5)),
        type: c.type,
        bw: c.rxBw
      }));
  }, [carriers]);

  // Calculate all 2-Tone & 3-Tone Intermodulation Products
  const intermodProducts = useMemo(() => {
    const list: { freq: number; type: '2-Tone' | '3-Tone'; formula: string; sources: string[]; clashWith?: string }[] = [];
    const txs = activeTxList;
    const n = txs.length;
    if (n < 2) return list;

    // 2-Tone IMDs: 2*fA - fB
    if (showTwoTone) {
      for (let a = 0; a < n; a++) {
        for (let b = 0; b < n; b++) {
          if (a === b) continue;
          const fA = txs[a].freq;
          const fB = txs[b].freq;
          const imd = Math.round((2 * fA - fB) * 100000) / 100000;
          if (imd >= startFreq - 2 && imd <= stopFreq + 2) {
            list.push({
              freq: imd,
              type: '2-Tone',
              formula: `2*(${fA.toFixed(5)}) - ${fB.toFixed(5)}`,
              sources: [txs[a].label, txs[b].label]
            });
          }
        }
      }
    }

    // 3-Tone IMDs: fA + fB - fC
    if (showThreeTone && n >= 3) {
      for (let a = 0; a < n; a++) {
        for (let b = a + 1; b < n; b++) {
          for (let c = 0; c < n; c++) {
            if (c === a || c === b) continue;
            const fA = txs[a].freq;
            const fB = txs[b].freq;
            const fC = txs[c].freq;
            const imd = Math.round((fA + fB - fC) * 100000) / 100000;
            if (imd >= startFreq - 2 && imd <= stopFreq + 2) {
              list.push({
                freq: imd,
                type: '3-Tone',
                formula: `${fA.toFixed(5)} + ${fB.toFixed(5)} - ${fC.toFixed(5)}`,
                sources: [txs[a].label, txs[b].label, txs[c].label]
              });
            }
          }
        }
      }
    }

    return list;
  }, [activeTxList, showTwoTone, showThreeTone, startFreq, stopFreq]);

  // Run full conflict audit against fundamental, desense, and IMDs
  const runSpectralAudit = () => {
    const foundConflicts: CompatibilityConflict[] = [];

    // All active carriers that require protection
    const allProtected = [
      ...activeTxList.map(t => ({ label: t.label, freq: t.freq, isRx: false, id: t.id })),
      ...activeRxList.map(r => ({ label: r.label, freq: r.freq, isRx: true, id: r.id }))
    ];

    // 0. Mixed Venue Desense Check: High-power Base TX transmitting directly on or close to a sensitive Portable RX
    activeTxList.forEach(tx => {
      activeRxList.forEach(rx => {
        const delta = Math.abs(tx.freq - rx.freq);
        if (delta < 0.050) { // Within 50 kHz
          foundConflicts.push({
            type: 'Fundamental',
            carrierA: tx.label,
            carrierB: rx.label,
            targetCarrier: `🚨 DESENSE COLLISION: ${tx.label} (Base TX) vs ${rx.label} (Port RX)`,
            productFreq: tx.freq,
            targetFreq: rx.freq,
            diffKhz: delta * 1000,
            thresholdKhz: 50
          });
        }
      });
    });

    // 1. Fundamental spacing check (must have at least 18.75 kHz guard)
    for (let i = 0; i < allProtected.length; i++) {
      for (let j = i + 1; j < allProtected.length; j++) {
        const c1 = allProtected[i];
        const c2 = allProtected[j];
        if (c1.id === c2.id) continue; // skip same channel TX vs RX
        const diffHz = Math.round(Math.abs(c1.freq - c2.freq) * 1000000);
        if (diffHz < 18700) {
          foundConflicts.push({
            type: 'Fundamental',
            carrierA: c1.label,
            carrierB: c2.label,
            targetCarrier: `${c1.label} ↔ ${c2.label}`,
            productFreq: c1.freq,
            targetFreq: c2.freq,
            diffKhz: diffHz / 1000,
            thresholdKhz: 18.75
          });
        }
      }
    }

    // 2. Intermod collision check (IMDs landing on any protected carrier within channel passband < 12.0 kHz)
    // On a 12.5 kHz raster, products landing on adjacent channels (>= 12.5 kHz / 12500 Hz) are clean and not clashing.
    intermodProducts.forEach(imd => {
      allProtected.forEach(target => {
        const diffHz = Math.round(Math.abs(imd.freq - target.freq) * 1000000);
        if (diffHz < 12000) {
          foundConflicts.push({
            type: imd.type === '2-Tone' ? '2-Tone IMD' : '3-Tone IMD',
            carrierA: imd.sources[0] || 'TX',
            carrierB: imd.sources[1] || 'TX',
            carrierC: imd.sources[2],
            targetCarrier: target.label,
            productFreq: imd.freq,
            targetFreq: target.freq,
            diffKhz: diffHz / 1000,
            thresholdKhz: 12.0
          });
        }
      });
    });

    setConflicts(foundConflicts);
    setHasAudited(true);
    setStatusMsg(foundConflicts.length === 0 ? '✓ ALL FREQUENCIES CLEAN & COMPATIBLE' : `⚠️ ${foundConflicts.length} CONFLICTS DETECTED`);
  };

  // Run audit whenever carrier list changes
  React.useEffect(() => {
    runSpectralAudit();
  }, [carriers, intermodProducts.length]);

  // ----------------------------------------------------
  // 4. COMPATIBLE SET CALCULATOR / SOLVER
  // ----------------------------------------------------
  const handleCalculateCompatibleSet = () => {
    setIsAutoCalculating(true);
    setStatusMsg('Calculating intermod-clean frequencies (2-tone & 3-tone)...');

    setTimeout(() => {
      // Step through unlocked frequencies and adjust by raster steps until collision-free
      const lockedCarriers = carriers.filter(c => c.locked);
      const unlockedCarriers = carriers.filter(c => !c.locked);

      // Raster step: use active ledger step (12.5 kHz or 25 kHz)
      const RASTER_MHZ = ledgerStepKhz ? ledgerStepKhz / 1000 : 0.0125;
      const adjusted: CustomCarrierInput[] = [...lockedCarriers];

      unlockedCarriers.forEach(cand => {
        let bestTx = cand.tx;
        let bestRx = cand.rx;
        let isFound = false;

        // Try candidate offsets (+0, +12.5k, -12.5k, +25k, -25k... up to ±1.5MHz / 120 steps)
        const offsets = [0];
        for (let step = 1; step <= 120; step++) {
          offsets.push(step * RASTER_MHZ);
          offsets.push(-step * RASTER_MHZ);
        }

        for (const off of offsets) {
          const testTx = Math.round((cand.tx + off) * 100000) / 100000;
          const testRx = cand.type === 'DUPLEX' && cand.rx > 0 ? Math.round((cand.rx + off) * 100000) / 100000 : 0;

          // 0. Regulatory Restricted Frequencies Check
          if (testTx > 0 && isFrequencyRestricted(testTx).isRestricted) continue;
          if (testRx > 0 && isFrequencyRestricted(testRx).isRestricted) continue;

          const testCandidate: CustomCarrierInput = { ...cand, tx: testTx, rx: testRx };
          const allCurrent = [...adjusted, testCandidate];

          // Collect all active protected frequencies (both TX and RX)
          const allFreqs: { id: string; freq: number }[] = [];
          allCurrent.forEach(c => {
            if (c.active && c.tx > 0) allFreqs.push({ id: c.id, freq: c.tx });
            if (c.active && c.type === 'DUPLEX' && c.rx > 0) allFreqs.push({ id: c.id, freq: c.rx });
          });

          // 1. Fundamental spacing check (must have >= 18.75 kHz spacing)
          let clash = false;
          for (let i = 0; i < allFreqs.length; i++) {
            for (let j = i + 1; j < allFreqs.length; j++) {
              if (allFreqs[i].id === allFreqs[j].id) continue; // Same duplex channel TX vs RX
              const diffHz = Math.round(Math.abs(allFreqs[i].freq - allFreqs[j].freq) * 1000000);
              if (diffHz < 18700) {
                clash = true;
                break;
              }
            }
            if (clash) break;
          }
          if (clash) continue;

          // 2. 2-Tone IMD check: 2*fA - fB (< 12.0 kHz is clash, >= 12.5 kHz adjacent raster is clear)
          const txList = allCurrent.filter(c => c.active && c.tx > 0).map(c => c.tx);
          const nTx = txList.length;
          if (nTx >= 2) {
            for (let a = 0; a < nTx; a++) {
              for (let b = 0; b < nTx; b++) {
                if (a === b) continue;
                const imd2 = Math.round((2 * txList[a] - txList[b]) * 100000) / 100000;
                for (const target of allFreqs) {
                  const diffHz = Math.round(Math.abs(imd2 - target.freq) * 1000000);
                  if (diffHz < 12000) {
                    clash = true;
                    break;
                  }
                }
                if (clash) break;
              }
              if (clash) break;
            }
          }
          if (clash) continue;

          // 3. 3-Tone IMD check: fA + fB - fC (< 12.0 kHz is clash, >= 12.5 kHz adjacent raster is clear)
          if (nTx >= 3) {
            for (let a = 0; a < nTx; a++) {
              for (let b = a + 1; b < nTx; b++) {
                for (let c = 0; c < nTx; c++) {
                  if (c === a || c === b) continue;
                  const imd3 = Math.round((txList[a] + txList[b] - txList[c]) * 100000) / 100000;
                  for (const target of allFreqs) {
                    const diffHz = Math.round(Math.abs(imd3 - target.freq) * 1000000);
                    if (diffHz < 12000) {
                      clash = true;
                      break;
                    }
                  }
                  if (clash) break;
                }
                if (clash) break;
              }
              if (clash) break;
            }
          }
          if (clash) continue;

          // Found clean frequency!
          bestTx = testTx;
          bestRx = testRx;
          isFound = true;
          break;
        }

        adjusted.push({
          ...cand,
          tx: bestTx,
          rx: bestRx
        });
      });

      // Preserve original carrier order in the list
      const finalCarriers = carriers.map(c => {
        const found = adjusted.find(a => a.id === c.id);
        return found || c;
      });

      setCarriers(finalCarriers);
      setIsAutoCalculating(false);
      setStatusMsg('✓ Calculated compatible talkback frequencies (clean of all 2-tone & 3-tone IMDs)!');
    }, 150);
  };

  // ----------------------------------------------------
  // 5. STEP CONTROLS (LEFT / RIGHT / STEP SIZE BOXES)
  // ----------------------------------------------------
  const handleCenterStep = (dir: -1 | 1) => {
    const nextVal = Math.round((centerFreq + dir * centerStepMhz) * 100000) / 100000;
    setCenterFreq(nextVal);
    setCenterFreqInput(nextVal.toFixed(5));
  };

  const handleCenterStepInputCommit = () => {
    const parsed = parseFloat(centerStepInput);
    if (!isNaN(parsed) && parsed > 0) {
      setCenterStepMhz(parsed);
    } else {
      setCenterStepInput(centerStepMhz.toFixed(3));
    }
  };

  const handleCenterFreqInputCommit = () => {
    const parsed = parseFloat(centerFreqInput);
    if (!isNaN(parsed) && parsed > 10) {
      setCenterFreq(parsed);
    } else {
      setCenterFreqInput(centerFreq.toFixed(5));
    }
  };

  const handleSpanStep = (dir: -1 | 1) => {
    const nextVal = Math.max(0.2, Math.round((span + dir * spanStepMhz) * 100) / 100);
    setSpan(nextVal);
    setSpanInput(nextVal.toFixed(2));
  };

  const handleSpanStepInputCommit = () => {
    const parsed = parseFloat(spanStepInput);
    if (!isNaN(parsed) && parsed > 0) {
      setSpanStepMhz(parsed);
    } else {
      setSpanStepInput(spanStepMhz.toFixed(2));
    }
  };

  const handleSpanInputCommit = () => {
    const parsed = parseFloat(spanInput);
    if (!isNaN(parsed) && parsed >= 0.2) {
      setSpan(parsed);
    } else {
      setSpanInput(span.toFixed(2));
    }
  };

  // ----------------------------------------------------
  // KEYPAD DISPATCHER & DIRECT FREQUENCY ACTIONS
  // ----------------------------------------------------
  const getTargetLabel = (target: KeypadTarget): string => {
    switch (target) {
      case 'center_freq': return 'Center Freq';
      case 'center_step': return 'Center Step';
      case 'span_zoom': return 'Span Zoom';
      case 'span_step': return 'Span Step';
      case 'kp_base_tx': return 'Base TX';
      case 'kp_port_tx': return 'Port TX';
      case 'kp_duplex_bw': return 'Duplex BW';
      case 'kp_simplex_base_tx': return 'Simplex Base';
      case 'kp_simplex_base_bw': return 'Base BW';
      case 'kp_walkie_tx': return 'Walkie Freq';
      case 'kp_walkie_bw': return 'Walkie BW';
      default: return 'Base TX';
    }
  };

  const getTargetCurrentVal = (target: KeypadTarget): string => {
    switch (target) {
      case 'center_freq': return centerFreqInput;
      case 'center_step': return centerStepInput;
      case 'span_zoom': return spanInput;
      case 'span_step': return spanStepInput;
      case 'kp_base_tx': return kpBaseTx;
      case 'kp_port_tx': return kpPortTx;
      case 'kp_duplex_bw': return kpDuplexBw;
      case 'kp_simplex_base_tx': return kpSimplexBaseTx;
      case 'kp_simplex_base_bw': return kpSimplexBaseBw;
      case 'kp_walkie_tx': return kpWalkieTx;
      case 'kp_walkie_bw': return kpWalkieBw;
    }
  };

  const getDedicatedTargetUnit = (target: KeypadTarget): string => {
    switch (target) {
      case 'center_freq':
      case 'center_step':
      case 'span_zoom':
      case 'span_step':
      case 'kp_base_tx':
      case 'kp_port_tx':
      case 'kp_simplex_base_tx':
      case 'kp_walkie_tx':
        return 'MHz';
      case 'kp_duplex_bw':
      case 'kp_simplex_base_bw':
      case 'kp_walkie_bw':
        return 'kHz';
      default:
        return 'MHz';
    }
  };

  const getDedicatedTargetColor = (target: KeypadTarget): string => {
    switch (target) {
      case 'center_freq':
      case 'span_zoom':
      case 'kp_base_tx':
        return '#38bdf8';
      case 'center_step':
      case 'span_step':
        return '#94a3b8';
      case 'kp_port_tx':
      case 'kp_simplex_base_tx':
        return '#34d399';
      case 'kp_duplex_bw':
      case 'kp_simplex_base_bw':
      case 'kp_walkie_bw':
        return '#fb923c';
      case 'kp_walkie_tx':
        return '#a78bfa';
      default:
        return '#38bdf8';
    }
  };

  const updateDedicatedTargetVal = (target: KeypadTarget, newVal: string) => {
    switch (target) {
      case 'center_freq':
        setCenterFreqInput(newVal);
        const cfNum = parseFloat(newVal);
        if (!isNaN(cfNum) && cfNum >= 10 && cfNum <= 1500) setCenterFreq(cfNum);
        break;
      case 'center_step':
        setCenterStepInput(newVal);
        const csNum = parseFloat(newVal);
        if (!isNaN(csNum) && csNum > 0 && csNum <= 50) setCenterStep(csNum);
        break;
      case 'span_zoom':
        setSpanInput(newVal);
        const spNum = parseFloat(newVal);
        if (!isNaN(spNum) && spNum >= 0.1 && spNum <= 250) setSpan(spNum);
        break;
      case 'span_step':
        setSpanStepInput(newVal);
        const ssNum = parseFloat(newVal);
        if (!isNaN(ssNum) && ssNum > 0 && ssNum <= 100) setSpanStep(ssNum);
        break;
      case 'kp_base_tx': setKpBaseTx(newVal); break;
      case 'kp_port_tx': setKpPortTx(newVal); break;
      case 'kp_duplex_bw': setKpDuplexBw(newVal); break;
      case 'kp_simplex_base_tx': setKpSimplexBaseTx(newVal); break;
      case 'kp_simplex_base_bw': setKpSimplexBaseBw(newVal); break;
      case 'kp_walkie_tx': setKpWalkieTx(newVal); break;
      case 'kp_walkie_bw': setKpWalkieBw(newVal); break;
    }
  };

  const handleDedicatedReplicaStep = (dir: -1 | 1) => {
    const target = activeKeypadTarget || 'kp_base_tx';
    if (target === 'center_freq') {
      handleCenterFreqStep(dir);
      return;
    }
    if (target === 'center_step') {
      handleCenterStepDelta(dir);
      return;
    }
    if (target === 'span_zoom') {
      handleSpanStep(dir);
      return;
    }
    if (target === 'span_step') {
      handleSpanStepDelta(dir);
      return;
    }
    const curStr = getTargetCurrentVal(target);
    const curNum = parseFloat(curStr);
    if (isNaN(curNum)) return;
    let step = 0.0125;
    if (target === 'kp_duplex_bw' || target === 'kp_simplex_base_bw' || target === 'kp_walkie_bw') {
      step = 12.5;
    }
    const newNum = Math.max(0, curNum + dir * step);
    const formatted = (step === 12.5 ? newNum.toFixed(1) : newNum.toFixed(5));
    updateDedicatedTargetVal(target, formatted);
  };

  const handleKeypadPress = (key: string) => {
    const target = activeKeypadTarget || 'kp_base_tx';
    if (!activeKeypadTarget) setActiveKeypadTarget('kp_base_tx');

    const cur = getTargetCurrentVal(target);

    if (key === 'BACKSPACE') {
      updateDedicatedTargetVal(target, cur.length > 0 ? cur.slice(0, -1) : '');
      return;
    }

    if (key === 'CLEAR') {
      updateDedicatedTargetVal(target, '');
      return;
    }

    if (key === '.') {
      if (!cur.includes('.')) {
        updateDedicatedTargetVal(target, cur === '' ? '0.' : cur + '.');
      }
      return;
    }

    if (key === 'ENTER') {
      handleKeypadCommit();
      return;
    }

    // Digits 0-9 (prevent overflowing input boxes)
    if (cur.length < 12) {
      updateDedicatedTargetVal(target, cur + key);
    }
  };

  const handleKeypadCommit = () => {
    switch (activeKeypadTarget) {
      case 'center_freq':
        handleCenterFreqInputCommit();
        break;
      case 'center_step':
        handleCenterStepInputCommit();
        break;
      case 'span_zoom':
        handleSpanInputCommit();
        break;
      case 'span_step':
        handleSpanStepInputCommit();
        break;
      case 'kp_base_tx':
        if (kpPortTx) {
          handleAddDuplexFromKeypad();
        } else {
          setActiveKeypadTarget('kp_port_tx');
        }
        break;
      case 'kp_port_tx':
      case 'kp_duplex_bw':
        handleAddDuplexFromKeypad();
        break;
      case 'kp_simplex_base_tx':
      case 'kp_simplex_base_bw':
        handleAddSimplexBaseFromKeypad();
        break;
      case 'kp_walkie_tx':
      case 'kp_walkie_bw':
        handleAddWalkieFromKeypad();
        break;
    }
  };

  const handleAddDuplexFromKeypad = () => {
    const txVal = parseFloat(kpBaseTx);
    let rxVal = parseFloat(kpPortTx);
    if (isNaN(txVal) || txVal < 100 || txVal > 990) {
      Alert.alert('Invalid Base TX', 'Please enter a valid Base TX frequency (e.g. 455.50000 MHz).');
      return;
    }
    if (isNaN(rxVal) || rxVal <= 0) {
      const defaultOffset = (regulatoryRegion === 'EU_EUROPE') ? -13.350 : 13.350;
      rxVal = txVal + defaultOffset;
    }

    const txCheck = isFrequencyRestricted(txVal);
    if (txCheck.isRestricted) {
      Alert.alert('Restricted Frequency', `⛔ ${txCheck.reason}\n\nThis frequency is restricted and cannot be added.`);
      return;
    }
    const rxCheck = isFrequencyRestricted(rxVal);
    if (rxCheck.isRestricted) {
      Alert.alert('Restricted Frequency', `⛔ ${rxCheck.reason}\n\nThis frequency is restricted and cannot be added.`);
      return;
    }

    const bwVal = parseFloat(kpDuplexBw) || 12.5;
    const bwMhz = bwVal / 1000;

    const newCarrier: CustomCarrierInput = {
      id: `custom_dpx_${Date.now()}`,
      label: `CH ${carriers.length + 1} (DPX)`,
      tx: Number(txVal.toFixed(5)),
      rx: Number(rxVal.toFixed(5)),
      txBw: bwMhz,
      rxBw: bwMhz,
      type: 'DUPLEX',
      active: true,
      locked: false
    };

    setCarriers(prev => [...prev, newCarrier]);
    setCenterFreq(txVal);
    setCenterFreqInput(txVal.toFixed(5));
    setStatusMsg(`✓ Added Duplex Pair: Base ${newCarrier.tx.toFixed(5)} MHz / Port ${newCarrier.rx.toFixed(5)} MHz (BW: ${bwVal} kHz)`);
  };

  const handleAddSimplexBaseFromKeypad = () => {
    const txVal = parseFloat(kpSimplexBaseTx);
    if (isNaN(txVal) || txVal < 100 || txVal > 990) {
      Alert.alert('Invalid Simplex Base TX', 'Please enter a valid Base TX frequency (e.g. 453.02500 MHz).');
      return;
    }

    const txCheck = isFrequencyRestricted(txVal);
    if (txCheck.isRestricted) {
      Alert.alert('Restricted Frequency', `⛔ ${txCheck.reason}\n\nThis frequency is restricted and cannot be added.`);
      return;
    }

    const bwVal = parseFloat(kpSimplexBaseBw) || 12.5;
    const bwMhz = bwVal / 1000;

    const newCarrier: CustomCarrierInput = {
      id: `custom_base_${Date.now()}`,
      label: `Base ${carriers.filter(c => c.type === 'BASE_TX').length + 1}`,
      tx: Number(txVal.toFixed(5)),
      rx: 0,
      txBw: bwMhz,
      rxBw: bwMhz,
      type: 'BASE_TX',
      active: true,
      locked: false
    };

    setCarriers(prev => [...prev, newCarrier]);
    setCenterFreq(txVal);
    setCenterFreqInput(txVal.toFixed(5));
    setStatusMsg(`✓ Added Simplex Base TX: ${newCarrier.tx.toFixed(5)} MHz (BW: ${bwVal} kHz)`);
  };

  const handleAddWalkieFromKeypad = () => {
    const txVal = parseFloat(kpWalkieTx);
    if (isNaN(txVal) || txVal < 100 || txVal > 990) {
      Alert.alert('Invalid Walkie-Talkie Freq', 'Please enter a valid frequency (e.g. 456.00000 MHz).');
      return;
    }

    const txCheck = isFrequencyRestricted(txVal);
    if (txCheck.isRestricted) {
      Alert.alert('Restricted Frequency', `⛔ ${txCheck.reason}\n\nThis frequency is restricted and cannot be added.`);
      return;
    }
    const bwVal = parseFloat(kpWalkieBw) || 12.5;
    const bwMhz = bwVal / 1000;

    const newCarrier: CustomCarrierInput = {
      id: `custom_walkie_${Date.now()}`,
      label: `Walkie ${carriers.filter(c => c.type === 'WALKIE').length + 1}`,
      tx: Number(txVal.toFixed(5)),
      rx: 0,
      txBw: bwMhz,
      rxBw: bwMhz,
      type: 'WALKIE',
      active: true,
      locked: false
    };

    setCarriers(prev => [...prev, newCarrier]);
    setCenterFreq(txVal);
    setCenterFreqInput(txVal.toFixed(5));
    setStatusMsg(`✓ Added Simplex Walkie-Talkie: ${newCarrier.tx.toFixed(5)} MHz (BW: ${bwVal} kHz)`);
  };

  // Frequency nudging for individual carriers (respects lock and user step size)
  const handleCarrierNudge = (id: string, field: 'tx' | 'rx', dir: -1 | 1) => {
    setCarriers(prev =>
      prev.map(c => {
        if (c.id !== id) return c;
        if (c.locked) return c; // Locked channels cannot be modified
        const curVal = field === 'tx' ? c.tx : c.rx;
        const stepMhz = (ledgerStepKhz || 12.5) / 1000;
        const newVal = Math.round((curVal + dir * stepMhz) * 100000) / 100000;
        return {
          ...c,
          [field]: newVal
        };
      })
    );
  };

  // Parse batch input (space, comma, or newline separated)
  const handleBatchImport = () => {
    const tokens = batchInputText.split(/[\s,;\n\r]+/);
    const parsed: number[] = [];
    tokens.forEach(tok => {
      const v = parseFloat(tok.trim());
      if (!isNaN(v) && v >= 380 && v <= 500) {
        parsed.push(Number(v.toFixed(5)));
      }
    });
    if (parsed.length === 0) {
      Alert.alert('No Frequencies Found', 'Please enter valid numbers between 400 and 470 MHz.');
      return;
    }
    const newItems: CustomCarrierInput[] = parsed.map((freq, idx) => ({
      id: `batch_${Date.now()}_${idx}`,
      tx: freq,
      rx: 0,
      label: `Ch ${carriers.length + idx + 1}`,
      type: 'BASE_TX',
      txBw: 0.0125,
      rxBw: 0.0125,
      active: true,
      locked: false
    }));
    setCarriers(prev => [...prev, ...newItems]);
    setBatchInputText('');
    setShowBatchBox(false);
  };

  // ----------------------------------------------------
  // 6. TOUCH / PAN RESPONDER ON SPECTRUM CANVAS
  // ----------------------------------------------------
  const canvasStateRef = useRef({
    isDeltaMode,
    deltaStep,
    startFreq,
    span,
    canvasWidth
  });
  useEffect(() => {
    canvasStateRef.current = {
      isDeltaMode,
      deltaStep,
      startFreq,
      span,
      canvasWidth
    };
  }, [isDeltaMode, deltaStep, startFreq, span, canvasWidth]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const tapX = evt.nativeEvent.locationX;
        const { isDeltaMode: dMode, deltaStep: dStep, startFreq: sFreq, span: curSpan, canvasWidth: cWidth } = canvasStateRef.current;
        const tappedFreq = Math.round((sFreq + (tapX / Math.max(1, cWidth)) * curSpan) * 100000) / 100000;
        if (dMode) {
          if (dStep === 1) {
            setMarker1(tappedFreq);
            setMarker2(null);
            setDeltaStep(2);
          } else {
            setMarker2(tappedFreq);
            setDeltaStep(1);
          }
        } else {
          setMarker1(tappedFreq);
        }
      }
    })
  ).current;

  // Grid lines
  const gridFrequencies = useMemo(() => {
    const list: number[] = [];
    const step = span <= 1 ? 0.1 : (span <= 5 ? 0.5 : (span <= 15 ? 1.0 : 2.5));
    const first = Math.ceil(startFreq / step) * step;
    for (let f = first; f <= stopFreq; f += step) {
      list.push(Math.round(f * 1000) / 1000);
    }
    return list;
  }, [startFreq, stopFreq, span]);

  return (
    <View style={screenStyles.container}>
      {/* ================= HEADER BAR ================= */}
      <View style={screenStyles.headerBar}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={screenStyles.headerIcon}>
            <Text style={{ fontSize: 18 }}>📊</Text>
          </View>
          <View>
            <Text style={screenStyles.headerTitle}>DEDICATED SPECTRUM ANALYZER</Text>
            <Text style={screenStyles.headerSub}>FREQUENCY ENTRY &amp; INTERMOD COMPATIBILITY SOLVER</Text>
          </View>
        </View>
        {onClose && (
          <TouchableOpacity style={screenStyles.closeBtn} onPress={onClose}>
            <Text style={screenStyles.closeBtnText}>✕ CLOSE</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ================= SPECTRUM CRT DISPLAY (STICKY IN PORTRAIT MODE) ================= */}
      {!isLandscape && (
        <View style={{ paddingHorizontal: 10 }}>
          <View style={[screenStyles.displayCard, { marginTop: 4, marginBottom: 4 }]}>
            {/* Top readout row */}
            <View style={screenStyles.readoutRow}>
              <Text style={screenStyles.readoutLabel}>
                CF: <Text style={{ color: '#38bdf8', fontWeight: 'bold' }}>{centerFreq.toFixed(5)} MHz</Text>
              </Text>
              <Text style={screenStyles.readoutLabel}>
                SPAN: <Text style={{ color: '#38bdf8', fontWeight: 'bold' }}>{span.toFixed(2)} MHz</Text>
              </Text>
              {marker1 !== null && marker2 !== null && (
                <Text style={screenStyles.readoutDelta}>
                  Δ: {Math.abs(marker2 - marker1).toFixed(5)} MHz ({(Math.abs(marker2 - marker1) * 1000).toFixed(1)} kHz)
                </Text>
              )}
            </View>

            {/* SVG Canvas */}
            <View
              style={screenStyles.canvasWrapper}
              {...panResponder.panHandlers}
              onLayout={(e) => {
                const nw = Math.floor(Math.max(280, e.nativeEvent.layout.width));
                if (nw > 0 && Math.abs(nw - canvasWidth) > 3) {
                  setCanvasWidth(nw);
                }
              }}
            >
              <Svg width="100%" height={CANVAS_HEIGHT}>
                {/* Background */}
                <Rect x="0" y="0" width="100%" height={CANVAS_HEIGHT} fill="#020813" />

                {/* Grid Lines */}
                {showGrid && (
                  <>
                    {[-100, -80, -60, -40, -20, 0].map(dbm => {
                      const y = dbmToY(dbm);
                      return (
                        <G key={`g_dbm_${dbm}`}>
                          <Line x1="0" y1={y} x2={canvasWidth} y2={y} stroke="#0d2238" strokeWidth="1" strokeDasharray="2, 4" />
                          <SvgText x={canvasWidth - 4} y={y - 2} fill="#1e4e6e" fontSize="7.5" textAnchor="end">{dbm} dBm</SvgText>
                        </G>
                      );
                    })}
                    {gridFrequencies.map((f, idx) => {
                      const x = freqToX(f);
                      return (
                        <G key={`g_f_${idx}`}>
                          <Line x1={x} y1={TOP_MARGIN} x2={x} y2={TOP_MARGIN + PLOT_HEIGHT} stroke="#0d2238" strokeWidth="1" strokeDasharray="2, 4" />
                          {idx % 2 === 0 && (
                            <SvgText x={x} y={CANVAS_HEIGHT - 6} fill="#3b6e8c" fontSize="7.5" textAnchor="middle">{f.toFixed(2)}</SvgText>
                          )}
                        </G>
                      );
                    })}
                  </>
                )}

                {/* Center frequency line */}
                <Line
                  x1={canvasWidth / 2}
                  y1={TOP_MARGIN}
                  x2={canvasWidth / 2}
                  y2={TOP_MARGIN + PLOT_HEIGHT}
                  stroke="#1d4ed8"
                  strokeWidth="1"
                  strokeDasharray="4, 4"
                  opacity="0.6"
                />

                {/* ================= REGULATORY RESTRICTED ZONES & KEEP-OUT MASKS (UK EXCLUSIONS) ================= */}
                {ukExclusionsEnabled && (
                  <>
                    {RESTRICTED_FREQUENCY_RANGES.map((range, rIdx) => {
                      if (range.stopFreq < startFreq || range.startFreq > stopFreq) return null;
                      const x1 = Math.max(0, freqToX(range.startFreq));
                      const x2 = Math.min(canvasWidth, freqToX(range.stopFreq));
                      const w = Math.max(2, x2 - x1);
                      const midX = (x1 + x2) / 2;
                      return (
                        <G key={`d_range_${rIdx}`}>
                          <Rect
                            x={x1}
                            y={TOP_MARGIN}
                            width={w}
                            height={PLOT_HEIGHT}
                            fill="rgba(239, 68, 68, 0.16)"
                            stroke="#ef4444"
                            strokeWidth="0.8"
                            strokeDasharray="3, 3"
                          />
                          {w >= 28 && (
                            <SvgText
                              x={midX}
                              y={TOP_MARGIN + 9}
                              fill="#fca5a5"
                              fontSize="6"
                              fontWeight="900"
                              textAnchor="middle"
                            >
                              ⛔ RESTRICTED
                            </SvgText>
                          )}
                        </G>
                      );
                    })}

                    {RESTRICTED_SPOT_FREQUENCIES.map((spot, sIdx) => {
                      const halfBw = spot.bandwidthKhz / 2000;
                      if (spot.freq + halfBw < startFreq || spot.freq - halfBw > stopFreq) return null;
                      const x1 = Math.max(0, freqToX(spot.freq - halfBw));
                      const x2 = Math.min(canvasWidth, freqToX(spot.freq + halfBw));
                      const w = Math.max(2, x2 - x1);
                      const cx = freqToX(spot.freq);
                      return (
                        <G key={`d_spot_${sIdx}`}>
                          <Rect
                            x={x1}
                            y={TOP_MARGIN}
                            width={w}
                            height={PLOT_HEIGHT}
                            fill="rgba(244, 63, 94, 0.22)"
                            stroke="#f43f5e"
                            strokeWidth="0.8"
                            strokeDasharray="2, 2"
                          />
                          <Line
                            x1={cx}
                            y1={TOP_MARGIN}
                            x2={cx}
                            y2={TOP_MARGIN + PLOT_HEIGHT}
                            stroke="#f43f5e"
                            strokeWidth="1"
                            strokeDasharray="2, 2"
                          />
                          {cx >= 15 && cx <= canvasWidth - 15 && (
                            <SvgText
                              x={cx}
                              y={TOP_MARGIN + 8}
                              fill="#fda4af"
                              fontSize="5.5"
                              fontWeight="900"
                              textAnchor="middle"
                            >
                              ⛔ {spot.freq.toFixed(3)}
                            </SvgText>
                          )}
                        </G>
                      );
                    })}
                  </>
                )}

                {/* Intermod Products */}
                {intermodProducts.map((imd, i) => {
                  const x = freqToX(imd.freq);
                  if (x < -10 || x > canvasWidth + 10) return null;
                  const dbm = imd.type === '2-Tone' ? -55 : -65;
                  const topY = dbmToY(dbm);
                  const isClash = conflicts.some(c => Math.abs(c.productFreq - imd.freq) < 0.0001);
                  const color = isClash ? '#ef4444' : (imd.type === '2-Tone' ? '#f43f5e' : '#c084fc');

                  return (
                    <G key={`imd_${i}`}>
                      <Line
                        x1={x}
                        y1={topY}
                        x2={x}
                        y2={TOP_MARGIN + PLOT_HEIGHT}
                        stroke={color}
                        strokeWidth={isClash ? 2 : 1.2}
                        strokeDasharray={imd.type === '2-Tone' ? 'none' : '3, 2'}
                      />
                      {/* Small solid circle slightly wider than spike line */}
                      <Circle cx={x} cy={topY} r={isClash ? 1.6 : 1.2} fill={color} />
                    </G>
                  );
                })}

                {/* Sticky Left-Hand 2TX and 3TX Reference Labels (Transparent, small font, no blocking box) */}
                {(() => {
                  const y2tx = dbmToY(-55);
                  const y3tx = dbmToY(-65);
                  return (
                    <G key="sec_imd_left_labels">
                      <Line x1="0" y1={y2tx} x2={canvasWidth} y2={y2tx} stroke="#f43f5e" strokeWidth="0.6" strokeDasharray="2, 4" opacity="0.25" />
                      <SvgText x="3" y={y2tx - 2} fill="#f43f5e" fontSize="6.5" fontWeight="bold" textAnchor="start">2TX</SvgText>

                      <Line x1="0" y1={y3tx} x2={canvasWidth} y2={y3tx} stroke="#c084fc" strokeWidth="0.6" strokeDasharray="2, 4" opacity="0.2" />
                      <SvgText x="3" y={y3tx - 2} fill="#c084fc" fontSize="6.5" fontWeight="bold" textAnchor="start">3TX</SvgText>
                    </G>
                  );
                })()}

                {/* Active Carriers (Base TX, Portable RX, Walkie, IFB) */}
                {carriers.filter(c => c.active).map((c, idx) => {
                  const xTx = freqToX(c.tx);
                  const xRx = c.type === 'DUPLEX' ? freqToX(c.rx) : null;
                  const hasTxClash = conflicts.some(con => con.targetCarrier.includes(c.label) || Math.abs(con.targetFreq - c.tx) < 0.001);
                  const hasRxClash = xRx !== null && conflicts.some(con => con.targetCarrier.includes(c.label) || Math.abs(con.targetFreq - c.rx) < 0.001);

                  const baseY = TOP_MARGIN + PLOT_HEIGHT;
                  const txPeakY = dbmToY(c.type === 'BASE_TX' ? -10 : -14);
                  const rxPeakY = dbmToY(-20);

                  return (
                    <G key={`carrier_${c.id}`}>
                      {/* TX Carrier Peak */}
                      {xTx >= -20 && xTx <= canvasWidth + 20 && (
                        <G>
                          {fillSpikes && (
                            <Path
                              d={`M ${xTx - 8} ${baseY} Q ${xTx - 3} ${baseY} ${xTx - 1} ${txPeakY + 2} L ${xTx} ${txPeakY} L ${xTx + 1} ${txPeakY + 2} Q ${xTx + 3} ${baseY} ${xTx + 8} ${baseY} Z`}
                              fill={hasTxClash ? 'rgba(239, 68, 68, 0.4)' : 'rgba(250, 204, 21, 0.3)'}
                            />
                          )}
                          <Line x1={xTx} y1={txPeakY} x2={xTx} y2={baseY} stroke={hasTxClash ? '#ef4444' : '#facc15'} strokeWidth="2" />
                          <Circle cx={xTx} cy={txPeakY} r={3} fill={hasTxClash ? '#ef4444' : '#facc15'} />
                          <SvgText x={xTx} y={txPeakY - 4} fill={hasTxClash ? '#fca5a5' : '#fde047'} fontSize="7.5" fontWeight="bold" textAnchor="middle">
                            {hasTxClash ? '⚠️ ' : ''}{idx + 1}
                          </SvgText>
                        </G>
                      )}

                      {/* RX Carrier Peak (Duplex) */}
                      {xRx !== null && xRx >= -20 && xRx <= canvasWidth + 20 && (
                        <G>
                          {fillSpikes && (
                            <Path
                              d={`M ${xRx - 8} ${baseY} Q ${xRx - 3} ${baseY} ${xRx - 1} ${rxPeakY + 2} L ${xRx} ${rxPeakY} L ${xRx + 1} ${rxPeakY + 2} Q ${xRx + 3} ${baseY} ${xRx + 8} ${baseY} Z`}
                              fill={hasRxClash ? 'rgba(239, 68, 68, 0.4)' : 'rgba(56, 189, 248, 0.3)'}
                            />
                          )}
                          <Line x1={xRx} y1={rxPeakY} x2={xRx} y2={baseY} stroke={hasRxClash ? '#ef4444' : '#38bdf8'} strokeWidth="2" />
                          <Circle cx={xRx} cy={rxPeakY} r={3} fill={hasRxClash ? '#ef4444' : '#38bdf8'} />
                          <SvgText x={xRx} y={rxPeakY - 4} fill={hasRxClash ? '#fca5a5' : '#7dd3fc'} fontSize="7.5" fontWeight="bold" textAnchor="middle">
                            {hasRxClash ? '⚠️ ' : ''}{idx + 1}
                          </SvgText>
                        </G>
                      )}
                    </G>
                  );
                })}

                {/* Markers */}
                {marker1 !== null && (() => {
                  const mx = freqToX(marker1);
                  if (mx < 0 || mx > canvasWidth) return null;
                  return (
                    <G key="mkr1">
                      <Line x1={mx} y1={TOP_MARGIN} x2={mx} y2={TOP_MARGIN + PLOT_HEIGHT} stroke="#ef4444" strokeWidth="1.5" strokeDasharray="3, 3" />
                      <SvgText x={mx} y={TOP_MARGIN + 12} fill="#ef4444" fontSize="8" fontWeight="bold" textAnchor="middle">M1</SvgText>
                    </G>
                  );
                })()}
                {marker2 !== null && (() => {
                  const mx = freqToX(marker2);
                  if (mx < 0 || mx > canvasWidth) return null;
                  return (
                    <G key="mkr2">
                      <Line x1={mx} y1={TOP_MARGIN} x2={mx} y2={TOP_MARGIN + PLOT_HEIGHT} stroke="#10b981" strokeWidth="1.5" strokeDasharray="3, 3" />
                      <SvgText x={mx} y={TOP_MARGIN + 12} fill="#10b981" fontSize="8" fontWeight="bold" textAnchor="middle">M2</SvgText>
                    </G>
                  );
                })()}
              </Svg>
            </View>

            {/* Layer toggles: 2-Tone, 3-Tone, Delta, UK Exclusions */}
            <View style={screenStyles.layerToggleRow}>
              <TouchableOpacity
                style={[screenStyles.layerToggleBtn, showTwoTone && screenStyles.layerToggleActiveRed]}
                onPress={() => setShowTwoTone(!showTwoTone)}
                activeOpacity={0.7}
              >
                <Text style={screenStyles.layerToggleText} numberOfLines={1}>
                  2-TONE ({showTwoTone ? 'ON' : 'OFF'})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[screenStyles.layerToggleBtn, showThreeTone && screenStyles.layerToggleActivePurple]}
                onPress={() => setShowThreeTone(!showThreeTone)}
                activeOpacity={0.7}
              >
                <Text style={screenStyles.layerToggleText} numberOfLines={1}>
                  3-TONE ({showThreeTone ? 'ON' : 'OFF'})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[screenStyles.layerToggleBtn, isDeltaMode && screenStyles.layerToggleActiveBlue]}
                onPress={() => setIsDeltaMode(!isDeltaMode)}
                activeOpacity={0.7}
              >
                <Text style={screenStyles.layerToggleText} numberOfLines={1}>
                  DELTA {isDeltaMode ? 'ACTIVE' : 'OFF'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  screenStyles.layerToggleBtn,
                  screenStyles.layerToggleBtnUkExcl,
                  ukExclusionsEnabled
                    ? { borderColor: '#ef4444', backgroundColor: '#450a0a' }
                    : { borderColor: '#334155', backgroundColor: '#1e293b' }
                ]}
                onPress={toggleUkExclusions}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    screenStyles.layerToggleText,
                    ukExclusionsEnabled && { color: '#fca5a5' }
                  ]}
                  numberOfLines={1}
                >
                  UK EXCLUSIONS ({ukExclusionsEnabled ? 'ON' : 'OFF'})
                </Text>
              </TouchableOpacity>
            </View>

            {/* Quick RF Band Presets: Dual Band, Base TX, Portable TX */}
            {(() => {
              const getClusters = (freqList: number[], fallbackCenters: number[]) => {
                const valid = [...new Set(freqList.filter(f => f && f > 0))].sort((a, b) => b - a);
                if (valid.length === 0) {
                  return fallbackCenters
                    .sort((a, b) => b - a)
                    .map(center => ({
                      center: Number(center.toFixed(5)),
                      span: 3.50,
                      min: center - 0.5,
                      max: center + 0.5,
                      nominalBand: Math.round(center)
                    }));
                }
                const clusters: { freqs: number[]; min: number; max: number }[] = [];
                for (const f of valid) {
                  const match = clusters.find(c => Math.abs(f - c.min) <= 1.5 || Math.abs(f - c.max) <= 1.5);
                  if (match) {
                    match.freqs.push(f);
                    match.min = Math.min(match.min, f);
                    match.max = Math.max(match.max, f);
                  } else {
                    clusters.push({ freqs: [f], min: f, max: f });
                  }
                }
                return clusters
                  .map(c => {
                    const center = Number(((c.min + c.max) / 2).toFixed(5));
                    const spread = c.max - c.min;
                    const span = Math.max(3.20, Math.min(8.0, Number((spread + 1.2).toFixed(2))));
                    return { center, span, min: c.min, max: c.max, nominalBand: Math.round(center) };
                  })
                  .sort((a, b) => b.center - a.center);
              };

              const baseFreqs = carriers
                .filter(c => c.active && (c.type === 'BASE_TX' || c.type === 'DUPLEX'))
                .map(c => c.tx)
                .filter(f => f > 0);
              const baseClusters = getClusters(baseFreqs, [457.36250, 455.21250]);

              const portFreqs = carriers
                .filter(c => c.active && (c.type === 'WALKIE' || c.type === 'DUPLEX'))
                .map(c => (c.type === 'DUPLEX' ? c.rx : c.tx))
                .filter(f => f > 0);
              const portClusters = getClusters(portFreqs, [468.25000, 467.41250]);

              const allFreqs = [...baseFreqs, ...portFreqs].filter(f => f > 0);
              const hasCarriers = allFreqs.length >= 2;
              const minAll = hasCarriers ? Math.min(...allFreqs) : 455.0;
              const maxAll = hasCarriers ? Math.max(...allFreqs) : 468.5;
              const dualCenter = Number(((minAll + maxAll) / 2).toFixed(5));
              const dualSpan = Math.max(18.0, Math.min(32.0, Number(((maxAll - minAll) + 3.0).toFixed(2))));

              let curBaseIdx = -1;
              let minBaseDiff = 999;
              baseClusters.forEach((c, idx) => {
                const diff = Math.abs(centerFreq - c.center);
                if (diff < minBaseDiff && diff < Math.max(2.0, c.span / 2)) {
                  minBaseDiff = diff;
                  curBaseIdx = idx;
                }
              });
              const isBaseActive = curBaseIdx >= 0 && span < 12.0;
              const activeBaseCluster = isBaseActive ? baseClusters[curBaseIdx] : null;

              let curPortIdx = -1;
              let minPortDiff = 999;
              portClusters.forEach((c, idx) => {
                const diff = Math.abs(centerFreq - c.center);
                if (diff < minPortDiff && diff < Math.max(2.0, c.span / 2)) {
                  minPortDiff = diff;
                  curPortIdx = idx;
                }
              });
              const isPortActive = curPortIdx >= 0 && span < 12.0;
              const activePortCluster = isPortActive ? portClusters[curPortIdx] : null;

              const isDualActive = span >= 14 && centerFreq >= minAll - 4 && centerFreq <= maxAll + 4;

              const handleBaseClick = () => {
                if (baseClusters.length === 0) return;
                const nextIdx = curBaseIdx >= 0 ? (curBaseIdx + 1) % baseClusters.length : 0;
                const target = baseClusters[nextIdx];
                setCenterFreq(target.center);
                setCenterFreqInput(target.center.toFixed(5));
                setSpan(target.span);
                setSpanInput(target.span.toFixed(2));
              };

              const handlePortClick = () => {
                if (portClusters.length === 0) return;
                const nextIdx = curPortIdx >= 0 ? (curPortIdx + 1) % portClusters.length : 0;
                const target = portClusters[nextIdx];
                setCenterFreq(target.center);
                setCenterFreqInput(target.center.toFixed(5));
                setSpan(target.span);
                setSpanInput(target.span.toFixed(2));
              };

              const handleDualClick = () => {
                setCenterFreq(dualCenter);
                setCenterFreqInput(dualCenter.toFixed(5));
                setSpan(dualSpan);
                setSpanInput(dualSpan.toFixed(2));
              };

              return (
                <View style={[screenStyles.quickBandRow, { backgroundColor: 'transparent', paddingHorizontal: 0, paddingVertical: 4, borderBottomWidth: 0, marginTop: 6, width: '100%' }]}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={[screenStyles.quickBandBtn, isDualActive && screenStyles.quickBandBtnActive]}
                    onPress={handleDualClick}
                  >
                    <Text style={screenStyles.quickBandBtnText}>Dual Band</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={[screenStyles.quickBandBtn, isBaseActive && screenStyles.quickBandBtnActive]}
                    onPress={handleBaseClick}
                  >
                    <Text style={screenStyles.quickBandBtnText}>
                      {isBaseActive && activeBaseCluster && baseClusters.length > 1
                        ? `Base TX (${activeBaseCluster.nominalBand})`
                        : 'Base TX'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={[screenStyles.quickBandBtn, isPortActive && screenStyles.quickBandBtnActive]}
                    onPress={handlePortClick}
                  >
                    <Text style={screenStyles.quickBandBtnText}>
                      {isPortActive && activePortCluster && portClusters.length > 1
                        ? `Portable TX (${activePortCluster.nominalBand})`
                        : 'Portable TX'}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })()}
          </View>
        </View>
      )}

      {/* ================= SCROLLABLE LOWER BODY (OR FULL PAGE IN LANDSCAPE) ================= */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 10, paddingTop: 4, paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* In Landscape Mode: displayCard scrolls with page */}
        {isLandscape && (
          <View style={[screenStyles.displayCard, { marginTop: 4, marginBottom: 4 }]}>
            {/* Top readout row */}
            <View style={screenStyles.readoutRow}>
              <Text style={screenStyles.readoutLabel}>
                CF: <Text style={{ color: '#38bdf8', fontWeight: 'bold' }}>{centerFreq.toFixed(5)} MHz</Text>
              </Text>
              <Text style={screenStyles.readoutLabel}>
                SPAN: <Text style={{ color: '#38bdf8', fontWeight: 'bold' }}>{span.toFixed(2)} MHz</Text>
              </Text>
              {marker1 !== null && marker2 !== null && (
                <Text style={screenStyles.readoutDelta}>
                  Δ: {Math.abs(marker2 - marker1).toFixed(5)} MHz ({(Math.abs(marker2 - marker1) * 1000).toFixed(1)} kHz)
                </Text>
              )}
            </View>

            {/* SVG Canvas */}
            <View
              style={screenStyles.canvasWrapper}
              {...panResponder.panHandlers}
              onLayout={(e) => {
                const nw = Math.floor(Math.max(280, e.nativeEvent.layout.width));
                if (nw > 0 && Math.abs(nw - canvasWidth) > 3) {
                  setCanvasWidth(nw);
                }
              }}
            >
              <Svg width="100%" height={CANVAS_HEIGHT}>
                {/* Background */}
                <Rect x="0" y="0" width="100%" height={CANVAS_HEIGHT} fill="#020813" />

                {/* Grid Lines */}
                {showGrid && (
                  <>
                    {[-100, -80, -60, -40, -20, 0].map(dbm => {
                      const y = dbmToY(dbm);
                      return (
                        <G key={`g_dbm_${dbm}`}>
                          <Line x1="0" y1={y} x2={canvasWidth} y2={y} stroke="#0d2238" strokeWidth="1" strokeDasharray="2, 4" />
                          <SvgText x={canvasWidth - 4} y={y - 2} fill="#1e4e6e" fontSize="7.5" textAnchor="end">{dbm} dBm</SvgText>
                        </G>
                      );
                    })}
                    {gridFrequencies.map((f, idx) => {
                      const x = freqToX(f);
                      return (
                        <G key={`g_f_${idx}`}>
                          <Line x1={x} y1={TOP_MARGIN} x2={x} y2={TOP_MARGIN + PLOT_HEIGHT} stroke="#0d2238" strokeWidth="1" strokeDasharray="2, 4" />
                          {idx % 2 === 0 && (
                            <SvgText x={x} y={CANVAS_HEIGHT - 6} fill="#3b6e8c" fontSize="7.5" textAnchor="middle">{f.toFixed(2)}</SvgText>
                          )}
                        </G>
                      );
                    })}
                  </>
                )}

                {/* Center frequency line */}
                <Line
                  x1={canvasWidth / 2}
                  y1={TOP_MARGIN}
                  x2={canvasWidth / 2}
                  y2={TOP_MARGIN + PLOT_HEIGHT}
                  stroke="#1d4ed8"
                  strokeWidth="1"
                  strokeDasharray="4, 4"
                  opacity="0.6"
                />

                {/* ================= REGULATORY RESTRICTED ZONES & KEEP-OUT MASKS (UK EXCLUSIONS) ================= */}
                {ukExclusionsEnabled && (
                  <>
                    {RESTRICTED_FREQUENCY_RANGES.map((range, rIdx) => {
                      if (range.stopFreq < startFreq || range.startFreq > stopFreq) return null;
                      const x1 = Math.max(0, freqToX(range.startFreq));
                      const x2 = Math.min(canvasWidth, freqToX(range.stopFreq));
                      const w = Math.max(2, x2 - x1);
                      const midX = (x1 + x2) / 2;
                      return (
                        <G key={`d_range_${rIdx}`}>
                          <Rect
                            x={x1}
                            y={TOP_MARGIN}
                            width={w}
                            height={PLOT_HEIGHT}
                            fill="rgba(239, 68, 68, 0.16)"
                            stroke="#ef4444"
                            strokeWidth="0.8"
                            strokeDasharray="3, 3"
                          />
                          {w >= 28 && (
                            <SvgText
                              x={midX}
                              y={TOP_MARGIN + 9}
                              fill="#fca5a5"
                              fontSize="6"
                              fontWeight="900"
                              textAnchor="middle"
                            >
                              ⛔ RESTRICTED
                            </SvgText>
                          )}
                        </G>
                      );
                    })}

                    {RESTRICTED_SPOT_FREQUENCIES.map((spot, sIdx) => {
                      const halfBw = spot.bandwidthKhz / 2000;
                      if (spot.freq + halfBw < startFreq || spot.freq - halfBw > stopFreq) return null;
                      const x1 = Math.max(0, freqToX(spot.freq - halfBw));
                      const x2 = Math.min(canvasWidth, freqToX(spot.freq + halfBw));
                      const w = Math.max(2, x2 - x1);
                      const cx = freqToX(spot.freq);
                      return (
                        <G key={`d_spot_${sIdx}`}>
                          <Rect
                            x={x1}
                            y={TOP_MARGIN}
                            width={w}
                            height={PLOT_HEIGHT}
                            fill="rgba(244, 63, 94, 0.22)"
                            stroke="#f43f5e"
                            strokeWidth="0.8"
                            strokeDasharray="2, 2"
                          />
                          <Line
                            x1={cx}
                            y1={TOP_MARGIN}
                            x2={cx}
                            y2={TOP_MARGIN + PLOT_HEIGHT}
                            stroke="#f43f5e"
                            strokeWidth="1"
                            strokeDasharray="2, 2"
                          />
                          {cx >= 15 && cx <= canvasWidth - 15 && (
                            <SvgText
                              x={cx}
                              y={TOP_MARGIN + 8}
                              fill="#fda4af"
                              fontSize="5.5"
                              fontWeight="900"
                              textAnchor="middle"
                            >
                              ⛔ {spot.freq.toFixed(3)}
                            </SvgText>
                          )}
                        </G>
                      );
                    })}
                  </>
                )}

                {/* Intermod Products */}
                {intermodProducts.map((imd, i) => {
                  const x = freqToX(imd.freq);
                  if (x < -10 || x > canvasWidth + 10) return null;
                  const dbm = imd.type === '2-Tone' ? -55 : -65;
                  const topY = dbmToY(dbm);
                  const isClash = conflicts.some(c => Math.abs(c.productFreq - imd.freq) < 0.0001);
                  const color = isClash ? '#ef4444' : (imd.type === '2-Tone' ? '#f43f5e' : '#c084fc');

                  return (
                    <G key={`imd_${i}`}>
                      <Line
                        x1={x}
                        y1={topY}
                        x2={x}
                        y2={TOP_MARGIN + PLOT_HEIGHT}
                        stroke={color}
                        strokeWidth={isClash ? 2 : 1.2}
                        strokeDasharray={imd.type === '2-Tone' ? 'none' : '3, 2'}
                      />
                      {/* Small solid circle slightly wider than spike line */}
                      <Circle cx={x} cy={topY} r={isClash ? 1.6 : 1.2} fill={color} />
                    </G>
                  );
                })}

                {/* Sticky Left-Hand 2TX and 3TX Reference Labels (Transparent, small font, no blocking box) */}
                {(() => {
                  const y2tx = dbmToY(-55);
                  const y3tx = dbmToY(-65);
                  return (
                    <G key="sec_imd_left_labels">
                      <Line x1="0" y1={y2tx} x2={canvasWidth} y2={y2tx} stroke="#f43f5e" strokeWidth="0.6" strokeDasharray="2, 4" opacity="0.25" />
                      <SvgText x="3" y={y2tx - 2} fill="#f43f5e" fontSize="6.5" fontWeight="bold" textAnchor="start">2TX</SvgText>

                      <Line x1="0" y1={y3tx} x2={canvasWidth} y2={y3tx} stroke="#c084fc" strokeWidth="0.6" strokeDasharray="2, 4" opacity="0.2" />
                      <SvgText x="3" y={y3tx - 2} fill="#c084fc" fontSize="6.5" fontWeight="bold" textAnchor="start">3TX</SvgText>
                    </G>
                  );
                })()}

                {/* Active Carriers (Base TX, Portable RX, Walkie, IFB) */}
                {carriers.filter(c => c.active).map((c, idx) => {
                  const xTx = freqToX(c.tx);
                  const xRx = c.type === 'DUPLEX' ? freqToX(c.rx) : null;
                  const hasTxClash = conflicts.some(con => con.targetCarrier.includes(c.label) || Math.abs(con.targetFreq - c.tx) < 0.001);
                  const hasRxClash = xRx !== null && conflicts.some(con => con.targetCarrier.includes(c.label) || Math.abs(con.targetFreq - c.rx) < 0.001);

                  const baseY = TOP_MARGIN + PLOT_HEIGHT;
                  const txPeakY = dbmToY(c.type === 'BASE_TX' ? -10 : -14);
                  const rxPeakY = dbmToY(-20);

                  return (
                    <G key={`carrier_${c.id}`}>
                      {/* TX Carrier Peak */}
                      {xTx >= -20 && xTx <= canvasWidth + 20 && (
                        <G>
                          {fillSpikes && (
                            <Path
                              d={`M ${xTx - 8} ${baseY} Q ${xTx - 3} ${baseY} ${xTx - 1} ${txPeakY + 2} L ${xTx} ${txPeakY} L ${xTx + 1} ${txPeakY + 2} Q ${xTx + 3} ${baseY} ${xTx + 8} ${baseY} Z`}
                              fill={hasTxClash ? 'rgba(239, 68, 68, 0.4)' : 'rgba(250, 204, 21, 0.3)'}
                            />
                          )}
                          <Line x1={xTx} y1={txPeakY} x2={xTx} y2={baseY} stroke={hasTxClash ? '#ef4444' : '#facc15'} strokeWidth="2" />
                          <Circle cx={xTx} cy={txPeakY} r={3} fill={hasTxClash ? '#ef4444' : '#facc15'} />
                          <SvgText x={xTx} y={txPeakY - 4} fill={hasTxClash ? '#fca5a5' : '#fde047'} fontSize="7.5" fontWeight="bold" textAnchor="middle">
                            {hasTxClash ? '⚠️ ' : ''}{idx + 1}
                          </SvgText>
                        </G>
                      )}

                      {/* RX Carrier Peak (Duplex) */}
                      {xRx !== null && xRx >= -20 && xRx <= canvasWidth + 20 && (
                        <G>
                          {fillSpikes && (
                            <Path
                              d={`M ${xRx - 8} ${baseY} Q ${xRx - 3} ${baseY} ${xRx - 1} ${rxPeakY + 2} L ${xRx} ${rxPeakY} L ${xRx + 1} ${rxPeakY + 2} Q ${xRx + 3} ${baseY} ${xRx + 8} ${baseY} Z`}
                              fill={hasRxClash ? 'rgba(239, 68, 68, 0.4)' : 'rgba(56, 189, 248, 0.3)'}
                            />
                          )}
                          <Line x1={xRx} y1={rxPeakY} x2={xRx} y2={baseY} stroke={hasRxClash ? '#ef4444' : '#38bdf8'} strokeWidth="2" />
                          <Circle cx={xRx} cy={rxPeakY} r={3} fill={hasRxClash ? '#ef4444' : '#38bdf8'} />
                          <SvgText x={xRx} y={rxPeakY - 4} fill={hasRxClash ? '#fca5a5' : '#7dd3fc'} fontSize="7.5" fontWeight="bold" textAnchor="middle">
                            {hasRxClash ? '⚠️ ' : ''}{idx + 1}
                          </SvgText>
                        </G>
                      )}
                    </G>
                  );
                })}

                {/* Markers */}
                {marker1 !== null && (() => {
                  const mx = freqToX(marker1);
                  if (mx < 0 || mx > canvasWidth) return null;
                  return (
                    <G key="mkr1">
                      <Line x1={mx} y1={TOP_MARGIN} x2={mx} y2={TOP_MARGIN + PLOT_HEIGHT} stroke="#ef4444" strokeWidth="1.5" strokeDasharray="3, 3" />
                      <SvgText x={mx} y={TOP_MARGIN + 12} fill="#ef4444" fontSize="8" fontWeight="bold" textAnchor="middle">M1</SvgText>
                    </G>
                  );
                })()}
                {marker2 !== null && (() => {
                  const mx = freqToX(marker2);
                  if (mx < 0 || mx > canvasWidth) return null;
                  return (
                    <G key="mkr2">
                      <Line x1={mx} y1={TOP_MARGIN} x2={mx} y2={TOP_MARGIN + PLOT_HEIGHT} stroke="#10b981" strokeWidth="1.5" strokeDasharray="3, 3" />
                      <SvgText x={mx} y={TOP_MARGIN + 12} fill="#10b981" fontSize="8" fontWeight="bold" textAnchor="middle">M2</SvgText>
                    </G>
                  );
                })()}
              </Svg>
            </View>

            {/* Layer toggles: 2-Tone, 3-Tone, Delta, UK Exclusions */}
            <View style={screenStyles.layerToggleRow}>
              <TouchableOpacity
                style={[screenStyles.layerToggleBtn, showTwoTone && screenStyles.layerToggleActiveRed]}
                onPress={() => setShowTwoTone(!showTwoTone)}
                activeOpacity={0.7}
              >
                <Text style={screenStyles.layerToggleText} numberOfLines={1}>
                  2-TONE ({showTwoTone ? 'ON' : 'OFF'})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[screenStyles.layerToggleBtn, showThreeTone && screenStyles.layerToggleActivePurple]}
                onPress={() => setShowThreeTone(!showThreeTone)}
                activeOpacity={0.7}
              >
                <Text style={screenStyles.layerToggleText} numberOfLines={1}>
                  3-TONE ({showThreeTone ? 'ON' : 'OFF'})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[screenStyles.layerToggleBtn, isDeltaMode && screenStyles.layerToggleActiveBlue]}
                onPress={() => setIsDeltaMode(!isDeltaMode)}
                activeOpacity={0.7}
              >
                <Text style={screenStyles.layerToggleText} numberOfLines={1}>
                  DELTA {isDeltaMode ? 'ACTIVE' : 'OFF'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  screenStyles.layerToggleBtn,
                  screenStyles.layerToggleBtnUkExcl,
                  ukExclusionsEnabled
                    ? { borderColor: '#ef4444', backgroundColor: '#450a0a' }
                    : { borderColor: '#334155', backgroundColor: '#1e293b' }
                ]}
                onPress={toggleUkExclusions}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    screenStyles.layerToggleText,
                    ukExclusionsEnabled && { color: '#fca5a5' }
                  ]}
                  numberOfLines={1}
                >
                  UK EXCLUSIONS ({ukExclusionsEnabled ? 'ON' : 'OFF'})
                </Text>
              </TouchableOpacity>
            </View>

            {/* Quick RF Band Presets: Dual Band, Base TX, Portable TX */}
            {(() => {
              const getClusters = (freqList: number[], fallbackCenters: number[]) => {
                const valid = [...new Set(freqList.filter(f => f && f > 0))].sort((a, b) => b - a);
                if (valid.length === 0) {
                  return fallbackCenters
                    .sort((a, b) => b - a)
                    .map(center => ({
                      center: Number(center.toFixed(5)),
                      span: 3.50,
                      min: center - 0.5,
                      max: center + 0.5,
                      nominalBand: Math.round(center)
                    }));
                }
                const clusters: { freqs: number[]; min: number; max: number }[] = [];
                for (const f of valid) {
                  const match = clusters.find(c => Math.abs(f - c.min) <= 1.5 || Math.abs(f - c.max) <= 1.5);
                  if (match) {
                    match.freqs.push(f);
                    match.min = Math.min(match.min, f);
                    match.max = Math.max(match.max, f);
                  } else {
                    clusters.push({ freqs: [f], min: f, max: f });
                  }
                }
                return clusters
                  .map(c => {
                    const center = Number(((c.min + c.max) / 2).toFixed(5));
                    const spread = c.max - c.min;
                    const span = Math.max(3.20, Math.min(8.0, Number((spread + 1.2).toFixed(2))));
                    return { center, span, min: c.min, max: c.max, nominalBand: Math.round(center) };
                  })
                  .sort((a, b) => b.center - a.center);
              };

              const baseFreqs = carriers
                .filter(c => c.active && (c.type === 'BASE_TX' || c.type === 'DUPLEX'))
                .map(c => c.tx)
                .filter(f => f > 0);
              const baseClusters = getClusters(baseFreqs, [457.36250, 455.21250]);

              const portFreqs = carriers
                .filter(c => c.active && (c.type === 'WALKIE' || c.type === 'DUPLEX'))
                .map(c => (c.type === 'DUPLEX' ? c.rx : c.tx))
                .filter(f => f > 0);
              const portClusters = getClusters(portFreqs, [468.25000, 467.41250]);

              const allFreqs = [...baseFreqs, ...portFreqs].filter(f => f > 0);
              const hasCarriers = allFreqs.length >= 2;
              const minAll = hasCarriers ? Math.min(...allFreqs) : 455.0;
              const maxAll = hasCarriers ? Math.max(...allFreqs) : 468.5;
              const dualCenter = Number(((minAll + maxAll) / 2).toFixed(5));
              const dualSpan = Math.max(18.0, Math.min(32.0, Number(((maxAll - minAll) + 3.0).toFixed(2))));

              let curBaseIdx = -1;
              let minBaseDiff = 999;
              baseClusters.forEach((c, idx) => {
                const diff = Math.abs(centerFreq - c.center);
                if (diff < minBaseDiff && diff < Math.max(2.0, c.span / 2)) {
                  minBaseDiff = diff;
                  curBaseIdx = idx;
                }
              });
              const isBaseActive = curBaseIdx >= 0 && span < 12.0;
              const activeBaseCluster = isBaseActive ? baseClusters[curBaseIdx] : null;

              let curPortIdx = -1;
              let minPortDiff = 999;
              portClusters.forEach((c, idx) => {
                const diff = Math.abs(centerFreq - c.center);
                if (diff < minPortDiff && diff < Math.max(2.0, c.span / 2)) {
                  minPortDiff = diff;
                  curPortIdx = idx;
                }
              });
              const isPortActive = curPortIdx >= 0 && span < 12.0;
              const activePortCluster = isPortActive ? portClusters[curPortIdx] : null;

              const isDualActive = span >= 14 && centerFreq >= minAll - 4 && centerFreq <= maxAll + 4;

              const handleBaseClick = () => {
                if (baseClusters.length === 0) return;
                const nextIdx = curBaseIdx >= 0 ? (curBaseIdx + 1) % baseClusters.length : 0;
                const target = baseClusters[nextIdx];
                setCenterFreq(target.center);
                setCenterFreqInput(target.center.toFixed(5));
                setSpan(target.span);
                setSpanInput(target.span.toFixed(2));
              };

              const handlePortClick = () => {
                if (portClusters.length === 0) return;
                const nextIdx = curPortIdx >= 0 ? (curPortIdx + 1) % portClusters.length : 0;
                const target = portClusters[nextIdx];
                setCenterFreq(target.center);
                setCenterFreqInput(target.center.toFixed(5));
                setSpan(target.span);
                setSpanInput(target.span.toFixed(2));
              };

              const handleDualClick = () => {
                setCenterFreq(dualCenter);
                setCenterFreqInput(dualCenter.toFixed(5));
                setSpan(dualSpan);
                setSpanInput(dualSpan.toFixed(2));
              };

              return (
                <View style={[screenStyles.quickBandRow, { backgroundColor: 'transparent', paddingHorizontal: 0, paddingVertical: 4, borderBottomWidth: 0, marginTop: 6, width: '100%' }]}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={[screenStyles.quickBandBtn, isDualActive && screenStyles.quickBandBtnActive]}
                    onPress={handleDualClick}
                  >
                    <Text style={screenStyles.quickBandBtnText}>Dual Band</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={[screenStyles.quickBandBtn, isBaseActive && screenStyles.quickBandBtnActive]}
                    onPress={handleBaseClick}
                  >
                    <Text style={screenStyles.quickBandBtnText}>
                      {isBaseActive && activeBaseCluster && baseClusters.length > 1
                        ? `Base TX (${activeBaseCluster.nominalBand})`
                        : 'Base TX'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={[screenStyles.quickBandBtn, isPortActive && screenStyles.quickBandBtnActive]}
                    onPress={handlePortClick}
                  >
                    <Text style={screenStyles.quickBandBtnText}>
                      {isPortActive && activePortCluster && portClusters.length > 1
                        ? `Portable TX (${activePortCluster.nominalBand})`
                        : 'Portable TX'}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })()}
          </View>
        )}

        {/* ================= STATUS BANNER ================= */}
        <View style={[
          screenStyles.statusBanner,
          conflicts.length === 0 ? screenStyles.statusBannerClean : screenStyles.statusBannerClash
        ]}>
          <Text style={screenStyles.statusBannerText}>{statusMsg}</Text>
          <Text style={screenStyles.statusBannerSub}>
            {carriers.filter(c => c.active).length} Active Channels • {intermodProducts.length} IMD Products Calculated (2A-B, A+B-C)
          </Text>
        </View>

        {/* ================= FREQUENCY ENTRY (SINGLE / BATCH / PRESETS / ACTIONS) ================= */}
        <View style={screenStyles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
            <Text style={screenStyles.cardTitle}>ENTER YOUR TALKBACK FREQUENCIES</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TouchableOpacity
                onPress={() => {
                  loadBespokePresets();
                  setPresetModalVisible(true);
                }}
                style={screenStyles.presetLaunchBtn}
                activeOpacity={0.7}
              >
                <Text style={screenStyles.presetLaunchBtnText}>⚡ PRESETS</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowBatchBox(!showBatchBox)}>
                <Text style={{ color: '#38bdf8', fontSize: 11, fontWeight: 'bold' }}>
                  {showBatchBox ? '▲ Hide Batch Paste' : '▼ Batch Paste'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Quick Duplex Presets Launcher Banner */}
          <TouchableOpacity
            style={screenStyles.bannerPresetBtn}
            onPress={() => {
              loadBespokePresets();
              setPresetModalVisible(true);
            }}
            activeOpacity={0.8}
          >
            <Text style={screenStyles.bannerPresetBtnText}>
              ⚡ DUPLEX PRESETS (UK OFCOM / EU EUROPE / BESPOKE)
            </Text>
          </TouchableOpacity>

          {/* Regulatory Region Switch & Duplex Tools Grid (2x2 Grid of 4 Buttons) */}
          <View style={screenStyles.regionSwitchContainer}>
            <Text style={screenStyles.regionLabel}>REGULATORY REGION &amp; DUPLEX DIRECTION CONTROLS:</Text>
            
            <View style={screenStyles.regionGrid}>
              {/* Row 1: Top 2 buttons */}
              <View style={screenStyles.regionGridRow}>
                {/* Button 1: GB UK */}
                <TouchableOpacity
                  style={[
                    screenStyles.gridBtn,
                    regulatoryRegion === 'GB_UK' ? screenStyles.gridBtnActiveUk : screenStyles.gridBtnInactive
                  ]}
                  onPress={() => handleToggleRegulatoryRegion('GB_UK')}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    screenStyles.gridBtnText,
                    regulatoryRegion === 'GB_UK' && screenStyles.gridBtnTextActive
                  ]}>
                    🇬🇧 GB UK (Base Low)
                  </Text>
                </TouchableOpacity>

                {/* Button 2: EU Europe */}
                <TouchableOpacity
                  style={[
                    screenStyles.gridBtn,
                    regulatoryRegion === 'EU_EUROPE' ? screenStyles.gridBtnActiveEu : screenStyles.gridBtnInactive
                  ]}
                  onPress={() => handleToggleRegulatoryRegion('EU_EUROPE')}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    screenStyles.gridBtnText,
                    regulatoryRegion === 'EU_EUROPE' && screenStyles.gridBtnTextActive
                  ]}>
                    🇪🇺 EU Europe (Base High)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Row 2: Bottom 2 buttons */}
              <View style={screenStyles.regionGridRow}>
                {/* Button 3: Invert All TX <-> RX */}
                <TouchableOpacity
                  style={[screenStyles.gridBtn, screenStyles.gridBtnInvert]}
                  onPress={handleInvertAllCarriers}
                  activeOpacity={0.7}
                >
                  <Text style={screenStyles.gridBtnInvertText}>⇄ INVERT ALL (TX ⇄ RX)</Text>
                </TouchableOpacity>

                {/* Button 4: Clear All / Reset */}
                <TouchableOpacity
                  style={[screenStyles.gridBtn, screenStyles.gridBtnClear]}
                  onPress={handleClearAllCarriers}
                  activeOpacity={0.7}
                >
                  <Text style={screenStyles.gridBtnClearText}>🗑 CLEAR ALL (RESET)</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Batch Paste Box */}
          {showBatchBox && (
            <View style={screenStyles.batchBox}>
              <Text style={screenStyles.inputSubLabel}>Paste space, comma, or newline separated MHz frequencies:</Text>
              <TextInput
                style={screenStyles.batchInput}
                multiline
                numberOfLines={3}
                placeholder="455.03125, 455.19375, 455.35625, 468.05625..."
                placeholderTextColor="#64748b"
                value={batchInputText}
                onChangeText={setBatchInputText}
              />
              <TouchableOpacity style={screenStyles.batchAddBtn} onPress={handleBatchImport}>
                <Text style={screenStyles.batchAddBtnText}>+ IMPORT BATCH FREQUENCIES</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ================= STEP LEFT & RIGHT + STEP SIZE CONTROLS ================= */}
        <View style={screenStyles.controlCard}>
          <Text style={screenStyles.cardTitle}>SPECTRUM STEPPING &amp; NAVIGATION</Text>

          {/* Center Frequency Step Row */}
          <View style={screenStyles.stepSection}>
            <View style={screenStyles.stepSectionHeader}>
              <Text style={screenStyles.stepSectionLabel}>CENTER FREQUENCY (MHz)</Text>
              <Text style={screenStyles.stepSizeLabel}>STEP SIZE (MHz)</Text>
            </View>

            <View style={screenStyles.stepRow}>
              {/* Step Left / Right Buttons & Freq Display */}
              <View style={screenStyles.stepperBox}>
                <TouchableOpacity style={screenStyles.arrowBtn} onPress={() => handleCenterStep(-1)}>
                  <Text style={screenStyles.arrowText}>◄ STEP LEFT</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    screenStyles.stepperInput,
                    { justifyContent: 'center', alignItems: 'center' },
                    activeKeypadTarget === 'center_freq' && screenStyles.fieldBoxActive
                  ]}
                  onPress={() => setActiveKeypadTarget('center_freq')}
                >
                  <Text style={[screenStyles.stepperInputText, activeKeypadTarget === 'center_freq' && screenStyles.fieldBoxTextActive]}>
                    {`${centerFreqInput}${activeKeypadTarget === 'center_freq' ? ' ▎' : ''}`}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={screenStyles.arrowBtn} onPress={() => handleCenterStep(1)}>
                  <Text style={screenStyles.arrowText}>STEP RIGHT ►</Text>
                </TouchableOpacity>
              </View>

              {/* Step Size Input Box */}
              <View style={screenStyles.stepSizeBox}>
                <Text style={screenStyles.stepSizePrefix}>Δ Step:</Text>
                <TouchableOpacity
                  style={[
                    screenStyles.stepSizeInput,
                    { justifyContent: 'center', alignItems: 'center' },
                    activeKeypadTarget === 'center_step' && screenStyles.fieldBoxActive
                  ]}
                  onPress={() => setActiveKeypadTarget('center_step')}
                >
                  <Text style={[screenStyles.stepSizeInputText, activeKeypadTarget === 'center_step' && screenStyles.fieldBoxTextActive]}>
                    {`${centerStepInput}${activeKeypadTarget === 'center_step' ? ' ▎' : ''}`}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Quick Step Size Presets */}
            <View style={screenStyles.presetPillRow}>
              <Text style={screenStyles.presetPillHeading}>Quick Steps:</Text>
              {[0.0125, 0.025, 0.100, 0.500, 1.000].map(st => (
                <TouchableOpacity
                  key={`c_st_${st}`}
                  style={[screenStyles.presetPill, Math.abs(centerStepMhz - st) < 0.001 && screenStyles.presetPillActive]}
                  onPress={() => {
                    setCenterStepMhz(st);
                    setCenterStepInput(st.toString());
                  }}
                >
                  <Text style={screenStyles.presetPillText}>
                    {st < 0.1 ? `${(st * 1000).toFixed(1)}k` : `${st}M`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Span Step Row */}
          <View style={[screenStyles.stepSection, { marginTop: 12 }]}>
            <View style={screenStyles.stepSectionHeader}>
              <Text style={screenStyles.stepSectionLabel}>SPAN / ZOOM (MHz)</Text>
              <Text style={screenStyles.stepSizeLabel}>SPAN STEP (MHz)</Text>
            </View>

            <View style={screenStyles.stepRow}>
              <View style={screenStyles.stepperBox}>
                <TouchableOpacity style={screenStyles.arrowBtn} onPress={() => handleSpanStep(-1)}>
                  <Text style={screenStyles.arrowText}>- ZOOM IN</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    screenStyles.stepperInput,
                    { justifyContent: 'center', alignItems: 'center' },
                    activeKeypadTarget === 'span_zoom' && screenStyles.fieldBoxActive
                  ]}
                  onPress={() => setActiveKeypadTarget('span_zoom')}
                >
                  <Text style={[screenStyles.stepperInputText, activeKeypadTarget === 'span_zoom' && screenStyles.fieldBoxTextActive]}>
                    {`${spanInput}${activeKeypadTarget === 'span_zoom' ? ' ▎' : ''}`}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={screenStyles.arrowBtn} onPress={() => handleSpanStep(1)}>
                  <Text style={screenStyles.arrowText}>+ ZOOM OUT</Text>
                </TouchableOpacity>
              </View>

              <View style={screenStyles.stepSizeBox}>
                <Text style={screenStyles.stepSizePrefix}>Δ Step:</Text>
                <TouchableOpacity
                  style={[
                    screenStyles.stepSizeInput,
                    { justifyContent: 'center', alignItems: 'center' },
                    activeKeypadTarget === 'span_step' && screenStyles.fieldBoxActive
                  ]}
                  onPress={() => setActiveKeypadTarget('span_step')}
                >
                  <Text style={[screenStyles.stepSizeInputText, activeKeypadTarget === 'span_step' && screenStyles.fieldBoxTextActive]}>
                    {`${spanStepInput}${activeKeypadTarget === 'span_step' ? ' ▎' : ''}`}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* ================= DIRECT NUMERIC KEYPAD & FREQUENCY ENTRY ================= */}
        <View style={screenStyles.controlCard}>
          <View style={screenStyles.keypadContainerRow}>
            {/* LEFT COLUMN: COMPACT FREQUENCY & BW ENTRY BOXES (DUPLEX, SIMPLEX BASE, SIMPLEX WALKIE) */}
            <View style={screenStyles.entryColumn}>
              {/* 1. DUPLEX SECTION */}
              <View style={screenStyles.entryGroupCard}>
                <Text style={screenStyles.entryGroupTitle}>DUPLEX</Text>
                <View style={screenStyles.entryInputsRow}>
                  {/* Base TX */}
                  <View style={{ flex: 1 }}>
                    <Text style={screenStyles.microLabel}>Base TX</Text>
                    <TouchableOpacity
                      style={[
                        screenStyles.fieldBox,
                        activeKeypadTarget === 'kp_base_tx' && screenStyles.fieldBoxActive
                      ]}
                      onPress={() => setActiveKeypadTarget('kp_base_tx')}
                    >
                      <Text
                        style={[screenStyles.fieldBoxText, activeKeypadTarget === 'kp_base_tx' && screenStyles.fieldBoxTextActive]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.7}
                      >
                        {`${kpBaseTx || '---'}${activeKeypadTarget === 'kp_base_tx' ? ' ▎' : ''}`}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Portable TX */}
                  <View style={{ flex: 1 }}>
                    <Text style={screenStyles.microLabel}>Port TX</Text>
                    <TouchableOpacity
                      style={[
                        screenStyles.fieldBox,
                        activeKeypadTarget === 'kp_port_tx' && screenStyles.fieldBoxActive
                      ]}
                      onPress={() => setActiveKeypadTarget('kp_port_tx')}
                    >
                      <Text
                        style={[screenStyles.fieldBoxText, activeKeypadTarget === 'kp_port_tx' && screenStyles.fieldBoxTextActive]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.7}
                      >
                        {`${kpPortTx || '---'}${activeKeypadTarget === 'kp_port_tx' ? ' ▎' : ''}`}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* BW (kHz) */}
                  <View style={{ width: 29 }}>
                    <Text style={screenStyles.microLabel}>BW</Text>
                    <TouchableOpacity
                      style={[
                        screenStyles.bwBox,
                        activeKeypadTarget === 'kp_duplex_bw' && screenStyles.fieldBoxActive
                      ]}
                      onPress={() => setActiveKeypadTarget('kp_duplex_bw')}
                    >
                      <Text
                        style={[screenStyles.bwBoxText, activeKeypadTarget === 'kp_duplex_bw' && screenStyles.fieldBoxTextActive]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.7}
                      >
                        {`${kpDuplexBw || '12.5'}${activeKeypadTarget === 'kp_duplex_bw' ? ' ▎' : ''}`}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Compact + Button */}
                  <TouchableOpacity style={screenStyles.addMiniBtn} onPress={handleAddDuplexFromKeypad}>
                    <Text style={screenStyles.addMiniBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* 2. SIMPLEX BASE SECTION */}
              <View style={screenStyles.entryGroupCard}>
                <Text style={screenStyles.entryGroupTitle}>SIMPLEX BASE</Text>
                <View style={screenStyles.entryInputsRow}>
                  {/* Simplex Base TX */}
                  <View style={{ flex: 1 }}>
                    <TouchableOpacity
                      style={[
                        screenStyles.fieldBox,
                        activeKeypadTarget === 'kp_simplex_base_tx' && screenStyles.fieldBoxActive
                      ]}
                      onPress={() => setActiveKeypadTarget('kp_simplex_base_tx')}
                    >
                      <Text
                        style={[screenStyles.fieldBoxText, activeKeypadTarget === 'kp_simplex_base_tx' && screenStyles.fieldBoxTextActive]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.7}
                      >
                        {`${kpSimplexBaseTx || '453.02500'}${activeKeypadTarget === 'kp_simplex_base_tx' ? ' ▎' : ''}`}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* BW (kHz) */}
                  <View style={{ width: 29 }}>
                    <TouchableOpacity
                      style={[
                        screenStyles.bwBox,
                        activeKeypadTarget === 'kp_simplex_base_bw' && screenStyles.fieldBoxActive
                      ]}
                      onPress={() => setActiveKeypadTarget('kp_simplex_base_bw')}
                    >
                      <Text
                        style={[screenStyles.bwBoxText, activeKeypadTarget === 'kp_simplex_base_bw' && screenStyles.fieldBoxTextActive]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.7}
                      >
                        {`${kpSimplexBaseBw || '12.5'}${activeKeypadTarget === 'kp_simplex_base_bw' ? ' ▎' : ''}`}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Compact + Button */}
                  <TouchableOpacity style={screenStyles.addMiniBtn} onPress={handleAddSimplexBaseFromKeypad}>
                    <Text style={screenStyles.addMiniBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* 3. SIMPLEX WALKIE SECTION */}
              <View style={screenStyles.entryGroupCard}>
                <Text style={screenStyles.entryGroupTitle}>SIMPLEX WALKIE</Text>
                <View style={screenStyles.entryInputsRow}>
                  {/* Simplex Walkie-Talkie */}
                  <View style={{ flex: 1 }}>
                    <TouchableOpacity
                      style={[
                        screenStyles.fieldBox,
                        activeKeypadTarget === 'kp_walkie_tx' && screenStyles.fieldBoxActive
                      ]}
                      onPress={() => setActiveKeypadTarget('kp_walkie_tx')}
                    >
                      <Text
                        style={[screenStyles.fieldBoxText, activeKeypadTarget === 'kp_walkie_tx' && screenStyles.fieldBoxTextActive]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.7}
                      >
                        {`${kpWalkieTx || '456.00000'}${activeKeypadTarget === 'kp_walkie_tx' ? ' ▎' : ''}`}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* BW (kHz) */}
                  <View style={{ width: 29 }}>
                    <TouchableOpacity
                      style={[
                        screenStyles.bwBox,
                        activeKeypadTarget === 'kp_walkie_bw' && screenStyles.fieldBoxActive
                      ]}
                      onPress={() => setActiveKeypadTarget('kp_walkie_bw')}
                    >
                      <Text
                        style={[screenStyles.bwBoxText, activeKeypadTarget === 'kp_walkie_bw' && screenStyles.fieldBoxTextActive]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.7}
                      >
                        {`${kpWalkieBw || '12.5'}${activeKeypadTarget === 'kp_walkie_bw' ? ' ▎' : ''}`}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Compact + Button */}
                  <TouchableOpacity style={[screenStyles.addMiniBtn, { backgroundColor: '#d97706', borderColor: '#f59e0b' }]} onPress={handleAddWalkieFromKeypad}>
                    <Text style={screenStyles.addMiniBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* 4. INSTRUCTIONAL QUICK-GUIDE & VISUAL DIAGRAM CARD */}
              <View style={screenStyles.instructionsCard}>
                <View style={screenStyles.instructionsHeader}>
                  <Text style={screenStyles.instructionsBadge}>💡 SPECTRUM WORKFLOW GUIDE</Text>
                </View>
                
                <View style={screenStyles.instructionsContent}>
                  {/* Step 1 */}
                  <View style={screenStyles.instructionItem}>
                    <View style={screenStyles.instructionBullet}>
                      <Text style={screenStyles.instructionBulletText}>1</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={screenStyles.instructionTitle}>Inject Frequencies</Text>
                      <Text style={screenStyles.instructionDesc}>
                        Tap any <Text style={{ color: '#38bdf8', fontWeight: 'bold' }}>Tx/Rx</Text> or <Text style={{ color: '#38bdf8', fontWeight: 'bold' }}>BW</Text> box above, enter MHz on the keypad, then tap <Text style={{ color: '#4ade80', fontWeight: 'bold' }}>+</Text> to plot spikes on CRT.
                      </Text>
                    </View>
                  </View>

                  {/* Step 2 */}
                  <View style={screenStyles.instructionItem}>
                    <View style={[screenStyles.instructionBullet, { backgroundColor: '#78350f', borderColor: '#f59e0b' }]}>
                      <Text style={[screenStyles.instructionBulletText, { color: '#fde047' }]}>2</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[screenStyles.instructionTitle, { color: '#f59e0b' }]}>Live Intermod Audit</Text>
                      <Text style={screenStyles.instructionDesc}>
                        Solver tracks 2-Tone (<Text style={{ fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: '#fca5a5' }}>2A-B</Text>) & 3-Tone (<Text style={{ fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: '#fca5a5' }}>A+B-C</Text>) IMD with <Text style={{ color: '#ef4444', fontWeight: 'bold' }}>⚠️</Text> alerts.
                      </Text>
                    </View>
                  </View>

                  {/* Step 3 */}
                  <View style={screenStyles.instructionItem}>
                    <View style={[screenStyles.instructionBullet, { backgroundColor: '#1e1b4b', borderColor: '#818cf8' }]}>
                      <Text style={[screenStyles.instructionBulletText, { color: '#c7d2fe' }]}>3</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[screenStyles.instructionTitle, { color: '#818cf8' }]}>Markers & Fine Tuning</Text>
                      <Text style={screenStyles.instructionDesc}>
                        Drag <Text style={{ color: '#06b6d4', fontWeight: 'bold' }}>M1</Text>/<Text style={{ color: '#f59e0b', fontWeight: 'bold' }}>M2</Text> on CRT for <Text style={{ color: '#ffffff', fontWeight: 'bold' }}>Δ kHz</Text> gaps. Nudge carriers via <Text style={{ color: '#38bdf8' }}>◄ ►</Text> in ledger below.
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Visual Mini Diagram / Legend Footer */}
                <View style={screenStyles.instructionsDiagramRow}>
                  <View style={screenStyles.legendPill}>
                    <View style={[screenStyles.legendDot, { backgroundColor: '#facc15' }]} />
                    <Text style={screenStyles.legendText}>Base TX</Text>
                  </View>
                  <View style={screenStyles.legendPill}>
                    <View style={[screenStyles.legendDot, { backgroundColor: '#38bdf8' }]} />
                    <Text style={screenStyles.legendText}>Port RX</Text>
                  </View>
                  <View style={screenStyles.legendPill}>
                    <View style={[screenStyles.legendDot, { backgroundColor: '#fb923c' }]} />
                    <Text style={screenStyles.legendText}>Walkie</Text>
                  </View>
                  <View style={screenStyles.legendPill}>
                    <View style={[screenStyles.legendDot, { backgroundColor: '#ef4444' }]} />
                    <Text style={screenStyles.legendText}>⚠️ Clash</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* RIGHT COLUMN: THE KEYPAD */}
            <View style={screenStyles.keypadColumn}>
              {/* Active Target Banner */}
              <View style={[screenStyles.keypadTargetBanner, { borderColor: getDedicatedTargetColor(activeKeypadTarget || 'kp_base_tx') }]}>
                <Text style={screenStyles.keypadTargetHeading}>TARGET:</Text>
                <Text style={[screenStyles.keypadTargetValue, { color: getDedicatedTargetColor(activeKeypadTarget || 'kp_base_tx') }]} numberOfLines={1}>
                  {getTargetLabel(activeKeypadTarget || 'kp_base_tx')}
                </Text>
              </View>

              {/* REPLICA / LIVE MIRROR BOX OF TARGETED FIELD */}
              <View style={[screenStyles.keypadReplicaCard, { borderColor: getDedicatedTargetColor(activeKeypadTarget || 'kp_base_tx') }]}>
                <View style={screenStyles.keypadReplicaHeader}>
                  <Text style={screenStyles.keypadReplicaHeading}>MIRROR BOX:</Text>
                  <View style={[screenStyles.keypadReplicaUnitBadge, { borderColor: getDedicatedTargetColor(activeKeypadTarget || 'kp_base_tx') }]}>
                    <Text style={[screenStyles.keypadReplicaUnitText, { color: getDedicatedTargetColor(activeKeypadTarget || 'kp_base_tx') }]}>
                      {getDedicatedTargetUnit(activeKeypadTarget || 'kp_base_tx')}
                    </Text>
                  </View>
                </View>

                <View style={screenStyles.keypadReplicaInputRow}>
                  {/* Stepper Down */}
                  <TouchableOpacity
                    style={screenStyles.keypadReplicaStepBtn}
                    onPress={() => handleDedicatedReplicaStep(-1)}
                    activeOpacity={0.6}
                  >
                    <Text style={[screenStyles.keypadReplicaStepBtnText, { color: getDedicatedTargetColor(activeKeypadTarget || 'kp_base_tx') }]}>-</Text>
                  </TouchableOpacity>

                  {/* Live Replica TextInput */}
                  <TextInput
                    style={[
                      screenStyles.keypadReplicaInput,
                      {
                        color: getDedicatedTargetColor(activeKeypadTarget || 'kp_base_tx'),
                        borderColor: getDedicatedTargetColor(activeKeypadTarget || 'kp_base_tx')
                      }
                    ]}
                    value={getTargetCurrentVal(activeKeypadTarget || 'kp_base_tx')}
                    onChangeText={(text) => updateDedicatedTargetVal(activeKeypadTarget || 'kp_base_tx', text)}
                    keyboardType="decimal-pad"
                    placeholder="0.000"
                    placeholderTextColor="#475569"
                    selectTextOnFocus
                    returnKeyType="done"
                    onSubmitEditing={() => handleKeypadPress('ENTER')}
                  />

                  {/* Stepper Up */}
                  <TouchableOpacity
                    style={screenStyles.keypadReplicaStepBtn}
                    onPress={() => handleDedicatedReplicaStep(1)}
                    activeOpacity={0.6}
                  >
                    <Text style={[screenStyles.keypadReplicaStepBtnText, { color: getDedicatedTargetColor(activeKeypadTarget || 'kp_base_tx') }]}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Numeric Key Grid */}
              <View style={screenStyles.keypadGrid}>
                <View style={screenStyles.keypadRow}>
                  <TouchableOpacity style={screenStyles.keyBtn} onPress={() => handleKeypadPress('1')}>
                    <Text style={screenStyles.keyBtnText}>1</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={screenStyles.keyBtn} onPress={() => handleKeypadPress('2')}>
                    <Text style={screenStyles.keyBtnText}>2</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={screenStyles.keyBtn} onPress={() => handleKeypadPress('3')}>
                    <Text style={screenStyles.keyBtnText}>3</Text>
                  </TouchableOpacity>
                </View>

                <View style={screenStyles.keypadRow}>
                  <TouchableOpacity style={screenStyles.keyBtn} onPress={() => handleKeypadPress('4')}>
                    <Text style={screenStyles.keyBtnText}>4</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={screenStyles.keyBtn} onPress={() => handleKeypadPress('5')}>
                    <Text style={screenStyles.keyBtnText}>5</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={screenStyles.keyBtn} onPress={() => handleKeypadPress('6')}>
                    <Text style={screenStyles.keyBtnText}>6</Text>
                  </TouchableOpacity>
                </View>

                <View style={screenStyles.keypadRow}>
                  <TouchableOpacity style={screenStyles.keyBtn} onPress={() => handleKeypadPress('7')}>
                    <Text style={screenStyles.keyBtnText}>7</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={screenStyles.keyBtn} onPress={() => handleKeypadPress('8')}>
                    <Text style={screenStyles.keyBtnText}>8</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={screenStyles.keyBtn} onPress={() => handleKeypadPress('9')}>
                    <Text style={screenStyles.keyBtnText}>9</Text>
                  </TouchableOpacity>
                </View>

                <View style={screenStyles.keypadRow}>
                  <TouchableOpacity style={screenStyles.keyBtn} onPress={() => handleKeypadPress('.')}>
                    <Text style={screenStyles.keyBtnText}>.</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={screenStyles.keyBtn} onPress={() => handleKeypadPress('0')}>
                    <Text style={screenStyles.keyBtnText}>0</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[screenStyles.keyBtn, screenStyles.keyBtnAction]} onPress={() => handleKeypadPress('BACKSPACE')}>
                    <Text style={screenStyles.keyBtnActionText}>⌫</Text>
                  </TouchableOpacity>
                </View>

                <View style={screenStyles.keypadRow}>
                  <TouchableOpacity style={[screenStyles.keyBtn, screenStyles.keyBtnClear]} onPress={() => handleKeypadPress('CLEAR')}>
                    <Text style={screenStyles.keyBtnClearText}>C</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[screenStyles.keyBtn, screenStyles.keyBtnEnter, { flex: 2 }]} onPress={() => handleKeypadPress('ENTER')}>
                    <Text style={screenStyles.keyBtnEnterText}>ENTER ↵</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* ================= CONFLICTS AUDITOR LEDGER ================= */}
        {conflicts.length > 0 && (
          <View style={screenStyles.conflictCard}>
            <Text style={screenStyles.conflictCardTitle}>
              ⚠️ DETECTED {conflicts.length} SPECTRAL CLASH{conflicts.length > 1 ? 'ES' : ''}
            </Text>
            {conflicts.map((conf, idx) => (
              <View key={`conf_${idx}`} style={screenStyles.conflictRow}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={screenStyles.conflictType}>{conf.type.toUpperCase()} INTERACTION</Text>
                  <Text style={screenStyles.conflictDiff}>Error: {conf.diffKhz.toFixed(1)} kHz (Limit: {conf.thresholdKhz.toFixed(1)} kHz)</Text>
                </View>
                <Text style={screenStyles.conflictDetail}>
                  Target <Text style={{ color: '#ffffff', fontWeight: 'bold' }}>{conf.targetCarrier}</Text> ({conf.targetFreq.toFixed(5)} MHz) clashed by product @ {conf.productFreq.toFixed(5)} MHz (
                  {conf.type === '3-Tone IMD' && conf.carrierC
                    ? `${conf.carrierA} + ${conf.carrierB} - ${conf.carrierC}`
                    : (conf.type === '2-Tone IMD' ? `2*${conf.carrierA} - ${conf.carrierB}` : `${conf.carrierA} ↔ ${conf.carrierB}`)}
                  )
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* ================= COMPATIBLE SET CALCULATOR BUTTON ================= */}
        <View style={screenStyles.calcActionCard}>
          <TouchableOpacity
            style={screenStyles.mainCalcBtn}
            onPress={handleCalculateCompatibleSet}
            disabled={isAutoCalculating}
          >
            <Text style={screenStyles.mainCalcBtnText}>
              {isAutoCalculating ? '⚡ CALCULATING COMPATIBLE SET...' : '⚡ CALCULATE COMPATIBLE SET'}
            </Text>
            <Text style={screenStyles.mainCalcBtnSub}>
              Auto-solves unlocked frequencies to eliminate all 2-tone &amp; 3-tone IMDs
            </Text>
          </TouchableOpacity>
        </View>

        {/* ================= FREQUENCY LEDGER & NUDGE LIST ================= */}
        <View style={screenStyles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
            <Text style={screenStyles.cardTitle}>CHANNEL LEDGER &amp; RASTER NUDGE</Text>
            {/* Step Size Selector */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Text style={{ color: '#94a3b8', fontSize: 8, fontWeight: 'bold' }}>STEP:</Text>
              {[
                { label: '6.25k', khz: 6.25 },
                { label: '12.5k', khz: 12.5 },
                { label: '25k', khz: 25.0 },
                { label: '50k', khz: 50.0 },
                { label: '100k', khz: 100.0 }
              ].map(opt => (
                <TouchableOpacity
                  key={`ledger_step_${opt.khz}`}
                  style={[
                    screenStyles.stepPill,
                    ledgerStepKhz === opt.khz && screenStyles.stepPillActive
                  ]}
                  onPress={() => setLedgerStepKhz(opt.khz)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    screenStyles.stepPillText,
                    ledgerStepKhz === opt.khz && screenStyles.stepPillTextActive
                  ]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={{ marginTop: 4, gap: 5 }}>
            {carriers.length === 0 ? (
              <View style={{ paddingVertical: 18, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#070d18', borderRadius: 6, borderWidth: 1, borderColor: '#1e293b', borderStyle: 'dashed' }}>
                <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: 'bold', marginBottom: 4 }}>NO FREQUENCIES IN SPECTRUM POOL</Text>
                <Text style={{ color: '#64748b', fontSize: 9.5, textAlign: 'center' }}>Enter your own custom frequencies above or tap ⚡ PRESETS to load frequency allocations.</Text>
              </View>
            ) : carriers.map((c, index) => {
              const isBaseHigh = c.type === 'DUPLEX' ? c.tx > c.rx : c.tx > 464;
              return (
                <View key={c.id} style={screenStyles.channelRow}>
                  {/* Active Toggle Dot */}
                  <TouchableOpacity
                    style={[screenStyles.toggleDot, c.active ? screenStyles.toggleDotActive : screenStyles.toggleDotInactive]}
                    onPress={() => {
                      setCarriers(prev => prev.map(item => item.id === c.id ? { ...item, active: !item.active } : item));
                    }}
                    hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                  >
                    <Text style={{ fontSize: 9, color: c.active ? '#10b981' : '#64748b' }}>●</Text>
                  </TouchableOpacity>

                  {/* Channel Number Badge: matches spike number on canvas */}
                  <View style={{ width: 18, height: 19, borderRadius: 3, backgroundColor: '#070f1a', borderWidth: 1, borderColor: '#334155', alignItems: 'center', justifyContent: 'center', marginRight: 1 }}>
                    <Text style={{ color: '#38bdf8', fontSize: 9, fontWeight: '900', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>{index + 1}</Text>
                  </View>

                  {/* Padlock Icon: Next to green on/off toggle dot on left hand side of base tx box */}
                  <TouchableOpacity
                    onPress={() => {
                      setCarriers(prev => prev.map(item => item.id === c.id ? { ...item, locked: !item.locked } : item));
                    }}
                    style={{ width: 18, height: 20, alignItems: 'center', justifyContent: 'center' }}
                    hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                    activeOpacity={0.6}
                  >
                    <HardwarePadlockIcon locked={!!c.locked} size={15} />
                  </TouchableOpacity>

                  {/* Direction / Type Badge (No extra text above, snug spacing) */}
                  <View style={{ marginRight: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <View style={{ flexDirection: 'row', gap: 2, alignItems: 'center' }}>
                      <Text style={screenStyles.channelType}>
                        {c.type === 'DUPLEX' ? 'DPX' : (c.type === 'BASE_TX' ? 'BASE' : (c.type === 'PORT_TX' ? 'PORT' : c.type))}
                      </Text>
                      {c.type === 'DUPLEX' && (
                        <Text style={[
                          screenStyles.directionTag,
                          isBaseHigh ? screenStyles.directionTagEu : screenStyles.directionTagUk
                        ]}>
                          {isBaseHigh ? 'HI' : 'LO'}
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* TX Frequency with Left / Right Nudge Arrows */}
                  <View style={screenStyles.nudgeGroup}>
                    <TouchableOpacity
                      style={[screenStyles.sideArrowBtn, c.locked && { opacity: 0.3 }]}
                      onPress={() => !c.locked && handleCarrierNudge(c.id, 'tx', -1)}
                      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                      disabled={c.locked}
                    >
                      <Text style={screenStyles.sideArrowText}>▼</Text>
                    </TouchableOpacity>
                    <View style={[screenStyles.freqNudgeBox, c.locked && screenStyles.freqNudgeBoxLocked]}>
                      <Text style={[screenStyles.freqNudgePrefix, isBaseHigh && { color: '#38bdf8' }]}>TX</Text>
                      <Text style={[screenStyles.freqNudgeVal, c.locked && { color: "#4ade80" }]}>{c.tx.toFixed(5)}</Text>
                    </View>
                    <TouchableOpacity
                      style={[screenStyles.sideArrowBtn, c.locked && { opacity: 0.3 }]}
                      onPress={() => !c.locked && handleCarrierNudge(c.id, 'tx', 1)}
                      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                      disabled={c.locked}
                    >
                      <Text style={screenStyles.sideArrowText}>▲</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Quick Swap TX/RX for single channel */}
                  {c.type === 'DUPLEX' && (
                    <TouchableOpacity
                      style={screenStyles.rowSwapBtn}
                      onPress={() => !c.locked && handleSwapSingleCarrier(c.id)}
                      disabled={c.locked}
                      title="Swap Base TX and Port RX"
                    >
                      <Text style={screenStyles.rowSwapBtnText}>⇄</Text>
                    </TouchableOpacity>
                  )}

                  {/* RX Frequency (if duplex) with Left / Right Nudge Arrows */}
                  {c.type === 'DUPLEX' ? (
                    <View style={screenStyles.nudgeGroup}>
                      <TouchableOpacity
                        style={[screenStyles.sideArrowBtn, c.locked && { opacity: 0.3 }]}
                        onPress={() => !c.locked && handleCarrierNudge(c.id, 'rx', -1)}
                        hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                        disabled={c.locked}
                      >
                        <Text style={screenStyles.sideArrowText}>▼</Text>
                      </TouchableOpacity>
                      <View style={[screenStyles.freqNudgeBox, c.locked && screenStyles.freqNudgeBoxLocked]}>
                        <Text style={[screenStyles.freqNudgePrefix, { color: isBaseHigh ? '#34d399' : '#38bdf8' }]}>RX</Text>
                        <Text style={[screenStyles.freqNudgeVal, c.locked ? { color: "#4ade80" } : { color: isBaseHigh ? "#86efac" : "#38bdf8" }]}>{c.rx.toFixed(5)}</Text>
                      </View>
                      <TouchableOpacity
                        style={[screenStyles.sideArrowBtn, c.locked && { opacity: 0.3 }]}
                        onPress={() => !c.locked && handleCarrierNudge(c.id, 'rx', 1)}
                        hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                        disabled={c.locked}
                      >
                        <Text style={screenStyles.sideArrowText}>▲</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}

                  {/* Delete Button (inside container box) */}
                  <TouchableOpacity
                    style={{ width: 20, height: 22, alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' }}
                    onPress={() => {
                      setCarriers(prev => prev.filter(item => item.id !== c.id));
                    }}
                    hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                  >
                    <Text style={{ fontSize: 13, color: '#ef4444', fontWeight: 'bold' }}>✕</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* ================= DUPLEX TALKBACK PRESETS MODAL ================= */}
      <Modal
        visible={presetModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setPresetModalVisible(false)}
      >
        <View style={screenStyles.modalBackdrop}>
          <View style={screenStyles.modalCard}>
            {/* Modal Header */}
            <View style={screenStyles.modalHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={screenStyles.modalTitle}>DUPLEX TALKBACK PRESETS</Text>
                <Text style={screenStyles.modalSubtitle}>
                  SELECT DUPLEX PAIRS (UK OFCOM / EU EUROPE / BESPOKE) TO DRAW DIRECTLY ON CANVAS
                </Text>
              </View>
              <TouchableOpacity
                style={screenStyles.modalCloseBtn}
                onPress={() => setPresetModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={screenStyles.modalCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Segment Tabs: UK OFCOM vs EU EUROPE vs BESPOKE */}
            <View style={screenStyles.modalTabRow}>
              <TouchableOpacity
                style={[screenStyles.modalTabBtn, presetTab === 'UK_OFCOM' && screenStyles.modalTabBtnActive]}
                onPress={() => setPresetTab('UK_OFCOM')}
                activeOpacity={0.7}
              >
                <Text style={[screenStyles.modalTabBtnText, presetTab === 'UK_OFCOM' && screenStyles.modalTabBtnTextActive]}>
                  🇬🇧 UK OFCOM (Base Low)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[screenStyles.modalTabBtn, presetTab === 'EU_EUROPE' && screenStyles.modalTabBtnActive]}
                onPress={() => setPresetTab('EU_EUROPE')}
                activeOpacity={0.7}
              >
                <Text style={[screenStyles.modalTabBtnText, presetTab === 'EU_EUROPE' && screenStyles.modalTabBtnTextActive]}>
                  🇪🇺 EU EUROPE (Base High)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[screenStyles.modalTabBtn, presetTab === 'BESPOKE' && screenStyles.modalTabBtnActive]}
                onPress={() => setPresetTab('BESPOKE')}
                activeOpacity={0.7}
              >
                <Text style={[screenStyles.modalTabBtnText, presetTab === 'BESPOKE' && screenStyles.modalTabBtnTextActive]}>
                  ★ BESPOKE ({bespokeDuplexPresets.length})
                </Text>
              </TouchableOpacity>
            </View>

            {/* Inline Bespoke Creator Box (Visible in BESPOKE Tab) */}
            {presetTab === 'BESPOKE' && (
              <View style={screenStyles.bespokeSaveBox}>
                <Text style={screenStyles.bespokeSaveTitle}>SAVE CURRENT SPECTRUM AS NEW BESPOKE PRESET</Text>
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                  <TextInput
                    style={screenStyles.bespokeInput}
                    placeholder="e.g. Festival Main Stage 457/467..."
                    placeholderTextColor="#475569"
                    value={newBespokeName}
                    onChangeText={setNewBespokeName}
                  />
                  <TouchableOpacity
                    style={screenStyles.bespokeSaveBtn}
                    onPress={saveCurrentAsBespokePreset}
                    activeOpacity={0.7}
                  >
                    <Text style={screenStyles.bespokeSaveBtnText}>+ SAVE</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Presets List Scrollable */}
            <ScrollView style={screenStyles.presetScrollArea} showsVerticalScrollIndicator={true}>
              {(() => {
                const listToRender = presetTab === 'UK_OFCOM' 
                  ? UK_DUPLEX_PRESETS 
                  : (presetTab === 'EU_EUROPE' ? EU_DUPLEX_PRESETS : bespokeDuplexPresets);

                if (listToRender.length === 0) {
                  return (
                    <View style={{ padding: 24, alignItems: 'center' }}>
                      <Text style={{ color: '#64748b', fontSize: 11, textAlign: 'center' }}>
                        {presetTab === 'BESPOKE' 
                          ? 'NO BESPOKE PRESETS SAVED YET.\nEnter a name above and tap "+ SAVE" to store your current duplex pairs!'
                          : 'No presets available in this band.'}
                      </Text>
                    </View>
                  );
                }

                return listToRender.map((preset) => {
                  const hasPairs = preset.pairs && preset.pairs.length > 0;
                  const isBaseHigh = preset.duplexMode === 'BASE_HIGH';

                  return (
                    <View key={preset.id} style={screenStyles.presetCard}>
                      <View style={screenStyles.presetCardTop}>
                        <View style={{ flex: 1 }}>
                          <Text style={screenStyles.presetCardName}>{preset.name}</Text>
                          <Text style={screenStyles.presetCardDesc}>{preset.description}</Text>
                        </View>
                        {preset.category === 'BESPOKE' && (
                          <TouchableOpacity
                            style={screenStyles.presetDeleteBtn}
                            onPress={() => deleteBespokePreset(preset.id)}
                            activeOpacity={0.7}
                          >
                            <Text style={screenStyles.presetDeleteBtnText}>🗑</Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Frequency Spec Badges */}
                      <View style={screenStyles.presetBadgesRow}>
                        <View style={[screenStyles.specBadge, { borderColor: isBaseHigh ? '#0284c7' : '#eab308' }]}>
                          <Text style={[screenStyles.specBadgeLabel, { color: isBaseHigh ? '#38bdf8' : '#facc15' }]}>
                            BASE TX ({isBaseHigh ? 'HIGH' : 'LOW'}): {preset.txMin}-{preset.txMax}
                          </Text>
                        </View>
                        <View style={[screenStyles.specBadge, { borderColor: isBaseHigh ? '#10b981' : '#0284c7' }]}>
                          <Text style={[screenStyles.specBadgeLabel, { color: isBaseHigh ? '#34d399' : '#38bdf8' }]}>
                            PORT TX ({isBaseHigh ? 'LOW' : 'HIGH'}): {preset.rxMin}-{preset.rxMax}
                          </Text>
                        </View>
                        <View style={[screenStyles.specBadge, { borderColor: '#9333ea' }]}>
                          <Text style={[screenStyles.specBadgeLabel, { color: '#c084fc' }]}>SPLIT: {preset.split} MHz</Text>
                        </View>
                        <View style={[screenStyles.specBadge, { borderColor: '#334155' }]}>
                          <Text style={[screenStyles.specBadgeLabel, { color: '#94a3b8' }]}>{preset.pairs ? preset.pairs.length : preset.pairCount} PAIRS</Text>
                        </View>
                      </View>

                      {/* Comprehensive Pairs List View (Duplex) */}
                      {hasPairs && (
                        <View style={screenStyles.comprehensiveContainer}>
                          <View style={screenStyles.comprehensiveHeaderRow}>
                            <Text style={screenStyles.comprehensiveHeaderTitle}>
                              DEDICATED PAIRINGS ({preset.pairs.length} PAIRS IN SET)
                            </Text>
                            <TouchableOpacity
                              style={screenStyles.addAllMiniBtn}
                              onPress={() => addAllPresetPairs(preset)}
                              activeOpacity={0.7}
                            >
                              <Text style={screenStyles.addAllMiniBtnText}>+ ADD ALL PAIRS</Text>
                            </TouchableOpacity>
                          </View>

                          <View style={screenStyles.pairsTable}>
                            <View style={screenStyles.pairsTableRowHeader}>
                              <Text style={[screenStyles.pairCell, screenStyles.pairCellHeader, { width: 28 }]}>#</Text>
                              <Text style={[screenStyles.pairCell, screenStyles.pairCellHeader, { flex: 1 }]}>
                                BASE TX ({isBaseHigh ? 'HIGH' : 'LOW'})
                              </Text>
                              <Text style={[screenStyles.pairCell, screenStyles.pairCellHeader, { width: 22, textAlign: 'center' }]}>&lt;-&gt;</Text>
                              <Text style={[screenStyles.pairCell, screenStyles.pairCellHeader, { flex: 1 }]}>
                                PORT RX ({isBaseHigh ? 'LOW' : 'HIGH'})
                              </Text>
                              <Text style={[screenStyles.pairCell, screenStyles.pairCellHeader, { width: 52, textAlign: 'center' }]}>STATUS</Text>
                            </View>
                            {preset.pairs.map((p: { tx: number; rx: number }, pIdx: number) => {
                              const isSelected = isDuplexPairSelected(p.tx, p.rx);
                              return (
                                <TouchableOpacity
                                  key={pIdx}
                                  style={[
                                    screenStyles.pairsTableRow,
                                    pIdx % 2 === 1 && screenStyles.pairsTableRowAlt,
                                    isSelected && screenStyles.pairRowSelected
                                  ]}
                                  activeOpacity={0.7}
                                  onPress={() => toggleDuplexPair(p, preset.name, pIdx)}
                                >
                                  <Text style={[screenStyles.pairCell, screenStyles.pairCellNum, { width: 28 }, isSelected && { color: '#4ade80' }]}>
                                    {isSelected ? '✓' : (pIdx + 1 < 10 ? `0${pIdx + 1}` : pIdx + 1)}
                                  </Text>
                                  <Text style={[
                                    screenStyles.pairCell, 
                                    screenStyles.pairCellTx, 
                                    { flex: 1 }, 
                                    isBaseHigh && { color: '#38bdf8' },
                                    isSelected && { color: '#4ade80' }
                                  ]}>
                                    {p.tx.toFixed(5)}
                                  </Text>
                                  <Text style={[screenStyles.pairCell, screenStyles.pairCellArrow, { width: 22, textAlign: 'center' }]}>⇄</Text>
                                  <Text style={[
                                    screenStyles.pairCell, 
                                    screenStyles.pairCellRx, 
                                    { flex: 1 }, 
                                    isBaseHigh && { color: '#86efac' },
                                    isSelected && { color: '#86efac' }
                                  ]}>
                                    {p.rx.toFixed(5)}
                                  </Text>
                                  <View style={[screenStyles.pairSelectBadge, isSelected ? screenStyles.pairSelectBadgeActive : screenStyles.pairSelectBadgeInactive]}>
                                    <Text style={[screenStyles.pairSelectBadgeText, isSelected && { color: '#4ade80', fontWeight: 'bold' }]}>
                                      {isSelected ? 'ACTIVE' : '+ADD'}
                                    </Text>
                                  </View>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </View>
                      )}
                    </View>
                  );
                });
              })()}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const screenStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617'
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'ios' ? 52 : 44,
    paddingBottom: 12,
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b'
  },
  headerIcon: {
    width: 34,
    height: 34,
    borderRadius: 6,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  headerSub: {
    color: '#94a3b8',
    fontSize: 8.5,
    fontWeight: 'bold'
  },
  closeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#1e293b',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#475569'
  },
  closeBtnText: {
    color: '#ffffff',
    fontSize: 9.5,
    fontWeight: '700'
  },
  statusBanner: {
    padding: 8,
    borderRadius: 6,
    marginBottom: 10,
    borderWidth: 1
  },
  statusBannerClean: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: '#10b981'
  },
  statusBannerClash: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: '#ef4444'
  },
  presetLaunchBtn: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#38bdf8'
  },
  presetLaunchBtnText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  bannerPresetBtn: {
    backgroundColor: '#0c2238',
    borderWidth: 1.2,
    borderColor: '#0284c7',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10
  },
  bannerPresetBtnText: {
    color: '#38bdf8',
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  regionSwitchContainer: {
    backgroundColor: '#070d19',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 10,
    marginBottom: 12
  },
  regionLabel: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 8
  },
  regionGrid: {
    gap: 6
  },
  regionGridRow: {
    flexDirection: 'row',
    gap: 6
  },
  gridBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    minHeight: 36
  },
  gridBtnInactive: {
    backgroundColor: '#0f172a',
    borderColor: '#334155'
  },
  gridBtnActiveUk: {
    backgroundColor: '#854d0e',
    borderColor: '#facc15'
  },
  gridBtnActiveEu: {
    backgroundColor: '#0369a1',
    borderColor: '#38bdf8'
  },
  gridBtnInvert: {
    backgroundColor: '#1e293b',
    borderColor: '#fde047'
  },
  gridBtnClear: {
    backgroundColor: '#2a1215',
    borderColor: '#ef4444'
  },
  gridBtnText: {
    color: '#cbd5e1',
    fontSize: 9.5,
    fontWeight: 'bold',
    textAlign: 'center'
  },
  gridBtnTextActive: {
    color: '#ffffff',
    fontWeight: '900'
  },
  gridBtnInvertText: {
    color: '#fde047',
    fontSize: 9.5,
    fontWeight: '900',
    textAlign: 'center'
  },
  gridBtnClearText: {
    color: '#f87171',
    fontSize: 9.5,
    fontWeight: '900',
    textAlign: 'center'
  },
  swapMiniBtn: {
    backgroundColor: '#1e293b',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#475569',
    alignSelf: 'flex-end',
    marginBottom: 2
  },
  swapMiniBtnText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: 'bold'
  },
  rowSwapBtn: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#334155'
  },
  rowSwapBtnText: {
    color: '#38bdf8',
    fontSize: 9,
    fontWeight: 'bold'
  },
  directionTag: {
    fontSize: 7,
    fontWeight: '900',
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 2,
    overflow: 'hidden'
  },
  directionTagUk: {
    backgroundColor: 'rgba(250, 204, 21, 0.15)',
    color: '#facc15'
  },
  directionTagEu: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    color: '#38bdf8'
  },
  quickBandRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#0a0f1d',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b'
  },
  quickBandBtn: {
    flex: 1,
    paddingVertical: 6,
    backgroundColor: '#1e293b',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155'
  },
  quickBandBtnActive: {
    backgroundColor: '#0284c7',
    borderColor: '#38bdf8'
  },
  quickBandBtnText: {
    color: '#ffffff',
    fontSize: 9.5,
    fontWeight: 'bold',
    letterSpacing: 0.3
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12
  },
  modalCard: {
    width: '100%',
    maxWidth: 620,
    maxHeight: '90%',
    backgroundColor: '#070d18',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#38bdf8',
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 20
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    marginBottom: 10
  },
  modalTitle: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.6
  },
  modalSubtitle: {
    color: '#94a3b8',
    fontSize: 8.5,
    fontWeight: 'bold',
    marginTop: 2
  },
  modalCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#475569'
  },
  modalCloseBtnText: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: 'bold'
  },
  modalTabRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10
  },
  modalTabBtn: {
    flex: 1,
    paddingVertical: 7,
    backgroundColor: '#0f172a',
    borderRadius: 5,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155'
  },
  modalTabBtnActive: {
    backgroundColor: '#0284c7',
    borderColor: '#38bdf8'
  },
  modalTabBtnText: {
    color: '#94a3b8',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  modalTabBtnTextActive: {
    color: '#ffffff'
  },
  bespokeSaveBox: {
    backgroundColor: '#0a101d',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 8,
    marginBottom: 10
  },
  bespokeSaveTitle: {
    color: '#38bdf8',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  bespokeInput: {
    flex: 1,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    color: '#ffffff',
    fontSize: 10.5
  },
  bespokeSaveBtn: {
    backgroundColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center'
  },
  bespokeSaveBtnText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900'
  },
  presetScrollArea: {
    maxHeight: 460
  },
  presetCard: {
    backgroundColor: '#0d1527',
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1e293b'
  },
  presetCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6
  },
  presetCardName: {
    color: '#f8fafc',
    fontSize: 11.5,
    fontWeight: 'bold'
  },
  presetCardDesc: {
    color: '#94a3b8',
    fontSize: 9,
    marginTop: 2,
    lineHeight: 12
  },
  presetDeleteBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  presetDeleteBtnText: {
    fontSize: 12
  },
  presetBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginVertical: 4
  },
  specBadge: {
    backgroundColor: '#050a14',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 3,
    borderWidth: 1
  },
  specBadgeLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    letterSpacing: 0.3
  },
  comprehensiveContainer: {
    backgroundColor: '#050a14',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginTop: 6,
    overflow: 'hidden'
  },
  comprehensiveHeaderRow: {
    backgroundColor: '#0f172a',
    paddingVertical: 5,
    paddingHorizontal: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b'
  },
  comprehensiveHeaderTitle: {
    color: '#38bdf8',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.4
  },
  addAllMiniBtn: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3
  },
  addAllMiniBtnText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: '900'
  },
  pairsTable: {
    paddingHorizontal: 4,
    paddingVertical: 2
  },
  pairsTableRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b'
  },
  pairsTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 4
  },
  pairsTableRowAlt: {
    backgroundColor: 'rgba(255, 255, 255, 0.025)'
  },
  pairCell: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 9.5
  },
  pairCellHeader: {
    color: '#64748b',
    fontWeight: 'bold',
    fontSize: 8
  },
  pairCellNum: {
    color: '#94a3b8',
    fontWeight: 'bold'
  },
  pairCellTx: {
    color: '#facc15',
    fontWeight: 'bold'
  },
  pairCellArrow: {
    color: '#475569',
    fontSize: 9
  },
  pairCellRx: {
    color: '#38bdf8',
    fontWeight: 'bold'
  },
  pairRowSelected: {
    backgroundColor: 'rgba(74, 222, 128, 0.16)',
    borderLeftWidth: 3,
    borderLeftColor: '#4ade80'
  },
  pairSelectBadge: {
    width: 50,
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center'
  },
  pairSelectBadgeActive: {
    backgroundColor: 'rgba(74, 222, 128, 0.25)',
    borderWidth: 1,
    borderColor: '#4ade80'
  },
  pairSelectBadgeInactive: {
    backgroundColor: '#1e293b'
  },
  pairSelectBadgeText: {
    color: '#64748b',
    fontSize: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  statusBannerText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900'
  },
  statusBannerSub: {
    color: '#94a3b8',
    fontSize: 9,
    marginTop: 2
  },
  displayCard: {
    backgroundColor: '#090d16',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 8,
    marginBottom: 10
  },
  readoutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    paddingHorizontal: 4
  },
  readoutLabel: {
    color: '#64748b',
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  readoutDelta: {
    color: '#10b981',
    fontSize: 9,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  canvasWrapper: {
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1e3a5f'
  },
  layerToggleRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 8
  },
  layerToggleBtn: {
    flex: 1,
    paddingVertical: 5,
    paddingHorizontal: 2,
    borderRadius: 4,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155'
  },
  layerToggleBtnUkExcl: {
    flex: 1.45,
    paddingHorizontal: 2
  },
  layerToggleActiveRed: {
    borderColor: '#f43f5e',
    backgroundColor: '#2a111b'
  },
  layerToggleActivePurple: {
    borderColor: '#c084fc',
    backgroundColor: '#261233'
  },
  layerToggleActiveBlue: {
    borderColor: '#38bdf8',
    backgroundColor: '#0c2238'
  },
  layerToggleText: {
    color: '#ffffff',
    fontSize: 7.2,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 0.1
  },
  controlCard: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 10,
    marginBottom: 10
  },
  cardTitle: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase'
  },
  stepSection: {
    marginTop: 6
  },
  stepSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  stepSectionLabel: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: 'bold'
  },
  stepSizeLabel: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: 'bold'
  },
  stepRow: {
    flexDirection: 'row',
    gap: 8
  },
  stepperBox: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 4
  },
  arrowBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#1e293b'
  },
  arrowText: {
    color: '#38bdf8',
    fontSize: 8.5,
    fontWeight: '900'
  },
  stepperInput: {
    flex: 1,
    color: '#ffffff',
    textAlign: 'center',
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    paddingVertical: 4
  },
  stepSizeBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 4,
    paddingHorizontal: 6
  },
  stepSizePrefix: {
    color: '#64748b',
    fontSize: 8.5,
    fontWeight: 'bold',
    marginRight: 4
  },
  stepSizeInput: {
    flex: 1,
    color: '#fde047',
    textAlign: 'center',
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    paddingVertical: 4
  },
  presetPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6
  },
  presetPillHeading: {
    color: '#64748b',
    fontSize: 8,
    fontWeight: 'bold'
  },
  presetPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#1e293b',
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#334155'
  },
  presetPillActive: {
    backgroundColor: '#0284c7',
    borderColor: '#38bdf8'
  },
  presetPillText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: 'bold'
  },
  calcActionCard: {
    marginBottom: 10
  },
  mainCalcBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#60a5fa'
  },
  mainCalcBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  mainCalcBtnSub: {
    color: '#bfdbfe',
    fontSize: 8.5,
    marginTop: 2
  },
  conflictCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: '#ef4444',
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    marginBottom: 10
  },
  conflictCardTitle: {
    color: '#f87171',
    fontSize: 10,
    fontWeight: '900',
    marginBottom: 4
  },
  conflictRow: {
    backgroundColor: '#020617',
    padding: 6,
    borderRadius: 4,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#334155'
  },
  conflictType: {
    color: '#ef4444',
    fontSize: 8.5,
    fontWeight: '900'
  },
  conflictDiff: {
    color: '#fde047',
    fontSize: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  conflictDetail: {
    color: '#94a3b8',
    fontSize: 8.5,
    marginTop: 2
  },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 10,
    marginBottom: 10
  },
  batchBox: {
    backgroundColor: '#020617',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 8
  },
  batchInput: {
    backgroundColor: '#0f172a',
    color: '#ffffff',
    fontSize: 10,
    padding: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#334155',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 4
  },
  batchAddBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 6,
    borderRadius: 4,
    alignItems: 'center',
    marginTop: 6
  },
  batchAddBtnText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: 'bold'
  },
  singleAddRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center'
  },
  inputSubLabel: {
    color: '#94a3b8',
    fontSize: 8.5,
    fontWeight: 'bold',
    marginBottom: 2
  },
  textInput: {
    backgroundColor: '#020617',
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#475569',
    minHeight: 36
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 6,
    backgroundColor: '#1e293b',
    borderRadius: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155'
  },
  typeBtnActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#60a5fa'
  },
  typeBtnText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: 'bold'
  },
  addBtn: {
    backgroundColor: '#10b981',
    paddingVertical: 7,
    borderRadius: 4,
    alignItems: 'center'
  },
  addBtnText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900'
  },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#020617',
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#1e293b',
    gap: 3
  },
  toggleDot: {
    padding: 3
  },
  toggleDotActive: {
    opacity: 1
  },
  toggleDotInactive: {
    opacity: 0.3
  },
  channelLabel: {
    color: '#ffffff',
    fontSize: 8.5,
    fontWeight: 'bold'
  },
  channelType: {
    color: '#64748b',
    fontSize: 7,
    fontWeight: 'bold'
  },
  nudgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2
  },
  sideArrowBtn: {
    width: 17,
    height: 22,
    backgroundColor: '#1e293b',
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#475569'
  },
  sideArrowText: {
    color: '#38bdf8',
    fontSize: 9,
    fontWeight: 'bold'
  },
  freqNudgeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    paddingHorizontal: 4,
    paddingVertical: 3,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 3
  },
  freqNudgeBoxLocked: {
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.08)'
  },
  freqNudgePrefix: {
    color: '#facc15',
    fontSize: 7,
    fontWeight: '900'
  },
  freqNudgeVal: {
    color: '#ffffff',
    fontSize: 8.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: 'bold'
  },
  freqNudgeInput: {
    color: '#ffffff',
    fontSize: 8.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: 'bold',
    padding: 0,
    margin: 0,
    minWidth: 52,
    textAlign: 'center'
  },
  stepPill: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    backgroundColor: '#1e293b',
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#334155'
  },
  stepPillActive: {
    backgroundColor: '#0284c7',
    borderColor: '#38bdf8'
  },
  stepPillText: {
    color: '#94a3b8',
    fontSize: 7.5,
    fontWeight: 'bold'
  },
  stepPillTextActive: {
    color: '#ffffff'
  },
  nudgeArrows: {
    flexDirection: 'column',
    alignItems: 'center'
  },
  nudgeArrowText: {
    color: '#94a3b8',
    fontSize: 7,
    lineHeight: 8
  },
  // ================= KEYPAD & DIRECT ENTRY STYLES =================
  keypadContainerRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'nowrap',
    alignItems: 'stretch'
  },
  keypadColumn: {
    width: 148,
    backgroundColor: '#070f1e',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 5
  },
  keypadTargetBanner: {
    backgroundColor: '#0f172a',
    borderRadius: 4,
    paddingVertical: 3,
    paddingHorizontal: 5,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#334155'
  },
  keypadTargetHeading: {
    color: '#06b6d4',
    fontSize: 7.5,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  keypadTargetValue: {
    color: '#ffffff',
    fontSize: 10.5,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  keypadReplicaCard: {
    backgroundColor: '#030712',
    borderWidth: 1,
    borderColor: '#38bdf8',
    borderRadius: 5,
    padding: 3,
    marginBottom: 4
  },
  keypadReplicaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
    paddingHorizontal: 2
  },
  keypadReplicaHeading: {
    color: '#94a3b8',
    fontSize: 7.5,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  keypadReplicaUnitBadge: {
    backgroundColor: '#0b1329',
    borderRadius: 3,
    paddingHorizontal: 3,
    paddingVertical: 0.5,
    borderWidth: 0.5,
    borderColor: '#38bdf8'
  },
  keypadReplicaUnitText: {
    fontSize: 7.5,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  keypadReplicaInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3
  },
  keypadReplicaStepBtn: {
    width: 22,
    height: 26,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 3,
    justifyContent: 'center',
    alignItems: 'center'
  },
  keypadReplicaStepBtnText: {
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 15
  },
  keypadReplicaInput: {
    flex: 1,
    height: 26,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderRadius: 3,
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
    paddingVertical: 0,
    paddingHorizontal: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  keypadGrid: {
    gap: 4
  },
  keypadRow: {
    flexDirection: 'row',
    gap: 4
  },
  keyBtn: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 5,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36
  },
  keyBtnText: {
    color: '#ffffff',
    fontSize: 14.5,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  keyBtnAction: {
    backgroundColor: '#334155',
    borderColor: '#64748b'
  },
  keyBtnActionText: {
    color: '#38bdf8',
    fontSize: 13.5,
    fontWeight: 'bold'
  },
  keyBtnClear: {
    flex: 1,
    backgroundColor: '#271c1f',
    borderColor: '#ef4444'
  },
  keyBtnClearText: {
    color: '#f87171',
    fontSize: 10.5,
    fontWeight: '900'
  },
  keyBtnEnter: {
    backgroundColor: '#0284c7',
    borderColor: '#38bdf8'
  },
  keyBtnEnterText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  entryColumn: {
    flex: 1,
    gap: 4,
    justifyContent: 'flex-start',
    display: 'flex',
    flexDirection: 'column'
  },
  instructionsCard: {
    backgroundColor: '#040b17',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 6,
    marginTop: 2,
    flex: 1,
    justifyContent: 'space-between',
    minHeight: 110,
  },
  instructionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  instructionsBadge: {
    color: '#38bdf8',
    fontSize: 7.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  instructionsContent: {
    gap: 4,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
  },
  instructionBullet: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#0c4a6e',
    borderWidth: 1,
    borderColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  instructionBulletText: {
    color: '#38bdf8',
    fontSize: 8,
    fontWeight: 'bold',
  },
  instructionTitle: {
    color: '#e2e8f0',
    fontSize: 8,
    fontWeight: 'bold',
  },
  instructionDesc: {
    color: '#94a3b8',
    fontSize: 7.2,
    lineHeight: 9.5,
  },
  instructionsDiagramRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#020617',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#1e293b',
    paddingHorizontal: 4,
    paddingVertical: 3,
    marginTop: 4,
  },
  legendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  legendDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  legendText: {
    color: '#cbd5e1',
    fontSize: 7,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  entryGroupCard: {
    backgroundColor: '#070f1e',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 5
  },
  entryGroupTitle: {
    color: '#38bdf8',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.4,
    marginBottom: 3
  },
  entryInputsRow: {
    flexDirection: 'row',
    gap: 3,
    alignItems: 'flex-end'
  },
  microLabel: {
    color: '#94a3b8',
    fontSize: 7,
    fontWeight: 'bold',
    marginBottom: 1
  },
  fieldBox: {
    backgroundColor: '#020617',
    borderWidth: 1.2,
    borderColor: '#334155',
    borderRadius: 4,
    paddingHorizontal: 2,
    paddingVertical: 2,
    minHeight: 25,
    justifyContent: 'center',
    alignItems: 'center'
  },
  fieldBoxActive: {
    borderColor: '#38bdf8',
    borderWidth: 1.5,
    backgroundColor: '#042235',
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 6,
    // @ts-ignore
    boxShadow: '0 0 8px rgba(56, 189, 248, 0.85), 0 0 16px rgba(56, 189, 248, 0.4), inset 0 0 4px rgba(56, 189, 248, 0.35)',
    // @ts-ignore
    animation: Platform.OS === 'web' ? 'activeInputGlowPulse 1.8s infinite ease-in-out' : undefined,
  },
  fieldBoxText: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: -0.3,
    textAlign: 'center'
  },
  fieldBoxTextActive: {
    color: '#ffffff',
    fontWeight: '900'
  },
  bwBox: {
    width: 29,
    backgroundColor: '#020617',
    borderWidth: 1.2,
    borderColor: '#334155',
    borderRadius: 4,
    paddingHorizontal: 0,
    paddingVertical: 2,
    minHeight: 25,
    justifyContent: 'center',
    alignItems: 'center'
  },
  bwBoxText: {
    color: '#94a3b8',
    fontSize: 8.5,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: -0.5,
    textAlign: 'center'
  },
  addMiniBtn: {
    width: 22,
    height: 25,
    backgroundColor: '#059669',
    borderWidth: 1,
    borderColor: '#10b981',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center'
  },
  addMiniBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 15
  },
  stepperInputText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    textAlign: 'center'
  },
  stepSizeInputText: {
    color: '#fde047',
    fontSize: 10.5,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    textAlign: 'center'
  }
});


// ================= INLINE COMPONENT: TALKBACK IMD INSPECTOR (SIMPLIFIED) =================

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
  onFrequenciesChange?: (freqs: number[]) => void;
}

export const ImdTalkbackInspector: React.FC<ImdTalkbackInspectorProps> = ({
  initialFrequencies,
  onFrequenciesChange
}) => {
  // Free text input for rapid pasting (space, comma, or newline separated)
  const [inputText, setInputText] = useState<string>(
    initialFrequencies && initialFrequencies.length > 0
      ? initialFrequencies.map(f => f.toFixed(5)).join('\n')
      : ''
  );

  // Parsed frequencies list
  const [frequencies, setFrequencies] = useState<number[]>(
    initialFrequencies && initialFrequencies.length > 0
      ? initialFrequencies
      : []
  );

  // Notify parent on initial mount
  React.useEffect(() => {
    if (onFrequenciesChange) {
      onFrequenciesChange(frequencies);
    }
  }, []);

  // Single frequency quick-add input
  const [newFreqInput, setNewFreqInput] = useState<string>('');

  // Results of the analysis
  const [hasAnalyzed, setHasAnalyzed] = useState<boolean>(true);
  const [isKeypadActive, setIsKeypadActive] = useState<boolean>(true);
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

  // Numeric Keypad Handler for IMD Inspector
  const handleKeypadPress = (val: string) => {
    setIsKeypadActive(true);
    if (val === 'CLEAR') {
      setNewFreqInput('');
    } else if (val === 'BACKSPACE') {
      setNewFreqInput(prev => prev.slice(0, -1));
    } else if (val === 'ENTER') {
      handleAddSingleFreq();
    } else {
      if (val === '.' && newFreqInput.includes('.')) return;
      if (newFreqInput.length >= 10) return;
      setNewFreqInput(prev => prev + val);
    }
  };

  // Parse text into sorted, unique frequencies within 400 - 470 MHz range (excluding restricted frequencies)
  const parseFrequencies = (text: string): number[] => {
    const tokens = text.split(/[\s,;\n\r]+/);
    const parsed: number[] = [];
    tokens.forEach(tok => {
      const val = parseFloat(tok.trim());
      if (!isNaN(val) && val >= 380 && val <= 500) {
        const check = isFrequencyRestricted(val);
        if (!check.isRestricted) {
          parsed.push(Number(val.toFixed(5)));
        }
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
    if (onFrequenciesChange) {
      onFrequenciesChange(list);
    }
  };

  // Add a single frequency
  const handleAddSingleFreq = () => {
    const val = parseFloat(newFreqInput.trim());
    if (isNaN(val) || val < 380 || val > 500) {
      Alert.alert('Invalid Frequency', 'Please enter a valid talkback frequency between 400.000 and 470.000 MHz.');
      return;
    }

    const check = isFrequencyRestricted(val);
    if (check.isRestricted) {
      Alert.alert('Restricted Frequency', `⛔ ${check.reason}\n\nThis frequency is restricted and cannot be added.`);
      return;
    }

    const updated = Array.from(new Set([...frequencies, Number(val.toFixed(5))])).sort((a, b) => a - b);
    setFrequencies(updated);
    setInputText(updated.map(f => f.toFixed(5)).join('\n'));
    setNewFreqInput('');
    if (onFrequenciesChange) {
      onFrequenciesChange(updated);
    }
    runAnalysis(updated);
  };

  // Remove a frequency
  const handleRemoveFreq = (freqToRemove: number) => {
    const updated = frequencies.filter(f => f !== freqToRemove);
    setFrequencies(updated);
    setInputText(updated.map(f => f.toFixed(5)).join('\n'));
    if (onFrequenciesChange) {
      onFrequenciesChange(updated);
    }
    runAnalysis(updated);
  };

  return (
    <View style={tbStyles.inspectorWrapper}>
      {/* TOP ROW: LEFT INSPECTOR BOX + RIGHT NUMERIC KEYPAD */}
      <View style={tbStyles.outerLayoutRow}>
        {/* LEFT COLUMN: THE TALKBACK IMD COMPATIBILITY INSPECTOR BOX */}
        <View style={tbStyles.container}>
          {/* Header Bar - Clean left-aligned without lightning bolt icon */}
          <View style={tbStyles.header}>
            <View style={{ flex: 1 }}>
              <Text style={tbStyles.headerTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                TALKBACK IMD COMPATIBILITY INSPECTOR
              </Text>
              <Text style={tbStyles.headerSub}>UHF 400-470 MHz • 2-TX &amp; 3-TX 3RD ORDER (±12.5 kHz)</Text>
            </View>
          </View>

          {/* Input Section */}
          <View style={[tbStyles.inputCard, { flex: 1, display: 'flex', flexDirection: 'column' }]}>
            <Text style={tbStyles.sectionLabel}>ENTER TALKBACK FREQUENCIES TO TEST (400-470 MHz)</Text>
            
            {/* Quick Add Row with Numeric Keypad Target */}
            <View style={tbStyles.addRow}>
              <TouchableOpacity 
                style={[
                  tbStyles.singleInputBox,
                  isKeypadActive && tbStyles.singleInputBoxActive
                ]}
                onPress={() => setIsKeypadActive(true)}
                activeOpacity={0.8}
              >
                <Text style={[
                  tbStyles.singleInputText,
                  !newFreqInput && { color: '#64748b' }
                ]}>
                  {newFreqInput ? `${newFreqInput}${isKeypadActive ? ' ▎' : ''}` : (isKeypadActive ? '▎' : 'e.g. 455.03125')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={tbStyles.addBtn} onPress={handleAddSingleFreq}>
                <Text style={tbStyles.addBtnText}>+ ADD FREQ</Text>
              </TouchableOpacity>
            </View>

            {/* Free-form paste box */}
            <Text style={[tbStyles.subLabel, { marginTop: 5 }]}>Or paste multiple frequencies (space, comma, or line separated):</Text>
            <TextInput
              style={tbStyles.multiTextInput}
              multiline
              numberOfLines={3}
              placeholder="455.03125, 455.19375, 455.35625, 468.05625..."
              placeholderTextColor="#475569"
              value={inputText}
              onChangeText={(txt) => {
                setInputText(txt);
                const parsed = parseFrequencies(txt);
                setFrequencies(parsed);
                if (onFrequenciesChange) {
                  onFrequenciesChange(parsed);
                }
              }}
            />
          </View>
        </View>

        {/* RIGHT COLUMN: DEDICATED NUMERIC KEYPAD */}
        <View style={tbStyles.keypadCard}>
          <View>
            {/* Active Target Banner */}
            <View style={tbStyles.keypadBanner}>
              <Text style={tbStyles.keypadBannerHeading}>TARGET:</Text>
              <Text style={tbStyles.keypadBannerValue} numberOfLines={1}>
                {newFreqInput ? `${newFreqInput} MHz` : 'FREQ TO ADD'}
              </Text>
            </View>

            {/* Numeric Key Grid */}
            <View style={tbStyles.keypadGrid}>
              <View style={tbStyles.keypadRow}>
                <TouchableOpacity style={tbStyles.keyBtn} onPress={() => handleKeypadPress('1')}>
                  <Text style={tbStyles.keyBtnText}>1</Text>
                </TouchableOpacity>
                <TouchableOpacity style={tbStyles.keyBtn} onPress={() => handleKeypadPress('2')}>
                  <Text style={tbStyles.keyBtnText}>2</Text>
                </TouchableOpacity>
                <TouchableOpacity style={tbStyles.keyBtn} onPress={() => handleKeypadPress('3')}>
                  <Text style={tbStyles.keyBtnText}>3</Text>
                </TouchableOpacity>
              </View>

              <View style={tbStyles.keypadRow}>
                <TouchableOpacity style={tbStyles.keyBtn} onPress={() => handleKeypadPress('4')}>
                  <Text style={tbStyles.keyBtnText}>4</Text>
                </TouchableOpacity>
                <TouchableOpacity style={tbStyles.keyBtn} onPress={() => handleKeypadPress('5')}>
                  <Text style={tbStyles.keyBtnText}>5</Text>
                </TouchableOpacity>
                <TouchableOpacity style={tbStyles.keyBtn} onPress={() => handleKeypadPress('6')}>
                  <Text style={tbStyles.keyBtnText}>6</Text>
                </TouchableOpacity>
              </View>

              <View style={tbStyles.keypadRow}>
                <TouchableOpacity style={tbStyles.keyBtn} onPress={() => handleKeypadPress('7')}>
                  <Text style={tbStyles.keyBtnText}>7</Text>
                </TouchableOpacity>
                <TouchableOpacity style={tbStyles.keyBtn} onPress={() => handleKeypadPress('8')}>
                  <Text style={tbStyles.keyBtnText}>8</Text>
                </TouchableOpacity>
                <TouchableOpacity style={tbStyles.keyBtn} onPress={() => handleKeypadPress('9')}>
                  <Text style={tbStyles.keyBtnText}>9</Text>
                </TouchableOpacity>
              </View>

              <View style={tbStyles.keypadRow}>
                <TouchableOpacity style={tbStyles.keyBtn} onPress={() => handleKeypadPress('.')}>
                  <Text style={tbStyles.keyBtnText}>.</Text>
                </TouchableOpacity>
                <TouchableOpacity style={tbStyles.keyBtn} onPress={() => handleKeypadPress('0')}>
                  <Text style={tbStyles.keyBtnText}>0</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[tbStyles.keyBtn, tbStyles.keyBtnAction]} onPress={() => handleKeypadPress('BACKSPACE')}>
                  <Text style={tbStyles.keyBtnActionText}>⌫</Text>
                </TouchableOpacity>
              </View>

              <View style={tbStyles.keypadRow}>
                <TouchableOpacity style={[tbStyles.keyBtn, tbStyles.keyBtnClear]} onPress={() => handleKeypadPress('CLEAR')}>
                  <Text style={tbStyles.keyBtnClearText}>C</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[tbStyles.keyBtn, tbStyles.keyBtnEnter, { flex: 2 }]} onPress={() => handleKeypadPress('ENTER')}>
                  <Text style={tbStyles.keyBtnEnterText}>+ ADD ↵</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <Text style={tbStyles.keypadHint}>Tap box &amp; enter freq</Text>
        </View>
      </View>

      {/* FULL-WIDTH CARD UNDERNEATH: ACTION BUTTONS & CURRENT FREQUENCY POOL */}
      <View style={tbStyles.bottomControlCard}>
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
              if (onFrequenciesChange) {
                onFrequenciesChange([]);
              }
            }}
          >
            <Text style={tbStyles.clearBtnText}>CLEAR</Text>
          </TouchableOpacity>
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
                    <Text style={tbStyles.chipDeleteText}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

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
  inspectorWrapper: {
    gap: 8
  },
  outerLayoutRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'stretch'
  },
  container: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#0a0d14',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column'
  },
  header: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b'
  },
  headerTitle: {
    color: '#f8fafc',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  headerSub: {
    color: '#38bdf8',
    fontSize: 7.5,
    fontWeight: 'bold',
    marginTop: 1
  },
  inputCard: {
    padding: 8,
    backgroundColor: '#060a12'
  },
  sectionLabel: {
    color: '#94a3b8',
    fontSize: 8,
    fontWeight: 'bold',
    marginBottom: 5,
    letterSpacing: 0.5
  },
  subLabel: {
    color: '#64748b',
    fontSize: 7.5,
    fontWeight: '600'
  },
  addRow: {
    flexDirection: 'row',
    gap: 6
  },
  singleInputBox: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minHeight: 28,
    justifyContent: 'center'
  },
  singleInputBoxActive: {
    borderColor: '#38bdf8',
    borderWidth: 1.5,
    backgroundColor: '#082f49',
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 6,
    // @ts-ignore
    boxShadow: '0 0 8px rgba(56, 189, 248, 0.85), 0 0 16px rgba(56, 189, 248, 0.4), inset 0 0 4px rgba(56, 189, 248, 0.35)',
    // @ts-ignore
    animation: Platform.OS === 'web' ? 'activeInputGlowPulse 1.8s infinite ease-in-out' : undefined,
  },
  singleInputText: {
    color: '#f8fafc',
    fontSize: 10.5,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  addBtn: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 10,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center'
  },
  addBtnText: {
    color: '#ffffff',
    fontSize: 8.5,
    fontWeight: '900'
  },
  multiTextInput: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 4,
    padding: 6,
    marginTop: 3,
    color: '#38bdf8',
    fontSize: 9.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    minHeight: 44,
    textAlignVertical: 'top'
  },
  bottomControlCard: {
    backgroundColor: '#0a0d14',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 8,
    gap: 8
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8
  },
  analyzeBtn: {
    flex: 2,
    backgroundColor: '#22c55e',
    paddingVertical: 7,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center'
  },
  analyzeBtnText: {
    color: '#052e16',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.8
  },
  clearBtn: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 7,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center'
  },
  clearBtnText: {
    color: '#f8fafc',
    fontSize: 8.5,
    fontWeight: 'bold'
  },
  chipContainer: {
    padding: 6,
    backgroundColor: '#0c121e',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1e293b'
  },
  chipTitle: {
    color: '#94a3b8',
    fontSize: 7.5,
    fontWeight: 'bold',
    marginBottom: 4
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5
  },
  freqChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1e293b',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#334155'
  },
  freqChipText: {
    color: '#facc15',
    fontSize: 8.5,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  chipDeleteBtn: {
    padding: 1
  },
  chipDeleteText: {
    color: '#f87171',
    fontSize: 8.5,
    fontWeight: 'bold'
  },
  resultsCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    overflow: 'hidden',
    backgroundColor: '#060a12'
  },
  // KEYPAD STYLES ON RIGHT-HAND SIDE
  keypadCard: {
    width: 148,
    backgroundColor: '#070d18',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 5,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    zIndex: 10
  },
  keypadBanner: {
    backgroundColor: '#030712',
    borderWidth: 1,
    borderColor: '#38bdf8',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 3,
    marginBottom: 4,
    alignItems: 'center'
  },
  keypadBannerHeading: {
    color: '#94a3b8',
    fontSize: 7.5,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  keypadBannerValue: {
    color: '#38bdf8',
    fontSize: 10.5,
    fontWeight: 'bold',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  keypadGrid: {
    gap: 3
  },
  keypadRow: {
    flexDirection: 'row',
    gap: 3
  },
  keyBtn: {
    flex: 1,
    minHeight: 36,
    backgroundColor: '#1e293b',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 5
  },
  keyBtnText: {
    color: '#f8fafc',
    fontSize: 14.5,
    fontWeight: 'bold'
  },
  keyBtnAction: {
    backgroundColor: '#334155',
    borderColor: '#475569'
  },
  keyBtnActionText: {
    color: '#38bdf8',
    fontSize: 13.5,
    fontWeight: 'bold'
  },
  keyBtnClear: {
    backgroundColor: '#7f1d1d',
    borderColor: '#b91c1c'
  },
  keyBtnClearText: {
    color: '#fca5a5',
    fontSize: 10.5,
    fontWeight: '900'
  },
  keyBtnEnter: {
    backgroundColor: '#065f46',
    borderColor: '#10b981'
  },
  keyBtnEnterText: {
    color: '#a7f3d0',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  keypadHint: {
    color: '#64748b',
    fontSize: 7,
    textAlign: 'center',
    marginTop: 2,
    fontStyle: 'italic'
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


// ================= EMBEDDED SELF-CONTAINED SUB-COMPONENTS & RF MATH =================
// app/utils/rfMath.ts

export const toHz = (mhz: number) => Math.round(mhz * 1000000);

export const checkCompatibility = (
    cand, 
    existingPlan, 
    candZoneId, 
    isZoneCoupled // function(zoneA, zoneB) => boolean
) => {
    // 0. STRICT REGULATORY RESTRICTIONS CHECK:
    // Never allow any frequency that lands on a restricted spot or inside a restricted range
    if (cand.tx > 0 && isFrequencyRestricted(cand.tx).isRestricted) return false;
    if (cand.rx > 0 && isFrequencyRestricted(cand.rx).isRestricted) return false;

    // Spacing constraints:
    // SAME ZONE: Frequencies in the same zone MUST be separated by at least 25 kHz (0.025 MHz).
    // Adjacent 12.5 kHz channels are strictly forbidden in the same zone to eliminate filter bleed.
    const SAME_ZONE_MIN_SEP_HZ = toHz(0.02499); // >= 25 kHz required in same zone (<24.99 kHz is clash)
    // ACROSS DISTINCT ZONES: Co-channel clearance (<12.5 kHz is clash, >=12.5 kHz is clear)
    const INTER_ZONE_MIN_SEP_HZ = toHz(0.0125);
    const IMD_HZ = toHz(0.0125);        // 12.5 kHz IMD avoidance window (<12.5 kHz is clash, >=12.5 kHz is clear)

    const candTxHz = toHz(cand.tx);
    const candRxHz = cand.rx > 0 ? toHz(cand.rx) : 0;

    // 1. FREQUENCY SEPARATION CHECK ACROSS ALL EXISTING CHANNELS
    for (let i = 0; i < existingPlan.length; i++) {
        const other = existingPlan[i];
        const otherTxHz = toHz(other.tx);
        const otherRxHz = other.rx > 0 ? toHz(other.rx) : 0;
        const isSameZone = (other.zoneId === candZoneId);

        // Required minimum frequency separation:
        // In the same zone: MUST be at least 25 kHz away (adjacent channels / 12.5 kHz bleed is strictly forbidden)
        // Across different zones: MUST not be co-channel (< 12.5 kHz)
        const minSepHz = isSameZone ? SAME_ZONE_MIN_SEP_HZ : INTER_ZONE_MIN_SEP_HZ;

        // Candidate TX vs Other TX & RX
        if (cand.tx > 0) {
            if (otherTxHz > 0 && Math.abs(candTxHz - otherTxHz) < minSepHz) return false;
            if (otherRxHz > 0 && Math.abs(candTxHz - otherRxHz) < minSepHz) return false;
        }

        // Candidate RX vs Other TX & RX
        if (candRxHz > 0) {
            if (otherTxHz > 0 && Math.abs(candRxHz - otherTxHz) < minSepHz) return false;
            if (otherRxHz > 0 && Math.abs(candRxHz - otherRxHz) < minSepHz) return false;
        }
    }

    // Candidate self TX-RX spacing check (must be at least 25 kHz)
    if (cand.tx > 0 && candRxHz > 0 && Math.abs(candTxHz - candRxHz) < SAME_ZONE_MIN_SEP_HZ) return false;

    // 2. WALKIE-TALKIE / PTT EXEMPTION
    if (cand.simplexType === 'walkie') {
        return true; 
    }

    // 3. SPATIAL INTERMODULATION CHECK
    const coupledTxHzs = [];
    const coupledVictimHzs = [];

    for (let i = 0; i < existingPlan.length; i++) {
        const p = existingPlan[i];
        const otherZoneId = p.zoneId;

        const isCoupled = (otherZoneId === candZoneId) || isZoneCoupled(candZoneId, otherZoneId);

        if (isCoupled) {
            if (p.tx > 0) {
                const hz = toHz(p.tx);
                if (p.txIsBase !== false) coupledTxHzs.push(hz);
                coupledVictimHzs.push(hz);
            }
            if (p.rx > 0) {
                const hz = toHz(p.rx);
                if (p.rxIsBase === true) coupledTxHzs.push(hz);
                coupledVictimHzs.push(hz);
            }
        }
    }

    const fullVictims = [...coupledVictimHzs];
    if (cand.tx > 0) fullVictims.push(candTxHz);
    if (candRxHz > 0) fullVictims.push(candRxHz);

    // A) Candidate as victim of coupled continuous emitters
    if (cand.tx > 0 || candRxHz > 0) {
        for (let a = 0; a < coupledTxHzs.length; a++) {
            const f1 = coupledTxHzs[a];
            for (let b = 0; b < coupledTxHzs.length; b++) {
                if (a === b) continue;
                const p2 = 2 * f1 - coupledTxHzs[b];
                if (cand.tx > 0 && Math.abs(candTxHz - p2) < IMD_HZ) return false;
                if (candRxHz > 0 && Math.abs(candRxHz - p2) < IMD_HZ) return false;
            }
        }
        for (let a = 0; a < coupledTxHzs.length; a++) {
            const f1 = coupledTxHzs[a];
            for (let b = a + 1; b < coupledTxHzs.length; b++) {
                const f2 = coupledTxHzs[b];
                for (let c = b + 1; c < coupledTxHzs.length; c++) {
                    const f3 = coupledTxHzs[c];
                    const p3a = f1 + f2 - f3;
                    const p3b = f1 + f3 - f2;
                    const p3c = f2 + f3 - f1;
                    if (cand.tx > 0) {
                        if (Math.abs(candTxHz - p3a) < IMD_HZ) return false;
                        if (Math.abs(candTxHz - p3b) < IMD_HZ) return false;
                        if (Math.abs(candTxHz - p3c) < IMD_HZ) return false;
                    }
                    if (candRxHz > 0) {
                        if (Math.abs(candRxHz - p3a) < IMD_HZ) return false;
                        if (Math.abs(candRxHz - p3b) < IMD_HZ) return false;
                        if (Math.abs(candRxHz - p3c) < IMD_HZ) return false;
                    }
                }
            }
        }
    }

    // B) Candidate TX causes IMD with coupled transmitters that strikes a coupled victim
    if (cand.tx > 0 && cand.txIsBase !== false) {
        for (let i = 0; i < fullVictims.length; i++) {
            const vHz = fullVictims[i];
            for (let j = 0; j < coupledTxHzs.length; j++) {
                const p2a = 2 * candTxHz - coupledTxHzs[j];
                const p2b = 2 * coupledTxHzs[j] - candTxHz;
                if (Math.abs(vHz - p2a) < IMD_HZ) return false;
                if (Math.abs(vHz - p2b) < IMD_HZ) return false;
            }
            for (let a = 0; a < coupledTxHzs.length; a++) {
                const f1 = coupledTxHzs[a];
                for (let b = a + 1; b < coupledTxHzs.length; b++) {
                    const f2 = coupledTxHzs[b];
                    const p3a = candTxHz + f1 - f2;
                    const p3b = candTxHz + f2 - f1;
                    const p3c = f1 + f2 - candTxHz;
                    if (Math.abs(vHz - p3a) < IMD_HZ) return false;
                    if (Math.abs(vHz - p3b) < IMD_HZ) return false;
                    if (Math.abs(vHz - p3c) < IMD_HZ) return false;
                }
            }
        }
    }

    return true;
};

export const calculateIMDs = (transmitters) => {
    const twoTone = [];
    const threeTone = [];
    const activeTx = (transmitters || []).filter(t => t.txIsBase !== false && t.freq > 0);
    const txHzs = activeTx.map(t => toHz(t.freq));

    for (let a = 0; a < txHzs.length; a++) {
        const f1 = txHzs[a];
        for (let b = 0; b < txHzs.length; b++) {
            if (a === b) continue;
            const p2 = 2 * f1 - txHzs[b];
            twoTone.push({ 
                freq: p2 / 1000000, type: '2-Tone', color: '#ef4444',
                desc: `2*${(f1/1000000).toFixed(5)} - ${(txHzs[b]/1000000).toFixed(5)}`
            });
        }
    }

    for (let a = 0; a < txHzs.length; a++) {
        const f1 = txHzs[a];
        for (let b = a + 1; b < txHzs.length; b++) {
            const f2 = txHzs[b];
            for (let c = b + 1; c < txHzs.length; c++) {
                const f3 = txHzs[c];
                const p3a = f1 + f2 - f3;
                const p3b = f1 + f3 - f2;
                const p3c = f2 + f3 - f1;
                
                const add3Tone = (val, fA, fB, fC) => {
                    threeTone.push({
                        freq: val / 1000000, type: '3-Tone', color: '#a855f7', 
                        desc: `${(fA/1000000).toFixed(5)} + ${(fB/1000000).toFixed(5)} - ${(fC/1000000).toFixed(5)}`
                    });
                };
                
                add3Tone(p3a, f1, f2, f3);
                add3Tone(p3b, f1, f3, f2);
                add3Tone(p3c, f2, f3, f1);
            }
        }
    }
    return [...twoTone, ...threeTone];
};

const createShuffledPool = (min, max, step) => {
    const pool = [];
    const minHz = toHz(min);
    const maxHz = toHz(max);
    const stepHz = toHz(step);
    for (let hz = minHz; hz <= maxHz; hz += stepHz) {
        const freqMhz = hz / 1000000;
        if (!isFrequencyRestricted(freqMhz).isRestricted) {
            pool.push(freqMhz);
        }
    }
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool;
};

// Full Multi-Zone Coordinator supporting Custom Portable TX / RX Ranges, Dedicated Bands & Multi-Pass Optimization
export const coordinateAllZones = ({
    zones = [],
    zoneDistances = {},
    zoneOverrides = {},
    existingPlan = [],
    iterations = 200
}) => {
    const isZoneCoupled = (zA, zB) => {
        if (zA === zB) return true;
        const key1 = `${zA}_${zB}`;
        const key2 = `${zB}_${zA}`;

        if (zoneOverrides[key1] !== undefined) return zoneOverrides[key1];
        if (zoneOverrides[key2] !== undefined) return zoneOverrides[key2];

        const dist = zoneDistances[key1] !== undefined ? zoneDistances[key1] : (zoneDistances[key2] !== undefined ? zoneDistances[key2] : 30);
        return dist < 26.0;
    };

    // Only locked channels are preserved across coordination runs
    const lockedPlan = (existingPlan || []).filter(p => p && p.locked);

    // Calculate total requested channels
    let totalTargetCount = lockedPlan.length;
    zones.forEach(zone => {
        (zone.duplexBands || []).forEach(b => { totalTargetCount += (parseInt(b.pairCount) || 0); });
        if (zone.enableBaseSimplex) {
            (zone.baseSimplexBands || []).forEach(b => { totalTargetCount += (parseInt(b.count) || 0); });
        }
        if (zone.enableWalkieSimplex) {
            (zone.walkieSimplexBands || []).forEach(b => { totalTargetCount += (parseInt(b.count) || 0); });
        }
    });

    let bestPlan = [...lockedPlan];
    let bestScore = lockedPlan.length;

    // Run multi-attempt stochastic optimization to find the largest compatible clash-free set
    const numAttempts = Math.max(iterations, 100);

    for (let attempt = 0; attempt < numAttempts; attempt++) {
        const currentPlan = [...lockedPlan];

        // Shuffle zone processing order periodically to balance frequency allocation
        const zoneList = [...zones];
        if (attempt > 0) {
            for (let i = zoneList.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [zoneList[i], zoneList[j]] = [zoneList[j], zoneList[i]];
            }
        }

        for (const zone of zoneList) {
            const zoneId = zone.id;
            const zoneName = zone.name || `Zone ${zoneId}`;

            // 1. DUPLEX BANDS FOR THIS ZONE
            (zone.duplexBands || []).forEach((band, bandIndex) => {
                const targetCount = parseInt(band.pairCount) || 0;
                const bMin = parseFloat(band.txMin) || 450.0;
                const bMax = parseFloat(band.txMax) || 455.0;
                const bStep = (parseFloat(band.bw) || 12.5) / 1000;
                const bandId = band.id || `dup_${zoneId}_${bandIndex + 1}`;

                // Parse custom split and RX range
                const customSplit = band.split !== undefined && band.split !== '' ? parseFloat(band.split) : null;
                let rxMin = band.rxMin !== undefined && band.rxMin !== '' ? parseFloat(band.rxMin) : null;
                let rxMax = band.rxMax !== undefined && band.rxMax !== '' ? parseFloat(band.rxMax) : null;

                if (customSplit !== null && (rxMin === null || rxMax === null)) {
                    rxMin = parseFloat((bMin + customSplit).toFixed(5));
                    rxMax = parseFloat((bMax + customSplit).toFixed(5));
                } else if (rxMin === null || rxMax === null) {
                    rxMin = parseFloat((bMin + 10.0).toFixed(5));
                    rxMax = parseFloat((bMax + 10.0).toFixed(5));
                }

                // Check dedicated discrete UK bands (455/468 or 457/467)
                let discreteKey = null;
                if (band.discreteBand === 455 || (bMin >= 454.9 && bMax <= 455.5)) discreteKey = 455;
                else if (band.discreteBand === 457 || (bMin >= 457.0 && bMax <= 457.6)) discreteKey = 457;

                const existingInBand = currentPlan.filter(p => p.zoneId === zoneId && !p.isSimplex && (p.bandId === bandId || (p.tx >= bMin && p.tx <= bMax)));
                let currentCount = existingInBand.length;

                const isBaseHigh = band.duplexDirection === 'BASE_HIGH' || 
                                   (customSplit !== null && customSplit < 0) || 
                                   (rxMin !== null && bMin > rxMin);

                if (targetCount > currentCount) {
                    if (discreteKey && DISCRETE_TALKBACK_PAIRS[discreteKey]) {
                        const discreteList = [...DISCRETE_TALKBACK_PAIRS[discreteKey]];
                        for (let i = discreteList.length - 1; i > 0; i--) {
                            const j = Math.floor(Math.random() * (i + 1));
                            [discreteList[i], discreteList[j]] = [discreteList[j], discreteList[i]];
                        }

                        for (let i = 0; i < discreteList.length; i++) {
                            if (currentCount >= targetCount) break;
                            const pair = discreteList[i];
                            const candTx = isBaseHigh ? pair.rx : pair.tx;
                            const candRx = isBaseHigh ? pair.tx : pair.rx;
                            if (isFrequencyRestricted(candTx).isRestricted || isFrequencyRestricted(candRx).isRestricted) {
                                continue;
                            }
                            const candidate = {
                                tx: candTx,
                                rx: candRx,
                                txIsBase: true,
                                rxIsBase: false,
                                isSimplex: false,
                                zoneId: zoneId,
                                zoneName: zoneName,
                                bandId: bandId,
                                bandLabel: band.label || `${discreteKey}/${discreteKey === 455 ? 468 : 467} Dedicated`,
                                locked: false,
                                duplexDirection: isBaseHigh ? 'BASE_HIGH' : 'BASE_LOW'
                            };

                            if (checkCompatibility(candidate, currentPlan, zoneId, isZoneCoupled)) {
                                currentPlan.push(candidate);
                                currentCount++;
                            }
                        }
                    } else {
                        // Custom user range and split
                        const effectiveSep = customSplit !== null ? customSplit : (rxMin - bMin);
                        const txPool = createShuffledPool(bMin, bMax, bStep);
                        const rxPool = createShuffledPool(Math.min(rxMin, rxMax), Math.max(rxMin, rxMax), bStep);

                        for (let i = 0; i < txPool.length; i++) {
                            if (currentCount >= targetCount) break;
                            const candTx = txPool[i];
                            if (isFrequencyRestricted(candTx).isRestricted) continue;

                            let candRx = parseFloat((candTx + effectiveSep).toFixed(5));
                            const minAllowedRx = Math.min(rxMin, rxMax);
                            const maxAllowedRx = Math.max(rxMin, rxMax);

                            if (candRx < minAllowedRx || candRx > maxAllowedRx || isFrequencyRestricted(candRx).isRestricted) {
                                const validRx = rxPool.find(r => !isFrequencyRestricted(r).isRestricted && (customSplit === null || Math.abs(r - (candTx + effectiveSep)) < 0.001));
                                if (!validRx) continue;
                                candRx = validRx;
                            }
                            if (isFrequencyRestricted(candRx).isRestricted) continue;

                            const candidate = {
                                tx: candTx,
                                rx: candRx,
                                txIsBase: true,
                                rxIsBase: false,
                                isSimplex: false,
                                zoneId: zoneId,
                                zoneName: zoneName,
                                bandId: bandId,
                                bandLabel: band.label || `Band ${bandIndex + 1}`,
                                locked: false,
                                duplexDirection: isBaseHigh ? 'BASE_HIGH' : 'BASE_LOW'
                            };

                            if (checkCompatibility(candidate, currentPlan, zoneId, isZoneCoupled)) {
                                currentPlan.push(candidate);
                                currentCount++;
                            }
                        }
                    }
                }
            });

            // 2. BASE TX / IFB BANDS FOR THIS ZONE
            if (zone.enableBaseSimplex && (zone.baseSimplexBands || []).length > 0) {
                zone.baseSimplexBands.forEach((band, bandIndex) => {
                    const targetCount = parseInt(band.count) || 0;
                    const sMin = parseFloat(band.min) || 455.0;
                    const sMax = parseFloat(band.max) || 460.0;
                    const sStep = (parseFloat(band.bw) || 12.5) / 1000;
                    const bandId = band.id || `ifb_${zoneId}_${bandIndex + 1}`;

                    let discreteSimplexKey = null;
                    if (band.discreteBand === 455 || (sMin >= 454.9 && sMax <= 455.5)) discreteSimplexKey = 455;
                    else if (band.discreteBand === 457 || (sMin >= 457.0 && sMax <= 457.6)) discreteSimplexKey = 457;

                    const existingInBand = currentPlan.filter(p => p.zoneId === zoneId && p.isSimplex && p.simplexType === 'base_tx' && (p.bandId === bandId || (p.tx >= sMin && p.tx <= sMax)));
                    let currentCount = existingInBand.length;

                    if (targetCount > currentCount) {
                        const pool = discreteSimplexKey && DISCRETE_TALKBACK_PAIRS[discreteSimplexKey]
                            ? Array.from(new Set(DISCRETE_TALKBACK_PAIRS[discreteSimplexKey].map(p => p.tx))).filter(f => !isFrequencyRestricted(f).isRestricted).sort(() => Math.random() - 0.5)
                            : createShuffledPool(sMin, sMax, sStep);

                        for (let i = 0; i < pool.length; i++) {
                            if (currentCount >= targetCount) break;
                            const candFreq = pool[i];
                            if (isFrequencyRestricted(candFreq).isRestricted) continue;
                            const candidate = {
                                tx: candFreq,
                                rx: 0,
                                txIsBase: true,
                                rxIsBase: false,
                                isSimplex: true,
                                simplexType: 'base_tx',
                                zoneId: zoneId,
                                zoneName: zoneName,
                                bandId: bandId,
                                bandLabel: band.label || `IFB Band ${bandIndex + 1}`,
                                locked: false
                            };

                            if (checkCompatibility(candidate, currentPlan, zoneId, isZoneCoupled)) {
                                currentPlan.push(candidate);
                                currentCount++;
                            }
                        }
                    }
                });
            }

            // 3. WALKIE-TALKIE / PTT BANDS FOR THIS ZONE
            if (zone.enableWalkieSimplex && (zone.walkieSimplexBands || []).length > 0) {
                zone.walkieSimplexBands.forEach((band, bandIndex) => {
                    const targetCount = parseInt(band.count) || 0;
                    const wMin = parseFloat(band.min) || 455.0;
                    const wMax = parseFloat(band.max) || 460.0;
                    const wStep = (parseFloat(band.bw) || 12.5) / 1000;
                    const bandId = band.id || `wt_${zoneId}_${bandIndex + 1}`;

                    let discreteWalkieKey = null;
                    if (band.discreteBand === 468 || (wMin >= 468.0 && wMax <= 468.6)) discreteWalkieKey = 455;
                    else if (band.discreteBand === 467 || (wMin >= 467.0 && wMax <= 467.6)) discreteWalkieKey = 457;

                    const existingInBand = currentPlan.filter(p => p.zoneId === zoneId && p.isSimplex && p.simplexType === 'walkie' && (p.bandId === bandId || (p.tx >= wMin && p.tx <= wMax)));
                    let currentCount = existingInBand.length;

                    if (targetCount > currentCount) {
                        const pool = discreteWalkieKey && DISCRETE_TALKBACK_PAIRS[discreteWalkieKey]
                            ? Array.from(new Set(DISCRETE_TALKBACK_PAIRS[discreteWalkieKey].map(p => p.rx))).filter(f => !isFrequencyRestricted(f).isRestricted).sort(() => Math.random() - 0.5)
                            : createShuffledPool(wMin, wMax, wStep);

                        for (let i = 0; i < pool.length; i++) {
                            if (currentCount >= targetCount) break;
                            const candFreq = pool[i];
                            if (isFrequencyRestricted(candFreq).isRestricted) continue;
                            const candidate = {
                                tx: candFreq,
                                rx: 0,
                                txIsBase: false,
                                rxIsBase: false,
                                isSimplex: true,
                                simplexType: 'walkie',
                                zoneId: zoneId,
                                zoneName: zoneName,
                                bandId: bandId,
                                bandLabel: band.label || `WT Band ${bandIndex + 1}`,
                                locked: false
                            };

                            if (checkCompatibility(candidate, currentPlan, zoneId, isZoneCoupled)) {
                                currentPlan.push(candidate);
                                currentCount++;
                            }
                        }
                    }
                });
            }
        }

        if (currentPlan.length > bestScore) {
            bestScore = currentPlan.length;
            bestPlan = currentPlan;
            // Early break if 100% full capacity achieved with 0 clashes
            if (bestScore >= totalTargetCount) {
                break;
            }
        }
    }

    return bestPlan.sort((a, b) => {
        if (a.zoneId !== b.zoneId) return a.zoneId.localeCompare(b.zoneId);
        if (a.isSimplex === b.isSimplex) return a.tx - b.tx;
        return a.isSimplex ? 1 : -1;
    });
};







export interface SpectrumCarrier {
  freq: number;
  label: string;
  type: 'BASE_TX' | 'PORT_TX' | 'IFB' | 'WALKIE';
  isKeyed?: boolean;
  isGhost?: boolean;
  hasClash?: boolean;
  powerDbm?: number;
  zoneName?: string;
  zoneId: string;
  locked?: boolean;
}

export interface SpectrumImd {
  freq: number;
  type: '2-Tone' | '3-Tone';
  color: string;
  desc?: string;
  powerDbm?: number;
  hasClash?: boolean;
  clashDesc?: string;
}

export interface TacticalSpectrumAnalyzerProps {
  centerFreq: number;
  span: number;
  onCenterChange?: (mhz: number) => void;
  onCenterFreqChange?: (mhz: number) => void;
  onSpanChange: (spanMhz: number) => void;
  carriers: SpectrumCarrier[];
  imds: SpectrumImd[];
  activeZoneName: string;
  activeZoneId?: string;
  activeKeypadTarget?: string | null;
  onSelectKeypadTarget?: (target: string) => void;
}

export interface TacticalSpectrumAnalyzerState {
  centerFreq: number;
  span: number;
  activeZoneName: string;
  activeZoneId: string;
  carriers: SpectrumCarrier[];
  imds: SpectrumImd[];
  canvasWidth: number;
  setCanvasWidth: (w: number) => void;
  CANVAS_HEIGHT: number;
  TOP_MARGIN: number;
  BOTTOM_MARGIN: number;
  PLOT_HEIGHT: number;
  NOISE_FLOOR_DBM: number;
  REF_LEVEL_DBM: number;
  traceMode: 'LIVE' | 'MAX_HOLD' | 'AVG';
  setTraceMode: React.Dispatch<React.SetStateAction<'LIVE' | 'MAX_HOLD' | 'AVG'>>;
  rbwKhz: number;
  setRbwKhz: React.Dispatch<React.SetStateAction<number>>;
  marker1Freq: number | null;
  setMarker1Freq: React.Dispatch<React.SetStateAction<number | null>>;
  marker2Freq: number | null;
  setMarker2Freq: React.Dispatch<React.SetStateAction<number | null>>;
  marker1DbmState: number;
  setMarker1DbmState: React.Dispatch<React.SetStateAction<number>>;
  marker2DbmState: number;
  setMarker2DbmState: React.Dispatch<React.SetStateAction<number>>;
  activeMarker: 1 | 2;
  setActiveMarker: React.Dispatch<React.SetStateAction<1 | 2>>;
  maxHoldPeaks: { freq: number; dbm: number }[];
  setMaxHoldPeaks: React.Dispatch<React.SetStateAction<{ freq: number; dbm: number }[]>>;
  deltaMode: boolean;
  setDeltaMode: React.Dispatch<React.SetStateAction<boolean>>;
  deltaStep: 1 | 2;
  setDeltaStep: React.Dispatch<React.SetStateAction<1 | 2>>;
  centerText: string;
  setCenterText: React.Dispatch<React.SetStateAction<string>>;
  centerStep: number;
  setCenterStep: React.Dispatch<React.SetStateAction<number>>;
  centerStepText: string;
  setCenterStepText: React.Dispatch<React.SetStateAction<string>>;
  spanText: string;
  setSpanText: React.Dispatch<React.SetStateAction<string>>;
  spanStep: number;
  setSpanStep: React.Dispatch<React.SetStateAction<number>>;
  spanStepText: string;
  setSpanStepText: React.Dispatch<React.SetStateAction<string>>;
  startFreq: number;
  stopFreq: number;
  freqToX: (f: number) => number;
  xToFreq: (x: number) => number;
  dbmToY: (dbm: number) => number;
  panResponder: any;
  handleCenterChange: (mhz: number) => void;
  handleCenterStep: (dir: -1 | 1) => void;
  handleCenterInputCommit: () => void;
  handleCenterStepDelta: (dir: -1 | 1) => void;
  handleCenterStepCommit: () => void;
  handleSpanStep: (dir: -1 | 1) => void;
  handleSpanInputCommit: () => void;
  handleSpanStepDelta: (dir: -1 | 1) => void;
  handleSpanStepCommit: () => void;
  handleZoom: (dir: 'IN' | 'OUT') => void;
  handlePan: (dir: -1 | 1) => void;
  marker1Dbm: number;
  marker2Dbm: number | null;
  deltaInfo: any;
  deltaKhz: number | null;
  gridFreqs: number[];
  dbmLevels: number[];
  onSpanChange: (spanMhz: number) => void;
  ukExclusionsEnabled: boolean;
  toggleUkExclusions: () => void;
}

export function useTacticalSpectrumAnalyzer({
  centerFreq,
  span,
  onCenterChange,
  onCenterFreqChange,
  onSpanChange,
  carriers,
  imds,
  activeZoneName,
  activeZoneId = 'default'
}: TacticalSpectrumAnalyzerProps): TacticalSpectrumAnalyzerState {
  const handleCenterChange = (mhz: number) => {
    if (onCenterChange) onCenterChange(mhz);
    if (onCenterFreqChange) onCenterFreqChange(mhz);
  };

  const [canvasWidth, setCanvasWidth] = useState<number>(330);
  const CANVAS_HEIGHT = 175;
  const TOP_MARGIN = 20;
  const BOTTOM_MARGIN = 24;
  const PLOT_HEIGHT = CANVAS_HEIGHT - TOP_MARGIN - BOTTOM_MARGIN;
  const NOISE_FLOOR_DBM = -100;
  const REF_LEVEL_DBM = 0;

  // UK Exclusions toggle state
  const [ukExclusionsEnabled, setUkExclusionsEnabledState] = useState<boolean>(getUkExclusionsEnabled());

  useEffect(() => {
    return subscribeUkExclusions((enabled) => {
      setUkExclusionsEnabledState(enabled);
    });
  }, []);

  const toggleUkExclusions = () => {
    const next = !ukExclusionsEnabled;
    setUkExclusionsEnabledState(next);
    setUkExclusionsEnabled(next);
  };

  // Analyzer States
  const [traceMode, setTraceMode] = useState<'LIVE' | 'MAX_HOLD' | 'AVG'>('LIVE');
  const [rbwKhz, setRbwKhz] = useState<number>(12.5);
  const [marker1Freq, setMarker1Freq] = useState<number | null>(null);
  const [marker2Freq, setMarker2Freq] = useState<number | null>(null);
  const [marker1DbmState, setMarker1DbmState] = useState<number>(-95);
  const [marker2DbmState, setMarker2DbmState] = useState<number>(-95);
  const [activeMarker, setActiveMarker] = useState<1 | 2>(1);
  const [maxHoldPeaks, setMaxHoldPeaks] = useState<{ freq: number; dbm: number }[]>([]);

  // Delta 2-Tap state machine
  const [deltaMode, setDeltaMode] = useState<boolean>(false);
  const [deltaStep, setDeltaStep] = useState<1 | 2>(1);

  // Center Frequency & Span Editable State
  const [centerText, setCenterText] = useState<string>(centerFreq.toFixed(5));
  const [centerStep, setCenterStep] = useState<number>(0.100);
  const [centerStepText, setCenterStepText] = useState<string>('0.100');

  const [spanText, setSpanText] = useState<string>(span.toFixed(2));
  const [spanStep, setSpanStep] = useState<number>(2.0);
  const [spanStepText, setSpanStepText] = useState<string>('2.0');

  // Synchronize when external props update
  useEffect(() => {
    setCenterText(centerFreq.toFixed(5));
  }, [centerFreq]);

  useEffect(() => {
    setSpanText(span.toFixed(2));
  }, [span]);

  const startFreq = centerFreq - span / 2;
  const stopFreq = centerFreq + span / 2;

  // Coordinate conversion
  const freqToX = (f: number) => {
    return ((f - startFreq) / span) * canvasWidth;
  };

  const xToFreq = (x: number) => {
    return startFreq + (x / canvasWidth) * span;
  };

  const dbmToY = (dbm: number) => {
    const clamped = Math.max(NOISE_FLOOR_DBM, Math.min(REF_LEVEL_DBM, dbm));
    const ratio = (clamped - NOISE_FLOOR_DBM) / (REF_LEVEL_DBM - NOISE_FLOOR_DBM);
    return TOP_MARGIN + PLOT_HEIGHT * (1 - ratio);
  };

  // Initial Marker Setup
  useEffect(() => {
    if (marker1Freq === null && carriers.length > 0) {
      setMarker1Freq(carriers[0].freq);
    }
  }, [carriers]);

  // Update Max Hold peaks
  useEffect(() => {
    if (traceMode === 'MAX_HOLD') {
      const activeCarriers = carriers.map((c) => ({
        freq: c.freq,
        dbm: c.powerDbm ?? -15
      }));
      const activeImdPeaks = imds.map((im) => ({
        freq: im.freq,
        dbm: im.type === '2-Tone' ? -55 : -65
      }));
      const allCurrent = [...activeCarriers, ...activeImdPeaks];

      setMaxHoldPeaks((prev) => {
        const merged = [...prev];
        allCurrent.forEach((curr) => {
          const idx = merged.findIndex((p) => Math.abs(p.freq - curr.freq) < 0.005);
          if (idx >= 0) {
            merged[idx].dbm = Math.max(merged[idx].dbm, curr.dbm);
          } else {
            merged.push(curr);
          }
        });
        return merged;
      });
    }
  }, [carriers, imds, traceMode]);

  // Keep mutable ref to avoid stale closures in PanResponder
  const deltaStateRef = useRef({
    deltaMode,
    deltaStep,
    marker1Freq,
    marker2Freq,
    startFreq,
    span,
    canvasWidth
  });

  useEffect(() => {
    deltaStateRef.current = {
      deltaMode,
      deltaStep,
      marker1Freq,
      marker2Freq,
      startFreq,
      span,
      canvasWidth
    };
  }, [deltaMode, deltaStep, marker1Freq, marker2Freq, startFreq, span, canvasWidth]);

  // Touch / Tap / Pan interaction on spectrum screen
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const tapX = evt.nativeEvent.locationX;
        const tapY = evt.nativeEvent.locationY;
        const { deltaMode: isDelta, deltaStep: step, startFreq: curStart, span: curSpan, canvasWidth: width } = deltaStateRef.current;
        const tappedFreq = Math.round((curStart + (tapX / width) * curSpan) * 100000) / 100000;
        
        const clampedY = Math.max(TOP_MARGIN, Math.min(TOP_MARGIN + PLOT_HEIGHT, tapY));
        const yRatio = 1 - (clampedY - TOP_MARGIN) / PLOT_HEIGHT;
        const tappedDbm = Math.round(NOISE_FLOOR_DBM + yRatio * (REF_LEVEL_DBM - NOISE_FLOOR_DBM));

        if (isDelta) {
          if (step === 1) {
            setMarker1Freq(tappedFreq);
            setMarker1DbmState(tappedDbm);
            setMarker2Freq(null);
            setDeltaStep(2);
            setActiveMarker(2);
          } else {
            setMarker2Freq(tappedFreq);
            setMarker2DbmState(tappedDbm);
            setDeltaStep(1);
            setActiveMarker(2);
          }
        } else {
          if (activeMarker === 1) {
            setMarker1Freq(tappedFreq);
            setMarker1DbmState(tappedDbm);
          } else {
            setMarker2Freq(tappedFreq);
            setMarker2DbmState(tappedDbm);
          }
        }
      },
      onPanResponderMove: (evt) => {
        const { deltaMode: isDelta, startFreq: curStart, span: curSpan, canvasWidth: width } = deltaStateRef.current;
        if (isDelta) return;
        const tapX = evt.nativeEvent.locationX;
        const tapY = evt.nativeEvent.locationY;
        const tappedFreq = Math.round((curStart + (tapX / width) * curSpan) * 100000) / 100000;
        const clampedY = Math.max(TOP_MARGIN, Math.min(TOP_MARGIN + PLOT_HEIGHT, tapY));
        const yRatio = 1 - (clampedY - TOP_MARGIN) / PLOT_HEIGHT;
        const tappedDbm = Math.round(NOISE_FLOOR_DBM + yRatio * (REF_LEVEL_DBM - NOISE_FLOOR_DBM));

        if (activeMarker === 1) {
          setMarker1Freq(tappedFreq);
          setMarker1DbmState(tappedDbm);
        } else {
          setMarker2Freq(tappedFreq);
          setMarker2DbmState(tappedDbm);
        }
      }
    })
  ).current;

  // Center Frequency Actions
  const handleCenterStep = (dir: -1 | 1) => {
    const cur = parseFloat(centerText) || centerFreq;
    const effStep = centerStep > 0 ? centerStep : 0.100;
    const nextVal = Math.max(10, Math.min(1500, Math.round((cur + dir * effStep) * 100000) / 100000));
    setCenterText(nextVal.toFixed(5));
    handleCenterChange(nextVal);
  };

  const handleCenterInputCommit = () => {
    const parsed = parseFloat(centerText);
    if (!isNaN(parsed) && parsed >= 10 && parsed <= 1500) {
      setCenterText(parsed.toFixed(5));
      handleCenterChange(parsed);
    } else {
      setCenterText(centerFreq.toFixed(5));
    }
  };

  const handleCenterStepDelta = (dir: -1 | 1) => {
    const standardSteps = [0.00625, 0.0125, 0.025, 0.050, 0.100, 0.250, 0.500, 1.000, 2.000, 5.000];
    const current = centerStep;
    let nextStep = current;
    if (dir > 0) {
      const found = standardSteps.find((s) => s > current + 0.0001);
      nextStep = found !== undefined ? found : current * 2;
    } else {
      const reversed = [...standardSteps].reverse();
      const found = reversed.find((s) => s < current - 0.0001);
      nextStep = found !== undefined ? found : Math.max(0.001, current / 2);
    }
    nextStep = Math.round(nextStep * 100000) / 100000;
    setCenterStep(nextStep);
    setCenterStepText(nextStep >= 1 ? nextStep.toFixed(1) : nextStep.toString());
  };

  const handleCenterStepCommit = () => {
    const parsed = parseFloat(centerStepText);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 50) {
      setCenterStep(parsed);
      setCenterStepText(parsed.toString());
    } else {
      setCenterStepText(centerStep.toString());
    }
  };

  // Span Actions
  const handleSpanStep = (dir: -1 | 1) => {
    const cur = parseFloat(spanText) || span;
    const effStep = spanStep > 0 ? spanStep : 2.0;
    const nextVal = Math.max(0.1, Math.min(250, Math.round((cur + dir * effStep) * 100) / 100));
    setSpanText(nextVal.toFixed(2));
    onSpanChange(nextVal);
  };

  const handleSpanInputCommit = () => {
    const parsed = parseFloat(spanText);
    if (!isNaN(parsed) && parsed >= 0.1 && parsed <= 250) {
      setSpanText(parsed.toFixed(2));
      onSpanChange(parsed);
    } else {
      setSpanText(span.toFixed(2));
    }
  };

  const handleSpanStepDelta = (dir: -1 | 1) => {
    const standardSteps = [0.25, 0.5, 1.0, 2.0, 5.0, 10.0, 20.0];
    const current = spanStep;
    let nextStep = current;
    if (dir > 0) {
      const found = standardSteps.find((s) => s > current + 0.01);
      nextStep = found !== undefined ? found : current + 2.0;
    } else {
      const reversed = [...standardSteps].reverse();
      const found = reversed.find((s) => s < current - 0.01);
      nextStep = found !== undefined ? found : Math.max(0.1, current - 0.5);
    }
    nextStep = Math.round(nextStep * 100) / 100;
    setSpanStep(nextStep);
    setSpanStepText(nextStep.toString());
  };

  const handleSpanStepCommit = () => {
    const parsed = parseFloat(spanStepText);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 100) {
      setSpanStep(parsed);
      setSpanStepText(parsed.toString());
    } else {
      setSpanStepText(spanStep.toString());
    }
  };

  // Zoom In / Zoom Out
  const handleZoom = (dir: 'IN' | 'OUT') => {
    const cur = span;
    let nextSpan: number;
    if (dir === 'IN') {
      nextSpan = Math.max(0.1, Math.round((cur * 0.5) * 100) / 100);
    } else {
      nextSpan = Math.min(250, Math.round((cur * 2.0) * 100) / 100);
    }
    setSpanText(nextSpan.toFixed(2));
    onSpanChange(nextSpan);
  };

  // Pan Left / Right
  const handlePan = (dir: -1 | 1) => {
    const shift = Math.max(0.025, Math.round((span * 0.25) * 100000) / 100000);
    const nextVal = Math.round((centerFreq + dir * shift) * 100000) / 100000;
    setCenterText(nextVal.toFixed(5));
    handleCenterChange(nextVal);
  };

  // Delta calculation between Marker 1 and Marker 2
  const marker1Dbm = useMemo(() => {
    if (!marker1Freq) return -100;
    const nearestCarrier = carriers.find((c) => Math.abs(c.freq - marker1Freq) < 0.015);
    if (nearestCarrier) return nearestCarrier.powerDbm ?? -15;
    const nearestImd = imds.find((im) => Math.abs(im.freq - marker1Freq) < 0.015);
    if (nearestImd) return nearestImd.type === '2-Tone' ? -55 : -65;
    return -95;
  }, [marker1Freq, carriers, imds]);

  const marker2Dbm = useMemo(() => {
    if (!marker2Freq) return null;
    const nearestCarrier = carriers.find((c) => Math.abs(c.freq - marker2Freq) < 0.015);
    if (nearestCarrier) return nearestCarrier.powerDbm ?? -15;
    const nearestImd = imds.find((im) => Math.abs(im.freq - marker2Freq) < 0.015);
    if (nearestImd) return nearestImd.type === '2-Tone' ? -55 : -65;
    return -95;
  }, [marker2Freq, carriers, imds]);

  // Delta frequency & formatted distance string (kHz or MHz)
  const deltaInfo = useMemo(() => {
    if (marker1Freq === null || marker2Freq === null) return null;
    const diffMhz = marker2Freq - marker1Freq;
    const absDiffMhz = Math.abs(diffMhz);
    const diffKhz = Math.round(diffMhz * 1000000) / 1000;
    const absDiffKhz = Math.abs(diffKhz);

    let displayFormatted = '';
    if (absDiffKhz >= 1000) {
      displayFormatted = `${diffMhz >= 0 ? '+' : ''}${diffMhz.toFixed(5)} MHz (${diffKhz >= 0 ? '+' : ''}${diffKhz.toFixed(1)} kHz)`;
    } else {
      displayFormatted = `${diffKhz >= 0 ? '+' : ''}${diffKhz.toFixed(1)} kHz`;
    }

    return {
      diffKhz,
      diffMhz,
      absDiffKhz,
      absDiffMhz,
      displayFormatted
    };
  }, [marker1Freq, marker2Freq]);

  const deltaKhz = deltaInfo ? deltaInfo.diffKhz : null;

  // Generate Frequency Grid Ticks (8 subdivisions)
  const gridFreqs = useMemo(() => {
    const list: number[] = [];
    const step = span / 8;
    for (let i = 0; i <= 8; i++) {
      list.push(startFreq + i * step);
    }
    return list;
  }, [startFreq, span]);

  const dbmLevels = [0, -20, -40, -60, -80, -100];

  return {
    centerFreq,
    span,
    activeZoneName,
    activeZoneId,
    carriers,
    imds,
    canvasWidth,
    setCanvasWidth,
    CANVAS_HEIGHT,
    TOP_MARGIN,
    BOTTOM_MARGIN,
    PLOT_HEIGHT,
    NOISE_FLOOR_DBM,
    REF_LEVEL_DBM,
    traceMode,
    setTraceMode,
    rbwKhz,
    setRbwKhz,
    marker1Freq,
    setMarker1Freq,
    marker2Freq,
    setMarker2Freq,
    marker1DbmState,
    setMarker1DbmState,
    marker2DbmState,
    setMarker2DbmState,
    activeMarker,
    setActiveMarker,
    maxHoldPeaks,
    setMaxHoldPeaks,
    deltaMode,
    setDeltaMode,
    deltaStep,
    setDeltaStep,
    centerText,
    setCenterText,
    centerStep,
    setCenterStep,
    centerStepText,
    setCenterStepText,
    spanText,
    setSpanText,
    spanStep,
    setSpanStep,
    spanStepText,
    setSpanStepText,
    startFreq,
    stopFreq,
    freqToX,
    xToFreq,
    dbmToY,
    panResponder,
    handleCenterChange,
    handleCenterStep,
    handleCenterInputCommit,
    handleCenterStepDelta,
    handleCenterStepCommit,
    handleSpanStep,
    handleSpanInputCommit,
    handleSpanStepDelta,
    handleSpanStepCommit,
    handleZoom,
    handlePan,
    marker1Dbm,
    marker2Dbm,
    deltaInfo,
    deltaKhz,
    gridFreqs,
    dbmLevels,
    onSpanChange,
    ukExclusionsEnabled,
    toggleUkExclusions
  };
}

/**
 * TacticalSpectrumAnalyzerScope:
 * The sticky/frozen part of the tactical spectrum analyzer:
 * 1. Readout header bar (with "BW" instead of "RBW")
 * 2. CRT Screen Bezel + SVG spectrum canvas
 * 3. Quick RF Band Presets (Dual Band, Base TX, Portable TX)
 * 4. Zoom & Pan Hardware Bar (◄ PAN LEFT, 🔍 ZOOM IN (+), 🔍 ZOOM OUT (-), PAN RIGHT ►)
 */
export const TacticalSpectrumAnalyzerScope: React.FC<{ state: TacticalSpectrumAnalyzerState }> = ({ state }) => {
  const {
    activeZoneName,
    rbwKhz,
    traceMode,
    marker1Freq,
    marker2Freq,
    marker1Dbm,
    marker1DbmState,
    marker2Dbm,
    marker2DbmState,
    deltaMode,
    deltaInfo,
    panResponder,
    setCanvasWidth,
    canvasWidth,
    CANVAS_HEIGHT,
    dbmLevels,
    dbmToY,
    gridFreqs,
    freqToX,
    TOP_MARGIN,
    PLOT_HEIGHT,
    maxHoldPeaks,
    carriers,
    span,
    imds,
    centerFreq,
    setCenterText,
    handleCenterChange,
    setSpanText,
    onSpanChange,
    handlePan,
    handleZoom,
    ukExclusionsEnabled,
    toggleUkExclusions
  } = state;

  return (
    <View style={analyzerStyles.scopeWrapper}>
      {/* Top Readout Header Bar */}
      <View style={analyzerStyles.hudTopBar}>
        <View style={analyzerStyles.hudLeft}>
          <Text style={analyzerStyles.hudScopeTitle}>TACTICAL SPECTRUM ANALYZER</Text>
          <Text style={analyzerStyles.hudScopeSub}>
            ZONE: {activeZoneName.toUpperCase()} | BW: {rbwKhz} kHz | {traceMode}
          </Text>
        </View>

        {/* Digital Marker HUD Readout */}
        <View style={analyzerStyles.markerHudBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={analyzerStyles.markerBadgeM1}>
              M1: {marker1Freq ? `${marker1Freq.toFixed(5)} MHz` : '---'} ({marker1Dbm} dBm)
            </Text>
          </View>
          {deltaMode && marker1Freq !== null && marker2Freq === null && (
            <Text style={analyzerStyles.markerBadgeDeltaPrompt}>
              👆 TAP SCREEN FOR POINT 2 (M2)
            </Text>
          )}
          {marker1Freq !== null && marker2Freq !== null && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={analyzerStyles.markerBadgeM2}>
                Δ DISTANCE: {deltaInfo ? deltaInfo.displayFormatted : '---'}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Hardware Bezel & Phosphor Screen */}
      <View
        style={analyzerStyles.screenBezel}
        {...panResponder.panHandlers}
        onLayout={(e) => setCanvasWidth(Math.max(280, e.nativeEvent.layout.width))}
      >
        <Svg width="100%" height={CANVAS_HEIGHT}>
          {/* Deep phosphor CRT black background */}
          <Rect x="0" y="0" width="100%" height={CANVAS_HEIGHT} fill="#020813" />

          {/* 10x10 Calibrated Graticule Grid */}
          {dbmLevels.map((dbm) => {
            const y = dbmToY(dbm);
            return (
              <G key={`dbm_${dbm}`}>
                <Line
                  x1="0"
                  y1={y}
                  x2={canvasWidth}
                  y2={y}
                  stroke={dbm === 0 ? '#1e3a5f' : '#0d2238'}
                  strokeWidth="1"
                  strokeDasharray={dbm === 0 || dbm === -100 ? 'none' : '2, 4'}
                />
                <SvgText
                  x={canvasWidth - 4}
                  y={y - 2}
                  fill="#1e4e6e"
                  fontSize="7.5"
                  fontFamily={Platform.OS === 'ios' ? 'Courier' : 'monospace'}
                  textAnchor="end"
                >
                  {dbm} dBm
                </SvgText>
              </G>
            );
          })}

          {/* Vertical Frequency Grid */}
          {gridFreqs.map((f, i) => {
            const x = freqToX(f);
            return (
              <G key={`fgrid_${i}`}>
                <Line
                  x1={x}
                  y1={TOP_MARGIN}
                  x2={x}
                  y2={TOP_MARGIN + PLOT_HEIGHT}
                  stroke="#0d2238"
                  strokeWidth="1"
                  strokeDasharray="2, 4"
                />
                {i % 2 === 0 && (
                  <SvgText
                    x={x}
                    y={CANVAS_HEIGHT - 6}
                    fill="#3b6e8c"
                    fontSize="7.5"
                    fontFamily={Platform.OS === 'ios' ? 'Courier' : 'monospace'}
                    textAnchor="middle"
                  >
                    {f.toFixed(3)}
                  </SvgText>
                )}
              </G>
            );
          })}

          {/* Center Frequency Marker Line */}
          <Line
            x1={canvasWidth / 2}
            y1={TOP_MARGIN}
            x2={canvasWidth / 2}
            y2={TOP_MARGIN + PLOT_HEIGHT}
            stroke="#1d4ed8"
            strokeWidth="1"
            strokeDasharray="4, 4"
            opacity="0.6"
          />

          {/* ================= REGULATORY RESTRICTED ZONES & KEEP-OUT MASKS (UK EXCLUSIONS) ================= */}
          {ukExclusionsEnabled && (
            <>
              {RESTRICTED_FREQUENCY_RANGES.map((range, rIdx) => {
                const minScopeF = centerFreq - span / 2;
                const maxScopeF = centerFreq + span / 2;
                if (range.stopFreq < minScopeF || range.startFreq > maxScopeF) return null;
                const x1 = Math.max(0, freqToX(range.startFreq));
                const x2 = Math.min(canvasWidth, freqToX(range.stopFreq));
                const w = Math.max(2, x2 - x1);
                const midX = (x1 + x2) / 2;
                return (
                  <G key={`t_range_${rIdx}`}>
                    <Rect
                      x={x1}
                      y={TOP_MARGIN}
                      width={w}
                      height={PLOT_HEIGHT}
                      fill="rgba(239, 68, 68, 0.16)"
                      stroke="#ef4444"
                      strokeWidth="0.8"
                      strokeDasharray="3, 3"
                    />
                    {w >= 28 && (
                      <SvgText
                        x={midX}
                        y={TOP_MARGIN + 9}
                        fill="#fca5a5"
                        fontSize="6"
                        fontWeight="900"
                        textAnchor="middle"
                      >
                        ⛔ RESTRICTED
                      </SvgText>
                    )}
                  </G>
                );
              })}

              {RESTRICTED_SPOT_FREQUENCIES.map((spot, sIdx) => {
                const minScopeF = centerFreq - span / 2;
                const maxScopeF = centerFreq + span / 2;
                const halfBw = spot.bandwidthKhz / 2000;
                if (spot.freq + halfBw < minScopeF || spot.freq - halfBw > maxScopeF) return null;
                const x1 = Math.max(0, freqToX(spot.freq - halfBw));
                const x2 = Math.min(canvasWidth, freqToX(spot.freq + halfBw));
                const w = Math.max(2, x2 - x1);
                const cx = freqToX(spot.freq);
                return (
                  <G key={`t_spot_${sIdx}`}>
                    <Rect
                      x={x1}
                      y={TOP_MARGIN}
                      width={w}
                      height={PLOT_HEIGHT}
                      fill="rgba(244, 63, 94, 0.22)"
                      stroke="#f43f5e"
                      strokeWidth="0.8"
                      strokeDasharray="2, 2"
                    />
                    <Line
                      x1={cx}
                      y1={TOP_MARGIN}
                      x2={cx}
                      y2={TOP_MARGIN + PLOT_HEIGHT}
                      stroke="#f43f5e"
                      strokeWidth="1"
                      strokeDasharray="2, 2"
                    />
                    {cx >= 15 && cx <= canvasWidth - 15 && (
                      <SvgText
                        x={cx}
                        y={TOP_MARGIN + 8}
                        fill="#fda4af"
                        fontSize="5.5"
                        fontWeight="900"
                        textAnchor="middle"
                      >
                        ⛔ {spot.freq.toFixed(3)}
                      </SvgText>
                    )}
                  </G>
                );
              })}
            </>
          )}

          {/* Max Hold Ghost Traces */}
          {traceMode === 'MAX_HOLD' &&
            maxHoldPeaks.map((peak, idx) => {
              const x = freqToX(peak.freq);
              const topY = dbmToY(peak.dbm);
              if (x < 0 || x > canvasWidth) return null;
              return (
                <G key={`maxhold_${idx}`}>
                  <Line
                    x1={x}
                    y1={topY}
                    x2={x}
                    y2={TOP_MARGIN + PLOT_HEIGHT}
                    stroke="#f97316"
                    strokeWidth="1.5"
                    opacity="0.5"
                  />
                  <Circle cx={x} cy={topY} r={2.5} fill="#ea580c" opacity="0.8" />
                </G>
              );
            })}

          {/* Active Carriers & Standby Ghosts */}
          {carriers.map((car, idx) => {
            const x = freqToX(car.freq);
            if (x < -20 || x > canvasWidth + 20) return null;
            const isGhost = !!car.isGhost;
            const isKeyed = !!car.isKeyed;
            const dbm = car.powerDbm ?? (isGhost ? -52 : (car.type === 'BASE_TX' ? -10 : -18));
            const peakY = dbmToY(dbm);
            const isRx = car.type === 'PORT_TX';

            const hitImd = imds.find(imd => Math.abs(imd.freq - car.freq) <= 0.005);
            const hasClash = !!(car.hasClash || hitImd);

            const halfBwPx = ((rbwKhz / 1000) / span) * canvasWidth;

            let strokeColor = '#facc15';
            if (isRx) strokeColor = isKeyed ? '#22c55e' : (isGhost ? '#38bdf8' : '#38bdf8');
            if (car.type === 'IFB') strokeColor = '#06b6d4';
            if (car.type === 'WALKIE') strokeColor = isKeyed ? '#22c55e' : (isGhost ? '#fb923c' : '#fb923c');
            if (car.locked) strokeColor = '#4ade80';
            if (hasClash) strokeColor = '#ef4444';

            const leftX = x - Math.max(4, halfBwPx);
            const rightX = x + Math.max(4, halfBwPx);
            const baseY = TOP_MARGIN + PLOT_HEIGHT;

            const pathData = `M ${leftX - 6} ${baseY} Q ${leftX} ${baseY} ${x - 2} ${peakY + 2} L ${x} ${peakY} L ${x + 2} ${peakY + 2} Q ${rightX} ${baseY} ${rightX + 6} ${baseY} Z`;

            if (isGhost) {
              return (
                <G key={`car_ghost_${idx}`}>
                  <Path
                    d={pathData}
                    fill={hasClash ? 'rgba(239, 68, 68, 0.75)' : 'rgba(56, 189, 248, 0.04)'}
                    stroke={strokeColor}
                    strokeWidth={hasClash ? '2.5' : '1.2'}
                    strokeDasharray={hasClash ? 'none' : '3, 3'}
                  />
                  <Circle
                    cx={x}
                    cy={peakY}
                    r={hasClash ? 3.5 : 2.5}
                    fill={hasClash ? '#ef4444' : 'none'}
                    stroke={strokeColor}
                    strokeWidth="1.5"
                  />
                  <SvgText
                    x={x}
                    y={peakY - 5}
                    fill={hasClash ? '#ef4444' : strokeColor}
                    fontSize="7.5"
                    fontWeight={hasClash ? '900' : 'bold'}
                    fontFamily={Platform.OS === 'ios' ? 'Courier' : 'monospace'}
                    textAnchor="middle"
                    opacity="0.95"
                  >
                    {hasClash ? '[! CLASH] ' : ' '}
                    {car.label}
                  </SvgText>
                </G>
              );
            }

            return (
              <G key={`car_active_${idx}`}>
                <Path
                  d={pathData}
                  fill={
                    hasClash
                      ? 'rgba(239, 68, 68, 0.85)'
                      : (isKeyed
                          ? 'rgba(34, 197, 94, 0.35)'
                          : (car.type === 'BASE_TX'
                              ? 'rgba(250, 204, 21, 0.28)'
                              : 'rgba(56, 189, 248, 0.2)'))
                  }
                  stroke={strokeColor}
                  strokeWidth={hasClash ? '3' : (isKeyed ? '2.2' : '1.8')}
                />
                <Circle
                  cx={x}
                  cy={peakY}
                  r={hasClash ? 4.5 : (isKeyed ? 3.5 : 2.5)}
                  fill={strokeColor}
                />
                <SvgText
                  x={x}
                  y={peakY - 6}
                  fill={hasClash ? '#ffffff' : strokeColor}
                  stroke={hasClash ? '#991b1b' : 'none'}
                  strokeWidth={hasClash ? '0.6' : '0'}
                  fontSize="8"
                  fontWeight="900"
                  fontFamily={Platform.OS === 'ios' ? 'Courier' : 'monospace'}
                  textAnchor="middle"
                >
                  {hasClash ? '[! CLASH] ' : (isKeyed ? ' ' : '')}
                  {car.label}
                </SvgText>
              </G>
            );
          })}

          {/* Intermodulation Products (2-Tone & 3-Tone) */}
          {imds.map((imd, i) => {
            const x = freqToX(imd.freq);
            if (x < -10 || x > canvasWidth + 10) return null;
            const dbm = imd.type === '2-Tone' ? -48 : -58;
            const topY = dbmToY(dbm);
            const is2Tone = imd.type === '2-Tone';
            
            const hitsCarrier = imd.hasClash || carriers.some(c => Math.abs(c.freq - imd.freq) <= 0.005);
            const color = hitsCarrier ? '#ef4444' : (is2Tone ? '#f43f5e' : '#e11d48');

            return (
              <G key={`imd_${i}`}>
                <Line
                  x1={x}
                  y1={topY}
                  x2={x}
                  y2={TOP_MARGIN + PLOT_HEIGHT}
                  stroke={color}
                  strokeWidth={hitsCarrier ? '2.5' : '1.8'}
                  strokeDasharray={is2Tone ? 'none' : '3, 2'}
                />
                {/* Small solid circle cap slightly wider than the spike line width */}
                <Circle
                  cx={x}
                  cy={topY}
                  r={hitsCarrier ? 1.8 : 1.3}
                  fill={color}
                />
              </G>
            );
          })}

          {/* Sticky Left-Hand 2TX and 3TX Height Reference Labels (Transparent, small font, no blocking box) */}
          {(() => {
            const y2tx = dbmToY(-48);
            const y3tx = dbmToY(-58);

            return (
              <G key="imd_left_reference_labels">
                {/* 2TX reference dashed line across screen */}
                <Line
                  x1="0"
                  y1={y2tx}
                  x2={canvasWidth}
                  y2={y2tx}
                  stroke="#f43f5e"
                  strokeWidth="0.6"
                  strokeDasharray="2, 4"
                  opacity="0.25"
                />
                {/* 2TX Transparent Label (small font, no blocking box) */}
                <SvgText
                  x="4"
                  y={y2tx - 2}
                  fill="#f43f5e"
                  fontSize="6.5"
                  fontWeight="bold"
                  fontFamily={Platform.OS === 'ios' ? 'Courier' : 'monospace'}
                  textAnchor="start"
                >
                  2TX
                </SvgText>

                {/* 3TX reference dashed line across screen */}
                <Line
                  x1="0"
                  y1={y3tx}
                  x2={canvasWidth}
                  y2={y3tx}
                  stroke="#e11d48"
                  strokeWidth="0.6"
                  strokeDasharray="2, 4"
                  opacity="0.22"
                />
                {/* 3TX Transparent Label (small font, no blocking box) */}
                <SvgText
                  x="4"
                  y={y3tx - 2}
                  fill="#fb7185"
                  fontSize="6.5"
                  fontWeight="bold"
                  fontFamily={Platform.OS === 'ios' ? 'Courier' : 'monospace'}
                  textAnchor="start"
                >
                  3TX
                </SvgText>
              </G>
            );
          })()}

          {/* Delta Distance Span Line & Callout */}
          {marker1Freq !== null && marker2Freq !== null && (() => {
            const x1 = freqToX(marker1Freq);
            const x2 = freqToX(marker2Freq);
            const midX = (x1 + x2) / 2;
            const lineY = TOP_MARGIN + 18;

            return (
              <G key="delta_span_line">
                <Line
                  x1={x1}
                  y1={lineY}
                  x2={x2}
                  y2={lineY}
                  stroke="#38bdf8"
                  strokeWidth="2"
                  strokeDasharray="4, 3"
                />
                <Line
                  x1={x1}
                  y1={lineY - 6}
                  x2={x1}
                  y2={lineY + 6}
                  stroke="#ef4444"
                  strokeWidth="2"
                />
                <Line
                  x1={x2}
                  y1={lineY - 6}
                  x2={x2}
                  y2={lineY + 6}
                  stroke="#10b981"
                  strokeWidth="2"
                />
                <Rect
                  x={Math.max(6, Math.min(canvasWidth - 90, midX - 44))}
                  y={lineY - 14}
                  width={88}
                  height={13}
                  rx={3}
                  fill="#031525"
                  stroke="#38bdf8"
                  strokeWidth="1"
                />
                <SvgText
                  x={Math.max(6, Math.min(canvasWidth - 90, midX - 44)) + 44}
                  y={lineY - 4.5}
                  fill="#38bdf8"
                  fontSize="7.5"
                  fontWeight="bold"
                  fontFamily={Platform.OS === 'ios' ? 'Courier' : 'monospace'}
                  textAnchor="middle"
                >
                  Δ {deltaInfo ? (deltaInfo.absDiffKhz >= 1000 ? `${deltaInfo.absDiffMhz.toFixed(5)} MHz` : `${deltaInfo.absDiffKhz.toFixed(1)} kHz`) : ''}
                </SvgText>
              </G>
            );
          })()}

          {/* Marker 1 Reticle Point */}
          {marker1Freq !== null && (
            (() => {
              const mx = freqToX(marker1Freq);
              const my = dbmToY(marker1DbmState !== -95 ? marker1DbmState : marker1Dbm);
              if (mx >= 0 && mx <= canvasWidth) {
                return (
                  <G key="marker1">
                    <Line
                      x1={mx}
                      y1={TOP_MARGIN}
                      x2={mx}
                      y2={TOP_MARGIN + PLOT_HEIGHT}
                      stroke="#ef4444"
                      strokeWidth="1.2"
                      strokeDasharray="3, 3"
                    />
                    <Polygon
                      points={`${mx},${my - 7} ${mx + 7},${my} ${mx},${my + 7} ${mx - 7},${my}`}
                      fill="#ef4444"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                    <Circle cx={mx} cy={my} r={2} fill="#ffffff" />
                    <SvgText
                      x={mx}
                      y={Math.max(TOP_MARGIN + 10, my - 9)}
                      fill="#fca5a5"
                      fontSize="8"
                      fontWeight="bold"
                      fontFamily={Platform.OS === 'ios' ? 'Courier' : 'monospace'}
                      textAnchor="middle"
                    >
                      ● PT 1 (M1)
                    </SvgText>
                  </G>
                );
              }
              return null;
            })()
          )}

          {/* Marker 2 Reticle Point */}
          {marker2Freq !== null && (
            (() => {
              const mx = freqToX(marker2Freq);
              const my = dbmToY(marker2DbmState !== -95 ? marker2DbmState : (marker2Dbm ?? -70));
              if (mx >= 0 && mx <= canvasWidth) {
                return (
                  <G key="marker2">
                    <Line
                      x1={mx}
                      y1={TOP_MARGIN}
                      x2={mx}
                      y2={TOP_MARGIN + PLOT_HEIGHT}
                      stroke="#10b981"
                      strokeWidth="1.2"
                      strokeDasharray="3, 3"
                    />
                    <Polygon
                      points={`${mx},${my - 7} ${mx + 7},${my} ${mx},${my + 7} ${mx - 7},${my}`}
                      fill="#10b981"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                    <Circle cx={mx} cy={my} r={2} fill="#ffffff" />
                    <SvgText
                      x={mx}
                      y={Math.max(TOP_MARGIN + 10, my - 9)}
                      fill="#86efac"
                      fontSize="8"
                      fontWeight="bold"
                      fontFamily={Platform.OS === 'ios' ? 'Courier' : 'monospace'}
                      textAnchor="middle"
                    >
                      ● PT 2 (M2)
                    </SvgText>
                  </G>
                );
              }
              return null;
            })()
          )}
        </Svg>
      </View>

      {/* ================= QUICK RF BAND PRESETS (FROZEN WITH SCOPE) ================= */}
      {(() => {
        // Clustering helper: groups frequencies within 1.5 MHz of each other into distinct bands
        const getClusters = (freqList: number[], fallbackCenters: number[]) => {
          const valid = [...new Set(freqList.filter(f => f && f > 0))].sort((a, b) => b - a); // Largest first
          if (valid.length === 0) {
            return fallbackCenters
              .sort((a, b) => b - a)
              .map(center => ({
                center: Number(center.toFixed(5)),
                span: 3.50,
                min: center - 0.5,
                max: center + 0.5,
                nominalBand: Math.round(center)
              }));
          }
          const clusters: { freqs: number[]; min: number; max: number }[] = [];
          for (const f of valid) {
            // Group frequencies belonging to the same channel allocation sub-band (within 1.5 MHz)
            const match = clusters.find(c => Math.abs(f - c.min) <= 1.5 || Math.abs(f - c.max) <= 1.5);
            if (match) {
              match.freqs.push(f);
              match.min = Math.min(match.min, f);
              match.max = Math.max(match.max, f);
            } else {
              clusters.push({ freqs: [f], min: f, max: f });
            }
          }
          return clusters
            .map(c => {
              const center = Number(((c.min + c.max) / 2).toFixed(5));
              const spread = c.max - c.min;
              const span = Math.max(3.20, Math.min(8.0, Number((spread + 1.2).toFixed(2))));
              return { center, span, min: c.min, max: c.max, nominalBand: Math.round(center) };
            })
            .sort((a, b) => b.center - a.center); // Largest frequency band first
        };

        // 1. Base TX Clusters (sorted descending: 457 MHz first, then 455 MHz, 450 MHz, etc.)
        const baseFreqs = (carriers || [])
          .filter(c => c.type === 'BASE_TX' || c.type === 'IFB' || (!c.type && String(c.label || '').toUpperCase().includes('TX')))
          .map(c => c.freq)
          .filter(f => f > 0);

        const baseClusters = getClusters(baseFreqs, [457.36250, 455.21250]);

        // 2. Portable TX Clusters (sorted descending: 468 MHz first, then 467 MHz, etc.)
        const portFreqs = (carriers || [])
          .filter(c => c.type === 'PORT_TX' || c.type === 'WALKIE' || (!c.type && (String(c.label || '').toUpperCase().includes('PRT') || String(c.label || '').toUpperCase().includes('PORT'))))
          .map(c => c.freq)
          .filter(f => f > 0);

        const portClusters = getClusters(portFreqs, [468.25000, 467.41250]);

        // 3. Dual Band span calculation
        const allFreqs = (carriers || []).map(c => c.freq).filter(f => f > 0);
        const hasCarriers = allFreqs.length >= 2;
        const minAll = hasCarriers ? Math.min(...allFreqs) : 455.0;
        const maxAll = hasCarriers ? Math.max(...allFreqs) : 468.5;
        const dualCenter = Number(((minAll + maxAll) / 2).toFixed(5));
        const dualSpan = Math.max(18.0, Math.min(32.0, Number(((maxAll - minAll) + 3.0).toFixed(2))));

        // Active state detection by proximity
        let curBaseIdx = -1;
        let minBaseDiff = 999;
        baseClusters.forEach((c, idx) => {
          const diff = Math.abs(centerFreq - c.center);
          if (diff < minBaseDiff && diff < Math.max(2.0, c.span / 2)) {
            minBaseDiff = diff;
            curBaseIdx = idx;
          }
        });
        const isBaseActive = curBaseIdx >= 0 && span < 12.0;
        const activeBaseCluster = isBaseActive ? baseClusters[curBaseIdx] : null;

        let curPortIdx = -1;
        let minPortDiff = 999;
        portClusters.forEach((c, idx) => {
          const diff = Math.abs(centerFreq - c.center);
          if (diff < minPortDiff && diff < Math.max(2.0, c.span / 2)) {
            minPortDiff = diff;
            curPortIdx = idx;
          }
        });
        const isPortActive = curPortIdx >= 0 && span < 12.0;
        const activePortCluster = isPortActive ? portClusters[curPortIdx] : null;

        const isDualActive = span >= 14 && centerFreq >= minAll - 4 && centerFreq <= maxAll + 4;

        // Toggle handlers: snap to largest first, toggle between bands on subsequent clicks
        const handleBaseClick = () => {
          if (baseClusters.length === 0) return;
          const nextIdx = curBaseIdx >= 0 ? (curBaseIdx + 1) % baseClusters.length : 0;
          const target = baseClusters[nextIdx];
          setCenterText(target.center.toFixed(5));
          handleCenterChange(target.center);
          setSpanText(target.span.toFixed(2));
          onSpanChange(target.span);
        };

        const handlePortClick = () => {
          if (portClusters.length === 0) return;
          const nextIdx = curPortIdx >= 0 ? (curPortIdx + 1) % portClusters.length : 0;
          const target = portClusters[nextIdx];
          setCenterText(target.center.toFixed(5));
          handleCenterChange(target.center);
          setSpanText(target.span.toFixed(2));
          onSpanChange(target.span);
        };

        const handleDualClick = () => {
          setCenterText(dualCenter.toFixed(5));
          handleCenterChange(dualCenter);
          setSpanText(dualSpan.toFixed(2));
          onSpanChange(dualSpan);
        };

        return (
          <View style={analyzerStyles.quickBandRow}>
            <TouchableOpacity
              activeOpacity={0.7}
              style={[
                analyzerStyles.quickBandBtn,
                isDualActive && analyzerStyles.quickBandBtnActive
              ]}
              onPress={handleDualClick}
            >
              <Text style={analyzerStyles.quickBandBtnText} numberOfLines={1}>Dual Band</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              style={[
                analyzerStyles.quickBandBtn,
                isBaseActive && analyzerStyles.quickBandBtnActive
              ]}
              onPress={handleBaseClick}
            >
              <Text style={analyzerStyles.quickBandBtnText} numberOfLines={1}>
                {isBaseActive && activeBaseCluster && baseClusters.length > 1
                  ? `Base (${activeBaseCluster.nominalBand})`
                  : 'Base TX'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              style={[
                analyzerStyles.quickBandBtn,
                isPortActive && analyzerStyles.quickBandBtnActive
              ]}
              onPress={handlePortClick}
            >
              <Text style={analyzerStyles.quickBandBtnText} numberOfLines={1}>
                {isPortActive && activePortCluster && portClusters.length > 1
                  ? `Port (${activePortCluster.nominalBand})`
                  : 'Portable TX'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              style={[
                analyzerStyles.quickBandBtn,
                analyzerStyles.quickBandBtnUkExcl,
                ukExclusionsEnabled
                  ? { backgroundColor: '#7f1d1d', borderColor: '#ef4444' }
                  : { backgroundColor: '#0c1524', borderColor: '#1e3a5f' }
              ]}
              onPress={toggleUkExclusions}
            >
              <Text
                style={[
                  analyzerStyles.quickBandBtnText,
                  ukExclusionsEnabled ? { color: '#fca5a5' } : { color: '#94a3b8' }
                ]}
                numberOfLines={1}
              >
                {ukExclusionsEnabled ? 'UK Exclusions (ON)' : 'UK Exclusions'}
              </Text>
            </TouchableOpacity>
          </View>
        );
      })()}

      {/* ================= ZOOM & PAN HARDWARE BAR (FROZEN WITH SCOPE) ================= */}
      <View style={analyzerStyles.zoomPanRow}>
        <TouchableOpacity
          activeOpacity={0.7}
          style={analyzerStyles.zoomBtn}
          onPress={() => handlePan(-1)}
        >
          <Text style={analyzerStyles.zoomBtnText}>◄ PAN LEFT</Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.7}
          style={[analyzerStyles.zoomBtn, { backgroundColor: '#1e293b', borderColor: '#38bdf8' }]}
          onPress={() => handleZoom('IN')}
        >
          <Text style={[analyzerStyles.zoomBtnText, { color: '#38bdf8' }]}>🔍 ZOOM IN (+)</Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.7}
          style={[analyzerStyles.zoomBtn, { backgroundColor: '#1e293b', borderColor: '#38bdf8' }]}
          onPress={() => handleZoom('OUT')}
        >
          <Text style={[analyzerStyles.zoomBtnText, { color: '#38bdf8' }]}>🔍 ZOOM OUT (-)</Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.7}
          style={analyzerStyles.zoomBtn}
          onPress={() => handlePan(1)}
        >
          <Text style={analyzerStyles.zoomBtnText}>PAN RIGHT ►</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

/**
 * TacticalSpectrumAnalyzerControls:
 * The scrollable part of the tactical spectrum analyzer:
 * 1. Center Frequency & Step Size group
 * 2. Span & Span Step group
 * 3. Softkey Controls: Delta, Trace, and BW (with "BW" instead of "RBW")
 * These scroll underneath the frozen scope along with the rest of the page.
 */
export const TacticalSpectrumAnalyzerControls: React.FC<{
  state: TacticalSpectrumAnalyzerState;
  activeKeypadTarget?: string | null;
  onSelectKeypadTarget?: (target: string) => void;
}> = ({ state, activeKeypadTarget, onSelectKeypadTarget }) => {
  const {
    centerText,
    setCenterText,
    handleCenterInputCommit,
    handleCenterStep,
    centerStepText,
    setCenterStepText,
    handleCenterStepCommit,
    handleCenterStepDelta,
    centerStep,
    setCenterStep,
    spanText,
    setSpanText,
    handleSpanInputCommit,
    handleSpanStep,
    spanStepText,
    setSpanStepText,
    handleSpanStepCommit,
    handleSpanStepDelta,
    span,
    onSpanChange,
    deltaMode,
    setDeltaMode,
    setDeltaStep,
    marker1Freq,
    marker2Freq,
    setMarker1Freq,
    setMarker2Freq,
    setActiveMarker,
    deltaStep,
    traceMode,
    setTraceMode,
    setMaxHoldPeaks,
    rbwKhz,
    setRbwKhz
  } = state;

  return (
    <View style={analyzerStyles.controlsContainer}>
      {/* ================= CENTER FREQUENCY & STEP CONTROL GROUP ================= */}
      <View style={analyzerStyles.controlSection}>
        <View style={analyzerStyles.controlSectionHeader}>
          <Text style={analyzerStyles.controlSectionTitle}>CENTER FREQUENCY (MHz)</Text>
          <Text style={analyzerStyles.stepLabel}>STEP SIZE (MHz)</Text>
        </View>

        <View style={analyzerStyles.stepperRow}>
          {/* Center Frequency Box with ◄ and ► arrows */}
          <View style={analyzerStyles.stepperBox}>
            <TouchableOpacity
              activeOpacity={0.6}
              style={analyzerStyles.stepperArrowBtn}
              onPress={() => handleCenterStep(-1)}
            >
              <Text style={analyzerStyles.stepperArrowText}>◄</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                analyzerStyles.stepperInput,
                { justifyContent: 'center', alignItems: 'center' },
                activeKeypadTarget === 'tactical::center_freq' && analyzerStyles.stepperInputActive
              ]}
              onPress={() => onSelectKeypadTarget?.('tactical::center_freq')}
            >
              <Text style={[analyzerStyles.stepperInputText, activeKeypadTarget === 'tactical::center_freq' && analyzerStyles.stepperInputTextActive]}>
                {`${centerText}${activeKeypadTarget === 'tactical::center_freq' ? ' ▎' : ''}`}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.6}
              style={analyzerStyles.stepperArrowBtn}
              onPress={() => handleCenterStep(1)}
            >
              <Text style={analyzerStyles.stepperArrowText}>►</Text>
            </TouchableOpacity>
          </View>

          {/* Green 'Set' Button */}
          <TouchableOpacity
            activeOpacity={0.7}
            style={analyzerStyles.setBtn}
            onPress={handleCenterInputCommit}
          >
            <Text style={analyzerStyles.setBtnText}>Set</Text>
          </TouchableOpacity>

          {/* Center Step Size Box with - and + buttons */}
          <View style={analyzerStyles.stepSizeBox}>
            <TouchableOpacity
              activeOpacity={0.6}
              style={analyzerStyles.stepperArrowBtn}
              onPress={() => handleCenterStepDelta(-1)}
            >
              <Text style={analyzerStyles.stepperArrowText}>-</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                analyzerStyles.stepperInput,
                { justifyContent: 'center', alignItems: 'center' },
                activeKeypadTarget === 'tactical::center_step' && analyzerStyles.stepperInputActive
              ]}
              onPress={() => onSelectKeypadTarget?.('tactical::center_step')}
            >
              <Text style={[analyzerStyles.stepperInputText, activeKeypadTarget === 'tactical::center_step' && analyzerStyles.stepperInputTextActive]}>
                {`${centerStepText}${activeKeypadTarget === 'tactical::center_step' ? ' ▎' : ''}`}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.6}
              style={analyzerStyles.stepperArrowBtn}
              onPress={() => handleCenterStepDelta(1)}
            >
              <Text style={analyzerStyles.stepperArrowText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Step Preset Pills */}
        <View style={analyzerStyles.pillRow}>
          <Text style={analyzerStyles.stepPillLabel}>PRESET STEPS:</Text>
          {[0.0125, 0.025, 0.100, 0.500, 1.000].map((s) => {
            const isSel = Math.abs(centerStep - s) < 0.001;
            const label = s < 0.1 ? `${(s * 1000).toFixed(1)}k` : s < 1 ? `${(s * 1000).toFixed(0)}k` : `${s.toFixed(0)}M`;
            return (
              <TouchableOpacity
                key={`cstep_${s}`}
                style={[analyzerStyles.miniPill, isSel && analyzerStyles.miniPillActive]}
                onPress={() => {
                  setCenterStep(s);
                  setCenterStepText(s.toString());
                }}
              >
                <Text style={[analyzerStyles.miniPillText, isSel && analyzerStyles.miniPillTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ================= SPAN & SPAN STEP CONTROL GROUP ================= */}
      <View style={analyzerStyles.controlSection}>
        <View style={analyzerStyles.controlSectionHeader}>
          <Text style={analyzerStyles.controlSectionTitle}>SPAN (MHz)</Text>
          <Text style={analyzerStyles.stepLabel}>SPAN STEP (MHz)</Text>
        </View>

        <View style={analyzerStyles.stepperRow}>
          {/* Span Box with - and + signs */}
          <View style={analyzerStyles.stepperBox}>
            <TouchableOpacity
              activeOpacity={0.6}
              style={analyzerStyles.stepperArrowBtn}
              onPress={() => handleSpanStep(-1)}
            >
              <Text style={analyzerStyles.stepperArrowText}>-</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                analyzerStyles.stepperInput,
                { justifyContent: 'center', alignItems: 'center' },
                activeKeypadTarget === 'tactical::span' && analyzerStyles.stepperInputActive
              ]}
              onPress={() => onSelectKeypadTarget?.('tactical::span')}
            >
              <Text style={[analyzerStyles.stepperInputText, activeKeypadTarget === 'tactical::span' && analyzerStyles.stepperInputTextActive]}>
                {`${spanText}${activeKeypadTarget === 'tactical::span' ? ' ▎' : ''}`}
              </Text>
            </TouchableOpacity>
 
            <TouchableOpacity
              activeOpacity={0.6}
              style={analyzerStyles.stepperArrowBtn}
              onPress={() => handleSpanStep(1)}
            >
              <Text style={analyzerStyles.stepperArrowText}>+</Text>
            </TouchableOpacity>
          </View>

          {/* Green 'Set' Button */}
          <TouchableOpacity
            activeOpacity={0.7}
            style={analyzerStyles.setBtn}
            onPress={handleSpanInputCommit}
          >
            <Text style={analyzerStyles.setBtnText}>Set</Text>
          </TouchableOpacity>

          {/* Span Step Size Box with - and + signs */}
          <View style={analyzerStyles.stepSizeBox}>
            <TouchableOpacity
              activeOpacity={0.6}
              style={analyzerStyles.stepperArrowBtn}
              onPress={() => handleSpanStepDelta(-1)}
            >
              <Text style={analyzerStyles.stepperArrowText}>-</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                analyzerStyles.stepperInput,
                { justifyContent: 'center', alignItems: 'center' },
                activeKeypadTarget === 'tactical::span_step' && analyzerStyles.stepperInputActive
              ]}
              onPress={() => onSelectKeypadTarget?.('tactical::span_step')}
            >
              <Text style={[analyzerStyles.stepperInputText, activeKeypadTarget === 'tactical::span_step' && analyzerStyles.stepperInputTextActive]}>
                {`${spanStepText}${activeKeypadTarget === 'tactical::span_step' ? ' ▎' : ''}`}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.6}
              style={analyzerStyles.stepperArrowBtn}
              onPress={() => handleSpanStepDelta(1)}
            >
              <Text style={analyzerStyles.stepperArrowText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Span Presets */}
        <View style={analyzerStyles.pillRow}>
          <Text style={analyzerStyles.stepPillLabel}>PRESET SPAN:</Text>
          {[
            { label: '0.5M', val: 0.5 },
            { label: '2.0M', val: 2.0 },
            { label: '6.0M', val: 6.0 },
            { label: '18.0M', val: 18.0 },
            { label: 'FULL 24M', val: 24.0 }
          ].map((item) => {
            const isSel = Math.abs(span - item.val) < 0.1;
            return (
              <TouchableOpacity
                key={`span_${item.label}`}
                style={[analyzerStyles.miniPill, isSel && analyzerStyles.miniPillActive]}
                onPress={() => {
                  setSpanText(item.val.toFixed(2));
                  onSpanChange(item.val);
                }}
              >
                <Text style={[analyzerStyles.miniPillText, isSel && analyzerStyles.miniPillTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ================= PHYSICAL-STYLE SOFTKEY CONTROLS ================= */}
      <View style={analyzerStyles.softkeyRow}>
        {/* DELTA 2-TAP MEASURE BUTTON */}
        <TouchableOpacity
          activeOpacity={0.8}
          style={[
            analyzerStyles.softkeyBtn,
            deltaMode && { borderColor: '#38bdf8', backgroundColor: '#0c2238' },
            marker1Freq !== null && marker2Freq !== null && { borderColor: '#10b981', backgroundColor: '#0e231b' }
          ]}
          onPress={() => {
            if (!deltaMode) {
              setDeltaMode(true);
              setDeltaStep(1);
              setMarker1Freq(null);
              setMarker2Freq(null);
            } else {
              setDeltaMode(false);
              setDeltaStep(1);
              setMarker2Freq(null);
              setActiveMarker(1);
            }
          }}
        >
          <Text
            style={[
              analyzerStyles.softkeyBtnTitle,
              deltaMode && { color: '#38bdf8' },
              marker1Freq !== null && marker2Freq !== null && { color: '#4ade80' }
            ]}
          >
            {deltaMode
              ? (marker1Freq !== null && marker2Freq !== null
                  ? 'DELTA: ACTIVE'
                  : `DELTA: TAP ${deltaStep}/2`)
              : 'DELTA (2-TAP)'}
          </Text>
          <Text style={analyzerStyles.softkeyBtnSub}>
            {deltaMode
              ? (marker1Freq === null
                  ? '1. TAP POINT 1'
                  : (marker2Freq === null ? '2. TAP POINT 2' : 'RESET / MEASURE'))
              : 'TAP 2 POINTS'}
          </Text>
        </TouchableOpacity>

        {/* TRACE MODE SELECTOR */}
        <TouchableOpacity
          activeOpacity={0.8}
          style={[analyzerStyles.softkeyBtn, traceMode === 'MAX_HOLD' && { borderColor: '#f97316' }]}
          onPress={() => {
            if (traceMode === 'LIVE') setTraceMode('MAX_HOLD');
            else if (traceMode === 'MAX_HOLD') setTraceMode('AVG');
            else {
              setTraceMode('LIVE');
              setMaxHoldPeaks([]);
            }
          }}
        >
          <Text style={[analyzerStyles.softkeyBtnTitle, traceMode === 'MAX_HOLD' && { color: '#fb923c' }]}>
            TRACE: {traceMode}
          </Text>
          <Text style={analyzerStyles.softkeyBtnSub}>
            {traceMode === 'MAX_HOLD' ? 'GHOST BURSTS' : 'CYCLE MODE'}
          </Text>
        </TouchableOpacity>

        {/* BW FILTER MASK (Formerly RBW) */}
        <TouchableOpacity
          activeOpacity={0.8}
          style={analyzerStyles.softkeyBtn}
          onPress={() => {
            if (rbwKhz === 12.5) setRbwKhz(25);
            else if (rbwKhz === 25) setRbwKhz(6.25);
            else setRbwKhz(12.5);
          }}
        >
          <Text style={analyzerStyles.softkeyBtnTitle}>BW: {rbwKhz}k</Text>
          <Text style={analyzerStyles.softkeyBtnSub}>
            {rbwKhz === 12.5 ? 'STD 12.5k' : rbwKhz === 25 ? 'WIDE 25k' : 'dMR 6.25k'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

/**
 * Standard TacticalSpectrumAnalyzer component:
 * Renders both the scope and controls together (for standalone usage).
 */
export const TacticalSpectrumAnalyzer: React.FC<TacticalSpectrumAnalyzerProps> = (props) => {
  const state = useTacticalSpectrumAnalyzer(props);
  return (
    <View style={analyzerStyles.container}>
      <TacticalSpectrumAnalyzerScope state={state} />
      <TacticalSpectrumAnalyzerControls
        state={state}
        activeKeypadTarget={props.activeKeypadTarget}
        onSelectKeypadTarget={props.onSelectKeypadTarget}
      />
    </View>
  );
};

export const analyzerStyles = StyleSheet.create({
  container: {
    marginTop: 2
  },
  scopeWrapper: {
    paddingBottom: 2
  },
  controlsContainer: {
    marginTop: 4,
    paddingBottom: 2
  },
  hudTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0a101d',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderWidth: 1,
    borderColor: '#1e293b'
  },
  hudLeft: {
    flex: 1
  },
  hudScopeTitle: {
    color: '#38bdf8',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  hudScopeSub: {
    color: '#64748b',
    fontSize: 7.5,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  markerHudBox: {
    alignItems: 'flex-end'
  },
  markerBadgeM1: {
    color: '#f87171',
    fontSize: 8,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  markerBadgeM2: {
    color: '#4ade80',
    fontSize: 8,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  markerBadgeDeltaPrompt: {
    color: '#38bdf8',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  screenBezel: {
    backgroundColor: '#020617',
    borderWidth: 1.5,
    borderColor: '#1e3a5f',
    overflow: 'hidden'
  },

  // Zoom & Pan hardware bar
  zoomPanRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 3,
    marginBottom: 2
  },
  zoomBtn: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 4,
    paddingVertical: 5,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center'
  },
  zoomBtnText: {
    color: '#cbd5e1',
    fontSize: 7.5,
    fontWeight: '900',
    letterSpacing: 0.4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },

  // Control section
  controlSection: {
    backgroundColor: '#0a101d',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 6,
    padding: 6,
    marginTop: 4
  },
  controlSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  controlSectionTitle: {
    color: '#94a3b8',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.6,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  stepLabel: {
    color: '#64748b',
    fontSize: 7.5,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },

  // Stepper rows
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5
  },
  stepperBox: {
    flex: 1,
    height: 28,
    flexDirection: 'row',
    backgroundColor: '#030712',
    borderWidth: 1,
    borderColor: '#38bdf8',
    borderRadius: 4,
    alignItems: 'center',
    overflow: 'hidden'
  },
  setBtn: {
    height: 28,
    minWidth: 36,
    paddingHorizontal: 8,
    backgroundColor: '#16a34a',
    borderWidth: 1,
    borderColor: '#22c55e',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center'
  },
  setBtnText: {
    color: '#ffffff',
    fontSize: 9.5,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 0.3
  },
  stepSizeBox: {
    width: 95,
    height: 28,
    flexDirection: 'row',
    backgroundColor: '#030712',
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 4,
    alignItems: 'center',
    overflow: 'hidden'
  },
  stepperArrowBtn: {
    height: '100%',
    paddingHorizontal: 6,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center'
  },
  stepperArrowText: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: 'bold'
  },
  stepperInput: {
    flex: 1,
    height: '100%',
    color: '#38bdf8',
    fontSize: 10.5,
    fontWeight: '900',
    textAlign: 'center',
    paddingVertical: 0,
    paddingHorizontal: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  stepperInputText: {
    color: '#38bdf8',
    fontSize: 10.5,
    fontWeight: '900',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  stepperInputTextActive: {
    color: '#ffffff',
    fontWeight: '900'
  },
  stepperInputActive: {
    borderColor: '#38bdf8',
    borderWidth: 1.5,
    backgroundColor: '#082f49',
    borderRadius: 3,
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 6,
    // @ts-ignore
    boxShadow: '0 0 8px rgba(56, 189, 248, 0.85), 0 0 16px rgba(56, 189, 248, 0.4), inset 0 0 4px rgba(56, 189, 248, 0.35)',
    // @ts-ignore
    animation: Platform.OS === 'web' ? 'activeInputGlowPulse 1.8s infinite ease-in-out' : undefined,
  },

  // Preset pills
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 5
  },
  stepPillLabel: {
    color: '#475569',
    fontSize: 7,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  miniPill: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 3
  },
  miniPillActive: {
    backgroundColor: '#0369a1',
    borderColor: '#38bdf8'
  },
  miniPillText: {
    color: '#94a3b8',
    fontSize: 7.5,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  miniPillTextActive: {
    color: '#ffffff',
    fontWeight: '900'
  },

  // Softkey controls
  softkeyRow: {
    flexDirection: 'row',
    gap: 5,
    marginTop: 4
  },
  softkeyBtn: {
    flex: 1,
    backgroundColor: '#090f1d',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 5,
    paddingVertical: 5,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center'
  },
  softkeyBtnTitle: {
    color: '#cbd5e1',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.3,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  softkeyBtnSub: {
    color: '#64748b',
    fontSize: 6.5,
    fontWeight: 'bold',
    marginTop: 1
  },

  // Quick RF Band Presets
  quickBandRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
    marginBottom: 2
  },
  quickBandBtn: {
    flex: 1,
    backgroundColor: '#0c1524',
    borderWidth: 1,
    borderColor: '#1e3a5f',
    borderRadius: 4,
    paddingVertical: 5,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center'
  },
  quickBandBtnUkExcl: {
    flex: 1.45,
    paddingHorizontal: 2
  },
  quickBandBtnActive: {
    backgroundColor: '#0369a1',
    borderColor: '#38bdf8'
  },
  quickBandBtnText: {
    color: '#cbd5e1',
    fontSize: 7.2,
    fontWeight: '900',
    letterSpacing: 0.1,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    textAlign: 'center'
  }
});


export interface PttChannel {
  index: number;
  label: string;
  role: string;
  txFreq: number;
  rxFreq?: number;
  isSimplex: boolean;
  simplexType?: 'base_tx' | 'walkie';
  zoneName: string;
  zoneId: string;
  isKeyed: boolean;
  powerWatts: number;
}

interface PttSimulatorProps {
  channels: PttChannel[];
  onToggleKey: (index: number) => void;
  onKeyAll: () => void;
  onReleaseAll: () => void;
  isStressTesting: boolean;
  onToggleStressTest: () => void;
  activeZoneName: string;
  liveImdClashes: string[];
}

export const PttSimulator: React.FC<PttSimulatorProps> = ({
  channels,
  onToggleKey,
  onKeyAll,
  onReleaseAll,
  isStressTesting,
  onToggleStressTest,
  activeZoneName,
  liveImdClashes
}) => {
  const keyedCount = channels.filter((c) => c.isKeyed).length;

  return (
    <View style={pttStyles.container}>
      {/* Simulator Control Header */}
      <View style={pttStyles.headerRow}>
        <View>
          <Text style={pttStyles.title}>PTT BURST &amp; STRESS SIMULATOR</Text>
          <Text style={pttStyles.subtitle}>
            SIMULATING SIMULTANEOUS CREW KEY-UPS IN {activeZoneName.toUpperCase()}
          </Text>
        </View>

        <View style={pttStyles.statBadge}>
          <Text style={pttStyles.statBadgeLabel}>ON AIR</Text>
          <Text style={[pttStyles.statBadgeValue, keyedCount > 0 ? pttStyles.statValueActive : {}]}>
            {keyedCount} / {channels.length} TX
          </Text>
        </View>
      </View>

      {/* Live Clash Alert Banner */}
      {liveImdClashes.length > 0 ? (
        <View style={pttStyles.clashBanner}>
          <Text style={pttStyles.clashBannerTitle}>
            [!] DANGER: {liveImdClashes.length} SIMULTANEOUS IMD COLLISION(S) DETECTED!
          </Text>
          {liveImdClashes.slice(0, 3).map((clash, idx) => (
            <Text key={idx} style={pttStyles.clashBannerText}>
              * {clash}
            </Text>
          ))}
        </View>
      ) : keyedCount >= 2 ? (
        <View style={pttStyles.safeBanner}>
          <Text style={pttStyles.safeBannerText}>
             {keyedCount} TRANSMITTERS KEYED: ZERO IMD COLLISION ON ACTIVE RECEIVERS
          </Text>
        </View>
      ) : null}

      {/* Global Action Buttons */}
      <View style={pttStyles.actionRow}>
        <TouchableOpacity
          activeOpacity={0.8}
          style={[pttStyles.stressBtn, isStressTesting && pttStyles.stressBtnActive]}
          onPress={onToggleStressTest}
        >
          <Text style={[pttStyles.stressBtnText, isStressTesting && { color: '#ffffff' }]}>
            {isStressTesting ? '[STOP] STOP STRESS TEST' : ' AUTO STRESS TEST'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          style={pttStyles.keyAllBtn}
          onPress={keyedCount === channels.length ? onReleaseAll : onKeyAll}
        >
          <Text style={pttStyles.keyAllBtnText}>
            {keyedCount === channels.length ? 'RELEASE ALL' : 'KEY ALL TX'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Channels Grid / List */}
      <ScrollView style={pttStyles.channelsScroll} nestedScrollEnabled={true}>
        {channels.length === 0 ? (
          <Text style={pttStyles.emptyText}>
            NO COORDINATED CHANNELS YET. TAP &quot;CALCULATE&quot; TO POPULATE.
          </Text>
        ) : (
          <View style={pttStyles.channelGrid}>
            {channels.map((chan) => {
              const isBase = chan.simplexType === 'base_tx' || !chan.isSimplex;
              const badgeType = !chan.isSimplex ? 'DUPLEX' : (chan.simplexType === 'base_tx' ? 'IFB' : 'WALKIE');

              return (
                <TouchableOpacity
                  key={`ptt_${chan.index}`}
                  activeOpacity={0.7}
                  style={[
                    pttStyles.channelCard,
                    chan.isKeyed && pttStyles.channelCardKeyed,
                    chan.isKeyed && !isBase && pttStyles.channelCardKeyedWalkie
                  ]}
                  onPress={() => onToggleKey(chan.index)}
                >
                  {/* Top line: LED & Role */}
                  <View style={pttStyles.cardHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 }}>
                      <View style={[pttStyles.ledDot, chan.isKeyed ? pttStyles.ledDotActive : pttStyles.ledDotIdle]} />
                      <Text
                        style={[pttStyles.roleText, chan.isKeyed && { color: '#ffffff' }]}
                        numberOfLines={1}
                      >
                        {chan.role || `CH ${chan.index + 1}`}
                      </Text>
                    </View>
                    <View style={[pttStyles.typeBadge, chan.isKeyed ? pttStyles.typeBadgeActive : {}]}>
                      <Text style={pttStyles.typeBadgeText}>{badgeType}</Text>
                    </View>
                  </View>

                  {/* Frequency & Power Details */}
                  <View style={pttStyles.cardFreqRow}>
                    <Text style={[pttStyles.freqText, chan.isKeyed ? pttStyles.freqTextKeyed : {}]}>
                      TX: {chan.txFreq.toFixed(5)} MHz
                    </Text>
                    <Text style={pttStyles.powerText}>
                      {chan.isKeyed ? `${chan.powerWatts}W RF` : 'STANDBY'}
                    </Text>
                  </View>

                  {/* Big PTT Tactile Switch */}
                  <View style={[pttStyles.pttButton, chan.isKeyed ? pttStyles.pttButtonActive : {}]}>
                    <Text style={[pttStyles.pttButtonText, chan.isKeyed ? pttStyles.pttButtonTextActive : {}]}>
                      {chan.isKeyed ? ' PTT ACTIVE (ON AIR)' : 'PUSH TO TALK (TAP)'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const pttStyles = StyleSheet.create({
  container: {
    backgroundColor: '#090f1d',
    borderRadius: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginTop: 6
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  title: {
    color: '#38bdf8',
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  subtitle: {
    color: '#64748b',
    fontSize: 7.5,
    fontWeight: 'bold',
    marginTop: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  statBadge: {
    backgroundColor: '#111827',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center'
  },
  statBadgeLabel: {
    color: '#9ca3af',
    fontSize: 7,
    fontWeight: 'bold'
  },
  statBadgeValue: {
    color: '#e5e7eb',
    fontSize: 9.5,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  statValueActive: {
    color: '#ef4444'
  },
  clashBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 4,
    padding: 6,
    marginBottom: 8
  },
  clashBannerTitle: {
    color: '#f87171',
    fontSize: 8.5,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  clashBannerText: {
    color: '#fca5a5',
    fontSize: 7.5,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  safeBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: '#10b981',
    borderRadius: 4,
    padding: 6,
    marginBottom: 8
  },
  safeBannerText: {
    color: '#34d399',
    fontSize: 8,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  actionRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8
  },
  stressBtn: {
    flex: 1.2,
    backgroundColor: '#1e1b4b',
    borderColor: '#6366f1',
    borderWidth: 1,
    paddingVertical: 6,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center'
  },
  stressBtnActive: {
    backgroundColor: '#dc2626',
    borderColor: '#f87171'
  },
  stressBtnText: {
    color: '#c7d2fe',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  keyAllBtn: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderColor: '#475569',
    borderWidth: 1,
    paddingVertical: 6,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center'
  },
  keyAllBtnText: {
    color: '#cbd5e1',
    fontSize: 8.5,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  channelsScroll: {
    maxHeight: 210
  },
  emptyText: {
    color: '#64748b',
    fontSize: 8.5,
    textAlign: 'center',
    paddingVertical: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  channelGrid: {
    gap: 6
  },
  channelCard: {
    backgroundColor: '#0f172a',
    borderRadius: 5,
    padding: 7,
    borderWidth: 1,
    borderColor: '#1e293b'
  },
  channelCardKeyed: {
    backgroundColor: '#1f1315',
    borderColor: '#ef4444'
  },
  channelCardKeyedWalkie: {
    backgroundColor: '#24140b',
    borderColor: '#f97316'
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  ledDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5
  },
  ledDotIdle: {
    backgroundColor: '#475569'
  },
  ledDotActive: {
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4
  },
  roleText: {
    color: '#cbd5e1',
    fontSize: 9,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  typeBadge: {
    backgroundColor: '#1e293b',
    paddingVertical: 1,
    paddingHorizontal: 4,
    borderRadius: 3
  },
  typeBadgeActive: {
    backgroundColor: '#ef4444'
  },
  typeBadgeText: {
    color: '#e2e8f0',
    fontSize: 7,
    fontWeight: '900'
  },
  cardFreqRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5
  },
  freqText: {
    color: '#94a3b8',
    fontSize: 8.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  freqTextKeyed: {
    color: '#fca5a5',
    fontWeight: 'bold'
  },
  powerText: {
    color: '#64748b',
    fontSize: 7.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: 'bold'
  },
  pttButton: {
    backgroundColor: '#1e293b',
    paddingVertical: 5,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155'
  },
  pttButtonActive: {
    backgroundColor: '#dc2626',
    borderColor: '#f87171'
  },
  pttButtonText: {
    color: '#94a3b8',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  pttButtonTextActive: {
    color: '#ffffff'
  }
});





export interface CallSheetItem {
  index: number;
  role: string;
  type: string;
  txFreq: number;
  rxFreq?: number;
  split?: string;
  tone: string;
  zoneName: string;
}

interface CrewCallSheetModalProps {
  visible: boolean;
  onClose: () => void;
  items: CallSheetItem[];
  onUpdateRole: (index: number, role: string) => void;
  onUpdateTone: (index: number, tone: string) => void;
  activeZoneName?: string;
}

export const CrewCallSheetModal: React.FC<CrewCallSheetModalProps> = ({
  visible,
  onClose,
  items,
  onUpdateRole,
  onUpdateTone,
  activeZoneName
}) => {
  const [showName, setShowName] = useState('OB PRODUCTION SHOW');

  // Format as Plain Text Call Sheet
  const generateTextCallSheet = () => {
    let out = `========================================================\n`;
    out += `        CREW RADIO FREQUENCY CALL SHEET\n`;
    out += `        SHOW: ${showName.toUpperCase()}\n`;
    out += `========================================================\n\n`;
    out += `CH | ROLE / ASSIGNMENT   | TYPE   | BASE TX    | PORT TX    | TONE     | ZONE\n`;
    out += `---|---------------------|--------|------------|------------|----------|------\n`;

    items.forEach((it, idx) => {
      const chStr = (idx + 1).toString().padStart(2, '0');
      const roleStr = (it.role || `Radio ${idx + 1}`).padEnd(19, ' ').slice(0, 19);
      const typeStr = it.type.padEnd(6, ' ').slice(0, 6);
      const txStr = it.txFreq ? `${it.txFreq.toFixed(5)}`.padEnd(10, ' ') : '   ---    ';
      const rxStr = it.rxFreq ? `${it.rxFreq.toFixed(5)}`.padEnd(10, ' ') : ' SIMPLEX  ';
      const toneStr = (it.tone || '100.0Hz').padEnd(8, ' ');
      const zoneStr = it.zoneName.slice(0, 10);

      out += `${chStr} | ${roleStr} | ${typeStr} | ${txStr} | ${rxStr} | ${toneStr} | ${zoneStr}\n`;
    });

    out += `\n========================================================\n`;
    out += `Generated by RF Suite Talkback Coordination\n`;
    return out;
  };

  // Format as CSV for radio programming
  const generateCsvCallSheet = () => {
    let csv = `Channel,Role,Type,BaseTxMHz,PortTxMHz,SplitMHz,SubTone,ZoneName\n`;
    items.forEach((it, idx) => {
      const portTx = it.rxFreq ? it.rxFreq.toFixed(5) : '';
      const split = it.split || '';
      csv += `${idx + 1},"${it.role || `Radio ${idx + 1}`}",${it.type},${it.txFreq.toFixed(5)},${portTx},"${split}","${it.tone || '100.0Hz'}","${it.zoneName}"\n`;
    });
    return csv;
  };

  const handleShare = async () => {
    try {
      const text = generateTextCallSheet();
      await Share.share({
        message: text,
        title: `${showName} - Frequency Call Sheet`
      });
    } catch (err) {
      console.warn('Share error', err);
    }
  };

  const handleCopyCsv = async () => {
    const csv = generateCsvCallSheet();
    try {
      await Share.share({
        message: csv,
        title: `${showName} CSV Data`
      });
    } catch (err) {
      console.warn('CSV share error', err);
    }
  };

  if (!visible) return null;

  return (
    <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
      <View style={callSheetStyles.modalBackdrop}>
        <View style={callSheetStyles.modalCard}>
          {/* Header */}
          <View style={callSheetStyles.headerRow}>
            <View>
              <Text style={callSheetStyles.modalTitle}>CREW FREQUENCY CALL SHEET</Text>
              <Text style={callSheetStyles.modalSub}>COMMUNICATIONS DISTRIBUTION MATRIX</Text>
            </View>
            <TouchableOpacity style={callSheetStyles.closeBtn} onPress={onClose}>
              <Text style={callSheetStyles.closeBtnText}>x</Text>
            </TouchableOpacity>
          </View>

          {/* Show Title Input */}
          <View style={callSheetStyles.showNameRow}>
            <Text style={callSheetStyles.showLabel}>SHOW TITLE:</Text>
            <TextInput
              style={callSheetStyles.showInput}
              value={showName}
              onChangeText={setShowName}
              placeholder="Show Name / OB Unit..."
              placeholderTextColor="#475569"
            />
          </View>

          {/* Export Action Buttons */}
          <View style={callSheetStyles.actionRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[callSheetStyles.actionBtn, { backgroundColor: '#0284c7', borderColor: '#38bdf8' }]}
              onPress={handleShare}
            >
              <Text style={callSheetStyles.actionBtnText}> SHARE CALL SHEET</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              style={[callSheetStyles.actionBtn, { backgroundColor: '#0f766e', borderColor: '#2dd4bf' }]}
              onPress={handleCopyCsv}
            >
              <Text style={callSheetStyles.actionBtnText}> EXPORT RADIO CSV</Text>
            </TouchableOpacity>
          </View>

          {/* Table Header */}
          <View style={callSheetStyles.tableHeaderRow}>
            <Text style={[callSheetStyles.th, { width: 30 }]}>CH</Text>
            <Text style={[callSheetStyles.th, { flex: 1.5 }]}>ROLE / USER</Text>
            <Text style={[callSheetStyles.th, { width: 45 }]}>TYPE</Text>
            <Text style={[callSheetStyles.th, { flex: 1.2, textAlign: 'center' }]}>BASE TX</Text>
            <Text style={[callSheetStyles.th, { flex: 1.2, textAlign: 'center' }]}>PORT TX</Text>
            <Text style={[callSheetStyles.th, { width: 55, textAlign: 'center' }]}>TONE</Text>
          </View>

          {/* Table Rows */}
          <ScrollView style={callSheetStyles.tableScroll} nestedScrollEnabled={true}>
            {items.length === 0 ? (
              <Text style={callSheetStyles.emptyText}>
                No coordinated channels found. Calculate zones first.
              </Text>
            ) : (
              items.map((it, idx) => {
                const isDup = it.type === 'DUP';
                return (
                  <View key={`sheet_${idx}`} style={callSheetStyles.tableRow}>
                    <Text style={callSheetStyles.chNum}>{(idx + 1).toString().padStart(2, '0')}</Text>

                    {/* Role Input */}
                    <TextInput
                      style={callSheetStyles.roleInput}
                      value={it.role}
                      placeholder={`Radio ${idx + 1}`}
                      placeholderTextColor="#475569"
                      onChangeText={(v) => onUpdateRole(idx, v)}
                    />

                    {/* Type Badge */}
                    <View
                      style={[
                        callSheetStyles.typePill,
                        isDup ? callSheetStyles.typePillDup : callSheetStyles.typePillSimp
                      ]}
                    >
                      <Text style={callSheetStyles.typePillText}>{it.type}</Text>
                    </View>

                    {/* Base TX */}
                    <Text style={callSheetStyles.freqCell}>{it.txFreq ? it.txFreq.toFixed(5) : '---'}</Text>

                    {/* Port TX */}
                    <Text style={[callSheetStyles.freqCell, !isDup && { color: '#64748b' }]}>
                      {isDup && it.rxFreq ? it.rxFreq.toFixed(5) : 'SIMPLEX'}
                    </Text>

                    {/* Tone Input */}
                    <TextInput
                      style={callSheetStyles.toneInput}
                      value={it.tone || '100.0'}
                      onChangeText={(v) => onUpdateTone(idx, v)}
                    />
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Bottom dismissal */}
          <TouchableOpacity style={callSheetStyles.doneBtn} onPress={onClose}>
            <Text style={callSheetStyles.doneBtnText}>DONE / CLOSE</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const callSheetStyles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12
  },
  modalCard: {
    backgroundColor: '#0c1322',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#38bdf8',
    width: '100%',
    maxHeight: '90%',
    padding: 12
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  modalTitle: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  modalSub: {
    color: '#64748b',
    fontSize: 8,
    fontWeight: 'bold',
    marginTop: 1
  },
  closeBtn: {
    backgroundColor: '#1e293b',
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#475569'
  },
  closeBtnText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: 'bold'
  },
  showNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111c2e',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#1e2e45',
    marginBottom: 8
  },
  showLabel: {
    color: '#94a3b8',
    fontSize: 8,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginRight: 6
  },
  showInput: {
    flex: 1,
    color: '#facc15',
    fontSize: 10,
    fontWeight: 'bold',
    padding: 0
  },
  actionRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#162338',
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    borderWidth: 1,
    borderColor: '#223652'
  },
  th: {
    color: '#94a3b8',
    fontSize: 7.5,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  tableScroll: {
    maxHeight: 280,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#223652',
    backgroundColor: '#0a0f1a'
  },
  emptyText: {
    color: '#64748b',
    fontSize: 9,
    textAlign: 'center',
    paddingVertical: 16
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#16202e'
  },
  chNum: {
    width: 30,
    color: '#38bdf8',
    fontSize: 9,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  roleInput: {
    flex: 1.5,
    color: '#e2e8f0',
    fontSize: 9,
    backgroundColor: '#111827',
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#1f2937',
    marginRight: 4
  },
  typePill: {
    width: 45,
    paddingVertical: 1,
    borderRadius: 2,
    alignItems: 'center',
    marginRight: 4
  },
  typePillDup: {
    backgroundColor: '#1e3a5f'
  },
  typePillSimp: {
    backgroundColor: '#7c2d12'
  },
  typePillText: {
    color: '#f8fafc',
    fontSize: 7,
    fontWeight: '900'
  },
  freqCell: {
    flex: 1.2,
    color: '#facc15',
    fontSize: 8.5,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: 'bold'
  },
  toneInput: {
    width: 55,
    color: '#34d399',
    fontSize: 8.5,
    textAlign: 'center',
    backgroundColor: '#111827',
    paddingVertical: 2,
    paddingHorizontal: 2,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#1f2937',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  doneBtn: {
    backgroundColor: '#1e293b',
    paddingVertical: 8,
    borderRadius: 4,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#475569'
  },
  doneBtnText: {
    color: '#cbd5e1',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.5
  }
});





interface SourceCodeExportModalProps {
  visible: boolean;
  onClose: () => void;
}

interface FileItem {
  name: string;
  path: string;
  description: string;
  downloadPath: string;
  rawPath: string;
  badge: string;
}

export const SourceCodeExportModal: React.FC<SourceCodeExportModalProps> = ({
  visible,
  onClose,
}) => {
  const [copiedFile, setCopiedFile] = useState<string | null>(null);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);

  const files: FileItem[] = [
    {
      name: 'index.tsx',
      path: 'app/index.tsx',
      description: '100% pure React Native all-in-one file with 5-decimal place Talkback IMD Compatibility Inspector (400-470MHz). Works out of the box in Expo without any errors.',
      downloadPath: '/download/index.tsx',
      rawPath: '/raw/index.tsx',
      badge: 'ALL-IN-ONE (RECOMMENDED)',
    },
    {
      name: 'index.txt',
      path: 'app/index.tsx (Plain text format)',
      description: 'Complete all-in-one index.tsx in plain .txt format (~354 KB) for 100% safe copy-pasting into VS Code.',
      downloadPath: '/download/index.txt',
      rawPath: '/download/index.txt',
      badge: 'PLAIN TEXT COPY',
    },
    {
      name: 'expo-rf-coordinator.zip',
      path: 'Project Archive (Zip Folder)',
      description: 'Complete VS Code project folder in a single ZIP containing app/, package.json, app.json, and tsconfig.',
      downloadPath: '/download/expo-project.zip',
      rawPath: '/download/expo-project.zip',
      badge: 'COMPLETE ZIP',
    },
    {
      name: 'rfMath.ts',
      path: 'app/utils/rfMath.ts',
      description: 'Optional modular IMD calculation engine (also pre-inlined inside index.tsx)',
      downloadPath: '/download/rfMath.ts',
      rawPath: '/raw/rfMath.ts',
      badge: 'OPTIONAL UTILS',
    },
    {
      name: 'TacticalSpectrumAnalyzer.tsx',
      path: 'app/components/TacticalSpectrumAnalyzer.tsx',
      description: 'Instrument-grade spectrum analyzer with graticule, peak search & delta marker',
      downloadPath: '/download/TacticalSpectrumAnalyzer.tsx',
      rawPath: '/raw/TacticalSpectrumAnalyzer.tsx',
      badge: 'RF ANALYZER',
    },
    {
      name: 'PttSimulator.tsx',
      path: 'app/components/PttSimulator.tsx',
      description: 'Real-time PTT key-up simulator & multi-transmitter IMD stress tester',
      downloadPath: '/download/PttSimulator.tsx',
      rawPath: '/raw/PttSimulator.tsx',
      badge: 'PTT SIMULATOR',
    },
    {
      name: 'CrewCallSheetModal.tsx',
      path: 'app/components/CrewCallSheetModal.tsx',
      description: 'Production crew channel assignments, CTCSS tones, and CSV export modal',
      downloadPath: '/download/CrewCallSheetModal.tsx',
      rawPath: '/raw/CrewCallSheetModal.tsx',
      badge: 'CALL SHEET',
    },
  ];

  const handleDownload = async (file: FileItem) => {
    setDownloadingFile(file.name);
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const res = await fetch(file.downloadPath);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        // Native / Fallback
        const origin = typeof window !== 'undefined' && window.location ? window.location.origin : '';
        await Share.share({
          message: `Download ${file.name} from: ${origin}${file.downloadPath}`,
          url: `${origin}${file.downloadPath}`,
        });
      }
    } catch (e) {
      console.error('Download error:', e);
      if (typeof window !== 'undefined') {
        window.open(file.downloadPath, '_blank');
      }
    } finally {
      setTimeout(() => setDownloadingFile(null), 800);
    }
  };

  const handleCopyCode = async (file: FileItem) => {
    try {
      const res = await fetch(file.rawPath);
      const text = await res.text();
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setCopiedFile(file.name);
        setTimeout(() => setCopiedFile(null), 2500);
      } else {
        await Share.share({
          message: text,
          title: file.name,
        });
        setCopiedFile(file.name);
        setTimeout(() => setCopiedFile(null), 2500);
      }
    } catch (e) {
      console.error('Copy error:', e);
      if (typeof window !== 'undefined') {
        window.open(file.rawPath, '_blank');
      }
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={sourceExportStyles.modalBackdrop}>
        <View style={sourceExportStyles.modalCard}>
          {/* Header */}
          <View style={sourceExportStyles.headerRow}>
            <View>
              <Text style={sourceExportStyles.modalTitle}>PROJECT SOURCE FILES (VS CODE)</Text>
              <Text style={sourceExportStyles.modalSubtitle}>
                Download or copy clean source files directly into your local project
              </Text>
            </View>
            <TouchableOpacity style={sourceExportStyles.closeBtn} onPress={onClose}>
              <Text style={sourceExportStyles.closeBtnText}>x CLOSE</Text>
            </TouchableOpacity>
          </View>

          {/* Guide Banner */}
          <View style={sourceExportStyles.guideBanner}>
            <Text style={sourceExportStyles.guideBannerTitle}> LOCAL DIRECTORY STRUCTURE:</Text>
            <Text style={sourceExportStyles.guideBannerCode}>
              your-project/
              {'\n'} +-- app/
              {'\n'} |    +-- index.tsx
              {'\n'} |    +-- utils/rfMath.ts
              {'\n'} |    +-- components/
              {'\n'} |         +-- TacticalSpectrumAnalyzer.tsx
              {'\n'} |         +-- PttSimulator.tsx
              {'\n'} |         +-- CrewCallSheetModal.tsx
            </Text>
          </View>

          <ScrollView style={sourceExportStyles.scrollArea} showsVerticalScrollIndicator>
            {files.map((f, idx) => {
              const isCopied = copiedFile === f.name;
              const isDownloading = downloadingFile === f.name;

              return (
                <View key={idx} style={sourceExportStyles.fileCard}>
                  <View style={sourceExportStyles.fileCardHeader}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={sourceExportStyles.fileName}>{f.name}</Text>
                        <View style={sourceExportStyles.badgePill}>
                          <Text style={sourceExportStyles.badgeText}>{f.badge}</Text>
                        </View>
                      </View>
                      <Text style={sourceExportStyles.filePath}>{f.path}</Text>
                    </View>
                  </View>

                  <Text style={sourceExportStyles.fileDesc}>{f.description}</Text>

                  <View style={sourceExportStyles.btnRow}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={[sourceExportStyles.actionBtn, sourceExportStyles.downloadBtn]}
                      onPress={() => handleDownload(f)}
                    >
                      <Text style={sourceExportStyles.downloadBtnText}>
                        {isDownloading ? '[..] DOWNLOADING...' : `v DOWNLOAD ${f.name}`}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={[sourceExportStyles.actionBtn, isCopied ? sourceExportStyles.copyBtnSuccess : sourceExportStyles.copyBtn]}
                      onPress={() => handleCopyCode(f)}
                    >
                      <Text style={[sourceExportStyles.copyBtnText, isCopied && { color: '#4ade80' }]}>
                        {isCopied ? 'OK COPIED CODE!' : ' COPY CODE'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {/* Footer */}
          <View style={sourceExportStyles.footerRow}>
            <TouchableOpacity style={sourceExportStyles.footerCloseBtn} onPress={onClose}>
              <Text style={sourceExportStyles.footerCloseBtnText}>DONE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const sourceExportStyles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(3, 7, 18, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  modalCard: {
    width: '100%',
    maxWidth: 720,
    maxHeight: '90%',
    backgroundColor: '#0b1320',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    paddingBottom: 10,
    marginBottom: 10,
  },
  modalTitle: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  modalSubtitle: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  closeBtn: {
    backgroundColor: '#1e293b',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  closeBtnText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: 'bold',
  },
  guideBanner: {
    backgroundColor: '#082f49',
    borderColor: '#0284c7',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  guideBannerTitle: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '900',
    marginBottom: 4,
  },
  guideBannerCode: {
    color: '#bae6fd',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    lineHeight: 14,
  },
  scrollArea: {
    flexGrow: 1,
  },
  fileCard: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 12,
    marginBottom: 10,
  },
  fileCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  fileName: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  badgePill: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  badgeText: {
    color: '#38bdf8',
    fontSize: 8,
    fontWeight: '900',
  },
  filePath: {
    color: '#64748b',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 2,
  },
  fileDesc: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 6,
    marginBottom: 10,
    lineHeight: 15,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadBtn: {
    backgroundColor: '#0284c7',
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  downloadBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  copyBtn: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  copyBtnSuccess: {
    backgroundColor: '#064e3b',
    borderWidth: 1,
    borderColor: '#10b981',
  },
  copyBtnText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: 'bold',
  },
  footerRow: {
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingTop: 10,
    marginTop: 6,
    alignItems: 'flex-end',
  },
  footerCloseBtn: {
    backgroundColor: '#1e293b',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 6,
  },
  footerCloseBtnText: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: 'bold',
  },
});


// ================= TYPES & UK OFCOM TALKBACK ALLOCATIONS (SELF-CONTAINED) =================
export interface SimplexPreset {
  id: string;
  name: string;
  category: 'UK_OFCOM' | 'BESPOKE';
  description: string;
  min: string;
  max: string;
  bw: string;
  count: string;
  discreteBand?: 455 | 457 | 468 | 467;
  simplexType?: 'base_tx' | 'walkie';
  frequencies?: number[];
}

const UK_SIMPLEX_PRESETS: SimplexPreset[] = [
  {
    id: 'uk_dedicated_ifb_457',
    name: 'UK Dedicated 457 MHz Base TX / IFB (18 Frequencies)',
    category: 'UK_OFCOM',
    description: 'Continuous studio presenter & director IFB cue transmitters drawn directly from 457 MHz dedicated channels.',
    min: '457.25625',
    max: '457.46875',
    bw: '12.5',
    count: '3',
    discreteBand: 457,
    simplexType: 'base_tx',
    frequencies: DISCRETE_TALKBACK_PAIRS[457].map(p => p.tx)
  },
  {
    id: 'uk_dedicated_ifb_455',
    name: 'UK Dedicated 455 MHz Base TX / IFB (13 Frequencies)',
    category: 'UK_OFCOM',
    description: 'Continuous studio presenter & director IFB cue transmitters drawn directly from 455 MHz dedicated channels.',
    min: '455.00625',
    max: '455.41875',
    bw: '12.5',
    count: '3',
    discreteBand: 455,
    simplexType: 'base_tx',
    frequencies: DISCRETE_TALKBACK_PAIRS[455].map(p => p.tx)
  },
  {
    id: 'uk_dedicated_wt_467',
    name: 'UK Dedicated 467 MHz Walkie / PTT (18 Frequencies)',
    category: 'UK_OFCOM',
    description: 'Portable handheld walkie-talkie press-to-talk channels drawn directly from 467 MHz portable talkback list.',
    min: '467.29375',
    max: '467.53125',
    bw: '12.5',
    count: '3',
    discreteBand: 467,
    simplexType: 'walkie',
    frequencies: DISCRETE_TALKBACK_PAIRS[457].map(p => p.rx)
  },
  {
    id: 'uk_dedicated_wt_468',
    name: 'UK Dedicated 468 MHz Walkie / PTT (13 Frequencies)',
    category: 'UK_OFCOM',
    description: 'Portable handheld walkie-talkie press-to-talk channels drawn directly from 468 MHz portable talkback list.',
    min: '468.01875',
    max: '468.50625',
    bw: '12.5',
    count: '3',
    discreteBand: 468,
    simplexType: 'walkie',
    frequencies: DISCRETE_TALKBACK_PAIRS[455].map(p => p.rx)
  }
];

const CANVAS_HEIGHT = 220;
const BASELINE_Y = CANVAS_HEIGHT - 25;

const Screw = ({ top, bottom, left, right }: { top?: number; bottom?: number; left?: number; right?: number }) => (
  <View style={[styles.screw, { top, bottom, left, right }]}><View style={styles.screwSlot} /></View>
);

export default function App() {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isLandscape = windowWidth > windowHeight;
  const [canvasWidth, setCanvasWidth] = useState(300); 

  // ================= MULTI-ZONE STATE WITH USER-DEFINED PORTABLE TX RANGE & SPLIT =================
  const [zones, setZones] = useState([
    {
      id: 'z1',
      name: 'ZONE 1',
      duplexBands: [
        { 
          id: 'dup_z1_1', 
          label: '457/467', 
          txMin: '457.25625', 
          txMax: '457.46875', 
          rxMin: '467.29375',
          rxMax: '467.53125',
          split: '+10.050',
          pairCount: '0', 
          bw: '12.5',
          discreteBand: 457
        }
      ],
      enableBaseSimplex: false,
      baseSimplexBands: [
        { id: 'ifb_z1_1', label: 'Base TX', min: '455.00625', max: '455.41875', count: '0', bw: '12.5', discreteBand: 455 }
      ],
      enableWalkieSimplex: false,
      walkieSimplexBands: [
        { id: 'wt_z1_1', label: 'Walkie', min: '467.29375', max: '467.53125', count: '0', bw: '12.5', discreteBand: 467 }
      ]
    }
  ]);

  const [activeZoneId, setActiveZoneId] = useState('z1');
  const [zoneDistances, setZoneDistances] = useState({});
  const [zoneOverrides, setZoneOverrides] = useState({});

  // 2D Spatial Map positions (Coordinates in meters: x: 0..arenaWidth, y: 0..arenaLength)
  const [arenaWidth, setArenaWidth] = useState<number>(60);
  const [arenaLength, setArenaLength] = useState<number>(60);
  const [arenaWidthInput, setArenaWidthInput] = useState<string>('60');
  const [arenaLengthInput, setArenaLengthInput] = useState<string>('60');

  const [zonePositions, setZonePositions] = useState<Record<string, { x: number; y: number }>>({
    z1: { x: 30, y: 30 }
  });
  const [draggingZoneId, setDraggingZoneId] = useState<string | null>(null);
  const [stageCanvasWidth, setStageCanvasWidth] = useState(320);

  // 2D Spatial Map Zoom & Pan Viewport state (wide zoom range from 0.05 to 8.0)
  const [spatialZoom, setSpatialZoom] = useState<number>(0.85); // 0.85 = 85% gives a spacious full arena view
  const [spatialPanOffset, setSpatialPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showRadiusBubbles, setShowRadiusBubbles] = useState<boolean>(true);
  const [showCouplingLines, setShowCouplingLines] = useState<boolean>(true);

  // Regulatory Region Mode (GB UK vs EU Europe) & Duplex Direction for Zone Config
  const [regulatoryRegion, setRegulatoryRegion] = useState<'GB_UK' | 'EU_EUROPE'>('GB_UK');
  const [duplexDirection, setDuplexDirection] = useState<'BASE_LOW' | 'BASE_HIGH'>('BASE_LOW');

  // View state: 'COORDINATOR' | 'IMD_PLAYGROUND' | 'SPECTRUM_ANALYZER' | 'MATRIX' | 'MAP' | 'PTT_SIM'
  const [topPanelMode, setTopPanelMode] = useState<'COORDINATOR' | 'IMD_PLAYGROUND' | 'SPECTRUM_ANALYZER' | 'MATRIX' | 'MAP' | 'PTT_SIM'>('COORDINATOR');

  // IMD Inspector Frequency Pool (synchronized with pinned Tactical Spectrum Analyzer)
  const [imdInspectorFreqs, setImdInspectorFreqs] = useState<number[]>([]);

  // PTT Simulation & Call Sheet State
  const [keyedChannels, setKeyedChannels] = useState<Record<number, boolean>>({});
  const [isStressTesting, setIsStressTesting] = useState<boolean>(false);
  const [callSheetModalVisible, setCallSheetModalVisible] = useState<boolean>(false);
  const [sourceCodeModalVisible, setSourceCodeModalVisible] = useState<boolean>(false);
  const [channelRoles, setChannelRoles] = useState<Record<number, string>>({});
  const [channelTones, setChannelTones] = useState<Record<number, string>>({});

  // Zone Config Keypad Target State (Embedded Keypad)
  const [zoneKeypadTarget, setZoneKeypadTarget] = useState<string | null>(null);
  // Persistent toggle switch: DUPLEX (left) vs SIMPLEX (right)
  const [zoneBandViewMode, setZoneBandViewMode] = useState<'DUPLEX' | 'SIMPLEX'>('DUPLEX');

  // Sanitize any existing in-memory band labels to ensure "MHz" is stripped, custom says "Custom", and default is concise "457/467"
  useEffect(() => {
    setZones(prev => prev.map(z => ({
      ...z,
      duplexBands: (z.duplexBands || []).map(b => {
        let l = b.label || '';
        if (l.includes('457') && l.includes('467')) l = '457/467';
        else if (l.includes('455') && l.includes('468')) l = '455/468';
        else if (l.toLowerCase().includes('custom')) l = 'Custom';
        else l = l.replace(/\s*MHz.*$/i, '').replace(/^UK Dedicated\s*/i, '').trim();
        return { ...b, label: l || (b.discreteBand ? '457/467' : 'Custom') };
      })
    })));
  }, []);

  // ================= PRESETS STATE =================
  const [presetModalVisible, setPresetModalVisible] = useState(false);
  const [presetTarget, setPresetTarget] = useState(null); 
  // presetTarget: { type: 'duplex' | 'base_tx' | 'walkie', bandId?: string, zoneId: string }
  const [presetTab, setPresetTab] = useState('UK_OFCOM'); // 'UK_OFCOM' | 'BESPOKE'
  const [bespokeDuplexPresets, setBespokeDuplexPresets] = useState([]);
  const [bespokeSimplexPresets, setBespokeSimplexPresets] = useState([]);
  const [newBespokeName, setNewBespokeName] = useState('');

  // ================= AUDITOR & LEDGER STATE =================
  const [generatedPlan, setGeneratedPlan] = useState([]);
  const [centerFreqStr, setCenterFreqStr] = useState('456.50000');
  const [span, setSpan] = useState(18.0); 
  const [nudgeStepStr, setNudgeStepStr] = useState('25'); 
  const [ledgerView, setLedgerView] = useState('PLAN'); // 'PLAN' | 'PROFILES'
  const [ledgerZoneFilter, setLedgerZoneFilter] = useState('ACTIVE'); // 'ACTIVE' | 'ALL' | specific zoneId

  const [savedProfiles, setSavedProfiles] = useState([]);
  const [profileName, setProfileName] = useState('');
  const [statusMessage, setStatusMessage] = useState({ text: '', type: 'info' });

  const centerFreq = parseFloat(centerFreqStr) || 450.000;
  const nudgeStep = (parseFloat(nudgeStepStr) || 25) / 1000; 

  const activeZone = useMemo(() => {
    return zones.find(z => z.id === activeZoneId) || zones[0];
  }, [zones, activeZoneId]);

  const showToast = (text, type = 'info') => {
    setStatusMessage({ text, type });
    setTimeout(() => {
      setStatusMessage({ text: '', type: 'info' });
    }, 4000);
  };

  const [, setAppUkExclState] = useState<boolean>(getUkExclusionsEnabled());

  useEffect(() => {
    loadProfileList();
    loadBespokePresets();
    return subscribeUkExclusions((enabled) => {
      setAppUkExclState(enabled);
    });
  }, []);

  // --- STORAGE: BESPOKE PRESETS ---
  const loadBespokePresets = async () => {
    try {
      const rawDup = await AsyncStorage.getItem('rf_bespoke_duplex_presets');
      if (rawDup) setBespokeDuplexPresets(JSON.parse(rawDup));
      const rawSimp = await AsyncStorage.getItem('rf_bespoke_simplex_presets');
      if (rawSimp) setBespokeSimplexPresets(JSON.parse(rawSimp));
    } catch (err) {
      console.warn('Could not load bespoke presets', err);
    }
  };

  const saveCurrentAsBespokePreset = async () => {
    const trimmed = (newBespokeName || '').trim();
    if (!trimmed) {
      Alert.alert('Missing Name', 'Please enter a name for your custom bespoke preset.');
      return;
    }

    if (!presetTarget) return;

    if (presetTarget.type === 'duplex') {
      const currentBand = activeZone.duplexBands.find(b => b.id === presetTarget.bandId) || activeZone.duplexBands[0];
      const newPreset = {
        id: `bespoke_dup_${Date.now()}`,
        name: trimmed,
        category: 'BESPOKE',
        description: `Custom Split (${currentBand.split || '10'} MHz), Base: ${currentBand.txMin}-${currentBand.txMax} MHz, Port: ${currentBand.rxMin}-${currentBand.rxMax} MHz`,
        txMin: currentBand.txMin,
        txMax: currentBand.txMax,
        rxMin: currentBand.rxMin,
        rxMax: currentBand.rxMax,
        split: currentBand.split || '+10.0',
        bw: currentBand.bw || '12.5',
        pairCount: currentBand.pairCount || '0'
      };
      const updated = [newPreset, ...bespokeDuplexPresets];
      setBespokeDuplexPresets(updated);
      await AsyncStorage.setItem('rf_bespoke_duplex_presets', JSON.stringify(updated));
      setNewBespokeName('');
      setPresetTab('BESPOKE');
      showToast(`Saved bespoke preset "${trimmed}"!`, 'success');
    } else {
      const isBase = presetTarget.type === 'base_tx';
      const bandsList = isBase ? activeZone.baseSimplexBands : activeZone.walkieSimplexBands;
      const currentBand = bandsList.find(b => b.id === presetTarget.bandId) || bandsList[0];
      const newPreset = {
        id: `bespoke_simp_${Date.now()}`,
        name: trimmed,
        category: 'BESPOKE',
        description: `Custom Simplex: ${currentBand.min}-${currentBand.max} MHz (${currentBand.bw || '12.5'} kHz)`,
        min: currentBand.min,
        max: currentBand.max,
        bw: currentBand.bw || '12.5',
        count: currentBand.count || '0',
        simplexType: isBase ? 'base_tx' : 'walkie'
      };
      const updated = [newPreset, ...bespokeSimplexPresets];
      setBespokeSimplexPresets(updated);
      await AsyncStorage.setItem('rf_bespoke_simplex_presets', JSON.stringify(updated));
      setNewBespokeName('');
      setPresetTab('BESPOKE');
      showToast(`Saved bespoke preset "${trimmed}"!`, 'success');
    }
  };

  const deleteBespokePreset = async (type, presetId) => {
    if (type === 'duplex') {
      const updated = bespokeDuplexPresets.filter(p => p.id !== presetId);
      setBespokeDuplexPresets(updated);
      await AsyncStorage.setItem('rf_bespoke_duplex_presets', JSON.stringify(updated));
      showToast('Deleted bespoke preset.', 'info');
    } else {
      const updated = bespokeSimplexPresets.filter(p => p.id !== presetId);
      setBespokeSimplexPresets(updated);
      await AsyncStorage.setItem('rf_bespoke_simplex_presets', JSON.stringify(updated));
      showToast('Deleted bespoke preset.', 'info');
    }
  };

  const openPresetModal = (type: 'duplex' | 'base_tx' | 'walkie', bandId?: string) => {
    setPresetTarget({ type, bandId, zoneId: activeZoneId });
    setNewBespokeName('');
    setPresetTab('UK_OFCOM');
    setPresetModalVisible(true);
  };

  const applyPreset = (preset) => {
    if (!presetTarget) return;

    if (presetTarget.type === 'duplex') {
      const dup = preset;
      let cleanLabel = '457/467';
      if (dup.name?.includes('457') && dup.name?.includes('467')) {
        cleanLabel = '457/467';
      } else if (dup.name?.includes('455') && dup.name?.includes('468')) {
        cleanLabel = '455/468';
      } else {
        cleanLabel = (dup.name || 'Duplex').replace(/\s*MHz.*$/i, '').replace(/^UK Dedicated\s*/i, '').trim();
      }
      if (presetTarget.bandId) {
        // Update existing band
        const updated = activeZone.duplexBands.map(b => {
          if (b.id !== presetTarget.bandId) return b;
          return {
            ...b,
            label: cleanLabel,
            txMin: dup.txMin,
            txMax: dup.txMax,
            rxMin: dup.rxMin,
            rxMax: dup.rxMax,
            split: dup.split,
            bw: dup.bw,
            pairCount: dup.pairCount,
            discreteBand: dup.discreteBand
          };
        });
        updateActiveZone({ ...activeZone, duplexBands: updated });
      } else {
        // Add as a new band
        const newBand = {
          id: `dup_${activeZone.id}_${Date.now()}`,
          label: cleanLabel,
          txMin: dup.txMin,
          txMax: dup.txMax,
          rxMin: dup.rxMin,
          rxMax: dup.rxMax,
          split: dup.split,
          bw: dup.bw,
          pairCount: dup.pairCount,
          discreteBand: dup.discreteBand
        };
        updateActiveZone({ ...activeZone, duplexBands: [...activeZone.duplexBands, newBand] });
      }
      showToast(`Applied "${cleanLabel}"!`, 'success');
    } else if (presetTarget.type === 'base_tx') {
      const simp = preset;
      let cleanLabel = (simp.name || 'Base TX').replace(/\s*MHz.*$/i, '').replace(/^UK Dedicated\s*/i, '').trim();
      if (cleanLabel.includes('455') || cleanLabel.includes('IFB')) cleanLabel = 'Base TX';
      if (presetTarget.bandId) {
        const updated = activeZone.baseSimplexBands.map(b => {
          if (b.id !== presetTarget.bandId) return b;
          return {
            ...b,
            label: cleanLabel,
            min: simp.min,
            max: simp.max,
            bw: simp.bw,
            count: simp.count,
            discreteBand: simp.discreteBand
          };
        });
        updateActiveZone({ ...activeZone, baseSimplexBands: updated });
      } else {
        const newBand = {
          id: `ifb_${activeZone.id}_${Date.now()}`,
          label: cleanLabel,
          min: simp.min,
          max: simp.max,
          bw: simp.bw,
          count: simp.count,
          discreteBand: simp.discreteBand
        };
        updateActiveZone({ ...activeZone, baseSimplexBands: [...activeZone.baseSimplexBands, newBand] });
      }
      showToast(`Applied "${cleanLabel}"!`, 'success');
    } else if (presetTarget.type === 'walkie') {
      const simp = preset;
      let cleanLabel = (simp.name || 'Walkie').replace(/\s*MHz.*$/i, '').replace(/^UK Dedicated\s*/i, '').trim();
      if (cleanLabel.includes('467') || cleanLabel.includes('WT') || cleanLabel.toLowerCase().includes('walkie')) cleanLabel = 'Walkie';
      else if (cleanLabel.includes('446')) cleanLabel = 'PMR446';
      if (presetTarget.bandId) {
        const updated = activeZone.walkieSimplexBands.map(b => {
          if (b.id !== presetTarget.bandId) return b;
          return {
            ...b,
            label: cleanLabel,
            min: simp.min,
            max: simp.max,
            bw: simp.bw,
            count: simp.count,
            discreteBand: simp.discreteBand
          };
        });
        updateActiveZone({ ...activeZone, walkieSimplexBands: updated });
      } else {
        const newBand = {
          id: `wt_${activeZone.id}_${Date.now()}`,
          label: cleanLabel,
          min: simp.min,
          max: simp.max,
          bw: simp.bw,
          count: simp.count,
          discreteBand: simp.discreteBand
        };
        updateActiveZone({ ...activeZone, walkieSimplexBands: [...activeZone.walkieSimplexBands, newBand] });
      }
      showToast(`Applied "${cleanLabel}"!`, 'success');
    }

    setPresetModalVisible(false);
  };

  // --- INTERACTIVE PRESET FREQUENCY SELECTION & IMD AUDIT ---
  const isDuplexPairSelected = (tx: number, rx: number) => {
    return generatedPlan.some(p => 
      p.zoneId === activeZoneId && 
      !p.isSimplex && 
      Math.abs(p.tx - tx) < 0.00001 && 
      Math.abs(p.rx - rx) < 0.00001
    );
  };

  const isSimplexFreqSelected = (freq: number, type: 'base_tx' | 'walkie') => {
    return generatedPlan.some(p => 
      p.zoneId === activeZoneId && 
      p.isSimplex && 
      p.simplexType === type && 
      Math.abs(p.tx - freq) < 0.00001
    );
  };

  const toggleDuplexPairFrequency = (p: { tx: number; rx: number }, presetName: string) => {
    const txCheck = isFrequencyRestricted(p.tx);
    const rxCheck = isFrequencyRestricted(p.rx);
    if (txCheck.isRestricted || rxCheck.isRestricted) {
      showToast(`⛔ ${txCheck.reason || rxCheck.reason}`, 'error');
      return;
    }

    const existingIndex = generatedPlan.findIndex(item => 
      item.zoneId === activeZoneId && 
      !item.isSimplex && 
      Math.abs(item.tx - p.tx) < 0.00001 && 
      Math.abs(item.rx - p.rx) < 0.00001
    );

    if (existingIndex >= 0) {
      const updated = generatedPlan.filter((_, idx) => idx !== existingIndex);
      setGeneratedPlan(updated);
      showToast(`Removed Pair: TX ${p.tx.toFixed(5)} / RX ${p.rx.toFixed(5)}`, 'info');
      return;
    }

    const cand = {
      zoneId: activeZoneId,
      tx: p.tx,
      rx: p.rx,
      isSimplex: false,
      simplexType: null,
      txIsBase: true,
      rxIsBase: false,
    };

    const isCoupled = (zoneA: string, zoneB: string) => isZoneCoupledStatus(zoneA, zoneB);
    const isCompatible = checkCompatibility(cand, generatedPlan, activeZoneId, isCoupled);

    const newChannel = {
      zoneId: activeZoneId,
      zoneName: activeZone.name,
      bandLabel: presetName,
      tx: p.tx,
      rx: p.rx,
      txStr: p.tx.toFixed(5),
      rxStr: p.rx.toFixed(5),
      locked: true,
      isSimplex: false,
      simplexType: null,
      txIsBase: true,
      rxIsBase: false,
    };

    setGeneratedPlan(prev => [...prev, newChannel]);
    setCenterFreqStr(p.tx.toFixed(5));

    if (isCompatible) {
      showToast(`Added TX ${p.tx.toFixed(5)} / RX ${p.rx.toFixed(5)} -- COMPATIBLE`, 'success');
    } else {
      showToast(`[!] Added TX ${p.tx.toFixed(5)} / RX ${p.rx.toFixed(5)} -- IMD / ADJ CLASH!`, 'error');
    }
  };

  const toggleSimplexFrequency = (freq: number, type: 'base_tx' | 'walkie', presetName: string) => {
    const check = isFrequencyRestricted(freq);
    if (check.isRestricted) {
      showToast(`⛔ ${check.reason}`, 'error');
      return;
    }

    const existingIndex = generatedPlan.findIndex(item => 
      item.zoneId === activeZoneId && 
      item.isSimplex && 
      item.simplexType === type && 
      Math.abs(item.tx - freq) < 0.00001
    );

    if (existingIndex >= 0) {
      const updated = generatedPlan.filter((_, idx) => idx !== existingIndex);
      setGeneratedPlan(updated);
      showToast(`Removed ${type === 'base_tx' ? 'IFB' : 'WT'} ${freq.toFixed(5)} MHz`, 'info');
      return;
    }

    const cand = {
      zoneId: activeZoneId,
      tx: freq,
      rx: 0,
      isSimplex: true,
      simplexType: type,
      txIsBase: type === 'base_tx',
      rxIsBase: false,
    };

    const isCoupled = (zoneA: string, zoneB: string) => isZoneCoupledStatus(zoneA, zoneB);
    const isCompatible = checkCompatibility(cand, generatedPlan, activeZoneId, isCoupled);

    const newChannel = {
      zoneId: activeZoneId,
      zoneName: activeZone.name,
      bandLabel: presetName,
      tx: freq,
      rx: 0,
      txStr: freq.toFixed(5),
      rxStr: '',
      locked: true,
      isSimplex: true,
      simplexType: type,
      txIsBase: type === 'base_tx',
      rxIsBase: false,
    };

    setGeneratedPlan(prev => [...prev, newChannel]);
    setCenterFreqStr(freq.toFixed(5));

    if (isCompatible) {
      showToast(`Added ${type === 'base_tx' ? 'IFB' : 'WT'} ${freq.toFixed(5)} MHz -- COMPATIBLE`, 'success');
    } else {
      showToast(`[!] Added ${type === 'base_tx' ? 'IFB' : 'WT'} ${freq.toFixed(5)} MHz -- IMD / ADJ CLASH!`, 'error');
    }
  };

  // --- ZONE MANAGEMENT ---
  const addZone = () => {
    // Smart Zone Numbering: find highest number in existing zone names and increment +1
    let maxZoneNum = 0;
    zones.forEach(z => {
      const match = (z.name || '').match(/(\d+)/);
      if (match) {
        const n = parseInt(match[1], 10);
        if (!isNaN(n) && n > maxZoneNum) {
          maxZoneNum = n;
        }
      }
    });
    const newNum = maxZoneNum > 0 ? maxZoneNum + 1 : zones.length + 1;
    const newId = `z${Date.now()}`;
    const newZone = {
      id: newId,
      name: `ZONE ${newNum}`,
      duplexBands: [
        { 
          id: `dup_${newId}_1`, 
          label: '457/467', 
          txMin: '457.25625', 
          txMax: '457.46875', 
          rxMin: '467.29375',
          rxMax: '467.53125',
          split: '+10.050',
          pairCount: '0', 
          bw: '12.5',
          discreteBand: 457
        }
      ],
      enableBaseSimplex: false,
      baseSimplexBands: [
        { id: `ifb_${newId}_1`, label: 'Base TX', min: '455.00625', max: '455.41875', count: '0', bw: '12.5', discreteBand: 455 }
      ],
      enableWalkieSimplex: false,
      walkieSimplexBands: [
        { id: `wt_${newId}_1`, label: 'Walkie', min: '467.29375', max: '467.53125', count: '0', bw: '12.5', discreteBand: 467 }
      ]
    };

    const newDists = { ...zoneDistances };
    zones.forEach(existing => {
      newDists[`${existing.id}_${newId}`] = 30;
    });

    // Spread new zone positions across the user-defined arena boundaries
    const defaultRatios = [
      { rx: 0.5, ry: 0.25 }, // Center North
      { rx: 0.2, ry: 0.75 }, // South-West
      { rx: 0.8, ry: 0.75 }, // South-East
      { rx: 0.5, ry: 0.85 }, // South
      { rx: 0.15, ry: 0.3 }, // North-West
      { rx: 0.85, ry: 0.3 }, // North-East
    ];
    const nextRatio = defaultRatios[(newNum - 1) % defaultRatios.length];
    const nextPos = {
      x: Math.round(arenaWidth * nextRatio.rx),
      y: Math.round(arenaLength * nextRatio.ry)
    };
    setZonePositions(prev => ({ ...prev, [newId]: nextPos }));

    setZones([...zones, newZone]);
    setZoneDistances(newDists);
    setActiveZoneId(newId);
  };

  const removeZone = (zoneId) => {
    if (zones.length <= 1) {
      showToast('At least one zone must remain.', 'error');
      return;
    }
    const remaining = zones.filter(z => z.id !== zoneId);
    setZones(remaining);
    setActiveZoneId(remaining[0].id);
    setZonePositions(prev => {
      const copy = { ...prev };
      delete copy[zoneId];
      return copy;
    });
  };

  const updateActiveZone = (updatedZone) => {
    setZones(zones.map(z => z.id === updatedZone.id ? updatedZone : z));
  };

  // --- DUPLEX BANDS FOR ACTIVE ZONE (BASE TX & PORTABLE TX SPLIT) ---
  const addDuplexBand = () => {
    const existing = activeZone.duplexBands || [];
    const has457 = existing.some(b => b.discreteBand === 457 || (parseFloat(b.txMin) >= 457.0 && parseFloat(b.txMax) <= 457.6));
    const has455 = existing.some(b => b.discreteBand === 455 || (parseFloat(b.txMin) >= 454.9 && parseFloat(b.txMax) <= 455.5));

    let newBand;
    if (!has457) {
      // 1st: 457 / 467 MHz Dedicated
      newBand = { 
        id: `dup_${activeZone.id}_${Date.now()}`, 
        label: '457/467', 
        txMin: '457.25625', 
        txMax: '457.46875', 
        rxMin: '467.29375',
        rxMax: '467.53125',
        split: '+10.050',
        pairCount: '0', 
        bw: '12.5',
        discreteBand: 457
      };
    } else if (!has455) {
      // 2nd: 455 / 468 MHz Dedicated
      newBand = {
        id: `dup_${activeZone.id}_${Date.now()}`, 
        label: '455/468', 
        txMin: '455.00625', 
        txMax: '455.41875', 
        rxMin: '468.01875',
        rxMax: '468.50625',
        split: '+13.350',
        pairCount: '0', 
        bw: '12.5',
        discreteBand: 455
      };
    } else {
      // 3rd & Subsequent: Custom User-Defined Band
      let maxCustom = 0;
      existing.forEach(b => {
        const match = (b.label || '').match(/(\d+)/);
        if (match) {
          const n = parseInt(match[1], 10);
          if (!isNaN(n) && n > maxCustom) maxCustom = n;
        }
      });
      const customNum = maxCustom > 0 ? maxCustom + 1 : existing.filter(b => b.discreteBand !== 455 && b.discreteBand !== 457).length + 1;
      newBand = {
        id: `dup_${activeZone.id}_${Date.now()}`, 
        label: 'Custom', 
        txMin: '400.00000', 
        txMax: '463.00000', 
        rxMin: '460.00625',
        rxMax: '469.89375',
        split: '+10.000',
        pairCount: '0', 
        bw: '12.5',
        discreteBand: null
      };
    }

    updateActiveZone({ ...activeZone, duplexBands: [...existing, newBand] });
  };

  const removeDuplexBand = (bandId) => {
    if (activeZone.duplexBands.length <= 1) {
      showToast('At least one Duplex band must remain in this zone.', 'error');
      return;
    }
    updateActiveZone({ ...activeZone, duplexBands: activeZone.duplexBands.filter(b => b.id !== bandId) });
  };

  const updateDuplexBand = (bandId, field, val) => {
    const updated = activeZone.duplexBands.map(b => {
      if (b.id !== bandId) return b;
      const copy = { ...b, [field]: val };

      // Auto-recalculate split if user updates rxMin directly
      if (field === 'rxMin' && !isNaN(parseFloat(val)) && !isNaN(parseFloat(copy.txMin))) {
        const diff = parseFloat(val) - parseFloat(copy.txMin);
        copy.split = (diff >= 0 ? `+${diff.toFixed(3)}` : `${diff.toFixed(3)}`).replace('+-', '-');
      }

      // Auto-recalculate rxMin and rxMax if user updates split directly
      if (field === 'split' && !isNaN(parseFloat(val))) {
        const offset = parseFloat(val);
        const tMin = parseFloat(copy.txMin) || 450.0;
        const tMax = parseFloat(copy.txMax) || 455.0;
        copy.rxMin = (tMin + offset).toFixed(5);
        copy.rxMax = (tMax + offset).toFixed(5);
      }

      return copy;
    });
    updateActiveZone({ ...activeZone, duplexBands: updated });
  };

  // --- BASE TX / SIMPLEX BANDS FOR ACTIVE ZONE ---
  const addBaseSimplexBand = () => {
    const updated = [
      ...(activeZone.baseSimplexBands || []),
      { id: `ifb_${activeZone.id}_${Date.now()}`, label: 'Base TX', min: '455.00000', max: '456.00000', count: '0', bw: '12.5' }
    ];
    updateActiveZone({ ...activeZone, baseSimplexBands: updated });
  };

  const removeBaseSimplexBand = (bandId) => {
    if (activeZone.baseSimplexBands.length <= 1) return;
    updateActiveZone({ ...activeZone, baseSimplexBands: activeZone.baseSimplexBands.filter(b => b.id !== bandId) });
  };

  const updateBaseSimplexBand = (bandId, field, val) => {
    const updated = activeZone.baseSimplexBands.map(b => b.id === bandId ? { ...b, [field]: val } : b);
    updateActiveZone({ ...activeZone, baseSimplexBands: updated });
  };

  // --- WALKIE BANDS FOR ACTIVE ZONE ---
  const addWalkieSimplexBand = () => {
    const updated = [
      ...(activeZone.walkieSimplexBands || []),
      { id: `wt_${activeZone.id}_${Date.now()}`, label: 'Walkie', min: '446.00625', max: '446.19375', count: '0', bw: '12.5' }
    ];
    updateActiveZone({ ...activeZone, walkieSimplexBands: updated });
  };

  const removeWalkieSimplexBand = (bandId) => {
    if (activeZone.walkieSimplexBands.length <= 1) return;
    updateActiveZone({ ...activeZone, walkieSimplexBands: activeZone.walkieSimplexBands.filter(b => b.id !== bandId) });
  };

  const updateWalkieSimplexBand = (bandId, field, val) => {
    const updated = activeZone.walkieSimplexBands.map(b => b.id === bandId ? { ...b, [field]: val } : b);
    updateActiveZone({ ...activeZone, walkieSimplexBands: updated });
  };

  // --- ZONE CONFIG EMBEDDED KEYPAD DISPATCHER ---
  const parseZoneTarget = (target: string | null) => {
    if (!target) return null;
    const parts = target.split('::');
    if (parts.length === 2 && parts[0] === 'tactical') {
      return { type: 'tactical', field: parts[1], bandId: '' };
    }
    if (parts.length === 3 && parts[0] === 'ch') {
      return { type: 'ch', bandId: parts[1], field: parts[2] };
    }
    if (parts.length === 3) {
      return { type: parts[0] as 'dup' | 'ifb' | 'wt', bandId: parts[1], field: parts[2] };
    }
    return null;
  };

  const getZoneTargetLabel = (target: string | null): string => {
    const parsed = parseZoneTarget(target);
    if (!parsed) return 'Tap a field';
    if (parsed.type === 'tactical') {
      switch (parsed.field) {
        case 'center_freq': return 'Center Freq';
        case 'center_step': return 'Center Step';
        case 'span': return 'Span Zoom';
        case 'span_step': return 'Span Step';
        default: return 'Tactical Field';
      }
    }
    if (parsed.type === 'ch') {
      const chIdx = parseInt(parsed.bandId, 10);
      const fieldLabel = parsed.field === 'txStr' ? 'Base TX' : 'Port TX';
      return `Ch ${chIdx + 1} ${fieldLabel}`;
    }
    if (parsed.type === 'dup') {
      switch (parsed.field) {
        case 'txMin': return 'Base TX Min';
        case 'txMax': return 'Base TX Max';
        case 'bw': return 'Duplex BW';
        case 'rxMin': return 'Port TX Min';
        case 'rxMax': return 'Port TX Max';
        case 'split': return 'Duplex Split';
        case 'pairCount': return 'Pair Count';
        default: return 'Duplex Field';
      }
    }
    if (parsed.type === 'ifb') {
      switch (parsed.field) {
        case 'min': return 'Base Min';
        case 'max': return 'Base Max';
        case 'count': return 'Base Count';
        case 'bw': return 'Base BW';
        default: return 'Base Field';
      }
    }
    if (parsed.type === 'wt') {
      switch (parsed.field) {
        case 'min': return 'Walkie Min';
        case 'max': return 'Walkie Max';
        case 'count': return 'Walkie Count';
        case 'bw': return 'Walkie BW';
        default: return 'Walkie Field';
      }
    }
    return 'Active Field';
  };

  const getZoneTargetCurrentVal = (target: string | null): string => {
    const parsed = parseZoneTarget(target);
    if (!parsed) return '';
    if (parsed.type === 'tactical') {
      if (parsed.field === 'center_freq') return tacticalAnalyzerState.centerText;
      if (parsed.field === 'center_step') return tacticalAnalyzerState.centerStepText;
      if (parsed.field === 'span') return tacticalAnalyzerState.spanText;
      if (parsed.field === 'span_step') return tacticalAnalyzerState.spanStepText;
    }
    if (parsed.type === 'ch') {
      const chIdx = parseInt(parsed.bandId, 10);
      const item = generatedPlan[chIdx];
      if (!item) return '';
      return parsed.field === 'txStr' ? item.txStr : item.rxStr;
    }
    if (parsed.type === 'dup') {
      const band = (activeZone.duplexBands || []).find(b => b.id === parsed.bandId);
      return band ? String((band as any)[parsed.field] ?? '') : '';
    }
    if (parsed.type === 'ifb') {
      const band = (activeZone.baseSimplexBands || []).find(b => b.id === parsed.bandId);
      return band ? String((band as any)[parsed.field] ?? '') : '';
    }
    if (parsed.type === 'wt') {
      const band = (activeZone.walkieSimplexBands || []).find(b => b.id === parsed.bandId);
      return band ? String((band as any)[parsed.field] ?? '') : '';
    }
    return '';
  };

  const getZoneTargetUnit = (target: string | null): string => {
    const parsed = parseZoneTarget(target);
    if (!parsed) return 'MHz';
    if (parsed.type === 'tactical') {
      return 'MHz';
    }
    if (parsed.type === 'ch') {
      return 'MHz';
    }
    if (parsed.type === 'dup') {
      if (parsed.field === 'pairCount') return 'PAIRS';
      if (parsed.field === 'bw') return 'kHz';
      return 'MHz';
    }
    if (parsed.type === 'ifb' || parsed.type === 'wt') {
      if (parsed.field === 'count') return 'QTY';
      if (parsed.field === 'bw') return 'kHz';
      return 'MHz';
    }
    return 'MHz';
  };

  const getZoneTargetColor = (target: string | null): string => {
    const parsed = parseZoneTarget(target);
    if (!parsed) return '#38bdf8';
    if (parsed.type === 'tactical') {
      if (parsed.field === 'center_freq' || parsed.field === 'span') return '#38bdf8';
      return '#38bdf8';
    }
    if (parsed.type === 'dup') {
      if (parsed.field === 'txMin' || parsed.field === 'txMax') return '#38bdf8';
      if (parsed.field === 'rxMin' || parsed.field === 'rxMax') return '#34d399';
      if (parsed.field === 'split') return '#c084fc';
      if (parsed.field === 'bw') return '#fb923c';
      if (parsed.field === 'pairCount') return '#facc15';
    }
    if (parsed.type === 'ifb') {
      if (parsed.field === 'bw') return '#fb923c';
      if (parsed.field === 'count') return '#facc15';
      return '#34d399';
    }
    if (parsed.type === 'wt') {
      if (parsed.field === 'bw') return '#fb923c';
      if (parsed.field === 'count') return '#facc15';
      return '#a78bfa';
    }
    if (parsed.type === 'ch') {
      return parsed.field === 'txStr' ? '#38bdf8' : '#34d399';
    }
    return '#38bdf8';
  };

  const updateZoneTargetVal = (target: string | null, newVal: string) => {
    let resolvedTarget = target;
    if (!resolvedTarget) {
      resolvedTarget = 'tactical::center_freq';
      setZoneKeypadTarget(resolvedTarget);
    }
    const parsed = parseZoneTarget(resolvedTarget);
    if (!parsed) return;

    if (parsed.type === 'tactical') {
      if (parsed.field === 'center_freq') {
        tacticalAnalyzerState.setCenterText(newVal);
        const num = parseFloat(newVal);
        if (!isNaN(num) && num >= 10 && num <= 1500) {
          tacticalAnalyzerState.handleCenterChange(num);
        }
      } else if (parsed.field === 'center_step') {
        tacticalAnalyzerState.setCenterStepText(newVal);
        const num = parseFloat(newVal);
        if (!isNaN(num) && num > 0 && num <= 50) {
          tacticalAnalyzerState.setCenterStep(num);
        }
      } else if (parsed.field === 'span') {
        tacticalAnalyzerState.setSpanText(newVal);
        const num = parseFloat(newVal);
        if (!isNaN(num) && num >= 0.1 && num <= 250) {
          tacticalAnalyzerState.onSpanChange(num);
        }
      } else if (parsed.field === 'span_step') {
        tacticalAnalyzerState.setSpanStepText(newVal);
        const num = parseFloat(newVal);
        if (!isNaN(num) && num > 0 && num <= 100) {
          tacticalAnalyzerState.setSpanStep(num);
        }
      }
      return;
    }
    if (parsed.type === 'ch') {
      const chIdx = parseInt(parsed.bandId, 10);
      updateProp(chIdx, parsed.field, newVal);
      return;
    }
    if (parsed.type === 'dup') {
      updateDuplexBand(parsed.bandId, parsed.field, newVal);
      return;
    }
    if (parsed.type === 'ifb') {
      updateBaseSimplexBand(parsed.bandId, parsed.field, newVal);
      return;
    }
    if (parsed.type === 'wt') {
      updateWalkieSimplexBand(parsed.bandId, parsed.field, newVal);
      return;
    }
  };

  const handleReplicaStep = (dir: -1 | 1) => {
    let target = zoneKeypadTarget;
    if (!target) {
      target = 'tactical::center_freq';
      setZoneKeypadTarget(target);
    }
    const parsed = parseZoneTarget(target);
    if (!parsed) return;
    if (parsed.type === 'tactical') {
      if (parsed.field === 'center_freq') {
        tacticalAnalyzerState.handleCenterStep(dir);
      } else if (parsed.field === 'center_step') {
        tacticalAnalyzerState.handleCenterStepDelta(dir);
      } else if (parsed.field === 'span') {
        tacticalAnalyzerState.handleSpanStep(dir);
      } else if (parsed.field === 'span_step') {
        tacticalAnalyzerState.handleSpanStepDelta(dir);
      }
      return;
    }
    const curStr = getZoneTargetCurrentVal(target);
    const curNum = parseFloat(curStr);
    if (isNaN(curNum)) return;
    let step = 0.0125;
    if (parsed.field === 'pairCount' || parsed.field === 'count') {
      step = 1;
    } else if (parsed.field === 'bw') {
      step = 12.5;
    } else if (parsed.field === 'split') {
      step = 0.025;
    }
    const newNum = Math.max(0, curNum + dir * step);
    let formatted = '';
    if (parsed.field === 'pairCount' || parsed.field === 'count') {
      formatted = Math.round(newNum).toString();
    } else if (parsed.field === 'bw') {
      formatted = newNum.toFixed(1);
    } else if (parsed.field === 'split') {
      formatted = (dir > 0 && newNum > 0 ? `+${newNum.toFixed(3)}` : newNum.toFixed(3));
    } else {
      formatted = newNum.toFixed(5);
    }
    updateZoneTargetVal(target, formatted);
  };

  const handleZoneKeypadPress = (key: string) => {
    let target = zoneKeypadTarget;
    if (!target) {
      if (zoneBandViewMode === 'SIMPLEX') {
        const firstIfb = activeZone.baseSimplexBands?.[0];
        const firstWt = activeZone.walkieSimplexBands?.[0];
        if (activeZone.enableBaseSimplex && firstIfb) {
          target = `ifb::${firstIfb.id}::min`;
          setZoneKeypadTarget(target);
        } else if (activeZone.enableWalkieSimplex && firstWt) {
          target = `wt::${firstWt.id}::min`;
          setZoneKeypadTarget(target);
        } else {
          return;
        }
      } else {
        const firstDup = activeZone.duplexBands?.[0];
        if (firstDup) {
          target = `dup::${firstDup.id}::txMin`;
          setZoneKeypadTarget(target);
        } else {
          return;
        }
      }
    }
    const parsed = parseZoneTarget(target);
    if (!parsed) return;

    const cur = getZoneTargetCurrentVal(target);

    if (key === 'BACKSPACE') {
      updateZoneTargetVal(target, cur.length > 0 ? cur.slice(0, -1) : '');
      return;
    }
    if (key === 'CLEAR') {
      updateZoneTargetVal(target, '');
      return;
    }
    if (key === '.') {
      if (!cur.includes('.')) {
        updateZoneTargetVal(target, cur === '' ? '0.' : cur + '.');
      }
      return;
    }
    if (key === 'ENTER') {
      if (parsed.type === 'tactical') {
        if (parsed.field === 'center_freq') tacticalAnalyzerState.handleCenterInputCommit();
        else if (parsed.field === 'center_step') tacticalAnalyzerState.handleCenterStepCommit();
        else if (parsed.field === 'span') tacticalAnalyzerState.handleSpanInputCommit();
        else if (parsed.field === 'span_step') tacticalAnalyzerState.handleSpanStepCommit();
      }
      // Auto-advance sequence
      if (parsed.type === 'dup') {
        if (parsed.field === 'txMin') setZoneKeypadTarget(`dup::${parsed.bandId}::txMax`);
        else if (parsed.field === 'txMax') setZoneKeypadTarget(`dup::${parsed.bandId}::bw`);
        else if (parsed.field === 'bw') setZoneKeypadTarget(`dup::${parsed.bandId}::rxMin`);
        else if (parsed.field === 'rxMin') setZoneKeypadTarget(`dup::${parsed.bandId}::rxMax`);
        else if (parsed.field === 'rxMax') setZoneKeypadTarget(`dup::${parsed.bandId}::split`);
      } else if (parsed.type === 'ifb') {
        if (parsed.field === 'min') setZoneKeypadTarget(`ifb::${parsed.bandId}::max`);
        else if (parsed.field === 'max') setZoneKeypadTarget(`ifb::${parsed.bandId}::bw`);
        else if (parsed.field === 'bw') setZoneKeypadTarget(`ifb::${parsed.bandId}::count`);
      } else if (parsed.type === 'wt') {
        if (parsed.field === 'min') setZoneKeypadTarget(`wt::${parsed.bandId}::max`);
        else if (parsed.field === 'max') setZoneKeypadTarget(`wt::${parsed.bandId}::bw`);
        else if (parsed.field === 'bw') setZoneKeypadTarget(`wt::${parsed.bandId}::count`);
      }
      return;
    }
    // Limit digits length
    if (cur.length < 12) {
      updateZoneTargetVal(target, cur + key);
    }
  };

  // --- DISTANCE & OVERRIDE HELPERS ---
  const getZoneDistance = (zA, zB) => {
    if (zA === zB) return 0;
    const k1 = `${zA}_${zB}`;
    const k2 = `${zB}_${zA}`;
    if (zoneDistances[k1] !== undefined) return zoneDistances[k1];
    if (zoneDistances[k2] !== undefined) return zoneDistances[k2];
    return 30;
  };

  // User-defined Arena Dimensions handler
  const applyArenaDimensions = (w: number, l: number) => {
    const validW = Math.max(10, Math.min(2000, Math.round(w) || 60));
    const validL = Math.max(10, Math.min(2000, Math.round(l) || 60));
    setArenaWidth(validW);
    setArenaLength(validL);
    setArenaWidthInput(String(validW));
    setArenaLengthInput(String(validL));

    // Clamp existing zones so they stay nicely within the updated arena boundaries
    setZonePositions(prev => {
      const clamped: Record<string, { x: number; y: number }> = {};
      let changed = false;
      Object.entries(prev).forEach(([zid, pos]) => {
        const nx = Math.max(2, Math.min(validW - 2, pos.x));
        const ny = Math.max(2, Math.min(validL - 2, pos.y));
        if (nx !== pos.x || ny !== pos.y) changed = true;
        clamped[zid] = { x: nx, y: ny };
      });
      return changed ? clamped : prev;
    });
  };

  // Center all zones in the 2D arena viewport
  const handleCenterAllZones = () => {
    if (zones.length === 0) return;
    let sumX = 0;
    let sumY = 0;
    let count = 0;
    zones.forEach(z => {
      const pos = zonePositions[z.id] || { x: arenaWidth / 2, y: arenaLength / 2 };
      sumX += pos.x;
      sumY += pos.y;
      count++;
    });

    const centroidX = count > 0 ? sumX / count : arenaWidth / 2;
    const centroidY = count > 0 ? sumY / count : arenaLength / 2;
    const shiftX = (arenaWidth / 2) - centroidX;
    const shiftY = (arenaLength / 2) - centroidY;

    setZonePositions(prev => {
      const updated: Record<string, { x: number; y: number }> = {};
      zones.forEach(z => {
        const cur = prev[z.id] || { x: arenaWidth / 2, y: arenaLength / 2 };
        const newX = Math.max(3, Math.min(arenaWidth - 3, Math.round((cur.x + shiftX) * 10) / 10));
        const newY = Math.max(3, Math.min(arenaLength - 3, Math.round((cur.y + shiftY) * 10) / 10));
        updated[z.id] = { x: newX, y: newY };
      });
      return updated;
    });

    setSpatialPanOffset({ x: 0, y: 0 });
    showToast('🎯 Zones centered on 2D canvas', 'info');
  };

  const setZoneDistance = (zA, zB, distVal) => {
    const val = parseFloat(distVal) || 0;
    const k = `${zA}_${zB}`;
    setZoneDistances(prev => ({ ...prev, [k]: val }));
  };

  // Update 2D spatial position and automatically sync Euclidean distance (in meters) to matrix
  const updateZonePosition = (zoneId: string, newX: number, newY: number) => {
    // Clamp to user-defined arena boundaries
    const clampedX = Math.max(1, Math.min(arenaWidth - 1, Math.round(newX * 10) / 10));
    const clampedY = Math.max(1, Math.min(arenaLength - 1, Math.round(newY * 10) / 10));

    setZonePositions(prev => {
      const updated = { ...prev, [zoneId]: { x: clampedX, y: clampedY } };
      
      // Auto-recalculate distances between this moved zone and all other zones
      const newDists = { ...zoneDistances };
      zones.forEach(other => {
        if (other.id !== zoneId) {
          const posOther = updated[other.id] || { x: arenaWidth / 2, y: arenaLength / 2 };
          const dx = clampedX - posOther.x;
          const dy = clampedY - posOther.y;
          const distMeters = Math.round(Math.sqrt(dx * dx + dy * dy) * 10) / 10;
          newDists[`${zoneId}_${other.id}`] = distMeters;
          newDists[`${other.id}_${zoneId}`] = distMeters;
        }
      });
      setZoneDistances(newDists);

      return updated;
    });
  };

  const isZoneCoupledStatus = (zA, zB) => {
    if (zA === zB) return true;
    const k1 = `${zA}_${zB}`;
    const k2 = `${zB}_${zA}`;
    if (zoneOverrides[k1] !== undefined) return zoneOverrides[k1];
    if (zoneOverrides[k2] !== undefined) return zoneOverrides[k2];
    const dist = getZoneDistance(zA, zB);
    return dist < 26.0;
  };

  const toggleZoneOverride = (zA, zB) => {
    const k = `${zA}_${zB}`;
    const current = isZoneCoupledStatus(zA, zB);
    setZoneOverrides(prev => ({ ...prev, [k]: !current }));
  };

  // --- MULTI-ZONE COORDINATION ACTION ---
  const handleCoordinateAll = () => {
    let totalTarget = (generatedPlan || []).filter(p => p.locked).length;
    zones.forEach(zone => {
      (zone.duplexBands || []).forEach(b => { totalTarget += (parseInt(b.pairCount) || 0); });
      if (zone.enableBaseSimplex) {
        (zone.baseSimplexBands || []).forEach(b => { totalTarget += (parseInt(b.count) || 0); });
      }
      if (zone.enableWalkieSimplex) {
        (zone.walkieSimplexBands || []).forEach(b => { totalTarget += (parseInt(b.count) || 0); });
      }
    });

    const newPlan = coordinateAllZones({
      zones,
      zoneDistances,
      zoneOverrides,
      existingPlan: generatedPlan,
      iterations: 250
    });

    const planWithStrings = newPlan.map(p => ({
      ...p,
      txStr: p.tx.toFixed(5),
      rxStr: p.rx > 0 ? p.rx.toFixed(5) : '---'
    }));

    setGeneratedPlan(planWithStrings);

    if (planWithStrings.length > 0) {
      const allFreqs = planWithStrings.map(p => p.tx);
      const minF = Math.min(...allFreqs);
      const maxF = Math.max(...allFreqs, ...(planWithStrings.filter(p => p.rx > 0).map(p => p.rx)));
      const mid = (minF + maxF) / 2;
      setCenterFreqStr(mid.toFixed(5));
      setSpan(Math.max(15.0, (maxF - minF) + 6));
      setLedgerView('PLAN');
      if (planWithStrings.length < totalTarget) {
        showToast(`Co-ordinated ${planWithStrings.length}/${totalTarget} compatible channels (0 clashes). Capacity reduced by ${totalTarget - planWithStrings.length} to prevent bleed/IMD in coupled zones.`, 'warning');
      } else {
        showToast(`Co-ordinated all ${planWithStrings.length} channels with 0 clashes!`, 'success');
      }
    } else {
      showToast('No compatible frequencies could be allocated for the specified constraints.', 'error');
    }
  };

  const handleClearUnlocked = () => {
    const lockedOnly = generatedPlan.filter(p => p.locked);
    setGeneratedPlan(lockedOnly);
    showToast(`Cleared unlocked channels. Retained ${lockedOnly.length} locked.`, 'info');
  };

  // --- ZONE CONFIG REGULATORY REGION & DUPLEX CONTROLS ---
  const handleToggleRegulatoryRegion = (region: 'GB_UK' | 'EU_EUROPE') => {
    setRegulatoryRegion(region);
    const newDir = region === 'EU_EUROPE' ? 'BASE_HIGH' : 'BASE_LOW';
    setDuplexDirection(newDir);

    setZones(prevZones => prevZones.map(zone => ({
      ...zone,
      duplexBands: (zone.duplexBands || []).map(b => {
        const bMin = parseFloat(b.txMin) || 0;
        const bMax = parseFloat(b.txMax) || 0;
        const rxMin = parseFloat(b.rxMin) || 0;
        const rxMax = parseFloat(b.rxMax) || 0;
        const curSplit = parseFloat(b.split) || 0;

        if (region === 'EU_EUROPE') {
          if (bMin < rxMin || curSplit > 0) {
            return {
              ...b,
              txMin: b.rxMin,
              txMax: b.rxMax,
              rxMin: b.txMin,
              rxMax: b.txMax,
              split: curSplit !== 0 ? (-Math.abs(curSplit)).toFixed(3) : '-10.050',
              duplexDirection: 'BASE_HIGH'
            };
          }
          return { ...b, duplexDirection: 'BASE_HIGH' };
        } else {
          if (bMin > rxMin || curSplit < 0) {
            return {
              ...b,
              txMin: b.rxMin,
              txMax: b.rxMax,
              rxMin: b.txMin,
              rxMax: b.txMax,
              split: curSplit !== 0 ? `+${Math.abs(curSplit).toFixed(3)}` : '+10.050',
              duplexDirection: 'BASE_LOW'
            };
          }
          return { ...b, duplexDirection: 'BASE_LOW' };
        }
      })
    })));

    setGeneratedPlan(prevPlan => (prevPlan || []).map(p => {
      if (p.isSimplex || !p.rx || p.rx === 0) return p;
      const isCurrentlyBaseLow = p.tx < p.rx;
      if (region === 'EU_EUROPE' && isCurrentlyBaseLow) {
        return {
          ...p,
          tx: p.rx,
          rx: p.tx,
          txStr: p.rx.toFixed(5),
          rxStr: p.tx.toFixed(5),
          duplexDirection: 'BASE_HIGH'
        };
      } else if (region === 'GB_UK' && !isCurrentlyBaseLow) {
        return {
          ...p,
          tx: p.rx,
          rx: p.tx,
          txStr: p.rx.toFixed(5),
          rxStr: p.tx.toFixed(5),
          duplexDirection: 'BASE_LOW'
        };
      }
      return p;
    }));

    showToast(
      region === 'EU_EUROPE'
        ? '🇪🇺 Switched to EU Europe Mode (Base TX High / Portable TX Low)'
        : '🇬🇧 Switched to GB UK Mode (Base TX Low / Portable TX High)',
      'success'
    );
  };

  const handleInvertDuplexDirection = () => {
    const nextDir = duplexDirection === 'BASE_LOW' ? 'BASE_HIGH' : 'BASE_LOW';
    const nextRegion = nextDir === 'BASE_HIGH' ? 'EU_EUROPE' : 'GB_UK';
    setDuplexDirection(nextDir);
    setRegulatoryRegion(nextRegion);

    setZones(prevZones => prevZones.map(zone => ({
      ...zone,
      duplexBands: (zone.duplexBands || []).map(b => {
        const curSplit = parseFloat(b.split) || 0;
        const flippedSplit = curSplit !== 0 ? (-curSplit).toFixed(3) : (nextDir === 'BASE_HIGH' ? '-10.050' : '+10.050');
        const formattedSplit = flippedSplit.startsWith('-') ? flippedSplit : `+${flippedSplit}`;
        return {
          ...b,
          txMin: b.rxMin,
          txMax: b.rxMax,
          rxMin: b.txMin,
          rxMax: b.txMax,
          split: formattedSplit,
          duplexDirection: nextDir
        };
      })
    })));

    setGeneratedPlan(prevPlan => (prevPlan || []).map(p => {
      if (p.isSimplex || !p.rx || p.rx === 0) return p;
      return {
        ...p,
        tx: p.rx,
        rx: p.tx,
        txStr: p.rx.toFixed(5),
        rxStr: p.tx.toFixed(5),
        duplexDirection: nextDir
      };
    }));

    showToast(
      nextDir === 'BASE_HIGH'
        ? '⇄ Inverted to Base TX High / Portable TX Low across all duplex bands!'
        : '⇄ Inverted to Base TX Low / Portable TX High across all duplex bands!',
      'info'
    );
  };

  const handleClearAllZoneConfig = () => {
    setGeneratedPlan([]);
    setKeyedChannels({});
    showToast('🗑 Coordinated frequency plan and active carriers reset.', 'info');
  };

  // --- STORAGE HELPERS ---
  const loadProfileList = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const profileKeys = (keys || []).filter(k => k.startsWith('rf_profile_'));
      setSavedProfiles(profileKeys.map(k => k.replace('rf_profile_', '')));
    } catch (err) {
      console.warn('Storage warning:', err);
    }
  };

  const saveCurrentProfile = async () => {
    const trimmed = (profileName || '').trim();
    if (!trimmed) return Alert.alert('Missing Name', 'Please enter a profile name.');
    if (generatedPlan.length === 0) return Alert.alert('Plan Empty', 'Coordinate frequencies first.');

    try {
      const payload = {
        name: trimmed,
        savedAt: new Date().toISOString(),
        zones,
        zoneDistances,
        zoneOverrides,
        plan: generatedPlan
      };
      await AsyncStorage.setItem('rf_profile_' + trimmed, JSON.stringify(payload));
      setProfileName('');
      await loadProfileList();
      showToast(`Profile "${trimmed}" saved!`, 'success');
    } catch (err) {
      showToast('Save error: ' + err.message, 'error');
    }
  };

  const loadProfile = async (name) => {
    try {
      const raw = await AsyncStorage.getItem('rf_profile_' + name);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed.zones) {
        setZones(parsed.zones);
        setActiveZoneId(parsed.zones[0]?.id || 'z1');
      }
      if (parsed.zoneDistances) setZoneDistances(parsed.zoneDistances);
      if (parsed.zoneOverrides) setZoneOverrides(parsed.zoneOverrides);

      const planArray = Array.isArray(parsed) ? parsed : (parsed.plan || []);
      const sanitized = planArray.map(p => ({
        ...p,
        tx: typeof p.tx === 'number' ? p.tx : parseFloat(p.txStr || 0),
        rx: typeof p.rx === 'number' ? p.rx : parseFloat(p.rxStr || 0),
        txStr: p.txStr || (p.tx ? p.tx.toFixed(5) : '0.00000'),
        rxStr: p.rxStr || (p.rx ? p.rx.toFixed(5) : (p.isSimplex ? '---' : '0.00000')),
        locked: p.locked !== undefined ? p.locked : true
      }));

      setGeneratedPlan(sanitized);

      if (sanitized.length > 0) {
        const freqs = sanitized.flatMap(p => p.rx > 0 ? [p.tx, p.rx] : [p.tx]).filter(f => f > 0);
        if (freqs.length > 0) {
          const minF = Math.min(...freqs);
          const maxF = Math.max(...freqs);
          setCenterFreqStr(((minF + maxF) / 2).toFixed(5));
          setSpan(Math.max(15.0, (maxF - minF) + 6));
        }
      }

      setLedgerView('PLAN');
      showToast(`Loaded "${name}" (${sanitized.length} channels)`, 'success');
    } catch (err) {
      showToast('Error loading profile', 'error');
    }
  };

  const deleteProfile = async (name) => {
    try {
      await AsyncStorage.removeItem('rf_profile_' + name);
      await loadProfileList();
      showToast(`Deleted "${name}"`, 'info');
    } catch (err) {
      showToast('Could not delete', 'error');
    }
  };

  // --- NUDGE & LOCK ---
  const nudgeFreq = (index, direction, type) => {
    const newPlan = [...generatedPlan];
    let val = newPlan[index][type] + (direction * nudgeStep);
    val = Number(val.toFixed(5));
    // Skip over any restricted spot frequency or range
    while (isFrequencyRestricted(val).isRestricted && val >= 400 && val <= 470) {
      val = Number((val + (direction * nudgeStep)).toFixed(5));
    }
    const check = isFrequencyRestricted(val);
    if (check.isRestricted) {
      showToast(`⛔ ${check.reason}`, 'error');
      return;
    }
    newPlan[index][type] = val;
    newPlan[index][type + 'Str'] = val.toFixed(5);
    newPlan[index].locked = true; 
    setGeneratedPlan(newPlan);
  };

  const updateProp = (index, prop, text) => {
    const newPlan = [...generatedPlan];
    newPlan[index][prop] = text;
    const num = parseFloat(text);
    if ((prop === 'txStr' || prop === 'rxStr') && !isNaN(num) && num > 0) {
      const check = isFrequencyRestricted(num);
      if (check.isRestricted) {
        showToast(`⛔ ${check.reason}`, 'error');
      }
    }
    if (prop === 'txStr' && !isNaN(num)) newPlan[index].tx = num;
    if (prop === 'rxStr' && !isNaN(num)) newPlan[index].rx = num;
    setGeneratedPlan(newPlan);
  };

  const toggleLock = (index) => {
    const newPlan = [...generatedPlan];
    newPlan[index].locked = !newPlan[index].locked;
    setGeneratedPlan(newPlan);
  };

  const deleteItem = (index) => {
    const newPlan = [...generatedPlan];
    newPlan.splice(index, 1);
    setGeneratedPlan(newPlan);
  };

  const sharePlan = async () => {
    if (generatedPlan.length === 0) return showToast('No plan to export.', 'error');
    let msg = "MULTI-ZONE RF CO-ORDINATION PLAN\n==================================\n\n";
    zones.forEach(z => {
      msg += `>>> ${z.name.toUpperCase()} <<<\n`;
      const zoneItems = generatedPlan.filter(p => p.zoneId === z.id);
      if (zoneItems.length === 0) {
        msg += "  (No channels)\n\n";
      } else {
        zoneItems.forEach((p, idx) => {
          if (!p.isSimplex) {
            const splitVal = parseFloat(p.rxStr) - parseFloat(p.txStr);
            const splitStr = splitVal.toFixed(3);
            msg += `  [CH ${idx+1}] DUPLEX (${p.bandLabel || 'Band'} | Split: ${splitVal >= 0 ? '+' : ''}${splitStr}MHz):\n`;
            msg += `    BASE TX:     ${parseFloat(p.txStr).toFixed(5)} MHz\n`;
            msg += `    PORTABLE TX: ${parseFloat(p.rxStr).toFixed(5)} MHz\n\n`;
          } else {
            const kind = p.simplexType === 'base_tx' ? 'IFB' : 'WT';
            msg += `  [CH ${idx+1}] SIMPLEX ${kind} (${p.bandLabel || 'Band'}): ${parseFloat(p.txStr).toFixed(5)} MHz\n\n`;
          }
        });
      }
    });
    try {
      await Share.share({ message: msg });
    } catch (err) {
      console.warn('Share error:', err);
    }
  };

  // Active IMDs for currently selected zone
  const activeIMDs = useMemo(() => {
    if (generatedPlan.length === 0) return [];
    const continuousCoupledSources = generatedPlan
      .filter(p => p.txIsBase !== false && p.tx > 0)
      .filter(p => isZoneCoupledStatus(activeZoneId, p.zoneId))
      .map(p => ({ freq: p.tx, txIsBase: true }));
    return calculateIMDs(continuousCoupledSources);
  }, [generatedPlan, activeZoneId, zoneDistances, zoneOverrides]);

  // Compatibility analysis for channels in active zone
  const activeZonePlanCollisions = useMemo(() => {
    const clashes: Record<number, { isClash: boolean; reason: string }> = {};
    const ADJ_HZ = 12000; // < 12.0 kHz co-channel overlap is clash, >= 12.5 kHz adjacent raster is clear
    const IMD_HZ = 12000; // < 12.0 kHz is clash, >= 12.5 kHz adjacent channel is clear

    generatedPlan.forEach((item, idx) => {
      if (item.zoneId !== activeZoneId) return;
      let clashing = false;
      let reason = '';

      // Check co-channel & adjacent channel against other carriers
      generatedPlan.forEach((other, oIdx) => {
        if (idx === oIdx) return;
        if (item.tx > 0 && other.tx > 0 && Math.round(Math.abs(item.tx - other.tx) * 1000000) < ADJ_HZ) {
          clashing = true;
          reason = `Co-channel TX clash with ${other.tx.toFixed(5)}`;
        }
        if (item.tx > 0 && other.rx > 0 && Math.round(Math.abs(item.tx - other.rx) * 1000000) < ADJ_HZ) {
          clashing = true;
          reason = `TX clashes with RX ${other.rx.toFixed(5)}`;
        }
        if (item.rx > 0 && other.tx > 0 && Math.round(Math.abs(item.rx - other.tx) * 1000000) < ADJ_HZ) {
          clashing = true;
          reason = `RX clashes with TX ${other.tx.toFixed(5)}`;
        }
      });

      // Check 2Tx and 3Tx IMD collision on receiver frequencies (< 12.0 kHz is clash, >= 12.5 kHz is clear)
      if (item.rx > 0) {
        for (const imd of activeIMDs) {
          const diffHz = Math.round(Math.abs(item.rx - imd.freq) * 1000000);
          if (diffHz < IMD_HZ) {
            clashing = true;
            reason = `IMD collision: hits ${imd.type} (${imd.freq.toFixed(5)} MHz) [diff: ${(diffHz/1000).toFixed(1)}kHz < 12.0kHz]`;
            break;
          }
        }
      }

      // Check 2Tx and 3Tx IMD collision on transmitter (if transmitter is victim)
      if (item.tx > 0 && item.simplexType !== 'walkie') {
        for (const imd of activeIMDs) {
          const diffHz = Math.round(Math.abs(item.tx - imd.freq) * 1000000);
          if (diffHz < IMD_HZ) {
            clashing = true;
            reason = `IMD collision: hits ${imd.type} (${imd.freq.toFixed(5)} MHz) [diff: ${(diffHz/1000).toFixed(1)}kHz < 12.0kHz]`;
            break;
          }
        }
      }

      if (clashing) {
        clashes[idx] = { isClash: true, reason };
      }
    });

    return clashes;
  }, [generatedPlan, activeZoneId, activeIMDs]);

  // Automated stress test sequence for PTT simulator
  useEffect(() => {
    if (!isStressTesting || generatedPlan.length === 0) return;
    const interval = setInterval(() => {
      setKeyedChannels(prev => {
        const next: Record<number, boolean> = {};
        const zoneIndices = generatedPlan
          .map((p, idx) => ({ p, idx }))
          .filter(item => item.p.zoneId === activeZoneId)
          .map(item => item.idx);

        if (zoneIndices.length === 0) return next;
        const countToKey = Math.min(zoneIndices.length, Math.floor(Math.random() * 2) + 2);
        const shuffled = [...zoneIndices].sort(() => 0.5 - Math.random());
        shuffled.slice(0, countToKey).forEach(i => {
          next[i] = true;
        });
        return next;
      });
    }, 1400);

    return () => clearInterval(interval);
  }, [isStressTesting, generatedPlan, activeZoneId]);

  // Tactical Spectrum Carriers
  const spectrumCarriers: SpectrumCarrier[] = useMemo(() => {
    // If in IMD Playground mode, display the active IMD Inspector frequency pool on the pinned analyzer
    if (topPanelMode === 'IMD_PLAYGROUND') {
      const isEuBaseHigh = regulatoryRegion === 'EU_EUROPE';
      return imdInspectorFreqs.map((f, origIdx) => {
        const isBase = isEuBaseHigh ? f > 462 : f <= 462;
        return {
          freq: f,
          label: `${origIdx + 1}`,
          type: isBase ? 'BASE_TX' : 'PORT_TX',
          hasClash: false,
          powerDbm: isBase ? -10 : -20,
          zoneName: 'IMD INSPECTOR',
          zoneId: 'imd_inspector',
          locked: false
        };
      });
    }

    const list: SpectrumCarrier[] = [];
    generatedPlan.forEach((p, origIdx) => {
      if (p.zoneId !== activeZoneId) return;
      const isKeyed = !!keyedChannels[origIdx];
      const hasClash = !!activeZonePlanCollisions[origIdx];

      if (topPanelMode === 'PTT_SIM') {
        if (!p.isSimplex) {
          // 1. Base Station Transmitter: Always continuous on air (Gold/Amber)
          list.push({
            freq: p.tx,
            label: `B${origIdx + 1} BASE [CONT]`,
            type: 'BASE_TX',
            isKeyed: false,
            isGhost: false,
            hasClash,
            powerDbm: -10,
            zoneName: p.zoneName,
            zoneId: p.zoneId,
            locked: p.locked
          });

          // 2. Portable Handset Transmitter:
          // Unkeyed = Cyan dashed "Ghost" outline standby marker
          // Keyed = Solid Green active on-air carrier
          list.push({
            freq: p.rx,
            label: isKeyed ? `H${origIdx + 1} [ACTIVE]` : `H${origIdx + 1} [PTT]`,
            type: 'PORT_TX',
            isKeyed,
            isGhost: !isKeyed,
            hasClash,
            powerDbm: isKeyed ? -18 : -52,
            zoneName: p.zoneName,
            zoneId: p.zoneId,
            locked: p.locked
          });
        } else if (p.simplexType === 'base_tx') {
          // IFB Feed: Continuous Base Station Transmitter
          list.push({
            freq: p.tx,
            label: `IFB${origIdx + 1} [BASE CONT]`,
            type: 'IFB',
            isKeyed: false,
            isGhost: false,
            hasClash,
            powerDbm: -12,
            zoneName: p.zoneName,
            zoneId: p.zoneId,
            locked: p.locked
          });
        } else {
          // Simplex Walkie Handset:
          list.push({
            freq: p.tx,
            label: isKeyed ? `WT${origIdx + 1} [ACTIVE]` : `WT${origIdx + 1} [PTT]`,
            type: 'WALKIE',
            isKeyed,
            isGhost: !isKeyed,
            hasClash,
            powerDbm: isKeyed ? -18 : -52,
            zoneName: p.zoneName,
            zoneId: p.zoneId,
            locked: p.locked
          });
        }
      } else {
        // Standard Spectrum Analyzer Mode
        if (!p.isSimplex) {
          list.push({
            freq: p.tx,
            label: `${origIdx + 1}`,
            type: 'BASE_TX',
            hasClash,
            powerDbm: -10,
            zoneName: p.zoneName,
            zoneId: p.zoneId,
            locked: p.locked
          });
          list.push({
            freq: p.rx,
            label: `${origIdx + 1}`,
            type: 'PORT_TX',
            hasClash,
            powerDbm: -25,
            zoneName: p.zoneName,
            zoneId: p.zoneId,
            locked: p.locked
          });
        } else {
          list.push({
            freq: p.tx,
            label: `${origIdx + 1}`,
            type: p.simplexType === 'base_tx' ? 'IFB' : 'WALKIE',
            hasClash,
            powerDbm: p.simplexType === 'base_tx' ? -12 : -20,
            zoneName: p.zoneName,
            zoneId: p.zoneId,
            locked: p.locked
          });
        }
      }
    });
    return list;
  }, [generatedPlan, activeZoneId, activeZonePlanCollisions, topPanelMode, keyedChannels, imdInspectorFreqs, regulatoryRegion]);

  // Tactical Spectrum IMDs (Combined Base Stations + Keyed Handsets)
  const spectrumImds: SpectrumImd[] = useMemo(() => {
    if (topPanelMode === 'PTT_SIM') {
      const radiatingTx: { freq: number; label: string; isBase: boolean; idx: number }[] = [];

      // 1. Continuous Base Stations (Duplex TX and IFB Feed)
      generatedPlan.forEach((p, idx) => {
        if (p.zoneId !== activeZoneId) return;
        if (!p.isSimplex && p.tx > 0) {
          radiatingTx.push({ freq: p.tx, label: `B${idx + 1}`, isBase: true, idx });
        } else if (p.isSimplex && p.simplexType === 'base_tx' && p.tx > 0) {
          radiatingTx.push({ freq: p.tx, label: `IFB${idx + 1}`, isBase: true, idx });
        }
      });

      // 2. Currently Keyed Portable Handsets
      generatedPlan.forEach((p, idx) => {
        if (p.zoneId !== activeZoneId) return;
        if (keyedChannels[idx]) {
          if (!p.isSimplex && p.rx > 0) {
            radiatingTx.push({ freq: p.rx, label: `H${idx + 1}`, isBase: false, idx });
          } else if (p.isSimplex && p.simplexType === 'walkie' && p.tx > 0) {
            radiatingTx.push({ freq: p.tx, label: `WT${idx + 1}`, isBase: false, idx });
          }
        }
      });

      if (radiatingTx.length < 2) return [];

      const imdList: SpectrumImd[] = [];
      const n = radiatingTx.length;
      const IMD_TOLERANCE_HZ = 12000; // < 12.0 kHz is clash, >= 12.5 kHz adjacent is clear

      const checkCollision = (f: number) => {
        for (const p of generatedPlan) {
          if (p.zoneId !== activeZoneId) continue;
          if (!p.isSimplex && p.rx > 0 && Math.round(Math.abs(p.rx - f) * 1000000) < IMD_TOLERANCE_HZ) {
            return { hasClash: true, desc: `Lands on Base RX ${p.rx.toFixed(5)} MHz!` };
          }
          if (p.tx > 0 && Math.round(Math.abs(p.tx - f) * 1000000) < IMD_TOLERANCE_HZ) {
            return { hasClash: true, desc: `Lands on Base TX ${p.tx.toFixed(5)} MHz!` };
          }
        }
        return { hasClash: false, desc: '' };
      };

      // 2-Tone IMDs: 2*f1 - f2
      for (let a = 0; a < n; a++) {
        const t1 = radiatingTx[a];
        for (let b = 0; b < n; b++) {
          if (a === b) continue;
          const t2 = radiatingTx[b];
          const imdFreq = Math.round((2 * t1.freq - t2.freq) * 100000) / 100000;
          if (imdFreq < 435 || imdFreq > 490) continue;

          const clash = checkCollision(imdFreq);
          imdList.push({
            freq: imdFreq,
            type: '2-Tone',
            color: clash.hasClash ? '#f43f5e' : '#ef4444',
            desc: `2*${t1.label} - ${t2.label}`,
            powerDbm: -55,
            hasClash: clash.hasClash,
            clashDesc: clash.desc
          });
        }
      }

      // 3-Tone IMDs: f1 + f2 - f3
      for (let a = 0; a < n; a++) {
        const t1 = radiatingTx[a];
        for (let b = a + 1; b < n; b++) {
          const t2 = radiatingTx[b];
          for (let c = b + 1; c < n; c++) {
            const t3 = radiatingTx[c];
            const combos = [
              { f: t1.freq + t2.freq - t3.freq, desc: `${t1.label}+${t2.label}-${t3.label}` },
              { f: t1.freq + t3.freq - t2.freq, desc: `${t1.label}+${t3.label}-${t2.label}` },
              { f: t2.freq + t3.freq - t1.freq, desc: `${t2.label}+${t3.label}-${t1.label}` }
            ];

            for (const combo of combos) {
              const imdFreq = Math.round(combo.f * 100000) / 100000;
              if (imdFreq < 435 || imdFreq > 490) continue;

              const clash = checkCollision(imdFreq);
              imdList.push({
                freq: imdFreq,
                type: '3-Tone',
                color: clash.hasClash ? '#f43f5e' : '#e11d48',
                desc: combo.desc,
                powerDbm: -65,
                hasClash: clash.hasClash,
                clashDesc: clash.desc
              });
            }
          }
        }
      }

      return imdList;
    }

    if (topPanelMode === 'IMD_PLAYGROUND') {
      const imdList: SpectrumImd[] = [];
      const n = imdInspectorFreqs.length;
      if (n < 2) return [];

      const checkCollision = (f: number) => {
        for (const target of imdInspectorFreqs) {
          if (Math.round(Math.abs(target - f) * 1000000) < 12000) {
            return { hasClash: true, desc: `Lands on ${target.toFixed(5)} MHz!` };
          }
        }
        return { hasClash: false, desc: '' };
      };

      // 2-tone IMDs: 2*f1 - f2
      for (let a = 0; a < n; a++) {
        for (let b = 0; b < n; b++) {
          if (a === b) continue;
          const f1 = imdInspectorFreqs[a];
          const f2 = imdInspectorFreqs[b];
          const imdFreq = Math.round((2 * f1 - f2) * 100000) / 100000;
          if (imdFreq < 400 || imdFreq > 490) continue;
          const clash = checkCollision(imdFreq);
          imdList.push({
            freq: imdFreq,
            type: '2-Tone',
            color: clash.hasClash ? '#f43f5e' : '#ef4444',
            desc: `2*(${f1.toFixed(5)}) - ${f2.toFixed(5)}`,
            powerDbm: -55,
            hasClash: clash.hasClash,
            clashDesc: clash.desc
          });
        }
      }

      // 3-tone IMDs: f1 + f2 - f3
      if (n >= 3) {
        for (let a = 0; a < n; a++) {
          for (let b = a + 1; b < n; b++) {
            for (let c = b + 1; c < n; c++) {
              const f1 = imdInspectorFreqs[a];
              const f2 = imdInspectorFreqs[b];
              const f3 = imdInspectorFreqs[c];
              const combos = [
                { f: f1 + f2 - f3, desc: `${f1.toFixed(5)} + ${f2.toFixed(5)} - ${f3.toFixed(5)}` },
                { f: f1 + f3 - f2, desc: `${f1.toFixed(5)} + ${f3.toFixed(5)} - ${f2.toFixed(5)}` },
                { f: f2 + f3 - f1, desc: `${f2.toFixed(5)} + ${f3.toFixed(5)} - ${f1.toFixed(5)}` }
              ];
              for (const combo of combos) {
                const imdFreq = Math.round(combo.f * 100000) / 100000;
                if (imdFreq < 400 || imdFreq > 490) continue;
                const clash = checkCollision(imdFreq);
                imdList.push({
                  freq: imdFreq,
                  type: '3-Tone',
                  color: clash.hasClash ? '#f43f5e' : '#e11d48',
                  desc: combo.desc,
                  powerDbm: -65,
                  hasClash: clash.hasClash,
                  clashDesc: clash.desc
                });
              }
            }
          }
        }
      }

      return imdList;
    }

    return activeIMDs;
  }, [topPanelMode, keyedChannels, generatedPlan, activeZoneId, activeIMDs, imdInspectorFreqs]);

  // PTT Channels List
  const pttChannels: PttChannel[] = useMemo(() => {
    return generatedPlan
      .filter(p => p.zoneId === activeZoneId)
      .map((p, idx) => {
        const origIndex = generatedPlan.findIndex(gp => gp === p);
        const isDuplex = !p.isSimplex;
        const isBaseFeed = p.isSimplex && p.simplexType === 'base_tx';
        const handsetTxFreq = isDuplex ? p.rx : p.tx;
        const baseTxFreq = isDuplex ? p.tx : (isBaseFeed ? p.tx : undefined);

        return {
          index: origIndex >= 0 ? origIndex : idx,
          label: isDuplex ? `Duplex Ch ${idx + 1}` : (isBaseFeed ? `IFB Ch ${idx + 1}` : `Walkie Ch ${idx + 1}`),
          role: channelRoles[origIndex] || (isDuplex ? `Director / Floor ${idx + 1}` : (isBaseFeed ? `Presenter IFB ${idx + 1}` : `Camera Crew ${idx + 1}`)),
          handsetTxFreq,
          baseTxFreq,
          txFreq: handsetTxFreq,
          rxFreq: baseTxFreq,
          isSimplex: p.isSimplex,
          simplexType: p.simplexType,
          zoneName: p.zoneName || activeZone.name,
          zoneId: p.zoneId,
          isKeyed: !!keyedChannels[origIndex],
          powerWatts: isDuplex || p.simplexType === 'walkie' ? 5 : 25
        };
      });
  }, [generatedPlan, activeZoneId, channelRoles, keyedChannels, activeZone.name]);

  // Crew Call Sheet Items
  const callSheetItems: CallSheetItem[] = useMemo(() => {
    return generatedPlan.map((p, idx) => ({
      index: idx,
      role: channelRoles[idx] || (!p.isSimplex ? `Duplex Crew ${idx + 1}` : (p.simplexType === 'base_tx' ? `IFB Feed ${idx + 1}` : `Walkie ${idx + 1}`)),
      type: !p.isSimplex ? 'DUP' : (p.simplexType === 'base_tx' ? 'IFB' : 'WT'),
      txFreq: p.tx,
      rxFreq: p.isSimplex ? undefined : p.rx,
      split: !p.isSimplex ? `${(p.rx - p.tx).toFixed(3)}M` : '',
      tone: channelTones[idx] || '100.0Hz',
      zoneName: p.zoneName || 'Main'
    }));
  }, [generatedPlan, channelRoles, channelTones]);

  // Live PTT Clashes
  const livePttClashes = useMemo(() => {
    const list: string[] = [];
    if (spectrumImds.length === 0) return list;
    const IMD_HZ = 12500;
    generatedPlan.forEach((p, idx) => {
      if (p.zoneId !== activeZoneId) return;
      if (p.rx > 0) {
        spectrumImds.forEach(imd => {
          const diffHz = Math.round(Math.abs(p.rx - imd.freq) * 1000000);
          if (diffHz < IMD_HZ) {
            list.push(`${channelRoles[idx] || `CH ${idx + 1}`} Base RX (${p.rx.toFixed(5)} MHz) hit by ${imd.type} IMD [${imd.desc || ''}] @ ${imd.freq.toFixed(5)} MHz (Delta ${(diffHz / 1000).toFixed(1)} kHz)`);
          }
        });
      }
      if (p.tx > 0) {
        spectrumImds.forEach(imd => {
          const diffHz = Math.round(Math.abs(p.tx - imd.freq) * 1000000);
          if (diffHz < IMD_HZ) {
            list.push(`${channelRoles[idx] || `CH ${idx + 1}`} Base TX (${p.tx.toFixed(5)} MHz) hit by ${imd.type} IMD [${imd.desc || ''}] @ ${imd.freq.toFixed(5)} MHz (Delta ${(diffHz / 1000).toFixed(1)} kHz)`);
          }
        });
      }
    });
    return Array.from(new Set(list));
  }, [spectrumImds, generatedPlan, activeZoneId, channelRoles]);

  const freqToX = (f) => {
    if (canvasWidth === 0 || isNaN(f)) return 0;
    return ((f - (centerFreq - (span / 2))) / span) * canvasWidth;
  };

  const gridLines = useMemo(() => {
    const lines = [];
    let gs = span <= 0.2 ? 0.025 : (span <= 1.0 ? 0.1 : (span <= 5.0 ? 0.5 : 1.0));
    const startGrid = Math.ceil((centerFreq - (span / 2)) / gs) * gs;
    for (let f = startGrid; f <= (centerFreq + (span / 2)); f += gs) lines.push(f);
    return lines;
  }, [centerFreq, span]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5,
      onPanResponderMove: (evt, gestureState) => {
        const shift = -(gestureState.dx / canvasWidth) * span;
        setCenterFreqStr((centerFreq + (shift / 15)).toFixed(5)); 
      },
    })
  ).current;

  // Presets to display in modal based on target type & active tab
  const activePresetsList = useMemo(() => {
    if (!presetTarget) return [];
    const isDuplex = presetTarget.type === 'duplex';
    if (presetTab === 'UK_OFCOM') {
      if (isDuplex) return UK_DUPLEX_PRESETS;
      return UK_SIMPLEX_PRESETS.filter(p => !p.simplexType || p.simplexType === presetTarget.type);
    } else {
      if (isDuplex) return bespokeDuplexPresets;
      return bespokeSimplexPresets.filter(p => !p.simplexType || p.simplexType === presetTarget.type);
    }
  }, [presetTarget, presetTab, bespokeDuplexPresets, bespokeSimplexPresets]);

  // Shared state for Tactical Spectrum Analyzer (Scope frozen at top, Controls scrollable below)
  const tacticalAnalyzerState = useTacticalSpectrumAnalyzer({
    centerFreq,
    span,
    carriers: spectrumCarriers,
    imds: spectrumImds,
    activeZoneName: activeZone.name,
    activeZoneId: activeZoneId,
    onCenterChange: (newFreq) => setCenterFreqStr(newFreq.toFixed(5)),
    onCenterFreqChange: (newFreq) => setCenterFreqStr(newFreq.toFixed(5)),
    onSpanChange: (newSpan) => setSpan(newSpan),
  });

  // When SPECTRUM_ANALYZER is active, render its own dedicated standalone full page
  if (topPanelMode === 'SPECTRUM_ANALYZER') {
    return (
      <View style={styles.chassis}>
        <DedicatedSpectrumAnalyzerScreen
          onClose={() => setTopPanelMode('COORDINATOR')}
        />
      </View>
    );
  }

  return (
    <View style={styles.chassis}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        
        {/* ================= IN PORTRAIT: FROZEN / PINNED TOP HEADER ================= */}
        {!isLandscape && (
          <View style={{ backgroundColor: '#050811', zIndex: 999, elevation: 20, borderBottomWidth: 1, borderBottomColor: '#1e293b', paddingTop: Platform.OS === 'ios' ? 42 : 26, paddingHorizontal: 8, paddingBottom: 4 }}>
            {statusMessage.text !== '' && (
              <View style={[styles.toastBanner, statusMessage.type === 'error' ? styles.toastError : styles.toastSuccess]}>
                <Text style={styles.toastText}>{statusMessage.text}</Text>
              </View>
            )}

            {/* ZONE SELECTOR TABS */}
            <View style={[styles.zoneTabsOuterContainer, { marginBottom: 3 }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.zoneTabsScroll}>
                {zones.map(z => {
                  const isActive = z.id === activeZoneId;
                  const countInZone = generatedPlan.filter(p => p.zoneId === z.id).length;
                  return (
                    <TouchableOpacity 
                      key={z.id} 
                      style={[styles.zoneTabPill, isActive && styles.zoneTabPillActive]} 
                      onPress={() => setActiveZoneId(z.id)}
                    >
                      <Text style={[styles.zoneTabPillText, isActive && styles.zoneTabPillTextActive]}>
                        {z.name} ({countInZone})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity style={styles.addZonePill} onPress={addZone}>
                  <Text style={styles.addZonePillText}>+ ADD ZONE</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>

            {/* COMPACT FROZEN PAGE NAVIGATION BAR */}
            <View style={styles.topPageNavBar}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topPageNavScroll}>
                {/* 1. Zones Configuration */}
                <TouchableOpacity 
                  activeOpacity={0.7}
                  style={[
                    styles.topPageNavBtn, 
                    topPanelMode === 'COORDINATOR' ? styles.topPageNavBtnActiveCyan : styles.topPageNavBtnIdle
                  ]} 
                  onPress={() => setTopPanelMode('COORDINATOR')}
                >
                  <View style={[
                    styles.topPageNavDot, 
                    topPanelMode === 'COORDINATOR' ? styles.topPageNavDotCyan : styles.topPageNavDotOff
                  ]} />
                  <Text style={[
                    styles.topPageNavText, 
                    topPanelMode === 'COORDINATOR' ? styles.topPageNavTextCyan : styles.topPageNavTextIdle
                  ]}>
                    ZONES CONFIGURATION
                  </Text>
                </TouchableOpacity>

                {/* 2. Zones Planning */}
                <TouchableOpacity 
                  activeOpacity={0.7}
                  style={[
                    styles.topPageNavBtn, 
                    topPanelMode === 'MAP' ? styles.topPageNavBtnActiveEmerald : styles.topPageNavBtnIdle
                  ]} 
                  onPress={() => setTopPanelMode('MAP')}
                >
                  <View style={[
                    styles.topPageNavDot, 
                    topPanelMode === 'MAP' ? styles.topPageNavDotEmerald : styles.topPageNavDotOff
                  ]} />
                  <Text style={[
                    styles.topPageNavText, 
                    topPanelMode === 'MAP' ? styles.topPageNavTextEmerald : styles.topPageNavTextIdle
                  ]}>
                    ZONES PLANNING
                  </Text>
                </TouchableOpacity>

                {/* 3. Zones Matrix */}
                <TouchableOpacity 
                  activeOpacity={0.7}
                  style={[
                    styles.topPageNavBtn, 
                    topPanelMode === 'MATRIX' ? styles.topPageNavBtnActiveAmber : styles.topPageNavBtnIdle
                  ]} 
                  onPress={() => setTopPanelMode('MATRIX')}
                >
                  <View style={[
                    styles.topPageNavDot, 
                    topPanelMode === 'MATRIX' ? styles.topPageNavDotAmber : styles.topPageNavDotOff
                  ]} />
                  <Text style={[
                    styles.topPageNavText, 
                    topPanelMode === 'MATRIX' ? styles.topPageNavTextAmber : styles.topPageNavTextIdle
                  ]}>
                    ZONES MATRIX
                  </Text>
                </TouchableOpacity>

                {/* 4. IMD Inspector */}
                <TouchableOpacity 
                  activeOpacity={0.7}
                  style={[
                    styles.topPageNavBtn, 
                    topPanelMode === 'IMD_PLAYGROUND' ? styles.topPageNavBtnActivePurple : styles.topPageNavBtnIdle
                  ]} 
                  onPress={() => setTopPanelMode('IMD_PLAYGROUND')}
                >
                  <View style={[
                    styles.topPageNavDot, 
                    topPanelMode === 'IMD_PLAYGROUND' ? styles.topPageNavDotPurple : styles.topPageNavDotOff
                  ]} />
                  <Text style={[
                    styles.topPageNavText, 
                    topPanelMode === 'IMD_PLAYGROUND' ? styles.topPageNavTextPurple : styles.topPageNavTextIdle
                  ]}>
                    IMD INSPECTOR
                  </Text>
                </TouchableOpacity>

                {/* 5. PTT Burst */}
                <TouchableOpacity 
                  activeOpacity={0.7}
                  style={[
                    styles.topPageNavBtn, 
                    topPanelMode === 'PTT_SIM' ? styles.topPageNavBtnActiveRed : styles.topPageNavBtnIdle
                  ]} 
                  onPress={() => setTopPanelMode('PTT_SIM')}
                >
                  <View style={[
                    styles.topPageNavDot, 
                    topPanelMode === 'PTT_SIM' ? styles.topPageNavDotRed : styles.topPageNavDotOff
                  ]} />
                  <Text style={[
                    styles.topPageNavText, 
                    topPanelMode === 'PTT_SIM' ? styles.topPageNavTextRed : styles.topPageNavTextIdle
                  ]}>
                    PTT BURST
                  </Text>
                </TouchableOpacity>

                {/* 6. Spectrum Analyzer */}
                <TouchableOpacity 
                  activeOpacity={0.7}
                  style={[
                    styles.topPageNavBtn, 
                    topPanelMode === 'SPECTRUM_ANALYZER' ? styles.topPageNavBtnActiveIndigo : styles.topPageNavBtnIdle
                  ]} 
                  onPress={() => setTopPanelMode('SPECTRUM_ANALYZER')}
                >
                  <View style={[
                    styles.topPageNavDot, 
                    topPanelMode === 'SPECTRUM_ANALYZER' ? styles.topPageNavDotIndigo : styles.topPageNavDotOff
                  ]} />
                  <Text style={[
                    styles.topPageNavText, 
                    topPanelMode === 'SPECTRUM_ANALYZER' ? styles.topPageNavTextIndigo : styles.topPageNavTextIdle
                  ]}>
                    SPECTRUM ANALYZER
                  </Text>
                </TouchableOpacity>

                {/* 7. Export */}
                <TouchableOpacity 
                  activeOpacity={0.7}
                  style={[
                    styles.topPageNavBtn, 
                    callSheetModalVisible ? styles.topPageNavBtnActiveTeal : styles.topPageNavBtnIdle
                  ]} 
                  onPress={() => setCallSheetModalVisible(true)}
                >
                  <View style={[
                    styles.topPageNavDot, 
                    callSheetModalVisible ? styles.topPageNavDotTeal : styles.topPageNavDotOff
                  ]} />
                  <Text style={[
                    styles.topPageNavText, 
                    callSheetModalVisible ? styles.topPageNavTextTeal : styles.topPageNavTextIdle
                  ]}>
                    EXPORT
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>

            {/* TACTICAL SPECTRUM ANALYZER SCOPE (CANVAS + DUAL/BASE/PORT PRESETS + PAN/ZOOM CONTROLS) */}
            <TacticalSpectrumAnalyzerScope state={tacticalAnalyzerState} />
          </View>
        )}

        {/* ================= SCROLLABLE LOWER BODY (OR FULL PAGE IN LANDSCAPE) ================= */}
        <ScrollView 
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingTop: isLandscape ? (Platform.OS === 'ios' ? 32 : 12) : 6, paddingHorizontal: 10, paddingBottom: 60 }} 
          keyboardShouldPersistTaps="handled"
        >
          {/* In landscape mode, top header and scope scroll together naturally */}
          {isLandscape && (
            <View style={{ marginBottom: 4 }}>
              {statusMessage.text !== '' && (
                <View style={[styles.toastBanner, statusMessage.type === 'error' ? styles.toastError : styles.toastSuccess, { marginBottom: 6 }]}>
                  <Text style={styles.toastText}>{statusMessage.text}</Text>
                </View>
              )}

              {/* ZONE SELECTOR TABS */}
              <View style={[styles.zoneTabsOuterContainer, { marginBottom: 3 }]}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.zoneTabsScroll}>
                  {zones.map(z => {
                    const isActive = z.id === activeZoneId;
                    const countInZone = generatedPlan.filter(p => p.zoneId === z.id).length;
                    return (
                      <TouchableOpacity 
                        key={z.id} 
                        style={[styles.zoneTabPill, isActive && styles.zoneTabPillActive]} 
                        onPress={() => setActiveZoneId(z.id)}
                      >
                        <Text style={[styles.zoneTabPillText, isActive && styles.zoneTabPillTextActive]}>
                          {z.name} ({countInZone})
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  <TouchableOpacity style={styles.addZonePill} onPress={addZone}>
                    <Text style={styles.addZonePillText}>+ ADD ZONE</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>

              {/* COMPACT FROZEN PAGE NAVIGATION BAR */}
              <View style={styles.topPageNavBar}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topPageNavScroll}>
                  {/* 1. Zones Configuration */}
                  <TouchableOpacity 
                    activeOpacity={0.7}
                    style={[
                      styles.topPageNavBtn, 
                      topPanelMode === 'COORDINATOR' ? styles.topPageNavBtnActiveCyan : styles.topPageNavBtnIdle
                    ]} 
                    onPress={() => setTopPanelMode('COORDINATOR')}
                  >
                    <View style={[
                      styles.topPageNavDot, 
                      topPanelMode === 'COORDINATOR' ? styles.topPageNavDotCyan : styles.topPageNavDotOff
                    ]} />
                    <Text style={[
                      styles.topPageNavText, 
                      topPanelMode === 'COORDINATOR' ? styles.topPageNavTextCyan : styles.topPageNavTextIdle
                    ]}>
                      ZONES CONFIGURATION
                    </Text>
                  </TouchableOpacity>

                  {/* 2. Zones Planning */}
                  <TouchableOpacity 
                    activeOpacity={0.7}
                    style={[
                      styles.topPageNavBtn, 
                      topPanelMode === 'MAP' ? styles.topPageNavBtnActiveEmerald : styles.topPageNavBtnIdle
                    ]} 
                    onPress={() => setTopPanelMode('MAP')}
                  >
                    <View style={[
                      styles.topPageNavDot, 
                      topPanelMode === 'MAP' ? styles.topPageNavDotEmerald : styles.topPageNavDotOff
                    ]} />
                    <Text style={[
                      styles.topPageNavText, 
                      topPanelMode === 'MAP' ? styles.topPageNavTextEmerald : styles.topPageNavTextIdle
                    ]}>
                      ZONES PLANNING
                    </Text>
                  </TouchableOpacity>

                  {/* 3. Zones Matrix */}
                  <TouchableOpacity 
                    activeOpacity={0.7}
                    style={[
                      styles.topPageNavBtn, 
                      topPanelMode === 'MATRIX' ? styles.topPageNavBtnActiveAmber : styles.topPageNavBtnIdle
                    ]} 
                    onPress={() => setTopPanelMode('MATRIX')}
                  >
                    <View style={[
                      styles.topPageNavDot, 
                      topPanelMode === 'MATRIX' ? styles.topPageNavDotAmber : styles.topPageNavDotOff
                    ]} />
                    <Text style={[
                      styles.topPageNavText, 
                      topPanelMode === 'MATRIX' ? styles.topPageNavTextAmber : styles.topPageNavTextIdle
                    ]}>
                      ZONES MATRIX
                    </Text>
                  </TouchableOpacity>

                  {/* 4. IMD Inspector */}
                  <TouchableOpacity 
                    activeOpacity={0.7}
                    style={[
                      styles.topPageNavBtn, 
                      topPanelMode === 'IMD_PLAYGROUND' ? styles.topPageNavBtnActivePurple : styles.topPageNavBtnIdle
                    ]} 
                    onPress={() => setTopPanelMode('IMD_PLAYGROUND')}
                  >
                    <View style={[
                      styles.topPageNavDot, 
                      topPanelMode === 'IMD_PLAYGROUND' ? styles.topPageNavDotPurple : styles.topPageNavDotOff
                    ]} />
                    <Text style={[
                      styles.topPageNavText, 
                      topPanelMode === 'IMD_PLAYGROUND' ? styles.topPageNavTextPurple : styles.topPageNavTextIdle
                    ]}>
                      IMD INSPECTOR
                    </Text>
                  </TouchableOpacity>

                  {/* 5. PTT Burst */}
                  <TouchableOpacity 
                    activeOpacity={0.7}
                    style={[
                      styles.topPageNavBtn, 
                      topPanelMode === 'PTT_SIM' ? styles.topPageNavBtnActiveRed : styles.topPageNavBtnIdle
                    ]} 
                    onPress={() => setTopPanelMode('PTT_SIM')}
                  >
                    <View style={[
                      styles.topPageNavDot, 
                      topPanelMode === 'PTT_SIM' ? styles.topPageNavDotRed : styles.topPageNavDotOff
                    ]} />
                    <Text style={[
                      styles.topPageNavText, 
                      topPanelMode === 'PTT_SIM' ? styles.topPageNavTextRed : styles.topPageNavTextIdle
                    ]}>
                      PTT BURST
                    </Text>
                  </TouchableOpacity>

                  {/* 6. Spectrum Analyzer */}
                  <TouchableOpacity 
                    activeOpacity={0.7}
                    style={[
                      styles.topPageNavBtn, 
                      topPanelMode === 'SPECTRUM_ANALYZER' ? styles.topPageNavBtnActiveIndigo : styles.topPageNavBtnIdle
                    ]} 
                    onPress={() => setTopPanelMode('SPECTRUM_ANALYZER')}
                  >
                    <View style={[
                      styles.topPageNavDot, 
                      topPanelMode === 'SPECTRUM_ANALYZER' ? styles.topPageNavDotIndigo : styles.topPageNavDotOff
                    ]} />
                    <Text style={[
                      styles.topPageNavText, 
                      topPanelMode === 'SPECTRUM_ANALYZER' ? styles.topPageNavTextIndigo : styles.topPageNavTextIdle
                    ]}>
                      SPECTRUM ANALYZER
                    </Text>
                  </TouchableOpacity>

                  {/* 7. Export */}
                  <TouchableOpacity 
                    activeOpacity={0.7}
                    style={[
                      styles.topPageNavBtn, 
                      callSheetModalVisible ? styles.topPageNavBtnActiveTeal : styles.topPageNavBtnIdle
                    ]} 
                    onPress={() => setCallSheetModalVisible(true)}
                  >
                    <View style={[
                      styles.topPageNavDot, 
                      callSheetModalVisible ? styles.topPageNavDotTeal : styles.topPageNavDotOff
                    ]} />
                    <Text style={[
                      styles.topPageNavText, 
                      callSheetModalVisible ? styles.topPageNavTextTeal : styles.topPageNavTextIdle
                    ]}>
                      EXPORT
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>

              {/* TACTICAL SPECTRUM ANALYZER SCOPE */}
              <TacticalSpectrumAnalyzerScope state={tacticalAnalyzerState} />
            </View>
          )}

          {/* TACTICAL SPECTRUM ANALYZER CONTROLS (UNFROZEN / SCROLLABLE UNDERNEATH) */}
          {/* Center Frequency, Span, Delta trace, and BW boxes scroll underneath */}
          <View style={{ backgroundColor: '#070d18', paddingHorizontal: 4, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#1e293b', marginBottom: 8, marginTop: 4 }}>
            <TacticalSpectrumAnalyzerControls
              state={tacticalAnalyzerState}
              activeKeypadTarget={zoneKeypadTarget}
              onSelectKeypadTarget={setZoneKeypadTarget}
            />
          </View>

        {/* Child 3: TOP PANEL: ZONE COORDINATOR & MATRIX */}
        <View style={styles.darkZonePanel}>
          {/* MODE 1: ACTIVE ZONE CONFIGURATION */}
          {topPanelMode === 'COORDINATOR' && (
            <View style={{marginTop: 6}}>
              {/* Zone Name Customizer */}
              <View style={styles.zoneNameRow}>
                <TextInput 
                  style={styles.zoneNameInput} 
                  value={activeZone.name} 
                  onChangeText={(v) => updateActiveZone({ ...activeZone, name: v })} 
                />
                {zones.length > 1 && (
                  <TouchableOpacity style={styles.removeZoneBtn} onPress={() => removeZone(activeZone.id)}>
                    <Text style={styles.removeZoneBtnText}>DELETE ZONE</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* TWO-COLUMN LAYOUT: BANDS CONFIGURATION (LEFT) + EMBEDDED KEYPAD (RIGHT) */}
              <View style={styles.zoneConfigFlexRow}>
                {/* LEFT: BANDS CONFIGURATION COLUMN */}
                <View style={styles.zoneBandsColumn}>
                  {/* TOGGLE SWITCH: DUPLEX (LEFT) | SIMPLEX (RIGHT) */}
                  <View style={styles.bandViewModeToggleContainer}>
                    <TouchableOpacity
                      style={[
                        styles.bandViewModeToggleBtn,
                        zoneBandViewMode === 'DUPLEX' && styles.bandViewModeToggleBtnActiveDuplex
                      ]}
                      onPress={() => {
                        setZoneBandViewMode('DUPLEX');
                        if (zoneKeypadTarget?.startsWith('ifb::') || zoneKeypadTarget?.startsWith('wt::')) {
                          const firstDup = activeZone.duplexBands?.[0];
                          if (firstDup) setZoneKeypadTarget(`dup::${firstDup.id}::txMin`);
                        }
                      }}
                    >
                      <View style={{flexDirection: 'row', alignItems: 'center', gap: 5}}>
                        <View style={[styles.bandViewModeDot, zoneBandViewMode === 'DUPLEX' && { backgroundColor: '#38bdf8' }]} />
                        <Text style={[
                          styles.bandViewModeToggleText,
                          zoneBandViewMode === 'DUPLEX' && styles.bandViewModeToggleTextActive
                        ]}>
                          DUPLEX
                        </Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.bandViewModeToggleBtn,
                        zoneBandViewMode === 'SIMPLEX' && styles.bandViewModeToggleBtnActiveSimplex
                      ]}
                      onPress={() => {
                        setZoneBandViewMode('SIMPLEX');
                        if (zoneKeypadTarget?.startsWith('dup::')) {
                          if (activeZone.enableBaseSimplex && activeZone.baseSimplexBands?.[0]) {
                            setZoneKeypadTarget(`ifb::${activeZone.baseSimplexBands[0].id}::min`);
                          } else if (activeZone.enableWalkieSimplex && activeZone.walkieSimplexBands?.[0]) {
                            setZoneKeypadTarget(`wt::${activeZone.walkieSimplexBands[0].id}::min`);
                          }
                        }
                      }}
                    >
                      <View style={{flexDirection: 'row', alignItems: 'center', gap: 5}}>
                        <View style={[styles.bandViewModeDot, zoneBandViewMode === 'SIMPLEX' && { backgroundColor: '#06b6d4' }]} />
                        <Text style={[
                          styles.bandViewModeToggleText,
                          zoneBandViewMode === 'SIMPLEX' && styles.bandViewModeToggleTextActive
                        ]}>
                          SIMPLEX
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>

                  {/* DUPLEX MODE: RENDER ONLY DUPLEX TALKBACK BANDS */}
                  {zoneBandViewMode === 'DUPLEX' && (
                    <View>
                      <View style={styles.bandHeaderRow}>
                        <Text style={styles.sectionHeader}>DUPLEX TALKBACK BANDS</Text>
                        <View style={{flexDirection: 'row', gap: 6, flexShrink: 0}}>
                          <TouchableOpacity style={styles.addBandBtn} onPress={addDuplexBand}>
                            <Text style={styles.addBandBtnText}>+ ADD DUP BAND</Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      {activeZone.duplexBands.map((band) => {
                        const isCustom = !band.discreteBand || (band.label || '').toLowerCase().includes('custom');
                        const displayLabel = isCustom ? 'Custom' : (band.label ? band.label.replace(/^Custom Duplex Band.*$/i, 'Custom').replace(/\s*MHz.*$/i, '').replace(/^UK Dedicated\s*/i, '').trim() : '457/467');
                        return (
                        <View key={band.id} style={styles.compactBandCard}>
                          <View style={styles.compactBandCardHeader}>
                            <TextInput 
                              style={styles.compactBandLabelInput} 
                              value={displayLabel} 
                              onChangeText={(v) => updateDuplexBand(band.id, 'label', v.replace(/\s*MHz.*$/i, ''))} 
                            />
                            <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
                              {!isCustom && (
                                <TouchableOpacity 
                                  style={styles.presetChipBtn} 
                                  onPress={() => openPresetModal('duplex', band.id)}
                                >
                                  <Text style={styles.presetChipBtnText}>PRESET</Text>
                                </TouchableOpacity>
                              )}
                              <Text style={[styles.compactMicroLabel, {marginBottom: 0}]}>PAIRS:</Text>
                              <TouchableOpacity
                                style={[
                                  styles.compactInputBox,
                                  { width: 28, minHeight: 20, paddingVertical: 1, paddingHorizontal: 2 },
                                  zoneKeypadTarget === `dup::${band.id}::pairCount` && styles.compactInputActive
                                ]}
                                onPress={() => setZoneKeypadTarget(`dup::${band.id}::pairCount`)}
                              >
                                <Text
                                  style={[styles.compactInputText, { fontSize: 10 }]}
                                  numberOfLines={1}
                                  adjustsFontSizeToFit
                                  minimumFontScale={0.7}
                                >
                                  {`${band.pairCount}${zoneKeypadTarget === `dup::${band.id}::pairCount` ? ' ▎' : ''}`}
                                </Text>
                              </TouchableOpacity>
                              {activeZone.duplexBands.length > 1 && (
                                <TouchableOpacity style={styles.deleteBandBtn} onPress={() => removeDuplexBand(band.id)}>
                                  <Text style={styles.deleteBandBtnText}>x</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>

                          {/* ROW 1: BASE TX RANGE */}
                          <Text style={[styles.compactSplitHeader, { color: '#facc15' }]}>BASE TX RANGE</Text>
                          <View style={[styles.inputRow, { gap: 4, marginBottom: 2 }]}>
                            <View style={[styles.inputGroup, { flex: 2 }]}>
                              <Text style={styles.compactMicroLabel}>BASE MIN</Text>
                              <TouchableOpacity
                                style={[
                                  styles.compactInputBox,
                                  zoneKeypadTarget === `dup::${band.id}::txMin` && styles.compactInputActive
                                ]}
                                onPress={() => setZoneKeypadTarget(`dup::${band.id}::txMin`)}
                              >
                                <Text
                                  style={[styles.compactInputText, { color: '#facc15' }]}
                                  numberOfLines={1}
                                  adjustsFontSizeToFit
                                  minimumFontScale={0.65}
                                >
                                  {`${band.txMin}${zoneKeypadTarget === `dup::${band.id}::txMin` ? ' ▎' : ''}`}
                                </Text>
                              </TouchableOpacity>
                            </View>
                            <View style={[styles.inputGroup, { flex: 2 }]}>
                              <Text style={styles.compactMicroLabel}>BASE MAX</Text>
                              <TouchableOpacity
                                style={[
                                  styles.compactInputBox,
                                  zoneKeypadTarget === `dup::${band.id}::txMax` && styles.compactInputActive
                                ]}
                                onPress={() => setZoneKeypadTarget(`dup::${band.id}::txMax`)}
                              >
                                <Text
                                  style={[styles.compactInputText, { color: '#facc15' }]}
                                  numberOfLines={1}
                                  adjustsFontSizeToFit
                                  minimumFontScale={0.65}
                                >
                                  {`${band.txMax}${zoneKeypadTarget === `dup::${band.id}::txMax` ? ' ▎' : ''}`}
                                </Text>
                              </TouchableOpacity>
                            </View>
                            <View style={[styles.inputGroup, { width: 34 }]}>
                              <Text style={styles.compactMicroLabel}>BW</Text>
                              <TouchableOpacity
                                style={[
                                  styles.compactInputBox,
                                  zoneKeypadTarget === `dup::${band.id}::bw` && styles.compactInputActive
                                ]}
                                onPress={() => setZoneKeypadTarget(`dup::${band.id}::bw`)}
                              >
                                <Text
                                  style={styles.compactInputText}
                                  numberOfLines={1}
                                  adjustsFontSizeToFit
                                  minimumFontScale={0.7}
                                >
                                  {`${band.bw}${zoneKeypadTarget === `dup::${band.id}::bw` ? ' ▎' : ''}`}
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>

                          {/* ROW 2: PORTABLE TX RANGE & SPLIT */}
                          <Text style={[styles.compactSplitHeader, { color: '#38bdf8' }]}>PORTABLE TX RANGE (BASE RX)</Text>
                          <View style={[styles.inputRow, { gap: 4 }]}>
                            <View style={[styles.inputGroup, { flex: 2 }]}>
                              <Text style={[styles.compactMicroLabel, { color: '#38bdf8' }]}>PORT MIN</Text>
                              <TouchableOpacity
                                style={[
                                  styles.compactInputBox,
                                  zoneKeypadTarget === `dup::${band.id}::rxMin` && styles.compactInputActive
                                ]}
                                onPress={() => setZoneKeypadTarget(`dup::${band.id}::rxMin`)}
                              >
                                <Text
                                  style={[styles.compactInputText, { color: '#38bdf8' }]}
                                  numberOfLines={1}
                                  adjustsFontSizeToFit
                                  minimumFontScale={0.65}
                                >
                                  {`${band.rxMin}${zoneKeypadTarget === `dup::${band.id}::rxMin` ? ' ▎' : ''}`}
                                </Text>
                              </TouchableOpacity>
                            </View>
                            <View style={[styles.inputGroup, { flex: 2 }]}>
                              <Text style={[styles.compactMicroLabel, { color: '#38bdf8' }]}>PORT MAX</Text>
                              <TouchableOpacity
                                style={[
                                  styles.compactInputBox,
                                  zoneKeypadTarget === `dup::${band.id}::rxMax` && styles.compactInputActive
                                ]}
                                onPress={() => setZoneKeypadTarget(`dup::${band.id}::rxMax`)}
                              >
                                <Text
                                  style={[styles.compactInputText, { color: '#38bdf8' }]}
                                  numberOfLines={1}
                                  adjustsFontSizeToFit
                                  minimumFontScale={0.65}
                                >
                                  {`${band.rxMax}${zoneKeypadTarget === `dup::${band.id}::rxMax` ? ' ▎' : ''}`}
                                </Text>
                              </TouchableOpacity>
                            </View>
                            <View style={[styles.inputGroup, { width: 44 }]}>
                              <Text style={[styles.compactMicroLabel, { color: '#c084fc' }]}>SPLIT</Text>
                              <TouchableOpacity
                                style={[
                                  styles.compactInputBox,
                                  zoneKeypadTarget === `dup::${band.id}::split` && styles.compactInputActive
                                ]}
                                onPress={() => setZoneKeypadTarget(`dup::${band.id}::split`)}
                              >
                                <Text
                                  style={[styles.compactInputText, { color: '#c084fc' }]}
                                  numberOfLines={1}
                                  adjustsFontSizeToFit
                                  minimumFontScale={0.65}
                                >
                                  {`${band.split || '+10.050'}${zoneKeypadTarget === `dup::${band.id}::split` ? ' ▎' : ''}`}
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                        );
                      })}
                    </View>
                  )}

                  {/* SIMPLEX MODE: RENDER BOTH BASE TX / IFB BANDS AND WALKIE-TALKIE BANDS */}
                  {zoneBandViewMode === 'SIMPLEX' && (
                    <View>
                      {/* 2. Base TX / IFB Bands for Active Zone */}
                      <View style={styles.bandHeaderRow}>
                        <View style={{flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1}}>
                          <View style={[styles.dotBadge, {backgroundColor: '#06b6d4'}]} />
                          <Text style={styles.sectionHeader}>BASE TX / IFB BANDS</Text>
                        </View>
                        <View style={{flexDirection: 'row', gap: 4, flexShrink: 0}}>
                          <TouchableOpacity 
                            style={[styles.togglePill, activeZone.enableBaseSimplex ? styles.togglePillActiveCyan : styles.togglePillInactive]}
                            onPress={() => updateActiveZone({ ...activeZone, enableBaseSimplex: !activeZone.enableBaseSimplex })}
                          >
                            <Text style={styles.togglePillText}>{activeZone.enableBaseSimplex ? 'ACTIVE' : 'OFF'}</Text>
                          </TouchableOpacity>
                          {activeZone.enableBaseSimplex && (
                            <TouchableOpacity style={[styles.addBandBtn, {borderColor: '#06b6d4'}]} onPress={addBaseSimplexBand}>
                              <Text style={[styles.addBandBtnText, {color: '#38bdf8'}]}>+ ADD BAND</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>

                      {activeZone.enableBaseSimplex && activeZone.baseSimplexBands.map((band) => (
                        <View key={band.id} style={[styles.compactBandCard, {borderColor: '#155e75'}]}>
                          <View style={styles.compactBandCardHeader}>
                            <TextInput 
                              style={[styles.compactBandLabelInput, {color: '#38bdf8'}]} 
                              value={band.label ? band.label.replace(/^455\s*IFB/i, 'Base TX').replace(/\s*MHz.*$/i, '').replace(/^UK Dedicated\s*/i, '').trim() : 'Base TX'} 
                              onChangeText={(v) => updateBaseSimplexBand(band.id, 'label', v.replace(/\s*MHz.*$/i, ''))} 
                            />
                            <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
                              <TouchableOpacity 
                                style={[styles.presetChipBtn, {borderColor: '#06b6d4'}]} 
                                onPress={() => openPresetModal('base_tx', band.id)}
                              >
                                <Text style={[styles.presetChipBtnText, {color: '#38bdf8'}]}>PRESET</Text>
                              </TouchableOpacity>
                              <Text style={[styles.compactMicroLabel, {marginBottom: 0, color: '#06b6d4'}]}>COUNT:</Text>
                              <TouchableOpacity
                                style={[
                                  styles.compactInputBox,
                                  { width: 28, minHeight: 20, paddingVertical: 1, paddingHorizontal: 2 },
                                  zoneKeypadTarget === `ifb::${band.id}::count` && styles.compactInputActive
                                ]}
                                onPress={() => setZoneKeypadTarget(`ifb::${band.id}::count`)}
                              >
                                <Text
                                  style={[styles.compactInputText, { fontSize: 10, color: '#06b6d4' }]}
                                  numberOfLines={1}
                                  adjustsFontSizeToFit
                                  minimumFontScale={0.7}
                                >
                                  {`${band.count}${zoneKeypadTarget === `ifb::${band.id}::count` ? ' ▎' : ''}`}
                                </Text>
                              </TouchableOpacity>
                              {activeZone.baseSimplexBands.length > 1 && (
                                <TouchableOpacity style={styles.deleteBandBtn} onPress={() => removeBaseSimplexBand(band.id)}>
                                  <Text style={styles.deleteBandBtnText}>x</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>

                          {/* EXACT SAME SIZING AS DUPLEX ROW 1: MIN (flex: 2), MAX (flex: 2), BW (width: 34) */}
                          <View style={[styles.inputRow, { gap: 4 }]}>
                            <View style={[styles.inputGroup, {flex: 2}]}>
                              <Text style={[styles.compactMicroLabel, { color: '#06b6d4' }]}>BASE MIN</Text>
                              <TouchableOpacity
                                style={[
                                  styles.compactInputBox,
                                  zoneKeypadTarget === `ifb::${band.id}::min` && styles.compactInputActive
                                ]}
                                onPress={() => setZoneKeypadTarget(`ifb::${band.id}::min`)}
                              >
                                <Text
                                  style={[styles.compactInputText, { color: '#06b6d4' }]}
                                  numberOfLines={1}
                                  adjustsFontSizeToFit
                                  minimumFontScale={0.65}
                                >
                                  {`${band.min}${zoneKeypadTarget === `ifb::${band.id}::min` ? ' ▎' : ''}`}
                                </Text>
                              </TouchableOpacity>
                            </View>
                            <View style={[styles.inputGroup, {flex: 2}]}>
                              <Text style={[styles.compactMicroLabel, { color: '#06b6d4' }]}>BASE MAX</Text>
                              <TouchableOpacity
                                style={[
                                  styles.compactInputBox,
                                  zoneKeypadTarget === `ifb::${band.id}::max` && styles.compactInputActive
                                ]}
                                onPress={() => setZoneKeypadTarget(`ifb::${band.id}::max`)}
                              >
                                <Text
                                  style={[styles.compactInputText, { color: '#06b6d4' }]}
                                  numberOfLines={1}
                                  adjustsFontSizeToFit
                                  minimumFontScale={0.65}
                                >
                                  {`${band.max}${zoneKeypadTarget === `ifb::${band.id}::max` ? ' ▎' : ''}`}
                                </Text>
                              </TouchableOpacity>
                            </View>
                            <View style={[styles.inputGroup, {width: 34}]}>
                              <Text style={[styles.compactMicroLabel, { color: '#06b6d4' }]}>BW</Text>
                              <TouchableOpacity
                                style={[
                                  styles.compactInputBox,
                                  zoneKeypadTarget === `ifb::${band.id}::bw` && styles.compactInputActive
                                ]}
                                onPress={() => setZoneKeypadTarget(`ifb::${band.id}::bw`)}
                              >
                                <Text
                                  style={[styles.compactInputText, { color: '#06b6d4' }]}
                                  numberOfLines={1}
                                  adjustsFontSizeToFit
                                  minimumFontScale={0.7}
                                >
                                  {`${band.bw}${zoneKeypadTarget === `ifb::${band.id}::bw` ? ' ▎' : ''}`}
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      ))}

                      {/* 3. Walkie-Talkie Bands for Active Zone */}
                      <View style={[styles.bandHeaderRow, {marginTop: 10}]}>
                        <View style={{flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1}}>
                          <View style={[styles.dotBadge, {backgroundColor: '#f97316'}]} />
                          <Text style={styles.sectionHeader}>WALKIE-TALKIE BANDS</Text>
                        </View>
                        <View style={{flexDirection: 'row', gap: 4, flexShrink: 0}}>
                          <TouchableOpacity 
                            style={[styles.togglePill, activeZone.enableWalkieSimplex ? styles.togglePillActiveAmber : styles.togglePillInactive]}
                            onPress={() => updateActiveZone({ ...activeZone, enableWalkieSimplex: !activeZone.enableWalkieSimplex })}
                          >
                            <Text style={styles.togglePillText}>{activeZone.enableWalkieSimplex ? 'ACTIVE' : 'OFF'}</Text>
                          </TouchableOpacity>
                          {activeZone.enableWalkieSimplex && (
                            <TouchableOpacity style={[styles.addBandBtn, {borderColor: '#f97316'}]} onPress={addWalkieSimplexBand}>
                              <Text style={[styles.addBandBtnText, {color: '#fb923c'}]}>+ ADD BAND</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>

                      {activeZone.enableWalkieSimplex && activeZone.walkieSimplexBands.map((band) => (
                        <View key={band.id} style={[styles.compactBandCard, {borderColor: '#9a3412'}]}>
                          <View style={styles.compactBandCardHeader}>
                            <TextInput 
                              style={[styles.compactBandLabelInput, {color: '#fb923c'}]} 
                              value={band.label ? band.label.replace(/^467\s*WT/i, 'Walkie').replace(/\s*MHz.*$/i, '').replace(/^UK Dedicated\s*/i, '').trim() : 'Walkie'} 
                              onChangeText={(v) => updateWalkieSimplexBand(band.id, 'label', v.replace(/\s*MHz.*$/i, ''))} 
                            />
                            <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
                              <TouchableOpacity 
                                style={[styles.presetChipBtn, {borderColor: '#f97316'}]} 
                                onPress={() => openPresetModal('walkie', band.id)}
                              >
                                <Text style={[styles.presetChipBtnText, {color: '#fb923c'}]}>PRESET</Text>
                              </TouchableOpacity>
                              <Text style={[styles.compactMicroLabel, {marginBottom: 0, color: '#fb923c'}]}>COUNT:</Text>
                              <TouchableOpacity
                                style={[
                                  styles.compactInputBox,
                                  { width: 28, minHeight: 20, paddingVertical: 1, paddingHorizontal: 2 },
                                  zoneKeypadTarget === `wt::${band.id}::count` && styles.compactInputActive
                                ]}
                                onPress={() => setZoneKeypadTarget(`wt::${band.id}::count`)}
                              >
                                <Text
                                  style={[styles.compactInputText, { fontSize: 10, color: '#fb923c' }]}
                                  numberOfLines={1}
                                  adjustsFontSizeToFit
                                  minimumFontScale={0.7}
                                >
                                  {`${band.count}${zoneKeypadTarget === `wt::${band.id}::count` ? ' ▎' : ''}`}
                                </Text>
                              </TouchableOpacity>
                              {activeZone.walkieSimplexBands.length > 1 && (
                                <TouchableOpacity style={styles.deleteBandBtn} onPress={() => removeWalkieSimplexBand(band.id)}>
                                  <Text style={styles.deleteBandBtnText}>x</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>

                          {/* EXACT SAME SIZING AS DUPLEX ROW 1: MIN (flex: 2), MAX (flex: 2), BW (width: 34) */}
                          <View style={[styles.inputRow, { gap: 4 }]}>
                            <View style={[styles.inputGroup, {flex: 2}]}>
                              <Text style={[styles.compactMicroLabel, { color: '#fb923c' }]}>WALKIE MIN</Text>
                              <TouchableOpacity
                                style={[
                                  styles.compactInputBox,
                                  zoneKeypadTarget === `wt::${band.id}::min` && styles.compactInputActive
                                ]}
                                onPress={() => setZoneKeypadTarget(`wt::${band.id}::min`)}
                              >
                                <Text
                                  style={[styles.compactInputText, { color: '#fb923c' }]}
                                  numberOfLines={1}
                                  adjustsFontSizeToFit
                                  minimumFontScale={0.65}
                                >
                                  {`${band.min}${zoneKeypadTarget === `wt::${band.id}::min` ? ' ▎' : ''}`}
                                </Text>
                              </TouchableOpacity>
                            </View>
                            <View style={[styles.inputGroup, {flex: 2}]}>
                              <Text style={[styles.compactMicroLabel, { color: '#fb923c' }]}>WALKIE MAX</Text>
                              <TouchableOpacity
                                style={[
                                  styles.compactInputBox,
                                  zoneKeypadTarget === `wt::${band.id}::max` && styles.compactInputActive
                                ]}
                                onPress={() => setZoneKeypadTarget(`wt::${band.id}::max`)}
                              >
                                <Text
                                  style={[styles.compactInputText, { color: '#fb923c' }]}
                                  numberOfLines={1}
                                  adjustsFontSizeToFit
                                  minimumFontScale={0.65}
                                >
                                  {`${band.max}${zoneKeypadTarget === `wt::${band.id}::max` ? ' ▎' : ''}`}
                                </Text>
                              </TouchableOpacity>
                            </View>
                            <View style={[styles.inputGroup, {width: 34}]}>
                              <Text style={[styles.compactMicroLabel, { color: '#fb923c' }]}>BW</Text>
                              <TouchableOpacity
                                style={[
                                  styles.compactInputBox,
                                  zoneKeypadTarget === `wt::${band.id}::bw` && styles.compactInputActive
                                ]}
                                onPress={() => setZoneKeypadTarget(`wt::${band.id}::bw`)}
                              >
                                <Text
                                  style={[styles.compactInputText, { color: '#fb923c' }]}
                                  numberOfLines={1}
                                  adjustsFontSizeToFit
                                  minimumFontScale={0.7}
                                >
                                  {`${band.bw}${zoneKeypadTarget === `wt::${band.id}::bw` ? ' ▎' : ''}`}
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                </View>

                {/* RIGHT: EMBEDDED NUMERIC KEYPAD */}
                <View style={styles.zoneKeypadCard}>
                  {/* Active Target Banner */}
                  <View style={[styles.zoneKeypadBanner, { borderColor: getZoneTargetColor(zoneKeypadTarget) }]}>
                    <Text style={styles.zoneKeypadBannerHeading}>TARGET:</Text>
                    <Text style={[styles.zoneKeypadBannerValue, { color: getZoneTargetColor(zoneKeypadTarget) }]} numberOfLines={1}>
                      {getZoneTargetLabel(zoneKeypadTarget)}
                    </Text>
                  </View>

                  {/* REPLICA / LIVE MIRROR BOX OF TARGETED FIELD */}
                  <View style={[styles.zoneKeypadReplicaCard, { borderColor: getZoneTargetColor(zoneKeypadTarget) }]}>
                    <View style={styles.zoneKeypadReplicaHeader}>
                      <Text style={styles.zoneKeypadReplicaHeading}>MIRROR BOX:</Text>
                      <View style={[styles.zoneKeypadReplicaUnitBadge, { borderColor: getZoneTargetColor(zoneKeypadTarget) }]}>
                        <Text style={[styles.zoneKeypadReplicaUnitText, { color: getZoneTargetColor(zoneKeypadTarget) }]}>
                          {getZoneTargetUnit(zoneKeypadTarget)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.zoneKeypadReplicaInputRow}>
                      {/* Stepper Down */}
                      <TouchableOpacity
                        style={styles.zoneKeypadReplicaStepBtn}
                        onPress={() => handleReplicaStep(-1)}
                        activeOpacity={0.6}
                      >
                        <Text style={[styles.zoneKeypadReplicaStepBtnText, { color: getZoneTargetColor(zoneKeypadTarget) }]}>-</Text>
                      </TouchableOpacity>

                      {/* Live Replica TextInput */}
                      <TextInput
                        style={[
                          styles.zoneKeypadReplicaInput,
                          {
                            color: getZoneTargetColor(zoneKeypadTarget),
                            borderColor: getZoneTargetColor(zoneKeypadTarget)
                          }
                        ]}
                        value={getZoneTargetCurrentVal(zoneKeypadTarget)}
                        onChangeText={(text) => updateZoneTargetVal(zoneKeypadTarget, text)}
                        keyboardType="decimal-pad"
                        placeholder="0.000"
                        placeholderTextColor="#475569"
                        selectTextOnFocus
                        returnKeyType="done"
                        onSubmitEditing={() => handleZoneKeypadPress('ENTER')}
                      />

                      {/* Stepper Up */}
                      <TouchableOpacity
                        style={styles.zoneKeypadReplicaStepBtn}
                        onPress={() => handleReplicaStep(1)}
                        activeOpacity={0.6}
                      >
                        <Text style={[styles.zoneKeypadReplicaStepBtnText, { color: getZoneTargetColor(zoneKeypadTarget) }]}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Keypad Grid */}
                  <View style={styles.zoneKeypadGrid}>
                    <View style={styles.zoneKeypadRow}>
                      <TouchableOpacity style={styles.zoneKeyBtn} onPress={() => handleZoneKeypadPress('1')}>
                        <Text style={styles.zoneKeyBtnText}>1</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.zoneKeyBtn} onPress={() => handleZoneKeypadPress('2')}>
                        <Text style={styles.zoneKeyBtnText}>2</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.zoneKeyBtn} onPress={() => handleZoneKeypadPress('3')}>
                        <Text style={styles.zoneKeyBtnText}>3</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.zoneKeypadRow}>
                      <TouchableOpacity style={styles.zoneKeyBtn} onPress={() => handleZoneKeypadPress('4')}>
                        <Text style={styles.zoneKeyBtnText}>4</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.zoneKeyBtn} onPress={() => handleZoneKeypadPress('5')}>
                        <Text style={styles.zoneKeyBtnText}>5</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.zoneKeyBtn} onPress={() => handleZoneKeypadPress('6')}>
                        <Text style={styles.zoneKeyBtnText}>6</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.zoneKeypadRow}>
                      <TouchableOpacity style={styles.zoneKeyBtn} onPress={() => handleZoneKeypadPress('7')}>
                        <Text style={styles.zoneKeyBtnText}>7</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.zoneKeyBtn} onPress={() => handleZoneKeypadPress('8')}>
                        <Text style={styles.zoneKeyBtnText}>8</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.zoneKeyBtn} onPress={() => handleZoneKeypadPress('9')}>
                        <Text style={styles.zoneKeyBtnText}>9</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.zoneKeypadRow}>
                      <TouchableOpacity style={styles.zoneKeyBtn} onPress={() => handleZoneKeypadPress('.')}>
                        <Text style={styles.zoneKeyBtnText}>.</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.zoneKeyBtn} onPress={() => handleZoneKeypadPress('0')}>
                        <Text style={styles.zoneKeyBtnText}>0</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.zoneKeyBtn, styles.zoneKeyBtnAction]} onPress={() => handleZoneKeypadPress('BACKSPACE')}>
                        <Text style={styles.zoneKeyBtnActionText}>⌫</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.zoneKeypadRow}>
                      <TouchableOpacity style={[styles.zoneKeyBtn, styles.zoneKeyBtnClear]} onPress={() => handleZoneKeypadPress('CLEAR')}>
                        <Text style={styles.zoneKeyBtnClearText}>C</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.zoneKeyBtn, styles.zoneKeyBtnEnter, { flex: 2 }]} onPress={() => handleZoneKeypadPress('ENTER')}>
                        <Text style={styles.zoneKeyBtnEnterText}>ENTER ↵</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <Text style={styles.zoneKeypadHint}>Tap any box to input</Text>
                </View>
              </View>

              {/* Regulatory Region Switch & Duplex Tools Grid in Zone Config (2x2 Grid of 4 Buttons) */}
              <View style={[styles.regionSwitchContainer, {marginTop: 12, marginBottom: 6}]}>
                <Text style={styles.regionLabel}>REGULATORY REGION &amp; DUPLEX DIRECTION CONTROLS:</Text>
                
                <View style={styles.regionGrid}>
                  {/* Row 1: Top 2 buttons */}
                  <View style={styles.regionGridRow}>
                    {/* Button 1: GB UK */}
                    <TouchableOpacity
                      style={[
                        styles.gridBtn,
                        regulatoryRegion === 'GB_UK' ? styles.gridBtnActiveUk : styles.gridBtnInactive
                      ]}
                      onPress={() => handleToggleRegulatoryRegion('GB_UK')}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.gridBtnText,
                        regulatoryRegion === 'GB_UK' && styles.gridBtnTextActive
                      ]}>
                        🇬🇧 GB UK (Base Low)
                      </Text>
                    </TouchableOpacity>

                    {/* Button 2: EU Europe */}
                    <TouchableOpacity
                      style={[
                        styles.gridBtn,
                        regulatoryRegion === 'EU_EUROPE' ? styles.gridBtnActiveEu : styles.gridBtnInactive
                      ]}
                      onPress={() => handleToggleRegulatoryRegion('EU_EUROPE')}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.gridBtnText,
                        regulatoryRegion === 'EU_EUROPE' && styles.gridBtnTextActive
                      ]}>
                        🇪🇺 EU Europe (Base High)
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Row 2: Bottom 2 buttons */}
                  <View style={styles.regionGridRow}>
                    {/* Button 3: Invert All TX <-> RX */}
                    <TouchableOpacity
                      style={[styles.gridBtn, styles.gridBtnInvert]}
                      onPress={handleInvertDuplexDirection}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.gridBtnInvertText}>⇄ INVERT ALL (TX ⇄ RX)</Text>
                    </TouchableOpacity>

                    {/* Button 4: Clear All / Reset */}
                    <TouchableOpacity
                      style={[styles.gridBtn, styles.gridBtnClear]}
                      onPress={handleClearAllZoneConfig}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.gridBtnClearText}>🗑 CLEAR ALL (RESET)</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* MODE 2: ZONE DISTANCE & IMD COUPLING MATRIX */}
          {topPanelMode === 'MATRIX' && (
            <View style={[styles.matrixContainer, {marginTop: 6}]}>
              <Text style={styles.matrixNotice}>
                PHYSICS RULE: Distances &lt; 26m automatically require full Intermod-Free calculation. Distances &ge; 26m ignore intermods between zones (co-channel &amp; adjacent channel spacing remain strictly enforced).
              </Text>

              {zones.length <= 1 ? (
                <Text style={styles.ledTextMuted}>ADD AT LEAST 2 ZONES TO CONFIGURE SPATIAL COUPLING.</Text>
              ) : (
                zones.map((zA, i) => 
                  zones.slice(i + 1).map(zB => {
                    const dist = getZoneDistance(zA.id, zB.id);
                    const isCoupled = isZoneCoupledStatus(zA.id, zB.id);
                    return (
                      <View key={`${zA.id}_${zB.id}`} style={styles.matrixRow}>
                        <View style={{flex: 1}}>
                          <Text style={styles.matrixZoneTitle}>{zA.name} &lt;-&gt; {zB.name}</Text>
                          <Text style={styles.matrixZoneSub}>
                            {dist < 26 ? '[!] Close Proximity (< 26m)' : ' Isolated Path (>= 26m)'}
                          </Text>
                        </View>

                        <View style={{alignItems: 'center', marginRight: 10}}>
                          <Text style={styles.inputLabel}>METERS</Text>
                          <TextInput 
                            style={[styles.ledInput, {width: 60, padding: 4}]} 
                            keyboardType="numeric" 
                            value={dist.toString()} 
                            onChangeText={(v) => setZoneDistance(zA.id, zB.id, v)} 
                          />
                        </View>

                        <TouchableOpacity 
                          style={[styles.matrixStatusBtn, isCoupled ? styles.matrixCoupled : styles.matrixIsolated]}
                          onPress={() => toggleZoneOverride(zA.id, zB.id)}
                        >
                          <Text style={styles.matrixStatusText}>{isCoupled ? 'IMD-COUPLED' : 'IMD-IGNORED'}</Text>
                          <Text style={styles.matrixStatusSub}>{isCoupled ? 'Full Intermod Free' : 'Fundamental Only'}</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })
                )
              )}
            </View>
          )}

          {/* MODE 3: 2D SPATIAL MAP / STAGE VISUALIZER WITH ZOOM CONTROLS */}
          {topPanelMode === 'MAP' && (
            <View style={styles.spatialContainer}>
              {/* Header with summary badges */}
              <View style={styles.spatialHeaderRow}>
                <Text style={styles.spatialTitle}>2D ARENA &amp; SPATIAL LAYOUT</Text>
                <View style={styles.spatialBadgeRow}>
                  {(() => {
                    let coupledPairsCount = 0;
                    zones.forEach((zA, idx) => {
                      zones.slice(idx + 1).forEach(zB => {
                        if (isZoneCoupledStatus(zA.id, zB.id)) coupledPairsCount++;
                      });
                    });
                    return coupledPairsCount > 0 ? (
                      <View style={[styles.spatialBadge, styles.spatialBadgeCoupled]}>
                        <Text style={[styles.spatialBadgeText, { color: '#f87171' }]}>
                          [!] {coupledPairsCount} COUPLED (&lt;26m)
                        </Text>
                      </View>
                    ) : (
                      <View style={[styles.spatialBadge, styles.spatialBadgeIsolated]}>
                        <Text style={[styles.spatialBadgeText, { color: '#34d399' }]}>
                           ALL ZONES ISOLATED
                        </Text>
                      </View>
                    );
                  })()}
                </View>
              </View>

              <Text style={[styles.matrixNotice, { marginBottom: 8 }]}>
                Position zone nodes across the {arenaWidth}m x {arenaLength}m venue. Define custom arena dimensions below and use the high-range zoom controls to inspect local antenna clusters or view the full facility.
              </Text>

              {/* ================= ARENA REAL-WORLD DIMENSIONS CONTROL BAR ================= */}
              <View style={styles.arenaDimPanel}>
                <View style={styles.arenaDimHeaderRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.arenaDimTitle}>VENUE DIMENSIONS (METERS):</Text>
                    <View style={styles.arenaDimBadge}>
                      <Text style={styles.arenaDimBadgeText}>{arenaWidth}m x {arenaLength}m ({Math.round(arenaWidth * arenaLength)} m2)</Text>
                    </View>
                  </View>
                  {/* Preset Venue Sizes */}
                  <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
                    {[
                      { label: '30x30m', w: 30, l: 30 },
                      { label: '60x60m (DEFAULT)', w: 60, l: 60 },
                      { label: '100x80m', w: 100, l: 80 },
                      { label: '200x150m', w: 200, l: 150 },
                      { label: '400x300m', w: 400, l: 300 },
                    ].map(preset => (
                      <TouchableOpacity
                        key={`dim_${preset.w}_${preset.l}`}
                        activeOpacity={0.75}
                        style={[
                          styles.dimPresetBtn,
                          arenaWidth === preset.w && arenaLength === preset.l && styles.dimPresetBtnActive
                        ]}
                        onPress={() => applyArenaDimensions(preset.w, preset.l)}
                      >
                        <Text style={[
                          styles.dimPresetText,
                          arenaWidth === preset.w && arenaLength === preset.l && styles.dimPresetTextActive
                        ]}>
                          {preset.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Custom Width & Length numeric steppers and inputs */}
                <View style={styles.arenaDimInputsRow}>
                  {/* WIDTH (X) */}
                  <View style={styles.dimInputGroup}>
                    <Text style={styles.dimInputLabel}>WIDTH (X):</Text>
                    <View style={styles.dimStepperBox}>
                      <TouchableOpacity
                        style={styles.dimStepperBtn}
                        onPress={() => applyArenaDimensions(arenaWidth - 10, arenaLength)}
                      >
                        <Text style={styles.dimStepperBtnText}>-10</Text>
                      </TouchableOpacity>
                      <TextInput
                        style={styles.dimTextInput}
                        value={arenaWidthInput}
                        keyboardType="numeric"
                        onChangeText={(t) => setArenaWidthInput(t)}
                        onBlur={() => {
                          const val = parseFloat(arenaWidthInput);
                          if (!isNaN(val) && val >= 10 && val <= 2000) {
                            applyArenaDimensions(val, arenaLength);
                          } else {
                            setArenaWidthInput(String(arenaWidth));
                          }
                        }}
                      />
                      <Text style={styles.dimUnitText}>m</Text>
                      <TouchableOpacity
                        style={styles.dimStepperBtn}
                        onPress={() => applyArenaDimensions(arenaWidth + 10, arenaLength)}
                      >
                        <Text style={styles.dimStepperBtnText}>+10</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* LENGTH (Y) */}
                  <View style={styles.dimInputGroup}>
                    <Text style={styles.dimInputLabel}>LENGTH (Y):</Text>
                    <View style={styles.dimStepperBox}>
                      <TouchableOpacity
                        style={styles.dimStepperBtn}
                        onPress={() => applyArenaDimensions(arenaWidth, arenaLength - 10)}
                      >
                        <Text style={styles.dimStepperBtnText}>-10</Text>
                      </TouchableOpacity>
                      <TextInput
                        style={styles.dimTextInput}
                        value={arenaLengthInput}
                        keyboardType="numeric"
                        onChangeText={(t) => setArenaLengthInput(t)}
                        onBlur={() => {
                          const val = parseFloat(arenaLengthInput);
                          if (!isNaN(val) && val >= 10 && val <= 2000) {
                            applyArenaDimensions(arenaWidth, val);
                          } else {
                            setArenaLengthInput(String(arenaLength));
                          }
                        }}
                      />
                      <Text style={styles.dimUnitText}>m</Text>
                      <TouchableOpacity
                        style={styles.dimStepperBtn}
                        onPress={() => applyArenaDimensions(arenaWidth, arenaLength + 10)}
                      >
                        <Text style={styles.dimStepperBtnText}>+10</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.dimApplyBtn}
                    onPress={() => {
                      const w = parseFloat(arenaWidthInput) || arenaWidth;
                      const l = parseFloat(arenaLengthInput) || arenaLength;
                      applyArenaDimensions(w, l);
                      showToast(`Venue set to ${Math.round(w)}m x ${Math.round(l)}m`, 'info');
                    }}
                  >
                    <Text style={styles.dimApplyBtnText}>SET VENUE</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.dimApplyBtn, { backgroundColor: '#0284c7' }]}
                    onPress={handleCenterAllZones}
                  >
                    <Text style={styles.dimApplyBtnText}>CENTER ZONES</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* ================= ARENA ZOOM & VIEWPORT CONTROLS BAR ================= */}
              <View style={styles.zoomControlPanel}>
                {/* Main Zoom In / Zoom Out Steppers */}
                <View style={styles.zoomMainSteppersRow}>
                  <View style={styles.zoomButtonGroup}>
                    <TouchableOpacity
                      activeOpacity={0.75}
                      style={[styles.zoomStepBtn, spatialZoom <= 0.05 && styles.zoomStepBtnDisabled]}
                      onPress={() => setSpatialZoom(prev => {
                        let next;
                        if (prev <= 0.2) next = prev - 0.025;
                        else if (prev <= 0.5) next = prev - 0.05;
                        else if (prev <= 1.5) next = prev - 0.15;
                        else next = prev - 0.5;
                        return Math.max(0.05, Math.round(next * 1000) / 1000);
                      })}
                    >
                      <Text style={styles.zoomStepBtnSymbol}>-</Text>
                      <Text style={styles.zoomStepBtnLabel}>ZOOM OUT</Text>
                    </TouchableOpacity>

                    {/* Digital Percentage Readout */}
                    <TouchableOpacity
                      activeOpacity={0.75}
                      style={styles.zoomDisplayBadge}
                      onPress={() => {
                        setSpatialZoom(0.85);
                        setSpatialPanOffset({ x: 0, y: 0 });
                      }}
                    >
                      <Text style={styles.zoomDisplaySub}>VIEW SCALE</Text>
                      <Text style={styles.zoomDisplayText}>{Math.round(spatialZoom * 100)}%</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.75}
                      style={[styles.zoomStepBtn, spatialZoom >= 8.0 && styles.zoomStepBtnDisabled]}
                      onPress={() => setSpatialZoom(prev => {
                        let next;
                        if (prev < 0.2) next = prev + 0.025;
                        else if (prev < 0.5) next = prev + 0.05;
                        else if (prev < 1.5) next = prev + 0.15;
                        else next = prev + 0.5;
                        return Math.min(8.0, Math.round(next * 1000) / 1000);
                      })}
                    >
                      <Text style={styles.zoomStepBtnSymbol}>+</Text>
                      <Text style={styles.zoomStepBtnLabel}>ZOOM IN</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Camera Reset & Focus Active Buttons */}
                  <View style={styles.zoomActionGroup}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={[
                        styles.zoomPresetPill, 
                        Math.abs(spatialZoom - 0.85) < 0.05 && spatialPanOffset.x === 0 && spatialPanOffset.y === 0 && styles.zoomPresetPillActive
                      ]}
                      onPress={() => {
                        const canvasH = 290;
                        const baseMarginRatio = 0.80;
                        const zX = (stageCanvasWidth * baseMarginRatio) / arenaWidth;
                        const zY = (canvasH * baseMarginRatio) / arenaLength;
                        const baseRef = (stageCanvasWidth * baseMarginRatio) / 60;
                        const fitZoom = Math.max(0.05, Math.min(4.0, Math.round((Math.min(zX, zY) / baseRef) * 0.9 * 100) / 100));
                        setSpatialZoom(fitZoom);
                        setSpatialPanOffset({ x: 0, y: 0 });
                      }}
                    >
                      <Text style={[
                        styles.zoomPresetPillText,
                        Math.abs(spatialZoom - 0.85) < 0.05 && spatialPanOffset.x === 0 && spatialPanOffset.y === 0 && styles.zoomPresetPillTextActive
                      ]}>
                        FIT ARENA
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={styles.zoomPresetPill}
                      onPress={handleCenterAllZones}
                    >
                      <Text style={styles.zoomPresetPillText}>🎯 CENTER ZONES</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={styles.zoomPresetPill}
                      onPress={() => {
                        const activePos = zonePositions[activeZoneId] || { x: arenaWidth / 2, y: arenaLength / 2 };
                        const sX = ((stageCanvasWidth * 0.8) / arenaWidth) * spatialZoom;
                        const sY = ((290 * 0.8) / arenaLength) * spatialZoom;
                        setSpatialPanOffset({
                          x: ((arenaWidth / 2) - activePos.x) * sX,
                          y: ((arenaLength / 2) - activePos.y) * sY,
                        });
                      }}
                    >
                      <Text style={styles.zoomPresetPillText}> FOCUS ACTIVE</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Quick Presets & Declutter Layer Toggles */}
                <View style={styles.zoomSubRow}>
                  {/* Preset Scale Chips */}
                  <View style={styles.zoomChipsRow}>
                    <Text style={styles.zoomChipsTitle}>PRESETS:</Text>
                    {[
                      { label: '10% (WIDE)', val: 0.1 },
                      { label: '25%', val: 0.25 },
                      { label: '50%', val: 0.5 },
                      { label: '85%', val: 0.85 },
                      { label: '100% (1:1)', val: 1.0 },
                      { label: '200%', val: 2.0 },
                      { label: '400%', val: 4.0 },
                      { label: '800% (CLOSE)', val: 8.0 },
                    ].map((preset) => (
                      <TouchableOpacity
                        key={`preset_${preset.val}`}
                        activeOpacity={0.75}
                        style={[
                          styles.zoomChipBtn,
                          Math.abs(spatialZoom - preset.val) < 0.04 && styles.zoomChipBtnActive
                        ]}
                        onPress={() => {
                          setSpatialZoom(preset.val);
                          setSpatialPanOffset({ x: 0, y: 0 });
                        }}
                      >
                        <Text style={[
                          styles.zoomChipBtnText,
                          Math.abs(spatialZoom - preset.val) < 0.04 && styles.zoomChipBtnTextActive
                        ]}>
                          {preset.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Visual Filter Toggles to declutter screen */}
                  <View style={styles.layerTogglesRow}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={[styles.layerToggleBtn, showRadiusBubbles && styles.layerToggleBtnActive]}
                      onPress={() => setShowRadiusBubbles(!showRadiusBubbles)}
                    >
                      <Text style={[styles.layerToggleText, showRadiusBubbles && styles.layerToggleTextActive]}>
                        {showRadiusBubbles ? '* 26m AURAS: ON' : 'o 26m AURAS: OFF'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={[styles.layerToggleBtn, showCouplingLines && styles.layerToggleBtnActive]}
                      onPress={() => setShowCouplingLines(!showCouplingLines)}
                    >
                      <Text style={[styles.layerToggleText, showCouplingLines && styles.layerToggleTextActive]}>
                        {showCouplingLines ? '* LINKS: ON' : 'o LINKS: OFF'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Pan D-Pad Navigator for moving arena view */}
                <View style={styles.panNavRow}>
                  <Text style={styles.panNavTitle}>VIEWPORT PAN:</Text>
                  <View style={styles.panDpadBox}>
                    <TouchableOpacity
                      style={styles.panDpadBtn}
                      onPress={() => setSpatialPanOffset(p => ({ ...p, x: p.x + 40 }))}
                    >
                      <Text style={styles.panDpadText}>&lt;</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.panDpadBtn}
                      onPress={() => setSpatialPanOffset(p => ({ ...p, y: p.y + 30 }))}
                    >
                      <Text style={styles.panDpadText}>^</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.panDpadBtn}
                      onPress={() => setSpatialPanOffset(p => ({ ...p, y: p.y - 30 }))}
                    >
                      <Text style={styles.panDpadText}>v</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.panDpadBtn}
                      onPress={() => setSpatialPanOffset(p => ({ ...p, x: p.x - 40 }))}
                    >
                      <Text style={styles.panDpadText}>&gt;</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.panDpadBtn, { backgroundColor: '#0284c7', width: 'auto', paddingHorizontal: 6 }]}
                      onPress={() => setSpatialPanOffset({ x: 0, y: 0 })}
                    >
                      <Text style={[styles.panDpadText, { color: '#fff' }]}>o CENTER</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* 2D Arena Canvas (User Defined arenaWidth x arenaLength with Zoom Transform) */}
              <View 
                style={styles.spatialCanvasContainer}
                onLayout={(e) => {
                  const w = e.nativeEvent.layout.width;
                  if (w > 50) setStageCanvasWidth(w);
                }}
              >
                {(() => {
                  const stageW = arenaWidth; // User-defined arena width (meters)
                  const stageH = arenaLength; // User-defined arena length/depth (meters)
                  const canvasH = 290;
                  
                  // Base scaling with margin ratio to allow 26m radius bubbles to fit cleanly in viewport
                  const baseMarginRatio = 0.80;
                  const scaleX = ((stageCanvasWidth * baseMarginRatio) / stageW) * spatialZoom;
                  const scaleY = ((canvasH * baseMarginRatio) / stageH) * spatialZoom;
                  
                  const centerX = (stageCanvasWidth / 2) + spatialPanOffset.x;
                  const centerY = (canvasH / 2) + spatialPanOffset.y;

                  const deckX = centerX - (stageW / 2) * scaleX;
                  const deckY = centerY - (stageH / 2) * scaleY;
                  const deckW = stageW * scaleX;
                  const deckH = stageH * scaleY;

                  const radius26PxX = 26 * scaleX;
                  const radius26PxY = 26 * scaleY;

                  // Zone colors palette
                  const zoneColorPalette = ['#38bdf8', '#f59e0b', '#a855f7', '#ec4899', '#10b981', '#06b6d4'];

                  // Calculate suitable grid interval based on arena scale
                  const maxDim = Math.max(arenaWidth, arenaLength);
                  let gridStep = 10;
                  if (maxDim <= 40) gridStep = 5;
                  else if (maxDim <= 100) gridStep = 10;
                  else if (maxDim <= 250) gridStep = 25;
                  else if (maxDim <= 500) gridStep = 50;
                  else gridStep = 100;

                  const xTicks: number[] = [];
                  for (let x = gridStep; x < arenaWidth; x += gridStep) xTicks.push(x);
                  const yTicks: number[] = [];
                  for (let y = gridStep; y < arenaLength; y += gridStep) yTicks.push(y);

                  return (
                    <Svg width="100%" height={canvasH}>
                      {/* Background Arena Container */}
                      <Rect x="0" y="0" width="100%" height={canvasH} fill="#05080e" />

                      {/* Surrounding Arena Outer Buffer Boundary */}
                      <Rect
                        x={deckX - 10 * scaleX}
                        y={deckY - 10 * scaleY}
                        width={deckW + 20 * scaleX}
                        height={deckH + 20 * scaleY}
                        fill="#090d15"
                        stroke="#141c2b"
                        strokeWidth="1"
                        strokeDasharray="4, 4"
                      />

                      {/* Main Arena Floor Boundary */}
                      <Rect 
                        x={deckX} 
                        y={deckY} 
                        width={deckW} 
                        height={deckH} 
                        fill="#0c121d" 
                        stroke="#26354a" 
                        strokeWidth="1.5" 
                      />

                      {/* Arena Boundary Corner Tags */}
                      <SvgText x={deckX + 4} y={deckY + 11} fill="#3b4d66" fontSize="8" fontFamily="monospace">0,0m</SvgText>
                      <SvgText x={deckX + deckW - 36} y={deckY + 11} fill="#3b4d66" fontSize="8" fontFamily="monospace">{arenaWidth},0m</SvgText>
                      <SvgText x={deckX + 4} y={deckY + deckH - 4} fill="#3b4d66" fontSize="8" fontFamily="monospace">0,{arenaLength}m</SvgText>
                      <SvgText x={deckX + deckW - 44} y={deckY + deckH - 4} fill="#3b4d66" fontSize="8" fontFamily="monospace">{arenaWidth},{arenaLength}m</SvgText>

                      {/* Dynamic Graticule Grid Lines (Vertical) */}
                      {xTicks.map((mX) => {
                        const gx = deckX + mX * scaleX;
                        return (
                          <G key={`gridX_${mX}`}>
                            <Line
                              x1={gx}
                              y1={deckY}
                              x2={gx}
                              y2={deckY + deckH}
                              stroke="#1a2538"
                              strokeWidth="1"
                              strokeDasharray="3, 3"
                            />
                            <SvgText
                              x={gx}
                              y={deckY + deckH + 9}
                              fill="#475569"
                              fontSize="7.5"
                              textAnchor="middle"
                              fontFamily="monospace"
                            >
                              {mX}m
                            </SvgText>
                          </G>
                        );
                      })}

                      {/* Dynamic Graticule Grid Lines (Horizontal) */}
                      {yTicks.map((mY) => {
                        const gy = deckY + mY * scaleY;
                        return (
                          <G key={`gridY_${mY}`}>
                            <Line
                              x1={deckX}
                              y1={gy}
                              x2={deckX + deckW}
                              y2={gy}
                              stroke="#1a2538"
                              strokeWidth="1"
                              strokeDasharray="3, 3"
                            />
                            <SvgText
                              x={deckX - 4}
                              y={gy + 3}
                              fill="#475569"
                              fontSize="7.5"
                              textAnchor="end"
                              fontFamily="monospace"
                            >
                              {mY}m
                            </SvgText>
                          </G>
                        );
                      })}

                      {/* Coupling Lines Between Zones (if enabled) */}
                      {showCouplingLines && zones.map((zA, i) =>
                        zones.slice(i + 1).map(zB => {
                          const posA = zonePositions[zA.id] || { x: 30, y: 15 };
                          const posB = zonePositions[zB.id] || { x: 30, y: 25 };
                          const isCoupled = isZoneCoupledStatus(zA.id, zB.id);
                          const dist = getZoneDistance(zA.id, zB.id);

                          const x1 = deckX + posA.x * scaleX;
                          const y1 = deckY + posA.y * scaleY;
                          const x2 = deckX + posB.x * scaleX;
                          const y2 = deckY + posB.y * scaleY;
                          const midX = (x1 + x2) / 2;
                          const midY = (y1 + y2) / 2;

                          return (
                            <G key={`line_${zA.id}_${zB.id}`}>
                              <Line
                                x1={x1}
                                y1={y1}
                                x2={x2}
                                y2={y2}
                                stroke={isCoupled ? '#ef4444' : '#10b981'}
                                strokeWidth={isCoupled ? 2 : 1}
                                strokeDasharray={isCoupled ? 'none' : '4, 4'}
                                opacity={isCoupled ? 0.95 : 0.4}
                              />
                              {/* Distance badge in center of line */}
                              <Rect
                                x={midX - 22}
                                y={midY - 8}
                                width={44}
                                height={16}
                                rx={3}
                                fill="#0f172a"
                                stroke={isCoupled ? '#ef4444' : '#10b981'}
                                strokeWidth={1}
                              />
                              <SvgText
                                x={midX}
                                y={midY + 3.5}
                                fill={isCoupled ? '#fca5a5' : '#86efac'}
                                fontSize="8"
                                fontWeight="bold"
                                textAnchor="middle"
                              >
                                {dist}m {isCoupled ? '' : ''}
                              </SvgText>
                            </G>
                          );
                        })
                      )}

                      {/* 26-Meter Isolation Bubbles around each Zone Node (if enabled) */}
                      {showRadiusBubbles && zones.map((z, idx) => {
                        const pos = zonePositions[z.id] || { x: 30, y: 20 };
                        const cx = deckX + pos.x * scaleX;
                        const cy = deckY + pos.y * scaleY;

                        // Check if this zone is coupled with ANY other zone
                        const hasAnyOverlap = zones.some(
                          other => other.id !== z.id && isZoneCoupledStatus(z.id, other.id)
                        );

                        return (
                          <G key={`bubble_${z.id}`}>
                            {/* 26m Physical Radius Aura */}
                            <Circle
                              cx={cx}
                              cy={cy}
                              r={radius26PxX}
                              fill={hasAnyOverlap ? 'rgba(239, 68, 68, 0.08)' : 'rgba(52, 211, 153, 0.05)'}
                              stroke={hasAnyOverlap ? '#ef4444' : '#10b981'}
                              strokeWidth={hasAnyOverlap ? 1.5 : 1}
                              strokeDasharray={hasAnyOverlap ? '6, 3' : '3, 3'}
                              opacity={0.85}
                            />

                            {/* Radius label */}
                            <SvgText
                              x={cx}
                              y={cy + radius26PxY - 4}
                              fill={hasAnyOverlap ? '#ef4444' : '#34d399'}
                              fontSize={Math.max(7, 7.5 * Math.min(1.2, spatialZoom))}
                              textAnchor="middle"
                              opacity={0.7}
                            >
                              26m radius
                            </SvgText>
                          </G>
                        );
                      })}

                      {/* Zone Node Icons / Pins */}
                      {zones.map((z, idx) => {
                        const pos = zonePositions[z.id] || { x: 30, y: 20 };
                        const cx = deckX + pos.x * scaleX;
                        const cy = deckY + pos.y * scaleY;
                        const isActive = z.id === activeZoneId;
                        
                        // Smart Zone Number Extraction matching exact zone designation
                        const zoneNumMatch = (z.name || '').match(/\d+/);
                        const zoneNum = zoneNumMatch ? parseInt(zoneNumMatch[0], 10) : (idx + 1);
                        const zoneDisplayNum = zoneNumMatch ? zoneNumMatch[0] : `${idx + 1}`;
                        const zoneColor = zoneColorPalette[(zoneNum - 1) % zoneColorPalette.length] || zoneColorPalette[idx % zoneColorPalette.length];
                        const pinRadius = Math.max(10, Math.min(15, 12 * Math.sqrt(spatialZoom)));

                        return (
                          <G 
                            key={`node_${z.id}`}
                            onPress={() => setActiveZoneId(z.id)}
                          >
                            {/* Outer Glow Ring for active zone */}
                            {isActive && (
                              <Circle
                                cx={cx}
                                cy={cy}
                                r={pinRadius + 6}
                                fill="none"
                                stroke="#38bdf8"
                                strokeWidth={2}
                                strokeDasharray="3, 2"
                              />
                            )}

                            {/* Core Zone Disc with Zone Designation Number (1, 3, 4, 6...) */}
                            <Circle
                              cx={cx}
                              cy={cy}
                              r={pinRadius}
                              fill={zoneColor}
                              stroke="#0f172a"
                              strokeWidth={2}
                            />

                            {/* Zone Number inside circle matching actual zone designation */}
                            <SvgText
                              x={cx}
                              y={cy + 3.8}
                              fill="#090d16"
                              fontSize={Math.max(9, 10 * Math.min(1.2, spatialZoom))}
                              fontWeight="bold"
                              textAnchor="middle"
                            >
                              {zoneDisplayNum}
                            </SvgText>

                            {/* Zone Label underneath pin */}
                            <SvgText
                              x={cx}
                              y={cy + pinRadius + 11}
                              fill={isActive ? '#38bdf8' : '#cbd5e1'}
                              fontSize={Math.max(7.5, 8.5 * Math.min(1.1, spatialZoom))}
                              fontWeight={isActive ? 'bold' : '600'}
                              textAnchor="middle"
                            >
                              {z.name}
                            </SvgText>
                          </G>
                        );
                      })}
                    </Svg>
                  );
                })()}
              </View>

              {/* Spatial Map Legend Bar */}
              <View style={styles.spatialLegendBar}>
                <View style={styles.spatialLegendItem}>
                  <View style={[styles.spatialLegendDot, { backgroundColor: '#ef4444' }]} />
                  <Text style={styles.spatialLegendText}>Overlap &lt;26m (IMD Coupling Active)</Text>
                </View>
                <View style={styles.spatialLegendItem}>
                  <View style={[styles.spatialLegendDot, { backgroundColor: '#10b981' }]} />
                  <Text style={styles.spatialLegendText}>Spacing &ge;26m (IMD Path Isolated)</Text>
                </View>
                <View style={styles.spatialLegendItem}>
                  <Text style={[styles.spatialLegendText, { color: '#38bdf8' }]}>
                    Grid: {Math.max(arenaWidth, arenaLength) <= 40 ? '5m' : Math.max(arenaWidth, arenaLength) <= 100 ? '10m' : Math.max(arenaWidth, arenaLength) <= 250 ? '25m' : Math.max(arenaWidth, arenaLength) <= 500 ? '50m' : '100m'} intervals
                  </Text>
                </View>
              </View>

              {/* Zone Position Coordinates & Nudge Steppers */}
              <View style={styles.spatialZoneCardList}>
                {zones.map((z, idx) => {
                  const pos = zonePositions[z.id] || { x: 30, y: 15 };
                  const isActive = z.id === activeZoneId;
                  const zoneNumMatch = (z.name || '').match(/\d+/);
                  const zoneNum = zoneNumMatch ? parseInt(zoneNumMatch[0], 10) : (idx + 1);
                  const colors = ['#38bdf8', '#f59e0b', '#a855f7', '#ec4899', '#10b981', '#06b6d4'];
                  const zColor = colors[(zoneNum - 1) % colors.length] || colors[idx % colors.length];

                  return (
                    <TouchableOpacity
                      key={`card_${z.id}`}
                      activeOpacity={0.85}
                      style={[styles.spatialZoneCard, isActive && styles.spatialZoneCardActive]}
                      onPress={() => setActiveZoneId(z.id)}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={[styles.dotBadge, { backgroundColor: zColor }]} />
                        <View>
                          <Text style={[styles.spatialZoneName, isActive && { color: '#34d399' }]}>
                            {z.name} {isActive ? '* [ACTIVE]' : ''}
                          </Text>
                          <Text style={styles.spatialZoneCoord}>
                            Position: X: {pos.x}m, Y: {pos.y}m (Arena: {arenaWidth}x{arenaLength}m)
                          </Text>
                        </View>
                      </View>

                      {/* Interactive Nudge Controls */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <TouchableOpacity
                          style={styles.spatialNudgeBtn}
                          onPress={() => updateZonePosition(z.id, pos.x - 2, pos.y)}
                        >
                          <Text style={styles.spatialNudgeText}>&lt;</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.spatialNudgeBtn}
                          onPress={() => updateZonePosition(z.id, pos.x + 2, pos.y)}
                        >
                          <Text style={styles.spatialNudgeText}>&gt;</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.spatialNudgeBtn}
                          onPress={() => updateZonePosition(z.id, pos.x, pos.y - 2)}
                        >
                          <Text style={styles.spatialNudgeText}>^</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.spatialNudgeBtn}
                          onPress={() => updateZonePosition(z.id, pos.x, pos.y + 2)}
                        >
                          <Text style={styles.spatialNudgeText}>v</Text>
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* MODE 4: REAL-TIME PTT KEY-UP & STRESS SIMULATOR */}
          {topPanelMode === 'PTT_SIM' && (
            <PttSimulator
              channels={pttChannels}
              onToggleKey={(idx) => {
                setKeyedChannels(prev => ({ ...prev, [idx]: !prev[idx] }));
              }}
              onKeyAll={() => {
                const allKeyed: Record<number, boolean> = {};
                pttChannels.forEach(c => { allKeyed[c.index] = true; });
                setKeyedChannels(allKeyed);
              }}
              onReleaseAll={() => {
                setKeyedChannels({});
              }}
              isStressTesting={isStressTesting}
              onToggleStressTest={() => setIsStressTesting(prev => !prev)}
              activeZoneName={activeZone.name}
              liveImdClashes={livePttClashes}
            />
          )}

          {/* MODE 5: TALKBACK IMD COMPATIBILITY INSPECTOR */}

          {topPanelMode === 'IMD_PLAYGROUND' && (
            <View style={{ marginTop: 10, borderRadius: 10, overflow: 'hidden' }}>
              <ImdTalkbackInspector
                initialFrequencies={imdInspectorFreqs}
                onFrequenciesChange={(freqs) => {
                  setImdInspectorFreqs(freqs);
                }}
              />
            </View>
          )}



          {/* ACTION BUTTONS */}
          <View style={{flexDirection: 'row', gap: 8, marginTop: 14}}>
            <TouchableOpacity style={[styles.hardwareBtnMain, {flex: 2}]} onPress={handleCoordinateAll}>
              <Text style={styles.hardwareBtnText}>CALCULATE</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, {flex: 1, backgroundColor: '#334155'}]} onPress={handleClearUnlocked}>
              <Text style={styles.actionBtnText}>CLEAR UNLOCKED</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ================= BOTTOM PANEL: LEDGER & PROFILES ================= */}
        <View style={styles.hardwarePanel}>
          <Screw top={6} left={6} /><Screw top={6} right={6} />
          
          {/* ================= TACTILE SHADOW ZONE SELECTOR BUTTONS & PROFILES ================= */}
          <View style={styles.ledgerZoneBarContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ledgerZoneScrollContent}>
              {zones.map((z, idx) => {
                const zoneCount = generatedPlan.filter(p => p.zoneId === z.id).length;
                const isSelected = ledgerView === 'PLAN' && (ledgerZoneFilter === z.id || (ledgerZoneFilter === 'ACTIVE' && z.id === activeZoneId));
                const zoneNumMatch = (z.name || '').match(/\d+/);
                const shortLabel = zoneNumMatch ? `Z${zoneNumMatch[0]}` : (z.name.startsWith('ZONE') ? z.name.replace('ZONE', 'Z').trim() : z.name);

                return (
                  <TouchableOpacity
                    key={`ledger-tactile-zone-${z.id}`}
                    style={[styles.tactileShadowZoneBtn, isSelected && styles.tactileShadowZoneBtnActive]}
                    onPress={() => {
                      setActiveZoneId(z.id);
                      setLedgerZoneFilter(z.id);
                      setLedgerView('PLAN');
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.tactileShadowZoneBtnText, isSelected && styles.tactileShadowZoneBtnTextActive]}>
                      {shortLabel}
                    </Text>
                    <View style={[styles.tactileCountPill, isSelected && styles.tactileCountPillActive]}>
                      <Text style={[styles.tactileCountPillText, isSelected && styles.tactileCountPillTextActive]}>
                        {zoneCount}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}

              {/* ALL ZONES BUTTON */}
              <TouchableOpacity
                style={[
                  styles.tactileShadowZoneBtn,
                  ledgerView === 'PLAN' && ledgerZoneFilter === 'ALL' && styles.tactileShadowZoneBtnActive
                ]}
                onPress={() => {
                  setLedgerZoneFilter('ALL');
                  setLedgerView('PLAN');
                }}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.tactileShadowZoneBtnText,
                  ledgerView === 'PLAN' && ledgerZoneFilter === 'ALL' && styles.tactileShadowZoneBtnTextActive
                ]}>
                  ALL
                </Text>
                <View style={[
                  styles.tactileCountPill,
                  ledgerView === 'PLAN' && ledgerZoneFilter === 'ALL' && styles.tactileCountPillActive
                ]}>
                  <Text style={[
                    styles.tactileCountPillText,
                    ledgerView === 'PLAN' && ledgerZoneFilter === 'ALL' && styles.tactileCountPillTextActive
                  ]}>
                    {generatedPlan.length}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* PROFILES BUTTON */}
              <TouchableOpacity
                style={[
                  styles.tactileShadowZoneBtn,
                  ledgerView === 'PROFILES' && styles.tactileShadowZoneBtnProfilesActive
                ]}
                onPress={() => {
                  setLedgerView('PROFILES');
                }}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.tactileShadowZoneBtnText,
                  ledgerView === 'PROFILES' && styles.tactileShadowZoneBtnTextActive
                ]}>
                  PROFILES
                </Text>
                <View style={[
                  styles.tactileCountPill,
                  ledgerView === 'PROFILES' && styles.tactileCountPillActive
                ]}>
                  <Text style={[
                    styles.tactileCountPillText,
                    ledgerView === 'PROFILES' && styles.tactileCountPillTextActive
                  ]}>
                    {savedProfiles.length}
                  </Text>
                </View>
              </TouchableOpacity>
            </ScrollView>
          </View>

          <View style={styles.ledgerScreen}>
            {ledgerView === 'PLAN' && (() => {
              const isAllZones = ledgerZoneFilter === 'ALL';
              const targetZoneId = (!isAllZones && ledgerZoneFilter !== 'ACTIVE') ? ledgerZoneFilter : activeZoneId;
              const currentDisplayZone = zones.find(z => z.id === targetZoneId) || activeZone;
              const displayItems = generatedPlan.filter(p => isAllZones || p.zoneId === targetZoneId);

              return (
                <View>
                    {/* Active Zone Status Header Inside Ledger Card */}
                    <View style={styles.ledgerZoneStatusRow}>
                      <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
                        <View style={[styles.statusDot, { backgroundColor: isAllZones ? '#f59e0b' : '#38bdf8' }]} />
                        <Text style={styles.ledgerZoneStatusTitle}>
                          {isAllZones ? 'ALL ZONES COMBINED' : currentDisplayZone.name.toUpperCase()}
                        </Text>
                      </View>

                      {/* Step size selection box in title area */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <Text style={{ color: '#94a3b8', fontSize: 8, fontWeight: 'bold' }}>STEP:</Text>
                        {[
                          { label: '6.25k', val: '6.25' },
                          { label: '12.5k', val: '12.5' },
                          { label: '25k', val: '25' },
                          { label: '50k', val: '50' },
                          { label: '100k', val: '100' }
                        ].map(s => (
                          <TouchableOpacity
                            key={`zone_step_${s.val}`}
                            style={[
                              styles.zoneStepPill,
                              nudgeStepStr === s.val && styles.zoneStepPillActive
                            ]}
                            onPress={() => setNudgeStepStr(s.val)}
                            activeOpacity={0.7}
                          >
                            <Text style={[
                              styles.zoneStepPillText,
                              nudgeStepStr === s.val && styles.zoneStepPillTextActive
                            ]}>
                              {s.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      <Text style={styles.ledgerZoneStatusCount}>
                        {displayItems.length} {displayItems.length === 1 ? 'CHANNEL' : 'CHANNELS'}
                      </Text>
                    </View>

                    <View style={styles.ledgerHeaderRow}>
                        {isAllZones && <Text style={[styles.colHeader, {width: 20, textAlign: 'center'}]}>ZN</Text>}
                        <Text style={[styles.colHeader, {width: 20, textAlign: 'center', marginRight: 3}]}>#</Text>
                        <View style={{width: 20, marginRight: 3}} />
                        <Text style={[styles.colHeader, {width: 27, textAlign: 'center'}]}>TYPE</Text>
                        <Text style={[styles.colHeader, {flex: 1, textAlign: 'center'}]}>BASE TX</Text>
                        <Text style={[styles.colHeader, {flex: 1, textAlign: 'center'}]}>PORT TX</Text>
                        <Text style={[styles.colHeader, {width: 24, textAlign: 'center'}]}>DEL</Text>
                    </View>

                    {displayItems.length === 0 ? (
                      <Text style={styles.ledTextMuted}>
                        {isAllZones 
                          ? 'NO CHANNELS GENERATED FOR ANY ZONE YET. TAP CALCULATE.' 
                          : `NO CHANNELS FOR ${currentDisplayZone.name.toUpperCase()} YET. TAP CALCULATE.`}
                      </Text>
                    ) : (
                      generatedPlan.map((item, index) => {
                          if (!isAllZones && item.zoneId !== targetZoneId) return null;
                          const itemZone = zones.find(z => z.id === item.zoneId);
                          const itemZoneMatch = (itemZone?.name || '').match(/\d+/);
                          const itemZoneTag = itemZoneMatch ? `Z${itemZoneMatch[0]}` : (itemZone ? (itemZone.name.startsWith('ZONE') ? itemZone.name.replace('ZONE', 'Z').trim() : itemZone.name) : 'ZN');
                          const isSimplex = item.isSimplex;
                          const isBase = item.simplexType === 'base_tx';
                          const typeBadgeText = !isSimplex ? 'DUP' : (isBase ? 'IFB' : 'WT');
                          const typeBadgeBg = !isSimplex ? '#334155' : (isBase ? '#0e7490' : '#c2410c');
                          const txColor = item.locked ? '#4ade80' : (!isSimplex ? '#facc15' : (isBase ? '#38bdf8' : '#fb923c'));

                          const hasClash = !!activeZonePlanCollisions[index];
                          const rowBg = hasClash ? 'rgba(239, 68, 68, 0.12)' : 'transparent';
                          const clashBorder = hasClash ? '#ef4444' : '#1e293b';

                          return (
                              <View key={`plan-${index}`} style={{marginBottom: 6}}>
                                <View style={[styles.ledgerRow, { alignItems: 'flex-start', backgroundColor: rowBg, borderColor: clashBorder, borderWidth: hasClash ? 1 : 0 }]}>
                                  {isAllZones && (
                                    <View style={styles.zoneRowBadge}>
                                      <Text style={styles.zoneRowBadgeText}>{itemZoneTag}</Text>
                                    </View>
                                  )}

                                  {/* CHANNEL NUMBER BADGE (matches spike number on spectrum canvas) */}
                                  <View style={styles.channelNumBadge}>
                                    <Text style={styles.channelNumBadgeText}>{index + 1}</Text>
                                  </View>
                                  
                                  {/* PADLOCK LOCK / UNLOCK TOGGLE */}
                                  <TouchableOpacity 
                                    onPress={() => toggleLock(index)} 
                                    style={{width: 20, paddingTop: 5, alignItems: 'center', justifyContent: 'center', marginRight: 3}}
                                    hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                                    activeOpacity={0.6}
                                  >
                                      <HardwarePadlockIcon locked={!!item.locked} size={16} />
                                  </TouchableOpacity>
                                  
                                  {/* NARROWED TYPE BADGE */}
                                  <View style={[styles.typeBadge, {backgroundColor: hasClash ? '#ef4444' : typeBadgeBg}]}>
                                      <Text style={styles.typeBadgeText}>{hasClash ? 'CLS' : typeBadgeText}</Text>
                                  </View>

                                  {/* WIDENED BASE TX FREQ (COMPLETELY ACCOMMODATES ALL DIGITS) */}
                                  <View style={{flex: 1, marginRight: 4}}>
                                      <TouchableOpacity 
                                          activeOpacity={0.8}
                                          style={[
                                              styles.ledInputMuted, 
                                              {color: hasClash ? '#ef4444' : txColor, fontSize: 12, justifyContent: 'center', height: 26},
                                              zoneKeypadTarget === `ch::${index}::txStr` && styles.compactInputActive
                                          ]} 
                                          onPress={() => setZoneKeypadTarget(`ch::${index}::txStr`)}
                                      >
                                          <Text style={{color: hasClash ? '#ef4444' : txColor, fontSize: 12, fontWeight: 'bold', textAlign: 'center'}}>
                                              {`${item.txStr}${zoneKeypadTarget === `ch::${index}::txStr` ? ' ▎' : ''}`}
                                          </Text>
                                      </TouchableOpacity>
                                      <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 4}}>
                                          <TouchableOpacity style={styles.microBtn} onPress={() => nudgeFreq(index, -1, 'tx')}><Text style={styles.microBtnText}>-</Text></TouchableOpacity>
                                          <TouchableOpacity style={styles.microBtn} onPress={() => nudgeFreq(index, 1, 'tx')}><Text style={styles.microBtnText}>+</Text></TouchableOpacity>
                                      </View>
                                  </View>

                                  {/* WIDENED PORTABLE TX FREQ (COMPLETELY ACCOMMODATES ALL DIGITS) */}
                                  <View style={{flex: 1, marginRight: 4}}>
                                      {!isSimplex ? (
                                          <>
                                              <TouchableOpacity 
                                                  activeOpacity={0.8}
                                                  style={[
                                                      styles.ledInputMuted, 
                                                      {color: hasClash ? '#ef4444' : (item.locked ? '#4ade80' : '#38bdf8'), fontSize: 12, justifyContent: 'center', height: 26},
                                                      zoneKeypadTarget === `ch::${index}::rxStr` && styles.compactInputActive
                                                  ]} 
                                                  onPress={() => setZoneKeypadTarget(`ch::${index}::rxStr`)}
                                              >
                                                  <Text style={{color: hasClash ? '#ef4444' : (item.locked ? '#4ade80' : '#38bdf8'), fontSize: 12, fontWeight: 'bold', textAlign: 'center'}}>
                                                      {`${item.rxStr}${zoneKeypadTarget === `ch::${index}::rxStr` ? ' ▎' : ''}`}
                                                  </Text>
                                              </TouchableOpacity>
                                              <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 4}}>
                                                  <TouchableOpacity style={styles.microBtn} onPress={() => nudgeFreq(index, -1, 'rx')}><Text style={styles.microBtnText}>-</Text></TouchableOpacity>
                                                  <TouchableOpacity style={styles.microBtn} onPress={() => nudgeFreq(index, 1, 'rx')}><Text style={styles.microBtnText}>+</Text></TouchableOpacity>
                                              </View>
                                          </>
                                      ) : (
                                          <View style={styles.simplexPlaceholder}>
                                              <Text style={styles.simplexPlaceholderText}>SIMPLEX</Text>
                                          </View>
                                      )}
                                  </View>

                                  {/* DELETE */}
                                  <View style={{width: 24, marginTop: 4, alignItems: 'center'}}>
                                      <TouchableOpacity style={[styles.microBtn, {width: 22, height: 22, backgroundColor: '#7a1919', borderColor: '#e85f5f'}]} onPress={() => deleteItem(index)}>
                                        <Text style={[styles.microBtnText, {fontSize: 9}]}>x</Text>
                                      </TouchableOpacity>
                                  </View>
                                </View>
                                {hasClash && (
                                  <View style={styles.ledgerClashWarningRow}>
                                    <Text style={styles.ledgerClashWarningText}>
                                      [!] {activeZonePlanCollisions[index].reason.toUpperCase()}
                                    </Text>
                                  </View>
                                )}
                              </View>
                          );
                      })
                    )}
                </View>
              );
            })()}

            {ledgerView === 'PROFILES' && (
                <View>
                    <View style={{flexDirection: 'row', marginBottom: 15}}>
                        <TextInput 
                          style={[styles.ledInputMuted, {flex: 1, marginRight: 10, fontSize: 13, textAlign: 'left', paddingHorizontal: 10}]} 
                          placeholder="Enter Show / Profile Name..." 
                          placeholderTextColor="#556" 
                          value={profileName} 
                          onChangeText={setProfileName} 
                        />
                        <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#4ade80', borderColor: '#86efac'}]} onPress={saveCurrentProfile}>
                          <Text style={[styles.actionBtnText, {color: '#000'}]}>SAVE STATE</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity style={[styles.hardwareBtnMain, {backgroundColor: '#0284c7', borderTopColor: '#38bdf8', borderBottomColor: '#0369a1', marginBottom: 15}]} onPress={sharePlan}>
                        <Text style={styles.hardwareBtnText}> EXPORT ALL ZONES TO TEXT</Text>
                    </TouchableOpacity>

                    <Text style={styles.colHeader}>SAVED MULTI-ZONE SHOWS</Text>
                    {savedProfiles.length === 0 ? (
                      <Text style={styles.ledTextMuted}>NO PROFILES SAVED YET</Text>
                    ) : (
                     savedProfiles.map(name => (
                        <View key={name} style={[styles.ledgerRow, {marginTop: 8, paddingBottom: 8, borderBottomWidth: 1, borderColor: '#1e3036'}]}>
                            <Text style={[styles.ledTextGreen, {flex: 1, fontSize: 13}]}>{name}</Text>
                            <TouchableOpacity style={[styles.actionBtn, {marginRight: 8, backgroundColor: '#1e293b'}]} onPress={() => loadProfile(name)}>
                              <Text style={styles.actionBtnText}>LOAD</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#7a1919', borderColor: '#b91c1c'}]} onPress={() => deleteProfile(name)}>
                              <Text style={styles.actionBtnText}>DEL</Text>
                            </TouchableOpacity>
                        </View>
                      ))
                    )}
                </View>
            )}
          </View>
        </View>

        {/* ================= PRESET PICKER & BESPOKE CREATOR MODAL ================= */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={presetModalVisible}
          onRequestClose={() => setPresetModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Screw top={6} left={6} /><Screw top={6} right={6} /><Screw bottom={6} left={6} /><Screw bottom={6} right={6} />

              {/* Modal Header */}
              <View style={styles.modalHeaderRow}>
                <View style={{flex: 1}}>
                  <Text style={styles.modalTitle}>
                    {presetTarget?.type === 'duplex' ? 'DUPLEX TALKBACK PRESETS' : (presetTarget?.type === 'base_tx' ? 'BASE TX / IFB PRESETS' : 'WALKIE-TALKIE PRESETS')}
                  </Text>
                  <Text style={styles.modalSubtitle}>
                    {presetTarget?.bandId ? 'Configure Selected Band' : '+ Add New Band with Preset'}
                  </Text>
                </View>
                <TouchableOpacity 
                  style={styles.modalCloseBtn} 
                  onPress={() => setPresetModalVisible(false)}
                >
                  <Text style={styles.modalCloseBtnText}>x</Text>
                </TouchableOpacity>
              </View>

              {/* Segment Tabs: UK OFCOM vs BESPOKE */}
              <View style={styles.modalTabRow}>
                <TouchableOpacity 
                  style={[styles.modalTabBtn, presetTab === 'UK_OFCOM' && styles.modalTabBtnActive]} 
                  onPress={() => setPresetTab('UK_OFCOM')}
                >
                  <Text style={[styles.modalTabBtnText, presetTab === 'UK_OFCOM' && styles.modalTabBtnTextActive]}>
                     UK OFCOM BANDS
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalTabBtn, presetTab === 'BESPOKE' && styles.modalTabBtnActive]} 
                  onPress={() => setPresetTab('BESPOKE')}
                >
                  <Text style={[styles.modalTabBtnText, presetTab === 'BESPOKE' && styles.modalTabBtnTextActive]}>
                    * MY BESPOKE PRESETS ({presetTarget?.type === 'duplex' ? bespokeDuplexPresets.length : bespokeSimplexPresets.length})
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Inline Bespoke Creator Box (Visible in BESPOKE Tab) */}
              {presetTab === 'BESPOKE' && (
                <View style={styles.bespokeSaveBox}>
                  <Text style={styles.bespokeSaveTitle}>SAVE CURRENT BAND AS NEW BESPOKE PRESET</Text>
                  <View style={{flexDirection: 'row', gap: 6, marginTop: 6}}>
                    <TextInput 
                      style={styles.bespokeInput}
                      placeholder="e.g. BBC OB Truck 456MHz Split..."
                      placeholderTextColor="#475569"
                      value={newBespokeName}
                      onChangeText={setNewBespokeName}
                    />
                    <TouchableOpacity 
                      style={styles.bespokeSaveBtn} 
                      onPress={saveCurrentAsBespokePreset}
                    >
                      <Text style={styles.bespokeSaveBtnText}>+ SAVE</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Presets List Scrollable */}
              <ScrollView style={styles.presetScrollArea} showsVerticalScrollIndicator={true}>
                {activePresetsList.length === 0 ? (
                  <View style={{padding: 24, alignItems: 'center'}}>
                    <Text style={styles.ledTextMuted}>
                      {presetTab === 'BESPOKE' 
                        ? 'NO BESPOKE PRESETS SAVED YET.\nType a name above and tap "+ SAVE" to create your first bespoke preset!' 
                        : 'No matching UK presets found.'}
                    </Text>
                  </View>
                ) : (
                  activePresetsList.map((preset) => {
                    const isDup = 'txMin' in preset;
                    return (
                      <View key={preset.id} style={styles.presetCard}>
                        <View style={styles.presetCardTop}>
                          <View style={{flex: 1}}>
                            <Text style={styles.presetCardName}>{preset.name}</Text>
                            <Text style={styles.presetCardDesc}>{preset.description}</Text>
                          </View>
                          {preset.category === 'BESPOKE' && (
                            <TouchableOpacity 
                              style={styles.presetDeleteBtn} 
                              onPress={() => deleteBespokePreset(isDup ? 'duplex' : 'simplex', preset.id)}
                            >
                              <Text style={styles.presetDeleteBtnText}></Text>
                            </TouchableOpacity>
                          )}
                        </View>

                        {/* Frequency Spec Badges */}
                        <View style={styles.presetBadgesRow}>
                          {isDup ? (
                            <>
                              <View style={[styles.specBadge, {borderColor: '#eab308'}]}>
                                <Text style={[styles.specBadgeLabel, {color: '#facc15'}]}>BASE TX: {preset.txMin}-{preset.txMax}</Text>
                              </View>
                              <View style={[styles.specBadge, {borderColor: '#0284c7'}]}>
                                <Text style={[styles.specBadgeLabel, {color: '#38bdf8'}]}>PORT TX: {preset.rxMin}-{preset.rxMax}</Text>
                              </View>
                              <View style={[styles.specBadge, {borderColor: '#9333ea'}]}>
                                <Text style={[styles.specBadgeLabel, {color: '#c084fc'}]}>SPLIT: {preset.split} MHz</Text>
                              </View>
                              <View style={[styles.specBadge, {borderColor: '#334155'}]}>
                                <Text style={[styles.specBadgeLabel, {color: '#94a3b8'}]}>{preset.pairCount} PAIRS</Text>
                              </View>
                            </>
                          ) : (
                            <>
                              <View style={[styles.specBadge, {borderColor: '#0284c7'}]}>
                                <Text style={[styles.specBadgeLabel, {color: '#38bdf8'}]}>RANGE: {preset.min}-{preset.max} MHz</Text>
                              </View>
                              <View style={[styles.specBadge, {borderColor: '#334155'}]}>
                                <Text style={[styles.specBadgeLabel, {color: '#94a3b8'}]}>BW: {preset.bw} kHz</Text>
                              </View>
                              <View style={[styles.specBadge, {borderColor: '#334155'}]}>
                                <Text style={[styles.specBadgeLabel, {color: '#94a3b8'}]}>{preset.count} CH</Text>
                              </View>
                            </>
                          )}
                        </View>

                        {/* Comprehensive Pairs List View (Duplex) */}
                        {isDup && preset.pairs && preset.pairs.length > 0 && (
                          <View style={styles.comprehensiveContainer}>
                            <View style={styles.comprehensiveHeaderRow}>
                              <Text style={styles.comprehensiveHeaderTitle}>
                                DEDICATED PAIRINGS ({preset.pairs.length} PAIRS IN SET)
                              </Text>
                              <Text style={styles.comprehensiveHeaderSub}>
                                TAP TO SELECT & AUDIT
                              </Text>
                            </View>

                            <View style={styles.pairsTable}>
                              <View style={styles.pairsTableRowHeader}>
                                <Text style={[styles.pairCell, styles.pairCellHeader, { width: 28 }]}>#</Text>
                                <Text style={[styles.pairCell, styles.pairCellHeader, { flex: 1 }]}>BASE TX (MHz)</Text>
                                <Text style={[styles.pairCell, styles.pairCellHeader, { width: 22, textAlign: 'center' }]}>&lt;-&gt;</Text>
                                <Text style={[styles.pairCell, styles.pairCellHeader, { flex: 1 }]}>PORT RX (MHz)</Text>
                                <Text style={[styles.pairCell, styles.pairCellHeader, { width: 44, textAlign: 'center' }]}>STATUS</Text>
                              </View>
                              {preset.pairs.map((p, pIdx) => {
                                const isSelected = isDuplexPairSelected(p.tx, p.rx);
                                return (
                                  <TouchableOpacity 
                                    key={pIdx} 
                                    style={[
                                      styles.pairsTableRow, 
                                      pIdx % 2 === 1 && styles.pairsTableRowAlt,
                                      isSelected && styles.pairRowSelected
                                    ]}
                                    activeOpacity={0.7}
                                    onPress={() => toggleDuplexPairFrequency(p, preset.name)}
                                  >
                                    <Text style={[styles.pairCell, styles.pairCellNum, { width: 28 }, isSelected && { color: '#4ade80' }]}>
                                      {isSelected ? 'OK' : (pIdx + 1 < 10 ? `0${pIdx + 1}` : pIdx + 1)}
                                    </Text>
                                    <Text style={[styles.pairCell, styles.pairCellTx, { flex: 1 }, isSelected && { color: '#4ade80' }]}>
                                      {p.tx.toFixed(5)}
                                    </Text>
                                    <Text style={[styles.pairCell, styles.pairCellArrow, { width: 22, textAlign: 'center' }]}>&gt;</Text>
                                    <Text style={[styles.pairCell, styles.pairCellRx, { flex: 1 }, isSelected && { color: '#86efac' }]}>
                                      {p.rx.toFixed(5)}
                                    </Text>
                                    <View style={[styles.pairSelectBadge, isSelected ? styles.pairSelectBadgeActive : styles.pairSelectBadgeInactive]}>
                                      <Text style={[styles.pairSelectBadgeText, isSelected && { color: '#4ade80', fontWeight: 'bold' }]}>
                                        {isSelected ? 'ACTIVE' : '+ADD'}
                                      </Text>
                                    </View>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          </View>
                        )}

                        {/* Comprehensive Frequency List View (Simplex IFB / Walkie) */}
                        {!isDup && preset.frequencies && preset.frequencies.length > 0 && (
                          <View style={styles.comprehensiveContainer}>
                            <View style={styles.comprehensiveHeaderRow}>
                              <Text style={styles.comprehensiveHeaderTitle}>
                                DEDICATED FREQUENCIES ({preset.frequencies.length} CHANNELS)
                              </Text>
                              <Text style={styles.comprehensiveHeaderSub}>
                                TAP TO SELECT & AUDIT
                              </Text>
                            </View>

                            <View style={styles.freqPillsWrap}>
                              {preset.frequencies.map((f, fIdx) => {
                                const simpType = preset.simplexType || (presetTarget?.type === 'base_tx' ? 'base_tx' : 'walkie');
                                const isSelected = isSimplexFreqSelected(f, simpType);
                                return (
                                  <TouchableOpacity 
                                    key={fIdx} 
                                    style={[
                                      styles.freqPillItem,
                                      isSelected && styles.freqPillItemSelected
                                    ]}
                                    activeOpacity={0.7}
                                    onPress={() => toggleSimplexFrequency(f, simpType, preset.name)}
                                  >
                                    <Text style={[styles.freqPillIndex, isSelected && { color: '#4ade80' }]}>
                                      {isSelected ? 'OK' : `#${fIdx + 1 < 10 ? `0${fIdx + 1}` : fIdx + 1}`}
                                    </Text>
                                    <Text style={[styles.freqPillText, isSelected && styles.freqPillTextSelected]}>
                                      {f.toFixed(5)}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          </View>
                        )}

                        {/* Apply Button */}
                        <TouchableOpacity 
                          style={styles.presetApplyBtn} 
                          onPress={() => applyPreset(preset)}
                        >
                          <Text style={styles.presetApplyBtnText}>
                            {presetTarget?.bandId ? 'APPLY TO BAND' : '+ ADD AS NEW BAND'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

      </ScrollView>
    </KeyboardAvoidingView>

    {/* ================= CREW CALL SHEET & CSV EXPORT MODAL ================= */}
    <CrewCallSheetModal
      visible={callSheetModalVisible}
      onClose={() => setCallSheetModalVisible(false)}
      items={callSheetItems}
      onUpdateRole={(idx, role) => {
        setChannelRoles(prev => ({ ...prev, [idx]: role }));
      }}
      onUpdateTone={(idx, tone) => {
        setChannelTones(prev => ({ ...prev, [idx]: tone }));
      }}
      activeZoneName={activeZone.name}
    />

    {/* ================= SOURCE CODE EXPORT & DIRECT DOWNLOAD MODAL ================= */}
    <SourceCodeExportModal
      visible={sourceCodeModalVisible}
      onClose={() => setSourceCodeModalVisible(false)}
    />
  </View>
  );
}

const styles = StyleSheet.create({
  regionSwitchContainer: {
    backgroundColor: '#070d19',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 10,
    marginBottom: 12
  },
  regionLabel: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 8
  },
  regionGrid: {
    gap: 6
  },
  regionGridRow: {
    flexDirection: 'row',
    gap: 6
  },
  gridBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    minHeight: 36
  },
  gridBtnInactive: {
    backgroundColor: '#0f172a',
    borderColor: '#334155'
  },
  gridBtnActiveUk: {
    backgroundColor: '#854d0e',
    borderColor: '#facc15'
  },
  gridBtnActiveEu: {
    backgroundColor: '#0369a1',
    borderColor: '#38bdf8'
  },
  gridBtnInvert: {
    backgroundColor: '#1e293b',
    borderColor: '#fde047'
  },
  gridBtnClear: {
    backgroundColor: '#2a1215',
    borderColor: '#ef4444'
  },
  gridBtnText: {
    color: '#cbd5e1',
    fontSize: 9.5,
    fontWeight: 'bold',
    textAlign: 'center'
  },
  gridBtnTextActive: {
    color: '#ffffff',
    fontWeight: '900'
  },
  gridBtnInvertText: {
    color: '#fde047',
    fontSize: 9.5,
    fontWeight: '900',
    textAlign: 'center'
  },
  gridBtnClearText: {
    color: '#f87171',
    fontSize: 9.5,
    fontWeight: '900',
    textAlign: 'center'
  },
  chassis: { flex: 1, backgroundColor: '#111318' },
  scrollPadding: { paddingTop: 45, paddingHorizontal: 10, paddingBottom: 40 },
  toastBanner: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, marginBottom: 10, alignItems: 'center' },
  toastSuccess: { backgroundColor: '#14532d', borderWidth: 1, borderColor: '#22c55e' },
  toastError: { backgroundColor: '#7f1d1d', borderWidth: 1, borderColor: '#ef4444' },
  toastText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  zoneTabsOuterContainer: { marginBottom: 10 },
  zoneTabsScroll: { flexDirection: 'row', gap: 6, paddingVertical: 4 },
  
  zoneTabPill: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: '#1e242d', borderWidth: 1, borderColor: '#334155' },
  zoneTabPillActive: { backgroundColor: '#0284c7', borderColor: '#38bdf8' },
  zoneTabPillText: { color: '#94a3b8', fontSize: 11, fontWeight: 'bold' },
  zoneTabPillTextActive: { color: '#fff' },
  addZonePill: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: '#166534', borderWidth: 1, borderColor: '#4ade80' },
  addZonePillText: { color: '#86efac', fontSize: 11, fontWeight: 'bold' },
  darkZonePanel: {
    backgroundColor: '#070d18',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 12,
    marginBottom: 12,
    position: 'relative'
  },
  hardwarePanel: { 
    backgroundColor: '#2a2e35', borderRadius: 8,
    borderTopWidth: 1, borderLeftWidth: 1, borderTopColor: '#4b525e', borderLeftColor: '#4b525e', 
    borderBottomWidth: 3, borderRightWidth: 2, borderBottomColor: '#121417', borderRightColor: '#121417', 
    padding: 14, marginBottom: 15, position: 'relative'
  },
  screw: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: '#1a1c20', borderWidth: 1, borderColor: '#444', position: 'absolute', alignItems: 'center', justifyContent: 'center'
  },
  screwSlot: { width: 6, height: 1, backgroundColor: '#000', transform: [{ rotate: '45deg' }] },
  embossedTitle: { color: '#1a1c20', textShadowColor: '#4b525e', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1, fontSize: 12, fontWeight: '900', letterSpacing: 1.5, textAlign: 'center', marginBottom: 10 },

  // --- INDUSTRIAL TACTILE BUTTON BAR & COMPACT TOP FROZEN PAGE NAV BAR ---
  topPageNavBar: {
    marginBottom: 4,
    backgroundColor: '#030712',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 3,
  },
  topPageNavScroll: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  topPageNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 5,
    minHeight: 28,
  },
  topPageNavBtnIdle: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  topPageNavBtnActiveCyan: {
    backgroundColor: '#082f49',
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  topPageNavBtnActivePurple: {
    backgroundColor: '#3b0764',
    borderWidth: 1,
    borderColor: '#c084fc',
  },
  topPageNavBtnActiveEmerald: {
    backgroundColor: '#064e3b',
    borderWidth: 1,
    borderColor: '#34d399',
  },
  topPageNavBtnActiveAmber: {
    backgroundColor: '#451a03',
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  topPageNavBtnActiveRed: {
    backgroundColor: '#450a0a',
    borderWidth: 1,
    borderColor: '#f87171',
  },
  topPageNavBtnActiveIndigo: {
    backgroundColor: '#1e1b4b',
    borderWidth: 1,
    borderColor: '#818cf8',
  },
  topPageNavBtnActiveTeal: {
    backgroundColor: '#042f2e',
    borderWidth: 1,
    borderColor: '#2dd4bf',
  },
  topPageNavDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  topPageNavDotOff: {
    backgroundColor: '#334155',
  },
  topPageNavDotCyan: {
    backgroundColor: '#38bdf8',
  },
  topPageNavDotPurple: {
    backgroundColor: '#c084fc',
  },
  topPageNavDotEmerald: {
    backgroundColor: '#34d399',
  },
  topPageNavDotAmber: {
    backgroundColor: '#fbbf24',
  },
  topPageNavDotRed: {
    backgroundColor: '#f87171',
  },
  topPageNavDotIndigo: {
    backgroundColor: '#818cf8',
  },
  topPageNavDotTeal: {
    backgroundColor: '#2dd4bf',
  },
  topPageNavText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  topPageNavTextIdle: {
    color: '#64748b',
  },
  topPageNavTextCyan: {
    color: '#38bdf8',
  },
  topPageNavTextPurple: {
    color: '#e9d5ff',
  },
  topPageNavTextEmerald: {
    color: '#a7f3d0',
  },
  topPageNavTextAmber: {
    color: '#fde68a',
  },
  topPageNavTextRed: {
    color: '#fecaca',
  },
  topPageNavTextIndigo: {
    color: '#c7d2fe',
  },
  topPageNavTextTeal: {
    color: '#99f6e4',
  },
  rockerButtonBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
    paddingTop: 2,
  },
  rockerBtn: {
    flexBasis: '30%',
    flexGrow: 1,
    minWidth: 120,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 8,
    position: 'relative',
  },
  rockerBtnIdle: {
    backgroundColor: '#1b1f26',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderTopColor: '#3d4452',
    borderLeftColor: '#3d4452',
    borderBottomWidth: 4,
    borderRightWidth: 2,
    borderBottomColor: '#0a0d12',
    borderRightColor: '#0a0d12',
  },
  rockerBtnActiveCyan: {
    backgroundColor: '#0c2431',
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderTopColor: '#083344',
    borderLeftColor: '#083344',
    borderBottomWidth: 2,
    borderRightWidth: 1,
    borderBottomColor: '#22d3ee',
    borderRightColor: '#22d3ee',
    transform: [{ translateY: 2 }],
  },
  rockerBtnActiveIndigo: {
    backgroundColor: '#1e1b4b',
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderTopColor: '#312e81',
    borderLeftColor: '#312e81',
    borderBottomWidth: 2,
    borderRightWidth: 1,
    borderBottomColor: '#818cf8',
    borderRightColor: '#818cf8',
    transform: [{ translateY: 2 }],
  },
  rockerBtnActivePurple: {
    backgroundColor: '#2e1065',
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderTopColor: '#581c87',
    borderLeftColor: '#581c87',
    borderBottomWidth: 2,
    borderRightWidth: 1,
    borderBottomColor: '#c084fc',
    borderRightColor: '#c084fc',
    transform: [{ translateY: 2 }],
  },
  rockerBtnActiveTeal: {
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
  },
  rockerBtnActiveAmber: {
    backgroundColor: '#2e1c0c',
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderTopColor: '#451a03',
    borderLeftColor: '#451a03',
    borderBottomWidth: 2,
    borderRightWidth: 1,
    borderBottomColor: '#fb923c',
    borderRightColor: '#fb923c',
    transform: [{ translateY: 2 }],
  },
  rockerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  rockerLedDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  rockerLedDotOff: {
    backgroundColor: '#334155',
  },
  rockerLedDotCyanActive: {
    backgroundColor: '#22d3ee',
    shadowColor: '#22d3ee',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  rockerLedDotIndigoActive: {
    backgroundColor: '#818cf8',
    shadowColor: '#818cf8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  rockerLedDotPurpleActive: {
    backgroundColor: '#c084fc',
    shadowColor: '#c084fc',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  rockerStatusTextIndigo: {
    color: '#a5b4fc',
  },
  rockerStatusTextPurple: {
    color: '#d8b4fe',
  },
  rockerLedDotAmberActive: {
    backgroundColor: '#fb923c',
    shadowColor: '#fb923c',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  rockerBtnActiveEmerald: {
    backgroundColor: '#052e16',
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderTopColor: '#064e3b',
    borderLeftColor: '#064e3b',
    borderBottomWidth: 2,
    borderRightWidth: 1,
    borderBottomColor: '#10b981',
    borderRightColor: '#10b981',
    transform: [{ translateY: 2 }],
  },
  rockerBtnActiveRed: {
    backgroundColor: '#3b0d0c',
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderTopColor: '#7f1d1d',
    borderLeftColor: '#7f1d1d',
    borderBottomWidth: 2,
    borderRightWidth: 1,
    borderBottomColor: '#ef4444',
    borderRightColor: '#ef4444',
    transform: [{ translateY: 2 }],
  },
  rockerLedDotEmeraldActive: {
    backgroundColor: '#10b981',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  rockerLedDotRedActive: {
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  rockerStatusTextEmerald: {
    color: '#34d399',
  },
  rockerStatusTextRed: {
    color: '#f87171',
  },
  rockerStatusText: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },
  rockerStatusTextIdle: {
    color: '#64748b',
  },
  rockerStatusTextCyan: {
    color: '#38bdf8',
  },
  rockerStatusTextAmber: {
    color: '#fb923c',
  },
  rockerTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  rockerTitleIdle: {
    color: '#94a3b8',
  },
  rockerTitleActive: {
    color: '#ffffff',
  },
  rockerSubtitle: {
    fontSize: 8,
    color: '#64748b',
    fontWeight: 'bold',
    letterSpacing: 0.5,
    marginTop: 2,
  },

  zoneNameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#3a4049' },
  zoneNameInput: { color: '#38bdf8', fontSize: 14, fontWeight: '900', borderBottomWidth: 1, borderBottomColor: '#38bdf8', paddingBottom: 2, minWidth: 140 },
  removeZoneBtn: { backgroundColor: '#7f1d1d', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 4, borderWidth: 1, borderColor: '#ef4444' },
  removeZoneBtnText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  sectionHeader: { color: '#94a3b8', fontSize: 9.5, fontWeight: '900', letterSpacing: 1.1, flexShrink: 1 },
  bandHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2, marginTop: 1, gap: 6 },
  addBandBtn: { backgroundColor: '#1e293b', paddingVertical: 2.5, paddingHorizontal: 6, borderRadius: 4, borderWidth: 1, borderColor: '#38bdf8', flexShrink: 0 },
  addBandBtnText: { color: '#38bdf8', fontSize: 8, fontWeight: '900' },
  presetChipBtn: { backgroundColor: '#2e1065', paddingVertical: 3, paddingHorizontal: 6, borderRadius: 4, borderWidth: 1, borderColor: '#a855f7' },
  presetChipBtnText: { color: '#d8b4fe', fontSize: 8, fontWeight: '900' },
  bandCard: { backgroundColor: '#1d2127', padding: 9, borderRadius: 6, marginBottom: 10, borderWidth: 1, borderColor: '#334155' },
  bandCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  bandLabelInput: { color: '#e2e8f0', fontSize: 11, fontWeight: 'bold', borderBottomWidth: 1, borderBottomColor: '#475569', paddingBottom: 2, flex: 1, marginRight: 8 },
  splitRowHeader: { marginBottom: 3, marginTop: 2 },
  splitRowLabel: { color: '#eab308', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  deleteBandBtn: { paddingHorizontal: 6, paddingVertical: 2 },
  deleteBandBtnText: { color: '#ef4444', fontSize: 12, fontWeight: 'bold' },
  dotBadge: { width: 8, height: 8, borderRadius: 4 },
  togglePill: { paddingVertical: 3, paddingHorizontal: 9, borderRadius: 10, borderWidth: 1 },
  togglePillActiveCyan: { backgroundColor: '#0e7490', borderColor: '#22d3ee' },
  togglePillActiveAmber: { backgroundColor: '#c2410c', borderColor: '#fb923c' },
  togglePillInactive: { backgroundColor: '#1e293b', borderColor: '#475569' },
  togglePillText: { color: '#fff', fontSize: 8, fontWeight: 'bold', letterSpacing: 0.5 },
  inputRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  inputGroup: { alignItems: 'center' },
  inputLabel: { color: '#8a94a5', fontSize: 8, fontWeight: 'bold', marginBottom: 3, letterSpacing: 0.5 },
  ledInput: { backgroundColor: '#0a1012', color: '#38bdf8', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontWeight: 'bold', fontSize: 12, width: '100%', padding: 6, borderRadius: 4, textAlign: 'center', borderWidth: 1, borderColor: '#000' },
  matrixContainer: { paddingVertical: 6 },
  matrixNotice: { color: '#94a3b8', fontSize: 10, lineHeight: 14, marginBottom: 12, fontStyle: 'italic' },
  matrixRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1d2127', padding: 10, borderRadius: 6, marginBottom: 8, borderWidth: 1, borderColor: '#334155' },
  matrixZoneTitle: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  matrixZoneSub: { color: '#94a3b8', fontSize: 9, marginTop: 2 },
  matrixStatusBtn: { paddingVertical: 6, paddingHorizontal: 8, borderRadius: 4, borderWidth: 1, alignItems: 'center', minWidth: 100 },
  matrixCoupled: { backgroundColor: '#78350f', borderColor: '#f59e0b' },
  matrixIsolated: { backgroundColor: '#064e3b', borderColor: '#10b981' },
  matrixStatusText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  matrixStatusSub: { color: '#cbd5e1', fontSize: 7, marginTop: 1 },
  hardwareBtnMain: { backgroundColor: '#c93434', borderTopWidth: 1, borderTopColor: '#e85f5f', borderBottomWidth: 4, borderBottomColor: '#7a1919', borderRadius: 6, padding: 12, alignItems: 'center' },
  hardwareBtnText: { color: '#fff', fontWeight: '900', letterSpacing: 1, textShadowColor: '#000', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  screenBezel: { backgroundColor: '#000', padding: 4, borderRadius: 6, borderTopWidth: 2, borderLeftWidth: 2, borderTopColor: '#111', borderLeftColor: '#111', borderBottomWidth: 1, borderRightWidth: 1, borderBottomColor: '#444', borderRightColor: '#444', marginBottom: 15 },
  detailedControls: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 5 },
  controlGroup: { alignItems: 'center', marginBottom: 8 },
  controlLabel: { color: '#8a94a5', fontSize: 9, fontWeight: 'bold', marginBottom: 4, letterSpacing: 1 },
  btnGroupRow: { flexDirection: 'row', gap: 6 },
  hardwareBtnSmall: { backgroundColor: '#3a4049', borderTopWidth: 1, borderTopColor: '#5c6573', borderBottomWidth: 3, borderBottomColor: '#1a1c20', borderRadius: 4, paddingVertical: 8, paddingHorizontal: 12 },
  btnTextSmall: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  // --- TACTILE SHADOW ZONE SELECTOR BUTTONS & LEDGER STATUS ---
  ledgerZoneBarContainer: {
    marginBottom: 10,
  },
  ledgerZoneScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  tactileShadowZoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#202630',
    borderTopWidth: 1.5,
    borderTopColor: '#525d6d',
    borderLeftWidth: 1.5,
    borderLeftColor: '#3d4653',
    borderRightWidth: 1.5,
    borderRightColor: '#171c23',
    borderBottomWidth: 3.5,
    borderBottomColor: '#0c0f14',
    borderRadius: 6,
    paddingVertical: 7,
    paddingHorizontal: 11,
    minHeight: 36,
    gap: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.65,
    shadowRadius: 3,
    elevation: 4,
  },
  tactileShadowZoneBtnActive: {
    backgroundColor: '#0284c7',
    borderTopColor: '#7dd3fc',
    borderLeftColor: '#38bdf8',
    borderRightColor: '#0369a1',
    borderBottomColor: '#0c4a6e',
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 5,
    elevation: 5,
  },
  tactileShadowZoneBtnProfilesActive: {
    backgroundColor: '#475569',
    borderTopColor: '#94a3b8',
    borderLeftColor: '#64748b',
    borderRightColor: '#334155',
    borderBottomColor: '#1e293b',
    shadowColor: '#94a3b8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  tactileShadowZoneBtnText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  tactileShadowZoneBtnTextActive: {
    color: '#ffffff',
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  tactileCountPill: {
    backgroundColor: '#111822',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tactileCountPillActive: {
    backgroundColor: '#0369a1',
    borderColor: '#7dd3fc',
  },
  tactileCountPillText: {
    color: '#94a3b8',
    fontSize: 9.5,
    fontWeight: 'bold',
  },
  tactileCountPillTextActive: {
    color: '#ffffff',
    fontWeight: '900',
  },
  ledgerZoneStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
    paddingHorizontal: 4,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  ledgerZoneStatusTitle: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  ledgerZoneStatusCount: {
    color: '#38bdf8',
    fontSize: 9.5,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  zoneStepPill: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    backgroundColor: '#1e293b',
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#334155'
  },
  zoneStepPillActive: {
    backgroundColor: '#0284c7',
    borderColor: '#38bdf8'
  },
  zoneStepPillText: {
    color: '#94a3b8',
    fontSize: 7.5,
    fontWeight: 'bold'
  },
  zoneStepPillTextActive: {
    color: '#ffffff'
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  zoneRowBadge: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 3,
    paddingHorizontal: 1,
    paddingVertical: 2,
    marginRight: 3,
    marginTop: 5,
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
  },
  zoneRowBadgeText: {
    color: '#38bdf8',
    fontSize: 8,
    fontWeight: '900',
  },
  tabToggleContainer: { flexDirection: 'row', backgroundColor: '#1a1c20', borderRadius: 6, padding: 3, marginBottom: 12 },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 4 },
  tabBtnActive: { backgroundColor: '#38bdf8' },
  tabBtnText: { color: '#64748b', fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 },
  tabBtnTextActive: { color: '#000' },
  ledgerScreen: { backgroundColor: '#0a1012', padding: 8, borderRadius: 4, borderTopWidth: 2, borderLeftWidth: 2, borderTopColor: '#000', borderLeftColor: '#000', minHeight: 180 },
  ledgerHeaderRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#1e3036', paddingBottom: 5, marginBottom: 8 },
  colHeader: { color: '#3b7a8a', fontSize: 8.5, fontWeight: 'bold', letterSpacing: 0.5 },
  ledgerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  channelNumBadge: { width: 20, paddingVertical: 2.5, borderRadius: 3, backgroundColor: '#070f1a', borderWidth: 1, borderColor: '#334155', alignItems: 'center', justifyContent: 'center', marginRight: 3, marginTop: 5 },
  channelNumBadgeText: { color: '#38bdf8', fontSize: 8.5, fontWeight: '900', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  typeBadge: { width: 27, paddingVertical: 2.5, borderRadius: 3, alignItems: 'center', justifyContent: 'center', marginRight: 3, marginTop: 5 },
  typeBadgeText: { color: '#fff', fontSize: 7.5, fontWeight: '900', letterSpacing: 0 },
  ledInputMuted: { backgroundColor: '#111a1f', color: '#fff', paddingVertical: 4, paddingHorizontal: 2, borderRadius: 3, borderWidth: 1, borderColor: '#000', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', textAlign: 'center' },
  simplexPlaceholder: { backgroundColor: '#0f172a', paddingVertical: 4, paddingHorizontal: 2, borderRadius: 3, borderWidth: 1, borderColor: '#1e293b', alignItems: 'center', justifyContent: 'center' },
  simplexPlaceholderText: { color: '#475569', fontSize: 8.5, fontWeight: 'bold', letterSpacing: 0.5 },
  actionBtn: { backgroundColor: '#3a4049', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 4, borderWidth: 1, borderColor: '#5c6573', alignItems: 'center', justifyContent: 'center' },
  actionBtnText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  microBtn: { backgroundColor: '#1e293b', width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 3, borderWidth: 1, borderColor: '#334155' },
  microBtnText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  ledTextGreen: { color: '#4ade80', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontWeight: 'bold' },
  ledTextMuted: { color: '#475569', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', textAlign: 'center', marginVertical: 20, fontSize: 11 },

  // --- MODAL STYLES ---
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 14,
  },
  modalCard: {
    backgroundColor: '#22262d',
    borderRadius: 8,
    borderTopWidth: 1, borderLeftWidth: 1, borderTopColor: '#4b525e', borderLeftColor: '#4b525e',
    borderBottomWidth: 3, borderRightWidth: 2, borderBottomColor: '#0a0d12', borderRightColor: '#0a0d12',
    width: '100%',
    maxHeight: '85%',
    padding: 16,
    position: 'relative',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingBottom: 8,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  modalSubtitle: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 2,
  },
  modalCloseBtn: {
    backgroundColor: '#334155',
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalTabRow: {
    flexDirection: 'row',
    backgroundColor: '#16191f',
    borderRadius: 6,
    padding: 3,
    marginBottom: 10,
  },
  modalTabBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 4,
  },
  modalTabBtnActive: {
    backgroundColor: '#0284c7',
  },
  modalTabBtnText: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  modalTabBtnTextActive: {
    color: '#ffffff',
  },
  bespokeSaveBox: {
    backgroundColor: '#161a22',
    padding: 8,
    borderRadius: 6,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  bespokeSaveTitle: {
    color: '#cbd5e1',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  bespokeInput: {
    flex: 1,
    backgroundColor: '#0a1012',
    color: '#fff',
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  bespokeSaveBtn: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderRadius: 4,
  },
  bespokeSaveBtnText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },
  presetScrollArea: {
    maxHeight: 480,
  },
  presetCard: {
    backgroundColor: '#181c23',
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  presetCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  presetCardName: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: 'bold',
  },
  presetCardDesc: {
    color: '#94a3b8',
    fontSize: 9,
    marginTop: 2,
    lineHeight: 12,
  },
  presetDeleteBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  presetDeleteBtnText: {
    fontSize: 12,
  },
  presetBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginVertical: 6,
  },
  specBadge: {
    backgroundColor: '#0a1012',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 3,
    borderWidth: 1,
  },
  specBadgeLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  presetApplyBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 6,
    borderRadius: 4,
    alignItems: 'center',
    marginTop: 6,
  },
  presetApplyBtnText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  comprehensiveContainer: {
    backgroundColor: '#0c1015',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#263141',
    marginTop: 6,
    marginBottom: 6,
    overflow: 'hidden',
  },
  comprehensiveHeaderRow: {
    backgroundColor: '#161e2b',
    paddingVertical: 5,
    paddingHorizontal: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#263141',
  },
  comprehensiveHeaderTitle: {
    color: '#38bdf8',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  comprehensiveHeaderSub: {
    color: '#94a3b8',
    fontSize: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  pairsTable: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  pairsTableRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  pairsTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2.5,
    paddingHorizontal: 4,
  },
  pairsTableRowAlt: {
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
  },
  pairCell: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 9.5,
  },
  pairCellHeader: {
    color: '#64748b',
    fontWeight: 'bold',
    fontSize: 8,
  },
  pairCellNum: {
    color: '#94a3b8',
    fontWeight: 'bold',
  },
  pairCellTx: {
    color: '#facc15',
    fontWeight: 'bold',
  },
  pairCellArrow: {
    color: '#475569',
    fontSize: 9,
  },
  pairCellRx: {
    color: '#38bdf8',
    fontWeight: 'bold',
  },
  pairCellSplit: {
    color: '#c084fc',
    fontSize: 8.5,
  },
  freqPillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    padding: 6,
  },
  freqPillItem: {
    backgroundColor: '#161e2b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 4,
    paddingVertical: 3,
    paddingHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  freqPillIndex: {
    color: '#64748b',
    fontSize: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  freqPillText: {
    color: '#38bdf8',
    fontSize: 9.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: 'bold',
  },
  pairRowSelected: {
    backgroundColor: 'rgba(74, 222, 128, 0.16)',
    borderLeftWidth: 3,
    borderLeftColor: '#4ade80',
  },
  pairSelectBadge: {
    width: 44,
    paddingVertical: 1.5,
    paddingHorizontal: 2,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pairSelectBadgeActive: {
    backgroundColor: 'rgba(74, 222, 128, 0.25)',
    borderWidth: 1,
    borderColor: '#4ade80',
  },
  pairSelectBadgeInactive: {
    backgroundColor: '#1e293b',
  },
  pairSelectBadgeText: {
    color: '#64748b',
    fontSize: 7.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: 'bold',
  },
  freqPillItemSelected: {
    backgroundColor: 'rgba(74, 222, 128, 0.22)',
    borderColor: '#4ade80',
    borderWidth: 1.5,
  },
  freqPillTextSelected: {
    color: '#4ade80',
    fontWeight: 'bold',
  },
  ledgerClashWarningRow: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#ef4444',
    paddingVertical: 2.5,
    paddingHorizontal: 8,
    marginTop: -2,
    marginBottom: 4,
  },
  ledgerClashWarningText: {
    color: '#f87171',
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: 'bold',
  },

  // --- SPATIAL MAP / 2D STAGE VISUALIZER STYLES ---
  spatialContainer: {
    backgroundColor: '#131821',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 10,
    marginTop: 6,
  },
  spatialHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  spatialTitle: {
    color: '#34d399',
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  spatialBadgeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  spatialBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 3,
    borderWidth: 1,
  },
  spatialBadgeCoupled: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: '#ef4444',
  },
  spatialBadgeIsolated: {
    backgroundColor: 'rgba(52, 211, 153, 0.2)',
    borderColor: '#34d399',
  },
  spatialBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  spatialCanvasContainer: {
    width: '100%',
    height: 290,
    backgroundColor: '#0a0d14',
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#1e293b',
    overflow: 'hidden',
    position: 'relative',
  },
  // --- VENUE DIMENSION CONTROLS STYLES ---
  arenaDimPanel: {
    backgroundColor: '#0c1118',
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1e2d42',
    gap: 6,
  },
  arenaDimHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  arenaDimTitle: {
    color: '#38bdf8',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  arenaDimBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingVertical: 1.5,
    paddingHorizontal: 6,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#0284c7',
  },
  arenaDimBadgeText: {
    color: '#38bdf8',
    fontSize: 8.5,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  dimPresetBtn: {
    backgroundColor: '#141c28',
    paddingVertical: 2.5,
    paddingHorizontal: 6,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#26354a',
  },
  dimPresetBtnActive: {
    backgroundColor: '#0284c7',
    borderColor: '#38bdf8',
  },
  dimPresetText: {
    color: '#94a3b8',
    fontSize: 8,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  dimPresetTextActive: {
    color: '#ffffff',
    fontWeight: '900',
  },
  arenaDimInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#16202f',
    paddingTop: 6,
  },
  dimInputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dimInputLabel: {
    color: '#64748b',
    fontSize: 8,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  dimStepperBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#090d14',
    borderWidth: 1,
    borderColor: '#223044',
    borderRadius: 4,
    paddingHorizontal: 3,
    paddingVertical: 2,
    gap: 4,
  },
  dimStepperBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 3,
  },
  dimStepperBtnText: {
    color: '#38bdf8',
    fontSize: 9,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  dimTextInput: {
    color: '#f8fafc',
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    minWidth: 36,
    textAlign: 'center',
    padding: 0,
  },
  dimUnitText: {
    color: '#64748b',
    fontSize: 8.5,
    fontWeight: 'bold',
  },
  dimApplyBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  dimApplyBtnText: {
    color: '#ffffff',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  // --- SPATIAL ZOOM & ARENA CONTROLS STYLES ---
  zoomControlPanel: {
    backgroundColor: '#0c1017',
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    gap: 6,
  },
  zoomMainSteppersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  zoomButtonGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  zoomStepBtn: {
    backgroundColor: '#1e293b',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderTopColor: '#38bdf8',
    borderLeftColor: '#38bdf8',
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderBottomColor: '#090d14',
    borderRightColor: '#090d14',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  zoomStepBtnDisabled: {
    opacity: 0.4,
    borderColor: '#334155',
  },
  zoomStepBtnSymbol: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: '900',
  },
  zoomStepBtnLabel: {
    color: '#e2e8f0',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  zoomDisplayBadge: {
    backgroundColor: '#060a10',
    borderWidth: 1,
    borderColor: '#0284c7',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
  },
  zoomDisplaySub: {
    color: '#64748b',
    fontSize: 7,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  zoomDisplayText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  zoomActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  zoomPresetPill: {
    backgroundColor: '#1e293b',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  zoomPresetPillActive: {
    backgroundColor: '#0284c7',
    borderColor: '#38bdf8',
  },
  zoomPresetPillText: {
    color: '#94a3b8',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  zoomPresetPillTextActive: {
    color: '#ffffff',
  },
  zoomSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: '#161f2e',
    paddingTop: 6,
  },
  zoomChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  zoomChipsTitle: {
    color: '#64748b',
    fontSize: 7.5,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginRight: 2,
  },
  zoomChipBtn: {
    backgroundColor: '#141c28',
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#26354a',
  },
  zoomChipBtnActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderColor: '#38bdf8',
  },
  zoomChipBtnText: {
    color: '#94a3b8',
    fontSize: 8,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  zoomChipBtnTextActive: {
    color: '#38bdf8',
    fontWeight: '900',
  },
  layerTogglesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  layerToggleBtn: {
    backgroundColor: '#111722',
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#222f42',
  },
  layerToggleBtnActive: {
    backgroundColor: '#132838',
    borderColor: '#0284c7',
  },
  layerToggleText: {
    color: '#64748b',
    fontSize: 7.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  layerToggleTextActive: {
    color: '#38bdf8',
  },
  panNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#161f2e',
    paddingTop: 5,
  },
  panNavTitle: {
    color: '#64748b',
    fontSize: 7.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  panDpadBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  panDpadBtn: {
    backgroundColor: '#16202e',
    width: 22,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#2a3a52',
  },
  panDpadText: {
    color: '#cbd5e1',
    fontSize: 8.5,
    fontWeight: '900',
  },
  spatialLegendBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#0d131d',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    gap: 8,
  },
  spatialLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  spatialLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  spatialLegendText: {
    color: '#94a3b8',
    fontSize: 8.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: 'bold',
  },
  spatialZoneCardList: {
    marginTop: 10,
    gap: 6,
  },
  spatialZoneCard: {
    backgroundColor: '#18202c',
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: '#293548',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  spatialZoneCardActive: {
    borderColor: '#34d399',
    backgroundColor: '#102222',
  },
  spatialZoneName: {
    color: '#e2e8f0',
    fontSize: 10.5,
    fontWeight: 'bold',
  },
  spatialZoneCoord: {
    color: '#64748b',
    fontSize: 8.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  spatialNudgeBtn: {
    backgroundColor: '#1e293b',
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spatialNudgeText: {
    color: '#cbd5e1',
    fontSize: 10,
    fontWeight: '900',
  },
  // ================= ZONE CONFIG EMBEDDED KEYPAD & COMPACT BANDS =================
  zoneConfigFlexRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    marginTop: 4
  },
  zoneKeypadCard: {
    width: 148,
    backgroundColor: '#070d18',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 6,
    // @ts-ignore
    position: Platform.OS === 'web' ? 'sticky' : 'relative',
    top: 0,
    marginTop: 0,
    zIndex: 10
  },
  zoneKeypadBanner: {
    backgroundColor: '#030712',
    borderWidth: 1,
    borderColor: '#38bdf8',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 4,
    marginBottom: 4,
    alignItems: 'center'
  },
  zoneKeypadBannerHeading: {
    color: '#94a3b8',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  zoneKeypadBannerValue: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center'
  },
  zoneKeypadReplicaCard: {
    backgroundColor: '#030712',
    borderWidth: 1,
    borderColor: '#38bdf8',
    borderRadius: 5,
    padding: 3,
    marginBottom: 4
  },
  zoneKeypadReplicaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
    paddingHorizontal: 2
  },
  zoneKeypadReplicaHeading: {
    color: '#94a3b8',
    fontSize: 7.5,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  zoneKeypadReplicaUnitBadge: {
    backgroundColor: '#0b1329',
    borderRadius: 3,
    paddingHorizontal: 3,
    paddingVertical: 0.5,
    borderWidth: 0.5,
    borderColor: '#38bdf8'
  },
  zoneKeypadReplicaUnitText: {
    fontSize: 7.5,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  zoneKeypadReplicaInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3
  },
  zoneKeypadReplicaStepBtn: {
    width: 22,
    height: 26,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 3,
    justifyContent: 'center',
    alignItems: 'center'
  },
  zoneKeypadReplicaStepBtnText: {
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 15
  },
  zoneKeypadReplicaInput: {
    flex: 1,
    height: 26,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderRadius: 3,
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
    paddingVertical: 0,
    paddingHorizontal: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  zoneKeypadGrid: {
    gap: 4
  },
  zoneKeypadRow: {
    flexDirection: 'row',
    gap: 4
  },
  zoneKeyBtn: {
    flex: 1,
    minHeight: 36,
    backgroundColor: '#1e293b',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#475569',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 6
  },
  zoneKeyBtnText: {
    color: '#f8fafc',
    fontSize: 14.5,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  zoneKeyBtnAction: {
    backgroundColor: '#334155',
    borderColor: '#64748b'
  },
  zoneKeyBtnActionText: {
    color: '#38bdf8',
    fontSize: 13.5,
    fontWeight: 'bold'
  },
  zoneKeyBtnClear: {
    backgroundColor: '#271c1f',
    borderColor: '#ef4444'
  },
  zoneKeyBtnClearText: {
    color: '#f87171',
    fontSize: 10.5,
    fontWeight: '900'
  },
  zoneKeyBtnEnter: {
    backgroundColor: '#0284c7',
    borderColor: '#38bdf8'
  },
  zoneKeyBtnEnterText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  zoneKeypadHint: {
    color: '#64748b',
    fontSize: 7.5,
    textAlign: 'center',
    marginTop: 3,
    fontStyle: 'italic'
  },
  zoneBandsColumn: {
    flex: 1,
    minWidth: 0
  },
  bandViewModeToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#030712',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 2,
    marginTop: 0,
    marginBottom: 2,
    gap: 4
  },
  bandViewModeToggleBtn: {
    flex: 1,
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent'
  },
  bandViewModeToggleBtnActiveDuplex: {
    backgroundColor: '#0369a1',
    borderColor: '#38bdf8',
    borderWidth: 1,
  },
  bandViewModeToggleBtnActiveSimplex: {
    backgroundColor: '#0f766e',
    borderColor: '#2dd4bf',
    borderWidth: 1,
  },
  bandViewModeToggleText: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8
  },
  bandViewModeToggleTextActive: {
    color: '#ffffff',
    fontWeight: '900'
  },
  bandViewModeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#334155'
  },
  compactBandCard: {
    backgroundColor: '#070f1a',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 4,
    marginBottom: 0
  },
  compactBandCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
    gap: 4
  },
  compactBandLabelInput: {
    flex: 1,
    backgroundColor: '#030712',
    color: '#f8fafc',
    fontSize: 9,
    fontWeight: 'bold',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 4,
    paddingVertical: 1,
    minHeight: 19
  },
  compactInputBox: {
    backgroundColor: '#030712',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 4,
    paddingHorizontal: 2,
    paddingVertical: 1,
    minHeight: 20,
    justifyContent: 'center',
    alignItems: 'center'
  },
  compactInputActive: {
    borderColor: '#38bdf8',
    borderWidth: 1.5,
    backgroundColor: '#082f49',
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 6,
    // @ts-ignore
    boxShadow: '0 0 8px rgba(56, 189, 248, 0.85), 0 0 16px rgba(56, 189, 248, 0.4), inset 0 0 4px rgba(56, 189, 248, 0.35)',
    // @ts-ignore
    animation: Platform.OS === 'web' ? 'activeInputGlowPulse 1.8s infinite ease-in-out' : undefined,
  },
  compactInputText: {
    color: '#f8fafc',
    fontSize: 9.5,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    textAlign: 'center'
  },
  compactMicroLabel: {
    color: '#94a3b8',
    fontSize: 7,
    fontWeight: 'bold',
    marginBottom: 1,
    textAlign: 'center'
  },
  compactSplitHeader: {
    color: '#94a3b8',
    fontSize: 7,
    fontWeight: 'bold',
    marginBottom: 1
  }
});
