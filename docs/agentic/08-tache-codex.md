# Exécuter une tâche directement dans Codex

## Deux protocoles explicites

Le contrôleur Python s'exécute sur une machine avec Git, npm, Python et un Codex CLI authentifié. Il crée ses worktrees, sépare les trois sessions, exécute les contrôles et écrit ses attestations. C'est le protocole du lancement autonome local.

Une tâche ouverte directement dans Codex Cloud, l'application ou l'IDE travaille dans le checkout fourni par cette surface. Elle peut formaliser, implémenter et tester sans lancer un second Codex CLI. La présence d'une session Codex ne prouve pas l'existence d'un CLI utilisable, de son authentification ou des droits pour créer des worktrees adjacentes. Ne pas contourner ces droits.

## Travail d'une tâche directe

1. Lire AGENTS.md, le ticket et les références produit applicables. Consulter les preuves existantes avant de refaire un travail déjà livré. Les preuves de tâches directes vivent dans `docs/work/<ID>/` ; les attestations du contrôleur dans `docs/evidence/`.
2. Avant le code, créer `docs/work/<ID>/contract.md` : critères AC-01, AC-02… reprenant le texte et l’ordre du ticket, tests positifs/négatifs, commandes applicables, décisions, dépendances et base Git. Préserver tous les critères d'origine. Ne pas implémenter un ticket dont les dépendances ne sont pas démontrées.
3. Implémenter le ticket dans le checkout fourni. Réaliser les choix techniques réversibles dans le cadre de l'ADR d'amorçage. Conserver les contrôles protégés. Les changements du cadre suivent une tâche de maintenance explicite ; un ticket bloqué ne s'accorde pas cette exception.
4. Exécuter les gates indiquées par le ticket dans `.agentic/policy.json`. Consigner commandes, codes de sortie et synthèse des résultats dans `docs/work/<ID>/results.md`. Ne pas copier de secret ou de donnée client.
5. Demander une review dans une session indépendante ou à un agent de lecture seule lorsque la surface le permet. Fournir contrat, diff et résultats. Le reviewer indique les critères couverts, les défauts et la version examinée. La relecture par l'auteur seul ne suffit pas.
6. Corriger au maximum trois tentatives en respectant les budgets du kit. Préserver les exigences. Une review manquante ou un contrôle absent laisse `awaiting_review` ou `blocked` dans `docs/work/<ID>/status.md`, avec l'étape restante.
7. Préparer le diff ou le commit/PR selon les capacités de la surface et les autorisations établies. Dans une tâche directe, les opérations Git normales nécessaires à cette livraison sont autorisées ; aucune réécriture forcée d'historique ni mise en production implicite. Une PR n'est pas une preuve de déploiement.

La procédure autorise l'organisation de la review indépendante sans nouvelle demande si les outils le permettent. Elle ne prétend pas qu'une surface sans cette capacité fournit automatiquement une seconde session. Ne pas fabriquer la review.

## Cas INIT-01

Créer les deux fichiers demandés, `docs/decisions/ADR-0001-environnement.md` et `docs/setup-result.md`. Noter les versions effectivement disponibles. Si le CLI n'existe pas dans une tâche cloud, écrire « CLI indisponible ; exécution directe Codex » : ne pas inventer sa version et ne pas installer un second agent pour satisfaire artificiellement ce point. INIT-01 vérifie le poste/conteneur ; la boucle CLI reste non vérifiée tant qu'elle n'a pas réellement tourné.

Le setup livré avec le dépôt ne vaut pas réalisation d'INIT-01 sur l'environnement de Samuel. Tous les tickets sont initialement à faire.

## Passer d'un environnement à un autre

Le contrôleur conserve aussi un état local ignoré par Git. Sur un nouveau clone, exécuter `python3 scripts/restore_progress.py` pour reconstruire les tickets intégrés dont les attestations du contrôleur sont vérifiables dans l'historique. Conserver l'historique complet et les commits d'attestation ; une livraison squashée peut ne plus être restaurable automatiquement.

Les comptes rendus de tâches directes ne sont pas des attestations du contrôleur : cette commande ne les transforme pas en tickets intégrés. Pour poursuivre par tâches directes, s'appuyer sur leurs critères, reviews et commits réels. Pour revenir au contrôleur, effectuer une revalidation du ticket ou prévoir un import de preuves explicitement validé ; ne pas éditer l'état à la main pour déclarer le travail terminé.

## Sources

- [Environnements et tâches cloud](https://learn.chatgpt.com/docs/environments/cloud-environment).
- [Instructions AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md).
- [Exécution non interactive](https://learn.chatgpt.com/docs/non-interactive-mode).
