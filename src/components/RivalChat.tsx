import React, { useState, useEffect, useRef } from 'react';
import { Send, Trophy } from 'lucide-react';
import { UserProfile, RivalChatMessage } from '../types';
import { io, Socket } from 'socket.io-client';

interface RivalChatProps {
  currentUser: UserProfile;
  rival: { id: string; codm_ign: string };
  onChallenge: (rivalId: string) => void;
}

export const RivalChat: React.FC<RivalChatProps> = ({ currentUser, rival, onChallenge }) => {
  const [messages, setMessages] = useState<RivalChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch initial messages
    fetch(`/api/friends/chat/${rival.id}?userId=${currentUser.id}`)
      .then(res => res.json())
      .then(data => setMessages(data.messages || []));

    const s = io('/');
    s.on('connect', () => {
        // join room
        const room = `rival_chat_${[rival.id, currentUser.id].sort().join('_')}`;
        s.emit('join_rival_room', { room });
    });
    s.on('rival_chat', (msg: RivalChatMessage) => {
        setMessages(prev => [...prev, msg]);
    });
    setSocket(s);

    return () => { s.disconnect(); };
  }, [currentUser.id, rival.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!inputText.trim() || !socket) return;
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
  };

  return (
    <div className="flex flex-col h-[500px] bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl font-mono">
      <div className="px-4 py-3 bg-neutral-800 border-b border-neutral-700 flex items-center justify-between">
        <span className="text-amber-400 font-bold uppercase tracking-widest">{rival.codm_ign}</span>
        <button 
            onClick={() => onChallenge(rival.id)}
            className="flex items-center gap-2 bg-amber-400 text-black px-4 py-2 rounded-xl font-black uppercase text-sm hover:bg-amber-300"
        >
            <Trophy size={16} /> Challenge
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0b141a]">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.senderId === currentUser.id ? 'justify-end' : 'justify-start'}`}>
            <div className={`p-3 rounded-2xl max-w-[85%] ${m.senderId === currentUser.id ? 'bg-[#005c4b] text-white' : 'bg-neutral-800 text-white'}`}>
              <p className="text-sm">{m.text}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-3 bg-neutral-800 flex items-center gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Type message..."
          className="flex-1 bg-black text-white rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
        />
        <button onClick={handleSend} className="p-2.5 bg-amber-400 text-black rounded-full hover:bg-amber-300">
          <Send size={18} />
        </button>
      </div>
    </div>
  );
};
