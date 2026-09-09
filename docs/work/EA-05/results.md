# EA-05 — Résultats observés

2026-09-09. Tâche directe Codex Desktop Windows, base
`fef9da7135a341312b782916c51fc9c271cb0bb7`. Dépendance EA-04 livrée avec review,
commit/push et SHA distant vérifiés ; sa CI est décrite séparément dans son dossier.

## Version examinée et gates

Manifeste avant seconde review : [checksums.json](checksums.json), SHA-256
`ad84d6744576b91dca424447d90833dea1f9fe7e30fc58f5a01f93a717aed0c6`.
Il référence les sources, décisions, première review, 34 PNG et leurs métadonnées,
ainsi que tous les logs de développement conservés localement. Les sources texte
possèdent empreintes brutes et normalisées LF pour la comparaison après commit Git.
Les PNG ne sont pas transformés. Résultats, statut et review finale sont exclus de
ce manifeste pour éviter une référence circulaire.

Mise à jour documentaire pendant la seconde review : README pointe désormais vers
le guide de lancement et décrit cette tranche. Le premier manifeste transmis avait
l’empreinte `a96c26ab33ac7e339673e48acf6a08a5898f712466fb18330a30ceec7879ab95` ;
le manifeste ci-dessus le remplace pour inclure README. Aucun code, test, log ou
PNG n’a changé ; seule cette documentation s’ajoute au périmètre examiné.

| Gate / contrôle | Commande réellement exécutée | Résultat | Log local |
|---|---|---|---|
| Installation propre | Activation Node 24.19.0/npm 10.9.2 ; `npm ci` | code 0 | `.agentic/ea05-install-final.log` |
| Kit | `wsl -d Ubuntu -u root -- python3 /mnt/c/tmp/encave-assistant/encave-assistant/.agentic/runs/ea05-controlled-kit.py` | code 0, 141 tests, 50,438 s | `.agentic/ea05-kit-final.log` |
| Unitaires | `npm run test:unit` | code 0, 4 tests | `.agentic/ea05-unit-final.log` |
| API / fonctionnels | `npm run test:functional` | code 0, 4 tests, SQL et OIDC réels | `.agentic/ea05-functional-final.log` |
| Métier | `npm run test:business` | code 0, 5 tests | `.agentic/ea05-business-review-corrections.log` |
| E2E | `npm run test:e2e` | code 0, 5 tests, vrai Next/API/Chromium | `.agentic/ea05-e2e-final.log` |
| UX | `npm run test:ux` | code 0, 3 tests, 34 captures | `.agentic/ea05-ux-review-corrections.log` |
| Outillage préexistant | `npm run test:foundation-tooling` | code 0, 19 tests, aucun skip/TODO | `.agentic/ea05-tooling-final.log` |
| Fondation | `npm run check:foundation` | code 0, compilation, HTTP web/API, worker, vraie requête SQL 42, arrêt des processus | `.agentic/ea05-foundation-final.log` |
| Runtime configuré | `node packages/tooling/identity-demo.mjs --verify` après compilation | code 0, web 200, API session anonyme 401, nettoyage de ses ressources | `.agentic/ea05-runtime-final.log` |
| Refus suite absente | `npm run test:evals` | code 1 attendu ; IA non configurée, aucune réussite inventée | `.agentic/ea05-evals-unconfigured.log` |
| Intégrité du diff | `.venv/Scripts/python.exe .agentic/runs/ea05-evidence.py` | code 0 : 6 AC exacts dans l’ordre, aucun ancien test ni chemin protégé modifié | contrôles dans le manifeste |

Le wrapper kit conserve la mitigation WSL démontrée en EA-04 : sélection temporaire
de `hyperv_clocksource_msr` et arrêt de systemd-timesyncd dans le même processus,
puis exécution **du vrai `scripts/check_kit.py` inchangé comme sam_8**. Il restaure
TSC et NTP actif dans `finally`, attestés par le log. Root sert seulement au réglage
temporaire de l’horloge. Aucune campagne continuous native Windows, aucun contrôle
neutralisé. Les messages d’échec simulés dans certains tests négatifs du kit ne
sont pas des résultats des suites produit ; le verdict global est 141 tests OK.

## Couverture des six critères

- AC-01 : flux Authorization Code/PKCE, state lié au navigateur, nonce et signatures
  RS256 ; fautes de signature/issuer/audience/nonce/expiration/e-mail vérifié refusées.
  Cookie forgé, session expirée, callback rejoué, origine étrangère et CSRF absent
  refusés. Session SQL conservée après rechargement puis inutilisable après logout.
- AC-02 : invitation liée à e-mail/cave/rôle, mauvaise identité et rejeu refusés,
  acceptation persistée ; expiration/révocation et concurrence testées. Une invitation
  obsolète ne remplace pas un rôle actif ; nouvelle invitation explicite réactive
  un membre révoqué. Révocation coupe la cave A, conserve effectivement B pour la
  même identité ; deux révocations concurrentes gardent un administrateur actif.
- AC-03 : lecteur/opérateur privés des commandes sensibles côté API ; tests de rôle
  et cave injectés. L’interface lecteur expose ses limites et aucune commande admin.
- AC-04 : migration identités/caves/membres/sessions/flux/invitations/audit et seed
  fictif séparé, rôle applicatif effectif limité, interdictions SQL UPDATE cave et
  CREATE TABLE testées. Vrais runners fail-closed préservés, démarrage compilé testé.
- AC-05 : connexion, équipe et invitation passent par le serveur ; erreurs de
  connexion/session, contexte révoqué, clavier, boucle/retour de focus et dialogues
  sensibles exercés dans Chromium. Les captures sont examinées par l’agent distinct.
- AC-06 : UX-01, 13, 16, 17 et principes clavier/formulaire applicables couverts.
  Responsive 320/390/768/1440, vrais zooms 200/400 %, contrôles de débordement, cibles
  44 px et contraste effectif. La preuve de zoom comporte plusieurs vues verticales
  qui se recouvrent jusqu’en bas, sans tronquer le viewport à droite.

Matrice des états et empreintes des images : [ux-captures.json](ux-captures.json).
Les 34 [captures](captures/) sont versionnées pour que la review demeure consultable
depuis un autre clone. Identités uniquement synthétiques, aucun bearer token visible.
Les logs détaillés et les versions intermédiaires restent locaux et hachés.

## Corrections et budget

Exécution 1, ouverte à 10:43 Europe/Zurich, échéance 12:43 ; trois tentatives de
correction maximum, huit appels d’agents et 20 minutes par appel. Aucun contrôleur
simulé. Les diagnostics de construction/test précèdent la première review ; leurs
échecs sont conservés sans les réétiqueter comme réussites ou nouveaux tickets.

Diagnostics initiaux : résolution de redirections relatives dans le navigateur
HTTP de test ; demande explicite des claims ID token ; consentement de fixture ;
origine des formulaires OIDC ; sélecteur d’alerte Next trop large ; snapshots pris
avant les commandes concurrentes ; tolérance d’arrondi du vrai zoom ; boucle clavier
du dialogue. Les assertions métier/security restent exigées, aucun ancien test
n’est changé. La première tentative de lancement via fonction npm PowerShell a
perdu `--verify` et a été interrompue après démarrage : ce n’est pas une preuve de
nettoyage. Ses seules ressources identifiées ont ensuite été nettoyées explicitement
par le helper borné et le log `.agentic/ea05-runtime-cleanup.log`, sans afficher de
secret. L’appel direct Node final prouve le démarrage et le nettoyage normaux.

Premier appel de review : [review-01.json](review-01.json), agent distinct
`/root/review_ea05`, lecture seule, **changes_requested**. 16 anciennes captures
inspectées : 14 vues lisibles, deux PNG zoom tronqués et preuves invitation manquantes.

Première tentative de correction après review : R1 sélecteur accessible avec une
seule cave restante + preuves API/E2E ; R2 quota par navigateur signé et mémoire
bornée + refus de budget partagé démontré via Next ; R3 refus d’appartenance déjà
active sous verrou SQL + test négatif et réactivation positive ; R4 capture CDP du
viewport avec défilement ; R5 états d’invitation et dialogue/récupération mobile.
Toutes les gates applicables ci-dessus passent sur ces sources. Seconde review
indépendante demandée sur le manifeste figé ; aucun pass n’est présumé ici.

Seconde review achevée : [review-02.json](review-02.json), verdict **pass**,
AC-01 à AC-06, toutes les empreintes vérifiées et les 34 PNG inspectés, y compris
les douze vues zoom. Aucun défaut supplémentaire. Deux appels de review et une
tentative de correction après review, dans l’exécution 1 ; prêt pour commit/push
normal. Le SHA de livraison et l’état CI observé seront consignés séparément.

## Portée de livraison

La fixture OIDC signe réellement les jetons mais choisit des identités fictives sans
authentification de production. La qualification Keycloak/Microsoft et l’exposition
réelle ne sont pas réalisées. Le guide [identité](../../development/identity.md)
et [ADR-0006](../../decisions/ADR-0006-identite-et-recette-navigateur.md) décrivent
configuration, migration, rôle SQL et limites du quota mémoire derrière l’ingress.
RLS/exports/tâches : EA-06 ; schéma commercial : EA-07 ; sécurité opérationnelle :
EA-35. Aucune CI EA-05 ni production n’est déclarée avant preuve correspondante.
