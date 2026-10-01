const fs = require('fs');
let code = fs.readFileSync('components/AppLauncher.tsx', 'utf8');

const cardsStart = code.indexOf('<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 max-w-[1800px] w-full">');
const cardsEnd = code.indexOf('</div>', cardsStart);

if (cardsStart === -1 || cardsEnd === -1) {
  console.log("Could not find cards container");
  process.exit(1);
}

const newCardsBlock = `
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 max-w-[1800px] w-full">
                <AppCard 
                    title="Festival Coordination" 
                    description="Plan your mics, IEMs, and talkback frequencies for major events all on a single unified canvas."
                    colorClass="bg-rose-600"
                    borderClass="border-rose-600/20"
                    onClick={() => onSelectApp('eventManagement')}
                    isLocked={!pro}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
                />
                <AppCard 
                    title="Radio Talkback Coordination" 
                    description="Discrete duplex pair and Simplex calculations with high-power talkback IMD modelling."
                    colorClass="bg-emerald-500"
                    borderClass="border-emerald-500/20"
                    onClick={() => onSelectApp('comms')}
                    isLocked={!pro}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>}
                />
                <AppCard 
                    title="Multi-Zone Coordination" 
                    description="Coordinate multi-zone RF deployment across sporting events, exhibitions, and large venue installations."
                    colorClass="bg-purple-500"
                    borderClass="border-purple-500/20"
                    onClick={() => onSelectApp('multizone')}
                    isLocked={!pro}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>}
                />
                <AppCard 
                    title="Tour Planning" 
                    description="Coordinate fixed equipment racks across multiple locations with local TV white space awareness."
                    colorClass="bg-blue-500"
                    borderClass="border-blue-500/20"
                    onClick={() => onSelectApp('tour')}
                    isLocked={!pro}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-2 1 2-1zm3.968-3.047a10.031 10.031 0 01-4.477 2.548 4.885 4.885 0 00-1.513.658l-2.096 1.048a.51.51 0 01-.689-.23.51.51 0 01.23-.69l2.103-1.052a5.086 5.086 0 011.578-.68 9.037 9.037 0 004.42-2.513 4.666 4.666 0 00.614-2.75 4.35 4.35 0 00-.773-2.545 5.59 5.05 0 01-.512-1.88A3.993 3.993 0 0112 3a3.993 3.993 0 013.726 2.348c.19.456.365.923.512 1.88.316.817.58 1.673.773 2.545.193.87.205 1.794-.614 2.75a9.037 9.037 0 00-4.42 2.513 5.086 5.086 0 01-1.578.68l-2.103 1.052a.51.51 0 01-.69-.23.51.51 0 01.23-.689l2.096-1.048a4.885 4.885 0 001.513-.658 10.031 10.031 0 014.477-2.548" /></svg>}
                />
                <AppCard 
                    title="Real-Time Analysis" 
                    description="High-fidelity spectral visualization, waterfall displays, and scan data processing."
                    colorClass="bg-cyan-500"
                    borderClass="border-cyan-500/20"
                    onClick={() => onSelectApp('analysis')}
                    isLocked={!pro}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>}
                />
                <AppCard 
                    title="RF Calculator" 
                    description={pro ? "Standard coordination engine for intermod analysis and manual frequency entry." : "Basic coordination engine. Free limit: 6 frequencies. Upgrade to Pro for unlimited."}
                    colorClass="bg-indigo-500"
                    borderClass="border-indigo-500/20"
                    onClick={() => onSelectApp('calculator')}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>}
                />
                <AppCard 
                    title="TV Channel Lookup" 
                    description="Find TV channels occupied by DTV based on clearance criteria."
                    colorClass="bg-amber-500"
                    borderClass="border-amber-500/20"
                    onClick={() => onSelectApp('tvLookup')}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
                />
                <AppCard 
                    title="RF Toolkit" 
                    description="Calculators for the proximity simulator, co-channel lab, IMD physics, and frequency forensics."
                    colorClass="bg-slate-500"
                    borderClass="border-slate-500/20"
                    onClick={() => onSelectApp('toolkit')}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" /></svg>}
                />
                <AppCard 
                    title="Community Network and Chat" 
                    description="Activity feed, user profiles, and knowledge sharing across the RF Suite community."
                    colorClass="bg-emerald-500"
                    borderClass="border-emerald-500/20"
                    onClick={() => onSelectApp('network')}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
                />`;

// Need to find the end of the <div ...> for the cards correctly. 
// However, instead of finding '</div>', I can just use a regex to replace everything between the div and the next element.
const finalCode = code.substring(0, cardsStart) + newCardsBlock + '\n            </div>\n' + code.substring(code.indexOf('<div className="mt-16', cardsStart));
fs.writeFileSync('components/AppLauncher.tsx', finalCode);
