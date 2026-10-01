import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Platform,
  PanResponder
} from 'react-native';
import Svg, { Line, Rect, Text as SvgText, G, Circle, Path, Polygon } from 'react-native-svg';

export interface SpectrumCarrier {
  freq: number;
  label: string;
  type: 'BASE_TX' | 'PORT_TX' | 'IFB' | 'WALKIE';
  isKeyed?: boolean;
  isGhost?: boolean;
  hasClash?: boolean;
  powerDbm?: number;
  zoneName?: string;
  zoneId: string;
  locked?: boolean;
}

export interface SpectrumImd {
  freq: number;
  type: '2-Tone' | '3-Tone';
  color: string;
  desc?: string;
  powerDbm?: number;
  hasClash?: boolean;
  clashDesc?: string;
}

export interface TacticalSpectrumAnalyzerProps {
  centerFreq: number;
  span: number;
  onCenterChange?: (mhz: number) => void;
  onCenterFreqChange?: (mhz: number) => void;
  onSpanChange: (spanMhz: number) => void;
  carriers: SpectrumCarrier[];
  imds: SpectrumImd[];
  activeZoneName: string;
  activeZoneId?: string;
}

export interface TacticalSpectrumAnalyzerState {
  centerFreq: number;
  span: number;
  activeZoneName: string;
  activeZoneId: string;
  carriers: SpectrumCarrier[];
  imds: SpectrumImd[];
  canvasWidth: number;
  setCanvasWidth: (w: number) => void;
  CANVAS_HEIGHT: number;
  TOP_MARGIN: number;
  BOTTOM_MARGIN: number;
  PLOT_HEIGHT: number;
  NOISE_FLOOR_DBM: number;
  REF_LEVEL_DBM: number;
  traceMode: 'LIVE' | 'MAX_HOLD' | 'AVG';
  setTraceMode: React.Dispatch<React.SetStateAction<'LIVE' | 'MAX_HOLD' | 'AVG'>>;
  rbwKhz: number;
  setRbwKhz: React.Dispatch<React.SetStateAction<number>>;
  marker1Freq: number | null;
  marker2Freq: number | null;
  marker1DbmState: number;
  marker2DbmState: number;
  activeMarker: 1 | 2;
  maxHoldPeaks: { freq: number; dbm: number }[];
  setMaxHoldPeaks: React.Dispatch<React.SetStateAction<{ freq: number; dbm: number }[]>>;
  deltaMode: boolean;
  setDeltaMode: React.Dispatch<React.SetStateAction<boolean>>;
  deltaStep: 1 | 2;
  setDeltaStep: React.Dispatch<React.SetStateAction<1 | 2>>;
  centerText: string;
  setCenterText: React.Dispatch<React.SetStateAction<string>>;
  centerStep: number;
  setCenterStep: React.Dispatch<React.SetStateAction<number>>;
  centerStepText: string;
  setCenterStepText: React.Dispatch<React.SetStateAction<string>>;
  spanText: string;
  setSpanText: React.Dispatch<React.SetStateAction<string>>;
  spanStep: number;
  setSpanStep: React.Dispatch<React.SetStateAction<number>>;
  spanStepText: string;
  setSpanStepText: React.Dispatch<React.SetStateAction<string>>;
  startFreq: number;
  stopFreq: number;
  freqToX: (f: number) => number;
  xToFreq: (x: number) => number;
  dbmToY: (dbm: number) => number;
  panResponder: any;
  handleCenterChange: (mhz: number) => void;
  handleCenterStep: (dir: -1 | 1) => void;
  handleCenterInputCommit: () => void;
  handleCenterStepDelta: (dir: -1 | 1) => void;
  handleCenterStepCommit: () => void;
  handleSpanStep: (dir: -1 | 1) => void;
  handleSpanInputCommit: () => void;
  handleSpanStepDelta: (dir: -1 | 1) => void;
  handleSpanStepCommit: () => void;
  handleZoom: (dir: 'IN' | 'OUT') => void;
  handlePan: (dir: -1 | 1) => void;
  marker1Dbm: number;
  marker2Dbm: number | null;
  deltaInfo: any;
  deltaKhz: number | null;
  gridFreqs: number[];
  dbmLevels: number[];
  onSpanChange: (spanMhz: number) => void;
}

export function useTacticalSpectrumAnalyzer({
  centerFreq,
  span,
  onCenterChange,
  onCenterFreqChange,
  onSpanChange,
  carriers,
  imds,
  activeZoneName,
  activeZoneId = 'default'
}: TacticalSpectrumAnalyzerProps): TacticalSpectrumAnalyzerState {
  const handleCenterChange = (mhz: number) => {
    if (onCenterChange) onCenterChange(mhz);
    if (onCenterFreqChange) onCenterFreqChange(mhz);
  };

  const [canvasWidth, setCanvasWidth] = useState<number>(330);
  const CANVAS_HEIGHT = 175;
  const TOP_MARGIN = 20;
  const BOTTOM_MARGIN = 24;
  const PLOT_HEIGHT = CANVAS_HEIGHT - TOP_MARGIN - BOTTOM_MARGIN;
  const NOISE_FLOOR_DBM = -100;
  const REF_LEVEL_DBM = 0;

  // Analyzer States
  const [traceMode, setTraceMode] = useState<'LIVE' | 'MAX_HOLD' | 'AVG'>('LIVE');
  const [rbwKhz, setRbwKhz] = useState<number>(12.5);
  const [marker1Freq, setMarker1Freq] = useState<number | null>(null);
  const [marker2Freq, setMarker2Freq] = useState<number | null>(null);
  const [marker1DbmState, setMarker1DbmState] = useState<number>(-95);
  const [marker2DbmState, setMarker2DbmState] = useState<number>(-95);
  const [activeMarker, setActiveMarker] = useState<1 | 2>(1);
  const [maxHoldPeaks, setMaxHoldPeaks] = useState<{ freq: number; dbm: number }[]>([]);

  // Delta 2-Tap state machine
  const [deltaMode, setDeltaMode] = useState<boolean>(false);
  const [deltaStep, setDeltaStep] = useState<1 | 2>(1);

  // Center Frequency & Span Editable State
  const [centerText, setCenterText] = useState<string>(centerFreq.toFixed(5));
  const [centerStep, setCenterStep] = useState<number>(0.100);
  const [centerStepText, setCenterStepText] = useState<string>('0.100');

  const [spanText, setSpanText] = useState<string>(span.toFixed(2));
  const [spanStep, setSpanStep] = useState<number>(2.0);
  const [spanStepText, setSpanStepText] = useState<string>('2.0');

  // Synchronize when external props update
  useEffect(() => {
    setCenterText(centerFreq.toFixed(5));
  }, [centerFreq]);

  useEffect(() => {
    setSpanText(span.toFixed(2));
  }, [span]);

  const startFreq = centerFreq - span / 2;
  const stopFreq = centerFreq + span / 2;

  // Coordinate conversion
  const freqToX = (f: number) => {
    return ((f - startFreq) / span) * canvasWidth;
  };

  const xToFreq = (x: number) => {
    return startFreq + (x / canvasWidth) * span;
  };

  const dbmToY = (dbm: number) => {
    const clamped = Math.max(NOISE_FLOOR_DBM, Math.min(REF_LEVEL_DBM, dbm));
    const ratio = (clamped - NOISE_FLOOR_DBM) / (REF_LEVEL_DBM - NOISE_FLOOR_DBM);
    return TOP_MARGIN + PLOT_HEIGHT * (1 - ratio);
  };

  // Initial Marker Setup
  useEffect(() => {
    if (marker1Freq === null && carriers.length > 0) {
      setMarker1Freq(carriers[0].freq);
    }
  }, [carriers]);

  // Update Max Hold peaks
  useEffect(() => {
    if (traceMode === 'MAX_HOLD') {
      const activeCarriers = carriers.map((c) => ({
        freq: c.freq,
        dbm: c.powerDbm ?? -15
      }));
      const activeImdPeaks = imds.map((im) => ({
        freq: im.freq,
        dbm: im.type === '2-Tone' ? -55 : -65
      }));
      const allCurrent = [...activeCarriers, ...activeImdPeaks];

      setMaxHoldPeaks((prev) => {
        const merged = [...prev];
        allCurrent.forEach((curr) => {
          const idx = merged.findIndex((p) => Math.abs(p.freq - curr.freq) < 0.005);
          if (idx >= 0) {
            merged[idx].dbm = Math.max(merged[idx].dbm, curr.dbm);
          } else {
            merged.push(curr);
          }
        });
        return merged;
      });
    }
  }, [carriers, imds, traceMode]);

  // Keep mutable ref to avoid stale closures in PanResponder
  const deltaStateRef = useRef({
    deltaMode,
    deltaStep,
    marker1Freq,
    marker2Freq,
    startFreq,
    span,
    canvasWidth
  });

  useEffect(() => {
    deltaStateRef.current = {
      deltaMode,
      deltaStep,
      marker1Freq,
      marker2Freq,
      startFreq,
      span,
      canvasWidth
    };
  }, [deltaMode, deltaStep, marker1Freq, marker2Freq, startFreq, span, canvasWidth]);

  // Touch / Tap / Pan interaction on spectrum screen
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const tapX = evt.nativeEvent.locationX;
        const tapY = evt.nativeEvent.locationY;
        const { deltaMode: isDelta, deltaStep: step, startFreq: curStart, span: curSpan, canvasWidth: width } = deltaStateRef.current;
        const tappedFreq = Math.round((curStart + (tapX / width) * curSpan) * 100000) / 100000;
        
        const clampedY = Math.max(TOP_MARGIN, Math.min(TOP_MARGIN + PLOT_HEIGHT, tapY));
        const yRatio = 1 - (clampedY - TOP_MARGIN) / PLOT_HEIGHT;
        const tappedDbm = Math.round(NOISE_FLOOR_DBM + yRatio * (REF_LEVEL_DBM - NOISE_FLOOR_DBM));

        if (isDelta) {
          if (step === 1) {
            setMarker1Freq(tappedFreq);
            setMarker1DbmState(tappedDbm);
            setMarker2Freq(null);
            setDeltaStep(2);
            setActiveMarker(2);
          } else {
            setMarker2Freq(tappedFreq);
            setMarker2DbmState(tappedDbm);
            setDeltaStep(1);
            setActiveMarker(2);
          }
        } else {
          if (activeMarker === 1) {
            setMarker1Freq(tappedFreq);
            setMarker1DbmState(tappedDbm);
          } else {
            setMarker2Freq(tappedFreq);
            setMarker2DbmState(tappedDbm);
          }
        }
      },
      onPanResponderMove: (evt) => {
        const { deltaMode: isDelta, startFreq: curStart, span: curSpan, canvasWidth: width } = deltaStateRef.current;
        if (isDelta) return;
        const tapX = evt.nativeEvent.locationX;
        const tapY = evt.nativeEvent.locationY;
        const tappedFreq = Math.round((curStart + (tapX / width) * curSpan) * 100000) / 100000;
        const clampedY = Math.max(TOP_MARGIN, Math.min(TOP_MARGIN + PLOT_HEIGHT, tapY));
        const yRatio = 1 - (clampedY - TOP_MARGIN) / PLOT_HEIGHT;
        const tappedDbm = Math.round(NOISE_FLOOR_DBM + yRatio * (REF_LEVEL_DBM - NOISE_FLOOR_DBM));

        if (activeMarker === 1) {
          setMarker1Freq(tappedFreq);
          setMarker1DbmState(tappedDbm);
        } else {
          setMarker2Freq(tappedFreq);
          setMarker2DbmState(tappedDbm);
        }
      }
    })
  ).current;

  // Center Frequency Actions
  const handleCenterStep = (dir: -1 | 1) => {
    const cur = parseFloat(centerText) || centerFreq;
    const effStep = centerStep > 0 ? centerStep : 0.100;
    const nextVal = Math.max(10, Math.min(1500, Math.round((cur + dir * effStep) * 100000) / 100000));
    setCenterText(nextVal.toFixed(5));
    handleCenterChange(nextVal);
  };

  const handleCenterInputCommit = () => {
    const parsed = parseFloat(centerText);
    if (!isNaN(parsed) && parsed >= 10 && parsed <= 1500) {
      setCenterText(parsed.toFixed(5));
      handleCenterChange(parsed);
    } else {
      setCenterText(centerFreq.toFixed(5));
    }
  };

  const handleCenterStepDelta = (dir: -1 | 1) => {
    const standardSteps = [0.00625, 0.0125, 0.025, 0.050, 0.100, 0.250, 0.500, 1.000, 2.000, 5.000];
    const current = centerStep;
    let nextStep = current;
    if (dir > 0) {
      const found = standardSteps.find((s) => s > current + 0.0001);
      nextStep = found !== undefined ? found : current * 2;
    } else {
      const reversed = [...standardSteps].reverse();
      const found = reversed.find((s) => s < current - 0.0001);
      nextStep = found !== undefined ? found : Math.max(0.001, current / 2);
    }
    nextStep = Math.round(nextStep * 100000) / 100000;
    setCenterStep(nextStep);
    setCenterStepText(nextStep >= 1 ? nextStep.toFixed(1) : nextStep.toString());
  };

  const handleCenterStepCommit = () => {
    const parsed = parseFloat(centerStepText);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 50) {
      setCenterStep(parsed);
      setCenterStepText(parsed.toString());
    } else {
      setCenterStepText(centerStep.toString());
    }
  };

  // Span Actions
  const handleSpanStep = (dir: -1 | 1) => {
    const cur = parseFloat(spanText) || span;
    const effStep = spanStep > 0 ? spanStep : 2.0;
    const nextVal = Math.max(0.1, Math.min(250, Math.round((cur + dir * effStep) * 100) / 100));
    setSpanText(nextVal.toFixed(2));
    onSpanChange(nextVal);
  };

  const handleSpanInputCommit = () => {
    const parsed = parseFloat(spanText);
    if (!isNaN(parsed) && parsed >= 0.1 && parsed <= 250) {
      setSpanText(parsed.toFixed(2));
      onSpanChange(parsed);
    } else {
      setSpanText(span.toFixed(2));
    }
  };

  const handleSpanStepDelta = (dir: -1 | 1) => {
    const standardSteps = [0.25, 0.5, 1.0, 2.0, 5.0, 10.0, 20.0];
    const current = spanStep;
    let nextStep = current;
    if (dir > 0) {
      const found = standardSteps.find((s) => s > current + 0.01);
      nextStep = found !== undefined ? found : current + 2.0;
    } else {
      const reversed = [...standardSteps].reverse();
      const found = reversed.find((s) => s < current - 0.01);
      nextStep = found !== undefined ? found : Math.max(0.1, current - 0.5);
    }
    nextStep = Math.round(nextStep * 100) / 100;
    setSpanStep(nextStep);
    setSpanStepText(nextStep.toString());
  };

  const handleSpanStepCommit = () => {
    const parsed = parseFloat(spanStepText);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 100) {
      setSpanStep(parsed);
      setSpanStepText(parsed.toString());
    } else {
      setSpanStepText(spanStep.toString());
    }
  };

  // Zoom In / Zoom Out
  const handleZoom = (dir: 'IN' | 'OUT') => {
    const cur = span;
    let nextSpan: number;
    if (dir === 'IN') {
      nextSpan = Math.max(0.1, Math.round((cur * 0.5) * 100) / 100);
    } else {
      nextSpan = Math.min(250, Math.round((cur * 2.0) * 100) / 100);
    }
    setSpanText(nextSpan.toFixed(2));
    onSpanChange(nextSpan);
  };

  // Pan Left / Right
  const handlePan = (dir: -1 | 1) => {
    const shift = Math.max(0.025, Math.round((span * 0.25) * 100000) / 100000);
    const nextVal = Math.round((centerFreq + dir * shift) * 100000) / 100000;
    setCenterText(nextVal.toFixed(5));
    handleCenterChange(nextVal);
  };

  // Delta calculation between Marker 1 and Marker 2
  const marker1Dbm = useMemo(() => {
    if (!marker1Freq) return -100;
    const nearestCarrier = carriers.find((c) => Math.abs(c.freq - marker1Freq) < 0.015);
    if (nearestCarrier) return nearestCarrier.powerDbm ?? -15;
    const nearestImd = imds.find((im) => Math.abs(im.freq - marker1Freq) < 0.015);
    if (nearestImd) return nearestImd.type === '2-Tone' ? -55 : -65;
    return -95;
  }, [marker1Freq, carriers, imds]);

  const marker2Dbm = useMemo(() => {
    if (!marker2Freq) return null;
    const nearestCarrier = carriers.find((c) => Math.abs(c.freq - marker2Freq) < 0.015);
    if (nearestCarrier) return nearestCarrier.powerDbm ?? -15;
    const nearestImd = imds.find((im) => Math.abs(im.freq - marker2Freq) < 0.015);
    if (nearestImd) return nearestImd.type === '2-Tone' ? -55 : -65;
    return -95;
  }, [marker2Freq, carriers, imds]);

  // Delta frequency & formatted distance string (kHz or MHz)
  const deltaInfo = useMemo(() => {
    if (marker1Freq === null || marker2Freq === null) return null;
    const diffMhz = marker2Freq - marker1Freq;
    const absDiffMhz = Math.abs(diffMhz);
    const diffKhz = Math.round(diffMhz * 1000000) / 1000;
    const absDiffKhz = Math.abs(diffKhz);

    let displayFormatted = '';
    if (absDiffKhz >= 1000) {
      displayFormatted = `${diffMhz >= 0 ? '+' : ''}${diffMhz.toFixed(5)} MHz (${diffKhz >= 0 ? '+' : ''}${diffKhz.toFixed(1)} kHz)`;
    } else {
      displayFormatted = `${diffKhz >= 0 ? '+' : ''}${diffKhz.toFixed(1)} kHz`;
    }

    return {
      diffKhz,
      diffMhz,
      absDiffKhz,
      absDiffMhz,
      displayFormatted
    };
  }, [marker1Freq, marker2Freq]);

  const deltaKhz = deltaInfo ? deltaInfo.diffKhz : null;

  // Generate Frequency Grid Ticks (8 subdivisions)
  const gridFreqs = useMemo(() => {
    const list: number[] = [];
    const step = span / 8;
    for (let i = 0; i <= 8; i++) {
      list.push(startFreq + i * step);
    }
    return list;
  }, [startFreq, span]);

  const dbmLevels = [0, -20, -40, -60, -80, -100];

  return {
    centerFreq,
    span,
    activeZoneName,
    activeZoneId,
    carriers,
    imds,
    canvasWidth,
    setCanvasWidth,
    CANVAS_HEIGHT,
    TOP_MARGIN,
    BOTTOM_MARGIN,
    PLOT_HEIGHT,
    NOISE_FLOOR_DBM,
    REF_LEVEL_DBM,
    traceMode,
    setTraceMode,
    rbwKhz,
    setRbwKhz,
    marker1Freq,
    marker2Freq,
    marker1DbmState,
    marker2DbmState,
    activeMarker,
    maxHoldPeaks,
    setMaxHoldPeaks,
    deltaMode,
    setDeltaMode,
    deltaStep,
    setDeltaStep,
    centerText,
    setCenterText,
    centerStep,
    setCenterStep,
    centerStepText,
    setCenterStepText,
    spanText,
    setSpanText,
    spanStep,
    setSpanStep,
    spanStepText,
    setSpanStepText,
    startFreq,
    stopFreq,
    freqToX,
    xToFreq,
    dbmToY,
    panResponder,
    handleCenterChange,
    handleCenterStep,
    handleCenterInputCommit,
    handleCenterStepDelta,
    handleCenterStepCommit,
    handleSpanStep,
    handleSpanInputCommit,
    handleSpanStepDelta,
    handleSpanStepCommit,
    handleZoom,
    handlePan,
    marker1Dbm,
    marker2Dbm,
    deltaInfo,
    deltaKhz,
    gridFreqs,
    dbmLevels,
    onSpanChange
  };
}

/**
 * TacticalSpectrumAnalyzerScope:
 * The sticky/frozen part of the tactical spectrum analyzer:
 * 1. Readout header bar (with "BW" instead of "RBW")
 * 2. CRT Screen Bezel + SVG spectrum canvas
 * 3. Quick RF Band Presets (Dual Band, Base TX, Portable TX)
 * 4. Zoom & Pan Hardware Bar (◄ PAN LEFT, 🔍 ZOOM IN (+), 🔍 ZOOM OUT (-), PAN RIGHT ►)
 */
export const TacticalSpectrumAnalyzerScope: React.FC<{ state: TacticalSpectrumAnalyzerState }> = ({ state }) => {
  const {
    activeZoneName,
    rbwKhz,
    traceMode,
    marker1Freq,
    marker2Freq,
    marker1Dbm,
    marker1DbmState,
    marker2Dbm,
    marker2DbmState,
    deltaMode,
    deltaInfo,
    panResponder,
    setCanvasWidth,
    canvasWidth,
    CANVAS_HEIGHT,
    dbmLevels,
    dbmToY,
    gridFreqs,
    freqToX,
    TOP_MARGIN,
    PLOT_HEIGHT,
    maxHoldPeaks,
    carriers,
    span,
    imds,
    centerFreq,
    setCenterText,
    handleCenterChange,
    setSpanText,
    onSpanChange,
    handlePan,
    handleZoom
  } = state;

  return (
    <View style={analyzerStyles.scopeWrapper}>
      {/* Top Readout Header Bar */}
      <View style={analyzerStyles.hudTopBar}>
        <View style={analyzerStyles.hudLeft}>
          <Text style={analyzerStyles.hudScopeTitle}>TACTICAL SPECTRUM ANALYZER</Text>
          <Text style={analyzerStyles.hudScopeSub}>
            ZONE: {activeZoneName.toUpperCase()} | BW: {rbwKhz} kHz | {traceMode}
          </Text>
        </View>

        {/* Digital Marker HUD Readout */}
        <View style={analyzerStyles.markerHudBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={analyzerStyles.markerBadgeM1}>
              M1: {marker1Freq ? `${marker1Freq.toFixed(5)} MHz` : '---'}
            </Text>
          </View>
          {deltaMode && marker1Freq !== null && marker2Freq === null && (
            <Text style={analyzerStyles.markerBadgeDeltaPrompt}>
              👆 TAP SCREEN FOR POINT 2 (M2)
            </Text>
          )}
          {marker1Freq !== null && marker2Freq !== null && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={analyzerStyles.markerBadgeM2}>
                Δ DISTANCE: {deltaInfo ? deltaInfo.displayFormatted : '---'}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Hardware Bezel & Phosphor Screen */}
      <View
        style={analyzerStyles.screenBezel}
        {...panResponder.panHandlers}
        onLayout={(e) => setCanvasWidth(Math.max(280, e.nativeEvent.layout.width))}
      >
        <Svg width="100%" height={CANVAS_HEIGHT}>
          {/* Deep phosphor CRT black background */}
          <Rect x="0" y="0" width="100%" height={CANVAS_HEIGHT} fill="#020813" />

          {/* 10x10 Calibrated Graticule Grid */}
          {dbmLevels.map((dbm) => {
            const y = dbmToY(dbm);
            return (
              <G key={`dbm_${dbm}`}>
                <Line
                  x1="0"
                  y1={y}
                  x2={canvasWidth}
                  y2={y}
                  stroke={dbm === 0 ? '#1e3a5f' : '#0d2238'}
                  strokeWidth="1"
                  strokeDasharray={dbm === 0 || dbm === -100 ? 'none' : '2, 4'}
                />
                <SvgText
                  x={canvasWidth - 4}
                  y={y - 2}
                  fill="#1e4e6e"
                  fontSize="7.5"
                  fontFamily={Platform.OS === 'ios' ? 'Courier' : 'monospace'}
                  textAnchor="end"
                >
                  {dbm} dBm
                </SvgText>
              </G>
            );
          })}

          {/* Vertical Frequency Grid */}
          {gridFreqs.map((f, i) => {
            const x = freqToX(f);
            return (
              <G key={`fgrid_${i}`}>
                <Line
                  x1={x}
                  y1={TOP_MARGIN}
                  x2={x}
                  y2={TOP_MARGIN + PLOT_HEIGHT}
                  stroke="#0d2238"
                  strokeWidth="1"
                  strokeDasharray="2, 4"
                />
                {i % 2 === 0 && (
                  <SvgText
                    x={x}
                    y={CANVAS_HEIGHT - 6}
                    fill="#3b6e8c"
                    fontSize="7.5"
                    fontFamily={Platform.OS === 'ios' ? 'Courier' : 'monospace'}
                    textAnchor="middle"
                  >
                    {f.toFixed(3)}
                  </SvgText>
                )}
              </G>
            );
          })}

          {/* Center Frequency Marker Line */}
          <Line
            x1={canvasWidth / 2}
            y1={TOP_MARGIN}
            x2={canvasWidth / 2}
            y2={TOP_MARGIN + PLOT_HEIGHT}
            stroke="#1d4ed8"
            strokeWidth="1"
            strokeDasharray="4, 4"
            opacity="0.6"
          />

          {/* Max Hold Ghost Traces */}
          {traceMode === 'MAX_HOLD' &&
            maxHoldPeaks.map((peak, idx) => {
              const x = freqToX(peak.freq);
              const topY = dbmToY(peak.dbm);
              if (x < 0 || x > canvasWidth) return null;
              return (
                <G key={`maxhold_${idx}`}>
                  <Line
                    x1={x}
                    y1={topY}
                    x2={x}
                    y2={TOP_MARGIN + PLOT_HEIGHT}
                    stroke="#f97316"
                    strokeWidth="1.5"
                    opacity="0.5"
                  />
                  <Circle cx={x} cy={topY} r={2.5} fill="#ea580c" opacity="0.8" />
                </G>
              );
            })}

          {/* Active Carriers & Standby Ghosts */}
          {carriers.map((car, idx) => {
            const x = freqToX(car.freq);
            if (x < -20 || x > canvasWidth + 20) return null;
            const isGhost = !!car.isGhost;
            const isKeyed = !!car.isKeyed;
            const dbm = car.powerDbm ?? (isGhost ? -52 : (car.type === 'BASE_TX' ? -10 : -18));
            const peakY = dbmToY(dbm);
            const isRx = car.type === 'PORT_TX';

            const hitImd = imds.find(imd => Math.abs(imd.freq - car.freq) <= 0.005);
            const hasClash = !!(car.hasClash || hitImd);

            const halfBwPx = ((rbwKhz / 1000) / span) * canvasWidth;

            let strokeColor = '#facc15';
            if (isRx) strokeColor = isKeyed ? '#22c55e' : (isGhost ? '#38bdf8' : '#38bdf8');
            if (car.type === 'IFB') strokeColor = '#06b6d4';
            if (car.type === 'WALKIE') strokeColor = isKeyed ? '#22c55e' : (isGhost ? '#fb923c' : '#fb923c');
            if (car.locked) strokeColor = '#4ade80';
            if (hasClash) strokeColor = '#ef4444';

            const leftX = x - Math.max(4, halfBwPx);
            const rightX = x + Math.max(4, halfBwPx);
            const baseY = TOP_MARGIN + PLOT_HEIGHT;

            const pathData = `M ${leftX - 6} ${baseY} Q ${leftX} ${baseY} ${x - 2} ${peakY + 2} L ${x} ${peakY} L ${x + 2} ${peakY + 2} Q ${rightX} ${baseY} ${rightX + 6} ${baseY} Z`;

            if (isGhost) {
              return (
                <G key={`car_ghost_${idx}`}>
                  <Path
                    d={pathData}
                    fill={hasClash ? 'rgba(239, 68, 68, 0.75)' : 'rgba(56, 189, 248, 0.04)'}
                    stroke={strokeColor}
                    strokeWidth={hasClash ? '2.5' : '1.2'}
                    strokeDasharray={hasClash ? 'none' : '3, 3'}
                  />
                  <Circle
                    cx={x}
                    cy={peakY}
                    r={hasClash ? 3.5 : 2.5}
                    fill={hasClash ? '#ef4444' : 'none'}
                    stroke={strokeColor}
                    strokeWidth="1.5"
                  />
                  <SvgText
                    x={x}
                    y={peakY - 5}
                    fill={hasClash ? '#ef4444' : strokeColor}
                    fontSize="7.5"
                    fontWeight={hasClash ? '900' : 'bold'}
                    fontFamily={Platform.OS === 'ios' ? 'Courier' : 'monospace'}
                    textAnchor="middle"
                    opacity="0.95"
                  >
                    {hasClash ? '[! CLASH] ' : ' '}
                    {car.label}
                  </SvgText>
                </G>
              );
            }

            return (
              <G key={`car_active_${idx}`}>
                <Path
                  d={pathData}
                  fill={
                    hasClash
                      ? 'rgba(239, 68, 68, 0.85)'
                      : (isKeyed
                          ? 'rgba(34, 197, 94, 0.35)'
                          : (car.type === 'BASE_TX'
                              ? 'rgba(250, 204, 21, 0.28)'
                              : 'rgba(56, 189, 248, 0.2)'))
                  }
                  stroke={strokeColor}
                  strokeWidth={hasClash ? '3' : (isKeyed ? '2.2' : '1.8')}
                />
                <Circle
                  cx={x}
                  cy={peakY}
                  r={hasClash ? 4.5 : (isKeyed ? 3.5 : 2.5)}
                  fill={strokeColor}
                />
                <SvgText
                  x={x}
                  y={peakY - 6}
                  fill={hasClash ? '#ffffff' : strokeColor}
                  stroke={hasClash ? '#991b1b' : 'none'}
                  strokeWidth={hasClash ? '0.6' : '0'}
                  fontSize="8"
                  fontWeight="900"
                  fontFamily={Platform.OS === 'ios' ? 'Courier' : 'monospace'}
                  textAnchor="middle"
                >
                  {hasClash ? '[! CLASH] ' : (isKeyed ? ' ' : '')}
                  {car.label}
                </SvgText>
              </G>
            );
          })}

          {/* Intermodulation Products (2-Tone & 3-Tone) */}
          {imds.map((imd, i) => {
            const x = freqToX(imd.freq);
            if (x < -10 || x > canvasWidth + 10) return null;
            const dbm = imd.type === '2-Tone' ? -48 : -58;
            const topY = dbmToY(dbm);
            const is2Tone = imd.type === '2-Tone';
            
            const hitsCarrier = imd.hasClash || carriers.some(c => Math.abs(c.freq - imd.freq) <= 0.005);
            const color = hitsCarrier ? '#ef4444' : (is2Tone ? '#f43f5e' : '#c084fc');
            const arrowLabel = is2Tone ? '2TX 3RD' : '3TX 3RD';

            return (
              <G key={`imd_${i}`}>
                <Line
                  x1={x}
                  y1={topY}
                  x2={x}
                  y2={TOP_MARGIN + PLOT_HEIGHT}
                  stroke={color}
                  strokeWidth={hitsCarrier ? '2.5' : '1.8'}
                  strokeDasharray={is2Tone ? 'none' : '3, 2'}
                />
                <Polygon
                  points={`${x - 4.5},${topY + 8} ${x + 4.5},${topY + 8} ${x},${topY}`}
                  fill={color}
                  stroke="#ffffff"
                  strokeWidth="1.2"
                />
                <SvgText
                  x={x}
                  y={topY - 4}
                  fill="#ffffff"
                  stroke="#000000"
                  strokeWidth="0.6"
                  fontSize="8"
                  fontWeight="900"
                  fontFamily={Platform.OS === 'ios' ? 'Courier' : 'monospace'}
                  textAnchor="middle"
                >
                  {hitsCarrier ? `[!] ${arrowLabel}` : arrowLabel}
                </SvgText>
              </G>
            );
          })}

          {/* Delta Distance Span Line & Callout */}
          {marker1Freq !== null && marker2Freq !== null && (() => {
            const x1 = freqToX(marker1Freq);
            const x2 = freqToX(marker2Freq);
            const midX = (x1 + x2) / 2;
            const lineY = TOP_MARGIN + 18;

            return (
              <G key="delta_span_line">
                <Line
                  x1={x1}
                  y1={lineY}
                  x2={x2}
                  y2={lineY}
                  stroke="#38bdf8"
                  strokeWidth="2"
                  strokeDasharray="4, 3"
                />
                <Line
                  x1={x1}
                  y1={lineY - 6}
                  x2={x1}
                  y2={lineY + 6}
                  stroke="#ef4444"
                  strokeWidth="2"
                />
                <Line
                  x1={x2}
                  y1={lineY - 6}
                  x2={x2}
                  y2={lineY + 6}
                  stroke="#10b981"
                  strokeWidth="2"
                />
                <Rect
                  x={Math.max(6, Math.min(canvasWidth - 90, midX - 44))}
                  y={lineY - 14}
                  width={88}
                  height={13}
                  rx={3}
                  fill="#031525"
                  stroke="#38bdf8"
                  strokeWidth="1"
                />
                <SvgText
                  x={Math.max(6, Math.min(canvasWidth - 90, midX - 44)) + 44}
                  y={lineY - 4.5}
                  fill="#38bdf8"
                  fontSize="7.5"
                  fontWeight="bold"
                  fontFamily={Platform.OS === 'ios' ? 'Courier' : 'monospace'}
                  textAnchor="middle"
                >
                  Δ {deltaInfo ? (deltaInfo.absDiffKhz >= 1000 ? `${deltaInfo.absDiffMhz.toFixed(3)} MHz` : `${deltaInfo.absDiffKhz.toFixed(1)} kHz`) : ''}
                </SvgText>
              </G>
            );
          })()}

          {/* Marker 1 Reticle Point */}
          {marker1Freq !== null && (
            (() => {
              const mx = freqToX(marker1Freq);
              const my = dbmToY(marker1DbmState !== -95 ? marker1DbmState : marker1Dbm);
              if (mx >= 0 && mx <= canvasWidth) {
                return (
                  <G key="marker1">
                    <Line
                      x1={mx}
                      y1={TOP_MARGIN}
                      x2={mx}
                      y2={TOP_MARGIN + PLOT_HEIGHT}
                      stroke="#ef4444"
                      strokeWidth="1.2"
                      strokeDasharray="3, 3"
                    />
                    <Polygon
                      points={`${mx},${my - 7} ${mx + 7},${my} ${mx},${my + 7} ${mx - 7},${my}`}
                      fill="#ef4444"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                    <Circle cx={mx} cy={my} r={2} fill="#ffffff" />
                    <SvgText
                      x={mx}
                      y={Math.max(TOP_MARGIN + 10, my - 9)}
                      fill="#fca5a5"
                      fontSize="8"
                      fontWeight="bold"
                      fontFamily={Platform.OS === 'ios' ? 'Courier' : 'monospace'}
                      textAnchor="middle"
                    >
                      ● PT 1 (M1)
                    </SvgText>
                  </G>
                );
              }
              return null;
            })()
          )}

          {/* Marker 2 Reticle Point */}
          {marker2Freq !== null && (
            (() => {
              const mx = freqToX(marker2Freq);
              const my = dbmToY(marker2DbmState !== -95 ? marker2DbmState : (marker2Dbm ?? -70));
              if (mx >= 0 && mx <= canvasWidth) {
                return (
                  <G key="marker2">
                    <Line
                      x1={mx}
                      y1={TOP_MARGIN}
                      x2={mx}
                      y2={TOP_MARGIN + PLOT_HEIGHT}
                      stroke="#10b981"
                      strokeWidth="1.2"
                      strokeDasharray="3, 3"
                    />
                    <Polygon
                      points={`${mx},${my - 7} ${mx + 7},${my} ${mx},${my + 7} ${mx - 7},${my}`}
                      fill="#10b981"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                    <Circle cx={mx} cy={my} r={2} fill="#ffffff" />
                    <SvgText
                      x={mx}
                      y={Math.max(TOP_MARGIN + 10, my - 9)}
                      fill="#86efac"
                      fontSize="8"
                      fontWeight="bold"
                      fontFamily={Platform.OS === 'ios' ? 'Courier' : 'monospace'}
                      textAnchor="middle"
                    >
                      ● PT 2 (M2)
                    </SvgText>
                  </G>
                );
              }
              return null;
            })()
          )}
        </Svg>
      </View>

      {/* ================= QUICK RF BAND PRESETS (FROZEN WITH SCOPE) ================= */}
      {(() => {
        // Clustering helper: groups frequencies within 0.45 MHz of each other into distinct bands
        const getClusters = (freqList: number[], fallbackCenters: number[]) => {
          const valid = [...new Set(freqList.filter(f => f && f > 0))].sort((a, b) => b - a); // Largest first
          if (valid.length === 0) {
            return fallbackCenters
              .sort((a, b) => b - a)
              .map(center => ({
                center: Number(center.toFixed(5)),
                span: 3.50,
                min: center - 0.5,
                max: center + 0.5,
                nominalBand: Math.round(center)
              }));
          }
          const clusters: { freqs: number[]; min: number; max: number }[] = [];
          for (const f of valid) {
            // Group frequencies belonging to the same channel allocation (within 0.45 MHz)
            const match = clusters.find(c => (c.min - f) <= 0.45 && (f - c.max) <= 0.45);
            if (match) {
              match.freqs.push(f);
              match.min = Math.min(match.min, f);
              match.max = Math.max(match.max, f);
            } else {
              clusters.push({ freqs: [f], min: f, max: f });
            }
          }
          return clusters
            .map(c => {
              const center = Number(((c.min + c.max) / 2).toFixed(5));
              const spread = c.max - c.min;
              const span = Math.max(3.20, Math.min(8.0, Number((spread + 1.2).toFixed(2))));
              return { center, span, min: c.min, max: c.max, nominalBand: Math.round(center) };
            })
            .sort((a, b) => b.center - a.center); // Largest frequency band first
        };

        // 1. Base TX Clusters (sorted descending: 457 MHz first, then 455 MHz, 450 MHz, etc.)
        const baseFreqs = carriers
          .filter(c => c.type === 'BASE_TX' || c.type === 'IFB' || (!c.type && String(c.label || '').toUpperCase().includes('TX')))
          .map(c => c.freq)
          .filter(f => f > 0);

        const baseClusters = getClusters(baseFreqs, [457.36250, 455.21250]);

        // 2. Portable TX Clusters (sorted descending: 468 MHz first, then 467 MHz, etc.)
        const portFreqs = carriers
          .filter(c => c.type === 'PORT_TX' || c.type === 'WALKIE' || (!c.type && (String(c.label || '').toUpperCase().includes('PRT') || String(c.label || '').toUpperCase().includes('PORT'))))
          .map(c => c.freq)
          .filter(f => f > 0);

        const portClusters = getClusters(portFreqs, [468.25000, 467.41250]);

        // 3. Dual Band span calculation
        const allFreqs = carriers.map(c => c.freq).filter(f => f > 0);
        const hasCarriers = allFreqs.length >= 2;
        const minAll = hasCarriers ? Math.min(...allFreqs) : 455.0;
        const maxAll = hasCarriers ? Math.max(...allFreqs) : 468.5;
        const dualCenter = Number(((minAll + maxAll) / 2).toFixed(5));
        const dualSpan = Math.max(18.0, Math.min(32.0, Number(((maxAll - minAll) + 3.0).toFixed(2))));

        // Active state detection
        const activeBaseCluster = baseClusters.find(c => Math.abs(centerFreq - c.center) < 1.0 && span < 9.0);
        const isBaseActive = !!activeBaseCluster;
        const activePortCluster = portClusters.find(c => Math.abs(centerFreq - c.center) < 1.0 && span < 9.0);
        const isPortActive = !!activePortCluster;
        const isDualActive = span >= 14 && centerFreq >= minAll - 3 && centerFreq <= maxAll + 3;

        // Toggle handlers: snap to largest first, toggle between bands on subsequent clicks
        const handleBaseClick = () => {
          if (baseClusters.length === 0) return;
          const curIdx = baseClusters.findIndex(c => Math.abs(centerFreq - c.center) < 1.0 && span < 9.0);
          const nextIdx = curIdx >= 0 ? (curIdx + 1) % baseClusters.length : 0;
          const target = baseClusters[nextIdx];
          setCenterText(target.center.toFixed(5));
          handleCenterChange(target.center);
          setSpanText(target.span.toFixed(2));
          onSpanChange(target.span);
        };

        const handlePortClick = () => {
          if (portClusters.length === 0) return;
          const curIdx = portClusters.findIndex(c => Math.abs(centerFreq - c.center) < 1.0 && span < 9.0);
          const nextIdx = curIdx >= 0 ? (curIdx + 1) % portClusters.length : 0;
          const target = portClusters[nextIdx];
          setCenterText(target.center.toFixed(5));
          handleCenterChange(target.center);
          setSpanText(target.span.toFixed(2));
          onSpanChange(target.span);
        };

        const handleDualClick = () => {
          setCenterText(dualCenter.toFixed(5));
          handleCenterChange(dualCenter);
          setSpanText(dualSpan.toFixed(2));
          onSpanChange(dualSpan);
        };

        return (
          <View style={analyzerStyles.quickBandRow}>
            <TouchableOpacity
              activeOpacity={0.7}
              style={[
                analyzerStyles.quickBandBtn,
                isDualActive && analyzerStyles.quickBandBtnActive
              ]}
              onPress={handleDualClick}
            >
              <Text style={analyzerStyles.quickBandBtnText}>Dual Band</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              style={[
                analyzerStyles.quickBandBtn,
                isBaseActive && analyzerStyles.quickBandBtnActive
              ]}
              onPress={handleBaseClick}
            >
              <Text style={analyzerStyles.quickBandBtnText}>
                {isBaseActive && activeBaseCluster && baseClusters.length > 1
                  ? `Base TX (${activeBaseCluster.nominalBand})`
                  : 'Base TX'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              style={[
                analyzerStyles.quickBandBtn,
                isPortActive && analyzerStyles.quickBandBtnActive
              ]}
              onPress={handlePortClick}
            >
              <Text style={analyzerStyles.quickBandBtnText}>
                {isPortActive && activePortCluster && portClusters.length > 1
                  ? `Portable TX (${activePortCluster.nominalBand})`
                  : 'Portable TX'}
              </Text>
            </TouchableOpacity>
          </View>
        );
      })()}

      {/* ================= ZOOM & PAN HARDWARE BAR (FROZEN WITH SCOPE) ================= */}
      <View style={analyzerStyles.zoomPanRow}>
        <TouchableOpacity
          activeOpacity={0.7}
          style={analyzerStyles.zoomBtn}
          onPress={() => handlePan(-1)}
        >
          <Text style={analyzerStyles.zoomBtnText}>◄ PAN LEFT</Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.7}
          style={[analyzerStyles.zoomBtn, { backgroundColor: '#1e293b', borderColor: '#38bdf8' }]}
          onPress={() => handleZoom('IN')}
        >
          <Text style={[analyzerStyles.zoomBtnText, { color: '#38bdf8' }]}>🔍 ZOOM IN (+)</Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.7}
          style={[analyzerStyles.zoomBtn, { backgroundColor: '#1e293b', borderColor: '#38bdf8' }]}
          onPress={() => handleZoom('OUT')}
        >
          <Text style={[analyzerStyles.zoomBtnText, { color: '#38bdf8' }]}>🔍 ZOOM OUT (-)</Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.7}
          style={analyzerStyles.zoomBtn}
          onPress={() => handlePan(1)}
        >
          <Text style={analyzerStyles.zoomBtnText}>PAN RIGHT ►</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

/**
 * TacticalSpectrumAnalyzerControls:
 * The scrollable part of the tactical spectrum analyzer:
 * 1. Center Frequency & Step Size group
 * 2. Span & Span Step group
 * 3. Softkey Controls: Delta, Trace, and BW (with "BW" instead of "RBW")
 * These scroll underneath the frozen scope along with the rest of the page.
 */
export const TacticalSpectrumAnalyzerControls: React.FC<{ state: TacticalSpectrumAnalyzerState }> = ({ state }) => {
  const {
    centerText,
    setCenterText,
    handleCenterInputCommit,
    handleCenterStep,
    centerStepText,
    setCenterStepText,
    handleCenterStepCommit,
    handleCenterStepDelta,
    centerStep,
    setCenterStep,
    spanText,
    setSpanText,
    handleSpanInputCommit,
    handleSpanStep,
    spanStepText,
    setSpanStepText,
    handleSpanStepCommit,
    handleSpanStepDelta,
    span,
    onSpanChange,
    deltaMode,
    setDeltaMode,
    setDeltaStep,
    marker1Freq,
    marker2Freq,
    setMarker1Freq,
    setMarker2Freq,
    setActiveMarker,
    deltaStep,
    traceMode,
    setTraceMode,
    setMaxHoldPeaks,
    rbwKhz,
    setRbwKhz
  } = state;

  return (
    <View style={analyzerStyles.controlsContainer}>
      {/* ================= CENTER FREQUENCY & STEP CONTROL GROUP ================= */}
      <View style={analyzerStyles.controlSection}>
        <View style={analyzerStyles.controlSectionHeader}>
          <Text style={analyzerStyles.controlSectionTitle}>CENTER FREQUENCY (MHz)</Text>
          <Text style={analyzerStyles.stepLabel}>STEP SIZE (MHz)</Text>
        </View>

        <View style={analyzerStyles.stepperRow}>
          {/* Center Frequency Box with ◄ and ► arrows */}
          <View style={analyzerStyles.stepperBox}>
            <TouchableOpacity
              activeOpacity={0.6}
              style={analyzerStyles.stepperArrowBtn}
              onPress={() => handleCenterStep(-1)}
            >
              <Text style={analyzerStyles.stepperArrowText}>◄</Text>
            </TouchableOpacity>

            <TextInput
              style={analyzerStyles.stepperInput}
              value={centerText}
              onChangeText={setCenterText}
              onBlur={handleCenterInputCommit}
              onSubmitEditing={handleCenterInputCommit}
              keyboardType="numeric"
              selectTextOnFocus
              returnKeyType="done"
            />

            <TouchableOpacity
              activeOpacity={0.6}
              style={analyzerStyles.stepperArrowBtn}
              onPress={() => handleCenterStep(1)}
            >
              <Text style={analyzerStyles.stepperArrowText}>►</Text>
            </TouchableOpacity>
          </View>

          {/* Center Step Size Box with - and + buttons */}
          <View style={analyzerStyles.stepSizeBox}>
            <TouchableOpacity
              activeOpacity={0.6}
              style={analyzerStyles.stepperArrowBtn}
              onPress={() => handleCenterStepDelta(-1)}
            >
              <Text style={analyzerStyles.stepperArrowText}>-</Text>
            </TouchableOpacity>

            <TextInput
              style={analyzerStyles.stepperInput}
              value={centerStepText}
              onChangeText={setCenterStepText}
              onBlur={handleCenterStepCommit}
              onSubmitEditing={handleCenterStepCommit}
              keyboardType="numeric"
              selectTextOnFocus
              returnKeyType="done"
            />

            <TouchableOpacity
              activeOpacity={0.6}
              style={analyzerStyles.stepperArrowBtn}
              onPress={() => handleCenterStepDelta(1)}
            >
              <Text style={analyzerStyles.stepperArrowText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Step Preset Pills */}
        <View style={analyzerStyles.pillRow}>
          <Text style={analyzerStyles.stepPillLabel}>PRESET STEPS:</Text>
          {[0.0125, 0.025, 0.100, 0.500, 1.000].map((s) => {
            const isSel = Math.abs(centerStep - s) < 0.001;
            const label = s < 0.1 ? `${(s * 1000).toFixed(1)}k` : s < 1 ? `${(s * 1000).toFixed(0)}k` : `${s.toFixed(0)}M`;
            return (
              <TouchableOpacity
                key={`cstep_${s}`}
                style={[analyzerStyles.miniPill, isSel && analyzerStyles.miniPillActive]}
                onPress={() => {
                  setCenterStep(s);
                  setCenterStepText(s.toString());
                }}
              >
                <Text style={[analyzerStyles.miniPillText, isSel && analyzerStyles.miniPillTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ================= SPAN & SPAN STEP CONTROL GROUP ================= */}
      <View style={analyzerStyles.controlSection}>
        <View style={analyzerStyles.controlSectionHeader}>
          <Text style={analyzerStyles.controlSectionTitle}>SPAN (MHz)</Text>
          <Text style={analyzerStyles.stepLabel}>SPAN STEP (MHz)</Text>
        </View>

        <View style={analyzerStyles.stepperRow}>
          {/* Span Box with - and + signs */}
          <View style={analyzerStyles.stepperBox}>
            <TouchableOpacity
              activeOpacity={0.6}
              style={analyzerStyles.stepperArrowBtn}
              onPress={() => handleSpanStep(-1)}
            >
              <Text style={analyzerStyles.stepperArrowText}>-</Text>
            </TouchableOpacity>

            <TextInput
              style={analyzerStyles.stepperInput}
              value={spanText}
              onChangeText={setSpanText}
              onBlur={handleSpanInputCommit}
              onSubmitEditing={handleSpanInputCommit}
              keyboardType="numeric"
              selectTextOnFocus
              returnKeyType="done"
            />

            <TouchableOpacity
              activeOpacity={0.6}
              style={analyzerStyles.stepperArrowBtn}
              onPress={() => handleSpanStep(1)}
            >
              <Text style={analyzerStyles.stepperArrowText}>+</Text>
            </TouchableOpacity>
          </View>

          {/* Span Step Size Box with - and + signs */}
          <View style={analyzerStyles.stepSizeBox}>
            <TouchableOpacity
              activeOpacity={0.6}
              style={analyzerStyles.stepperArrowBtn}
              onPress={() => handleSpanStepDelta(-1)}
            >
              <Text style={analyzerStyles.stepperArrowText}>-</Text>
            </TouchableOpacity>

            <TextInput
              style={analyzerStyles.stepperInput}
              value={spanStepText}
              onChangeText={setSpanStepText}
              onBlur={handleSpanStepCommit}
              onSubmitEditing={handleSpanStepCommit}
              keyboardType="numeric"
              selectTextOnFocus
              returnKeyType="done"
            />

            <TouchableOpacity
              activeOpacity={0.6}
              style={analyzerStyles.stepperArrowBtn}
              onPress={() => handleSpanStepDelta(1)}
            >
              <Text style={analyzerStyles.stepperArrowText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Span Presets */}
        <View style={analyzerStyles.pillRow}>
          <Text style={analyzerStyles.stepPillLabel}>PRESET SPAN:</Text>
          {[
            { label: '0.5M', val: 0.5 },
            { label: '2.0M', val: 2.0 },
            { label: '6.0M', val: 6.0 },
            { label: '18.0M', val: 18.0 },
            { label: 'FULL 24M', val: 24.0 }
          ].map((item) => {
            const isSel = Math.abs(span - item.val) < 0.1;
            return (
              <TouchableOpacity
                key={`span_${item.label}`}
                style={[analyzerStyles.miniPill, isSel && analyzerStyles.miniPillActive]}
                onPress={() => {
                  setSpanText(item.val.toFixed(2));
                  onSpanChange(item.val);
                }}
              >
                <Text style={[analyzerStyles.miniPillText, isSel && analyzerStyles.miniPillTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ================= PHYSICAL-STYLE SOFTKEY CONTROLS ================= */}
      <View style={analyzerStyles.softkeyRow}>
        {/* DELTA 2-TAP MEASURE BUTTON */}
        <TouchableOpacity
          activeOpacity={0.8}
          style={[
            analyzerStyles.softkeyBtn,
            deltaMode && { borderColor: '#38bdf8', backgroundColor: '#0c2238' },
            marker1Freq !== null && marker2Freq !== null && { borderColor: '#10b981', backgroundColor: '#0e231b' }
          ]}
          onPress={() => {
            if (!deltaMode) {
              setDeltaMode(true);
              setDeltaStep(1);
              setMarker1Freq(null);
              setMarker2Freq(null);
            } else {
              setDeltaMode(false);
              setDeltaStep(1);
              setMarker2Freq(null);
              setActiveMarker(1);
            }
          }}
        >
          <Text
            style={[
              analyzerStyles.softkeyBtnTitle,
              deltaMode && { color: '#38bdf8' },
              marker1Freq !== null && marker2Freq !== null && { color: '#4ade80' }
            ]}
          >
            {deltaMode
              ? (marker1Freq !== null && marker2Freq !== null
                  ? 'DELTA: ACTIVE'
                  : `DELTA: TAP ${deltaStep}/2`)
              : 'DELTA (2-TAP)'}
          </Text>
          <Text style={analyzerStyles.softkeyBtnSub}>
            {deltaMode
              ? (marker1Freq === null
                  ? '1. TAP POINT 1'
                  : (marker2Freq === null ? '2. TAP POINT 2' : 'RESET / MEASURE'))
              : 'TAP 2 POINTS'}
          </Text>
        </TouchableOpacity>

        {/* TRACE MODE SELECTOR */}
        <TouchableOpacity
          activeOpacity={0.8}
          style={[analyzerStyles.softkeyBtn, traceMode === 'MAX_HOLD' && { borderColor: '#f97316' }]}
          onPress={() => {
            if (traceMode === 'LIVE') setTraceMode('MAX_HOLD');
            else if (traceMode === 'MAX_HOLD') setTraceMode('AVG');
            else {
              setTraceMode('LIVE');
              setMaxHoldPeaks([]);
            }
          }}
        >
          <Text style={[analyzerStyles.softkeyBtnTitle, traceMode === 'MAX_HOLD' && { color: '#fb923c' }]}>
            TRACE: {traceMode}
          </Text>
          <Text style={analyzerStyles.softkeyBtnSub}>
            {traceMode === 'MAX_HOLD' ? 'GHOST BURSTS' : 'CYCLE MODE'}
          </Text>
        </TouchableOpacity>

        {/* BW FILTER MASK (Formerly RBW) */}
        <TouchableOpacity
          activeOpacity={0.8}
          style={analyzerStyles.softkeyBtn}
          onPress={() => {
            if (rbwKhz === 12.5) setRbwKhz(25);
            else if (rbwKhz === 25) setRbwKhz(6.25);
            else setRbwKhz(12.5);
          }}
        >
          <Text style={analyzerStyles.softkeyBtnTitle}>BW: {rbwKhz}k</Text>
          <Text style={analyzerStyles.softkeyBtnSub}>
            {rbwKhz === 12.5 ? 'STD 12.5k' : rbwKhz === 25 ? 'WIDE 25k' : 'dMR 6.25k'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

/**
 * Standard TacticalSpectrumAnalyzer component:
 * Renders both the scope and controls together (for standalone usage).
 */
export const TacticalSpectrumAnalyzer: React.FC<TacticalSpectrumAnalyzerProps> = (props) => {
  const state = useTacticalSpectrumAnalyzer(props);
  return (
    <View style={analyzerStyles.container}>
      <TacticalSpectrumAnalyzerScope state={state} />
      <TacticalSpectrumAnalyzerControls state={state} />
    </View>
  );
};

export const analyzerStyles = StyleSheet.create({
  container: {
    marginTop: 2
  },
  scopeWrapper: {
    paddingBottom: 2
  },
  controlsContainer: {
    marginTop: 4,
    paddingBottom: 2
  },
  hudTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0a101d',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderWidth: 1,
    borderColor: '#1e293b'
  },
  hudLeft: {
    flex: 1
  },
  hudScopeTitle: {
    color: '#38bdf8',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  hudScopeSub: {
    color: '#64748b',
    fontSize: 7.5,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  markerHudBox: {
    alignItems: 'flex-end'
  },
  markerBadgeM1: {
    color: '#f87171',
    fontSize: 8,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  markerBadgeM2: {
    color: '#4ade80',
    fontSize: 8,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  markerBadgeDeltaPrompt: {
    color: '#38bdf8',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  screenBezel: {
    backgroundColor: '#020617',
    borderWidth: 1.5,
    borderColor: '#1e3a5f',
    overflow: 'hidden'
  },

  // Zoom & Pan hardware bar
  zoomPanRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 3,
    marginBottom: 2
  },
  zoomBtn: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 4,
    paddingVertical: 5,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center'
  },
  zoomBtnText: {
    color: '#cbd5e1',
    fontSize: 7.5,
    fontWeight: '900',
    letterSpacing: 0.4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },

  // Control section
  controlSection: {
    backgroundColor: '#0a101d',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 6,
    padding: 6,
    marginTop: 4
  },
  controlSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  controlSectionTitle: {
    color: '#94a3b8',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.6,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  stepLabel: {
    color: '#64748b',
    fontSize: 7.5,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },

  // Stepper rows
  stepperRow: {
    flexDirection: 'row',
    gap: 6
  },
  stepperBox: {
    flex: 3,
    flexDirection: 'row',
    backgroundColor: '#030712',
    borderWidth: 1,
    borderColor: '#38bdf8',
    borderRadius: 4,
    alignItems: 'center',
    overflow: 'hidden'
  },
  stepSizeBox: {
    flex: 2,
    flexDirection: 'row',
    backgroundColor: '#030712',
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 4,
    alignItems: 'center',
    overflow: 'hidden'
  },
  stepperArrowBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center'
  },
  stepperArrowText: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: 'bold'
  },
  stepperInput: {
    flex: 1,
    color: '#38bdf8',
    fontSize: 10.5,
    fontWeight: '900',
    textAlign: 'center',
    paddingVertical: 2,
    paddingHorizontal: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },

  // Preset pills
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 5
  },
  stepPillLabel: {
    color: '#475569',
    fontSize: 7,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  miniPill: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 3
  },
  miniPillActive: {
    backgroundColor: '#0369a1',
    borderColor: '#38bdf8'
  },
  miniPillText: {
    color: '#94a3b8',
    fontSize: 7.5,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  miniPillTextActive: {
    color: '#ffffff',
    fontWeight: '900'
  },

  // Softkey controls
  softkeyRow: {
    flexDirection: 'row',
    gap: 5,
    marginTop: 4
  },
  softkeyBtn: {
    flex: 1,
    backgroundColor: '#090f1d',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 5,
    paddingVertical: 5,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center'
  },
  softkeyBtnTitle: {
    color: '#cbd5e1',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.3,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  softkeyBtnSub: {
    color: '#64748b',
    fontSize: 6.5,
    fontWeight: 'bold',
    marginTop: 1
  },

  // Quick RF Band Presets
  quickBandRow: {
    flexDirection: 'row',
    gap: 5,
    marginTop: 4,
    marginBottom: 2
  },
  quickBandBtn: {
    flex: 1,
    backgroundColor: '#0c1524',
    borderWidth: 1,
    borderColor: '#1e3a5f',
    borderRadius: 4,
    paddingVertical: 5,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center'
  },
  quickBandBtnActive: {
    backgroundColor: '#0369a1',
    borderColor: '#38bdf8'
  },
  quickBandBtnText: {
    color: '#cbd5e1',
    fontSize: 7.5,
    fontWeight: '900',
    letterSpacing: 0.3,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    textAlign: 'center'
  }
});
