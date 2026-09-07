# EnCave Assistant

Assistant de gestion des demandes de visites, dégustations, salles et événements pour les caves. Le caviste garde la validation des engagements clients. **Sam pilote le produit et sa livraison.**

Ce dépôt indépendant contient la documentation et la chaîne de développement avec Codex. **L’application est à construire.**

**Commencer par [START-HERE.md](START-HERE.md)** : ouverture dans Codex, premier prompt, setup et lancement autonome local.

```bash
git clone https://github.com/Samoulou/encave-assistant.git
cd encave-assistant
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
| Boucle autonome locale | [Guide](docs/agentic/00-marche-a-suivre.md), [fonctionnement](docs/agentic/01-fonctionnement.md) |
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
| Authentification | OIDC, fournisseur à choisir |
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
python3 scripts/restore_progress.py
python3 scripts/autopilot.py --limit 2
```

Le contrôleur formalise, développe, teste, relit dans une session distincte, corrige dans les limites et intègre localement les tickets validés. Il ne pousse pas les commits et ne déploie pas de produit. Codex Cloud utilise le protocole de tâche directe ; le runner local n’est pas supposé disponible dans le cloud.

INIT-01 puis DEV-01 amorcent le développement. Les retours de Julien ou d’autres prospects sont facultatifs. Sam décide des exigences et de la livraison ; chaque cave autorise sa propre connexion fournisseur. Les intégrations ne contiennent aucune configuration spécifique à un prospect.

Les suites produit absentes échouent explicitement. Les scénarios métier et les 12 exemples d’évaluation IA sont des spécifications à rendre exécutables. Une CI verte du kit ne prouve pas que l’application fonctionne. Le déploiement reste bloqué tant que ses contrôles et son prestataire ne sont pas configurés.
