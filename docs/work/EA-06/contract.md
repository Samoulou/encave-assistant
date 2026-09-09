# EA-06 — Contrat avant réalisation

Ouverture : 2026-09-09 09:42:28 UTC (11:42:28 Europe/Zurich), exécution 1.
Échéance 11:42:28 UTC ; maximum trois tentatives de correction, huit appels
d’agents et 1 200 secondes par appel, 7 200 secondes pour cette exécution.
Base : `008edb83b3fbb863f93b201ab02c53cda9200b0f`, EA-05 livré, gates locales
et review indépendante pass, push normal et SHA distant vérifiés. Sa CI est suivie
séparément ; aucune attestation du contrôleur ni production n’est déduite.

Lectures : AGENTS, START-HERE, protocole direct08, brief, ticket EA-06, produit04
§21/23, produit05, contrats09, UX11, tokens/design, stratégie04 et DoR/DoD05.
La spécification isolation-cave.feature demeure non exécutée ; les nouveaux tests
implémentent les invariants dans le schéma disponible, sans prétendre que les
demandes/propositions/connexions commerciales futures existent déjà.

## AC-01

Deux caves de test indépendantes.

Acceptation : deux caves, membres propres et identité multi-caves. Les tests
ajoutent des valeurs identiques de présentation pour prouver que seul l’identifiant
interne autorisé détermine le contexte. Changer de cave vide les données précédentes.
Refuser l’identifiant d’un membre/export étranger sans révéler son contenu.

## AC-02

Accès API, tâches et exports inter-caves refusés.

Acceptation : centraliser le contexte serveur tenant des opérations nouvelles et
des routes équipe existantes. Ajouter un export CSV réel de l’équipe, réservé à
l’administrateur, généré par une tâche persistée puis exécutée par le worker.
L’API résout cave/acteur depuis la session, enregistre l’appartenance/version et
une référence stable ; l’identifiant de cave du client ne crée aucun droit.
Le worker recharge la tâche, son export et les droits actuels avant toute lecture ;
une enveloppe forgée, référence croisée ou appartenance révoquée échoue sans données
étrangères. Statut et téléchargement revérifient cave, rôle et révocation.
Preuves positives dans chaque cave, négatives par appels API directs, SQL et worker.

## AC-03

Rôle DB réel testé ; identifiants modèle/client non autoritatifs.

Acceptation : tests avec le login applicatif effectivement fourni au runtime web/API
et worker, distinct du propriétaire de migration, sans superprivilège ni CREATE.
Contraintes composites pour références tâche/export/cave/membre. Vérifier les refus
SQL croisés et les droits effectifs ; aucune requête de test sous propriétaire ne
sert de preuve d’autorisation applicative. Les mutations de fixtures pour simuler
une révocation/panne sont explicitement réalisées par le propriétaire de test.
Refuser/ignorer les champs client ou modèle tenant/acteur/rôle/connexion étrangers
et ne jamais les employer comme autorité. Aucun appel IA ou fournisseur nécessaire.

## AC-04

Créer ou compléter le schéma minimal tenant/membres et les migrations indispensables aux tests avec le rôle DB effectivement utilisé ; EA-07 étend ensuite le schéma aux dossiers, propositions et actions sans retarder ces preuves d’isolation.

Acceptation : migration additive après 001, sans modification de la migration
livrée ; tables minimales d’export et de travail liées par clés composites. Les
fixtures appliquent les deux migrations et les nouveaux droits limités sans changer
les membres/scénarios existants. Une transaction prend le travail, contrôle les
droits actuels et écrit le résultat local ; aucun effet fournisseur. Reprise après
interruption vérifiée, résultat durable, identifiant stable et création idempotente.
Les dossiers/propositions/actions externes restent EA-07 et tickets suivants.
RLS est un complément facultatif selon produit04 ; cette tranche prouve les
contrôles serveur, contraintes composites et capacités exactes du rôle SQL, sans
prétendre qu’un login applicatif compromis est confiné à une seule cave.

## AC-05

Respecter les critères UX applicables de docs/product/11-ux-ui-et-design.md et les tokens de docs/design/design-tokens.json sur les parcours modifiés ; exécuter test:ux, conserver les captures navigateur et faire vérifier les états, le responsive, le clavier et les actions sensibles par la review indépendante.

Acceptation : action « Exporter l’équipe » dans les paramètres de la cave active,
états en attente/prêt/refus/erreur, téléchargement déclenché explicitement par
l’utilisateur. Les exports affichés et réponses tardives sont supprimés lors d’un
changement de cave ou de droits. Aucun export présenté comme prêt avant résultat
SQL. CSV neutralise les cellules interprétables comme formules et échappe les
délimiteurs. Clavier, cibles/contrastes, mobile 320/390 et bureau 768/1440, zooms,
captures des états applicables et review indépendante. UX-01/13/16/17 ; réutiliser
les composants/tokens existants et conserver les vieux tests sans les modifier.

## Choix et preuves

Le périmètre d’export d’équipe rend les contrôles d’API, de travail différé et de
fichier effectivement observables dès le schéma identité, sans simuler de fonctions
commerciales futures. Package serveur commun de tenancy/accès/exports réutilisé par
API et worker ; le domaine conserve les décisions pures. Export local SQL borné,
durée de conservation courte configurable documentée, aucun destinataire externe.

Gates obligatoires : kit, unit, functional, business, e2e, ux. Vérifications
affectées : compilation/foundation, tests d’outillage, démarrage configuré du worker.
Les suites IA absentes restent en échec hors applicabilité du ticket. PostgreSQL
17 local et OIDC synthétique EA-05 ; aucun secret ni compte prospect. Chaque source,
résultat et capture est associé à un manifeste revu, puis commit et push sans force.
Documentation et rapport de livraison EA-05 sont conservés lors de ce lot.
