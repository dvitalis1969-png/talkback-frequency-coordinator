const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

const importTarget = `import { initGA, logPageView } from './src/lib/analytics';`;
const importReplacement = `import { initGA, logPageView } from './src/lib/analytics';\nimport AdBanner from './components/AdBanner';`;
code = code.replace(importTarget, importReplacement);

const mainTarget = `<ErrorBoundary>
                        {activeApp === null ? (`;
const mainReplacement = `<ErrorBoundary>
                        {!isPro(user) && <AdBanner />}
                        {activeApp === null ? (`;
code = code.replace(mainTarget, mainReplacement);

fs.writeFileSync('App.tsx', code);
