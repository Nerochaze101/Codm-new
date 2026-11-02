import React from 'react';
import { Film } from 'lucide-react';

interface VideoTutorialProps {
  title: string;
  description: string;
}

export const VideoTutorial: React.FC<VideoTutorialProps> = ({ title, description }) => {
  return (
    <div className="p-4 rounded-2xl bg-black/80 border border-sky-500/40 space-y-2 text-left animate-in fade-in duration-300 shadow-xl">
      <div className="flex items-center gap-2 text-sky-400 font-bold text-xs uppercase tracking-wide">
        <Film className="w-4 h-4" />
        <span>{title}</span>
      </div>
      <p className="text-[11px] text-neutral-400 leading-relaxed italic">
        {description}
      </p>
      <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-neutral-800 bg-black mt-2 shadow-2xl">
        <iframe
          src="https://www.youtube.com/embed/L8s4zUbMoMo?autoplay=1&rel=0&mute=1"
          title="How to make a screen recording of your winning"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="w-full h-full border-0"
        />
      </div>
    </div>
  );
};
