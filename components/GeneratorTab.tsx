import React, { useState, useMemo, useEffect, useRef } from "react";
import { toast } from "sonner";
import { isPro } from "../src/lib/userUtils";
import { useDebounce } from "../hooks/useDebounce";
import { motion } from "motion/react";
import {
  Frequency,
  Thresholds,
  EquipmentProfile,
  CompatibilityLevel,
  Scene,
  GeneratorRequest,
  TxType,
  TVChannelState,
  WMASState,
  ScanDataPoint,
  BandResult,
} from "../types";
import {
  resolveGeneratorRequests,
  getCoordinationDiagnostics,
  CoordinationDiagnostic,
  getFinalThresholds,
} from "../services/rfService";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  generateBrandedPdf,
  getTableStyles,
  generateFullCoordinationPdf,
} from "../src/utils/pdfBranding";
import Card, { CardTitle, Placeholder } from "./Card";
import {
  EQUIPMENT_DATABASE,
  UK_TV_CHANNELS,
  US_TV_CHANNELS,
  COMPATIBILITY_PROFILES,
} from "../constants";
import TvGrid from "./TvGrid";
import SpectrumVisualizer from "./SpectrumVisualizer";
import PdfPreviewModal from "./PdfPreviewModal";
import { InfoTooltip } from "./InfoTooltip";

const ManualFreqInput: React.FC<{
  value: number;
  onChange: (val: number) => void;
  className: string;
}> = ({ value, onChange, className }) => {
  const [localString, setLocalString] = useState<string>(
    value === 0 ? "" : value.toString(),
  );
  const isFocused = useRef(false);

  useEffect(() => {
    if (!isFocused.current) {
      setLocalString(value === 0 ? "" : value.toString());
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "" || /^[0-9]*\.?[0-9]*$/.test(val)) {
      setLocalString(val);
      const parsed = parseFloat(val);
      if (!isNaN(parsed)) {
        onChange(parsed);
      } else if (val === "") {
        onChange(0);
      }
    }
  };

  const handleBlur = () => {
    isFocused.current = false;
    const parsed = parseFloat(localString);
    if (!isNaN(parsed) && parsed !== 0) {
      setLocalString(parsed.toFixed(3));
    } else {
      setLocalString("");
    }
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      placeholder="MHz"
      value={localString}
      onChange={handleChange}
      onFocus={() => {
        isFocused.current = true;
      }}
      onBlur={handleBlur}
      className={className}
    />
  );
};

interface GeneratorTabProps {
  initialThresholds: Thresholds;
  generatedFrequencies: Frequency[] | null;
  setGeneratorFrequencies: (freqs: Frequency[] | null) => void;
  customEquipment: EquipmentProfile[];
  onManageCustomEquipment: () => void;
  inclusionRanges: { min: number; max: number }[] | null;
  setInclusionRanges: (ranges: { min: number; max: number }[] | null) => void;
  scenes: Scene[];
  requests: GeneratorRequest[];
  setRequests: React.Dispatch<React.SetStateAction<GeneratorRequest[]>>;
  exclusions: string;
  setExclusions: (ex: string) => void;
  useGlobalThresholds: boolean;
  setUseGlobalThresholds: (use: boolean) => void;
  globalThresholds: { fundamental: string; twoTone: string; threeTone: string };
  setGlobalThresholds: React.Dispatch<
    React.SetStateAction<{
      fundamental: string;
      twoTone: string;
      threeTone: string;
    }>
  >;
  manualConstraints?: Frequency[];
  setManualConstraints?: React.Dispatch<React.SetStateAction<Frequency[]>>;
  ignoreManualIMD: boolean;
  setIgnoreManualIMD: (ignore: boolean) => void;
  siteThresholds: Thresholds;
  setSiteThresholds: (th: Thresholds) => void;
  equipmentOverrides?: Record<string, Partial<Thresholds>>;
  tvChannelStates?: Record<number, TVChannelState>;
  setTvChannelStates?: (states: Record<number, TVChannelState>) => void;
  tvRegion?: "uk" | "us";
  setTvRegion?: (region: "uk" | "us") => void;
  wmasState?: WMASState;
  setIsCalculating?: (is: boolean) => void;
  scanData?: ScanDataPoint[] | null;
  multiBandResults?: BandResult[] | null;
  user?: any;
}

const buttonBase =
  "px-4 py-2.5 rounded-sm font-semibold uppercase tracking-wide transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 transform active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed";
const primaryButton = `bg-gradient-to-r from-blue-500 to-cyan-600 text-white hover:brightness-110 shadow-sm border border-slate-700/50 shadow-blue-500/20 ${buttonBase}`;
const secondaryButton = `bg-slate-700 text-slate-200 border border-slate-600 hover:bg-slate-600 ${buttonBase}`;
const greenButton = `bg-green-500 text-white border-b-4 border-green-700 hover:bg-green-400 hover:border-green-600 ${buttonBase}`;
const dangerButton = `bg-red-600/80 text-white hover:bg-red-500/80 ${buttonBase}`;
const generateButton = `bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 border-b-4 border-amber-700 hover:border-amber-600 hover:brightness-110 shadow-[0_0_20px_rgba(245,158,11,0.2)] ${buttonBase}`;

const generatorCache: Record<string, any> = {};

function useCachedState<T>(key: string, initialValue: T | (() => T)): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    if (generatorCache[key] !== undefined) return generatorCache[key];
    return typeof initialValue === "function" ? (initialValue as any)() : initialValue;
  });
  useEffect(() => {
    generatorCache[key] = state;
  }, [key, state]);
  return [state, setState];
}

const GeneratorTab: React.FC<GeneratorTabProps> = ({
  user,
  initialThresholds,
  generatedFrequencies,
  setGeneratorFrequencies,
  customEquipment,
  onManageCustomEquipment,
  inclusionRanges,
  setInclusionRanges,
  scenes,
  requests,
  setRequests,
  exclusions,
  setExclusions,
  useGlobalThresholds,
  setUseGlobalThresholds,
  globalThresholds,
  setGlobalThresholds,
  manualConstraints = [],
  setManualConstraints,
  ignoreManualIMD,
  setIgnoreManualIMD,
  siteThresholds,
  setSiteThresholds,
  equipmentOverrides,
  tvChannelStates: initialTvStates = {},
  setTvChannelStates: setInitialTvStates,
  tvRegion: initialRegion = "uk",
  setTvRegion: setInitialRegion,
  wmasState,
  setIsCalculating,
  scanData,
  multiBandResults,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [advancedAnalysis, setAdvancedAnalysis] = useState(false);
  const [diagnostic, setDiagnostic] = useState<CoordinationDiagnostic | null>(
    null,
  );
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isWwbSubmenuOpen, setIsWwbSubmenuOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [calculationStrategy, setCalculationStrategy] = useCachedState<
    "even-distribution" | "bottom-up" | "top-down" | "high-density"
  >("calculationStrategy", "even-distribution");

  const generatePdfForPreview = (
    profile: "client-facing" | "internal-crew",
    clientDetails?: any,
  ) => {
    const doc = new jsPDF("p", "mm", "a4");
    const sortedFreqs = [...(generatedFrequencies || [])].sort(
      (a, b) => a.value - b.value,
    );
    const planData = sortedFreqs.map((f) => {
      const profileData = f.equipmentKey
        ? fullEquipmentDatabase[f.equipmentKey]
        : null;
      const req =
        requests.find((r) => r.id === f.sourceRequestId) ||
        requests.find((r) => r.key === f.equipmentKey);

      const params = req
        ? `${req.compatibilityLevel?.toUpperCase() || "STD"}${req.linearMode ? " (HD)" : ""}`
        : "STD";
      const power = profileData?.type === "iem" ? "50mW" : "10mW";
      const bandwidth = profileData?.type === "wmas" ? "6MHz" : "200kHz";

      const getThString = () => {
        const level = req?.compatibilityLevel || "standard";
        const th = getFinalThresholds(
          {
            equipmentKey: f.equipmentKey,
            compatibilityLevel: level,
            manualThresholds: req?.useManualParams
              ? {
                  fundamental: Number(req.manualFundamental) || 0.35,
                  twoTone: Number(req.manualTwoTone) || 0.075,
                  threeTone: Number(req.manualThreeTone) || 0.05,
                  fiveTone: 0,
                  sevenTone: 0,
                }
              : undefined,
          },
          fullEquipmentDatabase,
          {},
        );

        return `${Math.round(th.fundamental * 1000)}, ${Math.round(th.twoTone * 1000)}, ${Math.round(th.threeTone * 1000)}`;
      };

      return {
        frequency: f.value,
        label: f.label || "-",
        equipment: profileData?.name || "Generic",
        band: profileData?.band || "-",
        power,
        bandwidth,
        parameters: params,
        thresholds: getThString(),
        stage: f.sourceRequestId ? "New Allocation" : "Site System",
        type: f.type || "generic",
      };
    });

    return generateFullCoordinationPdf(
      doc,
      "Unified RF Site Plan",
      planData,
      user?.branding,
      clientDetails,
      profile,
    );
  };

  const [tvRegion, setTvRegion] = useState<"uk" | "us">(initialRegion);
  const [tvChannelStates, setTvChannelStates] =
    useState<Record<number, TVChannelState>>(initialTvStates);

  // WMAS Active Exclusion & Spectrum Protection State
  const [enableWmasExclusions, setEnableWmasExclusions] = useCachedState<boolean>(
    "gen_enableWmasExclusions",
    true,
  );
  const [disabledWmasNodeIds, setDisabledWmasNodeIds] = useCachedState<
    Record<string, boolean>
  >("gen_disabledWmasNodeIds", {});
  const [customWmasExclusions, setCustomWmasExclusions] = useCachedState<
    {
      id: string;
      name: string;
      start: number;
      end: number;
      center: number;
      bandwidth: number;
      enabled: boolean;
    }[]
  >("gen_customWmasExclusions", []);
  const [isAddCustomWmasOpen, setIsAddCustomWmasOpen] = useState(false);
  const [newWmasName, setNewWmasName] = useState("");
  const [newWmasBw, setNewWmasBw] = useState<number>(8);
  const [newWmasCenter, setNewWmasCenter] = useState<string>("474.000");

  const [micCount, setMicCount] = useState<string>("");
  const [showAddMore, setShowAddMore] = useState(false);
  const [additionalEquipment, setAdditionalEquipment] = useState<
    { type: "IEM" | "Comms"; quantity: number }[]
  >([]);

  const resizeConstraints = (newVal: number) => {
    if (!setManualConstraints) return;
    if (newVal < 0) return;
    const currentLength = manualConstraints.length;
    if (newVal < currentLength) {
      setManualConstraints(manualConstraints.slice(0, newVal));
    } else if (newVal > currentLength) {
      const additional = Array.from(
        { length: newVal - currentLength },
        (_, idx) => {
          const num = currentLength + idx + 1;
          return {
            id: `SITE-MIC-${num}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`,
            value: 0,
            label: `Mic ${num}`,
            type: "mic" as TxType,
            locked: true,
            equipmentKey: "custom",
            compatibilityLevel: "standard" as CompatibilityLevel,
          };
        },
      );
      setManualConstraints([...manualConstraints, ...additional]);
    }
  };

  useEffect(() => {
    if (manualConstraints) {
      const len = manualConstraints.length;
      const lenStr = len > 0 ? String(len) : "";
      if (micCount !== lenStr) {
        setMicCount(lenStr);
      }
    }
  }, [manualConstraints]);

  // Sync internal state with props when they change (avoiding setState in render)
  useEffect(() => {
    setTvRegion(initialRegion);
  }, [initialRegion]);

  useEffect(() => {
    setTvChannelStates(initialTvStates);
  }, [initialTvStates]);

  const fullEquipmentDatabase = useMemo(() => {
    const customProfiles = customEquipment.reduce(
      (acc, profile) => {
        acc[profile.id!] = profile;
        return acc;
      },
      {} as Record<string, EquipmentProfile>,
    );
    return { ...EQUIPMENT_DATABASE, ...customProfiles };
  }, [customEquipment]);

  const {
    shureProfiles,
    sennheiserProfiles,
    lectrosonicsProfiles,
    wmasProfiles,
    otherStandardProfiles,
  } = useMemo(() => {
    const allEntries = Object.entries(fullEquipmentDatabase) as [
      string,
      EquipmentProfile,
    ][];
    const wmas = allEntries.filter(
      ([, p]) =>
        p.type === "wmas" ||
        p.name.toLowerCase().includes("wmas") ||
        p.name.toLowerCase().includes("spectera"),
    );
    const shure = allEntries.filter(
      ([, p]) =>
        p.name.toLowerCase().includes("shure") &&
        p.type !== "wmas" &&
        !p.name.toLowerCase().includes("wmas"),
    );
    const sennheiser = allEntries.filter(
      ([, p]) =>
        p.name.toLowerCase().includes("sennheiser") &&
        p.type !== "wmas" &&
        !p.name.toLowerCase().includes("wmas") &&
        !p.name.toLowerCase().includes("spectera"),
    );
    const lectrosonics = allEntries.filter(
      ([, p]) =>
        p.name.toLowerCase().includes("lectrosonics") && p.type !== "wmas",
    );
    const others = allEntries.filter(
      ([k, p]) =>
        !p.isCustom &&
        k !== "custom" &&
        p.type !== "wmas" &&
        !p.name.toLowerCase().includes("wmas") &&
        !p.name.toLowerCase().includes("spectera") &&
        !p.name.toLowerCase().includes("shure") &&
        !p.name.toLowerCase().includes("sennheiser") &&
        !p.name.toLowerCase().includes("lectrosonics"),
    );
    return {
      shureProfiles: shure,
      sennheiserProfiles: sennheiser,
      lectrosonicsProfiles: lectrosonics,
      wmasProfiles: wmas,
      otherStandardProfiles: others,
    };
  }, [fullEquipmentDatabase]);

  const EquipmentOptionsNode = useMemo(() => {
    return (
      <>
        <optgroup label="General">
          <option value="custom">Custom Range / Generic</option>
        </optgroup>
        <optgroup label="⚡ WMAS Wideband & Sub-Band Systems">
          {wmasProfiles.map(([key, p]) => (
            <option key={key} value={key}>
              ⚡ {p.name} ({p.band})
            </option>
          ))}
        </optgroup>
        <optgroup label="Shure">
          {shureProfiles.map(([key, p]) => (
            <option key={key} value={key}>
              {p.name} ({p.band})
            </option>
          ))}
        </optgroup>
        <optgroup label="Sennheiser">
          {sennheiserProfiles.map(([key, p]) => (
            <option key={key} value={key}>
              {p.name} ({p.band})
            </option>
          ))}
        </optgroup>
        <optgroup label="Lectrosonics">
          {lectrosonicsProfiles.map(([key, p]) => (
            <option key={key} value={key}>
              {p.name} ({p.band})
            </option>
          ))}
        </optgroup>
        <optgroup label="Other Professional">
          {otherStandardProfiles.map(([key, p]) => (
            <option key={key} value={key}>
              {p.name} ({p.band})
            </option>
          ))}
        </optgroup>
      </>
    );
  }, [
    wmasProfiles,
    shureProfiles,
    sennheiserProfiles,
    lectrosonicsProfiles,
    otherStandardProfiles,
  ]);

  const currentTvChannels = useMemo(() => {
    return tvRegion === "uk" ? UK_TV_CHANNELS : US_TV_CHANNELS;
  }, [tvRegion]);

  const parseExclusionString = (
    exStr: string,
  ): { min: number; max: number }[] => {
    return exStr
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter((s) => s)
      .map((rangeStr) => {
        const parts = rangeStr.split(/[-–]/);
        if (parts.length === 2) {
          const min = parseFloat(parts[0]);
          const max = parseFloat(parts[1]);
          if (!isNaN(min) && !isNaN(max) && min < max) {
            return { min, max };
          }
        }
        return null;
      })
      .filter((r): r is { min: number; max: number } => r !== null);
  };

  const parsedExclusionsList = useMemo(() => {
    return parseExclusionString(exclusions);
  }, [exclusions]);

  const handleExclusionZoneAdd = (min: number, max: number) => {
    const sMin = Math.min(min, max);
    const sMax = Math.max(min, max);
    if (Math.abs(sMax - sMin) < 0.001) return;
    const newRange = `${sMin.toFixed(3)}-${sMax.toFixed(3)}`;
    const updated = exclusions && exclusions.trim() ? `${exclusions.trim()}, ${newRange}` : newRange;
    setExclusions(updated);
  };

  const handleExclusionZoneRemove = (index: number) => {
    const currentZones = parseExclusionString(exclusions);
    const updatedZones = currentZones.filter((_, i) => i !== index);
    const updated = updatedZones.map((z) => `${z.min.toFixed(3)}-${z.max.toFixed(3)}`).join(", ");
    setExclusions(updated);
  };

  const addManualConstraint = () => {
    if (!setManualConstraints) return;
    const newConstraint: Frequency = {
      id: `SITE-${manualConstraints.length + 1}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`,
      value: 0,
      label: "Site Mic",
      type: "mic",
      locked: true,
      equipmentKey: "custom",
      compatibilityLevel: "standard",
    };
    setManualConstraints([...manualConstraints, newConstraint]);
  };

  const removeManualConstraint = (index: number) => {
    if (!setManualConstraints) return;
    setManualConstraints(manualConstraints.filter((_, i) => i !== index));
  };

  const updateManualConstraint = (
    index: number,
    field: keyof Frequency,
    value: any,
  ) => {
    if (!setManualConstraints) return;
    setManualConstraints(
      manualConstraints.map((f, i) => {
        if (i !== index) return f;
        return { ...f, [field]: value };
      }),
    );
  };

  const updateSiteThresholds = (field: keyof Thresholds, value: string) => {
    const numVal = parseFloat(value) || 0;
    setSiteThresholds({ ...siteThresholds, [field]: numVal });
  };

  const handleAddRequest = () => {
    const newRequest: GeneratorRequest = {
      id: Date.now(),
      key: "shure-ad-g56",
      label: "",
      count: "8",
      customMin: "470.000",
      customMax: "636.000",
      compatibilityLevel: "standard",
      linearMode: false,
      type: "mic",
    };
    setRequests((prev) => [...prev, newRequest]);
  };

  const handleAddWmasRequest = (presetKey?: string) => {
    const defaultKey =
      presetKey ||
      (tvRegion === "us"
        ? "sennheiser-spectera-6mhz"
        : "sennheiser-spectera-8mhz");
    const profile =
      fullEquipmentDatabase[defaultKey] ||
      fullEquipmentDatabase["sennheiser-spectera-8mhz"];
    const is800k = defaultKey.includes("800khz");
    const is1600k = defaultKey.includes("1600khz");
    const is6mhz = defaultKey.includes("6mhz");
    const labelPrefix = is800k
      ? "Shure 800kHz Sub-Band"
      : is1600k
        ? "Shure 1.6MHz Dual Sub-Band"
        : is6mhz
          ? "WMAS 6MHz Carrier"
          : "WMAS 8MHz Carrier";

    const newRequest: GeneratorRequest = {
      id: Date.now(),
      key: defaultKey,
      label: `${labelPrefix} #${requests.filter((r) => r.type === "wmas").length + 1}`,
      count: "1",
      customMin: (profile?.minFreq || 470).toFixed(3),
      customMax: (profile?.maxFreq || 694).toFixed(3),
      compatibilityLevel: "standard",
      linearMode: false,
      type: "wmas",
    };
    setRequests((prev) => [...prev, newRequest]);
    toast.success(`Added ${profile?.name || "WMAS System"} carrier request`);
  };

  const handleAddCustomWmasExclusion = () => {
    const center = parseFloat(newWmasCenter);
    if (isNaN(center) || center <= 0) {
      toast.error("Please enter a valid center frequency");
      return;
    }
    const bw = newWmasBw || 8;
    const half = bw / 2;
    const start = parseFloat((center - half).toFixed(3));
    const end = parseFloat((center + half).toFixed(3));
    const name =
      newWmasName.trim() ||
      `WMAS Block (${bw >= 1 ? `${bw} MHz` : `${Math.round(bw * 1000)} kHz`}) @ ${center.toFixed(3)} MHz`;

    const newBlock = {
      id: `wmas-custom-${Date.now()}`,
      name,
      center,
      bandwidth: bw,
      start,
      end,
      enabled: true,
    };
    setCustomWmasExclusions((prev) => [...prev, newBlock]);
    setNewWmasName("");
    setIsAddCustomWmasOpen(false);
    toast.success(`Protected WMAS carrier block ${start.toFixed(3)} - ${end.toFixed(3)} MHz`);
  };

  const handleRemoveCustomWmasExclusion = (id: string) => {
    setCustomWmasExclusions((prev) => prev.filter((b) => b.id !== id));
  };

  const handleToggleCustomWmasExclusion = (id: string) => {
    setCustomWmasExclusions((prev) =>
      prev.map((b) => (b.id === id ? { ...b, enabled: !b.enabled } : b)),
    );
  };

  const handleToggleWmasNodeExclusion = (nodeId: string) => {
    setDisabledWmasNodeIds((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
  };

  const handleImportWmasToExclusionsText = () => {
    const ranges: string[] = [];
    if (wmasState && wmasState.nodes) {
      wmasState.nodes.forEach((n) => {
        if (n.assignedBlock && !disabledWmasNodeIds[n.id]) {
          ranges.push(
            `${n.assignedBlock.start.toFixed(3)}-${n.assignedBlock.end.toFixed(3)}`,
          );
        }
      });
    }
    customWmasExclusions.forEach((cw) => {
      if (cw.enabled) {
        ranges.push(`${cw.start.toFixed(3)}-${cw.end.toFixed(3)}`);
      }
    });

    if (ranges.length === 0) {
      toast.error("No active WMAS carrier blocks found to import.");
      return;
    }

    const current = exclusions.trim();
    const joined = ranges.join(", ");
    const updated = current ? `${current}, ${joined}` : joined;
    setExclusions(updated);
    setExclusions(updated);
    toast.success(`Imported ${ranges.length} WMAS exclusion ranges into custom exclusions.`);
  };

  const handleRemoveRequest = (id: number) => {
    setRequests((prev) => prev.filter((req) => req.id !== id));
  };

  const handleUpdateRequest = (
    id: number,
    field: keyof GeneratorRequest,
    value: any,
  ) => {
    setRequests((prev) =>
      prev.map((req) => {
        if (req.id === id) {
          let updated = { ...req, [field]: value };

          if (field === "useManualParams" && value === true) {
            const standardTh = getFinalThresholds(
              { equipmentKey: req.key, compatibilityLevel: "standard" },
              fullEquipmentDatabase,
              equipmentOverrides,
            );
            if (updated.manualFundamental === undefined)
              updated.manualFundamental = standardTh.fundamental;
            if (updated.manualTwoTone === undefined)
              updated.manualTwoTone = standardTh.twoTone;
            if (updated.manualThreeTone === undefined)
              updated.manualThreeTone = standardTh.threeTone;
            if (updated.manualFiveTone === undefined)
              updated.manualFiveTone = standardTh.fiveTone;
            if (updated.manualSevenTone === undefined)
              updated.manualSevenTone = standardTh.sevenTone;
          }

          if (field === "key") {
            const profile = fullEquipmentDatabase[value as string];
            if (profile) {
              if (value !== "custom") {
                updated.customMin = profile.minFreq.toFixed(3);
                updated.customMax = profile.maxFreq.toFixed(3);
              }
              if (profile.recommendedThresholds?.threeTone !== 0) {
                updated.linearMode = false;
              }
              if (profile.type) {
                updated.type = profile.type;
              }
            }
          }
          return updated;
        }
        return req;
      }),
    );
  };

  const handleTvChannelCycle = (channel: number) => {
    const current = tvChannelStates[channel] || "available";
    let next: TVChannelState = "available";
    if (current === "available") next = "mic-only";
    else if (current === "mic-only") next = "iem-only";
    else if (current === "iem-only") next = "both";
    else if (current === "both") next = "blocked";
    else if (current === "blocked") next = "available";

    const nextMap = { ...tvChannelStates, [channel]: next };
    setTvChannelStates(nextMap);
    if (setInitialTvStates) setInitialTvStates(nextMap);
  };

  const handleBlockAllTvChannels = () => {
    const next: Record<number, TVChannelState> = {};
    Object.keys(currentTvChannels).forEach((ch) => {
      next[Number(ch)] = "blocked";
    });
    setTvChannelStates(next);
    if (setInitialTvStates) setInitialTvStates(next);
  };

  const clearTv = () => {
    setTvChannelStates({});
    if (setInitialTvStates) setInitialTvStates({});
  };

  const handleGenerate = async () => {
    // Check free limit
    if (!isPro(user)) {
      const totalRequested = requests.reduce((sum, req) => sum + parseInt(String(req.count || "0"), 10), 0);
      if (totalRequested > 6) {
        toast.error("Free Plan Limit: Maximum of 6 frequencies can be generated at once. Please upgrade to Pro.");
        return;
      }
    }

    setIsLoading(true);
    if (setIsCalculating) setIsCalculating(true);
    setDiagnostic(null);
    setProgress(0);
    await new Promise((resolve) => setTimeout(resolve, 50));

    const parsedExclusions = parseExclusionString(exclusions);

    // Add active WMAS system nodes as wideband exclusion blocks
    if (enableWmasExclusions && wmasState && Array.isArray(wmasState.nodes)) {
      wmasState.nodes.forEach((node) => {
        if (node && node.assignedBlock && !disabledWmasNodeIds[node.id]) {
          const start = Number(node.assignedBlock.start);
          const end = Number(node.assignedBlock.end);
          if (!isNaN(start) && !isNaN(end) && start < end) {
            parsedExclusions.push({
              min: start,
              max: end,
            });
          }
        }
      });
    }

    // Add active custom WMAS exclusion blocks
    if (enableWmasExclusions && Array.isArray(customWmasExclusions)) {
      customWmasExclusions.forEach((cw) => {
        if (cw && cw.enabled) {
          const start = Number(cw.start);
          const end = Number(cw.end);
          if (!isNaN(start) && !isNaN(end) && start < end) {
            parsedExclusions.push({
              min: start,
              max: end,
            });
          }
        }
      });
    }

    const preparedRequests = requests.map((req) => {
      return {
        ...req,
        id: String(req.id),
        count: Number(req.count) || 0,
        customMin: Number(req.customMin) || 0,
        customMax: Number(req.customMax) || 0,
        manualFundamental: req.useManualParams
          ? Number(req.manualFundamental)
          : undefined,
        manualTwoTone: req.useManualParams
          ? Number(req.manualTwoTone)
          : undefined,
        manualThreeTone: req.useManualParams
          ? Number(req.manualThreeTone)
          : undefined,
        manualFiveTone: req.useManualParams
          ? Number(req.manualFiveTone)
          : undefined,
        manualSevenTone: req.useManualParams
          ? Number(req.manualSevenTone)
          : undefined,
        type: req.type,
      };
    });

    // SITE COORDINATION: Unified pool check
    const lockedConstraints =
      generatedFrequencies?.filter(
        (f) => f.locked && !manualConstraints.some((m) => m.id === f.id),
      ) || [];

    try {
      const results = await resolveGeneratorRequests(
        preparedRequests,
        lockedConstraints,
        fullEquipmentDatabase,
        parsedExclusions,
        inclusionRanges,
        advancedAnalysis,
        useGlobalThresholds,
        (p) => setProgress(p),
        manualConstraints,
        equipmentOverrides,
        globalThresholds,
        ignoreManualIMD,
        tvChannelStates,
        tvRegion,
        siteThresholds,
        calculationStrategy,
      );

      // The engine now returns the FULL unified pool
      setGeneratorFrequencies(results);

      const totalRequested: number = requests.reduce(
        (s, r) => s + (Number(r.count) || 0),
        0,
      );
      const totalFound: number = results.filter(
        (f) => f.sourceRequestId,
      ).length;

      const diag = getCoordinationDiagnostics(
        totalRequested,
        totalFound,
        470,
        700,
        parsedExclusions,
        useGlobalThresholds
          ? {
              fundamental: parseFloat(globalThresholds.fundamental),
              twoTone: parseFloat(globalThresholds.twoTone),
              threeTone: parseFloat(globalThresholds.threeTone),
              fiveTone: 0,
              sevenTone: 0,
            }
          : initialThresholds,
      );
      setDiagnostic(diag);
    } catch (e) {
      console.error("Site coordination failed:", e);
      toast.error("An error occurred during site calculation.");
    } finally {
      setIsLoading(false);
      if (setIsCalculating) setIsCalculating(false);
    }
  };

  // FIX: Cast Object.entries to the expected type to resolve "unknown" property errors
  const resultsCategorized = useMemo<{
    manual: Frequency[];
    allocations: Record<string, Frequency[]>;
  }>(() => {
    if (!generatedFrequencies) return { manual: [], allocations: {} };
    const manual = generatedFrequencies.filter((f) => !f.sourceRequestId);
    const allocations = generatedFrequencies.reduce(
      (acc, freq) => {
        if (!freq.sourceRequestId) return acc;
        const reqId = freq.sourceRequestId;
        if (!acc[reqId]) acc[reqId] = [];
        acc[reqId].push(freq);
        return acc;
      },
      {} as Record<string, Frequency[]>,
    );
    return { manual, allocations };
  }, [generatedFrequencies]);

  const handleLockAll = () => {
    if (!generatedFrequencies) return;
    setGeneratorFrequencies(
      generatedFrequencies.map((f) => ({ ...f, locked: true })),
    );
  };

  const handleUnlockAll = () => {
    if (!generatedFrequencies) return;
    setGeneratorFrequencies(
      generatedFrequencies.map((f) => ({ ...f, locked: false })),
    );
  };

  const handleLockToggle = (id: string) => {
    setGeneratorFrequencies(
      (generatedFrequencies || []).map((f) =>
        f.id === id ? { ...f, locked: !f.locked } : f,
      ),
    );
  };

  const handleFrequencyValueChange = (id: string, newValue: number) => {
    if (manualConstraints && manualConstraints.some((f) => f.id === id) && setManualConstraints) {
      setManualConstraints(
        manualConstraints.map((f) =>
          f.id === id ? { ...f, value: newValue } : f,
        ),
      );
      return;
    }
    if (!generatedFrequencies) return;
    setGeneratorFrequencies(
      generatedFrequencies.map((f) =>
        f.id === id ? { ...f, value: newValue, locked: true } : f,
      ),
    );
  };

  const handleRemoveFrequency = (id: string) => {
    if (!generatedFrequencies) return;
    setGeneratorFrequencies(generatedFrequencies.filter((f) => f.id !== id));
  };

  const handleExport = (
    format: "pdf" | "branded-pdf" | "csv" | "xls" | "doc" | "txt" | "wwb",
  ) => {
    setIsExportMenuOpen(false);
    if (!generatedFrequencies || generatedFrequencies.length === 0) return;

    const filename = `unified_rf_coordination_${new Date().toISOString().slice(0, 10)}`;
    const sortedFreqs = [...generatedFrequencies].sort(
      (a, b) => a.value - b.value,
    );

    if (format === "wwb") {
      const content = sortedFreqs.map(f => f.value.toFixed(3)).join('\n');
      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}_WWB_Smart_Export.txt`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("✅ WWB Smart Export (.TXT) Downloaded");
    } else if (format === "csv" || format === "xls") {
      let content = "Frequency (MHz),Label,Type,Equipment,Source\n";
      sortedFreqs.forEach((f) => {
        const source = f.sourceRequestId ? "New Allocation" : "Existing Site";
        const profile = fullEquipmentDatabase[f.equipmentKey || "custom"];
        content += `${f.value.toFixed(3)},"${f.label || ""}",${f.type},"${profile?.name || "Generic"}","${source}"\n`;
      });
      const blob = new Blob([content], {
        type: format === "xls" ? "application/vnd.ms-excel" : "text/csv",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.${format}`;
      a.click();
    } else if (format === "txt") {
      let txt =
        "UNIFIED RF COORDINATION LEDGER\n==============================\n\n";
      sortedFreqs.forEach((f) => {
        txt += `${f.value.toFixed(3)} MHz | ${f.label || "CH"} | ${f.type} | ${f.sourceRequestId ? "NEW" : "SITE"}\n`;
      });
      const blob = new Blob([txt], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.txt`;
      a.click();
    } else if (format === "pdf" || format === "branded-pdf") {
      const doc = new jsPDF();
      let startY = 20;
      if (format === "branded-pdf") {
        startY = generateBrandedPdf(
          doc,
          "Unified RF Site Plan",
          user?.branding,
        );
      } else {
        doc.setFontSize(18);
        doc.text("Unified RF Site Plan", 14, startY);
        startY += 15;
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, startY);
        startY += 5;
      }

      const tableData = sortedFreqs.map((f) => [
        f.value.toFixed(3),
        f.label || "—",
        f.type || "generic",
        f.sourceRequestId ? "New" : "Site Mic",
      ]);

      autoTable(doc, {
        startY: startY,
        head: [["Frequency", "Label", "Type", "Origin"]],
        body: tableData,
        ...getTableStyles(user?.branding?.brandColor, user?.branding),
      });

      doc.save(`${filename}.pdf`);
    }
  };

  const handleExportGroupWwb = (groupName: string, groupFreqs: Frequency[]) => {
    if (!groupFreqs || groupFreqs.length === 0) return;
    const sorted = [...groupFreqs].filter(f => f.value > 0).sort((a, b) => a.value - b.value);
    if (sorted.length === 0) {
      toast.error("No valid frequencies in this group to export.");
      return;
    }
    const content = sorted.map(f => f.value.toFixed(3)).join('\n');
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const cleanName = groupName.replace(/\s+/g, '_').toUpperCase();
    a.download = `WWB_${cleanName}_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`✅ WWB Smart Export (.TXT) Downloaded for ${groupName}`);
  };

  const handleImportGenerator = () => {
    if (!generatedFrequencies) return;
    const valid = generatedFrequencies.filter((f) => f.value > 0);
    const current = manualConstraints.filter((f) => f.value > 0);
    const next = valid.map((f, i) => ({
      id: `F${current.length + i + 1}`,
      value: f.value,
      label: f.label || "GEN",
      type: f.type || "generic",
      locked: false,
    }));
    // We are no longer copying to Analyzer's frequencies array here
  };

  const handleImportMultiBand = () => {
    if (!multiBandResults) return;
    const valid = multiBandResults
      .flatMap((b) => b.frequencies)
      .filter((f) => f.value > 0);
    const current = manualConstraints.filter((f) => f.value > 0);
    const next = valid.map((f, i) => ({
      id: `F${current.length + i + 1}`,
      value: f.value,
      label: f.label || "MB",
      type: f.type || "generic",
      locked: false,
    }));
    // We are no longer copying to Analyzer's frequencies array here
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pb-2">
        {/* LEFT COLUMN: INPUTS & CONFIGURATION */}
        <div className="lg:col-span-8 space-y-6">
          {/* BENTO SECTION: SITE ENVIRONMENT */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="!hover:translate-y-0 !hover:shadow-sm border border-slate-700/50 border-2 border-indigo-500/20 md:col-span-2">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
                <div>
                  <CardTitle className="!mb-0 flex items-center">
                    ✍️ Existing Site Frequencies
                    <InfoTooltip content="Enter frequencies of equipment already in use at the site to ensure the generated plan avoids them." />
                  </CardTitle>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">
                    Manual Constraints & Protected Channels
                  </p>
                </div>
              </div>

              <div className="mb-4">
                <label className="text-[10px] text-slate-500 uppercase font-black mb-1 block">
                  Number of Frequencies
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const currentVal = manualConstraints.length;
                      const newVal = Math.max(0, currentVal - 1);
                      resizeConstraints(newVal);
                    }}
                    className="flex items-center justify-center bg-slate-800 hover:bg-slate-700 active:bg-slate-600 border border-slate-700 text-slate-300 font-bold rounded-sm w-8 h-8 select-none transition-colors"
                    title="Decrease frequencies"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={micCount}
                    onChange={(e) => {
                      setMicCount(e.target.value);
                      const val = parseInt(e.target.value);
                      if (!isNaN(val) && val >= 0) {
                        resizeConstraints(val);
                      } else if (e.target.value === "") {
                        if (setManualConstraints) setManualConstraints([]);
                      }
                    }}
                    className="bg-slate-950 border border-slate-700 rounded-sm p-2 text-slate-300 text-xs font-bold w-16 text-center focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="0"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const currentVal = manualConstraints.length;
                      const newVal = currentVal + 1;
                      resizeConstraints(newVal);
                    }}
                    className="flex items-center justify-center bg-slate-800 hover:bg-slate-700 active:bg-slate-600 border border-slate-700 text-slate-300 font-bold rounded-sm w-8 h-8 select-none transition-colors"
                    title="Increase frequencies"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 mb-6 custom-scrollbar">
                {manualConstraints.map((freq, i) => (
                  <div
                    key={freq.id || i}
                    className="flex flex-col gap-2 items-center bg-slate-900/50 p-2 rounded-md border border-white/5 group hover:border-indigo-500/30 transition-all relative w-24"
                  >
                    <div className="flex items-center justify-between w-full px-0.5">
                      <label className="text-[9px] text-slate-600 font-mono font-bold">
                        {i + 1}
                      </label>
                      <button
                        onClick={() => removeManualConstraint(i)}
                        className="text-red-400/50 hover:text-red-400 transition-colors p-0.5 text-base font-medium leading-none"
                      >
                        &times;
                      </button>
                    </div>
                    <ManualFreqInput
                      value={freq.value}
                      onChange={(val) =>
                        updateManualConstraint(i, "value", val)
                      }
                      className="bg-slate-950 border border-slate-700 rounded-sm p-1.5 text-indigo-300 text-[11px] font-black font-mono focus:ring-1 focus:ring-indigo-500 outline-none shadow-inner w-full text-center"
                    />
                    <input
                      type="text"
                      placeholder="Label"
                      value={freq.label || ""}
                      onChange={(e) =>
                        updateManualConstraint(i, "label", e.target.value)
                      }
                      className="bg-slate-950 border border-slate-700 rounded-sm p-1.5 text-slate-300 text-[9px] font-bold w-full text-center focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                    <select
                      value={freq.type || "mic"}
                      onChange={(e) =>
                        updateManualConstraint(i, "type", e.target.value)
                      }
                      className="bg-slate-800 border border-slate-700 rounded p-1 text-slate-400 text-[8px] font-black uppercase tracking-tighter w-full text-center focus:ring-1 focus:ring-indigo-500 outline-none"
                    >
                      <option value="mic">Mic</option>
                      <option value="iem">IEM</option>
                      <option value="comms">Comms</option>
                      <option value="generic">Gen</option>
                    </select>
                  </div>
                ))}
                {manualConstraints.length === 0 && (
                  <div className="py-10 text-center border-2 border-dashed border-white/5 rounded-md bg-black/20 w-full">
                    <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest">
                      No Frequencies Entered
                    </p>
                  </div>
                )}
              </div>

              {/* Add More Equipment Prompt */}
              <div className="mb-4 p-2 bg-slate-900/50 rounded-md border border-slate-700">
                <p className="text-[10px] text-slate-300 font-bold uppercase mb-3">
                  Add More Equipment?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowAddMore(true)}
                    className="px-3 py-2 bg-indigo-600 text-white rounded-sm text-xs font-bold"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setShowAddMore(false)}
                    className="px-3 py-2 bg-slate-700 text-slate-300 rounded-sm text-xs font-bold"
                  >
                    No
                  </button>
                </div>
              </div>

              <div className="p-2 bg-slate-950/50 border border-white/5 rounded-md mb-4">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-4">
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center">
                    Site Protection Parameters
                    <InfoTooltip content="Set the minimum frequency spacing required between the generated plan and the existing site frequencies." />
                  </span>
                  
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-slate-900/80 p-1.5 rounded-sm border border-slate-700/50">
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold ml-1">Make newly generated frequencies:</span>
                    <div className="flex gap-2">
                      <label className={`flex items-center gap-2 cursor-pointer p-1.5 rounded border transition-colors ${ignoreManualIMD ? 'bg-indigo-500/20 border-indigo-500/50' : 'bg-transparent border-transparent hover:bg-white/5'}`}>
                        <input
                          type="radio"
                          name="siteConstraintMode"
                          checked={ignoreManualIMD}
                          onChange={() => setIgnoreManualIMD(true)}
                          className="w-3.5 h-3.5 accent-indigo-500"
                        />
                        <span className={`text-[10px] font-bold uppercase tracking-tighter leading-none ${ignoreManualIMD ? 'text-indigo-300' : 'text-slate-400'}`}>
                          Channel-Spaced Only
                        </span>
                      </label>
                      <label className={`flex items-center gap-2 cursor-pointer p-1.5 rounded border transition-colors ${!ignoreManualIMD ? 'bg-green-500/20 border-green-500/50' : 'bg-transparent border-transparent hover:bg-white/5'}`}>
                        <input
                          type="radio"
                          name="siteConstraintMode"
                          checked={!ignoreManualIMD}
                          onChange={() => setIgnoreManualIMD(false)}
                          className="w-3.5 h-3.5 accent-green-500"
                        />
                        <span className={`text-[10px] font-bold uppercase tracking-tighter leading-none ${!ignoreManualIMD ? 'text-green-300' : 'text-slate-400'}`}>
                          Intermodulation Free
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
                <div className="mb-4">
                  <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                    Calculation Strategy
                  </label>
                  <select
                    value={calculationStrategy}
                    onChange={(e: any) =>
                      setCalculationStrategy(e.target.value)
                    }
                    className="bg-slate-900 border border-slate-700 rounded-sm text-xs text-indigo-300 outline-none px-2 py-2 font-bold w-full"
                  >
                    <option value="even-distribution">Even Distribution</option>
                    <option value="bottom-up">Bottom-Up Packing</option>
                    <option value="top-down">Top-Down Packing</option>
                    <option value="high-density">High Density Packing</option>
                  </select>
                </div>
                {ignoreManualIMD ? (
                  <div className="flex flex-col mb-4">
                    <label className="text-[10px] text-indigo-300 font-black uppercase tracking-widest mb-2 flex items-center gap-2">
                      Minimum Channel Spacing (MHz)
                      <InfoTooltip content="Set the minimum channel spacing required between the generated plan and the existing site frequencies. e.g., 0.350 for 350 kHz." />
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      value={siteThresholds.fundamental}
                      onChange={(e) =>
                        updateSiteThresholds("fundamental", e.target.value)
                      }
                      className="bg-slate-900 border border-indigo-500/50 rounded-sm text-sm text-amber-300 text-center font-mono py-3 font-bold w-full md:w-1/2"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col">
                      <label className="text-[8px] text-slate-500 font-black uppercase tracking-tighter text-center mb-1 flex justify-center items-center gap-1">
                        Fundamental <InfoTooltip content="Minimum spacing required between any two frequencies." />
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        value={siteThresholds.fundamental}
                        onChange={(e) =>
                          updateSiteThresholds("fundamental", e.target.value)
                        }
                        className="bg-slate-900 border border-green-500/30 rounded text-xs text-green-300 text-center font-mono py-2"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[8px] text-slate-500 font-black uppercase tracking-tighter text-center mb-1">
                        2-Tone IMD
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        value={siteThresholds.twoTone}
                        onChange={(e) =>
                          updateSiteThresholds("twoTone", e.target.value)
                        }
                        className="bg-slate-900 border border-green-500/30 rounded text-xs text-green-300 text-center font-mono py-2"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[8px] text-slate-500 font-black uppercase tracking-tighter text-center mb-1">
                        3-Tone IMD
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        value={siteThresholds.threeTone}
                        onChange={(e) =>
                          updateSiteThresholds("threeTone", e.target.value)
                        }
                        className="bg-slate-900 border border-green-500/30 rounded text-xs text-green-300 text-center font-mono py-2"
                      />
                    </div>
                  </div>
                )}
              </div>

              {showAddMore && (
                <div className="mb-4 p-2 bg-slate-900/50 rounded-md border border-indigo-500/30">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase font-black mb-1 block">
                        Type
                      </label>
                      <select
                        id="add-equip-type"
                        className="bg-slate-800 border border-slate-700 rounded p-2 text-slate-400 text-[9px] font-black uppercase tracking-tighter w-full"
                      >
                        <option value="iem">IEM</option>
                        <option value="comms">Comms</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase font-black mb-1 block">
                        Quantity
                      </label>
                      <input
                        id="add-equip-qty"
                        type="number"
                        className="bg-slate-950 border border-slate-700 rounded-sm p-2 text-slate-300 text-xs font-bold w-full"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const type = (
                        document.getElementById(
                          "add-equip-type",
                        ) as HTMLSelectElement
                      ).value;
                      const qty = parseInt(
                        (
                          document.getElementById(
                            "add-equip-qty",
                          ) as HTMLInputElement
                        ).value,
                      );
                      if (!isNaN(qty) && qty > 0) {
                        const newConstraints = Array.from(
                          { length: qty },
                          (_, i) => ({
                            id: `SITE-${type.toUpperCase()}-${i + 1}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`,
                            value: 0,
                            label: `${type.toUpperCase()} ${i + 1}`,
                            type: type as TxType,
                            locked: true,
                            equipmentKey: "custom",
                            compatibilityLevel:
                              "standard" as CompatibilityLevel,
                          }),
                        );
                        setManualConstraints([
                          ...manualConstraints,
                          ...newConstraints,
                        ]);
                        setShowAddMore(false);
                      }
                    }}
                    className="mt-4 w-full py-2 bg-green-600 text-white rounded-sm text-xs font-bold"
                  >
                    Add
                  </button>
                </div>
              )}
            </Card>
          </div>

          <Card className="!hover:translate-y-0 !hover:shadow-sm border border-slate-700/50">
            <CardTitle>📡 Frequency Allocations</CardTitle>
            <div className="space-y-6 flex-grow pr-3 custom-scrollbar">
              {requests.map((req, idx) => (
                <div
                  key={req.id}
                  className="bg-slate-900/50 p-2 rounded-md border border-slate-700 relative group transition-all hover:border-blue-500/30"
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
                    <input
                      type="text"
                      value={req.label || ""}
                      onChange={(e) =>
                        handleUpdateRequest(
                          Number(req.id),
                          "label",
                          e.target.value,
                        )
                      }
                      placeholder={`Batch Group #${idx + 1}`}
                      className="font-black text-base font-medium text-blue-300 bg-transparent outline-none focus:border-b border-blue-400 flex-grow mr-4 uppercase tracking-tight w-full sm:w-auto"
                    />
                    <div className="flex items-center justify-between w-full sm:w-auto gap-3">
                      {(req.type === "wmas" ||
                        fullEquipmentDatabase[req.key]?.type === "wmas" ||
                        fullEquipmentDatabase[req.key]?.recommendedThresholds
                          ?.threeTone === 0) && (
                        <label className="flex items-center gap-2 cursor-pointer bg-cyan-600/10 border border-cyan-500/30 px-3 py-1.5 rounded-sm">
                          <span className="text-cyan-300 text-[10px] font-black uppercase tracking-widest">
                            HD Mode
                          </span>
                          <input
                            type="checkbox"
                            checked={req.linearMode}
                            onChange={(e) =>
                              handleUpdateRequest(
                                Number(req.id),
                                "linearMode",
                                e.target.checked,
                              )
                            }
                            className="w-4 h-4 rounded accent-cyan-400"
                          />
                        </label>
                      )}
                      <button
                        onClick={() => handleRemoveRequest(Number(req.id))}
                        className="text-rose-500 hover:text-rose-400 font-bold text-lg font-semibold leading-none"
                      >
                        &times;
                      </button>
                    </div>
                  </div>

                  {(req.type === "wmas" ||
                    fullEquipmentDatabase[req.key]?.type === "wmas") && (
                    <div className="mb-4 px-3 py-2.5 bg-gradient-to-r from-cyan-950/60 via-slate-900 to-indigo-950/60 border border-cyan-500/30 rounded-md flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">⚡</span>
                        <div>
                          <span className="text-[11px] font-black uppercase text-cyan-300 tracking-wider block">
                            WMAS Wideband Carrier (OFDM Broadband)
                          </span>
                          <p className="text-[10px] text-slate-400">
                            Continuous wideband block allocation with full linear intermod protection
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono px-2.5 py-1 rounded-sm bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40 shrink-0">
                        {req.key?.includes("800khz")
                          ? "800 kHz Sub-Band"
                          : req.key?.includes("1600khz")
                            ? "1.6 MHz Dual Sub-Band"
                            : req.key?.includes("6mhz")
                              ? "6.0 MHz Block"
                              : "8.0 MHz Block"}
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
                    <div className="sm:col-span-2">
                      <label className="text-[10px] text-slate-500 uppercase font-black mb-1 block">
                        Hardware Profile
                      </label>
                      <select
                        value={req.key}
                        onChange={(e) =>
                          handleUpdateRequest(
                            Number(req.id),
                            "key",
                            e.target.value,
                          )
                        }
                        className="w-full bg-slate-800 border border-blue-500/30 rounded-sm p-2.5 text-slate-200 text-sm"
                      >
                        {EquipmentOptionsNode}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase font-black mb-1 block">
                        Device Type
                      </label>
                      <select
                        value={req.type || "mic"}
                        onChange={(e) =>
                          handleUpdateRequest(
                            Number(req.id),
                            "type",
                            e.target.value,
                          )
                        }
                        className="w-full bg-slate-800 border border-blue-500/30 rounded-sm p-2.5 text-slate-200 text-sm font-black uppercase"
                      >
                        <option value="mic">Mic</option>
                        <option value="iem">IEM</option>
                        <option value="comms">Comms</option>
                        <option value="generic">Generic</option>
                        <option value="wmas">WMAS</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase font-black mb-1 block">
                        Quantity
                      </label>
                      <input
                        type="number"
                        value={req.count}
                        onChange={(e) =>
                          handleUpdateRequest(
                            Number(req.id),
                            "count",
                            e.target.value,
                          )
                        }
                        className="w-full bg-slate-800 border border-blue-500/30 rounded-sm p-2.5 text-slate-200 text-sm font-black"
                      />
                    </div>
                  </div>

                  {req.key === "custom" && (
                    <div className="grid grid-cols-2 gap-2 mb-4 p-3 bg-slate-950/40 rounded-sm border border-white/5 animate-in slide-in-from-top-2">
                      <div>
                        <label className="text-[9px] text-slate-500 uppercase font-black mb-1 block">
                          Lower Limit (MHz)
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          value={req.customMin}
                          onChange={(e) =>
                            handleUpdateRequest(
                              Number(req.id),
                              "customMin",
                              e.target.value,
                            )
                          }
                          className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs font-mono text-cyan-400 font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-500 uppercase font-black mb-1 block">
                          Upper Limit (MHz)
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          value={req.customMax}
                          onChange={(e) =>
                            handleUpdateRequest(
                              Number(req.id),
                              "customMax",
                              e.target.value,
                            )
                          }
                          className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs font-mono text-cyan-400 font-bold"
                        />
                      </div>
                    </div>
                  )}

                  <div className="border-t border-white/5 pt-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3">
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={req.useManualParams}
                          onChange={(e) =>
                            handleUpdateRequest(
                              Number(req.id),
                              "useManualParams",
                              e.target.checked,
                            )
                          }
                          className="w-4 h-4 rounded accent-amber-500"
                        />
                        <span
                          className={`text-[10px] font-black uppercase tracking-widest ${req.useManualParams ? "text-amber-400" : "text-slate-500 group-hover:text-slate-400"}`}
                        >
                          Bespoke IMD Spacing For This Group
                        </span>
                      </label>
                      {!req.useManualParams && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500 uppercase font-black">
                            Profile Mode:
                          </span>
                          <select
                            value={req.compatibilityLevel}
                            onChange={(e) =>
                              handleUpdateRequest(
                                Number(req.id),
                                "compatibilityLevel",
                                e.target.value as CompatibilityLevel,
                              )
                            }
                            className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-[9px] text-indigo-300 font-black uppercase"
                          >
                            {Object.entries(COMPATIBILITY_PROFILES).map(
                              ([key, value]) => (
                                <option key={key} value={key}>
                                  {value.label}
                                </option>
                              ),
                            )}
                          </select>
                        </div>
                      )}
                    </div>

                    {req.useManualParams ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 animate-in fade-in slide-in-from-top-1">
                        <div className="flex flex-col">
                          <label className="text-[8px] text-slate-500 uppercase font-black mb-1 text-center">
                            F-F Guard
                          </label>
                          <input
                            type="number"
                            step="0.001"
                            value={req.manualFundamental}
                            onChange={(e) =>
                              handleUpdateRequest(
                                Number(req.id),
                                "manualFundamental",
                                e.target.value,
                              )
                            }
                            className="bg-slate-950 border border-amber-500/30 rounded p-2 text-xs font-mono text-amber-400 text-center font-bold"
                          />
                        </div>
                        <div className="flex flex-col">
                          <label className="text-[8px] text-slate-500 uppercase font-black mb-1 text-center">
                            2-Tone Guard
                          </label>
                          <input
                            type="number"
                            step="0.001"
                            value={req.manualTwoTone}
                            onChange={(e) =>
                              handleUpdateRequest(
                                Number(req.id),
                                "manualTwoTone",
                                e.target.value,
                              )
                            }
                            className="bg-slate-950 border border-amber-500/30 rounded p-2 text-xs font-mono text-amber-400 text-center font-bold"
                          />
                        </div>
                        <div className="flex flex-col">
                          <label className="text-[8px] text-slate-500 uppercase font-black mb-1 text-center">
                            3-Tone Guard
                          </label>
                          <input
                            type="number"
                            step="0.001"
                            value={req.manualThreeTone}
                            onChange={(e) =>
                              handleUpdateRequest(
                                Number(req.id),
                                "manualThreeTone",
                                e.target.value,
                              )
                            }
                            className="bg-slate-950 border border-amber-500/30 rounded p-2 text-xs font-mono text-amber-400 text-center font-bold"
                          />
                        </div>
                        <div className="flex flex-col">
                          <label className="text-[8px] text-slate-500 uppercase font-black mb-1 text-center">
                            5-Tone
                          </label>
                          <input
                            type="number"
                            step="0.001"
                            value={req.manualFiveTone}
                            onChange={(e) =>
                              handleUpdateRequest(
                                Number(req.id),
                                "manualFiveTone",
                                e.target.value,
                              )
                            }
                            className="bg-slate-950 border border-amber-500/30 rounded p-2 text-xs font-mono text-amber-400 text-center font-bold"
                          />
                        </div>
                        <div className="flex flex-col">
                          <label className="text-[8px] text-slate-500 uppercase font-black mb-1 text-center font-mono opacity-50">
                            7-Tone
                          </label>
                          <input
                            type="number"
                            step="0.001"
                            value={req.manualSevenTone}
                            onChange={(e) =>
                              handleUpdateRequest(
                                Number(req.id),
                                "manualSevenTone",
                                e.target.value,
                              )
                            }
                            className="bg-slate-950 border border-amber-500/30 rounded p-2 text-xs font-mono text-amber-400 text-center font-bold"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-3 opacity-80">
                        {(() => {
                          const th = getFinalThresholds(
                            {
                              equipmentKey: req.key,
                              compatibilityLevel: req.compatibilityLevel,
                            },
                            fullEquipmentDatabase,
                            equipmentOverrides,
                          );
                          return (
                            <>
                              <div className="flex flex-col">
                                <label className="text-[8px] text-slate-400 uppercase font-black mb-1 text-center">
                                  F-F
                                </label>
                                <div className="bg-slate-950 border border-white/10 rounded p-2 text-xs font-mono text-indigo-300 text-center font-bold">
                                  {th.fundamental.toFixed(3)}
                                </div>
                              </div>
                              <div className="flex flex-col">
                                <label className="text-[8px] text-slate-400 uppercase font-black mb-1 text-center">
                                  2-Tone
                                </label>
                                <div className="bg-slate-950 border border-white/10 rounded p-2 text-xs font-mono text-indigo-300 text-center font-bold">
                                  {th.twoTone.toFixed(3)}
                                </div>
                              </div>
                              <div className="flex flex-col">
                                <label className="text-[8px] text-slate-400 uppercase font-black mb-1 text-center">
                                  3-Tone
                                </label>
                                <div className="bg-slate-950 border border-white/10 rounded p-2 text-xs font-mono text-indigo-300 text-center font-bold">
                                  {th.threeTone.toFixed(3)}
                                </div>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
              <button
                onClick={handleAddRequest}
                className={`py-3.5 px-3 rounded-md font-black ${primaryButton} transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2`}
              >
                <span>+</span> Add Mic/IEM Group
              </button>
              <div className="relative group/wmas">
                <button
                  onClick={() => handleAddWmasRequest()}
                  className="w-full py-3.5 px-3 rounded-md font-black bg-gradient-to-r from-cyan-600 via-sky-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white transition-all uppercase tracking-widest text-xs shadow-sm border border-slate-700/50 shadow-cyan-500/20 flex items-center justify-center gap-2"
                >
                  <span>⚡</span> + Add WMAS Carrier
                </button>
                <div className="hidden group-hover/wmas:flex flex-col absolute bottom-full left-0 right-0 mb-2 bg-slate-900/95 backdrop-blur-md border border-cyan-500/40 rounded-md shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-bottom-2 gap-1 text-left">
                  <span className="text-[9px] font-black text-cyan-400 px-2 py-1 uppercase tracking-widest border-b border-cyan-500/20">
                    ⚡ Quick WMAS Carrier Presets
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddWmasRequest("sennheiser-spectera-8mhz");
                    }}
                    className="text-left px-2.5 py-1.5 rounded-sm text-[11px] font-bold text-slate-200 hover:bg-cyan-600/30 hover:text-cyan-300 transition-colors flex items-center justify-between"
                  >
                    <span>Sennheiser Spectera (8 MHz)</span>
                    <span className="text-[9px] font-mono text-cyan-400">470-694 MHz</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddWmasRequest("sennheiser-spectera-6mhz");
                    }}
                    className="text-left px-2.5 py-1.5 rounded-sm text-[11px] font-bold text-slate-200 hover:bg-cyan-600/30 hover:text-cyan-300 transition-colors flex items-center justify-between"
                  >
                    <span>Sennheiser Spectera (6 MHz)</span>
                    <span className="text-[9px] font-mono text-cyan-400">470-608 MHz</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddWmasRequest("shure-ad-wmas-800khz-g56");
                    }}
                    className="text-left px-2.5 py-1.5 rounded-sm text-[11px] font-bold text-slate-200 hover:bg-cyan-600/30 hover:text-cyan-300 transition-colors flex items-center justify-between"
                  >
                    <span>Shure AD WMAS (800 kHz Sub-Band)</span>
                    <span className="text-[9px] font-mono text-cyan-400">G56 (470-636)</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddWmasRequest("shure-ad-wmas-1600khz-g56");
                    }}
                    className="text-left px-2.5 py-1.5 rounded-sm text-[11px] font-bold text-slate-200 hover:bg-cyan-600/30 hover:text-cyan-300 transition-colors flex items-center justify-between"
                  >
                    <span>Shure AD WMAS (1.6 MHz Dual Sub-Band)</span>
                    <span className="text-[9px] font-mono text-cyan-400">G56 (470-636)</span>
                  </button>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* RIGHT COLUMN: RESULTS & SITE PARAMS */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <Card className="flex-grow !hover:translate-y-0 !hover:shadow-sm border border-slate-700/50 overflow-visible order-1 lg:order-none">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6 border-b border-white/5 pb-3">
              <CardTitle className="!mb-0 text-base font-medium font-black flex items-center gap-2">
                <span>📊</span> Plan Yield
              </CardTitle>
              {generatedFrequencies && (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleLockAll}
                    className="text-[9px] font-black tracking-widest px-3 py-1.5 rounded-sm border-2 border-amber-500/50 bg-amber-500/10 text-amber-400 hover:bg-amber-600 hover:text-white transition-all"
                  >
                    LOCK ALL
                  </button>
                  <button
                    onClick={handleUnlockAll}
                    className="text-[9px] font-black tracking-widest px-3 py-1.5 rounded-sm border-2 border-slate-500/50 bg-slate-500/10 text-slate-400 hover:bg-slate-600 hover:text-white transition-all"
                  >
                    UNLOCK ALL
                  </button>
                  <button
                    onClick={() => setGeneratorFrequencies(null)}
                    className="text-[9px] font-black tracking-widest px-3 py-1.5 rounded-sm border-2 border-red-500/50 bg-red-500/10 text-red-400 hover:bg-red-600 hover:text-white transition-all"
                  >
                    CLEAR ALL
                  </button>
                  <div className="relative">
                    <button
                      onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                      className="text-[9px] font-black tracking-widest px-3 py-1.5 rounded-sm border-2 border-cyan-500/50 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-600 hover:text-white transition-all"
                    >
                      EXPORT
                    </button>
                    {isExportMenuOpen && (
                      <div className="absolute top-full right-0 mt-2 bg-slate-800 border border-slate-700 rounded-md shadow-2xl z-[110] overflow-hidden min-w-[180px] animate-in slide-in-from-top-2">
                        <button
                          onClick={() => handleExport("pdf")}
                          className="w-full text-left p-3 hover:bg-indigo-600 text-[10px] font-black text-white uppercase border-b border-white/5"
                        >
                          PDF Plan
                        </button>
                        <button
                          onClick={() => setIsPreviewModalOpen(true)}
                          className="w-full text-left p-3 hover:bg-indigo-600 text-[10px] font-black text-white uppercase border-b border-white/5"
                        >
                          Company PDF Report
                        </button>
                        <button
                          onClick={() => handleExport("wwb")}
                          className="w-full text-left p-3 hover:bg-indigo-600 text-[10px] font-black text-white uppercase border-b border-white/5"
                        >
                          WWB Smart Export (.TXT)
                        </button>
                        <button
                          onClick={() => handleExport("csv")}
                          className="w-full text-left p-3 hover:bg-indigo-600 text-[10px] font-black text-white uppercase"
                        >
                          CSV Data
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {isLoading ? (
              <div className="space-y-4 py-8">
                <div className="text-center text-[10px] text-slate-500 font-black uppercase animate-pulse tracking-widest">
                  Processing Unified Interactions...{" "}
                  {Math.round(progress * 100)}%
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden shadow-inner">
                  <div
                    className="h-full bg-gradient-to-r from-blue-400 to-cyan-500 transition-all duration-300"
                    style={{ width: `${progress * 100}%` }}
                  ></div>
                </div>
              </div>
            ) : resultsCategorized.manual.length > 0 ||
              Object.entries(resultsCategorized.allocations).length > 0 ? (
              <div className="space-y-6 max-h-[50vh] overflow-y-auto pr-3 custom-scrollbar">
                {/* SITE ENVIRONMENT SECTION */}
                {resultsCategorized.manual.length > 0 && (
                  <div className="bg-rose-500/5 p-2 rounded-md border border-rose-500/20">
                    <h4 className="text-[10px] font-black text-rose-400 tracking-widest uppercase mb-3 border-b border-rose-500/20 pb-2">
                      Protected Site Environment
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {resultsCategorized.manual.map((f) => (
                        <div
                          key={f.id}
                          className="bg-black/30 p-2 rounded-sm tabular-nums text-[11px] text-rose-300 font-bold border border-rose-500/10 flex justify-between items-center group/freq"
                        >
                          <ManualFreqInput
                            value={f.value}
                            onChange={(val) =>
                              handleFrequencyValueChange(f.id, val)
                            }
                            className="bg-transparent border-none text-rose-300 font-mono font-bold w-16 outline-none p-0"
                          />
                          <div className="flex items-center gap-1.5 pb-0.5">
                            <span className="text-[8px] opacity-40 uppercase">
                              {f.label || "Site"}
                            </span>
                            <button
                              onClick={() => handleRemoveFrequency(f.id)}
                              className="text-[10px] text-rose-400 opacity-20 group-hover/freq:opacity-100 hover:text-rose-300 transition-all font-bold"
                              title="Clear frequency"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ALLOCATIONS SECTION */}
                {(
                  Object.entries(resultsCategorized.allocations) as [
                    string,
                    Frequency[],
                  ][]
                ).map(([reqId, freqs]) => {
                  const req = requests.find((r) => String(r.id) === reqId);
                  const hardwareProfile = req?.key
                    ? fullEquipmentDatabase[req.key]
                    : null;
                  const isWmasGroup =
                    req?.type === "wmas" || hardwareProfile?.type === "wmas";
                  let defaultGroupName = "New Group";
                  if (hardwareProfile) {
                    defaultGroupName =
                      `${hardwareProfile.name} ${hardwareProfile.band ? `(${hardwareProfile.band})` : ""} ${req?.type || ""}`.trim();
                  }
                  return (
                    <div
                      key={reqId}
                      className={`p-2 rounded-md border ${
                        isWmasGroup
                          ? "bg-cyan-950/20 border-cyan-500/30"
                          : "bg-indigo-500/5 border-indigo-500/20"
                      }`}
                    >
                      <h4
                        className={`text-[10px] font-black tracking-widest uppercase mb-3 border-b pb-2 flex justify-between items-center ${
                          isWmasGroup
                            ? "text-cyan-400 border-cyan-500/20"
                            : "text-indigo-400 border-indigo-500/20"
                        }`}
                      >
                        <span className="truncate pr-2 flex items-center gap-1.5">
                          {isWmasGroup && <span>⚡</span>}
                          {req?.label || defaultGroupName}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() =>
                              handleExportGroupWwb(
                                req?.label || defaultGroupName,
                                freqs,
                              )
                            }
                            className={`text-[9px] px-2 py-0.5 rounded transition-all font-bold flex items-center gap-1 ${
                              isWmasGroup
                                ? "bg-cyan-600/40 hover:bg-cyan-500 text-cyan-200 hover:text-white border border-cyan-500/30"
                                : "bg-indigo-600/40 hover:bg-indigo-500 text-indigo-200 hover:text-white border border-indigo-500/30"
                            }`}
                            title="Export this group as a Wireless Workbench .txt file"
                          >
                            <span>📥</span> WWB .txt
                          </button>
                          <span className="text-slate-500 font-mono lowercase">
                            {freqs.length} {isWmasGroup ? "CARRIER" : "CH"}
                          </span>
                        </div>
                      </h4>
                      <div
                        className={
                          isWmasGroup ? "space-y-2" : "grid grid-cols-2 gap-2"
                        }
                      >
                        {freqs.map((f) => {
                          const prof =
                            fullEquipmentDatabase[f.equipmentKey || "custom"];
                          const is800k =
                            req?.key?.includes("800khz") ||
                            prof?.name?.toLowerCase().includes("800 khz") ||
                            prof?.name?.toLowerCase().includes("800khz");
                          const is1600k =
                            req?.key?.includes("1600khz") ||
                            prof?.name?.toLowerCase().includes("1.6 mhz") ||
                            prof?.name?.toLowerCase().includes("1600khz");
                          const is6m =
                            req?.key?.includes("6mhz") ||
                            prof?.name?.toLowerCase().includes("6 mhz");
                          const bw = is800k
                            ? 0.8
                            : is1600k
                              ? 1.6
                              : is6m
                                ? 6.0
                                : 8.0;
                          const start = (f.value - bw / 2).toFixed(3);
                          const end = (f.value + bw / 2).toFixed(3);

                          return (
                            <div
                              key={f.id}
                              className={`p-2.5 rounded-sm tabular-nums text-[11px] font-black border flex justify-between items-center group/freq ${
                                isWmasGroup
                                  ? "bg-cyan-950/40 text-cyan-300 border-cyan-500/20"
                                  : "bg-black/30 text-cyan-300 border-cyan-500/10"
                              }`}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                                <div className="flex items-center gap-1">
                                  <span className="text-[9px] text-slate-500 uppercase font-mono">
                                    CF:
                                  </span>
                                  <ManualFreqInput
                                    value={f.value}
                                    onChange={(val) =>
                                      handleFrequencyValueChange(f.id, val)
                                    }
                                    className="bg-transparent border-none text-cyan-300 font-mono font-black w-20 outline-none p-0"
                                  />
                                </div>
                                {isWmasGroup && (
                                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
                                    <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[9px] font-bold border border-cyan-500/30">
                                      {bw >= 1
                                        ? `${bw.toFixed(1)} MHz`
                                        : `${Math.round(bw * 1000)} kHz`}
                                    </span>
                                    <span>
                                      [{start} - {end} MHz]
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleLockToggle(f.id)}
                                  className={`text-[10px] transition-all ${
                                    f.locked
                                      ? "text-amber-500"
                                      : "text-slate-700 opacity-20 group-hover/freq:opacity-100"
                                  }`}
                                  title={
                                    f.locked
                                      ? "Unlock and recalculate"
                                      : "Lock frequency"
                                  }
                                >
                                  {f.locked ? "🔒" : "🔓"}
                                </button>
                                <button
                                  onClick={() => handleRemoveFrequency(f.id)}
                                  className="text-[10px] text-red-400/80 hover:text-red-300 font-bold opacity-20 group-hover/freq:opacity-100 transition-all"
                                  title="Clear frequency"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Placeholder
                title="Engine Ready"
                message="Configure site constraints and batch groups then click 'CALCULATE UNIFIED PLAN'."
              />
            )}
          </Card>

          {/* WMAS SPECTRUM PROTECTION & ACTIVE EXCLUSIONS CARD */}
          <Card className="order-2 lg:order-none border border-cyan-500/30 bg-gradient-to-b from-slate-900 to-cyan-950/20">
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3 mb-4">
              <CardTitle className="!mb-0 flex items-center gap-2 text-cyan-300 text-sm font-black uppercase tracking-wider">
                <span>⚡</span> WMAS Spectrum Protection
                <InfoTooltip content="Active WMAS wideband systems act as protected wideband exclusion zones. Narrowband mics and IEMs will be coordinated around these continuous carrier blocks without interference." />
              </CardTitle>
              <label className="flex items-center gap-2 cursor-pointer bg-cyan-950/60 border border-cyan-500/30 px-2.5 py-1 rounded-sm">
                <span className="text-[10px] font-black uppercase text-cyan-300">
                  Guarded
                </span>
                <input
                  type="checkbox"
                  checked={enableWmasExclusions}
                  onChange={(e) => setEnableWmasExclusions(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-cyan-400 cursor-pointer"
                />
              </label>
            </div>

            <div className="space-y-4">
              {/* Active WMAS Nodes from System */}
              {wmasState && wmasState.nodes && wmasState.nodes.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    <span>Festival / System WMAS Nodes</span>
                    <span className="text-cyan-400 font-mono">
                      {wmasState.nodes.filter((n) => !disabledWmasNodeIds[n.id]).length} Active
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                    {wmasState.nodes.map((node) => {
                      if (!node) return null;
                      const isGuarded =
                        enableWmasExclusions && !disabledWmasNodeIds[node.id];
                      const startNum = node.assignedBlock ? Number(node.assignedBlock.start) : NaN;
                      const endNum = node.assignedBlock ? Number(node.assignedBlock.end) : NaN;
                      const hasValidBlock = node.assignedBlock && !isNaN(startNum) && !isNaN(endNum);
                      const bw = hasValidBlock
                        ? (endNum - startNum).toFixed(1)
                        : "8.0";

                      return (
                        <div
                          key={node.id}
                          className={`p-2.5 rounded-sm border flex items-center justify-between text-xs transition-all ${
                            isGuarded
                              ? "bg-cyan-950/40 border-cyan-500/30 text-cyan-200"
                              : "bg-slate-950/30 border-white/5 text-slate-500 opacity-60"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={!disabledWmasNodeIds[node.id]}
                              onChange={() =>
                                handleToggleWmasNodeExclusion(node.id)
                              }
                              className="w-3.5 h-3.5 rounded accent-cyan-400 cursor-pointer"
                              title={
                                isGuarded
                                  ? "Guarded exclusion block"
                                  : "Click to enable protection"
                              }
                            />
                            <div>
                              <div className="font-bold text-[11px] flex items-center gap-1.5">
                                <span>{node.name || `WMAS Node ${node.id}`}</span>
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-mono font-normal">
                                  {bw} MHz
                                </span>
                              </div>
                              {hasValidBlock ? (
                                <p className="text-[10px] font-mono text-slate-400">
                                  {startNum.toFixed(3)} -{" "}
                                  {endNum.toFixed(3)} MHz
                                </p>
                              ) : (
                                <p className="text-[10px] text-amber-400/80 italic">
                                  Unassigned spectrum
                                </p>
                              )}
                            </div>
                          </div>
                          <span
                            className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                              isGuarded
                                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                                : "bg-slate-800 text-slate-500"
                            }`}
                          >
                            {isGuarded ? "Guarded" : "Bypassed"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-slate-950/30 rounded-sm border border-white/5 text-center text-slate-500 text-xs">
                  No active WMAS system nodes configured.
                </div>
              )}

              {/* Custom Local WMAS Exclusion Blocks */}
              {customWmasExclusions.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-cyan-500/10">
                  <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    <span>Custom WMAS Guard Blocks</span>
                    <span className="text-cyan-400 font-mono">
                      {customWmasExclusions.filter((b) => b.enabled).length} Active
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
                    {customWmasExclusions.map((cw) => (
                      <div
                        key={cw.id}
                        className={`p-2 rounded-sm border flex items-center justify-between text-xs ${
                          cw.enabled && enableWmasExclusions
                            ? "bg-indigo-950/40 border-indigo-500/30 text-indigo-200"
                            : "bg-slate-950/30 border-white/5 text-slate-500 opacity-60"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={cw.enabled}
                            onChange={() =>
                              handleToggleCustomWmasExclusion(cw.id)
                            }
                            className="w-3.5 h-3.5 rounded accent-indigo-400 cursor-pointer"
                          />
                          <div>
                            <div className="font-bold text-[11px]">{cw.name}</div>
                            <p className="text-[10px] font-mono text-slate-400">
                              {cw.start.toFixed(3)} - {cw.end.toFixed(3)} MHz (
                              {cw.bandwidth >= 1
                                ? `${cw.bandwidth} MHz`
                                : `${Math.round(cw.bandwidth * 1000)} kHz`}
                              )
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveCustomWmasExclusion(cw.id)}
                          className="text-rose-400 hover:text-rose-300 text-xs px-1.5 py-0.5 rounded hover:bg-rose-500/20"
                          title="Remove custom block"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add Custom WMAS Guard Block Toggle / Form */}
              {isAddCustomWmasOpen ? (
                <div className="p-3 bg-slate-950/70 rounded-md border border-cyan-500/30 space-y-3 animate-in fade-in">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-cyan-300 tracking-wider">
                      Add WMAS Carrier Exclusion Block
                    </span>
                    <button
                      onClick={() => setIsAddCustomWmasOpen(false)}
                      className="text-slate-400 hover:text-white text-xs font-bold"
                    >
                      ✕
                    </button>
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-400 uppercase font-black mb-1 block">
                      Block Bandwidth Span
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { label: "8 MHz", val: 8 },
                        { label: "6 MHz", val: 6 },
                        { label: "1.6 MHz", val: 1.6 },
                        { label: "800 kHz", val: 0.8 },
                      ].map((preset) => (
                        <button
                          key={preset.val}
                          type="button"
                          onClick={() => setNewWmasBw(preset.val)}
                          className={`py-1.5 px-2 rounded-sm text-[10px] font-black border transition-all ${
                            newWmasBw === preset.val
                              ? "bg-cyan-500 text-slate-900 border-cyan-400"
                              : "bg-slate-900 text-slate-300 border-white/10 hover:border-cyan-500/40"
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] text-slate-400 uppercase font-black mb-1 block">
                        Center Frequency (MHz)
                      </label>
                      <input
                        type="number"
                        step="0.025"
                        value={newWmasCenter}
                        onChange={(e) => setNewWmasCenter(e.target.value)}
                        placeholder="474.000"
                        className="w-full bg-slate-900 border border-slate-700 rounded-sm p-2 text-cyan-300 text-xs font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-slate-400 uppercase font-black mb-1 block">
                        Label / Identifier
                      </label>
                      <input
                        type="text"
                        value={newWmasName}
                        onChange={(e) => setNewWmasName(e.target.value)}
                        placeholder="e.g. Stage B Spectera"
                        className="w-full bg-slate-900 border border-slate-700 rounded-sm p-2 text-slate-200 text-xs"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleAddCustomWmasExclusion}
                    className="w-full py-2 bg-gradient-to-r from-cyan-500 to-indigo-600 text-slate-950 font-black rounded-sm text-xs uppercase tracking-wider hover:opacity-95"
                  >
                    Protect WMAS Block
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsAddCustomWmasOpen(true)}
                    className="flex-1 py-2 px-3 rounded-sm bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-500/30 text-cyan-300 text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
                  >
                    <span>+</span> Add Custom WMAS Block
                  </button>
                  <button
                    onClick={handleImportWmasToExclusionsText}
                    className="py-2 px-3 rounded-sm bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-300 hover:text-white text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1"
                    title="Export all active WMAS ranges as comma-separated text into the Custom Exclusions box"
                  >
                    <span>📋</span> Sync to Text
                  </button>
                </div>
              )}
            </div>
          </Card>

          <Card className="order-3 lg:order-none">
            <CardTitle className="flex items-center">
              ⚙️ Site Parameters
              <InfoTooltip content="Define global constraints that apply to the entire coordination plan." />
            </CardTitle>
            <div className="space-y-6">
              <div>
                <label className="text-[10px] text-slate-500 uppercase font-black mb-1 flex items-center">
                  Manual Exclusions (MHz)
                  <InfoTooltip content="Specify frequency ranges to avoid during coordination. Format: start-end, start-end (e.g., 500-505, 606.5-608). You can also Shift+Drag directly on the Spectrum canvas." />
                </label>
                <input
                  value={exclusions}
                  onChange={(e) => setExclusions(e.target.value)}
                  placeholder="e.g. 500-505, 606.5-608"
                  className="w-full bg-slate-950 border border-slate-700 p-2 rounded text-xs font-mono text-slate-300 outline-none focus:border-indigo-500"
                />

                {parsedExclusionsList.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {parsedExclusionsList.map((zone, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-1 bg-rose-500/10 border border-rose-500/20 rounded-full px-2 py-0.5 text-[9px] font-black text-rose-400"
                      >
                        <span>
                          {zone.min.toFixed(3)}-{zone.max.toFixed(3)}
                        </span>
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
                      onClick={() => setExclusions("")}
                      className="text-[8px] text-slate-500 hover:text-rose-400 uppercase font-black tracking-widest transition-colors"
                    >
                      Clear All
                    </button>
                  </div>
                )}
              </div>

              <div className="p-2 bg-slate-900/50 rounded-md border border-slate-700">
                <TvGrid
                  tvRegion={tvRegion}
                  setTvRegion={setTvRegion}
                  tvChannelStates={tvChannelStates}
                  setTvChannelStates={setTvChannelStates}
                  tvChannelErpData={undefined}
                  handleTvChannelCycle={handleTvChannelCycle}
                  handleBlockAllTvChannels={handleBlockAllTvChannels}
                  handleClearTv={clearTv}
                />
              </div>
            </div>
          </Card>
        </div>
      </div>{" "}
      {/* End grid */}
      <SpectrumVisualizer
        frequencies={[...manualConstraints, ...(generatedFrequencies || [])]}
        scanData={scanData || null}
        title="Generated Spectral Visualization"
        wmasState={wmasState}
        onFrequencyChange={(id, value) => handleFrequencyValueChange(id, value)}
        onExclusionZoneAdd={handleExclusionZoneAdd}
        onExclusionZoneRemove={handleExclusionZoneRemove}
        onExclusionsClear={() => setExclusions("")}
        exclusionsText={exclusions}
        onExclusionsTextChange={setExclusions}
        exclusionZones={parsedExclusionsList}
        tvRegion={tvRegion}
      />
      <PdfPreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        generatePdf={generatePdfForPreview}
        filename={`site_rf_plan_${new Date().toISOString().slice(0, 10)}`}
      />
      <motion.button
        drag
        dragMomentum={false}
        onClick={() => { if (!isLoading) handleGenerate(); }}
        disabled={isLoading}
        className={`fixed bottom-12 right-12 z-[1000] cursor-grab active:cursor-grabbing shadow-2xl flex items-center justify-center gap-3 py-3 px-4 rounded-md font-black uppercase tracking-widest transition-colors border-b-4 ring-2 text-sm ${isLoading ? 'bg-slate-800 text-slate-500 border-slate-900 ring-slate-800/50 shadow-none' : 'bg-yellow-500 text-slate-900 border-yellow-700 hover:bg-yellow-400 ring-yellow-400/50 shadow-yellow-500/20'}`}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {isLoading ? (
          <><span className="w-3.5 h-3.5 border-4 border-slate-500/20 border-t-slate-500 rounded-full animate-spin"></span>SEEKING...</>
        ) : (
          <><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> GENERATE</>
        )}
      </motion.button>
    </div>
  );
};

export default React.memo(GeneratorTab);
