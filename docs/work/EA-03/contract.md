# EA-03 — Contrat avant réalisation

Date : 2026-09-09. Base de formalisation : `602a56ac3dda67806dbd75f5fbb3b3f0dcb45d15`.
Dépendance EA-01 livrée et publiée dans ce commit. EA-02 indépendant en review.
Références : brief, produit 02/04/05/06/10/11, design, ADR-0000/0002/0004, stratégie tests et DoR/DoD.

## AC-01

Indépendance EnCave explicite : dépôt, données, authentification, secrets, code d’exécution et déploiement propres.

Acceptation positive/négative : Décision explicite pour chaque frontière de ressources ; refuser toute dépendance à la marketplace.

## AC-02

Sam fixe le périmètre, les priorités et la politique de livraison ; les décisions réversibles documentées permettent aux agents de progresser sans validation d’un prospect.

Acceptation positive/négative : Priorités et livraison héritées des décisions de Sam ; distinction entre délégation réversible et autorisation commerciale A1.

## AC-03

Disponibilité interne/externe et limites de concurrence décidées ; interfaces de connecteurs neutres vis-à-vis du fournisseur, Microsoft étant le premier adaptateur visé.

Acceptation positive/négative : Source de vérité par ressource, contrôle PostgreSQL et limite Outlook explicités ; aucun engagement sur disponibilité inconnue.

## AC-04

Profil sans Microsoft et devis livrés ou exclus explicitement du lancement vendu ; aucune activation d’un fournisseur non qualifié.

Acceptation positive/négative : Matrice de lancement : profil interne et devis inclus ou exclus, état réellement disponible distinct de la cible ; fournisseur inconnu inactif.

## AC-05

Les choix de fondation et de développement ne dépendent pas d’une vérification sur le compte réel d’un prospect ni de la disponibilité du tenant de test Microsoft.

Acceptation positive/négative : Continuer le noyau et les simulations sans tenant Microsoft ; aucune preuve réelle fabriquée.

## AC-06

Les choix techniques réversibles conformes au brief sont délégués à l’agent et consignés en ADR sans demander à Sam une validation entre tickets ; une dépense, un accès tiers ou une hypothèse métier non établie ne sont jamais inventés.

Acceptation positive/négative : ADR de choix réversibles et registre des inconnus ; aucune dépense ou autorisation tierce implicite.

## Livrables, décisions et contrôles

ADR d’architecture et de lancement : pile existante, identité OIDC indépendante, région cible de données et limites de traitement, disponibilité interne/externe, accord exact et autorisation A1, profils réellement annonçables. Les choix de services restent une conception sans création de ressource payante. Registre des conditions encore inconnues et des lots à réaliser. Aucun changement du backlog, des politiques ou des tests existants.

Gate applicable : kit inchangé sous WSL ; contrôle documentaire exact des six AC/liens, review indépendante. Aucun code produit dans ce ticket. Budget : trois corrections, huit appels, 7 200 secondes.
