const fs = require('fs');
let content = fs.readFileSync('components/ZonalTalkbackTab.tsx', 'utf-8');

content = content.replace(
`                    {cfg.talkbackStrategy !== "subzones" && (
                      <div className="flex items-center gap-2">`,
`                      <div className="flex items-center gap-2">`
);

content = content.replace(
`                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between bg-slate-950/50 p-2 rounded-lg border border-white/5">`,
`                        </div>
                      </div>
                  </div>

                  <div className="flex items-center justify-between bg-slate-950/50 p-2 rounded-lg border border-white/5">`
);

fs.writeFileSync('components/ZonalTalkbackTab.tsx', content);
