import React, { useState, useRef } from "react";
import { FestivalAct, ZoneConfig } from "../types";
import { toast } from "sonner";
import * as XLSX from 'xlsx';

// Helper to parse dates in multiple formats, specifically handling DD/MM/YYYY
const parseFlexibleDate = (dateStr: string): Date => {
  if (!dateStr) return new Date();

  const cleanStr = dateStr.replace(/^["']|["']$/g, "").trim();
  const dmyMatch = cleanStr.match(
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?$/,
  );

  if (dmyMatch) {
    const [_, day, month, year, hour = "00", min = "00"] = dmyMatch;
    const isoStr = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hour.padStart(2, "0")}:${min.padStart(2, "0")}:00`;
    const date = new Date(isoStr);
    if (!isNaN(date.getTime())) return date;
  }

  const nativeParsed = new Date(cleanStr);
  return isNaN(nativeParsed.getTime()) ? new Date() : nativeParsed;
};

const AiScheduleImporter: React.FC<{
  onClose: () => void;
  onSync: (acts: FestivalAct[]) => void;
  zoneConfigs: ZoneConfig[];
}> = ({ onClose, onSync, zoneConfigs }) => {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    setIsProcessing(true);
    try {
      let base64Data: string;
      let mimeType: string = file.type || "application/pdf";

      if (file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const data = e.target?.result as ArrayBuffer;
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const csv = XLSX.utils.sheet_to_csv(worksheet);
          
          base64Data = btoa(csv);
          mimeType = "text/csv";
          await sendToAi(base64Data, mimeType);
        };
        reader.readAsArrayBuffer(file);
        return;
      } else {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const resultUrl = e.target?.result as string;
          base64Data = resultUrl.split(",")[1];
          await sendToAi(base64Data, mimeType);
        };
        reader.readAsDataURL(file);
      }
    } catch (error: any) {
      toast.error("Importer Error: " + error.message);
      setIsProcessing(false);
    }
  };

  const sendToAi = async (base64Data: string, mimeType: string) => {
    try {
      const response = await fetch("/api/ai-extract-schedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ base64Data, mimeType }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(
          errData.error || `Server Error (${response.status})`,
        );
      }

      const result = await response.json();
      const parsed = result.data || result;
      setPreviewData(parsed);
    } catch (err: any) {
      toast.error("Extraction error: " + err.message);
      setPreviewData([]);
    } finally {
      setIsProcessing(false);
    }
  };

  const syncToPlan = () => {
    const formattedDate = selectedDate.split("-").reverse().join("/"); // DD/MM/YYYY
    const targetDayName = new Intl.DateTimeFormat("en-US", { weekday: "long" })
      .format(new Date(selectedDate))
      .toLowerCase();

    // Filter to acts that match the selected target date (either by day name or date string)
    const filteredActs = previewData.filter((row) => {
      const detectedDay = (row.performanceDay || "").toLowerCase();
      return (
        detectedDay.includes(targetDayName) ||
        detectedDay.includes(selectedDate)
      );
    });

    if (filteredActs.length === 0 && previewData.length > 0) {
      toast.error(
        `No acts found matching ${targetDayName}. Please check the target date.`,
      );
      return;
    }

    const newActs = filteredActs.map((row) => {
      const startParsed = parseFlexibleDate(`${formattedDate} ${row.start}`);
      const endParsed = parseFlexibleDate(`${formattedDate} ${row.end}`);

      return {
        id: `act-${Date.now()}-${Math.random()}`,
        actName: row.artist,
        stage: row.stage || zoneConfigs[0]?.name || "Stage 1",
        startTime: startParsed,
        endTime: endParsed,
        active: true,
        iemRequests: [],
        micRequests: [],
      };
    });

    // SORT acts by Stage index (from zoneConfigs) -> Stage Name Alphabetical -> Start Time
    newActs.sort((a, b) => {
      let aZoneIdx = zoneConfigs.findIndex(
        (z) => z.name.toLowerCase().trim() === a.stage.toLowerCase().trim(),
      );
      let bZoneIdx = zoneConfigs.findIndex(
        (z) => z.name.toLowerCase().trim() === b.stage.toLowerCase().trim(),
      );

      if (aZoneIdx === -1 && bZoneIdx === -1) {
        const stageCmp = a.stage.localeCompare(b.stage);
        if (stageCmp !== 0) return stageCmp;
      } else {
        if (aZoneIdx === -1) aZoneIdx = 9999;
        if (bZoneIdx === -1) bZoneIdx = 9999;
        if (aZoneIdx !== bZoneIdx) return aZoneIdx - bZoneIdx;
      }

      return b.startTime.getTime() - a.startTime.getTime();
    });

    onSync(newActs);
    toast.success(`✅ Synced ${newActs.length} acts for ${targetDayName}`);
    onClose();
  };

  const actionButton =
    "py-3 px-4 rounded-md font-bold uppercase tracking-widest text-[10px] transition-all border-b-4 hover:brightness-110 active:border-b-0 active:translate-y-1";
  const primaryButton = `${actionButton} bg-blue-600 text-white border-blue-800`;
  const secondaryButton = `${actionButton} bg-slate-800 text-slate-300 border-slate-950`;

  return (
    <div className="fixed inset-0 z-[999999] flex flex-col pt-16 pb-8 px-3 sm:px-12 backdrop-blur-md bg-slate-950/80 animate-in fade-in duration-200">
      <div className="flex-1 w-full max-w-6xl mx-auto bg-slate-900 rounded-3xl border-2 border-indigo-500/30 flex flex-col overflow-hidden shadow-[0_0_100px_rgba(99,102,241,0.2)]">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-slate-950 shrink-0">
          <div>
            <h2 className="text-xl font-semibold font-black text-white uppercase tracking-tighter flex items-center gap-3">
              <span className="text-3xl">🧮</span> AI Scheduler Importer
              <span className="bg-indigo-500/20 text-indigo-400 text-[9px] px-2 py-1 rounded-full border border-indigo-500/30">
                Gemini Powered
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              Extract run of show data from PDF running orders, images, or
              spreadsheets.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body Component */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0">
          <div className="w-full lg:w-1/3 border-r border-white/5 bg-slate-950 p-4 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
            <div className="space-y-4 bg-slate-900 p-2 rounded-md border border-white/5 shadow-inner">
              <div className="space-y-2">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>{" "}
                  Event Target Date
                </h4>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-md px-3 py-3 text-sm font-mono text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <p className="text-[9px] text-slate-500 uppercase tracking-tighter mt-1 italic">
                  Importer will only sync acts matching this day.
                </p>
              </div>
            </div>
            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>{" "}
                Document Upload
              </h4>
              <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                Upload a standard <strong>PDF (.pdf)</strong>,{" "}
                <strong>Image (.jpg, .png)</strong> or document. AI extraction
                will automatically attempt to identify the acts, stages, and
                times across all days.
              </p>

              <input
                type="file"
                ref={fileInputRef}
                accept=".pdf,.png,.jpg,.jpeg,.csv,.txt,.xlsx"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0])
                    handleFileUpload(e.target.files[0]);
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className={`${primaryButton} w-full !py-2 !text-sm !rounded-md flex items-center justify-center gap-3 shadow-[0_10px_30px_rgba(59,130,246,0.2)]`}
              >
                {isProcessing ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>{" "}
                    ANALYZING DATA...
                  </>
                ) : (
                  "UPLOAD DOCUMENT"
                )}
              </button>
            </div>
          </div>

          <div className="flex-1 p-4 flex flex-col min-h-0 bg-slate-900/50">
            <div className="flex-1 flex flex-col bg-slate-950/50 rounded-md border border-white/5 overflow-hidden shadow-inner">
              <div className="p-3 bg-slate-900 border-b border-white/5 flex justify-between items-center">
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                  Active Extraction Output Preview
                </span>
                {previewData.length > 0 && (
                  <span className="text-[9px] font-black text-slate-500 uppercase">
                    {previewData.length} Acts Extracted
                  </span>
                )}
              </div>
              <div className="flex-1 overflow-auto custom-scrollbar">
                {previewData.length > 0 ? (
                  <table className="w-full text-left border-collapse text-[10px]">
                    <thead className="bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10 border-b border-white/10">
                      <tr className="uppercase font-black text-slate-400">
                        <th className="p-3 font-medium">Artist</th>
                        <th className="p-3 font-medium">Day</th>
                        <th className="p-3 font-medium">Stage</th>
                        <th className="p-3 font-medium">Start</th>
                        <th className="p-3 font-medium">End</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {previewData.map((row, i) => {
                        const targetDayName = new Intl.DateTimeFormat("en-US", {
                          weekday: "long",
                        })
                          .format(new Date(selectedDate))
                          .toLowerCase();
                        const detectedDay = (
                          row.performanceDay || ""
                        ).toLowerCase();
                        const isMatch =
                          detectedDay.includes(targetDayName) ||
                          detectedDay.includes(selectedDate);

                        return (
                          <tr
                            key={i}
                            className={`hover:bg-white/5 transition-colors ${!isMatch ? "opacity-40 grayscale" : ""}`}
                          >
                            <td className="p-3 text-white font-bold flex items-center gap-2">
                              {isMatch && (
                                <span className="w-1 h-1 rounded-full bg-emerald-400 shadow-[0_0_5px_#34d399]"></span>
                              )}
                              {row.artist}
                            </td>
                            <td className="p-3 text-indigo-400 font-black uppercase">
                              {row.performanceDay}
                            </td>
                            <td className="p-3 text-indigo-300 font-bold tracking-tighter uppercase">
                              {row.stage}
                            </td>
                            <td className="p-3 font-mono text-emerald-400">
                              {row.start}
                            </td>
                            <td className="p-3 font-mono text-emerald-400">
                              {row.end}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-700 p-4 text-center">
                    <span className="text-4xl mb-4 opacity-50">📄</span>
                    <span className="text-[10px] font-black uppercase tracking-widest italic opacity-50">
                      Upload a multi-day schedule document
                      <br />
                      to see filtered results here
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-950 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-2 shrink-0">
          <p className="text-[9px] text-slate-600 uppercase font-black tracking-widest">
            Selected:{" "}
            {new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(
              new Date(selectedDate),
            )}{" "}
            Only
          </p>
          <div className="flex gap-3 w-full sm:w-auto">
            <button onClick={onClose} className={secondaryButton}>
              Cancel
            </button>
            <button
              disabled={previewData.length === 0 || isProcessing}
              onClick={syncToPlan}
              className={`${primaryButton} !bg-gradient-to-r from-emerald-500 to-teal-500 !border-emerald-800 flex-1 sm:flex-none !py-3 !px-8 !text-xs shadow-[0_10px_30px_rgba(16,185,129,0.2)] disabled:opacity-50 disabled:grayscale`}
            >
              ⚡ SYNC{" "}
              {new Intl.DateTimeFormat("en-US", { weekday: "long" })
                .format(new Date(selectedDate))
                .toUpperCase()}{" "}
              TO PLAN
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AiScheduleImporter;
