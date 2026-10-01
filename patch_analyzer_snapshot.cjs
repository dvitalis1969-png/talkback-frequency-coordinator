const fs = require('fs');
let code = fs.readFileSync('components/AnalyzerTab.tsx', 'utf8');

const target = `<button onClick={() => { setFrequencies(s.frequencies); setIsSnapshotModalOpen(false); }} className="px-3 py-1.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 rounded-lg text-[9px] font-black uppercase hover:bg-indigo-600 hover:text-white transition-all">Load</button>`;
const replacement = `<button onClick={() => { 
    if (!isPro(user) && s.frequencies.length > 6) {
        toast.error("Free Plan Limit: Maximum of 6 frequencies can be loaded from snapshots.");
        setFrequencies(s.frequencies.slice(0, 6));
    } else {
        setFrequencies(s.frequencies);
    }
    setIsSnapshotModalOpen(false); 
}} className="px-3 py-1.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 rounded-lg text-[9px] font-black uppercase hover:bg-indigo-600 hover:text-white transition-all">Load</button>`;

code = code.replace(target, replacement);
fs.writeFileSync('components/AnalyzerTab.tsx', code);
