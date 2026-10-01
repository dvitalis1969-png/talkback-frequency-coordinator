import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';

interface LoadingStateProps {
    isOpen: boolean;
    progress?: number;
    status?: string;
    title?: string;
    onCancel?: () => void;
}

const LOADING_MESSAGES = [
    "Analyzing 3rd-order harmonics...",
    "Running Monte Carlo simulations...",
    "Applying spatial attenuation...",
    "Calculating intermodulation products...",
    "Evaluating Distance Matrix...",
    "Optimizing Signal-to-Noise Ratio...",
    "Finalizing clean spectrum..."
];

export const EngagingLoadingState: React.FC<LoadingStateProps> = ({ isOpen, progress = 0, status, title = "COORDINATING RF PLAN", onCancel }) => {
    const [messageIndex, setMessageIndex] = useState(0);

    useEffect(() => {
        if (!isOpen) return;
        const interval = setInterval(() => {
            setMessageIndex(prev => (prev + 1) % LOADING_MESSAGES.length);
        }, 2500);
        return () => clearInterval(interval);
    }, [isOpen]);

    const displayMessage = status || LOADING_MESSAGES[messageIndex];

    if (!isOpen) return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[9999999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2"
                >
                    <motion.div 
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        className="bg-slate-900 border border-indigo-500/30 rounded-3xl shadow-2xl shadow-indigo-500/20 w-full max-w-md p-8 flex flex-col items-center text-center relative overflow-hidden"
                    >
                        {/* Background techy grid */}
                        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)', backgroundSize: '20px 20px' }}></div>

                        <div className="relative z-10 w-full flex flex-col items-center">
                            <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-6 mx-auto"></div>
                            
                            <h3 className="text-lg font-semibold font-black uppercase tracking-widest text-white mb-2">{title}</h3>
                            
                            <div className="h-6 mb-6">
                                <AnimatePresence mode="wait">
                                    <motion.p 
                                        key={displayMessage}
                                        initial={{ opacity: 0, y: 5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -5 }}
                                        className="text-indigo-300 text-sm font-medium"
                                    >
                                        {displayMessage}
                                    </motion.p>
                                </AnimatePresence>
                            </div>

                            <div className="w-full bg-slate-950 rounded-full h-2 mb-2 overflow-hidden border border-white/5">
                                <motion.div 
                                    className="bg-gradient-to-r from-indigo-500 to-cyan-400 h-full rounded-full"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.max(5, progress)}%` }}
                                    transition={{ ease: "easeOut" }}
                                />
                            </div>
                            <div className="flex justify-between w-full text-[10px] font-black uppercase tracking-widest text-slate-500 mb-8">
                                <span>Progress</span>
                                <span>{Math.round(progress)}%</span>
                            </div>

                            {onCancel && (
                                <button 
                                    onClick={onCancel}
                                    className="w-full bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-500/50 transition-all font-black uppercase tracking-widest py-3 rounded-md text-[10px] flex items-center justify-center gap-2"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                    Exit Coordination
                                </button>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
};

interface SuccessStateProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    message?: string;
    stats?: { label: string; value: string | number }[];
    frequenciesFound?: number;
    frequenciesRequired?: number;
}

export const CelebratorySuccessState: React.FC<SuccessStateProps> = ({ 
    isOpen, 
    onClose, 
    title = "Plot Completed! 🚀", 
    message, 
    stats = [],
    frequenciesFound,
    frequenciesRequired
}) => {
    if (!isOpen) return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[9999999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2"
                >
                    <motion.div 
                        initial={{ scale: 0.8, opacity: 0, y: 30 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.8, opacity: 0, y: 30 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="bg-slate-900 border-2 border-emerald-500/40 rounded-3xl shadow-[0_0_50px_rgba(16,185,129,0.2)] w-full max-w-lg p-8 flex flex-col items-center text-center relative overflow-hidden"
                    >
                        {/* Confetti / Glow background */}
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-md bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none"></div>

                        <div className="relative z-10 w-full">
                            <motion.div 
                                initial={{ scale: 0 }}
                                animate={{ scale: 1, rotate: 360 }}
                                transition={{ type: "spring", damping: 15, stiffness: 200, delay: 0.1 }}
                                className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-slate-700/50 shadow-emerald-500/30"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            </motion.div>
                            
                            <h3 className="text-xl font-semibold font-black uppercase tracking-tight text-white mb-6">{title}</h3>
                            {message && (
                                <p className="text-emerald-100/70 text-sm mb-8 leading-relaxed max-w-sm mx-auto">{message}</p>
                            )}
                            
                            {stats.length > 0 && (
                                <div className="grid grid-cols-2 gap-3 mb-8 w-full">
                                    {stats.map((stat, i) => {
                                        const isColSpan2 = (stats.length === 3 && i === 0) || (stats.length % 2 !== 0 && i === stats.length - 1);
                                        return (
                                            <motion.div 
                                                key={i}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: 0.2 + (i * 0.1) }}
                                                className={`bg-black/30 border border-white/5 rounded-md p-2 flex flex-col items-center justify-center ${isColSpan2 ? "col-span-2" : ""}`}
                                            >
                                                <span className="text-3xl font-black text-emerald-400 mb-1">{stat.value}</span>
                                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{stat.label}</span>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            )}

                            <button 
                                onClick={onClose}
                                className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-black uppercase tracking-widest py-2 rounded-md transition-all active:scale-95 shadow-sm border border-slate-700/50 shadow-emerald-500/20"
                            >
                                View Coordination Plan
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
};
