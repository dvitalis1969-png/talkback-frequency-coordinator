import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Frequency, ScanDataPoint, WMASState } from '../types';
import Card, { CardTitle } from './Card';
import { US_TV_CHANNELS, UK_TV_CHANNELS, getWmasBandwidth } from '../constants';
import { InfoTooltip } from './InfoTooltip';

interface SpectrumVisualizerProps {
    frequencies: Frequency[];
    scanData: ScanDataPoint[] | null;
    title?: string;
    onImportGenerator?: () => void;
    canImportGenerator?: boolean;
    onImportMultiBand?: () => void;
    canImportMultiBand?: boolean;
    wmasState?: WMASState;
    selectedWmasIds?: Set<string>;
    onFrequencyClick?: (freq: Frequency) => void;
    onFrequencyChange?: (id: string, value: number) => void;
    onExclusionZoneAdd?: (min: number, max: number) => void;
    onExclusionZoneRemove?: (index: number) => void;
    onExclusionsClear?: () => void;
    exclusionsText?: string;
    onExclusionsTextChange?: (val: string) => void;
    exclusionZones?: { min: number, max: number }[];
    tvRegion?: 'uk' | 'us';
    visualBw?: number;
}

const buttonBase = "px-3 py-2 rounded-md font-semibold uppercase tracking-wide transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 transform active:translate-y-0.5 text-xs";
const primaryButton = `bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:brightness-110 ${buttonBase}`;
const secondaryButton = `bg-slate-700 text-slate-200 hover:bg-slate-600 ${buttonBase}`;
const dangerButton = `bg-rose-600 text-white hover:bg-rose-500 ${buttonBase}`;
const actionButton = `bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:brightness-110 ${buttonBase}`;
const multiBandButton = `bg-gradient-to-r from-teal-500 to-emerald-500 text-white hover:brightness-110 ${buttonBase}`;

const SIGNAL_CONFIG = {
    fundamental: { amp: -10, color: '#facc15', width: 2.5, label: 'Fundamental' }, // Yellow-400
    fundamentalIEM: { amp: -5, color: '#fb923c', width: 2.5, label: 'IEM Fundamental' }, // Orange-400
    wmas: { amp: -5, color: '#a855f7', width: 3, label: 'WMAS Carrier' }, // Purple-500
    twoTone: { amp: -30, color: '#ef4444', width: 2, label: '2TX 3rd IMD' }, // Red-500 (2TX)
    threeTone: { amp: -45, color: '#f97316', width: 1.5, label: '3TX 3rd IMD' }, // Orange-500 (3TX)
    
    scanData: { color: '#38bdf8', width: 1.5 }, // Sky-400
    gridMajor: 'rgba(99, 102, 241, 0.2)',
    gridMinor: 'rgba(99, 102, 241, 0.08)',
    fontColor: '#94a3b8',
    markerColor: '#f43f5e',
};

interface SignalPoint {
    freq: number;
    amp: number;
    type: 'Fundamental' | '2-Tone' | '3-Tone';
    data: any;
}

interface Tooltip {
    content: React.ReactNode;
    x: number;
    y: number;
}

const SpectrumVisualizer: React.FC<SpectrumVisualizerProps> = ({ 
    frequencies, scanData, title = "Spectrum Analyzer", 
    onImportGenerator, canImportGenerator, onImportMultiBand, canImportMultiBand, 
    wmasState, selectedWmasIds, onFrequencyClick, onFrequencyChange, onExclusionZoneAdd, 
    onExclusionZoneRemove, onExclusionsClear, exclusionsText, onExclusionsTextChange, exclusionZones = [],
    tvRegion = 'uk',
    visualBw = 0.200
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const miniMapRef = useRef<HTMLCanvasElement>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [internalExclusionsText, setInternalExclusionsText] = useState('');
    const activeExclusionsText = exclusionsText !== undefined ? exclusionsText : internalExclusionsText;
    const [range, setRange] = useState({ min: 470, max: 700 });
    const [fullRange] = useState({ min: 400, max: 800 }); // Fixed range for navigator
    const [centerFreqInput, setCenterFreqInput] = useState<string>(((470 + 700) / 2).toFixed(4));
    const [centerStepMhz, setCenterStepMhz] = useState('1.0');
    const [spanIncrementMhz, setSpanIncrementMhz] = useState('5.0');
    const [overlayChannels, setOverlayChannels] = useState(false);
    const [tooltip, setTooltip] = useState<Tooltip | null>(null);
    const [crosshair, setCrosshair] = useState<{ x: number, y: number, freq: number, amp: number } | null>(null);
    
    // Interaction State
    const [isDragging, setIsDragging] = useState(false);
    const [isMiniMapDragging, setIsMiniMapDragging] = useState(false);
    const [miniMapDragState, setMiniMapDragState] = useState<{ offset: number } | null>(null);
    const [dragMode, setDragMode] = useState<'pan' | 'exclude' | 'frequency'>('pan');
    const [dragState, setDragState] = useState<{ 
        startX: number, 
        startMin: number, 
        startMax: number,
        startFreq: number,
        freqId?: string
    } | null>(null);
    const [currentExclusion, setCurrentExclusion] = useState<{ min: number, max: number } | null>(null);

    const parsedZones = useMemo(() => {
        if (exclusionZones && exclusionZones.length > 0) {
            return exclusionZones;
        }
        return activeExclusionsText
            .split(/[,;\n]/)
            .map(s => s.trim())
            .filter(Boolean)
            .map(s => {
                const parts = s.split(/[-–]/).map(p => parseFloat(p.trim()));
                return parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]) && parts[0] < parts[1]
                    ? { min: parts[0], max: parts[1] }
                    : null;
            })
            .filter((x): x is { min: number, max: number } => x !== null);
    }, [exclusionZones, activeExclusionsText]);

    const handleZoneAdd = (min: number, max: number) => {
        const sMin = Math.min(min, max);
        const sMax = Math.max(min, max);
        if (Math.abs(sMax - sMin) < 0.001) return;
        if (onExclusionZoneAdd) {
            onExclusionZoneAdd(sMin, sMax);
        }
        const newRange = `${sMin.toFixed(3)}-${sMax.toFixed(3)}`;
        const updated = activeExclusionsText && activeExclusionsText.trim() 
            ? `${activeExclusionsText.trim()}, ${newRange}` 
            : newRange;
        if (onExclusionsTextChange) {
            onExclusionsTextChange(updated);
        } else {
            setInternalExclusionsText(updated);
        }
    };

    const handleZoneRemove = (idx: number) => {
        if (onExclusionZoneRemove) {
            onExclusionZoneRemove(idx);
        }
        const currentZones = parsedZones.filter((_, i) => i !== idx);
        const updated = currentZones.map(z => `${z.min.toFixed(3)}-${z.max.toFixed(3)}`).join(', ');
        if (onExclusionsTextChange) {
            onExclusionsTextChange(updated);
        } else {
            setInternalExclusionsText(updated);
        }
    };

    const handleClearAll = () => {
        if (onExclusionsClear) {
            onExclusionsClear();
        }
        if (onExclusionsTextChange) {
            onExclusionsTextChange('');
        } else {
            setInternalExclusionsText('');
        }
    };

    // Touch Interaction State
    const [touchState, setTouchState] = useState<{
        startDist: number;
        startCenter: number;
        startMin: number;
        startMax: number;
    } | null>(null);

    // Focus Guard to prevent state updates from overwriting user typing
    const isCenterFreqFocused = useRef(false);

    // Visibility Toggles
    const [displayMode, setDisplayMode] = useState<'stick' | 'line'>('stick');
    const [interactionMode, setInteractionMode] = useState<'pan' | 'exclude'>('pan');
    const [showTwoTone, setShowTwoTone] = useState(true);
    const [showThreeTone, setShowThreeTone] = useState(true);
    const [showLabels, setShowLabels] = useState(true);
    const [showTooltips, setShowTooltips] = useState(true);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    const calculatedSignals = useRef<SignalPoint[]>([]);

    useEffect(() => {
        // Sync the text input only if the user is not actively focused on it
        if (!isCenterFreqFocused.current) {
            setCenterFreqInput(((range.min + range.max) / 2).toFixed(4));
        }
    }, [range]);

    // Auto-range on first load
    useEffect(() => {
        const validFreqs = frequencies.filter(f => f.value > 0);
        if (validFreqs.length > 0) {
            const values = validFreqs.map(f => f.value);
            const min = Math.min(...values);
            const max = Math.max(...values);
            if (range.min === 470 && range.max === 700) {
                setRange({ 
                    min: Math.floor(min - 5), 
                    max: Math.ceil(max + 5) 
                });
            }
        }
    }, [frequencies]);

    useMemo(() => {
        const signals: SignalPoint[] = [];
        const validFreqs = frequencies.filter(f => f.value > 0);
        validFreqs.forEach(f => {
            signals.push({
                freq: f.value,
                amp: f.type === 'iem' ? SIGNAL_CONFIG.fundamentalIEM.amp : SIGNAL_CONFIG.fundamental.amp,
                type: 'Fundamental',
                data: f
            });
        });
        if (validFreqs.length >= 2) {
            // Cap carrier count for 3-tone calculation to prevent freezing (O(n^3))
            const isHighDensity = validFreqs.length > 80;
            const isUltraHighDensity = validFreqs.length > 200;

            for (let i = 0; i < validFreqs.length; i++) {
                for (let j = 0; j < validFreqs.length; j++) {
                    if (i === j) continue;
                    const product = 2 * validFreqs[i].value - validFreqs[j].value;
                    signals.push({ freq: product, amp: SIGNAL_CONFIG.twoTone.amp, type: '2-Tone', data: { product, sources: [validFreqs[i], validFreqs[j]] } });
                }
            }

            if (!isUltraHighDensity) {
                // Optimize 3-tone with symmetry: f1 + f2 - f3 where f1 < f2
                for (let i = 0; i < validFreqs.length; i++) {
                    // Sample if high density
                    if (isHighDensity && i > 60 && Math.random() > 0.5) continue;
                    
                    for (let j = i + 1; j < validFreqs.length; j++) {
                        if (isHighDensity && j > 80 && Math.random() > 0.5) continue;

                        for (let k = 0; k < validFreqs.length; k++) {
                            if (k === i || k === j) continue;
                            if (isHighDensity && k > 100 && Math.random() > 0.5) continue;

                            const product = validFreqs[i].value + validFreqs[j].value - validFreqs[k].value;
                            signals.push({ freq: product, amp: SIGNAL_CONFIG.threeTone.amp, type: '3-Tone', data: { product, sources: [validFreqs[i], validFreqs[j], validFreqs[k]] } });
                        }
                    }
                }
            } else {
                console.warn(`[SpectrumVisualizer] Ultra-high density (${validFreqs.length} frequencies). 3-Tone calculation disabled to maintain stability.`);
            }
        }
        calculatedSignals.current = signals;
    }, [frequencies]);

    const handleScroll = (direction: 'left' | 'right') => {
        const step = parseFloat(centerStepMhz) || 1.0;
        const shift = direction === 'left' ? -step : step;
        setRange(currentRange => ({ 
            min: parseFloat((currentRange.min + shift).toFixed(4)), 
            max: parseFloat((currentRange.max + shift).toFixed(4)) 
        }));
    };

    const handleSpanChange = (direction: 'increase' | 'decrease') => {
        const spanStep = parseFloat(spanIncrementMhz) || 1.0;
        const currentSpan = range.max - range.min;
        let newSpan = direction === 'decrease' ? Math.max(0.1, currentSpan - spanStep) : currentSpan + spanStep;
        const centerFreq = (range.min + range.max) / 2;
        setRange({ min: parseFloat((centerFreq - newSpan / 2).toFixed(5)), max: parseFloat((centerFreq + newSpan / 2).toFixed(5)) });
    };

    const handleCenterStepSizeChange = (direction: 'up' | 'down') => {
        const current = parseFloat(centerStepMhz) || 1.0;
        const step = current >= 10 ? 5.0 : current >= 1 ? 1.0 : 0.1;
        const next = direction === 'up' ? current + step : Math.max(0.1, current - step);
        setCenterStepMhz(next.toFixed(1));
    };

    const handleSpanStepSizeChange = (direction: 'up' | 'down') => {
        const current = parseFloat(spanIncrementMhz) || 1.0;
        const step = current >= 10 ? 5.0 : current >= 1 ? 1.0 : 0.1;
        const next = direction === 'up' ? current + step : Math.max(0.1, current - step);
        setSpanIncrementMhz(next.toFixed(1));
    };

    const applyCenterFreq = (value: string) => {
        const newCenter = parseFloat(value);
        if (!isNaN(newCenter)) {
            const currentSpan = range.max - range.min;
            setRange({ min: parseFloat((newCenter - currentSpan / 2).toFixed(5)), max: parseFloat((newCenter + currentSpan / 2).toFixed(5)) });
        } else {
            // Restore current state if input is invalid
            setCenterFreqInput(((range.min + range.max) / 2).toFixed(4));
        }
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (e.button !== 0) return;
        
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const padding = { left: 45, right: 15 };
        const chartWidth = canvas.width - padding.left - padding.right;
        const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
        const x = (e.clientX - rect.left) * scaleX;
        const mouseFreq = range.min + ((x - padding.left) / chartWidth) * (range.max - range.min);

        // Check for click on signal (Fundamental)
        const hitRadius = (e.pointerType === 'touch' ? 30 : 12) * scaleX;
        const threshold = (hitRadius / chartWidth) * (range.max - range.min);
        const visibleSignals = calculatedSignals.current.filter(s => s.type === 'Fundamental');
        const closest = visibleSignals.find(s => Math.abs(s.freq - mouseFreq) < threshold);

        const isExcludeMode = e.shiftKey || interactionMode === 'exclude';

        if (closest && !isExcludeMode) {
            setIsDragging(true);
            setDragMode('frequency');
            setDragState({
                startX: e.clientX,
                startMin: range.min,
                startMax: range.max,
                startFreq: closest.freq,
                freqId: closest.data.id
            });
            (e.target as Element).setPointerCapture(e.pointerId);
            return;
        }

        if (!isExcludeMode) {
            if (closest && onFrequencyClick) {
                onFrequencyClick(closest.data);
            }
        }

        setIsDragging(true);
        const mode = isExcludeMode ? 'exclude' : 'pan';
        setDragMode(mode);
        setDragState({
            startX: e.clientX,
            startMin: range.min,
            startMax: range.max,
            startFreq: mouseFreq
        });
        (e.target as Element).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!isDragging || !dragState || !canvasRef.current) {
            handleHoverTooltip(e);
            return;
        }

        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const padding = { left: 45, right: 15 };
        const chartWidth = canvas.width - padding.left - padding.right;
        const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
        const x = (e.clientX - rect.left) * scaleX;
        const currentFreq = range.min + ((x - padding.left) / chartWidth) * (range.max - range.min);

        if (dragMode === 'frequency' && dragState.freqId && onFrequencyChange) {
            onFrequencyChange(dragState.freqId, parseFloat(currentFreq.toFixed(4)));
        } else if (dragMode === 'pan') {
            const deltaX = (e.clientX - dragState.startX) * scaleX;
            const span = dragState.startMax - dragState.startMin;
            const freqShift = (deltaX / chartWidth) * span;
            setRange({
                min: parseFloat((dragState.startMin - freqShift).toFixed(5)),
                max: parseFloat((dragState.startMax - freqShift).toFixed(5))
            });
        } else if (dragMode === 'exclude') {
            setCurrentExclusion({
                min: Math.min(dragState.startFreq, currentFreq),
                max: Math.max(dragState.startFreq, currentFreq)
            });
        }
        setTooltip(null);
        setCrosshair(null);
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
        setCrosshair(null);
        if (dragMode === 'exclude' && currentExclusion) {
            handleZoneAdd(currentExclusion.min, currentExclusion.max);
        }
        setIsDragging(false);
        setDragState(null);
        setCurrentExclusion(null);
        (e.target as Element).releasePointerCapture(e.pointerId);
    };

    const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
        if (e.touches.length === 2) {
            e.preventDefault(); // Prevent default browser zoom/pan
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const dist = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
            const center = (touch1.clientX + touch2.clientX) / 2;
            setTouchState({
                startDist: dist,
                startCenter: center,
                startMin: range.min,
                startMax: range.max
            });
        }
    };

    const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
        if (e.touches.length === 2 && touchState && canvasRef.current) {
            e.preventDefault(); // Prevent default browser zoom/pan
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const dist = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
            const center = (touch1.clientX + touch2.clientX) / 2;

            const scale = touchState.startDist / dist;
            const canvas = canvasRef.current;
            const rect = canvas.getBoundingClientRect();
            const padding = { left: 45, right: 15 };
            const chartWidth = canvas.width - padding.left - padding.right;
            
            // Calculate frequency at the center point of the pinch
            const centerRatio = (touchState.startCenter - rect.left - padding.left) / chartWidth;
            const centerFreq = touchState.startMin + centerRatio * (touchState.startMax - touchState.startMin);

            // Calculate new span
            const startSpan = touchState.startMax - touchState.startMin;
            const newSpan = startSpan * scale;

            // Calculate new min and max keeping the center frequency at the same relative position
            let newMin = centerFreq - centerRatio * newSpan;
            let newMax = centerFreq + (1 - centerRatio) * newSpan;

            // Handle panning (shift in center point)
            const panShiftX = center - touchState.startCenter;
            const panShiftFreq = (panShiftX / chartWidth) * newSpan;

            newMin -= panShiftFreq;
            newMax -= panShiftFreq;

            // Ensure minimum span
            if (newMax - newMin < 0.1) {
                const mid = (newMin + newMax) / 2;
                newMin = mid - 0.05;
                newMax = mid + 0.05;
            }

            setRange({
                min: parseFloat(newMin.toFixed(5)),
                max: parseFloat(newMax.toFixed(5))
            });
        }
    };

    const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
        if (e.touches.length < 2) {
            setTouchState(null);
        }
    };

    const handleHoverTooltip = (event: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const padding = { top: 60, right: 15, bottom: 55, left: 45 };
        const chartWidth = canvas.width - padding.left - padding.right;
        const chartHeight = canvas.height - padding.top - padding.bottom;
        const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
        const scaleY = rect.height > 0 ? canvas.height / rect.height : 1;
        const x = (event.clientX - rect.left) * scaleX; 
        const y = (event.clientY - rect.top) * scaleY;
        const mouseFreq = range.min + ((x - padding.left) / chartWidth) * (range.max - range.min);
        
        const minDb = -110;
        const dbRange = 110;
        const mouseAmp = minDb + dbRange * (1 - (y - padding.top) / chartHeight);
        
        if (x >= padding.left && x <= canvas.width - padding.right && y >= padding.top && y <= canvas.height - padding.bottom) {
            setCrosshair({ x: (event.clientX - rect.left), y: (event.clientY - rect.top), freq: mouseFreq, amp: mouseAmp });
        } else {
            setCrosshair(null);
        }
        const threshold = ((8 * scaleX) / chartWidth) * (range.max - range.min);
        let closestSig: SignalPoint | null = null;
        let minDist = Infinity;

        if (!showTooltips) {
            setTooltip(null);
            return;
        }

        const visibleSignals = calculatedSignals.current.filter(s => (s.type === 'Fundamental' || (s.type === '2-Tone' && showTwoTone) || (s.type === '3-Tone' && showThreeTone)));
        for (const sig of visibleSignals) {
            const dist = Math.abs(sig.freq - mouseFreq);
            const adjustedDist = sig.type === 'Fundamental' ? dist * 0.5 : dist;
            if (dist < threshold && adjustedDist < minDist) { minDist = adjustedDist; closestSig = sig; }
        }
        if (closestSig) {
            const snapX = padding.left + ((closestSig.freq - range.min) / (range.max - range.min)) * chartWidth;
            const snapXCss = snapX / scaleX;
            
            const formatFreqSource = (s?: Frequency) => {
                if (!s) return 'Unknown';
                const label = s.label || s.id || 'Unknown';
                const val = typeof s.value === 'number' ? `${s.value.toFixed(3)} MHz` : '';
                return val ? `${label} (${val})` : label;
            };

            const format2TXFormula = (sources?: Frequency[]) => {
                if (!sources || sources.length < 2) return '';
                const f1 = sources[0];
                const f2 = sources[1];
                return `2× ${formatFreqSource(f1)} - ${formatFreqSource(f2)}`;
            };

            const format3TXFormula = (sources?: Frequency[]) => {
                if (!sources || sources.length < 3) return '';
                const f1 = sources[0];
                const f2 = sources[1];
                const f3 = sources[2];
                return `${formatFreqSource(f1)} + ${formatFreqSource(f2)} - ${formatFreqSource(f3)}`;
            };

            let content = closestSig.type === 'Fundamental' ? (
                <div className="text-xs space-y-1">
                    <div className="font-bold text-yellow-400">{closestSig.data.label || closestSig.data.id}</div>
                    {closestSig.data.label && <div className="text-[10px] text-slate-400">ID: {closestSig.data.id}</div>}
                    <div className="font-mono text-cyan-300 font-bold">{closestSig.freq.toFixed(3)} MHz</div>
                    {(() => {
                        const hit2T = calculatedSignals.current.filter(
                            s => s.type === '2-Tone' && Math.abs(s.freq - closestSig!.freq) <= (visualBw / 2)
                        );
                        const hit3T = calculatedSignals.current.filter(
                            s => s.type === '3-Tone' && Math.abs(s.freq - closestSig!.freq) <= (visualBw / 2)
                        );
                        if (hit2T.length > 0 || hit3T.length > 0) {
                            return (
                                <div className="mt-1 pt-1 border-t border-red-500/40 text-[10px] space-y-1">
                                    <div className="font-black text-red-400 flex items-center gap-1">
                                        <span>⚠️ IMD HITS ON THIS CARRIER:</span>
                                    </div>
                                    {hit2T.map((h, i) => (
                                        <div key={`2t-${i}`} className="text-red-400 font-mono text-[10px] leading-tight">
                                            • 2TX 3rd: {h.freq.toFixed(3)} MHz ({format2TXFormula(h.data.sources)})
                                        </div>
                                    ))}
                                    {hit3T.map((h, i) => (
                                        <div key={`3t-${i}`} className="text-orange-400 font-mono text-[10px] leading-tight">
                                            • 3TX 3rd: {h.freq.toFixed(3)} MHz ({format3TXFormula(h.data.sources)})
                                        </div>
                                    ))}
                                </div>
                            );
                        }
                        return null;
                    })()}
                </div>
            ) : (
                <div className="text-xs space-y-1">
                    <div className={`font-bold uppercase tracking-wide ${closestSig.type === '2-Tone' ? 'text-red-400' : 'text-orange-400'}`}>
                        {closestSig.type === '2-Tone' ? '2TX 3rd Order IMD (Red)' : '3TX 3rd Order IMD (Orange)'}
                    </div>
                    <div className="text-slate-300 text-[10px]">
                        <span className="font-semibold text-slate-400">Formula: </span>
                        <span className="font-mono text-amber-300">
                            {closestSig.type === '2-Tone' ? format2TXFormula(closestSig.data.sources) : format3TXFormula(closestSig.data.sources)}
                        </span>
                    </div>
                    <div className="text-slate-300 text-[10px]">
                        <span className="font-semibold text-slate-400">Sources: </span>
                        {closestSig.data.sources?.map((s: Frequency) => formatFreqSource(s)).join(', ')}
                    </div>
                    <div className="font-mono text-cyan-300 font-bold">Product: {closestSig.freq.toFixed(3)} MHz</div>
                    {(() => {
                        const hitFund = calculatedSignals.current.find(
                            s => s.type === 'Fundamental' && Math.abs(s.freq - closestSig!.freq) <= (visualBw / 2)
                        );
                        if (hitFund) {
                            return (
                                <div className="mt-1 text-[10px] text-rose-300 font-bold bg-rose-950/80 p-1 rounded border border-rose-500/50">
                                    ⚠️ LANDS ON FUNDAMENTAL: {hitFund.data.label || hitFund.data.id} ({hitFund.freq.toFixed(3)} MHz)
                                </div>
                            );
                        }
                        return null;
                    })()}
                </div>
            );
            setTooltip({ content, x: snapXCss, y });
        } else setTooltip(null);
    };

    const liveTrace = useMemo(() => {
        const { width } = dimensions;
        if (width === 0) return null;
        
        const padding = { left: 45, right: 15 };
        const chartWidth = width - padding.left - padding.right;
        const noiseFloor = -105;
        const trace = new Array(chartWidth).fill(noiseFloor);
        
        // 1. Scan Data Interpolation
        if (scanData && scanData.length > 0) {
            const normalized = scanData.map(p => ({
                freq: p.freq > 10000 ? p.freq / 1e6 : p.freq,
                amp: p.amp
            })).sort((a, b) => a.freq - b.freq);

            const freqRange = range.max - range.min;
            const freqToX = (f: number) => ((f - range.min) / freqRange) * chartWidth;

            for (let i = 0; i < normalized.length - 1; i++) {
                const p1 = normalized[i];
                const p2 = normalized[i + 1];
                
                const x1 = Math.floor(freqToX(p1.freq));
                const x2 = Math.floor(freqToX(p2.freq));
                
                // Only interpolate if there's overlap with view
                if (x2 < 0 || x1 >= chartWidth) continue;

                const startX = Math.max(0, x1);
                const endX = Math.min(chartWidth - 1, x2);
                
                for (let x = startX; x <= endX; x++) {
                    const t = x2 === x1 ? 0 : (x - x1) / (x2 - x1);
                    const amp = p1.amp + (p2.amp - p1.amp) * t;
                    trace[x] = Math.max(trace[x], amp);
                }
            }
            // Handle single point or edges
            normalized.forEach(p => {
                const x = Math.floor(freqToX(p.freq));
                if (x >= 0 && x < chartWidth) {
                    trace[x] = Math.max(trace[x], p.amp);
                }
            });
        }

        // Removed gaussian drawing in favor of stick rendering

        return trace;
    }, [scanData, range, dimensions.width, visualBw, showTwoTone, showThreeTone, frequencies]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;
        let animationFrameId: number;
        const render = () => {
            const { width, height } = canvas;
            const padding = { top: 60, right: 15, bottom: 55, left: 45 };
            const chartWidth = width - padding.left - padding.right;
            const chartHeight = height - padding.top - padding.bottom;
            const maxDb = 0, minDb = -110, dbRange = maxDb - minDb;
            const freqToX = (freq: number) => padding.left + ((freq - range.min) / (range.max - range.min)) * chartWidth;
            const ampToY = (amp: number) => padding.top + chartHeight * (1 - ((Math.max(minDb, Math.min(maxDb, amp))) - minDb) / dbRange);
            ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, width, height);
            ctx.lineWidth = 1; ctx.font = `10px "Roboto Mono", monospace`;
            for (let i = 0; i <= 10; i++) {
                const amp = maxDb - i * 10; if (amp < minDb) break;
                const y = ampToY(amp); ctx.strokeStyle = i === 0 ? 'rgba(255,255,255,0.1)' : SIGNAL_CONFIG.gridMajor; ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(width - padding.right, y); ctx.stroke(); ctx.fillStyle = SIGNAL_CONFIG.fontColor; ctx.textAlign = 'right'; ctx.fillText(`${amp}`, padding.left - 5, y + 3);
            }
            const freqRange = range.max - range.min; const numVertLines = Math.max(2, Math.min(12, Math.floor(chartWidth / 60)));
            for (let i = 0; i <= numVertLines; i++) { const freq = range.min + i * (freqRange / numVertLines); const x = freqToX(freq); ctx.strokeStyle = SIGNAL_CONFIG.gridMajor; ctx.beginPath(); ctx.moveTo(x, padding.top); ctx.lineTo(x, height - padding.bottom); ctx.stroke(); ctx.fillStyle = SIGNAL_CONFIG.fontColor; ctx.textAlign = 'center'; ctx.fillText(`${freq.toFixed(freqRange < 2 ? 3 : freqRange < 10 ? 2 : 1)}`, x, height - padding.bottom + 15); }
            if (overlayChannels) {
                const tvChannels = tvRegion === 'uk' ? UK_TV_CHANNELS : US_TV_CHANNELS; ctx.textAlign = 'left';
                Object.entries(tvChannels).forEach(([ch, [start, end]]) => { if (end >= range.min && start <= range.max) { const xStart = Math.max(padding.left, freqToX(start)); const xEnd = Math.min(width - padding.right, freqToX(end)); if (xEnd > xStart) { ctx.fillStyle = 'rgba(59, 130, 246, 0.08)'; ctx.fillRect(xStart, padding.top, xEnd - xStart, chartHeight); ctx.fillStyle = 'rgba(96, 165, 250, 0.5)'; ctx.fillText(`CH ${ch}`, xStart + 4, padding.top + 12); } } });
            }

            // Draw Exclusion Zones
            parsedZones.forEach(zone => {
                if (zone.max >= range.min && zone.min <= range.max) {
                    const xS = Math.max(padding.left, freqToX(zone.min));
                    const xE = Math.min(width - padding.right, freqToX(zone.max));
                    if (xE > xS) {
                        ctx.fillStyle = 'rgba(244, 63, 94, 0.15)';
                        ctx.fillRect(xS, padding.top, xE - xS, chartHeight);
                        ctx.strokeStyle = 'rgba(244, 63, 94, 0.4)';
                        ctx.lineWidth = 1;
                        ctx.strokeRect(xS, padding.top, xE - xS, chartHeight);
                    }
                }
            });

            // Draw Current Drag Exclusion
            if (currentExclusion) {
                const xS = Math.max(padding.left, freqToX(currentExclusion.min));
                const xE = Math.min(width - padding.right, freqToX(currentExclusion.max));
                if (xE > xS) {
                    ctx.fillStyle = 'rgba(244, 63, 94, 0.3)';
                    ctx.fillRect(xS, padding.top, xE - xS, chartHeight);
                    ctx.strokeStyle = '#f43f5e';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(xS, padding.top, xE - xS, chartHeight);
                }
            }
            // Draw WMAS Blocks
            if (wmasState && wmasState.nodes) {
                ctx.textAlign = 'left';
                wmasState.nodes.forEach(node => {
                    if (selectedWmasIds && !selectedWmasIds.has(node.id)) return;
                    
                    if (node.assignedBlock && node.assignedBlock.end >= range.min && node.assignedBlock.start <= range.max) {
                        const xS = Math.max(padding.left, freqToX(node.assignedBlock.start));
                        const xE = Math.min(width - padding.right, freqToX(node.assignedBlock.end));
                        if (xE > xS) {
                            ctx.fillStyle = 'rgba(168, 85, 247, 0.15)';
                            ctx.fillRect(xS, padding.top, xE - xS, chartHeight);
                            
                            ctx.strokeStyle = 'rgba(168, 85, 247, 0.4)';
                            ctx.lineWidth = 1;
                            ctx.strokeRect(xS, padding.top, xE - xS, chartHeight);

                            ctx.fillStyle = 'rgba(192, 132, 252, 1)';
                            ctx.font = 'bold 10px sans-serif';
                            const bw = +(node.assignedBlock.end - node.assignedBlock.start).toFixed(3);
                            const bwStr = bw < 1 ? `${Math.round(bw * 1000)} kHz` : `${bw} MHz`;
                            let label = `WMAS [${bwStr}]: ${node.name}`;
                            if (node.actName) label += ` (${node.actName})`;
                            if (node.stage) label += ` @ ${node.stage}`;
                            ctx.fillText(label, xS + 4, padding.top + 24);
                        }
                    }
                });
            }
            // --- Trace Generation & Rendering (Background scan baseline / imported data) ---
            if (liveTrace) {
                ctx.beginPath();
                ctx.lineWidth = 1.5;
                ctx.strokeStyle = SIGNAL_CONFIG.scanData.color;
                ctx.fillStyle = 'rgba(56, 189, 248, 0.05)';
                let started = false;
                for (let i = 0; i < liveTrace.length; i++) {
                    const x = padding.left + i;
                    const y = ampToY(liveTrace[i]);
                    if (!started) {
                        ctx.moveTo(x, y);
                        started = true;
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
                ctx.stroke();

                if (started) {
                    ctx.lineTo(padding.left + liveTrace.length - 1, height - padding.bottom);
                    ctx.lineTo(padding.left, height - padding.bottom);
                    ctx.closePath();
                    ctx.fill();
                }
            }

            const baseY = height - padding.bottom;
            const noiseFloorDb = -105;

            // -------------------------------------------------------------------------
            // RENDER MODE 1: STICK DISPLAY
            // Shows sharp sticks for 3TX (Orange), 2TX (Red), and Fundamentals (Yellow/Amber/Purple)
            // with collision halos/indicators when an IMD lands on a fundamental frequency
            // -------------------------------------------------------------------------
            if (displayMode === 'stick') {
                // 1. Draw 3-Tone IMD Sticks (Orange - 3TX 3rd)
                if (showThreeTone) {
                    calculatedSignals.current.forEach(sig => {
                        if (sig.type === '3-Tone' && sig.freq >= range.min && sig.freq <= range.max) {
                            const x = freqToX(sig.freq);
                            const y = ampToY(SIGNAL_CONFIG.threeTone.amp);
                            ctx.beginPath();
                            ctx.lineWidth = SIGNAL_CONFIG.threeTone.width;
                            ctx.strokeStyle = SIGNAL_CONFIG.threeTone.color;
                            ctx.moveTo(x, baseY);
                            ctx.lineTo(x, y);
                            ctx.stroke();

                            // Top dot
                            ctx.fillStyle = SIGNAL_CONFIG.threeTone.color;
                            ctx.beginPath();
                            ctx.arc(x, y, 1.5, 0, Math.PI * 2);
                            ctx.fill();
                        }
                    });
                }

                // 2. Draw 2-Tone IMD Sticks (Red - 2TX 3rd)
                if (showTwoTone) {
                    calculatedSignals.current.forEach(sig => {
                        if (sig.type === '2-Tone' && sig.freq >= range.min && sig.freq <= range.max) {
                            const x = freqToX(sig.freq);
                            const y = ampToY(SIGNAL_CONFIG.twoTone.amp);
                            ctx.beginPath();
                            ctx.lineWidth = SIGNAL_CONFIG.twoTone.width;
                            ctx.strokeStyle = SIGNAL_CONFIG.twoTone.color;
                            ctx.moveTo(x, baseY);
                            ctx.lineTo(x, y);
                            ctx.stroke();

                            // Top dot
                            ctx.fillStyle = SIGNAL_CONFIG.twoTone.color;
                            ctx.beginPath();
                            ctx.arc(x, y, 2, 0, Math.PI * 2);
                            ctx.fill();
                        }
                    });
                }

                // 3. Draw Fundamental Sticks (Yellow/IEM Orange/WMAS Purple)
                calculatedSignals.current.forEach(sig => {
                    if (sig.type === 'Fundamental' && sig.freq >= range.min && sig.freq <= range.max) {
                        const x = freqToX(sig.freq);
                        const y = ampToY(sig.amp);
                        let color = SIGNAL_CONFIG.fundamental.color;
                        let width = SIGNAL_CONFIG.fundamental.width;
                        if (sig.data.type === 'iem') {
                            color = SIGNAL_CONFIG.fundamentalIEM.color;
                            width = SIGNAL_CONFIG.fundamentalIEM.width;
                        } else if (sig.data.type === 'wmas' || (sig.data.equipmentKey && sig.data.equipmentKey.includes('wmas'))) {
                            color = SIGNAL_CONFIG.wmas.color;
                            width = SIGNAL_CONFIG.wmas.width;
                        }

                        ctx.beginPath();
                        ctx.lineWidth = width;
                        ctx.strokeStyle = color;
                        ctx.moveTo(x, baseY);
                        ctx.lineTo(x, y);
                        ctx.stroke();

                        // Detect if a 2TX (red) or 3TX (orange) intermod landed directly on or within collision bandwidth of this fundamental
                        const colliding2T = showTwoTone && calculatedSignals.current.some(
                            s => s.type === '2-Tone' && Math.abs(s.freq - sig.freq) <= (visualBw / 2)
                        );
                        const colliding3T = showThreeTone && calculatedSignals.current.some(
                            s => s.type === '3-Tone' && Math.abs(s.freq - sig.freq) <= (visualBw / 2)
                        );

                        if (colliding2T || colliding3T) {
                            // Collision halo
                            ctx.beginPath();
                            ctx.arc(x, y, 5, 0, Math.PI * 2);
                            ctx.strokeStyle = colliding2T ? '#ef4444' : '#f97316';
                            ctx.lineWidth = 2;
                            ctx.fillStyle = colliding2T ? 'rgba(239, 68, 68, 0.4)' : 'rgba(249, 115, 22, 0.4)';
                            ctx.fill();
                            ctx.stroke();

                            // Warning indicator beacon above stick
                            ctx.beginPath();
                            ctx.arc(x, y - 8, 3, 0, Math.PI * 2);
                            ctx.fillStyle = colliding2T ? '#ef4444' : '#f97316';
                            ctx.fill();
                        } else {
                            ctx.fillStyle = color;
                            ctx.beginPath();
                            ctx.arc(x, y, 2.5, 0, Math.PI * 2);
                            ctx.fill();
                        }
                    }
                });
            } else {
                // -------------------------------------------------------------------------
                // RENDER MODE 2: LINE DISPLAY WITH COLORED OVERLAYS
                // Continuous Gaussian curve traces:
                // - Orange Layer: 3TX 3rd-Order IMDs (#f97316)
                // - Red Layer: 2TX 3rd-Order IMDs (#ef4444)
                // - Yellow / Amber / Purple Layer: Fundamental Carriers
                // Because each layer is drawn with translucent fills and colored outlines,
                // intermod products (Red & Orange) appear visibly on top of or next to fundamentals!
                // -------------------------------------------------------------------------
                const drawCurve = (freq: number, peakAmp: number, strokeColor: string, fillColor: string, lineWidth: number, customBw?: number) => {
                    const effBw = customBw || visualBw;
                    const pxWidth = Math.max(4, (effBw / freqRange) * chartWidth);
                    const centerPx = freqToX(freq);
                    const startPx = Math.max(padding.left, centerPx - pxWidth * 2.5);
                    const endPx = Math.min(width - padding.right, centerPx + pxWidth * 2.5);

                    if (endPx <= startPx) return;

                    ctx.beginPath();
                    let first = true;
                    for (let px = startPx; px <= endPx; px++) {
                        const distPx = Math.abs(px - centerPx);
                        const normDist = distPx / pxWidth;
                        const shapeFactor = Math.exp(-Math.pow(normDist * 2.2, 2));
                        const amp = noiseFloorDb + (peakAmp - noiseFloorDb) * shapeFactor;
                        const y = ampToY(amp);
                        if (first) {
                            ctx.moveTo(px, y);
                            first = false;
                        } else {
                            ctx.lineTo(px, y);
                        }
                    }
                    ctx.strokeStyle = strokeColor;
                    ctx.lineWidth = lineWidth;
                    ctx.stroke();

                    if (fillColor) {
                        ctx.lineTo(endPx, baseY);
                        ctx.lineTo(startPx, baseY);
                        ctx.closePath();
                        ctx.fillStyle = fillColor;
                        ctx.fill();
                    }
                };

                // 1. Draw 3TX 3rd-Order IMD Curves (Orange)
                if (showThreeTone) {
                    calculatedSignals.current.forEach(sig => {
                        if (sig.type === '3-Tone' && sig.freq >= range.min - 1 && sig.freq <= range.max + 1) {
                            drawCurve(sig.freq, SIGNAL_CONFIG.threeTone.amp, '#f97316', 'rgba(249, 115, 22, 0.25)', 1.5);
                        }
                    });
                }

                // 2. Draw 2TX 3rd-Order IMD Curves (Red)
                if (showTwoTone) {
                    calculatedSignals.current.forEach(sig => {
                        if (sig.type === '2-Tone' && sig.freq >= range.min - 1 && sig.freq <= range.max + 1) {
                            drawCurve(sig.freq, SIGNAL_CONFIG.twoTone.amp, '#ef4444', 'rgba(239, 68, 68, 0.35)', 2);
                        }
                    });
                }

                // 3. Draw Fundamental Carrier Curves (Yellow / Orange / Purple)
                calculatedSignals.current.forEach(sig => {
                    if (sig.type === 'Fundamental' && sig.freq >= range.min - 1 && sig.freq <= range.max + 1) {
                        let strokeColor = SIGNAL_CONFIG.fundamental.color;
                        let fillColor = 'rgba(250, 204, 21, 0.2)';
                        const isWmas = sig.data.type === 'wmas' || (sig.data.equipmentKey && sig.data.equipmentKey.includes('wmas'));
                        let customBw: number | undefined;
                        if (sig.data.type === 'iem') {
                            strokeColor = SIGNAL_CONFIG.fundamentalIEM.color;
                            fillColor = 'rgba(251, 146, 60, 0.25)';
                        } else if (isWmas) {
                            strokeColor = SIGNAL_CONFIG.wmas.color;
                            fillColor = 'rgba(168, 85, 247, 0.25)';
                            customBw = getWmasBandwidth(sig.data);
                        }

                        drawCurve(sig.freq, sig.amp, strokeColor, fillColor, 2.5, customBw);

                        // Highlight IMD collision on fundamental peak
                        const colliding2T = showTwoTone && calculatedSignals.current.some(
                            s => s.type === '2-Tone' && Math.abs(s.freq - sig.freq) <= (visualBw / 2)
                        );
                        const colliding3T = showThreeTone && calculatedSignals.current.some(
                            s => s.type === '3-Tone' && Math.abs(s.freq - sig.freq) <= (visualBw / 2)
                        );

                        if (colliding2T || colliding3T) {
                            const x = freqToX(sig.freq);
                            const y = ampToY(sig.amp);
                            ctx.beginPath();
                            ctx.arc(x, y, 6, 0, Math.PI * 2);
                            ctx.strokeStyle = colliding2T ? '#ef4444' : '#f97316';
                            ctx.lineWidth = 2.5;
                            ctx.fillStyle = colliding2T ? 'rgba(239, 68, 68, 0.5)' : 'rgba(249, 115, 22, 0.5)';
                            ctx.fill();
                            ctx.stroke();

                            ctx.beginPath();
                            ctx.arc(x, y - 9, 3, 0, Math.PI * 2);
                            ctx.fillStyle = colliding2T ? '#ef4444' : '#f97316';
                            ctx.fill();
                        }
                    }
                });
            }

            
            // 4. Draw Labels and WMAS Overlays
            calculatedSignals.current.forEach(sig => {
                if (sig.type === 'Fundamental') {
                    const isWmas = sig.data.type === 'wmas' || (sig.data.equipmentKey && sig.data.equipmentKey.includes('wmas'));
                    if (isWmas) {
                        const bw = getWmasBandwidth(sig.data);
                        const halfBw = bw / 2;
                        const startFreq = sig.freq - halfBw;
                        const endFreq = sig.freq + halfBw;
                        
                        if (endFreq >= range.min && startFreq <= range.max) {
                            const xS = Math.max(padding.left, freqToX(startFreq));
                            const xE = Math.min(width - padding.right, freqToX(endFreq));
                            if (xE > xS) {
                                ctx.fillStyle = 'rgba(168, 85, 247, 0.2)';
                                ctx.fillRect(xS, padding.top, xE - xS, chartHeight);
                                ctx.strokeStyle = 'rgba(168, 85, 247, 0.6)';
                                ctx.lineWidth = 1;
                                ctx.strokeRect(xS, padding.top, xE - xS, chartHeight);
                                if (showLabels) {
                                    ctx.fillStyle = '#d8b4fe';
                                    ctx.textAlign = 'center';
                                    ctx.font = 'bold 9px sans-serif';
                                    const bwLabel = bw < 1 ? `${Math.round(bw * 1000)} kHz` : `${bw} MHz`;
                                    ctx.fillText(`WMAS ${bwLabel}`, (xS + xE) / 2, padding.top + 20);
                                    if (sig.data.label) {
                                        ctx.fillStyle = '#f3e8ff';
                                        ctx.font = 'bold 8px sans-serif';
                                        ctx.fillText(sig.data.label, (xS + xE) / 2, padding.top + 32);
                                    }
                                }
                            }
                        }
                    } else {
                        if (showLabels && sig.freq >= range.min && sig.freq <= range.max) { 
                            const config = sig.data.type === 'iem' ? SIGNAL_CONFIG.fundamentalIEM : SIGNAL_CONFIG.fundamental; 
                            const x = freqToX(sig.freq); 
                            const y = ampToY(sig.amp); 
                            ctx.save(); 
                            ctx.translate(x, y - 12); 
                            ctx.rotate(-Math.PI / 4); 
                            ctx.fillStyle = config.color; 
                            ctx.textAlign = 'left'; 
                            ctx.font = 'bold 10px sans-serif'; 
                            ctx.fillText(sig.data.label || sig.data.id, 0, 0); 
                            ctx.restore(); 
                        }
                    }
                }
            });
            ctx.fillStyle = SIGNAL_CONFIG.fontColor; ctx.font = '10px "Roboto Mono", monospace';
            const labelY = height - 12; ctx.textAlign = 'left'; ctx.fillText(`CENTER ${((range.min + range.max) / 2).toFixed(3)} MHz`, padding.left, labelY); ctx.textAlign = 'center'; ctx.fillText(`SPAN ${(range.max - range.min).toFixed(3)} MHz`, width / 2, labelY); ctx.textAlign = 'right'; ctx.fillText(`RBW 30 kHz`, width - padding.right, labelY);
        };
        const rafCallback = () => { render(); if (isRunning) animationFrameId = requestAnimationFrame(rafCallback); };
        if (isRunning) animationFrameId = requestAnimationFrame(rafCallback); else render();
        return () => cancelAnimationFrame(animationFrameId);
    }, [isRunning, displayMode, range, overlayChannels, tvRegion, liveTrace, showTwoTone, showThreeTone, showLabels, wmasState, selectedWmasIds, dimensions, parsedZones, currentExclusion, frequencies, visualBw]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if(canvas) {
            const resizeObserver = new ResizeObserver(() => { 
                requestAnimationFrame(() => {
                    if (!canvas) return;
                    canvas.width = canvas.offsetWidth; 
                    canvas.height = canvas.offsetHeight; 
                    setDimensions({ width: canvas.offsetWidth, height: canvas.offsetHeight });
                });
            });
            resizeObserver.observe(canvas); return () => resizeObserver.disconnect();
        }
    }, []);

    useEffect(() => {
        const canvas = miniMapRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { width, height } = canvas;
        ctx.fillStyle = '#020617';
        ctx.fillRect(0, 0, width, height);

        // Draw full range background
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.2)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 10; i++) {
            const x = (i / 10) * width;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }

        // Draw current view range highlight
        const xStart = ((range.min - fullRange.min) / (fullRange.max - fullRange.min)) * width;
        const xEnd = ((range.max - fullRange.min) / (fullRange.max - fullRange.min)) * width;
        
        ctx.fillStyle = 'rgba(99, 102, 241, 0.3)';
        ctx.fillRect(xStart, 0, xEnd - xStart, height);
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 2;
        ctx.strokeRect(xStart, 0, xEnd - xStart, height);

        // Draw frequencies in mini-map
        frequencies.filter(f => f.value > 0).forEach(f => {
            const x = ((f.value - fullRange.min) / (fullRange.max - fullRange.min)) * width;
            ctx.fillStyle = f.type === 'iem' ? '#fb923c' : '#facc15';
            ctx.fillRect(x - 1, 2, 2, height - 4);
        });

        // Add labels
        ctx.fillStyle = '#64748b';
        ctx.font = '8px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${fullRange.min}`, 2, height - 2);
        ctx.textAlign = 'right';
        ctx.fillText(`${fullRange.max}`, width - 2, height - 2);
    }, [range, frequencies, fullRange]);

    const updateRangeFromMiniMapX = (clientX: number, canvas: HTMLCanvasElement, offset: number) => {
        const rect = canvas.getBoundingClientRect();
        const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
        const clickFreq = fullRange.min + (x / rect.width) * (fullRange.max - fullRange.min);
        
        // Subtract the grab offset so the box moves smoothly relative to the cursor
        let centerFreq = clickFreq - offset;
        const currentSpan = range.max - range.min;
        
        let newMin = centerFreq - currentSpan / 2;
        let newMax = centerFreq + currentSpan / 2;
        
        if (newMin < fullRange.min) {
            newMin = fullRange.min;
            newMax = fullRange.min + currentSpan;
        }
        if (newMax > fullRange.max) {
            newMax = fullRange.max;
            newMin = fullRange.max - currentSpan;
        }

        setRange({ min: newMin, max: newMax });
    };

    const handleMiniMapPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = miniMapRef.current;
        if (!canvas) return;
        
        const rect = canvas.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const clickFreq = fullRange.min + (x / rect.width) * (fullRange.max - fullRange.min);

        setIsMiniMapDragging(true);
        e.currentTarget.setPointerCapture(e.pointerId);

        // If clicked inside the currently visible highlighted region, calculate the offset from the center.
        // Otherwise, jump the center to the click position (offset 0).
        if (clickFreq >= range.min && clickFreq <= range.max) {
            const currentCenter = (range.min + range.max) / 2;
            const offset = clickFreq - currentCenter;
            setMiniMapDragState({ offset });
        } else {
            setMiniMapDragState({ offset: 0 });
            updateRangeFromMiniMapX(e.clientX, canvas, 0);
        }
    };

    const handleMiniMapPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!isMiniMapDragging) return;
        const canvas = miniMapRef.current;
        if (!canvas) return;
        const offset = miniMapDragState?.offset || 0;
        updateRangeFromMiniMapX(e.clientX, canvas, offset);
    };

    const handleMiniMapPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
        setIsMiniMapDragging(false);
        setMiniMapDragState(null);
        e.currentTarget.releasePointerCapture(e.pointerId);
    };

    return (
        <Card fullWidth>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                <CardTitle className="flex items-center gap-2 m-0">
                    <span>{title}</span>
                    <InfoTooltip content="Visualize the calculated RF plan, including fundamental frequencies and intermodulation products. Use Exclude mode or Shift+Drag to draw exclusion zones, and pinch to zoom on touch devices." />
                </CardTitle>

                {/* Display Mode Toggle Switch & Legend */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-slate-950/80 px-2.5 py-1 rounded-sm border border-slate-700/80 text-[10px]">
                        <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Legend:</span>
                        <div className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block shadow-sm"></span>
                            <span className="text-yellow-300 font-bold">Fundamental</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block shadow-sm"></span>
                            <span className="text-red-400 font-bold">2TX 3rd</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block shadow-sm"></span>
                            <span className="text-orange-400 font-bold">3TX 3rd</span>
                        </div>
                    </div>

                    {/* Interaction Mode Toggle */}
                    <div className="flex items-center bg-slate-950/90 rounded-md p-1 border border-slate-700 shadow-inner">
                        <button 
                            type="button"
                            onClick={() => setInteractionMode('pan')} 
                            className={`px-3 py-1.5 rounded-sm text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                                interactionMode === 'pan' 
                                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md ring-1 ring-white/20' 
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                            title="Pan Mode: Drag canvas to pan left/right"
                        >
                            <span>🖐️</span>
                            <span>Pan</span>
                        </button>
                        <button 
                            type="button"
                            onClick={() => setInteractionMode('exclude')} 
                            className={`px-3 py-1.5 rounded-sm text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                                interactionMode === 'exclude' 
                                    ? 'bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-md ring-1 ring-white/20' 
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                            title="Exclude Mode: Drag to draw exclusion zones (Mobile friendly)"
                        >
                            <span>🚫</span>
                            <span>Exclude</span>
                        </button>
                    </div>
                    {/* Mode Toggle Switch */}
                    <div className="flex items-center bg-slate-950/90 rounded-md p-1 border border-slate-700 shadow-inner">
                        <button 
                            type="button"
                            onClick={() => setDisplayMode('stick')} 
                            className={`px-3 py-1.5 rounded-sm text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                                displayMode === 'stick' 
                                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md ring-1 ring-white/20' 
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                            title="Stick Mode: Displays carriers and 2TX/3TX intermods as sharp vertical sticks with explicit collision halos"
                        >
                            <span>📊</span>
                            <span>Stick Display</span>
                        </button>
                        <button 
                            type="button"
                            onClick={() => setDisplayMode('line')} 
                            className={`px-3 py-1.5 rounded-sm text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                                displayMode === 'line' 
                                    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md ring-1 ring-white/20' 
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                            title="Line Mode: Displays continuous spectrum curves with colored Red (2TX) and Orange (3TX) overlays on top of or next to fundamental frequencies"
                        >
                            <span>📈</span>
                            <span>Line & Overlays</span>
                        </button>
                    </div>
                </div>
            </div>
            
            <div className="bg-slate-900/50 p-3 rounded-sm mb-3 space-y-3">
                <div className="flex flex-wrap gap-2 items-center justify-between">
                    <div className="flex gap-2">
                        {onImportGenerator && <button onClick={onImportGenerator} disabled={!canImportGenerator} className={`${actionButton} border border-cyan-600/50`}>📥 Import Generator</button>}
                        {onImportMultiBand && <button onClick={onImportMultiBand} disabled={!canImportMultiBand} className={`${multiBandButton} border border-teal-600/50`}>📥 Import Multi-Band</button>}
                        <button onClick={() => setIsRunning(!isRunning)} className={isRunning ? dangerButton : primaryButton}>{isRunning ? 'Stop Trace' : 'Start Trace'}</button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 bg-slate-800/80 p-2 rounded-md border border-slate-700">
                        <div className="flex gap-2 pr-4 border-r border-slate-700/50">
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input type="checkbox" checked={showLabels} onChange={e => setShowLabels(e.target.checked)} className="w-4 h-4 rounded accent-indigo-500 bg-slate-700" />
                                <span className="text-[10px] text-slate-400 font-bold uppercase group-hover:text-white transition-colors">Labels</span>
                                <InfoTooltip content="Toggle frequency and equipment labels on the chart." />
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input type="checkbox" checked={showTwoTone} onChange={e => setShowTwoTone(e.target.checked)} className="w-4 h-4 rounded accent-red-500 bg-slate-700" />
                                <span className="text-[10px] text-red-400 font-bold uppercase group-hover:text-white transition-colors">2TX (Red)</span>
                                <InfoTooltip content="Toggle visibility of 2TX (2-Tone) 3rd Order Intermodulation products (Red)." />
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input type="checkbox" checked={showThreeTone} onChange={e => setShowThreeTone(e.target.checked)} className="w-4 h-4 rounded accent-orange-500 bg-slate-700" />
                                <span className="text-[10px] text-orange-400 font-bold uppercase group-hover:text-white transition-colors">3TX (Orange)</span>
                                <InfoTooltip content="Toggle visibility of 3TX (3-Tone) 3rd Order Intermodulation products (Orange)." />
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input type="checkbox" checked={overlayChannels} onChange={e => setOverlayChannels(e.target.checked)} className="w-4 h-4 rounded accent-blue-500 bg-slate-700" />
                                <span className="text-[10px] text-slate-400 font-bold uppercase group-hover:text-white transition-colors">TV</span>
                                <InfoTooltip content="Overlay TV channel grids for the selected region." />
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer group px-2 border-l border-slate-700/50">
                                <input type="checkbox" checked={showTooltips} onChange={e => setShowTooltips(e.target.checked)} className="w-4 h-4 rounded accent-cyan-500 bg-slate-700" />
                                <span className="text-[10px] text-slate-400 font-bold uppercase group-hover:text-white transition-colors">Tooltips</span>
                                <InfoTooltip content="Toggle hover tooltips for spectral components." />
                            </label>
                        </div>
                        
                        <div className="flex items-center gap-2 pr-4 border-r border-slate-700/50">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">Center</span>
                            <InfoTooltip content="The center frequency of the analyzer view. Adjust using the arrows or by typing a value." />
                            <div className="flex items-center bg-slate-700 rounded-sm p-0.5 border border-slate-600 shadow-inner">
                                <button onClick={() => handleScroll('left')} className="p-1.5 px-2.5 rounded bg-slate-600/50 text-slate-300 hover:bg-slate-500 transition-colors text-xs font-bold">&larr;</button>
                                <input 
                                    type="text" 
                                    value={centerFreqInput} 
                                    onChange={e => setCenterFreqInput(e.target.value)} 
                                    onFocus={() => { isCenterFreqFocused.current = true; }}
                                    onBlur={e => { isCenterFreqFocused.current = false; applyCenterFreq(e.target.value); }} 
                                    onKeyDown={e => e.key === 'Enter' && applyCenterFreq(e.currentTarget.value)} 
                                    className="w-20 bg-transparent text-white font-mono text-[10px] text-center font-bold outline-none focus:text-cyan-400" 
                                    placeholder="0.0000" 
                                />
                                <button onClick={() => applyCenterFreq(centerFreqInput)} className="px-2 py-0.5 mx-0.5 rounded bg-blue-500/80 text-white font-bold text-[8px] uppercase tracking-wider hover:bg-blue-400 transition-colors">Set</button>
                                <button onClick={() => handleScroll('right')} className="p-1.5 px-2.5 rounded bg-slate-600/50 text-slate-300 hover:bg-slate-500 transition-colors text-xs font-bold">&rarr;</button>
                            </div>
                            <div className="flex items-center gap-1.5 bg-slate-700/50 px-2 py-1.5 rounded-sm border border-slate-600/50">
                                <span className="text-[8px] text-slate-500 font-black uppercase">Step</span>
                                <button onClick={() => handleCenterStepSizeChange('down')} className="text-slate-400 hover:text-white transition-colors">▼</button>
                                <span className="text-[10px] font-mono text-indigo-300 w-8 text-center font-bold">{centerStepMhz}</span>
                                <button onClick={() => handleCenterStepSizeChange('up')} className="text-slate-400 hover:text-white transition-colors">▲</button>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">Span</span>
                            <InfoTooltip content="The total frequency width visible on the chart. Adjust to zoom in or out." />
                            <div className="flex items-center bg-slate-700 rounded-sm p-0.5 border border-slate-600 shadow-inner">
                                <button onClick={() => handleSpanChange('decrease')} className="px-2 py-1 text-white rounded text-[10px] font-black hover:bg-slate-500 transition-colors">-</button>
                                <span className="text-[10px] text-cyan-400 font-mono w-16 text-center font-black">{(range.max - range.min).toFixed(1)}M</span>
                                <button onClick={() => handleSpanChange('increase')} className="px-2 py-1 text-white rounded text-[10px] font-black hover:bg-slate-500 transition-colors">+</button>
                            </div>
                            <div className="flex items-center gap-1.5 bg-slate-700/50 px-2 py-1.5 rounded-sm border border-slate-600/50">
                                <span className="text-[8px] text-slate-500 font-black uppercase">Step</span>
                                <button onClick={() => handleSpanStepSizeChange('down')} className="text-slate-400 hover:text-white transition-colors">▼</button>
                                <span className="text-[10px] font-mono text-indigo-300 w-8 text-center font-bold">{spanIncrementMhz}</span>
                                <button onClick={() => handleSpanStepSizeChange('up')} className="text-slate-400 hover:text-white transition-colors">▲</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Dedicated Manual Exclusions Bar */}
            <div className="bg-slate-900/80 p-3.5 rounded-md border border-slate-800 mb-3">
                <label className="text-[10px] text-slate-400 uppercase font-black mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                        Manual Exclusions (MHz)
                        <span className="text-slate-500 font-normal text-[9px]">(Format: start-end, start-end. Use Exclude mode or Shift+Drag on canvas to draw)</span>
                    </span>
                    {parsedZones.length > 0 && (
                        <span className="text-rose-400 font-mono text-[9px]">{parsedZones.length} Active Exclusion{parsedZones.length > 1 ? 's' : ''}</span>
                    )}
                </label>
                <input 
                    value={activeExclusionsText} 
                    onChange={e => {
                        if (onExclusionsTextChange) onExclusionsTextChange(e.target.value);
                        else setInternalExclusionsText(e.target.value);
                    }} 
                    placeholder="e.g. 500-505, 606.5-608" 
                    className="w-full bg-slate-950 border border-slate-700 p-2 rounded text-xs font-mono text-slate-300 outline-none focus:border-indigo-500" 
                />
                
                {parsedZones.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-2 items-center">
                        {parsedZones.map((zone, idx) => (
                            <div key={idx} className="flex items-center gap-1 bg-rose-500/10 border border-rose-500/20 rounded-full px-2.5 py-0.5 text-[9px] font-black text-rose-400">
                                <span>{zone.min.toFixed(3)}-{zone.max.toFixed(3)}</span>
                                <button 
                                    onClick={() => handleZoneRemove(idx)}
                                    className="hover:text-white transition-colors ml-1"
                                    title="Remove exclusion zone"
                                >
                                    &times;
                                </button>
                            </div>
                        ))}
                        <button 
                            onClick={handleClearAll}
                            className="text-[8px] text-slate-500 hover:text-rose-400 uppercase font-black tracking-widest transition-colors ml-1"
                        >
                            Clear All
                        </button>
                    </div>
                )}
            </div>

            <div className="relative w-full h-[300px] md:h-[500px] bg-black rounded-sm border border-indigo-500/30 overflow-hidden shadow-inner">
                <div className="absolute top-2 right-2 bg-slate-900/80 border border-slate-700 text-slate-400 text-[10px] uppercase font-bold px-2 py-1 rounded pointer-events-none z-10 backdrop-blur-sm flex items-center gap-2">
                    <span>💡 Tip:</span>
                    <span className="text-yellow-500">Shift + Drag</span>
                    <span>to draw exclusion zones</span>
                </div>
                {tooltip && (
                    <div 
                        className="absolute z-20 p-2.5 text-white bg-slate-800/95 border border-indigo-400/50 rounded-sm shadow-sm border border-slate-700/50 pointer-events-none backdrop-blur-sm" 
                        style={{ 
                            left: tooltip.x - 12, 
                            top: tooltip.y + 12,
                            transform: 'translateX(-100%)' 
                        }}
                    >
                        {tooltip.content}
                    </div>
                )}
                
                {crosshair && (
                    <>
                        <div className="absolute bg-blue-500/50 pointer-events-none" style={{ left: 0, right: 0, top: `${crosshair.y}px`, height: '1px', zIndex: 5 }} />
                        <div className="absolute bg-blue-500/50 pointer-events-none" style={{ top: 0, bottom: 0, left: `${crosshair.x}px`, width: '1px', zIndex: 5 }} />
                        <div className="absolute z-10 bg-slate-800 text-slate-200 font-mono text-[10px] p-1 rounded border border-slate-700 pointer-events-none whitespace-nowrap shadow-lg"
                             style={{ left: `${crosshair.x + 8}px`, top: `${crosshair.y + 8}px` }}>
                            {crosshair.freq.toFixed(3)} MHz<br/>
                            {crosshair.amp.toFixed(1)} dBm
                        </div>
                    </>
                )}
                <canvas 
                    ref={canvasRef} 
                    className={`w-full h-full ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} touch-none`}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onTouchCancel={handleTouchEnd}
                />
            </div>

            {/* Mini-Map Navigator */}
            <div className="mt-4 px-2">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Spectrum Navigator</span>
                    <span className="text-[9px] font-mono text-slate-600">{fullRange.min} - {fullRange.max} MHz</span>
                </div>
                <div className="relative h-12 bg-slate-950 rounded-sm border border-white/5 overflow-hidden cursor-crosshair">
                    <canvas 
                        ref={miniMapRef}
                        width={800}
                        height={48}
                        className={`w-full h-full touch-none ${isMiniMapDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                        onPointerDown={handleMiniMapPointerDown}
                        onPointerMove={handleMiniMapPointerMove}
                        onPointerUp={handleMiniMapPointerUp}
                        onPointerCancel={handleMiniMapPointerUp}
                        onPointerLeave={handleMiniMapPointerUp}
                    />
                </div>
            </div>
        </Card>
    );
};

export default SpectrumVisualizer;