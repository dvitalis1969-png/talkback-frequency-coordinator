const fs = require('fs');
let content = fs.readFileSync('components/ZonalTalkbackTab.tsx', 'utf-8');

content = content.replace(
`                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>`,
`                            </div>
                          </div>
                      </div>
                    </div>
                  </div>`
);

content = content.replace(
`                    <div className="flex justify-between items-center mb-2">
                      <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        Simplex Frequencies
                      </h5>
                      {cfg.talkbackStrategy !== "subzones" && (
                        <div className="flex gap-4">
                          <div className="flex items-center gap-2">`,
`                    <div className="flex justify-between items-center mb-2">
                      <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        Simplex Frequencies
                      </h5>
                        <div className="flex gap-4">
                          <div className="flex items-center gap-2">`
);

fs.writeFileSync('components/ZonalTalkbackTab.tsx', content);
