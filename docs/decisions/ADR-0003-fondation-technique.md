# ADR-0003 — Fondation technique locale indépendante

Date : 2026-09-09. Ticket DEV-01. Choix réversibles délégués par Sam.

| Élément | Version retenue | Rôle |
|---|---|---|
| Node / npm | 24.19.0 / 10.9.2 | Runtime Windows et workspaces |
| TypeScript | 5.9.3 | Vérification stricte et compilation NodeNext |
| Next.js | 16.3.4 | App Router, build web et démarrage local |
| React / React DOM | 19.2.8 | Rendu de la page locale |
| PostgreSQL | 17.11, archive EDB Windows -3 | Cluster dédié synthétique, SCRAM, boucle locale |
| pg | 8.23.0 | SQL explicite, paramètres et délais bornés |
| Zod | 4.5.4 | Contrat technique runtime partagé API/worker |
| node:test | Fourni avec Node 24 | Outillage et futurs tests serveur |
| Types Node / pg | 24.13.3 / 8.20.0 | Types compatibles avec le runtime |
| Types React / React DOM | 19.2.18 / 19.2.7 | Vérification du web |

Les dépendances exactes sont dans les package.json et package-lock.json.
TypeScript 5.9.3 reste choisi plutôt que d'introduire sa nouvelle majeure au
premier ticket. Le runner est lui-même TypeScript : Node 24 exécute ses sources
avec effacement des types, puis tsc compile aussi packages/tooling.

Pour les futurs E2E et UX, Playwright et axe-core sont retenus (versions observées
1.63.0 et 4.13.0, à verrouiller lors de leur installation par EA-05). Ils ne sont
pas des suites exécutées par DEV-01. L'inspection ponctuelle de la page utilise
agent-browser 0.37.1 installé dans `.local/browser-tools` ; ses captures restent
une preuve de cette page technique seulement.

## Organisation et limites

apps/web utilise React/Next sans initialisation SQL au build. apps/api expose
uniquement GET /health et refuse les autres routes. apps/worker expose un signal
technique et n'effectue aucun effet externe. packages/domain ne contient que le
périmètre technique ; packages/contracts valide ce signal ; packages/connectors
déclare zéro capacité disponible. Aucun code, composant, compte ou secret de la
marketplace EnCave n'est importé. Aucune authentification réelle n'est simulée.

packages/tooling contient les contrôles, l'environnement PostgreSQL et les nouveaux
tests. La gate foundation vérifie tous les workspaces, compile et démarre les trois
applications avec délais, contrôle SQL et cleanup. La base doit être démarrée
explicitement ; son indisponibilité est un échec. Les suites produit et évaluations
restent distinctes, avec refus des suites absentes/vides/ignorées. Les fichiers
protégés, scénarios .feature et anciens tests ne sont pas modifiés.

Le PostgreSQL local est un cluster technique dédié. Le rôle de test superutilisateur
ne prouve aucune isolation inter-caves ; celle-ci appartient à EA-05/06/07 et devra
être éprouvée avec le rôle serveur effectif. Les choix d'OIDC, hébergement, région,
clés gérées, migrations métier et modèle restent ouverts aux ADR/tickets suivants.

L'interface utilise les références docs/design : fond pierre, bordeaux, police
système et lien d'évitement. Les valeurs du skill Next.js qui suggèrent d'autres
polices ou un thème sombre ne remplacent pas la décision produit du dépôt.

## Précision sur l'observation INIT-01

INIT-01 a bien observé Node 24 et exécuté npm ci avec ce Node en tête du PATH.
DEV-01 révèle que le lanceur Windows npm.cmd utilise néanmoins son node.exe
adjacent (22.16.0). Les anciennes mentions « npm ci sous Node 24 » décrivaient
la sélection du PATH, pas le runtime réel de ce lanceur. Cette précision corrige
l'interprétation sans effacer les anciens résultats : cette installation initiale
n'avait aucune dépendance produit. L'installation et les builds DEV-01 utilisent
désormais explicitement Node 24 pour npm et ses scripts via activate.ps1.

## Références officielles consultées

- [Installation Next.js](https://nextjs.org/docs/app/getting-started/installation)
- [Runner Node 24](https://nodejs.org/docs/latest-v24.x/api/test.html)
- [Connexion node-postgres](https://node-postgres.com/features/connecting)
- [PostgreSQL Windows](https://www.postgresql.org/download/windows/)
- [initdb](https://www.postgresql.org/docs/17/app-initdb.html) et [pg_ctl](https://www.postgresql.org/docs/17/app-pg-ctl.html)

Guide : [développement local](../local-development.md). Résultats et refus réels :
[DEV-01](../work/DEV-01/results.md). Aucun succès CI produit ni déploiement n'est
déduit de cette ADR ou des seuls résultats foundation.
