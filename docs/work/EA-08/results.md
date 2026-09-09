# EA-08 — Résultats observés

Tâche directe Windows sur base `1b9f250a8f36ee03a8d20ab27b8807d17936eb1f`.
Node 24.19.0/npm 10.9.2 activés ; PostgreSQL 17.11 réel sur loopback avec bases
synthétiques possédées et login applicatif distinct. Navigateur Chromium,
Next/API et fournisseur OIDC synthétique réels. Aucun accès Microsoft ou IA.

| Commande exécutée | Résultat | Log local ignoré |
|---|---|---|
| `npm ci` | code 0, installation verrouillée propre | `.agentic/ea08-install-final.log` |
| `npm run test:unit` | 12 tests, 5 fichiers, code 0 | `.agentic/ea08-unit-final.log` |
| `npm run test:functional` | 17 tests, 5 fichiers, code 0 | `.agentic/ea08-functional-final.log` |
| `npm run test:business` | 17 tests, 4 fichiers, code 0 | `.agentic/ea08-business-final.log` |
| `npm run test:e2e` | 12 tests, 4 fichiers, code 0 | `.agentic/ea08-e2e-final.log` |
| `npm run test:foundation-tooling` | 19 tests, code 0 | `.agentic/ea08-foundation-tooling-final.log` |
| `npm run check:foundation` | compilation, web/API/worker et SQL42, code 0 | `.agentic/ea08-foundation-final.log` |
| `node packages/tooling/identity-demo.mjs --verify` | runtime, worker et nettoyage, code 0 | `.agentic/ea08-runtime-final.log` |
| `python3 scripts/check_kit.py` via helper WSL contrôlé | 141 tests en 53,518 s, code 0 | `.agentic/ea08-kit-final.log` |

Le kit est exécuté comme sam_8 sous Ubuntu WSL, horloge Hyper-V MSR temporaire
dans le même processus ; horloge tsc et service NTP actif restaurés après exécution.
Les sorties FAIL/NON CONFIGURÉ générées par ses tests négatifs ne sont pas une
preuve de suites produit manquantes dans ce ticket : les gates réelles figurent
séparément ci-dessus. Aucun lancement natif Windows de continuous.py.

## Couverture et correction 1

AC-01 : graphes exacts, refus de cible/arête, rôle, CSRF, origine, cave et référence
étrangère ; aucun historique après refus. Services commerciaux fermés sans leurs
préconditions. Test SQL d'échec d'insertion d'événement : HTTP503 et rollback du
compteur, de l'état et de la commande. FK des quatre types d'objet, rattachement
exact commande/événement et refus UPDATE/DELETE sous login applicatif réel.

AC-02 : mise à jour concurrente depuis deux sessions distinctes, un succès et un
conflit ; un seul événement. Rejeu identique et concurrent, conflit de charge,
versions invalides et compteur maximal. Après commande réussie : changement réel
de cave, passage lecteur en fixture ou révocation réelle par un autre admin
interdisent son rejeu, sans nouvel événement. Deux contextes navigateur constatent
le conflit, relisent le même état après reload et rejouent sans doublon.

AC-03 : quatre vocabulaires et graphes propres ; versions indépendantes, refus
de raccourcis commerciaux/fournisseur. Une sortie de brouillon fige les termes
sans changer leur empreinte ; chaque autre objet conserve son état/version.

La review préliminaire indépendante est conservée dans review-01.json. La
correction 1 ajoute ses preuves demandées, le rejeu concurrent et la borne entière.
Les dix tests ciblés passent dans `.agentic/ea08-correction1-targeted.log` avant
les suites complètes finales. Aucun ancien test ni exigence n'a été modifié.

## Course de nettoyage PostgreSQL

EA-07 reste livré avec CI Product en échec, comme l'indique son rapport. Deux
campagnes Linux de trois répétitions sur ce commit exact reproduisent une
exception non interceptée dans un ancien test ; le diagnostic à messages fermés
identifie « terminating connection due to administrator command ». Aucun message
arbitraire, identifiant de connexion ou secret n'est imprimé par ce diagnostic.

Le nouveau test `fixture-cleanup.test.mjs`, exécuté avant correction, constate
des erreurs sur une connexion en cours de fermeture avec DROP DATABASE FORCE :
code 1 dans `.agentic/ea08-cleanup-before-correction.log`. Après correction,
attente bornée des connexions puis DROP sans FORCE, il passe. L'outillage conserve
la base si les connexions persistent ; il ne neutralise pas leurs erreurs.

Le helper de préparation construit depuis le blob EA-07 une variante ne changeant
que l'import de temporisation et la fonction cleanup, puis vérifie le retour exact
au blob d'origine en annulant ces deux substitutions. Empreinte de cette variante :
`328359751481227110e5d3b16688e879b0631ec3ed51581ad8d2af58a8d24d58`.
Sous Linux, trois répétitions complètes des anciennes suites functional11 et
business13 passent avec cette seule correction (72 cas au total), code 0 dans
`.agentic/ea08-linux-cleanup-correction.log`. Les tests existants restent identiques.
Horloge et NTP restaurés. Ce résultat soutient la cause identifiée ; il ne prouve
pas que toute panne CI future est exclue et ne change aucun ancien résultat distant.

## Limites et version

UX non applicable : aucun code d'interface changé ; les E2E existants passent.
Pas de capture artificielle. Évaluations IA non applicables à EA-08 et non
déclarées réussies. Les workflows A1, effets externes et interfaces métier restent
leurs tickets dépendants. La migration v4 doit être explicitement ciblée ; l'API
du runner sans option reste à v3, sans modifier ses tests historiques.

Manifeste, seconde review et livraison Git lient les preuves à la version livrable.
Les SHA publiés et résultats CI seront observés après publication ; aucune
production n'est déduite d'un succès local.
