# Développement local — Windows / DEV-01

Ce guide démarre une fondation technique sur une base synthétique. Les demandes,
l'identité OIDC, le catalogue métier, les réservations et les fournisseurs restent
à implémenter dans les tickets EA. Ne pas y charger de données client.

## Outils et installation

Git, Python >=3.11 et Node 24.19+ (majeure 24) sont requis. Le lockfile npm fixe
les dépendances ; versions et motifs dans [ADR-0003](decisions/ADR-0003-fondation-technique.md).
Depuis le dépôt, dans chaque terminal PowerShell :

```powershell
. ./packages/tooling/activate.ps1
npm ci --no-audit --no-fund
```

Le script sélectionne le runtime Node 24 fourni par Codex et appelle explicitement
le CLI JavaScript de npm avec ce Node. Sinon, fournir `-NodeBin` et `-NpmCli`.
Un simple changement de PATH ne suffit pas pour npm.cmd lorsque ce lanceur trouve
un autre node.exe dans son propre dossier. La fonction npm est locale à ce terminal.
Elle ne modifie pas l'installation globale. Pour les commandes Python historiques,
préparer le venv décrit dans [setup-result](setup-result.md).

## PostgreSQL sans Docker

Télécharger PostgreSQL **17.11** depuis l'[archive EDB Windows](https://www.enterprisedb.com/download-postgresql-binaries)
référencée par le [projet PostgreSQL](https://www.postgresql.org/download/windows/).
Archive vérifiée sur ce poste : `postgresql-17.11-3-windows-x64-binaries.zip`,
SHA-256 `4b8db0930c38f6ef845db919551dedda3b6b845aeb0927b3d79a6e8e9e4537cf`.
Cette empreinte est celle du téléchargement observé, pas une signature fournisseur.
Extraire dans un dossier local. Aucun service Windows ni Docker n'est nécessaire.

```powershell
$env:PG_BIN = (Join-Path $PWD '.agentic/runs/postgresql17/pgsql/bin')
npm run db:start
npm run check:foundation
```

Adapter PG_BIN au dossier contenant initdb.exe, pg_ctl.exe et postgres.exe.
`db:start` initialise `.local/pgdata` avec SCRAM-SHA-256, génère un mot de passe
aléatoire local, crée `encave_foundation_test`, puis exécute une requête paramétrée.
Le serveur écoute exclusivement sur `127.0.0.1:55432`. Le rôle `encave_dev` est
l'administrateur de ce cluster synthétique seulement, pas le futur rôle applicatif
de production. `.local` est ignoré par Git. Ne pas partager database.json, le fichier
temporaire de mot de passe ni le répertoire de données. Aucune valeur de production
n'est lue et aucune connexion distante n'est acceptée par le contrôle foundation.

Le démarrage conserve une base existante ; un cluster partiellement initialisé sans
configuration est refusé pour éviter de l'écraser. Une erreur de binaire, port,
permission ou SQL doit être résolue avant de relancer. Ne pas transformer l'échec
en contrôle passé. Les diagnostics PostgreSQL restent dans `.local/postgres.log`.

```powershell
npm run db:stop
```

L'arrêt est borné, conserve les données synthétiques et n'arrête que le cluster
du dépôt. Ne pas exposer ce service sur le réseau. Sur Linux, fournir PG_BIN pour
PostgreSQL 17 ou disposer des binaires dans le PATH ; cette variante du nouveau
runner n'a pas encore été exécutée dans cette livraison Windows.

## Applications et contrôles

`check:foundation` compile les packages/API/worker, construit Next.js et vérifie
TypeScript web, puis démarre les trois applications sur des ports locaux de test.
Il exige les réponses HTTP, un signal du worker lié à l'exécution et une requête
SQL réelle. Les processus applicatifs créés sont arrêtés même en échec. Le serveur
PostgreSQL, démarré séparément par l'utilisateur, reste disponible jusqu'à db:stop.

Après compilation, dans trois terminaux activés :

```powershell
npm run start:web
npm run start:api
npm run start:worker
```

Web : `http://127.0.0.1:3000`. API : `http://127.0.0.1:3001/health`.
Worker : signal JSON technique, aucune tâche commerciale. Ctrl+C arrête chaque
application manuelle. La page initiale n'est qu'un diagnostic local ; ses textes
ne présentent pas de connexion, de persistance de demande ou d'engagement fictif.

```powershell
npm run test:foundation-tooling
```

Les futurs fichiers node:test appartiennent à `tests/product/unit`, `functional`,
`business` et `e2e`, suffixe `.test.mjs`, `.test.js` ou `.test.ts`. Les commandes
échouent si le répertoire manque, est vide, si les fichiers ne déclarent aucun
test ou si tous sont skipped/TODO. Les tests de ce ticket restent séparés de ces
suites. `test:evals` exige un futur vrai runner de modèle ; `test:ux` reste non
configuré jusqu'à EA-05. Les `.feature` et le seed IA sont inchangés et non exécutés.

La gate kit inchangée s'exécute sous WSL selon [setup-result](setup-result.md).
Ne pas lancer scripts/continuous.py sous Windows natif. Aucune attestation du
contrôleur n'est fabriquée pour les comptes rendus de tâches directes.

## Livraison et limites

Un commit de foundation vérifié localement ne signifie pas réussite des suites
produit ou déploiement. La CI d'un changement applicatif direct exige toutes les
suites : les suites encore absentes restent rouges. Les environnements distants,
OIDC, Microsoft, IA, secrets gérés et politique de production seront traités par
les tickets concernés. Aucune dépense ni mise en production n'est faite par ce guide.
