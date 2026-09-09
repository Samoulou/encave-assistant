# EA-08 — Contrat avant réalisation

Ouverture : 2026-09-09 11:05:00 UTC (13:05 Europe/Zurich), exécution 1.
Échéance 13:05:00 UTC ; maximum trois corrections, huit appels reviewer,
1 200 secondes par appel et 7 200 secondes pour cette exécution.
Base : `1b9f250a8f36ee03a8d20ab27b8807d17936eb1f`, EA-07 vérifié, review
indépendante pass, livré sur main et SHA distant vérifié. CI séparée.
Lectures : AGENTS/START/protocole08, brief, backlog EA-08, produit02 §11/13,
produit04 §21–23, contrats09, tests04 et DoR/DoD05 ; UX/design déjà lus,
aucune interface modifiée par cette tranche de commandes serveur.

## AC-01

Transition interdite rejetée.

Acceptation : graphes explicites par type d’objet, vocabulaire fermé, état courant
relu en SQL, rôle et cave issus de la session. Refuser l’état cible inconnu,
l’arête absente, la commande d’un lecteur, un identifiant étranger et une ancienne
cave active ; aucune modification d’état, de version ou d’historique en cas de refus.
Une mutation et son événement d’historique doivent être atomiques.

Le noyau de transition des quatre objets n’autorise pas à contourner les futurs
workflows commerciaux : approbation/envoi/accord, confirmation de réservation et
résultat fournisseur exigent leurs préconditions serveur propres. Ces commandes
protégées restent indisponibles tant que les services des tickets correspondants
ne peuvent pas démontrer ces préconditions. Aucun champ JSON client ne les valide.
L’API publique de cette tranche expose uniquement le changement de statut d’une
demande par administrateur/opérateur ; les autres machines sont des services
internes, avec refus conservateurs des effets non encore disponibles.

Tests unitaires des graphes et refus, commandes HTTP réelles positives/négatives,
tests SQL montrant état/historique inchangés après erreur, vérification des refus
de transitions commerciales sans preuve. Aucune réussite fournisseur simulée
n’est présentée comme une autorisation de confirmation.

## AC-02

Version périmée retourne un conflit.

Acceptation : expectedVersion entier obligatoire, comparaison avec la version
persistée et mise à jour conditionnelle. Succès = une augmentation exactement de
un et un événement lié à l’acteur, aux états et versions. Concurrents sur la même
version : un seul changement, autres en 409/version_conflict. Ancien onglet après
rechargement/changement externe : conflit explicite, pas d’écrasement silencieux.
La commande porte une clé d’idempotence ; même clé/charge retourne le résultat
enregistré, autre charge renvoie 409. Les droits sont relus avant tout replay.

Tests PostgreSQL avec sessions/connections concurrentes, refus des versions nulles,
fractionnaires ou dépassées, panne d’écriture d’historique annulant toute mutation.
E2E navigateur avec deux contextes, état persistant relu après conflit et reload.

## AC-03

Demande, proposition, réservation et action ont des statuts distincts.

Acceptation : réutiliser les quatre vocabulaires SQL/contrats EA-07, définir leur
graphe dans le domaine et les contrôler dans le serveur. Une action réussie ne
change pas automatiquement la demande ou la réservation ; chaque objet possède
son propre compteur de version et son historique. Une transition de proposition
conserve intégralement l’instantané figé et son empreinte. Les tests prouvent les
transitions techniques admissibles et les blocages lorsque le workflow requis
n’est pas encore présent ; ni allocation ni envoi ne sont introduits ici.

## Choix et contrôles

Migration additive 004 pour journal et idempotence, sans modifier les migrations
livrées. Conserver aussi le contrat publié de migrateDatabase sans option, qui
applique la base v3 et dont les anciens tests prouvent ce résultat exact. Ajouter
un ciblage explicite de la version actuelle pour le générateur/runtime de test et
les futurs déploiements, avec nouveaux tests de migration004 ; ne pas affaiblir
ou modifier les anciens tests pour accepter arbitrairement un résultat nouveau.
Les historiques connus plus récents que la cible ne sont jamais rétrogradés.

Gates obligatoires : kit, unit, functional, business, E2E ; compilation,
foundation et outillage affectés. UX non applicable à l’interface inchangée.
Fixtures fictives, PostgreSQL réel sous rôle applicatif, aucune IA ni Microsoft.
Review distincte, preuves et livraison Git vérifiées, puis EA-09 admissible.

Correction 1 (review préliminaire) : prouver le refus du replay après révocation,
passage lecteur et changement réel de cave ; vérifier les FK et l'immutabilité du
journal sous login applicatif, le replay concurrent et la borne entière de version.

Diagnostic connexe avant correction de l'outillage : sur le commit EA-07 exact
sous Linux, deux campagnes de trois répétitions reproduisent une exception non
interceptée ; la seconde identifie le message PostgreSQL « terminating connection
due to administrator command ». Le nettoyage actuel emploie DROP DATABASE FORCE
après pool.end. Ajouter une régression avec connexion synthétique en cours de
fermeture, constater son échec avant correction, puis attendre de façon bornée
l'absence de connexions avant DROP sans FORCE. Aucun ancien test n'est modifié.
La documentation PostgreSQL confirme que FORCE termine les connexions existantes :
[DROP DATABASE](https://www.postgresql.org/docs/17/sql-dropdatabase.html).
Cette cause reste à vérifier par la régression et les suites Linux après correction.
