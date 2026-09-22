# Avancement — GP Party

Dernière mise à jour : 22 septembre 2026.

Étape 1A (fondations) en place. L'identité visuelle (1B), le plateau, les mini-jeux et les activités ne sont pas commencés.

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
- Bundles legacy (Chrome 38, Safari 9) et polyfills pour `/tv`. `renderModernChunks` reste activé tant que la télé réelle n'a pas été testée.
- `client/public/diag.html` en ES5, résultat enregistré dans `data/diagnostic-tv.json` et affiché chez l'hôte.
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

Parcours utile : un joueur s'inscrit et apparaît sur la télé et chez l'hôte ; l'hôte ajoute des GP visibles puis des GP masqués ; seuls les GP visibles s'affichent sur la télé et le téléphone ; « Révéler les GP masqués » les rend publics ; « Annuler » restaure l'action dont le libellé était affiché sur le bouton. Recharger `/joueur` retrouve la place. `/joueur?profil=1` et `/joueur?profil=2` sont deux joueurs. Arrêter puis relancer le serveur conserve `data/etat.json` ; les pages se reconnectent. Pour la télé, `npm run build` puis `npm start` (ou `lancer-soiree.bat`), pas le mode développement.

## Diagnostic TV

Pas encore fait sur la télé de la soirée. Les contraintes CSS de la télé restent en vigueur : pas de grille, pas de `gap`, pas de `filter` ni `backdrop-filter`, pas d'emoji, scène 1920×1080.

La page `/diag.html` a été ouverte dans le navigateur de développement (Chrome 144). Tous les tests sont passés, y compris woff2, flex gap, grille, audio et plein écran. Ce résultat n'autorise pas à lever les contraintes : il faut le refaire sur la télé, puis noter ici le moteur, les échecs, et si les bundles modernes se chargent. Si les chunks modernes bloquent la télé, passer `renderModernChunks: false` dans `vite.config.ts`.

## Limites connues

- Style minimal. L'identité visuelle arrive à l'étape 1B.
- Pas de plateau, de mini-jeu ni d'activité. L'état est prévu pour s'étendre (`schema`, fusion au chargement).
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
