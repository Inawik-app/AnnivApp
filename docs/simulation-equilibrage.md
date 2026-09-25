# Simulation d'équilibrage

Graine maîtresse : 20260926. 1000 parties par scénario, plus une partie détaillée dont la graine est indiquée. Durée du calcul : 655.8 s.

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
| A | 166,7 | 25,9 | 101 | 257 |
| B | 172,4 | 25,9 | 94 | 262 |
| C | 182,0 | 25,6 | 113 | 277 |
| D | 188,2 | 26,4 | 93 | 281 |

### Victoires

Une victoire compte même en cas d'ex aequo : les probabilités peuvent donc dépasser 100 % au total.

| Joueur | Victoires |
| --- | ---: |
| A | 9,9 % |
| B | 15,7 % |
| C | 30,8 % |
| D | 45,2 % |
| Ex aequo | 1,6 % |

### Écart 1er – 2e

16,0 GP en moyenne.

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
| arrivée | 12,2 | 12,2 | 11,9 | 11,8 |
| poker | 34,8 | 33,3 | 33,2 | 33,3 |
| trophées | 21,7 | 13,7 | 13,1 | 13,2 |
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
| Pas verni aux jeux | 100,0 % | 45,3 % | 29,1 % | 10,4 % | 4,6 % | 2,7 % |
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
| A | 140,5 | 35,2 | 49 | 270 |
| B | 148,7 | 35,8 | 64 | 304 |
| C | 158,4 | 36,5 | 68 | 331 |
| D | 162,0 | 35,5 | 78 | 306 |

### Victoires

Une victoire compte même en cas d'ex aequo : les probabilités peuvent donc dépasser 100 % au total.

| Joueur | Victoires |
| --- | ---: |
| A | 14,0 % |
| B | 21,7 % |
| C | 30,3 % |
| D | 35,8 % |
| Ex aequo | 1,8 % |

### Écart 1er – 2e

28,3 GP en moyenne.

### Origine des GP

Moyenne par joueur. La roue est nette (mises soustraites). Les mises au dé sont négatives.

| Source | A | B | C | D |
| --- | ---: | ---: | ---: | ---: |
| ping-pong | 5,0 | 20,0 | 30,0 | 35,0 |
| bonus | 11,8 | 11,5 | 11,6 | 11,1 |
| chance | 9,5 | 9,0 | 9,2 | 9,2 |
| malchance | -1,7 | -1,6 | -1,6 | -1,9 |
| cagnotte | 24,9 | 25,7 | 26,1 | 26,1 |
| roue (nette) | 0,9 | 1,4 | 1,4 | 0,7 |
| mises au dé | -36,9 | -37,9 | -37,2 | -37,5 |
| arrivée | 12,2 | 12,5 | 11,6 | 11,6 |
| poker | 30,5 | 29,9 | 29,6 | 29,5 |
| trophées | 18,8 | 12,2 | 12,1 | 12,0 |
| mini-jeu : Codenames | 11,7 | 12,0 | 11,7 | 11,9 |
| mini-jeu : Jeopardy | 12,7 | 12,8 | 12,6 | 13,0 |
| mini-jeu : Just One | 14,2 | 14,2 | 14,2 | 14,3 |
| mini-jeu : Perudo | 5,8 | 6,0 | 5,9 | 6,1 |
| mini-jeu : Top Ten | 10,0 | 10,0 | 9,9 | 10,0 |
| mini-jeu : Undercover | 11,1 | 11,1 | 11,2 | 11,0 |

### Économie

| | Valeur |
| --- | ---: |
| GP misés au dé, moyenne par partie | 149,6 |
| GP misés à la roue, moyenne par partie | 58,3 |
| Cagnotte maximale moyenne | 81,2 |
| Cagnotte maximale observée | 188 |
| Cagnotte restante en fin de partie | 53,0 |
| Jackpots, moyenne par partie | 0,1 |

### Course

| Joueur | Position finale moyenne |
| --- | ---: |
| A | 31,9 |
| B | 32,4 |
| C | 31,8 |
| D | 31,9 |

Arrivées multiples au dernier tour : 27,0 %.

### Trophées

La colonne des gagnants est la part des parties où ce joueur reçoit le trophée, y compris les partages.

| Trophée | Attribuable | Tiré | A | B | C | D |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Le plus malchanceux | 100,0 % | 42,1 % | 10,0 % | 10,6 % | 12,9 % | 10,9 % |
| Le poissard | 96,7 % | 40,8 % | 15,0 % | 14,1 % | 15,4 % | 13,9 % |
| Marche arrière | 95,0 % | 42,5 % | 11,1 % | 10,8 % | 11,8 % | 14,4 % |
| Le plus généreux | 90,2 % | 37,5 % | 12,7 % | 14,0 % | 14,8 % | 14,3 % |
| Pas verni aux jeux | 100,0 % | 42,4 % | 26,2 % | 10,5 % | 3,6 % | 3,0 % |
| Dernier au ping-pong | 100,0 % | 42,1 % | 42,1 % | 0,0 % | 0,0 % | 0,0 % |
| Le flambeur | 99,8 % | 41,7 % | 4,6 % | 10,8 % | 14,3 % | 14,1 % |
| Le prudent | 100,0 % | 32,9 % | 11,5 % | 7,2 % | 7,3 % | 9,4 % |
| Le touriste | 100,0 % | 39,0 % | 9,8 % | 11,0 % | 10,1 % | 10,7 % |
| Contre toutes attentes | 46,5 % | 12,1 % | 3,0 % | 2,8 % | 3,9 % | 2,7 % |
| Retour gagnant | 81,1 % | 26,9 % | 10,8 % | 9,7 % | 6,9 % | 6,9 % |

### Partie type

Graine 3271245818.

- Tour 1 — A case 6 · 27 GP ; B case 2 · 42 GP ; C case 6 · 59 GP ; D case 4 · 67 GP — B cagnotte, D bonus, C bonus, A bonus
- Tour 2 — A case 9 · 31 GP ; B case 6 · 51 GP ; C case 7 · 71 GP ; D case 6 · 82 GP — B bonus, D bonus, C cagnotte, A malchance -3
- Tour 3 — A case 14 · 30 GP ; B case 11 · 68 GP ; C case 10 · 57 GP ; D case 9 · 93 GP — B chance, D cagnotte, C malchance, A malchance
- Tour 4 — A case 15 · 51 GP ; B case 19 · 73 GP ; C case 19 · 63 GP ; D case 8 · 105 GP — B chance +2, D malchance -4, C chance +2, A bonus
- Tour 5 — A case 21 · 56 GP ; B case 23 · 88 GP ; C case 23 · 68 GP ; D case 10 · 110 GP — B bonus, D malchance -2, C bonus, A chance
- Tour 6 — A case 28 · 56 GP ; B case 26 · 90 GP ; C case 24 · 79 GP ; D case 31 · 130 GP — B malchance, D chance +14, C chance, A chance
- Tour 7 — A case 32 · 67 GP ; B case 29 · 93 GP ; C case 32 · 84 GP ; D case 35 · 168 GP — B bonus, D cagnotte, C bonus, A bonus
- Tour 8 — A case 35 · 101 GP ; B case 34 · 107 GP ; C case 37 · 85 GP ; D case 38 · 168 GP — B chance, C bonus, A cagnotte

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
| A | 119,2 | 50,4 | 26 | 313 |
| B | 121,3 | 52,7 | 19 | 473 |
| C | 134,6 | 57,8 | 21 | 560 |
| D | 139,7 | 58,1 | 28 | 559 |

### Victoires

Une victoire compte même en cas d'ex aequo : les probabilités peuvent donc dépasser 100 % au total.

| Joueur | Victoires |
| --- | ---: |
| A | 20,7 % |
| B | 20,7 % |
| C | 28,8 % |
| D | 30,9 % |
| Ex aequo | 1,1 % |

### Écart 1er – 2e

51,4 GP en moyenne.

### Origine des GP

Moyenne par joueur. La roue est nette (mises soustraites). Les mises au dé sont négatives.

| Source | A | B | C | D |
| --- | ---: | ---: | ---: | ---: |
| ping-pong | 5,0 | 20,0 | 30,0 | 35,0 |
| bonus | 9,8 | 10,1 | 10,3 | 10,0 |
| chance | 11,3 | 12,0 | 10,5 | 10,6 |
| malchance | -1,2 | -1,5 | -1,7 | -1,5 |
| cagnotte | 45,8 | 44,8 | 48,1 | 47,0 |
| roue (nette) | 2,1 | 0,9 | 3,0 | 3,4 |
| mises au dé | -70,8 | -73,0 | -73,0 | -73,0 |
| arrivée | 12,2 | 11,8 | 12,2 | 11,9 |
| poker | 26,7 | 26,1 | 25,9 | 25,9 |
| trophées | 21,3 | 12,1 | 11,5 | 11,9 |
| mini-jeu : Codenames | 10,6 | 10,4 | 10,5 | 10,5 |
| mini-jeu : Jeopardy | 10,8 | 11,3 | 10,9 | 11,6 |
| mini-jeu : Just One | 12,3 | 12,4 | 12,6 | 12,4 |
| mini-jeu : Perudo | 5,0 | 5,5 | 5,3 | 5,4 |
| mini-jeu : Top Ten | 8,7 | 8,5 | 8,8 | 8,5 |
| mini-jeu : Undercover | 9,5 | 9,8 | 9,8 | 10,1 |

### Économie

| | Valeur |
| --- | ---: |
| GP misés au dé, moyenne par partie | 289,8 |
| GP misés à la roue, moyenne par partie | 125,7 |
| Cagnotte maximale moyenne | 162,7 |
| Cagnotte maximale observée | 403 |
| Cagnotte restante en fin de partie | 113,0 |
| Jackpots, moyenne par partie | 0,0 |

### Course

| Joueur | Position finale moyenne |
| --- | ---: |
| A | 31,7 |
| B | 31,7 |
| C | 32,1 |
| D | 31,7 |

Arrivées multiples au dernier tour : 30,3 %.

### Trophées

La colonne des gagnants est la part des parties où ce joueur reçoit le trophée, y compris les partages.

| Trophée | Attribuable | Tiré | A | B | C | D |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Le plus malchanceux | 100,0 % | 42,4 % | 13,1 % | 9,6 % | 11,4 % | 11,7 % |
| Le poissard | 95,5 % | 39,5 % | 15,7 % | 15,7 % | 13,5 % | 16,5 % |
| Marche arrière | 90,9 % | 40,4 % | 12,6 % | 12,8 % | 8,5 % | 11,2 % |
| Le plus généreux | 85,0 % | 34,0 % | 13,6 % | 12,9 % | 14,8 % | 13,7 % |
| Pas verni aux jeux | 100,0 % | 41,5 % | 29,1 % | 8,4 % | 3,2 % | 1,8 % |
| Dernier au ping-pong | 100,0 % | 43,5 % | 43,5 % | 0,0 % | 0,0 % | 0,0 % |
| Le flambeur | 99,6 % | 38,8 % | 4,9 % | 8,8 % | 11,9 % | 13,7 % |
| Le prudent | 99,6 % | 36,5 % | 17,4 % | 9,4 % | 9,5 % | 9,2 % |
| Le touriste | 100,0 % | 40,3 % | 11,6 % | 8,6 % | 11,5 % | 10,8 % |
| Contre toutes attentes | 44,9 % | 11,5 % | 3,1 % | 2,6 % | 3,2 % | 2,6 % |
| Retour gagnant | 85,1 % | 31,6 % | 12,7 % | 11,6 % | 8,7 % | 7,6 % |

### Partie type

Graine 3271234498.

- Tour 1 — A case 10 · 32 GP ; B case 1 · 36 GP ; C case 3 · 54 GP ; D case 8 · 48 GP — B bonus, D malchance, C bonus, A chance +8
- Tour 2 — A case 16 · 41 GP ; B case 4 · 34 GP ; C case 10 · 73 GP ; D case 12 · 78 GP — B roue rembourse, D cagnotte, C cagnotte, A chance
- Tour 3 — A case 20 · 41 GP ; B case 12 · 57 GP ; C case 12 · 89 GP ; D case 15 · 96 GP — B cagnotte, D cagnotte, C cagnotte, A malchance -1
- Tour 4 — A case 24 · 37 GP ; B case 13 · 28 GP ; C case 19 · 87 GP ; D case 17 · 131 GP — B roue tout-perdre, D roue fois-2, C bonus, A malchance -2
- Tour 5 — A case 25 · 42 GP ; B case 15 · 73 GP ; C case 23 · 83 GP ; D case 22 · 140 GP — B cagnotte, D chance, C roue rembourse, A bonus
- Tour 6 — A case 29 · 108 GP ; B case 22 · 79 GP ; C case 24 · 77 GP ; D case 24 · 139 GP — B chance +4, D bonus, C malchance -4, A cagnotte
- Tour 7 — A case 37 · 109 GP ; B case 27 · 90 GP ; C case 25 · 78 GP ; D case 32 · 129 GP — B roue rembourse, D chance +2, C bonus, A bonus
- Tour 8 — A case 38 · 105 GP ; B case 31 · 140 GP ; C case 31 · 111 GP ; D case 38 · 124 GP — B cagnotte, C cagnotte

## Observations

- 1 — Prudent : la source « poker » représente environ 134,6 GP en valeur absolue cumulée, pour un score moyen de 177,3.
- 2 — Moyen : la source « mises au dé » représente environ 149,6 GP en valeur absolue cumulée, pour un score moyen de 152,4.
- 3 — Fort : la source « mises au dé » représente environ 289,8 GP en valeur absolue cumulée, pour un score moyen de 128,7.
- Note : `calculerClassement` dans `server/plateau.ts` départage les non-arrivés à égalité de position en rangeant le plus bas GP devant (mieux classé). C'est le code de jeu ; la simulation ne le change pas.
- Le biais D des anciennes parties venait surtout des mini-jeux physiques au classement aléatoire et d'un Perudo cyclique (annonce 20×6 + Dudo). Le Perudo tire désormais un ordre d'élimination uniforme.
- Aucune valeur de `config/` et aucune règle de jeu n'ont été modifiées pour produire ce rapport.

## Annexe — mises asymétriques

1000 parties par cas. Un seul joueur mise fort (super dé s'il est abordable, 50 % du solde à la roue) ; les trois autres jouent prudent. Référence : scénario tout-prudent (mêmes 1000 parties, graines du scénario 1). Durée de l'annexe : 896.5 s.

Aucune valeur de `config/` n'a été modifiée.

### Synthèse (miseur seul)

| Miseur | Victoires (asym.) | Victoires (tout-prudent) | Δ victoires | GP moyen (asym.) | GP moyen (tout-prudent) | Δ GP |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| A | 0,4 % | 9,9 % | −9,5 pts | 93,3 | 166,7 | −73,4 |
| B | 1,5 % | 15,7 % | −14,2 pts | 102,0 | 172,4 | −70,4 |
| C | 2,4 % | 30,8 % | −28,4 pts | 112,5 | 182,0 | −69,5 |
| D | 3,1 % | 45,2 % | −42,1 pts | 117,6 | 188,2 | −70,6 |

### Miseur A (les autres sont prudents)

| Indicateur | Asymétrique | Tout-prudent | Δ |
| --- | ---: | ---: | ---: |
| Victoires | 0,4 % | 9,9 % | −9,5 pts |
| GP final moyen | 93,3 | 166,7 | −73,4 |
| mises au dé (moy. / partie) | -82,3 | 0,0 | −82,3 |
| arrivée (moy. / partie) | 20,4 | 12,2 | +8,3 |
| cagnotte (moy. / partie) | 16,1 | 1,5 | +14,6 |
| roue (nette) (moy. / partie) | 0,9 | -0,0 | +0,9 |

Victoires de tous les joueurs dans ce cas :

| Joueur | Victoires |
| --- | ---: |
| A | 0,4 % |
| B | 23,8 % |
| C | 33,5 % |
| D | 43,8 % |
| Ex aequo | 1,5 % |

### Miseur B (les autres sont prudents)

| Indicateur | Asymétrique | Tout-prudent | Δ |
| --- | ---: | ---: | ---: |
| Victoires | 1,5 % | 15,7 % | −14,2 pts |
| GP final moyen | 102,0 | 172,4 | −70,4 |
| mises au dé (moy. / partie) | -84,0 | 0,0 | −84,0 |
| arrivée (moy. / partie) | 20,2 | 12,2 | +8,1 |
| cagnotte (moy. / partie) | 17,0 | 1,3 | +15,6 |
| roue (nette) (moy. / partie) | 2,5 | 0,1 | +2,3 |

Victoires de tous les joueurs dans ce cas :

| Joueur | Victoires |
| --- | ---: |
| A | 14,4 % |
| B | 1,5 % |
| C | 37,3 % |
| D | 49,4 % |
| Ex aequo | 2,5 % |

### Miseur C (les autres sont prudents)

| Indicateur | Asymétrique | Tout-prudent | Δ |
| --- | ---: | ---: | ---: |
| Victoires | 2,4 % | 30,8 % | −28,4 pts |
| GP final moyen | 112,5 | 182,0 | −69,5 |
| mises au dé (moy. / partie) | -84,4 | 0,0 | −84,4 |
| arrivée (moy. / partie) | 19,9 | 11,9 | +8,1 |
| cagnotte (moy. / partie) | 18,3 | 1,3 | +17,0 |
| roue (nette) (moy. / partie) | 2,2 | -0,1 | +2,3 |

Victoires de tous les joueurs dans ce cas :

| Joueur | Victoires |
| --- | ---: |
| A | 19,2 % |
| B | 26,0 % |
| C | 2,4 % |
| D | 53,8 % |
| Ex aequo | 1,4 % |

### Miseur D (les autres sont prudents)

| Indicateur | Asymétrique | Tout-prudent | Δ |
| --- | ---: | ---: | ---: |
| Victoires | 3,1 % | 45,2 % | −42,1 pts |
| GP final moyen | 117,6 | 188,2 | −70,6 |
| mises au dé (moy. / partie) | -84,9 | 0,0 | −84,9 |
| arrivée (moy. / partie) | 19,9 | 11,8 | +8,1 |
| cagnotte (moy. / partie) | 17,7 | 1,3 | +16,4 |
| roue (nette) (moy. / partie) | 1,9 | -0,0 | +2,0 |

Victoires de tous les joueurs dans ce cas :

| Joueur | Victoires |
| --- | ---: |
| A | 21,7 % |
| B | 27,7 % |
| C | 48,7 % |
| D | 3,1 % |
| Ex aequo | 1,2 % |
