const fs = require('fs');
let code = fs.readFileSync('components/GeneratorTab.tsx', 'utf8');

const target = `  const handleGenerate = async () => {
    setIsLoading(true);`;

const replacement = `  const handleGenerate = async () => {
    // Check free limit
    if (!isPro(user)) {
      const totalRequested = requests.reduce((sum, req) => sum + parseInt(req.count || "0", 10), 0);
      if (totalRequested > 6) {
        toast.error("Free Plan Limit: Maximum of 6 frequencies can be generated at once. Please upgrade to Pro.");
        return;
      }
    }

    setIsLoading(true);`;

code = code.replace(target, replacement);
fs.writeFileSync('components/GeneratorTab.tsx', code);
