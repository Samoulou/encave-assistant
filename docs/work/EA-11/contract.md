# EA-11 — Contrat avant réalisation

Ouverture : 2026-09-09 12:30:09 UTC, exécution 1, échéance 14:30:09 UTC.
Maximum trois corrections, huit appels reviewer, 1 200 secondes/appel et
7 200 secondes/exécution. Base : `c6ab7ea845fbeb5ecf3b908c2efc4e7382a18377`.
Dépendance EA-08 livrée/testée/review pass (`c23cb08719d68cf1753365e534c865f73479bbb1`).
Lectures : AGENTS/START/protocole08, brief, backlog EA-11, produit02 §7/8/11,
architecture04 modèle/routes, UX11 §3/4.1/4.2/5/6/7, tokens et maquettes docs/design,
stratégie04 et DoR/DoD05. Choix réversibles délégués par Sam.

## AC-01

Rechargement conserve le dossier.

Acceptation : opérateur/admin crée une demande après appel ou accueil en personne.
Transaction PostgreSQL : dossier, compte rendu interne et provenance, commande
idempotente ; aucun e-mail ni réservation créé. Rechargement, nouvelle session
et redémarrage API relisent les données réelles. Même clé rejouée ne double pas
la demande ; clé réutilisée pour d'autres termes donne conflit. Refus/panne de
journal annule toutes les écritures. Lecteur et cave étrangère sont refusés.

File avec recherche et filtres métier, tri déterministe priorité d'intervention,
date souhaitée connue puis ancienneté/id ; autre tri explicite disponible.
Compteurs réels, pagination bornée et filtre/position conservés au retour du
dossier. Les états de réservation/reprise sont dérivés des enregistrements
existants, sans les confondre avec la simple réception d'une demande. Le dossier
expose résumé, informations, compte rendu/source, échanges et historique ; aucune
analyse IA ni proposition commerciale fictive. Les données inconnues sont nommées.

Tests SQL/HTTP et E2E réels : reload/restart, idempotence concurrente, atomicité,
isolation multiclients et réponses tardives. File de 20 demandes synthétiques,
ordre/filtre/recherche/pagination/retour vérifiés ; vide initial/recherche vide/
chargement/erreur distingués.

## AC-02

Origine et acteur de la saisie conservés.

Acceptation : canal manual résolu serveur, origine téléphone/en personne/autre
déclarée explicitement. Nom, moyen de réponse (e-mail ou téléphone), besoin et
compte rendu sont conservés ; date/participants/budget restent facultatifs.
Budget CHF avec base groupe/personne explicite, jamais transformée. Date souhaitée
est une date déclarée, sans disponibilité ni interprétation en réservation.
L'identité vérifiée fournit l'acteur et son nom observé, avec horodatage serveur.
La provenance initiale reste immuable et liée au message/dossier/cave exacts.
Les anciennes fixtures sans provenance nouvelle sont affichées comme telle.

Tests : l'appelant ne peut injecter cave, acteur, état ou référence serveur ;
FK composites SQL, provenance immuable, acteur réellement connecté et contenu
HTML hostile affiché comme texte. Deux caves portant les mêmes noms restent isolées.

## AC-03

Validation des champs avec erreurs visibles.

Acceptation : schéma fermé serveur et erreurs de champs françaises associées
aux champs + résumé lié après soumission. Nom/besoin/origine/moyen de réponse
obligatoires ; formats e-mail/téléphone/date, tailles et nombres bornés. Valeurs
incomplètes/incohérentes refusées sans succès ni écriture. Une panne conserve les
champs et permet une reprise avec la même commande lorsque son issue est inconnue.
« Enregistré » seulement après confirmation serveur ; état attente accessible.
Un changement local de cave ou abandon de formulaire propose de rester ou
d'abandonner explicitement ; retour focus/clavier/Échap. Aucune donnée de brouillon
de la cave précédente affichée dans la suivante. Session/cave périmée expliquée.

Tests unitaires des limites, HTTP erreurs observables, E2E refus réel et panne
contrôlée avec conservation des valeurs, double soumission, contexte changé et
réponse ancienne écartée. Le lecteur ne voit aucune action de création opérante.

## AC-04

Respecter les critères UX applicables de docs/product/11-ux-ui-et-design.md et les tokens de docs/design/design-tokens.json sur les parcours modifiés ; exécuter test:ux, conserver les captures navigateur et faire vérifier les états, le responsive, le clavier et les actions sensibles par la review indépendante.

Acceptation : UX-01/02/03/13/15/16/17 et règles clavier/dialogue de §6 applicables.
Shell pierre/blanc/bordeaux, typo système16, contrôles44px, focus3px, tokens existants.
Liste sur ordinateur et cartes/dossier dédié sur téléphone ; cave/compte visibles.
Navigation vers Demandes et Paramètres existants ; fonctions futures non simulées.
Le lien d'accueil ouvre la file ; le retour OIDC historique vers les paramètres
reste compatible avec les parcours d'équipe déjà livrés, avec accès direct aux
demandes. Cette limite de navigation est explicite jusqu'à harmonisation ultérieure.

test:ux sur application réelle et DB synthétique : captures normal/vide/recherche
vide/chargement/erreur/périmé/formulaire invalide/succès/dialogue, largeurs320/390/
768/1440, zoom navigateur200% et reflow400%, contraste effectif/contours/cibles,
Tab/Entrée/Échap/focus. Captures avec viewport/état serveur/empreinte examinées
par reviewer indépendant ; elles ne remplacent pas les assertions métier.

## Choix et gates

Migration additive007 avec provenance et journal immuables ; migrations publiées
et API historique v3 inchangées. Extension serveur par routes de création/liste/
dossier sans rendre modifiables les offres ni initier d'effet externe. API limitée
à50 lignes/page, recherche120 caractères, champs bornés, historique200 messages.
Aucun ancien test modifié. Gates kit, unit, functional, business, E2E, UX,
compilation/foundation/outillage/runtime. IA non applicable. Review, corrections
bornées, preuves et livraison Git normale avant prochain ticket admissible.
