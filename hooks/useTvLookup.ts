import { useState } from 'react';
import { TVChannelState } from '../types';

export const useTvLookup = (
    tvRegion: 'uk' | 'us',
    tvChannelStates: Record<string, TVChannelState>,
    setTvStates: (states: Record<string, TVChannelState> | ((prev: Record<string, TVChannelState>) => Record<string, TVChannelState>)) => void
) => {
    const [isLocating, setIsLocating] = useState(false);
    const [tvChannelErpData, setTvChannelErpData] = useState<Record<number, { maxErp: number, transmitterName: string, distance?: number }>>({});

    const handleLookup = async (lat: number, lng: number, offset: number = 0, env: 'indoor' | 'outdoor' = 'outdoor') => {
        setIsLocating(true);
        try {
            const response = await fetch(`/api/lookup/${tvRegion}-tv?lat=${lat}&lng=${lng}&offset=${offset}&env=${env}`);
            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || `Server returned ${response.status}`);
            }
            const data = await response.json();

            
            if (data && data.occupied) {
                setTvChannelErpData(data.occupied);
                
                setTvStates((prev) => {
                    const next: Record<string, TVChannelState> = { ...prev };
                    
                    Object.keys(data.occupied).forEach((ch: string) => {
                        // Only block if not already assigned to mics/iem
                        if (next[ch] !== 'mic-only' && next[ch] !== 'iem-only' && next[ch] !== 'both') {
                            next[ch] = 'blocked';
                        }
                    });
                    
                    return next;
                });
            }
        } catch (err: any) {
            console.error("Lookup error:", err);
            alert(err.message || "Failed to lookup TV transmitters for this location.");
        } finally {
            setIsLocating(false);
        }
    };

    return { handleLookup, isLocating, tvChannelErpData, setTvChannelErpData };
};
