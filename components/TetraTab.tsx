import React, { useState } from 'react';
import { motion } from 'motion/react';
import Card, { CardTitle } from './Card';

const primaryButton = "bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-3 rounded transition-colors whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-indigo-500";
const secondaryButton = "bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-3 rounded transition-colors whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-slate-500";
const inputClass = "bg-slate-900 border border-white/10 rounded px-3 py-2 text-white w-full focus:outline-none focus:border-indigo-500 font-mono";

interface TetraSite {
    id: string;
    name: string;
    carrierCount: number;
    targetSeparation: number;
    colorCode: number;
    txBandMin: number;
    txBandMax: number;
    rxBandMin: number;
    rxBandMax: number;
}

interface TetraCarrier {
    tx: number;
    rx: number;
    label: string;
}

interface TetraResult {
    siteId: string;
    siteName: string;
    carriers: TetraCarrier[];
}

const generateTetraPlan = (sites: TetraSite[]): TetraResult[] => {
    const results: TetraResult[] = [];
    const usedFrequencies = new Set<number>();

    // Basic 3rd order IMD check for a new TX against existing TXs
    const hasTxIMDConflict = (newTx: number, existingTxs: number[]) => {
        for (let i = 0; i < existingTxs.length; i++) {
            for (let j = 0; j < existingTxs.length; j++) {
                // 2A - B
                const imd1 = 2 * existingTxs[i] - existingTxs[j];
                if (Math.abs(imd1 - newTx) < 0.0125) return true;
                // A + B - C would require 3 existing TXs, let's stick to 2-tone for basic check
            }
            // Check if newTx creates bad IMD with existing that lands on an existing
            const imd2 = 2 * newTx - existingTxs[i];
            if (existingTxs.some(ex => Math.abs(imd2 - ex) < 0.0125)) return true;
        }
        return false;
    };

    sites.forEach(site => {
        const siteResult: TetraResult = {
            siteId: site.id,
            siteName: site.name,
            carriers: []
        };
        const siteTxs: number[] = [];

        // TETRA uses 25kHz (0.025 MHz) channel spacing
        const step = 0.025;
        let attempts = 0;
        
        while (siteResult.carriers.length < site.carrierCount && attempts < 1000) {
            attempts++;
            
            // Generate a candidate TX on the 25kHz grid
            const range = site.txBandMax - site.txBandMin;
            const steps = Math.floor(range / step);
            const randomStep = Math.floor(Math.random() * steps);
            let candidateTx = site.txBandMin + randomStep * step;
            
            // Round to nearest 25kHz to avoid floating point issues
            candidateTx = Math.round(candidateTx * 40) / 40;
            
            // Determine RX based on separation (could be +/- depending on band setup)
            let candidateRx = candidateTx + site.targetSeparation;
            if (candidateRx > site.rxBandMax || candidateRx < site.rxBandMin) {
                candidateRx = candidateTx - site.targetSeparation;
            }
            candidateRx = Math.round(candidateRx * 40) / 40;

            // Check if within bounds and not used
            if (candidateTx >= site.txBandMin && candidateTx <= site.txBandMax &&
                candidateRx >= site.rxBandMin && candidateRx <= site.rxBandMax) {
                
                if (!usedFrequencies.has(candidateTx) && !usedFrequencies.has(candidateRx)) {
                    // Check IMDs within this site's carriers
                    if (!hasTxIMDConflict(candidateTx, siteTxs)) {
                        siteTxs.push(candidateTx);
                        siteResult.carriers.push({
                            tx: candidateTx,
                            rx: candidateRx,
                            label: `Carrier ${siteResult.carriers.length + 1}`
                        });
                        usedFrequencies.add(candidateTx);
                        usedFrequencies.add(candidateRx);
                    }
                }
            }
        }
        results.push(siteResult);
    });

    return results;
};

const TetraTab: React.FC = () => {
    const [sites, setSites] = useState<TetraSite[]>([
        {
            id: 'site-1',
            name: 'Site 1',
            carrierCount: 2,
            targetSeparation: 10.0,
            colorCode: 1,
            txBandMin: 410.0,
            txBandMax: 415.0,
            rxBandMin: 420.0,
            rxBandMax: 425.0,
        }
    ]);
    const [isCalculating, setIsCalculating] = useState(false);
    const [results, setResults] = useState<TetraResult[] | null>(null);

    const updateSite = (id: string, updates: Partial<TetraSite>) => {
        setSites(sites.map(s => s.id === id ? { ...s, ...updates } : s));
    };

    const addSite = () => {
        setSites([...sites, {
            id: `site-${Date.now()}`,
            name: `Site ${sites.length + 1}`,
            carrierCount: 1,
            targetSeparation: 10.0,
            colorCode: 1,
            txBandMin: 410.0,
            txBandMax: 415.0,
            rxBandMin: 420.0,
            rxBandMax: 425.0,
        }]);
    };

    const removeSite = (id: string) => {
        setSites(sites.filter(s => s.id !== id));
    };

    const handleGenerate = () => {
        setIsCalculating(true);
        setResults(null);
        setTimeout(() => {
            const result = generateTetraPlan(sites);
            setResults(result);
            setIsCalculating(false);
        }, 500);
    };

    return (
        <div className="text-white space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="p-3 bg-indigo-500/20 rounded-md border border-indigo-500/30">
                        <span className="text-xl font-semibold">📡</span>
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold font-black uppercase tracking-widest text-indigo-400">TETRA Systems</h2>
                        <p className="text-sm text-slate-400">Coordinate Terrestrial Trunked Radio networks (25kHz TDMA).</p>
                    </div>
                </div>
            </div>
            
            {(results && results.length > 0) && (
                <div className="mb-8">
                    <h3 className="text-base font-medium font-black uppercase tracking-widest text-indigo-400 mb-4">Coordination Results</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {results.map(res => (
                            <Card key={res.siteId}>
                                <CardTitle>{res.siteName} Assigned Carriers</CardTitle>
                                <div className="space-y-2 p-2 relative">
                                    <div className="absolute top-0 right-2 text-[10px] font-black text-slate-500 uppercase">25kHz Spacing</div>
                                    {res.carriers.length > 0 ? res.carriers.map((c, i) => (
                                        <div key={i} className="flex justify-between items-center bg-slate-950 p-2 rounded border border-white/5">
                                            <span className="text-indigo-300 font-bold text-sm">{c.label}</span>
                                            <div className="flex items-center gap-2 text-sm font-mono">
                                                <div className="text-center">
                                                    <span className="text-[10px] text-slate-500 block leading-none">Tx (Base)</span>
                                                    <span className="text-white">{c.tx.toFixed(4)}</span>
                                                </div>
                                                <div className="text-center">
                                                    <span className="text-[10px] text-slate-500 block leading-none">Rx (Mobile)</span>
                                                    <span className="text-white">{c.rx.toFixed(4)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )) : <div className="text-sm text-red-400 py-2">Could not find valid frequencies. Adjust ranges.</div>}
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {sites.map((site, index) => (
                    <Card key={site.id}>
                        <CardTitle>TETRA Site: {site.name}</CardTitle>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center gap-2">
                                <input
                                    type="text"
                                    value={site.name}
                                    onChange={e => updateSite(site.id, { name: e.target.value })}
                                    className={`${inputClass} text-base font-medium font-bold`}
                                    placeholder="Site Name"
                                />
                                <button onClick={() => removeSite(site.id)} className="p-2 text-red-400 hover:text-red-300 bg-red-400/10 hover:bg-red-400/20 rounded transition-colors block">
                                    🗑️
                                </button>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 bg-slate-950/50 p-3 flex-wrap rounded-md border border-white/5">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Carriers (25kHz)</label>
                                    <input type="number" value={site.carrierCount} onChange={e => updateSite(site.id, { carrierCount: parseInt(e.target.value) || 1 })} className={inputClass} min="1" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Color Code</label>
                                    <input type="number" value={site.colorCode} onChange={e => updateSite(site.id, { colorCode: parseInt(e.target.value) || 1 })} className={inputClass} min="1" max="63" />
                                </div>
                            </div>
                            
                            <div className="space-y-3 bg-slate-950/50 p-3 rounded-md border border-white/5">
                                <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">RF Configuration</h4>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Base Tx Range</label>
                                        <div className="flex items-center gap-2">
                                            <input type="number" value={site.txBandMin} onChange={e => updateSite(site.id, { txBandMin: parseFloat(e.target.value) || 0 })} className={`${inputClass} text-xs text-center p-1`} step="1" />
                                            <span className="text-slate-500">-</span>
                                            <input type="number" value={site.txBandMax} onChange={e => updateSite(site.id, { txBandMax: parseFloat(e.target.value) || 0 })} className={`${inputClass} text-xs text-center p-1`} step="1" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Mobile Rx Range</label>
                                        <div className="flex items-center gap-2">
                                            <input type="number" value={site.rxBandMin} onChange={e => updateSite(site.id, { rxBandMin: parseFloat(e.target.value) || 0 })} className={`${inputClass} text-xs text-center p-1`} step="1" />
                                            <span className="text-slate-500">-</span>
                                            <input type="number" value={site.rxBandMax} onChange={e => updateSite(site.id, { rxBandMax: parseFloat(e.target.value) || 0 })} className={`${inputClass} text-xs text-center p-1`} step="1" />
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Tx-Rx Separation (MHz)</label>
                                    <input type="number" value={site.targetSeparation} onChange={e => updateSite(site.id, { targetSeparation: parseFloat(e.target.value) || 0 })} className={inputClass} step="0.1" />
                                </div>
                            </div>
                        </div>
                    </Card>
                ))}
                
                <div onClick={addSite} className="border-2 border-dashed border-white/10 hover:border-indigo-500/50 rounded-md flex items-center justify-center min-h-[300px] cursor-pointer bg-slate-900/30 hover:bg-slate-900/80 transition-all group">
                    <div className="text-center">
                        <div className="text-4xl mb-2 opacity-50 group-hover:opacity-100 transition-opacity">➕</div>
                        <div className="text-sm font-black uppercase tracking-widest text-slate-400 group-hover:text-indigo-400 transition-colors">Add TETRA Site</div>
                    </div>
                </div>
            </div>

            <div className="mt-8">
                <button onClick={handleGenerate} disabled={isCalculating} className={`${primaryButton} w-full py-2 text-base font-medium shadow-2xl uppercase tracking-widest`}>
                    {isCalculating ? 'COORDINATING TETRA...' : '⚡ GENERATE'}
                </button>
            </div>

            <motion.button
                drag
                dragMomentum={false}
                onClick={() => { if (!isCalculating) handleGenerate(); }}
                disabled={isCalculating}
                className={`fixed bottom-12 right-12 z-[1000] cursor-grab active:cursor-grabbing shadow-2xl flex items-center justify-center gap-3 py-3 px-4 rounded-md font-black uppercase tracking-widest transition-colors border-b-4 ring-2 text-sm ${isCalculating ? 'bg-slate-800 text-slate-500 border-slate-900 ring-slate-800/50 shadow-none' : 'bg-yellow-500 text-slate-900 border-yellow-700 hover:bg-yellow-400 ring-yellow-400/50 shadow-yellow-500/20'}`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
            >
                {isCalculating ? (
                    <><span className="w-3.5 h-3.5 border-4 border-slate-500/20 border-t-slate-500 rounded-full animate-spin"></span>COORDINATING...</>
                ) : (
                    <><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> GENERATE</>
                )}
            </motion.button>
        </div>
    );
};

export default TetraTab;
