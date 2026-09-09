# EA-04 — Résultat de la deuxième exécution

2026-09-09, contrôle terminé avant 10:37 Europe/Zurich.
Base : `f5cc92c249370b51e773bea2ae704c0881a65968`.

La première tentative de l'exécution 2 a réussi : **141 tests, 69,212 secondes,
code 0**, sortie finale `KIT VALIDE`. Log complet local :
`.agentic/ea04-execution02-kit.log`.

Commande PowerShell réellement exécutée :

```powershell
wsl -d Ubuntu -u root -- python3 /mnt/c/tmp/encave-assistant/encave-assistant/.agentic/runs/ea04-controlled-kit.py
```

Le wrapper a arrêté temporairement `systemd-timesyncd`, sélectionné la source
`hyperv_clocksource_msr`, puis exécuté sans modification :

```bash
runuser -u sam_8 -- env PYTHONPATH=/mnt/c/tmp/encave-assistant/encave-assistant/.agentic/runs/wsl-python python3 /mnt/c/tmp/encave-assistant/encave-assistant/scripts/check_kit.py
```

Le kit s'est exécuté comme l'utilisateur WSL habituel. Le log confirme la source
MSR après le kit et la restauration de `tsc` et du service NTP actif en sortie.
Aucun timestamp de test, ancien test, script protégé ou instruction modifié.
Aucune campagne réelle et aucun Codex CLI imbriqué lancé. Les lignes de refus
produit imprimées par les tests négatifs font partie des cas vérifiés ; elles ne
signifient pas que les suites produit de l'application auraient été exécutées.

Les 26 empreintes (13 fichiers et 13 logs) du manifeste de la première exécution
ont été recomparées avec succès. Aucun code EA-04 n'a changé entre cette review
et la nouvelle gate. Les 19 tests d'outillage, la fondation avec SQL natif réel,
Chromium technique et les contrats workflow restent donc les preuves sources
décrites dans [les résultats initiaux](results.md).

Budget consommé de cette reprise au moment de la review : une tentative de kit,
zéro correction source, un appel de reviewer. L'exécution 1 conserve ses trois
passages de kit et son verdict bloqué. Les conditions et bornes ont été déclarées
dans [execution-02.md](execution-02.md) avant le nouveau contrôle. Le guide
[WSL](../../wsl-kit-clock.md) permet de reproduire la mitigation temporaire ; elle
n'est pas une correction permanente du système.

Les quatre AC restent ceux du contrat initial. Review de reprise et manifeste
séparés ; aucune attestation de contrôleur créée. Le succès local du kit ne
prouve ni la CI du diff, ni Docker réel sur le runner, ni une production déployée.
Les suites produit/IA/UX encore absentes restent en échec explicite.
