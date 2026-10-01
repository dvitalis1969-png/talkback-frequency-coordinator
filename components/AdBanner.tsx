import React from 'react';

interface AdBannerProps {
  onGoPro: () => void;
}

const AdBanner: React.FC<AdBannerProps> = ({ onGoPro }) => {
  return (
    <div className="w-full bg-slate-900 border border-slate-700/50 rounded-md p-2 flex flex-col sm:flex-row items-center justify-between gap-2 animate-in fade-in slide-in-from-bottom-4 my-4 shadow-sm border border-slate-700/50">
      <div className="flex items-center gap-2">
        <div className="w-12 h-12 bg-indigo-500/10 border border-indigo-500/30 rounded-sm flex items-center justify-center flex-shrink-0 text-indigo-400">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
        </div>
        <div>
          <h4 className="text-white font-bold text-sm">Need more frequencies & priority coordination?</h4>
          <p className="text-slate-400 text-xs mt-0.5">Upgrade to Pro to unlock unlimited frequencies, premium features, and an ad-free experience.</p>
        </div>
      </div>
      <button onClick={onGoPro} className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-widest rounded-sm flex-shrink-0 shadow-[0_0_15px_rgba(99,102,241,0.3)] transition-all">
        Go Pro
      </button>
    </div>
  );
};

export default AdBanner;
