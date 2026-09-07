#!/usr/bin/env python3
"""Bounded, resumable local campaign. Runs and integrates every eligible ticket."""
from __future__ import annotations

import argparse
from contextlib import contextmanager
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time

import agentic
import autopilot
import restore_progress

DEFAULTS = {"max_ticket_runs": 126, "max_agent_calls": 336,
            "max_wall_seconds": 604800, "max_runs_per_ticket": 3}
STATUSES = {"running", "complete", "blocked", "budget_exhausted", "stopped", "publish_blocked"}


def require(condition, message):
    if not condition:
        raise agentic.Blocked(message)


def fingerprint(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


@contextmanager
def campaign_lock(root):
    """OS advisory lock is released on exit/crash; no stale PID removal needed."""
    require(os.name == "posix", "Campagne prise en charge sur Linux/macOS/WSL")
    import fcntl
    path = root / ".agentic/continuous.lock"
    require(not path.is_symlink(), "Verrou de campagne lié interdit")
    with path.open("a+") as stream:
        try:
            fcntl.flock(stream, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as exc:
            raise agentic.Blocked("Une campagne est déjà active") from exc
        try:
            yield
        finally:
            fcntl.flock(stream, fcntl.LOCK_UN)


class Campaign:
    def __init__(self, root=agentic.ROOT):
        self.root = Path(root).resolve()
        self.path = self.root / ".agentic/continuous.json"
        self.stop_path = self.root / ".agentic/continuous.stop"
        require(not self.path.is_symlink(), "Checkpoint lié interdit")
        self.controller = agentic.Controller(self.root)
        configuration = self.controller.policy.get("continuous", DEFAULTS).copy()
        self.publish_mode = configuration.pop("publish_mode", "local")
        require(self.publish_mode in ("local", "verified_push"), "Mode de publication invalide")
        self.limits = configuration
        require(set(self.limits) == set(DEFAULTS) and all(type(n) is int and n > 0 for n in self.limits.values()), "Limites de campagne invalides")
        self.plan = {"policy_sha256": fingerprint(self.controller.policy),
                     "ticket_ids": list(self.controller.tickets),
                     "ticket_contracts": {key: fingerprint(value) for key, value in self.controller.tickets.items()}}
        self.data = agentic.read_json(self.path) if self.path.exists() else None
        if self.data is not None:
            require(isinstance(self.data, dict) and self.data.get("version") == 1 and self.data.get("status") in STATUSES, "Checkpoint invalide")
            require(self.data.get("plan") == self.plan and self.data.get("limits") == self.limits, "Plan ou politique modifié depuis le début ; maintenance explicite requise")
            require(isinstance(self.data.get("runs"), list) and isinstance(self.data.get("tickets"), dict), "Journal de campagne invalide")
            require(type(self.data.get("started_at")) in (int, float) and self.data["started_at"] <= time.time(), "Horodatage de campagne invalide")
            for run in self.data["runs"]:
                require(isinstance(run, dict) and run.get("ticket") in self.controller.tickets and type(run.get("reserved_calls")) is int and run["reserved_calls"] >= 0, "Réservation de budget invalide")
                require(run.get("agent_calls") is None or type(run["agent_calls"]) is int and 0 <= run["agent_calls"] <= run["reserved_calls"], "Compteur d’appels invalide")
            require(set(self.data["tickets"]).issubset(self.controller.tickets), "Ticket inconnu dans le checkpoint")
            for identifier, record in self.data["tickets"].items():
                require(isinstance(record, dict) and record.get("status") in ("running", "blocked", "delivered_local", "integrated"), "Statut de ticket invalide")
                require(any(run["ticket"] == identifier for run in self.data["runs"]), "Journal de budget incomplet")
        self.stopping = False

    def save(self):
        agentic.write_json(self.path, self.data)

    def head(self):
        return agentic.git(self.root, "rev-parse", "HEAD").stdout.strip()

    def checkout(self):
        require(agentic.git(self.root, "rev-parse", "--show-toplevel").stdout.strip() == str(self.root), "Le kit doit être la racine Git")
        require(agentic.git(self.root, "branch", "--show-current").stdout.strip() == self.controller.policy.get("base_branch", "main"), "Campagne uniquement sur la branche de base")
        require(not agentic.git(self.root, "status", "--porcelain").stdout.strip(), "Le dépôt doit être propre et commité")
        head = self.head()
        autopilot.assert_checkout(self.root, head)
        return head

    def used_calls(self):
        return sum(run["reserved_calls"] if run["agent_calls"] is None else run["agent_calls"] for run in self.data["runs"])

    def initialize(self):
        self.checkout()
        # Reconstruct only provable historical deliveries, never invent completion.
        verified = restore_progress.restore(self.root)
        self.controller = agentic.Controller(self.root)
        require({key for key, record in self.controller.state["tickets"].items() if record.get("status") == "integrated"}.issubset(verified["checked"]), "État intégré sans attestation historique vérifiée")
        self.data = {"version": 1, "status": "running", "plan": self.plan,
                     "limits": self.limits, "started_at": time.time(),
                     "expected_head": verified["head"], "runs": [], "tickets": {}, "retry": None,
                     "remote_sha256": self.remote_identity() if self.publish_mode == "verified_push" else None,
                     "published_commit": None, "pending_push": None}
        for identifier, record in self.controller.state["tickets"].items():
            require(identifier in self.controller.tickets, "État contenant un ticket inconnu")
            calls = record.get("agent_calls", 0)
            require(type(calls) is int and calls >= 0, "Compteur historique invalide")
            self.data["runs"].append({"ticket": identifier, "reserved_calls": calls,
                                      "agent_calls": calls, "run_id": record.get("run_id"), "historical": True})
            self.data["tickets"][identifier] = record.copy()
        self.save()

    def synchronize(self):
        """Resume uncertain delivery only through exact evidence; never rerun running work."""
        self.controller = agentic.Controller(self.root)
        pending = self.data.get("active")
        if pending is not None:
            require(type(pending) is int and 0 <= pending < len(self.data["runs"]), "Exécution active invalide")
            run = self.data["runs"][pending]
            record = self.controller.state["tickets"].get(run["ticket"], {})
            if record.get("run_id") != run.get("previous_run_id"):
                calls = record.get("agent_calls", 0)
                require(type(calls) is int and 0 <= calls <= run["reserved_calls"], "Budget consommé incohérent")
                # A crash leaves the full reservation charged until the state is terminal.
                if record.get("status") in ("blocked", "delivered_local", "integrated"):
                    run.update(agent_calls=calls, run_id=record.get("run_id"))
                    self.data["tickets"][run["ticket"]] = record.copy()
                    self.data.pop("active", None)
                    self.save()
                else:
                    raise agentic.Blocked("Exécution interrompue incertaine : " + run["ticket"] + "; inspecter les processus et preuves avant réparation")
            else:
                raise agentic.Blocked("Réservation interrompue avant résultat : " + run["ticket"] + "; budget conservé, inspection nécessaire")
        for identifier, record in self.controller.state["tickets"].items():
            remembered = self.data["tickets"].get(identifier)
            require(remembered is not None, "État créé hors campagne : " + identifier)
            require(record.get("run_id") == remembered.get("run_id"), "Exécution modifiée hors campagne : " + identifier)
            if record.get("status") == "running":
                raise agentic.Blocked("Exécution encore active ou interrompue : " + identifier)
            if record.get("status") in ("delivered_local", "integrated"):
                target = record.get("delivered_commit")
                require(target == remembered.get("delivered_commit"), "Livraison modifiée hors campagne")
                if record["status"] == "delivered_local":
                    current = self.head()
                    if current == record.get("base_commit") == self.data["expected_head"]:
                        autopilot.integrate(self.root, identifier)
                    elif current == target and self.data["expected_head"] in (record.get("base_commit"), target):
                        # Crash after FF but before reconcile/checkpoint.
                        autopilot.verify_evidence(self.root, self.controller, identifier, record)
                        with agentic.lock(self.root):
                            self.controller.reconcile()
                    else:
                        raise agentic.Blocked("Base modifiée avant reprise de livraison")
                    self.data["expected_head"] = target
                    self.controller = agentic.Controller(self.root)
                    self.data["tickets"][identifier] = self.controller.state["tickets"][identifier].copy()
                    self.save()
                elif self.head() == target and self.data["expected_head"] == record.get("base_commit"):
                    # Crash after reconcile, before campaign checkpoint.
                    autopilot.verify_evidence(self.root, self.controller, identifier, record)
                    self.data["expected_head"] = target
                    self.data["tickets"][identifier] = record.copy()
                    self.save()
                require(self.controller.dependency_integrated(identifier), "Livraison intégrée absente de HEAD : " + identifier)
            else:
                require(record == remembered, "État modifié hors campagne : " + identifier)
        for identifier, remembered in self.data["tickets"].items():
            if remembered.get("run_id"):
                require(identifier in self.controller.state["tickets"], "État local supprimé : " + identifier)
        require(self.checkout() == self.data["expected_head"], "HEAD a changé hors campagne ; revalidation explicite requise")

    def result(self, status=None, reason=None):
        if status:
            self.data["status"] = status
            self.data["reason"] = reason
            self.save()
        if self.data is None:
            return {"status": "not_started", "tickets_total": len(self.controller.tickets), "remote_published": False, "production_deployed": False}
        return {"status": self.data["status"], "reason": self.data.get("reason"),
                "tickets_total": len(self.controller.tickets),
                "integrated": sorted(key for key, value in self.data["tickets"].items() if value.get("status") == "integrated"),
                "blocked": sorted(key for key, value in self.data["tickets"].items() if value.get("status") == "blocked"),
                "ticket_runs": len(self.data["runs"]), "agent_calls_charged": self.used_calls(),
                "limits": self.limits, "expected_head": self.data["expected_head"],
                "remote_published": self.publish_mode == "verified_push" and self.data.get("published_commit") == self.data["expected_head"] and not self.data.get("pending_push"),
                "pending_push": self.data.get("pending_push"), "production_deployed": False}

    def status(self):
        result = self.result()
        if self.data is not None:
            invalid = self.head() != self.data["expected_head"]
            if result["status"] == "complete":
                invalid = invalid or bool(agentic.git(self.root, "status", "--porcelain").stdout.strip())
                invalid = invalid or any(not self.controller.dependency_integrated(key) for key in self.controller.tickets)
                invalid = invalid or self.controller.state["tickets"] != self.data["tickets"]
                if not invalid:
                    try:
                        verified = restore_progress.restore(self.root, check=True, readonly=True)
                        invalid = set(verified["checked"]) != set(self.controller.tickets)
                    except (agentic.Blocked, OSError, ValueError, TypeError, KeyError, IndexError, subprocess.SubprocessError):
                        invalid = True
            if invalid:
                result.update(status="blocked", reason="État ou HEAD diffère du checkpoint ; reprise vérifiée nécessaire")
        return result

    def run_ticket(self, identifier, available_calls, remaining_seconds):
        controller = agentic.Controller(self.root)
        previous = controller.state["tickets"].get(identifier, {}).get("run_id")
        reserve = min(controller.policy["max_agent_calls"], available_calls)
        run = {"ticket": identifier, "reserved_calls": reserve, "agent_calls": None,
               "previous_run_id": previous, "base_commit": self.data["expected_head"]}
        self.data["runs"].append(run)
        self.data["active"] = len(self.data["runs"]) - 1
        if self.data.get("retry") == identifier:
            self.data["retry"] = None
        self.save()  # Reserve before a provider can be called; crash cannot reset budget.
        controller.policy = controller.policy.copy()
        controller.policy["max_agent_calls"] = reserve
        controller.policy["max_ticket_seconds"] = min(controller.policy["max_ticket_seconds"], remaining_seconds)
        failure = None
        try:
            controller.run(identifier)
        except agentic.Blocked as exc:
            failure = str(exc)
            if failure == "Exécution interrompue":
                self.stopping = True
        fresh = agentic.Controller(self.root).state["tickets"].get(identifier, {})
        if fresh.get("run_id") == previous:
            require(failure is not None, "Aucun nouveau résultat de contrôleur")
            record = fresh.copy() if fresh else {"status": "blocked", "reason": failure, "agent_calls": 0}
            calls = 0
        else:
            record = fresh.copy()
            require(record.get("status") in ("blocked", "delivered_local"), "Résultat du contrôleur incertain")
            calls = record.get("agent_calls", 0)
        require(type(calls) is int and 0 <= calls <= reserve, "Dépassement de budget observé")
        run.update(agent_calls=calls, run_id=record.get("run_id"))
        self.data["tickets"][identifier] = record
        self.data.pop("active", None)
        self.save()
        if record["status"] == "delivered_local":
            autopilot.integrate(self.root, identifier)
            self.data["expected_head"] = record["delivered_commit"]
            self.data["tickets"][identifier] = agentic.Controller(self.root).state["tickets"][identifier].copy()
            self.save()

    def remote_identity(self):
        fetch = agentic.git(self.root, "remote", "get-url", "--all", "origin").stdout.splitlines()
        push = agentic.git(self.root, "remote", "get-url", "--push", "--all", "origin").stdout.splitlines()
        require(len(fetch) == len(push) == 1, "Une seule destination origin requise")
        return fingerprint({"fetch": fetch, "push": push})

    def publish(self):
        if self.publish_mode == "local":
            return True
        target = self.data["expected_head"]
        already_published = self.data.get("published_commit") == target and not self.data.get("pending_push")
        self.data["pending_push"] = target
        self.save()  # Network outcome may be uncertain; never rerun product work.
        try:
            require(self.remote_identity() == self.data["remote_sha256"], "Destination Git modifiée depuis le début")
            require(self.checkout() == target, "HEAD modifié avant publication")
            if already_published:
                self.data["pending_push"] = None
                self.save()
                return True
            branch = self.controller.policy.get("base_branch", "main")
            reference = "refs/heads/" + branch
            # An explicit object ID and no force flag: only the tested commit can move this branch.
            agentic.git(self.root, "push", "--porcelain", "origin", target + ":" + reference)
            destination = agentic.git(self.root, "remote", "get-url", "--push", "origin").stdout.strip()
            remote = agentic.git(self.root, "ls-remote", "--exit-code", destination, reference).stdout.splitlines()
            require(remote == [target + "\t" + reference], "Commit distant non confirmé")
            require(self.head() == target, "HEAD modifié pendant publication")
        except (agentic.Blocked, OSError, subprocess.SubprocessError):
            self.result("publish_blocked", "Publication distante non confirmée ; vérifier accès, réseau ou divergence puis --resume")
            return False
        self.data.update(published_commit=target, pending_push=None)
        self.save()
        return True

    def execute(self, retry=None):
        with campaign_lock(self.root):
            try:
                if self.data is None:
                    self.initialize()
                self.synchronize()
                if retry:
                    require(retry in self.controller.tickets and self.data["tickets"].get(retry, {}).get("status") == "blocked", "--retry-ticket exige un ticket bloqué identifié")
                    require(sum(run["ticket"] == retry for run in self.data["runs"]) < self.limits["max_runs_per_ticket"], "Budget persistant du ticket épuisé")
                    self.data["retry"] = retry
                    self.save()
                self.data["status"] = "running"
                self.save()
                while True:
                    self.synchronize()
                    if not self.publish():
                        return self.result()
                    if self.stopping or self.stop_path.exists():
                        self.stop_path.unlink(missing_ok=True)
                        return self.result("stopped", "Arrêt demandé ; reprendre avec --resume")
                    if all(self.controller.dependency_integrated(key) for key in self.controller.tickets):
                        verified = restore_progress.restore(self.root, check=True)
                        require(set(verified["checked"]) == set(self.controller.tickets), "Achèvement sans attestations vérifiées pour tous les tickets")
                        return self.result("complete", "Tous les tickets du plan sont intégrés et leurs preuves vérifiées")
                    remaining = self.limits["max_wall_seconds"] - (time.time() - self.data["started_at"])
                    available = self.limits["max_agent_calls"] - self.used_calls()
                    if len(self.data["runs"]) >= self.limits["max_ticket_runs"] or available < 1 or remaining < 1:
                        return self.result("budget_exhausted", "Budget global persistant épuisé")
                    candidates = [ticket["id"] for ticket in self.controller.ready()
                                  if (self.data["tickets"].get(ticket["id"], {}).get("status") != "blocked" or self.data.get("retry") == ticket["id"])
                                  and sum(run["ticket"] == ticket["id"] for run in self.data["runs"]) < self.limits["max_runs_per_ticket"]]
                    if not candidates:
                        return self.result("blocked", "Aucun ticket exécutable ; les dépendances ou blocages restent non résolus")
                    identifier = self.data.get("retry") if self.data.get("retry") in candidates else candidates[0]
                    self.run_ticket(identifier, available, max(1, int(remaining)))
            except KeyboardInterrupt:
                if self.data is None:
                    return {"status": "stopped", "reason": "Interruption avant création de campagne"}
                return self.result("stopped", "Interruption ; checkpoint conservé pour reprise vérifiée")
            except (agentic.Blocked, OSError, subprocess.SubprocessError) as exc:
                if self.data is None:
                    raise
                return self.result("blocked", str(exc) if isinstance(exc, agentic.Blocked) else "Erreur locale ; checkpoint et budget conservés")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--status", action="store_true", help="Lire le checkpoint sans appel au modèle ni modification")
    group.add_argument("--stop", action="store_true", help="Demander un arrêt entre deux tickets")
    group.add_argument("--resume", action="store_true", help="Reprendre le plan ; les blocages ne sont pas relancés")
    parser.add_argument("--retry-ticket", help="Relancer un blocage résolu sans réinitialiser les budgets")
    args = parser.parse_args(argv)
    try:
        require(not args.retry_ticket or not (args.status or args.stop), "Options incompatibles")
        campaign = Campaign()
        if args.status:
            result = campaign.status()
        elif args.stop:
            require(not campaign.stop_path.is_symlink(), "Fichier d’arrêt lié interdit")
            campaign.stop_path.touch()
            result = {"status": "stop_requested", "reason": "Arrêt à la fin du ticket en cours"}
        else:
            old = signal.signal(signal.SIGTERM, lambda *_: setattr(campaign, "stopping", True))
            try:
                result = campaign.execute(args.retry_ticket)
            finally:
                signal.signal(signal.SIGTERM, old)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0 if result["status"] in ("complete", "not_started", "stop_requested") or args.status else 1
    except (agentic.Blocked, OSError, ValueError, TypeError, KeyError, subprocess.SubprocessError) as exc:
        print(json.dumps({"status": "blocked", "reason": str(exc) if isinstance(exc, agentic.Blocked) else "Erreur locale ou checkpoint invalide"}, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
