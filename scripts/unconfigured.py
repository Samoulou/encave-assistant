"""A missing product suite must fail visibly; this is not a test."""
import sys
gate = sys.argv[1] if len(sys.argv) > 1 else "unknown"
print(f"NON CONFIGURE : suite {gate}. Implémenter le runner et les tests réels avant livraison.", file=sys.stderr)
raise SystemExit(2)
