function suppressRFExplorerSpurs(scanData) {
    if (!scanData || scanData.length < 5) return scanData;
    
    const result = [...scanData].map(d => ({...d}));
    const n = result.length;
    
    const stepSize = n > 1 ? (result[n - 1].freq - result[0].freq) / (n - 1) : 0.1;
    
    // Window must be wide enough to catch the spur.
    // At large spans (stepSize > 0.5), we must check a wider distance because the point 
    // closest to the spur might be up to stepSize/2 away from the theoretical mathematical boundary.
    const BOUNDARY_TOLERANCE = Math.max(0.05, stepSize * 0.6);
    
    const windowSize = 5;
    const halfWindow = Math.floor(windowSize / 2);
    
    for (let i = 0; i < n; i++) {
        const freq = result[i].freq;
        
        // RF Explorer fractional-N synthesizer generates strong internal LO spurs 
        // at multiples of 500 kHz (0.5 MHz), such as 15.0 MHz or 0.5 MHz intervals.
        const rem = freq % 0.5;
        const distTo500kHz = Math.min(rem, 0.5 - rem);
        
        const isNearBoundary = distTo500kHz < BOUNDARY_TOLERANCE;
        
        // Extract local window
        const window = [];
        for (let j = Math.max(0, i - halfWindow); j <= Math.min(n - 1, i + halfWindow); j++) {
            if (j !== i) { 
                window.push(result[j].amp);
            }
        }
        
        // Calculate local median
        window.sort((a, b) => a - b);
        const median = window[Math.floor(window.length / 2)];
        
        // If it's near a known 500kHz boundary spur location, we are highly aggressive (15 dB threshold)
        // If it's anywhere else, we only suppress if it's an absurdly massive 1-bin glitch (e.g. 30 dB)
        const threshold = isNearBoundary ? 15.0 : 30.0;
        
        if (result[i].amp > median + threshold) {
             // Only suppress if it's a 1-bin or 2-bin width spike. 
             // We don't want to suppress wide signals by accident.
             // (Our median window of 5 already ensures that if the signal is >2 bins, 
             // the median would be higher, naturally protecting wide signals).
             result[i].amp = median + (Math.random() * 2 - 1); 
        }
    }
    
    return result;
}

const data = [];
for(let i=0; i<112; i++) {
    const f = 470 + i * (80/111);
    let amp = -100;
    if (Math.abs(f - 484.5) < 0.5) amp = 0; 
    data.push({freq: f, amp: amp});
}
const out = suppressRFExplorerSpurs(data);
console.log("Remaining spikes > -50 dBm:", out.filter(d => d.amp > -50).length);
