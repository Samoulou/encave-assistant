# Isolation des caves et exports d’équipe — EA-06

Le parcours [identité](identity.md) démarre désormais aussi le worker d’exports.
Dans Paramètres, un administrateur peut préparer un CSV des membres de sa cave.
La demande et sa tâche sont enregistrées ensemble dans PostgreSQL. Le navigateur
affiche l’attente, puis le téléchargement seulement quand le worker a écrit le
résultat. Un rechargement retrouve l’état ; le fichier ne s’ouvre qu’après clic.
Lecteurs et opérateurs ne disposent pas de cette commande.

## Frontières d’autorisation

`@encave/tenancy` partage entre l’API et le worker les transactions, verrous de cave,
contrôles d’appartenance et services d’export. L’API vérifie le cookie de session
opaque, recharge son acteur et sa cave active puis contrôle le rôle. Le header de
cave est seulement une précondition : s’il diffère de la session, la commande est
refusée. Les champs de cave/acteur/rôle/connexion/modèle envoyés dans le corps d’une
création d’export sont refusés, plutôt que retenus comme autorité.

L’export contient nom de cave, nom, e-mail, rôle et état des membres. Les cellules
sont citées et les préfixes de formule neutralisés. Les noms de présentation
identiques ne servent jamais de clé ; les tests emploient deux « Camille Test »
appartenant à des caves distinctes et vérifient leurs adresses propres.

Le worker reçoit une référence de travail, relit les lignes durables et refuse une
enveloppe dont la cave ou l’export ne correspond pas. Des clés étrangères composites
associent tâche, export, cave et membre. Avant de produire le fichier, il reprend
le verrou de cave et vérifie que l’administrateur est encore actif avec la même
version d’appartenance. Une révocation puis réinvitation ne ressuscite pas un ancien
export. Statut, liste et téléchargement sont également limités à la cave et au
demandeur courant ; une référence étrangère retourne 404 sans contenu.

Le rôle SQL du runtime et des tests n’est ni propriétaire, ni superutilisateur,
ni BYPASSRLS/CREATEDB/CREATEROLE. Il n’a pas CREATE sur le schéma, ni droit de modifier
les tables ou leurs contraintes. Les tests soumettent réellement des références
croisées et tentent de désactiver les triggers avec ce login. Le propriétaire
des migrations sert uniquement à préparer les fixtures, pas à prouver ces droits.

Le rôle applicatif reste un rôle serveur global : il peut lire les tables dont il
a besoin, et RLS n’est pas activé. Les contrôles applicatifs et les contraintes
composites ne constituent pas un confinement d’un serveur ou de ce login compromis
à une cave unique. C’est la portée explicitement retenue par le contrat EA-06 et
permise par produit04 ; les protections d’exploitation sont qualifiées en EA-35.

## Migration et processus

Appliquer [002_team_exports.sql](../../migrations/002_team_exports.sql) après 001,
avec le propriétaire de migration. Elle est additive et transactionnelle. Accorder
au rôle applicatif SELECT, INSERT et UPDATE sur `team_exports` et `team_export_jobs`,
en complément des droits minimaux EA-05. Aucun droit DDL ou superprivilège n’est
ajouté. La préparation locale et les tests appliquent les deux migrations ; les
anciennes fixtures et les anciens tests conservent leur contenu.

Le worker compilé utilise `ENCAVE_WORKER_CONFIG`, chemin serveur d’un JSON protégé
contenant seulement `database` (configuration `pg`). Il ne reçoit pas le client
secret OIDC ni la clé PKCE. `start:identity` crée ces configurations éphémères et
exécute API, web, fournisseur fictif et worker avec des ressources isolées. Aucune
de ces valeurs ne doit entrer dans Git, les logs ou les captures.

Le prélèvement utilise `FOR UPDATE SKIP LOCKED`, uniquement pour la file. Toute la
production de ce CSV local se déroule dans une transaction courte, sans appel
réseau/fournisseur. Claim, résultat et statut sont atomiques : si le processus
meurt avant commit, le verrou est libéré et la tâche redevient disponible. Le test
de reprise bloque une vraie tâche sur son verrou de cave, tue le processus puis
prouve sa terminaison par un nouveau worker. Les tâches externes à bail, idempotence
fournisseur et réconciliation seront développées dans les tickets correspondants.

La création emploie `Idempotency-Key` UUID, unique par cave et demandeur. Un retry
réutilise la même demande, même si la réponse initiale est perdue. Deux workers ne
génèrent pas deux résultats pour cette ligne. Après trois erreurs SQL transitoires
consécutives, le worker s’arrête avec code d’échec ; aucun succès n’est inventé.

Conservation du fichier : 3 600 secondes par défaut. L’API accepte une configuration
serveur optionnelle `exports.retentionSeconds`, entier entre 60 et 86 400 dans son
fichier protégé. La date calculée est persistée et affichée dans l’interface. Le
worker refuse un export déjà périmé et purge le contenu des exports expirés ; les
métadonnées minimales restent en base. Le téléchargement refuse l’expiration même
si le worker est arrêté. Limites : 5 000 membres et 1 Mio par fichier. La politique
complète de rétention/suppression et son exploitation demeurent à qualifier.

## Recette et limites

Gates kit, unit, functional, business, E2E et UX ; PostgreSQL réel, rôle effectif,
processus worker réel, navigateur et téléchargements réels. Les parcours vérifient
la révocation, la reprise, les références étrangères et les réponses tardives. Un
numéro de génération invalide les GET antérieurs à une nouvelle création ; changer
de cave démonte le panneau et annule ses requêtes/téléchargements en attente.

Captures, comptes rendus, empreintes et review : [EA-06](../work/EA-06/contract.md).
Ces preuves n’exécutent ni IA ni Microsoft et ne couvrent pas encore les demandes,
propositions ou ressources commerciales. La CI est observée séparément ; un
échec demeure un échec, même lorsqu’un diagnostic local ne le reproduit pas.

Sources : [verrous SELECT PostgreSQL 17](https://www.postgresql.org/docs/17/sql-select.html),
[contraintes composites](https://www.postgresql.org/docs/17/ddl-constraints.html).
