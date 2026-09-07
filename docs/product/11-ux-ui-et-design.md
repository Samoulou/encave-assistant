# UX/UI — référence de conception d’EnCave Assistant

Version 1.0 · 7 septembre 2026 · Spécification à implémenter

## 1. État de l’analyse et autorité

Le dossier décrivait déjà les utilisateurs, les écrans principaux, les états métier et le parcours OAuth. Il ne contenait pas de système visuel, de maquettes de référence, ni de critères de recette UX suffisamment précis. Le POC est une démonstration de parcours avec données fictives ; il ne prouve ni l’utilisabilité en exploitation ni le fonctionnement des intégrations.

Ce document apporte une analyse de conception fondée sur les besoins et risques connus : hiérarchie des tâches, contenu des écrans, prévention des erreurs, états de reprise, accessibilité et style. Les trois [maquettes SVG](../design/README.md) sont des concepts statiques ; elles ne représentent pas des fonctions déjà développées. Aucun entretien UX, test d’utilisabilité avec cavistes ou audit d’accessibilité de l’application de production n’est déclaré réalisé.

Sam détient les décisions produit et design. Les agents peuvent implémenter cette référence, effectuer des choix de mise en page réversibles et les faire relire sans attendre Julien ou un autre prospect. Les retours utilisateurs ultérieurs enrichissent le backlog ; ils ne sont pas un veto sur le développement. La validation commerciale A1 par chaque cave demeure une action dans le produit.

Cette référence complète les [règles métier](02-cas-usage-et-regles.md) et les [connecteurs](10-connecteurs-et-onboarding.md). Elle ne remplace aucun contrôle serveur. Les textes d’état décrivent des observations établies, pas des conclusions générées librement par le modèle.

## 2. Utilisateurs, tâches et décisions UX

| Utilisateur | Tâche principale | Décision de conception |
|---|---|---|
| Sam, propriétaire du produit | Choisir le périmètre et vérifier les preuves de livraison | Suivi du développement dans le dépôt ; aucun tableau de bord de développement imposé aux caves. Aucun accès implicite de Sam aux dossiers clients. |
| Administrateur d’une cave | Configurer offres, équipe et connexions | Onboarding progressif, droits explicites, contrôle de santé par connexion ; une petite cave peut commencer sans Microsoft. |
| Opérateur œnotouristique | Répondre correctement, autoriser une réservation, reprendre une erreur | File de travail avec prochaine action, dossier sourcé et boutons liés à un état et une version exacts. |
| Petite cave, une seule personne | Traiter quelques demandes entre deux accueils | Vue compacte sur téléphone, une offre et une ressource au démarrage, peu de paramètres obligatoires. |
| Client visiteur | Expliquer son besoin, comprendre et accepter une offre | Formulaire et e-mail aux couleurs de la cave, lien sécurisé sans compte, distinction claire entre accord et réservation confirmée. |

L’accueil est une **file de demandes à traiter**. Le bénéfice se voit dans les informations préparées, les étapes accomplies et les exceptions compréhensibles. Un éventuel dialogue avec l’IA complète le dossier ; aucune tâche critique n’exige de connaître une commande de chat. Les libellés restent métier : « Information manquante », « Proposition à valider », « Accord reçu », « Envoi à vérifier ».

## 3. Navigation et structure

Navigation principale : **Demandes**, **Agenda**, **Catalogue**, **Connexions**, **Paramètres**. Les incidents sont accessibles depuis un filtre « À reprendre » et un indicateur de connexion, sans créer une deuxième boîte de travail concurrente. L’historique est dans chaque dossier ; les diagnostics techniques sont accessibles seulement aux rôles autorisés.

L’en-tête expose en permanence le nom de la cave active et le compte connecté. Un membre d’une seule cave voit son nom sans sélecteur inutile. Un membre de plusieurs caves peut changer de contexte ; les caches, listes, brouillons et commandes doivent rester cloisonnés. Un formulaire non enregistré provoque une proposition de sauvegarde ou d’abandon avant le changement. Un retour OAuth appartient toujours à la tentative serveur initiale, même si un autre onglet a changé de cave.

Sur ordinateur, une navigation latérale et un contenu principal permettent d’ouvrir un dossier depuis la file. Le dossier sépare les échanges et les faits de la proposition et de ses actions. Sur téléphone, il devient une page dédiée : résumé, prochaine action, proposition, informations, échanges et historique, avec liens de section. Les actions essentielles ne sont pas cachées dans un menu à points.

## 4. Contrat des écrans

### 4.1 Demandes et saisie manuelle

Chaque ligne ou carte affiche client, besoin, canal, date souhaitée si connue, nombre de participants si connu, responsable, prochaine action et ancienneté. Les dates inconnues sont écrites « Date à préciser » ; aucun tiret ne signifie implicitement « disponible ». Le tri par défaut place les actions nécessitant une intervention en premier, puis l’échéance métier lorsqu’elle existe, puis l’ancienneté. Ce tri est déterministe et modifiable. Les compteurs proviennent des données réelles.

Filtres : à traiter, attente client, à réserver, à reprendre, réservées, archivées. Recherche par données auxquelles le membre a accès. La liste conserve filtres et position après retour d’un dossier. « Nouvelle demande » ouvre nom, moyen de réponse, besoin, origine ; date, participants et budget sont facultatifs à la saisie et deviennent des questions de qualification si nécessaires.

État vide initial : expliquer comment créer une demande ou installer le formulaire. Recherche vide : proposer d’effacer les filtres. Chargement : libellé accessible et structure réservée, sans afficher de faux dossiers. Erreur : conserver les filtres et proposer de recharger. Une sauvegarde échouée conserve les champs ; « Enregistré » apparaît après confirmation du serveur seulement.

### 4.2 Dossier et travail de l’IA

Le résumé indique le besoin et la prochaine action. Chaque fait extrait expose valeur, statut (« Extrait », « Corrigé par… », « À préciser ») et accès à son message source. Une information contradictoire affiche les deux formulations utiles. L’interface n’affiche pas un pourcentage de confiance arbitraire comme justification d’un engagement.

L’IA en cours d’analyse laisse les messages consultables. En échec, « Renseigner manuellement » et une relance bornée restent accessibles selon les droits. Une relance ne doit pas créer une deuxième demande. Un doublon probable propose un aperçu et une fusion autorisée ; rien n’est fusionné sur le seul nom. Les messages externes sont rendus comme contenu, jamais comme commandes d’administration.

### 4.3 Proposition et validation du caviste

Le panneau de proposition montre : numéro de version, activité et version du catalogue, date complète, heure de début et de fin, fuseau, participants, ressource, durée avec marges dans le détail, prix unitaire, quantités, total CHF, règle de taxes, conditions et échéance de validité. La source et l’heure de vérification de disponibilité sont lisibles. Une offre envoyée ne bloque pas le créneau dans le périmètre initial ; le texte le précise.

Le contenu commercial du message est rendu depuis les mêmes données structurées que la proposition. « Modifier la proposition » ouvre ces champs ; une version déjà approuvée produit une nouvelle version. Une correction de formulation ne peut modifier discrètement un montant, un horaire ou une condition. Le résumé des changements met en évidence ce qui devra être approuvé et accepté à nouveau.

Le parcours d’approbation présente la version exacte et le destinataire. Les étapes « Valider cette version » et « Envoyer la proposition » sont explicitement identifiables ; si un bouton combiné est retenu, son libellé annonce les deux effets et le serveur les trace séparément. « Envoi en cours » ne devient pas « Reçue par le client ». Un rôle sans droit de validation voit la raison et l’action de transfert.

### 4.4 Accord, réservation et erreurs concurrentes

Après accord, afficher la version acceptée, la date, la preuve et les conditions. **« Réserver et confirmer »** n’est proposé comme action exécutable qu’au caviste habilité, sur l’offre courante et admissible. Le récapitulatif exact et les préconditions sont visibles avant le clic. Désactiver un bouton est une aide UX ; le serveur recontrôle droits, cave, version et disponibilité.

Si un accord vise la version 1 alors que la version 2 l’a remplacée : « Cet accord concerne une ancienne proposition. Faites accepter la version actuelle. » Conserver l’historique, proposer d’ouvrir la version concernée et de préparer la bonne offre. Aucun acquiescement automatique, ni bouton de contournement.

Si un second opérateur a modifié le dossier : « Ce dossier a changé. Actualisez pour examiner la nouvelle version. » Conserver les modifications locales dans un état récupérable sans écraser la version serveur. En conflit de réservation : « Ce créneau vient d’être pris. Recherchez une autre disponibilité. » Ne pas montrer de réservation réussie au perdant et ne pas envoyer sa confirmation. Le double clic et la reprise après rechargement retrouvent la même opération durable.

### 4.5 Agenda, réservation et reprise

L’agenda offre une vue par jour/semaine et par ressource, plus une liste équivalente au clavier et sur téléphone. Les indisponibilités et marges sont consultables ; une erreur de synchronisation n’affiche pas un agenda artificiellement libre. Un glisser-déposer éventuel n’est jamais le seul moyen de modifier une date et ne peut contourner une nouvelle proposition requise.

Le dossier de réservation distingue trois informations : allocation interne, synchronisation du calendrier, confirmation au client. Exemples : « Ressource réservée », « Calendrier en cours de synchronisation », « Confirmation en attente ». Si le fournisseur accepte un envoi sans preuve de remise, afficher « Envoi accepté par le service de messagerie — réception non vérifiée ». Le libellé global ne masque aucun état incertain.

L’écran de reprise expose impact métier, dernière action certaine, tentative en cours, responsable et prochaine action possible. « Vérifier le résultat » est utilisé pour un effet incertain ; « Réessayer » ne doit pas provoquer un second envoi aveugle. L’opérateur voit l’impact d’une déconnexion ou suspension avant de l’appliquer. Les identifiants techniques sûrs sont relégués au diagnostic ; aucun jeton n’est affiché.

### 4.6 Catalogue, locations et événements

Le catalogue sépare activités réservables à prix défini, locations sur devis et événements d’information. Un tarif, une capacité ou une durée manquants apparaissent comme une configuration à compléter, sans valeur inventée. Les champs indiquent unité, devise et règle d’application. Publier une nouvelle version conserve les propositions antérieures.

Pour une location limitée à la qualification, l’action est « Transmettre au responsable » ; aucun bouton n’insinue qu’une réservation a eu lieu. Si le lot devis est livré, le détail montre durée variable, équipements, conditions et vérification des prérequis avant réservation. Pour un événement externe, l’action est « Ouvrir la billetterie officielle », avec destination reconnaissable et information approuvée ; pas de faux compteur de places.

### 4.7 Connexions et onboarding générique

Chaque connexion affiche fournisseur, compte/organisation autorisés, boîte et calendrier sélectionnés, capacités prouvées, dernière synchronisation, problèmes et action de reprise. « Connecté à Microsoft » ne signifie pas « Lecture, envoi et réservation vérifiés » : ces capacités ont chacune leur état.

Le parcours suit le [contrat d’onboarding](10-connecteurs-et-onboarding.md) : choisir le profil, comprendre les droits, se connecter chez Microsoft, sélectionner les ressources autorisées, vérifier, activer. Aucun champ ne demande un jeton ou un mot de passe Microsoft. Le nom de la cave cible est présent avant et après redirection. Une autre organisation détectée lors d’une reconnexion exige un remappage explicite.

Un refus de consentement permet de revenir au mode interne. Une autorisation administrateur manquante donne un message compréhensible et la procédure nécessaire au client ; elle ne bloque pas les autres caves. Une connexion révoquée bloque ses seuls effets dépendants et conserve les dossiers. L’onboarding petite cave ne demande pas de connexion Microsoft obligatoire : cave, offre, ressource, calendrier et canal de réponse autorisé suffisent au profil concerné.

### 4.8 Formulaire et page d’accord du visiteur

L’en-tête présente la cave qui recevra la demande. Le formulaire utilise des libellés visibles, décrit ce qui est facultatif et indique le moyen de réponse. Le succès signifie « Demande reçue », avec référence, et non « Réservation confirmée ». Le client peut retrouver son besoin en cas d’erreur sans ressaisie complète.

La page d’accord montre la version, les termes, l’expiration et le contact de la cave. L’action **« Accepter cette proposition »** explique qu’une confirmation de réservation suivra après validation du caviste. Une demande de changement repart en qualification. La page d’une proposition expirée ou remplacée interdit l’accord opérant et invite à contacter la cave ; elle ne dévoile pas automatiquement une autre proposition au porteur d’un ancien lien. Un lien invalide ne révèle ni l’existence ni les données d’un autre dossier.

L’identité visuelle de la cave peut personnaliser nom et logo. Les couleurs doivent respecter les mêmes contraintes de lisibilité ; une couleur de marque inadéquate conserve les couleurs fonctionnelles du produit. Le parcours ne renvoie pas vers la marketplace EnCave et ne crée pas de compte visiteur.

## 5. Système visuel et composants

La référence adopte un fond pierre clair, des surfaces blanches et un bordeaux profond pour l’action principale. Elle vise une lecture calme d’informations opérationnelles, avec peu de décoration. Elle est indépendante de la palette orange de la marketplace et n’en importe aucun composant d’exécution. Les [tokens JSON](../design/design-tokens.json) fixent couleurs, typographie système, espacements, rayons, tailles et focus ; ce fichier est une convention du dépôt, sans dépendance à un framework de tokens.

| Usage | Valeurs | Contraste calculé |
|---|---|---|
| Texte / surface | `#272326` / `#FFFFFF` | 15,50:1 |
| Texte secondaire / surface | `#655B62` / `#FFFFFF` | 6,51:1 |
| Action principale | `#FFFFFF` / `#6E2944` | 10,18:1 |
| Succès | `#176442` / `#EAF5EE` | 6,40:1 |
| Attention | `#7C4A00` / `#FFF2D6` | 6,67:1 |
| Erreur | `#A42336` / `#FCECEF` | 6,40:1 |
| Focus / surface | `#005FCC` / `#FFFFFF` | 5,98:1 |
| Bordure de champ / surface | `#877A80` / `#FFFFFF` | 4,10:1 |

Les 15 combinaisons enregistrées dans le JSON ont été calculées avec la luminance relative sRGB et comparées sans arrondi aux seuils indiqués. Cela valide ces paires de couleurs seulement. Un rendu avec transparence, un fond différent ou une personnalisation nécessite un nouveau contrôle. La bordure décorative `#DDD5D7` sert uniquement aux séparations non essentielles, jamais comme seul contour d’un champ.

Composants à construire avec leurs états : shell et navigation ; bouton principal/secondaire/destructif ; champ avec aide et erreur ; sélection ; date/heure avec saisie clavier ; carte de demande ; badge textuel ; bandeau d’état ; panneau de faits sourcés ; récapitulatif versionné ; chronologie ; carte de connexion/capacité ; dialogue ; liste et tableau ; état vide ; chargement et échec. Les variantes montrent toujours les états normal, focus, attente, désactivé justifié et erreur lorsqu’ils s’appliquent.

Police système, corps 16 px et interligne 1,5 ; labels 14 px, titre de page 28 px. Les petites légendes 12 px ne portent pas seules une information commerciale critique. Espacements par pas de 4 px ; hauteur de commande minimale 44 px ; cartes de rayon 12 px. Les transitions visuelles sont courtes et supprimables avec la préférence de réduction des animations.

## 6. Responsive et accessibilité

Cible de conception : parcours conformes aux exigences applicables WCAG 2.2 niveau AA. Il s’agit d’un objectif de recette, pas d’une déclaration de conformité acquise.

- Texte courant : contraste minimal 4,5:1. Le produit conserve cette cible aussi pour ses textes de grande taille, même lorsque le minimum WCAG permet 3:1. [W3C — contraste du texte](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
- Les contours et états visuels nécessaires à l’identification des contrôles présentent au moins 3:1 avec les couleurs adjacentes ; les statuts utilisent texte et, si utile, icône. [W3C — contraste non textuel](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).
- À 320 px CSS de largeur, les formulaires, dossiers et pages publiques restent lisibles sans défilement horizontal global. La vue agenda propose une liste réorganisée. Tester également le zoom navigateur à 200 % et l’équivalent de 400 % sur une fenêtre de 1280 px. [W3C — redistribution du contenu](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).
- Les commandes du produit visent une zone de 44 × 44 px. C’est un choix de confort supérieur au seuil de 24 × 24 px, avec exceptions, du critère AA ; ne pas présenter 44 px comme le minimum universel WCAG AA. [W3C — taille minimale des cibles](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).
- Tout parcours critique est réalisable au clavier. Prévoir lien d’évitement, ordre logique, nom accessible et focus visible de 3 px avec espace de séparation. La barre d’action ne doit pas recouvrir l’élément ayant le focus. [W3C — clavier](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html), [W3C — focus non masqué](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html).
- Les dialogues possèdent titre, focus initial adapté, boucle de focus et retour au déclencheur ; Échap ferme une étape non engagée sans annuler fictivement une opération déjà envoyée au serveur. [W3C — modèle de dialogue](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).
- Une erreur est décrite près du champ et dans un résumé lié après soumission ; les valeurs saisies restent présentes. Les messages de résultat sont annoncés sans déplacement de focus inutile, avec urgence adaptée. [W3C — identification des erreurs](https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html), [W3C — messages d’état](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html).

La revue visuelle et les outils automatiques doivent être complétés par des vérifications clavier et de structure accessible. Un scanner sans anomalie ne constitue pas un audit complet ni une preuve d’utilisabilité auprès de personnes handicapées.

## 7. Critères UX définis avant implémentation

Ces IDs complètent les critères métier, sans les remplacer. Les tickets concernés reprennent les références applicables avant leur développement. Les preuves indiquées sont **à produire** ; leur présence dans ce tableau n’est pas une exécution.

| ID | Critère observable | Tickets concernés et preuve attendue |
|---|---|---|
| UX-01 | La cave active reste visible ; changer de cave vide les données du contexte précédent et une URL, commande ou réponse tardive de l’autre cave n’en révèle aucun contenu. | EA-05, EA-06 ; E2E avec deux caves et plusieurs onglets, plus refus serveur. |
| UX-02 | Une file de 20 demandes fictives expose la prochaine action, applique le tri défini et retrouve filtres/position après un aller-retour. Les cas initial vide, recherche vide et échec sont distincts. | EA-11, EA-28 ; assertions DOM et captures des états. |
| UX-03 | Une demande manuelle persiste après rechargement ; un refus de sauvegarde conserve les valeurs et indique l’erreur sans annoncer de succès. | EA-11 ; E2E serveur et panne contrôlée. |
| UX-04 | Une valeur extraite renvoie à sa source ; une contradiction ou information absente reste signalée et corrigeable, sans confiance inventée ni engagement automatique. | EA-17, EA-18 ; E2E sur fixtures et évaluations IA applicables. |
| UX-05 | L’aperçu approuvé, le rendu envoyé et le récapitulatif de réservation portent le même identifiant de version et les mêmes termes ; modifier un prix approuvé crée une nouvelle version. | EA-19, EA-20, EA-21 ; test métier et comparaison DOM/contenu persisté. |
| UX-06 | Un accord sur une version remplacée montre son motif et ne permet aucune réservation, même par appel direct ; aucune acceptation implicite de la nouvelle version. | EA-22, EA-24 ; E2E ancien lien et commande refusée. |
| UX-07 | Deux sessions concurrentes sur une ressource exclusive donnent une réussite maximum ; le perdant voit le conflit et aucune confirmation de son dossier n’est envoyée. | EA-24, EA-26 ; test concurrent en base et deux contextes navigateur. |
| UX-08 | Allocation, synchronisation et envoi ont des états distincts ; un résultat incertain propose une vérification et le rechargement ne déclenche pas un effet en double. | EA-25, EA-26, EA-27, EA-28 ; E2E avec interruption et réconciliation simulée explicitement. |
| UX-09 | Deux caves configurent leurs connexions depuis le même parcours, sans code propre au client ; annulation, droits insuffisants, autre compte et révocation sont expliqués sans affecter l’autre cave. | EA-13, EA-38 ; contrats simulés et parcours E2E ; qualification réelle Microsoft distincte. |
| UX-10 | Une cave sans Microsoft peut terminer le profil interne ; le canal sortant absent reste explicitement non actif et aucun écran n’annonce un e-mail réellement envoyé. | EA-31, EA-38 ; E2E du profil interne. |
| UX-11 | Le visiteur soumet une demande et accepte une version sans compte ; les textes différencient demande reçue, accord reçu et réservation confirmée ; un lien invalide ne divulgue rien. | EA-12, EA-22, EA-26 ; E2E mobile et assertions serveur. |
| UX-12 | La location en qualification expose une reprise humaine ; l’événement externe expose un lien officiel et aucun achat ou stock fictif. Le lot devis affiche ses conditions bloquantes. | EA-29, EA-30 ; E2E de chacun des trois types d’offre. |
| UX-13 | Les parcours principaux restent utilisables à 320, 390, 768 et 1440 px de largeur, à zoom 200 % et reflow équivalent 400 %, sans chevauchement ni perte d’action/contenu. | Tous tickets d’écran ; assertions de débordement et captures réelles. |
| UX-14 | Au clavier seul, l’opérateur ouvre, corrige et approuve une proposition, gère le dialogue et retrouve son focus ; le client peut remplir et accepter. Aucun piège de focus ni action essentielle inaccessible. | EA-12, EA-19, EA-20, EA-22, EA-38 ; test navigateur Tab/Entrée/Échap et revue indépendante. |
| UX-15 | Une soumission invalide expose un résumé et une erreur associée au champ, conserve les valeurs et annonce le résultat ; les chargements et succès possèdent un statut accessible. | EA-11, EA-12, EA-13, EA-38 ; assertions arbre accessible et E2E. |
| UX-16 | Les couleurs rendues passent 4,5:1 pour le texte et 3:1 pour les éléments non textuels nécessaires ; les contrôles visés ont une cible 44 × 44 px et un focus visible. | Fondation visuelle et tickets d’écran ; calculs sur styles effectifs et revue des exceptions documentées. |
| UX-17 | Chaque écran livré possède captures d’états normal, vide, chargement, erreur et périmé quand applicable, associées au commit testé. Le reviewer inspecte les captures et le parcours réel ; aucune capture ne remplace le test métier. | Tickets d’écran, EA-39 ; artefacts de navigateur, résultat de review et matrice des états couverts. |
| UX-18 | L’onboarding présente les étapes restantes et peut reprendre après rechargement. Un administrateur d’une seconde cave termine la configuration disponible avec ses seules données, sans modifier le dépôt ni attendre un prospect. | EA-38, EA-39 ; E2E deux caves, fixtures identifiées, qualification fournisseur séparée. |

Pour un écran modifié, rattacher les critères applicables aux suites fonctionnelles et E2E déjà prévues. Le choix d’un runner navigateur et d’un outil d’analyse d’accessibilité doit être verrouillé dans l’ADR technique. Les tests visuels utilisent des données fictives et une horloge maîtrisée ; tout changement de référence fait l’objet d’une review, jamais d’une acceptation automatique destinée à effacer un échec.

Conserver dans la preuve du ticket : viewport, scénario, état serveur pertinent, capture, résultat de test et observation du reviewer. Les captures publiques masquent les données privées et ne contiennent pas de secrets ni de jetons d’acceptation. Les résultats d’un test utilisateur ultérieur resteront séparés de cette recette technique ; aucun taux de compréhension ou gain de temps n’est annoncé avant mesure.

## 8. Ordre de réalisation

1. Lire cette référence et retenir les composants/tokens dans la formalisation de la fondation UI, sans créer une longue série d’écrans fictifs.
2. Construire shell, composants accessibles et galerie d’états de développement ; prouver leur rendu et leur navigation clavier.
3. Livrer la première tranche verticale : cave authentifiée, demande manuelle persistante, liste, dossier et erreurs.
4. Ajouter proposition versionnée, accord et réservation avec les contrôles métier ; tester les erreurs avant d’étendre les écrans.
5. Compléter connexions, agenda, reprise et onboarding par cave, puis effectuer la recette transversale des 18 critères.

Les choix de design réversibles se décident dans le ticket et sont contrôlés par une review indépendante. Aucun retour de Julien n’est requis pour cette chaîne. La livraison d’un périmètre reste conditionnée aux preuves réelles de ce périmètre et à la politique configurée par Sam.
