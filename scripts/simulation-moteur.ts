/**
 * Moteur partagé de simulation d'équilibrage.
 * Utilisé par `simuler.ts` et `balayage-equilibrage.ts`.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { solde } from '../shared/soldes';
import { trophees } from '../shared/trophees';
import type { Devines } from '../shared/topten';
import { plusPetiteAnnonce, annonceLegale } from '../shared/perudo';
import type { Action, Course, EtatJeu, Origine } from '../shared/types';
import { lireCartesChance, lireCartesMalchance, lireCatalogueTrophees } from '../server/course-config';
import { lireCatalogue, lireJeopardy, lireUndercover, lireTopTen } from '../server/mini-jeux-config';
import { melanger } from '../server/plateau';
import { creerStore, type Store, type SurchargesSimulation } from '../server/store';

export const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const GRAINE_MAITRESSE = 20260926;
export const HOTE: Origine = { role: 'hote' };

const LETTRES_INDICE = 'abcdefghijklmnopqrstuvwxyz';

export type ProfilPingPong = {
  pseudo: string;
  avatar: string;
  points: number;
};

export const PROFILS_BASE: readonly ProfilPingPong[] = [
  { pseudo: 'A', avatar: 'perso-carpe', points: 1 },
  { pseudo: 'B', avatar: 'perso-verre-eau', points: 4 },
  { pseudo: 'C', avatar: 'perso-piment', points: 6 },
  { pseudo: 'D', avatar: 'perso-planete', points: 7 },
] as const;

export type ScenarioId = 'prudent' | 'moyen' | 'fort';

export const SCENARIOS: Array<{ id: ScenarioId; nom: string }> = [
  { id: 'prudent', nom: '1 — Prudent' },
  { id: 'moyen', nom: '2 — Moyen' },
  { id: 'fort', nom: '3 — Fort' },
];

export type ConfigPingPong = {
  gpParPoint: number;
  gpParPointContreHote: number;
};

export type Generateur = {
  entier: (max: number) => number;
  reel: () => number;
};

export type Origines = Record<string, number>;

export type PartieSimulee = {
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

export type Agregat = {
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

export type OptionsPartie = {
  /** Style de mise par défaut pour tous les joueurs. */
  scenario: ScenarioId;
  /** Surcharge du style de mise pour certains pseudos (ex. un seul joueur « fort »). */
  stylesParPseudo?: Partial<Record<string, ScenarioId>>;
  graine: number;
  detail?: boolean;
  pingpong?: ConfigPingPong;
  surcharges?: SurchargesSimulation;
};

export function creerGenerateur(graine: number): Generateur {
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

export function grainePartie(scenario: number, index: number, offset = 0): number {
  return (
    (Math.imul(GRAINE_MAITRESSE, 1009) ^
      Math.imul(scenario + 1, 9176) ^
      Math.imul(index + 1, 7919) ^
      Math.imul(offset + 1, 4243)) >>>
    0
  );
}

export function lirePingPong(racine = RACINE): ConfigPingPong {
  const fichier = path.join(racine, 'config', 'pingpong.json');
  try {
    const brut = JSON.parse(fs.readFileSync(fichier, 'utf8')) as Partial<ConfigPingPong>;
    const gpParPoint = typeof brut.gpParPoint === 'number' && brut.gpParPoint > 0 ? brut.gpParPoint : 3;
    const gpParPointContreHote =
      typeof brut.gpParPointContreHote === 'number' && brut.gpParPointContreHote > 0 ? brut.gpParPointContreHote : 6;
    return { gpParPoint, gpParPointContreHote };
  } catch {
    return { gpParPoint: 3, gpParPointContreHote: 6 };
  }
}

/** 3 matchs joueur + 1 match hôte : points × (3 × gpParPoint + gpParPointContreHote). */
export function gpPingPong(points: number, config: ConfigPingPong): number {
  return points * (3 * config.gpParPoint + config.gpParPointContreHote);
}

export function creerAgregat(pseudos: readonly string[] = PROFILS_BASE.map((p) => p.pseudo)): Agregat {
  const scores: Record<string, number[]> = {};
  const positions: Record<string, number[]> = {};
  const victoires: Record<string, number> = {};
  const origines: Record<string, Origines> = {};
  for (const pseudo of pseudos) {
    scores[pseudo] = [];
    positions[pseudo] = [];
    victoires[pseudo] = 0;
    origines[pseudo] = {};
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

export function ajouterOrigine(cible: Origines, cle: string, montant: number): void {
  cible[cle] = (cible[cle] ?? 0) + montant;
}

export function moyenne(valeurs: number[]): number {
  if (valeurs.length === 0) return 0;
  return valeurs.reduce((somme, valeur) => somme + valeur, 0) / valeurs.length;
}

export function ecartType(valeurs: number[]): number {
  if (valeurs.length < 2) return 0;
  const centre = moyenne(valeurs);
  const variance = valeurs.reduce((somme, valeur) => somme + (valeur - centre) ** 2, 0) / (valeurs.length - 1);
  return Math.sqrt(variance);
}

export function nombre(valeur: number, decimales = 1): string {
  return valeur.toLocaleString('fr-FR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
}

export function pourcent(valeur: number): string {
  return `${nombre(valeur * 100, 1)} %`;
}

const catalogueJeux = lireCatalogue(RACINE);
const catalogueTrophees = lireCatalogueTrophees(RACINE);
const configJeopardy = lireJeopardy(RACINE);
const configUndercover = lireUndercover(RACINE);
const configTopTen = lireTopTen(RACINE);
const titresChance = new Set(lireCartesChance(RACINE).map((carte) => carte.titre));
const titresMalchance = new Set(lireCartesMalchance(RACINE).map((carte) => carte.titre));

const TAUX_JEOPARDY = [0.85, 0.7, 0.55, 0.4];

type Session = {
  store: Store;
  dossier: string;
  gen: Generateur;
  cagnotteMaxPartie: number;
  /** Accélère Jeopardy (2 thèmes) pour le balayage. */
  leger: boolean;
};

function etat(session: Session): EtatJeu {
  return session.store.etat();
}

function course(session: Session): Course {
  const valeur = etat(session).course;
  if (!valeur) throw new Error('La course est absente');
  return valeur;
}

function soldeDe(session: Session, id: string): number {
  return solde(etat(session).transactions, id, 'visibles');
}

function pseudoDe(session: Session, id: string): string {
  return etat(session).joueurs.find((joueur) => joueur.id === id)?.pseudo ?? id;
}

function agir(session: Session, action: Action, origine: Origine = HOTE): void {
  const reponse = session.store.dispatch(action, origine);
  if (!reponse.ok) {
    const actuelle = etat(session).course;
    throw new Error(
      `${action.type} refusé (${actuelle?.phase ?? 'sans course'} / ${actuelle?.etape?.genre ?? '-'} / ${actuelle?.ceremonie?.etape ?? '-'}) : ${reponse.erreur}`,
    );
  }
  const cagnotte = etat(session).course?.cagnotte ?? 0;
  if (cagnotte > session.cagnotteMaxPartie) session.cagnotteMaxPartie = cagnotte;
}

function miseOption(session: Session, id: string): number {
  return course(session).regles.optionsDe.find((option) => option.id === id)?.mise ?? 0;
}

function optionDe(session: Session, scenario: ScenarioId, disponible: number): string {
  const actuelle = course(session);
  if (actuelle.coupDePouceActif) {
    if (actuelle.regles.coupDePouce === 'de8') return 'super';
    if (actuelle.regles.coupDePouce === 'de7') return 'booste';
  }
  const coutBooste = miseOption(session, 'booste');
  const coutSuper = miseOption(session, 'super');
  const plusForte = disponible >= coutSuper ? 'super' : disponible >= coutBooste ? 'booste' : 'normal';
  if (scenario === 'prudent') return 'normal';
  if (scenario === 'fort') return plusForte;
  const tirage = session.gen.reel();
  const voulu = tirage < 0.3 ? 'normal' : tirage < 0.8 ? 'booste' : 'super';
  const mise = voulu === 'super' ? coutSuper : voulu === 'booste' ? coutBooste : 0;
  if (mise <= disponible) return voulu;
  return plusForte;
}

function miseRoue(session: Session, scenario: ScenarioId, disponible: number): number {
  if (disponible <= 0) return 0;
  if (scenario === 'prudent') return session.gen.reel() < 0.8 ? 0 : Math.min(5, disponible);
  if (scenario === 'moyen') return Math.min(disponible, Math.round(disponible * 0.15));
  return Math.min(disponible, Math.round(disponible * 0.5));
}

function jouerJeopardy(session: Session, maxThemes = configJeopardy.themes.length): void {
  const themes = Math.min(maxThemes, configJeopardy.themes.length);
  for (let theme = 0; theme < themes; theme += 1) {
    for (let niveau = 0; niveau < configJeopardy.valeurs.length; niveau += 1) {
      const choisisseur = course(session).jeopardy?.choisisseurId;
      if (!choisisseur) throw new Error('Jeopardy sans choisisseur');
      agir(session, { type: 'choisirCaseJeopardy', theme, niveau });
      const taux = TAUX_JEOPARDY[niveau] ?? 0.4;
      if (session.gen.reel() < taux) {
        agir(session, { type: 'jugerJeopardy', juste: true });
        continue;
      }
      agir(session, { type: 'jugerJeopardy', juste: false });
      const autres = course(session).ordre.filter((id) => id !== choisisseur);
      if (session.gen.reel() < 0.5 && autres.length > 0) {
        const voleur = autres[session.gen.entier(autres.length)];
        if (!voleur) throw new Error('Voleur absent');
        agir(session, { type: 'buzzJeopardy' }, { role: 'joueur', joueurId: voleur });
        agir(session, { type: 'jugerJeopardy', juste: true });
      } else if (course(session).jeopardy?.question) {
        agir(session, { type: 'personneJeopardy' });
      }
    }
  }
  if (themes < configJeopardy.themes.length && course(session).phase === 'miniJeu') {
    agir(session, { type: 'terminerJeopardy' });
  }
}

function jouerTopTen(session: Session): void {
  const total = course(session).topten?.captens.length ?? 0;
  for (let manche = 0; manche < total; manche += 1) {
    agir(session, { type: 'lancerMancheTopTen' });
    const courante = course(session).topten?.manches.at(-1);
    if (!courante) throw new Error('Manche de Top Ten absente');
    const ordre = [...courante.repondants].sort((a, b) => (courante.numeros[a] ?? 0) - (courante.numeros[b] ?? 0));
    const echanges = session.gen.entier(3);
    for (let index = 0; index < echanges; index += 1) {
      const place = session.gen.entier(Math.max(1, ordre.length - 1));
      const gauche = ordre[place];
      const droite = ordre[place + 1];
      if (!gauche || !droite) continue;
      ordre[place] = droite;
      ordre[place + 1] = gauche;
    }
    const devines: Devines = {};
    for (const id of courante.repondants) {
      devines[id] = session.gen.reel() < 0.3 ? (courante.numeros[id] ?? null) : null;
    }
    agir(session, { type: 'validerOrdreTopTen', ordre, devines });
  }
  agir(session, { type: 'recapTopTen' });
}

function jouerUndercover(session: Session): void {
  for (let manche = 0; manche < configUndercover.manches; manche += 1) {
    agir(session, { type: 'lancerMancheUndercover' });
    const courante = course(session).undercover?.manches.at(-1);
    if (!courante) throw new Error("Manche d'Undercover absente");
    const civils = courante.ordreParole.filter((id) => id !== courante.undercoverId);
    if (session.gen.reel() < 0.7) {
      agir(session, { type: 'eliminerUndercover', joueurId: courante.undercoverId });
      agir(session, { type: 'devinerUndercover', trouve: session.gen.reel() < 0.3 });
    } else {
      const premier = civils[0];
      const second = civils[1];
      if (!premier || !second) throw new Error('Pas assez de civils');
      agir(session, { type: 'eliminerUndercover', joueurId: premier });
      agir(session, { type: 'eliminerUndercover', joueurId: second });
    }
  }
  agir(session, { type: 'recapUndercover' });
}

function terminerMancheCodenames(session: Session, indexManche: number): void {
  const manche = course(session).codenames?.manches.at(-1);
  if (!manche) throw new Error('Manche de Codenames absente');
  const espionId = manche.espions[manche.equipeCourante];
  if (!espionId) throw new Error('Espion absent');
  const lettre = LETTRES_INDICE[indexManche % LETTRES_INDICE.length] ?? 'a';
  const gagne = session.gen.reel() < 0.5;
  if (gagne) {
    const equipe = manche.equipeCourante;
    const cibles = manche.cartes
      .map((carte, index) => ({ carte, index }))
      .filter(({ carte }) => carte.couleur === equipe && !carte.revelee);
    agir(
      session,
      { type: 'proposerIndiceCodenames', mot: `Zzz${lettre}`, nombre: Math.max(1, cibles.length) },
      { role: 'joueur', joueurId: espionId },
    );
    agir(session, { type: 'validerIndiceCodenames' });
    for (const { index } of cibles) {
      if (course(session).codenames?.manches.at(-1)?.etape === 'finie') break;
      agir(session, { type: 'retournerMotCodenames', index });
    }
  } else {
    const assassin = manche.cartes.findIndex((carte) => carte.couleur === 'assassin' && !carte.revelee);
    if (assassin < 0) throw new Error('Assassin introuvable');
    agir(
      session,
      { type: 'proposerIndiceCodenames', mot: `Zzz${lettre}`, nombre: 1 },
      { role: 'joueur', joueurId: espionId },
    );
    agir(session, { type: 'validerIndiceCodenames' });
    agir(session, { type: 'retournerMotCodenames', index: assassin });
  }
}

function jouerCodenames(session: Session): void {
  agir(session, { type: 'equipesHasardCodenames' });
  const preparation = course(session).codenames?.preparation;
  if (!preparation) throw new Error('Préparation Codenames absente');
  for (const equipe of ['rouge', 'bleu'] as const) {
    const premier = preparation.equipes[equipe][0];
    if (!premier) throw new Error(`Équipe ${equipe} incomplète`);
    agir(session, { type: 'designerEspionCodenames', equipe, joueurId: premier });
  }
  const nbManches = course(session).codenames?.nbManches ?? 2;
  for (let index = 0; index < nbManches; index += 1) {
    agir(session, { type: 'lancerGrilleCodenames' });
    terminerMancheCodenames(session, index);
  }
}

function lancerTousPerudo(session: Session): void {
  for (const joueur of course(session).perudo?.joueurs ?? []) {
    if (joueur.desRestants > 0 && !joueur.aLance) {
      agir(session, { type: 'lancerDesPerudo', joueurId: joueur.id });
    }
  }
}

function courantPerudo(session: Session): string | null {
  const jeu = course(session).perudo;
  if (!jeu) return null;
  const joueur = jeu.joueurs[jeu.indexCourant];
  if (!joueur || joueur.desRestants <= 0) return null;
  return joueur.id;
}

function annonceImpossiblePerudo(session: Session): { nombre: number; valeur: number } {
  const jeu = course(session).perudo;
  if (!jeu) throw new Error('Perudo absent');
  const totalDes = jeu.joueurs.reduce((somme, joueur) => somme + joueur.desRestants, 0);
  const precedente = jeu.annonce;
  for (let nombre = totalDes + 3; nombre <= totalDes + 40; nombre += 1) {
    for (const valeur of [6, 5, 4, 3, 2, 1]) {
      const candidate = { nombre, valeur };
      if (annonceLegale(precedente, candidate)) return candidate;
    }
  }
  const secours = plusPetiteAnnonce(precedente);
  if (!secours) throw new Error('Aucune annonce Perudo possible');
  return { nombre: secours.nombre + totalDes + 5, valeur: 6 };
}

function jouerPerudo(session: Session): void {
  const ids = (course(session).perudo?.joueurs ?? []).map((joueur) => joueur.id);
  const classementVoulu = melanger([...ids], (max) => session.gen.entier(max));
  /** Premier éliminé en tête : l'inverse du classement final sans le survivant. */
  const fileElim = [...classementVoulu].reverse().slice(0, -1);
  lancerTousPerudo(session);
  let garde = 0;
  let indexElim = 0;
  while (course(session).perudo?.etape !== 'terminee' && garde < 240) {
    garde += 1;
    const jeu = course(session).perudo;
    if (!jeu) throw new Error('Perudo absent');
    if (jeu.etape === 'revelation') {
      agir(session, { type: 'mancheSuivantePerudo' });
      lancerTousPerudo(session);
      continue;
    }
    while (indexElim < fileElim.length) {
      const candidat = fileElim[indexElim];
      const reste = jeu.joueurs.find((joueur) => joueur.id === candidat)?.desRestants ?? 0;
      if (reste > 0) break;
      indexElim += 1;
    }
    const cible = fileElim[indexElim];
    if (!cible || jeu.etape !== 'encheres') break;

    let tours = 0;
    while (courantPerudo(session) !== cible && tours < 16) {
      tours += 1;
      const petite = plusPetiteAnnonce(course(session).perudo?.annonce ?? null);
      if (!petite) throw new Error('Aucune annonce légale pour tourner');
      agir(session, { type: 'annoncerPerudo', nombre: petite.nombre, valeur: petite.valeur });
    }

    if (courantPerudo(session) !== cible) {
      // Dernier recours : faire perdre un dé au joueur courant pour débloquer
      const impossible = annonceImpossiblePerudo(session);
      agir(session, { type: 'annoncerPerudo', nombre: impossible.nombre, valeur: impossible.valeur });
      agir(session, { type: 'dudoPerudo' });
      continue;
    }

    const impossible = annonceImpossiblePerudo(session);
    agir(session, { type: 'annoncerPerudo', nombre: impossible.nombre, valeur: impossible.valeur });
    agir(session, { type: 'dudoPerudo' });
  }
  if (course(session).perudo?.etape !== 'terminee') throw new Error('Perudo bloqué');
}

function motIndice(index: number): string {
  const lettre = LETTRES_INDICE[index % LETTRES_INDICE.length] ?? 'a';
  const tour = Math.floor(index / LETTRES_INDICE.length);
  return tour === 0 ? `Zzz${lettre}` : `Zzz${lettre}${LETTRES_INDICE[tour] ?? 'z'}`;
}

function jouerJustOne(session: Session): void {
  let garde = 0;
  let compteurMot = 0;
  while (
    (course(session).justone?.indexDevineur ?? 0) < (course(session).justone?.ordreDevineurs.length ?? 0) &&
    garde < 40
  ) {
    garde += 1;
    agir(session, { type: 'lancerMancheJustOne' });
    const manche = course(session).justone?.manches.at(-1);
    if (!manche) throw new Error('Manche Just One absente');
    const indiceurs = course(session).ordre.filter((joueurId) => joueurId !== manche.devineurId);
    const bases = indiceurs.map(() => {
      const mot = motIndice(compteurMot);
      compteurMot += 1;
      return mot;
    });
    const mots = bases.map((mot, index) => {
      if (session.gen.reel() >= 0.15 || bases.length < 2) return mot;
      let autre = session.gen.entier(bases.length);
      if (autre === index) autre = (autre + 1) % bases.length;
      return bases[autre] ?? mot;
    });
    indiceurs.forEach((id, index) => {
      const mot = mots[index] ?? motIndice(compteurMot++);
      agir(session, { type: 'proposerIndiceJustOne', mot }, { role: 'joueur', joueurId: id });
    });
    if (manche.devineurId !== 'hote') {
      let motHote = motIndice(compteurMot++);
      if (session.gen.reel() < 0.15 && mots.length > 0) {
        motHote = mots[session.gen.entier(mots.length)] ?? motHote;
      }
      agir(session, { type: 'proposerIndiceJustOne', mot: motHote });
    }
    agir(session, { type: 'revelerIndicesJustOne' });
    const issue = session.gen.reel() < 0.6 ? 'trouve' : session.gen.reel() < 0.5 ? 'passe' : 'rate';
    agir(session, { type: 'jugerJustOne', issue });
  }
  agir(session, { type: 'recapJustOne' });
}

function jouerPoker(session: Session): void {
  const ids = etat(session).joueurs.map((joueur) => joueur.id);
  const piles = [...ids.map(() => 20), 20];
  for (let transfert = 0; transfert < 40; transfert += 1) {
    const depuis = session.gen.entier(piles.length);
    const vers = session.gen.entier(piles.length);
    if (depuis === vers || (piles[depuis] ?? 0) <= 0) continue;
    piles[depuis] = (piles[depuis] ?? 0) - 1;
    piles[vers] = (piles[vers] ?? 0) + 1;
  }
  const tapis: Record<string, number> = {};
  ids.forEach((id, index) => {
    tapis[id] = piles[index] ?? 0;
  });
  agir(session, { type: 'validerPoker', tapis, tapisHote: piles[piles.length - 1] ?? 0 });
}

function miniJeuEncoreJouable(session: Session, module: string): boolean {
  const actuelle = course(session);
  if (module === 'topten') {
    const joues = actuelle.topten?.themesJoues.length ?? 0;
    return configTopTen.themes.length - joues >= etat(session).joueurs.length;
  }
  if (module === 'undercover') {
    const jouees = actuelle.undercover?.pairesJouees.length ?? 0;
    return configUndercover.paires.length - jouees >= configUndercover.manches;
  }
  return true;
}

function jouerMiniJeu(session: Session): void {
  const joues = new Set(course(session).joues);
  const digitaux = catalogueJeux.jeux.filter((jeu) => jeu.module !== 'aucun');
  const restants = digitaux.filter((jeu) => !joues.has(jeu.id) && miniJeuEncoreJouable(session, jeu.module));
  const tousJouables = digitaux.filter((jeu) => miniJeuEncoreJouable(session, jeu.module));
  const pool = restants.length > 0 ? restants : tousJouables.length > 0 ? tousJouables : digitaux;
  const jeu = pool[session.gen.entier(pool.length)];
  if (!jeu) throw new Error('Aucun mini-jeu');
  agir(session, { type: 'choisirMiniJeu', id: jeu.id });
  if (jeu.module === 'jeopardy') jouerJeopardy(session, session.leger ? 2 : configJeopardy.themes.length);
  else if (jeu.module === 'topten') jouerTopTen(session);
  else if (jeu.module === 'undercover') jouerUndercover(session);
  else if (jeu.module === 'poker') jouerPoker(session);
  else if (jeu.module === 'codenames') jouerCodenames(session);
  else if (jeu.module === 'perudo') jouerPerudo(session);
  else if (jeu.module === 'justone') jouerJustOne(session);
  else throw new Error(`Module inconnu : ${jeu.module}`);
  if (course(session).phase === 'miniJeu') agir(session, { type: 'passerAuxDeplacements' });
}

function styleJoueur(options: OptionsPartie, pseudo: string): ScenarioId {
  return options.stylesParPseudo?.[pseudo] ?? options.scenario;
}

function jouerDeplacements(session: Session, options: OptionsPartie): void {
  let garde = 0;
  while (course(session).phase === 'deplacements') {
    if (++garde > 40) throw new Error('Déplacements bloqués');
    const actuelle = course(session);
    const id = actuelle.ordre[actuelle.indexCourant];
    if (!id || !actuelle.etape) throw new Error('Tour de déplacement bloqué');
    const style = styleJoueur(options, pseudoDe(session, id));
    const origine: Origine = { role: 'joueur', joueurId: id };
    if (actuelle.etape.genre === 'lancer') {
      agir(session, { type: 'lancerDe', option: optionDe(session, style, soldeDe(session, id)) }, origine);
    } else {
      agir(session, { type: 'miserRoue', montant: miseRoue(session, style, soldeDe(session, id)) }, origine);
    }
  }
}

function ligneTour(session: Session, tour: number): string {
  const actuelle = course(session);
  const positions = etat(session).joueurs.map(
    (joueur) => `${joueur.pseudo} case ${actuelle.positions[joueur.id] ?? 0} · ${soldeDe(session, joueur.id)} GP`,
  );
  const marques = actuelle.historique.effets
    .filter((effet) => effet.tour === tour && effet.type !== 'de')
    .map((effet) => {
      const detail = effet.roue ? ` ${effet.roue.option}` : '';
      const cases = effet.cases ? ` ${effet.cases > 0 ? '+' : ''}${effet.cases}` : '';
      return `${pseudoDe(session, effet.joueurId)} ${effet.type}${cases}${detail}`;
    });
  return `Tour ${tour} — ${positions.join(' ; ')}${marques.length > 0 ? ` — ${marques.join(', ')}` : ''}`;
}

export function classerOrigine(transaction: { source: string; libelle: string }): string {
  if (transaction.source === 'ping-pong') return 'ping-pong';
  if (transaction.source === 'poker') return 'poker';
  if (transaction.source === 'trophee') return 'trophées';
  if (transaction.source === 'arrivee') return 'arrivée';
  if (transaction.source === 'cagnotte-consolation') return 'cagnotte consolation';
  if (transaction.source === 'mise') return 'mises au dé';
  if (transaction.source === 'roue') return 'roue (nette)';
  if (transaction.source === 'mini-jeu') return `mini-jeu : ${transaction.libelle}`;
  if (transaction.source === 'plateau' && transaction.libelle === 'Case bonus') return 'bonus';
  if (transaction.source === 'plateau' && transaction.libelle === 'Cagnotte') return 'cagnotte';
  if (transaction.source === 'carte' && titresChance.has(transaction.libelle)) return 'chance';
  if (transaction.source === 'carte' && titresMalchance.has(transaction.libelle)) return 'malchance';
  return `autre (${transaction.source})`;
}

function deroulerCeremonie(session: Session): void {
  agir(session, { type: 'ouvrirPodium' });
  const ceremonie = course(session).ceremonie;
  if (ceremonie?.etape === 'cagnotte') {
    agir(session, { type: 'verserCagnotteConsolation' });
  }
  agir(session, { type: 'tirerTrophees' });
  while ((course(session).ceremonie?.reveles ?? 0) < (course(session).ceremonie?.tirage.length ?? 0)) {
    agir(session, { type: 'revelerTrophee' });
  }
  agir(session, { type: 'revelerClassement' });
  agir(session, { type: 'revelerGagnant' });
}

export function creerSession(surcharges?: SurchargesSimulation, leger = false): Session {
  const dossier = path.join(os.tmpdir(), `gp-sim-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  fs.mkdirSync(dossier, { recursive: true });
  const session: Session = {
    store: null as unknown as Store,
    dossier,
    gen: creerGenerateur(GRAINE_MAITRESSE),
    cagnotteMaxPartie: 0,
    leger,
  };
  session.store = creerStore({
    dossierData: dossier,
    titre: 'Simulation',
    nbJoueursMax: 4,
    dev: true,
    sauvegardesAuto: false,
    simulation: true,
    ...(leger
      ? { perudoDesSimulation: 1, justoneCyclesSimulation: 1 }
      : {}),
    alea: (max) => session.gen.entier(max),
    surcharges,
  });
  return session;
}

export function fermerSession(session: Session): void {
  session.store.fermer();
  fs.rmSync(session.dossier, { recursive: true, force: true });
}

export function jouerPartieSurSession(session: Session, options: OptionsPartie): PartieSimulee {
  const { graine, detail = false } = options;
  const pingpong = options.pingpong ?? lirePingPong();
  session.gen = creerGenerateur(graine);
  session.cagnotteMaxPartie = 0;
  agir(session, { type: 'reinitialiserPartie' });
  for (const profil of PROFILS_BASE) {
    agir(session, { type: 'rejoindre', pseudo: profil.pseudo, avatar: profil.avatar }, { role: 'joueur', joueurId: null });
  }
  for (const joueur of etat(session).joueurs) {
    const profil = PROFILS_BASE.find((candidat) => candidat.pseudo === joueur.pseudo);
    const montant = gpPingPong(profil?.points ?? 0, pingpong);
    agir(session, {
      type: 'ajouterGP',
      joueurId: joueur.id,
      montant,
      libelle: 'Ping-pong',
      source: 'ping-pong',
    });
  }
  agir(session, { type: 'demarrerCourse' });
  const journal: string[] = [];
  let securite = 0;
  while (course(session).phase !== 'terminee') {
    if (++securite > 80) {
      agir(session, { type: 'terminerCourse' });
      break;
    }
    const phase = course(session).phase;
    if (phase === 'preparation' || phase === 'finTour') {
      agir(session, { type: 'nouveauTour' });
      continue;
    }
    if (phase === 'choixMiniJeu') {
      jouerMiniJeu(session);
      continue;
    }
    if (phase === 'deplacements') {
      const tour = course(session).tour;
      jouerDeplacements(session, options);
      if (detail) journal.push(ligneTour(session, tour));
      continue;
    }
    throw new Error(`Phase inattendue : ${phase}`);
  }
  const avant = trophees(etat(session), catalogueTrophees.trophees);
  deroulerCeremonie(session);
  const tirage = course(session).ceremonie?.tirage ?? [];

  const scores: Record<string, number> = {};
  const positions: Record<string, number> = {};
  const origines: Record<string, Origines> = {};
  let misesDe = 0;
  let misesRoue = 0;
  for (const joueur of etat(session).joueurs) {
    scores[joueur.pseudo] = soldeDe(session, joueur.id);
    positions[joueur.pseudo] = course(session).positions[joueur.id] ?? 0;
    const lignes: Origines = {};
    for (const transaction of etat(session).transactions) {
      if (transaction.joueurId !== joueur.id) continue;
      ajouterOrigine(lignes, classerOrigine(transaction), transaction.montant);
      if (transaction.source === 'mise') misesDe += -transaction.montant;
      if (transaction.source === 'roue' && transaction.montant < 0) misesRoue += -transaction.montant;
    }
    origines[joueur.pseudo] = lignes;
  }
  const valeurs = PROFILS_BASE.map((profil) => scores[profil.pseudo] ?? 0);
  const meilleur = Math.max(...valeurs);
  const victoires = PROFILS_BASE.filter((profil) => (scores[profil.pseudo] ?? 0) === meilleur).map((profil) => profil.pseudo);
  const tries = [...valeurs].sort((a, b) => b - a);
  return {
    tours: course(session).tour,
    scores,
    positions,
    ecart: (tries[0] ?? 0) - (tries[1] ?? 0),
    victoires,
    exAequo: victoires.length > 1,
    arriveesMultiples: course(session).arrivees.length >= 2,
    origines,
    misesDe,
    misesRoue,
    cagnotteMax: session.cagnotteMaxPartie,
    cagnotteFin: course(session).cagnotte,
    jackpots: course(session).historique.effets.filter((effet) => effet.roue?.option === 'jackpot').length,
    attribuables: avant.filter((trophee) => trophee.attribuable).map((trophee) => trophee.id),
    tires: tirage.map((trophee) => ({
      id: trophee.id,
      gagnants: trophee.gagnants.map((id) => pseudoDe(session, id)),
    })),
    journal,
  };
}

/** Une partie autonome (store créé et détruit). Pour le balayage avec surcharges. */
export function jouerPartie(options: OptionsPartie): PartieSimulee {
  const session = creerSession(options.surcharges, false);
  try {
    return jouerPartieSurSession(session, options);
  } finally {
    fermerSession(session);
  }
}

export function integrer(agregat: Agregat, partie: PartieSimulee): void {
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
  for (const profil of PROFILS_BASE) {
    agregat.scores[profil.pseudo]?.push(partie.scores[profil.pseudo] ?? 0);
    agregat.positions[profil.pseudo]?.push(partie.positions[profil.pseudo] ?? 0);
    if (partie.victoires.includes(profil.pseudo)) {
      agregat.victoires[profil.pseudo] = (agregat.victoires[profil.pseudo] ?? 0) + 1;
    }
    const lignes = agregat.origines[profil.pseudo];
    if (!lignes) continue;
    for (const [cle, montant] of Object.entries(partie.origines[profil.pseudo] ?? {})) {
      ajouterOrigine(lignes, cle, montant);
    }
  }
  for (const id of partie.attribuables) agregat.attribuables[id] = (agregat.attribuables[id] ?? 0) + 1;
  for (const trophee of partie.tires) {
    agregat.tires[trophee.id] = (agregat.tires[trophee.id] ?? 0) + 1;
    const gagnants = (agregat.gagnants[trophee.id] ??= {});
    for (const pseudo of trophee.gagnants) gagnants[pseudo] = (gagnants[pseudo] ?? 0) + 1;
  }
}

export function clesOrigine(agregat: Agregat): string[] {
  const cles = new Set<string>();
  for (const lignes of Object.values(agregat.origines)) {
    for (const cle of Object.keys(lignes)) cles.add(cle);
  }
  const ordre = [
    'ping-pong',
    'bonus',
    'chance',
    'malchance',
    'cagnotte',
    'roue (nette)',
    'mises au dé',
    'arrivée',
    'cagnotte consolation',
    'poker',
    'trophées',
  ];
  const mini = [...cles].filter((cle) => cle.startsWith('mini-jeu')).sort((a, b) => a.localeCompare(b, 'fr'));
  const autres = [...cles].filter((cle) => !ordre.includes(cle) && !cle.startsWith('mini-jeu')).sort((a, b) => a.localeCompare(b, 'fr'));
  return [...ordre.filter((cle) => cles.has(cle)), ...mini, ...autres];
}

export function tableauScores(agregat: Agregat): string {
  const lignes = ['| Joueur | Moyenne | Écart-type | Minimum | Maximum |', '| --- | ---: | ---: | ---: | ---: |'];
  for (const profil of PROFILS_BASE) {
    const valeurs = agregat.scores[profil.pseudo] ?? [];
    lignes.push(
      `| ${profil.pseudo} | ${nombre(moyenne(valeurs))} | ${nombre(ecartType(valeurs))} | ${nombre(Math.min(...valeurs), 0)} | ${nombre(Math.max(...valeurs), 0)} |`,
    );
  }
  return lignes.join('\n');
}

export function tableauVictoires(agregat: Agregat, parties: number): string {
  const lignes = ['| Joueur | Victoires |', '| --- | ---: |'];
  for (const profil of PROFILS_BASE) {
    lignes.push(`| ${profil.pseudo} | ${pourcent((agregat.victoires[profil.pseudo] ?? 0) / parties)} |`);
  }
  lignes.push(`| Ex aequo | ${pourcent(agregat.exAequo / parties)} |`);
  return lignes.join('\n');
}

export function tableauOrigines(agregat: Agregat, parties: number): string {
  const cles = clesOrigine(agregat);
  const entete = `| Source | ${PROFILS_BASE.map((profil) => profil.pseudo).join(' | ')} |`;
  const sep = `| --- | ${PROFILS_BASE.map(() => '---:').join(' | ')} |`;
  const lignes = [entete, sep];
  for (const cle of cles) {
    const cellules = PROFILS_BASE.map((profil) => nombre((agregat.origines[profil.pseudo]?.[cle] ?? 0) / parties));
    lignes.push(`| ${cle} | ${cellules.join(' | ')} |`);
  }
  return lignes.join('\n');
}

export function tableauTrophees(agregat: Agregat, parties: number): string {
  const lignes = ['| Trophée | Attribuable | Tiré | A | B | C | D |', '| --- | ---: | ---: | ---: | ---: | ---: | ---: |'];
  for (const trophee of catalogueTrophees.trophees) {
    const gagnants = agregat.gagnants[trophee.id] ?? {};
    lignes.push(
      `| ${trophee.nom} | ${pourcent((agregat.attribuables[trophee.id] ?? 0) / parties)} | ${pourcent((agregat.tires[trophee.id] ?? 0) / parties)} | ${pourcent((gagnants.A ?? 0) / parties)} | ${pourcent((gagnants.B ?? 0) / parties)} | ${pourcent((gagnants.C ?? 0) / parties)} | ${pourcent((gagnants.D ?? 0) / parties)} |`,
    );
  }
  return lignes.join('\n');
}

export { catalogueTrophees };
