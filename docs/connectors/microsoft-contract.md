# Microsoft 365 — contrat de développement

EA-02 · 2026-09-09 · Décision de conception, aucune connexion activée.
Référence normative : [produit 10](../product/10-connecteurs-et-onboarding.md).
Sam pilote le développement. Chaque cave autorise ses connexions et engagements.

## Configurations et capacités cibles

| Profil | Lecture / synchronisation | Calendrier | Envoi | Décision produit |
|---|---|---|---|---|
| Organisation Exchange Online, boîte propre | Dossiers sélectionnés, delta par dossier, notifications de la boîte connectée | Calendrier principal sélectionné ; occupations bornées et création contrôlée | Depuis cette boîte après vérification | Premier profil à implémenter et qualifier |
| Boîte partagée ou déléguée, calendrier d'un tiers | Droits spécifiques ; notifications applicatives seulement si profil qualifié | Droits et opérations vérifiés séparément | Droit d'envoi indépendant du droit de lecture | Profil distinct, inactif avant recette propre |
| Calendrier secondaire de la boîte propre | Sans effet sur la capacité mail | Lecture `calendarView` et écriture à qualifier ; ne pas supposer toutes les stratégies delta compatibles | Sans effet sur la capacité mail | Extension explicite après recette |
| Calendrier de groupe Microsoft 365 | Non retenu | Non retenu | Non retenu | Hors offre initiale |
| Outlook.com personnel, IMAP, Exchange sur site, cloud national | Non retenu | Non retenu | Non retenu | Hors offre initiale ; ceci est une limite du produit, pas une impossibilité universelle Microsoft |
| Sans Microsoft | Saisie/formulaire internes selon lots livrés | Agenda interne | Communication manuelle déclarée ou autre canal réellement vérifié | Profil interne indépendant |

L'application Outlook ne démontre ni Exchange Online, ni les droits, ni la
compatibilité de chaque opération. Microsoft distingue notamment les calendriers
utilisateur et de groupe. [API calendrier](https://learn.microsoft.com/en-us/graph/outlook-calendar-concept-overview).

La cible utilise Microsoft Graph `v1.0`, cloud commercial et comptes professionnels
ou scolaires. Une inscription Entra multitenant commune **par environnement** sert
toutes les caves de cet environnement ; les politiques des organisations restent
applicables. Les clouds nationaux demanderaient une conception dédiée.
[Audience multitenant](https://learn.microsoft.com/en-us/entra/identity-platform/single-and-multi-tenant-apps).

Toutes les capacités initiales sont `unverified`. Une permission déclarée ne vaut
pas capacité `available`. L'activation exige une preuve réelle du profil ET des
droits actuels sur chaque ressource sélectionnée. `unavailable` indique un refus
établi, avec motif sûr ; `unverified` indique une information manquante.

## Permissions et portée

| Usage | Mode envisagé | Conditions et refus |
|---|---|---|
| Boîte propre | Délégué : `Mail.Read`, `Mail.Send`, `Calendars.ReadWrite` selon les fonctions activées | Scopes d'identité `openid`, `profile`, `offline_access` ; `User.Read` seulement si lecture de profil `/me`. Un filtre de dossier ne réduit pas la portée OAuth |
| Notifications propres | Délégué avec lecture autorisée | Abonnements limités à la boîte de l'utilisateur connecté |
| Lecture/envoi partagés | Délégué, permissions `*.Shared` pertinentes | Ne donne pas de droit aux webhooks partagés ; droits Exchange de la ressource à vérifier |
| Notifications partagées | Profil applicatif avec permissions de lecture correspondantes | Consentement/configuration administrateur, boîtes effectivement autorisées, recette distincte avant activation |
| Envoi depuis une autre boîte | Délégué `Mail.Send.Shared` | `Send As` ou `Send on Behalf` ; selon le chemin `/users/{from}/sendMail`, `Full Access` également nécessaire. Ne pas déduire l'envoi de la lecture |

La liste des permissions est minimale pour les opérations effectivement choisies,
à confirmer lors de l'implémentation ; le consentement administrateur peut être
imposé même en mode délégué par la politique du tenant. Les permissions applicatives
requièrent un consentement administrateur dans Entra.
[Référence des permissions](https://learn.microsoft.com/en-us/graph/permissions-reference).

Les scopes délégués `Mail.Read.Shared` et `Calendars.Read.Shared` ne prennent pas en
charge les abonnements sur les dossiers partagés/délégués ; les notifications de
ces dossiers exigent les permissions applicatives correspondantes.
[Notifications Outlook](https://learn.microsoft.com/en-us/graph/outlook-change-notifications-overview).

Pour l'envoi partagé, Graph n'offre pas une découverte complète des boîtes depuis
lesquelles l'utilisateur peut envoyer. La sélection guidée doit donc accepter une
ressource proposée puis **vérifiée**, sans promettre une énumération universelle.
[Envoi depuis une autre boîte](https://learn.microsoft.com/en-us/graph/outlook-send-mail-from-other-user).

Un filtre local ne borne pas un droit applicatif global. Exchange RBAC et les
autorisations Entra se cumulent : conserver un grant Entra global peut élargir la
portée malgré un rôle Exchange restreint. La recette doit vérifier les droits
effectifs et des refus sur une boîte hors périmètre, avec l'administrateur autorisé.
[RBAC applicatif Exchange](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac).

## Onboarding et rattachement

1. L'administrateur ouvre **Connexions**, voit les capacités proposées et lance
   « Connecter mon compte Microsoft ». Le serveur résout sa cave depuis sa session
   vérifiée et contrôle son rôle ; une cave envoyée par le navigateur n'est pas une autorité.
2. Le serveur crée une tentative expirante liée à acteur, session, cave,
   fournisseur, retour autorisé, `state` aléatoire à usage unique, PKCE et nonce
   OIDC. Il conserve les éléments sensibles côté serveur et n'en journalise aucun.
3. Authorization Code avec PKCE S256 et bibliothèque Microsoft maintenue ; URI de
   retour strictement enregistrée. [Flux OAuth](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow).
4. Au callback : vérifier expiration, session, acteur, droits actuels et usage
   unique ; valider signature, issuer, audience, dates et nonce OIDC avec la
   bibliothèque. Un code échangé ne contourne pas une révocation de rôle survenue
   pendant le parcours. Refuser toute tentative incohérente sans rattachement partiel.
5. Enregistrer les identités fournisseur vérifiées dans la connexion de la
   tentative. L'identifiant de cave interne n'est pas le `tid` Microsoft. Un jeton
   Graph ne devient pas une session EnCave. [Usage des jetons](https://learn.microsoft.com/en-us/entra/identity-platform/access-tokens).
6. Proposer boîte propre et calendrier principal, vérifier les droits de chaque
   ressource puis ses correspondances avec les ressources métier. Refuser le
   routage accidentel d'une même boîte vers plusieurs caves. Une reconnexion avec
   autre organisation/compte exige un remappage explicite et une nouvelle vérification.
7. Présenter les tests de lecture et les effets d'écriture/envoi. La cave choisit
   des ressources et destinataires de test autorisés avant ces effets. Afficher
   chaque résultat, l'heure et ses limites, puis autoriser l'activation du seul
   périmètre vérifié. L'approbation métier A1 demeure nécessaire.
8. Déconnexion accessible, effets expliqués, historique conservé. Consentement
   refusé ou admin requis : état reprenable, mode interne disponible, aucun succès inventé.

Le second client utilise les mêmes source, schéma, application Entra et déploiement.
Les identifiants d'organisation, boîte et calendrier sont des données persistantes
créées par l'onboarding, jamais une variable d'environnement par cave. Aucun compte
de Julien n'est une configuration implicite. L'interface suivra [UX/UI](../product/11-ux-ui-et-design.md)
et [design](../design/README.md) dans le ticket d'implémentation.

## Contrats de l'adaptateur

Ce document spécifie des interfaces futures ; il ne prétend pas les implémenter.
Le domaine ignore Graph et les jetons. Un `AuthorizedConnectionContext` est construit
uniquement côté serveur : cave, connexion, acteur ou job autorisé, version
d'autorisation, ressource liée, corrélation. Les credentials sont résolus dans la
couche serveur ; ni le navigateur, ni le modèle, ni le payload de job ne reçoit le jeton.

| Opération | Entrée / contrôle | Résultat observable |
|---|---|---|
| `startConnection` / `completeConnection` | Session et tentative serveur ; consommation atomique | Étape ou identité vérifiée, refus sans rattachement |
| `getCapabilities` / `listResources` | Connexion courante autorisée | État, portée, preuve et date par capacité ; sélection de ressources vérifiables |
| `readMessages` / `syncMessages` | Boîte/dossiers liés, fenêtre de reprise, curseur opaque | Messages normalisés, provenance, suppressions, prochain curseur ou reprise complète nécessaire |
| `acceptNotification` | Abonnement connu, secret `clientState`, ressource et autorisation actuelles | Ingestion durable ou refus ; jamais un engagement métier depuis le webhook |
| `getBusyIntervals` | Calendrier lié, fenêtre bornée, fuseau explicite | Intervalles, date de lecture, couverture ; inconnu si lecture incomplète/périmée |
| `createCalendarEvent` / `findCalendarEvent` | Action durable, référence stable, réservation/version/A1 relues | ID externe et `confirmed`, `uncertain` ou échec explicite |
| `sendMessage` / `reconcileMessage` | Action autorisée, offre immuable, destinataires et contenu exacts | `provider_accepted`, `uncertain`, `failed` ; livraison seulement sur preuve distincte |
| `renewSubscription` / `refreshAuthorization` | Connexion, version d'autorisation et échéance | Échéance vérifiée ou reconnexion requise ; aucune boucle infinie |
| `disconnect` | Acteur autorisé et connexion courante | Invalidation locale/version incrémentée, arrêt des nouvelles actions, nettoyage fournisseur suivi |

Modèles persistants cibles : `Connection`, `OAuthAttempt`, `CredentialReference`,
`ConnectionScope`, `ConnectionCapability`, `ResourceBinding`, `Subscription`,
`SyncCursor`, `ConnectionHealth`, définis dans produit 10. Références et contraintes
composites incluent toujours la cave. Aucun journal ne contient message brut ou secret.

## Synchronisation et effets externes

Les messages utilisent `Prefer: IdType="ImmutableId"` de façon cohérente ; l'identité
reste stable entre dossiers d'une même boîte, pas nécessairement lors d'un transfert
en archive ou d'une réimportation. Clé métier de déduplication : cave, boîte, ID
immuable ; les exceptions demandent une réconciliation. [Identifiants immuables](https://learn.microsoft.com/en-us/graph/outlook-immutable-id).

Le delta des messages est **par dossier**. Le serveur suit les liens opaques de
pagination jusqu'au `deltaLink`, puis conserve ce dernier après validation durable
de la page. Il valide l'hôte et le rattachement attendus avant tout appel, sans
reconstruire les tokens. Une reprise complète reste dédupliquée.
[Delta messages](https://learn.microsoft.com/en-us/graph/delta-query-messages).

Premier profil de webhook : notifications sans données de ressource, suivies d'une
relecture autorisée. L'abonnement connu et son `clientState` sont vérifiés ; le corps
ne choisit jamais la cave. `clientState` est un secret de validation, absent des logs.
[Ressource subscription](https://learn.microsoft.com/en-us/graph/api/resources/subscription?view=graph-rest-1.0).

La validation d'URL renvoie le token opaque décodé en `text/plain`, HTTP 200 dans
les 10 secondes. Une notification valide est persistée avant acquittement, avec
objectif de réponse sous 3 secondes ; si la persistance échoue, réponse 5xx.
Les pertes de notification imposent une reprise de synchronisation ; le webhook
n'est pas une source exhaustive. [Livraison webhooks](https://learn.microsoft.com/en-us/graph/change-notifications-delivery-webhooks).

Renouveler avant l'expiration retournée, surveiller les événements de cycle de vie
et reprendre la lecture après interruption. Ne pas coder une durée universelle
valable pour toutes les ressources. [Notifications Outlook](https://learn.microsoft.com/en-us/graph/outlook-change-notifications-overview).

Pour les événements, conserver un `transactionId` stable de l'action pour les
réessais de création ; Microsoft le prévoit pour éviter les POST redondants. Il
ne verrouille pas la disponibilité. La recherche de réconciliation utilisera un ID
externe connu ou une propriété de référence dont l'API sera qualifiée ; aucun filtre
sur `transactionId` n'est supposé disponible. [Ressource event](https://learn.microsoft.com/en-us/graph/api/resources/event?view=graph-rest-1.0).

`sendMail` renvoie HTTP 202 sans corps ; cela ne démontre ni fin du traitement ni
livraison au destinataire. Le contrat n'attribue aucune clé d'idempotence native à
`sendMail`. Après perte de réponse, conserver l'incertitude et réconcilier avant
toute relance autorisée. Une trace dans les éléments envoyés n'est pas une preuve
de réception. [sendMail](https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0).

Les conflits internes sont protégés par PostgreSQL ; une modification manuelle
indépendante dans Outlook n'est pas atomiquement verrouillée par cette base.
Disponibilité inconnue, prix manquant, accord sur ancienne version ou absence de
« Réserver et confirmer » A1 bloquent l'engagement. L'adaptateur ne décide jamais
du prix, de l'allocation ou d'une modification commerciale.

## Erreurs et reprise bornée

| Situation | Décision contractuelle |
|---|---|
| 401 / interaction requise | Rafraîchissement si autorisé, au plus une nouvelle tentative immédiate ; sinon reconnexion |
| 403 / portée insuffisante | Capacité indisponible, aucune escalade automatique de permission ou de compte |
| 404 ressource liée | Rattachement à revérifier, disponibilité inconnue ; ne pas remplacer par un autre calendrier |
| 429 | Respecter `Retry-After`, sinon recul exponentiel avec jitter ; travail durable différé |
| 5xx / timeout lecture | Réessais bornés puis état dégradé ; ne pas fabriquer une lecture vide |
| Timeout après écriture/envoi | État incertain, réconciliation ; pas de renvoi aveugle |
| Abonnement expiré / curseur invalide | Recréer si droits actuels et resynchroniser avec déduplication |
| Révocation / déconnexion | Arrêter nouvelles actions et renouvellements ; B reste indépendante de A |

Pour 429, Microsoft prescrit `Retry-After` et un recul exponentiel si absent.
[Limitation Graph](https://learn.microsoft.com/en-us/graph/throttling).
Budget produit initial configurable : cinq tentatives au plus sur une heure pour
les lectures idempotentes ; si `Retry-After` dépasse l'échéance, suspendre et afficher
la reprise nécessaire. Une opération incertaine utilise son protocole propre.

Chaque worker relit cave, connexion, état et `authorization_version` avant l'effet.
La déconnexion locale bloque les nouveaux effets après prise en compte ; elle ne
garantit pas l'annulation d'une requête déjà reçue. Une révocation Microsoft n'est
pas détectée instantanément dans tous les cas. Historique et incertitudes sont
conservés ; suppression des références de jetons et nettoyage des abonnements sont
suivis séparément du retrait du consentement chez Microsoft.

La recette positive, négative et réelle figure dans [le protocole](microsoft-qualification.md).
