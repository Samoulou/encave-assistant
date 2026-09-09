# EA-04 — Résultats et livraison

Date : 2026-09-09. Base : `f5cc92c249370b51e773bea2ae704c0881a65968`.
INIT-01, DEV-01 et EA-03 sont livrés, revus et publiés avec SHA vérifié.

| Contrôle | Commande / résultat observé |
|---|---|
| Installation propre | Activation PowerShell Node 24.19.0/npm 10.9.2 puis `npm ci` : code 0, 55 packages installés, audit 63 packages, zéro vulnérabilité annoncée par npm |
| Outillage final | `npm run test:foundation-tooling` : code 0, 19/19 tests, aucun skip/TODO ; log `.agentic/ea04-tooling-final.log` |
| Fondation finale | `npm run check:foundation` : code 0, TypeScript/Next, HTTP web/API, signal worker, SQL réel 42, processus arrêtés ; `.agentic/ea04-foundation-final.log` |
| Navigateur technique | Installation de Chromium via CLI Playwright verrouillée puis `npm run check:browser` : code 0, vrai Chromium et interaction clavier sur HTML fictif ; `.agentic/ea04-browser-install.log`, `.agentic/ea04-browser.log` |
| Plans d'environnement | `npm run check:environments` : code 0 ; noms et frontières distincts, plans distants inactifs |
| Refus local | `npm run ci:prepare` hors CI : code 1 attendu avant écriture ; `.agentic/ea04-local-ci-refusal.log` |
| Intégrité documentaire/CI | Contrat workflow comparé à la base pour les deux fichiers : pass ; 4 AC exacts, 15 commandes npm existantes identiques, 2 liens locaux, aucun ancien test modifié ; `.agentic/ea04-contract-check-final.log` |
| Espaces GitHub | Création puis lecture des métadonnées development/preproduction/production : code 0, IDs distincts ; `.agentic/ea04-github-environments.log`. Aucun secret créé. Variable de dépôt AUTO_RELEASE absente au contrôle |

Les tests Docker d'outillage injectent un exécuteur simulé pour vérifier les arguments,
la vérification SQL attendue et le nettoyage du seul conteneur créé. Ils ne prouvent
pas l'exécution Docker sur le poste Windows, dont le moteur est arrêté. La vraie
requête SQL locale ci-dessus utilise PostgreSQL natif. L'exécution du conteneur sur
le runner Linux sera observée en CI après publication, sans la présumer réussie.
Le contrôle Chromium technique ne vaut pas `test:ux` produit.

## Gate kit et corrections

Commande inchangée :
`wsl -d Ubuntu -- env PYTHONPATH=/mnt/c/tmp/encave-assistant/encave-assistant/.agentic/runs/wsl-python python3 /mnt/c/tmp/encave-assistant/encave-assistant/scripts/check_kit.py`.

1. `.agentic/ea04-kit.log` : code 1, 141 tests, une erreur du contrat workflow.
   La fixture existante remplace `jobs.product.services/env` pour tester les ajouts,
   ce qui devient incompatible avec leur configuration préalable. Correction :
   conserver ces sections absentes et préparer le conteneur via une étape dédiée,
   avec mêmes image/port/SCRAM/SQL et nettoyage borné. Aucun ancien test modifié.
2. `.agentic/ea04-kit-retry1.log` : code 1, deux erreurs « Horodatage de campagne
   invalide » dans les tests `test_status_complete_rejects_deleted_controller_state_without_writing`
   et `test_ticket_run_budget_survives_explicit_retries`. Les tests de workflow ont
   passé. Cause racine d'horodatage inconnue ; le code/les tests du kit sont inchangés.
3. `.agentic/ea04-kit-retry2.log` : code 1, 141 tests, une erreur « Horodatage de
   campagne invalide » dans `test_block_before_state_creation_is_recorded_once`.
   Relance inchangée. Trois passages du kit effectués ; aucun quatrième passage
   pour chercher un résultat vert. La gate requise reste en échec.

Les résultats intermédiaires (outillage 17/17 et foundation avant correction) restent
dans les logs locaux ; les versions finales ci-dessus priment pour les sources livrées.
Une correction de mise en œuvre, puis une relance sans modification du kit. Aucune
campagne réelle ni suppression de gate. Review indépendante encore à réaliser.
Livraison bloquée : conserver le diff sans commit de ticket réussi ni publication.
Le contrôle des dépendances des 42 tickets ne trouve plus aucun autre ticket
admissible : EA-05 dépend d'EA-04 et toutes les branches restantes en dépendent
transitivement. Les cinq tickets précédents restent livrés avec leurs preuves.

## Couverture et limites

AC-01 : dépendances publiques et workspaces propres, aucun import de la marketplace
ou lecture de secrets. AC-02 : lockfiles et versions conservés, Playwright 1.63.0
ajouté, guide Windows/CI. AC-03 : espaces GitHub créés et déclarations séparées,
aucun hébergement Azure provisionné. AC-04 : seules les étapes de préparation du
workflow qualité ont changé ; release et toutes les gates obligatoires conservées.

Les suites produit/IA/UX encore absentes échouent ; aucune attestation du contrôleur
créée. `scripts/deploy.py` reste bloquant et inchangé. La CI distante, le
provisionnement Azure, l'identité OIDC et les fournisseurs réels restent des preuves
séparées. Ce ticket ne constitue ni un parcours produit terminé ni une production.
