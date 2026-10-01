import React, { useState, useEffect, useRef } from 'react';
import { X, Download, Settings, FileText, ChevronLeft, ChevronRight, Upload, Building, MapPin, Phone, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set up the worker for react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    generatePdf: (profile: 'client-facing' | 'internal-crew', clientDetails?: any) => jsPDF;
    filename: string;
}

const PdfPreviewModal: React.FC<PdfPreviewModalProps> = ({ isOpen, onClose, generatePdf, filename }) => {
    const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
    const [exportProfile, setExportProfile] = useState<'client-facing' | 'internal-crew'>('client-facing');
    const [isGenerating, setIsGenerating] = useState(false);
    
    const [numPages, setNumPages] = useState<number>(1);
    const [pageNumber, setPageNumber] = useState<number>(1);
    const [zoom, setZoom] = useState<number>(1);

    const [clientDetails, setClientDetails] = useState({
        name: '',
        address: '',
        contact: '',
        logoBase64: '',
        date: new Date().toLocaleDateString(),
        location: '',
        notes: ''
    });

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            updatePreview();
        } else {
            setPdfBlob(null);
            setPageNumber(1);
            setZoom(1);
        }
    }, [isOpen, exportProfile]);

    const updatePreview = () => {
        setIsGenerating(true);
        try {
            // Use a small timeout to allow UI to update before heavy PDF generation
            setTimeout(() => {
                const doc = generatePdf(exportProfile, clientDetails);
                const blob = doc.output('blob');
                setPdfBlob(blob);
                setIsGenerating(false);
                setPageNumber(1);
            }, 50);
        } catch (error) {
            console.error("Failed to generate PDF preview", error);
            setIsGenerating(false);
        }
    };

    const handleDownload = () => {
        const doc = generatePdf(exportProfile, clientDetails);
        doc.save(`${filename}.pdf`);
        onClose();
    };

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
    }

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setClientDetails(prev => ({ ...prev, logoBase64: reader.result as string }));
            };
            reader.readAsDataURL(file);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1000000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 md:p-8">
            <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-7xl h-full max-h-[95vh] flex flex-col overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/5 bg-slate-950/50 shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="w-12 h-12 rounded-md bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                            <FileText className="w-4 h-4" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold font-black text-white tracking-tight">Live PDF Preview</h2>
                            <p className="text-xs text-slate-400 font-medium">Preview and configure your export</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-3 hover:bg-white/5 rounded-md text-slate-400 hover:text-white transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex flex-col md:flex-row flex-grow overflow-y-auto md:overflow-hidden">
                    {/* Sidebar Settings */}
                    <div className="w-full md:w-96 bg-slate-950/30 border-b md:border-b-0 md:border-r border-white/5 p-4 flex flex-col gap-8 md:overflow-y-auto custom-scrollbar shrink-0">
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-white font-bold mb-2">
                                <Settings className="w-4 h-4 text-indigo-400" />
                                Export Profile
                            </div>
                            
                            <label className={`block p-2 rounded-md border-2 cursor-pointer transition-all ${exportProfile === 'client-facing' ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/5 bg-slate-900 hover:border-white/20'}`}>
                                <input 
                                    type="radio" 
                                    name="exportProfile" 
                                    value="client-facing" 
                                    checked={exportProfile === 'client-facing'}
                                    onChange={() => setExportProfile('client-facing')}
                                    className="sr-only"
                                />
                                <div className="font-bold text-white mb-1">Client Facing</div>
                                <div className="text-xs text-slate-400">Heavy branding, sectioned data, perfect for sharing with clients.</div>
                            </label>

                            <label className={`block p-2 rounded-md border-2 cursor-pointer transition-all ${exportProfile === 'internal-crew' ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/5 bg-slate-900 hover:border-white/20'}`}>
                                <input 
                                    type="radio" 
                                    name="exportProfile" 
                                    value="internal-crew" 
                                    checked={exportProfile === 'internal-crew'}
                                    onChange={() => setExportProfile('internal-crew')}
                                    className="sr-only"
                                />
                                <div className="font-bold text-white mb-1">Internal Crew</div>
                                <div className="text-xs text-slate-400">Minimal branding, highly technical data, optimized for printing and crew use.</div>
                            </label>
                        </div>

                        {exportProfile === 'client-facing' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
                                <div className="flex items-center gap-2 text-white font-bold mb-2 pt-4 border-t border-white/5">
                                    <Building className="w-4 h-4 text-indigo-400" />
                                    Client Details
                                </div>
                                
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Client Name</label>
                                        <input 
                                            type="text" 
                                            value={clientDetails.name}
                                            onChange={e => setClientDetails(prev => ({ ...prev, name: e.target.value }))}
                                            placeholder="e.g. Acme Corp"
                                            className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 transition-colors"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block flex items-center gap-1"><MapPin className="w-3 h-3"/> Address</label>
                                        <input 
                                            type="text" 
                                            value={clientDetails.address}
                                            onChange={e => setClientDetails(prev => ({ ...prev, address: e.target.value }))}
                                            placeholder="e.g. 123 Event Street"
                                            className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 transition-colors"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block flex items-center gap-1"><Phone className="w-3 h-3"/> Contact</label>
                                        <input 
                                            type="text" 
                                            value={clientDetails.contact}
                                            onChange={e => setClientDetails(prev => ({ ...prev, contact: e.target.value }))}
                                            placeholder="e.g. contact@acmecorp.com"
                                            className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 transition-colors"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Client Logo</label>
                                        <input 
                                            type="file" 
                                            accept="image/*"
                                            ref={fileInputRef}
                                            onChange={handleLogoUpload}
                                            className="hidden"
                                        />
                                        <button 
                                            onClick={() => fileInputRef.current?.click()}
                                            className="w-full bg-slate-900 border border-slate-700 hover:border-indigo-500 border-dashed rounded-md px-3 py-3 text-sm text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-2"
                                        >
                                            <Upload className="w-4 h-4" />
                                            {clientDetails.logoBase64 ? 'Change Logo' : 'Upload Logo'}
                                        </button>
                                        {clientDetails.logoBase64 && (
                                            <div className="mt-2 p-2 bg-white rounded-sm inline-block">
                                                <img src={clientDetails.logoBase64} alt="Client Logo" className="h-8 object-contain" />
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Date</label>
                                        <input 
                                            type="text" 
                                            value={clientDetails.date}
                                            onChange={e => setClientDetails(prev => ({ ...prev, date: e.target.value }))}
                                            placeholder="e.g. 01/01/2026"
                                            className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 transition-colors"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Location</label>
                                        <input 
                                            type="text" 
                                            value={clientDetails.location}
                                            onChange={e => setClientDetails(prev => ({ ...prev, location: e.target.value }))}
                                            placeholder="e.g. Main Stage"
                                            className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 transition-colors"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Notes</label>
                                        <textarea 
                                            value={clientDetails.notes}
                                            onChange={e => setClientDetails(prev => ({ ...prev, notes: e.target.value }))}
                                            placeholder="Any additional notes..."
                                            className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 transition-colors"
                                            rows={2}
                                        />
                                    </div>
                                </div>
                                <button 
                                    onClick={updatePreview}
                                    className="w-full py-3 bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 font-bold rounded-md transition-colors mt-2"
                                >
                                    Update Document
                                </button>
                            </div>
                        )}

                        <div className="mt-auto pt-6 border-t border-white/5">
                            <button 
                                onClick={handleDownload}
                                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest text-xs rounded-md shadow-sm border border-slate-700/50 shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"
                            >
                                <Download className="w-4 h-4" /> Download PDF
                            </button>
                        </div>
                    </div>

                    {/* PDF Preview Area */}
                    <div className="flex-grow bg-slate-950 relative flex flex-col min-h-[500px] md:min-h-0">
                        {/* Zoom Controls */}
                        <div className="absolute top-4 right-4 flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-3 py-2 rounded-full border border-white/10 z-10">
                            <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} className="p-1.5 hover:bg-white/10 rounded-full text-white transition-colors" title="Zoom Out">
                                <ZoomOut className="w-4 h-4" />
                            </button>
                            <span className="text-slate-300 font-medium text-xs w-12 text-center">
                                {Math.round(zoom * 100)}%
                            </span>
                            <button onClick={() => setZoom(z => Math.min(3, z + 0.25))} className="p-1.5 hover:bg-white/10 rounded-full text-white transition-colors" title="Zoom In">
                                <ZoomIn className="w-4 h-4" />
                            </button>
                            <div className="w-px h-4 bg-white/20 mx-1"></div>
                            <button onClick={() => setZoom(1)} className="p-1.5 hover:bg-white/10 rounded-full text-white transition-colors" title="Fit to screen">
                                <Maximize className="w-4 h-4" />
                            </button>
                        </div>

                        {isGenerating ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-2">
                                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                <div className="font-bold tracking-widest uppercase text-xs">Generating Preview...</div>
                            </div>
                        ) : pdfBlob ? (
                            <div className="flex-grow overflow-auto flex flex-col items-center p-2 custom-scrollbar">
                                <div className="bg-white shadow-2xl">
                                    <Document
                                        file={pdfBlob}
                                        onLoadSuccess={onDocumentLoadSuccess}
                                        loading={
                                            <div className="flex items-center justify-center p-20 text-slate-400">
                                                <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mr-3"></div>
                                                Loading PDF...
                                            </div>
                                        }
                                        error={
                                            <div className="flex items-center justify-center p-20 text-rose-400">
                                                Failed to load PDF preview.
                                            </div>
                                        }
                                    >
                                        <Page 
                                            pageNumber={pageNumber} 
                                            renderTextLayer={false}
                                            renderAnnotationLayer={false}
                                            height={(window.innerHeight - 250) * zoom}
                                            className="shadow-sm border border-slate-700/50 transition-all duration-200"
                                        />
                                    </Document>
                                </div>
                            </div>
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-slate-500">
                                Failed to load preview.
                            </div>
                        )}

                        {/* Pagination Controls - Fixed at bottom outside scroll area */}
                        {pdfBlob && numPages > 1 && (
                            <div className="shrink-0 bg-slate-950 border-t border-white/5 p-2 flex justify-center">
                                <div className="flex items-center gap-2 bg-slate-900 px-4 py-2 rounded-full border border-white/10 shadow-sm border border-slate-700/50">
                                    <button 
                                        onClick={() => setPageNumber(Math.max(1, pageNumber - 1))}
                                        disabled={pageNumber <= 1}
                                        className="p-2 rounded-full hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent text-white transition-colors"
                                    >
                                        <ChevronLeft className="w-3.5 h-3.5" />
                                    </button>
                                    <span className="text-slate-300 font-medium text-sm">
                                        Page {pageNumber} of {numPages}
                                    </span>
                                    <button 
                                        onClick={() => setPageNumber(Math.min(numPages, pageNumber + 1))}
                                        disabled={pageNumber >= numPages}
                                        className="p-2 rounded-full hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent text-white transition-colors"
                                    >
                                        <ChevronRight className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PdfPreviewModal;
