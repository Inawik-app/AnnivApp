# Cahier des charges — « Mario Party » d'anniversaire

## Contexte

Je suis développeur et j'organise mon anniversaire le **samedi 26 septembre** chez moi, avec **4 amis**. Je veux un jeu façon Mario Party qui sert de fil rouge à toute la soirée (de 18h jusqu'à tard) : les activités de la soirée rapportent des points, et un plateau numérique affiché sur la télé relie le tout.

À la fin de la soirée, le joueur avec le plus de points gagne un **bon de 20 €**.

**Délai : le site doit être fonctionnel et testé avant samedi.** Priorité à une version minimale fiable plutôt qu'à beaucoup de fonctionnalités.

## Les rôles

- **4 joueurs** : mes amis. Ils jouent depuis leur téléphone.
- **L'hôte** : moi. Je pilote la partie depuis mon téléphone. **Je ne gagne jamais de points** (je participe à certaines activités mais mes gains éventuels sont redistribués ou ignorés, voir plus bas).

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

### Règle d'or : aucune interaction négative

**On ne peut jamais retirer des GP à un autre joueur.** Si quelqu'un a été très bon dans les activités, les autres ne doivent pas pouvoir s'acharner sur lui pour lui faire perdre le lot. Un joueur peut perdre ses propres GP par ses propres choix (miser), et des GP peuvent être redistribués pour faire gagner les autres, mais aucune mécanique ne permet de toucher aux points d'autrui.

Toute carte, case ou effet doit respecter cette règle.

## Le plateau

- Course **linéaire** qui dure toute la soirée. Des tours de plateau ont lieu entre les activités.
- Longueur à calibrer d'après le nombre de tours prévus : le dé moyen fait 3,5, donc pour environ 10 tours, prévoir 32 à 35 cases pour que le premier arrive vers la fin de soirée. **La longueur doit être configurable.**
- Déplacement : **1 dé à 6 faces tiré par le serveur**. Enregistrer tous les lancers (utile pour les trophées de fin).

### Déroulé d'un tour

1. **Mise secrète** : chaque joueur mise des GP sur son téléphone. La télé révèle toutes les mises en même temps.
   - La mise détermine **uniquement l'ordre de passage**. Elle ne modifie jamais le déplacement ni les probabilités du dé.
   - Mise maximale : **10 GP** (configurable). Mise de 0 autorisée.
   - En cas d'égalité, **le joueur avec le moins de GP passe devant**.
   - Les GP misés vont dans une **cagnotte** au centre du plateau.
2. **Choix du mini-jeu** : un joueur choisit le mini-jeu du tour parmi ceux encore disponibles (voir plus bas). *Qui choisit est à confirmer : a priori le premier dans l'ordre de passage.*
3. **Mini-jeu** : les joueurs s'affrontent, les GP sont attribués.
4. **Déplacements** : dans l'ordre de passage, chaque joueur lance le dé et avance, puis l'effet de sa case s'applique.

### Types de cases

- **Bonus** : gain de quelques GP (autour de 5).
- **Cagnotte** : le joueur récupère la moitié de la cagnotte.
- **Chance** : carte événement, **uniquement positive ou neutre**.
- **Duel** : défi en vrai contre un autre joueur (pierre-feuille-ciseaux, un point de ping-pong…), chacun ne mise que ses propres GP. L'hôte saisit le résultat.

### Boutique du tour (à confirmer, secondaire)

Idée discutée pour donner de la valeur à l'ordre de passage : à chaque tour, une boutique propose (nombre de joueurs − 1) offres, choisies dans l'ordre de passage. Les offres ne touchent jamais au déplacement et n'affectent que celui qui les prend : coffre mystère (0 à 15 GP), multiplicateur ×2 sur la prochaine activité, carte pouvoir supplémentaire pour la finale, petit gain garanti. **À ne développer que si le reste est terminé.**

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
- Chaque point marqué = **3 GP**.
- **Contre moi, chaque point marqué vaut 6 GP**, quelle que soit l'issue du match. **Ce bonus est secret** : les GP du tournoi ne doivent **pas** être affichés en direct. Je saisis les scores des matchs, et le décompte en GP est révélé d'un coup à la fin du tournoi.
- Je ne gagne pas de GP.

### Apéro (environ 1h, pendant la cuisson du repas)

- **Qui suis-je ?** (post-it sur le front) : 15 / 10 / 5 GP aux trois premiers qui trouvent.
- **Undercover** (mots sur papier) : barème à définir.
- Total visé pour l'apéro : 20 à 40 GP par joueur maximum. Saisie manuelle.
- Pas d'écran pendant ces jeux (mains prises).

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

Ping-pong : 40 à 80 GP par joueur environ. Poker : 0 à 40. Apéro : 20 à 40. Les valeurs du plateau (cases, mises, trophées) doivent rester cohérentes avec cette échelle.

## La phase finale

### Draft des pouvoirs

Quand la course se termine, chaque joueur choisit une carte pouvoir **dans l'ordre d'arrivée sur le plateau** (le premier arrivé choisit en premier). C'est ce qui donne de l'intérêt à arriver en premier, sans que l'arrivée soit un simple gros bonus de points. Pouvoirs, tous uniquement sur soi :

- **Doublé** : gains du défi final ×2.
- **Pari sur soi** : on mise des GP sur sa victoire au défi final ; si victoire, triplés, sinon perdus.
- **Assurance** : au moins 10 GP au défi final quoi qu'il arrive.
- **Tout ou rien** : lancer de dé ; sur 5 ou 6, gros gain, sinon rien.

*Le défi final reste à définir.*

### Trophées de rattrapage (façon Mario Party)

- Une liste de 6 à 8 trophées, dont **seulement 3 ou 4 tirés au hasard** sont révélés à la fin (personne ne sait lesquels à l'avance).
- Valeur : environ 10 à 15 GP chacun (à peu près 10 % du score moyen attendu).
- Calcul automatique quand c'est possible :
  - **Le plus malchanceux** : somme des dés la plus en dessous de la moyenne attendue.
  - **Trophée du dernier** : dernier au tournoi de ping-pong.
  - **Le plus généreux** : celui qui a le plus alimenté la cagnotte.
  - **Le prudent** : celui qui a le moins misé.
  - **L'audacieux** : le plus de choix risqués.
  - **Le touriste** : dernier arrivé sur le plateau.
- Révélation une par une sur la télé, puis **classement final** et annonce du gagnant du bon.

## Écrans de la télé (résumé)

Accueil avec QR code et joueurs connectés · plateau et tableau des scores · révélation des mises · grille des mini-jeux et règles du jeu en cours · Jeopardy (grille, question, buzzer) · minuteur du poker · révélation des GP du ping-pong · draft des pouvoirs · cérémonie des trophées · classement final.

## Priorités de développement

1. **Socle** : serveur, connexion des joueurs, tableau des scores sur la télé, saisie manuelle des GP par l'hôte, sauvegarde JSON. Avec ça seul, la soirée fonctionne déjà.
2. **Plateau** : mises secrètes, ordre de passage, dé, cases, cagnotte.
3. **Mini-jeux** : grille chez l'hôte, affichage télé, Jeopardy avec buzzers.
4. **Activités** : révélation différée du ping-pong, minuteur du poker.
5. **Finale** : draft des pouvoirs, trophées, classement.
6. **Bonus** : boutique du tour, animations.

**Tester avant samedi** avec la télé et au moins 2 ou 3 téléphones, idéalement une partie complète.

## Points encore ouverts

- Qui choisit le mini-jeu à chaque tour.
- Liste des ~10 mini-jeux et contenu du Jeopardy.
- Pénalité ou non au Jeopardy.
- Barème d'Undercover et des missions secrètes.
- Défi final.
- Boutique du tour : oui ou non.
- Valeurs exactes des cases et longueur du plateau.
