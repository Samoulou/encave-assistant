# EnCave Assistant — documentation de référence

Version 1.0 · 7 septembre 2026

## 14 · Agent IA : responsabilité et autorisations

### Architecture d’un agent utile
Un orchestrateur charge la demande, les données de la cave et sa politique. Le modèle interprète et formule ; le moteur métier filtre les offres, calcule les prix, détermine les disponibilités et autorise les engagements. Les appels d’outils sont bornés en durée, nombre et coût.

Outils de lecture : lire le dossier, chercher dans le catalogue approuvé, consulter les règles et demander un calcul de disponibilité. Outils de préparation : proposer des champs, préparer une question ou un brouillon. Outils d’action : demander une validation, planifier un envoi, confirmer une réservation ou déclencher une reprise. Chaque outil contrôle à nouveau tenant, rôle, état et idempotence.

### Politique d’autonomie par cave
| Niveau | Autorisations |
|---|---|
| A0 — Observation | Analyse et suggestions visibles, aucune action sortante |
| A1 — Supervision | Envoi et réservation après validation explicite |
| A2 — Délégation limitée | Questions simples et FAQ approuvées selon règles |
| A3 — Réservation standard | Offre fixe, accord exact, ressources fiables et limites validées |

En A1, une première validation autorise l’envoi de la proposition. Après l’accord client, un second clic « Réserver et confirmer » autorise la réservation et sa confirmation, sous réserve des contrôles et du succès des écritures nécessaires. L’autorisation est liée à la version et journalisée. A2 et A3 sont des capacités optionnelles, activées après évaluation et révocables immédiatement. Le système n’augmente pas seul son niveau d’autonomie.

### Transfert humain obligatoire
Prix ou règle absents ; devis sur mesure ; données contradictoires ; accord ambigu ; action externe incertaine ; ressources impossibles à vérifier ; demande inhabituelle ; annulation avec conséquences financières. Le transfert contient le contexte, les points manquants et une prochaine action.

### Isolation des instructions
Les e-mails, pièces jointes et fiches importées sont des données non fiables. Ils ne peuvent modifier les règles de l’agent, demander un accès à une autre cave ou autoriser une action. Un message demandant d’ignorer les validations doit rester un message client.

La réussite attendue est une action correcte et traçable. Un texte fluide ou une auto-évaluation de confiance élevée ne suffit pas à autoriser une réservation.

## 15 · Extraction IA, connaissances et évaluations

### Contrat d’extraction
Retour attendu : intention, langue, participants, période/date, horaire, budget et unité, activité souhaitée, contraintes, éléments manquants et contradictions. Chaque champ porte sa valeur, sa provenance (message et fragment utile), ainsi que son statut : explicite, à confirmer ou inconnu.

Une sortie structurée respecte un schéma validé côté serveur, avec bornes de taille et valeurs autorisées. Le serveur rejette une date invalide, un groupe négatif, une devise inconnue ou un identifiant d’offre étranger à la cave. Structured Outputs aide à respecter un schéma ; cela ne garantit pas la véracité du contenu. Voir [S11].

### Gestion des connaissances
Le catalogue et les règles structurées sont prioritaires. Pour le pilote, des FAQ courtes validées suffisent ; une base vectorielle n’est pas nécessaire par défaut. Si des documents sont ajoutés, indexer leur version, leur cave, leur statut approuvé et leur date d’expiration. Les pièces jointes entrantes passent par des limites, une analyse et une autorisation de traitement adaptées.

### Consignes du modèle
Interpréter le besoin sans inventer ; utiliser uniquement les offres autorisées ; exposer les informations manquantes ; distinguer demande et accord ; ne pas annoncer une action non confirmée par un outil ; transférer si les sources se contredisent. La politique métier est injectée par le serveur, jamais prise dans un message du client.

### Jeu d’évaluation
Préparer un jeu versionné d’au moins 100 demandes de test, anonymisées ou synthétiques, comprenant 20 cas adverses ou ambigus. Séparer les exemples utilisés pour améliorer les consignes et ceux de recette. Ajouter les corrections de Julien à un jeu de régression après anonymisation.

Comparer extraction exacte des champs critiques, abstention lorsqu’ils sont inconnus, offres admissibles, détection d’accord modifié et appels d’outils autorisés. Toute modification du modèle, des consignes ou des outils passe ces tests avant activation.

**Cibles initiales de recette, à ajuster avec les données :** au moins 95 % d’extraction exacte sur les champs explicites critiques ; au moins 95 % de détection des cas nécessitant clarification dans le jeu dédié ; aucun engagement externe non autorisé dans les tests. La taille limitée du jeu ne prouve pas un risque nul en exploitation.

## 16 · Microsoft 365 : périmètre et accès

Utiliser Outlook comme logiciel ne prouve pas qu’il s’agit d’une boîte Exchange Online. Identifier le fournisseur, le type de boîte, le calendrier, son propriétaire, les délégations et les personnes qui y écrivent. Le pilote ne doit pas supposer une configuration inconnue. [S1]

### Deux chemins d’intégration à distinguer
**Boîte professionnelle propre et calendrier principal :** premier chemin de test proposé. OAuth délégué, accès minimal nécessaire à la lecture des messages, à l’envoi et à l’écriture du calendrier. Les scopes envisagés sont Mail.Read, Mail.Send, Calendars.ReadWrite, offline_access et les scopes d’identité utiles. La politique du tenant peut exiger un consentement administrateur. [S2]

**Boîte ou calendrier partagés :** test dédié avant engagement. Les permissions déléguées Shared ne permettent pas les abonnements webhook sur les dossiers partagés. Pour un agent en arrière-plan, évaluer un accès applicatif Exchange RBAC limité aux boîtes autorisées, avec l’administrateur du client. Des droits Entra globaux équivalents conservés en parallèle peuvent élargir cet accès : les autorisations s’additionnent. [S3] [S4]

### Principe de moindre privilège
Un filtre de dossier dans l’application ne réduit pas automatiquement les droits OAuth. Ne pas demander contacts, annuaire complet ou fichiers sans besoin. Écrire des brouillons directement dans Outlook constitue un besoin distinct et peut nécessiter Mail.ReadWrite. Le pilote peut conserver les brouillons dans EnCave Assistant.

En accès délégué, l’envoi depuis une autre boîte requiert Mail.Send.Shared et Send As ou Send on Behalf. En accès applicatif, il dépend du rôle Mail.Send et du périmètre de boîtes autorisé. La connexion est rattachée à la cave par le serveur, avec identifiant du tenant Microsoft, boîte autorisée et liste de calendriers. [S20]

### Test de faisabilité EA-02
Lire une demande fictive ; détecter sa réception ; lire une occupation ; créer puis retrouver un événement de test ; envoyer un message à une adresse de test autorisée ; renouveler l’accès ; révoquer puis reconnecter ; prouver le refus d’accès hors périmètre. Conserver les résultats et les limitations.

Si ce test échoue, ajuster l’accès ou utiliser provisoirement saisie/formulaire et agenda interne. Ne pas présenter cette solution provisoire comme une intégration Microsoft opérationnelle.

## 17 · Synchronisation, webhooks et effets externes

### Réception et reprise
L’endpoint de notifications est HTTPS. Il répond à la validation initiale selon le protocole Microsoft. Les notifications normales sont vérifiées, rattachées à un abonnement connu, enregistrées durablement puis acquittées avec une cible sous 3 secondes ; l’IA ne s’exécute pas pendant cet acquittement. Microsoft distingue notamment réponse de validation sous 10 secondes et traitement/acquittement rapide des notifications. [S6]

Planifier le renouvellement avant expiration. Les limites documentées pour Outlook sont de 10 080 minutes sans données enrichies et 1 440 minutes avec données enrichies ; utiliser la valeur retournée plutôt qu’une durée codée en dur. Le pilote privilégie les notifications simples et la lecture Graph ciblée. [S5]

Gérer notifications dupliquées, perdues ou hors ordre, révocation, abonnement supprimé et curseur invalide. Les messages utilisent une synchronisation delta par dossier et des liens de pagination conservés comme valeurs opaques. Les webhooks signalent un changement ; ils ne sont pas un journal exhaustif. [S7]

### Calendriers
La référence event:delta v1.0 décrit une vue du calendrier principal. Vérifier le chemin supporté pour le calendrier choisi ; ne pas promettre delta universel pour les calendriers secondaires ou partagés. Au besoin, relire une calendarView bornée et réconcilier créations, modifications, suppressions et récurrences. [S18]

### Écriture et envoi
Une réservation et son intention d’écriture sont persistées ensemble. Le worker crée l’événement avec une clé transactionId stable, conserve son identifiant et son état, puis planifie la confirmation client. transactionId aide contre les créations répétées ; ce n’est pas un verrou de ressource. [S8]

Un 202 de sendMail signifie acceptation du traitement, pas réception par le client. Distinguer envoi accepté, échec connu et résultat incertain. Après une réponse réseau perdue, réconcilier avant de répéter l’action. [S9]

Respecter Retry-After et limiter les relances sur erreurs 429 ou transitoires. Une erreur persistante suspend l’action, alerte l’opérateur et laisse la demande visible. La déconnexion arrête les nouveaux effets, sans effacer les réservations existantes. [S19]

## 18 · Canaux d’entrée et rapprochement des échanges

### E-mail
Dédupliquer avec une clé technique comprenant cave, boîte et identifiant du message. Conserver identifiants de conversation et références de réponse. Préférer les identifiants immuables Outlook lorsqu’ils sont supportés ; les déplacements ne doivent pas recréer les demandes.

Un même fil peut contenir une modification, une nouvelle question ou une autre réservation. L’agent propose le rattachement ; les cas ambigus sont revus. Les messages automatiques, accusés, rebonds et réponses d’absence ne déclenchent pas une boucle d’assistants. Prévoir détection et quotas de réponses par conversation.

### Formulaire du site
Intégration par formulaire embarqué ou endpoint contrôlé, compatible avec le site WordPress de la cave sans dépendre d’EnCave. Champs minimaux : nom, moyen de réponse et besoin. Date, participants et budget restent facultatifs lorsqu’une demande peut être qualifiée ensuite.

Contrôler taille, types, débit, anti-spam et origine lorsque pertinent ; l’origine seule n’est pas une authentification. La cave est résolue depuis une configuration serveur, pas depuis un tenant_id libre envoyé par le navigateur. Les identifiants publics de formulaire ne sont pas des secrets.

### Téléphone et accueil sur place
Le caviste crée une demande ou ajoute une note au dossier. Il distingue paroles du client et décision interne. Une note « client d’accord » exige les mêmes références d’offre, termes et acteur que l’accord reçu par e-mail. Le POC ne constitue pas un agent vocal.

### Petite cave sans Microsoft
Formulaire et saisie utilisent l’agenda interne. Le canal sortant doit être fourni par un prestataire e-mail autorisé avec expéditeur vérifié. Les réponses entrantes doivent rejoindre le dossier par un mécanisme testé ou être saisies manuellement dans un mode clairement signalé. Ce profil représente un lot propre, estimé dans le durcissement et l’onboarding.

### Doublons probables et identité
Deux canaux peuvent concerner le même client sans être des doublons certains. Suggérer une fusion avec aperçu des messages et conservation de la traçabilité. Ne pas fusionner automatiquement sur le nom seul. Les droits d’accès aux propositions restent séparés du rapprochement statistique des contacts.