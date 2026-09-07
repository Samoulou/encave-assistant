# Backlog exécutable

- `source.json` : 40 contrats produit courants, pilotés par Sam.
- `bootstrap.json` : contrats INIT-01 et DEV-01 pour l’amorçage indépendant.
- `tickets.json` : 42 tickets ordonnés avec dépendances et contrôles applicables.
- `archive/source-v1.json` : ancienne référence, conservée pour tracer la révision demandée par Sam ; ne pas l’exécuter comme exigence courante.

Les critères sont définis avant le code. Le validateur vérifie les contrats courants et les dépendances ; aucun ticket n’est initialement terminé. INIT-01 constate l’environnement ; DEV-01 construit la fondation avec données fictives. Ces tickets ne valident pas les fonctionnalités EA.

Sam décide du périmètre, de la priorité et des conditions de lancement. Aucun prospect n’est un approbateur obligatoire. Une connexion réelle exige les droits du compte visé ; les tâches indépendantes et les tests simulés peuvent avancer sans ces accès, avec leurs limites explicites.

Voir [ADR-0002](../docs/decisions/ADR-0002-autorite-et-connecteurs.md), [START-HERE](../START-HERE.md) et [la roadmap](../docs/product/06-roadmap-lancement-business.md).
