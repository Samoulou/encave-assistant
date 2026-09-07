#!/usr/bin/env python3
"""Restore integrated progress from immutable, ancestral delivery attestations.

No model, test command, checkout, merge or remote operation is executed. This
checks consistency of trusted Git history; it cannot authenticate its author or
reconstruct the ignored raw agent/test logs. Squashed/rebased deliveries, shallow
history, ambiguous origins and noncanonical file permissions are unsupported.
"""
from __future__ import annotations

import argparse
from contextlib import nullcontext
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

import agentic

EVIDENCE = re.compile(r"docs/evidence/([A-Z][A-Z0-9]*-\d+)/([A-Za-z0-9-]+)\.json")
SHA256 = re.compile(r"[0-9a-f]{64}")


def require(condition, message):
    if not condition:
        raise agentic.Blocked(message)


def git_bytes(root, *args, input=None):
    result = agentic.run_process(
        ["git", "--no-replace-objects", "-C", str(root), *args],
        input=input, stdin=subprocess.PIPE if input is not None else None,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30,
    )
    require(result.returncode == 0, "Lecture de l’historique Git impossible")
    return result.stdout


def tree(root, commit):
    """Read committed bytes and canonical Git modes, without checking files out."""
    entries = {}
    for entry in git_bytes(root, "ls-tree", "-r", "-z", commit).split(b"\0"):
        if not entry:
            continue
        metadata, name = entry.split(b"\t", 1)
        mode, kind, oid = metadata.decode("ascii").split()
        require(kind == "blob" and mode in ("100644", "100755"), "Mode Git non pris en charge dans une livraison")
        path = name.decode("utf-8")
        require(not Path(path).is_absolute() and ".." not in Path(path).parts, "Chemin Git invalide")
        entries[path] = (oid, 0o755 if mode == "100755" else 0o644)
    ids = sorted({oid for oid, _ in entries.values()})
    response = git_bytes(root, "cat-file", "--batch", input=("\n".join(ids) + "\n").encode()) if ids else b""
    blobs, offset = {}, 0
    for oid in ids:
        end = response.index(b"\n", offset)
        found, kind, length = response[offset:end].decode("ascii").split()
        require(found == oid and kind == "blob", "Objet Git invalide")
        offset = end + 1
        length = int(length)
        blobs[oid] = response[offset:offset + length]
        offset += length
        require(response[offset:offset + 1] == b"\n", "Objet Git tronqué")
        offset += 1
    require(offset == len(response), "Réponse Git ambiguë")
    return {name: (blobs[oid], mode) for name, (oid, mode) in entries.items()}


def snapshot(files):
    return {name: [hashlib.sha256(data).hexdigest(), mode] for name, (data, mode) in files.items()}


def committed_json(files, path):
    require(path in files, "Fichier historique absent : " + path)
    try:
        return json.loads(files[path][0])
    except (ValueError, UnicodeError) as exc:
        raise agentic.Blocked("JSON historique invalide : " + path) from exc


def passed(item):
    return item.get("passed") is True and type(item.get("exit_code")) is int and item["exit_code"] == 0 and item.get("timed_out") is False


def result_shape(item):
    return (isinstance(item, dict) and type(item.get("passed")) is bool
            and type(item.get("timed_out")) is bool
            and (item.get("exit_code") is None or type(item.get("exit_code")) is int)
            and isinstance(item.get("log_sha256"), str) and SHA256.fullmatch(item["log_sha256"])
            and item["passed"] == (item["exit_code"] == 0 and not item["timed_out"]))


def verify_report(report, policy, ticket):
    """Validate the historical contract, role sequence, preparations and gates."""
    require(report.get("version") == 1 and report.get("result") == "passed_for_local_delivery", "Attestation de livraison invalide")
    reports = report["reports"]
    require(isinstance(reports, list) and len(reports) >= 3, "Rapports des rôles absents")
    require(type(report["agent_calls"]) is int and report["agent_calls"] == len(reports) <= policy["max_agent_calls"], "Budget ou séquence des appels invalide")
    attempts, reviews = 0, []
    for number, item in enumerate(reports, 1):
        require(item["call"] == number and isinstance(item.get("sha256"), str) and SHA256.fullmatch(item["sha256"]), "Référence de rapport invalide")
        stage = item["stage"]
        role = agentic.validate_report(stage, item["report"])
        if number == 1:
            require(stage == "formalize" and role["status"] == "ready", "Formalisation initiale absente")
        elif stage == "develop":
            attempts += 1
            require(role["status"] == "implemented", "Développement non livré")
        elif stage == "review":
            require(reports[number - 2]["stage"] == "develop", "Review sans développement distinct")
            reviews.append((attempts, role))
        else:
            raise agentic.Blocked("Séquence des rôles invalide")
    require(1 <= attempts <= policy["max_attempts"] and reports[-1]["stage"] == "review", "Review finale absente")
    formal = reports[0]["report"]
    contract = (json.dumps(formal, ensure_ascii=False, indent=2) + "\n").encode()
    require(hashlib.sha256(contract).hexdigest() == report["contract_sha256"] and formal["requirements"] == report["requirements"], "Contrat formalisé altéré")
    agentic.validate_ticket_formalization(ticket, formal)
    required = {r["id"] for r in formal["requirements"]}
    review = reviews[-1][1]
    require(review["verdict"] == "pass" and set(review["requirements_covered"]) == required and not any(f["severity"] in ("blocking", "major") for f in review["findings"]), "Review indépendante incomplète")
    gates = report["gates"]
    require(isinstance(gates, list) and len(gates) == len(reviews), "Historique des gates incomplet")
    expected = ticket["required_gates"]
    require("kit" in expected and set(expected).issubset(policy["gates"]), "Gates historiques invalides")
    require(ticket["kind"] != "code" or agentic.CODE_GATES.issubset(expected), "Gates métier historiques absentes")
    require(not ticket.get("requires_evals") or "evals" in expected, "Évaluations historiques absentes")
    require(not ticket.get("requires_ux") or "ux" in expected, "Contrôles UX historiques absents")
    for gate, (attempt, _) in zip(gates, reviews):
        require(gate["attempt"] == attempt and [g["name"] for g in gate["results"]] == expected and all(result_shape(g) for g in gate["results"]), "Résultats des gates invalides")
    require(all(passed(g) for g in gates[-1]["results"]), "Gates finales non réussies")
    count = len(policy.get("prepare_commands", []))
    preparations = report["preparations"]
    require(isinstance(preparations, list), "Historique des préparations invalide")
    phases = ["before-formalize"] + ["attempt-" + str(n) for n in range(1, attempts + 1)]
    require(all(result_shape(p) and p.get("phase") in phases for p in preparations), "Préparation invalide")
    require([phases.index(p["phase"]) for p in preparations] == sorted(phases.index(p["phase"]) for p in preparations), "Ordre des préparations invalide")
    for number, phase in enumerate(phases):
        items = [p for p in preparations if p["phase"] == phase]
        require([p["command_index"] for p in items] == list(range(1, len(items) + 1)) and len(items) <= count, "Commandes de préparation incomplètes")
        complete = len(items) == count and all(passed(p) for p in items)
        if number == 0 or number in {attempt for attempt, _ in reviews}:
            require(complete, "Préparation avant formalisation ou gates incomplète")
        else:
            require(count > 0 and items and not passed(items[-1]) and all(passed(p) for p in items[:-1]), "Tentative sans review ni préparation échouée")


def restore(root=agentic.ROOT, *, check=False, readonly=False):
    require(not readonly or check, "Une vérification sans verrou doit être en lecture seule")
    root = Path(root).resolve()
    with nullcontext() if readonly else agentic.lock(root):
        controller = agentic.Controller(root)
        state_before = controller.state_path.read_bytes() if controller.state_path.exists() else None
        require(state_before is None and controller.state == {"version": 1, "tickets": {}} or state_before is not None and json.loads(state_before) == controller.state, "État modifié pendant la lecture")
        require(agentic.git(root, "rev-parse", "--show-toplevel").stdout.strip() == str(root), "Le kit doit être à la racine Git")
        require(agentic.git(root, "branch", "--show-current").stdout.strip() == controller.policy.get("base_branch", "main"), "Restauration uniquement sur la branche de base")
        require(agentic.git(root, "rev-parse", "--is-shallow-repository").stdout.strip() == "false", "Historique Git incomplet : récupérer l’historique complet")
        require(not agentic.git(root, "replace", "-l").stdout.strip(), "Objets Git remplacés non pris en charge")
        grafts = Path(agentic.git(root, "rev-parse", "--git-path", "info/grafts").stdout.strip())
        require(not (grafts if grafts.is_absolute() else root / grafts).exists(), "Grafts Git non pris en charge")
        require(not controller.state_path.is_symlink(), "État local lié interdit")
        head = agentic.git(root, "rev-parse", "HEAD").stdout.strip()
        current = tree(root, head)
        require(not agentic.git(root, "status", "--porcelain").stdout.strip() and agentic.snapshot(root) == snapshot(current), "Le dépôt doit être propre et correspondre à HEAD")
        history = git_bytes(root, "log", "--full-history", "--format=", "--name-only", "-z", "--no-renames", head, "--", "docs/evidence").decode("utf-8")
        paths = sorted({p for p in history.split("\0") if EVIDENCE.fullmatch(p)})
        verified, cache = {}, {head: current}
        for path in paths:
            identifier, run_id = EVIDENCE.fullmatch(path).groups()
            origins = git_bytes(root, "log", "--full-history", "--no-merges", "--no-renames", "--diff-filter=A", "--format=%H", head, "--", path).decode().splitlines()
            require(len(origins) == 1, "Origine unique de l’attestation introuvable : " + identifier)
            commit = origins[0]
            changes = git_bytes(root, "log", "--full-history", "--no-merges", "--no-renames", "--format=%H", head, "--", path).decode().splitlines()
            require(changes == [commit], "Attestation modifiée ou supprimée : " + identifier)
            if commit not in cache:
                cache[commit] = tree(root, commit)
            files = cache[commit]
            require(path in current and current[path] == files[path], "Attestation absente ou altérée : " + identifier)
            report = committed_json(files, path)
            require(report.get("ticket") == identifier and report.get("run_id") == run_id, "Identité de l’attestation invalide")
            parents = git_bytes(root, "show", "-s", "--format=%P", commit).decode().split()
            require(parents == [report.get("base_commit")], "Livraison squashée, réécrite ou sans parent exact")
            require(git_bytes(root, "show", "-s", "--format=%s", commit).decode().strip() == "agentic: " + identifier + " validated local delivery", "Commit non identifié comme livraison du contrôleur")
            policy = committed_json(files, ".agentic/policy.json")
            tickets = committed_json(files, "backlog/tickets.json")["tickets"]
            matches = [t for t in tickets if t.get("id") == identifier]
            require(len(matches) == 1 and controller.tickets.get(identifier) == matches[0], "Contrat du ticket absent ou modifié depuis la livraison")
            ticket = matches[0]
            for config in (".agentic/policy.json", "backlog/tickets.json"):
                require(git_bytes(root, "show", parents[0] + ":" + config) == files[config][0], "Politique ou ticket modifié par la livraison")
            verify_report(report, policy, ticket)
            tested = snapshot(files)
            del tested[path]
            require(hashlib.sha256(json.dumps(tested, sort_keys=True).encode()).hexdigest() == report["code_sha256"], "Empreinte du code livré invalide ou permissions non canoniques")
            require(identifier not in verified, "Plusieurs livraisons du même ticket : restauration ambiguë")
            verified[identifier] = {"status": "integrated", "delivered_commit": commit, "base_commit": report["base_commit"], "run_id": run_id, "agent_calls": report["agent_calls"], "report": str(root / path), "restored_from_git": True}
        for identifier, record in verified.items():
            for dependency in controller.tickets[identifier]["dependencies"]:
                require(dependency in verified and agentic.git(root, "merge-base", "--is-ancestor", verified[dependency]["delivered_commit"], record["base_commit"], check=False).returncode == 0, "Dépendance livrée non vérifiable : " + dependency)
            existing = controller.state["tickets"].get(identifier, {})
            require(existing.get("status") not in ("running", "delivered_local"), "État actif ou livré conservé : " + identifier)
            require(existing.get("status") != "integrated" or existing.get("delivered_commit") == record["delivered_commit"], "État intégré incompatible : " + identifier)
        require(agentic.git(root, "rev-parse", "HEAD").stdout.strip() == head, "HEAD a changé pendant la restauration")
        require((controller.state_path.read_bytes() if controller.state_path.exists() else None) == state_before, "État modifié pendant la vérification")
        restored = sorted(identifier for identifier in verified if controller.state["tickets"].get(identifier, {}).get("status") != "integrated")
        if not check and restored:
            for identifier in restored:
                controller.state["tickets"][identifier] = verified[identifier]
            controller.save()
        return {"checked": sorted(verified), "restored": [] if check else restored, "would_restore": restored if check else [], "head": head, "check_only": check, "tests_rerun": False}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Vérifier sans écrire l’état local (verrou temporaire uniquement)")
    args = parser.parse_args(argv)
    try:
        print(json.dumps(restore(check=args.check), ensure_ascii=False, indent=2))
        return 0
    except (agentic.Blocked, OSError, ValueError, KeyError, TypeError, IndexError, UnicodeError, subprocess.SubprocessError) as exc:
        reason = str(exc) if isinstance(exc, agentic.Blocked) else "Preuve historique invalide ou lecture impossible ; état inchangé"
        print(json.dumps({"status": "blocked", "reason": reason}, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
