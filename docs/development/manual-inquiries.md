# Saisie manuelle et file de demandes — EA-11

`/demandes` présente la file de la cave authentifiée. Un opérateur ou administrateur
peut saisir le besoin après un échange, puis ouvrir son dossier. Les lecteurs
consultent seulement. La route historique `/espace` conserve les paramètres et
le retour OIDC existant ; sa navigation ouvre les demandes. Le lien d'accueil
ouvre maintenant cette file. Agenda/catalogue/connexions ne sont pas simulés dans
la navigation. L'harmonisation du retour après connexion reste une étape explicite.

## Saisie et provenance

Nom, moyen de réponse (au moins e-mail ou téléphone), besoin, origine et compte
rendu sont obligatoires. L'origine est téléphone, en personne ou autre saisie
manuelle. Le serveur fixe le canal manual, l'identifiant, la référence, l'état
received, l'acteur vérifié et son nom observé, ainsi que la date d'enregistrement.
Le compte rendu est un message interne ; il ne prétend pas être un e-mail reçu.

Date souhaitée, participants et budget restent facultatifs. La date est déclarée
sans heure, validée comme date civile et jamais interprétée en disponibilité.
Le budget est en unités mineures CHF, avec base groupe/personne obligatoire
lorsqu'il est renseigné. Un budget nul est explicite. Aucun prix, engagement,
réservation ou envoi ne découle de ces valeurs. Les textes externes s'affichent
comme texte React, sans interprétation HTML ou instructions.

La transaction de cave crée dossier, message, provenance et commande ensemble.
`inquiry_intakes` conserve le lien au message exact, l'acteur et les faits déclarés.
Ses FK incluent la cave ; ses termes et le journal sont immuables, également
sous le propriétaire SQL. Les droits applicatifs n'autorisent que SELECT/INSERT
sur ces deux tables. L'acteur n'est pas supposé être le responsable du dossier :
ce dernier apparaît « À attribuer » jusqu'au parcours d'affectation.

Les dossiers historiques sans cette provenance restent consultables. Ils affichent
les limites de leur provenance et ne reçoivent pas rétroactivement un acteur ou
des faits inventés. Un ancien message « manual » peut être entrant selon sa source
historique ; les nouveaux comptes rendus de ce parcours sont internes.

## API et reprise

| Route | Résultat |
|---|---|
| POST /api/inquiries/manual | Création admin/opérateur, origine/CSRF et clé UUID Idempotency-Key obligatoires |
| GET /api/inquiries | File isolée, q/filter/sort/page, page de50 éléments |
| GET /api/inquiries/{id}/dossier | Résumé, faits, messages et transitions de la demande |
| GET /api/inquiries/{id} | Lecture EA-07 conservée, sans modification de son contrat |

La création a une route dédiée additive : POST générique `/api/inquiries` reste
inexposé, conformément au contrat et aux tests historiques EA-07. C'est une décision
de routage ; aucune exigence de création manuelle n'est retirée. Les anciens tests
ne sont pas modifiés. La migration007 est additive et se sélectionne explicitement
avec `migrateDatabase(ownerPool,{targetVersion:7})` ; le défaut historique restev3.

Une commande est liée à l'acteur, la cave et l'empreinte canonique de ses champs
validés. Un rejeu identique renvoie le même dossier ; une charge différente donne409.
Les droits et la cave active sont relus avant le rejeu. Une panne de journal annule
toutes les écritures. Aucun appel fournisseur n'est exécuté dans cette transaction.

Dans le navigateur, les champs restent présents après refus. Une réponse réseau
perdue ou503 conserve la commande exacte et bloque son édition jusqu'à vérification.
« Vérifier l’enregistrement » rejoue sa clé, sans double création. L'état en attente
est conservé dans sessionStorage, isolé par identité et cave, pour reprendre après
rechargement de cet onglet. Il contient les champs de la saisie ; ce stockage local
éphémère disparaît à la fermeture de l'onglet. Aucune donnée n'est mise dans l'URL
hors identifiant opaque de dossier. Si le navigateur interdit le stockage, la
reprise reste possible dans la page ouverte ; après fermeture/reload, vérifier la
liste avant toute nouvelle saisie. Il ne s'agit pas d'une sauvegarde distante de
brouillons non soumis.

Un refus ultérieur de vérification (session, cave, droits ou autre4xx) ne prouve
pas l'échec de la création initiale. La commande déjà incertaine reste donc intacte
et non éditable. Après restauration des droits, sa même clé retrouve le dossier.
Cette règle est couverte par une perte de réponse après commit suivie d'un403 réel,
restauration, rechargement et reprise : un seul dossier et une seule commande.

Après abandon d'une commande incertaine, ouvrir une nouvelle saisie dans la même
cave reprend sa vérification. Une simple saisie non soumise est effacée après
abandon confirmé. Le changement de cave invalide les réponses en vol et les données
affichées ; les tentatives conservées restent propres à leur contexte. Une session
ou un accès périmé donne un état explicite. Aucun succès ne précède la réponse serveur.

## Liste et dossier

Les catégories proviennent de l'état courant : archivage, reprise d'action incertaine/
échouée ou réservation à rapprocher, réservation confirmée, proposition acceptée,
attente client, puis demande à traiter. Une catégorie « À réserver » invite à
examiner l'accord ; elle n'autorise aucune réservation et ne remplace pas les gardes
commerciaux futurs. Le tri par défaut ordonne reprise, accord à examiner, traitement,
attente, réservées, archivées ; date souhaitée connue puis ancienneté/id départagent.
Les tris ancien/récent sont proposés. Compteurs et recherche viennent de SQL ;
la recherche traite `%` comme texte, sans pouvoir élargir la cave.

Les filtres et la position se conservent dans l'onglet par identité/cave lors du
retour au dossier. Les états vide initial, recherche sans résultat, chargement et
erreur sont distincts. Sur téléphone, cartes et dossier dédié gardent les actions
visibles. Le dossier donne prochaine action, faits déclarés et accès au compte
rendu source, échanges et historique. Les dates d'enregistrement sont affichées
avec Europe/Zurich explicite ; la date souhaitée est une date civile sans fuseau.

Limites techniques initiales : nom160, e-mail254, téléphone40 caractères/6–20
chiffres, besoin240, compte rendu4000 caractères, requête16Kio, recherche120,
participants1–100000, budget0–1000000000 unités mineures, 50 résultats/page,
200 premiers messages et200 premières transitions avec avertissement si tronqués.
Les bornes de taille et le schéma sont des protections techniques, pas une règle
commerciale ou une disponibilité inventée. Aucune édition de proposition ou action
d'IA n'est ajoutée dans cette tranche.

## Vérification UX

Tokens pierre/blanc/bordeaux, corps16, cibles44, contours contrastés et focus3px.
Contrôles aux largeurs320/390/768/1440 ; zoom réel Chromium200/400 avec captures
successives de la zone visible. Résumé d'erreurs lié et focalisé, libellés/aides,
statuts, dialogue natif avec boucle Tab/Échap/retour du focus. Les captures de
`.local/ux/EA-11/` et leurs mesures proviennent de PostgreSQL/API/Next/Chromium
réels avec identités fictives. Pannes de transport et de journal sont nommées.
Leur review indépendante complète les tests ; aucun audit utilisateur ou label
de conformité générale WCAG n'est déduit de cette recette.
