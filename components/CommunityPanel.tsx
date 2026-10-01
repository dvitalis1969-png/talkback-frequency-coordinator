import React, { useState, useRef, useEffect } from 'react';
import { Minus, Maximize2, GripVertical, MessageCircle, Bell, BellOff } from 'lucide-react';
import ChatWidget from './ChatWidget';
import PresenceIndicator from './PresenceIndicator';
import { collection, query, onSnapshot, doc, serverTimestamp, deleteDoc, setDoc } from 'firebase/firestore';
import { db, auth, getDocWithTimeout } from '../src/lib/firebase';
import { handleFirestoreError, OperationType } from '../src/utils/firestoreErrorHandler';
import { playNotificationSound, isNotificationsMuted, toggleNotificationsMute } from '../src/utils/audio';

import { User } from '../types';

const CommunityPanel: React.FC<{ projectId?: string | number; user: User | null; isOpen?: boolean; selectedDmUser?: any; onSelectDmUser?: (user: any) => void; onClose?: () => void }> = ({ projectId, user, isOpen, selectedDmUser, onSelectDmUser, onClose }) => {
  const [isMinimized, setIsMinimized] = useState(isOpen !== undefined ? !isOpen : true);
  const [position, setPosition] = useState({ x: 16, y: 40 });
  const [size, setSize] = useState({ width: 384, height: 600 });
  const [unreadDMs, setUnreadDMs] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState('');
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [isMuted, setIsMuted] = useState(isNotificationsMuted());
  const panelRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const isResizing = useRef(false);
  const isInitialLoadRef = useRef(true);
  const lastMousePos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (isOpen !== undefined) setIsMinimized(!isOpen);
  }, [isOpen]);

  const handleNotificationClick = async () => {
    if (totalUnread > 0) {
      const firstUnreadId = Object.keys(unreadDMs)[0];
      try {
        const userDoc = await getDocWithTimeout(doc(db, 'users', firstUnreadId));
        const userName = userDoc.exists() ? userDoc.data().name || 'Unknown User' : 'Unknown User';
        onSelectDmUser?.({ id: firstUnreadId, name: userName });
      } catch (err) {
        console.error("Error fetching user name:", err);
        onSelectDmUser?.({ id: firstUnreadId, name: 'Unknown User' });
      }
    }
    setIsMinimized(false);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    isResizing.current = true;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging.current) {
        const deltaX = e.clientX - lastMousePos.current.x;
        const deltaY = e.clientY - lastMousePos.current.y;
        
        setPosition(prev => ({
          x: prev.x - deltaX,
          y: prev.y - deltaY
        }));
        
        lastMousePos.current = { x: e.clientX, y: e.clientY };
      } else if (isResizing.current) {
        const deltaX = e.clientX - lastMousePos.current.x;
        const deltaY = e.clientY - lastMousePos.current.y;
        
        setSize(prev => ({
          width: Math.min(window.innerWidth - 32, Math.max(300, prev.width - deltaX)),
          height: Math.min(window.innerHeight - 32, Math.max(400, prev.height - deltaY))
        }));
        
        lastMousePos.current = { x: e.clientX, y: e.clientY };
      }
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      isResizing.current = false;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, 'users', auth.currentUser.uid, 'unread_dms'));
    
    let hasReceivedServerSnapshot = false;

    const unsub = onSnapshot(q, (snap) => {
      const unread: Record<string, boolean> = {};
      snap.forEach(doc => {
        if (doc.data().hasUnread) unread[doc.id] = true;
      });
      
      if (!snap.metadata.fromCache) {
        if (!hasReceivedServerSnapshot) {
          hasReceivedServerSnapshot = true;
        } else {
          const hasNewUnread = snap.docChanges().some(change => {
            // Only play sound if it's a new unread message and not from the currently open DM
            return (change.type === 'added' || change.type === 'modified') && 
                   change.doc.data().hasUnread && 
                   change.doc.id !== selectedDmUser?.id;
          });
          if (hasNewUnread) {
            playNotificationSound();
          }
        }
      }
      
      setUnreadDMs(unread);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `users/${auth.currentUser?.uid}/unread_dms`);
    });
    return () => unsub();
  }, [selectedDmUser]);

  // Global and Project Presence
  useEffect(() => {
    if (!auth.currentUser) return;

    const uid = auth.currentUser.uid;
    const name = auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || 'Anonymous';

    const updatePresence = async () => {
      try {
        // Global presence
        const globalRef = doc(db, 'presence', 'global', 'users', uid);
        await setDoc(globalRef, { 
          name,
          lastSeen: serverTimestamp(),
          status: 'online',
          statusMessage: status
        }, { merge: true });

        // Project presence
        const projectRef = doc(db, 'presence', String(projectId), 'users', uid);
        await setDoc(projectRef, {
          userId: uid,
          userName: name,
          lastSeen: serverTimestamp(),
          projectId: String(projectId),
          status: 'online',
          statusMessage: status
        }, { merge: true });
      } catch (err) {
        console.error("Error updating presence:", err);
      }
    };

    updatePresence();

    // Heartbeat
    const interval = setInterval(updatePresence, 30000);

    return () => {
      clearInterval(interval);
      if (!auth.currentUser) return;
      const globalRef = doc(db, 'presence', 'global', 'users', uid);
      const projectRef = doc(db, 'presence', String(projectId), 'users', uid);
      setDoc(globalRef, { status: 'offline', lastSeen: serverTimestamp() }, { merge: true }).catch(console.error);
      setDoc(projectRef, { status: 'offline', lastSeen: serverTimestamp() }, { merge: true }).catch(console.error);
    };
  }, [projectId, auth.currentUser?.uid, status]);

  const totalUnread = Object.keys(unreadDMs).length;

  return (
    <div 
      ref={panelRef}
      style={{ 
        position: 'fixed', 
        right: `${position.x}px`, 
        bottom: `${position.y}px`,
        width: isMinimized ? '48px' : `${size.width}px`,
        height: isMinimized ? '48px' : `${size.height}px`,
        maxWidth: isMinimized ? '48px' : 'calc(100vw - 32px)',
        maxHeight: isMinimized ? '48px' : 'calc(100vh - 32px)',
        zIndex: 100000
      }}
      className={`rounded-md shadow-2xl overflow-hidden flex flex-col transition-all duration-300 ${
        isMinimized 
          ? 'bg-indigo-950/90 border-2 border-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.4)] scale-105' 
          : 'bg-slate-800 border border-slate-500 shadow-[0_0_40px_rgba(0,0,0,0.6)]'
      }`}
    >
      {isMinimized ? (
        <button 
          onClick={handleNotificationClick}
          onMouseDown={handleMouseDown}
          className="w-full h-full flex flex-col items-center justify-center relative group hover:bg-indigo-900/50 transition-colors"
          title="Open The Intercom"
        >
          <span className="text-[11px] font-black text-white group-hover:text-indigo-200 transition-colors tracking-tighter drop-shadow-md">INT</span>
          {totalUnread > 0 && (
            <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full flex items-center justify-center border-2 border-indigo-950 animate-pulse shadow-sm border border-slate-700/50">
              <span className="text-[9px] font-black text-white">{totalUnread}</span>
            </div>
          )}
          <div className="absolute bottom-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <GripVertical className="w-2 h-2 text-slate-700" />
          </div>
        </button>
      ) : (
        <div className="p-2 flex flex-col h-full relative">
          <div 
            className="absolute top-0 left-0 w-4 h-4 cursor-nwse-resize z-50"
            onMouseDown={handleResizeMouseDown}
          />
          <div className="flex justify-between items-center mb-3 cursor-grab shrink-0 bg-slate-700/30 -mx-4 -mt-4 p-3 border-b border-white/5" onMouseDown={handleMouseDown}>
            <div className="flex items-center gap-2">
              <GripVertical className="w-4 h-4 text-slate-400" />
              <h3 className="text-[10px] font-black text-indigo-300 uppercase tracking-widest flex items-center gap-2">
                The Intercom
                {totalUnread > 0 && (
                  <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full animate-pulse flex items-center gap-1">
                    <MessageCircle className="w-3 h-3" />
                    {totalUnread}
                  </span>
                )}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => playNotificationSound()}
                className="text-slate-400 hover:text-white transition-colors text-[10px] uppercase font-bold"
                title="Test notification sound"
              >
                Test
              </button>
              <button 
                onClick={() => {
                  const isNowMuted = toggleNotificationsMute();
                  setIsMuted(isNowMuted);
                  if (!isNowMuted) {
                    playNotificationSound();
                  }
                }} 
                className="text-slate-400 hover:text-white transition-colors"
                title={isMuted ? "Unmute notifications" : "Mute notifications"}
              >
                {isMuted ? <BellOff className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
              </button>
              {projectId !== undefined && <PresenceIndicator projectId={projectId} />}
              <button onClick={() => { setIsMinimized(true); onClose?.(); }} className="text-slate-400 hover:text-white">
                <Minus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Status Bar */}
          <div className="mb-3 px-1">
            {isEditingStatus ? (
              <div className="flex gap-1">
                <input 
                  autoFocus
                  type="text"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && setIsEditingStatus(false)}
                  onBlur={() => setIsEditingStatus(false)}
                  placeholder="What are you working on?"
                  className="flex-1 bg-slate-900 border border-indigo-500/50 rounded px-2 py-1 text-[10px] text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            ) : (
              <button 
                onClick={() => setIsEditingStatus(true)}
                className="w-full text-left text-[10px] text-slate-400 hover:text-slate-200 transition-colors italic truncate px-1"
              >
                {status || "Set your status..."}
              </button>
            )}
          </div>

          <div className="flex-1 min-h-0 flex flex-col">
            <ChatWidget projectId={projectId} unreadDMs={unreadDMs} user={user} initialDmUser={selectedDmUser} />
          </div>
        </div>
      )}
    </div>
  );
};

export default CommunityPanel;
