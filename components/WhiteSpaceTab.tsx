import React, { useState, useMemo } from 'react';
import { toast } from 'sonner';
import Card, { CardTitle } from './Card';
import { US_TV_CHANNELS, UK_TV_CHANNELS } from '../constants';
import { TVChannelState } from '../types';
import TvGrid from './TvGrid';
import { gridRefToWgs84 } from '../src/lib/coordUtils';
import { useLocalStorage } from '../hooks/useLocalStorage';

const buttonBase = "px-4 py-3 rounded-sm font-bold uppercase tracking-wide transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 transform active:translate-y-0.5 shadow-sm border border-slate-700/50";
const primaryButton = `bg-gradient-to-r from-blue-500 to-cyan-600 text-white hover:brightness-110 shadow-blue-500/20 ${buttonBase}`;
const secondaryButton = `bg-slate-700 text-slate-200 border border-slate-600 hover:bg-slate-600 ${buttonBase}`;

interface WhiteSpaceTabProps {
    tvRegion?: 'uk' | 'us';
    setTvRegion?: (region: 'uk' | 'us') => void;
}

const WhiteSpaceTab: React.FC<WhiteSpaceTabProps> = ({ tvRegion = 'uk', setTvRegion }) => {
    const region = tvRegion;
    const setRegion = setTvRegion || (() => {});
    const [locationType, setLocationType] = useLocalStorage<'postcode' | 'ngr'>('whitespace_locType', 'postcode');
    const [location, setLocation] = useLocalStorage('whitespace_loc', '');
    const [hasSearched, setHasSearched] = useLocalStorage('whitespace_hasSearched', false);
    const [isGeocoding, setIsGeocoding] = useState(false);
    const [isGridLocating, setIsGridLocating] = useState(false);
    const [externalCoords, setExternalCoords] = useLocalStorage<{lat: number, lng: number, timestamp: number} | null>('whitespace_externalCoords', null);
    
    const [tvChannelStates, setTvChannelStates] = useLocalStorage<Record<number, TVChannelState>>('whitespace_tvStates', {});

    const currentChannels = useMemo(() => {
        return region === 'uk' ? UK_TV_CHANNELS : US_TV_CHANNELS;
    }, [region]);

    const totalChannels = Object.keys(currentChannels).length;
    const occupiedCount = Object.values(tvChannelStates).filter(state => state === 'blocked').length;
    const availableCount = totalChannels - occupiedCount;

    const safeRanges = useMemo(() => {
        const ranges: string[] = [];
        Object.entries(currentChannels).forEach(([chStr, rangeVal]) => {
            const [start, end] = rangeVal as [number, number];
            const ch = Number(chStr);
            if (tvChannelStates[ch] !== 'blocked') {
                ranges.push(`${start} - ${end} MHz (Ch ${ch})`);
            }
        });
        return ranges;
    }, [tvChannelStates, currentChannels]);
    
    const handleTvChannelCycle = (ch: number) => {
        setTvChannelStates(prev => {
            const currentState = prev[ch] || 'available';
            let nextState: TVChannelState = 'available';
            if (currentState === 'available') nextState = 'mic-only';
            else if (currentState === 'mic-only') nextState = 'iem-only';
            else if (currentState === 'iem-only') nextState = 'both';
            else if (currentState === 'both') nextState = 'blocked';
            else if (currentState === 'blocked') nextState = 'available';
            
            return { ...prev, [ch]: nextState };
        });
    };

    const handleBlockAllTvChannels = () => {
        const next: Record<number, TVChannelState> = {};
        Object.keys(currentChannels).forEach(ch => {
            next[Number(ch)] = 'blocked';
        });
        setTvChannelStates(next);
    };

    const handleClearTv = () => {
        setTvChannelStates({});
        setHasSearched(false);
    };

    const handleFetchByLocation = async () => {
        setHasSearched(false);
        setIsGeocoding(true);
    
        const processLocation = async (loc: string, type: 'postcode' | 'ngr') => {
            if (!loc) {
                toast.error(`Please enter a ${region === 'us' ? 'Zip Code' : 'location'}.`);
                setIsGeocoding(false);
                return;
            }
    
            let lat = 0, lng = 0;
            try {
                if (type === 'ngr' && region === 'uk') {
                    const result = gridRefToWgs84(loc);
                    if (!result) {
                        toast.error("Invalid Grid Reference format. Example: TQ 300 800");
                        setIsGeocoding(false);
                        return;
                    }
                    lat = result.lat;
                    lng = result.lng;
                } else {
                    const res = await fetch(`/api/lookup/postcode?postcode=${encodeURIComponent(loc)}&region=${region}`);
                    if (!res.ok) {
                        const errData = await res.json().catch(() => ({}));
                        throw new Error(errData.error || `${region === 'uk' ? 'Postcode' : 'ZIP code'} lookup failed`);
                    }
                    const data = await res.json();
                    lat = data.lat;
                    lng = data.lng;
                }
                
                setExternalCoords({ lat, lng, timestamp: Date.now() });
                setHasSearched(true);
            } catch (error: any) {
                toast.error(`Error processing location data: ${error.message}`);
            } finally {
                setIsGeocoding(false);
            }
        };
        
        if (location) {
             await processLocation(location, region === 'uk' ? locationType : 'postcode');
             return;
        }
    
        if (!navigator.geolocation) {
            toast.error('Geolocation is not supported by your browser. Please enter a location manually.');
            setIsGeocoding(false);
            return;
        }
        
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                setExternalCoords({ lat: latitude, lng: longitude, timestamp: Date.now() });
                setHasSearched(true);
                setIsGeocoding(false);
            },
            (error) => { 
                toast.error("Geolocation failed. Please enter manually.");
                setIsGeocoding(false);
            }
        );
    };

    const handleRegionChange = (newRegion: 'uk' | 'us') => {
        setRegion(newRegion);
        setLocationType('postcode');
        handleClearTv();
        setLocation('');
    };
    
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-1 space-y-6">
                <Card>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-blue-500/20 rounded-sm text-blue-300">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                        <CardTitle className="!mb-0">Whitespace Finder</CardTitle>
                    </div>

                    <div className="space-y-4">
                         <div>
                            <label className="text-sm text-slate-400 mb-1 block">Region</label>
                            <select value={region} onChange={(e) => handleRegionChange(e.target.value as 'uk' | 'us')} className="w-full bg-slate-800 border border-blue-500/30 rounded-md p-2 text-slate-200">
                                <option value="uk">United Kingdom</option>
                                <option value="us">United States</option>
                            </select>
                        </div>
                        {region === 'uk' && (
                             <div>
                                <label className="text-sm text-slate-400 mb-1 block">Location Type</label>
                                <select value={locationType} onChange={(e) => setLocationType(e.target.value as any)} className="w-full bg-slate-800 border border-blue-500/30 rounded-md p-2 text-slate-200">
                                    <option value="postcode">Postcode</option>
                                    <option value="ngr">National Grid Reference</option>
                                </select>
                            </div>
                        )}
                        <div>
                            <label htmlFor="location-input" className="text-sm text-slate-400 mb-1 block">
                                {region === 'us' ? 'Zip Code' : (locationType === 'postcode' ? 'Postcode' : 'Grid Reference')}
                            </label>
                            <input
                                id="location-input"
                                type="text"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                placeholder={region === 'us' ? 'e.g., 90210' : (locationType === 'postcode' ? 'e.g., SW1A' : 'e.g., TQ30')}
                                className="w-full bg-slate-800 border border-blue-500/30 rounded-md p-2 text-slate-200"
                            />
                        </div>
                    </div>
                    
                    <div className="flex flex-col gap-3 mt-4">
                        <button onClick={handleFetchByLocation} disabled={isGeocoding || isGridLocating} className={primaryButton}>
                            {(isGeocoding || isGridLocating) ? 'Searching...' : 'Find Whitespace'}
                        </button>
                         <button onClick={handleClearTv} className={secondaryButton}>
                            Clear Selections
                        </button>
                    </div>
                </Card>
            </div>

            <div className="lg:col-span-2 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="bg-slate-800/50 p-2 rounded-sm text-center border border-slate-700">
                        <p className="text-sm text-slate-400">Total Channels</p>
                        <p className="text-3xl font-bold text-white">{totalChannels}</p>
                    </div>
                    <div className="bg-slate-800/50 p-2 rounded-sm text-center border border-slate-700">
                        <p className="text-sm text-slate-400">Occupied Channels</p>
                        <p className="text-3xl font-bold text-red-400">{occupiedCount}</p>
                    </div>
                     <div className="bg-slate-800/50 p-2 rounded-sm text-center border border-slate-700">
                        <p className="text-sm text-slate-400">Available Channels</p>
                        <p className="text-3xl font-bold text-emerald-400">{availableCount}</p>
                    </div>
                </div>

                <Card>
                    <TvGrid 
                        tvRegion={region}
                        tvChannelStates={tvChannelStates}
                        setTvChannelStates={setTvChannelStates}
                        handleTvChannelCycle={handleTvChannelCycle}
                        handleBlockAllTvChannels={handleBlockAllTvChannels}
                        handleClearTv={handleClearTv}
                        title="Available TV Channels"
                        hideLocationLookup={true}
                        externalCoordinates={externalCoords}
                        onLocatingChange={setIsGridLocating}
                        showClearanceCriteriaAtTop={true}
                    />
                    {hasSearched && occupiedCount === 0 && (
                        <div className="mt-4 p-3 bg-emerald-900/40 border border-emerald-500/30 rounded-sm text-center text-emerald-300">
                            No occupied channels found for this location. All channels are marked as available.
                        </div>
                    )}
                </Card>
                 <Card>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-indigo-500/20 rounded-sm text-indigo-300">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <CardTitle className="!mb-0">TV Channel Indicator Bars Explained</CardTitle>
                    </div>
                    <div className="space-y-3 text-sm text-slate-300">
                        <p>Underneath each TV channel block in the grid above, there is a segmented bar indicating the estimated Effective Radiated Power (ERP) of any detected TV transmitters on that frequency:</p>
                        <div className="flex flex-col gap-2 mt-2">
                            <div className="flex items-center gap-3 bg-slate-800/50 p-2 rounded border border-slate-700/50">
                                <div className="flex gap-0.5 h-1.5 w-12">
                                    <div className="flex-1 rounded-sm bg-slate-800"></div>
                                    <div className="flex-1 rounded-sm bg-slate-800"></div>
                                    <div className="flex-1 rounded-sm bg-emerald-400"></div>
                                </div>
                                <span className="text-xs"><strong className="text-emerald-400 uppercase tracking-widest font-black mr-2">Green:</strong> Low Power (&le; 1kW) or perfectly clear.</span>
                            </div>
                            <div className="flex items-center gap-3 bg-slate-800/50 p-2 rounded border border-slate-700/50">
                                <div className="flex gap-0.5 h-1.5 w-12">
                                    <div className="flex-1 rounded-sm bg-slate-800"></div>
                                    <div className="flex-1 rounded-sm bg-amber-400"></div>
                                    <div className="flex-1 rounded-sm bg-slate-800"></div>
                                </div>
                                <span className="text-xs"><strong className="text-amber-400 uppercase tracking-widest font-black mr-2">Amber:</strong> Medium Power (1kW - 40kW).</span>
                            </div>
                            <div className="flex items-center gap-3 bg-slate-800/50 p-2 rounded border border-slate-700/50">
                                <div className="flex gap-0.5 h-1.5 w-12">
                                    <div className="flex-1 rounded-sm bg-red-500"></div>
                                    <div className="flex-1 rounded-sm bg-slate-800"></div>
                                    <div className="flex-1 rounded-sm bg-slate-800"></div>
                                </div>
                                <span className="text-xs"><strong className="text-red-500 uppercase tracking-widest font-black mr-2">Red:</strong> High Power (&gt; 40kW), typically a major transmitter.</span>
                            </div>
                        </div>
                    </div>
                </Card>

                <Card>
                    <CardTitle>Safe Operating Ranges</CardTitle>
                    {safeRanges.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-center">
                            {safeRanges.map((range, i) => (
                                <div key={i} className="bg-slate-700/50 p-2 rounded text-emerald-300 font-mono text-sm">{range}</div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center text-amber-400 bg-amber-900/40 p-2 rounded-sm">
                            No safe operating ranges found.
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
};

export default WhiteSpaceTab;