const fs = require('fs');
let content = fs.readFileSync('App.tsx', 'utf8');

if (!content.includes('const [focusMode, setFocusMode] = useState(false);')) {
    content = content.replace(
        'const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);',
        'const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);\n    const [focusMode, setFocusMode] = useState(false);'
    );
}

// Hide header
const headerMatch = `<div className="relative top-0 z-[10000] w-full px-4 pt-6 bg-slate-950/40 backdrop-blur-md">`;
const headerReplacement = `{!focusMode && (<div className="relative top-0 z-[10000] w-full px-4 pt-6 bg-slate-950/40 backdrop-blur-md">`;

content = content.replace(headerMatch, headerReplacement);

const headerCloseMatch = `                            onSimulateScan={() => {
                                handleSimulateScan();
                                setActiveTab('spectrum');
                            }}
                        />
                    </div>`;
const headerCloseReplacement = `                            onSimulateScan={() => {
                                handleSimulateScan();
                                setActiveTab('spectrum');
                            }}
                        />
                    </div>)}`;

content = content.replace(headerCloseMatch, headerCloseReplacement);

// Remove padding for focus mode in main
content = content.replace(
    `<main className={\`flex-grow transition-all duration-500 \${isCommunityOpen ? 'lg:flex-1' : 'w-full'}\`}>`,
    `<main className={\`flex-grow transition-all duration-500 \${isCommunityOpen ? 'lg:flex-1' : 'w-full'} \${focusMode ? 'p-0' : 'px-4'}\`}>`
);

// Add the floating exit/enter focus mode button
const floatingButton = `{focusMode && (
    <button 
        onClick={() => setFocusMode(false)}
        className="fixed bottom-4 right-4 z-[99999] p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-2xl shadow-indigo-500/20 border border-indigo-400/50 transition-all group flex items-center gap-2"
        title="Exit Focus Mode"
    >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
        <span className="text-xs font-bold uppercase tracking-wider hidden group-hover:block pr-2">Exit Focus Mode</span>
    </button>
)}`;

const appEndMatch = `<CommandPalette 
                isOpen={isCommandPaletteOpen}`;
content = content.replace(appEndMatch, floatingButton + '\n' + appEndMatch);

fs.writeFileSync('App.tsx', content);
