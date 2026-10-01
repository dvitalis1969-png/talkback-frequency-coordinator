import React, { useState, useEffect } from 'react';
import { X, QrCode, Link as LinkIcon, Copy, Check, Trash2, ExternalLink, Printer } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { db, auth, addDocWithTimeout, updateDocWithTimeout, deleteDocWithTimeout, getDocsWithTimeout } from '../src/lib/firebase';
import { collection, query, where, Timestamp, doc, getDoc } from 'firebase/firestore';
import { toast } from 'sonner';

interface LiveShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    festivalActs: any[];
    zoneConfigs: any[];
    festivalName: string;
    projectId: string;
}

const LiveShareModal: React.FC<LiveShareModalProps> = ({ isOpen, onClose, festivalActs, zoneConfigs, festivalName, projectId }) => {
    const [shareId, setShareId] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [copied, setCopied] = useState(false);
    const [existingShare, setExistingShare] = useState<any>(null);
    const [selectedActId, setSelectedActId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'global' | 'acts'>('global');
    const [passwords, setPasswords] = useState<Record<string, string>>({});
    const [globalPassword, setGlobalPassword] = useState<string>('');

    useEffect(() => {
        if (isOpen && auth.currentUser) {
            checkExistingShare();
        }
    }, [isOpen, projectId]);

    const checkExistingShare = async () => {
        if (!auth.currentUser || !projectId) return;
        console.log("[LiveShareModal] Checking existing share for project:", projectId);
        try {
            const q = query(
                collection(db, 'live_shares'),
                where('userId', '==', auth.currentUser.uid),
                where('projectId', '==', projectId)
            );
            const snapshot = await getDocsWithTimeout(q);
            console.log("[LiveShareModal] Existing shares found:", snapshot.size);
            if (!snapshot.empty) {
                const doc = snapshot.docs[0];
                const data = doc.data();
                console.log("[LiveShareModal] Found share ID:", doc.id);
                setExistingShare({ id: doc.id, ...data });
                setShareId(doc.id);
                if (data.passwords) setPasswords(data.passwords);
                if (data.globalPassword) setGlobalPassword(data.globalPassword);
            } else {
                setExistingShare(null);
                setShareId(null);
            }
        } catch (error) {
            console.error("[LiveShareModal] Error checking existing share:", error);
        }
    };

    const handleGenerateLink = async () => {
        if (!auth.currentUser) {
            toast.error("You must be logged in to share a live link.");
            return;
        }

        setIsGenerating(true);
        console.log("[LiveShareModal] Generating/Updating link for:", festivalName);
        try {
            // Sanitize data: Firestore doesn't like undefined or complex nested arrays
            // We'll store acts and zones as strings to be safe, similar to projects
            const shareData = {
                userId: auth.currentUser.uid,
                festivalName: festivalName || "Festival RF Plan",
                projectId: projectId,
                acts: JSON.stringify(festivalActs || []),
                zones: JSON.stringify(zoneConfigs || []),
                active: true,
                updatedAt: Timestamp.now(),
                passwords: passwords,
                globalPassword: globalPassword
            };

            if (shareId) {
                console.log("[LiveShareModal] Updating existing share:", shareId);
                // Update existing
                await updateDocWithTimeout(doc(db, 'live_shares', shareId), shareData);
                toast.success("Live link updated with latest data!");
            } else {
                console.log("[LiveShareModal] Creating new share");
                // Create new
                const docRef = await addDocWithTimeout(collection(db, 'live_shares'), shareData);
                setShareId(docRef.id);
                setExistingShare({ id: docRef.id, ...shareData });
                toast.success("Live link generated!");
            }
        } catch (error) {
            console.error("[LiveShareModal] Error generating live link:", error);
            toast.error("Failed to generate live link.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleRevoke = async () => {
        if (!shareId) return;
        try {
            await deleteDocWithTimeout(doc(db, 'live_shares', shareId));
            setShareId(null);
            setExistingShare(null);
            toast.success("Live link revoked.");
        } catch (error) {
            console.error("Error revoking link:", error);
            toast.error("Failed to revoke link.");
        }
    };

    const getShareUrl = (actId?: string) => {
        if (!shareId) return '';
        // Ensure we have a clean origin without trailing slash
        const origin = window.location.origin.replace(/\/$/, '');
        // We use window.location.pathname to see if we are in a subpath (common in preview environments)
        let pathname = window.location.pathname;
        // If pathname is just / or index.html, we ignore it
        if (pathname === '/' || pathname.endsWith('index.html')) {
            pathname = '';
        } else {
            // Remove trailing slash from pathname
            pathname = pathname.replace(/\/$/, '');
        }
        
        const baseUrl = `${origin}${pathname}/live/${shareId}`;
        return actId ? `${baseUrl}?act=${actId}` : baseUrl;
    };

    const shareUrl = getShareUrl(selectedActId || undefined);
    console.log("[LiveShareModal] Generated shareUrl:", shareUrl);

    const handleCopy = () => {
        if (!shareUrl) return;
        navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success("Link copied to clipboard!");
    };

    const [qrSize, setQrSize] = useState<'small' | 'medium' | 'large'>('medium');
    const [showLinkOnPrint, setShowLinkOnPrint] = useState(true);

    const handlePrintAll = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            toast.error("Pop-up blocked. Please allow pop-ups to print QR codes.");
            return;
        }

        const sizeMap = {
            small: '100',
            medium: '200',
            large: '400'
        };
        const size = sizeMap[qrSize];

        const qrCodesHtml = festivalActs.map(act => {
            const url = getShareUrl(act.id);
            return `
                <div style="break-inside: avoid; border: 2px solid #e2e8f0; border-radius: 16px; padding: 24px; margin-bottom: 24px; text-align: center; font-family: sans-serif;">
                    <h2 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 900; text-transform: uppercase; letter-spacing: -0.025em;">${act.actName}</h2>
                    <p style="margin: 0 0 24px 0; font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;">RF Coordination Plan</p>
                    <div id="qr-${act.id}" style="display: flex; justify-content: center; align-items: center; margin-bottom: 16px;">
                        <img src="https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}" width="${size}" height="${size}" />
                    </div>
                    ${showLinkOnPrint ? `<p style="font-size: 10px; color: #94a3b8; font-family: monospace; word-break: break-all;">${url}</p>` : ''}
                </div>
            `;
        }).join('');

        printWindow.document.write(`
            <html>
                <head>
                    <title>Act QR Codes - ${festivalName}</title>
                    <style>
                        body { padding: 40px; background: white; }
                        @media print {
                            body { padding: 0; }
                            .no-print { display: none; }
                        }
                    </style>
                </head>
                <body>
                    <div class="no-print" style="margin-bottom: 40px; padding: 20px; background: #f8fafc; border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h1 style="margin: 0; font-size: 18px;">Print Act QR Codes</h1>
                            <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b;">${festivalName}</p>
                        </div>
                        <button onclick="window.print()" style="padding: 10px 20px; background: #4f46e5; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer;">Print Now</button>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
                        ${qrCodesHtml}
                    </div>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1000000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-2">
            <div className="bg-slate-900 border border-indigo-500/30 rounded-3xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
                <div className="flex items-center justify-between p-2 sm:p-4 border-b border-white/5 bg-slate-950/50 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-md bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                            <QrCode className="w-4 h-4 sm:w-5 sm:h-5" />
                        </div>
                        <div>
                            <h2 className="text-sm sm:text-base font-medium font-black text-white tracking-tight">Live Digital Handoff</h2>
                            <p className="text-[9px] sm:text-[10px] text-slate-400 font-medium uppercase tracking-wider">Real-time crew sync</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-sm text-slate-400 hover:text-white transition-colors">
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>

                <div className="p-2 sm:p-4 space-y-4 sm:space-y-6 overflow-y-auto custom-scrollbar">
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                        Generate secure, read-only links for your crew. You can share the entire plan or restrict access to specific acts.
                    </p>

                    {shareId && (
                        <div className="flex p-1 bg-slate-950 rounded-md border border-white/5">
                            <button 
                                onClick={() => { setViewMode('global'); setSelectedActId(null); }}
                                className={`flex-1 py-2 rounded-sm text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'global' ? 'bg-indigo-600 text-white shadow-sm border border-slate-700/50' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                Global Plan
                            </button>
                            <button 
                                onClick={() => setViewMode('acts')}
                                className={`flex-1 py-2 rounded-sm text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'acts' ? 'bg-indigo-600 text-white shadow-sm border border-slate-700/50' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                Act Specific
                            </button>
                        </div>
                    )}

                    {!shareId ? (
                        <button 
                            onClick={handleGenerateLink}
                            disabled={isGenerating}
                            className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest text-xs rounded-md shadow-sm border border-slate-700/50 shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"
                        >
                            {isGenerating ? (
                                <><span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span> Generating...</>
                            ) : (
                                <><LinkIcon className="w-4 h-4" /> Generate Live Link</>
                            )}
                        </button>
                    ) : (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            {viewMode === 'acts' && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select Act</label>
                                        <select 
                                            value={selectedActId || ''} 
                                            onChange={(e) => setSelectedActId(e.target.value || null)}
                                            className="w-full bg-slate-950 border border-white/10 rounded-md px-3 py-3 text-xs text-slate-300 outline-none focus:border-indigo-500 transition-colors"
                                        >
                                            <option value="">-- Select an Act --</option>
                                            {festivalActs.map(act => (
                                                <option key={act.id} value={act.id}>{act.actName}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">QR Code Size</label>
                                        <select 
                                            value={qrSize} 
                                            onChange={(e) => setQrSize(e.target.value as 'small' | 'medium' | 'large')}
                                            className="w-full bg-slate-950 border border-white/10 rounded-md px-3 py-3 text-xs text-slate-300 outline-none focus:border-indigo-500 transition-colors"
                                        >
                                            <option value="small">Small (Laminate)</option>
                                            <option value="medium">Medium (Standard)</option>
                                            <option value="large">Large (A4 Poster)</option>
                                        </select>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="checkbox" 
                                            id="showLink"
                                            checked={showLinkOnPrint}
                                            onChange={(e) => setShowLinkOnPrint(e.target.checked)}
                                            className="rounded border-white/10 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <label htmlFor="showLink" className="text-[10px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer">Include Link on Printout</label>
                                    </div>

                                    <button 
                                        onClick={handlePrintAll}
                                        className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-indigo-400 font-bold uppercase tracking-wider text-[10px] rounded-md transition-all flex items-center justify-center gap-2 border border-indigo-500/20"
                                    >
                                        <Printer className="w-3.5 h-3.5" /> Print All Act QR Codes
                                    </button>
                                </div>
                            )}

                            {(viewMode === 'global' || selectedActId) ? (
                                <>
                                    <div className="bg-white p-3 sm:p-2 rounded-md flex items-center justify-center mx-auto w-40 h-40 sm:w-48 sm:h-48 shadow-inner">
                                        <QRCodeSVG value={shareUrl} size={140} level="H" includeMargin={false} className="sm:hidden" />
                                        <QRCodeSVG value={shareUrl} size={160} level="H" includeMargin={false} className="hidden sm:block" />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                            {selectedActId ? 'Act Specific Link' : 'Global Crew Link'}
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 bg-slate-950 border border-white/10 rounded-md px-3 py-3 text-xs text-slate-300 font-mono truncate select-all">
                                                {shareUrl}
                                            </div>
                                            <button 
                                                onClick={handleCopy}
                                                className="p-3 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 rounded-md transition-colors shrink-0"
                                            >
                                                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                            {selectedActId ? 'Act Password (PIN)' : 'Global Password (PIN)'}
                                        </label>
                                        <input 
                                            type="text"
                                            placeholder="e.g. 1234"
                                            value={selectedActId ? (passwords[selectedActId] || '') : globalPassword}
                                            onChange={(e) => {
                                                if (selectedActId) {
                                                    setPasswords(prev => ({ ...prev, [selectedActId]: e.target.value }));
                                                } else {
                                                    setGlobalPassword(e.target.value);
                                                }
                                            }}
                                            className="w-full bg-slate-950 border border-white/10 rounded-md px-3 py-3 text-xs text-white outline-none focus:border-indigo-500 transition-colors"
                                        />
                                        <p className="text-[9px] text-slate-500 italic">Leave blank for no password</p>
                                    </div>
                                </>
                            ) : (
                                <div className="py-10 text-center border-2 border-dashed border-white/5 rounded-md">
                                    <p className="text-xs text-slate-500 font-medium uppercase tracking-widest">Select an act above to generate their QR code</p>
                                </div>
                            )}

                            <div className="flex gap-3 pt-2">
                                <button 
                                    onClick={handleGenerateLink}
                                    disabled={isGenerating}
                                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold uppercase tracking-wider text-[10px] rounded-md transition-all flex items-center justify-center gap-2"
                                >
                                    {isGenerating ? 'Pushing...' : 'Push Updates'}
                                </button>
                                <a 
                                    href={shareUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold uppercase tracking-wider text-[10px] rounded-md transition-all flex items-center justify-center gap-2"
                                >
                                    <ExternalLink className="w-3 h-3" /> Preview
                                </a>
                                <button 
                                    onClick={handleRevoke}
                                    className="py-3 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold uppercase tracking-wider text-[10px] rounded-md transition-all flex items-center justify-center"
                                    title="Revoke Link"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LiveShareModal;
