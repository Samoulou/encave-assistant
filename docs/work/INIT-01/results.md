# INIT-01 — Résultats observés

Date : 2026-09-09. Base Git : `73ab37e`. Contrat rédigé avant les fichiers livrables.

| Commande | Code | Résultat |
|---|---:|---|
| `git status --short --branch` puis `git pull --ff-only` | 0 | main propre et déjà synchronisé |
| `git --version` | 0 | 2.49.0.windows.1 |
| `python --version` / `py -0p` | 0 | 3.12.9 utilisé ; 3.14 également installé |
| `node --version` initial | 0 | 22.16.0 incompatible avec .nvmrc |
| Node fourni par Codex, `--version` | 0 | 24.19.0 |
| `npm --version` avec Node 24 en tête du PATH | 0 | 10.9.2 |
| `codex --version` | 0 | codex-cli 0.153.4 |
| `python -m venv .venv` et installation requirements-tooling.txt | 0 | Python 3.12.9 / PyYAML 6.0.3 |
| `npm ci --no-audit --no-fund` sous Node 24 | 0 | installation verrouillée, aucun fichier suivi modifié |
| `python scripts/check_kit.py` Windows | 1 | structure valide, 141 tests : 30 échecs, 68 erreurs |
| Gate kit WSL, premier passage | 1 | 141 tests : 140 réussis, une erreur d'horodatage de campagne |
| Gate kit WSL, deuxième passage inchangé | 0 | 141 tests réussis, zéro échec/erreur, 62,756 s |
| `npm run test:unit` | 2 | NON CONFIGURE : unit |
| `npm run test:functional` | 2 | NON CONFIGURE : functional |
| `npm run test:business` | 2 | NON CONFIGURE : business |
| `npm run test:e2e` | 2 | NON CONFIGURE : e2e |
| `npm run test:evals` | 2 | NON CONFIGURE : evals |
| `npm run test:ux` | 2 | NON CONFIGURE : ux |
| `npm run check:foundation` | 2 | NON CONFIGURE : foundation |
| `docker info --format '{{.ServerVersion}}'` | 1 | moteur Linux arrêté ; aucune base SQL testée |

La commande complète WSL et la préparation du PATH Windows figurent dans
[setup-result.md](../../setup-result.md). Le `python3` de WSL est 3.12.3 et charge
PyYAML 6.0.3 depuis la wheel Linux installée localement. La tentative de venv WSL
a échoué (ensurepip absent) ; aucun sudo, changement système ou contournement.

## Échec conservé et correction bornée

La garde POSIX empêche le fonctionnement du contrôleur sous Windows natif.
Le kit est donc vérifié sans modification dans l'Ubuntu WSL déjà disponible.
Le premier passage WSL échoue à
`test_completion_rejects_wrong_delivered_commit_even_when_ancestral`, lors du
contrôle `started_at <= time.time()`. Une variation d'horloge WSL est suspectée,
non établie comme cause certaine. Un second passage complet inchangé réussit.
Cet incident reste une limite connue ; pas de test supprimé, ignoré ou corrigé.

Les lignes « Qualité du périmètre : PASS » produites dans le log du kit sont des
sorties des tests de l'outillage sur fixtures. Elles ne constituent aucune preuve
de foundation ou de produit dans ce dépôt. Seul le résultat unittest de la gate
kit est revendiqué ici.

## Traçabilité

- AC-01 : versions observées dans ADR-0001 et tableau ci-dessus.
- AC-02 : kit inchangé 141/141 sous WSL ; structure proposée, aucune application.
- AC-03 : ADR-0001 et setup-result créés avec limites et commandes reproductibles.
- AC-04 : sept refus NON CONFIGURE ; package.json et scripts inchangés.

Les diagnostics locaux `.agentic/kit-windows-init.log`, `kit-wsl-init.log` et
`kit-wsl-init-2.log` ne sont pas versionnés. Leurs empreintes sont dans
`checksums.json`. Review indépendante à consigner avant livraison.

Budget consommé avant review : un diagnostic Windows, deux passages WSL,
aucune correction de code/test, un seul nouveau passage pour l'erreur temporelle.
La boucle CLI, PostgreSQL, Microsoft, modèle IA, CI distante et production ne sont
pas vérifiés par INIT-01. Aucun ticket EA n'est déclaré terminé.
