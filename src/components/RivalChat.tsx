import React, { useState, useEffect, useRef } from 'react';
import { Send, Trophy, ArrowLeft, CheckCheck, Wifi, Shield } from 'lucide-react';
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
  const [socket, setSocket] = useState<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch initial message history
    fetch(`/api/friends/chat/${rival.id}?userId=${currentUser.id}`)
      .then(res => res.json())
      .then(data => setMessages(data.messages || []))
      .catch(err => console.warn('Failed to load chat history:', err));

    const s = io('/');
    s.on('connect', () => {
      const room = `rival_chat_${[rival.id, currentUser.id].sort().join('_')}`;
      s.emit('join_rival_room', { room });
    });

    s.on('rival_chat', (msg: RivalChatMessage) => {
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, [currentUser.id, rival.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!inputText.trim() || !socket || isSending) return;
    setIsSending(true);

    const newMsg: RivalChatMessage = {
      id: `rival_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      rivalId: rival.id,
      userId: currentUser.id,
      senderId: currentUser.id,
      senderName: currentUser.codmIgn,
      text: inputText.trim(),
      timestamp: Date.now()
    };

    socket.emit('rival_chat', newMsg);
    setMessages(prev => [...prev, newMsg]);
    setInputText('');
    setTimeout(() => setIsSending(false), 150);
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
              title="Back to Rivals list"
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
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#1f2c34]" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-white font-bold text-sm tracking-wide font-heading">
                {rival.codm_ign}
              </span>
              <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Active
              </span>
            </div>
            <div className="text-[10px] text-emerald-500/80 font-mono flex items-center gap-1">
              <Shield size={10} />
              <span>Encrypted Rival Channel</span>
            </div>
          </div>
        </div>

        {/* Quick 1v1 Bet Trigger Button */}
        <button
          onClick={() => onChallenge(rival.id)}
          className="flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 px-4 py-2 rounded-xl font-black uppercase text-xs tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
        >
          <Trophy size={14} className="stroke-[2.5]" />
          <span>Challenge 1v1</span>
        </button>
      </div>

      {/* Message Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 bg-[#0b141a]">
        <div className="flex justify-center mb-4">
          <div className="px-4 py-1.5 rounded-full bg-[#182229] border border-white/5 text-[11px] text-[#8696a0] font-mono text-center">
            🔒 Messages in this 1v1 room are private. Ready to settle scores? Tap Challenge 1v1 above.
          </div>
        </div>

        {messages.map((m) => {
          const isMe = m.senderId === currentUser.id;
          return (
            <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`p-3 rounded-2xl shadow-sm max-w-[85%] sm:max-w-[70%] break-words relative ${
                  isMe
                    ? 'bg-[#005c4b] text-white rounded-tr-none'
                    : 'bg-[#202c33] text-[#e9edef] rounded-tl-none border border-white/5'
                }`}
              >
                {!isMe && (
                  <p className="text-[10px] font-bold text-amber-400 mb-0.5 uppercase tracking-tight">
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
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Field */}
      <div className="p-3.5 bg-[#1f2c34] border-t border-[#2a3942] flex items-center gap-2.5 shrink-0">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={`Message ${rival.codm_ign}...`}
          className="flex-1 bg-[#2a3942] text-white placeholder-[#8696a0] rounded-full px-5 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans"
        />
        <button
          onClick={handleSend}
          disabled={!inputText.trim() || isSending}
          className="p-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-full transition-all active:scale-95 cursor-pointer shadow-md shrink-0"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
};
