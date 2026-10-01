const fs = require('fs');
let content = fs.readFileSync('components/ZonalTalkbackTab.tsx', 'utf-8');

content = content.replace(
`                                </button>
                              </div>
                            )}
                          </div>
                          <div>
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                              Walkie Range
                            </span>`,
`                                </button>
                              </div>
                          </div>
                          <div>
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                              Walkie Range
                            </span>`
);

fs.writeFileSync('components/ZonalTalkbackTab.tsx', content);
