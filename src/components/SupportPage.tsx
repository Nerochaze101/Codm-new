import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, SupportMessage } from '../types';
import { Send, ShieldCheck, Headphones, Trash2, Tag, Loader2, CheckCircle2, MessageSquare, AlertCircle } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

interface SupportPageProps {
  currentUser?: UserProfile;
}

const SUPPORT_CATEGORIES = [
  { id: 'General Inquiry', label: '💬 General Inquiry' },
  { id: 'Deposit Issue', label: '💳 Deposit Issue' },
  { id: 'Result Dispute', label: '⚔️ Result Dispute' },
  { id: 'Withdrawal Issue', label: '💸 Withdrawal Issue' },
];

export const SupportPage: React.FC<SupportPageProps> = ({ currentUser }) => {
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
    scrollToBottom();
  }, [messages]);

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
    if (!confirm('Clear all messages in your support chat history?')) return;
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

  return (
    <div className="max-w-5xl mx-auto flex flex-col h-[calc(100vh-140px)] min-h-[580px] bg-neutral-950 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden font-sans">
      {/* Tactical Header */}
      <div className="px-5 py-4 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-400/15 border border-amber-400/40 flex items-center justify-center text-amber-400 shrink-0">
            <Headphones size={22} className="stroke-[2.5]" />
          </div>
          <div>
            <div className="text-base font-black text-white uppercase tracking-tight flex items-center gap-2 font-heading">
              <span>Command Support & Referee Desk</span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#10b981]" />
            </div>
            <p className="text-xs text-neutral-400 font-mono flex items-center gap-2">
              <span>{isAdminOrMod ? 'STAFF MODE · DIRECT CHANNEL' : '24/7 LIVE ASSISTANCE · ESCROW & MATCH REFEREE'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleClearChat}
            title="Clear ticket history"
            className="px-3 py-2 rounded-xl text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 border border-transparent hover:border-neutral-700 transition-colors text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 size={15} />
            <span className="hidden sm:inline">Clear Chat</span>
          </button>
        </div>
      </div>

      {/* Query Category Selector Bar */}
      {!isAdminOrMod && (
        <div className="px-5 py-2.5 bg-neutral-900/60 border-b border-neutral-800/80 flex items-center gap-3 overflow-x-auto shrink-0">
          <span className="text-[11px] font-black text-neutral-500 uppercase tracking-widest shrink-0 flex items-center gap-1">
            <Tag size={13} /> Select Topic:
          </span>
          <div className="flex items-center gap-2 shrink-0">
            {SUPPORT_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition-all cursor-pointer border ${
                  selectedCategory === cat.id
                    ? 'bg-amber-400 text-neutral-950 border-amber-300 shadow-md font-black'
                    : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-white border-neutral-800'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Message Stream */}
      <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-[#0a0f12] font-sans">
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs leading-relaxed space-y-1.5">
          <div className="font-bold uppercase tracking-wider flex items-center justify-between font-heading">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-amber-400" />
              <span>Direct Support & Referee Channel</span>
            </div>
            {messages.length > 0 && messages[messages.length - 1].status === 'resolved' && (
              <span className="px-2 py-0.5 rounded bg-emerald-500 text-neutral-950 text-[9px] font-black uppercase tracking-wider">
                RESOLVED
              </span>
            )}
          </div>
          <p className="text-neutral-300">
            Welcome{currentUser && currentUser.codmIgn ? `, ${currentUser.codmIgn}` : ''}! Your inquiries are reviewed directly by platform administrators. Messages alert on-duty staff instantly.
          </p>
        </div>

        {loadingHistory && (
          <div className="flex justify-center py-8">
            <Loader2 size={28} className="animate-spin text-amber-400" />
          </div>
        )}

        {messages.length === 0 && !loadingHistory && (
          <div className="text-center py-16 space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-500 mx-auto">
              <MessageSquare size={26} />
            </div>
            <div className="space-y-1">
              <h3 className="font-heading font-black text-sm text-white uppercase">How can we assist you today?</h3>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                Type your inquiry below regarding deposits, withdrawal approvals, match dispute proofs, or rules.
              </p>
            </div>
          </div>
        )}

        {messages.map((msg) => {
          const isStaff = msg.senderRole === 'admin' || msg.senderRole === 'super_admin' || msg.senderRole === 'moderator';
          const isMe = isAdminOrMod ? isStaff : !isStaff;

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-in fade-in duration-150`}
            >
              <div className="flex items-center gap-2 mb-1 px-1">
                <span className="text-[11px] font-bold text-neutral-400 uppercase">
                  {msg.senderName}
                </span>
                {isStaff && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-400 text-neutral-950 font-mono font-black text-[9px] uppercase">
                    STAFF
                  </span>
                )}
                {msg.category && !isStaff && (
                  <span className="px-1.5 py-0.5 rounded bg-neutral-900 text-neutral-400 font-mono text-[9px] uppercase border border-neutral-800">
                    {msg.category}
                  </span>
                )}
                <span className="text-[10px] text-neutral-500 font-mono">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <div
                className={`p-3.5 rounded-2xl text-sm leading-relaxed max-w-[80%] sm:max-w-[70%] break-words shadow-md ${
                  isMe
                    ? 'bg-amber-400 text-neutral-950 font-medium rounded-tr-none'
                    : isStaff
                    ? 'bg-neutral-800 border border-amber-400/40 text-white rounded-tl-none'
                    : 'bg-neutral-900 border border-neutral-800 text-neutral-200 rounded-tl-none'
                }`}
              >
                {msg.text}
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Sticky Bottom Input Bar */}
      <form onSubmit={handleSendMessage} className="p-4 bg-neutral-950 border-t border-neutral-800 flex items-center gap-3 shrink-0">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={`Type message about ${selectedCategory.toLowerCase()}...`}
          className="flex-1 bg-neutral-900 border border-neutral-700/80 rounded-xl px-4 py-3 text-sm text-white focus:border-amber-400 focus:outline-none placeholder:text-neutral-500 font-sans"
        />
        <button
          type="submit"
          disabled={isSending || !inputText.trim()}
          className="px-6 py-3 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-neutral-950 font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0 shadow-lg shadow-amber-400/10 active:scale-95 text-xs uppercase tracking-wider"
        >
          {isSending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <>
              <Send size={15} />
              <span className="hidden sm:inline">Send</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};
