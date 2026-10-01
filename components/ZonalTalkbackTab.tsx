import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Settings } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  applyBrandingToPdf,
  generateBrandedPdf,
  getTableStyles,
  generateFullCoordinationPdf,
} from "../src/utils/pdfBranding";
import {
  exportToJson,
  exportToWwbCsv,
  CoordinationExportData,
} from "../src/utils/exportUtils";
import Card, { CardTitle, Placeholder } from "./Card";
import PdfPreviewModal from "./PdfPreviewModal";
import { LivePdfPreview } from "./LivePdfPreview";
import {
  DuplexPair,
  ZoneConfig,
  SiteMapState,
  ZonalResult,
  TxType,
  TalkbackIntermods,
  IntermodProduct,
  Conflict,
  Frequency,
  Thresholds,
  TalkbackMode,
} from "../types";
import {
  TALKBACK_DEFINITIONS,
  TALKBACK_FIXED_PAIRS,
  DISCRETE_TALKBACK_PAIRS,
  TALKBACK_FORBIDDEN_RANGES_BY_COUNTRY,
} from "../constants";
import {
  generateZonalTalkbackPairs,
  calculateTalkbackIntermods,
  checkTalkbackCompatibility,
} from "../services/rfService";
import {
  EngagingLoadingState,
  CelebratorySuccessState,
} from "./EngagingStates";

interface DuplexPairWithBw extends DuplexPair {
  txBw?: number;
  rxBw?: number;
  zoneIndex?: number;
}

const buttonBase =
  "px-3 py-2 rounded-sm font-bold uppercase tracking-wider transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 transform active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed text-[10px]";
const primaryButton = `bg-gradient-to-r from-blue-600 to-cyan-600 text-white border-b-4 border-blue-800 hover:brightness-110 shadow-sm border border-slate-700/50 ${buttonBase}`;
const secondaryButton = `bg-slate-700 text-white border-b-4 border-slate-900 hover:bg-slate-600 ${buttonBase}`;
const actionButton = `bg-cyan-600/80 text-white border-b-4 border-cyan-800 hover:border-cyan-700 hover:bg-cyan-600 ${buttonBase}`;
const greenButton = `bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 ${buttonBase}`;

const INTERMOD_CONFIG = {
  tx: { color: "#facc15", amp: -10, label: "Transmit (Tx)" },
  rx: { color: "#38bdf8", amp: -10, label: "Receive (Rx)" },
  twoTone: { color: "#ef4444", amp: -50, label: "2-Tone IMD" },
  threeTone: { color: "#a855f7", amp: -75, label: "3-Tone IMD" },
  grid: "rgba(255, 255, 255, 0.15)",
  text: "#ffffff",
};

const STANDARD_BASE_BANDS = [457, 455, 446, 450, 451, 442, 425, 427, 452];
const STANDARD_PORT_BANDS = [467, 468, 469, 466, 465];

const EUROPE_BASE_BANDS = [465, 466, 467, 468, 469];
const EUROPE_PORT_BANDS = [446, 450, 451, 452, 455, 457, 458, 460];

const STANDARD_SIMPLEX_BASE_BANDS = [
  457, 455, 446, 450, 451, 442, 425, 427, 452,
];
const STANDARD_SIMPLEX_WALKIE_BANDS = [467, 468, 469, 466, 465];

const EUROPE_SIMPLEX_BASE_BANDS = [467, 468, 469];
const EUROPE_SIMPLEX_WALKIE_BANDS = [457, 455, 446, 447, 450, 451, 452];

const ManualFreqInput: React.FC<{
  value: number;
  onChange: (val: string) => void;
  className: string;
}> = ({ value, onChange, className }) => {
  const [localString, setLocalString] = useState<string>(
    value === 0 ? "" : value.toString(),
  );
  const isFocused = useRef(false);

  useEffect(() => {
    if (!isFocused.current) setLocalString(value === 0 ? "" : value.toString());
  }, [value]);

  return (
    <input
      type="text"
      inputMode="decimal"
      placeholder="0.00000"
      value={localString}
      onChange={(e) => {
        const val = e.target.value;
        if (val === "" || /^[0-9]*\.?[0-9]*$/.test(val)) {
          setLocalString(val);
          onChange(val);
        }
      }}
      onFocus={() => {
        isFocused.current = true;
      }}
      onBlur={() => {
        isFocused.current = false;
        const parsed = parseFloat(localString);
        if (!isNaN(parsed) && parsed !== 0) setLocalString(parsed.toFixed(5));
        else setLocalString("");
      }}
      className={className}
    />
  );
};

interface TalkbackSubzoneConfig {
  id: string;
  name: string;
  pairCount: number;
  customPairCount?: number;
  simplexTxCount?: number;
  simplexWalkieCount?: number;
  customSimplexTxCount?: number;
  customSimplexWalkieCount?: number;
}

interface ZonalTalkbackZoneConfig {
  name: string;
  pairCount: number;
  customPairCount?: number;
  txBands: Set<number>;
  rxBands: Set<number>;
  simplexTxBands?: Set<number>;
  simplexWalkieBands?: Set<number>;
  simplexTxCount?: number;
  simplexWalkieCount?: number;
  customSimplexTxCount?: number;
  customSimplexWalkieCount?: number;
  simplexTxBw?: number;
  simplexWalkieBw?: number;
  targetSeparation?: number;
  exactSeparation?: boolean;
  useTargetSeparation?: boolean;
  generationPriority?: ("duplex" | "simplexTx" | "simplexWalkie")[];
  duplexCustomMode?: "standard" | "custom";
  simplexCustomMode?: "standard" | "custom";
  customTxMin?: number;
  customTxMax?: number;
  customRxMin?: number;
  customRxMax?: number;
  customRanges?: { id: string; txMin: number; txMax: number; rxMin: number; rxMax: number; customPairCount?: number; customBw?: number }[];
  customTargetMode?: "global" | "specific";
  simplexTxMin?: number;
  simplexTxMax?: number;
  simplexWalkieMin?: number;
  simplexWalkieMax?: number;
  customBw?: number;
  talkbackStrategy?: "zone-wide" | "subzones";
  subzones?: TalkbackSubzoneConfig[];
}

interface ZonalTalkbackTabProps {
  numZones: number;
  setNumZones: (num: number) => void;
  zoneConfigs: ZoneConfig[];
  setZoneConfigs: (configs: ZoneConfig[]) => void;
  distances: number[][];
  setDistances: (distances: number[][]) => void;
  siteMapState: SiteMapState;
  compatibilityMatrix: boolean[][];
  setCompatibilityMatrix: React.Dispatch<React.SetStateAction<boolean[][]>>;
  results: ZonalResult[] | null;
  setResults: React.Dispatch<React.SetStateAction<ZonalResult[] | null>>;
  zonalManualPairs: any[];
  setZonalManualPairs: React.Dispatch<React.SetStateAction<any[]>>;
  zonalZoneConfigs: any[];
  setZonalZoneConfigs: React.Dispatch<React.SetStateAction<any[]>>;
  user?: any;
}

const zonalTalkbackCache: Record<string, any> = {};

function useCachedState<T>(key: string, initialValue: T | (() => T)): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    if (zonalTalkbackCache[key] !== undefined) return zonalTalkbackCache[key];
    return typeof initialValue === "function" ? (initialValue as any)() : initialValue;
  });
  useEffect(() => {
    zonalTalkbackCache[key] = state;
  }, [key, state]);
  return [state, setState];
}

const ZonalTalkbackTab: React.FC<ZonalTalkbackTabProps> = ({
  numZones,
  setNumZones,
  zoneConfigs: appZoneConfigs,
  setZoneConfigs,
  distances,
  setDistances,
  siteMapState,
  compatibilityMatrix,
  setCompatibilityMatrix,
  results,
  setResults,
  zonalManualPairs: manualPairs = [],
  setZonalManualPairs: setManualPairs,
  zonalZoneConfigs: talkbackZoneConfigs = [],
  setZonalZoneConfigs: setTalkbackZoneConfigs,
  user,
}) => {
  const [mode, setMode] = useCachedState<TalkbackMode>("mode", "standard");
  const [selectedCountry, setSelectedCountry] = useCachedState<string>("selectedCountry", "UK");
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [sortField, setSortField] = useCachedState<string>("sortField", "tx");
  const [sortDirection, setSortDirection] = useCachedState<"asc" | "desc">("sortDirection", "asc");
  const [bulkAddCount, setBulkAddCount] = useState(0);
  const [bulkAddZone, setBulkAddZone] = useState(-1);
  const [numZonesInput, setNumZonesInput] = useState(numZones.toString());
  const [globalDistInput, setGlobalDistInput] = useCachedState<string>("globalDistInput", "50");
  const [showLivePreview, setShowLivePreview] = useCachedState("showLivePreview", false);
  const [showMatrixAndLinks, setShowMatrixAndLinks] = useCachedState("showMatrixAndLinks", false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
      toast.info("Coordination cancelled");
    }
  };

  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  const baseBands = mode === "europe" ? EUROPE_BASE_BANDS : STANDARD_BASE_BANDS;
  const portBands = mode === "europe" ? EUROPE_PORT_BANDS : STANDARD_PORT_BANDS;

  const availableSimplexBaseBands =
    mode === "europe" ? EUROPE_SIMPLEX_BASE_BANDS : STANDARD_SIMPLEX_BASE_BANDS;
  const availableSimplexWalkieBands =
    mode === "europe"
      ? EUROPE_SIMPLEX_WALKIE_BANDS
      : STANDARD_SIMPLEX_WALKIE_BANDS;

  useEffect(() => {
    setNumZonesInput(numZones.toString());
  }, [numZones]);

  const handleNumZonesChange = (val: string) => {
    setNumZonesInput(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 20) setNumZones(parsed);
  };

  const handleApplyGlobalDistance = () => {
    const val = parseInt(globalDistInput, 10);
    if (isNaN(val)) return;
    const next = distances.map((row, rIdx) =>
      row.map((col, cIdx) => (rIdx === cIdx ? 0 : val)),
    );
    setDistances(next);
  };

  const handleDistanceMatrixChange = (
    row: number,
    col: number,
    value: string,
  ) => {
    const next = distances.map((r) => [...r]);
    const val = parseInt(value, 10) || 0;
    next[row][col] = val;
    if (row !== col) next[col][row] = val;
    setDistances(next);
  };

  const handleMatrixChange = (row: number, col: number) => {
    const next = compatibilityMatrix.map((r) => [...r]);
    next[row][col] = !next[row][col];
    if (row !== col) next[col][row] = next[row][col];
    setCompatibilityMatrix(next);
  };

  const yieldBreakdown = useMemo(() => {
    if (!results) return null;
    let duplex = 0;
    let simplexTx = 0;
    let simplexWalkie = 0;
    results.forEach((z) => {
      z.pairs.forEach((p) => {
        if (p.tx > 0 && p.rx > 0) duplex++;
        else if (p.tx > 0 && p.rx === 0) simplexTx++;
        else if (p.tx === 0 && p.rx > 0) simplexWalkie++;
      });
    });
    return { duplex, simplexTx, simplexWalkie };
  }, [results]);

  const totalTarget = useMemo(() => {
    return talkbackZoneConfigs.reduce((sum, c) => {
      if (c.talkbackStrategy === "subzones" && c.subzones) {
        return (
          sum +
          c.subzones.reduce(
            (szSum, sz) =>
              szSum +
              sz.pairCount +
              (sz.customPairCount || 0) +
              (sz.simplexTxCount || 0) +
              (sz.simplexWalkieCount || 0) +
              (sz.customSimplexTxCount || 0) +
              (sz.customSimplexWalkieCount || 0),
            0,
          ) +
          (c.pairCount || 0) +
          (c.customPairCount || 0) +
          (c.simplexTxCount || 0) +
          (c.simplexWalkieCount || 0) +
          (c.customSimplexTxCount || 0) +
          (c.customSimplexWalkieCount || 0)
        );
      }
      return (
        sum +
        (c.pairCount || 0) +
        (c.customPairCount || 0) +
        (c.simplexTxCount || 0) +
        (c.simplexWalkieCount || 0) +
        (c.customSimplexTxCount || 0) +
        (c.customSimplexWalkieCount || 0)
      );
    }, 0);
  }, [talkbackZoneConfigs]);

  const totalYield =
    (yieldBreakdown?.duplex || 0) +
    (yieldBreakdown?.simplexTx || 0) +
    (yieldBreakdown?.simplexWalkie || 0);

  const handleSort = (field: string) => {
    if (sortField === field)
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const SortArrow = ({ field }: { field: string }) => {
    if (sortField !== field)
      return <span className="ml-1 text-slate-500">↕</span>;
    return (
      <span className="ml-1 text-amber-400 font-black">
        {sortDirection === "asc" ? "▲" : "▼"}
      </span>
    );
  };

  const [range, setRange] = useCachedState("range", { min: 429.8, max: 484.8 });
  const [centerFreqInput, setCenterFreqInput] = useCachedState<string>("centerFreqInput", "457.3000");
  const [centerStepMhz, setCenterStepMhz] = useCachedState("centerStepMhz", "1.0");
  const [spanIncrementMhz, setSpanIncrementMhz] = useCachedState("spanIncrementMhz", "5.0");
  const [showTwoTone, setShowTwoTone] = useCachedState("showTwoTone", true);
  const [showThreeTone, setShowThreeTone] = useCachedState("showThreeTone", true);
  const [showTooltips, setShowTooltips] = useCachedState("showTooltips", true);
  const [showGrid, setShowGrid] = useCachedState("showGrid", true);
  const [fillSpikes, setFillSpikes] = useCachedState("fillSpikes", false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [interactionMode, setInteractionMode] = useState<"pan" | "exclude">("pan");
  const [dragMode, setDragMode] = useState<"pan" | "exclude">("pan");
  const [dragState, setDragState] = useState<{
    startX: number;
    startMin: number;
    startMax: number;
    startFreq: number;
  } | null>(null);
  const [currentExclusion, setCurrentExclusion] = useState<{ min: number; max: number } | null>(null);
  const [manualExclusions, setManualExclusions] = useCachedState<string>("zonalTalkbackManualExclusions", "");

  const parsedExclusions = useMemo(() => {
    return manualExclusions
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const parts = s.split(/[-–]/).map((p) => parseFloat(p.trim()));
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
    setManualExclusions((prev) =>
      prev && prev.trim() ? `${prev.trim()}, ${newRange}` : newRange,
    );
  };

  const handleExclusionZoneRemove = (index: number) => {
    const updatedZones = parsedExclusions.filter((_, i) => i !== index);
    setManualExclusions(updatedZones.map((z) => `${z.min.toFixed(3)}-${z.max.toFixed(3)}`).join(", "));
  };

  const [mouseCoord, setMouseCoord] = useState<{
    clientX: number;
    clientY: number;
    internalX: number;
  } | null>(null);
  const [measurementPoints, setMeasurementPoints] = useState<number[]>([]);
  const [isDeltaMode, setIsDeltaMode] = useCachedState<boolean>("isDeltaMode", false);
  const [showTable, setShowTable] = useCachedState("showTable", false);
  const [customBaseRange, setCustomBaseRange] = useCachedState("customBaseRange", {
    min: 450,
    max: 464,
  });
  const [customSwRange, setCustomSwRange] = useCachedState("customSwRange", { min: 464, max: 470 });

  // Auditor State Tracking
  const isCenterFreqFocused = useRef(false);

  useEffect(() => {
    if (!isCenterFreqFocused.current) {
      setCenterFreqInput(((range.min + range.max) / 2).toFixed(4));
    }
  }, [range]);

  // Audit State
  const [diagnosticConflicts, setDiagnosticConflicts] = useState<Conflict[]>(
    [],
  );
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  const totalGenerated = useMemo(
    () =>
      results ? results.reduce((sum, z) => sum + (z.pairs?.length || 0), 0) : 0,
    [results],
  );
  const totalRequired = useMemo(
    () =>
      talkbackZoneConfigs.reduce((sum, c) => {
        if (c.talkbackStrategy === "subzones" && c.subzones) {
          return (
            sum + c.subzones.reduce((szSum, sz) => szSum + sz.pairCount, 0)
          );
        }
        return sum + c.pairCount;
      }, 0),
    [talkbackZoneConfigs],
  );

  useEffect(() => {
    setTalkbackZoneConfigs((currentConfigs) => {
      const newConfigs: ZonalTalkbackZoneConfig[] = [];
      for (let i = 0; i < numZones; i++) {
        const appConfig = appZoneConfigs[i];
        if (!appConfig) continue;
        const existingConfig =
          currentConfigs[i] ||
          currentConfigs.find((c) => c.name === appConfig.name);
        newConfigs.push({
          name: appConfig.name,
          pairCount: existingConfig?.pairCount ?? 0,
          txBands: existingConfig?.txBands ?? new Set<number>(),
          rxBands: existingConfig?.rxBands ?? new Set<number>(),
          simplexTxBands: existingConfig?.simplexTxBands ?? new Set<number>(),
          simplexWalkieBands:
            existingConfig?.simplexWalkieBands ?? new Set<number>(),
          simplexTxCount: existingConfig?.simplexTxCount ?? 0,
          simplexWalkieCount: existingConfig?.simplexWalkieCount ?? 0,
          customSimplexTxCount: existingConfig?.customSimplexTxCount ?? 0,
          customSimplexWalkieCount:
            existingConfig?.customSimplexWalkieCount ?? 0,
          simplexTxBw: existingConfig?.simplexTxBw ?? 0.0125,
          simplexWalkieBw: existingConfig?.simplexWalkieBw ?? 0.0125,
          generationPriority: existingConfig?.generationPriority ?? [
            "duplex",
            "simplexTx",
            "simplexWalkie",
          ],
          duplexCustomMode: existingConfig?.duplexCustomMode ?? "standard",
          simplexCustomMode: existingConfig?.simplexCustomMode ?? "standard",
          customTxMin: existingConfig?.customTxMin ?? 414,
          customTxMax: existingConfig?.customTxMax ?? 415,
          customRxMin: existingConfig?.customRxMin ?? 424,
          customRxMax: existingConfig?.customRxMax ?? 425,
          targetSeparation: existingConfig?.targetSeparation ?? 10.0,
          exactSeparation: existingConfig?.exactSeparation ?? false,
          useTargetSeparation: existingConfig?.useTargetSeparation ?? false,
          simplexTxMin: existingConfig?.simplexTxMin ?? 450,
          simplexTxMax: existingConfig?.simplexTxMax ?? 451,
          simplexWalkieMin: existingConfig?.simplexWalkieMin ?? 469,
          simplexWalkieMax: existingConfig?.simplexWalkieMax ?? 470,
          customBw: existingConfig?.customBw ?? 0.0125,
          customTargetMode: existingConfig?.customTargetMode ?? "global",
          talkbackStrategy: existingConfig?.talkbackStrategy ?? "zone-wide",
          subzones: existingConfig?.subzones ?? [],
        });
      }
      return newConfigs;
    });
  }, [numZones, appZoneConfigs]);

  const addManualPair = () =>
    setManualPairs((p) => [
      ...p,
      {
        id: `man-${Date.now()}-${Math.random()}`,
        label: `Manual ${p.length + 1}`,
        tx: 0,
        rx: 0,
        groupName: "Manual",
        locked: false,
        active: true,
        txBw: 0.0125,
        rxBw: 0.0125,
        zoneIndex: -1,
      } as DuplexPairWithBw,
    ]);

  const handleBulkAddManualPairs = () => {
    const count = Math.max(1, Math.min(50, bulkAddCount));
    const newBatch: DuplexPairWithBw[] = Array.from(
      { length: count },
      (_, i) => ({
        id: `man-${Date.now()}-${i}-${Math.random()}`,
        label: `Manual ${manualPairs.length + i + 1}`,
        tx: 0,
        rx: 0,
        groupName: "Manual",
        locked: false,
        active: true,
        txBw: 0.0125,
        rxBw: 0.0125,
        zoneIndex: bulkAddZone,
      }),
    );
    setManualPairs((p) => [...p, ...newBatch]);
  };

  const removeManualPair = (id: string) =>
    setManualPairs((p) => p.filter((pair) => pair.id !== id));

  const updateManualPair = (id: string, field: string, value: any) => {
    setManualPairs((p) =>
      p.map((pair) => {
        if (pair.id === id) {
          const isNumeric =
            (field === "tx" ||
              field === "rx" ||
              field === "txBw" ||
              field === "rxBw" ||
              field === "zoneIndex") &&
            typeof value !== "boolean";
          const numVal = isNumeric
            ? (parseFloat(value) ?? (field === "zoneIndex" ? -1 : 0))
            : value;
          return { ...pair, [field]: numVal };
        }
        return pair;
      }),
    );
  };

  const handleToggleBase = (
    zoneIdx: number,
    pairId: string,
    field: "txIsBase" | "rxIsBase",
  ) => {
    setResults((prev) =>
      prev
        ? prev.map((z, idx) =>
            idx === zoneIdx
              ? {
                  ...z,
                  pairs: z.pairs.map((p) =>
                    p.id === pairId ? { ...p, [field]: !p[field] } : p,
                  ),
                }
              : z,
          )
        : null,
    );
  };

  const handleResultFrequencyChange = (
    zoneIdx: number,
    pairId: string,
    field: "tx" | "rx",
    value: string,
  ) => {
    const numVal = parseFloat(value) || 0;
    setResults((prev) =>
      prev
        ? prev.map((z, idx) =>
            idx === zoneIdx
              ? {
                  ...z,
                  pairs: z.pairs.map((p) =>
                    p.id === pairId ? { ...p, [field]: numVal } : p,
                  ),
                }
              : z,
          )
        : null,
    );
  };

  const handleFrequencyStep = (
    pairId: string,
    field: "tx" | "rx",
    direction: "up" | "down",
  ) => {
    const step = 0.00625;
    const updateLogic = (pairs: any[]): any[] =>
      pairs.map((p) =>
        p.id === pairId
          ? {
              ...p,
              [field]: parseFloat(
                ((p[field] || 0) + (direction === "up" ? step : -step)).toFixed(
                  5,
                ),
              ),
            }
          : p,
      );
    if (manualPairs.some((p) => p.id === pairId)) setManualPairs(updateLogic);
    else
      setResults((current) =>
        current
          ? current.map((z) => ({ ...z, pairs: updateLogic(z.pairs) }))
          : null,
      );
  };

  const handleConfigureZone = (
    zIdx: number,
    updates: Partial<ZonalTalkbackZoneConfig>,
  ) => {
    setTalkbackZoneConfigs((prev) =>
      prev.map((cfg, i) => (i === zIdx ? { ...cfg, ...updates } : cfg)),
    );
    if (updates.name !== undefined) {
      setZoneConfigs(
        appZoneConfigs.map((cfg, i) =>
          i === zIdx ? { ...cfg, name: updates.name! } : cfg,
        ),
      );
    }
  };

  const handleCalculate = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsLoading(true);
    setProgress(0);
    await new Promise((resolve) => setTimeout(resolve, 50));

    const serviceConfigs: any[] = [];
    const virtualDistances: number[][] = [];
    const virtualMatrix: boolean[][] = [];
    const virtualMapping: {
      parentIdx: number;
      subIdx?: number;
      isSubzone: boolean;
      subzoneName?: string;
    }[] = [];

    talkbackZoneConfigs.forEach((c, parentIdx) => {
      const baseConfig = {
        name: c.name,
        txBands: Array.from(c.txBands),
        rxBands: Array.from(c.rxBands),
        simplexTxBands: Array.from(c.simplexTxBands || []),
        simplexWalkieBands: Array.from(c.simplexWalkieBands || []),
        simplexTxBw: c.simplexTxBw || 0.0125,
        simplexWalkieBw: c.simplexWalkieBw || 0.0125,
        generationPriority: c.generationPriority,
        duplexCustomMode: c.duplexCustomMode || "standard",
        simplexCustomMode: c.simplexCustomMode || "standard",
        customTxMin: c.customTxMin,
        customTxMax: c.customTxMax,
        customRxMin: c.customRxMin,
        customRxMax: c.customRxMax,
        customRanges: c.customRanges,
        customTargetMode: c.customTargetMode,
        targetSeparation: c.targetSeparation,
        exactSeparation: c.exactSeparation,
        useTargetSeparation: c.useTargetSeparation,
        simplexTxMin: c.simplexTxMin,
        simplexTxMax: c.simplexTxMax,
        simplexWalkieMin: c.simplexWalkieMin,
        simplexWalkieMax: c.simplexWalkieMax,
        customBw: c.customBw,
      };

      if (
        c.talkbackStrategy === "subzones" &&
        c.subzones &&
        c.subzones.length > 0
      ) {
        if (c.pairCount > 0 || (c.customPairCount && c.customPairCount > 0) || c.simplexTxCount > 0 || c.simplexWalkieCount > 0 || (c.customSimplexTxCount && c.customSimplexTxCount > 0) || (c.customSimplexWalkieCount && c.customSimplexWalkieCount > 0)) {
          serviceConfigs.push({
            ...baseConfig,
            pairCount: c.pairCount,
            customPairCount: c.customPairCount || 0,
            simplexTxCount: c.simplexTxCount || 0,
            simplexWalkieCount: c.simplexWalkieCount || 0,
            customSimplexTxCount: c.customSimplexTxCount || 0,
            customSimplexWalkieCount: c.customSimplexWalkieCount || 0,
          });
          virtualMapping.push({ parentIdx, isSubzone: false });
        }
        c.subzones.forEach((sz, subIdx) => {
          serviceConfigs.push({
            ...baseConfig,
            name: `${c.name} - ${sz.name}`,
            pairCount: sz.pairCount,
            customPairCount: sz.customPairCount || 0,
            simplexTxCount: sz.simplexTxCount || 0,
            simplexWalkieCount: sz.simplexWalkieCount || 0,
            customSimplexTxCount: sz.customSimplexTxCount || 0,
            customSimplexWalkieCount: sz.customSimplexWalkieCount || 0,
          });
          virtualMapping.push({
            parentIdx,
            subIdx,
            isSubzone: true,
            subzoneName: sz.name,
          });
        });
      } else {
        serviceConfigs.push({
          ...baseConfig,
          pairCount: c.pairCount,
          customPairCount: c.customPairCount || 0,
          simplexTxCount: c.simplexTxCount || 0,
          simplexWalkieCount: c.simplexWalkieCount || 0,
          customSimplexTxCount: c.customSimplexTxCount || 0,
          customSimplexWalkieCount: c.customSimplexWalkieCount || 0,
        });
        virtualMapping.push({ parentIdx, isSubzone: false });
      }
    });

    // Expand distances and matrix
    for (let i = 0; i < virtualMapping.length; i++) {
      virtualDistances[i] = [];
      virtualMatrix[i] = [];
      for (let j = 0; j < virtualMapping.length; j++) {
        const m1 = virtualMapping[i];
        const m2 = virtualMapping[j];

        if (m1.parentIdx === m2.parentIdx) {
          if (m1.isSubzone && m2.isSubzone && m1.subIdx !== m2.subIdx) {
            // Different subzones of the same parent do NOT interact
            virtualDistances[i][j] = 100;
            virtualMatrix[i][j] = false;
          } else {
            // Same physical zone, or same subzone
            virtualDistances[i][j] = 0;
            virtualMatrix[i][j] = false;
          }
        } else {
          virtualDistances[i][j] =
            distances[m1.parentIdx]?.[m2.parentIdx] ?? 100;
          virtualMatrix[i][j] =
            compatibilityMatrix[m1.parentIdx]?.[m2.parentIdx] ?? false;
        }
      }
    }

    // Remap previousResults and manualPairs to match virtual indices for the RF service
    const virtualManualPairs = manualPairs.map((p) => {
      if (p.zoneIndex === undefined || p.zoneIndex === -1) return p;
      const virtualIdx = virtualMapping.findIndex(
        (m) => m.parentIdx === p.zoneIndex,
      );
      return { ...p, zoneIndex: virtualIdx >= 0 ? virtualIdx : p.zoneIndex };
    });

    const virtualPreviousResults = virtualMapping.map((m, i) => {
      const parentRes = results?.[m.parentIdx];
      if (!parentRes) return { zoneName: serviceConfigs[i].name, pairs: [] };

      // If it's a subzone, we filter the parent pairs to ONLY include those that match the subzone groupName
      const filteredPairs = parentRes.pairs.filter((p) =>
        m.isSubzone ? p.groupName === m.subzoneName : true,
      );
      return { zoneName: serviceConfigs[i].name, pairs: filteredPairs };
    });

    try {
      const zonalResults = await generateZonalTalkbackPairs(
        serviceConfigs,
        0.0125, // 12.5kHz spacing for standard talkback channels
        virtualDistances,
        virtualMatrix,
        virtualPreviousResults,
        virtualManualPairs,
        (p) => setProgress(p),
        mode,
        selectedCountry,
        customBaseRange,
        abortController.signal,
        parsedExclusions
      );

      // Compress results back to physical zones
      const finalResults: ZonalResult[] = talkbackZoneConfigs.map((c) => ({
        zoneName: c.name,
        pairs: [],
        failedCount: 0,
      }));

      zonalResults.forEach((res, virtIdx) => {
        const m = virtualMapping[virtIdx];
        const resPairs = res.pairs.map((p) => ({
          ...p,
          groupName: m.isSubzone
            ? p.groupName.includes("(Custom)") ? `${m.subzoneName} (Custom)` : m.subzoneName
            : p.groupName.includes("(Custom)") ? `${talkbackZoneConfigs[m.parentIdx].name} (Custom)` : talkbackZoneConfigs[m.parentIdx].name,
        }));

        finalResults[m.parentIdx].pairs.push(...resPairs);
        finalResults[m.parentIdx].failedCount += res.failedCount || 0;
      });

      setResults(finalResults);
      setShowSuccess(true);
    } catch (error: any) {
      if (error.message === "Calculation aborted by user" || error.message === 'AbortError') {
        console.log("Calculation aborted");
      } else if (error.message && error.message.startsWith('TimeoutError')) {
        toast.error(error.message);
      } else {
        console.error(error);
        toast.error("Error in zonal calculation.");
      }
    } finally {
      setIsLoading(false);
      setProgress(1);
      abortControllerRef.current = null;
    }
  };

  const handleLockToggle = (zoneIdx: number, pairId: string) => {
    setResults((prev) =>
      prev
        ? prev.map((z, idx) =>
            idx === zoneIdx
              ? {
                  ...z,
                  pairs: z.pairs.map((p) =>
                    p.id === pairId ? { ...p, locked: !p.locked } : p,
                  ),
                }
              : z,
          )
        : null,
    );
  };

  const handleActiveToggle = (zoneIdx: number, pairId: string) => {
    setResults((prev) =>
      prev
        ? prev.map((z, idx) =>
            idx === zoneIdx
              ? {
                  ...z,
                  pairs: z.pairs.map((p) => {
                    if (p.id === pairId)
                      return { ...p, active: p.active === false };
                    return p;
                  }),
                }
              : z,
          )
        : null,
    );
  };

  const handleRemoveResult = (zoneIdx: number, pairId: string) => {
    setResults((prev) =>
      prev
        ? prev.map((z, idx) =>
            idx === zoneIdx
              ? { ...z, pairs: z.pairs.filter((p) => p.id !== pairId) }
              : z,
          )
        : null,
    );
  };

  const handleZoneActiveToggle = (zoneIdx: number) => {
    if (!results) return;
    const targetZone = results[zoneIdx];
    const zoneManual = manualPairs.filter((p) => p.zoneIndex === zoneIdx);
    const currentlyActive =
      targetZone.pairs.some((p) => p.active !== false) ||
      zoneManual.some((p) => p.active !== false);
    const nextState = !currentlyActive;
    setResults((prev) =>
      prev
        ? prev.map((z, idx) =>
            idx === zoneIdx
              ? {
                  ...z,
                  pairs: z.pairs.map((p) => ({ ...p, active: nextState })),
                }
              : z,
          )
        : null,
    );
    setManualPairs((prev) =>
      prev.map((p) =>
        p.zoneIndex === zoneIdx ? { ...p, active: nextState } : p,
      ),
    );
  };

  const handleZoneLockAllToggle = (zoneIdx: number) => {
    if (!results) return;
    const targetZone = results[zoneIdx];
    const anyUnlocked = targetZone.pairs.some((p) => !p.locked);
    const nextState = anyUnlocked;
    setResults((prev) =>
      prev
        ? prev.map((z, idx) =>
            idx === zoneIdx
              ? {
                  ...z,
                  pairs: z.pairs.map((p) => ({ ...p, locked: nextState })),
                }
              : z,
          )
        : null,
    );
  };

  const allActiveCarriers = useMemo(() => {
    const carriers: {
      value: number;
      label: string;
      type: "tx" | "rx";
      zoneName: string;
      bw: number;
      zoneIndex: number;
      isTx?: boolean;
    }[] = [];
    manualPairs.forEach((p, idx) => {
      if (p.active === false) return;
      const zoneName =
        p.zoneIndex !== undefined &&
        p.zoneIndex !== -1 &&
        talkbackZoneConfigs[p.zoneIndex]
          ? talkbackZoneConfigs[p.zoneIndex].name.toUpperCase()
          : "SITE-WIDE";

      let txIsBase = p.txIsBase;
      let rxIsBase = p.rxIsBase;

      if (txIsBase === undefined) {
        if (mode === "custom") {
          txIsBase = p.tx >= customBaseRange.min && p.tx <= customBaseRange.max;
        } else if (mode === "europe") {
          txIsBase = p.tx > 464;
        } else {
          txIsBase = p.tx < 464;
        }
      }
      if (rxIsBase === undefined) {
        if (mode === "custom") {
          rxIsBase = p.rx >= customBaseRange.min && p.rx <= customBaseRange.max;
        } else {
          rxIsBase = false;
        }
      }

      if (p.tx > 0)
        carriers.push({
          value: p.tx,
          label: `M${idx + 1}T`,
          type: "tx",
          zoneName,
          bw: p.txBw || 0.0125,
          zoneIndex: p.zoneIndex ?? -1,
          isTx: p.rx === 0 ? true : txIsBase,
        });
      if (p.rx > 0)
        carriers.push({
          value: p.rx,
          label: `M${idx + 1}R`,
          type: "rx",
          zoneName,
          bw: p.rxBw || 0.0125,
          zoneIndex: p.zoneIndex ?? -1,
          isTx: p.tx === 0 ? false : rxIsBase,
        });
    });
    if (results) {
      results.forEach((z, zIdx) => {
        z.pairs.forEach((p, pIdx) => {
          if (p.active === false) return;

          let txIsBase = p.txIsBase;
          let rxIsBase = p.rxIsBase;

          if (txIsBase === undefined) {
            if (mode === "custom") {
              txIsBase = p.tx >= customBaseRange.min && p.tx <= customBaseRange.max;
            } else if (mode === "europe") {
              txIsBase = p.tx > 464;
            } else {
              txIsBase = p.tx < 464;
            }
          }
          if (rxIsBase === undefined) {
            if (mode === "custom") {
              rxIsBase = p.rx >= customBaseRange.min && p.rx <= customBaseRange.max;
            } else {
              rxIsBase = false;
            }
          }

          if (p.tx > 0)
            carriers.push({
              value: p.tx,
              label: `Z${zIdx + 1}P${pIdx + 1}T`,
              type: "tx",
              zoneName: z.zoneName,
              bw: p.txBw || 0.0125,
              zoneIndex: zIdx,
              isTx: p.rx === 0 ? true : txIsBase,
            });
          if (p.rx > 0)
            carriers.push({
              value: p.rx,
              label: `Z${zIdx + 1}P${pIdx + 1}R`,
              type: "rx",
              zoneName: z.zoneName,
              bw: p.rxBw || 0.0125,
              zoneIndex: zIdx,
              isTx: p.tx === 0 ? false : rxIsBase,
            });
        });
      });
    }
    return carriers;
  }, [results, manualPairs, talkbackZoneConfigs, mode, customBaseRange]);

  const handleRunAudit = () => {
    const freqList: Frequency[] = allActiveCarriers.map((c) => ({
      id: c.label,
      value: c.value,
      type: "comms" as TxType,
      zoneIndex: c.zoneIndex,
      isTx: c.isTx,
    }));
    const result = checkTalkbackCompatibility(
      freqList,
      distances,
      compatibilityMatrix,
      mode,
      selectedCountry,
      customBaseRange,
    );
    setDiagnosticConflicts(result.conflicts);
    setHasAnalyzed(true);
  };

  const [intermods, setIntermods] = useState<{
    twoTone: Array<any>;
    threeTone: Array<any>;
    fiveTone: Array<any>;
    sevenTone: Array<any>;
  }>({ twoTone: [], threeTone: [], fiveTone: [], sevenTone: [] });

  useEffect(() => {
    let isCancelled = false;

    const baseCarriers = allActiveCarriers
      .filter((c) => {
        if (c.isTx !== undefined) return c.isTx;
        if (c.type === "tx") return true;
        if (c.type === "rx") return false;

        if (mode === "custom") {
          return (
            c.value >= customBaseRange.min && c.value <= customBaseRange.max
          );
        }
        if (mode === "europe") return c.value > 464;
        return c.value < 464;
      })
      .map((c) => ({ value: c.value, bw: c.bw }));

    setTimeout(() => {
      if (isCancelled) return;
      const result = calculateTalkbackIntermods(baseCarriers);
      setIntermods(result);
    }, 0);

    return () => {
      isCancelled = true;
    };
  }, [allActiveCarriers, mode, customBaseRange]);

  const handleScroll = (direction: "left" | "right") => {
    const step = parseFloat(centerStepMhz) || 1.0;
    const shift = direction === "left" ? -step : step;
    setRange((r) => ({ min: r.min + shift, max: r.max + shift }));
  };

  const handleSpanChange = (direction: "increase" | "decrease") => {
    const spanStep = parseFloat(spanIncrementMhz) || 1.0;
    const currentSpan = range.max - range.min;
    let newSpan =
      direction === "decrease"
        ? Math.max(0.1, currentSpan - spanStep)
        : currentSpan + spanStep;
    const centerFreqVal = (range.min + range.max) / 2;
    setRange({
      min: parseFloat((centerFreqVal - newSpan / 2).toFixed(5)),
      max: parseFloat((centerFreqVal + newSpan / 2).toFixed(5)),
    });
  };

  const handleCenterStepSizeChange = (direction: "up" | "down") => {
    const current = parseFloat(centerStepMhz) || 1.0;
    const step = current >= 10 ? 5.0 : current >= 1 ? 1.0 : 0.1;
    const next =
      direction === "up" ? current + step : Math.max(0.1, current - step);
    setCenterStepMhz(next.toFixed(1));
  };

  const handleSpanStepSizeChange = (direction: "up" | "down") => {
    const current = parseFloat(spanIncrementMhz) || 1.0;
    const step = current >= 10 ? 5.0 : current >= 1 ? 1.0 : 0.1;
    const next =
      direction === "up" ? current + step : Math.max(0.1, current - step);
    setSpanIncrementMhz(next.toFixed(1));
  };

  const applyCenterFreq = (value: string) => {
    const newCenter = parseFloat(value);
    if (!isNaN(newCenter)) {
      const currentSpan = range.max - range.min;
      setRange({
        min: parseFloat((newCenter - currentSpan / 2).toFixed(5)),
        max: parseFloat((newCenter + currentSpan / 2).toFixed(5)),
      });
    } else setCenterFreqInput(((range.min + range.max) / 2).toFixed(4));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const padding = { top: 50, right: 20, bottom: 40, left: 50 };
    const chartWidth = canvas.width - padding.left - padding.right;
    const scaleX = canvas.width / rect.width;
    const internalX = (e.clientX - rect.left) * scaleX;
    const mouseFreq = range.min + ((internalX - padding.left) / chartWidth) * (range.max - range.min);

    setIsDragging(true);
    const mode = (e.shiftKey || interactionMode === "exclude") ? "exclude" : "pan";
    setDragMode(mode);
    setDragState({
      startX: e.clientX,
      startMin: range.min,
      startMax: range.max,
      startFreq: mouseFreq,
    });
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDragging || !dragState || !canvasRef.current) {
      handlePointerHover(e);
      return;
    }
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const padding = { top: 50, right: 20, bottom: 40, left: 50 };
    const chartWidth = canvas.width - padding.left - padding.right;
    const scaleX = canvas.width / rect.width;
    const internalX = (e.clientX - rect.left) * scaleX;
    const currentFreq = range.min + ((internalX - padding.left) / chartWidth) * (range.max - range.min);

    if (dragMode === "exclude") {
      setCurrentExclusion({
        min: Math.min(dragState.startFreq, currentFreq),
        max: Math.max(dragState.startFreq, currentFreq),
      });
    } else {
      const deltaX = e.clientX - dragState.startX;
      const span = dragState.startMax - dragState.startMin;
      const freqShift = (deltaX / rect.width) * span;
      setRange({
        min: parseFloat((dragState.startMin - freqShift).toFixed(5)),
        max: parseFloat((dragState.startMax - freqShift).toFixed(5)),
      });
    }
    setMouseCoord(null);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragMode === "exclude" && currentExclusion) {
      handleExclusionZoneAdd(currentExclusion.min, currentExclusion.max);
    }
    setIsDragging(false);
    if (dragMode !== "exclude" && dragState && Math.abs(e.clientX - dragState.startX) < 5) {
      if (isDeltaMode) {
        const canvas = canvasRef.current;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          const scaleX = canvas.width / rect.width;
          const internalX = (e.clientX - rect.left) * scaleX;
          const padding = { top: 50, right: 20, bottom: 40, left: 50 };
          const chartWidth = canvas.width - padding.left - padding.right;

          if (internalX >= padding.left && internalX <= padding.left + chartWidth) {
            const freqRange = range.max - range.min;
            const hitFreq = range.min + ((internalX - padding.left) / chartWidth) * freqRange;
            const hitThreshold = (18 / chartWidth) * freqRange;

            let bestHit: number | null = null;
            let bestDist = hitThreshold;

            const checkHits = (arr: { value: number }[]) => {
              for (const item of arr) {
                const d = Math.abs(item.value - hitFreq);
                if (d < bestDist) {
                  bestDist = d;
                  bestHit = item.value;
                }
              }
            };

            checkHits(allActiveCarriers);
            if (showTwoTone) checkHits(intermods.twoTone);
            if (showThreeTone) checkHits(intermods.threeTone);

            if (bestHit !== null) {
              setMeasurementPoints((prev) => {
                if (prev.includes(bestHit!)) return prev.filter((v) => v !== bestHit);
                if (prev.length >= 2) return [prev[1], bestHit!];
                return [...prev, bestHit!];
              });
            } else {
              setMeasurementPoints([]);
            }
          } else {
            setMeasurementPoints([]);
          }
        }
      }
    }
    setDragState(null);
    setCurrentExclusion(null);
    (e.target as Element).releasePointerCapture(e.pointerId);
  };

  const handlePointerHover = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const internalX = (e.clientX - rect.left) * scaleX;
    setMouseCoord({ clientX: e.clientX, clientY: e.clientY, internalX });
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!canvasRef.current) return;
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
    const currentSpan = range.max - range.min;
    const newSpan = currentSpan * zoomFactor;
    const center = (range.min + range.max) / 2;
    setRange({
      min: parseFloat((center - newSpan / 2).toFixed(5)),
      max: parseFloat((center + newSpan / 2).toFixed(5)),
    });
  };

  const activeHit = useMemo(() => {
    if (!mouseCoord || !canvasRef.current || isDragging) return null;
    const { internalX } = mouseCoord;
    const padding = { top: 50, right: 20, bottom: 40, left: 50 };
    const chartWidth = canvasRef.current.width - padding.left - padding.right;
    if (internalX < padding.left || internalX > padding.left + chartWidth)
      return null;
    const freqRange = range.max - range.min;
    const mouseFreq =
      range.min + ((internalX - padding.left) / chartWidth) * freqRange;
    const hitThreshold = (18 / chartWidth) * freqRange;

    const forbiddenRanges =
      TALKBACK_FORBIDDEN_RANGES_BY_COUNTRY[selectedCountry] || [];
    for (const fz of forbiddenRanges) {
      // Bypass 450-453 MHz AND 465-467 MHz forbidden zones in Mainland Europe mode
      if (mode === "europe") {
        const is450Range = fz.min >= 450 && fz.max <= 453;
        const is465Range = fz.min >= 465 && fz.max <= 467;
        if (is450Range || is465Range) continue;
      }
      if (mouseFreq >= fz.min - 0.000005 && mouseFreq <= fz.max + 0.000005)
        return {
          text: `REGULATORY BLOCKADE`,
          subtext: `Forbidden in ${selectedCountry}: ${fz.min.toFixed(5)}-${fz.max.toFixed(5)} MHz`,
          color: "#f87171",
        };
    }

    let closestCandidate: {
      text: string;
      subtext: string;
      color: string;
      value: number;
    } | null = null;
    let minDiff = Infinity;

    for (const c of allActiveCarriers) {
      const diff = Math.abs(mouseFreq - c.value);
      if (diff < hitThreshold && diff < minDiff) {
        minDiff = diff;
        closestCandidate = {
          text: `${c.label}: ${c.value.toFixed(5)} MHz`,
          subtext: `Zone: ${c.zoneName}`,
          color:
            c.type === "tx"
              ? INTERMOD_CONFIG.tx.color
              : INTERMOD_CONFIG.rx.color,
          value: c.value,
        };
      }
    }
    if (showTwoTone) {
      for (const im of intermods.twoTone) {
        const diff = Math.abs(mouseFreq - im.value);
        if (diff < hitThreshold && diff < minDiff) {
          minDiff = diff;
          closestCandidate = {
            text: `2-Tone IMD: ${im.value.toFixed(5)} MHz`,
            subtext: `Formula: 2*${im.sources[0].toFixed(3)} - ${im.sources[1].toFixed(3)}`,
            color: INTERMOD_CONFIG.twoTone.color,
            value: im.value,
          };
        }
      }
    }
    if (showThreeTone) {
      for (const im of intermods.threeTone) {
        const diff = Math.abs(mouseFreq - im.value);
        if (diff < hitThreshold && diff < minDiff) {
          minDiff = diff;
          closestCandidate = {
            text: `3-Tone IMD: ${im.value.toFixed(5)} MHz`,
            subtext: `Formula: ${im.sources[0].toFixed(3)} + ${im.sources[1].toFixed(3)} - ${im.sources[2].toFixed(3)}`,
            color: INTERMOD_CONFIG.threeTone.color,
            value: im.value,
          };
        }
      }
    }
    return closestCandidate;
  }, [
    mouseCoord,
    range,
    allActiveCarriers,
    intermods,
    showTwoTone,
    showThreeTone,
    isDragging,
    mode,
    selectedCountry,
  ]);

  const tabulatedData = useMemo(() => {
    const pairs: (DuplexPair & { zoneName: string })[] = [];

    manualPairs.forEach((p, idx) => {
      if (p.active === false) return;
      const zoneName =
        p.zoneIndex !== undefined &&
        p.zoneIndex !== -1 &&
        talkbackZoneConfigs[p.zoneIndex]
          ? talkbackZoneConfigs[p.zoneIndex].name.toUpperCase()
          : "SITE-WIDE";
      let type = "Duplex";
      if (p.tx > 0 && p.rx === 0) type = "Simplex Base Tx";
      else if (p.tx === 0 && p.rx > 0) type = "Simplex Walkie";
      pairs.push({
        id: p.id,
        tx: p.tx,
        rx: p.rx,
        label: `M${idx + 1}`,
        zoneName,
        bw: Math.max(p.txBw || 0, p.rxBw || 0) || 0.0125,
        type,
        groupName: p.groupName,
        locked: false,
      });
    });

    if (results) {
      results.forEach((z, zIdx) => {
        z.pairs.forEach((p, pIdx) => {
          if (p.active === false) return;
          let type = "Duplex";
          if (p.tx > 0 && p.rx === 0) type = "Simplex Base Tx";
          else if (p.tx === 0 && p.rx > 0) type = "Simplex Walkie";
          pairs.push({
            id: p.id,
            tx: p.tx,
            rx: p.rx,
            label: `Z${zIdx + 1}P${pIdx + 1}`,
            zoneName: z.zoneName,
            bw: 0.0125,
            type,
            groupName: p.groupName,
            locked: false,
          });
        });
      });
    }

    return pairs.sort((a: any, b: any) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (typeof valA === "string") valA = valA.toLowerCase();
      if (typeof valB === "string") valB = valB.toLowerCase();
      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [manualPairs, results, talkbackZoneConfigs, sortField, sortDirection]);

  const generatePdfForPreview = useCallback(
    (profile: "client-facing" | "internal-crew", clientDetails?: any) => {
      const doc = new jsPDF("p", "mm", "a4");
      const planData = tabulatedData.map((row) => {
        return {
          frequency: row.tx,
          rxFrequency: row.rx,
          label: row.label,
          equipment: row.type.includes("Simplex")
            ? "Simplex"
            : "Talkback Duplex",
          band: row.groupName || "Talkback",
          power:
            row.rx > 0 && row.tx > 0 ? "5W / 1W" : row.tx > 0 ? "5W" : "1W",
          bandwidth: `${(row.bw * 1000).toFixed(1)}kHz`,
          parameters: "FM",
          stage: row.zoneName,
          type: row.rx > 0 ? "comms-duplex" : "comms",
        };
      });

      return generateFullCoordinationPdf(
        doc,
        "Zonal Talkback RF Coordination Plan",
        planData,
        user?.branding,
        clientDetails,
        profile,
      );
    },
    [tabulatedData, user?.branding],
  );

  const generateInternalPdf = useCallback(
    () => generatePdfForPreview("internal-crew"),
    [generatePdfForPreview],
  );

  const handleExport = (format: "pdf" | "csv" | "xls" | "doc" | "txt") => {
    setIsExportMenuOpen(false);
    if (format === "pdf") {
      setIsPreviewModalOpen(true);
      return;
    }

    const data = tabulatedData;
    const filename = `zonal_talkback_rf_plan_${new Date().toISOString().slice(0, 10)}`;

    if (format === "csv" || format === "xls") {
      let content =
        "Base Tx (MHz),Portable Rx (MHz),Type,Assigned Zone,Bandwidth (kHz)\n";
      data.forEach(
        (c) =>
          (content += `${c.tx > 0 ? c.tx.toFixed(5) : "—"},${c.rx > 0 ? c.rx.toFixed(5) : "—"},${c.type},"${c.zoneName}",${(c.bw * 1000).toFixed(1)}\n`),
      );
      const blob = new Blob([content], {
        type: format === "xls" ? "application/vnd.ms-excel" : "text/csv",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.${format}`;
      a.click();
    }
  };

  useEffect(() => {
    const handleTrigger = () => {
      handleExport("pdf");
    };
    window.addEventListener("trigger-pdf-export", handleTrigger);
    return () =>
      window.removeEventListener("trigger-pdf-export", handleTrigger);
  }, [handleExport]);

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        if (!canvas) return;
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        setDimensions({
          width: canvas.offsetWidth,
          height: canvas.offsetHeight,
        });
      });
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const draw = () => {
      const { width, height } = canvas;
      const padding = { top: 50, right: 20, bottom: 40, left: 50 };
      const chartWidth = width - padding.left - padding.right;
      const chartHeight = height - padding.top - padding.bottom;
      const maxDb = 0,
        minDb = -100;
      if (chartWidth <= 0 || chartHeight <= 0) return;
      const freqToX = (f: number) =>
        padding.left + ((f - range.min) / (range.max - range.min)) * chartWidth;
      const ampToY = (amp: number) =>
        padding.top + chartHeight * (1 - (amp - minDb) / (maxDb - minDb));
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = INTERMOD_CONFIG.grid;
      ctx.lineWidth = 1;
      ctx.font = "10px monospace";
      ctx.fillStyle = INTERMOD_CONFIG.text;
      ctx.textAlign = "right";
      for (let i = 0; i <= 10; i++) {
        const amp = minDb + i * 10;
        const y = ampToY(amp);
        if (showGrid) {
          ctx.strokeStyle = INTERMOD_CONFIG.grid;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(padding.left, y);
          ctx.lineTo(width - padding.right, y);
          ctx.stroke();
        }
        ctx.fillText(`${amp}`, padding.left - 8, y + 4);
      }
      ctx.textAlign = "center";
      const freqRange = range.max - range.min;
      for (let i = 0; i <= 10; i++) {
        const f = range.min + (i * freqRange) / 10;
        const x = freqToX(f);
        if (showGrid) {
          ctx.strokeStyle = INTERMOD_CONFIG.grid;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, padding.top);
          ctx.lineTo(x, height - padding.bottom);
          ctx.stroke();
        }
        ctx.fillText(`${f.toFixed(1)}`, x, height - padding.bottom + 15);
      }
      ctx.fillStyle = "rgba(239, 68, 68, 0.2)";
      const forbiddenRanges =
        TALKBACK_FORBIDDEN_RANGES_BY_COUNTRY[selectedCountry] || [];
      forbiddenRanges.forEach((fz) => {
        // Bypass 450-453 MHz AND 465-467 MHz forbidden zones in Mainland Europe mode
        if (mode === "europe") {
          const is450Range = fz.min >= 450 && fz.max <= 453;
          const is450Range2 = fz.min >= 465 && fz.max <= 467;
          if (is450Range || is450Range2) return;
        }

        if (fz.max >= range.min && fz.min <= range.max) {
          const xS = Math.max(padding.left, freqToX(fz.min));
          const xE = Math.min(width - padding.right, freqToX(fz.max));
          if (xE > xS) {
            ctx.fillRect(xS, padding.top, xE - xS, chartHeight);
            ctx.save();
            ctx.translate(xS + 2, padding.top + 10);
            ctx.rotate(Math.PI / 2);
            ctx.fillStyle = "rgba(248, 113, 113, 0.6)";
            ctx.font = "bold 8px sans-serif";
            ctx.fillText(`Forbidden in ${selectedCountry}`, 0, 0);
            ctx.restore();
            ctx.fillStyle = "rgba(239, 68, 68, 0.2)";
          }
        }
      });

      // Draw Manual Exclusion Zones
      parsedExclusions.forEach((zone) => {
        if (zone.max >= range.min && zone.min <= range.max) {
          const xS = Math.max(padding.left, freqToX(zone.min));
          const xE = Math.min(width - padding.right, freqToX(zone.max));
          if (xE > xS) {
            ctx.fillStyle = "rgba(244, 63, 94, 0.18)";
            ctx.fillRect(xS, padding.top, xE - xS, chartHeight);
            ctx.strokeStyle = "rgba(244, 63, 94, 0.5)";
            ctx.lineWidth = 1;
            ctx.strokeRect(xS, padding.top, xE - xS, chartHeight);
          }
        }
      });

      // Draw Active Drag Exclusion
      if (currentExclusion) {
        const xS = Math.max(padding.left, freqToX(currentExclusion.min));
        const xE = Math.min(width - padding.right, freqToX(currentExclusion.max));
        if (xE > xS) {
          ctx.fillStyle = "rgba(244, 63, 94, 0.3)";
          ctx.fillRect(xS, padding.top, xE - xS, chartHeight);
          ctx.strokeStyle = "#f43f5e";
          ctx.lineWidth = 2;
          ctx.strokeRect(xS, padding.top, xE - xS, chartHeight);
        }
      }
      const drawSignal = (
        freq: number,
        amp: number,
        color: string,
        bw: number,
        label?: string,
      ) => {
        if (freq < range.min - bw || freq > range.max + bw) return;
        const x = freqToX(freq);
        const y = ampToY(amp);
        const bottomY = height - padding.bottom;
        const halfBwPx = Math.max(1, ((bw / freqRange) * chartWidth) / 2);
        ctx.fillStyle = fillSpikes ? color + "E6" : color + "33";
        ctx.beginPath();
        ctx.moveTo(x - halfBwPx, bottomY);
        ctx.lineTo(x - halfBwPx * 0.5, y + 10);
        ctx.lineTo(x + halfBwPx * 0.5, y + 10);
        ctx.lineTo(x + halfBwPx, bottomY);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1, Math.min(halfBwPx, 4));
        ctx.beginPath();
        ctx.moveTo(x, bottomY);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, ctx.lineWidth + 1, 0, Math.PI * 2);
        ctx.fill();
        if (label) {
          ctx.save();
          ctx.translate(x, y - 10);
          ctx.rotate(-Math.PI / 4);
          ctx.font = "bold 9px sans-serif";
          ctx.textAlign = "left";
          ctx.fillStyle = color;
          ctx.fillText(label, 0, 0);
          ctx.restore();
        }
      };
      allActiveCarriers.forEach((c) =>
        drawSignal(
          c.value,
          INTERMOD_CONFIG.tx.amp,
          c.type === "tx" ? INTERMOD_CONFIG.tx.color : INTERMOD_CONFIG.rx.color,
          c.bw,
          c.label,
        ),
      );
      if (showThreeTone)
        intermods.threeTone.forEach((f) =>
          drawSignal(
            f.value,
            INTERMOD_CONFIG.threeTone.amp,
            INTERMOD_CONFIG.threeTone.color,
            f.bw || 0.0125,
          ),
        );
      if (showTwoTone)
        intermods.twoTone.forEach((f) =>
          drawSignal(
            f.value,
            INTERMOD_CONFIG.twoTone.amp,
            INTERMOD_CONFIG.twoTone.color,
            f.bw || 0.0125,
          ),
        );

      if (measurementPoints.length > 0) {
        for (const pt of measurementPoints) {
          const x = freqToX(pt);
          ctx.strokeStyle = "#f43f5e";
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(x, padding.top);
          ctx.lineTo(x, height - padding.bottom);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        if (measurementPoints.length === 2) {
          const [p1, p2] = measurementPoints;
          const ptMin = Math.min(p1, p2);
          const ptMax = Math.max(p1, p2);
          const x1 = Math.max(padding.left, freqToX(ptMin));
          const x2 = Math.min(width - padding.right, freqToX(ptMax));
          const lineY = padding.top + 20;

          ctx.strokeStyle = "#f43f5e";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x1, lineY);
          ctx.lineTo(x2, lineY);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(x1 + 4, lineY - 4);
          ctx.lineTo(x1, lineY);
          ctx.lineTo(x1 + 4, lineY + 4);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(x2 - 4, lineY - 4);
          ctx.lineTo(x2, lineY);
          ctx.lineTo(x2 - 4, lineY + 4);
          ctx.stroke();

          const delta = ptMax - ptMin;
          const deltaText =
            delta >= 1
              ? `${delta.toFixed(5)} MHz`
              : `${(delta * 1000).toFixed(1)} kHz`;
          ctx.font = "bold 10px monospace";
          const textWidth = ctx.measureText(` Δ ${deltaText} `).width;
          ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
          ctx.fillRect(
            (x1 + x2) / 2 - textWidth / 2,
            lineY - 10,
            textWidth,
            14,
          );

          ctx.fillStyle = "#f43f5e";
          ctx.textAlign = "center";
          ctx.fillText(`Δ ${deltaText}`, (x1 + x2) / 2, lineY + 2);
        }
      }

      ctx.save();
      ctx.translate(15, height / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = "center";
      ctx.font = "bold 10px sans-serif";
      ctx.fillStyle = INTERMOD_CONFIG.text;
      ctx.fillText("AMPLITUDE (dBm)", 0, 0);
      ctx.restore();
      ctx.font = "bold 10px sans-serif";
      ctx.fillText("FREQUENCY (MHz)", width / 2, height - 5);
    };
    draw();
  }, [
    range,
    allActiveCarriers,
    intermods,
    showTwoTone,
    showThreeTone,
    showGrid,
    fillSpikes,
    mode,
    dimensions,
    selectedCountry,
    measurementPoints,
    parsedExclusions,
    currentExclusion,
  ]);

  const totalFrequenciesRequired = useMemo(() => {
    return talkbackZoneConfigs.reduce(
      (acc, z) => {
        const duplexPairs = z.duplexCustomMode === "custom"
          ? (z.customPairCount || 0) +
            (z.customTargetMode === "specific"
              ? z.customRanges?.reduce((sum, r) => sum + (r.customPairCount || 0), 0) || 0
              : 0)
          : z.pairCount;

        const simplexCount = (z.simplexTxCount || 0) + 
                             (z.simplexWalkieCount || 0) + 
                             (z.customSimplexTxCount || 0) + 
                             (z.customSimplexWalkieCount || 0);

        let subzonesSum = 0;
        if (z.talkbackStrategy === "subzones" && z.subzones) {
          subzonesSum = z.subzones.reduce((szAcc, sz) => {
            const szDuplex = sz.pairCount + (sz.customPairCount || 0);
            const szSimplex = (sz.simplexTxCount || 0) + 
                              (sz.simplexWalkieCount || 0) + 
                              (sz.customSimplexTxCount || 0) + 
                              (sz.customSimplexWalkieCount || 0);
            return szAcc + (szDuplex * 2) + (szSimplex * 1);
          }, 0);
        }

        return acc + (duplexPairs * 2) + (simplexCount * 1) + subzonesSum;
      },
      0,
    );
  }, [talkbackZoneConfigs]);

  const totalDuplexPairsRequired = useMemo(() => {
    return talkbackZoneConfigs.reduce(
      (acc, z) => {
        const duplexPairs = z.duplexCustomMode === "custom"
          ? (z.customPairCount || 0) +
            (z.customTargetMode === "specific"
              ? z.customRanges?.reduce((sum, r) => sum + (r.customPairCount || 0), 0) || 0
              : 0)
          : z.pairCount;

        let subzonesDuplexSum = 0;
        if (z.talkbackStrategy === "subzones" && z.subzones) {
          subzonesDuplexSum = z.subzones.reduce((szAcc, sz) => {
            const szDuplex = sz.pairCount + (sz.customPairCount || 0);
            return szAcc + szDuplex;
          }, 0);
        }

        return acc + duplexPairs + subzonesDuplexSum;
      },
      0,
    );
  }, [talkbackZoneConfigs]);

  const totalSimplexesRequired = useMemo(() => {
    return talkbackZoneConfigs.reduce(
      (acc, z) => {
        const simplexCount = (z.simplexTxCount || 0) + 
                             (z.simplexWalkieCount || 0) + 
                             (z.customSimplexTxCount || 0) + 
                             (z.customSimplexWalkieCount || 0);

        let subzonesSimplexSum = 0;
        if (z.talkbackStrategy === "subzones" && z.subzones) {
          subzonesSimplexSum = z.subzones.reduce((szAcc, sz) => {
            const szSimplex = (sz.simplexTxCount || 0) + 
                              (sz.simplexWalkieCount || 0) + 
                              (sz.customSimplexTxCount || 0) + 
                              (sz.customSimplexWalkieCount || 0);
            return szAcc + szSimplex;
          }, 0);
        }

        return acc + simplexCount + subzonesSimplexSum;
      },
      0,
    );
  }, [talkbackZoneConfigs]);

  const SectionToggle: React.FC<{
    label: string;
    mode: "standard" | "custom";
    onChange: (mode: "standard" | "custom") => void;
  }> = ({ label, mode, onChange }) => (
    <div className="flex items-center justify-between bg-slate-950/50 p-2 rounded-sm border border-white/5">
      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
        {label}
      </span>
      <div className="flex bg-slate-900 rounded-md p-0.5 border border-slate-800">
        <button
          onClick={() => onChange("standard")}
          className={`px-3 py-1 rounded text-[8px] font-black uppercase transition-all ${mode === "standard" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-gray-700"}`}
        >
          Standard
        </button>
        <button
          onClick={() => onChange("custom")}
          className={`px-3 py-1 rounded text-[8px] font-black uppercase transition-all ${mode === "custom" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-gray-700"}`}
        >
          Custom
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4 mx-auto">
      <EngagingLoadingState
        isOpen={isLoading}
        progress={progress * 100}
        onCancel={handleCancel}
      />
      <CelebratorySuccessState
        isOpen={showSuccess}
        onClose={() => setShowSuccess(false)}
        frequenciesFound={
          results?.reduce((acc, z) => acc + z.pairs.length, 0) || 0
        }
        frequenciesRequired={totalFrequenciesRequired}
        stats={[
          {
            label: "Duplex Pairs Required",
            value: totalDuplexPairsRequired,
          },
          {
            label: "Duplex Pairs Coordinated",
            value: yieldBreakdown?.duplex || 0,
          },
          {
            label: "Simplexes Required",
            value: totalSimplexesRequired,
          },
          {
            label: "Simplexes Coordinated",
            value: (yieldBreakdown?.simplexTx || 0) + (yieldBreakdown?.simplexWalkie || 0),
          },
          {
            label: "Number of zones",
            value: results?.length || 0,
          },
        ]}
      />

      <div
        className={`flex flex-col ${showLivePreview && results ? "xl:flex-row" : ""} gap-4`}
      >
        <div
          className={`space-y-4 ${showLivePreview && results ? "xl:w-2/3" : "w-full"}`}
        >
          <Card>
            <div className="flex justify-between items-center mb-6">
              <CardTitle className="!mb-0">1. Configure Zonal Bands</CardTitle>
              <div className="flex items-center gap-2">
                {results && (
                  <button
                    onClick={() => setShowLivePreview(!showLivePreview)}
                    className={`${secondaryButton} flex items-center gap-2`}
                  >
                    {showLivePreview ? "Hide Preview" : "Show Live Preview"}
                  </button>
                )}
                <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-sm p-1">
                  <span className="text-[10px] text-slate-500 font-black uppercase px-2">
                    Number of Zones:
                  </span>
                  <div className="flex items-center bg-slate-800 rounded border border-slate-700">
                    <button
                      onClick={() =>
                        handleNumZonesChange(
                          Math.max(
                            1,
                            parseInt(numZonesInput || "1") - 1,
                          ).toString(),
                        )
                      }
                      className="px-2 py-1 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors rounded-l text-xs font-bold"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={numZonesInput}
                      onChange={(e) => handleNumZonesChange(e.target.value)}
                      className="bg-transparent w-8 p-1 text-center font-mono text-xs text-white outline-none appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <button
                      onClick={() =>
                        handleNumZonesChange(
                          Math.min(
                            20,
                            parseInt(numZonesInput || "1") + 1,
                          ).toString(),
                        )
                      }
                      className="px-2 py-1 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors rounded-r text-xs font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="flex bg-slate-900 border border-indigo-500/30 rounded-md p-1 shadow-inner overflow-hidden">
                  <button
                    onClick={() => setMode("standard")}
                    className={`px-3 py-1.5 rounded-sm text-[10px] font-black uppercase transition-all ${mode === "standard" ? "bg-indigo-600 text-white shadow-sm border border-slate-700/50" : "text-slate-500 hover:text-gray-700"}`}
                  >
                    Standard (UK/USA)
                  </button>
                  <button
                    onClick={() => setMode("europe")}
                    className={`px-3 py-1.5 rounded-sm text-[10px] font-black uppercase transition-all ${mode === "europe" ? "bg-indigo-600 text-white shadow-sm border border-slate-700/50" : "text-slate-500 hover:text-gray-700"}`}
                  >
                    Band Reversal
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {talkbackZoneConfigs.map((cfg, zIdx) => (
                <div
                  key={zIdx}
                  className="bg-slate-900/50 p-2 rounded-md border-2 border-slate-600/80 space-y-4 shadow-sm border border-slate-700/50"
                >
                  <div className="flex justify-between items-center bg-slate-800/50 p-2 rounded-sm border border-slate-700/50 mb-4">
                    <div className="flex items-center gap-2 flex-grow">
                      <span className="text-[10px] font-black text-indigo-500/50 uppercase tracking-widest">
                        Z{zIdx + 1}
                      </span>
                      <input
                        type="text"
                        value={cfg.name}
                        onChange={(e) =>
                          handleConfigureZone(zIdx, { name: e.target.value })
                        }
                        className="bg-transparent border-none text-xs font-black text-indigo-300 uppercase tracking-widest outline-none w-full"
                        placeholder="ZONE NAME"
                      />
                    </div>
                      <div className="flex items-center gap-2">
                        <label className="text-[9px] text-slate-500 font-bold">
                          Qty (Duplex)
                        </label>
                        <div className="flex items-center bg-slate-950 border border-slate-700 rounded overflow-hidden">
                          <button
                            onClick={() =>
                              setTalkbackZoneConfigs((prev) =>
                                prev.map((c, i) =>
                                  i === zIdx
                                    ? {
                                        ...c,
                                        pairCount: Math.max(0, c.pairCount - 1),
                                      }
                                    : c,
                                ),
                              )
                            }
                            className="p-1 bg-slate-800 hover:bg-slate-700 text-indigo-400 transition-colors"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-2 w-2"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={4}
                                d="M19 9l-7 7-7-7"
                              />
                            </svg>
                          </button>
                          <input
                            type="number"
                            value={cfg.pairCount}
                            onChange={(e) =>
                              setTalkbackZoneConfigs((prev) =>
                                prev.map((c, i) =>
                                  i === zIdx
                                    ? {
                                        ...c,
                                        pairCount:
                                          parseInt(e.target.value) || 0,
                                      }
                                    : c,
                                ),
                              )
                            }
                            className="w-8 bg-transparent text-center text-[10px] text-indigo-400 font-bold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button
                            onClick={() =>
                              setTalkbackZoneConfigs((prev) =>
                                prev.map((c, i) =>
                                  i === zIdx
                                    ? { ...c, pairCount: c.pairCount + 1 }
                                    : c,
                                ),
                              )
                            }
                            className="p-1 bg-slate-800 hover:bg-slate-700 text-indigo-400 transition-colors"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-2 w-2"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={4}
                                d="M5 15l7-7 7 7"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                  </div>

                  <div className="flex items-center justify-between bg-slate-950/50 p-2 rounded-sm border border-white/5">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      Topology
                    </span>
                    <div className="flex bg-slate-900 rounded-md p-0.5 border border-slate-800">
                      <button
                        onClick={() =>
                          setTalkbackZoneConfigs((prev) =>
                            prev.map((c, i) =>
                              i === zIdx
                                ? { ...c, talkbackStrategy: "zone-wide" }
                                : c,
                            ),
                          )
                        }
                        className={`px-3 py-1 rounded text-[8px] font-black uppercase transition-all ${cfg.talkbackStrategy !== "subzones" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-gray-700"}`}
                      >
                        Zone-Wide (IMD Free)
                      </button>
                      <button
                        onClick={() =>
                          setTalkbackZoneConfigs((prev) =>
                            prev.map((c, i) =>
                              i === zIdx
                                ? { ...c, talkbackStrategy: "subzones" }
                                : c,
                            ),
                          )
                        }
                        className={`px-3 py-1 rounded text-[8px] font-black uppercase transition-all ${cfg.talkbackStrategy === "subzones" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-gray-700"}`}
                      >
                        Subzones Isolated
                      </button>
                    </div>
                  </div>

                  <div
                    className={`flex flex-col xl:flex-row xl:items-center justify-between bg-slate-950/50 p-2 rounded-sm border ${cfg.useTargetSeparation ? "border-indigo-500/50" : "border-white/5"} gap-2 transition-colors`}
                  >
                    <div className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        id={`useTargetSeparationToggle-${zIdx}`}
                        checked={cfg.useTargetSeparation ?? false}
                        onChange={(e) =>
                          handleConfigureZone(zIdx, {
                            useTargetSeparation: e.target.checked,
                          })
                        }
                        className="w-3 h-3 accent-indigo-500 cursor-pointer"
                      />
                      <label
                        htmlFor={`useTargetSeparationToggle-${zIdx}`}
                        className={`text-[9px] font-black uppercase tracking-widest cursor-pointer whitespace-nowrap ${cfg.useTargetSeparation ? "text-indigo-400" : "text-slate-400"}`}
                      >
                        Enforce Split
                      </label>
                    </div>
                    <div
                      className={`flex items-center gap-1 justify-end w-full px-1 ${!(cfg.useTargetSeparation ?? false) && "opacity-50 pointer-events-none"}`}
                    >
                      <button
                        onClick={() =>
                          handleConfigureZone(zIdx, {
                            targetSeparation: Math.max(
                              0,
                              parseFloat(
                                ((cfg.targetSeparation || 10) - 0.1).toFixed(1),
                              ),
                            ),
                          })
                        }
                        className="w-3.5 h-3.5 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white rounded text-[16px] font-black leading-none"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        step="0.1"
                        value={cfg.targetSeparation ?? 10.0}
                        onChange={(e) =>
                          handleConfigureZone(zIdx, {
                            targetSeparation: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-12 bg-slate-950 text-white text-[11px] font-mono text-center rounded border border-slate-700 focus:border-indigo-500 outline-none h-5"
                      />
                      <span className="text-[10px] text-slate-400 font-black">
                        MHz
                      </span>
                      <button
                        onClick={() =>
                          handleConfigureZone(zIdx, {
                            targetSeparation: parseFloat(
                              ((cfg.targetSeparation || 10) + 0.1).toFixed(1),
                            ),
                          })
                        }
                        className="w-3.5 h-3.5 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white rounded text-[16px] font-black leading-none"
                      >
                        +
                      </button>
                      <div className="flex items-center gap-1.5 ml-2 border-l border-slate-700 pl-2">
                        <input
                          type="checkbox"
                          id={`exactSeparationToggle-${zIdx}`}
                          checked={cfg.exactSeparation ?? false}
                          onChange={(e) =>
                            handleConfigureZone(zIdx, {
                              exactSeparation: e.target.checked,
                            })
                          }
                          className="w-3 h-3 accent-indigo-500 cursor-pointer"
                        />
                        <label
                          htmlFor={`exactSeparationToggle-${zIdx}`}
                          className="text-[10px] text-slate-400 font-black uppercase tracking-widest cursor-pointer whitespace-nowrap"
                        >
                          Exact
                        </label>
                      </div>
                    </div>
                  </div>

                  {cfg.talkbackStrategy === "subzones" && (
                    <div className="space-y-3 bg-slate-950/50 p-3 rounded-md border border-indigo-500/20">
                      <div className="flex justify-between items-center mb-2">
                        <h5 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                          Isolated Subzones
                        </h5>
                        <button
                          onClick={() =>
                            setTalkbackZoneConfigs((prev) =>
                              prev.map((c, i) =>
                                i === zIdx
                                  ? {
                                      ...c,
                                      subzones: [
                                        ...(c.subzones || []),
                                        {
                                          id: Math.random()
                                            .toString(36)
                                            .substr(2, 9),
                                          name: `Subzone ${String.fromCharCode(65 + (c.subzones?.length || 0))}`,
                                          pairCount: 4,
                                          customPairCount: 0,
                                          simplexTxCount: 0,
                                          simplexWalkieCount: 0,
                                          customSimplexTxCount: 0,
                                          customSimplexWalkieCount: 0,
                                        },
                                      ],
                                    }
                                  : c,
                              ),
                            )
                          }
                          className="text-[8px] bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded font-bold uppercase transition-colors"
                        >
                          + Add Subzone
                        </button>
                      </div>
                      {(!cfg.subzones || cfg.subzones.length === 0) && (
                        <div className="text-center text-[10px] text-slate-500 font-bold italic py-2">
                          No subzones created. Add one to generate isolated IMD
                          sets.
                        </div>
                      )}
                      <div className="space-y-2">
                        {cfg.subzones?.map((sz, szIdx) => (
                          <div
                            key={sz.id}
                            className="bg-slate-900 border border-slate-700 rounded-sm p-2 flex flex-col gap-2"
                          >
                            <div className="flex items-center justify-between">
                              <input
                                value={sz.name}
                                onChange={(e) =>
                                  setTalkbackZoneConfigs((prev) =>
                                    prev.map((c, i) =>
                                      i === zIdx
                                        ? {
                                            ...c,
                                            subzones: c.subzones?.map((s, j) =>
                                              j === szIdx
                                                ? { ...s, name: e.target.value }
                                                : s,
                                            ),
                                          }
                                        : c,
                                    ),
                                  )
                                }
                                className="bg-transparent text-[10px] font-black text-white w-24 outline-none border-b border-dashed border-slate-600 focus:border-indigo-400"
                              />
                              <button
                                onClick={() =>
                                  setTalkbackZoneConfigs((prev) =>
                                    prev.map((c, i) =>
                                      i === zIdx
                                        ? {
                                            ...c,
                                            subzones: c.subzones?.filter(
                                              (_, j) => j !== szIdx,
                                            ),
                                          }
                                        : c,
                                    ),
                                  )
                                }
                                className="text-slate-500 hover:text-red-400 transition-colors"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-3 w-3"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </button>
                            </div>
                            <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 text-[9px]">
                              <div className="flex flex-col gap-1 bg-slate-950 p-1.5 rounded border border-slate-800">
                                <span className="text-slate-500 font-bold whitespace-nowrap">
                                  Dup (Std)
                                </span>
                                <input
                                  type="number"
                                  min="0"
                                  value={sz.pairCount || 0}
                                  onChange={(e) =>
                                    setTalkbackZoneConfigs((prev) =>
                                      prev.map((c, i) =>
                                        i === zIdx
                                          ? {
                                              ...c,
                                              subzones: c.subzones?.map(
                                                (s, j) =>
                                                  j === szIdx
                                                    ? {
                                                        ...s,
                                                        pairCount:
                                                          parseInt(
                                                            e.target.value,
                                                          ) || 0,
                                                      }
                                                    : s,
                                              ),
                                            }
                                          : c,
                                      ),
                                    )
                                  }
                                  className="w-full bg-transparent text-white text-center font-mono outline-none"
                                />
                              </div>
                              <div className="flex flex-col gap-1 bg-slate-950 p-1.5 rounded border border-slate-800">
                                <span className="text-slate-500 font-bold whitespace-nowrap">
                                  Dup (Cust)
                                </span>
                                <input
                                  type="number"
                                  min="0"
                                  value={sz.customPairCount || 0}
                                  onChange={(e) =>
                                    setTalkbackZoneConfigs((prev) =>
                                      prev.map((c, i) =>
                                        i === zIdx
                                          ? {
                                              ...c,
                                              subzones: c.subzones?.map(
                                                (s, j) =>
                                                  j === szIdx
                                                    ? {
                                                        ...s,
                                                        customPairCount:
                                                          parseInt(
                                                            e.target.value,
                                                          ) || 0,
                                                      }
                                                    : s,
                                              ),
                                            }
                                          : c,
                                      ),
                                    )
                                  }
                                  className="w-full bg-transparent text-white text-center font-mono outline-none"
                                />
                              </div>
                              <div className="flex flex-col gap-1 bg-slate-950 p-1.5 rounded border border-slate-800">
                                <span className="text-amber-500/70 font-bold whitespace-nowrap">
                                  Base(Std)
                                </span>
                                <input
                                  type="number"
                                  min="0"
                                  value={sz.simplexTxCount || 0}
                                  onChange={(e) =>
                                    setTalkbackZoneConfigs((prev) =>
                                      prev.map((c, i) =>
                                        i === zIdx
                                          ? {
                                              ...c,
                                              subzones: c.subzones?.map(
                                                (s, j) =>
                                                  j === szIdx
                                                    ? {
                                                        ...s,
                                                        simplexTxCount:
                                                          parseInt(
                                                            e.target.value,
                                                          ) || 0,
                                                      }
                                                    : s,
                                              ),
                                            }
                                          : c,
                                      ),
                                    )
                                  }
                                  className="w-full bg-transparent text-white text-center font-mono outline-none"
                                />
                              </div>
                              <div className="flex flex-col gap-1 bg-slate-950 p-1.5 rounded border border-slate-800">
                                <span className="text-amber-500/70 font-bold whitespace-nowrap">
                                  Base(Cst)
                                </span>
                                <input
                                  type="number"
                                  min="0"
                                  value={sz.customSimplexTxCount || 0}
                                  onChange={(e) =>
                                    setTalkbackZoneConfigs((prev) =>
                                      prev.map((c, i) =>
                                        i === zIdx
                                          ? {
                                              ...c,
                                              subzones: c.subzones?.map(
                                                (s, j) =>
                                                  j === szIdx
                                                    ? {
                                                        ...s,
                                                        customSimplexTxCount:
                                                          parseInt(
                                                            e.target.value,
                                                          ) || 0,
                                                      }
                                                    : s,
                                              ),
                                            }
                                          : c,
                                      ),
                                    )
                                  }
                                  className="w-full bg-transparent text-white text-center font-mono outline-none"
                                />
                              </div>
                              <div className="flex flex-col gap-1 bg-slate-950 p-1.5 rounded border border-slate-800">
                                <span className="text-purple-500/70 font-bold whitespace-nowrap">
                                  Walk(Std)
                                </span>
                                <input
                                  type="number"
                                  min="0"
                                  value={sz.simplexWalkieCount || 0}
                                  onChange={(e) =>
                                    setTalkbackZoneConfigs((prev) =>
                                      prev.map((c, i) =>
                                        i === zIdx
                                          ? {
                                              ...c,
                                              subzones: c.subzones?.map(
                                                (s, j) =>
                                                  j === szIdx
                                                    ? {
                                                        ...s,
                                                        simplexWalkieCount:
                                                          parseInt(
                                                            e.target.value,
                                                          ) || 0,
                                                      }
                                                    : s,
                                              ),
                                            }
                                          : c,
                                      ),
                                    )
                                  }
                                  className="w-full bg-transparent text-white text-center font-mono outline-none"
                                />
                              </div>
                              <div className="flex flex-col gap-1 bg-slate-950 p-1.5 rounded border border-slate-800">
                                <span className="text-purple-500/70 font-bold whitespace-nowrap">
                                  Walk(Cst)
                                </span>
                                <input
                                  type="number"
                                  min="0"
                                  value={sz.customSimplexWalkieCount || 0}
                                  onChange={(e) =>
                                    setTalkbackZoneConfigs((prev) =>
                                      prev.map((c, i) =>
                                        i === zIdx
                                          ? {
                                              ...c,
                                              subzones: c.subzones?.map(
                                                (s, j) =>
                                                  j === szIdx
                                                    ? {
                                                        ...s,
                                                        customSimplexWalkieCount:
                                                          parseInt(
                                                            e.target.value,
                                                          ) || 0,
                                                      }
                                                    : s,
                                              ),
                                            }
                                          : c,
                                      ),
                                    )
                                  }
                                  className="w-full bg-transparent text-white text-center font-mono outline-none"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                          Base Tx {mode === "europe" ? "(High)" : "(Low)"}
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {baseBands.map((b) => (
                            <button
                              key={b}
                              onClick={() => {
                                setTalkbackZoneConfigs((prev) =>
                                  prev.map((c, i) => {
                                    if (i !== zIdx) return c;
                                    const next = new Set<number>(c.txBands);
                                    if (next.has(b)) next.delete(b);
                                    else next.add(b);
                                    return { ...c, txBands: next };
                                  }),
                                );
                              }}
                              className={`px-1.5 py-0.5 text-[9px] border rounded font-bold transition-all ${cfg.txBands.has(b) ? "bg-blue-600 border-blue-400 text-white" : "bg-slate-800 border-slate-700 text-slate-400"}`}
                            >
                              {b}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                          Port Rx {mode === "europe" ? "(Low)" : "(High)"}
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {portBands.map((b) => (
                            <button
                              key={b}
                              onClick={() => {
                                setTalkbackZoneConfigs((prev) =>
                                  prev.map((c, i) => {
                                    if (i !== zIdx) return c;
                                    const next = new Set<number>(c.rxBands);
                                    if (next.has(b)) next.delete(b);
                                    else next.add(b);
                                    return { ...c, rxBands: next };
                                  }),
                                );
                              }}
                              className={`px-1.5 py-0.5 text-[9px] border rounded font-bold transition-all ${cfg.rxBands.has(b) ? "bg-rose-600 border-rose-400 text-white" : "bg-slate-800 border-slate-700 text-slate-400"}`}
                            >
                              {b}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800/50">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="text-[9px] font-black text-indigo-300 uppercase tracking-widest">
                          Custom Range
                        </h5>
                        <button
                          onClick={() =>
                            setTalkbackZoneConfigs((prev) =>
                              prev.map((c, i) =>
                                i === zIdx
                                  ? {
                                      ...c,
                                      customRanges: [
                                        ...(c.customRanges || []),
                                        {
                                          id: Math.random().toString(36).substring(2, 9),
                                          txMin: 450,
                                          txMax: 455,
                                          rxMin: 460,
                                          rxMax: 465,
                                          customPairCount: 0,
                                          customBw: 0.0125,
                                        },
                                      ],
                                    }
                                  : c
                              )
                            )
                          }
                          className="flex items-center gap-1 text-[9px] font-bold text-indigo-400 hover:text-indigo-300"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                          </svg>
                          ADD RANGE
                        </button>
                      </div>

                      {/* Target Allocation Selector */}
                      <div className="flex items-center justify-between p-2 mb-2 bg-slate-900/40 rounded border border-white/5">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                          Target allocation mode
                        </span>
                        <div className="flex gap-1 bg-slate-950 p-0.5 rounded border border-slate-800">
                          <button
                            onClick={() =>
                              setTalkbackZoneConfigs((prev) =>
                                prev.map((c, i) =>
                                  i === zIdx
                                    ? { ...c, customTargetMode: "global" }
                                    : c
                                )
                              )
                            }
                            className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider transition-all ${
                              (!cfg.customTargetMode || cfg.customTargetMode === "global")
                                ? "bg-indigo-600 text-white"
                                : "text-slate-500 hover:text-gray-700"
                            }`}
                          >
                            Global Pool
                          </button>
                          <button
                            onClick={() =>
                              setTalkbackZoneConfigs((prev) =>
                                prev.map((c, i) =>
                                  i === zIdx
                                    ? { ...c, customTargetMode: "specific" }
                                    : c
                                )
                              )
                            }
                            className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider transition-all ${
                              cfg.customTargetMode === "specific"
                                ? "bg-indigo-600 text-white"
                                : "text-slate-500 hover:text-gray-700"
                            }`}
                          >
                            Per-Range Specific
                          </button>
                        </div>
                      </div>
                      
                      <div className="space-y-3 p-3 bg-slate-950/30 rounded-sm border border-white/5">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                              Base Tx Range
                            </span>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={cfg.customTxMin}
                                onChange={(e) =>
                                  setTalkbackZoneConfigs((prev) =>
                                    prev.map((c, i) =>
                                      i === zIdx
                                        ? {
                                            ...c,
                                            customTxMin:
                                              parseFloat(e.target.value) || 0,
                                          }
                                        : c,
                                    ),
                                  )
                                }
                                className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-xs text-white font-mono outline-none"
                                placeholder="Min"
                              />
                              <span className="text-slate-500 font-bold">
                                -
                              </span>
                              <input
                                type="number"
                                value={cfg.customTxMax}
                                onChange={(e) =>
                                  setTalkbackZoneConfigs((prev) =>
                                    prev.map((c, i) =>
                                      i === zIdx
                                        ? {
                                            ...c,
                                            customTxMax:
                                              parseFloat(e.target.value) || 0,
                                          }
                                        : c,
                                    ),
                                  )
                                }
                                className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-xs text-white font-mono outline-none"
                                placeholder="Max"
                              />
                            </div>
                          </div>
                          <div>
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                              Port Rx Range
                            </span>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={cfg.customRxMin}
                                onChange={(e) =>
                                  setTalkbackZoneConfigs((prev) =>
                                    prev.map((c, i) =>
                                      i === zIdx
                                        ? {
                                            ...c,
                                            customRxMin:
                                              parseFloat(e.target.value) || 0,
                                          }
                                        : c,
                                    ),
                                  )
                                }
                                className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-xs text-white font-mono outline-none"
                                placeholder="Min"
                              />
                              <span className="text-slate-500 font-bold">
                                -
                              </span>
                              <input
                                type="number"
                                value={cfg.customRxMax}
                                onChange={(e) =>
                                  setTalkbackZoneConfigs((prev) =>
                                    prev.map((c, i) =>
                                      i === zIdx
                                        ? {
                                            ...c,
                                            customRxMax:
                                              parseFloat(e.target.value) || 0,
                                          }
                                        : c,
                                    ),
                                  )
                                }
                                className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-xs text-white font-mono outline-none"
                                placeholder="Max"
                              />
                            </div>
                          </div>
                        </div>
                          <div className="grid grid-cols-2 gap-2 mt-4">
                            <div>
                              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                                {cfg.customTargetMode === "specific" ? "Target Pair" : "Global Target Pairs"}
                              </span>
                              <div className="flex items-center bg-slate-950 border border-slate-700 rounded overflow-hidden h-6 w-24">
                                <button
                                  onClick={() =>
                                    setTalkbackZoneConfigs((prev) =>
                                      prev.map((c, i) =>
                                        i === zIdx
                                          ? {
                                              ...c,
                                              customPairCount: Math.max(
                                                0,
                                                (c.customPairCount || 0) - 1,
                                              ),
                                            }
                                          : c,
                                      ),
                                    )
                                  }
                                  className="px-1.5 h-full bg-slate-800 hover:bg-slate-700 text-indigo-400 transition-colors"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-2 w-2"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={4}
                                      d="M19 9l-7 7-7-7"
                                    />
                                  </svg>
                                </button>
                                <input
                                  type="number"
                                  value={cfg.customPairCount || 0}
                                  onChange={(e) =>
                                    setTalkbackZoneConfigs((prev) =>
                                      prev.map((c, i) =>
                                        i === zIdx
                                          ? {
                                              ...c,
                                              customPairCount:
                                                parseInt(e.target.value) || 0,
                                            }
                                          : c,
                                      ),
                                    )
                                  }
                                  className="w-8 bg-transparent h-full text-white font-mono text-xs focus:outline-none text-center font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <button
                                  onClick={() =>
                                    setTalkbackZoneConfigs((prev) =>
                                      prev.map((c, i) =>
                                        i === zIdx
                                          ? {
                                              ...c,
                                              customPairCount:
                                                (c.customPairCount || 0) + 1,
                                            }
                                          : c,
                                      ),
                                    )
                                  }
                                  className="px-1.5 h-full bg-slate-800 hover:bg-slate-700 text-indigo-400 transition-colors"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-2 w-2"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={4}
                                      d="M5 15l7-7 7 7"
                                    />
                                  </svg>
                                </button>
                              </div>
                            </div>
                            <div>
                              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                                Bandwidth
                              </span>
                              <select
                                value={cfg.customBw}
                                onChange={(e) =>
                                  setTalkbackZoneConfigs((prev) =>
                                    prev.map((c, i) =>
                                      i === zIdx
                                        ? {
                                            ...c,
                                            customBw: parseFloat(
                                              e.target.value,
                                            ),
                                          }
                                        : c,
                                    ),
                                  )
                                }
                                className="bg-slate-800 border border-slate-700 text-white font-mono text-xs rounded px-2 py-1 outline-none w-full"
                              >
                                <option value={0.0125}>12.5 kHz</option>
                                <option value={0.025}>25 kHz</option>
                                <option value={0.05}>50 kHz</option>
                              </select>
                            </div>
                          </div>
                      </div>
                      
                      {cfg.customRanges?.map((cr, crIdx) => (
                        <div key={cr.id} className="space-y-3 p-3 mt-2 bg-slate-950/30 rounded-sm border border-white/5 relative">
                          <button
                            onClick={() =>
                              setTalkbackZoneConfigs((prev) =>
                                prev.map((c, i) =>
                                  i === zIdx
                                    ? {
                                        ...c,
                                        customRanges: c.customRanges?.filter((_, rIdx) => rIdx !== crIdx),
                                      }
                                    : c
                                )
                              )
                            }
                            className="absolute top-2 right-2 text-rose-500 hover:text-rose-400"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                          
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                                Base Tx Range
                              </span>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  value={cr.txMin}
                                  onChange={(e) =>
                                    setTalkbackZoneConfigs((prev) =>
                                      prev.map((c, i) =>
                                        i === zIdx
                                          ? {
                                              ...c,
                                              customRanges: c.customRanges?.map((r, rIdx) =>
                                                rIdx === crIdx ? { ...r, txMin: parseFloat(e.target.value) || 0 } : r
                                              ),
                                            }
                                          : c
                                      )
                                    )
                                  }
                                  className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-xs text-white font-mono outline-none"
                                  placeholder="Min"
                                />
                                <span className="text-slate-500 font-bold">-</span>
                                <input
                                  type="number"
                                  value={cr.txMax}
                                  onChange={(e) =>
                                    setTalkbackZoneConfigs((prev) =>
                                      prev.map((c, i) =>
                                        i === zIdx
                                          ? {
                                              ...c,
                                              customRanges: c.customRanges?.map((r, rIdx) =>
                                                rIdx === crIdx ? { ...r, txMax: parseFloat(e.target.value) || 0 } : r
                                              ),
                                            }
                                          : c
                                      )
                                    )
                                  }
                                  className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-xs text-white font-mono outline-none"
                                  placeholder="Max"
                                />
                              </div>
                            </div>
                            <div>
                              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                                Port Rx Range
                              </span>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  value={cr.rxMin}
                                  onChange={(e) =>
                                    setTalkbackZoneConfigs((prev) =>
                                      prev.map((c, i) =>
                                        i === zIdx
                                          ? {
                                              ...c,
                                              customRanges: c.customRanges?.map((r, rIdx) =>
                                                rIdx === crIdx ? { ...r, rxMin: parseFloat(e.target.value) || 0 } : r
                                              ),
                                            }
                                          : c
                                      )
                                    )
                                  }
                                  className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-xs text-white font-mono outline-none"
                                  placeholder="Min"
                                />
                                <span className="text-slate-500 font-bold">-</span>
                                <input
                                  type="number"
                                  value={cr.rxMax}
                                  onChange={(e) =>
                                    setTalkbackZoneConfigs((prev) =>
                                      prev.map((c, i) =>
                                        i === zIdx
                                          ? {
                                              ...c,
                                              customRanges: c.customRanges?.map((r, rIdx) =>
                                                rIdx === crIdx ? { ...r, rxMax: parseFloat(e.target.value) || 0 } : r
                                              ),
                                            }
                                          : c
                                      )
                                    )
                                  }
                                  className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-xs text-white font-mono outline-none"
                                  placeholder="Max"
                                />
                              </div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            {cfg.customTargetMode === "specific" ? (
                              <div>
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                                  Target Pair
                                </span>
                                <div className="flex items-center bg-slate-950 border border-slate-700 rounded overflow-hidden h-6 w-24">
                                  <button
                                    onClick={() =>
                                      setTalkbackZoneConfigs((prev) =>
                                        prev.map((c, i) =>
                                          i === zIdx
                                            ? {
                                                ...c,
                                                customRanges: c.customRanges?.map((r, rIdx) =>
                                                  rIdx === crIdx
                                                    ? {
                                                        ...r,
                                                        customPairCount: Math.max(
                                                          0,
                                                          (r.customPairCount || 0) - 1,
                                                        ),
                                                      }
                                                    : r
                                                ),
                                              }
                                            : c
                                        )
                                      )
                                    }
                                    className="px-1.5 h-full bg-slate-800 hover:bg-slate-700 text-indigo-400 transition-colors"
                                  >
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      className="h-2 w-2"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={4}
                                        d="M19 9l-7 7-7-7"
                                      />
                                    </svg>
                                  </button>
                                  <input
                                    type="number"
                                    value={cr.customPairCount || 0}
                                    onChange={(e) =>
                                      setTalkbackZoneConfigs((prev) =>
                                        prev.map((c, i) =>
                                          i === zIdx
                                            ? {
                                                ...c,
                                                customRanges: c.customRanges?.map((r, rIdx) =>
                                                  rIdx === crIdx
                                                    ? {
                                                        ...r,
                                                        customPairCount: parseInt(e.target.value) || 0,
                                                      }
                                                    : r
                                                ),
                                              }
                                            : c
                                        )
                                      )
                                    }
                                    className="w-8 bg-transparent h-full text-white font-mono text-xs focus:outline-none text-center font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                  <button
                                    onClick={() =>
                                      setTalkbackZoneConfigs((prev) =>
                                        prev.map((c, i) =>
                                          i === zIdx
                                            ? {
                                                ...c,
                                                customRanges: c.customRanges?.map((r, rIdx) =>
                                                  rIdx === crIdx
                                                    ? {
                                                        ...r,
                                                        customPairCount: (r.customPairCount || 0) + 1,
                                                      }
                                                    : r
                                                ),
                                              }
                                            : c
                                        )
                                      )
                                    }
                                    className="px-1.5 h-full bg-slate-800 hover:bg-slate-700 text-indigo-400 transition-colors"
                                  >
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      className="h-2 w-2"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={4}
                                        d="M5 15l7-7 7 7"
                                      />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div />
                            )}
                            <div>
                              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                                Bandwidth
                              </span>
                              <select
                                value={cr.customBw ?? 0.0125}
                                onChange={(e) =>
                                  setTalkbackZoneConfigs((prev) =>
                                    prev.map((c, i) =>
                                      i === zIdx
                                        ? {
                                            ...c,
                                            customRanges: c.customRanges?.map((r, rIdx) =>
                                              rIdx === crIdx
                                                ? {
                                                    ...r,
                                                    customBw: parseFloat(e.target.value),
                                                  }
                                                : r
                                            ),
                                          }
                                        : c
                                    )
                                  )
                                }
                                className="bg-slate-800 border border-slate-700 text-white font-mono text-xs rounded px-2 py-1 outline-none w-full"
                              >
                                <option value={0.0125}>12.5 kHz</option>
                                <option value={0.025}>25 kHz</option>
                                <option value={0.05}>50 kHz</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-slate-800 pt-3 mt-3">
                    <div className="flex justify-between items-center mb-2">
                      <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        Simplex Frequencies
                      </h5>
                        <div className="flex gap-2">
                          <div className="flex items-center gap-2">
                            <label className="text-[9px] text-slate-500 font-bold">
                              Base Tx
                            </label>
                            <div className="flex items-center bg-slate-950 border border-slate-700 rounded overflow-hidden h-6 w-24">
                              <button
                                onClick={() =>
                                  setTalkbackZoneConfigs((prev) =>
                                    prev.map((c, i) =>
                                      i === zIdx
                                        ? {
                                            ...c,
                                            simplexTxCount: Math.max(
                                              0,
                                              (c.simplexTxCount || 0) - 1,
                                            ),
                                          }
                                        : c,
                                    ),
                                  )
                                }
                                className="px-1.5 h-full bg-slate-800 hover:bg-slate-700 text-amber-400 transition-colors"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-2 w-2"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={4}
                                    d="M19 9l-7 7-7-7"
                                  />
                                </svg>
                              </button>
                              <input
                                type="number"
                                value={cfg.simplexTxCount || 0}
                                onChange={(e) =>
                                  setTalkbackZoneConfigs((prev) =>
                                    prev.map((c, i) =>
                                      i === zIdx
                                        ? {
                                            ...c,
                                            simplexTxCount:
                                              parseInt(e.target.value) || 0,
                                          }
                                        : c,
                                    ),
                                  )
                                }
                                className="w-8 bg-transparent h-full text-center text-[9px] text-amber-400 font-bold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              <button
                                onClick={() =>
                                  setTalkbackZoneConfigs((prev) =>
                                    prev.map((c, i) =>
                                      i === zIdx
                                        ? {
                                            ...c,
                                            simplexTxCount:
                                              (c.simplexTxCount || 0) + 1,
                                          }
                                        : c,
                                    ),
                                  )
                                }
                                className="px-1.5 h-full bg-slate-800 hover:bg-slate-700 text-amber-400 transition-colors"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-2 w-2"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={4}
                                    d="M5 15l7-7 7 7"
                                  />
                                </svg>
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-[9px] text-slate-500 font-bold">
                              Walkie
                            </label>
                            <div className="flex items-center bg-slate-950 border border-slate-700 rounded overflow-hidden h-6 w-24">
                              <button
                                onClick={() =>
                                  setTalkbackZoneConfigs((prev) =>
                                    prev.map((c, i) =>
                                      i === zIdx
                                        ? {
                                            ...c,
                                            simplexWalkieCount: Math.max(
                                              0,
                                              (c.simplexWalkieCount || 0) - 1,
                                            ),
                                          }
                                        : c,
                                    ),
                                  )
                                }
                                className="px-1.5 h-full bg-slate-800 hover:bg-slate-700 text-purple-400 transition-colors"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-2 w-2"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={4}
                                    d="M19 9l-7 7-7-7"
                                  />
                                </svg>
                              </button>
                              <input
                                type="number"
                                value={cfg.simplexWalkieCount || 0}
                                onChange={(e) =>
                                  setTalkbackZoneConfigs((prev) =>
                                    prev.map((c, i) =>
                                      i === zIdx
                                        ? {
                                            ...c,
                                            simplexWalkieCount:
                                              parseInt(e.target.value) || 0,
                                          }
                                        : c,
                                    ),
                                  )
                                }
                                className="w-8 bg-transparent h-full text-center text-[9px] text-purple-400 font-bold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              <button
                                onClick={() =>
                                  setTalkbackZoneConfigs((prev) =>
                                    prev.map((c, i) =>
                                      i === zIdx
                                        ? {
                                            ...c,
                                            simplexWalkieCount:
                                              (c.simplexWalkieCount || 0) + 1,
                                          }
                                        : c,
                                    ),
                                  )
                                }
                                className="px-1.5 h-full bg-slate-800 hover:bg-slate-700 text-purple-400 transition-colors"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-2 w-2"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={4}
                                    d="M5 15l7-7 7 7"
                                  />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800/50">
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div>
                          <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                            Base Tx Bands
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {availableSimplexBaseBands.map((b) => (
                              <button
                                key={b}
                                onClick={() => {
                                  setTalkbackZoneConfigs((prev) =>
                                    prev.map((c, i) => {
                                      if (i !== zIdx) return c;
                                      const next = new Set<number>(
                                        c.simplexTxBands || [],
                                      );
                                      if (next.has(b)) next.delete(b);
                                      else next.add(b);
                                      return { ...c, simplexTxBands: next };
                                    }),
                                  );
                                }}
                                className={`px-1.5 py-0.5 text-[9px] border rounded font-bold transition-all ${cfg.simplexTxBands?.has(b) ? "bg-amber-600 border-amber-400 text-white" : "bg-slate-800 border-slate-700 text-slate-400"}`}
                              >
                                {b}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                            Walkie Bands
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {availableSimplexWalkieBands.map((b) => (
                              <button
                                key={b}
                                onClick={() => {
                                  setTalkbackZoneConfigs((prev) =>
                                    prev.map((c, i) => {
                                      if (i !== zIdx) return c;
                                      const next = new Set<number>(
                                        c.simplexWalkieBands || [],
                                      );
                                      if (next.has(b)) next.delete(b);
                                      else next.add(b);
                                      return { ...c, simplexWalkieBands: next };
                                    }),
                                  );
                                }}
                                className={`px-1.5 py-0.5 text-[9px] border rounded font-bold transition-all ${cfg.simplexWalkieBands?.has(b) ? "bg-purple-600 border-purple-400 text-white" : "bg-slate-800 border-slate-700 text-slate-400"}`}
                              >
                                {b}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <h5 className="text-[9px] font-black text-indigo-300 uppercase tracking-widest mb-2">
                        Custom Range
                      </h5>
                      <div className="space-y-3 p-3 bg-slate-950/30 rounded-sm border border-white/5">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                              Simplex Tx Range
                            </span>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={cfg.simplexTxMin}
                                onChange={(e) =>
                                  setTalkbackZoneConfigs((prev) =>
                                    prev.map((c, i) =>
                                      i === zIdx
                                        ? {
                                            ...c,
                                            simplexTxMin:
                                              parseFloat(e.target.value) || 0,
                                          }
                                        : c,
                                    ),
                                  )
                                }
                                className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-xs text-white font-mono outline-none"
                                placeholder="Min"
                              />
                              <span className="text-slate-500 font-bold">
                                -
                              </span>
                              <input
                                type="number"
                                value={cfg.simplexTxMax}
                                onChange={(e) =>
                                  setTalkbackZoneConfigs((prev) =>
                                    prev.map((c, i) =>
                                      i === zIdx
                                        ? {
                                            ...c,
                                            simplexTxMax:
                                              parseFloat(e.target.value) || 0,
                                          }
                                        : c,
                                    ),
                                  )
                                }
                                className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-xs text-white font-mono outline-none"
                                placeholder="Max"
                              />
                            </div>
                              <div className="flex items-center mt-2 bg-slate-950 border border-slate-700 rounded overflow-hidden h-6 w-24">
                                <button
                                  onClick={() =>
                                    setTalkbackZoneConfigs((prev) =>
                                      prev.map((c, i) =>
                                        i === zIdx
                                          ? {
                                              ...c,
                                              customSimplexTxCount: Math.max(
                                                0,
                                                (c.customSimplexTxCount || 0) -
                                                  1,
                                              ),
                                            }
                                          : c,
                                      ),
                                    )
                                  }
                                  className="px-1.5 h-full bg-slate-800 hover:bg-slate-700 text-amber-400 transition-colors"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-2 w-2"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={4}
                                      d="M19 9l-7 7-7-7"
                                    />
                                  </svg>
                                </button>
                                <input
                                  type="number"
                                  value={cfg.customSimplexTxCount || 0}
                                  onChange={(e) =>
                                    setTalkbackZoneConfigs((prev) =>
                                      prev.map((c, i) =>
                                        i === zIdx
                                          ? {
                                              ...c,
                                              customSimplexTxCount:
                                                parseInt(e.target.value) || 0,
                                            }
                                          : c,
                                      ),
                                    )
                                  }
                                  className="w-8 bg-transparent h-full text-white font-mono text-xs focus:outline-none text-center font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <button
                                  onClick={() =>
                                    setTalkbackZoneConfigs((prev) =>
                                      prev.map((c, i) =>
                                        i === zIdx
                                          ? {
                                              ...c,
                                              customSimplexTxCount:
                                                (c.customSimplexTxCount || 0) +
                                                1,
                                            }
                                          : c,
                                      ),
                                    )
                                  }
                                  className="px-1.5 h-full bg-slate-800 hover:bg-slate-700 text-amber-400 transition-colors"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-2 w-2"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={4}
                                      d="M5 15l7-7 7 7"
                                    />
                                  </svg>
                                </button>
                              </div>
                          </div>
                          <div>
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                              Walkie Range
                            </span>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={cfg.simplexWalkieMin}
                                onChange={(e) =>
                                  setTalkbackZoneConfigs((prev) =>
                                    prev.map((c, i) =>
                                      i === zIdx
                                        ? {
                                            ...c,
                                            simplexWalkieMin:
                                              parseFloat(e.target.value) || 0,
                                          }
                                        : c,
                                    ),
                                  )
                                }
                                className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-xs text-white font-mono outline-none"
                                placeholder="Min"
                              />
                              <span className="text-slate-500 font-bold">
                                -
                              </span>
                              <input
                                type="number"
                                value={cfg.simplexWalkieMax}
                                onChange={(e) =>
                                  setTalkbackZoneConfigs((prev) =>
                                    prev.map((c, i) =>
                                      i === zIdx
                                        ? {
                                            ...c,
                                            simplexWalkieMax:
                                              parseFloat(e.target.value) || 0,
                                          }
                                        : c,
                                    ),
                                  )
                                }
                                className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-xs text-white font-mono outline-none"
                                placeholder="Max"
                              />
                            </div>
                              <div className="flex items-center mt-2 bg-slate-950 border border-slate-700 rounded overflow-hidden h-6 w-24">
                                <button
                                  onClick={() =>
                                    setTalkbackZoneConfigs((prev) =>
                                      prev.map((c, i) =>
                                        i === zIdx
                                          ? {
                                              ...c,
                                              customSimplexWalkieCount:
                                                Math.max(
                                                  0,
                                                  (c.customSimplexWalkieCount ||
                                                    0) - 1,
                                                ),
                                            }
                                          : c,
                                      ),
                                    )
                                  }
                                  className="px-1.5 h-full bg-slate-800 hover:bg-slate-700 text-purple-400 transition-colors"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-2 w-2"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={4}
                                      d="M19 9l-7 7-7-7"
                                    />
                                  </svg>
                                </button>
                                <input
                                  type="number"
                                  value={cfg.customSimplexWalkieCount || 0}
                                  onChange={(e) =>
                                    setTalkbackZoneConfigs((prev) =>
                                      prev.map((c, i) =>
                                        i === zIdx
                                          ? {
                                              ...c,
                                              customSimplexWalkieCount:
                                                parseInt(e.target.value) || 0,
                                            }
                                          : c,
                                      ),
                                    )
                                  }
                                  className="w-8 bg-transparent h-full text-white font-mono text-xs focus:outline-none text-center font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <button
                                  onClick={() =>
                                    setTalkbackZoneConfigs((prev) =>
                                      prev.map((c, i) =>
                                        i === zIdx
                                          ? {
                                              ...c,
                                              customSimplexWalkieCount:
                                                (c.customSimplexWalkieCount ||
                                                  0) + 1,
                                            }
                                          : c,
                                      ),
                                    )
                                  }
                                  className="px-1.5 h-full bg-slate-800 hover:bg-slate-700 text-purple-400 transition-colors"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-2 w-2"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={4}
                                      d="M5 15l7-7 7 7"
                                    />
                                  </svg>
                                </button>
                              </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                              Simplex Tx BW
                            </span>
                            <select
                              value={cfg.simplexTxBw}
                              onChange={(e) =>
                                setTalkbackZoneConfigs((prev) =>
                                  prev.map((c, i) =>
                                    i === zIdx
                                      ? {
                                          ...c,
                                          simplexTxBw: parseFloat(
                                            e.target.value,
                                          ),
                                        }
                                      : c,
                                  ),
                                )
                              }
                              className="bg-slate-800 border border-slate-700 text-white font-mono text-xs rounded px-2 py-1 outline-none w-full"
                            >
                              <option value={0.0125}>12.5 kHz</option>
                              <option value={0.025}>25 kHz</option>
                            </select>
                          </div>
                          <div>
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                              Walkie BW
                            </span>
                            <select
                              value={cfg.simplexWalkieBw}
                              onChange={(e) =>
                                setTalkbackZoneConfigs((prev) =>
                                  prev.map((c, i) =>
                                    i === zIdx
                                      ? {
                                          ...c,
                                          simplexWalkieBw: parseFloat(
                                            e.target.value,
                                          ),
                                        }
                                      : c,
                                  ),
                                )
                              }
                              className="bg-slate-800 border border-slate-700 text-white font-mono text-xs rounded px-2 py-1 outline-none w-full"
                            >
                              <option value={0.0125}>12.5 kHz</option>
                              <option value={0.025}>25 kHz</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                      Priority
                    </span>
                    <select
                      value={
                        cfg.generationPriority?.join(",") ||
                        "duplex,simplexTx,simplexWalkie"
                      }
                      onChange={(e) =>
                        setTalkbackZoneConfigs((prev) =>
                          prev.map((c, i) =>
                            i === zIdx
                              ? {
                                  ...c,
                                  generationPriority: e.target.value.split(
                                    ",",
                                  ) as any,
                                }
                              : c,
                          ),
                        )
                      }
                      className="bg-slate-950 border border-slate-700 text-white text-[9px] rounded p-1 w-full"
                    >
                      <option value="duplex,simplexTx,simplexWalkie">
                        Duplex {">"} Tx {">"} Walkie
                      </option>
                      <option value="simplexTx,duplex,simplexWalkie">
                        Tx {">"} Duplex {">"} Walkie
                      </option>
                      <option value="simplexWalkie,duplex,simplexTx">
                        Walkie {">"} Duplex {">"} Tx
                      </option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <div className="flex justify-between items-center bg-slate-900 border border-slate-700/50 rounded-md p-3 shadow-sm">
            <div className="flex items-center gap-2">
              <Settings className="w-3.5 h-3.5 text-gray-200 stroke-[2.5]" />
              <div>
                <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-200">Zone Interaction Settings</h3>
                <p className="text-[9px] text-slate-500 font-medium">Distance Matrix & Manual IMD Links</p>
              </div>
            </div>
            <button 
              onClick={() => setShowMatrixAndLinks(!showMatrixAndLinks)} 
              className={`${primaryButton} !py-1.5`}
            >
              {showMatrixAndLinks ? 'Hide Interaction Settings' : 'Show Interaction Settings'}
            </button>
          </div>

          {showMatrixAndLinks && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <Card>
              <div className="flex justify-between items-center mb-4">
                <CardTitle className="!mb-0 text-sm font-black uppercase tracking-widest">
                  📍 Distance Matrix (m)
                </CardTitle>
                <div className="flex bg-slate-950 border border-indigo-500/30 rounded-sm p-1 items-center gap-2">
                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-2">
                    Global Separation:
                  </span>
                  <input
                    type="number"
                    value={globalDistInput}
                    onChange={(e) => setGlobalDistInput(e.target.value)}
                    className="w-12 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs font-mono text-white text-center outline-none"
                  />
                  <button
                    onClick={handleApplyGlobalDistance}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-[8px] font-black uppercase px-2 py-1 rounded transition-colors"
                  >
                    Apply All
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto rounded-sm border border-slate-700 shadow-inner bg-black/20">
                <table className="w-full text-[10px] border-collapse text-center">
                  <thead>
                    <tr className="bg-slate-950">
                      <th className="p-2 border border-slate-800"></th>
                      {talkbackZoneConfigs.map((z, i) => (
                        <th
                          key={i}
                          className="p-2 border border-slate-800 text-slate-500 font-black"
                        >
                          {i + 1}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {distances.map((row, rIdx) => (
                      <tr key={rIdx}>
                        <th className="p-2 border border-slate-800 bg-slate-950 text-slate-500 font-black">
                          {rIdx + 1}
                        </th>
                        {row.map((val, cIdx) => (
                          <td
                            key={cIdx}
                            className="p-0 border border-slate-800"
                          >
                            {rIdx === cIdx ? (
                              <div className="h-10 bg-slate-900/50" />
                            ) : (
                              <input
                                type="number"
                                value={val}
                                onChange={(e) =>
                                  handleDistanceMatrixChange(
                                    rIdx,
                                    cIdx,
                                    e.target.value,
                                  )
                                }
                                className="w-full h-10 bg-transparent text-center font-mono text-white outline-none focus:bg-indigo-600/10"
                              />
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <Card>
              <CardTitle className="text-sm font-black uppercase tracking-widest">
                ⛓️ Manual IMD Links
              </CardTitle>
              <div className="overflow-x-auto rounded-sm border border-slate-700 shadow-inner bg-black/20">
                <table className="w-full text-[10px] border-collapse text-center">
                  <thead>
                    <tr className="bg-slate-950">
                      <th className="p-2 border border-slate-800"></th>
                      {talkbackZoneConfigs.map((z, i) => (
                        <th
                          key={i}
                          className="p-2 border border-slate-800 text-slate-500 font-black"
                        >
                          {i + 1}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {compatibilityMatrix.map((row, rIdx) => (
                      <tr key={rIdx}>
                        <th className="p-2 border border-slate-800 bg-slate-950 text-slate-500 font-black">
                          {rIdx + 1}
                        </th>
                        {row.map((val, cIdx) => (
                          <td
                            key={cIdx}
                            className="p-1 border border-slate-800 text-center"
                          >
                            {rIdx === cIdx ? (
                              "—"
                            ) : (
                              <input
                                type="checkbox"
                                checked={val}
                                onChange={() => handleMatrixChange(rIdx, cIdx)}
                                className="w-3 h-3 accent-indigo-500"
                              />
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
          )}
          <Card>
            <CardTitle>2. Fixed Site Plan</CardTitle>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {manualPairs.map((p, idx) => {
                const active = p.active !== false;
                return (
                  <div
                    key={p.id}
                    className={`bg-slate-900/40 p-2 rounded-sm border-2 transition-all ${active ? "border-slate-600 shadow-sm" : "border-slate-800 opacity-60 grayscale-[0.5]"}`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Toggle Button next to Base Tx */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() =>
                            updateManualPair(p.id, "active", !active)
                          }
                          className={`w-8 h-4 rounded-full relative transition-colors ${active ? "bg-emerald-500" : "bg-slate-700"}`}
                          title={active ? "Deactivate" : "Activate"}
                        >
                          <div
                            className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${active ? "left-0.5" : "left-4.5"}`}
                          />
                        </button>

                        {/* Base Tx */}
                        <div className="flex items-center gap-1.5 bg-slate-800 rounded px-2 h-8 w-[140px]">
                          <button
                            onClick={() =>
                              updateManualPair(
                                p.id,
                                "txIsBase",
                                !(
                                  p.txIsBase ??
                                  (mode === "europe" ? p.tx > 464 : p.tx < 464)
                                ),
                              )
                            }
                            className={`text-[7px] font-black uppercase leading-none w-8 px-1 py-0.5 rounded border transition-colors ${
                              (p.txIsBase ??
                              (mode === "europe" ? p.tx > 464 : p.tx < 464))
                                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                                : "bg-blue-500/20 border-blue-500/40 text-blue-400"
                            }`}
                            title="Toggle Base (Constant TX) vs SW (Intermittent)"
                          >
                            {(p.txIsBase ??
                            (mode === "europe" ? p.tx > 464 : p.tx < 464))
                              ? "Base"
                              : "SW"}
                          </button>
                          <ManualFreqInput
                            value={p.tx}
                            onChange={(v) => updateManualPair(p.id, "tx", v)}
                            className="w-full bg-transparent text-[11px] text-white font-mono outline-none font-bold"
                          />
                          <div className="flex flex-col -gap-1">
                            <button
                              onClick={() =>
                                handleFrequencyStep(p.id, "tx", "up")
                              }
                              className="text-slate-500 hover:text-white text-[8px] leading-none"
                            >
                              ▲
                            </button>
                            <button
                              onClick={() =>
                                handleFrequencyStep(p.id, "tx", "down")
                              }
                              className="text-slate-500 hover:text-white text-[8px] leading-none"
                            >
                              ▼
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 flex-1">
                        {/* Port Rx */}
                        <div className="flex items-center gap-1.5 bg-slate-800 rounded px-2 h-8 w-[140px]">
                          <button
                            onClick={() =>
                              updateManualPair(
                                p.id,
                                "rxIsBase",
                                !(
                                  p.rxIsBase ??
                                  (mode === "europe" ? p.rx > 464 : p.rx < 464)
                                ),
                              )
                            }
                            className={`text-[7px] font-black uppercase leading-none w-8 px-1 py-0.5 rounded border transition-colors ${
                              (p.rxIsBase ??
                              (mode === "europe" ? p.rx > 464 : p.rx < 464))
                                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                                : "bg-blue-500/20 border-blue-500/40 text-blue-400"
                            }`}
                            title="Toggle Base (Constant TX) vs SW (Intermittent)"
                          >
                            {(p.rxIsBase ??
                            (mode === "europe" ? p.rx > 464 : p.rx < 464))
                              ? "Base"
                              : "SW"}
                          </button>
                          <ManualFreqInput
                            value={p.rx}
                            onChange={(v) => updateManualPair(p.id, "rx", v)}
                            className="w-full bg-transparent text-[11px] text-white font-mono outline-none font-bold"
                          />
                          <div className="flex flex-col -gap-1">
                            <button
                              onClick={() =>
                                handleFrequencyStep(p.id, "rx", "up")
                              }
                              className="text-slate-500 hover:text-white text-[8px] leading-none"
                            >
                              ▲
                            </button>
                            <button
                              onClick={() =>
                                handleFrequencyStep(p.id, "rx", "down")
                              }
                              className="text-slate-500 hover:text-white text-[8px] leading-none"
                            >
                              ▼
                            </button>
                          </div>
                        </div>

                        {/* BW Dropdown next to frequencies */}
                        <div className="flex items-center gap-1.5 bg-slate-800 rounded px-2 h-8">
                          <span className="text-[7px] text-slate-500 font-black uppercase">
                            BW
                          </span>
                          <select
                            value={p.txBw || 0.0125}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              updateManualPair(p.id, "txBw", val);
                              updateManualPair(p.id, "rxBw", val);
                            }}
                            className="bg-transparent text-[10px] text-indigo-300 outline-none font-bold cursor-pointer"
                          >
                            <option value={0.0125}>12.5k</option>
                            <option value={0.025}>25k</option>
                            <option value={0.05}>50k</option>
                          </select>
                        </div>

                        {/* Zone Selector */}
                        <div className="flex items-center gap-1.5 bg-slate-800 rounded px-2 h-8">
                          <span className="text-[7px] text-slate-500 font-black uppercase">
                            Zone
                          </span>
                          <select
                            value={p.zoneIndex}
                            onChange={(e) =>
                              updateManualPair(
                                p.id,
                                "zoneIndex",
                                e.target.value,
                              )
                            }
                            className="bg-transparent text-[10px] text-indigo-300 outline-none font-bold cursor-pointer"
                          >
                            <option value={-1}>Site-Wide</option>
                            {talkbackZoneConfigs.map((z, i) => (
                              <option key={i} value={i}>
                                {z.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Lock & Remove */}
                        <div className="flex items-center gap-1 ml-auto">
                          <button
                            onClick={() =>
                              updateManualPair(p.id, "locked", !p.locked)
                            }
                            className={`p-1.5 rounded transition-all ${p.locked ? "text-amber-500 bg-amber-500/10" : "text-slate-600 hover:text-gray-700"}`}
                            title={p.locked ? "Unlock" : "Lock"}
                          >
                            <span className="text-xs">
                              {p.locked ? "🔒" : "🔓"}
                            </span>
                          </button>
                          <button
                            onClick={() => removeManualPair(p.id)}
                            className="text-red-400 p-1.5 font-bold text-base font-medium hover:text-red-300 transition-colors leading-none"
                            title="Remove"
                          >
                            &times;
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap gap-2 items-center border-t border-white/5 pt-4">
              <button
                onClick={addManualPair}
                className={`${greenButton} flex-grow border-dashed`}
              >
                + Add Single Manual Pair
              </button>
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-sm p-1">
                <span className="text-[10px] text-slate-500 font-black uppercase px-2">
                  Batch:
                </span>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={bulkAddCount}
                  onChange={(e) =>
                    setBulkAddCount(parseInt(e.target.value) || 1)
                  }
                  className="bg-slate-800 border border-slate-700 rounded w-12 p-1 text-center font-mono text-xs text-white"
                />
                <select
                  value={bulkAddZone}
                  onChange={(e) => setBulkAddZone(parseInt(e.target.value))}
                  className="bg-slate-800 border border-slate-700 rounded p-1 text-[10px] text-indigo-300 font-bold"
                >
                  <option value={-1}>Site-Wide</option>
                  {talkbackZoneConfigs.map((z, i) => (
                    <option key={i} value={i}>
                      {z.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleBulkAddManualPairs}
                  className={`${primaryButton} !px-3 !py-1.5 !text-[10px]`}
                >
                  Add Batch
                </button>
              </div>
            </div>
          </Card>
          <div className="space-y-4">
            <div className="flex gap-2">
              <button
                onClick={handleCalculate}
                disabled={isLoading}
                className={`${primaryButton} w-full py-2 text-base font-medium uppercase tracking-widest`}
              >
                {isLoading ? `COORDINATING ZONES...` : "⚡ GENERATE"}
              </button>
              {isLoading && (
                <button
                  onClick={() => abortControllerRef.current?.abort()}
                  className={`${secondaryButton} !bg-red-600 hover:!bg-red-500 border-red-800 text-white px-8 py-2 text-base font-medium uppercase tracking-widest`}
                >
                  ABORT
                </button>
              )}
              <button
                onClick={() => setShowTable(!showTable)}
                className={`${secondaryButton} !w-auto flex items-center gap-2 px-4`}
              >
                <span>📊</span> {showTable ? "HIDE LEDGER" : "TABULATE DATA"}
              </button>
              <div className="relative">
                <button
                  onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                  className={`${actionButton} h-full px-4 flex items-center gap-2`}
                >
                  <span>📥</span> EXPORT
                </button>
                {isExportMenuOpen && (
                  <div className="absolute bottom-full right-0 mb-2 bg-slate-800 border border-slate-700 rounded-md shadow-2xl z-[110] overflow-hidden min-w-[220px] animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <button
                      onClick={() => handleExport("pdf")}
                      className="w-full text-left px-3 py-3 text-xs font-bold text-gray-700 hover:bg-slate-700 border-b border-white/5 transition-colors"
                    >
                      PDF Report
                    </button>
                    <button
                      onClick={() => handleExport("xls")}
                      className="w-full text-left px-3 py-3 text-xs font-bold text-gray-700 hover:bg-slate-700 border-b border-white/5 transition-colors"
                    >
                      Excel (.XLS)
                    </button>
                  </div>
                )}
              </div>
            </div>{" "}
            {(isLoading || results) && (
              <div className="bg-slate-800/80 border border-blue-500/20 rounded-sm p-3">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">
                    {isLoading
                      ? "Coordinate Seeking In Progress..."
                      : "Total Zonal Spectral Yield Breakdown"}
                  </span>
                  <span className="text-xs font-bold text-white font-mono">
                    {isLoading ? (
                      `${Math.round(progress * 100)}%`
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-amber-400">
                          {yieldBreakdown?.simplexTx} Simplex Base Tx
                        </span>
                        <span className="text-slate-600">/</span>
                        <span className="text-purple-400">
                          {yieldBreakdown?.simplexWalkie} Simplex Set-to-Set
                        </span>
                        <span className="text-slate-600">/</span>
                        <span className="text-blue-400">
                          {yieldBreakdown?.duplex} Duplex Pairs
                        </span>
                        <span className="text-slate-500 ml-3 bg-slate-900 px-2 py-0.5 rounded border border-white/5">
                          Total: {totalYield} / {totalTarget}
                        </span>
                      </div>
                    )}
                  </span>
                </div>
                <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-white/5 shadow-inner">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full transition-all duration-300 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                    style={{
                      width: `${Math.min(100, (isLoading ? progress : totalYield / (totalTarget || 1)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
          {showTable && tabulatedData.length > 0 && (
            <Card className="!bg-slate-950 border-cyan-500/30 animate-in fade-in slide-in-from-top-2 duration-300">
              <CardTitle className="!text-sm uppercase tracking-[0.2em] text-black">
                Numerical Spectral Allocation Ledger
              </CardTitle>
              <div className="overflow-y-auto max-h-[400px] rounded-md border border-white/10 custom-scrollbar shadow-inner">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead className="bg-slate-900">
                    <tr className="uppercase font-black text-slate-500 border-b border-white/10">
                      <th
                        className="p-3 cursor-pointer select-none"
                        onClick={() => handleSort("tx")}
                      >
                        Base Tx (MHz) <SortArrow field="tx" />
                      </th>
                      <th
                        className="p-3 cursor-pointer select-none"
                        onClick={() => handleSort("rx")}
                      >
                        Portable Rx (MHz) <SortArrow field="rx" />
                      </th>
                      <th
                        className="p-3 cursor-pointer select-none"
                        onClick={() => handleSort("type")}
                      >
                        Type <SortArrow field="type" />
                      </th>
                      <th
                        className="p-3 cursor-pointer select-none"
                        onClick={() => handleSort("zoneName")}
                      >
                        Zone <SortArrow field="zoneName" />
                      </th>
                      <th
                        className="p-3 cursor-pointer select-none"
                        onClick={() => handleSort("bw")}
                      >
                        Bandwidth <SortArrow field="bw" />
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {tabulatedData.map((row, i) => (
                      <tr
                        key={i}
                        className="hover:bg-cyan-500/5 transition-colors group"
                      >
                        <td className="p-3 tabular-nums text-white font-black text-sm">
                          {row.tx > 0 ? row.tx.toFixed(5) : "—"}
                        </td>
                        <td className="p-3 tabular-nums text-white font-black text-sm">
                          {row.rx > 0 ? row.rx.toFixed(5) : "—"}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded uppercase text-[8px] font-black border bg-slate-800 border-slate-700 text-white">
                            {row.type}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="text-indigo-300 font-black uppercase tracking-tighter">
                            {row.zoneName}
                          </span>
                        </td>
                        <td className="p-3 tabular-nums text-slate-500">
                          {(row.bw * 1000).toFixed(1)} kHz
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
          <Card className="relative overflow-hidden !bg-gradient-to-br !from-[#d1d5db] !via-[#9ca3af] !to-[#6b7280] !border-[#4b5563] !text-black !shadow-[inset_0_0_20px_rgba(0,0,0,0.3),0_10px_30px_rgba(0,0,0,0.5)]">
            {/* Metallic inner borders */}
            <div className="absolute inset-1 border-2 border-gray-500/30 rounded-md pointer-events-none" />
            <div className="absolute inset-2 border-2 border-gray-200/40 rounded-md pointer-events-none" />
            
            {/* Rivets */}
            <div className="absolute top-3 left-3 w-3 h-3 rounded-full bg-gradient-to-br from-gray-200 to-gray-500 border border-gray-600 shadow-[inset_1px_1px_2px_rgba(255,255,255,0.8),inset_-1px_-1px_2px_rgba(0,0,0,0.5),0_1px_2px_rgba(0,0,0,0.5)] flex items-center justify-center pointer-events-none">
              <div className="w-1.5 h-[1px] bg-gray-700/60 rotate-45" />
            </div>
            <div className="absolute top-3 right-3 w-3 h-3 rounded-full bg-gradient-to-br from-gray-200 to-gray-500 border border-gray-600 shadow-[inset_1px_1px_2px_rgba(255,255,255,0.8),inset_-1px_-1px_2px_rgba(0,0,0,0.5),0_1px_2px_rgba(0,0,0,0.5)] flex items-center justify-center pointer-events-none">
              <div className="w-1.5 h-[1px] bg-gray-700/60 -rotate-12" />
            </div>
            <div className="absolute bottom-3 left-3 w-3 h-3 rounded-full bg-gradient-to-br from-gray-200 to-gray-500 border border-gray-600 shadow-[inset_1px_1px_2px_rgba(255,255,255,0.8),inset_-1px_-1px_2px_rgba(0,0,0,0.5),0_1px_2px_rgba(0,0,0,0.5)] flex items-center justify-center pointer-events-none">
              <div className="w-1.5 h-[1px] bg-gray-700/60 rotate-90" />
            </div>
            <div className="absolute bottom-3 right-3 w-3 h-3 rounded-full bg-gradient-to-br from-gray-200 to-gray-500 border border-gray-600 shadow-[inset_1px_1px_2px_rgba(255,255,255,0.8),inset_-1px_-1px_2px_rgba(0,0,0,0.5),0_1px_2px_rgba(0,0,0,0.5)] flex items-center justify-center pointer-events-none">
              <div className="w-1.5 h-[1px] bg-gray-700/60 rotate-12" />
            </div>

            <div className="relative z-10">
              <div className="flex flex-col md:flex-row justify-between items-center gap-2 mb-4">
              {" "}
              <div className="flex items-center gap-3">
                <CardTitle className="!mb-0">
                  3. Intermod Physics Auditor
                </CardTitle>
                <div className="bg-gray-300/40 p-1.5 rounded-md border border-gray-500 flex items-center gap-3 ml-2">
                  <span className="text-[9px] font-black text-gray-700 uppercase tracking-widest pl-2">
                    Country
                  </span>
                  <div className="flex bg-white/50 p-1 rounded-sm gap-1 border border-gray-500">
                    {["UK", "USA", "Other"].map((country) => (
                      <button
                        key={country}
                        onClick={() => setSelectedCountry(country)}
                        className={`px-3 py-1.5 rounded-sm text-[10px] font-black uppercase transition-all ${selectedCountry === country ? "bg-indigo-600 text-black shadow-sm border border-slate-700/50" : "text-gray-700 hover:text-gray-700"}`}
                      >
                        {country}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={handleRunAudit} className={primaryButton}>
                  RUN SPECTRAL AUDIT
                </button>
              </div>
              {mode === "custom" && (
                <div className="flex items-center gap-2 bg-gray-300/60 p-2 px-3 rounded-md border border-indigo-500/20">
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] font-black text-indigo-800 uppercase tracking-widest">
                      Auditor Base TX Range:
                    </span>
                    <div className="flex items-center gap-1 bg-white p-1 rounded border border-gray-500">
                      <input
                        type="number"
                        value={customBaseRange.min}
                        onChange={(e) =>
                          setCustomBaseRange((prev) => ({
                            ...prev,
                            min: parseFloat(e.target.value) || 0,
                          }))
                        }
                        className="w-20 bg-transparent text-black font-mono text-[10px] text-center outline-none"
                        placeholder="Min"
                      />
                      <span className="text-slate-600 font-bold">-</span>
                      <input
                        type="number"
                        value={customBaseRange.max}
                        onChange={(e) =>
                          setCustomBaseRange((prev) => ({
                            ...prev,
                            max: parseFloat(e.target.value) || 0,
                          }))
                        }
                        className="w-20 bg-transparent text-black font-mono text-[10px] text-center outline-none"
                        placeholder="Max"
                      />
                    </div>
                  </div>
                  <div className="w-px h-4 bg-gray-200" />
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">
                      Auditor SW Range:
                    </span>
                    <div className="flex items-center gap-1 bg-white p-1 rounded border border-gray-500">
                      <input
                        type="number"
                        value={customSwRange.min}
                        onChange={(e) =>
                          setCustomSwRange((prev) => ({
                            ...prev,
                            min: parseFloat(e.target.value) || 0,
                          }))
                        }
                        className="w-20 bg-transparent text-black font-mono text-[10px] text-center outline-none"
                        placeholder="Min"
                      />
                      <span className="text-slate-600 font-bold">-</span>
                      <input
                        type="number"
                        value={customSwRange.max}
                        onChange={(e) =>
                          setCustomSwRange((prev) => ({
                            ...prev,
                            max: parseFloat(e.target.value) || 0,
                          }))
                        }
                        className="w-20 bg-transparent text-black font-mono text-[10px] text-center outline-none"
                        placeholder="Max"
                      />
                    </div>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2 bg-gray-300/80 p-2 rounded-md border border-gray-500">
                <div className="flex gap-2 pr-4 border-r border-gray-500/50">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={showTwoTone}
                      onChange={(e) => setShowTwoTone(e.target.checked)}
                      className="w-4 h-4 rounded accent-red-500 bg-gray-200"
                    />
                    <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest group-hover:text-black transition-colors">
                      2-Tone
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={showThreeTone}
                      onChange={(e) => setShowThreeTone(e.target.checked)}
                      className="w-4 h-4 rounded accent-purple-500 bg-gray-200"
                    />
                    <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest group-hover:text-black transition-colors">
                      3-Tone
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer group px-2 border-l border-gray-500/50">
                    <input
                      type="checkbox"
                      checked={showTooltips}
                      onChange={(e) => setShowTooltips(e.target.checked)}
                      className="w-4 h-4 rounded accent-cyan-500 bg-gray-200"
                    />
                    <span className="text-[10px] text-gray-700 font-bold uppercase tracking-widest group-hover:text-black transition-colors">
                      Tooltips
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer group px-2 border-l border-gray-500/50">
                    <input
                      type="checkbox"
                      checked={showGrid}
                      onChange={(e) => setShowGrid(e.target.checked)}
                      className="w-4 h-4 rounded accent-indigo-600 bg-gray-200"
                    />
                    <span className="text-[10px] text-gray-700 font-bold uppercase tracking-widest group-hover:text-black transition-colors">
                      Grid Squares
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={fillSpikes}
                      onChange={(e) => setFillSpikes(e.target.checked)}
                      className="w-4 h-4 rounded accent-yellow-500 bg-gray-200"
                    />
                    <span className="text-[10px] text-gray-700 font-bold uppercase tracking-widest group-hover:text-black transition-colors">
                      Fill Spikes
                    </span>
                  </label>
                </div>
                <div className="flex items-center gap-2 pr-4 border-r border-gray-500/50">
                  <span className="text-[9px] font-black text-gray-700 uppercase tracking-tighter">
                    Center
                  </span>
                  <div className="flex items-center bg-white rounded-sm p-0.5 border border-gray-500 shadow-inner">
                    <button
                      onClick={() => handleScroll("left")}
                      className="p-1.5 px-2.5 rounded bg-gray-200/50 text-gray-700 hover:bg-gray-300 transition-colors text-xs font-bold"
                    >
                      &larr;
                    </button>
                    <input
                      type="text"
                      value={centerFreqInput}
                      onChange={(e) => setCenterFreqInput(e.target.value)}
                      onFocus={() => {
                        isCenterFreqFocused.current = true;
                      }}
                      onBlur={(e) => {
                        isCenterFreqFocused.current = false;
                        applyCenterFreq(e.target.value);
                      }}
                      onKeyDown={(e) =>
                        e.key === "Enter" &&
                        applyCenterFreq(e.currentTarget.value)
                      }
                      className="w-20 bg-transparent text-black font-mono text-[10px] text-center font-bold outline-none focus:text-black"
                      placeholder="0.0000"
                    />
                    <button
                      onClick={() => applyCenterFreq(centerFreqInput)}
                      className="px-2 py-0.5 mx-0.5 rounded bg-blue-500/80 text-black font-bold text-[8px] uppercase tracking-wider hover:bg-blue-400 transition-colors"
                    >
                      Set
                    </button>
                    <button
                      onClick={() => handleScroll("right")}
                      className="p-1.5 px-2.5 rounded bg-gray-200/50 text-gray-700 hover:bg-gray-300 transition-colors text-xs font-bold"
                    >
                      &rarr;
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white/50 px-2 py-1.5 rounded-sm border border-gray-500/50">
                    <span className="text-[8px] text-gray-700 font-black uppercase">
                      Step
                    </span>
                    <button
                      onClick={() => handleCenterStepSizeChange("down")}
                      className="text-gray-600 hover:text-black transition-colors"
                    >
                      ▼
                    </button>
                    <span className="text-[10px] font-mono text-black w-8 text-center font-bold">
                      {centerStepMhz}
                    </span>
                    <button
                      onClick={() => handleCenterStepSizeChange("up")}
                      className="text-gray-600 hover:text-black transition-colors"
                    >
                      ▲
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black text-gray-700 uppercase tracking-tighter">
                    Span
                  </span>
                  <div className="flex items-center bg-white rounded-sm p-0.5 border border-gray-500 shadow-inner">
                    <button
                      onClick={() => handleSpanChange("decrease")}
                      className="px-2 py-1 text-black rounded text-[10px] font-black hover:bg-gray-300 transition-colors"
                    >
                      -
                    </button>
                    <span className="text-[10px] text-black font-mono w-16 text-center font-black">
                      {(range.max - range.min).toFixed(1)}M
                    </span>
                    <button
                      onClick={() => handleSpanChange("increase")}
                      className="px-2 py-1 text-black rounded text-[10px] font-black hover:bg-gray-300 transition-colors"
                    >
                      +
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white/50 px-2 py-1.5 rounded-sm border border-gray-500/50">
                    <span className="text-[8px] text-gray-700 font-black uppercase">
                      Step
                    </span>
                    <button
                      onClick={() => handleSpanStepSizeChange("down")}
                      className="text-gray-600 hover:text-black transition-colors"
                    >
                      ▼
                    </button>
                    <span className="text-[10px] font-mono text-black w-8 text-center font-bold">
                      {spanIncrementMhz}
                    </span>
                    <button
                      onClick={() => handleSpanStepSizeChange("up")}
                      className="text-gray-600 hover:text-black transition-colors"
                    >
                      ▲
                    </button>
                  </div>
                </div>

                {/* DELTA CONTROLS */}
                <div className="flex items-center gap-2 bg-gray-300/60 p-1.5 rounded-md border border-gray-500 shadow-inner">
                  <span className="text-[9px] font-black text-gray-700 uppercase tracking-tighter ml-1">
                    Delta
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setIsDeltaMode(prev => !prev)}
                      className={`px-3 py-1.5 rounded text-[9px] font-black uppercase tracking-widest transition-all ${isDeltaMode ? "bg-rose-500 text-black shadow-[0_0_15px_rgba(244,63,94,0.4)] border border-rose-400" : "bg-white text-gray-600 hover:bg-gray-200 border border-gray-500"}`}
                    >
                      {isDeltaMode ? "Active" : "Enable"}
                    </button>
                    <button
                      onClick={() => setMeasurementPoints([])}
                      disabled={measurementPoints.length === 0}
                      className={`px-3 py-1.5 rounded text-[9px] font-black uppercase tracking-widest transition-all ${measurementPoints.length > 0 ? "bg-gray-200 text-gray-800 hover:bg-gray-300 border border-gray-500" : "bg-white/50 text-slate-600 border border-transparent cursor-not-allowed"}`}
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* ZOOM & PAN CONTROLS */}
                <div className="flex items-center gap-2 bg-gray-300/60 p-1.5 rounded-md border border-gray-500 shadow-inner">
                  <span className="text-[9px] font-black text-gray-700 uppercase tracking-tighter ml-1">
                    View
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setRange(prev => { const s = prev.max - prev.min; return { min: prev.min + s * 0.25, max: prev.max - s * 0.25 } })}
                      className="w-7 h-7 flex items-center justify-center rounded bg-white text-gray-800 hover:bg-gray-200 border border-gray-500 font-black transition-colors"
                      title="Zoom In"
                    >
                      +
                    </button>
                    <button
                      onClick={() => setRange(prev => { const s = prev.max - prev.min; return { min: prev.min - s * 0.5, max: prev.max + s * 0.5 } })}
                      className="w-7 h-7 flex items-center justify-center rounded bg-white text-gray-800 hover:bg-gray-200 border border-gray-500 font-black transition-colors"
                      title="Zoom Out"
                    >
                      -
                    </button>
                    <div className="w-px h-4 bg-gray-400 mx-0.5" />
                    <button
                      onClick={() => setRange(prev => { const s = prev.max - prev.min; return { min: prev.min - s * 0.25, max: prev.max - s * 0.25 } })}
                      className="w-7 h-7 flex items-center justify-center rounded bg-white text-gray-800 hover:bg-gray-200 border border-gray-500 font-black transition-colors"
                      title="Pan Left"
                    >
                      {"<"}
                    </button>
                    <button
                      onClick={() => setRange(prev => { const s = prev.max - prev.min; return { min: prev.min + s * 0.25, max: prev.max + s * 0.25 } })}
                      className="w-7 h-7 flex items-center justify-center rounded bg-white text-gray-800 hover:bg-gray-200 border border-gray-500 font-black transition-colors"
                      title="Pan Right"
                    >
                      {">"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            {hasAnalyzed && (
              <div className="mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div
                  className={`p-2 rounded-md border-2 shadow-md ${diagnosticConflicts.length === 0 ? "bg-emerald-100 border-emerald-600 text-black" : "bg-red-100 border-red-600 text-black"}`}
                >
                  <div className="flex justify-between items-center mb-3">
                    <h5 className="text-xs font-black uppercase tracking-widest text-black flex items-center gap-1.5">
                      {diagnosticConflicts.length === 0 ? (
                        <>
                          <span className="text-emerald-800 text-sm font-black">✓</span> Multi-Zone Isolation Confirmed
                        </>
                      ) : (
                        <>
                          <span className="text-red-700 text-sm font-black">⚠️</span> {diagnosticConflicts.length} Zonal Interaction Clashes
                        </>
                      )}
                    </h5>
                    <button
                      onClick={() => setHasAnalyzed(false)}
                      className="text-black hover:text-gray-800 text-xs font-bold uppercase tracking-widest"
                    >
                      &times; Dismiss Audit
                    </button>
                  </div>
                  {diagnosticConflicts.length === 0 ? (
                    <p className="text-[11px] text-black font-bold leading-relaxed">
                      Spectral analysis confirms zero interaction between all
                      active zones under standard 12.5kHz fundamental and
                      12.5kHz IMD guard parameters.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                      {diagnosticConflicts.map((c, i) => (
                        <div
                          key={i}
                          className="bg-white p-2.5 rounded-sm border-2 border-gray-700 text-[10px] flex flex-col gap-1 shadow-sm text-black"
                        >
                          <div className="flex justify-between font-black">
                            <span className="text-red-700 uppercase font-black">
                              {c.type} Interaction
                            </span>
                            <span className="text-black font-mono font-bold">
                              Error: {(c.diff * 1000).toFixed(1)} kHz
                            </span>
                          </div>
                          <p className="text-black font-bold leading-tight">
                            <span className="text-black font-extrabold">
                              {c.targetFreq.id}
                            </span>{" "}
                            ({c.targetFreq.value.toFixed(5)}){" "}
                            {c.type.includes("Fundamental")
                              ? ` too close to carrier ${c.sourceFreqs[0].id} (${c.sourceFreqs[0].value.toFixed(5)})`
                              : ` hit by products of ${c.sourceFreqs.map((f) => `${f.id}(${f.value.toFixed(5)})`).join(" and ")}`}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="bg-slate-900/80 p-2 rounded-md border border-slate-800 mb-4">
              <label className="text-[10px] text-slate-400 uppercase font-black mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  Manual Exclusions (MHz)
                  <span className="text-slate-500 font-normal text-[9px]">(Format: start-end, start-end. Use Exclude mode or Shift+Drag on canvas to draw)</span>
                </span>
                {parsedExclusions.length > 0 && (
                  <span className="text-rose-400 font-mono text-[9px]">{parsedExclusions.length} Active Exclusion{parsedExclusions.length > 1 ? 's' : ''}</span>
                )}
              </label>
              <input 
                value={manualExclusions} 
                onChange={e => setManualExclusions(e.target.value)} 
                placeholder="e.g. 450-452, 460-461.5" 
                className="w-full bg-slate-950 border border-slate-700 p-2 rounded text-xs font-mono text-slate-300 outline-none focus:border-indigo-500" 
              />
              
              {parsedExclusions.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-2 items-center">
                  {parsedExclusions.map((zone, idx) => (
                    <div key={idx} className="flex items-center gap-1 bg-rose-500/10 border border-rose-500/20 rounded-full px-2.5 py-0.5 text-[9px] font-black text-rose-400">
                      <span>{zone.min.toFixed(3)}-{zone.max.toFixed(3)}</span>
                      <button 
                        onClick={() => handleExclusionZoneRemove(idx)}
                        className="hover:text-white transition-colors ml-1"
                        title="Remove exclusion zone"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                  <button 
                    onClick={() => setManualExclusions('')}
                    className="text-[8px] text-slate-500 hover:text-rose-400 uppercase font-black tracking-widest transition-colors ml-1"
                  >
                    Clear All
                  </button>
                </div>
              )}
            </div>

            <div className="relative group flex flex-col gap-2">
                <div className="flex items-center justify-end z-10 w-full mb-2">
                    <div className="flex items-center bg-slate-950/90 rounded-md p-1 border border-slate-700 shadow-inner">
                        <button 
                            type="button"
                            onClick={() => setInteractionMode('pan')} 
                            className={`px-3 py-1.5 rounded-sm text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                                interactionMode === 'pan' 
                                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md ring-1 ring-white/20' 
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                            title="Pan Mode: Drag canvas to pan left/right"
                        >
                            <span>🖐️</span>
                            <span>Pan</span>
                        </button>
                        <button 
                            type="button"
                            onClick={() => setInteractionMode('exclude')} 
                            className={`px-3 py-1.5 rounded-sm text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                                interactionMode === 'exclude' 
                                    ? 'bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-md ring-1 ring-white/20' 
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                            title="Exclude Mode: Drag to draw exclusion zones (Mobile friendly)"
                        >
                            <span>🚫</span>
                            <span>Exclude</span>
                        </button>
                    </div>
                </div>
              <canvas
                ref={canvasRef}
                className={`w-full h-[250px] md:h-[350px] bg-white rounded-md border border-blue-500/20 shadow-inner touch-none ${isDeltaMode ? "cursor-crosshair" : isDragging ? "cursor-grabbing" : "cursor-grab"}`}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onWheel={handleWheel}
              />
              {showTooltips && activeHit && mouseCoord && !isDragging && (
                <div
                  className="fixed z-[100] p-2.5 bg-gray-300/95 border border-white/20 rounded-sm shadow-2xl pointer-events-none backdrop-blur-md transform -translate-x-1/2 -translate-y-full"
                  style={{
                    left: mouseCoord.clientX,
                    top: mouseCoord.clientY - 6,
                  }}
                >
                  <div className="flex flex-col gap-0.5">
                    <div
                      className="text-[11px] font-black uppercase tracking-tight"
                      style={{ color: activeHit.color }}
                    >
                      {activeHit.text}
                    </div>
                    <div className="text-[10px] text-gray-600 font-mono italic">
                      {activeHit.subtext}
                    </div>
                  </div>
                  <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-gray-300 border-r border-b border-white/20 transform rotate-45" />
                </div>
              )}
            </div>

            {/* REINSTATED CALCULATED RESULTS PER ZONE */}
            <div className="mt-6 space-y-6">
              {results?.map((z, zIdx) => (
                <div
                  key={zIdx}
                  className="bg-gray-300/60 rounded-md border-2 border-gray-500 p-5 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-300"
                >
                  <div className="flex justify-between items-center mb-4 border-b border-gray-500 pb-3">
                    <h4 className="text-xs font-black text-indigo-800 uppercase tracking-widest">
                      {z.zoneName} Coordination Yield
                    </h4>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleZoneLockAllToggle(zIdx)}
                        className="text-[9px] font-black bg-white text-gray-600 border border-gray-500 px-2 py-0.5 rounded hover:bg-gray-200 transition-colors"
                      >
                        TOGGLE LOCKS
                      </button>
                      <button
                        onClick={() => handleZoneActiveToggle(zIdx)}
                        className="text-[9px] font-black bg-white text-gray-600 border border-gray-500 px-2 py-0.5 rounded hover:bg-gray-200 transition-colors"
                      >
                        TOGGLE RF
                      </button>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {(() => {
                      const groupedPairs: Record<string, typeof z.pairs> = {};
                      z.pairs.forEach((p) => {
                        const group = p.groupName || z.zoneName;
                        if (!groupedPairs[group]) groupedPairs[group] = [];
                        groupedPairs[group].push(p);
                      });

                      return Object.entries(groupedPairs).map(
                        ([groupName, pairsInGroup]) => (
                          <div key={groupName}>
                            <h5 className="text-[10px] font-black text-gray-700 uppercase tracking-widest mb-2 border-b border-gray-500 pb-1 block w-fit pr-4">
                              {groupName} Frequencies
                            </h5>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                              {pairsInGroup.map((p) => {
                                const active = p.active !== false;
                                return (
                                  <div
                                    key={p.id}
                                    className={`p-3 bg-white/80 border-2 transition-all rounded-md flex justify-between items-center group ${active ? "border-gray-500 hover:border-indigo-500/50 shadow-sm border border-slate-700/50" : "border-slate-800/50 opacity-60 grayscale-[0.5]"}`}
                                  >
                                    <div className="flex items-center gap-3 flex-1 overflow-hidden">
                                      <div className="flex flex-col items-center gap-1 flex-shrink-0">
                                        <button
                                          onClick={() =>
                                            handleActiveToggle(zIdx, p.id)
                                          }
                                          className={`w-8 h-4 rounded-full relative transition-colors ${active ? "bg-emerald-500" : "bg-gray-200"}`}
                                        >
                                          <div
                                            className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${active ? "left-0.5" : "left-4.5"}`}
                                          />
                                        </button>
                                        <span
                                          className={`text-[8px] font-black uppercase ${active ? "text-emerald-400" : "text-gray-700"}`}
                                        >
                                          {active ? "ON" : "OFF"}
                                        </span>
                                      </div>
                                      <div className="font-mono text-[10px] space-y-1.5 flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-1.5 bg-black/20 rounded p-1">
                                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                            <button
                                              onClick={() =>
                                                handleToggleBase(
                                                  zIdx,
                                                  p.id,
                                                  "txIsBase",
                                                )
                                              }
                                              className={`text-[8px] font-black flex-shrink-0 px-1 py-0.5 rounded border transition-colors ${
                                                (p.txIsBase ??
                                                (mode === "europe"
                                                  ? p.tx > 464
                                                  : p.tx < 464))
                                                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                                                  : "bg-blue-500/20 border-blue-500/40 text-blue-400"
                                              }`}
                                              title="Toggle Base (Constant TX) vs SW (Intermittent)"
                                            >
                                              {(p.txIsBase ??
                                              (mode === "europe"
                                                ? p.tx > 464
                                                : p.tx < 464))
                                                ? "BASE"
                                                : "SW"}
                                            </button>
                                            <ManualFreqInput
                                              value={p.tx}
                                              onChange={(v) =>
                                                handleResultFrequencyChange(
                                                  zIdx,
                                                  p.id,
                                                  "tx",
                                                  v,
                                                )
                                              }
                                              className="w-full bg-transparent p-0 text-black font-bold outline-none border-none text-[10px]"
                                            />
                                          </div>
                                          <div className="flex gap-0.5 transition-opacity flex-shrink-0">
                                            <button
                                              onClick={() =>
                                                handleFrequencyStep(
                                                  p.id,
                                                  "tx",
                                                  "down",
                                                )
                                              }
                                              className="text-[8px] bg-gray-200 text-black rounded px-1 hover:bg-blue-600"
                                            >
                                              -
                                            </button>
                                            <button
                                              onClick={() =>
                                                handleFrequencyStep(
                                                  p.id,
                                                  "tx",
                                                  "up",
                                                )
                                              }
                                              className="text-[8px] bg-gray-200 text-black rounded px-1 hover:bg-blue-600"
                                            >
                                              +
                                            </button>
                                          </div>
                                        </div>
                                        <div className="flex items-center justify-between gap-1.5 bg-black/20 rounded p-1">
                                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                            <button
                                              onClick={() =>
                                                handleToggleBase(
                                                  zIdx,
                                                  p.id,
                                                  "rxIsBase",
                                                )
                                              }
                                              className={`text-[8px] font-black flex-shrink-0 px-1 py-0.5 rounded border transition-colors ${
                                                (p.rxIsBase ??
                                                (mode === "europe"
                                                  ? p.rx > 464
                                                  : p.rx < 464))
                                                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                                                  : "bg-blue-500/20 border-blue-500/40 text-blue-400"
                                              }`}
                                              title="Toggle Base (Constant TX) vs SW (Intermittent)"
                                            >
                                              {(p.rxIsBase ??
                                              (mode === "europe"
                                                ? p.rx > 464
                                                : p.rx < 464))
                                                ? "BASE"
                                                : "SW"}
                                            </button>
                                            <ManualFreqInput
                                              value={p.rx}
                                              onChange={(v) =>
                                                handleResultFrequencyChange(
                                                  zIdx,
                                                  p.id,
                                                  "rx",
                                                  v,
                                                )
                                              }
                                              className="w-full bg-transparent p-0 text-black font-bold outline-none border-none text-[10px]"
                                            />
                                          </div>
                                          <div className="flex gap-0.5 transition-opacity flex-shrink-0">
                                            <button
                                              onClick={() =>
                                                handleFrequencyStep(
                                                  p.id,
                                                  "rx",
                                                  "down",
                                                )
                                              }
                                              className="text-[8px] bg-gray-200 text-black rounded px-1 hover:bg-blue-600"
                                            >
                                              -
                                            </button>
                                            <button
                                              onClick={() =>
                                                handleFrequencyStep(
                                                  p.id,
                                                  "rx",
                                                  "up",
                                                )
                                              }
                                              className="text-[8px] bg-gray-200 text-black rounded px-1 hover:bg-blue-600"
                                            >
                                              +
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 ml-1.5 border-l border-gray-500 pl-1.5 flex-shrink-0">
                                      <button
                                        onClick={() =>
                                          handleLockToggle(zIdx, p.id)
                                        }
                                        className={`p-1 rounded transition-all ${p.locked ? "text-amber-500 bg-amber-500/10" : "text-slate-600 hover:text-gray-700"}`}
                                        title={p.locked ? "Unlock" : "Lock"}
                                      >
                                        <span className="text-xs">
                                          {p.locked ? "🔒" : "🔓"}
                                        </span>
                                      </button>
                                      <button
                                        onClick={() =>
                                          handleRemoveResult(zIdx, p.id)
                                        }
                                        className="text-red-400 hover:text-red-300 p-1 font-bold text-base font-medium leading-none"
                                        title="Remove pair"
                                      >
                                        &times;
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ),
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>
            </div>
          </Card>
        </div>

        {showLivePreview && results && (
          <div className="xl:w-1/3 h-[calc(100vh-120px)]">
            <LivePdfPreview
              generatePdf={generateInternalPdf}
              title="Zonal Coordination Preview"
              onDownload={() => handleExport("pdf")}
            />
          </div>
        )}
      </div>

      <PdfPreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        generatePdf={generatePdfForPreview}
        filename={`zonal_talkback_rf_plan_${new Date().toISOString().slice(0, 10)}`}
      />

      <motion.button
        drag
        dragMomentum={false}
        onClick={() => { if (!isLoading) handleCalculate(); }}
        disabled={isLoading}
        className={`fixed bottom-12 right-12 z-[1000] cursor-grab active:cursor-grabbing shadow-2xl flex items-center justify-center gap-3 py-3 px-4 rounded-md font-black uppercase tracking-widest transition-colors border-b-4 ring-2 text-sm ${isLoading ? 'bg-slate-800 text-slate-500 border-slate-900 ring-slate-800/50 shadow-none' : 'bg-yellow-500 text-slate-900 border-yellow-700 hover:bg-yellow-400 ring-yellow-400/50 shadow-yellow-500/20'}`}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {isLoading ? (
          <><span className="w-3.5 h-3.5 border-4 border-slate-500/20 border-t-slate-500 rounded-full animate-spin"></span>COORDINATING...</>
        ) : (
          <><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg> GENERATE</>
        )}
      </motion.button>
    </div>
  );
};

export default ZonalTalkbackTab;
