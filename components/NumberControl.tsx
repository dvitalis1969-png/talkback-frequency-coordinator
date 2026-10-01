import React, { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface NumberControlProps {
    label: string;
    value: number | string;
    onChange: (value: number | string) => void;
    step?: number;
    className?: string;
}

export const NumberControl: React.FC<NumberControlProps> = ({ label, value, onChange, step = 1, className }) => {
    const [localValue, setLocalValue] = useState<string>(value.toString());
    const [isFocused, setIsFocused] = useState<boolean>(false);

    // Sync with parent value when parent value changes and input is not focused
    useEffect(() => {
        if (!isFocused) {
            setLocalValue(value.toString());
        }
    }, [value, isFocused]);

    const handleBlur = () => {
        setIsFocused(false);
        // On blur, parse the local value and propagate up
        const parsed = parseFloat(localValue);
        if (!isNaN(parsed)) {
            onChange(typeof value === 'string' ? localValue : parsed);
        } else {
            // Revert to parent value if invalid
            setLocalValue(value.toString());
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            const parsed = parseFloat(localValue);
            if (!isNaN(parsed)) {
                onChange(typeof value === 'string' ? localValue : parsed);
                (e.target as HTMLInputElement).blur();
            } else {
                setLocalValue(value.toString());
            }
        }
    };

    const increment = () => {
        const numericValue = typeof value === 'string' ? parseFloat(value) : value;
        const currentVal = isNaN(numericValue) ? 0 : numericValue;
        const newVal = currentVal + step;
        // Keep decimals tidy to avoid floating-point errors (e.g. 0.1 + 0.2)
        const roundedVal = parseFloat(newVal.toFixed(4));
        const newValStr = roundedVal.toString();
        setLocalValue(newValStr);
        onChange(typeof value === 'string' ? newValStr : roundedVal);
    };

    const decrement = () => {
        const numericValue = typeof value === 'string' ? parseFloat(value) : value;
        const currentVal = isNaN(numericValue) ? 0 : numericValue;
        const newVal = currentVal - step;
        const roundedVal = parseFloat(newVal.toFixed(4));
        const newValStr = roundedVal.toString();
        setLocalValue(newValStr);
        onChange(typeof value === 'string' ? newValStr : roundedVal);
    };

    return (
        <div className={`flex flex-col gap-1 ${className}`}>
            <label className="text-[8px] font-black uppercase text-slate-500">{label}</label>
            <div className="flex items-center bg-slate-800 border border-slate-700 rounded overflow-hidden">
                <input
                    type="text" // Use text so we can control trailing dots/negatives perfectly
                    value={localValue}
                    onFocus={() => setIsFocused(true)}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    onChange={(e) => {
                        const val = e.target.value;
                        // Allow common numeric input patterns including decimals, empty values, and negatives
                        if (val === '' || val === '.' || val === '-' || val === '-.' || /^-?\d*\.?\d*$/.test(val)) {
                            setLocalValue(val);
                        }
                    }}
                    className="bg-transparent w-full px-2 py-1 text-[10px] text-white outline-none font-mono"
                />
                <div className="flex flex-col bg-slate-700/50">
                    <button onClick={increment} className="hover:bg-slate-600 px-1"><ChevronUp size={10} /></button>
                    <button onClick={decrement} className="hover:bg-slate-600 px-1"><ChevronDown size={10} /></button>
                </div>
            </div>
        </div>
    );
};
