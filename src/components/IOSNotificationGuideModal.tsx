import React from 'react';
import { X, Share2, PlusSquare, Smartphone, BellRing, CheckCircle2, ArrowRight } from 'lucide-react';

interface IOSNotificationGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const IOSNotificationGuideModal: React.FC<IOSNotificationGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-neutral-900 border border-amber-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 bg-neutral-950 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold font-heading text-white">iPhone Push Notifications</h3>
              <p className="text-[11px] text-amber-400 font-medium">Apple iOS 16.4+ Setup Required</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-xl hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/90 leading-relaxed">
            Apple requires Web Apps on iPhone to be added to your <strong>Home Screen</strong> to enable real-time lock-screen notifications and background voice comms while you play Call of Duty: Mobile.
          </div>

          <div className="space-y-3">
            {/* Step 1 */}
            <div className="flex items-start gap-3.5 p-3 rounded-2xl bg-neutral-950 border border-neutral-800">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 font-bold text-xs">
                1
              </div>
              <div className="text-xs">
                <div className="font-bold text-white flex items-center gap-1.5">
                  <span>Tap Safari Share Button</span>
                  <Share2 className="w-3.5 h-3.5 text-blue-400 inline" />
                </div>
                <p className="text-neutral-400 mt-0.5">
                  At the bottom or top of your Safari browser, tap the Share icon (square with arrow pointing up).
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-start gap-3.5 p-3 rounded-2xl bg-neutral-950 border border-neutral-800">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 font-bold text-xs">
                2
              </div>
              <div className="text-xs">
                <div className="font-bold text-white flex items-center gap-1.5">
                  <span>Select &quot;Add to Home Screen&quot;</span>
                  <PlusSquare className="w-3.5 h-3.5 text-emerald-400 inline" />
                </div>
                <p className="text-neutral-400 mt-0.5">
                  Scroll down the share menu options and tap <strong>&quot;Add to Home Screen&quot;</strong>, then tap <strong>&quot;Add&quot;</strong>.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-start gap-3.5 p-3 rounded-2xl bg-neutral-950 border border-neutral-800">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 font-bold text-xs">
                3
              </div>
              <div className="text-xs">
                <div className="font-bold text-white flex items-center gap-1.5">
                  <span>Open CODM 1v1 from Home Screen</span>
                  <BellRing className="w-3.5 h-3.5 text-amber-400 inline" />
                </div>
                <p className="text-neutral-400 mt-0.5">
                  Open the installed app icon from your iPhone Home Screen and tap <strong>&quot;Enable Alerts&quot;</strong>.
                </p>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-neutral-950/70 border border-neutral-800/80 flex items-center gap-2.5 text-[11px] text-neutral-400">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Lock-screen alerts will now pop up whenever rivals join, matches begin, or opponents speak!</span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-neutral-950 border-t border-neutral-800 flex justify-end">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold text-xs uppercase tracking-wide rounded-xl transition-all shadow cursor-pointer flex items-center justify-center gap-2"
          >
            <span>Got it, I&apos;ll Add to Home Screen</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
