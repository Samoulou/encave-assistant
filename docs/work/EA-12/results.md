# EA-12 — Résultats observés

Base22bbfb51c825d2963705cce9c49f8a31488b1f26, tâche directe Windows.
Node24.19.0/npm10.9.2, PostgreSQL17.11, vrais processus API/Next/Chromium,
personnel OIDC fictif et visiteurs sans compte. Aucun envoi externe ni production.

| Commande | Résultat | Log local |
|---|---|---|
| npm run test:unit | 24 tests/10 fichiers, code0 | ea12-unit-final.log |
| npm run test:functional | 36 tests/9 fichiers, code0 | ea12-functional-final.log |
| npm run test:business | 35 tests/8 fichiers, code0 | ea12-business-final.log |
| npm run test:foundation-tooling | 19 tests, code0 | ea12-foundation-tooling-final.log |
| npm run test:e2e | 27 tests/10 fichiers, code0 | ea12-e2e-final.log |
| npm run test:ux | 11 tests/4 fichiers, code0 | ea12-ux-final.log |
| npm run check:foundation | compilation/API/web/worker/SQL42, code0 | ea12-foundation-final.log |
| node packages/tooling/identity-demo.mjs --verify | runtime et nettoyage possédé, code0 | ea12-runtime-final.log |
| python3 scripts/check_kit.py sous WSL | 141 tests en85,152s, code0 | ea12-kit-final.log |

Logs sous .agentic, exclus de Git ; empreintes dans checksums.json. Le helper WSL
exécute le kit comme sam_8 avec horloge Hyper-V MSR temporaire, puis restaure
tsc/NTP. Ses scénarios négatifs attendus ne sont pas les gates produit ci-dessus.
Aucun continuous.py Windows ni attestation du contrôleur.

Les dix nouveaux tests serveur puis quatre E2E ciblés passent. Les premiers tests
UX ont trouvé un vrai lien de saut dupliqué (retiré du composant, le layout le
fournit déjà), une configuration de quota de scénario remplacée involontairement
par sa valeur de fixture et l’arrondi 3,9999999999999996 du zoom4. Le nouveau test
conserve le quota voulu et vérifie le zoom avec tolérance1e-12 et largeur320 réelle.
Aucun ancien test n’est modifié. L’examen visuel auteur a aussi rétabli la classe
primaire bordeaux et retiré une marge de marque héritée dans le bandeau public.
Ces ajustements visuels sont présents dans la gate UX/foundation finale ; la
correction à venir réexécutera aussi les gates E2E sur son candidat final.

AC-01 : routage serveur, deux caves, configuration admin versionnée/idempotente,
autres rôles refusés, session staff étrangère ignorée pour l’entrée publique,
propriétés d’autorité rejetées et dossier non lisible publiquement.
AC-02 : taille16Kio, schémas fermés, challenge/TTL/version/honeypot/délai minimal,
quotas SQL atomiques même après rollback ou JSON malformé, concurrence et reboot,
transactions sans écriture partielle et provenance immuable.
AC-03 : e-mail ou téléphone conservé, lien suivi depuis un vrai site HTTP fictif,
accusé après commit, reprise exacte après perte201/désactivation/réactivation/reboot,
affichage hostile comme texte, aucune action externe ni réservation inventée.
AC-04 : 33 captures publiques plus84 régressions identité/exports/saisie ;
320/390/768/1440, zoom200/400 sur toute la hauteur, clavier/focus3/cibles44/contrastes,
états attente/erreur/invalide/périmé/indisponible/limité/succès et provenance staff.

La review indépendante initiale est conservée dans review-01.json. Elle demande de
corriger le challenge expiré déjà nettoyé laissant un ancien onglet verrouillé et
l’absence de résumé d’erreurs avec liens vers les champs. Les tests verts initiaux
ne constituent pas une acceptation du ticket. Aucun commit EA-12 n’est livré.
CI EA-11 : Kit réussi, Product échoué seulement sur évaluations IA absentes ;
IA non applicable à EA-12. Aucune CI verte ni production n’est annoncée.

## Correction1

Deux nouveaux tests E2E reproduisent chacun le défaut identifié : ils échouent
avant correction (ea12-review-regressions-before.log, code1/2 échecs) puis passent
après correction (ea12-review-regressions-after.log, code0/2 succès). Pour R1, le
GET d’un deuxième visiteur nettoie réellement le challenge expiré du premier,
puis le premier peut actualiser sa saisie et créer exactement un dossier. Le
serveur établit l’absence après la recherche du résultat durable sous le verrou
commun ; les références SQL protègent les challenges d’intakes déjà acceptés.
Pour R2, chaque erreur du résumé possède un lien clavier plaçant le focus sur
son champ, sans effacer le nom déjà saisi. Les 3 tests UX ciblés passent aussi,
avec33 captures dont les deux nouveaux états « challenge nettoyé » et focus du
lien de résumé. Les gates cumulées corrigées du tableau sont toutes passées,
y compris27 E2E/11 UX, compilation/runtime et kit141. L’outillage19 inchangé est
conservé de la première passe ; les autres gates ont été réexécutées après correction.
La première passe passait25 E2E et kit141 en67,308s, mais ses deux défauts de review
empêchaient la livraison. La review2 vérifie maintenant le candidat final et ses
117 captures ; son verdict pass est conservé dans review-02.json.
Les logs avant correction portent le suffixe before-correction ; le manifeste et
l’index UX initiaux sont conservés sous .agentic/runs/ea12-*-before-correction.json.

La seconde review confirme les143 fichiers,30 logs et6 supports locaux du manifeste
`32eae386b659e9cf9cf6636f1c64346234bc2208bc921bb97dbcc47f2ef919fe`.
Les117 captures sont couvertes : 98 empreintes identiques à l’examen initial et19
captures nouvelles/différentes inspectées. Aucun défaut restant identifié ; deux
appels reviewer et une correction, budget respecté. La livraison Git est l’étape
suivante ; le verdict ne signifie ni CI distante réussie ni production déployée.
