# EA-13 — Décisions et limites

## Profil livré

Une inscription Microsoft Entra commune par environnement, multitenant,
comptes professionnels ou scolaires du cloud commercial. Chaque administrateur
connecte les comptes de sa cave depuis `/connexions`. Boîte de l’utilisateur et
calendrier principal uniquement ; profils personnels, partagés, délégués et clouds
nationaux hors compatibilité initiale. Aucun tenant ou compte prospect imposé.

MSAL Node6.0.0 assure Code+PKCE et le cache de renouvellement. jose6.2.12 vérifie
en plus le JWT d’identité : signature RS256, clé/issuer du tenant, audience,
expiration/iat, nonce et oid/tid ; `/me` confirme l’identité de la ressource Graph.
Les claims d’identité obligatoires ne sont pas facultatifs. Les jetons Graph
restent opaques et ne deviennent jamais une session EnCave.

| Appel initial | Permission déléguée |
|---|---|
| Identité OIDC et renouvellement | openid, profile, offline_access |
| Graph `/me` | User.Read |
| Graph `/me/mailFolders/inbox` | Mail.ReadBasic |
| Graph `/me/calendar` | Calendars.ReadBasic |

Ces permissions permettent la découverte effectivement implémentée. Aucun
Mail.Send ou Calendars.ReadWrite n’est demandé avant une opération correspondante.
Une boîte/capacité accessible en lecture ne prouve aucun droit d’écriture. Un403
de ressource la rend indisponible sans inventer de permission. La politique
Microsoft peut exiger un administrateur ; le produit affiche cette attente.

Sources consultées le 2026-09-09 :
[Code+PKCE](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow),
[MSAL/cache](https://learn.microsoft.com/en-us/entra/msal/javascript/node/caching),
[claims](https://learn.microsoft.com/en-us/entra/identity-platform/id-token-claims-reference),
[permissions](https://learn.microsoft.com/en-us/graph/permissions-reference),
[lecture du dossier](https://learn.microsoft.com/en-us/graph/api/mailfolder-get?view=graph-rest-1.0).

## Configuration et secrets

L’objet serveur optionnel `microsoft` du runtime d’identité contient `clientId`,
`clientSecret`, `encryptionKey` (clé AES256 encodée en hexadécimal) et `keyVersion`.
L’URI à enregistrer dans Entra est l’origine HTTPS de l’application suivie de
`/api/connections/microsoft/callback`. Cette configuration appartient à
l’environnement, jamais à une cave ; aucune reconstruction de l’application
n’est nécessaire pour ajouter une cave. Son provisionnement exige une inscription
et des secrets autorisés ; aucun n’a été fourni ou lu ici. Les protections du
fichier/coffre serveur relèvent du déploiement, qui reste à réaliser.

Sans cet objet, Microsoft est explicitement non configuré et la saisie interne
reste accessible. Le simulateur exige `environment=test` et un `fixtureOrigin`
loopback127.0.0.1 ; les endpoints logiques MSAL/Graph restent Microsoft et sont
transportés vers le simulateur uniquement dans ce profil. La production rejette
cette option. Aucun contournement TLS ou de validation de signature.

Cache MSAL et tentative OAuth sont chiffrés AES-256-GCM avec AAD liant cave,
connexion, finalité et version. State est stocké sous empreinte, PKCE/nonce dans
l’enveloppe chiffrée. Les sessions et l’acteur sont revérifiés au callback et avant
chaque requête réseau. Les réponses navigateur, jobs et diagnostics ne contiennent
ni cache ni jeton. Aucun appel réseau pendant un verrou/transaction PostgreSQL.
Un cache illisible invalide cette autorisation, supprime ce cache et propose une
reconnexion, sans boucle de vérification. Une rotation non accompagnée de migration
des clés exige une reconnexion ; le code
ne tente pas de déchiffrer avec une autre cave ou une clé de secours implicite.

## Autorisation, reprise et santé

Les choix utilisent exclusivement les ressources découvertes et leur propriétaire
vérifié. Les clés étrangères sont composites ; une ressource ne peut pas changer
de cave/compte par un champ navigateur. Le routage d’une même ressource vers deux
connexions est refusé par défaut, y compris entre caves. Changer de compte exige
une connexion séparée ; la reconnexion conserve l’identité existante.

Les mutations utilisent clé idempotente, versions et journal immuable. Le
navigateur conserve la commande avant POST et la reprend après perte de réponse,
rechargement ou retrait temporaire des droits. Une commande OAuth dont la tentative
est déjà terminée/expirée retrouve sa connexion durable ; elle ne crée pas une
seconde connexion. L’interface propose ensuite la reconnexion de cette connexion.
Les réponses tardives d’un ancien contexte ne sont pas affichées dans la nouvelle
cave. Les états d’erreur proviennent de codes sûrs ; jamais du texte Microsoft brut.

Le contrôle manuel tente un renouvellement MSAL borné et met à jour le cache
chiffré, les ressources et l’échéance. Réseau limité à5s et1Mio par requête, sans
retry interne MSAL. Le point d’entrée de découverte des futurs jobs refuse un
état inactif, une échéance dépassée ou une ancienne version d’autorisation ; un
contrôle/reconnexion administrateur est alors nécessaire. Il ne constitue pas
encore un worker de synchronisation. La synchronisation reste « Non effectuée ».

Déconnecter augmente la version d’autorisation, supprime les credentials et le
routage utilisables, annule les tentatives OAuth et conserve l’historique. Les
requêtes suivantes et les persistances tardives sont refusées. Cela ne retire pas
les consentements Microsoft et ne garantit pas l’annulation d’un effet déjà reçu
par le fournisseur. Aucune opération métier externe n’est implémentée par EA-13.

## Qualification distincte

La découverte synthétique est la seule capacité activable dans le profil de test.
Le SQL interdit l’état actif à une connexion réelle. Les autres opérations du
contrat neutre répondent `not_supported`, y compris envoi, synchronisation,
occupations et écriture calendrier. Les connexions réelles restent non qualifiées
et non activables, même après un OAuth réussi.

Les tests MSAL et Graph utilisent deux organisations explicitement fictives. Ils
ne prouvent ni consentement réel, ni compatibilité d’une organisation cliente,
ni livraison d’un message. La recette Microsoft sur comptes autorisés demeure
non vérifiée et conditionne l’activation du profil vendu, pas les développements
indépendants. Les prochains tickets étendront les opérations et leurs permissions
sans affaiblir cette distinction.


## Correction1 après review indépendante

R1 (AC-03/05/07) : le journal appartient à l’acteur et à la cave, alors que
l’autorisation OAuth appartient aussi à une session précise. Une nouvelle session
vérifiée du même administrateur peut retrouver la connexion existante. Elle annule
le flux encore pending/consumed de l’ancienne session et, si cette autorisation est
toujours courante, l’invalide avant de proposer Reconnecter. Aucun ancien URL OAuth
n’est rendu à la nouvelle session. Une tentative déjà terminée ne modifie pas une
connexion plus récente. Les preuves HTTP et navigateur vérifient l’absence de
doublon, le refus de l’ancien callback et la réussite d’un nouveau flux.

R2 (AC-05) : un échec réseau ne peut modifier la santé que si les versions de
connexion et d’autorisation observées au départ sont toujours courantes. Le
résultat tardif reste une erreur pour sa propre requête, sans remplacer une santé,
un cache ou des capacités actualisés entre-temps. Le scénario concurrent retient
une réponse Graph429 déjà reçue, termine un contrôle réussi, puis libère l’échec
et vérifie que le job de découverte demeure utilisable.

R3 (AC-04) : le SDK MSAL installé expose le premier numéro serveur dans errorNo
(ResponseHandler et ServerError de msal-common16.14.0). Les valeurs numériques ou
textuelles exactes90093/90094 deviennent admin_consent_required ; le texte brut
n’est jamais utilisé comme diagnostic public. consent_required sans numéro connu
exige une nouvelle interaction. Tests avec ServerError réel et réponse de jeton
synthétique traversant le véritable SDK, jusqu’à la santé persistée côté API.
[Référence Microsoft des consentements administrateur](https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/application-sign-in-unexpected-user-consent-error).

Ce cycle conserve le contrat initial et les anciens tests. Les diagnostics de la
première review, son manifeste et les sources examinées sont conservés localement
et leurs empreintes sont ajoutées aux preuves du candidat corrigé.

L’examen des nouvelles captures a aussi corrigé le libellé interaction_required :
« L’autorisation doit être renouvelée » couvre une session EnCave renouvelée et
un refus de refresh, sans attribuer à Microsoft une demande non observée. Les
parcours et captures ont été réexécutés après cette correction de texte.
