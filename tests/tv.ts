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

async function verifierZone(page: Page, zone: string): Promise<void> {
  const erreur = await page.evaluate(
    new Function('zone', `
      const racine = document.querySelector('[data-zone="' + zone + '"]');
      if (!(racine instanceof HTMLElement)) return 'zone absente';
      const boite = racine.getBoundingClientRect();
      const liste = [racine, ...racine.querySelectorAll('*')];
      for (const el of liste) {
        if (!(el instanceof HTMLElement)) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) continue;
        if (rect.left < boite.left - 1 || rect.right > boite.right + 1 || rect.top < boite.top - 1 || rect.bottom > boite.bottom + 1) {
          return 'déborde : ' + String(el.className || el.tagName);
        }
      }
      const regle = racine.querySelector('.regle-ligne');
      if (regle instanceof HTMLElement && Number.parseFloat(getComputedStyle(regle).fontSize) < 40) return 'règle trop petite';
      const minuteur = racine.querySelector('.minuteur');
      if (minuteur instanceof HTMLElement && Number.parseFloat(getComputedStyle(minuteur).fontSize) < 90) return 'minuteur trop petit';
      const gain = racine.querySelector('.podium-gp');
      if (gain instanceof HTMLElement && Number.parseFloat(getComputedStyle(gain).fontSize) < 90) return 'gain trop petit';
      return '';
    `) as (zone: string) => string,
    zone,
  );
  if (erreur) throw new Error(`Débordement sur ${zone} : ${erreur}`);
}

async function verifierTextes(page: Page): Promise<void> {
  const erreur = await page.evaluate(
    new Function(`
      const scene = document.querySelector('.scene');
      if (!(scene instanceof HTMLElement)) return 'scène absente';
      const combinaisons = document.querySelector('[data-zone="combinaisons"]');
      const noeuds = scene.querySelectorAll('*');
      for (let i = 0; i < noeuds.length; i += 1) {
        const el = noeuds[i];
        if (!(el instanceof HTMLElement)) continue;
        const style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        let texte = '';
        const enfants = el.childNodes;
        for (let n = 0; n < enfants.length; n += 1) {
          const noeud = enfants[n];
          if (noeud && noeud.nodeType === 3) texte += noeud.textContent || '';
        }
        if (!texte.trim()) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) continue;
        const taille = Number.parseFloat(style.fontSize);
        const dansCombi = combinaisons instanceof HTMLElement && combinaisons.contains(el);
        const min = dansCombi ? 28 : 36;
        if (taille + 0.1 < min) return Math.round(taille) + 'px < ' + min + ' : ' + texte.trim().slice(0, 48);
      }
      return '';
    `) as () => string,
  );
  if (erreur) throw new Error(`Texte trop petit : ${erreur}`);
}

async function verifierCombinaisons(page: Page): Promise<void> {
  const erreur = await page.evaluate(
    new Function(`
      const poker = document.querySelector('[data-zone="poker"]');
      if (!(poker instanceof HTMLElement)) return 'écran poker absent';
      if ((poker.textContent || '').indexOf('jetons offerts') >= 0) return 'les jetons offerts sont encore affichés';
      const panneau = document.querySelector('[data-zone="combinaisons"]');
      if (!(panneau instanceof HTMLElement)) return 'panneau des combinaisons absent';
      const boite = panneau.getBoundingClientRect();
      const rect = (el) => el.getBoundingClientRect();
      const dedans = (enfant, parent) => enfant.width > 0 && enfant.height > 0 && enfant.left >= parent.left - 1 && enfant.right <= parent.right + 1 && enfant.top >= parent.top - 1 && enfant.bottom <= parent.bottom + 1;
      const croise = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
      const lignes = panneau.querySelectorAll('[data-combinaison]');
      if (lignes.length !== 10) return lignes.length + ' combinaisons au lieu de 10';
      for (let i = 0; i < lignes.length; i += 1) {
        const ligne = lignes[i];
        if (!(ligne instanceof HTMLElement)) return 'ligne illisible';
        if (!dedans(rect(ligne), boite)) return 'la ligne ' + (ligne.dataset.combinaison || i) + ' sort du panneau';
        const cartes = ligne.querySelectorAll('[data-carte]');
        if (cartes.length !== 5) return (ligne.dataset.combinaison || i) + ' a ' + cartes.length + ' cartes';
        for (let c = 0; c < cartes.length; c += 1) {
          const carte = cartes[c];
          if (!(carte instanceof HTMLElement)) return 'carte illisible';
          if (!dedans(rect(carte), boite)) return 'une carte sort du panneau';
          for (let d = c + 1; d < cartes.length; d += 1) {
            const autre = cartes[d];
            if (autre instanceof HTMLElement && croise(rect(carte), rect(autre))) return 'deux cartes se chevauchent';
          }
          const largeur = rect(carte).width;
          if (largeur + 0.5 < 70) return 'carte trop étroite : ' + Math.round(largeur) + 'px';
        }
        const nom = ligne.querySelector('.nom-combi');
        if (!(nom instanceof HTMLElement)) return 'nom absent';
        const cartesBoites = [];
        for (let c = 0; c < cartes.length; c += 1) {
          const carte = cartes[c];
          if (carte instanceof HTMLElement) cartesBoites.push(rect(carte));
        }
        let hautCartes = Infinity;
        for (let c = 0; c < cartesBoites.length; c += 1) hautCartes = Math.min(hautCartes, cartesBoites[c].top);
        const nomBoite = rect(nom);
        if (nomBoite.bottom > hautCartes + 1) return 'le nom chevauche les cartes : ' + (ligne.dataset.combinaison || i);
        if (nomBoite.top >= hautCartes) return 'le nom n est pas au-dessus des cartes';
        for (let j = i + 1; j < lignes.length; j += 1) {
          const autre = lignes[j];
          if (autre instanceof HTMLElement && croise(rect(ligne), rect(autre))) return 'deux lignes se chevauchent';
        }
      }
      let hautCellules = Infinity;
      let basCellules = -Infinity;
      for (let i = 0; i < lignes.length; i += 1) {
        const ligne = lignes[i];
        if (!(ligne instanceof HTMLElement)) continue;
        const boiteLigne = rect(ligne);
        hautCellules = Math.min(hautCellules, boiteLigne.top);
        basCellules = Math.max(basCellules, boiteLigne.bottom);
      }
      const part = (basCellules - hautCellules) / boite.height;
      if (part < 0.85) return 'les cellules occupent ' + Math.round(part * 100) + '% du panneau';
      return '';
    `) as () => string,
  );
  if (erreur) throw new Error(`Combinaisons : ${erreur}`);
}

async function verifierRendu(page: Page): Promise<void> {
  const erreur = await page.evaluate(
    new Function(`
      const rect = (el) => el.getBoundingClientRect();
      const croise = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
      const montre = (el) => {
        const style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return null;
        const boite = rect(el);
        if (boite.width < 1 || boite.height < 1) return null;
        return boite;
      };
      const panneau = document.querySelector('[data-panneau="principal"]');
      if (!(panneau instanceof HTMLElement)) return 'panneau principal absent';
      const cadre = rect(panneau);
      let haut = Infinity;
      let bas = -Infinity;
      const descendants = panneau.querySelectorAll('*');
      for (let i = 0; i < descendants.length; i += 1) {
        const el = descendants[i];
        if (!(el instanceof HTMLElement)) continue;
        const boite = montre(el);
        if (!boite || boite.height < 8) continue;
        haut = Math.min(haut, boite.top);
        bas = Math.max(bas, boite.bottom);
      }
      const part = (bas - haut) / cadre.height;
      if (!(part >= 0.8)) return 'le contenu occupe ' + Math.round(part * 100) + '% du panneau';
      const scene = document.querySelector('.scene') || document.body;
      const noeuds = scene.querySelectorAll('*');
      for (let i = 0; i < noeuds.length; i += 1) {
        const el = noeuds[i];
        if (!(el instanceof HTMLElement)) continue;
        if (el.closest('.rouleau')) continue;
        const style = getComputedStyle(el);
        const boite = montre(el);
        if (!boite) continue;
        let texte = '';
        const enfants = el.childNodes;
        for (let n = 0; n < enfants.length; n += 1) {
          const noeud = enfants[n];
          if (noeud && noeud.nodeType === 3) texte += noeud.textContent || '';
        }
        if (texte.trim()) {
          const famille = style.fontFamily;
          const pixel = famille.indexOf('Press Start') >= 0 || famille.indexOf('DotGothic') >= 0;
          if (pixel && Math.round(Number.parseFloat(style.fontSize)) % 8 !== 0) {
            return 'taille pixel hors multiple de 8 : ' + style.fontSize + ' ' + texte.trim().slice(0, 32);
          }
          const hote = el.closest('.panneau, .fiche-joueur, .tuile, .tuile-mini, .entete-plateau, .case-plateau, [data-panneau="principal"]');
          if (hote instanceof HTMLElement) {
            const cadreHote = rect(hote);
            if (boite.left < cadreHote.left - 2 || boite.right > cadreHote.right + 2 || boite.top < cadreHote.top - 2 || boite.bottom > cadreHote.bottom + 2) {
              return 'texte hors panneau : ' + texte.trim().slice(0, 40);
            }
          }
        }
      }
      const parents = document.querySelectorAll('.plateau-scene, .ecran-poker, .poker-gauche, .accueil, .podium');
      for (let p = 0; p < parents.length; p += 1) {
        const parent = parents[p];
        if (!(parent instanceof HTMLElement) || !montre(parent)) continue;
        const kids = [];
        for (let i = 0; i < parent.children.length; i += 1) {
          const enfant = parent.children[i];
          if (enfant instanceof HTMLElement && montre(enfant)) kids.push(enfant);
        }
        for (let i = 0; i < kids.length; i += 1) {
          for (let j = i + 1; j < kids.length; j += 1) {
            const a = kids[i];
            const b = kids[j];
            if (a instanceof HTMLElement && b instanceof HTMLElement && croise(rect(a), rect(b))) {
              return 'panneaux qui se chevauchent : ' + String(a.className) + ' / ' + String(b.className);
            }
          }
        }
      }
      return '';
    `) as () => string,
  );
  if (erreur) throw new Error(`Rendu : ${erreur}`);
}

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
    new Function('attendu', `
      const nombreCases = attendu.nombreCases;
      const groupe = attendu.groupe;
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
        if (!(pseudo instanceof HTMLElement)) return "Une fiche n'a pas de pseudo";
        const boite = rect(pseudo);
        if (boite.width <= 0 || boite.height <= 0) return 'Un pseudo a une largeur nulle';
        if (!dedans(boite, rect(fiche))) return 'Le pseudo sort de sa fiche';
        if ((pseudo.textContent || '').indexOf('Maximilien-Alexandre') >= 0) {
          pseudoLong = true;
          if (pseudo.scrollWidth > pseudo.clientWidth + 1) return 'Le pseudo long est tronqué';
        }
      }
      if (!pseudoLong) return 'Le pseudo long est absent';
      if (groupe) {
        const surPlace = pions.filter((pion) => pion.dataset.surCase === String(groupe.index));
        if (surPlace.length !== groupe.nombre) return surPlace.length + ' pions sur la case ' + groupe.index + ', ' + groupe.nombre + ' attendus';
      }
      return null;
    `) as (attendu: ControlePlateau) => string | null,
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
    await page.goto(`${serveur.url}/tv?planche=1`, { waitUntil: 'domcontentloaded' });
    await page.locator('.planche-chiffres').first().waitFor({ timeout: 20000 });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(captures, '00-polices.png'), fullPage: true });
    await page.goto(`${serveur.url}/tv?debug=1&vitesse=2`, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-connecte="1"]').waitFor({ timeout: 20000 });
    await page.evaluate(() => document.fonts.ready);
    const hote = await connecter(serveur.url, 'hote', { codeHote: CODE_HOTE });
    sockets.push(hote);
    const fiches = [
      { pseudo: 'Maximilien-Alexandre', avatar: 'soleil' },
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
    await page.getByText('Maximilien-Alexandre').first().waitFor({ timeout: 20000 });
    await page.locator('.flip-inner.revele').nth(3).waitFor({ timeout: 20000 });
    await page.waitForTimeout(500);
    await verifierRendu(page);
    await page.screenshot({ path: path.join(captures, '15-accueil.png') });
    await agirHote({ type: 'choisirEcranTv', ecran: 'scores' });
    await page.locator('[data-ecran="scores"]').waitFor({ timeout: 20000 });
    await verifierRendu(page);
    await page.screenshot({ path: path.join(captures, '16-scores.png') });
    await agirHote({ type: 'demarrerCourse' });
    const course = serveur.etat().course;
    if (!course) throw new Error('Course absente');
    const nombreCases = course.regles.longueur + 1;
    await page.waitForFunction((attendu) => document.querySelectorAll('[data-case]').length === attendu, nombreCases, { timeout: 20000 });
    await page.waitForFunction(() => window.__fileVide === true, undefined, { timeout: 20000 });
    await verifierPlateau(page, { nombreCases, groupe: { index: 0, nombre: 4 } });
    await verifierTextes(page);
    await verifierRendu(page);
    await page.screenshot({ path: path.join(captures, '01-depart.png') });
    await page.screenshot({ path: path.join(captures, '12-plateau-pixel.png') });

    await agirHote({ type: 'nouveauTour' });
    await page.getByText('Inès choisit le mini-jeu').waitFor({ timeout: 20000 });
    const choix = await texteEntete(page);
    if (!choix.includes('Inès') || choix.includes('Un joueur')) throw new Error(`En-tête du choix : ${choix}`);
    await page.screenshot({ path: path.join(captures, '05-minijeu.png') });
    await agirHote({ type: 'choisirMiniJeu', id: 'pong-gobelets' });
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
    await agirHote({ type: 'choisirMiniJeu', id: 'pong-gobelets' });
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

    const attendreFile = () => page.waitForFunction(() => window.__fileVide === true, undefined, { timeout: 20000 });
    for (let essai = 0; essai < 6; essai += 1) {
      if (serveur.etat().course?.phase !== 'deplacements') break;
      await agirHote({ type: 'passerJoueur' });
      await attendreFile();
    }
    await agirHote({ type: 'nouveauTour' });
    await attendreFile();
    await agirHote({ type: 'afficherGrille' });
    await page.waitForSelector('[data-ecran="grille"] [data-joue="1"]', { timeout: 20000 });
    await page.screenshot({ path: path.join(captures, '06-grille.png') });
    await page.screenshot({ path: path.join(captures, '13-grille-pixel.png') });
    await verifierZone(page, 'grille');
    await verifierTextes(page);
    await verifierRendu(page);
    await agirHote({ type: 'choisirMiniJeu', id: 'mime-express' });
    await agirHote({ type: 'afficherGrille' });
    await page.waitForSelector('[data-ecran="regles"]', { timeout: 20000 });
    await page.screenshot({ path: path.join(captures, '07-regles.png') });
    await page.screenshot({ path: path.join(captures, '14-regles-pixel.png') });
    await verifierZone(page, 'regles');
    await verifierTextes(page);
    await verifierRendu(page);
    await agirHote({ type: 'demarrerMinuteur', duree: 8, libelle: 'Mime express' });
    await page.waitForSelector('[data-alerte="1"]', { timeout: 20000 });
    await page.screenshot({ path: path.join(captures, '08-minuteur.png') });
    await verifierTextes(page);
    await verifierRendu(page);
    const autres = joueurs
      .filter((joueur) => joueur.joueurId !== ines.joueurId && joueur.joueurId !== noe.joueurId)
      .map((joueur) => joueur.joueurId);
    const podium = (async () => {
      await page.waitForSelector('[data-ecran="podium"]', { timeout: 20000 });
      await verifierZone(page, 'podium');
      await verifierTextes(page);
      await verifierRendu(page);
      await page.screenshot({ path: path.join(captures, '09-podium.png') });
    })();
    await agirHote({
      type: 'validerResultats',
      saisie: {
        mode: 'equipes',
        equipeA: [ines.joueurId, noe.joueurId],
        equipeB: autres,
        gagnante: 'A',
      },
    });
    await podium;
    await attendreFile();
    await agirHote({ type: 'passerAuxDeplacements' });
    for (let essai = 0; essai < 6; essai += 1) {
      if (serveur.etat().course?.phase !== 'deplacements') break;
      await agirHote({ type: 'passerJoueur' });
      await attendreFile();
    }
    await agirHote({ type: 'nouveauTour' });
    await attendreFile();
    await agirHote({ type: 'choisirMiniJeu', id: 'poker' });
    await page.waitForSelector('[data-ecran="poker"]', { timeout: 20000 });
    await page.screenshot({ path: path.join(captures, '10-poker.png') });
    await page.screenshot({ path: path.join(captures, '11-poker-combinaisons.png') });
    await verifierZone(page, 'poker');
    await verifierCombinaisons(page);
    await verifierTextes(page);
    await verifierRendu(page);
    const suiteChrono = await page.evaluate(() => window.__chronologieAnimations ?? []);
    for (let index = 0; index < suiteChrono.length - 1; index += 1) {
      const courant = suiteChrono[index];
      const suivant = suiteChrono[index + 1];
      if (!courant || !suivant) continue;
      if (courant.fin > suivant.debut + 5) {
        throw new Error(`Chevauchement entre ${courant.etape} et ${suivant.etape}`);
      }
    }

    await page.addStyleTag({
      content: '.liste-combi { height: 48px !important; grid-template-rows: repeat(5, 8px) !important; }',
    });
    let combinaisonCassee = false;
    try {
      await verifierCombinaisons(page);
    } catch (erreur) {
      combinaisonCassee = true;
      if (!(erreur instanceof Error) || !erreur.message.startsWith('Combinaisons')) {
        throw erreur;
      }
    }
    if (!combinaisonCassee) throw new Error('Une mise en page cassée des combinaisons aurait dû échouer');
    console.log('OK     Une mise en page cassée est refusée');

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
