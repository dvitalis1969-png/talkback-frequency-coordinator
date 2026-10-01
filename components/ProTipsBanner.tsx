import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
    Lightbulb, 
    X, 
    ChevronLeft, 
    ChevronRight, 
    Command, 
    Activity, 
    FileText, 
    Maximize2,
    ShieldCheck,
    Globe,
    Cpu,
    Tv,
    Calendar
} from 'lucide-react';

export interface Tip {
    id: string;
    icon: React.ReactNode;
    title: string;
    description: string;
}

export const TIPS: Tip[] = [
    {
        id: 'cmd-k',
        icon: <Command className="w-4 h-4 text-indigo-400" />,
        title: "Master the Command Palette",
        description: "Press Ctrl+K (or Cmd+K) anywhere to instantly jump between tools or toggle Sunlight Mode."
    },
    {
        id: 'schedule-import',
        icon: <Calendar className="w-4 h-4 text-pink-400" />,
        title: "AI Schedule Importer",
        description: "Drag stage running orders into the Festival tab. Our AI automatically extracts timings for coordination."
    },
    {
        id: 'community-network',
        icon: <Globe className="w-4 h-4 text-emerald-400" />,
        title: "The Community Network",
        description: "Real-time coordination: See other RF managers on-site, share frequencies, and chat instantly."
    },
    {
        id: 'tinysa-link',
        icon: <Cpu className="w-4 h-4 text-cyan-400" />,
        title: "TinySA Hardware Link",
        description: "Plug in a TinySA via USB to stream real-time spectral sweeps directly into the spectrum visualizers."
    },
    {
        id: 'tv-grid',
        icon: <Tv className="w-4 h-4 text-orange-400" />,
        title: "Quad-State TV Grid",
        description: "The White Space tool syncs with FCC/Ofcom databases to show active TV transmitters in your area."
    },
    {
        id: 'drag-spectral',
        icon: <Activity className="w-4 h-4 text-indigo-400" />,
        title: "Interactive Spectrum",
        description: "You can click and drag the frequency scale in the Spectrum tab to scroll through bands or pinch to zoom."
    },
    {
        id: 'reporting',
        icon: <FileText className="w-4 h-4 text-blue-400" />,
        title: "One-Click Reports",
        description: "Generate professional PDF frequency plans for your site documents directly from the Reporting tab."
    },
    {
        id: 'distance-matrix',
        icon: <Maximize2 className="w-4 h-4 text-amber-400" />,
        title: "Zonal Isolation",
        description: "Managing multiple stages? Use the Distance Matrix to automatically calculate IMD isolation requirements."
    },
    {
        id: 'privacy',
        icon: <ShieldCheck className="w-4 h-4 text-purple-400" />,
        title: "Privacy Controls",
        description: "Want to change your analytics settings? Press Ctrl+Shift+P to reset the privacy consent banner."
    }
];

interface ProTipsBannerProps {
    onViewAll: () => void;
}

const ProTipsBanner: React.FC<ProTipsBannerProps> = ({ onViewAll }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isVisible, setIsVisible] = useState(() => {
        // Only show if not dismissed in this session
        return sessionStorage.getItem('tips_dismissed') !== 'true';
    });
    const [isPaused, setIsPaused] = useState(false);

    useEffect(() => {
        if (!isVisible || isPaused) return;

        const timer = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % TIPS.length);
        }, 8000); // 8 seconds per tip

        return () => clearInterval(timer);
    }, [isVisible, isPaused]);

    const handleDismiss = () => {
        setIsVisible(false);
        sessionStorage.setItem('tips_dismissed', 'true');
    };

    const nextTip = () => setCurrentIndex((prev) => (prev + 1) % TIPS.length);
    const prevTip = () => setCurrentIndex((prev) => (prev - 1 + TIPS.length) % TIPS.length);

    if (!isVisible) return null;

    const currentTip = TIPS[currentIndex];

    return (
        <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="w-full bg-slate-900/50 border-b border-indigo-500/20 backdrop-blur-md overflow-hidden"
        >
            <div className="max-w-7xl mx-auto px-3 sm:px-4 h-12 flex items-center justify-between gap-2">
                <div 
                    className="flex items-center gap-3 flex-1 min-w-0"
                    onMouseEnter={() => setIsPaused(true)}
                    onMouseLeave={() => setIsPaused(false)}
                >
                    <button 
                        onClick={onViewAll}
                        className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded text-[9px] font-black text-indigo-400 uppercase tracking-widest whitespace-nowrap transition-colors"
                        title="View all tips"
                    >
                        <Lightbulb className="w-3 h-3" />
                        Pro Tip:
                    </button>

                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentTip.id}
                            initial={{ y: 10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: -10, opacity: 0 }}
                            className="flex items-center gap-3 flex-1 min-w-0"
                        >
                            <button 
                                onClick={onViewAll}
                                className="flex-shrink-0 cursor-pointer hover:scale-110 hover:brightness-125 transition-all outline-none"
                                title="View all tips"
                            >
                                {currentTip.icon}
                            </button>
                            <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                                <span className="font-bold text-slate-100 text-xs hidden md:inline whitespace-nowrap">
                                    {currentTip.title}:
                                </span>
                                <span className="text-slate-400 text-xs truncate">
                                    {currentTip.description}
                                </span>
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-0.5 bg-slate-950/50 rounded-sm p-0.5 border border-white/5">
                        <button 
                            onClick={prevTip}
                            className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
                        >
                            <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-[10px] font-mono text-slate-600 px-1">
                            {currentIndex + 1}/{TIPS.length}
                        </span>
                        <button 
                            onClick={nextTip}
                            className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
                        >
                            <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    <button 
                        onClick={handleDismiss}
                        className="p-1.5 text-slate-600 hover:text-rose-400 transition-colors"
                        title="Dismiss for this session"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </motion.div>
    );
};

export default ProTipsBanner;
