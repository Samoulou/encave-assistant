# Marche à suivre — du dossier au premier ticket

Objectif : démarrer un dépôt indépendant, vérifier son contrôleur puis lui confier **INIT-01**. Ce guide concerne le contrôleur local. Le dépôt GitHub existe déjà ; pour une tâche directe dans Codex, commencer par START-HERE.md.

## 1. Préparer le poste

Sous Windows, le parcours recommandé pour ce kit est Ubuntu dans **WSL2**. Si WSL n'est pas installé, ouvrir PowerShell comme administrateur, exécuter la commande suivante, puis redémarrer et terminer la création du compte Ubuntu. [Installation Microsoft](https://learn.microsoft.com/fr-fr/windows/wsl/install).

```powershell
wsl --install
```

Exécuter ensuite les commandes Bash dans Ubuntu. Installer Git et Python **3.11 ou supérieur** avec le gestionnaire de paquets Ubuntu. Installer **Node.js 24 LTS avec npm** en suivant les instructions Linux de la [page de téléchargement Node.js](https://nodejs.org/en/download). Node sert ici au CLI et aux commandes de tests ; le choix de la stack produit sera consigné après les décisions d'architecture. [Versions Node.js](https://nodejs.org/en/about/previous-releases).

```bash
git --version
python3 --version
node --version
npm --version
```

Cloner le dépôt dans un répertoire de travail Linux, puis l’ouvrir :

```bash
git clone https://github.com/Samoulou/encave-assistant.git
cd encave-assistant
```

Garder ce dépôt entièrement séparé de la marketplace EnCave : code, comptes, base, secrets et déploiements.

## 2. Installer Codex et vérifier la connexion

Installer le CLI via npm, puis noter sa version. La commande sans suffixe installe la version publiée à cet instant ; après le premier essai réussi, conserver cette version exacte dans `docs/decisions/ADR-0001-environnement.md` et `docs/setup-result.md`, créés par INIT-01, puis la réutiliser pour les postes et CI. [Installation Codex](https://learn.chatgpt.com/docs/codex/cli).

```bash
npm install -g @openai/codex
codex --version
codex login
codex login status
```

La connexion suit le parcours proposé par ton compte. `login status` vérifie la présence du mode d'authentification actif ; cela ne prouve ni le quota disponible ni le succès d'un appel modèle. [Authentification](https://learn.chatgpt.com/docs/auth), [commandes CLI](https://learn.chatgpt.com/docs/developer-commands?surface=cli).

Lancer une fois `codex` depuis ce dossier et examiner la demande de confiance du projet si elle apparaît. Les réglages `.codex/` du projet sont chargés lorsque le projet est reconnu comme fiable. Quitter ensuite la session interactive. [Configuration](https://learn.chatgpt.com/docs/config-file/config-basic).

## 3. Lire les choix avant de les automatiser

Lire `AGENTS.md`, le brief dans `docs/product/`, `backlog/tickets.json`, la [fiche d'accès](03-acces-et-budget.md), la [liste des inconnues](07-inconnues-et-maintenance.md), `.env.example` et le seed dans `evals/`. Repérer les inconnues : boîte Microsoft, règles et catalogue réels, ressources, droits et preuves terrain. Conserver leurs valeurs inconnues ; les fixtures fictives ne les renseignent pas.

Examiner `.agentic/policy.json` : préparation, contrôles requis, chemins protégés, limites et permissions. La politique distingue contrôles du kit et suites produit. Une adaptation relève d'une maintenance explicite, à relire et committer avant lancement ; un agent de ticket ne doit pas l'assouplir pour réussir.

## 4. Vérifier le clone et le kit

Le dépôt est déjà initialisé sur main. Conserver son historique. Vérifier l'identité Git de ton poste ; si elle manque, la configurer avec ton nom et ton adresse de commit habituels. Ne pas recopier les identifiants d'un autre développeur.

```bash
git config user.name
git config user.email
python3 scripts/setup_codex.py
python3 scripts/agentic.py doctor
python3 scripts/restore_progress.py
python3 scripts/agentic.py next
```

La restauration vérifie les attestations versionnées et reconstruit seulement les tickets intégrés démontrés par l'historique. Sur ce premier clone, aucun ticket n'est terminé. Conserver les commits originaux de livraison, sans squash/rebase ; une preuve ambiguë bloque la restauration au lieu de créer une réussite.

`validate` contrôle la structure et la politique du kit. Les tests `tests/tooling` vérifient le contrôleur avec un simulateur. `doctor` inspecte les prérequis locaux ; son champ `auth_verified: false` est normal, car il ne contacte aucun fournisseur. Vérifier les outils manquants et utiliser `codex login status` avant le premier essai. Aucun de ces contrôles ne prouve le fonctionnement de l'application ni une connexion Microsoft.

Le contrôle `kit` exécuté pendant les tickets et en CI est `python3 scripts/check_kit.py` : il regroupe validation et tests d'outillage.

Le premier ticket proposé doit être **INIT-01**. Il prépare le poste et un rapport/ADR ; ses contrôles portent sur le kit. Les commandes `npm run test:...` destinées au produit restent en échec tant que leurs vraies suites n'existent pas. Les désactiver ne termine aucun ticket.

## 5. Lancer une première boucle complète

Le dépôt doit être propre et committé. Depuis `main` :

```bash
python3 scripts/autopilot.py --limit 1
python3 scripts/agentic.py status
git log -3 --oneline
```

Ce lancement sélectionne INIT-01, formalise son périmètre, développe dans un worktree, lance les contrôles requis, fait relire le résultat et corrige dans les limites fixées. S'il réussit, le contrôleur crée un commit ; l'autopilote l'intègre par avance rapide sur la branche principale locale puis rapproche le statut. Avec --limit 1, il s’arrête après ce ticket. Avec une limite supérieure, un ticket bloqué laisse continuer les tickets indépendants ; un échec d’intégration arrête la série. Les [détails de fonctionnement](01-fonctionnement.md) expliquent les preuves et les limites.

Pour produire un ticket sans intégration automatique, utiliser à la place :

```bash
python3 scripts/agentic.py run --ticket INIT-01
```

Pour intégrer ensuite cette livraison locale vérifiée, exécuter depuis `main` :

```bash
python3 scripts/autopilot.py --integrate-ticket INIT-01
```

Lire l'attestation dans `docs/evidence/`, les résultats des contrôles et le diff de la branche produite. `status` indique le worktree ; les diagnostics complets y restent dans `.agentic/runs/`. Un message « terminé » de l'agent n'est pas la preuve ; les résultats enregistrés et le commit sont nécessaires. Ce premier essai valide aussi le CLI sur ton poste : aucun appel LLM n'a été exécuté lors de la préparation du kit.

## 6. Passer au métier sans inventer les réponses

Après INIT-01, DEV-01 prépare la fondation technique avec des données fictives. Sam pilote ensuite le cadrage et les décisions des tickets EA. Les retours de Julien et d’autres prospects sont facultatifs. Les connecteurs sont génériques : les preuves sur des comptes de test autorisés conditionnent leur activation réelle, sans bloquer le développement indépendant ni un lancement sans Microsoft.

Une fois un blocage réellement résolu, consigner sa preuve dans les documents de travail appropriés, committer les changements, vérifier `status` et relancer le ticket identifié. Ne modifier aucune dépendance ou preuve pour forcer la suite.

Le `node_modules` principal n'est pas hérité : le contrôleur exécute `npm ci` **dans chaque worktree**, avant formalisation et après développement. L'installation doit réussir sans modifier les fichiers versionnés. Node/npm sont donc nécessaires dès INIT-01. Le développeur dispose du réseau pour ajouter dépendances et lockfile ; les rôles en lecture seule ne l'ont pas. Les accès produit restent à configurer séparément.

Pour une séance suivante, borner le nombre de tickets :

```bash
python3 scripts/autopilot.py --limit 3
```

Ce n'est ni un service permanent ni une tâche planifiée. Le processus travaille tant que le terminal et ses accès restent disponibles. Consulter le rapport d'un arrêt avant de relancer ; les limites de temps et d'appels ne constituent pas un plafond de dépenses en CHF.

## 7. Publier les prochains commits

Le remote origin pointe déjà vers Samoulou/encave-assistant. Le kit n'exécute aucun push. Après les contrôles et selon la politique de Sam, les commits validés peuvent être poussés avec l'identité GitHub autorisée :

```bash
git push origin main
```

Les protections de branche et les autorisations du compte restent applicables. Si une PR est requise, conserver les commits d'attestation et les intégrer avec leur historique. L'hébergement de l'application suit la politique de Sam et les contrôles de [livraison](02-livraison-et-ci.md).

## Environnement d’exécution

Pour une exécution sans surveillance, utiliser une machine ou une VM de développement dédiée, sans données ni secrets de production. Les commandes npm, les tests et Git s’exécutent avec les droits du contrôleur : la sandbox des sessions Codex ne les englobe pas. WSL fournit l’environnement Linux requis ; WSL seul n’est pas une garantie d’isolation du poste et de ses disques montés.
