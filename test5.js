function suppressRFExplorerSpurs(scanData) {
    if (!scanData || scanData.length < 5) return scanData;
    
    const result = [...scanData].map(d => ({...d}));
    const n = result.length;
    
    const stepSize = n > 1 ? (result[n - 1].freq - result[0].freq) / (n - 1) : 0.1;
    // Window must be wide enough to catch the spur if step size is large
    const SPUR_WIDTH = Math.max(0.05, stepSize * 0.75);
    
    const windowSize = 5;
    const halfWindow = Math.floor(windowSize / 2);
    const THRESHOLD_DB = 15.0; // Spikes > 15 dB above local median are suppressed
    
    for (let i = 0; i < n; i++) {
        const freq = result[i].freq;
        // Check distance to nearest 500 kHz (0.5 MHz) boundary
        const rem = freq % 0.5;
        const distTo500kHz = Math.min(rem, 0.5 - rem);
        
        // Also check distance to 10 MHz boundaries just in case (though 10 MHz is a multiple of 0.5 MHz)
        
        if (distTo500kHz < SPUR_WIDTH) {
            // Extract local window
            const window = [];
            for (let j = Math.max(0, i - halfWindow); j <= Math.min(n - 1, i + halfWindow); j++) {
                if (j !== i) { 
                    window.push(result[j].amp);
                }
            }
            
            // Calculate median
            window.sort((a, b) => a - b);
            const median = window[Math.floor(window.length / 2)];
            
            // If current point is significantly higher than the local median of its neighbors
            if (result[i].amp > median + THRESHOLD_DB) {
                 result[i].amp = median + (Math.random() * 2 - 1); 
            }
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
