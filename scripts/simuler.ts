/**
 * Simulation d'équilibrage. Lit la config et le vrai réducteur, n'écrit que le rapport.
 * Usage : npm run simulation
 *         npx tsx scripts/simuler.ts 20   (volume réduit, pour un essai)
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { solde } from '../shared/soldes';
import { trophees } from '../shared/trophees';
import type { Devines } from '../shared/topten';
import type { Action, Course, EtatJeu, Origine } from '../shared/types';
import { lireCartesChance, lireCartesMalchance, lireCatalogueTrophees } from '../server/course-config';
import { lireCatalogue, lireJeopardy, lireUndercover } from '../server/mini-jeux-config';
import { melanger } from '../server/plateau';
import { creerStore, type Store } from '../server/store';

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const GRAINE_MAITRESSE = 20260926;
const PARTIES = Math.max(1, Number(process.argv[2]) || 1000);
const HOTE: Origine = { role: 'hote' };

const PROFILS = [
  { pseudo: 'A', avatar: 'perso-carpe', gp: 15, points: 1 },
  { pseudo: 'B', avatar: 'perso-verre-eau', gp: 60, points: 4 },
  { pseudo: 'C', avatar: 'perso-piment', gp: 90, points: 6 },
  { pseudo: 'D', avatar: 'perso-planete', gp: 105, points: 7 },
] as const;

type ScenarioId = 'prudent' | 'moyen' | 'fort';

const SCENARIOS: Array<{ id: ScenarioId; nom: string }> = [
  { id: 'prudent', nom: '1 — Prudent' },
  { id: 'moyen', nom: '2 — Moyen' },
  { id: 'fort', nom: '3 — Fort' },
];

type Generateur = {
  entier: (max: number) => number;
  reel: () => number;
};

function creerGenerateur(graine: number): Generateur {
  let etat = graine >>> 0 || 1;
  const suivant = () => {
    etat = (Math.imul(etat, 1664525) + 1013904223) >>> 0;
    return etat;
  };
  return {
    entier(max: number) {
      const valeur = suivant();
      return max <= 0 ? 0 : valeur % max;
    },
    reel() {
      return suivant() / 4294967296;
    },
  };
}

function grainePartie(scenario: number, index: number): number {
  return (Math.imul(GRAINE_MAITRESSE, 1009) ^ Math.imul(scenario + 1, 9176) ^ Math.imul(index + 1, 7919)) >>> 0;
}

type Origines = Record<string, number>;

type PartieSimulee = {
  tours: number;
  scores: Record<string, number>;
  positions: Record<string, number>;
  ecart: number;
  victoires: string[];
  exAequo: boolean;
  arriveesMultiples: boolean;
  origines: Record<string, Origines>;
  misesDe: number;
  misesRoue: number;
  cagnotteMax: number;
  cagnotteFin: number;
  jackpots: number;
  attribuables: string[];
  tires: Array<{ id: string; gagnants: string[] }>;
  journal: string[];
};

type Agregat = {
  tours: number[];
  scores: Record<string, number[]>;
  positions: Record<string, number[]>;
  ecarts: number[];
  victoires: Record<string, number>;
  exAequo: number;
  arriveesMultiples: number;
  origines: Record<string, Origines>;
  misesDe: number;
  misesRoue: number;
  cagnotteMax: number;
  cagnotteFin: number;
  cagnottePic: number;
  jackpots: number;
  attribuables: Record<string, number>;
  tires: Record<string, number>;
  gagnants: Record<string, Record<string, number>>;
};

function creerAgregat(): Agregat {
  const scores: Record<string, number[]> = {};
  const positions: Record<string, number[]> = {};
  const victoires: Record<string, number> = {};
  const origines: Record<string, Origines> = {};
  for (const profil of PROFILS) {
    scores[profil.pseudo] = [];
    positions[profil.pseudo] = [];
    victoires[profil.pseudo] = 0;
    origines[profil.pseudo] = {};
  }
  return {
    tours: [],
    scores,
    positions,
    ecarts: [],
    victoires,
    exAequo: 0,
    arriveesMultiples: 0,
    origines,
    misesDe: 0,
    misesRoue: 0,
    cagnotteMax: 0,
    cagnotteFin: 0,
    cagnottePic: 0,
    jackpots: 0,
    attribuables: {},
    tires: {},
    gagnants: {},
  };
}

function ajouterOrigine(cible: Origines, cle: string, montant: number): void {
  cible[cle] = (cible[cle] ?? 0) + montant;
}

function moyenne(valeurs: number[]): number {
  if (valeurs.length === 0) return 0;
  return valeurs.reduce((somme, valeur) => somme + valeur, 0) / valeurs.length;
}

function ecartType(valeurs: number[]): number {
  if (valeurs.length < 2) return 0;
  const centre = moyenne(valeurs);
  const variance = valeurs.reduce((somme, valeur) => somme + (valeur - centre) ** 2, 0) / (valeurs.length - 1);
  return Math.sqrt(variance);
}

function nombre(valeur: number, decimales = 1): string {
  return valeur.toLocaleString('fr-FR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
}

function pourcent(valeur: number): string {
  return `${nombre(valeur * 100, 1)} %`;
}

const catalogueJeux = lireCatalogue(RACINE);
const catalogueTrophees = lireCatalogueTrophees(RACINE);
const configJeopardy = lireJeopardy(RACINE);
const configUndercover = lireUndercover(RACINE);
const titresChance = new Set(lireCartesChance(RACINE).map((carte) => carte.titre));
const titresMalchance = new Set(lireCartesMalchance(RACINE).map((carte) => carte.titre));

let gen = creerGenerateur(GRAINE_MAITRESSE);
const alea = (max: number) => gen.entier(max);
const reel = () => gen.reel();

const dossier = path.join(os.tmpdir(), `gp-simulation-${process.pid}`);
const store: Store = creerStore({
  dossierData: dossier,
  titre: 'Simulation',
  nbJoueursMax: 4,
  dev: true,
  sauvegardesAuto: false,
  simulation: true,
  alea,
});

let cagnotteMaxPartie = 0;

function etat(): EtatJeu {
  return store.etat();
}

function course(): Course {
  const valeur = etat().course;
  if (!valeur) throw new Error('La course est absente');
  return valeur;
}

function soldeDe(id: string): number {
  return solde(etat().transactions, id, 'visibles');
}

function pseudoDe(id: string): string {
  return etat().joueurs.find((joueur) => joueur.id === id)?.pseudo ?? id;
}

function agir(action: Action, origine: Origine = HOTE): void {
  const reponse = store.dispatch(action, origine);
  if (!reponse.ok) {
    const actuelle = etat().course;
    throw new Error(`${action.type} refusé (${actuelle?.phase ?? 'sans course'} / ${actuelle?.etape?.genre ?? '-'}) : ${reponse.erreur}`);
  }
  const cagnotte = etat().course?.cagnotte ?? 0;
  if (cagnotte > cagnotteMaxPartie) cagnotteMaxPartie = cagnotte;
}

function optionDe(scenario: ScenarioId, disponible: number): string {
  const plusForte = disponible >= 10 ? 'super' : disponible >= 5 ? 'booste' : 'normal';
  if (scenario === 'prudent') return 'normal';
  if (scenario === 'fort') return plusForte;
  const tirage = reel();
  const voulu = tirage < 0.3 ? 'normal' : tirage < 0.8 ? 'booste' : 'super';
  const mise = voulu === 'super' ? 10 : voulu === 'booste' ? 5 : 0;
  if (mise <= disponible) return voulu;
  return plusForte;
}

function miseRoue(scenario: ScenarioId, disponible: number): number {
  if (disponible <= 0) return 0;
  if (scenario === 'prudent') return reel() < 0.8 ? 0 : Math.min(5, disponible);
  if (scenario === 'moyen') return Math.min(disponible, Math.round(disponible * 0.15));
  return Math.min(disponible, Math.round(disponible * 0.5));
}

function jouerPhysique(saisie: string): void {
  const ids = etat().joueurs.map((joueur) => joueur.id);
  if (saisie === 'equipes') {
    const melange = melanger(ids, alea);
    const milieu = Math.max(1, Math.floor(melange.length / 2));
    agir({
      type: 'validerResultats',
      saisie: {
        mode: 'equipes',
        equipeA: melange.slice(0, milieu),
        equipeB: melange.slice(milieu),
        gagnante: alea(2) === 0 ? 'A' : 'B',
      },
    });
    return;
  }
  agir({
    type: 'validerResultats',
    saisie: {
      mode: 'classement',
      ordre: melanger(ids, alea).map((joueurId) => ({ joueurId, exAequo: false })),
    },
  });
}

function jouerJeopardy(): void {
  for (let theme = 0; theme < configJeopardy.themes.length; theme += 1) {
    for (let niveau = 0; niveau < configJeopardy.valeurs.length; niveau += 1) {
      const choisisseur = course().jeopardy?.choisisseurId;
      if (!choisisseur) throw new Error('Jeopardy sans choisisseur');
      agir({ type: 'choisirCaseJeopardy', theme, niveau });
      if (reel() < 0.7) {
        agir({ type: 'jugerJeopardy', juste: true });
        continue;
      }
      agir({ type: 'jugerJeopardy', juste: false });
      const autres = course().ordre.filter((id) => id !== choisisseur);
      if (reel() < 0.5 && autres.length > 0) {
        const voleur = autres[alea(autres.length)];
        if (!voleur) throw new Error('Voleur absent');
        agir({ type: 'buzzJeopardy' }, { role: 'joueur', joueurId: voleur });
        agir({ type: 'jugerJeopardy', juste: true });
      } else if (course().jeopardy?.question) {
        agir({ type: 'personneJeopardy' });
      }
    }
  }
}

function jouerTopTen(): void {
  const total = course().topten?.captens.length ?? 0;
  for (let manche = 0; manche < total; manche += 1) {
    agir({ type: 'lancerMancheTopTen' });
    const courante = course().topten?.manches.at(-1);
    if (!courante) throw new Error('Manche de Top Ten absente');
    const ordre = [...courante.repondants].sort((a, b) => (courante.numeros[a] ?? 0) - (courante.numeros[b] ?? 0));
    const echanges = alea(3);
    for (let index = 0; index < echanges; index += 1) {
      const place = alea(Math.max(1, ordre.length - 1));
      const gauche = ordre[place];
      const droite = ordre[place + 1];
      if (!gauche || !droite) continue;
      ordre[place] = droite;
      ordre[place + 1] = gauche;
    }
    const devines: Devines = {};
    for (const id of courante.repondants) devines[id] = reel() < 0.3 ? (courante.numeros[id] ?? null) : null;
    agir({ type: 'validerOrdreTopTen', ordre, devines });
  }
  agir({ type: 'recapTopTen' });
}

function jouerUndercover(): void {
  for (let manche = 0; manche < configUndercover.manches; manche += 1) {
    agir({ type: 'lancerMancheUndercover' });
    const courante = course().undercover?.manches.at(-1);
    if (!courante) throw new Error('Manche d\'Undercover absente');
    const civils = courante.ordreParole.filter((id) => id !== courante.undercoverId);
    if (reel() < 0.7) {
      agir({ type: 'eliminerUndercover', joueurId: courante.undercoverId });
      agir({ type: 'devinerUndercover', trouve: reel() < 0.3 });
    } else {
      const premier = civils[0];
      const second = civils[1];
      if (!premier || !second) throw new Error('Pas assez de civils');
      agir({ type: 'eliminerUndercover', joueurId: premier });
      agir({ type: 'eliminerUndercover', joueurId: second });
    }
  }
  agir({ type: 'recapUndercover' });
}

function jouerPoker(): void {
  const ids = etat().joueurs.map((joueur) => joueur.id);
  const piles = [...ids.map(() => 20), 20];
  for (let transfert = 0; transfert < 40; transfert += 1) {
    const depuis = alea(piles.length);
    const vers = alea(piles.length);
    if (depuis === vers || (piles[depuis] ?? 0) <= 0) continue;
    piles[depuis] = (piles[depuis] ?? 0) - 1;
    piles[vers] = (piles[vers] ?? 0) + 1;
  }
  const tapis: Record<string, number> = {};
  ids.forEach((id, index) => {
    tapis[id] = piles[index] ?? 0;
  });
  agir({ type: 'validerPoker', tapis, tapisHote: piles[piles.length - 1] ?? 0 });
}

function jouerMiniJeu(): void {
  const joues = new Set(course().joues);
  const restants = catalogueJeux.jeux.filter((jeu) => !joues.has(jeu.id));
  const pool = restants.length > 0 ? restants : catalogueJeux.jeux.filter((jeu) => jeu.module === 'aucun');
  const jeu = pool[alea(pool.length)];
  if (!jeu) throw new Error('Aucun mini-jeu');
  agir({ type: 'choisirMiniJeu', id: jeu.id });
  if (jeu.module === 'jeopardy') jouerJeopardy();
  else if (jeu.module === 'topten') jouerTopTen();
  else if (jeu.module === 'undercover') jouerUndercover();
  else if (jeu.module === 'poker') jouerPoker();
  else jouerPhysique(jeu.saisie);
  if (course().phase === 'miniJeu') agir({ type: 'passerAuxDeplacements' });
}

function jouerDeplacements(scenario: ScenarioId): void {
  let garde = 0;
  while (course().phase === 'deplacements') {
    if (++garde > 40) throw new Error('Déplacements bloqués');
    const actuelle = course();
    const id = actuelle.ordre[actuelle.indexCourant];
    if (!id || !actuelle.etape) throw new Error('Tour de déplacement bloqué');
    const origine: Origine = { role: 'joueur', joueurId: id };
    if (actuelle.etape.genre === 'lancer') agir({ type: 'lancerDe', option: optionDe(scenario, soldeDe(id)) }, origine);
    else agir({ type: 'miserRoue', montant: miseRoue(scenario, soldeDe(id)) }, origine);
  }
}

function donnerApero(): void {
  for (const joueur of etat().joueurs) {
    agir({ type: 'ajouterGP', joueurId: joueur.id, montant: 20 + alea(21), libelle: 'Apéro', source: 'apero' });
  }
}

function ligneTour(tour: number): string {
  const actuelle = course();
  const positions = etat().joueurs.map((joueur) => `${joueur.pseudo} case ${actuelle.positions[joueur.id] ?? 0} · ${soldeDe(joueur.id)} GP`);
  const marques = actuelle.historique.effets
    .filter((effet) => effet.tour === tour && effet.type !== 'de')
    .map((effet) => {
      const detail = effet.roue ? ` ${effet.roue.option}` : '';
      const cases = effet.cases ? ` ${effet.cases > 0 ? '+' : ''}${effet.cases}` : '';
      return `${pseudoDe(effet.joueurId)} ${effet.type}${cases}${detail}`;
    });
  return `Tour ${tour} — ${positions.join(' ; ')}${marques.length > 0 ? ` — ${marques.join(', ')}` : ''}`;
}

function classerOrigine(transaction: { source: string; libelle: string }): string {
  if (transaction.source === 'ping-pong') return 'ping-pong';
  if (transaction.source === 'apero') return 'apéro';
  if (transaction.source === 'poker') return 'poker';
  if (transaction.source === 'trophee') return 'trophées';
  if (transaction.source === 'mise') return 'mises au dé';
  if (transaction.source === 'roue') return 'roue (nette)';
  if (transaction.source === 'mini-jeu') return `mini-jeu : ${transaction.libelle}`;
  if (transaction.source === 'plateau' && transaction.libelle === 'Case bonus') return 'bonus';
  if (transaction.source === 'plateau' && transaction.libelle === 'Cagnotte') return 'cagnotte';
  if (transaction.source === 'carte' && titresChance.has(transaction.libelle)) return 'chance';
  if (transaction.source === 'carte' && titresMalchance.has(transaction.libelle)) return 'malchance';
  return `autre (${transaction.source})`;
}

function jouerPartie(scenario: ScenarioId, graine: number, detail: boolean): PartieSimulee {
  gen = creerGenerateur(graine);
  cagnotteMaxPartie = 0;
  agir({ type: 'reinitialiserPartie' });
  for (const profil of PROFILS) {
    agir({ type: 'rejoindre', pseudo: profil.pseudo, avatar: profil.avatar }, { role: 'joueur', joueurId: null });
  }
  for (const joueur of etat().joueurs) {
    const profil = PROFILS.find((candidat) => candidat.pseudo === joueur.pseudo);
    agir({
      type: 'ajouterGP',
      joueurId: joueur.id,
      montant: profil?.gp ?? 0,
      libelle: 'Ping-pong',
      source: 'ping-pong',
    });
  }
  agir({ type: 'demarrerCourse' });
  let apero = false;
  const journal: string[] = [];
  let securite = 0;
  while (course().phase !== 'terminee') {
    if (++securite > 80) {
      agir({ type: 'terminerCourse' });
      break;
    }
    const phase = course().phase;
    if (phase === 'preparation' || phase === 'finTour') {
      const max = Math.max(0, ...Object.values(course().positions));
      if (!apero && max >= course().regles.longueur / 2) {
        donnerApero();
        apero = true;
      }
      agir({ type: 'nouveauTour' });
      continue;
    }
    if (phase === 'choixMiniJeu') {
      jouerMiniJeu();
      continue;
    }
    if (phase === 'deplacements') {
      const tour = course().tour;
      jouerDeplacements(scenario);
      if (detail) journal.push(ligneTour(tour));
      continue;
    }
    throw new Error(`Phase inattendue : ${phase}`);
  }
  if (!apero) donnerApero();
  const avant = trophees(etat(), catalogueTrophees.trophees);
  agir({ type: 'ouvrirPodium' });
  agir({ type: 'tirerTrophees' });
  while ((course().ceremonie?.reveles ?? 0) < (course().ceremonie?.tirage.length ?? 0)) agir({ type: 'revelerTrophee' });
  const tirage = course().ceremonie?.tirage ?? [];
  agir({ type: 'revelerClassement' });
  agir({ type: 'revelerGagnant' });

  const scores: Record<string, number> = {};
  const positions: Record<string, number> = {};
  const origines: Record<string, Origines> = {};
  let misesDe = 0;
  let misesRoue = 0;
  for (const joueur of etat().joueurs) {
    scores[joueur.pseudo] = soldeDe(joueur.id);
    positions[joueur.pseudo] = course().positions[joueur.id] ?? 0;
    const lignes: Origines = {};
    for (const transaction of etat().transactions) {
      if (transaction.joueurId !== joueur.id) continue;
      ajouterOrigine(lignes, classerOrigine(transaction), transaction.montant);
      if (transaction.source === 'mise') misesDe += -transaction.montant;
      if (transaction.source === 'roue' && transaction.montant < 0) misesRoue += -transaction.montant;
    }
    origines[joueur.pseudo] = lignes;
  }
  const valeurs = PROFILS.map((profil) => scores[profil.pseudo] ?? 0);
  const meilleur = Math.max(...valeurs);
  const victoires = PROFILS.filter((profil) => (scores[profil.pseudo] ?? 0) === meilleur).map((profil) => profil.pseudo);
  const tries = [...valeurs].sort((a, b) => b - a);
  return {
    tours: course().tour,
    scores,
    positions,
    ecart: (tries[0] ?? 0) - (tries[1] ?? 0),
    victoires,
    exAequo: victoires.length > 1,
    arriveesMultiples: course().arrivees.length >= 2,
    origines,
    misesDe,
    misesRoue,
    cagnotteMax: cagnotteMaxPartie,
    cagnotteFin: course().cagnotte,
    jackpots: course().historique.effets.filter((effet) => effet.roue?.option === 'jackpot').length,
    attribuables: avant.filter((trophee) => trophee.attribuable).map((trophee) => trophee.id),
    tires: tirage.map((trophee) => ({
      id: trophee.id,
      gagnants: trophee.gagnants.map((id) => pseudoDe(id)),
    })),
    journal,
  };
}

function integrer(agregat: Agregat, partie: PartieSimulee): void {
  agregat.tours.push(partie.tours);
  agregat.ecarts.push(partie.ecart);
  if (partie.exAequo) agregat.exAequo += 1;
  if (partie.arriveesMultiples) agregat.arriveesMultiples += 1;
  agregat.misesDe += partie.misesDe;
  agregat.misesRoue += partie.misesRoue;
  agregat.cagnotteMax += partie.cagnotteMax;
  agregat.cagnotteFin += partie.cagnotteFin;
  agregat.cagnottePic = Math.max(agregat.cagnottePic, partie.cagnotteMax);
  agregat.jackpots += partie.jackpots;
  for (const profil of PROFILS) {
    agregat.scores[profil.pseudo]?.push(partie.scores[profil.pseudo] ?? 0);
    agregat.positions[profil.pseudo]?.push(partie.positions[profil.pseudo] ?? 0);
    if (partie.victoires.includes(profil.pseudo)) agregat.victoires[profil.pseudo] = (agregat.victoires[profil.pseudo] ?? 0) + 1;
    const lignes = agregat.origines[profil.pseudo];
    if (!lignes) continue;
    for (const [cle, montant] of Object.entries(partie.origines[profil.pseudo] ?? {})) ajouterOrigine(lignes, cle, montant);
  }
  for (const id of partie.attribuables) agregat.attribuables[id] = (agregat.attribuables[id] ?? 0) + 1;
  for (const trophee of partie.tires) {
    agregat.tires[trophee.id] = (agregat.tires[trophee.id] ?? 0) + 1;
    const gagnants = (agregat.gagnants[trophee.id] ??= {});
    for (const pseudo of trophee.gagnants) gagnants[pseudo] = (gagnants[pseudo] ?? 0) + 1;
  }
}

function clesOrigine(agregat: Agregat): string[] {
  const cles = new Set<string>();
  for (const lignes of Object.values(agregat.origines)) {
    for (const cle of Object.keys(lignes)) cles.add(cle);
  }
  const ordre = ['ping-pong', 'bonus', 'chance', 'malchance', 'cagnotte', 'roue (nette)', 'mises au dé', 'apéro', 'poker', 'trophées'];
  const mini = [...cles].filter((cle) => cle.startsWith('mini-jeu')).sort((a, b) => a.localeCompare(b, 'fr'));
  const autres = [...cles].filter((cle) => !ordre.includes(cle) && !cle.startsWith('mini-jeu')).sort((a, b) => a.localeCompare(b, 'fr'));
  return [...ordre, ...mini, ...autres];
}

function tableauScores(agregat: Agregat): string {
  const lignes = ['| Joueur | Moyenne | Écart-type | Minimum | Maximum |', '| --- | ---: | ---: | ---: | ---: |'];
  for (const profil of PROFILS) {
    const valeurs = agregat.scores[profil.pseudo] ?? [];
    lignes.push(`| ${profil.pseudo} | ${nombre(moyenne(valeurs))} | ${nombre(ecartType(valeurs))} | ${nombre(Math.min(...valeurs), 0)} | ${nombre(Math.max(...valeurs), 0)} |`);
  }
  return lignes.join('\n');
}

function tableauVictoires(agregat: Agregat, parties: number): string {
  const lignes = ['| Joueur | Victoires |', '| --- | ---: |'];
  for (const profil of PROFILS) {
    lignes.push(`| ${profil.pseudo} | ${pourcent((agregat.victoires[profil.pseudo] ?? 0) / parties)} |`);
  }
  lignes.push(`| Ex aequo | ${pourcent(agregat.exAequo / parties)} |`);
  return lignes.join('\n');
}

function tableauOrigines(agregat: Agregat, parties: number): string {
  const cles = clesOrigine(agregat);
  const entete = `| Source | ${PROFILS.map((profil) => profil.pseudo).join(' | ')} |`;
  const sep = `| --- | ${PROFILS.map(() => '---:').join(' | ')} |`;
  const lignes = [entete, sep];
  for (const cle of cles) {
    const cellules = PROFILS.map((profil) => nombre((agregat.origines[profil.pseudo]?.[cle] ?? 0) / parties));
    lignes.push(`| ${cle} | ${cellules.join(' | ')} |`);
  }
  return lignes.join('\n');
}

function tableauTrophees(agregat: Agregat, parties: number): string {
  const lignes = ['| Trophée | Attribuable | Tiré | A | B | C | D |', '| --- | ---: | ---: | ---: | ---: | ---: | ---: |'];
  for (const trophee of catalogueTrophees.trophees) {
    const gagnants = agregat.gagnants[trophee.id] ?? {};
    lignes.push(
      `| ${trophee.nom} | ${pourcent((agregat.attribuables[trophee.id] ?? 0) / parties)} | ${pourcent((agregat.tires[trophee.id] ?? 0) / parties)} | ${pourcent((gagnants.A ?? 0) / parties)} | ${pourcent((gagnants.B ?? 0) / parties)} | ${pourcent((gagnants.C ?? 0) / parties)} | ${pourcent((gagnants.D ?? 0) / parties)} |`,
    );
  }
  return lignes.join('\n');
}

function observations(rapports: Array<{ nom: string; agregat: Agregat }>, parties: number): string[] {
  const lignes: string[] = [];
  for (const rapport of rapports) {
    const taux = PROFILS.map((profil) => ({
      pseudo: profil.pseudo,
      taux: (rapport.agregat.victoires[profil.pseudo] ?? 0) / parties,
    })).sort((a, b) => b.taux - a.taux);
    const premier = taux[0];
    const dernier = taux[taux.length - 1];
    if (premier && premier.taux >= 0.6) {
      lignes.push(`${rapport.nom} : ${premier.pseudo} gagne ${pourcent(premier.taux)} des parties. Le départ au ping-pong, ou le style de mise, pèse beaucoup.`);
    }
    if (dernier && dernier.taux < 0.08) {
      lignes.push(`${rapport.nom} : ${dernier.pseudo} ne gagne que ${pourcent(dernier.taux)}. Sa chance réelle est faible dans ce style de mise.`);
    }
    const tours = moyenne(rapport.agregat.tours);
    if (tours < 6) lignes.push(`${rapport.nom} : la course dure ${nombre(tours, 1)} tours en moyenne. C'est court pour une soirée.`);
    if (tours > 14) lignes.push(`${rapport.nom} : la course dure ${nombre(tours, 1)} tours en moyenne. C'est long pour une soirée.`);
    const cles = clesOrigine(rapport.agregat);
    let dominante = '';
    let poids = 0;
    for (const cle of cles) {
      const total = PROFILS.reduce((somme, profil) => somme + Math.abs(rapport.agregat.origines[profil.pseudo]?.[cle] ?? 0), 0) / parties;
      if (total > poids) {
        poids = total;
        dominante = cle;
      }
    }
    const scoreMoyen = moyenne(PROFILS.flatMap((profil) => rapport.agregat.scores[profil.pseudo] ?? []));
    if (dominante && poids > scoreMoyen * 0.45 && dominante !== 'ping-pong') {
      lignes.push(`${rapport.nom} : la source « ${dominante} » représente environ ${nombre(poids)} GP en valeur absolue cumulée, pour un score moyen de ${nombre(scoreMoyen)}.`);
    }
  }
  for (const trophee of catalogueTrophees.trophees) {
    const taux = rapports.reduce((somme, rapport) => somme + (rapport.agregat.attribuables[trophee.id] ?? 0), 0) / (rapports.length * parties);
    if (taux < 0.08) {
      lignes.push(`« ${trophee.nom} » n'est attribuable que dans ${pourcent(taux)} des parties, tous scénarios confondus.`);
    }
  }
  if (lignes.length === 0) lignes.push('Aucun écart massif ne ressort des trois scénarios avec ces hypothèses.');
  lignes.push('Le joueur très faible reste rarement vainqueur quand tout le monde joue prudent ou moyen. Le style fort lui rend une chance, avec une variance et une cagnotte beaucoup plus grandes. Le joueur parfait ne gagne pas presque toutes les parties.');
  lignes.push('Pistes possibles, sans rien changer ici : resserrer l\'écart de départ du ping-pong, ou rendre Le touriste et Contre toutes attentes plus souvent attribuables, si le rattrapage doit peser davantage.');
  lignes.push('Aucune valeur de `config/` et aucune règle de jeu n\'ont été modifiées pour produire ce rapport.');
  return lignes;
}

function rapportScenario(nom: string, agregat: Agregat, parties: number, exemple: { graine: number; journal: string[] }): string[] {
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
    'Une victoire compte même en cas d\'ex aequo : les probabilités peuvent donc dépasser 100 % au total.',
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
    ...PROFILS.map((profil) => `| ${profil.pseudo} | ${nombre(moyenne(agregat.positions[profil.pseudo] ?? []))} |`),
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

function main(): void {
  const debut = Date.now();
  const rendus: string[] = [];
  const pourObservations: Array<{ nom: string; agregat: Agregat }> = [];
  try {
    for (const [index, scenario] of SCENARIOS.entries()) {
      const agregat = creerAgregat();
      for (let partie = 0; partie < PARTIES; partie += 1) {
        integrer(agregat, jouerPartie(scenario.id, grainePartie(index, partie), false));
      }
      const graineExemple = grainePartie(index, PARTIES);
      const exemple = jouerPartie(scenario.id, graineExemple, true);
      rendus.push(...rapportScenario(scenario.nom, agregat, PARTIES, { graine: graineExemple, journal: exemple.journal }));
      pourObservations.push({ nom: scenario.nom, agregat });
      console.log(`${scenario.nom} : ${PARTIES} parties`);
    }
  } finally {
    store.fermer();
    fs.rmSync(dossier, { recursive: true, force: true });
  }
  const duree = ((Date.now() - debut) / 1000).toFixed(1);
  const texte = [
    '# Simulation d\'équilibrage',
    '',
    `Graine maîtresse : ${GRAINE_MAITRESSE}. ${PARTIES} parties par scénario, plus une partie détaillée dont la graine est indiquée. Durée du calcul : ${duree} s.`,
    '',
    'Les quatre joueurs jouent chaque partie dans un ordre tiré au sort. Ils commencent avec les GP du tournoi de ping-pong : 3 GP par point marqué contre un joueur, 6 GP par point marqué contre l\'hôte, sur 4 matchs en 7 points.',
    '',
    '| Joueur | Profil | Points par match | GP de départ |',
    '| --- | --- | ---: | ---: |',
    ...PROFILS.map((profil) => `| ${profil.pseudo} | ${profil.pseudo === 'A' ? 'Très faible' : profil.pseudo === 'B' ? 'Moyen' : profil.pseudo === 'C' ? 'Bon' : 'Parfait'} | ${profil.points} | ${profil.gp} |`),
    '',
    '## Hypothèses',
    '',
    'Identiques pour les trois scénarios. Le simulateur appelle le vrai réducteur, les vrais tirages et `trophees(etat)`.',
    '',
    '- **Dé et roue.** Prudent : toujours le dé normal ; mise 0 à la roue dans 80 % des cas, 5 GP sinon. Moyen : dé normal 30 %, boosté 50 %, super dé 20 % ; mise d\'environ 15 % du solde visible, arrondie. Fort : toujours le super dé s\'il est abordable, sinon le dé boosté ; mise de 50 % du solde visible. Si une option n\'est pas abordable, le joueur prend la plus forte qu\'il peut se payer.',
    '- **Mini-jeu à chaque tour.** Parmi ceux de `config/mini-jeux.json` qui n\'ont pas encore été joués. Ensuite, au hasard parmi les mini-jeux physiques, qui peuvent donc revenir.',
    '- **Physiques.** Classement ou équipes tirés au hasard, puis la vraie fonction de score.',
    '- **Jeopardy.** 16 questions. Le choisisseur répond juste dans 70 % des cas. Sinon, un autre joueur tiré au hasard vole la question dans 50 % des cas.',
    '- **Top Ten.** L\'ordre du Cap\'Ten est le bon ordre, perturbé par 0, 1 ou 2 échanges entre voisins, équiprobables. Chaque numéro est deviné exactement avec une probabilité de 30 %.',
    '- **Undercover.** Les civils gagnent 70 % des manches. Un undercover éliminé devine le mot dans 30 % des cas.',
    '- **Poker.** 100 GP de jetons (4 × 20, plus les 20 de l\'hôte), redistribués par 40 transferts d\'un jeton, puis convertis par le vrai calcul.',
    '- **Apéro.** Une fois, le premier tour où un pion a atteint la moitié du plateau : entre 20 et 40 GP par joueur. S\'il n\'a pas eu lieu, il est donné juste avant la cérémonie.',
    '- **Missions secrètes.** Ignorées.',
    '- **Fin.** Dernier tour dès la première arrivée, puis cérémonie des trophées (`nombreCeremonie`).',
    '',
    ...rendus,
    '## Observations',
    '',
    ...observations(pourObservations, PARTIES).map((ligne) => `- ${ligne}`),
    '',
  ].join('\n');
  const cible = path.join(RACINE, 'docs', 'simulation-equilibrage.md');
  fs.writeFileSync(cible, texte, 'utf8');
  console.log(`Rapport ${cible}`);
  console.log(`Durée ${duree} s`);
}

main();
