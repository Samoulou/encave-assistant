# Vérifications de préparation du dépôt

Date : 2026-09-07. Périmètre : kit de développement, pas application métier.

- Setup local exécuté : Git 2.51.1, Python 3.12.13, Node 24.19.0 et npm 11.9.0 ; npm ci réussi sur le lockfile fourni.
- **141 tests d’outillage réussis**, exécutés avec vrais dépôts/worktrees/clones temporaires et un Codex CLI simulé. Ils couvrent budgets, isolation des rôles, intégrité des exigences et anciens tests, gates, review, intégration locale et restauration des preuves après clone.
- 42 tickets structurés : 40 IDs EA courants et INIT-01 / DEV-01. Dépendances vérifiées ; aucun ticket produit déclaré terminé.
- Révisions demandées par Sam tracées dans ADR-0002 et ADR-0004 ; source v1.1 conservée, source courante v1.2. Tous les anciens critères sont conservés ; 17 tickets UI ajoutent la gate ux.
- Contrôles foundation, unit, functional, business, e2e, evals et ux exécutés : code 2 attendu car non configurés. Le contrôle produit global échoue également ; ce comportement bloque une fausse livraison.
- Trois workflows YAML vérifiés. Le contrôle sémantique des maintenances prévues utilise PyYAML 6.0.3 épinglé. Actions GitHub fixées par SHA. L’exemption de bootstrap pour un push/PR sans application ne s’applique pas à une livraison, qui force les suites produit.
- Les scénarios métier .feature et les 12 exemples d’évaluation IA sont des spécifications ; ils ne sont pas des résultats produit.

## Limites des preuves

Aucun appel réel au modèle Codex, à Microsoft Graph ou à une API IA produit n’a été effectué ici. Aucun e-mail client, réservation ou déploiement applicatif n’a eu lieu. Le premier cycle CLI réel exige la connexion et les droits de l’environnement qui l’exécute. Une tâche Codex directe suit son protocole et ne fabrique pas une attestation du contrôleur.

La reprise vérifie la cohérence des preuves dans un historique Git de confiance. Elle demande les commits originaux et l’historique complet, et ne réexécute pas les tests historiques. Les préparations, tests et commandes Git du contrôleur s’exécutent avec les droits de la machine dédiée ; la sandbox d’une session Codex ne contient pas tout ce processus.

Sam décide du périmètre et de la livraison. Les retours de prospects sont facultatifs. Les autorisations réelles et la qualification des capacités Microsoft restent nécessaires à leur activation pour un client ; elles ne conditionnent pas le développement indépendant.

## Campagne et UX/UI — maintenance du 7 septembre

`python3 scripts/check_kit.py` : 141 tests, 58,595 secondes, code de sortie 0. Les scénarios supplémentaires couvrent une campagne de 22 tickets (66 sessions CLI simulées), reprise et compteurs persistants, poursuite après blocage indépendant, arrêt demandé, destinations Git, publication refusée, état de fin non prouvé, gates CI cumulatives et maintenance limitée des workflows. Les pushes de tests utilisent des dépôts temporaires ; aucun appel Codex réel n’en découle.

La review indépendante a identifié puis recontrôlé deux corrections : refuser un état local « intégré » sans attestation avant d’annoncer la fin ; empêcher une maintenance de workflow de supprimer ou neutraliser les contrôles obligatoires. Les tests de régression passent. La review finale ne signale plus de défaut actionnable dans ce périmètre. Les étapes shell de préparation ajoutées restent à relire ; le vérificateur YAML ne constitue pas leur sandbox.

La documentation UX/UI contient 18 critères, des tokens et trois maquettes conceptuelles SVG. Les trois maquettes ont été rendues et inspectées visuellement ; les 15 paires de contraste déclarées atteignent les seuils retenus. JSON, SVG/XML, liens locaux des documents modifiés et délimiteurs Markdown ont été vérifiés. Aucun essai utilisateur, audit de l’application construite ou certification d’accessibilité n’est revendiqué.

Aucune campagne réelle n’est lancée dans cet environnement : le CLI Codex n’y est pas disponible. Les prérequis, l’authentification et le premier lancement sont décrits dans START-HERE.md. Les budgets de campagne ne sont pas un plafond financier du fournisseur. Le statut de publication ne remplace pas les résultats CI et ne prouve aucune production.
