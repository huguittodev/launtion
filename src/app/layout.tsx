import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Vidiaura — Vídeos Promocionales de SaaS con IA',
  description:
    'Convierte capturas de pantalla y grabaciones en vídeos publicitarios cinematográficos con IA al estilo Base44 y AutoAE.',
  openGraph: {
    title: 'Vidiaura — Vídeos Promocionales de SaaS con IA',
    description:
      'Convierte capturas de pantalla y grabaciones en vídeos publicitarios cinematográficos con IA al estilo Base44 y AutoAE.',
    siteName: 'Vidiaura',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vidiaura — Vídeos Promocionales de SaaS con IA',
    description:
      'Convierte capturas de pantalla y grabaciones en vídeos publicitarios cinematográficos con IA al estilo Base44 y AutoAE.',
  },
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

