const fs = require('fs');
let code = fs.readFileSync('components/AnalyzerTab.tsx', 'utf8');

const target = `    const handleLoadFromFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const data = await importFromJson<{frequencies: Frequency[], thresholds: Thresholds, tvChannelStates?: Record<number, TVChannelState>}>(file);
            if (data.frequencies) setFrequencies(data.frequencies);`;

const replacement = `    const handleLoadFromFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const data = await importFromJson<{frequencies: Frequency[], thresholds: Thresholds, tvChannelStates?: Record<number, TVChannelState>}>(file);
            if (data.frequencies) {
                if (!isPro(user) && data.frequencies.length > 6) {
                    toast.error("Free Plan Limit: Maximum of 6 frequencies can be loaded. Please upgrade to Pro.");
                    setFrequencies(data.frequencies.slice(0, 6));
                } else {
                    setFrequencies(data.frequencies);
                }
            }`;

code = code.replace(target, replacement);
fs.writeFileSync('components/AnalyzerTab.tsx', code);
