# EA-07 — Contrat avant réalisation

Ouverture : 2026-09-09 10:37:00 UTC (12:37 Europe/Zurich), exécution 1.
Échéance 12:37:00 UTC ; trois corrections maximum, huit appels d’agents,
1 200 secondes par appel et 7 200 secondes pour cette exécution.
Base : `1d4f3da84c28af1a2ba8adee6865c0649261e2b4`, EA-06 vérifié, review
indépendante pass, commit intégré et SHA distant confirmé. CI distincte.

Lectures : AGENTS, START-HERE, tâche directe08, brief, backlog EA-07 et dépendances,
produit04 §20–23, produit02 §11/13, contrats09, tests04/DoR-DoD05, références
UX11/design déjà lues. Aucune interface modifiée dans ce ticket de schéma.

## AC-01

Demandes, messages, versions, accords et actions définis.

Acceptation : migration additive 003 avec demandes/messages, propositions et
versions, validations, accords et actions persistants. Identifiants stables,
cave, acteurs, horodatages et versions explicites. Réservation minimale reliée à
l’accord exact pour préparer ses états distincts ; allocations restent EA-24.
Les statuts sont propres à chaque objet ; les transitions serveur sont EA-08.
Une version conserve son instantané et son empreinte. Validations et accords
référencent cette version, ces termes et le dossier exact ; plusieurs preuves
peuvent exister pour une version. Une version approuvée ne peut être réécrite.
Les actions conservent leur référence stable, état et résultat ; ni leur existence
ni leur réussite ne signifient livraison client. Aucun appel externe ni commande
d’engagement n’est exposé par ce ticket. Les contrats complets de catalogue,
proposition envoyée et baux seront étendus par EA-09/19/23.

Tests : contrats de données unitaires ; application réelle sur base vide et mise
à niveau depuis 001/002 avec conservation d’identité ; refus état/forme invalide ;
lecture d’un dossier et historique persistants après recréation des connexions
et redémarrage de l’API de test. Replay des migrations sans doublon ni perte.

## AC-02

Clés composées empêchant références inter-caves.

Acceptation : chaque relation tenant métier utilise des clés composites. Les
relations version/accord/réservation portent aussi le dossier et la proposition
pertinents pour interdire un mélange au sein d’une cave. Les preuves par message
doivent provenir du dossier concerné. Références locales et noms identiques dans
deux caves autorisés ; un identifiant externe ne devient pas une autorité cave.
Les accès de lecture API résolvent cave et rôle avec le contexte serveur EA-06.

Tests PostgreSQL avec login applicatif réel : tentatives de références étrangères
pour messages, propositions, versions, validations, accords, réservations et
actions ; refus sans insertion partielle. Test navigateur authentifié des lectures
du dossier A puis B et refus 404 de l’identifiant de l’autre cave, rechargement
et absence de mutation sous lecteur. Aucun test propriétaire ne remplace ces refus.

## AC-03

Fixtures fictives séparées des données réelles.

Acceptation : aucune ligne de démonstration dans les migrations. Fixtures
explicitement synthétiques sous l’outillage de test, exécutées uniquement dans les
bases isolées générées par la garde de développement existante. Aucune option
runtime web/API/worker ne charge ces fixtures. Deux caves, dossiers homologues et
historiques cohérents ; termes, prix et accords fictifs ne sont pas des faits client.
Le démarrage réel avec migration seule laisse les tables métier vides.

Tests : base migrée sans fixtures vide ; fixture refuse un contexte autre que le
contexte de base de test possédé ; fixtures rejouables dans cette base et lecteurs
isolés. Requêtes paramétrées, aucun secret copié dans fichiers versionnés ou logs.

## Décisions et gates

Ajouter migrations et modèle minimal sans modifier 001/002 ni anciens tests.
SQL propriétaire pour migration ; rôle applicatif limité pour les tests et runtime.
Les migrations sont ordonnées, sérialisées et rejouables ; rollback d’une migration
échouée vérifié. Les réparations destructrices automatiques ne sont pas prévues.
Un endpoint de lecture authentifiée du dossier rend la persistance observable
avec l’application ; la création manuelle utilisateur reste EA-11. Pas d’interface
de proposition ni de fausse action commerciale. Une acceptation de fixture est
une preuve simulée, jamais un accord reçu d’un prospect.

Gates : kit, unit, functional, business, E2E ; compilation/foundation et tests
d’outillage affectés. UX n’est pas applicable à une interface inchangée ; les E2E
existants restent exécutés. IA et fournisseur non applicables, non déclarés pass.
Review indépendante, empreintes, résultats et commit/push normaux, puis EA-08/09.
