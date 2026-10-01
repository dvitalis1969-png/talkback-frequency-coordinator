import React, { useState } from 'react';
import { WMASState, WMASNode, WMASProfile, WMASMode, TVChannelState, ScanDataPoint } from '../types';
import Card from './Card';
import { getTVChannels } from '../utils/tvDatabase';
import { Trash2, Plus, Zap, Activity, Shield, AlertTriangle, Radio, Info, CheckCircle2, Layers, Sliders } from 'lucide-react';
import { WMAS_PRESET_PROFILES } from '../constants';

interface WMASTabProps {
    state: WMASState;
    setState: React.Dispatch<React.SetStateAction<WMASState>>;
    tvChannelStates?: Record<number, TVChannelState>;
    scanData?: ScanDataPoint[] | null;
    acts?: { id: string; actName: string; stage: string; startTime: Date | string; endTime: Date | string }[];
}

const PRESET_PROFILES: WMASProfile[] = WMAS_PRESET_PROFILES;

const formatDateTimeLocal = (dateVal: any): string => {
    if (!dateVal) return '';
    try {
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) return '';
        const local = new Date(d.getTime() - new Date().getTimezoneOffset() * 60000);
        return local.toISOString().slice(0, 16);
    } catch {
        return '';
    }
};

const parseDateTimeLocal = (val: string): Date | undefined => {
    if (!val) return undefined;
    try {
        const d = new Date(val);
        return isNaN(d.getTime()) ? undefined : d;
    } catch {
        return undefined;
    }
};

const WMASTab: React.FC<WMASTabProps> = ({ state, setState, tvChannelStates = {}, scanData, acts = [] }) => {
    const safeState = state || { nodes: [], tvRegion: 'uk' };
    const safeNodes = Array.isArray(safeState.nodes) ? safeState.nodes : [];

    // Allocation state helpers
    const [selectedChannelPerNode, setSelectedChannelPerNode] = useState<Record<string, number | ''>>({});
    const [selectedSlotPerNode, setSelectedSlotPerNode] = useState<Record<string, number>>({});
    const [customFreqPerNode, setCustomFreqPerNode] = useState<Record<string, string>>({});
    const [showMaskDetails, setShowMaskDetails] = useState<Record<string, boolean>>({});

    const addNode = (presetId?: string) => {
        const profile = PRESET_PROFILES.find(p => p.id === presetId) || PRESET_PROFILES[0];
        const isShure = profile.manufacturer === 'Shure';
        const newNode: WMASNode = {
            id: `wmas-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            name: `${profile.manufacturer || 'WMAS'} Node ${safeNodes.length + 1}`,
            profileId: profile.id,
            mode: isShure ? 'standard' : 'standard',
            linksRequired: profile.maxLinks?.['standard'] || 8
        };
        setState(prev => ({
            ...prev,
            nodes: [...(prev?.nodes || []), newNode]
        }));
    };

    const updateNode = (id: string, updates: Partial<WMASNode>) => {
        setState(prev => ({
            ...prev,
            nodes: (prev?.nodes || []).map(n => {
                if (n.id !== id) return n;
                const updated = { ...n, ...updates };
                // If profile changed and current links exceed new profile max, adjust
                if (updates.profileId) {
                    const newProfile = PRESET_PROFILES.find(p => p.id === updates.profileId);
                    if (newProfile && newProfile.maxLinks) {
                        const newMax = newProfile.maxLinks[updated.mode] || 8;
                        if (updated.linksRequired > newMax) {
                            updated.linksRequired = newMax;
                        }
                        // If assignedBlock exists, update its width to match new profile bandwidth
                        if (updated.assignedBlock && typeof updated.assignedBlock.start === 'number') {
                            updated.assignedBlock = {
                                ...updated.assignedBlock,
                                end: +(updated.assignedBlock.start + newProfile.bandwidthMHz).toFixed(3)
                            };
                        }
                    }
                }
                return updated;
            })
        }));
    };

    const removeNode = (id: string) => {
        setState(prev => ({
            ...prev,
            nodes: (prev?.nodes || []).filter(n => n.id !== id)
        }));
    };

    // Calculate sub-band slots for a TV channel and a given bandwidth (e.g. 0.8 MHz inside 8 MHz = 10 slots)
    const getSubSlots = (chStart: number, chEnd: number, bandwidthMHz: number) => {
        const slots: { slotIndex: number; start: number; end: number; label: string }[] = [];
        const chWidth = chEnd - chStart;
        const count = Math.floor((chWidth + 0.001) / (bandwidthMHz || 0.8));
        for (let i = 0; i < count; i++) {
            const start = +(chStart + i * bandwidthMHz).toFixed(3);
            const end = +(start + bandwidthMHz).toFixed(3);
            slots.push({
                slotIndex: i + 1,
                start,
                end,
                label: `Slot ${i + 1} (${start.toFixed(3)} - ${end.toFixed(3)} MHz)`
            });
        }
        return slots;
    };

    const autoAssignBlocks = () => {
        const channels = getTVChannels(safeState.tvRegion || 'uk');
        let assignedNodes = [...safeNodes];
        
        // Track used sub-spans: Map of channel -> array of occupied [start, end] intervals
        const occupiedIntervals: { start: number; end: number }[] = [];

        assignedNodes = assignedNodes.map(node => {
            const profile = PRESET_PROFILES.find(p => p.id === node.profileId) || PRESET_PROFILES[0];
            const bw = profile?.bandwidthMHz || 8.0;
            let assigned = false;

            for (const ch of channels) {
                if (assigned) break;

                // Check if TV channel is blocked
                if (tvChannelStates[ch.channel] === 'blocked') continue;

                // Check scan data noise in this TV channel
                let hasInterference = false;
                if (scanData && scanData.length > 0) {
                    const pointsInChannel = scanData.filter(p => p.freq >= ch.start && p.freq <= ch.end);
                    if (pointsInChannel.length > 0) {
                        const maxAmp = Math.max(...pointsInChannel.map(p => p.amp));
                        if (maxAmp > -85) {
                            hasInterference = true;
                        }
                    }
                }
                if (hasInterference) continue;

                // Try sub-slots within this TV channel
                const slots = getSubSlots(ch.start, ch.end, bw);
                for (const slot of slots) {
                    // Check if slot overlaps any already assigned interval
                    const hasOverlap = occupiedIntervals.some(occ => 
                        !(slot.end <= occ.start || slot.start >= occ.end)
                    );

                    if (!hasOverlap) {
                        occupiedIntervals.push({ start: slot.start, end: slot.end });
                        assigned = true;
                        return {
                            ...node,
                            assignedBlock: {
                                start: slot.start,
                                end: slot.end,
                                tvChannel: ch.channel
                            }
                        };
                    }
                }
            }

            return node;
        });

        setState(prev => ({ ...prev, nodes: assignedNodes }));
    };

    // Group profiles by manufacturer
    const sennheiserProfiles = PRESET_PROFILES.filter(p => p.manufacturer === 'Sennheiser');
    const shureProfiles = PRESET_PROFILES.filter(p => p.manufacturer === 'Shure');
    const genericProfiles = PRESET_PROFILES.filter(p => p.manufacturer === 'Generic' || !p.manufacturer);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-tr from-rose-600 to-indigo-600 rounded-md shadow-sm border border-slate-700/50 shadow-rose-900/30 text-white">
                            <Radio size={22} />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold font-black text-white uppercase tracking-wider flex items-center gap-2">
                                WMAS Coordination Engine
                            </h2>
                            <p className="text-slate-400 text-xs mt-0.5">
                                Wideband &amp; Sub-Band Wireless Multichannel Audio Systems (Sennheiser Spectera 6/8 MHz &amp; Shure 800 kHz Sub-Band)
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2.5">
                    <select
                        value={safeState.tvRegion || 'uk'}
                        onChange={(e) => setState(prev => ({ ...prev, tvRegion: e.target.value as 'uk' | 'us' }))}
                        className="bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-xs font-bold text-white focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none"
                    >
                        <option value="uk">UK / EU (8 MHz TV Grid)</option>
                        <option value="us">US / FCC (6 MHz TV Grid)</option>
                    </select>
                    <button
                        onClick={autoAssignBlocks}
                        className="bg-slate-800 hover:bg-slate-700 text-white px-3.5 py-2 rounded-md text-xs font-black transition-all flex items-center gap-2 border border-slate-700 shadow-md active:translate-y-0.5"
                    >
                        <Zap size={14} className="text-yellow-400" />
                        Auto-Pack Blocks
                    </button>
                    <div className="relative inline-flex">
                        <button
                            onClick={() => addNode()}
                            className="bg-rose-600 hover:bg-rose-500 text-white px-3 py-2 rounded-md text-xs font-black transition-all flex items-center gap-2 shadow-sm border border-slate-700/50 shadow-rose-900/30 active:translate-y-0.5"
                        >
                            <Plus size={14} />
                            Add Node
                        </button>
                    </div>
                </div>
            </div>

            {/* Architectural Overview Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div className="bg-sky-950/20 border border-sky-500/30 rounded-md p-2 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/30">
                                Sennheiser Spectera
                            </span>
                            <span className="text-[11px] font-mono font-bold text-sky-300">6 / 8 MHz</span>
                        </div>
                        <h4 className="text-sm font-black text-white mb-1">Full-Channel Carrier</h4>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            Occupies an entire 6 or 8 MHz TV channel with unified bidirectional OFDM multiplexing (up to 32 bidirectional links / 64 in HD mode).
                        </p>
                    </div>
                    <button
                        onClick={() => addNode(safeState.tvRegion === 'uk' ? 'sennheiser-spectera-8mhz' : 'sennheiser-spectera-6mhz')}
                        className="mt-3 w-full py-1.5 bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 rounded-sm text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
                    >
                        <Plus size={12} /> Add Spectera Node
                    </button>
                </div>

                <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-md p-2 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                                Shure Axient Digital WMAS
                            </span>
                            <span className="text-[11px] font-mono font-bold text-emerald-300">800 kHz Sub-Band</span>
                        </div>
                        <h4 className="text-sm font-black text-white mb-1">Agile Sub-Band Carrier</h4>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            Slots into compact 800 kHz slices or TV sub-bands. Supports 4 IEMs (low latency) or 8 Mics (standard) or 16 links (high density) per carrier.
                        </p>
                    </div>
                    <button
                        onClick={() => addNode('shure-wmas-800khz')}
                        className="mt-3 w-full py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-sm text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
                    >
                        <Plus size={12} /> Add Shure 800 kHz Node
                    </button>
                </div>

                <div className="bg-indigo-950/20 border border-indigo-500/30 rounded-md p-2 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/30">
                                Protection Engine
                            </span>
                            <span className="text-[11px] font-mono font-bold text-indigo-300">Auto Exclusion</span>
                        </div>
                        <h4 className="text-sm font-black text-white mb-1">Festival Timeline Sync</h4>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            Global House systems create 24/7 wideband exclusions. Act-specific WMAS nodes dynamically protect blocks only during scheduled stage slots.
                        </p>
                    </div>
                    <div className="mt-3 flex items-center justify-between px-2 py-1.5 bg-indigo-950/50 rounded-sm border border-indigo-500/20 text-[10px] text-indigo-300 font-bold">
                        <span>Configured Nodes:</span>
                        <span className="font-mono text-white text-xs">{safeNodes.length}</span>
                    </div>
                </div>
            </div>

            {safeNodes.length === 0 ? (
                <div className="text-center py-16 bg-slate-900/50 border border-slate-800 rounded-md">
                    <Activity size={48} className="mx-auto text-slate-600 mb-4" />
                    <h3 className="text-lg font-semibold font-bold text-slate-300 mb-2">No WMAS Nodes Configured</h3>
                    <p className="text-slate-500 max-w-md mx-auto mb-6 text-sm">
                        Add a Sennheiser Spectera 6/8 MHz system or Shure 800 kHz Sub-Band node to configure wideband allocations, calculate link capacities, and protect spectrum.
                    </p>
                    <div className="flex justify-center gap-3">
                        <button
                            onClick={() => addNode('shure-wmas-800khz')}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-md text-xs font-black transition-all inline-flex items-center gap-2 shadow-sm border border-slate-700/50 shadow-emerald-900/30"
                        >
                            <Plus size={16} />
                            Add Shure 800 kHz Node
                        </button>
                        <button
                            onClick={() => addNode(safeState.tvRegion === 'uk' ? 'sennheiser-spectera-8mhz' : 'sennheiser-spectera-6mhz')}
                            className="bg-sky-600 hover:bg-sky-500 text-white px-5 py-2.5 rounded-md text-xs font-black transition-all inline-flex items-center gap-2 shadow-sm border border-slate-700/50 shadow-sky-900/30"
                        >
                            <Plus size={16} />
                            Add Sennheiser Spectera Node
                        </button>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {safeNodes.map(node => {
                        const profile = PRESET_PROFILES.find(p => p.id === node.profileId) || PRESET_PROFILES[0];
                        const linksReq = typeof node.linksRequired === 'number' ? node.linksRequired : (parseInt(String(node.linksRequired || 0)) || 0);
                        const maxLinks = profile?.maxLinks?.[node.mode] || 8;
                        const utilization = maxLinks > 0 ? (linksReq / maxLinks) * 100 : 0;
                        const isOverloaded = utilization > 100;
                        const isSubBand = (profile?.bandwidthMHz || 8) <= 2.0;
                        const isMaskOpen = !!showMaskDetails[node.id];

                        // Brand styling
                        const isShure = profile.manufacturer === 'Shure';
                        const isSennheiser = profile.manufacturer === 'Sennheiser';
                        const brandBorder = isShure 
                            ? 'border-emerald-500/30 hover:border-emerald-500/50' 
                            : isSennheiser 
                            ? 'border-sky-500/30 hover:border-sky-500/50' 
                            : 'border-slate-800 hover:border-slate-700';

                        const brandBadgeBg = isShure
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : isSennheiser
                            ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                            : 'bg-purple-500/20 text-purple-300 border-purple-500/40';

                        const currentSelectedCh = selectedChannelPerNode[node.id] ?? '';
                        const currentSelectedSlot = selectedSlotPerNode[node.id] ?? 1;
                        const currentCustomFreq = customFreqPerNode[node.id] ?? '';

                        // Get slots for currently selected TV channel
                        const activeCh = currentSelectedCh !== '' ? getTVChannels(safeState.tvRegion || 'uk').find(c => c.channel === currentSelectedCh) : null;
                        const subSlots = activeCh ? getSubSlots(activeCh.start, activeCh.end, profile.bandwidthMHz) : [];

                        const blockStart = node.assignedBlock ? Number(node.assignedBlock.start) : NaN;
                        const blockEnd = node.assignedBlock ? Number(node.assignedBlock.end) : NaN;
                        const hasValidBlock = node.assignedBlock && !isNaN(blockStart) && !isNaN(blockEnd);

                        return (
                            <Card key={node.id} className={`bg-slate-900/90 transition-all ${brandBorder} shadow-sm border border-slate-700/50 relative overflow-hidden`}>
                                <div className="p-5">
                                    {/* Header & Manufacturer badge */}
                                    <div className="flex justify-between items-start mb-4 gap-3">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${brandBadgeBg}`}>
                                                    {profile.manufacturer || 'WMAS'} System
                                                </span>
                                                <span className="text-[10px] font-mono font-bold text-slate-400">
                                                    {profile.bandwidthMHz >= 1 ? `${profile.bandwidthMHz} MHz` : `${Math.round(profile.bandwidthMHz * 1000)} kHz`} Carrier
                                                </span>
                                            </div>
                                            <input
                                                type="text"
                                                value={node.name || ''}
                                                onChange={(e) => updateNode(node.id, { name: e.target.value })}
                                                className="w-full bg-transparent border-b border-transparent hover:border-slate-700 focus:border-rose-500 text-base font-medium font-black text-white px-1 py-0.5 outline-none transition-colors"
                                            />
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => setShowMaskDetails(prev => ({ ...prev, [node.id]: !prev[node.id] }))}
                                                className={`p-1.5 rounded-sm border text-xs font-bold transition-colors ${isMaskOpen ? 'bg-indigo-600 text-white border-indigo-400' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'}`}
                                                title="View Emission Mask &amp; Technical Specs"
                                            >
                                                <Info size={16} />
                                            </button>
                                            <button
                                                onClick={() => removeNode(node.id)}
                                                className="text-slate-500 hover:text-red-400 p-1.5 rounded-sm hover:bg-slate-800 transition-colors"
                                                title="Delete Node"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Mask & Technical Details Modal/Panel */}
                                    {isMaskOpen && (
                                        <div className="mb-5 p-3.5 bg-slate-950/90 border border-indigo-500/30 rounded-md text-xs space-y-2 animate-in fade-in zoom-in-95 duration-200">
                                            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                                                <div className="flex items-center gap-2">
                                                    <Shield size={14} className="text-indigo-400" />
                                                    <span className="font-bold text-white uppercase tracking-wider text-[11px]">Spectral Mask &amp; Compliance Specs</span>
                                                </div>
                                                <span className="text-[10px] font-mono text-indigo-400 font-bold">{profile.name}</span>
                                            </div>
                                            
                                            <p className="text-slate-300 text-[11px] leading-relaxed">
                                                {profile.description}
                                            </p>

                                            {profile.maskTemplate && (
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                                                    <div className="p-2 bg-slate-900 rounded-sm border border-slate-800">
                                                        <span className="block text-[8px] font-black uppercase text-slate-500">Emission BW</span>
                                                        <span className="font-mono font-bold text-white text-xs">
                                                            {profile.maskTemplate.emissionBandwidthKHz >= 1000 ? `${profile.maskTemplate.emissionBandwidthKHz / 1000} MHz` : `${profile.maskTemplate.emissionBandwidthKHz} kHz`}
                                                        </span>
                                                    </div>
                                                    <div className="p-2 bg-slate-900 rounded-sm border border-slate-800">
                                                        <span className="block text-[8px] font-black uppercase text-slate-500">Guard Band</span>
                                                        <span className="font-mono font-bold text-white text-xs">{profile.maskTemplate.guardBandKHz} kHz</span>
                                                    </div>
                                                    <div className="p-2 bg-slate-900 rounded-sm border border-slate-800">
                                                        <span className="block text-[8px] font-black uppercase text-slate-500">Out-Of-Band Rej.</span>
                                                        <span className="font-mono font-bold text-emerald-400 text-xs">
                                                            -{profile.maskTemplate.outOfBandAttenuationDb || 40} dBc
                                                        </span>
                                                    </div>
                                                    <div className="p-2 bg-slate-900 rounded-sm border border-slate-800">
                                                        <span className="block text-[8px] font-black uppercase text-slate-500">Roll-Off Skirt</span>
                                                        <span className="font-mono font-bold text-sky-400 text-xs">
                                                            {profile.maskTemplate.spectralRollOffDbPerOctave || 35} dB/oct
                                                        </span>
                                                    </div>
                                                    <div className="col-span-2 sm:col-span-4 p-2 bg-indigo-950/40 rounded-sm border border-indigo-500/20 text-[10px] text-indigo-200">
                                                        <span className="font-bold text-indigo-300">Standard: </span>
                                                        {profile.maskTemplate.description}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* System Type: House vs Act Specific */}
                                    <div className="grid grid-cols-2 gap-2 mb-4">
                                        <div className="col-span-2">
                                            <div className="flex items-center gap-2 p-3 bg-slate-950 rounded-md border border-slate-800">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        checked={node.isHouseSystem !== false}
                                                        onChange={() => updateNode(node.id, { isHouseSystem: true })}
                                                        className="w-4 h-4 accent-rose-500"
                                                    />
                                                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">House System (Global 24/7)</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        checked={node.isHouseSystem === false}
                                                        onChange={() => updateNode(node.id, { isHouseSystem: false })}
                                                        className="w-4 h-4 accent-rose-500"
                                                    />
                                                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Act Specific (Time Slotted)</span>
                                                </label>
                                            </div>
                                        </div>

                                        {node.isHouseSystem === false && (
                                            <>
                                                {acts.length > 0 && (
                                                    <div className="col-span-2">
                                                        <label className="block text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">Quick-Allocate to Festival Act</label>
                                                        <select
                                                            value={acts.find(a => a.actName === node.actName && a.stage === node.stage)?.id || ''}
                                                            onChange={(e) => {
                                                                const act = acts.find(a => a.id === e.target.value);
                                                                if (act) {
                                                                    updateNode(node.id, {
                                                                        actName: act.actName,
                                                                        stage: act.stage,
                                                                        startTime: new Date(act.startTime),
                                                                        endTime: new Date(act.endTime)
                                                                    });
                                                                }
                                                            }}
                                                            className="w-full bg-slate-950 border border-rose-500/30 rounded-md px-3 py-2 text-xs text-white focus:border-rose-500 outline-none font-bold"
                                                        >
                                                            <option value="">-- Select an Act to Auto-Populate --</option>
                                                            {acts.map(a => (
                                                                <option key={a.id} value={a.id}>
                                                                    {a.actName} ({a.stage})
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                )}
                                                <div className="col-span-1">
                                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Act Name</label>
                                                    <input
                                                        type="text"
                                                        value={node.actName || ''}
                                                        onChange={(e) => updateNode(node.id, { actName: e.target.value })}
                                                        placeholder="Artist Name"
                                                        className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs text-white focus:border-rose-500 outline-none"
                                                    />
                                                </div>
                                                <div className="col-span-1">
                                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Stage / Zone</label>
                                                    <input
                                                        type="text"
                                                        value={node.stage || ''}
                                                        onChange={(e) => updateNode(node.id, { stage: e.target.value })}
                                                        placeholder="Main Stage"
                                                        className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs text-white focus:border-rose-500 outline-none"
                                                    />
                                                </div>
                                                <div className="col-span-1">
                                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Start Time</label>
                                                    <input
                                                        type="datetime-local"
                                                        value={formatDateTimeLocal(node.startTime)}
                                                        onChange={(e) => updateNode(node.id, { startTime: parseDateTimeLocal(e.target.value) })}
                                                        className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs text-white focus:border-rose-500 outline-none font-mono"
                                                    />
                                                </div>
                                                <div className="col-span-1">
                                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">End Time</label>
                                                    <input
                                                        type="datetime-local"
                                                        value={formatDateTimeLocal(node.endTime)}
                                                        onChange={(e) => updateNode(node.id, { endTime: parseDateTimeLocal(e.target.value) })}
                                                        className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs text-white focus:border-rose-500 outline-none font-mono"
                                                    />
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* Profile & Mode Configuration with Grouped Dropdown */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                                                System Profile &amp; Bandwidth
                                            </label>
                                            <select
                                                value={node.profileId}
                                                onChange={(e) => updateNode(node.id, { profileId: e.target.value })}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2.5 text-xs text-white font-bold focus:border-rose-500 outline-none"
                                            >
                                                {sennheiserProfiles.length > 0 && (
                                                    <optgroup label="Sennheiser Spectera Systems (Wideband)">
                                                        {sennheiserProfiles.map(p => (
                                                            <option key={p.id} value={p.id}>
                                                                {p.name} — {p.bandwidthMHz} MHz
                                                            </option>
                                                        ))}
                                                    </optgroup>
                                                )}
                                                {shureProfiles.length > 0 && (
                                                    <optgroup label="Shure Axient Digital WMAS (Sub-Band)">
                                                        {shureProfiles.map(p => (
                                                            <option key={p.id} value={p.id}>
                                                                {p.name} — {p.bandwidthMHz >= 1 ? `${p.bandwidthMHz} MHz` : `${Math.round(p.bandwidthMHz * 1000)} kHz`}
                                                            </option>
                                                        ))}
                                                    </optgroup>
                                                )}
                                                {genericProfiles.length > 0 && (
                                                    <optgroup label="Generic WMAS Profiles">
                                                        {genericProfiles.map(p => (
                                                            <option key={p.id} value={p.id}>
                                                                {p.name} — {p.bandwidthMHz >= 1 ? `${p.bandwidthMHz} MHz` : `${Math.round(p.bandwidthMHz * 1000)} kHz`}
                                                            </option>
                                                        ))}
                                                    </optgroup>
                                                )}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                                                Latency &amp; Transmission Mode
                                            </label>
                                            <select
                                                value={node.mode}
                                                onChange={(e) => updateNode(node.id, { mode: e.target.value as WMASMode })}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2.5 text-xs text-white font-bold focus:border-rose-500 outline-none"
                                            >
                                                <option value="low-latency">Low Latency (IEMs &amp; Real-Time Transceivers)</option>
                                                <option value="standard">Standard Fidelity (Mics &amp; Instruments)</option>
                                                <option value="high-density">High Density (Maximum Audio Links)</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Link Capacity Meter */}
                                    <div className="bg-slate-950 rounded-md p-2 border border-slate-800 mb-4">
                                        <div className="flex justify-between items-end mb-2">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                                                    Required Audio Links
                                                </label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max={maxLinks * 2}
                                                    value={linksReq}
                                                    onChange={(e) => updateNode(node.id, { linksRequired: parseInt(e.target.value) || 0 })}
                                                    className="w-24 bg-slate-900 border border-slate-700 rounded-sm px-3 py-1.5 text-white font-mono text-sm focus:border-rose-500 outline-none font-bold"
                                                />
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                                                    Profile Capacity ({node.mode})
                                                </div>
                                                <div className={`text-sm font-mono font-black ${isOverloaded ? 'text-red-400' : 'text-emerald-400'}`}>
                                                    {linksReq} / {maxLinks} Links
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden mt-3">
                                            <div 
                                                className={`h-full rounded-full transition-all duration-500 ${isOverloaded ? 'bg-red-500' : utilization > 80 ? 'bg-yellow-500' : 'bg-emerald-500'}`}
                                                style={{ width: `${Math.min(utilization, 100)}%` }}
                                            />
                                        </div>

                                        {isOverloaded ? (
                                            <div className="flex items-center gap-1.5 mt-2 text-red-400 text-xs font-medium">
                                                <AlertTriangle size={12} />
                                                Exceeds carrier block limit ({maxLinks} links for {profile.name} in {node.mode} mode).
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2 font-mono">
                                                <span>Low-Lat: {profile.maxLinks?.['low-latency'] || 0}</span>
                                                <span>Standard: {profile.maxLinks?.['standard'] || 0}</span>
                                                <span>High-Density: {profile.maxLinks?.['high-density'] || 0}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* RF Block Allocation Section */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                            RF Carrier Allocation
                                        </label>

                                        {hasValidBlock ? (
                                            <div className="flex items-center justify-between bg-rose-500/10 border border-rose-500/30 rounded-md p-3.5 shadow-inner">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-md bg-rose-500/20 flex items-center justify-center text-rose-400 shadow-md">
                                                        <Shield size={18} />
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-black text-white font-mono flex items-center gap-2">
                                                            {blockStart.toFixed(3)} - {blockEnd.toFixed(3)} MHz
                                                            <span className="text-[10px] font-sans font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                                                                LOCKED
                                                            </span>
                                                        </div>
                                                        <div className="text-xs text-rose-300 font-bold mt-0.5">
                                                            {node.assignedBlock?.tvChannel ? `TV CH ${node.assignedBlock.tvChannel} (${(safeState.tvRegion || 'uk').toUpperCase()} Grid)` : 'Custom Spectrum Span'} 
                                                            <span className="text-slate-400 font-mono ml-1.5">
                                                                (Width: {profile.bandwidthMHz >= 1 ? `${profile.bandwidthMHz} MHz` : `${Math.round(profile.bandwidthMHz * 1000)} kHz`})
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => updateNode(node.id, { assignedBlock: undefined })}
                                                    className="text-xs font-black text-slate-400 hover:text-white uppercase tracking-wider px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 rounded-sm transition-colors border border-slate-700"
                                                >
                                                    Clear
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="space-y-2 bg-slate-950 p-3 rounded-md border border-slate-800">
                                                <div className="flex flex-col sm:flex-row gap-2">
                                                    <select
                                                        value={currentSelectedCh}
                                                        onChange={(e) => {
                                                            const chNum = e.target.value ? parseInt(e.target.value) : '';
                                                            setSelectedChannelPerNode(prev => ({ ...prev, [node.id]: chNum }));
                                                            setSelectedSlotPerNode(prev => ({ ...prev, [node.id]: 1 }));
                                                        }}
                                                        className="flex-1 bg-slate-900 border border-slate-700 rounded-sm px-3 py-2 text-xs text-white font-bold focus:border-rose-500 outline-none"
                                                    >
                                                        <option value="">Select TV Channel Grid...</option>
                                                        {getTVChannels(safeState.tvRegion || 'uk').map(ch => (
                                                            <option key={ch.channel} value={ch.channel}>
                                                                CH {ch.channel} ({ch.start}-{ch.end} MHz) {tvChannelStates[ch.channel] === 'blocked' ? '[BLOCKED]' : ''}
                                                            </option>
                                                        ))}
                                                    </select>

                                                    {/* If it's a Sub-Band profile (e.g. Shure 800 kHz), show Slot selector within that TV channel */}
                                                    {isSubBand && subSlots.length > 0 && (
                                                        <select
                                                            value={currentSelectedSlot}
                                                            onChange={(e) => setSelectedSlotPerNode(prev => ({ ...prev, [node.id]: parseInt(e.target.value) || 1 }))}
                                                            className="bg-slate-900 border border-slate-700 rounded-sm px-3 py-2 text-xs text-emerald-400 font-mono font-bold focus:border-rose-500 outline-none"
                                                        >
                                                            {subSlots.map(s => (
                                                                <option key={s.slotIndex} value={s.slotIndex}>
                                                                    {s.label}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    )}

                                                    <button
                                                        onClick={() => {
                                                            if (currentSelectedCh === '') return;
                                                            const ch = getTVChannels(safeState.tvRegion || 'uk').find(c => c.channel === currentSelectedCh);
                                                            if (!ch) return;

                                                            if (isSubBand) {
                                                                const chosenSlot = subSlots.find(s => s.slotIndex === currentSelectedSlot) || subSlots[0];
                                                                if (chosenSlot) {
                                                                    updateNode(node.id, {
                                                                        assignedBlock: {
                                                                            start: chosenSlot.start,
                                                                            end: chosenSlot.end,
                                                                            tvChannel: ch.channel
                                                                        }
                                                                    });
                                                                }
                                                            } else {
                                                                updateNode(node.id, {
                                                                    assignedBlock: {
                                                                        start: ch.start,
                                                                        end: +(ch.start + profile.bandwidthMHz).toFixed(3),
                                                                        tvChannel: ch.channel
                                                                    }
                                                                });
                                                            }
                                                            setSelectedChannelPerNode(prev => ({ ...prev, [node.id]: '' }));
                                                        }}
                                                        disabled={currentSelectedCh === ''}
                                                        className="bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-2 rounded-sm text-xs font-black transition-colors"
                                                    >
                                                        Assign
                                                    </button>
                                                </div>

                                                {/* Custom Start/Center Frequency direct placement */}
                                                <div className="pt-2 border-t border-slate-900 flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase whitespace-nowrap">Or Custom Freq:</span>
                                                    <input
                                                        type="number"
                                                        step="0.025"
                                                        placeholder="Center Freq (e.g. 472.400)"
                                                        value={currentCustomFreq}
                                                        onChange={(e) => setCustomFreqPerNode(prev => ({ ...prev, [node.id]: e.target.value }))}
                                                        className="flex-1 bg-slate-900 border border-slate-800 rounded-sm px-2.5 py-1 text-xs text-white font-mono focus:border-rose-500 outline-none"
                                                    />
                                                    <button
                                                        onClick={() => {
                                                            const freq = parseFloat(currentCustomFreq);
                                                            if (isNaN(freq) || freq <= 0) return;
                                                            const halfBw = (profile.bandwidthMHz || 8) / 2;
                                                            updateNode(node.id, {
                                                                assignedBlock: {
                                                                    start: +(freq - halfBw).toFixed(3),
                                                                    end: +(freq + halfBw).toFixed(3)
                                                                }
                                                            });
                                                            setCustomFreqPerNode(prev => ({ ...prev, [node.id]: '' }));
                                                        }}
                                                        disabled={!currentCustomFreq}
                                                        className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 hover:text-white px-3 py-1 rounded-sm text-xs font-bold transition-colors border border-slate-700"
                                                    >
                                                        Set
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default WMASTab;
