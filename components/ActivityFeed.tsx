import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { collection, query, orderBy, onSnapshot, serverTimestamp, doc, arrayUnion, arrayRemove, where } from 'firebase/firestore';
import { db, auth, getDocsWithTimeout, updateDocWithTimeout, addDocWithTimeout, deleteDocWithTimeout } from '../src/lib/firebase';
import { isPro } from '../src/lib/userUtils';
import { User } from '../types';
import { handleFirestoreError, OperationType } from '../src/utils/firestoreErrorHandler';
import { Pencil, Trash2, Check, X, Loader2, ArrowLeft, UserCircle, ZoomIn, ZoomOut, RotateCcw, Image as ImageIcon, BarChart2, Heart, MessageSquare, Send } from 'lucide-react';

interface Post {
    id: string;
    authorId: string;
    authorName: string;
    isPro?: boolean;
    content: string;
    imageUrl?: string;
    plotData?: any;
    createdAt: any;
    likes: string[];
    comments: Comment[];
}

interface Comment {
    id: string;
    authorId: string;
    authorName: string;
    isPro?: boolean;
    content: string;
    createdAt: any;
}

interface Plot {
    id: string;
    imageData: string;
    description: string;
    timestamp?: any;
    userId?: string;
}

export const ActivityFeed: React.FC<{ user: User | null; theme?: 'light' | 'dark' }> = ({ user, theme = 'dark' }) => {
    const [posts, setPosts] = useState<Post[]>([]);
    const [newPostContent, setNewPostContent] = useState('');
    const [isPosting, setIsPosting] = useState(false);
    const [commentContent, setCommentContent] = useState<Record<string, string>>({});
    const [editingPostId, setEditingPostId] = useState<string | null>(null);
    const [editingContent, setEditingContent] = useState('');
    const [isUpdatingPost, setIsUpdatingPost] = useState(false);
    const [postToDelete, setPostToDelete] = useState<string | null>(null);
    
    const [attachedImage, setAttachedImage] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [showPlotSelector, setShowPlotSelector] = useState(false);
    const [userPlots, setUserPlots] = useState<Plot[]>([]);
    const [selectedPlot, setSelectedPlot] = useState<Plot | null>(null);
    const [error, setError] = useState<Error | null>(null);

    const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
    const [selectedProfileName, setSelectedProfileName] = useState<string | null>(null);
    const [expandedImage, setExpandedImage] = useState<string | null>(null);
    const [imageZoom, setImageZoom] = useState(1);

    const isDark = theme === 'dark';

    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, 'feed_posts'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedPosts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Post[];
            setPosts(fetchedPosts);
        }, (err) => {
            try {
                handleFirestoreError(err, OperationType.GET, 'feed_posts');
            } catch (e) {
                setError(e as Error);
            }
        });
        return () => unsubscribe();
    }, [user]);

    const fetchUserPlots = async () => {
        if (!user) return;
        try {
            // Removed orderBy('timestamp', 'desc') to avoid requiring a composite index in Firestore.
            // We will sort the results client-side instead.
            const q = query(collection(db, 'plots'), where('userId', '==', user.id));
            const snapshot = await getDocsWithTimeout(q);
            const plotsData: Plot[] = [];
            snapshot.forEach((doc) => {
                plotsData.push({ id: doc.id, ...doc.data() } as Plot);
            });
            
            // Sort plots by timestamp descending (newest first)
            plotsData.sort((a, b) => {
                const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : (a.timestamp?.seconds || 0);
                const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : (b.timestamp?.seconds || 0);
                return timeB - timeA;
            });
            
            setUserPlots(plotsData);
            setShowPlotSelector(true);
        } catch (err) {
            try {
                handleFirestoreError(err, OperationType.GET, 'plots');
            } catch (e) {
                setError(e as Error);
            }
        }
    };

    const compressImage = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 1920;
                    const MAX_HEIGHT = 1920;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.85));
                };
                img.onerror = (error) => reject(error);
            };
            reader.onerror = (error) => reject(error);
        });
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        if (!file.type.startsWith('image/')) {
            toast.error('Please select a valid image file.');
            return;
        }

        setIsUploading(true);
        try {
            const compressedDataUrl = await compressImage(file);
            setAttachedImage(compressedDataUrl);
            setSelectedPlot(null); // Clear plot if image is selected
        } catch (error) {
            console.error('Error compressing image:', error);
            toast.error('Failed to process image.');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handlePost = async () => {
        if ((!newPostContent.trim() && !attachedImage && !selectedPlot) || !user) return;
        
        setIsPosting(true);
        try {
            const postData: any = {
                authorId: user.id,
                authorName: user.name,
                isPro: isPro(user),
                content: newPostContent,
                createdAt: serverTimestamp(),
                likes: [],
                comments: []
            };

            if (attachedImage) {
                postData.imageUrl = attachedImage;
            } else if (selectedPlot) {
                postData.plotData = {
                    id: selectedPlot.id,
                    imageData: selectedPlot.imageData,
                    description: selectedPlot.description
                };
            }

            await addDocWithTimeout(collection(db, 'feed_posts'), postData);
            
            setNewPostContent('');
            setAttachedImage(null);
            setSelectedPlot(null);
        } catch (err) {
            console.error("Error posting:", err);
            try {
                handleFirestoreError(err, OperationType.CREATE, 'feed_posts');
            } catch (e) {
                setError(e as Error);
            }
        } finally {
            setIsPosting(false);
        }
    };

    const handleLike = async (postId: string, likes: string[]) => {
        if (!user) return;
        try {
            const postRef = doc(db, 'feed_posts', postId);
            if (likes.includes(user.id)) {
                await updateDocWithTimeout(postRef, { likes: arrayRemove(user.id) });
            } else {
                await updateDocWithTimeout(postRef, { likes: arrayUnion(user.id) });
            }
        } catch (err) {
            try {
                handleFirestoreError(err, OperationType.UPDATE, `feed_posts/${postId}`);
            } catch (e) {
                setError(e as Error);
            }
        }
    };

    const handleComment = async (postId: string) => {
        if (!user || !commentContent[postId]?.trim()) return;
        
        try {
            const postRef = doc(db, 'feed_posts', postId);
            const newComment = {
                id: Date.now().toString(),
                authorId: user.id,
                authorName: user.name,
                isPro: isPro(user),
                content: commentContent[postId],
                createdAt: new Date()
            };
            await updateDocWithTimeout(postRef, { comments: arrayUnion(newComment) });
            setCommentContent(prev => ({ ...prev, [postId]: '' }));
        } catch (err) {
            try {
                handleFirestoreError(err, OperationType.UPDATE, `feed_posts/${postId}`);
            } catch (e) {
                setError(e as Error);
            }
        }
    };

    const handleDeletePost = async () => {
        if (!user || !postToDelete) return;
        try {
            await deleteDocWithTimeout(doc(db, 'feed_posts', postToDelete));
            setPostToDelete(null);
        } catch (err) {
            console.error("Error deleting post:", err);
            try {
                handleFirestoreError(err, OperationType.DELETE, `feed_posts/${postToDelete}`);
            } catch (e) {
                setError(e as Error);
            }
        }
    };

    const handleStartEdit = (post: Post) => {
        setEditingPostId(post.id);
        setEditingContent(post.content);
    };

    const handleSaveEdit = async (postId: string) => {
        if (!user || !editingContent.trim()) return;
        setIsUpdatingPost(true);
        try {
            const postRef = doc(db, 'feed_posts', postId);
            await updateDocWithTimeout(postRef, {
                content: editingContent,
                updatedAt: serverTimestamp()
            });
            setEditingPostId(null);
            setEditingContent('');
        } catch (err) {
            console.error("Error updating post:", err);
            try {
                handleFirestoreError(err, OperationType.UPDATE, `feed_posts/${postId}`);
            } catch (e) {
                setError(e as Error);
            }
        } finally {
            setIsUpdatingPost(false);
        }
    };

    const handleCancelEdit = () => {
        setEditingPostId(null);
        setEditingContent('');
    };

    const handleProfileClick = (userId: string, userName: string) => {
        setSelectedProfileId(userId);
        setSelectedProfileName(userName);
    };

    const clearProfileFilter = () => {
        setSelectedProfileId(null);
        setSelectedProfileName(null);
    };

    const displayedPosts = selectedProfileId 
        ? posts.filter(p => p.authorId === selectedProfileId)
        : posts;

    if (error) {
        return (
            <div className="p-4 text-center bg-slate-900/60 rounded-md border border-rose-500/30">
                <h2 className="text-xs font-black uppercase tracking-widest text-rose-400 mb-1.5">Activity Feed Error</h2>
                <div className="text-slate-400 mb-3 text-xs">
                    {error.message.includes('permission') 
                        ? "You don't have permission to view the activity feed. Please check your Firebase security rules."
                        : error.message}
                </div>
                <button 
                    onClick={() => window.location.reload()}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-md text-[10px] font-black uppercase tracking-wider text-white transition-colors"
                >
                    Reload Feed
                </button>
            </div>
        );
    }

    if (!user) {
        return <div className="p-8 text-center text-xs font-mono text-slate-500">Please sign in to view the Activity Feed.</div>;
    }

    return (
        <div className={`h-full flex flex-col ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {selectedProfileId ? (
                <div className={`p-2.5 border-b flex items-center justify-between transition-colors ${isDark ? 'bg-slate-900/60 border-white/10' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-md flex items-center justify-center font-mono font-bold text-xs text-indigo-300 bg-slate-800 border border-indigo-500/30">
                            {selectedProfileName?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h2 className={`font-bold text-xs ${isDark ? 'text-white' : 'text-slate-900'}`}>{selectedProfileName}</h2>
                            <p className="text-[10px] font-mono text-slate-400">{displayedPosts.length} post{displayedPosts.length !== 1 ? 's' : ''}</p>
                        </div>
                    </div>
                    <button 
                        onClick={clearProfileFilter}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all border ${isDark ? 'bg-slate-800/80 hover:bg-slate-700 border-white/10 text-slate-300 hover:text-white' : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'}`}
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        Feed
                    </button>
                </div>
            ) : (
                <div className={`p-2.5 border-b ${isDark ? 'bg-slate-900/40 border-white/10' : 'bg-white border-slate-200'}`}>
                    <textarea
                        value={newPostContent}
                        onChange={(e) => setNewPostContent(e.target.value)}
                        placeholder="Share a technical update, measurement, or frequency plot..."
                        className={`w-full border rounded-md p-2.5 text-xs focus:outline-none focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/40 resize-none min-h-[64px] transition-all font-sans ${
                            isDark ? 'bg-slate-950/70 border-white/10 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                        }`}
                    />
                    
                    {/* Attachments Preview */}
                    {attachedImage && (
                        <div className="relative mt-2.5 inline-block">
                            <img 
                                src={attachedImage} 
                                alt="Attachment" 
                                className="max-h-36 rounded-md border border-white/10 cursor-pointer hover:opacity-90 transition-opacity" 
                                onClick={() => setExpandedImage(attachedImage)}
                            />
                            <button 
                                onClick={() => setAttachedImage(null)}
                                className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold hover:bg-rose-600 transition-colors shadow-sm"
                            >
                                ×
                            </button>
                        </div>
                    )}
                    
                    {selectedPlot && (
                        <div className="relative mt-2.5 inline-block bg-slate-950/80 p-2 rounded-md border border-indigo-500/40 max-w-[240px]">
                            <div className="text-[9px] font-mono text-indigo-400 font-bold mb-1 uppercase tracking-widest flex items-center gap-1">
                                <BarChart2 className="w-3 h-3" /> Attached Plot
                            </div>
                            <img 
                                src={selectedPlot.imageData} 
                                alt="Plot" 
                                className="max-h-28 rounded-sm border border-white/10 cursor-pointer hover:opacity-90 transition-opacity" 
                                onClick={() => setExpandedImage(selectedPlot.imageData)}
                            />
                            <div className="text-[10px] font-mono text-slate-300 mt-1 truncate">{selectedPlot.description || 'RF Spectrum Plot'}</div>
                            <button 
                                onClick={() => setSelectedPlot(null)}
                                className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold hover:bg-rose-600 transition-colors shadow-sm"
                            >
                                ×
                            </button>
                        </div>
                    )}

                    <div className="flex justify-between items-center mt-2.5 pt-2.5 border-t border-white/5">
                        <div className="flex items-center gap-1.5">
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                ref={fileInputRef}
                                onChange={handleImageUpload}
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading || !!selectedPlot}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md border transition-all disabled:opacity-40 ${isDark ? 'bg-slate-800/80 hover:bg-slate-700 border-white/10 text-slate-300 hover:text-white' : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-600'}`}
                            >
                                <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                                <span>{isUploading ? 'Compressing...' : 'Image'}</span>
                            </button>
                            <button
                                onClick={fetchUserPlots}
                                disabled={!!attachedImage}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md border transition-all disabled:opacity-40 ${isDark ? 'bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border-indigo-500/30' : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border-indigo-200'}`}
                            >
                                <BarChart2 className="w-3.5 h-3.5" />
                                <span>Share Plot</span>
                            </button>
                        </div>
                        <button
                            onClick={handlePost}
                            disabled={isPosting || (!newPostContent.trim() && !attachedImage && !selectedPlot)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-md border transition-all disabled:opacity-40 ${isDark ? 'bg-indigo-600 hover:bg-indigo-500 border-indigo-400/30 text-white shadow-sm' : 'bg-indigo-600 hover:bg-indigo-700 border-indigo-700 text-white shadow-sm'}`}
                        >
                            {isPosting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                            <span>Post</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Plot Selector Modal */}
            {showPlotSelector && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm">
                    <div className="bg-slate-950 border border-white/10 rounded-md p-4 max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl">
                        <div className="flex justify-between items-center mb-4 pb-2 border-b border-white/10">
                            <h2 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                                <BarChart2 className="w-4 h-4 text-indigo-400" />
                                Select a Plot to Share
                            </h2>
                            <button onClick={() => setShowPlotSelector(false)} className="text-slate-400 hover:text-white p-1 rounded hover:bg-white/10">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
                            {userPlots.length === 0 ? (
                                <div className="text-center text-slate-500 font-mono text-xs py-10">No saved plots found in your project library.</div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    {userPlots.map(plot => (
                                        <div 
                                            key={plot.id} 
                                            onClick={() => {
                                                setSelectedPlot(plot);
                                                setAttachedImage(null);
                                                setShowPlotSelector(false);
                                            }}
                                            className="bg-slate-900/60 border border-white/5 hover:border-indigo-500/50 rounded-md p-2.5 cursor-pointer transition-all hover:bg-slate-900 group"
                                        >
                                            <img src={plot.imageData} alt="Plot" className="w-full h-28 object-cover rounded-sm border border-white/5 mb-2 group-hover:border-indigo-500/30 transition-colors" />
                                            <div className="text-[11px] font-mono text-slate-300 truncate">{plot.description || 'RF Spectrum Plot'}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Expanded Image Modal */}
            {expandedImage && createPortal(
                <div className="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center p-2">
                    <motion.div 
                        drag 
                        dragMomentum={false}
                        className="pointer-events-auto bg-slate-950 border border-white/10 shadow-2xl rounded-md flex flex-col overflow-hidden"
                        style={{ width: '80vw', height: '80vh', maxWidth: '1200px', maxHeight: '900px' }}
                    >
                        {/* Draggable Header */}
                        <div className="bg-slate-900/90 backdrop-blur-md p-2.5 flex justify-between items-center cursor-grab active:cursor-grabbing border-b border-white/10">
                            <h3 className="text-white font-mono text-xs px-2 uppercase tracking-wider font-bold">Image Inspector</h3>
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1 bg-slate-900/80 rounded-md p-1 border border-white/10 mr-1">
                                    <button 
                                        onClick={() => setImageZoom(prev => Math.max(0.25, prev - 0.25))}
                                        className="text-slate-400 hover:text-white hover:bg-white/10 p-1.5 rounded transition-colors cursor-pointer"
                                        title="Zoom Out"
                                    >
                                        <ZoomOut className="w-3.5 h-3.5" />
                                    </button>
                                    <span className="text-slate-300 text-[10px] font-mono w-10 text-center">
                                        {Math.round(imageZoom * 100)}%
                                    </span>
                                    <button 
                                        onClick={() => setImageZoom(prev => Math.min(5, prev + 0.25))}
                                        className="text-slate-400 hover:text-white hover:bg-white/10 p-1.5 rounded transition-colors cursor-pointer"
                                        title="Zoom In"
                                    >
                                        <ZoomIn className="w-3.5 h-3.5" />
                                    </button>
                                    <button 
                                        onClick={() => setImageZoom(1)}
                                        className="text-slate-400 hover:text-white hover:bg-white/10 p-1.5 rounded transition-colors cursor-pointer ml-0.5 border-l border-white/10 pl-1.5"
                                        title="Reset Zoom"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                <button 
                                    onClick={() => {
                                        setExpandedImage(null);
                                        setImageZoom(1);
                                    }}
                                    className="text-slate-400 hover:text-white hover:bg-rose-500/20 hover:text-rose-400 p-1.5 rounded-md transition-colors cursor-pointer border border-transparent hover:border-rose-500/30"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        {/* Image Content */}
                        <div 
                            className="flex-1 overflow-auto bg-black/90 p-2 flex items-center justify-center cursor-move"
                            onWheel={(e) => {
                                if (e.deltaY < 0) {
                                    setImageZoom(prev => Math.min(5, prev + 0.1));
                                } else {
                                    setImageZoom(prev => Math.max(0.25, prev - 0.1));
                                }
                            }}
                        >
                            <img 
                                src={expandedImage} 
                                alt="Expanded" 
                                className="max-w-full max-h-full object-contain transition-transform duration-100 origin-center" 
                                style={{ transform: `scale(${imageZoom})` }}
                                draggable={false} 
                            />
                        </div>
                    </motion.div>
                </div>,
                document.body
            )}

            <div className="flex-1 overflow-y-auto p-2 space-y-2.5 custom-scrollbar">
                {displayedPosts.map(post => (
                    <div key={post.id} className={`border rounded-md p-3 backdrop-blur-xl transition-all shadow-xs ${isDark ? 'bg-slate-900/40 hover:bg-slate-900/60 border-white/5 hover:border-white/10' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                        <div className="flex items-center gap-2 mb-2">
                            <button 
                                onClick={() => handleProfileClick(post.authorId, post.authorName)}
                                className={`w-6 h-6 rounded bg-slate-800/90 border border-white/10 flex items-center justify-center font-mono font-bold text-[10px] text-indigo-300 shrink-0 transition-colors shadow-xs hover:border-indigo-500/40`}
                            >
                                {post.authorName.charAt(0).toUpperCase()}
                            </button>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <button 
                                        onClick={() => handleProfileClick(post.authorId, post.authorName)}
                                        className={`font-semibold text-xs hover:underline truncate ${isDark ? 'text-slate-200 hover:text-white' : 'text-slate-900'}`}
                                    >
                                        {post.authorName}
                                    </button>
                                    {post.isPro && (
                                        <span className="inline-flex items-center px-1 py-0.2 rounded text-[8px] font-mono font-black bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 uppercase tracking-wider" title="Pro User">
                                            PRO
                                        </span>
                                    )}
                                </div>
                                <div className="text-[9px] font-mono text-slate-500">
                                    {post.createdAt?.toDate ? post.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                                </div>
                            </div>
                            {user.id === post.authorId && (
                                <div className="flex items-center gap-0.5">
                                    <button 
                                        onClick={() => handleStartEdit(post)}
                                        className="p-1 rounded text-slate-500 hover:text-indigo-400 hover:bg-white/5 transition-colors"
                                        title="Edit Post"
                                    >
                                        <Pencil className="w-3 h-3" />
                                    </button>
                                    <button 
                                        onClick={() => setPostToDelete(post.id)}
                                        className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-white/5 transition-colors"
                                        title="Delete Post"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            )}
                        </div>
                        
                        {editingPostId === post.id ? (
                            <div className="mb-2.5 space-y-2">
                                <textarea
                                    value={editingContent}
                                    onChange={(e) => setEditingContent(e.target.value)}
                                    className={`w-full border rounded-md p-2 text-xs focus:outline-none focus:border-indigo-500 resize-none min-h-[64px] transition-all font-sans ${
                                        isDark ? 'bg-slate-950/70 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                                    }`}
                                />
                                <div className="flex justify-end gap-1.5">
                                    <button 
                                        onClick={handleCancelEdit}
                                        className="p-1 text-slate-400 hover:text-white transition-colors rounded"
                                        title="Cancel"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                    <button 
                                        onClick={() => handleSaveEdit(post.id)}
                                        disabled={isUpdatingPost || !editingContent.trim()}
                                        className="px-2.5 py-1 bg-indigo-600 text-white rounded text-[10px] font-bold uppercase hover:bg-indigo-500 transition-colors disabled:opacity-50 flex items-center gap-1"
                                        title="Save Changes"
                                    >
                                        {isUpdatingPost ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                        <span>Save</span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            post.content && <p className={`whitespace-pre-wrap text-xs leading-relaxed mb-2 font-sans ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{post.content}</p>
                        )}
                        
                        {post.imageUrl && (
                            <img 
                                src={post.imageUrl} 
                                alt="Post attachment" 
                                className={`max-w-full rounded-md border mb-2 cursor-pointer hover:opacity-90 transition-opacity ${isDark ? 'border-white/10' : 'border-slate-200'}`} 
                                onClick={() => setExpandedImage(post.imageUrl!)}
                            />
                        )}
                        
                        {post.plotData && (
                            <div className={`border rounded-md p-2 mb-2 ${isDark ? 'bg-slate-950/70 border-indigo-500/30' : 'bg-indigo-50/50 border-indigo-200'}`}>
                                <div className="flex items-center gap-1.5 mb-1 text-indigo-400 text-[9px] font-mono font-bold uppercase tracking-widest">
                                    <BarChart2 className="w-3 h-3" /> Shared Spectrum Plot
                                </div>
                                <img 
                                    src={post.plotData.imageData} 
                                    alt="Shared Plot" 
                                    className={`w-full rounded border cursor-pointer hover:opacity-90 transition-opacity ${isDark ? 'border-white/5' : 'border-slate-200'}`} 
                                    onClick={() => setExpandedImage(post.plotData.imageData)}
                                />
                                <div className={`mt-1 text-[10px] font-mono truncate ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{post.plotData.description}</div>
                            </div>
                        )}
                        
                        <div className={`flex items-center gap-3 pt-2 border-t ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
                            <button 
                                onClick={() => handleLike(post.id, post.likes || [])}
                                className={`flex items-center gap-1 text-[11px] font-mono transition-colors ${post.likes?.includes(user?.id || '') ? 'text-rose-400 font-bold' : 'text-slate-400 hover:text-white'}`}
                            >
                                <Heart className={`w-3.5 h-3.5 ${post.likes?.includes(user?.id || '') ? 'fill-rose-500 text-rose-500' : 'text-slate-400'}`} />
                                <span>{post.likes?.length || 0}</span>
                            </button>
                            <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
                                <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                                <span>{post.comments?.length || 0}</span>
                            </div>
                        </div>

                        {/* Comments Section */}
                        {post.comments && post.comments.length > 0 && (
                            <div className="mt-2 space-y-1">
                                {post.comments.map(comment => (
                                    <div key={comment.id} className={`rounded p-1.5 text-xs border ${isDark ? 'bg-slate-950/60 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                                        <div className="inline-flex items-center gap-1.5 mr-1.5">
                                            <button 
                                                onClick={() => handleProfileClick(comment.authorId, comment.authorName)}
                                                className={`font-semibold text-[11px] hover:underline ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}
                                            >
                                                {comment.authorName}
                                            </button>
                                            {comment.isPro && (
                                                <span className="inline-flex items-center px-1 py-0.2 rounded text-[7px] font-mono font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 uppercase tracking-wider" title="Pro User">
                                                    PRO
                                                </span>
                                            )}
                                        </div>
                                        <span className={`text-[11px] ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{comment.content}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="flex gap-1.5 mt-2">
                            <input
                                type="text"
                                value={commentContent[post.id] || ''}
                                onChange={(e) => setCommentContent(prev => ({ ...prev, [post.id]: e.target.value }))}
                                placeholder="Reply..."
                                className={`flex-1 border rounded px-2.5 py-1 text-xs focus:outline-none transition-all ${isDark ? 'bg-slate-950/70 border-white/10 text-white placeholder-slate-500 focus:border-indigo-500/70' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500'}`}
                                onKeyDown={(e) => e.key === 'Enter' && handleComment(post.id)}
                            />
                            <button
                                onClick={() => handleComment(post.id)}
                                disabled={!commentContent[post.id]?.trim()}
                                className={`px-2.5 py-1 text-white text-[10px] font-bold uppercase tracking-wider rounded transition-colors disabled:opacity-40 ${isDark ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                            >
                                Reply
                            </button>
                        </div>
                    </div>
                ))}
                {displayedPosts.length === 0 && (
                    <div className="text-center text-slate-500 font-mono text-xs py-8">
                        {selectedProfileId ? "No posts from this engineer yet." : "No live updates yet. Post the first update!"}
                    </div>
                )}
            </div>

            {postToDelete && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 bg-black/80 backdrop-blur-sm">
                    <div className="bg-slate-950 border border-white/10 rounded-md p-4 max-w-sm w-full shadow-2xl">
                        <h3 className="text-xs font-black uppercase tracking-widest text-white mb-2">Delete Post</h3>
                        <p className="text-slate-400 text-xs mb-5">Are you sure you want to delete this post? This action cannot be undone.</p>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setPostToDelete(null)}
                                className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeletePost}
                                className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded transition-colors border border-red-500/30"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
