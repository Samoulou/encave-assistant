#!/usr/bin/env python3
"""Run eligible tickets and fast-forward validated local commits. No remote writes."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sys

import agentic


def assert_checkout(root, commit):
    flags = agentic.git(root, 'ls-files', '-v').stdout.splitlines()
    if any(line and (line[0].islower() or line[0] == 'S') for line in flags):
        raise agentic.Blocked('Index Git spécial interdit pour intégration automatique')
    for item in agentic.git(root, 'ls-tree', '-r', '--name-only', commit).stdout.splitlines():
        path = root / item
        if path.is_symlink() or not path.is_file():
            raise agentic.Blocked('Fichier livré absent ou lien symbolique')
        expected = agentic.git(root, 'rev-parse', commit + ':' + item).stdout.strip()
        actual = agentic.git(root, 'hash-object', '--no-filters', '--', item).stdout.strip()
        if expected != actual:
            raise agentic.Blocked('Contenu local différent du commit vérifié')


def verify_evidence(root, controller, identifier, record):
    target = record.get('delivered_commit', '')
    if not re.fullmatch(r'[0-9a-f]{40,64}', target):
        raise agentic.Blocked('Commit de livraison absent ou invalide')
    worktree = Path(record['worktree']).resolve()
    permitted = root.parent / '.encave-agent-worktrees'
    if not worktree.is_relative_to(permitted.resolve()):
        raise agentic.Blocked('Worktree hors du dossier du contrôleur')
    if agentic.git(worktree, 'rev-parse', 'HEAD').stdout.strip() != target:
        raise agentic.Blocked('Le commit de la worktree a changé')
    if agentic.git(worktree, 'status', '--porcelain').stdout.strip():
        raise agentic.Blocked('Worktree modifiée après livraison')
    report_path = Path(record['report']).resolve()
    if not report_path.is_relative_to(worktree / 'docs/evidence'):
        raise agentic.Blocked('Attestation hors du dossier prévu')
    report = agentic.read_json(report_path)
    if report.get('ticket') != identifier or report.get('result') != 'passed_for_local_delivery' or report.get('base_commit') != record.get('base_commit'):
        raise agentic.Blocked('Attestation incompatible avec le ticket')
    try:
        gates = report['gates'][-1]['results']
        expected_gates = set(controller.tickets[identifier]['required_gates'])
        if {g['name'] for g in gates} != expected_gates or not all(g['passed'] and g['exit_code'] == 0 and not g['timed_out'] for g in gates):
            raise agentic.Blocked('Les gates requises ne sont pas toutes réussies')
        prepare_count = len(controller.policy.get('prepare_commands', []))
        if prepare_count:
            for phase in ('before-formalize', 'attempt-' + str(report['gates'][-1]['attempt'])):
                prepared = [p for p in report.get('preparations', []) if p['phase'] == phase]
                if len(prepared) != prepare_count or not all(p['passed'] and p['exit_code'] == 0 and not p['timed_out'] for p in prepared):
                    raise agentic.Blocked('Préparation de la version finale incomplète')
        reviews = [item['report'] for item in report['reports'] if item['stage'] == 'review']
        review = agentic.validate_report('review', reviews[-1])
        requirements = {r['id'] for r in report['requirements']}
        if review['verdict'] != 'pass' or any(f['severity'] in ('blocking', 'major') for f in review['findings']) or not requirements or not requirements.issubset(set(review['requirements_covered'])):
            raise agentic.Blocked('Review indépendante incomplète')
    except (KeyError, IndexError, TypeError) as exc:
        raise agentic.Blocked('Attestation incomplète') from exc
    files = agentic.snapshot(worktree)
    files.pop(report_path.relative_to(worktree).as_posix(), None)
    actual = hashlib.sha256(json.dumps(files, sort_keys=True).encode()).hexdigest()
    if actual != report.get('code_sha256'):
        raise agentic.Blocked('Le code présent ne correspond plus au code testé')
    # Compare the committed tree to the worktree, including assume-unchanged paths.
    for item in agentic.git(worktree, 'ls-tree', '-r', '--name-only', target).stdout.splitlines():
        if not (worktree / item).is_file():
            raise agentic.Blocked('Arbre de livraison incomplet')
        committed = agentic.git(worktree, 'rev-parse', target + ':' + item).stdout.strip()
        actual_blob = agentic.git(worktree, 'hash-object', '--no-filters', '--', item).stdout.strip()
        if committed != actual_blob:
            raise agentic.Blocked('Arbre Git différent du contenu validé')
    return target


def integrate(root, identifier):
    root = Path(root).resolve()
    with agentic.lock(root):
        controller = agentic.Controller(root)
        record = controller.state['tickets'].get(identifier, {})
        if record.get('status') != 'delivered_local':
            raise agentic.Blocked('Aucune livraison locale à intégrer')
        expected_branch = controller.policy.get('base_branch', 'main')
        if agentic.git(root, 'branch', '--show-current').stdout.strip() != expected_branch:
            raise agentic.Blocked('Se placer sur la branche de base configurée')
        if agentic.git(root, 'status', '--porcelain').stdout.strip():
            raise agentic.Blocked('Branche de base non propre')
        if agentic.git(root, 'rev-parse', 'HEAD').stdout.strip() != record.get('base_commit'):
            raise agentic.Blocked('Base modifiée : revalidation nécessaire avant intégration')
        assert_checkout(root, record['base_commit'])
        target = verify_evidence(root, controller, identifier, record)
        agentic.git(root, 'merge', '--ff-only', target)
        if agentic.git(root, 'rev-parse', 'HEAD').stdout.strip() != target or agentic.git(root, 'status', '--porcelain').stdout.strip():
            raise agentic.Blocked('Contrôle après fusion échoué ; inspecter la branche locale')
        assert_checkout(root, target)
        controller.reconcile()
        return {'ticket': identifier, 'status': 'integrated', 'commit': target}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--limit', type=int, default=1)
    parser.add_argument('--integrate-ticket', help='Reprendre une livraison locale déjà vérifiée')
    args = parser.parse_args(argv)
    results, attempted = [], set()
    try:
        if args.integrate_ticket:
            print(json.dumps(integrate(agentic.ROOT, args.integrate_ticket), ensure_ascii=False))
            return 0
        if not 1 <= args.limit <= 20:
            raise agentic.Blocked('--limit doit être compris entre 1 et 20')
        initial = agentic.Controller()
        branch = agentic.git(agentic.ROOT, 'branch', '--show-current').stdout.strip()
        if branch != initial.policy.get('base_branch', 'main'):
            raise agentic.Blocked('Autopilot exige la branche de base configurée')
        for _ in range(args.limit):
            controller = agentic.Controller()
            with agentic.lock(agentic.ROOT):
                controller.reconcile()
            candidates = [t for t in controller.ready() if t['id'] not in attempted]
            if not candidates:
                break
            identifier = candidates[0]['id']
            attempted.add(identifier)
            try:
                controller.run(identifier)
            except agentic.Blocked as exc:
                results.append({'ticket': identifier, 'status': 'blocked', 'reason': str(exc)})
                continue
            try:
                results.append(integrate(agentic.ROOT, identifier))
            except agentic.Blocked as exc:
                results.append({'ticket': identifier, 'status': 'integration_blocked', 'reason': str(exc)})
                break
        print(json.dumps({'results': results, 'remote_published': False, 'production_deployed': False}, ensure_ascii=False, indent=2))
        return 1 if any(r['status'] != 'integrated' for r in results) else 0
    except (agentic.Blocked, OSError) as exc:
        print(json.dumps({'status': 'blocked', 'reason': str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
