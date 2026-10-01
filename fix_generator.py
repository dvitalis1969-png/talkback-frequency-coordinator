import re

with open('components/GeneratorTab.tsx', 'r') as f:
    content = f.read()

# Replace the "Parameters Unknown" checkbox section
old_checkbox = """                </div>
                <label className="flex items-center gap-3 cursor-pointer p-2 bg-green-500/10 rounded-lg border border-green-500/20 self-end sm:self-auto">
                  <input
                    type="checkbox"
                    checked={ignoreManualIMD}
                    onChange={(e) => setIgnoreManualIMD(e.target.checked)}
                    className="w-4 h-4 rounded accent-green-500"
                  />
                  <div className="flex flex-col">
                    <span className="text-white text-[10px] font-black uppercase tracking-tighter leading-none flex items-center">
                      Parameters Unknown
                      <InfoTooltip content="Check this if you don't know the exact equipment models for the existing frequencies. It will only calculate fundamental spacing, ignoring complex IMD products for these specific frequencies." />
                    </span>
                    <span className="text-[8px] text-white/70 font-bold uppercase mt-0.5">
                      Use Fundamental Spacing Only
                    </span>
                  </div>
                </label>
              </div>"""

new_checkbox = """                </div>
                <div className="flex flex-col sm:flex-row gap-2 self-end sm:self-auto bg-slate-900/80 p-1.5 rounded-lg border border-slate-700/50">
                  <label className={`flex items-center gap-2 cursor-pointer p-1.5 rounded border transition-colors ${ignoreManualIMD ? 'bg-indigo-500/20 border-indigo-500/50' : 'bg-transparent border-transparent hover:bg-white/5'}`}>
                    <input
                      type="radio"
                      name="siteConstraintMode"
                      checked={ignoreManualIMD}
                      onChange={() => setIgnoreManualIMD(true)}
                      className="w-3.5 h-3.5 accent-indigo-500"
                    />
                    <span className={`text-[10px] font-bold uppercase tracking-tighter leading-none ${ignoreManualIMD ? 'text-indigo-300' : 'text-slate-400'}`}>
                      Channel-Spaced Only
                    </span>
                  </label>
                  <label className={`flex items-center gap-2 cursor-pointer p-1.5 rounded border transition-colors ${!ignoreManualIMD ? 'bg-green-500/20 border-green-500/50' : 'bg-transparent border-transparent hover:bg-white/5'}`}>
                    <input
                      type="radio"
                      name="siteConstraintMode"
                      checked={!ignoreManualIMD}
                      onChange={() => setIgnoreManualIMD(false)}
                      className="w-3.5 h-3.5 accent-green-500"
                    />
                    <span className={`text-[10px] font-bold uppercase tracking-tighter leading-none ${!ignoreManualIMD ? 'text-green-300' : 'text-slate-400'}`}>
                      Intermodulation Free
                    </span>
                  </label>
                </div>
              </div>"""

content = content.replace(old_checkbox, new_checkbox)

# Replace the Site Protection Parameters UI section
old_params = """                <div
                  className={`grid grid-cols-3 gap-4 transition-opacity ${ignoreManualIMD ? "opacity-20 pointer-events-none" : "opacity-100"}`}
                >
                  <div className="flex flex-col">
                    <label className="text-[8px] text-slate-500 font-black uppercase tracking-tighter text-center mb-1">
                      Fundamental
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      value={siteThresholds.fundamental}
                      onChange={(e) =>
                        updateSiteThresholds("fundamental", e.target.value)
                      }
                      className="bg-slate-900 border border-indigo-500/30 rounded text-xs text-amber-300 text-center font-mono py-2"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-[8px] text-slate-500 font-black uppercase tracking-tighter text-center mb-1">
                      2-Tone IMD
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      value={siteThresholds.twoTone}
                      onChange={(e) =>
                        updateSiteThresholds("twoTone", e.target.value)
                      }
                      className="bg-slate-900 border border-indigo-500/30 rounded text-xs text-amber-300 text-center font-mono py-2"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-[8px] text-slate-500 font-black uppercase tracking-tighter text-center mb-1">
                      3-Tone IMD
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      value={siteThresholds.threeTone}
                      onChange={(e) =>
                        updateSiteThresholds("threeTone", e.target.value)
                      }
                      className="bg-slate-900 border border-indigo-500/30 rounded text-xs text-amber-300 text-center font-mono py-2"
                    />
                  </div>
                </div>"""

new_params = """                {ignoreManualIMD ? (
                  <div className="flex flex-col mb-4">
                    <label className="text-[10px] text-indigo-300 font-black uppercase tracking-widest mb-2 flex items-center gap-2">
                      Minimum Channel Spacing (MHz)
                      <InfoTooltip content="Set the minimum channel spacing required between the generated plan and the existing site frequencies. e.g., 0.350 for 350 kHz." />
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      value={siteThresholds.fundamental}
                      onChange={(e) =>
                        updateSiteThresholds("fundamental", e.target.value)
                      }
                      className="bg-slate-900 border border-indigo-500/50 rounded-lg text-sm text-amber-300 text-center font-mono py-3 font-bold w-full md:w-1/2"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="flex flex-col">
                      <label className="text-[8px] text-slate-500 font-black uppercase tracking-tighter text-center mb-1 flex justify-center items-center gap-1">
                        Fundamental <InfoTooltip content="Minimum spacing required between any two frequencies." />
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        value={siteThresholds.fundamental}
                        onChange={(e) =>
                          updateSiteThresholds("fundamental", e.target.value)
                        }
                        className="bg-slate-900 border border-green-500/30 rounded text-xs text-green-300 text-center font-mono py-2"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[8px] text-slate-500 font-black uppercase tracking-tighter text-center mb-1">
                        2-Tone IMD
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        value={siteThresholds.twoTone}
                        onChange={(e) =>
                          updateSiteThresholds("twoTone", e.target.value)
                        }
                        className="bg-slate-900 border border-green-500/30 rounded text-xs text-green-300 text-center font-mono py-2"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[8px] text-slate-500 font-black uppercase tracking-tighter text-center mb-1">
                        3-Tone IMD
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        value={siteThresholds.threeTone}
                        onChange={(e) =>
                          updateSiteThresholds("threeTone", e.target.value)
                        }
                        className="bg-slate-900 border border-green-500/30 rounded text-xs text-green-300 text-center font-mono py-2"
                      />
                    </div>
                  </div>
                )}"""

content = content.replace(old_params, new_params)

with open('components/GeneratorTab.tsx', 'w') as f:
    f.write(content)

