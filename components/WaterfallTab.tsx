import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { Frequency, ScanDataPoint, WMASState } from '../types';
import Card, { CardTitle } from './Card';
import { US_TV_CHANNELS, UK_TV_CHANNELS, getWmasBandwidth } from '../constants';

interface WaterfallTabProps {
    analyzerFrequencies: Frequency[];
    generatorFrequencies: Frequency[] | null;
    scanData: ScanDataPoint[] | null;
    wmasState?: WMASState;
    serialDevice?: any;
    serialStatus?: string;
    serialIsScanning?: boolean;
    setSerialIsScanning?: (is: boolean) => void;
    onConnectSerial?: (type: 'tinysa' | 'rfexplorer') => Promise<void>;
    onDisconnectSerial?: () => Promise<void>;
    onAutoDetectSerial?: (type: 'tinysa' | 'rfexplorer') => Promise<void>;
    scanStartFreq?: number;
    scanStopFreq?: number;
    setScanStartFreq?: (freq: number) => void;
    setScanStopFreq?: (freq: number) => void;
}

const buttonBase = "w-full px-3 py-2.5 rounded-sm font-semibold uppercase tracking-wide transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 transform active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed";
const primaryButton = `bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-b-4 border-blue-800 hover:border-blue-700 hover:brightness-110 ${buttonBase}`;
const dangerButton = `bg-gradient-to-r from-red-500 to-rose-500 text-white border-b-4 border-red-800 hover:border-red-700 hover:brightness-110 ${buttonBase}`;
const secondaryButton = `bg-slate-700 text-slate-200 border-b-4 border-slate-900 hover:border-slate-800 hover:bg-slate-600 ${buttonBase}`;
const successButton = `bg-gradient-to-r from-emerald-500 to-green-500 text-white border-b-4 border-emerald-800 hover:border-emerald-700 hover:brightness-110 ${buttonBase}`;

const WaterfallTab: React.FC<WaterfallTabProps> = ({ 
    analyzerFrequencies, 
    generatorFrequencies, 
    scanData, 
    wmasState,
    serialDevice,
    serialStatus,
    serialIsScanning,
    setSerialIsScanning,
    onConnectSerial,
    onDisconnectSerial,
    onAutoDetectSerial,
    scanStartFreq = 470,
    scanStopFreq = 700,
    setScanStartFreq,
    setScanStopFreq
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const miniAnalyzerRef = useRef<HTMLCanvasElement>(null);
    const overlayRef = useRef<HTMLCanvasElement>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [freqs, setFreqs] = useState<Frequency[]>([]);
    const [range, setRange] = useState({ min: scanStartFreq, max: scanStopFreq });
    const [autoSyncRange, setAutoSyncRange] = useState(true);
    const [updateRate, setUpdateRate] = useState(100);
    const [colorScheme, setColorScheme] = useState('thermal');
    const [overlayChannels, setOverlayChannels] = useState(true);
    const [region, setRegion] = useState('uk');
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const [deviceType, setDeviceType] = useState<'tinysa' | 'rfexplorer'>('tinysa');
    const [isConnecting, setIsConnecting] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [crosshair, setCrosshair] = useState<{ x: number, y: number, freq: number, pct: number } | null>(null);
    const [dragStart, setDragStart] = useState({ x: 0, freq: 0 });
    const [peakFreq, setPeakFreq] = useState<number | null>(null);
    const [lastDetectedPeakFreq, setLastDetectedPeakFreq] = useState<number | null>(null);

    // Calculate peak frequency
    useEffect(() => {
        if (!scanData || scanData.length === 0) {
            setPeakFreq(null);
            return;
        }
        const peak = scanData.reduce((prev, current) => (prev.amp > current.amp) ? prev : current);
        if (peak.amp > -70) { // Only display detected peaks above -70 dBm
            setPeakFreq(peak.freq);
            setLastDetectedPeakFreq(peak.freq);
        } else {
            setPeakFreq(null);
        }
    }, [scanData]);

    const loadAnalyzerFreqs = useCallback(() => {
        if (analyzerFrequencies.filter(f=>f.value > 0).length === 0) {
            toast.error('No frequencies loaded in the Analyzer tab.');
            return;
        }
        setFreqs(analyzerFrequencies);
        const values = analyzerFrequencies.filter(f=>f.value > 0).map(f => f.value);
        const min = Math.floor(Math.min(...values) - 10);
        const max = Math.ceil(Math.max(...values) + 10);
        setRange({ min, max });
    }, [analyzerFrequencies]);
    
    const loadGeneratorFreqs = useCallback(() => {
        if (!generatorFrequencies || generatorFrequencies.length === 0) {
            toast.error('No frequencies available from the Generator tab. Please generate a list first.');
            return;
        }
        setFreqs(generatorFrequencies);
        const values = generatorFrequencies.map(f => f.value);
        const min = Math.floor(Math.min(...values) - 10);
        const max = Math.ceil(Math.max(...values) + 10);
        setRange({ min, max });
    }, [generatorFrequencies]);

    const handleConnect = async () => {
        if (!onConnectSerial) return;
        setIsConnecting(true);
        try {
            await onConnectSerial(deviceType);
            setIsRunning(true); // Auto-start waterfall on connect
        } finally {
            setIsConnecting(false);
        }
    };

    const handleDisconnect = async () => {
        if (onDisconnectSerial) {
            await onDisconnectSerial();
        }
    };

    const handleToggleScan = () => {
        if (setSerialIsScanning) {
            setSerialIsScanning(!serialIsScanning);
            if (!serialIsScanning) setIsRunning(true);
        }
    };

    // Auto-sync range to scan data if scanning
    useEffect(() => {
        if (autoSyncRange && serialIsScanning && scanData && scanData.length > 0) {
            const min = scanData[0].freq;
            const max = scanData[scanData.length - 1].freq;
            setRange(prev => {
                if (Math.abs(prev.min - min) > 0.1 || Math.abs(prev.max - max) > 0.1) {
                    return { min, max };
                }
                return prev;
            });
        }
    }, [autoSyncRange, serialIsScanning, scanData]);

    const clearWaterfall = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }, []);

    const binnedScanData = useMemo(() => {
        const width = dimensions.width;
        if (!scanData || width === 0) return null;
    
        const noiseFloor = -105;
        const bins: (number | null)[] = new Array(width).fill(null);
        
        const normalized = scanData.map(p => ({
            freq: p.freq > 10000 ? p.freq / 1e6 : p.freq,
            amp: p.amp
        })).sort((a, b) => a.freq - b.freq);

        const freqRange = range.max - range.min;
        const freqToX = (f: number) => ((f - range.min) / freqRange) * width;

        for (let i = 0; i < normalized.length - 1; i++) {
            const p1 = normalized[i];
            const p2 = normalized[i + 1];
            
            const x1 = Math.floor(freqToX(p1.freq));
            const x2 = Math.floor(freqToX(p2.freq));
            
            if (x2 < 0 || x1 >= width) continue;

            const startX = Math.max(0, x1);
            const endX = Math.min(width - 1, x2);
            
            for (let x = startX; x <= endX; x++) {
                const t = x2 === x1 ? 0 : (x - x1) / (x2 - x1);
                const amp = p1.amp + (p2.amp - p1.amp) * t;
                bins[x] = bins[x] === null ? amp : Math.max(bins[x]!, amp);
            }
        }
        
        // Handle edges and single points
        normalized.forEach(p => {
            const x = Math.floor(freqToX(p.freq));
            if (x >= 0 && x < width) {
                bins[x] = bins[x] === null ? p.amp : Math.max(bins[x]!, p.amp);
            }
        });

        // Fill remaining nulls with noise floor
        for (let i = 0; i < width; i++) {
            if (bins[i] === null) bins[i] = noiseFloor;
        }

        return bins;
    }, [scanData, range, dimensions.width]);

    const binnedScanDataRef = useRef(binnedScanData);
    useEffect(() => {
        binnedScanDataRef.current = binnedScanData;
    }, [binnedScanData]);

    const liveTrace = useMemo(() => {
        const width = dimensions.width;
        if (width === 0) return null;
        
        const noiseFloor = -105;
        const trace = new Array(width).fill(noiseFloor);
        
        // 1. Scan Data
        if (binnedScanData) {
            for (let i = 0; i < width; i++) {
                if (binnedScanData[i] !== null) trace[i] = binnedScanData[i]!;
            }
        }

        // 2. Calculated Signals (Gaussian)
        const freqRange = range.max - range.min;
        if (freqRange > 0) {
            const visualBw = 0.200;
            const validFreqs = freqs.filter(f => f.value > 0);
            
            validFreqs.forEach(f => {
                const peakAmp = f.type === 'iem' ? -20 : -10;
                const pxWidth = (visualBw / freqRange) * width;
                const centerPx = ((f.value - range.min) / freqRange) * width;
                
                const startX = Math.floor(centerPx - pxWidth * 2.5);
                const endX = Math.ceil(centerPx + pxWidth * 2.5);
                
                for (let i = Math.max(0, startX); i <= Math.min(width - 1, endX); i++) {
                    const distPx = Math.abs(i - centerPx);
                    const normDist = pxWidth > 0.5 ? distPx / pxWidth : 0;
                    const shapeFactor = Math.exp(-Math.pow(normDist * 2.5, 2));
                    
                    const carrierContribution = noiseFloor + (peakAmp - noiseFloor) * shapeFactor;
                    trace[i] = Math.max(trace[i], carrierContribution);
                }
            });
        }

        return trace;
    }, [binnedScanData, freqs, range, dimensions.width]);
    

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        let intervalId: number;

        const getWaterfallColor = (intensity: number, isIEM: boolean) => {
            intensity = Math.max(0, Math.min(1, intensity));
            if (isIEM && intensity > 0.5) {
                return `hsl( ${60 - intensity * 60}, 100%, ${50 + intensity * 25}%)`;
            }
            if (colorScheme === 'thermal') return `hsl( ${240 - intensity * 240}, 100%, ${15 + intensity * 60}%)`;
            if (colorScheme === 'rainbow') {
                if (intensity > 0.9) return 'hsl(0, 100%, 50%)'; // Red center
                if (intensity > 0.7) return 'hsl(30, 100%, 50%)'; // Orange/Yellow edges
                return `hsl(${(1-intensity)*240}, 100%, 50%)`;
            }
            if (colorScheme === 'grayscale') return `rgb(${Math.floor(intensity*255)},${Math.floor(intensity*255)},${Math.floor(intensity*255)})`;
            return `rgb(${Math.floor(intensity*100)}, ${Math.floor(intensity*150)}, ${Math.floor(100 + intensity*155)})`;
        };

        const render = () => {
            const { width, height } = canvas;
            if (width === 0 || height === 0) return;
            
            // Draw previous frame shifted down
            ctx.drawImage(canvas, 0, 0, width, height - 1, 0, 1, width, height - 1);
            
            const SIGNAL_BANDWIDTH = 0.200;
            const validFreqs = freqs.filter(f => f.value > 0);
            const currentBinnedData = binnedScanDataRef.current;

            for (let x = 0; x < width; x++) {
                let intensity: number = 0.05; // Base noise level
                let isIEM = false;

                if (currentBinnedData && x < currentBinnedData.length) {
                    const amp = currentBinnedData[x];
                    // Improved intensity scaling: -105dBm is black, -20dBm is full brightness
                    // This matches the user's -20dBm transmitter peak
                    intensity = amp !== null ? Math.max(0, Math.min(1, (amp + 105) / 85)) : 0.05;
                } else {
                    const freqAtPixel = range.min + (x / width) * (range.max - range.min);
                    let simIntensity = 0.05 + Math.random() * 0.05;
                    validFreqs.forEach(f => {
                        let bw = SIGNAL_BANDWIDTH;
                        if (f.type === 'wmas' || (f.equipmentKey && f.equipmentKey.includes('wmas'))) {
                            bw = getWmasBandwidth(f);
                        }
                        if (Math.abs(f.value - freqAtPixel) <= bw / 2) {
                            simIntensity = Math.max(simIntensity, 0.95);
                            if (f.type === 'iem') isIEM = true;
                        }
                    });
                    intensity = simIntensity;
                }

                ctx.fillStyle = getWaterfallColor(intensity, isIEM);
                ctx.fillRect(x, 0, 1, 1);
            }
        };

        if (isRunning) {
            intervalId = window.setInterval(render, updateRate);
        }
        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [isRunning, freqs, range.min, range.max, updateRate, colorScheme]); // Use primitive values for range to avoid unnecessary restarts
    
    useEffect(() => {
        const canvas = miniAnalyzerRef.current;
        if (!canvas || dimensions.width === 0) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const { width, height } = canvas;
        ctx.clearRect(0, 0, width, height);

        // Professional styling: Full width for horizontal alignment with waterfall, 
        // but with vertical padding for labels.
        const padding = { top: 20, bottom: 20, left: 0, right: 0 };
        const chartWidth = width;
        const chartHeight = height - padding.top - padding.bottom;
        
        const ampToY = (amp: number) => {
            const minAmp = -110;
            const maxAmp = 0;
            const normalized = (amp - minAmp) / (maxAmp - minAmp);
            return padding.top + chartHeight - (normalized * chartHeight);
        };

        const freqToX = (f: number) => {
            return ((f - range.min) / (range.max - range.min)) * chartWidth;
        };

        // 1. Draw Background & Graticule
        ctx.fillStyle = '#0f172a'; // Deep slate background
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)'; // Subtle cyan grid
        ctx.lineWidth = 1;
        
        // Vertical lines (Frequency)
        const numVTicks = 10;
        for (let i = 0; i <= numVTicks; i++) {
            const x = (i / numVTicks) * chartWidth;
            ctx.beginPath();
            ctx.moveTo(x, padding.top);
            ctx.lineTo(x, padding.top + chartHeight);
            ctx.stroke();
            
            // Subtle frequency labels at bottom
            if (i > 0 && i < numVTicks && i % 2 === 0) {
                const freq = range.min + (i / numVTicks) * (range.max - range.min);
                ctx.fillStyle = '#64748b';
                ctx.font = '8px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(freq.toFixed(1) + ' MHz', x, padding.top + chartHeight + 12);
            }
        }

        // Horizontal lines (Amplitude)
        const numHTicks = 5;
        for (let i = 0; i <= numHTicks; i++) {
            const y = padding.top + (i / numHTicks) * chartHeight;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(chartWidth, y);
            ctx.stroke();
            
            // Amplitude labels (Inside left edge)
            const amp = 0 - (i / numHTicks) * 110;
            ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
            ctx.fillRect(2, y - 6, 20, 12);
            ctx.fillStyle = '#94a3b8';
            ctx.font = '8px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(amp.toFixed(0), 4, y + 3);
        }

        if (!liveTrace) return;

        // 2. Draw Trace with Glow
        ctx.save();
        ctx.shadowBlur = 6;
        ctx.shadowColor = 'rgba(56, 189, 248, 0.6)';
        ctx.beginPath();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#38bdf8';
        
        let started = false;
        for (let i = 0; i < liveTrace.length; i++) {
            const x = i; // liveTrace is already binned to dimensions.width
            const y = ampToY(liveTrace[i]);
            
            if (!started) {
                ctx.moveTo(x, y);
                started = true;
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
        ctx.restore();

        // 3. Area Fill
        if (started) {
            ctx.beginPath();
            ctx.moveTo(0, ampToY(liveTrace[0]));
            for (let i = 1; i < liveTrace.length; i++) {
                ctx.lineTo(i, ampToY(liveTrace[i]));
            }
            ctx.lineTo(width, padding.top + chartHeight);
            ctx.lineTo(0, padding.top + chartHeight);
            ctx.closePath();
            
            const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
            gradient.addColorStop(0, 'rgba(56, 189, 248, 0.15)');
            gradient.addColorStop(1, 'rgba(56, 189, 248, 0.02)');
            ctx.fillStyle = gradient;
            ctx.fill();
        }

        // 4. Signal Markers
        freqs.forEach(f => {
            if (f.value >= range.min && f.value <= range.max) {
                const x = freqToX(f.value);
                ctx.strokeStyle = f.type === 'iem' ? 'rgba(244, 114, 182, 0.6)' : 'rgba(56, 189, 248, 0.6)';
                ctx.lineWidth = 1;
                ctx.setLineDash([3, 3]);
                ctx.beginPath();
                ctx.moveTo(x, padding.top);
                ctx.lineTo(x, padding.top + chartHeight);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        });

    }, [liveTrace, freqs, range, dimensions]);
    
     useEffect(() => {
        const overlay = overlayRef.current;
        if (!overlay) return;
        const ctx = overlay.getContext('2d');
        if (!ctx) return;
        const { width, height } = overlay;
        ctx.clearRect(0, 0, width, height);

        const freqToX = (freq: number) => ((freq - range.min) / (range.max - range.min)) * width;

        if (!overlayChannels) return;

        const tvChannels = region === 'uk' ? UK_TV_CHANNELS : US_TV_CHANNELS;
        
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        Object.entries(tvChannels).forEach(([ch, [start, end]]) => {
            if (end >= range.min && start <= range.max) {
                const xStart = freqToX(start);
                const xEnd = freqToX(end);
                
                ctx.fillStyle = 'rgba(51, 65, 85, 0.5)'; 
                if (xEnd > xStart + 2) {
                    ctx.fillRect(xStart + 1, 4, xEnd - xStart - 2, height - 8);
                }

                ctx.fillStyle = '#e2e8f0'; 
                ctx.fillText(`CH ${ch}`, (xStart + xEnd) / 2, height / 2);
                
                ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
                ctx.beginPath();
                ctx.moveTo(xStart, height * 0.2);
                ctx.lineTo(xStart, height * 0.8);
                ctx.moveTo(xEnd, height * 0.2);
                ctx.lineTo(xEnd, height * 0.8);
                ctx.stroke();
            }
        });

        if (wmasState && wmasState.nodes) {
            wmasState.nodes.forEach(node => {
                if (node.assignedBlock && node.assignedBlock.end >= range.min && node.assignedBlock.start <= range.max) {
                    const xStart = freqToX(node.assignedBlock.start);
                    const xEnd = freqToX(node.assignedBlock.end);
                    const bw = +(node.assignedBlock.end - node.assignedBlock.start).toFixed(3);
                    const bwLabel = bw < 1 ? `${Math.round(bw * 1000)}k` : `${bw}M`;
                    
                    ctx.fillStyle = 'rgba(168, 85, 247, 0.3)';
                    if (xEnd > xStart + 2) {
                        ctx.fillRect(xStart + 1, 4, xEnd - xStart - 2, height - 8);
                    }
                    
                    ctx.fillStyle = '#f5f3ff';
                    ctx.font = 'bold 9px sans-serif';
                    ctx.fillText(`WMAS ${bwLabel}`, (xStart + xEnd) / 2, height / 2);
                }
            });
        }
    }, [overlayChannels, region, range, wmasState, dimensions]);
    
    useEffect(() => {
        const canvases = [canvasRef.current, overlayRef.current, miniAnalyzerRef.current];
        let observer: ResizeObserver;
        if(canvases[0] && canvases[1] && canvases[2]) {
            observer = new ResizeObserver(() => {
                requestAnimationFrame(() => {
                    canvases.forEach(canvas => {
                        if (canvas) {
                            canvas.width = canvas.offsetWidth;
                            canvas.height = canvas.offsetHeight;
                        }
                    });
                    if (canvases[0]) {
                        setDimensions({ width: canvases[0].offsetWidth, height: canvases[0].offsetHeight });
                    }
                    clearWaterfall();
                });
            });
            observer.observe(canvases[0]);
            return () => observer.disconnect();
        }
    },[clearWaterfall]);


    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = e.clientX - rect.left;
        const freqAtX = range.min + (x / dimensions.width) * (range.max - range.min);
        setDragStart({ x: e.clientX, freq: freqAtX });
        setAutoSyncRange(false);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const mouseFreq = range.min + (x / dimensions.width) * (range.max - range.min);
        const yPct = (y / rect.height) * 100;
        
        if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
            setCrosshair({ x, y, freq: mouseFreq, pct: yPct });
        } else {
            setCrosshair(null);
        }

        if (!isDragging) return;
        
        const deltaX = e.clientX - dragStart.x;
        const freqDelta = (deltaX / dimensions.width) * (range.max - range.min);
        
        setRange(prev => ({
            min: prev.min - freqDelta,
            max: prev.max - freqDelta
        }));
        setDragStart({ x: e.clientX, freq: dragStart.freq });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        setCrosshair(null);
    };

    return (
        <Card fullWidth>
            <CardTitle>🌊 Waterfall Display</CardTitle>
            <p className="text-slate-300 mb-4 text-sm">
                Visualizes RF energy over time. Import scan data from the Spectrum tab for real-world analysis.
            </p>
             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 p-2 bg-slate-900/50 rounded-sm mb-4">
                <button onClick={() => setIsRunning(true)} disabled={isRunning} className={primaryButton}>▶️ START WATERFALL</button>
                <button onClick={() => setIsRunning(false)} disabled={!isRunning} className={dangerButton}>⏹️ STOP WATERFALL</button>
                <button onClick={clearWaterfall} className={secondaryButton}>🧹 CLEAR</button>
                <button onClick={loadAnalyzerFreqs} className={successButton}>📥 Load from Analyzer</button>
                <button onClick={loadGeneratorFreqs} className={successButton}>📥 Load from Generator</button>
            </div>
            {/* Side-by-side Hardware Link and Live Telemetry / Peak Frequency Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 mb-4">
                {/* Left Box: Hardware Scan Link (Half size horizontally) */}
                <div className="p-2 bg-indigo-900/20 border border-indigo-500/30 rounded-sm flex flex-col justify-between gap-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-7 bg-indigo-500 rounded-full animate-pulse" />
                            <div>
                                <h4 className="text-xs font-black text-indigo-300 uppercase tracking-widest">Hardware Scan Link</h4>
                                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">
                                    {serialDevice ? `Connected to ${serialDevice.deviceType === 'tinysa' ? 'TinySA' : 'RF Explorer'}` : 'No hardware connected'}
                                </p>
                            </div>
                        </div>
                        {serialDevice && (
                            <div className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 rounded border border-emerald-500/30 text-[9px] font-black uppercase tracking-widest">
                                Online
                            </div>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                        {!serialDevice ? (
                            <>
                                <select 
                                    value={deviceType}
                                    onChange={(e) => setDeviceType(e.target.value as 'tinysa' | 'rfexplorer')}
                                    className="bg-slate-900/80 text-[10px] text-white border border-indigo-500/30 rounded px-2 py-1.5 font-bold uppercase outline-none"
                                >
                                    <option value="tinysa">TinySA</option>
                                    <option value="rfexplorer">RF Explorer</option>
                                </select>
                                <button 
                                    onClick={handleConnect}
                                    disabled={isConnecting}
                                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                                >
                                    {isConnecting ? 'Connecting...' : 'Connect'}
                                </button>
                                <button 
                                    onClick={() => onAutoDetectSerial && onAutoDetectSerial(deviceType)}
                                    className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded text-[10px] font-black uppercase tracking-widest transition-all border border-indigo-500/30"
                                >
                                    Auto-Detect
                                </button>
                            </>
                        ) : (
                            <>
                                <button 
                                    onClick={handleToggleScan}
                                    className={`px-3 py-1.5 rounded text-[10px] font-black uppercase tracking-widest transition-all ${serialIsScanning ? 'bg-rose-500 text-white animate-pulse' : 'bg-emerald-500 text-white'}`}
                                >
                                    {serialIsScanning ? 'Stop Live Scan' : 'Start Live Scan'}
                                </button>
                                <button 
                                    onClick={handleDisconnect}
                                    className="px-3 py-1.5 bg-slate-800 text-slate-400 rounded text-[10px] font-black uppercase tracking-widest hover:bg-slate-700"
                                >
                                    Disconnect
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Right Box: Live Telemetry & Peak Frequency (Adjacent box) */}
                <div className="p-2 bg-slate-900/60 border border-slate-700/50 rounded-sm flex flex-col justify-between gap-3">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Live Telemetry & Status</span>
                        <div className="text-[9px] font-mono text-cyan-400 bg-black/50 px-2 py-0.5 rounded uppercase tracking-tighter truncate max-w-[200px]">
                            {serialStatus || 'Idle / Ready'}
                        </div>
                    </div>
                    <div className="flex items-center justify-between bg-black/40 px-3 py-2 rounded border border-slate-800">
                        <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Detected Peak:</span>
                        <span className="text-sm font-mono font-bold text-rose-400">
                            {peakFreq ? `${peakFreq.toFixed(5)} MHz` : '---.----- MHz (No Peak)'}
                        </span>
                    </div>
                    <div className="flex items-center justify-between bg-black/40 px-3 py-2 rounded border border-slate-800">
                        <div className="flex flex-col">

                            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Last Detected Peak:</span>
                            <span className="text-sm font-mono font-bold text-amber-400">
                                {lastDetectedPeakFreq ? `${lastDetectedPeakFreq.toFixed(5)} MHz` : '---.----- MHz'}
                            </span>
                        </div>
                        <button
                            onClick={() => setLastDetectedPeakFreq(null)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-black uppercase tracking-wider rounded border border-slate-700 transition-all"
                        >
                            Clear
                        </button>
                    </div>
                </div>
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 p-2 bg-slate-900/50 rounded-sm mb-4">
                 <div>
                    <label className="text-slate-300 text-sm mb-1 block">Frequency Range (MHz)</label>
                    <div className="flex gap-2">
                        <input type="number" value={range.min} onChange={e => { 
                            const val = Number(e.target.value);
                            setRange(r => ({...r, min: val})); 
                            setAutoSyncRange(false); 
                            if(setScanStartFreq) setScanStartFreq(val);
                        }} className="w-full bg-slate-900/60 border border-blue-500/30 rounded-md p-2 text-slate-200" placeholder="Min" />
                        <input type="number" value={range.max} onChange={e => { 
                            const val = Number(e.target.value);
                            setRange(r => ({...r, max: val})); 
                            setAutoSyncRange(false); 
                            if(setScanStopFreq) setScanStopFreq(val);
                        }} className="w-full bg-slate-900/60 border border-blue-500/30 rounded-md p-2 text-slate-200" placeholder="Max" />
                    </div>
                </div>
                 <div>
                    <label className="text-slate-300 text-sm mb-1 block">Update Rate: {updateRate}ms</label>
                    <input type="range" min="50" max="500" value={updateRate} onChange={e => setUpdateRate(Number(e.target.value))} className="w-full" />
                </div>
                <div>
                    <label className="text-slate-300 text-sm mb-1 block">Color Scheme</label>
                    <select value={colorScheme} onChange={e => setColorScheme(e.target.value)} className="w-full bg-slate-900/60 border border-blue-500/30 rounded-md p-2 text-slate-200">
                        <option value="thermal">Thermal</option>
                        <option value="rainbow">Rainbow</option>
                        <option value="grayscale">Grayscale</option>
                        <option value="ocean">Ocean</option>
                    </select>
                </div>
                 <div>
                    <label className="text-slate-300 text-sm mb-1 block">Overlay Region</label>
                    <select value={region} onChange={e => setRegion(e.target.value)} className="w-full bg-slate-900/60 border border-blue-500/30 rounded-md p-2 text-slate-200">
                        <option value="uk">United Kingdom</option>
                        <option value="us">United States</option>
                    </select>
                </div>
            </div>
             <label className="flex items-center gap-3 cursor-pointer p-2 pb-2">
                <input type="checkbox" checked={overlayChannels} onChange={e => setOverlayChannels(e.target.checked)} className="w-3.5 h-3.5 accent-blue-400" />
                <span className="text-slate-300 font-semibold">Overlay TV Channels</span>
            </label>
            <div className="flex flex-col relative" onMouseMove={handleMouseMove} onMouseLeave={() => setCrosshair(null)}>
                {crosshair && (
                    <>
                        <div className="absolute bg-blue-500/50 pointer-events-none" style={{ left: 0, right: 0, top: `${crosshair.y}px`, height: '1px', zIndex: 50 }} />
                        <div className="absolute bg-blue-500/50 pointer-events-none" style={{ top: 0, bottom: 0, left: `${crosshair.x}px`, width: '1px', zIndex: 50 }} />
                        <div className="absolute z-50 bg-slate-800 text-slate-200 font-mono text-[10px] p-1 rounded border border-slate-700 pointer-events-none whitespace-nowrap shadow-lg"
                             style={{ left: `${crosshair.x + 8}px`, top: `${crosshair.y + 8}px` }}>
                            {crosshair.freq.toFixed(3)} MHz
                        </div>
                    </>
                )}
                <div className="relative mb-1">
                    <div className="absolute top-1 left-2 text-[8px] font-black text-slate-500 uppercase tracking-widest z-10 bg-slate-900/80 px-1 rounded">Live Spectrum Trace</div>
                    <canvas ref={miniAnalyzerRef} id="mini-analyzer" className="w-full h-[120px] bg-slate-900 rounded-t-lg border border-blue-500/30 border-b-0"></canvas>
                </div>
                <canvas ref={overlayRef} id="waterfall-overlay" className="w-full h-[30px] bg-slate-800 border border-blue-500/30 border-b-0"></canvas>
                <canvas 
                    ref={canvasRef} 
                    id="waterfall-canvas" 
                    className="w-full h-[250px] md:h-[400px] bg-black rounded-b-lg border border-blue-500/30 cursor-grab active:cursor-grabbing"
                    onMouseDown={handleMouseDown}
                    
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                ></canvas>
            </div>
        </Card>
    );
};

export default React.memo(WaterfallTab);