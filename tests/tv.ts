import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Page } from 'playwright';
import type { Action } from '../shared/types';
import {
  CODE_HOTE,
  agir,
  connecter,
  fermerSession,
  ouvrirServeur,
  type Participant,
} from './session';

const DISPOSITION_TV = [
  'depart',
  'bonus',
  'bonus',
  'bonus',
  'bonus',
  'bonus',
  'bonus',
  'bonus',
  'arrivee',
] as const;

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
    __sauts?: number;
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

type ControlePlateau = {
  nombreCases: number;
  groupe: { index: number; nombre: number } | null;
};

async function verifierPlateau(page: Page, attendu: ControlePlateau): Promise<void> {
  const erreur = await page.evaluate(
    `({ nombreCases, groupe }) => {
      const zone = document.querySelector('[data-zone="plateau"]');
      if (!(zone instanceof HTMLElement)) return 'Zone plateau absente';
      const zoneBox = zone.getBoundingClientRect();
      const rect = (el) => el.getBoundingClientRect();
      const dedans = (enfant, parent) => enfant.width > 0 && enfant.height > 0 && enfant.left >= parent.left - 1 && enfant.right <= parent.right + 1 && enfant.top >= parent.top - 1 && enfant.bottom <= parent.bottom + 1;
      const croise = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
      const cases = [...document.querySelectorAll('[data-case]')].filter((el) => el instanceof HTMLElement);
      if (cases.length !== nombreCases) return cases.length + ' cases affichées, ' + nombreCases + ' attendues';
      for (const tuile of cases) {
        if (!dedans(rect(tuile), zoneBox)) return 'La case ' + tuile.dataset.case + ' sort de la zone plateau';
      }
      for (let gauche = 0; gauche < cases.length; gauche += 1) {
        for (let droite = gauche + 1; droite < cases.length; droite += 1) {
          const a = cases[gauche];
          const b = cases[droite];
          if (a && b && croise(rect(a), rect(b))) return 'Les cases ' + a.dataset.case + ' et ' + b.dataset.case + ' se chevauchent';
        }
      }
      const pions = [...document.querySelectorAll('.pion')].filter((el) => el instanceof HTMLElement);
      for (const pion of pions) {
        const tuile = cases.find((candidate) => candidate.dataset.case === pion.dataset.surCase);
        if (!tuile) return 'Pion sans case ' + pion.dataset.surCase;
        if (!dedans(rect(pion), rect(tuile))) return 'Un pion sort de la case ' + pion.dataset.surCase;
      }
      for (const numero of document.querySelectorAll('[data-numero]')) {
        if (!(numero instanceof HTMLElement)) continue;
        const cadre = rect(numero);
        if (cadre.width <= 0 || cadre.height <= 0) return 'Le numéro ' + numero.dataset.numero + ' est invisible';
        for (const pion of pions) {
          if (croise(cadre, rect(pion))) return 'Le numéro ' + numero.dataset.numero + ' est recouvert par un pion';
        }
      }
      for (const nom of ['fiches', 'entete', 'cagnotte']) {
        const el = document.querySelector('[data-zone="' + nom + '"]');
        if (!(el instanceof HTMLElement)) return 'Zone ' + nom + ' absente';
        const elements = [el, ...el.querySelectorAll('*')].filter((noeud) => noeud instanceof HTMLElement);
        for (const element of elements) {
          const boite = rect(element);
          if (boite.width <= 0 || boite.height <= 0) continue;
          if (croise(zoneBox, boite)) return nom + ' recouvre la zone plateau';
        }
      }
      const fiches = [...document.querySelectorAll('.fiche-joueur')].filter((el) => el instanceof HTMLElement);
      if (fiches.length < 4) return 'Les quatre fiches ne sont pas affichées';
      let pseudoLong = false;
      for (const fiche of fiches) {
        const pseudo = fiche.querySelector('.pseudo-fiche');
        if (!(pseudo instanceof HTMLElement)) return 'Une fiche n\\'a pas de pseudo';
        const boite = rect(pseudo);
        if (boite.width <= 0 || boite.height <= 0) return 'Un pseudo a une largeur nulle';
        if (!dedans(boite, rect(fiche))) return 'Le pseudo sort de sa fiche';
        if ((pseudo.textContent || '').indexOf('Maximilien-Alexa') >= 0) pseudoLong = true;
      }
      if (!pseudoLong) return 'Le pseudo long est absent';
      if (groupe) {
        const surPlace = pions.filter((pion) => pion.dataset.surCase === String(groupe.index));
        if (surPlace.length !== groupe.nombre) return surPlace.length + ' pions sur la case ' + groupe.index + ', ' + groupe.nombre + ' attendus';
      }
      return null;
    }`,
    attendu,
  );
  if (typeof erreur === 'string') throw new Error(erreur);
}

async function texteEntete(page: Page): Promise<string> {
  return page.locator('[data-zone="entete"]').innerText();
}

async function main(): Promise<void> {
  const debut = Date.now();
  const captures = path.join(process.cwd(), 'test-results', 'tv');
  fs.mkdirSync(captures, { recursive: true });
  for (const ancien of fs.readdirSync(captures)) {
    if (ancien.endsWith('.png')) fs.rmSync(path.join(captures, ancien));
  }
  const { serveur, dossier } = await ouvrirServeur({ desForces: [3, 3, 5], disposition: [...DISPOSITION_TV] }, true);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const sockets: Participant[] = [];
  try {
    await page.goto(`${serveur.url}/tv?debug=1&vitesse=2`, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-connecte="1"]').waitFor({ timeout: 20000 });
    const hote = await connecter(serveur.url, 'hote', { codeHote: CODE_HOTE });
    sockets.push(hote);
    const fiches = [
      { pseudo: 'Maximilien-Alexa', avatar: 'soleil' },
      { pseudo: 'Inès', avatar: 'lune' },
      { pseudo: 'Noé', avatar: 'feuille' },
      { pseudo: 'Lina', avatar: 'goutte' },
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
    const ines = joueurs.find((joueur) => joueur.pseudo === 'Inès');
    const noe = joueurs.find((joueur) => joueur.pseudo === 'Noé');
    if (!ines || !noe) throw new Error('Inès ou Noé est absent');
    const agirHote = async (action: Action) => {
      const reponse = await agir(hote, action);
      if (!reponse.ok) throw new Error(`${action.type} : ${reponse.erreur}`);
    };
    for (const joueur of joueurs) {
      await agirHote({ type: 'ajouterGP', joueurId: joueur.joueurId, montant: 30, libelle: 'Départ' });
    }
    await agirHote({ type: 'demarrerCourse' });
    const course = serveur.etat().course;
    if (!course) throw new Error('Course absente');
    const nombreCases = course.regles.longueur + 1;
    await page.waitForFunction((attendu) => document.querySelectorAll('[data-case]').length === attendu, nombreCases, { timeout: 20000 });
    await page.waitForFunction(() => window.__fileVide === true, undefined, { timeout: 20000 });
    await verifierPlateau(page, { nombreCases, groupe: { index: 0, nombre: 4 } });
    await page.screenshot({ path: path.join(captures, '01-depart.png') });

    await agirHote({ type: 'nouveauTour' });
    await page.getByText('Inès choisit le mini-jeu').waitFor({ timeout: 20000 });
    const choix = await texteEntete(page);
    if (!choix.includes('Inès') || choix.includes('Un joueur')) throw new Error(`En-tête du choix : ${choix}`);
    await page.screenshot({ path: path.join(captures, '05-minijeu.png') });
    await agirHote({ type: 'choisirMiniJeu', nom: 'Ping-pong' });
    await agirHote({ type: 'passerAuxDeplacements' });
    await page.getByText('À Inès de jouer').waitFor({ timeout: 20000 });
    await page.getByText('Inès choisit sa mise').waitFor({ timeout: 20000 });

    const saut = (async () => {
      await page.waitForFunction(() => {
        if ((window.__sauts ?? 0) < 3) return false;
        const pion = document.querySelector('.pion-ancre.suivi .pion');
        const case2 = document.querySelector('[data-case="2"]');
        const case3 = document.querySelector('[data-case="3"]');
        if (!(pion instanceof HTMLElement) || !(case2 instanceof HTMLElement) || !(case3 instanceof HTMLElement)) return false;
        const boite = pion.getBoundingClientRect();
        const bas = case2.getBoundingClientRect();
        const haut = case3.getBoundingClientRect();
        const milieuX = boite.left + boite.width / 2;
        const colonne = milieuX > bas.left && milieuX < bas.right;
        const horsBas = boite.top < bas.top - 1 || boite.bottom > bas.bottom + 1 || boite.left < bas.left - 1 || boite.right > bas.right + 1;
        const horsHaut = boite.top < haut.top - 1 || boite.bottom > haut.bottom + 1 || boite.left < haut.left - 1 || boite.right > haut.right + 1;
        return colonne && horsBas && horsHaut;
      });
      await page.evaluate(`() => {
        for (const el of document.querySelectorAll('.pion-ancre, .pion, .halo-pion')) {
          if (!(el instanceof HTMLElement) || !el.getAnimations) continue;
          for (const animation of el.getAnimations()) animation.pause();
        }
      }`);
      await page.screenshot({ path: path.join(captures, '03-saut.png'), animations: 'allow' });
      await page.evaluate(`() => {
        for (const el of document.querySelectorAll('.pion-ancre, .pion, .halo-pion')) {
          if (!(el instanceof HTMLElement) || !el.getAnimations) continue;
          for (const animation of el.getAnimations()) animation.play();
        }
      }`);
    })();
    const lancer = await agir(ines, { type: 'lancerDe', mise: 0 });
    if (!lancer.ok) throw new Error(lancer.erreur);
    await saut;
    await page.waitForFunction(() => window.__fileVide === true, undefined, { timeout: 20000 });

    const second = await agir(noe, { type: 'lancerDe', mise: 0 });
    if (!second.ok) throw new Error(second.erreur);
    await page.waitForFunction(() => window.__fileVide === true, undefined, { timeout: 20000 });
    await verifierPlateau(page, { nombreCases, groupe: { index: 3, nombre: 2 } });
    await page.screenshot({ path: path.join(captures, '02-milieu.png') });

    await agirHote({ type: 'passerJoueur' });
    await agirHote({ type: 'passerJoueur' });
    await page.waitForFunction(() => window.__fileVide === true, undefined, { timeout: 20000 });
    await agirHote({ type: 'nouveauTour' });
    await agirHote({ type: 'choisirMiniJeu', nom: 'Quiz' });
    await agirHote({ type: 'passerAuxDeplacements' });
    const arrivee = (async () => {
      await page.waitForFunction(() => window.__etapeCourante?.etape === 'arrivee', undefined, { timeout: 20000 });
      await page.screenshot({ path: path.join(captures, '04-arrivee.png') });
    })();
    const dernier = await agir(ines, { type: 'lancerDe', mise: 0 });
    if (!dernier.ok) throw new Error(dernier.erreur);
    await arrivee;
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
    const premier = suite(bilan.chrono, des[0] ?? 0).join(',');
    if (!premier.startsWith('de,sauts,effet')) throw new Error(`Ordre du premier lancer : ${premier}`);
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
    console.log('OK     Cases dans la zone, sans chevauchement');
    console.log('OK     Pions dans leur case, numéros visibles');
    console.log('OK     Colonnes et en-tête hors du plateau');
    console.log('OK     Pseudos visibles, y compris le plus long');
    console.log('OK     En-tête au nom du joueur');
    console.log('OK     Aucun chevauchement d\'animation');
    console.log('OK     Dé, puis sauts, puis effet');
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
