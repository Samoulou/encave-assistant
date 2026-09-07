# ADR-0002 — Autorité produit de Sam et connecteurs réutilisables

Date : 7 septembre 2026. Statut : décision de cadrage autorisée par Sam, à appliquer avant les implémentations concernées.

## Contexte et origine du changement

Sam a explicitement précisé qu’il porte le produit, fixe son périmètre, ses priorités et sa politique de livraison. Julien et les autres interlocuteurs terrain peuvent apporter des retours ; leur approbation ou leurs accès ne doivent pas conditionner le développement. Sam demande également des intégrations réutilisables pour toute cave disposant d’une configuration supportée, sans développement spécifique à Julien.

Le backlog initial associait plusieurs livrables à un entretien, à une boîte Microsoft réelle et à un pilote de quatre semaines comprenant trente demandes. Cette hypothèse de commercialisation n’est plus une dépendance universelle du produit. Cette ADR formalise une évolution explicite des exigences avant implémentation ; elle ne transforme aucun test en succès ni aucun travail non réalisé en livraison.

## Décisions

1. **Autorité produit.** Sam définit les objectifs, priorités, fonctionnalités vendues et règles de livraison. Les agents exécutent les décisions et autorisations documentées ; ils peuvent résoudre les choix techniques réversibles dans ce cadre. Un prospect n’est pas une autorité d’approbation du dépôt.
2. **Retour terrain.** Entretiens, pilotes et observations clients servent à mesurer et améliorer la valeur. Leur absence n’empêche pas de formaliser des hypothèses explicites, de développer, de tester ou de livrer un périmètre techniquement prêt. Les résultats commerciaux ou les gains de temps ne peuvent être annoncés comme mesurés sans données réelles.
3. **Connecteurs génériques.** Le domaine dépend de contrats de connexion, de capacités, de messages et de calendrier indépendants du fournisseur. Microsoft est le premier adaptateur visé. Une nouvelle cave supportée configure son compte et ses ressources par onboarding, sans identifiants client dans le code ni redéploiement. Cette architecture ne signifie pas que tous les fournisseurs ou toutes les variantes de Microsoft sont déjà supportés.
4. **Isolation des connexions.** Compte, cave, jetons, permissions, ressources, abonnements, curseurs, santé et révocation sont rattachés à une connexion autorisée. Les opérations serveur revalident ce contexte. La révocation d’une cave n’affecte pas une autre cave.
5. **Accès fournisseur légitimes.** L’onboarding applique OAuth et les permissions requises par le mode Microsoft effectivement supporté. Un consentement administrateur éventuellement exigé par Microsoft reste une condition technique d’accès à cette connexion. L’autorité de Sam sur le produit ne permet pas de contourner les permissions d’un fournisseur ou d’accéder à un compte sans autorisation.
6. **Deux niveaux de preuve.** Les tests de contrat et les pannes simulées permettent le développement avec des données synthétiques. Une intégration réelle ne peut être annoncée comme qualifiée qu’après exécution sur un environnement autorisé, notamment un tenant de test géré par Sam. Les comptes ou données de Julien ne sont jamais requis par défaut.
7. **Activation bornée.** Une connexion ou capacité réelle non qualifiée demeure inactive. Le périmètre indépendant peut progresser et être livré avec ses propres tests réussis. L’échec ou l’absence d’un test requis pour une fonction ne devient pas une exclusion implicite : les fonctions activées et celles restant indisponibles sont documentées.
8. **Autonomie du développement et supervision métier.** Les validations A1 du caviste, l’accord sur la version exacte et l’autorisation de réserver restent des exigences produit. Elles sont distinctes des approbations de développement ou de lancement.

## Exigences modifiées avant implémentation

| Tickets | Évolution du contrat |
|---|---|
| EA-01 | Formalisation sous l’autorité de Sam ; volumes et canaux peuvent commencer comme hypothèses identifiées ; retours prospects facultatifs. |
| EA-02 | Contrat Microsoft générique et protocole de qualification ; les essais réels sont séparés et restent non exécutés si aucun environnement autorisé n’est disponible. |
| EA-03 | Décisions d’architecture et de lancement sous l’autorité de Sam ; suppression de la dépendance à EA-02 pour ces décisions indépendantes. |
| EA-04 | Dépendances explicites à EA-03, INIT-01 et DEV-01 pour réutiliser la fondation avant les environnements produit. |
| EA-13 à EA-16 | Contrats fournisseurs neutres, onboarding par cave, isolation des connexions, capacités explicites et séparation entre simulations et qualification réelle. |
| EA-35 | Rôle DB effectif testé ; qualification des permissions et capacités réelles avant activation du connecteur, sans bloquer les fonctions indépendantes. |
| EA-38 | Recette reproductible sous la responsabilité de Sam ; observation externe facultative ; onboarding d’une nouvelle cave sans redéploiement. |
| EA-39 | Recette technique et métier, préparation de la mesure de valeur ; durée et volume du pilote deviennent des options de mesure. |
| EA-40 | Production supervisée selon la politique de Sam, les tests requis et les capacités réellement qualifiées ; aucun accord de prospect requis. |

Les 40 identifiants EA sont conservés. INIT-01 et DEV-01 gardent leurs contrats propres dans `backlog/bootstrap.json`. Aucun ticket n’est marqué réalisé par cette migration.

## Exigences conservées

- Accord sur une ancienne proposition refusé, version commerciale immuable et autorisation A1 après accord exact.
- Protection transactionnelle contre les doubles réservations, tests de concurrence et absence de promesse d’exclusion atomique avec les saisies Outlook indépendantes.
- Isolation inter-caves des API, données, tâches, exports et connecteurs.
- Traitement durable des effets externes, idempotence, réconciliation des résultats incertains et absence de fausse confirmation.
- Tests unitaires, fonctionnels, métier, E2E et évaluations IA applicables ; corpus IA et cas critiques conservés. Une simulation ne prouve pas un fournisseur réel.
- Protection des données, sauvegarde/restauration, coupe-circuit, contrôle des accès et absence de défaut critique connu sur le périmètre lancé.
- Critères d’acceptation définis avant implémentation, review indépendante et preuves rattachées au code livré.

## Traçabilité

Le référentiel précédent est conservé octet pour octet dans [source-v1.json](../../backlog/archive/source-v1.json).

Empreinte SHA-256 de l’archive : `5df276c2bd69ebf7bfbb5b6a16f7e31d73fe879cf2ba90d050f443ee757a067f`.

Le référentiel courant devient [source.json](../../backlog/source.json), version 1.1. Les tickets exécutables sont synchronisés dans [tickets.json](../../backlog/tickets.json). Le validateur continue de comparer leurs critères et dépendances au référentiel courant. L’archive constitue la preuve du changement autorisé, pas une seconde liste de conditions actives.

Cette ADR ne fournit aucune preuve de connexion Microsoft réelle, d’essai modèle, de pilote client ou de mise en production. Les preuves futures doivent consigner ce qui a effectivement été exécuté et les capacités activées.
