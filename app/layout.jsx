import './globals.css';
import AppHeader from '../components/AppHeader';
import { THEME_INIT_SCRIPT } from '../lib/theme';

export const metadata = {
  title: 'REVIO — Validation vidéo',
  description: 'Plateforme de vérification vidéo pour créateurs et équipes',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#3730a3' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0d14' },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <head>
        {/* Doit s'exécuter AVANT le premier rendu pour éviter un flash de
            thème clair au chargement si l'utilisateur a choisi le sombre. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="REVIO" />
      </head>
      <body>
        <AppHeader />
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function () {
                  navigator.serviceWorker.register('/service-worker.js').catch(function (err) {
                    console.warn('Service worker non enregistré :', err);
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
