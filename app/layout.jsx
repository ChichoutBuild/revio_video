import './globals.css';

export const metadata = {
  title: 'Application de validation vidéo',
  description: "Plateforme de vérification vidéo pour créateurs et équipes",
  manifest: '/manifest.json',
};

export const viewport = {
  themeColor: '#3730a3',
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon.svg" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body>
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
