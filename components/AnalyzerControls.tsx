import React, { useState } from 'react';
import { NumberControl } from './NumberControl';

interface AnalyzerControlsProps {
    vbw: string;
    onVbwChange: (vbw: string) => void;
    rbw: string;
    onRbwChange: (rbw: string) => void;
    span: string;
    onSpanChange: (span: string) => void;
    refLevel: number;
    onRefLevelChange: (refLevel: number) => void;
    startFreq: number;
    onStartFreqChange: (freq: number) => void;
    stopFreq: number;
    onStopFreqChange: (freq: number) => void;
    centerFreq: number;
    onCenterFreqChange: (freq: number) => void;
}

const AnalyzerControls: React.FC<AnalyzerControlsProps> = ({ 
    vbw, onVbwChange, rbw, onRbwChange, span, onSpanChange, 
    refLevel, onRefLevelChange, startFreq, onStartFreqChange, 
    stopFreq, onStopFreqChange, centerFreq, onCenterFreqChange 
}) => {
    const [stepSize, setStepSize] = useState<number>(0.1);

    return (
        <div className="bg-slate-900 p-2 rounded-md border border-white/10 shadow-sm border border-slate-700/50 mt-4">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-3 flex items-center gap-2">
                Analyzer Controls
            </h4>
            <div className="grid grid-cols-3 gap-2">
                <NumberControl label="Start Freq (MHz)" value={startFreq} onChange={(v) => onStartFreqChange(Number(v))} step={stepSize} />
                <NumberControl label="Center Freq (MHz)" value={centerFreq} onChange={(v) => onCenterFreqChange(Number(v))} step={stepSize} />
                <NumberControl label="Stop Freq (MHz)" value={stopFreq} onChange={(v) => onStopFreqChange(Number(v))} step={stepSize} />
                <NumberControl label="Span (MHz)" value={span} onChange={(v) => onSpanChange(String(v))} step={stepSize * 10} />
                <NumberControl label="Ref Level (dBm)" value={refLevel} onChange={(v) => onRefLevelChange(Number(v))} step={1} />
                
                <div className="flex flex-col gap-1">
                    <label className="text-[8px] font-black uppercase text-slate-500">Step Size</label>
                    <select 
                        value={stepSize} 
                        onChange={(e) => setStepSize(parseFloat(e.target.value))}
                        className="bg-slate-800 text-[10px] border border-slate-700 rounded px-2 py-1 text-white outline-none"
                    >
                        <option value={0.025}>25kHz</option>
                        <option value={0.05}>50kHz</option>
                        <option value={0.1}>100kHz</option>
                        <option value={0.5}>500kHz</option>
                        <option value={1}>1 MHz</option>
                        <option value={10}>10 MHz</option>
                        <option value={100}>100 MHz</option>
                    </select>
                </div>
            </div>
        </div>
    );
};


export default AnalyzerControls;
