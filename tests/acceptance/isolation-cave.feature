# language: fr
# SPECIFICATIONS NON EXÉCUTÉES : tester avec le rôle serveur réel, pas un rôle DB propriétaire.
# Référence : pack v1, qualité §24 et §26 ; contrôles d'outils §14.
@specification @non_execute @critique @isolation
Fonctionnalité: Isoler les données et les effets entre caves
  Contexte:
    Étant donné deux caves fictives "alpha" et "beta" avec leurs propres demandes et connexions
    Et un utilisateur authentifié membre uniquement de "alpha"

  Scénario: Un identifiant connu ne donne pas accès à une autre cave
    Quand cet utilisateur demande par API le détail d'une demande de "beta"
    Alors le serveur refuse l'accès sans exposer le contenu ni l'existence de la demande
    Et changer le tenant fourni par le navigateur vers "beta" ne lui accorde aucun droit

  Scénario: Une référence croisée ne peut pas être enregistrée
    Quand le service avec son rôle DB réel tente de lier une proposition de "alpha" à une ressource de "beta"
    Alors les contrôles serveur et contraintes de référence empêchent cette association
    Et aucune réservation ni action externe n'est créée

  Scénario: Le worker ne choisit pas une connexion étrangère depuis le payload
    Étant donné une action d'outbox rattachée à "alpha"
    Quand son payload contient l'identifiant d'une connexion appartenant à "beta"
    Alors le worker refuse la référence étrangère
    Et aucun appel fournisseur n'utilise la connexion de "beta"
    Et une erreur exploitable est journalisée sans secret ni contenu de "beta"

  Scénario: Le navigateur ne conserve pas des droits révoqués
    Étant donné le détail d'une demande de "alpha" ouvert dans le navigateur
    Quand l'appartenance de cet utilisateur à "alpha" est révoquée
    Et qu'il recharge le détail puis tente une mutation depuis l'ancien écran
    Alors lecture et mutation sont refusées côté serveur
    Et aucune modification métier n'est enregistrée
