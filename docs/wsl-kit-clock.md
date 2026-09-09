# Kit Python et horloge WSL sur ce poste Windows

2026-09-09 · Complément du [guide local](local-development.md).

Le kit exige POSIX pour ses tests de processus. Les tests inchangés ont aussi
détecté sur ce poste des reculs de l'horloge WSL Ubuntu 24.04, jusqu'à environ
6,68 secondes. Ils ont passé sous la mitigation temporaire ci-dessous, en
conservant le contrôle d'horodatage. Voir [la reprise EA-04](work/EA-04/execution-02-results.md)
pour les observations, limites et résultat réellement obtenu.

Cette procédure concerne ce défaut observé. Elle ajuste l'horloge de toute
l'instance Ubuntu pendant le contrôle ; elle ne change pas l'heure Windows,
ne fixe pas de timestamp et ne lance pas de campagne. NTP reste activé au
démarrage et les paramètres initiaux sont restaurés à la sortie du shell.
Aucune modification persistante de `.wslconfig` n'est nécessaire. La cause
sous-jacente et la persistance du défaut après un redémarrage restent inconnues.

Depuis PowerShell, ouvrir `wsl -d Ubuntu`. Dans cette même session WSL,
après avoir installé les dépendances Python verrouillées du kit dans son
environnement virtuel habituel, exécuter :

```bash
cd /mnt/c/tmp/encave-assistant/encave-assistant
(
  set -eu
  clock=/sys/devices/system/clocksource/clocksource0/current_clocksource
  initial_clock=$(cat "$clock")
  initial_ntp=$(systemctl is-active systemd-timesyncd.service || true)
  restore_clock() {
    printf '%s\n' "$initial_clock" | sudo tee "$clock" >/dev/null
    if [ "$initial_ntp" = active ]; then
      sudo systemctl start systemd-timesyncd.service
    fi
  }
  trap restore_clock EXIT
  sudo systemctl stop systemd-timesyncd.service
  printf '%s\n' hyperv_clocksource_msr | sudo tee "$clock" >/dev/null
  test "$(cat "$clock")" = hyperv_clocksource_msr
  python3 scripts/check_kit.py
)
```

`sudo` est limité aux deux réglages système et à leur restauration ; le kit
s'exécute comme l'utilisateur courant. Une interruption brutale de WSL peut
empêcher le `trap` ; vérifier alors la source courante et l'état du service avant
de réutiliser cette instance. Ne pas supprimer les contrôles du kit en cas d'échec.

Sur la session Codex observée, PyYAML Linux verrouillé était installé sous
`.agentic/runs/wsl-python` et transmis par `PYTHONPATH` ; le Python Windows de
`.venv` n'est pas un environnement virtuel Linux. La commande réelle et les
empreintes de son wrapper local figurent dans les preuves EA-04.

Canonical explique le conflit possible NTP/Hyper-V et le cas Ubuntu 24.04 :
[synchronisation WSL](https://ubuntu.com/wsl/docs/stable/explanation/time-sync/).
La [documentation Linux des horloges Hyper-V](https://cdn.kernel.org/doc/html/latest/virt/hyperv/clocks.html)
décrit les sources TSC et MSR. Le choix MSR ici est expérimental, issu des
observations locales ; ces sources ne garantissent pas cette solution sur tout poste.
