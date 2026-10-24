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
          className="absolute inset-0 bg-amber-500/20 rounded-full blur-lg animate-pulse"
          style={{ transform: 'scale(1.2)' }}
        />
      )}

      {/* Main Icon Image */}
      <div className="relative z-10 w-full h-full overflow-hidden rounded-xl border-2 border-amber-500/50 bg-neutral-900 shadow-2xl">
        <img 
          src="/src/assets/images/ops_stake_icon_logo_1792817058480.jpg" 
          alt="Ops Stake Logo" 
          className="w-full h-full object-cover"
        />
      </div>
    </div>
  );
};
