# EA-03 — Résultats et preuves

Date : 2026-09-09. Formalisation sur `602a56a` (EA-01 livré) ; base de livraison
`6ba1d27ea182ca1b1fb676743358fdeca88feb26` après publication vérifiée d'EA-02.
Seuls l'ADR-0005 et les documents de preuve EA-03 font partie de ce ticket.

- Contrôle Python en lecture seule : six paragraphes AC et IDs identiques au
  backlog, huit liens locaux de l'ADR résolus. Code 0, log `.agentic/ea03-doc-check.log`.
- Commande kit : `wsl -d Ubuntu -- env PYTHONPATH=/mnt/c/tmp/encave-assistant/encave-assistant/.agentic/runs/wsl-python python3 /mnt/c/tmp/encave-assistant/encave-assistant/scripts/check_kit.py`.
- Première exécution : code 1, 141 tests, une erreur dans
  `test_stop_between_tickets_preserves_progress_for_resume`, message
  « Horodatage de campagne invalide ». Log `.agentic/ea03-kit.log` conservé.
  La vérification compare un horodatage de checkpoint à l'heure courante ; cause
  racine non établie. Une observation séparée de 2 secondes sous WSL a trouvé zéro
  recul sur 8 756 386 lectures d'horloge ; elle ne démontre pas l'absence de recul
  pendant le test en échec.
- Relance unique de la même commande, sans modification de code, test, politique
  ou horloge : code 0, 141 tests réussis. Log `.agentic/ea03-kit-retry1.log`.
  Aucun test de produit n'est déduit de ce succès ; aucune campagne réelle lancée.

| Critère | Décision / preuve documentaire |
|---|---|
| AC-01 | Frontières dépôt, packages, données, identité, secrets, exécution et déploiements indépendantes |
| AC-02 | Autorité et priorités de Sam, délégation réversible, livraison directe vérifiée, supervision A1 distincte |
| AC-03 | Trois modes explicites de disponibilité, contraintes transactionnelles, concurrence Outlook limitée et contrats neutres |
| AC-04 | Profil interne inclus dans la cible après recette ; devis exclus de la première offre mais conservés au backlog ; fournisseurs inactifs sans qualification |
| AC-05 | Fondations et tests synthétiques indépendants de Microsoft et de tout prospect |
| AC-06 | ADR datée : services/région/identité cibles, registre des inconnus et conditions d'accès ou dépense, aucun accord inventé |

Sources officielles Azure et Keycloak consultées le 2026-09-09, citées dans l'ADR.
La région cible et les versions ne prouvent pas une ressource déployée. Aucune
souscription, instance OIDC, compte Microsoft, donnée réelle ou mesure commerciale
créée ou qualifiée dans ce ticket. Aucun devis ou profil métier déjà disponible.

Budget avant review : une relance après erreur, zéro modification corrective,
première review à réaliser. Manifest des trois livrables et trois logs ; métadonnées
`status.md` et `review.json` complétées après review.
