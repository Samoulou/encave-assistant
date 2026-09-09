# Catalogue approuvé — EA-09

Chaque cave maintient ses fiches par des commandes authentifiées. Un administrateur
crée la fiche et son premier brouillon, ajoute des versions, approuve/publie une
version exacte et active ou désactive la fiche. Opérateurs et lecteurs consultent ;
les opérateurs peuvent aussi vérifier une sélection pour une proposition future.
L'interface de maintenance sera ajoutée avec ses parcours UX ; cette tranche
expose des API testées dans le navigateur avec les vraies sessions.

## Données explicites

`catalogDefinitionSchema` est fermé et versionné. Le JSON exige tous les champs :
une donnée inconnue utilise null ou le mode `unknown`, sans valeur implicite.

| Champ | Contrat |
|---|---|
| schemaVersion, title | Schéma 1 ; titre de 1 à 160 caractères |
| category | activity_fixed, room_quote ou event_info |
| minimumParticipants, maximumParticipants | Entiers de 1 à 100 000 ou null ; minimum ≤ maximum |
| durationMode, durationMinutes | fixed/variable/unknown ; minutes 1–43 200 ou null ; aucune minute fixe pour une durée variable/inconnue |
| amountMinor, currency, priceUnit | Centimes entiers 0–1 000 000 000 ou null ; CHF explicite ; per_person/per_group |
| taxMode, taxRateBasisPoints, taxLabel | included/excluded/not_applicable/unknown ; taux en points de base (0,01 %) 0–10 000 ou null ; libellé explicite ou null |
| conditions | Texte de 1 à 2 000 caractères ou null |
| source | null ou label, reference, verifiedAt et validUntil ; horodatages UTC canoniques, validité après vérification |
| officialUrl | Lien HTTPS sans identifiants de connexion, ou null |

Ces bornes sont des limites techniques initiales, pas les capacités ni les tarifs
d'une cave. Elles pourront évoluer par un changement explicite. Aucun taux fiscal
réel n'est déduit : le responsable renseigne sa règle. Les fixtures utilisent
volontairement une taxe fictive de recette. Prix null signifie inconnu ; prix zéro
signifie gratuité explicitement configurée. Les calculs commerciaux, arrondis,
ressources et disponibilités seront traités par EA-18/19.

Une location sur devis ne prend pas la durée fixe d'une dégustation. Un événement
d'information peut conserver son lien officiel ; sa fiche ne permet aucune vente
de place ou réservation automatique. Une fiche incomplète peut être approuvée
pour un usage documentaire manuel tout en restant exclue de l'automatisation.

Le responsable confirme la source et les dates lors de l'approbation. Ce sont
des informations déclarées et approuvées dans sa cave, pas la preuve qu'un connecteur
a interrogé un fournisseur. Aucun téléchargement, accès distant ou interprétation
d'instruction n'est déclenché par le contenu de ces champs.

## Parcours API

Préfixe `/api/catalog/offers`. Session vérifiée et `X-EnCave-Cave` obligatoires.
Les POST exigent origine applicative et CSRF. Les mutations admin exigent aussi
une clé UUID `Idempotency-Key` ; même acteur/cave/clé/charge retourne le résultat
historique, une autre charge donne 409. Les droits actuels sont vérifiés avant
chaque rejeu. Lire la fiche pour son état actuel, distinct du résultat historique.

| Route | Corps / résultat |
|---|---|
| POST / | `{definition}` ; fiche désactivée, première révision non publiée, version de fiche 1 |
| POST /{id}/versions | `{expectedVersion,definition}` ; nouvelle révision immutable, compteur de fiche augmenté |
| POST /{id}/publish | `{expectedVersion,versionId}` ; approbation de la dernière révision et référence publiée ; conserve activation/désactivation |
| POST /{id}/enable | `{expectedVersion,enabled}` ; activation/désactivation explicite ; état déjà identique donne 409 |
| GET / | Liste des fiches avec version publiée, définition, admissibilité et raisons de blocage |
| GET /?eligible=true | Seulement les activités publiées, actives et complètes avec source actuelle |
| GET /{id}?before=N | Révisions décroissantes, 50 par page ; nextBeforeNumber pour continuer |
| POST /{id}/select | `{versionId}` ; vérifie la référence publiée actuelle et rend les données serveur ou 409 avec raisons |

Le premier POST vise le préfixe exact, sans barre finale. Les exemples de corps
ci-dessus décrivent les formes et ne sont pas des commandes exécutables isolées.
Le contrat complet de definition est dans le schéma ; toute propriété d'autorité
supplémentaire, prix substitué ou nombre invalide est rejeté.

Le catalogue est limité à 500 fiches par cave et 10 000 révisions par fiche.
La liste est bornée aux 500 fiches et contient les définitions publiées ; aucun
historique complet n'y est embarqué. La consultation des révisions est paginée.
Une cave au-delà de la borne ne reçoit pas une liste silencieusement tronquée.

Une sélection n'est ni une proposition persistée, ni une réservation, ni une
preuve de disponibilité. Elle ne modifie aucune table commerciale. EA-18/19
devront revérifier la sélection dans leur transaction avant de créer une nouvelle
proposition ; la réponse n'est pas un jeton d'autorisation réutilisable.

## Invariants et refus

Le serveur recharge la fiche publiée et sa source dans le contexte de cave
verrouillé. Les causes sont explicites : offre désactivée/non publiée, prix absent,
capacité/durée/taxes/conditions inconnues, source absente ou hors validité, et offre
nécessitant un traitement manuel. Une ancienne version reçoit
`409/offer_version_changed` ; elle n'est pas remplacée implicitement par une autre.
Une version optimiste dépassée reçoit `409/version_conflict`. Les références
étrangères donnent 404, les rôles interdits 403, une cave changée 409.

La désactivation agit sur les nouvelles sélections et conserve les versions,
approbations et propositions précédentes. Publier une nouvelle version n'active
jamais une fiche désactivée. Chaque version est append-only, y compris le brouillon :
une correction crée une nouvelle révision. L'approbation référence la version
exacte et son acteur ; un champ JSON libre ne peut l'approuver.

Les FK lient cave, fiche et version ; la référence publiée pointe obligatoirement
vers une approbation de cette même fiche. Le login applicatif ne peut modifier
ou supprimer les versions, approbations et commandes. Les triggers protègent aussi
l'historique contre une mise à jour directe du propriétaire SQL. Les mutations,
approbations, compteurs et résultats idempotents sont transactionnels ; une erreur
de journal annule toute la mutation. Le serveur reste responsable des droits et
transitions, les FK ne remplacent pas son autorisation.

## Migration et preuve

Migration additive 005, via `migrateDatabase(ownerPool,{targetVersion:5})` dans
l'étape de migration autorisée. L'appel historique sans option conserve v3.
Le générateur de bases possédées cible la version actuelle sans charger de catalogue.
Les données de tests sont créées uniquement par les tests ; aucun tarif de prospect
ou fichier de démonstration n'est importé dans un runtime utilisateur.

Le contrat et les preuves sont dans [EA-09](../work/EA-09/contract.md). L'absence
d'interface nouvelle rend UX non applicable dans ce ticket ; les E2E vérifient
HTTP/DB et redémarrage de l'API dans le navigateur. Aucun fournisseur, IA ou
déploiement n'est qualifié par cette tranche de catalogue.
