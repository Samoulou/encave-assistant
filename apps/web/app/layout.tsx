import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'EnCave Assistant',
  description: 'Votre espace de travail et les accès de votre équipe.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="fr"><body><a className="skip" href="#contenu">Aller au contenu</a>{children}</body></html>;
}
