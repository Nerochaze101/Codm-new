import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { VideoTutorial } from './VideoTutorial';
import { Match } from '../types';

interface DisputeResolutionModalProps {
  match: Match;
  onClose: () => void;
  children: React.ReactNode;
}

export const DisputeResolutionModal: React.FC<DisputeResolutionModalProps> = ({ match, onClose, children }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-neutral-900 border border-rose-500/50 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-rose-400 font-black uppercase tracking-wider text-sm">
            <AlertTriangle className="w-5 h-5" />
            <span>Dispute Resolution</span>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-white font-bold cursor-pointer">Close</button>
        </div>
        
        <VideoTutorial
          title="How to make a screen recording proof"
          description="Follow these steps to ensure your match results are verified instantly."
        />

        <div className="space-y-4">
          {children}
        </div>
      </div>
    </div>
  );
};
