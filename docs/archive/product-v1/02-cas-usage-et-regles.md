# EnCave Assistant — documentation de référence

Version 1.0 · 7 septembre 2026

## 07 · UC-01 — De la demande à la réservation

**But :** réserver une activité à prix connu. **Acteurs :** visiteur, caviste et agent. **Préconditions :** catalogue validé, ressources connues, messagerie opérationnelle et mode supervisé.

1. Recevoir le message et créer une demande, après contrôle des doublons techniques.
2. Extraire activité, participants, date, horaire, budget et besoins. Conserver le message d’origine et la provenance de chaque champ.
3. Si des données obligatoires manquent, préparer une question ciblée. Le caviste la valide ; la réponse du client complète le dossier.
4. Filtrer les offres et calculer les disponibilités via le moteur métier. Présenter une alternative lorsqu’un créneau demandé est occupé.
5. Construire une proposition immuable contenant offre, ressources, prix, conditions et date de validité. Le caviste valide cette version.
6. Envoyer le message correspondant et conserver la référence fournisseur et le statut d’envoi.
7. Recevoir l’accord sur cette version. Si le client modifie un élément commercial, revenir à la proposition.
8. Après l’accord, le caviste clique sur « Réserver et confirmer » pour autoriser cette réservation et son message de confirmation. Le serveur revérifie données, permissions et disponibilité, puis réserve dans une transaction interne.
9. Exécuter la synchronisation externe. Confirmer au client seulement lorsque les conditions de confirmation sont satisfaites et l’écriture nécessaire est connue comme réussie.

### Acceptation fonctionnelle
- Même message reçu deux fois : une seule ingestion, pas deux réponses.
- Créneau devenu occupé : aucune confirmation automatique ; une alternative nécessite un nouvel accord.
- Même commande de réservation rejouée : même résultat métier, sans second événement.
- Envoi ou écriture incertains : statut visible, réconciliation et reprise ; aucun succès inventé.

### Mesure du cas
Temps actif économisé, nombre de corrections de l’offre, taux d’accord, taux d’exceptions et conflits détectés. Les temps d’attente client sont mesurés séparément.

**Limite Outlook :** une vérification suivie d’une écriture ne forme pas une transaction atomique avec les opérations faites ailleurs dans Outlook. L’automatisation exige une politique de réservation explicite ; voir les règles de concurrence et le lot de production.

## 08 · UC-02 — Précisions, refus et changements

### Demande incomplète ou ambiguë
L’agent demande uniquement les informations nécessaires au prochain engagement. « Samedi prochain » est interprété relativement au message et au fuseau de la cave ; toute ambiguïté demeure visible et se confirme avec le client. Un budget exprimé pour tout le groupe ne devient pas un budget par personne.

Une question n’est pas envoyée en boucle. Le dossier conserve les champs déjà demandés, les réponses reçues et une limite de relances. Une absence de réponse conduit à un statut d’attente puis à l’archivage selon une règle configurable, sans création de réservation.

### Absence d’offre ou de créneau
Le moteur distingue offre non admissible, tarif manquant, ressources inconnues et agenda réellement complet. L’agent peut proposer une autre date ou une autre offre connue. Il ne crée pas un prix, une disponibilité ou une prestation sur mesure sans validation du responsable.

### Modification avant accord
Une correction de date, de groupe, de prestation, de prix ou de conditions crée une nouvelle version. L’ancienne devient obsolète. Les validations et accords associés ne sont pas réutilisés. Une réponse à un ancien e-mail doit être rattachée à la bonne version avant toute action.

### Modification après réservation
Le pilote transmet la demande à un humain. Pour la première production, prévoir une commande dédiée : lire la réservation existante, calculer la nouvelle proposition, obtenir l’accord requis, réserver les nouvelles ressources puis appliquer le changement externe et libérer les anciennes selon une opération compensable. En cas d’échec, conserver un état explicite à résoudre.

### Annulation
Le pilote utilise une reprise humaine avec motif et journal d’action. L’automatisation d’annulation n’est activée qu’après définition des conditions et des conséquences. Aucun remboursement automatique au lancement. Une annulation ne supprime pas silencieusement l’historique ou la preuve d’accord.

**Critère commun :** toute modification qui change l’engagement doit pouvoir être expliquée à partir d’une version, d’un acteur et d’une date. Les changements d’adresse e-mail ou d’interlocuteur ne suffisent pas à transférer les droits sur une réservation.

## 09 · UC-03 — Location de salle et devis

La location utilise une ressource exclusive et une durée variable. Le fait qu’une salle soit libre ne prouve pas que le domaine peut assurer la prestation demandée.

### Informations à qualifier
Date, heures d’accès et de sortie, installation et rangement, participants, type d’événement, équipements, restauration, prestataires, accessibilité et coordonnées. Les besoins alimentaires peuvent révéler des informations sensibles : demander le minimum utile et éviter de conserver des détails personnels inutiles.

### Parcours du pilote
L’agent renseigne le dossier, vérifie les contraintes connues et prépare les questions ou un créneau envisageable. Le responsable établit le devis dans son outil habituel. Le dossier reste en reprise humaine et aucune confirmation automatique ne part. Ce lot couvre déjà une partie des échanges sans prétendre gérer la location de bout en bout.

### Parcours de première production
Le responsable valide un devis structuré et versionné : prestation, dates, ressources, prix, taxes applicables, conditions, durée de validité et éventuel acompte. Le document rendu est lié à cette version. L’accord client doit porter sur cette offre exacte. En A1, le responsable autorise ensuite « Réserver et confirmer ». La réservation ne passe au statut confirmé qu’après satisfaction des conditions déclarées.

Si un acompte est requis et payé hors application, une personne autorisée enregistre la vérification avec une référence ; l’agent ne la déduit pas d’un simple e-mail. Le paiement intégré est un lot futur.

### Règles spécifiques
- Capacité différente selon la disposition de la salle, à configurer lorsqu’elle est pertinente.
- Installation, rangement et personnel pris en compte dans l’occupation des ressources.
- Horaires d’accès distincts des horaires annoncés pour l’événement.
- Tarif inconnu ou exception : validation obligatoire par le responsable.
- Option temporaire éventuelle : date d’expiration et comportement de libération explicites.

**Critères de sortie du lot :** deux devis successifs ne peuvent partager un même accord ; une capacité invalide ou un acompte non vérifié bloque la confirmation ; une durée de location n’est jamais assimilée à la durée fixe d’une dégustation.

## 10 · UC-04 — Événements et recommandations

### Événement ponctuel existant
La cave peut enregistrer une Tavolata, une balade, une journée spéciale ou une autre expérience. La fiche précise l’organisateur, les dates connues, le public, les conditions, la source, la date de dernière vérification et le lien officiel.

Dans le pilote et la première production, une billetterie externe reste responsable de l’inscription et des places. L’agent informe et dirige le visiteur vers cette billetterie. Il n’affirme ni disponibilité ni inscription effective sans accès vérifié à la source correspondante.

### Recommandation à partir d’une demande
« Une activité pour douze collègues, l’après-midi, avec un budget de 70 CHF par personne » peut donner lieu à plusieurs propositions. Le moteur commence par les contraintes obligatoires : effectif, période, budget, durée, besoins indispensables et autorisation de recommander l’offre. L’IA formule ensuite l’explication des choix admissibles.

Les critères souples, comme découverte, repas ou convivialité, servent au classement. Une offre hors budget n’est pas présentée comme compatible. Une disponibilité inconnue est affichée comme inconnue. Une préférence ne devient pas une contrainte inventée.

### Catalogue de confiance
Chaque prix, date, horaire et condition cités doit correspondre à une fiche approuvée et versionnée. Une fiche périmée, incohérente ou sans source est exclue de l’automatisation jusqu’à révision. Le responsable peut désactiver une offre immédiatement.

### Futur module de places
Une séance avec vingt places utilise une capacité partagée ; une salle louée utilise une ressource exclusive. Ces modèles ne sont pas interchangeables. Un futur connecteur de billetterie devra gérer inventaire, options, paiements, expirations, annulations et référence d’inscription auprès du fournisseur.

### Critères de recette
- Recommandation parmi des offres admissibles avec motif compréhensible.
- Aucune réservation d’événement créée par le simple envoi d’un lien.
- Lien officiel absent : demande de reprise, sans URL fabriquée.
- Événement complet confirmé par une source : alternative ou attente, sans promesse.
- Demande hors catalogue : réponse utile et transfert au responsable.

## 11 · États métier et transitions autorisées

Séparer le cycle d’une demande, celui de ses propositions, de la réservation et des opérations externes. Un statut unique comme « envoyé » ne suffit pas à représenter une synchronisation en échec.

| Objet | États principaux |
|---|---|
| Demande | reçue, à qualifier, attente client, à traiter, traitée, archivée |
| Proposition | brouillon, à valider, approuvée, envoi en cours, envoyée, acceptée, refusée, expirée, remplacée |
| Réservation | préparation, en cours de synchronisation, confirmée, à réconcilier, modification demandée, annulée |
| Action externe | planifiée, en cours, réussie, échouée, résultat incertain, abandonnée |

### Invariants
- Une proposition approuvée est immuable. Une modification produit une nouvelle version.
- Une acceptation indique l’identité observée du répondant, le message ou lien utilisé, la version et les termes acceptés.
- Une réservation se rattache à une version acceptée ; le prix et le créneau ne sont pas relus dans une fiche devenue différente.
- Une action technique réussie ne clôt pas automatiquement toutes les étapes métier.
- Seules les transitions autorisées par rôle, politique et état actuel peuvent être exécutées.

### Préconditions de confirmation
Données obligatoires présentes ; version toujours valable et non remplacée ; accord non ambigu ; conditions satisfaites ; catalogue autorisé ; droits de l’opérateur ; créneau admissible ; accès externes suffisamment récents ; aucune opération concurrente bloquante.

### Reprises
Une interruption après validation conserve la proposition et le travail planifié. Une écriture externe au résultat inconnu déclenche une réconciliation, pas une seconde écriture aveugle. Une erreur définit une action, un responsable et une échéance.

Le backlog prévoit des tests de transitions interdites. Les règles sont exécutées côté serveur même si les boutons correspondants sont masqués dans l’interface.

## 12 · Disponibilités, ressources et concurrence

### Calcul déterministe
Une offre décrit ses ressources, sa durée, les participants admissibles, ses horaires, les délais de réservation et les périodes fermées. Une ressource peut être une salle, une équipe ou un équipement. La durée d’occupation inclut la préparation et le rangement propres à cette offre.

Utiliser des intervalles demi-ouverts [début, fin), enregistrés en UTC avec le fuseau métier conservé. Les règles locales sont calculées dans ce fuseau ; un changement d’heure nécessite une interprétation explicite. Les récurrences sont développées sur un horizon borné. Une erreur de lecture n’équivaut jamais à un agenda vide.

### Protection interne
La transaction réserve toutes les ressources nécessaires ensemble. Pour les ressources exclusives, utiliser une contrainte de non-chevauchement ou un verrou transactionnel équivalent avec une validation atomique. Appliquer tenant_id et les statuts bloquants. Les deux demandes concurrentes ne peuvent pas toutes deux obtenir la même ressource. Voir [S10].

Une capacité partagée pour des sessions constitue un modèle distinct : verrou de la session et calcul transactionnel des places restantes. Il est hors lot de lancement.

### Limite des agendas externes
Le service peut empêcher ses propres doubles réservations. Il ne peut pas garantir une exclusion atomique avec une modification manuelle indépendante dans Outlook. Pour autoriser la confirmation automatique, choisir avec la cave : agenda de référence contrôlé, réservation de ressources qui accepte/refuse réellement les demandes, ou procédure opérationnelle équivalente testée.

Sans dispositif suffisant, conserver une validation humaine et un contrôle externe immédiat. Après écriture, rapprocher les occupations et mettre toute anomalie en reprise. Ne jamais vendre une garantie absolue d’absence de conflit sur un agenda librement modifiable ailleurs.

### Options temporaires
Le pilote envoie des propositions sans bloquer le créneau. Si une option est ajoutée ensuite, elle possède une durée, un propriétaire, une référence, une expiration et une libération idempotente. L’accord reçu après expiration exige une nouvelle vérification et éventuellement une nouvelle offre.

## 13 · Tarifs, propositions et preuve d’accord

### Une proposition représente l’engagement
Conserver un instantané de l’offre : identifiant et version du catalogue, nombre de personnes, dates, fuseau, ressources, montant unitaire, quantités, remises autorisées, taxes et montant total. Les montants utilisent une unité monétaire entière ou un type décimal précis, jamais un flottant binaire pour les calculs financiers.

Le prix public inclut une règle explicite sur les taxes. Les données du POC ne constituent pas des tarifs de Gilliard. Une exception de prix requiert un rôle autorisé et un motif.

### Validation et envoi cohérents
La validation porte sur une version identifiable. Le rendu de l’e-mail ou du devis est généré depuis cet instantané. Une modification libre du texte ne doit pas permettre de changer les conditions commerciales sans mettre à jour et faire revalider la proposition structurée.

Le système conserve version, empreinte du contenu, personne qui a validé, date et référence d’envoi. Pour une correction de forme sans effet commercial, conserver également la variante effectivement envoyée.

### Accord du client
Un lien sécurisé, limité à cette proposition, peut constituer le parcours le plus clair. Le jeton est aléatoire, expirant et inutilisable pour accéder à d’autres dossiers. Ne pas placer des données personnelles dans l’URL.

Un accord par e-mail est rattaché au fil et à la proposition concernée. « Oui » ne suffit pas si plusieurs offres sont ouvertes ou si la réponse modifie le nombre de personnes. Un tiers inconnu, une adresse changée ou un contenu transféré déclenche une vérification humaine.

### Critères bloquants
- L’accord sur la version 1 ne permet pas de réserver la version 2.
- Une offre expirée ou désactivée est revérifiée ; aucun remplacement implicite.
- La confirmation reprend les termes acceptés et la référence de réservation.
- Les décisions de remise, gratuité, acompte ou pénalité ne sont jamais inventées par l’IA.

La preuve conservée aide à expliquer les actions. Sa portée contractuelle, la forme des conditions et les obligations de conservation doivent être validées pour l’exploitation prévue.