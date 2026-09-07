# ADR-0004 — Campagne continue et conception UX/UI

Date : 2026-09-07. Statut : maintenance autorisée par Sam avant développement.

## Demande et autorité

Sam demande que l’agent poursuive le développement selon le processus convenu, sans intervention entre chaque tâche, et que l’UX/UI soit analysée. Cette décision complète ADR-0000 et ADR-0002. Elle autorise les choix techniques réversibles dans le périmètre, la review indépendante et la publication des commits vérifiés sur le dépôt déjà autorisé. Elle ne crée aucun accès fournisseur, abonnement payant ou consentement client.

## Campagne

`scripts/continuous.py` devient l’entrée recommandée pour le contrôleur : tous les 42 tickets du plan, dépendances respectées, formalisation avant code, tests applicables, review distincte, corrections bornées, intégration puis push vérifié sans force. Aucun accord de Sam ou Julien n’est demandé entre deux tickets. Un ticket bloqué conserve ses preuves ; les tickets indépendants continuent. `autopilot.py` reste disponible pour une série volontairement limitée.

Le plan et la politique sont figés au démarrage. Le checkpoint conserve les tentatives et les appels consommés ou réservés avant interruption. Les limites initiales sont 126 exécutions de tickets, 336 appels, sept jours calendaires et trois exécutions par ticket ; les limites internes du contrôleur restent applicables. Ce sont des bornes d’exécution, pas un plafond monétaire fournisseur. Elles ne se réinitialisent pas à chaque reprise. Une exécution incertaine, une divergence Git ou un accès manquant ne devient pas un succès.

`complete` exige les preuves historiques vérifiées pour tous les tickets du plan. Cela ne signifie pas « production déployée ». La publication est distincte des contrôles GitHub et du déploiement ; la campagne ne surveille pas leurs résultats distants. Une livraison réelle doit conserver sa propre preuve de qualité, de déploiement, de migration et de santé.

## Maintenance prévue, sans dérogation improvisée

EA-04 peut configurer exclusivement les workflows qualité produit et release ; EA-40 peut modifier le script de déploiement et le workflow release. Les chemins sont accordés à ces seuls IDs dans une liste protégée. Les fichiers ne peuvent pas être supprimés ; le câblage obligatoire de qualité et de livraison doit rester vérifié. Les instructions, contrôleurs, contrats, anciennes preuves et anciens tests restent protégés. Toute autre évolution du cadre exige une maintenance explicite ; un échec ne donne pas le droit de réduire les contrôles.

L’applicabilité CI est cumulative à partir des livraisons attestées : fondation après DEV-01, suites métier après le premier ticket de code, UX sur les tickets concernés et évaluations sur les fonctions IA. Une modification applicative sans attestation impose les suites complètes. Une release les force toujours. EA-05/EA-06 incluent le schéma minimal identité/cave nécessaire pour tester réellement leur tranche ; EA-07 complète le domaine. Aucun test produit absent ne devient vert par déclaration.

## UX/UI et critères avant code

La documentation précédente décrivait les écrans fonctionnels sans conception visuelle détaillée ni recherche utilisateur démontrée. La nouvelle référence est `docs/product/11-ux-ui-et-design.md`, accompagnée de tokens et de trois maquettes SVG dans `docs/design/`. Elle définit parcours, états, responsive, clavier, actions sensibles et 18 critères vérifiables. Les maquettes sont conceptuelles ; elles ne prouvent pas une application ni une validation auprès de clients.

Le backlog passe de v1.1 à v1.2 ; la source précédente est conservée dans `backlog/archive/source-v1.1.json`. Les 40 IDs EA et les deux tickets techniques sont conservés. Des critères sont ajoutés aux tickets de démarrage, CI, livraison et interface ; aucun critère n’est retiré. Les 17 tickets UI portent `requires_ux` et la gate `ux`. EA-05 doit rendre `npm run test:ux` réellement exécutable, avec navigateur, vérification des états et captures examinées par la review indépendante.

## Limites observables

Ce changement prépare l’exécution : aucun ticket produit n’est déclaré terminé, aucun modèle réel ou compte Microsoft n’est testé ici. Le processus doit tourner sur une machine dédiée avec CLI authentifié, Git autorisé et services de test disponibles. Sam garde la main via arrêt, reprise et politique initiale. Les engagements commerciaux restent supervisés par le caviste en A1.
