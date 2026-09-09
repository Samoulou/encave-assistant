# EA-07 — Livraison vérifiée

Observation après push : 2026-09-09 11:02:32 UTC (13:02:32 Europe/Zurich).
Commit intégré à main : `1b9f250a8f36ee03a8d20ab27b8807d17936eb1f`.
Push sans force code 0 ; ls-remote retourne exactement ce SHA. Checkout propre.
Les 19 fichiers du manifeste ont été comparés aux blobs index puis commit,
hashes bruts ou LF conformes. Manifeste :
`3679a08f4049c9acc4dcc7c79cf2cfba6ae3cec362fe1aa03c96960fcaf0aa77`.

Deux reviews, une correction, budget de l’exécution respecté. Unit10, functional11,
business13, E2E10, outillage19, kit141, foundation SQL42 et runtime configuré passent.
Code livré, intégré et publié ; CI non conclue à cette observation, aucune
production déployée. Le ticket suivant admissible est EA-08.

Observation complémentaire pendant EA-08 : [Kit 34343418750](https://github.com/Samoulou/encave-assistant/actions/runs/34343418750)
réussi ; [Product 34343418792](https://github.com/Samoulou/encave-assistant/actions/runs/34343418792)
en échec ; [Release 34343419025](https://github.com/Samoulou/encave-assistant/actions/runs/34343419025)
ignoré. Les trois exécutions portent le SHA EA-07 ci-dessus. Unit10 et UX5 passent
à distance ; plusieurs tests SQL/E2E échouent de façon intermittente et la suite
d'évaluation IA reste absente. Le log local est conservé dans
`.agentic/ea07-remote-product-failure.log`.

Deux campagnes Linux sur le commit exact reproduisent une exception non
interceptée dans les tests existants ; le second diagnostic identifie une
terminaison de connexion par PostgreSQL. Les logs
`.agentic/ea07-linux-committed-suites.log` et
`.agentic/ea07-linux-committed-suites-errors.log` conservent ces échecs.
La correction et la régression du nettoyage des bases possédées sont traitées
dans EA-08 ; elles ne transforment pas rétroactivement cette CI en réussite.
