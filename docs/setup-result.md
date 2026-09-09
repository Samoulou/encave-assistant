# Résultat de préparation — INIT-01

Date : 2026-09-09. Base : `73ab37e`. Exécution directe Codex Desktop sous Windows.
Voir [ADR-0001](decisions/ADR-0001-environnement.md) et
[les preuves détaillées](work/INIT-01/results.md).

| Contrôle | Observation |
|---|---|
| Dépôt | main propre au départ, `git pull --ff-only` : déjà à jour |
| Git Windows | 2.49.0.windows.1 ; identité de commit configurée |
| Python Windows | 3.12.9 ; venv local, PyYAML 6.0.3 |
| Node initial | 22.16.0, incompatible avec .nvmrc |
| Node sélectionné | 24.19.0 fourni par Codex ; npm 10.9.2 |
| Codex CLI | 0.153.4 ; version seule, aucune boucle CLI testée |
| Installation npm | `npm ci --no-audit --no-fund` : code 0 |
| Validation structure | 42 tickets valides |
| Kit Windows | 141 tests, 30 échecs et 68 erreurs ; garde POSIX et processus |
| Kit WSL | 141/141 réussis au second passage (62,756 s) ; premier passage : une erreur d'horodatage |
| Suites produit | Les sept commandes initiales renvoient 2 : NON CONFIGURE |
| PostgreSQL | Non installé/détecté, requête non exécutée ; préparation DEV-01 |
| Docker | Client présent, moteur arrêté ; non requis pour l'option binaire native |
| CI / production | Non vérifiée / non déployée |

## Reproduire les commandes Windows

```powershell
python -m venv .venv
Copy-Item -LiteralPath .venv/Scripts/python.exe -Destination .venv/Scripts/python3.exe
.venv/Scripts/python.exe -m pip install -r requirements-tooling.txt
$nodeRuntime = 'C:\Users\sam_8\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin'
$env:Path = (Join-Path $PWD '.venv/Scripts') + ';' + $nodeRuntime + ';' + $env:Path
node --version
python3 --version
npm ci --no-audit --no-fund
```

Le chemin du runtime dépend du poste ; ailleurs, installer Node 24 et utiliser
son chemin effectif. Aucune clé produit n'est requise pour cette préparation.
Le script setup_codex.py n'a pas été présenté comme réussi sous Windows ; les
étapes équivalentes sont exécutées et consignées séparément.

## Reproduire la gate kit sans modifier les contrôles

```powershell
.venv/Scripts/python.exe -m pip install --target .agentic/runs/wsl-python --platform manylinux2014_x86_64 --python-version 3.12 --implementation cp --abi cp312 --only-binary=:all: -r requirements-tooling.txt
wsl -d Ubuntu -- env PYTHONPATH=/mnt/c/tmp/encave-assistant/encave-assistant/.agentic/runs/wsl-python python3 /mnt/c/tmp/encave-assistant/encave-assistant/scripts/check_kit.py
```

Adapter les chemins au clone. Cette commande vérifie le kit dans WSL, elle ne
lance pas la campagne. Les sorties complètes restent locales dans `.agentic/*.log`.
Les comptes rendus docs/work ne sont pas des attestations du contrôleur.
