import React from 'react';
import { Upload, CheckCircle2, X } from 'lucide-react';

interface BackgroundUploadBannerProps {
  isUploading: boolean;
  progress: number;
  status: 'idle' | 'uploading' | 'pending_review' | 'failed';
  onDismiss: () => void;
}

export const BackgroundUploadBanner: React.FC<BackgroundUploadBannerProps> = ({
  isUploading,
  progress,
  status,
  onDismiss,
}) => {
  if (!isUploading && status !== 'pending_review') return null;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
      {isUploading && (
        <div className="p-4 rounded-2xl bg-sky-950/90 border-2 border-sky-500/60 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in backdrop-blur-md">
          <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
              <Upload className="w-5 h-5 animate-bounce" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-white uppercase tracking-wider">
                  Screen Recording Uploading in Background
                </span>
                <span className="text-xs font-mono font-black text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/30">
                  {progress}%
                </span>
              </div>
              <p className="text-[11px] text-neutral-300 truncate">
                Dispatching to referee Telegram review group. You can switch tabs or join new battles freely.
              </p>
            </div>
          </div>
          <div className="w-full sm:w-48 bg-neutral-900 h-2.5 rounded-full overflow-hidden shrink-0 border border-sky-500/40">
            <div
              className="h-full bg-gradient-to-r from-sky-500 to-sky-300 transition-all duration-300 shadow-lg"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {status === 'pending_review' && !isUploading && (
        <div className="p-4 rounded-2xl bg-emerald-950/90 border-2 border-emerald-500/60 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-black text-emerald-300 uppercase tracking-wide">
                Video Dispatched to Referee Queue (Pending Review)
              </div>
              <p className="text-[11px] text-neutral-300">
                Your screen recording was sent to referees in Telegram. Funds remain frozen in escrow until review completes.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href="https://t.me/+I5vcFF4RXwJkMWVk"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black text-xs uppercase rounded-xl transition-all shadow"
            >
              Telegram Review Group
            </a>
            <button
              onClick={onDismiss}
              className="p-2 text-neutral-400 hover:text-white cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
