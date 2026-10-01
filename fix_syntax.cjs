const fs = require('fs');
let content = fs.readFileSync('components/ZonalTalkbackTab.tsx', 'utf-8');

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

fs.writeFileSync('components/ZonalTalkbackTab.tsx', content);
