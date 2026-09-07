#!/usr/bin/env python3
"""Validate the starter itself, never claim product tests passed."""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if __name__ == '__main__':
    for command in ([sys.executable, 'scripts/agentic.py', 'validate'],
                    [sys.executable, '-m', 'unittest', 'discover', '-s', 'tests/tooling', '-v']):
        result = subprocess.run(command, cwd=ROOT, check=False)
        if result.returncode:
            raise SystemExit(result.returncode)
    print('KIT VALIDE. Ce résultat ne couvre pas les suites produit.')
