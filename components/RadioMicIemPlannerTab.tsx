import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { 
  Mic2, 
  Headphones, 
  Radio, 
  Lock, 
  Unlock, 
  Play, 
  RefreshCw, 
  Download, 
  FileText, 
  Plus, 
  Trash2, 
  ZoomIn, 
  ZoomOut, 
  ChevronLeft, 
  ChevronRight, 
  AlertTriangle, 
  CheckCircle2, 
  Sliders, 
  Layers, 
  Tv, 
  Settings, 
  Share2, 
  Copy, 
  ShieldAlert, 
  Activity,
  Maximize2,
  Minimize2,
  ArrowRightLeft,
  Sparkles,
  Info
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { UK_TV_CHANNELS, US_TV_CHANNELS, EQUIPMENT_DATABASE } from '../constants';

// ================= HARDWARE PADLOCK ICON =================
export const HardwarePadlockIcon: React.FC<{ locked: boolean; size?: number; className?: string }> = ({ locked, size = 16, className = "" }) => {
  if (locked) {
    return (
      <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className}>
        <path d="M 6.5 8 V 4.5 C 6.5 2.5 13.5 2.5 13.5 4.5 V 8" stroke="#facc15" strokeWidth="2" strokeLinecap="round" />
        <rect x="3.5" y="8" width="13" height="10" rx="2" fill="#ca8a04" stroke="#fde047" strokeWidth="1.2" />
        <circle cx="10" cy="11.8" r="1.3" fill="#422006" />
        <path d="M 9.3 12.3 L 10.7 12.3 L 10.4 15.2 L 9.6 15.2 Z" fill="#422006" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className}>
      <path d="M 6.5 7.5 V 4 C 6.5 2 0.5 2 0.5 4 V 6.8" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
      <rect x="3.5" y="8" width="13" height="10" rx="2" fill="#1e293b" stroke="#64748b" strokeWidth="1.2" />
      <circle cx="13.5" cy="8" r="1.1" fill="#0f172a" />
      <circle cx="10" cy="11.8" r="1.3" fill="#0f172a" />
      <path d="M 9.3 12.3 L 10.7 12.3 L 10.4 15.2 L 9.6 15.2 Z" fill="#0f172a" />
    </svg>
  );
};

// ================= DATA TYPES =================
export type DeviceType = 'MIC' | 'IEM';
export type TVChannelStatus = 'available' | 'blocked' | 'mic-only' | 'iem-only';
export type CompatibilityPreset = 'standard' | 'robust' | 'aggressive';

export interface ChannelRequestGroup {
  id: string;
  name: string;
  type: DeviceType;
  equipmentKey: string;
  quantity: number;
  zoneId: string;
  linearDigitalMode?: boolean;
  customMin?: number;
  customMax?: number;
  customStep?: number;
  color?: string;
}

export interface CoordinatedChannel {
  id: string;
  groupId: string;
  channelName: string;
  zoneId: string;
  zoneName: string;
  type: DeviceType;
  equipmentName: string;
  freq: number; // in MHz (e.g. 518.250)
  locked: boolean;
  hasClash: boolean;
  clashReason?: string;
  tvChannel?: number;
  powerDbm: number;
}

export interface ZoneConfig {
  id: string;
  name: string;
  color: string;
}

export interface IntermodProduct {
  freq: number;
  type: '2-Tone' | '3-Tone';
  formula: string;
  sources: string[];
  hasClash: boolean;
}

// Preset popular equipment list
const PRESET_EQUIPMENT_OPTIONS = [
  { key: 'shure-ad-g56', name: 'Shure Axient Digital (G56: 470-636 MHz)', type: 'MIC' as DeviceType, min: 470.125, max: 635.875, step: 0.025, digital: true },
  { key: 'shure-ad-g57', name: 'Shure Axient Digital (G57: 470-616 MHz)', type: 'MIC' as DeviceType, min: 470.125, max: 615.875, step: 0.025, digital: true },
  { key: 'shure-ad-k55', name: 'Shure Axient Digital (K55: 606-694 MHz)', type: 'MIC' as DeviceType, min: 606.125, max: 693.875, step: 0.025, digital: true },
  { key: 'shure-psm1000-g10', name: 'Shure PSM 1000 (G10: 470-542 MHz)', type: 'IEM' as DeviceType, min: 470.125, max: 541.875, step: 0.025, digital: false },
  { key: 'shure-psm1000-j8e', name: 'Shure PSM 1000 (J8E: 554-626 MHz)', type: 'IEM' as DeviceType, min: 554.125, max: 625.875, step: 0.025, digital: false },
  { key: 'shure-psm1000-k10e', name: 'Shure PSM 1000 (K10E: 596-668 MHz)', type: 'IEM' as DeviceType, min: 596.125, max: 667.875, step: 0.025, digital: false },
  { key: 'shure-psm1000-l8', name: 'Shure PSM 1000 (L8: 626-698 MHz)', type: 'IEM' as DeviceType, min: 626.125, max: 697.875, step: 0.025, digital: false },
  { key: 'shure-ulxd-g51', name: 'Shure ULX-D / QLX-D (G51: 470-534 MHz)', type: 'MIC' as DeviceType, min: 470.125, max: 533.875, step: 0.025, digital: true },
  { key: 'shure-ulxd-k51', name: 'Shure ULX-D / QLX-D (K51: 606-670 MHz)', type: 'MIC' as DeviceType, min: 606.125, max: 669.875, step: 0.025, digital: true },
  { key: 'sennheiser-d6000-a1a4', name: 'Sennheiser D6000 (A1-A4: 470-558 MHz)', type: 'MIC' as DeviceType, min: 470.200, max: 557.875, step: 0.025, digital: true },
  { key: 'sennheiser-d6000-a5a8', name: 'Sennheiser D6000 (A5-A8: 550-638 MHz)', type: 'MIC' as DeviceType, min: 550.125, max: 637.875, step: 0.025, digital: true },
  { key: 'sennheiser-2000iem-aw', name: 'Sennheiser 2000 IEM (Aw: 516-558 MHz)', type: 'IEM' as DeviceType, min: 516.125, max: 557.875, step: 0.025, digital: false },
  { key: 'sennheiser-2000iem-gw', name: 'Sennheiser 2000 IEM (Gw: 558-626 MHz)', type: 'IEM' as DeviceType, min: 558.125, max: 625.875, step: 0.025, digital: false },
  { key: 'sennheiser-2000iem-bw', name: 'Sennheiser 2000 IEM (Bw: 626-668 MHz)', type: 'IEM' as DeviceType, min: 626.125, max: 667.875, step: 0.025, digital: false },
  { key: 'sennheiser-ewg4-gb', name: 'Sennheiser EW-G4 (GB: 606-648 MHz)', type: 'MIC' as DeviceType, min: 606.125, max: 647.875, step: 0.025, digital: false },
  { key: 'wisycom-mtk952', name: 'Wisycom MTK952 (Wideband IEM: 470-694 MHz)', type: 'IEM' as DeviceType, min: 470.125, max: 693.875, step: 0.025, digital: false },
  { key: 'wisycom-mrk16', name: 'Wisycom MRK16 / MTP60 (Wideband Mics: 470-694 MHz)', type: 'MIC' as DeviceType, min: 470.125, max: 693.875, step: 0.025, digital: false },
  { key: 'lectro-dsqd', name: 'Lectrosonics D-Squared (A1B1: 470.1-607.9 MHz)', type: 'MIC' as DeviceType, min: 470.100, max: 607.900, step: 0.100, digital: false },
  { key: 'custom-uhf', name: 'Custom UHF Band (User Defined)', type: 'MIC' as DeviceType, min: 470.000, max: 694.000, step: 0.025, digital: false },
];

export const RadioMicIemPlannerTab: React.FC = () => {
  // Navigation / View Tabs
  const [activeView, setActiveView] = useState<'PLANNER' | 'SPECTRUM' | 'INTERMODS' | 'TV_GRID' | 'ZONES'>('PLANNER');

  // Zones State
  const [zones, setZones] = useState<ZoneConfig[]>([
    { id: 'z1', name: 'Main Stage', color: '#10b981' },
    { id: 'z2', name: 'Stage B / Acoustic', color: '#38bdf8' },
    { id: 'z3', name: 'Presenters & Roaming', color: '#facc15' },
    { id: 'z4', name: 'In-Ear Transmit Rack', color: '#a855f7' }
  ]);
  const [activeZoneFilter, setActiveZoneFilter] = useState<string>('ALL');

  // Channel Request Groups
  const [requestGroups, setRequestGroups] = useState<ChannelRequestGroup[]>([
    {
      id: 'grp_1',
      name: 'Lead Vocals & Guest Mics',
      type: 'MIC',
      equipmentKey: 'shure-ad-g56',
      quantity: 8,
      zoneId: 'z1',
      linearDigitalMode: true,
      color: '#facc15'
    },
    {
      id: 'grp_2',
      name: 'Artist & Band In-Ear Monitors',
      type: 'IEM',
      equipmentKey: 'shure-psm1000-g10',
      quantity: 6,
      zoneId: 'z1',
      linearDigitalMode: false,
      color: '#38bdf8'
    },
    {
      id: 'grp_3',
      name: 'Stage B Acoustic Mics',
      type: 'MIC',
      equipmentKey: 'sennheiser-d6000-a1a4',
      quantity: 4,
      zoneId: 'z2',
      linearDigitalMode: true,
      color: '#facc15'
    },
    {
      id: 'grp_4',
      name: 'Stage B IEM Mixes',
      type: 'IEM',
      equipmentKey: 'sennheiser-2000iem-aw',
      quantity: 3,
      zoneId: 'z2',
      linearDigitalMode: false,
      color: '#38bdf8'
    }
  ]);

  // Coordinated Channels Result
  const [channels, setChannels] = useState<CoordinatedChannel[]>([]);
  const [isCoordinating, setIsCoordinating] = useState<boolean>(false);

  // TV Channel Management
  const [tvRegion, setTvRegion] = useState<'UK' | 'US'>('UK');
  const [tvChannelStates, setTvChannelStates] = useState<Record<number, TVChannelStatus>>({
    21: 'available', 22: 'available', 23: 'available', 24: 'blocked',
    25: 'available', 26: 'available', 27: 'blocked',   28: 'available',
    29: 'available', 30: 'available', 31: 'blocked',   32: 'available',
    33: 'available', 34: 'available', 35: 'available', 36: 'available',
    37: 'available', 38: 'available', 39: 'available', 40: 'available'
  });

  // Coordination parameters
  const [compatibility, setCompatibility] = useState<CompatibilityPreset>('standard');
  const [customMicFundamental, setCustomMicFundamental] = useState<number>(0.350); // 350 kHz
  const [customIemFundamental, setCustomIemFundamental] = useState<number>(0.375); // 375 kHz
  const [customImd3Guard, setCustomImd3Guard] = useState<number>(0.050); // 50 kHz

  // Spectrum Display Controls
  const [centerFreq, setCenterFreq] = useState<number>(510.00000);
  const [centerFreqInput, setCenterFreqInput] = useState<string>('510.00000');
  const [span, setSpan] = useState<number>(40.0);
  const [spanInput, setSpanInput] = useState<string>('40.0');
  const [nudgeStepKhz, setNudgeStepKhz] = useState<number>(25);
  const [traceMode, setTraceMode] = useState<'LIVE' | 'MAX_HOLD'>('LIVE');
  const [showTwoTone, setShowTwoTone] = useState<boolean>(true);
  const [showThreeTone, setShowThreeTone] = useState<boolean>(true);
  const [marker1, setMarker1] = useState<number | null>(null);
  const [marker2, setMarker2] = useState<number | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);

  // Canvas layout dimensions
  const CANVAS_HEIGHT = 230;
  const TOP_MARGIN = 24;
  const BOTTOM_MARGIN = 28;
  const PLOT_HEIGHT = CANVAS_HEIGHT - TOP_MARGIN - BOTTOM_MARGIN;
  const NOISE_FLOOR_DBM = -95;
  const REF_LEVEL_DBM = 0;

  const startFreq = centerFreq - span / 2;
  const stopFreq = centerFreq + span / 2;

  const freqToX = useCallback((f: number, width: number) => {
    if (span <= 0 || width <= 0) return 0;
    return ((f - startFreq) / span) * width;
  }, [startFreq, span]);

  const dbmToY = (dbm: number) => {
    const clamped = Math.max(NOISE_FLOOR_DBM, Math.min(REF_LEVEL_DBM, dbm));
    const ratio = (clamped - NOISE_FLOOR_DBM) / (REF_LEVEL_DBM - NOISE_FLOOR_DBM);
    return TOP_MARGIN + PLOT_HEIGHT * (1 - ratio);
  };

  // Helper: map frequency to TV channel
  const getTvChannelForFreq = useCallback((freq: number): number | undefined => {
    const table = tvRegion === 'UK' ? UK_TV_CHANNELS : US_TV_CHANNELS;
    for (const [chStr, range] of Object.entries(table)) {
      const ch = parseInt(chStr, 10);
      if (freq >= range[0] && freq <= range[1]) {
        return ch;
      }
    }
    return undefined;
  }, [tvRegion]);

  // Calculate 2-Tone and 3-Tone Intermod Products
  const intermodProducts = useMemo(() => {
    const list: IntermodProduct[] = [];
    const activeRadiating = channels.filter(c => c.freq > 0);
    const n = activeRadiating.length;
    if (n < 2) return list;

    // 2-Tone IMD: 2*fA - fB
    if (showTwoTone) {
      for (let a = 0; a < n; a++) {
        for (let b = 0; b < n; b++) {
          if (a === b) continue;
          const fA = activeRadiating[a].freq;
          const fB = activeRadiating[b].freq;
          const p = Math.round((2 * fA - fB) * 100000) / 100000;
          if (p >= startFreq - 2 && p <= stopFreq + 2) {
            // Check clash with threshold <= 0.005 MHz (5 kHz passband)
            const clash = activeRadiating.some(c => Math.abs(c.freq - p) <= 0.005);
            list.push({
              freq: p,
              type: '2-Tone',
              formula: `2*(${fA.toFixed(3)}) - ${fB.toFixed(3)}`,
              sources: [activeRadiating[a].channelName, activeRadiating[b].channelName],
              hasClash: clash
            });
          }
        }
      }
    }

    // 3-Tone IMD: fA + fB - fC
    if (showThreeTone && n >= 3) {
      for (let a = 0; a < n; a++) {
        for (let b = a + 1; b < n; b++) {
          for (let c = 0; c < n; c++) {
            if (c === a || c === b) continue;
            const fA = activeRadiating[a].freq;
            const fB = activeRadiating[b].freq;
            const fC = activeRadiating[c].freq;
            const p = Math.round((fA + fB - fC) * 100000) / 100000;
            if (p >= startFreq - 2 && p <= stopFreq + 2) {
              const clash = activeRadiating.some(ch => Math.abs(ch.freq - p) <= 0.005);
              list.push({
                freq: p,
                type: '3-Tone',
                formula: `${fA.toFixed(3)} + ${fB.toFixed(3)} - ${fC.toFixed(3)}`,
                sources: [activeRadiating[a].channelName, activeRadiating[b].channelName, activeRadiating[c].channelName],
                hasClash: clash
              });
            }
          }
        }
      }
    }

    return list;
  }, [channels, showTwoTone, showThreeTone, startFreq, stopFreq]);

  // Real-time Clash Audit across all channels
  const auditClashes = useCallback((channelList: CoordinatedChannel[]): CoordinatedChannel[] => {
    return channelList.map(target => {
      if (target.freq <= 0) return { ...target, hasClash: false, clashReason: undefined };

      // 1. Direct Co-Channel / Fundamental spacing clash with other channels
      const fThresh = target.type === 'MIC' ? customMicFundamental : customIemFundamental;
      for (const other of channelList) {
        if (other.id === target.id || other.freq <= 0) continue;
        const delta = Math.abs(target.freq - other.freq);
        if (delta < fThresh - 0.0001) {
          return {
            ...target,
            hasClash: true,
            clashReason: `Fundamental conflict with ${other.channelName} (Δ ${(delta * 1000).toFixed(1)} kHz < ${(fThresh * 1000).toFixed(0)} kHz)`
          };
        }
      }

      // 2. Intermod collision check (threshold <= 0.005 MHz / 5 kHz passband)
      for (let a = 0; a < channelList.length; a++) {
        for (let b = 0; b < channelList.length; b++) {
          if (a === b) continue;
          const ca = channelList[a];
          const cb = channelList[b];
          if (ca.id === target.id || cb.id === target.id || ca.freq <= 0 || cb.freq <= 0) continue;

          // 2-Tone 3rd: 2*fA - fB
          const imd2 = 2 * ca.freq - cb.freq;
          if (Math.abs(target.freq - imd2) <= 0.005) {
            return {
              ...target,
              hasClash: true,
              clashReason: `2TX 3rd IMD clash: hits 2*(${ca.channelName}) - (${cb.channelName}) @ ${imd2.toFixed(3)} MHz`
            };
          }

          // 3-Tone 3rd: fA + fB - fC
          for (let c = 0; c < channelList.length; c++) {
            if (c === a || c === b) continue;
            const cc = channelList[c];
            if (cc.id === target.id || cc.freq <= 0) continue;
            const imd3 = ca.freq + cb.freq - cc.freq;
            if (Math.abs(target.freq - imd3) <= 0.005) {
              return {
                ...target,
                hasClash: true,
                clashReason: `3TX 3rd IMD clash: hits (${ca.channelName}) + (${cb.channelName}) - (${cc.channelName}) @ ${imd3.toFixed(3)} MHz`
              };
            }
          }
        }
      }

      // 3. TV Channel exclusion check
      const tvCh = getTvChannelForFreq(target.freq);
      if (tvCh && tvChannelStates[tvCh]) {
        const state = tvChannelStates[tvCh];
        if (state === 'blocked') {
          return { ...target, hasClash: true, clashReason: `Located in blocked TV Ch ${tvCh}` };
        }
        if (state === 'mic-only' && target.type === 'IEM') {
          return { ...target, hasClash: true, clashReason: `IEM located in Mic-Only TV Ch ${tvCh}` };
        }
        if (state === 'iem-only' && target.type === 'MIC') {
          return { ...target, hasClash: true, clashReason: `Mic located in IEM-Only TV Ch ${tvCh}` };
        }
      }

      return { ...target, hasClash: false, clashReason: undefined };
    });
  }, [customMicFundamental, customIemFundamental, getTvChannelForFreq, tvChannelStates]);

  // Master Coordination Engine: Generates Clean Frequencies
  const runCoordination = useCallback(() => {
    setIsCoordinating(true);
    toast.info("Calculating optimal compatible frequencies...");

    setTimeout(() => {
      try {
        const newChannels: CoordinatedChannel[] = [];
        const placedFreqs: { freq: number; type: DeviceType; isDigital: boolean; id: string }[] = [];

        // Retain currently locked frequencies first
        channels.forEach(ch => {
          if (ch.locked && ch.freq > 0) {
            newChannels.push(ch);
            placedFreqs.push({
              freq: ch.freq,
              type: ch.type,
              isDigital: !!requestGroups.find(g => g.id === ch.groupId)?.linearDigitalMode,
              id: ch.id
            });
          }
        });

        // Loop through each group to allocate unlocked channels
        requestGroups.forEach(grp => {
          const zone = zones.find(z => z.id === grp.zoneId) || zones[0];
          const preset = PRESET_EQUIPMENT_OPTIONS.find(p => p.key === grp.equipmentKey) || PRESET_EQUIPMENT_OPTIONS[0];

          const min = grp.customMin ?? preset.min;
          const max = grp.customMax ?? preset.max;
          const step = grp.customStep ?? preset.step;
          const isDigital = !!grp.linearDigitalMode;
          const power = grp.type === 'IEM' ? -10 : -18;

          // Candidate pool
          const candidateFreqs: number[] = [];
          for (let f = min; f <= max + 0.0001; f = Math.round((f + step) * 10000) / 10000) {
            // Check TV channel exclusion
            const tvCh = getTvChannelForFreq(f);
            if (tvCh && tvChannelStates[tvCh]) {
              const state = tvChannelStates[tvCh];
              if (state === 'blocked') continue;
              if (state === 'mic-only' && grp.type === 'IEM') continue;
              if (state === 'iem-only' && grp.type === 'MIC') continue;
            }
            candidateFreqs.push(f);
          }

          // Generate requested quantity
          for (let q = 1; q <= grp.quantity; q++) {
            const chId = `${grp.id}_ch_${q}`;
            // If already locked, skip
            if (newChannels.some(c => c.id === chId)) continue;

            const chLabel = `${grp.name} #${q}`;
            let bestFreq: number = 0;

            // Search candidate with zero clashes
            for (const cand of candidateFreqs) {
              // 1. Fundamental spacing against all already placed frequencies
              const fGuard = grp.type === 'MIC' ? customMicFundamental : customIemFundamental;
              const fundConflict = placedFreqs.some(p => Math.abs(p.freq - cand) < fGuard - 0.0001);
              if (fundConflict) continue;

              // 2. Intermod check (unless pure linear digital mode)
              let imdConflict = false;
              if (!isDigital) {
                for (let a = 0; a < placedFreqs.length; a++) {
                  for (let b = 0; b < placedFreqs.length; b++) {
                    if (a === b) continue;
                    const fA = placedFreqs[a].freq;
                    const fB = placedFreqs[b].freq;

                    // 2-tone IMD collision
                    const imd2 = 2 * fA - fB;
                    if (Math.abs(cand - imd2) <= 0.005) {
                      imdConflict = true;
                      break;
                    }

                    // Candidate creates new 2-tone IMD landing on existing carrier
                    const newImd2A = 2 * cand - fA;
                    const newImd2B = 2 * fA - cand;
                    if (placedFreqs.some(p => Math.abs(p.freq - newImd2A) <= 0.005 || Math.abs(p.freq - newImd2B) <= 0.005)) {
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

            // Fallback: If strict IMD cannot be satisfied, pick highest spacing candidate
            if (bestFreq === 0 && candidateFreqs.length > 0) {
              bestFreq = candidateFreqs[q % candidateFreqs.length];
            }

            newChannels.push({
              id: chId,
              groupId: grp.id,
              channelName: chLabel,
              zoneId: zone.id,
              zoneName: zone.name,
              type: grp.type,
              equipmentName: preset.name,
              freq: bestFreq,
              locked: false,
              hasClash: false,
              tvChannel: getTvChannelForFreq(bestFreq),
              powerDbm: power
            });

            if (bestFreq > 0) {
              placedFreqs.push({
                freq: bestFreq,
                type: grp.type,
                isDigital,
                id: chId
              });
            }
          }
        });

        // Run full collision audit on final set
        const audited = auditClashes(newChannels);
        setChannels(audited);

        // Center the spectrum analyzer on the allocated frequencies
        if (audited.length > 0) {
          const validFreqs = audited.filter(c => c.freq > 0).map(c => c.freq);
          if (validFreqs.length > 0) {
            const minF = Math.min(...validFreqs);
            const maxF = Math.max(...validFreqs);
            const cF = Math.round(((minF + maxF) / 2) * 100000) / 100000;
            const newSpan = Math.max(15, Math.ceil((maxF - minF + 6) / 5) * 5);
            setCenterFreq(cF);
            setCenterFreqInput(cF.toFixed(5));
            setSpan(newSpan);
            setSpanInput(newSpan.toFixed(1));
          }
        }

        const clashCount = audited.filter(c => c.hasClash).length;
        if (clashCount === 0) {
          toast.success(`Coordination complete: ${audited.length} channels allocated 100% clash-free!`);
        } else {
          toast.warning(`Coordination completed with ${clashCount} warnings. Inspect ledger below.`);
        }
      } catch (err: any) {
        toast.error(`Coordination failed: ${err?.message || 'Unknown error'}`);
      } finally {
        setIsCoordinating(false);
      }
    }, 150);
  }, [channels, requestGroups, zones, customMicFundamental, customIemFundamental, getTvChannelForFreq, tvChannelStates, auditClashes]);

  // Initial auto-coordination on mount
  useEffect(() => {
    if (channels.length === 0) {
      runCoordination();
    }
  }, []);

  // Toggle frequency lock
  const toggleLock = (channelId: string) => {
    setChannels(prev => prev.map(c => c.id === channelId ? { ...c, locked: !c.locked } : c));
  };

  // Nudge frequency (+/- in kHz)
  const nudgeChannel = (channelId: string, deltaKhz: number) => {
    setChannels(prev => {
      const updated = prev.map(c => {
        if (c.id !== channelId) return c;
        const newFreq = Math.round((c.freq + deltaKhz / 1000) * 100000) / 100000;
        return {
          ...c,
          freq: newFreq,
          tvChannel: getTvChannelForFreq(newFreq)
        };
      });
      return auditClashes(updated);
    });
  };

  // Manual frequency input change
  const updateChannelFreq = (channelId: string, valStr: string) => {
    const parsed = parseFloat(valStr);
    if (isNaN(parsed) || parsed <= 0) return;
    setChannels(prev => {
      const updated = prev.map(c => {
        if (c.id !== channelId) return c;
        return {
          ...c,
          freq: parsed,
          tvChannel: getTvChannelForFreq(parsed)
        };
      });
      return auditClashes(updated);
    });
  };

  // Update Channel Name
  const updateChannelName = (channelId: string, name: string) => {
    setChannels(prev => prev.map(c => c.id === channelId ? { ...c, channelName: name } : c));
  };

  // Add a new channel request group
  const addRequestGroup = (type: DeviceType) => {
    const isMic = type === 'MIC';
    const newId = `grp_${Date.now()}`;
    const newGroup: ChannelRequestGroup = {
      id: newId,
      name: isMic ? `Wireless Mics Group ${requestGroups.length + 1}` : `IEM Mixes Group ${requestGroups.length + 1}`,
      type,
      equipmentKey: isMic ? 'shure-ad-g56' : 'shure-psm1000-g10',
      quantity: 4,
      zoneId: zones[0]?.id || 'z1',
      linearDigitalMode: isMic,
      color: isMic ? '#facc15' : '#38bdf8'
    };
    setRequestGroups(prev => [...prev, newGroup]);
    toast.success(`Added ${newGroup.name}`);
  };

  // Remove group
  const removeRequestGroup = (groupId: string) => {
    setRequestGroups(prev => prev.filter(g => g.id !== groupId));
    setChannels(prev => prev.filter(c => c.groupId !== groupId));
    toast.info("Group removed");
  };

  // Cycle TV Channel status
  const cycleTvChannel = (ch: number) => {
    setTvChannelStates(prev => {
      const cur = prev[ch] || 'available';
      let next: TVChannelStatus = 'blocked';
      if (cur === 'available') next = 'blocked';
      else if (cur === 'blocked') next = 'mic-only';
      else if (cur === 'mic-only') next = 'iem-only';
      else if (cur === 'iem-only') next = 'available';
      return { ...prev, [ch]: next };
    });
  };

  // Shure Wireless Workbench (WWB) CSV Export
  const exportWwbCsv = () => {
    let csv = "Zone,Frequency,Channel Name,Device,Type,Band\n";
    channels.forEach(c => {
      if (c.freq > 0) {
        csv += `"${c.zoneName}",${c.freq.toFixed(3)},"${c.channelName}","${c.equipmentName}","${c.type === 'MIC' ? 'Frequency' : 'In-ear Monitor'}",""\n`;
      }
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Radio_Mic_IEM_Coordination_WWB_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Exported Shure Wireless Workbench CSV!");
  };

  // Branded PDF Coordination Sheet Export
  const exportPdfSheet = () => {
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      // Header Banner
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, 210, 28, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(255, 255, 255);
      doc.text("RADIO MIC & IEM COORDINATION PLAN", 14, 12);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()} · Intermod-Proof RF Allocation`, 14, 19);
      doc.text(`Channels: ${channels.length} Total · Compatibility: ${compatibility.toUpperCase()}`, 14, 24);

      // Table Data
      const tableData = channels.map((c, i) => [
        (i + 1).toString(),
        c.channelName,
        c.zoneName,
        c.type,
        c.freq.toFixed(4) + ' MHz',
        c.tvChannel ? `Ch ${c.tvChannel}` : '-',
        c.equipmentName,
        c.hasClash ? `CLASH: ${c.clashReason || 'IMD'}` : 'CLEAR'
      ]);

      autoTable(doc, {
        startY: 34,
        head: [['#', 'Channel Name', 'Zone', 'Type', 'Frequency', 'TV Ch', 'Equipment Model', 'Status']],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [248, 250, 252],
          fontSize: 8,
          fontStyle: 'bold'
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [15, 23, 42]
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        columnStyles: {
          0: { cellWidth: 8 },
          3: { cellWidth: 14, fontStyle: 'bold' },
          4: { cellWidth: 26, fontStyle: 'bold' },
          5: { cellWidth: 14 },
          7: { cellWidth: 32 }
        }
      });

      doc.save(`Radio_Mic_IEM_Coordination_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("Exported Professional Coordination PDF!");
    } catch (err: any) {
      toast.error(`PDF export failed: ${err?.message || 'Error'}`);
    }
  };

  // Copy coordination list to clipboard
  const copyToClipboard = () => {
    const lines = [
      "CH\tCHANNEL NAME\tZONE\tTYPE\tFREQ (MHz)\tTV CH\tSTATUS",
      ...channels.map((c, idx) => 
        `${idx + 1}\t${c.channelName}\t${c.zoneName}\t${c.type}\t${c.freq.toFixed(4)}\t${c.tvChannel || '-'}\t${c.hasClash ? 'CLASH' : 'CLEAR'}`
      )
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    toast.success("Coordination copied to clipboard!");
  };

  // Filter channels according to active zone
  const visibleChannels = useMemo(() => {
    if (activeZoneFilter === 'ALL') return channels;
    return channels.filter(c => c.zoneId === activeZoneFilter);
  }, [channels, activeZoneFilter]);

  const clashCount = useMemo(() => channels.filter(c => c.hasClash).length, [channels]);

  return (
    <div className="flex flex-col gap-5 w-full max-w-[1720px] mx-auto pb-16 font-sans">
      
      {/* ================= TOP TACTICAL HEADER & WORKSPACE BANNER ================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-xl border border-white/10 bg-slate-900/90 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
            <Mic2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-black text-white uppercase tracking-wider">
                Radio Mic & IEM Planner
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                PRO SUITE
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              Multi-Stage Wireless Microphone & In-Ear Monitor RF Coordination Engine · Tactical Spectrum Analyzer
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={runCoordination}
            disabled={isCoordinating}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs uppercase tracking-wider border border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isCoordinating ? 'animate-spin' : ''}`} />
            {isCoordinating ? 'Calculating...' : 'Recalculate All'}
          </button>

          <button
            onClick={exportWwbCsv}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold uppercase tracking-wider transition-all"
            title="Export Shure Wireless Workbench (WWB) CSV"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            WWB CSV
          </button>

          <button
            onClick={exportPdfSheet}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold uppercase tracking-wider transition-all"
            title="Export Printable PDF Coordination Sheet"
          >
            <FileText className="w-3.5 h-3.5 text-rose-400" />
            PDF Sheet
          </button>

          <button
            onClick={copyToClipboard}
            className="p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all"
            title="Copy Coordination Table to Clipboard"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ================= MODE SWITCHER NAVIGATION TABS ================= */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-slate-950/80 border border-white/10 overflow-x-auto scrollbar-hide">
        <button
          onClick={() => setActiveView('PLANNER')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
            activeView === 'PLANNER'
              ? 'bg-indigo-600 text-white shadow-lg border border-indigo-400'
              : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          Coordination Desk
        </button>

        <button
          onClick={() => setActiveView('SPECTRUM')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
            activeView === 'SPECTRUM'
              ? 'bg-indigo-600 text-white shadow-lg border border-indigo-400'
              : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          Tactical Spectrum Scope
        </button>

        <button
          onClick={() => setActiveView('INTERMODS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
            activeView === 'INTERMODS'
              ? 'bg-indigo-600 text-white shadow-lg border border-indigo-400'
              : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          Intermod Matrix ({intermodProducts.length})
        </button>

        <button
          onClick={() => setActiveView('TV_GRID')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
            activeView === 'TV_GRID'
              ? 'bg-indigo-600 text-white shadow-lg border border-indigo-400'
              : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
        >
          <Tv className="w-3.5 h-3.5" />
          TV Channel Grid ({tvRegion})
        </button>

        <button
          onClick={() => setActiveView('ZONES')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
            activeView === 'ZONES'
              ? 'bg-indigo-600 text-white shadow-lg border border-indigo-400'
              : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Stages & Zones ({zones.length})
        </button>
      </div>

      {/* ================= TACTICAL SPECTRUM ANALYZER DISPLAY ================= */}
      {/* Placed prominently at the top to match the Talkback app's cockpit display */}
      <div className="flex flex-col rounded-xl border border-white/10 bg-slate-950 p-4 shadow-2xl relative overflow-hidden">
        
        {/* Spectrum Top Toolbar: Controls, Center, Span, Trace & Zoom */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-2 border-b border-slate-800 text-xs">
          
          {/* Frequency & Span Readouts */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 px-2.5 py-1.5 rounded-lg">
              <span className="text-[10px] uppercase font-mono text-slate-400 font-bold">CF:</span>
              <input
                type="text"
                value={centerFreqInput}
                onChange={e => setCenterFreqInput(e.target.value)}
                onBlur={() => {
                  const val = parseFloat(centerFreqInput);
                  if (!isNaN(val) && val > 0) setCenterFreq(val);
                  else setCenterFreqInput(centerFreq.toFixed(5));
                }}
                className="w-24 bg-transparent text-white font-mono font-bold text-xs focus:outline-none"
              />
              <span className="text-[10px] text-slate-500 font-mono">MHz</span>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 px-2.5 py-1.5 rounded-lg">
              <span className="text-[10px] uppercase font-mono text-slate-400 font-bold">SPAN:</span>
              <input
                type="text"
                value={spanInput}
                onChange={e => setSpanInput(e.target.value)}
                onBlur={() => {
                  const val = parseFloat(spanInput);
                  if (!isNaN(val) && val > 0) setSpan(val);
                  else setSpanInput(span.toFixed(1));
                }}
                className="w-16 bg-transparent text-white font-mono font-bold text-xs focus:outline-none"
              />
              <span className="text-[10px] text-slate-500 font-mono">MHz</span>
            </div>

            {/* Quick Zoom / Pan Steppers */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  const newSpan = Math.max(5, span - 10);
                  setSpan(newSpan);
                  setSpanInput(newSpan.toFixed(1));
                }}
                className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-md"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  const newSpan = Math.min(250, span + 10);
                  setSpan(newSpan);
                  setSpanInput(newSpan.toFixed(1));
                }}
                className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-md"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  const newC = Math.round((centerFreq - 5) * 1000) / 1000;
                  setCenterFreq(newC);
                  setCenterFreqInput(newC.toFixed(5));
                }}
                className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-md"
                title="Pan Left"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  const newC = Math.round((centerFreq + 5) * 1000) / 1000;
                  setCenterFreq(newC);
                  setCenterFreqInput(newC.toFixed(5));
                }}
                className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-md"
                title="Pan Right"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Trace, IMD toggles, and Legend */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-[11px] font-mono">
              <span className="flex items-center gap-1 text-amber-400">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span> Mics (Amber)
              </span>
              <span className="flex items-center gap-1 text-cyan-400">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block"></span> IEMs (Cyan)
              </span>
              <span className="flex items-center gap-1 text-rose-400">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span> 2TX/3TX IMD
              </span>
              {clashCount > 0 && (
                <span className="flex items-center gap-1 text-red-500 font-bold animate-pulse">
                  <AlertTriangle className="w-3 h-3" /> {clashCount} CLASH
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-md border border-slate-800">
              <button
                onClick={() => setShowTwoTone(!showTwoTone)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                  showTwoTone ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'text-slate-500'
                }`}
              >
                2TX
              </button>
              <button
                onClick={() => setShowThreeTone(!showThreeTone)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                  showThreeTone ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'text-slate-500'
                }`}
              >
                3TX
              </button>
            </div>
          </div>
        </div>

        {/* Responsive SVG Spectrum Plot Canvas */}
        <div className="relative w-full h-[230px] bg-slate-950 rounded-lg overflow-hidden select-none border border-slate-900">
          <svg className="w-full h-full" viewBox="0 0 1000 230" preserveAspectRatio="none">
            <defs>
              <linearGradient id="micPeakGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#facc15" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#facc15" stopOpacity="0.02" />
              </linearGradient>
              <linearGradient id="iemPeakGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.02" />
              </linearGradient>
              <linearGradient id="clashPeakGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#ef4444" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#ef4444" stopOpacity="0.10" />
              </linearGradient>
            </defs>

            {/* Background Grid & Axes */}
            {[0.2, 0.4, 0.6, 0.8].map((ratio, idx) => (
              <line
                key={`grid_y_${idx}`}
                x1="0"
                y1={TOP_MARGIN + PLOT_HEIGHT * ratio}
                x2="1000"
                y2={TOP_MARGIN + PLOT_HEIGHT * ratio}
                stroke="#1e293b"
                strokeWidth="0.8"
                strokeDasharray="4, 4"
              />
            ))}

            {/* Vertical frequency tick lines */}
            {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map((ratio, idx) => {
              const fTick = startFreq + span * ratio;
              return (
                <g key={`grid_x_${idx}`}>
                  <line
                    x1={1000 * ratio}
                    y1={TOP_MARGIN}
                    x2={1000 * ratio}
                    y2={TOP_MARGIN + PLOT_HEIGHT}
                    stroke="#1e293b"
                    strokeWidth="0.8"
                    strokeDasharray="4, 4"
                  />
                  <text
                    x={1000 * ratio}
                    y={CANVAS_HEIGHT - 6}
                    fill="#64748b"
                    fontSize="9.5"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {fTick.toFixed(2)}
                  </text>
                </g>
              );
            })}

            {/* Baseline noise floor */}
            <line
              x1="0"
              y1={TOP_MARGIN + PLOT_HEIGHT}
              x2="1000"
              y2={TOP_MARGIN + PLOT_HEIGHT}
              stroke="#334155"
              strokeWidth="1.5"
            />

            {/* 1. CARRIER FREQUENCY PEAKS */}
            {/* Same color, same height, same shape as Talkback app, NO center vertical line so intermods are visible */}
            {channels.map((car, idx) => {
              if (car.freq < startFreq - 2 || car.freq > stopFreq + 2) return null;
              const x = freqToX(car.freq, 1000);
              const isIem = car.type === 'IEM';
              const peakY = dbmToY(car.powerDbm);
              const baseY = TOP_MARGIN + PLOT_HEIGHT;
              const halfBwPx = 8;
              const leftX = x - halfBwPx;
              const rightX = x + halfBwPx;

              const strokeColor = car.hasClash ? '#ef4444' : (isIem ? '#38bdf8' : '#facc15');
              const fillGrad = car.hasClash ? 'url(#clashPeakGrad)' : (isIem ? 'url(#iemPeakGrad)' : 'url(#micPeakGrad)');

              // Smooth bell curve path for frequency peak
              const pathData = `M ${leftX - 6} ${baseY} Q ${leftX} ${baseY} ${x - 2} ${peakY + 2} L ${x} ${peakY} L ${x + 2} ${peakY + 2} Q ${rightX} ${baseY} ${rightX + 6} ${baseY} Z`;

              return (
                <g key={`car_${car.id}_${idx}`} className="cursor-pointer" onClick={() => setSelectedChannelId(car.id)}>
                  <path
                    d={pathData}
                    fill={fillGrad}
                    stroke={strokeColor}
                    strokeWidth={car.hasClash ? 2.5 : 1.8}
                  />
                  {/* NO center vertical line here - keeps intermod products completely unmasked */}
                  <circle
                    cx={x}
                    cy={peakY}
                    r={car.hasClash ? 4 : 3}
                    fill={strokeColor}
                    stroke="#ffffff"
                    strokeWidth={1}
                  />
                  {/* Frequency Label */}
                  <text
                    x={x}
                    y={peakY - 6}
                    fill={car.hasClash ? '#ef4444' : strokeColor}
                    fontSize="8.5"
                    fontWeight={car.hasClash ? '900' : 'bold'}
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {car.hasClash ? '[! CLASH] ' : ''}{car.freq.toFixed(3)}
                  </text>
                </g>
              );
            })}

            {/* 2. INTERMODULATION PRODUCT ARROWS (2TX & 3TX) */}
            {/* Rendered with stems and distinct triangular arrowheads */}
            {intermodProducts.map((imd, i) => {
              if (imd.freq < startFreq || imd.freq > stopFreq) return null;
              const x = freqToX(imd.freq, 1000);
              const topY = dbmToY(imd.type === '2-Tone' ? -48 : -58);
              const is2Tone = imd.type === '2-Tone';
              const color = imd.hasClash ? '#ef4444' : (is2Tone ? '#f43f5e' : '#e11d48');

              return (
                <g key={`imd_${i}`}>
                  {/* Stem line */}
                  <line
                    x1={x}
                    y1={topY}
                    x2={x}
                    y2={TOP_MARGIN + PLOT_HEIGHT}
                    stroke={color}
                    strokeWidth={imd.hasClash ? 2.5 : 1.5}
                    strokeDasharray={is2Tone ? 'none' : '3, 2'}
                  />
                  {/* High visibility arrowhead */}
                  <polygon
                    points={`${x - 4},${topY + 7} ${x + 4},${topY + 7} ${x},${topY}`}
                    fill={color}
                    stroke="#ffffff"
                    strokeWidth={1}
                  />
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* ================= VIEW: COORDINATION DESK / MAIN PLANNER ================= */}
      {activeView === 'PLANNER' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full">
          
          {/* Left Column (5 Cols): Channel Requests & Equipment Racks */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            
            <div className="p-4 rounded-xl border border-white/10 bg-slate-900/80 shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-indigo-400" />
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    Equipment Systems & Channels
                  </h2>
                </div>
                
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => addRequestGroup('MIC')}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold uppercase transition-all"
                  >
                    <Plus className="w-3 h-3" /> + Mic Group
                  </button>
                  <button
                    onClick={() => addRequestGroup('IEM')}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold uppercase transition-all"
                  >
                    <Plus className="w-3 h-3" /> + IEM Group
                  </button>
                </div>
              </div>

              {/* List of Request Groups */}
              <div className="space-y-3">
                {requestGroups.map((grp, idx) => (
                  <div key={grp.id} className="p-3 rounded-lg border border-slate-800 bg-slate-950/60 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {grp.type === 'MIC' ? (
                          <Mic2 className="w-4 h-4 text-amber-400" />
                        ) : (
                          <Headphones className="w-4 h-4 text-cyan-400" />
                        )}
                        <input
                          type="text"
                          value={grp.name}
                          onChange={e => {
                            const val = e.target.value;
                            setRequestGroups(prev => prev.map(g => g.id === grp.id ? { ...g, name: val } : g));
                          }}
                          className="bg-transparent text-white font-bold text-xs focus:outline-none focus:border-b border-indigo-400 w-44"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Zone Assignment */}
                        <select
                          value={grp.zoneId}
                          onChange={e => {
                            const val = e.target.value;
                            setRequestGroups(prev => prev.map(g => g.id === grp.id ? { ...g, zoneId: val } : g));
                          }}
                          className="bg-slate-900 text-slate-300 border border-slate-700 rounded px-2 py-1 text-[10px] font-mono focus:outline-none"
                        >
                          {zones.map(z => (
                            <option key={z.id} value={z.id}>{z.name}</option>
                          ))}
                        </select>

                        <button
                          onClick={() => removeRequestGroup(grp.id)}
                          className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                          title="Delete Group"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Equipment Profile Dropdown */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="text-[10px] text-slate-400 font-mono block mb-1">Equipment System</label>
                        <select
                          value={grp.equipmentKey}
                          onChange={e => {
                            const val = e.target.value;
                            setRequestGroups(prev => prev.map(g => g.id === grp.id ? { ...g, equipmentKey: val } : g));
                          }}
                          className="w-full bg-slate-900 text-white border border-slate-700 rounded px-2 py-1.5 text-xs focus:outline-none"
                        >
                          {PRESET_EQUIPMENT_OPTIONS.filter(p => p.type === grp.type).map(opt => (
                            <option key={opt.key} value={opt.key}>{opt.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Quantity Stepper */}
                      <div>
                        <label className="text-[10px] text-slate-400 font-mono block mb-1">Channel Count</label>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              const newQ = Math.max(1, grp.quantity - 1);
                              setRequestGroups(prev => prev.map(g => g.id === grp.id ? { ...g, quantity: newQ } : g));
                            }}
                            className="w-7 h-7 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white rounded font-mono font-bold"
                          >
                            -
                          </button>
                          <span className="w-10 text-center font-mono font-bold text-sm text-indigo-300">
                            {grp.quantity}
                          </span>
                          <button
                            onClick={() => {
                              const newQ = Math.min(32, grp.quantity + 1);
                              setRequestGroups(prev => prev.map(g => g.id === grp.id ? { ...g, quantity: newQ } : g));
                            }}
                            className="w-7 h-7 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white rounded font-mono font-bold"
                          >
                            +
                          </button>
                          <span className="text-[10px] text-slate-500 font-mono ml-1">ch</span>
                        </div>
                      </div>
                    </div>

                    {/* Linear Digital Mode Checkbox (Digital mics ignore IMD) */}
                    {grp.type === 'MIC' && (
                      <label className="flex items-center gap-2 text-[10px] text-slate-400 font-mono cursor-pointer mt-1">
                        <input
                          type="checkbox"
                          checked={grp.linearDigitalMode}
                          onChange={e => {
                            const checked = e.target.checked;
                            setRequestGroups(prev => prev.map(g => g.id === grp.id ? { ...g, linearDigitalMode: checked } : g));
                          }}
                          className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0"
                        />
                        <span>Linear Digital Equidistant Spacing (Bypasses TX-to-TX IMD)</span>
                      </label>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Spacing & Compatibility Settings Card */}
            <div className="p-4 rounded-xl border border-white/10 bg-slate-900/80 shadow-xl text-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Settings className="w-3.5 h-3.5 text-indigo-400" />
                  Coordination Tolerances
                </span>
                
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-md border border-slate-800">
                  {(['standard', 'robust', 'aggressive'] as CompatibilityPreset[]).map(lvl => (
                    <button
                      key={lvl}
                      onClick={() => setCompatibility(lvl)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold transition-all ${
                        compatibility === lvl
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 font-mono text-[11px]">
                <div className="p-2 bg-slate-950/60 rounded border border-slate-800">
                  <span className="text-slate-400 block text-[9px] uppercase">Mic Spacing</span>
                  <span className="text-white font-bold text-sm">{(customMicFundamental * 1000).toFixed(0)}</span>
                  <span className="text-slate-500 text-[9px] ml-1">kHz</span>
                </div>

                <div className="p-2 bg-slate-950/60 rounded border border-slate-800">
                  <span className="text-slate-400 block text-[9px] uppercase">IEM Spacing</span>
                  <span className="text-white font-bold text-sm">{(customIemFundamental * 1000).toFixed(0)}</span>
                  <span className="text-slate-500 text-[9px] ml-1">kHz</span>
                </div>

                <div className="p-2 bg-slate-950/60 rounded border border-slate-800">
                  <span className="text-slate-400 block text-[9px] uppercase">IMD Guard</span>
                  <span className="text-white font-bold text-sm">{(customImd3Guard * 1000).toFixed(0)}</span>
                  <span className="text-slate-500 text-[9px] ml-1">kHz</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column (7 Cols): Live Frequency Ledger & Coordination Table */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            
            <div className="p-4 rounded-xl border border-white/10 bg-slate-900/80 shadow-xl flex flex-col">
              
              {/* Ledger Header & Zone Filter */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    Frequency Ledger ({channels.length} Channels)
                  </h2>
                </div>

                {/* Zone Filter Buttons */}
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-md border border-slate-800 overflow-x-auto">
                  <button
                    onClick={() => setActiveZoneFilter('ALL')}
                    className={`px-2.5 py-1 rounded text-[10px] font-mono uppercase font-bold transition-all ${
                      activeZoneFilter === 'ALL' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All Zones
                  </button>
                  {zones.map(z => (
                    <button
                      key={z.id}
                      onClick={() => setActiveZoneFilter(z.id)}
                      className={`px-2.5 py-1 rounded text-[10px] font-mono uppercase font-bold transition-all ${
                        activeZoneFilter === z.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {z.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Channels Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] uppercase text-slate-400 tracking-wider">
                      <th className="py-2 px-2 text-center w-8">#</th>
                      <th className="py-2 px-2">Channel Name</th>
                      <th className="py-2 px-2">Type</th>
                      <th className="py-2 px-2">Frequency</th>
                      <th className="py-2 px-2">TV Ch</th>
                      <th className="py-2 px-2 text-center">Nudge</th>
                      <th className="py-2 px-2 text-center w-8">Lock</th>
                      <th className="py-2 px-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {visibleChannels.map((ch, idx) => (
                      <tr
                        key={ch.id}
                        className={`hover:bg-slate-800/40 transition-colors ${
                          ch.hasClash ? 'bg-rose-950/20' : ''
                        } ${selectedChannelId === ch.id ? 'bg-indigo-950/40' : ''}`}
                      >
                        <td className="py-2 px-2 text-center text-slate-500">{idx + 1}</td>
                        
                        {/* Channel Label */}
                        <td className="py-2 px-2">
                          <input
                            type="text"
                            value={ch.channelName}
                            onChange={e => updateChannelName(ch.id, e.target.value)}
                            className="bg-transparent text-white font-bold hover:border-b border-indigo-400 focus:outline-none w-36 text-xs"
                          />
                          <span className="block text-[9px] text-slate-500">{ch.zoneName}</span>
                        </td>

                        {/* Device Type Badge */}
                        <td className="py-2 px-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            ch.type === 'MIC' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                          }`}>
                            {ch.type}
                          </span>
                        </td>

                        {/* Frequency Editable Value */}
                        <td className="py-2 px-2 font-bold text-white">
                          <input
                            type="text"
                            defaultValue={ch.freq.toFixed(4)}
                            onBlur={e => updateChannelFreq(ch.id, e.target.value)}
                            className="w-24 bg-slate-900/80 border border-slate-700/80 rounded px-1.5 py-0.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-400"
                          />
                        </td>

                        {/* TV Channel Indicator */}
                        <td className="py-2 px-2 text-slate-400">
                          {ch.tvChannel ? `Ch ${ch.tvChannel}` : '-'}
                        </td>

                        {/* Manual Nudge Buttons */}
                        <td className="py-2 px-2 text-center whitespace-nowrap">
                          <button
                            onClick={() => nudgeChannel(ch.id, -25)}
                            className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[9px] mr-1"
                            title="Nudge Down 25 kHz"
                          >
                            -25k
                          </button>
                          <button
                            onClick={() => nudgeChannel(ch.id, 25)}
                            className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[9px]"
                            title="Nudge Up 25 kHz"
                          >
                            +25k
                          </button>
                        </td>

                        {/* Hardware Padlock Toggle */}
                        <td className="py-2 px-2 text-center">
                          <button
                            onClick={() => toggleLock(ch.id)}
                            className="p-1 hover:scale-110 active:scale-95 transition-all"
                            title={ch.locked ? "Locked: Frequency will NOT change during calculation" : "Unlocked: Click to lock"}
                          >
                            <HardwarePadlockIcon locked={ch.locked} size={15} />
                          </button>
                        </td>

                        {/* Clash / Clear Status */}
                        <td className="py-2 px-2">
                          {ch.hasClash ? (
                            <span className="flex items-center gap-1 text-[10px] text-red-400 font-bold" title={ch.clashReason}>
                              <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                              <span className="truncate max-w-[140px]">{ch.clashReason || 'CLASH'}</span>
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> CLEAR
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= VIEW: INTERMOD MATRIX AUDIT ================= */}
      {activeView === 'INTERMODS' && (
        <div className="p-5 rounded-xl border border-white/10 bg-slate-900/90 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
                Intermodulation Product Audit (3rd Order 2TX & 3TX)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Every generated 3rd-order product is audited against all active receivers with on-channel collision threshold &le; 0.005 MHz (5 kHz).
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-slate-300">
                Total Products: <strong className="text-white">{intermodProducts.length}</strong>
              </span>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase text-slate-400 tracking-wider sticky top-0 bg-slate-900">
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Product Freq</th>
                  <th className="py-2.5 px-3">Mathematical Formula</th>
                  <th className="py-2.5 px-3">Transmitter Sources</th>
                  <th className="py-2.5 px-3">On-Channel Collision?</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {intermodProducts.slice(0, 150).map((imd, idx) => (
                  <tr key={`imd_row_${idx}`} className={imd.hasClash ? 'bg-rose-950/30 text-rose-200' : 'hover:bg-slate-800/30'}>
                    <td className="py-2 px-3 font-bold">
                      <span className={`px-2 py-0.5 rounded text-[10px] ${
                        imd.type === '2-Tone' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'
                      }`}>
                        {imd.type}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-bold text-white">{imd.freq.toFixed(4)} MHz</td>
                    <td className="py-2 px-3 text-slate-400">{imd.formula}</td>
                    <td className="py-2 px-3 text-slate-300">{imd.sources.join(' + ')}</td>
                    <td className="py-2 px-3">
                      {imd.hasClash ? (
                        <span className="text-red-400 font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-500" /> DIRECT ON-CHANNEL HIT (&le; 5kHz)
                        </span>
                      ) : (
                        <span className="text-slate-500">Clear (&gt; 5kHz)</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= VIEW: TV CHANNEL GRID ================= */}
      {activeView === 'TV_GRID' && (
        <div className="p-5 rounded-xl border border-white/10 bg-slate-900/90 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5 pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Tv className="w-5 h-5 text-cyan-400" />
                Digital Television (DTV) White-Space Grid
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Click any TV channel block to cycle: Available (Green) &rarr; Blocked (Red) &rarr; Mic Only (Amber) &rarr; IEM Only (Cyan).
              </p>
            </div>

            <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-lg border border-slate-800">
              <button
                onClick={() => setTvRegion('UK')}
                className={`px-3 py-1 rounded text-xs font-mono font-bold transition-all ${
                  tvRegion === 'UK' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                UK Ofcom (Ch 21 - 49)
              </button>
              <button
                onClick={() => setTvRegion('US')}
                className={`px-3 py-1 rounded text-xs font-mono font-bold transition-all ${
                  tvRegion === 'US' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                US FCC (Ch 14 - 36)
              </button>
            </div>
          </div>

          {/* Interactive TV Channels Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {Object.entries(tvRegion === 'UK' ? UK_TV_CHANNELS : US_TV_CHANNELS).map(([chStr, range]) => {
              const ch = parseInt(chStr, 10);
              const state = tvChannelStates[ch] || 'available';
              
              let bg = 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300';
              if (state === 'blocked') bg = 'bg-rose-950/40 border-rose-500/50 text-rose-300';
              if (state === 'mic-only') bg = 'bg-amber-950/40 border-amber-500/50 text-amber-300';
              if (state === 'iem-only') bg = 'bg-cyan-950/40 border-cyan-500/50 text-cyan-300';

              const activeInCh = channels.filter(c => c.tvChannel === ch);

              return (
                <div
                  key={`tv_${ch}`}
                  onClick={() => cycleTvChannel(ch)}
                  className={`p-3 rounded-lg border cursor-pointer hover:scale-105 active:scale-95 transition-all select-none flex flex-col justify-between ${bg}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base font-bold font-mono">Ch {ch}</span>
                    <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-black/40">
                      {state}
                    </span>
                  </div>

                  <div className="mt-2 text-[10px] font-mono opacity-80">
                    {range[0]} - {range[1]} MHz
                  </div>

                  <div className="mt-2 pt-1 border-t border-white/10 text-[10px] font-mono flex items-center justify-between">
                    <span>Active:</span>
                    <span className="font-bold">{activeInCh.length} carriers</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= VIEW: STAGES & ZONES CONFIGURATION ================= */}
      {activeView === 'ZONES' && (
        <div className="p-5 rounded-xl border border-white/10 bg-slate-900/90 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-400" />
                Stages & Multi-Zone Configuration
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Organize frequencies by performance stage, rehearsal room, or transmit rack.
              </p>
            </div>

            <button
              onClick={() => {
                const newZId = `z${zones.length + 1}`;
                setZones(prev => [...prev, { id: newZId, name: `Stage / Area ${zones.length + 1}`, color: '#6366f1' }]);
                toast.success("Added new stage zone");
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Add Stage / Zone
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {zones.map((z, idx) => {
              const zoneChs = channels.filter(c => c.zoneId === z.id);
              const micCount = zoneChs.filter(c => c.type === 'MIC').length;
              const iemCount = zoneChs.filter(c => c.type === 'IEM').length;

              return (
                <div key={z.id} className="p-4 rounded-xl border border-slate-800 bg-slate-950/70 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-slate-500 uppercase">Zone {idx + 1}</span>
                    {zones.length > 1 && (
                      <button
                        onClick={() => {
                          setZones(prev => prev.filter(item => item.id !== z.id));
                          toast.info("Deleted zone");
                        }}
                        className="text-slate-500 hover:text-rose-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <input
                    type="text"
                    value={z.name}
                    onChange={e => {
                      const val = e.target.value;
                      setZones(prev => prev.map(item => item.id === z.id ? { ...item, name: val } : item));
                    }}
                    className="bg-transparent text-white font-bold text-sm border-b border-slate-700 focus:border-indigo-400 focus:outline-none pb-1"
                  />

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono mt-1">
                    <div className="p-2 rounded bg-slate-900 border border-slate-800">
                      <span className="text-[10px] text-amber-400 block">Mics</span>
                      <span className="text-base font-bold text-white">{micCount}</span>
                    </div>
                    <div className="p-2 rounded bg-slate-900 border border-slate-800">
                      <span className="text-[10px] text-cyan-400 block">IEMs</span>
                      <span className="text-base font-bold text-white">{iemCount}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= VIEW: DEDICATED FULL SPECTRUM SCOPE ================= */}
      {activeView === 'SPECTRUM' && (
        <div className="p-4 rounded-xl border border-white/10 bg-slate-900/90 shadow-xl flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-400" />
              Expanded Spectrum Probes & Delta Markers
            </h2>
            <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
              <span>Marker 1: <strong className="text-amber-400">{marker1 ? `${marker1.toFixed(3)} MHz` : 'None'}</strong></span>
              <span>Marker 2: <strong className="text-cyan-400">{marker2 ? `${marker2.toFixed(3)} MHz` : 'None'}</strong></span>
              {marker1 && marker2 && (
                <span>&Delta;: <strong className="text-white">{(Math.abs(marker2 - marker1) * 1000).toFixed(1)} kHz</strong></span>
              )}
            </div>
          </div>
          <p className="text-xs text-slate-400">
            Click on any frequency peak in the spectrum analyzer above to inspect its parameters, role assignment, and collision margins.
          </p>
        </div>
      )}

    </div>
  );
};

export default RadioMicIemPlannerTab;
