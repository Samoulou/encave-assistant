# ADR-0012 — Provenance et reprise de saisie manuelle

Date : 2026-09-09. EA-11, choix réversibles délégués par Sam.

La demande après appel doit survivre à un redémarrage et distinguer les mots du
visiteur, leur origine et la personne qui les consigne. Le nouveau parcours crée
un message interne et une provenance immuable dans la transaction du dossier.
Le nom observé de l'acteur vient de son identité serveur ; cave/acteur/état ne sont
jamais reçus comme autorité du formulaire. Les champs encore inconnus restent null.
Le budget CHF conserve sa base déclarée ; la date souhaitée reste civile.

Une route dédiée `/api/inquiries/manual` préserve le POST générique inexposé
par EA-07 et ses tests. La liste et le dossier enrichi sont additifs ; l'ancienne
lecture reste intacte. Migration007 et privilèges applicatifs explicites, API de
migration sans option toujoursv3. Aucune migration publiée ni ancien test modifié.

Après perte de réponse, changer la clé de création pourrait doubler le dossier.
Le navigateur conserve donc la même commande par identité/cave dans son stockage
de session et demande sa vérification avant édition. Ce choix permet la reprise
de l'onglet, sans prétendre sauvegarder tous les brouillons. Les limitations du
stockage désactivé et l'abandon d'une tentative incertaine sont documentés dans
le [guide](../development/manual-inquiries.md). Droits et cave sont relus à chaque
rejeu, même si une commande a déjà réussi.

Review01 a relevé que le refus d'une vérification pouvait effacer la clé incertaine.
Correction1 conserve cette clé et ses champs sur toute réponse4xx tant que le
résultat initial n'est pas connu. La régression échoue avant correction et vérifie
perte après commit, refus réel après retrait des droits, restauration et reprise
sans double dossier. Un refus de vérifier n'est pas un résultat de création.

La file calcule les priorités et compteurs à partir des dossiers/états réellement
persistés. « À réserver » est une invitation à examiner l'accord ; EA-11 n'expose
aucune commande d'engagement. Responsable à attribuer, analyse IA, propositions,
agenda et qualification fournisseur ne sont pas inventés pour remplir l'interface.
Le retour OIDC historique vers les paramètres reste compatible ; l'accueil et la
navigation donnent accès à la file. L'harmonisation de ce retour est une limite
explicite, sans changement du contrat déjà testé.

Recette : SQL réel, schémas/HTTP, atomicité/rejeu concurrent, redémarrage API,
perte de réponse après commit, données hostiles rendues comme texte, deux caves,
20 dossiers, conservation filtres/position, clavier, responsive/zoom et captures
revues indépendamment. Aucun envoi réel, modèle IA ou déploiement impliqué.
