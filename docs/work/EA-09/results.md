# EA-09 — Résultats observés

Tâche directe Windows, base `c23cb08719d68cf1753365e534c865f73479bbb1`.
Node 24.19.0/npm 10.9.2 activés ; PostgreSQL 17.11 sur loopback avec login
applicatif distinct du propriétaire de migration. Données fictives, OIDC
synthétique, vrai HTTP/API/Next et navigateur Chromium. Aucun accès Microsoft/IA.

| Commande exécutée | Résultat | Log local ignoré |
|---|---|---|
| `npm ci` | code 0, installation verrouillée propre | `.agentic/ea09-install-final.log` |
| `npm run test:unit` | 15 tests, 6 fichiers, code 0 | `.agentic/ea09-unit-final.log` |
| `npm run test:functional` | 22 tests, 6 fichiers, code 0 | `.agentic/ea09-functional-final.log` |
| `npm run test:business` | 22 tests, 5 fichiers, code 0 | `.agentic/ea09-business-final.log` |
| `npm run test:e2e` | 14 tests, 5 fichiers, code 0 | `.agentic/ea09-e2e-final.log` |
| `npm run test:foundation-tooling` | 19 tests, code 0 | `.agentic/ea09-foundation-tooling-final.log` |
| `npm run check:foundation` | compilation, web/API/worker, SQL42, code 0 | `.agentic/ea09-foundation-final.log` |
| `node packages/tooling/identity-demo.mjs --verify` | runtime, worker et nettoyage possédé, code 0 | `.agentic/ea09-runtime-final.log` |
| `python3 scripts/check_kit.py` via helper WSL contrôlé | 141 tests en 52,505 s, code 0 | `.agentic/ea09-kit-final.log` |

Kit exécuté comme sam_8 sous Ubuntu WSL avec horloge Hyper-V MSR temporaire,
puis restauration tsc/NTP. Ses scénarios négatifs produisent volontairement
certains libellés FAIL ; sa sortie finale est code 0 et KIT VALIDE. Les suites
produit sont exécutées séparément, comme ci-dessus. Aucun continuous.py natif.

## Couverture observable

AC-01 : schéma fermé, capacité/durée/unités CHF/taxes exactes, null distinct du
prix zéro, bornes et incohérences refusées. Publication par admin réel, acteur
d'approbation persisté, révisions immuables sous login applicatif et propriétaire
SQL. FK inter-caves et entre fiches/version/approbation ; migration v4→v5 sans
perte et v3 par défaut préservé. Droits, CSRF, origine, cave et références étrangères
contrôlés en HTTP. La panne d'insertion du journal annule toute création.

AC-02 : prix absent, source absente/périmée/future, capacité/taxe inconnue et
types sur devis/information exclus par le garde et la liste de candidats. Gratuité
explicitement configurée admissible. Prix client substitué rejeté ; aucune
proposition ou réservation créée par cette simple sélection. Les montants/taxes
des fixtures sont fictifs, aucune règle fiscale réelle n'est présentée comme validée.

AC-03 : désactivation, rejeu, exclusion des candidats, refus d'ancienne sélection,
révision puis publication sans réactivation, réactivation distincte et conservation
des termes de proposition EA-07. Deux sessions révisant au même compteur obtiennent
un succès et un conflit ; la révision approuvée précédente n'est pas réécrite.

Le test ajouté après review prouve une concurrence de désactivation réelle : une
transaction propriétaire retient la ligne, la requête admin de désactivation
attend après acquisition du verrou de cave, puis une sélection d'une autre session
attend derrière elle. Les relations d'attente sont observées avec pg_blocking_pids,
sans se fier à un simple délai. Après libération : désactivation200, sélection409,
candidats vides et aucune proposition. Le test ciblé passe dans
`.agentic/ea09-correction1-targeted.log`, puis dans la suite métier finale.

Les E2E finaux (14 cas) prouvent la publication persistante après
redémarrage d'un vrai processus API, reload, désactivation depuis une autre session,
prix absent, lecteur et cave étrangère. Leur exécution finale est consignée dans
le tableau ci-dessus.

## Corrections et limites

Première review conservée dans review-01.json ; un seul constat de couverture
R1, traité en correction 1. Un échec initial de compilation dû au rétrécissement
d'une union TypeScript est conservé dans `.agentic/ea09-types-development.log` ;
le parsing explicite de la définition validée le corrige, sans assouplir le contrat.
Les huit premiers tests ciblés et toutes les suites de développement passent.
Aucun ancien test, migration publiée, instruction ou politique n'est modifié.

Catalogue limité et historique paginé selon le guide. Maintenance par API, aucune
nouvelle interface : UX non applicable au ticket. Évaluations IA non applicables
et non déclarées réussies. La CI EA-08 confirme toutes les suites produit présentes,
mais reste globalement en échec pour évaluations IA absentes ; ses résultats et
logs sont conservés dans son rapport de livraison. Ce constat ne devient pas une
CI verte ni un déploiement.

EA-18/19 devront réexécuter le garde dans leur transaction avant une proposition :
une réponse de sélection ne vaut jamais autorisation durable ou disponibilité.
Les preuves finales, manifeste et seconde review précèdent livraison Git normale.
