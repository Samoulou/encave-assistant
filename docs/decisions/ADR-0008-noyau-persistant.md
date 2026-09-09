# ADR-0008 — Noyau persistant des dossiers

2026-09-09. Retenu sous la délégation technique de Sam, ticket EA-07.

La migration 003 ajoute les objets relationnels du dossier au schéma tenant
existant, sans modifier 001/002 et sans installer de données de démonstration.
Les références sont composites par cave et, pour les engagements, par dossier,
version et empreinte des termes. Un accord ou une autorisation ne peut ainsi
référencer silencieusement une version commerciale différente.

Les instantanés sont hachés par PostgreSQL et figés dès leur sortie de draft.
Un marqueur irréversible conserve cette protection même si le statut change.
Les statuts restent distincts pour demande, proposition, réservation et action ;
les transitions et droits complets sont EA-08, les commandes d’engagement EA-19+
et les tâches externes EA-23+. Aucune réservation réelle n’est autorisée par le
chargement de données synthétiques.

Le runner SQL utilise des transactions par migration et un verrou de session.
Les fixtures utilisent une capacité liée à la base isolée possédée par l’outillage,
distincte du runtime applicatif. Un endpoint authentifié de lecture rend la
persistance et les refus inter-caves observables dans un vrai navigateur ; la
création utilisateur et son interface restent EA-11.

Les preuves comprennent reprise/relecture après redémarrage de l’API, mise à niveau
conservant les anciennes données, rollback SQL et droits du login applicatif réel.
Cette décision ne qualifie aucune production, intégration Microsoft ou donnée réelle.
Voir le [guide du noyau](../development/case-core.md).
