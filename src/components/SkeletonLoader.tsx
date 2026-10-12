import React from 'react';

export const SkeletonLoader = ({ count = 3, className = "" }: { count?: number, className?: string }) => {
  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse p-5 rounded-2xl bg-neutral-800/50 border border-neutral-700 space-y-3">
          <div className="h-4 bg-neutral-700 rounded w-1/4"></div>
          <div className="h-6 bg-neutral-700 rounded w-full"></div>
          <div className="h-4 bg-neutral-700 rounded w-2/3"></div>
        </div>
      ))}
    </div>
  );
};
