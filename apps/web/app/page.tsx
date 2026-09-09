export default function FoundationPage() {
  return (
    <main id="contenu" tabIndex={-1}>
      <p className="brand">EnCave <span>Assistant</span></p>
      <section aria-labelledby="titre">
        <p className="badge">Environnement local · données synthétiques</p>
        <h1 id="titre">Le point de départ de votre assistant</h1>
        <p>Cette page vérifie le démarrage de l’application. Les demandes et les réservations seront disponibles dans les prochaines étapes de développement.</p>
        <p className="notice">Aucun compte client, calendrier, e-mail ou modèle IA n’est connecté.</p>
        <a className="button primary" href="/espace">Ouvrir l’espace de travail</a>
      </section>
    </main>
  );
}
