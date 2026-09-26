/**
 * Mini-balayage : coûts de dés × récompense d'arrivée (rapport uniquement).
 * Usage : npx tsx scripts/mini-balayage-des.ts
 *         npx tsx scripts/mini-balayage-des.ts 50   (parties par cas, essai rapide)
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import type { SurchargesSimulation } from '../server/store';
import {
  PROFILS_BASE,
  RACINE,
  SCENARIOS,
  type Agregat,
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
  jouerPartieSurSession,
} from './simulation-moteur';

const PARTIES = Math.max(1, Number(process.argv[2]) || 300);
const FICHIER = path.join(RACINE, 'docs', 'simulation-equilibrage.md');
const MARQUEUR = '## Annexe 2 — mini-balayage dés et arrivée';
/** Décalage de graines pour ne pas chevaucher le rapport principal ni l'annexe 1. */
const OFFSET_BASE = 900;

type Combo = {
  id: number;
  booste: number;
  super: number;
  recompenseArrivee: number[];
};

type StatsSym = {
  scenario: ScenarioId;
  pA: number;
  pB: number;
  pC: number;
  pD: number;
  tours: number;
};

type ResultatCombo = {
  combo: Combo;
  sym: StatsSym[];
  pBPrudent: number;
  pBAsym: number;
  toursMoyen: number;
  coutDesMiseur: number;
};

function grille(): Combo[] {
  const couts: Array<{ booste: number; super: number }> = [
    { booste: 1, super: 2 },
    { booste: 2, super: 4 },
    { booste: 3, super: 6 },
  ];
  const arrivees = [
    [25, 15, 8, 0],
    [40, 25, 12, 0],
    [60, 35, 15, 0],
  ];
  const combos: Combo[] = [];
  let id = 0;
  for (const cout of couts) {
    for (const recompenseArrivee of arrivees) {
      combos.push({
        id: id++,
        booste: cout.booste,
        super: cout.super,
        recompenseArrivee: [...recompenseArrivee],
      });
    }
  }
  return combos;
}

function surchargesDe(combo: Combo): SurchargesSimulation {
  return {
    recompenseArrivee: combo.recompenseArrivee,
    misesDe: { booste: combo.booste, super: combo.super },
  };
}

function jouerCombo(combo: Combo, parties: number): ResultatCombo {
  const pingpong = lirePingPong();
  const session = creerSession(surchargesDe(combo), true);
  const sym: StatsSym[] = [];
  let agregatPrudent: Agregat | null = null;
  try {
    for (const [indexScenario, scenario] of SCENARIOS.entries()) {
      const agregat = creerAgregat();
      for (let partie = 0; partie < parties; partie += 1) {
        integrer(
          agregat,
          jouerPartieSurSession(session, {
            scenario: scenario.id,
            graine: grainePartie(indexScenario, partie, OFFSET_BASE + combo.id * 31),
            pingpong,
          }),
        );
      }
      const stats: StatsSym = {
        scenario: scenario.id,
        pA: (agregat.victoires.A ?? 0) / parties,
        pB: (agregat.victoires.B ?? 0) / parties,
        pC: (agregat.victoires.C ?? 0) / parties,
        pD: (agregat.victoires.D ?? 0) / parties,
        tours: moyenne(agregat.tours),
      };
      sym.push(stats);
      if (scenario.id === 'prudent') agregatPrudent = agregat;
    }
    if (!agregatPrudent) throw new Error('Scénario prudent absent');

    const stylesParPseudo: Partial<Record<string, ScenarioId>> = {};
    for (const profil of PROFILS_BASE) {
      stylesParPseudo[profil.pseudo] = profil.pseudo === 'B' ? 'fort' : 'prudent';
    }
    const agregatAsym = creerAgregat();
    for (let partie = 0; partie < parties; partie += 1) {
      integrer(
        agregatAsym,
        jouerPartieSurSession(session, {
          scenario: 'prudent',
          stylesParPseudo,
          graine: grainePartie(SCENARIOS.length, partie, OFFSET_BASE + combo.id * 31 + 7),
          pingpong,
        }),
      );
    }
    const moyen = sym.find((s) => s.scenario === 'moyen');
    const coutDes =
      Math.abs((agregatAsym.origines.B?.['mises au dé'] ?? 0) / parties);
    return {
      combo,
      sym,
      pBPrudent: (agregatPrudent.victoires.B ?? 0) / parties,
      pBAsym: (agregatAsym.victoires.B ?? 0) / parties,
      toursMoyen: moyen?.tours ?? moyenne(agregatAsym.tours),
      coutDesMiseur: coutDes,
    };
  } finally {
    fermerSession(session);
  }
}

function miseRentable(r: ResultatCombo): boolean {
  return r.pBAsym + 1e-9 >= r.pBPrudent - 0.03;
}

function equilibreConserve(r: ResultatCombo): boolean {
  const moyen = r.sym.find((s) => s.scenario === 'moyen');
  if (!moyen) return false;
  if (moyen.pD < 0.28 || moyen.pD > 0.4) return false;
  if (moyen.pA < 0.12) return false;
  if (moyen.pD <= Math.max(moyen.pA, moyen.pB, moyen.pC)) return false;
  for (const s of r.sym) {
    if (s.scenario === 'moyen') continue;
    if (Math.max(s.pA, s.pB, s.pC, s.pD) > 0.5) return false;
    if (s.pA <= 0.06) return false;
  }
  return true;
}

function celluleVictoires(s: StatsSym): string {
  return `${pourcent(s.pA)} / ${pourcent(s.pB)} / ${pourcent(s.pC)} / ${pourcent(s.pD)}`;
}

function deltaB(r: ResultatCombo): number {
  return r.pBAsym - r.pBPrudent;
}

function libelleCombo(combo: Combo): string {
  return `dés ${combo.booste}/${combo.super} · arrivée ${combo.recompenseArrivee.join('/')}`;
}

function rapport(resultats: ResultatCombo[], parties: number, duree: string): string {
  const lignes: string[] = [
    MARQUEUR,
    '',
    `${parties} parties par cas. 9 combinaisons (coût boosté/super × récompense d'arrivée). Ping-pong 1/2 et le reste inchangés (surcharges en mémoire seulement). Mode léger (Perudo 1 dé, Just One 1 cycle, Jeopardy 2 thèmes). Durée : ${duree} s.`,
    '',
    'Cas : 3 scénarios symétriques + B mise fort seul (les autres prudents). « Δ B » = victoires de B en asymétrique − victoires de B en tout-prudent (même combinaison).',
    '',
    'Critères :',
    '- **Mise rentable** : Δ B ≥ −3 points.',
    '- **Équilibre** : en moyen, D ∈ [28 %, 40 %], A ≥ 12 %, D favori ; en prudent et fort, personne > 50 % et A > 6 %.',
    '',
    '### Tableau',
    '',
    '| # | Dés | Arrivée | Prudent A/B/C/D | Moyen A/B/C/D | Fort A/B/C/D | B asym. | B prudent | Δ B | Tours (moyen) | Coût dés B (asym.) | Rentable | Équilibre |',
    '| --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |',
  ];
  for (const r of resultats) {
    const prudent = r.sym.find((s) => s.scenario === 'prudent')!;
    const moyen = r.sym.find((s) => s.scenario === 'moyen')!;
    const fort = r.sym.find((s) => s.scenario === 'fort')!;
    const d = deltaB(r);
    const signe = d >= 0 ? '+' : '−';
    lignes.push(
      `| ${r.combo.id + 1} | ${r.combo.booste}/${r.combo.super} | ${r.combo.recompenseArrivee.join('/')} | ${celluleVictoires(prudent)} | ${celluleVictoires(moyen)} | ${celluleVictoires(fort)} | ${pourcent(r.pBAsym)} | ${pourcent(r.pBPrudent)} | ${signe}${nombre(Math.abs(d) * 100, 1)} pts | ${nombre(r.toursMoyen)} | ${nombre(r.coutDesMiseur)} | ${miseRentable(r) ? 'oui' : 'non'} | ${equilibreConserve(r) ? 'oui' : 'non'} |`,
    );
  }
  const retenues = resultats
    .filter((r) => miseRentable(r) && equilibreConserve(r))
    .sort((a, b) => deltaB(a) - deltaB(b));
  lignes.push('');
  lignes.push('### Combinaisons retenues (mise rentable + équilibre)');
  lignes.push('');
  if (retenues.length === 0) {
    lignes.push('Aucune combinaison ne remplit les deux critères avec ces 300 parties.');
  } else {
    lignes.push('Classées de la plus neutre (Δ B le plus proche de zéro par le bas) à la plus favorable au miseur.');
    lignes.push('');
    lignes.push('| Rang | Combinaison | Δ B | Moyen A/B/C/D | B asym. vs B prudent |');
    lignes.push('| --- | --- | ---: | --- | --- |');
    retenues.forEach((r, index) => {
      const moyen = r.sym.find((s) => s.scenario === 'moyen')!;
      const d = deltaB(r);
      const signe = d >= 0 ? '+' : '−';
      lignes.push(
        `| ${index + 1} | ${libelleCombo(r.combo)} | ${signe}${nombre(Math.abs(d) * 100, 1)} pts | ${celluleVictoires(moyen)} | ${pourcent(r.pBAsym)} vs ${pourcent(r.pBPrudent)} |`,
      );
    });
  }
  lignes.push('');
  lignes.push('Aucune valeur de `config/` n\'a été modifiée.');
  lignes.push('');
  return lignes.join('\n');
}

async function executerWorkers(combos: Combo[], parties: number): Promise<ResultatCombo[]> {
  const cpus = Math.max(1, Math.min(os.cpus().length || 4, combos.length));
  const taille = Math.ceil(combos.length / cpus);
  const lots: Combo[][] = [];
  for (let i = 0; i < combos.length; i += taille) lots.push(combos.slice(i, i + taille));
  const fichier = fileURLToPath(import.meta.url);
  const resultats: ResultatCombo[] = [];
  await Promise.all(
    lots.map(
      (lot) =>
        new Promise<void>((resolve, reject) => {
          const worker = new Worker(fichier, {
            workerData: { combos: lot, parties },
            execArgv: process.execArgv,
          });
          worker.on('message', (msg: { resultats: ResultatCombo[] } | { erreur: string }) => {
            if ('erreur' in msg) {
              reject(new Error(msg.erreur));
              return;
            }
            resultats.push(...msg.resultats);
            for (const r of msg.resultats) {
              console.log(`Combo ${r.combo.id + 1}/9 : ${libelleCombo(r.combo)}`);
            }
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

async function main(): Promise<void> {
  const debut = Date.now();
  const combos = grille();
  console.log(`${combos.length} combinaisons × 4 cas × ${PARTIES} parties`);
  const resultats = await executerWorkers(combos, PARTIES);
  const duree = ((Date.now() - debut) / 1000).toFixed(1);
  const annexe = rapport(resultats, PARTIES, duree);
  const actuel = fs.readFileSync(FICHIER, 'utf8');
  const sansAnnexe2 = actuel.replace(new RegExp(`\\n${MARQUEUR.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*$`), '').trimEnd();
  fs.writeFileSync(FICHIER, `${sansAnnexe2}\n\n${annexe}`, 'utf8');
  console.log(`Rapport ${FICHIER}`);
  console.log(`Durée ${duree} s`);
  const retenues = resultats.filter((r) => miseRentable(r) && equilibreConserve(r));
  console.log(`Retenues : ${retenues.length}`);
}

if (isMainThread) {
  main().catch((erreur) => {
    console.error(erreur);
    process.exit(1);
  });
} else {
  const { combos, parties } = workerData as { combos: Combo[]; parties: number };
  try {
    const resultats = combos.map((combo) => jouerCombo(combo, parties));
    parentPort?.postMessage({ resultats });
  } catch (erreur) {
    parentPort?.postMessage({ erreur: erreur instanceof Error ? erreur.message : String(erreur) });
  }
}
