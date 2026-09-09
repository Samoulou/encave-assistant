# Microsoft 365 — protocole de qualification

EA-02 · 2026-09-09. Ce document prescrit des tests futurs, il ne constitue pas
leur exécution. [Contrat](microsoft-contract.md), [critères CON-01 à CON-12](../product/10-connecteurs-et-onboarding.md).
Le [registre initial](microsoft-qualification.json) déclare tous les essais réels
`not_executed`, toutes les capacités `unverified`, et `activation_allowed: false`.

## Deux niveaux de preuve

Les futurs tests de contrat exécutent un adaptateur simulé avec réponses fixtures
fictives, horloge contrôlée et pannes injectées. Ils prouvent le comportement du
logiciel et les refus, jamais les permissions d'un compte Microsoft. Les suites
unitaires, fonctionnelles, métier, E2E et UX de leurs tickets restent obligatoires.
Une ligne de cette matrice ou un fichier `.feature` ne vaut pas test exécuté.

La qualification fournisseur appelle Microsoft sur des comptes de test explicitement
autorisés gérés par Sam, sans données de prospect. Aucun accès de ce type n'est
configuré dans cette session : aucun échange OAuth, appel Graph, test d'envoi,
événement ou révocation réel n'a eu lieu. Cela limite l'activation Microsoft, pas
EA-02, les fondations, le mode interne ou les tests sur simulations.

## Cas de contrat à implémenter

| Cas | Nominal attendu | Refus / panne attendus | Couverture produit |
|---|---|---|---|
| MS-01 Lecture | Pagination complète, provenance et curseur par dossier, message persisté une fois | Doublon, désordre, suppression, curseur périmé et reprise ; A ne lit pas B | CON-01, CON-05, CON-09 |
| MS-02 Notifications | Validation URL, abonnement/clientState connus, persistance avant acquittement et relecture | Secret erroné, abonnement inconnu, cave substituée, doublon, base indisponible ; Shared délégué refusé | CON-05, CON-08, CON-09 |
| MS-03 Calendrier | Occupations sur fenêtre/fuseau, action A1, création avec référence stable puis lecture de confirmation | Droits absents, calendrier hors cave, prix/disponibilité inconnus, accord ancien ; timeout après POST devient incertain | CON-05, CON-09, CON-10 |
| MS-04 Envoi | Contenu et destinataires de la version validée ; 202 enregistré comme accepté fournisseur | Envoi partagé sans SendAs/OnBehalf, ressource hors périmètre ; réponse perdue sans renvoi aveugle ni fausse livraison | CON-05, CON-08, CON-10 |
| MS-05 Renouvellement | Échéance réelle utilisée et abonnement renouvelé avant expiration | 429, 5xx, expiration, interruption, interaction requise ; budget borné et rattrapage | CON-06, CON-09 |
| MS-06 Déconnexion/révocation | Version invalidée, arrêt de A après détection et fonctionnement de B | Job retardé refuse ancien droit ; requête déjà reçue reste à réconcilier, sans promesse d'annulation | CON-06 |
| MS-07 OAuth | A puis B connectées avec même application/version ; ressources choisies en interface | State absent/périmé/rejoué, autre session/cave, nonce/issuer/audience/signature invalides, rôle révoqué, changement de compte sans remappage | CON-02, CON-03, CON-04, CON-07 |
| MS-08 Portée effective | Capacités vérifiées ressource par ressource | Consentement refusé/admin requis ; Shared webhook délégué interdit ; grant applicatif global malgré RBAC restreint rejeté par recette | CON-05, CON-08 |
| MS-09 Indépendance | Connexions persistantes de caves synthétiques sans constante client | Identifiant cave/boîte/tenant codé en dur, configuration ou déploiement par client interdits | CON-01, CON-03, CON-11 |
| MS-10 Sans Microsoft | Parcours interne persistant selon lots livrés et texte manuel déclaré | Aucun statut envoyé après simulation ; aucune capacité Microsoft activée sans preuves | CON-12 |

## Préparation de la qualification réelle

1. Enregistrer l'autorisation de Sam sur **deux organisations Microsoft indépendantes**
   de test A/B, avec leurs administrateurs habilités. Créer des caves et ressources
   fictives, comptes et destinataires dédiés. Ne pas utiliser les comptes de Julien.
2. Environnement test isolé : inscription multitenant propre, redirect URI et webhook
   HTTPS, coffre serveur et journaux expurgés, version déployée identifiée. Obtenir
   le consentement requis ; aucune procédure ne le contourne. La création d'une
   inscription ou d'un compte payant dépend de l'accès et du budget autorisés.
3. Choisir le profil exact. Capturer la liste des opérations/scopes, la portée
   effective autorisée et les refus attendus, sans copier credentials, contenu
   client ou liens de retour OAuth. Séparer les preuves de boîte propre et partagée.
4. Autoriser explicitement les événements/messages de test et leur destination
   avant exécution. Documenter le nettoyage des seuls objets créés par la recette.
   Aucune action commerciale ou invitation à un prospect n'est nécessaire.

## Recette réelle et preuves minimales

| Cas produit | Exécution réelle attendue | Preuve conservée sans secret |
|---|---|---|
| CON-01 | Préparer A et B et vérifier les données isolées | Version, identifiants pseudonymes des fixtures et assertions de séparation |
| CON-02 | OAuth des organisations A/B distinctes sur la même inscription d'environnement | Références de deux identités organisationnelles vérifiées, étapes réussies, version unique |
| CON-03 | Ajouter B depuis l'interface sans changement de code/config environnement/migration/déploiement | Version/config structurelle avant/après, trace de configuration persistante |
| CON-04 | Exécuter les variantes de falsification de MS-07 | Refus, absence de connexion et absence de jetons dans les traces |
| CON-05 | Tenter l'accès croisé via API, job et notification ; viser une boîte hors portée | Réponses refusées, absence d'effet et contrôle de portée fournisseur |
| CON-06 | Révoquer A, mesurer la détection ; exécuter un job retardé ; utiliser B | Heures, événement détecté, refus de A, fonctionnement réel de B, incertitudes restantes |
| CON-07 | Reconnecter avec une autre identité de test | Refus de substitution automatique, remappage explicite et nouvelles vérifications |
| CON-08 | Tester consentement absent et profil partagé limité | Capacité indisponible avec motif, mode interne utilisable ; droits réels du profil partagé si proposé |
| CON-09 | Dupliquer/désordonner notifications, interrompre et reprendre le worker, perdre une réponse | Actions stables, états incertains, réconciliation, compte final sans doublon |
| CON-10 | Lire puis créer et retrouver un événement ; envoyer uniquement au destinataire de test autorisé | Références fournisseur protégées, horodatages, statuts HTTP, observation de l'objet ; 202 distingué de livraison |
| CON-11 | Inspecter sources et configuration livrées | Révision et recherche ciblée sans lecture de secrets ; aucune constante client imposée |
| CON-12 | Déconnecter et effectuer le parcours interne complet sur fonctions livrées | Demande/offre/version/accord/A1/réservation, communication honnête |

Les cas purement applicatifs se réexécutent sur l'environnement de qualification ;
les variantes de panne injectées restent étiquetées `simulation` même si elles
entourent un appel réel. Une observation externe n'est pas remplacée par une fixture.
Les preuves identifiantes restent dans un stockage restreint ; le dépôt contient
leurs références opaques, empreintes, résultats synthétiques et limites uniquement.

## Décision d'activation et reprise

Le dossier doit identifier commit, environnement, profil, date, opérateur autorisé,
méthode, cas exécutés, résultat, référence de preuve et limites. Le reviewer vérifie
les preuves et les tests d'isolation, révocation, reprise et opérations réellement
annoncées. Une matrice remplie à la main sans preuve ne suffit pas.

L'activation exige les preuves réelles applicables, notamment CON-02, CON-06 et
CON-10, et une vérification actuelle des ressources/scopes de la connexion. Un échec,
un cas requis non exécuté, une permission inconnue ou un changement de profil remet
les capacités concernées à un état non activable. Une qualification d'un profil
ne qualifie pas toutes les caves ni toutes les boîtes. Le profil partagé peut rester
exclu sans retarder la livraison d'un autre profil effectivement vérifié.

Sam peut livrer les lots internes vérifiés et garde la décision produit. Aucun accord
de prospect n'est nécessaire. La validation de développement ne confère pas les
droits Microsoft d'un client ; le caviste conserve l'autorisation A1 de ses engagements.
