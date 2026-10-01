import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { updateGAConsent } from '../src/lib/analytics';
import { ShieldCheck, X } from 'lucide-react';

const CookieBanner: React.FC = () => {
    const [consent, setConsent] = useLocalStorage<'granted' | 'denied' | null>('cookie_consent', null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Show banner after a short delay if no consent is stored
        if (consent === null) {
            const timer = setTimeout(() => setIsVisible(true), 1500);
            return () => clearTimeout(timer);
        } else {
            // Apply existing consent to GA
            updateGAConsent(consent === 'granted');
        }
    }, [consent]);

    const handleAccept = () => {
        setConsent('granted');
        updateGAConsent(true);
        setIsVisible(false);
    };

    const handleDecline = () => {
        setConsent('denied');
        updateGAConsent(false);
        setIsVisible(false);
    };

    // Allow resetting for testing
    (window as any).resetPrivacyConsent = () => {
        setConsent(null);
        setIsVisible(true);
        console.log("[Privacy] Consent Reset. Banner should reappear.");
    };

    return (
        <>
            <AnimatePresence>
                {isVisible && (
                    <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                    className="fixed bottom-6 left-6 right-6 md:left-auto md:max-w-md z-[9999]"
                >
                    <div className="bg-slate-900 border border-indigo-500/30 shadow-2xl shadow-indigo-500/10 rounded-md p-4 backdrop-blur-xl">
                        <div className="flex items-start gap-2">
                            <div className="p-2 bg-indigo-500/10 rounded-sm">
                                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-center mb-1">
                                    <h3 className="font-bold text-slate-100 text-sm">Privacy & Analytics</h3>
                                    <button 
                                        onClick={() => setIsVisible(false)}
                                        className="text-slate-500 hover:text-slate-300 transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                                <p className="text-slate-400 text-xs leading-relaxed mb-4">
                                    We use cookies to measure site traffic and improve the coordinator algorithms.
                                    Your data is anonymized.
                                </p>
                                <div className="flex gap-3">
                                    <button
                                        onClick={handleAccept}
                                        className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black uppercase tracking-widest py-2.5 rounded-sm transition-all"
                                    >
                                        Accept All
                                    </button>
                                    <button
                                        onClick={handleDecline}
                                        className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-black uppercase tracking-widest py-2.5 rounded-sm transition-all"
                                    >
                                        Decline
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
            </AnimatePresence>
        </>
    );
};

export default CookieBanner;
