import { setAutoFreeze } from 'immer';
import { describe, expect, it } from 'vitest';
import { solde } from '../shared/soldes';
import type { Transaction } from '../shared/types';
import { statistiques } from '../shared/statistiques';
import type { Action, EtatJeu, Origine, TypeCase } from '../shared/types';
import { lireCartesChance, lireCartesMalchance, lireConfigPlateau, lireRoue } from './course-config';
import { etatInitial } from './etat-initial';
import { fusionnerEtat } from './fusion';
import { lireCatalogue, lireJeopardy, lirePoker, lireTopTen, lireCodenames, lirePerudo, lireUndercover, lireJustOne } from './mini-jeux-config';
import { reduire, type ContexteReduction } from './reducteur';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

setAutoFreeze(false);

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const hote: Origine = { role: 'hote' };

function contexte(partiel: Partial<ContexteReduction> = {}): ContexteReduction {
  let n = 0;
  return {
    maintenant: 1_700_000_000_000,
    id: () => `id-${String(++n)}`,
    prochainIdEvenement: 1,
    dev: true,
    nbJoueursMax: 4,
    estEnLigne: () => false,
    alea: () => 0,
    plateau: lireConfigPlateau(RACINE),
    cartes: lireCartesChance(RACINE),
    cartesMalchance: lireCartesMalchance(RACINE),
    roue: lireRoue(RACINE),
    catalogue: lireCatalogue(RACINE),
    poker: lirePoker(RACINE),
    topten: lireTopTen(RACINE),
    jeopardy: lireJeopardy(RACINE),
    undercover: lireUndercover(RACINE),
    codenames: lireCodenames(RACINE),
    perudo: lirePerudo(RACINE),
    justone: lireJustOne(RACINE),
    nomHote: 'Yanis',
    tirerDe: () => 1,
    ...partiel,
  };
}

function jouer(etat: EtatJeu, action: Action, origine: Origine, ctx: ContexteReduction): EtatJeu {
  const resultat = reduire(etat, action, origine, ctx);
  expect(resultat.ok, !resultat.ok ? resultat.erreur : '').toBe(true);
  if (!resultat.ok) throw new Error(resultat.erreur);
  ctx.prochainIdEvenement = resultat.prochainIdEvenement;
  return resultat.etat;
}

function partie(ctx: ContexteReduction, pseudos: string[], montants: number[]): EtatJeu {
  let etat = etatInitial('GP Party');
  const avatars = ['soleil', 'lune', 'feuille', 'goutte'];
  pseudos.forEach((pseudo, index) => {
    etat = jouer(etat, { type: 'rejoindre', pseudo, avatar: avatars[index] ?? 'soleil' }, { role: 'joueur', joueurId: null }, ctx);
  });
  etat.joueurs.forEach((joueur, index) => {
    const montant = montants[index] ?? 0;
    if (montant > 0) etat = jouer(etat, { type: 'ajouterGP', joueurId: joueur.id, montant, libelle: 'Bonus' }, hote, ctx);
  });
  etat = jouer(etat, { type: 'demarrerCourse' }, hote, ctx);
  etat = jouer(etat, { type: 'nouveauTour' }, hote, ctx);
  etat = jouer(etat, { type: 'choisirMiniJeu', id: 'poker' }, hote, ctx);
  etat = jouer(etat, { type: 'passerAuxDeplacements' }, hote, ctx);
  return etat;
}

function identite(max: number): number {
  return max <= 0 ? 0 : max - 1;
}

function poser(etat: EtatJeu, disposition: TypeCase[]): void {
  const course = etat.course;
  if (!course) throw new Error('Pas de course');
  course.disposition = disposition;
  course.regles = { ...course.regles, longueur: disposition.length - 1 };
  course.phase = 'deplacements';
  course.etape = { genre: 'lancer' };
  course.indexCourant = 0;
  course.arrivees = [];
  for (const id of Object.keys(course.positions)) course.positions[id] = 0;
}

function courant(etat: EtatJeu): Origine {
  const course = etat.course;
  const id = course?.ordre[course.indexCourant];
  if (!id) throw new Error('Personne au tour');
  return { role: 'joueur', joueurId: id };
}

function lancer(etat: EtatJeu, ctx: ContexteReduction, option = 'normal'): EtatJeu {
  return jouer(etat, { type: 'lancerDe', option }, courant(etat), ctx);
}

function argent(transactions: Transaction[], id: string): number {
  return solde(transactions, id, 'visibles');
}

function compte(ids: string[]): Map<string, number> {
  const total = new Map<string, number>();
  for (const id of ids) total.set(id, (total.get(id) ?? 0) + 1);
  return total;
}

describe('pioches', () => {
  it('met autant d\'exemplaires que le poids, puis remélange', () => {
    const ctx = contexte({ alea: identite });
    const chance = lireCartesChance(RACINE);
    const malchance = lireCartesMalchance(RACINE);
    expect(chance.reduce((somme, carte) => somme + carte.poids, 0)).toBe(18);
    expect(malchance.reduce((somme, carte) => somme + carte.poids, 0)).toBe(11);
    let etat = partie(ctx, ['Mira', 'Noé'], [30, 30]);
    const id = etat.course!.ordre[0]!;

    const tirer = (famille: 'chance' | 'malchance', tours: number) => {
      const vus: string[] = [];
      for (let index = 0; index < tours; index += 1) {
        poser(etat, ['depart', famille, 'bonus', 'arrivee']);
        etat = lancer(etat, ctx);
        const carte = etat.course?.carteCourante?.carte;
        expect(carte?.famille).toBe(famille);
        if (carte) vus.push(carte.id);
        expect(argent(etat.transactions, id)).toBeGreaterThanOrEqual(0);
      }
      return vus;
    };

    const premier = tirer('chance', 18);
    const attendu = compte(chance.flatMap((carte) => Array.from({ length: carte.poids }, () => carte.id)));
    expect(compte(premier)).toEqual(attendu);
    expect(etat.course?.pioches.chance).toHaveLength(0);
    const suivant = tirer('chance', 1);
    expect(attendu.has(suivant[0]!)).toBe(true);

    const mauvaises = tirer('malchance', 11);
    const poidsMal = compte(malchance.flatMap((carte) => Array.from({ length: carte.poids }, () => carte.id)));
    expect(compte(mauvaises)).toEqual(poidsMal);
  });
});

describe('cartes', () => {
  function socle(montants = [30, 30, 30], carte = 'gain-5', de = 1): { etat: EtatJeu; ctx: ContexteReduction } {
    const ctx = contexte({ alea: identite, tirerDe: () => de, tirerCarte: () => carte });
    const etat = partie(ctx, ['Mira', 'Noé', 'Lina'].slice(0, montants.length), montants);
    return { etat, ctx };
  }

  it('gagne les montants sans quitter la case', () => {
    for (const [id, montant] of [['gain-5', 5], ['gain-8', 8], ['gain-12', 12]] as const) {
      const { etat, ctx } = socle([30, 30], id);
      poser(etat, ['depart', 'chance', 'bonus', 'arrivee']);
      const mira = etat.course!.ordre[0]!;
      const apres = lancer(etat, ctx);
      expect(apres.course?.positions[mira]).toBe(1);
      expect(argent(apres.transactions, mira)).toBe(30 + montant);
      expect(apres.transactions.some((tx) => tx.libelle === 'Case bonus')).toBe(false);
    }
  });

  it('lance un dé normal et crédite le double, sans consommer le dé forcé', () => {
    const appels: number[] = [];
    const { etat, ctx } = socle([30, 30], 'coup-de-des');
    ctx.tirerDe = () => {
      appels.push(1);
      return 1;
    };
    poser(etat, ['depart', 'chance', 'bonus', 'arrivee']);
    const mira = etat.course!.ordre[0]!;
    const apres = lancer(etat, ctx);
    expect(appels).toEqual([1]);
    expect(apres.course?.positions[mira]).toBe(1);
    expect(argent(apres.transactions, mira)).toBe(42);
  });

  it('avance sans déclencher la case d\'arrivée, et une arrivée par carte compte', () => {
    const avant = socle([30, 30], 'en-avant', 1);
    poser(avant.etat, ['depart', 'chance', 'bonus', 'cagnotte', 'arrivee']);
    const mira = avant.etat.course!.ordre[0]!;
    const avance = lancer(avant.etat, avant.ctx);
    expect(avance.course?.positions[mira]).toBe(3);
    expect(avance.transactions.some((tx) => tx.libelle === 'Cagnotte' || tx.libelle === 'Case bonus')).toBe(false);

    const bond = socle([30, 30], 'grand-bond', 1);
    poser(bond.etat, ['depart', 'chance', 'bonus', 'arrivee']);
    const id = bond.etat.course!.ordre[0]!;
    const arrive = lancer(bond.etat, bond.ctx);
    expect(arrive.course?.positions[id]).toBe(3);
    expect(arrive.course?.arrivees).toEqual([id]);
    expect(arrive.transactions.some((tx) => tx.libelle === 'Case bonus')).toBe(false);
  });

  it('recule sans effet de case et s\'arrête à la case 0', () => {
    const glisse = socle([30, 30], 'glissade', 3);
    poser(glisse.etat, ['depart', 'bonus', 'cagnotte', 'malchance', 'arrivee']);
    const mira = glisse.etat.course!.ordre[0]!;
    const apres = lancer(glisse.etat, glisse.ctx);
    expect(apres.course?.positions[mira]).toBe(1);
    expect(apres.transactions.some((tx) => tx.libelle === 'Case bonus' || tx.libelle === 'Cagnotte')).toBe(false);

    const eboul = socle([30, 30], 'eboulement', 2);
    poser(eboul.etat, ['depart', 'bonus', 'malchance', 'bonus', 'arrivee']);
    const id = eboul.etat.course!.ordre[0]!;
    const fond = lancer(eboul.etat, eboul.ctx);
    expect(fond.course?.positions[id]).toBe(0);
    expect(argent(fond.transactions, id)).toBeGreaterThanOrEqual(0);
  });

  it('ne descend pas sous 0 GP', () => {
    const trou = socle([1, 30], 'trou');
    poser(trou.etat, ['depart', 'malchance', 'bonus', 'arrivee']);
    const mira = trou.etat.course!.ordre[0]!;
    const apres = lancer(trou.etat, trou.ctx);
    expect(argent(apres.transactions, mira)).toBe(0);
    expect(apres.course?.cagnotte).toBe(1);

    const poche = socle([4, 30], 'pickpocket');
    poser(poche.etat, ['depart', 'malchance', 'bonus', 'arrivee']);
    const id = poche.etat.course!.ordre[0]!;
    const vole = lancer(poche.etat, poche.ctx);
    expect(argent(vole.transactions, id)).toBe(0);
    expect(vole.course?.cagnotte).toBe(4);
  });

  it('répartit la tournée et met le reste dans la cagnotte', () => {
    const { etat, ctx } = socle([5, 0, 0], 'tournee');
    poser(etat, ['depart', 'malchance', 'bonus', 'arrivee']);
    const [mira, noe, lina] = etat.course!.ordre;
    const apres = lancer(etat, ctx);
    expect(argent(apres.transactions, mira!)).toBe(0);
    expect(argent(apres.transactions, noe!)).toBe(2);
    expect(argent(apres.transactions, lina!)).toBe(2);
    expect(apres.course?.cagnotte).toBe(1);
    const stats = statistiques(apres);
    expect(stats[mira!]?.gpDonnes).toBe(4);
    expect(stats[noe!]?.gpRecus).toBe(2);
    expect(stats[mira!]?.gpMalchance).toBe(5);
  });

  it('encaisse la cotisation de ce que les autres peuvent payer', () => {
    const { etat, ctx } = socle([10, 1, 0], 'cotisation');
    poser(etat, ['depart', 'chance', 'bonus', 'arrivee']);
    const [mira, noe, lina] = etat.course!.ordre;
    const avant = etat.transactions.length;
    const apres = lancer(etat, ctx);
    expect(argent(apres.transactions, mira!)).toBe(11);
    expect(argent(apres.transactions, noe!)).toBe(0);
    expect(argent(apres.transactions, lina!)).toBe(0);
    const nouvelles = apres.transactions.slice(avant);
    const negatives = nouvelles.filter((tx) => tx.montant < 0);
    expect(negatives.every((tx) => tx.source === 'carte' && tx.joueurId !== mira)).toBe(true);
    expect(statistiques(apres)[mira!]?.gpRecus).toBe(1);
  });

  it('touche la part de cagnotte même sans case dans cette direction', () => {
    const or = socle([30, 30], 'raccourci-dore');
    or.ctx.tirerDe = () => 1;
    poser(or.etat, ['depart', 'chance', 'bonus', 'bonus', 'arrivee']);
    const mira = or.etat.course!.ordre[0]!;
    const apres = lancer(or.etat, or.ctx, 'booste');
    expect(apres.course?.positions[mira]).toBe(1);
    expect(apres.course?.cagnotte).toBe(4);
    expect(argent(apres.transactions, mira)).toBe(26);

    const retour = socle([30, 30], 'retour-aux-sources', 4);
    poser(retour.etat, ['depart', 'cagnotte', 'bonus', 'bonus', 'chance', 'arrivee']);
    const id = retour.etat.course!.ordre[0]!;
    const sources = lancer(retour.etat, retour.ctx, 'booste');
    expect(sources.course?.positions[id]).toBe(1);
    expect(sources.course?.cagnotte).toBe(3);
    expect(sources.transactions.filter((tx) => tx.libelle === 'Cagnotte')).toHaveLength(0);

    const faux = socle([30, 30], 'faux-raccourci', 4);
    poser(faux.etat, ['depart', 'cagnotte', 'bonus', 'bonus', 'malchance', 'arrivee']);
    const joueur = faux.etat.course!.ordre[0]!;
    const recul = lancer(faux.etat, faux.ctx, 'booste');
    expect(recul.course?.positions[joueur]).toBe(1);
    expect(recul.course?.cagnotte).toBe(5);
    expect(argent(recul.transactions, joueur)).toBe(25);
  });

  it('laisse les gages sans GP', () => {
    for (const id of ['musique', 'toast', 'anecdote']) {
      const { etat, ctx } = socle([30, 30], id);
      poser(etat, ['depart', 'chance', 'bonus', 'arrivee']);
      const mira = etat.course!.ordre[0]!;
      const apres = lancer(etat, ctx);
      expect(apres.course?.positions[mira]).toBe(1);
      expect(argent(apres.transactions, mira)).toBe(30);
    }
  });
});

describe('ancienne sauvegarde', () => {
  it('remplace une case duel par une case gamble', () => {
    const etat = fusionnerEtat('GP Party', {
      partie: { titre: 'GP Party' },
      joueurs: [],
      transactions: [],
      course: {
        disposition: ['depart', 'duel', 'arrivee'],
        phase: 'deplacements',
        regles: {
          longueur: 2,
          gainBonus: 5,
          choixMiniJeu: 'rotation',
          recompenseArrivee: [0, 0, 0, 0],
          coupDePouce: 'aucun',
          optionsDe: [],
        },
        positions: {},
        pioche: ['cadeau'],
        etape: { genre: 'duel' },
        historique: {
          lancers: [{ tour: 1, joueurId: 'a', valeur: 4, usage: 'deplacement', mise: 4 }],
          effets: [{ type: 'duel' }],
        },
      },
    });
    expect(etat.course?.disposition[1]).toBe('gamble');
    expect(etat.course?.etape).toEqual({ genre: 'lancer' });
    expect(etat.course?.pioches).toEqual({ chance: [], malchance: [] });
    expect(etat.course?.historique.effets).toEqual([]);
    expect(etat.course?.historique.lancers[0]).toMatchObject({ faces: 6, esperance: 3.5, option: null });
    expect(etat.course?.regles.optionsDe.map((option) => option.id)).toEqual(['normal', 'booste', 'super']);
    expect(etat.course?.regles.optionsDe.find((option) => option.id === 'normal')?.icone).toBe('de');
    expect(JSON.stringify(etat.course?.disposition)).not.toContain('duel');
  });
});
