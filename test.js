function suppress(scanData) {
    if (!scanData || scanData.length < 5) return scanData;
    const result = [...scanData].map(d => ({...d}));
    const n = result.length;
    
    const windowSize = 5;
    const halfWindow = Math.floor(windowSize / 2);
    const THRESHOLD_DB = 15.0; // Spikes > 15 dB above local median are suppressed
    
    for (let i = 0; i < n; i++) {
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
        
        // If current point is massively higher than the local median of its neighbors
        if (result[i].amp > median + THRESHOLD_DB) {
             result[i].amp = median + (Math.random() * 2 - 1); // add slight noise
        }
    }
    return result;
}

const data = [];
for(let i=0; i<112; i++) {
    const f = 470 + i * (80/111);
    let amp = -100;
    if (i === 20 || i === 41 || i === 62) amp = 0; // The spikes
    data.push({freq: f, amp: amp});
}
const out = suppress(data);
console.log(out.filter(d => d.amp > -50).length === 0 ? "SUCCESS" : "FAILED");
