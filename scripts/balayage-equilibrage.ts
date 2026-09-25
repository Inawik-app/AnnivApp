/**
 * Balayage d'équilibrage : 72 combinaisons × 3 scénarios × N parties.
 * Usage : npm run simulation:balayage
 *         npx tsx scripts/balayage-equilibrage.ts 2   (parties par cellule, essai rapide)
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import type { SurchargesSimulation } from '../server/store';
import {
  GRAINE_MAITRESSE,
  PROFILS_BASE,
  RACINE,
  SCENARIOS,
  type Agregat,
  type ConfigPingPong,
  type ScenarioId,
  creerAgregat,
  creerSession,
  fermerSession,
  grainePartie,
  integrer,
  lirePingPong,
  moyenne,
  nombre,
  pourcent,
  tableauOrigines,
  jouerPartieSurSession,
} from './simulation-moteur';

const PARTIES = Math.max(1, Number(process.argv[2]) || 300);
const FICHIER = path.join(RACINE, 'docs', 'equilibrage-balayage.md');

type Combo = {
  id: number;
  recompenseArrivee: number[];
  cagnotteConsolation: 'aucune' | 'dernier';
  coupDePouce: 'aucun' | 'de7';
  montantTrophees: number;
  pingpong: ConfigPingPong;
  additif: boolean;
};

type StatsScenario = {
  scenario: ScenarioId;
  pA: number;
  pB: number;
  pC: number;
  pD: number;
  tours: number;
  ecart: number;
  gpD: number;
  origines: Agregat['origines'];
};

type ResultatCombo = {
  combo: Combo;
  stats: StatsScenario[];
};

function grille(): Combo[] {
  const recompenses = [
    [0, 0, 0, 0],
    [15, 8, 4, 0],
    [25, 15, 8, 0],
  ];
  const consolations: Array<'aucune' | 'dernier'> = ['aucune', 'dernier'];
  const pouces: Array<'aucun' | 'de7'> = ['aucun', 'de7'];
  const montants = [12, 20];
  const pings: ConfigPingPong[] = [
    { gpParPoint: 3, gpParPointContreHote: 6 },
    { gpParPoint: 2, gpParPointContreHote: 4 },
    { gpParPoint: 1, gpParPointContreHote: 2 },
  ];
  const combos: Combo[] = [];
  let id = 0;
  for (const recompenseArrivee of recompenses) {
    for (const cagnotteConsolation of consolations) {
      for (const coupDePouce of pouces) {
        for (const montantTrophees of montants) {
          for (const pingpong of pings) {
            const additif = pingpong.gpParPoint === 3 && pingpong.gpParPointContreHote === 6;
            combos.push({
              id: id++,
              recompenseArrivee: [...recompenseArrivee],
              cagnotteConsolation,
              coupDePouce,
              montantTrophees,
              pingpong: { ...pingpong },
              additif,
            });
          }
        }
      }
    }
  }
  return combos;
}

function surchargesDe(combo: Combo): SurchargesSimulation {
  return {
    recompenseArrivee: combo.recompenseArrivee,
    cagnotteConsolation: combo.cagnotteConsolation,
    coupDePouce: combo.coupDePouce,
    montantTrophees: combo.montantTrophees,
  };
}

function jouerCombo(combo: Combo, parties: number, offsetGraine: number): ResultatCombo {
  const session = creerSession(surchargesDe(combo), true);
  const stats: StatsScenario[] = [];
  try {
    for (const [indexScenario, scenario] of SCENARIOS.entries()) {
      const agregat = creerAgregat();
      for (let partie = 0; partie < parties; partie += 1) {
        integrer(
          agregat,
          jouerPartieSurSession(session, {
            scenario: scenario.id,
            graine: grainePartie(indexScenario, partie, offsetGraine + combo.id * 17),
            pingpong: combo.pingpong,
          }),
        );
      }
      stats.push({
        scenario: scenario.id,
        pA: (agregat.victoires.A ?? 0) / parties,
        pB: (agregat.victoires.B ?? 0) / parties,
        pC: (agregat.victoires.C ?? 0) / parties,
        pD: (agregat.victoires.D ?? 0) / parties,
        tours: moyenne(agregat.tours),
        ecart: moyenne(agregat.ecarts),
        gpD: moyenne(agregat.scores.D ?? []),
        origines: agregat.origines,
      });
    }
  } finally {
    fermerSession(session);
  }
  return { combo, stats };
}

function libelleCombo(combo: Combo): string {
  const rec = combo.recompenseArrivee.join('/');
  return `arrivée ${rec} · cagnotte ${combo.cagnotteConsolation} · pouce ${combo.coupDePouce} · trophées ${combo.montantTrophees} · ping ${combo.pingpong.gpParPoint}/${combo.pingpong.gpParPointContreHote}`;
}

function statsMoyen(resultat: ResultatCombo): StatsScenario {
  const moyen = resultat.stats.find((s) => s.scenario === 'moyen');
  if (!moyen) throw new Error('Scénario moyen absent');
  return moyen;
}

/** Distance à la cible, scénario moyen d'abord. */
function distanceCible(resultat: ResultatCombo, gpDDefaut: number): number {
  const moyen = statsMoyen(resultat);
  let score = 0;
  if (moyen.pD < 0.28) score += (0.28 - moyen.pD) * 100;
  if (moyen.pD > 0.4) score += (moyen.pD - 0.4) * 100;
  if (moyen.pA < 0.12) score += (0.12 - moyen.pA) * 120;
  const maxAutres = Math.max(moyen.pA, moyen.pB, moyen.pC);
  if (moyen.pD <= maxAutres) score += (maxAutres - moyen.pD + 0.01) * 80;
  for (const s of resultat.stats) {
    if (s.scenario === 'moyen') continue;
    const max = Math.max(s.pA, s.pB, s.pC, s.pD);
    if (max > 0.5) score += (max - 0.5) * 60;
    if (s.pA < 0.06) score += (0.06 - s.pA) * 80;
  }
  if (moyen.gpD + 0.5 < gpDDefaut) score += (gpDDefaut - moyen.gpD) * 0.4;
  return score;
}

function atteintCible(resultat: ResultatCombo, gpDDefaut: number): boolean {
  const moyen = statsMoyen(resultat);
  if (moyen.pD < 0.28 || moyen.pD > 0.4) return false;
  if (moyen.pA < 0.12) return false;
  if (moyen.pD <= Math.max(moyen.pA, moyen.pB, moyen.pC)) return false;
  for (const s of resultat.stats) {
    if (s.scenario === 'moyen') continue;
    if (Math.max(s.pA, s.pB, s.pC, s.pD) > 0.5) return false;
    if (s.pA < 0.06) return false;
  }
  if (moyen.gpD + 0.5 < gpDDefaut) return false;
  return true;
}

function cellule(s: StatsScenario): string {
  return `${pourcent(s.pA)} / ${pourcent(s.pB)} / ${pourcent(s.pC)} / ${pourcent(s.pD)} · ${nombre(s.tours)} t · Δ${nombre(s.ecart)} · D=${nombre(s.gpD, 0)}`;
}

type Job = { combos: Combo[]; parties: number; offsetGraine: number };
type WorkerMsg = { resultats: ResultatCombo[] };

async function workerMain(job: Job): Promise<void> {
  const resultats = job.combos.map((combo) => jouerCombo(combo, job.parties, job.offsetGraine));
  parentPort?.postMessage({ resultats } satisfies WorkerMsg);
}

async function parallel(combos: Combo[], parties: number): Promise<ResultatCombo[]> {
  const cpus = Math.max(1, Math.min(os.cpus().length || 4, combos.length));
  const taille = Math.ceil(combos.length / cpus);
  const lots: Combo[][] = [];
  for (let i = 0; i < combos.length; i += taille) lots.push(combos.slice(i, i + taille));
  const fichier = fileURLToPath(import.meta.url);
  const resultats: ResultatCombo[] = [];
  await Promise.all(
    lots.map(
      (lot, index) =>
        new Promise<void>((resolve, reject) => {
          const worker = new Worker(fichier, {
            workerData: { combos: lot, parties, offsetGraine: (index + 1) * 10007 } satisfies Job,
            execArgv: process.execArgv,
          });
          worker.on('message', (msg: WorkerMsg) => {
            resultats.push(...msg.resultats);
          });
          worker.on('error', reject);
          worker.on('exit', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`Worker arrêté avec le code ${code}`));
          });
        }),
    ),
  );
  return resultats.sort((a, b) => a.combo.id - b.combo.id);
}

function ecrireRapport(resultats: ResultatCombo[], parties: number, dureeS: number): void {
  const defaut = resultats.find(
    (r) =>
      r.combo.recompenseArrivee.every((v) => v === 0) &&
      r.combo.cagnotteConsolation === 'aucune' &&
      r.combo.coupDePouce === 'aucun' &&
      r.combo.montantTrophees === 12 &&
      r.combo.pingpong.gpParPoint === 3,
  );
  const gpDDefaut = defaut ? statsMoyen(defaut).gpD : 0;
  const pingpongLu = lirePingPong();

  const lignes: string[] = [
    '# Balayage d\'équilibrage',
    '',
    `Graine maîtresse : ${GRAINE_MAITRESSE}. ${parties} parties par scénario et par combinaison. ${resultats.length} combinaisons × 3 scénarios. Durée : ${nombre(dureeS, 1)} s. Incertitude approx. ±3 points de pourcentage.`,
    '',
    '## Hypothèses',
    '',
    'Mêmes hypothèses que `docs/simulation-equilibrage.md` (7 mini-jeux numériques, pas d\'apéro, Perudo à élimination uniforme, Jeopardy par niveau, Codenames 50/50, Just One 60 % / 15 % doublons).',
    '',
    '### Changements depuis le premier rapport',
    '',
    '- Apéro retiré du jeu et de la simulation.',
    '- Uniquement les 7 mini-jeux à module de `config/mini-jeux.json`.',
    '- Trophées Touriste / Contre toutes attentes corrigés côté jeu (rang de course, remontée ≥ 2 places).',
    '- Biais D : anciens jeux physiques au classement + Perudo cyclique (20×6 + Dudo). Perudo corrigé en simu (permutation uniforme). `calculerClassement` départage les non-arrivés à GP plus bas mieux classés — inchangé.',
    `- Ping-pong lu depuis config (${pingpongLu.gpParPoint}/${pingpongLu.gpParPointContreHote}) ou surchargé par combo.`,
    '- Accélérations du balayage (barèmes inchangés) : Perudo à 1 dé/joueur, Just One sur 1 cycle, Jeopardy limité à 2 thèmes puis arrêté.',
    '',
    '## Cible',
    '',
    '- **Moyen** : D entre 28 et 40 %, A ≥ 12 %, D toujours favori.',
    '- **Prudent et fort** : personne > 50 %, A > 6 %.',
    `- Ne pas léser l'avance : GP moyen de D ≥ combinaison par défaut (${nombre(gpDDefaut)} GP).`,
    '',
    '## Tableau principal',
    '',
    '| # | Additif | Arrivée | Cagnotte | Pouce | Trophées | Ping | Prudent (A/B/C/D · tours · écart · GP D) | Moyen | Fort |',
    '| ---: | --- | --- | --- | --- | ---: | --- | --- | --- | --- |',
  ];

  for (const r of resultats) {
    const c = r.combo;
    const parScenario = Object.fromEntries(r.stats.map((s) => [s.scenario, s])) as Record<ScenarioId, StatsScenario>;
    lignes.push(
      `| ${c.id} | ${c.additif ? 'oui' : 'non'} | ${c.recompenseArrivee.join('/')} | ${c.cagnotteConsolation} | ${c.coupDePouce} | ${c.montantTrophees} | ${c.pingpong.gpParPoint}/${c.pingpong.gpParPointContreHote} | ${cellule(parScenario.prudent)} | ${cellule(parScenario.moyen)} | ${cellule(parScenario.fort)} |`,
    );
  }

  const classes = [...resultats].sort((a, b) => {
    if (a.combo.additif !== b.combo.additif) return a.combo.additif ? -1 : 1;
    return distanceCible(a, gpDDefaut) - distanceCible(b, gpDDefaut);
  });
  const top5 = classes.slice(0, 5);

  lignes.push('', '## Top 5 (additifs d\'abord, puis distance à la cible)', '');
  for (const [rang, r] of top5.entries()) {
    const ok = atteintCible(r, gpDDefaut);
    lignes.push(`### ${rang + 1}. ${libelleCombo(r.combo)}`);
    lignes.push('');
    lignes.push(
      `Distance ${nombre(distanceCible(r, gpDDefaut), 2)}. ${ok ? 'Dans la cible.' : 'Hors cible.'} ${r.combo.additif ? 'Purement additif.' : 'Touche au ping-pong.'}`,
    );
    lignes.push('');
    for (const s of r.stats) {
      lignes.push(`- **${s.scenario}** : ${cellule(s)}`);
    }
    const fake: Agregat = {
      ...creerAgregat(),
      origines: {},
    };
    for (const profil of PROFILS_BASE) {
      const src = r.stats.find((x) => x.scenario === 'moyen')?.origines[profil.pseudo] ?? {};
      fake.origines[profil.pseudo] = { ...src };
    }
    lignes.push('');
    lignes.push('Origine des GP (scénario moyen, moyenne par partie) :');
    lignes.push('');
    lignes.push(tableauOrigines(fake, parties));
    lignes.push('');
  }

  const meilleuresAdditives = classes.filter((r) => r.combo.additif && atteintCible(r, gpDDefaut));
  const meilleuresReductrices = classes.filter((r) => !r.combo.additif && atteintCible(r, gpDDefaut));

  lignes.push('## Observations', '');
  lignes.push(
    `- Combinaisons purement additives dans la cible : ${meilleuresAdditives.length}. Combinaisons qui touchent au ping-pong dans la cible : ${meilleuresReductrices.length}.`,
  );
  if (meilleuresAdditives.length > 0) {
    lignes.push(`- Meilleure additive : ${libelleCombo(meilleuresAdditives[0]!.combo)}.`);
  } else {
    lignes.push('- Aucune combinaison purement additive n\'atteint toute la cible avec ces hypothèses et ce volume.');
  }
  if (defaut) {
    const m = statsMoyen(defaut);
    lignes.push(
      `- Défaut (arrivée 0, cagnotte aucune, pouce aucun, trophées 12, ping 3/6), moyen : A ${pourcent(m.pA)}, D ${pourcent(m.pD)}, GP D ${nombre(m.gpD)}.`,
    );
  }
  lignes.push(
    '- Les leviers additifs (arrivée, cagnotte au dernier, coup de pouce, montant des trophées) aident A sans retirer directement à D ; réduire le ping-pong compresse tous les départs.',
  );
  lignes.push('- Aucune valeur de `config/` n\'a été modifiée : ce rapport est purement informatif.');
  lignes.push('');

  fs.writeFileSync(FICHIER, lignes.join('\n'), 'utf8');
}

async function main(): Promise<void> {
  const debut = Date.now();
  const combos = grille();
  console.log(`${combos.length} combinaisons × 3 scénarios × ${PARTIES} parties`);
  const resultats = await parallel(combos, PARTIES);
  const duree = (Date.now() - debut) / 1000;
  ecrireRapport(resultats, PARTIES, duree);
  console.log(`Rapport ${FICHIER}`);
  console.log(`Durée ${duree.toFixed(1)} s`);
}

if (!isMainThread) {
  const job = workerData as Job;
  workerMain(job).catch((erreur) => {
    console.error(erreur);
    process.exit(1);
  });
} else {
  main().catch((erreur) => {
    console.error(erreur);
    process.exit(1);
  });
}
