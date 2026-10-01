const fs = require('fs');

let content = fs.readFileSync('components/SpectrumVisualizer.tsx', 'utf8');

// Add crosshair state
if (!content.includes('const [crosshair, setCrosshair]')) {
    content = content.replace(
        'const [tooltip, setTooltip] = useState<Tooltip | null>(null);',
        'const [tooltip, setTooltip] = useState<Tooltip | null>(null);\n    const [crosshair, setCrosshair] = useState<{ x: number, y: number, freq: number, amp: number } | null>(null);'
    );
}

// Let's use string replace for handleHoverTooltip
const hoverTooltipMatch = /const handleHoverTooltip = \(event: React\.PointerEvent<HTMLCanvasElement>\) => \{([\s\S]*?)const mouseFreq = range\.min \+ \(\(x - padding\.left\) \/ chartWidth\) \* \(range\.max - range\.min\);/m.exec(content);

if (hoverTooltipMatch) {
    const replacement = `const handleHoverTooltip = (event: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const padding = { top: 60, right: 15, bottom: 55, left: 45 };
        const chartWidth = canvas.width - padding.left - padding.right;
        const chartHeight = canvas.height - padding.top - padding.bottom;
        const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
        const scaleY = rect.height > 0 ? canvas.height / rect.height : 1;
        const x = (event.clientX - rect.left) * scaleX; 
        const y = (event.clientY - rect.top) * scaleY;
        const mouseFreq = range.min + ((x - padding.left) / chartWidth) * (range.max - range.min);
        
        const minDb = -110;
        const dbRange = 110;
        const mouseAmp = minDb + dbRange * (1 - (y - padding.top) / chartHeight);
        
        if (x >= padding.left && x <= canvas.width - padding.right && y >= padding.top && y <= canvas.height - padding.bottom) {
            setCrosshair({ x: (event.clientX - rect.left), y: (event.clientY - rect.top), freq: mouseFreq, amp: mouseAmp });
        } else {
            setCrosshair(null);
        }`;
        
    content = content.replace(hoverTooltipMatch[0], replacement);
}

// Ensure clear crosshair on mouse leave
content = content.replace(
    'const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {',
    'const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {\n        setCrosshair(null);'
);

// clear crosshair on mouse out/leave if we want
content = content.replace(
    'setTooltip(null);\n    };',
    'setTooltip(null);\n        setCrosshair(null);\n    };'
);

// We need to inject the crosshair divs in the return block, before the canvas.
const returnBlock = `<canvas \n                    ref={canvasRef}`;
const crosshairDivs = `
                {crosshair && (
                    <>
                        <div className="absolute bg-blue-500/50 pointer-events-none" style={{ left: 0, right: 0, top: \`\${crosshair.y}px\`, height: '1px', zIndex: 5 }} />
                        <div className="absolute bg-blue-500/50 pointer-events-none" style={{ top: 0, bottom: 0, left: \`\${crosshair.x}px\`, width: '1px', zIndex: 5 }} />
                        <div className="absolute z-10 bg-slate-800 text-slate-200 font-mono text-[10px] p-1 rounded border border-slate-700 pointer-events-none whitespace-nowrap shadow-lg"
                             style={{ left: \`\${crosshair.x + 8}px\`, top: \`\${crosshair.y + 8}px\` }}>
                            {crosshair.freq.toFixed(3)} MHz<br/>
                            {crosshair.amp.toFixed(1)} dBm
                        </div>
                    </>
                )}
                `;
content = content.replace(returnBlock, crosshairDivs + returnBlock);

fs.writeFileSync('components/SpectrumVisualizer.tsx', content);
