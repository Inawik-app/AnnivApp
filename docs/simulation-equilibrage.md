# Simulation d'équilibrage

Graine maîtresse : 20260926. 1000 parties par scénario, plus une partie détaillée dont la graine est indiquée. Durée du calcul : 70.1 s.

Les quatre joueurs jouent chaque partie dans un ordre tiré au sort. Ils commencent avec les GP du tournoi de ping-pong : 3 GP par point marqué contre un joueur, 6 GP par point marqué contre l'hôte, sur 4 matchs en 7 points.

| Joueur | Profil | Points par match | GP de départ |
| --- | --- | ---: | ---: |
| A | Très faible | 1 | 15 |
| B | Moyen | 4 | 60 |
| C | Bon | 6 | 90 |
| D | Parfait | 7 | 105 |

## Hypothèses

Identiques pour les trois scénarios. Le simulateur appelle le vrai réducteur, les vrais tirages et `trophees(etat)`.

- **Dé et roue.** Prudent : toujours le dé normal ; mise 0 à la roue dans 80 % des cas, 5 GP sinon. Moyen : dé normal 30 %, boosté 50 %, super dé 20 % ; mise d'environ 15 % du solde visible, arrondie. Fort : toujours le super dé s'il est abordable, sinon le dé boosté ; mise de 50 % du solde visible. Si une option n'est pas abordable, le joueur prend la plus forte qu'il peut se payer.
- **Mini-jeu à chaque tour.** Parmi ceux de `config/mini-jeux.json` qui n'ont pas encore été joués. Ensuite, au hasard parmi les mini-jeux physiques, qui peuvent donc revenir.
- **Physiques.** Classement ou équipes tirés au hasard, puis la vraie fonction de score.
- **Jeopardy.** 16 questions. Le choisisseur répond juste dans 70 % des cas. Sinon, un autre joueur tiré au hasard vole la question dans 50 % des cas.
- **Top Ten.** L'ordre du Cap'Ten est le bon ordre, perturbé par 0, 1 ou 2 échanges entre voisins, équiprobables. Chaque numéro est deviné exactement avec une probabilité de 30 %.
- **Undercover.** Les civils gagnent 70 % des manches. Un undercover éliminé devine le mot dans 30 % des cas.
- **Poker.** 100 GP de jetons (4 × 20, plus les 20 de l'hôte), redistribués par 40 transferts d'un jeton, puis convertis par le vrai calcul.
- **Apéro.** Une fois, le premier tour où un pion a atteint la moitié du plateau : entre 20 et 40 GP par joueur. S'il n'a pas eu lieu, il est donné juste avant la cérémonie.
- **Missions secrètes.** Ignorées.
- **Fin.** Dernier tour dès la première arrivée, puis cérémonie des trophées (`nombreCeremonie`).

## 1 — Prudent

### Durée

| | Tours |
| --- | ---: |
| Moyenne | 9,5 |
| Minimum | 5 |
| Maximum | 13 |

### Scores finaux

| Joueur | Moyenne | Écart-type | Minimum | Maximum |
| --- | ---: | ---: | ---: | ---: |
| A | 175,1 | 21,5 | 110 | 239 |
| B | 201,6 | 21,4 | 141 | 287 |
| C | 237,5 | 21,8 | 176 | 310 |
| D | 242,3 | 20,0 | 184 | 327 |

### Victoires

Une victoire compte même en cas d'ex aequo : les probabilités peuvent donc dépasser 100 % au total.

| Joueur | Victoires |
| --- | ---: |
| A | 0,4 % |
| B | 3,6 % |
| C | 40,2 % |
| D | 57,2 % |
| Ex aequo | 1,4 % |

### Écart 1er – 2e

21,6 GP en moyenne.

### Origine des GP

Moyenne par joueur. La roue est nette (mises soustraites). Les mises au dé sont négatives.

| Source | A | B | C | D |
| --- | ---: | ---: | ---: | ---: |
| ping-pong | 15,0 | 60,0 | 90,0 | 105,0 |
| bonus | 13,4 | 13,2 | 13,2 | 13,0 |
| chance | 6,8 | 6,7 | 6,5 | 6,8 |
| malchance | -2,1 | -1,9 | -1,9 | -2,0 |
| cagnotte | 1,4 | 1,5 | 1,5 | 1,5 |
| roue (nette) | 0,1 | 0,1 | -0,0 | 0,1 |
| mises au dé | 0,0 | 0,0 | 0,0 | 0,0 |
| apéro | 30,0 | 29,7 | 30,1 | 29,9 |
| poker | 26,0 | 24,7 | 24,6 | 24,4 |
| trophées | 24,6 | 12,4 | 13,4 | 11,9 |
| mini-jeu : Jeopardy | 11,5 | 11,6 | 12,0 | 12,3 |
| mini-jeu : Mémoire express | 9,8 | 9,6 | 9,6 | 8,0 |
| mini-jeu : Mime express | 11,1 | 7,5 | 10,9 | 7,0 |
| mini-jeu : Pong gobelets | 10,2 | 9,1 | 9,8 | 6,9 |
| mini-jeu : Top Ten | 8,2 | 8,1 | 8,2 | 8,2 |
| mini-jeu : Undercover | 9,3 | 9,2 | 9,6 | 9,4 |

### Économie

| | Valeur |
| --- | ---: |
| GP misés au dé, moyenne par partie | 0,0 |
| GP misés à la roue, moyenne par partie | 6,4 |
| Cagnotte maximale moyenne | 7,2 |
| Cagnotte maximale observée | 18 |
| Cagnotte restante en fin de partie | 2,9 |
| Jackpots, moyenne par partie | 0,0 |

### Course

| Joueur | Position finale moyenne |
| --- | ---: |
| A | 32,0 |
| B | 32,2 |
| C | 31,8 |
| D | 32,1 |

Arrivées multiples au dernier tour : 25,2 %.

### Trophées

La colonne des gagnants est la part des parties où ce joueur reçoit le trophée, y compris les partages.

| Trophée | Attribuable | Tiré | A | B | C | D |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Le plus malchanceux | 100,0 % | 55,0 % | 15,7 % | 15,2 % | 15,7 % | 13,7 % |
| Le poissard | 97,0 % | 51,1 % | 18,8 % | 18,2 % | 17,7 % | 18,3 % |
| Marche arrière | 96,2 % | 53,3 % | 15,0 % | 13,1 % | 16,1 % | 16,4 % |
| Le plus généreux | 94,3 % | 51,0 % | 19,4 % | 18,7 % | 19,2 % | 18,2 % |
| Pas verni aux jeux | 100,0 % | 52,7 % | 50,6 % | 2,6 % | 0,0 % | 0,0 % |
| Dernier au ping-pong | 100,0 % | 51,1 % | 51,1 % | 0,0 % | 0,0 % | 0,0 % |
| Le flambeur | 73,9 % | 36,2 % | 11,7 % | 11,6 % | 13,4 % | 12,1 % |
| Le prudent | 73,9 % | 29,4 % | 18,2 % | 19,1 % | 18,9 % | 17,6 % |
| Le touriste | 0,4 % | 0,1 % | 0,1 % | 0,0 % | 0,0 % | 0,0 % |
| Contre toutes attentes | 0,4 % | 0,0 % | 0,0 % | 0,0 % | 0,0 % | 0,0 % |
| Retour gagnant | 42,0 % | 20,1 % | 4,7 % | 5,2 % | 10,4 % | 3,0 % |

### Partie type

Graine 3271248641.

- Tour 1 — A case 3 · 20 GP ; B case 2 · 71 GP ; C case 3 · 95 GP ; D case 4 · 115 GP — C cagnotte, B cagnotte, A cagnotte, D bonus
- Tour 2 — A case 8 · 32 GP ; B case 4 · 82 GP ; C case 4 · 110 GP ; D case 5 · 142 GP — C bonus, B bonus, A roue passe, D roue passe
- Tour 3 — A case 13 · 63 GP ; B case 6 · 116 GP ; C case 10 · 127 GP ; D case 11 · 165 GP — C roue passe, B bonus, A cagnotte, D chance +4
- Tour 4 — A case 19 · 78 GP ; B case 10 · 119 GP ; C case 11 · 138 GP ; D case 12 · 171 GP — C bonus, B roue passe, A bonus, D bonus
- Tour 5 — A case 20 · 130 GP ; B case 12 · 159 GP ; C case 12 · 195 GP ; D case 18 · 213 GP — C bonus, B bonus, A cagnotte, D chance
- Tour 6 — A case 18 · 138 GP ; B case 19 · 167 GP ; C case 18 · 205 GP ; D case 19 · 220 GP — C chance, B chance +2, A malchance -4, D bonus
- Tour 7 — A case 20 · 145 GP ; B case 22 · 174 GP ; C case 20 · 206 GP ; D case 20 · 224 GP — C cagnotte, B malchance, A cagnotte, D cagnotte
- Tour 8 — A case 20 · 153 GP ; B case 28 · 176 GP ; C case 23 · 219 GP ; D case 21 · 226 GP — C bonus, B roue passe, A malchance -2, D roue passe
- Tour 9 — A case 23 · 160 GP ; B case 30 · 184 GP ; C case 25 · 227 GP ; D case 23 · 233 GP — C roue passe, B chance, A bonus, D bonus
- Tour 10 — A case 29 · 168 GP ; B case 31 · 198 GP ; C case 29 · 235 GP ; D case 28 · 235 GP — C cagnotte, B chance, A cagnotte, D roue passe
- Tour 11 — A case 31 · 183 GP ; B case 36 · 194 GP ; C case 31 · 245 GP ; D case 29 · 239 GP — C chance, B malchance, A chance, D cagnotte
- Tour 12 — A case 38 · 184 GP ; B case 37 · 202 GP ; C case 33 · 252 GP ; D case 29 · 243 GP — C chance, B chance, A chance +1, D malchance -3

## 2 — Moyen

### Durée

| | Tours |
| --- | ---: |
| Moyenne | 8,3 |
| Minimum | 5 |
| Maximum | 12 |

### Scores finaux

| Joueur | Moyenne | Écart-type | Minimum | Maximum |
| --- | ---: | ---: | ---: | ---: |
| A | 155,1 | 35,0 | 47 | 308 |
| B | 186,1 | 37,2 | 81 | 325 |
| C | 218,3 | 38,6 | 131 | 373 |
| D | 227,7 | 39,4 | 111 | 417 |

### Victoires

Une victoire compte même en cas d'ex aequo : les probabilités peuvent donc dépasser 100 % au total.

| Joueur | Victoires |
| --- | ---: |
| A | 3,2 % |
| B | 12,3 % |
| C | 36,4 % |
| D | 49,2 % |
| Ex aequo | 1,1 % |

### Écart 1er – 2e

39,3 GP en moyenne.

### Origine des GP

Moyenne par joueur. La roue est nette (mises soustraites). Les mises au dé sont négatives.

| Source | A | B | C | D |
| --- | ---: | ---: | ---: | ---: |
| ping-pong | 15,0 | 60,0 | 90,0 | 105,0 |
| bonus | 11,6 | 11,5 | 11,6 | 11,4 |
| chance | 9,5 | 9,6 | 9,6 | 9,6 |
| malchance | -1,6 | -1,9 | -1,5 | -1,7 |
| cagnotte | 25,9 | 26,8 | 26,0 | 27,0 |
| roue (nette) | 0,6 | 1,2 | 1,5 | 1,0 |
| mises au dé | -38,0 | -37,3 | -37,4 | -37,6 |
| apéro | 29,5 | 30,1 | 30,3 | 30,2 |
| poker | 25,9 | 24,7 | 24,2 | 24,7 |
| trophées | 21,7 | 11,6 | 11,1 | 11,2 |
| mini-jeu : Jeopardy | 11,7 | 11,7 | 11,6 | 12,2 |
| mini-jeu : Mémoire express | 8,0 | 7,3 | 7,6 | 6,1 |
| mini-jeu : Mime express | 8,8 | 5,8 | 8,5 | 5,6 |
| mini-jeu : Pong gobelets | 9,0 | 7,2 | 7,9 | 5,4 |
| mini-jeu : Top Ten | 8,2 | 8,4 | 8,3 | 8,3 |
| mini-jeu : Undercover | 9,2 | 9,3 | 9,0 | 9,5 |

### Économie

| | Valeur |
| --- | ---: |
| GP misés au dé, moyenne par partie | 150,3 |
| GP misés à la roue, moyenne par partie | 100,1 |
| Cagnotte maximale moyenne | 89,3 |
| Cagnotte maximale observée | 211 |
| Cagnotte restante en fin de partie | 59,7 |
| Jackpots, moyenne par partie | 0,0 |

### Course

| Joueur | Position finale moyenne |
| --- | ---: |
| A | 32,1 |
| B | 32,0 |
| C | 32,1 |
| D | 32,0 |

Arrivées multiples au dernier tour : 26,5 %.

### Trophées

La colonne des gagnants est la part des parties où ce joueur reçoit le trophée, y compris les partages.

| Trophée | Attribuable | Tiré | A | B | C | D |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Le plus malchanceux | 100,0 % | 47,8 % | 12,1 % | 12,0 % | 12,5 % | 13,5 % |
| Le poissard | 96,3 % | 44,1 % | 16,3 % | 17,5 % | 15,6 % | 17,0 % |
| Marche arrière | 95,1 % | 46,3 % | 13,9 % | 14,5 % | 12,2 % | 12,8 % |
| Le plus généreux | 90,5 % | 45,1 % | 15,4 % | 17,3 % | 16,8 % | 17,8 % |
| Pas verni aux jeux | 100,0 % | 47,0 % | 44,7 % | 2,3 % | 0,0 % | 0,0 % |
| Dernier au ping-pong | 100,0 % | 48,9 % | 48,9 % | 0,0 % | 0,0 % | 0,0 % |
| Le flambeur | 100,0 % | 50,3 % | 3,3 % | 10,5 % | 18,3 % | 19,2 % |
| Le prudent | 100,0 % | 41,3 % | 16,5 % | 11,3 % | 7,9 % | 7,6 % |
| Le touriste | 0,9 % | 0,2 % | 0,1 % | 0,1 % | 0,0 % | 0,0 % |
| Contre toutes attentes | 0,9 % | 0,1 % | 0,0 % | 0,1 % | 0,0 % | 0,0 % |
| Retour gagnant | 63,7 % | 28,9 % | 9,4 % | 11,3 % | 8,8 % | 5,5 % |

### Partie type

Graine 3271241577.

- Tour 1 — A case 7 · 34 GP ; B case 3 · 89 GP ; C case 7 · 113 GP ; D case 2 · 132 GP — A cagnotte, B bonus, C cagnotte, D bonus
- Tour 2 — A case 12 · 43 GP ; B case 6 · 83 GP ; C case 14 · 114 GP ; D case 3 · 131 GP — A bonus, B roue tout-perdre, C chance, D malchance -2
- Tour 3 — A case 13 · 51 GP ; B case 21 · 90 GP ; C case 15 · 122 GP ; D case 9 · 128 GP — A bonus, B chance +7, C bonus, D chance
- Tour 4 — A case 20 · 86 GP ; B case 23 · 147 GP ; C case 21 · 192 GP ; D case 11 · 166 GP — A bonus, B cagnotte, C cagnotte, D malchance
- Tour 5 — A case 24 · 91 GP ; B case 25 · 123 GP ; C case 25 · 164 GP ; D case 17 · 162 GP — A bonus, B roue tout-perdre, C roue tout-perdre, D bonus
- Tour 6 — A case 26 · 104 GP ; B case 31 · 180 GP ; C case 28 · 195 GP ; D case 21 · 179 GP — A chance, B cagnotte, C cagnotte, D cagnotte
- Tour 7 — A case 29 · 113 GP ; B case 35 · 189 GP ; C case 30 · 191 GP ; D case 27 · 182 GP — A roue rembourse, B bonus, C malchance, D malchance
- Tour 8 — A case 33 · 120 GP ; B case 38 · 186 GP ; C case 37 · 194 GP ; D case 37 · 190 GP — A chance, C roue +3 turbo, D chance +4

## 3 — Fort

### Durée

| | Tours |
| --- | ---: |
| Moyenne | 7,2 |
| Minimum | 5 |
| Maximum | 10 |

### Scores finaux

| Joueur | Moyenne | Écart-type | Minimum | Maximum |
| --- | ---: | ---: | ---: | ---: |
| A | 142,5 | 64,0 | 18 | 468 |
| B | 169,6 | 72,3 | 7 | 771 |
| C | 210,4 | 80,2 | 25 | 646 |
| D | 215,6 | 89,5 | 49 | 1 299 |

### Victoires

Une victoire compte même en cas d'ex aequo : les probabilités peuvent donc dépasser 100 % au total.

| Joueur | Victoires |
| --- | ---: |
| A | 10,8 % |
| B | 18,3 % |
| C | 36,2 % |
| D | 35,5 % |
| Ex aequo | 0,8 % |

### Écart 1er – 2e

75,2 GP en moyenne.

### Origine des GP

Moyenne par joueur. La roue est nette (mises soustraites). Les mises au dé sont négatives.

| Source | A | B | C | D |
| --- | ---: | ---: | ---: | ---: |
| ping-pong | 15,0 | 60,0 | 90,0 | 105,0 |
| bonus | 10,0 | 9,3 | 9,6 | 9,9 |
| chance | 12,6 | 13,0 | 11,6 | 11,4 |
| malchance | -1,4 | -1,3 | -1,3 | -1,4 |
| cagnotte | 49,1 | 48,1 | 51,9 | 49,0 |
| roue (nette) | 2,9 | 4,1 | 7,1 | 6,9 |
| mises au dé | -71,4 | -71,9 | -71,9 | -71,9 |
| apéro | 29,9 | 30,2 | 30,6 | 29,6 |
| poker | 25,1 | 23,9 | 23,9 | 23,8 |
| trophées | 23,2 | 10,8 | 11,9 | 11,4 |
| mini-jeu : Jeopardy | 10,8 | 11,1 | 11,5 | 12,1 |
| mini-jeu : Mémoire express | 5,9 | 5,6 | 6,1 | 4,6 |
| mini-jeu : Mime express | 6,9 | 4,6 | 6,6 | 4,4 |
| mini-jeu : Pong gobelets | 7,1 | 5,1 | 6,1 | 3,7 |
| mini-jeu : Top Ten | 7,9 | 8,0 | 7,8 | 8,0 |
| mini-jeu : Undercover | 8,9 | 9,1 | 9,0 | 9,2 |

### Économie

| | Valeur |
| --- | ---: |
| GP misés au dé, moyenne par partie | 287,0 |
| GP misés à la roue, moyenne par partie | 254,0 |
| Cagnotte maximale moyenne | 185,4 |
| Cagnotte maximale observée | 457 |
| Cagnotte restante en fin de partie | 123,1 |
| Jackpots, moyenne par partie | 0,0 |

### Course

| Joueur | Position finale moyenne |
| --- | ---: |
| A | 30,9 |
| B | 31,8 |
| C | 31,3 |
| D | 31,2 |

Arrivées multiples au dernier tour : 27,0 %.

### Trophées

La colonne des gagnants est la part des parties où ce joueur reçoit le trophée, y compris les partages.

| Trophée | Attribuable | Tiré | A | B | C | D |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Le plus malchanceux | 100,0 % | 49,0 % | 11,9 % | 10,6 % | 14,8 % | 15,2 % |
| Le poissard | 95,4 % | 41,6 % | 15,4 % | 14,2 % | 15,5 % | 17,1 % |
| Marche arrière | 91,2 % | 42,7 % | 11,7 % | 13,3 % | 12,0 % | 10,7 % |
| Le plus généreux | 85,7 % | 44,7 % | 19,2 % | 16,0 % | 19,4 % | 17,2 % |
| Pas verni aux jeux | 100,0 % | 50,2 % | 48,8 % | 1,5 % | 0,0 % | 0,0 % |
| Dernier au ping-pong | 100,0 % | 47,6 % | 47,6 % | 0,0 % | 0,0 % | 0,0 % |
| Le flambeur | 99,5 % | 48,2 % | 3,6 % | 10,3 % | 16,1 % | 18,4 % |
| Le prudent | 99,5 % | 40,5 % | 19,7 % | 13,0 % | 10,7 % | 9,7 % |
| Le touriste | 0,3 % | 0,1 % | 0,0 % | 0,0 % | 0,1 % | 0,0 % |
| Contre toutes attentes | 0,3 % | 0,0 % | 0,0 % | 0,0 % | 0,0 % | 0,0 % |
| Retour gagnant | 76,6 % | 35,4 % | 15,3 % | 11,4 % | 10,2 % | 6,4 % |

### Partie type

Graine 3271230289.

- Tour 1 — A case 4 · 17 GP ; B case 1 · 56 GP ; C case 2 · 97 GP ; D case 7 · 123 GP — C bonus, B malchance -4, A bonus, D cagnotte
- Tour 2 — A case 7 · 55 GP ; B case 9 · 72 GP ; C case 3 · 123 GP ; D case 9 · 145 GP — C cagnotte, B bonus, A cagnotte, D bonus
- Tour 3 — A case 9 · 66 GP ; B case 10 · 52 GP ; C case 9 · 121 GP ; D case 18 · 156 GP — C bonus, B roue moitie, A bonus, D chance +4
- Tour 4 — A case 16 · 76 GP ; B case 14 · 60 GP ; C case 14 · 121 GP ; D case 24 · 213 GP — C chance, B chance, A chance, D cagnotte
- Tour 5 — A case 21 · 116 GP ; B case 16 · 97 GP ; C case 15 · 102 GP ; D case 28 · 295 GP — C roue moitie, B chance, A chance, D cagnotte
- Tour 6 — A case 25 · 105 GP ; B case 21 · 89 GP ; C case 17 · 105 GP ; D case 35 · 305 GP — C bonus, B chance, A malchance, D chance
- Tour 7 — A case 29 · 120 GP ; B case 26 · 87 GP ; C case 19 · 110 GP ; D case 38 · 301 GP — C bonus, B bonus, A roue fois-1-5, D chance +2

## Observations

- 1 — Prudent : A ne gagne que 0,4 %. Sa chance réelle est faible dans ce style de mise.
- 2 — Moyen : A ne gagne que 3,2 %. Sa chance réelle est faible dans ce style de mise.
- 3 — Fort : la source « mises au dé » représente environ 287,0 GP en valeur absolue cumulée, pour un score moyen de 184,5.
- « Le touriste » n'est attribuable que dans 0,5 % des parties, tous scénarios confondus.
- « Contre toutes attentes » n'est attribuable que dans 0,5 % des parties, tous scénarios confondus.
- Le joueur très faible reste rarement vainqueur quand tout le monde joue prudent ou moyen. Le style fort lui rend une chance, avec une variance et une cagnotte beaucoup plus grandes. Le joueur parfait ne gagne pas presque toutes les parties.
- Pistes possibles, sans rien changer ici : resserrer l'écart de départ du ping-pong, ou rendre Le touriste et Contre toutes attentes plus souvent attribuables, si le rattrapage doit peser davantage.
- Aucune valeur de `config/` et aucune règle de jeu n'ont été modifiées pour produire ce rapport.
