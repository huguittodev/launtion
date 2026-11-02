import React from 'react';
import Link from 'next/link';

export const Header: React.FC = () => {
  return (
    <header className="w-full border-b border-neutral-200/80 bg-white/70 backdrop-blur-md px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="font-semibold tracking-tight text-neutral-900 text-lg hover:text-neutral-700 transition-colors"
        >
          Vidiaura
        </Link>
        <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200">
          v0.2.0 • Fase 3
        </span>
      </div>
      <div className="flex items-center gap-4">
        <nav className="flex items-center gap-3">
          <Link
            href="/"
            className="text-xs text-neutral-600 hover:text-neutral-900 transition-colors font-medium"
          >
            Inicio
          </Link>
          <Link
            href="/editor"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <span>Estudio Interactivo</span>
            <span className="text-[10px] px-1 py-0.5 rounded bg-white/20 font-mono">Fase 3</span>
          </Link>
        </nav>
        <div className="text-xs text-neutral-500 font-mono hidden md:block">
          Next.js App Router + Remotion
        </div>
      </div>
    </header>
  );
};
