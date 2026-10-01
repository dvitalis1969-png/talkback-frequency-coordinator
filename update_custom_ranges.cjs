const fs = require('fs');
let content = fs.readFileSync('components/ZonalTalkbackTab.tsx', 'utf-8');

const targetSection = `                    <div className="pt-2 border-t border-slate-800/50">
                      <h5 className="text-[9px] font-black text-indigo-300 uppercase tracking-widest mb-2">
                        Custom Range
                      </h5>
                      <div className="space-y-3 p-3 bg-slate-950/30 rounded-lg border border-white/5">`;

const replacement = `                    <div className="pt-2 border-t border-slate-800/50">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="text-[9px] font-black text-indigo-300 uppercase tracking-widest">
                          Custom Range
                        </h5>
                        <button
                          onClick={() =>
                            setTalkbackZoneConfigs((prev) =>
                              prev.map((c, i) =>
                                i === zIdx
                                  ? {
                                      ...c,
                                      customRanges: [
                                        ...(c.customRanges || []),
                                        {
                                          id: Math.random().toString(36).substring(2, 9),
                                          txMin: 450,
                                          txMax: 455,
                                          rxMin: 460,
                                          rxMax: 465,
                                        },
                                      ],
                                    }
                                  : c
                              )
                            )
                          }
                          className="flex items-center gap-1 text-[9px] font-bold text-indigo-400 hover:text-indigo-300"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                          </svg>
                          ADD RANGE
                        </button>
                      </div>
                      
                      <div className="space-y-3 p-3 bg-slate-950/30 rounded-lg border border-white/5">`;

content = content.replace(targetSection, replacement);

fs.writeFileSync('components/ZonalTalkbackTab.tsx', content);
console.log("Updated add button");
