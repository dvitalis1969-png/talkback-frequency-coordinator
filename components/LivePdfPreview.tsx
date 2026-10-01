import React, { useEffect, useState, useRef } from 'react';
import { jsPDF } from 'jspdf';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, Download, RefreshCw, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';

// Set up the worker for react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

interface LivePdfPreviewProps {
  generatePdf: () => jsPDF;
  title?: string;
  onDownload?: () => void;
}

export const LivePdfPreview: React.FC<LivePdfPreviewProps> = ({ generatePdf, title = "Live Preview", onDownload }) => {
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [numPages, setNumPages] = useState<number>(1);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [zoom, setZoom] = useState<number>(0.8);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  const updatePreview = () => {
    setIsUpdating(true);
    try {
      const doc = generatePdf();
      const blob = doc.output('blob');
      setPdfBlob(blob);
    } catch (error) {
      console.error("PDF Preview generation failed:", error);
    } finally {
      // Small delay to show the update animation
      setTimeout(() => setIsUpdating(false), 500);
    }
  };

  useEffect(() => {
    updatePreview();
  }, []);

  // Debounced update when generatePdf changes
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      updatePreview();
    }, 1000);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [generatePdf]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    if (pageNumber > numPages) setPageNumber(1);
  }

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-white/10 rounded-md overflow-hidden shadow-2xl">
      <div className="flex items-center justify-between p-2 bg-slate-950 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-sm bg-indigo-500/20 flex items-center justify-center">
            <FileText className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-white leading-none">{title}</h3>
            <div className="flex items-center gap-1.5 mt-1">
              <div className={`w-1.5 h-1.5 rounded-full ${isUpdating ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
              <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">
                {isUpdating ? 'Syncing...' : 'Live Sync Active'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-900 rounded-sm border border-white/5 p-1 mr-2">
            <button 
              onClick={() => setZoom(prev => Math.max(0.4, prev - 0.1))}
              className="p-1 hover:bg-white/5 rounded text-slate-400"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="text-[9px] font-mono text-slate-500 w-8 text-center">{Math.round(zoom * 100)}%</span>
            <button 
              onClick={() => setZoom(prev => Math.min(1.5, prev + 0.1))}
              className="p-1 hover:bg-white/5 rounded text-slate-400"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
          </div>
          {onDownload && (
            <button 
              onClick={onDownload}
              className="p-2 rounded-sm bg-indigo-600 text-white hover:bg-indigo-500 transition-all shadow-sm border border-slate-700/50 shadow-indigo-500/20"
              title="Download PDF"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      
      <div className="flex-1 bg-slate-950 relative overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto custom-scrollbar p-2 flex justify-center items-start bg-[radial-gradient(circle_at_center,rgba(30,41,59,1)_0%,rgba(15,23,42,1)_100%)]">
          <AnimatePresence mode="wait">
            {pdfBlob ? (
              <motion.div
                key="pdf-content"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="shadow-2xl bg-white rounded-sm overflow-hidden"
              >
                <Document
                  file={pdfBlob}
                  onLoadSuccess={onDocumentLoadSuccess}
                  loading={
                    <div className="flex flex-col items-center justify-center p-20 gap-2">
                      <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Rendering...</span>
                    </div>
                  }
                >
                  <Page 
                    pageNumber={pageNumber} 
                    scale={zoom}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    className="transition-all duration-300"
                  />
                </Document>
              </motion.div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2">
                <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Initializing Engine...</span>
              </div>
            )}
          </AnimatePresence>
        </div>

        {numPages > 1 && (
          <div className="p-3 bg-slate-950 border-t border-white/5 flex justify-center items-center gap-2">
            <button 
              onClick={() => setPageNumber(prev => Math.max(1, prev - 1))}
              disabled={pageNumber <= 1}
              className="p-1.5 rounded-full hover:bg-white/5 text-slate-400 disabled:opacity-20 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[10px] font-bold text-slate-400 font-mono">
              {pageNumber} / {numPages}
            </span>
            <button 
              onClick={() => setPageNumber(prev => Math.min(numPages, prev + 1))}
              disabled={pageNumber >= numPages}
              className="p-1.5 rounded-full hover:bg-white/5 text-slate-400 disabled:opacity-20 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
      
      <div className="px-3 py-2 bg-slate-900 border-t border-white/5 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          <span className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">Engine v2.4.0-Live</span>
        </div>
        <div className="flex items-center gap-1.5">
          <RefreshCw className={`w-2.5 h-2.5 ${isUpdating ? 'animate-spin text-indigo-400' : 'text-slate-600'}`} />
          <span className="text-[7px] font-bold text-slate-600 uppercase tracking-widest">
            {isUpdating ? 'Processing Changes' : 'Idle'}
          </span>
        </div>
      </div>
    </div>
  );
};

