
import React from 'react';
import { motion } from 'motion/react';
import { UnifiedFestivalState, FestivalAct, FestivalDay, Frequency } from '../types';
import Card, { CardTitle } from './Card';
import { Check, Clock, Shield, Briefcase, Layout, AlertCircle, Zap, Play, Pause, Sliders, Wifi, Activity, Eye, EyeOff } from 'lucide-react';

const normalizeStageLabel = (label: string): string => {
    return (label || '')
        .trim()
        .toLowerCase()
        .replace(/\bradio\s+1\b/g, 'radio one')
        .replace(/\bradio\s+one\b/g, 'radio one')
        .replace(/\s+/g, ' ')
        .trim();
};

const LiveSpectrumAnalyzer: React.FC<{ activeFrequencies: { freq: Frequency; actName: string; stage: string }[] }> = ({ activeFrequencies }) => {
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const [startFreq, setStartFreq] = React.useState(470);
    const [stopFreq, setStopFreq] = React.useState(700);
    const [isDragging, setIsDragging] = React.useState(false);
    const [dragStartX, setDragStartX] = React.useState(0);
    const [dragStartFreq, setDragStartFreq] = React.useState(470);
    const [dragStopFreq, setDragStopFreq] = React.useState(700);

    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        setIsDragging(true);
        setDragStartX(e.clientX);
        setDragStartFreq(startFreq);
        setDragStopFreq(stopFreq);
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDragging) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const deltaX = e.clientX - dragStartX;
        const rect = canvas.getBoundingClientRect();
        const span = dragStopFreq - dragStartFreq;
        
        // shift ratio: deltaX / rect.width
        const shift = (deltaX / rect.width) * span;
        
        setStartFreq(Math.max(10, dragStartFreq - shift));
        setStopFreq(Math.max(10 + span, dragStopFreq - shift));
    };

    const handleMouseUpOrLeave = () => {
        setIsDragging(false);
    };

    const handleZoomIn = () => {
        const span = stopFreq - startFreq;
        if (span <= 1) return; // limit min span to 1 MHz
        const center = startFreq + span / 2;
        const newSpan = span * 0.5;
        setStartFreq(center - newSpan / 2);
        setStopFreq(center + newSpan / 2);
    };

    const handleZoomOut = () => {
        const span = stopFreq - startFreq;
        const center = startFreq + span / 2;
        const newSpan = Math.min(600, span * 2); // limit max span
        setStartFreq(Math.max(10, center - newSpan / 2));
        setStopFreq(center + newSpan / 2);
    };

    const handlePanLeft = () => {
        const span = stopFreq - startFreq;
        const shift = span * 0.2;
        setStartFreq(Math.max(10, startFreq - shift));
        setStopFreq(Math.max(10 + span, stopFreq - shift));
    };

    const handlePanRight = () => {
        const span = stopFreq - startFreq;
        const shift = span * 0.2;
        setStartFreq(startFreq + shift);
        setStopFreq(stopFreq + shift);
    };

    React.useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;

        const render = () => {
            const width = canvas.width;
            const height = canvas.height;
            const span = stopFreq - startFreq;

            // Solid background (no alpha trailing to prevent smudging on dynamic traces)
            ctx.fillStyle = '#020617'; // slate-950
            ctx.fillRect(0, 0, width, height);

            // Draw Grid
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            
            // Vertical divisions (10 divisions)
            for (let i = 0; i <= 10; i++) {
                const x = (i / 10) * width;
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
            }
            
            // Horizontal divisions (4 divisions)
            for (let i = 0; i <= 4; i++) {
                const y = (i / 4) * height;
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
            }
            ctx.stroke();

            // X-axis Grid Labels
            ctx.fillStyle = 'rgba(148, 163, 184, 0.6)'; // slate-400
            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'center';
            for (let i = 1; i < 10; i++) {
                const x = (i / 10) * width;
                const freq = startFreq + (i / 10) * span;
                ctx.fillText(`${freq.toFixed(1)}`, x, height - 6);
            }

            // Draw Trace
            const noiseFloorY = height - 25;
            const trace = new Float32Array(width).fill(noiseFloorY);

            // Compute peak envelopes
            activeFrequencies.forEach((item) => {
                const freqValue = item.freq.value;
                if (freqValue >= startFreq && freqValue <= stopFreq) {
                    const xCenter = ((freqValue - startFreq) / span) * width;
                    // Cap peak height so we have roughly 120px of guaranteed headroom for labels at the top
                    const peakHeight = Math.min(height * 0.7, height - 120);
                    
                    
                    // Fixed standard deviation for carrier bandwidth (e.g. ~40kHz)
                    // This ensures carriers resolve individually as distinct sharp peaks, even when zoomed out.
                    const carrierWidthMHz = 0.04;
                    const spread = Math.max((carrierWidthMHz / span) * width, 1.0);
                    
                    const minX = Math.max(0, Math.floor(xCenter - spread * 5));
                    const maxX = Math.min(width - 1, Math.ceil(xCenter + spread * 5));

                    for (let x = minX; x <= maxX; x++) {
                        const dist = Math.abs(x - xCenter);
                        // A mix of gaussian for the base and an exponential point for a sharp needle
                        const gaussian = Math.exp(-(dist * dist) / (2 * spread * spread));
                        const needle = Math.exp(-dist / (spread * 0.6));
                        const combinedShape = (gaussian * 0.3) + (needle * 0.7);
                        
                        const y = noiseFloorY - peakHeight * combinedShape;
                        if (y < trace[x]) trace[x] = y; // take the highest peak (lowest Y value)
                    }
                }
            });

            // Fill beneath trace with gradient
            ctx.beginPath();
            ctx.moveTo(0, height);
            for (let x = 0; x < width; x++) {
                ctx.lineTo(x, trace[x]);
            }
            ctx.lineTo(width, height);
            ctx.closePath();
            
            const gradient = ctx.createLinearGradient(0, 0, 0, height);
            gradient.addColorStop(0, 'rgba(56, 189, 248, 0.3)');
            gradient.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
            ctx.fillStyle = gradient;
            ctx.fill();

            // Stroke trace line (with very subtle 1px noise for live "flicker" effect)
            ctx.beginPath();
            ctx.moveTo(0, trace[0]);
            for (let x = 1; x < width; x++) {
                const noise = Math.random() * 2 - 1; // +/- 1px
                ctx.lineTo(x, trace[x] + noise);
            }
            ctx.strokeStyle = '#38bdf8'; // sky-400
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Render Labels (Stable, no jumping)
            // Sort by frequency so we can stack collisions linearly if needed
            const sortedFreqs = [...activeFrequencies].filter(f => f.freq.value >= startFreq && f.freq.value <= stopFreq)
                                .sort((a, b) => a.freq.value - b.freq.value);

            const drawnLabels: { x: number; y: number }[] = [];

            sortedFreqs.forEach((item) => {
                const freqValue = item.freq.value;
                const xCenter = ((freqValue - startFreq) / span) * width;
                let finalY = trace[Math.floor(xCenter)] - 8; // Stable Y position just above the peak
                
                // Collision avoidance: step up if colliding with an existing label
                let isColliding = true;
                let attempts = 0;
                while (isColliding && attempts < 8) {
                    isColliding = drawnLabels.some(l => Math.abs(l.x - xCenter) < 45 && Math.abs(l.y - finalY) < 22);
                    if (isColliding) finalY -= 24; // step up
                    attempts++;
                }
                drawnLabels.push({ x: xCenter, y: finalY });
                
                // Center marker point
                ctx.beginPath();
                ctx.arc(xCenter, trace[Math.floor(xCenter)], 2, 0, Math.PI * 2);
                ctx.fillStyle = '#fff';
                ctx.fill();

                // Dropdown dashed line
                ctx.beginPath();
                ctx.setLineDash([2, 3]);
                ctx.moveTo(xCenter, trace[Math.floor(xCenter)]);
                ctx.lineTo(xCenter, noiseFloorY);
                ctx.strokeStyle = 'rgba(255,255,255,0.2)';
                ctx.stroke();
                
                // Line connecting label if we offset it
                if (finalY < trace[Math.floor(xCenter)] - 8) {
                    ctx.beginPath();
                    ctx.setLineDash([1, 2]);
                    ctx.moveTo(xCenter, trace[Math.floor(xCenter)] - 2);
                    ctx.lineTo(xCenter, finalY + 10);
                    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
                    ctx.stroke();
                }
                ctx.setLineDash([]);

                const color = item.freq.type === 'iem' ? '#38bdf8' : '#818cf8';

                // Draw frequency label text background
                const freqLabel = `${freqValue.toFixed(3)}`;
                ctx.font = 'bold 10px monospace';
                const textWidth = ctx.measureText(freqLabel).width;
                ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
                ctx.fillRect(xCenter - textWidth/2 - 3, finalY - 18, textWidth + 6, 14);

                // Draw frequency text
                ctx.textAlign = 'center';
                ctx.fillStyle = color;
                ctx.fillText(freqLabel, xCenter, finalY - 8);

                // Draw act name background
                ctx.font = 'bold 8px sans-serif';
                const actTextWidth = ctx.measureText(item.actName).width;
                ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
                ctx.fillRect(xCenter - actTextWidth/2 - 3, finalY - 29, actTextWidth + 6, 10);

                // Draw act name text
                ctx.fillStyle = '#cbd5e1';
                ctx.fillText(item.actName.toUpperCase(), xCenter, finalY - 21);
            });

            animationFrameId = requestAnimationFrame(render);
        };

        render();

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [activeFrequencies, startFreq, stopFreq]);

    return (
        <div className="w-full bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 rounded-xl p-3 border-2 border-slate-600 shadow-[0_10px_30px_rgba(0,0,0,0.8),inset_0_2px_1px_rgba(255,255,255,0.2)] relative flex flex-col">
            {/* Corner Screws */}
            <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-gradient-to-br from-slate-400 to-slate-800 shadow-[inset_0_1px_1px_rgba(255,255,255,0.5)] border border-slate-900 flex items-center justify-center"><div className="w-1.5 h-[1px] bg-slate-900/80 rotate-45"></div></div>
            <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-gradient-to-br from-slate-400 to-slate-800 shadow-[inset_0_1px_1px_rgba(255,255,255,0.5)] border border-slate-900 flex items-center justify-center"><div className="w-1.5 h-[1px] bg-slate-900/80 -rotate-12"></div></div>
            <div className="absolute bottom-2 left-2 w-2 h-2 rounded-full bg-gradient-to-br from-slate-400 to-slate-800 shadow-[inset_0_1px_1px_rgba(255,255,255,0.5)] border border-slate-900 flex items-center justify-center"><div className="w-1.5 h-[1px] bg-slate-900/80 rotate-[60deg]"></div></div>
            <div className="absolute bottom-2 right-2 w-2 h-2 rounded-full bg-gradient-to-br from-slate-400 to-slate-800 shadow-[inset_0_1px_1px_rgba(255,255,255,0.5)] border border-slate-900 flex items-center justify-center"><div className="w-1.5 h-[1px] bg-slate-900/80 -rotate-45"></div></div>
            
            {/* Manufacturer / Model Label Placeholder */}
            <div className="absolute top-1 left-1/2 -translate-x-1/2 flex items-center gap-1.5 opacity-60">
                <span className="text-[7px] font-black uppercase tracking-[0.3em] text-slate-300">RF Suite Pro</span>
                <span className="w-1 h-1 rounded-full bg-green-500 animate-pulse shadow-[0_0_5px_#22c55e]"></span>
            </div>

            {/* Hardware Screen Bezel */}
            <div className="w-full bg-slate-950 mt-2 rounded-md overflow-hidden relative border-4 border-slate-900 shadow-[inset_0_10px_20px_rgba(0,0,0,0.8)] flex flex-col flex-1">
                {/* Top Toolbar: Adjustable Controls */}
                <div className="flex flex-wrap items-center justify-between p-2 border-b border-white/5 bg-slate-900/30 gap-2">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-1.5">
                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Start</label>
                            <input 
                                type="number" 
                                value={Number(startFreq).toString()} 
                                onChange={(e) => setStartFreq(Number(e.target.value))}
                                className="w-16 bg-slate-950/80 border border-white/10 rounded px-1.5 py-1 text-xs text-white font-mono focus:outline-none focus:border-indigo-500 transition-colors shadow-inner"
                            />
                        </div>
                        <div className="flex items-center gap-1.5">
                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Stop</label>
                            <input 
                                type="number" 
                                value={Number(stopFreq).toString()} 
                                onChange={(e) => setStopFreq(Number(e.target.value))}
                                className="w-16 bg-slate-950/80 border border-white/10 rounded px-1.5 py-1 text-xs text-white font-mono focus:outline-none focus:border-indigo-500 transition-colors shadow-inner"
                            />
                        </div>
                        <span className="text-[9px] font-black text-indigo-400 font-mono bg-indigo-500/10 px-2 py-1 rounded border border-indigo-500/20 shadow-inner">
                            SPAN: {(stopFreq - startFreq).toFixed(1)} MHz
                        </span>
                    </div>
                    
                    <div className="flex items-center gap-1.5">
                        <button onClick={handlePanLeft} className="px-2.5 py-1 bg-slate-800 shadow-[0_2px_0_rgba(0,0,0,0.5)] active:shadow-[0_0px_0_rgba(0,0,0,0.5)] active:translate-y-[2px] hover:bg-slate-700 rounded border border-slate-600 text-slate-300 text-xs font-bold transition-all">◀</button>
                        <button onClick={handlePanRight} className="px-2.5 py-1 bg-slate-800 shadow-[0_2px_0_rgba(0,0,0,0.5)] active:shadow-[0_0px_0_rgba(0,0,0,0.5)] active:translate-y-[2px] hover:bg-slate-700 rounded border border-slate-600 text-slate-300 text-xs font-bold transition-all">▶</button>
                        <div className="w-px h-4 bg-white/10 mx-1.5"></div>
                        <button onClick={handleZoomOut} className="px-2.5 py-1 bg-slate-800 shadow-[0_2px_0_rgba(0,0,0,0.5)] active:shadow-[0_0px_0_rgba(0,0,0,0.5)] active:translate-y-[2px] hover:bg-slate-700 rounded border border-slate-600 text-slate-300 text-[9px] font-black uppercase tracking-wider transition-all">Zoom Out</button>
                        <button onClick={handleZoomIn} className="px-2.5 py-1 bg-slate-800 shadow-[0_2px_0_rgba(0,0,0,0.5)] active:shadow-[0_0px_0_rgba(0,0,0,0.5)] active:translate-y-[2px] hover:bg-slate-700 rounded border border-slate-600 text-slate-300 text-[9px] font-black uppercase tracking-wider transition-all">Zoom In</button>
                    </div>
                </div>

                {/* Hardware Canvas */}
                <div className="relative h-[320px] w-full">
                    <canvas 
                        ref={canvasRef} 
                        width={800} 
                        height={320} 
                        className="w-full h-full block"
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUpOrLeave}
                        onMouseLeave={handleMouseUpOrLeave}
                        style={{ cursor: isDragging ? 'grabbing' : 'crosshair' }}
                    />
                    <div className="absolute bottom-2 left-2 flex items-center gap-3">
                        <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400">
                            <span className="w-2 h-2 rounded bg-indigo-400/80 shadow-[0_0_8px_rgba(129,140,248,0.5)]"></span> Mic/Inst
                        </span>
                        <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400">
                            <span className="w-2 h-2 rounded bg-sky-400/80 shadow-[0_0_8px_rgba(56,189,248,0.5)]"></span> IEM
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

interface FestivalTrackerTabProps {
    festivalState: UnifiedFestivalState;
    setFestivalState: React.Dispatch<React.SetStateAction<UnifiedFestivalState>>;
}

const FestivalTrackerTab: React.FC<FestivalTrackerTabProps> = ({ festivalState, setFestivalState }) => {
    // Current day selection (default to first day)
    const [activeDayIdx, setActiveDayIdx] = React.useState(0);
    const day = festivalState.days?.[activeDayIdx];

    // Interactive timeline track view modes
    const [viewMode, setViewMode] = React.useState<'timeline' | 'grid'>('grid');
    const [simulatedTime, setSimulatedTime] = React.useState<number>(0);
    const [isSimulating, setIsSimulating] = React.useState<boolean>(false);
    const [playbackSpeed, setPlaybackSpeed] = React.useState<number>(10); // multiplier
    const [simMode, setSimMode] = React.useState<'manual' | 'live'>('manual');
    const [selectedActId, setSelectedActId] = React.useState<string | null>(null);
    const [timelineZoom, setTimelineZoom] = React.useState<number>(4500); // Dynamic zoom width of timeline canvas
    const [warningsExpanded, setWarningsExpanded] = React.useState<boolean>(true);
    const [hiddenFrequencies, setHiddenFrequencies] = React.useState<Set<string>>(new Set());
    const [activeStageFilters, setActiveStageFilters] = React.useState<Set<string>>(new Set());

    const activeNormFilters = React.useMemo(() => new Set(Array.from(activeStageFilters).map(s => normalizeStageLabel(s))), [activeStageFilters]);

    const isStageVisible = React.useCallback((stageName: string) => {
        if (activeNormFilters.size === 0) return true;
        return activeNormFilters.has(normalizeStageLabel(stageName || 'Global'));
    }, [activeNormFilters]);

    const getFreqUid = (af: { freq: Frequency; actName: string; stage: string }) => `${af.freq.value.toFixed(3)}_${af.actName}_${af.stage}`;

    if (!day) return <div className="p-8 text-center text-slate-500">No festival days defined.</div>;

    const acts = day.acts || [];
    const totalActs = acts.length;
    
    // An act is allocated if it has any frequency assigned, is using house system, is marked as No RF, is Hybrid, or is marked as Own RF
    const allocatedActs = acts.filter(act => 
        (act.frequencies && act.frequencies.some(f => f.value > 0)) || act.useHouseSystem || act.isNoRf || act.isHybrid || act.isOwnRf
    );
    
    const progress = totalActs > 0 ? (allocatedActs.length / totalActs) * 100 : 0;

    // Find a fallback reference date from raw acts, default to May 22, 2026.
    // Pulled out to a shared memo so both normalization and live-sync can use the exact same temporal anchor.
    const baseRefDate = React.useMemo(() => {
        const firstValidRaw = acts
            .map(a => new Date(a.startTime))
            .find(d => !isNaN(d.getTime()));
        const d = firstValidRaw ? new Date(firstValidRaw) : new Date(2026, 4, 22);
        d.setHours(12, 0, 0, 0); // safe midday reference to prevent timezone/leap shifts
        return d;
    }, [acts]);

    // Normalizing act dates to a safe, singular reference day to completely eliminate
    // multi-day timezone shifts or literal date offsets that bunch acts at the end of the timeline track
    const normalizedActs = React.useMemo(() => {
        if (acts.length === 0) return [];
        
        return acts.map(act => {
            const origStart = new Date(act.startTime);
            const origEnd = new Date(act.endTime);

            if (isNaN(origStart.getTime()) || isNaN(origEnd.getTime())) {
                return {
                    ...act,
                    _normStart: 0,
                    _normEnd: 0
                };
            }

            // Create new dates with exactly the same year, month, and day
            const normStart = new Date(baseRefDate);
            normStart.setHours(origStart.getHours(), origStart.getMinutes(), origStart.getSeconds(), 0);

            let normEnd = new Date(baseRefDate);
            normEnd.setHours(origEnd.getHours(), origEnd.getMinutes(), origEnd.getSeconds(), 0);

            // Handle acts crossing the midnight boundary (e.g. 23:00 to 02:00 next day)
            if (normEnd.getTime() < normStart.getTime()) {
                normEnd.setDate(normEnd.getDate() + 1);
            }

            return {
                ...act,
                _normStart: normStart.getTime(),
                _normEnd: normEnd.getTime()
            };
        }).filter(act => act._normStart > 0 && act._normEnd > 0);
    }, [acts, baseRefDate]);

    // Group acts by stage with robust matching over normalized acts
    const stages = festivalState.zoneConfigs || [];
    const stageNames = new Set(stages.map(s => normalizeStageLabel(s.name)));
    
    const actsByStage = React.useMemo(() => {
        return stages.reduce((acc, stage) => {
            const normConfigName = normalizeStageLabel(stage.name);
            acc[stage.name.trim().toLowerCase()] = (normalizedActs as any[]).filter(a => 
                normalizeStageLabel(a.stage || '') === normConfigName
            ).sort((a, b) => b._normStart - a._normStart);
            return acc;
        }, {} as Record<string, typeof normalizedActs>);
    }, [stages, normalizedActs]);

    // Find acts that don't belong to any defined stage and sort them reverse chronologically
    const unmappedActs = acts
        .filter(a => !stageNames.has(normalizeStageLabel(a.stage || '')))
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

    // Compute range of the day's normalized acts
    const actStartTimes = normalizedActs.map(a => a._normStart);
    const actEndTimes = normalizedActs.map(a => a._normEnd);

    const minTime = actStartTimes.length > 0
        ? Math.min(...actStartTimes) - 1800000 // 30 mins margin
        : new Date().setHours(10, 0, 0, 0);

    const maxTime = actEndTimes.length > 0
        ? Math.max(...actEndTimes) + 1800000 // 30 mins margin
        : new Date().setHours(23, 59, 0, 0);

    const timeRange = maxTime - minTime;

    // Sync simulated time on initial day selection using normalized boundaries
    React.useEffect(() => {
        if (normalizedActs.length > 0) {
            setSimulatedTime(Math.min(...normalizedActs.map(a => a._normStart)));
        } else {
            setSimulatedTime(minTime);
        }
    }, [activeDayIdx, normalizedActs, minTime]);

    // Timer logic for simulated playback using normalized boundaries
    React.useEffect(() => {
        if (!isSimulating || simMode === 'live') return;

        const interval = setInterval(() => {
            setSimulatedTime(prev => {
                const step = 60000 * (playbackSpeed / 2); // incremental minutes speed step
                const next = prev + step;
                if (next > maxTime) {
                    return minTime; // loop back to start of day
                }
                return next;
            });
        }, 300);

        return () => clearInterval(interval);
    }, [isSimulating, simMode, minTime, maxTime, playbackSpeed]);

    // Real-Time System Clock Sync onto the active day's timeline using normalized bounds
    React.useEffect(() => {
        if (simMode !== 'live') return;

        const syncToLiveTime = () => {
            const now = new Date();
            const referenceDate = new Date(baseRefDate);
            referenceDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), 0);

            // If the real clock is past midnight (morning) and the festival day starts later,
            // we must logically roll the clock forward a day to properly align with normEnd logic
            const isLateNightClock = now.getHours() < 7;
            const startsGivenDay = new Date(minTime).getHours() >= 7;
            
            if (isLateNightClock && startsGivenDay) {
                 referenceDate.setDate(referenceDate.getDate() + 1);
            }

            let finalVal = referenceDate.getTime();
            if (finalVal < minTime) finalVal = minTime;
            if (finalVal > maxTime) finalVal = maxTime;
            setSimulatedTime(finalVal);
        };

        syncToLiveTime();
        const interval = setInterval(syncToLiveTime, 1000);
        return () => clearInterval(interval);
    }, [simMode, minTime, maxTime, baseRefDate]);

    // Compute current active acts based on normalized times
    const activeActsNow = normalizedActs.filter(act => {
        return simulatedTime >= act._normStart && simulatedTime <= act._normEnd;
    });

    // Pre-calculate clashes for the whole day to highlight on the timeline
    const clashingActIds = React.useMemo(() => {
        const clashes = new Set<string>();
        
        // Get all frequencies for all acts
        const actFreqs = normalizedActs.map(act => ({
            act,
            freqs: (act.frequencies || []).filter(f => f.value > 0)
        })).filter(a => a.freqs.length > 0);
        
        const constantHouseFreqs: { freq: Frequency; source: string }[] = [];
        if (festivalState.constantSystems) {
            festivalState.constantSystems.forEach(sys => {
                sys.frequencies?.forEach(f => {
                    if (f.value > 0) constantHouseFreqs.push({ freq: f, source: 'Constant' });
                });
            });
        }
        if (festivalState.houseSystems) {
            festivalState.houseSystems.forEach(sys => {
                sys.frequencies?.forEach(f => {
                    if (f.value > 0) constantHouseFreqs.push({ freq: f, source: 'House' });
                });
            });
        }
        
        for (let i = 0; i < actFreqs.length; i++) {
            const item1 = actFreqs[i];
            
            // check against constant/house
            for (const ch of constantHouseFreqs) {
                for (const f1 of item1.freqs) {
                    const diff = Math.abs(f1.value - ch.freq.value);
                    if (diff < 0.3 && diff >= 0.001) {
                        clashes.add(item1.act.id);
                    }
                }
            }
            
            // check against other acts
            for (let j = i + 1; j < actFreqs.length; j++) {
                const item2 = actFreqs[j];
                
                // Check overlap
                const overlap = item1.act._normStart <= item2.act._normEnd && item1.act._normEnd >= item2.act._normStart;
                if (overlap) {
                    for (const f1 of item1.freqs) {
                        for (const f2 of item2.freqs) {
                            const diff = Math.abs(f1.value - f2.value);
                            if (diff < 0.3 && diff >= 0.001) {
                                clashes.add(item1.act.id);
                                clashes.add(item2.act.id);
                            }
                        }
                    }
                }
            }
        }
        return clashes;
    }, [normalizedActs, festivalState.constantSystems, festivalState.houseSystems]);

    // Compute live on-air transmitters count
    const activeFrequencies: { freq: Frequency; actName: string; stage: string }[] = [];
    
    // Add Constant Frequencies
    if (festivalState.constantSystems) {
        festivalState.constantSystems.forEach(sys => {
            if (sys.frequencies && isStageVisible(sys.stageName || 'Global')) {
                sys.frequencies.forEach(f => {
                    if (f.value > 0) {
                        const isMic = f.type === 'mic' || f.type === 'generic' || !f.type;
                        activeFrequencies.push({
                            freq: f,
                            actName: `Constant ${isMic ? 'Mic' : 'IEM'}`,
                            stage: sys.stageName || 'Global'
                        });
                    }
                });
            }
        });
    }

    // Add House Frequencies
    if (festivalState.houseSystems) {
        festivalState.houseSystems.forEach(sys => {
            if (sys.frequencies && isStageVisible(sys.stageName || 'Global')) {
                sys.frequencies.forEach(f => {
                    if (f.value > 0) {
                        const isMic = f.type === 'mic' || f.type === 'generic' || !f.type;
                        activeFrequencies.push({
                            freq: f,
                            actName: `${sys.stageName || 'House'} ${isMic ? 'Mic' : 'IEM'}`,
                            stage: sys.stageName || 'Global'
                        });
                    }
                });
            }
        });
    }

    activeActsNow.forEach(act => {
        if (act.frequencies && isStageVisible(act.stage)) {
            act.frequencies.forEach(f => {
                if (f.value > 0) {
                    activeFrequencies.push({
                        freq: f,
                        actName: act.actName,
                        stage: act.stage
                    });
                }
            });
        }
    });

    const activeMicsCount = activeFrequencies.filter(f => f.freq.type === 'mic').length;
    const activeIemsCount = activeFrequencies.filter(f => f.freq.type === 'iem').length;

    // Detect dynamic co-channel spacing conflicts on overlapping running acts
    const visibleFrequencies = activeFrequencies.filter(f => !hiddenFrequencies.has(getFreqUid(f)));
    
    const dynamicWarnings: string[] = [];
    if (visibleFrequencies.length > 1) {
        for (let i = 0; i < visibleFrequencies.length; i++) {
            for (let j = i + 1; j < visibleFrequencies.length; j++) {
                const item1 = visibleFrequencies[i];
                const item2 = visibleFrequencies[j];
                const diff = Math.abs(item1.freq.value - item2.freq.value);
                
                if (diff < 0.3) { // 300kHz spectrum distance guard limit
                    // Suppress false positives: exact same frequency used by the same user/entity across different categories
                    const isExactSameFreq = diff < 0.001;
                    const normalize = (s: string) => s.toLowerCase().replace(/\b(mic|iem|constant|house|tx)\b/g, '').trim();
                    
                    const act1 = normalize(item1.actName);
                    const stage1 = normalize(item1.stage);
                    const act2 = normalize(item2.actName);
                    const stage2 = normalize(item2.stage);

                    const isSimilar = (a: string, b: string) => {
                        if (!a || !b) return false;
                        if (a === b) return true;
                        if (a.length > 3 && b.length > 3) {
                            return a.includes(b) || b.includes(a);
                        }
                        return false;
                    };

                    const isSameUser = (
                        isSimilar(act1, act2) ||
                        isSimilar(stage1, stage2) ||
                        isSimilar(act1, stage2) ||
                        isSimilar(stage1, act2)
                    );

                    if (isExactSameFreq && isSameUser) {
                        continue; // Skip this false positive
                    }

                    dynamicWarnings.push(
                        `⚠️ Adjacent Guard Band Risk: "${item1.actName}" (${item1.stage}) and "${item2.actName}" (${item2.stage}) are transmitting concurrently on very close frequencies (${item1.freq.value.toFixed(3)} MHz vs ${item2.freq.value.toFixed(3)} MHz. Guard separation is only ${(diff * 1000).toFixed(0)} kHz).`
                    );
                }
            }
        }
    }

    // Dynamic hour grid markers
    const hoursArray: number[] = [];
    const minHourDate = new Date(minTime);
    minHourDate.setMinutes(0, 0, 0);
    const startHour = minHourDate.getTime();

    for (let t = startHour; t <= maxTime; t += 3600000) {
        if (t >= minTime) {
            hoursArray.push(t);
        }
    }

    const getHourPct = (timestamp: number) => {
        if (timeRange <= 0) return 0;
        return ((timestamp - minTime) / timeRange) * 100;
    };

    const getFormattedTime = (timestamp: number) => {
        const d = new Date(timestamp);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    };

    const toggleOwnRf = (actId: string) => {
        setFestivalState(prev => {
            const days = [...prev.days];
            const currentDay = days[activeDayIdx];
            days[activeDayIdx] = {
                ...currentDay,
                acts: currentDay.acts.map(a => 
                    a.id === actId ? { ...a, isOwnRf: true, useHouseSystem: false, isNoRf: false, isHybrid: false } : a
                )
            };
            return { ...prev, days };
        });
    };

    const toggleHouseSystem = (actId: string) => {
        setFestivalState(prev => {
            const days = [...prev.days];
            const currentDay = days[activeDayIdx];
            days[activeDayIdx] = {
                ...currentDay,
                acts: currentDay.acts.map(a => a.id === actId ? { ...a, useHouseSystem: !a.useHouseSystem, isNoRf: false, isHybrid: false, isOwnRf: false } : a)
            };
            return { ...prev, days };
        });
    };

    const toggleNoRf = (actId: string) => {
        setFestivalState(prev => {
            const days = [...prev.days];
            const currentDay = days[activeDayIdx];
            days[activeDayIdx] = {
                ...currentDay,
                acts: currentDay.acts.map(a => 
                    a.id === actId ? { ...a, isNoRf: !a.isNoRf, useHouseSystem: false, isHybrid: false, isOwnRf: false } : a
                )
            };
            return { ...prev, days };
        });
    };

    const toggleHybrid = (actId: string) => {
        setFestivalState(prev => {
            const days = [...prev.days];
            const currentDay = days[activeDayIdx];
            days[activeDayIdx] = {
                ...currentDay,
                acts: currentDay.acts.map(a => 
                    a.id === actId ? { ...a, isHybrid: !a.isHybrid, isNoRf: false, useHouseSystem: false, isOwnRf: false } : a
                )
            };
            return { ...prev, days };
        });
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            {/* Header / Progress Section */}
            <div className="flex flex-col md:flex-row gap-4 items-stretch">
                <Card className="flex-1 !bg-slate-900/40 backdrop-blur-xl border-white/5 shadow-2xl">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <CardTitle className="!mb-0 text-indigo-400 font-sans tracking-tight">Site-Wide Allocation Progress</CardTitle>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-1">Live Tracking Across All Stages</p>
                        </div>
                        <div className="text-right">
                            <span className="text-3xl font-black text-white">{Math.round(progress)}%</span>
                            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">{allocatedActs.length} / {totalActs} Acts Complete</p>
                        </div>
                    </div>
                    <div className="h-4 bg-slate-950 rounded-full overflow-hidden border border-white/5 shadow-inner">
                        <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className={`h-full bg-gradient-to-r ${progress === 100 ? 'from-emerald-500 to-teal-400' : 'from-indigo-600 to-cyan-500'} shadow-[0_0_20px_rgba(99,102,241,0.3)]`}
                        />
                    </div>
                </Card>

                {/* Day Selection Slider & View Toggle */}
                <Card className="md:w-96 !bg-slate-950/40 border-white/5 flex flex-col justify-between gap-3 p-2">
                    <div className="flex flex-col gap-1.5">
                        <CardTitle className="text-center !mb-1 text-[10px] text-slate-500 uppercase font-bold tracking-widest">Select Day & Visualizer Mode</CardTitle>
                        <div className="flex gap-2 justify-center">
                            {(festivalState.days || []).map((d, i) => (
                                <button
                                    key={d.id}
                                    onClick={() => setActiveDayIdx(i)}
                                    className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest border transition-all ${activeDayIdx === i ? 'bg-indigo-600 border-indigo-400 text-white shadow-sm border border-slate-700/50' : 'bg-slate-900 border-white/10 text-slate-500 hover:border-white/20'}`}
                                >
                                    {d.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex bg-slate-900/70 p-1 border border-white/5 rounded-md">
                        <button
                            onClick={() => setViewMode('timeline')}
                            className={`flex-1 text-center py-1.5 rounded-sm text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all ${viewMode === 'timeline' ? 'bg-indigo-600 border border-indigo-500/30 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <Clock size={11} /> Timeline
                        </button>
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`flex-1 text-center py-1.5 rounded-sm text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all ${viewMode === 'grid' ? 'bg-indigo-600 border border-indigo-500/30 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <Layout size={11} /> Grid
                        </button>
                    </div>
                </Card>
            </div>

            {/* Render view contents */}
            {viewMode === 'timeline' ? (
                <div className="space-y-6">
                    {/* Stage Soloing / Filtering */}
                    {stages.length > 0 && (
                        <Card className="!bg-slate-900/40 border-white/5 p-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[10px] font-black uppercase text-slate-500 mr-2 flex items-center gap-1.5"><Layout size={12}/> Filter Stages:</span>
                                {stages.map(stage => {
                                    const isActive = activeStageFilters.size === 0 || activeStageFilters.has(stage.name);
                                    return (
                                        <button
                                            key={stage.name}
                                            onClick={() => {
                                                const newFilters = new Set(activeStageFilters);
                                                if (activeStageFilters.has(stage.name)) {
                                                    newFilters.delete(stage.name);
                                                } else {
                                                    newFilters.add(stage.name);
                                                }
                                                setActiveStageFilters(newFilters);
                                            }}
                                            className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded border transition-all ${isActive ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30 shadow-[0_0_10px_rgba(99,102,241,0.2)]' : 'bg-slate-950/50 text-slate-500 border-white/5 hover:text-slate-300 hover:bg-slate-800 opacity-60'}`}
                                        >
                                            {stage.name}
                                        </button>
                                    );
                                })}
                                {activeStageFilters.size > 0 && (
                                    <button
                                        onClick={() => setActiveStageFilters(new Set())}
                                        className="px-3 py-1.5 text-[10px] ml-auto font-black uppercase tracking-widest rounded border transition-colors bg-slate-950/50 text-rose-400 border-rose-500/20 hover:bg-rose-950/50"
                                    >
                                        Clear Filters
                                    </button>
                                )}
                            </div>
                        </Card>
                    )}

                    {/* Interactive Playback Simulator & Dynamic Metrics Panel */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
                        {/* COLUMN 1: LEFT TWO-THIRDS PANEL */}
                        <div className="lg:col-span-2 flex flex-col gap-4">
                            {/* Live Spectrum Analyzer (Replaces Coordinator Clock slot) */}
                            <Card className="!bg-slate-900/40 border-white/5 p-5 flex flex-col justify-between relative overflow-hidden w-full">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white">Live Spectrum Analyzer</h3>
                                        <p className="text-[9px] text-slate-500 uppercase tracking-widest font-extrabold mt-0.5">Dynamic RF Footprint Visualizer</p>
                                    </div>
                                    <div className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/25 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest text-rose-400 select-none">
                                        <Activity size={10} className="animate-pulse" /> Active Scan
                                    </div>
                                </div>
                                <LiveSpectrumAnalyzer activeFrequencies={visibleFrequencies} />
                            </Card>

                    {/* Dynamic Guard Separation Warning list */}
                    {dynamicWarnings.length > 0 && (
                        <Card className="!bg-rose-950/20 border-rose-500/20 shadow-sm border border-slate-700/50 overflow-hidden p-0">
                            <div 
                                className="p-3 bg-rose-900/15 border-b border-rose-500/10 flex items-center justify-between cursor-pointer hover:bg-rose-900/30 transition-colors"
                                onClick={() => setWarningsExpanded(!warningsExpanded)}
                            >
                                <span className="text-[10px] font-black text-rose-400 uppercase tracking-wider flex items-center gap-2">
                                    <AlertCircle size={14} /> Dynamic Frequency Separation Warning Alerts ({dynamicWarnings.length})
                                </span>
                                <div className="flex items-center gap-3">
                                    <span className="text-[8px] font-mono bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded font-bold uppercase">Severe Separation Danger</span>
                                    <span className="text-rose-400 font-bold text-xs">
                                        {warningsExpanded ? '▲' : '▼'}
                                    </span>
                                </div>
                            </div>
                            {warningsExpanded && (
                                <div className="p-2 space-y-2 max-h-40 overflow-y-auto">
                                    {dynamicWarnings.map((warning, nIdx) => (
                                        <div key={nIdx} className="text-[10px] text-rose-300 font-mono font-semibold bg-rose-950/35 border-l-2 border-rose-500 px-3 py-1.5 rounded-r">
                                            {warning}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>
                    )}

                    {/* horizontal Chronological Timeline canvas */}
                    <Card className="!bg-slate-900/30 backdrop-blur-md border-white/5 overflow-hidden p-0 relative shadow-2xl flex-1 flex flex-col">
                        <div className="p-2 border-b border-white/5 bg-slate-900/50 flex flex-col md:flex-row md:items-center justify-between gap-2">
                            <div>
                                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white">Chronological Running Order Track</h3>
                                <p className="text-[9px] text-slate-500 uppercase tracking-widest font-extrabold mt-0.5">Multi-Stage Visual Gantt View</p>
                            </div>

                            {/* Live Zoom Slider (Allowing extremely deep zooming to inspect act names) */}
                            <div className="flex items-center gap-2.5 bg-slate-950/80 px-3 py-2 rounded-md border border-white/5">
                                <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-1.5 whitespace-nowrap">
                                    <Sliders size={12} /> Timeline Track Zoom:
                                </span>
                                <input 
                                    type="range"
                                    min={1500}
                                    max={12000}
                                    step={500}
                                    value={timelineZoom}
                                    onChange={(e) => setTimelineZoom(Number(e.target.value))}
                                    className="w-32 h-1 bg-slate-900 rounded-sm appearance-none cursor-pointer accent-rose-500"
                                    title="Slide left or right to zoom the timeline lanes horizontally to inspect act names"
                                />
                                <span className="text-[8px] font-mono font-bold text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-white/5">{timelineZoom}px</span>
                            </div>

                            <div className="flex flex-wrap gap-2 text-[9px] font-bold uppercase tracking-widest text-slate-500">
                                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-cyan-500/15 border border-cyan-500/30" /> Own RF</span>
                                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-indigo-600/20 border border-indigo-600/30" /> House RF</span>
                                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-indigo-500/15 border border-indigo-500/30" /> Hybrid</span>
                                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 border border-dashed border-slate-500" /> No RF</span>
                                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-amber-500/15 border border-amber-500/30" /> Pending</span>
                            </div>
                        </div>

                        {/* Gantt Chart Canvas Body */}
                        <div className="p-2 flex-1 flex flex-col justify-between">
                            {/* Timeline Area (Horizontal scrolling with Zoom state width) */}
                            <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                                <div 
                                    className="relative p-2 pb-12 pt-8 select-none transition-all duration-200"
                                    style={{ minWidth: `${timelineZoom}px` }}
                                >
                                    {/* Hour markers grid */}
                                    <div className="absolute top-0 bottom-0 pointer-events-none z-0" style={{ left: '208px', right: '16px' }}>
                                        {hoursArray.map((hr, idx) => {
                                            const pct = getHourPct(hr);
                                            return (
                                                <div 
                                                    key={idx} 
                                                    className="absolute top-0 bottom-0 border-l border-white/5 flex flex-col justify-between" 
                                                    style={{ left: `${pct}%` }}
                                                >
                                                    <span className="text-[8px] font-mono leading-none pt-2 pl-1 text-slate-600 font-bold">{getHourString(hr)}</span>
                                                    <span className="text-[8px] font-mono leading-none pb-2 pl-1 text-slate-600 font-bold">{getHourString(hr)}</span>
                                                </div>
                                            );
                                        })}

                                        {/* Laser-Red Simulation Playhead line */}
                                        <div 
                                            className="absolute top-0 bottom-0 w-0.5 bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.8)] z-10 transition-all duration-300"
                                            style={{ left: `${getHourPct(simulatedTime)}%` }}
                                        >
                                            <div className="absolute top-0 -translate-x-1/2 bg-rose-500 text-white text-[8px] font-mono font-black px-1.5 py-0.5 rounded uppercase tracking-widest whitespace-nowrap shadow-md select-none">
                                                {getFormattedTime(simulatedTime)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Gantt Stages Rows */}
                                    <div className="space-y-4 relative z-0 mt-2">
                                        {stages.filter(s => isStageVisible(s.name)).map((stage) => {
                                            const stageActs = actsByStage[stage.name.trim().toLowerCase()] || [];
                                            
                                            return (
                                                <div key={stage.name} className="flex items-center min-h-[48px]">
                                                    {/* Stage Label Block - STICKY so it sticks perfectly during horizontal scrolling! */}
                                                    <div className="sticky left-0 w-44 flex-shrink-0 bg-slate-950/95 backdrop-blur border-r border-white/10 p-2.5 mr-4 z-20 shadow-sm border border-slate-700/50 rounded-r-lg">
                                                        <span className="text-[10px] font-black uppercase text-white tracking-widest block truncate" title={stage.name}>{stage.name}</span>
                                                        <span className="text-[8px] text-zinc-500 block font-bold uppercase tracking-widest mt-0.5">
                                                            {stageActs.length} Acts Scheduled
                                                        </span>
                                                    </div>

                                                    {/* Horizontal Lane */}
                                                    <div className="flex-1 relative h-11 bg-slate-950/20 rounded-md border border-white/3">
                                                        {stageActs.map((act: any) => {
                                                            const s = act._normStart || new Date(act.startTime).getTime();
                                                            const e = act._normEnd || new Date(act.endTime).getTime();
                                                            if (isNaN(s) || isNaN(e)) return null;

                                                            const leftPct = getHourPct(s);
                                                            const rightPct = getHourPct(e);
                                                            let widthPct = rightPct - leftPct;
                                                            if (widthPct < 3) widthPct = 3; // secure minimum handle size

                                                            const isCurrentlyOnAir = simulatedTime >= s && simulatedTime <= e;
                                                            const hasFrequencies = act.frequencies && act.frequencies.some((f: any) => f.value > 0);
                                                            const isAllocated = hasFrequencies || act.useHouseSystem || act.isHybrid || act.isOwnRf;

                                                            const startTimeStr = new Date(act.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                                                            const endTimeStr = new Date(act.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

                                                            const validFreqs = act.frequencies?.filter((f: any) => f.value > 0) || [];

                                                            const isClashing = clashingActIds.has(act.id);

                                                            // Allocate color categories based on RF status
                                                            let styleClass = '';
                                                            if (isClashing) {
                                                                styleClass = 'border-rose-500 bg-rose-500/20 text-white shadow-[0_0_15px_rgba(244,63,94,0.4)] animate-pulse';
                                                            } else if (act.isNoRf) {
                                                                styleClass = 'border-dashed border-slate-500 bg-slate-500/10 text-slate-400';
                                                            } else if (act.isHybrid) {
                                                                styleClass = 'border-indigo-400 bg-indigo-500/15 text-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.1)]';
                                                            } else if (hasFrequencies || act.isOwnRf) {
                                                                styleClass = 'border-cyan-400 bg-cyan-500/15 text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.15)]';
                                                            } else if (act.useHouseSystem) {
                                                                styleClass = 'border-indigo-600 bg-indigo-600/20 text-indigo-300';
                                                            } else if (isAllocated) {
                                                                styleClass = 'border-cyan-400 bg-cyan-500/15 text-cyan-400';
                                                            } else {
                                                                styleClass = 'border-amber-500/60 bg-amber-500/15 text-amber-400 animate-pulse';
                                                            }

                                                            const isSelected = selectedActId === act.id;

                                                            return (
                                                                <div
                                                                    key={act.id}
                                                                    onClick={() => setSelectedActId(isSelected ? null : act.id)}
                                                                    className={`absolute top-0.5 bottom-0.5 rounded-sm border flex flex-col justify-center px-3 cursor-pointer transition-all ${styleClass} ${isCurrentlyOnAir ? 'ring-2 ring-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)] z-10' : ''} ${isSelected ? 'scale-[1.03] shadow-[0_0_20px_rgba(99,102,241,0.4)] ring-2 ring-indigo-500 z-10' : ''}`}
                                                                    style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                                                                    title={`${act.actName} (${act.stage || 'No Stage'})`}
                                                                >
                                                                    {/* Wrapped title with line-clamp so long act names are fully visible instead of truncation */}
                                                                    <span className="text-[10px] font-bold uppercase tracking-tight block line-clamp-2 leading-tight text-white mb-0.5">
                                                                        {act.actName}
                                                                    </span>
                                                                    <div className="flex items-center gap-1.5 justify-between flex-wrap mt-auto">
                                                                        <span className="text-[8px] font-mono leading-none block opacity-85 text-slate-300">{startTimeStr}-{endTimeStr}</span>
                                                                        {isClashing && (
                                                                            <span className="text-[8px] flex items-center gap-1 font-mono bg-rose-950 text-white px-1 py-0.5 rounded border border-rose-500 font-bold ml-auto z-10" title="This act has an overlapping frequency clash with another concurrent act">
                                                                                <AlertCircle size={8} /> CLASH
                                                                            </span>
                                                                        )}
                                                                        {validFreqs.length > 0 && !isClashing && (
                                                                            <span className="text-[8px] font-mono bg-cyan-950/90 text-cyan-300 px-1 py-0.5 rounded border border-cyan-500/30 truncate max-w-[170px] font-bold ml-auto">
                                                                                {validFreqs.length} Ch: {validFreqs.map((f: any) => f.value.toFixed(1)).join(', ')} MHz
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Simulation Clock & Slider */}
                            <Card className="!bg-slate-900/40 border-white/5 p-5 flex flex-col justify-between relative overflow-hidden w-full">
                            <div className="absolute right-4 top-4 flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-500/25 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest text-indigo-400 select-none">
                                <Activity size={10} className="animate-pulse" /> Coordinator Clock
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <div className="bg-slate-950 px-5 py-3 rounded-md border border-white/5 font-mono text-3xl font-black text-rose-400 tracking-wider shadow-inner flex items-center justify-center w-48">
                                        {new Date(simulatedTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Active Sim Clock</p>
                                        <p className="text-[9px] text-slate-500 font-bold uppercase mt-0.5 leading-snug">
                                            Slide the scrubber or click Play to analyze concurrent stages & live guard spacing overlays.
                                        </p>
                                    </div>
                                </div>

                                {/* Scrubber Range Slider */}
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none">
                                        <span>Start: {getFormattedTime(minTime)}</span>
                                        <span className="text-slate-400">Selected Playhead Point</span>
                                        <span>End: {getFormattedTime(maxTime)}</span>
                                    </div>
                                    <input 
                                        type="range"
                                        min={minTime}
                                        max={maxTime}
                                        step={60000} // minutes
                                        value={simulatedTime}
                                        onChange={(e) => {
                                            setSimulatedTime(Number(e.target.value));
                                            setSimMode('manual');
                                        }}
                                        className="w-full h-1.5 bg-slate-950 rounded-sm appearance-none cursor-pointer accent-rose-500 border border-white/5"
                                    />
                                </div>
                            </div>

                            {/* Control Bars */}
                            <div className="flex flex-wrap items-center justify-between gap-2 mt-5 pt-4 border-t border-white/5">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => {
                                            setSimMode('manual');
                                            setIsSimulating(!isSimulating);
                                        }}
                                        disabled={simMode === 'live'}
                                        className={`p-2.5 rounded-md border flex items-center justify-center transition-all ${isSimulating ? 'bg-amber-600/20 border-amber-500/30 text-amber-400' : 'bg-slate-950 border-white/5 text-slate-400 hover:text-white'}`}
                                        title={isSimulating ? "Pause Time-Lapse" : "Play Time-Lapse"}
                                    >
                                        {isSimulating ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
                                    </button>

                                    <div className="flex bg-slate-950 p-1 border border-white/5 rounded-md text-[9px] font-black uppercase tracking-wider">
                                        <button
                                            onClick={() => {
                                                setSimMode('manual');
                                                setIsSimulating(false);
                                            }}
                                            className={`px-3 py-1.5 rounded-sm transition-all ${simMode === 'manual' ? 'bg-slate-900 border border-white/5 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                                        >
                                            Simulator Mode
                                        </button>
                                        <button
                                            onClick={() => {
                                                setSimMode('live');
                                                setIsSimulating(false);
                                            }}
                                            className={`px-3 py-1.5 rounded-sm transition-all ${simMode === 'live' ? 'bg-indigo-600 border border-indigo-500/30 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                                        >
                                            Sync Live Clock
                                        </button>
                                    </div>
                                </div>

                                {simMode === 'manual' && (
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1"><Sliders size={12} /> Speed:</span>
                                        <div className="flex bg-slate-950 border border-white/5 p-1 rounded-md text-[9px] font-mono font-black">
                                            {[2, 10, 30].map(speed => (
                                                <button
                                                    key={speed}
                                                    onClick={() => setPlaybackSpeed(speed)}
                                                    className={`px-2.5 py-1 rounded-sm transition-all ${playbackSpeed === speed ? 'bg-slate-900 text-rose-400 border border-white/5' : 'text-slate-500 hover:text-slate-300'}`}
                                                >
                                                    {speed / 2}min/s
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Card>

                </div>

                {/* COLUMN 2: RIGHT ONE-THIRD PANEL (Stretches vertically layout side-by-side) */}
                <div className="lg:col-span-1 flex flex-col h-full">
                    
                    {/* Real-time RF Load Metrics Widget */}
                    <Card className="!bg-slate-900/40 border-white/5 p-5 flex flex-col justify-between h-full w-full">
                        <div className="flex-1 flex flex-col">
                            <CardTitle className="!mb-1 text-slate-400 text-xs font-sans uppercase tracking-[0.1em]">Dynamic Active RF Footprint</CardTitle>
                            <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-4">Live Airwaves State at Simulated Hour</p>
                            
                            <div className="grid grid-cols-2 gap-2.5 mb-4">
                                <div className="bg-slate-950/60 p-2.5 rounded-md border border-white/5 text-center">
                                    <span className="block text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Mics</span>
                                    <span className="text-lg font-semibold font-black text-cyan-400">{activeMicsCount}</span>
                                    <span className="block text-[8px] text-slate-600 font-bold uppercase tracking-widest mt-0.5">Air</span>
                                </div>
                                <div className="bg-slate-950/60 p-2.5 rounded-md border border-white/5 text-center">
                                    <span className="block text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">IEMs</span>
                                    <span className="text-lg font-semibold font-black text-indigo-400">{activeIemsCount}</span>
                                    <span className="block text-[8px] text-slate-600 font-bold uppercase tracking-widest mt-0.5">Air</span>
                                </div>
                            </div>

                            {/* Dynamic On-Air Frequency Spectrum Output Box (Height extended vertically to match the bottom of the timeline box!) */}
                            <div className="mt-4 bg-slate-950/60 rounded-md border border-white/5 p-3 flex-1 flex flex-col min-h-[350px]">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest">Active Air Frequencies</span>
                                    <span className="text-[8px] font-mono text-slate-500 font-black uppercase">{activeFrequencies.length} Ch</span>
                                </div>
                                {activeFrequencies.length > 0 ? (
                                    <div className="space-y-1.5 overflow-y-auto pr-1 flex-1 max-h-[500px]">
                                        {activeFrequencies.map((af, index) => {
                                            const uid = getFreqUid(af);
                                            const isHidden = hiddenFrequencies.has(uid);
                                            return (
                                            <div key={index} className={`flex items-center justify-between text-[10px] bg-slate-900/40 p-1.5 rounded border border-white/5 animate-in fade-in duration-200 ${isHidden ? 'opacity-40 grayscale' : ''}`}>
                                                <div className="flex flex-col min-w-0 flex-1">
                                                    <span className="text-white font-bold truncate leading-none text-[10px]">{af.freq.label || 'Tuned Unit'}</span>
                                                    <span className="text-[8px] text-slate-500 font-black uppercase tracking-tight mt-1 truncate">{af.actName} [{af.stage}]</span>
                                                </div>
                                                <div className="text-right pl-3 flex-shrink-0 flex items-center gap-2">
                                                    <span className="text-[10px] font-mono font-black text-cyan-400 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-500/10">
                                                        {af.freq.value.toFixed(3)} MHz
                                                    </span>
                                                    <button 
                                                        onClick={() => {
                                                            const newHidden = new Set(hiddenFrequencies);
                                                            if (isHidden) newHidden.delete(uid);
                                                            else newHidden.add(uid);
                                                            setHiddenFrequencies(newHidden);
                                                        }}
                                                        className={`transition-colors ${isHidden ? 'text-rose-400 hover:text-rose-300' : 'text-slate-400 hover:text-white'}`}
                                                        title={isHidden ? "Show on Spectrum" : "Hide from Spectrum"}
                                                    >
                                                        {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                                                    </button>
                                                </div>
                                            </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center py-8">
                                        <p className="text-[9px] text-slate-500 font-bold uppercase">No active frequencies on air</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2 text-xs leading-none mt-4 border-t border-white/5 pt-3">
                            <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                                <span className="text-slate-500 font-extrabold text-[10px] uppercase">Active Stage Count</span>
                                <span className="text-white font-mono font-bold">{new Set(activeActsNow.map(a => a.stage)).size} Zones</span>
                            </div>
                            <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                                <span className="text-slate-500 font-extrabold text-[10px] uppercase">Concurrent On-Air Acts</span>
                                <span className="text-white font-mono font-bold">{activeActsNow.length} Stage(s)</span>
                            </div>
                            <div className="flex items-center justify-between py-1.5">
                                <span className="text-slate-500 font-extrabold text-[10px] uppercase">On-Air Transmitters</span>
                                <span className="text-rose-400 font-mono font-black">{activeFrequencies.length} Ch</span>
                            </div>
                        </div>
                    </Card>

                </div>

            </div>

                    {/* Selected Act Details Panel */}
                    {selectedActId && (() => {
                        const selAct = acts.find(a => a.id === selectedActId);
                        if (!selAct) return null;
                        const validFreqs = selAct.frequencies?.filter(f => f.value > 0) || [];
                        const micReqCount = selAct.micRequests?.reduce((sum, r) => sum + Number(r.count), 0) || 0;
                        const iemReqCount = selAct.iemRequests?.reduce((sum, r) => sum + Number(r.count), 0) || 0;

                        return (
                            <motion.div
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in duration-300"
                            >
                                <Card className="md:col-span-2 !bg-slate-900/40 border-indigo-500/20 p-5 relative overflow-hidden">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <span className="text-[9px] font-black uppercase text-indigo-400 tracking-wider">Timeline Detail</span>
                                            <h4 className="text-base font-medium font-black text-white uppercase mt-0.5">{selAct.actName}</h4>
                                            <p className="text-[10px] text-zinc-400 font-bold uppercase mt-1">Stage Location: {selAct.stage}</p>
                                        </div>

                                        <div className="text-right">
                                            <p className="text-[8px] text-slate-500 uppercase font-black">Time Bracket</p>
                                            <span className="text-xs font-mono font-bold text-white bg-slate-950 px-2 py-1 rounded border border-white/5 inline-block mt-0.5">
                                                {new Date(selAct.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(selAct.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Frequencies breakdown list */}
                                    <div className="mt-5 space-y-3">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Coordinated Frequency Spectrum Plan</p>
                                        
                                        {validFreqs.length === 0 ? (
                                            <div className="text-center py-4 bg-slate-950/40 rounded-md border border-white/5">
                                                <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest">{selAct.isNoRf ? 'NO WIRELESS REQUIRED' : 'PENDING SPECTRUM CO-ORDINATION'}</p>
                                                {!selAct.isNoRf && <p className="text-[8px] text-slate-500 font-bold uppercase mt-1">Visit coordination tabs or auto-calculate coordinates to populate.</p>}
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                                                {validFreqs.map((f, fIdx) => (
                                                    <div key={fIdx} className="bg-slate-950/40 p-2.5 rounded-md border border-white/5 flex flex-col justify-between">
                                                        <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-widest leading-none truncate mb-1">{f.label || 'Tuned Unit'}</span>
                                                        <span className="text-sm font-black font-mono text-cyan-400 tracking-tighter">{f.value.toFixed(3)} MHz</span>
                                                        <span className="block text-[7px] text-zinc-400 uppercase font-black tracking-tighter mt-1">{f.type || 'TX'} System</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </Card>

                                <Card className="!bg-slate-900/40 border-indigo-500/20 p-5 flex flex-col justify-between">
                                    <div>
                                        <span className="text-[9px] font-black uppercase text-indigo-400 tracking-wider">Wireless Demands</span>
                                        <h4 className="text-xs font-black text-white uppercase mt-1">Hardware Allocation Status</h4>
                                        <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mt-0.5">Target equipment requests</p>

                                        <div className="mt-4 space-y-2">
                                            <div className="flex items-center justify-between text-xs py-1.5 border-b border-white/5">
                                                <span className="text-slate-500 font-extrabold text-[10px] uppercase">Microphones</span>
                                                <span className="text-white font-mono font-bold">{micReqCount} Ch Requested</span>
                                            </div>
                                            <div className="flex items-center justify-between text-xs py-1.5 border-b border-white/5">
                                                <span className="text-slate-500 font-extrabold text-[10px] uppercase">IEMs / Monitors</span>
                                                <span className="text-white font-mono font-bold">{iemReqCount} Ch Requested</span>
                                            </div>
                                            <div className="flex items-center justify-between text-xs py-1.5 border-b border-white/5">
                                                <span className="text-slate-500 font-extrabold text-[10px] uppercase">Mute House Mics</span>
                                                <span className="text-white font-mono font-bold">{selAct.muteHouseMics ? 'Enabled' : 'Disabled'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-4 mt-4 border-t border-white/5">
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => {
                                                    toggleOwnRf(selAct.id);
                                                }}
                                                className={`flex-1 py-1.5 rounded-sm text-[9px] font-black uppercase tracking-tighter border ${selAct.isOwnRf ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' : 'bg-slate-950 hover:bg-slate-900 text-slate-400 border-white/5'}`}
                                            >
                                                Own RF
                                            </button>
                                            <button
                                                onClick={() => {
                                                    toggleHouseSystem(selAct.id);
                                                }}
                                                className={`flex-1 py-1.5 rounded-sm text-[9px] font-black uppercase tracking-tighter border ${selAct.useHouseSystem ? 'bg-indigo-600/20 text-indigo-300 border-indigo-600/30' : 'bg-slate-950 hover:bg-slate-900 text-slate-400 border-white/5'}`}
                                            >
                                                House RF
                                            </button>
                                        </div>
                                    </div>
                                </Card>
                            </motion.div>
                        );
                    })()}
                </div>
            ) : (
                /* Traditional Stages Grid Layout (View mode: grid) */
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 pb-20">
                    {stages.map((stage, stageIdx) => {
                        const stageActs = actsByStage[stage.name.trim().toLowerCase()] || [];
                        const stageAllocated = stageActs.filter(a => (a.frequencies && a.frequencies.some(f => f.value > 0)) || a.useHouseSystem).length;
                        const stageProgress = stageActs.length > 0 ? (stageAllocated / stageActs.length) * 100 : 0;

                        return (
                            <motion.div 
                                key={stage.name}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: stageIdx * 0.1 }}
                            >
                                <Card className="h-full !bg-slate-900/30 backdrop-blur-md border-white/5 flex flex-col overflow-hidden !p-0">
                                    <div className="p-2 border-b border-white/5 bg-slate-900/50 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-2 h-2 rounded-full ${stageProgress === 100 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : stageProgress > 0 ? 'bg-amber-500 animate-pulse' : 'bg-slate-700'}`} />
                                            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white">{stage.name}</h3>
                                        </div>
                                        <span className="text-[10px] font-black text-slate-500 uppercase">{stageAllocated} / {stageActs.length} READY</span>
                                    </div>

                                    <div className="flex-1 overflow-x-auto">
                                        {stageActs.length === 0 ? (
                                            <div className="p-8 text-center text-[11px] text-slate-600 font-bold uppercase italic tracking-widest">
                                                No acts scheduled for this stage
                                            </div>
                                        ) : (
                                            <TrackerTable acts={stageActs} toggleHouseSystem={toggleHouseSystem} toggleNoRf={toggleNoRf} toggleHybrid={toggleHybrid} toggleOwnRf={toggleOwnRf} />
                                        )}
                                    </div>
                                </Card>
                            </motion.div>
                        );
                    })}

                    {/* Unmapped Acts Section */}
                    {unmappedActs.length > 0 && (
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="xl:col-span-2"
                        >
                            <Card className="!bg-rose-950/20 border-rose-500/20 flex flex-col overflow-hidden !p-0">
                                <div className="p-2 border-b border-rose-500/20 bg-rose-900/20 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <AlertCircle size={16} className="text-rose-400" />
                                        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-rose-400">Acts with Invalid Stage Assignment</h3>
                                    </div>
                                    <span className="text-[10px] font-black text-rose-500/60 uppercase">{unmappedActs.length} ISSUES</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <TrackerTable acts={unmappedActs} toggleHouseSystem={toggleHouseSystem} toggleNoRf={toggleNoRf} toggleHybrid={toggleHybrid} toggleOwnRf={toggleOwnRf} />
                                </div>
                            </Card>
                        </motion.div>
                    )}
                </div>
            )}
        </div>
    );
};

const getHourString = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
};

interface TrackerTableProps {
    acts: FestivalAct[];
    toggleHouseSystem: (id: string) => void;
    toggleNoRf: (id: string) => void;
    toggleHybrid: (id: string) => void;
    toggleOwnRf: (id: string) => void;
}

const TrackerTable: React.FC<TrackerTableProps> = ({ acts, toggleHouseSystem, toggleNoRf, toggleHybrid, toggleOwnRf }) => {
    return (
        <table className="w-full text-left border-collapse">
            <thead>
                <tr className="bg-slate-950/40 text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5">
                    <th className="px-3 py-3">Time</th>
                    <th className="px-3 py-3">Act Name</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Equipment</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
                {acts.map((act) => {
                    const hasFrequencies = act.frequencies && act.frequencies.some(f => f.value > 0);
                    const isAllocated = hasFrequencies || act.useHouseSystem || act.isHybrid || act.isOwnRf;
                    const hasGuestGear = (act.micRequests?.length || 0) > 0 || (act.iemRequests?.length || 0) > 0;
                    
                    const startTime = act.startTime ? new Date(act.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--';
                    const endTime = act.endTime ? new Date(act.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--';

                    return (
                        <tr key={act.id} className="hover:bg-white/5 transition-colors group">
                            <td className="px-3 py-2">
                                <div className="flex items-center gap-2 text-slate-400">
                                    <Clock size={10} className="text-slate-600" />
                                    <span className="text-[10px] font-mono font-bold leading-none">{startTime} - {endTime}</span>
                                </div>
                            </td>
                            <td className="px-3 py-2">
                                <span className="text-xs font-black text-white uppercase tracking-tight">{act.actName}</span>
                                {act.stage && <p className="text-[8px] text-slate-500 font-bold uppercase mt-0.5">{act.stage}</p>}
                            </td>
                            <td className="px-3 py-2">
                                {act.isNoRf ? (
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-500/10 border border-slate-500/30 text-slate-400">
                                        <Shield size={10} className="opacity-50" />
                                        <span className="text-[10px] font-black uppercase tracking-tighter">No RF</span>
                                    </div>
                                ) : act.isHybrid ? (
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                                        <Zap size={10} className="text-indigo-400" />
                                        <span className="text-[10px] font-black uppercase tracking-tighter">Hybrid</span>
                                    </div>
                                ) : hasFrequencies ? (
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 animate-in fade-in zoom-in duration-300">
                                        <Briefcase size={10} strokeWidth={2.5} />
                                        <span className="text-[10px] font-black uppercase tracking-tighter">Own RF</span>
                                    </div>
                                ) : act.useHouseSystem ? (
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-600/10 border border-indigo-600/30 text-indigo-400">
                                        <Layout size={10} className="text-indigo-400" />
                                        <span className="text-[10px] font-black uppercase tracking-tighter">House RF</span>
                                    </div>
                                ) : act.isOwnRf ? (
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 animate-in fade-in zoom-in duration-300">
                                        <Briefcase size={10} strokeWidth={2.5} />
                                        <span className="text-[10px] font-black uppercase tracking-tighter">Own RF</span>
                                    </div>
                                ) : isAllocated ? (
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 animate-in fade-in zoom-in duration-300">
                                        <Briefcase size={10} strokeWidth={2.5} />
                                        <span className="text-[10px] font-black uppercase tracking-tighter">Own RF</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400">
                                        <AlertCircle size={10} />
                                        <span className="text-[10px] font-black uppercase tracking-tighter">Pending</span>
                                    </div>
                                )}
                            </td>
                            <td className="px-3 py-2">
                                <div className="flex items-center gap-3">
                                    <div 
                                        onClick={() => toggleOwnRf(act.id)}
                                        className={`flex items-center gap-1 px-1.5 py-1 transition-all cursor-pointer select-none rounded border border-transparent ${(hasFrequencies || act.isOwnRf || (!act.useHouseSystem && !act.isNoRf && !act.isHybrid)) && !act.isHybrid ? 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20 shadow-[0_0_10px_rgba(34,211,238,0.15)]' : 'text-slate-600 hover:text-slate-400'}`}
                                        title="Assign as Own RF Equipment"
                                    >
                                        <Briefcase size={10} />
                                        <span className="text-[8px] font-black uppercase tracking-tighter">Own RF</span>
                                    </div>
                                    <div 
                                        onClick={() => toggleHouseSystem(act.id)}
                                        className={`flex items-center gap-1 px-1.5 py-1 transition-all cursor-pointer select-none rounded border border-transparent ${(act.useHouseSystem && !hasFrequencies) ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' : 'text-slate-600 hover:text-slate-400'}`}
                                        title="Assign to House System"
                                    >
                                        <Layout size={10} />
                                        <span className="text-[8px] font-black uppercase tracking-tighter">House</span>
                                    </div>
                                    <div 
                                        onClick={() => toggleHybrid(act.id)}
                                        className={`flex items-center gap-1 px-1.5 py-1 transition-all cursor-pointer select-none rounded border border-transparent ${act.isHybrid ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' : 'text-slate-600 hover:text-slate-400'}`}
                                        title="Hybrid (House + Own gear)"
                                    >
                                        <Zap size={10} />
                                        <span className="text-[8px] font-black uppercase tracking-tighter">Hybrid</span>
                                    </div>
                                    <div 
                                        onClick={() => toggleNoRf(act.id)}
                                        className={`flex items-center gap-1 px-1.5 py-1 transition-all cursor-pointer select-none rounded border border-transparent ${act.isNoRf ? 'text-slate-300 bg-slate-500/20 border-slate-500/30' : 'text-slate-600 hover:text-slate-400'}`}
                                        title="No Wireless Required"
                                    >
                                        <Shield size={10} />
                                        <span className="text-[8px] font-black uppercase tracking-tighter">No RF</span>
                                    </div>
                                </div>
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
};

export default FestivalTrackerTab;
