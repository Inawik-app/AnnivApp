/**
 * Simulation d'équilibrage. Lit la config et le vrai réducteur, n'écrit que le rapport.
 * Usage : npm run simulation
 *         npx tsx scripts/simuler.ts 20   (volume réduit, pour un essai)
 *         npx tsx scripts/simuler.ts 1000 --annexe   (annexe asymétrique seulement)
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  GRAINE_MAITRESSE,
  PROFILS_BASE,
  RACINE,
  SCENARIOS,
  catalogueTrophees,
  clesOrigine,
  creerAgregat,
  creerSession,
  fermerSession,
  gpPingPong,
  grainePartie,
  integrer,
  lirePingPong,
  moyenne,
  nombre,
  pourcent,
  tableauOrigines,
  tableauScores,
  tableauTrophees,
  tableauVictoires,
  type Agregat,
  type ConfigPingPong,
  type ScenarioId,
  jouerPartieSurSession,
} from './simulation-moteur';

const ARGS = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const FLAGS = new Set(process.argv.slice(2).filter((arg) => arg.startsWith('--')));
const PARTIES = Math.max(1, Number(ARGS[0]) || 1000);
const SEULEMENT_ANNEXE = FLAGS.has('--annexe') || FLAGS.has('--seulement-annexe');
/** Indice de scénario réservé aux cas asymétriques (après les 3 scénarios homogènes). */
const INDEX_ASYM = SCENARIOS.length;

function observations(rapports: Array<{ nom: string; agregat: Agregat }>, parties: number): string[] {
  const lignes: string[] = [];
  for (const rapport of rapports) {
    const taux = PROFILS_BASE.map((profil) => ({
      pseudo: profil.pseudo,
      taux: (rapport.agregat.victoires[profil.pseudo] ?? 0) / parties,
    })).sort((a, b) => b.taux - a.taux);
    const premier = taux[0];
    const dernier = taux[taux.length - 1];
    if (premier && premier.taux >= 0.5) {
      lignes.push(
        `${rapport.nom} : ${premier.pseudo} gagne ${pourcent(premier.taux)} des parties. Le départ au ping-pong, ou le style de mise, pèse encore.`,
      );
    }
    if (dernier && dernier.taux < 0.08) {
      lignes.push(`${rapport.nom} : ${dernier.pseudo} ne gagne que ${pourcent(dernier.taux)}. Sa chance réelle reste faible dans ce style de mise.`);
    }
    const tours = moyenne(rapport.agregat.tours);
    if (tours < 6) lignes.push(`${rapport.nom} : la course dure ${nombre(tours, 1)} tours en moyenne. C'est court pour une soirée.`);
    if (tours > 14) lignes.push(`${rapport.nom} : la course dure ${nombre(tours, 1)} tours en moyenne. C'est long pour une soirée.`);
    const cles = clesOrigine(rapport.agregat);
    let dominante = '';
    let poids = 0;
    for (const cle of cles) {
      const total =
        PROFILS_BASE.reduce((somme, profil) => somme + Math.abs(rapport.agregat.origines[profil.pseudo]?.[cle] ?? 0), 0) /
        parties;
      if (total > poids) {
        poids = total;
        dominante = cle;
      }
    }
    const scoreMoyen = moyenne(PROFILS_BASE.flatMap((profil) => rapport.agregat.scores[profil.pseudo] ?? []));
    if (dominante && poids > scoreMoyen * 0.45 && dominante !== 'ping-pong') {
      lignes.push(
        `${rapport.nom} : la source « ${dominante} » représente environ ${nombre(poids)} GP en valeur absolue cumulée, pour un score moyen de ${nombre(scoreMoyen)}.`,
      );
    }
  }
  for (const trophee of catalogueTrophees.trophees) {
    const taux =
      rapports.reduce((somme, rapport) => somme + (rapport.agregat.attribuables[trophee.id] ?? 0), 0) /
      (rapports.length * parties);
    if (taux < 0.08) {
      lignes.push(`« ${trophee.nom} » n'est attribuable que dans ${pourcent(taux)} des parties, tous scénarios confondus.`);
    }
  }
  if (lignes.length === 0) lignes.push('Aucun écart massif ne ressort des trois scénarios avec ces hypothèses.');
  lignes.push(
    'Note : `calculerClassement` dans `server/plateau.ts` départage les non-arrivés à égalité de position en rangeant le plus bas GP devant (mieux classé). C\'est le code de jeu ; la simulation ne le change pas.',
  );
  lignes.push(
    'Le biais D des anciennes parties venait surtout des mini-jeux physiques au classement aléatoire et d\'un Perudo cyclique (annonce 20×6 + Dudo). Le Perudo tire désormais un ordre d\'élimination uniforme.',
  );
  lignes.push('Aucune valeur de `config/` et aucune règle de jeu n\'ont été modifiées pour produire ce rapport.');
  return lignes;
}

function rapportScenario(
  nom: string,
  agregat: Agregat,
  parties: number,
  exemple: { graine: number; journal: string[] },
): string[] {
  const tours = agregat.tours;
  return [
    `## ${nom}`,
    '',
    '### Durée',
    '',
    '| | Tours |',
    '| --- | ---: |',
    `| Moyenne | ${nombre(moyenne(tours))} |`,
    `| Minimum | ${nombre(Math.min(...tours), 0)} |`,
    `| Maximum | ${nombre(Math.max(...tours), 0)} |`,
    '',
    '### Scores finaux',
    '',
    tableauScores(agregat),
    '',
    '### Victoires',
    '',
    "Une victoire compte même en cas d'ex aequo : les probabilités peuvent donc dépasser 100 % au total.",
    '',
    tableauVictoires(agregat, parties),
    '',
    '### Écart 1er – 2e',
    '',
    `${nombre(moyenne(agregat.ecarts))} GP en moyenne.`,
    '',
    '### Origine des GP',
    '',
    'Moyenne par joueur. La roue est nette (mises soustraites). Les mises au dé sont négatives.',
    '',
    tableauOrigines(agregat, parties),
    '',
    '### Économie',
    '',
    '| | Valeur |',
    '| --- | ---: |',
    `| GP misés au dé, moyenne par partie | ${nombre(agregat.misesDe / parties)} |`,
    `| GP misés à la roue, moyenne par partie | ${nombre(agregat.misesRoue / parties)} |`,
    `| Cagnotte maximale moyenne | ${nombre(agregat.cagnotteMax / parties)} |`,
    `| Cagnotte maximale observée | ${nombre(agregat.cagnottePic, 0)} |`,
    `| Cagnotte restante en fin de partie | ${nombre(agregat.cagnotteFin / parties)} |`,
    `| Jackpots, moyenne par partie | ${nombre(agregat.jackpots / parties)} |`,
    '',
    '### Course',
    '',
    '| Joueur | Position finale moyenne |',
    '| --- | ---: |',
    ...PROFILS_BASE.map((profil) => `| ${profil.pseudo} | ${nombre(moyenne(agregat.positions[profil.pseudo] ?? []))} |`),
    '',
    `Arrivées multiples au dernier tour : ${pourcent(agregat.arriveesMultiples / parties)}.`,
    '',
    '### Trophées',
    '',
    'La colonne des gagnants est la part des parties où ce joueur reçoit le trophée, y compris les partages.',
    '',
    tableauTrophees(agregat, parties),
    '',
    '### Partie type',
    '',
    `Graine ${exemple.graine}.`,
    '',
    ...exemple.journal.map((ligne) => `- ${ligne}`),
    '',
  ];
}

function origin(agregat: Agregat, pseudo: string, cle: string, parties: number): number {
  return (agregat.origines[pseudo]?.[cle] ?? 0) / parties;
}

function deltaTexte(valeur: number, reference: number, enPourcent = false): string {
  const ecart = valeur - reference;
  const signe = ecart >= 0 ? '+' : '−';
  if (enPourcent) return `${signe}${nombre(Math.abs(ecart) * 100, 1)} pts`;
  return `${signe}${nombre(Math.abs(ecart))}`;
}

function lancerScenarioHomogene(
  session: ReturnType<typeof creerSession>,
  scenario: ScenarioId,
  indexScenario: number,
  parties: number,
  pingpong: ConfigPingPong,
): Agregat {
  const agregat = creerAgregat();
  for (let partie = 0; partie < parties; partie += 1) {
    integrer(
      agregat,
      jouerPartieSurSession(session, {
        scenario,
        graine: grainePartie(indexScenario, partie),
        pingpong,
      }),
    );
  }
  return agregat;
}

function lancerAsymetrique(
  session: ReturnType<typeof creerSession>,
  miseur: string,
  indexCas: number,
  parties: number,
  pingpong: ConfigPingPong,
): Agregat {
  const stylesParPseudo: Partial<Record<string, ScenarioId>> = {};
  for (const profil of PROFILS_BASE) {
    stylesParPseudo[profil.pseudo] = profil.pseudo === miseur ? 'fort' : 'prudent';
  }
  const agregat = creerAgregat();
  for (let partie = 0; partie < parties; partie += 1) {
    integrer(
      agregat,
      jouerPartieSurSession(session, {
        scenario: 'prudent',
        stylesParPseudo,
        graine: grainePartie(INDEX_ASYM + indexCas, partie),
        pingpong,
      }),
    );
  }
  return agregat;
}

function rapportAnnexeAsymetrique(
  prudent: Agregat,
  cas: Array<{ miseur: string; agregat: Agregat }>,
  parties: number,
  duree: string,
): string {
  const lignes: string[] = [
    '## Annexe — mises asymétriques',
    '',
    `${parties} parties par cas. Un seul joueur mise fort (super dé s'il est abordable, 50 % du solde à la roue) ; les trois autres jouent prudent. Référence : scénario tout-prudent (mêmes ${parties} parties, graines du scénario 1). Durée de l'annexe : ${duree} s.`,
    '',
    'Aucune valeur de `config/` n\'a été modifiée.',
    '',
    '### Synthèse (miseur seul)',
    '',
    '| Miseur | Victoires (asym.) | Victoires (tout-prudent) | Δ victoires | GP moyen (asym.) | GP moyen (tout-prudent) | Δ GP |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];
  for (const { miseur, agregat } of cas) {
    const vAsym = (agregat.victoires[miseur] ?? 0) / parties;
    const vRef = (prudent.victoires[miseur] ?? 0) / parties;
    const gpAsym = moyenne(agregat.scores[miseur] ?? []);
    const gpRef = moyenne(prudent.scores[miseur] ?? []);
    lignes.push(
      `| ${miseur} | ${pourcent(vAsym)} | ${pourcent(vRef)} | ${deltaTexte(vAsym, vRef, true)} | ${nombre(gpAsym)} | ${nombre(gpRef)} | ${deltaTexte(gpAsym, gpRef)} |`,
    );
  }
  lignes.push('');
  for (const { miseur, agregat } of cas) {
    const clesDetail = ['mises au dé', 'arrivée', 'cagnotte', 'roue (nette)'] as const;
    lignes.push(`### Miseur ${miseur} (les autres sont prudents)`);
    lignes.push('');
    lignes.push('| Indicateur | Asymétrique | Tout-prudent | Δ |');
    lignes.push('| --- | ---: | ---: | ---: |');
    const vAsym = (agregat.victoires[miseur] ?? 0) / parties;
    const vRef = (prudent.victoires[miseur] ?? 0) / parties;
    const gpAsym = moyenne(agregat.scores[miseur] ?? []);
    const gpRef = moyenne(prudent.scores[miseur] ?? []);
    lignes.push(`| Victoires | ${pourcent(vAsym)} | ${pourcent(vRef)} | ${deltaTexte(vAsym, vRef, true)} |`);
    lignes.push(`| GP final moyen | ${nombre(gpAsym)} | ${nombre(gpRef)} | ${deltaTexte(gpAsym, gpRef)} |`);
    for (const cle of clesDetail) {
      const a = origin(agregat, miseur, cle, parties);
      const r = origin(prudent, miseur, cle, parties);
      lignes.push(`| ${cle} (moy. / partie) | ${nombre(a)} | ${nombre(r)} | ${deltaTexte(a, r)} |`);
    }
    lignes.push('');
    lignes.push('Victoires de tous les joueurs dans ce cas :');
    lignes.push('');
    lignes.push(tableauVictoires(agregat, parties));
    lignes.push('');
  }
  return lignes.join('\n');
}

function ecrireOuCompleterRapport(corps: string | null, annexe: string): void {
  const cible = path.join(RACINE, 'docs', 'simulation-equilibrage.md');
  let texte: string;
  if (corps !== null) {
    texte = `${corps.trimEnd()}\n\n${annexe.trimEnd()}\n`;
  } else {
    const actuel = fs.readFileSync(cible, 'utf8');
    const sansAnnexe = actuel.replace(/\n## Annexe — mises asymétriques[\s\S]*$/, '').trimEnd();
    texte = `${sansAnnexe}\n\n${annexe.trimEnd()}\n`;
  }
  fs.writeFileSync(cible, texte, 'utf8');
  console.log(`Rapport ${cible}`);
}

function main(): void {
  const debut = Date.now();
  const pingpong = lirePingPong();
  const session = creerSession();
  let agregatPrudent: Agregat | null = null;
  let corps: string | null = null;

  try {
    if (!SEULEMENT_ANNEXE) {
      const rendus: string[] = [];
      const pourObservations: Array<{ nom: string; agregat: Agregat }> = [];
      for (const [index, scenario] of SCENARIOS.entries()) {
        const agregat = lancerScenarioHomogene(session, scenario.id, index, PARTIES, pingpong);
        if (scenario.id === 'prudent') agregatPrudent = agregat;
        const graineExemple = grainePartie(index, PARTIES);
        const exemple = jouerPartieSurSession(session, {
          scenario: scenario.id,
          graine: graineExemple,
          detail: true,
          pingpong,
        });
        rendus.push(...rapportScenario(scenario.nom, agregat, PARTIES, { graine: graineExemple, journal: exemple.journal }));
        pourObservations.push({ nom: scenario.nom, agregat });
        console.log(`${scenario.nom} : ${PARTIES} parties`);
      }
      const duree = ((Date.now() - debut) / 1000).toFixed(1);
      const libelles = { A: 'Très faible', B: 'Moyen', C: 'Bon', D: 'Parfait' } as const;
      corps = [
        "# Simulation d'équilibrage",
        '',
        `Graine maîtresse : ${GRAINE_MAITRESSE}. ${PARTIES} parties par scénario, plus une partie détaillée dont la graine est indiquée. Durée du calcul : ${duree} s.`,
        '',
        `Les quatre joueurs jouent chaque partie dans un ordre tiré au sort. Ils commencent avec les GP du tournoi de ping-pong : ${pingpong.gpParPoint} GP par point contre un joueur, ${pingpong.gpParPointContreHote} GP par point contre l'hôte, sur 4 matchs (formule : points × (3 × gpParPoint + gpParPointContreHote)).`,
        '',
        '| Joueur | Profil | Points par match | GP de départ |',
        '| --- | --- | ---: | ---: |',
        ...PROFILS_BASE.map(
          (profil) =>
            `| ${profil.pseudo} | ${libelles[profil.pseudo as keyof typeof libelles]} | ${profil.points} | ${gpPingPong(profil.points, pingpong)} |`,
        ),
        '',
        '## Hypothèses',
        '',
        'Identiques pour les trois scénarios. Le simulateur appelle le vrai réducteur, les vrais tirages et `trophees(etat)`. Pas d\'apéro.',
        '',
        '| Mini-jeu | Hypothèse |',
        '| --- | --- |',
        '| Jeopardy | Valeurs actuelles, rotation du choisisseur. Juste à 85 / 70 / 55 / 40 % selon le niveau 1 à 4. Sinon, 50 % qu\'un autre joueur tiré au hasard réussisse. |',
        '| Top Ten | Ordre proposé = bon ordre avec 0, 1 ou 2 échanges de voisins (équiprobables). Chaque numéro exact à 30 %. |',
        '| Undercover | 4 joueurs. Civils gagnent 70 % des manches ; undercover éliminé trouve le mot à 30 %. |',
        '| Codenames | Équipes au hasard. Chaque manche gagnée 50/50 (cartes de l\'équipe courante jusqu\'à la victoire, ou assassin). |',
        '| Perudo | Ordre d\'élimination tiré uniformément au hasard (1 dé/joueur en simu pour la durée ; barème de classement inchangé). |',
        '| Just One | Devineur trouve à 60 %. Chaque indice a 15 % de chance de copier un autre (hôte : doublon n\'annule que l\'hôte). Indices lettres seules (Zzza, Zzzb…). Un cycle (hôte inclus) en simu, contre 2 en soirée. |',
        '| Poker | 100 GP de jetons (4 × 20 + hôte 20 redistribué), redistribution aléatoire raisonnable. |',
        '',
        '- **Dé et roue.** Prudent : toujours le dé normal ; mise 0 à la roue dans 80 % des cas, 5 GP sinon. Moyen : dé normal 30 %, boosté 50 %, super dé 20 % ; mise d\'environ 15 % du solde visible. Fort : toujours le super dé s\'il est abordable ; 50 % du solde à la roue. Coup de pouce actif : toujours le dé gratuit (de7 → boosté, de8 → super).',
        '- **Mini-jeu à chaque tour.** Parmi les 7 modules de `config/mini-jeux.json` pas encore joués ; ensuite au hasard parmi les 7.',
        '- **Missions secrètes.** Ignorées.',
        '- **Fin.** Dernier tour dès la première arrivée, podium, éventuelle cagnotte de consolation, trophées (`nombreCeremonie`), classement, gagnant.',
        '',
        ...rendus,
        '## Observations',
        '',
        ...observations(pourObservations, PARTIES).map((ligne) => `- ${ligne}`),
        '',
      ].join('\n');
    }

    const debutAnnexe = Date.now();
    if (!agregatPrudent) {
      console.log(`Référence tout-prudent : ${PARTIES} parties`);
      agregatPrudent = lancerScenarioHomogene(session, 'prudent', 0, PARTIES, pingpong);
    }
    const cas: Array<{ miseur: string; agregat: Agregat }> = [];
    for (const [index, profil] of PROFILS_BASE.entries()) {
      const agregat = lancerAsymetrique(session, profil.pseudo, index, PARTIES, pingpong);
      cas.push({ miseur: profil.pseudo, agregat });
      console.log(`Asymétrique, miseur ${profil.pseudo} : ${PARTIES} parties`);
    }
    const dureeAnnexe = ((Date.now() - debutAnnexe) / 1000).toFixed(1);
    const annexe = rapportAnnexeAsymetrique(agregatPrudent, cas, PARTIES, dureeAnnexe);
    ecrireOuCompleterRapport(corps, annexe);
  } finally {
    fermerSession(session);
  }
  const duree = ((Date.now() - debut) / 1000).toFixed(1);
  console.log(`Durée ${duree} s`);
}

main();
