import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AppState } from '../types';
import { generateBrandedPdf, getTableStyles } from '../src/utils/pdfBranding';

export const generateFrequencyReportPdf = (state: AppState, projectName: string, user?: any) => {
    console.log("Generating PDF report. User object:", user);
    console.log("Branding data:", user?.branding);
    
    const doc = new jsPDF();
    let startY = 20;
    if (user?.branding) {
        startY = generateBrandedPdf(doc, `Frequency Coordination Report: ${projectName}`, user?.branding);
    } else {
        doc.setFontSize(18);
        doc.text(`Frequency Coordination Report: ${projectName}`, 14, startY);
        
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, startY + 8);
        startY += 20;
    }

    // Add Channel List Table
    if (state.frequencies && state.frequencies.length > 0) {
        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);
        doc.text('Frequency Assignment List', 14, startY + 20);
        
        const tableData = state.frequencies.map(f => [
            f.id,
            f.value.toFixed(3),
            f.label || 'N/A',
            f.type || 'Generic'
        ]);

        autoTable(doc, {
            startY: startY + 25,
            head: [['ID', 'Frequency (MHz)', 'Label', 'Type']],
            body: tableData,
            ...getTableStyles(user?.branding?.brandColor, user?.branding)
        });
    }

    // Add Compliance Statement
    const finalY = (doc as any).lastAutoTable?.finalY || startY + 60;
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Compliance Statement', 14, finalY + 15);
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('This frequency plan has been coordinated based on the provided equipment profiles and thresholds.', 14, finalY + 22);
    doc.text('Users are responsible for verifying compliance with local regulatory requirements.', 14, finalY + 28);

    doc.save(`${projectName.replace(/\s+/g, '_')}_Report.pdf`);
};

export const exportToCsv = (state: AppState, projectName: string) => {
    const headers = ['ID', 'Frequency (MHz)', 'Label', 'Type'];
    const rows = state.frequencies.map(f => [
        f.id,
        f.value.toFixed(3),
        f.label || 'N/A',
        f.type || 'Generic'
    ]);

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `${projectName}_Frequency_List.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(href);
};
