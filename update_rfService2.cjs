const fs = require('fs');
let code = fs.readFileSync('services/rfService.ts', 'utf8');

// First, we need to extract the specific ranges from the global pool generation
// Actually, it's easier to just let them be in the global pool if they DON'T have a pair count,
// and if they DO have a pair count, we don't add them to the global pool!

code = code.replace(
`        if (cfg.customRanges && cfg.customRanges.length > 0) {
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
        }`,
`        if (cfg.customRanges && cfg.customRanges.length > 0) {
            cfg.customRanges.forEach(range => {
                if (!range.customPairCount) {
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
                }
            });
        }`
);

fs.writeFileSync('services/rfService.ts', code);
console.log('Done replacement 1');
