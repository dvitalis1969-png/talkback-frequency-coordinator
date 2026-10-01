import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { TIPS } from './ProTipsBanner';
import { X, Lightbulb } from 'lucide-react';
import Card, { CardTitle } from './Card';

interface ProTipsPageProps {
    onClose: () => void;
}

const ProTipsPage: React.FC<ProTipsPageProps> = ({ onClose }) => {
    // Escape key handling
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    return (
        <div className="flex flex-col w-full h-[calc(100vh-theme(spacing.16))] bg-slate-950 overflow-y-auto custom-scrollbar relative z-10 px-3 sm:px-4 lg:px-8 py-8">
            <div className="max-w-4xl mx-auto w-full">
                
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-black text-white flex items-center gap-3 tracking-tight">
                            <div className="p-3 bg-indigo-500/20 rounded-md border border-indigo-500/30">
                                <Lightbulb className="w-8 h-8 text-indigo-400" />
                            </div>
                            Pro Tips & Features
                        </h1>
                        <p className="text-slate-400 mt-2 ml-[60px] max-w-2xl text-sm">
                            Make the most of the RF Suite with these advanced features and hidden shortcuts designed for professional coordination.
                        </p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-3 bg-slate-900 border border-white/10 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        title="Close (Esc)"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {TIPS.map((tip, idx) => (
                        <motion.div
                            key={tip.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                        >
                            <Card className="h-full flex flex-col hover:border-indigo-500/50 hover:bg-slate-900 transition-all cursor-default !p-2 !border-white/5">
                                <div className="flex items-start gap-2 mb-2">
                                    <div className="w-10 h-10 rounded-sm bg-slate-950 flex items-center justify-center border border-white/5 shrink-0 shadow-inner">
                                        {tip.icon}
                                    </div>
                                    <h3 className="text-sm font-bold text-slate-200 mt-2">
                                        {tip.title}
                                    </h3>
                                </div>
                                <p className="text-sm text-slate-400 leading-relaxed ml-14">
                                    {tip.description}
                                </p>
                            </Card>
                        </motion.div>
                    ))}
                </div>

                <div className="mt-12 text-center pt-8 border-t border-white/10">
                    <p className="text-xs text-slate-500 font-mono">
                        Tip: You can find this page again anytime by clicking the "Pro Tip" label in the banner or searching in the Command Palette (Ctrl+K).
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ProTipsPage;
