# EnCave Assistant

Assistant de gestion des demandes de visites, dégustations, salles et événements pour les caves. Le caviste garde la validation des engagements clients. **Sam pilote le produit et sa livraison.**

Ce dépôt indépendant contient la documentation, la chaîne de développement, la fondation technique locale et une première tranche d’identité/équipe avec sessions PostgreSQL, invitations et rôles. Le [guide identité](docs/development/identity.md) permet de l’essayer avec des comptes fictifs ; les [exports d’équipe](docs/development/tenant-exports.md) sont préparés par un worker et cloisonnés par cave. Le [noyau des dossiers](docs/development/case-core.md) conserve demandes et historiques avec des références composées, et expose leur lecture authentifiée. Les commandes commerciales, Microsoft et l’IA restent à construire. Le [guide Windows](docs/local-development.md) décrit Node 24, PostgreSQL, le build et les contrôles.

**Commencer par [START-HERE.md](START-HERE.md)** : ouverture dans Codex, premier prompt, setup et lancement autonome local.

Les [commandes d'état](docs/development/workflow.md) vérifient les droits et la
version côté serveur ; une modification concurrente retourne un conflit, avec
résultat idempotent et journal transactionnel. Les workflows commerciaux restent
à réaliser dans les tickets suivants.

Le [catalogue](docs/development/catalog.md) conserve des fiches approuvées par cave,
des versions immuables et les règles de prix explicites ; son garde serveur exclut
les offres incomplètes, périmées ou désactivées de la sélection automatique.

Les [ressources et leurs horaires](docs/development/resources.md) possèdent des
configurations versionnées, des marges et des fermetures. L'aperçu des intervalles
traite les changements d'heure et distingue les règles internes d'une disponibilité
complète, qui reste à calculer dans les tickets suivants.

La [saisie manuelle](docs/development/manual-inquiries.md) conserve le besoin après
un appel, son origine et l'acteur. La file et le dossier relisent PostgreSQL ;
les filtres, erreurs et commandes incertaines possèdent un parcours de reprise.
La saisie ne déclenche aucun envoi ni réservation.

```bash
git clone https://github.com/Samoulou/encave-assistant.git
cd encave-assistant
python3 -m venv .venv
source .venv/bin/activate
python3 scripts/setup_codex.py
```

Prérequis : Git, Node 24/npm et Python 3.11+. Aucun secret produit n’est nécessaire pour préparer le kit.

## Ce que contient le dépôt

| Élément | Point d’entrée |
|---|---|
| Instructions et responsabilités Codex | [AGENTS.md](AGENTS.md) |
| Brief et documentation complète | [docs/product](docs/product/README.md) |
| Roadmap, lancement et business | [Roadmap produit](docs/product/06-roadmap-lancement-business.md) |
| 40 tickets produit + INIT-01 et DEV-01 | [Backlog](backlog/README.md) |
| Connexion générique des outils de chaque client | [Connecteurs et onboarding](docs/product/10-connecteurs-et-onboarding.md) |
| UX/UI, parcours et critères | [Conception UX/UI](docs/product/11-ux-ui-et-design.md), [trois maquettes et tokens](docs/design/README.md) |
| Campagne jusqu'à la fin du backlog | [Lancement, reprise et limites](docs/agentic/09-campagne-autonome.md) |
| Installation et contrôleur | [Guide](docs/agentic/00-marche-a-suivre.md), [fonctionnement](docs/agentic/01-fonctionnement.md) |
| Tâches Codex directes et review | [Protocole](docs/agentic/08-tache-codex.md) |
| Tests, évaluations et preuves | [Stratégie](docs/agentic/04-strategie-tests.md), [vérifications initiales](VERIFICATION.md) |
| CI et livraison | [Livraison](docs/agentic/02-livraison-et-ci.md) |

## Référence technique

| Couche | Choix de référence |
|---|---|
| Web | Next.js / React / TypeScript |
| API et worker | Node.js / TypeScript |
| Données et tâches durables | PostgreSQL + outbox transactionnelle |
| Organisation | npm workspaces, apps/web, apps/api, apps/worker, packages/domain, contracts, connectors |
| Authentification | OIDC avec sessions serveur ; fournisseur synthétique local, Keycloak cible distincte |
| Intégrations | Adaptateurs génériques ; Microsoft Graph / OAuth en premier |
| Développement | Codex, contrôleurs Python, GitHub Actions |

DEV-01 crée la fondation et verrouille les dépendances. Les choix restants sont consignés dans les ADR. Le dépôt, les données, les accès et les déploiements sont indépendants de la marketplace EnCave.

## Commandes utiles

```bash
python3 scripts/check_kit.py
python3 scripts/agentic.py next
python3 scripts/agentic.py doctor
python3 scripts/restore_progress.py --check
```

Avec un CLI Codex authentifié, depuis le terminal d’une machine de développement dédiée et la branche main :

```bash
python3 scripts/continuous.py
```

La campagne formalise, développe, teste, relit dans une session distincte, corrige dans les limites, intègre et publie les tickets validés. Elle poursuit les 42 tickets sans accord entre chaque tâche, conserve les budgets et reprend avec `--resume`. `--status` consulte l'avancement ; `--stop` demande un arrêt après le ticket courant. Les accès manquants et résultats incertains restent des blocages explicites ; publication et production sont des états distincts. Codex Cloud utilise le protocole de tâche directe lorsque le contrôleur n'y est pas disponible.

INIT-01 puis DEV-01 amorcent le développement. Les retours de Julien ou d’autres prospects sont facultatifs. Sam décide des exigences et de la livraison ; chaque cave autorise sa propre connexion fournisseur. Les intégrations ne contiennent aucune configuration spécifique à un prospect.

Les suites produit absentes échouent explicitement. Les scénarios métier et les 12 exemples d’évaluation IA sont des spécifications à rendre exécutables. Une CI verte du kit ne prouve pas que l’application fonctionne. Le déploiement reste bloqué tant que ses contrôles et son prestataire ne sont pas configurés.
