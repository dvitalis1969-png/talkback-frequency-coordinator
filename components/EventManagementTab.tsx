import React, { useState } from 'react';
import Card, { CardTitle } from './Card';
import { User, ZoneConfig, EventManagementState, EquipmentProfile, ScanDataPoint, TVChannelState } from '../types';
import MultiZoneCoordinationTab from './MultizoneTab';
import ZonalTalkbackTab from './ZonalTalkbackTab';
import { Settings2, Mic2, Radio, LayoutGrid } from 'lucide-react';

interface EventManagementTabProps {
    user: User | null;
    state: EventManagementState;
    setState: React.Dispatch<React.SetStateAction<EventManagementState>>;
    customEquipment: EquipmentProfile[];
    onManageCustomEquipment: () => void;
    equipmentOverrides: any;
    tvChannelStates: Record<number, TVChannelState>;
    setTvChannelStates: (s: Record<number, TVChannelState>) => void;
    wmasState: any;
    // We will hook up to the multizone state variables for the mics/iems portion 
    // to reuse the robust engine and UI without breaking anything.
    multizoneProps: any;
    commsProps: any;
}

const EventManagementTab: React.FC<EventManagementTabProps> = ({ 
    user, state, setState, customEquipment, onManageCustomEquipment, 
    equipmentOverrides, tvChannelStates, setTvChannelStates, wmasState,
    multizoneProps, commsProps
}) => {
    const [view, setView] = useState<'mics' | 'comms' | 'unified'>('unified');

    return (
        <div className="p-2 md:p-4 lg:p-8 space-y-8 animate-in fade-in duration-500 max-w-[1920px] mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-900/40 p-4 rounded-3xl border border-white/5 backdrop-blur-sm shadow-2xl">
                <div className="flex items-center gap-5">
                    <div className="w-16 h-16 rounded-md bg-rose-500/20 flex items-center justify-center border border-rose-500/30 shadow-[0_0_30px_rgba(225,29,72,0.15)]">
                        <LayoutGrid className="w-8 h-8 text-rose-400" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                            Unified Event Planner
                            <span className="px-2 py-1 bg-rose-500/20 text-rose-400 text-[10px] uppercase tracking-[0.2em] rounded border border-rose-500/30">Module</span>
                        </h1>
                        <p className="text-slate-400 font-medium mt-1">Coordinate microphones, IEMs, and talkback arrays on a single canvas.</p>
                    </div>
                </div>

                <div className="flex bg-slate-950 p-1.5 rounded-md border border-white/5 shadow-inner">
                    <button onClick={() => setView('unified')} className={`px-5 py-2.5 rounded-md text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-2 ${view === 'unified' ? 'bg-rose-600 text-white shadow-sm border border-slate-700/50' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
                        <LayoutGrid size={14} /> Unified Grid
                    </button>
                    <button onClick={() => setView('mics')} className={`px-5 py-2.5 rounded-md text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-2 ${view === 'mics' ? 'bg-indigo-600 text-white shadow-sm border border-slate-700/50' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
                        <Mic2 size={14} /> Mics & IEMs
                    </button>
                    <button onClick={() => setView('comms')} className={`px-5 py-2.5 rounded-md text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-2 ${view === 'comms' ? 'bg-emerald-600 text-white shadow-sm border border-slate-700/50' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
                        <Radio size={14} /> Talkback
                    </button>
                </div>
            </div>

            {/* Content Container */}
            <div className="space-y-12">
                {/* Mics & IEMs Section */}
                {(view === 'unified' || view === 'mics') && (
                    <div className="space-y-4">
                        {view === 'unified' && (
                            <div className="flex items-center gap-3 pb-2 border-b border-white/10">
                                <Mic2 className="text-indigo-400" />
                                <h2 className="text-lg font-semibold font-black text-white uppercase tracking-wider">Microphones & IEMs</h2>
                            </div>
                        )}
                        <div className="bg-slate-900/20 rounded-3xl border border-white/5 overflow-hidden">
                            <MultiZoneCoordinationTab 
                                {...multizoneProps}
                                // Override UI aesthetics if possible by passing minimal mode props if they existed, 
                                // but we will render them as is for maximum stability.
                            />
                        </div>
                    </div>
                )}

                {/* Talkback Section */}
                {(view === 'unified' || view === 'comms') && (
                    <div className="space-y-4">
                        {view === 'unified' && (
                            <div className="flex items-center gap-3 pb-2 border-b border-white/10">
                                <Radio className="text-emerald-400" />
                                <h2 className="text-lg font-semibold font-black text-white uppercase tracking-wider">Talkback & Comms</h2>
                            </div>
                        )}
                        <div className="bg-slate-900/20 rounded-3xl border border-white/5 overflow-hidden">
                            <ZonalTalkbackTab 
                                {...commsProps}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EventManagementTab;
