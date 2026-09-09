# Formulaire public — EA-12

Chaque cave dispose d’un formulaire configuré côté serveur. Un administrateur
authentifié utilise GET/POST `/api/intake-form`, contexte cave vérifié, origine,
CSRF et clé d’idempotence UUID. POST attend `expectedVersion` (0 au premier appel),
`enabled` et `definition`. La réponse retourne l’identifiant public, la version,
le lien `/formulaire/<id>` et un extrait HTML de lien. L’onboarding graphique de
cette configuration relève d’EA-38 ; aucun identifiant de cave n’est codé en dur.

Le site de la cave, WordPress compris, peut placer cet extrait dans un bouton/lien.
Il ouvre la page hébergée. Cette intégration légère n’exige ni plugin ni compte
visiteur. Les iframes restent interdites par les en-têtes existants. Le test E2E
ouvre réellement un serveur HTTP de site fictif puis suit le lien. Il ne prétend
pas qualifier une installation WordPress réelle.

## Configuration et limites

`definition` est un objet fermé :

| Champ | Bornes |
|---|---|
| intro | texte approuvé, 1–1000 caractères |
| challengeLimitPerMinute | 1–120 |
| attemptLimitPerMinute | 1–60 |
| attemptLimitPerHour | 1–1000 |
| minimumDelayMs | 500–10000 |
| challengeTtlSeconds | 60–3600 |

Les fixtures choisissent 120 challenges/minute, 60 tentatives/minute, 1000/heure,
500 ms minimum et 900 s de validité. Ce sont des hypothèses de test configurables,
pas des mesures de trafic client. Les fenêtres relatives commencent à la première
tentative ; trois lignes de compteur au maximum par formulaire sont réutilisées.
Une configuration modifiée produit une version immuable, jamais une réécriture.

GET `/api/public/forms/<id>` résout la cave depuis la configuration et délivre un
challenge temporaire, dont seule l’empreinte est stockée. Jusqu’à 200 challenges
expirés sans réception associée sont nettoyés par émission ; ceux d’une demande
acceptée restent conservés comme preuve. Le nombre actif est plafonné à 10000.
Les plafonds configurables et TTL limitent aussi leur volume. Le challenge ne doit
pas apparaître dans les logs, captures ou documents de livraison.

POST sur la même URL utilise une enveloppe fermée `challenge`, `requestKey` UUID,
`website` (honeypot vide), `inquiry`. Les quotas de toutes les tentatives valides en
origine sont débités dans une transaction distincte avant parsing (16 Kio maximum).
Un JSON malformé ou un rollback ne rembourse pas le quota. Les refus portent
`Retry-After` lorsque pertinent, relayé par Next. Verrou commun de cave et compteurs
PostgreSQL couvrent concurrence et redémarrages. Une fausse adresse X-Forwarded-For
ne crée pas une nouvelle identité de quota ; aucune confiance n’est donnée à l’IP
loopback du proxy. Une origine valide n’authentifie pas un visiteur.

Ces protections limitent le spam et les rejouages ordinaires. Elles ne qualifient
pas la résistance à une attaque distribuée ni un robot patient. Les quotas sont
globaux par formulaire : une forte charge peut limiter aussi un visiteur légitime.
Une protection d’ingress de l’environnement réel reste à qualifier avec EA-40.

## Réception et reprise

Nom, besoin et e-mail ou téléphone sont nécessaires. Date civile souhaitée,
participants et budget CHF sont facultatifs. Budget et base groupe/personne sont
couplés ; un inconnu reste null. Les propriétés cave/acteur/état sont refusées.
Même un staff connecté à une autre cave n’influence pas le routage public.

Une transaction crée le dossier, le message entrant et sa provenance immuable,
liée par FK cave/dossier/message/formulaire/version/challenge. Aucun auteur staff
n’est inventé. La référence d’accusé ne donne aucun accès public au dossier. La
lecture authentifiée dans Demandes montre le moyen de réponse et le message source.
Le succès signifie uniquement « Demande reçue ». Aucun e-mail ni réservation n’est
créé, et aucune preuve de livraison de message ne peut en être déduite.

Avant le POST, le navigateur conserve enveloppe, challenge et saisie dans le
sessionStorage de l’onglet, sous une clé propre au formulaire. Si ce stockage est
indisponible, l’envoi est bloqué avec explication et la saisie reste disponible.
Une réponse perdue verrouille la saisie et propose « Vérifier la réception ».
La reprise conserve exactement le contenu et la clé après reload, même si un refus
404/429 intermédiaire ne permet pas de connaître le résultat initial.

Le serveur recherche d’abord le résultat durable avant de tester expiration ou
version du challenge. Un formulaire désactivé reste inaccessible, y compris aux
reprises ; réactivation puis reprise retrouve un éventuel résultat déjà commis.
Seul un refus démontrant l’absence de résultat pour cette commande sous verrou
(`notCreated`) autorise de reprendre la saisie/actualiser. Une erreur de validation
initiale permet aussi de corriger les champs ; elle ne déverrouille pas un envoi
déjà incertain. Après succès, l’accusé est conservé dans l’onglet au rechargement.
Fermer l’onglet ou effacer son stockage perd cette reprise locale ; aucune relance
automatique avec une nouvelle clé n’est exécutée.

Le nettoyage d’un challenge expiré ne bloque pas un ancien onglet : après la
recherche du résultat durable sous le même verrou de cave, l’absence du challenge
permet aussi une actualisation sûre. Les FK empêchent de nettoyer celui d’une
réception déjà enregistrée. Le résumé de validation énumère les erreurs avec des
liens qui placent le focus sur chaque champ, sans perdre la saisie.

Migration additive008, runtime de test avec rôle SQL applicatif distinct. Le défaut
historique de `migrateDatabase(pool)` reste v3 ; la cible8 doit être explicite.
Les tests utilisent des comptes OIDC fictifs pour le personnel et de vrais
PostgreSQL/API/Next/Chromium. Aucun accès prospect, fournisseur ou production requis.
