import React, { useState, useEffect, useRef } from 'react';
import { AppCategory } from '../types';
import { PassCountdown } from './PassCountdown';

interface HeaderProps {
    projectName?: string;
    onManageProjects: () => void;
    onSaveProject: () => void;
    onSaveAsProject?: () => void;
    onExportProject: () => void;
    activeApp: AppCategory | null;
    onGoHome: () => void;
    isSunlightMode?: boolean; // legacy
    toggleSunlightMode?: () => void; // legacy
    displayTheme?: 'dark' | 'clean-office' | 'studio-neutral' | 'sunlight';
    onThemeChange?: (theme: 'dark' | 'clean-office' | 'studio-neutral' | 'sunlight') => void;
    isSaving?: boolean;
    isSaved?: boolean;
    onLogout?: () => void;
    user?: any;
    onOpenAccount?: () => void;
    isCommunityOpen?: boolean;
    onToggleCommunity?: () => void;
    onExpire?: () => void;
}

const appLabels: Record<AppCategory, string> = {
    calculator: 'RF Calculator',
    coordination: 'Festival Coordination',
    analysis: 'Live Analysis',
    comms: 'Radio Talkback Coordination',
    toolkit: 'RF Toolkit',
    multizone: 'Multi-Zone Coordination',
    tour: 'Tour Planning',
    hardware: 'Equipment Library',
    wmas: 'WMAS Coordination',
    network: 'Community Network',
    eventManagement: 'Unified Event Planner',
    tvLookup: 'TV Channel Lookup',
    sandbox: 'RF Sandbox'
};

const Header: React.FC<HeaderProps> = ({ 
    projectName, 
    onManageProjects, 
    onSaveProject, 
    onSaveAsProject,
    onExportProject, 
    activeApp, 
    onGoHome, 
    isSunlightMode, 
    toggleSunlightMode,
    displayTheme = 'dark',
    onThemeChange,
    isSaving = false,
    isSaved = false,
    onLogout,
    user,
    onOpenAccount,
    isCommunityOpen,
    onToggleCommunity,
    onExpire
}) => {
    const [installPrompt, setInstallPrompt] = useState<any>(null);
    const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
    const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const menuRef = useRef<HTMLDivElement>(null);
    const themeMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        
        const handler = (e: any) => {
            e.preventDefault();
            setInstallPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handler);
        
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsProjectMenuOpen(false);
            }
            if (themeMenuRef.current && !themeMenuRef.current.contains(event.target as Node)) {
                setIsThemeMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('beforeinstallprompt', handler);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleInstall = () => {
        if (installPrompt) {
            installPrompt.prompt();
            installPrompt.userChoice.then((choiceResult: any) => {
                if (choiceResult.outcome === 'accepted') {
                    setInstallPrompt(null);
                }
            });
        }
    };

    return (
        <header className="bg-slate-950/80 backdrop-blur-xl border border-white/10 rounded-md mb-4 text-white p-2 flex flex-col md:flex-row items-center justify-between shadow-2xl relative z-[10000]">
            <div className="flex items-center gap-5 mb-4 md:mb-0">
                {activeApp && (
                    <button 
                        onClick={onGoHome}
                        className="p-2.5 rounded-md bg-slate-900 border border-white/10 text-slate-400 hover:text-white hover:border-indigo-500/50 transition-all group"
                        title="Return to App Launcher"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 transform group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                    </button>
                )}
                <div className="text-left">
                    <div className="flex items-center gap-3">
                        <h1 className="text-base font-medium font-black uppercase tracking-[0.3em] text-white">
                            {activeApp ? appLabels[activeApp] : 'RF Suite'}
                        </h1>
                        {!activeApp && <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 text-[9px] font-black border border-indigo-500/30 tracking-widest">PRO</span>}
                    </div>
                    {projectName && (
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                            Plot: <span className="text-indigo-400">{projectName}</span>
                        </p>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-3">
                <div className="flex gap-2 mr-3 border-r border-white/5 pr-4">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-sm bg-slate-900 border border-white/5">
                        <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-pulse'}`} />
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                            {isOnline ? 'Online' : 'Offline'}
                        </span>
                    </div>
                    
                    {/* Global Refresh for Troubleshooting */}
                    <button 
                        onClick={() => {
                            console.log("[Header] Forcing hard reload...");
                            window.location.reload();
                        }}
                        className="p-2 rounded-md bg-slate-900 border border-white/10 text-slate-500 hover:text-white hover:border-indigo-500/50 transition-all group"
                        title="Force Refresh App"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 transform group-hover:rotate-180 transition-transform duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>

                    {onThemeChange && (
                        <div className="relative" ref={themeMenuRef}>
                            <button 
                                onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
                                className={`p-2 rounded-md transition-all border ${displayTheme !== 'dark' ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400' : 'bg-slate-900 border-white/10 text-slate-500 hover:text-white hover:border-indigo-500/50'}`}
                                title="Display Theme"
                            >
                                {displayTheme === 'dark' ? '🌙' : displayTheme === 'sunlight' ? '☀️' : '💻'}
                            </button>
                            {isThemeMenuOpen && (
                                <div className="absolute top-full right-0 mt-3 w-48 bg-slate-950/95 backdrop-blur-2xl border border-white/10 rounded-md shadow-[0_40px_120px_rgba(0,0,0,0.8)] overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200 z-[10001]">
                                    <div className="p-1 space-y-0.5">
                                        <button onClick={() => { onThemeChange('dark'); setIsThemeMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2 text-left rounded-md transition-colors ${displayTheme === 'dark' ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-300 hover:bg-white/5'}`}>
                                            <span>🌙</span> <span className="text-xs font-bold uppercase tracking-wider">High-Contrast Dark</span>
                                        </button>
                                        <button onClick={() => { onThemeChange('clean-office'); setIsThemeMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2 text-left rounded-md transition-colors ${displayTheme === 'clean-office' ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-300 hover:bg-white/5'}`}>
                                            <span>💻</span> <span className="text-xs font-bold uppercase tracking-wider">Clean Office</span>
                                        </button>
                                        <button onClick={() => { onThemeChange('studio-neutral'); setIsThemeMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2 text-left rounded-md transition-colors ${displayTheme === 'studio-neutral' ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-300 hover:bg-white/5'}`}>
                                            <span>☕</span> <span className="text-xs font-bold uppercase tracking-wider">Studio Neutral</span>
                                        </button>
                                        <button onClick={() => { onThemeChange('sunlight'); setIsThemeMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2 text-left rounded-md transition-colors ${displayTheme === 'sunlight' ? 'bg-amber-500/20 text-amber-400' : 'text-slate-300 hover:bg-white/5'}`}>
                                            <span>☀️</span> <span className="text-xs font-bold uppercase tracking-wider">Direct Sunlight</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    {installPrompt && (
                        <button onClick={handleInstall} className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-md hover:bg-emerald-500 hover:text-white transition-all">
                            Install
                        </button>
                    )}
                </div>

                <div className="relative" ref={menuRef}>
                    <div className="flex items-center gap-2">
                        {user && (
                            <button 
                                onClick={onOpenAccount}
                                className="flex items-center gap-3 px-3 py-2.5 rounded-md bg-slate-900 border border-white/10 text-slate-300 hover:border-indigo-500/50 hover:text-white transition-all group"
                            >
                                <div className="w-4 h-4 bg-gradient-to-br from-indigo-500 to-cyan-500 rounded-sm flex items-center justify-center text-[10px] font-black text-white shadow-sm border border-slate-700/50 group-hover:scale-110 transition-transform">
                                    {user.name.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest hidden lg:block">{user.name}</span>
                            </button>
                        )}

                        {user && <PassCountdown user={user} variant="header" onExpire={onExpire} />}
                        
                        {onToggleCommunity && (
                            <button 
                                onClick={onToggleCommunity}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-md font-black uppercase tracking-widest text-[10px] transition-all border ${
                                    isCommunityOpen 
                                    ? 'bg-emerald-600 border-emerald-400 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]' 
                                    : 'bg-slate-900 border-white/10 text-slate-300 hover:border-emerald-500/50 hover:text-white'
                                }`}
                                title="Community Network"
                            >
                                <span className="text-sm">💬</span>
                                <span className="hidden xl:block">Community</span>
                            </button>
                        )}

                        <button 
                            onClick={() => setIsProjectMenuOpen(!isProjectMenuOpen)}
                            className={`flex items-center gap-3 px-5 py-2.5 rounded-md font-black uppercase tracking-[0.15em] text-[10px] transition-all border ${
                                isProjectMenuOpen 
                                ? 'bg-indigo-600 border-indigo-400 text-white shadow-[0_0_20px_rgba(99,102,241,0.4)]' 
                                : 'bg-slate-900 border-white/10 text-slate-300 hover:border-indigo-500/50 hover:text-white'
                            }`}
                        >
                            <span>📁</span> Project
                            <svg className={`w-3 h-3 transition-transform duration-300 ${isProjectMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                    </div>

                    {isProjectMenuOpen && (
                        <div className="absolute top-full right-0 mt-3 w-64 bg-slate-950/95 backdrop-blur-2xl border border-white/10 rounded-md shadow-[0_40px_120px_rgba(0,0,0,0.8)] overflow-visible animate-in fade-in slide-in-from-top-4 duration-200 z-[10001]">
                            <div className="p-2 space-y-1">
                                <button 
                                    onClick={() => { onManageProjects(); setIsProjectMenuOpen(false); }}
                                    className="w-full flex items-center gap-2 p-3 rounded-md hover:bg-white/5 transition-all text-left group"
                                >
                                    <div className="w-9 h-9 bg-slate-900 border border-white/5 rounded-sm flex items-center justify-center text-base font-medium group-hover:scale-110 transition-transform">📂</div>
                                    <div>
                                        <p className="font-bold text-[11px] text-white uppercase tracking-wider">Dashboard</p>
                                        <p className="text-[9px] text-slate-500 uppercase font-black tracking-tighter">Switch Project</p>
                                    </div>
                                </button>

                                <div className="h-px bg-white/5 mx-2 my-1" />

                                <button 
                                    onClick={() => { onSaveProject(); setIsProjectMenuOpen(false); }}
                                    disabled={isSaving}
                                    className="w-full flex items-center gap-2 p-3 rounded-md hover:bg-white/5 transition-all text-left group disabled:opacity-50"
                                >
                                    <div className={`w-9 h-9 rounded-sm border flex items-center justify-center text-base font-medium transition-all ${isSaved ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'bg-slate-900 border-white/5 group-hover:scale-110'}`}>
                                        {isSaving ? '⏳' : (isSaved ? '✅' : '💾')}
                                    </div>
                                    <div>
                                        <p className="font-bold text-[11px] text-white uppercase tracking-wider">Save Project</p>
                                        <p className="text-[9px] text-slate-500 uppercase font-black tracking-tighter">
                                            {user ? 'Sync to Cloud' : 'Save to Browser'}
                                        </p>
                                    </div>
                                </button>

                                {onSaveAsProject && (
                                    <button 
                                        onClick={() => { onSaveAsProject(); setIsProjectMenuOpen(false); }}
                                        className="w-full flex items-center gap-2 p-3 rounded-md hover:bg-white/5 transition-all text-left group"
                                    >
                                        <div className="w-9 h-9 bg-slate-900 border border-white/5 rounded-sm flex items-center justify-center text-base font-medium group-hover:scale-110 transition-transform">💾+</div>
                                        <div>
                                            <p className="font-bold text-[11px] text-white uppercase tracking-wider">Save As...</p>
                                            <p className="text-[9px] text-slate-500 uppercase font-black tracking-tighter">Create New Copy</p>
                                        </div>
                                    </button>
                                )}

                                <button 
                                    onClick={() => { onExportProject(); setIsProjectMenuOpen(false); }}
                                    className="w-full flex items-center gap-2 p-3 rounded-md hover:bg-white/5 transition-all text-left group"
                                >
                                    <div className="w-9 h-9 bg-slate-900 border border-white/5 rounded-sm flex items-center justify-center text-base font-medium group-hover:scale-110 transition-transform">📥</div>
                                    <div>
                                        <p className="font-bold text-[11px] text-white uppercase tracking-wider">Download</p>
                                        <p className="text-[9px] text-slate-500 uppercase font-black tracking-tighter">Export .rfproject</p>
                                    </div>
                                </button>

                                {user?.email === 'dvitalis1969@gmail.com' && (
                                    <>
                                        <a 
                                            href="/api/backup-code-v2"
                                            onClick={() => setIsProjectMenuOpen(false)}
                                            className="w-full flex items-center gap-2 p-3 rounded-md hover:bg-white/5 transition-all text-left group"
                                        >
                                            <div className="w-9 h-9 bg-slate-900 border border-white/5 rounded-sm flex items-center justify-center text-base font-medium group-hover:scale-110 transition-transform">⚡</div>
                                            <div>
                                                <p className="font-bold text-[11px] text-white uppercase tracking-wider">Source Code</p>
                                                <p className="text-[9px] text-slate-500 uppercase font-black tracking-tighter">Download ZIP</p>
                                            </div>
                                        </a>

                                        <a 
                                            href="/api/download-deploy-zip"
                                            download="RF_Suite_Deploy.zip"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={() => setIsProjectMenuOpen(false)}
                                            className="w-full flex items-center gap-2 p-3 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 transition-all text-left group border border-emerald-500/20"
                                        >
                                            <div className="w-9 h-9 bg-emerald-900/30 border border-emerald-500/30 rounded-sm flex items-center justify-center text-base font-medium group-hover:scale-110 transition-transform">🚀</div>
                                            <div>
                                                <p className="font-bold text-[11px] text-emerald-400 uppercase tracking-wider">Deploy Ready ZIP</p>
                                                <p className="text-[9px] text-emerald-500/70 uppercase font-black tracking-tighter">Drag & Drop to Netlify</p>
                                            </div>
                                        </a>

                                        <div className="px-3 py-2 text-[8px] text-slate-600 font-mono text-center border-t border-white/5 mt-1">
                                            Build: {typeof __BUILD_TIMESTAMP__ !== 'undefined' ? new Date(__BUILD_TIMESTAMP__).toLocaleString() : 'Dev'}
                                        </div>

                                        <a 
                                            href="/api/backup-json"
                                            target="_blank"
                                            onClick={() => setIsProjectMenuOpen(false)}
                                            className="w-full flex items-center gap-2 p-3 rounded-md hover:bg-white/5 transition-all text-left group"
                                        >
                                            <div className="w-9 h-9 bg-slate-900 border border-white/5 rounded-sm flex items-center justify-center text-base font-medium group-hover:scale-110 transition-transform">📄</div>
                                            <div>
                                                <p className="font-bold text-[11px] text-white uppercase tracking-wider">JSON Backup</p>
                                                <p className="text-[9px] text-slate-500 uppercase font-black tracking-tighter">Fail-safe Text Copy</p>
                                            </div>
                                        </a>
                                    </>
                                )}

                                {onLogout && (
                                    <>
                                        <div className="h-px bg-white/5 mx-2 my-1" />
                                        <button 
                                            onClick={() => { onLogout(); setIsProjectMenuOpen(false); }}
                                            className="w-full flex items-center gap-2 p-3 rounded-md hover:bg-red-500/10 transition-all text-left group"
                                        >
                                            <div className="w-9 h-9 bg-slate-900 border border-white/5 rounded-sm flex items-center justify-center text-base font-medium group-hover:scale-110 transition-transform text-red-400">🚪</div>
                                            <div>
                                                <p className="font-bold text-[11px] text-red-400 uppercase tracking-wider">Sign Out</p>
                                                <p className="text-[9px] text-slate-500 uppercase font-black tracking-tighter">Back to Website</p>
                                            </div>
                                        </button>
                                    </>
                                )}
                            </div>
                            
                            <div className="bg-white/5 p-2.5 flex items-center justify-between">
                                <span className="text-[8px] text-slate-600 font-black uppercase tracking-widest">Active State</span>
                                <div className={`w-1.5 h-1.5 rounded-full ${isSaved ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;