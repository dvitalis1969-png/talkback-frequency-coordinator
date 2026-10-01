import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { db } from '../src/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { Search, Radio, Wifi, MapPin, Clock, RefreshCw, Lock, Unlock, ArrowRight } from 'lucide-react';

const LiveCrewView: React.FC = () => {
    const { shareId } = useParams<{ shareId: string }>();
    const [searchParams] = useSearchParams();
    const actId = searchParams.get('act');
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [changedFreqs, setChangedFreqs] = useState<Set<string>>(new Set());
    const [password, setPassword] = useState('');
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [showPasswordError, setShowPasswordError] = useState(false);

    useEffect(() => {
        // Check if already authorized in this session
        const savedPass = localStorage.getItem(`live_auth_${shareId}_${actId || 'global'}`);
        if (savedPass) {
            setPassword(savedPass);
        }
    }, [shareId, actId]);

    useEffect(() => {
        console.log("[LiveCrewView] Mounted with shareId:", shareId);
        console.log("[LiveCrewView] Current URL:", window.location.href);
        
        if (!shareId) {
            console.error("[LiveCrewView] No shareId found in URL params");
            setError("Invalid link.");
            setLoading(false);
            return;
        }

        const docRef = doc(db, 'live_shares', shareId);
        const unsubscribe = onSnapshot(docRef, (snapshot) => {
            console.log("[LiveCrewView] Snapshot received. Exists:", snapshot.exists());
            if (snapshot.exists()) {
                const rawData = snapshot.data();
                console.log("[LiveCrewView] Raw data:", rawData);
                try {
                    const newData: any = {
                        ...rawData,
                        acts: typeof rawData.acts === 'string' ? JSON.parse(rawData.acts) : (rawData.acts || []),
                        zones: typeof rawData.zones === 'string' ? JSON.parse(rawData.zones) : (rawData.zones || [])
                    };
                    console.log("[LiveCrewView] Parsed data:", newData);

                if (!newData.active) {
                    setError("This live link has been revoked.");
                    setData(null);
                } else {
                    // Detect changes for highlighting
                    if (data && data.acts) {
                        const newFreqs = new Set<string>();
                        newData.acts.forEach((newAct: any) => {
                            const oldAct = data.acts.find((a: any) => a.id === newAct.id);
                            if (oldAct) {
                                newAct.frequencies?.forEach((newFreq: any) => {
                                    const oldFreq = oldAct.frequencies?.find((f: any) => f.id === newFreq.id);
                                    if (!oldFreq || (oldFreq.value || oldFreq.frequency) !== (newFreq.value || newFreq.frequency)) {
                                        newFreqs.add(newFreq.id);
                                    }
                                });
                            }
                        });
                        if (newFreqs.size > 0) {
                            setChangedFreqs(newFreqs);
                            setTimeout(() => setChangedFreqs(new Set()), 5000); // Clear highlight after 5s
                        }
                    }
                    setData(newData);
                    
                    // Check authorization
                    const requiredPass = actId ? (newData.passwords?.[actId]) : newData.globalPassword;
                    const savedPass = localStorage.getItem(`live_auth_${shareId}_${actId || 'global'}`);
                    
                    if (!requiredPass || savedPass === requiredPass) {
                        setIsAuthorized(true);
                    } else {
                        setIsAuthorized(false);
                    }
                }
            } catch (parseError) {
                    console.error("[LiveCrewView] Error parsing data:", parseError);
                    setError("Failed to parse live data.");
                }
            } else {
                console.warn("[LiveCrewView] Document does not exist for shareId:", shareId);
                setError("Live link not found or has been removed.");
                setData(null);
            }
            setLoading(false);
        }, (err) => {
            console.error("[LiveCrewView] Firestore error:", err);
            setError(`Failed to connect to live data: ${err.message}`);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [shareId]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-2">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                <div className="font-bold tracking-widest uppercase text-xs">Connecting to Live Plan...</div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
                <div className="w-16 h-16 bg-rose-500/20 text-rose-500 rounded-full flex items-center justify-center mb-4">
                    <Wifi className="w-8 h-8" />
                </div>
                <h1 className="text-lg font-semibold font-black text-white mb-2">Connection Lost</h1>
                <p className="text-slate-400 mb-6">{error}</p>
                <button 
                    onClick={() => window.location.reload()}
                    className="px-8 py-3 bg-slate-900 border border-white/10 text-white rounded-md font-bold uppercase tracking-widest text-xs hover:bg-slate-800 transition-all flex items-center gap-2"
                >
                    <RefreshCw className="w-4 h-4" />
                    Try Refreshing
                </button>
            </div>
        );
    }

    const allFrequencies = data.acts.flatMap((act: any) => 
        (act.frequencies || []).map((f: any) => ({ ...f, actName: act.actName, stage: act.stage, actId: act.id }))
    );

    const filteredFrequencies = allFrequencies.filter((f: any) => {
        // First filter by act if actId is present in URL
        if (actId && f.actId !== actId) return false;

        // Then filter by search term
        return (f.equipmentKey || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (f.label || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (f.actName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (f.stage || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (f.value || f.frequency || '').toString().includes(searchTerm);
    });

    const activeAct = actId ? data.acts.find((a: any) => a.id === actId) : null;

    const handlePasswordSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const requiredPass = actId ? (data.passwords?.[actId]) : data.globalPassword;
        
        if (password === requiredPass) {
            setIsAuthorized(true);
            setShowPasswordError(false);
            localStorage.setItem(`live_auth_${shareId}_${actId || 'global'}`, password);
        } else {
            setShowPasswordError(true);
            setTimeout(() => setShowPasswordError(false), 2000);
        }
    };

    if (!isAuthorized) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
                <div className="w-full max-w-sm space-y-8 animate-in fade-in zoom-in duration-500">
                    <div className="text-center space-y-2">
                        <div className="w-16 h-16 bg-indigo-500/20 text-indigo-400 rounded-3xl flex items-center justify-center mx-auto mb-6">
                            <Lock className="w-8 h-8" />
                        </div>
                        <h1 className="text-xl font-semibold font-black text-white tracking-tight">Secure Access</h1>
                        <p className="text-slate-400 text-sm">
                            This {actId ? `plan for ${activeAct?.actName || 'the act'}` : 'global plan'} is password protected.
                        </p>
                    </div>

                    <form onSubmit={handlePasswordSubmit} className="space-y-4">
                        <div className="relative group">
                            <input 
                                type="password"
                                placeholder="Enter Access PIN"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoFocus
                                className={`w-full bg-slate-900 border ${showPasswordError ? 'border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.2)]' : 'border-white/10'} rounded-md px-4 py-2 text-center text-lg font-semibold font-black tracking-[0.5em] text-white placeholder:text-slate-700 placeholder:tracking-normal focus:outline-none focus:border-indigo-500 transition-all`}
                            />
                        </div>
                        
                        <button 
                            type="submit"
                            className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest text-xs rounded-md shadow-sm border border-slate-700/50 shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 group"
                        >
                            Verify Access <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </button>
                    </form>

                    <p className="text-center text-[10px] text-slate-600 font-bold uppercase tracking-widest">
                        Contact your Stage Manager for the PIN
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-300 font-sans pb-20">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-white/5 px-3 py-2">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-base font-medium font-black text-white tracking-tight truncate">
                            {activeAct ? activeAct.actName : data.festivalName}
                        </h1>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> 
                            {activeAct ? 'Act Specific View' : 'Live Sync Active'}
                        </div>
                        {data.updatedAt && (
                            <div className="text-[8px] text-slate-500 uppercase mt-1">
                                Updated: {new Date(data.updatedAt.seconds * 1000).toLocaleTimeString()}
                            </div>
                        )}
                    </div>
                    <button 
                        onClick={() => window.location.reload()}
                        className="p-3 rounded-md bg-slate-900 border border-white/10 text-slate-400 hover:text-white transition-all"
                        title="Refresh View"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
                
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input 
                        type="text" 
                        placeholder="Search acts, stages, or frequencies..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-900 border border-white/10 rounded-md pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                </div>
            </div>

            {/* List */}
            <div className="p-2 space-y-3">
                {filteredFrequencies.length === 0 ? (
                    <div className="text-center py-10 text-slate-500">
                        No frequencies found matching your search.
                    </div>
                ) : (
                    filteredFrequencies.map((freq: any) => {
                        const isChanged = changedFreqs.has(freq.id);
                        return (
                            <div 
                                key={freq.id} 
                                className={`p-2 rounded-md border transition-all duration-500 ${
                                    isChanged 
                                    ? 'bg-green-500/20 border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)]' 
                                    : 'bg-slate-900 border-white/5'
                                }`}
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <div>
                                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{freq.actName}</div>
                                        <div className="text-sm font-black text-white">{freq.equipmentKey ? freq.equipmentKey.split('-').join(' ').toUpperCase() : (freq.label || 'UNKNOWN EQUIPMENT')}</div>
                                    </div>
                                    <div className={`text-lg font-semibold font-black ${isChanged ? 'text-green-400' : 'text-indigo-400'}`}>
                                        {freq.value ? freq.value.toFixed(3) : (freq.frequency ? freq.frequency.toFixed(3) : '0.000')} <span className="text-[10px] text-slate-500">MHz</span>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5 text-[10px] font-medium text-slate-500 uppercase tracking-widest">
                                    <div className="flex items-center gap-1.5">
                                        <MapPin className="w-3 h-3" /> {freq.stage}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Radio className="w-3 h-3" /> {freq.type}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default LiveCrewView;
