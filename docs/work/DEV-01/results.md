# DEV-01 — Résultats et limites

Date : 2026-09-09. Base : `2ea17e66426afe569b3d80a8fbd097f4af4526a6`.
Contrat : dix critères exacts formalisés avant code. Environnement Windows natif,
Node 24.19.0 / npm 10.9.2 via `packages/tooling/activate.ps1`, Python 3.12.9.

## Contrôles réellement exécutés

| Commande | Code | Résultat |
|---|---:|---|
| npm install initial via ancien npm.cmd | 0 | 52 packages ; warning EBADENGINE révèle Node 22 du lanceur |
| `node <npm-cli.js> ci --no-audit --no-fund` avec Node 24 | 0 | réinstallation des 52 packages verrouillés |
| `node node_modules/typescript/bin/tsc -b` | 0 | packages, API et worker compilés |
| `npm run test:foundation-tooling` final | 0 | 14 tests, 14 réussis, zéro ignoré/annulé ; 7,612 s |
| `npm run check:foundation` final | 0 | TS, Next build, sorties, web/API/worker réels, SQL et cleanup |
| `npm run db:stop` puis `npm run db:start` | 0 / 0 | arrêt puis redémarrage PostgreSQL et requête réelle |
| second `npm run db:start` sur base active | 0 | idempotent ; même base vérifiée, aucun écrasement |
| Gate kit inchangée sous WSL | 0 | 141 tests réussis, 62,455 s |
| `npm run test:unit` | 1 | répertoire suite absent, refus explicite |
| `npm run test:functional` | 1 | répertoire suite absent, refus explicite |
| `npm run test:business` | 1 | répertoire suite absent, refus explicite |
| `npm run test:e2e` | 1 | répertoire suite absent, refus explicite |
| `npm run test:evals` | 1 | runner de modèle réel/corpus absents, refus explicite |
| `npm run test:ux` | 2 | NON CONFIGURE conservé |
| `git diff --check` | 0 | aucune erreur de whitespace |

`npm run` est exécuté après dot-sourcing du script PowerShell ; celui-ci invoque
le vrai CLI npm avec Node 24. Les commandes longues conservent leurs logs locaux
dans `.agentic/dev01-*.log`. Le manifest checksums.json rattache les fichiers et
les logs à la version examinée ; les traces complètes ne sont pas versionnées.

La requête réelle paramétrée `SELECT current_database(), $1::integer + $2::integer`
avec 19 et 23 vérifie `encave_foundation_test` et retourne 42. Le client pg utilise
des délais de connexion/requête de trois secondes. Cette preuve n'est pas un test
de persistance métier, de droits ou d'isolation inter-caves.

## Corrections et échecs conservés

1. Le premier passage des nouveaux tests donne 12/13 : Node refuse un run()
   récursif car le sous-processus hérite de NODE_TEST_CONTEXT. Le harness de test
   retire cette seule variable du sous-processus indépendant. Le vrai test positif
   et tous les cas négatifs sont conservés ; 13/13 ensuite.
2. Le premier démarrage PostgreSQL initialise et lance le serveur mais attend des
   pipes hérités sous Windows, puis affiche un échec. La première gate foundation
   compile et démarre les applications, puis échoue réellement avec code 1 car la
   base nommée n'existe pas encore. Le cleanup applicatif s'exécute. pg_ctl démarre
   désormais sans pipes capturés, tout en conservant -w, délai et log PostgreSQL.
   Les cycles stop/start et le démarrage idempotent réussissent ensuite.
3. Relecture avant review : les fichiers compilés résiduels ne doivent pas masquer
   un point d'entrée TypeScript supprimé. Vérification des entrées exactes et ajout
   d'un quatorzième test de refus, réussi. Aucun ancien test modifié.

Deux corrections de développement après échecs, puis un renforcement avant review.
Review indépendante et éventuelles corrections de review : voir status.md.

## Inspection navigateur de la page technique

agent-browser 0.37.1, page compilée sur `http://127.0.0.1:3100`, serveur Node 24.
Captures réelles dans screenshots, tailles 320×900, 390×900, 768×900 et 1440×900.
À chacune, `document.documentElement.scrollWidth === innerWidth` ; police système,
fond `rgb(248,246,243)`. Tab donne le lien « Aller au contenu », outline 3px ;
Entrée place le focus sur `#contenu`. Console et erreurs de page : aucune entrée.
Les rendus 320 et 1440 ont été examinés par l'auteur : texte lisible, contenu
entier et pas de débordement ; la review doit examiner les quatre captures.

La page n'a ni sauvegarde, chargement de données, authentification, action sensible
ou état commercial périmé. Ces états ne sont pas inventés pour cette foundation.
Cette inspection n'est ni la future gate test:ux, ni une recette utilisateur, ni
un audit WCAG complet. Les tokens et les scénarios UX métier restent applicables
aux futurs écrans. Le preview sera arrêté après review.

## Correspondance des critères

- AC-01 : sept workspaces privés, TypeScript, lockfile ; aucune dépendance marketplace.
- AC-02 : contrats de santé uniquement, zéro capacité fournisseur ou action commerciale.
- AC-03 : PostgreSQL 17.11 réellement initialisé, requête, redémarrage ; guide sans Docker.
- AC-04 : runner foundation compile et type-check chaque application/package.
- AC-05 : HTTP web/API, signal worker lié à un run aléatoire, SQL et cleanup ; refus testés.
- AC-06 : runners séparés, refus de suite absente/vide/sans tests/entièrement skipped/TODO.
- AC-07 : nouveaux tests de runners/processus/HTTP/compilateur et points d'entrée manquants.
- AC-08 : .feature et seed IA intacts ; aucune suite métier/évaluation annoncée réussie.
- AC-09 : scripts, politiques, workflows et anciens tests protégés inchangés.
- AC-10 : ADR-0003 et guide local ; choix de production encore ouverts.

## Livraison précédente et CI

INIT-01 a été publié sur main : SHA distant égal à `2ea17e66426afe569b3d80a8fbd097f4af4526a6`.
[Kit integrity](https://github.com/Samoulou/encave-assistant/actions/runs/34323264612)
est observée success sur ce SHA ; release skipped. Cela ne prouve ni foundation
distante, ni produit, ni production. Pour DEV-01, la CI applicative directe exigera
les suites complètes, encore absentes. Aucun contrôle ne sera retiré pour la faire
passer. Aucune attestation de contrôleur, intégration Microsoft, modèle ou production
n'est déclarée par cette livraison locale.
