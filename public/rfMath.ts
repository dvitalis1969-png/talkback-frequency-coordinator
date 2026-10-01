// app/utils/rfMath.ts

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
    const ADJ_CHANNEL_HZ = toHz(0.025); // 25 kHz adjacent channel clearance
    const IMD_HZ = toHz(0.0125);        // 12.5 kHz IMD avoidance window

    const candTxHz = toHz(cand.tx);
    const candRxHz = cand.rx > 0 ? toHz(cand.rx) : 0;

    // 1. GLOBAL CHECK ACROSS ALL ZONES (Co-Channel & Adjacent Channel are NEVER permitted)
    for (let i = 0; i < existingPlan.length; i++) {
        const other = existingPlan[i];
        const otherTxHz = toHz(other.tx);
        const otherRxHz = other.rx > 0 ? toHz(other.rx) : 0;

        // Candidate TX vs Other TX & RX
        if (cand.tx > 0) {
            if (Math.abs(candTxHz - otherTxHz) < ADJ_CHANNEL_HZ) return false;
            if (otherRxHz > 0 && Math.abs(candTxHz - otherRxHz) < ADJ_CHANNEL_HZ) return false;
        }

        // Candidate RX vs Other TX & RX
        if (candRxHz > 0) {
            if (Math.abs(candRxHz - otherTxHz) < ADJ_CHANNEL_HZ) return false;
            if (otherRxHz > 0 && Math.abs(candRxHz - otherRxHz) < ADJ_CHANNEL_HZ) return false;
        }
    }

    // Candidate self TX-RX spacing check
    if (cand.tx > 0 && candRxHz > 0 && Math.abs(candTxHz - candRxHz) < ADJ_CHANNEL_HZ) return false;

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
        pool.push(hz / 1000000);
    }
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool;
};

// Full Multi-Zone Coordinator supporting Custom Portable TX / RX Ranges & User Splits
export const coordinateAllZones = ({
    zones = [],
    zoneDistances = {},
    zoneOverrides = {},
    existingPlan = []
}) => {
    const plan = [...existingPlan];

    const isZoneCoupled = (zA, zB) => {
        if (zA === zB) return true;
        const key1 = `${zA}_${zB}`;
        const key2 = `${zB}_${zA}`;

        if (zoneOverrides[key1] !== undefined) return zoneOverrides[key1];
        if (zoneOverrides[key2] !== undefined) return zoneOverrides[key2];

        const dist = zoneDistances[key1] !== undefined ? zoneDistances[key1] : (zoneDistances[key2] !== undefined ? zoneDistances[key2] : 30);
        return dist < 26.0;
    };

    zones.forEach((zone) => {
        const zoneId = zone.id;
        const zoneName = zone.name || `Zone ${zoneId}`;

        // 1. DUPLEX BANDS FOR THIS ZONE (With Custom Portable TX Range / Split OR Dedicated Fixed Pairs)
        (zone.duplexBands || []).forEach((band, bandIndex) => {
            const targetCount = parseInt(band.pairCount) || 0;
            const bMin = parseFloat(band.txMin) || 450.0;
            const bMax = parseFloat(band.txMax) || 455.0;
            const bStep = (parseFloat(band.bw) || 12.5) / 1000;
            const bandId = band.id || `dup_${zoneId}_${bandIndex + 1}`;

            // Check if this band is one of the dedicated discrete UK bands (455/468 or 457/467)
            let discreteKey = null;
            if (band.discreteBand === 455 || (bMin >= 454.9 && bMax <= 455.5)) discreteKey = 455;
            else if (band.discreteBand === 457 || (bMin >= 457.0 && bMax <= 457.6)) discreteKey = 457;

            const existingInBand = plan.filter(p => p.zoneId === zoneId && !p.isSimplex && (p.bandId === bandId || (p.tx >= bMin && p.tx <= bMax)));
            let currentCount = existingInBand.length;

            if (targetCount > currentCount) {
                if (discreteKey && DISCRETE_TALKBACK_PAIRS[discreteKey]) {
                    // Draw candidate duplex pairs strictly from the dedicated discrete list
                    const discreteList = [...DISCRETE_TALKBACK_PAIRS[discreteKey]];
                    for (let i = discreteList.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [discreteList[i], discreteList[j]] = [discreteList[j], discreteList[i]];
                    }

                    for (let i = 0; i < discreteList.length; i++) {
                        if (currentCount >= targetCount) break;
                        const pair = discreteList[i];
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

                        if (checkCompatibility(candidate, plan, zoneId, isZoneCoupled)) {
                            plan.push(candidate);
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

                        let candRx = parseFloat((candTx + effectiveSep).toFixed(5));
                        const minAllowedRx = Math.min(rxMin, rxMax);
                        const maxAllowedRx = Math.max(rxMin, rxMax);

                        if (candRx < minAllowedRx || candRx > maxAllowedRx) {
                            candRx = rxPool[i % rxPool.length];
                        }

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

                        if (checkCompatibility(candidate, plan, zoneId, isZoneCoupled)) {
                            plan.push(candidate);
                            currentCount++;
                        }
                    }
                }
            }
        });

        // 2. BASE TX / IFB BANDS FOR THIS ZONE
        if (zone.enableBaseSimplex && (zone.baseSimplexBands || []).length > 0) {
            zone.baseSimplexBands.forEach((band, bandIndex) => {
                const targetCount = parseInt(band.count) || 0;
                const sMin = parseFloat(band.min) || 455.0;
                const sMax = parseFloat(band.max) || 460.0;
                const sStep = (parseFloat(band.bw) || 12.5) / 1000;
                const bandId = band.id || `ifb_${zoneId}_${bandIndex + 1}`;

                // Check for discrete 455 or 457 dedicated base frequencies
                let discreteSimplexKey = null;
                if (band.discreteBand === 455 || (sMin >= 454.9 && sMax <= 455.5)) discreteSimplexKey = 455;
                else if (band.discreteBand === 457 || (sMin >= 457.0 && sMax <= 457.6)) discreteSimplexKey = 457;

                const existingInBand = plan.filter(p => p.zoneId === zoneId && p.isSimplex && p.simplexType === 'base_tx' && (p.bandId === bandId || (p.tx >= sMin && p.tx <= sMax)));
                let currentCount = existingInBand.length;

                if (targetCount > currentCount) {
                    const pool = discreteSimplexKey && DISCRETE_TALKBACK_PAIRS[discreteSimplexKey]
                        ? Array.from(new Set(DISCRETE_TALKBACK_PAIRS[discreteSimplexKey].map(p => p.tx))).sort(() => Math.random() - 0.5)
                        : createShuffledPool(sMin, sMax, sStep);

                    for (let i = 0; i < pool.length; i++) {
                        if (currentCount >= targetCount) break;
                        const candFreq = pool[i];
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

                        if (checkCompatibility(candidate, plan, zoneId, isZoneCoupled)) {
                            plan.push(candidate);
                            currentCount++;
                        }
                    }
                }
            });
        }

        // 3. WALKIE-TALKIE / PTT BANDS FOR THIS ZONE
        if (zone.enableWalkieSimplex && (zone.walkieSimplexBands || []).length > 0) {
            zone.walkieSimplexBands.forEach((band, bandIndex) => {
                const targetCount = parseInt(band.count) || 0;
                const wMin = parseFloat(band.min) || 455.0;
                const wMax = parseFloat(band.max) || 460.0;
                const wStep = (parseFloat(band.bw) || 12.5) / 1000;
                const bandId = band.id || `wt_${zoneId}_${bandIndex + 1}`;

                // Check for discrete 468 or 467 dedicated portable frequencies
                let discreteWalkieKey = null;
                if (band.discreteBand === 468 || (wMin >= 468.0 && wMax <= 468.6)) discreteWalkieKey = 455;
                else if (band.discreteBand === 467 || (wMin >= 467.0 && wMax <= 467.6)) discreteWalkieKey = 457;

                const existingInBand = plan.filter(p => p.zoneId === zoneId && p.isSimplex && p.simplexType === 'walkie' && (p.bandId === bandId || (p.tx >= wMin && p.tx <= wMax)));
                let currentCount = existingInBand.length;

                if (targetCount > currentCount) {
                    const pool = discreteWalkieKey && DISCRETE_TALKBACK_PAIRS[discreteWalkieKey]
                        ? Array.from(new Set(DISCRETE_TALKBACK_PAIRS[discreteWalkieKey].map(p => p.rx))).sort(() => Math.random() - 0.5)
                        : createShuffledPool(wMin, wMax, wStep);

                    for (let i = 0; i < pool.length; i++) {
                        if (currentCount >= targetCount) break;
                        const candFreq = pool[i];
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

                        if (checkCompatibility(candidate, plan, zoneId, isZoneCoupled)) {
                            plan.push(candidate);
                            currentCount++;
                        }
                    }
                }
            });
        }
    });

    return plan.sort((a, b) => {
        if (a.zoneId !== b.zoneId) return a.zoneId.localeCompare(b.zoneId);
        if (a.isSimplex === b.isSimplex) return a.tx - b.tx;
        return a.isSimplex ? 1 : -1;
    });
};

export default function RfMathRoute() {
    return null;
}
