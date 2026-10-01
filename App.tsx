
import React, { useState, useCallback, useEffect, useRef, useMemo, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { migrateToUnifiedFestival } from '@/scripts/migrateToUnifiedFestival';
import LiveCrewView from './components/LiveCrewView';
import { TabID, Frequency, Thresholds, Zone, ZoneConfig, AppState, Project, EquipmentProfile, SiteMapState, ScanDataPoint, Scene, FestivalAct, CompatibilityLevel, ConstantSystemRequest, AppCategory, FrequencySnapshot, BandState, BandResult, GeneratorRequest, DuplexPair, CommsAppState, UnifiedFestivalState, MultizonePlanningState, ZonalResult, TVChannelState, TourPlanningState, WMASState, FestivalPlanningState, EventManagementState } from './types';
import Header from './components/Header';
import Tabs, { tabConfig } from './components/Tabs';
import CustomEquipmentManager from './components/CustomEquipmentManager';
import AppLauncher from './components/AppLauncher';
import LandingPage from './components/LandingPage';
import ProjectDashboard from './components/ProjectDashboard';
import UserGuideTab from './components/UserGuideTab';
import TourPlanningTab from './components/TourPlanningTab';
import WMASTab from './components/WMASTab';
import EventManagementTab from './components/EventManagementTab';
import ErrorBoundary from './components/ErrorBoundary';
import AuthModal from './components/AuthModal';
import { PassCountdown } from './components/PassCountdown';
import AccountDashboard from './components/AccountDashboard';
import CommunityPanel from './components/CommunityPanel';
import UserPresenceList from './components/UserPresenceList';
import ProfilePopover from './components/ProfilePopover';
import { ActivityFeed } from './components/ActivityFeed';
import { isPro } from './src/lib/userUtils';
import { CommandPalette } from './components/CommandPalette';
import ProTipsBanner from './components/ProTipsBanner';
import ProTipsPage from './components/ProTipsPage';
import { OfflineIndicator } from './components/OfflineIndicator';
import { exportToJson as exportCoordinationToJson, exportToWwbCsv, CoordinationExportData } from './src/utils/exportUtils';

import { useLocalStorage } from './hooks/useLocalStorage';
import { useDebounce } from './hooks/useDebounce';
import { toast, Toaster } from 'sonner';
import { Check, Radio, Maximize2, Minimize2, Users, Sun, Moon, X } from 'lucide-react';
const AnalyzerTab = React.lazy(() => import('./components/AnalyzerTab'));
const GeneratorTab = React.lazy(() => import('./components/GeneratorTab'));
const WhiteSpaceTab = React.lazy(() => import('./components/WhiteSpaceTab'));
const SpectrumTab = React.lazy(() => import('./components/SpectrumTab'));
const WaterfallTab = React.lazy(() => import('./components/WaterfallTab'));
const MultiBandTab = React.lazy(() => import('./components/MultiBandTab'));
const TalkbackTab = React.lazy(() => import('./components/TalkbackTab'));
const ZonalTalkbackTab = React.lazy(() => import('./components/ZonalTalkbackTab'));
const TetraTab = React.lazy(() => import('./components/TetraTab'));
const CapacityPlusTab = React.lazy(() => import('./components/CapacityPlusTab'));
const ReportingTab = React.lazy(() => import('./components/ReportingTab'));
const PlotGallery = React.lazy(() => import('./components/PlotGallery'));
const MultiZoneCoordinationTab = React.lazy(() => import('./components/MultizoneTab'));
const SiteMapTab = React.lazy(() => import('./components/SiteMapTab'));
const TimelineTab = React.lazy(() => import('./components/TimelineTab'));
const FestivalCoordinationTab = React.lazy(() => import('./components/FestivalCoordinationTab'));
const FestivalTrackerTab = React.lazy(() => import('./components/FestivalTrackerTab'));
const ProximitySimulatorTab = React.lazy(() => import('./components/ProximitySimulatorTab'));
const InterferenceDemoTab = React.lazy(() => import('./components/InterferenceDemoTab'));
const IMDDemoTab = React.lazy(() => import('./components/IMDDemoTab'));
const GlassCockpitScopeTab = React.lazy(() => import('./components/GlassCockpitScope'));
const FrequencyForensicsTab = React.lazy(() => import('./components/FrequencyForensicsTab'));
const PowerConverterTab = React.lazy(() => import('./components/PowerConverterTab'));
const AudioToneGeneratorTab = React.lazy(() => import('./components/AudioToneGeneratorTab'));
const RadioMicIemPlannerTab = React.lazy(() => import('./components/RadioMicIemPlannerTab'));

import * as dbService from './services/dbService';
import { exportToJson as exportProjectToJson } from './services/fileService';
import { db, auth } from './src/lib/firebase';
import { initGA, logPageView } from './src/lib/analytics';
import AdBanner from './components/AdBanner';
import CookieBanner from './components/CookieBanner';
import { getDoc, doc, onSnapshot, collection, query, orderBy, limit, where, setDoc } from 'firebase/firestore';
import { saveProjectToCloud } from './services/cloudDbService';

import { generateMockScanData, SerialDevice, requestSerialPort, connectToDevice, readTinySAScan, readRFExplorerScan, disconnectDevice } from './services/serialService';

const initialFrequencies: Frequency[] = Array.from({ length: 6 }, (_, i) => ({
    id: `F${i + 1}`, value: 0, label: '', locked: false, type: 'generic'
}));

const initialThresholds: Thresholds = {
    fundamental: 0.350, twoTone: 0.050, threeTone: 0.050, fiveTone: 0.025, sevenTone: 0.025,
};

const initialSiteMapState: SiteMapState = { image: null, positions: [], scale: null };

const initialUnifiedFestivalState: UnifiedFestivalState = {
    numZones: 2,
    zoneConfigs: [
        { name: 'Main Stage', count: 8, compatibilityLevel: 'standard' }, 
        { name: 'Second Stage', count: 4, compatibilityLevel: 'standard' }
    ],
    distances: Array(2).fill(0).map((_, i) => Array(2).fill(0).map((_, j) => (i === j ? 0 : 0.1))),
    constantSystems: [{ stageName: 'Main Stage', micRequests: [], iemRequests: [], frequencies: [] }, { stageName: 'Second Stage', micRequests: [], iemRequests: [], frequencies: [] }],
    houseSystems: [{ stageName: 'Main Stage', micRequests: [], iemRequests: [], frequencies: [] }, { stageName: 'Second Stage', micRequests: [], iemRequests: [], frequencies: [] }],
    siteMapState: initialSiteMapState,
    compatibilityMatrix: Array(2).fill(false).map(() => Array(2).fill(false)),
    days: [
        {
            id: 'day-1',
            name: 'Day 1',
            acts: [],
            tvChannelStates: {}
        }
    ]
};

const initialMultizoneState: MultizonePlanningState = {
    numZones: 2,
    zoneConfigs: [
        { name: 'Zone 1', count: 0 }, 
        { name: 'Zone 2', count: 0 }
    ],
    equipmentGroups: [
        { name: 'Mics Zone 1', count: 8, equipmentKey: 'shure-ad-g56', zoneIndex: 0, compatibilityLevel: 'standard' },
        { name: 'Mics Zone 2', count: 8, equipmentKey: 'shure-ad-g56', zoneIndex: 1, compatibilityLevel: 'standard' }
    ],
    manualFrequencies: [],
    distances: Array(2).fill(0).map((_, i) => Array(2).fill(0).map((_, j) => i === j ? 0 : 0.1)),
    results: null,
    siteMapState: initialSiteMapState,
    compatibilityMatrix: Array(2).fill(false).map(() => Array(2).fill(false)),
    tvChannelStates: {}
};

const initialEventManagementState: EventManagementState = {
    numZones: 1,
    zoneConfigs: [
        { name: 'Main Event Space', count: 0 }
    ],
    distances: [[0]],
    compatibilityMatrix: [[true]],
    siteMapState: initialSiteMapState,
    results: null
};

const initialBandState: BandState = { id: `band-init`, min: '470.000', max: '550.000', count: '6', equipmentKey: 'custom', compatibilityLevel: 'standard', useManual: false, manualParams: { fundamental: '0.350', twoTone: '0.050', threeTone: '0.050' } };
const initialGeneratorRequests: GeneratorRequest[] = [{ id: Date.now(), key: 'shure-ad-g56', count: '8', customMin: '470.000', customMax: '636.000', compatibilityLevel: 'standard', type: 'mic' }];
const initialCommsState: CommsAppState = { numZones: 2, zoneConfigs: [{ name: 'Zone 1', count: 0 }, { name: 'Zone 2', count: 0 }], distances: [[0, 0.1], [0.1, 0]], compatibilityMatrix: Array(2).fill(false).map(() => Array(2).fill(false)), siteMapState: { image: null, positions: [], scale: null }, manualPairs: [], results: null };

const initialTourPlanningState: TourPlanningState = {
    constantSystems: { stageName: 'Touring Rack', micRequests: [], iemRequests: [], frequencies: [] },
    globalTvChannelStates: {},
    stops: [],
    localRequests: [],
    localFrequencies: [],
    region: 'uk'
};

const initialWMASState: WMASState = {
    nodes: [],
    tvRegion: 'uk'
};

const initialState: AppState = {
    activeTab: 'analyzer', activeApp: null, isSunlightMode: false, displayTheme: 'dark', frequencies: initialFrequencies, thresholds: initialThresholds,
    generatorFrequencies: null, 
    festivalState: initialUnifiedFestivalState,
    multizoneState: initialMultizoneState,
    eventManagementState: initialEventManagementState,
    tourPlanningState: initialTourPlanningState,
    wmasState: initialWMASState,
    scanData: null, inclusionRanges: null, snapshots: [], scenes: [],
    multiBandState: { bands: [initialBandState], results: null },
    generatorState: { requests: initialGeneratorRequests, exclusions: '', useGlobalThresholds: false, globalThresholds: { fundamental: '0.350', twoTone: '0.050', threeTone: '0.050' }, manualConstraints: [], ignoreManualIMD: false, tvChannelStates: {}, tvRegion: 'uk' },
    commsState: initialCommsState
};

const hydrateDate = (d: any): Date => {
    if (!d) return new Date();
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
};

const serializeZonalZoneConfigs = (configs: any[]) => {
    if (!configs) return [];
    return configs.map(c => ({
        ...c,
        txBands: c.txBands instanceof Set ? Array.from(c.txBands) : (Array.isArray(c.txBands) ? c.txBands : []),
        rxBands: c.rxBands instanceof Set ? Array.from(c.rxBands) : (Array.isArray(c.rxBands) ? c.rxBands : []),
        simplexTxBands: c.simplexTxBands instanceof Set ? Array.from(c.simplexTxBands) : (Array.isArray(c.simplexTxBands) ? c.simplexTxBands : []),
        simplexWalkieBands: c.simplexWalkieBands instanceof Set ? Array.from(c.simplexWalkieBands) : (Array.isArray(c.simplexWalkieBands) ? c.simplexWalkieBands : []),
    }));
};

const deserializeZonalZoneConfigs = (configs: any[]) => {
    if (!configs) return [];
    return configs.map(c => ({
        ...c,
        txBands: new Set(c.txBands || []),
        rxBands: new Set(c.rxBands || []),
        simplexTxBands: new Set(c.simplexTxBands || []),
        simplexWalkieBands: new Set(c.simplexWalkieBands || []),
    }));
};

const App: React.FC = () => {
    const [isDbReady, setIsDbReady] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isAuthLoading, setIsAuthLoading] = useState(true);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [currentProject, setCurrentProject] = useState<Project | null>(null);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'no-project'>('idle');
    const [isEngineCalculating, setIsEngineCalculating] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const isProjectLoading = useRef(false);
    const isLibraryLoaded = useRef(false);
    
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key?.toLowerCase() === 'p' || e.code === 'KeyP')) {
                e.preventDefault();
                (window as any).resetPrivacyConsent?.();
                toast.success("Privacy preferences have been reset.");
            }
        };
        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, []);

    useEffect(() => {
        console.log('[App] Component mounted. Build Timestamp:', typeof __BUILD_TIMESTAMP__ !== 'undefined' ? __BUILD_TIMESTAMP__ : 'unknown');
        console.log('[App] Initial State - isAuthenticated:', isAuthenticated, 'isAuthLoading:', isAuthLoading, 'isDbReady:', isDbReady);
        const params = new URLSearchParams(window.location.search);
        if (params.get('checkout') === 'success') {
            setShowSuccessModal(true);
            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (params.get('checkout') === 'cancel') {
            toast.error("Checkout was cancelled.");
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, []);

    const [activeApp, setActiveApp] = useState<AppCategory | null>(null);
    const [activeTab, setActiveTab] = useLocalStorage<TabID>('app_activeTab', 'analyzer');

    useEffect(() => {
        logPageView(`/${activeTab}`);
    }, [activeTab]);

    const [isSunlightMode, setIsSunlightMode] = useLocalStorage('app_isSunlightMode', false);
    const [displayTheme, setDisplayTheme] = useLocalStorage<'dark' | 'clean-office' | 'studio-neutral' | 'sunlight'>('app_displayTheme', 'dark');
    
    const [frequencies, setFrequencies] = useState<Frequency[]>(initialFrequencies);
    const [thresholds, setThresholds] = useState<Thresholds>(initialThresholds);
    const [generatorFrequencies, setGeneratorFrequencies] = useState<Frequency[] | null>(null);
    
    const [equipmentOverrides, setEquipmentOverrides] = useLocalStorage<Record<string, Partial<Thresholds>>>('app_equipmentOverrides', {});
    const [customEquipment, setCustomEquipment] = useLocalStorage<EquipmentProfile[]>('app_customEquipment', []);
    
    const [festivalState, setFestivalState] = useLocalStorage<UnifiedFestivalState>('app_unifiedFestivalState', initialUnifiedFestivalState);

    const [multizoneNumZones, setMultizoneNumZones] = useLocalStorage('app_multizoneNumZones', initialMultizoneState.numZones);
    const [multizoneZoneConfigs, setMultizoneZoneConfigs] = useLocalStorage('app_multizoneZoneConfigs', initialMultizoneState.zoneConfigs);
    const [multizoneGroups, setMultizoneGroups] = useLocalStorage('app_multizoneGroups', initialMultizoneState.equipmentGroups || []);
    const [multizoneManualFrequencies, setMultizoneManualFrequencies] = useLocalStorage<Frequency[]>('app_multizoneManualFrequencies', initialMultizoneState.manualFrequencies || []);
    const [multizoneManualConstraints, setMultizoneManualConstraints] = useLocalStorage<Frequency[]>('app_multizoneManualConstraints', initialMultizoneState.manualConstraints || []);
    const [multizoneDistances, setMultizoneDistances] = useLocalStorage('app_multizoneDistances', initialMultizoneState.distances);
    const [multizoneResults, setMultizoneResults] = useLocalStorage('app_multizoneResults', initialMultizoneState.results);
    const [multizoneSiteMap, setMultizoneSiteMap] = useLocalStorage<SiteMapState>('app_multizoneSiteMap', initialMultizoneState.siteMapState);
    const [multizoneMatrix, setMultizoneMatrix] = useLocalStorage<boolean[][]>('app_multizoneMatrix', initialMultizoneState.compatibilityMatrix);
    const [multizoneTvStates, setMultizoneTvStates] = useLocalStorage<Record<number, TVChannelState>>('app_multizoneTvStates', initialMultizoneState.tvChannelStates || {});
    const [multizoneDistanceWeightingEnabled, setMultizoneDistanceWeightingEnabled] = useLocalStorage<boolean>('app_multizoneDistanceWeighting', true);
    
    const [eventManagementState, setEventManagementState] = useLocalStorage<EventManagementState>('app_eventManagementState', initialEventManagementState);

    // Migration Logic
    useEffect(() => {
        const oldKey = 'app_festivalNumZones';
        if (localStorage.getItem(oldKey) && !localStorage.getItem('app_unifiedFestivalState')) {
            const oldState: FestivalPlanningState = {
                numZones: (() => { const s = localStorage.getItem('app_festivalNumZones'); return (s && s !== 'undefined') ? JSON.parse(s) : 2; })(),
                zoneConfigs: (() => { const s = localStorage.getItem('app_festivalZoneConfigs'); return (s && s !== 'undefined') ? JSON.parse(s) : []; })(),
                distances: (() => { const s = localStorage.getItem('app_festivalDistances'); return (s && s !== 'undefined') ? JSON.parse(s) : []; })(),
                acts: (() => { const s = localStorage.getItem('app_festivalActs'); return (s && s !== 'undefined') ? JSON.parse(s) : []; })(),
                constantSystems: (() => { const s = localStorage.getItem('app_festivalConstantSystems'); return (s && s !== 'undefined') ? JSON.parse(s) : []; })(),
                houseSystems: (() => { const s = localStorage.getItem('app_festivalHouseSystems'); return (s && s !== 'undefined') ? JSON.parse(s) : []; })(),
                siteMapState: (() => { const s = localStorage.getItem('app_festivalSiteMap'); return (s && s !== 'undefined' && s !== 'null') ? JSON.parse(s) : null; })(),
                compatibilityMatrix: (() => { const s = localStorage.getItem('app_festivalMatrix'); return (s && s !== 'undefined') ? JSON.parse(s) : []; })(),
                tvChannelStates: (() => { const s = localStorage.getItem('app_festivalTvStates'); return (s && s !== 'undefined') ? JSON.parse(s) : {}; })(),
            };

            const newState = migrateToUnifiedFestival(oldState);
            localStorage.setItem('app_unifiedFestivalState', JSON.stringify(newState));
            setFestivalState(newState);

            // Cleanup old keys
            localStorage.removeItem('app_festivalNumZones');
            localStorage.removeItem('app_festivalZoneConfigs');
            localStorage.removeItem('app_festivalDistances');
            localStorage.removeItem('app_festivalActs');
            localStorage.removeItem('app_festivalConstantSystems');
            localStorage.removeItem('app_festivalHouseSystems');
            localStorage.removeItem('app_festivalSiteMap');
            localStorage.removeItem('app_festivalMatrix');
            localStorage.removeItem('app_festivalTvStates');
        }
    }, [setFestivalState]);

    const [commsNumZones, setCommsNumZones] = useLocalStorage('app_commsNumZones', initialCommsState.numZones);
    const [commsZoneConfigs, setCommsZoneConfigs] = useLocalStorage<ZoneConfig[]>('app_commsZoneConfigs', initialCommsState.zoneConfigs);
    const [commsDistances, setCommsDistances] = useLocalStorage<number[][]>('app_commsDistances', initialCommsState.distances);
    const [commsCompatibilityMatrix, setCommsCompatibilityMatrix] = useLocalStorage<boolean[][]>('app_commsCompatibilityMatrix', initialCommsState.compatibilityMatrix);
    const [commsSiteMapState, setCommsSiteMapState] = useLocalStorage<SiteMapState>('app_commsSiteMapState', initialCommsState.siteMapState);
    const [tbManualPairs, setTbManualPairs] = useLocalStorage<DuplexPair[]>('app_tbManualPairs', initialCommsState.manualPairs);
    const [tbResults, setTbResults] = useLocalStorage<DuplexPair[] | null>('app_tbResults', initialCommsState.results);
    const [zonalResults, setZonalResults] = useLocalStorage<ZonalResult[] | null>('app_zonalResults', null);
    const [zonalManualPairs, setZonalManualPairs] = useLocalStorage<any[]>('app_zonalManualPairs', []);
    const [serializedZonalZoneConfigs, setSerializedZonalZoneConfigs] = useLocalStorage<any[]>('app_zonalZoneConfigs', []);
    const zonalZoneConfigs = useMemo(() => {
        return deserializeZonalZoneConfigs(serializedZonalZoneConfigs);
    }, [serializedZonalZoneConfigs]);
    const setZonalZoneConfigs = (val: any) => {
        const next = typeof val === 'function' ? val(zonalZoneConfigs) : val;
        setSerializedZonalZoneConfigs(serializeZonalZoneConfigs(next));
    };

    // --- UEP (Unified Event Planner) Independent State Variables ---
    const [uepMultizoneNumZones, setUepMultizoneNumZones] = useLocalStorage('app_uepMultizoneNumZones', initialMultizoneState.numZones);
    const [uepMultizoneZoneConfigs, setUepMultizoneZoneConfigs] = useLocalStorage('app_uepMultizoneZoneConfigs', initialMultizoneState.zoneConfigs);
    const [uepMultizoneGroups, setUepMultizoneGroups] = useLocalStorage('app_uepMultizoneGroups', initialMultizoneState.equipmentGroups || []);
    const [uepMultizoneManualFrequencies, setUepMultizoneManualFrequencies] = useLocalStorage<Frequency[]>('app_uepMultizoneManualFrequencies', initialMultizoneState.manualFrequencies || []);
    const [uepMultizoneManualConstraints, setUepMultizoneManualConstraints] = useLocalStorage<Frequency[]>('app_uepMultizoneManualConstraints', initialMultizoneState.manualConstraints || []);
    const [uepMultizoneDistances, setUepMultizoneDistances] = useLocalStorage('app_uepMultizoneDistances', initialMultizoneState.distances);
    const [uepMultizoneResults, setUepMultizoneResults] = useLocalStorage('app_uepMultizoneResults', initialMultizoneState.results);
    const [uepMultizoneMatrix, setUepMultizoneMatrix] = useLocalStorage<boolean[][]>('app_uepMultizoneMatrix', initialMultizoneState.compatibilityMatrix);
    const [uepMultizoneTvStates, setUepMultizoneTvStates] = useLocalStorage<Record<number, TVChannelState>>('app_uepMultizoneTvStates', initialMultizoneState.tvChannelStates || {});
    const [uepMultizoneDistanceWeightingEnabled, setUepMultizoneDistanceWeightingEnabled] = useLocalStorage<boolean>('app_uepMultizoneDistanceWeighting', true);

    const [uepCommsNumZones, setUepCommsNumZones] = useLocalStorage('app_uepCommsNumZones', initialCommsState.numZones);
    const [uepCommsZoneConfigs, setUepCommsZoneConfigs] = useLocalStorage<ZoneConfig[]>('app_uepCommsZoneConfigs', initialCommsState.zoneConfigs);
    const [uepCommsDistances, setUepCommsDistances] = useLocalStorage<number[][]>('app_uepCommsDistances', initialCommsState.distances);
    const [uepCommsCompatibilityMatrix, setUepCommsCompatibilityMatrix] = useLocalStorage<boolean[][]>('app_uepCommsCompatibilityMatrix', initialCommsState.compatibilityMatrix);
    const [uepZonalResults, setUepZonalResults] = useLocalStorage<ZonalResult[] | null>('app_uepZonalResults', null);
    const [uepZonalManualPairs, setUepZonalManualPairs] = useLocalStorage<any[]>('app_uepZonalManualPairs', []);
    const [uepSerializedZonalZoneConfigs, setUepSerializedZonalZoneConfigs] = useLocalStorage<any[]>('app_uepZonalZoneConfigs', []);
    const uepZonalZoneConfigs = useMemo(() => deserializeZonalZoneConfigs(uepSerializedZonalZoneConfigs), [uepSerializedZonalZoneConfigs]);
    const setUepZonalZoneConfigs = (val: any) => {
        const next = typeof val === 'function' ? val(uepZonalZoneConfigs) : val;
        setUepSerializedZonalZoneConfigs(serializeZonalZoneConfigs(next));
    };
    // ---------------------------------------------------------------

    const [scanData, setScanData] = useState<ScanDataPoint[] | null>(null);
    const [inclusionRanges, setInclusionRanges] = useState<{ min: number; max: number }[] | null>(null);
    const [scenes, setScenes] = useState<Scene[]>([]);
    const [snapshots, setSnapshots] = useState<FrequencySnapshot[]>([]);
    const [mbBands, setMbBands] = useState<BandState[]>([initialBandState]);
    const [mbResults, setMbResults] = useState<BandResult[] | null>(null);
    
    const [genRequests, setGenRequests] = useState<GeneratorRequest[]>(initialGeneratorRequests);
    const [genExclusions, setGenExclusions] = useState<string>('');
    const [genUseGlobalThresholds, setGenUseGlobalThresholds] = useState(false);
    const [genGlobalThresholds, setGenGlobalThresholds] = useState({ fundamental: '0.350', twoTone: '0.050', threeTone: '0.050' });
    const [genManualConstraints, setGenManualConstraints] = useState<Frequency[]>([]);
    const [genIgnoreManualIMD, setGenIgnoreManualIMD] = useState(false);
    const [genSiteThresholds, setGenSiteThresholds] = useState<Thresholds>({ fundamental: 0.350, twoTone: 0.050, threeTone: 0.050, fiveTone: 0, sevenTone: 0 });
    const [genTvStates, setGenTvStates] = useState<Record<number, TVChannelState>>(initialState.generatorState?.tvChannelStates || {});
    const [genTvRegion, setGenTvRegion] = useState<'uk' | 'us'>(initialState.generatorState?.tvRegion || 'uk');
    
    const [selectedProfile, setSelectedProfile] = useState<any>(null);
    const [isLoadingProfile, setIsLoadingProfile] = useState(false);
    const [selectedPublicProfile, setSelectedPublicProfile] = useState<any>(null);

    const handleSelectProfile = async (user: any) => {
        setSelectedProfile(user);
        setIsLoadingProfile(true);
        setSelectedPublicProfile(null);
        try {
            // db and getDoc, doc are imported statically
            const profileDoc = await getDoc(doc(db, 'public_profiles', user.id));
            if (profileDoc.exists()) {
                setSelectedPublicProfile(profileDoc.data());
            }
        } catch (err) {
            console.error("Error fetching public profile:", err);
        } finally {
            setIsLoadingProfile(false);
        }
    };

    const [tourPlanningState, setTourPlanningState] = useLocalStorage<TourPlanningState>('app_tourPlanningState', initialTourPlanningState);
    const [wmasState, setWmasState] = useLocalStorage<WMASState>('app_wmasState', initialWMASState);
    const [previewEquipment, setPreviewEquipment] = useState<{ profile: EquipmentProfile; frequency: number } | null>(null);

    const [isProjectDashboardOpen, setProjectDashboardOpen] = useState(false);
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [isSavePopupOpen, setIsSavePopupOpen] = useState(false);
    const [isCustomEquipmentManagerOpen, setCustomEquipmentManagerOpen] = useState(false);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [isCommunityOpen, setIsCommunityOpen] = useState(false);
    const [showProTipsPage, setShowProTipsPage] = useState(false);
    const [isIntercomOpen, setIsIntercomOpen] = useState(false);
    const [selectedDmUser, setSelectedDmUser] = useState<any>(null);
    const [communityTheme, setCommunityTheme] = useState<'light' | 'dark'>('dark');
    const [isAccountDashboardOpen, setIsAccountDashboardOpen] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [dbError, setDbError] = useState<string | null>(null);
    const [isSimulatingScan, setIsSimulatingScan] = useState(false);
    const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
    const [focusMode, setFocusMode] = useState(false);

    // Global Serial State
    const [serialDevice, setSerialDevice] = useState<SerialDevice | null>(null);
    const [serialStatus, setSerialStatus] = useState<string>('');
    const [serialIsScanning, setSerialIsScanning] = useState(false);
    const [serialScanStartFreq, setSerialScanStartFreq] = useState<number>(470);
    const [serialScanStopFreq, setSerialScanStopFreq] = useState<number>(700);
    const scanAbortRef = useRef<boolean>(false);

    const handleConnectSerial = async (deviceType: 'tinysa' | 'rfexplorer') => {
        try {
            setSerialStatus(`Connecting to ${deviceType === 'tinysa' ? 'TinySA' : 'RF Explorer'}...`);
            const port = await requestSerialPort();
            const baudRate = deviceType === 'rfexplorer' ? 500000 : 115200;
            const device = await connectToDevice(port, baudRate, deviceType);
            setSerialDevice(device);
            setSerialStatus(`Connected to ${deviceType === 'tinysa' ? 'TinySA' : 'RF Explorer'}`);
            toast.success(`Connected to ${deviceType === 'tinysa' ? 'TinySA' : 'RF Explorer'}`);
        } catch (error: any) {
            console.error('Connection error:', error);
            if (error.name === 'NotFoundError' || error.message?.includes('No port selected')) {
                setSerialStatus('Connection cancelled.');
                toast.info('Connection cancelled.');
            } else {
                setSerialStatus(`Connection failed: ${error.message}`);
                toast.error(`Connection failed: ${error.message}`);
            }
        }
    };

    const handleDisconnectSerial = async () => {
        if (serialDevice) {
            scanAbortRef.current = true;
            setSerialIsScanning(false);
            await disconnectDevice(serialDevice);
            setSerialDevice(null);
            setSerialStatus('Disconnected');
            toast.info('Hardware disconnected');
        }
    };

    const handleAutoDetectSerial = async (deviceType: 'tinysa' | 'rfexplorer') => {
        setSerialStatus('Starting Auto-Detect...');
        const speeds = deviceType === 'rfexplorer' ? [500000, 2400] : [57600, 115200, 9600, 921600];
        const { connectToDevice, sendRawCommand, disconnectDevice, forceWakeUp, getDeviceVersion } = await import('./services/serialService');
        
        try {
            const port = await requestSerialPort();
            for (const speed of speeds) {
                setSerialStatus(`Testing ${speed} baud...`);
                let dev: any = null;
                try {
                    dev = await connectToDevice(port, speed, deviceType);
                    await forceWakeUp(dev);
                    
                    const res = await sendRawCommand(dev, '', (raw) => console.log(`[AutoDetect ${speed}] ${raw}`));
                    const isTinySAPrompt = res.includes('ch>') || res.includes('tinysa>') || res.includes('nanovna>') || (res.trim().endsWith('>') && res.trim().length > 5);
                    const isRFExplorerPrompt = res.includes('#C2-M:') || res.includes('<<');

                    if (isTinySAPrompt || isRFExplorerPrompt || (deviceType === 'rfexplorer' && speed === 500000)) {
                        setSerialStatus(`SUCCESS! Found at ${speed} baud`);
                        const version = await getDeviceVersion(dev);
                        setSerialDevice(dev);
                        toast.success(`Connected to ${version || deviceType} at ${speed} baud`);
                        return;
                    }
                    await disconnectDevice(dev);
                } catch (e: any) {
                    console.warn(`Baud ${speed} failed:`, e);
                    if (dev) await disconnectDevice(dev);
                }
            }
            setSerialStatus('Auto-Detect failed. No device found.');
            toast.error('Auto-Detect failed. Try manual connect.');
        } catch (e: any) {
            if (e.name === 'NotFoundError' || e.message?.includes('No port selected')) {
                setSerialStatus('Connection cancelled.');
                toast.info('Connection cancelled.');
            } else {
                setSerialStatus(`Scan Error: ${e.message}`);
                toast.error(`Auto-Detect error: ${e.message}`);
            }
        }
    };

    useEffect(() => {
        if (!serialIsScanning || !serialDevice) return;

        scanAbortRef.current = false;
        const runScan = async () => {
            while (serialIsScanning && !scanAbortRef.current && serialDevice) {
                try {
                    const start = serialScanStartFreq;
                    const stop = serialScanStopFreq;
                    let sweep: ScanDataPoint[] = [];

                    if (serialDevice.deviceType === 'tinysa') {
                        sweep = await readTinySAScan(serialDevice, start, stop, 290, (s) => setSerialStatus(s));
                    } else {
                        sweep = await readRFExplorerScan(serialDevice, start, stop, 112, (s) => setSerialStatus(s));
                    }

                    if (sweep.length > 0) {
                        setScanData(sweep);
                    }
                } catch (e) {
                    console.error('Scan loop error:', e);
                    break;
                }
                // Small delay between sweeps
                await new Promise(r => setTimeout(r, 100));
            }
        };

        runScan();
        return () => { scanAbortRef.current = true; };
    }, [serialIsScanning, serialDevice, serialScanStartFreq, serialScanStopFreq]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('checkout') === 'success') {
            toast.success('Payment successful! Your account is being upgraded.');
            setIsAccountDashboardOpen(true);
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (params.get('checkout') === 'cancel') {
            toast.error('Payment was cancelled.');
            setIsAccountDashboardOpen(true);
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (params.get('portal') === 'return') {
            setIsAccountDashboardOpen(true);
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, []);

    useEffect(() => {
        document.documentElement.classList.remove('sunlight-mode', 'theme-clean-office', 'theme-studio-neutral', 'theme-sunlight');
        if (displayTheme === 'sunlight' || (isSunlightMode && displayTheme === 'dark')) document.documentElement.classList.add('theme-sunlight');
        else if (displayTheme === 'clean-office') document.documentElement.classList.add('theme-clean-office');
        else if (displayTheme === 'studio-neutral') document.documentElement.classList.add('theme-studio-neutral');
    }, [isSunlightMode, displayTheme]);

    useEffect(() => {
        if (!isSimulatingScan) {
            setScanData(null);
            return;
        }

        const interval = setInterval(() => {
            setScanData(generateMockScanData(470, 700, 200));
        }, 500);

        return () => clearInterval(interval);
    }, [isSimulatingScan]);

    const handleSimulateScan = useCallback(() => {
        setIsSimulatingScan(prev => !prev);
    }, []);

    useEffect(() => {
        const init = async (retries = 3) => {
            try {
                const ready = await dbService.initDB();
                if (ready) {
                    const globalOverrides = await dbService.getGlobalOverrides();
                    if (globalOverrides) setEquipmentOverrides(globalOverrides);
                    const profiles = await dbService.getCustomEquipment();
                    setCustomEquipment(profiles);
                    isLibraryLoaded.current = true;
                    const lastId = await dbService.getLastProjectId();
                    if (lastId) {
                        const project = await dbService.getProject(lastId);
                        if (project) {
                            setCurrentProject(project);
                            loadAppState(project.data);
                        }
                    }
                    setIsDbReady(true);
                } else {
                    throw new Error("Database returned not ready");
                }
            } catch (error: any) {
                console.error(`Database initialization attempt failed (${retries} retries left):`, error);
                
                if (retries > 0) {
                    // Wait 1 second and retry
                    setTimeout(() => init(retries - 1), 1000);
                } else {
                    const errorName = error?.name || 'UnknownError';
                    const errorMessage = error?.message || String(error);
                    
                    let userMessage = `Database initialization error: ${errorName} - ${errorMessage}.`;
                    
                    if (errorName === 'SecurityError') {
                        userMessage += " This is usually caused by browser security settings or blocking cookies/site data.";
                    } else if (errorName === 'QuotaExceededError') {
                        userMessage += " Your device is out of storage space.";
                    } else {
                        userMessage += " This can be caused by Private/Incognito mode, browser security settings, or an unverified SSL certificate.";
                    }
                    
                    setDbError(userMessage + " Please try refreshing or opening the site in a new window.");
                }
            }
        };
        init();
    }, []);

    useEffect(() => {
        if (activeApp) {
            const currentTabConfig = tabConfig.find(t => t.id === activeTab && t.category === activeApp);
            if (!currentTabConfig && activeTab !== 'userGuide') {
                const firstValidTab = tabConfig.find(t => t.category === activeApp);
                if (firstValidTab) setActiveTab(firstValidTab.id);
            }
        }
    }, [activeApp, activeTab]);

    useEffect(() => {
        if (!isDbReady || isProjectLoading.current || !isLibraryLoaded.current) return;
        const syncTimer = setTimeout(() => {
            dbService.saveGlobalOverrides(equipmentOverrides);
        }, 1000);
        return () => clearTimeout(syncTimer);
    }, [equipmentOverrides, isDbReady]);

    useEffect(() => {
        if (isProjectLoading.current) return;
        
        // This effect needs to update the festivalState if numZones is changed, to sync the dependent structures
        const { numZones, zoneConfigs, distances, compatibilityMatrix, houseSystems, constantSystems } = festivalState;
        
        let shouldUpdate = false;
        const newFestivalState = { ...festivalState };

        const currentConfigs = zoneConfigs || [];
        if (currentConfigs.length !== numZones) {
            shouldUpdate = true;
            if (currentConfigs.length < numZones) {
                const added = Array.from({ length: numZones - currentConfigs.length }, (_, i) => ({
                    name: `Stage ${currentConfigs.length + i + 1}`,
                    count: 8,
                    compatibilityLevel: 'standard' as const
                }));
                newFestivalState.zoneConfigs = [...currentConfigs, ...added];
            } else {
                newFestivalState.zoneConfigs = currentConfigs.slice(0, numZones);
            }
        }

        const currentHouse = houseSystems || [];
        if (currentHouse.length !== numZones) {
            shouldUpdate = true;
            if (currentHouse.length < numZones) {
                const addedHouse = Array.from({ length: numZones - currentHouse.length }, (_, i) => ({
                    stageName: newFestivalState.zoneConfigs ? newFestivalState.zoneConfigs[currentHouse.length + i].name : `Stage ${currentHouse.length + i + 1}`,
                    micRequests: [],
                    iemRequests: [],
                    frequencies: []
                }));
                newFestivalState.houseSystems = [...currentHouse, ...addedHouse];
            } else {
                newFestivalState.houseSystems = currentHouse.slice(0, numZones);
            }
        }

        const currentConstants = constantSystems || [];
        if (currentConstants.length !== numZones) {
            shouldUpdate = true;
            if (currentConstants.length < numZones) {
                const addedConstants = Array.from({ length: numZones - currentConstants.length }, (_, i) => ({
                    stageName: newFestivalState.zoneConfigs ? newFestivalState.zoneConfigs[currentConstants.length + i].name : `Stage ${currentConstants.length + i + 1}`,
                    micRequests: [],
                    iemRequests: [],
                    frequencies: []
                }));
                newFestivalState.constantSystems = [...currentConstants, ...addedConstants];
            } else {
                newFestivalState.constantSystems = currentConstants.slice(0, numZones);
            }
        }

        const currentDistances = distances || [];
        if (currentDistances.length !== numZones) {
            shouldUpdate = true;
            const newDist: number[][] = Array(numZones).fill(0).map((_, i) => 
                Array(numZones).fill(0).map((_, j) => i === j ? 0 : 0.1)
            );
            for (let i = 0; i < Math.min(currentDistances.length, numZones); i++) {
                for (let j = 0; j < Math.min(currentDistances.length, numZones); j++) {
                    newDist[i][j] = currentDistances[i][j];
                }
            }
            newFestivalState.distances = newDist;
        }

        const currentMatrix = compatibilityMatrix || [];
        if (currentMatrix.length !== numZones) {
            shouldUpdate = true;
            const newMatrix = Array(numZones).fill(false).map(() => Array(numZones).fill(false));
            for (let i = 0; i < Math.min(currentMatrix.length, numZones); i++) {
                for (let j = 0; j < Math.min(currentMatrix.length, numZones); j++) {
                    newMatrix[i][j] = currentMatrix[i][j] || false;
                }
            }
            newFestivalState.compatibilityMatrix = newMatrix;
        }

        if (shouldUpdate) {
            setFestivalState(newFestivalState);
        }
    }, [festivalState.numZones]);

    const prevMultizoneNumZonesRef = useRef<number>(multizoneNumZones);

    useEffect(() => {
        if (isProjectLoading.current) return;
        const prevNum = prevMultizoneNumZonesRef.current;
        
        setMultizoneZoneConfigs(prev => {
            const currentArr = Array.isArray(prev) ? prev : [];
            if (currentArr.length === multizoneNumZones) return currentArr;
            if (currentArr.length < multizoneNumZones) {
                const added = Array.from({ length: multizoneNumZones - currentArr.length }, (_, i) => ({ name: `Zone ${currentArr.length + i + 1}`, count: 0 }));
                return [...currentArr, ...added];
            }
            return currentArr.slice(0, multizoneNumZones);
        });
        setMultizoneGroups(prev => {
            const currentArr = Array.isArray(prev) ? prev : [];
            if (prevNum === multizoneNumZones) return currentArr;
            if (prevNum < multizoneNumZones) {
                const added = Array.from({ length: multizoneNumZones - prevNum }, (_, i) => ({ name: `Mics Zone ${prevNum + i + 1}`, count: 8, equipmentKey: 'shure-ad-g56', zoneIndex: prevNum + i, compatibilityLevel: 'standard' as const }));
                return [...currentArr, ...added];
            }
            return currentArr.filter(g => (g.zoneIndex ?? 0) < multizoneNumZones);
        });
        setMultizoneDistances(prev => {
            const currentArr = Array.isArray(prev) ? prev : [];
            if (currentArr.length === multizoneNumZones) return currentArr;
            const newDist: number[][] = Array(multizoneNumZones).fill(0).map((_, i) => Array(multizoneNumZones).fill(0).map((_, j) => i === j ? 0 : 0.1));
            for (let i = 0; i < Math.min(currentArr.length, multizoneNumZones); i++) {
                for (let j = 0; j < Math.min(currentArr.length, multizoneNumZones); j++) {
                    newDist[i][j] = currentArr[i][j];
                }
            }
            return newDist;
        });
        setMultizoneMatrix(prev => {
            const currentArr = Array.isArray(prev) ? prev : [];
            if (currentArr.length === multizoneNumZones) return currentArr;
            const newMatrix = Array(multizoneNumZones).fill(false).map(() => Array(multizoneNumZones).fill(false));
            for (let i = 0; i < Math.min(currentArr.length, multizoneNumZones); i++) {
                for (let j = 0; j < Math.min(currentArr.length, multizoneNumZones); j++) {
                    newMatrix[i][j] = currentArr[i][j] || false;
                }
            }
            return newMatrix;
        });
        
        prevMultizoneNumZonesRef.current = multizoneNumZones;
    }, [multizoneNumZones]);

    useEffect(() => {
        if (isProjectLoading.current) return;
        setCommsZoneConfigs(prev => {
            const currentArr = Array.isArray(prev) ? prev : [];
            if (currentArr.length === commsNumZones) return currentArr;
            if (currentArr.length < commsNumZones) {
                const added = Array.from({ length: commsNumZones - currentArr.length }, (_, i) => ({ name: `Zone ${currentArr.length + i + 1}`, count: 4 }));
                return [...currentArr, ...added];
            }
            return currentArr.slice(0, commsNumZones);
        });
        setCommsDistances(prev => {
            const currentArr = Array.isArray(prev) ? prev : [];
            if (currentArr.length === commsNumZones) return currentArr;
            const newDist: number[][] = Array(commsNumZones).fill(0).map((_, i) => Array(commsNumZones).fill(0).map((_, j) => (i === j ? 0 : 0.1)));
            for (let i = 0; i < Math.min(currentArr.length, commsNumZones); i++) {
                for (let j = 0; j < Math.min(currentArr.length, commsNumZones); j++) {
                    newDist[i][j] = currentArr[i][j];
                }
            }
            return newDist;
        });
        setCommsCompatibilityMatrix(prev => {
            const currentArr = Array.isArray(prev) ? prev : [];
            if (currentArr.length === commsNumZones) return currentArr;
            const newMatrix = Array(commsNumZones).fill(false).map(() => Array(commsNumZones).fill(false));
            for (let i = 0; i < Math.min(currentArr.length, commsNumZones); i++) {
                for (let j = 0; j < Math.min(currentArr.length, commsNumZones); j++) {
                    newMatrix[i][j] = currentArr[i][j] || false;
                }
            }
            return newMatrix;
        });
    }, [commsNumZones]);

    const prevUepMultizoneNumZonesRef = useRef<number>(uepMultizoneNumZones);

    useEffect(() => {
        if (isProjectLoading.current) return;
        const prevNum = prevUepMultizoneNumZonesRef.current;
        
        setUepMultizoneZoneConfigs(prev => {
            const currentArr = Array.isArray(prev) ? prev : [];
            if (currentArr.length === uepMultizoneNumZones) return currentArr;
            if (currentArr.length < uepMultizoneNumZones) {
                const added = Array.from({ length: uepMultizoneNumZones - currentArr.length }, (_, i) => ({ name: `Zone ${currentArr.length + i + 1}`, count: 0 }));
                return [...currentArr, ...added];
            }
            return currentArr.slice(0, uepMultizoneNumZones);
        });
        setUepMultizoneGroups(prev => {
            const currentArr = Array.isArray(prev) ? prev : [];
            if (prevNum === uepMultizoneNumZones) return currentArr;
            if (prevNum < uepMultizoneNumZones) {
                const added = Array.from({ length: uepMultizoneNumZones - prevNum }, (_, i) => ({ name: `Mics Zone ${prevNum + i + 1}`, count: 8, equipmentKey: 'shure-ad-g56', zoneIndex: prevNum + i, compatibilityLevel: 'standard' as const }));
                return [...currentArr, ...added];
            }
            return currentArr.filter(g => (g.zoneIndex ?? 0) < uepMultizoneNumZones);
        });
        setUepMultizoneDistances(prev => {
            const currentArr = Array.isArray(prev) ? prev : [];
            if (currentArr.length === uepMultizoneNumZones) return currentArr;
            const newDist: number[][] = Array(uepMultizoneNumZones).fill(0).map((_, i) => Array(uepMultizoneNumZones).fill(0).map((_, j) => i === j ? 0 : 0.1));
            for (let i = 0; i < Math.min(currentArr.length, uepMultizoneNumZones); i++) {
                for (let j = 0; j < Math.min(currentArr.length, uepMultizoneNumZones); j++) {
                    newDist[i][j] = currentArr[i][j];
                }
            }
            return newDist;
        });
        setUepMultizoneMatrix(prev => {
            const currentArr = Array.isArray(prev) ? prev : [];
            if (currentArr.length === uepMultizoneNumZones) return currentArr;
            const newMatrix = Array(uepMultizoneNumZones).fill(false).map(() => Array(uepMultizoneNumZones).fill(false));
            for (let i = 0; i < Math.min(currentArr.length, uepMultizoneNumZones); i++) {
                for (let j = 0; j < Math.min(currentArr.length, uepMultizoneNumZones); j++) {
                    newMatrix[i][j] = currentArr[i][j] || false;
                }
            }
            return newMatrix;
        });
        
        prevUepMultizoneNumZonesRef.current = uepMultizoneNumZones;
    }, [uepMultizoneNumZones]);

    useEffect(() => {
        if (isProjectLoading.current) return;
        setUepCommsZoneConfigs(prev => {
            const currentArr = Array.isArray(prev) ? prev : [];
            if (currentArr.length === uepCommsNumZones) return currentArr;
            if (currentArr.length < uepCommsNumZones) {
                const added = Array.from({ length: uepCommsNumZones - currentArr.length }, (_, i) => ({ name: `Zone ${currentArr.length + i + 1}`, count: 4 }));
                return [...currentArr, ...added];
            }
            return currentArr.slice(0, uepCommsNumZones);
        });
        setUepCommsDistances(prev => {
            const currentArr = Array.isArray(prev) ? prev : [];
            if (currentArr.length === uepCommsNumZones) return currentArr;
            const newDist: number[][] = Array(uepCommsNumZones).fill(0).map((_, i) => Array(uepCommsNumZones).fill(0).map((_, j) => (i === j ? 0 : 0.1)));
            for (let i = 0; i < Math.min(currentArr.length, uepCommsNumZones); i++) {
                for (let j = 0; j < Math.min(currentArr.length, uepCommsNumZones); j++) {
                    newDist[i][j] = currentArr[i][j];
                }
            }
            return newDist;
        });
        setUepCommsCompatibilityMatrix(prev => {
            const currentArr = Array.isArray(prev) ? prev : [];
            if (currentArr.length === uepCommsNumZones) return currentArr;
            const newMatrix = Array(uepCommsNumZones).fill(false).map(() => Array(uepCommsNumZones).fill(false));
            for (let i = 0; i < Math.min(currentArr.length, uepCommsNumZones); i++) {
                for (let j = 0; j < Math.min(currentArr.length, uepCommsNumZones); j++) {
                    newMatrix[i][j] = currentArr[i][j] || false;
                }
            }
            return newMatrix;
        });
    }, [uepCommsNumZones]);

    const loadAppState = (state: AppState) => {
        isProjectLoading.current = true;
        setActiveTab(state.activeTab || 'analyzer');
        setActiveApp(state.activeApp || null);
        setIsSunlightMode(state.isSunlightMode || false);
        setDisplayTheme(state.displayTheme || 'dark');
        setFrequencies(state.frequencies || initialFrequencies);
        setThresholds(state.thresholds || initialThresholds);
        setGeneratorFrequencies(state.generatorFrequencies || null);
        setScanData(state.scanData || null);
        setInclusionRanges(state.inclusionRanges || null);
        setSnapshots((state.snapshots || []).map(s => ({ ...s, createdAt: hydrateDate(s.createdAt) })));
        setScenes((state.scenes || []).map(s => ({ ...s, activeFrequencyIds: new Set(Array.from(s.activeFrequencyIds || [])) })));
        
        if (state.festivalState) {
            // Check if it's the old format (acts exists, days doesn't)
            const fest = state.festivalState as any;
            if (fest.acts && (!fest.days || fest.days.length === 0)) {
                console.log('[App] Migrating loaded project festivalState to unified format');
                setFestivalState(migrateToUnifiedFestival(fest));
            } else {
                setFestivalState(state.festivalState);
            }
        }

        if (state.multizoneState) {
            const loadedNumZones = state.multizoneState.numZones || 2;
            setMultizoneNumZones(loadedNumZones);
            prevMultizoneNumZonesRef.current = loadedNumZones;
            setMultizoneZoneConfigs(state.multizoneState.zoneConfigs || []);
            setMultizoneGroups(state.multizoneState.equipmentGroups || []);
            setMultizoneManualFrequencies(state.multizoneState.manualFrequencies || []);
            setMultizoneManualConstraints(state.multizoneState.manualConstraints || []);
            setMultizoneDistances(state.multizoneState.distances || []);
            setMultizoneResults(state.multizoneState.results);
            setMultizoneSiteMap(state.multizoneState.siteMapState || initialSiteMapState);
            setMultizoneMatrix(state.multizoneState.compatibilityMatrix || []);
            setMultizoneTvStates(state.multizoneState.tvChannelStates || {});
            setMultizoneDistanceWeightingEnabled(state.multizoneState.distanceWeightingEnabled !== false);
        } else {
            setMultizoneNumZones(initialMultizoneState.numZones);
            prevMultizoneNumZonesRef.current = initialMultizoneState.numZones;
            setMultizoneZoneConfigs(initialMultizoneState.zoneConfigs);
            setMultizoneGroups(initialMultizoneState.equipmentGroups || []);
            setMultizoneManualFrequencies(initialMultizoneState.manualFrequencies || []);
            setMultizoneManualConstraints(initialMultizoneState.manualConstraints || []);
            setMultizoneDistances(initialMultizoneState.distances);
            setMultizoneResults(initialMultizoneState.results);
            setMultizoneSiteMap(initialMultizoneState.siteMapState);
            setMultizoneMatrix(initialMultizoneState.compatibilityMatrix);
            setMultizoneTvStates(initialMultizoneState.tvChannelStates || {});
            setMultizoneDistanceWeightingEnabled(initialMultizoneState.distanceWeightingEnabled !== false);
        }

        if (state.eventManagementState) {
            setEventManagementState(state.eventManagementState);
        } else {
            setEventManagementState(initialEventManagementState);
        }

        if (state.commsState) {
            setCommsNumZones(state.commsState.numZones || 2);
            setCommsZoneConfigs(state.commsState.zoneConfigs || []);
            setCommsDistances(state.commsState.distances || []);
            setCommsCompatibilityMatrix(state.commsState.compatibilityMatrix || []);
            setCommsSiteMapState(state.commsState.siteMapState || initialSiteMapState);
            setTbManualPairs(state.commsState.manualPairs || []);
            setTbResults(state.commsState.results || null);
            setZonalResults(state.commsState.zonalResults || null);
            setZonalManualPairs(state.commsState.zonalManualPairs || []);
            setZonalZoneConfigs(deserializeZonalZoneConfigs(state.commsState.zonalZoneConfigs || []));
        } else {
            setCommsNumZones(initialCommsState.numZones);
            setCommsZoneConfigs(initialCommsState.zoneConfigs);
            setCommsDistances(initialCommsState.distances);
            setCommsCompatibilityMatrix(initialCommsState.compatibilityMatrix);
            setCommsSiteMapState(initialCommsState.siteMapState);
            setTbManualPairs(initialCommsState.manualPairs || []);
            setTbResults(initialCommsState.results || null);
            setZonalResults(initialCommsState.zonalResults || null);
            setZonalManualPairs(initialCommsState.zonalManualPairs || []);
            setZonalZoneConfigs(deserializeZonalZoneConfigs(initialCommsState.zonalZoneConfigs || []));
        }

        if (state.multiBandState) {
            setMbBands(state.multiBandState.bands || [initialBandState]);
            setMbResults(state.multiBandState.results);
        } else {
            setMbBands([initialBandState]);
            setMbResults(null);
        }

        if (state.generatorState) {
            setGenRequests(state.generatorState.requests || initialGeneratorRequests);
            setGenExclusions(state.generatorState.exclusions || '');
            setGenUseGlobalThresholds(state.generatorState.useGlobalThresholds || false);
            setGenGlobalThresholds(state.generatorState.globalThresholds || initialState.generatorState!.globalThresholds);
            setGenManualConstraints(state.generatorState.manualConstraints || []);
            setGenIgnoreManualIMD(state.generatorState.ignoreManualIMD || false);
            setGenSiteThresholds((state as any).generatorState?.siteThresholds || { fundamental: 0.350, twoTone: 0.050, threeTone: 0.050, fiveTone: 0, sevenTone: 0 });
            setGenTvStates(state.generatorState.tvChannelStates || {});
            setGenTvRegion(state.generatorState.tvRegion || 'uk');
        } else {
            setGenRequests(initialGeneratorRequests);
            setGenExclusions('');
            setGenUseGlobalThresholds(false);
            setGenGlobalThresholds(initialState.generatorState!.globalThresholds);
            setGenManualConstraints([]);
            setGenIgnoreManualIMD(false);
            setGenSiteThresholds({ fundamental: 0.350, twoTone: 0.050, threeTone: 0.050, fiveTone: 0, sevenTone: 0 });
            setGenTvStates({});
            setGenTvRegion('uk');
        }

        if (state.tourPlanningState) {
            setTourPlanningState({
                ...initialTourPlanningState,
                ...state.tourPlanningState,
                stops: (state.tourPlanningState.stops || []).map(s => ({ ...s, date: hydrateDate(s.date) })),
                localRequests: state.tourPlanningState.localRequests || [],
                localFrequencies: state.tourPlanningState.localFrequencies || []
            });
        } else {
            setTourPlanningState(initialTourPlanningState);
        }

        if (state.wmasState) {
            setWmasState({
                ...state.wmasState,
                nodes: (state.wmasState.nodes || []).map(n => ({
                    ...n,
                    startTime: n.startTime ? hydrateDate(n.startTime) : undefined,
                    endTime: n.endTime ? hydrateDate(n.endTime) : undefined
                }))
            });
        } else {
            setWmasState(initialWMASState);
        }

        setTimeout(() => { isProjectLoading.current = false; }, 100);
    };

    const getCurrentAppState = (): AppState => ({
        activeTab, activeApp, isSunlightMode, displayTheme, frequencies, thresholds, generatorFrequencies, scanData, inclusionRanges, snapshots, scenes,
        multiBandState: { bands: mbBands, results: mbResults },
        generatorState: { requests: genRequests, exclusions: genExclusions, useGlobalThresholds: genUseGlobalThresholds, globalThresholds: genGlobalThresholds, manualConstraints: genManualConstraints, ignoreManualIMD: genIgnoreManualIMD, siteThresholds: genSiteThresholds, tvChannelStates: genTvStates, tvRegion: genTvRegion } as any,
        festivalState: festivalState,
        multizoneState: { numZones: multizoneNumZones, zoneConfigs: multizoneZoneConfigs, equipmentGroups: multizoneGroups, manualFrequencies: multizoneManualFrequencies, manualConstraints: multizoneManualConstraints, distances: multizoneDistances, results: multizoneResults, siteMapState: multizoneSiteMap, compatibilityMatrix: multizoneMatrix, tvChannelStates: multizoneTvStates, distanceWeightingEnabled: multizoneDistanceWeightingEnabled },
        eventManagementState: eventManagementState,
        commsState: { numZones: commsNumZones, zoneConfigs: commsZoneConfigs, distances: commsDistances, compatibilityMatrix: commsCompatibilityMatrix, siteMapState: commsSiteMapState, manualPairs: tbManualPairs, results: tbResults, zonalResults, zonalManualPairs, zonalZoneConfigs: serializeZonalZoneConfigs(zonalZoneConfigs) },
        tourPlanningState: tourPlanningState,
        wmasState: wmasState
    });

    const handleSaveAsNewProject = async (name: string) => {
        setIsSaveModalOpen(false);
        setSaveStatus('saving');
        setIsSavePopupOpen(true);
        const stateToSave = getCurrentAppState();
        const newProject: Omit<Project, 'id'> = {
            name,
            lastModified: new Date(),
            data: stateToSave,
            ...(isAuthenticated && user?.id ? { userId: user.id } : {})
        };
        try {
            let finalProject = { ...newProject } as Project;
            if (isAuthenticated && user?.id) {
                let cloudProject = { ...newProject };
                const stringifiedEstimate = JSON.stringify(stateToSave).length;
                if (stringifiedEstimate > 900000) {
                    console.warn("Payload approaching 1MB Firestore limit. Stripping heavy visual data from cloud sync.");
                    let cloudStateToSave = JSON.parse(JSON.stringify(stateToSave)); // Deep copy to safely modify
            
                    // 1. Strip raw scan data arrays
                    if (cloudStateToSave.scanData) cloudStateToSave.scanData = null;
                    
                    // 2. Safely strip all massive Base64 Site Map images
                    if (cloudStateToSave.siteMapState?.image) cloudStateToSave.siteMapState.image = null;
                    if (cloudStateToSave.festivalState?.siteMapState?.image) cloudStateToSave.festivalState.siteMapState.image = null;
                    if (cloudStateToSave.multizoneState?.siteMapState?.image) cloudStateToSave.multizoneState.siteMapState.image = null;
                    if (cloudStateToSave.commsState?.siteMapState?.image) cloudStateToSave.commsState.siteMapState.image = null;
                    
                    cloudProject.data = cloudStateToSave;
                }
                const cloudId = await saveProjectToCloud(user.id, cloudProject);
                finalProject.id = cloudId as any;
            }
            const localId = await dbService.saveProject(finalProject);
            if (!finalProject.id) finalProject.id = localId as any;
            
            setCurrentProject(finalProject);
            await dbService.setLastProjectId(finalProject.id!);
            setSaveStatus('saved');
            setLastSaved(new Date());
        } catch (error: any) {
            console.error("Save failed", error);
            setSaveStatus('idle');
            const errDetails = typeof error?.message === 'string' && error.message.includes('Firestore Error') ? error.message : (error?.message || '');
            toast.error(`Database write error. ${errDetails}`, {duration: 6000});
        }
        setTimeout(() => setSaveStatus('idle'), 3000);
    };

    const saveCurrentProject = async (forceName?: string) => {
        if (!currentProject && !forceName) {
            setIsSaveModalOpen(true);
            return;
        }
        setSaveStatus('saving');
        setIsSavePopupOpen(true);
        const stateToSave = getCurrentAppState();
        
        let cloudStateToSave = stateToSave;
        const stringifiedEstimate = JSON.stringify(stateToSave).length;
        if (stringifiedEstimate > 900000) {
            console.warn("Payload approaching 1MB Firestore limit. Stripping heavy visual data from cloud sync.");
            cloudStateToSave = JSON.parse(JSON.stringify(stateToSave)); // Deep copy to safely modify
            
            // 1. Strip raw scan data arrays
            if (cloudStateToSave.scanData) cloudStateToSave.scanData = null;
            
            // 2. Safely strip all massive Base64 Site Map images
            if (cloudStateToSave.siteMapState?.image) cloudStateToSave.siteMapState.image = null;
            if (cloudStateToSave.festivalState?.siteMapState?.image) cloudStateToSave.festivalState.siteMapState.image = null;
            if (cloudStateToSave.multizoneState?.siteMapState?.image) cloudStateToSave.multizoneState.siteMapState.image = null;
            if (cloudStateToSave.commsState?.siteMapState?.image) cloudStateToSave.commsState.siteMapState.image = null;
        }

        const updatedProject: Project = currentProject ? { 
            ...currentProject, 
            lastModified: new Date(), 
            data: stateToSave,
            ...(isAuthenticated && user?.id ? { userId: user.id } : {})
        } : {
            id: Date.now() as any,
            name: forceName || 'Untitled Project',
            lastModified: new Date(),
            data: stateToSave,
            userId: user?.id
        };
        try {
            if (isAuthenticated && user?.id) {
                const cloudProject = { ...updatedProject, data: cloudStateToSave };
                const cloudId = await saveProjectToCloud(user.id, cloudProject);
                updatedProject.id = cloudId as any; 
            }
            await dbService.saveProject(updatedProject);
            await dbService.setLastProjectId(updatedProject.id);
            setCurrentProject(updatedProject);
            setSaveStatus('saved');
            setLastSaved(new Date());
        } catch (error: any) {
            console.error("Save failed", error);
            setSaveStatus('idle');
            const errDetails = typeof error?.message === 'string' && error.message.includes('Firestore Error') ? error.message : (error?.message || '');
            toast.error(`Database write error. ${errDetails}`, {duration: 6000});
        }
        setTimeout(() => setSaveStatus('idle'), 3000);
    };

    const handleLogin = (userData: any) => { 
        setUser(userData);
        setIsAuthenticated(true); 
        setIsAuthModalOpen(false);
    };
    const handleLogout = async () => { 
        try {
            // auth is imported statically
            await auth.signOut();
        } catch (error) {
            console.error("Error signing out", error);
        }
        setUser(null);
        setIsAuthenticated(false); 
        setProjectDashboardOpen(false);
        setIsAccountDashboardOpen(false);
        setActiveApp(null); 
        setCurrentProject(null);
        loadAppState(initialState);
        dbService.setLastProjectId('');
    };

    const handleCommandAction = (action: string) => {
        if (action.startsWith('nav:')) {
            const tabId = action.split(':')[1] as TabID;
            if (tabId === 'home' as any) {
                setActiveApp(null);
                return;
            }
            // Find the category for this tab
            const config = tabConfig.find(t => t.id === tabId);
            if (config) {
                setActiveApp(config.category);
                setActiveTab(tabId);
            } else {
                setActiveTab(tabId);
            }
        } else if (action === 'action:add-freq') {
            setActiveApp('calculator');
            setFrequencies(prev => [...prev, { id: `F${prev.length + 1}`, value: 0, label: '', locked: false, type: 'generic' }]);
            setActiveTab('analyzer');
        } else if (action === 'action:export-pdf') {
            window.dispatchEvent(new CustomEvent('trigger-pdf-export'));
            toast.info("Generating PDF Report...");
        } else if (action === 'system:toggle-sunlight') {
            setIsSunlightMode(!isSunlightMode);
        } else if (action === 'system:logout') {
            handleLogout();
        }
    };

    useEffect(() => {
        if (user) {
            console.log(`[User State Update] User: ${user.email}, Status: ${user.subscriptionStatus}, Role: ${user.role}`);
        } else {
            console.log(`[User State Update] User is null`);
        }
    }, [user]);

    useEffect(() => {
        let unsubscribe: () => void;
        const initAuth = async () => {
            console.log('[initAuth] Starting...');
            // auth and db are imported statically
            if (!auth) {
                console.error('[initAuth] Auth not initialized');
                setIsAuthLoading(false);
                return;
            }
            // doc and getDoc are imported statically
            
            // Fallback timeout in case Firebase Auth is blocked by the browser (e.g. Brave, Safari)
            // or if there's a network issue preventing onAuthStateChanged from firing.
            const authTimeout = setTimeout(() => {
                console.warn("[initAuth] Firebase Auth initialization timed out. This may be due to browser privacy settings blocking third-party cookies, or a network issue.");
                setIsAuthLoading(false);
                setIsAuthenticated(false);
                setUser(null);
            }, 5000);

            unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
                console.log(`[initAuth] onAuthStateChanged fired. User: ${firebaseUser?.email || 'null'}`);
                clearTimeout(authTimeout);
                
                // Cleanup previous user listener if it exists
                if ((window as any)._userUnsubscribe) {
                    (window as any)._userUnsubscribe();
                    (window as any)._userUnsubscribe = null;
                }

                if (firebaseUser) {
                    console.log(`[Auth State Change] User UID: ${firebaseUser.uid}`);
                    // Set up real-time listener for user data
                    const userDocRef = doc(db, 'users', firebaseUser.uid);

                    // Handle device ID for concurrent login restriction
                    let myDeviceId = localStorage.getItem('ais_device_id');
                    if (!myDeviceId) {
                        myDeviceId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                        localStorage.setItem('ais_device_id', myDeviceId);
                    }
                    
                    try {
                        await setDoc(userDocRef, { currentDeviceId: myDeviceId }, { merge: true });
                    } catch (e) {
                        console.warn("Could not set device ID:", e);
                    }
                    
                    // Initial fetch to get the app started quickly
                    try {
                        const userDoc = await getDoc(userDocRef);
                        if (userDoc.exists()) {
                            const data = userDoc.data();
                            if (data.isBanned) {
                                toast.error("Your account has been suspended.");
                                auth.signOut();
                                return;
                            }
                            setUser({
                                id: firebaseUser.uid,
                                email: firebaseUser.email,
                                name: firebaseUser.displayName || firebaseUser.email?.split('@')[0],
                                subscription: data.subscription || 'none',
                                subscriptionStatus: data.subscriptionStatus || 'none',
                                stripeCustomerId: data.stripeCustomerId || null,
                                role: data.role || 'user',
                                ...data // Include all other profile fields
                            });
                        } else {
                            // New user or missing doc
                            setUser({
                                id: firebaseUser.uid,
                                email: firebaseUser.email,
                                name: firebaseUser.displayName || firebaseUser.email?.split('@')[0],
                                subscription: 'none',
                                subscriptionStatus: 'none',
                                role: 'user'
                            });
                        }
                    } catch (err) {
                        console.error("Initial user fetch error:", err);
                    }

                    // Real-time listener for updates (like subscription changes)
                    const userUnsubscribe = onSnapshot(userDocRef, (docSnapshot) => {
                        if (docSnapshot.exists()) {
                            const data = docSnapshot.data();
                            console.log(`[Firestore User Update] Data for ${firebaseUser.email}:`, data);
                            if (data.branding) {
                                console.log(`[Firestore User Update] Branding data received:`, data.branding);
                            } else {
                                console.log(`[Firestore User Update] No branding data in document.`);
                            }
                            if (data.isBanned) {
                                toast.error("Your account has been suspended.");
                                auth.signOut();
                                return;
                            }
                            
                            // Check for concurrent logins unless Enterprise
                            const myDeviceId = localStorage.getItem('ais_device_id');
                            const TESTER_EMAILS = [
                                'dvitalis1969@gmail.com',
                                'dnomsed@live.co.uk',
                                'aniakwlk@yahoo.co.uk'
                            ];
                            const isEnterprise = data.subscription?.toLowerCase() === 'enterprise' || 
                                (data.email && TESTER_EMAILS.includes(data.email.toLowerCase().trim()));
                            
                            if (!isEnterprise && data.currentDeviceId && myDeviceId && data.currentDeviceId !== myDeviceId) {
                                console.warn("Logged in from another device. Signing out.");
                                toast.error("You have been signed out because your account is in use on another device.");
                                auth.signOut();
                                return;
                            }
                            
                            const updatedUser = {
                                id: firebaseUser.uid,
                                email: data.email || firebaseUser.email,
                                name: data.name || firebaseUser.displayName || firebaseUser.email?.split('@')[0],
                                subscription: data.subscription || 'none',
                                subscriptionStatus: data.subscriptionStatus || 'none',
                                stripeCustomerId: data.stripeCustomerId || null,
                                role: data.role || 'user',
                                ...data,
                            };
                            console.log(`[Firestore User Update] Final User Object:`, updatedUser);
                            setUser(updatedUser);
                        } else {
                            console.log(`[Firestore User Update] Document DOES NOT EXIST in Firestore for UID: ${firebaseUser.uid} (${firebaseUser.email})`);
                        }
                    }, (err) => {
                        console.error("User document listener error:", err);
                    });

                    setIsAuthenticated(true);
                    
                    // Store the user unsubscribe function to call it when auth state changes or unmounts
                    (window as any)._userUnsubscribe = userUnsubscribe;
                } else {
                    if ((window as any)._userUnsubscribe) {
                        (window as any)._userUnsubscribe();
                        (window as any)._userUnsubscribe = null;
                    }
                    setIsAuthenticated(false);
                    setUser(null);
                    setProjectDashboardOpen(false);
                    setIsAccountDashboardOpen(false);
                }
                setIsAuthLoading(false);
            }, (error: any) => {
                console.error("Auth state change error:", error);
                setIsAuthLoading(false);
                // Don't block the app if auth fails
                setIsAuthenticated(false);
                setUser(null);
                setProjectDashboardOpen(false); // Ensure dashboard is closed
            });
        };
        initAuth();
        return () => {
            if (unsubscribe) unsubscribe();
            if ((window as any)._userUnsubscribe) {
                (window as any)._userUnsubscribe();
                (window as any)._userUnsubscribe = null;
            }
        };
    }, []);

    useEffect(() => {
        if (user && currentProject && currentProject.userId && currentProject.userId !== user.id) {
            console.warn("Project belongs to a different user. Clearing workspace.");
            setCurrentProject(null);
            loadAppState(initialState);
        }
    }, [user, currentProject]);

    useEffect(() => {
        if (user) {
            console.log("[App State] User object updated:", {
                email: user.email,
                subscription: user.subscription,
                status: user.subscriptionStatus,
                isPro: isPro(user)
            });
        }
    }, [user]);

    // Global Announcements Listener
    useEffect(() => {
        if (!isAuthenticated || !user) return;
        
        // Listen to global announcements (organizationId == null)
        const qGlobal = query(
            collection(db, 'announcements'), 
            where('organizationId', '==', null),
            orderBy('createdAt', 'desc'), 
            limit(1)
        );

        const handleSnapshot = (snapshot: any) => {
            snapshot.docChanges().forEach((change: any) => {
                if (change.type === 'added') {
                    const data = change.doc.data();
                    const now = new Date().getTime();
                    const createdAt = data.createdAt?.toDate?.()?.getTime() || 0;
                    if (now - createdAt < 5 * 60 * 1000) {
                        toast(data.title || "Announcement", {
                            description: data.message,
                            duration: 10000,
                            icon: '📢',
                        });
                    }
                }
            });
        };

        const unsubGlobal = onSnapshot(qGlobal, handleSnapshot, (err) => {
            console.error("Failed to listen to global announcements:", err);
        });

        let unsubOrg: (() => void) | null = null;
        const userOrgId = user.organizationId || (user.subscription?.toLowerCase() === 'enterprise' ? user.id : null);
        
        if (userOrgId) {
            const qOrg = query(
                collection(db, 'announcements'), 
                where('organizationId', '==', userOrgId),
                orderBy('createdAt', 'desc'), 
                limit(1)
            );
            unsubOrg = onSnapshot(qOrg, handleSnapshot, (err) => {
                console.error("Failed to listen to organization announcements:", err);
            });
        }
        
        return () => {
            unsubGlobal();
            if (unsubOrg) unsubOrg();
        };
    }, [isAuthenticated, user]);

    if (dbError) return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-2 text-center">
            <div className="text-red-500 text-4xl mb-4">⚠️</div>
            <h1 className="text-lg font-semibold font-bold mb-2">Initialization Error</h1>
            <p className="text-slate-400 mb-6 max-w-md">{dbError}</p>
            <div className="flex flex-col sm:flex-row gap-2">
                <button 
                    onClick={() => window.location.reload()}
                    className="px-4 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-md font-bold transition-colors"
                >
                    Reload Application
                </button>
                <button 
                    onClick={() => {
                        if (window.confirm("This will clear all local projects and settings. Are you sure?")) {
                            indexedDB.deleteDatabase('RFFrequencySuiteDB');
                            window.location.reload();
                        }
                    }}
                    className="px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-md font-bold transition-colors text-slate-400"
                >
                    Clear Local Data
                </button>
            </div>
        </div>
    );

    if (!isDbReady || isAuthLoading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Initializing Engine...</div>;

    console.log("[App] Rendering with path:", window.location.pathname);
    console.log("[App] Is Authenticated:", isAuthenticated);

    // Routing Rescue: If we are on a /live/ path but somehow hit the main app logic, 
    // we should try to force a match or a reload.
    const isLivePath = window.location.pathname.includes('/live/');

    return (
        <Routes>
            <Route path="/live/:shareId" element={<LiveCrewView />} />
            <Route path="/live/:shareId/*" element={<LiveCrewView />} />
            <Route path="*" element={
                <div className="min-h-screen bg-slate-950 text-slate-200 font-sans relative animate-in fade-in duration-700">
                    {isLivePath && (
                        <div className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
                            <div className="w-16 h-16 bg-indigo-500/20 text-indigo-500 rounded-full flex items-center justify-center mb-6 animate-pulse">
                                <Radio className="w-8 h-8" />
                            </div>
                            <h2 className="text-lg font-semibold font-black text-white mb-4 uppercase tracking-widest">Live Link Detected</h2>
                            <p className="text-slate-400 mb-8 max-w-xs mx-auto text-sm leading-relaxed">
                                We've detected you're trying to access a live plan, but the routing failed. This usually happens if your browser is serving a cached version of the app.
                            </p>
                            <div className="flex flex-col gap-2 w-full max-w-xs">
                                <button 
                                    onClick={() => {
                                        console.log("[Rescue] Forcing hard reload...");
                                        window.location.href = window.location.href;
                                        window.location.reload();
                                    }}
                                    className="px-8 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md font-black uppercase tracking-widest text-xs transition-all shadow-sm border border-slate-700/50 shadow-indigo-500/20"
                                >
                                    Force Refresh & Load Plan
                                </button>
                                <button 
                                    onClick={() => {
                                        console.log("[Rescue] Attempting manual navigation...");
                                        const shareId = window.location.pathname.split('/live/')[1]?.split('/')[0];
                                        if (shareId) {
                                            window.location.href = `/live/${shareId}`;
                                        } else {
                                            window.location.href = '/';
                                        }
                                    }}
                                    className="px-8 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md font-black uppercase tracking-widest text-xs transition-all"
                                >
                                    Try Manual Redirect
                                </button>
                            </div>
                        </div>
                    )}
                    {!isAuthenticated ? (
                        <>
                            <LandingPage onLogin={() => setIsAuthModalOpen(true)} />
                        </>
                    ) : (
                <>
                    <CommandPalette 
                        isOpen={isCommandPaletteOpen} 
                        setIsOpen={setIsCommandPaletteOpen} 
                        onAction={handleCommandAction}
                        tabs={tabConfig}
                    />
                    <OfflineIndicator />
                    
                    {!focusMode && (<div className="relative top-0 z-[10000] w-full px-4 pt-6 bg-slate-950/40 backdrop-blur-md">
                        <Header 
                            projectName={currentProject?.name} 
                            onManageProjects={() => setProjectDashboardOpen(true)} 
                            onSaveProject={saveCurrentProject} 
                            onSaveAsProject={() => setIsSaveModalOpen(true)}
                            onExportProject={() => {
                                const state = getCurrentAppState();
                                const projectToExport: Project = currentProject 
                                    ? { ...currentProject, data: state, lastModified: new Date() }
                                    : { id: Date.now() as any, name: 'Untitled Project', data: state, lastModified: new Date() };
                                exportProjectToJson(projectToExport, `${projectToExport.name}.rfproject`);
                            }} 
                            activeApp={activeApp} 
                            onGoHome={() => setActiveApp(null)} 
                            isSunlightMode={isSunlightMode} 
                            toggleSunlightMode={() => setIsSunlightMode(!isSunlightMode)} 
                            displayTheme={displayTheme}
                            onThemeChange={(theme) => {
                                setDisplayTheme(theme);
                                setIsSunlightMode(false);
                            }}
                            isSaving={saveStatus === 'saving'} 
                            isSaved={saveStatus === 'saved'} 
                            onLogout={handleLogout}
                            user={user}
                            onOpenAccount={() => setIsAccountDashboardOpen(true)}
                            isCommunityOpen={isCommunityOpen}
                            onToggleCommunity={() => setIsCommunityOpen(!isCommunityOpen)}
                            onExpire={async () => {
                                toast.error("Pass Expired!", {
                                    description: "Saving your work and locking pro features...",
                                    duration: 5000
                                });
                                const defaultName = `Expired Session Save - ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;
                                await saveCurrentProject(defaultName);
                                setTimeout(() => window.location.reload(), 2000);
                            }}
                        />

                        {activeApp !== null && (
                            <div className="mt-4 pb-2">
                                <Tabs activeTab={activeTab} setActiveTab={setActiveTab} activeApp={activeApp} />
                            </div>
                        )}
                    </div>)}

                    {!focusMode && (
                    <ProTipsBanner 
                        onViewAll={() => setShowProTipsPage(true)}
                    />
                    )}

                    {showProTipsPage && <ProTipsPage onClose={() => setShowProTipsPage(false)} />}
                    <div className={showProTipsPage ? 'hidden' : 'flex flex-col lg:flex-row gap-4 w-full px-4 py-2'}>
                <main className={`flex-grow transition-all duration-500 ${isCommunityOpen ? 'lg:flex-1' : 'w-full'} ${focusMode ? 'p-0' : 'px-4'}`}>
                    <ErrorBoundary>
                        {!isPro(user) && <AdBanner onGoPro={() => setIsAccountDashboardOpen(true)} />}
                        {activeApp === null ? (
                            <AppLauncher 
                                user={user} 
                                onSelectApp={cat => { 
                                    if (cat === 'network') {
                                        setIsCommunityOpen(true);
                                    } else {
                                        setActiveApp(cat); 
                                        const first = tabConfig.find(t => t.category === cat); 
                                        if(first) setActiveTab(first.id); 
                                    }
                                }} 
                            />
                        ) : (
                            <div className="space-y-6">
                                {/* System Documentation */}
                                {activeTab === 'userGuide' && <UserGuideTab activeApp={activeApp} />}
                                
                                {/* Radio Mic & IEM Planner */}
                                {activeTab === 'radioMicPlanner' && (
                                    <Suspense fallback={<div className="p-8 text-center text-slate-400 font-mono">Loading Radio Mic & IEM Planner...</div>}>
                                        <RadioMicIemPlannerTab />
                                    </Suspense>
                                )}
                                
                                {/* Core Coordination Modules */}
                                {activeTab === 'analyzer' && (
                                    <Suspense fallback={<div>Loading...</div>}>
                                        <AnalyzerTab user={user} frequencies={frequencies} setFrequencies={setFrequencies} thresholds={thresholds} setThresholds={setThresholds} scenes={scenes} snapshots={snapshots} setSnapshots={setSnapshots} scanData={scanData} tvChannelStates={genTvStates} setTvChannelStates={setGenTvStates} wmasState={wmasState} tvRegion={genTvRegion} setTvRegion={setGenTvRegion} />
                                    </Suspense>
                                )}
                                {activeTab === 'generator' && (
                                    <Suspense fallback={<div>Loading...</div>}>
                                        <GeneratorTab user={user} initialThresholds={initialThresholds} generatedFrequencies={generatorFrequencies} setGeneratorFrequencies={setGeneratorFrequencies} customEquipment={customEquipment} onManageCustomEquipment={() => setCustomEquipmentManagerOpen(true)} inclusionRanges={inclusionRanges} setInclusionRanges={setInclusionRanges} scenes={scenes} requests={genRequests} setRequests={setGenRequests} exclusions={genExclusions} setExclusions={setGenExclusions} useGlobalThresholds={genUseGlobalThresholds} setUseGlobalThresholds={setGenUseGlobalThresholds} globalThresholds={genGlobalThresholds} setGlobalThresholds={setGenGlobalThresholds} manualConstraints={genManualConstraints} setManualConstraints={setGenManualConstraints} ignoreManualIMD={genIgnoreManualIMD} setIgnoreManualIMD={setGenIgnoreManualIMD} siteThresholds={genSiteThresholds} setSiteThresholds={setGenSiteThresholds} equipmentOverrides={equipmentOverrides} tvChannelStates={genTvStates} setTvChannelStates={setGenTvStates} tvRegion={genTvRegion} setTvRegion={setGenTvRegion} wmasState={wmasState} setIsCalculating={setIsEngineCalculating} scanData={scanData} multiBandResults={mbResults} />
                                    </Suspense>
                                )}
                                {activeTab === 'multiband' && (
                                        <Suspense fallback={<div>Loading...</div>}>
                                            <MultiBandTab customEquipment={customEquipment} bands={mbBands} setBands={setMbBands} results={mbResults} setResults={setMbResults} equipmentOverrides={equipmentOverrides} wmasState={wmasState} tvRegion={genTvRegion} />
                                        </Suspense>
                                    )}
                                    {activeTab === 'whitespace' && (
                                        <Suspense fallback={<div>Loading...</div>}>
                                            <WhiteSpaceTab tvRegion={genTvRegion} setTvRegion={setGenTvRegion} />
                                        </Suspense>
                                    )}
                                    
                                    {/* Analysis & Visualization */}
                                    {activeTab === 'spectrum' && (
                                        <SpectrumTab 
                                            projectId={currentProject?.id} 
                                            analyzerFrequencies={frequencies} 
                                            generatorFrequencies={generatorFrequencies} 
                                            scanData={scanData} 
                                            setScanData={setScanData} 
                                            setInclusionRanges={setInclusionRanges} 
                                            setActiveTab={setActiveTab} 
                                            scenes={scenes} 
                                            festivalActs={festivalState.days[0]?.acts || []} 
                                            constantSystems={festivalState.constantSystems} 
                                            houseSystems={festivalState.houseSystems} 
                                            talkbackPairs={tbResults} 
                                            talkbackManual={tbManualPairs} 
                                            zonalResults={zonalResults} 
                                            wmasState={wmasState} 
                                            previewEquipment={previewEquipment} 
                                            setPreviewEquipment={setPreviewEquipment}
                                            serialDevice={serialDevice}
                                            serialStatus={serialStatus}
                                            serialIsScanning={serialIsScanning}
                                            setSerialIsScanning={setSerialIsScanning}
                                            onConnectSerial={handleConnectSerial}
                                            onDisconnectSerial={handleDisconnectSerial}
                                            onAutoDetectSerial={handleAutoDetectSerial}
                                            scanStartFreq={serialScanStartFreq}
                                            setScanStartFreq={setSerialScanStartFreq}
                                            scanStopFreq={serialScanStopFreq}
                                            setScanStopFreq={setSerialScanStopFreq}
                                        />
                                    )}
                                    {activeTab === 'glassScope' && (
                                        <GlassCockpitScopeTab 
                                            initialCenterFreq={506.0} 
                                            initialSpan={16.0} 
                                        />
                                    )}
                                    {activeTab === 'reporting' && (
                                        <Suspense fallback={<div>Loading...</div>}>
                                            {(() => {
                                                console.log("Rendering ReportingTab. activeTab:", activeTab, "user:", user);
                                                return <ReportingTab state={getCurrentAppState()} projectName={currentProject?.name} user={user} />;
                                            })()}
                                        </Suspense>
                                    )}
                                    {activeTab === 'waterfall' && (
                                        <WaterfallTab 
                                            analyzerFrequencies={frequencies} 
                                            generatorFrequencies={generatorFrequencies} 
                                            scanData={scanData} 
                                            wmasState={wmasState} 
                                            serialDevice={serialDevice}
                                            serialStatus={serialStatus}
                                            serialIsScanning={serialIsScanning}
                                            setSerialIsScanning={setSerialIsScanning}
                                            onConnectSerial={handleConnectSerial}
                                            onDisconnectSerial={handleDisconnectSerial}
                                            onAutoDetectSerial={handleAutoDetectSerial}
                                            scanStartFreq={serialScanStartFreq}
                                            scanStopFreq={serialScanStopFreq}
                                            setScanStartFreq={setSerialScanStartFreq}
                                            setScanStopFreq={setSerialScanStopFreq}
                                        />
                                    )}
                                    
                                    {/* Comms Planning */}
                                    {activeTab === 'talkback' && <TalkbackTab manualPairs={tbManualPairs} setManualPairs={setTbManualPairs} results={tbResults} setResults={setTbResults} user={user} />}
                                    {activeTab === 'zonalTalkback' && <ZonalTalkbackTab numZones={commsNumZones} setNumZones={setCommsNumZones} zoneConfigs={commsZoneConfigs} setZoneConfigs={setCommsZoneConfigs} distances={commsDistances} setDistances={setCommsDistances} siteMapState={commsSiteMapState} compatibilityMatrix={commsCompatibilityMatrix} setCompatibilityMatrix={setCommsCompatibilityMatrix} results={zonalResults} setResults={setZonalResults} zonalManualPairs={zonalManualPairs} setZonalManualPairs={setZonalManualPairs} zonalZoneConfigs={zonalZoneConfigs} setZonalZoneConfigs={setZonalZoneConfigs} />}
                                    {activeTab === 'tetra' && <TetraTab />}
                                    {activeTab === 'capacityPlus' && <CapacityPlusTab />}
                                    
                                    {/* Multi-Zone Planning */}
                                    {activeTab === 'multizone' && <MultiZoneCoordinationTab user={user} isLinked={true} setIsLinked={()=>{}} numZones={multizoneNumZones} setNumZones={setMultizoneNumZones} zoneConfigs={multizoneZoneConfigs} setZoneConfigs={setMultizoneZoneConfigs} equipmentGroups={multizoneGroups} setEquipmentGroups={setMultizoneGroups} manualFrequencies={multizoneManualFrequencies} setManualFrequencies={setMultizoneManualFrequencies} manualConstraints={multizoneManualConstraints} setManualConstraints={setMultizoneManualConstraints} distances={multizoneDistances} setDistances={setMultizoneDistances} results={multizoneResults} setResults={setMultizoneResults} customEquipment={customEquipment} onManageCustomEquipment={()=>setCustomEquipmentManagerOpen(true)} compatibilityMatrix={multizoneMatrix} setCompatibilityMatrix={setMultizoneMatrix} equipmentOverrides={equipmentOverrides} tvChannelStates={multizoneTvStates} setTvChannelStates={setMultizoneTvStates} wmasState={wmasState} distanceWeightingEnabled={multizoneDistanceWeightingEnabled} setDistanceWeightingEnabled={setMultizoneDistanceWeightingEnabled} />}
                                    {activeTab === 'multizoneSiteMap' && <SiteMapTab activeApp={activeApp} festivalState={{ zones: festivalState.zoneConfigs, map: festivalState.siteMapState, setMap: (map) => setFestivalState(prev => ({...prev, siteMapState: map})), setDist: (dist) => setFestivalState(prev => ({...prev, distances: dist})) }} multizoneState={{ zones: multizoneZoneConfigs, map: multizoneSiteMap, setMap: setMultizoneSiteMap, setDist: setMultizoneDistances }} />}
                                    
                                    {/* Festival & Event Coordination */}
                                    {activeTab === 'festival' && <FestivalCoordinationTab 
                                        festivalState={festivalState}
                                        setFestivalState={setFestivalState}
                                        setActiveTab={setActiveTab as any}
                                        constantSystems={festivalState.constantSystems}
                                        setConstantSystems={(update) => {
                                            const updater = typeof update === 'function' ? update : () => update;
                                            setFestivalState(prev => ({ ...prev, constantSystems: updater(prev.constantSystems) }));
                                        }}
                                        houseSystems={festivalState.houseSystems}
                                        setHouseSystems={(update) => {
                                            const updater = typeof update === 'function' ? update : () => update;
                                            setFestivalState(prev => ({ ...prev, houseSystems: updater(prev.houseSystems) }));
                                        }}
                                        zoneConfigs={festivalState.zoneConfigs}
                                        setZoneConfigs={(configs) => setFestivalState(prev => ({ ...prev, zoneConfigs: configs }))}
                                        numZones={festivalState.numZones}
                                        setNumZones={(num) => setFestivalState(prev => ({ ...prev, numZones: num }))}
                                        distances={festivalState.distances}
                                        setDistances={(dist) => setFestivalState(prev => ({ ...prev, distances: dist }))}
                                        initialThresholds={initialThresholds}
                                        customEquipment={customEquipment}
                                        compatibilityMatrix={festivalState.compatibilityMatrix}
                                        setCompatibilityMatrix={(update) => {
                                            const updater = typeof update === 'function' ? update : () => update;
                                            setFestivalState(prev => ({ ...prev, compatibilityMatrix: updater(prev.compatibilityMatrix) }));
                                        }}
                                        scanData={scanData}
                                        setScanData={setScanData}
                                        siteMapState={festivalState.siteMapState}
                                        equipmentOverrides={equipmentOverrides}
                                        setEquipmentOverrides={setEquipmentOverrides}
                                        onSimulateScan={handleSimulateScan}
                                        wmasState={wmasState}
                                        setWmasState={setWmasState}
                                        setIsCalculating={setIsEngineCalculating}
                                        user={user}
                                        currentProject={currentProject}
                                        serialDevice={serialDevice}
                                        serialStatus={serialStatus}
                                        serialIsScanning={serialIsScanning}
                                        setSerialIsScanning={setSerialIsScanning}
                                        onConnectSerial={handleConnectSerial}
                                        onDisconnectSerial={handleDisconnectSerial}
                                        onAutoDetectSerial={handleAutoDetectSerial}
                                        scanStartFreq={serialScanStartFreq}
                                        setScanStartFreq={setSerialScanStartFreq}
                                        scanStopFreq={serialScanStopFreq}
                                        setScanStopFreq={setSerialScanStopFreq}
                                    />}
                                    {activeTab === 'festivalTracker' && (
                                        <Suspense fallback={<div>Loading...</div>}>
                                            <FestivalTrackerTab festivalState={festivalState} setFestivalState={setFestivalState} />
                                        </Suspense>
                                    )}
                                    {activeTab === 'timeline' && <TimelineTab frequencies={frequencies} scenes={scenes} setScenes={setScenes} />}
                                    {activeTab === 'festivalSiteMap' && <SiteMapTab activeApp={activeApp} festivalState={{ zones: festivalState.zoneConfigs, map: festivalState.siteMapState, setMap: (map) => setFestivalState(prev => ({...prev, siteMapState: map})), setDist: (dist) => setFestivalState(prev => ({...prev, distances: dist})) }} multizoneState={{ zones: multizoneZoneConfigs, map: multizoneSiteMap, setMap: setMultizoneSiteMap, setDist: setMultizoneDistances }} />}
                                    
                                    {/* Tour Planning */}
                                    {activeTab === 'tourPlanning' && <TourPlanningTab state={tourPlanningState} setState={setTourPlanningState} customEquipment={customEquipment} equipmentOverrides={equipmentOverrides} />}

                                    {/* Event Management */}
                                    {activeTab === 'eventManagement' && (
                                        <EventManagementTab
                                            user={user}
                                            state={eventManagementState}
                                            setState={setEventManagementState}
                                            customEquipment={customEquipment}
                                            onManageCustomEquipment={() => setCustomEquipmentManagerOpen(true)}
                                            equipmentOverrides={equipmentOverrides}
                                            tvChannelStates={genTvStates}
                                            setTvChannelStates={setGenTvStates}
                                            wmasState={wmasState}
                                            multizoneProps={{
                                                user, isLinked: true, setIsLinked: () => {}, numZones: uepMultizoneNumZones, setNumZones: setUepMultizoneNumZones,
                                                zoneConfigs: uepMultizoneZoneConfigs, setZoneConfigs: setUepMultizoneZoneConfigs, equipmentGroups: uepMultizoneGroups,
                                                setEquipmentGroups: setUepMultizoneGroups, manualFrequencies: uepMultizoneManualFrequencies, setManualFrequencies: setUepMultizoneManualFrequencies,
                                                manualConstraints: uepMultizoneManualConstraints, setManualConstraints: setUepMultizoneManualConstraints, distances: uepMultizoneDistances,
                                                setDistances: setUepMultizoneDistances, results: uepMultizoneResults, setResults: setUepMultizoneResults, customEquipment,
                                                onManageCustomEquipment: () => setCustomEquipmentManagerOpen(true), compatibilityMatrix: uepMultizoneMatrix,
                                                setCompatibilityMatrix: setUepMultizoneMatrix, equipmentOverrides, tvChannelStates: uepMultizoneTvStates, setTvChannelStates: setUepMultizoneTvStates,
                                                wmasState, distanceWeightingEnabled: uepMultizoneDistanceWeightingEnabled, setDistanceWeightingEnabled: setUepMultizoneDistanceWeightingEnabled
                                            }}
                                            commsProps={{
                                                numZones: uepCommsNumZones, setNumZones: setUepCommsNumZones, zoneConfigs: uepCommsZoneConfigs, setZoneConfigs: setUepCommsZoneConfigs,
                                                distances: uepCommsDistances, setDistances: setUepCommsDistances, siteMapState: commsSiteMapState, compatibilityMatrix: uepCommsCompatibilityMatrix,
                                                setCompatibilityMatrix: setUepCommsCompatibilityMatrix, results: uepZonalResults, setResults: setUepZonalResults,
                                                zonalManualPairs: uepZonalManualPairs, setZonalManualPairs: setUepZonalManualPairs, zonalZoneConfigs: uepZonalZoneConfigs, setZonalZoneConfigs: setUepZonalZoneConfigs
                                            }}
                                        />
                                    )}

                                    {/* WMAS Coordination */}
                                    {activeTab === 'wmas' && <WMASTab state={wmasState} setState={setWmasState} tvChannelStates={genTvStates} scanData={scanData} />}

                                    {/* RF Toolkit Utilities */}
                                    {activeTab === 'plotGallery' && (
                                        <PlotGallery 
                                            onImportScanData={(data) => {
                                                setScanData(data);
                                                setActiveTab('spectrum'); // Switch to spectrum analyzer tab
                                            }} 
                                        />
                                    )}
                                    {activeTab === 'proximitySimulator' && <ProximitySimulatorTab />}
                                    {activeTab === 'interference' && <InterferenceDemoTab />}
                                    {activeTab === 'imdDemo' && <IMDDemoTab />}
                                    {activeTab === 'frequencyForensics' && <FrequencyForensicsTab />}
                                    
                                    {activeTab === 'powerConverter' && <PowerConverterTab />}
                                    
                                    {activeTab === 'audioTone' && <AudioToneGeneratorTab />}
                                </div>
                            )
                        }
                    </ErrorBoundary>
                </main>

                {/* Persistent Community Sidebar */}
                {isCommunityOpen && (
                    <aside className="lg:w-[420px] w-full shrink-0 animate-in slide-in-from-right duration-300 self-start h-[calc(100vh-8rem)] sticky top-20 overflow-hidden z-20">
                        <div className={`h-full border rounded-md shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
                            communityTheme === 'dark' 
                                ? 'bg-slate-950/90 backdrop-blur-xl border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.6)]' 
                                : 'bg-slate-50/95 backdrop-blur-xl border-slate-300 shadow-xl'
                        }`}>
                            {/* Sharp Header */}
                            <div className={`p-3 border-b flex items-center justify-between transition-colors shrink-0 ${
                                communityTheme === 'dark' 
                                    ? 'bg-slate-900/80 backdrop-blur-md border-white/10' 
                                    : 'bg-white border-slate-200 shadow-xs'
                            }`}>
                                <div className="flex items-center gap-2.5">
                                    <div className={`w-8 h-8 rounded-md flex items-center justify-center border transition-colors ${
                                        communityTheme === 'dark' 
                                            ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30 shadow-[0_0_12px_rgba(99,102,241,0.2)]' 
                                            : 'bg-indigo-50 text-indigo-600 border-indigo-200'
                                    }`}>
                                        <Users className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h2 className={`text-xs font-black uppercase tracking-widest ${communityTheme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
                                                Community Network
                                            </h2>
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                                        </div>
                                        <p className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">Live Frequency Ops & Feed</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <button 
                                        onClick={() => setCommunityTheme(communityTheme === 'dark' ? 'light' : 'dark')}
                                        className={`p-1.5 rounded-md transition-all border ${
                                            communityTheme === 'dark' 
                                                ? 'hover:bg-white/10 border-white/5 hover:border-white/20 text-slate-400 hover:text-white' 
                                                : 'hover:bg-slate-200 border-slate-200 text-slate-500 hover:text-slate-950'
                                        }`}
                                        title={`Switch to ${communityTheme === 'dark' ? 'Light' : 'Dark'} Theme`}
                                        aria-label="Toggle Theme"
                                    >
                                        {communityTheme === 'dark' ? (
                                            <Sun className="w-3.5 h-3.5" />
                                        ) : (
                                            <Moon className="w-3.5 h-3.5" />
                                        )}
                                    </button>
                                    <button 
                                        onClick={() => setIsCommunityOpen(false)}
                                        className={`p-1.5 rounded-md transition-all border ${
                                            communityTheme === 'dark' 
                                                ? 'hover:bg-white/10 border-white/5 hover:border-white/20 text-slate-400 hover:text-white' 
                                                : 'hover:bg-slate-200 border-slate-200 text-slate-500 hover:text-slate-950'
                                        }`}
                                        title="Close Community Network"
                                        aria-label="Close"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                            {/* Inner Contents */}
                            <div className="flex-grow flex flex-col overflow-hidden">
                                <UserPresenceList onUserClick={handleSelectProfile} />
                                <div className="flex-grow overflow-y-auto custom-scrollbar p-3">
                                    <ActivityFeed user={user} theme={communityTheme} />
                                </div>
                            </div>
                        </div>
                    </aside>
                )}
            </div>
                    {isAuthenticated && <CommunityPanel projectId={currentProject?.id} user={user} isOpen={isIntercomOpen} selectedDmUser={selectedDmUser} onSelectDmUser={setSelectedDmUser} onClose={() => setIsIntercomOpen(false)} />}
                </>
            )}
            {selectedProfile && (
                <ProfilePopover 
                    selectedProfile={selectedProfile}
                    selectedPublicProfile={selectedPublicProfile}
                    isLoadingProfile={isLoadingProfile}
                    onClose={() => setSelectedProfile(null)}
                    onSendMessage={(user) => {
                        setSelectedProfile(null);
                        setSelectedDmUser(user);
                        setIsIntercomOpen(true);
                    }}
                />
            )}
            <SaveProjectModal 
                isOpen={isSaveModalOpen} 
                onClose={() => setIsSaveModalOpen(false)} 
                onSave={handleSaveAsNewProject} 
                initialName={currentProject?.name}
            />
            <SavePopupModal isOpen={isSavePopupOpen} onClose={() => setIsSavePopupOpen(false)} />
            {isProjectDashboardOpen && <ProjectDashboard onLoadProject={p => { setCurrentProject(p); loadAppState(p.data); dbService.setLastProjectId(p.id); setProjectDashboardOpen(false); }} onCreateProject={async n => { const p = { name: n, lastModified: new Date(), data: initialState }; const id = await dbService.saveProject(p); setCurrentProject({...p, id}); loadAppState(p.data); dbService.setLastProjectId(id); setProjectDashboardOpen(false); }} onDeleteProject={async id => { await dbService.deleteProject(id); if(currentProject?.id === id){ setCurrentProject(null); dbService.clearLastProjectId(); } }} onClose={() => setProjectDashboardOpen(false)} />}
            {isCustomEquipmentManagerOpen && <div className="no-invert"><CustomEquipmentManager customProfiles={customEquipment} setCustomProfiles={setCustomEquipment} onClose={() => setCustomEquipmentManagerOpen(false)} /></div>}
            {isAuthModalOpen && <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} onSuccess={handleLogin} />}
            {isAccountDashboardOpen && <AccountDashboard 
                user={user} 
                onClose={() => setIsAccountDashboardOpen(false)} 
                onLogout={handleLogout} 
                onUpgrade={(tier) => { /* Handled by Stripe */ }} 
                onLoadProject={(p) => {
                    setCurrentProject(p);
                    loadAppState(p.data);
                    if (typeof p.id === 'number') {
                        dbService.setLastProjectId(p.id);
                    }
                    setIsAccountDashboardOpen(false);
                }}
            />}
            
            {/* Floating Focus Mode Toggle Button (Positioned just above the Intercom INT icon) */}
            <button
                onClick={() => setFocusMode(prev => !prev)}
                className={`fixed right-4 bottom-[96px] z-[100000] w-12 h-12 rounded-md flex items-center justify-center transition-all duration-300 shadow-2xl group ${
                    focusMode
                        ? "bg-indigo-600 hover:bg-indigo-500 border-2 border-indigo-400 text-white shadow-[0_0_20px_rgba(99,102,241,0.5)]"
                        : "bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 hover:border-indigo-400 text-slate-300 hover:text-white shadow-[0_0_15px_rgba(0,0,0,0.5)]"
                }`}
                title={focusMode ? "Exit Focus Mode (Return to Normal View)" : "Focus Mode (Expand Page / Full Screen Data View)"}
                aria-label={focusMode ? "Exit Focus Mode" : "Enter Focus Mode"}
            >
                {focusMode ? (
                    <Minimize2 className="w-5 h-5 transition-transform group-hover:scale-110" />
                ) : (
                    <Maximize2 className="w-5 h-5 transition-transform group-hover:scale-110" />
                )}
            </button>

            <div className="fixed bottom-0 left-0 right-0 h-8 bg-slate-900/95 backdrop-blur-md border-t border-white/5 z-[99999] flex items-center justify-between px-3 text-[10px] font-medium tracking-wider uppercase">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${isEngineCalculating ? 'bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-emerald-500'}`} />
                        <span className={isEngineCalculating ? 'text-amber-500' : 'text-slate-400'}>
                            Engine State: {isEngineCalculating ? 'Calculating...' : 'Idle'}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${saveStatus === 'saving' ? 'bg-blue-500 animate-pulse' : 'bg-emerald-500'}`} />
                        <span className="text-slate-400">
                            Sync Status: {saveStatus === 'saving' ? 'Saving...' : (lastSaved ? `All changes saved to cloud (${lastSaved.toLocaleTimeString()})` : 'Ready')}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="text-slate-500 flex items-center gap-1">
                        <span className="opacity-50">Project:</span> {currentProject?.name || 'Untitled'} 
                        <span className="mx-1 opacity-30">/</span> 
                        <span className="opacity-50">Tab:</span> {activeTab}
                    </div>
                    <div className="text-slate-600 opacity-50">
                        v2.5.1-STABLE
                    </div>
                </div>
            </div>
            
            {showSuccessModal && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[1000000] flex items-center justify-center p-2">
                    <div className="bg-slate-800 border border-emerald-500/30 rounded-md shadow-2xl w-full max-w-md p-8 text-center text-white">
                        <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Check className="w-8 h-8" />
                        </div>
                        <h2 className="text-xl font-semibold font-black uppercase tracking-tight mb-4">Payment Successful!</h2>
                        <p className="text-slate-300 mb-8">
                            Your account has been upgraded. You now have full access to all Pro modules. 
                            A countdown timer has been added to the bottom right of your screen to track your remaining time.
                        </p>
                        <button 
                            onClick={() => setShowSuccessModal(false)}
                            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-sm font-bold uppercase tracking-widest transition-colors"
                        >
                            Start Using Pro
                        </button>
                    </div>
                </div>
            )}

            <Toaster theme="dark" position="bottom-right" />
            <CookieBanner />
        </div>
            } />
        </Routes>
    );
};

const SaveProjectModal = ({ isOpen, onClose, onSave, initialName = '' }: { isOpen: boolean, onClose: () => void, onSave: (name: string) => void, initialName?: string }) => {
    const [name, setName] = useState(initialName);
    
    useEffect(() => {
        if (isOpen) {
            setName(initialName ? `${initialName} (Copy)` : '');
        }
    }, [isOpen, initialName]);

    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[1000000] flex items-center justify-center p-2">
            <div className="bg-slate-800 border border-indigo-500/30 rounded-md shadow-2xl w-full max-w-md p-4 text-white">
                <h3 className="text-lg font-semibold font-bold mb-4">Save Project As</h3>
                <input 
                    type="text" 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    placeholder="Project Name" 
                    className="w-full bg-slate-900 border border-slate-700 rounded-md p-2 text-slate-200 mb-4 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter' && name.trim()) { onSave(name.trim()); onClose(); } }}
                />
                <div className="flex justify-end gap-3">
                    <button onClick={onClose} className="px-3 py-2 rounded-md text-slate-400 hover:text-white">Cancel</button>
                    <button 
                        onClick={() => { if (name.trim()) { onSave(name.trim()); onClose(); } }} 
                        disabled={!name.trim()}
                        className="px-3 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
};

const SavePopupModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[1000000] flex items-center justify-center p-2">
            <div className="bg-slate-800 border border-indigo-500/30 rounded-md shadow-2xl w-full max-w-md p-4 text-center text-white">
                <div className="text-4xl mb-4">☁️</div>
                <h3 className="text-lg font-semibold font-bold mb-2">Saving project to Cloud</h3>
                <p className="text-slate-400 text-sm mb-6">
                    Click on 'Download' to Save Project to Your Hard Drive
                </p>
                <button 
                    onClick={onClose} 
                    className="px-4 py-2 rounded-sm bg-indigo-600 hover:bg-indigo-500 text-white font-bold tracking-wider uppercase text-xs"
                >
                    Got it
                </button>
            </div>
        </div>
    );
};

export default App;
