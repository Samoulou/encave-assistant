# Développer le backlog sans validation entre les tickets

La campagne poursuit les **42 tickets du plan** jusqu’à leur intégration vérifiée, dans les limites configurées. Elle enchaîne formalisation, développement, tests, review indépendante, corrections, commit, intégration et publication. Sam n’a pas à confirmer chaque étape. L’application reste à développer ; ce dépôt ne contient pas une campagne déjà active.

## Configuration initiale, une fois

Suivre les installations du [guide local](00-marche-a-suivre.md). Utiliser Linux, macOS ou WSL, Git, Node 24/npm, Python 3.11+ et un Codex CLI authentifié sur une machine de développement dédiée. Préparer les dépendances de test, PostgreSQL et les navigateurs nécessaires aux futurs tickets. Les tests s’exécutent avec les droits de cette machine ; elle ne doit pas porter de secrets de production.

Configurer l’identité Git, les accès au registre npm et aux documentations, ainsi que le droit de publier sur `origin/main`. Respecter les protections de branche : la campagne actuelle utilise le push sans force et ne remplace pas un processus de PR obligatoire. Choisir avant démarrage un mode de livraison compatible avec le dépôt. Ne pas placer de jeton dans une URL Git versionnée.

La politique de Sam autorise les décisions réversibles nécessaires au périmètre. Les fournisseurs et accès de test requis pour aller jusqu’à l’activation doivent être disponibles au moment de leurs tickets. L’agent documente les inconnues et continue les travaux indépendants ; il ne crée pas un compte payant, une autorisation Microsoft ou des faits métier supposés.

Depuis un clone complet, propre, sur `main`, sans autre agent écrivant dans ce checkout :

```bash
python3 -m venv .venv
source .venv/bin/activate
python3 scripts/setup_codex.py
codex login status
python3 scripts/agentic.py doctor
python3 scripts/continuous.py
```

Le setup installe PyYAML épinglé pour le contrôle des workflows ; le venv évite de modifier le Python système. Réactiver `source .venv/bin/activate` dans un nouveau terminal. Le script restaure les livraisons prouvées par Git au premier lancement. Il vérifie la publication initiale avant les appels modèle. Chaque ticket reçoit ses sessions distinctes et ses preuves ; aucun prompt humain intermédiaire n’est ajouté par le runner. Les permissions de Codex et du compte restent applicables. Les préparer au départ évite des interruptions répétées, sans désactiver les protections.

## Arrêt, reprise et blocages

Dans un second terminal :

```bash
python3 scripts/continuous.py --status
python3 scripts/continuous.py --stop
```

`--status` lit l’état sans appel modèle. `--stop` demande un arrêt après le ticket courant. SIGTERM demande également cet arrêt ; une interruption brutale peut laisser une exécution incertaine qui exige une inspection des preuves. Le verrou de campagne est libéré par le système à la fin du processus ; ne pas confondre ce verrou avec celui du contrôleur d’un ticket.

Pour continuer sur la même machine :

```bash
python3 scripts/continuous.py --resume
```

Cette commande ne remet aucun compteur à zéro et ne relance pas automatiquement un ticket déjà bloqué. Après résolution vérifiable de sa cause :

```bash
python3 scripts/continuous.py --retry-ticket EA-12
```

Remplacer EA-12 par l’ID réellement bloqué. Les tentatives restent limitées. Si la correction exige de changer la base, la politique ou les contrats gelés, suivre la maintenance documentée ; ne pas éditer le checkpoint pour faire accepter un nouvel historique.

| État | Signification |
|---|---|
| `complete` | Tous les tickets du plan ont une intégration et des attestations vérifiées |
| `blocked` | Aucun travail admissible restant, preuve incohérente ou résultat incertain ; cause conservée |
| `budget_exhausted` | Borne globale atteinte ; pas de nouvelle dépense automatique |
| `publish_blocked` | Push ou confirmation du commit distant impossible ; reprise de publication avant nouveaux appels |
| `stopped` | Arrêt demandé ; reprise possible avec les mêmes compteurs |

Un échec de ticket n’arrête pas les tâches indépendantes. Un problème d’intégrité, de publication ou de résultat incertain arrête la campagne pour protéger la cohérence. L’agent ne demande pas un accord de convenance entre tickets ; un prérequis extérieur réellement absent reste une limite technique.

## Limites et conservation de l’avancement

Les valeurs initiales de `.agentic/policy.json` sont : 126 exécutions, 336 appels d’agent, 604 800 secondes calendaires (sept jours, interruptions incluses), trois exécutions par ticket. Chaque exécution garde les limites internes : trois tentatives de correction, huit appels maximum, 1 200 secondes par appel et 7 200 secondes au total. Une réservation d’appels est enregistrée avant leur lancement et conservée si leur résultat est incertain. Le quota et le plafond financier du fournisseur se règlent séparément.

`.agentic/continuous.json` et l’état du contrôleur restent locaux et ignorés par Git. Les attestations de livraison sont versionnées dans `docs/evidence/`. Sur une autre machine, Git permet de reconstruire les livraisons réussies ; il ne restitue pas tous les échecs et budgets locaux. Pour reprendre la même campagne sans perdre ces compteurs, conserver aussi son checkpoint et son environnement de travail de manière sécurisée. Ne pas supprimer le journal pour contourner une limite.

Le runner est un processus, pas un service hébergé permanent. Maintenir la machine et le processus actifs pendant la campagne, ou utiliser son superviseur habituel pour redémarrer la même commande avec le même checkpoint. Aucune planification ou machine distante n’est provisionnée par ce dépôt.

## GitHub et production

Le mode configuré `verified_push` publie chaque commit intégré sur la destination `origin` figée au lancement, sans force, puis vérifie le SHA distant. Une divergence ou un droit manquant suspend la publication. `local` est une option à choisir avant campagne si la politique de Sam prévoit une autre livraison.

Les workflows GitHub vérifient ensuite la qualité selon leur déclenchement. La campagne n’attend pas leur résultat et ne prétend pas surveiller la CI. La release exige séparément tous les contrôles produit et le déployeur configuré ; `AUTO_RELEASE` concerne la préproduction selon le workflow. La production dépend de la politique initiale, des accès et des gates de livraison. `complete` et `remote_published` ne signifient jamais `production_deployed`.

EA-04 et EA-40 disposent de droits de maintenance limités à leurs fichiers prévus. Ils peuvent configurer CI et livraison sans accord supplémentaire pour chaque fichier, en conservant les contrôles obligatoires. Aucun ticket ne peut s’accorder de nouveaux droits pour résoudre son propre échec.

## Autres surfaces Codex

Dans une surface avec objectifs persistants, confier l’ensemble du backlog à un objectif peut aider à poursuivre le travail. Cela ne remplace pas les gates et la review distincte de ce kit. La disponibilité d’un objectif varie selon la surface ; ne pas supposer qu’une tâche cloud lance automatiquement ce contrôleur. Une tâche directe suit [son protocole](08-tache-codex.md) et conserve ses preuves distinctes.

Sources officielles : [travail long](https://learn.chatgpt.com/docs/long-running-work), [objectifs dans Codex](https://developers.openai.com/cookbook/examples/codex/using_goals_in_codex), [exécutions non interactives](https://learn.chatgpt.com/docs/non-interactive-mode).
