# Identité et accès — tranche EA-05

Cette tranche utilise réellement OIDC, l’API et PostgreSQL. Les comptes du parcours
local ci-dessous sont des fixtures fictives ; le bouton qui choisit une identité
ne constitue pas une authentification de production. Keycloak et Microsoft ne
sont pas connectés. Le POC archivé demeure une simulation indépendante.

## Essayer sous Windows

Depuis la racine du dépôt, avec PostgreSQL local préparé selon le guide DEV-01 :

```powershell
. ./packages/tooling/activate.ps1
npm ci
npm run db:start
npm run start:identity
```

Ouvrir `http://127.0.0.1:3000/connexion`. Ports réservés par ce démarrage : web 3000,
API 3001, fournisseur synthétique 4010. Tout écoute sur loopback. Une base et un
rôle SQL uniques sont créés ; les rechargements du navigateur conservent les
sessions et invitations. L’arrêt normal nettoie ces seules ressources. La base
de cette démonstration est jetable ; elle ne vaut pas un stockage utilisateur.
Un arrêt forcé du processus peut laisser ses ressources locales : ne jamais
appliquer une suppression globale aux bases préexistantes.

Alice Martin administre les deux caves de test. Bruno Favre est opérateur et
Claire Rey lectrice à la Cave des Roches. Diane Blanc n’appartient initialement à
aucune cave ; l’inviter à `diane@cave-test.example` permet de vérifier l’acceptation.
Émile Girard administre la Cave du Lac. Ces noms et adresses sont synthétiques.
Copier le lien d’invitation puis l’ouvrir dans une autre session de navigateur,
se connecter en Diane et accepter les droits affichés. Aucun e-mail n’est envoyé.
Le lien reste un secret temporaire : l’interface le copie sans l’afficher dans les
captures ; le fragment est retiré de l’URL et conservé dans le seul onglet en cours.

Pour vérifier automatiquement démarrage et nettoyage après compilation :

```powershell
node packages/tooling/identity-demo.mjs --verify
```

L’appel direct Node préserve `--verify` avec la fonction d’activation PowerShell.
Les suites `test:unit`, `test:functional`, `test:business`, `test:e2e` et `test:ux`
exécutent de vrais tests ; E2E/UX recompilent aussi le web. `test:evals` reste en
échec tant que les évaluations IA ne sont pas implémentées. Les suites absentes,
vides, ignorées ou TODO ne deviennent jamais vertes par convention.

## Exécution configurée et migrations

L’API compilée accepte `ENCAVE_IDENTITY_CONFIG`, chemin serveur d’un fichier JSON
fourni par l’environnement protégé. Il contient deux objets : `database` avec les
paramètres de connexion `pg`, et `oidc` avec `issuer`, `clientId`, `clientSecret`,
`appOrigin`, `encryptionKey` (32 octets aléatoires encodés en 64 caractères hex),
`environment` (`test`, `development`, `preproduction` ou `production`). Ne pas
versionner, afficher ni transmettre ce fichier. La clé chiffre les vérificateurs
PKCE en attente et signe le cookie de limitation des tentatives. Les paramètres
et clés sont propres à chaque environnement ; rotation planifiée et qualification
du coffre restent à réaliser avant activation réelle.

Configurer côté fournisseur le client confidentiel avec authentification Basic,
Authorization Code, PKCE S256, signatures RS256, et l’unique callback exact
`<appOrigin>/api/auth/callback`. Demander les scopes `openid email profile` et les
claims ID token `email`, `email_verified`, `name`. Un e-mail non vérifié est refusé.
L’identité est la paire issuer/sub ; aucun rôle ou identifiant de cave du fournisseur
n’accorde de droit métier. HTTPS est obligatoire hors test/développement 127.0.0.1.

Next reçoit `ENCAVE_API_ORIGIN`, origine privée de l’API ; le navigateur emploie
uniquement `/api`. L’origine publique des mutations doit être exactement
`appOrigin`. Ne pas exposer l’API sans les frontières réseau prévues pour son
environnement. Le proxy transmet uniquement les en-têtes explicitement requis ;
il ne fait pas confiance à un `X-Forwarded-For` utilisateur.

La migration [001_identity.sql](../../migrations/001_identity.sql) s’applique à une
base vide, sous un propriétaire de migration distinct du rôle de l’application.
L’appliquer dans une transaction ; elle inscrit sa version. Le harnais de test l’exécute en un lot SQL à
chaque nouvelle base, sans seed mêlé à la migration. Le seed séparé est dans
`packages/tooling/src/identity-test-database.ts`. Pour une base réelle, provisionner
les caves et leur premier administrateur vérifié dans une opération d’exploitation
autorisée ; ne pas reprendre les identifiants de fixtures ni déduire une propriété
d’un domaine d’e-mail. Le schéma commercial et son dispositif de migration complet
appartiennent à EA-07 ; aucun upgrade de production n’a été exécuté.

Le rôle applicatif n’est propriétaire ni de base ni de tables ; il ne possède ni
SUPERUSER, BYPASSRLS, CREATEDB, CREATEROLE ni CREATE sur le schéma. Les droits exacts
sont explicités par le provisionnement de test : lecture des caves/membres/identités/
sessions/flux/invitations ; insert/update des identités/membres/sessions/invitations ;
insert/delete des flux ; delete des sessions ; insert de l’audit. Le runtime refuse
un rôle doté des quatre superprivilèges précités. EA-06 complète l’isolation,
EA-35 qualifiera le rôle effectif et les protections d’exploitation.

## Invariants et limites

Les sessions opaques vivent en SQL, avec expiration au plus égale à celle du token
d’identité et huit heures. Le navigateur conserve seulement le cookie HttpOnly,
SameSite=Lax et Secure avec préfixe `__Host-` sur HTTPS. Les mutations contrôlent
origine, CSRF et appartenance courante. La cave vient de la session ; un en-tête
de contexte périmé est refusé, sans choisir la cave à la place du serveur.

Les invitations expirent après 48 heures, sont liées à un e-mail vérifié, une cave
et un rôle, et ne s’acceptent qu’une fois. Une appartenance déjà active ne change
jamais de rôle par acceptation. Réactiver un membre révoqué exige une nouvelle
invitation explicite. Les révocations et décisions sur le dernier administrateur
se sérialisent par verrou transactionnel de cave. Révoquer un membre coupe l’accès
à cette cave à la requête suivante ; ses autres appartenances restent utilisables.

La limitation des connexions est une protection locale par cookie aléatoire signé,
40 démarrages en dix minutes et mémoire bornée. Elle évite de partager le quota de
tous les utilisateurs derrière Next. Effacer les cookies ou redémarrer le processus
réinitialise cette protection : une défense contre l’abus réseau distribuée doit
être configurée sur l’ingress de confiance avant exposition réelle. Aucune garantie
de protection anti-DDoS ou de qualification fournisseur n’est déduite de ces tests.

Références consultées : [openid-client](https://github.com/panva/openid-client),
[oidc-provider](https://github.com/panva/node-oidc-provider),
[OIDC Keycloak](https://www.keycloak.org/securing-apps/oidc-layers),
[zoom Chromium](https://developer.chrome.com/docs/extensions/reference/api/tabs),
[captures CDP](https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-captureScreenshot).
