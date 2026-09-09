# ADR-0011 — Ressources, plans et temps local

2026-09-09, EA-10. Choix techniques réversibles délégués par Sam, dépendance EA-09
livrée `44e938eb2b16107df32be7acdb50feb3b3c18fdc`.

Les configurations de ressources et les plans associés à une version de catalogue
sont immuables et versionnés. L'ancre du plan donne le fuseau de l'heure de début ;
toutes les ressources partagent l'instant UTC résultant. Durée réelle et marges
forment des intervalles demi-ouverts. Les fermetures persistent en UTC avec la
saisie locale et les offsets ; leur annulation conserve les termes d'origine.

Temporal polyfill 0.5.1 est fixé, avec refus explicite des heures invalides,
répétées non précisées et offsets incohérents. Le Node 24 choisi n'expose pas
Temporal natif ; ICU et tzdata effectifs sont consignés avec les preuves. Les
horaires sont développés sur un horizon borné et une frontière locale ambiguë
reste bloquante jusqu'à correction de la configuration.

La source de vérité est une politique déclarée par ressource et cave. Un
connecteur Microsoft absent/non qualifié ne peut devenir une disponibilité
vérifiée. L'aperçu vérifie seulement les règles configurées et garde toute
autorisation de réservation à false ; les allocations et effets externes restent
leurs tickets. La politique contrôlée interne ne protège pas les écritures Outlook.

Les FK incluent cave et objets ; l'ancre doit appartenir au plan au commit.
La liste des ressources est déclarée dans l'en-tête immuable et sa complétude
est vérifiée au commit ; aucune ligne ne peut ensuite élargir un ancien plan.
Une ressource sans configuration provoque une erreur explicite au lieu d'être
omise d'un calcul partiel. Les commandes sont atomiques et idempotentes ; elles
relisent les droits et compteurs. API de maintenance initiale, sans nouvelle UI.
Contrats, limites et migration 006 : [guide ressources](../development/resources.md).
