import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
  glow?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ className = '', size = 40, glow = true }) => {
  return (
    <div 
      className={`relative flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Glow Effect */}
      {glow && (
        <div 
          className="absolute inset-0 bg-amber-500/20 rounded-xl blur-lg animate-pulse"
          style={{ transform: 'scale(1.2)' }}
        />
      )}

      {/* Main SVG Shield Icon */}
      <svg 
        viewBox="0 0 100 100" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10 w-full h-full drop-shadow-2xl"
      >
        {/* Outer Shield Frame */}
        <path 
          d="M50 5L15 20V45C15 67.5 30 88 50 95C70 88 85 67.5 85 45V20L50 5Z" 
          stroke="currentColor" 
          strokeWidth="6" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          className="text-amber-500"
        />
        
        {/* Inner Shield Shadow/Fill */}
        <path 
          d="M50 12L22 25V45C22 63 34 79 50 87C66 79 78 63 78 45V25L50 12Z" 
          fill="currentColor" 
          className="text-neutral-900"
        />

        {/* Tactical Crosshair Lines */}
        <line x1="50" y1="25" x2="50" y2="75" stroke="currentColor" strokeWidth="2" className="text-amber-500/40" />
        <line x1="25" y1="50" x2="75" y2="50" stroke="currentColor" strokeWidth="2" className="text-amber-500/40" />
        
        {/* Central Crosshair Circle */}
        <circle cx="50" cy="50" r="18" stroke="currentColor" strokeWidth="2" className="text-amber-500/60" />
        <circle cx="50" cy="50" r="4" fill="currentColor" className="text-amber-400" />

        {/* Lightning Bolt Bolt Element (Stake) */}
        <path 
          d="M58 35L42 52H52L44 70L62 48H52L58 35Z" 
          fill="currentColor" 
          className="text-emerald-400"
          style={{ filter: 'drop-shadow(0 0 4px rgba(52, 211, 153, 0.8))' }}
        />

        {/* Corner Accents */}
        <path d="M15 20L25 24" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className="text-amber-500" />
        <path d="M85 20L75 24" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className="text-amber-500" />
      </svg>
    </div>
  );
};
