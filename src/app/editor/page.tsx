'use client';

/**
 * app/editor/page.tsx
 *
 * Vidiaura minimalist editor: the video, 4 texts, a style picker, a format toggle and
 * one big download button. The full studio remains available at /editor/advanced.
 */

import dynamic from 'next/dynamic';

const SimpleEditor = dynamic(() => import('./SimpleEditor'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF9F5] text-[#5F5C55]">
      Cargando tu vídeo…
    </div>
  ),
});

export default function EditorPage() {
  return <SimpleEditor />;
}

