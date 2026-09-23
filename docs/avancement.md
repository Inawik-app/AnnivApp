# Avancement — GP Party

Dernière mise à jour : 23 septembre 2026.

Étapes 1A (fondations), 1B (identité visuelle), 2 (plateau), 2 bis (tests automatisés, enchaînement des animations), 2 ter (dé boosté), 2 quater (mise au lancer), 2 quinquies (plateau fixe, entièrement visible), 3a (grille des mini-jeux, règles, minuteur, poker), 3a bis (habillage 16 bits, écran poker), 3a ter (fenêtres remplies, trois polices) et les icônes (planches découpées, avatars, cases, GP) en place. Les écrans Jeopardy, Top Ten et Undercover arrivent à l'étape 3b.

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
- Identité visuelle : pixel art 16 bits, tapis, tuiles carton, encre, pièces d'or. Polices locales (Fontsource) : Press Start 2P pour les chiffres, DotGothic16 pour les titres et les noms, Baloo 2 pour les textes longs. Compteur de GP à rouleaux sur la télé, le téléphone et l'hôte. Un pseudo peut faire 20 caractères, pour que « Maximilien-Alexandre » tienne sur sa fiche.
- Télé : accueil (QR, places, retournement à l'inscription, confettis) et scores (couronne sur le ou les premiers, étoile de gain, rouleaux). Les joueurs restent dans l'ordre d'arrivée sur la télé, le téléphone et l'hôte ; le rang se met à jour sans déplacer les tuiles. Les animations passent par une file, une à la fois. Le mode animations réduites enlève les confettis et raccourcit les séquences en fondus.
- Téléphone : fond tapis avant l'inscription, puis fond à la couleur du joueur. Vibration courte sur un gain si le navigateur le permet.
- Hôte : fond encre, tuiles compactes, toast après chaque action, volume de la télé. L'ajustement de GP demande un montant et, au besoin, la case Masqué. Le volume est une donnée d'exécution (message `reglerVolume`), hors sauvegarde et hors annulation.
- Sons optionnels dans `client/public/assets/sons/`. Noms utilisés : `rejoindre`, `gain`, `transition`, `de`, `revelation`, `victoire`, `tictac`. Encore réservé : `buzzer`. Le lecteur prend le MP3, sinon l'OGG du même nom, et ignore un fichier absent. `tictac` joue une fois par seconde pendant les 10 dernières secondes d'un minuteur, `victoire` sonne à zéro, `transition` annonce un niveau de blinds.
- Plateau jouable : ordre de passage tiré une fois, choix du mini-jeu dans la grille, écran de règles ou module poker, mise au moment du lancer, dés et effets de cases (bonus, cagnotte, chance, duel).
- Mini-jeux : l'hôte affiche ou masque la grille sur la télé à tout moment du tour. Une tuile grisée a déjà été jouée ; l'hôte peut la relancer après confirmation, ou la remettre en jeu. Le choix marque le mini-jeu comme joué. `module: aucun`, ou un module pas encore branché, ouvre les règles. `poker` ouvre le module. Le minuteur (`arrete`, `enCours`, `enPause`, avec `finA` en heure serveur) est partagé. La télé le calcule avec le décalage d'horloge. La saisie des résultats affiche un aperçu, puis un mini-podium, puis les gains un par un. Classement : le rang partagé est celui du premier du groupe, le suivant saute les égalités. Équipes : 8 GP aux gagnants, 2 aux perdants. Poker : les jetons sont offerts, les blinds avancent toutes les 10 minutes (ou quand l'hôte force), le tapis final devient des GP 1 pour 1, et le tapis de l'hôte est partagé. Le reste de la division va au joueur le moins riche ; à égalité, au plus tôt dans l'ordre d'arrivée.
- Tests Vitest : réducteur, règle d'or, vues, persistance, détection d'IP, la course, et les mini-jeux (barèmes, ex aequo, validation des JSON, reste du tapis de l'hôte, enchaînement des blinds).
- `demarrerServeur({ port, dossierData, config })` démarre un serveur réutilisable par les tests, en moins d'une seconde. Les leviers `desForces` et `disposition` n'existent qu'avec `config`, donc jamais en production (`NODE_ENV=production` refuse ce mode). En mode test, le hasard hors dé est figé : la première carte chance piochée est Cadeau.
- La télé affiche un état distinct de l'état reçu. La file d'animations fait avancer les pions, les compteurs de GP, la cagnotte, l'ordre de passage et la phase, événement par événement. Pour un lancer : le dé roule puis s'arrête, le pion saute case par case, la carte d'effet apparaît, puis les compteurs défilent. File vide : l'état affiché rejoint l'état reçu. Un écart (annulation, redémarrage, reconnexion) vide la file et cale l'affichage sans animation. Au-delà de 8 s de retard, la suite est jouée en vitesse ×2 ; au-delà de 20 s, la télé saute à l'état reçu.
- `?vitesse=N` (minimum 0,25) accélère toutes les animations de la télé. `?debug=1` enregistre `window.__chronologieAnimations` (`evenement`, `etape`, `debut`, `fin`) et expose l'étape courante, l'état affiché, l'état reçu et le fait que la file est vide.
- La mise choisie au moment de lancer améliore le dé de déplacement : interpolation linéaire entre un dé normal et `probasMiseMax`. Une mise de 0 laisse le dé normal. Le dé des cartes `gainDe` reste normal. Chaque lancer enregistre sa mise et l'espérance de sa distribution. `lancerDe(mise)` débite la mise, alimente la cagnotte, tire le dé, déplace le pion et applique la case ; une annulation remet le tout. Le téléphone montre l'histogramme sur l'écran de lancer. La télé affiche « Mise : N GP, dé boosté » pendant le dé.
- Écran plateau en zones fixes, sans superposition : fiches dans l'ordre de passage à gauche, en-tête au centre qui nomme le joueur concerné, tuile Cagnotte en haut à droite, plateau dans le milieu. Les fiches font au plus 380 px de large et restent à la hauteur de leur contenu (environ 150 px, jamais toute la colonne) : avatar, pseudo et numéro de case (`n°`) sur une ligne, GP sur la suivante, avec un écart entre les fiches. La cagnotte est une tuile d'environ 300 px de large, calée en haut, sans descendre en bas de l'écran. L'en-tête est un petit panneau à la largeur du texte. Ces trois panneaux sont en bleu nuit à 80 % d'opacité. Les 12 % de largeur à gauche et à droite de l'écran ne reçoivent ni panneau ni case : l'île et la falaise restent visibles. Le plateau est une grille en zigzag qui monte, du départ en bas à gauche jusqu'à l'arrivée en haut, centrée dans sa zone, au plus 60 % de la largeur et 80 % de la hauteur de l'écran. Dans chaque case, l'icône est centrée et occupe environ 60 % de la tuile ; le numéro est une pastille d'angle, au plus 30 % de la hauteur, plus petite que l'icône. Tout le plateau reste visible : pas de caméra, pas de défilement, pas de piste. Le fond de cet écran est `client/public/assets/fond-plateau.jpg`, en `cover`, sans déformation. L'accueil et les scores gardent le tapis uni. Les cases sont reliées par des segments droits, y compris le raccord vertical en bout de rangée. Les pions tiennent dans la moitié basse de leur case. Celui du joueur courant a un halo. Un saut dure environ 250 ms par case, avec un petit arc ; en animations réduites, le déplacement est direct, avec un fondu. Le dé, la carte d'effet, le duel et les annonces sont au centre de la zone plateau, et absents pendant les sauts. Au démarrage, les fiches se mélangent puis se rangent, et l'annonce « Untel commence ! » s'affiche. Le texte « Connecté » est remplacé par un point.

## Configuration du plateau

`config/plateau.json` est lu au démarrage de la course et copié dans l'état (`course.regles`). Un changement de fichier en cours de course ne s'applique qu'à la course suivante.

- `longueur` : 38. La case 0 est le départ, la case 38 l'arrivée. Les pions ne dépassent pas 38.
- `repartition` : 14 bonus, 10 chance, 6 cagnotte, 7 duel, sur les cases 1 à 37. La somme doit valoir `longueur - 1`.
- `gainBonus` : 5 GP sur une case bonus.
- `miseMax` : 10 GP par mise de tour. Le plafond réel est le minimum entre cette valeur et le solde visible.
- `probasMiseMax` : probabilités des faces 1 à 6 quand la mise vaut `miseMax`, soit 1/12, 7/60, 3/20, 11/60, 13/60 et 1/4. Pour une mise m, chaque face vaut `(1 − m/miseMax) × 1/6 + (m/miseMax) × probasMiseMax`. La moyenne passe de 3,5 à environ 4,08.
- `choixMiniJeu` : `"rotation"` (au tour N, le joueur en position N − 1 dans l'ordre de passage). L'autre valeur acceptée est `"dernierAuClassement"` (le moins de GP visibles ; en cas d'égalité, le plus tôt dans l'ordre).
- `duel.miseMax` : 10 GP. `duel.bonusVainqueur` : 5 GP, ajoutés à la mise récupérée et à la mise adverse.
- `duel.defis` : Pierre-feuille-ciseaux en 2 manches gagnantes ; Un point de ping-pong ; Bataille de pouces ; Le premier qui rit a perdu ; Lancer de bouchon le plus près du mur. L'hôte peut en tirer un autre tant que les mises du duel ne sont pas révélées.
- `disposition` : absente. Si cette liste est ajoutée, elle remplace la génération. Le fichier vérifie la longueur, le départ et l'arrivée. Les contraintes « pas de cagnotte ni de duel sur les cases 1 à 3 » et « pas deux cagnottes ou deux duels d'affilée » ne s'appliquent qu'à la génération automatique.

`config/cartes-chance.json` : 14 cartes. Neuf rapportent des GP (3, 5, 6, 8 ou 10), cinq sont neutres. Effets : `gain`, `gainTous`, `cadeau` (le donneur ne perd rien), `gainDe` (2 × le dé), `neutre`. Aucune carte ne retire de GP. La pioche est mélangée sur le serveur, tirée sans remise, puis remélangée quand elle est vide. Son ordre n'est envoyé à aucune page.

## Mini-jeux

`config/mini-jeux.json` est lu au démarrage du serveur. Un JSON invalide empêche le démarrage, avec le fichier et le mini-jeu en cause dans le message.

- `baremes.classement` : 10, 6, 3, 1. Un champ `bareme` sur un mini-jeu remplace cette liste pour un classement.
- `baremes.equipes` : 8 GP pour chaque gagnant, 2 GP pour chaque perdant.
- Chaque jeu a `id`, `nom`, `resume`, `icone`, `regles` (3 à 5 lignes), `materiel` facultatif, `duree` facultative en secondes, `saisie` (`classement`, `equipes` ou `libre`), `module` (`aucun` pour un jeu physique, sinon le nom de l'écran).

Jeux de départ : `pong-gobelets` (classement), `mime-express` (équipes, 60 s), `memoire-express` (classement, 30 s), `poker`, `jeopardy`, `top-ten`, `undercover`. Les trois derniers ont `saisie: libre`.

`config/poker.json` : `jetonsOfferts` 20 (offerts, jamais pris sur les GP), `dureeMinutes` 30, trois `niveaux` de 10 minutes (`petite` / `grosse` : 1/2, 2/4, 4/8), et les `regles` complètes. Le retrait volontaire et la conversion 1 pour 1 y sont écrits. La durée d'un niveau est `dureeMinutes / nombre de niveaux`, pas une constante du code. La télé ne répète pas les jetons offerts : c'est dit à voix haute. Elle montre le compte à rebours, les blinds, « Niveau N sur 3 », trois lignes courtes, et les 10 combinaisons avec un exemple de 5 cartes. Au changement de niveau, le panneau du temps clignote et `transition` sonne.

À la fin, l'hôte saisit le tapis de chaque joueur et le sien. Le sien est divisé en parts entières. Le reste va au joueur dont les GP visibles sont les plus bas avant cette action ; si plusieurs sont à égalité, c'est le plus tôt dans l'ordre d'arrivée.

Pour brancher un module plus tard : ajouter son nom à `MODULES_PRETS` dans `shared/mini-jeux.ts`, puis un écran dans `client/tv/main.tsx` quand `course.ecranMini` vaut ce nom. Tant que le nom n'est pas dans `MODULES_PRETS`, la télé reste sur les règles et l'hôte affiche « Module disponible à la prochaine étape ».

## Habillage 16 bits

Les tokens sont dans `client/commun/base.css`. Les panneaux et les boutons sont dans `client/commun/composants.css`. Un nouvel écran réutilise ces classes, il ne redéfinit pas les coins, les bordures ni les polices.

Trois rôles de police, toutes servies en local par Fontsource :

- `--police-chiffres` : Press Start 2P. Chiffres, minuteur, compteurs de GP, valeurs des cartes, rangs, blinds.
- `--police-pixel` : DotGothic16. Titres, noms, boutons, libellés courts. Les accents français (é, è, à, ç, û) sont dans le fichier latin. Silkscreen et Pixelify Sans ne sont plus utilisées.
- `--police-texte` : Baloo 2. Règles, questions, champs de saisie, tout texte sur plusieurs lignes.

Les ligatures sont coupées partout (`font-variant-ligatures: none` et `font-feature-settings: "liga" 0, "clig" 0`), pour que « flush » ne devienne pas « Aush ». L'interligne des polices pixel est au moins 1,4. Leurs tailles, à l'échelle 1080p, ne sortent pas de `--px-24`, `--px-32`, `--px-40`, `--px-48`, `--px-64`, `--px-96` et `--px-128`. Press Start 2P est large : on élargit le panneau plutôt que de descendre sous 32 px.

Une fenêtre se remplit, seulement pour les écrans de contenu qui occupent tout l'écran : poker, règles, grille des mini-jeux, podium, scores, accueil, et les modules à venir. Le contenu d'un tel panneau se répartit sur toute sa hauteur, entre un minimum et un maximum. Un grand vide en bas est un défaut, au même titre qu'un chevauchement. Cette règle ne s'applique jamais aux panneaux latéraux de l'écran plateau : fiches, cagnotte et en-tête restent à la taille de leur contenu. Les 10 combinaisons du poker sont en 2 colonnes et 5 rangées qui occupent le panneau : le rang et le nom au-dessus, les 5 cartes en dessous, au moins 70 px de large.

- `--nuit` : bleu nuit à 88 % d'opacité. Sur la télé (`.scene`), `.tuile`, `.panneau` et `.tuile-mini` le prennent tout seuls. Les panneaux de l'écran plateau (fiches, cagnotte, en-tête) sont à 80 %, un peu plus translucides. Le téléphone et l'hôte gardent le carton, parce qu'ils n'ont pas l'illustration derrière.
- `--liseret` : filet clair à l'intérieur de la bordure d'encre.
- `--escalier` : `clip-path` qui coupe un petit carré à chaque coin.
- `--cran` : décalage de l'ombre et de l'enfoncement du bouton. L'ombre est le socle `.socle-pixel` (encre, sans flou). Le bouton s'y enfonce d'un cran au `pointerdown`, en `steps()`.
- `--contour` : `text-shadow` d'encre, 2 px, sans flou. Il est posé sur `.scene.scene-plateau`, donc sur tout texte posé sur l'image. L'intérieur d'un panneau le retire.

Pour habiller un futur écran de contenu : envelopper le bloc dans `.socle-pixel`, mettre `.panneau` (ou `.tuile`) à l'intérieur, écrire les libellés courts en `--police-pixel`, les chiffres en `--police-chiffres` et les phrases en `--police-texte`. Le bloc doit occuper la hauteur de sa zone. Les panneaux latéraux du plateau, eux, restent à la taille de leur contenu. Pas de `border-radius`, pas d'ombre floue, pas de dégradé. Les images et les SVG ont `image-rendering: pixelated` ; leur taille d'affichage reste un multiple entier de la taille source. Les animations restent sur `transform` et `opacity`. Le dé, les rouleaux de GP et les clignotements utilisent `steps()`. Le saut des pions reste fluide. Sur la télé, aucun texte sous 36 px, sauf le panneau des combinaisons où le plancher est 28 px. Les tailles pixel restent un multiple de 8. Un pseudo trop long descend de 48 px à 40 px avant d'être coupé. Les chiffres clés (minuteur, gains) restent au-dessus de 90 px.

## Icônes

Les deux planches sont dans `docs/ressources/` (`planche-1.png`, 6×4, et `planche-2.png`, 4×4). `npm run icones` lance `scripts/decouper-icones.mjs` (pngjs, sans binaire natif). Il redécoupe les cases, retire le magenta, rattache un débordement de quelques pixels au sprite relié, et écrit `client/public/assets/icones/<nom>.png`. Le script est rejouable : il réécrit les mêmes fichiers. La planche de contrôle est `test-results/icones/verification.png`.

Les planches ne sont pas un agrandissement net (les pixels voisins ne sont pas d'une seule couleur, même à 10 % près). Le script le signale et réduit chaque sprite au plus proche voisin vers 64×64. `<Icone nom taille />` n'affiche donc que 64, 128 ou 192 px, en `image-rendering: pixelated`. Un fichier manquant devient un carré, de la couleur du joueur ou neutre, sans planter. `shared/icones.ts` est généré : un nom absent est une erreur de compilation.

Branchées :

- Cases du plateau : `case-bonus`, `case-chance`, `case-cagnotte`, `case-duel`, `case-depart`, `case-arrivee`.
- GP : `gp-piece` à côté de chaque solde, gain affiché en rouleaux, et de la cagnotte.
- Leader : `couronne` sur les scores.
- Avatars : `config/avatars.json` (carpe, verre d'eau, piment, planète, appareil photo, chocolatine, sac de rando, cerveau). À l'inscription, la grille grise un personnage déjà pris. La couleur reste automatique et fait l'anneau. Les pastilles à initiale sont remplacées sur les fiches, les pions, le téléphone et la page hôte.
- Mini-jeux : `ping-pong`, `masques`, `perso-cerveau`, `poker`, `buzzer`, `pouvoir-pari`, `enveloppe`.
- Minuteur : `sablier` à côté du compte à rebours. Dans la colonne étroite du poker, il passe au-dessus des chiffres pour qu'ils tiennent sur une ligne.
- Carte chance `cadeau` : l'icône `cadeau`.

Prêtes, pas encore affichées : `pouvoir-double`, `pouvoir-assurance`, `pouvoir-tout-ou-rien`, tous les `trophee-*`, `medaille`, `confettis`, `manette`, `musique`, `megaphone`. `pouvoir-pari` est déjà l'icône de Top Ten. L'icône `de` est un décor : le dé qui montre sa valeur reste dessiné en CSS.

## Actions et événements

Actions joueur : `rejoindre`, `demanderReprise`, `lancerDe` (avec la mise), `choisirBeneficiaire`, `choisirAdversaire`, `miserDuel`.

Actions hôte : `ajouterGP`, `revelerMasquees`, `renommerJoueur`, `retirerJoueur`, `validerReprise`, `refuserReprise`, `verrouillerInscriptions`, `choisirEcranTv` (`accueil`, `scores`, `plateau`), `basculerAnimationsReduites`, `basculerDiagnosticTv`, `annuler`, `reinitialiserPartie`, `ajouterJoueursFictifs` (développement seulement), `demarrerCourse`, `regenererPlateau`, `retirerOrdre` (avant le premier tour), `nouveauTour`, `choisirMiniJeu` (identifiant du catalogue), `afficherGrille` (bascule, à partir du premier tour), `remettreMiniJeu`, `demarrerMinuteur` (durée en secondes et libellé), `pauseMinuteur`, `reprendreMinuteur`, `ajouter30s`, `arreterMinuteur`, `echeanceMinuteur` (envoyé par le serveur quand l'heure est atteinte), `niveauSuivant`, `validerResultats`, `validerPoker`, `passerAuxDeplacements`, `lancerDe` (à la place du joueur courant, mise au choix), `choisirBeneficiaire`, `choisirAdversaire`, `cloreMisesDuel`, `autreDefi`, `resultatDuel`, `definirPosition` (joueur et numéro de case, sans effet), `passerJoueur`, `terminerCourse`, `basculerBots` (développement seulement).

Événements : `joueur.rejoint`, `joueur.renomme`, `joueur.retire`, `gp.ajoutes` (public ou hôte si masqué), `gp.reveles` (un événement public par joueur concerné), `reprise.demandee` (hôte), `reprise.validee` (public), `reprise.refusee` (joueur concerné et hôte), `inscriptions`, `ecran`, `animations`, `diagnostic` (hôte), `partie.reinitialisee`, `course.demarree`, `ordre.tire`, `plateau.regenere`, `tour.nouveau`, `minijeu.annonce`, `minijeu.choisi`, `grille`, `minijeu.remis` (hôte), `minuteur.demarre`, `minuteur.pause`, `minuteur.repris`, `minuteur.prolonge`, `minuteur.arrete`, `minuteur.termine`, `poker.niveau`, `minijeu.podium`, `deplacements.commences`, `de.lance` (le montant de la mise de tour est public), `pion.avance`, `joueur.arrive`, `case.bonus`, `case.cagnotte`, `case.chance`, `cadeau.donne`, `duel.annonce`, `duel.adversaire`, `duel.mise` (sans montant), `duel.reveles`, `duel.defi`, `duel.resultat`, `joueur.passe`, `position.corrigee`, `tour.fini`, `course.terminee`, `bots` (hôte).

Le débit d'une mise (tour ou duel) est une transaction `source: mise`, sans événement `gp.ajoutes`. Le montant de la mise de tour part dans `de.lance`. Le montant d'une mise de duel reste caché jusqu'à `duel.reveles`. Le crédit d'une case ou d'un duel est une transaction `source: plateau` avec `gp.ajoutes`. Le crédit d'un mini-jeu est `source: mini-jeu`, celui du poker `source: poker`, avec le nom du jeu comme libellé, puis `gp.ajoutes`. `minijeu.podium` passe avant ces gains.

## Comment tester

La vérification du jeu passe par des scripts en ligne de commande. Le navigateur intégré de Cursor n'est pas utilisé : il est trop lent. Ces scripts ne touchent jamais au port 3000 ni au dossier `data/`. Chacun lance son propre serveur sur un port libre, avec un dossier temporaire supprimé à la fin.

```bat
npm install
npx playwright install chromium
npm run icones
npm test
npm run test:e2e
npm run test:tv
```

- `npm run icones` : redécoupe les planches. À relancer si `docs/ressources/planche-1.png` ou `planche-2.png` change. Durée : environ 3 s.
- `npm test` : logique de jeu (Vitest), sans réseau, et le découpage des 40 icônes. Durée mesurée : 4,1 s. Le test du découpage a 20 s de marge : sur ce disque, le script passe parfois juste au-dessus de 5 s.
- `npm run test:e2e` : hôte et 4 joueurs en socket, plateau de 38 cases, une case de chaque type, duel gagné puis égalité, arrivée. L'ordre est tiré une fois. Chaque lancer a une mise et une espérance. La grille s'affiche puis se masque. Un mini-jeu physique démarre un minuteur, mis en pause puis repris, avec un classement et un ex aequo. Un mini-jeu en équipes suit. Une partie de poker va du démarrage à la conversion des tapis. Annulation vérifiée pour : un ajout de GP, le mini-jeu choisi, la saisie des résultats, la conversion du poker, un lancer suivi de l'effet de sa case, le choix de l'adversaire d'un duel, une mise de duel, le résultat d'un duel, un nouveau tour, une arrivée. Le serveur est arrêté puis relancé pendant un minuteur : l'heure de fin ne change pas. Après chaque action, invariants et secret des mises de duel. Objectif : moins de 15 s. Durée mesurée : 1,9 s.
- `npm run test:tv` : Chromium sans interface, `/tv?debug=1&vitesse=2` en 1920×1080. Plateau court (9 cases). Départ avec 4 pions, choix du mini-jeu, saut vers la rangée du dessus, deux pions sur la même case, arrivée. Puis la grille avec un mini-jeu grisé, un écran de règles, le minuteur dans ses 10 dernières secondes, le podium et l'écran poker. Chaque case est entière dans la zone et ne chevauche pas les autres. Chaque pion est entier dans sa case. Les numéros restent visibles. Les fiches, l'en-tête et la cagnotte ne recouvrent pas le plateau. Les écrans de mini-jeux ne débordent pas de leur zone. Le pseudo « Maximilien-Alexandre » (20 caractères) s'affiche en entier sur sa fiche. L'en-tête contient le pseudo pendant le choix du mini-jeu et pendant les déplacements. Le nombre de cases vaut `longueur` + 1. La chronologie ne se chevauche pas. Dans le panneau des combinaisons, chaque nom est au-dessus de ses cartes, chaque carte fait au moins 70 px de large, et les 10 cellules couvrent au moins 85 % de la hauteur. Le contenu du panneau principal occupe au moins 80 % de sa hauteur sur les écrans de contenu (accueil, scores, grille, règles, podium, poker), pas sur les panneaux latéraux du plateau. Sur le plateau, aucun élément opaque ne touche les bandes des 12 % extérieurs, les panneaux et les cases couvrent au plus 65 % de l'écran, chaque fiche fait moins de 200 px de haut, l'icône d'une case est plus grande que son numéro, et le plateau tient dans 60 % de la largeur et 80 % de la hauteur. Aucun texte de la télé n'est sous 36 px, sauf dans le panneau des combinaisons où le plancher est 28 px. Aucune taille de police pixel n'est hors multiple de 8. Aucun texte ne sort de son panneau. Sur le plateau, les 4 avatars sont distincts et visibles sur les pions comme sur les fiches, les cases et la cagnotte ont leur icône, et aucune icône n'est en repli. La grille non plus. Le test agrandit volontairement une fiche du plateau et vérifie que le contrôle du fond échoue, puis casse la grille des combinaisons et vérifie que ce contrôle échoue aussi. Les vérifications passent par `new Function` : une fonction écrite dans le fichier de test n'est pas exécutée par Playwright, parce que tsx y injecte `__name`. Captures dans `test-results/tv/` : `00-polices.png` (planche des trois polices), `15-accueil.png`, `16-scores.png`, `01-depart.png` et `12-plateau-pixel.png` (cases, avatars, cagnotte), `06-grille.png` et `13-grille-pixel.png`, `07-regles.png` et `14-regles-pixel.png`, `08-minuteur.png`, `09-podium.png`, `10-poker.png` et `11-poker-combinaisons.png`, plus les étapes de course `02` à `05`. Objectif : moins de 30 s. Durée mesurée : 18,2 s. `npm run build` : 8,9 s pour Vite, environ 16 s pour la commande complète.

Pour jouer vraiment, `npm run dev` écoute le port 3000 et écrit dans `data/`. Depuis le PC : `http://127.0.0.1:3000/`, `/tv`, `/joueur`, `/hote`. Depuis un téléphone du même Wi-Fi, les URL affichées au démarrage.

Parcours utile : un joueur s'inscrit et sa tuile se retourne sur l'accueil de la télé ; l'hôte ajoute des GP visibles puis des GP masqués ; seuls les GP visibles s'affichent sur la télé et le téléphone ; sur les scores, un gain enchaîne l'étoile puis les rouleaux, et les tuiles restent à leur place. Trois gains rapides se jouent l'un après l'autre. « Révéler les GP masqués » joue un gain par joueur. « Réduire les animations » supprime les confettis et raccourcit les séquences. « Annuler » restaure l'action dont le libellé était affiché sur le bouton. Recharger `/joueur` retrouve la place, fond de la couleur du joueur. `/joueur?profil=1` et `/joueur?profil=2` sont deux joueurs. Arrêter puis relancer le serveur conserve `data/etat.json` ; les pages se reconnectent. Pour la télé, `npm run build` puis `npm start` (ou `lancer-soiree.bat`), pas le mode développement. Pour entendre un son, déposer par exemple `de.mp3` dans `client/public/assets/sons/` puis reconstruire.

Course, avec `npm run dev` : deux onglets `/joueur?profil=1` et `/joueur?profil=2`, puis « Ajouter 4 joueurs fictifs » (il n'en reste que les places libres) et « Activer les bots ». « Démarrer la course » affiche le plateau sur la télé et joue le tirage de l'ordre. « Tirer à nouveau l'ordre » n'existe qu'avant le premier tour. « Afficher la grille sur la télé » montre les tuiles ; un second appui les masque. Pendant le choix, l'hôte touche une tuile. Une tuile grisée demande « Ce mini-jeu a déjà été joué. Le relancer ? ». « Remettre en jeu » enlève la coche. Sur les règles, « Démarrer le minuteur » utilise la durée du jeu. « Saisir les résultats » montre l'aperçu avant « Valider les résultats ». Pour le poker : Démarrer, Pause, Reprendre, +30 s, Niveau suivant, puis Terminer et les tapis. Le grand bouton enchaîne ensuite vers les dés. Quand c'est son tour, le téléphone choisit la mise et lance. « Lancer pour Untel » le fait à sa place, mise 0 par défaut. Les bots lancent le dé après une seconde et choisissent adversaire ou bénéficiaire. L'hôte saisit le résultat des duels. « Annuler » un lancer rend la mise, la cagnotte, la position et l'effet. « Terminer la course » demande une seconde confirmation. Un essai isolé, sans toucher `data/etat.json` : `set PORT=3010` et `set GP_DONNEES=un-dossier-vide`, puis `npm run dev`.

## Diagnostic TV

Fait sur la télé de la soirée, une Freebox Player POP (Android 10). Moteur : Chrome 151.0. 50 images par seconde. Reçu le 22 septembre 2026.

Tout est pris en charge : ES2015, ES2020, Proxy, Promise, fetch, WebSocket, grille CSS, flex gap, variables CSS, transforms 3D, woff2, plein écran. L'audio MP3 et l'audio OGG passent, y compris une lecture sans appui.

Les contraintes CSS provisoires sont levées. Grille, `gap`, variables et transforms 3D sont utilisables sur cette télé. Les animations restent limitées à `transform` et `opacity`, pour la fluidité. Les bundles modernes suffisent ; les bundles legacy restent dans le build au cas où.

Format audio retenu : MP3 en priorité, OGG en repli si seul le fichier OGG est présent. Les deux formats marchent sur cette Freebox.

## Limites connues

- Jeopardy, Top Ten et Undercover sont dans la grille, sans écran dédié. La télé montre leurs règles. L'hôte voit « Module disponible à la prochaine étape » et peut déjà saisir les GP à la main, en mode libre.
- Les bots n'existent qu'avec `npm run dev`. Ils ne choisissent pas le mini-jeu, ne lancent pas le minuteur et ne saisissent pas le résultat d'un duel. Ils choisissent eux-mêmes leur mise au moment de lancer.
- « Ajouter 4 joueurs fictifs » n'existe qu'avec `npm run dev`, dans la limite des places libres.
- Les icônes `pouvoir-double`, `pouvoir-assurance`, `pouvoir-tout-ou-rien`, `trophee-*`, `medaille`, `confettis`, `manette`, `musique` et `megaphone` sont découpées et pas encore affichées. Elles attendent la finale.
- Le volume de la télé repart à 80 % à chaque démarrage du serveur.
- La pile d'annulation est en mémoire : un redémarrage la vide. La sauvegarde, elle, reste. En mode test, cette pile remet aussi la file de dés imposés, pour rejouer le même lancer.
- Le rattrapage de la télé (vitesse ×2 après 8 s, saut à l'état reçu après 20 s) n'est pas exercé par `npm run test:tv` : le scénario reste en dessous de ce retard.
- En mode test, le dé `gainDe` n'utilise pas `desForces` : il reste un dé normal, figé sur 1 parce que le hasard hors dé renvoie 0.
- Une demande de reprise en cours perd le lien avec le téléphone au redémarrage. Le téléphone peut renvoyer la demande.
- Le code hôte par défaut est `change-moi`. À changer avant la soirée.
- Une adresse lien-local `169.254.x.x` peut apparaître dans les autres IP. Elle n'est pas retenue s'il existe une adresse `192.168`, `10.` ou `172.16–31`.

## À discuter

- Contenu du Jeopardy, du Top Ten et d'Undercover.
- Pénalité ou non au Jeopardy (hypothèse : aucune).
- Barème d'Undercover et des missions secrètes.
- Défi final.
- Boutique du tour : oui ou non (secondaire, après le reste).
