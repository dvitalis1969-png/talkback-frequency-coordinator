import React from 'react';
import { AppState } from '../types';
import { generateFrequencyReportPdf, exportToCsv } from '../services/reportService';

interface ReportingTabProps {
    state: AppState;
    projectName?: string;
    user?: any;
}

const ReportingTab: React.FC<ReportingTabProps> = ({ state, projectName = 'Untitled Project', user }) => {
    console.log("ReportingTab mounted. Props:", { state, projectName, user });
    return (
        <div className="p-4 bg-slate-900 rounded-md border border-white/10 text-white">
            <h2 className="text-lg font-semibold font-black uppercase tracking-widest mb-6">Reporting & Compliance</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-950 rounded-md border border-white/5">
                    <h3 className="font-bold text-base font-medium mb-2">PDF Report</h3>
                    <p className="text-slate-400 text-sm mb-4">Generate a professional, printable frequency coordination report.</p>
                    <button 
                        onClick={() => generateFrequencyReportPdf(state, projectName, user)}
                        className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-sm font-bold text-sm transition-all"
                    >
                        Generate PDF
                    </button>
                </div>

                <div className="p-4 bg-slate-950 rounded-md border border-white/5">
                    <h3 className="font-bold text-base font-medium mb-2">Export Data</h3>
                    <p className="text-slate-400 text-sm mb-4">Export frequency list to CSV for external software.</p>
                    <button 
                        onClick={() => exportToCsv(state, projectName)}
                        className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-sm font-bold text-sm transition-all"
                    >
                        Export CSV
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReportingTab;
