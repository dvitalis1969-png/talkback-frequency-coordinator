import React, { useState, useRef, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { ScanDataPoint, TVChannelState } from '../types';
import { UK_TV_CHANNELS, US_TV_CHANNELS } from '../constants';
import Card, { CardTitle } from './Card';
import { HardwareSetupGuide } from './HardwareSetupGuide';
import { db, auth } from '../src/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { InfoTooltip } from './InfoTooltip';
import SmartNumberInput from './SmartNumberInput';

interface LiveScanAnalyzerProps {
    scanData: ScanDataPoint[] | null;
    tvRegion: 'uk' | 'us';
    tvChannelStates: Record<number, TVChannelState>;
    onBlockChannel: (channel: number, state: TVChannelState) => void;
    onBulkUpdateChannels: (updates: Record<number, TVChannelState>) => void;
    onSimulate: () => void;
    threshold: number;
    onThresholdChange: (value: number) => void;
    vbw: string;
    rbw: string;
    span: string;
    refLevel: number;
    centerFreq: number;
    startFreq: number;
    onStartFreqChange: (freq: number) => void;
    stopFreq: number;
    onStopFreqChange: (freq: number) => void;
    onScanDataUpdate?: (data: ScanDataPoint[]) => void;
    className?: string;
    serialDevice?: SerialDevice | null;
    serialStatus?: string;
    serialIsScanning?: boolean;
    setSerialIsScanning?: (is: boolean) => void;
    onConnectSerial?: (type: 'tinysa' | 'rfexplorer') => Promise<void>;
    onDisconnectSerial?: () => Promise<void>;
    onAutoDetectSerial?: (type: 'tinysa' | 'rfexplorer') => Promise<void>;
}

import { SerialDevice, getDeviceVersion } from '../services/serialService';

const LiveScanAnalyzer: React.FC<LiveScanAnalyzerProps> = ({
    scanData,
    tvRegion,
    tvChannelStates,
    onBlockChannel,
    onBulkUpdateChannels,
    onSimulate,
    threshold,
    onThresholdChange,
    vbw,
    rbw,
    span,
    refLevel,
    centerFreq,
    startFreq,
    onStartFreqChange,
    stopFreq,
    onStopFreqChange,
    onScanDataUpdate,
    className = "",
    serialDevice: device,
    serialStatus: scanStatus,
    serialIsScanning,
    setSerialIsScanning,
    onConnectSerial,
    onDisconnectSerial,
    onAutoDetectSerial
}) => {

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [showMaxHold, setShowMaxHold] = useState(false);
    const [maxHoldData, setMaxHoldData] = useState<ScanDataPoint[]>([]);
    const [isDraggingThreshold, setIsDraggingThreshold] = useState(false);
    const [isPanning, setIsPanning] = useState(false);
    const [panStartX, setPanStartX] = useState<number | null>(null);
    const [panStartMinFreq, setPanStartMinFreq] = useState<number | null>(null);
    const [panStartMaxFreq, setPanStartMaxFreq] = useState<number | null>(null);
    const [hoverFreq, setHoverFreq] = useState<number | null>(null);
    const [hoverAmp, setHoverAmp] = useState<number | null>(null);

    const channels = tvRegion === 'uk' ? UK_TV_CHANNELS : US_TV_CHANNELS;
    const tvMinFreq = useMemo(() => Math.min(...Object.values(channels).map(c => c[0])), [channels]);
    const tvMaxFreq = useMemo(() => Math.max(...Object.values(channels).map(c => c[1])), [channels]);
    
    const displayMinFreq = startFreq;
    const displayMaxFreq = stopFreq;

    // Local Hardware Connection State (still needed for UI control but synced/called via global handlers)
    const [isConnecting, setIsConnecting] = useState(false);
    const prevRangeRef = useRef<string>("");
    const [refreshRate, setRefreshRate] = useState(100); // ms
    const [debugLogs, setDebugLogs] = useState<string[]>([]);
    const [hardwareVersion, setHardwareVersion] = useState<string | null>(null);
    const [baudRate, setBaudRate] = useState<number>(115200);
    const [rawLog, setRawLog] = useState<string[]>([]);
    const [manualCommand, setManualCommand] = useState<string>('');
    const [isPaused, setIsPaused] = useState<boolean>(false);
    const [isSharing, setIsSharing] = useState<boolean>(false);
    const [showTerminal, setShowTerminal] = useState<boolean>(false);
    const [showSetup, setShowSetup] = useState<boolean>(false);
    const [deviceType, setDeviceType] = useState<'tinysa' | 'rfexplorer'>('tinysa');
    const [suppressSpurs, setSuppressSpurs] = useState<boolean>(true);
    const [showShareModal, setShowShareModal] = useState<boolean>(false);
    const [showTroubleshoot, setShowTroubleshoot] = useState<boolean>(false);
    const [shareMeta, setShareMeta] = useState({ location: '', festival: '', stage: '', notes: '' });

    // Identify device type when connection changes
    useEffect(() => {
        if (device) {
            setHardwareVersion(device.deviceType === 'tinysa' ? 'TinySA' : 'RF Explorer');
            setDeviceType(device.deviceType);
        } else {
            setHardwareVersion(null);
        }
    }, [device]);

    const handleShareScanClick = () => {
        if (!auth.currentUser) return;
        setShowShareModal(true);
    };

    const confirmShareScan = async () => {
        if (!canvasRef.current || !auth.currentUser) return;
        
        // Capture all data needed for the save immediately before closing modal
        const imageData = canvasRef.current.toDataURL('image/jpeg', 0.8);
        const meta = { ...shareMeta };
        const min = displayMinFreq;
        const max = displayMaxFreq;
        const currentScanData = scanData ? [...scanData] : null;

        // Close modal immediately as requested by user
        setShowShareModal(false);
        setShareMeta({ location: '', festival: '', stage: '', notes: '' });
        
        setIsSharing(true);
        const toastId = toast.loading('Sharing scan to gallery...');

        try {
            // Downsample scan data for storage to avoid exceeding Firestore limits
            let rawScanData = null;
            if (currentScanData && currentScanData.length > 0) {
                // Keep max 500 points to stay well under 1MB limit
                const step = Math.max(1, Math.floor(currentScanData.length / 500));
                const downsampled = currentScanData.filter((_, i) => i % step === 0);
                rawScanData = JSON.stringify(downsampled);
            }

            await addDoc(collection(db, 'plots'), {
                userId: auth.currentUser.uid,
                userName: auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || 'Anonymous',
                timestamp: Date.now(),
                projectId: 'global',
                imageData,
                description: `Live Scan Capture (${min.toFixed(1)} - ${max.toFixed(1)} MHz)`,
                location: meta.location,
                festival: meta.festival,
                stage: meta.stage,
                notes: meta.notes,
                comments: [],
                ...(rawScanData ? { rawScanData } : {})
            });
            
            toast.success('Scan shared to Plot Gallery successfully!', { id: toastId });
            addLog('Scan shared to Plot Gallery successfully!');
        } catch (error: any) {
            console.error('Error sharing scan:', error);
            toast.error(`Failed to share scan: ${error.message}`, { id: toastId });
            addLog(`Failed to share scan: ${error.message}`);
        } finally {
            setIsSharing(false);
        }
    };

    const addLog = (msg: string) => {
        setDebugLogs(prev => [msg, ...prev].slice(0, 5));
    };

    const addRawLog = (data: string) => {
        setRawLog(prev => [data, ...prev].slice(0, 10));
    };

    const handleConnect = async () => {
        if (!onConnectSerial) return;
        setIsConnecting(true);
        try {
            await onConnectSerial(deviceType);
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
        }
    };

    // Clear max hold data when range changes
    useEffect(() => {
        const currentRange = `${startFreq}-${stopFreq}`;
        if (prevRangeRef.current !== currentRange) {
            prevRangeRef.current = currentRange;
            setMaxHoldData([]);
        }
    }, [startFreq, stopFreq]);

    const maxAmp = refLevel;
    const minAmp = refLevel - 90;

    // Update Max Hold Data
    useEffect(() => {
        if (!scanData || scanData.length === 0) return;
        
        setMaxHoldData(prev => {
            if (prev.length === 0 || prev.length !== scanData.length) return [...scanData];
            
            // If the frequencies changed significantly, the range was updated. Reset max hold data.
            if (Math.abs(prev[0].freq - scanData[0].freq) > 1.0 || Math.abs(prev[prev.length - 1].freq - scanData[scanData.length - 1].freq) > 1.0) {
                return [...scanData];
            }

            return prev.map((p, i) => ({
                freq: p.freq,
                amp: Math.max(p.amp, scanData[i].amp)
            }));
        });
    }, [scanData]);

    const handleResetMaxHold = () => setMaxHoldData([]);

    const getX = (freq: number, width: number) => {
        return ((freq - displayMinFreq) / (displayMaxFreq - displayMinFreq)) * width;
    };

    const getY = (amp: number, height: number) => {
        return height - ((amp - minAmp) / (maxAmp - minAmp)) * height;
    };

    const getFreqFromX = (x: number, width: number) => {
        return displayMinFreq + (x / width) * (displayMaxFreq - displayMinFreq);
    };

    const getAmpFromY = (y: number, height: number) => {
        return minAmp + ((height - y) / height) * (maxAmp - minAmp);
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const resize = () => {
            const parent = canvas.parentElement || container;
            canvas.width = parent.clientWidth || container.clientWidth || 600;
            canvas.height = Math.max(280, parent.clientHeight || container.clientHeight || 320); 
            draw();
        };

        const draw = () => {
            const { width, height } = canvas;
            ctx.clearRect(0, 0, width, height);

            // Draw Background Grid (Dot Grid)
            ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
            const stepX = width / 10;
            const stepY = height / 10;
            for (let x = 0; x <= width; x += stepX) {
                for (let y = 0; y <= height; y += stepY) {
                    ctx.beginPath();
                    ctx.arc(x, y, 0.5, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            // Draw Major Grid Lines
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
            ctx.lineWidth = 1;
            for (let i = 1; i < 10; i++) {
                // Vertical
                ctx.beginPath();
                ctx.moveTo(i * stepX, 0);
                ctx.lineTo(i * stepX, height);
                ctx.stroke();
                // Horizontal
                ctx.beginPath();
                ctx.moveTo(0, i * stepY);
                ctx.lineTo(width, i * stepY);
                ctx.stroke();
            }
            
            // Amplitude Labels (Y-axis)
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.font = '9px "JetBrains Mono", monospace';
            for (let amp = minAmp; amp <= maxAmp; amp += 10) {
                const y = getY(amp, height);
                ctx.fillText(`${amp}`, 5, y + 3);
            }

            // Draw Max Hold Data (Yellow)
            if (showMaxHold && maxHoldData.length > 0) {
                ctx.beginPath();
                ctx.strokeStyle = 'rgba(251, 191, 36, 0.4)'; // Amber/Yellow
                ctx.lineWidth = 1;
                let started = false;
                maxHoldData.forEach((p) => {
                    const freqMhz = p.freq > 1000000 ? p.freq / 1e6 : p.freq > 10000 ? p.freq / 1e3 : p.freq;
                    if (freqMhz < displayMinFreq - 1.0 || freqMhz > displayMaxFreq + 1.0) return;
                    const x = getX(freqMhz, width);
                    const y = getY(p.amp, height);
                    if (!started) {
                        ctx.moveTo(x, y);
                        started = true;
                    } else {
                        ctx.lineTo(x, y);
                    }
                });
                ctx.stroke();
            }

            // Draw Live Scan Data (Cyan with Glow)
            if (scanData && scanData.length > 0) {
                // Glow effect
                ctx.shadowBlur = 8;
                ctx.shadowColor = 'rgba(34, 211, 238, 0.5)';
                
                ctx.beginPath();
                ctx.strokeStyle = '#22d3ee'; // Cyan
                ctx.lineWidth = 1.5;
                ctx.lineJoin = 'round';

                let started = false;
                let firstX = 0;
                let lastX = width;

                scanData.forEach((p) => {
                    const freqMhz = p.freq > 1000000 ? p.freq / 1e6 : p.freq > 10000 ? p.freq / 1e3 : p.freq;
                    if (freqMhz < displayMinFreq - 1.0 || freqMhz > displayMaxFreq + 1.0) return;
                    const x = getX(freqMhz, width);
                    const y = getY(p.amp, height);
                    if (!started) {
                        ctx.moveTo(x, y);
                        firstX = x;
                        started = true;
                    } else {
                        ctx.lineTo(x, y);
                        lastX = x;
                    }
                });
                ctx.stroke();
                
                // Reset shadow
                ctx.shadowBlur = 0;

                // Fill under the curve
                if (started) {
                    ctx.lineTo(lastX, height);
                    ctx.lineTo(firstX, height);
                    const gradient = ctx.createLinearGradient(0, 0, 0, height);
                    gradient.addColorStop(0, 'rgba(34, 211, 238, 0.15)');
                    gradient.addColorStop(1, 'rgba(34, 211, 238, 0)');
                    ctx.fillStyle = gradient;
                    ctx.fill();
                }
            }

            // Draw Threshold Line
            const thresholdY = getY(threshold, height);
            ctx.strokeStyle = 'rgba(245, 158, 11, 0.8)'; // Amber
            ctx.setLineDash([4, 4]);
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(0, thresholdY);
            ctx.lineTo(width, thresholdY);
            ctx.stroke();
            ctx.setLineDash([]);

            // Threshold Label
            ctx.fillStyle = '#f59e0b';
            ctx.font = 'bold 9px "JetBrains Mono", monospace';
            ctx.fillText(`LIMIT: ${threshold}dBm`, width - 100, thresholdY - 5);
            
            // Draggable handle
            ctx.beginPath();
            ctx.arc(width - 5, thresholdY, 4, 0, Math.PI * 2);
            ctx.fill();

            // Digital Readouts (Analyzer Style)
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.font = '10px "JetBrains Mono", monospace';
            ctx.fillText(`REF: ${maxAmp}dBm`, 10, 20);
            ctx.fillText(`VBW: ${vbw}`, 10, 35);
            ctx.fillText(`RBW: ${rbw}`, 10, 50);
            ctx.fillText(`SPAN: ${span}`, 10, 65);
            
            ctx.textAlign = 'left';
            ctx.fillText(`START: ${displayMinFreq.toFixed(1)}MHz`, 10, height - 10);
            ctx.textAlign = 'right';
            ctx.fillText(`STOP: ${displayMaxFreq.toFixed(1)}MHz`, width - 10, height - 10);
            ctx.textAlign = 'center';
            ctx.fillText(`CENTER: ${((displayMinFreq + displayMaxFreq) / 2).toFixed(1)}MHz`, width / 2, height - 10);
        };

        const observer = new ResizeObserver(() => {
            resize();
        });
        observer.observe(container);
        resize();

        return () => {
            observer.disconnect();
        };
    }, [scanData, maxHoldData, tvRegion, tvChannelStates, threshold, showMaxHold, displayMinFreq, displayMaxFreq, vbw, rbw, span]);

    const handleMouseDown = (e: React.MouseEvent) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const thresholdY = getY(threshold, rect.height);
        
        if (Math.abs(y - thresholdY) < 15) {
            setIsDraggingThreshold(true);
        } else {
            setIsPanning(true);
            setPanStartX(x);
            setPanStartMinFreq(displayMinFreq);
            setPanStartMaxFreq(displayMaxFreq);
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        setHoverFreq(getFreqFromX(x, rect.width));
        setHoverAmp(getAmpFromY(y, rect.height));

        if (isDraggingThreshold) {
            const newAmp = Math.round(getAmpFromY(y, rect.height));
            onThresholdChange(Math.max(minAmp, Math.min(maxAmp, newAmp)));
        } else if (isPanning && panStartX !== null && panStartMinFreq !== null && panStartMaxFreq !== null) {
            const dx = x - panStartX;
            const freqSpan = panStartMaxFreq - panStartMinFreq;
            const df = -(dx / rect.width) * freqSpan;
            
            // Prevent panning beyond absolute TV limits
            let newMin = panStartMinFreq + df;
            let newMax = panStartMaxFreq + df;
            
            if (newMin < tvMinFreq) {
                newMin = tvMinFreq;
                newMax = tvMinFreq + freqSpan;
            }
            if (newMax > tvMaxFreq) {
                newMax = tvMaxFreq;
                newMin = tvMaxFreq - freqSpan;
            }

            onStartFreqChange(newMin);
            onStopFreqChange(newMax);
        }
    };

    const handleMouseUp = () => {
        setIsDraggingThreshold(false);
        setIsPanning(false);
        setPanStartX(null);
        setPanStartMinFreq(null);
        setPanStartMaxFreq(null);
    };

    return (
        <Card className={`relative z-10 flex flex-col ${className}`}>
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-start gap-3">
                    <div className="flex flex-col gap-1">
                        <CardTitle className="!mb-0 text-sm flex items-center">
                            📡 Live Site Scan Integration
                            <InfoTooltip content="Connect a TinySA device via USB to view real-time RF spectrum data. The amber line sets the threshold above which frequencies are considered occupied." />
                        </CardTitle>
                        <p className="text-[9px] text-slate-500 uppercase font-bold tracking-tighter">
                            Real-time spectrum analysis. Drag amber line to set exclusion threshold.
                        </p>
                    </div>
                    <div className="bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded text-[8px] text-amber-400 font-bold uppercase tracking-widest flex items-center gap-1 mt-0.5">
                        <span className="text-[10px]">⚠️</span> Requires Chrome, Edge, or Opera (Safari/Firefox not supported)
                    </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap justify-start sm:justify-end w-full">
                    <div className="flex items-center gap-2 bg-slate-900/50 border border-white/5 rounded-sm px-2 py-1 flex-shrink-0">
                        <div className="flex items-center">
                            <span className="text-[8px] text-slate-500 font-bold mr-1">START</span>
                            <SmartNumberInput 
                                id="scan-start"
                                value={displayMinFreq}
                                onChange={(_, val) => onStartFreqChange(parseFloat(val) || 0)}
                                format={false}
                                className="bg-transparent text-[10px] text-white w-12 outline-none font-mono"
                            />
                        </div>
                        <div className="w-px h-3 bg-white/10" />
                        <div className="flex items-center">
                            <span className="text-[8px] text-slate-500 font-bold mr-1">STOP</span>
                            <SmartNumberInput 
                                id="scan-stop"
                                value={displayMaxFreq}
                                onChange={(_, val) => onStopFreqChange(parseFloat(val) || 0)}
                                format={false}
                                className="bg-transparent text-[10px] text-white w-12 outline-none font-mono"
                            />
                        </div>
                        <div className="w-px h-3 bg-white/10" />
                        <button 
                            onClick={() => { onStartFreqChange(tvMinFreq); onStopFreqChange(tvMaxFreq); }} 
                            className="text-[8px] font-black uppercase px-2 py-0.5 bg-blue-900 text-white rounded hover:bg-blue-800 transition-all shadow-md"
                            title="Reset to full range"
                        >
                            RST
                        </button>
                        <button 
                            onClick={() => {
                                if (device && device.deviceType === 'rfexplorer') {
                                    try {
                                        // Request config
                                        const commandBytes = new Uint8Array([0x23, 0x04, 0x43, 0x30]);
                                        device.writer.write(commandBytes);
                                        addLog("Requested configuration from RF Explorer");
                                        
                                        // Force clear our UI assumption so it can adopt the device's config
                                        device.lastUiStartFreq = undefined;
                                        device.lastUiEndFreq = undefined;
                                        
                                        // Wait a bit for the device to respond with #C2-M: or similar
                                        setTimeout(() => {
                                            if (device.lastConfiguredStartFreq !== undefined && device.lastConfiguredEndFreq !== undefined) {
                                                onStartFreqChange(device.lastConfiguredStartFreq);
                                                onStopFreqChange(device.lastConfiguredEndFreq);
                                                addLog(`Synced to device range: ${device.lastConfiguredStartFreq.toFixed(3)} - ${device.lastConfiguredEndFreq.toFixed(3)} MHz`);
                                            } else {
                                                addLog("No configuration received from device yet.");
                                            }
                                        }, 500);
                                    } catch (e) {
                                        console.error("Failed to sync", e);
                                    }
                                } else if (scanData && scanData.length > 0) {
                                    onStartFreqChange(scanData[0].freq);
                                    onStopFreqChange(scanData[scanData.length - 1].freq);
                                }
                            }} 
                            className="text-[8px] font-black uppercase px-2 py-0.5 bg-green-900 text-white rounded hover:bg-green-800 transition-all shadow-md ml-1"
                            title="Sync range from device"
                        >
                            SYNC
                        </button>
                    </div>

                    <div className="flex bg-slate-800/50 rounded-sm p-0.5 border border-white/5 flex-shrink-0">
                        <button 
                            onClick={() => {
                                if (showMaxHold) {
                                    setShowMaxHold(false);
                                } else {
                                    setMaxHoldData([]);
                                    setShowMaxHold(true);
                                }
                            }}
                            className={`text-[8px] font-black uppercase px-2 py-1 rounded transition-all ${showMaxHold ? 'bg-amber-500 text-slate-950 shadow-sm border border-slate-700/50' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            Max Hold
                        </button>
                    </div>
                    
                    {deviceType === 'rfexplorer' && (
                        <div className="flex bg-slate-800/50 rounded-sm p-0.5 border border-white/5 flex-shrink-0">
                            <button 
                                onClick={() => setSuppressSpurs(!suppressSpurs)}
                                className={`text-[8px] font-black uppercase px-2 py-1 rounded transition-all ${suppressSpurs ? 'bg-cyan-500 text-slate-950 shadow-sm border border-slate-700/50' : 'text-slate-500 hover:text-slate-300'}`}
                                title="Suppress RF Explorer internal hardware-generated spur spikes"
                            >
                                Suppress Spurs
                            </button>
                        </div>
                    )}
                    
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button 
                            onClick={handleResetMaxHold}
                            className="text-[8px] font-black uppercase px-2 py-1 bg-blue-900 text-white rounded hover:bg-blue-800 transition-all shadow-md"
                        >
                            Reset Max
                        </button>
                        <div className="h-4 w-px bg-white/10 mx-1" />
                        <button 
                            onClick={handleShareScanClick}
                            disabled={isSharing || !auth.currentUser}
                            className="text-[8px] font-black uppercase px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-500 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                            title={!auth.currentUser ? "Log in to share scans" : "Share to Plot Gallery"}
                        >
                            {isSharing ? 'Sharing...' : 'Share Scan'}
                        </button>
                        <div className="h-4 w-px bg-white/10 mx-1" />
                        <button 
                            onClick={() => {
                                const nextStates = { ...tvChannelStates };
                                let count = 0;
                                Object.entries(channels).forEach(([chStr]) => {
                                    const ch = parseInt(chStr);
                                    if (nextStates[ch] === 'blocked') {
                                        nextStates[ch] = 'available';
                                        count++;
                                    }
                                });
                                onBulkUpdateChannels(nextStates);
                            }}
                            className="text-[8px] font-black uppercase px-2 py-1 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white rounded transition-all shadow-md border border-emerald-500/30"
                            title="Clear all blocked channels"
                        >
                            Reset Blocks
                        </button>
                    </div>

                    <div className="flex flex-col items-center ml-auto sm:ml-0">
                        <div className="text-[10px] tabular-nums text-cyan-400 bg-black/40 px-2 py-1 rounded border border-white/5 min-w-[160px] text-center">
                            {hoverFreq ? `${hoverFreq.toFixed(3)} MHz` : '---.--- MHz'} | {hoverAmp ? `${hoverAmp.toFixed(1)} dBm` : '--.- dBm'}
                        </div>
                        {scanStatus && (
                            <div className="text-[7px] font-mono text-cyan-500/70 mt-0.5 uppercase tracking-tighter">
                                {scanStatus}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div 
                ref={containerRef} 
                className={`relative bg-black/60 rounded-md border border-white/10 overflow-hidden flex-grow ${isPanning ? 'cursor-grabbing' : 'cursor-crosshair'}`}
                style={{ minHeight: '300px' }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                {!scanData && !device && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm z-20 p-2">
                        <div className="text-center max-w-md bg-slate-900/90 p-4 rounded-md border border-white/10 shadow-2xl">
                            <div className="text-3xl mb-2">🔌</div>
                            <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">No Hardware Connected</p>
                            <p className="text-[10px] text-slate-400 uppercase mt-1">Connect TinySA or RF Explorer via USB to start live scan</p>
                            <div className="mt-3 text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/30 px-3 py-2 rounded-sm font-medium flex items-center gap-2 text-left">
                                <span className="text-amber-400 text-sm">⚙️</span>
                                <div>
                                    <span className="font-bold text-amber-400 uppercase tracking-wider">Crucial TinySA Setting:</span>
                                    <p className="text-[9px] text-amber-200/90 mt-0.5">
                                        Tap <strong>CONFIG ➔ SERIAL ➔ USB</strong> on your TinySA touch screen before connecting.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                
                <div className="flex h-full">
                    <div className="flex-[2] relative border-l border-white/10">
                        <canvas 
                            ref={canvasRef} 
                            className="w-full h-full block"
                        />
                    </div>
                </div>
            </div>

            <div className="mt-4 flex flex-col gap-2">
                <div className="bg-slate-900 p-3 rounded-md border border-indigo-500/30 shadow-sm border border-slate-700/50 flex flex-col gap-2">
                    {/* Top Row: Status, Version, Speed, Auto-detect, TinySA */}
                    <div className="flex flex-col md:flex-row items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-[220px]">
                            <div className="w-3 h-6 bg-indigo-500 rounded-full animate-pulse" />
                            <h4 className="text-[14px] font-black text-white uppercase tracking-widest">Hardware Connection</h4>
                            <button 
                                onClick={() => setShowTroubleshoot(true)}
                                className="ml-1 text-[10px] text-indigo-400 hover:text-indigo-300 underline font-bold uppercase tracking-wider transition-colors"
                            >
                                Help / Troubleshoot
                            </button>
                            <InfoTooltip content="Connect your TinySA or RF Explorer via USB. Note: TinySA must be set to CONFIG -> SERIAL -> USB on its screen menu." />
                        </div>
                        
                        <div className="flex flex-wrap items-center justify-end gap-3">
                            <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${device ? 'bg-emerald-500 text-white shadow-sm border border-slate-700/50 shadow-emerald-500/20' : 'bg-slate-800 text-slate-500'}`}>
                                {device ? '● Online' : '○ Offline'}
                            </div>
                            
                            {device && (
                                <div className="text-[12px] font-bold text-indigo-300 flex items-center gap-2 px-3">
                                    {hardwareVersion || 'Identifying...'}
                                    {isPaused && <span className="text-[10px] text-amber-500 ml-2 font-black uppercase tracking-widest">[Paused]</span>}
                                </div>
                            )}

                            {!device && (
                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="flex items-center gap-2 bg-black/60 px-3 py-1.5 rounded-sm border border-indigo-500/30">
                                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-tighter">Speed:</span>
                                        <select 
                                            value={baudRate}
                                            onChange={(e) => setBaudRate(Number(e.target.value))}
                                            className="bg-transparent text-[12px] text-white outline-none font-mono font-bold cursor-pointer"
                                        >
                                            <option value={9600}>9600</option>
                                            <option value={57600}>57600</option>
                                            <option value={115200}>115200</option>
                                            <option value={500000}>500000</option>
                                            <option value={921600}>921600</option>
                                        </select>
                                    </div>
                                    <button 
                                        onClick={async () => {
                                            if (onAutoDetectSerial) {
                                                await onAutoDetectSerial(deviceType);
                                            }
                                        }}
                                        className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/30 rounded-sm text-[9px] font-black uppercase tracking-tighter transition-all whitespace-nowrap"
                                    >
                                        Auto-Detect
                                    </button>
                                    <select 
                                        value={deviceType}
                                        onChange={(e) => {
                                            const newType = e.target.value as 'tinysa' | 'rfexplorer';
                                            setDeviceType(newType);
                                            setBaudRate(newType === 'rfexplorer' ? 500000 : 115200);
                                        }}
                                        className="bg-slate-800 border border-indigo-500/30 text-white rounded-sm px-2 py-1.5 text-[10px] font-black uppercase tracking-widest outline-none focus:border-indigo-500"
                                    >
                                        <option value="tinysa">TinySA</option>
                                        <option value="rfexplorer">RF Explorer</option>
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Bottom Row: Action Buttons */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/5">
                        <div className="flex flex-wrap items-center gap-2">
                            {device ? (
                                <>
                                    <button 
                                        onClick={handleToggleScan}
                                        className={`px-3 py-1.5 rounded-sm text-[10px] font-black uppercase transition-all shadow-sm border border-slate-700/50 whitespace-nowrap ${serialIsScanning ? 'bg-rose-500 text-white animate-pulse' : 'bg-emerald-500 text-white shadow-emerald-500/20'}`}
                                    >
                                        {serialIsScanning ? 'Stop Scan' : 'Start Scan'}
                                    </button>
                                    <button 
                                        onClick={() => setIsPaused(!isPaused)}
                                        className={`px-3 py-1.5 rounded-sm text-[10px] font-black uppercase transition-all shadow-sm border border-slate-700/50 whitespace-nowrap ${isPaused ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20' : 'bg-amber-600/20 hover:bg-amber-600 text-amber-400 hover:text-white border border-amber-500/30'}`}
                                    >
                                        {isPaused ? 'Resume' : 'Pause'}
                                    </button>
                                    <button 
                                        onClick={handleDisconnect}
                                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-sm text-[10px] font-black uppercase transition-all shadow-sm border border-slate-700/50 shadow-rose-600/20 whitespace-nowrap"
                                    >
                                        Disconnect
                                    </button>
                                </>
                            ) : (
                                <button 
                                    onClick={handleConnect}
                                    disabled={isConnecting}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-sm text-[12px] font-black uppercase tracking-widest transition-all shadow-sm border border-slate-700/50 shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
                                >
                                    {isConnecting ? (
                                        <>
                                            <span className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                            Connecting...
                                        </>
                                    ) : (
                                        <>🔌 Connect Device</>
                                    )}
                                </button>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <button 
                                onClick={() => setShowTerminal(!showTerminal)}
                                className={`px-3 py-1.5 rounded-sm text-[10px] font-black uppercase transition-all whitespace-nowrap ${showTerminal ? 'bg-indigo-500 text-white shadow-sm border border-slate-700/50' : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'}`}
                            >
                                {showTerminal ? 'Hide Terminal' : 'Terminal'}
                            </button>

                            <button 
                                onClick={() => setShowSetup(!showSetup)}
                                className={`px-3 py-1.5 rounded-sm text-[10px] font-black uppercase transition-all whitespace-nowrap ${showSetup ? 'bg-indigo-500 text-white shadow-sm border border-slate-700/50' : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'}`}
                            >
                                {showSetup ? 'Hide Setup' : 'Setup Guide'}
                            </button>

                            <div className="h-4 w-px bg-white/10 mx-1 hidden sm:block" />

                            <button 
                                onClick={onSimulate}
                                className={`px-3 py-1.5 rounded-sm text-[10px] font-black uppercase transition-all whitespace-nowrap ${scanData && !device ? 'bg-rose-600 text-white shadow-sm border border-slate-700/50 shadow-rose-600/20' : 'bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white border border-indigo-500/30'}`}
                            >
                                {scanData && !device ? 'Stop Demo' : 'Demo Scan'}
                            </button>
                        </div>
                    </div>
                </div>

                {showTerminal && (
                    <div className="bg-slate-900 p-2 rounded-md border border-indigo-500/30 shadow-sm border border-slate-700/50">
                        <div className="grid grid-cols-1 gap-2 mb-4">
                            {device && (
                                <div className="flex flex-wrap gap-2 md:col-span-2 mb-2">
                                    <button 
                                        onClick={async () => {
                                            if (!device) return;
                                            addLog('Attempting Wake Up...');
                                            const { forceWakeUp } = await import('../services/serialService');
                                            await forceWakeUp(device);
                                            addLog('Wake up sequence sent.');
                                        }}
                                        className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-[10px] font-black uppercase transition-all shadow-sm border border-slate-700/50 shadow-indigo-600/20"
                                    >
                                        Wake Up
                                    </button>
                                    <button 
                                        onClick={async () => {
                                            if (!device) return;
                                            addLog('Listening for 3s...');
                                            const { listenOnly } = await import('../services/serialService');
                                            const data = await listenOnly(device, 3000, (raw) => addRawLog(raw));
                                            if (data) {
                                                addLog(`Heard ${data.length} chars. Device is talking!`);
                                            } else {
                                                addLog('Silence. No data received.');
                                            }
                                        }}
                                        className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-md text-[10px] font-black uppercase transition-all shadow-sm border border-slate-700/50"
                                    >
                                        Listen Test
                                    </button>
                                    <button 
                                        onClick={async () => {
                                            if (!device) return;
                                            setIsPaused(true);
                                            addLog('Pinging Device...');
                                            const { sendRawCommand } = await import('../services/serialService');
                                            const res = await sendRawCommand(device, '', (raw) => addRawLog(raw));
                                            if (res.includes('ch>')) {
                                                addLog('Ping Success: Device Ready');
                                            } else {
                                                addLog('Ping: No prompt received');
                                            }
                                        }}
                                        className="px-3 py-2 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/30 rounded-md text-[10px] font-black uppercase transition-all"
                                    >
                                        Ping
                                    </button>
                                    <button 
                                        onClick={async () => {
                                            if (!device) return;
                                            addLog('Requesting Help Menu...');
                                            const { sendRawCommand } = await import('../services/serialService');
                                            const res = await sendRawCommand(device, 'help', (raw) => addRawLog(raw));
                                            addLog(`Help: ${res.slice(0, 50)}...`);
                                        }}
                                        className="px-3 py-2 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/30 rounded-md text-[10px] font-black uppercase transition-all"
                                    >
                                        Get Help
                                    </button>
                                    <button 
                                        onClick={async () => {
                                            if (!device) return;
                                            addLog('Sending Aggressive Reset...');
                                            const encoder = new TextEncoder();
                                            await device.writer.write(encoder.encode('\x03\r\n\x03\r\n\x03\r\nreset\r\n'));
                                            addLog('Reset sequence sent.');
                                        }}
                                        className="px-3 py-2 bg-amber-600/20 hover:bg-amber-600 text-amber-400 hover:text-white border border-amber-500/30 rounded-md text-[10px] font-black uppercase transition-all"
                                    >
                                        Force Reset
                                    </button>
                                </div>
                            )}
                            {device && (
                                <div className="flex flex-wrap gap-2 md:col-span-2 mb-2">
                                <input 
                                    type="text"
                                    value={manualCommand}
                                    onChange={(e) => setManualCommand(e.target.value)}
                                    onKeyDown={async (e) => {
                                        if (e.key === 'Enter' && manualCommand) {
                                            const cmd = manualCommand;
                                            setManualCommand('');
                                            addLog(`Manual Cmd: ${cmd}`);
                                            const { sendRawCommand } = await import('../services/serialService');
                                            const res = await sendRawCommand(device, cmd, (raw) => addRawLog(raw));
                                            addLog(`Response: ${res.slice(0, 50)}...`);
                                        }
                                    }}
                                    placeholder="Type manual command (e.g. info, help, scan) and press Enter"
                                    className="flex-1 bg-black/60 border border-indigo-500/30 rounded-sm px-3 py-2 text-emerald-400 font-mono text-[11px] outline-none focus:border-indigo-500 transition-all"
                                />
                                <button 
                                    onClick={async () => {
                                        if (!manualCommand) return;
                                        const cmd = manualCommand;
                                        setManualCommand('');
                                        addLog(`Manual Cmd: ${cmd}`);
                                        const { sendRawCommand } = await import('../services/serialService');
                                        const res = await sendRawCommand(device, cmd, (raw) => addRawLog(raw));
                                        addLog(`Response: ${res.slice(0, 50)}...`);
                                    }}
                                    className="px-3 py-2 bg-indigo-600 text-white rounded-sm text-[10px] font-black uppercase"
                                >
                                    Send
                                </button>
                            </div>
                        )}
                        </div>

                        <div className="bg-black/80 rounded-md border-2 border-indigo-500/20 p-2 font-mono text-[11px] text-emerald-400 h-[200px] overflow-y-auto relative shadow-inner">
                            <div className="float-right flex gap-2 z-10">
                                <button 
                                    onClick={() => setRawLog([])}
                                    className="bg-slate-800 hover:bg-slate-700 text-[7px] text-white uppercase font-black px-2 py-1 rounded shadow-sm border border-slate-700/50"
                                >
                                    Clear
                                </button>
                                <div className="bg-indigo-500 text-[8px] text-white uppercase font-black px-2 py-1 rounded shadow-sm border border-slate-700/50">
                                    Raw Serial Stream
                                </div>
                            </div>
                            {rawLog.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-slate-700 gap-2">
                                    <div className="w-8 h-8 border-2 border-slate-800 border-t-slate-600 rounded-full animate-spin" />
                                    <span className="italic text-[11px] font-bold uppercase tracking-widest">Listening for data...</span>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {rawLog.map((log, i) => (
                                        <div key={i} className="border-l-2 border-emerald-500/20 pl-3 py-0.5 hover:bg-white/5 transition-colors">
                                            <span className="text-emerald-500/20 mr-3 font-bold">[{rawLog.length - i}]</span>
                                            {log}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {showSetup && (
                    <HardwareSetupGuide />
                )}
            </div>

            {/* Troubleshoot Modal */}
            {showTroubleshoot && (
                <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[1000000] flex items-center justify-center p-2 overflow-y-auto">
                    <div className="bg-slate-900 border border-indigo-500/30 rounded-md shadow-2xl w-full max-w-2xl p-4 md:p-8 text-white relative">
                        <button 
                            onClick={() => setShowTroubleshoot(false)}
                            className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors p-2"
                        >
                            ✕
                        </button>

                        <div className="flex items-center gap-2 mb-6">
                            <div className="w-12 h-12 bg-indigo-500/20 text-indigo-400 rounded-md flex items-center justify-center text-xl font-semibold">
                                🔧
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold font-black uppercase tracking-tight">Connection Troubleshooter</h2>
                                <p className="text-slate-400 text-xs uppercase tracking-widest mt-1">Resolving Serial Port Access Issues</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="bg-amber-500/10 border border-amber-500/30 rounded-md p-2">
                                <h3 className="text-amber-400 font-bold text-sm uppercase mb-2 flex items-center gap-2">
                                    <span>⚠️</span> "Failed to open serial port"
                                </h3>
                                <p className="text-slate-300 text-sm leading-relaxed">
                                    This common browser error usually means the device is "Busy" or "Locked". 
                                    Browsers like Chrome and Edge only allow <strong>one</strong> application to talk to a device at a time.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <div className="bg-slate-800/50 p-2 rounded-md border border-white/5">
                                    <h4 className="text-indigo-400 font-bold text-xs uppercase mb-3">1. Check Other Apps</h4>
                                    <p className="text-[13px] text-slate-300 leading-relaxed">
                                        Ensure the <strong>tinySA-App</strong>, <strong>RF Explorer Client</strong>, or any other serial terminals are completely closed on your computer. Even another browser tab running this app can block the port.
                                    </p>
                                </div>
                                <div className="bg-slate-800/50 p-2 rounded-md border border-white/5">
                                    <h4 className="text-indigo-400 font-bold text-xs uppercase mb-3">2. Check Device Manager (Windows)</h4>
                                    <p className="text-[13px] text-slate-300 leading-relaxed mb-3">
                                        Right-click Start ➔ <strong>Device Manager</strong>. Expand <strong>"Ports (COM & LPT)"</strong>. Your device must appear there (e.g. COM3).
                                    </p>
                                    <div className="bg-black/40 px-3 py-2 rounded text-[11px] font-mono text-amber-400 border border-amber-500/20">
                                        ⚠️ If missing: Try a different USB cable or install the CH340/CP210x driver.
                                    </div>
                                </div>
                                <div className="bg-slate-800/50 p-2 rounded-md border border-white/5">
                                    <h4 className="text-indigo-400 font-bold text-xs uppercase mb-3">3. Reset Browser Permission</h4>
                                    <p className="text-[13px] text-slate-300 leading-relaxed mb-3">
                                        Look for the <strong>"Tune" or "Levels" icon</strong> (sliders) at the far left of your address bar (next to the URL).
                                    </p>
                                    <div className="bg-black/40 px-3 py-2 rounded text-[11px] font-mono text-emerald-400 border border-white/5">
                                        Click ⚙️ Icon ➔ Reset Permission ➔ Refresh Page
                                    </div>
                                </div>
                            </div>

                            <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-md p-5">
                                <h4 className="text-indigo-400 font-bold text-xs uppercase mb-3 flex items-center gap-2">
                                    <span>🚀</span> Pro Tip: Use "Open in New Tab"
                                </h4>
                                <p className="text-[13px] text-slate-300 leading-relaxed">
                                    The AI Studio preview window is an "iframe", which can sometimes confuse browser permissions. For the best experience:
                                </p>
                                <div className="mt-3 flex flex-col gap-2">
                                    <div className="flex items-start gap-3">
                                        <div className="w-3.5 h-3.5 bg-indigo-500 rounded text-[10px] flex items-center justify-center font-bold">1</div>
                                        <p className="text-[12px] text-slate-400">Look at the top-right header of AI Studio.</p>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="w-3.5 h-3.5 bg-indigo-500 rounded text-[10px] flex items-center justify-center font-bold">2</div>
                                        <p className="text-[12px] text-slate-400">Click the <strong>Square with Arrow icon</strong> (Open in new tab).</p>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="w-3.5 h-3.5 bg-indigo-500 rounded text-[10px] flex items-center justify-center font-bold">3</div>
                                        <p className="text-[12px] text-slate-400">Connecting directly in the new tab is much more reliable.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-center pt-2">
                                <button 
                                    onClick={() => setShowTroubleshoot(false)}
                                    className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md font-bold uppercase tracking-widest transition-all shadow-sm border border-slate-700/50 shadow-indigo-500/20"
                                >
                                    Got it, I'll Try Again
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showShareModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 bg-slate-950/80 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 rounded-md p-4 max-w-md w-full shadow-2xl">
                        <h3 className="text-base font-medium font-bold text-white mb-4">Share Live Scan</h3>
                        <p className="text-slate-400 text-sm mb-4">Add details to help others find this scan in the Plot Gallery.</p>
                        
                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Location / Venue</label>
                                <input 
                                    type="text" 
                                    value={shareMeta.location}
                                    onChange={(e) => setShareMeta({...shareMeta, location: e.target.value})}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-sm px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
                                    placeholder="e.g. O2 Arena, London"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Festival / Event Name</label>
                                <input 
                                    type="text" 
                                    value={shareMeta.festival}
                                    onChange={(e) => setShareMeta({...shareMeta, festival: e.target.value})}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-sm px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
                                    placeholder="e.g. Glastonbury"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Stage</label>
                                <input 
                                    type="text" 
                                    value={shareMeta.stage}
                                    onChange={(e) => setShareMeta({...shareMeta, stage: e.target.value})}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-sm px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
                                    placeholder="e.g. Main Stage"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Notes</label>
                                <textarea 
                                    value={shareMeta.notes}
                                    onChange={(e) => setShareMeta({...shareMeta, notes: e.target.value})}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-sm px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none h-20 resize-none"
                                    placeholder="Any additional notes about this scan..."
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3">
                            <button 
                                onClick={() => setShowShareModal(false)} 
                                className="px-3 py-2 rounded-sm text-sm font-bold text-slate-300 hover:bg-slate-800 transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={confirmShareScan} 
                                disabled={isSharing}
                                className="px-3 py-2 rounded-sm text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
                            >
                                {isSharing ? 'Sharing...' : 'Share to Gallery'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Card>
    );
};

export default LiveScanAnalyzer;
