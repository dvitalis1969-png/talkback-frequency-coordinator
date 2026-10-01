import React from 'react';
import { AppCategory, User } from '../types';
import { isPro } from '../src/lib/userUtils';
import { Lock } from 'lucide-react';

interface AppLauncherProps {
    onSelectApp: (app: AppCategory) => void;
    user: User | null;
}

const AppCard: React.FC<{ 
    title: string; 
    description: string; 
    icon: React.ReactNode; 
    onClick: () => void;
    colorClass: string;
    borderClass: string;
    isLocked?: boolean;
}> = ({ title, description, icon, onClick, colorClass, borderClass, isLocked }) => (
    <div className="relative group h-full">
        <button 
            onClick={isLocked ? undefined : onClick}
            className={`relative overflow-hidden p-8 rounded-3xl border border-white/10 bg-slate-900/40 ${isLocked ? 'opacity-50 cursor-not-allowed' : 'group-hover:bg-slate-900 group-hover:-translate-y-2 group-hover:shadow-[0_40px_100px_rgba(0,0,0,0.6)]'} transition-all duration-500 text-left w-full h-full flex flex-col`}
        >
            <div className={`absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 rounded-full blur-[80px] opacity-20 ${!isLocked ? 'group-hover:opacity-40' : ''} transition-opacity duration-700 ${colorClass}`}></div>
            
            <div className="flex justify-between items-start mb-6">
                <div className={`p-2 w-fit rounded-md bg-slate-950 border ${borderClass} ${!isLocked ? 'group-hover:scale-110' : ''} transition-transform duration-500 ${colorClass.replace('bg-', 'text-')}`}>
                    {icon}
                </div>
                {isLocked && (
                    <div className="p-2 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-2">
                        <Lock size={14} />
                        <span className="text-[9px] font-black uppercase tracking-widest">Pro Only</span>
                    </div>
                )}
            </div>
            
            <h3 className={`text-lg font-semibold font-black text-white mb-3 uppercase tracking-wider ${!isLocked ? 'group-hover:text-indigo-400' : ''} transition-colors`}>{title}</h3>
            <p className={`text-sm text-slate-500 font-medium leading-relaxed ${!isLocked ? 'group-hover:text-slate-300' : ''} transition-colors`}>{description}</p>
            
            <div className={`mt-auto pt-8 flex items-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 ${!isLocked ? 'group-hover:text-indigo-400' : ''} transition-colors`}>
                {isLocked ? 'Upgrade to Access' : <>Initialize Module <span className="ml-2 text-base font-medium leading-none transform group-hover:translate-x-2 transition-transform">&rarr;</span></>}
            </div>
        </button>
        {isLocked && (
            <div className="absolute -top-14 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-50 w-64 bg-slate-800 text-slate-200 text-xs text-center p-3 rounded-md border border-slate-700 shadow-2xl">
                <span className="font-bold text-white block mb-1">Module Locked</span>
                Upgrade to a Pro subscription to unlock this module and access advanced features.
                <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-800 border-b border-r border-slate-700 transform rotate-45"></div>
            </div>
        )}
    </div>
);

const AppLauncher: React.FC<AppLauncherProps> = ({ onSelectApp, user }) => {
    console.log(`[AppLauncher] Rendering for user:`, user?.email || 'null');
    const pro = isPro(user);
    console.log(`[AppLauncher] isPro result:`, pro);
    
    return (
        <div className="flex flex-col items-center justify-center min-h-[85vh] p-2">
            <div className="text-center mb-12 animate-in fade-in slide-in-from-top-4 duration-1000">
                <div className="inline-block px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-[10px] font-black uppercase tracking-[0.4em] mb-4">
                    Authoritative RF Intelligence
                </div>
                <h2 className="text-5xl md:text-6xl font-black text-white mb-6 tracking-tighter">
                    Select Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Workspace</span>
                </h2>
                <p className="text-slate-500 text-base font-medium max-w-2xl mx-auto font-medium">
                    A high-precision coordination ecosystem for wireless professionals.
                </p>
            </div>

            
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 max-w-[1800px] w-full">
                <AppCard 
                    title="Site Planner" 
                    description="Unified master dashboard for Festival scheduling, Exhibition multi-zone geometry, and unified event management."
                    colorClass="bg-rose-600"
                    borderClass="border-rose-600/20"
                    onClick={() => onSelectApp('coordination')}
                    isLocked={!pro}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
                />
                <AppCard 
                    title="Comms Architecture" 
                    description="Unified dashboard for discrete duplex pairs, zonal talkback, TETRA, and Capacity Plus digital comms."
                    colorClass="bg-emerald-500"
                    borderClass="border-emerald-500/20"
                    onClick={() => onSelectApp('comms')}
                    isLocked={!pro}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>}
                />
                <AppCard 
                    title="Live Telemetry" 
                    description="Unified dashboard for spectrum visualizers, waterfall charts, frequency forensics, and RF reporting."
                    colorClass="bg-cyan-500"
                    borderClass="border-cyan-500/20"
                    onClick={() => onSelectApp('analysis')}
                    isLocked={!pro}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>}
                />
                <AppCard 
                    title="RF Calculator" 
                    description={pro ? "Standard coordination engine for intermod analysis and manual frequency entry." : "Basic coordination engine. Free limit: 6 frequencies. Upgrade to Pro for unlimited."}
                    colorClass="bg-indigo-500"
                    borderClass="border-indigo-500/20"
                    onClick={() => onSelectApp('calculator')}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>}
                />
                <AppCard 
                    title="Tour Planning" 
                    description="Coordinate fixed equipment racks across multiple locations with local TV white space awareness."
                    colorClass="bg-blue-500"
                    borderClass="border-blue-500/20"
                    onClick={() => onSelectApp('tour')}
                    isLocked={!pro}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-2 1 2-1zm3.968-3.047a10.031 10.031 0 01-4.477 2.548 4.885 4.885 0 00-1.513.658l-2.096 1.048a.51.51 0 01-.689-.23.51.51 0 01.23-.69l2.103-1.052a5.086 5.086 0 011.578-.68 9.037 9.037 0 004.42-2.513 4.666 4.666 0 00.614-2.75 4.35 4.35 0 00-.773-2.545 5.59 5.05 0 01-.512-1.88A3.993 3.993 0 0112 3a3.993 3.993 0 013.726 2.348c.19.456.365.923.512 1.88.316.817.58 1.673.773 2.545.193.87.205 1.794-.614 2.75a9.037 9.037 0 00-4.42 2.513 5.086 5.086 0 01-1.578.68l-2.103 1.052a.51.51 0 01-.69-.23.51.51 0 01.23-.689l2.096-1.048a4.885 4.885 0 001.513-.658 10.031 10.031 0 014.477-2.548" /></svg>}
                />
                <AppCard 
                    title="WMAS Systems" 
                    description="Advanced coordination algorithms specific to Wireless Multichannel Audio Systems (WMAS) spectrum models."
                    colorClass="bg-purple-500"
                    borderClass="border-purple-500/20"
                    onClick={() => onSelectApp('wmas')}
                    isLocked={!pro}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                />
                <AppCard 
                    title="Pro Utilities" 
                    description="Professional field utilities: Power converters, TV Channel Lookup and more."
                    colorClass="bg-slate-500"
                    borderClass="border-slate-500/20"
                    onClick={() => onSelectApp('toolkit')}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" /></svg>}
                />
                <AppCard 
                    title="Training Lab" 
                    description="Educational physics sandboxes for Co-Channel interference, Proximity limits, and IMD visualizers."
                    colorClass="bg-amber-500"
                    borderClass="border-amber-500/20"
                    onClick={() => onSelectApp('sandbox')}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>}
                />
                <AppCard 
                    title="Community Network and Chat" 
                    description="Live chat with online users of RF Suite. Knowledge share using our live feed across the RF Suite Community."
                    colorClass="bg-emerald-500"
                    borderClass="border-emerald-500/20"
                    onClick={() => onSelectApp('network')}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
                />
            </div>
<div className="mt-16 text-slate-600 text-[10px] font-black uppercase tracking-[0.4em] flex gap-10">
                <span>V2.5.0 STABLE</span>
                <span>COORD ENGINE X64</span>
                <span>&copy; 2024</span>
            </div>
        </div>
    );
};

export default AppLauncher;