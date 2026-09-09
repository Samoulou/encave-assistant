# INIT-01 — Contrat avant réalisation

Date : 2026-09-09. Mode : tâche directe Codex Desktop, Windows natif.
Base Git : `73ab37e` sur `main`, checkout propre et synchronisé avec `origin/main`.
Dépendances : aucune. Références : AGENTS.md, START-HERE.md, protocole 08,
brief produit, ADR-0000/0002/0004, stratégie de tests et Definition of Done.

## Critères du backlog (texte et ordre conservés)

### AC-01
Documenter les versions locales Git, Python, Node et Codex, sans secret ni donnée client.

Preuve positive : exécuter les commandes de version et consigner leurs résultats.
Preuve négative : signaler les exécutables absents et versions incompatibles ;
ne pas déduire une authentification ou un appel modèle d'une version CLI.

### AC-02
Vérifier le kit et proposer une structure de travail cohérente avec le brief ; ne pas implémenter le produit dans ce ticket.

Preuve positive : exécuter la gate kit (validation et tests existants), inventorier
la structure prévue apps/web, apps/api, apps/worker et packages partagés internes.
Preuve négative : un échec reste un échec ; aucun code produit dans le diff.

### AC-03
Créer docs/decisions/ADR-0001-environnement.md et docs/setup-result.md avec les résultats réellement observés.

Preuve positive : fichiers présents, commandes, versions, limites et méthode locale
reproductible ; review indépendante comparant les documents aux sorties réelles.
Preuve négative : aucun accès PostgreSQL, Microsoft, IA ou résultat CI présumé.

### AC-04
Conserver les suites produit non configurées en échec explicite ; leur implémentation appartient aux tickets suivants.

Preuve positive : exécuter les commandes npm de suites produit et constater leurs
codes non nuls. Preuve négative : ni suppression ni modification des contrôles,
anciens tests, instructions, politiques ou workflows protégés.

## Commandes et décisions

- Gate prescrite : `python3 scripts/check_kit.py`. Vérifier la résolution de
  python3 sous Windows ; consigner toute adaptation d'environnement sans modifier
  le script ni son contenu testé.
- Préparation : Node 24/npm, Python >=3.11, dépendance verrouillée PyYAML, `npm ci`.
- Refus attendus : `npm run test:unit`, `test:functional`, `test:business`,
  `test:e2e`, `test:evals`, `test:ux` et `check:foundation` avant DEV-01.
- Ne pas lancer scripts/continuous.py ni un second agent CLI en Windows natif.
- Vérifier les possibilités PostgreSQL sans lire de secrets ; la requête SQL
  et la configuration de développement appartiennent à DEV-01.
- Politique directe : commit local des preuves revues ; aucun statut de réussite
  si la gate manque. Les attestations du contrôleur ne sont pas produites ici.
- Budget : au plus trois corrections, huit appels d'agents et 7 200 secondes
  pour ce ticket. Review par agent distinct en lecture seule.
