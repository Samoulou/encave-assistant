# EA-09 — Contrat avant réalisation

Ouverture : 2026-09-09 11:32:01 UTC, exécution 1, échéance 13:32:01 UTC.
Maximum trois corrections, huit appels reviewer, 1 200 secondes par appel,
7 200 secondes par exécution. Base : `c23cb08719d68cf1753365e534c865f73479bbb1`.
Dépendance EA-07 livrée et vérifiée ; EA-08 également livré après review pass.
Lectures : AGENTS/START/protocole08, brief, backlog EA-09, produit02 §10/12/13,
produit04 §20–22, contrats09, UX11 §catalogue et références design, tests04/DoD05.
Sam délègue les choix techniques réversibles ; aucune donnée ou autorisation de
prospect n'est présumée. Aucun tarif ou taux fiscal réel n'est inventé.

## AC-01

Capacité, durée, CHF et taxes explicites.

Acceptation : versions persistantes du catalogue propres à la cave, schéma fermé
et borné. Distinguer activité à prix défini, location à durée variable sur devis,
événement d'information. Conserver capacité minimale/maximale, mode et minutes
de durée, prix entier en centimes, unité par personne/groupe, devise CHF explicite,
règle de taxes et taux configuré. Les inconnues sont null/unknown, jamais zéro
ou une durée fictive par défaut ; zéro est un prix gratuit explicitement renseigné.
Les versions conservent titre, conditions et source avec date de vérification et
de validité. Aucune source absente ou périmée ne permet une sélection automatique.

Administrateur : créer une fiche/brouillon, ajouter une nouvelle version,
approuver/publier une version exacte, désactiver/réactiver avec version attendue.
Les lecteurs/opérateurs consultent ; ils ne publient pas le catalogue. Une
approbation est un acte authentifié du responsable de la cave, jamais un champ
JSON libre ou une déduction du modèle. Une révision publiée reste immuable.
Les données sans prix peuvent être conservées et approuvées comme documentation
manuelle ; elles ne deviennent pas admissibles à une proposition automatique.

Tests : validation pure des données/bornes, API et SQL réels, cave/rôle/CSRF/origine,
version attendue, rejeu et concurrence ; sources inconnues/périmées ; publication
et relecture de versions immuables avec champs et unités exacts.

## AC-02

Prix manquant bloque l’offre automatique.

Acceptation : un garde serveur recharge la version publiée actuelle, son statut
et sa source ; retourne une liste explicite de causes d'inadmissibilité. Prix null,
capacité/durée/taxes inconnues, absence d'approbation, source manquante/périmée ou
type sur devis/information bloquent la sélection d'activité réservable automatique.
Un montant CHF zéro explicitement fourni avec taxes cohérentes n'est pas absent.
Pas de calcul de disponibilité, de panier commercial, d'envoi ou de réservation
dans cette tranche ; EA-18/19 consommeront ce garde et revérifieront avant engagement.
Une route de sélection authentifiée prouve le refus en 409 et ne crée aucune
proposition. Les éventuelles valeurs de prix client sont refusées par le schéma.

Tests unitaires de toutes les causes, functional/business sur versions réellement
publiées avec prix null/zéro et valeurs en centimes exactes. E2E navigateur réel
via API, source/droits serveur, persistance après reload/redémarrage.

## AC-03

Offre désactivée exclue des nouvelles propositions.

Acceptation : désactivation immédiate par admin, version optimiste et idempotence,
filtre des candidats et garde de sélection relisant ce drapeau dans la transaction
de cave. Une ancienne référence sélectionnée avant désactivation est refusée au
nouvel appel ; une nouvelle publication ne réactive pas silencieusement la fiche.
Conserver toutes les anciennes versions, approbations et termes des propositions
existantes. Deux versions de prix publiées successivement ne réécrivent pas l'histoire.
La réactivation est une commande distincte et ne contourne aucun champ manquant.

Tests SQL/concurrents et HTTP de désactivation, filtrage, référence devenue obsolète,
refus inter-caves, invariance des versions et historique de proposition EA-07.
Deux contextes navigateur vérifient qu'une autre session voit le refus après
désactivation. Les versions et approbations référencent uniquement leur propre cave.

## Choix et gates

Migration additive 005 ; cible explicite actuelle, runner sans option v3 conservé.
Versions de fiche append-only et approbations séparées ; référence publiée sur la
fiche et journal de commandes atomique. Limites techniques documentées, modifiables
par évolution explicite, sans remplacer les exigences commerciales configurables.
Les commandes de maintenance sont des API serveur : aucune interface nouvelle
dans ce ticket non requires_ux. Les futures interfaces suivent UX11 ; les tests
navigateur utilisent les vraies sessions et le vrai serveur déjà disponibles.

Gates : kit, unit, functional, business, E2E ; compilation, foundation/outillage
si affectés et runtime. UX non applicable tant qu'aucun code d'interface ne change.
Fixtures fictives séparées ; PostgreSQL avec login applicatif réel ; aucune IA,
connexion Microsoft ou tarification fiscale réelle. Review indépendante, preuves,
livraison Git sans force et SHA distant, puis prochain ticket admissible.
