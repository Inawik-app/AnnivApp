# Cahier des charges — « Mario Party » d'anniversaire

## Contexte

Je suis développeur et j'organise mon anniversaire le **samedi 26 septembre** chez moi, avec **4 amis**. Je veux un jeu façon Mario Party qui sert de fil rouge à toute la soirée (de 18h jusqu'à tard) : les activités de la soirée rapportent des points, et un plateau numérique affiché sur la télé relie le tout.

À la fin de la soirée, le joueur avec le plus de points gagne un **bon de 20 €**.

**Délai : le site doit être fonctionnel et testé avant samedi.** Priorité à une version minimale fiable plutôt qu'à beaucoup de fonctionnalités.

## Les rôles

- **4 joueurs** : mes amis. Ils jouent depuis leur téléphone.
- **L'hôte** : moi. Je pilote la partie depuis mon téléphone. **Je ne gagne jamais de points** (je participe à certaines activités mais mes gains éventuels sont redistribués ou ignorés, voir plus bas).

**Participation de l'hôte.** L'hôte peut jouer dans certains mini-jeux, mais il ne gagne jamais de GP. Sa présence ne doit **jamais** faire perdre de points à un joueur, ni directement ni indirectement : il ne peut ni prendre un rôle qui rapporte des points, ni retirer une chance de gain à un joueur. Il ne participe qu'aux jeux où cette règle est garantie par le code.
Exception : au poker, l'hôte joue normalement. Les jetons sont offerts et non pris sur les GP des joueurs, et le tapis de l'hôte est redistribué à parts égales en fin de partie.

## Architecture technique

- **Serveur local** sur mon PC : Node.js + Express + Socket.IO. Tout passe par le réseau Wi-Fi de mon appartement, pas d'hébergement.
- L'état du jeu est détenu **uniquement par le serveur**.
- **Sauvegarde automatique** de l'état dans un fichier JSON à chaque modification, et rechargement au démarrage. Si le serveur plante en pleine soirée, on reprend là où on en était.
- Penser à l'autorisation du port dans le pare-feu Windows (me le rappeler dans les instructions de lancement).

### Trois pages

**`/tv` — affichage seul**

- Ouverte sur le **navigateur intégré de la télé**, qui est loin du PC.
- **Aucune interaction** (ou quasiment) : je ne veux pas utiliser la télécommande. Tout est piloté par les pages hôte et joueur.
- Navigateur de télé = potentiellement lent et peu à jour : JavaScript simple et compatible (éviter les syntaxes très récentes, ou transpiler), animations légères, pas de dépendances lourdes.
- Textes très **grands et lisibles à distance**, contrastes forts.
- Reconnexion automatique au serveur en cas de coupure, sans action de ma part.
- Affiche un **QR code** pointant vers la page joueur (IP locale du PC) sur l'écran d'accueil.

**`/joueur` — téléphones des amis**

- Rejoindre avec un pseudo.
- Identifiant stocké côté téléphone (localStorage) pour **retrouver sa place après une mise en veille ou un rechargement**.
- Actions : mise secrète, choix quand c'est son tour, buzzer au Jeopardy, consultation de ses propres points.
- Interface simple, gros boutons, utilisable d'une main.

**`/hote` — mon téléphone**

- Contrôle complet de la partie : lancer les phases, valider les résultats, choisir les mini-jeux, révéler les scores.
- **Saisie et correction manuelle des points à tout moment** (filet de sécurité pour tout ce qui se passe hors écran).
- Un bouton « annuler la dernière action » serait très utile.

## Les règles fondamentales

### Les points : les GP (« gaming points »)

Les GP servent à la fois de monnaie (pour miser) et de score (pour gagner le bon).

### Règle d'or : aucun affrontement direct

**Aucun joueur ne peut, par ses choix, retirer des GP à un autre joueur ou le faire reculer.** Il n'y a aucun affrontement direct. Si quelqu'un a été très bon dans les activités, les autres ne doivent pas pouvoir s'acharner sur lui pour lui faire perdre le lot.

Un joueur ne peut perdre des GP ou reculer que par ses propres choix (mise du dé, roue) ou par le hasard du plateau (cartes malchance, événements). Une carte tirée au hasard peut, elle, faire payer ou avancer quelqu'un : ce n'est pas un choix du joueur qui est tombé dessus.

## Le plateau

- Course qui dure toute la soirée. Des tours de plateau ont lieu entre les activités. Le chemin est une grille en zigzag qui monte : départ en bas à gauche, arrivée en haut. Tout le plateau tient à l'écran, sans caméra ni défilement.
- La télé découpe l'écran en zones fixes qui ne se recouvrent pas : fiches des joueurs dans l'ordre de passage, en-tête qui nomme le joueur concerné, zone du plateau, cagnotte. Le dé, la carte d'effet et les annonces apparaissent au centre de la zone plateau, puis disparaissent. Rien de tout cela n'est visible pendant les sauts.
- Longueur à calibrer d'après le nombre de tours prévus. Un dé normal (1 à 6) moyenne 3,5. Le dé boosté (1 à 7) moyenne 4. Le super dé (1 à 8) moyenne 4,5. La configuration actuelle est de 38 cases. **La longueur doit être configurable.**
- Déplacement : **un dé tiré par le serveur**, à 6, 7 ou 8 faces selon l'option choisie. Chaque face est équiprobable. Enregistrer chaque lancer avec sa valeur, le nombre de faces, la mise et l'espérance du dé, soit (faces + 1) / 2 (utile pour les trophées de fin).

### Ordre de passage

L'ordre est tiré au sort une seule fois, au démarrage de la course, côté serveur. Il ne change plus de toute la partie. L'hôte peut le retirer au sort tant que le premier tour n'a pas commencé. Les joueurs déjà arrivés sont sautés.

### Déroulé d'un tour

1. **Choix du mini-jeu** : un joueur choisit le mini-jeu du tour parmi ceux encore disponibles (voir plus bas). Au tour N, c'est le joueur à la position (N − 1) modulo le nombre de joueurs dans l'ordre de passage. Le réglage `choixMiniJeu` vaut `rotation` (par défaut) ou `dernierAuClassement` (le joueur qui a le moins de GP visibles choisit).
2. **Mini-jeu** : les joueurs s'affrontent, les GP sont attribués.
3. **Déplacements**, dans l'ordre de passage. Quand c'est son tour, le joueur choisit un dé, puis lance.
   - Dé normal : 1 à 6, gratuit.
   - Dé boosté : 1 à 7, 5 GP.
   - Super dé : 1 à 8, 10 GP.
   - Le choix et le lancer forment une seule action. Elle débite la mise, l'ajoute à la cagnotte, tire le dé uniformément, déplace le pion et applique l'effet de la case. Une seule annulation remet tout en place.
   - Une option trop chère pour le solde visible est refusée.
   - L'hôte peut lancer à la place d'un joueur absent, avec le dé normal par défaut.
   - La mise n'est pas secrète : la télé annonce le dé choisi.

### Types de cases

Cinq types, sur les cases 1 à 37 :

- **Bonus** (11) : +5 GP.
- **Chance** (9) : une carte chance, piochée au hasard.
- **Malchance** (5) : une carte malchance. Plus rare que ce qui fait gagner. Jamais sur les cases 1 à 3, jamais deux d'affilée.
- **Cagnotte** (6) : le joueur récupère la moitié de la cagnotte (arrondi à l'entier inférieur).
- **Gamble** (6) : la roue. Le joueur mise entre 0 et son solde visible, puis le serveur tire un résultat. 0 passe le tour. Jamais sur les cases 1 à 3, jamais deux d'affilée.

Il n'y a plus de duel.

### Boutique du tour (à confirmer, secondaire)

Idée discutée pour donner de la valeur à l'ordre de passage : à chaque tour, une boutique propose (nombre de joueurs − 1) offres, choisies dans l'ordre de passage. Les offres ne touchent jamais au déplacement et n'affectent que celui qui les prend : coffre mystère (0 à 15 GP), multiplicateur ×2 sur la prochaine activité, petit gain garanti. **À ne développer que si le reste est terminé.**

## Les mini-jeux

- Environ **10 mini-jeux** au total, définis dans un **fichier de configuration JSON** que je peux éditer facilement (nom, courte description des règles, type).
- La page hôte affiche une **grille des mini-jeux disponibles**. Je sélectionne celui demandé par le joueur. Un mini-jeu joué est marqué comme utilisé.
- La télé affiche le mini-jeu choisi et ses règles.
- La plupart des mini-jeux se jouent en vrai : l'hôte saisit simplement les GP gagnés par chacun.

### Le Jeopardy (mini-jeu intégré au site)

- Grille classique catégories × valeurs, **contenu défini dans un fichier JSON** (catégories, questions, réponses, valeurs).
- L'hôte sélectionne une case → la question s'affiche sur la télé.
- Les joueurs **buzzent depuis leur téléphone** ; la télé affiche qui a buzzé en premier.
- L'hôte valide la réponse (correcte / incorrecte). Si incorrecte, le buzzer se rouvre pour les autres.
- Pénalité en cas de mauvaise réponse : **à confirmer** (par défaut, aucune).
- Les cases jouées sont grisées.

## Les activités en vrai (saisie des points par l'hôte)

### Tournoi de ping-pong (18h–19h30 environ, salle extérieure)

- Tournoi à 5 (les 4 joueurs + moi), chacun affronte chacun une fois : 10 matchs.
- Matchs en **7 points**.
- Chaque point marqué = **1 GP** (`gpParPoint` dans `config/pingpong.json`).
- **Contre moi, chaque point marqué vaut 2 GP** (`gpParPointContreHote`), quelle que soit l'issue du match. **Ce bonus est secret** : les GP du tournoi ne doivent **pas** être affichés en direct. Je saisis les scores des matchs, et le décompte en GP est révélé d'un coup à la fin du tournoi.
- Formule papier : `GP = points_vs_joueurs × gpParPoint + points_vs_hote × gpParPointContreHote` (4 matchs entre joueurs + matchs contre l'hôte).
- Je ne gagne pas de GP.

### Poker (après le repas)

- Chaque joueur reçoit **20 GP de jetons offerts** (jamais ses propres GP).
- Durée fixe : **30 minutes**. Blinds 1/2 au départ, **doublées toutes les 10 minutes**.
- Un joueur peut **se retirer à tout moment** : il garde la moitié de son tapis, l'autre moitié va dans le prochain pot joué par les autres.
- Je participe à la partie ; **à la fin, mon tapis est réparti équitablement entre les joueurs**.
- À la fin, jetons convertis en GP à 1 pour 1.
- La télé affiche le **minuteur et le niveau de blind en cours**. Jetons physiques, l'hôte saisit les résultats.

### Missions secrètes

Chaque joueur reçoit des missions à accomplir discrètement pendant la soirée. Détails à définir ; prévoir simplement la saisie manuelle des GP.

### Échelle attendue

Ping-pong : environ 5 à 35 GP par joueur avec le barème retenu (1 GP / point, 2 GP contre l'hôte). Poker : 0 à 40. Les valeurs du plateau (cases, mises, trophées, récompenses d'arrivée) doivent rester cohérentes avec cette échelle.

## La phase finale

Dès qu'un joueur atteint l'arrivée, le tour en cours va jusqu'au bout : les autres jouent encore, et plusieurs peuvent donc arriver. Aucun nouveau tour ne commence ensuite. L'hôte peut toujours terminer la course plus tôt.

La cérémonie, pilotée par l'hôte et annulable étape par étape :

1. **Fin de la course** : la télé affiche le podium, dans l'ordre d'arrivée. Des GP d'arrivée sont versés alors selon `recompenseArrivee` dans `config/plateau.json` (retenu : 25 / 15 / 8 / 0 pour le 1er au 4e, source `arrivee`), et affichés sur le podium.
2. **Trophées de rattrapage** : le serveur en tire 4 parmi ceux qui sont attribuables (`nombreCeremonie` dans `config/trophees.json`). S'il y en a moins, ils sont tous décernés. L'hôte voit la liste à l'avance. La télé révèle chaque trophée à son tour : le nom, un moment de suspense, puis les gagnants. En cas d'égalité, tous le reçoivent. La remontée depuis la dernière place jusqu'à l'arrivée s'appelle Remontada légendaire et rapporte un bonus.
3. **Classement final** : les joueurs du dernier au deuxième, avec leur total.
4. **Gagnant** : il apparaît en grand et remporte le bon de 20 €.

### Trophées de rattrapage

- Le catalogue est dans `config/trophees.json`. Les critères tiennent compte de la taille du dé lancé, des cartes malchance, des cases reculées, des GP donnés, des GP gagnés hors plateau, du ping-pong, des mises à la roue, du total misé, de l'arrivée, de la remontée dans la course et du classement GP.
- Valeur : environ 10 à 15 GP chacun (à peu près 10 % du score moyen attendu), plus le bonus de la Remontada légendaire.

## Écrans de la télé (résumé)

Accueil avec QR code et joueurs connectés · plateau et tableau des scores · tirage de l'ordre de passage · grille des mini-jeux et règles du jeu en cours · Jeopardy (grille, question, buzzer) · minuteur du poker · révélation des GP du ping-pong · dernier tour · podium de la course · trophées de rattrapage · classement final · gagnant.

## Priorités de développement

1. **Socle** : serveur, connexion des joueurs, tableau des scores sur la télé, saisie manuelle des GP par l'hôte, sauvegarde JSON. Avec ça seul, la soirée fonctionne déjà.
2. **Plateau** : ordre de passage tiré une fois, mise au moment de lancer le dé, cases, cagnotte.
3. **Mini-jeux** : grille chez l'hôte, affichage télé, Jeopardy avec buzzers.
4. **Activités** : révélation différée du ping-pong, minuteur du poker.
5. **Finale** : fin de la course, trophées de rattrapage, classement final et gagnant.
6. **Bonus** : boutique du tour, animations.

**Tester avant samedi** avec la télé et au moins 2 ou 3 téléphones, idéalement une partie complète.

## Points encore ouverts

- Liste des ~10 mini-jeux et contenu du Jeopardy.
- Pénalité ou non au Jeopardy.
- Barème d'Undercover et des missions secrètes.
- Défi final.
- Boutique du tour : oui ou non.
- Valeurs exactes des cases et longueur du plateau.
