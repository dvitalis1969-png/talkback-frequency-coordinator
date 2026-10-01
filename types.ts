

// FIX: Add 'mic' to TxType to allow assignment from EquipmentProfile.type
export type TxType = 'generic' | 'iem' | 'comms' | 'mic' | 'wmas';

export type TVChannelState = 'available' | 'mic-only' | 'iem-only' | 'both' | 'blocked';

export type TalkbackMode = 'standard' | 'europe' | 'custom';

export interface Frequency {
  id: string;
  value: number;
  label?: string;
  locked?: boolean;
  type?: TxType;
  equipmentKey?: string;
  compatibilityLevel?: CompatibilityLevel;
  sourceRequestId?: string;
  generationParams?: string;
  source?: 'house' | 'act' | 'constant';
  manualThresholds?: Thresholds;
  zoneIndex?: number; // Added for zonal distance-aware coordination
  linearMode?: boolean; // Bypass 12.5kHz IMD safety floor
  isTx?: boolean; // Explicitly mark as constant transmitter (Base)
  _ignoreImdWithCandidate?: boolean;
  _isConsecutive?: boolean;
  hz?: number;
  th?: Thresholds;
  isDigital?: boolean;
}

export interface Thresholds {
  fundamental: number;
  twoTone: number;
  threeTone: number;
  fiveTone: number;
  sevenTone: number;
}

export interface Conflict {
  type: string;
  product?: number;
  sourceFreqs?: { id: string, value: number, type?: TxType, label?: string }[];
  targetFreq: { id: string, value: number, type?: TxType, label?: string };
  diff?: number;
  sceneName?: string;
  // Festival Coordination Extensions
  frequencyId?: string;
  message?: string;
  conflictingFrequencyId?: string;
  severity?: 'warning' | 'critical';
}

export interface AnalysisResult {
  conflicts: Conflict[];
  totalChecks: number;
}

export interface EquipmentProfile {
    id?: string;
    isCustom?: boolean;
    name: string;
    band: string;
    minFreq: number;
    maxFreq: number;
    tuningStep: number;
    recommendedThresholds?: Partial<Thresholds>;
    compatibilityOverrides?: Partial<Record<CompatibilityLevel, Partial<Thresholds>>>;
    type?: 'mic' | 'iem' | 'generic' | 'comms' | 'wmas';
}

export type TabID = 'radioMicPlanner' | 'analyzer' | 'generator' | 'whitespace' | 'spectrum' | 'glassScope' | 'waterfall' | 'multiband' | 'talkback' | 'zonalTalkback' | 'tetra' | 'capacityPlus' | 'multizone' | 'multistage' | 'siteMap' | 'festivalSiteMap' | 'multizoneSiteMap' | 'timeline' | 'festival' | 'festivalTracker'
  | 'audioTone' | 'powerConverter' | 'imdDemo' | 'proximitySimulator' | 'interference' | 'equipmentDatabase' | 'hardwareLink' | 'userGuide' | 'tourPlanning' | 'wmas' | 'plotGallery' | 'activityFeed' | 'frequencyForensics' | 'reporting' | 'eventManagement';

// FIX: Added 'multizone' to AppCategory to resolve assignment errors in Header and Tabs
export type AppCategory = 'calculator' | 'coordination' | 'analysis' | 'comms' | 'toolkit' | 'hardware' | 'multizone' | 'tour' | 'wmas' | 'network' | 'eventManagement' | 'tvLookup' | 'sandbox';

export interface IntermodProduct {
    value: number;
    sources: number[];
    type: string;
    bw?: number;
}

export interface TalkbackIntermods {
    twoTone: IntermodProduct[];
    threeTone: IntermodProduct[];
    fiveTone: IntermodProduct[];
    sevenTone: IntermodProduct[];
}

export interface Zone {
  name: string;
  frequencies: Frequency[];
}

export interface ZoneConfig {
    name: string;
    count: number;
    equipmentKey?: string;
    compatibilityLevel?: CompatibilityLevel;
    zoneIndex?: number; // Target zone in the physical layout
    useManualParams?: boolean;
    manualFundamental?: number;
    manualTwoTone?: number;
    manualThreeTone?: number;
    manualFiveTone?: number;
    manualSevenTone?: number;
    customMin?: number;
    customMax?: number;
    linearMode?: boolean; // Bypass IMD Floor
    type?: TxType;
}

export interface SiteMapState {
  image: string | null;
  positions: { x: number; y: number }[];
  scale: { pixels: number; meters: number } | null;
}

export interface ScanDataPoint {
    freq: number;
    amp: number;
}

export type CompatibilityLevel = 'aggressive' | 'standard' | 'robust';

export interface Scene {
    id: string;
    name: string;
    activeFrequencyIds: Set<string>;
}

export interface EquipmentRequest {
    id: string;
    equipmentKey: string;
    count: number;
    compatibilityLevel: CompatibilityLevel;
    customMin?: number;
    customMax?: number;
    useManualParams?: boolean;
    manualFundamental?: number;
    manualTwoTone?: number;
    // FIX: Added manualThreeTone to EquipmentRequest to resolve property access errors
    manualThreeTone?: number;
    manualFiveTone?: number;
    manualSevenTone?: number;
    linearMode?: boolean;
    type?: TxType;
}

export interface FestivalAct {
    id: string;
    stage: string;
    actName: string;
    startTime: Date;
    endTime: Date;
    micRequests: EquipmentRequest[];
    iemRequests: EquipmentRequest[];
    frequencies?: Frequency[];
    parseError?: string;
    active: boolean;
    linkedActIds?: string[];
    muteHouseFrequencies?: boolean;
    muteHouseMics?: boolean;
    muteHouseIems?: boolean;
    houseIemsImdWithActMics?: boolean;
    houseMicsImdWithActIems?: boolean;
    orderNumber?: number;
    useHouseSystem?: boolean;
    isNoRf?: boolean;
    isHybrid?: boolean;
    isOwnRf?: boolean;
}

export interface FestivalDay {
    id: string;
    name: string;
    date?: Date;
    acts: FestivalAct[];
    tvChannelStates?: Record<string, TVChannelState>;
}

export interface UnifiedFestivalState {
    numZones: number;
    zoneConfigs: ZoneConfig[];
    distances: number[][];
    siteMapState: SiteMapState;
    compatibilityMatrix: boolean[][];
    constantSystems: ConstantSystemRequest[];
    houseSystems: ConstantSystemRequest[];
    days: FestivalDay[];
    distanceWeightingEnabled?: boolean;
    actIntermodMatrix?: Record<string, Record<string, boolean>>;
}

export interface ConstantSystemRequest {
    stageName: string;
    micRequests: EquipmentRequest[];
    iemRequests: EquipmentRequest[];
    frequencies?: Frequency[];
}

export interface BottleneckStats {
    totalRejections: number;
    fundamentalHits: number;
    imd2Hits: number;
    imd3Hits: number;
    exclusionHits: number;
    temporalSaturation: number;
}

export interface OptimizationSuggestion {
    category: 'Symmetry' | 'Parameters' | 'Stages' | 'Timeline' | 'Spectrum';
    severity: 'high' | 'medium' | 'low';
    message: string;
    action: string;
    shadowResult?: string[];
}

export interface OptimizationReport {
    bottlenecks: BottleneckStats;
    suggestions: OptimizationSuggestion[];
    peakCongestionActs: string[];
    requested: number;
    found: number;
    shortfall: number;
    micsRequested?: number;
    iemsRequested?: number;
    micsFound?: number;
    iemsFound?: number;
    analysisMessage?: string;
}

export interface PlotState {
    frequencies: Frequency[];
    range: { min: number; max: number };
    scanData: ScanDataPoint[] | null;
    noiseFloor: number;
    displayMode: 'line' | 'filled';
    overlayChannels: boolean;
    region: string;
    isFestivalMode: boolean;
    selectedActIds: string[];
}

export interface Plot {
    id?: number;
    projectId: number;
    name: string;
    createdAt: Date;
    data: PlotState;
}

export interface FrequencySnapshot {
    id: string;
    name: string;
    createdAt: Date;
    frequencies: Frequency[];
}

export interface DuplexPair {
  id: string;
  label: string;
  tx: number;
  rx: number;
  txBw?: number;
  rxBw?: number;
  txIsBase?: boolean;
  rxIsBase?: boolean;
  groupName: string;
  locked: boolean;
  active?: boolean;
  txActive?: boolean;
  rxActive?: boolean;
  type?: string;
  zoneIndex?: number;
  bw?: number;
}

export interface TalkbackSolution {
    pairs: DuplexPair[];
    failedCount: number;
    score: number;
}

export interface ZonalResult {
    zoneName: string;
    pairs: DuplexPair[];
    failedCount: number;
}

export interface BandState {
    id: string;
    min: string;
    max: string;
    count: string;
    equipmentKey: string;
    compatibilityLevel: CompatibilityLevel;
    useManual: boolean;
    manualParams: {
        fundamental: string;
        twoTone: string;
        threeTone: string;
    };
    type?: TxType;
}

export interface BandResult {
    name: string;
    range: string;
    frequencies: Frequency[];
    params: string;
}

export interface GeneratorRequest {
    id: number | string;
    key: string;
    count: string | number;
    customMin: string | number;
    customMax: string | number;
    compatibilityLevel: CompatibilityLevel;
    label?: string;
    useManualParams?: boolean;
    manualFundamental?: string | number;
    manualTwoTone?: string | number;
    manualThreeTone?: string | number;
    manualFiveTone?: string | number;
    manualSevenTone?: string | number;
    generationParams?: string;
    linearMode?: boolean;
    type?: TxType;
}

export interface CommsAppState {
    numZones: number;
    zoneConfigs: ZoneConfig[];
    distances: number[][];
    compatibilityMatrix: boolean[][];
    siteMapState: SiteMapState;
    manualPairs: DuplexPair[];
    results: DuplexPair[] | null;
    mode?: TalkbackMode;
    zonalResults?: ZonalResult[] | null;
    zonalManualPairs?: any[];
    zonalZoneConfigs?: any[];
}

export interface FestivalPlanningState {
    numZones: number;
    zoneConfigs: ZoneConfig[];
    distances: number[][];
    acts: FestivalAct[];
    constantSystems: ConstantSystemRequest[];
    houseSystems: ConstantSystemRequest[];
    siteMapState: SiteMapState;
    compatibilityMatrix: boolean[][];
    tvChannelStates?: Record<number, TVChannelState>;
}

export interface MultizonePlanningState {
    numZones: number;
    zoneConfigs: ZoneConfig[]; // Physical zone data
    equipmentGroups?: ZoneConfig[]; // Deployment gear requests
    manualFrequencies?: Frequency[]; // Fixed frequencies
    manualConstraints?: Frequency[]; // Global manual exclusions
    distances: number[][];
    results: { zones: Zone[], spares: { mics: Frequency[], iems: Frequency[] } } | null;
    siteMapState: SiteMapState;
    compatibilityMatrix: boolean[][];
    tvChannelStates?: Record<number, TVChannelState>;
    distanceWeightingEnabled?: boolean;
}

export interface TourStop {
    id: string;
    location: string;
    date: Date;
    tvChannelStates?: Record<number, TVChannelState>;
    tvChannelErpData?: Record<number, { maxErp: number, transmitterName: string, distance?: number }>;
}

export interface TourPlanningState {
    constantSystems: ConstantSystemRequest;
    globalTvChannelStates?: Record<number, TVChannelState>;
    globalTvChannelErpData?: Record<number, { maxErp: number, transmitterName: string, distance?: number }>;
    localTvChannelStates?: Record<number, TVChannelState>;
    localTvChannelErpData?: Record<number, { maxErp: number, transmitterName: string, distance?: number }>;
    stops: TourStop[];
    localRequests: EquipmentRequest[];
    localFrequencies?: Frequency[];
    optimizedChannelSelections?: Record<number, { selected: boolean, type: 'mic' | 'iem' }>;
    region: 'uk' | 'us';
}

export type WMASMode = 'low-latency' | 'standard' | 'high-density';

export interface WMASMaskTemplate {
    emissionBandwidthKHz: number;
    guardBandKHz: number;
    spectralRollOffDbPerOctave?: number;
    outOfBandAttenuationDb?: number;
    description: string;
}

export interface WMASProfile {
    id: string;
    name: string;
    manufacturer?: 'Sennheiser' | 'Shure' | 'Generic' | string;
    bandwidthMHz: number;
    description?: string;
    maskTemplate?: WMASMaskTemplate;
    maxLinks: Record<WMASMode, number>;
}

export interface WMASNode {
    id: string;
    name: string;
    profileId: string;
    mode: WMASMode;
    linksRequired: number;
    assignedBlock?: { start: number; end: number; tvChannel?: number };
    isHouseSystem?: boolean;
    actName?: string;
    stage?: string;
    startTime?: Date;
    endTime?: Date;
}

export interface WMASState {
    nodes: WMASNode[];
    tvRegion: 'uk' | 'us';
}

declare global {
    const __BUILD_TIMESTAMP__: string;
}

export interface User {
    id: string;
    name: string;
    email: string;
    photoURL?: string;
    subscription?: string;
    subscriptionStatus?: string;
    stripeCustomerId?: string | null;
    role?: string;
    expiresAt?: string;
    organizationId?: string; // Links users to an enterprise organization
    organizationRole?: 'admin' | 'coordinator' | 'crew' | 'member';
    organizationName?: string;
    organizationAdminEmail?: string;
    inheritedFrom?: string;
    maxSeats?: number;
    branding?: {
        companyName?: string;
        contactEmail?: string;
        contactPhone?: string;
        websiteUrl?: string;
        logoBase64?: string;
        footerLogoBase64?: string;
        brandColor?: string;
        secondaryColor?: string;
        documentTheme?: 'modern-minimal' | 'high-contrast' | 'classic';
    };
}

export interface Announcement {
    id: string;
    title: string;
    message: string;
    createdAt: any;
    authorId: string;
    authorName: string;
    organizationId?: string; // If present, restricted to this org. If null, global.
}

export interface PublicProfile {
    id: string;
    name: string;
    title?: string;
    location?: string;
    currentTour?: string;
    specialties?: string[];
    gearInventory?: string;
    availableForWork?: boolean;
    lastSeen?: any;
}

export interface EventManagementState {
    numZones: number;
    zoneConfigs: ZoneConfig[]; // Unified zone config containing Mics, IEMs, and Talkback
    distances: number[][];
    compatibilityMatrix: boolean[][];
    siteMapState: SiteMapState;
    results: any | null; // We can type this later or leave as any for now
}

export interface AppState {
    activeTab: TabID;
    activeApp?: AppCategory | null;
    isSunlightMode?: boolean; // legacy
    displayTheme?: 'dark' | 'clean-office' | 'studio-neutral' | 'sunlight';
    frequencies: Frequency[];
    thresholds: Thresholds;
    generatorFrequencies: Frequency[] | null;
    festivalState?: UnifiedFestivalState;
    multizoneState?: MultizonePlanningState;
    eventManagementState?: EventManagementState;
    scanData: ScanDataPoint[] | null;
    inclusionRanges: { min: number; max: number }[] | null;
    snapshots: FrequencySnapshot[];
    scenes: Scene[];
    talkbackPairs?: DuplexPair[];
    commsState?: CommsAppState;
    multiBandState?: { bands: BandState[]; results: BandResult[] | null };
    tourPlanningState?: TourPlanningState;
    wmasState?: WMASState;
    generatorState?: { 
        requests: GeneratorRequest[]; 
        exclusions: string;
        useGlobalThresholds: boolean;
        globalThresholds: { fundamental: string; twoTone: string; threeTone: string };
        manualConstraints?: Frequency[]; 
        ignoreManualIMD?: boolean;
        tvChannelStates?: Record<number, TVChannelState>;
        tvRegion?: 'uk' | 'us';
    };
    equipmentOverrides?: Record<string, Partial<Thresholds>>;
    numZones?: number;
    zoneConfigs?: ZoneConfig[];
    distances?: number[][];
    results?: any;
    siteMapState?: any;
    festivalActs?: any;
    constantSystems?: any;
    houseSystems?: any;
}

export interface Project {
    id: number | string;
    name: string;
    lastModified: Date;
    data: AppState;
    userId?: string;
}