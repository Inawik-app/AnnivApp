# GP exploiteur

Soirée d'anniversaire en local : une télé, des téléphones, un PC hôte. Cette version pose le socle (serveur, temps réel, scores, sauvegarde). Le plateau et les mini-jeux ne sont pas encore là.

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
