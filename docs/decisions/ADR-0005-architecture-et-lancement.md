# ADR-0005 — Architecture, disponibilité et lancement

Date : 2026-09-09. Statut : retenue pour le développement sous la délégation de Sam.
EA-03. Cette décision ne crée aucun service payant et n'autorise aucune donnée réelle.

## Contexte

Les fondations DEV-01 sont livrées ; elles compilent web/API/worker et interrogent
PostgreSQL, sans parcours métier. [EA-01](../discovery/EA-01-perimetre-et-mesure.md)
fixe les priorités et distingue faits, hypothèses et fixtures. Le [brief](../product/00-BRIEF-DEVELOPPEMENT.md)
et les ADR [0000](ADR-0000-amorcage.md), [0002](ADR-0002-autorite-et-connecteurs.md)
et [0004](ADR-0004-campagne-et-ux.md) autorisent les choix techniques réversibles et
la poursuite sans accord de prospect. Ils préservent les règles A1 et la preuve
fournisseur réelle avant activation.

## Décision

### Architecture indépendante

| Frontière | Choix retenu | Contrôle attendu |
|---|---|---|
| Dépôt et exécution | Dépôt Git EnCave Assistant existant ; npm workspaces privés, aucun import marketplace | Graphe de dépendances et CI propres ; pas d'API interne EnCave utilisée |
| Web / API / worker | Next.js/React, Node/TypeScript, modules métier, processus worker indépendant du navigateur | Versions verrouillées par DEV-01 ; compilation et démarrage réels, puis suites métier |
| Données | PostgreSQL 17 ; migrations SQL versionnées ; outbox et file avec baux en base | Transactions courtes, contraintes composites de cave, exclusion d'allocations, reprise après crash |
| Identité | OIDC Authorization Code avec PKCE, session serveur ; Keycloak 26.7.3 comme cible d'identité indépendante | Instance/base/realm/client séparés par environnement ; validation issuer/audience/signature/nonce, révocation de session et rôles produit |
| Secrets | Coffre et références serveur propres par environnement ; aucune valeur dans le dépôt | Moindre privilège, rotation, absence de jeton navigateur/IA/log/job ; identités de déploiement distinctes |
| Hébergement cible | Azure Container Apps pour web, API et worker ; Azure Database for PostgreSQL Flexible Server pour la base gérée | Artefacts immuables, worker actif sans requête HTTP, migrations, sondes et restauration avant activation |
| Connecteurs | Interfaces neutres messagerie/calendrier/identité de connexion ; premier adaptateur Microsoft 365 organisationnel | Onboarding commun par cave, capacités explicites, isolation et qualification du profil |
| IA | Adaptateur serveur séparé, sans décision de prix/droits/allocation | Fournisseur/modèle/snapshot/région à fixer dans le ticket IA avant tout appel ; aucune IA activée actuellement |

Les versions déjà retenues sont dans [ADR-0003](ADR-0003-fondation-technique.md)
et les lockfiles. Pour Keycloak, la page officielle indique 26.7.3 lors de la
consultation du 2026-09-09. Son adaptateur Node historique est déprécié : utiliser
une bibliothèque OIDC maintenue, choisie et verrouillée dans EA-05, plutôt que
d'introduire cet adaptateur. [Distribution Keycloak](https://www.keycloak.org/downloads),
[endpoints et flux OIDC](https://www.keycloak.org/securing-apps/oidc-layers).

La cible Azure exécute des conteneurs, API et traitements en arrière-plan ; le
worker de notre file devra conserver une instance active ou un déclenchement
durable explicitement testé. Ne pas supposer que le trafic web le réveille.
[Container Apps](https://learn.microsoft.com/en-us/azure/container-apps/overview).

Ces choix d'architecture n'ajoutent ni Azure ni Keycloak à la fondation déjà livrée.
L'inscription OIDC des collaborateurs est indépendante du consentement Microsoft
Graph des caves ; se connecter à EnCave Assistant n'autorise pas la lecture d'Outlook.
Un fournisseur OIDC local de test avec comptes synthétiques permet de vérifier le
protocole et les refus sans créer un compte de prospect. Cette recette sera
identifiée séparément de la qualification de l'instance d'identité de production.

### Environnements, régions et traitement

Décision de conception : `development` local sur le poste dédié ; `preproduction`
et `production` dans **West Europe**, avec environnements Container Apps, bases,
stockage de sauvegarde, identités OIDC, clés et droits séparés. West Europe est une
région Azure aux Pays-Bas. [Liste des régions](https://learn.microsoft.com/en-us/azure/reliability/regions-list).
La disponibilité des services, les quotas du compte et le coût doivent être vérifiés
lors du provisionnement ; aucune souscription ou capacité réservée n'est présumée.

Les sauvegardes de base restent dans la région cible, avec redondance locale ou de
zone configurée ; pas de géoréplication vers une autre région par défaut. Rétention
technique cible initiale : 7 jours et restauration ponctuelle. Azure PostgreSQL
propose une rétention de 7 à 35 jours et des options de redondance distinctes ; les
sauvegardes gérées ne remplacent pas un export PostgreSQL portable ni un exercice de
restauration. [Sauvegarde et restauration](https://learn.microsoft.com/en-us/azure/postgresql/backup-restore/concepts-backup-restore).

Cette région cible est une décision de développement réversible, pas une promesse
que tous les traitements et accès de support restent aux Pays-Bas. Pays du support,
sous-traitants, conditions Microsoft/IA, transferts, rétention des messages,
engagements, exports et traces : **non établis pour des données réelles**. Les
exigences de [protection et exploitation](../product/05-securite-qualite-exploitation.md)
doivent être satisfaites avant ces données. Aucun label de conformité juridique
n'est déduit de la région. Une région imposée ensuite par Sam/cave nécessite une
nouvelle décision et une recette, pas une copie silencieuse de données.

Développement et CI utilisent exclusivement des fixtures fictives. La base technique
locale actuelle et son rôle d'amorçage ne sont pas le rôle applicatif de production :
EA-05/EA-06 créent les contrôles minimaux et EA-35 vérifie le rôle effectif. Aucun
secret EnCave/marketplace, compte client ou copie de production n'est réutilisé.

### Disponibilité et concurrence

Chaque ressource déclare côté serveur un mode de disponibilité versionné :

| Mode | Source de vérité et écriture | Condition d'engagement |
|---|---|---|
| `internal` | Allocations PostgreSQL ; toutes les réservations actives passent par le produit | Transaction atomique de toutes les ressources, version/accord/A1/prix/capacités/durées/marges vérifiés |
| `internal_with_external_constraints` | Allocations internes ET occupations du calendrier lié ; événements Outlook sont des contraintes externes | Lecture suffisamment fraîche et complète, puis confirmation assistée si des écritures manuelles concurrentes sont possibles |
| `external_unverified` | Source ou droits inconnus, curseur/fraîcheur insuffisants, calendrier non qualifié | Disponibilité inconnue ; aucune réservation engagée sur cette base |

Les occupations importées ne deviennent pas arbitrairement des réservations du
produit. Les liens calendrier-ressource sont configurés par la cave et contrôlés
côté serveur. Le changement de source requiert une réconciliation, pas la
suppression d'allocations existantes. Une proposition initiale ne bloque pas le
créneau ; aucun mécanisme d'option implicite.

Les allocations exclusives utilisent des intervalles comprenant préparation et
rangement, des contraintes en base incluant cave et ressource, et une transaction
unique pour toutes les ressources. Les tests doivent exercer cent confirmations
simultanées et le rôle SQL réellement utilisé, pas seulement des mocks.

PostgreSQL ne verrouille pas une saisie manuelle indépendante dans Outlook. Une
relecture récente diminue une incertitude mais n'établit pas une exclusion atomique
entre les deux systèmes. Le mode connecté conserve détection de conflit, arrêt de
confirmation, reprise humaine et réconciliation. Une confirmation autonome ne
sera pas vendue avec un circuit de réservation externe non maîtrisé et non testé.

### Accord et supervision A1

Le mode principal d'accord est un lien sécurisé limité à une version immuable,
expirant et révocable. GET affiche les termes sans accepter ; un POST explicite
enregistre la preuve liée à la version. Un accord par e-mail contrôlé est une voie
complémentaire : rattachement au fil/version, identité et ambiguïtés vérifiés ; une
réponse « oui, mais vingt personnes » crée une nouvelle proposition à valider et
accepter. Aucun texte produit par le modèle ne vaut accord client.

Après l'accord exact, un opérateur habilité de la cave autorise **« Réserver et
confirmer »**. Le serveur relit état, termes, prix déterministe, disponibilité et
conditions ; transaction métier et intention d'outbox sont atomiques. Les appels
externes restent hors transaction. En cas de réponse perdue, afficher l'incertitude
et réconcilier avant une nouvelle tentative. Acceptation fournisseur, confirmation
métier et livraison au destinataire sont des états distincts.

Pour le mode manuel, l'opérateur consigne la communication et sa preuve explicitement ;
ce n'est pas un envoi électronique effectué par l'application. Une adresse inconnue,
un transfert ou plusieurs offres ouvertes impose une reprise humaine. Les critères
de la [version et de l'accord](../product/02-cas-usage-et-regles.md) restent inchangés.

### Périmètre de lancement

Sam conserve la décision de commercialiser sur les preuves. **À cette date, aucun
parcours produit n'est vendu ou déclaré disponible par cette ADR.** La cible de
première offre ci-dessous guide le développement ; chaque inclusion est conditionnée
par les tests du lot, la recette, l'exploitation et la décision de lancement.

| Fonction / profil | Décision pour la première offre | État actuel / condition |
|---|---|---|
| Dégustation supervisée A1, offre immuable et accord exact | Incluse dans la cible | À implémenter et vérifier ; pas de réservation autonome |
| Profil sans Microsoft | Inclus dans la cible : saisie/formulaire, agenda interne, propositions et accord, réservation interne, communication manuelle clairement déclarée | Non disponible aujourd'hui ; lot dédié et recette complète requis, y compris absence de faux envoi |
| Microsoft 365 boîte propre/calendrier principal | Extension incluse seulement après qualification réelle | Inactif ; onboarding et preuves sur deux organisations indépendantes, isolation/révocation/reprise nécessaires |
| Microsoft partagé/délégué/secondaire | Exclu tant que profil dédié non qualifié | Aucun droit Shared ou applicatif présumé |
| Location minimale | Qualification et reprise humaine incluses dans la cible | Aucune confirmation automatique ni acompte supposé reçu |
| Devis structuré/versionné et réservation de location | **Exclus de la première offre** ; restent des travaux requis du backlog | Leur livraison/activation ultérieure exige le lot devis, ses conditions et sa recette ; aucune vente anticipée |
| Visites/FAQ et événements externes | Réponses sourcées sur informations approuvées, selon lots livrés | Pas de place inventée ni de billetterie transactionnelle |
| IA | Activation seulement des actions évaluées | Corpus d'au moins 100 cas et critères critiques applicables ; les 12 seeds ne sont pas une évaluation |
| Paiements, réseaux sociaux, annulations coûteuses automatisées, autonomie avancée | Exclus de l'offre initiale | Extensions explicites ; aucune promesse implicite |

Le parcours connecté e-mail vers réservation reste la priorité produit du brief.
L'absence d'accès Microsoft laisse progresser le noyau et peut permettre le lancement
du profil interne **déjà vérifié**, sans annoncer les autres capacités. Les exclusions
commerciales ci-dessus ne retirent aucun ticket de la mission complète ni aucun test.

### Livraison et autorité

Appliquer INIT-01 puis DEV-01, puis les dépendances du backlog. Continuer après chaque
ticket vérifié ; consigner blocages et poursuivre les indépendants. Sam décide,
Julien et les prospects sont consultatifs. Les choix réversibles de cette ADR sont
délégués ; aucun accord intermédiaire de prospect ou de Sam n'est requis pour coder.

En tâche directe Windows : contrat exact, réalisation, gates applicables, review
indépendante, corrections bornées, commit local vérifié puis push sans force et
vérification du SHA distant selon ADR-0004. Ne pas lancer de campagne native Windows.
Les comptes rendus directs ne deviennent pas des attestations du contrôleur.

La CI distante est une preuve séparée : à la date de rédaction, DEV-01 a un kit
GitHub réussi et une qualité produit en échec (base CI absente et suites produit non
encore implémentées). EA-04 configure l'environnement sans neutraliser les gates.
Production exige la recette technique du périmètre, restauration, supervision,
support, sécurité et aucun incident critique non résolu. Une commande Git réussie
n'est ni une CI verte ni un déploiement. Aucune dépense, accès tiers ou activation
commerciale n'est déduite de l'autorisation de développement.

## Alternatives

- Réutiliser infrastructure/authentification de la marketplace : rejeté par l'indépendance produit.
- Serveur et base autogérés : PostgreSQL géré retenu pour limiter l'exploitation ; le poste local reste reproductible.
- Fournisseur OIDC SaaS propriétaire : possible ultérieurement ; Keycloak conserve une identité propre et le protocole OIDC facilite un changement, au prix d'une exploitation à préparer.
- Coupler le noyau au SDK Graph ou attendre un compte prospect : contraire aux contrats génériques et à l'autorité de Sam.
- Considérer Outlook comme verrou global ou une lecture vide comme disponibilité : contraire aux invariants de concurrence et d'inconnu.

## Conséquences et vérification

EA-04 prépare les environnements et la CI ; EA-05/EA-06 l'identité/cave et les rôles ;
les lots suivants complètent données, connecteurs, agent, versions, réservation et
exploitation selon leurs dépendances. Les fournisseurs restent inactifs jusqu'à
qualification ; aucun compte autorisé ou coût accepté n'est inventé.

| Élément non établi | Travail indépendant possible | Action réelle conditionnée / preuve attendue |
|---|---|---|
| Compte Azure, quotas, budget, domaine | Configuration, tests locaux/CI, artefacts | Provisionnement payant et domaine : accès/budget existants vérifiés ou autorisés, inventaire et sondes |
| Identité de production | Protocole OIDC et contrôles sur issuer de test | Instance Keycloak, sauvegarde, admin et MFA, révocation et disponibilité vérifiés |
| Microsoft de test | Simulations et noyau | Tenant(s) autorisés, scopes et opérations prouvés ; aucun accès de Julien requis |
| Modèle et région IA | Contrats et corpus synthétique | Choix versionné, conditions et clé serveur autorisée, évaluation réelle avant activation |
| Catalogue, prix, taxes, conditions et ressources d'une cave réelle | Fixtures explicitement fictives et champs configurables | Validation de cette cave avant publication de son catalogue ; inconnu bloque engagement |
| Données/support/rétention/transferts | Minimisation et mécanismes d'export/suppression | Examen documenté du traitement effectif avant données réelles, sans conclusion juridique fabriquée |
| Valeur et volume réels | Méthode EA-01 et instrumentation | Mesures facultatives observées ; aucune promesse 80 %/30 % déduite du code |

Vérification EA-03 : concordance des six critères au backlog, liens locaux valides,
kit applicable et review indépendante des décisions. Cette vérification documentaire
ne prouve ni les contrôles métier futurs ni la disponibilité opérationnelle des services.
