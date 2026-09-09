# EA-06 — Résultats observés

Exécution directe Windows, base `008edb83b3fbb863f93b201ab02c53cda9200b0f`.
Node 24.19.0/npm 10.9.2 sélectionnés par `packages/tooling/activate.ps1`.
PostgreSQL 17.11 réel, bases synthétiques isolées, rôle applicatif réel distinct
du propriétaire. OIDC signé de test et navigateur Chromium réel ; pas de service
Microsoft, de compte prospect, d’évaluation IA ou de production déduits.

| Commande | Résultat final | Log local ignoré |
|---|---|---|
| `npm ci` | code 0 | `.agentic/ea06-install-final.log` |
| `npm run test:unit` après correction 2 | 8 tests, 3 fichiers, code 0 | `.agentic/ea06-unit-correction2.log` |
| `npm run test:functional` | 7 tests, 2 fichiers, code 0 | `.agentic/ea06-functional-final.log` |
| `npm run test:business` | 9 tests, 2 fichiers, code 0 | `.agentic/ea06-business-concurrent-final.log` |
| `npm run test:e2e` | 8 tests, 2 fichiers, code 0 | `.agentic/ea06-e2e-final.log` |
| `npm run test:ux` | 5 tests, 2 fichiers, code 0 | `.agentic/ea06-ux-final.log` |
| `npm run test:foundation-tooling` après correction 2 | 19 tests, code 0 | `.agentic/ea06-tooling-correction2.log` |
| `npm run check:foundation` | compilation, HTTP web/API, worker et SQL42 ; code 0 | `.agentic/ea06-foundation-final.log` |
| `node packages/tooling/identity-demo.mjs --verify` après installation propre | API/web/OIDC et worker configuré prêts, ressources possédées arrêtées ; code 0 | `.agentic/ea06-runtime-clean-install.log` |
| Kit réel sous WSL, helper `ea06-controlled-kit.py` | 141 tests, 52,693 s, code 0 | `.agentic/ea06-kit-final.log` |

Le helper de kit applique temporairement l’horloge Hyper-V MSR et arrête NTP dans
la même session WSL, exécute les contrôles comme `sam_8`, puis restaure TSC et NTP
actif dans `finally`. Tentative kit 1 de cette exécution. Ce n’est pas le lancement
de continuous.py sous Windows. Les échecs simulés dans les tests du kit font
partie de ses assertions ; seul son résultat final couvre l’intégrité du kit.

## Couverture des critères

- AC-01 : caves A/B indépendantes, identité multi-caves et deux membres homonymes
  Camille Test avec courriels distincts ; API/export ne sélectionnent pas par nom.
- AC-02 : contexte partagé session/CSRF/cave/rôle, téléchargement lié au demandeur,
  worker rechargeant les droits. Refus 403/404/409 des locateurs étrangers, faux
  champs client/modèle refusés, révocation après mise en file et réinvitation
  n’autorisant pas un ancien export. Réponse tardive et téléchargement A retenu
  pendant changement vers B vérifiés dans le navigateur.
- AC-03 : login SQL applicatif effectif ; références composites croisées refusées
  (23503), DDL/désactivation de triggers refusés (42501), rôle propriétaire rejeté
  au démarrage. Les mutations de fixtures ne sont pas des preuves de droits.
- AC-04 : migration additive 002, création idempotente, résultats durables, mort
  du vrai worker pendant attente de verrou puis reprise par un autre processus.
  Deux prises de travail SQL concurrentes ne produisent qu’un résultat.
- AC-05 : panneau vide, attente, prêt, expiration, refus, chargement et erreur ;
  clavier et focus, mobile 320/390, 768/1440 et zoom réel 200/400 %. Les anciennes
  suites identité sont exécutées sans modification. Captures originales et
  mesures figurent dans `ux-captures.json`, review finale distincte requise.

## Corrections et limites

Review préliminaire changes_requested conservée dans `review-01.json`.
Correction 1 : ignorer le GET antérieur à une création, retirer immédiatement le
bouton après 410, ajouter les homonymes, compléter gates et captures. Tests E2E
observables ajoutés pour les deux courses UI. Erreurs de développement conservées :
typage exact d’une option facultative et attente UX incompatible avec un chargement
volontairement retenu ; seuls le code et le nouveau test ont été corrigés.

CSV borné à 5 000 membres/1 Mio, rétention serveur par défaut 3 600 s configurable
de 60 à 86 400 s. Références stables, transaction locale unique ; aucun effet réseau
du worker. RLS facultatif n’est pas revendiqué : le login serveur global n’isole
pas les caves si ce login est compromis. Les entités commerciales sont EA-07.

Review 2 : AC-01 à AC-05 et les 46 captures examinés ; unique défaut restant dans
le nouveau diagnostic, qui acceptait une pseudo-coordonnée contenue dans une URL.
Correction 2 : seul l’emplacement terminal d’une frame est examiné ; il doit être
un fichier source existant sous la racine réelle du dépôt. URL externe, query,
nom de fonction trompeur, fichier absent, chemin externe et non-source sont refusés.
Le test ajouté et les huit unitaires passent, ainsi que les 19 tests d’outillage
qui contrôlent notamment les verdicts du runner. La compilation TypeScript passe.
Aucun code produit ni capture modifié après les gates produit et la review 2 ;
les gates métier/navigateur/kit ne sont donc pas répétées pour ce diagnostic seul.
Le manifeste de la review 2 est préservé dans `checksums-review02.json`.

L’échec UX distant EA-05 n’est pas reproduit sur le commit exact sous Linux : voir
son rapport de livraison. Le reporter ajoute uniquement les positions source des
échecs, avec test de non-divulgation ; verdicts et anciens tests sont préservés.
Les suites IA absentes demeurent non configurées et non applicables à EA-06 ;
elles ne sont pas présentées comme réussies. CI du futur commit et déploiement
ne sont pas déduits de ces gates locales.
