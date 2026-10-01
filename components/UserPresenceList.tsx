import React, { useState, useEffect, useMemo } from 'react';
import { Users, Clock } from 'lucide-react';
import { collection, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../src/lib/firebase';

interface UserStatus {
  id: string;
  name: string;
  lastSeen: any; // Firestore Timestamp
  isOnline: boolean;
  isPro?: boolean;
  statusMessage?: string;
}

interface UserPresenceListProps {
  onUserClick?: (user: { id: string; name: string; isPro?: boolean; statusMessage?: string }) => void;
}

const UserPresenceList: React.FC<UserPresenceListProps> = React.memo(({ onUserClick }) => {
  const [users, setUsers] = useState<UserStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'presence', 'global', 'users'),
      orderBy('lastSeen', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const now = Date.now();
      const fetchedUsers = snapshot.docs.map(doc => {
        const data = doc.data();
        // Handle null lastSeen (latency compensation) by assuming it's current
        const lastSeenMillis = data.lastSeen?.toMillis() || now;
        // Consider online if status is 'online' AND seen in last 5 minutes (fallback)
        const isOnline = data.status === 'online' && (now - lastSeenMillis < 300000);
        
        return {
          id: doc.id,
          name: data.name || 'Anonymous',
          lastSeen: lastSeenMillis,
          isOnline,
          isPro: data.isPro || false,
          statusMessage: data.statusMessage
        } as UserStatus;
      });
      setUsers(fetchedUsers);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching presence:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const onlineUsers = users.filter(u => u.isOnline);

  const renderedOnline = useMemo(() => (
    onlineUsers.length > 0 ? (
      <div className="space-y-1">
        {onlineUsers.map(user => (
          <div 
            key={user.id} 
            onClick={() => {
              console.log("User clicked:", user);
              onUserClick?.(user);
            }}
            className={`flex items-center justify-between p-1.5 rounded-md transition-all group ${
              onUserClick 
                ? 'cursor-pointer hover:bg-white/5 border border-transparent hover:border-white/10' 
                : 'cursor-default'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded bg-slate-800/90 border border-white/10 group-hover:border-indigo-500/40 flex items-center justify-center text-[10px] font-mono font-bold text-indigo-300 group-hover:text-indigo-200 shrink-0 transition-colors shadow-xs">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-200 group-hover:text-white transition-colors truncate">
                    {user.name}
                  </span>
                  {user.isPro && (
                    <span className="text-[8px] font-mono font-black uppercase px-1 py-0.2 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 tracking-wider">
                      PRO
                    </span>
                  )}
                </div>
                {user.statusMessage && (
                  <span className="text-[9px] font-mono text-slate-400 truncate block">
                    {user.statusMessage}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0 ml-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/90 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
            </div>
          </div>
        ))}
      </div>
    ) : (
      <div className="text-[10px] font-mono text-slate-500 italic px-1 py-2">No engineers online</div>
    )
  ), [onlineUsers, onUserClick]);

  if (loading && users.length === 0) {
    return (
      <div className="shrink-0 p-3 border-b border-white/10 bg-slate-900/30 animate-pulse">
        <div className="h-3 w-28 bg-slate-800 rounded mb-2.5" />
        <div className="space-y-1.5">
          <div className="h-7 w-full bg-slate-800/60 rounded" />
          <div className="h-7 w-full bg-slate-800/60 rounded" />
        </div>
      </div>
    );
  }

  if (onlineUsers.length === 0) return null;

  return (
    <div className="shrink-0 max-h-[26vh] flex flex-col px-3 py-2.5 border-b border-white/10 bg-slate-900/30">
      <div className="flex items-center justify-between mb-2 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
            Active Engineers
          </h4>
        </div>
        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
          {onlineUsers.length} ONLINE
        </span>
      </div>

      <div className="overflow-y-auto custom-scrollbar pr-0.5">
        {renderedOnline}
      </div>
    </div>
  );
});

export default UserPresenceList;
