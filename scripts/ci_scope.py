#!/usr/bin/env python3
"""Select cumulative gates from verified deliveries; unknown code requires all gates."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
EXTENSIONS = {'.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.sql', '.prisma', '.py', '.cs'}
PRODUCT_GATES = ['unit', 'functional', 'business', 'e2e', 'evals']
GATE_ORDER = ['foundation', *PRODUCT_GATES, 'ux']
CODE_FOLDERS = ('apps', 'packages', 'src', 'migrations', 'tests/product')


def product_required(root, event):
    if event not in ('push', 'pull_request'):
        return True
    return any(path.is_file() and path.suffix in EXTENSIONS
               and not {'node_modules', '__pycache__', '.next'}.intersection(path.parts)
               for folder in CODE_FOLDERS for path in (root / folder).rglob('*'))


def full_product_gates(policy):
    return [*PRODUCT_GATES, *(['ux'] if 'ux' in policy['gates'] else [])]


def delivery_scope(root, event):
    """Read immutable Git evidence without changing state or requiring a branch name."""
    import agentic
    import restore_progress as proof
    root = Path(root).resolve()
    require, git = proof.require, proof.git_bytes
    policy, tickets = agentic.validate(root)
    require(git(root, 'rev-parse', '--is-shallow-repository').strip() == b'false', 'Historique Git incomplet pour la CI')
    require(not git(root, 'replace', '-l').strip(), 'Objets Git remplacés non pris en charge')
    grafts = Path(git(root, 'rev-parse', '--git-path', 'info/grafts').decode().strip())
    require(not (grafts if grafts.is_absolute() else root / grafts).exists(), 'Grafts Git non pris en charge')
    head = git(root, 'rev-parse', 'HEAD').decode().strip()
    current = proof.tree(root, head)
    require(not git(root, 'status', '--porcelain').strip() and agentic.snapshot(root) == proof.snapshot(current), 'Checkout CI différent de HEAD')
    paths = {p for p in git(root, 'log', '--full-history', '--format=', '--name-only', '-z', '--no-renames', head, '--', 'docs/evidence').decode().split('\0') if proof.EVIDENCE.fullmatch(p)}
    verified, gates, commits = {}, set(), set()
    for path in sorted(paths):
        identifier, run_id = proof.EVIDENCE.fullmatch(path).groups()
        origins = git(root, 'log', '--full-history', '--no-merges', '--no-renames', '--diff-filter=A', '--format=%H', head, '--', path).decode().splitlines()
        changes = git(root, 'log', '--full-history', '--no-merges', '--no-renames', '--format=%H', head, '--', path).decode().splitlines()
        require(len(origins) == 1 and changes == origins, 'Attestation modifiée, supprimée ou ambiguë : ' + identifier)
        commit = origins[0]
        files = proof.tree(root, commit)
        require(path in current and current[path] == files[path], 'Attestation absente ou altérée')
        report = proof.committed_json(files, path)
        require(report.get('ticket') == identifier and report.get('run_id') == run_id, 'Identité de l’attestation invalide')
        parents = git(root, 'show', '-s', '--format=%P', commit).decode().split()
        require(parents == [report.get('base_commit')], 'Livraison sans parent exact')
        require(git(root, 'show', '-s', '--format=%s', commit).decode().strip() == 'agentic: ' + identifier + ' validated local delivery', 'Commit non identifié comme livraison')
        historical_policy = proof.committed_json(files, '.agentic/policy.json')
        matches = [t for t in proof.committed_json(files, 'backlog/tickets.json')['tickets'] if t.get('id') == identifier]
        require(len(matches) == 1 and tickets.get(identifier) == matches[0], 'Contrat du ticket absent ou modifié')
        for config in ('.agentic/policy.json', 'backlog/tickets.json'):
            require(git(root, 'show', parents[0] + ':' + config) == files[config][0], 'Politique ou contrat modifié pendant la livraison')
        require(not matches[0].get('requires_ux') or 'ux' in matches[0]['required_gates'], 'Contrôles UX historiques absents')
        proof.verify_report(report, historical_policy, matches[0])
        tested = proof.snapshot(files)
        del tested[path]
        require(hashlib.sha256(json.dumps(tested, sort_keys=True).encode()).hexdigest() == report['code_sha256'], 'Empreinte du code livré invalide')
        require(identifier not in verified, 'Plusieurs livraisons du même ticket')
        verified[identifier] = (commit, report['base_commit'])
        commits.add(commit)
        gates.update(matches[0]['required_gates'])
    for identifier, (_, base) in verified.items():
        for dependency in tickets[identifier]['dependencies']:
            require(dependency in verified and agentic.git(root, 'merge-base', '--is-ancestor', verified[dependency][0], base, check=False).returncode == 0, 'Dépendance livrée non vérifiable')
    # Unattested executable changes (including a direct Codex task) never inherit
    # the narrower scope of a later documentation-only controller delivery.
    relevant = [*CODE_FOLDERS, 'ops', 'evals', 'package.json', 'package-lock.json', '.github/workflows', 'scripts/product_quality.py']
    executable_commits = set(git(root, 'log', '--format=%H', head, '--', *relevant).decode().splitlines())
    # The prepared kit's initial configuration precedes all delivery evidence.
    # Only ignore commits before the earliest delivery if they contain no app.
    unknown = False
    for commit in executable_commits - commits:
        files = proof.tree(root, commit)
        if any(Path(name).suffix in EXTENSIONS and any(name.startswith(folder + '/') for folder in CODE_FOLDERS) for name in files):
            unknown = True
            break
    has_app = product_required(root, 'push')
    force = event not in ('push', 'pull_request')
    if force or (has_app and (not verified or unknown)):
        gates.update(full_product_gates(policy))
    if has_app and 'foundation' in policy['gates']:
        gates.add('foundation')
    selected = [name for name in GATE_ORDER if name in gates]
    require(git(root, 'rev-parse', 'HEAD').decode().strip() == head, 'HEAD a changé pendant la CI')
    return {'required': bool(selected), 'gates': selected, 'verified_tickets': sorted(verified), 'mode': 'full' if force or unknown or (has_app and not verified) else 'verified_deliveries'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--event', required=True)
    args = parser.parse_args()
    try:
        result = delivery_scope(ROOT, args.event)
    except Exception as exc:
        print('Périmètre CI non vérifiable : ' + str(exc), file=sys.stderr)
        return 1
    if os.environ.get('GITHUB_OUTPUT'):
        with open(os.environ['GITHUB_OUTPUT'], 'a', encoding='utf-8') as stream:
            stream.write('required=' + str(result['required']).lower() + '\ngates=' + json.dumps(result['gates']) + '\n')
    print(json.dumps(result, ensure_ascii=False))
    print('Suites non applicables non exécutées ; aucun succès métier ou IA présumé.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
