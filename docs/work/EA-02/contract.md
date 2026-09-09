# EA-02 — Contrat avant réalisation

Date : 2026-09-09. Base : `602a56ac3dda67806dbd75f5fbb3b3f0dcb45d15`.
Dépendance EA-01 : commit de base, review pass et SHA distant vérifié.
Références : brief, produit 03/10, ADR-0002, stratégie tests/DoR-DoD, références Microsoft officielles.
Ticket documentaire ; aucun appel Graph ni OAuth de compte réel.

## AC-01

Documenter à partir des références officielles les configurations Exchange Online, boîtes et calendriers visées, les capacités et les opérations non supportées ; l’application Outlook seule ne prouve pas la compatibilité.

Acceptation positive/négative : Matrice produit contre pages Microsoft datées : boîte propre Exchange Online, profils partagés séparés, exclusions explicites. Refus : présence du client Outlook ne suffit pas.

## AC-02

Définir les contrats et cas de tests de lecture, notifications, écriture calendrier, envoi, renouvellement, révocation, erreurs et refus hors périmètre ; aucune permission Shared n’est supposée compatible avec les webhooks.

Acceptation positive/négative : Contrat des opérations et matrice nominal/refus/panne ; notifications Shared refusées en délégué, scopes applicatifs et leur portée distincts.

## AC-03

Spécifier un onboarding OAuth réutilisable par toute cave sur une configuration supportée, sans identifiants de client codés en dur ni redéploiement ; distinguer permissions déléguées, permissions applicatives et consentement administrateur éventuellement exigé par Microsoft.

Acceptation positive/négative : Parcours OAuth avec tentative serveur liée à acteur/cave/session, PKCE, nonce, anti-rejeu, sélection puis vérification ; aucun identifiant propre à un client ni redéploiement.

## AC-04

Séparer clairement tests de contrat avec simulations et protocole de qualification réelle sur un tenant de test autorisé géré par Sam ; les résultats réels restent non exécutés tant qu’aucun accès de test n’est configuré.

Acceptation positive/négative : Protocole qualification sur deux organisations autorisées, registre initial non exécuté. Fixtures et appels réels non confondus ; preuve par capacité et cas.

## AC-05

L’absence d’accès Microsoft de Julien ou d’un prospect ne bloque ni ce contrat ni le développement indépendant. Avant toute activation réelle, les capacités utilisées et permissions effectives doivent être vérifiées avec des preuves réelles ; une configuration inconnue reste inactive.

Acceptation positive/négative : Activation initialement interdite sans preuves réelles, poursuite du noyau et des contrats possible sans Julien. Aucune permission ou autorisation tierce inventée.

## Livrables et décisions

Contrat dans docs/connectors/microsoft-contract.md, protocole dans
microsoft-qualification.md, registre sans résultats inventés en JSON.
Les capacités sont cibles de développement, non capacités activées du produit.
Guide réutilisable pour toute cave, compte professionnel propre en premier.
Sources Microsoft consultées le 2026-09-09, citations près des faits fournisseur.
Gate kit inchangée sous WSL, contrôle des critères/liens/registre et review
indépendante. Budget : 3 corrections, 8 appels, 7 200 secondes maximum.
Aucun accès manquant n'est déduit d'une lecture de secrets ; aucun n'est configuré
pour cette qualification dans la session. Les opérations réelles restent non exécutées.
