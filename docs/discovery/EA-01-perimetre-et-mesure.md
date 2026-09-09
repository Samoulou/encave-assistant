# EA-01 — Périmètre, hypothèses et méthode de mesure

Date : 2026-09-09. Décisions de référence : brief approuvé et ADR-0002/0004.
Cette formalisation applique l'autorité de Sam et sa délégation des choix
réversibles. Aucun entretien ni accord de prospect n'est un prérequis.

## Résultat produit et ordre de réalisation

L'opérateur d'une cave reçoit une demande, retrouve ses sources, corrige les
informations, valide une proposition précise et suit l'accord puis la réservation.
Le visiteur n'a pas besoin de compte. Sam pilote la construction et le lancement ;
le caviste autorisé décide des engagements commerciaux de sa propre cave en A1.
Le dépôt, l'identité, les données, secrets, déploiements et code d'exécution sont
indépendants de la marketplace EnCave.

| Priorité de réalisation | Tranche et comportement observable | Acceptation à démontrer |
|---|---|---|
| 1 | Fondation, identité, deux caves, rôles, catalogue et saisie manuelle | Une demande persiste après rechargement ; lecture/écriture inter-caves refusées côté serveur et DB |
| 2 | Entrées, faits sourcés, offres admissibles et proposition corrigeable | Doublons dédupliqués, inconnus signalés ; prix/capacités déterministes ; seules les offres approuvées sont utilisées |
| 3 | Proposition envoyée, accord exact, autorisation A1, allocations et actions durables | Ancienne version refusée, une seule allocation concurrente, effet incertain à réconcilier, aucun succès d'envoi inventé |
| 4 | Reprises, sécurité, onboarding, restauration, mesures et exploitation | Pannes/revocation/restauration démontrées, périmètre activé vérifié, décision de lancement de Sam tracée |

Les dépendances exactes restent celles du [backlog](../../backlog/tickets.json).
Cette présentation ne les remplace pas. Le contrat Microsoft avance sur fixtures
et références officielles ; les preuves sur comptes autorisés conditionnent
l'activation de ce fournisseur seulement. Aucune maquette ne remplace une tranche
serveur testée. L'accueil produit suivra la file de demandes et les tokens du
[document UX/UI](../product/11-ux-ui-et-design.md).

Le périmètre cible comprend les visites/dégustations à prix défini, la qualification
des locations avec reprise humaine, le catalogue d'événements avec lien officiel
et les recommandations parmi les offres approuvées. Les tickets devis et profil
sans Microsoft restent dans la mission de développement ; EA-03 explicitera leur
inclusion dans le lancement vendu selon leurs preuves. Aucune fonction manquante
ne sera annoncée disponible. Paiement intégré, autonomie A2/A3, réseaux sociaux
et billetterie transactionnelle sont hors lancement initial du brief.

## Règles non négociables et paramètres

| Sujet | Règle serveur | Inconnu, refus ou reprise |
|---|---|---|
| Prix | Unités monétaires entières/décimal précis ; total issu des tarifs, quantités, remises autorisées et taxes explicites | Tarif ou taxes absents : aucun engagement. Le modèle ne fixe pas le prix. Les tarifs réels restent à configurer par cave |
| Ressources | Capacités et horaires approuvés, intervalles UTC [début, fin), fuseau métier conservé, préparation/rangement inclus | Ressource ou disponibilité inconnue : bloque la réservation. Durées, marges et allocations configurables, jamais déduites d'une maquette |
| Concurrence | Toutes les ressources internes allouées dans une transaction avec exclusion des conflits | PostgreSQL ne verrouille pas une saisie Outlook indépendante ; politique de disponibilité testée et reprise si conflit externe |
| Proposition | Instantané versionné ; offre approuvée/envoi immuables ; rendu commercial issu de cet instantané | Changement de groupe, date, montant ou conditions : nouvelle version à valider et accepter |
| Accord | Preuve, acteur observé, date et version exacte ; lien limité/expirant ou email non ambigu rattaché | « Oui, mais vingt personnes » n'accepte pas quinze. Ancienne version, ambiguïté, tiers ou offre expirée : clarification/reprise |
| A1 | Caviste habilité valide avant envoi ; après l'accord exact, nouvelle autorisation « Réserver et confirmer » | L'autonomie du développement ne remplace aucune de ces actions commerciales |
| Effets externes | Actions durables, références stables, idempotence/reconciliation et états séparés | 202 ou timeout ne prouvent pas réception/livraison. Pas de renvoi aveugle ni de faux succès après restauration |
| Accès | Cave issue de session vérifiée, rôles contrôlés pour API/jobs/exports/connexions | Paramètre client tenant_id ou instruction dans un message ne change ni identité ni autorisation |
| Location | Qualification et transfert au responsable dans le minimum ; devis exact requis pour un lot réservable | Durée variable, conditions et acompte éventuellement requis ; aucune confirmation si conditions non vérifiées |
| Événement externe | Informations approuvées, source datée et lien officiel | Aucun stock, place, achat, inscription ou URL inventés |

Valeurs par défaut du brief : français, CHF, Europe/Zurich. Elles restent des
champs configurables. Durées, prix, capacités, délais de validité, nombre de
relances et délais d'archivage ne sont pas établis pour une cave réelle. Leur
configuration et les refus correspondants appartiennent aux tickets concernés.

## Ce qui est observé et ce qui reste hypothétique

| Catégorie | Élément | Statut et usage |
|---|---|---|
| Fait documentaire | Brief, backlog, A1, autorité de Sam, indépendance | Référence du développement, pas preuve d'adoption client |
| Observation locale | INIT-01, commit 2ea17e6 et kit vérifié | Outillage local uniquement ; aucun compte client observé |
| Hypothèse de profil | Petite cave seule et domaine avec plusieurs collaborateurs | Configurations de test à couvrir ; fréquence réelle inconnue |
| Hypothèse de canal | Email M365, formulaire web, saisie après téléphone | Priorités du brief ; répartition/volumes réels inconnus |
| Hypothèse de volume | Charge opérationnelle et saisonnalité | Aucune valeur terrain retenue ; tests de charge synthétiques distincts |
| Cible de valeur | ≥80 % des propositions éligibles sans correction commerciale importante ; gain médian ≥30 % | Objectifs à mesurer, aucun score acquis et aucun veto de prospect sur livraison |
| Option de mesure | Quatre semaines et 30 demandes | Plan facultatif, pas condition de lancement ou taille démontrée statistiquement |
| Donnée synthétique | Deux caves fictives, propositions versionnées, messages de refus/panne | Fixtures de tests identifiées, jamais converties en baseline réelle |
| Intégrations | Organisations Microsoft et fournisseur IA | Aucun compte/clé/profil qualifié présumé ; activation conditionnée aux preuves requises |

Julien n'est pas un client engagé. Ses accès, catalogue, volumes, règles et retours
sont inconnus et facultatifs. L'absence d'entretien ou d'échantillon ne bloque pas
EA-01. Un consentement technique demandé par un fournisseur demeure obligatoire
pour utiliser la connexion réellement concernée ; aucune autorité produit ne le
remplace.

## Baseline préparée, aucune mesure collectée

Le [template CSV](EA-01-baseline-template.csv) contient seulement des en-têtes.
Il n'est ni un jeu de données, ni une évaluation IA, ni une preuve de résultat.
Ne conserver dans un dépôt public aucune donnée client : observations autorisées
et données brutes restent dans l'environnement de mesure dédié ; n'en publier
qu'un résumé expurgé et la méthode sous responsabilité de Sam.

1. Définir avant collecte le périmètre éligible (visite/dégustation à tarif connu),
   période, cave participante autorisée, canal, classe de complexité et exclusions.
   Consigner version de l'application, des règles et du modèle s'il est réellement
   utilisé. Une méthode manuelle constitue la baseline ; comparer des cas appariés
   ou des groupes de même profil et expliciter les limites de comparabilité.
2. Chronométrer les sessions de travail humain actif, y compris corrections,
   validations A1 et reprises. Exclure les attentes client/fournisseur de ce temps
   actif et les conserver séparément. Ne pas déduire le temps actif du seul délai
   entre réception et réservation.
3. Une correction commerciale importante modifie au moins activité, groupe, date,
   horaire, ressource, prix, taxe ou condition. Une correction typographique seule
   n'en est pas une. Les échecs et propositions retirées restent comptabilisés dans
   leur classe, avec raison, au lieu d'être masqués dans les exclusions.
4. Taux sans correction = nombre de propositions éligibles sans correction
   commerciale importante / nombre de propositions éligibles examinées. Publier
   numérateur/dénominateur, couverture, échecs et définitions. Zéro cas donne
   « non mesuré », jamais 100 %.
5. Pour chaque paire comparable de temps manuels `B > 0` et assistés `A`,
   gain = `(B - A) / B`. Publier la médiane des gains individuels, le nombre de
   paires, la dispersion, exclusions et limites. Ne pas remplacer cette médiane
   par un ratio de moyennes ou intégrer une baseline nulle/manquante. Les gains
   négatifs restent visibles.
6. Mesurer séparément conflits détectés, résultats incertains, corrections,
   incidents, support actif et coûts réels quand factures/appels sont disponibles.
   Les 12 cas seed IA restent synthétiques et non évalués ; le corpus ≥100 cas et
   les gates IA appartiennent aux tickets d'évaluation.

Sam peut organiser une démonstration sur fixtures puis inviter des retours
facultatifs. Le lancement reste une décision sur les preuves techniques du
périmètre vendu, conformément aux [jalons](../product/06-roadmap-lancement-business.md).
Ni valeur mesurée inexistante, ni silence d'un prospect ne deviennent une preuve
de validation commerciale ou une raison d'affaiblir les contrôles.
