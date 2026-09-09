# Noyau des dossiers — EA-07

La migration `003_case_core.sql` étend 001/002 sans données de démonstration.
Le noyau se consulte par `GET /api/inquiries/{id}` avec session vérifiée et
`X-EnCave-Cave` correspondant à la cave active. Les trois rôles peuvent lire ;
une référence étrangère renvoie 404 et une cave devenue différente 409.
Ce ticket n’expose aucune commande de création, accord ou réservation au client.
La saisie manuelle est EA-11 ; les commandes métier seront ajoutées dans leurs lots.

## Relations et données

| Table | Portée et contrat |
|---|---|
| inquiries | Cave, référence locale unique dans cette cave, origine, contact, sujet, état et version optimiste |
| messages | Dossier de la cave, texte original, direction, canal, identité observée et date ; append-only pour le login applicatif |
| proposals | Famille de versions liée au dossier et à son auteur |
| proposal_versions | Numéro dans la famille, état, instantané JSON versionné et borné, validité, empreinte SHA-256 calculée en base |
| acceptances | Version et empreinte exactes, répondant observé, message du même dossier ou référence de preuve ; plusieurs preuves possibles |
| proposal_approvals | Version/termes, acteur de la cave, portée send ou book_confirm ; cette dernière référence aussi l’accord exact |
| bookings | Même dossier/version/termes/accord/autorisation, état propre et version ; aucune allocation de ressource ajoutée ici |
| actions | Référence stable/idempotence par cave, dossier, éventuelle version/réservation cohérente, état indépendant et code de résultat |

Chaque FK métier comprend la cave. Les relations sensibles comprennent aussi le
dossier et la version pertinente ; une action de réservation ne peut mélanger une
réservation et une autre version, même dans la même cave. Les acteurs référencent
des membres de cette cave. Le rattachement ne constitue pas une validation des
droits actuels, qui reste obligatoire dans chaque future commande métier.

L’empreinte utilise le texte canonique JSONB PostgreSQL, encodé UTF-8 : elle ne
doit pas être recalculée à partir d’un JSON.stringify client. Le serveur SQL
remplace toute empreinte fournie lors de l’écriture de version. Dès la sortie de
draft, sealed_at est conservé irréversiblement ; changer ensuite l’état ne permet
pas de réécrire les termes ou la validité. Les accords et validations exigent une
version figée. Les transitions autorisées par rôle sont EA-08 ; cette contrainte
d’immuabilité ne constitue pas le workflow complet de validation/envoi EA-19/20.

Les propositions peuvent encore porter un instantané technique de fixture. Le
contrat commercial exhaustif, les références de catalogue approuvé, ressources,
rendus envoyés et vérifications d’accord sont étendus par EA-09/19/22. Les données
de fixtures sont explicitement fictives et ne sont jamais exécutables en tant
qu’engagements clients. Une action planned n’est ni exécutée ni envoyée. Les jobs,
baux, tentatives et effets fournisseur restent EA-23 et suivants.

## Migrations et reprise

`migrateDatabase(ownerPool)` dans `packages/tooling/src/migrations.ts` s’exécute
avec un pool propriétaire de migration. Il utilise une connexion SQL dédiée et
un verrou de session pour sérialiser les migrations dans cette base. Il refuse
un historique discontinu ou plus récent que le code et applique les versions
manquantes en ordre. 001 est enveloppée dans une transaction ; 002/003 conservent
leurs transactions explicites. Toute erreur annule le fichier concerné ; les
versions précédentes et leurs données sont conservées. Rejouer n’insère rien.

Le générateur de bases de développement utilise ce runner. Une migration ne
charge aucune fixture ; l’API et le worker ne migrent pas au démarrage. Pour un
autre environnement, la migration est une étape opérateur avec son propre pool
autorisé avant le démarrage applicatif. Les identifiants ne sont jamais affichés
et le pool applicatif ne reçoit ni DDL ni capacité de supprimer les preuves.
Le déployeur et la qualification préproduction/production restent EA-40.

Les anciennes versions 001/002 conservent leur registre numérique initial ; ce
runner ne prétend pas auditer rétrospectivement un schéma inconnu ou vérifier les
empreintes d’une base importée. Une base dont l’origine est incertaine exige une
inspection autorisée, pas une réparation automatique. Roll-forward pour les
corrections futures ; aucun down destructif automatique.

## Fixtures et lecture

`seedCaseFixtures` reçoit la capacité détenue par le générateur de base de test.
La capacité vérifie l’instance des pools possédés, est retirée au nettoyage et
contrôle le nom de la base isolée avant écriture. Un objet imitant le contexte
est refusé. Les identifiants de fixture sont déterministes, les insertions
transactionnelles et rejouables sans réécriture des lignes. Les migrations seules
laissent les tables métier vides. Les runtimes n’importent pas ce module.

Deux caves fictives possèdent chacune DEMO-001 et Camille Exemple, avec des UUID
distincts et leur propre historique. Le prix CHF et la preuve d’accord sont des
valeurs de recette synthétiques, pas des tarifs réels ni un accord de prospect.

La lecture retourne l’identité du dossier et son historique, borné à 200 entrées
par ensemble ; `truncated` indique les ensembles incomplets. Les textes et
instantanés sont bornés à 1 Mio par ligne en base. La pagination opérationnelle,
la politique de rétention et les interfaces complètes seront livrées dans les
tickets correspondants. Aucun message client n’est copié dans le journal technique.

Preuves : tests PostgreSQL sous login applicatif, migration vide/mise à niveau/
rollback, API réelle, navigateur et redémarrage d’un vrai processus API dans
[EA-07](../work/EA-07/contract.md). Pas d’IA, Microsoft, CI ou production déduits.

Sources consultées : [contraintes PostgreSQL 17](https://www.postgresql.org/docs/17/ddl-constraints.html),
[verrous](https://www.postgresql.org/docs/17/explicit-locking.html),
[triggers PL/pgSQL](https://www.postgresql.org/docs/17/plpgsql-trigger.html).
