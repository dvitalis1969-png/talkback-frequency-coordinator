import { Frequency, Thresholds } from '../types';

export interface IMDProduct {
    freq: number;
    type: '2-Tone' | '3-Tone';
    sources: Frequency[];
}

export const calculateIMD = (frequencies: Frequency[], thresholds: Thresholds): IMDProduct[] => {
    const products: IMDProduct[] = [];
    const validFreqs = frequencies.filter(f => f.value > 0);
    
    if (validFreqs.length < 2) return products;

    // Cap carrier count for 3-tone calculation to prevent freezing (O(n^3))
    const isHighDensity = validFreqs.length > 80;
    const isUltraHighDensity = validFreqs.length > 200;

    // 2-Tone IMD: O(n^2) is generally safe up to hundreds of frequencies
    for (let i = 0; i < validFreqs.length; i++) {
        for (let j = 0; j < validFreqs.length; j++) {
            if (i === j) continue;
            const product = 2 * validFreqs[i].value - validFreqs[j].value;
            products.push({ freq: product, type: '2-Tone', sources: [validFreqs[i], validFreqs[j]] });
        }
    }

    if (isUltraHighDensity) {
        console.warn(`[calculateIMD] Frequency count too high (${validFreqs.length}). Skipping 3-tone for performance.`);
        return products;
    }

    // 3-Tone IMD: O(n^3) - optimize with symmetry and density caps
    for (let i = 0; i < validFreqs.length; i++) {
        if (isHighDensity && i > 60 && Math.random() > 0.5) continue;
        
        for (let j = i + 1; j < validFreqs.length; j++) {
            if (isHighDensity && j > 80 && Math.random() > 0.5) continue;

            for (let k = 0; k < validFreqs.length; k++) {
                if (k === i || k === j) continue;
                if (isHighDensity && k > 100 && Math.random() > 0.5) continue;

                const product = validFreqs[i].value + validFreqs[j].value - validFreqs[k].value;
                products.push({ freq: product, type: '3-Tone', sources: [validFreqs[i], validFreqs[j], validFreqs[k]] });
            }
        }
    }

    return products;
};
