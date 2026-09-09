# EA-10 — Résultats observés

Tâche directe Windows, base `44e938eb2b16107df32be7acdb50feb3b3c18fdc`.
Node 24.19.0/npm 10.9.2, PostgreSQL 17.11 loopback avec login applicatif
distinct du propriétaire ; données fictives, OIDC synthétique, vrai HTTP/API/Next
et Chromium. Aucun accès Microsoft, aucune réservation ni IA réelle.

| Commande exécutée | Résultat | Log local ignoré |
|---|---|---|
| `npm ci` | code 0, installation verrouillée, audit 0 vulnérabilité | `.agentic/ea10-install-final.log` |
| `npm run test:unit` | 20 tests, 8 fichiers, code 0 | `.agentic/ea10-unit-final.log` |
| `npm run test:functional` | 27 tests, 7 fichiers, code 0 | `.agentic/ea10-functional-final.log` |
| `npm run test:business` | 28 tests, 6 fichiers, code 0 | `.agentic/ea10-business-final.log` |
| `npm run test:e2e` | 16 tests, 6 fichiers, code 0 | `.agentic/ea10-e2e-final.log` |
| `npm run test:foundation-tooling` | 19 tests, code 0 | `.agentic/ea10-foundation-tooling-final.log` |
| `npm run check:foundation` | compilation, web/API/worker, SQL42, code 0 | `.agentic/ea10-foundation-final.log` |
| `node packages/tooling/identity-demo.mjs --verify` | runtime, worker et nettoyage possédé, code 0 | `.agentic/ea10-runtime-final.log` |
| `python3 scripts/check_kit.py` via helper WSL contrôlé | 141 tests en 65,936 s, code 0 | `.agentic/ea10-kit-final.log` |

Kit exécuté comme sam_8 sous Ubuntu WSL avec horloge Hyper-V MSR temporaire,
puis restauration tsc/NTP observée. Ses scénarios négatifs produisent certains
libellés FAIL attendus ; la sortie finale est KIT VALIDE/code 0. Les suites
produit sont exécutées séparément. Aucun continuous.py natif Windows.

## Couverture observable

AC-01 : marges entières avant/après incluses dans les intervalles demi-ouverts,
fermeture touchant la seule préparation, horaires et changement de date, ressources
multiples, durée fixe issue du catalogue et durée variable explicitement fournie.
Configuration/fermetures/plans persistants, compteurs périmés refusés, concurrence
de révision et rollback intégral après panne de journal. Le navigateur relit les
mêmes bornes après un vrai redémarrage API ; une fermeture d'une autre session
invalide l'ancienne prévisualisation et bloque le nouvel intervalle.

AC-02 : heure supprimée et heure répétée sans offset refusées, deux occurrences
valides à Zurich distinguées, offset incompatible refusé, durée écoulée exacte
durant changement d'heure. UTC, America/New_York, frontières exclusives, horaires
de nuit, frontière hebdomadaire ambiguë et horizon borné couverts. Les tests HTTP
et navigateur vérifient aussi ces refus, au-delà des fonctions pures.
Temporal 0.5.1 fixé ; Node sans Temporal natif, ICU 78.3/tzdata 2026b observés.

AC-03 : source/politique déclarées et versionnées par ressource ; inconnu,
Microsoft non qualifié et calendrier externe restent bloqués. Même lorsque les
règles internes sont satisfaites, availabilityVerified et bookingAllowed restent
false. Aucun effet fournisseur ou allocation n'est créé. Rôles, CSRF, origine,
références étrangères et cave de session sont testés en HTTP et SQL réel.
Les droits sont relus avant replay. Une ressource non ancre sans configuration
fait échouer le plan entier au lieu de disparaître silencieusement du calcul.

Migration v5→v6 et replay préservent les données ; l'API historique sans option
reste v3. FK composites, appartenance de l'ancre au commit, immuabilité même sous
le propriétaire et annulation conservant les termes d'une fermeture sont testées.

## Review, correction et limites

Review01 conservée : composition des plans encore extensible par INSERT SQL,
et dossier de preuves finales manquant. Correction 1 : composition déclarée dans
l'en-tête immuable, insertion limitée à cette liste et contrôle différé exigeant
toutes les lignes au commit. Les clés uniques empêchent ensuite tout ajout tardif.
Le nouveau test sous login applicatif échoue avant correction (« Missing expected
rejection », `.agentic/ea10-plan-append-before-correction.log`) puis passe pour
plan courant et remplacé. Un second cas refuse une composition incomplète malgré
son ancre présente. Six tests métier ciblés passent dans
`.agentic/ea10-correction1-targeted.log`, puis les 28 tests métier finaux.
Les autres gates finales ci-dessus ont été exécutées après cette correction.

Aucun ancien test, migration publiée, instruction ou politique modifié. Les logs
de développement et du premier échec restent conservés avec empreintes. Documentation
technique et ADR-0011 décrivent décisions et limites, dont bornes configurées,
source seulement déclarée et disponibilité complète/allocation à réaliser en EA-18/24.

Aucune nouvelle interface dans ce ticket non requires_ux ; UX non applicable.
Évaluations IA non applicables et non déclarées réussies. La CI EA-09 passe toutes
les suites présentes et reste globalement en échec pour évaluations IA absentes ;
ses résultats sont conservés dans sa livraison. Ce constat n'est ni une CI verte
ni un déploiement. La seconde review doit examiner manifeste et preuves avant Git.
