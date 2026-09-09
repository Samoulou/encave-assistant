# États et versions — EA-08

Le serveur expose `POST /api/inquiries/{id}/state` pour les administrateurs et
opérateurs de la cave active. La session, l'origine, le jeton CSRF et l'en-tête
`X-EnCave-Cave` sont contrôlés avant toute mutation. Le corps contient uniquement
`state` et `expectedVersion` (entier de 1 à 2 147 483 647). Une clé UUID stable
`Idempotency-Key` identifie cette commande pour cet acteur et cette cave.

Exemple : `{ "state": "qualifying", "expectedVersion": 1 }` sur une demande
`received` en version 1 retourne son identifiant, sa cave, `qualifying` et version 2.
Un concurrent portant encore version 1 reçoit `409/version_conflict` ; il doit
relire le dossier avant de préparer une nouvelle commande. Une clé déjà utilisée
avec une autre charge reçoit `409/idempotency_conflict`. Le rejeu identique retourne
le résultat enregistré, même si le dossier a évolué depuis : utiliser le GET du
dossier pour connaître son état actuel. Les droits actuels sont revérifiés avant
le rejeu ; une révocation, un rôle lecteur ou un changement de cave le bloque.

Une arête absente donne `409/transition_forbidden`, un workflow commercial requis
`409/workflow_required`, et une version maximale `409/version_exhausted`. Une cave
différente donne 409, une référence étrangère 404, un rôle interdit 403. Aucun de
ces refus ne modifie le compteur ou l'historique. L'API ne prend ni rôle, ni cave,
ni preuve commerciale dans le JSON. Aucune interface nouvelle dans cette tranche.

## Machines indépendantes

Les graphes complets et testés sont dans `packages/domain/src/workflow.ts`.
Les vocabulaires restent ceux des contrats et tables EA-07.

| Objet | Transitions disponibles dans cette fondation |
|---|---|
| Demande | received → qualifying/archived ; qualifying → waiting_customer/ready/archived ; waiting_customer → qualifying/archived ; ready → qualifying/processed/archived ; processed → qualifying/archived ; archived → qualifying |
| Version de proposition | draft → pending_approval, par service interne ; fige les termes sans les réécrire |
| Réservation | preparing → cancelled, par service interne, seulement en l'absence d'allocations et d'effets externes possibles |
| Action | planned → abandoned, par service interne ; aucun appel fournisseur |

Les autres arêtes connues sont refusées jusqu'aux services qui prouvent leurs
préconditions. Aucune API publique de transition générique des quatre objets
n'est exposée. Un état de demande `processed` est un classement opérationnel et
ne signifie ni accord client ni réservation confirmée. Une action ne change pas
implicitement l'état d'une réservation ou d'une demande.

L'annulation technique de réservation refuse toute action liée qui ne soit pas
une fixture explicitement sans effet, ou dont l'état soit déjà actif/terminé.
La présence de la future table d'allocations ferme également ce raccourci ; le
workflow d'annulation complet devra libérer les allocations et réconcilier les
effets. Aucun résultat fournisseur ou accord A1 n'est inventé ici.

## Transaction et journal

Le service résout et verrouille la session puis la cave, relit les droits et la
ligne SQL, vérifie l'état et la version, puis incrémente celle-ci par UPDATE
conditionnel. Le résultat idempotent et l'événement sont écrits dans la même
transaction. Une panne de journal annule les trois écritures. Les commandes
concurrentes de la même cave sont sérialisées par le verrou de cave existant ;
cette granularité conservative pourra être réduite avec preuves de concurrence.

La migration 004 ajoute `workflow_commands` et `workflow_events`. Chaque commande
référence un membre et l'objet du bon type dans sa cave. Chaque événement référence
exactement la commande, son objet, son état et sa version résultants. L'unicité
par objet/version empêche les doublons ; l'événement incrémente la version de un.
Le login applicatif dispose de SELECT/INSERT uniquement sur ces deux tables.
L'historique ne contient ni corps de message, ni jeton, ni instantané commercial.
Les contraintes SQL ne remplacent pas le serveur qui contrôle les arêtes et droits.
Le journal n'est pas encore ajouté au GET historique de l'interface ; EA-11/28
prépareront sa présentation et pagination opérationnelles.

## Migration et nettoyage de recette

Le contrat publié `migrateDatabase(ownerPool)` conserve sa cible v3. Pour installer
les commandes EA-08, appeler explicitement
`migrateDatabase(ownerPool, { targetVersion: 4 })` dans l'étape de migration
autorisée. Le générateur de bases possédées cible `migrationFiles.length`.
Une cible inférieure ne rétrograde jamais une base dont les versions sont connues.
Les tests vérifient installation v3, ajout de 004, rejeu et refus d'une cible inconnue.
API et worker ne migrent pas implicitement et n'obtiennent aucun droit DDL.

Le nettoyage des seules bases synthétiques créées par le générateur ferme ses
pools puis attend au plus cinq secondes que PostgreSQL constate la fermeture
des connexions. Il supprime ensuite la base sans FORCE. En cas de connexion
persistante, il échoue et conserve la base pour diagnostic ; aucune connexion
cliente n'est brutalement coupée. Cela corrige une course reproduite dans les
suites Linux EA-07. Les échecs antérieurs sont conservés dans les preuves EA-08.
Sources : [DROP DATABASE PostgreSQL 17](https://www.postgresql.org/docs/17/sql-dropdatabase.html),
[arrêt du pool node-postgres](https://node-postgres.com/apis/pool).

Preuves et limites : [contrat EA-08](../work/EA-08/contract.md). PostgreSQL, HTTP,
OIDC fictif et navigateur réels ; aucun Microsoft, IA, engagement ou déploiement.
