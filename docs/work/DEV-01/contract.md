# DEV-01 — Contrat avant code

Date : 2026-09-09. Base Git : `2ea17e66426afe569b3d80a8fbd097f4af4526a6`, main.
Dépendance INIT-01 : commit ci-dessus, review indépendante pass, kit WSL 141/141.
Mode direct Windows ; kit POSIX exécuté inchangé dans WSL.

## AC-01

Créer un monorepo npm workspaces TypeScript avec apps/web (Next.js/React), apps/api et apps/worker (Node.js), packages/domain, packages/contracts, packages/connectors et, si nécessaire, packages/tooling ; conserver des dépendances verrouillées et zéro import, secret ou code partagé avec la marketplace EnCave.

Acceptation positive/négative : Manifestes, lockfile npm ci, compilation des six workspaces applicatifs ; refus si un workspace ou son source manque. Aucun import externe à ce dépôt.

## AC-02

Limiter cette fondation à des données synthétiques et à des vérifications techniques locales ; ne pas implémenter de réservation commerciale, authentification réelle, envoi client, connexion Microsoft ou appel de modèle et ne déclarer terminé aucun ticket EA.

Acceptation positive/négative : Page et réponses techniques explicitement synthétiques ; inspection du diff : aucune fonction commerciale, OAuth, envoi ni modèle.

## AC-03

Fournir une configuration PostgreSQL de développement reproductible et des paramètres d’exemple sans secrets ; vérifier réellement une connexion et une requête SQL sur une base de test isolée, puis consigner la méthode de démarrage et d’arrêt sans présumer Docker disponible.

Acceptation positive/négative : PostgreSQL 17 natif, initialisation SCRAM sur boucle locale, base encave_foundation_test ; requête réelle et arrêt. Refus si binaires/configuration/SQL indisponibles.

## AC-04

Implémenter npm run check:foundation avec un runner dans packages/tooling ou un autre nouveau chemin autorisé : il exécute la vérification TypeScript et la compilation des trois applications et des packages concernés ; toute erreur ou composant manquant rend la commande non nulle.

Acceptation positive/négative : TypeScript strict pour tous les projets, next build, sorties attendues ; corruption TS dans fixture temporaire refusée. Aucun ancien test modifié.

## AC-05

Faire exécuter par check:foundation des contrôles de démarrage observables : réponse HTTP de la page web et de l’API, signal de disponibilité du worker et accès SQL de développement ; utiliser des délais bornés, arrêter les processus lancés et échouer si un contrôle manque, expire ou échoue.

Acceptation positive/négative : HTTP page web et API, signal JSON du worker, requête SQL ; délais bornés et nettoyage finally. Échec HTTP, absence signal, processus mort et timeout refusés par nouveaux tests.

## AC-06

Préparer les commandes npm run test:unit, test:functional, test:business, test:e2e et test:evals pour leurs futurs runners ; chacune échoue explicitement si sa suite est absente, vide ou entièrement ignorée. Les contrôles techniques de foundation ne remplacent aucune preuve produit.

Acceptation positive/négative : Runners futurs séparés, découverte de fichiers et résumé réel node:test. Répertoires absents/vides, fichiers sans tests, tout skipped/todo => non nul. Evals reste non configuré sans appel de modèle.

## AC-07

Prouver les refus pour les suites vides ou absentes et pour un contrôle de foundation en échec par des tests d’outillage ajoutés dans packages/tooling ; ne pas modifier les tests existants et ne pas utiliser passWithNoTests, un catch transformant l’échec en succès ou un résultat préenregistré.

Acceptation positive/négative : Tests outillage isolés exécutant les processus et runners réels ; aucune donnée de résultat préenregistrée.

## AC-08

Conserver les scénarios .feature comme spécifications non exécutées tant que les comportements métier correspondants manquent. La seule lecture de fixtures, le seed IA ou un modèle simulé ne permet pas de déclarer test:business ou test:evals réussi ; une évaluation future devra appeler le modèle configuré et publier ses résultats réels.

Acceptation positive/négative : Conserver les .feature et seed intacts ; documenter absence des suites produit et évaluations réelles.

## AC-09

Ne modifier ni scripts/, ni .github/workflows/, ni les autres chemins protégés pour réaliser cette fondation ; relier les commandes nécessaires par package.json et placer le nouvel outillage dans packages/tooling. Une configuration d’environnement indispensable mais indisponible devient un blocage documenté.

Acceptation positive/négative : Git diff contre base : aucun chemin protégé ni ancien test modifié. Nouveaux outils uniquement packages/tooling et paramètres npm.

## AC-10

Documenter dans docs/decisions/ADR-0003-fondation-technique.md les versions et choix réversibles retenus ; compléter le guide local et les résultats observés, en distinguant fondation technique, tests produit non exécutés, intégrations non configurées et choix de production encore ouverts.

Acceptation positive/négative : ADR-0003 et guide local avec versions, démarrage/arrêt, commandes observées, preuves de limites et production ouverte.

## Choix et vérification

Références : brief, ADR-0000/0001/0002/0004, documents UX/UI et docs/design
(tokens et trois maquettes), stratégie de tests et DoR/DoD. Aucun écran métier
avant EA-05. Page de diagnostic locale avec police système, fond pierre et
bordeaux ; aucun faux dossier ni bouton commercial.

- Next.js App Router / React, API HTTP Node et worker Node, npm workspaces.
- TypeScript 5.9.3 strict, pg (requêtes paramétrées), Zod pour les contrats.
- node:test pour l'outillage et futurs tests serveur ; Playwright et axe-core
  retenus pour les futurs parcours navigateur/UX. Aucune suite produit verte ici.
- PostgreSQL 17.11 Windows depuis l'archive EDB officielle, sans Docker.
  Variables d'exemple sans secrets, génération locale de credentials synthétiques
  dans un répertoire ignoré ; aucun service Windows global à créer.
- Délais de compilation et démarrage bornés ; arrêt des arbres de processus
  seulement créés par le runner, y compris sous Windows.
- Gates : kit inchangé sous WSL et `npm run check:foundation` Windows Node 24.
  Nouveaux tests : `npm run test:foundation-tooling`. Sept commandes produit
  restent soumises à la présence d'une vraie suite applicable.
- Budget : trois tentatives de correction au maximum, huit appels d'agents,
  7 200 secondes ; review indépendante à partir du diff et des sorties réelles.
- Livraison directe par commit local après review ; CI complète d'une modification
  applicative directe peut rester rouge sur suites produit absentes. Ne pas
  créer d'attestation du contrôleur pour obtenir une exemption.
