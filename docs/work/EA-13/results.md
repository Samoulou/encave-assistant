# EA-13 — Résultats observés

Tâche directe Windows, base ddc291786798ed273916d8ee2823efe14747fc6a.
Node24.19.0/npm10.9.2, PostgreSQL17.11 ; API/Next/Chromium réels,
OIDC et Microsoft synthétiques. Aucun compte réel ni production.

Résultats du candidat initial, examinés par review-01 puis complétés par la correction1 ci-dessous.

| Commande | Observation | Log local |
|---|---|---|
| npm ci | 115 paquets installés,124 audités,0 vulnérabilité,code0 | ea13-npm-ci-final.log |
| npm run test:unit | 26 tests/11 fichiers,code0 | ea13-unit-final.log |
| npm run test:functional | 43 tests/12 fichiers,code0 | ea13-functional-final.log |
| npm run test:business | 39 tests/9 fichiers,code0 | ea13-business-final.log |
| npm run test:foundation-tooling | 19 tests,code0 | ea13-foundation-tooling-final.log |
| npm run test:e2e | 33 tests/11 fichiers,code0 | ea13-e2e-final.log |
| npm run test:ux | 15 tests/5 fichiers,code0 | ea13-ux-final.log |
| npm run check:foundation | compilation/API/web/worker/SQL42,code0 | ea13-foundation-final.log |
| node packages/tooling/identity-demo.mjs --verify | runtime/nettoyage possédé,code0 | ea13-runtime-final.log |
| python3 scripts/check_kit.py sous Ubuntu WSL | 141 tests en71,529s,code0 | ea13-kit-final.log |

Le kit est lancé comme sam_8 avec horloge Hyper-V MSR temporaire, puis restauration
tsc/NTP. Le premier lancement désignait une distribution inexistante
« Ubuntu-24.04 » ; il n’a exécuté aucun test. Le nom réel « Ubuntu » a été vérifié
et le lancement corrigé. Les FAIL/NON CONFIGURÉ des scénarios négatifs du kit ne
sont pas les résultats des suites produit ci-dessus. Aucun continuous.py Windows.

Les premières suites complètes E2E32 et UX14 sont vertes ; leurs logs sont conservés
avec suffixes before-recovery et before-draft-restore. Elles ne valident pas à elles
seules les derniers changements. Deux nouveaux scénarios ont reproduit des valeurs
non réaffichées après reload d’une commande incertaine : nom de connexion et
sélections de ressources. Le journal conservait les bonnes valeurs ; l’écran les
restaure désormais depuis la commande de la bonne cave. Preuve rouge dédiée dans
ea13-draft-recovery-before.log ; preuve ciblée après correction dans
ea13-draft-recovery-after.log (2 tests,code0). Une reprise de credentials illisibles a également
été ajoutée et vérifiée par7 scénarios serveur ciblés.

AC-01 : AES-GCM lié cave/connexion/finalité/version, cache MSAL côté serveur,
réponses sans secrets, API/rôle/CSRF/session et jobs isolés, substitution de cache
refusée puis autorisation invalidée ; FK composites et historique immuable.

AC-02 : contrats lifecycle/capacités/lecture/écriture/santé/erreurs dans contracts,
adaptateur Microsoft séparé. Découverte synthétique disponible seulement après
activation ; autres opérations non supportées ; réel non qualifié/inactif.

AC-03 : OAuth réel MSAL contre simulateur, deux organisations/deux caves sans
changement de code, ressources autorisées, routage exclusif, persistance/restart,
reconnexion même compte, changement de compte refusé, révocation et commandes
idempotentes ; nouvelles commandes distinctes des reprises en attente.

AC-04 : PKCE/state/nonce, signature/issuer/audience/expiration, claims obligatoires,
oid/tid et /me cohérents, rôles revérifiés, compte personnel refusé. Scopes minimaux,
consentement refusé/admin requis, calendrier non permis, code substitué, tentative
expirée/rejouée, autre session/cave et rôle retiré couverts.

AC-05 : refresh MSAL borné,429/timeout5s/interaction requise, expiration et santé
par connexion. Révocation pendant Graph : une seule requête déjà partie, aucune
requête suivante/persistance tardive, anciens jobs refusés et caveB inchangée.
Cache inutilisable révoqué localement puis reconnexion possible sans doublon.

AC-06 : simulateur explicitement test, transport refusé en production, contraintes
SQL et serveur interdisant activation réelle. Intégration réelle non vérifiée ;
pas de synchronisation/envoi/écriture/déploiement déduit des tests synthétiques.

AC-07 : tests navigateur responsive320/390/768/1440, zoom réel200/400, clavier,
focus3px, cibles44px, contrastes, modale sensible et retour focus, refus de
consentement, ressource manquante, autre compte, expiration, erreur, état incertain,
lecture seule, absence de configuration et réponses tardives d’une autre cave.
Les captures finales sont consolidées dans ux-captures.json :50 captures EA-13
et117 régressions. La review initiale a demandé des corrections, détaillées ci-dessous.

Les sept critères sont reproduits exactement dans le contrat ; aucun ancien test
ni fichier protégé n’est modifié (ea13-integrity-final.log). La CI d’EA-12 a été
observée : kit réussi, qualité produit bloquée uniquement par les évaluations IA
encore non configurées ; suites produit restantes réussies, release ignorée.
Voir delivery.md d’EA-12 et les logs d’observation empreintés avec ce ticket.


## Correction1 — résultats observés

Review-01 : request_changes, R1/R2/R3. Le candidat initial, son manifeste et le
rapport indépendant sont conservés. Aucune gate initiale verte ne couvrait ces
trois défauts. Correction1 ouverte15:12:19 UTC, dans le budget de trois cycles.

Les quatre nouvelles régressions serveur échouent avant correction et passent
après (ea13-c1-regressions-before.log et ea13-c1-regressions-after.log).
Le parcours navigateur compilé échoue avant correction : la commande reste
bloquée après une nouvelle session (ea13-c1-browser-before.log). Le même test
passe dans la suite E2E corrigée. Trois captures mobiles supplémentaires montrent
la commande conservée, la connexion retrouvée et sa nouvelle autorisation.
Le test HTTP refuse aussi l’ancien callback et vérifie qu’une reprise tardive ne
modifie pas une connexion déjà renouvelée. Le test métier vérifie santé, version,
cache et exécution d’un job après la course entre échec ancien et succès récent.
Le test MSAL parcourt réellement la réponse de jeton jusqu’au statut serveur de
consentement administrateur, sans exposer le diagnostic fournisseur brut.

| Commande | Observation | Log local |
|---|---|---|
| npm run test:unit | 27 tests/12 fichiers,code0 | ea13-c1-unit-final.log |
| npm run test:functional | 45 tests/13 fichiers,code0 | ea13-c1-functional-final.log |
| npm run test:business | 40 tests/10 fichiers,code0 | ea13-c1-business-final.log |
| npm run test:e2e | 34 tests/11 fichiers,code0 | ea13-c1-e2e-final.log |
| npm run test:ux | 16 tests/5 fichiers,code0 | ea13-c1-ux-final.log |
| python3 scripts/check_kit.py sous Ubuntu WSL | 141 tests en65.686s,code0 | ea13-c1-kit-final.log |
| npm run check:foundation | compilation/API/web/worker/SQL42,code0 | ea13-c1-foundation-final.log |
| node packages/tooling/identity-demo.mjs --verify | runtime et nettoyage possédé,code0 | ea13-c1-runtime-final.log |

Après une première passe complète C1, seule la phrase interaction_required du
navigateur a changé pour ne pas attribuer une demande à Microsoft. E2E, UX,
foundation et runtime ont été réexécutés après ce texte ; leurs anciennes passes
sont conservées sous before-copy. Le code serveur est inchangé depuis les passes
unitaires, fonctionnelles, métier et kit C1.

Les 19 tests d’outillage initiaux restent applicables : aucun fichier d’outillage
existant n’a changé pendant C1. npm ci et ses dépendances restent inchangés.
Le kit restaure tsc/NTP après son exécution WSL. Tous les anciens tests sont
conservés ; aucune modification des politiques ou workflows. La seconde review
porte sur les empreintes finales et les170 captures (53 EA-13 et117 régressions).
L’intégration Microsoft réelle reste non vérifiée, ses capacités non activables.
Aucun envoi, synchronisation réelle ou déploiement n’est revendiqué.
