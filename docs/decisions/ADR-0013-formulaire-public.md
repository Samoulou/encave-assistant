# ADR-0013 — Réception publique liée à la configuration de la cave

Décision réversible de développement EA-12, sous l’autorité produit de Sam.
La cave connecte son site par un lien vers un formulaire hébergé. L’API admin
versionne cette configuration ; le serveur associe son identifiant public à la cave.
Cette option satisfait l’endpoint et l’intégration légère du ticket sans présumer
de l’accès à un site de prospect. L’iframe reste interdite ; une intégration embarquée
future nécessitera sa politique d’origine et sa qualification propres.

Nous retenons des quotas PostgreSQL globaux par formulaire, un challenge aléatoire
à usage unique, un délai minimal et un honeypot. Les valeurs sont bornées et
configurables. Ce socle ne constitue pas une qualification anti-bot universelle.
La réponse après commit est l’accusé de réception de cette tranche. Aucun prestataire
de messagerie n’étant configuré, aucun envoi ou accusé e-mail n’est annoncé.

Le rejeu retrouve la réception persistée avant les contrôles de péremption ; un
refus intermédiaire ne suffit pas à abandonner une commande incertaine. La saisie
et l’enveloppe restent liées à l’onglet et au formulaire. Les détails, limites,
contrats et parcours de reprise sont dans le guide public-forms et les preuves EA-12.
La configuration graphique et la qualification d’un environnement réel appartiennent
respectivement aux tickets EA-38 et EA-40, sans conditionner le code indépendant.
