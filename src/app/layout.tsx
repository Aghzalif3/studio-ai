import type { Metadata } from 'next';
import './globals.css';
import { Shell } from '@/components/Shell';

export const metadata: Metadata = { title: 'Studio AI', description: 'Studio de création vidéo IA, local d’abord.' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body><Shell>{children}</Shell></body>
    </html>
  );
}
