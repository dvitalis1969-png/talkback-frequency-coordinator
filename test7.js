function suppressRFExplorerSpurs(scanData) {
    if (!scanData || scanData.length < 5) return scanData;
    
    const result = [...scanData].map(d => ({...d}));
    const n = result.length;
    
    const stepSize = n > 1 ? (result[n - 1].freq - result[0].freq) / (n - 1) : 0.1;
    const BOUNDARY_TOLERANCE = Math.max(0.05, stepSize * 0.75);
    const SPIKE_THRESHOLD_DB = 15.0; 
    
    for (let i = 1; i < n - 1; i++) {
        const freq = result[i].freq;
        const rem = freq % 0.5;
        const distTo500kHz = Math.min(rem, 0.5 - rem);
        
        // Only aggressively suppress 1- and 2-bin spikes if they occur near an LO hop boundary (multiples of 500kHz)
        if (distTo500kHz < BOUNDARY_TOLERANCE) {
            
            // Check for 1-bin spike
            if (result[i].amp > result[i - 1].amp + SPIKE_THRESHOLD_DB &&
                result[i].amp > result[i + 1].amp + SPIKE_THRESHOLD_DB) {
                result[i].amp = ((result[i - 1].amp + result[i + 1].amp) / 2) + (Math.random() * 2 - 1);
                continue;
            }
            
            // Check for 2-bin spike
            if (i < n - 2) {
                // To be a 2-bin spike, both i and i+1 must be elevated above i-1 and i+2
                if (result[i].amp > result[i - 1].amp + SPIKE_THRESHOLD_DB &&
                    result[i + 1].amp > result[i + 2].amp + SPIKE_THRESHOLD_DB &&
                    // And they must not just be a gradual slope
                    result[i].amp > result[i + 2].amp + SPIKE_THRESHOLD_DB &&
                    result[i + 1].amp > result[i - 1].amp + SPIKE_THRESHOLD_DB) {
                    
                    const base = (result[i - 1].amp + result[i + 2].amp) / 2;
                    result[i].amp = base + (Math.random() * 2 - 1);
                    result[i + 1].amp = base + (Math.random() * 2 - 1);
                }
            }
        }
    }
    
    return result;
}

const data = [];
for(let i=0; i<112; i++) {
    const f = 470 + i * (80/111);
    let amp = -100;
    if (Math.abs(f - 484.5) < 0.5) amp = 0; // 1 bin
    if (Math.abs(f - 499.5) < 0.5) { data.push({freq: f, amp: 0}); continue; } // make it 2 bin
    data.push({freq: f, amp: amp});
}
const out = suppressRFExplorerSpurs(data);
console.log("Remaining spikes:", out.filter(d => d.amp > -50).length);
