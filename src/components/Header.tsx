import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="w-full border-b border-neutral-200/80 bg-white/70 backdrop-blur-md px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="font-semibold tracking-tight text-neutral-900 text-lg">
          Launtion
        </span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200">
          v0.1.0 • Hito 1
        </span>
      </div>
      <div className="text-xs text-neutral-500 font-mono">
        Next.js App Router + Remotion
      </div>
    </header>
  );
};

