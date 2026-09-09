# EA-05 — Livraison vérifiée

2026-09-09, observation d’horloge 09:41:36 UTC (11:41:36 Europe/Zurich) après push.

Commit sur main : `008edb83b3fbb863f93b201ab02c53cda9200b0f`.
`git push origin main` : code 0, sans force ; `git ls-remote origin refs/heads/main`
retourne exactement ce SHA. Checkout propre après commit/push.

Le ticket est livré localement, intégré à main et publié sur le dépôt distant.
Les gates locales et la review indépendante pass sont conservées dans ce commit,
avec 34 captures et manifeste `ad84d6744576b91dca424447d90833dea1f9fe7e30fc58f5a01f93a717aed0c6`.
Les 76 fichiers du manifeste ont été comparés aux octets réellement committés,
avec normalisation LF documentée pour le texte : correspondance intégrale.

La minute 11:43 indiquée dans le statut préparatoire était une indication erronée
de rédaction ; l’observation ci-dessus date la livraison effective. Les deux reviews
et l’unique correction ont eu lieu dans l’exécution 1, ouverte à 10:43, avant 12:43.

CI distante : pas encore conclue à cette observation ; elle reste à examiner.
La suite IA demeure explicitement non configurée : son absence n’est pas exemptée
par le dossier de tâche directe. Aucun déploiement ni qualification Keycloak ou
Microsoft n’est déclaré. La suite du développement est EA-06, dépendant d’EA-05.

Observation CI ultérieure sur ce SHA : [Kit integrity](https://github.com/Samoulou/encave-assistant/actions/runs/34336125091)
réussi ; [Product quality](https://github.com/Samoulou/encave-assistant/actions/runs/34336125088)
en échec ; [Release](https://github.com/Samoulou/encave-assistant/actions/runs/34336125526)
skipped. Les logs corroborent foundation SQL42, unit4, functional4, business5, E2E5.
Deux tests UX passent ; le test responsive/zoom échoue sous Linux et le runner ne
publie pas le détail de son assertion. Il reste à diagnostiquer : ne pas extrapoler
le succès Windows à ce runner Linux. La suite IA absente échoue aussi. Aucun artefact
de capture n’a été retourné par l’API des artefacts de ce run. Log local conservé :
`.agentic/ea05-remote-product-failure.log`. Livraison locale vérifiée et CI globale
échouée sont deux faits distincts ; aucune modification d’ancien test pour masquer
cet échec n’est autorisée pendant EA-06.

Investigation ultérieure : le test responsive/zoom du commit exact `008edb8`
passe dans une copie Linux isolée obtenue par `git archive`, avec Node 24.19.0,
PostgreSQL 17.11, installation npm propre et les dépendances Chromium présentes.
Le cluster synthétique a été créé séparément ; aucun secret Windows n’a été copié.
La socket PostgreSQL est placée dans le répertoire possédé par l’utilisateur.
Log réel : `.agentic/ea05-linux-committed-ux-socket.log` (un test, code 0).
Cette non-reproduction ne résout pas la cause du run GitHub en échec. EA-06 ajoute
au reporter les seules coordonnées source des assertions, sans leurs valeurs,
pour rendre une prochaine occurrence observable. Aucun ancien test n’est changé.
