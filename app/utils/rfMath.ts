// app/utils/rfMath.ts

export interface RestrictedSpotFreq {
    freq: number;          // Center frequency in MHz
    bandwidthKhz: number;  // Bandwidth in kHz (typically 12.5, 25, or 50)
    region: string;
    description: string;
}

export interface RestrictedFreqRange {
    startFreq: number; // MHz
    stopFreq: number;  // MHz
    region: string;
    description: string;
}

// ================= HARDCODED RESTRICTED SPOT FREQUENCIES =================
export const RESTRICTED_SPOT_FREQUENCIES: RestrictedSpotFreq[] = [
    // Restricted UK-Wide (12.5 kHz)
    { freq: 455.10625, bandwidthKhz: 12.5, region: 'UK_WIDE', description: 'Restricted UK-Wide' },
    { freq: 455.20625, bandwidthKhz: 12.5, region: 'UK_WIDE', description: 'Restricted UK-Wide' },
    { freq: 455.24375, bandwidthKhz: 12.5, region: 'UK_WIDE', description: 'Restricted UK-Wide' },
    { freq: 455.26875, bandwidthKhz: 12.5, region: 'UK_WIDE', description: 'Restricted UK-Wide' },
    { freq: 455.40625, bandwidthKhz: 12.5, region: 'UK_WIDE', description: 'Restricted UK-Wide' },
    { freq: 455.43125, bandwidthKhz: 12.5, region: 'UK_WIDE', description: 'Restricted UK-Wide' },
    { freq: 455.44375, bandwidthKhz: 12.5, region: 'UK_WIDE', description: 'Restricted UK-Wide' },
    { freq: 447.45625, bandwidthKhz: 12.5, region: 'UK_WIDE', description: 'Restricted UK-Wide' },
];

// ================= HARDCODED RESTRICTED SPECTRUM RANGES =================
export const RESTRICTED_FREQUENCY_RANGES: RestrictedFreqRange[] = [
    { startFreq: 450.45625, stopFreq: 450.78125, region: 'UK_WIDE', description: 'Restricted UK-Wide' },
    { startFreq: 451.58125, stopFreq: 451.61875, region: 'UK_WIDE', description: 'Restricted UK-Wide' },
    { startFreq: 451.78125, stopFreq: 451.81875, region: 'UK_WIDE', description: 'Restricted UK-Wide' },
    { startFreq: 451.36875, stopFreq: 451.46875, region: 'UK_WIDE', description: 'Restricted UK-Wide' },
    { startFreq: 452.13125, stopFreq: 452.26875, region: 'UK_WIDE', description: 'Restricted UK-Wide' },
    { startFreq: 452.33125, stopFreq: 452.91875, region: 'UK_WIDE', description: 'Restricted UK-Wide' },
    { startFreq: 465.46875, stopFreq: 466.15625, region: 'UK_WIDE', description: 'Restricted UK-Wide' },
    { startFreq: 466.19375, stopFreq: 466.34375, region: 'UK_WIDE', description: 'Restricted UK-Wide' },
    { startFreq: 466.43125, stopFreq: 466.58125, region: 'UK_WIDE', description: 'Restricted UK-Wide' },
    { startFreq: 466.68125, stopFreq: 466.74375, region: 'UK_WIDE', description: 'Restricted UK-Wide' },
];

// ================= UK EXCLUSIONS STATE & SUBSCRIBERS =================
let ukExclusionsGlobal = false;
const ukExclusionListeners = new Set<(enabled: boolean) => void>();

if (typeof window !== 'undefined' && window.localStorage) {
    try {
        const saved = window.localStorage.getItem('rf_uk_exclusions_enabled');
        if (saved !== null) {
            ukExclusionsGlobal = saved === 'true';
        }
    } catch (e) {}
}

export function getUkExclusionsEnabled(): boolean {
    return ukExclusionsGlobal;
}

export function setUkExclusionsEnabled(enabled: boolean): void {
    ukExclusionsGlobal = enabled;
    if (typeof window !== 'undefined' && window.localStorage) {
        try {
            window.localStorage.setItem('rf_uk_exclusions_enabled', enabled ? 'true' : 'false');
        } catch (e) {}
    }
    ukExclusionListeners.forEach(fn => {
        try { fn(enabled); } catch (e) {}
    });
}

export function subscribeUkExclusions(listener: (enabled: boolean) => void): () => void {
    ukExclusionListeners.add(listener);
    return () => {
        ukExclusionListeners.delete(listener);
    };
}

/**
 * Check whether a frequency falls within any restricted spot frequency or range.
 * If UK Exclusions is disabled, all restrictions are bypassed unless forceCheck is true.
 */
export function isFrequencyRestricted(
    freqMhz: number,
    selectedRegion: string = 'UK_ALL',
    forceCheck?: boolean
): { isRestricted: boolean; reason?: string } {
    if (!ukExclusionsGlobal && !forceCheck) {
        return { isRestricted: false };
    }
    if (!freqMhz || freqMhz <= 0) return { isRestricted: false };

    // 1. Check Spot Frequencies (12.5 kHz slot = ±6.24 kHz)
    for (let i = 0; i < RESTRICTED_SPOT_FREQUENCIES.length; i++) {
        const spot = RESTRICTED_SPOT_FREQUENCIES[i];
        const halfBwMhz = (spot.bandwidthKhz / 2000);
        if (Math.abs(freqMhz - spot.freq) <= halfBwMhz - 0.0001) {
            return {
                isRestricted: true,
                reason: `Spot frequency ${spot.freq.toFixed(5)} MHz is restricted (${spot.description})`
            };
        }
    }

    // 2. Check Ranges (allows adjacent 12.5 kHz frequency just outside the range)
    for (let i = 0; i < RESTRICTED_FREQUENCY_RANGES.length; i++) {
        const range = RESTRICTED_FREQUENCY_RANGES[i];
        if (freqMhz >= range.startFreq - 0.001 && freqMhz <= range.stopFreq + 0.001) {
            return {
                isRestricted: true,
                reason: `Frequency ${freqMhz.toFixed(5)} MHz falls inside restricted range ${range.startFreq.toFixed(5)} - ${range.stopFreq.toFixed(5)} MHz (${range.description})`
            };
        }
    }

    return { isRestricted: false };
}

export const DISCRETE_TALKBACK_PAIRS: Record<number, {tx: number, rx: number}[]> = {
    455: [
        { tx: 455.00625, rx: 468.38125 }, 
        { tx: 455.03125, rx: 468.05625 }, { tx: 455.09375, rx: 468.39375 }, { tx: 455.11875, rx: 468.41875 },
        { tx: 455.13125, rx: 468.43125 }, { tx: 455.19375, rx: 468.01875 }, { tx: 455.21875, rx: 468.49375 },
        { tx: 455.23125, rx: 468.50625 }, { tx: 455.28125, rx: 468.29375 }, { tx: 455.25625, rx: 468.19375 },
        { tx: 455.39375, rx: 468.33125 }, { tx: 455.41875, rx: 468.30625 }, { tx: 455.26875, rx: 468.18125 }
    ],
    457: [
        { tx: 457.25625, rx: 467.30625 }, { tx: 457.26875, rx: 467.31875 }, { tx: 457.28125, rx: 467.29375 },
        { tx: 457.29375, rx: 467.40625 }, { tx: 457.30625, rx: 467.36875 }, { tx: 457.31875, rx: 467.48125 },
        { tx: 457.33125, rx: 467.44375 }, { tx: 457.34375, rx: 467.38125 }, { tx: 457.35625, rx: 467.33125 },
        { tx: 457.36875, rx: 467.35625 }, { tx: 457.38125, rx: 467.45625 }, { tx: 457.39375, rx: 467.39375 },
        { tx: 457.40625, rx: 467.34375 }, { tx: 457.41875, rx: 467.49375 }, { tx: 457.43125, rx: 467.46875 },
        { tx: 457.44375, rx: 467.53125 }, { tx: 457.45625, rx: 467.51875 }, { tx: 457.46875, rx: 467.50625 }
    ]
};

export const toHz = (mhz) => Math.round(mhz * 1000000);

export const checkCompatibility = (
    cand, 
    existingPlan, 
    candZoneId, 
    isZoneCoupled // function(zoneA, zoneB) => boolean
) => {
    // 0. REGULATORY RESTRICTIONS CHECK:
    // Reject any candidate frequency that lands on a restricted spot or range
    if (cand.tx > 0) {
        const txCheck = isFrequencyRestricted(cand.tx);
        if (txCheck.isRestricted) return false;
    }
    if (cand.rx > 0) {
        const rxCheck = isFrequencyRestricted(cand.rx);
        if (rxCheck.isRestricted) return false;
    }

    // Spacing constraints:
    // SAME ZONE: Frequencies in the same zone MUST be separated by at least 25 kHz (0.025 MHz).
    // Adjacent 12.5 kHz channels are strictly forbidden in the same zone to eliminate filter bleed.
    const SAME_ZONE_MIN_SEP_HZ = toHz(0.02499); // >= 25 kHz required in same zone (<24.99 kHz is clash)
    // ACROSS DISTINCT ZONES: Co-channel clearance (<12.5 kHz is clash, >=12.5 kHz is clear)
    const INTER_ZONE_MIN_SEP_HZ = toHz(0.0125);
    const IMD_HZ = toHz(0.0120);        // 12.0 kHz IMD avoidance window (<12.0 kHz is clash, >=12.5 kHz is clear)

    const candTxHz = toHz(cand.tx);
    const candRxHz = cand.rx > 0 ? toHz(cand.rx) : 0;

    // 1. FREQUENCY SEPARATION CHECK ACROSS ALL EXISTING CHANNELS
    for (let i = 0; i < existingPlan.length; i++) {
        const other = existingPlan[i];
        const otherTxHz = toHz(other.tx);
        const otherRxHz = other.rx > 0 ? toHz(other.rx) : 0;
        const isSameZone = (other.zoneId === candZoneId);

        // Required minimum frequency separation:
        // In the same zone: MUST be at least 25 kHz away (adjacent channels / 12.5 kHz bleed is strictly forbidden)
        // Across different zones: MUST not be co-channel (< 12.5 kHz)
        const minSepHz = isSameZone ? SAME_ZONE_MIN_SEP_HZ : INTER_ZONE_MIN_SEP_HZ;

        // Candidate TX vs Other TX & RX
        if (cand.tx > 0) {
            if (otherTxHz > 0 && Math.abs(candTxHz - otherTxHz) < minSepHz) return false;
            if (otherRxHz > 0 && Math.abs(candTxHz - otherRxHz) < minSepHz) return false;
        }

        // Candidate RX vs Other TX & RX
        if (candRxHz > 0) {
            if (otherTxHz > 0 && Math.abs(candRxHz - otherTxHz) < minSepHz) return false;
            if (otherRxHz > 0 && Math.abs(candRxHz - otherRxHz) < minSepHz) return false;
        }
    }

    // Candidate self TX-RX spacing check (must be at least 25 kHz)
    if (cand.tx > 0 && candRxHz > 0 && Math.abs(candTxHz - candRxHz) < SAME_ZONE_MIN_SEP_HZ) return false;

    // 2. WALKIE-TALKIE / PTT EXEMPTION
    if (cand.simplexType === 'walkie') {
        return true; 
    }

    // 3. SPATIAL INTERMODULATION CHECK
    const coupledTxHzs = [];
    const coupledVictimHzs = [];

    for (let i = 0; i < existingPlan.length; i++) {
        const p = existingPlan[i];
        const otherZoneId = p.zoneId;

        const isCoupled = (otherZoneId === candZoneId) || isZoneCoupled(candZoneId, otherZoneId);

        if (isCoupled) {
            if (p.tx > 0) {
                const hz = toHz(p.tx);
                if (p.txIsBase !== false) coupledTxHzs.push(hz);
                coupledVictimHzs.push(hz);
            }
            if (p.rx > 0) {
                const hz = toHz(p.rx);
                if (p.rxIsBase === true) coupledTxHzs.push(hz);
                coupledVictimHzs.push(hz);
            }
        }
    }

    const fullVictims = [...coupledVictimHzs];
    if (cand.tx > 0) fullVictims.push(candTxHz);
    if (candRxHz > 0) fullVictims.push(candRxHz);

    // A) Candidate as victim of coupled continuous emitters
    if (cand.tx > 0 || candRxHz > 0) {
        for (let a = 0; a < coupledTxHzs.length; a++) {
            const f1 = coupledTxHzs[a];
            for (let b = 0; b < coupledTxHzs.length; b++) {
                if (a === b) continue;
                const p2 = 2 * f1 - coupledTxHzs[b];
                if (cand.tx > 0 && Math.abs(candTxHz - p2) < IMD_HZ) return false;
                if (candRxHz > 0 && Math.abs(candRxHz - p2) < IMD_HZ) return false;
            }
        }
        for (let a = 0; a < coupledTxHzs.length; a++) {
            const f1 = coupledTxHzs[a];
            for (let b = a + 1; b < coupledTxHzs.length; b++) {
                const f2 = coupledTxHzs[b];
                for (let c = b + 1; c < coupledTxHzs.length; c++) {
                    const f3 = coupledTxHzs[c];
                    const p3a = f1 + f2 - f3;
                    const p3b = f1 + f3 - f2;
                    const p3c = f2 + f3 - f1;
                    if (cand.tx > 0) {
                        if (Math.abs(candTxHz - p3a) < IMD_HZ) return false;
                        if (Math.abs(candTxHz - p3b) < IMD_HZ) return false;
                        if (Math.abs(candTxHz - p3c) < IMD_HZ) return false;
                    }
                    if (candRxHz > 0) {
                        if (Math.abs(candRxHz - p3a) < IMD_HZ) return false;
                        if (Math.abs(candRxHz - p3b) < IMD_HZ) return false;
                        if (Math.abs(candRxHz - p3c) < IMD_HZ) return false;
                    }
                }
            }
        }
    }

    // B) Candidate TX causes IMD with coupled transmitters that strikes a coupled victim
    if (cand.tx > 0 && cand.txIsBase !== false) {
        for (let i = 0; i < fullVictims.length; i++) {
            const vHz = fullVictims[i];
            for (let j = 0; j < coupledTxHzs.length; j++) {
                const p2a = 2 * candTxHz - coupledTxHzs[j];
                const p2b = 2 * coupledTxHzs[j] - candTxHz;
                if (Math.abs(vHz - p2a) < IMD_HZ) return false;
                if (Math.abs(vHz - p2b) < IMD_HZ) return false;
            }
            for (let a = 0; a < coupledTxHzs.length; a++) {
                const f1 = coupledTxHzs[a];
                for (let b = a + 1; b < coupledTxHzs.length; b++) {
                    const f2 = coupledTxHzs[b];
                    const p3a = candTxHz + f1 - f2;
                    const p3b = candTxHz + f2 - f1;
                    const p3c = f1 + f2 - candTxHz;
                    if (Math.abs(vHz - p3a) < IMD_HZ) return false;
                    if (Math.abs(vHz - p3b) < IMD_HZ) return false;
                    if (Math.abs(vHz - p3c) < IMD_HZ) return false;
                }
            }
        }
    }

    return true;
};

export const calculateIMDs = (transmitters) => {
    const twoTone = [];
    const threeTone = [];
    const activeTx = (transmitters || []).filter(t => t.txIsBase !== false && t.freq > 0);
    const txHzs = activeTx.map(t => toHz(t.freq));

    for (let a = 0; a < txHzs.length; a++) {
        const f1 = txHzs[a];
        for (let b = 0; b < txHzs.length; b++) {
            if (a === b) continue;
            const p2 = 2 * f1 - txHzs[b];
            twoTone.push({ 
                freq: p2 / 1000000, type: '2-Tone', color: '#ef4444',
                desc: `2*${(f1/1000000).toFixed(5)} - ${(txHzs[b]/1000000).toFixed(5)}`
            });
        }
    }

    for (let a = 0; a < txHzs.length; a++) {
        const f1 = txHzs[a];
        for (let b = a + 1; b < txHzs.length; b++) {
            const f2 = txHzs[b];
            for (let c = b + 1; c < txHzs.length; c++) {
                const f3 = txHzs[c];
                const p3a = f1 + f2 - f3;
                const p3b = f1 + f3 - f2;
                const p3c = f2 + f3 - f1;
                
                const add3Tone = (val, fA, fB, fC) => {
                    threeTone.push({
                        freq: val / 1000000, type: '3-Tone', color: '#a855f7', 
                        desc: `${(fA/1000000).toFixed(5)} + ${(fB/1000000).toFixed(5)} - ${(fC/1000000).toFixed(5)}`
                    });
                };
                
                add3Tone(p3a, f1, f2, f3);
                add3Tone(p3b, f1, f3, f2);
                add3Tone(p3c, f2, f3, f1);
            }
        }
    }
    return [...twoTone, ...threeTone];
};

const createShuffledPool = (min, max, step) => {
    const pool = [];
    const minHz = toHz(min);
    const maxHz = toHz(max);
    const stepHz = toHz(step);
    for (let hz = minHz; hz <= maxHz; hz += stepHz) {
        const freqMhz = hz / 1000000;
        if (!isFrequencyRestricted(freqMhz).isRestricted) {
            pool.push(freqMhz);
        }
    }
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool;
};

// Full Multi-Zone Coordinator supporting Custom Portable TX / RX Ranges, Dedicated Bands & Multi-Pass Optimization
export const coordinateAllZones = ({
    zones = [],
    zoneDistances = {},
    zoneOverrides = {},
    existingPlan = [],
    iterations = 200
}) => {
    const isZoneCoupled = (zA, zB) => {
        if (zA === zB) return true;
        const key1 = `${zA}_${zB}`;
        const key2 = `${zB}_${zA}`;

        if (zoneOverrides[key1] !== undefined) return zoneOverrides[key1];
        if (zoneOverrides[key2] !== undefined) return zoneOverrides[key2];

        const dist = zoneDistances[key1] !== undefined ? zoneDistances[key1] : (zoneDistances[key2] !== undefined ? zoneDistances[key2] : 30);
        return dist < 26.0;
    };

    // Only locked channels are preserved across coordination runs
    const lockedPlan = (existingPlan || []).filter(p => p && p.locked);

    // Calculate total requested channels
    let totalTargetCount = lockedPlan.length;
    zones.forEach(zone => {
        (zone.duplexBands || []).forEach(b => { totalTargetCount += (parseInt(b.pairCount) || 0); });
        if (zone.enableBaseSimplex || (zone.baseSimplexBands || []).some(b => (parseInt(b.count) || 0) > 0)) {
            (zone.baseSimplexBands || []).forEach(b => { totalTargetCount += (parseInt(b.count) || 0); });
        }
        if (zone.enableWalkieSimplex || (zone.walkieSimplexBands || []).some(b => (parseInt(b.count) || 0) > 0)) {
            (zone.walkieSimplexBands || []).forEach(b => { totalTargetCount += (parseInt(b.count) || 0); });
        }
    });

    let bestPlan = [...lockedPlan];
    let bestScore = lockedPlan.length;

    // Run multi-attempt stochastic optimization to find the largest compatible clash-free set
    const numAttempts = Math.max(iterations, 100);

    for (let attempt = 0; attempt < numAttempts; attempt++) {
        const currentPlan = [...lockedPlan];

        // Shuffle zone processing order periodically to balance frequency allocation
        const zoneList = [...zones];
        if (attempt > 0) {
            for (let i = zoneList.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [zoneList[i], zoneList[j]] = [zoneList[j], zoneList[i]];
            }
        }

        for (const zone of zoneList) {
            const zoneId = zone.id;
            const zoneName = zone.name || `Zone ${zoneId}`;

            // 1. DUPLEX BANDS FOR THIS ZONE
            (zone.duplexBands || []).forEach((band, bandIndex) => {
                const targetCount = parseInt(band.pairCount) || 0;
                const bMin = parseFloat(band.txMin) || 450.0;
                const bMax = parseFloat(band.txMax) || 455.0;
                const bStep = (parseFloat(band.bw) || 12.5) / 1000;
                const bandId = band.id || `dup_${zoneId}_${bandIndex + 1}`;

                // Check dedicated discrete UK bands (455/468 or 457/467)
                let discreteKey = null;
                if (band.discreteBand === 455 || (bMin >= 454.9 && bMax <= 455.5)) discreteKey = 455;
                else if (band.discreteBand === 457 || (bMin >= 457.0 && bMax <= 457.6)) discreteKey = 457;

                const existingInBand = currentPlan.filter(p => p.zoneId === zoneId && !p.isSimplex && (p.bandId === bandId || (p.tx >= bMin && p.tx <= bMax)));
                let currentCount = existingInBand.length;

                if (targetCount > currentCount) {
                    if (discreteKey && DISCRETE_TALKBACK_PAIRS[discreteKey]) {
                        const discreteList = [...DISCRETE_TALKBACK_PAIRS[discreteKey]];
                        for (let i = discreteList.length - 1; i > 0; i--) {
                            const j = Math.floor(Math.random() * (i + 1));
                            [discreteList[i], discreteList[j]] = [discreteList[j], discreteList[i]];
                        }

                        for (let i = 0; i < discreteList.length; i++) {
                            if (currentCount >= targetCount) break;
                            const pair = discreteList[i];
                            if (isFrequencyRestricted(pair.tx).isRestricted || isFrequencyRestricted(pair.rx).isRestricted) {
                                continue;
                            }
                            const candidate = {
                                tx: pair.tx,
                                rx: pair.rx,
                                txIsBase: true,
                                rxIsBase: false,
                                isSimplex: false,
                                zoneId: zoneId,
                                zoneName: zoneName,
                                bandId: bandId,
                                bandLabel: band.label || `${discreteKey}/${discreteKey === 455 ? 468 : 467} Dedicated`,
                                locked: false
                            };

                            if (checkCompatibility(candidate, currentPlan, zoneId, isZoneCoupled)) {
                                currentPlan.push(candidate);
                                currentCount++;
                            }
                        }
                    } else {
                        // Custom user range and split
                        const customSplit = band.split !== undefined && band.split !== '' ? parseFloat(band.split) : null;
                        let rxMin = band.rxMin !== undefined && band.rxMin !== '' ? parseFloat(band.rxMin) : null;
                        let rxMax = band.rxMax !== undefined && band.rxMax !== '' ? parseFloat(band.rxMax) : null;

                        if (customSplit !== null && (rxMin === null || rxMax === null)) {
                            rxMin = parseFloat((bMin + customSplit).toFixed(5));
                            rxMax = parseFloat((bMax + customSplit).toFixed(5));
                        } else if (rxMin === null || rxMax === null) {
                            rxMin = parseFloat((bMin + 10.0).toFixed(5));
                            rxMax = parseFloat((bMax + 10.0).toFixed(5));
                        }

                        const effectiveSep = customSplit !== null ? customSplit : (rxMin - bMin);
                        const txPool = createShuffledPool(bMin, bMax, bStep);
                        const rxPool = createShuffledPool(Math.min(rxMin, rxMax), Math.max(rxMin, rxMax), bStep);

                        for (let i = 0; i < txPool.length; i++) {
                            if (currentCount >= targetCount) break;
                            const candTx = txPool[i];
                            if (isFrequencyRestricted(candTx).isRestricted) continue;

                            let candRx = parseFloat((candTx + effectiveSep).toFixed(5));
                            const minAllowedRx = Math.min(rxMin, rxMax);
                            const maxAllowedRx = Math.max(rxMin, rxMax);

                            if (candRx < minAllowedRx || candRx > maxAllowedRx || isFrequencyRestricted(candRx).isRestricted) {
                                const validRx = rxPool.find(r => !isFrequencyRestricted(r).isRestricted && (customSplit === null || Math.abs(r - (candTx + effectiveSep)) < 0.001));
                                if (!validRx) continue;
                                candRx = validRx;
                            }
                            if (isFrequencyRestricted(candRx).isRestricted) continue;

                            const candidate = {
                                tx: candTx,
                                rx: candRx,
                                txIsBase: true,
                                rxIsBase: false,
                                isSimplex: false,
                                zoneId: zoneId,
                                zoneName: zoneName,
                                bandId: bandId,
                                bandLabel: band.label || `Band ${bandIndex + 1}`,
                                locked: false
                            };

                            if (checkCompatibility(candidate, currentPlan, zoneId, isZoneCoupled)) {
                                currentPlan.push(candidate);
                                currentCount++;
                            }
                        }
                    }
                }
            });

            // 2. BASE TX / IFB BANDS FOR THIS ZONE
            if ((zone.enableBaseSimplex || (zone.baseSimplexBands || []).some(b => (parseInt(b.count) || 0) > 0)) && (zone.baseSimplexBands || []).length > 0) {
                zone.baseSimplexBands.forEach((band, bandIndex) => {
                    const targetCount = parseInt(band.count) || 0;
                    const sMin = parseFloat(band.min) || 455.0;
                    const sMax = parseFloat(band.max) || 460.0;
                    const sStep = (parseFloat(band.bw) || 12.5) / 1000;
                    const bandId = band.id || `ifb_${zoneId}_${bandIndex + 1}`;

                    let discreteSimplexKey = null;
                    if (band.discreteBand === 455 || (sMin >= 454.9 && sMax <= 455.5)) discreteSimplexKey = 455;
                    else if (band.discreteBand === 457 || (sMin >= 457.0 && sMax <= 457.6)) discreteSimplexKey = 457;

                    const existingInBand = currentPlan.filter(p => p.zoneId === zoneId && p.isSimplex && p.simplexType === 'base_tx' && (p.bandId === bandId || (p.tx >= sMin && p.tx <= sMax)));
                    let currentCount = existingInBand.length;

                    if (targetCount > currentCount) {
                        const pool = discreteSimplexKey && DISCRETE_TALKBACK_PAIRS[discreteSimplexKey]
                            ? Array.from(new Set(DISCRETE_TALKBACK_PAIRS[discreteSimplexKey].map(p => p.tx))).filter(f => !isFrequencyRestricted(f).isRestricted).sort(() => Math.random() - 0.5)
                            : createShuffledPool(sMin, sMax, sStep);

                        for (let i = 0; i < pool.length; i++) {
                            if (currentCount >= targetCount) break;
                            const candFreq = pool[i];
                            if (isFrequencyRestricted(candFreq).isRestricted) continue;
                            const candidate = {
                                tx: candFreq,
                                rx: 0,
                                txIsBase: true,
                                rxIsBase: false,
                                isSimplex: true,
                                simplexType: 'base_tx',
                                zoneId: zoneId,
                                zoneName: zoneName,
                                bandId: bandId,
                                bandLabel: band.label || `IFB Band ${bandIndex + 1}`,
                                locked: false
                            };

                            if (checkCompatibility(candidate, currentPlan, zoneId, isZoneCoupled)) {
                                currentPlan.push(candidate);
                                currentCount++;
                            }
                        }
                    }
                });
            }

            // 3. WALKIE-TALKIE / PTT BANDS FOR THIS ZONE
            if ((zone.enableWalkieSimplex || (zone.walkieSimplexBands || []).some(b => (parseInt(b.count) || 0) > 0)) && (zone.walkieSimplexBands || []).length > 0) {
                zone.walkieSimplexBands.forEach((band, bandIndex) => {
                    const targetCount = parseInt(band.count) || 0;
                    const wMin = parseFloat(band.min) || 455.0;
                    const wMax = parseFloat(band.max) || 460.0;
                    const wStep = (parseFloat(band.bw) || 12.5) / 1000;
                    const bandId = band.id || `wt_${zoneId}_${bandIndex + 1}`;

                    let discreteWalkieKey = null;
                    if (band.discreteBand === 468 || (wMin >= 468.0 && wMax <= 468.6)) discreteWalkieKey = 455;
                    else if (band.discreteBand === 467 || (wMin >= 467.0 && wMax <= 467.6)) discreteWalkieKey = 457;

                    const existingInBand = currentPlan.filter(p => p.zoneId === zoneId && p.isSimplex && p.simplexType === 'walkie' && (p.bandId === bandId || (p.tx >= wMin && p.tx <= wMax)));
                    let currentCount = existingInBand.length;

                    if (targetCount > currentCount) {
                        const pool = discreteWalkieKey && DISCRETE_TALKBACK_PAIRS[discreteWalkieKey]
                            ? Array.from(new Set(DISCRETE_TALKBACK_PAIRS[discreteWalkieKey].map(p => p.rx))).filter(f => !isFrequencyRestricted(f).isRestricted).sort(() => Math.random() - 0.5)
                            : createShuffledPool(wMin, wMax, wStep);

                        for (let i = 0; i < pool.length; i++) {
                            if (currentCount >= targetCount) break;
                            const candFreq = pool[i];
                            if (isFrequencyRestricted(candFreq).isRestricted) continue;
                            const candidate = {
                                tx: candFreq,
                                rx: 0,
                                txIsBase: false,
                                rxIsBase: false,
                                isSimplex: true,
                                simplexType: 'walkie',
                                zoneId: zoneId,
                                zoneName: zoneName,
                                bandId: bandId,
                                bandLabel: band.label || `WT Band ${bandIndex + 1}`,
                                locked: false
                            };

                            if (checkCompatibility(candidate, currentPlan, zoneId, isZoneCoupled)) {
                                currentPlan.push(candidate);
                                currentCount++;
                            }
                        }
                    }
                });
            }
        }

        if (currentPlan.length > bestScore) {
            bestScore = currentPlan.length;
            bestPlan = currentPlan;
            // Early break if 100% full capacity achieved with 0 clashes
            if (bestScore >= totalTargetCount) {
                break;
            }
        }
    }

    return bestPlan.sort((a, b) => {
        if (a.zoneId !== b.zoneId) return a.zoneId.localeCompare(b.zoneId);
        if (a.isSimplex === b.isSimplex) return a.tx - b.tx;
        return a.isSimplex ? 1 : -1;
    });
};

export default function RfMathRoute() {
    return null;
}
