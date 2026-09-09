# Ressources et occupation — EA-10

La cave configure ses salles, équipes et équipements avec un fuseau, des horaires
et une source de vérité explicites. Un administrateur crée des versions immuables,
active/désactive les ressources et enregistre ou annule des fermetures. Les
opérateurs prévisualisent les intervalles ; les lecteurs consultent la configuration.
Cette tranche expose des API persistantes. Aucune interface d'agenda n'est prétendue
livrée ; sa réalisation suivra UX11 dans les tickets concernés.

## Versions et plans

Une ressource démarre désactivée, avec sa première configuration et un compteur
optimiste 1. Une révision crée un nouvel instantané ; activation et fermetures
augmentent aussi le compteur afin d'invalider les anciennes prévisualisations.
Les versions précédentes restent consultables, 50 par page.

Une version exacte du catalogue reçoit un plan de 1 à 20 ressources. Chaque ligne
contient des marges de préparation/rangement en minutes entières, y compris zéro.
Le plan possède un numéro et un identifiant propres ; chaque modification crée
un plan et des lignes immuables. L'ancre du plan doit appartenir à ses ressources.
Le fuseau actuel de cette ancre interprète l'heure locale de début ; toutes les
ressources occupent ensuite le même instant UTC, affiché dans leur propre fuseau.

La durée d'une activité fixe vient de sa version approuvée du catalogue. Un
appelant ne peut la remplacer. Une location sur devis demande une durée explicite
pour ce calcul technique ; elle ne prend jamais la durée d'une dégustation.
Un événement d'information n'utilise pas cette prévisualisation de réservation.

Les intervalles sont demi-ouverts : `[début − préparation, fin + rangement)`.
Une fermeture commençant exactement à la fin occupée ne chevauche pas la visite.
Une fermeture durant la seule préparation bloque la fenêtre. Les heures d'ouverture
doivent couvrir toutes les marges, même si elles passent au jour précédent/suivant.

## Fuseaux, horaires et fermetures

Le contrat demande un nom géographique IANA (par exemple Europe/Zurich ou
America/New_York), un nom Etc/* accepté par le runtime, ou UTC ; aucun simple
décalage fixe ne remplace ce fuseau. Les heures saisies utilisent
`YYYY-MM-DDTHH:mm`, avec offset explicite ou null.

Temporal utilise `overflow: reject`, `disambiguation: reject`, `offset: reject`.
Une heure supprimée au printemps est refusée. Une heure répétée en automne exige
le décalage valide choisi par l'appelant ; les deux occurrences à Zurich diffèrent
d'une heure réelle. Un décalage incompatible avec le fuseau/date est refusé.
Durée et marges sont des minutes écoulées, pas un déplacement naïf de l'horloge locale.
La réponse conserve UTC, heure locale, fuseau et décalage de chaque borne.

Horaires : `unknown` bloque, `always` autorise la fenêtre interne entière,
`weekly` contient les plages par jour ISO (lundi 1, dimanche 7). Des plages adjacentes
peuvent se toucher, sans chevauchement. Une nuit se représente par deux plages
de jours successifs ; `24:00` est accepté uniquement comme fin. Une semaine vide
en mode weekly est explicitement fermée. Le calcul développe les seuls jours
occupés sur au plus 32 jours écoulés, avec une borne de 34 dates locales.
Une borne d'ouverture ambiguë/inexistante renvoie
`ambiguous_hours_configuration` et impose une correction, sans choix silencieux.

Les fermetures sont saisies dans le fuseau de la ressource courante, converties
en UTC puis conservées avec le fuseau, les heures/décalages d'origine, motif et
acteur. Changer ensuite le fuseau ne déplace pas les fermetures existantes.
Annuler garde cette preuve et ajoute acteur/date ; aucune suppression d'historique.

Temporal est fixé à `@js-temporal/polyfill` 0.5.1, car Temporal natif est absent
du Node 24.19.0 installé. Le runtime observé utilise ICU 78.3 et tzdata 2026b.
Les mises à jour du runtime/fuseaux doivent repasser ces tests ; la persistance
UTC et des offsets permet de relire le choix déjà enregistré.
Sources : [ZonedDateTime](https://tc39.es/proposal-temporal/docs/zoneddatetime.html),
[ambiguïtés temporelles](https://tc39.es/proposal-temporal/docs/timezone.html),
[polyfill fixé](https://github.com/js-temporal/temporal-polyfill/releases/tag/v0.5.1).

## Source de vérité et portée du résultat

Chaque version déclare `unknown`, `internal_controlled`, `microsoft_resource` ou
`external_uncontrolled`, avec description de la politique ou null. L'acteur et
la date de configuration sont conservés. Cette déclaration ne prouve aucune
connexion ni capacité chez Microsoft.

Une source inconnue ou sans politique bloque. Les deux catégories externes
renvoient `external_verification_required` jusqu'à leur qualification dans les
connecteurs. La déclaration d'un agenda interne contrôlé ne garantit que les
règles internes effectivement consultées ; elle ne verrouille aucune saisie
indépendante dans Outlook.

`rulesSatisfied` indique uniquement la couverture des horaires, marges, fermetures,
activation et politique de source consultées. Toute réponse garde
`availabilityVerified: false` et `bookingAllowed: false`. Aucun prix, occupation
externe, allocation concurrente ou disponibilité complète n'est déduit de cet
aperçu. EA-18/24 devront compléter ces vérifications et réserver en transaction.
Une location peut donc prévisualiser ses marges avant d'avoir son devis ; ce n'est
pas une offre automatique et le garde catalogue EA-09 reste obligatoire pour celle-ci.

## API et intégrité

Session vérifiée et `X-EnCave-Cave` pour chaque route ; origine et CSRF pour POST.
Les mutations admin portent une clé UUID `Idempotency-Key` : même acteur/cave/clé/
charge donne le même résultat historique, autre charge donne 409. Les droits sont
relus avant tout replay ; consulter ensuite la ressource pour son état actuel.

| Route | Forme / résultat |
|---|---|
| POST /api/resources | `{definition}` : ressource et première configuration |
| POST /api/resources/{id}/versions | `{expectedVersion,definition}` : nouvelle configuration |
| POST /api/resources/{id}/enable | `{expectedVersion,enabled}` : activation explicite |
| POST /api/resources/{id}/closures | `{expectedVersion,startLocal,endLocal,startOffset,endOffset,reason}` |
| POST /api/resources/{id}/closures/{closureId}/cancel | `{expectedVersion}` : annulation conservant l'histoire |
| GET /api/resources | Ressources et configuration actuelle |
| GET /api/resources/{id}?before=N | Configurations paginées et fermetures actives |
| POST /api/catalog/versions/{versionId}/resources | `{expectedVersion,anchorResourceId,rules}` ; 0 attend l'absence d'un premier plan |
| GET /api/catalog/versions/{versionId}/resources | Plan actuel et versions des ressources |
| POST /api/catalog/versions/{versionId}/occupation | `{expectedPlanVersion,expectedResources,startLocal,startOffset,durationMinutes}` |

Les règles contiennent resourceId/beforeMinutes/afterMinutes. expectedResources
contient exactement les id/version des ressources du plan. durationMinutes est
null pour une activité fixe, obligatoire pour une durée variable. Le serveur
recharge toutes ces références dans sa transaction de cave : ancienne version
de plan, activation ou fermeture changée donne `409/configuration_changed`.
Une ressource sans configuration ne disparaît jamais silencieusement du calcul.

Définitions fermées dans `packages/contracts/src/resources.ts`. Limites initiales :
500 ressources/cave, 10 000 configurations/ressource ou plans/version de catalogue,
42 plages/semaine, 20 ressources/plan, durée 1–43 200 minutes, marges 0–1 440 minutes,
500 fermetures actives/ressource, chaque fermeture ≤366 jours. Ce sont des bornes
techniques évolutives ; elles ne constituent pas une règle commerciale inventée.

La migration 006 ajoute des FK composites par cave, notamment l'appartenance de
l'ancre aux lignes du plan vérifiée au commit. Le login applicatif ne peut réécrire
ou supprimer les versions/plans/commandes. Les triggers protègent ces historiques
aussi contre une mise à jour directe du propriétaire. La fermeture autorise sa
seule annulation ; ses termes restent immuables. Une panne de journal annule
configuration, lignes, pointeur courant et résultat de commande ensemble.

La composition du plan est déclarée dans son en-tête immuable. Un trigger refuse
toute ligne dont la ressource n'appartient pas à cette liste ; un contrôle différé
exige au commit toutes les lignes déclarées. Leurs clés uniques empêchent ensuite
un ajout tardif, même après remplacement du plan. Une liste avec doublons ou une
composition incomplète ne peut être validée. La régression de review échoue avant
cette correction puis passe sous le login applicatif réel.
[Déclencheurs différés PostgreSQL 17](https://www.postgresql.org/docs/17/sql-createtrigger.html).

Migration autorisée : `migrateDatabase(ownerPool,{targetVersion:6})`. La cible
historique sans option reste v3. Les migrations seules ne créent aucune donnée
de démonstration. [Contrat et preuves EA-10](../work/EA-10/contract.md).
