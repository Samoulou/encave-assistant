# ADR-0000 — Amorçage indépendant du développement

Date : 2026-09-07. Statut : décision de préparation du dépôt, complétée par ADR-0002-autorite-et-connecteurs.md à la demande explicite de Sam.

## Besoin

Le dépôt doit permettre de commencer le développement dans Codex. La version historique du backlog attendait des faits terrain et des essais Microsoft en amont de tout développement. Sam a explicitement demandé de garder la décision et de supprimer cette dépendance aux prospects. Les preuves réelles restent nécessaires pour activer les connexions concernées ; elles ne conditionnent pas tout le développement. La fondation technique peut être préparée indépendamment.

## Décision

Conserver les 40 IDs EA ; leurs contrats courants sont révisés avant développement selon ADR-0002, avec l’ancienne version archivée. Ajouter INIT-01 pour constater l'environnement, puis DEV-01 pour construire une fondation locale sur données fictives. Les contrats supplémentaires figurent dans `backlog/bootstrap.json` et sont repris dans `backlog/tickets.json` ; leur cohérence est vérifiée avant exécution.

La référence est un dépôt propre à EnCave Assistant avec TypeScript, npm workspaces, Next.js pour le web, Node.js pour API et worker, PostgreSQL pour les données et l'outbox transactionnelle. Aucun service partagé avec la marketplace. Les scripts Python restent l'outillage de développement.

DEV-01 choisit et verrouille les versions exactes compatibles dans le lockfile après consultation des documentations officielles. Il documente l'outil d'accès SQL, les frameworks de tests, la validation des contrats et les commandes d'environnement. Il n'a pas besoin de choisir un fournisseur d'identité, un hébergeur ou un modèle commercial pour compiler et tester cette fondation.

Les dossiers applicatifs et leurs dépendances sont à créer par DEV-01 ; ils ne sont pas présentés comme implémentés dans ce premier dépôt. Le contrôle `foundation` doit prouver la compilation et les vérifications techniques prévues. Il ne remplace pas les tests métier, d'isolation, de concurrence, d'acceptation de proposition ou les évaluations IA.

## Maintenance préparée

Cette initialisation est une maintenance explicite du kit : ajout du contrat DEV-01, scripts de setup/reprise, entrée Codex directe et CI applicable au dépôt vide. Les fichiers protégés restent protégés pendant les tickets ordinaires.

DEV-01 peut créer ses outils dans `packages/tooling/`, modifier les commandes npm et ajouter de nouveaux tests. Il n'a pas à modifier les contrôleurs Python, les anciens tests ou les workflows. EA-04 et toute configuration ultérieure de livraison nécessitant des workflows constituent une maintenance planifiée du cadre, avec périmètre formalisé et review distincte. Cette maintenance se réalise par tâche Codex directe ; le runner strict n'accorde pas de permissions élargies à un ticket en échec.

## Limites conservées

La configuration de chaque connexion Microsoft, le catalogue du client, les décisions de région et les conditions de lancement sont explicites. Sam décide des conditions produit ; chaque client autorise uniquement ses propres comptes. Aucun de ces tickets n'est marqué terminé par la préparation de ce dépôt. Les engagements clients restent validés par le caviste en A1.
