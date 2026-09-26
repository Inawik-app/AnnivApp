import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';
import { portionsRoue } from '../shared/roue';
import { lireRoue } from '../server/course-config';
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
        const motCarte = el.classList.contains('mot-tv') || el.closest('.mot-tv');
        const surFace = el.classList.contains('libelle-paco') || el.closest('.face-de');
        const min = dansCombi ? 28 : el.classList.contains('numero-case') ? 24 : surFace ? 16 : motCarte ? 32 : 36;
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
      const ecranPlateau = document.querySelector('[data-ecran="plateau"]');
      const remplir = panneau instanceof HTMLElement && montre(panneau) && !(ecranPlateau instanceof HTMLElement && montre(ecranPlateau));
      if (remplir && panneau instanceof HTMLElement) {
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
      }
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
      const parents = document.querySelectorAll('.plateau-scene, .ecran-poker, .poker-gauche, .accueil, .podium, .ecran-topten, .topten-cartes, .topten-rangees, .ecran-jeopardy, .jeopardy-grille, .ecran-undercover, .undercover-ordre, .undercover-mots, .ecran-codenames, .codenames-grille, .ecran-perudo, .perudo-corps');
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

async function attendreAnimations(page: Page, selecteur: string): Promise<void> {
  await page.waitForFunction(
    new Function('selecteur', `
      const racine = document.querySelector(selecteur);
      if (!(racine instanceof HTMLElement) || !racine.getAnimations) return true;
      return racine.getAnimations({ subtree: true }).every((animation) => animation.playState !== 'running');
    `) as (selecteur: string) => boolean,
    selecteur,
    { timeout: 20000 },
  );
}

async function verifierTopTen(page: Page): Promise<void> {
  await attendreAnimations(page, '[data-zone="topten"]');
  await verifierZone(page, 'topten');
  await verifierTextes(page);
  await verifierRendu(page);
  const erreur = await page.evaluate(
    new Function(`
      const chiffres = document.querySelectorAll('.chiffre-carte, .gp-total, .podium-gp');
      for (let i = 0; i < chiffres.length; i += 1) {
        const el = chiffres[i];
        if (!(el instanceof HTMLElement) || !(el.textContent || '').trim()) continue;
        if (Number.parseFloat(getComputedStyle(el).fontSize) < 90) return 'chiffre clé trop petit : ' + el.className;
      }
      return '';
    `) as () => string,
  );
  if (erreur) throw new Error(`Top Ten : ${erreur}`);
}

async function verifierModule(page: Page, zone: string): Promise<void> {
  await attendreAnimations(page, `[data-zone="${zone}"]`);
  await verifierZone(page, zone);
  await verifierTextes(page);
  await verifierRendu(page);
  const erreur = await page.evaluate(
    new Function(`
      const chiffres = document.querySelectorAll('.jeopardy-case, .podium-gp, .jeopardy-nom, .undercover-mot-texte');
      for (let i = 0; i < chiffres.length; i += 1) {
        const el = chiffres[i];
        if (!(el instanceof HTMLElement) || !(el.textContent || '').trim()) continue;
        if (Number.parseFloat(getComputedStyle(el).fontSize) < 90) return 'élément clé trop petit : ' + el.className;
      }
      return '';
    `) as () => string,
  );
  if (erreur) throw new Error(`${zone} : ${erreur}`);
}

async function verifierFondPlateau(page: Page): Promise<void> {
  const erreur = await page.evaluate(
    new Function(`
      const scene = document.querySelector('.scene');
      if (!(scene instanceof HTMLElement)) return 'scène absente';
      const sceneBox = scene.getBoundingClientRect();
      const bande = sceneBox.width * 0.12;
      const gauche = sceneBox.left + bande;
      const droite = sceneBox.right - bande;
      const rect = (el) => el.getBoundingClientRect();
      function alphaFond(el) {
        const style = getComputedStyle(el);
        if (style.visibility === 'hidden' || style.display === 'none' || Number.parseFloat(style.opacity) === 0) return 0;
        const bg = style.backgroundColor || '';
        const trouve = bg.match(/rgba?\\(([^)]+)\\)/);
        if (!trouve) return 0;
        const morceaux = trouve[1].split(',');
        if (morceaux.length < 4) return 1;
        return Number.parseFloat(morceaux[3] || '1');
      }
      const noeuds = document.querySelectorAll('.plateau-scene *');
      for (let i = 0; i < noeuds.length; i += 1) {
        const el = noeuds[i];
        if (!(el instanceof HTMLElement)) continue;
        if (el.closest('.colonne-fiches, .colonne-droite')) continue;
        if (alphaFond(el) <= 0.15) continue;
        const boite = rect(el);
        if (boite.width < 1 || boite.height < 1) continue;
        const dansGauche = boite.left < gauche - 1 && boite.right > sceneBox.left + 1;
        const dansDroite = boite.right > droite + 1 && boite.left < sceneBox.right - 1;
        if (dansGauche || dansDroite) return 'élément opaque dans la bande latérale : ' + String(el.className).slice(0, 40);
      }
      const couverts = document.querySelectorAll('.fiche-socle, .cagnotte-colonne > .socle-pixel, .entete-plateau, .case-plateau');
      let surface = 0;
      for (let i = 0; i < couverts.length; i += 1) {
        const el = couverts[i];
        if (!(el instanceof HTMLElement)) continue;
        const boite = rect(el);
        if (boite.width < 1 || boite.height < 1) continue;
        surface += boite.width * boite.height;
      }
      const part = surface / (sceneBox.width * sceneBox.height);
      if (part > 0.65) return 'panneaux et cases couvrent ' + Math.round(part * 100) + '% de l\\'écran';
      const fiches = document.querySelectorAll('.fiche-joueur');
      if (fiches.length < 4) return 'fiches absentes';
      for (let i = 0; i < fiches.length; i += 1) {
        const fiche = fiches[i];
        if (!(fiche instanceof HTMLElement)) continue;
        const boite = rect(fiche);
        if (boite.height >= 130) return 'fiche trop haute : ' + Math.round(boite.height);
        if (boite.width >= 400) return 'fiche trop large : ' + Math.round(boite.width);
        const image = fiche.querySelector('.avatar [data-icone], .avatar');
        if (!(image instanceof HTMLElement)) return 'avatar absent de la fiche';
        const cote = rect(image);
        if (cote.width < 63 || cote.height < 63) return 'avatar de fiche trop petit : ' + Math.round(cote.width) + 'x' + Math.round(cote.height);
      }
      const pile = document.querySelector('.colonne-fiches');
      if (pile instanceof HTMLElement && rect(pile).height > sceneBox.height * 0.5) {
        return 'pile de fiches trop haute : ' + Math.round(rect(pile).height);
      }
      const margeX = sceneBox.width * 0.05;
      const margeY = sceneBox.height * 0.05;
      let hautFiches = Infinity;
      let gaucheFiches = Infinity;
      for (let i = 0; i < fiches.length; i += 1) {
        const boite = rect(fiches[i]);
        hautFiches = Math.min(hautFiches, boite.top);
        gaucheFiches = Math.min(gaucheFiches, boite.left);
      }
      if (Math.abs(gaucheFiches - sceneBox.left - 16) > 6 || Math.abs(hautFiches - sceneBox.top - 16) > 6) {
        return 'fiches hors du coin haut gauche : ' + Math.round(gaucheFiches - sceneBox.left) + ',' + Math.round(hautFiches - sceneBox.top);
      }
      const cagnotte = document.querySelector('.cagnotte-colonne .tuile');
      if (!(cagnotte instanceof HTMLElement)) return 'cagnotte absente';
      const coinDroit = rect(cagnotte);
      if (Math.abs(sceneBox.right - margeX - coinDroit.right) > 12 || Math.abs(coinDroit.top - sceneBox.top - margeY) > 12) {
        return 'cagnotte hors du coin haut droit : ' + Math.round(sceneBox.right - coinDroit.right) + ',' + Math.round(coinDroit.top - sceneBox.top);
      }
      if (rect(cagnotte).height >= 140) return 'cagnotte trop haute : ' + Math.round(rect(cagnotte).height);
      const cases = document.querySelectorAll('.case-plateau');
      if (cases.length < 1) return 'aucune case';
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (let i = 0; i < cases.length; i += 1) {
        const tuile = cases[i];
        if (!(tuile instanceof HTMLElement)) continue;
        const icone = tuile.querySelector('.icone');
        const numero = tuile.querySelector('.numero-case');
        if (!(icone instanceof HTMLElement) || !(numero instanceof HTMLElement)) return 'case sans icône ou numéro';
        const boite = rect(tuile);
        const boiteIcone = rect(icone);
        const boiteNumero = rect(numero);
        if (boiteIcone.height + 0.5 < boiteNumero.height * 2) return 'l\\'icône n\\'est pas deux fois plus haute que le numéro';
        const seTouchent = boiteIcone.left < boiteNumero.right - 1 && boiteIcone.right > boiteNumero.left + 1 && boiteIcone.top < boiteNumero.bottom - 1 && boiteIcone.bottom > boiteNumero.top + 1;
        if (seTouchent) return 'le numéro recouvre l\\'icône';
        if (boiteIcone.top < boite.top - 1 || boiteIcone.bottom > boite.bottom + 1 || boiteIcone.left < boite.left - 1 || boiteIcone.right > boite.right + 1) return 'l\\'icône est rognée';
        minX = Math.min(minX, boite.left);
        maxX = Math.max(maxX, boite.right);
        minY = Math.min(minY, boite.top);
        maxY = Math.max(maxY, boite.bottom);
      }
      if ((maxX - minX) / sceneBox.width > 0.43) return 'le plateau dépasse 43 % de la largeur';
      if ((maxY - minY) / sceneBox.height > 0.8) return 'le plateau dépasse 80 % de la hauteur';
      return '';
    `) as () => string,
  );
  if (erreur) throw new Error(`Fond plateau : ${erreur}`);
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

/** Le déplacement FLIP démarre à l'image suivante : attendre des fiches sans décalage et immobiles. */
async function attendreFichesPosees(page: Page): Promise<void> {
  let precedent = '';
  let stables = 0;
  const limite = Date.now() + 20000;
  while (stables < 3) {
    if (Date.now() > limite) throw new Error('Les fiches ne se posent pas');
    const etat = await page.evaluate(
      new Function(`
        const socles = document.querySelectorAll('.fiche-socle');
        const morceaux = [];
        for (let i = 0; i < socles.length; i += 1) {
          const el = socles[i];
          if (!(el instanceof HTMLElement)) continue;
          const matrice = new DOMMatrix(getComputedStyle(el).transform === 'none' ? undefined : getComputedStyle(el).transform);
          if (Math.abs(matrice.m41) > 0.5 || Math.abs(matrice.m42) > 0.5) return 'mouvement';
          const boite = el.getBoundingClientRect();
          morceaux.push(Math.round(boite.left) + ',' + Math.round(boite.top));
        }
        return morceaux.join('|');
      `) as () => string,
    );
    if (etat !== 'mouvement' && etat === precedent) stables += 1;
    else stables = 0;
    precedent = etat;
    await page.waitForTimeout(100);
  }
}

async function verifierIcones(page: Page, mode: 'plateau' | 'grille'): Promise<void> {
  const erreur = await page.evaluate(
    new Function('mode', `
      const replis = document.querySelectorAll('[data-repli]');
      if (replis.length > 0) return 'une icône est en repli';
      function visibles(selecteur) {
        const noeuds = document.querySelectorAll(selecteur);
        for (let i = 0; i < noeuds.length; i += 1) {
          const el = noeuds[i];
          if (!(el instanceof HTMLElement)) continue;
          const boite = el.getBoundingClientRect();
          if (boite.width < 16 || boite.height < 16) return 'icone invisible : ' + (el.getAttribute('data-icone') || '');
        }
        return '';
      }
      if (mode === 'plateau') {
        const pions = [];
        const noeudsPions = document.querySelectorAll('.pion [data-icone]');
        for (let i = 0; i < noeudsPions.length; i += 1) {
          const nom = noeudsPions[i].getAttribute('data-icone');
          if (nom) pions.push(nom);
        }
        const fiches = [];
        const noeudsFiches = document.querySelectorAll('.fiche-joueur .avatar');
        for (let i = 0; i < noeudsFiches.length; i += 1) {
          const nom = noeudsFiches[i].getAttribute('data-icone');
          if (nom) fiches.push(nom);
        }
        if (pions.length !== 4 || new Set(pions).size !== 4) return 'pions ' + pions.join(',');
        if (fiches.length !== 4 || new Set(fiches).size !== 4) return 'fiches ' + fiches.join(',');
        if (document.querySelectorAll('.case-plateau [data-icone]').length < 9) return 'cases sans icône';
        if (!document.querySelector('[data-zone="cagnotte"] [data-icone="gp-piece"]')) return 'cagnotte sans pièce';
        const manque = visibles('.pion [data-icone], .fiche-joueur .avatar, .case-plateau [data-icone], [data-zone="cagnotte"] [data-icone]');
        if (manque) return manque;
      }
      if (mode === 'grille') {
        if (document.querySelectorAll('.tuile-mini [data-icone]').length < 6) return 'grille sans icônes';
        const manque = visibles('.tuile-mini [data-icone]');
        if (manque) return manque;
      }
      return '';
    `) as (mode: string) => string,
    mode,
  );
  if (erreur) throw new Error(`Icônes : ${erreur}`);
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
        const pseudos = [...fiche.querySelectorAll('.pseudo-fiche')].filter((el) => el instanceof HTMLElement);
        if (pseudos.length === 0) return "Une fiche n'a pas de pseudo";
        const texte = pseudos.map((el) => el.textContent || '').join('');
        for (const pseudo of pseudos) {
          const boite = rect(pseudo);
          if (boite.width <= 0 || boite.height <= 0) return 'Un pseudo a une largeur nulle';
          if (!dedans(boite, rect(fiche))) return 'Le pseudo sort de sa fiche';
        }
        if (texte.indexOf('Maximilien-Alexandre') >= 0) {
          pseudoLong = true;
          for (const pseudo of pseudos) {
            if (pseudo.scrollWidth > pseudo.clientWidth + 1) return 'Le pseudo long est tronqué';
          }
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

/** Position et taille de chaque case : elles ne doivent pas bouger quand l'en-tête change. */
async function formatPlateau(page: Page): Promise<string> {
  return page.evaluate(`(() => [...document.querySelectorAll('[data-case]')].map((el) => {
    const boite = el.getBoundingClientRect();
    return [boite.left, boite.top, boite.width, boite.height].map(Math.round).join(',');
  }).join(' '))()`);
}

async function verifierFormatPlateau(page: Page, reference: string, moment: string): Promise<void> {
  const format = await formatPlateau(page);
  if (format !== reference) throw new Error(`Le plateau change de format ${moment} : ${reference} devient ${format}`);
}

async function capturesDesEtRoue(browser: Browser, captures: string): Promise<void> {
  const { serveur, dossier } = await ouvrirServeur({
    desForces: [2, 3, 4],
    tiragesForces: { cartes: ['tournee', 'en-avant'], roue: ['jackpot'] },
    disposition: ['depart', 'bonus', 'malchance', 'gamble', 'chance', 'arrivee'],
  }, true);
  const sockets: Participant[] = [];
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const telephone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    const hote = await connecter(serveur.url, 'hote', { codeHote: CODE_HOTE });
    sockets.push(hote);
    const agirHote = async (action: Action) => {
      const reponse = await agir(hote, action);
      if (!reponse.ok) throw new Error(reponse.erreur);
    };
    const fiches = [
      { pseudo: 'Lina', avatar: 'perso-planete' },
      { pseudo: 'Inès', avatar: 'perso-verre-eau' },
      { pseudo: 'Noé', avatar: 'perso-piment' },
    ];
    const joueurs: Participant[] = [];
    for (const fiche of fiches) {
      const joueur = await connecter(serveur.url, 'joueur');
      sockets.push(joueur);
      const reponse = await agir(joueur, { type: 'rejoindre', pseudo: fiche.pseudo, avatar: fiche.avatar });
      if (!reponse.ok || !reponse.joueurId || !reponse.jeton) throw new Error(reponse.ok ? 'Joueur sans id' : reponse.erreur);
      joueur.joueurId = reponse.joueurId;
      joueur.jeton = reponse.jeton;
      joueur.pseudo = fiche.pseudo;
      joueurs.push(joueur);
      await agirHote({ type: 'ajouterGP', joueurId: joueur.joueurId, montant: 30, libelle: 'Départ' });
    }
    const ines = joueurs.find((joueur) => joueur.pseudo === 'Inès');
    const noe = joueurs.find((joueur) => joueur.pseudo === 'Noé');
    const lina = joueurs.find((joueur) => joueur.pseudo === 'Lina');
    if (!ines?.jeton || !noe || !lina) throw new Error('Inès, Noé ou Lina est absent');
    await agirHote({ type: 'demarrerCourse' });
    if (serveur.etat().course?.ordre[0] !== ines.joueurId) throw new Error('Inès devrait lancer en premier');
    await agirHote({ type: 'nouveauTour' });
    await agirHote({ type: 'choisirMiniJeu', id: 'poker' });
    await agirHote({ type: 'passerAuxDeplacements' });

    await page.goto(`${serveur.url}/tv?debug=1&vitesse=2`, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-connecte="1"]').waitFor({ timeout: 20000 });
    await page.getByText('choisit son dé').waitFor({ timeout: 20000 });
    await telephone.addInitScript(`localStorage.setItem('gp-party.jeton', ${JSON.stringify(ines.jeton)});`);
    await telephone.goto(`${serveur.url}/joueur`, { waitUntil: 'domcontentloaded' });
    await telephone.locator('[data-choix-de="1"]').waitFor({ timeout: 20000 });
    if (await telephone.locator('[data-option]').count() !== 3) throw new Error('Les trois dés devraient être proposés');
    const choix = await telephone.locator('[data-choix-de="1"]').innerText();
    if (!choix.includes('Dé normal') || !choix.includes('Dé boosté') || !choix.includes('Super dé')) {
      throw new Error(`Tuiles de dé illisibles : ${choix}`);
    }
    if (await telephone.locator('[data-option="super"] .face-doree').count() !== 2) throw new Error('Les faces 7 et 8 devraient être dorées');
    await telephone.locator('[data-option="normal"] img[data-icone="de"]').waitFor({ timeout: 20000 });
    await telephone.locator('[data-option="booste"] img[data-icone="de-dore"]').waitFor({ timeout: 20000 });
    await telephone.locator('[data-option="super"] img[data-icone="super-de"]').waitFor({ timeout: 20000 });
    if (await telephone.locator('[data-choix-de="1"] [data-repli]').count() > 0) throw new Error('Une tuile de dé est en repli');
    await telephone.screenshot({ path: path.join(captures, '27-de-choix.png') });
    await page.locator('[data-zone="entete"] img[data-icone="de"]').waitFor({ timeout: 20000 });
    await page.locator('[data-zone="entete"] img[data-icone="de-dore"]').waitFor({ timeout: 20000 });
    await page.locator('[data-zone="entete"] img[data-icone="super-de"]').waitFor({ timeout: 20000 });
    if (await page.locator('[data-zone="entete"] [data-repli]').count() > 0) throw new Error("L'en-tête du dé est en repli");
    await page.locator('[data-case="2"] img[data-icone="chat-noir"]').waitFor({ timeout: 20000 });
    await page.locator('[data-case="3"] img[data-icone="roue"]').waitFor({ timeout: 20000 });
    if (await page.locator('[data-case="2"] [data-repli], [data-case="3"] [data-repli]').count() > 0) {
      throw new Error('Une case du plateau est en repli');
    }
    await page.locator('[data-case="2"]').screenshot({ path: path.join(captures, '32-case-malchance.png') });
    await page.locator('[data-case="3"]').screenshot({ path: path.join(captures, '33-case-gamble.png') });

    const lancer = await agir(ines, { type: 'lancerDe', option: 'super' });
    if (!lancer.ok) throw new Error(lancer.erreur);
    await page.locator('[data-de="super"]').waitFor({ timeout: 20000 });
    if (await page.locator('[data-de="super"] [data-dore="1"]').count() !== 2) throw new Error('Le super dé devrait montrer 7 et 8 en doré');
    await page.screenshot({ path: path.join(captures, '28-super-de.png') });
    await page.locator('.carte-malchance img[data-icone="chopes"]').waitFor({ timeout: 20000 });
    const carte = await page.locator('.carte-malchance').innerText();
    if (!carte.includes('Tournée générale')) throw new Error(`Carte inattendue : ${carte}`);
    if (await page.locator('.carte-malchance [data-repli]').count() > 0) throw new Error('La carte malchance est en repli');
    await page.screenshot({ path: path.join(captures, '29-malchance.png') });
    await page.screenshot({ path: path.join(captures, '30-tournee.png') });
    await page.waitForFunction(() => window.__fileVide === true, undefined, { timeout: 20000 });

    const second = await agir(noe, { type: 'lancerDe', option: 'normal' });
    if (!second.ok) throw new Error(second.erreur);
    await page.waitForFunction(() => window.__fileVide === true, undefined, { timeout: 20000 });
    const mise = await agir(noe, { type: 'miserRoue', montant: 10 });
    if (!mise.ok) throw new Error(mise.erreur);
    await page.locator('[data-roue="1"]').waitFor({ timeout: 20000 });
    const brut = await page.evaluate(
      new Function(`
        const liste = Array.from(document.querySelectorAll('[data-roue="1"] [data-option]'));
        return liste.map((el) => el.getAttribute('data-option') + '=' + el.getAttribute('data-angle')).join('|');
      `) as () => string,
    );
    const mesures = brut.split('|').filter(Boolean).map((entree) => {
      const [id, angle] = entree.split('=');
      return { id: id ?? '', angle: Number(angle) };
    });
    const roue = lireRoue(process.cwd());
    const attendus = new Map(portionsRoue(roue.options).map((portion) => [portion.id, portion.angle]));
    if (mesures.length !== roue.options.length) throw new Error(`${mesures.length} portions au lieu de ${roue.options.length}`);
    for (const mesure of mesures) {
      const attendu = attendus.get(mesure.id ?? '');
      if (attendu === undefined || Math.abs(mesure.angle - attendu) > 1) {
        throw new Error(`Angle de ${mesure.id ?? '?'} : ${mesure.angle} au lieu de ${attendu ?? 'absent'}`);
      }
    }
    const legende = await page.locator('.roue-legende').innerText();
    if (!legende.includes('Jackpot') || !legende.includes('15')) throw new Error('La légende de la roue est incomplète');
    for (const nom of ['trophee-audacieux', 'parchemin-pacte', 'sac-argent', 'machine-a-sous']) {
      if (await page.locator(`.roue-legende img[data-icone="${nom}"]`).count() !== 1) {
        throw new Error(`La légende n'affiche pas ${nom}`);
      }
    }
    if (await page.locator('.roue-legende img[data-icone]').count() !== 4) throw new Error('La légende devrait montrer quatre icônes');
    if (await page.locator('.roue-legende [data-repli], [data-roue="1"] [data-repli]').count() > 0) throw new Error('La roue est en repli');
    await page.screenshot({ path: path.join(captures, '31-roue.png') });
    await page.locator('.carte-effet img[data-icone="machine-a-sous"]').waitFor({ timeout: 20000 });
    if (await page.locator('.carte-effet [data-repli]').count() > 0) throw new Error('Le bandeau de la roue est en repli');
    await page.waitForFunction(() => window.__fileVide === true, undefined, { timeout: 20000 });

    const troisieme = await agir(lina, { type: 'lancerDe', option: 'normal' });
    if (!troisieme.ok) throw new Error(troisieme.erreur);
    await page.locator('.carte-effet img[data-icone="botte-ailee"]').waitFor({ timeout: 20000 });
    const chance = await page.locator('.carte-effet').innerText();
    if (!chance.includes('En avant')) throw new Error(`Carte chance inattendue : ${chance}`);
    if (await page.locator('.carte-effet [data-repli]').count() > 0) throw new Error('La carte chance est en repli');
    await page.screenshot({ path: path.join(captures, '34-chance.png') });
    console.log('OK     Dés, cases, cartes et roue');
  } finally {
    await telephone.close();
    await page.close();
    await fermerSession({ serveur, dossier, sockets: sockets.map((participant) => participant.socket) });
  }
}

async function capturesFinale(browser: Browser, captures: string): Promise<void> {
  const { serveur, dossier } = await ouvrirServeur({
    desForces: [2, 2, 2],
    disposition: ['depart', 'bonus', 'arrivee'],
  }, true);
  const sockets: Participant[] = [];
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const telephone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    const hote = await connecter(serveur.url, 'hote', { codeHote: CODE_HOTE });
    sockets.push(hote);
    const agirHote = async (action: Action) => {
      const reponse = await agir(hote, action);
      if (!reponse.ok) throw new Error(reponse.erreur);
    };
    const fiches = [
      { pseudo: 'Lina', avatar: 'perso-planete', montant: 30 },
      { pseudo: 'Inès', avatar: 'perso-verre-eau', montant: 50 },
      { pseudo: 'Noé', avatar: 'perso-piment', montant: 40 },
    ];
    const joueurs: Participant[] = [];
    for (const fiche of fiches) {
      const joueur = await connecter(serveur.url, 'joueur');
      sockets.push(joueur);
      const reponse = await agir(joueur, { type: 'rejoindre', pseudo: fiche.pseudo, avatar: fiche.avatar });
      if (!reponse.ok || !reponse.joueurId || !reponse.jeton) throw new Error(reponse.ok ? 'Joueur sans id' : reponse.erreur);
      joueur.joueurId = reponse.joueurId;
      joueur.jeton = reponse.jeton;
      joueur.pseudo = fiche.pseudo;
      joueurs.push(joueur);
      await agirHote({ type: 'ajouterGP', joueurId: joueur.joueurId, montant: fiche.montant, libelle: 'Départ' });
    }
    const ines = joueurs.find((joueur) => joueur.pseudo === 'Inès');
    const noe = joueurs.find((joueur) => joueur.pseudo === 'Noé');
    const lina = joueurs.find((joueur) => joueur.pseudo === 'Lina');
    if (!ines?.jeton || !noe || !lina) throw new Error('Joueurs absents');
    await agirHote({ type: 'demarrerCourse' });
    if (serveur.etat().course?.ordre[0] !== ines.joueurId) throw new Error('Inès devrait passer en premier');
    await agirHote({ type: 'nouveauTour' });
    await agirHote({ type: 'choisirMiniJeu', id: 'poker' });
    await agirHote({ type: 'passerAuxDeplacements' });
    await page.goto(`${serveur.url}/tv?debug=1&vitesse=2`, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-connecte="1"]').waitFor({ timeout: 20000 });
    await telephone.addInitScript(`localStorage.setItem('gp-party.jeton', ${JSON.stringify(ines.jeton)});`);
    await telephone.goto(`${serveur.url}/joueur`, { waitUntil: 'domcontentloaded' });
    const lancer = await agir(ines, { type: 'lancerDe', option: 'normal' });
    if (!lancer.ok) throw new Error(lancer.erreur);
    await page.locator('[data-bandeau="dernier-tour"]').waitFor({ timeout: 20000 });
    await page.waitForFunction(() => window.__fileVide === true, undefined, { timeout: 20000 });
    const bandeau = await page.locator('[data-bandeau="dernier-tour"]').innerText();
    if (!bandeau.includes('Dernier tour !')) throw new Error(`Bandeau inattendu : ${bandeau}`);
    await page.screenshot({ path: path.join(captures, '35-dernier-tour.png') });
    const suiteNoe = await agir(noe, { type: 'lancerDe', option: 'normal' });
    if (!suiteNoe.ok) throw new Error(suiteNoe.erreur);
    const suiteLina = await agir(lina, { type: 'lancerDe', option: 'normal' });
    if (!suiteLina.ok) throw new Error(suiteLina.erreur);
    if (serveur.etat().course?.phase !== 'terminee') throw new Error('La course devrait être terminée');
    if ((serveur.etat().course?.arrivees.length ?? 0) < 2) throw new Error('Plusieurs joueurs devraient être arrivés');
    await agirHote({ type: 'ouvrirPodium' });
    await page.locator('[data-ceremonie="podium"]').waitFor({ timeout: 20000 });
    await page.waitForFunction(() => window.__fileVide === true, undefined, { timeout: 20000 });
    await verifierTextes(page);
    await page.screenshot({ path: path.join(captures, '36-podium-course.png') });
    await telephone.getByText('Regarde la télé !').waitFor({ timeout: 20000 });
    await agirHote({ type: 'tirerTrophees' });
    const secret = await page.locator('[data-ecran="finale"]').innerText();
    if (secret.includes('Le touriste')) throw new Error('Le trophée apparaît avant sa révélation');
    await agirHote({ type: 'revelerTrophee' });
    await page.locator('[data-ceremonie="trophee"][data-phase="gagnants"]').waitFor({ timeout: 20000 });
    await page.waitForFunction(() => window.__fileVide === true, undefined, { timeout: 20000 });
    await verifierTextes(page);
    const trophee = await page.locator('[data-ceremonie="trophee"]').innerText();
    if (!trophee.includes('Le touriste') || !trophee.includes('Lina')) throw new Error(`Trophée inattendu : ${trophee}`);
    await page.screenshot({ path: path.join(captures, '37-trophee.png') });
    while (
      (serveur.etat().course?.ceremonie?.reveles ?? 0) < (serveur.etat().course?.ceremonie?.tirage.length ?? 0)
    ) {
      await agirHote({ type: 'revelerTrophee' });
      await page.waitForFunction(() => window.__fileVide === true, undefined, { timeout: 20000 });
    }
    await agirHote({ type: 'revelerClassement' });
    await page.locator('[data-ceremonie="classement"][data-complet="1"]').waitFor({ timeout: 20000 });
    await page.waitForFunction(() => window.__fileVide === true, undefined, { timeout: 20000 });
    await verifierTextes(page);
    await page.screenshot({ path: path.join(captures, '38-classement.png') });
    await telephone.getByText('Tu es').waitFor({ timeout: 20000 });
    await agirHote({ type: 'revelerGagnant' });
    await page.locator('[data-ceremonie="gagnant"][data-revele="1"]').waitFor({ timeout: 20000 });
    await page.waitForFunction(() => window.__fileVide === true, undefined, { timeout: 20000 });
    await verifierTextes(page);
    const gagnant = await page.locator('[data-ceremonie="gagnant"]').innerText();
    if (!gagnant.includes('remporte le bon de 20 €') || !gagnant.includes('Inès')) throw new Error(`Gagnant inattendu : ${gagnant}`);
    if (await page.locator('[data-ceremonie="gagnant"] img[data-icone="trophee"]').count() < 1) throw new Error('Le trophée du gagnant manque');
    if (await page.locator('[data-ceremonie="gagnant"] img[data-icone="confettis"]').count() < 1) throw new Error('Les confettis manquent');
    await page.screenshot({ path: path.join(captures, '39-gagnant.png') });
    await telephone.locator('[data-celebration="1"]').waitFor({ timeout: 20000 });
    console.log('OK     Dernier tour, podium, trophée, classement et gagnant');
  } finally {
    await telephone.close();
    await page.close();
    await fermerSession({ serveur, dossier, sockets: sockets.map((participant) => participant.socket) });
  }
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
      { pseudo: 'Maximilien-Alexandre', avatar: 'perso-carpe' },
      { pseudo: 'Inès', avatar: 'perso-verre-eau' },
      { pseudo: 'Noé', avatar: 'perso-piment' },
      { pseudo: 'Lina', avatar: 'perso-planete' },
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
    await page.waitForFunction(() => window.__fileVide === true, undefined, { timeout: 20000 });
    await verifierRendu(page);
    await page.screenshot({ path: path.join(captures, '15-accueil.png') });
    await page.goto(`${serveur.url}/tv?debug=1&vitesse=4`, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-connecte="1"]').waitFor({ timeout: 20000 });
    await agirHote({ type: 'choisirEcranTv', ecran: 'presentation' });
    await page.locator('[data-ecran="presentation"]').waitFor({ timeout: 20000 });
    await page.waitForFunction(() => document.querySelector('[data-ecran="presentation"][data-phase="etoiles"]'), undefined, {
      timeout: 10000,
    });
    await page.screenshot({ path: path.join(captures, '52-presentation-etoiles.png') });
    await page.waitForFunction(() => document.querySelector('[data-ecran="presentation"][data-phase="impact"]'), undefined, {
      timeout: 15000,
    });
    await page.screenshot({ path: path.join(captures, '53-presentation-impact.png') });
    await page.waitForFunction(() => document.querySelector('[data-ecran="presentation"][data-phase="reflet"]'), undefined, {
      timeout: 15000,
    });
    await page.screenshot({ path: path.join(captures, '54-presentation-reflet.png') });
    await page.waitForFunction(() => document.querySelector('[data-ecran="presentation"][data-phase="repos"]'), undefined, {
      timeout: 20000,
    });
    await page.screenshot({ path: path.join(captures, '55-presentation-repos.png') });
    const logoHorsMarge = await page.evaluate(() => {
      const logo = document.querySelector('.presentation-logo, .logo-gp') as HTMLElement | null;
      if (!logo) return 'Logo de présentation absent';
      const boite = logo.getBoundingClientRect();
      const marge = 1920 * 0.05;
      if (boite.left < marge - 1 || boite.right > 1920 - marge + 1 || boite.top < 1080 * 0.05 - 1 || boite.bottom > 1080 - 1080 * 0.05 + 1) {
        return `Logo hors marges : ${JSON.stringify(boite)}`;
      }
      return null;
    });
    if (logoHorsMarge) throw new Error(logoHorsMarge);
    const repliPresentation = await page.locator('[data-repli="1"]').count();
    if (repliPresentation > 0) throw new Error(`Icône en repli pendant la présentation : ${repliPresentation}`);
    console.log('OK     Présentation télé (étoiles, impact, reflet, repos)');
    await agirHote({ type: 'choisirEcranTv', ecran: 'accueil' });
    await page.locator('[data-ecran="accueil"]').waitFor({ timeout: 20000 });
    await page.locator('.accueil-logo, .logo-gp').first().waitFor({ timeout: 10000 });
    await page.screenshot({ path: path.join(captures, '56-accueil-logo.png') });
    const logoAccueilHors = await page.evaluate(() => {
      const logo = document.querySelector('.accueil-logo, .accueil .logo-gp') as HTMLElement | null;
      if (!logo) return 'Logo d\'accueil absent';
      const boite = logo.getBoundingClientRect();
      const marge = 1920 * 0.05;
      if (boite.left < marge - 1 || boite.right > 1920 - marge + 1 || boite.top < 1080 * 0.05 - 1 || boite.bottom > 1080 - 1080 * 0.05 + 1) {
        return `Logo d'accueil hors marges : ${JSON.stringify(boite)}`;
      }
      return null;
    });
    if (logoAccueilHors) throw new Error(logoAccueilHors);
    console.log('OK     Accueil avec logo');
    await page.goto(`${serveur.url}/tv?debug=1&vitesse=2`, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-connecte="1"]').waitFor({ timeout: 20000 });
    await page.locator('[data-ecran="accueil"]').waitFor({ timeout: 20000 });
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
    await page.waitForFunction(() => {
      const pions = document.querySelectorAll('.pion, .plan, .fiche-socle');
      for (let i = 0; i < pions.length; i += 1) {
        const pion = pions[i];
        if (!(pion instanceof HTMLElement) || !pion.getAnimations) continue;
        const animations = pion.getAnimations();
        for (let j = 0; j < animations.length; j += 1) {
          if (animations[j]?.playState === 'running') return false;
        }
      }
      return true;
    }, undefined, { timeout: 20000 });
    await attendreFichesPosees(page);
    await verifierPlateau(page, { nombreCases, groupe: { index: 0, nombre: 4 } });
    await verifierTextes(page);
    await verifierRendu(page);
    await verifierIcones(page, 'plateau');
    await verifierFondPlateau(page);
    const panneauAgrandi = await page.addStyleTag({
      content: '.fiche-joueur { min-height: 480px !important; width: 900px !important; }',
    });
    let panneauRefuse = false;
    try {
      await verifierFondPlateau(page);
    } catch (erreur) {
      panneauRefuse = true;
      if (!(erreur instanceof Error) || !erreur.message.startsWith('Fond plateau')) throw erreur;
    }
    await panneauAgrandi.evaluate((balise) => balise.remove());
    if (!panneauRefuse) throw new Error('Un panneau agrandi aurait dû être refusé');
    console.log('OK     Un panneau agrandi est refusé');
    await attendreFichesPosees(page);
    await page.screenshot({ path: path.join(captures, '01-depart.png') });
    await page.screenshot({ path: path.join(captures, '12-plateau-pixel.png') });
    const formatDepart = await formatPlateau(page);

    await agirHote({ type: 'nouveauTour' });
    await page.getByText('Inès choisit le mini-jeu').waitFor({ timeout: 20000 });
    const choix = await texteEntete(page);
    if (!choix.includes('Inès') || choix.includes('Un joueur')) throw new Error(`En-tête du choix : ${choix}`);
    await page.screenshot({ path: path.join(captures, '05-minijeu.png') });
    await agirHote({ type: 'choisirMiniJeu', id: 'poker' });
    await agirHote({ type: 'passerAuxDeplacements' });
    await page.getByText('À Inès de jouer').waitFor({ timeout: 20000 });
    await page.getByText('choisit son dé').waitFor({ timeout: 20000 });
    const mise = await texteEntete(page);
    if (!mise.includes('Inès')) throw new Error(`En-tête du dé : ${mise}`);
    await verifierFormatPlateau(page, formatDepart, 'pendant le choix du dé');

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
    const pendantDe = page.getByText('lance le dé normal').waitFor({ timeout: 20000 })
      .then(() => verifierFormatPlateau(page, formatDepart, 'pendant le dé'));
    const lancer = await agir(ines, { type: 'lancerDe', option: 'normal' });
    if (!lancer.ok) throw new Error(lancer.erreur);
    await pendantDe;
    await saut;
    await verifierFormatPlateau(page, formatDepart, 'après le saut');
    await page.waitForFunction(() => window.__fileVide === true, undefined, { timeout: 20000 });

    const second = await agir(noe, { type: 'lancerDe', option: 'normal' });
    if (!second.ok) throw new Error(second.erreur);
    await page.waitForFunction(() => window.__fileVide === true, undefined, { timeout: 20000 });
    await verifierPlateau(page, { nombreCases, groupe: { index: 3, nombre: 2 } });
    await page.screenshot({ path: path.join(captures, '02-milieu.png') });

    await agirHote({ type: 'passerJoueur' });
    await agirHote({ type: 'passerJoueur' });
    await page.waitForFunction(() => window.__fileVide === true, undefined, { timeout: 20000 });
    await agirHote({ type: 'nouveauTour' });
    await agirHote({ type: 'choisirMiniJeu', id: 'poker' });
    await agirHote({ type: 'passerAuxDeplacements' });
    const arrivee = (async () => {
      await page.waitForFunction(() => window.__etapeCourante?.etape === 'arrivee', undefined, { timeout: 20000 });
      await page.screenshot({ path: path.join(captures, '04-arrivee.png') });
    })();
    const dernier = await agir(ines, { type: 'lancerDe', option: 'normal' });
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
    // L'arrivée a ouvert le dernier tour. On l'annule pour garder la course ouverte pendant les écrans suivants.
    await agirHote({ type: 'annuler' });
    await attendreFile();
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
    await verifierIcones(page, 'grille');
    await verifierZone(page, 'grille');
    await verifierTextes(page);
    await verifierRendu(page);
    await agirHote({ type: 'choisirMiniJeu', id: 'poker' });
    await agirHote({ type: 'afficherGrille' });
    await page.waitForSelector('[data-ecran="poker"]', { timeout: 20000 });
    await page.screenshot({ path: path.join(captures, '10-poker.png') });
    await page.screenshot({ path: path.join(captures, '11-poker-combinaisons.png') });
    await page.screenshot({ path: path.join(captures, '07-regles.png') });
    await page.screenshot({ path: path.join(captures, '14-regles-pixel.png') });
    await verifierZone(page, 'poker');
    await verifierCombinaisons(page);
    await verifierTextes(page);
    await verifierRendu(page);
    await agirHote({ type: 'demarrerMinuteur', duree: 8, libelle: 'Poker' });
    await page.waitForSelector('[data-alerte="1"]', { timeout: 20000 });
    await page.screenshot({ path: path.join(captures, '08-minuteur.png') });
    await verifierTextes(page);
    await verifierRendu(page);
    const tapis: Record<string, number> = {};
    for (const joueur of joueurs) tapis[joueur.joueurId] = 5;
    const podium = (async () => {
      await page.waitForSelector('[data-ecran="podium"]', { timeout: 20000 });
      await verifierZone(page, 'podium');
      await verifierTextes(page);
      await verifierRendu(page);
      await page.screenshot({ path: path.join(captures, '09-podium.png') });
    })();
    await agirHote({ type: 'validerPoker', tapis, tapisHote: 0 });
    await podium;
    await attendreFile();
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

    await agirHote({ type: 'passerAuxDeplacements' });
    for (let essai = 0; essai < 6; essai += 1) {
      if (serveur.etat().course?.phase !== 'deplacements') break;
      await agirHote({ type: 'passerJoueur' });
      await attendreFile();
    }
    await agirHote({ type: 'nouveauTour' });
    await attendreFile();
    await agirHote({ type: 'choisirMiniJeu', id: 'top-ten' });
    await page.waitForSelector('[data-ecran="topten"][data-etape="intro"]', { timeout: 20000 });
    await verifierTopTen(page);
    await agirHote({ type: 'lancerMancheTopTen' });
    await page.waitForSelector('[data-ecran="topten"][data-etape="reponses"]', { timeout: 20000 });
    await verifierTopTen(page);
    const annonce = await page.evaluate(() => document.querySelector('[data-zone="topten"]')?.textContent ?? '');
    const premiere = serveur.etat().course?.topten?.manches[0];
    if (!premiere) throw new Error('Manche de Top Ten absente');
    const pseudoCapten = joueurs.find((joueur) => joueur.joueurId === premiere.captenId)?.pseudo ?? '';
    if (!annonce.includes(premiere.theme.intitule) || !annonce.includes(`Cap'Ten : ${pseudoCapten}`)) {
      throw new Error("Le thème ou le Cap'Ten manque à la télé");
    }
    if (!annonce.includes(`1 = ${premiere.theme.bas} · 10 = ${premiere.theme.haut}`)) throw new Error('Les pôles manquent à la télé');
    await page.screenshot({ path: path.join(captures, '17-topten-theme.png') });
    const croissant = [...premiere.repondants].sort((a, b) => (premiere.numeros[a] ?? 0) - (premiere.numeros[b] ?? 0));
    const [petit, deuxieme, ...fin] = croissant;
    const plusGrand = croissant[3];
    if (!petit || !deuxieme || !plusGrand) throw new Error('Répondants manquants');
    const propose = [deuxieme, petit, ...fin];
    const faux = ((premiere.numeros[petit] ?? 0) % 10) + 1;
    const cachees = page.waitForSelector('[data-revelation="cachees"]', { timeout: 20000 }).then(async () => {
      await attendreAnimations(page, '.topten-rangees');
      const avant = await page.evaluate(() => ({
        retournees: document.querySelectorAll('[data-retournee="1"]').length,
        devinees: document.querySelectorAll('[data-carte="devinee"]').length,
        nomsCaches: Array.from(document.querySelectorAll('[data-carte="bon-ordre"] .nom-carte')).every((el) => !(el.textContent ?? '').trim()),
        marques: document.querySelectorAll('[data-bon-rang="1"], [data-exact="1"]').length,
      }));
      if (avant.retournees !== 0) throw new Error(`${avant.retournees} cartes déjà retournées avant la révélation`);
      if (avant.devinees !== 4) throw new Error(`Rangée « Deviné » : ${avant.devinees} cartes posées au lieu de 4`);
      if (!avant.nomsCaches) throw new Error('La rangée « Bon ordre » montre un nom avant le retournement');
      if (avant.marques !== 0) throw new Error('Bordures vertes ou fonds dorés allumés avant le retournement');
      await page.screenshot({ path: path.join(captures, '18-topten-cartes-cachees.png') });
    });
    await agirHote({
      type: 'validerOrdreTopTen',
      ordre: propose,
      devines: { [plusGrand]: premiere.numeros[plusGrand] ?? null, [petit]: faux },
    });
    await cachees;
    await page.waitForSelector('[data-revelation="fin"]', { timeout: 20000 });
    await attendreAnimations(page, '[data-zone="topten"]');
    const lu = await page.evaluate(() => {
      const zone = document.querySelector('[data-zone="topten"]');
      return {
        rangees: document.querySelectorAll('.topten-rangees').length,
        libelles: Array.from(document.querySelectorAll('.rangee-libelle')).map((el) => (el.textContent ?? '').trim()),
        cartes: Array.from(document.querySelectorAll('.carte-topten')).map((el) => {
          const boite = el.getBoundingClientRect();
          const html = el as HTMLElement;
          return {
            type: html.dataset.carte ?? '',
            id: html.dataset.repondant ?? '',
            numero: html.dataset.numero ?? '',
            bonRang: html.dataset.bonRang === '1',
            exact: el.querySelector('[data-exact="1"]') !== null,
            chiffre: (el.querySelector('.chiffre-carte')?.textContent ?? '').trim(),
            gauche: Math.round(boite.left),
            haut: Math.round(boite.top),
            bas: Math.round(boite.bottom),
          };
        }),
        paires: document.querySelectorAll('.paire-topten, .topten-paires').length + ((zone?.textContent ?? '').includes(' avant ') ? 1 : 0),
        total: document.querySelector('.montant-total')?.textContent ?? '',
        piece: document.querySelector('.gp-total [data-icone="gp-piece"]') !== null,
      };
    });
    const resultat = {
      ...lu,
      cartes: lu.cartes.length,
      devinees: lu.cartes.filter((c) => c.type === 'devinee'),
      bonOrdre: lu.cartes.filter((c) => c.type === 'bon-ordre'),
    };
    if (resultat.rangees !== 1 || resultat.cartes !== 8 || resultat.devinees.length !== 4 || resultat.bonOrdre.length !== 4) {
      throw new Error(`Résultat : ${resultat.cartes} cartes (${resultat.devinees.length} devinées, ${resultat.bonOrdre.length} bon ordre), 2 rangées de 4 attendues`);
    }
    if (resultat.libelles.join('|') !== 'Deviné|Bon ordre') throw new Error(`Libellés des rangées : ${resultat.libelles.join(', ')}`);
    const memeHaut = (cartes: { haut: number }[]) => cartes.every((c) => Math.abs(c.haut - (cartes[0]?.haut ?? 0)) <= 1);
    if (!memeHaut(resultat.devinees) || !memeHaut(resultat.bonOrdre)) throw new Error('Les cartes d\'une rangée ne sont pas alignées');
    if ((resultat.bonOrdre[0]?.haut ?? 0) < Math.max(...resultat.devinees.map((c) => c.bas))) throw new Error('La rangée « Bon ordre » doit être sous « Deviné »');
    resultat.devinees.forEach((c, index) => {
      if (Math.abs(c.gauche - (resultat.bonOrdre[index]?.gauche ?? -99)) > 1) throw new Error(`Colonne ${index + 1} mal alignée`);
    });
    if (resultat.devinees.map((c) => c.id).join('|') !== propose.join('|')) throw new Error('La rangée « Deviné » ne suit pas l\'ordre du Cap\'Ten');
    if (resultat.bonOrdre.map((c) => c.id).join('|') !== croissant.join('|')) throw new Error('La rangée « Bon ordre » n\'est pas triée par numéro');
    const numerosAffiches = resultat.bonOrdre.map((c) => Number(c.numero));
    if (numerosAffiches.some((n, i) => i > 0 && n <= (numerosAffiches[i - 1] ?? 0))) throw new Error(`Bon ordre non croissant : ${numerosAffiches.join(', ')}`);
    const attendusVerts = propose.filter((id, index) => croissant[index] === id);
    const verts = resultat.devinees.filter((c) => c.bonRang).map((c) => c.id);
    if (verts.join('|') !== attendusVerts.join('|') || verts.length !== 2) throw new Error(`Bordures vertes : ${verts.length}, attendues ${attendusVerts.length}`);
    const dores = resultat.devinees.filter((c) => c.exact).map((c) => c.id);
    if (dores.join('|') !== plusGrand) throw new Error(`Fonds dorés : ${dores.length}, seul le numéro exact est attendu`);
    const chiffres = Object.fromEntries(resultat.devinees.map((c) => [c.id, c.chiffre]));
    if (chiffres[petit] !== String(faux) || chiffres[deuxieme] !== '?') throw new Error('Numéro deviné ou « ? » mal affiché');
    if (resultat.paires !== 0) throw new Error('La liste des paires est encore affichée');
    if (resultat.total !== '6GP' || !resultat.piece) throw new Error(`Total affiché « ${resultat.total} », attendu « 6GP » avec la pièce`);
    await verifierTopTen(page);
    await page.screenshot({ path: path.join(captures, '19-topten-resultat.png') });
    for (let manche = 2; manche <= 4; manche += 1) {
      await agirHote({ type: 'lancerMancheTopTen' });
      const courante = serveur.etat().course?.topten?.manches[manche - 1];
      if (!courante) throw new Error(`Manche ${manche} absente`);
      await agirHote({ type: 'validerOrdreTopTen', ordre: courante.repondants, devines: {} });
    }
    await agirHote({ type: 'recapTopTen' });
    await page.waitForSelector('[data-ecran="topten"][data-etape="recap"]', { timeout: 20000 });
    const lignesRecap = await page.evaluate(() => document.querySelectorAll('.topten-bilan li').length);
    if (lignesRecap !== 4) throw new Error(`${lignesRecap} lignes au récapitulatif au lieu de 4`);
    await verifierTopTen(page);
    await page.screenshot({ path: path.join(captures, '20-topten-recap.png') });
    console.log("OK     Top Ten : thème et Cap'Ten, rangée « Deviné » posée, « Bon ordre » trié et retourné, bons rangs en vert, numéros exacts dorés, sans paires, récapitulatif");

    const tourSuivant = async () => {
      await agirHote({ type: 'passerAuxDeplacements' });
      for (let essai = 0; essai < 6; essai += 1) {
        if (serveur.etat().course?.phase !== 'deplacements') break;
        await agirHote({ type: 'passerJoueur' });
        await attendreFile();
      }
      await agirHote({ type: 'nouveauTour' });
      await attendreFile();
    };
    const texteZone = (zone: string) => page.evaluate((cible) => document.querySelector(`[data-zone="${cible}"]`)?.textContent ?? '', zone);
    const pseudoDe = (id: string | null | undefined) => joueurs.find((joueur) => joueur.joueurId === id)?.pseudo ?? '';

    await tourSuivant();
    await agirHote({ type: 'choisirMiniJeu', id: 'jeopardy' });
    await page.waitForSelector('[data-ecran="jeopardy"][data-etape="grille"]', { timeout: 20000 });
    await verifierModule(page, 'jeopardy');
    const jeopardy = () => serveur.etat().course?.jeopardy;
    const choisisseur = jeopardy()?.choisisseurId ?? '';
    await agirHote({ type: 'choisirCaseJeopardy', theme: 1, niveau: 0 });
    await page.waitForSelector('[data-ecran="jeopardy"][data-etape="question"]', { timeout: 20000 });
    await attendreFile();
    await verifierModule(page, 'jeopardy');
    const question = await texteZone('jeopardy');
    if (!question.includes('Quelle est la planète la plus proche du Soleil ?') || !question.includes(pseudoDe(choisisseur))) {
      throw new Error('La question ou le choisisseur manque à la télé');
    }
    if (question.includes('Mercure')) throw new Error('La réponse apparaît sur la télé');
    await page.screenshot({ path: path.join(captures, '22-jeopardy-question.png') });
    await agirHote({ type: 'jugerJeopardy', juste: false });
    const buzzeur = joueurs.find((joueur) => joueur.joueurId !== choisisseur);
    if (!buzzeur) throw new Error('Aucun joueur pour buzzer');
    const buzz = await agir(buzzeur, { type: 'buzzJeopardy' });
    if (!buzz.ok) throw new Error(buzz.erreur);
    await page.waitForSelector(`[data-ecran="jeopardy"] [data-etat="buzz"]`, { timeout: 20000 });
    await attendreFile();
    await verifierModule(page, 'jeopardy');
    const main = await texteZone('jeopardy');
    if (!main.includes(buzzeur.pseudo)) throw new Error('Le nom du joueur qui a buzzé manque à la télé');
    await page.screenshot({ path: path.join(captures, '23-jeopardy-buzz.png') });
    const etapesBuzz = await page.evaluate(() => (window.__chronologieAnimations ?? []).filter((etape) => etape.evenement === 'jeopardy.buzz').length);
    if (etapesBuzz < 1) throw new Error('Le buzz ne passe pas par la file d\'animations');
    await agirHote({ type: 'jugerJeopardy', juste: true });
    await page.waitForSelector('[data-ecran="jeopardy"][data-etape="grille"] [data-jouee="1"]', { timeout: 20000 });
    await attendreFile();
    await verifierModule(page, 'jeopardy');
    const prochain = jeopardy()?.choisisseurId;
    const grilleTexte = await texteZone('jeopardy');
    if (!prochain || !grilleTexte.includes(`Au tour de ${pseudoDe(prochain)}`)) throw new Error('Le prochain choisisseur manque à la télé');
    await page.screenshot({ path: path.join(captures, '21-jeopardy-grille.png') });
    await agirHote({ type: 'terminerJeopardy' });
    await page.waitForSelector('[data-ecran="jeopardy"][data-etape="fin"]', { timeout: 20000 });
    await verifierModule(page, 'jeopardy');
    console.log('OK     Jeopardy : grille et prochain choisisseur, question sans réponse, buzz, récapitulatif');

    await tourSuivant();
    await agirHote({ type: 'choisirMiniJeu', id: 'undercover' });
    await page.waitForSelector('[data-ecran="undercover"][data-etape="intro"]', { timeout: 20000 });
    await verifierModule(page, 'undercover');
    await agirHote({ type: 'lancerMancheUndercover' });
    await page.waitForSelector('[data-ecran="undercover"][data-etape="indices"]', { timeout: 20000 });
    await attendreFile();
    await verifierModule(page, 'undercover');
    const mancheUc = serveur.etat().course?.undercover?.manches[0];
    if (!mancheUc) throw new Error('Manche d\'Undercover absente');
    const ordreAffiche = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.undercover-ordre [data-joueur]')).map((ligne) => (ligne as HTMLElement).dataset.joueur ?? ''),
    );
    if (ordreAffiche.join('|') !== mancheUc.ordreParole.join('|')) throw new Error('L\'ordre de parole affiché diffère');
    const motsCaches = async () => {
      const texte = await page.evaluate(() => document.body.textContent ?? '');
      if (texte.includes(mancheUc.paire.civils) || texte.includes(mancheUc.paire.undercover)) throw new Error('Un mot apparaît sur la télé avant la fin');
    };
    await motsCaches();
    await page.screenshot({ path: path.join(captures, '24-undercover-ordre.png') });
    const civil = mancheUc.ordreParole.find((id) => id !== mancheUc.undercoverId) ?? '';
    await agirHote({ type: 'eliminerUndercover', joueurId: civil });
    await page.waitForSelector('[data-ecran="undercover"][data-revelation="civil"]', { timeout: 20000 });
    await attendreFile();
    await verifierModule(page, 'undercover');
    await motsCaches();
    if (!(await texteZone('undercover')).includes(`${pseudoDe(civil)} était civil`)) throw new Error('La révélation du civil manque');
    await page.screenshot({ path: path.join(captures, '25-undercover-civil.png') });
    await agirHote({ type: 'eliminerUndercover', joueurId: mancheUc.undercoverId });
    await page.waitForSelector('[data-ecran="undercover"][data-revelation="undercover"]', { timeout: 20000 });
    await attendreFile();
    await verifierModule(page, 'undercover');
    await motsCaches();
    if (!(await texteZone('undercover')).includes(`${pseudoDe(mancheUc.undercoverId)} était l'undercover`)) {
      throw new Error('La révélation de l\'undercover manque');
    }
    await page.screenshot({ path: path.join(captures, '26-undercover-revele.png') });
    await agirHote({ type: 'devinerUndercover', trouve: false });
    await page.waitForSelector('[data-ecran="undercover"][data-etape="finie"]', { timeout: 20000 });
    await attendreFile();
    await verifierModule(page, 'undercover');
    const motsFin = await texteZone('undercover');
    if (!motsFin.includes(mancheUc.paire.civils) || !motsFin.includes(mancheUc.paire.undercover)) throw new Error('Les deux mots ne sont pas révélés');
    console.log('OK     Undercover : ordre de parole, civil révélé, undercover révélé, mots cachés jusqu\'à la fin');

    await tourSuivant();
    await agirHote({ type: 'choisirMiniJeu', id: 'codenames' });
    await page.waitForSelector('[data-ecran="codenames"][data-etape="intro"]', { timeout: 20000 });
    await verifierModule(page, 'codenames');
    await agirHote({ type: 'equipesHasardCodenames' });
    const prep = serveur.etat().course?.codenames?.preparation;
    if (!prep) throw new Error('Préparation Codenames absente');
    for (const equipe of ['rouge', 'bleu'] as const) {
      const premier = prep.equipes[equipe][0];
      if (!premier) throw new Error(`Équipe ${equipe} incomplète`);
      await agirHote({ type: 'designerEspionCodenames', equipe, joueurId: premier });
    }
    await agirHote({ type: 'lancerGrilleCodenames' });
    await page.waitForSelector('[data-ecran="codenames"][data-etape="indice"]', { timeout: 20000 });
    await attendreFile();
    await verifierModule(page, 'codenames');
    const motsDansCartes = await page.evaluate(() => {
      const cartes = Array.from(document.querySelectorAll('.carte-tv'));
      if (cartes.length !== 25) return `grille ${cartes.length}`;
      for (const carte of cartes) {
        if (!(carte instanceof HTMLElement)) continue;
        const mot = carte.querySelector('.mot-tv');
        if (!(mot instanceof HTMLElement)) return 'mot absent';
        const cadre = carte.getBoundingClientRect();
        const boite = mot.getBoundingClientRect();
        if (boite.width > cadre.width + 1 || boite.height > cadre.height + 1) {
          return `déborde : ${(mot.textContent ?? '').trim()}`;
        }
        if (boite.left < cadre.left - 1 || boite.right > cadre.right + 1 || boite.top < cadre.top - 1 || boite.bottom > cadre.bottom + 1) {
          return `hors carte : ${(mot.textContent ?? '').trim()}`;
        }
      }
      return '';
    });
    if (motsDansCartes) throw new Error(`Codenames : ${motsDansCartes}`);
    await page.screenshot({ path: path.join(captures, '40-codenames-grille.png') });
    const mancheCn = serveur.etat().course?.codenames?.manches[0];
    if (!mancheCn) throw new Error('Manche Codenames absente');
    const espionCn = mancheCn.espions[mancheCn.equipeCourante];
    const espionPage = joueurs.find((joueur) => joueur.joueurId === espionCn);
    if (!espionPage) throw new Error('Espion Codenames introuvable');
    const indice = await agir(espionPage, { type: 'proposerIndiceCodenames', mot: 'Zzza', nombre: 1 });
    if (!indice.ok) throw new Error(indice.erreur);
    await agirHote({ type: 'validerIndiceCodenames' });
    await page.waitForSelector('[data-ecran="codenames"][data-etape="choix"]', { timeout: 20000 });
    await attendreFile();
    await verifierModule(page, 'codenames');
    if (!(await texteZone('codenames')).includes('Zzza')) throw new Error("L'indice manque à la télé");
    await page.screenshot({ path: path.join(captures, '41-codenames-indice.png') });
    const allie = mancheCn.cartes.findIndex((carte) => carte.couleur === mancheCn.equipeCourante);
    await agirHote({ type: 'retournerMotCodenames', index: allie });
    await page.waitForSelector(`[data-ecran="codenames"] [data-index="${allie}"][data-revelee="1"]`, { timeout: 20000 });
    await attendreFile();
    await page.screenshot({ path: path.join(captures, '42-codenames-carte.png') });
    const assassin = serveur.etat().course?.codenames?.manches[0]?.cartes.findIndex((carte) => carte.couleur === 'assassin' && !carte.revelee) ?? -1;
    if (assassin < 0) throw new Error('Assassin Codenames introuvable');
    // Remettre en mode choix si le tour a basculé
    let couranteCn = serveur.etat().course?.codenames?.manches[0];
    if (couranteCn?.etape === 'indice') {
      const espion2 = couranteCn.espions[couranteCn.equipeCourante];
      const pageEspion2 = joueurs.find((joueur) => joueur.joueurId === espion2);
      if (!pageEspion2) throw new Error('Espion suivant introuvable');
      const reprise = await agir(pageEspion2, { type: 'proposerIndiceCodenames', mot: 'Zzzb', nombre: 1 });
      if (!reprise.ok) throw new Error(reprise.erreur);
      await agirHote({ type: 'validerIndiceCodenames' });
    }
    await agirHote({ type: 'retournerMotCodenames', index: assassin });
    await page.waitForSelector('[data-ecran="codenames"][data-etape="finie"]', { timeout: 20000 });
    await attendreFile();
    await verifierModule(page, 'codenames');
    if ((await page.locator('[data-ecran="codenames"] [data-couleur="assassin"]').count()) < 1) {
      throw new Error('L\'assassin n\'apparaît pas');
    }
    await page.screenshot({ path: path.join(captures, '43-codenames-assassin.png') });
    if ((await page.locator('.codenames-grille[data-cle="1"]').count()) !== 1) throw new Error('La clé finale manque');
    await page.screenshot({ path: path.join(captures, '44-codenames-cle.png') });
    console.log('OK     Codenames : grille, indice, carte, assassin, clé finale');

    await tourSuivant();
    await agirHote({ type: 'choisirMiniJeu', id: 'perudo' });
    await page.waitForSelector('[data-ecran="perudo"][data-etape="regles"]', { timeout: 20000 });
    await verifierModule(page, 'perudo');
    await page.screenshot({ path: path.join(captures, '45-perudo-regles.png') });
    for (const joueur of joueurs) {
      await agirHote({ type: 'lancerDesPerudo', joueurId: joueur.joueurId });
    }
    await page.waitForSelector('[data-ecran="perudo"][data-etape="encheres"]', { timeout: 20000 });
    await attendreFile();
    await verifierModule(page, 'perudo');
    const perudoEtat = () => serveur.etat().course?.perudo;
    const ouvreurId = perudoEtat()?.joueurs[perudoEtat()?.indexCourant ?? 0]?.id;
    const ouvreur = joueurs.find((joueur) => joueur.joueurId === ouvreurId);
    if (!ouvreur) throw new Error('Ouvreur Perudo introuvable');
    const annoncePerudo = await agir(ouvreur, { type: 'annoncerPerudo', nombre: 3, valeur: 5 });
    if (!annoncePerudo.ok) throw new Error(annoncePerudo.erreur);
    await page.waitForSelector('.perudo-annonce-geante', { timeout: 20000 });
    await attendreFile();
    await verifierModule(page, 'perudo');
    await page.screenshot({ path: path.join(captures, '46-perudo-annonce.png') });
    const douteurId = perudoEtat()?.joueurs[perudoEtat()?.indexCourant ?? 0]?.id;
    const douteur = joueurs.find((joueur) => joueur.joueurId === douteurId);
    if (!douteur) throw new Error('Douteur Perudo introuvable');
    const dudo = await agir(douteur, { type: 'dudoPerudo' });
    if (!dudo.ok) throw new Error(dudo.erreur);
    await page.waitForSelector('[data-ecran="perudo"][data-etape="revelation"]', { timeout: 20000 });
    await page.waitForSelector('[data-ecran="perudo"][data-revelation="compte"], [data-ecran="perudo"][data-revelation="verdict"]', {
      timeout: 30000,
    });
    await page.screenshot({ path: path.join(captures, '47-perudo-revelation.png') });
    await page.waitForSelector('.perudo-verdict', { timeout: 30000 });
    await attendreFile();
    await verifierModule(page, 'perudo');
    await page.screenshot({ path: path.join(captures, '48-perudo-verdict.png') });
    console.log('OK     Perudo : règles, annonce, révélation, verdict');

    await tourSuivant();
    await agirHote({ type: 'choisirMiniJeu', id: 'just-one' });
    await page.waitForSelector('[data-ecran="justone"][data-etape="attente"]', { timeout: 20000 });
    await verifierModule(page, 'justone');
    await page.screenshot({ path: path.join(captures, '49-justone-attente.png') });
    await agirHote({ type: 'lancerMancheJustOne' });
    await page.waitForSelector('[data-ecran="justone"][data-etape="indices"]', { timeout: 20000 });
    const mancheJo = () => serveur.etat().course?.justone?.manches.at(-1);
    const couranteJo = mancheJo();
    if (!couranteJo) throw new Error('Manche Just One absente');
    for (const [rang, id] of (serveur.etat().course?.ordre ?? [])
      .filter((joueurId) => joueurId !== couranteJo.devineurId)
      .entries()) {
      const pageJoueur = joueurs.find((joueur) => joueur.joueurId === id);
      if (!pageJoueur) throw new Error('Indiceur Just One introuvable');
      // Deux « Soleil » pour forcer une carte barrée à l'écran.
      const mots = ['Soleil', 'Soleil', 'Pluie', 'Vent'];
      const envoi = await agir(pageJoueur, { type: 'proposerIndiceJustOne', mot: mots[rang]! });
      if (!envoi.ok) throw new Error(envoi.erreur);
    }
    if (couranteJo.devineurId !== 'hote') {
      const hoteIndice = await agir(hote, { type: 'proposerIndiceJustOne', mot: 'Orage' });
      if (!hoteIndice.ok) throw new Error(hoteIndice.erreur);
    }
    await page.waitForSelector('[data-ecran="justone"][data-etape="verification"]', { timeout: 20000 });
    await agirHote({ type: 'revelerIndicesJustOne' });
    await page.waitForSelector('[data-ecran="justone"][data-etape="revelation"]', { timeout: 20000 });
    await attendreFile();
    await verifierModule(page, 'justone');
    await page.screenshot({ path: path.join(captures, '50-justone-indices-barres.png') });
    await agirHote({ type: 'jugerJustOne', issue: 'trouve' });
    await page.waitForSelector('[data-ecran="justone"][data-etape="finie"]', { timeout: 20000 });
    await attendreFile();
    await verifierModule(page, 'justone');
    await page.screenshot({ path: path.join(captures, '51-justone-mot-revele.png') });
    console.log('OK     Just One : attente, indices barrés, mot révélé');

    await capturesDesEtRoue(browser, captures);
    await capturesFinale(browser, captures);

    console.log('OK     Fiches et cagnotte dans les coins, plateau hors des bandes, icône plus grande que le numéro');
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
