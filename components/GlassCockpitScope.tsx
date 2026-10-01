import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Volume2, VolumeX, Eye, Crosshair, MoveHorizontal, Disc, RefreshCw, Zap, ShieldAlert, Sparkles, ChevronLeft, ChevronRight, Sliders, Play, Pause } from 'lucide-react';

export interface ScopeCarrier {
  freq: number;
  label: string;
  type?: 'BASE_TX' | 'PORT_TX' | 'IFB' | 'WALKIE' | 'MIC' | 'IEM';
  powerDbm?: number;
  zoneName?: string;
  color?: string;
}

interface GlassCockpitScopeProps {
  initialCenterFreq?: number;
  initialSpan?: number;
  carriers?: ScopeCarrier[];
  onCenterChange?: (freq: number) => void;
  onSpanChange?: (span: number) => void;
  className?: string;
  isEmbedded?: boolean;
}

export const GlassCockpitScope: React.FC<GlassCockpitScopeProps> = ({
  initialCenterFreq = 506.0,
  initialSpan = 16.0,
  carriers = [],
  onCenterChange,
  onSpanChange,
  className = '',
  isEmbedded = false
}) => {
  // Center & Span
  const [centerFreq, setCenterFreq] = useState<number>(initialCenterFreq);
  const [span, setSpan] = useState<number>(initialSpan);

  // Sync external center/span if changed externally
  useEffect(() => {
    if (initialCenterFreq && Math.abs(initialCenterFreq - centerFreq) > 0.001) {
      setCenterFreq(initialCenterFreq);
    }
  }, [initialCenterFreq]);

  useEffect(() => {
    if (initialSpan && Math.abs(initialSpan - span) > 0.01) {
      setSpan(initialSpan);
    }
  }, [initialSpan]);

  const updateCenter = useCallback((newCenter: number) => {
    const clamped = Math.max(100, Math.min(1000, Number(newCenter.toFixed(4))));
    setCenterFreq(clamped);
    if (onCenterChange) onCenterChange(clamped);
  }, [onCenterChange]);

  const updateSpan = useCallback((newSpan: number) => {
    const clamped = Math.max(1, Math.min(120, Number(newSpan.toFixed(2))));
    setSpan(clamped);
    if (onSpanChange) onSpanChange(clamped);
  }, [onSpanChange]);

  // Scope Settings
  const [traceMode, setTraceMode] = useState<'PHOSPHOR' | 'LIVE' | 'MAX_HOLD' | 'AVG'>('PHOSPHOR');
  const [stepSizeKhz, setStepSizeKhz] = useState<number>(100); // 25, 100, 1000
  const [refLevel, setRefLevel] = useState<number>(0); // dBm
  const [noiseFloor, setNoiseFloor] = useState<number>(-105); // dBm

  // Rotary Knob State
  const [knobAngle, setKnobAngle] = useState<number>(0);
  const [isDraggingKnob, setIsDraggingKnob] = useState<boolean>(false);
  const knobLastYRef = useRef<number>(0);
  const knobCenterRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Markers: M1 & M2
  const [marker1, setMarker1] = useState<{ freq: number; dbm: number } | null>(null);
  const [marker2, setMarker2] = useState<{ freq: number; dbm: number } | null>(null);
  const [activeMarkerId, setActiveMarkerId] = useState<'M1' | 'M2'>('M1');
  const [isDraggingMarker, setIsDraggingMarker] = useState<'M1' | 'M2' | null>(null);

  // Calipers & Emission Mask
  const [calipersEnabled, setCalipersEnabled] = useState<boolean>(false);
  const [caliperLeft, setCaliperLeft] = useState<number>(505.5);
  const [caliperRight, setCaliperRight] = useState<number>(506.5);
  const [activeCaliper, setActiveCaliper] = useState<'LEFT' | 'RIGHT' | null>(null);
  const [emissionMaskType, setEmissionMaskType] = useState<'FM_200' | 'DMR_25' | 'COFDM_600' | 'DTV_6M'>('FM_200');

  // Max Hold Peak History
  const maxHoldRef = useRef<number[]>([]);

  // Canvas Ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const noiseSeedRef = useRef<number>(0);

  // Computed start/stop
  const startFreq = centerFreq - span / 2;
  const stopFreq = centerFreq + span / 2;

  // Initialize Marker 1 if null
  useEffect(() => {
    if (!marker1) {
      setMarker1({ freq: centerFreq, dbm: -45 });
    }
  }, [centerFreq, marker1]);

  // Synchronize Calipers around Center if not set
  useEffect(() => {
    if (calipersEnabled && (caliperLeft < startFreq || caliperRight > stopFreq)) {
      setCaliperLeft(Number((centerFreq - 0.25).toFixed(3)));
      setCaliperRight(Number((centerFreq + 0.25).toFixed(3)));
    }
  }, [calipersEnabled, centerFreq, startFreq, stopFreq, caliperLeft, caliperRight]);

  // Delta calculation
  const deltaStats = useMemo(() => {
    if (!marker1 || !marker2) return null;
    const deltaF = marker2.freq - marker1.freq;
    const deltaP = marker2.dbm - marker1.dbm;
    const absDeltaF = Math.abs(deltaF);

    let tag = '';
    if (Math.abs(absDeltaF - 18.0) < 0.25) tag = 'DUPLEX 18M SPLIT (TALKBACK)';
    else if (Math.abs(absDeltaF - 24.0) < 0.25) tag = 'DUPLEX 24M SPLIT (TALKBACK)';
    else if (Math.abs(absDeltaF - 45.0) < 0.25) tag = 'DUPLEX 45M SPLIT (UHF DUPLEX)';
    else if (Math.abs(absDeltaF - 8.0) < 0.1) tag = '8 MHz DTV CH SPACING';
    else if (Math.abs(absDeltaF - 6.0) < 0.1) tag = '6 MHz DTV CH SPACING';
    else if (Math.abs(absDeltaF - 0.2) < 0.02) tag = '200 kHz FM CH INTERLEAVE';
    else if (absDeltaF > 0.05 && absDeltaF < 1.0) tag = `${(absDeltaF * 1000).toFixed(0)} kHz OFFSET`;

    return {
      deltaF,
      deltaP,
      tag
    };
  }, [marker1, marker2]);

  // Caliper Bandwidth
  const caliperBwKhz = useMemo(() => {
    return Math.abs(caliperRight - caliperLeft) * 1000;
  }, [caliperLeft, caliperRight]);

  // Mask compliance test
  const maskViolation = useMemo(() => {
    if (!calipersEnabled) return false;
    // Check if any carrier falls outside caliper boundary while inside span
    const midCaliper = (caliperLeft + caliperRight) / 2;
    const halfWidth = Math.abs(caliperRight - caliperLeft) / 2;
    for (const c of carriers) {
      if (c.freq >= startFreq && c.freq <= stopFreq) {
        const dist = Math.abs(c.freq - midCaliper);
        // If carrier is within mask flank but near edge
        if (dist > halfWidth * 0.9 && dist < halfWidth * 1.5) {
          return true;
        }
      }
    }
    return false;
  }, [calipersEnabled, caliperLeft, caliperRight, carriers, startFreq, stopFreq]);

  // Coordinate Conversion Helpers
  const freqToX = useCallback((f: number, width: number) => {
    return ((f - startFreq) / span) * width;
  }, [startFreq, span]);

  const xToFreq = useCallback((x: number, width: number) => {
    return startFreq + (x / width) * span;
  }, [startFreq, span]);

  const dbmToY = useCallback((dbm: number, height: number) => {
    const range = refLevel - noiseFloor;
    const norm = (refLevel - dbm) / range;
    return Math.max(10, Math.min(height - 10, norm * height));
  }, [refLevel, noiseFloor]);

  const yToDbm = useCallback((y: number, height: number) => {
    const range = refLevel - noiseFloor;
    const norm = y / height;
    return refLevel - norm * range;
  }, [refLevel, noiseFloor]);

  // Peak Search Function
  const handlePeakSearch = useCallback(() => {
    // Find highest carrier in span
    const visibleCarriers = carriers.filter(c => c.freq >= startFreq && c.freq <= stopFreq);
    if (visibleCarriers.length > 0) {
      // Pick highest power or center-closest
      const sorted = [...visibleCarriers].sort((a, b) => (b.powerDbm || -20) - (a.powerDbm || -20));
      const top = sorted[0];
      const target = { freq: top.freq, dbm: top.powerDbm || -18 };
      if (activeMarkerId === 'M1') {
        setMarker1(target);
      } else {
        setMarker2(target);
      }
    } else {
      // Center frequency peak
      if (activeMarkerId === 'M1') {
        setMarker1({ freq: centerFreq, dbm: -30 });
      } else {
        setMarker2({ freq: centerFreq, dbm: -30 });
      }
    }
  }, [carriers, startFreq, stopFreq, activeMarkerId, centerFreq]);

  // Step Next Peak Left / Right
  const handleNextPeak = useCallback((direction: 'LEFT' | 'RIGHT') => {
    const currentM = activeMarkerId === 'M1' ? marker1 : marker2;
    const currentFreq = currentM?.freq || centerFreq;
    const visible = carriers
      .filter(c => c.freq >= startFreq && c.freq <= stopFreq)
      .sort((a, b) => a.freq - b.freq);

    if (visible.length === 0) return;

    let target: ScopeCarrier | null = null;
    if (direction === 'RIGHT') {
      target = visible.find(c => c.freq > currentFreq + 0.05) || visible[0];
    } else {
      const reversed = [...visible].reverse();
      target = reversed.find(c => c.freq < currentFreq - 0.05) || visible[visible.length - 1];
    }

    if (target) {
      const nextPoint = { freq: target.freq, dbm: target.powerDbm || -20 };
      if (activeMarkerId === 'M1') setMarker1(nextPoint);
      else setMarker2(nextPoint);
    }
  }, [activeMarkerId, marker1, marker2, centerFreq, carriers, startFreq, stopFreq]);

  // Render Canvas Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isRunning = true;

    const render = () => {
      if (!isRunning) return;
      const width = canvas.width;
      const height = canvas.height;

      // 1. Clear with deep aerospace chassis tint
      ctx.fillStyle = '#060a12';
      ctx.fillRect(0, 0, width, height);

      // 2. Graticule Lines (10 horizontal divs, 8 vertical divs)
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.12)';
      ctx.lineWidth = 1;

      // Vertical divisions
      const numHorizDivs = 10;
      for (let i = 0; i <= numHorizDivs; i++) {
        const x = (i / numHorizDivs) * width;
        ctx.beginPath();
        ctx.setLineDash(i === 0 || i === numHorizDivs ? [] : [2, 4]);
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();

        // Frequency labels on graticule
        if (i > 0 && i < numHorizDivs && i % 2 === 0) {
          const f = startFreq + (i / numHorizDivs) * span;
          ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
          ctx.font = '10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`${f.toFixed(2)}`, x, height - 6);
        }
      }

      // Horizontal divisions (Power dBm)
      const numVertDivs = 8;
      for (let j = 0; j <= numVertDivs; j++) {
        const y = (j / numVertDivs) * height;
        ctx.beginPath();
        ctx.setLineDash(j === 0 || j === numVertDivs ? [] : [2, 4]);
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();

        if (j < numVertDivs) {
          const dbm = refLevel - (j / numVertDivs) * (refLevel - noiseFloor);
          ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
          ctx.font = '9px monospace';
          ctx.textAlign = 'left';
          ctx.fillText(`${dbm.toFixed(0)} dBm`, 6, y + 11);
        }
      }
      ctx.setLineDash([]);

      // 3. Center Frequency Reticle Marker
      const centerX = width / 2;
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(centerX, 0);
      ctx.lineTo(centerX, height);
      ctx.stroke();

      // Center Diamond Reticle
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.moveTo(centerX, 4);
      ctx.lineTo(centerX + 4, 9);
      ctx.lineTo(centerX, 14);
      ctx.lineTo(centerX - 4, 9);
      ctx.closePath();
      ctx.fill();

      // 4. Calipers & Emission Mask Overlay
      if (calipersEnabled) {
        const calLeftX = freqToX(caliperLeft, width);
        const calRightX = freqToX(caliperRight, width);

        // Caliper Shaded Passband
        ctx.fillStyle = maskViolation ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.10)';
        ctx.fillRect(Math.min(calLeftX, calRightX), 0, Math.abs(calRightX - calLeftX), height);

        // Caliper boundary lines
        ctx.strokeStyle = maskViolation ? '#ef4444' : '#10b981';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);

        ctx.beginPath();
        ctx.moveTo(calLeftX, 0);
        ctx.lineTo(calLeftX, height);
        ctx.moveTo(calRightX, 0);
        ctx.lineTo(calRightX, height);
        ctx.stroke();
        ctx.setLineDash([]);

        // Caliper handles at top
        ctx.fillStyle = maskViolation ? '#ef4444' : '#10b981';
        ctx.fillRect(calLeftX - 6, 2, 12, 16);
        ctx.fillRect(calRightX - 6, 2, 12, 16);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('L', calLeftX, 14);
        ctx.fillText('R', calRightX, 14);

        // Caliper Bandwidth Label
        const midX = (calLeftX + calRightX) / 2;
        ctx.fillStyle = maskViolation ? '#f87171' : '#34d399';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`OBW: ${caliperBwKhz.toFixed(0)} kHz`, midX, 26);
      }

      // 5. Generate Spectral Curve Points (Simulation + Carriers)
      noiseSeedRef.current += 0.08;
      const numPoints = Math.min(width, 400);
      const points: { x: number; y: number; dbm: number }[] = [];

      // Initialize maxHold array if needed
      if (maxHoldRef.current.length !== numPoints) {
        maxHoldRef.current = new Array(numPoints).fill(height);
      }

      const activeCarriers = carriers.filter(c => c.freq >= startFreq - 1 && c.freq <= stopFreq + 1);

      for (let i = 0; i < numPoints; i++) {
        const x = (i / (numPoints - 1)) * width;
        const f = xToFreq(x, width);

        // Baseline noise floor grass jitter
        const grassNoise = Math.sin(i * 0.45 + noiseSeedRef.current) * 3 + Math.cos(i * 1.3 - noiseSeedRef.current * 0.7) * 4;
        let pointDbm = noiseFloor + 12 + grassNoise;

        // Carrier peak summation (Gaussian envelope)
        for (const c of activeCarriers) {
          const deltaF = Math.abs(f - c.freq);
          const carrierPwr = c.powerDbm || -18;
          // Typical FM/digital bandwidth skirt (~150 kHz roll-off)
          const sigma = c.type === 'WALKIE' ? 0.015 : 0.08;
          const attenuation = Math.exp(-Math.pow(deltaF / sigma, 2));
          if (attenuation > 0.001) {
            const addedPwr = carrierPwr + 10 * Math.log10(attenuation + 1e-6);
            if (addedPwr > pointDbm) {
              pointDbm = addedPwr;
            }
          }
        }

        const y = dbmToY(pointDbm, height);
        points.push({ x, y, dbm: pointDbm });

        // Update Max Hold
        if (y < maxHoldRef.current[i]) {
          maxHoldRef.current[i] = y;
        } else {
          // Slow decay on max hold
          maxHoldRef.current[i] = Math.min(height - 10, maxHoldRef.current[i] + 0.04);
        }
      }

      // 6. Draw Trace based on traceMode
      // A. Max Hold (Amber line)
      if (traceMode === 'MAX_HOLD') {
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < numPoints; i++) {
          const x = (i / (numPoints - 1)) * width;
          const y = maxHoldRef.current[i];
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // B. Phosphor Persistence Decay simulation
      if (traceMode === 'PHOSPHOR') {
        // Glowing background halo
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.25)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        for (let i = 0; i < points.length; i++) {
          if (i === 0) ctx.moveTo(points[i].x, points[i].y);
          else ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.stroke();

        // Secondary glow
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.5)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let i = 0; i < points.length; i++) {
          if (i === 0) ctx.moveTo(points[i].x, points[i].y);
          else ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.stroke();
      }

      // C. Core Trace Line
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      if (traceMode === 'PHOSPHOR') {
        gradient.addColorStop(0, '#34d399');
        gradient.addColorStop(0.7, '#10b981');
        gradient.addColorStop(1, '#059669');
      } else if (traceMode === 'AVG') {
        gradient.addColorStop(0, '#38bdf8');
        gradient.addColorStop(1, '#0284c7');
      } else {
        gradient.addColorStop(0, '#22d3ee');
        gradient.addColorStop(1, '#0891b2');
      }

      ctx.strokeStyle = gradient;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      for (let i = 0; i < points.length; i++) {
        if (i === 0) ctx.moveTo(points[i].x, points[i].y);
        else ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.stroke();

      // D. Semi-transparent under-trace fill
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      const fillGrad = ctx.createLinearGradient(0, 0, 0, height);
      fillGrad.addColorStop(0, traceMode === 'PHOSPHOR' ? 'rgba(16, 185, 129, 0.20)' : 'rgba(34, 211, 238, 0.16)');
      fillGrad.addColorStop(1, 'rgba(6, 10, 18, 0.0)');
      ctx.fillStyle = fillGrad;
      ctx.fill();

      // 7. Draw Carrier Identifiers / Flags
      for (const c of activeCarriers) {
        const cx = freqToX(c.freq, width);
        const cy = dbmToY(c.powerDbm || -18, height);

        // Vertical drop line to baseline
        ctx.strokeStyle = c.type === 'BASE_TX' ? 'rgba(192, 132, 252, 0.5)' : 'rgba(34, 211, 238, 0.4)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx, height);
        ctx.stroke();
        ctx.setLineDash([]);

        // Peak Dot
        ctx.fillStyle = c.color || (c.type === 'BASE_TX' ? '#c084fc' : '#22d3ee');
        ctx.beginPath();
        ctx.arc(cx, cy, 4, 0, Math.PI * 2);
        ctx.fill();

        // Flag Label
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.strokeStyle = c.color || (c.type === 'BASE_TX' ? '#c084fc' : '#22d3ee');
        ctx.lineWidth = 1;
        const labelText = c.label.length > 10 ? c.label.substring(0, 9) + '…' : c.label;
        const textWidth = ctx.measureText(labelText).width;
        const boxX = Math.max(4, Math.min(width - textWidth - 10, cx - textWidth / 2 - 4));
        const boxY = Math.max(12, cy - 22);

        ctx.fillRect(boxX, boxY, textWidth + 8, 14);
        ctx.strokeRect(boxX, boxY, textWidth + 8, 14);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(labelText, boxX + 4, boxY + 10);
      }

      // 8. Draw Markers (M1 & M2)
      if (marker1 && marker1.freq >= startFreq && marker1.freq <= stopFreq) {
        const m1X = freqToX(marker1.freq, width);
        const m1Y = dbmToY(marker1.dbm, height);

        // M1 line
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(m1X, 0);
        ctx.lineTo(m1X, height);
        ctx.stroke();

        // M1 Flag Pin
        ctx.fillStyle = activeMarkerId === 'M1' ? '#22d3ee' : '#0891b2';
        ctx.beginPath();
        ctx.moveTo(m1X, m1Y - 14);
        ctx.lineTo(m1X + 8, m1Y - 26);
        ctx.lineTo(m1X - 8, m1Y - 26);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('1', m1X, m1Y - 18);
      }

      if (marker2 && marker2.freq >= startFreq && marker2.freq <= stopFreq) {
        const m2X = freqToX(marker2.freq, width);
        const m2Y = dbmToY(marker2.dbm, height);

        // M2 line
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(m2X, 0);
        ctx.lineTo(m2X, height);
        ctx.stroke();

        // M2 Flag Pin
        ctx.fillStyle = activeMarkerId === 'M2' ? '#fbbf24' : '#d97706';
        ctx.beginPath();
        ctx.moveTo(m2X, m2Y - 14);
        ctx.lineTo(m2X + 8, m2Y - 26);
        ctx.lineTo(m2X - 8, m2Y - 26);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('2', m2X, m2Y - 18);
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      isRunning = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [
    startFreq,
    stopFreq,
    span,
    refLevel,
    noiseFloor,
    traceMode,
    carriers,
    marker1,
    marker2,
    activeMarkerId,
    calipersEnabled,
    caliperLeft,
    caliperRight,
    caliperBwKhz,
    maskViolation,
    dbmToY,
    freqToX,
    xToFreq
  ]);

  // Canvas Mouse / Touch Interaction for Markers & Calipers
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const clickedFreq = xToFreq(x, canvas.width);
    const clickedDbm = yToDbm(y, canvas.height);

    // Check if clicked near calipers
    if (calipersEnabled) {
      const calLeftX = freqToX(caliperLeft, canvas.width);
      const calRightX = freqToX(caliperRight, canvas.width);
      if (Math.abs(x - calLeftX) < 14) {
        setActiveCaliper('LEFT');
        return;
      }
      if (Math.abs(x - calRightX) < 14) {
        setActiveCaliper('RIGHT');
        return;
      }
    }

    // Check magnetic snap to nearest carrier
    let snapFreq = clickedFreq;
    let snapDbm = clickedDbm;
    let minDiff = 0.35; // MHz snap window

    for (const c of carriers) {
      const diff = Math.abs(c.freq - clickedFreq);
      if (diff < minDiff) {
        minDiff = diff;
        snapFreq = c.freq;
        snapDbm = c.powerDbm || -18;
      }
    }

    if (activeMarkerId === 'M1') {
      setMarker1({ freq: Number(snapFreq.toFixed(4)), dbm: Number(snapDbm.toFixed(1)) });
      setIsDraggingMarker('M1');
    } else {
      setMarker2({ freq: Number(snapFreq.toFixed(4)), dbm: Number(snapDbm.toFixed(1)) });
      setIsDraggingMarker('M2');
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(canvas.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(canvas.height, e.clientY - rect.top));
    const currFreq = xToFreq(x, canvas.width);
    const currDbm = yToDbm(y, canvas.height);

    if (activeCaliper === 'LEFT') {
      setCaliperLeft(Number(Math.min(caliperRight - 0.02, currFreq).toFixed(4)));
      return;
    }
    if (activeCaliper === 'RIGHT') {
      setCaliperRight(Number(Math.max(caliperLeft + 0.02, currFreq).toFixed(4)));
      return;
    }

    if (isDraggingMarker === 'M1') {
      setMarker1({ freq: Number(currFreq.toFixed(4)), dbm: Number(currDbm.toFixed(1)) });
    } else if (isDraggingMarker === 'M2') {
      setMarker2({ freq: Number(currFreq.toFixed(4)), dbm: Number(currDbm.toFixed(1)) });
    }
  };

  const handleCanvasMouseUp = () => {
    setIsDraggingMarker(null);
    setActiveCaliper(null);
  };

  // Rotary Knob Dragging Handler
  const handleKnobMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDraggingKnob(true);
    knobLastYRef.current = e.clientY;
    const rect = e.currentTarget.getBoundingClientRect();
    knobCenterRef.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  };

  const handleKnobMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingKnob) return;
    const deltaY = knobLastYRef.current - e.clientY;
    knobLastYRef.current = e.clientY;

    if (Math.abs(deltaY) > 0.5) {
      const stepMhz = stepSizeKhz / 1000;
      const change = deltaY > 0 ? stepMhz : -stepMhz;
      updateCenter(centerFreq + change);
      setKnobAngle(prev => (prev + (deltaY > 0 ? 12 : -12)) % 360);
    }
  }, [isDraggingKnob, stepSizeKhz, centerFreq, updateCenter]);

  const handleKnobMouseUp = useCallback(() => {
    setIsDraggingKnob(false);
  }, []);

  useEffect(() => {
    if (isDraggingKnob) {
      window.addEventListener('mousemove', handleKnobMouseMove);
      window.addEventListener('mouseup', handleKnobMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleKnobMouseMove);
        window.removeEventListener('mouseup', handleKnobMouseUp);
      };
    }
  }, [isDraggingKnob, handleKnobMouseMove, handleKnobMouseUp]);

  // Quick Band Presets
  const setBandPreset = (presetCenter: number, presetSpan: number) => {
    updateCenter(presetCenter);
    updateSpan(presetSpan);
  };

  return (
    <div className={`flex flex-col bg-slate-950 border border-cyan-500/30 rounded-xl overflow-hidden shadow-2xl text-slate-100 ${className}`}>
      {/* Top Instrument Bezel Header */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-cyan-500/20 gap-2">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
          <h2 className="text-xs font-black tracking-widest text-cyan-400 uppercase font-mono">
            GLASS COCKPIT SPECTRUM SCOPE
          </h2>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-mono">
            LAB GRADE
          </span>
        </div>

        {/* Center / Span Digital Display */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1 rounded border border-white/10">
            <span className="text-slate-400 text-[10px]">CF:</span>
            <span className="text-cyan-300 font-bold">{centerFreq.toFixed(4)} MHz</span>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1 rounded border border-white/10">
            <span className="text-slate-400 text-[10px]">SPAN:</span>
            <span className="text-emerald-400 font-bold">{span.toFixed(2)} MHz</span>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1 rounded border border-white/10">
            <span className="text-slate-400 text-[10px]">STEP:</span>
            <span className="text-amber-400 font-bold">{stepSizeKhz} kHz</span>
          </div>
        </div>

        {/* Trace Mode Pill Selectors */}
        <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-white/10 gap-1 text-[11px] font-mono">
          {(['PHOSPHOR', 'LIVE', 'MAX_HOLD', 'AVG'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setTraceMode(mode)}
              className={`px-2 py-0.5 rounded font-bold transition-all ${
                traceMode === mode
                  ? mode === 'PHOSPHOR'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                    : mode === 'MAX_HOLD'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                    : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Main Glass Screen Canvas & Right Control Cockpit */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-0 border-b border-cyan-500/20">
        {/* Left 3 Cols: Main Spectrum Oscilloscope CRT */}
        <div className="lg:col-span-3 relative bg-[#060a12] p-2 flex flex-col items-center justify-center">
          <canvas
            ref={canvasRef}
            width={720}
            height={320}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            className="w-full h-[280px] sm:h-[320px] rounded-lg border border-cyan-500/30 shadow-[inset_0_0_20px_rgba(0,0,0,0.8)] cursor-crosshair select-none"
          />

          {/* Under-Scope Quick Action Bar */}
          <div className="w-full flex flex-wrap items-center justify-between mt-2 px-1 text-xs font-mono text-slate-400 gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500">BAND PRESETS:</span>
              <button
                onClick={() => setBandPreset(460.0, 20.0)}
                className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-[10px] text-cyan-300 border border-white/10"
              >
                450-470M COMMS
              </button>
              <button
                onClick={() => setBandPreset(539.0, 138.0)}
                className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-[10px] text-cyan-300 border border-white/10"
              >
                470-608M DTV
              </button>
              <button
                onClick={() => setBandPreset(658.0, 12.0)}
                className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-[10px] text-cyan-300 border border-white/10"
              >
                600M DUPLEX GAP
              </button>
            </div>

            {/* Calipers Toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCalipersEnabled(!calipersEnabled)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition-all border ${
                  calipersEnabled
                    ? maskViolation
                      ? 'bg-red-500/20 text-red-300 border-red-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-900 text-slate-400 border-white/10 hover:text-slate-200'
                }`}
              >
                <Crosshair size={13} />
                <span>EMISSION CALIPERS {calipersEnabled ? (maskViolation ? '⚠️ VIOLATION' : '✅ PASS') : 'OFF'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Col: Cockpit Tactile Controls & Rotary Jog Wheel */}
        <div className="lg:col-span-1 bg-slate-900/95 p-3 flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-cyan-500/20">
          <div>
            {/* Step Size Selector */}
            <div className="mb-3">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 font-mono">
                ROTARY STEP SIZE
              </label>
              <div className="grid grid-cols-3 gap-1">
                {[25, 100, 1000].map(step => (
                  <button
                    key={step}
                    onClick={() => setStepSizeKhz(step)}
                    className={`py-1 rounded text-center font-mono font-bold text-xs transition-all border ${
                      stepSizeKhz === step
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                        : 'bg-slate-950 text-slate-400 border-white/10 hover:bg-slate-800'
                    }`}
                  >
                    {step === 1000 ? '1 MHz' : `${step}k`}
                  </button>
                ))}
              </div>
            </div>

            {/* Tactile Rotary Jog/Shuttle Dial */}
            <div className="flex flex-col items-center justify-center p-3 bg-slate-950/70 rounded-xl border border-white/10 mb-3 select-none">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono mb-2">
                TACTILE JOG WHEEL (DRAG)
              </span>

              <div
                onMouseDown={handleKnobMouseDown}
                className="relative w-28 h-28 rounded-full bg-gradient-to-br from-slate-700 via-slate-800 to-slate-950 p-1.5 shadow-[0_10px_25px_rgba(0,0,0,0.8),inset_0_2px_4px_rgba(255,255,255,0.2)] border-2 border-slate-600 cursor-grab active:cursor-grabbing hover:border-cyan-400 transition-colors"
                style={{ transform: `rotate(${knobAngle}deg)` }}
              >
                {/* Outer knurled ring notches */}
                <div className="w-full h-full rounded-full border border-dashed border-white/20 flex items-center justify-center relative">
                  {/* Position indicator dot */}
                  <div className="absolute top-1.5 w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] border border-white" />
                  {/* Center Metal Cap */}
                  <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-slate-900 to-slate-700 border border-slate-500/40 flex items-center justify-center shadow-inner">
                    <Disc className="text-cyan-400/50" size={24} />
                  </div>
                </div>
              </div>

              {/* Nudge Buttons */}
              <div className="flex items-center gap-2 mt-3 w-full">
                <button
                  onClick={() => updateCenter(centerFreq - stepSizeKhz / 1000)}
                  className="flex-1 py-1 rounded bg-slate-900 border border-white/10 hover:bg-cyan-950 hover:text-cyan-300 text-xs font-mono font-bold flex items-center justify-center gap-1"
                >
                  <ChevronLeft size={14} /> -{stepSizeKhz >= 1000 ? '1M' : `${stepSizeKhz}k`}
                </button>
                <button
                  onClick={() => updateCenter(centerFreq + stepSizeKhz / 1000)}
                  className="flex-1 py-1 rounded bg-slate-900 border border-white/10 hover:bg-cyan-950 hover:text-cyan-300 text-xs font-mono font-bold flex items-center justify-center gap-1"
                >
                  +{stepSizeKhz >= 1000 ? '1M' : `${stepSizeKhz}k`} <ChevronRight size={14} />
                </button>
              </div>
            </div>

            {/* Span Control Buttons */}
            <div className="mb-3">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 font-mono">
                SPAN ZOOM
              </label>
              <div className="grid grid-cols-4 gap-1">
                {[4, 10, 20, 50].map(s => (
                  <button
                    key={s}
                    onClick={() => updateSpan(s)}
                    className={`py-1 rounded text-center font-mono font-bold text-xs transition-all border ${
                      Math.abs(span - s) < 0.1
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                        : 'bg-slate-950 text-slate-400 border-white/10 hover:bg-slate-800'
                    }`}
                  >
                    {s}M
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Markers & Peak Search Bar */}
          <div className="border-t border-white/10 pt-2.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-slate-400 font-mono">MARKER TRACKING</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setActiveMarkerId('M1')}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                    activeMarkerId === 'M1'
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                      : 'bg-slate-950 text-slate-400 border-white/10'
                  }`}
                >
                  M1 (CYAN)
                </button>
                <button
                  onClick={() => setActiveMarkerId('M2')}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                    activeMarkerId === 'M2'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                      : 'bg-slate-950 text-slate-400 border-white/10'
                  }`}
                >
                  M2 (AMBER)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1">
              <button
                onClick={handlePeakSearch}
                className="py-1 px-1.5 rounded bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 border border-cyan-500/40 text-[10px] font-mono font-bold"
              >
                PEAK SEARCH
              </button>
              <button
                onClick={() => handleNextPeak('LEFT')}
                className="py-1 px-1 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 border border-white/10 text-[10px] font-mono font-bold"
              >
                &lt; PEAK L
              </button>
              <button
                onClick={() => handleNextPeak('RIGHT')}
                className="py-1 px-1 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 border border-white/10 text-[10px] font-mono font-bold"
              >
                PEAK R &gt;
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Marker & Delta Telemetry Readout Deck */}
      <div className="p-3 bg-slate-900/80 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
        <div className="flex flex-wrap items-center gap-4">
          {/* M1 Readout */}
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#22d3ee]" />
            <span className="text-slate-400 font-bold">M1:</span>
            <span className="text-cyan-300 font-bold">
              {marker1 ? `${marker1.freq.toFixed(4)} MHz` : '---'}
            </span>
            <span className="text-slate-500">
              ({marker1 ? `${marker1.dbm.toFixed(1)} dBm` : '---'})
            </span>
          </div>

          {/* M2 Readout */}
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_6px_#fbbf24]" />
            <span className="text-slate-400 font-bold">M2:</span>
            <span className="text-amber-300 font-bold">
              {marker2 ? `${marker2.freq.toFixed(4)} MHz` : '---'}
            </span>
            <span className="text-slate-500">
              ({marker2 ? `${marker2.dbm.toFixed(1)} dBm` : '---'})
            </span>
          </div>

          {/* Delta Readout */}
          {deltaStats && (
            <div className="flex items-center gap-2 px-3 py-1 rounded bg-slate-950 border border-cyan-500/30">
              <span className="text-purple-400 font-bold">Δ (M2 - M1):</span>
              <span className="text-purple-300 font-bold">
                {deltaStats.deltaF >= 0 ? '+' : ''}
                {deltaStats.deltaF.toFixed(4)} MHz
              </span>
              <span className="text-slate-400">
                ({deltaStats.deltaP >= 0 ? '+' : ''}
                {deltaStats.deltaP.toFixed(1)} dB)
              </span>
              {deltaStats.tag && (
                <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-500/40 font-bold">
                  {deltaStats.tag}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Status info */}
        <div className="text-[11px] text-slate-500 flex items-center gap-2">
          <span>CARRIERS ON SCREEN: {carriers.filter(c => c.freq >= startFreq && c.freq <= stopFreq).length}</span>
          <span>•</span>
          <span>DRAG CANVAS TO MOVE MARKERS</span>
        </div>
      </div>
    </div>
  );
};

export default GlassCockpitScope;
