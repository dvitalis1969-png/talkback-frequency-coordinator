const fs = require('fs');
let content = fs.readFileSync('components/ZonalTalkbackTab.tsx', 'utf-8');

const targetSection = `                            </div>
                          </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-800 pt-3 mt-3">`;

const replacement = `                            </div>
                          </div>
                      </div>
                      
                      {cfg.customRanges?.map((cr, crIdx) => (
                        <div key={cr.id} className="space-y-3 p-3 mt-2 bg-slate-950/30 rounded-lg border border-white/5 relative">
                          <button
                            onClick={() =>
                              setTalkbackZoneConfigs((prev) =>
                                prev.map((c, i) =>
                                  i === zIdx
                                    ? {
                                        ...c,
                                        customRanges: c.customRanges?.filter((_, rIdx) => rIdx !== crIdx),
                                      }
                                    : c
                                )
                              )
                            }
                            className="absolute top-2 right-2 text-rose-500 hover:text-rose-400"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                                Base Tx Range
                              </span>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  value={cr.txMin}
                                  onChange={(e) =>
                                    setTalkbackZoneConfigs((prev) =>
                                      prev.map((c, i) =>
                                        i === zIdx
                                          ? {
                                              ...c,
                                              customRanges: c.customRanges?.map((r, rIdx) =>
                                                rIdx === crIdx ? { ...r, txMin: parseFloat(e.target.value) || 0 } : r
                                              ),
                                            }
                                          : c
                                      )
                                    )
                                  }
                                  className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-xs text-white font-mono outline-none"
                                  placeholder="Min"
                                />
                                <span className="text-slate-500 font-bold">-</span>
                                <input
                                  type="number"
                                  value={cr.txMax}
                                  onChange={(e) =>
                                    setTalkbackZoneConfigs((prev) =>
                                      prev.map((c, i) =>
                                        i === zIdx
                                          ? {
                                              ...c,
                                              customRanges: c.customRanges?.map((r, rIdx) =>
                                                rIdx === crIdx ? { ...r, txMax: parseFloat(e.target.value) || 0 } : r
                                              ),
                                            }
                                          : c
                                      )
                                    )
                                  }
                                  className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-xs text-white font-mono outline-none"
                                  placeholder="Max"
                                />
                              </div>
                            </div>
                            <div>
                              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                                Port Rx Range
                              </span>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  value={cr.rxMin}
                                  onChange={(e) =>
                                    setTalkbackZoneConfigs((prev) =>
                                      prev.map((c, i) =>
                                        i === zIdx
                                          ? {
                                              ...c,
                                              customRanges: c.customRanges?.map((r, rIdx) =>
                                                rIdx === crIdx ? { ...r, rxMin: parseFloat(e.target.value) || 0 } : r
                                              ),
                                            }
                                          : c
                                      )
                                    )
                                  }
                                  className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-xs text-white font-mono outline-none"
                                  placeholder="Min"
                                />
                                <span className="text-slate-500 font-bold">-</span>
                                <input
                                  type="number"
                                  value={cr.rxMax}
                                  onChange={(e) =>
                                    setTalkbackZoneConfigs((prev) =>
                                      prev.map((c, i) =>
                                        i === zIdx
                                          ? {
                                              ...c,
                                              customRanges: c.customRanges?.map((r, rIdx) =>
                                                rIdx === crIdx ? { ...r, rxMax: parseFloat(e.target.value) || 0 } : r
                                              ),
                                            }
                                          : c
                                      )
                                    )
                                  }
                                  className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-xs text-white font-mono outline-none"
                                  placeholder="Max"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-slate-800 pt-3 mt-3">`;

content = content.replace(targetSection, replacement);

fs.writeFileSync('components/ZonalTalkbackTab.tsx', content);
console.log("Updated custom ranges loop");
