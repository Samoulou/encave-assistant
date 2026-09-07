# EnCave Assistant — brief de développement

## 01 · Mission et périmètre de l’application

**Mission de développement :** construire EnCave Assistant, un logiciel indépendant qui reçoit les demandes d’une cave, les qualifie avec l’IA, propose des activités admissibles et prépare les réservations dans un cadre d’autorisation explicite.

**Premier parcours à livrer :** une demande de dégustation reçue par e-mail → informations sourcées → offre et créneau → validation du caviste → accord client sur la version exacte → réservation → écriture calendrier → confirmation traçable.

### Utilisateurs et interface
Le caviste dispose de demandes, propositions, réservations, catalogue, connexions et historique. Le visiteur utilise le formulaire du site et l’e-mail, sans compte. Un lien d’acceptation peut présenter l’offre exacte. Prévoir les états incomplets, expirés, en échec et en attente de reprise.

### Périmètre initial
- Microsoft 365 : une configuration de boîte et calendrier validée par un spike.
- Entrées : e-mail, formulaire du site et saisie manuelle après téléphone.
- Visites et dégustations à prix défini : parcours complet supervisé.
- Locations : qualification au pilote ; devis validé et versionné avant une réservation en production.
- Événements externes : catalogue et lien officiel ; aucune vente de places.
- Recommandations : uniquement les offres approuvées de la cave.
- Français, CHF, Europe/Zurich ; champs configurables dans le modèle de données.

### Contraintes fermes
Aucun partage de dépôt, base, authentification, secrets ou code d’exécution avec la marketplace EnCave. Le modèle ne calcule ni le prix final ni l’autorisation de réserver. Le mode initial est supervisé. L’autonomie est activée séparément par cave et action.

Le POC actuellement disponible est une démonstration : moteur local, trois scénarios, export .ics ; aucun LLM, Outlook, e-mail réel ou stockage serveur. Le dossier principal est la référence détaillée.

## 02 · Architecture et invariants à implémenter

### Architecture proposée
Un dépôt propre à EnCave Assistant : apps/web, apps/api, apps/worker, packages/domain, packages/contracts et packages/connectors. Frontend React/TypeScript ; API et worker Node/TypeScript ; PostgreSQL géré ; identité OIDC. Une outbox et une file PostgreSQL suffisent au départ. Verrouiller les versions et les prestataires après le spike ; l’hébergement du POC n’est pas imposé.

### Données principales
Cave et membres ; catalogue versionné et ressources ; demande et messages ; faits extraits avec provenance ; proposition et devis versionnés ; validation ; accord ; réservation et allocations ; action, tentatives, outbox, curseurs de synchronisation et connexions.

### Invariants bloquants
1. Le serveur résout le tenant et contrôle rôle, état et version pour chaque commande.
2. Une proposition envoyée conserve ses termes exacts. Toute modification commerciale produit une nouvelle version à valider et accepter.
3. L’accord indique la version et sa preuve. « Oui, mais nous serons vingt » n’est pas un accord sur une offre pour quinze.
4. Après l’accord, un clic humain « Réserver et confirmer » autorise la réservation et son message, liés à la version. Les allocations sont atomiques ; marges et fuseau sont contrôlés.
5. Les appels externes sont hors transaction SQL et passent par des actions durables, idempotence et réconciliation.
6. Un timeout ou un 202 fournisseur ne devient pas une preuve de livraison au client.
7. Une disponibilité inconnue ne devient pas disponible ; un tarif inconnu exige une reprise.
8. Une restauration ne rejoue pas aveuglément les effets externes déjà accomplis.

### Point Outlook décisif
Le verrou PostgreSQL protège les réservations internes. Il ne verrouille pas les créations manuelles indépendantes dans Outlook. La confirmation automatique exige un circuit de réservation maîtrisé et testé. Sinon, conserver confirmation assistée et détection/réconciliation des conflits.

### Séparation de l’IA
Le modèle extrait et formule ; les outils métier décident. Les entrées client ne peuvent modifier les instructions, les droits ou la cave. Chaque appel d’outil est borné, autorisé et journalisé sans secrets.

## 03 · Tranches de développement et livrables

### Tranche A — Fondations utilisables
Après validation des règles et du type de boîte, livrer identité, deux caves de test, rôles, schéma et migrations. Une demande créée manuellement persiste après rechargement. Le catalogue et les ressources sont configurables. Les tests inter-caves passent.

### Tranche B — Demande réelle vers proposition
Ingestion dédupliquée, synchronisation des occupations, extraction IA structurée et évaluée, recherche d’offres admissibles, versions de proposition et validation humaine. Les brouillons restent internes jusqu’à l’envoi autorisé.

### Tranche C — Réservation connectée
Rattachement de l’accord à la version exacte, autorisation humaine « Réserver et confirmer », allocation transactionnelle, outbox, création Outlook avec référence stable, confirmation suivie et reprise des actions incertaines. Tester les échecs avant de démontrer le parcours sur des demandes réelles.

### Tranche D — Pilote puis première production
Onboarding, sécurité, protection des données, sauvegardes/restauration, supervision, support et métriques. Au pilote, la location peut rester humaine. Avant commercialisation, préciser les lots réellement vendus : devis, profil sans Microsoft, canaux et ressources.

### Livrables attendus à chaque tranche
- Code lisible, types et contrats d’API versionnés.
- Migrations et données de test séparées des données métier.
- Tests ciblés sur les invariants et les erreurs du lot.
- Guide local, variables d’environnement d’exemple sans secrets, procédure de déploiement.
- Historique des décisions et captures ou démonstration des parcours.
- Limites et erreurs connues explicitement documentées.

**Backlog :** 40 tickets avec dépendances dans le pack. Affiner les tickets jusqu’à une taille réalisable ; conserver les estimations au niveau des phases jusqu’à la fin du spike.

**Premier jalon de présentation :** une demande réelle produit une proposition corrigeable et approuvable après la tranche B. Il ne faut pas attendre toute la production pour obtenir un retour de Julien.

## 04 · Roadmap, recette et conditions de lancement

| Phase | Effort de cadrage |
|---|---|
| P0 Terrain et faisabilité Microsoft | 3–5 jours |
| P1 Fondations | 6–9 jours |
| P2 Entrées et synchronisation | 8–12 jours |
| P3 IA et propositions | 8–12 jours |
| P4 Réservation et écritures | 12–18 jours |
| P5 Durcissement et périmètres bornés | 8–12 jours |
| P6 Pilote supervisé et corrections | 8–12 jours |
| P7 Lancement et exploitation | 4–6 jours |

Base : 57–86 jours de 7 heures. Avec 20 % de réserve : environ 479–722 heures, soit 32–49 semaines à 15 heures productives par semaine. Un pilote doit aussi durer au moins quatre semaines calendaires. Replanifier après le spike et les premières tranches ; aucune date ferme n’est promise.

### Scénarios critiques de recette
Cent confirmations simultanées sur une ressource exclusive ; notifications dupliquées et hors ordre ; accord sur une ancienne version ; groupe modifié ; conflit externe tardif ; timeout après création Outlook ; envoi incertain ; accès à une autre cave ; révocation OAuth ; redémarrage du worker et restauration de base.

### Passage aux demandes réelles
Droits et cadre de traitement validés, tests critiques réussis, coupe-circuit et sauvegarde restaurée, jeu IA d’au moins 100 cas évalué. Les engagements restent supervisés. Une qualité d’extraction moyenne ne remplace pas les contrôles métier.

### Passage à la première production
Au moins quatre semaines de pilote et 30 demandes éligibles, avec diversité suffisante ; aucun incident critique non résolu ; support opérationnel et procédure de reprise. Objectifs proposés : 80 % de propositions sans correction commerciale majeure, gain médian de 30 % du temps humain, avec le taux de couverture publié.

L’autonomie avancée, le paiement, les réseaux sociaux et la billetterie transactionnelle sont des extensions ultérieures.

## 05 · Brief à transmettre à un développeur ou agent de code

### Instruction de réalisation
Construis EnCave Assistant selon le dossier de référence et le backlog fournis. Commence par lire le POC et dresser le delta entre démonstration et production. Préserve l’indépendance complète avec EnCave. N’interprète aucun texte commercial, budget ou statut du POC comme une donnée réelle de Gilliard.

Exécute d’abord les tickets de cadrage et le spike Microsoft sur une boîte de test autorisée. Documente les décisions bloquantes. Choisis ensuite les versions techniques et livre une tranche verticale avec données persistantes et contrôle des accès. N’implémente pas une longue suite d’écrans sans valider le traitement serveur correspondant.

Utilise un modèle pour l’extraction et la formulation seulement. Toute valeur critique conserve une provenance ; les règles de prix, capacité et disponibilité sont exécutées côté serveur. Les outils sont limités, contrôlés et journalisés. Ne mets aucun secret dans le code, le navigateur ou les prompts.

Toute proposition envoyée est versionnée. Toute acceptation référence exactement les termes envoyés. En A1, après l’accord, le caviste autorise « Réserver et confirmer » sur cette version. Toute réservation utilise une transaction et des actions externes durables. Une erreur ambiguë expose une reprise, sans prétendre que l’opération a réussi. Les appels Microsoft ne forment pas une transaction atomique avec PostgreSQL.

### Première livraison demandée
Dépôt indépendant, configuration locale reproductible, identité, deux caves de test, migrations, demande manuelle persistante, catalogue minimal et tests d’isolation. Fournis les preuves de fonctionnement et les décisions ouvertes avant d’étendre les intégrations.

### Règles de collaboration
- Ne pas modifier la marketplace EnCave.
- Ne pas utiliser les comptes ou données de Julien sans accès et autorisation explicites.
- Ne pas présenter une simulation comme une intégration ou un LLM réel.
- Ne pas élargir les canaux et prestations sans décision de périmètre.
- Faire une revue des contrats, risques et tests à chaque tranche.

### Documents à consulter
Lire ce brief, puis les sections architecture, états, propositions, intégrations, concurrence, sécurité et roadmap du dossier. Utiliser backlog.json comme base de suivi et les contrats du pack comme propositions à implémenter et valider.