export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erreur?: string; session?: string }> }) {
  const query = await searchParams;
  return <main id="contenu" className="login-page" tabIndex={-1}>
    <p className="brand">EnCave <span>Assistant</span></p>
    <section aria-labelledby="login-title" className="login-card">
      <p className="eyebrow">Votre espace cave</p>
      <h1 id="login-title">Bienvenue dans votre espace</h1>
      <p>Retrouvez votre cave et travaillez avec les membres de votre équipe.</p>
      {query.erreur && <div className="alert error" role="alert"><strong>La connexion n’a pas abouti.</strong><p>Réessayez avec votre compte professionnel. Si le problème persiste, contactez votre administrateur.</p></div>}
      {query.session && <div className="alert warning" role="status">Votre session a expiré. Connectez-vous pour retrouver votre espace.</div>}
      <a className="button primary login-action" href="/api/auth/start">Se connecter</a>
      <p className="muted small">Utilisez le compte associé à votre invitation. La connexion est gérée par le service d’identité de votre organisation.</p>
    </section>
  </main>;
}
