# Definition of Ready / Definition of Done

Ces critères concernent les tickets de développement. Ils ne changent pas l'autonomie du produit : en A1, le caviste valide l'envoi de la proposition puis autorise la réservation et sa confirmation **après** l'accord client sur la version exacte.

## Ready — le ticket peut démarrer

- Résultat utilisateur, périmètre et exclusions formulés ; identifiant et dépendances du backlog reliés au ticket.
- Règles du pack et décisions applicables citées ; une inconnue bloquante devient un spike ou une décision, pas une hypothèse silencieuse.
- Critères observables écrits avec état initial, action et résultat ; prévoir nominal, refus et panne pertinents.
- Contrats et données touchés identifiés : cave, rôles, états, version d'offre/accord, transaction, effets externes et idempotence si concernés.
- Tests requis et niveau de preuve choisis selon [la stratégie](04-strategie-tests.md) ; fixtures fictives et conditions d'exécution précisées.
- Accès réellement nécessaires disponibles ou dépendance explicitement bloquée. Les essais M365 utilisent un périmètre de test autorisé ; aucun compte de Julien n'est présumé accessible.
- Taille permettant une revue et une démonstration ; responsable de la décision et mode de désactivation identifiés pour une fonction sensible.

Un ticket documentaire peut être Ready sans application. Un ticket code dont les décisions ou accès nécessaires manquent reste bloqué, ou est redécoupé en travail indépendant vérifiable.

## Done — le ticket est livrable

- Comportement serveur implémenté et critères métier démontrés ; une interface seule ne termine pas une story persistante.
- Contrats, migrations et reprise revus selon les changements ; erreur, état incertain et action humaine sont visibles.
- Tests pertinents **implémentés et exécutés avec succès**, y compris régression et refus sensibles. Toute suite requise absente, ignorée ou non exécutée bloque la livraison du ticket de code.
- Preuves rattachées au commit livré : commandes exactes, environnement, cas exécutés, résultats, limites et revue. Les simulations sont nommées ; captures et `.feature` seuls ne prouvent pas l'exécution.
- Contrôles serveur de cave/rôle/état/version préservés ; pas de secret ni donnée personnelle inutile dans les fixtures, logs ou traces IA.
- Documentation et décisions mises à jour ; mécanisme de désactivation et procédure de reprise décrits lorsque nécessaires.
- Diff relu, anomalies connues qualifiées et dépendances actualisées. Aucun défaut critique ouvert sur le périmètre livré.

On n'impose pas 100 % de couverture de lignes. On exige les tests qui prouvent les critères du ticket et maîtrisent ses risques. Une exclusion doit être motivée ; elle ne peut retirer un invariant critique ni transformer un échec en succès.

## Fiche de preuve à joindre au ticket

```text
Ticket / commit :
Critères prouvés :
Commandes et environnement :
Résultats (passés / échoués / bloqués / non exécutés) :
Cas métier et références de rapports :
Connecteurs réels ou simulés, périmètre autorisé :
Limites, décisions et prochaine action :
Revue / date :
```

**Done n'est pas une autorisation de lancement.** Les jalons G2/G3 du pack exigent leurs propres preuves, dont le corpus IA ≥100 cas avant demandes réelles. Le niveau A2/A3 demande une décision séparée par cave et par action ; il ne découle ni de la qualité du code ni de l'autonomie de son développeur.
