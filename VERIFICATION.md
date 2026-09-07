# Vérifications de préparation du dépôt

Date : 2026-09-07. Périmètre : kit de développement, pas application métier.

- Setup local exécuté : Git 2.51.1, Python 3.12.13, Node 24.19.0 et npm 11.9.0 ; npm ci réussi sur le lockfile fourni.
- **81 tests d’outillage réussis**, exécutés avec vrais dépôts/worktrees/clones temporaires et un Codex CLI simulé. Ils couvrent budgets, isolation des rôles, intégrité des exigences et anciens tests, gates, review, intégration locale et restauration des preuves après clone.
- 42 tickets structurés : 40 IDs EA courants et INIT-01 / DEV-01. Dépendances vérifiées ; aucun ticket produit déclaré terminé.
- Révision des exigences demandée par Sam tracée dans ADR-0002 ; ancien référentiel et ancienne documentation conservés dans les archives.
- Contrôles foundation, unit, functional, business, e2e et evals exécutés : code 2 attendu car non configurés. Le contrôle produit global échoue également ; ce comportement bloque une fausse livraison.
- Trois workflows YAML vérifiés. Actions GitHub fixées par SHA. L’exemption de bootstrap pour un push/PR sans application ne s’applique pas à une livraison, qui force les suites produit.
- Les scénarios métier .feature et les 12 exemples d’évaluation IA sont des spécifications ; ils ne sont pas des résultats produit.

## Limites des preuves

Aucun appel réel au modèle Codex, à Microsoft Graph ou à une API IA produit n’a été effectué ici. Aucun e-mail client, réservation ou déploiement applicatif n’a eu lieu. Le premier cycle CLI réel exige la connexion et les droits de l’environnement qui l’exécute. Une tâche Codex directe suit son protocole et ne fabrique pas une attestation du contrôleur.

La reprise vérifie la cohérence des preuves dans un historique Git de confiance. Elle demande les commits originaux et l’historique complet, et ne réexécute pas les tests historiques. Les préparations, tests et commandes Git du contrôleur s’exécutent avec les droits de la machine dédiée ; la sandbox d’une session Codex ne contient pas tout ce processus.

Sam décide du périmètre et de la livraison. Les retours de prospects sont facultatifs. Les autorisations réelles et la qualification des capacités Microsoft restent nécessaires à leur activation pour un client ; elles ne conditionnent pas le développement indépendant.
