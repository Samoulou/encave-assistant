# ADR-0009 — Transitions serveur et concurrence

Date : 2026-09-09. Décision technique réversible dans le périmètre EA-08 confié
par Sam. Dépendance : noyau EA-07 livré `1b9f250a8f36ee03a8d20ab27b8807d17936eb1f`.

Les quatre objets possèdent des vocabulaires, graphes et versions indépendants.
Une commande relit cave, droits, état et version en transaction, puis enregistre
son résultat idempotent et un événement immuable pour le login applicatif.
La clé est propre à l'acteur et à sa cave ; le rejeu recontrôle les droits et rend
le résultat historique de la commande. Les opérations concurrentes utilisent
le verrou de cave déjà partagé avec les mutations d'équipe.

Seuls les changements de classement de demande sont exposés en HTTP. Les
transitions commerciales exigent les workflows ultérieurs : une arête déclarée
dans le domaine ne prouve ni validation A1, ni accord, ni résultat fournisseur.
Les services internes n'offrent que trois transitions techniques conservatrices,
décrites dans le [guide](../development/workflow.md). Les termes figés restent
protégés par le trigger SQL EA-07. L'interface sera construite dans ses tickets.

Migration 004 additive. L'API historique du runner sans option conserve la cible
v3, explicitement testée par les tests déjà livrés ; la cible v4 devient explicite.
Ce choix préserve le contrat existant sans modifier ses tests. Les migrations
connues ultérieures ne sont jamais annulées par une cible plus ancienne.

Une course de fermeture des fixtures PostgreSQL a été reproduite sur le commit
EA-07 sous Linux. La régression ajoutée avant correction échoue avec DROP FORCE
et passe avec attente bornée des connexions puis DROP sans FORCE. Cette correction
de l'outillage est nécessaire aux preuves SQL fiables ; elle ne supprime ni
test ni erreur de connexion, et conserve la base si le nettoyage ne peut réussir.
Les résultats complets et observations CI restent distincts de cette décision.
