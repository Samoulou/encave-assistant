# Sources et statut des vérifications

Références officielles consultées le **7 septembre 2026**. Revalider les commandes et permissions avec la version CLI installée et les règles de ton compte.

| Source | Usage dans le kit |
|---|---|
| [Codex CLI](https://learn.chatgpt.com/docs/codex/cli) | Installation et démarrage local |
| [Mode non interactif](https://learn.chatgpt.com/docs/non-interactive-mode) | Appels `codex exec`, sorties et sandbox |
| [Instructions AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md) | Consignes hiérarchiques du dépôt |
| [Commandes développeur](https://learn.chatgpt.com/docs/developer-commands?surface=cli) | Options CLI et diagnostic de connexion |
| [Approbations et sécurité](https://learn.chatgpt.com/docs/agent-approvals-security) | Permissions et limites d'exécution |
| [Authentification](https://learn.chatgpt.com/docs/auth) | Connexion locale et secrets |
| [Action GitHub Codex](https://learn.chatgpt.com/docs/github-action) | Clé via entrée d'action, jobs de revue et de publication séparés |
| [Configuration de base](https://learn.chatgpt.com/docs/config-file/config-basic) | Réglages du poste et du projet, confiance |
| [Installation WSL](https://learn.microsoft.com/fr-fr/windows/wsl/install) | Parcours Windows vers Ubuntu WSL2 |
| [Versions Node.js](https://nodejs.org/en/about/previous-releases) | Node.js 24 LTS pour l'outillage |
| [Téléchargement Node.js](https://nodejs.org/en/download) | Installation adaptée au poste |
| [Connexion GitHub CLI](https://cli.github.com/manual/gh_auth_login), [création de dépôt](https://cli.github.com/manual/gh_repo_create) | Publication privée facultative par l'utilisateur |

La référence produit courante, révisée à la demande de Sam, est dans `docs/product/`, dont `07-sources.md` conserve les sources métier et Microsoft. Les contrats proposés et les estimations restent des cibles à vérifier. INIT-01 et DEV-01 sont les ajouts d’amorçage ; les 40 IDs EA proviennent du backlog produit. Les exigences historiques sont archivées et ne priment pas sur les décisions courantes de Sam.

Les contrôles locaux du contrôleur utilisent un simulateur de CLI. Aucun CLI Codex connecté, appel LLM réel, intégration Microsoft ni déploiement produit n'a été validé pendant la préparation de ce dossier. Les scénarios d'acceptation et le seed IA sont non exécutés. Les futurs rapports doivent distinguer tests réels, simulations, blocages et travaux non exécutés.

Sources primaires des workflows consultées le 7 septembre 2026 : [checkout](https://github.com/actions/checkout), [setup-python](https://github.com/actions/setup-python), [setup-node](https://github.com/actions/setup-node).
