#!/usr/bin/env python3
"""Skip absent product only for ordinary bootstrap CI, never for a release."""
import argparse
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXTENSIONS = {'.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.sql', '.prisma', '.py', '.cs'}


def product_required(root, event):
    if event not in ('push', 'pull_request'):
        return True
    for folder in ('apps', 'packages', 'src', 'migrations', 'tests/product'):
        for path in (root / folder).rglob('*'):
            if path.is_file() and path.suffix in EXTENSIONS and not {'node_modules', '__pycache__', '.next'}.intersection(path.parts):
                return True
    return False


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--event', required=True)
    args = parser.parse_args()
    needed = product_required(ROOT, args.event)
    value = 'true' if needed else 'false'
    output = os.environ.get('GITHUB_OUTPUT')
    if output:
        with open(output, 'a', encoding='utf-8') as stream:
            stream.write('required=' + value + '\n')
    print('Contrôles produit requis.' if needed else '::notice::Application absente : seuls les contrôles du kit sont applicables. Aucun test métier ou IA déclaré réussi.')
