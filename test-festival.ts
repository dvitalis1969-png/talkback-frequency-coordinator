import { ensureValidDate, generateFestivalPlan, checkCompatibility } from './services/rfService';

const fakeDb = {
    'shure-axient-digital': { type: 'mic', minFreq: 470, maxFreq: 480, tuningStep: 0.025, defaultThresholds: { fundamental: 0.35, twoTone: 0, threeTone: 0 } }
};

const acts = [
    { id: '1', actName: 'Act 1', stage: 'Main Stage', startTime: '2026-09-07T13:30', endTime: '2026-09-07T14:30', micRequests: [], iemRequests: [], frequencies: [{ id: 'f1', value: 470.000, type: 'mic', source: 'act', equipmentKey: 'shure-axient-digital', locked: true, _ignoreImdWithCandidate: false, _isConsecutive: false }] },
    { id: '2', actName: 'Act 2', stage: 'Main Stage', startTime: '2026-09-07T12:30', endTime: '2026-09-07T13:30', micRequests: [{ id: 'r2', equipmentKey: 'shure-axient-digital', count: 1 }], iemRequests: [], frequencies: [] }
];

const zoneConfigs = [{ id: 'z1', name: 'Main Stage', x: 0, y: 0 }];
const distances = [[0]];
const actIntermodMatrix = { '1': { '2': true }, '2': { '1': true } };

async function run() {
    const { results, report } = await generateFestivalPlan(
        acts as any, [], [], zoneConfigs as any, distances, 0, fakeDb as any, [], [[true]],
        undefined, undefined, null, {}, {}, 'uk', undefined, 'bottom-up', undefined, true, actIntermodMatrix
    );
    console.log(JSON.stringify(results.map(a => a.frequencies.map(f => f.value)), null, 2));
}

run();
