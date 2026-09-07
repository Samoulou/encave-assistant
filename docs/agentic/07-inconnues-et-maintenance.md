# Inconnues et maintenance du cadre

## Informations à réunir au départ

Configuration réelle Microsoft (Exchange Online, boîte personnelle/partagée, calendrier principal/secondaire, interlocuteur administrateur), compte de test autorisé, catalogue approuvé, ressources et source de vérité, règles de prix et d’accord, demandes anonymisées et mesure initiale. Ne pas transformer les prix du POC ou les exemples du kit en données de Gilliard.

Conserver les documents autorisés hors dépôt s’ils contiennent des informations personnelles ; déposer dans docs/decisions une synthèse minimisée et des références vérifiables. Les preuves d’accès n’incluent aucun token. Sam décide des hypothèses et du périmètre. Les retours prospect sont facultatifs. Les agents peuvent poursuivre un ticket indépendant ; seul un changement d’exigence autorisé et tracé peut modifier une dépendance. Un refus de droit fournisseur bloque l’action concernée, jamais un contournement du consentement.

## Maintenance de l’outillage

AGENTS.md, les politiques, scripts, prompts, schémas, workflows, sources métier, scénarios de référence et anciens tests sont protégés pendant un ticket ordinaire. Le contrôleur compare leurs empreintes. Cette protection empêche une régression silencieuse du cadre ; elle ne constitue pas un sandbox contre un agent hostile avec accès au système.

Pour une évolution légitime du cadre, ouvrir un chantier de maintenance distinct, arrêter l’autopilot, justifier le changement, faire relire séparément les exigences concernées, exécuter les tests du kit et committer une nouvelle base avant reprise. Ne jamais permettre à un ticket en échec de s’autoriser lui-même cette exception.

Pour des tests existants qui doivent évoluer avec une règle approuvée, formaliser cette évolution avant le ticket produit, préserver les scénarios invariants et faire une review dédiée. Le mode strict de ce premier kit privilégie une référence stable. Cette maintenance peut être automatisée dans un second pipeline contrôlé ; elle n’est pas implémentée ici.

## Reprise après interruption

Consulter python3 scripts/agentic.py status et la worktree indiquée. Le travail reste disponible. Une présence de .agentic/run.lock peut signaler un contrôleur encore actif : vérifier le processus avant de retirer un verrou orphelin. Ne pas effacer état et preuves pour relancer une réservation ou un ticket au résultat inconnu. Pour un nouveau clone propre sur main, exécuter python3 scripts/restore_progress.py. La commande refuse une preuve endommagée, un historique incomplet ou une livraison réécrite ; ne pas marquer tous les tickets terminés.
