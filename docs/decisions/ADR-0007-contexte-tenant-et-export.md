# ADR-0007 — Contexte tenant et export local

2026-09-09. Retenue pour EA-06 sous délégation de Sam.

La première preuve d’isolation des tâches et exports utilise l’équipe existante,
sans créer de dossiers/propositions factices. `@encave/tenancy` est un package
serveur commun API/worker ; les décisions CSV pures restent dans le domaine.
Les contraintes SQL composites complètent le contexte résolu depuis la session.
RLS demeure optionnel selon produit04 et n’est pas revendiqué ici ; le rôle serveur
global et ses limites sont documentés et testés avec ses droits réels.

L’export est privé au demandeur administrateur et à sa cave. La version
d’appartenance est recontrôlée à l’exécution et au téléchargement. Un changement de
cave ou de droits annule l’affichage et les réponses tardives. L’export local se
produit entièrement dans une transaction SQL courte ; une interruption revient
à l’état pending. Aucune garantie d’effet fournisseur unique n’en découle.

Conservation par défaut d’une heure, configurable côté serveur de 60 secondes à
24 heures ; suppression du contenu expiré par le worker, refus immédiat de lecture
à expiration même worker arrêté. Métadonnées conservées jusqu’à la politique
d’exploitation EA-35. Limites de 5 000 membres et 1 Mio ; CSV protégé des formules.

La recette reprend Playwright/Chromium et les contrôles d’accessibilité ADR-0006.
Les anciens tests ne changent pas. Le runner ajoute seulement des coordonnées
source expurgées lors d’un échec pour diagnostiquer les gates sans afficher les
valeurs d’assertion, données ou jetons. Ce changement ne modifie aucun verdict.

[Guide](../development/tenant-exports.md), [contrat EA-06](../work/EA-06/contract.md).
