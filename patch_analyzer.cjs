const fs = require('fs');
let code = fs.readFileSync('components/AnalyzerTab.tsx', 'utf8');

const importTarget = `import { toast } from 'sonner';`;
const importReplacement = `import { toast } from 'sonner';\nimport { isPro } from '../src/lib/userUtils';`;
code = code.replace(importTarget, importReplacement);

const propsTarget = `    setTvRegion?: (region: 'uk' | 'us') => void;
}`;
const propsReplacement = `    setTvRegion?: (region: 'uk' | 'us') => void;
    user?: any;
}`;
code = code.replace(propsTarget, propsReplacement);

fs.writeFileSync('components/AnalyzerTab.tsx', code);
