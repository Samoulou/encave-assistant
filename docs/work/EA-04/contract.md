# EA-04 — Contrat avant réalisation

Date : 2026-09-09. Base de formalisation : `6ba1d27ea182ca1b1fb676743358fdeca88feb26`.
INIT-01 et DEV-01 livrés/revus/publiés. EA-03 est en review indépendante : réalisation EA-04 uniquement après sa livraison vérifiée.
Mise à jour avant réalisation : EA-03 livré dans `f5cc92c249370b51e773bea2ae704c0881a65968`, review pass et SHA distant vérifié. Cette révision devient la base de réalisation EA-04 ; dépendances satisfaites.
Références : ADR-0003/0004/0005, brief, produit04/05, docs/local-development.md, stratégie tests/DoR-DoD et scripts/workflow_contract.py.

## AC-01

Aucun import ou secret de la marketplace.

Acceptation positive/négative : Verifier les packages et references propres ; aucune lecture de secret ni import marketplace.

## AC-02

Versions verrouillées et guide local.

Acceptation positive/négative : Conserver Node 24/npm/TS/PG et lockfiles ; verifier npm ci et guide Windows, ajouter navigateur verrouille pour les futures suites.

## AC-03

Développement, préproduction et production séparés.

Acceptation positive/négative : Declarer et verifier des configurations et espaces GitHub distincts ; aucun secret/base/issuer de production repris en test. Provisionnement payant non effectue.

## AC-04

Configurer les environnements de test et la CI dans les fichiers de maintenance préautorisés, en conservant les gates obligatoires, la distinction entre foundation et produit et le forçage des contrôles de release ; aucune suppression de contrôle pour obtenir du vert.

Acceptation positive/négative : Ajouter service PostgreSQL et navigateur au seul workflow qualite autorise, verifier le contrat de maintenance sur les deux workflows ; conserver toutes les commandes/gates existantes, les suites absentes en echec et release force_product.

## Réalisation prévue et limites

Fichiers protégés autorisés : .github/workflows/product-quality.yml et .github/workflows/release.yml uniquement. Aucun changement nécessaire du second si son isolation existante est suffisante. Ajouter préparation CI et nouveaux tests sous packages/tooling, déclarations sous ops/environments et guide propre. Aucun ancien test modifié.

PostgreSQL 17.11 en service éphémère du runner Linux, image épinglée par digest, loopback et base synthétique ; préparation refuse hors CI/test et tout écrasement. Chromium/Playwright verrouillé, contrôle technique de lancement distinct du futur test:ux EA-05. Le poste Windows conserve PostgreSQL natif. Environnements GitHub development/preproduction/production distincts sans secrets ou déploiements créés. Les ressources Azure restent non provisionnées et non facturées.

Décision corrective après le premier kit : démarrer le conteneur par une étape de préparation Docker plutôt que `jobs.product.services/env`, afin de respecter la fixture de maintenance existante. Même périmètre technique ; aucune modification ou réduction des critères/tests. La VM GitHub hébergée assure la suppression du conteneur après le job, avec nettoyage immédiat de son ID vérifié si sa préparation échoue.

Gates : kit (backlog), validation du contrat des workflows contre base, nouveaux tests de préparation et séparation, npm ci et foundation contre PostgreSQL local, lancement réel de Chromium. Contrôler la CI distante après publication sans transformer les suites produit absentes en succès. Review indépendante, trois corrections/huit appels/7 200 secondes.
