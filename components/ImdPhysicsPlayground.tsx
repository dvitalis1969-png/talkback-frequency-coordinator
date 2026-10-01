import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ShieldAlert, Sparkles, Magnet, AlertTriangle, CheckCircle, RefreshCw, Plus, Trash2, ArrowRight, Zap, Radio, Sliders, Info, Download } from 'lucide-react';

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

interface ImdPhysicsPlaygroundProps {
  initialCarriers?: PlaygroundCarrier[];
  onExportToPlan?: (carriers: PlaygroundCarrier[]) => void;
  className?: string;
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
  onExportToPlan,
  className = ''
}) => {
  // Carrier State
  const [carriers, setCarriers] = useState<PlaygroundCarrier[]>(() => {
    return initialCarriers && initialCarriers.length > 0 ? initialCarriers : PRESET_CARRIERS.TRAP_3TX;
  });

  // Physics Toggles
  const [magneticSnap, setMagneticSnap] = useState<boolean>(true);
  const [show5thOrder, setShow5thOrder] = useState<boolean>(false);
  const [safetyMarginKhz, setSafetyMarginKhz] = useState<number>(50); // 25, 50, 100 kHz
  const [activeCarrierId, setActiveCarrierId] = useState<string | null>(null);

  // Frequency Ruler Bounds
  const [minFreq, setMinFreq] = useState<number>(490.0);
  const [maxFreq, setMaxFreq] = useState<number>(520.0);

  // Dynamic Ruler Zoom based on carriers
  useEffect(() => {
    if (carriers.length === 0) return;
    const freqs = carriers.map(c => c.freq);
    const low = Math.min(...freqs);
    const high = Math.max(...freqs);
    const padding = Math.max(4.0, (high - low) * 0.4);
    setMinFreq(Number((low - padding).toFixed(1)));
    setMaxFreq(Number((high + padding).toFixed(1)));
  }, [carriers]);

  const span = maxFreq - minFreq;

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

        // Amplitude weighting based on base vs beltpack
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

    // 2. 3-Tone 3rd Order: A + B - C (for all unique combinations of 3)
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

  // Collision Detection Engine
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
        // Exclude products generated solely by self
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

    return {
      hits,
      directCount,
      nearCount,
      clashingCarrierIds
    };
  }, [carriers, imdProducts, safetyMarginKhz]);

  // Magnetic Clean-Pocket Finder
  const findCleanPocket = useCallback((targetFreq: number, carrierId: string) => {
    // Search around targetFreq in increments of 25 kHz
    const searchWindow = 1.2; // +/- 1.2 MHz
    const step = 0.025; // 25 kHz
    let bestFreq = targetFreq;
    let minClashDist = 0;

    for (let offset = 0; offset <= searchWindow; offset += step) {
      for (const dir of [0, 1, -1]) {
        if (offset === 0 && dir !== 0) continue;
        if (offset > 0 && dir === 0) continue;

        const testFreq = Number((targetFreq + offset * dir).toFixed(4));
        if (testFreq < minFreq || testFreq > maxFreq) continue;

        // Check if testFreq clashes with existing carriers
        const carrierConflict = carriers.some(c => c.id !== carrierId && Math.abs(c.freq - testFreq) < 0.25);
        if (carrierConflict) continue;

        // Check against IMD products formed by OTHER carriers
        let isClean = true;
        for (const p of imdProducts) {
          if (!p.sourceIds.includes(carrierId)) {
            if (Math.abs(p.freq - testFreq) < 0.08) {
              isClean = false;
              break;
            }
          }
        }

        if (isClean) {
          return testFreq;
        }
      }
    }
    return targetFreq;
  }, [carriers, imdProducts, minFreq, maxFreq]);

  // Dragging Mechanics on Interactive Ruler
  const rulerRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const draggedCarrierIdRef = useRef<string | null>(null);

  const freqToPercent = (f: number) => {
    return Math.max(0, Math.min(100, ((f - minFreq) / span) * 100));
  };

  const percentToFreq = (pct: number) => {
    return minFreq + (pct / 100) * span;
  };

  const handleCarrierPointerDown = (id: string, e: React.PointerEvent) => {
    e.stopPropagation();
    isDraggingRef.current = true;
    draggedCarrierIdRef.current = id;
    setActiveCarrierId(id);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleRulerPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || !draggedCarrierIdRef.current || !rulerRef.current) return;
    const rect = rulerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const pct = (x / rect.width) * 100;
    let rawFreq = percentToFreq(pct);

    // Apply Magnetic Snap if enabled
    if (magneticSnap) {
      const snapCandidate = findCleanPocket(rawFreq, draggedCarrierIdRef.current);
      if (Math.abs(snapCandidate - rawFreq) < 0.08) {
        rawFreq = snapCandidate;
      }
    }

    const rounded = Number(rawFreq.toFixed(4));
    setCarriers(prev =>
      prev.map(c => (c.id === draggedCarrierIdRef.current ? { ...c, freq: rounded } : c))
    );
  };

  const handleRulerPointerUp = (e: React.PointerEvent) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      draggedCarrierIdRef.current = null;
    }
  };

  // Add / Remove Carriers
  const handleAddCarrier = () => {
    const newId = `tx-${Date.now()}`;
    const nextFreq = Number((minFreq + span * 0.5 + (Math.random() - 0.5) * 4).toFixed(3));
    const newCarrier: PlaygroundCarrier = {
      id: newId,
      label: `TX ${carriers.length + 1}`,
      freq: nextFreq,
      powerDbm: 20,
      type: 'BASE_TX',
      color: '#38bdf8'
    };
    setCarriers([...carriers, newCarrier]);
  };

  const handleRemoveCarrier = (id: string) => {
    if (carriers.length <= 2) return;
    setCarriers(carriers.filter(c => c.id !== id));
  };

  // Nudge frequency
  const nudgeCarrier = (id: string, deltaMhz: number) => {
    setCarriers(prev =>
      prev.map(c => {
        if (c.id === id) {
          return { ...c, freq: Number((c.freq + deltaMhz).toFixed(4)) };
        }
        return c;
      })
    );
  };

  // Toggle Type (Base continuous vs Beltpack bursted)
  const toggleCarrierType = (id: string) => {
    setCarriers(prev =>
      prev.map(c => {
        if (c.id === id) {
          const nextType: PlaygroundCarrier['type'] =
            c.type === 'BASE_TX' ? 'BELTPACK' : c.type === 'BELTPACK' ? 'MIC' : 'BASE_TX';
          const nextPower = nextType === 'BASE_TX' ? 24 : nextType === 'BELTPACK' ? 14 : 10;
          return { ...c, type: nextType, powerDbm: nextPower };
        }
        return c;
      })
    );
  };

  // Load Preset
  const loadPreset = (key: keyof typeof PRESET_CARRIERS) => {
    setCarriers(PRESET_CARRIERS[key]);
  };

  return (
    <div className={`flex flex-col bg-slate-950 border border-purple-500/30 rounded-xl overflow-hidden shadow-2xl text-slate-100 ${className}`}>
      {/* Top Header & Telemetry Bar */}
      <div className="flex flex-wrap items-center justify-between px-4 py-3 bg-slate-900 border-b border-purple-500/20 gap-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-pulse shadow-[0_0_8px_#c084fc]" />
          <h2 className="text-xs font-black tracking-widest text-purple-300 uppercase font-mono">
            IMD COLLISION PHYSICS PLAYGROUND
          </h2>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-950/80 border border-purple-500/40 text-purple-300 font-mono">
            LIVE DYNAMICS
          </span>
        </div>

        {/* Real-time Collision Scoreboard */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md border font-bold transition-all ${
              collisionReport.directCount > 0
                ? 'bg-red-500/20 border-red-500/60 text-red-300 animate-pulse'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            }`}
          >
            {collisionReport.directCount > 0 ? (
              <ShieldAlert size={14} className="text-red-400" />
            ) : (
              <CheckCircle size={14} className="text-emerald-400" />
            )}
            <span>
              {collisionReport.directCount > 0
                ? `${collisionReport.directCount} DIRECT HITS!`
                : '0 DIRECT HITS (CLEAN)'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-950 border border-white/10 text-amber-400 font-bold">
            <AlertTriangle size={13} />
            <span>{collisionReport.nearCount} NEAR-MISS</span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-950 border border-white/10 text-cyan-400">
            <span>SPURS: {imdProducts.length}</span>
          </div>
        </div>

        {/* Physics Controls: Magnetic Snap & 5th Order */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <button
            onClick={() => setMagneticSnap(!magneticSnap)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-bold transition-all ${
              magneticSnap
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                : 'bg-slate-950 text-slate-400 border-white/10 hover:text-slate-200'
            }`}
          >
            <Magnet size={13} className={magneticSnap ? 'text-emerald-400' : 'text-slate-500'} />
            <span>MAGNETIC SNAP {magneticSnap ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={() => setShow5thOrder(!show5thOrder)}
            className={`px-2 py-1 rounded-md border text-[11px] font-bold transition-all ${
              show5thOrder
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                : 'bg-slate-950 text-slate-400 border-white/10 hover:text-slate-200'
            }`}
          >
            5TH ORDER {show5thOrder ? 'ACTIVE' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Main Interactive Physics Sandbox Canvas */}
      <div className="p-4 bg-[#080d18] relative select-none">
        {/* Instruction Banner */}
        <div className="flex items-center justify-between mb-3 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-purple-400" />
            <span>DRAG CARRIERS ALONG THE RULER TO WATCH INTERMOD SPURS GLIDE &amp; CLASH</span>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1 text-purple-400">
              <span className="w-2 h-2 rounded-full bg-purple-500" /> 2-Tone 3rd (2A-B)
            </span>
            <span className="flex items-center gap-1 text-cyan-400">
              <span className="w-2 h-2 rounded-full bg-cyan-400" /> 3-Tone 3rd (A+B-C)
            </span>
            {show5thOrder && (
              <span className="flex items-center gap-1 text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-400" /> 5th Order (3A-2B)
              </span>
            )}
          </div>
        </div>

        {/* The Interactive Spectrum Ruler Stage */}
        <div
          ref={rulerRef}
          onPointerMove={handleRulerPointerMove}
          onPointerUp={handleRulerPointerUp}
          className="relative h-64 bg-slate-950/90 rounded-xl border border-purple-500/30 overflow-hidden shadow-inner cursor-pointer"
        >
          {/* Subtle Grid Graticule */}
          <div className="absolute inset-0 flex justify-between pointer-events-none opacity-20">
            {Array.from({ length: 11 }).map((_, i) => (
              <div key={i} className="h-full border-r border-dashed border-cyan-400" />
            ))}
          </div>

          {/* Direct Collision Hazard Beams */}
          {collisionReport.hits.map((hit, idx) => {
            const xPct = freqToPercent(hit.carrierFreq);
            const isDirect = hit.severity === 'DIRECT_HIT';
            return (
              <div
                key={`beam-${idx}`}
                className={`absolute top-0 bottom-0 pointer-events-none transition-all ${
                  isDirect
                    ? 'w-1 bg-red-500 shadow-[0_0_15px_#ef4444] animate-pulse z-10'
                    : 'w-0.5 bg-amber-400/80 shadow-[0_0_8px_#f59e0b] z-0'
                }`}
                style={{ left: `${xPct}%`, transform: 'translateX(-50%)' }}
              >
                {isDirect && (
                  <div className="absolute top-2 -translate-x-1/2 px-2 py-0.5 rounded bg-red-600/90 text-white font-mono font-black text-[9px] whitespace-nowrap shadow-lg">
                    ⚠️ DIRECT HIT! (Δ {hit.deltaKhz} kHz)
                  </div>
                )}
              </div>
            );
          })}

          {/* Render IMD Ghost Spurs (Bottom Spikes) */}
          {imdProducts.map((p, idx) => {
            const xPct = freqToPercent(p.freq);
            if (xPct < 0 || xPct > 100) return null;

            const is3Tone = p.toneType === '3-Tone';
            const is5th = p.order === 5;
            const spurHeight = is5th ? 38 : is3Tone ? 58 : 72; // px
            const colorClass = is5th
              ? 'bg-amber-400 border-amber-300'
              : is3Tone
              ? 'bg-cyan-400 border-cyan-300'
              : 'bg-purple-400 border-purple-300';

            return (
              <div
                key={`imd-${idx}`}
                className="absolute bottom-6 flex flex-col items-center pointer-events-none z-10 group"
                style={{ left: `${xPct}%`, transform: 'translateX(-50%)' }}
              >
                {/* Spur Spike Line */}
                <div
                  className={`w-0.5 ${colorClass} opacity-80 shadow-[0_0_6px_currentColor]`}
                  style={{ height: `${spurHeight}px` }}
                />
                {/* Spur Head Diamond */}
                <div className={`w-1.5 h-1.5 rotate-45 ${colorClass}`} />
                {/* Tiny Spur Frequency */}
                <span className="text-[8px] font-mono text-slate-400 opacity-75 mt-0.5">
                  {p.freq.toFixed(2)}
                </span>
              </div>
            );
          })}

          {/* Render Draggable Carriers (Top Pucks) */}
          {carriers.map(c => {
            const xPct = freqToPercent(c.freq);
            const hasClash = collisionReport.clashingCarrierIds.has(c.id);
            const isSelected = activeCarrierId === c.id;

            return (
              <div
                key={c.id}
                onPointerDown={e => handleCarrierPointerDown(c.id, e)}
                className="absolute top-2 flex flex-col items-center cursor-grab active:cursor-grabbing z-20 transition-transform active:scale-105"
                style={{ left: `${xPct}%`, transform: 'translateX(-50%)' }}
              >
                {/* Carrier Puck Card */}
                <div
                  className={`flex flex-col items-center px-2 py-1 rounded-lg border-2 shadow-xl backdrop-blur-md transition-all ${
                    hasClash
                      ? 'bg-red-950/90 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.7)]'
                      : isSelected
                      ? 'bg-slate-900/95 border-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.6)]'
                      : 'bg-slate-900/90 border-white/20 hover:border-white/50'
                  }`}
                >
                  <span className="text-[10px] font-mono font-black text-white whitespace-nowrap">
                    {c.label}
                  </span>
                  <span
                    className={`text-[11px] font-mono font-bold ${
                      hasClash ? 'text-red-300' : 'text-cyan-300'
                    }`}
                  >
                    {c.freq.toFixed(3)}
                  </span>
                  <span className="text-[8px] font-mono px-1 rounded bg-slate-950/80 text-slate-400 mt-0.5">
                    {c.type === 'BASE_TX' ? 'BASE (100%)' : c.type === 'BELTPACK' ? 'PACK (PTT)' : 'MIC'}
                  </span>
                </div>

                {/* Carrier Vertical Stem to Ruler */}
                <div
                  className={`w-0.5 h-16 ${
                    hasClash ? 'bg-red-400 animate-pulse' : 'bg-cyan-400'
                  } opacity-70`}
                />
                <div
                  className={`w-2.5 h-2.5 rounded-full ${
                    hasClash ? 'bg-red-400 shadow-[0_0_8px_#ef4444]' : 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]'
                  } border border-white`}
                />
              </div>
            );
          })}

          {/* Bottom Frequency Ruler Axis */}
          <div className="absolute bottom-0 left-0 right-0 h-6 bg-slate-900 border-t border-white/10 flex items-center justify-between px-3 font-mono text-[10px] text-slate-400">
            <span>{minFreq.toFixed(1)} MHz</span>
            <span className="text-slate-500 uppercase tracking-widest text-[9px]">
              INTERACTIVE FREQUENCY SPECTRUM RULER (SPAN: {span.toFixed(1)} MHz)
            </span>
            <span>{maxFreq.toFixed(1)} MHz</span>
          </div>
        </div>
      </div>

      {/* Preset Scenarios & Carrier Configurator Bar */}
      <div className="p-3 bg-slate-900/90 border-t border-purple-500/20 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        {/* Preset Loaders */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-slate-400 text-[10px] uppercase font-bold mr-1">PRESETS:</span>
          <button
            onClick={() => loadPreset('TRAP_3TX')}
            className="px-2.5 py-1 rounded bg-slate-950 hover:bg-slate-800 text-purple-300 border border-purple-500/30 text-xs font-bold"
          >
            3-TX HARMONIC TRAP
          </button>
          <button
            onClick={() => loadPreset('TALKBACK_DUPLEX')}
            className="px-2.5 py-1 rounded bg-slate-950 hover:bg-slate-800 text-cyan-300 border border-cyan-500/30 text-xs font-bold"
          >
            TALKBACK DUPLEX PAIR + MIC
          </button>
          <button
            onClick={() => loadPreset('DENSE_4TX')}
            className="px-2.5 py-1 rounded bg-slate-950 hover:bg-slate-800 text-amber-300 border border-amber-500/30 text-xs font-bold"
          >
            4-CARRIER MATRIX
          </button>
        </div>

        {/* Add Carrier & Export Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleAddCarrier}
            className="flex items-center gap-1 px-3 py-1 rounded bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 border border-cyan-500/40 text-xs font-bold"
          >
            <Plus size={13} /> ADD CARRIER
          </button>

          {onExportToPlan && (
            <button
              onClick={() => onExportToPlan(carriers)}
              className="flex items-center gap-1 px-3 py-1 rounded bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/40 text-xs font-bold"
            >
              <Download size={13} /> EXPORT CLEAN TO PLAN
            </button>
          )}
        </div>
      </div>

      {/* Carrier Inspector & Clash Breakdown Table */}
      <div className="p-3 bg-slate-950 border-t border-white/10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {carriers.map(c => {
            const hasClash = collisionReport.clashingCarrierIds.has(c.id);
            const carrierHits = collisionReport.hits.filter(h => h.carrierId === c.id);

            return (
              <div
                key={c.id}
                className={`p-2.5 rounded-lg border flex flex-col justify-between gap-1.5 transition-all ${
                  hasClash
                    ? 'bg-red-950/30 border-red-500/50'
                    : 'bg-slate-900/60 border-white/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-xs">{c.label}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleCarrierType(c.id)}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                        c.type === 'BASE_TX'
                          ? 'bg-purple-950 text-purple-300 border-purple-500/40'
                          : 'bg-cyan-950 text-cyan-300 border-cyan-500/40'
                      }`}
                    >
                      {c.type === 'BASE_TX' ? 'BASE (100% CONT)' : 'BELTPACK (BURST)'}
                    </button>
                    {carriers.length > 2 && (
                      <button
                        onClick={() => handleRemoveCarrier(c.id)}
                        className="text-slate-500 hover:text-red-400 p-0.5"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Frequency Tuning & Nudge */}
                <div className="flex items-center justify-between font-mono">
                  <span className="text-cyan-400 font-black text-sm">{c.freq.toFixed(4)} MHz</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => nudgeCarrier(c.id, -0.025)}
                      className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 text-[10px]"
                    >
                      -25k
                    </button>
                    <button
                      onClick={() => nudgeCarrier(c.id, 0.025)}
                      className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 text-[10px]"
                    >
                      +25k
                    </button>
                  </div>
                </div>

                {/* Clash Telemetry or Clean Status */}
                {hasClash ? (
                  <div className="text-[10px] font-mono text-red-300 bg-red-950/60 p-1 rounded border border-red-500/30">
                    {carrierHits.map((h, i) => (
                      <div key={i} className="truncate">
                        🚨 {h.severity}: {h.product.formula} (Δ {h.deltaKhz} kHz)
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                    <CheckCircle size={11} /> CLEAN - ZERO 3RD-ORDER INTERMOD
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ImdPhysicsPlayground;
