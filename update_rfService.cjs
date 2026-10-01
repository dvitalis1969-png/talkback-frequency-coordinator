const fs = require('fs');
let content = fs.readFileSync('services/rfService.ts', 'utf-8');

content = content.replace(
`        customTxMin?: number, customTxMax?: number, customRxMin?: number, customRxMax?: number,`,
`        customTxMin?: number, customTxMax?: number, customRxMin?: number, customRxMax?: number,
        customRanges?: { id: string, txMin: number, txMax: number, rxMin: number, rxMax: number }[],`
);

content = content.replace(
`        if (cfg.customTxMin !== undefined && cfg.customTxMax !== undefined) {
            for (let f = cfg.customTxMin + startOffset; f <= cfg.customTxMax; f += bw) {
                const freqVal = parseFloat(f.toFixed(5));
                if (!isForbidden(freqVal)) customTxFreqPool.push(freqVal);
            }
        }
        
        if (cfg.customRxMin !== undefined && cfg.customRxMax !== undefined) {
            for (let f = cfg.customRxMin + startOffset; f <= cfg.customRxMax; f += bw) {
                const freqVal = parseFloat(f.toFixed(5));
                if (!isForbidden(freqVal)) customRxFreqPool.push(freqVal);
            }
        }`,
`        if (cfg.customTxMin !== undefined && cfg.customTxMax !== undefined) {
            for (let f = cfg.customTxMin + startOffset; f <= cfg.customTxMax; f += bw) {
                const freqVal = parseFloat(f.toFixed(5));
                if (!isForbidden(freqVal)) customTxFreqPool.push(freqVal);
            }
        }
        
        if (cfg.customRxMin !== undefined && cfg.customRxMax !== undefined) {
            for (let f = cfg.customRxMin + startOffset; f <= cfg.customRxMax; f += bw) {
                const freqVal = parseFloat(f.toFixed(5));
                if (!isForbidden(freqVal)) customRxFreqPool.push(freqVal);
            }
        }

        if (cfg.customRanges && cfg.customRanges.length > 0) {
            cfg.customRanges.forEach(range => {
                if (range.txMin !== undefined && range.txMax !== undefined) {
                    for (let f = range.txMin + startOffset; f <= range.txMax; f += bw) {
                        const freqVal = parseFloat(f.toFixed(5));
                        if (!isForbidden(freqVal)) customTxFreqPool.push(freqVal);
                    }
                }
                if (range.rxMin !== undefined && range.rxMax !== undefined) {
                    for (let f = range.rxMin + startOffset; f <= range.rxMax; f += bw) {
                        const freqVal = parseFloat(f.toFixed(5));
                        if (!isForbidden(freqVal)) customRxFreqPool.push(freqVal);
                    }
                }
            });
        }`
);

fs.writeFileSync('services/rfService.ts', content);
console.log("Updated rfService.ts");
