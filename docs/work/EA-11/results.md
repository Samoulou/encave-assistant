# EA-11 — Résultats observés

Tâche directe Windows, base `c6ab7ea845fbeb5ecf3b908c2efc4e7382a18377`.
Node24.19.0/npm10.9.2, PostgreSQL17.11 loopback avec login applicatif distinct du
propriétaire. OIDC synthétique, vrais processus API/Next et Chromium, données
fictives. Aucun compte Microsoft/IA, envoi réel ou réservation dans cette tranche.

| Commande exécutée | Résultat | Log local ignoré |
|---|---|---|
| `npm ci` | code0, installation verrouillée | `.agentic/ea11-install-final.log` |
| `npm run test:unit` | 22 tests, 9 fichiers, code0 | `.agentic/ea11-unit-final.log` |
| `npm run test:functional` | 31 tests, 8 fichiers, code0 | `.agentic/ea11-functional-final.log` |
| `npm run test:business` | 32 tests, 7 fichiers, code0 | `.agentic/ea11-business-final.log` |
| `npm run test:foundation-tooling` | 19 tests, code0 | `.agentic/ea11-foundation-tooling-final.log` |
| `npm run test:e2e` après correction | 21 tests, 8 fichiers, code0 | `.agentic/ea11-e2e-final.log` |
| `npm run test:ux` après correction | 8 tests, 3 fichiers, code0 | `.agentic/ea11-ux-final.log` |
| `npm run check:foundation` après correction | compilation, web/API/worker et SQL42, code0 | `.agentic/ea11-foundation-final.log` |
| `node packages/tooling/identity-demo.mjs --verify` après correction | runtime et nettoyage possédé, code0 | `.agentic/ea11-runtime-final.log` |
| `python3 scripts/check_kit.py` via helper WSL après correction | 141 tests en67,749s, code0 | `.agentic/ea11-kit-final.log` |

La correction1 concerne uniquement la conservation d'une commande incertaine dans
le composant navigateur, sa documentation et deux nouveaux tests E2E/UX. Les sources
unitaires/serveur/SQL et d'outillage n'ont pas changé après leurs gates ci-dessus.
Les gates navigateur, compilation web/runtime et kit sont réexécutées sur la version
corrigée, avec succès. Les logs de la première passe complète restent conservés avec suffixe
before-correction ; ils ne sont pas utilisés comme preuve de la correction.

Le kit tourne comme sam_8 sous Ubuntu WSL, horloge Hyper-V MSR temporaire puis
restauration tsc/NTP observée. Les scénarios négatifs du kit produisent leurs FAIL
attendus ; sa sortie finale est KIT VALIDE/code0. Les suites produit sont exécutées
séparément. Aucun continuous.py natif Windows. La première passe kit avant correction
passait aussi141 tests en75,929s ; elle reste conservée, sans être substituée au
contrôle final.

## Couverture et provenance des preuves

AC-01 : transaction dossier/message/provenance/journal, rejeu concurrent identique,
clé réutilisée avec autre contenu refusée, rollback après panne du journal. Réelle
persistance après reload et redémarrage API, autre session lecteur, recherche,
filtres, pagination50 et file de20 dossiers avec position conservée au retour.
Les priorités utilisent des états SQL de reprise/réservation/accord/attente ; aucune
réservation n'est créée par la saisie. Les dernières réponses de l'ancienne cave
sont ignorées, et les données sont refusées côté serveur hors contexte.

AC-02 : origine explicite, identité/nom observé et horodatage serveur, message
interne conservé avec FK exactes incluant cave/dossier, termes de provenance et
journal immuables. Le client ne peut forger cave/acteur/état/référence dans le JSON.
Dates impossibles, formats invalides et budgets sans base sont refusés. Budget
groupé conservé comme tel, inconnus null, contenu HTML hostile rendu en texte.
Migrationv6→v7/replay et conservation de dossiers anciens sans provenance inventée ;
défaut historiquev3 inchangé.

AC-03 : erreurs serveur françaises près du champ et dans résumé focalisé ; valeurs
conservées, pas de succès en cas de refus. Panne SQL503 et réponse201 perdue après
commit distinguées dans les scénarios : la même commande peut vérifier le résultat.
Test de review R1 : la réponse perdue laisse un dossier réel, puis démotion reader,
refus403, restauration admin, reload et troisième requête avec la même clé ; un seul
dossier et une seule ligne de journal. Refus de sauvegarde, contexte/droits, origine,
CSRF, taille16Kio et erreurs de listes sont couverts.

AC-04 : UX-01/02/03/13/15/16/17 et §6. Liste/cartes, compte rendu source et dossier
dédié, cave/compte visibles, états vide/recherche vide/chargement/erreur/périmé,
formulaire invalide/sauvegarde en attente/échec/vérification refusée/succès/dialogue.
Largeurs320/390/768/1440, zoom réel200/400 avec captures de la zone visible sur toute
la hauteur, contrastes/styles effectifs et cibles44. Tab/Entrée/Échap, boucle du
dialogue, retour focus, saisie et soumission clavier sont observés. La review01 a
inspecté les37 captures de développement ; les captures corrigées et régressions
EA-05/06 sont rattachées au manifeste ux-captures.json pour examen en review02.
La recette corrigée ajoute l'état de vérification403 refusée conservant la commande.
Le manifeste regroupe84 PNG originaux : 36 régressions identité EA-05, 10 exports
EA-06 et38 captures manuelles EA-11. Les empreintes des109 fichiers examinables,
32 logs locaux et3 helpers correspondent au manifeste
`bfc6bf153debcf85f365735f902be4507fc4a3efdab99169ae481a6938d7e4c0`.

## Correction et limites

Review01 conservée ; un défaut R1 traité en correction1. Le test ajouté échoue
avant correction (`.agentic/ea11-recovery-before-correction.log`, code1 : bouton
de vérification disparu après403) puis passe après (`ea11-recovery-after-correction.log`,
1 test/code0). Le composant conserve désormais clé et contenu déjà incertains sur
tout4xx ; ce refus ne peut établir le résultat de la création initiale.

Les logs de développement conservent aussi les erreurs initiales : propriété
paramètre TypeScript incompatible avec strip-only, nom d'export/identité fictive,
statut409 de contexte attendu à tort403 et sélecteurs trop larges capturant
l'annonceur Next ou plusieurs statuts. Les nouveaux tests ont été corrigés ; aucun
ancien test n'est modifié, retiré ou affaibli. Les 10 tests backend ciblés passent,
et chaque nouveau parcours navigateur passe après ces corrections.

Le guide et ADR0012 décrivent limites : date civile souhaitée, responsable à
attribuer, historique borné, stockage de reprise par onglet/identité/cave,
comportement si ce stockage est interdit, route de création dédiée additive et
retour OIDC historique vers les paramètres. Aucune interface commerciale ni
qualification IA/fournisseur n'est déduite de ces écrans.

CI EA-10 : toutes suites présentes passent ; ensemble encore en échec pour
évaluations IA absentes, consigné dans sa livraison. IA non applicable à EA-11.
Une review pass et un commit publié ne prouvent ni CI verte ni production déployée.
