export default function HomePage() {
  return (
    <main style={{ maxWidth: 640, margin: '40px auto', padding: '0 16px' }}>
      <h1>Application de validation vidéo</h1>
      <div className="card" style={{ marginTop: 16 }}>
        <p style={{ marginTop: 0 }}>
          <a href="/dashboard">→ Dashboard</a>
        </p>
        <p>
          <a href="/videos">→ Liste des vidéos</a>
        </p>
        <p style={{ marginBottom: 0 }}>
          <a href="/activate">→ Activer un compte</a>
        </p>
      </div>
    </main>
  );
}
