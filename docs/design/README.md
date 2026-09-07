# Référence visuelle — EnCave Assistant

Ces fichiers documentent la cible UX/UI. Ils ne sont pas un prototype interactif, un site livré ou une preuve de fonctionnement. Les noms, montants, dates et compteurs des maquettes sont fictifs. La conception n’a pas encore été testée auprès d’utilisateurs.

La [spécification UX/UI](../product/11-ux-ui-et-design.md) décrit les écrans, les états, l’accessibilité et les 18 critères d’acceptation à implémenter. Sam possède les décisions de design ; aucun accord d’un prospect n’est requis.

| Fichier | Usage |
|---|---|
| [design-tokens.json](design-tokens.json) | Couleurs sRGB, typographie, espacements, tailles et 15 paires de contrastes calculées. Convention JSON propre au dépôt. |
| [01-demandes-desktop.svg](01-demandes-desktop.svg) | File de travail avec prochaine action, cave active et état des demandes. |
| [02-proposition-desktop.svg](02-proposition-desktop.svg) | Dossier, sources, termes versionnés et réservation supervisée après accord. |
| [03-accord-mobile.svg](03-accord-mobile.svg) | Page publique d’accord sur une version précise, sans compte ; la réservation n’est pas encore confirmée. |

Les SVG sont des maquettes statiques de structure. Leurs composants doivent être réimplémentés en HTML sémantique dans l’application, avec les vrais contrôles serveur, chargements, erreurs et comportements de clavier. Ils n’importent aucun code de la marketplace EnCave. Un changement de disposition peut être décidé dans un ticket s’il préserve les critères et sa review ; les maquettes ne justifient pas de réduire le périmètre métier.

Les valeurs de contraste proviennent du calcul WCAG de luminance relative sRGB, sans arrondi avant comparaison : `(L_clair + 0.05) / (L_foncé + 0.05)`. La vérification porte sur les paires définies, pas sur une application rendue. Les couleurs calculées, les limites d’usage et les seuils figurent dans le JSON. Un contrôle au navigateur reste nécessaire après implémentation.

Pour chaque écran livré, produire les captures réelles des états applicables sur ordinateur et téléphone, les tests de parcours au clavier, les assertions d’accessibilité et la review indépendante. Ne pas remplacer ces preuves par les SVG. La [stratégie de tests](../agentic/04-strategie-tests.md) reste applicable.
