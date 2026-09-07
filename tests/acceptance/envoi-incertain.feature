# language: fr
# SPECIFICATIONS NON EXÉCUTÉES : simuler les pannes explicitement ; M365 réel exige un périmètre autorisé.
# Référence : pack v1, intégrations §17 ; qualité §26 et runbook §27.
@specification @non_execute @critique @reprise
Fonctionnalité: Rendre les résultats d'envoi incertains visibles et récupérables
  Contexte:
    Étant donné une confirmation fictive autorisée en A1 après accord exact
    Et les conditions métier satisfaites et les écritures calendrier nécessaires connues comme réussies
    Et une intention d'envoi persistée avec son identité et son destinataire de test

  Scénario: Une réponse perdue ne justifie pas un renvoi aveugle
    Quand le fournisseur reçoit l'envoi mais que sa réponse réseau est perdue
    Alors l'action passe à "résultat incertain"
    Et le navigateur affiche cet état et une prochaine action de réconciliation
    Et aucun message n'est annoncé reçu ou livré
    Et le worker ne réémet pas aveuglément la même confirmation

  Scénario: Une acceptation fournisseur ne prouve pas la réception client
    Quand le fournisseur retourne HTTP 202 pour l'envoi
    Alors le suivi indique "envoi accepté par le fournisseur"
    Et il n'affirme ni livraison ni lecture par le client

  Scénario: Un redémarrage conserve l'incertitude et les limites de reprise
    Étant donné une action d'envoi au résultat incertain
    Quand le worker redémarre puis épuise la réconciliation bornée sans preuve fournisseur
    Alors l'action reste sans succès confirmé
    Et une reprise humaine est attribuée avec contexte et tentatives
    Et aucune nouvelle tentative d'envoi n'est déduite du seul redémarrage

  Scénario: Une restauration ne rejoue pas un envoi déjà effectué
    Étant donné une sauvegarde antérieure à un envoi et une preuve fournisseur de cet envoi
    Quand la sauvegarde est restaurée dans l'environnement de test
    Alors les nouveaux effets restent suspendus jusqu'au rapprochement
    Et l'action déjà effectuée est identifiée avant reprise des workers
    Et la reprise ne produit pas un second envoi
