#!/usr/bin/env python3
"""Provider adapter placeholder: never turn an absent deployer into success."""
import sys
print('DÉPLOIEMENT NON CONFIGURÉ : implémenter build, migrations, déploiement du commit testé, contrôle de santé et retour arrière selon docs/agentic/02-livraison-et-ci.md.',file=sys.stderr)
raise SystemExit(2)
