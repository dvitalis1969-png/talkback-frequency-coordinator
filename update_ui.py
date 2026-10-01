import re

with open('components/GeneratorTab.tsx', 'r') as f:
    content = f.read()

# 1. Remove radio buttons from Existing Site Frequencies header
old_header = """                </div>
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

new_header = """                </div>
              </div>"""

content = content.replace(old_header, new_header)

# 2. Add radio buttons into Site Protection Parameters
old_site_params = """              <div className="p-4 bg-slate-950/50 border border-white/5 rounded-2xl mb-4">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center">
                    Site Protection Parameters
                    <InfoTooltip content="Set the minimum frequency spacing required between the generated plan and the existing site frequencies." />
                  </span>
                  {ignoreManualIMD && (
                    <span className="text-[8px] text-green-400 font-black uppercase">
                      IMD Disabled
                    </span>
                  )}
                </div>"""

new_site_params = """              <div className="p-4 bg-slate-950/50 border border-white/5 rounded-2xl mb-4">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center">
                    Site Protection Parameters
                    <InfoTooltip content="Set the minimum frequency spacing required between the generated plan and the existing site frequencies." />
                  </span>
                  
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-slate-900/80 p-1.5 rounded-lg border border-slate-700/50">
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold ml-1">Make newly generated frequencies:</span>
                    <div className="flex gap-2">
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
                  </div>
                </div>"""

content = content.replace(old_site_params, new_site_params)

with open('components/GeneratorTab.tsx', 'w') as f:
    f.write(content)

