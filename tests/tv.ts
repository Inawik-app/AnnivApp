import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import type { Action, TypeCase } from '../shared/types';
import {
  CODE_HOTE,
  agir,
  connecter,
  fermerSession,
  ouvrirServeur,
  type Participant,
} from './session';

const DISPOSITION_TV: TypeCase[] = [
  'depart',
  'bonus',
  'cagnotte',
  'duel',
  'bonus',
  'bonus',
  'bonus',
  'bonus',
  'bonus',
  'bonus',
  'bonus',
  'bonus',
  'arrivee',
];

type EtapeChrono = { evenement: string; etape: string; debut: number; fin: number };
type Instantane = {
  phase: string | null;
  cagnotte: number;
  ordre: string[];
  positions: Record<string, number>;
  gp: Record<string, number>;
};

declare global {
  interface Window {
    __chronologieAnimations?: EtapeChrono[];
    __etapeCourante?: { evenement: string; etape: string } | null;
    __etatAffiche?: Instantane;
    __etatRecu?: Instantane;
    __fileVide?: boolean;
  }
}

function suite(chrono: EtapeChrono[], depart: number): string[] {
  const etapes: string[] = [];
  for (let index = depart; index < chrono.length; index += 1) {
    const etape = chrono[index];
    if (!etape) continue;
    if (index > depart && etape.etape === 'de') break;
    etapes.push(etape.etape);
  }
  return etapes;
}

async function main(): Promise<void> {
  const debut = Date.now();
  const captures = path.join(process.cwd(), 'test-results', 'tv');
  fs.mkdirSync(captures, { recursive: true });
  const { serveur, dossier } = await ouvrirServeur({ desForces: [1, 2, 3], disposition: DISPOSITION_TV }, true);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const sockets: Participant[] = [];
  try {
    await page.goto(`${serveur.url}/tv?debug=1&vitesse=4`, { waitUntil: 'domcontentloaded' });
    await page.getByText('Connecté').waitFor({ timeout: 20000 });
    const hote = await connecter(serveur.url, 'hote', { codeHote: CODE_HOTE });
    sockets.push(hote);
    const fiches = [
      { pseudo: 'Léo', avatar: 'soleil', mise: 4 },
      { pseudo: 'Inès', avatar: 'lune', mise: 3 },
      { pseudo: 'Noé', avatar: 'feuille', mise: 2 },
      { pseudo: 'Lina', avatar: 'goutte', mise: 1 },
    ];
    const joueurs: Participant[] = [];
    for (const fiche of fiches) {
      const joueur = await connecter(serveur.url, 'joueur');
      sockets.push(joueur);
      const reponse = await agir(joueur, { type: 'rejoindre', pseudo: fiche.pseudo, avatar: fiche.avatar });
      if (!reponse.ok || !reponse.joueurId) throw new Error(reponse.ok ? 'Joueur sans id' : reponse.erreur);
      joueur.joueurId = reponse.joueurId;
      joueur.pseudo = fiche.pseudo;
      joueurs.push(joueur);
    }
    const agirHote = async (action: Action) => {
      const reponse = await agir(hote, action);
      if (!reponse.ok) throw new Error(reponse.erreur);
    };
    for (const joueur of joueurs) {
      await agirHote({ type: 'ajouterGP', joueurId: joueur.joueurId, montant: 30, libelle: 'Départ' });
    }
    await agirHote({ type: 'demarrerCourse' });
    await agirHote({ type: 'nouveauTour' });
    for (const [index, joueur] of joueurs.entries()) {
      const reponse = await agir(joueur, { type: 'miser', montant: fiches[index]?.mise ?? 1 });
      if (!reponse.ok) throw new Error(reponse.erreur);
    }
    const capturesPromesse = (async () => {
      await page.waitForFunction(() => window.__etapeCourante?.etape === 'revelation', undefined, { timeout: 20000 });
      await page.screenshot({ path: path.join(captures, '02-revelation.png') });
      await page.waitForFunction(() => window.__etapeCourante?.etape === 'de-arrete', undefined, { timeout: 20000 });
      await page.screenshot({ path: path.join(captures, '03-de-arrete.png') });
      await page.waitForFunction(() => window.__etapeCourante?.etape === 'pion-arrive', undefined, { timeout: 20000 });
      await page.screenshot({ path: path.join(captures, '04-pion-arrive.png') });
      await page.waitForFunction(() => window.__etapeCourante?.etape === 'duel', undefined, { timeout: 20000 });
      await page.screenshot({ path: path.join(captures, '05-duel.png') });
    })();
    await agirHote({ type: 'revelerMises' });
    await agirHote({ type: 'passerAuChoix' });
    await agirHote({ type: 'choisirMiniJeu', nom: 'Ping-pong' });
    await agirHote({ type: 'passerAuxDeplacements' });
    for (const joueur of joueurs.slice(0, 3)) {
      const reponse = await agir(joueur, { type: 'lancerDe' });
      if (!reponse.ok) throw new Error(reponse.erreur);
    }
    await capturesPromesse;
    await page.waitForFunction(() => window.__fileVide === true, undefined, { timeout: 20000 });
    const bilan = await page.evaluate(() => ({
      chrono: window.__chronologieAnimations ?? [],
      affiche: window.__etatAffiche ?? null,
      recu: window.__etatRecu ?? null,
      vide: window.__fileVide === true,
    }));
    if (!bilan.vide) throw new Error('La file n\'est pas vide');
    for (let index = 0; index < bilan.chrono.length - 1; index += 1) {
      const courant = bilan.chrono[index];
      const suivant = bilan.chrono[index + 1];
      if (!courant || !suivant) continue;
      if (courant.fin > suivant.debut + 5) {
        throw new Error(`Chevauchement entre ${courant.etape} et ${suivant.etape}`);
      }
    }
    const des = bilan.chrono.flatMap((etape, index) => (etape.etape === 'de' ? [index] : []));
    if (des.length < 3) throw new Error(`Trois lancers attendus, ${des.length} vus`);
    const bonus = suite(bilan.chrono, des[0] ?? 0).join(',');
    const cagnotte = suite(bilan.chrono, des[1] ?? 0).join(',');
    const duel = suite(bilan.chrono, des[2] ?? 0).join(',');
    if (bonus !== 'de,sauts,effet,gp') throw new Error(`Ordre du bonus : ${bonus}`);
    if (!cagnotte.startsWith('de,sauts,effet,gp')) throw new Error(`Ordre de la cagnotte : ${cagnotte}`);
    if (!duel.startsWith('de,sauts,duel')) throw new Error(`Ordre du duel : ${duel}`);
    if (!bilan.affiche || !bilan.recu) throw new Error('États affiché et reçu introuvables');
    const nombres = (table: Record<string, number>) =>
      Object.keys(table)
        .sort()
        .map((cle) => `${cle}:${table[cle]}`)
        .join('|');
    const meme = (gauche: Instantane, droite: Instantane) =>
      gauche.phase === droite.phase &&
      gauche.cagnotte === droite.cagnotte &&
      JSON.stringify(gauche.ordre) === JSON.stringify(droite.ordre) &&
      nombres(gauche.positions) === nombres(droite.positions) &&
      nombres(gauche.gp) === nombres(droite.gp);
    if (!meme(bilan.affiche, bilan.recu)) {
      throw new Error(`État affiché différent de l'état reçu\n${JSON.stringify(bilan.affiche)}\n${JSON.stringify(bilan.recu)}`);
    }
    console.log('OK     Aucun chevauchement');
    console.log('OK     Dé, puis sauts, puis effet, puis GP');
    console.log('OK     État affiché égal à l\'état reçu');
    console.log(`OK     Captures dans ${captures}`);
    console.log(`Durée  ${((Date.now() - debut) / 1000).toFixed(1)} s`);
  } catch (erreur) {
    console.log(`ÉCHEC  ${erreur instanceof Error ? erreur.message : String(erreur)}`);
    process.exitCode = 1;
  } finally {
    await browser.close();
    await fermerSession({ serveur, dossier, sockets: sockets.map((participant) => participant.socket) });
  }
}

void main();
