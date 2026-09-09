# EA-10 — Contrat avant réalisation

Ouverture : 2026-09-09 11:54:01 UTC, exécution 1, échéance 13:54:01 UTC.
Maximum trois corrections, huit appels reviewer, 1 200 secondes/appel et
7 200 secondes/exécution. Base : `44e938eb2b16107df32be7acdb50feb3b3c18fdc`.
Dépendance EA-09 livrée, testée, review pass et SHA distant vérifié.
Lectures : AGENTS/START/protocole08, brief, EA-10, produit02 §12/13,
produit04 §20/21, contrats09, UX11/agendas/configuration, docs/design,
stratégie04 et DoR/DoD05. Sam délègue les choix réversibles ; aucune connexion
ou politique de calendrier de prospect n'est présumée.

## AC-01

Occupation incluant préparation/rangement.

Acceptation : ressources salle/équipe/équipement propres à la cave, configuration
versionnée par admin. Chaque version de catalogue reçoit un plan de ressources
versionné avec marges avant/après explicites en minutes entières. La durée vient
du catalogue approuvé pour une activité fixe ; une location variable exige sa
durée propre et ne reprend jamais celle d'une dégustation. Le serveur calcule
l'intervalle occupé [début moins préparation, fin plus rangement), en UTC.
Chaque ressource possède ses horaires, fermetures et fuseau. Les marges doivent
respecter aussi les horaires/fermetures, y compris lors d'un passage de minuit.

Les API de configuration, fermetures et prévisualisation sont authentifiées,
isolées par cave, version optimiste et idempotence pour les mutations. Les lecteurs
consultent ; admin configure ; opérateur/admin prévisualisent. Les plans et
anciennes configurations sont conservés. Les refus ne laissent aucune écriture
partielle. La prévisualisation ne crée ni allocation ni réservation ; EA-18/24
effectueront la disponibilité complète et l'allocation transactionnelle.

Tests positifs/négatifs purs et PostgreSQL/HTTP : minutes exactes, marges nulles,
bornes adjacentes sans chevauchement, conflit d'une marge seule avec fermeture,
horaires, changement de jour, ressources multiples et configuration incohérente.
E2E réel avec persistance/reload et refus de configurations étrangères.

## AC-02

Fuseaux et changements d’heure testés.

Acceptation : identifiant de fuseau IANA explicite par ressource, UTC pour les
instants persistés. Conversion stricte d'une heure locale : heure inexistante
refusée ; heure répétée refusée sans décalage explicite valide. Un décalage
incompatible avec le fuseau et la date est refusé. Durées et marges sont des
minutes écoulées réelles ; conserver fuseau et décalage dans la réponse explicative.
Horaires hebdomadaires développés seulement sur les jours occupés, horizon borné.
Une frontière horaire locale ambiguë/inexistante bloque la prévisualisation
automatique et demande correction de la configuration, sans ajustement silencieux.

Tests de passage été/hiver Europe/Zurich, deux occurrences de l'heure répétée,
heure supprimée, offset faux, UTC et autre fuseau IANA, minuit et bornes exclusives.
Utiliser la bibliothèque Temporal fixée et documenter la politique reject.
Sources fournisseur consultées avant emploi :
[Temporal ZonedDateTime](https://tc39.es/proposal-temporal/docs/zoneddatetime.html),
[ambiguïtés des fuseaux](https://tc39.es/proposal-temporal/docs/timezone.html),
[polyfill 0.5.1](https://github.com/js-temporal/temporal-polyfill/releases).

## AC-03

Source de vérité définie par ressource.

Acceptation : état inconnu explicite ou politique déclarée par le responsable :
agenda interne contrôlé, ressource Microsoft acceptant/refusant, calendrier externe
librement modifiable. Conserver sa description, acteur et version ; aucun état
« connecté » ou capability fournisseur ne peut être inventé. Une source inconnue
ou externe non qualifiée rend le résultat incomplet et bloque toute conclusion
de disponibilité automatique. La configuration interne ne garantit que les règles
internes examinées ; aucune exclusion avec les saisies Outlook indépendantes.

Une ressource désactivée, horaires inconnus, plan absent, configuration périmée
ou référence d'une autre cave donne un refus/état explicite. Prévisualisation
recharge versions, droits et données SQL ; aucune autorité de cave ou de source
fournisseur n'est acceptée depuis le JSON de prévisualisation. Le résultat nomme
les ressources et versions consultées, les motifs et le besoin de contrôle externe.

Tests PostgreSQL avec rôle réel, FK composites, mises à jour concurrentes,
refus admin/lecteur/cave, replay après changement de droits et panne de journal.
API/navigateur : configuration déclarée persistante, source inconnue ou Microsoft
sans capacité prouvée reste bloquée ; aucune réservation ni effet fournisseur.

## Choix et gates

Migration additive 006 ; cible explicite actuelle et API historique v3 préservée.
Versions immuables de ressource et de plan, commandes idempotentes et fermetures
datées. Horaires hebdomadaires explicites (unknown/always/weekly), créneaux locaux
sans chevauchement ni intervalle inversé, bornes techniques documentées. Une plage
de nuit se configure en deux plages de jours successifs. Limites initiales :
20 ressources/plan, 500 ressources/cave, horizon de calcul au plus 32 jours.

Maintenance par API dans ce ticket non requires_ux, aucune interface nouvelle.
Gates kit, unit, functional, business, E2E ; compilation, foundation/outillage et
runtime si affectés. Tests de navigateur avec sessions/DB/API réels, données
fictives. UX non applicable tant que l'interface ne change pas ; aucune IA/Microsoft
réelle. Review indépendante, preuves et livraison Git normale, puis prochain ticket.
