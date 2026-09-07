# Commencer EnCave Assistant dans Codex

Le dépôt contient le brief, l’UX/UI, la roadmap, **40 tickets produit + INIT-01 et DEV-01**, et la chaîne de développement. L’application reste à construire. La mission par défaut est de poursuivre tout le backlog sans demander l’accord de Sam entre les tâches.

## Récupérer le dépôt

Dans Codex relié à GitHub, sélectionner **Samoulou/encave-assistant**, branche **main**. Sur une machine dédiée :

```bash
git clone https://github.com/Samoulou/encave-assistant.git
cd encave-assistant
```

Pour un clone existant et propre sur main, utiliser `git pull --ff-only`. Conserver l’historique complet. Le dépôt existe déjà : ne pas le réinitialiser.

## Parcours recommandé : une campagne, tous les tickets

Installer Git, Node 24/npm, Python 3.11+ et Codex CLI selon le [guide local](docs/agentic/00-marche-a-suivre.md). Configurer une fois l’authentification Codex, l’identité Git et l’autorisation de push vers main. Utiliser une machine de développement dédiée, avec accès npm, documentation et services de test, sans secrets de production. Depuis son terminal, hors d’une session Codex imbriquée :

```bash
python3 -m venv .venv
source .venv/bin/activate
python3 scripts/setup_codex.py
codex login status
python3 scripts/agentic.py doctor
python3 scripts/continuous.py
```

Le runner enchaîne formalisation → développement → tests → review indépendante → corrections → commit → intégration → push vérifié. Il continue les tickets indépendants lorsqu’un autre est bloqué. Aucun accord intermédiaire n’est demandé par le runner. Les compteurs sont persistants ; les budgets, accès manquants et résultats incertains restent des limites explicites.

```bash
python3 scripts/continuous.py --status
python3 scripts/continuous.py --stop
python3 scripts/continuous.py --resume
```

Ces commandes servent respectivement à consulter, demander un arrêt après le ticket courant et reprendre. Le [guide de campagne](docs/agentic/09-campagne-autonome.md) précise les prérequis, budgets, reprises et différences entre développement terminé, publication et production. Le processus doit rester actif sur sa machine ; le dépôt ne crée pas un service hébergé.

## Message pour une tâche directement dans Codex

Si la surface travaille directement dans son checkout, lui donner l’objectif complet :

```text
Lis AGENTS.md et START-HERE.md. Construis EnCave Assistant jusqu'à la fin du
backlog selon docs/agentic/08-tache-codex.md et les dépendances démontrées.
Après chaque ticket vérifié, poursuis le prochain sans me demander de continuer.
Formalise les critères avant le code ; respecte docs/product/11-ux-ui-et-design.md
et docs/design. Exécute les tests applicables, les contrôles UX des interfaces et
une review indépendante. Corrige dans les budgets, conserve décisions et preuves,
puis livre selon les autorisations établies. Documente les blocages et continue
les tâches indépendantes. Ne suppose ni accès Microsoft, ni clé IA produit, ni
accord de Julien. Ne fabrique jamais un test réussi ou une review. N'affaiblis
pas les exigences pour avancer. Distingue code livré, CI et production déployée.
```

La tâche directe peut utiliser les agents indépendants et objectifs persistants disponibles dans sa surface. Elle ne doit pas lancer un CLI imbriqué sans prérequis vérifiés. Le prompt et AGENTS.md donnent les instructions ; ils ne garantissent pas qu’une surface maintienne indéfiniment un processus. Pour la campagne déterministe avec checkpoint, utiliser le runner ci-dessus.

Pour Codex Cloud, configurer Node 24 et Python 3.11+ puis `python3 scripts/setup_codex.py` comme setup/maintenance. Le setup installe les dépendances verrouillées du kit et vérifie l’outillage ; il n’appelle aucun modèle et ne provisionne aucun service. Pour DEV-01, prévoir PostgreSQL de développement ; Docker n’est pas supposé disponible. Les règles réseau du compte s’appliquent. [Configuration officielle](https://learn.chatgpt.com/docs/environments/cloud-environment).

## Références et ordre de démarrage

| Étape | Résultat attendu |
|---|---|
| INIT-01 | Versions observées, rapport de setup et ADR de l’environnement |
| DEV-01 | Fondation TypeScript, build/démarrage et PostgreSQL de développement |
| EA-01 / EA-02 | Cadrage piloté par Sam et contrat générique Microsoft ; retours prospect facultatifs |
| EA-03 / EA-04 | Choix réversibles documentés, environnements et CI configurés dans le périmètre autorisé |
| EA-05 et suivants | Tranches fonctionnelles, tests réels et contrôles UX selon dépendances |
| EA-40 | Livraison et exploitation prouvées sur les environnements autorisés |

Sam garde la main sur le développement et la politique de lancement. Le caviste conserve ses validations commerciales A1. Chaque cave connecte ses outils par le parcours générique ; les autorisations fournisseur restent nécessaires à l’activation réelle du compte concerné.

Lire le [brief](docs/product/00-BRIEF-DEVELOPPEMENT.md), la [conception UX/UI](docs/product/11-ux-ui-et-design.md) et les [trois maquettes](docs/design/README.md). Ce sont les références de conception, pas une application déjà testée auprès de clients.

La CI vérifie le kit immédiatement. Ses gates produit deviennent cumulatives à partir des livraisons attestées : fondation, suites métier, UX et évaluations IA lorsqu’applicables. Un changement applicatif sans preuve impose toutes les suites ; une release les force aussi. Les commandes produit et le déployeur non configurés échouent explicitement. Aucun ticket n’est terminé par la seule préparation de ce dépôt.
