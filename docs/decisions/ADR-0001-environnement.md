# ADR-0001 — Environnement de développement observé

Date : 2026-09-09. Ticket : INIT-01. Décision réversible, tâche directe Codex Desktop.

## Poste et outils

Le checkout Windows `C:\tmp\encave-assistant\encave-assistant` est le dépôt
indépendant `Samoulou/encave-assistant`, sur main. Git 2.49.0.windows.1,
Python 3.12.9, npm 10.9.2 et Codex CLI 0.153.4 ont été observés. Le CLI
est seulement interrogé pour sa version : aucune boucle CLI ni authentification
du CLI n'a été vérifiée. La session de développement est celle de Codex Desktop.

Le PATH initial expose Node 22.16.0, incompatible avec `.nvmrc` (24). Le runtime
fourni par Codex contient Node 24.19.0, retenu pour cette session. Le mettre en
tête du PATH de chaque terminal de développement ; aucune installation globale
ni modification persistante du PATH utilisateur n'a été faite. Python 3.14 est
également recensé par le launcher, mais les contrôles Windows utilisent 3.12.9.

`python3` pointait initialement vers l'alias Microsoft Store, inutilisable.
Un venv local `.venv` utilise Python 3.12.9 et PyYAML 6.0.3 verrouillé ; une copie
de son lanceur python.exe nommée python3.exe permet les commandes npm existantes.
Cela change la résolution de l'interpréteur, pas les scripts du kit.

## Séparer l'édition Windows et la vérification POSIX du kit

Les 141 tests existants du kit supposent Linux/macOS/WSL. Leur exécution Windows
a réellement échoué (30 échecs, 68 erreurs), notamment sur la garde POSIX et
l'arrêt des descendants. Ne pas supprimer ces tests ou neutraliser cette garde.

Ubuntu WSL était déjà installé : Git 2.43.0, Python 3.12.3, Node 20.20.0,
npm 10.8.2. Il sert uniquement à vérifier le kit Python inchangé ; son Node 20
ne sert pas au produit. Ni pip ni ensurepip/venv n'y sont disponibles et sudo
demande un mot de passe. La wheel officielle PyYAML 6.0.3 pour Linux CPython 3.12
est donc installée par pip Windows dans `.agentic/runs/wsl-python`, puis chargée
par PYTHONPATH dans WSL. Aucun privilège administrateur n'est utilisé.

Le code, les commandes npm et les futurs services produit restent dans le
checkout Windows. Ne pas lancer scripts/continuous.py en Windows natif.
Les tests du kit utilisent leur propre simulateur de Codex ; cela n'est pas une
review du produit ni une campagne réelle. La review directe est un agent distinct.

## Structure retenue pour DEV-01

Monorepo npm workspaces TypeScript : apps/web (Next.js/React), apps/api et
apps/worker (Node), packages/domain, packages/contracts, packages/connectors et
packages/tooling. Les versions de bibliothèques et les runners seront verrouillés
par DEV-01 après lecture des documentations officielles. Aucune application n'est
implémentée par INIT-01. La palette, la typographie système, les tailles de cibles
et les références de disposition sont celles de docs/design et du document UX/UI.

## PostgreSQL et accès externes

Aucun psql, pg_ctl, serveur PostgreSQL ou service Windows PostgreSQL détecté.
Docker est installé mais son moteur Linux est arrêté. Aucune base n'est connectée
et aucune requête SQL n'est prouvée à ce stade. DEV-01 doit provisionner un cluster
de test isolé, limité à la boucle locale, et vérifier connexion, requête et arrêt.
L'archive binaire Windows EDB référencée par PostgreSQL est une option sans Docker ;
sa disponibilité et son exécution restent à vérifier.

Les fournisseurs d'identité, Microsoft, IA et hébergement ne sont pas configurés
par ce ticket. Aucun secret, compte de prospect ou donnée client n'a été lu.
Les choix de production et le lancement restent sous l'autorité de Sam.

Sources consultées le 2026-09-09 : [Node](https://nodejs.org/en/download),
[PostgreSQL Windows](https://www.postgresql.org/download/windows/),
[initdb](https://www.postgresql.org/docs/current/app-initdb.html).
Les versions ci-dessus proviennent des commandes locales, pas de ces pages.
