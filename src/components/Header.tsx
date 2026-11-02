import React from 'react';
import Link from 'next/link';

export const Header: React.FC = () => {
  return (
    <header className="w-full px-6 py-4 flex items-center justify-between">
      <Link
        href="/"
        className="font-semibold tracking-tight text-neutral-900 text-lg hover:text-neutral-700 transition-colors"
      >
        Vidiaura
      </Link>
    </header>
  );
};
