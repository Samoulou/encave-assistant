# Environnements et CI indépendants

EA-04 · 2026-09-09. Complète [le guide Windows](local-development.md) et
[ADR-0005](decisions/ADR-0005-architecture-et-lancement.md).

## Séparation effective et limites

Trois espaces GitHub du dépôt `Samoulou/encave-assistant` ont été créés :
`development` (ID 21545024339), `preproduction` (21545024751) et `production`
(21545025176). Aucun secret ni règle d'approbation supplémentaire n'y a été ajouté.
Ces espaces sont distincts ; leur création ne déploie ni application ni base Azure.

Les déclarations initiales dans `ops/environments/` fixent des préfixes de ressources,
noms de bases, realms OIDC et espaces de credentials distincts. Le développement
possède seulement la fondation locale ; les ressources distantes ne sont pas
provisionnées. `check:environments` contrôle cette séparation et refuse les champs
inattendus, les collisions et une activation prétendue dans ces plans initiaux.
Une future livraison complétera ses configurations et preuves opérationnelles ;
ces déclarations ne sont pas un inventaire interrogé chez Azure.

Le rôle technique `encave_dev` de PostgreSQL ne devient pas le rôle applicatif de
production. Le schéma et les droits réels de l'application appartiennent aux tickets
d'identité/isolation. Aucun compte ou secret marketplace n'est importé. Les packages
applicatifs utilisent exclusivement les workspaces propres et leurs dépendances
publiques verrouillées.

## Préparation du runner Linux

La maintenance modifie seulement `.github/workflows/product-quality.yml` ; le
workflow release conserve son ciblage d'environnement et ses contrôles forcés.
Le validateur `scripts/workflow_contract.py` compare les deux workflows à la base
EA-04 pour vérifier l'absence de neutralisation, suppression ou réordonnancement.

Le job qualité prépare :

1. Node 24.19.0, npm 10.9.2, Python 3.11 et les dépendances verrouillées avec `npm ci`.
2. `npm run ci:prepare`, limité au contexte GitHub/test : il écrit exclusivement une
   nouvelle configuration locale et démarre son propre conteneur PostgreSQL 17.11,
   limité à `127.0.0.1:55432`, base fictive `encave_foundation_test` et SCRAM.
3. La préparation exige une connexion et une requête SQL réelles avant de poursuivre.
   En cas d'échec, elle supprime seulement le conteneur dont elle a obtenu l'ID.
4. Playwright 1.63.0 et son Chromium (`npx --no-install playwright install --with-deps chromium`),
   puis une interaction clavier sur une page HTML synthétique.
5. Les tests d'outillage, le kit et **toutes les gates sélectionnées** par le
   contrôleur de périmètre existant. Aucun test absent ne devient un succès.

L'image officielle PostgreSQL est épinglée par digest de manifeste :
`sha256:67f41722b7a8cbdb868a44a4995c846eddfdc2973bccb291ce937dce88ad5675`.
Le tag 17.11 et ce digest ont été obtenus le 2026-09-09 depuis
[Docker Hub officiel](https://hub.docker.com/_/postgres), API publique du tag.
Il ne s'agit pas d'une image privée ni d'une dépendance de la marketplace.

Le mot de passe du service CI est une **fixture publique**, dérivée des identifiants
de run/tentative, uniquement pour ce conteneur jetable et ses données fictives.
Il n'est pas un secret de production. Aucune URL de base arbitraire ou credential
client n'est accepté par la préparation ; une configuration existante n'est jamais
écrasée. Le conteneur appartient au runner GitHub hébergé jetable ; la VM et ses
conteneurs sont supprimés après le job. Ce mécanisme n'est pas destiné à un runner
auto-hébergé persistant. Le fichier d'initialisation est retiré après préparation.
Les fichiers `.local/`, logs et
résultats de navigateur ne sont pas ajoutés au dépôt par cette procédure.

Les services conteneurisés GitHub nécessitent un runner Linux ; un job exécuté
directement sur le runner utilise le port publié sur localhost. Cette configuration
ne demande pas Docker au poste Windows. [Services PostgreSQL GitHub](https://docs.github.com/en/actions/tutorials/use-containerized-services/create-postgresql-service-containers).
La préparation utilise une étape Docker dédiée afin de préserver les tests existants
du contrat de maintenance, dont la fixture ajoute elle-même `services` et `env`
au niveau du job. Leurs assertions restent inchangées.
Playwright doit installer son navigateur et les dépendances système correspondantes
sur le runner. [Playwright en CI](https://playwright.dev/docs/ci).

## Contrôles locaux

Dans PowerShell, depuis la racine :

```powershell
. ./packages/tooling/activate.ps1
npm ci
npm run check:environments
node node_modules/@playwright/test/cli.js install chromium
npm run check:browser
npm run test:foundation-tooling
npm run check:foundation
```

PostgreSQL natif doit être démarré selon le guide local avant foundation. Ne pas
exécuter `ci:prepare` pour remplacer sa configuration : hors du job GitHub/test, la
commande échoue avant écriture. `check:browser` vérifie seulement la dépendance
navigateur ; il ne remplace pas `test:ux`, encore non configuré avant EA-05.

## Livraison

Les comptes rendus directs ne sont pas des attestations du contrôleur. Un changement
applicatif direct exige les suites complètes en CI, même pendant l'amorçage.
Unitaires, fonctionnelles, métier, E2E, UX et IA encore absentes échouent explicitement.
`foundation` démontre compilation, processus et SQL, pas un parcours métier.

La release réutilise le workflow qualité avec `force_product: true` et dépend de son
succès. Elle cible `preproduction` ou `production` via l'espace GitHub correspondant.
L'adaptateur `scripts/deploy.py` reste volontairement non configuré (code 2), sans
être modifié par EA-04. Aucun `AUTO_RELEASE` n'est activé par ce ticket. Avant EA-40,
aucune publication Git ni création d'espace ne vaut production déployée.
