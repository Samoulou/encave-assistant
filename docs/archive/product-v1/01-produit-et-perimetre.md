# EnCave Assistant — documentation de référence

Version 1.0 · 7 septembre 2026

## 01 · Brief produit et décisions de départ

**EnCave Assistant est un assistant de réservation pour les caves.** Il transforme les demandes reçues par e-mail, formulaire ou téléphone en propositions adaptées, puis en réservations suivies dans les outils de la cave. Il peut informer et recommander des activités de son catalogue. Le responsable garde la maîtrise des engagements commerciaux.

**Pitch :** « Votre assistant traite les demandes de visites et d’événements, trouve les possibilités et prépare les réservations pendant que vous accueillez vos clients. »

### Décisions retenues pour lancer le développement
- Produit, dépôt Git, comptes, base de données, secrets et déploiements indépendants de la marketplace EnCave. Aucune dépendance d’exécution à son code.
- Une seule application métier avec un agent outillé et des traitements asynchrones. Chaque action passe par des règles serveur et des autorisations.
- Première intégration : Microsoft 365. Premières entrées : e-mail, formulaire du site et saisie manuelle après un appel. Le téléphone n’est pas décroché par une IA.
- Première réservation automatisable : visite ou dégustation à prix et règles connus. Location : qualification et devis validé par un humain. Événement externe : information et lien vers la billetterie.
- Mode initial supervisé. L’autonomie s’active ensuite action par action et cave par cave, sur la base de résultats mesurés.

### Ce document permet de démarrer
Le brief fixe la cible ; les spécifications décrivent les parcours et invariants ; le backlog ordonne les travaux ; la roadmap définit les jalons et les preuves nécessaires à chaque passage. Les contrats proposés sont des bases de développement à valider par des tests et des revues, pas un logiciel déjà conforme ou certifié.

**État au 7 septembre 2026 :** un POC de parcours est déployé. Son moteur applique certaines règles de disponibilité, mais l’IA, Microsoft 365, le stockage serveur et les canaux réels restent à construire. Julien est un interlocuteur de découverte ; aucun engagement de pilote ni achat n’a été confirmé.

**Version :** 1.0 — dossier de référence après POC. Les anciennes propositions de base partagée avec EnCave sont abandonnées. Les durées et prix présents dans le POC sont fictifs.

## 02 · Utilisateurs, problèmes et valeur attendue

### Ce que nous savons de Julien
Julien, responsable œnotourisme de la Maison Gilliard, décrit un fonctionnement principalement fondé sur Outlook et plusieurs plateformes. Il indique que les réservations en ligne représentent une petite part de l’ensemble, à l’exception d’événements comme la Tavolata ou la Balade des Grands Murs. Ces éléments viennent de son échange fourni par Samuel, sans audit de ses outils.

Le temps perdu, le volume de demandes, le nombre de ressaisies et les erreurs ne sont pas encore quantifiés. L’hypothèse de valeur est la réduction du traitement administratif, des délais de réponse et des demandes oubliées. Aucun gain chiffré n’est acquis.

### Trois utilisateurs à servir
**Responsable œnotourisme :** suit plusieurs salles, activités et collaborateurs. Il doit voir pourquoi une proposition convient, connaître les actions effectuées et reprendre un dossier sans perdre les échanges.

**Petite cave :** une personne accueille et répond aux clients. Elle a besoin d’un catalogue simple, d’un agenda et de quelques règles, avec peu de configuration. Le produit doit rester utilisable avec formulaire et saisie manuelle même sans connecteur Microsoft.

**Visiteur :** décrit son projet, reçoit une offre compréhensible et confirme. Il ne crée pas de compte EnCave Assistant. Les communications portent le nom de la cave ; l’usage de l’automatisation est présenté de manière transparente selon la politique retenue.

### Ce que la cave achète
- Une demande centralisée et suivie jusqu’à son résultat.
- Moins de questions et de saisies répétées par son équipe.
- Des propositions cohérentes avec ses offres, ressources et règles.
- Une automatisation observable et désactivable, avec reprise humaine.

### Mesure avant et pendant le pilote
Sur un échantillon de demandes réelles anonymisées, relever le canal, le type, le temps actif de traitement, les échanges, le résultat et les corrections. Mesurer ensuite les mêmes indicateurs avec le produit. Comparer des demandes de complexité similaire ; distinguer le délai d’attente du client et le travail de la cave. Le nombre de réponses produites ne suffit pas à prouver la valeur.

## 03 · Périmètre par version et exclusions

| Capacité | Pilote connecté | Première production |
|---|---|---|
| Visite/dégustation à prix défini | Parcours complet supervisé | Parcours complet supervisé (A1) |
| Location de salle | Qualification, créneau, reprise humaine | Devis versionné, accord et réservation supervisée |
| Événement ponctuel externe | FAQ et orientation | Catalogue et liens officiels maintenus |
| Recommandation | Catalogue de la cave uniquement | Même limite, classement explicable |
| E-mail Microsoft 365 | Une boîte et un calendrier testés | Connexions par cave, surveillance et reprise |
| Formulaire et saisie manuelle | Entrées réelles simples | Installation standardisée et protection anti-abus |
| Petite cave sans Microsoft | Saisie, formulaire, agenda interne | Canal sortant vérifié et réponses rattachées |
| Gestion de plusieurs caves | Cloisonnement testé dès le départ | Onboarding, rôles et quotas par cave |

### Périmètre métier de lancement
Langue d’interface et de réponse : français ; devise : CHF ; fuseau initial Europe/Zurich. Le modèle de données conserve langue, devise et fuseau par cave pour permettre l’extension. Une demande dans une autre langue est signalée et traitée manuellement tant que cette langue n’est pas évaluée.

Un événement interne peut figurer au catalogue et être recommandé. La création de sessions, la vente de places, le paiement, les QR codes et le contrôle des entrées nécessitent un module ou un connecteur distinct, hors première production.

### Hors périmètre initial
- Marketplace multi-producteurs et recherche ouverte sur le Web pour recommander des activités.
- Stock de vin, commandes de bouteilles, ERP, caisse, comptabilité ou CRM complet.
- Encaissement d’acomptes, remboursement automatique et validation juridique de contrats.
- WhatsApp, Instagram, SMS, chat vocal et agent téléphonique.
- Campagnes commerciales et relances marketing autonomes.
- Organisateur d’événements généraliste et coordination de prestataires externes.

Les ajouts passent par une décision de périmètre et une estimation. La réservation après devis et le profil sans Microsoft sont des lots identifiés ; ils ne doivent pas retarder le test du parcours principal avec Julien.

## 04 · État réel du POC et réutilisation

**POC :** [EnCave Assistant — démonstration privée](https://encave-assistant-poc.sam-copp8.chatgpt.site). Source examinée : dépôt indépendant du POC, commit `9280143430c179b0da7840891ee810908688a872`.

| Élément | État constaté | Traitement pour la production |
|---|---|---|
| Demandes, vues cave/client, agenda | Interface React fonctionnelle | Réutiliser les composants utiles ; séparer les modules |
| Capacité, budget, durée et ressources | Calculs déterministes | Porter au serveur et rendre les règles configurables |
| Accord puis confirmation | Parcours simulé | Versions immuables et preuve d’accord |
| Conflit avant confirmation | Contrôle en mémoire | Transaction, verrou et réconciliation externe |
| Envoi d’e-mail / lecture Outlook | Simulation | Adaptateurs, consentement et tests de connexion |
| Analyse IA | Absente | Extraction structurée et évaluations |
| Données, comptes, isolation | État du navigateur | Authentification, base serveur et contrôle des accès |
| Export calendrier | Fichier .ics de démonstration | Export facultatif, distinct de la synchronisation |

### Références du code
`app/workspace.tsx` contient les écrans et les transitions locales. `lib/poc/engine.ts` contient les règles, les données fictives, la confirmation et l’export. `tests/poc.test.mjs` couvre huit scénarios métier ; `tests/rendered-html.test.mjs` vérifie le rendu serveur. `db/schema.ts` ne définit pas le modèle de production.

Les tests passés du POC prouvent ces comportements locaux. Ils ne prouvent ni la fiabilité d’une IA, ni l’absence de conflits entre plusieurs utilisateurs, ni une intégration Outlook.

### Écarts à corriger en premier
La réponse est librement éditable alors que l’accord et la réservation utilisent les champs structurés. Il faut empêcher qu’un tarif ou un créneau envoyé diffère de celui réellement accepté et réservé. Les données disparaissent au rechargement. Aucune transaction inter-utilisateurs, autorisation par cave, gestion de jetons ni preuve d’envoi n’existe.

Le POC conserve sa fonction de démonstration. La production part d’un dépôt indépendant ou d’une branche de travail de ce dépôt, avec une migration explicite. Ne pas copier les fixtures, règles figées ou statuts de simulation dans les données de production.

## 05 · Écrans et expérience utilisateur

### Application du caviste
**Demandes :** boîte de travail regroupant les conversations. Chaque ligne expose le client, l’objet, le canal, la prochaine action, l’échéance et le responsable. Filtres utiles : à traiter, attente client, erreur, réservée et archivée. Le détail présente les messages, les informations extraites et leurs sources.

**Proposition :** choix d’une offre admissible, date, créneau, participants et prix. La vue expose les données manquantes, les règles appliquées, les ressources consultées et la fraîcheur des disponibilités. L’utilisateur corrige les données structurées ; le message est régénéré à partir de la même version.

**Réservations et agenda :** ressources occupées, options éventuelles, réservations confirmées et synchronisation Outlook. Une réservation interne peut être en cours de synchronisation ; ce statut doit être distinct d’une confirmation client envoyée.

**Catalogue et règles :** offres, tarifs, capacité, durée, disponibilité, délais, conditions et liens officiels. Les règles d’un produit ne s’appliquent pas automatiquement à tous les autres.

**Connexions et paramètres :** cave, collaborateurs, expéditeur, boîte, calendriers, autorisations de l’agent, limites d’usage et santé des connexions. Une erreur indique l’action attendue et bloque les seuls automatismes concernés.

### Côté visiteur
Le visiteur utilise le site de la cave et ses e-mails. Un formulaire recueille le besoin sans imposer une offre connue. Un lien sécurisé peut présenter la proposition exacte et permettre de l’accepter sans créer de compte. Un message ambigu, par exemple « OK mais nous serons vingt », modifie la demande et exige une nouvelle proposition.

### États à dessiner avant d’intégrer
Liste vide, demande incomplète, doublon probable, erreur d’extraction, aucune offre, aucune disponibilité, proposition expirée, accord ambigu, conflit tardif, connexion expirée et envoi incertain. Chaque état possède une prochaine action et une reprise humaine.

Interface utilisable sur téléphone et clavier : libellés explicites, contraste vérifié, champs avec erreurs associées, dialogues accessibles et statuts compréhensibles sans dépendre de la couleur. Les détails techniques restent dans un panneau de diagnostic réservé aux opérateurs.

## 06 · Mise en service d’une cave

### Onboarding administrateur
1. Créer la cave, son fuseau, sa devise, son identité d’expéditeur et un premier administrateur.
2. Choisir le fonctionnement : agenda interne de référence ou agenda Microsoft 365 connecté. Désigner les ressources et leur source de vérité.
3. Renseigner les offres, prix, taxes affichées, capacités, durées, préparation, personnel et conditions.
4. Définir les heures de réponse, les délais de réservation, les exceptions et le transfert à un humain.
5. Connecter la boîte et les calendriers autorisés ; vérifier lecture, renouvellement des accès et écriture sur un calendrier de test.
6. Installer le formulaire ou activer la saisie manuelle, puis vérifier le chemin de réponse vers la demande.
7. Exécuter les scénarios de recette de la cave et activer le mode supervisé.

### Minimum pour une petite cave
Une offre, une ressource, une durée, un tarif, des disponibilités et un responsable peuvent suffire. Les formulaires et la saisie restent possibles sans Microsoft. Le canal sortant doit toutefois être réellement configuré : domaine expéditeur vérifié ou compte de messagerie autorisé. Aucun e-mail ne doit être envoyé en usurpant l’adresse du domaine.

### Source de vérité
Pour chaque salle et équipe, préciser où les occupations sont créées et modifiées. En mode agenda interne, les réservations passent par le produit. En mode Outlook, les occupations externes sont importées et vérifiées avant un engagement. Si les règles ou les ressources sont incomplètes, l’agent peut qualifier une demande mais pas confirmer seul sa réservation.

### Données nécessaires avant le premier pilote
Catalogue validé et propriétaire de chaque tarif ; captures ou exports anonymisés de demandes ; structure des calendriers ; règles de prix et de capacité ; durées tampon ; conditions d’annulation ; personnes qui valident les exceptions ; politique d’accès et de conservation.

Le dossier de mise en service conserve la version des règles, les tests réussis, la date d’activation et le nom du responsable. La simple réussite de la connexion OAuth n’équivaut pas à une cave prête pour les réservations.