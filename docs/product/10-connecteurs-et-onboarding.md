# Connecteurs génériques et onboarding des caves

Version 1.1 · 7 septembre 2026 · Spécification à implémenter

Ce document formalise la demande de Sam : une application commune qui accueille plusieurs caves, chacune connectant ses propres outils depuis l’interface. Aucun accès Microsoft, tenant de test, consentement ou test fournisseur n’est fourni ou déclaré réussi par ce document.

## 1. Décision produit et responsabilités

Sam décide de la roadmap, des profils pris en charge et de la politique de livraison. Le développement utilise des fixtures synthétiques et des contrats reproductibles ; il n’attend pas un entretien, un pilote, les données ou les comptes de Julien. Les agents appliquent les décisions et délégations documentées par Sam.

L’administrateur d’une cave décide des comptes qu’elle connecte et de ses règles locales. L’opérateur habilité de cette cave valide les propositions et, après l’accord client sur la version exacte, autorise « Réserver et confirmer » en A1. Être propriétaire du logiciel ne donne pas à Sam une autorisation implicite d’accéder aux comptes clients ou de prendre leurs engagements commerciaux.

Un droit fournisseur absent limite la connexion concernée. Il ne bloque ni les autres caves ni les lots du noyau. Une fonctionnalité non vérifiée reste non activable et exclue du périmètre annoncé comme disponible ; Sam peut livrer un périmètre plus restreint déjà testé.

## 2. Expérience attendue du client

Le parcours standard est : créer sa cave, ouvrir « Connexions », choisir Microsoft 365, se connecter chez Microsoft, choisir sa boîte et son calendrier, vérifier le fonctionnement, puis activer. Le client ne copie pas de jeton et ne transmet pas son mot de passe à EnCave Assistant. Les écrans indiquent les effets autorisés et la possibilité de déconnecter.

| Étape | Écran et action | Résultat attendu |
|---|---|---|
| Créer la cave | Nom, fuseau, administrateur, catalogue minimal | Cave interne et rôles propres ; agenda interne disponible |
| Choisir le fournisseur | Microsoft 365, informations sur le profil compatible | Compréhension de ce qui sera lu ou écrit |
| Connecter | « Connecter mon compte Microsoft » | Redirection OAuth liée à la session et à cette cave |
| Consentir | Écran Microsoft ; administration si la politique l’exige | Permissions accordées, refusées ou en attente clairement distinguées |
| Choisir les ressources | Boîte et calendriers effectivement accessibles | Sélection persistante ; droits réellement vérifiés |
| Relier le métier | Associer un calendrier à une ou plusieurs ressources | Source de disponibilité et règles d’écriture explicites |
| Vérifier | Lecture, synchronisation et test d’écriture/envoi autorisé | Résultat par capacité, sans fausse réussite globale |
| Activer | Récapitulatif des actions autorisées, A1 actif | Écritures permises uniquement dans le périmètre vérifié |
| Reprendre | Reconnecter, modifier la sélection ou déconnecter | Historique conservé, effets nouveaux contrôlés |

La sélection initiale privilégie la boîte de l’utilisateur connecté et son calendrier principal. Si un profil impose une intervention de l’administrateur Microsoft, afficher la raison, le périmètre demandé et une procédure réutilisable. L’application conserve les autres parcours utilisables pendant cette attente.

Objectif produit : un nouveau client compatible est ajouté sans modifier le code, le schéma, une variable d’environnement propre à sa cave ou le déploiement, et sans lui demander de recréer une application Azure. Les tests d’acceptation vérifient cet objectif ; aucune durée d’installation universelle n’est promise.

## 3. Microsoft 365 : application commune et profils supportés

Sam configure une inscription d’application Microsoft Entra appartenant à EnCave Assistant, multitenant pour les comptes professionnels ou scolaires. En pratique, chaque environnement sensible possède sa propre inscription et ses propres secrets ; toutes les caves d’un même environnement utilisent l’inscription commune. Chaque organisation cliente accorde à cette application les droits nécessaires dans son propre tenant. L’audience multitenant Entra permet ce modèle inter-organisations ; les politiques du client continuent de s’appliquer. [Application Entra multitenant](https://learn.microsoft.com/en-us/entra/identity-platform/single-and-multi-tenant-apps).

| Profil | Décision de périmètre initial | Conditions d’activation |
|---|---|---|
| Compte professionnel Exchange Online, boîte propre et calendrier principal | Profil standard à livrer en premier | Consentement requis, lecture/envoi/calendrier vérifiés |
| Boîte partagée, boîte déléguée ou calendrier d’un autre utilisateur | Profil distinct, activable seulement après sa recette | Droits sur la ressource, stratégie de synchronisation et d’envoi validées |
| Compte personnel Outlook.com | Hors offre initiale | Extension explicite et jeu de tests propre avant annonce |
| Outlook utilisé avec un fournisseur IMAP ou un serveur Exchange sur site | Hors connecteur Graph initial | Adaptateur ou stratégie distincte à décider |
| Tenant d’un cloud national spécifique | Hors offre initiale du cloud commercial | Environnement et exigences spécifiques à qualifier |
| Aucune connexion Microsoft | Mode interne | Formulaire, saisie et calendrier interne ; canal sortant vérifié si activé |

« J’utilise Outlook » ne suffit pas pour choisir le profil : Outlook est une interface qui peut être reliée à différents comptes. La compatibilité annoncée correspond au service, au type de compte et aux opérations vérifiés. [Présentation de l’API calendrier](https://learn.microsoft.com/en-us/graph/outlook-calendar-concept-overview).

Pour la boîte propre, les permissions envisagées sont `Mail.Read`, `Mail.Send`, `Calendars.ReadWrite`, `offline_access`, avec les scopes d’identité utiles et `User.Read` si l’on utilise `/me` pour lire le profil. La liste finale est liée aux API réellement utilisées et testée au moindre privilège. Un filtre de dossier dans le produit ne réduit pas les autorisations OAuth sur la boîte. La politique du tenant peut imposer l’intervention d’un administrateur. [Permissions Graph](https://learn.microsoft.com/en-us/graph/permissions-reference).

Les scopes délégués `*.Shared` ne suffisent pas aux abonnements de notifications sur les dossiers partagés. Un profil partagé en arrière-plan peut nécessiter des permissions applicatives et une configuration Exchange par l’administrateur du client. En cas d’usage de RBAC pour les applications, vérifier les droits effectifs : des permissions Entra globales conservées en parallèle peuvent élargir la portée. La procédure est standardisée ; elle n’implique pas de variante de code par client. [Notifications Outlook](https://learn.microsoft.com/en-us/graph/outlook-change-notifications-overview), [RBAC pour les applications Exchange](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac).

L’envoi depuis une autre boîte possède ses propres conditions. En mode délégué, `Mail.Send.Shared` s’accompagne de `Send As` ou `Send on Behalf` sur la boîte ; en mode applicatif, vérifier le rôle d’envoi et la portée effective des boîtes. Une capacité de lecture n’est jamais une preuve de droit d’envoi. [Envoi depuis une autre boîte](https://learn.microsoft.com/en-us/graph/outlook-send-mail-from-other-user).

## 4. Rattachement OAuth sans confusion entre caves

Le flux de référence est Authorization Code avec PKCE et bibliothèque Microsoft maintenue. Le serveur traite le callback et conserve les jetons côté serveur. `state` est aléatoire, temporaire, à usage unique et correspond à une tentative enregistrée ; ce n’est pas un `tenant_id` libre envoyé dans l’URL. Les URI de retour sont enregistrées et comparées strictement. [Flux Authorization Code](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow).

Règles d’implémentation propres à EnCave Assistant :

1. Le serveur authentifie l’administrateur, résout sa cave active et vérifie son rôle avant de créer une tentative OAuth.
2. La tentative lie côté serveur l’acteur, la cave interne, le fournisseur, le retour autorisé, l’expiration, PKCE et le nonce OIDC lorsque utilisé.
3. Au retour, le serveur consomme cette tentative une seule fois, revérifie l’acteur et son autorisation actuelle, puis valide les éléments OIDC attendus avec une bibliothèque adaptée : signature, émetteur, audience, expiration et nonce le cas échéant. Il n’utilise pas une adresse e-mail comme preuve suffisante de rattachement.
4. Le jeton destiné à Microsoft Graph est utilisé pour Graph ; il ne devient pas un jeton de session EnCave Assistant. L’application ne décode pas arbitrairement ce jeton d’accès pour en déduire les droits métier. Les jetons destinés à une autre API ne sont pas une preuve d’identité pour notre propre API. [Usage et validation des jetons](https://learn.microsoft.com/en-us/entra/identity-platform/access-tokens).
5. Le serveur enregistre l’organisation Microsoft et l’identité fournisseur obtenues par les voies vérifiées, puis les ressources accessibles et choisies. La cave interne provient toujours de la tentative autorisée, jamais d’un champ `tid` ou d’un webhook utilisé seul.
6. Une reconnexion doit retrouver les identités attendues. Un changement de compte ou d’organisation déclenche une nouvelle vérification et un remappage explicite ; aucun jeton n’écrase silencieusement celui d’une autre connexion.

Une organisation Microsoft peut servir plusieurs entités internes et une cave peut avoir plusieurs connexions. Le modèle ne présume pas une égalité entre `tenant_id` interne et `provider_tenant_id`. Une même boîte ne doit pas être activée comme source de plusieurs caves par accident : refuser le doublon de routage par défaut, avec un éventuel partage futur soumis à une conception et des tests spécifiques.

## 5. Modèle de connexion et contrats

Ces champs sont des exigences de conception à affiner avant migration. Tous les identifiants client sont des données de configuration ; aucun compte de Julien ou de Gilliard n’est une valeur de production par défaut.

| Objet | Champs essentiels | Contraintes |
|---|---|---|
| `Connection` | `id`, `tenant_id`, `provider`, `profile`, `provider_tenant_id`, `provider_account_id`, `status`, `authorization_version`, dates | Cave interne imposée par le serveur ; fournisseur et profil connus |
| `OAuthAttempt` | identifiant/empreinte de `state`, acteur, cave, fournisseur, expiration, référence PKCE, statut de consommation | Temporaire, lié à la session ; aucun secret dans les logs |
| `CredentialReference` | connexion, référence au coffre, type, expiration, version de clé | Jetons chiffrés côté serveur ; jamais exposés au navigateur, au modèle ou aux jobs |
| `ConnectionScope` | connexion, permissions accordées, portée effective et date de vérification | Distinguer scopes déclarés et droits effectivement prouvés |
| `ConnectionCapability` | connexion, capacité, état, motif, preuve, date de contrôle | `available`, `unavailable` ou `unverified` ; aucune capacité implicite |
| `ResourceBinding` | cave, connexion, identifiant externe de boîte/calendrier, ressource interne, mode lecture/écriture | Références composites et appartenance vérifiées |
| `Subscription` / `SyncCursor` | connexion, ressource, identifiant fournisseur, état, expiration/curseur | Rattachement vérifié ; curseurs opaques ; reprise par connexion |
| `ConnectionHealth` | dernier succès, dernier échec, prochaine action, code de diagnostic sûr | Visible sans jetons ni contenu de message brut |

Contrat commun des adaptateurs, à typer dans `packages/contracts` et implémenter dans `packages/connectors` :

| Opération | Entrée autorisée | Sortie métier |
|---|---|---|
| `startConnection` / `completeConnection` | Contexte serveur et tentative OAuth | Progression de connexion et identité vérifiée |
| `getCapabilities` / `listResources` | Connexion autorisée | Capacités et ressources avec portée vérifiée |
| `readMessages` / `syncMessages` | Connexion, boîte configurée, curseur | Messages normalisés, provenance, prochain curseur |
| `getBusyIntervals` | Calendrier configuré et intervalle borné | Occupations, fraîcheur et limites de couverture |
| `createCalendarEvent` / `findCalendarEvent` | Action durable, référence stable, réservation relue | Référence externe et résultat certain ou incertain |
| `sendMessage` / `reconcileMessage` | Action autorisée, destinataires et contenu versionné | État d’envoi avec niveau de preuve |
| `renewSubscription` / `disconnect` | Connexion et version d’autorisation | Nouvel état, reprise ou arrêt des effets |

Le contexte transmis à l’adaptateur contient une connexion vérifiée et la corrélation ; la référence secrète se résout dans une couche serveur dédiée. Le domaine ne connaît ni Graph, ni les URL OAuth, ni le format des jetons. Un futur fournisseur implémente ces contrats et déclare ses limites, sans prétendre fournir toutes les capacités.

Les jobs externes portent `tenant_id`, `connection_id`, `authorization_version`, l’action et ses références métier. Avant exécution, le worker relit l’appartenance, l’état et les droits actuels. Les notifications utilisent un abonnement connu et ses contrôles d’authenticité ; le corps d’un webhook ne choisit jamais seul la cave.

## 6. Échecs, révocation et fonctionnement sans connexion

| Situation | Comportement produit attendu |
|---|---|
| Consentement refusé ou administrateur requis | État clair, explication et reprise ; mode interne disponible |
| Permission ou calendrier indisponible | Capacité non activable ; aucune disponibilité fabriquée |
| Jeton expiré ou interaction requise | Tentative bornée selon erreur, puis reconnexion ; jamais une boucle infinie |
| Révocation détectée ou déconnexion demandée | Invalider la connexion côté application, arrêter les nouvelles actions liées et les renouvellements ; conserver l’historique |
| Job en attente lors d’une révocation | Revérifier avant exécution ; bloquer ou mettre en reprise sans substituer un autre compte |
| Requête déjà reçue par Microsoft | Réconcilier le résultat ; la déconnexion ne garantit pas l’annulation d’un effet déjà accepté |
| Réponse perdue après création/envoi | État incertain, recherche par référence et reprise contrôlée ; aucune relance aveugle |
| Connexion A défaillante | Aucune suspension globale de la cave B ou de ses connexions |

La déconnexion locale bloque immédiatement les nouveaux effets après sa prise en compte par le système. Une révocation effectuée chez Microsoft est détectée par les erreurs et mécanismes de suivi disponibles ; ne pas promettre une détection instantanée universelle. Supprimer les références de jetons et abonnements selon la procédure prévue, en distinguant déconnexion locale et révocation des consentements côté fournisseur.

Sans Microsoft, une cave peut gérer formulaire, saisie manuelle, catalogue, propositions et calendrier interne selon les lots effectivement livrés. Un e-mail sortant nécessite un expéditeur vérifié ou un compte autorisé. Si aucun canal sortant n’est configuré, le produit prépare le texte et enregistre une communication manuelle clairement déclarée ; il n’affiche jamais « envoyé » après une simulation.

## 7. Critères d’acceptation et preuves à produire

Les critères ci-dessous précèdent l’implémentation. Ils ne sont pas des résultats de tests déjà exécutés.

| ID | Scénario | Preuve attendue |
|---|---|---|
| CON-01 | Créer les caves A et B avec profils différents | Catalogue, identité, règles et ressources indépendants ; aucune valeur client dans le code |
| CON-02 | Connecter deux organisations Microsoft de test indépendantes | Deux `provider_tenant_id` distincts, deux connexions internes, mêmes application et version déployée ; onboarding A puis B réussi |
| CON-03 | Ajouter le second client | Aucune modification de source, variable par client, migration ou déploiement ; configuration persistante depuis l’interface |
| CON-04 | Forgery OAuth : `state` absent, périmé, réutilisé, session différente, cave substituée | Refus et aucune connexion créée/rattachée ; aucune fuite de jeton |
| CON-05 | Accès croisé depuis API, worker et webhook | A ne peut ni lire ni écrire via les credentials, messages ou calendriers de B |
| CON-06 | Révoquer A pendant que B reste active | Nouveaux effets de A bloqués après détection, B fonctionne ; tentative de job retardé refusée ; reprise traçable |
| CON-07 | Reconnecter avec un compte ou une organisation différents | Aucune substitution silencieuse ; remappage explicite vérifié |
| CON-08 | Calendrier partagé non compatible ou consentement admin absent | Capacité indisponible expliquée ; noyau et autres connexions utilisables |
| CON-09 | Notifications dupliquées, hors ordre, timeout et redémarrage | Pas de doublon de demande/réservation ; états incertains et réconciliation visibles |
| CON-10 | Test d’envoi et d’écriture sur ressources autorisées | Résultat réel conservé avec références et limites ; `202` n’est pas une preuve de réception client |
| CON-11 | Recherche de configurations codées en dur | Aucun compte, domaine client, calendrier ou tenant métier imposé dans le code/config de production ; fixtures synthétiques identifiées séparément |
| CON-12 | Parcours sans connexion Microsoft | Demande persistante, qualification, proposition, accord exact et réservation interne selon les capacités livrées ; statut de communication honnête |

CON-02 et les opérations réelles de CON-06/CON-10 exigent des comptes autorisés dans deux organisations Microsoft indépendantes. Sam peut utiliser ses environnements de test ; aucun compte de Julien n’est requis. Sans accès, documenter `non vérifié` pour cette partie et continuer les tests unitaires, fonctionnels, métier, E2E sur adaptateur simulé et lots indépendants. Un test simulé ne clôture pas une exigence de preuve fournisseur réelle.

Le gate d’activation du connecteur exige les preuves réelles du profil vendu, l’isolation, la révocation et la reprise. Les garanties métier restent identiques avec tous les fournisseurs : accord sur l’ancienne version refusé, aucune double allocation interne de ressource exclusive, aucune donnée inter-caves, approbation A1 et absence de faux succès externe.

## 8. Découpage de développement

Les tickets de formalisation fixent la matrice de capacités, les contrats et les cas de test. Les fondations implémentent l’identité, les caves, la connexion et le mode interne. Les lots d’intégration réalisent l’adaptateur Microsoft, OAuth, synchronisation, outbox et reprises. Le lot d’onboarding fournit le parcours générique et sa recette sur deux organisations ; le lot de livraison active seulement les capacités prouvées.

La roadmap et les dépendances exécutables sont suivies dans [le backlog actif](../../backlog/tickets.json). Une indisponibilité d’accès est attachée à la preuve externe concernée avec prochaine action, sans réécrire les tests pour obtenir du vert ni inventer un consentement. La politique initiale définie par Sam permet à l’agent de poursuivre les tickets indépendants sans confirmation stakeholder.
