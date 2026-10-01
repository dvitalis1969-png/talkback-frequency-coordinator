const fs = require('fs');
let content = fs.readFileSync('components/ZonalTalkbackTab.tsx', 'utf-8');

content = content.replace(
`                            </div>
                            {cfg.talkbackStrategy !== "subzones" && (
                              <div className="flex items-center mt-2 bg-slate-950 border border-slate-700 rounded overflow-hidden h-6 w-24">`,
`                            </div>
                              <div className="flex items-center mt-2 bg-slate-950 border border-slate-700 rounded overflow-hidden h-6 w-24">`
);

content = content.replace(
`                                </button>
                              </div>
                            )}
                          </div>
                          <div>
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                              Port Walkie Range
                            </span>`,
`                                </button>
                              </div>
                          </div>
                          <div>
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                              Port Walkie Range
                            </span>`
);

fs.writeFileSync('components/ZonalTalkbackTab.tsx', content);
