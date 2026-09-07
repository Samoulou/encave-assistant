# Stratégie de tests

Statut : plan à implémenter. Ce kit ne contient ni application ni preuve de fonctionnement. Les `.feature` de `tests/acceptance/` sont des **spécifications non exécutées** ; le seed IA est un jeu fictif non évalué.

Références métier : pack v1, `02-cas-usage-et-regles.md` (§11–13), `03-agent-et-integrations.md` (§14–17), `05-securite-qualite-exploitation.md` (§26–27), `06-roadmap-lancement-business.md` (§29) et `09-contrats-et-modeles.md`.

## Choisir le niveau selon le risque

| Niveau | À démontrer | Environnement et preuve attendue |
|---|---|---|
| Unitaires | Prix en unités mineures, capacités, marges, intervalles `[début, fin)`, fuseaux et changements d'heure, transitions interdites | Fonctions du domaine sans réseau ; assertions sur résultats et erreurs, horloge fixée |
| Fonctionnels métier | Version approuvée immuable, accord exact, nouvelle proposition après changement commercial, seconde autorisation A1, conditions de devis | Services métier avec fixtures ; scénarios nominaux et refus, assertions sur état et effets planifiés |
| Intégration DB | Isolation avec le rôle serveur réel, clés étrangères inter-caves, transaction multiressources, 100 concurrents, idempotence, outbox/reprise, migrations | PostgreSQL de test isolé ; connexions réellement concurrentes et assertions après commit ; un mock DB ne suffit pas |
| Contrats des connecteurs | Pagination, doublons, notifications hors ordre, révocation, 429, timeout après effet | Fixtures fournisseur datées et injection de pannes ; journaliser que le fournisseur est simulé |
| Intégration Microsoft 365 | Lire une demande, lire une occupation, créer/retrouver un événement, envoyer vers une adresse de test, renouveler/révoquer, refuser hors périmètre | Boîte, calendrier et destinataires de test **explicitement autorisés** ; références fournisseur expurgées, configuration et limites documentées |
| E2E navigateur | Connexion, création persistante, correction, proposition, première validation/envoi, accord, seconde validation A1, réservation et état de synchronisation | Application et DB réelles de test, deux utilisateurs et deux caves ; rechargement et vérification des effets serveur. Identifier les connecteurs simulés |
| UX/UI | États réels, erreurs, clavier/focus, responsive à partir de 320 px et actions sensibles ; critères UX-01 à UX-18 applicables | `npm run test:ux`, navigateur sur application de test, captures conservées et examinées par une review indépendante ; référence docs/product/11-ux-ui-et-design.md |
| Évaluations IA | Extraction avec provenance, abstention, clarification, offres admissibles, accord modifié, injection et outils autorisés | Modèle/prompt/outils versionnés, corpus annoté, résultats par cas et revue humaine ; voir `evals/README.md` |

Le développement peut être autonome ; **le produit reste A1** : le caviste valide la proposition avant son envoi puis, après l'accord exact, autorise « Réserver et confirmer ». Un agent de code ne peut pas supprimer ces validations pour faire passer un test.

## Minimum par ticket de code

1. Associer chaque critère d'acceptation à une assertion observable et choisir le niveau pertinent. Ajouter les cas de refus et de panne du comportement modifié.
2. Implémenter les tests avec le code. Pour une correction, reproduire le défaut puis vérifier sa résolution. Ne pas créer une suite qui ne vérifie que la présence des fichiers.
3. Exécuter les commandes déclarées par le dépôt ; conserver commit, commande, environnement, résultat et limites dans la preuve du ticket.
4. Faire relire les invariants sensibles. Une suite absente, un test ignoré ou un résultat non exécuté est un manque de preuve, jamais un succès.

**Un test requis manquant bloque la livraison du ticket de code.** Un blocage d'environnement se note `bloqué`, avec cause et prochaine action. Il ne devient pas `passé`. Un ticket purement documentaire vérifie son contenu et ses liens sans prétendre tester le produit. Une couverture de lignes de 100 % n'est pas imposée : couvrir les critères et risques pertinents, puis expliquer les exclusions.

## Scénarios à rendre exécutables en priorité

| Spécification | Invariants | Preuve principale |
|---|---|---|
| `tests/acceptance/accord-versionne.feature` | ACCORD exact, version non remplacée, autorisation A1 après accord | Fonctionnel serveur + parcours navigateur |
| `tests/acceptance/concurrence-ressources.feature` | Une allocation exclusive parmi 100, tout ou rien, marges, conflit Outlook tardif | Intégration DB ; connecteur de test pour conflit externe |
| `tests/acceptance/isolation-cave.feature` | Refus de lecture/écriture et de références croisées, y compris worker | API + DB avec identité effective + E2E |
| `tests/acceptance/envoi-incertain.feature` | Pas de succès inventé, pas de renvoi aveugle, reprise après crash | Intégration outbox/connecteur + visibilité navigateur |

Ajouter aux tickets concernés : cinq notifications identiques et déplacées → une ingestion ; timeout après création Outlook → retrouver l'événement sans doublon ; restauration → rapprocher les effets externes avant reprise ; révocation → suspension des nouveaux effets. Les tests DB ne prouvent pas une exclusion atomique avec une saisie manuelle indépendante dans Outlook.

## Preuve et passages de jalon

Séparer `passé`, `échoué`, `bloqué` et `non exécuté`. Publier le nombre attendu/exécuté, les versions, les échecs et les tests ignorés. Une compilation, un lint ou un contrôle JSON ne remplace pas une preuve métier. Un connecteur simulé ne valide pas Microsoft 365 réel.

- **Avant demandes réelles (G2)** : tests critiques réussis, aucun défaut critique connu, restauration/coupe-circuit/alertes éprouvés et cadre de traitement validé ; corpus IA d'au moins 100 cas dont 20 adverses ou ambigus évalué. Le seed de 12 cas ne suffit pas.
- **Première production supervisée (G3)** : exigences G2, politique de lancement définie par Sam, aucun incident critique non résolu, support et décision de lancement de Sam consignés. Le pilote de quatre semaines / 30 demandes est une cible facultative de mesure, sans approbation obligatoire d’un prospect. Les fonctions non terminées sont exclues explicitement de l'offre.
- Tout changement de modèle, prompt ou contrat d'outil repasse les évaluations avant activation. Aucun score moyen ne compense un engagement non autorisé, une fuite inter-caves ou un succès inventé dans un cas critique.

Les 17 tickets marqués requires_ux exécutent la gate ux en plus de leurs suites obligatoires. EA-05 initialise ce runner sur la première interface réelle ; sa commande initiale échoue tant qu’il manque. Les tokens et maquettes seuls ne prouvent ni accessibilité complète ni utilisabilité. Les essais avec des utilisateurs restent distincts de cette recette technique.
