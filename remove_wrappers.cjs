const fs = require('fs');
let content = fs.readFileSync('components/ZonalTalkbackTab.tsx', 'utf-8');

// 1. Remove wrapper around standard Qty (Duplex)
content = content.replace(
`                    {cfg.talkbackStrategy !== "subzones" && (
                      <div className="flex items-center gap-2">
                        <label className="text-[9px] text-slate-500 font-bold">
                          Qty (Duplex)
                        </label>`,
`                      <div className="flex items-center gap-2">
                        <label className="text-[9px] text-slate-500 font-bold">
                          Qty (Duplex)
                        </label>`
);
content = content.replace(
`                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between bg-slate-950/50 p-2 rounded-lg border border-white/5">`,
`                          </button>
                        </div>
                      </div>
                  </div>

                  <div className="flex items-center justify-between bg-slate-950/50 p-2 rounded-lg border border-white/5">`
);

// 2. Remove wrapper around Custom Target Pairs (line 2507)
content = content.replace(
`                        </div>
                        {cfg.talkbackStrategy !== "subzones" && (
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                                Target Pairs
                              </span>`,
`                        </div>
                          <div className="grid grid-cols-2 gap-4 mt-4">
                            <div>
                              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                                Target Pairs
                              </span>`
);

// We need to carefully remove the closing brace for that one... let's check what line it closes on.
