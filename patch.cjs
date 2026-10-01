const fs = require('fs');

const filePath = 'components/FestivalTrackerTab.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Insert Component
const insertionMarker = "export default function FestivalTrackerTab({ festivalState, setFestivalState }: FestivalTrackerTabProps) {";

const componentCode = `const LiveSpectrumAnalyzer: React.FC<{ activeFrequencies: { freq: Frequency; actName: string; stage: string }[] }> = ({ activeFrequencies }) => {
    const canvasRef = React.useRef<HTMLCanvasElement>(null);

    React.useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        let time = 0;

        // Frequencies standard range for pro audio (UHF)
        const minFreq = 470;
        const maxFreq = 700;

        const render = () => {
            time += 0.05;
            const width = canvas.width;
            const height = canvas.height;

            // Clear with slight alpha to create persistence/trailing effect
            ctx.fillStyle = 'rgba(15, 23, 42, 0.4)'; // matches slate-950
            ctx.fillRect(0, 0, width, height);

            // Grid
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            // Vertical divisions every 50px
            for (let i = 0; i < width; i += 50) {
                ctx.moveTo(i, 0);
                ctx.lineTo(i, height);
            }
            // Horizontal divisions every 30px
            for (let i = 0; i < height; i += 30) {
                ctx.moveTo(0, i);
                ctx.lineTo(width, i);
            }
            ctx.stroke();

            // Render noise floor
            ctx.beginPath();
            ctx.moveTo(0, height);
            for (let x = 0; x < width; x += 3) {
                // noise ranges from 5 to 15 pixels high
                const noiseHeight = height - (Math.random() * 10 + 5);
                ctx.lineTo(x, noiseHeight);
            }
            ctx.lineTo(width, height);
            ctx.strokeStyle = 'rgba(71, 85, 105, 0.5)';
            ctx.stroke();

            // Render peaks
            activeFrequencies.forEach((item) => {
                const freqValue = item.freq.value;
                if (freqValue >= minFreq && freqValue <= maxFreq) {
                    const xPos = ((freqValue - minFreq) / (maxFreq - minFreq)) * width;
                    
                    // Jitter creates the "fuzzy" edge
                    const jitter = Math.random() * 8 - 4;
                    const peakHeight = height * 0.7; // 70% of canvas height
                    const finalY = height - peakHeight + jitter;

                    // Peak fill gradient
                    const gradient = ctx.createLinearGradient(xPos, finalY, xPos, height);
                    if (item.freq.type === 'iem') {
                        gradient.addColorStop(0, 'rgba(56, 189, 248, 0.8)'); // sky-400
                        gradient.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
                    } else {
                        gradient.addColorStop(0, 'rgba(99, 102, 241, 0.8)'); // indigo-500
                        gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');
                    }

                    ctx.beginPath();
                    ctx.moveTo(xPos - 15, height);
                    ctx.quadraticCurveTo(xPos - 5, height - 10, xPos, finalY);
                    ctx.quadraticCurveTo(xPos + 5, height - 10, xPos + 15, height);
                    
                    ctx.fillStyle = gradient;
                    ctx.fill();

                    // Outline stroke
                    ctx.strokeStyle = item.freq.type === 'iem' ? 'rgba(125, 211, 252, 0.9)' : 'rgba(129, 140, 248, 0.9)';
                    ctx.lineWidth = 1.5;
                    ctx.stroke();

                    // Frequency label on top of peak
                    const pulse = Math.sin(time + freqValue) * 3;
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                    ctx.font = 'bold 9px monospace';
                    ctx.textAlign = 'center';
                    ctx.fillText(\`\${freqValue.toFixed(2)}\`, xPos, finalY - 15 + pulse);
                }
            });

            animationFrameId = requestAnimationFrame(render);
        };

        render();

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [activeFrequencies]);

    return (
        <div className="w-full h-48 bg-slate-950 rounded-md overflow-hidden relative border border-white/10 shadow-inner">
            <canvas 
                ref={canvasRef} 
                width={800} 
                height={200} 
                className="w-full h-full block"
            />
            {/* Overlay Grid UI elements */}
            <div className="absolute top-0 left-0 w-full p-2 flex justify-between text-[9px] font-mono font-bold text-slate-500 pointer-events-none">
                <span>470 MHz</span>
                <span>585 MHz</span>
                <span>700 MHz</span>
            </div>
            <div className="absolute bottom-2 left-2 flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400">
                    <span className="w-2 h-2 rounded bg-indigo-500/80"></span> Mic/Inst
                </span>
                <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400">
                    <span className="w-2 h-2 rounded bg-sky-400/80"></span> IEM
                </span>
            </div>
        </div>
    );
};

export default function FestivalTrackerTab({ festivalState, setFestivalState }: FestivalTrackerTabProps) {`;

content = content.replace(insertionMarker, componentCode);

// Extract Simulation Clock & Slider
const clockStart = content.indexOf(`{/* Simulation Clock & Slider */}`);
const clockEndStr = `</Card>`;
const clockEnd = content.indexOf(clockEndStr, clockStart) + clockEndStr.length;

const clockCode = content.substring(clockStart, clockEnd);

// Replace original clock code with Spectrum Analyzer
const analyzerCode = `{/* Live Spectrum Analyzer (Replaces Coordinator Clock slot) */}
                            <Card className="!bg-slate-900/40 border-white/5 p-5 flex flex-col justify-between relative overflow-hidden w-full">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white">Live Spectrum Analyzer</h3>
                                        <p className="text-[9px] text-slate-500 uppercase tracking-widest font-extrabold mt-0.5">Dynamic RF Footprint Visualizer</p>
                                    </div>
                                    <div className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/25 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest text-rose-400 select-none">
                                        <Activity size={10} className="animate-pulse" /> Active Scan
                                    </div>
                                </div>
                                <LiveSpectrumAnalyzer activeFrequencies={activeFrequencies} />
                            </Card>`;

content = content.replace(clockCode, analyzerCode);

// Insert clockCode after Timeline block ends.
const targetTimelineEnd = `                        </div>
                    </Card>

                </div>

                {/* COLUMN 2: RIGHT ONE-THIRD PANEL`;

const insertClockReplacement = `                        </div>
                    </Card>

                    ${clockCode}

                </div>

                {/* COLUMN 2: RIGHT ONE-THIRD PANEL`;

content = content.replace(targetTimelineEnd, insertClockReplacement);

fs.writeFileSync(filePath, content);
console.log('Patched');
