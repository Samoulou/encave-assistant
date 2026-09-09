# EA-01 — Contrat avant réalisation

Date : 2026-09-09. Base Git : `2ea17e66426afe569b3d80a8fbd097f4af4526a6`.
Dépendances : aucune. INIT-01 livré ; DEV-01 commencé et en review indépendante.
Ticket documentaire autonome, aucun changement aux fichiers DEV-01 examinés.
Références : brief, produit 02 et 06, ADR-0002/0004, stratégie tests et DoR/DoD.

## AC-01

Formaliser le périmètre, les priorités et les critères d’acceptation sous l’autorité de Sam ; les agents appliquent ses décisions documentées sans demander de validation à Julien ou à un autre prospect.

Acceptation positive/négative : Vérifier que le document relie tranches et backlog, distingue décision de Sam et supervision commerciale par la cave. Refus : aucune approbation de prospect ne conditionne une tranche.

## AC-02

Consigner les règles de prix, ressources, accord et reprise, en préservant la supervision A1 et les invariants de sécurité du brief.

Acceptation positive/négative : Contrôler la présence de règles prix déterministes, inconnus bloquants, ressources, version exacte, deux validations A1, reprise et séparation des effets externes. Refus : aucune réservation sur ancienne version ni succès fournisseur présumé.

## AC-03

Distinguer faits observés, hypothèses de volumes/canaux et données synthétiques ; préparer une baseline de mesure sans inventer de données terrain.

Acceptation positive/négative : Inventorier séparément observations locales, hypothèses configurables et fixtures ; template de baseline sans mesures, formules et critères de collecte. Refus : aucun taux, volume client ou gain annoncé comme mesuré.

## AC-04

Les entretiens, échantillons clients et retours de Julien sont facultatifs pour commencer le développement ; leur absence ne bloque pas ce ticket et aucun engagement commercial n’est présumé.

Acceptation positive/négative : Lire les dépendances du ticket et les responsabilités ; aucun entretien, compte ou engagement de Julien requis. Les droits fournisseur nécessaires ne sont pas déduits de cette autonomie.

## Livrables et gates

Livrable : docs/discovery/EA-01-perimetre-et-mesure.md et template CSV vide de
baseline. Données métier inconnues signalées ; exemples explicitement synthétiques.
Gate kit prescrite inchangée, exécutée sous WSL ; contrôle documentaire des critères
et liens puis review indépendante en lecture seule. Aucun test produit revendiqué.
Budget : trois corrections maximum, huit appels d'agents, 7 200 secondes.
Livraison : commit propre au ticket après review ; publication autorisée par ADR-0004.
