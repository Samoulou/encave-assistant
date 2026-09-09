# EA-12 — Contrat avant réalisation

Ouverture : 2026-09-09 13:08:15 UTC, exécution1, échéance15:08:15 UTC.
Maximum trois corrections, huit appels reviewer, 1200secondes/appel et7200secondes/
exécution. Base `22bbfb51c825d2963705cce9c49f8a31488b1f26` ; dépendance EA-11 livrée,
review pass et SHA distant vérifié. Lectures : AGENTS/START/protocole08, brief,
EA-12, produit03 §formulaire/téléphone/petite cave, sécurité05, contrats09,
connecteurs10, UX11 §4.8/5/6/7, design/tokens et maquettes, stratégie04/DoD05.

## AC-01

Tenant résolu par configuration serveur.

Acceptation : administrateur authentifié configure et active le formulaire de sa
cave par API, version optimiste et journal. Le serveur délivre un identifiant
public opaque stable, un lien et un extrait HTML de bouton utilisable sur un site
WordPress ou autre. Le visiteur ouvre la page publique hébergée ; aucun paramètre
tenant_id/caveId/acteur/état fourni par lui ne constitue une autorité.
L'endpoint résout sa cave depuis cette configuration, puis crée dans une transaction
le dossier, le message entrant, la provenance formulaire et le résultat idempotent.

Un formulaire désactivé/inconnu est explicitement indisponible. La page ne révèle
que le nom public de la cave et les informations approuvées utiles à la saisie.
Les sessions staff éventuellement présentes ne changent pas la cave destinataire.
Un compte visiteur n'est pas créé ; le dossier reste lisible uniquement aux membres
autorisés de la cave. Deux caves peuvent utiliser le même code sans redéploiement.

Tests HTTP/SQL/E2E : deux configurations et mêmes noms visiteurs, refus de cave
injectée, rôle admin/opérateur/lecteur, références étrangères, changement de version,
désactivation, aucune lecture publique du dossier. Source formulaire et absence
d'acteur staff falsifié conservées ; rechargement côté opérateur relit la demande.

## AC-02

Limites de taille, débit et anti-spam.

Acceptation : schéma fermé, corps16Kio maximum, champs bornés et validation serveur.
Challenge aléatoire serveur limité dans le temps, lié au formulaire et à sa version,
honeypot et durée minimale avant soumission ; toutes ces données sont non fiables
tant qu'elles ne correspondent pas à l'état serveur. Un challenge ne produit qu'une
soumission, avec reprise exacte idempotente après réponse perdue. Nonce expiré,
falsifié ou d'une autre cave/formulaire ne crée rien. Origine contrôlée, sans la
présenter comme une authentification du visiteur.

Limites atomiques PostgreSQL par formulaire pour délivrance de challenges et
soumissions, couvrant plusieurs processus et redémarrages. Ne pas utiliser l'IP
loopback du proxy comme identité de tous les visiteurs ni croire un X-Forwarded-For
libre. Les plafonds et délais sont configurables dans des bornes non nulles,
documentés comme protections initiales ; ils ne constituent pas une qualification
anti-bot universelle. Challenge/quotas périmés nettoyés selon une borne explicite,
sans supprimer les preuves d'une soumission acceptée.

Tests positifs/négatifs : limites de taille/débit, soumissions concurrentes et
rejeu unique, honeypot, trop rapide, expiration, mauvaise origine, contenu hostile
affiché comme texte, refus sans écriture partielle. Pannes après commit et reprise
ne doublent pas le dossier. Un refus de vérification ne doit pas perdre une
commande dont le résultat antérieur demeure inconnu.

## AC-03

Accusé et moyen de réponse testés ; aucun compte visiteur imposé.

Acceptation : nom, moyen de réponse (e-mail ou téléphone) et besoin obligatoires ;
date souhaitée/participants/budget facultatifs, budget CHF avec base groupe/personne.
Succès après commit seulement : « Demande reçue », référence et cave destinataire,
sans annoncer une réservation ni un e-mail envoyé. Le canal de réponse déclaré est
conservé dans le dossier opérateur. Aucun e-mail sortant n'est simulé lorsque son
prestataire n'est pas configuré ; l'accusé de cette tranche est la réponse de la
page et de l'API. Un visiteur valide sans cookie de session ni connexion préalable.

Tests : parcours public complet, moyen de réponse invalide/absent, infos facultatives
inconnues, téléphone seul, budget conservé, accusé exact et absence d'action externe.
Lecture staff du message entrant/provenance, reload navigateur/API, reprise après
réponse perdue, désactivation en cours de saisie et absence de succès fictif.

## AC-04

Respecter les critères UX applicables de docs/product/11-ux-ui-et-design.md et les tokens de docs/design/design-tokens.json sur les parcours modifiés ; exécuter test:ux, conserver les captures navigateur et faire vérifier les états, le responsive, le clavier et les actions sensibles par la review indépendante.

Acceptation : UX-11/13/14/15/16/17, source du dossier §4.2 et règles publiques §4.8.
Page nommant la cave, formulaire compact pierre/blanc/bordeaux, libellés visibles,
facultatif explicite, erreurs liées et résumé, focus/clavier, statuts accessibles,
valeurs conservées après échec. L'action nomme une demande, jamais une réservation.
L'affichage staff distingue message entrant du visiteur et compte rendu manuel.

Tests et captures réels : initial, chargement, invalide, délai/limite, échec,
indisponible/désactivé, attente, succès ; 320/390/768/1440, zoom200% et reflow400%,
Tab/Entrée, contraste/styles/cibles44/focus3px. Intégration légère testée depuis
une page de site de cave fictive pointant vers le formulaire. Le lien ouvre une
page dédiée ; l'iframe n'est pas annoncée et les protections X-Frame-Options
existantes sont conservées. Aucun composant du site marchand EnCave n'est importé.

## Choix et gates

Migration additive008 ; historique publié et API de migration par défautv3 conservés.
La configuration initiale se fait par API admin ; son écran d'onboarding viendra
avec EA-38. Endpoint public contrôlé et bouton/lien HTML constituent l'intégration
au site, sans plugin WordPress obligatoire. Aucun compte/accès de prospect requis.
Gates kit, unit, functional, business, E2E, UX, compilation/foundation/outillage/runtime
affectés. IA non applicable. Sources/budgets/limites, review indépendante, preuves
et livraison Git normale avant prochain ticket admissible.
