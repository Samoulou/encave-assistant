# EA-01 — Preuves documentaires

Date : 2026-09-09. Formalisation initiale sur `2ea17e6`, sans dépendance produit ;
base de livraison désormais `3b241b4118c79a5c8c9036fc03f3056d60890c4d` après DEV-01.
Les fichiers de DEV-01 n'ont pas été modifiés par EA-01.

- Gate prescrite : `wsl -d Ubuntu -- env PYTHONPATH=/mnt/c/tmp/encave-assistant/encave-assistant/.agentic/runs/wsl-python python3 /mnt/c/tmp/encave-assistant/encave-assistant/scripts/check_kit.py` : code 0, 141 tests réussis. Log local `.agentic/ea01-kit.log`.
- Vérification Python en lecture seule : extraction des quatre paragraphes AC du
  contrat et comparaison exacte au backlog ; quatre liens locaux du livrable
  résolus ; CSV lu avec csv.reader, 17 colonnes, zéro mesure. Code 0, résultat pass,
  log `.agentic/ea01-doc-check.log`. Aucun runner produit exécuté pour cette documentation.
- Diff : seulement contrat, document de périmètre/mesure, CSV vide et preuves EA-01.

| Critère | Preuve positive et refus conservé |
|---|---|
| AC-01 | Tranches reliées au backlog et responsabilités Sam/cave distinctes ; aucun prospect approbateur |
| AC-02 | Tableau prix, ressources, concurrence, proposition, accord, A1, effets, accès, location et événements ; inconnus et reprises bloquantes explicites |
| AC-03 | Observations/hypothèses/fixtures séparées ; mesures inexistantes, template vide ; dénominateur nul non mesuré et temps humain distinct de l'attente |
| AC-04 | Entretiens/échantillons/Julien facultatifs, aucune vente ou autorisation fournisseur présumée |

Aucune recherche terrain, métrique d'usage, appel de modèle, connexion fournisseur
ou validation client fabriquée. Budget : aucun échec/correction, une review à réaliser.
Le manifest checksums.json identifie les livrables à examiner ; status.md et
review.json sont les métadonnées de livraison mises à jour après review.

DEV-01 a été publié sans force avec SHA distant égal à sa base de livraison
ci-dessus. Ses CI étaient encore en cours lors de ce relevé ; release skipped.
Ce constat n'est ni un succès CI produit ni une mise en production.
