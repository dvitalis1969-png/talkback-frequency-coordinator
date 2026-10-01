const fs = require('fs');
let content = fs.readFileSync('components/ZonalTalkbackTab.tsx', 'utf-8');

content = content.replace(
`                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-800/50">`,
`                            </div>
                          </div>
                        </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800/50">`
);

fs.writeFileSync('components/ZonalTalkbackTab.tsx', content);
