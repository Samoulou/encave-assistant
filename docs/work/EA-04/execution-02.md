# EA-04 — Reprise bornée de validation

Ouverture : 2026-09-09 à 10:34 Europe/Zurich. Base inchangée :
`f5cc92c249370b51e773bea2ae704c0881a65968`.

La première exécution reste close et bloquée : trois passages du kit, une
correction source, une review indépendante bloquée. Son contrat, ses résultats,
son manifeste et sa review sont conservés. Cette reprise ne les transforme pas
en succès et ne remet aucun compteur historique à zéro.

## Condition de reprise observée

Le diagnostic initial a établi des reculs de l'horloge WSL. Les essais séparés
(arrêt NTP seul, affinité CPU, sources Hyper-V seules) n'ont pas apporté de
stabilité durable. Une première observation de 30 secondes avec
`hyperv_clocksource_msr` et NTP arrêté n'a vu aucun recul. La vérification
suivante a retrouvé `tsc` et le service actif : ces réglages sont temporaires.
La raison du retour aux paramètres initiaux n'est pas établie.

Une nouvelle observation contrôlée applique les deux réglages dans **la même
session WSL**, conserve l'identifiant de démarrage et restaure l'état initial
en sortie. Ses deux fenêtres consécutives de 30 secondes ont observé respectivement
6 172 562 et 6 153 557 allers-retours JSON, **zéro recul** ; la source MSR est
restée active. Le service était arrêté. Log local :
`.agentic/runs/ea04-clock-controlled-pair.log` ; sonde :
`.agentic/runs/ea04-clock-controlled-probe.py`.
Ce résultat permet un essai contrôlé du kit ; il ne garantit pas l'absence de
tout défaut d'horloge futur ni la cause exacte des échecs antérieurs.

Canonical décrit les conflits possibles entre NTP Ubuntu et la synchronisation
implicite Hyper-V et recommande de désactiver le service sur Ubuntu 24.04 lorsque
cette synchronisation suffit : [documentation Ubuntu WSL](https://ubuntu.com/wsl/docs/stable/explanation/time-sync/).
Le noyau distingue les lectures TSC, page partagée et MSR ; l'accès MSR passe par
l'hyperviseur : [documentation Linux](https://cdn.kernel.org/doc/html/latest/virt/hyperv/clocks.html).
Le choix MSR est une mitigation locale expérimentale, pas une recommandation
générale du fournisseur. Aucun timestamp n'est fixé, aucune synchronisation
Hyper-V ni protection du kit n'est désactivée.

## Budget et protocole déclarés avant le nouveau contrôle

Exécution **2 sur 3** : application des limites de reprise du kit documentées dans
`docs/agentic/09-campagne-autonome.md` et `.agentic/policy.json`, au protocole direct
de `docs/agentic/08-tache-codex.md`. La mission continue autorise cette reprise
après changement vérifié de l'environnement. Aucun runner de campagne réel n'est
lancé et aucun état du contrôleur n'est fabriqué.

- Maximum de cette exécution : trois tentatives, huit appels d'agents,
  1 200 secondes par appel, 7 200 secondes au total ; échéance 12:34 Europe/Zurich.
- Première tentative prévue : **un** passage du kit intégral inchangé, sous le
  réglage MSR + arrêt temporaire NTP ; lancement du kit avec l'utilisateur WSL
  habituel `sam_8`, restauration garantie des réglages d'origine en sortie.
- Aucun nouveau changement d'implémentation EA-04 prévu. Les 19 tests d'outillage,
  le SQL local réel, Chromium et le contrat workflow déjà exécutés restent les
  preuves de ces mêmes sources ; leurs empreintes doivent être vérifiées.
- Une nouvelle review indépendante examine les preuves et les quatre AC.
- En cas de nouvel échec d'horloge, arrêter cette reprise et conserver le blocage,
  sans répétition identique destinée à obtenir du vert.

Le résultat du kit, ses empreintes et le verdict de reprise seront consignés
séparément. Jusqu'à leur succès, EA-04 reste bloqué et EA-05 n'est pas développé.
