# EA-04 — Observation de l'horloge WSL

2026-09-09, après les trois passages du kit, sans nouvelle exécution de gate et
sans modification d'horloge, de contrôleur ou de test.

Une sonde Python de 8 secondes (durée bornée par `time.monotonic`) exécute :
`start = time.time()`, un aller-retour JSON de ce nombre, puis `now = time.time()`.
Elle compte les cas où la valeur enregistrée dépasse l'heure courante. Code local
`.agentic/runs/ea04-clock-probe.py`, résultat `.agentic/runs/ea04-clock-probe.log`.

Résultat réellement observé sous WSL Ubuntu : 4 282 839 échantillons, **deux reculs**,
recul maximal **6,676810264587402 secondes**, code 0 de la sonde. Cette observation
n'est pas un test du kit réussi. Aucun secret ni donnée client n'est traité.

Elle démontre une horloge système instable pendant cette observation et fournit
une explication compatible avec les refus `started_at <= time.time()` du contrôleur.
Elle ne prouve pas la cause de chaque échec antérieur ni la cause sous-jacente des
reculs. Le contrôle ne doit pas être supprimé, les timestamps de test ne doivent pas
être réécrits et les erreurs ne doivent pas être masquées.

EA-04 reste bloqué. Prochaine condition de reprise : disposer d'un environnement
POSIX dont l'horloge reste stable, puis reprendre explicitement la validation dans
un budget tracé. Aucun quatrième passage du kit réalisé dans cette exécution.
