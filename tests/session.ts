import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { io, type Socket } from 'socket.io-client';
import { solde } from '../shared/soldes';
import type { Action, EtatJeu, ReponseAction, TypeCase, VueClient } from '../shared/types';
import { demarrerServeur, type ConfigTest, type ServeurJeu } from '../server/demarrer';

export const CODE_HOTE = 'change-moi';

export const DISPOSITION: TypeCase[] = [
  'depart',
  'bonus',
  'chance',
  'bonus',
  'duel',
  'bonus',
  'cagnotte',
  'bonus',
  'duel',
  'bonus',
  'bonus',
  'bonus',
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

export async function portDisponible(): Promise<number> {
  for (let essai = 0; essai < 5; essai += 1) {
    const port = await portLibre();
    if (port !== 3000 && port > 0) return port;
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
    if (transaction.montant < 0 && transaction.source !== 'mise' && transaction.source !== 'manuel') {
      throw new Error(`Transaction négative interdite (${transaction.source}) pour ${transaction.joueurId}`);
    }
  }
  const course = etat.course;
  if (!course) return;
  if (course.cagnotte < 0) throw new Error(`Cagnotte négative : ${course.cagnotte}`);
  for (const joueur of etat.joueurs) {
    const position = course.positions[joueur.id] ?? 0;
    if (position < 0 || position > 34) throw new Error(`Position hors plateau pour ${joueur.pseudo} : ${position}`);
    if (position > course.regles.longueur) throw new Error(`Position au-delà de l'arrivée pour ${joueur.pseudo}`);
  }
}

export function fuitesMises(vue: VueClient, joueurId: string | null): string[] {
  const course = vue.course;
  if (!course) return [];
  const fuites: string[] = [];
  const secret = (mises: Array<{ joueurId: string; montant?: number }>) => {
    for (const mise of mises) {
      if (mise.joueurId === joueurId) continue;
      if (mise.montant !== undefined) fuites.push(`${mise.joueurId}:${mise.montant}`);
    }
  };
  if (course.phase === 'mises') secret(course.mises);
  if (course.duel?.etape === 'mises') secret(course.duel.mises);
  for (const evenement of vue.evenements) {
    if (evenement.type !== 'mise.posee' && evenement.type !== 'duel.mise') continue;
    if ('montant' in evenement.donnees) fuites.push(`événement ${evenement.type}`);
  }
  if (contientCle(vue, 'pioche') || contientCle(vue, 'defausse')) fuites.push('pioche');
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
