#!/usr/bin/env python3
"""Run the gates selected from CI evidence, or every product gate by default."""
import argparse
import json
from pathlib import Path
import subprocess
import sys
import agentic
from ci_scope import GATE_ORDER, full_product_gates

ROOT = Path(__file__).resolve().parents[1]


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--gates', help='JSON list emitted by ci_scope.py; absent means all product gates')
    args = parser.parse_args(argv)
    policy, _ = agentic.validate(ROOT)
    applicable = full_product_gates(policy)
    try:
        selected = json.loads(args.gates) if args.gates is not None else applicable
        if not isinstance(selected, list) or not selected or not all(isinstance(n, str) and n in GATE_ORDER for n in selected) or len(set(selected)) != len(selected):
            raise ValueError('liste vide, doublonnée ou inconnue')
    except (ValueError, TypeError) as exc:
        parser.error('Gates invalides : ' + str(exc))
    results = []
    for name in selected:
        if name not in policy['gates']:
            print('Suite absente : ' + name, file=sys.stderr)
            return 1
        try:
            result = subprocess.run(policy['gates'][name], cwd=ROOT, timeout=1200, check=False)
            results.append(result.returncode == 0)
        except (OSError, subprocess.TimeoutExpired):
            results.append(False)
    print('Gates exécutées : ' + ', '.join(selected))
    omitted = [n for n in applicable if n not in selected]
    if omitted:
        print('Non exécutées dans ce périmètre : ' + ', '.join(omitted))
    print('Qualité du périmètre : ' + ('PASS' if all(results) else 'FAIL / NON CONFIGURÉ'))
    return 0 if all(results) else 1


if __name__ == '__main__':
    raise SystemExit(main())
