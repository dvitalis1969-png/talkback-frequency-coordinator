const fs = require('fs');
let content = fs.readFileSync('App.tsx', 'utf8');

const target = `{!focusMode && (<div className="relative top-0 z-[10000] w-full px-4 pt-6 bg-slate-950/40 backdrop-blur-md">
                        <Header`;
const replacement = `{!focusMode && (<div className="relative top-0 z-[10000] w-full px-4 pt-6 bg-slate-950/40 backdrop-blur-md">
                        <button 
                            onClick={() => setFocusMode(true)}
                            className="absolute top-8 right-8 p-1.5 bg-slate-800 hover:bg-indigo-600 text-slate-400 hover:text-white rounded border border-slate-700 shadow z-[10001] transition-all"
                            title="Enter Focus Mode (Full Screen)"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                        </button>
                        <Header`;

content = content.replace(target, replacement);
fs.writeFileSync('App.tsx', content);
