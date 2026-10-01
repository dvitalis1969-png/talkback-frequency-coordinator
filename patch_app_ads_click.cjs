const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

const target = `{!isPro(user) && <AdBanner />}`;
const replacement = `{!isPro(user) && <AdBanner onGoPro={() => setIsAccountDashboardOpen(true)} />}`;
code = code.replace(target, replacement);

fs.writeFileSync('App.tsx', code);
