#!/usr/bin/env python3
"""Run every product gate; absent suites fail through their configured commands."""
from pathlib import Path
import subprocess
import sys
import agentic

ROOT=Path(__file__).resolve().parents[1]
def main():
    policy, _ = agentic.validate(ROOT)
    results=[]
    for name in ['unit','functional','business','e2e','evals']:
        if name not in policy['gates']:
            print('Suite absente : '+name, file=sys.stderr)
            return 1
        try:
            result=subprocess.run(policy['gates'][name],cwd=ROOT,timeout=1200,check=False)
            results.append(result.returncode==0)
        except (OSError,subprocess.TimeoutExpired):
            results.append(False)
    print('Qualité produit : '+('PASS' if all(results) else 'FAIL / NON CONFIGURÉ'))
    return 0 if all(results) else 1
if __name__=='__main__':raise SystemExit(main())
