# language: fr
# SPECIFICATIONS NON EXÉCUTÉES : à relier à une vraie DB de test et aux services métier.
# Référence : pack v1, règles §12 ; qualité §26 ; contrats transaction/outbox.
@specification @non_execute @critique @concurrence
Fonctionnalité: Allouer les ressources exclusives sans double engagement interne
  Scénario: Cent commandes concurrentes ne gagnent pas le même créneau
    Étant donné une salle et une équipe exclusives libres dans la cave fictive "alpha"
    Et 100 propositions distinctes et valables nécessitant ces deux ressources sur le même intervalle
    Et pour chacune un accord exact et une autorisation A1 du caviste après accord
    Quand 100 commandes distinctes démarrent via des connexions DB distinctes à une barrière commune
    Alors une seule commande obtient l'allocation active des deux ressources
    Et les 99 autres reçoivent un conflit métier sans allocation active
    Et une seule intention durable de synchronisation est créée

  Scénario: Un conflit sur la seconde ressource annule toute allocation du perdant
    Étant donné une salle libre et une équipe déjà occupée
    Quand une réservation exige simultanément cette salle et cette équipe
    Alors la transaction est refusée pour conflit
    Et aucune allocation de salle ni action d'outbox ne subsiste pour cette réservation

  Scénario: Les marges font partie des intervalles demi-ouverts
    Étant donné une occupation de salle de 13:30 à 16:30 incluant préparation et rangement
    Quand une autre réservation demande une occupation commençant à 16:15
    Alors elle est refusée pour chevauchement
    Quand elle demande une occupation commençant à 16:30 sans autre conflit
    Alors la borne commune ne crée pas de chevauchement

  Scénario: Une modification Outlook indépendante reste un conflit à traiter
    Étant donné une allocation interne et une écriture Outlook en cours
    Quand une occupation manuelle incompatible est détectée lors du rapprochement externe
    Alors la réservation passe en reprise visible sans confirmation client
    Et toute alternative commerciale nécessite une nouvelle proposition et un nouvel accord
    Et le résultat n'est pas décrit comme une garantie d'exclusion atomique avec Outlook
