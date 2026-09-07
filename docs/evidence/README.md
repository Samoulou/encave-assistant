# Preuves de réalisation

Le contrôleur ajoute un rapport synthétique par ticket et exécution après les gates et la review. Les rapports indiquent le périmètre réellement vérifié et le commit livré. Les logs complets de commandes restent dans .agentic/runs (ignoré par Git) et ne doivent pas contenir de secrets ou données client.

Ce dossier est protégé pendant le travail des agents. Une attestation locale aide à la traçabilité ; elle n’est pas une signature de sécurité contre un administrateur ou un runner compromis. La CI doit réexécuter les contrôles sur le commit qu’elle envisage de livrer.
