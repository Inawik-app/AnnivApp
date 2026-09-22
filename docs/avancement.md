# Avancement — GP Party

Dernière mise à jour : 22 septembre 2026.

Étapes 1A (fondations), 1B (identité visuelle), 2 (plateau) et 2 bis (tests automatisés, enchaînement des animations) en place. La grille des mini-jeux et le Jeopardy ne sont pas commencés.

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
- Sons optionnels dans `client/public/assets/sons/`. Noms utilisés : `rejoindre`, `gain`, `transition`, `de`, `revelation`, `victoire`. Encore réservés : `buzzer`, `tictac`. Le lecteur prend le MP3, sinon l'OGG du même nom, et ignore un fichier absent. Avatars PNG optionnels dans `client/public/assets/avatars/` (le nom du fichier, sans extension, est l'identifiant). Sans PNG, pastilles avec initiale.
- Plateau jouable : mises secrètes, révélation, ordre de passage, écran d'attente du mini-jeu, dés et effets de cases (bonus, cagnotte, chance, duel). Les GP du mini-jeu passent encore par la saisie manuelle de l'hôte.
- Tests Vitest : réducteur, règle d'or, vues, persistance, détection d'IP, et la course (ordre, mises, cagnotte, cartes, duel, arrivée, secrets, simulation de 12 tours).
- `demarrerServeur({ port, dossierData, config })` démarre un serveur réutilisable par les tests, en moins d'une seconde. Les leviers `desForces` et `disposition` n'existent qu'avec `config`, donc jamais en production (`NODE_ENV=production` refuse ce mode). En mode test, le hasard hors dé est figé : la première carte chance piochée est Cadeau.
- La télé affiche un état distinct de l'état reçu. La file d'animations fait avancer les pions, les compteurs de GP, la cagnotte, l'ordre de passage et la phase, événement par événement. Pour un lancer : le dé roule puis s'arrête, le pion saute case par case, la carte d'effet apparaît, puis les compteurs défilent. File vide : l'état affiché rejoint l'état reçu. Un écart (annulation, redémarrage, reconnexion) vide la file et cale l'affichage sans animation. Au-delà de 8 s de retard, la suite est jouée en vitesse ×2 ; au-delà de 20 s, la télé saute à l'état reçu.
- `?vitesse=N` (minimum 0,25) accélère toutes les animations de la télé. `?debug=1` enregistre `window.__chronologieAnimations` (`evenement`, `etape`, `debut`, `fin`) et expose l'étape courante, l'état affiché, l'état reçu et le fait que la file est vide.

## Configuration du plateau

`config/plateau.json` est lu au démarrage de la course et copié dans l'état (`course.regles`). Un changement de fichier en cours de course ne s'applique qu'à la course suivante.

- `longueur` : 34. La case 0 est le départ, la case 34 l'arrivée. Les pions ne dépassent pas 34.
- `repartition` : 13 bonus, 9 chance, 5 cagnotte, 6 duel, sur les cases 1 à 33. La somme doit valoir `longueur - 1`.
- `gainBonus` : 5 GP sur une case bonus.
- `miseMax` : 10 GP par mise de tour. Le plafond réel est le minimum entre cette valeur et le solde visible.
- `choixMiniJeu` : `"premier"` (le plus gros miseur choisit). L'autre valeur acceptée est `"dernier"`.
- `duel.miseMax` : 10 GP. `duel.bonusVainqueur` : 5 GP, ajoutés à la mise récupérée et à la mise adverse.
- `duel.defis` : Pierre-feuille-ciseaux en 2 manches gagnantes ; Un point de ping-pong ; Bataille de pouces ; Le premier qui rit a perdu ; Lancer de bouchon le plus près du mur. L'hôte peut en tirer un autre avant la révélation des mises.
- `disposition` : absente. Si cette liste est ajoutée, elle remplace la génération. Le fichier vérifie la longueur, le départ et l'arrivée. Les contraintes « pas de cagnotte ni de duel sur les cases 1 à 3 » et « pas deux cagnottes ou deux duels d'affilée » ne s'appliquent qu'à la génération automatique.

`config/cartes-chance.json` : 14 cartes. Neuf rapportent des GP (3, 5, 6, 8 ou 10), cinq sont neutres. Effets : `gain`, `gainTous`, `cadeau` (le donneur ne perd rien), `gainDe` (2 × le dé), `neutre`. Aucune carte ne retire de GP. La pioche est mélangée sur le serveur, tirée sans remise, puis remélangée quand elle est vide. Son ordre n'est envoyé à aucune page.

## Actions et événements

Actions joueur : `rejoindre`, `demanderReprise`, `miser`, `lancerDe`, `choisirBeneficiaire`, `choisirAdversaire`, `miserDuel`.

Actions hôte : `ajouterGP`, `revelerMasquees`, `renommerJoueur`, `retirerJoueur`, `validerReprise`, `refuserReprise`, `verrouillerInscriptions`, `choisirEcranTv` (`accueil`, `scores`, `plateau`), `basculerAnimationsReduites`, `basculerDiagnosticTv`, `annuler`, `reinitialiserPartie`, `ajouterJoueursFictifs` (développement seulement), `demarrerCourse`, `regenererPlateau`, `nouveauTour`, `cloreMises`, `revelerMises`, `passerAuChoix`, `choisirMiniJeu`, `passerAuxDeplacements`, `lancerDe` (à la place du joueur courant), `choisirBeneficiaire`, `choisirAdversaire`, `cloreMisesDuel`, `autreDefi`, `resultatDuel`, `definirPosition` (joueur et numéro de case, sans effet), `passerJoueur`, `terminerCourse`, `basculerBots` (développement seulement).

Événements : `joueur.rejoint`, `joueur.renomme`, `joueur.retire`, `gp.ajoutes` (public ou hôte si masqué), `gp.reveles` (un événement public par joueur concerné), `reprise.demandee` (hôte), `reprise.validee` (public), `reprise.refusee` (joueur concerné et hôte), `inscriptions`, `ecran`, `animations`, `diagnostic` (hôte), `partie.reinitialisee`, `course.demarree`, `plateau.regenere`, `tour.nouveau`, `mise.posee` (joueur seulement, pas le montant), `mises.cloturees`, `mises.revelees`, `minijeu.annonce`, `minijeu.choisi`, `deplacements.commences`, `de.lance`, `pion.avance`, `joueur.arrive`, `case.bonus`, `case.cagnotte`, `case.chance`, `cadeau.donne`, `duel.annonce`, `duel.adversaire`, `duel.mise` (sans montant), `duel.reveles`, `duel.defi`, `duel.resultat`, `joueur.passe`, `position.corrigee`, `tour.fini`, `course.terminee`, `bots` (hôte).

Le débit d'une mise (tour ou duel) est une transaction `source: mise`, sans événement `gp.ajoutes`, pour ne pas montrer le montant avant la révélation. Le crédit d'une case ou d'un duel est une transaction `source: plateau` avec `gp.ajoutes`.

## Comment tester

La vérification du jeu passe par des scripts en ligne de commande. Le navigateur intégré de Cursor n'est pas utilisé : il est trop lent. Ces scripts ne touchent jamais au port 3000 ni au dossier `data/`. Chacun lance son propre serveur sur un port libre, avec un dossier temporaire supprimé à la fin.

```bat
npm install
npx playwright install chromium
npm test
npm run test:e2e
npm run test:tv
```

- `npm test` : logique de jeu (Vitest), sans réseau.
- `npm run test:e2e` : hôte et 4 joueurs en socket, trois tours, une case de chaque type, duel gagné puis égalité, arrivée. Après chaque action, invariants et secret des mises. Annulation vérifiée pour : un ajout de GP, une mise, la clôture des mises, la révélation, le mini-jeu choisi, le passage aux déplacements, un lancer suivi de l'effet de sa case, le choix de l'adversaire d'un duel, une mise de duel, le résultat d'un duel, un nouveau tour, une arrivée. Le serveur est aussi arrêté puis relancé pendant les déplacements. Objectif : moins de 15 s.
- `npm run test:tv` : Chromium sans interface, `/tv?debug=1&vitesse=4` en 1920×1080. Révélation, case bonus, case cagnotte, duel. La chronologie ne doit pas se chevaucher, l'ordre dé → sauts → effet → GP est exigé, et la file vide laisse l'état affiché égal à l'état reçu. Captures dans `test-results/tv/` (`02-revelation.png`, `03-de-arrete.png`, `04-pion-arrive.png`, `05-duel.png`). Objectif : moins de 30 s.

Pour jouer vraiment, `npm run dev` écoute le port 3000 et écrit dans `data/`. Depuis le PC : `http://127.0.0.1:3000/`, `/tv`, `/joueur`, `/hote`. Depuis un téléphone du même Wi-Fi, les URL affichées au démarrage.

Parcours utile : un joueur s'inscrit et sa tuile se retourne sur l'accueil de la télé ; l'hôte ajoute des GP visibles puis des GP masqués ; seuls les GP visibles s'affichent sur la télé et le téléphone ; sur les scores, un gain enchaîne l'étoile puis les rouleaux, et les tuiles restent à leur place. Trois gains rapides se jouent l'un après l'autre. « Révéler les GP masqués » joue un gain par joueur. « Réduire les animations » supprime les confettis et raccourcit les séquences. « Annuler » restaure l'action dont le libellé était affiché sur le bouton. Recharger `/joueur` retrouve la place, fond de la couleur du joueur. `/joueur?profil=1` et `/joueur?profil=2` sont deux joueurs. Arrêter puis relancer le serveur conserve `data/etat.json` ; les pages se reconnectent. Pour la télé, `npm run build` puis `npm start` (ou `lancer-soiree.bat`), pas le mode développement. Pour entendre un son, déposer par exemple `de.mp3` dans `client/public/assets/sons/` puis reconstruire.

Course, avec `npm run dev` : deux onglets `/joueur?profil=1` et `/joueur?profil=2`, puis « Ajouter 4 joueurs fictifs » (il n'en reste que les places libres) et « Activer les bots ». « Démarrer la course » affiche le plateau sur la télé. Les bots misent, lancent le dé après une seconde et choisissent adversaire ou bénéficiaire. L'hôte enchaîne le grand bouton (clore, révéler, nommer le mini-jeu, passer aux dés, nouveau tour) et saisit le résultat des duels. Avant « Révéler les mises », la télé ne montre que des coches. « Annuler » un lancer rend le bouton « Lancer le dé ». « Terminer la course » demande une seconde confirmation. Un essai isolé, sans toucher `data/etat.json` : `set PORT=3010` et `set GP_DONNEES=un-dossier-vide`, puis `npm run dev`.

## Diagnostic TV

Fait sur la télé de la soirée, une Freebox Player POP (Android 10). Moteur : Chrome 151.0. 50 images par seconde. Reçu le 22 septembre 2026.

Tout est pris en charge : ES2015, ES2020, Proxy, Promise, fetch, WebSocket, grille CSS, flex gap, variables CSS, transforms 3D, woff2, plein écran. L'audio MP3 et l'audio OGG passent, y compris une lecture sans appui.

Les contraintes CSS provisoires sont levées. Grille, `gap`, variables et transforms 3D sont utilisables sur cette télé. Les animations restent limitées à `transform` et `opacity`, pour la fluidité. Les bundles modernes suffisent ; les bundles legacy restent dans le build au cas où.

Format audio retenu : MP3 en priorité, OGG en repli si seul le fichier OGG est présent. Les deux formats marchent sur cette Freebox.

## Limites connues

- Le mini-jeu est un écran d'attente : l'hôte tape son nom, attribue les GP avec la saisie manuelle, puis passe aux dés. Pas de grille ni de Jeopardy.
- Les bots n'existent qu'avec `npm run dev`. Ils ne nomment pas le mini-jeu, ne closent pas les mises et ne saisissent pas le résultat d'un duel.
- « Ajouter 4 joueurs fictifs » n'existe qu'avec `npm run dev`, dans la limite des places libres.
- Aucun PNG d'avatar ni fichier son n'est fourni pour l'instant. Les pastilles et le silence sont le comportement prévu tant que les dossiers `client/public/assets/` sont vides.
- Le volume de la télé repart à 80 % à chaque démarrage du serveur.
- La pile d'annulation est en mémoire : un redémarrage la vide. La sauvegarde, elle, reste. En mode test, cette pile remet aussi la file de dés imposés, pour rejouer le même lancer.
- Le rattrapage de la télé (vitesse ×2 après 8 s, saut à l'état reçu après 20 s) n'est pas exercé par `npm run test:tv` : le scénario reste en dessous de ce retard.
- Une demande de reprise en cours perd le lien avec le téléphone au redémarrage. Le téléphone peut renvoyer la demande.
- Le code hôte par défaut est `change-moi`. À changer avant la soirée.
- Une adresse lien-local `169.254.x.x` peut apparaître dans les autres IP. Elle n'est pas retenue s'il existe une adresse `192.168`, `10.` ou `172.16–31`.

## À discuter

- Liste des ~10 mini-jeux et contenu du Jeopardy.
- Pénalité ou non au Jeopardy (hypothèse : aucune).
- Barème d'Undercover et des missions secrètes.
- Défi final.
- Boutique du tour : oui ou non (secondaire, après le reste).
