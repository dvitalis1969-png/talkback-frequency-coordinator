const fs = require('fs');
let content = fs.readFileSync('components/WaterfallTab.tsx', 'utf8');

// The crosshair got injected incorrectly into the Last Detected Peak div.
const wrongInjection = `<div className="flex flex-col relative"  onMouseLeave={() => setCrosshair(null)}>
                {crosshair && (
                    <>
                        <div className="absolute bg-blue-500/50 pointer-events-none" style={{ left: 0, right: 0, top: \`\${crosshair.y}px\`, height: '1px', zIndex: 50 }} />
                        <div className="absolute bg-blue-500/50 pointer-events-none" style={{ top: 0, bottom: 0, left: \`\${crosshair.x}px\`, width: '1px', zIndex: 50 }} />
                        <div className="absolute z-50 bg-slate-800 text-slate-200 font-mono text-[10px] p-1 rounded border border-slate-700 pointer-events-none whitespace-nowrap shadow-lg"
                             style={{ left: \`\${crosshair.x + 8}px\`, top: \`\${crosshair.y + 8}px\` }}>
                            {crosshair.freq.toFixed(3)} MHz
                        </div>
                    </>
                )}`;
content = content.replace(wrongInjection, '<div className="flex flex-col">');

// Now we want to replace the correct <div className="flex flex-col"> which is just before the mini-analyzer canvas
const correctTarget = `<div className="flex flex-col">
                <div className="relative mb-1">
                    <div className="absolute top-1 left-2 text-[8px] font-black text-slate-500 uppercase tracking-widest z-10 bg-slate-900/80 px-1 rounded">Live Spectrum Trace</div>`;

const crosshairDivs = `<div className="flex flex-col relative" onMouseMove={handleMouseMove} onMouseLeave={() => setCrosshair(null)}>
                {crosshair && (
                    <>
                        <div className="absolute bg-blue-500/50 pointer-events-none" style={{ left: 0, right: 0, top: \`\${crosshair.y}px\`, height: '1px', zIndex: 50 }} />
                        <div className="absolute bg-blue-500/50 pointer-events-none" style={{ top: 0, bottom: 0, left: \`\${crosshair.x}px\`, width: '1px', zIndex: 50 }} />
                        <div className="absolute z-50 bg-slate-800 text-slate-200 font-mono text-[10px] p-1 rounded border border-slate-700 pointer-events-none whitespace-nowrap shadow-lg"
                             style={{ left: \`\${crosshair.x + 8}px\`, top: \`\${crosshair.y + 8}px\` }}>
                            {crosshair.freq.toFixed(3)} MHz
                        </div>
                    </>
                )}
                <div className="relative mb-1">
                    <div className="absolute top-1 left-2 text-[8px] font-black text-slate-500 uppercase tracking-widest z-10 bg-slate-900/80 px-1 rounded">Live Spectrum Trace</div>`;

content = content.replace(correctTarget, crosshairDivs);

fs.writeFileSync('components/WaterfallTab.tsx', content);
