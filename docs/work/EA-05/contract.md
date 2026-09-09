# EA-05 — Contrat avant réalisation

2026-09-09, ouverture 10:43 Europe/Zurich. Base :
`fef9da7135a341312b782916c51fc9c271cb0bb7` (EA-04 livré, kit 141/141,
review indépendante pass, push et SHA distant vérifiés).
Première exécution ; maximum trois tentatives de correction, huit appels d'agents,
1 200 secondes par appel, 7 200 secondes au total (échéance 12:43).

Références lues : brief, EA-05 du backlog, produit04/05/09/11, docs/design
(tokens et trois maquettes conceptuelles), ADR-0003/0005, stratégie tests et DoR/DoD.
L'identité de production Keycloak et Microsoft restent distincts et non activés.

## AC-01

Session vérifiée côté serveur.

Acceptation : Authorization Code OIDC avec PKCE S256, state lié au navigateur,
nonce, issuer/audience/signature/expiration validés ; session opaque persistée
côté PostgreSQL, cookie HttpOnly, SameSite, Secure hors loopback de développement.
Refuser cookie forgé/expiré/révoqué, callback rejoué, state/nonce/issuer/audience ou
signature invalides. Aucun rôle, cave ou jeton fourni par le navigateur ne crée
une identité. Les mutations contrôlent origine et CSRF.

## AC-02

Invitation et révocation effectives.

Acceptation : administrateur crée une invitation expirante à usage unique, liée
à une cave, un e-mail vérifié et un rôle. Le lien est transmis manuellement ; aucun
e-mail envoyé par l'application n'est annoncé. Acceptation par l'identité OIDC
attendue puis rechargement : appartenance persistée. Refus mauvaise identité,
expiration et rejeu. Révocation d'un membre coupe ses accès à cette cave dès la
requête suivante, y compris une session déjà ouverte ; les autres caves demeurent
indépendantes. Protection du dernier administrateur et des commandes concurrentes.

## AC-03

Commandes sensibles interdites au lecteur.

Acceptation : matrice serveur administrateur/opérateur/lecture ; invitation,
révocation et gestion de l'équipe réservées à l'administrateur. Lecteur consulte
son espace autorisé et voit les raisons des refus. API directe et navigateur
refusent les commandes interdites, y compris cave forgée et rôle injecté.
Ne pas créer d'action commerciale factice pour démontrer ce contrôle.

## AC-04

Livrer la première tranche verticale testable : schéma minimal des identités, caves et membres, migrations nécessaires à l’authentification, vrais runners unitaires, fonctionnels/API, métier des rôles et E2E navigateur ; les suites absentes ou vides restent en échec. Le schéma métier complet appartient à EA-07.

Acceptation : migrations versionnées et seed synthétique séparé ; deux caves et
comptes de test, SQL réel et rôle applicatif sans superprivilèges ; démarrage
reproductible. Unitaires sur décisions pures, API/DB sur sessions et mutations,
métier sur rôles/invitations/révocations, E2E sur application et fournisseur OIDC
de test avec redirections et jetons signés réels. Le fournisseur de test représente
des identités synthétiques ; il ne qualifie pas Keycloak de production ou Microsoft.
Les vieux tests demeurent intacts, suites vides ou absentes toujours bloquantes.

## AC-05

Rendre exécutable test:ux pour les écrans livrés : clavier et focus, erreurs de connexion, contrôle d’accès, tailles mobile/bureau et captures issues du navigateur ; la review indépendante examine les rendus réels.

Acceptation : écran de connexion, espace/cave active, équipe et invitation,
révocation confirmée dans un dialogue ; vrais états chargement, vide, erreur et
session expirée selon applicability. Parcours clavier, Échap et retour de focus,
erreurs associées et conservation des valeurs. Captures réellement rendues sur
application de test, examinées par un reviewer distinct ; un fichier seul ne vaut
jamais recette UX. Aucune capture ne contient jeton ou lien d'invitation complet.

## AC-06

Respecter les critères UX applicables de docs/product/11-ux-ui-et-design.md et les tokens de docs/design/design-tokens.json sur les parcours modifiés ; exécuter test:ux, conserver les captures navigateur et faire vérifier les états, le responsive, le clavier et les actions sensibles par la review indépendante.

Acceptation : UX-01 (cave visible et contexte changé sans fuite), UX-13 (320/390/768/1440,
zoom 200 % et reflow équivalent 400 %), UX-16 (couleurs effectives, cibles 44 px,
focus), UX-17 (états applicables). Principes UX-14/15 appliqués au clavier et aux
formulaires de ce lot. Aucune liste de demandes, proposition ou réservation simulée
n'est présentée comme implémentée. Le schéma commercial reste pour EA-07 et suivants.

## Décisions de réalisation et gates

Bibliothèque OIDC maintenue `openid-client` 6.8.8, vérification cryptographique
explicite des ID tokens ; fournisseur Node `oidc-provider` 9.12.2 pour tests/fixtures
locaux, séparé des sources de production. Versions observées sur npm le 2026-09-09,
à verrouiller au lockfile. Keycloak 26.7.3 demeure la cible ADR de production.
API Node porte sessions et commandes ; Next expose les écrans et une origine
commune pour les appels. Les erreurs publiques sont génériques, les jetons et
valeurs d'accès ne sont jamais journalisés. Pas de donnée ou compte prospect.

Gates obligatoires : kit, unit, functional, business, e2e, ux. Vérifier aussi
compilation/foundation et anciens tests d'outillage affectés. PostgreSQL natif
Windows préparé par DEV-01 ; bases/fixtures produit isolées et nettoyage borné.
Le kit WSL utilise la mitigation EA-04 documentée, sans campagne native Windows.
Les tests IA demeurent non configurés et ne font pas partie de ce ticket.
Conserver résultats exacts, empreintes, captures expurgées et review indépendante
avant livraison Git normale ; CI et production sont des preuves séparées.
