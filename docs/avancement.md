# Avancement — GP Party

Dernière mise à jour : 22 septembre 2026.

Étapes 1A (fondations) et 1B (identité visuelle) en place. Le plateau, les mini-jeux et les activités ne sont pas commencés.

## Fait

- Un seul processus, un seul port : Express, Socket.IO et Vite en développement ; le build est servi par `npm start`.
- Écoute sur `0.0.0.0`. Au démarrage, le terminal affiche les URL TV, joueur et hôte avec l'IP locale. Les cartes virtuelles (vEthernet, WSL, Hyper-V, VirtualBox, VMware, VPN) sont écartées. `ipForcee` dans `config/partie.json` prend le dessus. La page hôte montre l'IP retenue et les autres candidates.
- QR code local sur `GET /qr/joueur.svg` (paquet `qrcode`, aucune API externe).
- État de partie : joueurs, journal de GP, événements (300 derniers), vues par rôle. Le jeton et le code hôte ne sortent dans aucune vue.
- Transactions masquées visibles uniquement chez l'hôte, y compris pour le joueur concerné, et exclues des soldes publics jusqu'à la révélation.
- Annulation en mémoire (50 instantanés). `version` et les identifiants d'événements ne reculent pas.
- Sauvegarde atomique de `data/etat.json`, copie horodatée toutes les 5 minutes (30 fichiers). Au démarrage, fusion avec l'état par défaut ; si le fichier est illisible, dernière sauvegarde valide.
- Présence (en ligne, latence, décalage d'horloge) hors état annulable et hors sauvegarde. Ping toutes les 5 secondes.
- Pages `/`, `/tv`, `/joueur`, `/hote`, avec ou sans slash final. Reconnexion infinie, rechargement si le serveur a redémarré, reprise de place validée par l'hôte.
- Bundles legacy (Chrome 38, Safari 9) et polyfills pour `/tv`. La Freebox charge les bundles modernes : `renderModernChunks` reste activé.
- `client/public/diag.html` en ES5, résultat enregistré dans `data/diagnostic-tv.json` et affiché chez l'hôte.
- Identité visuelle : tapis, tuiles carton, encre, pièces d'or, polices Titan One et Baloo 2 (Fontsource, en local). Compteur de GP à rouleaux sur la télé, le téléphone et l'hôte.
- Télé : accueil (QR, places, retournement à l'inscription, confettis) et scores (couronne sur le ou les premiers, étoile de gain, rouleaux). Les joueurs restent dans l'ordre d'arrivée sur la télé, le téléphone et l'hôte ; le rang se met à jour sans déplacer les tuiles. Les animations passent par une file, une à la fois. Le mode animations réduites enlève les confettis et raccourcit les séquences en fondus.
- Téléphone : fond tapis avant l'inscription, puis fond à la couleur du joueur. Vibration courte sur un gain si le navigateur le permet.
- Hôte : fond encre, tuiles compactes, toast après chaque action, volume de la télé. L'ajustement de GP demande un montant et, au besoin, la case Masqué. Le volume est une donnée d'exécution (message `reglerVolume`), hors sauvegarde et hors annulation.
- Sons optionnels dans `client/public/assets/sons/`. Noms réservés : `rejoindre`, `gain`, `transition`, et pour plus tard `de`, `revelation`, `buzzer`, `victoire`, `tictac`. Le lecteur prend le MP3, sinon l'OGG du même nom, et ignore un fichier absent. Avatars PNG optionnels dans `client/public/assets/avatars/` (le nom du fichier, sans extension, est l'identifiant). Sans PNG, pastilles avec initiale.
- Tests Vitest : réducteur, règle d'or, vues, persistance, détection d'IP.

## Actions et événements

Actions joueur : `rejoindre`, `demanderReprise`.

Actions hôte : `ajouterGP`, `revelerMasquees`, `renommerJoueur`, `retirerJoueur`, `validerReprise`, `refuserReprise`, `verrouillerInscriptions`, `choisirEcranTv`, `basculerAnimationsReduites`, `basculerDiagnosticTv`, `annuler`, `reinitialiserPartie`, `ajouterJoueursFictifs` (développement seulement).

Événements : `joueur.rejoint`, `joueur.renomme`, `joueur.retire`, `gp.ajoutes` (public ou hôte si masqué), `gp.reveles` (un événement public par joueur concerné), `reprise.demandee` (hôte), `reprise.validee` (public), `reprise.refusee` (joueur concerné et hôte), `inscriptions`, `ecran`, `animations`, `diagnostic` (hôte), `partie.reinitialisee`.

## Comment tester

```bat
npm install
npm test
npm run dev
```

Puis, depuis le PC : `http://127.0.0.1:3000/`, `/tv`, `/joueur`, `/hote`. Depuis un téléphone du même Wi-Fi, les URL affichées au démarrage.

Parcours utile : un joueur s'inscrit et sa tuile se retourne sur l'accueil de la télé ; l'hôte ajoute des GP visibles puis des GP masqués ; seuls les GP visibles s'affichent sur la télé et le téléphone ; sur les scores, un gain enchaîne l'étoile puis les rouleaux, et les tuiles restent à leur place. Trois gains rapides se jouent l'un après l'autre. « Révéler les GP masqués » joue un gain par joueur. « Réduire les animations » supprime les confettis et raccourcit les séquences. « Annuler » restaure l'action dont le libellé était affiché sur le bouton. Recharger `/joueur` retrouve la place, fond de la couleur du joueur. `/joueur?profil=1` et `/joueur?profil=2` sont deux joueurs. Arrêter puis relancer le serveur conserve `data/etat.json` ; les pages se reconnectent. Pour la télé, `npm run build` puis `npm start` (ou `lancer-soiree.bat`), pas le mode développement. Pour entendre un son, déposer par exemple `rejoindre.mp3` dans `client/public/assets/sons/` puis reconstruire.

## Diagnostic TV

Fait sur la télé de la soirée, une Freebox Player POP (Android 10). Moteur : Chrome 151.0. 50 images par seconde. Reçu le 22 septembre 2026.

Tout est pris en charge : ES2015, ES2020, Proxy, Promise, fetch, WebSocket, grille CSS, flex gap, variables CSS, transforms 3D, woff2, plein écran. L'audio MP3 et l'audio OGG passent, y compris une lecture sans appui.

Les contraintes CSS provisoires sont levées. Grille, `gap`, variables et transforms 3D sont utilisables sur cette télé. Les animations restent limitées à `transform` et `opacity`, pour la fluidité. Les bundles modernes suffisent ; les bundles legacy restent dans le build au cas où.

Format audio retenu : MP3 en priorité, OGG en repli si seul le fichier OGG est présent. Les deux formats marchent sur cette Freebox.

## Limites connues

- Pas de plateau, de mini-jeu ni d'activité. L'état est prévu pour s'étendre (`schema`, fusion au chargement).
- Aucun PNG d'avatar ni fichier son n'est fourni pour l'instant. Les pastilles et le silence sont le comportement prévu tant que les dossiers `client/public/assets/` sont vides.
- Le volume de la télé repart à 80 % à chaque démarrage du serveur.
- La pile d'annulation est en mémoire : un redémarrage la vide. La sauvegarde, elle, reste.
- Une demande de reprise en cours perd le lien avec le téléphone au redémarrage. Le téléphone peut renvoyer la demande.
- Le code hôte par défaut est `change-moi`. À changer avant la soirée.
- « Ajouter 4 joueurs fictifs » n'existe qu'avec `npm run dev`.
- Une adresse lien-local `169.254.x.x` peut apparaître dans les autres IP. Elle n'est pas retenue s'il existe une adresse `192.168`, `10.` ou `172.16–31`.

## À discuter

- Qui choisit le mini-jeu à chaque tour (hypothèse : le premier dans l'ordre de passage).
- Liste des ~10 mini-jeux et contenu du Jeopardy.
- Pénalité ou non au Jeopardy (hypothèse : aucune).
- Barème d'Undercover et des missions secrètes.
- Défi final.
- Boutique du tour : oui ou non (secondaire, après le reste).
- Valeurs exactes des cases et longueur du plateau (piste : 32 à 35 cases, mise max 10 GP).
