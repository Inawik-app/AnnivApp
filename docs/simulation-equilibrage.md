# Simulation d'équilibrage

Graine maîtresse : 20260926. 1000 parties par scénario, plus une partie détaillée dont la graine est indiquée. Durée du calcul : 631.7 s.

Les quatre joueurs jouent chaque partie dans un ordre tiré au sort. Ils commencent avec les GP du tournoi de ping-pong : 1 GP par point contre un joueur, 2 GP par point contre l'hôte, sur 4 matchs (formule : points × (3 × gpParPoint + gpParPointContreHote)).

| Joueur | Profil | Points par match | GP de départ |
| --- | --- | ---: | ---: |
| A | Très faible | 1 | 5 |
| B | Moyen | 4 | 20 |
| C | Bon | 6 | 30 |
| D | Parfait | 7 | 35 |

## Hypothèses

Identiques pour les trois scénarios. Le simulateur appelle le vrai réducteur, les vrais tirages et `trophees(etat)`. Pas d'apéro.

| Mini-jeu | Hypothèse |
| --- | --- |
| Jeopardy | Valeurs actuelles, rotation du choisisseur. Juste à 85 / 70 / 55 / 40 % selon le niveau 1 à 4. Sinon, 50 % qu'un autre joueur tiré au hasard réussisse. |
| Top Ten | Ordre proposé = bon ordre avec 0, 1 ou 2 échanges de voisins (équiprobables). Chaque numéro exact à 30 %. |
| Undercover | 4 joueurs. Civils gagnent 70 % des manches ; undercover éliminé trouve le mot à 30 %. |
| Codenames | Équipes au hasard. Chaque manche gagnée 50/50 (cartes de l'équipe courante jusqu'à la victoire, ou assassin). |
| Perudo | Ordre d'élimination tiré uniformément au hasard (1 dé/joueur en simu pour la durée ; barème de classement inchangé). |
| Just One | Devineur trouve à 60 %. Chaque indice a 15 % de chance de copier un autre (hôte : doublon n'annule que l'hôte). Indices lettres seules (Zzza, Zzzb…). Un cycle (hôte inclus) en simu, contre 2 en soirée. |
| Poker | 100 GP de jetons (4 × 20 + hôte 20 redistribué), redistribution aléatoire raisonnable. |

- **Dé et roue.** Prudent : toujours le dé normal ; mise 0 à la roue dans 80 % des cas, 5 GP sinon. Moyen : dé normal 30 %, boosté 50 %, super dé 20 % ; mise d'environ 15 % du solde visible. Fort : toujours le super dé s'il est abordable ; 50 % du solde à la roue. Coup de pouce actif : toujours le dé gratuit (de7 → boosté, de8 → super).
- **Mini-jeu à chaque tour.** Parmi les 7 modules de `config/mini-jeux.json` pas encore joués ; ensuite au hasard parmi les 7.
- **Missions secrètes.** Ignorées.
- **Fin.** Dernier tour dès la première arrivée, podium, éventuelle cagnotte de consolation, trophées (`nombreCeremonie`), classement, gagnant.

## 1 — Prudent

### Durée

| | Tours |
| --- | ---: |
| Moyenne | 9,4 |
| Minimum | 5 |
| Maximum | 13 |

### Scores finaux

| Joueur | Moyenne | Écart-type | Minimum | Maximum |
| --- | ---: | ---: | ---: | ---: |
| A | 181,5 | 30,0 | 104 | 292 |
| B | 188,3 | 31,2 | 101 | 297 |
| C | 197,6 | 30,2 | 119 | 312 |
| D | 203,8 | 30,4 | 105 | 303 |

### Victoires

Une victoire compte même en cas d'ex aequo : les probabilités peuvent donc dépasser 100 % au total.

| Joueur | Victoires |
| --- | ---: |
| A | 12,9 % |
| B | 20,7 % |
| C | 30,6 % |
| D | 37,5 % |
| Ex aequo | 1,7 % |

### Écart 1er – 2e

22,8 GP en moyenne.

### Origine des GP

Moyenne par joueur. La roue est nette (mises soustraites). Les mises au dé sont négatives.

| Source | A | B | C | D |
| --- | ---: | ---: | ---: | ---: |
| ping-pong | 5,0 | 20,0 | 30,0 | 35,0 |
| bonus | 12,7 | 13,1 | 13,3 | 13,1 |
| chance | 6,9 | 6,6 | 6,7 | 6,7 |
| malchance | -1,8 | -1,9 | -1,9 | -1,9 |
| cagnotte | 1,5 | 1,3 | 1,3 | 1,3 |
| roue (nette) | -0,0 | 0,1 | -0,1 | -0,0 |
| arrivée | 27,9 | 27,8 | 27,2 | 27,0 |
| poker | 34,8 | 33,3 | 33,2 | 33,3 |
| trophées | 20,7 | 14,0 | 13,4 | 13,6 |
| mini-jeu : Codenames | 13,5 | 13,7 | 13,7 | 13,8 |
| mini-jeu : Jeopardy | 14,1 | 13,7 | 14,4 | 14,9 |
| mini-jeu : Just One | 15,6 | 15,8 | 15,9 | 15,9 |
| mini-jeu : Perudo | 6,7 | 6,9 | 6,8 | 6,7 |
| mini-jeu : Top Ten | 11,4 | 11,2 | 11,2 | 11,4 |
| mini-jeu : Undercover | 12,7 | 12,6 | 12,6 | 13,0 |

### Économie

| | Valeur |
| --- | ---: |
| GP misés au dé, moyenne par partie | 0,0 |
| GP misés à la roue, moyenne par partie | 6,2 |
| Cagnotte maximale moyenne | 6,8 |
| Cagnotte maximale observée | 22 |
| Cagnotte restante en fin de partie | 2,9 |
| Jackpots, moyenne par partie | 0,0 |

### Course

| Joueur | Position finale moyenne |
| --- | ---: |
| A | 32,2 |
| B | 32,2 |
| C | 32,1 |
| D | 32,1 |

Arrivées multiples au dernier tour : 25,1 %.

### Trophées

La colonne des gagnants est la part des parties où ce joueur reçoit le trophée, y compris les partages.

| Trophée | Attribuable | Tiré | A | B | C | D |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Le plus malchanceux | 100,0 % | 44,5 % | 12,4 % | 10,6 % | 14,0 % | 11,9 % |
| Le poissard | 96,5 % | 41,9 % | 13,2 % | 16,4 % | 15,2 % | 15,8 % |
| Marche arrière | 94,5 % | 42,8 % | 12,6 % | 12,3 % | 11,5 % | 14,0 % |
| Le plus généreux | 94,5 % | 41,2 % | 15,8 % | 15,7 % | 14,8 % | 17,1 % |
| Pas verni aux jeux | 100,0 % | 45,3 % | 21,3 % | 12,7 % | 7,1 % | 5,4 % |
| Dernier au ping-pong | 100,0 % | 44,6 % | 44,6 % | 0,0 % | 0,0 % | 0,0 % |
| Le flambeur | 70,6 % | 27,6 % | 10,0 % | 9,0 % | 7,9 % | 11,1 % |
| Le prudent | 70,6 % | 25,1 % | 15,9 % | 15,9 % | 15,1 % | 15,7 % |
| Le touriste | 100,0 % | 43,7 % | 12,3 % | 10,5 % | 12,8 % | 11,8 % |
| Contre toutes attentes | 49,9 % | 16,5 % | 4,0 % | 3,6 % | 4,4 % | 4,5 % |
| Retour gagnant | 70,4 % | 26,8 % | 10,6 % | 9,8 % | 8,4 % | 5,8 % |

### Partie type

Graine 3271252882.

- Tour 1 — A case 4 · 15 GP ; B case 5 · 31 GP ; C case 6 · 42 GP ; D case 5 · 51 GP — B bonus, C bonus, D bonus, A roue passe
- Tour 2 — A case 6 · 35 GP ; B case 10 · 40 GP ; C case 8 · 57 GP ; D case 6 · 65 GP — B chance, C chance, D bonus, A bonus
- Tour 3 — A case 8 · 72 GP ; B case 12 · 73 GP ; C case 13 · 77 GP ; D case 7 · 85 GP — B chance, C roue passe, D bonus, A chance
- Tour 4 — A case 9 · 69 GP ; B case 16 · 81 GP ; C case 16 · 94 GP ; D case 11 · 98 GP — B bonus, C bonus, D bonus, A malchance
- Tour 5 — A case 10 · 91 GP ; B case 20 · 93 GP ; C case 17 · 107 GP ; D case 20 · 106 GP — B cagnotte, C bonus, D chance +5, A chance
- Tour 6 — A case 16 · 100 GP ; B case 21 · 109 GP ; C case 21 · 123 GP ; D case 21 · 110 GP — B cagnotte, C cagnotte, D cagnotte, A bonus
- Tour 7 — A case 22 · 121 GP ; B case 20 · 115 GP ; C case 25 · 129 GP ; D case 24 · 107 GP — B malchance -4, C cagnotte, D malchance, A roue rembourse
- Tour 8 — A case 23 · 126 GP ; B case 26 · 120 GP ; C case 29 · 137 GP ; D case 29 · 119 GP — B roue passe, C cagnotte, D cagnotte, A malchance -1
- Tour 9 — A case 26 · 151 GP ; B case 28 · 121 GP ; C case 32 · 147 GP ; D case 29 · 129 GP — B malchance, C malchance -2, D chance -6, A malchance -2
- Tour 10 — A case 30 · 162 GP ; B case 32 · 115 GP ; C case 38 · 168 GP ; D case 30 · 140 GP — B malchance, C roue +1 turbo, D bonus, A bonus

## 2 — Moyen

### Durée

| | Tours |
| --- | ---: |
| Moyenne | 8,3 |
| Minimum | 4 |
| Maximum | 12 |

### Scores finaux

| Joueur | Moyenne | Écart-type | Minimum | Maximum |
| --- | ---: | ---: | ---: | ---: |
| A | 165,8 | 32,0 | 55 | 306 |
| B | 175,1 | 33,3 | 78 | 304 |
| C | 182,1 | 32,9 | 91 | 357 |
| D | 186,2 | 33,7 | 102 | 341 |

### Victoires

Une victoire compte même en cas d'ex aequo : les probabilités peuvent donc dépasser 100 % au total.

| Joueur | Victoires |
| --- | ---: |
| A | 13,3 % |
| B | 22,6 % |
| C | 30,8 % |
| D | 34,8 % |
| Ex aequo | 1,5 % |

### Écart 1er – 2e

25,0 GP en moyenne.

### Origine des GP

Moyenne par joueur. La roue est nette (mises soustraites). Les mises au dé sont négatives.

| Source | A | B | C | D |
| --- | ---: | ---: | ---: | ---: |
| ping-pong | 5,0 | 20,0 | 30,0 | 35,0 |
| bonus | 11,8 | 11,5 | 11,6 | 11,1 |
| chance | 7,0 | 6,4 | 6,6 | 6,8 |
| malchance | -1,8 | -1,5 | -1,6 | -1,9 |
| cagnotte | 7,6 | 7,9 | 7,7 | 8,0 |
| roue (nette) | 0,8 | 1,6 | 1,2 | 0,5 |
| mises au dé | -7,4 | -7,6 | -7,5 | -7,5 |
| arrivée | 28,5 | 28,5 | 26,4 | 26,6 |
| poker | 30,5 | 29,7 | 29,4 | 29,3 |
| trophées | 18,1 | 12,5 | 12,4 | 11,9 |
| mini-jeu : Codenames | 11,8 | 11,9 | 11,7 | 12,0 |
| mini-jeu : Jeopardy | 12,7 | 12,8 | 12,7 | 12,9 |
| mini-jeu : Just One | 14,2 | 14,3 | 14,3 | 14,3 |
| mini-jeu : Perudo | 5,8 | 6,0 | 5,9 | 6,0 |
| mini-jeu : Top Ten | 9,9 | 10,0 | 9,9 | 10,0 |
| mini-jeu : Undercover | 11,1 | 11,1 | 11,3 | 11,0 |

### Économie

| | Valeur |
| --- | ---: |
| GP misés au dé, moyenne par partie | 30,0 |
| GP misés à la roue, moyenne par partie | 66,1 |
| Cagnotte maximale moyenne | 28,8 |
| Cagnotte maximale observée | 95 |
| Cagnotte restante en fin de partie | 17,4 |
| Jackpots, moyenne par partie | 0,1 |

### Course

| Joueur | Position finale moyenne |
| --- | ---: |
| A | 32,1 |
| B | 32,3 |
| C | 31,8 |
| D | 31,9 |

Arrivées multiples au dernier tour : 27,4 %.

### Trophées

La colonne des gagnants est la part des parties où ce joueur reçoit le trophée, y compris les partages.

| Trophée | Attribuable | Tiré | A | B | C | D |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Le plus malchanceux | 100,0 % | 44,0 % | 10,0 % | 11,9 % | 12,8 % | 11,0 % |
| Le poissard | 97,0 % | 40,4 % | 13,2 % | 13,8 % | 15,6 % | 15,4 % |
| Marche arrière | 94,6 % | 42,3 % | 11,5 % | 11,4 % | 11,1 % | 14,1 % |
| Le plus généreux | 90,3 % | 38,8 % | 13,1 % | 14,7 % | 14,6 % | 14,7 % |
| Pas verni aux jeux | 100,0 % | 43,0 % | 19,6 % | 11,6 % | 7,2 % | 5,0 % |
| Dernier au ping-pong | 100,0 % | 43,8 % | 43,8 % | 0,0 % | 0,0 % | 0,0 % |
| Le flambeur | 99,8 % | 39,3 % | 4,4 % | 9,9 % | 13,9 % | 12,6 % |
| Le prudent | 100,0 % | 33,9 % | 12,4 % | 7,3 % | 7,9 % | 8,3 % |
| Le touriste | 100,0 % | 37,8 % | 9,5 % | 10,9 % | 10,3 % | 10,1 % |
| Contre toutes attentes | 46,8 % | 12,7 % | 3,5 % | 3,7 % | 3,3 % | 2,6 % |
| Retour gagnant | 74,3 % | 24,0 % | 9,8 % | 8,7 % | 6,8 % | 5,5 % |

### Partie type

Graine 3271245818.

- Tour 1 — A case 6 · 35 GP ; B case 2 · 42 GP ; C case 6 · 59 GP ; D case 4 · 67 GP — B cagnotte, D bonus, C bonus, A bonus
- Tour 2 — A case 9 · 47 GP ; B case 6 · 51 GP ; C case 7 · 69 GP ; D case 6 · 82 GP — B bonus, D bonus, C cagnotte, A malchance -3
- Tour 3 — A case 14 · 54 GP ; B case 11 · 68 GP ; C case 10 · 63 GP ; D case 9 · 86 GP — B chance, D cagnotte, C malchance, A malchance
- Tour 4 — A case 15 · 75 GP ; B case 19 · 77 GP ; C case 19 · 77 GP ; D case 8 · 98 GP — B chance +2, D malchance -4, C chance +2, A bonus
- Tour 5 — A case 21 · 84 GP ; B case 23 · 92 GP ; C case 23 · 90 GP ; D case 10 · 107 GP — B bonus, D malchance -2, C bonus, A chance
- Tour 6 — A case 28 · 88 GP ; B case 26 · 94 GP ; C case 24 · 105 GP ; D case 31 · 117 GP — B malchance, D chance +14, C chance, A chance
- Tour 7 — A case 32 · 99 GP ; B case 29 · 101 GP ; C case 32 · 118 GP ; D case 35 · 128 GP — B bonus, D cagnotte, C bonus, A bonus
- Tour 8 — A case 35 · 112 GP ; B case 34 · 115 GP ; C case 37 · 127 GP ; D case 38 · 132 GP — B chance, C bonus, A cagnotte

## 3 — Fort

### Durée

| | Tours |
| --- | ---: |
| Moyenne | 7,3 |
| Minimum | 4 |
| Maximum | 10 |

### Scores finaux

| Joueur | Moyenne | Écart-type | Minimum | Maximum |
| --- | ---: | ---: | ---: | ---: |
| A | 153,7 | 39,1 | 51 | 350 |
| B | 158,8 | 43,8 | 48 | 584 |
| C | 172,2 | 48,0 | 51 | 489 |
| D | 176,1 | 50,6 | 56 | 543 |

### Victoires

Une victoire compte même en cas d'ex aequo : les probabilités peuvent donc dépasser 100 % au total.

| Joueur | Victoires |
| --- | ---: |
| A | 17,3 % |
| B | 19,3 % |
| C | 29,6 % |
| D | 34,9 % |
| Ex aequo | 1,1 % |

### Écart 1er – 2e

37,9 GP en moyenne.

### Origine des GP

Moyenne par joueur. La roue est nette (mises soustraites). Les mises au dé sont négatives.

| Source | A | B | C | D |
| --- | ---: | ---: | ---: | ---: |
| ping-pong | 5,0 | 20,0 | 30,0 | 35,0 |
| bonus | 9,7 | 10,0 | 10,3 | 10,2 |
| chance | 7,2 | 7,1 | 6,1 | 6,4 |
| malchance | -1,4 | -1,4 | -1,6 | -1,5 |
| cagnotte | 14,2 | 14,2 | 14,9 | 14,6 |
| roue (nette) | 2,3 | 0,7 | 3,6 | 3,0 |
| mises au dé | -14,5 | -14,5 | -14,5 | -14,5 |
| arrivée | 28,6 | 26,2 | 28,0 | 27,2 |
| poker | 26,6 | 25,8 | 25,7 | 25,7 |
| trophées | 19,5 | 13,3 | 12,1 | 12,2 |
| mini-jeu : Codenames | 10,5 | 10,3 | 10,4 | 10,2 |
| mini-jeu : Jeopardy | 10,7 | 11,4 | 11,1 | 11,6 |
| mini-jeu : Just One | 12,3 | 12,3 | 12,5 | 12,3 |
| mini-jeu : Perudo | 4,9 | 5,4 | 5,3 | 5,3 |
| mini-jeu : Top Ten | 8,6 | 8,4 | 8,7 | 8,5 |
| mini-jeu : Undercover | 9,5 | 9,5 | 9,7 | 9,8 |

### Économie

| | Valeur |
| --- | ---: |
| GP misés au dé, moyenne par partie | 58,0 |
| GP misés à la roue, moyenne par partie | 170,8 |
| Cagnotte maximale moyenne | 62,9 |
| Cagnotte maximale observée | 236 |
| Cagnotte restante en fin de partie | 38,7 |
| Jackpots, moyenne par partie | 0,0 |

### Course

| Joueur | Position finale moyenne |
| --- | ---: |
| A | 31,9 |
| B | 31,3 |
| C | 32,0 |
| D | 31,6 |

Arrivées multiples au dernier tour : 27,7 %.

### Trophées

La colonne des gagnants est la part des parties où ce joueur reçoit le trophée, y compris les partages.

| Trophée | Attribuable | Tiré | A | B | C | D |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Le plus malchanceux | 100,0 % | 44,3 % | 12,9 % | 12,2 % | 11,6 % | 11,9 % |
| Le poissard | 96,1 % | 40,2 % | 16,4 % | 16,8 % | 13,9 % | 16,0 % |
| Marche arrière | 91,9 % | 40,6 % | 11,6 % | 13,9 % | 8,8 % | 11,0 % |
| Le plus généreux | 84,3 % | 37,0 % | 15,0 % | 13,7 % | 15,8 % | 14,3 % |
| Pas verni aux jeux | 100,0 % | 42,4 % | 19,7 % | 11,9 % | 6,3 % | 5,3 % |
| Dernier au ping-pong | 100,0 % | 40,7 % | 40,7 % | 0,0 % | 0,0 % | 0,0 % |
| Le flambeur | 99,3 % | 37,2 % | 5,4 % | 8,4 % | 11,3 % | 12,6 % |
| Le prudent | 99,3 % | 37,0 % | 14,9 % | 10,9 % | 10,5 % | 11,1 % |
| Le touriste | 100,0 % | 40,2 % | 10,7 % | 10,3 % | 11,0 % | 11,2 % |
| Contre toutes attentes | 44,0 % | 12,5 % | 2,8 % | 2,9 % | 3,7 % | 3,2 % |
| Retour gagnant | 78,6 % | 27,9 % | 12,7 % | 10,1 % | 7,7 % | 5,3 % |

### Partie type

Graine 3271234498.

- Tour 1 — A case 10 · 32 GP ; B case 1 · 44 GP ; C case 3 · 62 GP ; D case 8 · 56 GP — B bonus, D malchance, C bonus, A chance +8
- Tour 2 — A case 16 · 49 GP ; B case 4 · 50 GP ; C case 10 · 75 GP ; D case 12 · 74 GP — B roue rembourse, D cagnotte, C cagnotte, A chance
- Tour 3 — A case 20 · 57 GP ; B case 12 · 66 GP ; C case 12 · 89 GP ; D case 15 · 89 GP — B cagnotte, D cagnotte, C cagnotte, A malchance -1
- Tour 4 — A case 24 · 61 GP ; B case 13 · 37 GP ; C case 19 · 95 GP ; D case 17 · 132 GP — B roue tout-perdre, D roue fois-2, C bonus, A malchance -2
- Tour 5 — A case 25 · 74 GP ; B case 15 · 65 GP ; C case 23 · 99 GP ; D case 22 · 149 GP — B cagnotte, D chance, C roue rembourse, A bonus
- Tour 6 — A case 29 · 108 GP ; B case 22 · 79 GP ; C case 24 · 101 GP ; D case 24 · 156 GP — B chance +4, D bonus, C malchance -4, A cagnotte
- Tour 7 — A case 37 · 117 GP ; B case 27 · 98 GP ; C case 25 · 110 GP ; D case 32 · 154 GP — B roue rembourse, D chance +2, C bonus, A bonus
- Tour 8 — A case 38 · 121 GP ; B case 31 · 116 GP ; C case 31 · 122 GP ; D case 38 · 157 GP — B cagnotte, C cagnotte

## Observations

- 1 — Prudent : la source « poker » représente environ 134,6 GP en valeur absolue cumulée, pour un score moyen de 192,8.
- 2 — Moyen : la source « poker » représente environ 118,9 GP en valeur absolue cumulée, pour un score moyen de 177,3.
- 3 — Fort : la source « arrivée » représente environ 110,0 GP en valeur absolue cumulée, pour un score moyen de 165,2.
- Note : `calculerClassement` dans `server/plateau.ts` départage les non-arrivés à égalité de position en rangeant le plus bas GP devant (mieux classé). C'est le code de jeu ; la simulation ne le change pas.
- Le biais D des anciennes parties venait surtout des mini-jeux physiques au classement aléatoire et d'un Perudo cyclique (annonce 20×6 + Dudo). Le Perudo tire désormais un ordre d'élimination uniforme.
- Aucune valeur de `config/` et aucune règle de jeu n'ont été modifiées pour produire ce rapport.

## Annexe — mises asymétriques

1000 parties par cas. Un seul joueur mise fort (super dé s'il est abordable, 50 % du solde à la roue) ; les trois autres jouent prudent. Référence : scénario tout-prudent (mêmes 1000 parties, graines du scénario 1). Durée de l'annexe : 837.4 s.

Aucune valeur de `config/` n'a été modifiée.

### Synthèse (miseur seul)

| Miseur | Victoires (asym.) | Victoires (tout-prudent) | Δ victoires | GP moyen (asym.) | GP moyen (tout-prudent) | Δ GP |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| A | 22,2 % | 12,9 % | +9,3 pts | 172,6 | 181,5 | −9,0 |
| B | 33,7 % | 20,7 % | +13,0 pts | 185,4 | 188,3 | −2,9 |
| C | 46,7 % | 30,6 % | +16,1 pts | 194,3 | 197,6 | −3,4 |
| D | 52,3 % | 37,5 % | +14,8 pts | 199,9 | 203,8 | −3,8 |

### Miseur A (les autres sont prudents)

| Indicateur | Asymétrique | Tout-prudent | Δ |
| --- | ---: | ---: | ---: |
| Victoires | 22,2 % | 12,9 % | +9,3 pts |
| GP final moyen | 172,6 | 181,5 | −9,0 |
| mises au dé (moy. / partie) | -16,9 | 0,0 | −16,9 |
| arrivée (moy. / partie) | 47,5 | 27,9 | +19,5 |
| cagnotte (moy. / partie) | 5,3 | 1,5 | +3,9 |
| roue (nette) (moy. / partie) | 1,8 | -0,0 | +1,8 |

Victoires de tous les joueurs dans ce cas :

| Joueur | Victoires |
| --- | ---: |
| A | 22,2 % |
| B | 19,0 % |
| C | 26,7 % |
| D | 34,3 % |
| Ex aequo | 2,1 % |

### Miseur B (les autres sont prudents)

| Indicateur | Asymétrique | Tout-prudent | Δ |
| --- | ---: | ---: | ---: |
| Victoires | 33,7 % | 20,7 % | +13,0 pts |
| GP final moyen | 185,4 | 188,3 | −2,9 |
| mises au dé (moy. / partie) | -16,8 | 0,0 | −16,8 |
| arrivée (moy. / partie) | 47,7 | 27,8 | +19,9 |
| cagnotte (moy. / partie) | 5,6 | 1,3 | +4,3 |
| roue (nette) (moy. / partie) | 4,2 | 0,1 | +4,1 |

Victoires de tous les joueurs dans ce cas :

| Joueur | Victoires |
| --- | ---: |
| A | 11,8 % |
| B | 33,7 % |
| C | 24,4 % |
| D | 31,3 % |
| Ex aequo | 1,2 % |

### Miseur C (les autres sont prudents)

| Indicateur | Asymétrique | Tout-prudent | Δ |
| --- | ---: | ---: | ---: |
| Victoires | 46,7 % | 30,6 % | +16,1 pts |
| GP final moyen | 194,3 | 197,6 | −3,4 |
| mises au dé (moy. / partie) | -16,9 | 0,0 | −16,9 |
| arrivée (moy. / partie) | 47,0 | 27,2 | +19,8 |
| cagnotte (moy. / partie) | 6,1 | 1,3 | +4,8 |
| roue (nette) (moy. / partie) | 3,2 | -0,1 | +3,3 |

Victoires de tous les joueurs dans ce cas :

| Joueur | Victoires |
| --- | ---: |
| A | 10,3 % |
| B | 15,3 % |
| C | 46,7 % |
| D | 28,9 % |
| Ex aequo | 1,2 % |

### Miseur D (les autres sont prudents)

| Indicateur | Asymétrique | Tout-prudent | Δ |
| --- | ---: | ---: | ---: |
| Victoires | 52,3 % | 37,5 % | +14,8 pts |
| GP final moyen | 199,9 | 203,8 | −3,8 |
| mises au dé (moy. / partie) | -17,0 | 0,0 | −17,0 |
| arrivée (moy. / partie) | 46,8 | 27,0 | +19,8 |
| cagnotte (moy. / partie) | 6,0 | 1,3 | +4,6 |
| roue (nette) (moy. / partie) | 3,1 | -0,0 | +3,1 |

Victoires de tous les joueurs dans ce cas :

| Joueur | Victoires |
| --- | ---: |
| A | 11,6 % |
| B | 14,0 % |
| C | 22,9 % |
| D | 52,3 % |
| Ex aequo | 0,8 % |
