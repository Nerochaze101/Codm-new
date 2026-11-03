import React, { useState, useEffect, useRef } from 'react';
import { UserProfile } from '../types';
import { MessageCircle, X, Send, ShieldCheck, UserCheck, Loader2, Headphones, Minimize2, Trash2, Check, RefreshCw } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

interface SupportWidgetProps {
  currentUser?: UserProfile;
}

interface SupportMessage {
  id: string;
  userId: string;
  senderName: string;
  senderRole: string;
  text: string;
  timestamp: number;
}

export const SupportWidget: React.FC<SupportWidgetProps> = ({ currentUser }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  const isAdminOrMod = currentUser && (currentUser.role === 'admin' || currentUser.role === 'super_admin' || currentUser.role === 'moderator');
  const userId = currentUser ? currentUser.id : 'guest_' + Math.random().toString(36).substr(2, 6);
  const userName = currentUser ? (currentUser.codmIgn || currentUser.username || 'User') : 'Guest User';
  const userRole = currentUser ? (currentUser.role || 'user') : 'guest';

  // Room identifier for support: admins/mods join global support room, users join personal support room
  const supportRoom = isAdminOrMod ? 'support_admin_room' : `support_user_${userId}`;

  // Check if user previously cancelled widget and handle re-showing after a while (e.g. 60 seconds)
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
    const socket = io();
    socketRef.current = socket;

    socket.emit('join_support_room', { userId, role: userRole, room: supportRoom });

    socket.on('support_message', (msg: SupportMessage) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
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
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/support/messages?userId=${userId}`);
      const data = await res.json();
      if (data && Array.isArray(data.messages)) {
        setMessages(data.messages);
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

    const newMsg: SupportMessage = {
      id: `sup_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      userId,
      senderName: userName,
      senderRole: userRole,
      text: textToSend,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, newMsg]);

    try {
      if (socketRef.current) {
        socketRef.current.emit('support_message', { ...newMsg, targetRoom: supportRoom });
      }

      await fetch('/api/support/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          senderName: userName,
          senderRole: userRole,
          text: textToSend,
          room: supportRoom,
        }),
      });
    } catch (err) {
      console.error('Failed to send support message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleClearChat = async () => {
    if (!confirm('Clear support chat history?')) return;
    try {
      await fetch(`/api/support/messages?userId=${userId}`, { method: 'DELETE' });
      setMessages([]);
    } catch (err) {
      console.error('Failed to clear support chat:', err);
    }
  };

  const handleCancelWidget = () => {
    setIsOpen(false);
    setIsCancelled(true);
    localStorage.setItem(`codm_support_cancelled_${userId}`, Date.now().toString());
    // Auto show back after 60 seconds
    setTimeout(() => {
      setIsCancelled(false);
      localStorage.removeItem(`codm_support_cancelled_${userId}`);
    }, 60000);
  };

  if (isCancelled) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="relative group flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-neutral-950 font-black rounded-full shadow-[0_10px_30px_rgba(245,158,11,0.3)] transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer border border-amber-300/50"
        >
          <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-neutral-950 animate-pulse" />
          <Headphones size={22} className="stroke-[2.5]" />
          <span className="text-xs uppercase tracking-wider font-heading">Support Chat</span>
        </button>
      )}

      {isOpen && (
        <div className="w-[90vw] sm:w-[400px] h-[550px] bg-neutral-900 border border-neutral-800 rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300">
          <div className="p-4 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
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
                title="Clear Chat"
                className="p-2 rounded-xl text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <Trash2 size={16} />
              </button>
              <button
                onClick={handleCancelWidget}
                title="Close Widget (Snooze for 60s)"
                className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-neutral-950/60 font-sans">
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] leading-relaxed space-y-1">
              <div className="font-bold uppercase tracking-wide flex items-center gap-1.5">
                <ShieldCheck size={13} className="text-amber-400" />
                <span>Secure Support Channel</span>
              </div>
              <p className="opacity-90">
                Welcome{currentUser ? `, ${userName}` : ''}! Ask any question regarding deposits, match escrow, or withdrawals. Our admins and moderators reply in real-time.
              </p>
            </div>

            {loadingHistory && (
              <div className="flex justify-center py-6">
                <Loader2 size={24} className="animate-spin text-amber-400" />
              </div>
            )}

            {messages.map((msg) => {
              const isMe = msg.userId === userId || (isAdminOrMod && msg.senderRole !== 'user');
              const isStaff = msg.senderRole === 'admin' || msg.senderRole === 'super_admin' || msg.senderRole === 'moderator';

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-1.5 mb-1 px-1">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase">
                      {msg.senderName}
                    </span>
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
              placeholder="Type message to support..."
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
