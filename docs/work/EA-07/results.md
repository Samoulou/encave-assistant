# EA-07 — Résultats observés

Tâche directe Windows, base `1d4f3da84c28af1a2ba8adee6865c0649261e2b4`.
Node 24.19.0/npm 10.9.2 via activate.ps1, PostgreSQL 17.11 sur loopback ; bases
fictives générées, propriétaire de migration distinct du login applicatif.
Navigateur Chromium/Next/API et OIDC synthétique réels ; aucune IA ou connexion
Microsoft, aucun accord client ou déploiement réel.

| Commande exécutée | Résultat | Log local ignoré |
|---|---|---|
| `npm ci` | code 0, installation verrouillée propre | `.agentic/ea07-install-final.log` |
| `npm run test:unit` | 10 tests, 4 fichiers, code 0 | `.agentic/ea07-unit-final.log` |
| `npm run test:functional` | 11 tests, 3 fichiers, code 0 | `.agentic/ea07-functional-review-correction.log` |
| `npm run test:business` | 13 tests, 3 fichiers, code 0 | `.agentic/ea07-business-final.log` |
| `npm run test:e2e` | 10 tests, 3 fichiers, code 0 | `.agentic/ea07-e2e-final.log` |
| `npm run test:foundation-tooling` | 19 tests, code 0 | `.agentic/ea07-tooling-final.log` |
| `npm run check:foundation` | compilation, web/API/worker, SQL42 et arrêt ; code 0 | `.agentic/ea07-foundation-final.log` |
| `node packages/tooling/identity-demo.mjs --verify` | API/web/OIDC, worker et nettoyage des ressources possédées ; code 0 | `.agentic/ea07-runtime-final.log` |
| `python3 scripts/check_kit.py` via helper WSL contrôlé | 141 tests en 49,970 s, code 0 | `.agentic/ea07-kit-final.log` |

Le kit est exécuté comme sam_8 sous Ubuntu WSL, avec horloge Hyper-V MSR temporaire
dans le même processus et NTP arrêté, puis TSC et NTP actif restaurés. Tentative
kit 1 de l’exécution 1 ; aucun continuous.py lancé sous Windows. Les simulations
d’échecs internes au kit ne sont pas des résultats des suites produit.

## Critères prouvés

- AC-01 : objets persistants et statuts distincts, instantanés hachés en SQL,
  termes figés malgré un retour de statut, plusieurs preuves sur une version,
  API de lecture et navigateur avec session/dossier conservés après redémarrage
  d’un vrai processus API compilé. Contrats refusant états et versions invalides.
- AC-02 : tests sous le login applicatif effectif pour chaque référence de
  message/proposition/version/accord/validation/réservation/action ; refus SQL
  23503 sans insertion partielle. Refus du message d’un autre dossier, d’une
  version/hash distincts et d’une action mélangeant réservation/version. DDL et
  suppression/réécriture des preuves refusés. Accès API et navigateur 401/404/409,
  lecture autorisée à Claire, aucune route de création offerte par les fixtures.
- AC-03 : migration seule laissant les tables métier vides, capacité interne de
  base possédée obligatoire pour le seed, copie de contexte sans capacité refusée,
  seed transactionnel/rejouable. Deux caves homonymes/références locales égales,
  UUID distincts et histoires propres. Aucun chargement de seed par les runtimes.

Migration fraîche réellement exécutée dans un schéma isolé d’une base possédée,
deux appels concurrents sérialisés, replay vide. Mise à niveau 001/002 vers003
conservant la cave préexistante. Une table de fixture volontairement conflictuelle
fait échouer003 : rollback complet, registre toujours1/2 et sentinelle42 conservée.
Ces mutations de scénario sont faites comme propriétaire de cette base de test ;
elles ne remplacent pas les refus sous le rôle applicatif.

## Review et correction

Review 1 changes_requested conservée. Correction 1 : libération du client même
lorsque pg_advisory_unlock échoue, destruction de la connexion cassée et deux
coquilles du guide. Nouveau test provoquant réellement pg_terminate_backend sur
la connexion possédée au déverrouillage : erreur57P01, pool sans client emprunté
ni attente, fermeture réussie. Les contrôles affectés et régressions passent.

Échecs de développement préservés : propriété de constructeur incompatible avec
le strip TypeScript natif de Node (corrigée dans le nouveau CaseStore), fermeture
des pools après suppression de leur base dans le nouveau test migration (ordre
corrigé), doublon d’idempotence masquant la FK visée dans la nouvelle fixture de
refus (clé distincte pour tester cette FK). Aucun ancien test ou exigence modifié.

## Limites et livraison

UI inchangée : UX non applicable dans le backlog EA-07 ; aucune capture artificielle.
Les E2E existants restent exécutés. IA et fournisseur non applicables et non
déclarés pass. Les transitions/validations/envois/baux et la pagination d’interface
restent les tickets suivants ; le guide documente les bornes et le registre
numérique historique des migrations. Ni RLS ni confinement d’un login serveur
compromis ne sont revendiqués.

Les échecs CI d’EA-06 et leur non-reproduction Linux sur le commit exact sont
conservés dans son rapport de livraison et les logs référencés. Ils ne deviennent
pas des succès distants. Manifeste et review finale rattachent ces preuves à la
version livrable ; le SHA Git et la CI du futur commit seront observés séparément.
