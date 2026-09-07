# EnCave Assistant — brief de développement

## 01 · Mission et périmètre de l’application

**Mission de développement :** construire EnCave Assistant, un logiciel indépendant qui reçoit les demandes d’une cave, les qualifie avec l’IA, propose des activités admissibles et prépare les réservations dans un cadre d’autorisation explicite.

**Premier parcours à livrer :** une demande de dégustation reçue par e-mail → informations sourcées → offre et créneau → validation du caviste → accord client sur la version exacte → réservation → écriture calendrier → confirmation traçable.

**Autorité produit :** Sam (Samuel Coppey) décide du périmètre, des priorités, des hypothèses, des critères de livraison et de la mise en production. Julien et les autres interlocuteurs fournissent des retours facultatifs ; aucun entretien, accord de pilote ou délai de réponse externe ne conditionne le développement. Les hypothèses sont documentées sans être présentées comme des faits terrain. Le caviste garde, dans sa propre cave, la validation des engagements clients en A1.

### Utilisateurs et interface
Le caviste dispose de demandes, propositions, réservations, catalogue, connexions et historique. Le visiteur utilise le formulaire du site et l’e-mail, sans compte. Un lien d’acceptation peut présenter l’offre exacte. Prévoir les états incomplets, expirés, en échec et en attente de reprise.

### Périmètre initial
- Microsoft 365 : un connecteur réutilisable pour les comptes professionnels Exchange Online, avec connexion OAuth par cave, sans code ni déploiement par client. Les profils partagés exigent des capacités et droits vérifiés ; voir [connecteurs et onboarding](10-connecteurs-et-onboarding.md).
- Entrées : e-mail, formulaire du site et saisie manuelle après téléphone.
- Visites et dégustations à prix défini : parcours complet supervisé.
- Locations : qualification et reprise humaine dans le périmètre minimal ; devis validé et versionné requis si la réservation de location est incluse dans le périmètre livré.
- Événements externes : catalogue et lien officiel ; aucune vente de places.
- Recommandations : uniquement les offres approuvées de la cave.
- Français, CHF, Europe/Zurich ; champs configurables dans le modèle de données.

### Contraintes fermes
Aucun partage de dépôt, base, authentification, secrets ou code d’exécution avec la marketplace EnCave. Le modèle ne calcule ni le prix final ni l’autorisation de réserver. Le mode initial est supervisé. L’autonomie est activée séparément par cave et action.

Le POC actuellement disponible est une démonstration : moteur local, trois scénarios, export .ics ; aucun LLM, Outlook, e-mail réel ou stockage serveur. Le dossier principal est la référence détaillée.

## 02 · Architecture et invariants à implémenter

### Architecture proposée
Un dépôt propre à EnCave Assistant : apps/web, apps/api, apps/worker, packages/domain, packages/contracts et packages/connectors. Frontend React/TypeScript ; API et worker Node/TypeScript ; PostgreSQL géré ; identité OIDC. Une outbox et une file PostgreSQL suffisent au départ. Verrouiller les versions et les prestataires par ADR sous la responsabilité de Sam ; le spike Microsoft affine le connecteur et ne bloque pas les fondations. L’hébergement du POC n’est pas imposé.

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
À partir des règles produit et fixtures documentées, livrer identité, deux caves de test, rôles, schéma et migrations sans accès client requis. Une demande créée manuellement persiste après rechargement. Le catalogue et les ressources sont configurables. Les tests inter-caves passent.

### Tranche B — Demande réelle vers proposition
Ingestion dédupliquée, synchronisation des occupations, extraction IA structurée et évaluée, recherche d’offres admissibles, versions de proposition et validation humaine. Les brouillons restent internes jusqu’à l’envoi autorisé.

### Tranche C — Réservation connectée
Rattachement de l’accord à la version exacte, autorisation humaine « Réserver et confirmer », allocation transactionnelle, outbox, création Outlook avec référence stable, confirmation suivie et reprise des actions incertaines. Tester les échecs avant de démontrer le parcours sur des demandes réelles.

### Tranche D — Recette et première production décidée par Sam
Onboarding, sécurité, protection des données, sauvegardes/restauration, supervision, support et métriques. Dans le périmètre minimal, la location peut rester humaine. Avant commercialisation, préciser les lots réellement vendus : devis, profil sans Microsoft, canaux et ressources.

### Livrables attendus à chaque tranche
- Code lisible, types et contrats d’API versionnés.
- Migrations et données de test séparées des données métier.
- Tests ciblés sur les invariants et les erreurs du lot.
- Guide local, variables d’environnement d’exemple sans secrets, procédure de déploiement.
- Historique des décisions et captures ou démonstration des parcours.
- Limites et erreurs connues explicitement documentées.

**Backlog :** 40 tickets produit, complétés par les tickets du dépôt et leurs dépendances dans [le backlog actif](../../backlog/tickets.json). Affiner les tickets jusqu’à une taille réalisable ; conserver les estimations au niveau des phases jusqu’à la fin du spike.

**Premier jalon de présentation :** une demande de test représentative produit une proposition corrigeable et approuvable après la tranche B. Sam peut démontrer cette tranche à tout prospect ; un retour de Julien reste une possibilité, sans dépendance de livraison.

## 04 · Roadmap, recette et conditions de lancement

| Phase | Effort de cadrage |
|---|---|
| P0 Hypothèses produit et contrat de connecteur | 3–5 jours |
| P1 Fondations | 6–9 jours |
| P2 Entrées et synchronisation | 8–12 jours |
| P3 IA et propositions | 8–12 jours |
| P4 Réservation et écritures | 12–18 jours |
| P5 Durcissement et périmètres bornés | 8–12 jours |
| P6 Recette supervisée et corrections | 8–12 jours |
| P7 Lancement et exploitation | 4–6 jours |

Base : 57–86 jours de 7 heures. Avec 20 % de réserve : environ 479–722 heures, soit 32–49 semaines à 15 heures productives par semaine. Une observation terrain de quatre semaines et 30 demandes constitue un objectif facultatif de mesure de valeur, indépendant de la décision de livraison technique. Replanifier après le spike et les premières tranches ; aucune date ferme n’est promise.

### Scénarios critiques de recette
Cent confirmations simultanées sur une ressource exclusive ; notifications dupliquées et hors ordre ; accord sur une ancienne version ; groupe modifié ; conflit externe tardif ; timeout après création Outlook ; envoi incertain ; accès à une autre cave ; révocation OAuth ; redémarrage du worker et restauration de base.

### Passage aux demandes réelles
Droits et cadre de traitement validés, tests critiques réussis, coupe-circuit et sauvegarde restaurée, jeu IA d’au moins 100 cas évalué. Les engagements restent supervisés. Une qualité d’extraction moyenne ne remplace pas les contrôles métier.

### Passage à la première production
Sam décide du lancement sur les preuves techniques du périmètre vendu : scénarios critiques, évaluations IA applicables, isolation, restauration, supervision, support et reprise réussis ; aucun incident critique non résolu. Le connecteur Microsoft exige en plus ses preuves sur deux organisations de test indépendantes avant d’être annoncé comme disponible. Son indisponibilité ne bloque pas une livraison du périmètre sans Microsoft déjà testé. Les objectifs de valeur — 80 % de propositions sans correction commerciale majeure et gain médian de 30 % du temps humain — se mesurent ensuite ; ils ne sont ni acquis ni un veto donné à un prospect.

L’autonomie avancée, le paiement, les réseaux sociaux et la billetterie transactionnelle sont des extensions ultérieures.

## 05 · Brief à transmettre à un développeur ou agent de code

### Instruction de réalisation
Construis EnCave Assistant selon le dossier de référence et le backlog fournis. Lis les limites documentées du POC ; inspecte son code s’il est disponible, sans faire de cet accès un prérequis. Préserve l’indépendance complète avec EnCave. N’interprète aucun texte commercial, budget ou statut du POC comme une donnée réelle de Gilliard.

Formalise d’abord les hypothèses et critères sur fixtures, puis livre les fondations persistantes et les contrôles d’accès. Développe le connecteur sur contrats et simulateur explicite ; le test réel utilise des comptes autorisés contrôlés par Sam, sans dépendance à Julien. Un accès externe absent bloque uniquement la vérification ou l’activation concernée, pas les tickets indépendants. N’implémente pas une longue suite d’écrans sans valider le traitement serveur correspondant.

Utilise un modèle pour l’extraction et la formulation seulement. Toute valeur critique conserve une provenance ; les règles de prix, capacité et disponibilité sont exécutées côté serveur. Les outils sont limités, contrôlés et journalisés. Ne mets aucun secret dans le code, le navigateur ou les prompts.

Toute proposition envoyée est versionnée. Toute acceptation référence exactement les termes envoyés. En A1, après l’accord, le caviste autorise « Réserver et confirmer » sur cette version. Toute réservation utilise une transaction et des actions externes durables. Une erreur ambiguë expose une reprise, sans prétendre que l’opération a réussi. Les appels Microsoft ne forment pas une transaction atomique avec PostgreSQL.

### Première livraison demandée
Dépôt indépendant, configuration locale reproductible, identité, deux caves de test, migrations, demande manuelle persistante, catalogue minimal et tests d’isolation. Fournis les preuves de fonctionnement et les décisions ouvertes avant d’étendre les intégrations.

### Règles de collaboration
- Ne pas modifier la marketplace EnCave.
- Utiliser par défaut des données synthétiques et des comptes de test contrôlés par Sam. Les données ou comptes d’un client requièrent son autorisation pour sa seule mise en service ; aucun prospect n’est un prérequis de développement.
- Ne pas présenter une simulation comme une intégration ou un LLM réel.
- Sam arbitre les changements de périmètre ; les agents appliquent les décisions et leur délégation documentée sans attendre une validation de Julien ou d’un autre stakeholder.
- Faire une revue des contrats, risques et tests à chaque tranche.

### Documents à consulter
Lire ce brief, puis les sections architecture, états, propositions, intégrations, concurrence, sécurité et roadmap du dossier. Utiliser [backlog/tickets.json](../../backlog/tickets.json) comme base de suivi et les contrats du pack comme propositions à implémenter et valider.
