export default function HomePage() {
  return (
    <main style={{ maxWidth: 640, margin: '40px auto', padding: '0 16px' }}>
      <h1>Application de validation vidéo</h1>
      <p className="muted">
        Squelette Next.js — Sprint 1 en cours. Le reste de l'application (authentification, vidéos,
        feedback...) sera construit ici, sprint par sprint.
      </p>
      <div className="card" style={{ marginTop: 16 }}>
        <p>
          Le prototype du lecteur validé au Sprint 0 est disponible ici :{' '}
          <a href="/sprint0">/sprint0</a>
        </p>
      </div>
    </main>
  );
}
