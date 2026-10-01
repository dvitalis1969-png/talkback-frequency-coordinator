function suppress(scanData) {
    if (!scanData || scanData.length < 5) return scanData;
    const result = [...scanData].map(d => ({...d}));
    const n = result.length;
    
    const windowSize = 5;
    const halfWindow = Math.floor(windowSize / 2);
    const THRESHOLD_DB = 15.0; // Spikes > 15 dB above local median are suppressed
    
    for (let i = 0; i < n; i++) {
        const window = [];
        for (let j = Math.max(0, i - halfWindow); j <= Math.min(n - 1, i + halfWindow); j++) {
            if (j !== i) { 
                window.push(result[j].amp);
            }
        }
        
        window.sort((a, b) => a - b);
        const median = window[Math.floor(window.length / 2)];
        
        if (result[i].amp > median + THRESHOLD_DB) {
             result[i].amp = median + (Math.random() * 2 - 1); 
        }
    }
    return result;
}

const data = [];
for(let i=0; i<20; i++) {
    let amp = -100;
    if (i === 10 || i === 11) amp = -50; // 2-bin signal
    data.push({freq: i, amp: amp});
}
const out = suppress(data);
console.log(out.filter(d => d.amp > -60).length); // Should print 2 if not suppressed
