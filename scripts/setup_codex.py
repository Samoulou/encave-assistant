#!/usr/bin/env python3
"""Reproducible setup for a clone or a Codex cloud environment; no model call."""
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def main():
    if sys.version_info < (3, 11):
        print('Python 3.11 ou supérieur requis.', file=sys.stderr)
        return 2
    print('Python ' + sys.version.split()[0], flush=True)
    for binary in ('git', 'node', 'npm'):
        if not shutil.which(binary):
            print(binary + ' manquant : installer les prérequis de START-HERE.md.', file=sys.stderr)
            return 2
        subprocess.run([binary, '--version'], cwd=ROOT, check=True, timeout=30)
    major = subprocess.check_output(['node', '-p', 'process.versions.node.split(".")[0]'], text=True, timeout=30).strip()
    if major != ROOT.joinpath('.nvmrc').read_text().strip():
        print('Version Node incompatible : utiliser la version de .nvmrc.', file=sys.stderr)
        return 2
    for command in (['npm', 'ci', '--no-audit', '--no-fund'],
                    [sys.executable, 'scripts/check_kit.py']):
        result = subprocess.run(command, cwd=ROOT, timeout=600)
        if result.returncode:
            return result.returncode
    print('Environnement du kit prêt. Application, suites produit et accès externes à construire/configurer.')
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (OSError, subprocess.SubprocessError) as exc:
        print('Préparation échouée : ' + type(exc).__name__, file=sys.stderr)
        raise SystemExit(2)
