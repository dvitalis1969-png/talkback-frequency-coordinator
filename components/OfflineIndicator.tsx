import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Cloud, CloudOff, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showStatus, setShowStatus] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowStatus(true);
      setTimeout(() => setShowStatus(false), 3000);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setShowStatus(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="fixed bottom-4 left-4 z-[150] pointer-events-none">
      <AnimatePresence>
        {(showStatus || !isOnline) && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-2xl backdrop-blur-md pointer-events-auto ${
              isOnline 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
            }`}
          >
            {isOnline ? (
              <>
                <Wifi className="w-3.5 h-3.5" />
                <span className="text-[10px] font-black uppercase tracking-widest">System Online</span>
                <CheckCircle2 className="w-3 h-3 ml-1" />
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5" />
                <span className="text-[10px] font-black uppercase tracking-widest">Offline Mode</span>
                <AlertCircle className="w-3 h-3 ml-1 animate-pulse" />
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
