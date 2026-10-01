import React, { useState, useEffect } from 'react';

interface SmartNumberInputProps {
    value: number | undefined;
    onChange: (id: string, val: string) => void;
    id: string;
    className?: string;
    placeholder?: string;
    readOnly?: boolean;
    format?: boolean;
}

const SmartNumberInput: React.FC<SmartNumberInputProps> = ({ 
    value, 
    onChange, 
    id, 
    className, 
    placeholder, 
    readOnly = false, 
    format = true 
}) => {
    const [localValue, setLocalValue] = useState(value !== undefined ? (format && value !== 0 ? value.toFixed(3) : value.toString()) : '');
    const [isFocused, setIsFocused] = useState(false);

    useEffect(() => {
        if (!isFocused) {
            setLocalValue(value !== undefined ? (format && value !== 0 ? value.toFixed(3) : value.toString()) : '');
        }
    }, [value, isFocused, format]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = e.target.value;
        // Allow common numeric input patterns including decimals and negatives
        if (v === '' || v === '.' || v === '-' || v === '-.' || /^-?\d*\.?\d*$/.test(v)) {
            setLocalValue(v);
            onChange(id, v);
        }
    };

    return (
        <input
            type="text"
            value={localValue}
            readOnly={readOnly}
            placeholder={placeholder}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onChange={handleInputChange}
            className={className}
        />
    );
};

export default SmartNumberInput;
