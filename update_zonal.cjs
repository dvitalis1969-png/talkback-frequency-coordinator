const fs = require('fs');
let code = fs.readFileSync('components/ZonalTalkbackTab.tsx', 'utf8');

// Replace global "Target Pairs" with "Global Target Pairs"
code = code.replace(
  '<span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">\n                                Target Pairs\n                              </span>',
  '<span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">\n                                Global Target Pairs\n                              </span>'
);

// Add customPairCount to the customRange mapping
const replacement = `                              </div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 mt-2">
                            <div>
                              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                                Target Pairs
                              </span>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  value={cr.customPairCount || ''}
                                  onChange={(e) =>
                                    setTalkbackZoneConfigs((prev) =>
                                      prev.map((c, i) =>
                                        i === zIdx
                                          ? {
                                              ...c,
                                              customRanges: c.customRanges?.map((r, rIdx) =>
                                                rIdx === crIdx ? { ...r, customPairCount: parseInt(e.target.value) || 0 } : r
                                              ),
                                            }
                                          : c
                                      )
                                    )
                                  }
                                  className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-xs text-white font-mono outline-none"
                                  placeholder="Specific pairs..."
                                />
                              </div>
                            </div>
                          </div>
                        </div>`;

code = code.replace(
  /                              <\/div>\n                            <\/div>\n                          <\/div>\n                        <\/div>/g,
  replacement
);

fs.writeFileSync('components/ZonalTalkbackTab.tsx', code);
console.log('Done');
