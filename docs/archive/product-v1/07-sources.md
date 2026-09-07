# EnCave Assistant — documentation de référence

Version 1.0 · 7 septembre 2026

## 34 · Sources techniques et provenance

Sources primaires consultées le 7 septembre 2026. Les exigences de conception du dossier sont proposées ; les liens documentent les capacités et limites des fournisseurs.

**[S1]** [Microsoft — concepts Outlook Calendar](https://learn.microsoft.com/en-us/graph/outlook-calendar-concept-overview)

**[S2]** [Microsoft — référence des permissions Graph](https://learn.microsoft.com/en-us/graph/permissions-reference)

**[S3]** [Microsoft — notifications Outlook et ressources partagées](https://learn.microsoft.com/en-us/graph/outlook-change-notifications-overview)

**[S4]** [Microsoft — Exchange RBAC pour les applications](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac)

**[S5]** [Microsoft — abonnements et durées maximales](https://learn.microsoft.com/en-us/graph/api/resources/subscription?view=graph-rest-1.0)

**[S6]** [Microsoft — livraison des webhooks](https://learn.microsoft.com/en-us/graph/change-notifications-delivery-webhooks)

**[S7]** [Microsoft — delta des messages](https://learn.microsoft.com/en-us/graph/delta-query-messages)

**[S8]** [Microsoft — ressource event et transactionId](https://learn.microsoft.com/en-us/graph/api/resources/event?view=graph-rest-1.0)

**[S9]** [Microsoft — sendMail et 202 Accepted](https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0)

**[S10]** [PostgreSQL — plages et contraintes d’exclusion](https://www.postgresql.org/docs/current/rangetypes.html)

**Contexte métier :** échanges de Samuel avec Julien fournis dans la conversation. Aucun entretien complémentaire ni accès aux outils de Gilliard.

**POC :** lecture des sources et résultats de tests rapportés dans cette session. Les fonctionnalités de production décrites dans ce dossier restent à développer.

## 35 · Sources IA, données et compléments

Sources primaires consultées le 7 septembre 2026. Les exigences de conception du dossier sont proposées ; les liens documentent les capacités et limites des fournisseurs.

**[S11]** [OpenAI — Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)

**[S12]** [OpenAI — contrôles et conservation des données API](https://developers.openai.com/api/docs/guides/your-data)

**[S13]** [PFPDT — traitement des données dans le cloud](https://www.edoeb.admin.ch/fr/traitement-de-donnees-dans-un-nuage-informatique)

**[S14]** [PFPDT — externalisation et sous-traitance](https://www.edoeb.admin.ch/fr/externalisation-sous-traitance)

**[S15]** [PFPDT — IA et protection des données](https://www.edoeb.admin.ch/fr/ia-et-protection-des-donnees)

**[S16]** [EDPB — champ territorial du RGPD](https://www.edpb.europa.eu/documents/guideline/guidelines-32018-on-the-territorial-scope-of-the-gdpr-article-3-version-adopted_en)

**[S17]** [PostgreSQL — SELECT et SKIP LOCKED](https://www.postgresql.org/docs/current/sql-select.html)

**[S18]** [Microsoft — event:delta](https://learn.microsoft.com/en-us/graph/api/event-delta?view=graph-rest-1.0)

**[S19]** [Microsoft — limitations et Retry-After](https://learn.microsoft.com/en-us/graph/throttling)

**[S20]** [Microsoft — envoi depuis une autre boîte](https://learn.microsoft.com/en-us/graph/outlook-send-mail-from-other-user)

**Compléments du pack :** brief développeur, spécifications regroupées en Markdown, backlog structuré, contrats métier proposés, dictionnaire de données et roadmap. Les notes de recherche intermédiaires ne sont pas des engagements du fournisseur.

**Mise à jour :** revalider permissions, endpoints, rétention, régions et versions au moment d’implémenter. Ne pas transposer automatiquement une propriété d’un type de boîte ou calendrier à tous les autres.