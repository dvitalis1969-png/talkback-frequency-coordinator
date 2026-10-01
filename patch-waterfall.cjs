const fs = require('fs');

let content = fs.readFileSync('components/WaterfallTab.tsx', 'utf8');

// Add crosshair state
if (!content.includes('const [crosshair, setCrosshair]')) {
    content = content.replace(
        'const [isDragging, setIsDragging] = useState(false);',
        'const [isDragging, setIsDragging] = useState(false);\n    const [crosshair, setCrosshair] = useState<{ x: number, y: number, freq: number, pct: number } | null>(null);'
    );
}

// Update handleMouseMove
const hoverTooltipMatch = /const handleMouseMove = \(e: React\.MouseEvent\) => \{([\s\S]*?)setDragStart\(\{ x: e\.clientX, freq: dragStart\.freq \}\);\n    \};/m.exec(content);

if (hoverTooltipMatch) {
    const replacement = `const handleMouseMove = (e: React.MouseEvent) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const mouseFreq = range.min + (x / dimensions.width) * (range.max - range.min);
        const yPct = (y / rect.height) * 100;
        
        if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
            setCrosshair({ x, y, freq: mouseFreq, pct: yPct });
        } else {
            setCrosshair(null);
        }

        if (!isDragging) return;
        
        const deltaX = e.clientX - dragStart.x;
        const freqDelta = (deltaX / dimensions.width) * (range.max - range.min);
        
        setRange(prev => ({
            min: prev.min - freqDelta,
            max: prev.max - freqDelta
        }));
        setDragStart({ x: e.clientX, freq: dragStart.freq });
    };`;
        
    content = content.replace(hoverTooltipMatch[0], replacement);
}

// Ensure clear crosshair on mouse leave
content = content.replace(
    'const handleMouseUp = () => {\n        setIsDragging(false);\n    };',
    'const handleMouseUp = () => {\n        setIsDragging(false);\n        setCrosshair(null);\n    };'
);

// We need to inject the crosshair divs in the return block, before the canvas, wrapping the flex-col div in relative.
const returnBlock = `<div className="flex flex-col">`;
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
`;
content = content.replace(returnBlock, crosshairDivs);

// And we need to remove onMouseMove from canvas
content = content.replace(/onMouseMove=\{handleMouseMove\}/g, '');

fs.writeFileSync('components/WaterfallTab.tsx', content);
