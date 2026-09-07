# Livraison et intégration continue

| Niveau | Preuve nécessaire |
|---|---|
| Ticket livré | Critères démontrés, contrôles requis réussis, revue et commit local |
| Ticket intégré | Commit présent dans l'historique de la branche principale ; `reconcile` le constate |
| Préproduction | Application déployée sur un environnement choisi, migration et parcours vérifiés |
| Production | Jalons produit, accès, exploitation, reprise et décision d'activation établis |

Les workflows de `.github/workflows/` définissent les déclencheurs effectifs :

| Workflow | Déclenchement et contrôle |
|---|---|
| `kit-ci.yml` | Push/PR ; `scripts/check_kit.py` regroupe validation et tests d'outillage |
| `product-quality.yml` | Manuel, appel par un autre workflow, push sur `main`/PR touchant `apps/`, `packages/`, `src/` ou `tests/product/` ; installation npm et contrôles produit |
| `release.yml` | Manuel vers `preproduction` ou `production` ; push sur `main` vers préproduction seulement si `AUTO_RELEASE=true` |

Les workflows s’exécutent dans le dépôt GitHub lorsque les déclencheurs et autorisations Actions du compte le permettent. Une CI verte du kit ne valide pas le métier ; les suites produit absentes restent bloquantes. La livraison exige d'abord la réussite du workflow qualité. `scripts/deploy.py` échoue avec le code 2 tant que le déployeur n'est pas configuré : activer `AUTO_RELEASE` ne suffit pas à déployer.

Le contrôleur local réalise la revue Codex ; aucun job LLM GitHub n'est nécessaire au kit. En extension, utiliser un job de revue en lecture seule, avec une éventuelle clé via l'entrée `openai-api-key` de l'action depuis un secret, sans variable globale. Publier un commentaire requiert un job séparé aux seuls droits nécessaires. [Action Codex officielle](https://learn.chatgpt.com/docs/github-action).

La livraison hébergée exige d'abord une décision sur les prestataires, la région, la base, l'identité et les connecteurs. Configurer séparément développement, préproduction et production : variables non secrètes documentées, secrets propres à chaque environnement, droits limités et destinataires de test. Les scripts de livraison non configurés doivent échouer explicitement.

Avant activation, rendre exécutables déploiement, migrations, vérifications de santé et retour à la version précédente. Tester sauvegarde/restauration et réconciliation des effets externes : revenir au code précédent ne suffit pas à annuler un e-mail ou un événement Outlook. Consigner le coupe-circuit et la procédure de reprise.

Sam définit le périmètre vendu et autorise la politique de lancement. Les gates G2/G3 exigent les tests critiques, les évaluations des fonctions IA activées, la préparation de l’exploitation et l’absence d’incident critique. Une phase pilote de quatre semaines et 30 demandes est un objectif facultatif de mesure ; aucun accord ou volume fourni par Julien n’est une condition de livraison. Une fusion ne remplace pas les preuves techniques. Voir [la stratégie de tests](04-strategie-tests.md) et `docs/product/06-roadmap-lancement-business.md`.

Les filtres CI produit couvrent dépendances, configurations, tests, évaluations, scripts et workflows. Pour les push/PR du kit sans code applicatif, le job scope indique explicitement l’absence de produit et le job produit reste non exécuté. Dès qu’un fichier applicatif est présent, les suites complètes sont requises. Un lancement manuel ou une livraison force ces contrôles même si l’application manque. Les commandes non configurées et le déployeur échouent : aucune exemption du bootstrap n’autorise une production.

Kit integrity utilise le même setup que Codex : Node 24, Python 3.11, npm ci et tests d’outillage. Les actions checkout, setup-node et setup-python sont figées sur les SHA vérifiés de leurs tags v7 lors de la préparation du dépôt. Le job qualité produit aura besoin de ses services de test et navigateurs lors de l’implémentation ; leur ajout suit une maintenance dédiée.

Après un nouveau clone, scripts/restore_progress.py reconstruit l’état à partir des attestations et des commits originaux vérifiables. Cela vérifie la cohérence d’un historique Git de confiance, sans réexécuter les anciens tests. Les tâches Codex directes conservent leurs comptes rendus dans docs/work et restent distinctes de ces attestations.
