import React, { useState, useEffect } from 'react';
import { Play, Pause, Maximize, Volume2, SkipBack, SkipForward, Settings, Radio, Activity, Zap } from 'lucide-react';

export const SimulatedVideo = () => {
    const [isPlaying, setIsPlaying] = useState(true);
    const [progress, setProgress] = useState(0);
    const [time, setTime] = useState(0);

    // Timeline phases
    // 0-3s: Scanning Environment
    // 3-6s: Mapping Stages
    // 6-9s: Calculating Intermod
    // 9-12s: Allocating Frequencies
    
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isPlaying) {
            interval = setInterval(() => {
                setTime(t => {
                    const newTime = (t + 0.05) % 12;
                    setProgress((newTime / 12) * 100);
                    return newTime;
                });
            }, 100);
        }
        return () => clearInterval(interval);
    }, [isPlaying]);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="relative aspect-video rounded-3xl bg-slate-950 border border-white/10 overflow-hidden shadow-2xl group font-sans flex flex-col">
            {/* Video Content Area */}
            <div className="flex-1 relative overflow-hidden bg-slate-900 flex items-center justify-center p-8">
                {/* Grid Background */}
                <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(99, 102, 241, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(99, 102, 241, 0.1) 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
                
                {/* Phase 1: Scanning Background Noise (0-3s) */}
                <div className={`absolute inset-0 transition-opacity duration-500 ${time < 3 ? 'opacity-100' : 'opacity-0'}`}>
                    <div className="absolute top-8 left-8 flex items-center gap-3">
                        <Activity className="text-cyan-400" />
                        <span className="text-cyan-400 font-mono tracking-widest uppercase text-sm">Phase 1: Check available spectrum</span>
                    </div>
                    <div className="absolute inset-y-1/2 left-0 right-0 h-32 -mt-16 flex items-end justify-between px-8 gap-1">
                        {Array.from({ length: 64 }).map((_, i) => (
                            <div 
                                key={i} 
                                className="w-full bg-cyan-500/50 rounded-t-sm transition-all duration-100"
                                style={{ 
                                    height: isPlaying ? `${Math.random() * (Math.sin(i/5) * 50 + 50)}%` : '20%',
                                    filter: 'drop-shadow(0 0 8px rgba(34, 211, 238, 0.5))'
                                }}
                            />
                        ))}
                    </div>
                    {/* Sweeping line */}
                    <div 
                        className="absolute top-0 bottom-0 w-1 bg-white/50 shadow-[0_0_15px_#fff]"
                        style={{ left: `${(time / 3) * 100}%` }}
                    />
                </div>

                {/* Phase 2: Mapping Stages (3-6s) */}
                <div className={`absolute inset-0 transition-opacity duration-500 ${time >= 3 && time < 6 ? 'opacity-100' : 'opacity-0'}`}>
                    <div className="absolute top-8 left-8 flex items-center gap-3">
                        <Radio className="text-emerald-400" />
                        <span className="text-emerald-400 font-mono tracking-widest uppercase text-sm">Phase 2: Stage Topology</span>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="relative w-full max-w-lg h-64 border border-emerald-500/20 rounded-md bg-emerald-950/20 p-8 grid grid-cols-2 gap-8">
                            <div className={`border border-emerald-500/50 rounded-sm flex items-center justify-center p-2 transition-all duration-300 ${time > 3.5 ? 'bg-emerald-500/20 scale-100' : 'scale-90 opacity-0'}`}>
                                <span className="text-emerald-400 font-black tracking-widest uppercase">Main Stage</span>
                            </div>
                            <div className={`border border-emerald-500/50 rounded-sm flex items-center justify-center p-2 transition-all duration-300 ${time > 4.2 ? 'bg-emerald-500/20 scale-100' : 'scale-90 opacity-0'}`}>
                                <span className="text-emerald-400 font-black tracking-widest uppercase">Tent 1</span>
                            </div>
                            <div className={`border border-emerald-500/50 rounded-sm flex items-center justify-center p-2 transition-all duration-300 ${time > 4.9 ? 'bg-emerald-500/20 scale-100' : 'scale-90 opacity-0'}`}>
                                <span className="text-emerald-400 font-black tracking-widest uppercase">Tent 2</span>
                            </div>
                            <div className={`border border-emerald-500/50 rounded-sm flex items-center justify-center p-2 transition-all duration-300 ${time > 5.5 ? 'bg-emerald-500/20 scale-100' : 'scale-90 opacity-0'}`}>
                                <span className="text-emerald-400 font-black tracking-widest uppercase">VIP Area</span>
                            </div>
                            {/* Connection Lines */}
                            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: time > 5.7 ? 1 : 0 }}>
                                <line x1="25%" y1="25%" x2="75%" y2="75%" stroke="rgba(16, 185, 129, 0.3)" strokeWidth="2" strokeDasharray="4" />
                                <line x1="75%" y1="25%" x2="25%" y2="75%" stroke="rgba(16, 185, 129, 0.3)" strokeWidth="2" strokeDasharray="4" />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Phase 3: Interference Calc (6-9s) */}
                <div className={`absolute inset-0 transition-opacity duration-500 ${time >= 6 && time < 9 ? 'opacity-100' : 'opacity-0'}`}>
                     <div className="absolute top-8 left-8 flex items-center gap-3">
                        <Zap className="text-orange-400" />
                        <span className="text-orange-400 font-mono tracking-widest uppercase text-sm">Phase 3: IMD Calculation</span>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-[400px] h-[400px] border-2 border-orange-500/30 rounded-full flex items-center justify-center relative spin-slow">
                            <div className="w-[300px] h-[300px] border-2 border-orange-500/50 rounded-full flex items-center justify-center relative rotate-180">
                                <div className="w-[200px] h-[200px] border-2 border-orange-500/80 rounded-full flex items-center justify-center relative spin-reverse" />
                            </div>
                        </div>
                        {/* Flashing IMD Equations */}
                        <div className="absolute space-y-2 text-center text-orange-200 font-mono text-sm opacity-80 mix-blend-screen">
                            <div>2f1 - f2 = {Math.random() < 0.5 ? 'CLEAR' : 'HIT'}</div>
                            <div>3f1 - 2f2 = {Math.random() < 0.5 ? 'CLEAR' : 'HIT'}</div>
                            <div>f1 + f2 - f3 = CLEAR</div>
                            <div className="text-lg font-semibold font-black mt-4 tracking-widest mt-8">COMPUTING {Math.floor((time-6)*33)}%</div>
                        </div>
                    </div>
                </div>

                {/* Phase 4: Final Allocation (9-12s) */}
                <div className={`absolute inset-0 transition-opacity duration-500 ${time >= 9 ? 'opacity-100' : 'opacity-0'}`}>
                     <div className="absolute top-8 left-8 flex items-center gap-3">
                        <Radio className="text-indigo-400" />
                        <span className="text-indigo-400 font-mono tracking-widest uppercase text-sm">Phase 4: Frequency Roster</span>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center px-12">
                        <table className="w-full max-w-2xl text-left table-auto border-separate border-spacing-y-2">
                            <thead>
                                <tr className="text-[10px] text-slate-500 uppercase tracking-widest">
                                    <th className="pb-2 hidden sm:table-cell">Stage</th>
                                    <th className="pb-2">Device</th>
                                    <th className="pb-2 hidden sm:table-cell">Type</th>
                                    <th className="pb-2 text-right">Frequency</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    { s: 'Main Stage', d: 'Lead Vocal 1', t: 'IEM', f: '512.400' },
                                    { s: 'Main Stage', d: 'Guitar WL', t: 'Bodypack', f: '514.850' },
                                    { s: 'Tent 1', d: 'DJ Booth L', t: 'IEM', f: '522.125' },
                                    { s: 'Tent 1', d: 'DJ Booth R', t: 'IEM', f: '524.500' },
                                    { s: 'VIP Area', d: 'Announcer', t: 'Handheld', f: '533.900' },
                                ].map((row, i) => (
                                    <tr key={i} className={`bg-indigo-900/30 text-indigo-100 transition-all duration-300 transform ${time > 9 + (i * 0.4) ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
                                        <td className="py-3 px-3 border-l-2 border-indigo-500 text-sm hidden sm:table-cell">{row.s}</td>
                                        <td className="py-3 px-3 sm:px-0 text-sm font-bold">{row.d}</td>
                                        <td className="py-3 text-xs hidden sm:table-cell">{row.t}</td>
                                        <td className="py-3 px-3 rounded-r-lg text-right font-mono text-emerald-400">{row.f} MHz</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Big Play Button Overlay when paused */}
                {!isPlaying && (
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center cursor-pointer transition-opacity" onClick={() => setIsPlaying(true)}>
                        <div className="w-20 h-20 bg-indigo-600 rounded-full flex items-center justify-center pl-2 shadow-[0_0_30px_rgba(79,70,229,0.5)] transform hover:scale-110 transition-transform">
                            <Play size={32} className="text-white" />
                        </div>
                    </div>
                )}
            </div>

            {/* Custom Video Controls */}
            <div className="h-14 bg-slate-950 border-t border-slate-800 flex items-center px-3 gap-2 z-20">
                <button onClick={() => setIsPlaying(!isPlaying)} className="text-slate-300 hover:text-white transition-colors">
                    {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                </button>
                <button onClick={() => setTime(0)} className="text-slate-400 hover:text-white transition-colors"><SkipBack size={16} /></button>
                <div className="text-xs font-mono text-slate-400 w-12 text-center">{formatTime(time)}</div>
                
                {/* Progress Bar */}
                <div className="flex-1 h-2 bg-slate-800 rounded-full relative cursor-pointer overflow-hidden" onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const newProgress = ((e.clientX - rect.left) / rect.width);
                    setTime(newProgress * 12);
                }}>
                    <div className="absolute top-0 bottom-0 left-0 bg-indigo-500 transition-all duration-100 ease-linear" style={{ width: `${progress}%` }} />
                </div>

                <div className="text-xs font-mono text-slate-400 w-12 text-center">0:12</div>
                <button className="text-slate-400 hover:text-white transition-colors"><Volume2 size={16} /></button>
                <button className="text-slate-400 hover:text-white transition-colors"><Settings size={16} /></button>
                <button className="text-slate-400 hover:text-white transition-colors"><Maximize size={16} /></button>
            </div>
        </div>
    );
};
