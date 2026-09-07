# language: fr
# SPECIFICATIONS NON EXÉCUTÉES : aucun runner ni step definition fourni ici.
# Référence : pack v1, règles §11 et §13 ; agent §14 ; contrats de réservation.
@specification @non_execute @critique @accord @a1
Fonctionnalité: ACCORD client et autorisation A1 liés à la version exacte
  Contexte:
    Étant donné la cave fictive "alpha" en mode A1
    Et un caviste authentifié habilité dans cette cave

  Scénario: L'accord client exige encore une autorisation du caviste
    Étant donné une proposition V1 approuvée puis envoyée au client
    Et un accord exact et non ambigu du client sur V1 toujours valable
    Quand le système enregistre cet accord
    Alors aucune réservation ni confirmation sortante n'est créée
    Quand le caviste clique sur "Réserver et confirmer" pour V1
    Alors le serveur vérifie l'accord et l'autorisation humaine postérieure à cet accord
    Et il revérifie les droits, les conditions et les ressources
    Et si tous les contrôles réussissent il planifie la réservation et sa synchronisation
    Et la confirmation reste conditionnée au succès connu des écritures nécessaires

  Scénario: Un accord sur une version remplacée ne réserve pas la suivante
    Étant donné une proposition V1 envoyée puis remplacée par V2 après changement de prix
    Quand le client accepte V1 depuis son ancien message
    Alors V2 n'est pas acceptée implicitement
    Et une commande de réservation utilisant cet accord est refusée côté serveur
    Et aucune allocation ni confirmation sortante n'est créée

  Scénario: Oui avec changement de participants est une nouvelle demande
    Étant donné une proposition V1 envoyée pour 8 personnes
    Quand le client répond "Oui, mais pour 20 personnes"
    Alors la réponse est traitée comme un changement commercial
    Et une nouvelle proposition doit être calculée et validée avant envoi
    Et aucun accord sur V1 ou sur une future V2 n'est déduit de cette réponse

  Scénario: La validation d'envoi ne vaut pas autorisation de réservation
    Étant donné une proposition V1 acceptée par le client
    Et seulement une validation humaine d'envoi antérieure à l'accord
    Quand un appel direct au serveur demande de réserver V1 sans autorisation postérieure à l'accord
    Alors la commande est refusée même si le navigateur masque normalement ce bouton
    Et aucune allocation ni action externe n'est créée
