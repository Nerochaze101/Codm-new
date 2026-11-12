import React, { useState, useEffect, useRef } from 'react';
import { Send, Trophy, ArrowLeft, CheckCheck, Shield, Trash2, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { UserProfile, RivalChatMessage } from '../types';
import { io, Socket } from 'socket.io-client';

interface RivalChatProps {
  currentUser: UserProfile;
  rival: { id: string; codm_ign: string };
  onChallenge: (rivalId: string) => void;
  onBack?: () => void;
}

function formatTime(timestamp?: number): string {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export const RivalChat: React.FC<RivalChatProps> = ({ currentUser, rival, onChallenge, onBack }) => {
  const [messages, setMessages] = useState<RivalChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  const effectiveUserId = (currentUser && currentUser.id && currentUser.id !== 'guest')
    ? currentUser.id
    : (typeof window !== 'undefined' ? localStorage.getItem('codm_current_user_id') || currentUser.id : currentUser.id);

  const effectiveIgn = (currentUser && currentUser.codmIgn && currentUser.codmIgn !== 'CODM_Gamer')
    ? currentUser.codmIgn
    : (currentUser.username || 'Gladiator');

  const normalizeMsg = (m: any): RivalChatMessage => {
    const sId = m.senderId || m.sender_id || m.userId || m.user_id || '';
    const isMe = sId === effectiveUserId;
    const sName = m.senderName || m.sender_name || (isMe ? effectiveIgn : rival.codm_ign);

    return {
      id: m.id || `rival_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      rivalId: m.rivalId || m.rival_id || rival.id,
      userId: m.userId || m.user_id || effectiveUserId,
      senderId: sId,
      senderName: sName,
      text: m.text || '',
      timestamp: Number(m.timestamp) || Date.now(),
    };
  };

  const fetchHistory = async (silent = false) => {
    if (!silent) setLoadingHistory(true);
    try {
      const res = await fetch(`/api/friends/chat/${rival.id}?userId=${effectiveUserId}`);
      const data = await res.json();
      if (data && Array.isArray(data.messages)) {
        setMessages(data.messages.map(normalizeMsg));
      }
    } catch (err) {
      console.warn('Failed to load chat history:', err);
    } finally {
      if (!silent) setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();

    const s = io('/');
    socketRef.current = s;

    const room = `rival_chat_${[rival.id, effectiveUserId].sort().join('_')}`;

    const joinRoom = () => {
      s.emit('join_rival_room', { room });
    };

    if (s.connected) {
      joinRoom();
    }
    s.on('connect', joinRoom);

    // Incoming messages on shared rival room
    s.on('rival_chat', (rawMsg: any) => {
      const msg = normalizeMsg(rawMsg);
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });

    // Targeted channel message event
    s.on(`rival_chat_${effectiveUserId}`, (rawMsg: any) => {
      const msg = normalizeMsg(rawMsg);
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });

    s.on('rival_chat_cleared', (data: any) => {
      if (data && (data.rivalId === rival.id || data.userId === rival.id)) {
        setMessages([]);
      }
    });

    // Fallback sync polling every 4 seconds in case WebSockets are blocked by client environment
    const pollTimer = setInterval(() => {
      fetchHistory(true);
    }, 4000);

    return () => {
      clearInterval(pollTimer);
      s.disconnect();
    };
  }, [effectiveUserId, rival.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const textToSend = inputText.trim();
    if (!textToSend || isSending) return;

    setIsSending(true);
    const msgId = `rival_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const timestamp = Date.now();

    const newMsg: RivalChatMessage = {
      id: msgId,
      rivalId: rival.id,
      userId: effectiveUserId,
      senderId: effectiveUserId,
      senderName: effectiveIgn,
      text: textToSend,
      timestamp,
    };

    // Optimistically update UI immediately
    setMessages((prev) => [...prev, newMsg]);
    setInputText('');

    // 1. Emit via socket
    if (socketRef.current) {
      socketRef.current.emit('rival_chat', newMsg);
    }

    // 2. Dual-dispatch via REST API to guarantee database write and rival push alert
    try {
      await fetch('/api/friends/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMsg),
      });
    } catch (err) {
      console.warn('REST chat fallback dispatch failed:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleClearChat = async () => {
    if (!confirm(`Clear all chat history with ${rival.codm_ign}?`)) return;
    try {
      const res = await fetch(`/api/friends/chat/${rival.id}?userId=${effectiveUserId}`, { method: 'DELETE' });
      if (res.ok) {
        setMessages([]);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to clear chat.');
      }
    } catch (err) {
      console.error('Failed to clear chat:', err);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] min-h-[580px] bg-[#0c1317] border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl font-sans">
      {/* Tactical Top Bar */}
      <div className="px-4 py-3 bg-[#1f2c34] border-b border-[#2a3942] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-[#2a3942] transition-colors cursor-pointer"
              title="Back to Rivals Roster"
            >
              <ArrowLeft size={18} />
            </button>
          )}

          <div className="relative">
            <img
              src={`https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(rival.codm_ign)}`}
              alt={rival.codm_ign}
              className="w-10 h-10 rounded-full bg-neutral-800 border border-emerald-500/40 object-cover"
            />
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#1f2c34] animate-pulse" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-white font-bold text-sm tracking-wide font-heading">
                {rival.codm_ign}
              </span>
              <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Online
              </span>
            </div>
            <div className="text-[10px] text-emerald-500/80 font-mono flex items-center gap-1">
              <Shield size={10} />
              <span>Encrypted 1v1 Channel</span>
            </div>
          </div>
        </div>

        {/* Actions Bar */}
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={handleClearChat}
              className="p-2 rounded-xl text-neutral-400 hover:text-rose-400 hover:bg-[#2a3942] transition-colors cursor-pointer"
              title="Clear conversation history"
            >
              <Trash2 size={16} />
            </button>
          )}

          <button
            onClick={() => onChallenge(rival.id)}
            className="flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 px-3.5 py-2 rounded-xl font-black uppercase text-xs tracking-wider transition-all shadow-md active:scale-95 cursor-pointer font-heading"
          >
            <Trophy size={14} className="stroke-[2.5]" />
            <span>Challenge 1v1</span>
          </button>
        </div>
      </div>

      {/* Message Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 bg-[#0b141a]">
        <div className="flex justify-center mb-4">
          <div className="px-4 py-1.5 rounded-full bg-[#182229] border border-white/5 text-[11px] text-[#8696a0] font-mono text-center flex items-center gap-2">
            <span>🔒 Messages in this 1v1 room are private & encrypted.</span>
            <span className="text-amber-400 font-bold">Tap Challenge 1v1 above to lock escrow bets!</span>
          </div>
        </div>

        {loadingHistory ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-neutral-500">
            <Loader2 size={24} className="animate-spin text-amber-400" />
            <span className="text-xs font-mono">Syncing encrypted chat history...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#1f2c34] flex items-center justify-center text-amber-400 mx-auto">
              <Sparkles size={22} />
            </div>
            <div>
              <p className="text-sm font-bold text-white font-heading uppercase">No Messages Yet</p>
              <p className="text-xs text-[#8696a0] mt-1 max-w-xs mx-auto">
                Say hello to {rival.codm_ign}, set game rules, or tap Challenge 1v1 to duel!
              </p>
            </div>
          </div>
        ) : (
          messages.map((m) => {
            const isMe = m.senderId === effectiveUserId || (m.senderName && m.senderName === effectiveIgn);

            return (
              <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in fade-in duration-150`}>
                <div
                  className={`p-3 rounded-2xl shadow-sm max-w-[85%] sm:max-w-[70%] break-words relative ${
                    isMe
                      ? 'bg-[#005c4b] text-white rounded-tr-none'
                      : 'bg-[#202c33] text-[#e9edef] rounded-tl-none border border-white/5'
                  }`}
                >
                  {!isMe && (
                    <p className="text-[10px] font-bold text-amber-400 mb-0.5 uppercase tracking-tight font-heading">
                      {m.senderName || rival.codm_ign}
                    </p>
                  )}
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.text}</p>
                  <div className="flex items-center justify-end mt-1 gap-1 text-[9px] text-[#8696a0]">
                    <span>{formatTime(m.timestamp)}</span>
                    {isMe && <CheckCheck size={12} className="text-emerald-400" />}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Field Bar */}
      <form onSubmit={handleSend} className="p-3.5 bg-[#1f2c34] border-t border-[#2a3942] flex items-center gap-2.5 shrink-0">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={`Message ${rival.codm_ign}...`}
          className="flex-1 bg-[#2a3942] text-white placeholder-[#8696a0] rounded-full px-5 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || isSending}
          className="p-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-full transition-all active:scale-95 cursor-pointer shadow-md shrink-0 flex items-center justify-center"
          title="Send message"
        >
          {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </form>
    </div>
  );
};
