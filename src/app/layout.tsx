import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Launtion — Generador de vídeos promocionales para SaaS',
  description:
    'Convierte recursos y capturas de producto en vídeos promocionales con motion graphics.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="min-h-screen antialiased flex flex-col">{children}</body>
    </html>
  );
}

