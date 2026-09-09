# ADR-0010 — Catalogue approuvé et versionné

2026-09-09, EA-09, décision technique réversible déléguée par Sam.
Base EA-08 `c23cb08719d68cf1753365e534c865f73479bbb1`, dépendance EA-07 livrée.

Les versions du catalogue sont immuables dès leur création. Une correction crée
une révision distincte, puis l'administrateur approuve la dernière version exacte.
La fiche garde sa référence publiée et un drapeau d'activation indépendant :
publier ne réactive jamais silencieusement. Les anciennes propositions conservent
leurs instantanés et n'adoptent pas un tarif ultérieur.

Les prix utilisent des centimes CHF entiers et une unité explicite. Capacités,
durée et taxe inconnues restent signalées ; aucun prix ou taux réel par défaut.
Une source comporte vérification et validité approuvées par la cave. La sélection
automatique est un garde serveur : elle exclut toute fiche incomplète, inactive,
non publiée, sur devis/information ou dont la source manque/n'est plus actuelle.
Elle ne réserve rien et doit être réexécutée par les futurs workflows commerciaux.

Le modèle SQL sépare fiche, révisions, approbations et commandes idempotentes.
FK composites, transactions et droits minimaux protègent l'histoire et les caves.
Les commandes de maintenance sont d'abord disponibles en API ; aucune interface
de catalogue n'est prétendue livrée ici. Le [guide](../development/catalog.md)
documente contrats, bornes techniques, états, migration v5 explicite et limites.
