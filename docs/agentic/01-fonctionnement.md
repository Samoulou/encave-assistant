# Fonctionnement de la boucle

`AGENTS.md` fournit les règles lues par Codex ; il ne déclenche aucun processus. `scripts/agentic.py`, écrit avec la bibliothèque standard Python, orchestre des appels distincts à `codex exec`. [Instructions de projet](https://learn.chatgpt.com/docs/agent-configuration/agents-md), [mode non interactif](https://learn.chatgpt.com/docs/non-interactive-mode).

| Commande | Rôle |
|---|---|
| `validate` | Vérifier le kit et sa configuration |
| `doctor` | Contrôler les prérequis locaux |
| `next` | Choisir un ticket dont les dépendances sont `integrated` |
| `run --ticket ID` | Traiter un ticket dans une branche et un worktree isolés |
| `status` | Afficher l'avancement et les blocages |
| `reconcile` | Prouver l'intégration par l'ascendance du commit dans la branche courante |
| `batch --limit N` | Enchaîner des traitements, sans fusionner les branches |

Chaque commande se préfixe par `python3 scripts/agentic.py`.

La boucle commence sur un dépôt propre et committé. Le contrôleur prépare le worktree avec `prepare_commands`, initialement `npm ci`. Un agent formalise en lecture seule les critères et preuves ; un second développe avec écriture limitée au workspace. Le contrôleur réinstalle les dépendances puis exécute les contrôles. Une session distincte relit diff et preuves en lecture seule. Les corrections repassent préparation, contrôles et revue. Toute préparation échouée ou modifiant les fichiers versionnés bloque. Le contrôleur parent gère les commits ; les agents ne committent pas eux-mêmes.

La politique limite chaque ticket à trois tentatives de développement et revue, huit appels d'agent, 1 200 secondes par appel et 7 200 secondes au total. Un contrôle requis absent, une revue défavorable, un accès manquant ou une limite atteinte empêche la livraison. Les instructions, le backlog produit, les tests préexistants et la configuration du pipeline sont protégés : une modification interdite bloque le résultat.

Le commit local et sa preuve dans `docs/evidence/` rendent le changement examinable. `.agentic/state.json` suit l'exécution locale ; les diagnostics restent dans `.agentic/runs/` du worktree. Le ticket ne débloque ses dépendances qu'après intégration vérifiée. `scripts/autopilot.py --limit N` ajoute la fusion locale par avance rapide et `reconcile` entre tickets. Une divergence de branches exige une reprise ; elle ne doit pas être masquée. Aucun push ni déploiement n'est exécuté.

L'autopilote exige la branche `base_branch` de la politique, initialement `main`. `python3 scripts/autopilot.py --integrate-ticket ID` reprend une livraison locale déjà vérifiée. Le verrou du contrôleur est `.agentic/run.lock` : vérifier le processus avant toute suppression d'un verrou supposé orphelin.

Ces contrôles réduisent les erreurs ; ils ne remplacent pas les permissions de l'environnement, les essais réels, ni la revue humaine des décisions de produit. Un simulateur prouve le comportement du contrôleur, jamais celui du modèle ou de Microsoft.
