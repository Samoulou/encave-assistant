# EnCave Assistant — documentation de référence

Version 1.0 · 7 septembre 2026

## 28 · Roadmap et estimation de capacité

Estimation de cadrage pour **un développeur expérimenté**, hors décision de sous-traitance : 1 jour de travail = 7 heures. Les fourchettes incluent conception, code et tests des lots ; elles ne sont pas un devis. Les accès Microsoft, les règles de devis et la disponibilité du pilote peuvent modifier l’effort.

| Phase | Livrable principal | Effort de base |
|---|---|---|
| P0 — Terrain et faisabilité | Règles, baseline, test Microsoft | 3–5 j |
| P1 — Fondations | Identité, tenants, données, états | 6–9 j |
| P2 — Entrées et synchronisation | Inbox réelle, formulaire, calendrier lu | 8–12 j |
| P3 — IA et propositions | Extraction, catalogue, versions, validation | 8–12 j |
| P4 — Réservation et écritures | Accord, transaction, Outlook, reprise | 12–18 j |
| P5 — Durcissement produit | Sécurité, devis borné, profil petite cave | 8–12 j |
| P6 — Pilote supervisé | Mesures, corrections et exploitation | 8–12 j |
| P7 — Lancement | Recette, contrats, support, activation | 4–6 j |
| Total | Hors marge et temps d’attente externes | 57–86 j |

Avec une réserve de 20 %, prévoir environ **479–722 heures**. À 28 heures productives par semaine : 17–26 semaines de capacité. À 15 heures : 32–49 semaines. À 10 heures : 48–73 semaines. Ces conversions ne représentent pas une date de lancement promise.

P6 doit couvrir au moins quatre semaines calendaires d’observation, éventuellement superposées au travail de correction. Les délais d’administrateur Microsoft, de validation juridique ou d’obtention de demandes représentatives s’ajoutent lorsqu’ils bloquent le chemin critique.

### Chemin critique
Règles de disponibilité → faisabilité Microsoft → données et versions → ingestion fiable → accord exact → réservations et effets externes → recette de panne → pilote mesuré → lancement supervisé.

Une première tranche connectée peut être montrée après P3 : demande réelle vers proposition approuvable, sans confirmation automatique. Le pilote complet exige P4 et les contrôles de sécurité requis de P5. Réduire le périmètre vendu est possible ; réduire les garanties de cohérence ne l’est pas.

## 29 · Jalons et critères de passage

### G0 — Prêt à développer
Périmètre et exclusions écrits ; propriétaire des ressources connu ; configuration Microsoft testée ou risque clairement accepté ; catalogue d’exemple validé ; mode d’accord choisi ; baseline de traitement définie. Sortie : décisions ADR-01 à ADR-06 et tickets P0/P1 prêts.

### G1 — Pilote connecté de test
Environnement dédié, droits minimaux vérifiés et accès hors périmètre refusé. Scénarios de doublon, conflit, version périmée, révocation et timeout passent. Chaque action sensible vérifie tenant, rôle et état. Le coupe-circuit est testé. Aucune donnée réelle avant validation du cadre de traitement.

### G2 — Pilote sur demandes réelles supervisées
Aucun défaut critique connu ; sauvegarde restaurée avec succès ; alertes reçues ; politique de disponibilité comprise par la cave ; jeu IA d’au moins 100 cas évalué. Tous les engagements restent validés. Toute ambiguïté critique du jeu de recette entraîne une clarification ou une reprise ; aucun prix ni succès inventé dans les scénarios critiques.

### G3 — Première production commerciale supervisée
Au moins quatre semaines de pilote et 30 demandes éligibles traitées ; prolonger si le volume ou la diversité est insuffisant. Aucun incident critique non résolu. Objectifs proposés : au moins 80 % des propositions éligibles validées sans correction commerciale importante et réduction médiane de 30 % du temps humain, selon baseline comparable.

Les fonctions vendues passent leurs tests : si le lot devis ou le profil sans Microsoft ne sont pas terminés, les exclure explicitement de l’offre de lancement et ajuster la roadmap.

### G4 — Autonomie supplémentaire
Décision séparée par cave et par action. Corpus et résultats propres à l’action, limites explicites et retour au mode supervisé. Commencer par demandes de précisions ou FAQ validées. La réservation autonome exige un circuit de ressources suffisamment maîtrisé. Les devis, exceptions de prix et annulations coûteuses restent humains au premier palier.

### Qui décide ?
Samuel porte produit et exploitation ; le développeur fournit les preuves techniques ; la cave valide règles et usage ; les responsables compétents examinent accès et traitement des données. Le go/no-go est consigné. Un objectif commercial ne permet pas de passer un défaut critique connu.

## 30 · Backlog priorisé et découpage de livraison

Le pack contient **40 tickets détaillés**, avec phase, priorité, dépendances, résultat attendu et critères d’acceptation. Les estimations sont portées au niveau des phases ; les tickets doivent être affinés à une taille réalisable avant développement.

| Groupe | Tickets | Résultat |
|---|---|---|
| Terrain et décisions | EA-01 à EA-03 | Règles et accès testés ; architecture retenue |
| Fondations | EA-04 à EA-08 | Dépôt, identité, isolation, schéma et états |
| Catalogue et entrées | EA-09 à EA-16 | Règles, données approuvées, e-mails, formulaire et sync |
| IA et engagement | EA-17 à EA-22 | Extraction, calcul, propositions, validation et accord |
| Réservation fiable | EA-23 à EA-28 | Outbox, allocations, Outlook, envoi et reprise |
| Périmètres complémentaires | EA-29 à EA-32 | Devis, événements, petite cave et changements |
| Qualité et exploitation | EA-33 à EA-37 | Sécurité, évaluations, concurrence, observabilité et reprise |
| Pilote et lancement | EA-38 à EA-40 | Onboarding, mesure, go/no-go et exploitation |

### Première tranche verticale
EA-01/02/03 → EA-04/05/06/07/08 → catalogue et une entrée réelle → extraction → proposition versionnée → validation. Elle doit fonctionner avec données persistantes et deux utilisateurs ; elle ne confirme pas encore de réservation sans le lot suivant.

### Principes de priorisation
Les priorités sont distinctes des phases P0 à P7. La priorité P0 signifie nécessaire à la première mise en production supervisée ou à sa sécurité. P1 complète le périmètre commercial défini, avec reprise humaine documentée si différé. P2 désigne l’extension après lancement, notamment davantage d’autonomie, canaux sociaux, paiements et billetterie transactionnelle.

Les tests et l’observabilité commencent avec les fondations ; ils ne sont pas un dernier sprint ajouté après les fonctions visibles. Les tickets de synchronisation et de réservation nécessitent des scénarios d’échec avant de pouvoir être considérés terminés.

### User stories et critères
Chaque ticket inclut un exemple observable : données initiales, action et résultat. Les points d’incertitude deviennent des décisions ou des spikes bornés. Une dépendance à un administrateur ou à un prestataire est explicitement indiquée dans le suivi.

## 31 · Plan des dix premiers jours de travail

Ce plan est un ordre de travail adaptable, pas une promesse d’achèvement en dix jours. P0 et P1 représentent déjà 9–14 jours de cadrage ; les objectifs suivants glissent si le spike ou les fondations le nécessitent. À temps partiel, étaler selon la capacité disponible.

1. Relire le brief et préparer l’entretien Julien : volumes, types de demandes, règles, calendriers, prix et accord. Demander des exemples anonymisés.
2. Identifier le type de boîte Microsoft et exécuter le spike d’accès sur un environnement autorisé. Consigner la décision et les limites.
3. Choisir l’architecture et créer les environnements indépendants, le dépôt et les conventions de développement.
4. Installer identité, première cave, rôles et contrôle serveur du tenant ; créer une seconde cave de test.
5. Écrire les migrations du noyau : demandes, messages, catalogue, propositions, accords et actions. Tester les références inter-caves interdites.
6. Implémenter les états et versions ; transposer les tests utiles du moteur POC au domaine serveur.
7. Rendre catalogue et ressources configurables ; valider les règles de disponibilité et prix sur fixtures.
8. Livrer la création manuelle d’une demande persistante, le détail et le journal d’actions.
9. Consolider la file durable des fondations ; prouver la reprise après redémarrage. L’ingestion Microsoft appartient à la tranche suivante.
10. Présenter les fondations vérifiées et, si prête, la saisie persistante ; réestimer les travaux restants avant l’intégration Microsoft.

### Premier résultat attendu
Samuel peut se connecter, choisir une cave, retrouver une demande après rechargement, consulter son origine et obtenir un résultat métier testé. Une autre cave ne peut pas accéder à ce dossier. La réussite ne dépend pas d’une simulation de message ou d’un tableau de bord décoratif.

### Ce qu’il faut décider sans bloquer tout le projet
Le détail des tarifs commerciaux, les canaux futurs et le prestataire de facturation peuvent attendre. Le propriétaire de la disponibilité, le mode d’accord, les règles d’accès et la séparation des données doivent être décidés tôt.

### Livrables de fin de tranche
ADR mis à jour, migrations reproductibles, tests, guide local, environnement de test, démonstration et backlog réestimé. Le brief à transmettre à un développeur ou à un assistant de code se trouve dans le deuxième document et dans le pack Markdown.

## 32 · Modèle économique et lancement commercial

### Proposition commerciale à tester
Abonnement par cave, avec frais de mise en service lorsque la connexion et le catalogue demandent du travail. Le prix dépend du périmètre couvert, du volume, de l’autonomie et du support. Le modèle évite de facturer une promesse générique d’IA ; il décrit les demandes et actions prises en charge.

Hypothèses de travail à discuter, sans étude de prix validée : profil simple 149–249 CHF/mois ; profil connecté 299–499 CHF/mois ; mise en service 300–1 200 CHF selon le travail. Ces valeurs ne sont ni des tarifs de marché établis ni une recommandation finale.

### Coûts à suivre
Infrastructure fixe, base et sauvegardes, fournisseur d’identité, messages, consommation IA, support, maintenance et installation. Le coût d’IA par demande dépend du nombre d’appels, des tokens, du modèle et des reprises. Utiliser une grille de prix fournisseur datée au moment du choix, puis rapprocher les factures.

### Lecture de l’objectif de revenu accessoire
À titre purement illustratif, 15 caves à 299 CHF donnent 4 485 CHF de revenu mensuel récurrent brut. Avec 30 CHF de coût variable par cave et 200 CHF de coûts fixes, il reste 3 835 CHF avant temps de travail, acquisition, impôts et charges. Si le support consomme 15 heures mensuelles valorisées 60 CHF, la contribution après ce temps est 2 935 CHF.

Cette simulation montre pourquoi un objectif personnel de 3–5 kCHF ne se confond pas avec le chiffre d’affaires. Mesurer le support et limiter les adaptations spécifiques par cave sont indispensables.

### Déroulement commercial
Démonstration → validation du problème → pilote à périmètre écrit → bilan mesuré → proposition d’abonnement. Julien n’est pas présumé acheteur. Tester ensuite le même produit sur une petite cave pour vérifier la simplicité et éviter de construire uniquement autour d’un grand domaine.

Facturation manuelle possible au pilote. Avant production commerciale : conditions de service, description précise des fonctionnalités, support, traitement des données, export/déconnexion et procédure d’incident. L’automatisation de la facturation SaaS peut suivre lorsque le volume le justifie.

## 33 · Risques, décisions ouvertes et responsabilités

| Risque | Réponse proposée | Responsable de validation |
|---|---|---|
| Peu de demandes couvertes | Mesurer canal et volume avant élargissement | Samuel + cave |
| Agenda partagé complexe | Spike Microsoft et politique d’écriture | Développeur + administrateur |
| Prix envoyé différent du prix réservé | Proposition immuable et accord versionné | Produit + développeur |
| Erreur IA convaincante | Sources, contrôles serveur et clarification | Produit + cave |
| Écriture externe incertaine | Réconciliation et reprise visible | Développeur + exploitation |
| Support trop coûteux | Catalogue standard, quotas et installation bornée | Samuel |
| Données entre caves | Isolation, contraintes et tests d’attaque | Développeur |
| Délais irréalistes à temps partiel | Planifier en heures et limiter le périmètre | Samuel |

### Registre de décisions initial
ADR-01 : indépendance complète d’EnCave, retenue. ADR-02 : TypeScript et backend modulaire, proposé. ADR-03 : PostgreSQL/outbox initiale, proposé. ADR-04 : source de vérité des ressources et niveau d’autonomie, à valider avec la cave. ADR-05 : boîte propre ou partagée et stratégie Microsoft, à valider par spike. ADR-06 : accord via lien sécurisé et/ou e-mail contrôlé, à valider. ADR-07 : régions, fournisseurs, rétention et support, à examiner avant données réelles.

### Questions prioritaires pour Julien
Combien de demandes par semaine et par canal ? Quelles demandes prennent le plus de temps ? Qui modifie l’agenda ? La disponibilité dépend-elle d’une personne ou d’une équipe ? Quand un créneau est-il réellement engagé ? Un acompte est-il requis ? Quelles prestations changent le prix ? Quelles actions peut-il déléguer ?

### Gouvernance légère
Revue hebdomadaire des risques et tickets ; démonstration à chaque tranche verticale ; décisions enregistrées avec date, motif et conséquences. Une nouvelle demande fonctionnelle doit préciser le problème résolu, le bénéficiaire, la priorité et l’effet sur la roadmap.

Ce dossier peut servir de référence dès maintenant. Les validations terrain et techniques encore ouvertes ne doivent pas être présentées comme des accords déjà obtenus.