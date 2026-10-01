const fs = require('fs');
let code = fs.readFileSync('components/AnalyzerTab.tsx', 'utf8');

const target = `    const addFrequency = () => {
        setFrequencies([...frequencies, { id: \`F\${frequencies.length + 1}\`, value: 0, label: '', locked: false, type: 'generic' }]);
    };`;

const replacement = `    const addFrequency = () => {
        if (!isPro(user) && frequencies.length >= 6) {
            toast.error("Free Plan Limit: Maximum of 6 frequencies can be analyzed. Please upgrade to Pro.");
            return;
        }
        setFrequencies([...frequencies, { id: \`F\${frequencies.length + 1}\`, value: 0, label: '', locked: false, type: 'generic' }]);
    };`;

code = code.replace(target, replacement);
fs.writeFileSync('components/AnalyzerTab.tsx', code);
