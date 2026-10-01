function suppress(scanData) {
    if (!scanData || scanData.length < 5) return scanData;
    const result = [...scanData].map(d => ({...d}));
    const n = result.length;
    
    const THRESHOLD_DB = 15.0; 
    
    for (let i = 1; i < n - 1; i++) {
        // Only suppress if it's a strict 1-bin spike
        if (result[i].amp > result[i - 1].amp + THRESHOLD_DB &&
            result[i].amp > result[i + 1].amp + THRESHOLD_DB) {
             result[i].amp = ((result[i - 1].amp + result[i + 1].amp) / 2) + (Math.random() * 2 - 1); 
        }
    }
    return result;
}

const data = [];
for(let i=0; i<20; i++) {
    let amp = -100;
    if (i === 10 || i === 11) amp = -50; // 2-bin signal
    if (i === 15) amp = -50; // 1-bin spike
    data.push({freq: i, amp: amp});
}
const out = suppress(data);
console.log("2-bin present:", out[10].amp === -50 && out[11].amp === -50);
console.log("1-bin present:", out[15].amp === -50);
