import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Settings } from "lucide-react";
import Card, { CardTitle, Placeholder } from "./Card";
import {
  DuplexPair,
  TalkbackIntermods,
  IntermodProduct,
  TalkbackSolution,
  Conflict,
  Frequency,
  Thresholds,
  TxType,
  TalkbackMode,
} from "../types";
import {
  calculateTalkbackIntermods,
  checkTalkbackCompatibility,
  toHz,
} from "../services/rfService";
import {
  DISCRETE_TALKBACK_PAIRS,
  TALKBACK_DEFINITIONS,
  TALKBACK_FIXED_PAIRS,
  TALKBACK_FORBIDDEN_RANGES_BY_COUNTRY,
} from "../constants";
import {
  EngagingLoadingState,
  CelebratorySuccessState,
} from "./EngagingStates";
import {
  generateBrandedPdf,
  getTableStyles,
  generateFullCoordinationPdf,
} from "../src/utils/pdfBranding";
import {
  exportToJson,
  exportToWwbCsv,
  CoordinationExportData,
} from "../src/utils/exportUtils";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import PdfPreviewModal from "./PdfPreviewModal";
import { LivePdfPreview } from "./LivePdfPreview";

interface DuplexPairWithBw extends DuplexPair {
  txBw?: number;
  rxBw?: number;
}

interface CoordinationGroup {
  id: string;
  type: "duplex" | "simplex-tx" | "simplex-walkie";
  mode: "standard" | "custom";
  count: number;
  // For standard
  txBand?: number;
  rxBand?: number;
  // For custom
  txMin: number;
  txMax: number;
  rxMin: number;
  rxMax: number;
  bw: number;
}

const buttonBase =
  "px-4 py-2.5 rounded-sm font-semibold uppercase tracking-wide transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 transform active:translate-y-0.5 text-xs";
const primaryButton = `bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-b-4 border-blue-800 hover:border-blue-700 hover:brightness-110 ${buttonBase} disabled:opacity-50`;
const secondaryButton = `bg-slate-700 text-slate-200 border-b-4 border-slate-900 hover:border-slate-800 hover:bg-slate-600 ${buttonBase}`;
const actionButton = `bg-cyan-600/80 text-white border-b-4 border-cyan-800 hover:border-cyan-700 hover:bg-cyan-600 ${buttonBase}`;
const greenButton = `bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 ${buttonBase}`;

const StatusPill = ({
  label,
  value,
  color = "indigo",
  subValue,
  total,
}: {
  label: string;
  value: string | number;
  color?: string;
  subValue?: string;
  total?: number;
}) => {
  const colorClasses = {
    indigo:
      "bg-indigo-500/10 border-indigo-500/20 text-indigo-300 ring-indigo-500/30",
    emerald:
      "bg-emerald-500/10 border-emerald-500/20 text-emerald-300 ring-emerald-500/30",
    rose: "bg-rose-500/10 border-rose-500/20 text-rose-300 ring-rose-500/30",
    amber:
      "bg-amber-500/10 border-amber-500/20 text-black ring-amber-500/30",
  }[color as "indigo" | "emerald" | "rose" | "amber"];

  return (
    <div
      className={`flex items-center gap-3 px-3 py-1.5 rounded-full border shadow-sm ring-1 ring-inset ${colorClasses} animate-in fade-in zoom-in duration-300`}
    >
      <div className="flex flex-col">
        <span className="text-[8px] font-black uppercase tracking-widest opacity-60 leading-none mb-0.5">
          {label}
        </span>
        <div className="flex items-baseline gap-1">
          <span className="text-sm font-black tracking-tighter leading-none">
            {value}
          </span>
          {subValue && (
            <span className="text-[9px] font-bold opacity-50">{subValue}</span>
          )}
        </div>
      </div>
      {color === "emerald" &&
        total &&
        typeof value === "number" &&
        value >= total &&
        total > 0 && (
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
        )}
      {color === "rose" &&
        total &&
        typeof value === "number" &&
        value < total && (
          <div className="w-2 h-2 rounded-full bg-rose-400 animate-pulse shadow-[0_0_8px_rgba(251,113,113,0.8)]" />
        )}
    </div>
  );
};

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
    value === 0 ? "" : value.toFixed(5),
  );
  const isFocused = useRef(false);

  useEffect(() => {
    if (!isFocused.current) {
      setLocalString(value === 0 ? "" : value.toFixed(5));
    }
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

interface TalkbackTabProps {
  manualPairs: DuplexPair[];
  setManualPairs: React.Dispatch<React.SetStateAction<DuplexPair[]>>;
  results: DuplexPair[] | null;
  setResults: React.Dispatch<React.SetStateAction<DuplexPair[] | null>>;
  user?: any;
}

const talkbackCache: Record<string, any> = {};

function useCachedState<T>(key: string, initialValue: T | (() => T)): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    if (talkbackCache[key] !== undefined) return talkbackCache[key];
    return typeof initialValue === "function" ? (initialValue as any)() : initialValue;
  });
  useEffect(() => {
    talkbackCache[key] = state;
  }, [key, state]);
  return [state, setState];
}

const TalkbackTab: React.FC<TalkbackTabProps> = ({
  manualPairs,
  setManualPairs,
  results,
  setResults,
  user,
}) => {
  const [mode, setMode] = useCachedState<TalkbackMode>("mode", "standard");
  const [txBands, setTxBands] = useCachedState<Set<number>>("txBands", new Set());
  const [rxBands, setRxBands] = useCachedState<Set<number>>("rxBands", new Set());
  const [simplexTxBands, setSimplexTxBands] = useCachedState<Set<number>>("simplexTxBands", new Set());
  const [simplexWalkieBands, setSimplexWalkieBands] = useCachedState<Set<number>>(
    "simplexWalkieBands",
    new Set()
  );
  const [selectedCountry, setSelectedCountry] = useCachedState<
    "UK" | "USA" | "Other"
  >("selectedCountry", "UK");
  const [useTargetSeparation, setUseTargetSeparation] =
    useCachedState<boolean>("useTargetSeparation", false);
  const [targetSeparation, setTargetSeparation] = useCachedState<number>("targetSeparation", 10.0);
  const [exactSeparation, setExactSeparation] = useCachedState<boolean>("exactSeparation", false);

  // Coordination Groups
  const [coordinationGroups, setCoordinationGroups] = useCachedState<
    CoordinationGroup[]
  >("coordinationGroups", [
    {
      id: "default-duplex",
      type: "duplex",
      mode: "standard",
      count: 0,
      txBand: mode === "europe" ? 467 : 457,
      rxBand: mode === "europe" ? 457 : 467,
      txMin: 450,
      txMax: 453,
      rxMin: 465,
      rxMax: 467,
      bw: 0.0125,
    },
  ]);

  // Legacy states kept for internal transition if needed, but we'll focus on coordinationGroups
  const [isCalculating, setIsCalculating] = useState(false);

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsCalculating(false);
      toast.info("Coordination cancelled");
    }
  };

  const checkPairComp = (
    pair: { tx: number; rx: number },
    plan: DuplexPair[],
  ) => {
    const dummyDist = [[0]];
    const dummyMatrix = [[false]];
    const freqs: Frequency[] = [
      ...plan
        .map((p) => [
          {
            value: p.tx,
            type: "comms" as TxType,
            id: `${p.id}-tx`,
            zoneIndex: 0,
            isTx: p.txIsBase ?? true,
            label: (p.txIsBase ?? true) ? "Base TX" : "SW TX",
          },
          {
            value: p.rx,
            type: "comms" as TxType,
            id: `${p.id}-rx`,
            zoneIndex: 0,
            isTx: p.rxIsBase ?? false,
            label: (p.rxIsBase ?? false) ? "Base RX" : "Port RX",
          },
        ])
        .flat(),
      {
        value: pair.tx,
        type: "comms" as TxType,
        id: "cand-tx",
        zoneIndex: 0,
        isTx: true,
        label: "Base TX",
      },
      {
        value: pair.rx,
        type: "comms" as TxType,
        id: "cand-rx",
        zoneIndex: 0,
        isTx: false,
        label: "Port RX",
      },
    ].filter((f) => f.value > 0);

    const result = checkTalkbackCompatibility(
      freqs,
      dummyDist,
      dummyMatrix,
      mode,
      selectedCountry,
      customBaseRange,
    );
    return result.conflicts.length === 0;
  };
  const [genProgress, setGenProgress] = useState(0);
  const [showTable, setShowTable] = useCachedState("showTable", false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [showLivePreview, setShowLivePreview] = useCachedState("showLivePreview", false);
  const [sortField, setSortField] = useCachedState<string>("sortField", "tx");
  const [sortDirection, setSortDirection] = useCachedState<"asc" | "desc">("sortDirection", "asc");
  const [bulkAddCount, setBulkAddCount] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Custom Range State
  const [customBw, setCustomBw] = useCachedState<number>("customBw", 0.0125);

  // Per-section custom modes
  const [duplexCustomMode, setDuplexCustomMode] = useCachedState<
    "standard" | "custom"
  >("duplexCustomMode", "custom");
  const [simplexCustomMode, setSimplexCustomMode] = useCachedState<
    "standard" | "custom"
  >("simplexCustomMode", "custom");

  // Auditor Custom Ranges
  const [customBaseRange, setCustomBaseRange] = useCachedState("customBaseRange", {
    min: 450,
    max: 464,
  });
  const [customSwRange, setCustomSwRange] = useCachedState("customSwRange", { min: 464, max: 470 });

  const [range, setRange] = useCachedState("range", { min: 429.8, max: 484.8 });
  const [centerFreqInput, setCenterFreqInput] = useCachedState<string>("centerFreqInput", "457.3000");
  const [centerStepMhz, setCenterStepMhz] = useCachedState("centerStepMhz", "1.0");
  const [spanIncrementMhz, setSpanIncrementMhz] = useCachedState("spanIncrementMhz", "5.0");
  const [showTwoTone, setShowTwoTone] = useCachedState("showTwoTone", true);
  const [showThreeTone, setShowThreeTone] = useCachedState("showThreeTone", true);
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
  const [manualExclusions, setManualExclusions] = useCachedState<string>("talkbackManualExclusions", "");

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

  // Audit State
  const [diagnosticConflicts, setDiagnosticConflicts] = useState<Conflict[]>(
    [],
  );
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [isEnteringFreq, setIsEnteringFreq] = useState(false);
  const [keypadMode, setKeypadMode] = useCachedState<"add" | "center">("keypadMode", "add");
  const [auditBandwidth, setAuditBandwidth] = useCachedState("auditBandwidth", "0.0125");
  const [auditTuningStep, setAuditTuningStep] = useCachedState("auditTuningStep", "0.00625");
  const [expandedAuditIds, setExpandedAuditIds] = useState<string[]>([]);
  const [showTooltips, setShowTooltips] = useCachedState("showTooltips", true);

  const baseBands = mode === "europe" ? EUROPE_BASE_BANDS : STANDARD_BASE_BANDS;
  const portBands = mode === "europe" ? EUROPE_PORT_BANDS : STANDARD_PORT_BANDS;

  const availableSimplexBaseBands =
    mode === "europe" ? EUROPE_SIMPLEX_BASE_BANDS : STANDARD_SIMPLEX_BASE_BANDS;
  const availableSimplexWalkieBands =
    mode === "europe"
      ? EUROPE_SIMPLEX_WALKIE_BANDS
      : STANDARD_SIMPLEX_WALKIE_BANDS;

  useEffect(() => {
    setCenterFreqInput(((range.min + range.max) / 2).toFixed(5));
  }, [range]);

  const handleBandChange = (band: number, type: "tx" | "rx") => {
    const setter = type === "tx" ? setTxBands : setRxBands;
    setter((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(band)) newSet.delete(band);
      else newSet.add(band);
      return newSet;
    });
  };

  const handleSimplexBandChange = (band: number, type: "tx" | "walkie") => {
    const setter = type === "tx" ? setSimplexTxBands : setSimplexWalkieBands;
    setter((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(band)) newSet.delete(band);
      else newSet.add(band);
      return newSet;
    });
  };

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
              field === "rxBw") &&
            typeof value !== "boolean";
          const numVal = isNumeric ? parseFloat(value) || 0 : value;
          return { ...pair, [field]: numVal };
        }
        return pair;
      }),
    );
  };

  const handleToggleBase = (pairId: string, field: "txIsBase" | "rxIsBase") => {
    setResults((prev) =>
      prev
        ? prev.map((p) => (p.id === pairId ? { ...p, [field]: !p[field] } : p))
        : null,
    );
  };

  const handleResultChange = (
    id: string,
    field: "tx" | "rx",
    value: string,
  ) => {
    const numVal = parseFloat(value) || 0;
    setResults((prev) =>
      prev
        ? prev.map((p) => (p.id === id ? { ...p, [field]: numVal } : p))
        : null,
    );
  };

  const handleFrequencyStep = (
    pairId: string,
    field: "tx" | "rx",
    direction: "up" | "down",
  ) => {
    const step = parseFloat(auditTuningStep) || 0.00625;
    const updateLogic = (pairs: DuplexPair[]): DuplexPair[] =>
      pairs.map((p) => {
        if (p.id === pairId) {
          const typedField = field as "tx" | "rx";
          const currentVal = p[typedField] || 0;
          const newVal = parseFloat(
            (direction === "up"
              ? currentVal + step
              : currentVal - step
            ).toFixed(5),
          );
          return { ...p, [typedField]: newVal };
        }
        return p;
      });
    if (manualPairs.some((p) => p.id === pairId)) setManualPairs(updateLogic);
    else setResults((current) => (current ? updateLogic(current) : null));
  };

  const handleLockAllResults = () => {
    if (!results) return;
    const targetState = !allResultsLocked;
    setResults((prev) =>
      prev ? prev.map((p) => ({ ...p, locked: targetState })) : null,
    );
  };

  const handleResultLockToggle = (id: string) => {
    const update = (prev: DuplexPair[] | null) =>
      prev
        ? prev.map((p) => (p.id === id ? { ...p, locked: !p.locked } : p))
        : null;
    setResults(update);
    setManualPairs((prev) =>
      prev.map((p) => (p.id === id ? { ...p, locked: !p.locked } : p)),
    );
  };

  const handleResultActiveToggle = (id: string) => {
    const update = (prev: DuplexPair[] | null) =>
      prev
        ? prev.map((p) =>
            p.id === id ? { ...p, active: p.active === false } : p,
          )
        : null;
    setResults(update);
    setManualPairs((prev) =>
      prev.map((p) => (p.id === id ? { ...p, active: p.active === false } : p)),
    );
  };

  const handleResultTxActiveToggle = (id: string) => {
    const update = (prev: DuplexPair[] | null) =>
      prev
        ? prev.map((p) =>
            p.id === id ? { ...p, txActive: p.txActive === false } : p,
          )
        : null;
    setResults(update);
    setManualPairs((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, txActive: p.txActive === false } : p,
      ),
    );
  };

  const handleResultRxActiveToggle = (id: string) => {
    const update = (prev: DuplexPair[] | null) =>
      prev
        ? prev.map((p) =>
            p.id === id ? { ...p, rxActive: p.rxActive === false } : p,
          )
        : null;
    setResults(update);
    setManualPairs((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, rxActive: p.rxActive === false } : p,
      ),
    );
  };

  const handleRemoveResult = (id: string) => {
    setResults((prev) => (prev ? prev.filter((p) => p.id !== id) : null));
    setManualPairs((prev) => prev.filter((p) => p.id !== id));
  };

  const toggleAuditExpanded = (id: string) => {
    setExpandedAuditIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleCloneAuditFrequency = (pair: DuplexPairWithBw) => {
    const newId = `man-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newPair: DuplexPairWithBw = {
      ...pair,
      id: newId,
      label: pair.label && pair.label.includes("Carrier") 
        ? "Cloned Carrier" 
        : pair.label 
          ? `${pair.label} (Clone)` 
          : "Cloned Carrier",
      locked: true,
      active: true,
    };
    setManualPairs((p) => [...p, newPair]);
    toast.success(`Frequency ${pair.tx.toFixed(5)} cloned to Audit Ledger`);
  };

  const allResultsLocked = useMemo(() => {
    if (!results || results.length === 0) return false;
    return results.every((p) => p.locked);
  }, [results]);

  const addCoordinationGroup = () => {
    const newGroup: CoordinationGroup = {
      id: `group-${Date.now()}`,
      type: "duplex",
      mode: "standard",
      count: 2,
      txBand: mode === "europe" ? 467 : 457,
      rxBand: mode === "europe" ? 457 : 467,
      txMin: 450,
      txMax: 453,
      rxMin: 465,
      rxMax: 467,
      bw: 0.0125,
    };
    setCoordinationGroups((prev) => [...prev, newGroup]);
  };

  const removeCoordinationGroup = (id: string) => {
    setCoordinationGroups((prev) => prev.filter((g) => g.id !== id));
  };

  const updateCoordinationGroup = (
    id: string,
    updates: Partial<CoordinationGroup>,
  ) => {
    setCoordinationGroups((prev) =>
      prev.map((g) => (g.id === id ? { ...g, ...updates } : g)),
    );
  };

  const handleGenerate = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const signal = abortController.signal;

    setIsCalculating(true);
    setGenProgress(0);
    await new Promise((r) => setTimeout(r, 50));

    const SPACING_FF = 0.0125;
    const SPACING_IMD = 0.0125;

    const isForbidden = (f: number) => {
      if (parsedExclusions && parsedExclusions.length > 0) {
        const inManualExclusion = parsedExclusions.some(
          (zone) => f >= zone.min - 0.000005 && f <= zone.max + 0.000005
        );
        if (inManualExclusion) return true;
      }

      // Disable 450-453 MHz AND 465-467 MHz forbidden zones in Mainland Europe mode
      if (mode === "europe") {
        const is450Range = f >= 450 && f <= 453;
        const is465Range = f >= 465 && f <= 467;
        if (is450Range || is465Range) return false;
      }
      const forbiddenRanges =
        TALKBACK_FORBIDDEN_RANGES_BY_COUNTRY[selectedCountry] || [];
      return forbiddenRanges.some(
        (range) => f >= range.min - 0.000005 && f <= range.max + 0.000005,
      );
    };

    const lockedResults =
      results?.filter((p) => p.locked && p.active !== false) || [];
    const lockedManuals = manualPairs
      .filter((p) => p.tx > 0 || p.rx > 0)
      .map((p) => ({
        ...p,
        groupName: "Manual Entry",
        locked: true,
        active: true,
        txIsBase: p.txIsBase ?? (mode === "europe" ? p.tx > 464 : p.tx < 464),
        rxIsBase: p.rxIsBase ?? (mode === "europe" ? p.rx > 464 : p.rx < 464),
      })) as DuplexPair[];

    let bestSolution: DuplexPair[] = [];
    const lockedInSync = [...lockedResults, ...lockedManuals];

    for (let i = 0; i < 5000; i++) {
      if (signal.aborted) {
        setIsCalculating(false);
        setGenProgress(0);
        abortControllerRef.current = null;
        return;
      }

      const current: DuplexPair[] = [];
      const activePool = [...lockedInSync];

      // Helper to check compatibility against currently accumulated plan
      const SPACING_FF_HZ = toHz(SPACING_FF);
      const SPACING_IMD_HZ = toHz(SPACING_IMD);
      const isComp = (cand: { tx: number; rx: number }, plan: DuplexPair[]) => {
        if (cand.tx > 0 && isForbidden(cand.tx)) return false;
        if (cand.rx > 0 && isForbidden(cand.rx)) return false;

        const candTxHz = toHz(cand.tx);
        const candRxHz = toHz(cand.rx);

        const txHzs: number[] = [];
        const victimHzs: number[] = [];

        for (let i = 0; i < plan.length; i++) {
          const p = plan[i];
          if (p.tx > 0) {
            const hz = toHz(p.tx);
            if (p.txIsBase ?? true) txHzs.push(hz);
            victimHzs.push(hz);
          }
          if (p.rx > 0) {
            const hz = toHz(p.rx);
            if (p.rxIsBase ?? false) txHzs.push(hz);
            victimHzs.push(hz);
          }
        }

        const fullVictimHzs = [...victimHzs];
        if (cand.tx > 0) fullVictimHzs.push(candTxHz);
        if (cand.rx > 0) fullVictimHzs.push(candRxHz);

        // 1. Fundamental Clashes
        for (let i = 0; i < victimHzs.length; i++) {
          const vHz = victimHzs[i];
          if (cand.tx > 0 && Math.abs(candTxHz - vHz) < SPACING_FF_HZ) return false;
          if (cand.rx > 0 && Math.abs(candRxHz - vHz) < SPACING_FF_HZ) return false;
        }
        if (cand.tx > 0 && cand.rx > 0 && Math.abs(candTxHz - candRxHz) < SPACING_FF_HZ) return false;

        // 2. IMD Checks
        // Case 1: Candidate is victim of existing TXs
        if (cand.tx > 0 || cand.rx > 0) {
            // 2-tone
            for (let a = 0; a < txHzs.length; a++) {
                const f1 = txHzs[a];
                for (let b = 0; b < txHzs.length; b++) {
                    if (a === b) continue;
                    const f2 = txHzs[b];
                    const p2 = 2 * f1 - f2;
                    if (cand.tx > 0 && Math.abs(candTxHz - p2) < SPACING_IMD_HZ) return false;
                    if (cand.rx > 0 && Math.abs(candRxHz - p2) < SPACING_IMD_HZ) return false;
                }
            }
            // 3-tone
            for (let a = 0; a < txHzs.length; a++) {
                const f1 = txHzs[a];
                for (let b = a + 1; b < txHzs.length; b++) {
                    const f2 = txHzs[b];
                    for (let c = b + 1; c < txHzs.length; c++) {
                        const f3 = txHzs[c];
                        const p3a = f1 + f2 - f3;
                        const p3b = f1 + f3 - f2;
                        const p3c = f2 + f3 - f1;
                        if (cand.tx > 0) {
                            if (Math.abs(candTxHz - p3a) < SPACING_IMD_HZ) return false;
                            if (Math.abs(candTxHz - p3b) < SPACING_IMD_HZ) return false;
                            if (Math.abs(candTxHz - p3c) < SPACING_IMD_HZ) return false;
                        }
                        if (cand.rx > 0) {
                            if (Math.abs(candRxHz - p3a) < SPACING_IMD_HZ) return false;
                            if (Math.abs(candRxHz - p3b) < SPACING_IMD_HZ) return false;
                            if (Math.abs(candRxHz - p3c) < SPACING_IMD_HZ) return false;
                        }
                    }
                }
            }
        }

        // Case 2: Candidate TX causes IMD on existing victims
        if (cand.tx > 0) {
            for (let i = 0; i < fullVictimHzs.length; i++) {
                const vHz = fullVictimHzs[i];
                // 2-tone
                for (let j = 0; j < txHzs.length; j++) {
                    const f = txHzs[j];
                    const p2a = 2 * candTxHz - f;
                    const p2b = 2 * f - candTxHz;
                    if (Math.abs(vHz - p2a) < SPACING_IMD_HZ) return false;
                    if (Math.abs(vHz - p2b) < SPACING_IMD_HZ) return false;
                }
                
                // 3-tone
                for (let a = 0; a < txHzs.length; a++) {
                    const f1 = txHzs[a];
                    for (let b = a + 1; b < txHzs.length; b++) {
                        const f2 = txHzs[b];
                        const p3a = candTxHz + f1 - f2;
                        const p3b = candTxHz + f2 - f1;
                        const p3c = f1 + f2 - candTxHz;
                        if (Math.abs(vHz - p3a) < SPACING_IMD_HZ) return false;
                        if (Math.abs(vHz - p3b) < SPACING_IMD_HZ) return false;
                        if (Math.abs(vHz - p3c) < SPACING_IMD_HZ) return false;
                    }
                }
            }
        }
        
        return true;
      };

      let allSatisfied = true;

      for (const group of coordinationGroups) {
        if (group.count <= 0) continue;

        const groupLockedCount = lockedInSync.filter(
          (p) =>
            p.groupName === (group.txBand ? `Band ${group.txBand}` : "Custom"),
        ).length;
        const needed = Math.max(0, group.count - groupLockedCount);
        if (needed === 0) continue;

        let groupFount = 0;

        // Build Pool for this group
        let pool: { tx: number; rx: number }[] = [];

        const buildDuplexPairsWithSeparation = (
          tF: number[],
          rF: number[],
          targetSep: number,
        ) => {
          const pairs: { tx: number; rx: number }[] = [];
          const tolerance = exactSeparation ? 0.0001 : 0.1001;
          for (const tx of tF) {
            for (const rx of rF) {
              if (
                !useTargetSeparation ||
                Math.abs(Math.abs(tx - rx) - targetSep) <= tolerance
              ) {
                pairs.push({ tx, rx });
              }
            }
          }
          pairs.sort(() => Math.random() - 0.5);
          return pairs.slice(0, 500);
        };

        if (group.mode === "standard") {
          if (group.type === "duplex") {
            const txB = group.txBand || 457;
            const rxB = group.rxBand || 467;

            // Check for discrete pairs first
            const discrete = DISCRETE_TALKBACK_PAIRS[txB];
            if (discrete && rxB === TALKBACK_FIXED_PAIRS[txB]) {
              // Only use discrete pairs if bw is 12.5kHz (which is what they were built for)
              if (group.bw === 0.0125) {
                pool = useTargetSeparation
                  ? discrete.filter(
                      (p) =>
                        Math.abs(Math.abs(p.tx - p.rx) - targetSeparation) <=
                        (exactSeparation ? 0.0001 : 0.1001),
                    )
                  : [...discrete];
              } else {
                // Generate from definitions using the requested bw
                const txDef = TALKBACK_DEFINITIONS[txB];
                const rxDef = TALKBACK_DEFINITIONS[rxB];
                const tFreqs: number[] = [];
                const rFreqs: number[] = [];
                const startOffset = 0;
                if (txDef)
                  for (
                    let f = txDef.min + startOffset;
                    f <= txDef.max + 0.0001;
                    f += group.bw
                  )
                    tFreqs.push(parseFloat(f.toFixed(5)));
                if (rxDef)
                  for (
                    let f = rxDef.min + startOffset;
                    f <= rxDef.max + 0.0001;
                    f += group.bw
                  )
                    rFreqs.push(parseFloat(f.toFixed(5)));

                pool = buildDuplexPairsWithSeparation(
                  tFreqs,
                  rFreqs,
                  targetSeparation,
                );
              }
            } else {
              // Build from ranges
              const txDef = TALKBACK_DEFINITIONS[txB];
              const rxDef = TALKBACK_DEFINITIONS[rxB];
              const tFreqs: number[] = [];
              const rFreqs: number[] = [];
              const startOffset = 0;
              if (txDef)
                for (
                  let f = txDef.min + startOffset;
                  f <= txDef.max + 0.0001;
                  f += group.bw
                )
                  tFreqs.push(parseFloat(f.toFixed(5)));
              if (rxDef)
                for (
                  let f = rxDef.min + startOffset;
                  f <= rxDef.max + 0.0001;
                  f += group.bw
                )
                  rFreqs.push(parseFloat(f.toFixed(5)));

              pool = buildDuplexPairsWithSeparation(
                tFreqs,
                rFreqs,
                targetSeparation,
              );
            }
          } else if (group.type === "simplex-tx") {
            const b = group.txBand || 457;
            const def = TALKBACK_DEFINITIONS[b];
            const startOffset = 0;
            if (def)
              for (
                let f = def.min + startOffset;
                f <= def.max + 0.0001;
                f += group.bw
              )
                pool.push({ tx: parseFloat(f.toFixed(5)), rx: 0 });
          } else if (group.type === "simplex-walkie") {
            const b = group.rxBand || 467;
            const def = TALKBACK_DEFINITIONS[b];
            const startOffset = 0;
            if (def)
              for (
                let f = def.min + startOffset;
                f <= def.max + 0.0001;
                f += group.bw
              )
                pool.push({ tx: 0, rx: parseFloat(f.toFixed(5)) });
          }
        } else {
          // Custom Mode
          const startOffset = 0;
          const tPool: number[] = [];
          const rPool: number[] = [];
          if (group.txMin && group.txMax) {
            for (
              let f = group.txMin + startOffset;
              f <= group.txMax;
              f += group.bw
            )
              tPool.push(parseFloat(f.toFixed(5)));
          }
          if (group.rxMin && group.rxMax) {
            for (
              let f = group.rxMin + startOffset;
              f <= group.rxMax;
              f += group.bw
            )
              rPool.push(parseFloat(f.toFixed(5)));
          }

          if (group.type === "duplex") {
            pool = buildDuplexPairsWithSeparation(
              tPool,
              rPool,
              targetSeparation,
            );
          } else if (group.type === "simplex-tx") {
            tPool.forEach((f) => pool.push({ tx: f, rx: 0 }));
          } else if (group.type === "simplex-walkie") {
            rPool.forEach((f) => pool.push({ tx: 0, rx: f }));
          }
        }

        // Shuffle pool
        pool.sort(() => Math.random() - 0.5);

        for (const cand of pool) {
          if (groupFount >= needed) break;
          if (isComp(cand, [...current, ...lockedInSync])) {
            const labelPrefix =
              group.type === "duplex"
                ? "CH"
                : group.type === "simplex-tx"
                  ? "Simplex Tx"
                  : "Walkie";
            const gName =
              group.mode === "standard"
                ? `Band ${group.txBand || group.rxBand}`
                : "Custom";
            current.push({
              id: `G-${group.id}-${i}-${current.length}-${Math.random().toString(36).substr(2, 9)}`,
              label: `${labelPrefix} ${current.length + 1 + groupLockedCount}`,
              tx: cand.tx,
              rx: cand.rx,
              groupName: gName,
              txBw: group.bw,
              rxBw: group.bw,
              locked: false,
              active: true,
            });
            groupFount++;
          }
        }

        if (groupFount < needed) allSatisfied = false;
      }

      if (current.length > bestSolution.length) {
        bestSolution = current;
        if (allSatisfied) break;
      }

      if (i % 500 === 0) {
        setGenProgress(i / 5000);
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    setResults([...lockedResults, ...bestSolution]);
    setGenProgress(1);
    setIsCalculating(false);
    setShowSuccess(true);
    abortControllerRef.current = null;
  };

  const allActiveCarriers = useMemo(() => {
    const carriers: {
      value: number;
      label: string;
      type: "tx" | "rx";
      groupName: string;
      bw: number;
      isTx?: boolean;
      partner?: number | null;
      active?: boolean;
    }[] = [];

    manualPairs.forEach((p: DuplexPairWithBw) => {
      const pairActive = p.active !== false;
      const txActive = pairActive && p.txActive !== false;
      const rxActive = pairActive && p.rxActive !== false;

      const txIsBase = p.txIsBase ?? (mode === "europe" ? p.tx > 464 : p.tx < 464);
      const rxIsBase = p.rxIsBase ?? false;

      if (p.tx > 0)
        carriers.push({
          value: p.tx,
          label: p.label,
          type: "tx",
          groupName: p.groupName,
          bw: p.txBw || 0.0125,
          isTx: p.rx === 0 ? true : txIsBase,
          partner: p.rx > 0 ? p.rx : null,
          active: txActive,
        });
      if (p.rx > 0)
        carriers.push({
          value: p.rx,
          label: p.label,
          type: "rx",
          groupName: p.groupName,
          bw: p.rxBw || 0.0125,
          isTx: p.tx === 0 ? false : rxIsBase,
          partner: p.tx > 0 ? p.tx : null,
          active: rxActive,
        });
    });
    if (results) {
      results.forEach((p) => {
        const pairActive = p.active !== false;
        const txActive = pairActive && p.txActive !== false;
        const rxActive = pairActive && p.rxActive !== false;

        const txIsBase = p.txIsBase ?? (mode === "europe" ? p.tx > 464 : p.tx < 464);
        const rxIsBase = p.rxIsBase ?? false;

        if (p.tx > 0)
          carriers.push({
            value: p.tx,
            label: p.label,
            type: "tx",
            groupName: p.groupName,
            bw: (p as any).txBw || 0.0125,
            isTx: p.rx === 0 ? true : txIsBase,
            partner: p.rx > 0 ? p.rx : null,
            active: txActive,
          });
        if (p.rx > 0)
          carriers.push({
            value: p.rx,
            label: p.label,
            type: "rx",
            groupName: p.groupName,
            bw: (p as any).rxBw || 0.0125,
            isTx: p.tx === 0 ? false : rxIsBase,
            partner: p.tx > 0 ? p.tx : null,
            active: rxActive,
          });
      });
    }
    return carriers;
  }, [results, manualPairs]);

  const handleRunAudit = () => {
    const freqList: Frequency[] = allActiveCarriers
      .filter((c) => c.active !== false)
      .map((c) => ({
        id: c.label,
        value: c.value,
        type: "comms" as TxType,
        zoneIndex: 0,
        isTx: c.isTx,
      }));
    const dummyDist = [[0]];
    const dummyMatrix = [[false]];
    const result = checkTalkbackCompatibility(
      freqList,
      dummyDist,
      dummyMatrix,
      mode,
      selectedCountry,
      customBaseRange,
    );
    setDiagnosticConflicts(result.conflicts);
    setHasAnalyzed(true);
  };

  const yieldBreakdown = useMemo(() => {
    if (!results) return null;
    const duplex = results.filter((p) => p.tx > 0 && p.rx > 0).length;
    const simplexTx = results.filter((p) => p.tx > 0 && p.rx === 0).length;
    const simplexWalkie = results.filter((p) => p.tx === 0 && p.rx > 0).length;
    return { duplex, simplexTx, simplexWalkie };
  }, [results]);

  const totalTarget = coordinationGroups.reduce((acc, g) => acc + g.count, 0);
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

  const tabulatedData = useMemo(() => {
    const pairs: DuplexPair[] = [];

    manualPairs.forEach((p) => {
      if (p.active === false) return;
      let type = "Duplex";
      if (p.tx > 0 && p.rx === 0) type = "Simplex Base Tx";
      else if (p.tx === 0 && p.rx > 0) type = "Simplex Walkie";
      pairs.push({
        id: p.id,
        tx: p.tx,
        rx: p.rx,
        label: p.label,
        groupName: p.groupName || "Manual",
        bw: Math.max(p.txBw || 0, p.rxBw || 0) || 0.0125,
        type,
        locked: false,
      });
    });

    if (results) {
      results.forEach((p) => {
        if (p.active === false) return;
        let type = "Duplex";
        if (p.tx > 0 && p.rx === 0) type = "Simplex Base Tx";
        else if (p.tx === 0 && p.rx > 0) type = "Simplex Walkie";
        pairs.push({
          id: p.id,
          tx: p.tx,
          rx: p.rx,
          label: p.label,
          groupName: p.groupName,
          bw: Math.max((p as any).txBw || 0, (p as any).rxBw || 0) || 0.0125,
          type,
          locked: false,
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
  }, [manualPairs, results, sortField, sortDirection]);

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
          band: row.groupName,
          power:
            row.rx > 0 && row.tx > 0 ? "5W / 1W" : row.tx > 0 ? "5W" : "1W",
          bandwidth: `${(row.bw * 1000).toFixed(1)}kHz`,
          parameters: "FM",
          stage: "Talkback",
          type: row.rx > 0 ? "comms-duplex" : "comms",
        };
      });

      return generateFullCoordinationPdf(
        doc,
        "Talkback RF Coordination Plan",
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

  const handleExport = (
    format:
      | "pdf"
      | "branded-pdf"
      | "csv"
      | "xls"
      | "doc"
      | "txt"
      | "json"
      | "wwb",
  ) => {
    console.log("Exporting. User object:", user);
    setIsExportMenuOpen(false);
    const data = tabulatedData;
    const filename = `talkback_rf_plan_${new Date().toISOString().slice(0, 10)}`;

    if (format === "json") {
      const exportData: CoordinationExportData = {
        version: "2.0",
        timestamp: new Date().toISOString(),
        projectName: "Talkback Coordination",
        frequencies: [],
        talkbackPairs: data.map((c) => ({
          id: c.id,
          tx: c.tx,
          rx: c.rx,
          label: c.label || c.id,
          type: c.type,
          group: c.groupName,
          bw: c.bw,
        })),
      };
      exportToJson(exportData, filename);
      toast.success("JSON Exported successfully");
      return;
    }

    if (format === "wwb") {
      exportToWwbCsv([], data, filename);
      toast.success("WWB CSV Exported successfully");
      return;
    }

    if (format === "csv" || format === "xls") {
      let content =
        "Base Tx (MHz),Portable Rx (MHz),Type,Group,Bandwidth (kHz)\n";
      data.forEach(
        (c) =>
          (content += `${c.tx > 0 ? c.tx.toFixed(5) : "—"},${c.rx > 0 ? c.rx.toFixed(5) : "—"},${c.type},"${c.groupName}",${(c.bw * 1000).toFixed(1)}\n`),
      );
      const blob = new Blob([content], {
        type: format === "xls" ? "application/vnd.ms-excel" : "text/csv",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.${format}`;
      a.click();
    } else if (format === "txt") {
      let content =
        "TALKBACK RF COORDINATION PLAN\n============================\n\n";
      data.forEach(
        (c) =>
          (content += `Tx: ${c.tx > 0 ? c.tx.toFixed(5) : "—"} MHz | Rx: ${c.rx > 0 ? c.rx.toFixed(5) : "—"} MHz | ${c.type} | ${c.groupName}\n`),
      );
      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.txt`;
      a.click();
    } else if (format === "doc") {
      let html = `<html><body><h1>Talkback RF Coordination Plan</h1><table border="1"><tr><th>Base Tx (MHz)</th><th>Portable Rx (MHz)</th><th>Type</th><th>Group</th></tr>${data.map((c) => `<tr><td>${c.tx > 0 ? c.tx.toFixed(5) : "—"}</td><td>${c.rx > 0 ? c.rx.toFixed(5) : "—"}</td><td>${c.type}</td><td>${c.groupName}</td></tr>`).join("")}</table></body></html>`;
      const blob = new Blob(["\ufeff", html], { type: "application/msword" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.doc`;
      a.click();
    } else if (format === "pdf" || format === "branded-pdf") {
      const doc = new jsPDF();
      let startY = 20;
      if (format === "branded-pdf") {
        startY = generateBrandedPdf(
          doc,
          "Talkback RF Coordination Plan",
          user?.branding,
        );
      } else {
        doc.setFontSize(18);
        doc.text("Talkback RF Coordination Plan", 14, 20);
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
        startY = 35;
      }

      const tableData = data.map((c) => [
        c.tx > 0 ? c.tx.toFixed(5) : "—",
        c.rx > 0 ? c.rx.toFixed(5) : "—",
        c.type,
        c.groupName,
        (c.bw * 1000).toFixed(1) + "k",
      ]);

      autoTable(doc, {
        startY: startY,
        head: [["Base Tx", "Port Rx", "Type", "Group", "BW"]],
        body: tableData,
        ...getTableStyles(user?.branding?.brandColor, user?.branding),
      });

      doc.save(`${filename}.pdf`);
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

  const [intermods, setIntermods] = useState<{
    twoTone: Array<any>;
    threeTone: Array<any>;
    fiveTone: Array<any>;
    sevenTone: Array<any>;
  }>({ twoTone: [], threeTone: [], fiveTone: [], sevenTone: [] });

  useEffect(() => {
    let isCancelled = false;
    const currentCarriers = allActiveCarriers
      .filter((c) => {
        if (c.active === false) return false;
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
      const result = calculateTalkbackIntermods(currentCarriers);
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
    const centerFreq = (range.min + range.max) / 2;
    setRange({
      min: parseFloat((centerFreq - newSpan / 2).toFixed(5)),
      max: parseFloat((centerFreq + newSpan / 2).toFixed(5)),
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

  const handleKeypadPress = (key: string) => {
    if (key === "CLR") {
      setCenterFreqInput("");
      setIsEnteringFreq(true);
    } else if (key === "DEL") {
      setCenterFreqInput((prev) => prev.slice(0, -1));
      setIsEnteringFreq(true);
    } else if (key === "ENT") {
      const val = parseFloat(centerFreqInput);
      if (!isNaN(val) && val > 0) {
        if (keypadMode === "add") {
          // Add directly to the coordination set as a manual carrier
          const newPair: DuplexPairWithBw = {
            id: `man-${Date.now()}-${Math.random()}`,
            label: "Keypad Entry",
            tx: val,
            rx: 0,
            groupName: "Keypad Entry",
            locked: true,
            active: true,
            txBw: parseFloat(auditBandwidth) || 0.0125,
            rxBw: parseFloat(auditBandwidth) || 0.0125,
          };
          setManualPairs((p) => [...p, newPair]);
          toast.success(`Frequency ${val.toFixed(5)} added to display`);
        } else {
          applyCenterFreq(centerFreqInput);
        }
      }
      setCenterFreqInput("");
      setIsEnteringFreq(false);
    } else {
      if (!isEnteringFreq) {
        setCenterFreqInput(key);
        setIsEnteringFreq(true);
      } else {
        setCenterFreqInput((prev) => prev + key);
      }
    }
  };

  const applyCenterFreq = (value: string) => {
    const newCenter = parseFloat(value);
    if (!isNaN(newCenter)) {
      const currentSpan = range.max - range.min;
      setRange({
        min: parseFloat((newCenter - currentSpan / 2).toFixed(5)),
        max: parseFloat((newCenter + currentSpan / 2).toFixed(5)),
      });
    } else setCenterFreqInput(((range.min + range.max) / 2).toFixed(5));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently focused on an actual input element
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (/^[0-9.]$/.test(e.key)) {
        handleKeypadPress(e.key);
      } else if (e.key === "Backspace" || e.key === "Delete") {
        handleKeypadPress("DEL");
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleKeypadPress("ENT");
      } else if (e.key === "Escape") {
        handleKeypadPress("CLR");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const SectionToggle: React.FC<{
    mode: "standard" | "custom";
    onChange: (mode: "standard" | "custom") => void;
  }> = ({ mode, onChange }) => (
    <div className="flex bg-slate-900 border border-slate-700 rounded-sm p-0.5 shadow-inner">
      <button
        onClick={() => onChange("standard")}
        className={`px-3 py-1 rounded-md text-[9px] font-black uppercase transition-all ${mode === "standard" ? "bg-indigo-600 text-white shadow-md" : "text-slate-500 hover:text-gray-700"}`}
      >
        Standard
      </button>
      <button
        onClick={() => onChange("custom")}
        className={`px-3 py-1 rounded-md text-[9px] font-black uppercase transition-all ${mode === "custom" ? "bg-indigo-600 text-white shadow-md" : "text-slate-500 hover:text-gray-700"}`}
      >
        Custom
      </button>
    </div>
  );

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

            checkHits(allActiveCarriers.filter((c) => c.active !== false));
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
    if (!showTooltips || !mouseCoord || !canvasRef.current || isDragging)
      return null;
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
      if (c.active === false) continue;
      const diff = Math.abs(mouseFreq - c.value);
      if (diff < hitThreshold && diff < minDiff) {
        const partnerText = c.partner
          ? ` | Linked: ${c.partner.toFixed(5)}`
          : "";
        minDiff = diff;
        closestCandidate = {
          text: `${c.label} [${c.type.toUpperCase()}]`,
          subtext: `Freq: ${c.value.toFixed(5)} MHz${partnerText}`,
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
    showTooltips,
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
      const numVert = Math.max(5, Math.min(10, Math.floor(chartWidth / 100)));
      for (let i = 0; i <= numVert; i++) {
        const f = range.min + (i * freqRange) / numVert;
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
          const is465Range = fz.min >= 465 && fz.max <= 467;
          if (is450Range || is465Range) return;
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
          ctx.translate(x, y - 8);
          ctx.rotate(-Math.PI / 4);
          ctx.font = "bold 9px monospace";
          ctx.textAlign = "left";
          ctx.fillStyle = color;
          ctx.fillText(label, 0, 0);
          ctx.restore();
        }
      };
      allActiveCarriers.forEach((c) => {
        const isInactive = c.active === false;
        const color = isInactive
          ? "#64748b"
          : c.type === "tx"
            ? INTERMOD_CONFIG.tx.color
            : INTERMOD_CONFIG.rx.color;
        const label =
          c.label.split(" ")[0] +
          (c.type === "tx" ? "T" : "R") +
          (isInactive ? " (Off)" : "");
        drawSignal(c.value, INTERMOD_CONFIG.tx.amp, color, c.bw, label);
      });
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
    results,
    manualPairs,
    mode,
    dimensions,
    selectedCountry,
    measurementPoints,
    parsedExclusions,
    currentExclusion,
  ]);

  const SortArrow = ({ field }: { field: string }) => {
    if (sortField !== field)
      return <span className="ml-1 text-slate-500">↕</span>;
    return (
      <span className="ml-1 text-amber-400 font-black">
        {sortDirection === "asc" ? "▲" : "▼"}
      </span>
    );
  };

  return (
    <div className="space-y-4 mx-auto">
      <EngagingLoadingState
        isOpen={isCalculating}
        progress={genProgress * 100}
        onCancel={handleCancel}
      />
      <CelebratorySuccessState
        isOpen={showSuccess}
        onClose={() => setShowSuccess(false)}
        frequenciesFound={results?.length || 0}
        frequenciesRequired={coordinationGroups.reduce(
          (acc, g) => acc + g.count,
          0,
        )}
        stats={[
          { label: "Talkback Pairs Coordinated", value: results?.length || 0 },
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
              <div className="flex items-center gap-2">
                <CardTitle className="!mb-0">
                  1. Setup Base & Portable Bands
                </CardTitle>
                {results && (
                  <button
                    onClick={() => setShowLivePreview(!showLivePreview)}
                    className={`${secondaryButton} flex items-center gap-2 ml-4`}
                  >
                    {showLivePreview ? "Hide Preview" : "Show Live Preview"}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
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
                <div
                  className={`flex items-center gap-2 bg-slate-900 border ${useTargetSeparation ? "border-indigo-500/50" : "border-indigo-500/20"} rounded-md p-1 shadow-inner px-2 py-1.5 transition-colors`}
                >
                  <div className="flex items-center gap-1.5 mr-2 pr-2 border-r border-slate-700">
                    <input
                      type="checkbox"
                      id="useTargetSeparationToggle"
                      checked={useTargetSeparation}
                      onChange={(e) => setUseTargetSeparation(e.target.checked)}
                      className="w-3 h-3 accent-indigo-500 cursor-pointer"
                    />
                    <label
                      htmlFor="useTargetSeparationToggle"
                      className={`text-[10px] font-black uppercase tracking-widest cursor-pointer ${useTargetSeparation ? "text-indigo-400" : "text-slate-500"}`}
                    >
                      Enforce Split:
                    </label>
                  </div>
                  <div
                    className={`flex items-center gap-1 ${!useTargetSeparation && "opacity-50 pointer-events-none"}`}
                  >
                    <button
                      onClick={() =>
                        setTargetSeparation((prev) =>
                          Math.max(0, parseFloat((prev - 0.1).toFixed(1))),
                        )
                      }
                      className="w-3.5 h-3.5 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white rounded text-[16px] font-black leading-none"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      step="0.1"
                      value={targetSeparation}
                      onChange={(e) =>
                        setTargetSeparation(parseFloat(e.target.value) || 0)
                      }
                      className="w-12 bg-slate-950 text-white text-[11px] font-mono text-center rounded border border-slate-700 focus:border-indigo-500 outline-none h-5"
                    />
                    <span className="text-[10px] text-slate-400 font-black">
                      MHz
                    </span>
                    <button
                      onClick={() =>
                        setTargetSeparation((prev) =>
                          parseFloat((prev + 0.1).toFixed(1)),
                        )
                      }
                      className="w-3.5 h-3.5 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white rounded text-[16px] font-black leading-none"
                    >
                      +
                    </button>
                    <div className="flex items-center gap-1.5 ml-2 border-l border-slate-700 pl-2">
                      <input
                        type="checkbox"
                        id="exactSeparationToggle"
                        checked={exactSeparation}
                        onChange={(e) => setExactSeparation(e.target.checked)}
                        className="w-3 h-3 accent-indigo-500 cursor-pointer"
                      />
                      <label
                        htmlFor="exactSeparationToggle"
                        className="text-[10px] text-slate-400 font-black uppercase tracking-widest cursor-pointer"
                      >
                        Exact
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {coordinationGroups.map((group, gIdx) => (
                <div
                  key={group.id}
                  className="relative bg-slate-900/50 border border-slate-800 rounded-sm p-2.5 transition-all hover:border-indigo-500/30 mt-2"
                >
                  <div className="absolute -top-2.5 left-3 px-1.5 bg-slate-950 text-[9px] font-black text-indigo-400 uppercase tracking-widest border border-indigo-500/30 rounded z-10">
                    Group #{gIdx + 1}
                  </div>

                  {coordinationGroups.length > 1 && (
                    <button
                      onClick={() => removeCoordinationGroup(group.id)}
                      className="absolute -top-2.5 -right-2.5 w-3.5 h-3.5 bg-rose-600 text-white rounded-full flex items-center justify-center hover:bg-rose-500 shadow-sm border border-slate-700/50 z-10"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3 w-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                    <div className="md:col-span-2">
                      <label className="text-[9px] font-black text-slate-500 uppercase mb-0.5 block">
                        Quantity
                      </label>
                      <div className="flex items-center bg-slate-950 border border-slate-700 rounded overflow-hidden h-7 w-full shadow-inner">
                        <button
                          onClick={() =>
                            updateCoordinationGroup(group.id, {
                              count: Math.max(0, group.count - 1),
                            })
                          }
                          className="px-2 h-full bg-slate-800 hover:bg-slate-700 text-indigo-400 transition-colors flex-shrink-0"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={3}
                              d="M20 12H4"
                            />
                          </svg>
                        </button>
                        <input
                          type="number"
                          value={group.count}
                          onChange={(e) =>
                            updateCoordinationGroup(group.id, {
                              count: parseInt(e.target.value) || 0,
                            })
                          }
                          className="flex-1 min-w-0 bg-transparent h-full text-white font-mono text-xs focus:outline-none text-center font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                          onClick={() =>
                            updateCoordinationGroup(group.id, {
                              count: group.count + 1,
                            })
                          }
                          className="px-2 h-full bg-slate-800 hover:bg-slate-700 text-indigo-400 transition-colors flex-shrink-0"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={3}
                              d="M12 4v16m-8-8h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-[9px] font-black text-slate-500 uppercase mb-1 block">
                        Type
                      </label>
                      <select
                        value={group.type}
                        onChange={(e) =>
                          updateCoordinationGroup(group.id, {
                            type: e.target.value as any,
                          })
                        }
                        className="w-full bg-slate-950 border border-slate-700 rounded h-8 px-2 text-[11px] text-white font-bold outline-none focus:border-indigo-500 transition-all shadow-inner"
                      >
                        <option value="duplex">Duplex Pair</option>
                        <option value="simplex-tx">Simplex Base TX</option>
                        <option value="simplex-walkie">Simplex Walkie</option>
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-[9px] font-black text-slate-500 uppercase mb-1 block">
                        Bandwidth
                      </label>
                      <select
                        value={group.bw}
                        onChange={(e) =>
                          updateCoordinationGroup(group.id, {
                            bw: parseFloat(e.target.value),
                          })
                        }
                        className="w-full bg-slate-950 border border-slate-700 rounded h-8 px-2 text-[11px] text-white font-bold outline-none focus:border-indigo-500 transition-all shadow-inner"
                      >
                        <option value={0.0125}>12.5 kHz</option>
                        <option value={0.025}>25 kHz</option>
                        <option value={0.05}>50 kHz</option>
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-[9px] font-black text-slate-500 uppercase mb-1 block">
                        Method
                      </label>
                      <div className="flex bg-slate-950 border border-slate-700 rounded p-0.5 h-8 shadow-inner">
                        <button
                          onClick={() =>
                            updateCoordinationGroup(group.id, {
                              mode: "standard",
                            })
                          }
                          className={`flex-1 rounded-md text-[9px] font-black uppercase transition-all ${group.mode === "standard" ? "bg-indigo-600 text-white shadow-md" : "text-slate-500 hover:text-gray-700"}`}
                        >
                          Standard
                        </button>
                        <button
                          onClick={() =>
                            updateCoordinationGroup(group.id, {
                              mode: "custom",
                            })
                          }
                          className={`flex-1 rounded-md text-[9px] font-black uppercase transition-all ${group.mode === "custom" ? "bg-indigo-600 text-white shadow-md" : "text-slate-500 hover:text-gray-700"}`}
                        >
                          Custom
                        </button>
                      </div>
                    </div>

                    <div className="md:col-span-4">
                      {group.mode === "standard" ? (
                        <div className="flex gap-2">
                          {(group.type === "duplex" ||
                            group.type === "simplex-tx") && (
                            <div className="flex-1">
                              <label className="text-[8px] text-slate-500 font-bold uppercase mb-1 block">
                                Tx Band
                              </label>
                              <select
                                value={group.txBand}
                                onChange={(e) =>
                                  updateCoordinationGroup(group.id, {
                                    txBand: Number(e.target.value),
                                  })
                                }
                                className="w-full bg-slate-800 text-white text-[10px] border border-slate-700 rounded h-8 px-1.5 font-bold outline-none focus:border-indigo-500"
                              >
                                {baseBands.map((b) => (
                                  <option key={b} value={b}>
                                    {b}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                          {(group.type === "duplex" ||
                            group.type === "simplex-walkie") && (
                            <div className="flex-1">
                              <label className="text-[8px] text-slate-500 font-bold uppercase mb-1 block">
                                Rx Band
                              </label>
                              <select
                                value={group.rxBand}
                                onChange={(e) =>
                                  updateCoordinationGroup(group.id, {
                                    rxBand: Number(e.target.value),
                                  })
                                }
                                className="w-full bg-slate-800 text-white text-[10px] border border-slate-700 rounded h-8 px-1.5 font-bold outline-none focus:border-indigo-500"
                              >
                                {portBands.map((b) => (
                                  <option key={b} value={b}>
                                    {b}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          {(group.type === "duplex" ||
                            group.type === "simplex-tx") && (
                            <div className="flex flex-col gap-1 flex-1">
                              <label className="text-[8px] text-slate-500 font-bold uppercase mb-0.5 block text-center">
                                Tx Range (MHz)
                              </label>
                              <div className="flex gap-1 items-center">
                                <input
                                  type="number"
                                  value={group.txMin}
                                  onChange={(e) =>
                                    updateCoordinationGroup(group.id, {
                                      txMin: parseFloat(e.target.value) || 0,
                                    })
                                  }
                                  placeholder="Min"
                                  className="w-full bg-slate-950 border border-slate-700 rounded h-8 px-1 text-white font-mono text-[11px] font-bold text-center outline-none focus:border-indigo-500 shadow-inner"
                                />
                                <span className="text-slate-500 font-bold">
                                  -
                                </span>
                                <input
                                  type="number"
                                  value={group.txMax}
                                  onChange={(e) =>
                                    updateCoordinationGroup(group.id, {
                                      txMax: parseFloat(e.target.value) || 0,
                                    })
                                  }
                                  placeholder="Max"
                                  className="w-full bg-slate-950 border border-slate-700 rounded h-8 px-1 text-white font-mono text-[11px] font-bold text-center outline-none focus:border-indigo-500 shadow-inner"
                                />
                              </div>
                            </div>
                          )}
                          {(group.type === "duplex" ||
                            group.type === "simplex-walkie") && (
                            <div className="flex flex-col gap-1 flex-1">
                              <label className="text-[8px] text-slate-500 font-bold uppercase mb-0.5 block text-center">
                                Rx Range (MHz)
                              </label>
                              <div className="flex gap-1 items-center">
                                <input
                                  type="number"
                                  value={group.rxMin}
                                  onChange={(e) =>
                                    updateCoordinationGroup(group.id, {
                                      rxMin: parseFloat(e.target.value) || 0,
                                    })
                                  }
                                  placeholder="Min"
                                  className="w-full bg-slate-950 border border-slate-700 rounded h-8 px-1 text-white font-mono text-[11px] font-bold text-center outline-none focus:border-indigo-500 shadow-inner"
                                />
                                <span className="text-slate-500 font-bold">
                                  -
                                </span>
                                <input
                                  type="number"
                                  value={group.rxMax}
                                  onChange={(e) =>
                                    updateCoordinationGroup(group.id, {
                                      rxMax: parseFloat(e.target.value) || 0,
                                    })
                                  }
                                  placeholder="Max"
                                  className="w-full bg-slate-950 border border-slate-700 rounded h-8 px-1 text-white font-mono text-[11px] font-bold text-center outline-none focus:border-indigo-500 shadow-inner"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex justify-center pt-2">
                <button
                  onClick={addCoordinationGroup}
                  className="group flex items-center gap-3 px-4 py-3 bg-indigo-600/10 border border-indigo-500/30 rounded-md text-indigo-400 text-[11px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all shadow-sm border border-slate-700/50 active:scale-95"
                >
                  <span className="w-4 h-4 bg-indigo-600 text-white rounded-full flex items-center justify-center text-base font-medium font-bold group-hover:bg-white group-hover:text-indigo-800 transition-colors">
                    +
                  </span>
                  Add Another Frequency Group
                </button>
              </div>
            </div>
          </Card>
          <Card>
            <CardTitle>2. Fixed Site Plan</CardTitle>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {manualPairs.map((p: DuplexPairWithBw) => {
                const active = p.active !== false;
                return (
                  <div
                    key={p.id}
                    className={`bg-slate-900/40 p-2 rounded-sm border transition-all ${active ? "border-white/5" : "border-slate-800 opacity-60 grayscale-[0.5]"}`}
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
                        <div className="flex items-center gap-1.5 bg-slate-800 rounded px-2 h-8 w-[150px]">
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
                            className={`text-[7px] font-black flex-shrink-0 px-1 py-0.5 rounded border transition-colors w-8 ${
                              (p.txIsBase ??
                              (mode === "europe" ? p.tx > 464 : p.tx < 464))
                                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                                : "bg-blue-500/20 border-blue-500/40 text-blue-400"
                            }`}
                            title="Toggle Base (Constant TX) vs SW (Intermittent)"
                          >
                            {(p.txIsBase ??
                            (mode === "europe" ? p.tx > 464 : p.tx < 464))
                              ? "BASE"
                              : "SW"}
                          </button>
                          <ManualFreqInput
                            value={p.tx}
                            onChange={(val) =>
                              updateManualPair(p.id, "tx", val)
                            }
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
                        <div className="flex items-center gap-1.5 bg-slate-800 rounded px-2 h-8 w-[150px]">
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
                            className={`text-[7px] font-black flex-shrink-0 px-1 py-0.5 rounded border transition-colors w-8 ${
                              (p.rxIsBase ??
                              (mode === "europe" ? p.rx > 464 : p.rx < 464))
                                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                                : "bg-blue-500/20 border-blue-500/40 text-blue-400"
                            }`}
                            title="Toggle Base (Constant TX) vs SW (Intermittent)"
                          >
                            {(p.rxIsBase ??
                            (mode === "europe" ? p.rx > 464 : p.rx < 464))
                              ? "BASE"
                              : "SW"}
                          </button>
                          <ManualFreqInput
                            value={p.rx}
                            onChange={(val) =>
                              updateManualPair(p.id, "rx", val)
                            }
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
                              setManualPairs((pairs) =>
                                pairs.map((mp) =>
                                  mp.id === p.id
                                    ? { ...mp, txBw: val, rxBw: val }
                                    : mp,
                                ),
                              );
                            }}
                            className="bg-transparent text-[10px] text-indigo-300 outline-none font-bold cursor-pointer"
                          >
                            <option value={0.0125}>12.5k</option>
                            <option value={0.025}>25k</option>
                            <option value={0.05}>50k</option>
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
                <div className="flex items-center bg-slate-950 border border-slate-700 rounded overflow-hidden h-7 w-24">
                  <button
                    onClick={() =>
                      setBulkAddCount(Math.max(1, bulkAddCount - 1))
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
                    min="1"
                    max="50"
                    value={bulkAddCount}
                    onChange={(e) =>
                      setBulkAddCount(parseInt(e.target.value) || 1)
                    }
                    className="w-8 bg-transparent h-full text-white font-mono text-xs focus:outline-none text-center font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button
                    onClick={() =>
                      setBulkAddCount(Math.min(50, bulkAddCount + 1))
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
            <div className="flex gap-2 relative z-[5000] bg-slate-950/80 backdrop-blur-md -mx-4 px-3 py-2 border-b border-white/5 shadow-2xl">
              <div className="flex-1 flex gap-2 overflow-x-auto pb-1 no-scrollbar items-center">
                <button
                  onClick={handleGenerate}
                  disabled={isCalculating}
                  className={`${primaryButton} flex-1 min-w-[200px] py-2 text-sm shadow-2xl uppercase tracking-widest`}
                >
                  {isCalculating
                    ? `COORDINATING SITE...`
                    : "⚡ GENERATE"}
                </button>
                {isCalculating && (
                  <button
                    onClick={() => abortControllerRef.current?.abort()}
                    className={`${secondaryButton} !bg-red-600 hover:!bg-red-500 border-red-800 text-white px-8 py-2 text-xs uppercase tracking-widest`}
                  >
                    ABORT
                  </button>
                )}
                <div className="flex gap-2 ml-2">
                  <StatusPill
                    label="Yield"
                    value={totalYield}
                    total={totalTarget}
                    color={
                      !results && !isCalculating
                        ? "indigo"
                        : totalYield >= totalTarget
                          ? "emerald"
                          : "rose"
                    }
                    subValue={
                      !results && !isCalculating
                        ? "Pending"
                        : `/ ${totalTarget}`
                    }
                  />
                  <StatusPill
                    label="Progress"
                    value={`${Math.round(genProgress * 100)}%`}
                    color="indigo"
                  />
                </div>
              </div>

              <button
                onClick={() => setShowTable(!showTable)}
                className={`${secondaryButton} !w-auto flex items-center gap-2 px-4 whitespace-nowrap`}
              >
                <span>📊</span> {showTable ? "HIDE LEDGER" : "TABULATE"}
              </button>
              <div className="relative">
                <button
                  onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                  className={`${actionButton} h-full px-4 flex items-center gap-2 whitespace-nowrap`}
                >
                  <span>📥</span> EXPORT
                </button>
                {isExportMenuOpen && (
                  <div className="absolute top-full right-0 mt-2 bg-slate-800 border border-slate-700 rounded-md shadow-2xl z-[5001] overflow-visible min-w-[220px] animate-in fade-in slide-in-from-top-2 duration-200">
                    <button
                      onClick={() => handleExport("pdf")}
                      className="w-full text-left px-3 py-3 text-xs font-bold text-gray-700 hover:bg-slate-700 border-b border-white/5 transition-colors"
                    >
                      PDF Report
                    </button>
                    <button
                      onClick={() => setIsPreviewModalOpen(true)}
                      className="w-full text-left px-3 py-3 text-xs font-bold text-emerald-400 hover:bg-slate-700 border-b border-white/5 transition-colors"
                    >
                      Company PDF Report
                    </button>
                    <button
                      onClick={() => handleExport("xls")}
                      className="w-full text-left px-3 py-3 text-xs font-bold text-gray-700 hover:bg-slate-700 border-b border-white/5 transition-colors"
                    >
                      Excel (.XLS)
                    </button>
                    <button
                      onClick={() => handleExport("doc")}
                      className="w-full text-left px-3 py-3 text-xs font-bold text-gray-700 hover:bg-slate-700 border-b border-white/5 transition-colors"
                    >
                      Word (.DOC)
                    </button>
                    <button
                      onClick={() => handleExport("csv")}
                      className="w-full text-left px-3 py-3 text-xs font-bold text-gray-700 hover:bg-slate-700 border-b border-white/5 transition-colors"
                    >
                      CSV Data
                    </button>
                    <button
                      onClick={() => handleExport("txt")}
                      className="w-full text-left px-3 py-3 text-xs font-bold text-gray-700 hover:bg-slate-700 transition-colors"
                    >
                      Text (.TXT)
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {showTable && tabulatedData.length > 0 && (
            <Card className="!bg-slate-950 border-cyan-500/30 animate-in fade-in slide-in-from-top-2 duration-300">
              <CardTitle className="!text-sm uppercase tracking-[0.2em] text-blue-700">
                Numerical Spectral Allocation Ledger
              </CardTitle>
              <div className="overflow-y-auto max-h-[400px] rounded-md border border-white/10 custom-scrollbar shadow-inner">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead className="bg-slate-900 z-10">
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
                        onClick={() => handleSort("groupName")}
                      >
                        Source Group <SortArrow field="groupName" />
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
                            {row.groupName}
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
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 mb-4">
              <div className="flex items-center gap-3">
                <CardTitle className="!mb-0">
                  3. Intermod Physics Auditor
                </CardTitle>
                <div className="flex items-center gap-2 bg-gray-300 border border-gray-500 rounded-md p-1 shadow-inner ml-2">
                  <span className="text-[10px] text-gray-700 font-black uppercase px-2">
                    Country:
                  </span>
                  <select
                    value={selectedCountry}
                    onChange={(e) => setSelectedCountry(e.target.value as any)}
                    className="bg-white text-black text-[10px] font-black uppercase rounded-sm px-3 py-1.5 outline-none border border-gray-500"
                  >
                    <option value="UK">UK</option>
                    <option value="USA">USA</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                {results && results.length > 0 && (
                  <button
                    onClick={handleLockAllResults}
                    className={`text-[10px] font-black tracking-widest px-2 py-1 rounded border-2 transition-all flex items-center gap-1.5 ${allResultsLocked ? "bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/40" : "bg-gray-200 text-gray-600 border-gray-500 hover:border-slate-500"}`}
                    title={allResultsLocked ? "Unlock All" : "Lock All"}
                  >
                    <span>{allResultsLocked ? "🔒" : "🔓"}</span>
                    {allResultsLocked ? "UNLOCK ALL" : "LOCK ALL"}
                  </button>
                )}
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
                    <span className="text-[10px] text-gray-600 font-bold uppercase group-hover:text-black transition-colors">
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
                    <span className="text-[10px] text-gray-600 font-bold uppercase group-hover:text-black transition-colors">
                      3-Tone
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={showTooltips}
                      onChange={(e) => setShowTooltips(e.target.checked)}
                      className="w-4 h-4 rounded accent-cyan-500 bg-gray-200"
                    />
                    <span className="text-[10px] text-gray-700 font-bold uppercase group-hover:text-black transition-colors">
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
                    <span className="text-[10px] text-gray-700 font-bold uppercase group-hover:text-black transition-colors">
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
                    <span className="text-[10px] text-gray-700 font-bold uppercase group-hover:text-black transition-colors">
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
                      onBlur={(e) => applyCenterFreq(e.target.value)}
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
                          <span className="text-emerald-800 text-sm font-black">✓</span> Spectrum Compatibility Confirmed
                        </>
                      ) : (
                        <>
                          <span className="text-red-700 text-sm font-black">⚠️</span> {diagnosticConflicts.length} Interaction Clashes Detected
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
                      Current spectral configuration satisfies all fundamental
                      (18.75kHz) and 3rd-order (12.5kHz) guard criteria for
                      talkback operations.
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

            <div className="flex flex-col xl:flex-row gap-2 mb-4">
              <div className="flex-1 relative group flex flex-col gap-2">
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
                  className={`w-full h-[300px] md:h-[450px] bg-black rounded-md border border-blue-500/20 shadow-inner touch-none ${isDeltaMode ? "cursor-crosshair" : isDragging ? "cursor-grabbing" : "cursor-grab"}`}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  onPointerLeave={handlePointerUp}
                  onWheel={handleWheel}
                />
                {activeHit && mouseCoord && !isDragging && (
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

              <div className="flex flex-col md:flex-row gap-2 shrink-0 items-start">
                <div className="flex flex-col gap-2 shrink-0">
                  {/* Numerical Keypad */}
                  <div className="w-full md:w-44 flex flex-col gap-2 shrink-0">
                    <div className="bg-gray-300/90 p-2 rounded-md border-2 border-gray-700 shadow-2xl flex flex-col gap-1.5">
                      <div className="flex flex-col gap-0.5 text-center">
                        <span className="text-[8px] font-black text-gray-800 uppercase tracking-[0.2em] mb-0.5">
                          Audit Input
                        </span>
                        <div className="text-[10px] font-mono text-black font-bold tracking-widest bg-white py-1 rounded-sm border-2 border-gray-700 shadow-inner">
                          {centerFreqInput || "000.00000"}
                          {isEnteringFreq && (
                            <span className="w-1 h-3 bg-cyan-400 ml-1 animate-pulse"></span>
                          )}
                        </div>
                      </div>

                      {/* Mode Toggle */}
                      <div className="flex bg-white/80 p-0.5 rounded border-2 border-gray-700">
                        <button
                          onClick={() => setKeypadMode("add")}
                          className={`flex-1 py-1 text-[6px] font-black uppercase tracking-widest rounded transition-all ${keypadMode === "add" ? "bg-indigo-600 text-black shadow-md" : "text-gray-700 hover:text-gray-700"}`}
                        >
                          ADD
                        </button>
                        <button
                          onClick={() => setKeypadMode("center")}
                          className={`flex-1 py-1 text-[6px] font-black uppercase tracking-widest rounded transition-all ${keypadMode === "center" ? "bg-cyan-600 text-black shadow-md" : "text-gray-700 hover:text-gray-700"}`}
                        >
                          VIEW
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-0.5">
                        {[7, 8, 9, 4, 5, 6, 1, 2, 3].map((num) => (
                          <button
                            key={num}
                            onClick={() => handleKeypadPress(num.toString())}
                            className="h-7 bg-white hover:bg-gray-200 active:bg-indigo-600 text-black font-black text-[11px] rounded border border-gray-700 transition-all shadow-md active:scale-95 flex items-center justify-center"
                          >
                            {num}
                          </button>
                        ))}
                        <button
                          onClick={() => handleKeypadPress(".")}
                          className="h-7 bg-white hover:bg-gray-200 active:bg-indigo-600 text-black font-black text-xs rounded border border-gray-700 transition-all shadow-md flex items-center justify-center"
                        >
                          .
                        </button>
                        <button
                          onClick={() => handleKeypadPress("0")}
                          className="h-7 bg-white hover:bg-gray-200 active:bg-indigo-600 text-black font-black text-[11px] rounded border border-gray-700 transition-all shadow-md flex items-center justify-center"
                        >
                          0
                        </button>
                        <button
                          onClick={() => handleKeypadPress("CLR")}
                          className="h-7 bg-red-950/20 hover:bg-red-900/40 text-red-600 font-black text-[7px] uppercase tracking-widest rounded border border-red-700/50 transition-all shadow-md flex items-center justify-center"
                        >
                          CLR
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-1 mt-1">
                        <button
                          onClick={() => handleKeypadPress("DEL")}
                          className="h-7 bg-gray-200 hover:bg-gray-300 text-gray-900 font-black text-[7px] uppercase tracking-widest rounded border border-gray-700 transition-all shadow-md active:scale-95 flex items-center justify-center"
                        >
                          BACK
                        </button>
                        <button
                          onClick={() => handleKeypadPress("ENT")}
                          className={`h-7 font-black text-[7px] uppercase tracking-widest rounded transition-all active:scale-95 flex items-center justify-center gap-1.5 ${keypadMode === "add" ? "bg-indigo-600 hover:bg-indigo-500 text-black shadow-sm border border-slate-700/50 shadow-indigo-600/20" : "bg-cyan-600 hover:bg-cyan-500 text-black shadow-sm border border-slate-700/50 shadow-cyan-600/20"}`}
                        >
                          {keypadMode === "add" ? "⚡ ADD" : "🎯 VIEW"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Audit Settings */}
                  <div className="w-full md:w-44 bg-gray-300/90 p-2.5 rounded-md border-2 border-gray-700 shadow-2xl flex flex-col gap-3 shrink-0">
                    <div className="text-[8px] font-black text-gray-800 uppercase tracking-[0.2em] mb-0.5 text-center border-b-2 border-gray-700 pb-1.5">
                      Audit Settings
                    </div>

                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between items-center px-1">
                        <span className="text-[7px] font-black text-gray-800 uppercase tracking-tighter">
                          Bandwidth
                        </span>
                      </div>
                      <div className="flex items-center gap-1 bg-white rounded-sm p-1 border-2 border-gray-700 shadow-inner">
                        <button
                          onClick={() =>
                            setAuditBandwidth((prev) =>
                              Math.max(0, parseFloat(prev) - 0.00625).toFixed(
                                5,
                              ),
                            )
                          }
                          className="w-4 h-4 flex shrink-0 items-center justify-center bg-gray-200 rounded border border-gray-700 text-gray-800 hover:text-black hover:bg-gray-300 transition-colors"
                        >
                          <span className="text-[10px] font-bold leading-none">
                            -
                          </span>
                        </button>
                        <input
                          type="text"
                          value={auditBandwidth}
                          onChange={(e) => setAuditBandwidth(e.target.value)}
                          className="w-full bg-transparent text-black font-mono text-[9px] text-center font-bold outline-none focus:text-indigo-800"
                        />
                        <button
                          onClick={() =>
                            setAuditBandwidth((prev) =>
                              (parseFloat(prev) + 0.00625).toFixed(5),
                            )
                          }
                          className="w-4 h-4 flex shrink-0 items-center justify-center bg-gray-200 rounded border border-gray-700 text-gray-800 hover:text-black hover:bg-gray-300 transition-colors"
                        >
                          <span className="text-[10px] font-bold leading-none">
                            +
                          </span>
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between items-center px-1">
                        <span className="text-[7px] font-black text-gray-800 uppercase tracking-tighter">
                          Step Size
                        </span>
                      </div>
                      <div className="flex items-center gap-1 bg-white rounded-sm p-1 border-2 border-gray-700 shadow-inner">
                        <button
                          onClick={() =>
                            setAuditTuningStep((prev) =>
                              Math.max(0, parseFloat(prev) - 0.00625).toFixed(
                                5,
                              ),
                            )
                          }
                          className="w-4 h-4 flex shrink-0 items-center justify-center bg-gray-200 rounded border border-gray-700 text-gray-800 hover:text-black hover:bg-gray-300 transition-colors"
                        >
                          <span className="text-[10px] font-bold leading-none">
                            -
                          </span>
                        </button>
                        <input
                          type="text"
                          value={auditTuningStep}
                          onChange={(e) => setAuditTuningStep(e.target.value)}
                          className="w-full bg-transparent text-black font-mono text-[9px] text-center font-bold outline-none focus:text-indigo-800"
                        />
                        <button
                          onClick={() =>
                            setAuditTuningStep((prev) =>
                              (parseFloat(prev) + 0.00625).toFixed(5),
                            )
                          }
                          className="w-4 h-4 flex shrink-0 items-center justify-center bg-gray-200 rounded border border-gray-700 text-gray-800 hover:text-black hover:bg-gray-300 transition-colors"
                        >
                          <span className="text-[10px] font-bold leading-none">
                            +
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Audit Frequency Ledger */}
                <div className="w-full md:w-[288px] bg-gray-200/90 rounded-md border-2 border-gray-700 flex flex-col overflow-hidden max-h-[445px] shrink-0 shadow-sm border border-slate-700/50">
                  <div className="p-2 border-b-2 border-gray-700 bg-gray-300 flex justify-between items-center">
                    <span className="text-[9px] font-black text-gray-800 font-mono uppercase tracking-[0.2em]">
                      Audit Ledger
                    </span>
                    <button
                      onClick={() =>
                        setManualPairs((prev) =>
                          prev.filter((p) => p.groupName !== "Keypad Entry"),
                        )
                      }
                      className="text-[8px] font-black text-rose-700 hover:text-rose-600 transition-colors uppercase tracking-widest"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-1.5 space-y-1.5 custom-scrollbar">
                    {manualPairs.filter((p) => p.groupName === "Keypad Entry")
                      .length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center p-2 text-center opacity-40">
                        <div className="text-[16px] mb-1">📡</div>
                        <div className="text-[8px] font-bold text-slate-800 uppercase tracking-tighter">
                          Empty
                        </div>
                      </div>
                    ) : (
                      manualPairs
                        .filter((p) => p.groupName === "Keypad Entry")
                        .map((p) => (
                          <div
                            key={p.id}
                            className="flex flex-col p-1.5 rounded-sm bg-white border-2 border-gray-700 group hover:border-indigo-600 transition-all gap-1.5 shadow-sm"
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              {/* Base Tx Side */}
                              <div className="flex flex-col bg-gray-100 border-2 border-gray-700 rounded-sm p-1 flex-1 min-w-0 shadow-inner">
                                <div className="flex items-center justify-between gap-1 mb-1 border-b border-gray-300 pb-0.5">
                                  <span className="text-[7.5px] font-black text-gray-800 uppercase tracking-wider">
                                    BASE TX
                                  </span>
                                  <button
                                    onClick={() =>
                                      handleResultTxActiveToggle(p.id)
                                    }
                                    className={`px-1 py-0.5 rounded border text-[7px] font-black uppercase tracking-tighter transition-all ${
                                      p.txActive !== false
                                        ? "bg-emerald-500/20 border-emerald-600 text-emerald-900"
                                        : "bg-white border-gray-400 text-gray-500"
                                    }`}
                                    title="Toggle Base Tx"
                                  >
                                    {p.txActive !== false ? "ON" : "OFF"}
                                  </button>
                                </div>
                                <div className="flex items-center justify-start bg-white border border-gray-400 rounded px-1 py-0.5 gap-0.5">
                                  <button
                                    onClick={() =>
                                      handleFrequencyStep(p.id, "tx", "down")
                                    }
                                    className="w-3.5 h-3.5 flex items-center justify-center bg-gray-200 border border-gray-400 rounded text-gray-800 hover:text-black hover:bg-gray-300 transition-colors shrink-0"
                                    title="Step Down"
                                  >
                                    <span className="text-[9px] font-bold leading-none">
                                      -
                                    </span>
                                  </button>
                                  <ManualFreqInput
                                    value={p.tx}
                                    onChange={(val) =>
                                      updateManualPair(p.id, "tx", val)
                                    }
                                    className="bg-transparent text-[9.5px] font-mono font-black text-black flex-1 min-w-0 text-left pl-0.5 outline-none"
                                  />
                                  <button
                                    onClick={() =>
                                      handleFrequencyStep(p.id, "tx", "up")
                                    }
                                    className="w-3.5 h-3.5 flex items-center justify-center bg-gray-200 border border-gray-400 rounded text-gray-800 hover:text-black hover:bg-gray-300 transition-colors shrink-0"
                                    title="Step Up"
                                  >
                                    <span className="text-[9px] font-bold leading-none">
                                      +
                                    </span>
                                  </button>
                                </div>
                              </div>

                              {/* Port Rx Side */}
                              <div className="flex flex-col bg-gray-100 border-2 border-gray-700 rounded-sm p-1 flex-1 min-w-0 shadow-inner">
                                <div className="flex items-center justify-between gap-1 mb-1 border-b border-gray-300 pb-0.5">
                                  <span className="text-[7.5px] font-black text-gray-800 uppercase tracking-wider">
                                    PORT TX
                                  </span>
                                  <button
                                    onClick={() =>
                                      handleResultRxActiveToggle(p.id)
                                    }
                                    className={`px-1 py-0.5 rounded border text-[7px] font-black uppercase tracking-tighter transition-all ${
                                      p.rxActive !== false
                                        ? "bg-emerald-500/20 border-emerald-600 text-emerald-900"
                                        : "bg-white border-gray-400 text-gray-500"
                                    }`}
                                    title="Toggle Port Rx"
                                  >
                                    {p.rxActive !== false ? "ON" : "OFF"}
                                  </button>
                                </div>
                                <div className="flex items-center justify-start bg-white border border-gray-400 rounded px-1 py-0.5 gap-0.5">
                                  <button
                                    onClick={() =>
                                      handleFrequencyStep(p.id, "rx", "down")
                                    }
                                    className="w-3.5 h-3.5 flex items-center justify-center bg-gray-200 border border-gray-400 rounded text-gray-800 hover:text-black hover:bg-gray-300 transition-colors shrink-0"
                                    title="Step Down"
                                  >
                                    <span className="text-[9px] font-bold leading-none">
                                      -
                                    </span>
                                  </button>
                                  <ManualFreqInput
                                    value={p.rx}
                                    onChange={(val) =>
                                      updateManualPair(p.id, "rx", val)
                                    }
                                    className="bg-transparent text-[9.5px] font-mono font-black text-black flex-1 min-w-0 text-left pl-0.5 outline-none"
                                  />
                                  <button
                                    onClick={() =>
                                      handleFrequencyStep(p.id, "rx", "up")
                                    }
                                    className="w-3.5 h-3.5 flex items-center justify-center bg-gray-200 border border-gray-400 rounded text-gray-800 hover:text-black hover:bg-gray-300 transition-colors shrink-0"
                                    title="Step Up"
                                  >
                                    <span className="text-[9px] font-bold leading-none">
                                      +
                                    </span>
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Action Bar */}
                            <div className="flex items-center justify-between border-t border-gray-300 pt-1 mt-0.5">
                              <div className="flex gap-1.5 items-center">
                                <button
                                  onClick={() => toggleAuditExpanded(p.id)}
                                  className={`px-1.5 py-0.5 rounded transition-colors flex items-center gap-1 border ${
                                    expandedAuditIds.includes(p.id)
                                      ? "text-indigo-900 bg-indigo-500/20 border-indigo-600 font-bold"
                                      : "text-black bg-gray-100 hover:bg-gray-200 border-gray-400 font-bold"
                                  }`}
                                  title="Frequency Settings"
                                >
                                  <Settings className="w-3 h-3 text-black stroke-[2.5]" />
                                  <span className="text-[7.5px] font-bold uppercase tracking-wider">
                                    SETTINGS
                                  </span>
                                </button>
                                <button
                                  onClick={() =>
                                    handleCloneAuditFrequency(
                                      p as DuplexPairWithBw,
                                    )
                                  }
                                  className="px-1.5 py-0.5 rounded border border-indigo-700/50 bg-indigo-500/10 text-indigo-900 hover:bg-indigo-500/20 transition-all font-bold flex items-center gap-1"
                                  title="Clone this frequency"
                                >
                                  <span className="text-[7.5px] font-black uppercase tracking-tighter">
                                    CLONE
                                  </span>
                                </button>
                              </div>
                              <button
                                onClick={() => handleRemoveResult(p.id)}
                                className="p-0.5 px-1.5 text-slate-800 hover:text-rose-600 hover:bg-rose-100 rounded font-bold transition-colors text-xs leading-none"
                                title="Remove item"
                              >
                                &times;
                              </button>
                            </div>

                            {expandedAuditIds.includes(p.id) && (
                              <div className="mt-1 pt-1.5 border-t-2 border-gray-700 flex flex-col gap-1.5 px-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-[8px] font-black text-gray-700 uppercase tracking-tighter">
                                    Label
                                  </span>
                                  <input
                                    type="text"
                                    value={p.label}
                                    onChange={(e) =>
                                      updateManualPair(
                                        p.id,
                                        "label",
                                        e.target.value,
                                      )
                                    }
                                    className="bg-white text-[9px] text-indigo-800 outline-none font-bold rounded border border-gray-500 px-1.5 py-0.5 w-[120px]"
                                    placeholder="Custom Name"
                                  />
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-[8px] font-black text-gray-700 uppercase tracking-tighter">
                                    Bandwidth
                                  </span>
                                  <select
                                    value={p.txBw || 0.0125}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value);
                                      setManualPairs((pairs) =>
                                        pairs.map((mp) =>
                                          mp.id === p.id
                                            ? { ...mp, txBw: val, rxBw: val }
                                            : mp,
                                        ),
                                      );
                                    }}
                                    className="bg-white text-[9px] text-indigo-800 outline-none font-bold cursor-pointer rounded border border-gray-500 px-1 py-0.5"
                                  >
                                    <option value={0.0125}>
                                      0.0125 (12.5k)
                                    </option>
                                    <option value={0.025}>0.025 (25k)</option>
                                    <option value={0.05}>0.05 (50k)</option>
                                    <option value={0.2}>0.2 (200k)</option>
                                  </select>
                                </div>
                              </div>
                            )}
                          </div>
                        ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
              {results?.map((p) => {
                const active = p.active !== false;
                return (
                  <div
                    key={p.id}
                    className={`p-3 bg-white/80 border transition-all rounded-md flex justify-between items-center group ${active ? "border-gray-500 hover:border-blue-500/30" : "border-slate-800 opacity-60 grayscale-[0.5]"}`}
                  >
                    <div className="flex items-center gap-3 flex-1 overflow-hidden">
                      <div className="flex flex-col items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleResultActiveToggle(p.id)}
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
                      <div className="font-mono text-[11px] space-y-1 flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <button
                              onClick={() => handleToggleBase(p.id, "txIsBase")}
                              className={`text-[8px] font-black flex-shrink-0 px-1 py-0.5 rounded border transition-colors ${(p.txIsBase ?? (mode === "europe" ? p.tx > 464 : p.tx < 464)) ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" : "bg-blue-500/20 border-blue-500/40 text-blue-400"}`}
                              title="Toggle Base (Constant TX) vs SW (Intermittent)"
                            >
                              {(p.txIsBase ??
                              (mode === "europe" ? p.tx > 464 : p.tx < 464))
                                ? "BASE"
                                : "SW"}
                            </button>
                            <ManualFreqInput
                              value={p.tx}
                              onChange={(v) =>
                                handleResultChange(p.id, "tx", v)
                              }
                              className="w-full bg-transparent p-0 text-black font-bold outline-none border-none text-[10px]"
                            />
                          </div>
                          <div className="flex gap-1 flex-shrink-0 transition-opacity">
                            <button
                              onClick={() =>
                                handleFrequencyStep(p.id, "tx", "down")
                              }
                              className="text-[9px] bg-gray-200 text-black rounded px-1 hover:bg-blue-600 font-bold"
                            >
                              -
                            </button>
                            <button
                              onClick={() =>
                                handleFrequencyStep(p.id, "tx", "up")
                              }
                              className="text-[9px] bg-gray-200 text-black rounded px-1 hover:bg-blue-600 font-bold"
                            >
                              +
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <button
                              onClick={() => handleToggleBase(p.id, "rxIsBase")}
                              className={`text-[8px] font-black flex-shrink-0 px-1 py-0.5 rounded border transition-colors ${(p.rxIsBase ?? (mode === "europe" ? p.rx > 464 : p.rx < 464)) ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" : "bg-blue-500/20 border-blue-500/40 text-blue-400"}`}
                              title="Toggle Base (Constant TX) vs SW (Intermittent)"
                            >
                              {(p.rxIsBase ??
                              (mode === "europe" ? p.rx > 464 : p.rx < 464))
                                ? "BASE"
                                : "SW"}
                            </button>
                            <ManualFreqInput
                              value={p.rx}
                              onChange={(v) =>
                                handleResultChange(p.id, "rx", v)
                              }
                              className="w-full bg-transparent p-0 text-black font-bold outline-none border-none text-[11px]"
                            />
                          </div>
                          <div className="flex gap-1 flex-shrink-0 transition-opacity">
                            <button
                              onClick={() =>
                                handleFrequencyStep(p.id, "rx", "down")
                              }
                              className="text-[9px] bg-gray-200 text-black rounded px-1 hover:bg-blue-600 font-bold"
                            >
                              -
                            </button>
                            <button
                              onClick={() =>
                                handleFrequencyStep(p.id, "rx", "up")
                              }
                              className="text-[9px] bg-gray-200 text-black rounded px-1 hover:bg-blue-600 font-bold"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-2 border-l border-gray-500 pl-2 flex-shrink-0">
                      <button
                        onClick={() => handleResultLockToggle(p.id)}
                        className={`p-1.5 rounded transition-all ${p.locked ? "text-amber-500 bg-amber-500/10" : "text-slate-600 hover:text-gray-700"}`}
                        title={p.locked ? "Unlock" : "Lock"}
                      >
                        <span className="text-sm">
                          {p.locked ? "🔒" : "🔓"}
                        </span>
                      </button>
                      <button
                        onClick={() => handleRemoveResult(p.id)}
                        className="text-red-400 hover:text-red-300 p-1 font-bold text-lg font-semibold leading-none"
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
          </Card>
        </div>

        {showLivePreview && results && (
          <div className="xl:w-1/3 h-[calc(100vh-120px)]">
            <LivePdfPreview
              generatePdf={generateInternalPdf}
              title="Talkback Coordination Preview"
              onDownload={() => handleExport("pdf")}
            />
          </div>
        )}
      </div>

      <PdfPreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        generatePdf={generatePdfForPreview}
        filename={`talkback_rf_plan_${new Date().toISOString().slice(0, 10)}`}
      />

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

export default React.memo(TalkbackTab);
