# Commencer EnCave Assistant dans Codex

Le dépôt contient le brief, la roadmap, les 40 tickets produit et les outils de développement. L'application reste à construire. Deux tickets techniques, **INIT-01 puis DEV-01**, permettent de commencer sans dépendre d’un prospect ou de ses accès.

## Ouvrir le dépôt

Dans Codex relié à GitHub, sélectionner **Samoulou/encave-assistant**, branche **main**. Dans Codex sur ton poste, cloner puis ouvrir le dossier :

```bash
git clone https://github.com/Samoulou/encave-assistant.git
cd encave-assistant
```

Le dépôt est déjà initialisé : ne pas recréer le dépôt Git ou son remote.

## Premier message à Codex

```text
Lis AGENTS.md et START-HERE.md. Réalise INIT-01 selon le protocole adapté à
l'environnement décrit dans docs/agentic/08-tache-codex.md. Formalise ses critères
avant de modifier des fichiers, exécute les contrôles et consigne les résultats
observés. Organise une review indépendante si cette capacité est disponible ;
sinon conserve explicitement le statut en attente de review. Ne suppose aucun
accès Microsoft, aucune clé IA produit ni aucune validation de Julien. Prépare
la livraison du ticket avec ses preuves, sans changer les exigences pour réussir.
```

L'agent lit le backlog et les règles directement dans le dépôt ; il n'a pas besoin de retrouver notre conversation. Une tâche Codex directe suit le protocole de [tâche et review](docs/agentic/08-tache-codex.md). Elle ne doit pas lancer un CLI imbriqué sans vérifier ses prérequis.

## Préparation de l'environnement

Prérequis du kit : Git, **Node 24 avec npm**, **Python 3.11 ou supérieur**. Depuis la racine :

```bash
python3 scripts/setup_codex.py
```

La commande installe les dépendances verrouillées et vérifie l'outillage. Elle n'appelle aucun modèle, ne demande aucun secret et ne provisionne aucun service. Les commandes produit non configurées échouent volontairement.

Pour **Codex Cloud**, configurer Node 24 et Python 3.11 ou supérieur dans l'environnement, puis utiliser `python3 scripts/setup_codex.py` comme script de setup et de maintenance. Aucun secret n'est nécessaire au premier ticket. La sélection du dépôt et de l'environnement dans ton compte reste à faire. Pour DEV-01, prévoir l'accès au registre npm et aux documentations officielles, ainsi qu'un PostgreSQL de développement ; Docker n'est pas supposé disponible dans le cloud. Les règles réseau du compte priment sur le dépôt. [Configuration officielle des environnements Codex](https://learn.chatgpt.com/docs/environments/cloud-environment).

## Enchaîner automatiquement sur une machine de développement

Pour la boucle complète formalisation → code → tests → review indépendante → commit → intégration locale, installer et authentifier **Codex CLI** une fois, puis exécuter le contrôleur dans le terminal de la machine de développement, **hors d'une session Codex imbriquée** :

```bash
codex login status
python3 scripts/agentic.py doctor
python3 scripts/restore_progress.py
python3 scripts/autopilot.py --limit 2
```

Sur un clone neuf, la limite 2 vise INIT-01 puis DEV-01 si le premier réussit. Le contrôleur prépare et relit chaque ticket séparément ; un ticket bloqué conserve ses diagnostics. Aucun push ni déploiement n'est effectué par cette commande. Le [guide local](docs/agentic/00-marche-a-suivre.md) décrit installation, autorisations initiales, budgets et reprise. Les tests et npm s'exécutent avec les droits de la machine : utiliser un environnement dédié sans secrets de production.

## Ordre de travail et états

| Étape | Résultat attendu |
|---|---|
| INIT-01 | Versions observées, rapport de setup et ADR de l'environnement |
| DEV-01 | Fondation TypeScript, commandes de build/démarrage/test et PostgreSQL de développement |
| EA-01 / EA-02 | Cadrage piloté par Sam et contrat générique Microsoft ; retours terrain facultatifs |
| EA-03 / EA-04 puis autres EA | Choix de lancement, environnements et fonctionnalités selon leurs dépendances |

Sam garde la main sur toutes les décisions de développement et de lancement. Les tests techniques restent obligatoires ; aucun accord de Julien ou d’un prospect n’est requis. L’activation réelle d’une connexion demande les droits du compte client, selon les règles du fournisseur.

DEV-01 ne termine aucun ticket EA. Les décisions commerciales, le fournisseur d'identité, l'hébergement et le modèle IA définitifs restent à documenter. La [décision d'amorçage](docs/decisions/ADR-0000-amorcage.md) fixe le périmètre technique indépendant.

Au premier push, **Kit integrity** vérifie le kit. **Product quality** indique que l'application est absente ; aucun test métier n'est présenté comme réussi. Dès que du code applicatif est présent, les suites produit deviennent obligatoires dans ce workflow. Tout lancement de livraison force ces contrôles ; un produit ou un déployeur absent reste bloquant.
