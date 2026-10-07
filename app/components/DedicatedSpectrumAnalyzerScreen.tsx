import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
  Alert,
  Modal,
  PanResponder,
  LogBox
} from 'react-native';
import Svg, { Line, Rect, Text as SvgText, G, Circle, Path, Polygon } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';

if (typeof LogBox !== 'undefined' && LogBox?.ignoreLogs) {
  try {
    LogBox.ignoreLogs(['An error was thrown when attempting to render log messages via logbox']);
  } catch (e) {}
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
  channelNumber?: number;
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

let cachedDedicatedCarriers: CustomCarrierInput[] | null = null;
const DEDICATED_CARRIERS_STORAGE_KEY = 'rf_dedicated_spectrum_carriers_v1';

const DEFAULT_SPECTRUM_CARRIERS: CustomCarrierInput[] = [
  { id: 'pair_1', tx: 455.03125, rx: 468.05625, label: 'Base 1 / Crew 1', type: 'DUPLEX', txBw: 0.0125, rxBw: 0.0125, active: true, locked: false },
  { id: 'pair_2', tx: 455.19375, rx: 468.21875, label: 'Base 2 / Crew 2', type: 'DUPLEX', txBw: 0.0125, rxBw: 0.0125, active: true, locked: false },
  { id: 'pair_3', tx: 455.35625, rx: 468.38125, label: 'Base 3 / Crew 3', type: 'DUPLEX', txBw: 0.0125, rxBw: 0.0125, active: true, locked: false },
  { id: 'ifb_1', tx: 455.60000, rx: 0, label: 'Floor IFB Feed', type: 'BASE_TX', txBw: 0.0125, rxBw: 0.0125, active: true, locked: false }
];

export const DedicatedSpectrumAnalyzerScreen: React.FC<Props> = ({
  onApplyToPlan,
  onClose
}) => {
  // ----------------------------------------------------
  // 1. CARRIER POOL (User entered or preset - Persistent across screen navigation)
  // ----------------------------------------------------
  const [carriers, setCarriers] = useState<CustomCarrierInput[]>(() => {
    if (cachedDedicatedCarriers && Array.isArray(cachedDedicatedCarriers)) {
      return cachedDedicatedCarriers;
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = window.localStorage.getItem(DEDICATED_CARRIERS_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            cachedDedicatedCarriers = parsed;
            return parsed;
          }
        }
      } catch (e) {}
    }
    cachedDedicatedCarriers = DEFAULT_SPECTRUM_CARRIERS;
    return DEFAULT_SPECTRUM_CARRIERS;
  });

  // Hydrate from persistent storage on mount
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(DEDICATED_CARRIERS_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            cachedDedicatedCarriers = parsed;
            setCarriers(parsed);
          }
        }
      } catch (err) {}
    })();
  }, []);

  // Save to persistent storage and module cache whenever carriers change
  useEffect(() => {
    cachedDedicatedCarriers = carriers;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(DEDICATED_CARRIERS_STORAGE_KEY, JSON.stringify(carriers));
      }
      AsyncStorage.setItem(DEDICATED_CARRIERS_STORAGE_KEY, JSON.stringify(carriers)).catch(() => {});
    } catch (e) {}
  }, [carriers]);

  // Permanent Channel Number Extractors & Generators (Never change on toggle or delete)
  const getCarrierChannelNumber = (c: CustomCarrierInput, fallbackIndex: number = 0): number => {
    if (typeof c.channelNumber === 'number' && c.channelNumber > 0) {
      return c.channelNumber;
    }
    const match = c.label?.match(/(?:CH|Ch|Channel|Base|Walkie)\s*(\d+)/i);
    if (match && match[1]) {
      const parsed = parseInt(match[1], 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return fallbackIndex + 1;
  };

  // Regulatory Region Mode (GB UK vs EU Europe)
  const [regulatoryRegion, setRegulatoryRegion] = useState<'GB_UK' | 'EU_EUROPE'>('GB_UK');

  // Input fields for adding a new frequency
  const [newTxInput, setNewTxInput] = useState<string>('455.50000');
  const [newRxInput, setNewRxInput] = useState<string>('468.50000');
  const [newLabelInput, setNewLabelInput] = useState<string>('New Ch');
  const [newTypeInput, setNewTypeInput] = useState<'DUPLEX' | 'BASE_TX' | 'WALKIE'>('DUPLEX');
  const [newDuplexDirection, setNewDuplexDirection] = useState<'BASE_LOW' | 'BASE_HIGH'>('BASE_LOW');
  const [newBwInput, setNewBwInput] = useState<number>(0.0125);

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
    if (region === 'EU_EUROPE') {
      if (newTxInput === '455.50000' && newRxInput === '468.50000') {
        setNewTxInput('468.50000');
        setNewRxInput('455.50000');
      }
    } else {
      if (newTxInput === '468.50000' && newRxInput === '455.50000') {
        setNewTxInput('455.50000');
        setNewRxInput('468.50000');
      }
    }
  };

  // Quick swap for single add form
  const handleSwapFormTxRx = () => {
    const curTx = newTxInput;
    const curRx = newRxInput;
    setNewTxInput(curRx);
    setNewRxInput(curTx);
    setNewDuplexDirection(prev => prev === 'BASE_LOW' ? 'BASE_HIGH' : 'BASE_LOW');
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
    setCarriers([]);
    cachedDedicatedCarriers = [];
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(DEDICATED_CARRIERS_STORAGE_KEY, JSON.stringify([]));
      }
      AsyncStorage.setItem(DEDICATED_CARRIERS_STORAGE_KEY, JSON.stringify([])).catch(() => {});
    } catch (e) {}
    setMarker1(null);
    setMarker2(null);
    setBatchInputText('');
    setStatusMsg('✓ Cleared all spectrum carriers from ledger.');
  };

  // Cycle channel bandwidth: 12.5k -> 25k -> 50k -> 12.5k
  const handleCycleCarrierBw = (id: string) => {
    setCarriers(prev => prev.map(c => {
      if (c.id !== id) return c;
      const curKhz = (c.txBw > 1 ? c.txBw : (c.txBw || 0.0125) * 1000);
      let nextMhz = 0.0125;
      if (curKhz < 18) nextMhz = 0.025; // 12.5k -> 25k
      else if (curKhz < 35) nextMhz = 0.050; // 25k -> 50k
      else nextMhz = 0.0125; // 50k -> 12.5k
      return { ...c, txBw: nextMhz, rxBw: nextMhz };
    }));
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
  const [ledgerStepKhz, setLedgerStepKhz] = useState<number>(12.5);
  const [showTwoTone, setShowTwoTone] = useState<boolean>(true);
  const [showThreeTone, setShowThreeTone] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [fillSpikes, setFillSpikes] = useState<boolean>(true);
  const [traceMode, setTraceMode] = useState<'LIVE' | 'MAX_HOLD'>('LIVE');

  // Markers & Delta state
  const [isDeltaMode, setIsDeltaMode] = useState<boolean>(false);
  const [marker1, setMarker1] = useState<number | null>(455.03125);
  const [marker2, setMarker2] = useState<number | null>(468.05625);
  const [deltaStep, setDeltaStep] = useState<1 | 2>(1);

  // Max Hold peaks
  const [maxHoldPeaks, setMaxHoldPeaks] = useState<{ freq: number; dbm: number }[]>([]);

  // Calculation / Audit state
  const [hasAudited, setHasAudited] = useState<boolean>(true);
  const [conflicts, setConflicts] = useState<CompatibilityConflict[]>([]);
  const [isAutoCalculating, setIsAutoCalculating] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>('Ready');

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
  // 3rd Order IMD guard band: 12.5 kHz (0.0125 MHz)
  // 2-TX 3rd order: 2*f1 - f2
  // 3-TX 3rd order: f1 + f2 - f3
  const FUNDAMENTAL_GUARD_MHZ = 0.01875;
  const IMD_GUARD_MHZ = 0.0125;

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
        const delta = Math.abs(c1.freq - c2.freq);
        if (delta < FUNDAMENTAL_GUARD_MHZ) {
          foundConflicts.push({
            type: 'Fundamental',
            carrierA: c1.label,
            carrierB: c2.label,
            targetCarrier: `${c1.label} ↔ ${c2.label}`,
            productFreq: c1.freq,
            targetFreq: c2.freq,
            diffKhz: delta * 1000,
            thresholdKhz: FUNDAMENTAL_GUARD_MHZ * 1000
          });
        }
      }
    }

    // 2. Intermod collision check (IMDs landing on any protected carrier within 12.5 kHz)
    intermodProducts.forEach(imd => {
      allProtected.forEach(target => {
        const delta = Math.abs(imd.freq - target.freq);
        if (delta < IMD_GUARD_MHZ) {
          foundConflicts.push({
            type: imd.type === '2-Tone' ? '2-Tone IMD' : '3-Tone IMD',
            carrierA: imd.sources[0] || 'TX',
            carrierB: imd.sources[1] || 'TX',
            carrierC: imd.sources[2],
            targetCarrier: target.label,
            productFreq: imd.freq,
            targetFreq: target.freq,
            diffKhz: delta * 1000,
            thresholdKhz: IMD_GUARD_MHZ * 1000
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
    setStatusMsg('Calculating intermod-clean frequencies...');

    setTimeout(() => {
      // Step through unlocked frequencies and adjust by raster steps until collision-free
      const lockedCarriers = carriers.filter(c => c.locked);
      const unlockedCarriers = carriers.filter(c => !c.locked);

      const RASTER_MHZ = 0.025; // 25 kHz or 12.5 kHz channel raster
      const adjusted: CustomCarrierInput[] = [...lockedCarriers];

      unlockedCarriers.forEach(cand => {
        let bestTx = cand.tx;
        let bestRx = cand.rx;
        let isFound = false;

        // Try candidate offsets (+0, +25k, -25k, +50k, -50k, +75k, -75k... up to ±1.5MHz)
        const offsets = [0];
        for (let step = 1; step <= 60; step++) {
          offsets.push(step * RASTER_MHZ);
          offsets.push(-step * RASTER_MHZ);
        }

        for (const off of offsets) {
          const testTx = Math.round((cand.tx + off) * 100000) / 100000;
          const testRx = cand.type === 'DUPLEX' ? Math.round((cand.rx + off) * 100000) / 100000 : 0;

          // Check against already placed frequencies
          let clash = false;
          const currentPlaced = [
            ...adjusted.map(a => a.tx),
            ...adjusted.filter(a => a.type === 'DUPLEX').map(a => a.rx)
          ];

          // 1. Check fundamental proximity
          for (const p of currentPlaced) {
            if (Math.abs(p - testTx) < FUNDAMENTAL_GUARD_MHZ) {
              clash = true;
              break;
            }
            if (testRx > 0 && Math.abs(p - testRx) < FUNDAMENTAL_GUARD_MHZ) {
              clash = true;
              break;
            }
          }
          if (clash) continue;

          // 2. Check 2-tone IMD
          const allPlacedTx = [...adjusted.map(a => a.tx), testTx];
          for (let a = 0; a < allPlacedTx.length; a++) {
            for (let b = 0; b < allPlacedTx.length; b++) {
              if (a === b) continue;
              const imd = 2 * allPlacedTx[a] - allPlacedTx[b];
              if (Math.abs(imd - testTx) < IMD_GUARD_MHZ || (testRx > 0 && Math.abs(imd - testRx) < IMD_GUARD_MHZ)) {
                clash = true;
                break;
              }
              for (const ex of currentPlaced) {
                if (Math.abs(imd - ex) < IMD_GUARD_MHZ) {
                  clash = true;
                  break;
                }
              }
              if (clash) break;
            }
            if (clash) break;
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

      setCarriers(adjusted);
      setIsAutoCalculating(false);
      setStatusMsg('✓ Calculated compatible talkback frequencies!');
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

  // Frequency nudging for individual carriers
  const handleCarrierNudge = (id: string, field: 'tx' | 'rx', dir: -1 | 1) => {
    setCarriers(prev =>
      prev.map(c => {
        if (c.id !== id) return c;
        if (c.locked) return c;
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

  // Add a single custom frequency
  const handleAddCustomCarrier = () => {
    const txVal = parseFloat(newTxInput);
    const rxVal = newTypeInput === 'DUPLEX' ? parseFloat(newRxInput) : 0;
    if (isNaN(txVal) || txVal < 100 || txVal > 990) {
      Alert.alert('Invalid TX Frequency', 'Please enter a valid frequency between 400.000 and 470.000 MHz.');
      return;
    }
    const newCarrier: CustomCarrierInput = {
      id: `custom_${Date.now()}`,
      tx: Number(txVal.toFixed(5)),
      rx: newTypeInput === 'DUPLEX' && !isNaN(rxVal) ? Number(rxVal.toFixed(5)) : 0,
      label: newLabelInput.trim() || `Ch ${carriers.length + 1}`,
      type: newTypeInput,
      txBw: newBwInput,
      rxBw: newBwInput,
      active: true,
      locked: false
    };
    setCarriers(prev => [...prev, newCarrier]);
    // Center spectrum on new frequency
    setCenterFreq(txVal);
    setCenterFreqInput(txVal.toFixed(5));
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
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const tapX = evt.nativeEvent.locationX;
        const tappedFreq = Math.round((startFreq + (tapX / canvasWidth) * span) * 100000) / 100000;
        if (isDeltaMode) {
          if (deltaStep === 1) {
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
            <Text style={screenStyles.headerSub}>CUSTOM FREQUENCY ENTRY &amp; INTERMOD COMPATIBILITY SOLVER</Text>
          </View>
        </View>
        {onClose && (
          <TouchableOpacity style={screenStyles.closeBtn} onPress={onClose}>
            <Text style={screenStyles.closeBtnText}>✕ CLOSE</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={{ flex: 1 }} stickyHeaderIndices={[1]} contentContainerStyle={{ padding: 10, paddingBottom: 60 }}>
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

        {/* ================= SPECTRUM CRT DISPLAY (FROZEN / STICKY AT TOP) ================= */}
        <View style={[screenStyles.displayCard, { backgroundColor: '#020813', zIndex: 100, elevation: 10, borderBottomWidth: 1, borderBottomColor: '#1e3a5f' }]}>
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
            onLayout={(e) => setCanvasWidth(Math.max(280, e.nativeEvent.layout.width))}
          >
            <Svg width="100%" height={CANVAS_HEIGHT}>
              {/* Background */}
              <Rect x="0" y="0" width="100%" height={CANVAS_HEIGHT} fill="#020813" />

              {/* Grid Lines */}
              {showGrid && (
                <>
                  {[0, -20, -40, -60, -80, -100].map(dbm => {
                    const y = dbmToY(dbm);
                    const labelY = dbm === 0 ? y + 8 : (dbm === -100 ? y - 3 : y - 2);
                    const textLabel = dbm === 0 ? '0 dBm' : `${dbm}`;
                    return (
                      <G key={`g_dbm_${dbm}`}>
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
                          x={canvasWidth - 5}
                          y={labelY}
                          fill="#3b6e8c"
                          fontSize="7.5"
                          fontWeight="bold"
                          fontFamily={Platform.OS === 'ios' ? 'Courier' : 'monospace'}
                          textAnchor="end"
                        >
                          {textLabel}
                        </SvgText>
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
                    <Polygon points={`${x - 2},${topY + 4} ${x + 2},${topY + 4} ${x},${topY}`} fill={color} />
                    <SvgText x={x} y={topY - 3} fill={color} fontSize="6.5" textAnchor="middle">
                      {isClash ? '⚠️' : ''}{imd.type === '2-Tone' ? '2T' : '3T'}
                    </SvgText>
                  </G>
                );
              })}

              {/* Active Carriers (Base TX, Portable RX, Walkie, IFB) */}
              {carriers.filter(c => c.active).map((c, idx) => {
                const xTx = freqToX(c.tx);
                const xRx = c.type === 'DUPLEX' ? freqToX(c.rx) : null;
                const hasTxClash = conflicts.some(con => con.targetCarrier.includes(c.label) || Math.abs(con.targetFreq - c.tx) < 0.001);
                const hasRxClash = xRx !== null && conflicts.some(con => con.targetCarrier.includes(c.label) || Math.abs(con.targetFreq - c.rx) < 0.001);

                const baseY = TOP_MARGIN + PLOT_HEIGHT;
                const txPeakY = dbmToY(c.type === 'BASE_TX' ? -10 : -14);
                const rxPeakY = dbmToY(-20);
                const chNum = getCarrierChannelNumber(c, idx);

                // Exact channel bandwidth in MHz (12.5 kHz = 0.0125 MHz, 25 kHz = 0.025 MHz, 50 kHz = 0.050 MHz)
                const txBwMhz = (typeof c.txBw === 'number' && c.txBw > 0)
                  ? (c.txBw > 1 ? c.txBw / 1000 : c.txBw)
                  : 0.0125;
                const rxBwMhz = (typeof c.rxBw === 'number' && c.rxBw > 0)
                  ? (c.rxBw > 1 ? c.rxBw / 1000 : c.rxBw)
                  : txBwMhz;

                // Exact physical spectrum footprint on the canvas graticule
                const txLeftX = freqToX(c.tx - txBwMhz / 2);
                const txRightX = freqToX(c.tx + txBwMhz / 2);
                const txHalfBwPx = (txRightX - txLeftX) / 2;

                const rxLeftX = xRx !== null ? freqToX(c.rx - rxBwMhz / 2) : 0;
                const rxRightX = xRx !== null ? freqToX(c.rx + rxBwMhz / 2) : 0;
                const rxHalfBwPx = (rxRightX - rxLeftX) / 2;

                const txPath = `M ${txLeftX} ${baseY} Q ${txLeftX + txHalfBwPx * 0.45} ${baseY} ${xTx - Math.max(1, txHalfBwPx * 0.12)} ${txPeakY + 2} L ${xTx} ${txPeakY} L ${xTx + Math.max(1, txHalfBwPx * 0.12)} ${txPeakY + 2} Q ${txRightX - txHalfBwPx * 0.45} ${baseY} ${txRightX} ${baseY} Z`;
                const rxPath = `M ${rxLeftX} ${baseY} Q ${rxLeftX + rxHalfBwPx * 0.45} ${baseY} ${(xRx || 0) - Math.max(1, rxHalfBwPx * 0.12)} ${rxPeakY + 2} L ${xRx || 0} ${rxPeakY} L ${(xRx || 0) + Math.max(1, rxHalfBwPx * 0.12)} ${rxPeakY + 2} Q ${rxRightX - rxHalfBwPx * 0.45} ${baseY} ${rxRightX} ${baseY} Z`;

                return (
                  <G key={`carrier_${c.id}`}>
                    {/* TX Carrier Peak */}
                    {xTx >= -40 && xTx <= canvasWidth + 40 && (
                      <G>
                        {fillSpikes && (
                          <Path
                            d={txPath}
                            fill={hasTxClash ? 'rgba(239, 68, 68, 0.4)' : 'rgba(250, 204, 21, 0.3)'}
                          />
                        )}
                        {/* Channel bandwidth footprint baseline bar */}
                        <Line x1={txLeftX} y1={baseY - 1} x2={txRightX} y2={baseY - 1} stroke={hasTxClash ? '#ef4444' : '#facc15'} strokeWidth="2.5" opacity="0.8" />
                        <Line x1={txLeftX} y1={baseY - 4} x2={txLeftX} y2={baseY + 1} stroke={hasTxClash ? '#ef4444' : '#facc15'} strokeWidth="1.2" opacity="0.8" />
                        <Line x1={txRightX} y1={baseY - 4} x2={txRightX} y2={baseY + 1} stroke={hasTxClash ? '#ef4444' : '#facc15'} strokeWidth="1.2" opacity="0.8" />

                        <Line x1={xTx} y1={txPeakY} x2={xTx} y2={baseY} stroke={hasTxClash ? '#ef4444' : '#facc15'} strokeWidth="2" />
                        <Circle cx={xTx} cy={txPeakY} r={3} fill={hasTxClash ? '#ef4444' : '#facc15'} />
                        <SvgText x={xTx} y={txPeakY - 4} fill={hasTxClash ? '#fca5a5' : '#fde047'} fontSize="7.5" fontWeight="bold" textAnchor="middle">
                          {hasTxClash ? '⚠️ ' : ''}{chNum}
                        </SvgText>
                      </G>
                    )}

                    {/* RX Carrier Peak (Duplex) */}
                    {xRx !== null && xRx >= -40 && xRx <= canvasWidth + 40 && (
                      <G>
                        {fillSpikes && (
                          <Path
                            d={rxPath}
                            fill={hasRxClash ? 'rgba(239, 68, 68, 0.4)' : 'rgba(56, 189, 248, 0.3)'}
                          />
                        )}
                        {/* Channel bandwidth footprint baseline bar */}
                        <Line x1={rxLeftX} y1={baseY - 1} x2={rxRightX} y2={baseY - 1} stroke={hasRxClash ? '#ef4444' : '#38bdf8'} strokeWidth="2.5" opacity="0.8" />
                        <Line x1={rxLeftX} y1={baseY - 4} x2={rxLeftX} y2={baseY + 1} stroke={hasRxClash ? '#ef4444' : '#38bdf8'} strokeWidth="1.2" opacity="0.8" />
                        <Line x1={rxRightX} y1={baseY - 4} x2={rxRightX} y2={baseY + 1} stroke={hasRxClash ? '#ef4444' : '#38bdf8'} strokeWidth="1.2" opacity="0.8" />

                        <Line x1={xRx} y1={rxPeakY} x2={xRx} y2={baseY} stroke={hasRxClash ? '#ef4444' : '#38bdf8'} strokeWidth="2" />
                        <Circle cx={xRx} cy={rxPeakY} r={3} fill={hasRxClash ? '#ef4444' : '#38bdf8'} />
                        <SvgText x={xRx} y={rxPeakY - 4} fill={hasRxClash ? '#fca5a5' : '#7dd3fc'} fontSize="7.5" fontWeight="bold" textAnchor="middle">
                          {hasRxClash ? '⚠️ ' : ''}{chNum}
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

          {/* Layer toggles */}
          <View style={screenStyles.layerToggleRow}>
            <TouchableOpacity
              style={[screenStyles.layerToggleBtn, showTwoTone && screenStyles.layerToggleActiveRed]}
              onPress={() => setShowTwoTone(!showTwoTone)}
            >
              <Text style={screenStyles.layerToggleText}>2-TONE IMD ({showTwoTone ? 'ON' : 'OFF'})</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[screenStyles.layerToggleBtn, showThreeTone && screenStyles.layerToggleActivePurple]}
              onPress={() => setShowThreeTone(!showThreeTone)}
            >
              <Text style={screenStyles.layerToggleText}>3-TONE IMD ({showThreeTone ? 'ON' : 'OFF'})</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[screenStyles.layerToggleBtn, isDeltaMode && screenStyles.layerToggleActiveBlue]}
              onPress={() => setIsDeltaMode(!isDeltaMode)}
            >
              <Text style={screenStyles.layerToggleText}>DELTA {isDeltaMode ? 'ACTIVE' : 'OFF'}</Text>
            </TouchableOpacity>
          </View>

          {/* ================= QUICK RF BAND PRESETS ================= */}
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
                const match = clusters.find(c => (c.min - f) <= 0.45 && (f - c.max) <= 0.45);
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

            const activeBaseCluster = baseClusters.find(c => Math.abs(centerFreq - c.center) < 1.0 && span < 9.0);
            const isBaseActive = !!activeBaseCluster;
            const activePortCluster = portClusters.find(c => Math.abs(centerFreq - c.center) < 1.0 && span < 9.0);
            const isPortActive = !!activePortCluster;
            const isDualActive = span >= 14 && centerFreq >= minAll - 3 && centerFreq <= maxAll + 3;

            const handleBaseClick = () => {
              if (baseClusters.length === 0) return;
              const curIdx = baseClusters.findIndex(c => Math.abs(centerFreq - c.center) < 1.0 && span < 9.0);
              const nextIdx = curIdx >= 0 ? (curIdx + 1) % baseClusters.length : 0;
              const target = baseClusters[nextIdx];
              setCenterFreq(target.center);
              setCenterFreqInput(target.center.toFixed(5));
              setSpan(target.span);
              setSpanInput(target.span.toFixed(2));
            };

            const handlePortClick = () => {
              if (portClusters.length === 0) return;
              const curIdx = portClusters.findIndex(c => Math.abs(centerFreq - c.center) < 1.0 && span < 9.0);
              const nextIdx = curIdx >= 0 ? (curIdx + 1) % portClusters.length : 0;
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
              <View style={screenStyles.quickBandRow}>
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

                <TextInput
                  style={screenStyles.stepperInput}
                  value={centerFreqInput}
                  onChangeText={setCenterFreqInput}
                  onBlur={handleCenterFreqInputCommit}
                  keyboardType="numeric"
                  selectTextOnFocus
                />

                <TouchableOpacity style={screenStyles.arrowBtn} onPress={() => handleCenterStep(1)}>
                  <Text style={screenStyles.arrowText}>STEP RIGHT ►</Text>
                </TouchableOpacity>
              </View>

              {/* Step Size Input Box */}
              <View style={screenStyles.stepSizeBox}>
                <Text style={screenStyles.stepSizePrefix}>Δ Step:</Text>
                <TextInput
                  style={screenStyles.stepSizeInput}
                  value={centerStepInput}
                  onChangeText={setCenterStepInput}
                  onBlur={handleCenterStepInputCommit}
                  keyboardType="numeric"
                  selectTextOnFocus
                />
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

                <TextInput
                  style={screenStyles.stepperInput}
                  value={spanInput}
                  onChangeText={setSpanInput}
                  onBlur={handleSpanInputCommit}
                  keyboardType="numeric"
                  selectTextOnFocus
                />

                <TouchableOpacity style={screenStyles.arrowBtn} onPress={() => handleSpanStep(1)}>
                  <Text style={screenStyles.arrowText}>+ ZOOM OUT</Text>
                </TouchableOpacity>
              </View>

              <View style={screenStyles.stepSizeBox}>
                <Text style={screenStyles.stepSizePrefix}>Δ Step:</Text>
                <TextInput
                  style={screenStyles.stepSizeInput}
                  value={spanStepInput}
                  onChangeText={setSpanStepInput}
                  onBlur={handleSpanStepInputCommit}
                  keyboardType="numeric"
                  selectTextOnFocus
                />
              </View>
            </View>
          </View>
        </View>

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
                  Target <Text style={{ color: '#ffffff', fontWeight: 'bold' }}>{conf.targetCarrier}</Text> ({conf.targetFreq.toFixed(5)} MHz) clashed by product @ {conf.productFreq.toFixed(5)} MHz ({conf.carrierA} &amp; {conf.carrierB})
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* ================= ENTER YOUR OWN FREQUENCIES ================= */}
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
              ⚡ CHOOSE DUPLEX PRESETS (UK OFCOM / EU EUROPE / BESPOKE)
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

          {/* Single Add Form */}
          <View style={screenStyles.singleAddRow}>
            <View style={{ flex: 2 }}>
              <Text style={screenStyles.inputSubLabel}>Channel Name</Text>
              <TextInput
                style={screenStyles.textInput}
                value={newLabelInput}
                onChangeText={setNewLabelInput}
                placeholder="e.g. Floor 1"
                placeholderTextColor="#64748b"
              />
            </View>

            <View style={{ flex: 2 }}>
              <Text style={screenStyles.inputSubLabel}>Type</Text>
              <View style={{ flexDirection: 'row', gap: 2 }}>
                <TouchableOpacity
                  style={[screenStyles.typeBtn, newTypeInput === 'DUPLEX' && screenStyles.typeBtnActive]}
                  onPress={() => setNewTypeInput('DUPLEX')}
                >
                  <Text style={screenStyles.typeBtnText}>DUPLEX</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[screenStyles.typeBtn, newTypeInput === 'BASE_TX' && screenStyles.typeBtnActive]}
                  onPress={() => setNewTypeInput('BASE_TX')}
                >
                  <Text style={screenStyles.typeBtnText}>BASE TX</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={[screenStyles.singleAddRow, { marginTop: 6 }]}>
            <View style={{ flex: 2 }}>
              <Text style={screenStyles.inputSubLabel}>
                Base TX (MHz) {newDuplexDirection === 'BASE_HIGH' ? '(HIGH)' : '(LOW)'}
              </Text>
              <TextInput
                style={screenStyles.textInput}
                value={newTxInput}
                onChangeText={setNewTxInput}
                keyboardType="numeric"
              />
            </View>

            {newTypeInput === 'DUPLEX' && (
              <>
                <TouchableOpacity
                  style={screenStyles.swapMiniBtn}
                  onPress={handleSwapFormTxRx}
                  title="Swap TX and RX values"
                >
                  <Text style={screenStyles.swapMiniBtnText}>⇄</Text>
                </TouchableOpacity>

                <View style={{ flex: 2 }}>
                  <Text style={screenStyles.inputSubLabel}>
                    Port RX (MHz) {newDuplexDirection === 'BASE_HIGH' ? '(LOW)' : '(HIGH)'}
                  </Text>
                  <TextInput
                    style={screenStyles.textInput}
                    value={newRxInput}
                    onChangeText={setNewRxInput}
                    keyboardType="numeric"
                  />
                </View>
              </>
            )}

            <View style={{ flex: 1.5, justifyContent: 'flex-end' }}>
              <TouchableOpacity style={screenStyles.addBtn} onPress={handleAddCustomCarrier}>
                <Text style={screenStyles.addBtnText}>+ ADD</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ================= FREQUENCY LEDGER & NUDGE LIST ================= */}
        <View style={screenStyles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
            <Text style={screenStyles.cardTitle}>CHANNEL LEDGER &amp; RASTER NUDGE</Text>
            
            {/* Top Right Controls: Step Size Selector + Clear All Button */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
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

              {/* Clear All Button */}
              <TouchableOpacity
                style={screenStyles.clearAllBtn}
                onPress={handleClearAllCarriers}
                activeOpacity={0.7}
              >
                <Text style={screenStyles.clearAllBtnText}>Clear All</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Header duplicating Tactical Spectrum Analyzer: PWR, #, LOCK, TYPE, BASE TX, SWAP, PORT TX, BW, DEL */}
          <View style={screenStyles.ledgerHeaderRow}>
            <Text style={[screenStyles.colHeader, { width: 20, textAlign: 'center' }]}>PWR</Text>
            <Text style={[screenStyles.colHeader, { width: 16, textAlign: 'center' }]}>#</Text>
            <View style={{ width: 16 }} />
            <Text style={[screenStyles.colHeader, { width: 24, textAlign: 'center' }]}>TYPE</Text>
            <Text style={[screenStyles.colHeader, { flex: 1, textAlign: 'center' }]}>BASE TX</Text>
            <View style={{ width: 16 }} />
            <Text style={[screenStyles.colHeader, { flex: 1, textAlign: 'center' }]}>PORT TX</Text>
            <Text style={[screenStyles.colHeader, { width: 36, textAlign: 'center' }]}>BW</Text>
            <Text style={[screenStyles.colHeader, { width: 20, textAlign: 'center' }]}>DEL</Text>
          </View>

          <View style={{ marginTop: 2, gap: 5 }}>
            {carriers.length === 0 ? (
              <View style={{ paddingVertical: 18, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#070d18', borderRadius: 6, borderWidth: 1, borderColor: '#1e293b', borderStyle: 'dashed' }}>
                <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: 'bold', marginBottom: 4 }}>NO FREQUENCIES IN SPECTRUM POOL</Text>
                <Text style={{ color: '#64748b', fontSize: 9.5, textAlign: 'center' }}>Enter your own custom frequencies above or tap ⚡ PRESETS to load frequency allocations.</Text>
              </View>
            ) : carriers.map((c, index) => {
              const isBaseHigh = c.type === 'DUPLEX' ? c.tx > c.rx : c.tx > 464;
              const curBwKhz = Math.round((c.txBw > 1 ? c.txBw : (c.txBw || 0.0125) * 1000) * 10) / 10;
              return (
                <View key={c.id} style={screenStyles.channelRow}>
                  {/* Active Toggle Dot (PWR) */}
                  <TouchableOpacity
                    style={{ width: 20, height: 22, alignItems: 'center', justifyContent: 'center' }}
                    onPress={() => {
                      setCarriers(prev => prev.map(item => item.id === c.id ? { ...item, active: !item.active } : item));
                    }}
                    hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                    activeOpacity={0.7}
                  >
                    <View style={{
                      width: 13,
                      height: 13,
                      borderRadius: 6.5,
                      backgroundColor: c.active ? '#10b981' : '#1e293b',
                      borderWidth: 1.5,
                      borderColor: c.active ? '#34d399' : '#475569',
                      alignItems: 'center',
                      justifyContent: 'center',
                      shadowColor: c.active ? '#10b981' : 'transparent',
                      shadowOpacity: 0.8,
                      shadowRadius: 3,
                      elevation: c.active ? 3 : 0
                    }}>
                      {c.active && (
                        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#ecfdf5' }} />
                      )}
                    </View>
                  </TouchableOpacity>

                  {/* Channel Number Badge: # */}
                  <View style={{ width: 16, height: 19, borderRadius: 3, backgroundColor: '#070f1a', borderWidth: 1, borderColor: '#334155', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#38bdf8', fontSize: 8.5, fontWeight: '900', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>{getCarrierChannelNumber(c, index)}</Text>
                  </View>

                  {/* Lock Button */}
                  <TouchableOpacity
                    onPress={() => {
                      setCarriers(prev => prev.map(item => item.id === c.id ? { ...item, locked: !item.locked } : item));
                    }}
                    style={{ width: 16, height: 20, alignItems: 'center', justifyContent: 'center' }}
                    hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                    activeOpacity={0.6}
                  >
                    <HardwarePadlockIcon locked={!!c.locked} size={14} />
                  </TouchableOpacity>

                  {/* TYPE Badge */}
                  <View style={{ width: 24, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={screenStyles.channelType}>
                      {c.type === 'DUPLEX' ? 'DPX' : (c.type === 'BASE_TX' ? 'BASE' : (c.type === 'PORT_TX' ? 'PORT' : 'WLK'))}
                    </Text>
                  </View>

                  {/* BASE TX Frequency with Left / Right Nudge Arrows */}
                  <View style={[screenStyles.nudgeGroup, { flex: 1, justifyContent: 'center' }]}>
                    <TouchableOpacity
                      style={[screenStyles.sideArrowBtn, c.locked && { opacity: 0.3 }]}
                      onPress={() => !c.locked && handleCarrierNudge(c.id, 'tx', -1)}
                      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                      disabled={c.locked}
                    >
                      <Text style={screenStyles.sideArrowText}>▼</Text>
                    </TouchableOpacity>
                    <View style={[screenStyles.freqNudgeBox, c.locked && screenStyles.freqNudgeBoxLocked]}>
                      <Text
                        numberOfLines={1}
                        style={[screenStyles.freqNudgeVal, c.locked && { color: "#4ade80" }]}
                      >
                        {(c.tx != null && !isNaN(c.tx) ? c.tx : 0).toFixed(5)}
                      </Text>
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

                  {/* Quick Swap TX/RX for single channel (or aligned spacer) */}
                  {c.type === 'DUPLEX' ? (
                    <TouchableOpacity
                      style={screenStyles.rowSwapBtn}
                      onPress={() => !c.locked && handleSwapSingleCarrier(c.id)}
                      disabled={c.locked}
                      title="Swap Base TX and Port RX"
                    >
                      <Text style={screenStyles.rowSwapBtnText}>⇄</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={{ width: 16 }} />
                  )}

                  {/* PORT TX Frequency with Left / Right Nudge Arrows */}
                  {c.type === 'DUPLEX' ? (
                    <View style={[screenStyles.nudgeGroup, { flex: 1, justifyContent: 'center' }]}>
                      <TouchableOpacity
                        style={[screenStyles.sideArrowBtn, c.locked && { opacity: 0.3 }]}
                        onPress={() => !c.locked && handleCarrierNudge(c.id, 'rx', -1)}
                        hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                        disabled={c.locked}
                      >
                        <Text style={screenStyles.sideArrowText}>▼</Text>
                      </TouchableOpacity>
                      <View style={[screenStyles.freqNudgeBox, c.locked && screenStyles.freqNudgeBoxLocked]}>
                        <Text
                          numberOfLines={1}
                          style={[screenStyles.freqNudgeVal, c.locked ? { color: "#4ade80" } : { color: isBaseHigh ? "#86efac" : "#38bdf8" }]}
                        >
                          {(c.rx != null && !isNaN(c.rx) ? c.rx : 0).toFixed(5)}
                        </Text>
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
                  ) : (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={screenStyles.simplexPlaceholderText}>— SIMPLEX —</Text>
                    </View>
                  )}

                  {/* BANDWIDTH (BW) COLUMN */}
                  <TouchableOpacity
                    style={screenStyles.bwBadgeBox}
                    onPress={() => !c.locked && handleCycleCarrierBw(c.id)}
                    activeOpacity={0.7}
                    title="Tap to cycle channel bandwidth (12.5k, 25k, 50k)"
                  >
                    <Text style={screenStyles.bwBadgeText}>
                      {curBwKhz}k
                    </Text>
                  </TouchableOpacity>

                  {/* Delete Button */}
                  <TouchableOpacity
                    style={{ width: 20, height: 22, alignItems: 'center', justifyContent: 'center' }}
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
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#334155',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#475569'
  },
  closeBtnText: {
    color: '#ffffff',
    fontSize: 10.5,
    fontWeight: '900'
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
    gap: 6,
    marginTop: 8
  },
  layerToggleBtn: {
    flex: 1,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155'
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
    fontSize: 8,
    fontWeight: 'bold'
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
    color: '#64748b',
    fontSize: 8,
    fontWeight: 'bold',
    marginBottom: 2
  },
  textInput: {
    backgroundColor: '#020617',
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#334155'
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
  ledgerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    paddingBottom: 4,
    marginBottom: 6,
    paddingHorizontal: 2,
    gap: 2,
    width: '100%'
  },
  colHeader: {
    color: '#38bdf8',
    fontSize: 8.5,
    fontWeight: 'bold',
    letterSpacing: 0.5
  },
  simplexPlaceholderText: {
    color: '#475569',
    fontSize: 8,
    fontWeight: 'bold',
    letterSpacing: 0.5
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
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#020617',
    paddingHorizontal: 2,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#1e293b',
    gap: 2,
    width: '100%'
  },
  toggleDot: {
    padding: 2
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
    gap: 1
  },
  sideArrowBtn: {
    width: 14,
    height: 22,
    backgroundColor: '#1e293b',
    borderRadius: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#475569'
  },
  sideArrowText: {
    color: '#38bdf8',
    fontSize: 8,
    fontWeight: 'bold',
    lineHeight: 10
  },
  rowSwapBtn: {
    width: 16,
    height: 22,
    backgroundColor: '#1e293b',
    borderRadius: 2.5,
    borderWidth: 1,
    borderColor: '#38bdf8',
    alignItems: 'center',
    justifyContent: 'center'
  },
  rowSwapBtnText: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: 'bold'
  },
  freqNudgeBox: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
    paddingHorizontal: 0,
    paddingVertical: 1,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#334155',
    minHeight: 22,
    minWidth: 50,
    flex: 1
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
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: -0.3
  },
  bwBadgeBox: {
    width: 36,
    height: 22,
    backgroundColor: '#0f172a',
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#38bdf8',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 1
  },
  bwBadgeText: {
    color: '#38bdf8',
    fontSize: 8.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '900',
    textAlign: 'center'
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
  clearAllBtn: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: '#3f1212',
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center'
  },
  clearAllBtnText: {
    color: '#fca5a5',
    fontSize: 8.5,
    fontWeight: 'bold',
    letterSpacing: 0.3
  }
});
