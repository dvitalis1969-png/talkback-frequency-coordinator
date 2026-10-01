import { FestivalPlanningState, UnifiedFestivalState } from '../types';

export const migrateToUnifiedFestival = (oldState: FestivalPlanningState): UnifiedFestivalState => {
    return {
        numZones: oldState.numZones,
        zoneConfigs: oldState.zoneConfigs,
        distances: oldState.distances,
        siteMapState: oldState.siteMapState,
        compatibilityMatrix: oldState.compatibilityMatrix,
        constantSystems: oldState.constantSystems,
        houseSystems: oldState.houseSystems,
        days: [
            {
                id: 'day-1',
                name: 'Day 1',
                acts: oldState.acts,
                tvChannelStates: oldState.tvChannelStates
            }
        ]
    };
};
