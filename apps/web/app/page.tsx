export default function FoundationPage() {
  return (
    <main id="contenu" tabIndex={-1}>
      <p className="brand">EnCave <span>Assistant</span></p>
      <section aria-labelledby="titre">
        <p className="badge">Environnement local · données synthétiques</p>
        <h1 id="titre">Le point de départ de votre assistant</h1>
        <p>Conservez les demandes après un appel, retrouvez leur compte rendu et les prochaines informations à préciser. La réservation sera disponible dans une prochaine étape de développement.</p>
        <p className="notice">Aucun compte client, calendrier, e-mail ou modèle IA n’est connecté.</p>
        <a className="button primary" href="/demandes">Ouvrir l’espace de travail</a>
      </section>
    </main>
  );
}
