import React from 'react';
import { TabID, AppCategory } from '../types';

interface TabsProps {
    activeTab: TabID;
    setActiveTab: (tab: TabID) => void;
    activeApp: AppCategory | null;
}

export const tabConfig: { id: TabID; label: string; category: AppCategory; hidden?: boolean }[] = [
    // Calculator App
    { id: 'radioMicPlanner', label: 'Radio Mic & IEM Planner', category: 'calculator' },
    { id: 'generator', label: 'Frequency Generator', category: 'calculator' },
    { id: 'analyzer', label: 'Frequency Analyzer', category: 'calculator' },
    
    // Coordination App (Dashboard)
    { id: 'radioMicPlanner', label: 'Radio Mic & IEM Planner', category: 'coordination' },
    { id: 'festival', label: 'Festival Mode', category: 'coordination' },
    { id: 'multizone', label: 'Exhibition Mode', category: 'coordination' },
    { id: 'eventManagement', label: 'Unified Planner', category: 'coordination' },
    { id: 'festivalSiteMap', label: 'Festival Site Map', category: 'coordination' },
    { id: 'multizoneSiteMap', label: 'Exhibition Floor Plan', category: 'coordination' },
    { id: 'plotGallery', label: 'Plot Gallery', category: 'coordination' },
    { id: 'festivalTracker', label: 'Allocation Tracker', category: 'coordination', hidden: true },
    
    // Analysis App (Dashboard)
    { id: 'spectrum', label: 'Live Analyzer', category: 'analysis' },
    { id: 'glassScope', label: 'Glass Cockpit Scope', category: 'analysis' },
    { id: 'waterfall', label: 'Waterfall', category: 'analysis' },
    { id: 'frequencyForensics', label: 'Frequency Forensics', category: 'analysis' },
    { id: 'reporting', label: 'Reporting', category: 'analysis' },
    
    // Comms App (Dashboard)
    { id: 'talkback', label: 'Single Zone Talkback', category: 'comms' },
    { id: 'zonalTalkback', label: 'Multi-zone Talkback', category: 'comms' },
    { id: 'tetra', label: 'TETRA Systems', category: 'comms' },
    { id: 'capacityPlus', label: 'Capacity Plus', category: 'comms' },

    // Toolkit App (Pro Utilities)
    { id: 'whitespace', label: 'TV Channel Lookup', category: 'toolkit' },
    { id: 'powerConverter', label: 'Power Converter', category: 'toolkit' },

    // Training Lab / Sandbox
    { id: 'imdDemo', label: 'IMD Physics Playground', category: 'sandbox' },
    { id: 'interference', label: 'Co-Channel Lab', category: 'sandbox' },
    { id: 'proximitySimulator', label: 'Proximity Simulator', category: 'sandbox' },

    // Tour Planning App
    { id: 'tourPlanning', label: 'Tour Planning', category: 'tour' },

    // WMAS App
    { id: 'wmas', label: 'WMAS Coordination', category: 'wmas' },
];

const Tabs: React.FC<TabsProps> = ({ activeTab, setActiveTab, activeApp }) => {
    // Dynamically add a "How To Use" tab to the end of every category (except tvLookup)
    const visibleTabs = activeApp 
        ? [
            ...tabConfig.filter(t => t.category === activeApp && !t.hidden),
            ...(activeApp === 'tvLookup' ? [] : [{ id: 'userGuide' as TabID, label: 'How To Use', category: activeApp }])
          ]
        : tabConfig.filter(t => !t.hidden);

    return (
        <div className="flex bg-slate-950/60 backdrop-blur-2xl border border-white/10 rounded-md p-1.5 gap-1 shadow-2xl overflow-x-auto scrollbar-hide">
            {visibleTabs.map(({ id, label, category }, idx) => (
                <button
                    key={`${id}-${category}-${idx}`}
                    onClick={() => setActiveTab(id)}
                    className={`
                        flex-shrink-0 px-3 py-2.5 text-[10px] font-black rounded-md transition-all duration-300 
                        uppercase tracking-widest focus:outline-none whitespace-nowrap border
                        ${
                            activeTab === id
                                ? (id === 'userGuide' ? 'bg-emerald-600 border-emerald-400 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-indigo-600 border-indigo-400 text-white shadow-[0_0_15px_rgba(99,102,241,0.3)]')
                                : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/5'
                        }
                        ${id === 'userGuide' ? '!text-emerald-400 hover:!text-emerald-200' : ''}
                    `}
                >
                    {label}
                </button>
            ))}
        </div>
    );
};

export default Tabs;