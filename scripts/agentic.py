#!/usr/bin/env python3
"""Local, dependency-free Codex controller. No push, merge, or deployment."""
from __future__ import annotations

import argparse
from contextlib import contextmanager
from contextvars import ContextVar
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import sys
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]
STAGES = ("formalize", "develop", "review")
CODE_GATES = {"kit", "unit", "functional", "business", "e2e"}
DEADLINE = ContextVar("ticket_deadline", default=None)
# Maintenance authorized before the campaign, restricted to these exact files.
# Controllers, contracts, policy, schemas and existing tests have no exception.
MAINTENANCE_FILES = {
    "EA-04": {".github/workflows/product-quality.yml", ".github/workflows/release.yml"},
    "EA-40": {"scripts/deploy.py", ".github/workflows/release.yml"},
}


class Blocked(RuntimeError):
    """A condition the controller must not interpret as successful delivery."""


def read_json(path):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise Blocked(f"JSON absent ou invalide : {Path(path).name}") from exc


def write_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def strings(value, nonempty=False):
    return isinstance(value, list) and (bool(value) or not nonempty) and all(isinstance(x, str) and bool(x.strip()) for x in value)


def exact(value, names):
    return isinstance(value, dict) and set(value) == set(names)


def validate_report(stage, report):
    """Validate contracts locally, even when the CLI claims schema compliance."""
    valid = isinstance(report, dict) and isinstance(report.get("summary"), str) and bool(report["summary"].strip())
    if stage == "formalize":
        valid = valid and exact(report, ("status", "summary", "requirements", "decisions", "blockers"))
        valid = valid and report["status"] in ("ready", "blocked") and strings(report["decisions"]) and strings(report["blockers"])
        valid = valid and isinstance(report["requirements"], list)
        if valid:
            ids = []
            for item in report["requirements"]:
                if not (exact(item, ("id", "description", "acceptance_tests")) and isinstance(item["id"], str) and item["id"].strip() and isinstance(item["description"], str) and item["description"].strip() and strings(item["acceptance_tests"], True)):
                    valid = False
                    break
                ids.append(item["id"])
            valid = valid and len(ids) == len(set(ids)) and (report["status"] != "ready" or bool(ids))
        valid = valid and (report["status"] != "ready" or not report["blockers"])
    elif stage == "develop":
        valid = valid and exact(report, ("status", "summary", "changed_files", "blockers"))
        valid = valid and report["status"] in ("implemented", "blocked") and strings(report["changed_files"]) and strings(report["blockers"])
        valid = valid and (report["status"] != "implemented" or not report["blockers"])
    elif stage == "review":
        valid = valid and exact(report, ("verdict", "summary", "findings", "requirements_covered"))
        valid = valid and report["verdict"] in ("pass", "changes_requested", "blocked") and strings(report["requirements_covered"])
        valid = valid and isinstance(report["findings"], list)
        if valid:
            valid = all(exact(f, ("severity", "description", "file")) and f["severity"] in ("blocking", "major", "minor") and isinstance(f["description"], str) and bool(f["description"].strip()) and isinstance(f["file"], str) for f in report["findings"])
    else:
        valid = False
    if not valid:
        raise Blocked(f"Contrat de sortie invalide : {stage}")
    return report


def validate_ticket_formalization(ticket, report):
    """Bind every frozen requirement to one exact, ordered source criterion."""
    validate_report("formalize", report)
    criteria = ticket.get("acceptance_criteria")
    if report["status"] != "ready" or not strings(criteria, True):
        raise Blocked("Formalisation prête et critères source complets requis")
    expected = [(f"AC-{number:02d}", description)
                for number, description in enumerate(criteria, 1)]
    actual = [(item["id"], item["description"]) for item in report["requirements"]]
    if actual != expected:
        raise Blocked("Couverture des critères source incomplète ou modifiée : " + ticket["id"])
    return report


def run_process(command, *, timeout, input=None, **kwargs):
    """End the process group, including children left behind by the command."""
    process = subprocess.Popen(command, start_new_session=True, **kwargs)
    try:
        stdout, stderr = process.communicate(input=input, timeout=timeout)
        return subprocess.CompletedProcess(command, process.returncode, stdout, stderr)
    finally:
        try:
            if os.name == "posix":
                os.killpg(process.pid, signal.SIGKILL)
            elif process.poll() is None:
                process.kill()
        except ProcessLookupError:
            pass
        process.wait()


def git(root, *args, check=True):
    timeout = 30 if DEADLINE.get() is None else min(30, DEADLINE.get() - time.monotonic())
    if timeout <= 0:
        raise Blocked("Budget de temps du ticket épuisé")
    result = run_process(["git", "-C", str(root), *args], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=timeout)
    if check and result.returncode:
        raise Blocked("Commande Git refusée : " + args[0])
    return result


def validate(root):
    policy = read_json(root / ".agentic/policy.json")
    if not isinstance(policy, dict) or policy.get("version") != 1 or policy.get("delivery_mode") != "local_commit":
        raise Blocked("Version ou mode de livraison de policy.json invalide")
    for name in ("max_attempts", "max_seconds_per_agent", "max_ticket_seconds", "max_agent_calls"):
        if type(policy.get(name)) is not int or policy[name] < 1:
            raise Blocked("Budget invalide : " + name)
    if policy.get("model") is not None and not isinstance(policy["model"], str):
        raise Blocked("model doit être une chaîne ou null")
    commands = policy.get("prepare_commands", [])
    if not isinstance(commands, list) or any(not strings(command, True) for command in commands):
        raise Blocked("Commandes de préparation invalides")
    if type(policy.get("development_network_access", False)) is not bool:
        raise Blocked("development_network_access doit être un booléen")
    paths = policy.get("protected_paths")
    if not strings(paths, True) or any(Path(p).is_absolute() or ".." in Path(p).parts or p in ("", ".") for p in paths):
        raise Blocked("protected_paths invalide")
    gates = policy.get("gates")
    if not isinstance(gates, dict) or not CODE_GATES.issubset(gates) or any(not strings(cmd, True) for cmd in gates.values()):
        raise Blocked("Commandes de gates invalides")
    for stage in STAGES:
        schema = read_json(root / f".agentic/schemas/{stage}.json")
        if not isinstance(schema, dict) or schema.get("type") != "object" or schema.get("additionalProperties") is not False:
            raise Blocked("Schéma JSON strict attendu : " + stage)
        prompt = root / f".agentic/prompts/{stage}.md"
        if not prompt.is_file() or not prompt.read_text(encoding="utf-8").strip():
            raise Blocked("Prompt absent : " + stage)
    data = read_json(root / "backlog/tickets.json")
    source = read_json(root / "backlog/source.json")
    if not isinstance(data, dict) or not isinstance(data.get("tickets"), list) or not isinstance(source, dict) or not isinstance(source.get("tickets"), list):
        raise Blocked("Backlog invalide")
    tickets = data["tickets"]
    index = {}
    for item in tickets:
        if not isinstance(item, dict) or not isinstance(item.get("id"), str) or not re.fullmatch(r"[A-Z][A-Z0-9]*-\d+", item["id"]) or item["id"] in index:
            raise Blocked("Identifiant de ticket invalide ou dupliqué")
        if not isinstance(item.get("title"), str) or not item["title"].strip() or item.get("kind") not in ("discovery", "code", "infrastructure"):
            raise Blocked("Description ou nature de ticket invalide")
        if not strings(item.get("dependencies")) or len(set(item["dependencies"])) != len(item["dependencies"]) or not strings(item.get("acceptance_criteria"), True) or not strings(item.get("required_gates"), True):
            raise Blocked("Contrat de ticket incomplet : " + item["id"])
        required = set(item["required_gates"])
        if "kit" not in required or not required.issubset(gates) or (item["kind"] == "code" and not CODE_GATES.issubset(required)) or (item.get("requires_evals") and "evals" not in required):
            raise Blocked("Gates obligatoires absentes : " + item["id"])
        if item.get("requires_ux") and "ux" not in required:
            raise Blocked("Gate UX obligatoire absente : " + item["id"])
        index[item["id"]] = item
    source_ids = [item.get("id") for item in source["tickets"] if isinstance(item, dict)]
    if not all(isinstance(identifier, str) for identifier in source_ids) or len(source_ids) != len(source["tickets"]) or len(source_ids) != len(set(source_ids)) or not set(source_ids).issubset(index):
        raise Blocked("IDs source et backlog désynchronisés")
    bootstrap_path = root / "backlog/bootstrap.json"
    if bootstrap_path.exists():
        bootstrap = read_json(bootstrap_path)
        if not exact(bootstrap, ("version", "tickets")) or bootstrap["version"] != 1 or not isinstance(bootstrap["tickets"], list):
            raise Blocked("Référentiel bootstrap invalide")
        bootstrap_tickets = bootstrap["tickets"]
        bootstrap_ids = [item.get("id") for item in bootstrap_tickets if isinstance(item, dict)]
        if len(bootstrap_tickets) != 2 or len(bootstrap_ids) != 2 or set(bootstrap_ids) != {"INIT-01", "DEV-01"} or set(index) - set(source_ids) != set(bootstrap_ids):
            raise Blocked("IDs bootstrap et backlog désynchronisés")
        for item in bootstrap_tickets:
            if index.get(item["id"]) != item:
                raise Blocked("Contrat bootstrap modifié : " + item["id"])
    elif set(index) - set(source_ids) not in (set(), {"INIT-01"}):
        # Compatibility for the original kit and its reduced offline fixtures.
        raise Blocked("Référentiel bootstrap absent pour les tickets supplémentaires")
    for item in source["tickets"]:
        current = index[item["id"]]
        if item.get("requires_ux") and not current.get("requires_ux"):
            raise Blocked("Exigence de validation UX supprimée : " + item["id"])
        # Historical isolated fixtures contain only source IDs. A repository with
        # bootstrap contracts must retain the complete original requirements.
        if bootstrap_path.exists() or "acceptance_criteria" in item:
            if not strings(item.get("acceptance_criteria"), True) or current["acceptance_criteria"] != item["acceptance_criteria"]:
                raise Blocked("Critères source modifiés : " + item["id"])
        if bootstrap_path.exists() or "dependencies" in item:
            dependencies = item.get("dependencies")
            if not strings(dependencies) or not set(dependencies).issubset(current["dependencies"]):
                raise Blocked("Dépendances source supprimées : " + item["id"])
            # This prerequisite already existed in the delivered starter.
            permitted_extras = {"INIT-01"} if item["id"] == "EA-04" else set()
            if set(current["dependencies"]) - set(dependencies) - permitted_extras:
                raise Blocked("Dépendances source modifiées : " + item["id"])
    visited, active = set(), set()
    def visit(identifier):
        if identifier not in index:
            raise Blocked("Dépendance inconnue : " + identifier)
        if identifier in active:
            raise Blocked("Cycle de dépendances")
        if identifier in visited:
            return
        active.add(identifier)
        for dependency in index[identifier]["dependencies"]:
            visit(dependency)
        active.remove(identifier)
        visited.add(identifier)
    for identifier in index:
        visit(identifier)
    grants = policy.get("maintenance", {})
    if not isinstance(grants, dict):
        raise Blocked("Maintenance doit être une table de tickets et fichiers exacts")
    for identifier, names in grants.items():
        if identifier not in index or identifier not in MAINTENANCE_FILES or not strings(names, True) or len(names) != len(set(names)) or not set(names).issubset(MAINTENANCE_FILES[identifier]):
            raise Blocked("Périmètre de maintenance non autorisé : " + str(identifier))
    return policy, index


def snapshot(root):
    """Tracked and nonignored files; do not include transient ignored run logs."""
    names = git(root, "ls-files", "-z", "--cached", "--others", "--exclude-standard").stdout.split("\0")
    result = {}
    for name in sorted(set(names) - {""}):
        path = root / name
        if path.is_symlink():
            raise Blocked("Lien symbolique non pris en charge")
        if path.is_file():
            result[name] = [digest(path), path.stat().st_mode & 0o777]
        elif path.exists():
            raise Blocked("Sous-module ou fichier spécial non pris en charge")
    return result


def existing_test(name):
    parts = Path(name).parts
    return any(part in ("test", "tests", "__tests__", "acceptance", "spec", "specs", "cypress") for part in parts) or bool(re.search(r"(^|/)(test_.*|conftest\.py)$|(_test|Test|Tests|\.test|\.spec|\.cy)\.", name))


def protected(name, policy):
    always = (".agentic/policy.json", ".agentic/schemas", ".agentic/prompts", "scripts", "tests/tooling", ".codex", "backlog/bootstrap.json")
    return Path(name).name in ("AGENTS.md", "AGENTS.override.md", "conftest.py") or any(name == p or name.startswith(p.rstrip("/") + "/") for p in list(policy["protected_paths"]) + list(always))


def enforce(root, baseline, head, policy, ticket=None):
    if git(root, "rev-parse", "HEAD").stdout.strip() != head:
        raise Blocked("HEAD a changé hors du contrôleur")
    current = snapshot(root)
    permitted = set(policy.get("maintenance", {}).get(ticket, [])) & MAINTENANCE_FILES.get(ticket, set())
    for name in set(baseline) | set(current):
        if name in permitted:
            if name in baseline and name not in current:
                raise Blocked("Suppression d’un fichier de maintenance interdite : " + name)
            if name.startswith(".github/workflows/") and baseline.get(name) != current.get(name):
                import importlib.util
                spec = importlib.util.spec_from_file_location("workflow_contract", Path(__file__).with_name("workflow_contract.py"))
                verifier = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(verifier)
                try:
                    verifier.validate_workflow_edit(name, git(root, "show", head + ":" + name).stdout, (root / name).read_text(encoding="utf-8"))
                except verifier.WorkflowContractError as exc:
                    raise Blocked(str(exc)) from exc
            continue
        if (protected(name, policy) or (name in baseline and existing_test(name))) and baseline.get(name) != current.get(name):
            raise Blocked("Fichier protégé ou test existant modifié : " + name)
    # Also detect ignored instruction files, including newly nested AGENTS.md.
    for directory, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in (".git", "node_modules", ".venv", "__pycache__") and Path(directory, d) != root / ".agentic/runs"]
        for name in files + dirs:
            path = Path(directory, name)
            if path.is_symlink():
                raise Blocked("Lien symbolique non pris en charge")
            if name in ("AGENTS.md", "AGENTS.override.md", "conftest.py") and path.relative_to(root).as_posix() not in baseline:
                raise Blocked("Nouveau fichier AGENTS.md interdit")
    return current


@contextmanager
def lock(root):
    path = root / ".agentic/run.lock"
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError as exc:
        raise Blocked("Exécution verrouillée ; vérifier le processus avant de retirer .agentic/run.lock") from exc
    try:
        os.write(descriptor, str(os.getpid()).encode())
        os.close(descriptor)
        yield
    finally:
        path.unlink(missing_ok=True)


class Controller:
    def __init__(self, root=ROOT):
        self.root = Path(root).resolve()
        self.policy, self.tickets = validate(self.root)
        self.identifier = None
        self.state_path = self.root / ".agentic/state.json"
        self.state = read_json(self.state_path) if self.state_path.exists() else {"version": 1, "tickets": {}}
        if not isinstance(self.state, dict) or self.state.get("version") != 1 or not isinstance(self.state.get("tickets"), dict):
            raise Blocked("État invalide")

    def save(self):
        write_json(self.state_path, self.state)

    def reconcile(self):
        changed, integrated = False, []
        for identifier, value in self.state["tickets"].items():
            if value.get("status") in ("delivered_local", "integrated"):
                ancestor = value.get("delivered_commit") and git(self.root, "merge-base", "--is-ancestor", value["delivered_commit"], "HEAD", check=False).returncode == 0
                status = "integrated" if ancestor else "delivered_local"
                if value["status"] != status:
                    value["status"], changed = status, True
                    if ancestor:
                        integrated.append(identifier)
        if changed:
            self.save()
        return integrated

    def ready(self):
        return [t for t in self.tickets.values() if self.state["tickets"].get(t["id"], {}).get("status") not in ("integrated", "delivered_local", "running") and all(self.dependency_integrated(d) for d in t["dependencies"])]

    def dependency_integrated(self, identifier):
        value = self.state["tickets"].get(identifier, {})
        return value.get("status") == "integrated" and bool(value.get("delivered_commit")) and git(self.root, "merge-base", "--is-ancestor", value["delivered_commit"], "HEAD", check=False).returncode == 0

    def remaining(self):
        remaining = self.policy["max_ticket_seconds"] - (time.monotonic() - self.started)
        if remaining <= 0:
            raise Blocked("Budget de temps du ticket épuisé")
        return min(remaining, self.policy["max_seconds_per_agent"])

    def stable(self, expected):
        current = enforce(self.worktree, self.baseline, self.head, self.policy, self.identifier)
        if expected is not None and current != expected:
            raise Blocked("Code modifié depuis la validation précédente")
        if git(self.root, "rev-parse", "HEAD").stdout.strip() != self.head:
            raise Blocked("La branche de départ a changé")
        if git(self.worktree, "reflog", "show", "--format=%H %gs", "HEAD").stdout != self.head_history:
            raise Blocked("Historique HEAD modifié hors du contrôleur")
        if self.contract_hash is not None and (not self.contract_path.is_file() or digest(self.contract_path) != self.contract_hash):
            raise Blocked("Contrat formalisé modifié ou absent")
        return current

    def stage(self, stage, context):
        if self.calls >= self.policy["max_agent_calls"]:
            raise Blocked("Budget d’appels Codex épuisé")
        timeout = self.remaining()
        self.calls += 1
        self.record["agent_calls"] = self.calls
        self.save()
        output = self.run_dir / f"{self.calls:02d}-{stage}.json"
        log = self.run_dir / f"{self.calls:02d}-{stage}.log"
        prompt = (self.worktree / f".agentic/prompts/{stage}.md").read_text(encoding="utf-8")
        context = dict(context, maintenance_paths=self.policy.get("maintenance", {}).get(self.identifier, []))
        prompt += "\n\nContexte fourni par le contrôleur local :\n" + json.dumps(context, ensure_ascii=False)
        # This setting governs workspace-write; the other roles use read-only + never.
        network = stage == "develop" and self.policy.get("development_network_access", False)
        command = ["codex", "-a", "never", "-c", "sandbox_workspace_write.network_access=" + str(network).lower(), "exec", "--sandbox", "workspace-write" if stage == "develop" else "read-only", "--output-schema", str(self.worktree / f".agentic/schemas/{stage}.json"), "--output-last-message", str(output), "--json"]
        if self.policy["model"]:
            command += ["--model", self.policy["model"]]
        command.append("-")
        try:
            with log.open("w", encoding="utf-8") as stream:
                result = run_process(command, cwd=self.worktree, stdin=subprocess.PIPE, input=prompt, text=True, stdout=stream, stderr=subprocess.STDOUT, timeout=timeout)
        except subprocess.TimeoutExpired as exc:
            raise Blocked("Délai dépassé : " + stage) from exc
        except OSError as exc:
            raise Blocked("Codex indisponible ; aucune livraison") from exc
        if result.returncode:
            raise Blocked("Codex a échoué : " + stage)
        self.remaining()
        report = validate_report(stage, read_json(output))
        self.reports.append({"stage": stage, "call": self.calls, "sha256": digest(output), "report": report})
        return report

    def prepare(self, phase, expected):
        results = []
        for index, command in enumerate(self.policy.get("prepare_commands", []), 1):
            log = self.run_dir / f"prepare-{phase}-{index}.log"
            code, timed_out = None, False
            try:
                with log.open("w", encoding="utf-8") as stream:
                    result = run_process(command, cwd=self.worktree, stdout=stream, stderr=subprocess.STDOUT, timeout=self.remaining())
                code = result.returncode
            except subprocess.TimeoutExpired:
                timed_out = True
            except OSError:
                code = 127
            item = {"phase": phase, "command_index": index, "exit_code": code, "timed_out": timed_out, "log_sha256": digest(log), "passed": code == 0 and not timed_out}
            results.append(item)
            self.preparation_history.append(item)
            self.record["preparations"] = self.preparation_history
            self.save()
            self.stable(expected)
            if not item["passed"]:
                break
        return results

    def gates(self, ticket, expected):
        results = []
        for name in ticket["required_gates"]:
            log = self.run_dir / f"attempt-{self.attempt}-{name}.log"
            code, timed_out = None, False
            try:
                with log.open("w", encoding="utf-8") as stream:
                    result = run_process(self.policy["gates"][name], cwd=self.worktree, stdout=stream, stderr=subprocess.STDOUT, timeout=self.remaining())
                code = result.returncode
            except subprocess.TimeoutExpired:
                timed_out = True
            except OSError:
                code = 127
            self.stable(expected)
            results.append({"name": name, "exit_code": code, "timed_out": timed_out, "log_sha256": digest(log), "passed": code == 0 and not timed_out})
        self.gate_history.append({"attempt": self.attempt, "results": results})
        return results

    def run(self, identifier):
        if os.name != "posix":
            raise Blocked("Exécution prise en charge sur Linux/macOS/WSL ; arrêt des groupes de processus requis")
        with lock(self.root):
            self.identifier = identifier
            self.reconcile()
            if identifier not in self.tickets:
                raise Blocked("Ticket inconnu")
            if identifier not in {t["id"] for t in self.ready()}:
                raise Blocked("Ticket non disponible ; dépendances intégrées requises")
            if git(self.root, "rev-parse", "--show-toplevel").stdout.strip() != str(self.root):
                raise Blocked("Le kit doit être la racine du dépôt Git")
            self.head = git(self.root, "rev-parse", "HEAD").stdout.strip()
            if git(self.root, "status", "--porcelain").stdout.strip():
                raise Blocked("Le dépôt de départ doit être propre et commité")
            if shutil.which("codex") is None:
                raise Blocked("Codex CLI absent ; aucune session lancée")
            self.started, self.calls, self.reports, self.gate_history = time.monotonic(), 0, [], []
            self.preparation_history = []
            run_id = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime()) + "-" + uuid.uuid4().hex[:8]
            branch = f"agentic/{identifier.lower()}/{run_id}"
            self.worktree = self.root.parent / ".encave-agent-worktrees" / (identifier + "-" + run_id)
            self.worktree.parent.mkdir(exist_ok=True)
            self.record = {"status": "running", "branch": branch, "worktree": str(self.worktree), "run_id": run_id, "base_commit": self.head, "agent_calls": 0}
            self.state["tickets"][identifier] = self.record
            self.save()
            deadline_token = DEADLINE.set(self.started + self.policy["max_ticket_seconds"])
            try:
                git(self.root, "worktree", "add", "-b", branch, str(self.worktree), self.head)
                self.baseline = snapshot(self.worktree)
                self.head_history = git(self.worktree, "reflog", "show", "--format=%H %gs", "HEAD").stdout
                self.run_dir = self.worktree / ".agentic/runs" / run_id
                self.run_dir.mkdir(parents=True)
                self.contract_path = self.run_dir / "formalized-contract.json"
                self.contract_hash = None
                ticket = self.tickets[identifier]
                prepared = self.prepare("before-formalize", self.baseline)
                if any(not item["passed"] for item in prepared):
                    raise Blocked("Préparation initiale des dépendances en échec ; consulter le journal local")
                formal = self.stage("formalize", {"ticket": ticket})
                self.stable(self.baseline)
                if formal["status"] != "ready":
                    raise Blocked("Formalisation bloquée ; consulter le rapport local")
                validate_ticket_formalization(ticket, formal)
                write_json(self.contract_path, formal)
                self.contract_hash = digest(self.contract_path)
                feedback = None
                for self.attempt in range(1, self.policy["max_attempts"] + 1):
                    develop = self.stage("develop", {"ticket": ticket, "contract": formal, "contract_sha256": self.contract_hash, "previous_feedback": feedback})
                    expected = self.stable(None)
                    if develop["status"] != "implemented":
                        raise Blocked("Développement bloqué ; consulter le rapport local")
                    prepared = self.prepare(f"attempt-{self.attempt}", expected)
                    if any(not item["passed"] for item in prepared):
                        feedback = {"preparations": prepared, "reason": "Préparation des dépendances en échec"}
                        continue
                    gates = self.gates(ticket, expected)
                    review = self.stage("review", {"ticket": ticket, "contract": formal, "development": develop, "gates": gates, "base_commit": self.head})
                    self.stable(expected)
                    covered = set(review["requirements_covered"])
                    required = {r["id"] for r in formal["requirements"]}
                    passed = review["verdict"] == "pass" and not any(f["severity"] in ("blocking", "major") for f in review["findings"]) and covered == required and all(g["passed"] for g in gates)
                    if passed:
                        return self.deliver(identifier, formal, expected)
                    if review["verdict"] == "blocked":
                        raise Blocked("Revue bloquée ; consulter le rapport local")
                    feedback = {"review": review, "gates": gates, "missing_requirement_ids": sorted(required - covered)}
                raise Blocked("Nombre maximal de tentatives atteint sans validation complète")
            except (Blocked, OSError, subprocess.SubprocessError, KeyboardInterrupt) as exc:
                self.record.update(status="blocked", reason=str(exc) if isinstance(exc, Blocked) else "Exécution interrompue ou erreur locale ; aucune livraison confirmée", agent_calls=self.calls)
                self.save()
                if isinstance(exc, KeyboardInterrupt):
                    raise Blocked("Exécution interrompue") from exc
                if isinstance(exc, Blocked):
                    raise
                raise Blocked(self.record["reason"]) from exc
            finally:
                DEADLINE.reset(deadline_token)

    def deliver(self, identifier, formal, expected):
        self.remaining()
        self.stable(expected)
        evidence_path = self.worktree / "docs/evidence" / identifier / (self.record["run_id"] + ".json")
        evidence = {"version": 1, "ticket": identifier, "run_id": self.record["run_id"], "result": "passed_for_local_delivery", "base_commit": self.head, "contract_sha256": self.contract_hash, "requirements": formal["requirements"], "reports": self.reports, "gates": self.gate_history, "preparations": self.preparation_history, "agent_calls": self.calls, "code_sha256": hashlib.sha256(json.dumps(expected, sort_keys=True).encode()).hexdigest()}
        write_json(evidence_path, evidence)
        evidence_snapshot = snapshot(self.worktree)
        name = evidence_path.relative_to(self.worktree).as_posix()
        if {k: v for k, v in evidence_snapshot.items() if k != name} != expected:
            raise Blocked("Code modifié avant préparation du commit")
        self.baseline[name] = evidence_snapshot[name]  # Only this controller-written evidence file.
        self.stable(evidence_snapshot)
        git(self.worktree, "add", "-A")
        self.stable(evidence_snapshot)
        staged = {}
        for entry in git(self.worktree, "ls-files", "--stage", "-z").stdout.split("\0"):
            if entry:
                metadata, path = entry.split("\t", 1)
                mode, oid, stage = metadata.split()
                staged[path] = [oid, mode, stage]
        if set(staged) != set(evidence_snapshot):
            raise Blocked("Index différent des fichiers validés")
        for path, (_, mode) in evidence_snapshot.items():
            expected_mode = "100755" if mode & 0o111 else "100644"
            if staged[path] != [git(self.worktree, "hash-object", "--no-filters", "--", path).stdout.strip(), expected_mode, "0"]:
                raise Blocked("Index différent des fichiers validés")
        tree = git(self.worktree, "write-tree").stdout.strip()
        self.remaining()
        git(self.worktree, "commit", "-m", f"agentic: {identifier} validated local delivery")
        commit = git(self.worktree, "rev-parse", "HEAD").stdout.strip()
        if git(self.worktree, "rev-parse", "HEAD^{tree}").stdout.strip() != tree or git(self.worktree, "rev-parse", "HEAD^").stdout.strip() != self.head or snapshot(self.worktree) != evidence_snapshot or git(self.worktree, "status", "--porcelain").stdout.strip():
            raise Blocked("Commit non conforme ; livraison non confirmée")
        self.record.update(status="delivered_local", delivered_commit=commit, report=str(evidence_path), agent_calls=self.calls)
        self.save()
        return self.record


def doctor(root):
    """Passive diagnostics: do not contact a provider or display credentials."""
    return {"python": sys.version.split()[0], "git_present": shutil.which("git") is not None, "codex_present": shutil.which("codex") is not None, "auth_file_present": (Path(os.environ.get("CODEX_HOME", str(Path.home() / ".codex"))) / "auth.json").is_file(), "api_key_environment_present": bool(os.environ.get("OPENAI_API_KEY")), "auth_verified": False, "git_repository": git(root, "rev-parse", "--is-inside-work-tree", check=False).returncode == 0 if shutil.which("git") else False}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("validate", "doctor", "status", "next", "reconcile", "run", "batch"))
    parser.add_argument("--ticket")
    parser.add_argument("--limit", type=int, default=1)
    args = parser.parse_args(argv)
    try:
        if args.command == "validate":
            _, tickets = validate(ROOT)
            print(json.dumps({"valid": True, "tickets": len(tickets)}))
        elif args.command == "doctor":
            print(json.dumps(doctor(ROOT), ensure_ascii=False))
        else:
            controller = Controller()
            if args.command == "status":
                print(json.dumps(controller.state, ensure_ascii=False, indent=2))
            elif args.command == "next":
                ready = controller.ready()
                print(json.dumps({"ticket": ready[0] if ready else None, "ready": [t["id"] for t in ready]}, ensure_ascii=False))
            elif args.command == "reconcile":
                with lock(ROOT):
                    print(json.dumps({"integrated": controller.reconcile()}, ensure_ascii=False))
            elif args.command == "run":
                if not args.ticket:
                    raise Blocked("--ticket est obligatoire")
                print(json.dumps(controller.run(args.ticket), ensure_ascii=False))
            else:
                if args.limit < 1:
                    raise Blocked("--limit doit être positif")
                attempted, results = set(), []
                for _ in range(args.limit):
                    with lock(ROOT):
                        controller.reconcile()
                    candidates = [t for t in controller.ready() if t["id"] not in attempted]
                    if not candidates:
                        break
                    identifier = candidates[0]["id"]
                    attempted.add(identifier)
                    try:
                        record = controller.run(identifier)
                        results.append({"ticket": identifier, "status": record["status"]})
                    except Blocked as exc:
                        results.append({"ticket": identifier, "status": "blocked", "reason": str(exc)})
                print(json.dumps(results, ensure_ascii=False))
                if any(item["status"] == "blocked" for item in results):
                    return 1
        return 0
    except (Blocked, OSError, subprocess.SubprocessError) as exc:
        print(json.dumps({"status": "blocked", "reason": str(exc) if isinstance(exc, Blocked) else "Erreur locale ; diagnostic nécessaire"}, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
