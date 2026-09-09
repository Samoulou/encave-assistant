# EA-02 — Résultats et preuves

Date : 2026-09-09. Base : `602a56ac3dda67806dbd75f5fbb3b3f0dcb45d15`.
Ticket documentaire : aucune implémentation OAuth/Graph ni qualification réelle.

- Gate kit : `wsl -d Ubuntu -- env PYTHONPATH=/mnt/c/tmp/encave-assistant/encave-assistant/.agentic/runs/wsl-python python3 /mnt/c/tmp/encave-assistant/encave-assistant/scripts/check_kit.py` : code 0, 141 tests réussis en 56,479 s. Log local `.agentic/ea02-kit.log`. Aucune campagne exécutée.
- Contrôle Python en lecture seule : extraction des cinq paragraphes AC avec leurs
  IDs et comparaison exacte à `backlog/tickets.json` ; résolution des sept liens
  locaux des documents ; lecture JSON, douze CON ordonnés `not_executed`, huit
  capacités `unverified`, trois profils inactifs, zéro preuve réelle et zéro
  organisation configurée. Code 0, log `.agentic/ea02-doc-check.log`.
- Recherche documentaire : pages Microsoft Learn citées près de chaque affirmation,
  consultées le 2026-09-09. Matrice des opérations et limites fournisseur, onboarding,
  droits effectifs, erreurs et protocole de recette. Une lecture de documentation
  n'est pas une preuve d'intégration sur un tenant.

| Critère | Preuve |
|---|---|
| AC-01 | Matrice des profils, choix de l'offre initiale, limites et sources officielles ; Outlook seul insuffisant |
| AC-02 | Contrat des opérations et MS-01 à MS-10, nominal/refus/pannes ; Shared délégué explicitement exclu des webhooks partagés |
| AC-03 | Parcours réutilisable, tentative serveur anti-rejeu, PKCE, séparation cave/organisation/session, permissions et administration distinctes |
| AC-04 | Deux niveaux de preuve et recette CON-01 à CON-12 sur deux organisations autorisées ; registre entièrement non exécuté |
| AC-05 | Activation interdite si preuve/droit inconnu ; développement et profil interne indépendants d'un accès de prospect |

Les cas prescrits ne sont pas des tests exécutables déjà livrés. Le kit vérifie
son propre périmètre ; aucun résultat produit, IA, UX ou fournisseur n'est déduit
de ses 141 succès. Aucun envoi, abonnement, jeton ou calendrier réel créé.
Budget avant review : zéro correction ; première review à réaliser.
`checksums.json` identifie les livrables et logs ; `status.md` et `review.json`
sont les métadonnées de livraison mises à jour après review.
