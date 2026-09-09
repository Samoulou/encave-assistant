# EA-13 — Contrat avant réalisation

Exécution1 ouverte 2026-09-09 13:55:58 UTC ; échéance15:55:58 UTC.
Trois corrections maximum, huit appels reviewer,1200s/appel,7200s/exécution.
Base `ddc291786798ed273916d8ee2823efe14747fc6a`. Dépendances EA-02 et EA-06
livrées avec reviews et SHA distants vérifiés ; EA-12 vient aussi d’être livré.
Lectures : AGENTS/START/protocole08, brief, backlog, produit10/connecteurs,
architecture/contrats09, sécurité05, UX11 §4.7/6/7, design/tokens et stratégie04/DoD05.
Documentation Microsoft officielle consultée avant usage des API.

## AC-01

Jetons chiffrés serveur, jamais au navigateur/LLM ; chaque connexion et ses références appartiennent à une cave et ne sont utilisables que dans son contexte autorisé.

Acceptation : migration additive009, connexions et tentatives OAuth liées à la
session, acteur et cave vérifiés. Secrets OAuth/cache MSAL chiffrés AES-256-GCM
avec contexte authentifié cave/connexion/type/version de clé ; aucune valeur brute
dans réponse navigateur, message, job, capture ou log. API et point d’accès serveur
aux credentials revalident appartenance et version d’autorisation actuelle.
Tests : deux caves, référence étrangère, enveloppe chiffrée déplacée/tamper, rôle
insuffisant, session expirée/révoquée, réponse publique expurgée et dump SQL montrant
des empreintes/chiffrements, sans imprimer les valeurs sensibles.

## AC-02

Définir un contrat fournisseur neutre pour capacités, lecture, écriture, état de santé et erreurs ; distinguer clairement opérations disponibles, non supportées et non qualifiées.

Acceptation : contrats typés dans packages/contracts, adaptateur dans
packages/connectors. Identité, ressources, capacités, santé, lecture de messages,
occupations, écriture/recherche calendrier, envoi/réconciliation et abonnements ont
des entrées/sorties et erreurs communes ; le domaine ne dépend pas de Graph.
Une opération non implémentée répond explicitement non supportée. Une capacité
implémentée sans preuve technique répond non qualifiée, sans effet externe.
Tests de contrat synthétiques : sorties normalisées, erreurs sûres, refus des
capacités absentes/non qualifiées, isolation et contexte avant accès fournisseur.

## AC-03

Une cave autorisée connecte son compte Microsoft via OAuth, choisit les ressources permises et peut reconnecter ou révoquer sans redéploiement ni identifiants client codés en dur.

Acceptation : écran Connexions commun, Microsoft365 organisationnel/boîte propre,
application d’environnement commune. Flux Code+PKCE via MSAL Node maintenu, callback
serveur ; tentative durable à usage unique. Identité fournisseur vérifiée,
sélection issue des ressources effectivement découvertes, choix conservés après
reload/redémarrage. Plusieurs connexions possibles ; aucun compte/tenant de prospect
dans le code. Reconnexion du même compte autorisée ; autre compte/organisation
refusé pour cette connexion avec invitation à créer une connexion séparée et refaire
sa sélection explicitement. Pas d’écrasement silencieux ni de routage partagé.
Tests navigateur/HTTP : deux caves et organisations synthétiques via le même code,
ressource absente/étrangère refusée, nouvelle connexion, reprise, révocation,
retour OAuth d’un autre onglet/cave, mémoire après redémarrage API.

## AC-04

Appliquer les permissions Microsoft réellement nécessaires et vérifier côté serveur l’identité du compte, la cave, le retour OAuth et les ressources autorisées ; si Microsoft exige un consentement administrateur, afficher cet état et ne pas contourner ce contrôle.

Acceptation : profil initial commercial/organisationnel, comptes personnels et
profils partagés hors compatibilité initiale. Scopes limités aux API utilisées,
documentés par opération ; la découverte ne sollicite pas de droit d’envoi/écriture
non utilisé. Scopes identité/offline, User.Read et permissions minimales de découverte
boîte/calendrier ; élargissement explicite lors de l’ajout des opérations suivantes.
Validation signature/issuer/audience/temps/nonce ID token, tid/oid vérifiés puis
cohérence avec /me ; email/UPN servent uniquement d’affichage. Jeton Graph opaque,
jamais employé comme session EnCave. State absent/périmé/rejoué, code substitué,
mauvaise session/cave/acteur, rôle retiré pendant le flux, identité personnelle et
ressource arbitraire ne créent pas de connexion utilisable. Erreurs de consentement
et administrateur requis affichées sans texte fournisseur non filtré ni contournement.

## AC-05

L’état de santé, la reconnexion, l’expiration et la révocation sont indépendants par connexion ; une révocation bloque les nouveaux effets externes sans interrompre une autre cave.

Acceptation : statut, version d’autorisation, échéance, dernier contrôle et diagnostic
sûr par connexion. Renouvellement borné via cache MSAL chiffré ; aucune boucle
infinie. Déconnexion invalide localement l’autorisation et supprime les credentials
utilisables, conserve les références historiques et les dossiers. Une tâche portant
l’ancienne version est refusée ; une réponse fournisseur en vol ne peut réactiver
une connexion révoquée. La déconnexion locale n’annonce pas l’annulation d’un effet
déjà reçu par Microsoft ni la révocation de tous les consentements chez Microsoft.
Tests : expiration/refresh/interaction requise, panne429/timeout/refus, révocation
pendant requête, concurrence de versions, connexionB inchangée après révocationA.

## AC-06

Les tests de contrat utilisent des comptes et réponses synthétiques explicitement identifiés ; seuls les tests sur un environnement autorisé prouvent l’intégration Microsoft réelle. Garder toute connexion réelle inactive avant sa qualification technique.

Acceptation : simulateur fournisseur local de test explicitement identifié et
séparé du profil réel, réponses déterministes et adverses. Production n’accepte
pas ses URL/autorités. Enregistrement de configuration globale optionnelle côté
serveur ; sans inscription/secrets autorisés, état « Microsoft non configuré » et
mode interne restent utilisables. Les connexions réelles demeurent non activables
sans qualification technique indépendante par profil/capacité. Aucune preuve réelle
n’est fabriquée à partir des mocks, tests de contrat ou d’une connexion OAuth.
Les tests effectuent la distinction et vérifient le refus d’activation ; aucune
permission sur un compte de Julien ou d’un autre tiers n’est supposée.

## AC-07

Respecter les critères UX applicables de docs/product/11-ux-ui-et-design.md et les tokens de docs/design/design-tokens.json sur les parcours modifiés ; exécuter test:ux, conserver les captures navigateur et faire vérifier les états, le responsive, le clavier et les actions sensibles par la review indépendante.

Acceptation : UX-09/13/15/16/17, cave et compte visibles, navigation Connexions,
progression connexion/sélection/vérification, cartes fournisseur/compte/organisation,
capacités distinguées, synchronisation inconnue explicitement non effectuée.
États vide/non configuré/attente/consentement refusé/admin requis/sélection invalide/
autre compte/expiré/révoqué/erreur et reprise. Aucun champ de jeton/mot de passe.
Dialogue sensible de déconnexion avec focus/Échap/retour et portée visible.
Tests navigateur à320/390/768/1440, zoom200/400, Tab/Entrée, cibles44/focus3/contrastes,
erreurs liées, valeurs conservées et absence de réponse tardive d’une ancienne cave.
Captures examinées par une session indépendante, sans jetons ni données réelles.

## Choix, sources et gates

MSAL Node6.0.0 observé dans le registre npm, Node>=20 compatible avec Node24 du
dépôt. Dépendance à verrouiller avant implémentation. Les endpoints réels restent
Microsoft commercial ; seul le profil de test explicitement configuré emploie un
simulateur loopback. Opérations métier ultérieures EA-14/15/16/24/25 consommeront
le contrat commun ; une définition de méthode n’est pas une intégration qualifiée.

Sources : [Code+PKCE](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow),
[MSAL Node](https://learn.microsoft.com/en-us/entra/msal/javascript/node/acquire-token-requests),
[claims ID token](https://learn.microsoft.com/en-us/entra/identity-platform/id-token-claims-reference),
[permissions Graph](https://learn.microsoft.com/en-us/graph/permissions-reference),
[calendriers](https://learn.microsoft.com/en-us/graph/api/user-list-calendars?view=graph-rest-1.0).

Gates : kit, unit, functional, business, E2E, UX ; compilation/foundation,
outillage et runtime affectés. IA non applicable. Anciens tests et défaut de
migration historiquev3 préservés ; aucune politique/workflow/instruction modifiée.
Review indépendante, corrections bornées, preuves et livraison Git normale avant
prochain ticket admissible ; code livré, CI et production restent distincts.
