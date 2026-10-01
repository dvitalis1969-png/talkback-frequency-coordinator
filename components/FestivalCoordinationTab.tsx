
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Shield, Zap } from 'lucide-react';
import { 
    FestivalAct, ConstantSystemRequest, EquipmentRequest, ZoneConfig, Thresholds, EquipmentProfile, Frequency, Conflict, ScanDataPoint, TxType, CompatibilityLevel, SiteMapState, OptimizationReport, OptimizationSuggestion, BottleneckStats, TVChannelState, WMASState, GeneratorRequest, UnifiedFestivalState
} from '../types';
import { generateSiteInfrastructure, generateFestivalPlan, generateConstantFrequencies, generateHouseSystemsFrequencies, validateFestivalCompatibility, getCoordinationDiagnostics, CoordinationDiagnostic, getFinalThresholds, checkCompatibility } from '../services/rfService';
import { EQUIPMENT_DATABASE, COMPATIBILITY_PROFILES, UK_TV_CHANNELS, US_TV_CHANNELS, WMAS_PRESET_PROFILES } from '../constants';
import { gridRefToWgs84, osgbToWgs84 } from '../src/lib/coordUtils';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { generateBrandedPdf, getTableStyles, generateFullCoordinationPdf } from '../src/utils/pdfBranding';
import Card, { CardTitle } from './Card';
import TvGrid from './TvGrid';
import SpectrumVisualizer from './SpectrumVisualizer';
import AnalyzerControls from './AnalyzerControls';
import LiveScanAnalyzer from './LiveScanAnalyzer';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useDebounce } from '../hooks/useDebounce';
import { toast } from 'sonner';
import { InfoTooltip } from './InfoTooltip';
import { EngagingLoadingState, CelebratorySuccessState } from './EngagingStates';
import PdfPreviewModal from './PdfPreviewModal';
import LiveShareModal from './LiveShareModal';
import SmartNumberInput from './SmartNumberInput';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";
import { SerialDevice } from '../services/serialService';

// Helper to parse dates in multiple formats, specifically handling DD/MM/YYYY
const parseFlexibleDate = (dateStr: string): Date => {
    if (!dateStr) return new Date();
    
    const cleanStr = dateStr.replace(/^["']|["']$/g, '').trim();
    const dmyMatch = cleanStr.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?$/);
    
    if (dmyMatch) {
        const [_, day, month, year, hour = '00', min = '00'] = dmyMatch;
        const isoStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${min.padStart(2, '0')}:00`;
        const date = new Date(isoStr);
        if (!isNaN(date.getTime())) return date;
    }
    
    const nativeParsed = new Date(cleanStr);
    return isNaN(nativeParsed.getTime()) ? new Date() : nativeParsed;
};

interface FestivalCoordinationTabProps {
    festivalState: UnifiedFestivalState;
    setFestivalState: React.Dispatch<React.SetStateAction<UnifiedFestivalState>>;
    setActiveTab?: (tab: string) => void;
    constantSystems: ConstantSystemRequest[];
    setConstantSystems: React.Dispatch<React.SetStateAction<ConstantSystemRequest[]>>;
    houseSystems: ConstantSystemRequest[];
    setHouseSystems: React.Dispatch<React.SetStateAction<ConstantSystemRequest[]>>;
    zoneConfigs: ZoneConfig[];
    setZoneConfigs: (configs: ZoneConfig[]) => void;
    numZones: number;
    setNumZones: (num: number) => void;
    distances: number[][];
    setDistances: (distances: number[][]) => void;
    initialThresholds: Thresholds;
    customEquipment: EquipmentProfile[];
    compatibilityMatrix: boolean[][];
    setCompatibilityMatrix: React.Dispatch<React.SetStateAction<boolean[][]>>;
    scanData: ScanDataPoint[] | null;
    setScanData?: (data: ScanDataPoint[] | null) => void;
    siteMapState: SiteMapState;
    equipmentOverrides?: Record<string, Partial<Thresholds>>;
    setEquipmentOverrides?: React.Dispatch<React.SetStateAction<Record<string, Partial<Thresholds>>>>;
    onSimulateScan?: () => void;
    wmasState?: WMASState;
    setWmasState?: React.Dispatch<React.SetStateAction<WMASState>>;
    setIsCalculating?: (is: boolean) => void;
    user?: any;
    currentProject?: any;
    serialDevice?: SerialDevice | null;
    serialStatus?: string;
    serialIsScanning?: boolean;
    setSerialIsScanning?: (is: boolean) => void;
    onConnectSerial?: (type: 'tinysa' | 'rfexplorer') => Promise<void>;
    onDisconnectSerial?: () => Promise<void>;
    onAutoDetectSerial?: (type: 'tinysa' | 'rfexplorer') => Promise<void>;
    scanStartFreq?: number;
    setScanStartFreq?: (f: number) => void;
    scanStopFreq?: number;
    setScanStopFreq?: (f: number) => void;
}

const buttonBase = "px-3 py-2 rounded-sm font-semibold uppercase tracking-wide transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 transform active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed text-[10px]";
const primaryButton = `bg-slate-700 text-slate-200 border-b-4 border-slate-900 hover:bg-slate-600 ${buttonBase}`;
const secondaryButton = `bg-slate-800 text-slate-400 border-b-4 border-slate-950 hover:bg-slate-700 ${buttonBase}`;
const greenButton = `bg-emerald-900/40 text-emerald-200 border-b-4 border-emerald-950 hover:bg-emerald-900/60 ${buttonBase}`;
const actionButton = `bg-slate-700 text-slate-300 border-b-4 border-slate-900 hover:bg-slate-600 ${buttonBase}`;
const vibrantButton = `bg-indigo-600 text-white border-b-4 border-indigo-800 hover:bg-indigo-500 shadow-sm border border-slate-700/50 shadow-indigo-500/20 ${buttonBase}`;
const yellowButton = `bg-yellow-500 text-slate-900 border-b-4 border-yellow-700 hover:bg-yellow-400 ${buttonBase}`;

const ensureValidDate = (d: any): Date => {
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
};

const toDatetimeLocal = (d: any): string => {
    try {
        const date = ensureValidDate(d);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    } catch (e) {
        return new Date().toISOString().slice(0, 16);
    }
};

type DropdownOption = string | { group: string, items: string[] };

const MultiSelectDropdown = ({ 
    options, 
    selected, 
    onChange, 
    title 
}: { 
    options: DropdownOption[], 
    selected: string[], 
    onChange: (s: string[]) => void, 
    title: string 
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    
    // Flatten all actual item strings for "Select All" logic
    const allItemStrings = useMemo(() => {
        const res: string[] = [];
        options.forEach(opt => {
            if (typeof opt === 'string') res.push(opt);
            else res.push(...opt.items);
        });
        return res;
    }, [options]);

    const isAllSelected = selected.length === 0;
    const isNoneSelected = selected.length === 1 && selected[0] === '__SYSTEM_NONE_SELECTED__';
    const displayCount = isAllSelected ? "All Selected" : isNoneSelected ? "0 Selected" : `${selected.length} Selected`;

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            onChange([]);
        } else {
            onChange(['__SYSTEM_NONE_SELECTED__']);
        }
    };

    const toggleItem = (item: string, checked: boolean) => {
        if (checked) {
            if (isAllSelected) return;
            const next = isNoneSelected ? [item] : [...selected, item];
            // Fix: Actually we don't need to check if length matches allItemStrings, since returning next works
            if (next.length >= allItemStrings.length) onChange([]);
            else onChange(next);
        } else {
            if (isAllSelected) {
                const next = allItemStrings.filter(x => x !== item);
                if (next.length === 0) onChange(['__SYSTEM_NONE_SELECTED__']);
                else onChange(next);
            } else {
                const next = selected.filter(x => x !== item);
                if (next.length === 0) onChange(['__SYSTEM_NONE_SELECTED__']);
                else onChange(next);
            }
        }
    };

    const toggleGroup = (groupItems: string[], checked: boolean) => {
        if (checked) {
            if (isAllSelected) return;
            const current = isNoneSelected ? [] : [...selected];
            const next = Array.from(new Set([...current, ...groupItems]));
            if (next.length >= allItemStrings.length) onChange([]);
            else onChange(next);
        } else {
            if (isAllSelected) {
                const next = allItemStrings.filter(x => !groupItems.includes(x));
                if (next.length === 0) onChange(['__SYSTEM_NONE_SELECTED__']);
                else onChange(next);
            } else {
                const next = selected.filter(x => !groupItems.includes(x));
                if (next.length === 0) onChange(['__SYSTEM_NONE_SELECTED__']);
                else onChange(next);
            }
        }
    };

    return (
        <div className="relative flex-1" ref={dropdownRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-black border border-slate-800 rounded p-2 text-xs text-left text-slate-300 outline-none hover:border-cyan-500/50 transition-colors flex justify-between items-center overflow-hidden"
            >
                <div className="mr-2 flex flex-col gap-0.5 flex-1 min-w-0">
                    <span className="text-[9px] uppercase font-black tracking-widest text-slate-500">{title}</span>
                    <span className="text-white font-bold truncate">
                        {displayCount}
                    </span>
                </div>
                <span className="text-[10px] text-slate-600 flex-shrink-0">▼</span>
            </button>
            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-full min-w-[200px] bg-slate-900 border border-slate-700 rounded-sm shadow-sm border border-slate-700/50 z-50 max-h-[40vh] overflow-y-auto custom-scrollbar p-0 flex flex-col">
                    <label className="flex items-center gap-2 p-3 hover:bg-white/5 cursor-pointer text-xs text-white sticky top-0 bg-slate-900 z-10 shadow-sm border-b border-white/10">
                        <input 
                            type="checkbox" 
                            checked={isAllSelected}
                            onChange={(e) => handleSelectAll(e.target.checked)}
                            className="accent-cyan-500"
                        />
                        <span className={isAllSelected ? "font-bold text-cyan-400" : ""}>Select All</span>
                    </label>
                    
                    <div className="p-2 flex flex-col gap-1">
                        {options.map((opt, idx) => {
                            if (typeof opt === 'string') {
                                return (
                                    <label key={opt} className="flex items-center gap-2 p-1.5 hover:bg-white/5 rounded cursor-pointer text-xs text-slate-300 pl-4">
                                        <input 
                                            type="checkbox" 
                                            checked={isAllSelected || (!isNoneSelected && selected.includes(opt))}
                                            onChange={(e) => toggleItem(opt, e.target.checked)}
                                            className="accent-cyan-500 flex-shrink-0"
                                        />
                                        <span className="truncate">{opt || '(Blank)'}</span>
                                    </label>
                                );
                            } else {
                                // Grouped options
                                const groupChecked = isAllSelected || opt.items.every(item => (!isNoneSelected && selected.includes(item)));
                                const groupIndeterminate = !groupChecked && !isNoneSelected && opt.items.some(item => selected.includes(item));
                                
                                return (
                                    <div key={opt.group || `group-${idx}`} className="flex flex-col gap-1">
                                        <label className="flex items-center gap-2 p-1.5 hover:bg-white/5 rounded cursor-pointer text-xs text-white font-bold pl-2 bg-black/20">
                                            <input 
                                                type="checkbox" 
                                                checked={groupChecked}
                                                ref={el => { if (el) el.indeterminate = groupIndeterminate; }}
                                                onChange={(e) => toggleGroup(opt.items, e.target.checked)}
                                                className="accent-cyan-500 flex-shrink-0"
                                            />
                                            <span className="truncate text-cyan-200">{opt.group || '(Blank Group)'}</span>
                                        </label>
                                        <div className="flex flex-col pl-4 border-l border-white/5 ml-3">
                                            {opt.items.map(item => (
                                                <label key={item} className="flex items-center gap-2 p-1.5 hover:bg-white/5 rounded cursor-pointer text-[11px] text-slate-400">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={isAllSelected || (!isNoneSelected && selected.includes(item))}
                                                        onChange={(e) => toggleItem(item, e.target.checked)}
                                                        className="accent-cyan-500 flex-shrink-0"
                                                    />
                                                    <span className="truncate">{item || '(Blank)'}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                );
                            }
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

interface PlanRow {
    frequency: number;
    id: string;
    label: string;
    groupLabel?: string;
    type: string;
    stage: string;
    times: string;
    equipment: string;
    band: string;
    status: string;
    equipmentKey?: string;
    power?: string;
    bandwidth?: string;
    parameters?: string;
    thresholds?: string;
}

const FrequencyGrid: React.FC<{ 
    frequencies?: Frequency[], 
    onToggleLock: (id: string) => void, 
    onValueChange: (id: string, value: string) => void,
    onLabelChange: (id: string, value: string) => void,
    onTypeChange: (id: string, value: TxType) => void,
    onRemove: (id: string) => void,
    onLockAll?: (lock: boolean) => void,
    onAddFrequency?: () => void
}> = ({ frequencies, onToggleLock, onValueChange, onLabelChange, onTypeChange, onRemove, onLockAll, onAddFrequency }) => {
    
    const allLocked = frequencies && frequencies.length > 0 ? frequencies.every(f => f.locked) : false;

    const getFreqStyle = (f: Frequency) => {
        if (f.value <= 0) return 'bg-red-500/10 border-red-500/30 text-red-300';
        switch (f.type) {
            case 'iem': return 'bg-rose-500/10 border-rose-500/30 text-rose-300';
            case 'comms': return 'bg-amber-500/10 border-amber-500/30 text-amber-300';
            default: return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300';
        }
    };

    return (
        <div className="mt-2 p-2 bg-black/30 rounded-md border border-white/5 space-y-1">
            <div className="flex justify-between items-center px-1 mb-1 border-b border-white/5 pb-1 gap-2">
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">Active Carriers</span>
                <div className="flex items-center gap-1.5 ml-auto">
                    {onAddFrequency && (
                        <button 
                            onClick={onAddFrequency}
                            className="text-[8px] font-black uppercase px-2 py-0.5 rounded border border-indigo-500/60 bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500 hover:text-white transition-all whitespace-nowrap"
                        >
                            + Add Manual
                        </button>
                    )}
                    {onLockAll && frequencies && frequencies.length > 0 && (
                        <button 
                            onClick={() => onLockAll(!allLocked)}
                            className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border transition-all whitespace-nowrap ${allLocked ? 'bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/40' : 'bg-slate-700/50 text-slate-400 border-slate-600 hover:bg-slate-600 hover:text-white'}`}
                        >
                            {allLocked ? '🔓 Unlock All' : '🔒 Lock All'}
                        </button>
                    )}
                </div>
            </div>
            
            <div className="grid grid-cols-1 gap-1.5">
                {(!frequencies || frequencies.length === 0) ? (
                    <div className="text-center py-2 text-xs text-slate-600 font-medium italic select-none">No frequencies generated or added yet.</div>
                ) : (
                    frequencies.map((f) => (
                        <div key={f.id} className={`flex items-center gap-2 p-1.5 rounded-sm border transition-all ${getFreqStyle(f)}`}>
                            <button onClick={() => onToggleLock(f.id)} className={`text-[10px] ${f.locked ? 'text-amber-400' : 'text-slate-500 opacity-50'}`}>{f.locked ? '🔒' : '🔓'}</button>
                            <SmartNumberInput id={f.id} value={f.value} onChange={onValueChange} className="bg-transparent font-mono text-[11px] font-bold outline-none w-16" />
                            <input type="text" value={f.label || ''} onChange={(e) => onLabelChange(f.id, e.target.value)} placeholder="Label" className="bg-transparent text-[10px] outline-none flex-1 opacity-70 truncate" />
                            <button onClick={(e) => onRemove(f.id)} className="text-red-400/50 hover:text-red-400 font-bold px-1">&times;</button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

const RequestManager: React.FC<{
    requests: EquipmentRequest[],
    onUpdate: (requests: EquipmentRequest[]) => void,
    db: Record<string, EquipmentProfile>,
    overrides: Record<string, Partial<Thresholds>>,
    title: string,
    type: 'mic' | 'iem',
    foundCount?: number,
    frequencies?: Frequency[],
    onFreqAction?: (id: string, action: string, value?: any) => void,
    equipmentOptionsNode?: React.ReactNode
}> = ({ requests = [], onUpdate, db, overrides, title, type, foundCount, frequencies = [], onFreqAction, equipmentOptionsNode }) => {
    const handleAdd = () => {
        const defaultKey = 'custom';
        onUpdate([...requests, { id: `req-${Date.now()}-${Math.random()}`, equipmentKey: defaultKey, count: 0, compatibilityLevel: 'standard', linearMode: false }]);
    };
    const handleRemove = (id: string) => onUpdate(requests.filter(r => r.id !== id));
    
    const handleFieldChange = (id: string, field: keyof EquipmentRequest, value: any) => {
        onUpdate(requests.map(r => {
            if (r.id !== id) return r;
            let updated = { ...r, [field]: value };
            
            if (field === 'equipmentKey') {
                const profile = db[value as string];
                if (profile && profile.recommendedThresholds?.threeTone !== 0) {
                    updated.linearMode = false;
                }
            }

            if (field === 'useManualParams' && value === true) {
                const standardTh = getFinalThresholds({ equipmentKey: r.equipmentKey, compatibilityLevel: 'standard' }, db, overrides);
                if (updated.manualFundamental === undefined) updated.manualFundamental = standardTh.fundamental;
                if (updated.manualTwoTone === undefined) updated.manualTwoTone = standardTh.twoTone;
                if (updated.manualThreeTone === undefined) updated.manualThreeTone = standardTh.threeTone;
                if (updated.manualFiveTone === undefined) updated.manualFiveTone = standardTh.fiveTone || 0;
                if (updated.manualSevenTone === undefined) updated.manualSevenTone = standardTh.sevenTone || 0;
            }
            return updated;
        }));
    };

    const requestedCount = requests.reduce((acc, req) => acc + (req.count || 0), 0);

    return (
        <div className="space-y-3">
            <div className="flex justify-between items-center mb-1 px-1">
                <div className="flex items-center gap-2">
                    <h5 className={`text-[10px] font-black uppercase tracking-widest ${type === 'mic' ? 'text-emerald-400' : 'text-rose-400'}`}>{title}</h5>
                    {foundCount !== undefined && requestedCount > 0 && (
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${foundCount >= requestedCount ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                            {foundCount} / {requestedCount} found
                        </span>
                    )}
                </div>
                <button onClick={handleAdd} className={`text-[9px] px-2 py-0.5 rounded font-bold transition-all border ${type === 'mic' ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-600' : 'bg-rose-600/20 text-rose-300 border-rose-500/30 hover:bg-rose-600'} hover:text-white`}>+ Add</button>
            </div>
            <div className="space-y-2">
                {requests.map(req => {
                    const activeTh = getFinalThresholds({ equipmentKey: req.equipmentKey, compatibilityLevel: req.compatibilityLevel }, db, overrides);
                    const reqFreqs = frequencies?.filter(f => f.sourceRequestId === req.id) || [];
                    
                    return (
                        <div key={req.id} className="bg-slate-900/60 p-2 rounded-md border border-white/5 space-y-2">
                            <div className="grid grid-cols-[1fr,auto,auto] gap-2 items-center">
                                <select value={req.equipmentKey} onChange={e => handleFieldChange(req.id, 'equipmentKey', e.target.value)} className="bg-slate-950 border border-slate-700 rounded px-1 py-1 text-[10px] text-slate-200">
                                    {equipmentOptionsNode}
                                </select>
                                <div className="flex items-center gap-1 relative">
                                    <button 
                                        onClick={() => handleFieldChange(req.id, 'count', Math.max(0, req.count - 1))}
                                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 rounded px-1.5 py-1 text-[10px] font-bold border border-slate-700"
                                    >-</button>
                                    <input type="number" value={req.count} onChange={e => handleFieldChange(req.id, 'count', parseInt(e.target.value) || 0)} className={`bg-slate-950 border border-slate-700 rounded px-1 py-1 text-[10px] font-bold text-center w-10 ${type === 'mic' ? 'text-emerald-400' : 'text-rose-400'}`} />
                                    <button 
                                        onClick={() => handleFieldChange(req.id, 'count', req.count + 1)}
                                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 rounded px-1.5 py-1 text-[10px] font-bold border border-slate-700"
                                    >+</button>
                                    {db[req.equipmentKey]?.type === 'wmas' && <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[6px] text-purple-400 font-black bg-slate-900 px-1 uppercase tracking-tighter whitespace-nowrap">Systems</span>}
                                </div>
                                <button onClick={() => handleRemove(req.id)} className="text-red-400 hover:text-red-300 font-bold text-xs px-1">&times;</button>
                            </div>

                            <div className="flex items-center justify-between gap-2 px-1">
                                {db[req.equipmentKey]?.type === 'wmas' ? (
                                    <span className="text-[8px] font-black uppercase tracking-tighter text-purple-400 border border-purple-500/30 px-1.5 py-0.5 rounded bg-purple-500/10">Wideband Block</span>
                                ) : (
                                    db[req.equipmentKey]?.recommendedThresholds?.threeTone === 0 ? (
                                        <label className="flex items-center gap-2 cursor-pointer group/lin">
                                            <span className={`text-[8px] font-black uppercase tracking-tighter ${req.linearMode ? 'text-cyan-400' : 'text-slate-600'}`}>HD Mode</span>
                                            <input type="checkbox" checked={req.linearMode} onChange={e => handleFieldChange(req.id, 'linearMode', e.target.checked)} className="w-3 h-3 accent-cyan-500" />
                                        </label>
                                    ) : (
                                        <div className="w-[60px]" />
                                    )
                                )}
                                <select 
                                    value={req.compatibilityLevel} 
                                    onChange={e => handleFieldChange(req.id, 'compatibilityLevel', e.target.value)} 
                                    disabled={req.useManualParams}
                                    className="bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-[9px] text-indigo-300 font-bold uppercase tracking-tighter disabled:opacity-30"
                                >
                                    <option value="standard">Standard</option>
                                    <option value="aggressive">Aggressive</option>
                                    <option value="robust">Robust</option>
                                </select>
                            </div>

                            {req.equipmentKey === 'custom' && (
                                <div className="grid grid-cols-2 gap-2 mt-1">
                                    <div className="flex flex-col">
                                        <span className="text-[7px] font-black text-slate-500 uppercase tracking-tighter">Lower</span>
                                        <SmartNumberInput 
                                            id={`${req.id}-min`}
                                            value={req.customMin}
                                            onChange={(_, val) => handleFieldChange(req.id, 'customMin', parseFloat(val))}
                                            placeholder="470.0"
                                            format={false}
                                            className="bg-slate-950 border border-slate-700 rounded px-1.5 py-1.5 text-[10px] text-cyan-400 font-mono"
                                        />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[7px] font-black text-slate-500 uppercase tracking-tighter">Upper</span>
                                        <SmartNumberInput 
                                            id={`${req.id}-max`}
                                            value={req.customMax}
                                            onChange={(_, val) => handleFieldChange(req.id, 'customMax', parseFloat(val))}
                                            placeholder="700.0"
                                            format={false}
                                            className="bg-slate-950 border border-slate-700 rounded px-1.5 py-1.5 text-[10px] text-cyan-400 font-mono"
                                        />
                                    </div>
                                </div>
                            )}
                            
                            <div className="flex items-center justify-between p-1">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <span className={`text-[8px] font-black uppercase tracking-tighter ${req.useManualParams ? 'text-amber-400' : 'text-slate-600'}`}>Bespoke Overrides</span>
                                    <input type="checkbox" checked={req.useManualParams} onChange={e => handleFieldChange(req.id, 'useManualParams', e.target.checked)} className="w-3 h-3 accent-amber-500" />
                                </label>
                            </div>

                            <div className={`grid grid-cols-5 gap-1.5 p-1.5 rounded-sm border transition-all ${req.useManualParams ? 'bg-amber-500/5 border-amber-500/20' : 'bg-black/20 border-white/5'}`}>
                                <div className="flex flex-col items-center">
                                    <span className="text-[7px] font-black text-slate-500 uppercase tracking-tighter">FF</span>
                                    <SmartNumberInput 
                                        id={`${req.id}-ff`}
                                        value={req.useManualParams ? req.manualFundamental : activeTh.fundamental}
                                        readOnly={!req.useManualParams}
                                        onChange={(_, val) => handleFieldChange(req.id, 'manualFundamental', parseFloat(val))}
                                        className={`w-full bg-transparent text-center font-mono text-[10px] outline-none ${req.useManualParams ? 'text-amber-300' : 'text-slate-400'}`} 
                                    />
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="text-[7px] font-black text-slate-500 uppercase tracking-tighter">2T</span>
                                    <SmartNumberInput 
                                        id={`${req.id}-2t`}
                                        value={req.useManualParams ? req.manualTwoTone : activeTh.twoTone}
                                        readOnly={!req.useManualParams}
                                        onChange={(_, val) => handleFieldChange(req.id, 'manualTwoTone', parseFloat(val))}
                                        className={`w-full bg-transparent text-center font-mono text-[10px] outline-none ${req.useManualParams ? 'text-amber-300' : 'text-slate-400'}`} 
                                    />
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="text-[7px] font-black text-slate-500 uppercase tracking-tighter">3T</span>
                                    <SmartNumberInput 
                                        id={`${req.id}-3t`}
                                        value={req.useManualParams ? req.manualThreeTone : activeTh.threeTone}
                                        readOnly={!req.useManualParams}
                                        onChange={(_, val) => handleFieldChange(req.id, 'manualThreeTone', parseFloat(val))}
                                        className={`w-full bg-transparent text-center font-mono text-[10px] outline-none ${req.useManualParams ? 'text-amber-300' : 'text-slate-400'}`} 
                                    />
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="text-[7px] font-black text-slate-500 uppercase tracking-tighter">5T</span>
                                    <SmartNumberInput 
                                        id={`${req.id}-5t`}
                                        value={req.useManualParams ? req.manualFiveTone : activeTh.fiveTone}
                                        readOnly={!req.useManualParams}
                                        onChange={(_, val) => handleFieldChange(req.id, 'manualFiveTone', parseFloat(val))}
                                        className={`w-full bg-transparent text-center font-mono text-[10px] outline-none ${req.useManualParams ? 'text-amber-300' : 'text-slate-400'}`} 
                                    />
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="text-[7px] font-black text-slate-500 uppercase tracking-tighter">7T</span>
                                    <SmartNumberInput 
                                        id={`${req.id}-7t`}
                                        value={req.useManualParams ? req.manualSevenTone : activeTh.sevenTone}
                                        readOnly={!req.useManualParams}
                                        onChange={(_, val) => handleFieldChange(req.id, 'manualSevenTone', parseFloat(val))}
                                        className={`w-full bg-transparent text-center font-mono text-[10px] outline-none ${req.useManualParams ? 'text-amber-300' : 'text-slate-400'}`} 
                                    />
                                </div>
                            </div>
                            
                            {onFreqAction && reqFreqs.length > 0 && (
                                <div className="mt-1 border-t border-white/5 pt-1">
                                    <FrequencyGrid 
                                        frequencies={reqFreqs}
                                        onToggleLock={id => onFreqAction(id, 'lock')}
                                        onRemove={id => onFreqAction(id, 'remove')}
                                        onValueChange={(id, v) => onFreqAction(id, 'value', v)}
                                        onLabelChange={(id, v) => onFreqAction(id, 'label', v)}
                                        onTypeChange={(id, v) => onFreqAction(id, 'type', v)}
                                        onLockAll={(lock) => reqFreqs.forEach(f => onFreqAction(f.id, 'lock', lock))}
                                    />
                                </div>
                            )}

                        </div>
                    );
                })}
            </div>
        </div>
    );
};

import AiScheduleImporter from "./AiScheduleImporter";
import WMASTab from "./WMASTab";

const festivalCache: Record<string, any> = {};

function useCachedState<T>(key: string, initialValue: T | (() => T)): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    if (festivalCache[key] !== undefined) return festivalCache[key];
    return typeof initialValue === "function" ? (initialValue as any)() : initialValue;
  });
  useEffect(() => {
    festivalCache[key] = state;
  }, [key, state]);
  return [state, setState];
}

const FestivalCoordinationTab: React.FC<FestivalCoordinationTabProps> = ({
    festivalState, setFestivalState, setActiveTab,
    constantSystems, setConstantSystems, houseSystems, setHouseSystems,
    zoneConfigs, setZoneConfigs, numZones, setNumZones, distances, setDistances,
    initialThresholds, customEquipment, compatibilityMatrix, 
    setCompatibilityMatrix,
    scanData, setScanData, siteMapState, equipmentOverrides = {}, setEquipmentOverrides,
    onSimulateScan, wmasState, setWmasState, setIsCalculating,
    user,
    currentProject,
    serialDevice,
    serialStatus,
    serialIsScanning,
    setSerialIsScanning,
    onConnectSerial,
    onDisconnectSerial,
    onAutoDetectSerial,
    scanStartFreq: serialScanStartFreq,
    setScanStartFreq: setSerialScanStartFreq,
    scanStopFreq: serialScanStopFreq,
    setScanStopFreq: setSerialScanStopFreq
}) => {
    const [activeSubTab, setActiveSubTab] = useCachedState<'acts' | 'constant' | 'house' | 'act-matrix' | 'wmas'>('activeSubTab', 'acts');
    const [activeDayIdx, setActiveDayIdx] = useCachedState('activeDayIdx', 0);

    const festivalDay = festivalState?.days?.[activeDayIdx];
    const festivalActs = festivalDay?.acts || [];
    const tvChannelStates = festivalDay?.tvChannelStates || {};
    

    const setFestivalActs = (update: React.SetStateAction<FestivalAct[]>) => {
        const updater = typeof update === 'function' ? update : () => update;
        setFestivalState(prev => {
            const days = [...(prev.days || [])];
            days[activeDayIdx] = { ...days[activeDayIdx], acts: updater(days[activeDayIdx]?.acts || []) };
            return { ...prev, days };
        });
    };

    const setTvChannelStates = (update: Record<string, TVChannelState> | ((prev: Record<string, TVChannelState>) => Record<string, TVChannelState>)) => {
        const updater = typeof update === 'function' ? update : () => update;
        setFestivalState(prev => {
            const days = [...(prev.days || [])];
            const currentStates = (days[activeDayIdx]?.tvChannelStates || {}) as Record<string, TVChannelState>;
            days[activeDayIdx] = { 
                ...days[activeDayIdx], 
                tvChannelStates: updater(currentStates) 
            };
            return { ...prev, days };
        });
    };
    
    // Fallback/Placeholder as this was previously passed as a prop
    const tvChannelErpData = {};
    const setTvChannelErpData = () => {};

    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState({ found: 0, processed: 0, total: 0, totalRequested: 0, status: '' });
    const reqTotal = useMemo(() => {
        let total = 0;
        [...constantSystems, ...houseSystems, ...festivalActs].forEach(s => [...(s.micRequests || []), ...(s.iemRequests || [])].forEach(r => total += r.count));
        return total;
    }, [constantSystems, houseSystems, festivalActs]);
    const [overlapMinutes, setOverlapMinutes] = useCachedState('overlapMinutes', 30);
    const [manualExclusions, setManualExclusions] = useLocalStorage('festival_manualExclusions', '');
    const debouncedExclusions = useDebounce(manualExclusions, 300);
    const [optimizationReport, setOptimizationReport] = useState<OptimizationReport | null>(null);
    const [isHudMinimized, setIsHudMinimized] = useCachedState('isHudMinimized', false);
    const [tvRegion, setTvRegion] = useLocalStorage<'uk' | 'us'>('festival_tvRegion', 'uk');
    const [showTabulation, setShowTabulation] = useCachedState('showTabulation', false);
    const [showMatrixAndLinks, setShowMatrixAndLinks] = useCachedState('showMatrixAndLinks', false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [diagnosticConflicts, setDiagnosticConflicts] = useState<Conflict[]>([]);
    const [hasAnalyzed, setHasAnalyzed] = useState(false);
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
    const [isLiveShareOpen, setIsLiveShareOpen] = useState(false);
    const [festivalName, setFestivalName] = useState(currentProject?.name || "Festival RF Plan");

    useEffect(() => {
        if (currentProject?.name && (festivalName === "Festival RF Plan" || festivalName === "")) {
            setFestivalName(currentProject.name);
        }
    }, [currentProject?.name]);
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
    const [numZonesInput, setNumZonesInput] = useState(numZones.toString());
    const [isConverterOpen, setIsConverterOpen] = useState(false);
    const [isLiveScanOpen, setIsLiveScanOpen] = useState(false);
    const [vbw, setVbw] = useState('1kHz');
    const [rbw, setRbw] = useState('1kHz');
    const [span, setSpan] = useState('100');
    const [refLevel, setRefLevel] = useState(-10);
    const [startFreq, setStartFreq] = useState(470);
    const [stopFreq, setStopFreq] = useState(700);
    const [centerFreq, setCenterFreq] = useState(585);
    const [exclusionThreshold, setExclusionThreshold] = useLocalStorage('festival_exclusionThreshold', -85);
    const [calculationStrategy, setCalculationStrategy] = useCachedState<'even-distribution' | 'bottom-up' | 'top-down' | 'high-density'>('calculationStrategy', 'even-distribution');
    const [engineIterations, setEngineIterations] = useCachedState<number>('engineIterations', 1);

    const handleStartFreqChange = (newStart: number) => {
        setStartFreq(newStart);
        setCenterFreq((newStart + stopFreq) / 2);
        setSpan((stopFreq - newStart).toString());
    };
    const handleStopFreqChange = (newStop: number) => {
        setStopFreq(newStop);
        setCenterFreq((startFreq + newStop) / 2);
        setSpan((newStop - startFreq).toString());
    };
    const handleCenterFreqChange = (newCenter: number) => {
        setCenterFreq(newCenter);
        const spanVal = parseFloat(span) || 100;
        setStartFreq(newCenter - spanVal / 2);
        setStopFreq(newCenter + spanVal / 2);
    };
    const handleSpanChange = (newSpan: string) => {
        setSpan(newSpan);
        const spanVal = parseFloat(newSpan) || 100;
        setStartFreq(centerFreq - spanVal / 2);
        setStopFreq(centerFreq + spanVal / 2);
    };
    
    // Global Distance State
    const [globalDistInput, setGlobalDistInput] = useCachedState<string>('globalDistInput', "150");

    const fileInputRef = useRef<HTMLInputElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const handleCancel = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            setIsGenerating(false);
            toast.info('Coordination cancelled by user');
        }
    };

    const [ledgerSort, setLedgerSort] = useCachedState<{ field: keyof PlanRow, direction: 'asc' | 'desc' | null }>('ledgerSort', { field: 'frequency', direction: 'asc' });
    const [ledgerFilters, setLedgerFilters] = useCachedState<Partial<Record<keyof PlanRow, string[]>>>('ledgerFilters', {});

    const [diagSelectedIds, setDiagSelectedIds] = useState<Set<string>>(new Set());
    const [expandedActs, setExpandedActs] = useCachedState<Set<string>>('expandedActs', new Set());

    const toggleActCollapse = (id: string, collapse?: boolean) => {
        setExpandedActs(prev => {
            const next = new Set(prev);
            if (collapse === undefined) {
                if (next.has(id)) next.delete(id);
                else next.add(id);
            } else {
                if (collapse) next.delete(id);
                else next.add(id);
            }
            return next;
        });
    };

    const StatusPill = ({ label, value, color = 'indigo', subValue }: { label: string, value: string | number, color?: string, subValue?: string }) => {
        const colorClasses = {
            indigo: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300 ring-indigo-500/30',
            emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300 ring-emerald-500/30',
            rose: 'bg-rose-500/10 border-rose-500/20 text-rose-300 ring-rose-500/30',
            amber: 'bg-amber-500/10 border-amber-500/20 text-amber-300 ring-amber-500/30'
        }[color as 'indigo' | 'emerald' | 'rose' | 'amber'];

        return (
            <div className={`flex items-center gap-3 px-3 py-1.5 rounded-full border shadow-sm ring-1 ring-inset ${colorClasses} animate-in fade-in zoom-in duration-300`}>
                <div className="flex flex-col">
                    <span className="text-[8px] font-black uppercase tracking-widest opacity-60 leading-none mb-0.5">{label}</span>
                    <div className="flex items-baseline gap-1">
                        <span className="text-sm font-black tracking-tighter leading-none">{value}</span>
                        {subValue && <span className="text-[9px] font-bold opacity-50">{subValue}</span>}
                    </div>
                </div>
                {color === 'emerald' && optimizationReport?.shortfall === 0 && (
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                )}
                {(color === 'rose' && optimizationReport?.shortfall && optimizationReport.shortfall > 0) ? (
                    <div className="w-2 h-2 rounded-full bg-rose-400 animate-pulse shadow-[0_0_8px_rgba(251,113,113,0.8)]" />
                ) : null}
            </div>
        );
    };

    const parsedExclusions = useMemo(() => {
        return manualExclusions
            .split(/[,;\n]/)
            .map(s => s.trim())
            .filter(Boolean)
            .map(s => {
                const parts = s.split(/[-–]/).map(p => parseFloat(p.trim()));
                return parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]) && parts[0] < parts[1]
                    ? { min: parts[0], max: parts[1] } 
                    : null;
            })
            .filter((x): x is { min: number, max: number } => x !== null);
    }, [manualExclusions]);

    const handleExclusionZoneAdd = (min: number, max: number) => {
        const sortedMin = Math.min(min, max);
        const sortedMax = Math.max(min, max);
        if (Math.abs(sortedMax - sortedMin) < 0.001) return;
        const newRange = `${sortedMin.toFixed(3)}-${sortedMax.toFixed(3)}`;
        setManualExclusions(prev => prev && prev.trim() ? `${prev.trim()}, ${newRange}` : newRange);
    };

    const handleExclusionZoneRemove = (index: number) => {
        const updatedZones = parsedExclusions.filter((_, i) => i !== index);
        setManualExclusions(updatedZones.map(z => `${z.min.toFixed(3)}-${z.max.toFixed(3)}`).join(', '));
    };

    const handleFrequencyChange = (id: string, value: number) => {
        let step = 0.025;
        const allFreqs = [
            ...(constantSystems.flatMap(s => s.frequencies || [])),
            ...(houseSystems.flatMap(s => s.frequencies || [])),
            ...(festivalActs.flatMap(a => a.frequencies || []))
        ];
        const targetFreq = allFreqs.find(f => f.id === id);
        if (targetFreq?.equipmentKey) {
            const profile = fullEquipmentDatabase[targetFreq.equipmentKey];
            if (profile?.tuningStep && profile.tuningStep > 0) {
                step = profile.tuningStep;
            } else if (targetFreq.equipmentKey.toLowerCase().includes('lectro') || profile?.name?.toLowerCase().includes('lectro')) {
                step = 0.1;
            }
        }
        const snappedValue = Math.round(value / step) * step;
        const finalValue = Math.round(snappedValue * 10000) / 10000;
        
        setConstantSystems(prev => prev.map(s => ({
            ...s,
            frequencies: s.frequencies?.map(f => f.id === id ? { ...f, value: finalValue } : f)
        })));
        setHouseSystems(prev => prev.map(s => ({
            ...s,
            frequencies: s.frequencies?.map(f => f.id === id ? { ...f, value: finalValue } : f)
        })));
        setFestivalActs(prev => prev.map(a => ({
            ...a,
            frequencies: a.frequencies?.map(f => f.id === id ? { ...f, value: finalValue } : f)
        })));
    };

    const handleFrequencyClick = (freq: any) => {
        setShowTabulation(true);
        setTimeout(() => {
            const element = document.getElementById(`ledger-row-${freq.id}`) || document.getElementById(`ledger-card-${freq.id}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                element.classList.add('bg-indigo-500/40');
                setTimeout(() => {
                    if (element) element.classList.remove('bg-indigo-500/40');
                }, 2000);
            }
        }, 100);
    };

    useEffect(() => {
        setNumZonesInput(numZones.toString());
    }, [numZones]);

    // Automatically block TV channels based on exclusion threshold and scan data (Sticky Blocks)
    useEffect(() => {
        if (!scanData) return;
        const channelMap = tvRegion === 'uk' ? UK_TV_CHANNELS : US_TV_CHANNELS;
        
        const nextStates = { ...tvChannelStates };
        let changed = false;

        Object.entries(channelMap).forEach(([chStr, [start, end]]) => {
            const ch = parseInt(chStr);
            const chData = scanData.filter(p => p.freq >= start && p.freq <= end);
            if (chData.length > 0) {
                const maxChAmp = Math.max(...chData.map(p => p.amp));
                if (maxChAmp > exclusionThreshold) {
                    if (nextStates[ch] !== 'blocked') {
                        nextStates[ch] = 'blocked';
                        changed = true;
                    }
                }
            }
        });

        if (changed) {
            setTvChannelStates(nextStates);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scanData, exclusionThreshold, tvRegion]);

    // Automatic synchronization between zoneConfigs (Topology) and the Constant/House system gear ledgers.
    useEffect(() => {
        const syncSystems = (currentSystems: ConstantSystemRequest[], setFn: (val: ConstantSystemRequest[]) => void) => {
            const sizeMismatch = currentSystems.length !== zoneConfigs.length;
            const nameMismatch = currentSystems.some((s, i) => zoneConfigs[i] && s.stageName !== zoneConfigs[i].name);
            
            if (sizeMismatch || nameMismatch) {
                const next = zoneConfigs.map((cfg, idx) => {
                    const existing = currentSystems[idx];
                    if (existing && existing.stageName === cfg.name) {
                        return existing;
                    }
                    if (existing) {
                        return { ...existing, stageName: cfg.name };
                    }
                    return { stageName: cfg.name, micRequests: [], iemRequests: [], frequencies: [] };
                });
                
                // Only update if the content actually changed
                const hasChanged = next.length !== currentSystems.length || 
                                 next.some((s, i) => s.stageName !== currentSystems[i]?.stageName);

                if (hasChanged) {
                    setFn(next);
                }
            }
        };

        syncSystems(constantSystems, setConstantSystems);
        syncSystems(houseSystems, setHouseSystems);
    }, [zoneConfigs, setConstantSystems, setHouseSystems]);

    const handleNumZonesChange = (val: string) => {
        setNumZonesInput(val);
        const parsed = parseInt(val, 10);
        if (!isNaN(parsed) && parsed > 0 && parsed <= 20) {
            setNumZones(parsed);
        }
    };

    const handleApplyGlobalDistance = () => {
        const val = parseInt(globalDistInput, 10);
        if (isNaN(val)) return;
        const next = distances.map((row, rIdx) => 
            row.map((col, cIdx) => (rIdx === cIdx ? 0 : val))
        );
        setDistances(next);
    };

    const handleStageNameChange = (idx: number, newName: string) => {
        const oldName = zoneConfigs[idx].name;
        
        const nextZones = [...zoneConfigs];
        nextZones[idx] = { ...nextZones[idx], name: newName };
        setZoneConfigs(nextZones);

        const nextHouse = (houseSystems || []).map((sys, sIdx) => 
            sIdx === idx ? { ...sys, stageName: newName } : sys
        );
        setHouseSystems(nextHouse);

        const nextConstants = (constantSystems || []).map((sys, sIdx) => 
            sIdx === idx ? { ...sys, stageName: newName } : sys
        );
        setConstantSystems(nextConstants);

        setFestivalActs(prev => (prev || []).map(act => 
            act.stage === oldName ? { ...act, stage: newName } : act
        ));
    };

    const fullEquipmentDatabase = useMemo((): Record<string, EquipmentProfile> => {
        const customProfiles = customEquipment.reduce((acc: Record<string, EquipmentProfile>, profile: EquipmentProfile) => { if (profile.id) acc[profile.id] = profile; return acc; }, {} as Record<string, EquipmentProfile>);
        return { ...EQUIPMENT_DATABASE, ...customProfiles };
    }, [customEquipment]);

    const micEquipmentOptions = useMemo(() => {
        return (Object.entries(fullEquipmentDatabase) as [string, EquipmentProfile][])
            .filter(([k, p]) => {
                const pType = p.type || 'generic';
                return pType === 'mic' || pType === 'generic' || pType === 'wmas' || k === 'custom';
            })
            .map(([k, p]) => <option key={k} value={k}>{p.name} ({p.band})</option>);
    }, [fullEquipmentDatabase]);

    const iemEquipmentOptions = useMemo(() => {
        return (Object.entries(fullEquipmentDatabase) as [string, EquipmentProfile][])
            .filter(([k, p]) => {
                const pType = p.type || 'generic';
                return pType === 'iem' || pType === 'generic' || pType === 'wmas' || k === 'custom';
            })
            .map(([k, p]) => <option key={k} value={k}>{p.name} ({p.band})</option>);
    }, [fullEquipmentDatabase]);

    const rawTabulatedPlan = useMemo(() => {
        const getThString = (req: any, f: any) => {
            if (!req) return '-';
            if (req.useManualParams) {
                return `${Math.round((req.manualFundamental||0)*1000)}, ${Math.round((req.manualTwoTone||0)*1000)}, ${Math.round((req.manualThreeTone||0)*1000)}`;
            }
            const level = req.compatibilityLevel || 'standard';
            const th = getFinalThresholds({ equipmentKey: f.equipmentKey, compatibilityLevel: level }, fullEquipmentDatabase, equipmentOverrides);
            return `${Math.round(th.fundamental*1000)}, ${Math.round(th.twoTone*1000)}, ${Math.round(th.threeTone*1000)}`;
        };

        const rows: PlanRow[] = [];
        constantSystems.forEach(sys => {
            sys.frequencies?.forEach(f => {
                if (f.value <= 0) return;
                const profile = f.equipmentKey ? fullEquipmentDatabase[f.equipmentKey] : null;
                const req = sys.micRequests?.find(r => r.equipmentKey === f.equipmentKey) || sys.iemRequests?.find(r => r.equipmentKey === f.equipmentKey);
                const params = req ? `${req.compatibilityLevel?.toUpperCase() || 'STD'}${req.linearMode ? ' (HD)' : ''}` : 'STD';
                rows.push({ 
                    frequency: f.value, 
                    id: f.id, 
                    label: f.label || 'Static System', 
                    groupLabel: sys.stageName || 'Constant System',
                    type: f.type || 'generic', 
                    stage: sys.stageName, 
                    times: 'Constant', 
                    equipment: profile?.name || f.equipmentKey || 'Custom Range', 
                    band: profile?.band.split(' ')[0] || 'Custom', 
                    status: f.locked ? '🔒' : '🔓', 
                    equipmentKey: f.equipmentKey,
                    power: profile?.type === 'iem' ? '50mW' : '10mW',
                    bandwidth: profile?.type === 'wmas' ? '6MHz' : '200kHz',
                    parameters: params,
                    thresholds: getThString(req, f)
                });
            });
        });
        houseSystems.forEach(sys => {
            sys.frequencies?.forEach(f => {
                if (f.value <= 0) return;
                const profile = f.equipmentKey ? fullEquipmentDatabase[f.equipmentKey] : null;
                const req = sys.micRequests?.find(r => r.equipmentKey === f.equipmentKey) || sys.iemRequests?.find(r => r.equipmentKey === f.equipmentKey);
                const params = req ? `${req.compatibilityLevel?.toUpperCase() || 'STD'}${req.linearMode ? ' (HD)' : ''}` : 'STD';
                rows.push({ 
                    frequency: f.value, 
                    id: f.id, 
                    label: f.label || 'House System', 
                    groupLabel: sys.stageName || 'House System',
                    type: f.type || 'generic', 
                    stage: sys.stageName, 
                    times: 'House System', 
                    equipment: profile?.name || f.equipmentKey || 'Custom Range', 
                    band: profile?.band.split(' ')[0] || 'Custom', 
                    status: f.locked ? '🔒' : '🔓',
                    equipmentKey: f.equipmentKey,
                    power: profile?.type === 'iem' ? '50mW' : '10mW',
                    bandwidth: profile?.type === 'wmas' ? '6MHz' : '200kHz',
                    parameters: params,
                    thresholds: getThString(req, f)
                });
            });
        });
        festivalActs.forEach(act => {
            act.frequencies?.forEach(f => {
                if (f.value <= 0) return;
                const profile = f.equipmentKey ? fullEquipmentDatabase[f.equipmentKey] : null;
                const start = new Date(act.startTime);
                const end = new Date(act.endTime);
                
                const day = String(start.getDate()).padStart(2, '0');
                const month = String(start.getMonth() + 1).padStart(2, '0');
                const year = start.getFullYear();
                const dateStr = `${day}/${month}/${year}`;
                
                const startTimeStr = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                const endTimeStr = end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                const timeDisplay = `${dateStr} ${startTimeStr} - ${endTimeStr}`;

                const req = act.micRequests?.find(r => r.equipmentKey === f.equipmentKey) || act.iemRequests?.find(r => r.equipmentKey === f.equipmentKey);
                const params = req ? `${req.compatibilityLevel?.toUpperCase() || 'STD'}${req.linearMode ? ' (HD)' : ''}` : 'STD';

                rows.push({ 
                    frequency: f.value, 
                    id: f.id, 
                    label: f.label || act.actName, 
                    groupLabel: act.actName,
                    type: f.type || 'generic', 
                    stage: act.stage, 
                    times: timeDisplay, 
                    equipment: profile?.name || f.equipmentKey || 'Custom Range', 
                    band: profile?.band.split(' ')[0] || 'Custom', 
                    status: f.locked ? '🔒' : '🔓', 
                    equipmentKey: f.equipmentKey,
                    power: profile?.type === 'iem' ? '50mW' : '10mW',
                    bandwidth: profile?.type === 'wmas' ? '6MHz' : '200kHz',
                    parameters: params,
                    thresholds: getThString(req, f)
                });
            });
        });

        if (wmasState && wmasState.nodes) {
            wmasState.nodes.forEach(node => {
                if (node.assignedBlock) {
                    const freq = (node.assignedBlock.start + node.assignedBlock.end) / 2;
                    const rangeStr = `${node.assignedBlock.start.toFixed(2)}-${node.assignedBlock.end.toFixed(2)} MHz`;
                    
                    let timeDisplay = 'Constant (WMAS)';
                    if (node.isHouseSystem === false && node.startTime && node.endTime) {
                        const start = new Date(node.startTime);
                        const end = new Date(node.endTime);
                        const day = String(start.getDate()).padStart(2, '0');
                        const month = String(start.getMonth() + 1).padStart(2, '0');
                        const dateStr = `${day}/${month}/${start.getFullYear()}`;
                        const startTimeStr = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                        const endTimeStr = end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                        timeDisplay = `${dateStr} ${startTimeStr} - ${endTimeStr}`;
                    }

                    const profile = WMAS_PRESET_PROFILES.find(p => p.id === node.profileId);
                    const equipmentName = profile ? `${profile.name} (${rangeStr})` : `WMAS Block (${rangeStr})`;
                    const bwStr = profile ? (profile.bandwidthMHz >= 1 ? `${profile.bandwidthMHz}MHz` : `${Math.round(profile.bandwidthMHz * 1000)}kHz`) : 'WMAS';

                    rows.push({
                        frequency: freq,
                        id: node.id,
                        label: node.name,
                        groupLabel: node.name,
                        type: 'wmas',
                        stage: node.stage || (node.isHouseSystem !== false ? 'Global' : 'TBD'),
                        times: timeDisplay,
                        equipment: equipmentName,
                        band: node.assignedBlock.tvChannel ? `CH ${node.assignedBlock.tvChannel}` : 'Custom',
                        status: '🔒',
                        equipmentKey: node.profileId,
                        power: '100mW',
                        bandwidth: bwStr,
                        parameters: 'WMAS'
                    });
                }
            });
        }

        return rows;
    }, [festivalActs, constantSystems, houseSystems, wmasState, fullEquipmentDatabase]);

    const processedTabulatedPlan = useMemo(() => {
        let result = [...rawTabulatedPlan];
        Object.entries(ledgerFilters).forEach(([field, filterArr]) => {
            if (!filterArr || filterArr.length === 0) return;
            result = result.filter(row => {
                const rowVal = String(row[field as keyof PlanRow]);
                return filterArr.includes(rowVal);
            });
        });
        if (ledgerSort.direction) {
            result.sort((a, b) => {
                const valA = a[ledgerSort.field], valB = b[ledgerSort.field];
                if (typeof valA === 'number' && typeof valB === 'number') return ledgerSort.direction === 'asc' ? valA - valB : valB - valA;
                return ledgerSort.direction === 'asc' ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
            });
        }
        return result;
    }, [rawTabulatedPlan, ledgerSort, ledgerFilters]);

    const uniqueOptions = useMemo(() => {
        const labelGroups = new Map<string, Set<string>>();
        rawTabulatedPlan.forEach(r => {
            const gName = r.groupLabel || r.label;
            if (!labelGroups.has(gName)) labelGroups.set(gName, new Set());
            labelGroups.get(gName)!.add(r.label);
        });

        const labels = Array.from(labelGroups.entries())
            .map(([group, labelsSet]) => {
                const items = Array.from(labelsSet).sort();
                // If the group only contains exactly the group name, just simplify it
                if (items.length === 1 && items[0] === group) {
                    return group;
                }
                return { group, items };
            })
            .sort((a, b) => {
                const aName = typeof a === 'string' ? a : a.group;
                const bName = typeof b === 'string' ? b : b.group;
                return aName.localeCompare(bName);
            });

        const stages = Array.from(new Set(rawTabulatedPlan.map(r => r.stage))).sort();
        const times = Array.from(new Set(rawTabulatedPlan.map(r => r.times))).sort();
        const types = Array.from(new Set(rawTabulatedPlan.map(r => r.type))).sort();
        return { labels, stages, times, types };
    }, [rawTabulatedPlan]);

    const uniqueWwbGroups = useMemo(() => {
        const groups: Record<string, { name: string, count: number }> = {};
        rawTabulatedPlan.forEach(f => {
            const key = f.equipmentKey || 'custom';
            if (!groups[key]) {
                groups[key] = { name: f.equipment || 'Unknown Hardware', count: 0 };
            }
            groups[key].count++;
        });
        return Object.entries(groups).map(([key, data]) => ({ key, ...data }));
    }, [rawTabulatedPlan]);

    const anyFrequenciesLocked = useMemo(() => {
        return [...constantSystems, ...houseSystems, ...festivalActs].some(ent => ent.frequencies?.some(f => f.locked));
    }, [festivalActs, constantSystems, houseSystems]);

    const handleLockAllSite = (lock: boolean) => {
        const update = (entity: any) => ({ ...entity, frequencies: entity.frequencies?.map((f: any) => ({ ...f, locked: lock })) });
        setFestivalActs(prev => prev.map(update));
        setConstantSystems(prev => prev.map(update));
        setHouseSystems(prev => prev.map(update));
    };

    const handleGenerate = async (overrides?: Record<string, Partial<Thresholds>>) => {
        if (setIsCalculating) setIsCalculating(true);
        setIsGenerating(true); setOptimizationReport(null);
        
        const controller = new AbortController();
        abortControllerRef.current = controller;
        
        const effectiveOverrides = overrides || equipmentOverrides;
        const manualEx = parsedExclusions;
        
        setProgress({ found: 0, processed: 0, total: 0, totalRequested: reqTotal, status: 'Initializing Engine...' });

        try {
            let bestYield = -1;
            let bestPlan: FestivalAct[] | null = null;
            let bestConstants: ConstantSystemRequest[] | null = null;
            let bestHouse: ConstantSystemRequest[] | null = null;
            let bestReport: OptimizationReport | null = null;

            for (let iter = 0; iter < engineIterations; iter++) {
                if (controller.signal.aborted) throw new Error('AbortError');
                
                if (engineIterations > 1) {
                    setProgress(prev => ({ ...prev, status: `Starting Pass ${iter + 1} of ${engineIterations} (Best: ${bestYield === -1 ? 0 : bestYield} freq)...` }));
                }

                // Yield to ensure the status update actually paints to screen
                await new Promise(r => setTimeout(r, 0));

                const { constant: newConstants, house: newHouse } = await generateSiteInfrastructure(
                    constantSystems, 
                    houseSystems, 
                    zoneConfigs, 
                    distances, 
                    EQUIPMENT_DATABASE, 
                    manualEx, 
                    compatibilityMatrix, 
                    (p) => setProgress(prev => ({ ...prev, status: engineIterations > 1 ? `[Pass ${iter+1}] ${p.status}` : p.status || 'Calculating Site Infrastructure...' })), 
                    null, 
                    effectiveOverrides, 
                    tvChannelStates, 
                    tvRegion, 
                    wmasState, 
                    calculationStrategy, 
                    festivalActs, 
                    controller.signal
                );
                
                const { results: plan, report } = await generateFestivalPlan(festivalActs, newConstants, newHouse, zoneConfigs, distances, overlapMinutes, EQUIPMENT_DATABASE, manualEx, compatibilityMatrix, (p) => setProgress(prev => ({ ...p, totalRequested: reqTotal, status: engineIterations > 1 ? `[Pass ${iter+1}] ${p.status}` : p.status || prev.status })), undefined, null, effectiveOverrides, tvChannelStates, tvRegion, wmasState, calculationStrategy, controller.signal, festivalState.distanceWeightingEnabled !== false, festivalState.actIntermodMatrix);
                
                if (report.found > bestYield) {
                    bestYield = report.found;
                    bestPlan = plan;
                    bestConstants = newConstants;
                    bestHouse = newHouse;
                    bestReport = report;
                }
                
                // Mandatory yield between passes to ensure UI updates and progress indicator moves
                await new Promise(r => setTimeout(r, 0));

                if (bestYield >= reqTotal) {
                    // Maximum possible yield reached! Early exit.
                    break;
                }
            }

            if (bestConstants) setConstantSystems(bestConstants);
            if (bestHouse) setHouseSystems(bestHouse);
            if (bestPlan) setFestivalActs(bestPlan);
            if (bestReport) setOptimizationReport(bestReport);
            
            setIsHudMinimized(false);
            setShowSuccess(true);
        } catch (e: any) { 
            if (e.message === 'AbortError') {
                console.log('Coordination cancelled');
                return; // Silently exit on cancellation
            }
            if (e.message.startsWith('TimeoutError')) {
                toast.error(e.message);
                return;
            }
            toast.error("Coordination calculation failed. Check parameters.");
            console.error(e); 
        } finally { 
            setIsGenerating(false); 
            if (setIsCalculating) setIsCalculating(false);
            abortControllerRef.current = null;
        }
    };

    const handleAnalyzeDiagnostic = () => {
        const isFilterActive = diagSelectedIds.size > 0;
        if (!isFilterActive) {
            toast.error("No focused Acts, House Systems or Constant Transmits selected for audit.");
            return;
        }

        const filteredActs = festivalActs.filter(a => diagSelectedIds.has(a.id));
        const filteredConstants = constantSystems.filter(s => diagSelectedIds.has(`const-${s.stageName}`));
        const filteredHouse = houseSystems.filter(s => diagSelectedIds.has(`house-${s.stageName}`));

        const pool = [...filteredActs, ...filteredConstants, ...filteredHouse].flatMap(e => e.frequencies || []).filter(f => f.value > 0);
        if (pool.length < 2) { toast.error("Insufficient focus data. Select >= 2 active channels to audit."); return; }
        
        const result = validateFestivalCompatibility(filteredActs, filteredConstants, filteredHouse, zoneConfigs, distances, fullEquipmentDatabase, compatibilityMatrix, overlapMinutes, equipmentOverrides, wmasState, festivalState.distanceWeightingEnabled !== false);
        setDiagnosticConflicts(result.conflicts); setHasAnalyzed(true);
    };

    const runTypeStrictAudit = (targetHouseSystem: ConstantSystemRequest, houseTypeOnly: 'mic' | 'iem') => {
        const isFilterActive = diagSelectedIds.size > 0;
        const focusedActs = festivalActs.filter(a => diagSelectedIds.has(a.id));
        
        if (!isFilterActive || focusedActs.length === 0) {
            toast.error("Please select at least one Performing Act in the focus filter first.");
            return;
        }

        // Filter the house system to ONLY include the target type
        const filteredHouse = houseSystems.map(s => {
            if (s.stageName !== targetHouseSystem.stageName) {
                // If it's another house system, we keep its frequencies but they might be muted by the act logic anyway
                // Actually, for a focused audit on a SPECIFIC house system, we might want to ignore others or keep them.
                // The user says "JUST the house mics", implying one house system at a time or just that type.
                return { ...s, frequencies: [] }; 
            }
            return {
                ...s,
                frequencies: (s.frequencies || []).filter(f => f.type === houseTypeOnly)
            };
        });

        // Filter the focused acts to ONLY include the COMPLEMENTARY type
        const actTypeToKeep = houseTypeOnly === 'mic' ? 'iem' : 'mic';
        const filteredActs = focusedActs.map(a => ({
            ...a,
            frequencies: (a.frequencies || []).filter(f => f.type === actTypeToKeep)
        }));

        // We probably want to ignore constants for this focused check unless requested, 
        // but let's keep it pure for now as per user request.
        const result = validateFestivalCompatibility(filteredActs, [], filteredHouse, zoneConfigs, distances, fullEquipmentDatabase, compatibilityMatrix, overlapMinutes, equipmentOverrides, wmasState, festivalState.distanceWeightingEnabled !== false);
        
        setDiagnosticConflicts(result.conflicts);
        setHasAnalyzed(true);
        toast.info(`Running Specialized Audit: Focused Act ${actTypeToKeep.toUpperCase()}s vs ${targetHouseSystem.stageName} House ${houseTypeOnly === 'mic' ? 'Mics' : 'IEMs'}`);
    };

    const handleTvChannelCycle = (channel: number) => {
        const chStr = channel.toString();
        console.log(`Debug: Cycling channel ${channel}. Current state:`, tvChannelStates[chStr]);
        const current = tvChannelStates[chStr] || 'available';
        
        let next: TVChannelState = 'available';
        if (current === 'available') next = 'mic-only';
        else if (current === 'mic-only') next = 'iem-only';
        else if (current === 'iem-only') next = 'both';
        else if (current === 'both') next = 'blocked';
        else if (current === 'blocked') next = 'available';
        
        let stateLabel: string = next;
        if (next === 'mic-only') stateLabel = 'MIC';
        else if (next === 'iem-only') stateLabel = 'IEM';
        else if (next === 'both') stateLabel = 'M+I';
        else if (next === 'blocked') stateLabel = 'BLOCKED';
        else if (next === 'available') stateLabel = 'AVAILABLE';
        
        toast.info(`Channel ${channel}: ${stateLabel}`);
        
        const nextMap = { ...tvChannelStates, [chStr]: next };
        if (setTvChannelStates) setTvChannelStates(nextMap);
    };

    const handleBlockAllTvChannels = () => {
        const channelMap = tvRegion === 'uk' ? UK_TV_CHANNELS : US_TV_CHANNELS;
        const next: Record<string, TVChannelState> = {};
        Object.keys(channelMap).forEach(ch => {
            next[ch] = 'blocked';
        });
        if (setTvChannelStates) setTvChannelStates(next);
    };

    const handleClearTv = () => {
        if (setTvChannelStates) setTvChannelStates({});
    };

    const handleWwbSmartExport = (eqKey?: string) => {
        setIsExportMenuOpen(false);
        let freqs = rawTabulatedPlan;
        let filename = `WWB_COORD_FESTIVAL_${new Date().toISOString().slice(0, 10)}`;
        if (eqKey) {
            freqs = freqs.filter(f => f.equipmentKey === eqKey);
            const group = uniqueWwbGroups.find(g => g.key === eqKey);
            const cleanedName = (group?.name || eqKey).replace(/\s+/g, '_').toUpperCase();
            filename += `_${cleanedName}`;
        }
        
        const content = freqs.map(f => f.frequency.toFixed(3)).join('\n');
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("✅ WWB Export Downloaded");
    };

    const handleExportPlan = (format: 'pdf' | 'branded-pdf' | 'csv' | 'xlsx' | 'txt' | 'wwb') => {
        setIsExportMenuOpen(false);
        const filename = `festival_rf_plan_${new Date().toISOString().slice(0, 10)}`;
        
        if (format === 'wwb') {
            let content = "";
            processedTabulatedPlan.forEach(row => {
                content += `${row.frequency.toFixed(3)}\n`;
            });
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${filename}_WWB_Coordination.txt`;
            a.click();
            toast.success("✅ WWB Export Downloaded");
        } else if (format === 'csv' || format === 'xlsx') {
            let csv = "ID,Label,Frequency,Type,Allocation,Times,Equipment\n";
            processedTabulatedPlan.forEach(row => {
                csv += `${row.id},"${row.label}",${row.frequency},${row.type},"${row.stage}","${row.times}","${row.equipment}"\n`;
            });
            const blob = new Blob([csv], { type: format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `${filename}.${format === 'xlsx' ? 'xls' : 'csv'}`; a.click();
            toast.success(`✅ ${format.toUpperCase()} Export Downloaded`);
        } else if (format === 'txt') {
            let txt = "FESTIVAL RF COORDINATION LEDGER\n================================\n\n";
            processedTabulatedPlan.forEach(row => {
                txt += `FREQ: ${row.frequency.toFixed(3)} MHz | ID: ${row.id} | LABEL: ${row.label} | TYPE: ${row.type} | STAGE: ${row.stage} | TIMES: ${row.times}\n`;
            });
            const blob = new Blob([txt], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `${filename}.txt`; a.click();
            toast.success("✅ TXT Export Downloaded");
        } else if (format === 'pdf' || format === 'branded-pdf') {
            if (format === 'branded-pdf') {
                setIsPreviewModalOpen(true);
                return;
            }
            const doc = new jsPDF('p', 'mm', 'a4');
            let startY = 20;
            doc.setFontSize(18);
            doc.text('Festival RF Coordination Ledger', 14, startY);
            startY += 15;
            doc.setFontSize(10);
            doc.setTextColor(100, 116, 139);
            doc.text(`Generated: ${new Date().toLocaleString()}`, 14, startY);
            startY += 5;
            
            const tableData = processedTabulatedPlan.map(row => [row.frequency.toFixed(3), row.label, row.type, row.stage, row.times, row.equipment]);
            
            autoTable(doc, {
                startY: startY,
                head: [['Freq', 'Label', 'Type', 'Allocation', 'Times', 'Equipment']],
                body: tableData,
            });
            
            doc.save(`${filename}.pdf`);
            toast.success("✅ PDF Export Downloaded");
        }
    };

    const handleWwbExportAct = (act: FestivalAct, filterType: 'mic' | 'iem') => {
        const actFreqs = (act.frequencies || []).filter(f => (f.type || 'mic') === filterType);
        
        if (actFreqs.length === 0) {
            toast.error(`No ${filterType === 'mic' ? 'mic' : 'IEM'} frequencies to export for ${act.actName}.`);
            return;
        }

        // Minimalist frequency list format for WWB compatibility
        let content = "";
        actFreqs.forEach(f => {
            if (f.value > 0) {
                content += `${f.value.toFixed(3)}\n`;
            }
        });

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const cleanedActName = (act.actName || 'Unknown_Act').replace(/\s+/g, '_');
        a.download = `WWB_${cleanedActName}_${filterType.toUpperCase()}s_${new Date().toISOString().slice(0, 10)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`✅ WWB Export Downloaded for ${act.actName} (${filterType.toUpperCase()}s)`);
    };

    const handleWwbExportSystem = (sys: ConstantSystemRequest, sysType: 'Constant' | 'House', filterType: 'mic' | 'iem') => {
        const sysFreqs = (sys.frequencies || []).filter(f => (f.type || 'mic') === filterType);
        
        if (sysFreqs.length === 0) {
            toast.error(`No ${filterType === 'mic' ? 'mic' : 'IEM'} frequencies to export for ${sys.stageName}.`);
            return;
        }

        let content = "";
        sysFreqs.forEach(f => {
            if (f.value > 0) {
                content += `${f.value.toFixed(3)}\n`;
            }
        });

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const cleanedName = (sys.stageName || 'Unknown_Stage').replace(/\s+/g, '_');
        a.download = `WWB_${cleanedName}_${sysType}_${filterType.toUpperCase()}s_${new Date().toISOString().slice(0, 10)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`✅ WWB Export Downloaded for ${sys.stageName} ${sysType} (${filterType.toUpperCase()}s)`);
    };

    const generatePdfForPreview = (profile: 'client-facing' | 'internal-crew', clientDetails?: any) => {
        const doc = new jsPDF('p', 'mm', 'a4');
        return generateFullCoordinationPdf(doc, 'Festival RF Coordination Ledger', processedTabulatedPlan, user?.branding, clientDetails, profile);
    };

    const handleFreqAction = (actId: string, freqId: string, action: 'lock' | 'remove' | 'value' | 'label' | 'type' | 'lockGroup', newValue?: any) => {
        setFestivalActs(prev => prev.map(act => {
            if (act.id !== actId) return act;
            const nextFreqs = [...(act.frequencies || [])];
            if (action === 'remove') {
                return { ...act, frequencies: nextFreqs.filter(f => f.id !== freqId) };
            }
            if (action === 'lockGroup') {
                return { 
                    ...act, 
                    frequencies: nextFreqs.map(f => f.sourceRequestId === freqId ? { ...f, locked: newValue } : f) 
                };
            }
            const updatedFreqs = nextFreqs.map(f => {
                if (f.id !== freqId) return f;
                switch (action) {
                    case 'lock': return { ...f, locked: newValue !== undefined ? newValue : !f.locked };
                    case 'value': return { ...f, value: parseFloat(newValue) || 0 };
                    case 'label': return { ...f, label: newValue };
                    case 'type': return { ...f, type: newValue as TxType };
                    default: return f;
                }
            });
            return { ...act, frequencies: updatedFreqs };
        }));
    };

    const handleAddGlobalMics = () => {
        setFestivalActs(prev => prev.map(act => ({
            ...act,
            micRequests: [
                ...act.micRequests,
                { id: `req-global-mic-${Date.now()}-${Math.random()}`, equipmentKey: 'custom', count: 0, compatibilityLevel: 'standard', linearMode: false }
            ]
        })));
    };

    const handleAddGlobalIems = () => {
        setFestivalActs(prev => prev.map(act => ({
            ...act,
            iemRequests: [
                ...act.iemRequests,
                { id: `req-global-iem-${Date.now()}-${Math.random()}`, equipmentKey: 'shure-psm1000-g10', count: 0, compatibilityLevel: 'standard', linearMode: false }
            ]
        })));
    };

    const handleAddManualFreq = (targetId: string, type: TxType, collectionContext: 'acts' | 'constant' | 'house') => {
        let defaultEqKey = 'custom';
        let reqs: EquipmentRequest[] | undefined = undefined;

        if (collectionContext === 'acts') {
            const act = festivalActs.find(a => a.id === targetId);
            reqs = type === 'mic' ? act?.micRequests : act?.iemRequests;
        } else if (collectionContext === 'constant') {
            const idx = parseInt(targetId.split('-')[1]);
            const sys = constantSystems[idx];
            reqs = type === 'mic' ? sys?.micRequests : sys?.iemRequests;
        } else if (collectionContext === 'house') {
            const idx = parseInt(targetId.split('-')[1]);
            const sys = houseSystems[idx];
            reqs = type === 'mic' ? sys?.micRequests : sys?.iemRequests;
        }

        if (reqs && reqs.length > 0) {
            defaultEqKey = reqs[0].equipmentKey;
        }

        const newFreq: Frequency = {
            id: `freq-manual-${Date.now()}-${Math.random()}`,
            value: 0,
            type: type,
            equipmentKey: defaultEqKey,
            locked: true, // Manual freqs start locked
            label: 'Manual Entry'
        };

        if (collectionContext === 'acts') {
            setFestivalActs(prev => prev.map(act => {
                if (act.id !== targetId) return act;
                return { ...act, frequencies: [...(act.frequencies || []), newFreq] };
            }));
        } else if (collectionContext === 'constant') {
            setConstantSystems(prev => prev.map((sys, idx) => {
                if (`const-${idx}` !== targetId) return sys;
                return { ...sys, frequencies: [...(sys.frequencies || []), newFreq] };
            }));
        } else if (collectionContext === 'house') {
            setHouseSystems(prev => prev.map((sys, idx) => {
                if (`house-${idx}` !== targetId) return sys;
                return { ...sys, frequencies: [...(sys.frequencies || []), newFreq] };
            }));
        }
    };

    const patchedAnalyzerFrequencies = useMemo(() => {
        const pool: Frequency[] = [];
        if (diagSelectedIds.size === 0) return [];
        
        constantSystems.forEach(s => {
            const id = `const-${s.stageName}`;
            if (diagSelectedIds.has(id)) {
                s.frequencies?.forEach(f => pool.push(f));
            }
        });
        houseSystems.forEach(s => {
            const id = `house-${s.stageName}`;
            if (diagSelectedIds.has(id)) {
                s.frequencies?.forEach(f => pool.push(f));
            }
        });
        festivalActs.forEach(a => {
            if (diagSelectedIds.has(a.id)) {
                a.frequencies?.forEach(f => pool.push(f));
            }
        });
        return pool.filter(f => f.value > 0);
    }, [constantSystems, houseSystems, festivalActs, diagSelectedIds]);

    const selectedWmasIds = useMemo(() => {
        const ids = new Set<string>();
        if (wmasState && wmasState.nodes) {
            // Get all explicitly selected WMAS IDs from the filter set
            wmasState.nodes.forEach(node => {
                if (diagSelectedIds.has(`wmas-${node.id}`)) {
                    ids.add(node.id);
                }
            });

            // Auto-include WMAS nodes associated with selected acts
            const selectedActs = festivalActs.filter(a => diagSelectedIds.has(a.id));
            if (selectedActs.length > 0) {
                selectedActs.forEach(act => {
                    const actNameClean = (act.actName || '').toLowerCase().trim();
                    const actStageClean = (act.stage || '').toLowerCase().trim();
                    const actStart = ensureValidDate(act.startTime).getTime();
                    const actEnd = ensureValidDate(act.endTime).getTime();

                    wmasState.nodes.forEach(node => {
                        // Skip if already added
                        if (ids.has(node.id)) return;
                        
                        // We only auto-associate "Act Specific" nodes that match the selected act
                        if (node.isHouseSystem !== false) return;

                        const nodeActNameClean = (node.actName || '').toLowerCase().trim();
                        const nodeStageClean = (node.stage || '').toLowerCase().trim();

                        // primary match: act name
                        if (actNameClean && nodeActNameClean && actNameClean === nodeActNameClean) {
                            ids.add(node.id);
                            return;
                        }

                        // secondary match: stage + timing (if act name is missing or we want robustness)
                        if (actStageClean && nodeStageClean && actStageClean === nodeStageClean) {
                            if (node.startTime && node.endTime) {
                                const nodeStart = new Date(node.startTime).getTime();
                                const nodeEnd = new Date(node.endTime).getTime();
                                if (actStart < nodeEnd && nodeStart < actEnd) {
                                    ids.add(node.id);
                                }
                            }
                        }
                    });
                });
            }
        }
        return ids;
    }, [wmasState, diagSelectedIds, festivalActs]);

    const toggleFilterId = (id: string) => {
        setDiagSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const handleSortToggle = (field: keyof PlanRow) => {
        setLedgerSort(prev => {
            if (prev.field !== field) return { field, direction: 'asc' };
            if (prev.direction === 'asc') return { field, direction: 'desc' };
            if (prev.direction === 'desc') return { field, direction: null };
            return { field, direction: 'asc' };
        });
    };

    const SortIcon = ({ field }: { field: keyof PlanRow }) => {
        if (ledgerSort.field !== field || !ledgerSort.direction) return <span className="ml-1 opacity-20">⇅</span>;
        return <span className="ml-1 text-cyan-400 font-bold">{ledgerSort.direction === 'asc' ? '↑' : '↓'}</span>;
    };

    return (
        <div className="relative pb-20">
            {/* Day Selector */}
            <div className="flex gap-2 mb-4 p-2 bg-slate-900/50 rounded-md border border-white/5">
                {(festivalState?.days || []).map((day, idx) => (
                    <div
                        key={day.id}
                        onClick={() => {
                            if (activeDayIdx !== idx) setActiveDayIdx(idx);
                        }}
                        className={`flex items-center justify-center rounded-sm font-black uppercase tracking-widest text-[10px] transition-all cursor-pointer min-w-[80px] ${activeDayIdx === idx ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                    >
                        {activeDayIdx === idx ? (
                            <input
                                type="text"
                                value={day.name}
                                onChange={(e) => {
                                    const newName = e.target.value;
                                    setFestivalState(prev => {
                                        const days = [...prev.days];
                                        days[idx] = { ...days[idx], name: newName };
                                        return { ...prev, days };
                                    });
                                }}
                                className="bg-transparent border-none outline-none text-center font-black uppercase w-full px-3 py-2 focus:ring-0 focus:outline-none"
                            />
                        ) : (
                            <button className="px-3 py-2 font-black uppercase tracking-widest text-[10px]">
                                {day.name}
                            </button>
                        )}
                    </div>
                ))}
                <button
                    onClick={() => {
                        setFestivalState(prev => ({
                            ...prev,
                            days: [...prev.days, { id: `day-${prev.days.length + 1}`, name: `Day ${prev.days.length + 1}`, acts: [], tvChannelStates: {} }]
                        }));
                    }}
                    className="px-3 py-2 rounded-sm font-black bg-emerald-900/40 text-emerald-400 border border-emerald-900/50 hover:bg-emerald-900/60 text-[10px]"
                >
                    + Add Day
                </button>
            </div>
            {isConverterOpen && (
                <div className="fixed inset-0 z-[1000000]">
                    <AiScheduleImporter 
                        onClose={() => setIsConverterOpen(false)} 
                        onSync={(newActs) => {
                            setFestivalActs(prev => [...prev, ...newActs]);
                            setExpandedActs(prev => {
                                const next = new Set(prev);
                                newActs.forEach(a => next.add(a.id));
                                return next;
                            });
                        }}
                        zoneConfigs={zoneConfigs}
                    />
                </div>
            )}
            
            <div className={`grid grid-cols-1 lg:grid-cols-12 gap-4 ${isConverterOpen ? 'hidden' : ''}`}>
                <EngagingLoadingState 
                    isOpen={isGenerating} 
                    progress={Math.round((progress.processed / (progress.totalRequested || 1)) * 100)} 
                    status={progress.status} 
                    onCancel={handleCancel}
                />
                <CelebratorySuccessState 
                    isOpen={showSuccess} 
                    onClose={() => setShowSuccess(false)} 
                    frequenciesFound={festivalActs.reduce((acc, a) => acc + (a.frequencies?.length || 0), 0) + constantSystems.reduce((acc, c) => acc + (c.frequencies?.length || 0), 0) + houseSystems.reduce((acc, h) => acc + (h.frequencies?.length || 0), 0)}
                    frequenciesRequired={reqTotal}
                    stats={[
                        { label: 'Frequencies Coordinated', value: festivalActs.reduce((acc, a) => acc + (a.frequencies?.length || 0), 0) + constantSystems.reduce((acc, c) => acc + (c.frequencies?.length || 0), 0) + houseSystems.reduce((acc, h) => acc + (h.frequencies?.length || 0), 0) },
                        { label: 'Stages', value: numZones },
                        ...(optimizationReport ? [
                            { label: 'Mics Found/Req', value: `${optimizationReport.micsFound || 0} / ${optimizationReport.micsRequested || 0}` },
                            { label: 'IEMs Found/Req', value: `${optimizationReport.iemsFound || 0} / ${optimizationReport.iemsRequested || 0}` }
                        ] : [])
                    ]}
                />
                
                {/* TOP SECTION: SETUP & TOPOLOGY */}
                <Card className="lg:col-span-12 !p-2 !bg-slate-900 border-2 border-indigo-500/40 shadow-2xl relative z-10">
                <div className="flex flex-col xl:flex-row justify-between items-stretch gap-4">
                    <div className="flex-1 space-y-4">
                        <div className="flex justify-between items-center">
                            <CardTitle className="!mb-0 text-xl font-semibold">Festival Setup & Topology</CardTitle>
                            <div className="flex items-center gap-2">
                                <div className="flex flex-col items-end">
                                    <label className="text-[9px] text-slate-500 font-black uppercase mb-1">Live Share Name</label>
                                    <input 
                                        type="text" 
                                        value={festivalName} 
                                        onChange={e => setFestivalName(e.target.value)} 
                                        className="bg-slate-950 border border-slate-700 px-3 py-1.5 rounded-sm text-xs text-indigo-400 font-bold outline-none focus:border-indigo-500 transition-all w-48"
                                        placeholder="Festival Name"
                                    />
                                </div>
                                <button 
                                    onClick={() => setIsLiveShareOpen(true)}
                                    className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md font-black uppercase tracking-widest text-[10px] shadow-sm border border-slate-700/50 shadow-indigo-500/20 transition-all"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                    </svg>
                                    Live Handoff
                                </button>
                                <div className="flex items-center gap-2 bg-slate-950/50 p-2 rounded-md border border-white/5">
                                    <div className="flex flex-col items-end">
                                        <label className="text-[9px] text-slate-500 font-black uppercase mb-1">Total Site Stages</label>
                                        <div className="flex items-center bg-slate-800 rounded-sm overflow-hidden border border-slate-700">
                                            <button onClick={() => handleNumZonesChange((Math.max(1, numZones - 1)).toString())} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-indigo-400 font-bold transition-all">-</button>
                                            <input type="number" value={numZonesInput} onChange={e => handleNumZonesChange(e.target.value)} className="w-12 bg-transparent text-center font-mono text-xs text-white font-bold outline-none" />
                                            <button onClick={() => handleNumZonesChange((Math.min(20, numZones + 1)).toString())} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-indigo-400 font-bold transition-all">+</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        </div>

                        {/* Stage Designation List */}
                        <div className="p-2 bg-slate-950/50 rounded-md border border-white/5">
                            <label className="text-[10px] text-slate-500 font-black uppercase mb-3 block tracking-widest">Stage Designation Ledger</label>
                            <div className="flex flex-wrap gap-3">
                                {zoneConfigs.map((cfg, idx) => (
                                    <div key={idx} className="flex bg-slate-800 rounded-sm border border-slate-700 overflow-hidden shadow-md group">
                                        <span className="bg-slate-700 px-2 flex items-center text-[10px] font-black text-slate-400">{idx + 1}</span>
                                        <input 
                                            type="text" 
                                            value={cfg.name} 
                                            onChange={e => handleStageNameChange(idx, e.target.value)} 
                                            className="bg-transparent px-3 py-1.5 text-[11px] text-white font-bold outline-none w-40 focus:bg-indigo-900/30 transition-all"
                                            placeholder={`Stage ${idx + 1}`}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="max-w-md">
                            <label className="text-[10px] text-slate-500 uppercase font-black mb-1 flex items-center">
                                Time Overlap Buffer (min)
                                <InfoTooltip content="The minimum time gap required between acts using the same frequency. Helps prevent interference during changeovers." />
                            </label>
                            <SmartNumberInput 
                                id="overlap-buffer"
                                value={overlapMinutes}
                                onChange={(_, val) => setOverlapMinutes(parseInt(val) || 0)}
                                format={false}
                                className="w-full bg-slate-950 border border-slate-700 p-2 rounded text-sm text-cyan-400 font-bold"
                            />
                        </div>
                    </div>
                </Card>

            {/* BENTO GRID: ANALYSIS & PARAMETERS */}
            <div className="flex justify-between items-center bg-slate-900 border border-slate-700/50 rounded-md p-3 shadow-sm lg:col-span-12">
                <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold">⚙️</span>
                    <div>
                        <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-300">Stage Interaction Settings</h3>
                        <p className="text-[9px] text-slate-500 font-medium">Distance Matrix & Manual IMD Links</p>
                    </div>
                </div>
                <button 
                    onClick={() => setShowMatrixAndLinks(!showMatrixAndLinks)} 
                    className="px-3 py-2 bg-slate-800 text-slate-300 border border-slate-700 rounded-sm text-[10px] font-black uppercase hover:bg-slate-700 hover:text-white transition-all shadow-sm"
                >
                    {showMatrixAndLinks ? 'Hide Interaction Settings' : 'Show Interaction Settings'}
                </button>
            </div>

            {showMatrixAndLinks && (
            <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <Card className="md:col-span-1 !hover:translate-y-0">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-cyan-400">📍 Stage Distance Matrix (m)</h4>
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2">
                                <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest flex items-center justify-between">
                                    <span className="mr-2">Distance Weighting</span>
                                    <button
                                        onClick={() => setFestivalState(prev => ({ ...prev, distanceWeightingEnabled: prev.distanceWeightingEnabled === false ? true : false }))}
                                        className={`relative inline-flex h-3 w-5 items-center rounded-full transition-colors ${festivalState.distanceWeightingEnabled !== false ? 'bg-emerald-500' : 'bg-slate-700'}`}
                                    >
                                        <span className={`inline-block h-2 w-2 transform rounded-full bg-white transition-transform ${festivalState.distanceWeightingEnabled !== false ? 'translate-x-3' : 'translate-x-0.5'}`} />
                                    </button>
                                </label>
                            </div>
                            <div className="flex bg-slate-950 border border-indigo-500/30 rounded-sm p-1 items-center gap-2">
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-2">Global:</span>
                            <input 
                                type="number" 
                                value={globalDistInput} 
                                onChange={e => setGlobalDistInput(e.target.value)}
                                className="w-10 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-[10px] font-mono text-cyan-400 text-center outline-none" 
                            />
                            <button 
                                onClick={handleApplyGlobalDistance}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white text-[7px] font-black uppercase px-1.5 py-1 rounded transition-colors"
                            >
                                Apply
                            </button>
                        </div>
                    </div>
                </div>
                <div className="overflow-x-auto rounded-md border border-slate-700 bg-black/20 custom-scrollbar">
                        <table className="w-full text-[10px] text-center border-collapse">
                            <thead>
                                <tr className="bg-slate-950">
                                    <th className="p-2 border border-slate-800"></th>
                                    {zoneConfigs.map((z, i) => <th key={i} className="p-2 border border-slate-800 text-slate-500 font-black">{z.name}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {distances.map((row, rIdx) => (
                                    <tr key={rIdx}>
                                        <th className="p-2 border border-slate-800 bg-slate-950 text-slate-500 font-black text-left">{zoneConfigs[rIdx]?.name}</th>
                                        {row.map((val, cIdx) => (
                                            <td key={cIdx} className="p-0 border border-slate-800">
                                                {rIdx === cIdx ? <div className="h-8 bg-slate-900/50" /> : <SmartNumberInput 
                                                    id={`dist-${rIdx}-${cIdx}`}
                                                    value={val}
                                                    onChange={(_, v) => {
                                                        const next = [...distances.map(r => [...r])];
                                                        next[rIdx][cIdx] = parseInt(v) || 0;
                                                        if (rIdx !== cIdx) next[cIdx][rIdx] = next[rIdx][cIdx];
                                                        setDistances(next);
                                                    }}
                                                    format={false}
                                                    className="w-full h-8 bg-transparent text-center font-mono text-cyan-400 outline-none focus:bg-indigo-600/10"
                                                />}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>

                <Card className="md:col-span-1 !hover:translate-y-0">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-4">⛓️ Manual Compatibility Links</h4>
                    <div className="overflow-x-auto rounded-md border border-slate-700 bg-black/20 custom-scrollbar">
                        <table className="w-full text-[10px] text-center border-collapse">
                            <thead>
                                <tr className="bg-slate-950">
                                    <th className="p-2 border border-slate-800"></th>
                                    {zoneConfigs.map((z, i) => <th key={i} className="p-2 border border-slate-800 text-slate-500 font-black">{z.name}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {compatibilityMatrix.map((row, rIdx) => (
                                    <tr key={rIdx}>
                                        <th className="p-2 border border-slate-800 bg-slate-950 text-slate-500 font-black text-left">{zoneConfigs[rIdx]?.name}</th>
                                        {row.map((val, cIdx) => (
                                            <td key={cIdx} className="p-2 border border-slate-800 text-center">{rIdx === cIdx ? '—' : <input type="checkbox" checked={val} onChange={() => {
                                                const next = compatibilityMatrix.map(r => [...r]);
                                                next[rIdx][cIdx] = !next[rIdx][cIdx];
                                                if (rIdx !== cIdx) next[cIdx][rIdx] = next[rIdx][cIdx];
                                                setCompatibilityMatrix(next);
                                            }} className="w-4 h-4 accent-indigo-500" />}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
            )}

            <div className="lg:col-span-8 flex flex-col gap-4 h-full relative z-[200]">
                <Card className="!hover:translate-y-0 flex-grow">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
                        <div>
                            <CardTitle className="!mb-0 text-sm flex items-center">
                                📺 Quad-State TV Grid
                                <InfoTooltip content="Manage TV channel exclusions. Click a channel to cycle through states: Available (Green), Blocked (Red). During coordination, designate channels for Mics Only (Blue), IEMs Only (Amber), Mic or IEM (Purple)" />
                            </CardTitle>
                            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter mt-1">Define protected whitespace. Click to cycle states.</p>
                        </div>
                    </div>
                    <TvGrid 
                        title=""
                        tvRegion={tvRegion}
                        setTvRegion={setTvRegion}
                        tvChannelStates={tvChannelStates}
                        setTvChannelStates={setTvChannelStates}
                        tvChannelErpData={tvChannelErpData}
                        onTvChannelErpDataChange={setTvChannelErpData}
                        handleTvChannelCycle={handleTvChannelCycle}
                        handleBlockAllTvChannels={handleBlockAllTvChannels}
                        handleClearTv={handleClearTv}
                    />
                </Card>
            </div>

            <div className="lg:col-span-4 flex flex-col gap-4 h-full relative z-[200]">
                <Card className="bg-indigo-600/10 border-indigo-500/30 !p-2 h-full flex flex-col justify-between">
                    <div>
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-4">Engine Controls</h4>
                        
                        <div className="flex flex-col gap-2 mb-4">
                            <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Calculation Strategy</label>
                            <div className="grid grid-cols-1 gap-2">
                                {[
                                    { id: 'even-distribution', label: 'Even Distribution', desc: 'Scatters assignments evenly to maximize guard bands.' },
                                    { id: 'bottom-up', label: 'Bottom-Up Packing', desc: 'Linearly packs frequencies from bottom of range up.' },
                                    { id: 'top-down', label: 'Top-Down Packing', desc: 'Linearly packs frequencies from top of range down.' },
                                    { id: 'high-density', label: 'High Density Packing', desc: 'Runs advanced narrow-spaced permutation models.' },
                                ].map((strategy) => {
                                    const isSelected = calculationStrategy === strategy.id;
                                    return (
                                        <button
                                            key={strategy.id}
                                            type="button"
                                            onClick={() => setCalculationStrategy(strategy.id as any)}
                                            className={`text-left p-2.5 rounded-md border transition-all duration-200 flex flex-col gap-1 outline-none ${
                                                isSelected 
                                                    ? 'bg-indigo-600/30 border-indigo-500 text-white shadow-sm border border-slate-700/50 shadow-indigo-600/10' 
                                                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-900/80 hover:border-slate-700 hover:text-slate-200'
                                            }`}
                                        >
                                            <span className="text-[10px] font-black uppercase tracking-wider flex items-center gap-2">
                                                <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-indigo-400' : 'bg-slate-600'}`} />
                                                {strategy.label}
                                            </span>
                                            <span className="text-[9px] opacity-75 font-semibold leading-normal text-slate-500">
                                                {strategy.desc}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5 mb-4">
                            <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Optimization Depth</label>
                            <div className="flex bg-slate-900 rounded-sm p-1 border border-slate-700">
                                <select
                                    value={engineIterations}
                                    onChange={(e) => setEngineIterations(Number(e.target.value))}
                                    className="w-full bg-slate-900 text-slate-300 text-[10px] font-bold uppercase tracking-widest rounded-md py-1.5 outline-none text-center cursor-pointer appearance-none"
                                >
                                    <option value={1}>1 Pass (Standard)</option>
                                    <option value={5}>5 Passes (Deep)</option>
                                    <option value={20}>20 Passes (Exhaustive)</option>
                                    <option value={50}>50 Passes (Maximum)</option>
                                </select>
                            </div>
                            <p className="text-[8px] text-zinc-500 leading-tight font-medium">
                                Multiple passes explore different placement permutations to squeeze out every possible frequency. Takes longer to generate.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-2 mt-4 pt-4 border-t border-indigo-500/10">
                        <button 
                            onClick={() => handleGenerate()} 
                            disabled={isGenerating} 
                            className="w-full py-2.5 rounded-md font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 bg-yellow-500 text-slate-900 border-b-4 border-yellow-700 active:translate-y-0.5 hover:bg-yellow-400 shadow-sm border border-slate-700/50 shadow-yellow-500/10 ring-1 ring-yellow-400/30 text-[10px]"
                        >
                            {isGenerating ? (
                                <><span className="w-3 h-3 border-2 border-slate-900/20 border-t-slate-900 rounded-full animate-spin"></span>COORDINATING...</>
                            ) : (
                                <><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> GENERATE</>
                            )}
                        </button>
                        <button 
                            onClick={() => setShowTabulation(!showTabulation)}
                            className={`w-full py-2.5 rounded-md font-black uppercase tracking-widest transition-all ${secondaryButton} text-[10px]`}
                        >
                            {showTabulation ? 'Hide Site Ledger' : '📋 View Site Ledger'}
                        </button>
                        <div className="relative z-[9999]">
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} 
                                    className={`flex-1 py-2.5 rounded-md font-black uppercase tracking-widest transition-all ${secondaryButton} text-[10px] flex items-center justify-center gap-2`}
                                >
                                    <span>📥</span> EXPORT RF PLAN <span className="text-[8px] opacity-60">▼</span>
                                </button>
                                <button 
                                    onClick={() => setIsLiveShareOpen(true)} 
                                    className={`px-3 py-2.5 rounded-md font-black uppercase tracking-widest transition-all bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm border border-slate-700/50 shadow-indigo-500/20 text-[10px] flex items-center justify-center gap-2 border-b-4 border-indigo-800 active:translate-y-0.5`}
                                    title="Share Live Link"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                                </button>
                            </div>
                            {isExportMenuOpen && (
                                <div className="absolute top-full right-0 mt-2 bg-slate-800 border border-indigo-500/40 rounded-md shadow-2xl z-[20000] overflow-visible animate-in fade-in slide-in-from-top-4 duration-200 divide-y divide-white/5 min-w-[220px]">
                                    <div className="bg-indigo-500/15 p-2">
                                        <div className="px-2 py-1.5 flex items-center gap-2 mb-2 border-b border-indigo-500/20">
                                            <span className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.1em]">WWB Smart Export (.TXT)</span>
                                        </div>
                                        <div className="flex flex-col gap-1.5 max-h-[300px] overflow-y-auto custom-scrollbar">
                                            <button onClick={() => handleWwbSmartExport()} className="w-full text-left px-3 py-2.5 hover:bg-indigo-600 rounded bg-indigo-500/30 text-[9px] font-black text-white uppercase tracking-tighter transition-all border border-indigo-400/20 shadow-sm">
                                                &bull; Full Site Frequency List
                                            </button>
                                            {uniqueWwbGroups.length > 0 ? uniqueWwbGroups.map(group => (
                                                <button 
                                                    key={group.key}
                                                    onClick={() => handleWwbSmartExport(group.key)}
                                                    className="w-full text-left px-3 py-2.5 hover:bg-slate-700 rounded bg-slate-950/60 border border-white/10 text-[9px] font-bold text-indigo-200 uppercase tracking-tighter transition-all"
                                                >
                                                    &bull; Export {group.name} - {group.count} CH
                                                </button>
                                            )) : (
                                                <div className="text-[8px] text-slate-500 px-3 py-2 italic">Coordinate site to populate hardware groups...</div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 divide-y divide-white/5">
                                        <button onClick={() => handleExportPlan('pdf')} className="w-full text-left p-3.5 hover:bg-slate-700 transition-colors flex items-center justify-between">
                                            <span className="text-white font-bold text-[10px] uppercase tracking-wider">PDF Site Ledger</span>
                                            <span className="text-xs">📄</span>
                                        </button>
                                        <button onClick={() => handleExportPlan('branded-pdf')} className="w-full text-left p-3.5 hover:bg-slate-700 transition-colors flex items-center justify-between">
                                            <span className="text-white font-bold text-[10px] uppercase tracking-wider">Company PDF Report</span>
                                            <span className="text-xs">📄</span>
                                        </button>
                                        <button onClick={() => handleExportPlan('xlsx')} className="w-full text-left p-3.5 hover:bg-slate-700 transition-colors flex items-center justify-between">
                                            <span className="text-white font-bold text-[10px] uppercase tracking-wider">Excel Spreadsheet</span>
                                            <span className="text-xs">📊</span>
                                        </button>
                                        <button onClick={() => handleExportPlan('txt')} className="w-full text-left p-3.5 hover:bg-slate-700 transition-colors flex items-center justify-between">
                                            <span className="text-white font-bold text-[10px] uppercase tracking-wider">Plain Text (.TXT)</span>
                                            <span className="text-xs">📄</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </Card>
            </div>

            {/* RESULTS & TABBED CONTENT */}
            <div className="lg:col-span-12 space-y-2">
                {showTabulation && (
                    <Card className="relative z-[100] !bg-black/40 border-cyan-500/30 shadow-[0_0_50px_rgba(34,211,238,0.1)] animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex justify-between items-center mb-2">
                            <CardTitle className="!mb-0 text-sm uppercase tracking-[0.2em] text-cyan-400">Authoritative Site RF Ledger</CardTitle>
                            <button onClick={() => setShowTabulation(false)} className="text-slate-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest">&times; Close</button>
                        </div>
                        
                        <div className="flex flex-col gap-3 mb-4 p-3 bg-slate-900/50 rounded-sm border border-slate-800">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Ledger Extraction Filters</span>
                                <button 
                                    onClick={() => setLedgerFilters({})}
                                    className="text-[9px] font-bold text-slate-400 hover:text-white uppercase tracking-wider transition-colors"
                                >
                                    Clear Filters
                                </button>
                            </div>
                            
                            <div className="flex flex-wrap gap-2">
                                <button 
                                    onClick={() => setLedgerFilters(f => {
                                        let current = [...(f.times || [])];
                                        if (current.includes('Constant')) current = current.filter(t => t !== 'Constant');
                                        else current.push('Constant');
                                        return { ...f, times: current };
                                    })} 
                                    className={`px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider rounded transition-colors ${ledgerFilters.times?.includes('Constant') ? 'bg-indigo-500 text-white' : 'bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20'}`}
                                >
                                    Constant Transmits
                                </button>
                                <button 
                                    onClick={() => setLedgerFilters(f => {
                                        let current = [...(f.times || [])];
                                        if (current.includes('House System')) current = current.filter(t => t !== 'House System');
                                        else current.push('House System');
                                        return { ...f, times: current };
                                    })} 
                                    className={`px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider rounded transition-colors ${ledgerFilters.times?.includes('House System') ? 'bg-purple-500 text-white' : 'bg-purple-500/10 text-purple-300 hover:bg-purple-500/20'}`}
                                >
                                    Stage House Systems
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                                <MultiSelectDropdown
                                    title="Act / Label"
                                    options={uniqueOptions.labels}
                                    selected={ledgerFilters.label || []}
                                    onChange={(selected) => setLedgerFilters(f => ({ ...f, label: selected }))}
                                />
                                <MultiSelectDropdown
                                    title="Stage / Zone"
                                    options={uniqueOptions.stages}
                                    selected={ledgerFilters.stage || []}
                                    onChange={(selected) => setLedgerFilters(f => ({ ...f, stage: selected }))}
                                />
                                <MultiSelectDropdown
                                    title="Date / Time"
                                    options={uniqueOptions.times}
                                    selected={ledgerFilters.times || []}
                                    onChange={(selected) => setLedgerFilters(f => ({ ...f, times: selected }))}
                                />
                                <MultiSelectDropdown
                                    title="Equipment Type"
                                    options={uniqueOptions.types}
                                    selected={ledgerFilters.type || []}
                                    onChange={(selected) => setLedgerFilters(f => ({ ...f, type: selected }))}
                                />
                            </div>
                        </div>

                        <div className="max-h-[600px] overflow-auto rounded-md border border-white/5 shadow-inner custom-scrollbar">
                            {/* Desktop Table View */}
                            <table className="w-full text-left border-collapse text-[10px] hidden md:table">
                                <thead className={`bg-slate-900 z-10 shadow-sm`}>
                                    <tr className="uppercase font-black text-slate-500 border-b border-white/10">
                                        <th className="p-3 cursor-pointer" onClick={() => handleSortToggle('frequency')}>Freq <SortIcon field="frequency" /></th>
                                        <th className="p-3 cursor-pointer" onClick={() => handleSortToggle('label')}>Label <SortIcon field="label" /></th>
                                        <th className="p-3 cursor-pointer" onClick={() => handleSortToggle('type')}>Type <SortIcon field="type" /></th>
                                        <th className="p-3 cursor-pointer" onClick={() => handleSortToggle('stage')}>Stage <SortIcon field="stage" /></th>
                                        <th className="p-3 cursor-pointer" onClick={() => handleSortToggle('times')}>Times <SortIcon field="times" /></th>
                                        <th className="p-3">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {processedTabulatedPlan.map((row) => (
                                        <tr key={row.id} id={`ledger-row-${row.id}`} className="hover:bg-white/5 transition-all duration-300 group">
                                            <td className="p-3 tabular-nums text-cyan-400 font-black">{row.frequency.toFixed(3)}</td>
                                            <td className="p-3 text-white font-bold">{row.label}</td>
                                            <td className="p-3"><span className={`px-1.5 py-0.5 rounded-[4px] uppercase text-[8px] font-black border ${row.type === 'iem' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>{row.type}</span></td>
                                            <td className="p-3 text-indigo-300 font-bold uppercase tracking-tighter">{row.stage}</td>
                                            <td className="p-3 font-mono text-slate-400">{row.times}</td>
                                            <td className="p-3 text-center text-sm">{row.status}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {/* Mobile Card View */}
                            <div className="md:hidden divide-y divide-white/5">
                                {processedTabulatedPlan.map((row) => (
                                    <div key={row.id} id={`ledger-card-${row.id}`} className="p-2 space-y-3 hover:bg-white/5 transition-all duration-300">
                                        <div className="flex justify-between items-center">
                                            <span className="tabular-nums text-cyan-400 font-black text-sm">{row.frequency.toFixed(3)} MHz</span>
                                            <span className={`px-1.5 py-0.5 rounded-[4px] uppercase text-[8px] font-black border ${row.type === 'iem' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>{row.type}</span>
                                        </div>
                                        <div>
                                            <div className="text-white font-bold text-[11px] uppercase tracking-wide">{row.label}</div>
                                            <div className="flex justify-between items-center mt-1">
                                                <span className="text-indigo-300 font-black text-[9px] uppercase tracking-tighter">{row.stage}</span>
                                                <span className="text-slate-500 font-mono text-[9px]">{row.times}</span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center pt-1 border-t border-white/5">
                                            <span className="text-[9px] text-slate-500 uppercase font-bold">Status</span>
                                            <span className="text-sm">{row.status}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {processedTabulatedPlan.length === 0 && (
                                <div className="p-12 text-center text-slate-600 uppercase font-black tracking-widest italic opacity-50">No frequencies allocated.</div>
                            )}
                        </div>
                    </Card>
                )}

                <div className={`bg-slate-800/50 p-2 rounded-md flex flex-wrap gap-2 z-[70] backdrop-blur-md shadow-sm border border-slate-700/50 mb-4 text-white`}>
                    {(['acts', 'act-matrix', 'constant', 'house', 'wmas'] as const).map(tab => {
                        let styles = "";
                        if (tab === 'acts') {
                            styles = activeSubTab === tab 
                                ? 'bg-indigo-600 border-indigo-400 text-white shadow-sm border border-slate-700/50' 
                                : 'bg-indigo-900/20 border-indigo-500/20 text-indigo-400 hover:bg-indigo-900/40';
                        } else if (tab === 'act-matrix') {
                            styles = activeSubTab === tab 
                                ? 'bg-fuchsia-600 border-fuchsia-400 text-white shadow-sm border border-slate-700/50' 
                                : 'bg-fuchsia-900/20 border-fuchsia-500/20 text-fuchsia-400 hover:bg-fuchsia-900/40';
                        } else if (tab === 'constant') {
                            styles = activeSubTab === tab 
                                ? 'bg-green-500 border-green-400 text-slate-950 shadow-sm border border-slate-700/50' 
                                : 'bg-green-900/20 border-green-500/20 text-green-400 hover:bg-green-900/40';
                        } else if (tab === 'house') {
                            styles = activeSubTab === tab 
                                ? 'bg-blue-800 border-blue-600 text-white shadow-sm border border-slate-700/50' 
                                : 'bg-blue-900/20 border-blue-500/20 text-blue-400 hover:bg-blue-900/40';
                        } else if (tab === 'wmas') {
                            styles = activeSubTab === tab 
                                ? 'bg-rose-600 border-rose-400 text-white shadow-sm border border-slate-700/50' 
                                : 'bg-rose-900/20 border-rose-500/20 text-rose-400 hover:bg-rose-900/40';
                        }
                        return (
                            <button key={tab} onClick={() => setActiveSubTab(tab)} className={`flex-1 py-3 rounded-md font-black uppercase tracking-widest text-[10px] transition-all border-b-4 active:translate-y-0.5 flex items-center justify-center gap-2 ${styles}`}>
                                {tab === 'acts' && '🎤 Performing Acts'}
                                {tab === 'act-matrix' && '🔀 Act Strict IMD Matrix'}
                                {tab === 'constant' && '🛰️ Constant TX'}
                                {tab === 'house' && '📡 House Systems'}
                                {tab === 'wmas' && '⚡ WMAS Allocations'}
                            </button>
                        );
                    })}
                </div>

                {/* TAB ACTIONS & CONTENT LISTS */}
                {activeSubTab === 'acts' && (
                    <div className="space-y-2">
                        <div className="flex flex-wrap gap-2 px-2">
                        <button onClick={() => {
                            const newAct: FestivalAct = { id: `act-${Date.now()}-${Math.random()}`, actName: `New Act`, stage: zoneConfigs[0]?.name || 'Stage 1', startTime: new Date(), endTime: new Date(Date.now() + 3600000), active: true, micRequests: [], iemRequests: [], frequencies: [] };
                            setFestivalActs([...festivalActs, newAct]);
                        }} className="flex-1 min-w-[120px] py-3 rounded-md font-semibold uppercase tracking-wide text-[10px] transition-all border-b-4 active:translate-y-0.5 flex items-center justify-center gap-2 bg-indigo-600 text-white border-indigo-800 hover:bg-indigo-500 shadow-sm border border-slate-700/50 shadow-indigo-500/20">+ Add Act</button>
                        <button onClick={() => fileInputRef.current?.click()} className="flex-1 min-w-[120px] py-3 rounded-md font-semibold uppercase tracking-wide text-[10px] transition-all border-b-4 active:translate-y-0.5 flex items-center justify-center gap-2 bg-slate-800 text-slate-400 border-slate-950 hover:bg-slate-700">Import CSV</button>
                        <button onClick={() => setIsConverterOpen(true)} className="flex-1 min-w-[150px] py-3 rounded-md font-semibold uppercase tracking-wide text-[10px] transition-all border-b-4 active:translate-y-0.5 flex items-center justify-center gap-2 bg-indigo-600 text-white border-indigo-800 hover:bg-indigo-500 shadow-sm border border-slate-700/50 shadow-indigo-500/20">🧮 IMPORT RUNNING ORDER</button>
                        <button 
                            onClick={() => setActiveTab && setActiveTab('festivalTracker')} 
                            className="flex-1 min-w-[120px] py-3 rounded-md font-semibold uppercase tracking-wide text-[10px] transition-all border-b-4 active:translate-y-0.5 flex items-center justify-center gap-2 bg-emerald-600 text-white border-emerald-800 hover:bg-emerald-500 shadow-sm border border-slate-700/50 shadow-emerald-500/10"
                        >
                            📊 ALLOCATION TRACKER
                        </button>
                        <button 
                            onClick={() => setShowTabulation(!showTabulation)}
                            className={`flex-1 min-w-[120px] py-3 rounded-md font-semibold uppercase tracking-wide text-[10px] transition-all border-b-4 active:translate-y-0.5 flex items-center justify-center gap-2 ${
                                showTabulation 
                                    ? 'bg-emerald-600 text-white border-emerald-800 hover:bg-emerald-500 shadow-sm border border-slate-700/50 shadow-emerald-500/10' 
                                    : 'bg-emerald-950/40 text-emerald-300 border-emerald-900/50 hover:bg-emerald-900/60'
                            }`}
                        >
                            {showTabulation ? 'Hide Ledger' : '📋 Tabulate'}
                        </button>
                        <button 
                            onClick={() => handleLockAllSite(!anyFrequenciesLocked)} 
                            className="flex-1 min-w-[120px] py-3 rounded-md font-semibold uppercase tracking-wide text-[10px] transition-all border-b-4 active:translate-y-0.5 flex items-center justify-center gap-2 bg-slate-800 text-slate-300 border-slate-950 hover:bg-slate-700"
                        >
                            {anyFrequenciesLocked ? '🔓 Unlock All' : '🔒 Lock All'}
                        </button>
                        <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={e => {
                                const file = e.target.files?.[0]; if (!file) return;
                                const r = new FileReader(); r.onload = () => {
                                    const lines = (r.result as string).split('\n').slice(1).filter(l => l.trim());
                                    const newActs = lines.map(l => {
                                        const [name, stage, start, end] = l.split(',').map(s => s.replace(/^["']|["']$/g, '').trim());
                                        return { 
                                            id: `act-${Date.now()}-${Math.random()}`, 
                                            actName: name, 
                                            stage: stage || zoneConfigs[0]?.name || 'Stage 1', 
                                            startTime: parseFlexibleDate(start), 
                                            endTime: parseFlexibleDate(end), 
                                            active: true, 
                                            micRequests: [], 
                                            iemRequests: [], 
                                            frequencies: [] 
                                        } as FestivalAct;
                                    });
                                    setFestivalActs(prev => [...prev, ...newActs]);
                                }; r.readAsText(file);
                        }} />
                    </div>

                {(isGenerating || (progress.totalRequested > 0)) && (
                    <div className="relative z-[60] bg-slate-950/80 backdrop-blur-xl border border-white/5 rounded-md p-3 mb-4 space-y-1.5 animate-in fade-in duration-300">
                        <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-widest text-indigo-300 px-1">
                            <span>Engine Pass: {progress.status}</span>
                            <span className="font-mono">{Math.round((progress.processed / (progress.totalRequested || 1)) * 100)}%</span>
                        </div>
                        <div className="h-1 bg-slate-900 rounded-full overflow-hidden border border-white/5 relative">
                            <div 
                                className="h-full bg-gradient-to-r from-blue-500 via-indigo-400 to-cyan-300 transition-all duration-300 relative shadow-[0_0_10px_rgba(34,211,238,0.5)]" 
                                style={{ width: `${(progress.processed / (progress.totalRequested || 1)) * 100}%` }}
                            >
                                <div className="absolute inset-x-0 bottom-0 h-full bg-white/20 animate-[shimmer_2s_infinite]" />
                            </div>
                        </div>
                    </div>
                )}

                <div className="bg-slate-900/40 p-2 rounded-md border border-indigo-500/20 flex flex-col md:flex-row gap-2 items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Bulk Slot Initialization</span>
                            <span className="text-[9px] text-slate-500 font-bold uppercase mt-0.5">Initialize equipment forms for every act in the current bill</span>
                        </div>
                        <div className="flex gap-2 w-full md:w-auto">
                            <button 
                                onClick={handleAddGlobalMics}
                                className="flex-1 md:flex-none px-3 py-2.5 bg-emerald-600/20 text-white border-emerald-500/30 hover:bg-emerald-600 rounded-sm font-black uppercase tracking-widest text-[9px] border transition-all flex items-center justify-center gap-2"
                            >
                                <span className="text-xs">🎤</span> + ADD MIC SLOT TO ALL ACTS
                            </button>
                            <button 
                                onClick={handleAddGlobalIems}
                                className="flex-1 md:flex-none px-3 py-2.5 bg-rose-600/20 text-white border-rose-500/30 hover:bg-rose-600 rounded-sm font-black uppercase tracking-widest text-[9px] border transition-all flex items-center justify-center gap-2"
                            >
                                <span className="text-xs">🎧</span> + ADD IEM SLOT TO ALL ACTS
                            </button>
                            <button
                                onClick={() => setIsLiveScanOpen(true)}
                                className="flex-1 md:flex-none px-3 py-2.5 bg-cyan-950/40 text-cyan-400 border border-cyan-900/50 hover:bg-cyan-900/60 rounded-sm font-black uppercase tracking-[0.15em] text-[9px] border transition-all flex items-center justify-center gap-1.5"
                            >
                                📥 Enable Live Receiver (TinySA / RF Explorer)
                            </button>
                            <button 
                                onClick={() => {
                                    const allExpanded = festivalActs.length > 0 && festivalActs.every(a => expandedActs.has(a.id));
                                    if (allExpanded) {
                                        setExpandedActs(new Set());
                                    } else {
                                        const next = new Set(expandedActs);
                                        festivalActs.forEach(a => next.add(a.id));
                                        setExpandedActs(next);
                                    }
                                }}
                                className="flex-1 md:flex-none px-3 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white border border-emerald-400 shadow-md rounded-sm font-black uppercase tracking-widest text-[9px] transition-all flex items-center justify-center gap-1.5"
                            >
                                {festivalActs.length > 0 && festivalActs.every(a => expandedActs.has(a.id)) ? '⛕ Collapse All' : '⛙ Expand All'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CONTENT LISTS */}
            {activeSubTab === 'acts' && (
                <div className="space-y-4 animate-in fade-in duration-500 relative z-0">
                    {festivalActs.map(act => {
                        const activeWmasNodes = wmasState?.nodes?.filter(node => {
                            if (!node.assignedBlock) return false;
                            const actStageClean = (act.stage || '').toLowerCase().trim();
                            const nodeStageClean = (node.stage || '').toLowerCase().trim();

                            if (node.isHouseSystem !== false) {
                                // Only hide house nodes if muting is enabled AND it's the correct stage
                                if (act.muteHouseFrequencies && nodeStageClean === actStageClean) return false;
                                return true;
                            }
                            if (nodeStageClean === actStageClean || !nodeStageClean || nodeStageClean === '') {
                                if (node.actName && node.actName.trim() !== '') {
                                    if (node.actName.trim().toLowerCase() !== act.actName.trim().toLowerCase()) return false;
                                }
                                if (node.startTime && node.endTime) {
                                    const wmasStart = new Date(node.startTime).getTime();
                                    const wmasEnd = new Date(node.endTime).getTime();
                                    const actStart = ensureValidDate(act.startTime).getTime();
                                    const actEnd = ensureValidDate(act.endTime).getTime();
                                    return actStart < wmasEnd && wmasStart < actEnd;
                                }
                                return true;
                            }
                            return false;
                        }) || [];
                        
                        const micWmas = activeWmasNodes.filter(n => n.mode !== 'low-latency');
                        const iemWmas = activeWmasNodes.filter(n => n.mode === 'low-latency');

                        return (
                        <Card key={act.id} className={`!p-2 !bg-slate-900/80 transition-all ${!expandedActs.has(act.id) ? 'opacity-80 hover:opacity-100' : ''}`}>
                            {!expandedActs.has(act.id) ? (
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                                    <div className="flex-1 min-w-[200px] flex items-center gap-3">
                                        <input value={act.actName} onChange={e => setFestivalActs(prev => prev.map(a => a.id === act.id ? { ...a, actName: e.target.value } : a))} className="flex-1 bg-transparent font-bold text-base font-medium text-white outline-none border-b border-white/10" />
                                        <div className="flex items-center gap-1.5">
                                            {(() => {
                                                const hasFreq = act.frequencies && act.frequencies.some(f => f.value > 0);
                                                return (
                                                    <>
                                                        <button 
                                                            onClick={() => setFestivalActs(prev => prev.map(a => a.id === act.id ? { ...a, isOwnRf: true, useHouseSystem: false, isHybrid: false, isNoRf: false } : a))}
                                                            className={`px-2 py-1 rounded-sm text-[7px] font-black uppercase tracking-widest border transition-all ${(hasFreq || act.isOwnRf || (!act.useHouseSystem && !act.isHybrid && !act.isNoRf)) && !act.isHybrid ? 'bg-cyan-600 border-cyan-400 text-white' : 'bg-slate-800 border-white/5 text-slate-500'}`}
                                                            title="Own RF Gear"
                                                        >
                                                            Own RF
                                                        </button>
                                                        <button 
                                                            onClick={() => setFestivalActs(prev => prev.map(a => a.id === act.id ? { ...a, useHouseSystem: true, isOwnRf: false, isHybrid: false, isNoRf: false } : a))}
                                                            className={`px-2 py-1 rounded-sm text-[7px] font-black uppercase tracking-widest border transition-all ${act.useHouseSystem && !hasFreq ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-800 border-white/5 text-slate-500'}`}
                                                            title="House RF Gear"
                                                        >
                                                            House
                                                        </button>
                                                    </>
                                                );
                                            })()}
                                            <button 
                                                onClick={() => setFestivalActs(prev => prev.map(a => a.id === act.id ? { ...a, isHybrid: true, isOwnRf: false, useHouseSystem: false, isNoRf: false } : a))}
                                                className={`px-2 py-1 rounded-sm text-[7px] font-black uppercase tracking-widest border transition-all ${act.isHybrid ? 'bg-indigo-500/80 border-indigo-400 text-white shadow-[0_0_10px_rgba(99,102,241,0.2)]' : 'bg-slate-800 border-white/5 text-slate-500'}`}
                                                title="Hybrid Setup"
                                            >
                                                Hybrid
                                            </button>
                                            <button 
                                                onClick={() => setFestivalActs(prev => prev.map(a => a.id === act.id ? { ...a, isNoRf: true, isOwnRf: false, useHouseSystem: false, isHybrid: false } : a))}
                                                className={`px-2 py-1 rounded-sm text-[7px] font-black uppercase tracking-widest border transition-all ${act.isNoRf ? 'bg-slate-600 border-slate-400 text-white' : 'bg-slate-800 border-white/5 text-slate-500'}`}
                                                title="No RF Required"
                                            >
                                                No RF
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex gap-4 items-center flex-wrap flex-1 justify-end mr-4">
                                        <div className="flex flex-col gap-1 min-w-[70px]">
                                            <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Order</span>
                                            <div className="flex items-center gap-1">
                                                <button onClick={() => setFestivalActs(prev => prev.map(a => a.id === act.id ? { ...a, orderNumber: Math.max(1, (a.orderNumber || 1) - 1) } : a))} className="bg-slate-800 hover:bg-slate-700 text-slate-300 rounded px-1.5 py-0.5 text-[8px] font-bold border border-slate-700">-</button>
                                                <input type="number" value={act.orderNumber || ''} onChange={e => setFestivalActs(prev => prev.map(a => a.id === act.id ? { ...a, orderNumber: parseInt(e.target.value) || undefined } : a))} className="text-[10px] text-emerald-400 font-black uppercase tracking-tighter bg-transparent outline-none w-8 text-center border-b border-white/10" />
                                                <button onClick={() => setFestivalActs(prev => prev.map(a => a.id === act.id ? { ...a, orderNumber: (a.orderNumber || 0) + 1 } : a))} className="bg-slate-800 hover:bg-slate-700 text-slate-300 rounded px-1.5 py-0.5 text-[8px] font-bold border border-slate-700">+</button>
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-1 min-w-[80px]">
                                            <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Stage</span>
                                            <span className="text-[10px] text-indigo-300 font-black uppercase tracking-tighter">{act.stage}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <div className="flex flex-col gap-1 min-w-[60px]">
                                                <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Start Time</span>
                                                <span className="text-[10px] text-white font-mono">{act.startTime ? ensureValidDate(act.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}</span>
                                            </div>
                                            <div className="flex flex-col gap-1 min-w-[60px]">
                                                <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Finish Time</span>
                                                <span className="text-[10px] text-white font-mono">{act.endTime ? ensureValidDate(act.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button onClick={() => toggleActCollapse(act.id, false)} className="text-[10px] bg-indigo-900/40 text-indigo-400 border border-indigo-500/30 px-3 py-1.5 rounded hover:bg-indigo-600 hover:text-white transition-all font-black uppercase tracking-widest">Expand</button>
                                        <button onClick={() => setFestivalActs(prev => prev.filter(a => a.id !== act.id))} className="text-red-400 font-bold text-base font-medium leading-none hover:text-red-300 transition-colors">&times;</button>
                                    </div>
                                </div>
                            ) : (
                            <>
                            <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-2 w-1/2">
                                    <input value={act.actName} onChange={e => setFestivalActs(prev => prev.map(a => a.id === act.id ? { ...a, actName: e.target.value } : a))} className="bg-transparent font-bold text-base font-medium text-white outline-none border-b border-white/10 flex-1" />
                                <div className="flex items-center gap-2">
                                    {(() => {
                                        const hasFreq = act.frequencies && act.frequencies.some(f => f.value > 0);
                                        return (
                                            <>
                                                <button 
                                                    onClick={() => setFestivalActs(prev => prev.map(a => a.id === act.id ? { ...a, isOwnRf: true, useHouseSystem: false, isHybrid: false, isNoRf: false } : a))}
                                                    className={`px-3 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest border transition-all ${(hasFreq || act.isOwnRf || (!act.useHouseSystem && !act.isHybrid && !act.isNoRf)) && !act.isHybrid ? 'bg-cyan-600 border-cyan-400 text-white shadow-[0_0_15px_rgba(34,211,238,0.3)]' : 'bg-slate-800 border-white/5 text-slate-500 hover:border-white/20'}`}
                                                >
                                                    Own RF
                                                </button>
                                                <button 
                                                    onClick={() => setFestivalActs(prev => prev.map(a => a.id === act.id ? { ...a, useHouseSystem: true, isOwnRf: false, isHybrid: false, isNoRf: false } : a))}
                                                    className={`px-3 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest border transition-all ${act.useHouseSystem && !hasFreq ? 'bg-indigo-600 border-indigo-400 text-white shadow-[0_0_15px_rgba(99,102,241,0.3)]' : 'bg-slate-800 border-white/5 text-slate-500 hover:border-white/20'}`}
                                                >
                                                    House RF
                                                </button>
                                            </>
                                        );
                                    })()}
                                    <button 
                                        onClick={() => setFestivalActs(prev => prev.map(a => a.id === act.id ? { ...a, isHybrid: true, isOwnRf: false, useHouseSystem: false, isNoRf: false } : a))}
                                        className={`px-3 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest border transition-all ${act.isHybrid ? 'bg-indigo-400 border-indigo-300 text-white shadow-[0_0_15px_rgba(129,140,248,0.3)]' : 'bg-slate-800 border-white/5 text-slate-500 hover:border-white/20'}`}
                                    >
                                        Hybrid
                                    </button>
                                    <button 
                                        onClick={() => setFestivalActs(prev => prev.map(a => a.id === act.id ? { ...a, isNoRf: true, isOwnRf: false, useHouseSystem: false, isHybrid: false } : a))}
                                        className={`px-3 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest border transition-all ${act.isNoRf ? 'bg-slate-600 border-slate-400 text-white shadow-[0_0_15px_rgba(71,85,105,0.3)]' : 'bg-slate-800 border-white/5 text-slate-500 hover:border-white/20'}`}
                                    >
                                        No RF
                                    </button>
                                </div>
                                </div>
                                <div className="flex gap-3 items-center">
                                    <button 
                                        onClick={() => handleWwbExportAct(act, 'mic')}
                                        className="flex items-center gap-1.5 text-[9px] px-3 py-1 rounded font-black uppercase tracking-widest transition-all bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500 hover:text-white border border-indigo-500/30 whitespace-nowrap"
                                        title={`Export Mic Frequencies to WWB for ${act.actName}`}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                        Export Mics
                                    </button>
                                    <button 
                                        onClick={() => handleWwbExportAct(act, 'iem')}
                                        className="flex items-center gap-1.5 text-[9px] px-3 py-1 rounded font-black uppercase tracking-widest transition-all bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500 hover:text-white border border-emerald-500/30 whitespace-nowrap"
                                        title={`Export IEM Frequencies to WWB for ${act.actName}`}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                        Export IEMs
                                    </button>
                                    <button 
                                        onClick={() => {
                                            if (confirm("Are you sure you want to clear all coordinated frequencies for this act?")) {
                                                setFestivalActs(prev => prev.map(a => a.id === act.id ? { ...a, frequencies: [] } : a));
                                            }
                                        }}
                                        className="text-[9px] px-2 py-0.5 rounded font-bold transition-all border bg-slate-800 text-slate-400 border-slate-700 hover:bg-red-900/40 hover:text-red-400 hover:border-red-500/30"
                                    >
                                        Clear Frequencies
                                    </button>
                                    <button onClick={() => toggleActCollapse(act.id, true)} className="text-[10px] bg-slate-800 text-slate-400 border border-slate-700 px-3 py-1.5 rounded hover:bg-slate-700 transition-all font-black uppercase tracking-widest">Collapse</button>
                                    <button onClick={() => setFestivalActs(prev => prev.filter(a => a.id !== act.id))} className="text-red-400 font-bold text-base font-medium leading-none hover:text-red-300 transition-colors">&times;</button>
                                </div>
                            </div>

                            {activeWmasNodes.length > 0 && (
                                <div className="mb-6 space-y-4">
                                    <div className="flex items-center gap-2 mb-1 px-1">
                                        <div className="w-1 h-3 bg-indigo-500 rounded-full" />
                                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Allocated WMAS Infrastructure</span>
                                    </div>
                                    {activeWmasNodes.map(node => {
                                        const profile = WMAS_PRESET_PROFILES.find(p => p.id === node.profileId);
                                        const maxLinks = profile?.maxLinks?.[node.mode] || '?';
                                        return (
                                            <div key={node.id} className="relative overflow-hidden flex flex-col gap-1 p-2 bg-gradient-to-br from-slate-900 via-indigo-950/30 to-slate-900 border border-indigo-500/30 rounded-md shadow-2xl ring-1 ring-white/5">
                                                {/* Background Accent */}
                                                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl -mr-16 -mt-16 pointer-events-none" />
                                                
                                                <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-2">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-3 h-3 rounded-full bg-indigo-400 animate-pulse shadow-[0_0_12px_rgba(129,140,248,0.8)]" />
                                                        <div className="flex flex-col">
                                                            <span className="text-[13px] font-black text-white uppercase tracking-wider leading-none">
                                                                {node.isHouseSystem !== false ? 'Global System:' : 'Act WMAS:'} {node.name}
                                                            </span>
                                                            <span className="text-[8px] font-bold text-indigo-400/70 uppercase tracking-widest mt-1">
                                                                {node.mode === 'low-latency' ? 'Low Latency (IEM/Mic)' : 'Standard High Density'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-[10px] font-black text-indigo-300 px-2.5 py-1 bg-indigo-500/20 rounded-sm border border-indigo-500/30 uppercase tracking-widest shadow-sm border border-slate-700/50">
                                                            Broadband Slot
                                                        </span>
                                                    </div>
                                                </div>
                                                
                                                <div className="grid grid-cols-2 gap-4 py-2 px-1">
                                                    <div className="flex flex-col gap-1.5">
                                                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em]">TV RF Channel</span>
                                                        <div className="flex items-baseline gap-1">
                                                            <span className="text-[18px] font-black text-indigo-200 font-mono leading-none">
                                                                {node.assignedBlock?.tvChannel ? `CH ${node.assignedBlock.tvChannel}` : 'S-BAND'}
                                                            </span>
                                                            <span className="text-[10px] font-bold text-slate-400 font-mono uppercase">/ {tvRegion === 'uk' ? 'UK' : 'US'} Grid</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col gap-1.5">
                                                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em]">Operating Frequency Range</span>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[14px] font-black text-emerald-400 font-mono tabular-nums">
                                                                {(node.assignedBlock?.start || 0).toFixed(2)}
                                                            </span>
                                                            <div className="h-[2px] w-4 bg-slate-700" />
                                                            <span className="text-[14px] font-black text-emerald-400 font-mono tabular-nums">
                                                                {(node.assignedBlock?.end || 0).toFixed(2)}
                                                            </span>
                                                            <span className="text-[10px] font-black text-slate-500 ml-1">MHz</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                {profile && (
                                                    <div className="mt-3 flex items-center justify-between p-2 bg-black/40 rounded-md border border-white/5 text-[9px] font-bold text-slate-300 uppercase tracking-tight">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-indigo-400">PROFILE:</span>
                                                            <span className="text-white">{profile.name}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-indigo-400">MAX LINKS:</span>
                                                            <span className="px-2 py-0.5 bg-indigo-500/20 rounded border border-indigo-500/20 text-indigo-200">{maxLinks} Simultaneous</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            <div className="bg-black/40 border border-white/5 rounded-md p-3 mb-6 grid grid-cols-1 md:grid-cols-4 gap-2">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Assigned Stage</label>
                                    <select 
                                        value={act.stage} 
                                        onChange={e => setFestivalActs(prev => prev.map(a => a.id === act.id ? { ...a, stage: e.target.value } : a))}
                                        className="bg-slate-900 border border-slate-700 rounded p-1.5 text-[10px] text-indigo-300 font-black uppercase tracking-tighter"
                                    >
                                        {zoneConfigs.map(z => <option key={z.name} value={z.name}>{z.name}</option>)}
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Start Time</label>
                                    <input 
                                        type="datetime-local" 
                                        value={toDatetimeLocal(act.startTime)}
                                        onChange={e => setFestivalActs(prev => prev.map(a => a.id === act.id ? { ...a, startTime: new Date(e.target.value) } : a))}
                                        className="bg-slate-900 border border-slate-700 rounded p-1.5 text-[10px] text-white font-mono"
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Finish Time</label>
                                    <input 
                                        type="datetime-local" 
                                        value={toDatetimeLocal(act.endTime)}
                                        onChange={e => setFestivalActs(prev => prev.map(a => a.id === act.id ? { ...a, endTime: new Date(e.target.value) } : a))}
                                        className="bg-slate-900 border border-slate-700 rounded p-1.5 text-[10px] text-white font-mono"
                                    />
                                </div>
                                <div className="flex flex-col gap-1 col-span-2">
                                    <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">House RF Policy</label>
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                                        <button 
                                            onClick={() => setFestivalActs(prev => prev.map(a => a.id === act.id ? { ...a, muteHouseFrequencies: !a.muteHouseFrequencies } : a))}
                                            className={`py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all border ${act.muteHouseFrequencies ? 'bg-red-900/40 border-red-500/50 text-red-400 font-black' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                                            title="Temporarily disables all House RF for this stage during this act"
                                        >
                                            {act.muteHouseFrequencies ? 'ALL MUTED' : 'MUTE ALL'}
                                        </button>
                                        <button 
                                            onClick={() => setFestivalActs(prev => prev.map(a => a.id === act.id ? { ...a, muteHouseMics: !a.muteHouseMics } : a))}
                                            disabled={act.muteHouseFrequencies}
                                            className={`py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all border ${act.muteHouseFrequencies ? 'opacity-50 cursor-not-allowed bg-slate-900 border-slate-800 text-slate-600' : act.muteHouseMics ? 'bg-orange-900/40 border-orange-500/50 text-orange-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                                        >
                                            {act.muteHouseMics ? 'MICS MUTED' : 'MUTE MICS'}
                                        </button>
                                        <button 
                                            onClick={() => setFestivalActs(prev => prev.map(a => a.id === act.id ? { ...a, muteHouseIems: !a.muteHouseIems } : a))}
                                            disabled={act.muteHouseFrequencies}
                                            className={`py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all border ${act.muteHouseFrequencies ? 'opacity-50 cursor-not-allowed bg-slate-900 border-slate-800 text-slate-600' : act.muteHouseIems ? 'bg-orange-900/40 border-orange-500/50 text-orange-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                                        >
                                            {act.muteHouseIems ? 'IEMS MUTED' : 'MUTE IEMS'}
                                        </button>
                                    </div>
                                    {(!act.muteHouseFrequencies && (!act.muteHouseMics || !act.muteHouseIems)) && (
                                        <div className="flex gap-2 mt-2 bg-slate-900/50 p-2 rounded border border-slate-800">
                                            {!act.muteHouseIems && (
                                                <label className="flex items-center gap-2 cursor-pointer group">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={act.houseIemsImdWithActMics === true} 
                                                        onChange={e => setFestivalActs(prev => prev.map(a => a.id === act.id ? { ...a, houseIemsImdWithActMics: e.target.checked } : a))}
                                                        className="w-3 h-3 rounded bg-slate-900 border-slate-700 text-purple-500 focus:ring-purple-500/50 focus:ring-offset-slate-900" 
                                                    />
                                                    <span className="text-[9px] text-slate-400 group-hover:text-slate-300 font-medium">House IEMs IMD-Free w/ Act Mics</span>
                                                </label>
                                            )}
                                            {!act.muteHouseMics && (
                                                <label className="flex items-center gap-2 cursor-pointer group">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={act.houseMicsImdWithActIems === true} 
                                                        onChange={e => setFestivalActs(prev => prev.map(a => a.id === act.id ? { ...a, houseMicsImdWithActIems: e.target.checked } : a))}
                                                        className="w-3 h-3 rounded bg-slate-900 border-slate-700 text-purple-500 focus:ring-purple-500/50 focus:ring-offset-slate-900" 
                                                    />
                                                    <span className="text-[9px] text-slate-400 group-hover:text-slate-300 font-medium">House Mics IMD-Free w/ Act IEMs</span>
                                                </label>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {(act.muteHouseFrequencies || act.muteHouseMics || act.muteHouseIems) && (() => {
                                const actStageClean = (act.stage || '').toLowerCase().trim();
                                const stageHouseSys = houseSystems.find(s => (s.stageName || '').toLowerCase().trim() === actStageClean);
                                const stageWmasNodes = wmasState?.nodes.filter(n => n.isHouseSystem !== false && (n.stage || '').toLowerCase().trim() === actStageClean) || [];
                                
                                const mutedTypes = new Set<string>();
                                if (act.muteHouseFrequencies) { mutedTypes.add('mic'); mutedTypes.add('iem'); }
                                else {
                                    if (act.muteHouseMics) mutedTypes.add('mic');
                                    if (act.muteHouseIems) mutedTypes.add('iem');
                                }

                                const mutedFreqs = stageHouseSys?.frequencies?.filter(f => mutedTypes.has(f.type)) || [];
                                const mutedWmas = (act.muteHouseFrequencies || (act.muteHouseMics && act.muteHouseIems)) ? stageWmasNodes : []; // WMAS doesn't distinguish mic/iem at the node level yet

                                if (mutedFreqs.length === 0 && mutedWmas.length === 0) return null;

                                return (
                                <div className="mb-4 p-3 bg-red-950/20 border border-red-500/20 rounded-md">
                                    <div className="flex justify-between items-center mb-2">
                                        <h5 className="text-[9px] font-black text-red-400 uppercase tracking-widest flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
                                            Stage House RF Offline
                                        </h5>
                                        <span className="text-[8px] text-slate-500 font-bold uppercase">Target: {act.stage}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {mutedFreqs.map(f => (
                                            <div key={f.id} className="px-2 py-1 bg-slate-950 border border-red-500/30 rounded text-[9px] font-mono text-red-300/70 line-through decoration-red-500/50">
                                                {f.value.toFixed(3)} <span className="opacity-40 ml-1">({f.type})</span>
                                            </div>
                                        ))}
                                        {mutedWmas.map(n => (
                                            <div key={n.id} className="px-2 py-1 bg-slate-950 border border-purple-500/30 rounded text-[9px] font-mono text-purple-300/70 line-through decoration-purple-500/50 flex flex-col">
                                                <span>WMAS Block ({n.name})</span>
                                                <span className="text-[7px] opacity-70">
                                                    {n.assignedBlock?.tvChannel ? `CH ${n.assignedBlock.tvChannel}` : '??'} • {(n.assignedBlock?.start || 0).toFixed(2)}-{(n.assignedBlock?.end || 0).toFixed(2)} MHz
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                );
                            })()}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="p-3 bg-emerald-500/5 rounded-md border border-emerald-500/20">
                                    <RequestManager 
                                        title="Wireless Microphones" type="mic" requests={act.micRequests} equipmentOptionsNode={micEquipmentOptions}
                                         
                                        onUpdate={(reqs) => setFestivalActs(prev => prev.map(a => a.id === act.id ? { ...a, micRequests: reqs } : a))} 
                                        db={fullEquipmentDatabase} overrides={equipmentOverrides} 
                                        foundCount={act.frequencies?.filter(f => f.type === 'mic' || f.type === 'generic' || !f.type).length || 0} 
                                        frequencies={act.frequencies?.filter(f => f.type === 'mic' || f.type === 'generic' || !f.type)}
                                        onFreqAction={(id, action, v) => handleFreqAction(act.id, id, action as any, v)}
                                        
                                        
                                    />
                                    
                                    {micWmas.length > 0 && (
                                        <div className="mb-3 space-y-2">
                                            <div className="flex items-center gap-1.5 px-1 mb-1">
                                                <div className="w-1 h-1 rounded-full bg-emerald-500" />
                                                <span className="text-[8px] font-black text-emerald-500/70 uppercase tracking-tighter italic">Broadband Details</span>
                                            </div>
                                            {micWmas.map(node => (
                                                <div key={node.id} className="flex flex-col p-2 bg-emerald-500/5 border border-emerald-500/20 rounded-md shadow-inner">
                                                    <div className="flex items-center justify-between mb-1 opacity-70">
                                                        <div className="flex items-center gap-1.5">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                                            <span className="text-[9px] font-black text-white uppercase tracking-wider">{node.name}</span>
                                                        </div>
                                                        <span className="text-[7px] font-black text-emerald-500/60 uppercase">WMAS MIC</span>
                                                    </div>
                                                    <div className="flex justify-between items-center bg-black/40 rounded px-1.5 py-1.5">
                                                        <div className="flex flex-col">
                                                            <span className="text-[7px] font-bold text-slate-500 uppercase tracking-tighter">TV CH</span>
                                                            <span className="text-[10px] font-black text-emerald-200/80 font-mono leading-none">
                                                                {node.assignedBlock?.tvChannel ? `CH ${node.assignedBlock.tvChannel}` : 'S-BAND'}
                                                            </span>
                                                        </div>
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-[7px] font-bold text-slate-500 uppercase tracking-tighter">RANGE</span>
                                                            <span className="text-[10px] font-black text-emerald-300 font-mono leading-none">
                                                                {node.assignedBlock ? `${node.assignedBlock.start.toFixed(2)}-${node.assignedBlock.end.toFixed(2)} MHz` : 'Unassigned'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <FrequencyGrid 
                                        frequencies={act.frequencies?.filter(f => (f.type === 'mic' || f.type === 'generic' || !f.type) && !act.micRequests?.some(r => r.id === f.sourceRequestId))} 
                                        onToggleLock={id => handleFreqAction(act.id, id, 'lock')} 
                                        onRemove={id => handleFreqAction(act.id, id, 'remove')} 
                                        onValueChange={(id, v) => handleFreqAction(act.id, id, 'value', v)} 
                                        onLabelChange={(id, v) => handleFreqAction(act.id, id, 'label', v)} 
                                        onTypeChange={(id, v) => handleFreqAction(act.id, id, 'type', v)} 
                                        onLockAll={(lock) => setFestivalActs(prev => prev.map(a => a.id === act.id ? { ...a, frequencies: a.frequencies?.map(f => (f.type === 'mic' || f.type === 'generic' || !f.type) && !act.micRequests?.some(r => r.id === f.sourceRequestId) ? { ...f, locked: lock } : f) } : a))}
                                        onAddFrequency={() => handleAddManualFreq(act.id, 'mic', 'acts')}
                                    />
                                </div>
                                <div className="p-3 bg-rose-500/5 rounded-md border border-rose-500/20">
                                    <RequestManager 
                                        title="In Ear Monitors" type="iem" requests={act.iemRequests} equipmentOptionsNode={iemEquipmentOptions}
                                         
                                        onUpdate={(reqs) => setFestivalActs(prev => prev.map(a => a.id === act.id ? { ...a, iemRequests: reqs } : a))} 
                                        db={fullEquipmentDatabase} overrides={equipmentOverrides} 
                                        foundCount={act.frequencies?.filter(f => f.type === 'iem').length || 0} 
                                        frequencies={act.frequencies?.filter(f => f.type === 'iem')}
                                        onFreqAction={(id, action, v) => handleFreqAction(act.id, id, action as any, v)}
                                        
                                        
                                    />
                                    
                                    {iemWmas.length > 0 && (
                                        <div className="mb-3 space-y-2">
                                            <div className="flex items-center gap-1.5 px-1 mb-1">
                                                <div className="w-1 h-1 rounded-full bg-rose-500" />
                                                <span className="text-[8px] font-black text-rose-500/70 uppercase tracking-tighter italic">Broadband Details</span>
                                            </div>
                                            {iemWmas.map(node => (
                                                <div key={node.id} className="flex flex-col p-2 bg-rose-500/5 border border-rose-500/20 rounded-md shadow-inner">
                                                    <div className="flex items-center justify-between mb-1 opacity-70">
                                                        <div className="flex items-center gap-1.5">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                                                            <span className="text-[9px] font-black text-white uppercase tracking-wider">{node.name}</span>
                                                        </div>
                                                        <span className="text-[7px] font-black text-rose-500/60 uppercase">WMAS IEM</span>
                                                    </div>
                                                    <div className="flex justify-between items-center bg-black/40 rounded px-1.5 py-1.5">
                                                        <div className="flex flex-col">
                                                            <span className="text-[7px] font-bold text-slate-500 uppercase tracking-tighter">TV CH</span>
                                                            <span className="text-[10px] font-black text-rose-200/80 font-mono leading-none">
                                                                {node.assignedBlock?.tvChannel ? `CH ${node.assignedBlock.tvChannel}` : 'S-BAND'}
                                                            </span>
                                                        </div>
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-[7px] font-bold text-slate-500 uppercase tracking-tighter">RANGE</span>
                                                            <span className="text-[10px] font-black text-rose-300 font-mono leading-none">
                                                                {node.assignedBlock ? `${node.assignedBlock.start.toFixed(2)}-${node.assignedBlock.end.toFixed(2)} MHz` : 'Unassigned'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <FrequencyGrid 
                                        frequencies={act.frequencies?.filter(f => f.type === 'iem' && !act.iemRequests?.some(r => r.id === f.sourceRequestId))} 
                                        onToggleLock={id => handleFreqAction(act.id, id, 'lock')} 
                                        onRemove={id => handleFreqAction(act.id, id, 'remove')} 
                                        onValueChange={(id, v) => handleFreqAction(act.id, id, 'value', v)} 
                                        onLabelChange={(id, v) => handleFreqAction(act.id, id, 'label', v)} 
                                        onTypeChange={(id, v) => handleFreqAction(act.id, id, 'type', v)} 
                                        onLockAll={(lock) => setFestivalActs(prev => prev.map(a => a.id === act.id ? { ...a, frequencies: a.frequencies?.map(f => f.type === 'iem' && !act.iemRequests?.some(r => r.id === f.sourceRequestId) ? { ...f, locked: lock } : f) } : a))}
                                        onAddFrequency={() => handleAddManualFreq(act.id, 'iem', 'acts')}
                                    />
                                </div>
                            </div>
                            </>
                            )}
                        </Card>
                        );
                    })}
                </div>
            )}

            {activeSubTab === 'act-matrix' && (
                <div className="space-y-4 animate-in fade-in duration-500 relative z-0">
                    <Card className="!p-2 !bg-slate-900/80">
                        <div className="flex items-center gap-2 mb-4">
                            <h4 className="font-bold text-fuchsia-400 border-b border-white/5 pb-1 uppercase text-xs tracking-widest flex-1">
                                Act Strict IMD Matrix
                            </h4>
                        </div>
                        <p className="text-xs text-slate-400 mb-6 max-w-3xl leading-relaxed">
                            Use this matrix to force strict Intermodulation (IMD) separation between specific acts, regardless of their scheduled times. 
                            This is critical for scenarios where a headline act might leave their equipment powered on while a support act is performing on the same stage, 
                            which could cause interference if their frequencies are only space-separated instead of intermod-free.
                        </p>
                        <div className="overflow-x-auto border border-slate-700/50 rounded-md bg-slate-950/50 max-h-[70vh]">
                            <table className="w-full text-xs text-left border-collapse">
                                <thead className="bg-slate-800 text-slate-300">
                                    <tr>
                                        <th className="p-3 border-b border-r border-slate-700 min-w-[200px] font-bold whitespace-nowrap bg-slate-800 sticky left-0 z-20">Act / Act</th>
                                        {festivalActs.map(act => (
                                            <th key={act.id} className="p-3 border-b border-slate-700 text-center font-medium min-w-[120px] max-w-[150px] sticky top-0 bg-slate-800 z-10" title={act.actName}>
                                                <div className="truncate">{act.actName || 'Unnamed Act'}</div>
                                                <div className="text-[9px] text-fuchsia-400/70 font-normal truncate">{act.stage}</div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {festivalActs.map((actA, rowIndex) => (
                                        <tr key={actA.id} className="border-b border-slate-800/50 hover:bg-white/5 transition-colors group">
                                            <td className="p-3 border-r border-slate-700/50 bg-slate-900 group-hover:bg-slate-800 sticky left-0 z-10">
                                                <div className="font-medium text-white truncate max-w-[180px]" title={actA.actName}>{actA.actName || 'Unnamed Act'}</div>
                                                <div className="text-[9px] text-slate-500 font-normal truncate">{actA.stage}</div>
                                            </td>
                                            {festivalActs.map((actB, colIndex) => {
                                                if (rowIndex === colIndex) {
                                                    return <td key={`cell-${actA.id}-${actB.id}`} className="p-3 border border-slate-800/30 text-center text-slate-600 bg-slate-900/30">―</td>;
                                                }
                                                const val = festivalState.actIntermodMatrix?.[actA.id]?.[actB.id] || festivalState.actIntermodMatrix?.[actB.id]?.[actA.id] || false;
                                                return (
                                                    <td key={`cell-${actA.id}-${actB.id}`} className="p-3 border border-slate-800/30 text-center hover:bg-fuchsia-500/10 transition-colors">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={val} 
                                                            onChange={e => {
                                                                const checked = e.target.checked;
                                                                const matrix = festivalState.actIntermodMatrix || {};
                                                                setFestivalState(prev => ({
                                                                    ...prev,
                                                                    actIntermodMatrix: {
                                                                        ...matrix,
                                                                        [actA.id]: {
                                                                            ...(matrix[actA.id] || {}),
                                                                            [actB.id]: checked
                                                                        },
                                                                        [actB.id]: {
                                                                            ...(matrix[actB.id] || {}),
                                                                            [actA.id]: checked
                                                                        }
                                                                    }
                                                                }));
                                                            }}
                                                            className="w-4 h-4 accent-fuchsia-500 rounded bg-slate-900 border-slate-700 cursor-pointer"
                                                        />
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            )}

            {activeSubTab === 'constant' && (
                <div className="space-y-4 animate-in fade-in duration-500 relative z-0">
                    {constantSystems.map((sys, idx) => (
                        <Card key={`constant-${sys.stageName}-${idx}`} className="!p-2 !bg-slate-900/80">
                            <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-1">
                                <h4 className="font-bold text-indigo-400 uppercase text-xs tracking-widest">{sys.stageName} - Static Gear</h4>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => handleWwbExportSystem(sys, 'Constant', 'mic')}
                                        className="flex items-center gap-1.5 text-[9px] px-2 py-0.5 rounded font-black uppercase tracking-widest transition-all bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500 hover:text-white border border-indigo-500/30 whitespace-nowrap"
                                        title={`Export Constant Mic Frequencies to WWB for ${sys.stageName}`}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                        WWB Mics
                                    </button>
                                    <button 
                                        onClick={() => handleWwbExportSystem(sys, 'Constant', 'iem')}
                                        className="flex items-center gap-1.5 text-[9px] px-2 py-0.5 rounded font-black uppercase tracking-widest transition-all bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500 hover:text-white border border-emerald-500/30 whitespace-nowrap"
                                        title={`Export Constant IEM Frequencies to WWB for ${sys.stageName}`}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                        WWB IEMs
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="p-3 bg-emerald-500/5 rounded-md border border-emerald-500/20">
                                    <RequestManager 
                                        title="Constant Tx Microphones" type="mic" requests={sys.micRequests} equipmentOptionsNode={micEquipmentOptions}
                                         
                                        onUpdate={(reqs) => setConstantSystems(prev => prev.map((s, i) => i === idx ? { ...s, micRequests: reqs } : s))} 
                                        db={fullEquipmentDatabase} overrides={equipmentOverrides} 
                                        foundCount={sys.frequencies?.filter(f => f.type === 'mic' || f.type === 'generic' || !f.type).length || 0} 
                                        frequencies={sys.frequencies?.filter(f => f.type === 'mic' || f.type === 'generic' || !f.type)}
                                        onFreqAction={(id, act, v) => setConstantSystems(prev => prev.map((s, i) => i === idx ? { ...s, frequencies: (s.frequencies || []).map(f => f.id === id || (act === 'lockGroup' && f.sourceRequestId === id) ? { ...f, ...(act === 'lockGroup' || act === 'lock' ? { locked: v ?? !f.locked } : act === 'value' ? { value: parseFloat(v) || 0 } : act === 'label' ? { label: v } : act === 'type' ? { type: v } : {}) } : f).filter(f => act === 'remove' ? f.id !== id : true) } : s))}
                                    />
                                    <FrequencyGrid 
                                        frequencies={sys.frequencies?.filter(f => (f.type === 'mic' || f.type === 'generic' || !f.type) && !sys.micRequests?.some(r => r.id === f.sourceRequestId))} 
                                        onToggleLock={id => setConstantSystems(prev => prev.map((s, i) => i === idx ? { ...s, frequencies: s.frequencies?.map(f => f.id === id ? { ...f, locked: !f.locked } : f) } : s))}
                                        onRemove={id => setConstantSystems(prev => prev.map((s, i) => i === idx ? { ...s, frequencies: s.frequencies?.filter(f => f.id !== id) } : s))}
                                        onValueChange={(id, v) => setConstantSystems(prev => prev.map((s, i) => i === idx ? { ...s, frequencies: s.frequencies?.map(f => f.id === id ? { ...f, value: parseFloat(v) || 0 } : f) } : s))}
                                        onLabelChange={(id, v) => setConstantSystems(prev => prev.map((s, i) => i === idx ? { ...s, frequencies: s.frequencies?.map(f => f.id === id ? { ...f, label: v } : f) } : s))}
                                        onTypeChange={(id, v) => setConstantSystems(prev => prev.map((s, i) => i === idx ? { ...s, frequencies: s.frequencies?.map(f => f.id === id ? { ...f, type: v } : f) } : s))}
                                        onLockAll={(lock) => setConstantSystems(prev => prev.map((s, i) => i === idx ? { ...s, frequencies: s.frequencies?.map(f => (f.type === 'mic' || f.type === 'generic' || !f.type) ? { ...f, locked: lock } : f) } : s))}
                                        onAddFrequency={() => handleAddManualFreq(`const-${idx}`, 'mic', 'constant')}
                                    />
                                </div>
                                <div className="p-3 bg-rose-500/5 rounded-md border border-rose-500/20">
                                    <RequestManager 
                                        title="Constant Tx IEMs" type="iem" requests={sys.iemRequests} equipmentOptionsNode={iemEquipmentOptions}
                                         
                                        onUpdate={(reqs) => setConstantSystems(prev => prev.map((s, i) => i === idx ? { ...s, iemRequests: reqs } : s))} 
                                        db={fullEquipmentDatabase} overrides={equipmentOverrides} 
                                        foundCount={sys.frequencies?.filter(f => f.type === 'iem').length || 0} 
                                        frequencies={sys.frequencies?.filter(f => f.type === 'iem')}
                                        onFreqAction={(id, act, v) => setConstantSystems(prev => prev.map((s, i) => i === idx ? { ...s, frequencies: (s.frequencies || []).map(f => f.id === id || (act === 'lockGroup' && f.sourceRequestId === id) ? { ...f, ...(act === 'lockGroup' || act === 'lock' ? { locked: v ?? !f.locked } : act === 'value' ? { value: parseFloat(v) || 0 } : act === 'label' ? { label: v } : act === 'type' ? { type: v } : {}) } : f).filter(f => act === 'remove' ? f.id !== id : true) } : s))}
                                    />
                                    <FrequencyGrid 
                                        frequencies={sys.frequencies?.filter(f => f.type === 'iem' && !sys.iemRequests?.some(r => r.id === f.sourceRequestId))} 
                                        onToggleLock={id => setConstantSystems(prev => prev.map((s, i) => i === idx ? { ...s, frequencies: s.frequencies?.map(f => f.id === id ? { ...f, locked: !f.locked } : f) } : s))}
                                        onRemove={id => setConstantSystems(prev => prev.map((s, i) => i === idx ? { ...s, frequencies: s.frequencies?.filter(f => f.id !== id) } : s))}
                                        onValueChange={(id, v) => setConstantSystems(prev => prev.map((s, i) => i === idx ? { ...s, frequencies: s.frequencies?.map(f => f.id === id ? { ...f, value: parseFloat(v) || 0 } : f) } : s))}
                                        onLabelChange={(id, v) => setConstantSystems(prev => prev.map((s, i) => i === idx ? { ...s, frequencies: s.frequencies?.map(f => f.id === id ? { ...f, label: v } : f) } : s))}
                                        onTypeChange={(id, v) => setConstantSystems(prev => prev.map((s, i) => i === idx ? { ...s, frequencies: s.frequencies?.map(f => f.id === id ? { ...f, type: v } : f) } : s))}
                                        onLockAll={(lock) => setConstantSystems(prev => prev.map((s, i) => i === idx ? { ...s, frequencies: s.frequencies?.map(f => f.type === 'iem' ? { ...f, locked: lock } : f) } : s))}
                                        onAddFrequency={() => handleAddManualFreq(`const-${idx}`, 'iem', 'constant')}
                                    />
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {activeSubTab === 'house' && (
                <div className="space-y-4 animate-in fade-in duration-500 relative z-0">
                    {houseSystems.map((sys, idx) => (
                        <Card key={`house-${sys.stageName}-${idx}`} className="!p-2 !bg-slate-900/80">
                            <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-1">
                                <h4 className="font-bold text-yellow-400 uppercase text-xs tracking-widest">{sys.stageName} - House Gear</h4>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => handleWwbExportSystem(sys, 'House', 'mic')}
                                        className="flex items-center gap-1.5 text-[9px] px-2 py-0.5 rounded font-black uppercase tracking-widest transition-all bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500 hover:text-white border border-indigo-500/30 whitespace-nowrap"
                                        title={`Export House Mic Frequencies to WWB for ${sys.stageName}`}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                        WWB Mics
                                    </button>
                                    <button 
                                        onClick={() => handleWwbExportSystem(sys, 'House', 'iem')}
                                        className="flex items-center gap-1.5 text-[9px] px-2 py-0.5 rounded font-black uppercase tracking-widest transition-all bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500 hover:text-white border border-emerald-500/30 whitespace-nowrap"
                                        title={`Export House IEM Frequencies to WWB for ${sys.stageName}`}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                        WWB IEMs
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="p-3 bg-emerald-500/5 rounded-md border border-emerald-500/20">
                                    <RequestManager 
                                        title="House Microphones" type="mic" requests={sys.micRequests} equipmentOptionsNode={micEquipmentOptions}
                                         
                                        onUpdate={(reqs) => setHouseSystems(prev => prev.map((s, i) => i === idx ? { ...s, micRequests: reqs } : s))} 
                                        db={fullEquipmentDatabase} overrides={equipmentOverrides} 
                                        foundCount={sys.frequencies?.filter(f => f.type === 'mic' || f.type === 'generic' || !f.type).length || 0}
                                        frequencies={sys.frequencies?.filter(f => f.type === 'mic' || f.type === 'generic' || !f.type)}
                                        onFreqAction={(id, act, v) => setHouseSystems(prev => prev.map((s, i) => i === idx ? { ...s, frequencies: (s.frequencies || []).map(f => f.id === id || (act === 'lockGroup' && f.sourceRequestId === id) ? { ...f, ...(act === 'lockGroup' || act === 'lock' ? { locked: v ?? !f.locked } : act === 'value' ? { value: parseFloat(v) || 0 } : act === 'label' ? { label: v } : act === 'type' ? { type: v } : {}) } : f).filter(f => act === 'remove' ? f.id !== id : true) } : s))}
                                    />
                                    <FrequencyGrid 
                                        frequencies={sys.frequencies?.filter(f => (f.type === 'mic' || f.type === 'generic' || !f.type) && !sys.micRequests?.some(r => r.id === f.sourceRequestId))} 
                                        onToggleLock={id => setHouseSystems(prev => prev.map((s, i) => i === idx ? { ...s, frequencies: s.frequencies?.map(f => f.id === id ? { ...f, locked: !f.locked } : f) } : s))}
                                        onRemove={id => setHouseSystems(prev => prev.map((s, i) => i === idx ? { ...s, frequencies: s.frequencies?.filter(f => f.id !== id) } : s))}
                                        onValueChange={(id, v) => setHouseSystems(prev => prev.map((s, i) => i === idx ? { ...s, frequencies: s.frequencies?.map(f => f.id === id ? { ...f, value: parseFloat(v) || 0 } : f) } : s))}
                                        onLabelChange={(id, v) => setHouseSystems(prev => prev.map((s, i) => i === idx ? { ...s, frequencies: s.frequencies?.map(f => f.id === id ? { ...f, label: v } : f) } : s))}
                                        onTypeChange={(id, v) => setHouseSystems(prev => prev.map((s, i) => i === idx ? { ...s, frequencies: s.frequencies?.map(f => f.id === id ? { ...f, type: v } : f) } : s))}
                                        onLockAll={(lock) => setHouseSystems(prev => prev.map((s, i) => i === idx ? { ...s, frequencies: s.frequencies?.map(f => (f.type === 'mic' || f.type === 'generic' || !f.type) ? { ...f, locked: lock } : f) } : s))}
                                        onAddFrequency={() => handleAddManualFreq(`house-${idx}`, 'mic', 'house')}
                                    />
                                </div>
                                <div className="p-3 bg-rose-500/5 rounded-md border border-rose-500/20">
                                    <RequestManager 
                                        title="House IEMs" type="iem" requests={sys.iemRequests} equipmentOptionsNode={iemEquipmentOptions}
                                         
                                        onUpdate={(reqs) => setHouseSystems(prev => prev.map((s, i) => i === idx ? { ...s, iemRequests: reqs } : s))} 
                                        db={fullEquipmentDatabase} overrides={equipmentOverrides} 
                                        foundCount={sys.frequencies?.filter(f => f.type === 'iem').length || 0}
                                        frequencies={sys.frequencies?.filter(f => f.type === 'iem')}
                                        onFreqAction={(id, act, v) => setHouseSystems(prev => prev.map((s, i) => i === idx ? { ...s, frequencies: (s.frequencies || []).map(f => f.id === id || (act === 'lockGroup' && f.sourceRequestId === id) ? { ...f, ...(act === 'lockGroup' || act === 'lock' ? { locked: v ?? !f.locked } : act === 'value' ? { value: parseFloat(v) || 0 } : act === 'label' ? { label: v } : act === 'type' ? { type: v } : {}) } : f).filter(f => act === 'remove' ? f.id !== id : true) } : s))}
                                    />
                                    <FrequencyGrid 
                                        frequencies={sys.frequencies?.filter(f => f.type === 'iem' && !sys.iemRequests?.some(r => r.id === f.sourceRequestId))} 
                                        onToggleLock={id => setHouseSystems(prev => prev.map((s, i) => i === idx ? { ...s, frequencies: s.frequencies?.map(f => f.id === id ? { ...f, locked: !f.locked } : f) } : s))}
                                        onRemove={id => setHouseSystems(prev => prev.map((s, i) => i === idx ? { ...s, frequencies: s.frequencies?.filter(f => f.id !== id) } : s))}
                                        onValueChange={(id, v) => setHouseSystems(prev => prev.map((s, i) => i === idx ? { ...s, frequencies: s.frequencies?.map(f => f.id === id ? { ...f, value: parseFloat(v) || 0 } : f) } : s))}
                                        onLabelChange={(id, v) => setHouseSystems(prev => prev.map((s, i) => i === idx ? { ...s, frequencies: s.frequencies?.map(f => f.id === id ? { ...f, label: v } : f) } : s))}
                                        onTypeChange={(id, v) => setHouseSystems(prev => prev.map((s, i) => i === idx ? { ...s, frequencies: s.frequencies?.map(f => f.id === id ? { ...f, type: v } : f) } : s))}
                                        onLockAll={(lock) => setHouseSystems(prev => prev.map((s, i) => i === idx ? { ...s, frequencies: s.frequencies?.map(f => f.type === 'iem' ? { ...f, locked: lock } : f) } : s))}
                                        onAddFrequency={() => handleAddManualFreq(`house-${idx}`, 'iem', 'house')}
                                    />
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {activeSubTab === 'wmas' && (
                <div className="space-y-4">
                    {wmasState && setWmasState ? (
                        <WMASTab
                            state={wmasState}
                            setState={setWmasState}
                            tvChannelStates={tvChannelStates}
                            scanData={scanData}
                            acts={festivalActs}
                        />
                    ) : (
                        <div className="p-8 text-center text-slate-500 font-bold bg-slate-900/50 rounded-md border border-slate-800">
                            WMAS State unavailable.
                        </div>
                    )}
                </div>
            )}

            </div>

            <div className="lg:col-span-12 pt-3 relative z-0">
                <SpectrumVisualizer 
                    frequencies={patchedAnalyzerFrequencies} 
                    scanData={scanData} 
                    title="Unified Site Spectral View" 
                    wmasState={wmasState} 
                    selectedWmasIds={selectedWmasIds}
                    onFrequencyClick={handleFrequencyClick}
                    onFrequencyChange={handleFrequencyChange}
                    onExclusionZoneAdd={handleExclusionZoneAdd}
                    onExclusionZoneRemove={handleExclusionZoneRemove}
                    onExclusionsClear={() => setManualExclusions('')}
                    exclusionsText={manualExclusions}
                    onExclusionsTextChange={setManualExclusions}
                    exclusionZones={parsedExclusions}
                    tvRegion={tvRegion}
                />
                
                <div className="mt-4 bg-slate-900 border border-indigo-500/20 p-2 rounded-md shadow-sm border border-slate-700/50">
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                            <div className="space-y-1">
                                <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center">
                                    Master View Visibility & Diagnostics Filter
                                    <InfoTooltip 
                                        content={
                                            <div className="space-y-2">
                                                <p>This filter controls which frequencies are visible in the Master View spectral plot and defines the scope for the Coordination Diagnostics report below.</p>
                                                <p>Selecting an item isolates its frequencies for visual monitoring and instructs the system to prioritize auditing that specific act or system for potential clashes.</p>
                                                <p><span className="text-indigo-400 font-bold">How to use:</span> Click act names to toggle visibility. Use 'Select All' for a global view or 'Clear All' to reset and focus on specific problem areas.</p>
                                            </div>
                                        }
                                    />
                                </h4>
                                <p className="text-[9px] text-slate-500 uppercase font-bold tracking-tighter">Selected entities determine spectral plot visibility and focused audit logic.</p>
                            </div>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => {
                                        const allIds = new Set<string>([
                                            ...festivalActs.map(a => a.id),
                                            ...constantSystems.map(s => `const-${s.stageName}`),
                                            ...houseSystems.map(s => `house-${s.stageName}`),
                                            ...(wmasState?.nodes?.map(n => `wmas-${n.id}`) || [])
                                        ]);
                                        setDiagSelectedIds(allIds);
                                        setHasAnalyzed(false);
                                    }} 
                                    className="text-[9px] font-black text-slate-300 hover:text-indigo-400 uppercase px-3 py-1.5 bg-slate-800 rounded border border-indigo-500/20 transition-all shadow-sm"
                                >
                                    View All Site
                                </button>
                                <button 
                                    onClick={() => { setDiagSelectedIds(new Set()); setHasAnalyzed(false); }} 
                                    className="text-[9px] font-black text-slate-500 hover:text-rose-400 uppercase px-3 py-1.5 bg-slate-800 rounded border border-white/5 transition-all"
                                >
                                    Hide All / Clear Focus
                                </button>
                                <button onClick={handleAnalyzeDiagnostic} className={`${primaryButton} !py-1.5 !px-3`}>Run Focused Audit</button>
                            </div>
                        </div>
                        
                        <div className="space-y-6">
                            {wmasState && wmasState.nodes && wmasState.nodes.length > 0 && (
                                <div>
                                    <p className="text-[8px] font-black text-purple-500 uppercase mb-2 tracking-widest border-b border-purple-500/20 pb-1">Filter By WMAS Blocks:</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {wmasState.nodes.map((node) => {
                                            const id = `wmas-${node.id}`;
                                            const active = diagSelectedIds.has(id);
                                            return (
                                                <button 
                                                    key={node.id} 
                                                    onClick={() => toggleFilterId(id)}
                                                    className={`px-2 py-1 rounded-md text-[9px] font-black transition-all border ${active ? 'bg-purple-600 border-purple-400 text-white shadow-sm border border-slate-700/50' : 'bg-purple-900/10 border-purple-900/30 text-purple-600 hover:text-purple-400'}`}
                                                >
                                                    {node.name} (WMAS)
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            {constantSystems.length > 0 && (
                                <div>
                                    <p className="text-[8px] font-black text-green-500 uppercase mb-2 tracking-widest border-b border-green-500/20 pb-1">Filter By Constant Transmits:</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {constantSystems.map((sys, idx) => {
                                            const id = `const-${sys.stageName}`;
                                            const active = diagSelectedIds.has(id);
                                            return (
                                                <button 
                                                    key={id} 
                                                    onClick={() => toggleFilterId(id)}
                                                    className={`px-2 py-1 rounded-md text-[9px] font-black transition-all border ${active ? 'bg-green-600 border-green-400 text-white shadow-sm border border-slate-700/50' : 'bg-green-900/10 border-green-900/30 text-green-600 hover:text-green-400'}`}
                                                >
                                                    {sys.stageName} (Static)
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {houseSystems.length > 0 && (
                                <div>
                                    <p className="text-[8px] font-black text-blue-400 uppercase mb-2 tracking-widest border-b border-blue-400/20 pb-1">Filter By House Systems:</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {houseSystems.map((sys, idx) => {
                                            const id = `house-${sys.stageName}`;
                                            const active = diagSelectedIds.has(id);
                                            return (
                                                <div key={id} className="flex items-center gap-1 bg-slate-800/40 p-1 rounded-sm border border-white/5">
                                                    <button 
                                                        onClick={() => toggleFilterId(id)}
                                                        className={`px-2 py-1 rounded-md text-[9px] font-black transition-all border ${active ? 'bg-blue-600 border-blue-400 text-white shadow-sm border border-slate-700/50' : 'bg-blue-900/10 border-blue-900/30 text-blue-600 hover:text-blue-400'}`}
                                                    >
                                                        {sys.stageName}
                                                    </button>
                                                    <div className="flex flex-col gap-1">
                                                        <button 
                                                            onClick={() => runTypeStrictAudit(sys, 'mic')}
                                                            className="px-1.5 py-0.5 bg-slate-900 hover:bg-emerald-600/40 text-emerald-500 hover:text-emerald-200 border border-emerald-500/20 rounded text-[7px] font-black uppercase transition-all flex items-center gap-1"
                                                            title="Audit focused Act IEMs vs this system's House Mics"
                                                        >
                                                            <span className="w-1 h-1 rounded-full bg-emerald-500"></span>
                                                            Check vs House Mics
                                                        </button>
                                                        <button 
                                                            onClick={() => runTypeStrictAudit(sys, 'iem')}
                                                            className="px-1.5 py-0.5 bg-slate-900 hover:bg-rose-600/40 text-rose-500 hover:text-rose-200 border border-rose-500/20 rounded text-[7px] font-black uppercase transition-all flex items-center gap-1"
                                                            title="Audit focused Act Mics vs this system's House IEMs"
                                                        >
                                                            <span className="w-1 h-1 rounded-full bg-rose-500"></span>
                                                            Check vs House IEMs
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {festivalActs.length > 0 && (
                                <div className="space-y-4">
                                    <p className="text-[8px] font-black text-indigo-400 uppercase mb-2 tracking-widest border-b border-indigo-400/20 pb-1">Filter By Performing Acts (By Stage):</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {zoneConfigs.map((zone) => {
                                            const actsOnStage = festivalActs.filter(act => 
                                                (act.stage || '').trim().toLowerCase() === (zone.name || '').trim().toLowerCase()
                                            );
                                            if (actsOnStage.length === 0) return null;
                                            
                                            return (
                                                <div key={zone.name} className="bg-slate-950/40 p-3 rounded-md border border-white/5 space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest">{zone.name}</p>
                                                        <span className="text-[7px] font-black px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">{actsOnStage.length} ACTS</span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {actsOnStage.map(act => {
                                                            const active = diagSelectedIds.has(act.id);
                                                            return (
                                                                <button 
                                                                    key={act.id} 
                                                                    onClick={() => toggleFilterId(act.id)}
                                                                    className={`px-2 py-1 rounded-md text-[9px] font-black transition-all border ${active ? 'bg-indigo-600 border-indigo-400 text-white shadow-sm border border-slate-700/50' : 'bg-indigo-900/10 border-indigo-900/30 text-indigo-400 hover:text-indigo-300'}`}
                                                                >
                                                                    {act.actName}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {/* Handle acts that might not have a matching stage name */}
                                        {(() => {
                                            const validStages = new Set(zoneConfigs.map(z => (z.name || '').trim().toLowerCase()));
                                            const homelessActs = festivalActs.filter(act => !validStages.has((act.stage || '').trim().toLowerCase()));
                                            if (homelessActs.length === 0) return null;
                                            
                                            return (
                                                <div className="bg-rose-950/10 p-3 rounded-md border border-rose-500/10 space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-[7px] font-black text-rose-500 uppercase tracking-widest">Unassigned / Other</p>
                                                        <span className="text-[7px] font-black px-1.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">{homelessActs.length} ACTS</span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {homelessActs.map(act => {
                                                            const active = diagSelectedIds.has(act.id);
                                                            return (
                                                                <button 
                                                                    key={act.id} 
                                                                    onClick={() => toggleFilterId(act.id)}
                                                                    className={`px-2 py-1 rounded-md text-[9px] font-black transition-all border ${active ? 'bg-indigo-600 border-indigo-400 text-white shadow-sm border border-slate-700/50' : 'bg-indigo-900/10 border-indigo-900/30 text-indigo-400 hover:text-indigo-300'}`}
                                                                >
                                                                    {act.actName}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {hasAnalyzed && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-slate-900 border-2 border-indigo-500/40 shadow-[0_40px_120px_rgba(0,0,0,0.8)] rounded-3xl w-full max-w-6xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className={`p-4 border-b border-white/10 flex justify-between items-center ${diagnosticConflicts.length === 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
                            <div className="flex items-center gap-2">
                                <span className="text-xl font-semibold">{diagnosticConflicts.length === 0 ? '✅' : '⚠️'}</span>
                                <div>
                                    <h5 className={`text-base font-medium font-black uppercase tracking-widest ${diagnosticConflicts.length === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {diagnosticConflicts.length === 0 ? 'Site Logic Validated' : 'Site Interaction Ledger'}
                                    </h5>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Diagnostic Audit for Selected Focus</p>
                                </div>
                            </div>
                            <button onClick={() => setHasAnalyzed(false)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-all text-3xl leading-none">&times;</button>
                        </div>

                        <div className="p-4 max-h-[60vh] overflow-auto custom-scrollbar">
                            {diagnosticConflicts.length === 0 ? (
                                <div className="text-center py-20">
                                    <p className="text-base font-medium text-emerald-100 font-medium mb-2">Zero Interactions Detected</p>
                                    <p className="text-sm text-slate-500 uppercase tracking-widest italic">The selected subset of the spectral plan satisfies all active interaction guard criteria.</p>
                                </div>
                            ) : (
                                <div className="rounded-md border border-white/5 overflow-x-auto custom-scrollbar">
                                    <table className="w-full text-left border-collapse text-[11px]">
                                        <thead className="bg-slate-950">
                                            <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/10">
                                                <th className="p-2">Interaction Type</th>
                                                <th className="p-2">Affected Channel (Victim)</th>
                                                <th className="p-2">Source Clashes (Aggressors)</th>
                                                <th className="p-2">Closeness (Delta)</th>
                                                <th className="p-2">Engineering Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {diagnosticConflicts.map((c, idx) => {
                                                const isFundamental = c.type.includes('Fundamental');
                                                const is2Tone = c.type.includes('2-Tone') || c.type.includes('2TX');
                                                const is3Tone = c.type.includes('3-Tone') || c.type.includes('3TX');
                                                const is5Tone = c.type.includes('5th');
                                                const is7Tone = c.type.includes('7th');

                                                let badgeText = 'Mixing Product (IMD)';
                                                let badgeStyle = 'bg-purple-500/10 border-purple-500/20 text-purple-400';
                                                if (isFundamental) {
                                                    badgeText = 'Fundamental Clash';
                                                    badgeStyle = 'bg-rose-500/10 border-rose-500/20 text-rose-400';
                                                } else if (is2Tone && !is5Tone && !is7Tone) {
                                                    badgeText = '2TX 3rd Order IMD';
                                                    badgeStyle = 'bg-red-500/10 border-red-500/20 text-red-400';
                                                } else if (is3Tone) {
                                                    badgeText = '3TX 3rd Order IMD';
                                                    badgeStyle = 'bg-amber-500/10 border-amber-500/20 text-amber-400';
                                                } else if (is5Tone) {
                                                    badgeText = '2TX 5th Order IMD';
                                                    badgeStyle = 'bg-violet-500/10 border-violet-500/20 text-violet-400';
                                                } else if (is7Tone) {
                                                    badgeText = '2TX 7th Order IMD';
                                                    badgeStyle = 'bg-fuchsia-500/10 border-fuchsia-500/20 text-fuchsia-400';
                                                }

                                                const conflictKey = `conflict-${c.targetFreq?.id || idx}-${c.type}-${c.sourceFreqs?.map(s => s.id || s.value).join('-')}-${idx}`;
                                                return (
                                                    <tr key={conflictKey} className="hover:bg-white/5 transition-colors">
                                                        <td className="p-2">
                                                            <span className={`px-2 py-0.5 rounded uppercase text-[9px] font-black border ${badgeStyle}`}>
                                                                {badgeText}
                                                            </span>
                                                            <p className="text-[8px] text-slate-500 mt-1 uppercase font-bold">{c.type}</p>
                                                            {typeof c.product === 'number' && (
                                                                <p className="text-[9px] text-cyan-400 font-mono mt-0.5">Product: {c.product.toFixed(3)} MHz</p>
                                                            )}
                                                        </td>
                                                        <td className="p-2">
                                                            <div className="flex flex-col">
                                                                <span className="text-white font-black text-xs">{c.targetFreq?.label || c.targetFreq?.id || 'Unknown'}</span>
                                                                <span className="text-cyan-400 font-mono text-[10px]">{(c.targetFreq?.value || 0).toFixed(3)} MHz</span>
                                                                {c.sceneName && <span className="text-[9px] text-slate-500 mt-0.5">{c.sceneName}</span>}
                                                            </div>
                                                        </td>
                                                        <td className="p-2">
                                                            <div className="space-y-1.5">
                                                                {(c.sourceFreqs || []).map((sf, sIdx) => (
                                                                    <div key={sf.id || sIdx} className="flex items-center gap-2">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-500/50"></span>
                                                                        <span className="text-slate-200 font-bold">{sf.label || sf.id || 'Unknown'}</span>
                                                                        <span className="text-cyan-400 font-mono text-[9px]">({(sf?.value || 0).toFixed(3)} MHz)</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </td>
                                                        <td className="p-2 font-mono font-black text-rose-400 bg-rose-500/5">
                                                            {c.diff !== undefined ? `${(c.diff * 1000).toFixed(1)} kHz` : 'N/A'}
                                                        </td>
                                                        <td className="p-2">
                                                            <div className="bg-slate-800/50 p-2 rounded border border-white/5 italic text-[10px] text-indigo-300 leading-snug">
                                                                {isFundamental 
                                                                    ? "Direct overlap detected. Frequencies must be spaced further apart or moved to separate stages." 
                                                                    : "Non-linear mixing detected. Shift one of the aggressor frequencies or reduce RF output power."}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        <div className="p-4 bg-slate-950 border-t border-white/10 flex justify-between items-center">
                            <div className="text-[10px] text-slate-600 uppercase font-black tracking-widest">
                                Report Generated: {new Date().toLocaleTimeString()}
                            </div>
                            <button onClick={() => setHasAnalyzed(false)} className={`${primaryButton} !px-8 !py-3`}>Close Ledger</button>
                        </div>
                    </div>
                </div>
            )}

            <PdfPreviewModal 
                isOpen={isPreviewModalOpen}
                onClose={() => setIsPreviewModalOpen(false)}
                generatePdf={generatePdfForPreview}
                filename={`festival_rf_plan_${new Date().toISOString().slice(0, 10)}`}
            />

            <AnimatePresence>
                {isLiveScanOpen && (
                    <div className="fixed inset-0 z-[1000000] flex justify-end bg-slate-950/80 backdrop-blur-md">
                        {/* Backdrop closer */}
                        <div className="absolute inset-0 cursor-pointer" onClick={() => setIsLiveScanOpen(false)} />
                        
                        <motion.div 
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="relative w-full max-w-6xl h-full bg-slate-900 border-l border-white/10 shadow-2xl flex flex-col z-10 overflow-hidden"
                        >
                            {/* Drawer Header */}
                            <div className="flex items-center justify-between p-4 border-b border-white/5 bg-slate-950/50">
                                <div>
                                    <h3 className="text-base font-medium font-bold text-slate-205 flex items-center gap-2">
                                        📥 Live Receiver (TinySA / RF Explorer)
                                    </h3>
                                    <p className="text-[11px] text-zinc-400 mt-1 font-medium">Connect your smart receiver, TinySA, or RF Explorer via browser USB or import scanner data.</p>
                                </div>
                                <button 
                                    onClick={() => setIsLiveScanOpen(false)}
                                    className="px-3 py-1.5 text-[10px] font-black bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-sm border border-white/5 hover:border-white/10 transition-colors uppercase tracking-wider"
                                >
                                    Close Drawer
                                </button>
                            </div>
                            
                            {/* Drawer Content */}
                            <div className="flex-1 overflow-hidden flex flex-row p-4 custom-scrollbar">
                                <div className="flex-[1] overflow-y-auto bg-slate-950/40 p-2 border-r border-white/10 custom-scrollbar">
                                    <TvGrid 
                                        tvRegion={tvRegion}
                                        tvChannelStates={tvChannelStates}
                                        setTvChannelStates={(update) => setTvChannelStates(update)}
                                        handleTvChannelCycle={handleTvChannelCycle}
                                        handleBlockAllTvChannels={() => {
                                            const nextStates = { ...tvChannelStates };
                                            const channels = (tvRegion === 'uk' ? UK_TV_CHANNELS : US_TV_CHANNELS) || {};
                                            Object.keys(channels).forEach(chStr => {
                                                nextStates[chStr] = 'blocked';
                                            });
                                            setTvChannelStates(nextStates);
                                        }}
                                        handleClearTv={() => {
                                            const nextStates = { ...tvChannelStates };
                                            const channels = (tvRegion === 'uk' ? UK_TV_CHANNELS : US_TV_CHANNELS) || {};
                                            Object.keys(channels).forEach(chStr => {
                                                nextStates[chStr] = 'available';
                                            });
                                            setTvChannelStates(nextStates);
                                        }}
                                        title="Channel Grid"
                                        hideLocationLookup={true}
                                    />
                                    <AnalyzerControls
                                        vbw={vbw}
                                        onVbwChange={setVbw}
                                        rbw={rbw}
                                        onRbwChange={setRbw}
                                        span={span}
                                        onSpanChange={handleSpanChange}
                                        refLevel={refLevel}
                                        onRefLevelChange={setRefLevel}
                                        startFreq={startFreq}
                                        onStartFreqChange={handleStartFreqChange}
                                        stopFreq={stopFreq}
                                        onStopFreqChange={handleStopFreqChange}
                                        centerFreq={centerFreq}
                                        onCenterFreqChange={handleCenterFreqChange}
                                    />
                                </div>
                                <div className="flex-[2] overflow-y-auto custom-scrollbar">
                                    <LiveScanAnalyzer 
                                        className="h-full min-h-[450px]"
                                        scanData={scanData}
                                        tvRegion={tvRegion}
                                        tvChannelStates={tvChannelStates}
                                        onBlockChannel={(ch, state) => {
                                            const next = { ...tvChannelStates, [ch]: state };
                                            setTvChannelStates(next);
                                        }}
                                        onBulkUpdateChannels={(updates) => {
                                            setTvChannelStates(updates);
                                        }}
                                        onSimulate={onSimulateScan || (() => {})}
                                        onScanDataUpdate={setScanData}
                                        threshold={exclusionThreshold}
                                        onThresholdChange={setExclusionThreshold}
                                        vbw={vbw}
                                        rbw={rbw}
                                        span={span}
                                        refLevel={refLevel}
                                        centerFreq={centerFreq}
                                        startFreq={serialScanStartFreq ?? startFreq}
                                        onStartFreqChange={setSerialScanStartFreq ?? handleStartFreqChange}
                                        stopFreq={serialScanStopFreq ?? stopFreq}
                                        onStopFreqChange={setSerialScanStopFreq ?? handleStopFreqChange}
                                        serialDevice={serialDevice}
                                        serialStatus={serialStatus}
                                        serialIsScanning={serialIsScanning}
                                        setSerialIsScanning={setSerialIsScanning}
                                        onConnectSerial={onConnectSerial}
                                        onDisconnectSerial={onDisconnectSerial}
                                        onAutoDetectSerial={onAutoDetectSerial}
                                    />
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <LiveShareModal
                isOpen={isLiveShareOpen}
                onClose={() => setIsLiveShareOpen(false)}
                festivalActs={festivalActs}
                zoneConfigs={zoneConfigs}
                festivalName={festivalName}
                projectId={currentProject?.id?.toString() || 'default'}
            />

            <motion.button
                drag
                dragMomentum={false}
                onClick={() => { if (!isGenerating) handleGenerate(); }}
                disabled={isGenerating}
                className={`fixed bottom-12 right-12 z-[1000] cursor-grab active:cursor-grabbing shadow-2xl flex items-center justify-center gap-3 py-2 px-4 rounded-md font-black uppercase tracking-widest transition-colors border-b-4 ring-2 text-sm ${isGenerating ? 'bg-slate-800 text-slate-500 border-slate-900 ring-slate-800/50 shadow-none' : 'bg-yellow-500 text-slate-900 border-yellow-700 hover:bg-yellow-400 ring-yellow-400/50 shadow-yellow-500/20'}`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
            >
                {isGenerating ? (
                    <><span className="w-3.5 h-3.5 border-4 border-slate-500/20 border-t-slate-500 rounded-full animate-spin"></span>CALCULATING...</>
                ) : (
                    <><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> GENERATE</>
                )}
            </motion.button>
            </div>
        </div>
    );
};

export default FestivalCoordinationTab;
