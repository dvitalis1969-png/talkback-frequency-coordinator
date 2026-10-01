
import React, { useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { Lock, Unlock, Globe, Calendar, MapPin, CheckCircle2, Trash2, Plus, Zap, Star, ShieldCheck, AlertTriangle, Check, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
    TourPlanningState, TourStop, EquipmentRequest, 
    Frequency, TVChannelState, EquipmentProfile, Thresholds, ConstantSystemRequest
} from '../types';
import { getFinalThresholds, generateTourFrequencies, generateGlobalOnlyFrequencies } from '../services/rfService';
import { UK_TV_CHANNELS, US_TV_CHANNELS, EQUIPMENT_DATABASE } from '../constants';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { generateBrandedPdf, getTableStyles, generateFullCoordinationPdf } from '../src/utils/pdfBranding';
import Card, { CardTitle } from './Card';
import { InfoTooltip } from './InfoTooltip';
import TvGrid from './TvGrid';
import PdfPreviewModal from './PdfPreviewModal';

const SmartTourOptimizer: React.FC<{
    state: TourPlanningState,
    setState: React.Dispatch<React.SetStateAction<TourPlanningState>>
}> = ({ state, setState }) => {
    const channels = state.region === 'uk' ? UK_TV_CHANNELS : US_TV_CHANNELS;
    const sortedStops = [...state.stops].sort((a, b) => {
        const dateA = a.date instanceof Date ? a.date.getTime() : new Date(a.date).getTime();
        const dateB = b.date instanceof Date ? b.date.getTime() : new Date(b.date).getTime();
        return dateA - dateB;
    });

    const getChannelQuality = (stop: TourStop, ch: number) => {
        const tvStates = stop.tvChannelStates || {};
        const erpData = stop.tvChannelErpData || {};
        const chState = tvStates[ch] || 'available';
        const erpEntry = erpData[ch];
        const erp = erpEntry?.maxErp || 0;

        if (chState === 'available') return { score: 3, label: 'Primary', color: 'bg-emerald-500', erpInfo: erpEntry };
        if (chState === 'blocked') {
            if (erp <= 1 && erp > 0) return { score: 2, label: 'Secondary', color: 'bg-emerald-400', erpInfo: erpEntry };
            if (erp > 1 && erp <= 40) return { score: 1, label: 'Tertiary', color: 'bg-amber-400', erpInfo: erpEntry };
            return { score: -100, label: 'Blocked', color: 'bg-red-500', erpInfo: erpEntry };
        }
        return { score: 3, label: 'Primary', color: 'bg-emerald-500', erpInfo: erpEntry }; // Default to clear if not explicitly blocked
    };

    const channelAnalysis = useMemo(() => {
        const results: Record<number, { totalScore: number, stops: any[], isGolden: boolean }> = {};
        
        Object.keys(channels).forEach(chStr => {
            const ch = parseInt(chStr);
            let totalScore = 0;
            const stopQualities = sortedStops.map(stop => {
                const quality = getChannelQuality(stop, ch);
                totalScore += quality.score;
                return quality;
            });

            results[ch] = {
                totalScore,
                stops: stopQualities,
                isGolden: totalScore === sortedStops.length * 3 && sortedStops.length > 0
            };
        });

        return results;
    }, [state.stops, state.region]);

    const recommendedChannels = useMemo(() => {
        return Object.entries(channelAnalysis)
            .filter(([_, data]) => data.totalScore > 0) // Exclude any with hard blocks
            .sort((a, b) => b[1].totalScore - a[1].totalScore)
            .slice(0, 12) // Top 12 stable channels
            .map(([ch]) => parseInt(ch));
    }, [channelAnalysis]);

    const handleToggleChannel = (ch: number) => {
        setState(prev => {
            const current = prev.optimizedChannelSelections || {};
            const existing = current[ch] || { selected: false, type: 'mic' };
            return {
                ...prev,
                optimizedChannelSelections: {
                    ...current,
                    [ch]: { ...existing, selected: !existing.selected }
                }
            };
        });
    };

    const handleUpdateChannelType = (ch: number, type: 'mic' | 'iem') => {
        setState(prev => {
            const current = prev.optimizedChannelSelections || {};
            const existing = current[ch] || { selected: false, type: 'mic' };
            return {
                ...prev,
                optimizedChannelSelections: {
                    ...current,
                    [ch]: { ...existing, type }
                }
            };
        });
    };

    const handleLockTourPlan = () => {
        const selections = state.optimizedChannelSelections || {};
        const selectedChannels = Object.entries(selections)
            .filter(([_, data]) => data.selected)
            .map(([ch]) => parseInt(ch));

        if (selectedChannels.length === 0) {
            toast.error("Please select at least one channel to lock for the tour.");
            return;
        }

        const newGlobalStates: Record<number, TVChannelState> = {};
        Object.keys(channels).forEach(chStr => {
            const ch = parseInt(chStr);
            const selection = selections[ch];
            if (selection?.selected) {
                newGlobalStates[ch] = selection.type === 'mic' ? 'mic-only' : 'iem-only';
            } else {
                newGlobalStates[ch] = 'blocked';
            }
        });

        setState(prev => ({ ...prev, globalTvChannelStates: newGlobalStates }));
        toast.success(`Locked ${selectedChannels.length} optimized channels for the entire tour!`);
    };

    if (state.stops.length < 2) return null;

    return (
        <Card className="mt-8 border-indigo-500/20 bg-indigo-950/10">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Zap size={16} className="text-amber-400 fill-amber-400" />
                        <CardTitle subtitle="Tour-Wide Strategy">2. Smart Tour Channel Optimizer</CardTitle>
                    </div>
                    <p className="text-[10px] text-slate-400 max-w-xl">
                        Select the best channels for your additional local gear. 
                        The engine will coordinate these around your Global Touring Rack.
                    </p>
                </div>
                <button 
                    onClick={handleLockTourPlan}
                    className={generateButton + " flex items-center gap-2"}
                >
                    <Lock size={12} /> Lock Optimized Plan
                </button>
            </div>

            <div className="overflow-x-auto pb-4">
                <table className="w-full border-collapse">
                    <thead>
                        <tr>
                            <th className="p-2 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5">Channel</th>
                            <th className="p-2 text-center text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5">Select Channel</th>
                            <th className="p-2 text-center text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5">Equipment Type</th>
                            {sortedStops.map((stop, i) => (
                                <th key={stop.id} className="p-2 text-center text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 min-w-[80px]">
                                    <div className="truncate w-20 mx-auto">{stop.location || `Stop ${i+1}`}</div>
                                    <div className="text-[8px] opacity-50 font-mono">{stop.date instanceof Date ? stop.date.toLocaleDateString() : 'No Date'}</div>
                                </th>
                            ))}
                            <th className="p-2 text-right text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5">Stability</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(channelAnalysis)
                            .filter(([chStr]) => recommendedChannels.includes(parseInt(chStr)))
                            .sort((a, b) => b[1].totalScore - a[1].totalScore)
                            .map(([chStr, data]) => {
                                const ch = parseInt(chStr);
                                const isRecommended = recommendedChannels.includes(ch);
                                const selection = (state.optimizedChannelSelections || {})[ch] || { selected: false, type: 'mic' };
                                
                                return (
                                    <tr key={ch} className={`group transition-colors ${selection.selected ? 'bg-indigo-500/10' : 'hover:bg-white/5'}`}>
                                        <td className="p-2 border-b border-white/5">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs font-bold ${selection.selected ? 'text-indigo-400' : 'text-slate-300'}`}>{ch}</span>
                                                {data.isGolden && <Star size={10} className="text-amber-400 fill-amber-400" />}
                                            </div>
                                        </td>
                                        <td className="p-2 border-b border-white/5 text-center">
                                            <button 
                                                onClick={() => handleToggleChannel(ch)}
                                                className={`w-3.5 h-3.5 rounded border transition-all flex items-center justify-center mx-auto ${selection.selected ? 'bg-indigo-500 border-indigo-400 text-white' : 'bg-slate-800 border-slate-700 text-transparent hover:border-indigo-500'}`}
                                            >
                                                <Check size={12} strokeWidth={4} />
                                            </button>
                                        </td>
                                        <td className="p-2 border-b border-white/5 text-center">
                                            <div className="relative inline-block">
                                                <select 
                                                    value={selection.type}
                                                    disabled={!selection.selected}
                                                    onChange={(e) => handleUpdateChannelType(ch, e.target.value as 'mic' | 'iem')}
                                                    className={`appearance-none bg-slate-900 border border-white/10 rounded px-2 py-1 pr-6 text-[10px] font-bold uppercase tracking-wider outline-none transition-all ${!selection.selected ? 'opacity-30' : 'text-indigo-300 border-indigo-500/30 hover:border-indigo-500/50'}`}
                                                >
                                                    <option value="mic">Mic</option>
                                                    <option value="iem">IEM</option>
                                                </select>
                                                <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                                            </div>
                                        </td>
                                        {data.stops.map((q, i) => (
                                            <td key={i} className="p-2 border-b border-white/5 text-center">
                                                <div className="flex flex-col items-center gap-1">
                                                    <div className="relative group/bar">
                                                        <div className={`h-2 w-full min-w-[40px] max-w-[40px] rounded-full ${q.color} shadow-sm cursor-help transition-transform group-hover/bar:scale-y-125`} />
                                                        
                                                        {/* Custom Tooltip */}
                                                        <div className="invisible group-hover/bar:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2.5 bg-slate-900/95 backdrop-blur-sm border border-slate-700 rounded-sm shadow-2xl z-50 w-48 pointer-events-none ring-1 ring-white/10">
                                                            <div className="flex items-center justify-between mb-1.5">
                                                                <span className="text-[10px] font-black text-white uppercase tracking-widest">{q.label}</span>
                                                                <div className={`w-2 h-2 rounded-full ${q.color}`} />
                                                            </div>
                                                            
                                                            {q.erpInfo ? (
                                                                <div className="space-y-1 text-[9px] text-slate-300 font-mono">
                                                                    <div className="flex justify-between border-b border-white/5 pb-1">
                                                                        <span className="text-slate-500 uppercase">Transmitter</span>
                                                                        <span className="text-indigo-300 font-bold truncate ml-2">{q.erpInfo.transmitterName}</span>
                                                                    </div>
                                                                    <div className="flex justify-between border-b border-white/5 pb-1">
                                                                        <span className="text-slate-500 uppercase">Max ERP</span>
                                                                        <span className="text-amber-400 font-bold">{q.erpInfo.maxErp} kW</span>
                                                                    </div>
                                                                    {q.erpInfo.distance && (
                                                                        <div className="flex justify-between">
                                                                            <span className="text-slate-500 uppercase">Distance</span>
                                                                            <span className="text-emerald-400 font-bold">{q.erpInfo.distance} km</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div className="text-[9px] text-slate-500 italic py-1 border-t border-white/5 mt-1">
                                                                    No transmitter data identified for this location.
                                                                </div>
                                                            )}
                                                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-slate-700" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                        ))}
                                        <td className="p-2 border-b border-white/5 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <span className={`text-[10px] font-mono ${data.totalScore > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                    {data.totalScore > 0 ? `+${data.totalScore}` : data.totalScore}
                                                </span>
                                                {isRecommended && <ShieldCheck size={12} className="text-indigo-400" />}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                    </tbody>
                </table>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 p-3 bg-slate-950/50 rounded-md border border-white/5">
                <div className="flex items-center gap-2">
                    <div className="h-2 w-4 bg-emerald-500 rounded-full" />
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Primary</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-2 w-4 bg-emerald-400 rounded-full" />
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Secondary</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-2 w-4 bg-amber-400 rounded-full" />
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Tertiary</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-2 w-4 bg-red-500 rounded-full" />
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Blocked</span>
                </div>
                <div className="ml-auto flex items-center gap-2 text-[9px] text-slate-500 italic">
                    <AlertTriangle size={10} />
                    Recommended channels have zero "Hard Blocks" across the entire tour.
                </div>
            </div>
        </Card>
    );
};

interface TourPlanningTabProps {
    state: TourPlanningState;
    setState: React.Dispatch<React.SetStateAction<TourPlanningState>>;
    customEquipment: EquipmentProfile[];
    equipmentOverrides: Record<string, Partial<Thresholds>>;
    user?: any;
}

const buttonBase = "px-3 py-2 rounded-sm font-semibold uppercase tracking-wide transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 transform active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed text-[10px]";
const primaryButton = `bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-b-4 border-blue-800 hover:border-blue-700 hover:brightness-110 ${buttonBase}`;
const generateButton = `bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 border-b-4 border-amber-700 hover:border-amber-600 hover:brightness-110 shadow-[0_0_20px_rgba(245,158,11,0.2)] ${buttonBase}`;
const secondaryButton = `bg-slate-700 text-slate-200 border-b-4 border-slate-900 hover:border-slate-800 hover:bg-slate-600 ${buttonBase}`;

const ChannelCategorization: React.FC<{
    tvChannelStates: Record<number, TVChannelState>,
    erpData: Record<number, { maxErp: number }>,
    region: 'uk' | 'us'
}> = ({ tvChannelStates, erpData, region }) => {
    const channels = region === 'uk' ? UK_TV_CHANNELS : US_TV_CHANNELS;
    
    const primary: number[] = [];
    const secondary: number[] = [];
    const tertiary: number[] = [];

    Object.keys(channels).forEach(chStr => {
        const ch = parseInt(chStr);
        const state = tvChannelStates[ch] || 'available';
        const erpEntry = erpData?.[ch];

        if (state === 'available') {
            primary.push(ch);
        } else if (state === 'blocked' && erpEntry) {
            const erp = erpEntry.maxErp;
            if (erp <= 1) { // Green bar
                secondary.push(ch);
            } else if (erp > 1 && erp <= 40) { // Amber bar
                tertiary.push(ch);
            }
        }
    });

    return (
        <div className="mt-4 space-y-3 p-3 bg-slate-950/50 rounded-md border border-white/5">
            <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 size={12} className="text-indigo-400" />
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Venue Channel Analysis</span>
            </div>
            {primary.length > 0 && (
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <div className="h-1.5 w-8 bg-emerald-500 rounded-full" />
                        <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Primary Channels (Clear)</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                        {primary.map(ch => <span key={ch} className="text-[10px] font-bold text-white bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-500/30">{ch}</span>)}
                    </div>
                </div>
            )}
            {secondary.length > 0 && (
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <div className="h-1.5 w-8 bg-emerald-400 rounded-full" />
                        <span className="text-[9px] font-black text-emerald-300 uppercase tracking-widest">Secondary Channels (Low ERP)</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                        {secondary.map(ch => <span key={ch} className="text-[10px] font-bold text-white bg-emerald-400/20 px-1.5 py-0.5 rounded border border-emerald-400/30">{ch}</span>)}
                    </div>
                </div>
            )}
            {tertiary.length > 0 && (
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <div className="h-1.5 w-8 bg-amber-400 rounded-full" />
                        <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest">Tertiary Channels (Medium ERP)</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                        {tertiary.map(ch => <span key={ch} className="text-[10px] font-bold text-white bg-amber-400/20 px-1.5 py-0.5 rounded border border-amber-400/30">{ch}</span>)}
                    </div>
                </div>
            )}
            {primary.length === 0 && secondary.length === 0 && tertiary.length === 0 && (
                <div className="text-[9px] text-slate-500 italic">No usable channels identified. Check TV grid lookup.</div>
            )}
        </div>
    );
};

const TourPlanningTab: React.FC<TourPlanningTabProps> = ({ state, setState, customEquipment, equipmentOverrides, user }) => {
    const [isCalculating, setIsCalculating] = useState(false);
    const [calculationProgress, setCalculationProgress] = useState(0);
    const [currentStep, setCurrentStep] = useState(0);
    const [isCalculatingGlobal, setIsCalculatingGlobal] = useState(false);
    const [globalCalculationProgress, setGlobalCalculationProgress] = useState(0);
    const [openExportMenuId, setOpenExportMenuId] = useState<string | null>(null);
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

    const generatePdfForPreview = (profile: 'client-facing' | 'internal-crew', clientDetails?: any) => {
        const doc = new jsPDF('p', 'mm', 'a4');
        const constantFreqs = state.constantSystems.frequencies || [];
        const localFreqs = state.localFrequencies || [];
        const allFreqs = [...constantFreqs, ...localFreqs];
        
        const planData = allFreqs.map(f => {
            const profileData = f.equipmentKey ? db[f.equipmentKey] : null;
            
            // Find the request that generated this frequency
            let req: EquipmentRequest | undefined;
            if (constantFreqs.includes(f)) {
                req = state.constantSystems.micRequests.find(r => r.id === f.sourceRequestId) || 
                      state.constantSystems.iemRequests.find(r => r.id === f.sourceRequestId);
                
                // Fallback to equipmentKey if ID lookup fails
                if (!req && f.equipmentKey) {
                    req = state.constantSystems.micRequests.find(r => r.equipmentKey === f.equipmentKey) || 
                          state.constantSystems.iemRequests.find(r => r.equipmentKey === f.equipmentKey);
                }
            } else {
                // For local frequencies, the ID might be prefixed with 'master-' in the engine
                const targetId = f.sourceRequestId?.startsWith('master-') 
                    ? f.sourceRequestId.replace('master-', '') 
                    : f.sourceRequestId;

                req = state.localRequests.find(r => r.id === targetId || r.equipmentKey === targetId || r.id === f.sourceRequestId);
                
                // Fallback to equipmentKey
                if (!req && f.equipmentKey) {
                    req = state.localRequests.find(r => r.equipmentKey === f.equipmentKey);
                }
            }

            const params = req ? `${req.compatibilityLevel?.toUpperCase() || 'STD'}${req.linearMode ? ' (HD)' : ''}` : 'STD';
            const power = profileData?.type === 'iem' ? '50mW' : '10mW';
            const bandwidth = profileData?.type === 'wmas' ? '6MHz' : '200kHz';

            const getThString = () => {
                const level = req?.compatibilityLevel || 'standard';
                const th = getFinalThresholds({ 
                    equipmentKey: f.equipmentKey, 
                    compatibilityLevel: level,
                    manualThresholds: req?.useManualParams ? {
                        fundamental: Number(req.manualFundamental) || 0.35,
                        twoTone: Number(req.manualTwoTone) || 0.075,
                        threeTone: Number(req.manualThreeTone) || 0.05,
                        fiveTone: 0, sevenTone: 0
                    } : undefined
                }, db, equipmentOverrides);
                
                return `${Math.round(th.fundamental * 1000)}, ${Math.round(th.twoTone * 1000)}, ${Math.round(th.threeTone * 1000)}`;
            };

            return {
                frequency: f.value,
                label: f.label || '-',
                equipment: profileData?.name || 'Generic',
                band: profileData?.band || '-',
                power,
                bandwidth,
                parameters: params,
                thresholds: getThString(),
                stage: constantFreqs.includes(f) ? 'Global Systems' : 'Local Systems',
                type: f.type || 'generic'
            };
        });

        const itineraryData = state.stops.map(s => ({
            location: s.location,
            date: s.date
        }));

        return generateFullCoordinationPdf(doc, 'Tour Frequency Book', planData, user?.branding, clientDetails, profile, itineraryData);
    };

    const steps = [
        { id: 'global', label: 'Global Gear', desc: 'Frequencies Needed For All Venues', icon: Globe },
        { id: 'itinerary', label: 'Itinerary', desc: 'Tour Dates, Venues, and RF Clusters', icon: Calendar },
        { id: 'local', label: 'Local Gear', desc: 'Site-Specific Equipment and TV Channels', icon: MapPin },
        { id: 'review', label: 'Review', desc: 'Calculate and Review Frequencies', icon: CheckCircle2 }
    ];

    const db = useMemo(() => {
        const base: Record<string, EquipmentProfile> = { ...EQUIPMENT_DATABASE };
        customEquipment.forEach(p => { if (p.id) base[p.id] = p; });
        return base;
    }, [customEquipment]);

    const handleAddStop = () => {
        const newStop: TourStop = {
            id: `stop-${Date.now()}`,
            location: 'New Venue',
            date: new Date(),
        };
        setState(prev => ({ ...prev, stops: [...prev.stops, newStop] }));
    };

    const handleRemoveStop = (id: string) => {
        setState(prev => ({
            ...prev,
            stops: (prev.stops || []).filter(s => s.id !== id)
        }));
    };

    const handleUpdateStop = (id: string, field: keyof TourStop, value: any) => {
        setState(prev => ({
            ...prev,
            stops: prev.stops.map(s => s.id === id ? { ...s, [field]: value } : s)
        }));
    };

    const handleUpdateStopTvStates = (stopId: string, states: Record<number, TVChannelState> | ((prev: Record<number, TVChannelState>) => Record<number, TVChannelState>)) => {
        setState(prev => {
            const stop = prev.stops.find(s => s.id === stopId);
            const resolvedStates = typeof states === 'function' ? states(stop?.tvChannelStates || {}) : states;
            return {
                ...prev,
                stops: prev.stops.map(s => s.id === stopId ? { ...s, tvChannelStates: resolvedStates } : s)
            };
        });
    };

    const handleUpdateStopTvErpData = (stopId: string, erpData: any) => {
        handleUpdateStop(stopId, 'tvChannelErpData', erpData);
    };

    const handleStopTvChannelCycle = (stopId: string, channel: number) => {
        const stop = state.stops.find(s => s.id === stopId);
        if (!stop) return;
        const current = stop.tvChannelStates?.[channel] || 'available';
        const states: TVChannelState[] = ['available', 'mic-only', 'iem-only', 'both', 'blocked'];
        const next = states[(states.indexOf(current) + 1) % states.length];
        handleUpdateStopTvStates(stopId, { ...(stop.tvChannelStates || {}), [channel]: next });
    };

    const handleBlockAllStopTvChannels = (stopId: string) => {
        const stop = state.stops.find(s => s.id === stopId);
        if (!stop) return;
        const channels = state.region === 'uk' ? UK_TV_CHANNELS : US_TV_CHANNELS;
        const newStates: Record<number, TVChannelState> = {};
        Object.keys(channels).forEach(ch => newStates[parseInt(ch)] = 'blocked');
        handleUpdateStopTvStates(stopId, newStates);
    };

    const handleClearStopTv = (stopId: string) => {
        handleUpdateStopTvStates(stopId, {});
        handleUpdateStopTvErpData(stopId, {});
    };

    const analyzeCommonChannels = () => {
        const allStops = state.stops;
        if (allStops.length === 0) return null;

        const channels = state.region === 'uk' ? UK_TV_CHANNELS : US_TV_CHANNELS;
        const channelStats: Record<number, { primary: number, secondary: number, tertiary: number }> = {};

        Object.keys(channels).forEach(chStr => {
            const ch = parseInt(chStr);
            channelStats[ch] = { primary: 0, secondary: 0, tertiary: 0 };

            allStops.forEach(stop => {
                const tvStates = stop.tvChannelStates || {};
                const erpData = stop.tvChannelErpData || {};
                const chState = tvStates[ch] || 'available';
                const erp = erpData[ch]?.maxErp || 0;

                if (chState === 'available') {
                    channelStats[ch].primary++;
                } else if (chState === 'blocked') {
                    if (erp <= 1 && erp > 0) {
                        channelStats[ch].secondary++;
                    } else if (erp > 1 && erp <= 40) {
                        channelStats[ch].tertiary++;
                    }
                }
            });
        });

        const totalStops = allStops.length;
        const commonPrimary = Object.entries(channelStats)
            .filter(([_, stats]) => stats.primary === totalStops)
            .map(([ch]) => parseInt(ch));
        
        const commonSecondary = Object.entries(channelStats)
            .filter(([_, stats]) => stats.secondary === totalStops)
            .map(([ch]) => parseInt(ch));

        const commonTertiary = Object.entries(channelStats)
            .filter(([_, stats]) => stats.tertiary === totalStops)
            .map(([ch]) => parseInt(ch));

        // Also "most venues" for primary if none are common across all
        const mostPrimary = Object.entries(channelStats)
            .filter(([_, stats]) => stats.primary >= totalStops * 0.75 && stats.primary < totalStops)
            .map(([ch]) => parseInt(ch));

        return { commonPrimary, commonSecondary, commonTertiary, mostPrimary };
    };

    const applyTourChannels = () => {
        const analysis = analyzeCommonChannels();
        if (!analysis) return;

        const { commonPrimary, commonSecondary, commonTertiary, mostPrimary } = analysis;
        const tourChannels = [...commonPrimary, ...mostPrimary, ...commonSecondary, ...commonTertiary];
        
        if (tourChannels.length === 0) {
            toast.error("No common channels identified across venues.");
            return;
        }

        // We want to block everything EXCEPT these common channels in the global grid
        const allChannels = state.region === 'uk' ? UK_TV_CHANNELS : US_TV_CHANNELS;
        const newGlobalStates: Record<number, TVChannelState> = {};
        
        Object.keys(allChannels).forEach(chStr => {
            const ch = parseInt(chStr);
            if (tourChannels.includes(ch)) {
                newGlobalStates[ch] = 'available';
            } else {
                newGlobalStates[ch] = 'blocked';
            }
        });

        setState(prev => ({ ...prev, globalTvChannelStates: newGlobalStates }));
        toast.success("Tour-wide channel plan applied to Global Gear section.");
    };

    const handleAddLocalRequest = (type: 'mic' | 'iem') => {
        const defaultKey = type === 'iem' ? 'shure-psm1000-g10' : 'shure-ad-g56';
        const newReq: EquipmentRequest = {
            id: `req-${Date.now()}`,
            equipmentKey: defaultKey,
            count: 4,
            compatibilityLevel: 'standard',
            linearMode: false
        };
        setState(prev => ({
            ...prev,
            localRequests: [...prev.localRequests, newReq]
        }));
    };

    const handleUpdateLocalRequest = (id: string, updates: Partial<EquipmentRequest>) => {
        setState(prev => ({
            ...prev,
            localRequests: prev.localRequests.map(r => r.id === id ? { ...r, ...updates } : r)
        }));
    };

    const handleRemoveLocalRequest = (id: string) => {
        setState(prev => ({
            ...prev,
            localRequests: (prev.localRequests || []).filter(r => r.id !== id)
        }));
    };

    const handleUpdateConstantRequest = (type: 'mic' | 'iem', requests: EquipmentRequest[]) => {
        setState(prev => ({
            ...prev,
            constantSystems: {
                ...prev.constantSystems,
                [type === 'mic' ? 'micRequests' : 'iemRequests']: requests,
                frequencies: []
            }
        }));
    };

    const handleUpdateConstantFrequencies = (frequencies: Frequency[]) => {
        setState(prev => ({
            ...prev,
            constantSystems: {
                ...prev.constantSystems,
                frequencies
            }
        }));
    };

    const handleUpdateLocalFrequencies = (frequencies: Frequency[]) => {
        setState(prev => ({
            ...prev,
            localFrequencies: frequencies
        }));
    };

    const toggleConstantLock = (id: string) => {
        setState(prev => ({
            ...prev,
            constantSystems: {
                ...prev.constantSystems,
                frequencies: prev.constantSystems.frequencies?.map(f => f.id === id ? { ...f, locked: !f.locked } : f)
            }
        }));
    };

    const toggleAllConstantLocks = (lock: boolean) => {
        setState(prev => ({
            ...prev,
            constantSystems: {
                ...prev.constantSystems,
                frequencies: prev.constantSystems.frequencies?.map(f => ({ ...f, locked: lock }))
            }
        }));
    };

    const toggleLocalLock = (freqId: string) => {
        setState(prev => ({
            ...prev,
            localFrequencies: prev.localFrequencies.map(f => f.id === freqId ? { ...f, locked: !f.locked } : f)
        }));
    };

    const toggleAllLocalLocks = (lock: boolean) => {
        setState(prev => ({
            ...prev,
            localFrequencies: prev.localFrequencies.map(f => ({ ...f, locked: lock }))
        }));
    };

    const handleCalculateGlobal = async () => {
        setIsCalculatingGlobal(true);
        setGlobalCalculationProgress(0);
        try {
            const globalFreqs = await generateGlobalOnlyFrequencies(
                state,
                db,
                equipmentOverrides,
                (p) => setGlobalCalculationProgress(p)
            );

            setState(prev => ({
                ...prev,
                constantSystems: {
                    ...prev.constantSystems,
                    frequencies: globalFreqs.map(f => ({ ...f, locked: true }))
                }
            }));
            toast.success("Global Touring Frequencies calculated and locked.");
        } catch (error) {
            console.error("Global calculation failed", error);
            toast.error("Global frequency coordination failed. Check your TV grid.");
        } finally {
            setIsCalculatingGlobal(false);
        }
    };

    const handleCalculate = async () => {
        setIsCalculating(true);
        setCalculationProgress(0);
        try {
            const { globalConstantFreqs, localFreqs } = await generateTourFrequencies(
                state,
                db,
                equipmentOverrides,
                (p) => setCalculationProgress(p)
            );

            setState(prev => {
                return {
                    ...prev,
                    localFrequencies: localFreqs,
                    constantSystems: {
                        ...prev.constantSystems,
                        frequencies: globalConstantFreqs
                    }
                };
            });

            setCurrentStep(3);

        } catch (error) {
            console.error("Calculation failed", error);
            toast.error("Frequency coordination failed. Check your constraints.");
        } finally {
            setIsCalculating(false);
        }
    };

    const channels = state.region === 'uk' ? UK_TV_CHANNELS : US_TV_CHANNELS;

    const handleExportPDF = (branded: boolean = false) => {
        const doc = new jsPDF('p', 'mm', 'a4');
        let startY = 20;
        if (branded) {
            startY = generateBrandedPdf(doc, 'Tour Frequency Book', user?.branding);
            doc.setFontSize(10);
            doc.setTextColor(100, 116, 139);
            doc.text(`Region: ${state.region.toUpperCase()}`, 14, startY);
            startY += 10;
        } else {
            doc.setFontSize(22);
            doc.setTextColor(15, 23, 42);
            doc.text('Tour Frequency Book', 14, startY);
            
            doc.setFontSize(10);
            doc.setTextColor(100, 116, 139);
            doc.text(`Generated: ${new Date().toLocaleString()}`, 14, startY + 8);
            doc.text(`Region: ${state.region.toUpperCase()}`, 14, startY + 13);
            startY += 25;
        }

        let currentY = startY;

        if (state.stops.length === 0) {
            doc.text('No tour stops defined.', 14, currentY);
            doc.save(`Tour_Book_Empty.pdf`);
            return;
        }

        state.stops.forEach((stop, index) => {
            // Check if we need a new page before starting a new stop
            if (currentY > 240) {
                doc.addPage();
                currentY = 20;
            }

            doc.setFontSize(16);
            doc.setTextColor(79, 70, 229); // Indigo 600
            doc.text(`${index + 1}. ${stop.location}`, 14, currentY);
            
            doc.setFontSize(10);
            doc.setTextColor(100, 116, 139);
            doc.text(`Date: ${stop.date.toLocaleDateString()}`, 14, currentY + 6);

            const constantFreqs = state.constantSystems.frequencies || [];
            const localFreqs = state.localFrequencies || [];
            const allFreqs = [...constantFreqs, ...localFreqs];

            if (allFreqs.length === 0) {
                doc.setFontSize(9);
                doc.setTextColor(100, 116, 139);
                doc.text('No frequencies calculated for this tour.', 14, currentY + 12);
                currentY += 25;
            } else {
                const tableData = allFreqs.map(f => [
                    f.value.toFixed(3),
                    f.type?.toUpperCase() || 'GENERIC',
                    constantFreqs.includes(f) ? 'GLOBAL' : 'LOCAL',
                    f.locked ? 'LOCKED' : 'OPEN'
                ]);

                autoTable(doc, {
                    startY: currentY + 12,
                    head: [['Frequency (MHz)', 'Type', 'Source', 'Status']],
                    body: tableData,
                    ...getTableStyles(user?.branding?.brandColor, user?.branding),
                    margin: { left: 14, top: 35 },
                    styles: { fontSize: 8, cellPadding: 2 },
                    didDrawPage: (data: any) => {
                        // Call the branding hook if it exists
                        const baseStyles = getTableStyles(user?.branding?.brandColor, user?.branding);
                        if (baseStyles.didDrawPage) {
                            baseStyles.didDrawPage(data);
                        }
                        currentY = data.cursor.y;
                    }
                });

                // @ts-ignore
                currentY = doc.lastAutoTable.finalY + 20;
            }
        });

        doc.save(`Tour_Book_${new Date().toISOString().split('T')[0]}.pdf`);
        toast.success("Tour Book PDF Exported Successfully");
    };

    const handleExportCSV = () => {
        const headers = ['Frequency (MHz)', 'Label', 'Type', 'Equipment', 'Source', 'Status'];
        const rows: string[][] = [];

        const constantFreqs = state.constantSystems.frequencies || [];
        const localFreqs = state.localFrequencies || [];
        
        constantFreqs.forEach(f => {
            const profile = db[f.equipmentKey || 'custom'];
            rows.push([
                f.value.toFixed(3),
                f.label || 'Constant',
                f.type?.toUpperCase() || 'GENERIC',
                profile?.name || f.equipmentKey || 'Unknown',
                'GLOBAL',
                f.locked ? 'LOCKED' : 'OPEN'
            ]);
        });

        localFreqs.forEach(f => {
            const profile = db[f.equipmentKey || 'custom'];
            rows.push([
                f.value.toFixed(3),
                f.label || 'Local',
                f.type?.toUpperCase() || 'GENERIC',
                profile?.name || f.equipmentKey || 'Unknown',
                'LOCAL',
                f.locked ? 'LOCKED' : 'OPEN'
            ]);
        });

        if (rows.length === 0) {
            toast.error("No frequencies to export. Please run a calculation first.");
            return;
        }

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `Tour_Frequencies_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Tour Plan Exported Successfully");
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center bg-slate-900/40 p-2 rounded-md border border-white/5 backdrop-blur-md">
                <div>
                    <h2 className="text-lg font-semibold font-black uppercase tracking-tighter text-white flex items-center gap-2">
                        Tour Planning Engine
                        <InfoTooltip content="Manage RF coordination for multi-location tours. Synchronize global gear across all venues while accounting for local TV channels and site-specific equipment." />
                    </h2>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Multi-Location Frequency Synchronization</p>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={() => handleExportPDF(false)}
                        className={secondaryButton}
                    >
                        Export PDF
                    </button>
                    <button 
                        onClick={handleExportCSV}
                        className={secondaryButton}
                    >
                        Export CSV
                    </button>
                    <select 
                        value={state.region} 
                        onChange={e => setState(prev => ({ ...prev, region: e.target.value as 'uk' | 'us' }))}
                        className="bg-slate-800 border border-slate-700 rounded-sm px-3 py-1 text-[10px] font-black uppercase text-indigo-400 outline-none"
                    >
                        <option value="uk">UK Region (8MHz)</option>
                        <option value="us">US Region (6MHz)</option>
                    </select>
                </div>
            </div>

            <div className="mb-8">
                <div className="flex justify-between items-start relative mx-auto">
                    {/* Connecting Line */}
                    <div className="absolute top-5 left-[10%] right-[10%] h-0.5 bg-slate-800 z-0">
                        <motion.div 
                            className="h-full bg-indigo-500" 
                            initial={{ width: '0%' }}
                            animate={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
                            transition={{ duration: 0.5, ease: "easeInOut" }}
                        />
                    </div>
                    {steps.map((step, index) => {
                        const Icon = step.icon;
                        const isActive = currentStep === index;
                        const isPast = currentStep > index;
                        return (
                            <button 
                                key={step.id}
                                onClick={() => setCurrentStep(index)}
                                className={`relative z-10 flex flex-col items-center gap-2 group w-1/4`}
                            >
                                <motion.div 
                                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${isActive ? 'bg-indigo-600 text-white shadow-[0_0_20px_rgba(79,70,229,0.6)]' : isPast ? 'bg-indigo-500/50 text-white border border-indigo-500/30' : 'bg-slate-800 text-slate-400 border border-white/5 group-hover:bg-slate-700'}`}
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    <Icon size={18} />
                                </motion.div>
                                <div className="hidden md:block text-center mt-2">
                                    <div className={`text-[10px] sm:text-xs font-black uppercase tracking-widest transition-colors ${isActive ? 'text-indigo-400' : 'text-slate-500'}`}>{step.label}</div>
                                    <div className={`text-[10px] mt-1 transition-colors ${isActive ? 'text-slate-300' : 'text-slate-500'}`}>{step.desc}</div>
                                </div>
                            </button>
                        );
                    })}
                </div>
                <div className="mt-6 text-center md:hidden">
                    <div className="text-sm font-black text-indigo-400 uppercase tracking-widest">{steps[currentStep].label}</div>
                    <div className="text-[10px] text-slate-500 mt-1">{steps[currentStep].desc}</div>
                </div>
            </div>

            <div className="relative overflow-hidden">
                {currentStep === 0 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
                    <Card className="border-indigo-500/20">
                        <div className="flex justify-between items-center mb-4">
                            <CardTitle subtitle="Touring Rack">
                                1. Define Global Touring Gear
                                <InfoTooltip content="This is the RF equipment that travels with you in your rack to every venue. These frequencies are calculated FIRST and remain constant across all tour stops." />
                            </CardTitle>
                        </div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-6 bg-slate-950/50 p-3 rounded-sm border border-white/5">
                            <Zap size={10} className="inline mr-2 text-amber-400" />
                            Frequencies for this gear will be 'locked' as constants for the entire tour.
                        </p>
                        <div className="space-y-4">
                            <RequestManager 
                                title="Global Mics" 
                                type="mic" 
                                requests={state.constantSystems.micRequests} 
                                onUpdate={reqs => handleUpdateConstantRequest('mic', reqs)}
                                db={db}
                                overrides={equipmentOverrides}
                            />
                            <RequestManager 
                                title="Global IEMs" 
                                type="iem" 
                                requests={state.constantSystems.iemRequests} 
                                onUpdate={reqs => handleUpdateConstantRequest('iem', reqs)}
                                db={db}
                                overrides={equipmentOverrides}
                            />
                            <ManualFrequencyManager
                                title="Global Manual Mics"
                                type="mic"
                                frequencies={state.constantSystems.frequencies || []}
                                onUpdate={handleUpdateConstantFrequencies}
                                db={db}
                            />
                            <ManualFrequencyManager
                                title="Global Manual IEMs"
                                type="iem"
                                frequencies={state.constantSystems.frequencies || []}
                                onUpdate={handleUpdateConstantFrequencies}
                                db={db}
                            />
                        </div>
                    </Card>
                    <Card>
                        <TvGrid 
                            title="Quad-State TV Grid"
                            subtitle="Base RF Cluster"
                            tvRegion={state.region}
                            setTvRegion={(region) => setState(prev => ({ ...prev, region }))}
                            tvChannelStates={state.globalTvChannelStates || {}}
                            setTvChannelStates={(states) => setState(prev => ({ ...prev, globalTvChannelStates: typeof states === 'function' ? states(prev.globalTvChannelStates || {}) : states }))}
                            tvChannelErpData={state.globalTvChannelErpData}
                            onTvChannelErpDataChange={(data) => setState(prev => ({ ...prev, globalTvChannelErpData: data }))}
                            handleTvChannelCycle={(channel) => {
                                const tvState = (state.globalTvChannelStates || {})[channel] || 'available';
                                const states = ['available', 'mic-only', 'iem-only', 'both', 'blocked'] as TVChannelState[];
                                const next = states[(states.indexOf(tvState) + 1) % states.length];
                                setState(prev => ({
                                    ...prev,
                                    globalTvChannelStates: {
                                        ...(prev.globalTvChannelStates || {}),
                                        [channel]: next
                                    },
                                    constantSystems: {
                                        ...prev.constantSystems,
                                        frequencies: []
                                    }
                                }));
                            }}
                            handleBlockAllTvChannels={() => {
                                const newStates: Record<number, TVChannelState> = {};
                                Object.keys(channels).forEach(ch => {
                                    newStates[parseInt(ch)] = 'blocked';
                                });
                                setState(prev => ({ 
                                    ...prev, 
                                    globalTvChannelStates: newStates,
                                    constantSystems: {
                                        ...prev.constantSystems,
                                        frequencies: []
                                    }
                                }));
                            }}
                            handleClearTv={() => {
                                setState(prev => ({ 
                                    ...prev, 
                                    globalTvChannelStates: {}, 
                                    globalTvChannelErpData: {},
                                    constantSystems: {
                                        ...prev.constantSystems,
                                        frequencies: []
                                    }
                                }));
                            }}
                        />
                    </Card>
                    <div className="flex flex-col md:flex-row justify-between items-center gap-2 mt-6">
                        <div className="flex-1 w-full">
                            {isCalculatingGlobal && (
                                <div className="bg-slate-900 border border-white/10 p-3 rounded-md shadow-sm border border-slate-700/50 w-full">
                                    <div className="flex justify-between items-center mb-1.5">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Global Engine</span>
                                        <span className="text-[9px] font-mono text-slate-400">{Math.round(globalCalculationProgress * 100)}%</span>
                                    </div>
                                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-300"
                                            style={{ width: `${globalCalculationProgress * 100}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                            {state.constantSystems.frequencies?.length > 0 && !isCalculatingGlobal && (
                                <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 px-3 py-2 rounded-sm border border-emerald-500/20">
                                    <CheckCircle2 size={14} />
                                    <span className="text-[10px] font-black uppercase tracking-widest">
                                        {state.constantSystems.frequencies.length} Global Frequencies Calculated & Locked
                                    </span>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-3 shrink-0">
                            <button 
                                onClick={handleCalculateGlobal} 
                                disabled={isCalculatingGlobal}
                                className={generateButton + " px-4"}
                            >
                                {isCalculatingGlobal ? '⚡ Calculating...' : '⚡ Calculate Global Frequencies'}
                            </button>
                            <button 
                                onClick={() => setCurrentStep(1)} 
                                disabled={!state.constantSystems.frequencies?.length || isCalculatingGlobal}
                                className={primaryButton + " disabled:opacity-30 disabled:grayscale"}
                            >
                                Next Step ➔
                            </button>
                        </div>
                    </div>
                </div>
                )}

                {currentStep === 1 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
                    <Card>
                        <div className="flex justify-between items-center mb-6">
                            <CardTitle subtitle="Tour Routing">Itinerary</CardTitle>
                            <button onClick={handleAddStop} className={secondaryButton + " flex items-center gap-1"}><Plus size={12}/> Add Stop</button>
                        </div>
                        <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-700 before:to-transparent">
                            <AnimatePresence>
                            {state.stops.length === 0 && (
                                <motion.div 
                                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                    className="text-center py-8 text-slate-600 text-[10px] uppercase font-black italic opacity-50"
                                >
                                    No stops added yet
                                </motion.div>
                            )}
                            {state.stops.map((stop, index) => (
                                <motion.div 
                                    key={stop.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ duration: 0.3, delay: index * 0.05 }}
                                    className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active"
                                >
                                    {/* Timeline dot */}
                                    <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-slate-950 bg-slate-800 text-slate-400 group-hover:text-indigo-400 group-hover:bg-indigo-900/50 group-hover:border-indigo-500/30 transition-all z-10 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm">
                                        <MapPin size={14} />
                                    </div>
                                    
                                    {/* Card */}
                                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-slate-900/60 border border-white/5 rounded-md p-2 shadow-sm border border-slate-700/50 hover:border-indigo-500/30 transition-all">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-center gap-2">
                                                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-950 px-2 py-0.5 rounded-full">Stop {index + 1}</div>
                                            </div>
                                            <button onClick={() => handleRemoveStop(stop.id)} className="text-red-400/50 hover:text-red-400 transition-colors">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                        <div className="space-y-3">
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1"><MapPin size={10}/> Venue / Location</label>
                                                <input 
                                                    type="text" 
                                                    value={stop.location} 
                                                    onChange={e => handleUpdateStop(stop.id, 'location', e.target.value)}
                                                    className="w-full bg-transparent border-b border-slate-700 hover:border-indigo-500/50 focus:border-indigo-500 px-1 py-1 text-sm font-bold text-white outline-none transition-colors"
                                                    placeholder="e.g. O2 Arena, London"
                                                />
                                            </div>
                                            <div className="grid grid-cols-1 gap-3">
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1"><Calendar size={10}/> Date</label>
                                                    <input 
                                                        type="date" 
                                                        value={stop.date instanceof Date && !isNaN(stop.date.getTime()) ? stop.date.toISOString().split('T')[0] : ''} 
                                                        onChange={e => {
                                                            const newDate = new Date(e.target.value);
                                                            if (!isNaN(newDate.getTime())) {
                                                                handleUpdateStop(stop.id, 'date', newDate);
                                                            }
                                                        }}
                                                        className="w-full bg-slate-950 border border-slate-700 rounded-sm px-2 py-1.5 text-xs text-slate-300 outline-none focus:border-indigo-500 transition-colors"
                                                    />
                                                </div>
                                            </div>

                                            <div className="pt-4 border-t border-white/5">
                                                <TvGrid 
                                                    title={`TV Environment: ${stop.location || 'Venue'}`}
                                                    subtitle="Local TV channels for this specific tour stop"
                                                    tvRegion={state.region}
                                                    tvChannelStates={stop.tvChannelStates || {}}
                                                    setTvChannelStates={(states) => handleUpdateStopTvStates(stop.id, states)}
                                                    tvChannelErpData={stop.tvChannelErpData}
                                                    onTvChannelErpDataChange={(data) => handleUpdateStopTvErpData(stop.id, data)}
                                                    handleTvChannelCycle={(ch) => handleStopTvChannelCycle(stop.id, ch)}
                                                    handleBlockAllTvChannels={() => handleBlockAllStopTvChannels(stop.id)}
                                                    handleClearTv={() => handleClearStopTv(stop.id)}
                                                    className="bg-slate-900/30 p-2 rounded-md border border-white/5"
                                                />
                                                <ChannelCategorization 
                                                    tvChannelStates={stop.tvChannelStates || {}}
                                                    erpData={stop.tvChannelErpData || {}}
                                                    region={state.region}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                            </AnimatePresence>
                        </div>
                    </Card>

                    <SmartTourOptimizer state={state} setState={setState} />

                    <div className="flex justify-end mt-6">
                        <button onClick={() => setCurrentStep(2)} className={primaryButton}>Next Step ➔</button>
                    </div>
                </div>
                )}

                {currentStep === 2 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
                    <Card className="animate-in fade-in zoom-in-95 duration-300">
                        <div className="flex justify-between items-center mb-4">
                            <CardTitle subtitle="Tour-Wide Local Requirements">Local Gear</CardTitle>
                            <span className="text-[9px] font-black text-slate-500 uppercase">Synchronized Across All Venues</span>
                        </div>
                        
                        <div className="space-y-4">
                            <RequestManager 
                                title="Local Mics" 
                                type="mic" 
                                requests={(state.localRequests || []).filter(r => {
                                    const p = db[r.equipmentKey];
                                    return !p || p.type === 'mic' || p.type === 'generic';
                                })} 
                                onUpdate={reqs => {
                                    const others = (state.localRequests || []).filter(r => {
                                        const p = db[r.equipmentKey];
                                        return p && p.type === 'iem';
                                    });
                                    setState(prev => ({ ...prev, localRequests: [...reqs, ...others] }));
                                }}
                                db={db}
                                overrides={equipmentOverrides}
                            />
                            <RequestManager 
                                title="Local IEMs" 
                                type="iem" 
                                requests={(state.localRequests || []).filter(r => {
                                    const p = db[r.equipmentKey];
                                    return p && p.type === 'iem';
                                })} 
                                onUpdate={reqs => {
                                    const others = (state.localRequests || []).filter(r => {
                                        const p = db[r.equipmentKey];
                                        return !p || p.type !== 'iem';
                                    });
                                    setState(prev => ({ ...prev, localRequests: [...others, ...reqs] }));
                                }}
                                db={db}
                                overrides={equipmentOverrides}
                            />
                            <ManualFrequencyManager
                                title="Local Manual Mics"
                                type="mic"
                                frequencies={state.localFrequencies || []}
                                onUpdate={handleUpdateLocalFrequencies}
                                db={db}
                            />
                            <ManualFrequencyManager
                                title="Local Manual IEMs"
                                type="iem"
                                frequencies={state.localFrequencies || []}
                                onUpdate={handleUpdateLocalFrequencies}
                                db={db}
                            />

                            {state.localFrequencies && state.localFrequencies.length > 0 && (
                                <div className="mt-4 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-md">
                                    <div className="flex justify-between items-center mb-2">
                                        <h4 className="text-[9px] font-black text-emerald-400 uppercase">Calculated Local Frequencies</h4>
                                        <div className="flex gap-1">
                                            <button 
                                                onClick={() => toggleAllLocalLocks(true)}
                                                className="p-1 hover:bg-white/5 rounded transition-colors text-slate-500 hover:text-emerald-400"
                                                title="Lock All"
                                            >
                                                <Lock size={10} />
                                            </button>
                                            <button 
                                                onClick={() => toggleAllLocalLocks(false)}
                                                className="p-1 hover:bg-white/5 rounded transition-colors text-slate-500 hover:text-emerald-400"
                                                title="Unlock All"
                                            >
                                                <Unlock size={10} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        {state.localFrequencies.map(f => (
                                            <div key={f.id} className="flex justify-between items-center bg-black/30 p-1.5 rounded border border-white/5 group">
                                                <div className="flex items-center gap-1.5 overflow-hidden">
                                                    <button 
                                                        onClick={() => toggleLocalLock(f.id)}
                                                        className={`transition-colors ${f.locked ? 'text-emerald-400' : 'text-slate-600 opacity-0 group-hover:opacity-100'}`}
                                                    >
                                                        {f.locked ? <Lock size={8} /> : <Unlock size={8} />}
                                                    </button>
                                                    <span className={`text-[10px] font-mono truncate ${f.locked ? 'text-emerald-300' : 'text-white'}`}>{f.value.toFixed(3)}</span>
                                                </div>
                                                <span className="text-[8px] text-slate-500 uppercase shrink-0">{f.type}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>
                    <div className="flex justify-end mt-6">
                        <button onClick={() => setCurrentStep(3)} className={primaryButton}>Next Step ➔</button>
                    </div>
                </div>
                )}

                {currentStep === 3 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
                    <div className="flex justify-center mb-8">
                        <button 
                            onClick={handleCalculate}
                            disabled={isCalculating}
                            className={`${generateButton} shadow-[0_20px_50px_rgba(0,0,0,0.5)] scale-110 md:scale-125 transition-all ${isCalculating ? 'opacity-50 scale-100' : ''} px-12 py-2 text-sm`}
                        >
                            {isCalculating ? '⚡ Calculating...' : '⚡ GENERATE'}
                        </button>
                    </div>

                    {isCalculating && (
                        <div className="bg-slate-900 border border-white/10 p-2 rounded-md shadow-2xl max-w-md mx-auto mb-8">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-black uppercase tracking-widest text-indigo-400">Coordination Engine</span>
                                <span className="text-xs font-mono text-slate-400">{Math.round(calculationProgress * 100)}%</span>
                            </div>
                            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-300"
                                    style={{ width: `${calculationProgress * 100}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {(!isCalculating && (state.constantSystems.frequencies?.length > 0 || state.localFrequencies?.length > 0)) && (
                        <>
                            <Card className="border-indigo-500/30 bg-indigo-500/5 mb-6">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 mb-6">
                                    <div>
                                        <CardTitle subtitle="Cross-Venue Analysis">Tour-Wide Channel Strategy</CardTitle>
                                        <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-1">Identifying common spectrum across all {state.stops.length} venues</p>
                                    </div>
                                    <button 
                                        onClick={applyTourChannels}
                                        className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-sm border-b-4 border-indigo-800 transition-all active:translate-y-0.5 shadow-sm border border-slate-700/50 shadow-indigo-500/20"
                                    >
                                        Apply to Global Plan
                                    </button>
                                </div>

                                {(() => {
                                    const analysis = analyzeCommonChannels();
                                    if (!analysis) return <div className="text-xs text-slate-500 italic">No venues entered to analyze.</div>;
                                    const { commonPrimary, commonSecondary, commonTertiary, mostPrimary } = analysis;

                                    return (
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-2 w-8 bg-emerald-500 rounded-full" />
                                                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Common Primary</span>
                                                </div>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {commonPrimary.length > 0 ? commonPrimary.map(ch => (
                                                        <span key={ch} className="text-xs font-bold text-white bg-emerald-500/20 px-2 py-1 rounded border border-emerald-500/30">{ch}</span>
                                                    )) : <span className="text-[10px] text-slate-500 italic">None found across all venues</span>}
                                                </div>
                                                {mostPrimary.length > 0 && (
                                                    <div className="mt-2">
                                                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">Most Venues (75%+)</span>
                                                        <div className="flex flex-wrap gap-1">
                                                            {mostPrimary.map(ch => <span key={ch} className="text-[9px] font-bold text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-white/5">{ch}</span>)}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-2 w-8 bg-emerald-400 rounded-full" />
                                                    <span className="text-[10px] font-black text-emerald-300 uppercase tracking-widest">Common Secondary</span>
                                                </div>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {commonSecondary.length > 0 ? commonSecondary.map(ch => (
                                                        <span key={ch} className="text-xs font-bold text-white bg-emerald-400/20 px-2 py-1 rounded border border-emerald-400/30">{ch}</span>
                                                    )) : <span className="text-[10px] text-slate-500 italic">None found across all venues</span>}
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-2 w-8 bg-amber-400 rounded-full" />
                                                    <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Common Tertiary</span>
                                                </div>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {commonTertiary.length > 0 ? commonTertiary.map(ch => (
                                                        <span key={ch} className="text-xs font-bold text-white bg-amber-400/20 px-2 py-1 rounded border border-amber-400/30">{ch}</span>
                                                    )) : <span className="text-[10px] text-slate-500 italic">None found across all venues</span>}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </Card>

                            <Card>
                                <div className="flex justify-between items-center mb-4">
                                    <CardTitle subtitle="Calculated Frequencies">Global Transmits</CardTitle>
                                    <div className="flex items-center gap-2">
                                        <div className="flex gap-1 bg-slate-900/50 p-1 rounded-sm border border-white/5">
                                            <button 
                                                onClick={() => toggleAllConstantLocks(true)}
                                                className="p-1.5 hover:bg-emerald-500/20 rounded transition-all text-slate-500 hover:text-emerald-400 border border-transparent hover:border-emerald-500/30"
                                                title="Lock All"
                                            >
                                                <Lock size={12} />
                                            </button>
                                            <button 
                                                onClick={() => toggleAllConstantLocks(false)}
                                                className="p-1.5 hover:bg-rose-500/20 rounded transition-all text-slate-500 hover:text-rose-400 border border-transparent hover:border-rose-500/30"
                                                title="Unlock All"
                                            >
                                                <Unlock size={12} />
                                            </button>
                                        </div>
                                        
                                        <div className="relative">
                                            <button 
                                                onClick={() => setOpenExportMenuId(openExportMenuId === 'global' ? null : 'global')}
                                                className={`${secondaryButton} flex items-center gap-1`}
                                            >
                                                Export WWB <span className="text-[8px] opacity-60">▼</span>
                                            </button>
                                            
                                            {openExportMenuId === 'global' && (
                                                <div className="absolute top-full right-0 mt-2 bg-slate-800 border border-indigo-500/40 rounded-md shadow-2xl z-[120] overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200 divide-y divide-white/5 min-w-[180px]">
                                                    <div className="bg-indigo-500/15 p-2">
                                                        <div className="px-2 py-1.5 flex items-center gap-2 mb-2 border-b border-indigo-500/20">
                                                            <span className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.1em]">WWB Export</span>
                                                        </div>
                                                        <div className="flex flex-col gap-1.5 max-h-[300px] overflow-y-auto custom-scrollbar">
                                                            <button 
                                                                onClick={() => {
                                                                    setOpenExportMenuId(null);
                                                                    const freqs = state.constantSystems.frequencies || [];
                                                                    if (freqs.length === 0) {
                                                                        toast.error("No frequencies to export.");
                                                                        return;
                                                                    }
                                                                    
                                                                    let csv = "Frequency,Name,Type,Band,RF Profile\n";
                                                                    const filename = `global_gear_wwb_${new Date().toISOString().slice(0, 10)}`;
                                                                    
                                                                    freqs.sort((a, b) => a.value - b.value).forEach(f => {
                                                                        const profile = db[f.equipmentKey || 'custom'];
                                                                        const wwbType = f.type === 'iem' ? 'In-ear Monitor' : 'Frequency';
                                                                        const cleanedProfile = profile?.name.replace(/^Shure\s+/i, '').replace(/\s*\(.*?\)/g, '').trim() || 'Generic';
                                                                        const label = f.label || 'Generated CH';
                                                                        csv += `${f.value.toFixed(3)},"${label}","${wwbType}","${profile?.band.split(' ')[0] || 'Custom'}","${cleanedProfile}"\n`;
                                                                    });
                                                                    
                                                                    const blob = new Blob([csv], { type: 'text/csv' });
                                                                    const url = URL.createObjectURL(blob);
                                                                    const a = document.createElement('a'); a.href = url; a.download = `${filename}.csv`; a.click();
                                                                    toast.success("Global Gear WWB Exported Successfully");
                                                                }}
                                                                className="w-full text-left px-3 py-2.5 hover:bg-indigo-600 rounded bg-indigo-500/30 text-[9px] font-black text-white uppercase tracking-tighter transition-all border border-indigo-400/20 shadow-sm"
                                                            >
                                                                &bull; Full Global List
                                                            </button>
                                                            {Array.from(new Set((state.constantSystems.frequencies || []).map(f => f.equipmentKey).filter(Boolean))).map(key => {
                                                                const profile = db[key as string];
                                                                const count = (state.constantSystems.frequencies || []).filter(f => f.equipmentKey === key).length;
                                                                return (
                                                                    <button 
                                                                        key={key}
                                                                        onClick={() => {
                                                                            setOpenExportMenuId(null);
                                                                            const freqs = (state.constantSystems.frequencies || []).filter(f => f.equipmentKey === key);
                                                                            
                                                                            let csv = "Frequency,Name,Type,Band,RF Profile\n";
                                                                            const filename = `global_${key}_wwb_${new Date().toISOString().slice(0, 10)}`;
                                                                            
                                                                            freqs.sort((a, b) => a.value - b.value).forEach(f => {
                                                                                const profile = db[f.equipmentKey || 'custom'];
                                                                                const wwbType = f.type === 'iem' ? 'In-ear Monitor' : 'Frequency';
                                                                                const cleanedProfile = profile?.name.replace(/^Shure\s+/i, '').replace(/\s*\(.*?\)/g, '').trim() || 'Generic';
                                                                                const label = f.label || 'Generated CH';
                                                                                csv += `${f.value.toFixed(3)},"${label}","${wwbType}","${profile?.band.split(' ')[0] || 'Custom'}","${cleanedProfile}"\n`;
                                                                            });
                                                                            
                                                                            const blob = new Blob([csv], { type: 'text/csv' });
                                                                            const url = URL.createObjectURL(blob);
                                                                            const a = document.createElement('a'); a.href = url; a.download = `${filename}.csv`; a.click();
                                                                            toast.success(`${profile?.name || key} WWB Exported Successfully`);
                                                                        }}
                                                                        className="w-full text-left px-3 py-2.5 hover:bg-slate-700 rounded bg-slate-950/60 border border-white/10 text-[9px] font-bold text-indigo-200 uppercase tracking-tighter transition-all"
                                                                    >
                                                                        &bull; {profile?.name || key} ({count} CH)
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        
                                        <button onClick={handleExportCSV} className={secondaryButton}>Export CSV</button>
                                        <button onClick={() => handleExportPDF(false)} className={secondaryButton}>Export PDF</button>
                                        <button onClick={() => setIsPreviewModalOpen(true)} className={secondaryButton}>Company PDF Report</button>
                                    </div>
                                </div>
                                {(!state.constantSystems.frequencies || state.constantSystems.frequencies.length === 0) ? (
                                    <div className="text-center p-8 text-slate-500 text-sm">No global frequencies calculated yet.</div>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                                        {state.constantSystems.frequencies.map(f => (
                                            <div key={f.id} className="bg-slate-800/50 border border-white/5 rounded p-2 flex flex-col items-center justify-center relative group">
                                                <button 
                                                    onClick={() => toggleConstantLock(f.id)}
                                                    className={`absolute top-1 left-1 p-1.5 rounded-md transition-all ${f.locked ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-slate-900/40 text-slate-400 border border-white/10 opacity-50 group-hover:opacity-100 hover:bg-indigo-500/20 hover:text-indigo-400 hover:border-indigo-500/30'}`}
                                                    title={f.locked ? "Unlock Frequency" : "Lock Frequency"}
                                                >
                                                    {f.locked ? <Lock size={12} /> : <Unlock size={12} />}
                                                </button>
                                                <div className="absolute top-1 right-1 text-[8px] font-bold text-slate-500 uppercase">{f.type || 'GENERIC'}</div>
                                                <div className={`text-xs font-bold mt-1 ${f.locked ? 'text-indigo-300' : 'text-indigo-400'}`}>{f.value.toFixed(3)}</div>
                                                <div className="text-[9px] text-slate-400 truncate w-full text-center">{f.label || 'Constant'}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </Card>

                            <Card>
                                <div className="flex justify-between items-center mb-4">
                                    <CardTitle subtitle="Calculated Frequencies">Local Transmits</CardTitle>
                                    <div className="flex items-center gap-2">
                                        <div className="flex gap-1 bg-slate-900/50 p-1 rounded-sm border border-white/5">
                                            <button 
                                                onClick={() => toggleAllLocalLocks(true)}
                                                className="p-1.5 hover:bg-emerald-500/20 rounded transition-all text-slate-500 hover:text-emerald-400 border border-transparent hover:border-emerald-500/30"
                                                title="Lock All"
                                            >
                                                <Lock size={12} />
                                            </button>
                                            <button 
                                                onClick={() => toggleAllLocalLocks(false)}
                                                className="p-1.5 hover:bg-rose-500/20 rounded transition-all text-slate-500 hover:text-rose-400 border border-transparent hover:border-rose-500/30"
                                                title="Unlock All"
                                            >
                                                <Unlock size={12} />
                                            </button>
                                        </div>
                                        
                                        <div className="relative">
                                            <button 
                                                onClick={() => setOpenExportMenuId(openExportMenuId === 'local' ? null : 'local')}
                                                className={`${secondaryButton} flex items-center gap-1`}
                                            >
                                                Export WWB <span className="text-[8px] opacity-60">▼</span>
                                            </button>
                                            
                                            {openExportMenuId === 'local' && (
                                                <div className="absolute top-full right-0 mt-2 bg-slate-800 border border-indigo-500/40 rounded-md shadow-2xl z-[120] overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200 divide-y divide-white/5 min-w-[180px]">
                                                    <div className="bg-indigo-500/15 p-2">
                                                        <div className="px-2 py-1.5 flex items-center gap-2 mb-2 border-b border-indigo-500/20">
                                                            <span className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.1em]">WWB Export</span>
                                                        </div>
                                                        <div className="flex flex-col gap-1.5 max-h-[300px] overflow-y-auto custom-scrollbar">
                                                            <button 
                                                                onClick={() => {
                                                                    setOpenExportMenuId(null);
                                                                    const freqs = state.localFrequencies || [];
                                                                    if (freqs.length === 0) {
                                                                        toast.error("No frequencies to export.");
                                                                        return;
                                                                    }
                                                                    
                                                                    let csv = "Frequency,Name,Type,Band,RF Profile\n";
                                                                    const filename = `local_gear_wwb_${new Date().toISOString().slice(0, 10)}`;
                                                                    
                                                                    freqs.sort((a, b) => a.value - b.value).forEach(f => {
                                                                        const profile = db[f.equipmentKey || 'custom'];
                                                                        const wwbType = f.type === 'iem' ? 'In-ear Monitor' : 'Frequency';
                                                                        const cleanedProfile = profile?.name.replace(/^Shure\s+/i, '').replace(/\s*\(.*?\)/g, '').trim() || 'Generic';
                                                                        const label = f.label || 'Generated CH';
                                                                        csv += `${f.value.toFixed(3)},"${label}","${wwbType}","${profile?.band.split(' ')[0] || 'Custom'}","${cleanedProfile}"\n`;
                                                                    });
                                                                    
                                                                    const blob = new Blob([csv], { type: 'text/csv' });
                                                                    const url = URL.createObjectURL(blob);
                                                                    const a = document.createElement('a'); a.href = url; a.download = `${filename}.csv`; a.click();
                                                                    toast.success("Local Gear WWB Exported Successfully");
                                                                }}
                                                                className="w-full text-left px-3 py-2.5 hover:bg-indigo-600 rounded bg-indigo-500/30 text-[9px] font-black text-white uppercase tracking-tighter transition-all border border-indigo-400/20 shadow-sm"
                                                            >
                                                                &bull; Full Local List
                                                            </button>
                                                            {Array.from(new Set((state.localFrequencies || []).map(f => f.equipmentKey).filter(Boolean))).map(key => {
                                                                const profile = db[key as string];
                                                                const count = (state.localFrequencies || []).filter(f => f.equipmentKey === key).length;
                                                                return (
                                                                    <button 
                                                                        key={key}
                                                                        onClick={() => {
                                                                            setOpenExportMenuId(null);
                                                                            const freqs = (state.localFrequencies || []).filter(f => f.equipmentKey === key);
                                                                            
                                                                            let csv = "Frequency,Name,Type,Band,RF Profile\n";
                                                                            const filename = `local_${key}_wwb_${new Date().toISOString().slice(0, 10)}`;
                                                                            
                                                                            freqs.sort((a, b) => a.value - b.value).forEach(f => {
                                                                                const profile = db[f.equipmentKey || 'custom'];
                                                                                const wwbType = f.type === 'iem' ? 'In-ear Monitor' : 'Frequency';
                                                                                const cleanedProfile = profile?.name.replace(/^Shure\s+/i, '').replace(/\s*\(.*?\)/g, '').trim() || 'Generic';
                                                                                const label = f.label || 'Generated CH';
                                                                                csv += `${f.value.toFixed(3)},"${label}","${wwbType}","${profile?.band.split(' ')[0] || 'Custom'}","${cleanedProfile}"\n`;
                                                                            });
                                                                            
                                                                            const blob = new Blob([csv], { type: 'text/csv' });
                                                                            const url = URL.createObjectURL(blob);
                                                                            const a = document.createElement('a'); a.href = url; a.download = `${filename}.csv`; a.click();
                                                                            toast.success(`${profile?.name || key} WWB Exported Successfully`);
                                                                        }}
                                                                        className="w-full text-left px-3 py-2.5 hover:bg-slate-700 rounded bg-slate-950/60 border border-white/10 text-[9px] font-bold text-indigo-200 uppercase tracking-tighter transition-all"
                                                                    >
                                                                        &bull; {profile?.name || key} ({count} CH)
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {(!state.localFrequencies || state.localFrequencies.length === 0) ? (
                                    <div className="text-center p-8 text-slate-500 text-sm">No local frequencies calculated yet.</div>
                                ) : (() => {
                                    const localMics = state.localFrequencies.filter(f => f.type !== 'iem');
                                    const localIems = state.localFrequencies.filter(f => f.type === 'iem');
                                    return (
                                        <div className="space-y-6">
                                            <div>
                                                <div className="flex items-center justify-between mb-3 pb-1 border-b border-indigo-500/10">
                                                    <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                                                        <span>🎤</span> Local Mics
                                                    </h4>
                                                    <span className="text-[10px] text-slate-400 font-mono">{localMics.length} CH</span>
                                                </div>
                                                {localMics.length === 0 ? (
                                                    <div className="text-slate-500 text-xs italic p-2 text-center bg-slate-900/20 rounded-sm">No local mic frequencies calculated.</div>
                                                ) : (
                                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                                                        {localMics.map(f => (
                                                            <div key={f.id} className="bg-slate-800/50 border border-white/5 rounded p-2 flex flex-col items-center justify-center relative group">
                                                                <button 
                                                                    onClick={() => toggleLocalLock(f.id)}
                                                                    className={`absolute top-1 left-1 p-1.5 rounded-md transition-all ${f.locked ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-900/40 text-slate-400 border border-white/10 opacity-50 group-hover:opacity-100 hover:bg-emerald-500/20 hover:text-emerald-400 hover:border-emerald-500/30'}`}
                                                                    title={f.locked ? "Unlock Frequency" : "Lock Frequency"}
                                                                >
                                                                    {f.locked ? <Lock size={12} /> : <Unlock size={12} />}
                                                                </button>
                                                                <div className="absolute top-1 right-1 text-[8px] font-bold text-slate-500 uppercase">{f.type || 'GENERIC'}</div>
                                                                <div className={`text-xs font-bold mt-1 ${f.locked ? 'text-emerald-300' : 'text-emerald-400'}`}>{f.value.toFixed(3)}</div>
                                                                <div className="text-[9px] text-slate-400 truncate w-full text-center">{f.label || 'Local'}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            <div>
                                                <div className="flex items-center justify-between mb-3 pb-1 border-b border-pink-500/10">
                                                    <h4 className="text-[10px] font-black text-pink-400 uppercase tracking-widest flex items-center gap-1.5">
                                                        <span>🎧</span> Local IEMs
                                                    </h4>
                                                    <span className="text-[10px] text-slate-400 font-mono">{localIems.length} CH</span>
                                                </div>
                                                {localIems.length === 0 ? (
                                                    <div className="text-slate-500 text-xs italic p-2 text-center bg-slate-900/20 rounded-sm">No local IEM frequencies calculated.</div>
                                                ) : (
                                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                                                        {localIems.map(f => (
                                                            <div key={f.id} className="bg-slate-800/50 border border-white/5 rounded p-2 flex flex-col items-center justify-center relative group">
                                                                <button 
                                                                    onClick={() => toggleLocalLock(f.id)}
                                                                    className={`absolute top-1 left-1 p-1.5 rounded-md transition-all ${f.locked ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-900/40 text-slate-400 border border-white/10 opacity-50 group-hover:opacity-100 hover:bg-emerald-500/20 hover:text-emerald-400 hover:border-emerald-500/30'}`}
                                                                    title={f.locked ? "Unlock Frequency" : "Lock Frequency"}
                                                                >
                                                                    {f.locked ? <Lock size={12} /> : <Unlock size={12} />}
                                                                </button>
                                                                <div className="absolute top-1 right-1 text-[8px] font-bold text-slate-500 uppercase">{f.type || 'GENERIC'}</div>
                                                                <div className={`text-xs font-bold mt-1 ${f.locked ? 'text-emerald-300' : 'text-emerald-400'}`}>{f.value.toFixed(3)}</div>
                                                                <div className="text-[9px] text-slate-400 truncate w-full text-center">{f.label || 'Local'}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </Card>
                        </>
                    )}
                </div>
                )}
            </div>
            
            <PdfPreviewModal 
                isOpen={isPreviewModalOpen}
                onClose={() => setIsPreviewModalOpen(false)}
                generatePdf={generatePdfForPreview}
                filename={`tour_rf_plan_${new Date().toISOString().slice(0, 10)}`}
            />

            {currentStep === 3 && (
                <motion.button
                    drag
                    dragMomentum={false}
                    onClick={() => { if (!isCalculating) handleCalculate(); }}
                    disabled={isCalculating}
                    className={`fixed bottom-12 right-12 z-[1000] cursor-grab active:cursor-grabbing shadow-2xl flex items-center justify-center gap-3 py-3 px-4 rounded-md font-black uppercase tracking-widest transition-colors border-b-4 ring-2 text-sm ${isCalculating ? 'bg-slate-800 text-slate-500 border-slate-900 ring-slate-800/50 shadow-none' : 'bg-yellow-500 text-slate-900 border-yellow-700 hover:bg-yellow-400 ring-yellow-400/50 shadow-yellow-500/20'}`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                >
                    {isCalculating ? (
                        <><span className="w-3.5 h-3.5 border-4 border-slate-500/20 border-t-slate-500 rounded-full animate-spin"></span>CALCULATING...</>
                    ) : (
                        <><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> GENERATE</>
                    )}
                </motion.button>
            )}
        </div>
    );
};

// Re-using RequestManager from FestivalCoordinationTab but slightly adapted if needed
// For simplicity, I'll copy the logic here or import it if it was exported.
// Since it wasn't exported, I'll define a simplified version or copy it.

const RequestManager: React.FC<{
    requests: EquipmentRequest[],
    onUpdate: (requests: EquipmentRequest[]) => void,
    db: Record<string, EquipmentProfile>,
    overrides: Record<string, Partial<Thresholds>>,
    title: string,
    type: 'mic' | 'iem'
}> = ({ requests, onUpdate, db, overrides, title, type }) => {
    const handleAdd = () => {
        const defaultKey = type === 'iem' ? 'shure-psm1000-g10' : 'shure-ad-g56';
        onUpdate([...requests, { id: `req-${Date.now()}-${Math.random()}`, equipmentKey: defaultKey, count: 4, compatibilityLevel: 'standard', linearMode: false, type }]);
    };
    const handleRemove = (id: string) => onUpdate(requests.filter(r => r.id !== id));
    
    const handleFieldChange = (id: string, field: keyof EquipmentRequest, value: any) => {
        onUpdate(requests.map(r => {
            if (r.id !== id) return r;
            let updated = { ...r, [field]: value, type }; // Ensure type is preserved/set
            
            if (field === 'equipmentKey') {
                const profile = db[value as string];
                if (profile && profile.recommendedThresholds?.threeTone !== 0) {
                    updated.linearMode = false;
                }
            }

            if (field === 'useManualParams' && value === true) {
                const standardTh = getFinalThresholds({ equipmentKey: r.equipmentKey, compatibilityLevel: 'standard' }, db, overrides);
                if (updated.manualFundamental === undefined) updated.manualFundamental = standardTh.fundamental;
                if (updated.manualTwoTone === undefined) updated.manualTwoTone = standardTh.twoTone;
                if (updated.manualThreeTone === undefined) updated.manualThreeTone = standardTh.threeTone;
            }
            return updated;
        }));
    };

    return (
        <div className="space-y-3">
            <div className="flex justify-between items-center mb-1 px-1">
                <h5 className={`text-[10px] font-black uppercase tracking-widest ${type === 'mic' ? 'text-emerald-400' : 'text-rose-400'}`}>{title}</h5>
                <button onClick={handleAdd} className={`text-[9px] px-2 py-0.5 rounded font-bold transition-all border ${type === 'mic' ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-600' : 'bg-rose-600/20 text-rose-300 border-rose-500/30 hover:bg-rose-600'} hover:text-white`}>+ Add</button>
            </div>
            <div className="space-y-2">
                {requests.map(req => {
                    const activeTh = getFinalThresholds({ equipmentKey: req.equipmentKey, compatibilityLevel: req.compatibilityLevel }, db, overrides);
                    return (
                        <div key={req.id} className="bg-slate-950/40 p-2 rounded-md border border-white/5 space-y-2">
                            <div className="grid grid-cols-[1fr,40px,auto] gap-2 items-center">
                                <select value={req.equipmentKey} onChange={e => handleFieldChange(req.id, 'equipmentKey', e.target.value)} className="bg-slate-950 border border-slate-700 rounded px-1 py-1 text-[10px] text-slate-200 outline-none">
                                    {(Object.entries(db) as [string, EquipmentProfile][])
                                        .filter(([k, p]) => {
                                            const pType = p.type || 'generic';
                                            return pType === type || pType === 'generic' || k === 'custom';
                                        })
                                        .map(([k, p]) => <option key={k} value={k}>{p.name} ({p.band})</option>)}
                                </select>
                                <input type="number" value={req.count} onChange={e => handleFieldChange(req.id, 'count', parseInt(e.target.value) || 0)} className={`bg-slate-950 border border-slate-700 rounded px-1 py-1 text-[10px] font-bold text-center ${type === 'mic' ? 'text-emerald-400' : 'text-rose-400'}`} />
                                <button onClick={() => handleRemove(req.id)} className="text-red-400 hover:text-red-300 font-bold text-xs px-1">&times;</button>
                            </div>

                            <div className="flex items-center justify-between gap-2 px-1">
                                <div className="flex gap-3">
                                    {db[req.equipmentKey]?.recommendedThresholds?.threeTone === 0 && (
                                        <label className="flex items-center gap-2 cursor-pointer group/lin">
                                            <span className={`text-[8px] font-black uppercase tracking-tighter ${req.linearMode ? 'text-cyan-400' : 'text-slate-600'}`}>HD Mode</span>
                                            <input type="checkbox" checked={req.linearMode} onChange={e => handleFieldChange(req.id, 'linearMode', e.target.checked)} className="w-3 h-3 accent-cyan-500" />
                                        </label>
                                    )}
                                    <label className="flex items-center gap-2 cursor-pointer group/bespoke">
                                        <span className={`text-[8px] font-black uppercase tracking-tighter ${req.useManualParams ? 'text-amber-400' : 'text-slate-600'}`}>Bespoke</span>
                                        <input type="checkbox" checked={req.useManualParams} onChange={e => handleFieldChange(req.id, 'useManualParams', e.target.checked)} className="w-3 h-3 accent-amber-500" />
                                    </label>
                                </div>
                                <select 
                                    value={req.compatibilityLevel} 
                                    onChange={e => handleFieldChange(req.id, 'compatibilityLevel', e.target.value)} 
                                    disabled={req.useManualParams}
                                    className="bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-[9px] text-indigo-300 font-bold uppercase tracking-tighter disabled:opacity-30 outline-none"
                                >
                                    <option value="standard">Standard</option>
                                    <option value="aggressive">Aggressive</option>
                                    <option value="robust">Robust</option>
                                </select>
                            </div>

                            {!req.useManualParams && (
                                <div className="flex justify-end gap-3 px-1 pt-1 border-t border-white/5 opacity-70">
                                    <div className="flex items-center gap-1">
                                        <span className="text-[7px] text-slate-500 uppercase font-bold">Fund</span>
                                        <span className="text-[9px] text-indigo-300 font-mono">{activeTh.fundamental.toFixed(3)}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="text-[7px] text-slate-500 uppercase font-bold">2-Tone</span>
                                        <span className="text-[9px] text-indigo-300 font-mono">{activeTh.twoTone.toFixed(3)}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="text-[7px] text-slate-500 uppercase font-bold">3-Tone</span>
                                        <span className="text-[9px] text-indigo-300 font-mono">{activeTh.threeTone.toFixed(3)}</span>
                                    </div>
                                </div>
                            )}

                            {req.useManualParams && (
                                <div className="grid grid-cols-3 gap-1 px-1 pt-1 border-t border-white/5">
                                    <div className="space-y-0.5">
                                        <label className="text-[7px] text-slate-500 uppercase font-bold">Fund</label>
                                        <input 
                                            type="number" step="0.025" 
                                            value={req.manualFundamental} 
                                            onChange={e => handleFieldChange(req.id, 'manualFundamental', parseFloat(e.target.value))}
                                            className="w-full bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-[9px] text-amber-200 font-mono"
                                        />
                                    </div>
                                    <div className="space-y-0.5">
                                        <label className="text-[7px] text-slate-500 uppercase font-bold">2-Tone</label>
                                        <input 
                                            type="number" step="0.025" 
                                            value={req.manualTwoTone} 
                                            onChange={e => handleFieldChange(req.id, 'manualTwoTone', parseFloat(e.target.value))}
                                            className="w-full bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-[9px] text-amber-200 font-mono"
                                        />
                                    </div>
                                    <div className="space-y-0.5">
                                        <label className="text-[7px] text-slate-500 uppercase font-bold">3-Tone</label>
                                        <input 
                                            type="number" step="0.025" 
                                            value={req.manualThreeTone} 
                                            onChange={e => handleFieldChange(req.id, 'manualThreeTone', parseFloat(e.target.value))}
                                            className="w-full bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-[9px] text-amber-200 font-mono"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const ManualFrequencyManager: React.FC<{
    frequencies: Frequency[],
    onUpdate: (frequencies: Frequency[]) => void,
    db: Record<string, EquipmentProfile>,
    title: string,
    type: 'mic' | 'iem'
}> = ({ frequencies, onUpdate, db, title, type }) => {
    const handleAdd = () => {
        const defaultKey = type === 'iem' ? 'shure-psm1000-g10' : 'shure-ad-g56';
        onUpdate([...frequencies, { 
            id: `manual-${Date.now()}-${Math.random()}`, 
            value: 470.000, 
            equipmentKey: defaultKey, 
            type, 
            locked: true,
            label: `Manual ${type === 'mic' ? 'Mic' : 'IEM'}`,
            compatibilityLevel: 'standard'
        }]);
    };
    
    const handleRemove = (id: string) => onUpdate(frequencies.filter(f => f.id !== id));
    
    const handleFieldChange = (id: string, field: keyof Frequency, value: any) => {
        onUpdate(frequencies.map(f => f.id === id ? { ...f, [field]: value } : f));
    };

    const relevantFreqs = frequencies.filter(f => f.type === type && f.locked && f.id.startsWith('manual-'));

    return (
        <div className="space-y-3">
            <div className="flex justify-between items-center mb-1 px-1">
                <h5 className={`text-[10px] font-black uppercase tracking-widest ${type === 'mic' ? 'text-emerald-400' : 'text-rose-400'}`}>{title}</h5>
                <button onClick={handleAdd} className={`text-[9px] px-2 py-0.5 rounded font-bold transition-all border ${type === 'mic' ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-600' : 'bg-rose-600/20 text-rose-300 border-rose-500/30 hover:bg-rose-600'} hover:text-white`}>+ Add Manual</button>
            </div>
            <div className="space-y-2">
                {relevantFreqs.map(freq => (
                    <div key={freq.id} className="bg-slate-950/40 p-2 rounded-md border border-white/5 space-y-2">
                        <div className="grid grid-cols-[1fr,60px,auto] gap-2 items-center">
                            <select value={freq.equipmentKey} onChange={e => handleFieldChange(freq.id, 'equipmentKey', e.target.value)} className="bg-slate-950 border border-slate-700 rounded px-1 py-1 text-[10px] text-slate-200 outline-none">
                                {(Object.entries(db) as [string, EquipmentProfile][])
                                    .filter(([k, p]) => {
                                        const pType = p.type || 'generic';
                                        return pType === type || pType === 'generic' || k === 'custom';
                                    })
                                    .map(([k, p]) => <option key={k} value={k}>{p.name} ({p.band})</option>)}
                            </select>
                            <input type="number" step="0.025" value={freq.value} onChange={e => handleFieldChange(freq.id, 'value', parseFloat(e.target.value) || 0)} className={`bg-slate-950 border border-slate-700 rounded px-1 py-1 text-[10px] font-bold text-center ${type === 'mic' ? 'text-emerald-400' : 'text-rose-400'}`} />
                            <button onClick={() => handleRemove(freq.id)} className="text-red-400 hover:text-red-300 font-bold text-xs px-1">&times;</button>
                        </div>
                        <div className="flex items-center gap-2 px-1">
                            <input type="text" value={freq.label || ''} onChange={e => handleFieldChange(freq.id, 'label', e.target.value)} placeholder="Label" className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[10px] text-slate-300 outline-none" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TourPlanningTab;
