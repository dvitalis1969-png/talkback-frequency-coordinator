import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const applyBrandingToPdf = (doc: jsPDF, branding: any, exportProfile: 'client-facing' | 'internal-crew' = 'client-facing'): number => {
    // Internal Crew profile: minimal branding
    if (exportProfile === 'internal-crew') {
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        doc.text(branding?.companyName || 'Internal Document', 14, 10);
        return 15;
    }

    // Default branding
    const brandColor = branding?.brandColor || '#4f46e5'; // Indigo 600
    const secondaryColor = branding?.secondaryColor || '#0f172a';
    const theme = branding?.documentTheme || 'modern-minimal';
    
    // Draw a colored rectangle at the top
    doc.setFillColor(theme === 'high-contrast' ? '#000000' : brandColor);
    doc.rect(0, 0, 210, 25, 'F');
    
    // Add a secondary accent line
    doc.setFillColor(secondaryColor);
    doc.rect(0, 25, 210, 1.5, 'F');
    
    // Draw logo if it exists
    if (branding?.logoBase64) {
        try {
            // Get image properties to maintain aspect ratio
            const imgProps = doc.getImageProperties(branding.logoBase64);
            const maxHeight = 18; // Original height
            const maxWidth = 50; // Constrained width
            
            let imgHeight = maxHeight;
            let imgWidth = (imgProps.width * imgHeight) / imgProps.height;
            
            if (imgWidth > maxWidth) {
                imgWidth = maxWidth;
                imgHeight = (imgProps.height * imgWidth) / imgProps.width;
            }
            
            // Add logo to the top left, maintaining aspect ratio
            doc.addImage(branding.logoBase64, 'PNG', 14, 4, imgWidth, imgHeight);
        } catch (e) {
            console.error("Failed to add logo to PDF", e);
        }
    }
    
    // Draw branding details
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold'); // Set font to bold
    doc.setTextColor(255, 255, 255); // White text on colored background
    let y = 6;
    if (branding?.companyName) {
        doc.text(branding.companyName, 210 - 10, y, { align: 'right' });
        y += 4;
    }
    if (branding?.companyAddress) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(branding.companyAddress, 210 - 10, y, { align: 'right' });
        y += 4;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
    }
    if (branding?.contactEmail) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(branding.contactEmail, 210 - 10, y, { align: 'right' });
        y += 4;
    }
    if (branding?.contactPhone) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(branding.contactPhone, 210 - 10, y, { align: 'right' });
        y += 4;
    }
    if (branding?.websiteUrl) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(branding.websiteUrl, 210 - 10, y, { align: 'right' });
    }
    
    // Reset font to normal
    doc.setFont('helvetica', 'normal');
    
    // Return the Y position where the content should start
    return 30;
};

export const applyFooterToPdf = (doc: jsPDF, branding: any, pageNumber: number, totalPages: number | string) => {
    const pageHeight = doc.internal.pageSize.height || 297;
    const pageWidth = doc.internal.pageSize.width || 210;
    
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    
    // Add a subtle line above the footer
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(14, pageHeight - 20, pageWidth - 14, pageHeight - 20);
    
    // Page numbers
    doc.text(`Page ${pageNumber} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    
    // Footer Logo
    if (branding?.footerLogoBase64) {
        try {
            const imgProps = doc.getImageProperties(branding.footerLogoBase64);
            const maxHeight = 10;
            const maxWidth = 30;
            let imgHeight = maxHeight;
            let imgWidth = (imgProps.width * imgHeight) / imgProps.height;
            if (imgWidth > maxWidth) {
                imgWidth = maxWidth;
                imgHeight = (imgProps.height * imgWidth) / imgProps.width;
            }
            doc.addImage(branding.footerLogoBase64, 'PNG', 14, pageHeight - 15, imgWidth, imgHeight);
        } catch (e) {
            console.error("Failed to add footer logo", e);
        }
    } else if (branding?.logoBase64) {
        // Fallback to main logo if footer logo is not set
        try {
            const imgProps = doc.getImageProperties(branding.logoBase64);
            const maxHeight = 10;
            const maxWidth = 30;
            let imgHeight = maxHeight;
            let imgWidth = (imgProps.width * imgHeight) / imgProps.height;
            if (imgWidth > maxWidth) {
                imgWidth = maxWidth;
                imgHeight = (imgProps.height * imgWidth) / imgProps.width;
            }
            doc.addImage(branding.logoBase64, 'PNG', 14, pageHeight - 15, imgWidth, imgHeight);
        } catch (e) {
            console.error("Failed to add fallback footer logo", e);
        }
    }

    // Footer Company Details
    if (branding?.companyName) {
        doc.text(branding.companyName, pageWidth - 14, pageHeight - 15, { align: 'right' });
        if (branding?.companyAddress) {
            doc.text(branding.companyAddress, pageWidth - 14, pageHeight - 11, { align: 'right' });
        }
    }
};

export const generateBrandedPdf = (doc: jsPDF, title: string, branding: any, exportProfile: 'client-facing' | 'internal-crew' = 'client-facing'): number => {
    const startY = applyBrandingToPdf(doc, branding, exportProfile);
    const titleY = startY + 10; // Add 10 units gap
    
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    doc.text(title, 14, titleY);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, titleY + 8);
    
    return titleY + 20;
};

export const getTableStyles = (brandColor: string | undefined, branding?: any, exportProfile: 'client-facing' | 'internal-crew' = 'client-facing') => {
    const color = exportProfile === 'internal-crew' ? '#475569' : (brandColor || '#4f46e5');
    return {
        headStyles: {
            fillColor: color,
            textColor: '#ffffff',
            fontSize: 10,
            fontStyle: 'bold' as any
        },
        alternateRowStyles: {
            fillColor: '#f8fafc'
        },
        styles: {
            fontSize: 9,
            cellPadding: 3
        },
        margin: { top: exportProfile === 'internal-crew' ? 20 : 35, bottom: 20 },
        didDrawPage: (data: any) => {
            // Draw branding on subsequent pages
            if (data.pageNumber > 1 && branding) {
                applyBrandingToPdf(data.doc, branding, exportProfile);
            }
        }
    };
};

export const generateFullCoordinationPdf = (
    doc: jsPDF, 
    title: string, 
    planData: any[], 
    branding: any, 
    clientDetails: any, 
    exportProfile: 'client-facing' | 'internal-crew' = 'client-facing',
    itinerary?: { location: string; date: string | Date }[]
) => {
    let currentY = 0;
    
    if (exportProfile === 'client-facing') {
        const brandColor = branding?.brandColor || '#4f46e5';
        const secondaryColor = branding?.secondaryColor || '#0f172a';
        
        // --- COVER PAGE ---
        // Top Accent Bar
        doc.setFillColor(brandColor);
        doc.rect(0, 0, 210, 15, 'F');
        doc.setFillColor(secondaryColor);
        doc.rect(0, 15, 210, 2, 'F');
        
        // Large Company Logo
        let logoBottomY = 60;
        if (branding?.logoBase64) {
            try {
                const imgProps = doc.getImageProperties(branding.logoBase64);
                const maxWidth = 100;
                const maxHeight = 50;
                let imgWidth = imgProps.width;
                let imgHeight = imgProps.height;
                
                if (imgWidth > maxWidth || imgHeight > maxHeight) {
                    const ratio = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);
                    imgWidth *= ratio;
                    imgHeight *= ratio;
                }
                
                const xPos = (210 - imgWidth) / 2;
                doc.addImage(branding.logoBase64, 'PNG', xPos, 40, imgWidth, imgHeight);
                logoBottomY = 40 + imgHeight + 20;
            } catch (e) {
                console.error("Failed to add cover logo", e);
            }
        }
        
        // Document Title
        doc.setFontSize(36);
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.text("RF Coordination Report", 105, logoBottomY + 20, { align: 'center' });
        
        doc.setFontSize(18);
        doc.setTextColor(71, 85, 105);
        doc.setFont('helvetica', 'normal');
        doc.text(title, 105, logoBottomY + 35, { align: 'center' });
        
        // Divider
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.5);
        doc.line(65, logoBottomY + 50, 145, logoBottomY + 50);

        // Itinerary Section (Bespoke for Tour Planning)
        if (itinerary && itinerary.length > 0) {
            doc.setFontSize(10);
            doc.setTextColor(148, 163, 184);
            doc.setFont('helvetica', 'bold');
            doc.text("TOUR ITINERARY", 105, logoBottomY + 65, { align: 'center' });
            
            doc.setFontSize(9);
            doc.setTextColor(71, 85, 105);
            doc.setFont('helvetica', 'normal');
            
            const maxStops = 8; // Limit cover page itinerary
            itinerary.slice(0, maxStops).forEach((stop, idx) => {
                const dateObj = stop.date instanceof Date ? stop.date : new Date(stop.date);
                const dateStr = !isNaN(dateObj.getTime()) 
                    ? dateObj.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) 
                    : String(stop.date).split('T')[0];
                doc.text(`${dateStr} - ${stop.location}`, 105, logoBottomY + 72 + (idx * 5), { align: 'center' });
            });
            
            if (itinerary.length > maxStops) {
                doc.text(`... and ${itinerary.length - maxStops} more dates`, 105, logoBottomY + 72 + (maxStops * 5), { align: 'center' });
            }
            
            logoBottomY += 60; // Offset Prepared For section
        }
        
        // Prepared For
        let prepY = logoBottomY + 75;
        if (clientDetails?.name || clientDetails?.logoBase64) {
            doc.setFontSize(10);
            doc.setTextColor(148, 163, 184);
            doc.setFont('helvetica', 'bold');
            doc.text("PREPARED FOR", 105, prepY, { align: 'center' });
            prepY += 10;
            
            if (clientDetails?.logoBase64) {
                try {
                    const imgProps = doc.getImageProperties(clientDetails.logoBase64);
                    const maxWidth = 60;
                    const maxHeight = 30;
                    let imgWidth = imgProps.width;
                    let imgHeight = imgProps.height;
                    
                    if (imgWidth > maxWidth || imgHeight > maxHeight) {
                        const ratio = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);
                        imgWidth *= ratio;
                        imgHeight *= ratio;
                    }
                    
                    const xPos = (210 - imgWidth) / 2;
                    doc.addImage(clientDetails.logoBase64, 'PNG', xPos, prepY, imgWidth, imgHeight);
                    prepY += imgHeight + 10;
                } catch (e) {
                    console.error("Failed to add client cover logo", e);
                }
            }
            
            doc.setFontSize(18);
            doc.setTextColor(15, 23, 42);
            doc.setFont('helvetica', 'bold');
            if (clientDetails?.name) {
                doc.text(clientDetails.name, 105, prepY, { align: 'center' });
                prepY += 8;
            }
            
            doc.setFontSize(12);
            doc.setTextColor(71, 85, 105);
            doc.setFont('helvetica', 'normal');
            if (clientDetails?.address) {
                doc.text(clientDetails.address, 105, prepY, { align: 'center' });
                prepY += 6;
            }
            if (clientDetails?.contact) {
                doc.text(clientDetails.contact, 105, prepY, { align: 'center' });
            }
        }
        
        // Prepared By
        let byY = 220;
        doc.setFontSize(10);
        doc.setTextColor(148, 163, 184);
        doc.setFont('helvetica', 'bold');
        doc.text("PREPARED BY", 105, byY, { align: 'center' });
        byY += 10;
        
        doc.setFontSize(16);
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.text(branding?.companyName || "Independent Engineer", 105, byY, { align: 'center' });
        byY += 8;
        
        doc.setFontSize(12);
        doc.setTextColor(71, 85, 105);
        doc.setFont('helvetica', 'normal');
        if (branding?.leadEngineer) {
            doc.text(branding.leadEngineer, 105, byY, { align: 'center' });
            byY += 6;
        }
        if (branding?.contactEmail) {
            doc.text(branding.contactEmail, 105, byY, { align: 'center' });
        }
        
        // Date at bottom
        doc.setFontSize(12);
        doc.setTextColor(148, 163, 184);
        doc.text(clientDetails?.date || new Date().toLocaleDateString(), 105, 275, { align: 'center' });
        
        // Bottom Accent Bar
        doc.setFillColor(brandColor);
        doc.rect(0, 282, 210, 15, 'F');
        doc.setFillColor(secondaryColor);
        doc.rect(0, 280, 210, 2, 'F');
        
        // --- END COVER PAGE ---
        
        // Move to next page for data
        doc.addPage();
        currentY = applyBrandingToPdf(doc, branding, exportProfile);
        
        // Project Summary Section
        currentY += 10;
        doc.setFontSize(20);
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.text("Project Summary", 14, currentY);
        currentY += 10;
        
        // Draw 6-grid box for Date, Location, Notes
        doc.setLineWidth(0.4);
        doc.setDrawColor(148, 163, 184);
        doc.setFillColor(248, 250, 252);
        
        const startX = 14;
        const col1W = 30;
        const col2W = 152;
        const rowH = 8;
        
        doc.setFontSize(10);
        
        // Row 1: Date
        doc.rect(startX, currentY, col1W, rowH, 'FD');
        doc.rect(startX + col1W, currentY, col2W, rowH, 'S');
        doc.setTextColor(71, 85, 105);
        doc.setFont('helvetica', 'bold');
        doc.text('Date', startX + 4, currentY + 5.5);
        doc.setFont('helvetica', 'normal');
        doc.text(clientDetails?.date || '', startX + col1W + 4, currentY + 5.5);
        currentY += rowH;

        // Row 2: Location
        doc.rect(startX, currentY, col1W, rowH, 'FD');
        doc.rect(startX + col1W, currentY, col2W, rowH, 'S');
        doc.setFont('helvetica', 'bold');
        doc.text('Location', startX + 4, currentY + 5.5);
        doc.setFont('helvetica', 'normal');
        doc.text(clientDetails?.location || '', startX + col1W + 4, currentY + 5.5);
        currentY += rowH;

        // Row 3: Notes
        doc.rect(startX, currentY, col1W, rowH, 'FD');
        doc.rect(startX + col1W, currentY, col2W, rowH, 'S');
        doc.setFont('helvetica', 'bold');
        doc.text('Notes', startX + 4, currentY + 5.5);
        doc.setFont('helvetica', 'normal');
        doc.text(clientDetails?.notes || '', startX + col1W + 4, currentY + 5.5);
        currentY += rowH + 10;
        
        // Add a quick metrics summary
        const totalFreqs = planData.length;
        const uniqueStages = new Set(planData.map(r => r.stage || 'Unassigned')).size;
        
        doc.setFillColor(brandColor);
        doc.rect(14, currentY, 90, 20, 'F');
        doc.setFillColor(secondaryColor);
        doc.rect(106, currentY, 90, 20, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text(totalFreqs.toString(), 20, currentY + 12);
        doc.text(uniqueStages.toString(), 112, currentY + 12);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text("Total Frequencies", 20, currentY + 17);
        doc.text("Allocations / Zones", 112, currentY + 17);
        
        currentY += 30;
        
        // Draw a separator line
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.5);
        doc.line(14, currentY, 196, currentY);
        currentY += 10;
        
    } else {
        currentY = applyBrandingToPdf(doc, branding, exportProfile);
        currentY += 15;
        doc.setFontSize(18);
        doc.setTextColor(15, 23, 42);
        doc.text(title, 14, currentY);
        currentY += 8;
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, currentY);
        currentY += 15;
    }

    // Group data by Stage/Allocation, then by Type
    const groupedData: Record<string, Record<string, any[]>> = {};
    planData.forEach(row => {
        const stage = row.stage || 'Unassigned';
        const type = row.type || 'generic';
        if (!groupedData[stage]) groupedData[stage] = {};
        if (!groupedData[stage][type]) groupedData[stage][type] = [];
        groupedData[stage][type].push(row);
    });

    const brandColor = branding?.brandColor || '#4f46e5';
    const typeLabels: Record<string, string> = {
        'mic': 'Mics',
        'iem': 'IEMs',
        'comms': 'Comms',
        'comms-duplex': 'Comms (Duplex)',
        'wmas': 'WMAS',
        'generic': 'Other'
    };

    // Iterate through groups and create tables
    Object.entries(groupedData).forEach(([stage, types], index) => {
        if (index > 0) {
            // Add some space before the next section
            currentY += 15;
            // Check if we need a new page
            if (currentY > 250) {
                doc.addPage();
                currentY = applyBrandingToPdf(doc, branding, exportProfile) + 15;
            }
        }

        // Section Header
        doc.setFillColor(brandColor);
        doc.rect(14, currentY - 5, 2, 6, 'F'); // Vertical accent
        doc.setFontSize(16);
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.text(`Allocation: ${stage}`, 18, currentY);
        currentY += 8;

        Object.entries(types).forEach(([type, rows]) => {
            if (currentY > 260) {
                doc.addPage();
                currentY = applyBrandingToPdf(doc, branding, exportProfile) + 15;
            }

            const typeLabel = typeLabels[type] || 'Other';
            const count = rows.length;
            
            doc.setFontSize(12);
            doc.setTextColor(71, 85, 105);
            doc.setFont('helvetica', 'bold');
            doc.text(`${typeLabel} - ${count} channels`, 14, currentY);
            currentY += 4;

            let head = [['Freq (MHz)', 'Label', 'Equipment', 'Band', 'Power', 'BW', 'Params']];
            let tableData = rows.map(row => [
                (type === 'comms' || type === 'comms-duplex') ? row.frequency.toFixed(5) : row.frequency.toFixed(3),
                row.label,
                row.equipment,
                row.band,
                row.power || '-',
                row.bandwidth || '-',
                row.parameters || '-'
            ]);

            if (type === 'comms-duplex') {
                head = [['Tx Freq', 'Rx Freq', 'Label', 'Equipment', 'Band', 'Power', 'BW', 'Params']];
                tableData = rows.map(row => [
                    row.frequency ? row.frequency.toFixed(5) : '-',
                    row.rxFrequency ? row.rxFrequency.toFixed(5) : '-',
                    row.label,
                    row.equipment,
                    row.band,
                    row.power || '-',
                    row.bandwidth || '-',
                    row.parameters || '-'
                ]);
            }

            autoTable(doc, {
                startY: currentY,
                head: head,
                body: tableData,
                theme: 'grid',
                headStyles: {
                    fillColor: exportProfile === 'internal-crew' ? '#475569' : brandColor,
                    textColor: '#ffffff',
                    fontSize: 9,
                    fontStyle: 'bold' as any,
                    lineWidth: 0.4,
                    lineColor: exportProfile === 'internal-crew' ? '#334155' : brandColor
                },
                alternateRowStyles: {
                    fillColor: '#f8fafc'
                },
                styles: {
                    fontSize: 8,
                    cellPadding: 4,
                    lineWidth: 0.4,
                    lineColor: [148, 163, 184]
                },
                tableLineWidth: 0.6,
                tableLineColor: [100, 116, 139],
                columnStyles: {
                    0: { fontStyle: 'bold', textColor: brandColor }
                },
                margin: { top: exportProfile === 'internal-crew' ? 20 : 35, bottom: 20 },
                didDrawPage: (data: any) => {
                    if (data.pageNumber > 1 && branding) {
                        applyBrandingToPdf(data.doc, branding, exportProfile);
                    }
                }
            });

            currentY = (doc as any).lastAutoTable.finalY + 10;
        });
    });

    // Parameters Box
    currentY += 5;
    if (currentY > 240) {
        doc.addPage();
        currentY = applyBrandingToPdf(doc, branding, exportProfile) + 15;
    }

    doc.setFillColor(brandColor);
    doc.rect(14, currentY - 5, 2, 6, 'F');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text('Coordination Parameters Used', 18, currentY);
    currentY += 6;

    const uniqueParams = new Map<string, any>();
    planData.forEach(row => {
        if (row.parameters && row.thresholds && row.thresholds !== '-') {
            const key = `${row.equipment}-${row.parameters}`;
            if (!uniqueParams.has(key)) {
                uniqueParams.set(key, {
                    equipment: row.equipment,
                    params: row.parameters,
                    thresholds: row.thresholds
                });
            }
        }
    });

    const paramTableData = Array.from(uniqueParams.values()).map(p => [
        p.equipment,
        p.params,
        p.thresholds
    ]);

    if (paramTableData.length > 0) {
        autoTable(doc, {
            startY: currentY,
            head: [['Equipment', 'Profile', 'Spacing (FF, 2T, 3T) kHz']],
            body: paramTableData,
            theme: 'grid',
            headStyles: {
                fillColor: '#475569',
                textColor: '#ffffff',
                fontSize: 9,
                fontStyle: 'bold' as any,
                lineWidth: 0.4,
                lineColor: '#334155'
            },
            alternateRowStyles: {
                fillColor: '#f8fafc'
            },
            styles: { 
                fontSize: 8, 
                cellPadding: 4,
                lineWidth: 0.4,
                lineColor: [148, 163, 184]
            },
            tableLineWidth: 0.6,
            tableLineColor: [100, 116, 139],
            margin: { top: 20, bottom: 20 }
        });
        currentY = (doc as any).lastAutoTable.finalY;
    } else {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('No specific parameters recorded.', 14, currentY);
        currentY += 10;
    }

    // Sign-off Block
    if (exportProfile === 'client-facing') {
        currentY += 15;
        if (currentY > 240) {
            doc.addPage();
            currentY = applyBrandingToPdf(doc, branding, exportProfile) + 15;
        }
        
        doc.setDrawColor(148, 163, 184);
        doc.setLineWidth(0.5);
        
        // Engineer Signature
        doc.line(14, currentY + 10, 90, currentY + 10);
        doc.setFontSize(10);
        doc.setTextColor(71, 85, 105);
        doc.setFont('helvetica', 'normal');
        doc.text('Lead Engineer Signature', 14, currentY + 15);
        if (branding?.leadEngineer) {
            doc.setFont('helvetica', 'bold');
            doc.text(branding.leadEngineer, 14, currentY + 20);
        }
        
        // Client Signature
        doc.line(120, currentY + 10, 196, currentY + 10);
        doc.setFont('helvetica', 'normal');
        doc.text('Client Approval Signature', 120, currentY + 15);
        if (clientDetails?.name) {
            doc.setFont('helvetica', 'bold');
            doc.text(clientDetails.name, 120, currentY + 20);
        }
        
        currentY += 30;
    }

    // Apply footer to all pages at the end
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = exportProfile === 'client-facing' ? 2 : 1; i <= pageCount; i++) {
        doc.setPage(i);
        applyFooterToPdf(doc, branding, i, pageCount);
    }

    return doc;
};

