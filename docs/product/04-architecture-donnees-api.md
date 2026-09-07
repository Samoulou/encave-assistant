# EnCave Assistant — documentation de référence

Version 1.1 · 7 septembre 2026 — gouvernance Sam et connexions génériques

## 19 · Architecture de référence proposée

**Choix recommandé pour démarrer :** un dépôt EnCave Assistant, un backend métier modulaire et un worker. Ce choix est proposé pour la production ; le POC reste une démonstration React/Vinext indépendante.

| Composant | Responsabilité | Proposition technique |
|---|---|---|
| Application web | Écrans, validation, suivi | React/TypeScript ; Next.js stable verrouillé |
| API métier | Identité, états, commandes, règles | Node.js/TypeScript ; modules testables |
| Base | Données, contraintes, transactions | PostgreSQL géré, sauvegardes et PITR |
| Worker | IA, Graph, envois, réconciliation | Processus Node durable, tâches avec bail |
| File initiale | Travail durable et reprises | Outbox/jobs PostgreSQL, sans Redis requis |
| Identité | Connexion des collaborateurs | Fournisseur OIDC ; rôles gérés par le produit |
| Fournisseurs | IA, Microsoft, e-mail alternatif | Adaptateurs serveur interchangeables |

### Organisation du code
`apps/web`, `apps/api`, `apps/worker`, `packages/domain`, `packages/contracts`, `packages/connectors`, `tests`, `evals`, `ops` et `docs`. Ces packages appartiennent uniquement à EnCave Assistant ; aucun import depuis la marketplace.

La couche domaine ne connaît pas les SDK externes. Une interface de calendrier peut exposer lecture des occupations, création idempotente, lecture d’une écriture et annulation contrôlée. Les événements fournisseur sont traduits en objets métier avant traitement. Le contrat distingue messagerie, calendrier et santé de connexion ; chaque capacité peut être indisponible. Le même adaptateur sert toutes les caves et reçoit un contexte serveur vérifié, jamais des secrets ou un tenant choisis par le modèle. Aucun code, variable d’environnement client ou déploiement spécifique n’est nécessaire pour ajouter une cave compatible ; voir [les contrats de connexion](10-connecteurs-et-onboarding.md).

### Hébergement
Séparer développement, préproduction et production, avec bases et secrets distincts. Choisir des services gérés dans des régions évaluées pour données, support et sauvegardes. Le frontend peut être hébergé séparément ; l’API et le worker doivent pouvoir poursuivre et reprendre les tâches sans dépendre d’une requête navigateur.

Sam porte la sélection des prestataires et versions exactes par ADR au démarrage. Le test Microsoft précise les capacités de son adaptateur sans conditionner la création du noyau ; les conditions de traitement sont examinées avant les données réelles. Ne pas imposer la plateforme d’hébergement du POC à la production.

### Alternative raisonnable
Une équipe très à l’aise avec .NET peut conserver le frontend React et écrire le backend en C#. L’effort d’un changement de langage doit être évalué une fois, avant les premières intégrations. Le plan de référence reste TypeScript pour limiter la dispersion.

## 20 · Modèle de données métier

| Ensemble | Objets et données essentielles |
|---|---|
| Organisation | Tenant, Member, Role, AutonomyPolicy, AuditEvent |
| Catalogue | Offer, OfferVersion, PriceRule, Resource, ResourceRule, KnowledgeSource |
| Relation client | Contact, Inquiry, Conversation, Message, ExtractedFact |
| Engagement | Proposal, ProposalVersion, QuoteVersion, Approval, Acceptance |
| Réservation | Booking, ResourceAllocation, BookingChange, ExternalReference |
| Exécution | Action, OutboxEvent, Job, DeliveryAttempt, SyncCursor, Subscription |
| Connexions | Connection, CredentialReference, ConnectionScope, ConnectionCapability, ConnectionHealth, OAuthAttempt, ResourceBinding |
| Exploitation | UsageLedger, Incident, RetentionPolicy, ExportRequest |

### Champs transverses
Identifiant stable, tenant_id, date de création, date de modification, version optimiste et acteur pertinent. Les identifiants externes sont accompagnés du fournisseur, de la boîte ou du calendrier et de la connexion. Une référence de fournisseur seule ne définit jamais la cave. `tenant_id` désigne exclusivement la cave interne ; `provider_tenant_id` désigne l’organisation Microsoft. Les deux ne sont pas interchangeables et aucune relation un-à-un implicite n’est autorisée. Les identifiants de compte/boîte/calendrier sont uniques dans leur portée fournisseur et connexion, pas globalement.

### Relations importantes
Une demande contient plusieurs messages et plusieurs propositions successives. Une version de proposition peut recevoir une validation puis un accord. Une réservation utilise exactement une version acceptée et plusieurs allocations de ressources. Elle peut donner lieu à plusieurs actions techniques, chacune avec ses tentatives et son résultat.

### Conserver l’histoire sans exposer inutilement
Les données métier et les données de diagnostic sont séparées. L’historique commercial est lisible ; les logs techniques ne recopient pas les messages clients par défaut. Une suppression peut anonymiser les contacts tout en conservant les éléments nécessaires selon les obligations et la politique validées.

### Import initial
Importer catalogue et ressources dans un brouillon par cave ; valider formats, doublons et cohérence ; faire approuver avant publication. Les données de démonstration restent dans un environnement distinct. Les calendriers existants sont ingérés comme occupations externes ; ils ne deviennent pas arbitrairement des réservations créées par l’agent.

Le pack fournit un dictionnaire de données et des contraintes proposées. Les migrations complètes seront écrites et testées dans le dépôt de production.

## 21 · Contraintes de base et isolation des caves

### Cloisonnement dès la première cave
Toutes les requêtes métier portent le tenant résolu depuis l’identité authentifiée ou une connexion serveur vérifiée. Le navigateur, un webhook ou le modèle ne choisit pas librement ce tenant. Les traitements asynchrones rechargent et contrôlent leur périmètre avant chaque action.

Utiliser des clés étrangères composites ou des contrôles équivalents pour empêcher une proposition de référencer l’offre ou la ressource d’une autre cave. Ajouter des contraintes uniques pour messages, commandes et références externes dans leur portée exacte. Des politiques de sécurité au niveau des lignes peuvent compléter ces contrôles ; le rôle serveur et ses possibilités de contournement sont testés.

### Transactions et concurrence
Une transaction courte verrouille la demande et la version pertinente, vérifie l’accord et alloue toutes les ressources. Elle écrit aussi les événements de l’outbox. Les appels réseau restent hors transaction SQL : un appel lent ne doit pas conserver indéfiniment des verrous métier.

Pour les ressources exclusives, la contrainte d’exclusion doit intégrer la cave, la ressource, les bornes occupées et les statuts bloquants. Les marges sont déjà incluses dans les bornes. Les options expirées sont libérées explicitement ; éviter de dépendre de now() dans un prédicat d’index. [S10]

### Reprises et versions
Chaque commande sensible reçoit une clé d’idempotence et une version attendue. Une même clé avec une charge différente est rejetée. Les modifications concurrentes produisent un conflit explicite, jamais un écrasement silencieux.

Une action réussie reste consultable après redémarrage. Les workers utilisent un bail et une échéance ; les tâches abandonnées sont récupérables. La reprise d’un job ne donne pas une garantie d’exécution unique chez un fournisseur : l’idempotence et la réconciliation sont propres à chaque adaptateur.

### Tests requis
Deux caves avec les mêmes noms de contact et références locales ; accès direct à un identifiant étranger ; export inter-caves ; tâche forgée ; connexion rattachée au mauvais tenant ; cent confirmations concurrentes sur une même ressource. L’environnement de test vérifie le rôle réellement utilisé en production.

## 22 · Contrats API et erreurs attendues

Les contrats du pack sont une proposition d’API métier à versionner. Toute route vérifie identité, tenant, rôle, taille de requête et état métier ; le statut de l’interface n’est pas une autorisation.

| Commande | Effet | Garantie attendue |
|---|---|---|
| POST /v1/inquiries | Créer une demande manuelle | Entrée validée et traçable |
| POST /v1/inquiries/{id}/analyze | Planifier une analyse | Job durable ; réponse 202 |
| POST /v1/inquiries/{id}/proposals | Créer une version | Prix et ressources validés |
| POST /v1/proposals/{id}/approve | Valider la version | Version attendue et acteur |
| POST /v1/proposals/{id}/send | Planifier l’envoi | Version approuvée ; idempotence |
| POST /v1/proposals/{id}/accept | Enregistrer un accord | Preuve liée aux termes exacts |
| POST /v1/bookings | Réserver une offre acceptée | Validation A1, transaction et reprise |
| POST /v1/bookings/{id}/changes | Demander un changement | Nouvelle décision contrôlée |
| GET /v1/actions/{id} | Lire l’avancement | Succès, erreur ou incertitude |

### Enveloppe et sémantique
Les commandes sensibles incluent une clé d’idempotence, une version attendue et un identifiant de corrélation serveur. Un 202 retourne action_id et l’URL de suivi : il ne signifie pas « client confirmé ». Les montants, ressources et destinataires exécutés sont relus côté serveur dans les objets autorisés.

### Erreurs communes
400 : requête illisible ; 401 : non authentifié ; 403 : interdit ; 404 : objet absent ou non visible ; 409 : version périmée, état incompatible ou créneau indisponible ; 422 : données métier invalides ; 429 : quota ; 503 : dépendance indisponible. Le corps contient code stable, message utile, champs concernés et correlation_id, sans jeton ni contenu sensible.

### Acceptation publique
Le lien d’accord utilise une route dédiée avec un jeton limité à une proposition, une expiration et une vérification anti-rejeu. Le clic ouvre les termes ; l’action explicite confirme. Les robots de prévisualisation des e-mails ne doivent jamais accepter une offre par une simple requête GET.

## 23 · Traitements asynchrones et journal d’action

### Outbox transactionnelle
Enregistrer modification métier et intention de travail dans la même transaction PostgreSQL. Le worker prélève les tâches disponibles, pose un bail, exécute et enregistre le résultat. SKIP LOCKED convient au prélèvement concurrent dans une file ; ce n’est pas un mécanisme général de lecture cohérente. [S17]

Chaque job possède tenant_id, type, référence métier, version, clé d’idempotence, compteur d’essais, date de prochaine tentative, propriétaire du bail et erreur résumée. Une action fournisseur porte aussi connection_id et la version d’autorisation attendue ; le worker relit le rattachement cave/connexion, les capacités et la révocation avant exécution. La charge évite les secrets et les copies de messages inutiles.

### Séquence de réservation proposée
1. Vérifier l’accord et l’autorisation humaine « Réserver et confirmer » liée à cette version ; réserver les allocations internes et écrire BookingSyncRequested.
2. Lire l’état externe nécessaire et créer l’événement avec une référence stable.
3. Enregistrer la réponse et les identifiants externes. Si le résultat est inconnu, suspendre puis rechercher l’effet existant.
4. Après satisfaction des préconditions, passer la réservation au statut confirmé et écrire ConfirmationSendRequested.
5. Déclencher l’envoi selon la stratégie du fournisseur ; exposer l’acceptation d’envoi sans prétendre à la livraison.

Une panne après l’étape 2 n’autorise pas la répétition aveugle de la création. Une panne après l’étape 5 peut laisser un envoi incertain. Ces états font partie du produit.

### Politique de reprise
Relances bornées avec délai et variation aléatoire sur erreurs transitoires, respect de Retry-After, puis file d’échecs et attribution à un responsable. Les erreurs d’autorisation ou de validation ne sont pas réessayées indéfiniment. Les réconciliations périodiques rattrapent les événements externes et les tâches expirées.

### Observabilité utile
La fiche d’action expose : demande concernée, décision, autorisation, instantané utilisé, tentative, fournisseur, résultat et prochaine action. L’opérateur peut suspendre, relancer de manière contrôlée ou clore avec un motif. Il ne doit pas modifier librement une charge historique pour masquer un échec.

Les métriques distinguent attente, traitement actif, dépendance externe et temps de reprise. Un redémarrage du worker doit être invisible pour la cohérence du dossier.
