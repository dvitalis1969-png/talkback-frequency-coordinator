const fs = require('fs');
let code = fs.readFileSync('components/AnalyzerTab.tsx', 'utf8');

const target = `const AnalyzerTab: React.FC<AnalyzerTabProps> = ({ frequencies, setFrequencies, thresholds, setThresholds, scenes, snapshots = [], setSnapshots, scanData, tvChannelStates, setTvChannelStates, wmasState, tvRegion = 'uk', setTvRegion }) => {`;
const replacement = `const AnalyzerTab: React.FC<AnalyzerTabProps> = ({ frequencies, setFrequencies, thresholds, setThresholds, scenes, snapshots = [], setSnapshots, scanData, tvChannelStates, setTvChannelStates, wmasState, tvRegion = 'uk', setTvRegion, user }) => {`;

code = code.replace(target, replacement);
fs.writeFileSync('components/AnalyzerTab.tsx', code);
