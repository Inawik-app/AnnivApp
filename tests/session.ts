import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { io, type Socket } from 'socket.io-client';
import { solde } from '../shared/soldes';
import type { ConfigJeopardy } from '../shared/jeopardy';
import type {
  Action,
  EtatJeu,
  MancheCodenames,
  MancheJustOne,
  MancheUndercover,
  PerudoCourse,
  ReponseAction,
  TypeCase,
  VueClient,
} from '../shared/types';
import { demarrerServeur, type ConfigTest, type ServeurJeu } from '../server/demarrer';

export const CODE_HOTE = 'change-moi';

export const DISPOSITION: TypeCase[] = [
  'depart',
  'bonus',
  'chance',
  'bonus',
  'malchance',
  'bonus',
  'cagnotte',
  'bonus',
  'gamble',
  ...Array.from({ length: 6 }, () => 'bonus' as const),
  'gamble',
  ...Array.from({ length: 22 }, () => 'bonus' as const),
  'arrivee',
];

export type Participant = {
  socket: Socket;
  vue: VueClient | null;
  joueurId: string;
  jeton: string;
  pseudo: string;
};

export type Session = {
  serveur: ServeurJeu;
  dossier: string;
  hote: Participant;
  tv: Participant;
  joueurs: Participant[];
};

function portLibre(): Promise<number> {
  return new Promise((resolve, reject) => {
    const serveur = net.createServer();
    serveur.once('error', reject);
    serveur.listen(0, '127.0.0.1', () => {
      const adresse = serveur.address();
      const port = typeof adresse === 'object' && adresse ? adresse.port : 0;
      serveur.close(() => resolve(port));
    });
  });
}

// 3000 est réservé à la vraie partie ; les autres sont refusés par Chromium (net::ERR_UNSAFE_PORT).
const PORTS_REFUSES = new Set([
  1719, 1720, 1723, 2049, 3000, 3659, 4045, 4190, 5060, 5061, 6000, 6566,
  6665, 6666, 6667, 6668, 6669, 6679, 6697, 10080,
]);

export async function portDisponible(): Promise<number> {
  for (let essai = 0; essai < 10; essai += 1) {
    const port = await portLibre();
    if (port > 0 && !PORTS_REFUSES.has(port)) return port;
  }
  throw new Error('Aucun port libre en dehors de 3000');
}

function creerDossier(): string {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'gp-party-'));
  const interdit = path.resolve('data');
  if (path.resolve(dossier).startsWith(interdit)) throw new Error('Le dossier de test touche data/');
  return dossier;
}

export async function ouvrirServeur(config: ConfigTest, servirClient = false): Promise<{ serveur: ServeurJeu; dossier: string }> {
  const dossier = creerDossier();
  const port = await portDisponible();
  const serveur = await demarrerServeur({ port, dossierData: dossier, config, servirClient });
  return { serveur, dossier };
}

export async function fermerSession(session: { serveur: ServeurJeu; dossier: string; sockets?: Socket[] }): Promise<void> {
  for (const socket of session.sockets ?? []) socket.close();
  try {
    await session.serveur.fermer();
  } finally {
    fs.rmSync(session.dossier, { recursive: true, force: true });
  }
}

function attendreConnexion(socket: Socket): Promise<void> {
  return new Promise((resolve, reject) => {
    if (socket.connected) {
      resolve();
      return;
    }
    const erreur = (cause: Error) => {
      socket.off('connect', ok);
      reject(cause);
    };
    const ok = () => {
      socket.off('connect_error', erreur);
      resolve();
    };
    socket.once('connect', ok);
    socket.once('connect_error', erreur);
  });
}

export async function connecter(
  url: string,
  role: 'hote' | 'tv' | 'joueur',
  options?: { codeHote?: string; jeton?: string },
): Promise<Participant> {
  const socket = io(url, { transports: ['websocket'], forceNew: true, reconnection: false });
  const participant: Participant = { socket, vue: null, joueurId: '', jeton: options?.jeton ?? '', pseudo: role };
  socket.on('vue', (vue: VueClient) => {
    participant.vue = vue;
  });
  await attendreConnexion(socket);
  const bonjour = await socket.timeout(4000).emitWithAck('bonjour', {
    role,
    ...(options?.codeHote ? { codeHote: options.codeHote } : {}),
    ...(options?.jeton ? { jeton: options.jeton } : {}),
  });
  if (!bonjour.ok) throw new Error(bonjour.erreur);
  await attendreVue(participant, () => participant.vue !== null);
  return participant;
}

export async function attendreVue(participant: Participant, predicat: () => boolean, delai = 4000): Promise<void> {
  const debut = Date.now();
  while (!predicat()) {
    if (Date.now() - debut > delai) throw new Error(`Vue en retard pour ${participant.pseudo}`);
    await new Promise((resoudre) => setTimeout(resoudre, 10));
  }
}

export async function agir(participant: Participant, action: Action): Promise<ReponseAction> {
  const version = participant.vue?.version ?? 0;
  const reponse = (await participant.socket.timeout(4000).emitWithAck('action', action)) as ReponseAction;
  if (!reponse.ok) return reponse;
  await attendreVue(participant, () => (participant.vue?.version ?? 0) > version);
  return reponse;
}

export function verifierInvariants(etat: EtatJeu): void {
  for (const joueur of etat.joueurs) {
    const visible = solde(etat.transactions, joueur.id, 'visibles');
    if (visible < 0) throw new Error(`Solde négatif pour ${joueur.pseudo} : ${visible}`);
  }
  for (const transaction of etat.transactions) {
    if (
      transaction.montant < 0 &&
      transaction.source !== 'mise' &&
      transaction.source !== 'roue' &&
      transaction.source !== 'carte' &&
      transaction.source !== 'manuel' &&
      transaction.source !== 'penalite'
    ) {
      throw new Error(`Transaction négative interdite (${transaction.source}) pour ${transaction.joueurId}`);
    }
  }
  const course = etat.course;
  if (!course) return;
  if (course.cagnotte < 0) throw new Error(`Cagnotte négative : ${course.cagnotte}`);
  for (const joueur of etat.joueurs) {
    const position = course.positions[joueur.id] ?? 0;
    if (position < 0 || position > 38) throw new Error(`Position hors plateau pour ${joueur.pseudo} : ${position}`);
    if (position > course.regles.longueur) throw new Error(`Position au-delà de l'arrivée pour ${joueur.pseudo}`);
  }
}

export function fuitesMises(vue: VueClient): string[] {
  if (contientCle(vue, 'pioche') || contientCle(vue, 'defausse') || contientCle(vue, 'pioches') || contientCle(vue, 'defausses')) {
    return ['pioche'];
  }
  return [];
}

/**
 * Avant la révélation, une page ne voit que son propre numéro (`repondant`), aucun autre,
 * où qu'il soit caché dans le message.
 */
export function fuitesTopTen(vue: VueClient, repondant: string | null, numeros: Record<string, number>): string[] {
  const courante = vue.course?.topten?.courante;
  if (!courante || courante.etape !== 'reponses') return [];
  const fuites: string[] = [];
  const attendu = repondant ? (numeros[repondant] ?? null) : null;
  const parcourir = (valeur: unknown, chemin: string) => {
    if (Array.isArray(valeur)) {
      valeur.forEach((item, index) => parcourir(item, `${chemin}[${index}]`));
      return;
    }
    if (!valeur || typeof valeur !== 'object') return;
    for (const [cle, item] of Object.entries(valeur as Record<string, unknown>)) {
      if (cle === 'numeros' && item !== null) fuites.push(`${chemin}.numeros`);
      if (cle === 'monNumero' && item !== attendu) fuites.push(`${chemin}.monNumero = ${String(item)}`);
      if (cle === 'score' && item !== null) fuites.push(`${chemin}.score`);
      if (cle === 'proposition' && item !== null) fuites.push(`${chemin}.proposition`);
      parcourir(item, `${chemin}.${cle}`);
    }
  };
  parcourir(vue, 'vue');
  return fuites;
}

/** Les questions non choisies et toutes les réponses restent hors du message, où qu'elles soient. */
export function fuitesJeopardy(vue: VueClient, config: ConfigJeopardy, courante: { theme: number; niveau: number } | null): string[] {
  if (!vue.course?.jeopardy) return [];
  const texte = JSON.stringify(vue);
  const fuites: string[] = [];
  if (contientCle(vue, 'reponse') || contientCle(vue, 'accepte')) fuites.push('champ de réponse');
  config.themes.forEach((theme, indexTheme) => {
    theme.questions.forEach((question, niveau) => {
      const actuelle = courante?.theme === indexTheme && courante.niveau === niveau;
      if (!actuelle && texte.includes(question.question)) fuites.push(`question ${theme.nom} ${niveau + 1}`);
      for (const reponse of [question.reponse, ...question.accepte]) {
        if (reponse && texte.includes(reponse)) fuites.push(`réponse « ${reponse} »`);
      }
    });
  });
  return fuites;
}

/** Avant la fin de la manche : le mot de chacun ne va qu'à lui, le rôle d'un joueur n'est public qu'une fois éliminé. */
export function fuitesUndercover(vue: VueClient, joueurId: string | null, manche: MancheUndercover): string[] {
  const courante = vue.course?.undercover?.courante;
  if (!courante || manche.etape === 'finie') return [];
  const texte = JSON.stringify(vue);
  const civils = JSON.stringify(manche.paire.civils);
  const intrus = JSON.stringify(manche.paire.undercover);
  const monMot = joueurId && manche.ordreParole.includes(joueurId) ? (joueurId === manche.undercoverId ? intrus : civils) : null;
  const fuites: string[] = [];
  for (const mot of [civils, intrus]) if (mot !== monMot && texte.includes(mot)) fuites.push(`mot ${mot}`);
  if (courante.paire !== null) fuites.push('paire');
  if (!manche.elimines.includes(manche.undercoverId) && courante.undercoverId !== null) fuites.push('undercover désigné');
  for (const entree of courante.elimines) if (!manche.elimines.includes(entree.id)) fuites.push(`rôle de ${entree.id}`);
  return fuites;
}

/** Clé et couleurs non révélées : réservées hôte + espions. */
export function fuitesCodenames(vue: VueClient, joueurId: string | null, manche: MancheCodenames, role: 'tv' | 'joueur' | 'hote'): string[] {
  const courante = vue.course?.codenames?.courante;
  if (!courante || manche.etape === 'finie') return [];
  const fuites: string[] = [];
  const monEquipe = joueurId
    ? (manche.equipes.rouge.includes(joueurId) ? 'rouge' as const : manche.equipes.bleu.includes(joueurId) ? 'bleu' as const : null)
    : null;
  const estEspion = monEquipe !== null && manche.espions[monEquipe] === joueurId;
  const voitCle = role === 'hote' || estEspion;
  for (const carte of courante.cartes) {
    const source = manche.cartes[carte.index];
    if (!source) continue;
    if (!voitCle && !source.revelee && carte.couleur !== null) {
      fuites.push(`couleur ${carte.index}`);
    }
  }
  return fuites;
}

/** Faces d'un joueur : soi + hôte jusqu'à révélation. */
export function fuitesPerudo(vue: VueClient, joueurId: string | null, jeu: PerudoCourse, role: 'tv' | 'joueur' | 'hote'): string[] {
  const vueJeu = vue.course?.perudo;
  if (!vueJeu) return [];
  const revele = jeu.etape === 'revelation' || jeu.etape === 'terminee';
  if (revele) return [];
  const fuites: string[] = [];
  for (const joueur of vueJeu.joueurs) {
    if (joueur.faces === null) continue;
    const autorise = role === 'hote' || (role === 'joueur' && joueurId === joueur.id);
    if (!autorise) fuites.push(`dés de ${joueur.id}`);
  }
  return fuites;
}

/** Mot secret : indiceurs seulement avant la fin ; télé et devineur jamais avant `finie`. */
export function fuitesJustOne(
  vue: VueClient,
  joueurId: string | null,
  manche: MancheJustOne,
  role: 'tv' | 'joueur' | 'hote',
): string[] {
  const courante = vue.course?.justone?.courante;
  if (!courante || manche.etape === 'finie') return [];
  const fuites: string[] = [];
  const moi = role === 'hote' ? 'hote' : joueurId;
  const jeSuisDevineur = moi === manche.devineurId;
  const estIndiceur = !!moi && moi !== manche.devineurId;
  if (courante.mot !== null) {
    if (role === 'tv' || jeSuisDevineur) fuites.push('mot secret');
    if (role === 'joueur' && !estIndiceur && !jeSuisDevineur) fuites.push('mot secret');
  }
  if (manche.etape === 'indices' || manche.etape === 'verification') {
    for (const indice of courante.indices) {
      if (indice.mot === null) continue;
      if (role === 'tv' || jeSuisDevineur) fuites.push(`indice de ${indice.auteurId}`);
    }
  }
  if ((manche.etape === 'revelation' || manche.etape === 'reponse') && role === 'tv') {
    for (const indice of courante.indices) {
      if (indice.annule && indice.mot !== null) fuites.push(`texte annulé ${indice.auteurId}`);
    }
  }
  return fuites;
}

function contientCle(valeur: unknown, cle: string): boolean {
  if (Array.isArray(valeur)) return valeur.some((item) => contientCle(item, cle));
  if (!valeur || typeof valeur !== 'object') return false;
  const objet = valeur as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(objet, cle)) return true;
  return Object.values(objet).some((item) => contientCle(item, cle));
}

function estEvenement(valeur: Record<string, unknown>): boolean {
  return typeof valeur.horodatage === 'number' && 'visibilite' in valeur && typeof valeur.type === 'string';
}

export function stabiliser(valeur: unknown): unknown {
  if (Array.isArray(valeur)) return valeur.map(stabiliser);
  if (!valeur || typeof valeur !== 'object') return valeur;
  const objet = valeur as Record<string, unknown>;
  const copie: Record<string, unknown> = {};
  for (const [cle, item] of Object.entries(objet)) {
    if (cle === 'version' || cle === 'heureServeur' || cle === 'latenceMs' || cle === 'decalageMs' || cle === 'enLigne' || cle === 'appareils') {
      continue;
    }
    if (cle === 'id' && estEvenement(objet)) continue;
    copie[cle] = stabiliser(item);
  }
  return copie;
}

export function memeVue(avant: VueClient | null, apres: VueClient | null): boolean {
  return JSON.stringify(stabiliser(avant)) === JSON.stringify(stabiliser(apres));
}
