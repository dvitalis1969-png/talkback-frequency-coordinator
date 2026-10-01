
import { Thresholds } from '../types';

export interface ForensicConflict {
    type: '2-Tone' | '3-Tone' | 'Duplicate';
    product: number;
    sources: number[];
    target: number;
    diff: number;
}

export interface ForensicsResult {
    channelSpacing: number;
    twoTone3rd: number;
    threeTone3rd: number;
    fiveTone: number;
    sevenTone: number;
    safetyVerdict: string;
    safetyScore: number; // 0-100
    confidence: number;
    equipmentType: 'analogue' | 'digital';
    conflicts: number;
    details: ForensicConflict[];
}

export function analyzeFrequencySet(frequencies: number[], equipmentType: 'analogue' | 'digital' = 'analogue'): ForensicsResult {
    if (frequencies.length < 2) {
        return {
            channelSpacing: 0,
            twoTone3rd: 0,
            threeTone3rd: 0,
            fiveTone: 0,
            sevenTone: 0,
            safetyVerdict: 'No Data',
            safetyScore: 0,
            confidence: 0,
            equipmentType,
            conflicts: 0,
            details: []
        };
    }

    const sorted = [...frequencies].sort((a, b) => a - b);
    
    // 1. Calculate Min Channel Spacing
    let channelSpacing = Infinity;
    for (let i = 0; i < sorted.length - 1; i++) {
        const diff = sorted[i + 1] - sorted[i];
        if (diff < channelSpacing) channelSpacing = diff;
    }

    // 2. Calculate IMD Spacings
    let twoTone3rd = Infinity;
    let threeTone3rd = Infinity;
    let fiveTone = Infinity;
    let sevenTone = Infinity;
    const details: ForensicConflict[] = [];
    const MAX_3TONE_SPREAD = 40.0; // 40MHz spread limit for 3-tone products
    const MAX_2TONE_SPREAD = 80.0; // 80MHz spread limit for 2-tone products

    const threshold = 0.0001; // 100Hz tolerance

    // Check for duplicates first
    const seen = new Set<number>();
    sorted.forEach(f => {
        if (seen.has(f)) {
            details.push({ type: 'Duplicate', product: f, sources: [f], target: f, diff: 0 });
        }
        seen.add(f);
    });

    for (const target of sorted) {
        // 3rd Order 2-Tone: 2f1 - f2
        for (let i = 0; i < sorted.length; i++) {
            for (let j = 0; j < sorted.length; j++) {
                if (i === j) continue;
                const f1 = sorted[i];
                const f2 = sorted[j];
                
                // Spread check for 2-tone
                const spread2 = Math.abs(f1 - f2);
                const p = 2 * f1 - f2;
                const diff = Math.abs(target - p);

                if (spread2 <= MAX_2TONE_SPREAD) {
                    if (diff < threshold) {
                        // Check if we already recorded this conflict to avoid duplicates in details
                        const exists = details.find(d => d.type === '2-Tone' && Math.abs(d.target - target) < threshold && d.sources.includes(f1) && d.sources.includes(f2));
                        if (!exists) {
                            details.push({ type: '2-Tone', product: p, sources: [f1, f2], target, diff });
                        }
                    }
                }
                if (diff < twoTone3rd && diff > 0.000001) twoTone3rd = diff;

                // 3rd Order 3-Tone: f1 + f2 - f3
                for (let k = j + 1; k < sorted.length; k++) {
                    if (k === i) continue;
                    const f3 = sorted[k];
                    
                    // Spread check for 3-tone
                    const sources = [f1, f2, f3];
                    const spread3 = Math.max(...sources) - Math.min(...sources);

                    const p3s = [
                        f1 + f2 - f3,
                        f1 + f3 - f2,
                        f2 + f3 - f1
                    ];

                    for (const p3 of p3s) {
                        const diff3 = Math.abs(target - p3);
                        
                        if (spread3 <= MAX_3TONE_SPREAD) {
                            if (diff3 < threshold) {
                                const exists = details.find(d => d.type === '3-Tone' && Math.abs(d.target - target) < threshold && d.sources.includes(f1) && d.sources.includes(f2) && d.sources.includes(f3));
                                if (!exists) {
                                    details.push({ type: '3-Tone', product: p3, sources: [f1, f2, f3], target, diff: diff3 });
                                }
                            }
                        }
                        if (diff3 < threeTone3rd && diff3 > 0.000001) threeTone3rd = diff3;
                    }

                    // 5th Order: 3f1 - 2f2
                    const p5 = 3 * f1 - 2 * f2;
                    const diff5 = Math.abs(target - p5);
                    if (diff5 < fiveTone && diff5 > 0) fiveTone = diff5;

                    // 7th Order: 4f1 - 3f2
                    const p7 = 4 * f1 - 3 * f2;
                    const diff7 = Math.abs(target - p7);
                    if (diff7 < sevenTone && diff7 > 0) sevenTone = diff7;
                }
            }
        }
    }

    // Normalize results (round to 3 decimal places)
    const result: ForensicsResult = {
        channelSpacing: Math.round(channelSpacing * 1000) / 1000,
        twoTone3rd: twoTone3rd === Infinity ? 0 : Math.round(twoTone3rd * 1000) / 1000,
        threeTone3rd: threeTone3rd === Infinity ? 0 : Math.round(threeTone3rd * 1000) / 1000,
        fiveTone: fiveTone === Infinity ? 0 : Math.round(fiveTone * 1000) / 1000,
        sevenTone: sevenTone === Infinity ? 0 : Math.round(sevenTone * 1000) / 1000,
        safetyVerdict: '',
        safetyScore: 0,
        confidence: frequencies.length > 5 ? 0.9 : 0.5,
        equipmentType,
        conflicts: details.length,
        details
    };

    // 3. Calculate Safety Verdict
    const { verdict, score } = calculateSafety(result);
    result.safetyVerdict = verdict;
    result.safetyScore = score;

    return result;
}

function calculateSafety(stats: ForensicsResult): { verdict: string; score: number } {
    const isAnalogue = stats.equipmentType === 'analogue';
    let score = 0;
    
    // If there are direct hits, it's Risky/Invalid
    if (stats.conflicts > 0 || stats.twoTone3rd === 0 || stats.threeTone3rd === 0) {
        return { verdict: 'Risky (Conflicts)', score: 10 };
    }

    // Channel Spacing Score (0-40)
    const cs = stats.channelSpacing;
    if (isAnalogue) {
        if (cs >= 0.500) score += 40;
        else if (cs >= 0.400) score += 35;
        else if (cs >= 0.350) score += 25;
        else if (cs >= 0.300) score += 15;
    } else {
        if (cs >= 0.400) score += 40;
        else if (cs >= 0.350) score += 35;
        else if (cs >= 0.300) score += 30;
        else if (cs >= 0.250) score += 20;
    }

    // 2-Tone Spacing Score (0-30)
    const tt = stats.twoTone3rd;
    if (isAnalogue) {
        if (tt >= 0.250) score += 30;
        else if (tt >= 0.200) score += 25;
        else if (tt >= 0.150) score += 15;
        else if (tt >= 0.100) score += 5;
    } else {
        if (tt >= 0.200) score += 30;
        else if (tt >= 0.150) score += 25;
        else if (tt >= 0.100) score += 20;
        else if (tt >= 0.050) score += 10;
    }

    // 3-Tone Spacing Score (0-30)
    const tht = stats.threeTone3rd;
    if (isAnalogue) {
        if (tht >= 0.250) score += 30;
        else if (tht >= 0.200) score += 25;
        else if (tht >= 0.100) score += 15;
        else if (tht >= 0.050) score += 5;
    } else {
        if (tht >= 0.200) score += 30;
        else if (tht >= 0.100) score += 25;
        else if (tht >= 0.050) score += 20;
        else if (tht >= 0.025) score += 15;
    }

    let verdict = 'Unknown';
    if (stats.channelSpacing === 0) verdict = 'INVALID (Duplicates)';
    else if (score >= 90) verdict = 'Extremely Safe';
    else if (score >= 75) verdict = 'Very Safe';
    else if (score >= 60) verdict = 'Safe';
    else if (score >= 40) verdict = 'Tight';
    else verdict = 'Risky';

    return { verdict, score };
}
