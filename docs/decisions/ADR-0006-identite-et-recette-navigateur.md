# ADR-0006 — Identité et recette navigateur

Date : 2026-09-09. Statut : retenue pour EA-05 sous délégation de Sam.

ADR-0005 fixe OIDC indépendant de Microsoft. La première tranche choisit
`openid-client` 6.8.8, Authorization Code confidentiel, PKCE, nonce/state et contrôle
cryptographique explicite via `enableNonRepudiationChecks`. Les identités et
sessions sont persistées dans PostgreSQL 17 ; les appartenances et droits métier
viennent du serveur, jamais d’une claim de rôle fournie par le navigateur.

`oidc-provider` 9.12.2 et `jose` 6.2.12 servent uniquement au fournisseur synthétique
de test : découverte, clés RSA/JWKS, redirections, code et signatures sont réels.
L’écran de choix de compte est volontairement fictif et local. Cette recette ne
remplace pas une qualification Keycloak 26.7.3, qui demeure la cible de production.
Versions exactes verrouillées dans package-lock.json ; aucun compte prospect.

La UI suit les tokens existants, avec écrans connexion, équipe et acceptation
d’invitation. Playwright 1.63.0 et son Chromium verrouillé exécutent les tests
navigateur. L’analyse d’accessibilité de cette tranche utilise les assertions DOM
et de styles effectifs du runner `tests/product/ux/identity-ux.test.mjs` : dimensions
de cibles, contraste WCAG calculé à partir des couleurs rendues, focus, clavier,
états accessibles et absence de débordement. La review distincte inspecte toutes
les captures. Il ne s’agit pas d’une certification exhaustive d’accessibilité.

Le zoom navigateur est appliqué par l’API officielle `chrome.tabs.setZoom` dans un
profil Chromium isolé avec extension de test limitée à 127.0.0.1. Les rendus à 200 %
et 400 % sont capturés par `Page.captureScreenshot`, viewport visible sans crop,
avec défilements verticaux qui se recouvrent. Ce choix corrige le cadrage fullPage
tronqué constaté par la première review ; les anciennes captures restent identifiées
comme insuffisantes et ne remplacent pas les preuves finales.

Les invitations sont transmises manuellement, expirent après 48 heures et ne
changent jamais une appartenance déjà active. Les décisions concurrentes de cave
emploient un verrou transactionnel SQL ; le dernier administrateur demeure actif.
Le quota de connexions est propre au navigateur signé, à mémoire bornée ; une
protection distribuée d’ingress devra être qualifiée avant exposition réelle.

Mise en œuvre, paramètres serveur et limites : [guide identité](../development/identity.md).
Critères et preuves : [EA-05](../work/EA-05/contract.md). Aucun workflow, ancien test,
schéma de rapport ou règle d’autorisation n’est modifié par cette décision.

Sources : [openid-client](https://github.com/panva/openid-client),
[oidc-provider](https://github.com/panva/node-oidc-provider),
[extensions Playwright](https://playwright.dev/docs/chrome-extensions),
[API tabs](https://developer.chrome.com/docs/extensions/reference/api/tabs),
[captures Chromium](https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-captureScreenshot).
