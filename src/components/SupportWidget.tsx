import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, SupportMessage } from '../types';
import { MessageCircle, X, Send, ShieldCheck, UserCheck, Loader2, Headphones, Minimize2, Trash2, Check, Tag } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

interface SupportWidgetProps {
  currentUser?: UserProfile;
  hidden?: boolean;
}

const SUPPORT_CATEGORIES = [
  { id: 'Deposit Issue', label: '💳 Deposit Issue' },
  { id: 'Result Dispute', label: '⚔️ Result Dispute' },
  { id: 'Withdrawal Issue', label: '💸 Withdrawal Issue' },
  { id: 'General Inquiry', label: '💬 General Inquiry' },
];

export const SupportWidget: React.FC<SupportWidgetProps> = ({ currentUser, hidden = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('General Inquiry');
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  // Persistent guest identity so guests keep their ticket conversation across re-renders
  const [guestId] = useState<string>(() => {
    try {
      let stored = localStorage.getItem('codm_guest_support_id');
      if (!stored) {
        stored = `guest_${Math.random().toString(36).substring(2, 8)}`;
        localStorage.setItem('codm_guest_support_id', stored);
      }
      return stored;
    } catch {
      return `guest_${Date.now()}`;
    }
  });

  const savedUserId = typeof window !== 'undefined' ? localStorage.getItem('codm_current_user_id') : null;
  const isAdminOrMod = Boolean(currentUser && (currentUser.role === 'admin' || currentUser.role === 'super_admin' || currentUser.role === 'moderator'));
  
  // Use savedUserId immediately so page reload doesn't start with guestId during async auth check
  const userId = (currentUser && currentUser.id && currentUser.id !== 'guest')
    ? currentUser.id
    : (savedUserId && savedUserId !== 'guest' ? savedUserId : guestId);

  const userName = (currentUser && currentUser.id && currentUser.id !== 'guest')
    ? (currentUser.codmIgn || currentUser.username || 'User')
    : 'Player';

  const userRole = (currentUser && currentUser.id && currentUser.id !== 'guest')
    ? (currentUser.role || 'user')
    : 'user';

  const supportRoom = isAdminOrMod ? 'support_admin_room' : `support_user_${userId}`;

  // Helper to normalize message payload from socket or REST
  const normalizeMsg = (m: any): SupportMessage => ({
    id: m.id || `sup_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    userId: m.userId || m.user_id || userId,
    senderName: m.senderName || m.sender_name || 'User',
    senderRole: m.senderRole || m.sender_role || 'user',
    text: m.text || '',
    category: m.category || 'General Inquiry',
    room: m.room || `support_user_${userId}`,
    status: m.status || 'open',
    timestamp: typeof m.timestamp === 'string' ? Number(m.timestamp) : (Number(m.timestamp) || Date.now()),
  });

  // Allow opening widget from anywhere in the app (e.g. Navbar support button, FAQ links)
  useEffect(() => {
    const handleOpen = () => {
      setIsCancelled(false);
      setIsOpen(true);
    };
    window.addEventListener('open-support-widget', handleOpen);
    return () => window.removeEventListener('open-support-widget', handleOpen);
  }, []);

  useEffect(() => {
    const cancelledTime = localStorage.getItem(`codm_support_cancelled_${userId}`);
    if (cancelledTime) {
      const elapsed = Date.now() - parseInt(cancelledTime, 10);
      if (elapsed < 60000) {
        setIsCancelled(true);
        const timer = setTimeout(() => {
          setIsCancelled(false);
          localStorage.removeItem(`codm_support_cancelled_${userId}`);
        }, 60000 - elapsed);
        return () => clearTimeout(timer);
      } else {
        localStorage.removeItem(`codm_support_cancelled_${userId}`);
      }
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const socket = io();
    socketRef.current = socket;

    socket.emit('join_support_room', { userId, role: userRole, room: supportRoom });

    socket.on('support_message', (rawMsg: any) => {
      const msg = normalizeMsg(rawMsg);
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });

    // Clear chat immediately when ticket is resolved by admin or cleared
    socket.on('support_cleared', (data: { userId: string }) => {
      if (!data || data.userId === userId) {
        setMessages([]);
      }
    });

    loadChatHistory();

    return () => {
      socket.disconnect();
    };
  }, [userId, supportRoom]);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [isOpen, messages]);

  const loadChatHistory = async () => {
    if (!userId) return;
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/support/messages?userId=${userId}`);
      const data = await res.json();
      if (data && Array.isArray(data.messages)) {
        setMessages(data.messages.map(normalizeMsg));
      }
    } catch (err) {
      console.warn('Could not load support messages history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending) return;

    const textToSend = inputText.trim();
    setInputText('');
    setIsSending(true);

    const msgId = `sup_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const timestamp = Date.now();
    const newMsg: SupportMessage = {
      id: msgId,
      userId,
      senderName: userName,
      senderRole: userRole,
      text: textToSend,
      category: selectedCategory,
      room: supportRoom,
      status: 'open',
      timestamp,
    };

    setMessages((prev) => [...prev, newMsg]);

    try {
      if (socketRef.current) {
        socketRef.current.emit('support_message', {
          ...newMsg,
          targetUserId: userId,
          targetRoom: supportRoom,
        });
      }

      await fetch('/api/support/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: msgId,
          userId,
          senderName: userName,
          senderRole: userRole,
          text: textToSend,
          category: selectedCategory,
          room: supportRoom,
          timestamp,
        }),
      });
    } catch (err) {
      console.error('Failed to send support message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleClearChat = async () => {
    if (!confirm('Clear support chat?')) return;
    try {
      const res = await fetch(`/api/support/messages?userId=${userId}`, { method: 'DELETE' });
      if (res.ok) {
        setMessages([]);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to clear support chat.');
      }
    } catch (err) {
      console.error('Failed to clear support chat:', err);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleSnooze = () => {
    setIsOpen(false);
    setIsCancelled(true);
    localStorage.setItem(`codm_support_cancelled_${userId}`, Date.now().toString());
    setTimeout(() => {
      setIsCancelled(false);
      localStorage.removeItem(`codm_support_cancelled_${userId}`);
    }, 60000);
  };

  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number }>({ startX: 0, startY: 0, initialX: 0, initialY: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: position.x,
      initialY: position.y,
    };
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setPosition({
        x: dragRef.current.initialX + dx,
        y: dragRef.current.initialY + dy,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  if (hidden || isCancelled) return null;

  return (
    <div
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
      }}
      className="fixed bottom-6 right-6 z-[60] select-none"
    >
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="relative group flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-neutral-950 font-black rounded-full shadow-[0_10px_30px_rgba(245,158,11,0.3)] transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer border border-amber-300/50"
          title="Open Live Customer Support"
          aria-label="Customer Support"
        >
          <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-neutral-950 animate-pulse" />
          <Headphones size={22} className="stroke-[2.5]" />
          <span className="text-xs uppercase tracking-wider font-heading">Support Chat</span>
        </button>
      )}

      {isOpen && (
        <div className="w-[90vw] sm:w-[400px] h-[580px] bg-neutral-900 border border-neutral-800 rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300">
          <div
            onMouseDown={handleMouseDown}
            className="p-4 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between cursor-grab active:cursor-grabbing"
            title="Click and drag to move chat window"
          >
            <div className="flex items-center gap-3 pointer-events-none">
              <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0">
                <Headphones size={20} />
              </div>
              <div>
                <div className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <span>Customer Support</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <p className="text-[10px] text-neutral-400 font-mono">
                  {isAdminOrMod ? 'Staff Mode · Live Channel' : 'Online · Admin & Mod Assistance'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleClearChat}
                title="Clear Resolved Chat"
                className="p-2 rounded-xl text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <Trash2 size={16} />
              </button>
              <button
                onClick={handleClose}
                title="Minimize Support Chat"
                className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <Minimize2 size={16} />
              </button>
              <button
                onClick={handleClose}
                title="Close"
                className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Query Category Selector Dropdown / Pills */}
          {!isAdminOrMod && (
            <div className="px-4 py-3 bg-black/40 border-b border-neutral-800 flex items-center gap-2 overflow-x-auto">
              <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest shrink-0 flex items-center gap-1">
                <Tag size={12} /> Category:
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                {SUPPORT_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer ${
                      selectedCategory === cat.id
                        ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/10'
                        : 'bg-neutral-800/80 text-neutral-400 hover:bg-neutral-800 hover:text-white'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-neutral-950/60 font-sans">
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] leading-relaxed space-y-1">
              <div className="font-bold uppercase tracking-wide flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck size={13} className="text-amber-400" />
                  <span>Secure Support Channel</span>
                </div>
                {messages.length > 0 && messages[messages.length - 1].status === 'resolved' && (
                   <span className="px-1.5 py-0.5 rounded bg-emerald-500 text-neutral-950 text-[8px] font-black animate-pulse">RESOLVED</span>
                )}
              </div>
              <p className="opacity-90">
                Welcome{currentUser ? `, ${userName}` : ''}! Your query is categorized as <b className="text-amber-400">{selectedCategory}</b> for prompt admin routing.
              </p>
              {messages.length > 0 && messages[messages.length - 1].status === 'resolved' && (
                <p className="text-[9px] text-emerald-400 font-bold mt-1">This ticket has been marked as resolved by staff. You can now clear the history if desired.</p>
              )}
            </div>

            {loadingHistory && (
              <div className="flex justify-center py-6">
                <Loader2 size={24} className="animate-spin text-amber-400" />
              </div>
            )}

            {messages.map((msg) => {
              const isStaff = msg.senderRole === 'admin' || msg.senderRole === 'super_admin' || msg.senderRole === 'moderator';
              const isMe = isAdminOrMod ? isStaff : !isStaff;

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-1.5 mb-1 px-1">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase">
                      {msg.senderName}
                    </span>
                    {msg.category && !isStaff && (
                      <span className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 font-mono text-[8px] uppercase border border-neutral-700">
                        {msg.category}
                      </span>
                    )}
                    {isStaff && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-400 font-mono font-bold text-[9px] uppercase border border-amber-400/30">
                        Staff
                      </span>
                    )}
                    <span className="text-[9px] text-neutral-600 font-mono">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div
                    className={`p-3.5 rounded-2xl text-xs leading-relaxed max-w-[85%] break-words ${
                      isMe
                        ? 'bg-amber-400 text-neutral-950 font-medium rounded-tr-sm shadow-md'
                        : isStaff
                        ? 'bg-neutral-800 border border-amber-400/30 text-white rounded-tl-sm shadow-md'
                        : 'bg-neutral-900 border border-neutral-800 text-neutral-200 rounded-tl-sm'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              );
            })}

            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="p-3 bg-neutral-950 border-t border-neutral-800 flex items-center gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Type ${selectedCategory.toLowerCase()} message...`}
              className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-xs text-white focus:border-amber-400 focus:outline-none placeholder:text-neutral-600"
            />
            <button
              type="submit"
              disabled={isSending || !inputText.trim()}
              className="p-3 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-neutral-950 font-black rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-lg shadow-amber-400/10"
            >
              {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
