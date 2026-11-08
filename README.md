# GP exploiteur

Jeu de plateau façon Mario Party, codé pour servir de fil rouge à une soirée d'anniversaire entre amis. Le plateau s'affiche sur la télé, chaque invité joue depuis son téléphone et l'hôte pilote la partie depuis le sien. Les activités de la soirée rapportent des points (les « GP »), et le meilleur score gagne à la fin.

Tout tourne sur un PC du salon, en réseau local : pas d'hébergement, pas de compte à créer. On scanne un QR code et on joue.

## Ce que fait l'application

- **Plateau** avec dés, cases bonus, chance, malchance, duel et cagnotte.
- **Une dizaine de mini-jeux** adaptés pour la soirée : Jeopardy, Codenames, Just One, Perudo, Undercover, Top Ten, course, roue, accompagnement d'une partie de poker avec de vrais jetons…
- **Trois écrans synchronisés en temps réel** : la télé (affichage seul), les téléphones des joueurs, le téléphone de l'hôte.
- **Résistant aux imprévus** : sauvegarde automatique de l'état à chaque action, reconnexion automatique de la télé, reprise de sa place après la mise en veille d'un téléphone.
- **Compatible avec le navigateur d'une vieille télé** : code transpilé pour des navigateurs anciens, page de diagnostic dédiée.
- **Équilibrage simulé** : des scripts simulent des parties complètes pour régler les barèmes.

## Choix techniques

- L'état du jeu est détenu uniquement par le serveur, et modifié par un réducteur pur (testable sans réseau).
- Chaque écran reçoit sa propre vue de l'état : un joueur ne voit jamais les informations secrètes des autres (rôles d'Undercover, cartes…).
- Les règles et le contenu (questions, cartes, barèmes) sont dans `config/`, séparés du code.
- Tests unitaires (Vitest) sur la logique de chaque jeu, plus des tests de bout en bout.

## Stack

Node.js · Express · Socket.IO · TypeScript · Preact · Vite · Vitest

---

## Installation

Node.js 20 ou plus récent.

```bat
npm install
```

Avant la soirée, change le code hôte dans `config/partie.json` (`codeHote`). Si la mauvaise adresse est proposée, mets l'IPv4 du Wi-Fi dans `ipForcee`.

## Lancer

Développement (un seul port, rechargement à chaud) :

```bat
npm run dev
```

Le terminal affiche les URL de la télé, des joueurs et de l'hôte, avec l'adresse IP locale. Par défaut le port est 3000.

| Page | Rôle |
| --- | --- |
| `/` | Choix TV, Joueur, Hôte |
| `/tv` | Écran de la télé |
| `/joueur` | Téléphone d'un invité |
| `/hote` | Commandes de l'hôte |
| `/diag.html` | Diagnostic autonome de la télé |

Le slash final est accepté (`/tv` et `/tv/`).

Deux onglets joueur distincts : `/joueur?profil=1` et `/joueur?profil=2`.

Tests et production :

```bat
npm test
npm run build
npm start
```

`lancer-soiree.bat` enchaîne la construction et le démarrage.

## Test sur la télé

En développement, la télé peut refuser les modules JavaScript récents. Pour la tester, construis puis sers le build :

```bat
npm run build
npm start
```

Ouvre `http://IP-DU-PC:3000/tv` sur la télé, et `http://IP-DU-PC:3000/diag.html` si l'application ne se charge pas. Le résultat du diagnostic s'affiche sur la page hôte.

## Checklist du jour J

- Profil réseau Windows en « Privé ». À la première alerte du pare-feu, autorise Node.js sur les réseaux privés. Sinon, dans PowerShell administrateur :

```powershell
New-NetFirewallRule -DisplayName "GP exploiteur" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Private
```

- Mise en veille du PC désactivée, Windows Update suspendu, PC sur secteur, de préférence en Ethernet.
- Télé : arrêt automatique après inactivité désactivé, `/tv` en favori.
- Invités connectés au Wi-Fi principal, pas au réseau invité (souvent isolé des autres appareils).
