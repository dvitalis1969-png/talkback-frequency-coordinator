import { EquipmentProfile, CompatibilityLevel, WMASProfile } from './types.js';

export const WMAS_PRESET_PROFILES: WMASProfile[] = [
    // --- SENNHEISER SPECTERA SYSTEMS ---
    {
        id: 'sennheiser-spectera-8mhz',
        name: 'Sennheiser Spectera (8 MHz EU/UK)',
        manufacturer: 'Sennheiser',
        bandwidthMHz: 8.0,
        description: 'Full 8 MHz DTV channel wideband carrier. Bidirectional OFDM link architecture supporting up to 32 bidirectional high-fidelity links (or 64 in HD mode).',
        maskTemplate: {
            emissionBandwidthKHz: 8000,
            guardBandKHz: 200,
            spectralRollOffDbPerOctave: 40,
            outOfBandAttenuationDb: 45,
            description: 'ETSI EN 300 422-1 Clause 8.3.2 / ETSI EN 300 422-4 8 MHz WMAS Emission Mask with steep adjacent skirts.'
        },
        maxLinks: {
            'low-latency': 24,
            'standard': 32,
            'high-density': 64
        }
    },
    {
        id: 'sennheiser-spectera-6mhz',
        name: 'Sennheiser Spectera (6 MHz US)',
        manufacturer: 'Sennheiser',
        bandwidthMHz: 6.0,
        description: 'Full 6 MHz DTV channel wideband carrier compliant with FCC Part 74 Subpart H WMAS rules. Up to 32 bidirectional links (64 in HD mode).',
        maskTemplate: {
            emissionBandwidthKHz: 6000,
            guardBandKHz: 150,
            spectralRollOffDbPerOctave: 40,
            outOfBandAttenuationDb: 40,
            description: 'FCC Part 74.861(i) 6 MHz WMAS Spectral Emission Mask (-40 dBc attenuation at channel boundaries).'
        },
        maxLinks: {
            'low-latency': 16,
            'standard': 32,
            'high-density': 64
        }
    },

    // --- SHURE AXIENT DIGITAL WMAS SUB-BAND SYSTEMS ---
    {
        id: 'shure-wmas-800khz',
        name: 'Shure Axient Digital WMAS (800 kHz Sub-Band)',
        manufacturer: 'Shure',
        bandwidthMHz: 0.8,
        description: 'Targeted 800 kHz sub-band multi-carrier block. Fits inside narrow DTV guard intervals or sub-channel slices without claiming an entire 6/8 MHz TV channel.',
        maskTemplate: {
            emissionBandwidthKHz: 800,
            guardBandKHz: 50,
            spectralRollOffDbPerOctave: 35,
            outOfBandAttenuationDb: 50,
            description: 'Shure 800 kHz Sub-Band WMAS Mask with ultra-steep brickwall filtering (-50 dBc adjacent attenuation).'
        },
        maxLinks: {
            'low-latency': 4,
            'standard': 8,
            'high-density': 16
        }
    },
    {
        id: 'shure-wmas-1600khz',
        name: 'Shure Axient Digital WMAS (1.6 MHz Dual Sub-Band)',
        manufacturer: 'Shure',
        bandwidthMHz: 1.6,
        description: 'Dual-carrier 1.6 MHz aggregated sub-band cluster. Provides increased link density while preserving spectrum agility.',
        maskTemplate: {
            emissionBandwidthKHz: 1600,
            guardBandKHz: 75,
            spectralRollOffDbPerOctave: 35,
            outOfBandAttenuationDb: 50,
            description: 'Shure 1.6 MHz Dual Sub-Band WMAS Aggregation Emission Mask.'
        },
        maxLinks: {
            'low-latency': 8,
            'standard': 16,
            'high-density': 32
        }
    },

    // --- GENERIC WMAS PROFILES ---
    {
        id: 'generic-800khz',
        name: 'Generic WMAS (800 kHz Sub-Band)',
        manufacturer: 'Generic',
        bandwidthMHz: 0.8,
        description: 'Generic 800 kHz sub-band multi-carrier allocation.',
        maskTemplate: {
            emissionBandwidthKHz: 800,
            guardBandKHz: 50,
            description: 'Standard 800 kHz Sub-Band Emission Mask'
        },
        maxLinks: {
            'low-latency': 4,
            'standard': 8,
            'high-density': 16
        }
    },
    {
        id: 'generic-6mhz',
        name: 'Generic WMAS (6 MHz Block)',
        manufacturer: 'Generic',
        bandwidthMHz: 6.0,
        description: 'Generic 6 MHz wideband WMAS block.',
        maskTemplate: {
            emissionBandwidthKHz: 6000,
            guardBandKHz: 150,
            description: 'Generic 6 MHz Spectral Emission Mask'
        },
        maxLinks: {
            'low-latency': 16,
            'standard': 32,
            'high-density': 64
        }
    },
    {
        id: 'generic-8mhz',
        name: 'Generic WMAS (8 MHz Block)',
        manufacturer: 'Generic',
        bandwidthMHz: 8.0,
        description: 'Generic 8 MHz wideband WMAS block.',
        maskTemplate: {
            emissionBandwidthKHz: 8000,
            guardBandKHz: 200,
            description: 'Generic 8 MHz Spectral Emission Mask'
        },
        maxLinks: {
            'low-latency': 24,
            'standard': 48,
            'high-density': 96
        }
    }
];

export const US_TV_CHANNELS: Record<number, [number, number]> = {
    14: [470, 476], 15: [476, 482], 16: [482, 488], 17: [488, 494],
    18: [494, 500], 19: [500, 506], 20: [506, 512],
    21: [512, 518], 22: [518, 524], 23: [524, 530], 24: [530, 536],
    25: [536, 542], 26: [542, 548], 27: [548, 554], 28: [554, 560],
    29: [560, 566], 30: [566, 572], 31: [572, 578], 32: [578, 584],
    33: [584, 590], 34: [590, 596], 35: [596, 602], 36: [602, 608],
};

export const UK_TV_CHANNELS: Record<number, [number, number]> = {
    21: [470, 478], 22: [478, 486], 23: [486, 494], 24: [494, 502],
    25: [502, 510], 26: [510, 518], 27: [518, 526], 28: [526, 534],
    29: [534, 542], 30: [542, 550], 31: [550, 558], 32: [558, 566],
    33: [566, 574], 34: [574, 582], 35: [582, 590], 36: [590, 598],
    37: [598, 606], 38: [606.5, 613.5], 39: [614, 622], 40: [622, 630],
    41: [630, 638], 42: [638, 646], 43: [646, 654], 44: [654, 662],
    45: [662, 670], 46: [670, 678], 47: [678, 686], 48: [686, 694], 49: [694, 702]
};

/**
 * Resolves the accurate spectral mask bandwidth (in MHz) for WMAS systems:
 * - 800 kHz (0.8 MHz) for Shure Axient Digital 800 kHz sub-band and generic 800 kHz systems
 * - 1.6 MHz for Shure Axient Digital 1.6 MHz dual sub-band systems
 * - 6.0 MHz for 6 MHz wideband systems (US TV channels)
 * - 8.0 MHz for 8 MHz wideband systems (Sennheiser Spectera 8 MHz, Shure Axient Digital 8 MHz, UK/EU TV channels)
 */
export function getWmasBandwidth(freqOrData: any): number {
    if (!freqOrData) return 8.0;
    const key = (freqOrData.equipmentKey || freqOrData.profileId || '').toLowerCase();
    const label = (freqOrData.label || freqOrData.name || '').toLowerCase();
    const params = (freqOrData.generationParams || '').toLowerCase();

    // 800 kHz Sub-Band Detection
    if (
        key.includes('800khz') || key.includes('800k') || key.includes('0.8mhz') || key.includes('0.8') ||
        label.includes('800 khz') || label.includes('800khz') || label.includes('800 k') ||
        params.includes('800khz') || params.includes('800 khz') ||
        (key.includes('shure') && !key.includes('6mhz') && !key.includes('8mhz') && !key.includes('1600') && !key.includes('1.6'))
    ) {
        return 0.8;
    }

    // 1.6 MHz Dual Sub-Band Detection
    if (
        key.includes('1600khz') || key.includes('1600k') || key.includes('1.6mhz') || key.includes('1.6') ||
        label.includes('1.6 mhz') || label.includes('1.6mhz') || label.includes('1600 khz') || label.includes('1600khz') ||
        params.includes('1600khz') || params.includes('1.6mhz')
    ) {
        return 1.6;
    }

    // 6.0 MHz Wideband Detection (US 6 MHz TV Channel)
    if (
        key.includes('6mhz') || key.includes('6.0mhz') || key.includes('6m') ||
        label.includes('6 mhz') || label.includes('6mhz') ||
        params.includes('6mhz') || params.includes('6 mhz')
    ) {
        return 6.0;
    }

    // 8.0 MHz Wideband Systems (Sennheiser 8 MHz systems, Shure Axient Digital 8 MHz, Generic 8 MHz)
    if (
        key.includes('8mhz') || key.includes('8.0mhz') || key.includes('8m') ||
        key.includes('spectera') ||
        label.includes('8 mhz') || label.includes('8mhz') || label.includes('spectera') ||
        params.includes('8mhz') || params.includes('8 mhz')
    ) {
        return 8.0;
    }

    // Check manual thresholds or fundamental threshold if present
    if (freqOrData.manualThresholds?.fundamental) {
        const fThresh = freqOrData.manualThresholds.fundamental;
        if (fThresh <= 0.85 && fThresh >= 0.35) return 0.8;
        if (fThresh <= 1.8 && fThresh > 0.85) return 1.6;
        if (fThresh <= 3.5 && fThresh > 1.8) return 6.0;
        if (fThresh >= 3.8) return 8.0;
    }

    return 8.0;
}

/**
 * --- YOUR PERMANENT INVENTORY (HARDCODED) ---
 */
export const USER_INVENTORY: Record<string, EquipmentProfile> = {
    'my-bespoke-mic-1': { 
        name: 'My Custom Mic Rack', 
        band: '470-608 MHz', 
        minFreq: 470.125, 
        maxFreq: 607.875, 
        tuningStep: 0.025, 
        type: 'mic', 
        isCustom: false,
        recommendedThresholds: { fundamental: 0.350, twoTone: 0.075, threeTone: 0.000 } 
    },
    'my-bespoke-iem-1': { 
        name: 'My Custom IEM Rack', 
        band: '606-698 MHz', 
        minFreq: 606.125, 
        maxFreq: 697.875, 
        tuningStep: 0.025, 
        type: 'iem', 
        isCustom: false,
        recommendedThresholds: { fundamental: 0.375, twoTone: 0.250, threeTone: 0.000 } 
    },
};

/**
 * STRICT REGULATORY BLOCKADES (Talkback/Comms Modules)
 * Includes band edge frequencies.
 */
export const TALKBACK_FORBIDDEN_RANGES_BY_COUNTRY: Record<string, { min: number, max: number }[]> = {
    'UK': [
        { min: 450.46875, max: 450.76875 },
        { min: 452.19375, max: 452.26875 },
        { min: 452.41875, max: 452.43125 },
        { min: 452.51875, max: 452.83125 },
        { min: 465.48125, max: 466.14375 },
        { min: 466.20625, max: 466.33125 },
        { min: 466.44375, max: 466.56875 },
        { min: 466.69375, max: 466.73125 },
        { min: 455.99374, max: 455.99376 },
        { min: 455.01874, max: 455.01876 },
        { min: 455.20624, max: 455.20626 },
        { min: 455.24374, max: 455.24376 },
        { min: 455.26874, max: 455.26876 },
        { min: 455.40624, max: 455.40626 },
        { min: 455.44374, max: 455.44376 },
        { min: 455.43124, max: 455.43126 }
    ],
    'USA': [
        { min: 401.0, max: 406.0 },     // MedRadio & Meteorological
        { min: 406.0, max: 406.1 },     // EPIRB (Safety of Life)
        { min: 420.0, max: 450.0 }      // Amateur/Federal
    ],
    'Other': []
};

export const TALKBACK_DEFINITIONS: Record<number, { min: number, max: number }> = {
    425: { min: 425.31875, max: 425.55625 },
    427: { min: 427.76875, max: 428.00625 },
    442: { min: 442.26875, max: 442.50625 },
    446: { min: 446.43125, max: 446.99375 },
    447: { min: 447.00625, max: 447.50625 },
    450: { min: 450.20625, max: 450.99375 },
    451: { min: 451.00625, max: 451.93125 },
    452: { min: 452.00625, max: 452.99325 },
    455: { min: 455.25625, max: 455.46875 },
    457: { min: 457.25625, max: 457.46875 },
    465: { min: 465.00625, max: 465.46875 },
    466: { min: 466.15625, max: 466.78125 },
    467: { min: 467.26875, max: 467.99325 },
    468: { min: 468.00625, max: 468.99325 },
    469: { min: 469.00625, max: 469.86875 }
};

export const TALKBACK_FIXED_PAIRS: Record<number, number> = { 455: 468, 457: 467 };

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

export const CABLE_LOSS_DATA: Record<string, {name: string, data: Record<number, number>}> = {
    'RG-58': { name: 'RG-58/U', data: { 100: 4.5, 400: 10.1, 1000: 18.1 } },
    'RG-8X': { name: 'RG-8X (Mini-8)', data: { 100: 3.0, 400: 6.6, 1000: 12.0 } },
    'RG-213': { name: 'RG-213/U', data: { 100: 2.5, 400: 2.5, 1000: 9.8 } },
    'LMR-240': { name: 'Times Microwave LMR-240', data: { 150: 4.7, 450: 8.3, 900: 11.9 } },
    'LMR-400': { name: 'Times Microwave LMR-400', data: { 150: 2.7, 450: 4.8, 900: 6.8 } },
    'LMR-600': { name: 'Times Microwave LMR-600', data: { 150: 1.8, 450: 3.2, 900: 4.5 } },
};

export const COMPATIBILITY_PROFILES: Record<CompatibilityLevel, { label: string; fundamental: number; twoTone: number; threeTone: number; fiveTone: number; sevenTone: number; advanced: boolean; }> = {
    standard: { label: 'Standard', fundamental: 1.0, twoTone: 1.0, threeTone: 1.0, fiveTone: 1.0, sevenTone: 1.0, advanced: false },
    aggressive: { label: 'Aggressive', fundamental: 0.75, twoTone: 0.75, threeTone: 0.75, fiveTone: 1.0, sevenTone: 1.0, advanced: false },
    robust: { label: 'Robust', fundamental: 1.5, twoTone: 1.25, threeTone: 1.25, fiveTone: 1.25, sevenTone: 1.25, advanced: true },
};

/**
 * MASTER AUTHORITATIVE EQUIPMENT DATABASE
 * Updated Axient Digital and D6000 to 200kHz (0.200) Fundamental for High Density.
 */
export const EQUIPMENT_DATABASE: Record<string, EquipmentProfile> = {
    'custom': { name: 'Custom Range', band: 'User-defined', minFreq: 470.125, maxFreq: 1163.875, tuningStep: 0.025, type: 'generic', recommendedThresholds: { fundamental: 0.350, twoTone: 0.075, threeTone: 0.050 } },
    
    ...USER_INVENTORY,

    // --- SHURE AXIENT DIGITAL MIC (Linear Digital) ---
    'shure-ad-g56': { 
        name: 'Shure Axient Digital', 
        band: 'G56 (470-636 MHz)', 
        minFreq: 470.125, 
        maxFreq: 635.875, 
        tuningStep: 0.025, 
        type: 'mic', 
        recommendedThresholds: { fundamental: 0.350, twoTone: 0.075, threeTone: 0.000 }
    },
    'shure-ad-g57': { name: 'Shure Axient Digital', band: 'G57 (470-616 MHz)', minFreq: 470.125, maxFreq: 615.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.350, twoTone: 0.075, threeTone: 0.000 } },
    'shure-ad-k55': { name: 'Shure Axient Digital', band: 'K55 (606-694 MHz)', minFreq: 606.125, maxFreq: 693.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.350, twoTone: 0.075, threeTone: 0.000 } },
    
    // --- SHURE UR4S / UHF-R (Analogue) ---
    'shure-ur4s-g1': { name: 'Shure UR4S (Analogue)', band: 'G1 (470-530 MHz)', minFreq: 470.125, maxFreq: 529.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.325, twoTone: 0.175, threeTone: 0.050 } },
    'shure-ur4s-k4e': { name: 'Shure UR4S (Analogue)', band: 'K4e (606-666 MHz)', minFreq: 606.125, maxFreq: 665.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.325, twoTone: 0.175, threeTone: 0.050 } },
    'shure-ur4s-h4': { name: 'Shure UR4S (Analogue)', band: 'H4 (518-578 MHz)', minFreq: 518.125, maxFreq: 577.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.325, twoTone: 0.175, threeTone: 0.050 } },
    'shure-ur4s-j5': { name: 'Shure UR4S (Analogue)', band: 'J5 (578-638 MHz)', minFreq: 578.125, maxFreq: 637.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.325, twoTone: 0.175, threeTone: 0.050 } },

    // --- SHURE ULX-D / QLX-D ---
    'shure-ulxd-g51': { name: 'Shure ULX-D', band: 'G51 (470-534 MHz)', minFreq: 470.125, maxFreq: 533.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.350, twoTone: 0.075, threeTone: 0.000 } },
    'shure-ulxd-k51': { name: 'Shure ULX-D', band: 'K51 (606-670 MHz)', minFreq: 606.125, maxFreq: 669.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.350, twoTone: 0.075, threeTone: 0.000 } },
    'shure-ulxd-l50': { name: 'Shure ULX-D', band: 'L50 (632-696 MHz)', minFreq: 632.125, maxFreq: 695.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.350, twoTone: 0.075, threeTone: 0.000 } },
    'shure-ulxd-h50': { name: 'Shure ULX-D', band: 'H50 (534-598 MHz)', minFreq: 534.125, maxFreq: 597.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.350, twoTone: 0.075, threeTone: 0.000 } },

    // --- SHURE PSM 1000 / 900 ---
    'shure-psm1000-g10': { 
        name: 'Shure PSM 1000', 
        band: 'G10 (470-542 MHz)', 
        minFreq: 470.125, 
        maxFreq: 541.875, 
        tuningStep: 0.025, 
        type: 'iem', 
        recommendedThresholds: { fundamental: 0.375, twoTone: 0.250, threeTone: 0.050 }
    },
    'shure-psm1000-g10E': { 
        name: 'Shure PSM 1000', 
        band: 'G10E (470-542 MHz)', 
        minFreq: 470.125, 
        maxFreq: 541.875, 
        tuningStep: 0.025, 
        type: 'iem', 
        recommendedThresholds: { fundamental: 0.375, twoTone: 0.250, threeTone: 0.050 }
    },
    'shure-psm1000-j8E': { name: 'Shure PSM 1000', band: 'J8E (554-626 MHz)', minFreq: 554.125, maxFreq: 625.875, tuningStep: 0.025, type: 'iem', recommendedThresholds: { fundamental: 0.375, twoTone: 0.250, threeTone: 0.050 } },
    'shure-psm1000-H22': { name: 'Shure PSM 1000', band: 'H22 (518-584 MHz)', minFreq: 518.125, maxFreq: 583.875, tuningStep: 0.025, type: 'iem', recommendedThresholds: { fundamental: 0.375, twoTone: 0.250, threeTone: 0.050 } },
    'shure-psm1000-k10E': { name: 'Shure PSM 1000', band: 'K10E (596-668 MHz)', minFreq: 596.125, maxFreq: 667.875, tuningStep: 0.025, type: 'iem', recommendedThresholds: { fundamental: 0.375, twoTone: 0.250, threeTone: 0.050 } },
    'shure-psm1000-l8': { name: 'Shure PSM 1000', band: 'L8 (626-698 MHz)', minFreq: 626.125, maxFreq: 697.875, tuningStep: 0.025, type: 'iem', recommendedThresholds: { fundamental: 0.375, twoTone: 0.250, threeTone: 0.050 } },
    'shure-psm1000-l9e': { name: 'Shure PSM 1000', band: 'L9E (670-742 MHz)', minFreq: 670.125, maxFreq: 741.875, tuningStep: 0.025, type: 'iem', recommendedThresholds: { fundamental: 0.350, twoTone: 0.250, threeTone: 0.050 } },
    'shure-psm900-l6E': { name: 'Shure PSM 900', band: 'L6E (656-692 MHz)', minFreq: 656.125, maxFreq: 691.875, tuningStep: 0.025, type: 'iem', recommendedThresholds: { fundamental: 0.375, twoTone: 0.275, threeTone: 0.050 } },
    'shure-adpsm-g56': { name: 'Shure Analog_FM', band: 'G56 (470-636 MHz)', minFreq: 470.125, maxFreq: 635.875, tuningStep: 0.025, type: 'iem', recommendedThresholds: { fundamental: 0.350, twoTone: 0.250, threeTone: 0.050 } },
    'shure-psm900-k1E': { name: 'Shure PSM 900', band: 'K1E (596-632 MHz)', minFreq: 596.125, maxFreq: 631.875, tuningStep: 0.025, type: 'iem', recommendedThresholds: { fundamental: 0.375, twoTone: 0.275, threeTone: 0.050 } },
    'shure-adtq g56': { name: 'Shure ADTQ Narrowband Analog G56', band: 'G56 (470-636 MHz)', minFreq: 470.275, maxFreq: 635.875, tuningStep: 0.025, type: 'iem', recommendedThresholds: { fundamental: 0.350, twoTone: 0.250, threeTone: 0.050 } },
    // --- SENNHEISER DIGITAL 6000/9000 ---
    'sennheiser-d6000-a1a4': { name: 'Sennheiser Digital 6000', band: 'A1-A4 (470-558 MHz)', minFreq: 470.2, maxFreq: 557.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.400, twoTone: 0.050, threeTone: 0.050 } },
    'sennheiser-d6000-a5a8': { name: 'Sennheiser Digital 6000', band: 'A5-A8 (550-638 MHz)', minFreq: 550.125, maxFreq: 637.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.400, twoTone: 0.050, threeTone: 0.050 } },
    'sennheiser-d9000': { name: 'Sennheiser Digital 9000', band: '470-798 MHz', minFreq: 470.125, maxFreq: 797.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.35, twoTone: 0.050, threeTone: 0.050 } },

    // --- SENNHEISER 2000 SERIES MICS ---
    'sennheiser-2000-aw': { name: 'Sennheiser 2000 series', band: 'Aw (516-558 MHz)', minFreq: 516.125, maxFreq: 557.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.375, twoTone: 0.125, threeTone: 0.125 } },
    'sennheiser-2000-bw': { name: 'Sennheiser 2000 series', band: 'Bw (626-668 MHz)', minFreq: 626.125, maxFreq: 667.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.375, twoTone: 0.125, threeTone: 0.125 } },
    'sennheiser-2000-gw': { name: 'Sennheiser 2000 series', band: 'Gw (558-626 MHz)', minFreq: 558.125, maxFreq: 625.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.375, twoTone: 0.125, threeTone: 0.125 } },

    // --- SENNHEISER 2000 SERIES IEM ---
    'sennheiser-2000iem-aw': { name: 'Sennheiser 2000 IEM', band: 'Aw (516-558 MHz)', minFreq: 516.125, maxFreq: 557.875, tuningStep: 0.025, type: 'iem', recommendedThresholds: { fundamental: 0.400, twoTone: 0.200, threeTone: 0.200 } },
    'sennheiser-2050iem-aw+': { name: 'Sennheiser 2050 IEM', band: 'Aw+ (470-558 MHz)', minFreq: 470.125, maxFreq: 557.875, tuningStep: 0.025, type: 'iem', recommendedThresholds: { fundamental: 0.400, twoTone: 0.200, threeTone: 0.200 } },
    'sennheiser-2000iem-bw': { name: 'Sennheiser 2000 IEM', band: 'Bw (626-668 MHz)', minFreq: 626.125, maxFreq: 667.875, tuningStep: 0.025, type: 'iem', recommendedThresholds: { fundamental: 0.400, twoTone: 0.200, threeTone: 0.200 } },
    'sennheiser-2000iem-gw': { name: 'Sennheiser 2000 IEM', band: 'Gw (558-626 MHz)', minFreq: 558.125, maxFreq: 625.875, tuningStep: 0.025, type: 'iem', recommendedThresholds: { fundamental: 0.400, twoTone: 0.200, threeTone: 0.200 } },

    // --- SENNHEISER EW-G4 ---
    'sennheiser-ewg4-gb': {  name: 'Sennheiser EW-G4', band: 'GB (606-648 MHz)', minFreq: 606.125, maxFreq: 647.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.375, twoTone: 0.125, threeTone: 0.125 } },
    'sennheiser-ewg4-gbw': { name: 'Sennheiser EW-G4', band: 'GBw (606-678 MHz)', minFreq: 606.125, maxFreq: 677.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.375, twoTone: 0.125, threeTone: 0.125} },
    'sennheiser-ewg4iem-gb': { name: 'Sennheiser EW-G4 IEM', band: 'GB (606-648 MHz)', minFreq: 606.125, maxFreq: 647.875, tuningStep: 0.025, type: 'iem', recommendedThresholds: { fundamental: 0.400, twoTone: 0.200, threeTone: 0.200 } },
    
    // --- SENNHEISER EW 300 G3 ---
    'sennheiser-ew300-g3mic-gb': { name: 'Sennheiser EW 300 G3 MIC', band: 'GB (606-648 MHz)', minFreq: 606.125, maxFreq: 647.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.375, twoTone: 0.125, threeTone: 0.125 } },
    'sennheiser-ew300-g3mic-g': { name: 'Sennheiser EW 300 G3 MIC', band: 'G (566-608 MHz)', minFreq: 566.125, maxFreq: 607.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.375, twoTone: 0.125, threeTone: 0.125 } },
    'sennheiser-ew300-g3mic-b': { name: 'Sennheiser EW 300 G3 MIC', band: 'B (626-668 MHz)', minFreq: 626.125, maxFreq: 667.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.375, twoTone: 0.125, threeTone: 0.125 } },
    'sennheiser-ew300-g3iem-g': { name: 'Sennheiser EW 300 G3 IEM', band: 'G (566-606 MHz)', minFreq: 566.125, maxFreq: 605.875, tuningStep: 0.025, type: 'iem', recommendedThresholds: { fundamental: 0.400, twoTone: 0.200, threeTone: 0.200 } },
    'sennheiser-ew300-g3iem-a': { name: 'Sennheiser EW 300 G3 IEM', band: 'A (516-558 MHz)', minFreq: 516.125, maxFreq: 557.875, tuningStep: 0.025, type: 'iem', recommendedThresholds: { fundamental: 0.400, twoTone: 0.200, threeTone: 0.200 } },
    'sennheiser-ew300-g3iem-b': { name: 'Sennheiser EW 300 G3 IEM', band: 'B (626-668 MHz)', minFreq: 626.125, maxFreq: 667.875, tuningStep: 0.025, type: 'iem', recommendedThresholds: { fundamental: 0.400, twoTone: 0.200, threeTone: 0.200 } },
    // --- LECTROSONICS (100 kHz / 0.1 MHz tuning steps) ---
    'lectro-dsqd-a1b1': { name: 'Lectrosonics D-Squared', band: 'A1B1 (470.1-607.9 MHz)', minFreq: 470.1, maxFreq: 607.9, tuningStep: 0.1, type: 'mic', recommendedThresholds: { fundamental: 0.400, twoTone: 0.150, threeTone: 0.050 } },
    'lectro-dsqd-b1c1': { name: 'Lectrosonics D-Squared', band: 'B1C1 (537.6-691.1 MHz)', minFreq: 537.6, maxFreq: 691.1, tuningStep: 0.1, type: 'mic', recommendedThresholds: { fundamental: 0.400, twoTone: 0.150, threeTone: 0.050 } },
    'lectro-venue-a1': { name: 'Lectrosonics Digital Hybrid', band: 'Block A1 (470.1-537.5 MHz)', minFreq: 470.1, maxFreq: 537.5, tuningStep: 0.1, type: 'mic', recommendedThresholds: { fundamental: 0.400, twoTone: 0.200, threeTone: 0.075 } },
    'lectro-venue-b1': { name: 'Lectrosonics Digital Hybrid', band: 'Block B1 (537.6-607.9 MHz)', minFreq: 537.6, maxFreq: 607.9, tuningStep: 0.1, type: 'mic', recommendedThresholds: { fundamental: 0.400, twoTone: 0.200, threeTone: 0.075 } },
    'lectro-venue-c1': { name: 'Lectrosonics Digital Hybrid', band: 'Block C1 (614.4-691.1 MHz)', minFreq: 614.4, maxFreq: 691.1, tuningStep: 0.1, type: 'mic', recommendedThresholds: { fundamental: 0.400, twoTone: 0.200, threeTone: 0.075 } },
    'lectro-venue-blk470': { name: 'Lectrosonics Venue', band: 'Blk 470 (470.1-495.6 MHz)', minFreq: 470.1, maxFreq: 495.6, tuningStep: 0.1, type: 'mic', recommendedThresholds: { fundamental: 0.400, twoTone: 0.250, threeTone: 0.100 } },
    'lectro-venue-blk19': { name: 'Lectrosonics Venue', band: 'Blk 19 (486.4-511.9 MHz)', minFreq: 486.4, maxFreq: 511.9, tuningStep: 0.1, type: 'mic', recommendedThresholds: { fundamental: 0.400, twoTone: 0.250, threeTone: 0.100 } },
    'lectro-venue-blk20': { name: 'Lectrosonics Venue', band: 'Blk 20 (512.0-537.5 MHz)', minFreq: 512.0, maxFreq: 537.5, tuningStep: 0.1, type: 'mic', recommendedThresholds: { fundamental: 0.400, twoTone: 0.250, threeTone: 0.100 } },
    'lectro-venue-blk21': { name: 'Lectrosonics Venue', band: 'Blk 21 (537.6-563.1 MHz)', minFreq: 537.6, maxFreq: 563.1, tuningStep: 0.1, type: 'mic', recommendedThresholds: { fundamental: 0.400, twoTone: 0.250, threeTone: 0.100 } },
    'lectro-venue-blk22': { name: 'Lectrosonics Venue', band: 'Blk 22 (563.2-588.7 MHz)', minFreq: 563.2, maxFreq: 588.7, tuningStep: 0.1, type: 'mic', recommendedThresholds: { fundamental: 0.400, twoTone: 0.250, threeTone: 0.100 } },
    'lectro-venue-blk23': { name: 'Lectrosonics Venue', band: 'Blk 23 (588.8-607.9 MHz)', minFreq: 588.8, maxFreq: 607.9, tuningStep: 0.1, type: 'mic', recommendedThresholds: { fundamental: 0.400, twoTone: 0.250, threeTone: 0.100 } },
    'lectro-venue-blk24': { name: 'Lectrosonics Venue', band: 'Blk 24 (614.4-639.9 MHz)', minFreq: 614.4, maxFreq: 639.9, tuningStep: 0.1, type: 'mic', recommendedThresholds: { fundamental: 0.400, twoTone: 0.250, threeTone: 0.100 } },
    'lectro-venue-blk25': { name: 'Lectrosonics Venue', band: 'Blk 25 (640.0-665.5 MHz)', minFreq: 640.0, maxFreq: 665.5, tuningStep: 0.1, type: 'mic', recommendedThresholds: { fundamental: 0.400, twoTone: 0.250, threeTone: 0.100 } },
    'lectro-venue-blk26': { name: 'Lectrosonics Venue', band: 'Blk 26 (665.6-691.1 MHz)', minFreq: 665.6, maxFreq: 691.1, tuningStep: 0.1, type: 'mic', recommendedThresholds: { fundamental: 0.400, twoTone: 0.250, threeTone: 0.100 } },
    'lectro-duet-m2t': { name: 'Lectrosonics Duet IEM', band: 'A1B1 (470.1-607.9 MHz)', minFreq: 470.1, maxFreq: 607.9, tuningStep: 0.1, type: 'iem', recommendedThresholds: { fundamental: 0.400, twoTone: 0.200, threeTone: 0.050 } },

    // --- WISYCOM ---
    'wisycom-mtk952-uhf (25k)': { name: 'Wisycom MTK952 (25k)', band: 'UHF (470-800 MHz)', minFreq: 470.125, maxFreq: 693.875, tuningStep: 0.025, type: 'iem', recommendedThresholds: { fundamental: 0.350, twoTone: 0.025, threeTone: 0.000 } },
    'wisycom-mtk952-uhf (5k)': { name: 'Wisycom MTK952 (5k)', band: 'UHF (470-800 MHz)', minFreq: 470.125, maxFreq: 693.875, tuningStep: 0.005, type: 'iem', recommendedThresholds: { fundamental: 0.350, twoTone: 0.025, threeTone: 0.000 } },
    'wisycom-mtk982-uhf (25k)': { name: 'Wisycom MTK982 (25k)', band: 'UHF (470-800 MHz)', minFreq: 470.125, maxFreq: 693.875, tuningStep: 0.025, type: 'iem', recommendedThresholds: { fundamental: 0.350, twoTone: 0.025, threeTone: 0.000 } },
    'wisycom-mtk982-uhf (5k)': { name: 'Wisycom MTK982 (5k)', band: 'UHF (470-800 MHz)', minFreq: 470.125, maxFreq: 693.875, tuningStep: 0.005, type: 'iem', recommendedThresholds: { fundamental: 0.350, twoTone: 0.025, threeTone: 0.000 } },
    'wisycom-mrk16-uhf': { name: 'Wisycom MRK16 / MTP60', band: 'UHF (470-800 MHz)', minFreq: 470.125, maxFreq: 693.875, tuningStep: 0.005, type: 'mic', recommendedThresholds: { fundamental: 0.400, twoTone: 0.150, threeTone: 0.075 } },
    'wisycom-mrk980-uhf': { name: 'Wisycom MRK980 / MTP61', band: 'UHF (470-800 MHz)', minFreq: 470.125, maxFreq: 693.875, tuningStep: 0.005, type: 'mic', recommendedThresholds: { fundamental: 0.400, twoTone: 0.150, threeTone: 0.075 } },

    // --- SENNHEISER EW-DX ---
    'sennheiser-ewdx-q19': { name: 'Sennheiser EW-DX', band: 'Q1-9 (470-550 MHz)', minFreq: 470.2, maxFreq: 549.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.50, twoTone: 0.025, threeTone: 0.000 } },
    'sennheiser-ewdx-r19': { name: 'Sennheiser EW-DX', band: 'R1-9 (520-607 MHz)', minFreq: 520.125, maxFreq: 607.8, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.50, twoTone: 0.025, threeTone: 0.000 } },
    'sennheiser-ewdx-s110': { name: 'Sennheiser EW-DX', band: 'S1-10 (606-694 MHz)', minFreq: 606.2, maxFreq: 693.8, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.50, twoTone: 0.025, threeTone: 0.000 } },

    // --- SHURE SLX-D ---
    'shure-slxd-g58': { name: 'Shure SLX-D', band: 'G58 (470-514 MHz)', minFreq: 470.125, maxFreq: 513.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.350, twoTone: 0.200, threeTone: 0.000 } },
    'shure-slxd-h55': { name: 'Shure SLX-D', band: 'H55 (514-558 MHz)', minFreq: 514.125, maxFreq: 557.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.350, twoTone: 0.200, threeTone: 0.000 } },
    'shure-slxd-j52': { name: 'Shure SLX-D', band: 'J52 (558-602 MHz)', minFreq: 558.125, maxFreq: 601.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.350, twoTone: 0.200, threeTone: 0.000 } },

    // --- SONY DWX ---
    'sony-dwx-tv2129': { name: 'Sony DWX Digital', band: 'TV21-29 (470-542 MHz)', minFreq: 470.125, maxFreq: 541.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.350, twoTone: 0.050, threeTone: 0.050 } },
    'sony-dwx-tv3040': { name: 'Sony DWX Digital', band: 'TV30-40 (542-608 MHz)', minFreq: 542.125, maxFreq: 607.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.350, twoTone: 0.050, threeTone: 0.050 } },

    // --- AUDIO-TECHNICA 5000 ---
    'at-5000-de1': { name: 'Audio-Technica 5000 Series', band: 'DE1 (470-590 MHz)', minFreq: 470.125, maxFreq: 589.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.400, twoTone: 0.200, threeTone: 0.075 } },
    'at-5000-ef1': { name: 'Audio-Technica 5000 Series', band: 'EF1 (580-700 MHz)', minFreq: 580.125, maxFreq: 693.875, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.400, twoTone: 0.200, threeTone: 0.075 } },

    // --- DME / ENG SPECIALIZED ---
    'DME - GENERIC': { name: 'DME GENERIC', band: 'DME Block (960-1164 MHz)', minFreq: 961.525, maxFreq: 1163.825, tuningStep: 0.025, type: 'mic', recommendedThresholds: { fundamental: 0.350, twoTone: 0.075, threeTone: 0.050 } },
    'lectro-941-eng': { name: 'Lectrosonics DME ENG', band: '941 Block (941.5-959.8 MHz)', minFreq: 941.5, maxFreq: 959.8, tuningStep: 0.1, type: 'mic', recommendedThresholds: { fundamental: 0.350, twoTone: 0.075, threeTone: 0.050 } },
    'wisycom-dme-940': { name: 'Wisycom DME Broadcast', band: '940-960 MHz', minFreq: 940.125, maxFreq: 959.875, tuningStep: 0.005, type: 'mic', recommendedThresholds: { fundamental: 0.350, twoTone: 0.050, threeTone: 0.050 } },

    // --- WMAS SYSTEMS (Wideband & Sub-Band) ---
    // configured as CENTER frequencies for correct symmetric protection
    'sennheiser-spectera-8mhz': { name: 'Sennheiser Spectera (8 MHz EU/UK)', band: 'UHF (470-694 MHz)', minFreq: 474, maxFreq: 690, tuningStep: 8, type: 'wmas', recommendedThresholds: { fundamental: 4.0, twoTone: 0, threeTone: 0 } },
    'sennheiser-spectera-6mhz': { name: 'Sennheiser Spectera (6 MHz US)', band: 'UHF (470-608 MHz)', minFreq: 473, maxFreq: 605, tuningStep: 6, type: 'wmas', recommendedThresholds: { fundamental: 3.0, twoTone: 0, threeTone: 0 } },
    'sennheiser-wmas-6mhz': { name: 'Sennheiser Spectera (6 MHz Block)', band: 'UHF (470-608 MHz)', minFreq: 473, maxFreq: 605, tuningStep: 6, type: 'wmas', recommendedThresholds: { fundamental: 3.0, twoTone: 0, threeTone: 0 } },
    'sennheiser-wmas-8mhz': { name: 'Sennheiser Spectera (8 MHz Block)', band: 'UHF (470-694 MHz)', minFreq: 474, maxFreq: 690, tuningStep: 8, type: 'wmas', recommendedThresholds: { fundamental: 4.0, twoTone: 0, threeTone: 0 } },
    'shure-wmas-800khz': { name: 'Shure Axient Digital WMAS (800 kHz Sub-Band)', band: 'UHF (470-636 MHz)', minFreq: 470.4, maxFreq: 635.6, tuningStep: 0.8, type: 'wmas', recommendedThresholds: { fundamental: 0.800, twoTone: 0.500, threeTone: 0 } },
    'shure-ad-wmas-800khz-g56': { name: 'Shure Axient Digital WMAS (800 kHz Sub-Band G56)', band: 'UHF (470-636 MHz)', minFreq: 470.4, maxFreq: 635.6, tuningStep: 0.8, type: 'wmas', recommendedThresholds: { fundamental: 0.800, twoTone: 0.500, threeTone: 0 } },
    'shure-wmas-1600khz': { name: 'Shure Axient Digital WMAS (1.6 MHz Dual Sub-Band)', band: 'UHF (470-636 MHz)', minFreq: 470.8, maxFreq: 635.2, tuningStep: 1.6, type: 'wmas', recommendedThresholds: { fundamental: 1.600, twoTone: 0.500, threeTone: 0 } },
    'shure-ad-wmas-1600khz-g56': { name: 'Shure Axient Digital WMAS (1.6 MHz Dual Sub-Band G56)', band: 'UHF (470-636 MHz)', minFreq: 470.8, maxFreq: 635.2, tuningStep: 1.6, type: 'wmas', recommendedThresholds: { fundamental: 1.600, twoTone: 0.500, threeTone: 0 } },
    'shure-ad-wmas-6mhz': { name: 'Shure Axient Digital WMAS (6 MHz Wideband)', band: 'UHF (470-636 MHz)', minFreq: 473, maxFreq: 633, tuningStep: 6, type: 'wmas', recommendedThresholds: { fundamental: 3.0, twoTone: 0, threeTone: 0 } },
    'shure-ad-wmas-8mhz': { name: 'Shure Axient Digital WMAS (8 MHz Wideband)', band: 'UHF (470-636 MHz)', minFreq: 474, maxFreq: 632, tuningStep: 8, type: 'wmas', recommendedThresholds: { fundamental: 4.0, twoTone: 0, threeTone: 0 } },
    'generic-wmas-800khz': { name: 'Generic WMAS (800 kHz Sub-Band)', band: 'UHF (470-694 MHz)', minFreq: 470.4, maxFreq: 693.6, tuningStep: 0.8, type: 'wmas', recommendedThresholds: { fundamental: 0.800, twoTone: 0.500, threeTone: 0 } },
    'generic-800khz': { name: 'Generic WMAS (800 kHz Sub-Band)', band: 'UHF (470-694 MHz)', minFreq: 470.4, maxFreq: 693.6, tuningStep: 0.8, type: 'wmas', recommendedThresholds: { fundamental: 0.800, twoTone: 0.500, threeTone: 0 } },
    'generic-wmas-6mhz': { name: 'Generic WMAS (6 MHz Block)', band: 'UHF (470-694 MHz)', minFreq: 473, maxFreq: 691, tuningStep: 6, type: 'wmas', recommendedThresholds: { fundamental: 3.0, twoTone: 0, threeTone: 0 } },
    'generic-6mhz': { name: 'Generic WMAS (6 MHz Block)', band: 'UHF (470-694 MHz)', minFreq: 473, maxFreq: 691, tuningStep: 6, type: 'wmas', recommendedThresholds: { fundamental: 3.0, twoTone: 0, threeTone: 0 } },
    'generic-wmas-8mhz': { name: 'Generic WMAS (8 MHz Block)', band: 'UHF (470-694 MHz)', minFreq: 474, maxFreq: 690, tuningStep: 8, type: 'wmas', recommendedThresholds: { fundamental: 4.0, twoTone: 0, threeTone: 0 } },
    'generic-8mhz': { name: 'Generic WMAS (8 MHz Block)', band: 'UHF (470-694 MHz)', minFreq: 474, maxFreq: 690, tuningStep: 8, type: 'wmas', recommendedThresholds: { fundamental: 4.0, twoTone: 0, threeTone: 0 } }
};

export const US_DTV_DATABASE: Record<string, number[]> = {
    "902": [21, 23, 25], "100": [22, 24, 26, 30], "606": [21, 27, 28, 32],
    "941": [21, 22, 24, 30], "303": [23, 25, 29, 33], "752": [21, 26, 28, 32]
};

export const UK_DTV_DATABASE: Record<string, number[]> = {
    "SW": [21, 22, 23, 25, 26, 28, 30], "M": [21, 24, 27, 31], "EH": [21, 23, 26, 30],
    "B": [23, 26, 29, 32], "G": [22, 25, 28, 31], "L": [21, 24, 27, 30]
};

export const UK_GRID_REF_DATABASE: Record<string, number[]> = {
    "TQ": [21, 22, 23, 25, 26, 28, 30], "SJ": [21, 24, 27, 31], "NT": [21, 23, 26, 30],
    "SP": [23, 26, 29, 32], "NS": [22, 25, 28, 31], "SD": [21, 24, 27, 30]
};