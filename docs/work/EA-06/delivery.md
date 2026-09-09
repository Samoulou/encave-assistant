# EA-06 — Livraison vérifiée

Observation après push : 2026-09-09 10:36:48 UTC (12:36:48 Europe/Zurich).
Commit intégré à main : `1d4f3da84c28af1a2ba8adee6865c0649261e2b4`.
`git push origin main` code 0 sans force ; `git ls-remote origin refs/heads/main`
retourne ce SHA exact. Checkout propre après publication. Les 91 fichiers du
manifeste final ont été comparés aux blobs de l’index puis du commit : hashes
bruts ou LF conformes. Manifeste :
`5f5a2a3376b21f604ad58efa53f1f06f2cd8eb58ad348fd333e33d3c8a9233c3`.

Trois reviews indépendantes, deux corrections, délai et budgets respectés.
Unit8, functional7, business9, E2E8, UX5, outillage19, kit141, foundation et
runtime configuré réussis ; 46 captures examinées. Voir results et review-03.
Code livré localement, intégré et publié ; CI encore non conclue à cette
observation, production non déployée. Aucun fournisseur réel qualifié.
La suite admissible est EA-07, après cette preuve d’EA-06.

Observation CI ultérieure : [Kit integrity](https://github.com/Samoulou/encave-assistant/actions/runs/34341141420)
réussi ; [Product quality](https://github.com/Samoulou/encave-assistant/actions/runs/34341141474)
échoué ; [Release](https://github.com/Samoulou/encave-assistant/actions/runs/34341141441)
skipped. E2E8 et UX5 passent ; deux échecs dans les tests functional/homonymes et
business/arrêt-reprise du worker, sans coordonnée source exploitable dans ces
erreurs. La suite IA absente échoue aussi. Aucun succès global n’est déclaré.

Les deux tests exacts du commit `1d4f3da` passent ensuite dans une copie Linux
isolée, Node24.19.0/PostgreSQL17.11, installation npm propre et horloge MSR
temporaire restaurée. Log `.agentic/ea06-linux-committed-diagnostic-ubuntu.log`,
deux tests, code 0. Cette non-reproduction ne résout pas la cause distante.
Le premier appel WSL a utilisé un nom de distribution inexistant ; son échec est
conservé séparément et n’est pas un résultat de test. Aucun ancien test modifié.
