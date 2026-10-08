import React, { useState } from 'react';
import { Play, Volume2, VolumeX, ArrowRight, SkipForward, Film, ShieldCheck, Flame, X, AlertTriangle } from 'lucide-react';

interface VideoIntroProps {
  onSkipToLogin: () => void;
  onEnterAsGuest: () => void;
  onClose?: () => void;
}

const CODM_VIDEOS = [
  {
    id: 'Fz45fH_w16M',
    title: 'Call of Duty: Mobile - Official Cinematic Trailer',
    desc: 'High-octane urban combat & sniper action',
  },
  {
    id: 'CIPnrbx3K0Y',
    title: 'Call of Duty: Mobile - Official Launch Trailer',
    desc: 'Classic maps, killstreaks and 1v1 gunfights',
  },
];

export const VideoIntro: React.FC<VideoIntroProps> = ({
  onSkipToLogin,
  onEnterAsGuest,
  onClose,
}) => {
  const [selectedVideoIndex, setSelectedVideoIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [useAnimatedFallback, setUseAnimatedFallback] = useState(false);

  const currentVideo = CODM_VIDEOS[selectedVideoIndex];

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between overflow-hidden select-none animate-in fade-in duration-300">
      {/* Top HUD Bar */}
      <div className="relative z-40 p-4 sm:p-6 flex items-center justify-between bg-gradient-to-b from-black via-black/80 to-transparent">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <Flame className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="font-heading font-black text-lg sm:text-xl tracking-wider text-white flex items-center gap-2">
              <span>CODM STAKE <span className="text-amber-400">1V1</span></span>
              <span className="text-[10px] bg-rose-600/30 text-rose-400 border border-rose-500/40 px-2 py-0.5 rounded font-mono font-bold">
                CINEMATIC
              </span>
            </div>
            <div className="text-[10px] sm:text-xs text-neutral-400 font-mono-nums">
              CALL OF DUTY: MOBILE // ANIMATED ACTION REEL
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Audio toggle */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 text-xs font-semibold backdrop-blur-md transition-colors cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-neutral-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            <span>{isMuted ? 'Muted' : 'Sound On'}</span>
          </button>

          {/* Fallback Switcher */}
          <button
            onClick={() => setUseAnimatedFallback(!useAnimatedFallback)}
            className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 text-xs font-semibold transition-colors cursor-pointer"
            title="Toggle between YouTube player and internal animated battle canvas"
          >
            <Film className="w-3.5 h-3.5 text-amber-400" />
            <span>{useAnimatedFallback ? 'Switch to YouTube' : 'Use Direct Video Reel'}</span>
          </button>

          {/* Prominent Skip Button */}
          <button
            onClick={onSkipToLogin}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black text-xs sm:text-sm tracking-wide shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <span>Skip to Login</span>
            <SkipForward className="w-4 h-4" />
          </button>

          {/* Close modal button */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-400 hover:text-white transition-colors cursor-pointer"
              title="Close video"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Video Presentation Container */}
      <div className="absolute inset-0 z-10 w-full h-full flex items-center justify-center bg-black">
        {!useAnimatedFallback ? (
          <div className="relative w-full h-full">
            <iframe
              key={`${currentVideo.id}-${isMuted ? 'muted' : 'unmuted'}`}
              src={`https://www.youtube-nocookie.com/embed/${currentVideo.id}?autoplay=1&mute=${isMuted ? 1 : 0}&loop=1&playlist=${currentVideo.id}&controls=1&rel=0&playsinline=1`}
              title={currentVideo.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              className="w-full h-full object-cover border-0"
            />
            {/* Fail-safe overlay notice in case third-party network blocks YouTube */}
            <div className="absolute top-20 right-4 z-20 hidden lg:block">
              <button
                onClick={() => setUseAnimatedFallback(true)}
                className="px-3 py-1.5 bg-black/80 hover:bg-black border border-neutral-700 text-neutral-300 text-[11px] rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>Blocked by network? Click for Direct Reel</span>
              </button>
            </div>
          </div>
        ) : (
          /* Internal Animated High-Octane CODM Battle Reel */
          <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
            <img
              src="/src/assets/images/codm_hero_action_1791303425231.jpg"
              alt="CODM Battlefield Action"
              className="w-full h-full object-cover animate-pulse duration-1000 scale-105 transition-transform"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/60" />
            <div className="absolute inset-0 bg-radial from-transparent via-black/40 to-black" />

            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-400 flex items-center justify-center text-amber-400 shadow-2xl animate-bounce">
                <Play className="w-8 h-8 ml-1" />
              </div>
              <h2 className="text-3xl sm:text-5xl font-black font-heading text-white tracking-wider max-w-2xl">
                CALL OF DUTY: MOBILE <span className="text-amber-400">1V1 ARENA</span>
              </h2>
              <p className="text-neutral-300 text-sm max-w-md">
                Direct cinematic animated reel active. Fast stakes, instant escrow payouts, and live AI scoreboard referee verification.
              </p>
              <button
                onClick={onSkipToLogin}
                className="px-6 py-3 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black rounded-xl text-sm shadow-xl transition-transform hover:scale-105 active:scale-95 cursor-pointer"
              >
                Skip to Login Page →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Cinematic Overlay & Quick Skip Prompts */}
      <div className="relative z-40 p-4 sm:p-8 bg-gradient-to-t from-black via-black/90 to-transparent flex flex-col sm:flex-row items-end sm:items-center justify-between gap-4">
        {/* Video metadata and selector */}
        <div className="space-y-2 max-w-lg">
          <div className="flex items-center gap-2 text-xs text-amber-400 font-bold uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span>Official Video Trailer</span>
          </div>

          <h2 className="text-lg sm:text-2xl font-bold font-heading text-white truncate max-w-md">
            {currentVideo.title}
          </h2>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {CODM_VIDEOS.map((vid, idx) => (
              <button
                key={vid.id}
                onClick={() => {
                  setSelectedVideoIndex(idx);
                  setUseAnimatedFallback(false);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedVideoIndex === idx && !useAnimatedFallback
                    ? 'bg-amber-400 text-neutral-950 font-bold shadow-md'
                    : 'bg-neutral-900/90 text-neutral-400 hover:text-white border border-neutral-800'
                }`}
              >
                <Film className="w-3.5 h-3.5" />
                <span>Trailer #{idx + 1}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Big Skip & Continue Actions */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <button
            onClick={onSkipToLogin}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black text-sm shadow-2xl transition-all hover:scale-105 active:scale-95 cursor-pointer"
          >
            <span>Skip Video & Log In</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={onEnterAsGuest}
            className="px-4 py-3.5 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs font-semibold backdrop-blur-md transition-colors cursor-pointer"
          >
            Enter Dashboard Directly
          </button>
        </div>
      </div>
    </div>
  );
};
