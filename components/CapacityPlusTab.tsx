import React, { useState } from 'react';
import { motion } from 'motion/react';
import Card, { CardTitle } from './Card';

const primaryButton = "bg-amber-600 hover:bg-amber-500 text-white font-bold py-2 px-3 rounded transition-colors whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-amber-500";
const secondaryButton = "bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-3 rounded transition-colors whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-slate-500";
const inputClass = "bg-slate-900 border border-white/10 rounded px-3 py-2 text-white w-full focus:outline-none focus:border-amber-500 font-mono";

interface CapPlusSite {
    id: string;
    name: string;
    repeaterCount: number;
    targetSeparation: number;
    colorCode: number;
    txBandMin: number;
    txBandMax: number;
    rxBandMin: number;
    rxBandMax: number;
    isLinked: boolean;
}

interface CapPlusRepeater {
    tx: number;
    rx: number;
    label: string;
}

interface CapPlusResult {
    siteId: string;
    siteName: string;
    repeaters: CapPlusRepeater[];
}

const generateCapPlusPlan = (sites: CapPlusSite[]): CapPlusResult[] => {
    const results: CapPlusResult[] = [];
    const usedFrequencies = new Set<number>();

    // Basic IMD check for TX against existing TXs in the same site
    const hasTxIMDConflict = (newTx: number, existingTxs: number[]) => {
        for (let i = 0; i < existingTxs.length; i++) {
            for (let j = 0; j < existingTxs.length; j++) {
                // 2A - B
                const imd1 = 2 * existingTxs[i] - existingTxs[j];
                // using 12.5kHz window for collision check
                if (Math.abs(imd1 - newTx) < 0.00625) return true;
            }
            const imd2 = 2 * newTx - existingTxs[i];
            if (existingTxs.some(ex => Math.abs(imd2 - ex) < 0.00625)) return true;
        }
        return false;
    };

    sites.forEach(site => {
        const siteResult: CapPlusResult = {
            siteId: site.id,
            siteName: site.name,
            repeaters: []
        };
        const siteTxs: number[] = [];

        // Cap Plus utilizes 12.5kHz (0.0125 MHz) channel spacing
        const step = 0.0125;
        let attempts = 0;
        
        while (siteResult.repeaters.length < site.repeaterCount && attempts < 1000) {
            attempts++;
            
            // Candidate on 12.5kHz grid
            const range = site.txBandMax - site.txBandMin;
            const steps = Math.floor(range / step);
            const randomStep = Math.floor(Math.random() * steps);
            let candidateTx = site.txBandMin + randomStep * step;
            
            // Round to nearest 12.5kHz
            candidateTx = Math.round(candidateTx * 80) / 80;
            
            // Determine RX based on separation
            let candidateRx = candidateTx + site.targetSeparation;
            if (candidateRx > site.rxBandMax || candidateRx < site.rxBandMin) {
                candidateRx = candidateTx - site.targetSeparation;
            }
            candidateRx = Math.round(candidateRx * 80) / 80;

            if (candidateTx >= site.txBandMin && candidateTx <= site.txBandMax &&
                candidateRx >= site.rxBandMin && candidateRx <= site.rxBandMax) {
                
                // For Linked Capacity Plus, all repeaters across sites might need to avoid each other entirely
                // We track all used globally here via `usedFrequencies` to ensure spatial/frequency separation even for LCP
                if (!usedFrequencies.has(candidateTx) && !usedFrequencies.has(candidateRx)) {
                    // Avoid IMD primarily within the local site's combining equipment
                    if (!hasTxIMDConflict(candidateTx, siteTxs)) {
                        siteTxs.push(candidateTx);
                        siteResult.repeaters.push({
                            tx: candidateTx,
                            rx: candidateRx,
                            // Cap Plus assigns Rest / Voice dynamically, but we just list them here
                            label: `Repeater ${siteResult.repeaters.length + 1}`
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

const CapacityPlusTab: React.FC = () => {
    const [sites, setSites] = useState<CapPlusSite[]>([
        {
            id: 'site-1',
            name: 'Site 1',
            repeaterCount: 2,
            targetSeparation: 9.0,
            colorCode: 1,
            txBandMin: 450.0,
            txBandMax: 455.0,
            rxBandMin: 460.0,
            rxBandMax: 465.0,
            isLinked: false
        }
    ]);
    const [isCalculating, setIsCalculating] = useState(false);
    const [results, setResults] = useState<CapPlusResult[] | null>(null);

    const updateSite = (id: string, updates: Partial<CapPlusSite>) => {
        setSites(sites.map(s => s.id === id ? { ...s, ...updates } : s));
    };

    const addSite = () => {
        setSites([...sites, {
            id: `site-${Date.now()}`,
            name: `Site ${sites.length + 1}`,
            repeaterCount: 1,
            targetSeparation: 9.0,
            colorCode: 1,
            txBandMin: 450.0,
            txBandMax: 455.0,
            rxBandMin: 460.0,
            rxBandMax: 465.0,
            isLinked: false
        }]);
    };

    const removeSite = (id: string) => {
        setSites(sites.filter(s => s.id !== id));
    };

    const handleGenerate = () => {
        setIsCalculating(true);
        setResults(null);
        setTimeout(() => {
            const plan = generateCapPlusPlan(sites);
            setResults(plan);
            setIsCalculating(false);
        }, 500);
    };

    return (
        <div className="text-white space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="p-3 bg-amber-500/20 rounded-md border border-amber-500/30">
                        <span className="text-xl font-semibold">⚡</span>
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold font-black uppercase tracking-widest text-amber-400">Capacity Plus</h2>
                        <p className="text-sm text-slate-400">Coordinate MOTOTRBO Capacity Plus (12.5kHz TDMA) trunking sites.</p>
                    </div>
                </div>
            </div>
            
            {(results && results.length > 0) && (
                <div className="mb-8">
                    <h3 className="text-base font-medium font-black uppercase tracking-widest text-amber-400 mb-4">Coordination Results</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {results.map(res => (
                            <Card key={res.siteId}>
                                <CardTitle>{res.siteName} Assigned Repeaters</CardTitle>
                                <div className="space-y-2 p-2 relative">
                                    <div className="absolute top-0 right-2 text-[10px] font-black text-slate-500 uppercase">12.5kHz Spacing</div>
                                    {res.repeaters.length > 0 ? res.repeaters.map((c, i) => (
                                        <div key={i} className="flex justify-between items-center bg-slate-950 p-2 rounded border border-white/5">
                                            <span className="text-amber-300 font-bold text-sm">
                                                {c.label} 
                                                <span className="text-xs text-slate-500 ml-2 block">({(i*2)+1} & {(i*2)+2} logical)</span>
                                            </span>
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
                        <CardTitle>Capacity Plus Site: {site.name}</CardTitle>
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

                            <div className="flex items-center gap-2 mb-2 p-2 bg-slate-950 rounded border border-white/5">
                                <input 
                                    type="checkbox" 
                                    id={`linked-${site.id}`}
                                    checked={site.isLinked} 
                                    onChange={e => updateSite(site.id, { isLinked: e.target.checked })}
                                    className="accent-amber-500 w-4 h-4"
                                />
                                <label htmlFor={`linked-${site.id}`} className="text-sm font-bold text-slate-300 cursor-pointer">Linked Capacity Plus (Multi-Site)</label>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 bg-slate-950/50 p-3 flex-wrap rounded-md border border-white/5">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Repeaters (Voice/Data)</label>
                                    <input type="number" value={site.repeaterCount} onChange={e => updateSite(site.id, { repeaterCount: parseInt(e.target.value) || 1 })} className={inputClass} min="1" max="8" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Color Code</label>
                                    <input type="number" value={site.colorCode} onChange={e => updateSite(site.id, { colorCode: parseInt(e.target.value) || 1 })} className={inputClass} min="0" max="15" />
                                </div>
                            </div>
                            
                            <div className="space-y-3 bg-slate-950/50 p-3 rounded-md border border-white/5">
                                <h4 className="text-[10px] font-black text-amber-400 uppercase tracking-widest">RF Configuration</h4>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Repeater Tx Range</label>
                                        <div className="flex items-center gap-2">
                                            <input type="number" value={site.txBandMin} onChange={e => updateSite(site.id, { txBandMin: parseFloat(e.target.value) || 0 })} className={`${inputClass} text-xs text-center p-1`} step="1" />
                                            <span className="text-slate-500">-</span>
                                            <input type="number" value={site.txBandMax} onChange={e => updateSite(site.id, { txBandMax: parseFloat(e.target.value) || 0 })} className={`${inputClass} text-xs text-center p-1`} step="1" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Repeater Rx Range</label>
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
                
                <div onClick={addSite} className="border-2 border-dashed border-white/10 hover:border-amber-500/50 rounded-md flex items-center justify-center min-h-[300px] cursor-pointer bg-slate-900/30 hover:bg-slate-900/80 transition-all group">
                    <div className="text-center">
                        <div className="text-4xl mb-2 opacity-50 group-hover:opacity-100 transition-opacity">➕</div>
                        <div className="text-sm font-black uppercase tracking-widest text-slate-400 group-hover:text-amber-400 transition-colors">Add Capacity Plus Site</div>
                    </div>
                </div>
            </div>

            <div className="mt-8">
                <button onClick={handleGenerate} disabled={isCalculating} className={`${primaryButton} w-full py-2 text-base font-medium shadow-2xl uppercase tracking-widest`}>
                    {isCalculating ? 'COORDINATING CAPACITY PLUS...' : '⚡ GENERATE'}
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

export default CapacityPlusTab;
