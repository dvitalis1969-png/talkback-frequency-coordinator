import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { isPro } from '../src/lib/userUtils';
import { createPortal } from 'react-dom';
import { Frequency, Thresholds, AnalysisResult, Conflict, Scene, TxType, FrequencySnapshot, ScanDataPoint, BandResult, TVChannelState, WMASState } from '../types';
import { checkCompatibility, checkCompatibilityTimeline } from '../services/rfService';
import { exportToJson, importFromJson } from '../services/fileService';
import { analyzeFrequencySet } from '../services/frequencyAnalysisService';
import Card, { CardTitle, Placeholder } from './Card';
import SpectrumVisualizer from './SpectrumVisualizer';
import { InfoTooltip } from './InfoTooltip';

const FrequencyValueInput: React.FC<{
    value: number;
    onChange: (val: string) => void;
    className: string;
}> = ({ value, onChange, className }) => {
    const [localString, setLocalString] = useState<string>(value === 0 ? '' : value.toString());
    const isFocused = useRef(false);

    useEffect(() => {
        if (!isFocused.current) {
            setLocalString(value === 0 ? '' : value.toString());
        }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
            setLocalString(val);
            onChange(val);
        }
    };

    const handleBlur = () => {
        isFocused.current = false;
        const parsed = parseFloat(localString);
        if (!isNaN(parsed) && parsed !== 0) setLocalString(parsed.toFixed(3));
        else setLocalString('');
    };

    return (
        <input
            type="text"
            inputMode="decimal"
            placeholder="0.000"
            value={localString}
            onChange={handleChange}
            onFocus={() => { isFocused.current = true; }}
            onBlur={handleBlur}
            className={className}
        />
    );
};

interface AnalyzerTabProps {
    frequencies: Frequency[];
    setFrequencies: (freqs: Frequency[]) => void;
    thresholds: Thresholds;
    setThresholds: (thresholds: Thresholds) => void;
    scenes: Scene[];
    snapshots: FrequencySnapshot[];
    setSnapshots: React.Dispatch<React.SetStateAction<FrequencySnapshot[]>>;
    scanData: ScanDataPoint[] | null;
    tvChannelStates?: Record<number, TVChannelState>;
    setTvChannelStates?: React.Dispatch<React.SetStateAction<Record<number, TVChannelState>>>;
    wmasState?: WMASState;
    tvRegion?: 'uk' | 'us';
    setTvRegion?: (region: 'uk' | 'us') => void;
    user?: any;
}

const buttonBase = "px-5 py-2.5 rounded-md font-black uppercase tracking-widest text-[10px] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 border disabled:opacity-50";
const primaryButton = `bg-indigo-600 border-indigo-400 text-white hover:bg-indigo-500 shadow-sm border border-slate-700/50 ${buttonBase}`;
const secondaryButton = `bg-slate-800 border-white/10 text-slate-300 hover:bg-slate-700 hover:text-white ${buttonBase}`;
const actionButton = `bg-cyan-600 border-cyan-400 text-white hover:bg-cyan-500 ${buttonBase}`;
const dangerButton = `bg-rose-600 border-rose-400 text-white hover:bg-rose-500 ${buttonBase}`;

const AnalyzerTab: React.FC<AnalyzerTabProps> = ({ frequencies, setFrequencies, thresholds, setThresholds, scenes, snapshots = [], setSnapshots, scanData, tvChannelStates, setTvChannelStates, wmasState, tvRegion = 'uk', setTvRegion, user }) => {
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [advancedAnalysis, setAdvancedAnalysis] = useState(false);
    const [timelineAware, setTimelineAware] = useState(false);
    const [manualExclusions, setManualExclusions] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isSnapshotModalOpen, setIsSnapshotModalOpen] = useState(false);
    const [newSnapshotName, setNewSnapshotName] = useState('');

    const parsedExclusions = useMemo(() => {
        return manualExclusions.split(',')
            .map(s => {
                const parts = s.split('-').map(p => parseFloat(p.trim()));
                return parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]) ? { min: Math.min(parts[0], parts[1]), max: Math.max(parts[0], parts[1]) } : null;
            })
            .filter((x): x is { min: number, max: number } => x !== null);
    }, [manualExclusions]);

    const handleExclusionZoneAdd = (min: number, max: number) => {
        const newRange = `${min.toFixed(3)}-${max.toFixed(3)}`;
        setManualExclusions(prev => prev && prev.trim() ? `${prev.trim()}, ${newRange}` : newRange);
    };

    const handleExclusionZoneRemove = (index: number) => {
        const updatedZones = parsedExclusions.filter((_, i) => i !== index);
        setManualExclusions(updatedZones.map(z => `${z.min.toFixed(3)}-${z.max.toFixed(3)}`).join(', '));
    };

    const handleFrequencyChange = useCallback((id: string, field: 'value' | 'label' | 'type', value: string | number) => {
        let finalValue = value;
        if (field === 'value') {
            const numericValue = parseFloat(value as string) || 0;
            // Snap to 25kHz (0.025 MHz) steps
            finalValue = Math.round(numericValue / 0.025) * 0.025;
        }
        setFrequencies(frequencies.map(f => f.id === id ? { ...f, [field]: finalValue } : f));
    }, [frequencies, setFrequencies]);

    const handleLockToggle = useCallback((id: string) => {
        setFrequencies(frequencies.map(f => f.id === id ? { ...f, locked: !f.locked } : f));
    }, [frequencies, setFrequencies]);
    
    const addFrequency = () => {
        if (!isPro(user) && frequencies.length >= 6) {
            toast.error("Free Plan Limit: Maximum of 6 frequencies can be analyzed. Please upgrade to Pro.");
            return;
        }
        setFrequencies([...frequencies, { id: `F${frequencies.length + 1}`, value: 0, label: '', locked: false, type: 'generic' }]);
    };
    
    const removeFrequency = (id: string) => {
        setFrequencies(frequencies.filter(f => f.id !== id).map((f, i) => ({ ...f, id: `F${i + 1}` })));
    };

    const handleThresholdChange = (key: keyof Thresholds, value: string) => {
        setThresholds({ ...thresholds, [key]: parseFloat(value) || 0 });
    };

    const analyzeFrequencies = useCallback(() => {
        const activeFreqs = frequencies.filter(f => f.value > 0);
        if (activeFreqs.length < 2) {
            toast.error('Insufficient data. Provide ≥2 active carriers.');
            return;
        }
        const effectiveThresholds = advancedAnalysis 
            ? thresholds 
            : { ...thresholds, fiveTone: 0, sevenTone: 0 };
        const ruleBufferedFreqs = activeFreqs.map(f => ({ ...f, manualThresholds: effectiveThresholds }));
        const result = timelineAware ? checkCompatibilityTimeline(ruleBufferedFreqs, effectiveThresholds, scenes) : checkCompatibility(ruleBufferedFreqs, effectiveThresholds);
        setAnalysisResult(result);
    }, [frequencies, thresholds, timelineAware, scenes, advancedAnalysis]);

    // Auto-update analysis result if it already exists (real-time updates during drag)
    useEffect(() => {
        if (analysisResult) {
            const activeFreqs = frequencies.filter(f => f.value > 0);
            if (activeFreqs.length >= 2) {
                const effectiveThresholds = advancedAnalysis 
                    ? thresholds 
                    : { ...thresholds, fiveTone: 0, sevenTone: 0 };
                const ruleBufferedFreqs = activeFreqs.map(f => ({ ...f, manualThresholds: effectiveThresholds }));
                const result = timelineAware ? checkCompatibilityTimeline(ruleBufferedFreqs, effectiveThresholds, scenes) : checkCompatibility(ruleBufferedFreqs, effectiveThresholds);
                setAnalysisResult(result);
            } else {
                setAnalysisResult(null);
            }
        }
    }, [frequencies, thresholds, timelineAware, scenes, advancedAnalysis]);

    const activeFreqValues = useMemo(() => frequencies.filter(f => f.value > 0).map(f => f.value), [frequencies]);
    const forensicSpacing = useMemo(() => {
        if (activeFreqValues.length < 2) return null;
        return analyzeFrequencySet(activeFreqValues, 'analogue');
    }, [activeFreqValues]);

    const formatSpacingValue = (val: number | undefined) => {
        if (val === undefined || val === Infinity || val === 0) return '∞';
        return `${val.toFixed(3)} MHz`;
    };

    const clearAnalyzer = () => {
        setFrequencies(frequencies.map(f => ({...f, value: 0, label: '', type: 'generic'})));
        setAnalysisResult(null);
    };
    
    const handleSaveToFile = () => exportToJson({ frequencies: frequencies.filter(f => f.value > 0), thresholds, tvChannelStates }, 'rf_workspace.rflist');

    const handleLoadFromFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const data = await importFromJson<{frequencies: Frequency[], thresholds: Thresholds, tvChannelStates?: Record<number, TVChannelState>}>(file);
            if (data.frequencies) {
                if (!isPro(user) && data.frequencies.length > 6) {
                    toast.error("Free Plan Limit: Maximum of 6 frequencies can be loaded. Please upgrade to Pro.");
                    setFrequencies(data.frequencies.slice(0, 6));
                } else {
                    setFrequencies(data.frequencies);
                }
            }
            if (data.thresholds) setThresholds(data.thresholds);
            if (data.tvChannelStates && setTvChannelStates) setTvChannelStates(data.tvChannelStates);
        } catch (error) { toast.error("Load failed."); }
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                    <div className="flex justify-between items-center mb-8">
                        <div className="flex flex-col">
                            <CardTitle className="!mb-0 !border-b-0 !pb-0 text-white">Active Workspace</CardTitle>
                            <span className="text-[9px] font-black uppercase text-slate-500 tracking-[0.2em] mt-1">enter frequencies</span>
                        </div>
                        <button onClick={() => setIsSnapshotModalOpen(true)} className={`${actionButton} flex items-center gap-2 py-2`}>
                            <span className="text-sm">💾</span> Snapshots
                        </button>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mb-8 p-3 bg-slate-950/40 rounded-md border border-white/5 shadow-inner">
                        <input type="file" ref={fileInputRef} accept=".rflist,.json" className="hidden" onChange={handleLoadFromFile} />
                        <button onClick={() => fileInputRef.current?.click()} className={secondaryButton}>📂 Load</button>
                        <button onClick={handleSaveToFile} className={secondaryButton}>💾 Save</button>
                        <div className="w-px h-5 bg-white/5 mx-2 self-center" />
                        <button onClick={clearAnalyzer} className={dangerButton}>Reset</button>
                    </div>

                    <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-3 custom-scrollbar">
                        {frequencies.map((f) => (
                            <div key={f.id} className="grid grid-cols-[24px_minmax(80px,100px)_minmax(120px,220px)_80px_1fr_36px_36px] gap-2 items-center group bg-slate-950/20 p-1.5 rounded-md border border-transparent hover:border-white/5 transition-all w-full">
                                <label className="text-slate-600 font-mono text-[9px] text-center font-bold">{f.id}</label>
                                <FrequencyValueInput
                                    value={f.value}
                                    onChange={(val) => handleFrequencyChange(f.id, 'value', val)}
                                    className="bg-slate-900 border border-white/5 rounded-sm p-2 text-indigo-400 text-xs font-bold font-mono focus:border-indigo-500 outline-none text-center shadow-inner w-full"
                                />
                                <input
                                    type="text"
                                    placeholder="Label"
                                    value={f.label || ''}
                                    onChange={(e) => handleFrequencyChange(f.id, 'label', e.target.value)}
                                    className="bg-slate-900 border border-white/5 rounded-sm p-2 text-slate-300 text-xs font-bold focus:border-indigo-500 outline-none shadow-inner w-full"
                                />
                                <select value={f.type || 'generic'} onChange={e => handleFrequencyChange(f.id, 'type', e.target.value)} className="bg-slate-800 border border-white/5 rounded-sm p-2 text-slate-400 text-[9px] font-black uppercase tracking-tighter w-full">
                                    <option value="mic">Mic</option>
                                    <option value="iem">IEM</option>
                                    <option value="comms">Com</option>
                                    <option value="wmas">WMAS</option>
                                </select>
                                <div /> {/* Spacer to push actions to the right */}
                                <button onClick={() => handleLockToggle(f.id)} className={`p-2 rounded-md transition-all border flex items-center justify-center ${f.locked ? 'bg-amber-500/10 border-amber-500/40 text-amber-500' : 'bg-slate-900 border-white/10 text-slate-600 hover:text-white'}`}>
                                    {f.locked ? '🔒' : '🔓'}
                                </button>
                                <button onClick={() => removeFrequency(f.id)} className="text-rose-500/30 hover:text-rose-500 transition-all p-1 flex items-center justify-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>
                                </button>
                            </div>
                        ))}
                    </div>
                    <button onClick={addFrequency} className="w-full mt-4 py-3 rounded-md font-black text-[10px] uppercase tracking-[0.2em] bg-slate-900 border border-dashed border-slate-700 text-slate-500 hover:border-indigo-500/50 hover:text-indigo-400 transition-all">+ Add Channel Entry</button>

                    <div className="mt-12 mb-6 flex flex-col">
                        <CardTitle className="!mb-0 !border-b-0 !pb-0 text-white flex items-center">
                            Logic Parameters
                            <InfoTooltip content="Set the minimum frequency separation required between different types of intermodulation products." />
                        </CardTitle>
                        <span className="text-[9px] font-black uppercase text-slate-500 tracking-[0.2em] mt-1">Intermodulation Guard Guards</span>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3">
                        {['fundamental', 'twoTone', 'threeTone'].map((key) => (
                            <div key={key} className="bg-slate-950/40 p-3 rounded-md border border-white/5">
                                <label className="text-slate-500 text-[8px] uppercase font-black mb-2 block tracking-widest text-center">{key === 'fundamental' ? 'Base F-F' : key === 'twoTone' ? '2-Tone' : '3-Tone'}</label>
                                <input type="number" value={(thresholds as any)[key]} onChange={e => handleThresholdChange(key as any, e.target.value)} step="0.001" className="w-full bg-slate-900 border border-white/5 rounded-md p-2.5 text-indigo-300 text-xs font-black text-center font-mono shadow-inner" />
                            </div>
                        ))}
                    </div>

                    <div className="mt-6 mb-2">
                        <label className="text-[10px] text-slate-500 uppercase font-black mb-1 flex items-center">
                            Manual Exclusions (MHz)
                            <InfoTooltip content="Specify frequency ranges to avoid during coordination and analysis. Format: start-end, start-end (e.g., 500-505, 606.5-608). You can also Shift+Drag directly on the Spectrum canvas." />
                        </label>
                        <input 
                            value={manualExclusions} 
                            onChange={e => setManualExclusions(e.target.value)} 
                            placeholder="e.g. 500-505, 606.5-608" 
                            className="w-full bg-slate-950 border border-slate-700 p-2.5 rounded-md text-xs font-mono text-slate-300 shadow-inner outline-none focus:border-indigo-500" 
                        />
                        
                        {parsedExclusions.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                                {parsedExclusions.map((zone, idx) => (
                                    <div key={idx} className="flex items-center gap-1 bg-rose-500/10 border border-rose-500/20 rounded-full px-2 py-0.5 text-[9px] font-black text-rose-400">
                                        <span>{zone.min.toFixed(3)}-{zone.max.toFixed(3)}</span>
                                        <button 
                                            onClick={() => handleExclusionZoneRemove(idx)}
                                            className="hover:text-white transition-colors ml-1"
                                            title="Remove exclusion zone"
                                        >
                                            &times;
                                        </button>
                                    </div>
                                ))}
                                <button 
                                    onClick={() => setManualExclusions('')}
                                    className="text-[8px] text-slate-500 hover:text-rose-400 uppercase font-black tracking-widest transition-colors"
                                >
                                    Clear All
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="mt-4 p-2 bg-indigo-500/5 rounded-md border border-indigo-500/10 space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <input type="checkbox" checked={timelineAware} onChange={e => setTimelineAware(e.target.checked)} className="w-4 h-4 rounded accent-indigo-500 bg-slate-800" />
                            <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest group-hover:text-indigo-300 transition-colors flex items-center">
                                Timeline-Aware Validation
                                <InfoTooltip content="Only check for conflicts between frequencies that are active in the same scene/time period." />
                            </span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <input type="checkbox" checked={advancedAnalysis} onChange={e => setAdvancedAnalysis(e.target.checked)} className="w-4 h-4 rounded accent-indigo-500 bg-slate-800" />
                            <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest group-hover:text-indigo-300 transition-colors flex items-center">
                                Higher-Order Product Audit
                                <InfoTooltip content="Include 5-tone and 7-tone intermodulation products in the analysis (computationally intensive)." />
                            </span>
                        </label>
                    </div>

                    <button onClick={analyzeFrequencies} className={`w-full mt-8 ${primaryButton} py-2 text-xs shadow-[0_20px_50px_rgba(79,70,229,0.2)]`}>RUN SITE COMPATIBILITY AUDIT</button>
                </Card>

                <Card>
                    <div className="flex justify-between items-center mb-8">
                        <div className="flex flex-col">
                            <CardTitle className="!mb-0 !border-b-0 !pb-0 text-white">Analysis Log</CardTitle>
                            <span className="text-[9px] font-black uppercase text-slate-500 tracking-[0.2em] mt-1">Real-time Spectral Diagnostics</span>
                        </div>
                    </div>
                    {!analysisResult ? (
                        <Placeholder title="Engine Standby" message='Provide active carriers and click "RUN AUDIT" to check for IMD and spectral conflicts.' />
                    ) : (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <div className={`p-4 rounded-3xl border-2 mb-6 flex items-center justify-between ${analysisResult.conflicts.length === 0 ? 'bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.1)]' : 'bg-rose-500/10 border-rose-500/30 shadow-[0_0_30px_rgba(244,63,94,0.1)]'}`}>
                                <div>
                                    <p className={`text-xl font-semibold font-black uppercase tracking-tighter ${analysisResult.conflicts.length === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {analysisResult.conflicts.length === 0 ? 'Site Compatible' : 'Conflicts Found'}
                                    </p>
                                    <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mt-1">
                                        {frequencies.filter(f=>f.value > 0).length} Carriers • {analysisResult.conflicts.length} Violations
                                    </p>
                                </div>
                                <span className="text-4xl">{analysisResult.conflicts.length === 0 ? '✅' : '⚠️'}</span>
                            </div>
                            <div className="space-y-2.5 max-h-[580px] overflow-y-auto pr-3 custom-scrollbar">
                                {analysisResult.conflicts.length === 0 ? (
                                    <div className="text-slate-600 text-center py-20 text-xs font-medium uppercase tracking-widest italic opacity-50">Spectral environment matches mathematical model constraints.</div>
                                ) : (
                                    analysisResult.conflicts.slice(0, 50).map((c, i) => (
                                        <div key={i} className="bg-slate-950/40 border border-white/5 rounded-md p-2 flex flex-col gap-2 group hover:bg-slate-900 transition-colors">
                                            <div className="flex justify-between items-center">
                                                <span className={`px-2 py-0.5 rounded-sm uppercase text-[8px] font-black border ${c.type.includes('Fundamental') ? 'bg-rose-500/20 text-rose-400 border-rose-500/40' : 'bg-purple-500/20 text-purple-400 border-purple-500/40'}`}>
                                                    {c.type}
                                                </span>
                                                <span className="tabular-nums text-[9px] text-slate-600 font-bold">Delta: {c.diff.toFixed(4)} MHz</span>
                                            </div>
                                            <p className="text-[11px] font-bold text-slate-300 leading-relaxed">
                                                <span className="text-white">{c.targetFreq.id}</span>
                                                {c.type.includes('Fundamental') 
                                                    ? ` too close to ${c.sourceFreqs[0].id}`
                                                    : ` hit by products of ${c.sourceFreqs.map(f => f.id).join(' + ')}`
                                                }
                                                {c.sceneName && <span className="text-indigo-400 text-[9px] font-black ml-2">[{c.sceneName}]</span>}
                                            </p>
                                        </div>
                                    ))
                                )}
                            </div>
                            
                            {forensicSpacing && (
                                <div className="mt-6 pt-5 border-t border-white/5 space-y-4">
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 flex items-center justify-between">
                                        <span>🔍 Passive Forensic Spacing Diagnostics</span>
                                        <span className="text-[8px] italic lowercase text-slate-500">RF Toolkit forensic reference engine</span>
                                    </h4>

                                    {/* Safety Verdict Header Bar */}
                                    <div className="bg-slate-950/60 border border-white/5 rounded-md p-2 flex flex-col sm:flex-row items-center justify-between gap-2">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2.5 rounded-md ${
                                                forensicSpacing.safetyScore >= 80 ? 'bg-emerald-500/10 text-emerald-400' :
                                                forensicSpacing.safetyScore >= 50 ? 'bg-amber-500/10 text-amber-400' :
                                                'bg-rose-500/10 text-rose-400'
                                            }`}>
                                                🛡️
                                            </div>
                                            <div>
                                                <div className="text-[8px] font-black uppercase tracking-widest text-slate-500">Spectral Quality Verdict</div>
                                                <div className="text-sm font-black text-white">{forensicSpacing.safetyVerdict}</div>
                                            </div>
                                        </div>
                                        <div className="w-full sm:w-48">
                                            <div className="flex justify-between text-[8px] font-black uppercase text-slate-500 mb-1">
                                                <span>Linear Coexistence Score</span>
                                                <span className={`${
                                                    forensicSpacing.safetyScore >= 80 ? 'text-emerald-400' :
                                                    forensicSpacing.safetyScore >= 50 ? 'text-amber-400' :
                                                    'text-rose-400'
                                                }`}>{forensicSpacing.safetyScore}%</span>
                                            </div>
                                            <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
                                                <div 
                                                    className={`h-full rounded-full transition-all duration-500 ${
                                                        forensicSpacing.safetyScore >= 80 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' :
                                                        forensicSpacing.safetyScore >= 50 ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' :
                                                        'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'
                                                    }`} 
                                                    style={{ width: `${forensicSpacing.safetyScore}%` }} 
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                        {/* Channel Spacing Item */}
                                        <div className="bg-slate-950/40 border border-white/5 p-3 rounded-md flex flex-col justify-between hover:border-indigo-500/15 transition-all">
                                            <div className="flex items-center justify-between mb-1 gap-1">
                                                <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider truncate">Ch Spacing</span>
                                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${forensicSpacing.channelSpacing >= thresholds.fundamental ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]' : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.5)] animate-pulse'}`} />
                                            </div>
                                            <div className="text-xs font-black text-white">{formatSpacingValue(forensicSpacing.channelSpacing)}</div>
                                            <div className="text-[8px] text-slate-500 mt-1 flex justify-between">
                                                <span>Min required:</span>
                                                <span className="font-mono text-indigo-400">{thresholds.fundamental.toFixed(3)}M</span>
                                            </div>
                                        </div>

                                        {/* 2-Tone Spacing Item */}
                                        <div className="bg-slate-950/40 border border-white/5 p-3 rounded-md flex flex-col justify-between hover:border-indigo-500/15 transition-all">
                                            <div className="flex items-center justify-between mb-1 gap-1">
                                                <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider truncate">2-Tone Spacing</span>
                                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${forensicSpacing.twoTone3rd >= thresholds.twoTone ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]' : 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.5)] animate-pulse'}`} />
                                            </div>
                                            <div className="text-xs font-black text-white">{formatSpacingValue(forensicSpacing.twoTone3rd)}</div>
                                            <div className="text-[8px] text-slate-500 mt-1 flex justify-between">
                                                <span>Min required:</span>
                                                <span className="font-mono text-indigo-400">{thresholds.twoTone.toFixed(3)}M</span>
                                            </div>
                                        </div>

                                        {/* 3-Tone Spacing Item */}
                                        <div className="bg-slate-950/40 border border-white/5 p-3 rounded-md flex flex-col justify-between hover:border-indigo-500/15 transition-all">
                                            <div className="flex items-center justify-between mb-1 gap-1">
                                                <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider truncate">3-Tone Spacing</span>
                                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${forensicSpacing.threeTone3rd >= thresholds.threeTone ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]' : 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.5)] animate-pulse'}`} />
                                            </div>
                                            <div className="text-xs font-black text-white">{formatSpacingValue(forensicSpacing.threeTone3rd)}</div>
                                            <div className="text-[8px] text-slate-500 mt-1 flex justify-between">
                                                <span>Min required:</span>
                                                <span className="font-mono text-indigo-400">{thresholds.threeTone.toFixed(3)}M</span>
                                            </div>
                                        </div>

                                        {/* 5th Order Spacing Item */}
                                        <div className="bg-slate-950/40 border border-white/5 p-3 rounded-md flex flex-col justify-between hover:border-indigo-500/15 transition-all">
                                            <div className="flex items-center justify-between mb-1 gap-1">
                                                <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider truncate">5th Order Spacing</span>
                                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${forensicSpacing.fiveTone >= thresholds.fiveTone ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]' : 'bg-amber-500/70 shadow-[0_0_6px_rgba(245,158,11,0.3)]'}`} />
                                            </div>
                                            <div className="text-xs font-black text-white">{formatSpacingValue(forensicSpacing.fiveTone)}</div>
                                            <div className="text-[8px] text-slate-500 mt-1 flex justify-between">
                                                <span>Min required:</span>
                                                <span className="font-mono text-indigo-400">{thresholds.fiveTone.toFixed(3)}M</span>
                                            </div>
                                        </div>

                                        {/* 7th Order Spacing Item */}
                                        <div className="bg-slate-950/40 border border-white/5 p-3 rounded-md flex flex-col justify-between hover:border-indigo-500/15 transition-all">
                                            <div className="flex items-center justify-between mb-1 gap-1">
                                                <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider truncate">7th Order Spacing</span>
                                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${forensicSpacing.sevenTone >= thresholds.sevenTone ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]' : 'bg-amber-500/70 shadow-[0_0_6px_rgba(245,158,11,0.3)]'}`} />
                                            </div>
                                            <div className="text-xs font-black text-white">{formatSpacingValue(forensicSpacing.sevenTone)}</div>
                                            <div className="text-[8px] text-slate-500 mt-1 flex justify-between">
                                                <span>Min required:</span>
                                                <span className="font-mono text-indigo-400">{thresholds.sevenTone.toFixed(3)}M</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Educational/Mathematical Reference Panel */}
                                    <div className="p-2 bg-slate-950/40 border border-white/5 rounded-md space-y-3">
                                        <h5 className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">📊 Mathematical IMD Reference Guide</h5>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[10px]">
                                            <div className="space-y-1.5">
                                                <p className="font-bold text-indigo-300">Channel Spacing (Fundamental)</p>
                                                <p className="text-slate-400 leading-normal">
                                                    Calculated as <code className="text-white bg-black/30 px-1 rounded font-mono">f_j - f_i</code>. Prevents adjacent carrier spillover and ensures safe sideband isolation.
                                                </p>
                                            </div>
                                            <div className="space-y-1.5">
                                                <p className="font-bold text-indigo-300">2-Tone Third-Order (2f1 - f2)</p>
                                                <p className="text-slate-400 leading-normal">
                                                    A high-power transmitter combination mixing inside the active stages of another close receiver. Extremely problematic in analogue systems.
                                                </p>
                                            </div>
                                            <div className="space-y-1.5 pt-1 border-t border-white/5 sm:border-0 sm:pt-0">
                                                <p className="font-bold text-indigo-300">3-Tone Third-Order (f1 + f2 - f3)</p>
                                                <p className="text-slate-400 leading-normal">
                                                    Three active carriers mixing down inside passive hardware junctions. High densities require very precise passive guard-bands.
                                                </p>
                                            </div>
                                            <div className="space-y-1.5 pt-1 border-t border-white/5 sm:border-0 sm:pt-0">
                                                <p className="font-bold text-indigo-300">Higher-Order (5th & 7th)</p>
                                                <p className="text-slate-400 leading-normal">
                                                    Occurs at <code className="text-white bg-black/30 px-1 rounded font-mono">3f_i - 2f_j</code> and <code className="text-white bg-black/30 px-1 rounded font-mono">4f_i - 3f_j</code>. Generates lower energy levels, but remains critical on stage environments using over 100W transmitters.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </Card>
            </div>
            
            <SpectrumVisualizer 
                frequencies={frequencies} 
                scanData={scanData} 
                title="Unified Spectral Visualization"
                wmasState={wmasState}
                onFrequencyChange={(id, value) => handleFrequencyChange(id, 'value', value.toString())}
                onExclusionZoneAdd={handleExclusionZoneAdd}
                onExclusionZoneRemove={handleExclusionZoneRemove}
                onExclusionsClear={() => setManualExclusions('')}
                exclusionsText={manualExclusions}
                onExclusionsTextChange={setManualExclusions}
                exclusionZones={parsedExclusions}
                tvRegion={tvRegion}
            />

            {isSnapshotModalOpen && createPortal(
                <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[100] flex items-center justify-center p-2">
                    <div className="bg-slate-900 border border-white/10 rounded-3xl shadow-[0_80px_200px_rgba(0,0,0,1)] w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="flex justify-between items-center p-4 bg-slate-950">
                            <h3 className="font-black text-xs uppercase tracking-[0.3em] text-white">Workspace Manager</h3>
                            <button onClick={() => setIsSnapshotModalOpen(false)} className="text-slate-500 hover:text-white text-xl font-semibold transition-colors">&times;</button>
                        </div>
                        <div className="p-4 space-y-6">
                            <div className="bg-indigo-500/5 p-2 rounded-md border border-indigo-500/20">
                                <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest block mb-2">Capture Current State</label>
                                <div className="flex gap-2">
                                    <input type="text" value={newSnapshotName} onChange={e => setNewSnapshotName(e.target.value)} placeholder="e.g. Daytime Plot..." className="flex-1 bg-slate-950 border border-white/10 rounded-md p-3 text-xs font-bold text-white outline-none focus:border-indigo-500" />
                                    <button onClick={() => { if(newSnapshotName.trim()){ setSnapshots([{ id: `snap-${Date.now()}`, name: newSnapshotName.trim(), createdAt: new Date(), frequencies: frequencies.filter(f=>f.value > 0) }, ...snapshots]); setNewSnapshotName(''); } }} className={primaryButton}>Save</button>
                                </div>
                            </div>
                            <div className="space-y-2 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                                {snapshots.length === 0 ? <p className="text-center py-10 text-slate-600 text-[10px] font-black uppercase tracking-widest">No saved snapshots</p> : snapshots.map(s => (
                                    <div key={s.id} className="bg-slate-950 border border-white/5 p-3 rounded-md flex justify-between items-center group">
                                        <div>
                                            <p className="text-[11px] font-black text-white uppercase tracking-wider">{s.name}</p>
                                            <p className="text-[9px] text-slate-600 font-bold">{s.frequencies.length} CH • {new Date(s.createdAt).toLocaleTimeString()}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => { 
    if (!isPro(user) && s.frequencies.length > 6) {
        toast.error("Free Plan Limit: Maximum of 6 frequencies can be loaded from snapshots.");
        setFrequencies(s.frequencies.slice(0, 6));
    } else {
        setFrequencies(s.frequencies);
    }
    setIsSnapshotModalOpen(false); 
}} className="px-3 py-1.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 rounded-sm text-[9px] font-black uppercase hover:bg-indigo-600 hover:text-white transition-all">Load</button>
                                            <button onClick={() => setSnapshots(prev => prev.filter(snap => snap.id !== s.id))} className="text-rose-500/30 hover:text-rose-500 p-2">&times;</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>, document.body
            )}
        </div>
    );
};

export default React.memo(AnalyzerTab);