import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
  glow?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ className = '', size = 40, glow = true }) => {
  return (
    <div 
      className={`relative flex items-center justify-center shrink-0 select-none ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Tactical Glow Effect */}
      {glow && (
        <div 
          className="absolute inset-0 bg-amber-500/25 rounded-2xl blur-md pointer-events-none"
          style={{ transform: 'scale(1.15)' }}
        />
      )}

      {/* Official OPS STAKE Uploaded Logo Image */}
      <div className="relative z-10 w-full h-full overflow-hidden rounded-2xl border border-amber-500/40 bg-neutral-950 shadow-xl flex items-center justify-center">
        <img 
          src="/assets/aistudio/IMG_2853_9c73529e.jpeg" 
          alt="OPS STAKE" 
          className="w-full h-full object-cover"
        />
      </div>
    </div>
  );
};
