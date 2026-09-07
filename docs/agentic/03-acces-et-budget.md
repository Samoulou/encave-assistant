# Accès, décisions et budget

Préparer les accès au moment où ils deviennent nécessaires. Aucun compte ni engagement de Julien n'est acquis par la présence du pack.

| Moment | À préparer |
|---|---|
| INIT-01 | Git, Python, Node/npm ; CLI connecté seulement pour le contrôleur local, tâche directe possible dans Codex |
| Cadrage EA | Réponses terrain sourcées, interlocuteur de décision, règles et catalogue à confirmer |
| Spike Microsoft | Tenant, boîte, calendrier et destinataires de test explicitement autorisés ; droits validés |
| Fondations | Décision d'architecture, DB et identité de test ; deux caves fictives isolées |
| Livraison | Prestataires choisis, environnements et secrets séparés, procédure de reprise |

La configuration du projet complète celle du poste ; des règles d'organisation peuvent imposer des restrictions. Formalisation/revue sont en lecture seule, sans réseau pour leurs commandes ; développement utilise `workspace-write` avec `development_network_access=true` pour gérer dépendances et lockfile. Le contrôleur exécute `prepare_commands`, initialement `npm ci`, dans chaque worktree. Un environnement avec miroir/cache peut fixer le réseau du développeur à `false` après validation. Cela ne donne aucun accès de production. Un refus reste un blocage ; ne pas contourner approbations ou sandbox. [Permissions](https://learn.chatgpt.com/docs/agent-approvals-security), [configuration](https://learn.chatgpt.com/docs/config-file/config-basic).

Conserver les identifiants hors dépôt : authentification CLI dans son stockage prévu, variables sensibles dans un gestionnaire de secrets ou des fichiers locaux exclus de Git. Ne pas copier le cache d'authentification dans les preuves. Les tests doivent utiliser des données fictives ou des données réellement autorisées et minimisées. [Authentification](https://learn.chatgpt.com/docs/auth).

La politique borne les appels et le temps, **pas le coût fournisseur en CHF**. Avant une série de tickets, choisir le modèle accessible, relever son tarif ou les conditions du forfait, définir le budget du compte et le seuil d'arrêt, puis surveiller l'usage réel. Un timeout peut consommer du quota. La campagne borne aussi les appels et le temps cumulés sans les réinitialiser à la reprise ; voir [le guide de campagne](09-campagne-autonome.md). Un essai limité reste possible, sans être une confirmation obligatoire entre tickets.

Séparer coûts de développement Codex, API IA du futur produit, hébergement et Microsoft. Aucun montant, modèle disponible, crédit ou plafond financier n'est garanti par ce kit.

## Portée réelle de l’isolation

La sandbox limite les sessions Codex. Le contrôleur lance npm ci, les tests et Git comme processus locaux avec ses propres droits, son réseau et son environnement. Prévoir une machine ou VM dédiée au projet pour le mode sans surveillance, sans montages ni secrets de production. Les protections par empreintes empêchent des incohérences courantes ; elles ne confinent pas un script de test hostile. Ne pas injecter de clé API dans l’environnement global d’un processus qui exécute du code du dépôt. Le CLI local peut réutiliser une connexion dédiée ; la CI de ce kit ne lance aucun LLM.
