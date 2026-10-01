import React, { useState } from 'react';
import { toast } from 'sonner';
import { HelpCircle, Download, MapPin } from 'lucide-react';
import { UK_TV_CHANNELS, US_TV_CHANNELS } from '../constants';
import { TVChannelState } from '../types';
import { useTvLookup } from '../hooks/useTvLookup';
import { useLocalStorage } from '../hooks/useLocalStorage';

import { gridRefToWgs84, osgbToWgs84 } from '../src/lib/coordUtils';
import { InfoTooltip } from './InfoTooltip';
import SmartNumberInput from './SmartNumberInput';

interface TvGridProps {
    tvRegion: 'uk' | 'us';
    setTvRegion?: (region: 'uk' | 'us') => void;
    tvChannelStates: Record<string, TVChannelState>;
    setTvChannelStates: (states: Record<string, TVChannelState> | ((prev: Record<string, TVChannelState>) => Record<string, TVChannelState>)) => void;
    tvChannelErpData?: Record<number, { maxErp: number, transmitterName: string, distance?: number }>;
    onTvChannelErpDataChange?: (data: Record<number, { maxErp: number, transmitterName: string, distance?: number }>) => void;
    handleTvChannelCycle: (channel: number) => void;
    handleBlockAllTvChannels: () => void;
    handleClearTv: () => void;
    className?: string;
    title?: string;
    subtitle?: string;
    hideLocationLookup?: boolean;
    externalCoordinates?: { lat: number, lng: number, timestamp: number } | null;
    onLocatingChange?: (isLocating: boolean) => void;
    showClearanceCriteriaAtTop?: boolean;
}

const TvGrid: React.FC<TvGridProps> = ({
    tvRegion = 'uk',
    setTvRegion,
    tvChannelStates = {},
    setTvChannelStates,
    tvChannelErpData,
    onTvChannelErpDataChange,
    handleTvChannelCycle,
    handleBlockAllTvChannels,
    handleClearTv,
    className = "",
    title = "Quad-State TV Grid",
    subtitle,
    hideLocationLookup = false,
    externalCoordinates,
    onLocatingChange,
    showClearanceCriteriaAtTop = false
}) => {
    const { handleLookup, isLocating, tvChannelErpData: hookErpData, setTvChannelErpData } = useTvLookup(tvRegion, tvChannelStates, setTvChannelStates);
    const lastSentErpRef = React.useRef<string>("");

    React.useEffect(() => {
        const dataStr = JSON.stringify(hookErpData);
        if (onTvChannelErpDataChange && hookErpData && dataStr !== lastSentErpRef.current) {
            lastSentErpRef.current = dataStr;
            onTvChannelErpDataChange(hookErpData);
        }
    }, [hookErpData, onTvChannelErpDataChange]);
    const [coordType, setCoordType] = useLocalStorage<'latlng' | 'osgb' | 'gridref' | 'postcode'>('tvgrid_coordType', 'latlng');
    const [latInput, setLatInput] = useLocalStorage('tvgrid_latInput', '');
    const [lngInput, setLngInput] = useLocalStorage('tvgrid_lngInput', '');
    const [osgbEasting, setOsgbEasting] = useLocalStorage('tvgrid_osgbEasting', '');
    const [osgbNorthing, setOsgbNorthing] = useLocalStorage('tvgrid_osgbNorthing', '');
    const [gridRefInput, setGridRefInput] = useLocalStorage('tvgrid_gridRefInput', '');
    const [postcodeInput, setPostcodeInput] = useLocalStorage('tvgrid_postcodeInput', '');
    const [locationName, setLocationName] = useLocalStorage('tvgrid_locationName', '');
    const [isGeocoding, setIsGeocoding] = useState(false);

    const [isInternal, setIsInternal] = useLocalStorage('tvgrid_isInternal', false);
    const [buildingType, setBuildingType] = useLocalStorage('tvgrid_buildingType', '5');
    const [customOffset, setCustomOffset] = useLocalStorage('tvgrid_customOffset', '0');
    const [elevation, setElevation] = useLocalStorage('tvgrid_elevation', '0');
    const [lastLookupCoords, setLastLookupCoords] = useLocalStorage<{lat: number, lng: number, timestamp: number} | null>('tvgrid_lastLookup', null);

    const [infoChannel, setInfoChannel] = useState<number | null>(null);
    const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
    const [isLongPressTriggered, setIsLongPressTriggered] = useState(false);

    React.useEffect(() => {
        if (tvRegion === 'us' && (coordType === 'osgb' || coordType === 'gridref')) {
            setCoordType('latlng');
        }
    }, [tvRegion, coordType]);

    React.useEffect(() => {
        if (externalCoordinates) {
            setLastLookupCoords(externalCoordinates);
        }
    }, [externalCoordinates]);

    React.useEffect(() => {
        if (onLocatingChange) {
            onLocatingChange(isLocating || isGeocoding);
        }
    }, [isLocating, isGeocoding, onLocatingChange]);

    const hasMounted = React.useRef(false);

    React.useEffect(() => {
        if (!hasMounted.current) {
            hasMounted.current = true;
            return;
        }
        if (lastLookupCoords) {
            const baseOffset = isInternal ? (buildingType === 'custom' ? parseFloat(customOffset) || 0 : parseFloat(buildingType)) : 0;
            const elevationMod = parseFloat(elevation) || 0;
            const currentOffset = baseOffset + elevationMod;
            const env = isInternal ? 'indoor' : 'outdoor';
            handleLookup(lastLookupCoords.lat, lastLookupCoords.lng, currentOffset, env);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isInternal, buildingType, customOffset, elevation, lastLookupCoords]);

    const handleTouchStart = (ch: number) => {
        setIsLongPressTriggered(false);
        const timer = setTimeout(() => {
            setIsLongPressTriggered(true);
            setInfoChannel(ch);
        }, 500);
        setLongPressTimer(timer);
    };

    const handleTouchMove = () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            setLongPressTimer(null);
        }
    };

    const handleTouchEnd = () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            setLongPressTimer(null);
        }
    };

    const handleClick = (ch: number, e: React.MouseEvent) => {
        if (isLongPressTriggered) {
            e.preventDefault();
            e.stopPropagation();
            setIsLongPressTriggered(false);
            return;
        }

        const chStr = ch.toString();
        const state = (tvChannelStates || {})[chStr] || 'available';
        const erpData = tvChannelErpData?.[ch] || hookErpData?.[ch];
        
        console.log("TvGrid: handleClick ch:", ch, "state:", state, "erpData:", !!erpData);
        
        handleTvChannelCycle(ch);
    };

    const channels = (tvRegion === 'uk' ? UK_TV_CHANNELS : US_TV_CHANNELS) || {};

    const exportToCSV = () => {
        const dateStr = new Date().toISOString().split('T')[0];
        
        let csvContent = `TV Grid Report\n`;
        csvContent += `Date,${dateStr}\n`;
        csvContent += `Region,${tvRegion.toUpperCase()}\n`;
        if (lastLookupCoords) {
            csvContent += `Location,${lastLookupCoords.lat.toFixed(6)},${lastLookupCoords.lng.toFixed(6)}\n`;
        }
        
        const envStr = isInternal ? 'Internal' : 'External';
        csvContent += `Environment,${envStr}\n`;
        
        if (isInternal) {
            let bTypeStr = '';
            if (buildingType === '0') bTypeStr = 'Outdoor / Line of Sight (0 dB)';
            else if (buildingType === '5') bTypeStr = 'Tent / Temporary Structure (5 dB)';
            else if (buildingType === '10') bTypeStr = 'Light Building / Windows (10 dB)';
            else if (buildingType === '20') bTypeStr = 'Standard Brick / Concrete (20 dB)';
            else if (buildingType === '30') bTypeStr = 'Heavy Arena / Basement (30 dB)';
            else if (buildingType === 'custom') bTypeStr = `Custom (${customOffset} dB)`;
            csvContent += `Building Shielding,${bTypeStr}\n`;
        }
        
        let elStr = '';
        if (elevation === '10') elStr = 'Basement / Underground (+10 dB)';
        else if (elevation === '0') elStr = 'Ground Level (0 dB)';
        else if (elevation === '-5') elStr = 'Elevated / Floors 1-4 (-5 dB)';
        else if (elevation === '-10') elStr = 'High Rise / Floors 5+ (-10 dB)';
        csvContent += `Elevation,${elStr}\n\n`;
        
        csvContent += "Channel,Frequency Range (MHz),Status,Transmitter,Max ERP (kW),Distance (km)\n";
        
        Object.entries(channels).forEach(([chStr, [start, end]]) => {
            const ch = parseInt(chStr);
            const state = (tvChannelStates || {})[chStr] || 'available';
            const erpData = tvChannelErpData?.[ch] || hookErpData?.[ch];
            
            let statusStr = 'Clear';
            if (state === 'blocked') statusStr = 'Blocked';
            else if (state === 'mic-only') statusStr = 'Mic Only';
            else if (state === 'iem-only') statusStr = 'IEM Only';
            else if (state === 'both') statusStr = 'Mic + IEM';
            
            const transmitter = erpData ? `"${erpData.transmitterName}"` : 'N/A';
            const erp = erpData ? erpData.maxErp : 'N/A';
            const dist = erpData?.distance ? erpData.distance.toFixed(2) : 'N/A';
            
            csvContent += `${ch},${start}-${end},${statusStr},${transmitter},${erp},${dist}\n`;
        });
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        
        const locationStr = lastLookupCoords ? `${lastLookupCoords.lat.toFixed(4)}_${lastLookupCoords.lng.toFixed(4)}` : 'unknown_location';
        link.setAttribute('download', `TV_Grid_Report_${tvRegion.toUpperCase()}_${locationStr}_${dateStr}.csv`);
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast.success("TV Grid exported to CSV");
    };

    const handleManualLookup = async () => {
        let lat = 0, lng = 0;
        if (coordType === 'latlng') {
            lat = parseFloat(latInput);
            lng = parseFloat(lngInput);
        } else if (coordType === 'osgb') {
            const result = osgbToWgs84(parseFloat(osgbEasting), parseFloat(osgbNorthing));
            lat = result.lat;
            lng = result.lng;
        } else if (coordType === 'gridref') {
            const result = gridRefToWgs84(gridRefInput);
            if (!result) {
                toast.error("Invalid Grid Reference format. Example: TQ 300 800");
                return;
            }
            lat = result.lat;
            lng = result.lng;
        } else if (coordType === 'postcode') {
            if (!postcodeInput.trim()) {
                toast.error(`Please enter a ${tvRegion === 'uk' ? 'postcode' : 'ZIP code'}`);
                return;
            }
            setIsGeocoding(true);
            try {
                const res = await fetch(`/api/lookup/postcode?postcode=${encodeURIComponent(postcodeInput)}&region=${tvRegion}`);
                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData.error || `${tvRegion === 'uk' ? 'Postcode' : 'ZIP code'} lookup failed`);
                }
                const data = await res.json();
                lat = data.lat;
                lng = data.lng;
                if (data.name) setLocationName(data.name);
            } catch (err: any) {
                toast.error(err.message || "Location lookup failed");
                setIsGeocoding(false);
                return;
            }
            setIsGeocoding(false);
        }
        
        if (isNaN(lat) || isNaN(lng)) {
            toast.error("Invalid coordinates");
            return;
        }

        setLastLookupCoords({lat, lng, timestamp: Date.now()});
    };

    const handleLocateMe = () => {
        if (!navigator.geolocation) {
            toast.error("Geolocation is not supported by your browser");
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                setLastLookupCoords({lat, lng, timestamp: Date.now()});
            },
            (err) => {
                console.error("Geolocation error:", err);
                toast.error("Failed to get your location. Please check permissions.");
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    return (
        <div className={`space-y-4 ${className}`}>
            <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                    {title ? (
                        <div>
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 flex items-center">
                                {title}
                                {title === "Quad-State TV Grid" && (
                                    <InfoTooltip content="Manage TV channel exclusions. Click a channel to cycle through states: Available (Green), Blocked (Red). During coordination, designate channels for Mics Only (Blue), IEMs Only (Amber), Mic or IEM (Purple)" />
                                )}
                            </h4>
                            {subtitle && <p className="text-[8px] text-slate-400 uppercase tracking-wider mt-0.5">{subtitle}</p>}
                            
                                {showClearanceCriteriaAtTop && (
                                    <div className="flex items-center gap-1.5 mt-2 mb-1">
                                        <span className="text-[8px] font-black uppercase text-slate-500 tracking-widest">TV Channel Clearance Criteria</span>
                                        <InfoTooltip size={10} content={
                                            <div className="w-96 font-mono pointer-events-none text-[10px] leading-relaxed">
                                                <p className="font-bold text-slate-300 mb-3">TV channel status is a derivation of equation:</p>
                                                <p className="text-center text-xs text-indigo-300 mb-4 font-bold border border-indigo-500/30 bg-indigo-500/10 p-2 rounded">
                                                    P<sub>Mic</sub> - (P<sub>TV,8MHz</sub> - 16) + 10n<sub>env</sub>log<sub>10</sub>(d<sub>TV</sub>/d<sub>Mic</sub>) + (BPL<sub>TV</sub> - BPL<sub>Mic</sub>) + (Elev<sub>TV</sub> - Elev<sub>Mic</sub>) ≥ Margin<sub>env</sub>
                                                </p>
                                                <div className="space-y-4">
                                                    <div>
                                                        <p className="text-slate-200 font-bold mb-0.5">1. Mic transmitter power</p>
                                                        <p className="pl-3 text-slate-400"><span className="text-indigo-300 font-bold">P<sub>Mic</sub>:</span> Your mic's transmit power in dBm.</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-slate-200 font-bold mb-0.5">2. TV power in the mic's 200 kHz bandwidth</p>
                                                        <p className="pl-3 text-slate-400"><span className="text-indigo-300 font-bold">P<sub>TV,200kHz</sub> = P<sub>TV,8MHz</sub> - 16 dB</span></p>
                                                        <p className="pl-3 text-slate-400 mt-1">Because 10log<sub>10</sub>(200kHz/8MHz) ≈ -16 dB. This is essential. It prevents you from overestimating TV interference by a full 8 MHz.</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-slate-200 font-bold mb-0.5">3. Distance / propagation</p>
                                                        <p className="pl-3 text-slate-400"><span className="text-indigo-300 font-bold">10n<sub>env</sub>log<sub>10</sub>(d<sub>TV</sub> / d<sub>Mic</sub>)</span></p>
                                                        <p className="pl-3 text-slate-400 mt-1">Where n<sub>env</sub> = 2 (free space), 2.7 (suburban), 3-4 (urban / cluttered). This replaces the old 20log(d) term with a physically correct model.</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-slate-200 font-bold mb-0.5">4. Environment losses</p>
                                                        <p className="pl-3 text-slate-400"><span className="text-indigo-300 font-bold">(BPL<sub>TV</sub> - BPL<sub>Mic</sub>) + (Elev<sub>TV</sub> - Elev<sub>Mic</sub>)</span></p>
                                                        <p className="pl-3 text-slate-400 mt-1">Allows: Outdoor → set all to 0. Indoor → add building penetration and floor losses. Mixed cases → TV suffers BPL, mic does not.</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-slate-200 font-bold mb-0.5">5. Required SIR</p>
                                                        <p className="pl-3 text-slate-400"><span className="text-indigo-300 font-bold">Margin<sub>env</sub>:</span> Typically 40 dB outdoors, 30 dB indoors.</p>
                                                    </div>
                                                </div>
                                            </div>
                                        } />
                                    </div>
                                )}

                        </div>
                    ) : (
                        <div />
                    )}
                    <div className="flex gap-2">
                        {setTvRegion && (
                            <select value={tvRegion} onChange={e => setTvRegion(e.target.value as any)} className="bg-slate-800 text-[10px] border border-slate-700 rounded px-1 py-1 text-slate-200 font-bold outline-none">
                                <option value="uk">UK</option>
                                <option value="us">US</option>
                            </select>
                        )}
                        <button onClick={exportToCSV} className="text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-1 rounded hover:bg-emerald-600 hover:text-white transition-all flex items-center gap-1">
                            <Download size={10} /> Export CSV
                        </button>
                        <button onClick={handleBlockAllTvChannels} className="text-[9px] font-black uppercase bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2 py-1 rounded hover:bg-rose-600 hover:text-white transition-all">Block All</button>
                        <button onClick={() => { handleClearTv(); setTvChannelErpData({}); }} className="text-[9px] font-black uppercase bg-slate-800 text-slate-400 border border-slate-700 px-2 py-1 rounded hover:bg-slate-700 hover:text-white transition-all">Clear All</button>
                    </div>
                </div>

                {!hideLocationLookup && (
                    <div className="flex flex-wrap items-center gap-2 bg-slate-900/50 p-2 rounded-sm border border-slate-700">
                        <div className="flex items-center gap-2 border-r border-slate-700 pr-2 mr-1">
                            <MapPin size={12} className="text-indigo-400" />
                            <input 
                                type="text" 
                                placeholder="Site Name (Optional)" 
                                value={locationName} 
                                onChange={e => setLocationName(e.target.value)} 
                                className="w-32 bg-transparent text-[10px] text-indigo-300 font-bold placeholder:text-slate-500 outline-none" 
                            />
                        </div>
                        <select 
                            value={coordType} 
                            onChange={(e) => setCoordType(e.target.value as any)}
                            className="bg-slate-800 text-[10px] border border-slate-700 rounded px-1 py-1 text-slate-200 font-bold outline-none"
                        >
                            <option value="latlng">Lat/Lng</option>
                            {tvRegion === 'uk' && <option value="osgb">East/North</option>}
                            {tvRegion === 'uk' && <option value="gridref">Grid Ref</option>}
                            <option value="postcode">{tvRegion === 'uk' ? 'Postcode' : 'ZIP Code'}</option>
                        </select>
                        
                        {coordType === 'latlng' && (
                            <>
                                <SmartNumberInput 
                                    id="tv-lat"
                                    value={parseFloat(latInput) || 0}
                                    onChange={(_, val) => setLatInput(val)}
                                    placeholder="51.507"
                                    format={false}
                                    className="w-20 bg-slate-800 text-xs border border-slate-700 rounded px-1 py-1 text-slate-200 font-bold placeholder:text-slate-500"
                                />
                                <SmartNumberInput 
                                    id="tv-lng"
                                    value={parseFloat(lngInput) || 0}
                                    onChange={(_, val) => setLngInput(val)}
                                    placeholder="-0.127"
                                    format={false}
                                    className="w-20 bg-slate-800 text-xs border border-slate-700 rounded px-1 py-1 text-slate-200 font-bold placeholder:text-slate-500"
                                />
                            </>
                        )}

                        {coordType === 'osgb' && (
                            <>
                                <SmartNumberInput 
                                    id="tv-easting"
                                    value={parseFloat(osgbEasting) || 0}
                                    onChange={(_, val) => setOsgbEasting(val)}
                                    placeholder="Eastings"
                                    format={false}
                                    className="w-20 bg-slate-800 text-xs border border-slate-700 rounded px-1 py-1 text-slate-200 font-bold placeholder:text-slate-500"
                                />
                                <SmartNumberInput 
                                    id="tv-northing"
                                    value={parseFloat(osgbNorthing) || 0}
                                    onChange={(_, val) => setOsgbNorthing(val)}
                                    placeholder="Northings"
                                    format={false}
                                    className="w-20 bg-slate-800 text-xs border border-slate-700 rounded px-1 py-1 text-slate-200 font-bold placeholder:text-slate-500"
                                />
                            </>
                        )}

                        {coordType === 'gridref' && (
                            <input type="text" placeholder="TQ 300 800" value={gridRefInput} onChange={e => setGridRefInput(e.target.value)} className="w-24 bg-slate-800 text-xs border border-slate-700 rounded px-1 py-1 text-slate-200 font-bold placeholder:text-slate-500" />
                        )}

                        {coordType === 'postcode' && (
                            <input type="text" placeholder={tvRegion === 'uk' ? "SW1A 1AA" : "90210"} value={postcodeInput} onChange={e => setPostcodeInput(e.target.value)} className="w-24 bg-slate-800 text-xs border border-slate-700 rounded px-1 py-1 text-slate-200 font-bold placeholder:text-slate-500" />
                        )}

                        <button 
                            onClick={handleManualLookup} 
                            disabled={isLocating || isGeocoding}
                            className={`text-xs font-black uppercase bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2 py-1 rounded hover:bg-indigo-600 hover:text-white transition-all ${(isLocating || isGeocoding) ? 'animate-pulse' : ''}`}
                        >
                            {isGeocoding ? 'Looking up...' : 'Lookup'}
                        </button>
                        <button 
                            onClick={handleLocateMe} 
                            disabled={isLocating || isGeocoding}
                            className={`text-xs font-black uppercase bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2 py-1 rounded hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-1.5 ${(isLocating || isGeocoding) ? 'animate-pulse' : ''}`}
                        >
                            {isLocating ? <span className="w-2 h-2 border border-white/20 border-t-white rounded-full animate-spin" /> : '📍'}
                            {isLocating ? 'Locating...' : 'Locate Me'}
                        </button>
                    </div>
                )}
                
                <div className="flex flex-wrap items-center gap-2 bg-slate-900/50 p-2 rounded-sm border border-slate-700">
                    <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${!isInternal ? 'text-indigo-400' : 'text-slate-500'}`}>External</span>
                        <button 
                            onClick={() => setIsInternal(!isInternal)}
                            className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${isInternal ? 'bg-indigo-500' : 'bg-slate-600'}`}
                        >
                            <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${isInternal ? 'translate-x-4' : 'translate-x-1'}`} />
                        </button>
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${isInternal ? 'text-indigo-400' : 'text-slate-500'}`}>Internal</span>
                    </div>

                    <div className="flex items-center gap-2 border-l border-slate-700 pl-4">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Elevation:</span>
                        <select 
                            value={elevation} 
                            onChange={(e) => setElevation(e.target.value)}
                            className="bg-slate-800 text-[10px] border border-slate-700 rounded px-2 py-1 text-slate-200 font-bold outline-none"
                        >
                            <option value="10">Basement / Underground (+10 dB)</option>
                            <option value="0">Ground Level (0 dB)</option>
                            <option value="-5">Elevated / Floors 1-4 (-5 dB)</option>
                            <option value="-10">High Rise / Floors 5+ (-10 dB)</option>
                        </select>
                    </div>

                    {isInternal && (
                        <div className="flex items-center gap-2 border-l border-slate-700 pl-4">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Building Shielding:</span>
                            <select 
                                value={buildingType} 
                                onChange={(e) => setBuildingType(e.target.value)}
                                className="bg-slate-800 text-[10px] border border-slate-700 rounded px-2 py-1 text-slate-200 font-bold outline-none"
                            >
                                <option value="0">Outdoor / Line of Sight (0 dB)</option>
                                <option value="5">Tent / Temporary Structure (5 dB)</option>
                                <option value="10">Light Building / Windows (10 dB)</option>
                                <option value="20">Standard Brick / Concrete (20 dB)</option>
                                <option value="30">Heavy Arena / Basement (30 dB)</option>
                                <option value="custom">Custom Offset</option>
                            </select>
                            
                            {buildingType === 'custom' && (
                                <div className="flex items-center gap-1">
                                    <SmartNumberInput 
                                        id="tv-custom-offset"
                                        value={parseFloat(customOffset) || 0}
                                        onChange={(_, val) => setCustomOffset(val)}
                                        placeholder="dB"
                                        format={false}
                                        className="w-16 bg-slate-800 text-xs border border-slate-700 rounded px-1 py-1 text-slate-200 font-bold placeholder:text-slate-500" 
                                    />
                                    <span className="text-[10px] font-bold text-slate-400">dB</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-11 gap-2">
                {Object.entries(channels).map(([chStr, [start, end]]) => {
                    const ch = parseInt(chStr);
                    const state = (tvChannelStates || {})[chStr] || 'available';
                    const erpData = tvChannelErpData?.[ch] || hookErpData?.[ch];

                    if (state === 'blocked') {
                        // toast.info(`Channel ${ch} is blocked. erpData exists: ${!!erpData}`);
                    }

                    let channelClasses = 'p-1.5 text-center rounded-sm border-2 transition-all cursor-pointer select-none ';
                    if (state === 'blocked') {
                        channelClasses += 'bg-red-600 border-red-500 hover:bg-red-500 shadow-sm border border-slate-700/50';
                    }
                    else if (state === 'mic-only') channelClasses += 'bg-sky-400 border-sky-300 hover:bg-sky-300 shadow-sm border border-slate-700/50';
                    else if (state === 'iem-only') channelClasses += 'bg-amber-500 border-amber-400 hover:bg-amber-400 shadow-sm border border-slate-700/50';
                    else if (state === 'both') channelClasses += 'bg-indigo-600 border-indigo-500 hover:bg-indigo-500 shadow-sm border border-slate-700/50';
                    else channelClasses += 'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/50';

                    return (
                        <div key={ch} className="flex flex-col gap-1">
                            <button 
                                onClick={(e) => handleClick(ch, e)}
                                onTouchStart={() => handleTouchStart(ch)}
                                onTouchMove={handleTouchMove}
                                onTouchEnd={handleTouchEnd}
                                onTouchCancel={handleTouchEnd}
                                className={channelClasses} 
                                title={erpData ? `${erpData.transmitterName} (ERP: ${erpData.maxErp}kW${erpData.distance ? `, Dist: ${erpData.distance}km` : ''})` : `${start}-${end} MHz`}
                            >
                                <div className={`text-[10px] font-black ${state === 'available' ? 'text-emerald-400' : 'text-white'}`}>{ch}</div>
                                <div className="mt-0.5 text-[7px] font-black uppercase text-white/80">
                                    {state === 'mic-only' && 'MIC'}
                                    {state === 'iem-only' && 'IEM'}
                                    {state === 'both' && 'M+I'}
                                    {state === 'blocked' && (erpData ? 'TV' : 'BLOCKED')}
                                    {state === 'available' && '—'}
                                </div>
                            </button>
                            <div className="flex gap-0.5 h-1 w-full">
                                <div className={`flex-1 rounded-sm ${(erpData?.maxErp ?? 0) > 40 ? 'bg-red-500' : 'bg-slate-800'}`} />
                                <div className={`flex-1 rounded-sm ${(erpData?.maxErp ?? 0) > 1 && (erpData?.maxErp ?? 0) <= 40 ? 'bg-amber-400' : 'bg-slate-800'}`} />
                                <div className={`flex-1 rounded-sm ${(erpData?.maxErp ?? 0) <= 1 || !erpData ? 'bg-emerald-400' : 'bg-slate-800'}`} />
                            </div>
                        </div>
                    );
                })}
            </div>
            {/* Legend and Instructions */}
            <div className="mt-4 pt-4 border-t border-white/5">
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded bg-red-600 border border-red-500"></div>
                        <span className="text-[8px] font-black uppercase text-slate-400">TV / Blocked</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded bg-sky-400 border border-sky-300"></div>
                        <span className="text-[8px] font-black uppercase text-slate-400">Mic Only</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded bg-amber-500 border border-amber-400"></div>
                        <span className="text-[8px] font-black uppercase text-slate-400">IEM Only</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded bg-indigo-600 border border-indigo-500"></div>
                        <span className="text-[8px] font-black uppercase text-slate-400">Both M+I</span>
                    </div>
                </div>
                <div className="mt-3 flex flex-col items-center gap-1">
                    <p className="text-[7px] text-slate-600 font-medium uppercase tracking-widest text-center max-w-lg">
                        Channels clear (Emerald) if no transmitter/scan detected. Manual overrides (Mic/IEM/Both) exclude equipment types. Use 'Clear All' to reset.
                    </p>
                    {!showClearanceCriteriaAtTop && (
                        <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[8px] font-black uppercase text-slate-500 tracking-widest">TV Channel Clearance Criteria</span>
                            <InfoTooltip size={10} content={
                                <div className="w-96 font-mono pointer-events-none text-[10px] leading-relaxed">
                                    <p className="font-bold text-slate-300 mb-3">TV channel status is a derivation of equation:</p>
                                    <p className="text-center text-xs text-indigo-300 mb-4 font-bold border border-indigo-500/30 bg-indigo-500/10 p-2 rounded">
                                        P<sub>Mic</sub> - (P<sub>TV,8MHz</sub> - 16) + 10n<sub>env</sub>log<sub>10</sub>(d<sub>TV</sub>/d<sub>Mic</sub>) + (BPL<sub>TV</sub> - BPL<sub>Mic</sub>) + (Elev<sub>TV</sub> - Elev<sub>Mic</sub>) ≥ Margin<sub>env</sub>
                                    </p>
                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-slate-200 font-bold mb-0.5">1. Mic transmitter power</p>
                                            <p className="pl-3 text-slate-400"><span className="text-indigo-300 font-bold">P<sub>Mic</sub>:</span> Your mic's transmit power in dBm.</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-200 font-bold mb-0.5">2. TV power in the mic's 200 kHz bandwidth</p>
                                            <p className="pl-3 text-slate-400"><span className="text-indigo-300 font-bold">P<sub>TV,200kHz</sub> = P<sub>TV,8MHz</sub> - 16 dB</span></p>
                                            <p className="pl-3 text-slate-400 mt-1">Because 10log<sub>10</sub>(200kHz/8MHz) ≈ -16 dB. This is essential. It prevents you from overestimating TV interference by a full 8 MHz.</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-200 font-bold mb-0.5">3. Distance / propagation</p>
                                            <p className="pl-3 text-slate-400"><span className="text-indigo-300 font-bold">10n<sub>env</sub>log<sub>10</sub>(d<sub>TV</sub> / d<sub>Mic</sub>)</span></p>
                                            <p className="pl-3 text-slate-400 mt-1">Where n<sub>env</sub> = 2 (free space), 2.7 (suburban), 3-4 (urban / cluttered). This replaces the old 20log(d) term with a physically correct model.</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-200 font-bold mb-0.5">4. Environment losses</p>
                                            <p className="pl-3 text-slate-400"><span className="text-indigo-300 font-bold">(BPL<sub>TV</sub> - BPL<sub>Mic</sub>) + (Elev<sub>TV</sub> - Elev<sub>Mic</sub>)</span></p>
                                            <p className="pl-3 text-slate-400 mt-1">Allows: Outdoor → set all to 0. Indoor → add building penetration and floor losses. Mixed cases → TV suffers BPL, mic does not.</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-200 font-bold mb-0.5">5. Required SIR</p>
                                            <p className="pl-3 text-slate-400"><span className="text-indigo-300 font-bold">Margin<sub>env</sub>:</span> Typically 40 dB outdoors, 30 dB indoors.</p>
                                        </div>
                                    </div>
                                </div>
                            } />
                        </div>
                    )}
                </div>
            </div>

            {infoChannel !== null && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-2" onClick={() => setInfoChannel(null)}>
                    <div className="bg-slate-900 border border-slate-700 p-4 rounded-md w-full max-w-sm text-slate-200" onClick={e => e.stopPropagation()}>
                        <h3 className="text-base font-medium font-bold mb-4 text-indigo-400">Channel {infoChannel} Info</h3>
                        {tvChannelErpData?.[infoChannel] || hookErpData?.[infoChannel] ? (
                            <div className="space-y-2">
                                <p><span className="text-slate-500">Transmitter:</span> {(tvChannelErpData?.[infoChannel] || hookErpData?.[infoChannel])!.transmitterName}</p>
                                <p><span className="text-slate-500">Max ERP:</span> {(tvChannelErpData?.[infoChannel] || hookErpData?.[infoChannel])!.maxErp} kW</p>
                                {(tvChannelErpData?.[infoChannel] || hookErpData?.[infoChannel])!.distance && (
                                    <p><span className="text-slate-500">Distance:</span> {(tvChannelErpData?.[infoChannel] || hookErpData?.[infoChannel])!.distance} km</p>
                                )}
                            </div>
                        ) : (
                            <p className="text-slate-500">No transmitter data available for this channel.</p>
                        )}
                        <button onClick={() => setInfoChannel(null)} className="mt-6 w-full bg-indigo-600 text-white py-2 rounded-sm font-bold">Close</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TvGrid;
