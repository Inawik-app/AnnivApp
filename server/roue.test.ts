import { setAutoFreeze } from 'immer';
import { describe, expect, it } from 'vitest';
import { esperanceMultiplicateur, optionSelonTirage, portionsRoue, renduRoue } from '../shared/roue';
import { solde } from '../shared/soldes';
import type { Transaction } from '../shared/types';
import type { Action, EtatJeu, Origine, TypeCase } from '../shared/types';
import { lireCartesChance, lireCartesMalchance, lireConfigPlateau, lireRoue } from './course-config';
import { etatInitial } from './etat-initial';
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

function refuser(etat: EtatJeu, action: Action, origine: Origine, ctx: ContexteReduction): string {
  const resultat = reduire(etat, action, origine, ctx);
  expect(resultat.ok).toBe(false);
  if (resultat.ok) throw new Error('action acceptée');
  return resultat.erreur;
}

function pret(ctx: ContexteReduction, montants = [30, 30]): EtatJeu {
  let etat = etatInitial('GP Party');
  ['Mira', 'Noé'].forEach((pseudo, index) => {
    etat = jouer(etat, { type: 'rejoindre', pseudo, avatar: index === 0 ? 'soleil' : 'lune' }, { role: 'joueur', joueurId: null }, ctx);
    const montant = montants[index] ?? 0;
    if (montant > 0) etat = jouer(etat, { type: 'ajouterGP', joueurId: etat.joueurs[index]!.id, montant, libelle: 'Bonus' }, hote, ctx);
  });
  etat = jouer(etat, { type: 'demarrerCourse' }, hote, ctx);
  etat = jouer(etat, { type: 'nouveauTour' }, hote, ctx);
  etat = jouer(etat, { type: 'choisirMiniJeu', id: 'poker' }, hote, ctx);
  etat = jouer(etat, { type: 'passerAuxDeplacements' }, hote, ctx);
  return etat;
}

function poser(etat: EtatJeu, disposition: TypeCase[]): void {
  const course = etat.course;
  if (!course) throw new Error('Pas de course');
  course.disposition = disposition;
  course.regles = { ...course.regles, longueur: disposition.length - 1 };
  for (const id of Object.keys(course.positions)) course.positions[id] = 0;
  course.arrivees = [];
  course.phase = 'deplacements';
  course.etape = { genre: 'lancer' };
  course.indexCourant = 0;
  course.cagnotte = 0;
}

function argent(transactions: Transaction[], id: string): number {
  return solde(transactions, id, 'visibles');
}

function joueur(etat: EtatJeu): Origine {
  const id = etat.course?.ordre[etat.course.indexCourant];
  if (!id) throw new Error('Personne au tour');
  return { role: 'joueur', joueurId: id };
}

describe('roue', () => {
  it('somme les probabilités à 100 % et l\'espérance du multiplicateur à 1,06', () => {
    const roue = lireRoue(RACINE);
    expect(roue.options.reduce((somme, option) => somme + option.probabilite, 0)).toBe(100);
    const portions = portionsRoue(roue.options);
    expect(portions.reduce((somme, portion) => somme + portion.angle, 0)).toBeCloseTo(360, 6);
    // 0×15 + 0,5×18 + 1×26 + 1×10 + 1,5×12 + 2×7 + 2×5 + 3×4 + 1×2 + 5×1 = 106, soit 1,06.
    expect(esperanceMultiplicateur(roue.options)).toBeCloseTo(1.06, 8);
    expect(renduRoue(1, 0.5)).toBe(0);
    expect(renduRoue(1, 1.5)).toBe(1);
    expect(renduRoue(10, 5)).toBe(50);
  });

  it('tire chaque option à ±0,5 % sur 100 000 lancers', () => {
    const roue = lireRoue(RACINE);
    let graine = 1;
    const suivant = () => {
      graine = (graine * 1664525 + 1013904223) % 4294967296;
      return graine / 4294967296;
    };
    const comptes = new Map<string, number>();
    for (let index = 0; index < 100_000; index += 1) {
      const option = optionSelonTirage(roue.options, Math.floor(suivant() * 100));
      comptes.set(option.id, (comptes.get(option.id) ?? 0) + 1);
    }
    for (const option of roue.options) {
      const frequence = ((comptes.get(option.id) ?? 0) / 100_000) * 100;
      expect(Math.abs(frequence - option.probabilite)).toBeLessThanOrEqual(0.5);
    }
  });

  it('arrondit à l\'entier inférieur et laisse le reste à la cagnotte', () => {
    const ctx = contexte({ alea: (max) => (max <= 0 ? 0 : max - 1), tirerRoue: () => 'moitie' });
    let etat = pret(ctx, [30, 30]);
    poser(etat, ['depart', 'gamble', 'bonus', 'arrivee']);
    const mira = etat.course!.ordre[0]!;
    etat = jouer(etat, { type: 'lancerDe', option: 'normal' }, joueur(etat), ctx);
    etat = jouer(etat, { type: 'miserRoue', montant: 1 }, joueur(etat), ctx);
    expect(argent(etat.transactions, mira)).toBe(29);
    expect(etat.course?.cagnotte).toBe(1);
    expect(etat.course?.positions[mira]).toBe(1);
  });

  it('fait avancer le turbo sans effet de case, reculer le pacte, et braquer un quart', () => {
    const turbo = contexte({ alea: (max) => (max <= 0 ? 0 : max - 1), tirerDe: () => 1, tirerRoue: () => 'turbo' });
    let etat = pret(turbo);
    poser(etat, ['depart', 'gamble', 'bonus', 'bonus', 'bonus', 'arrivee']);
    const mira = etat.course!.ordre[0]!;
    etat = jouer(etat, { type: 'lancerDe', option: 'normal' }, joueur(etat), turbo);
    etat = jouer(etat, { type: 'miserRoue', montant: 10 }, joueur(etat), turbo);
    expect(etat.course?.positions[mira]).toBe(4);
    expect(etat.transactions.some((tx) => tx.libelle === 'Case bonus')).toBe(false);
    expect(argent(etat.transactions, mira)).toBe(30);

    const pacte = contexte({ alea: (max) => (max <= 0 ? 0 : max - 1), tirerDe: () => 4, tirerRoue: () => 'pacte' });
    etat = pret(pacte);
    poser(etat, ['depart', 'bonus', 'bonus', 'bonus', 'gamble', 'bonus', 'arrivee']);
    const id = etat.course!.ordre[0]!;
    etat = jouer(etat, { type: 'lancerDe', option: 'normal' }, joueur(etat), pacte);
    etat = jouer(etat, { type: 'miserRoue', montant: 10 }, joueur(etat), pacte);
    expect(etat.course?.positions[id]).toBe(1);
    expect(etat.transactions.some((tx) => tx.libelle === 'Case bonus')).toBe(false);
    expect(argent(etat.transactions, id)).toBe(40);

    const braquage = contexte({ alea: (max) => (max <= 0 ? 0 : max - 1), tirerDe: () => 1, tirerRoue: () => 'braquage' });
    etat = pret(braquage, [40, 30]);
    poser(etat, ['depart', 'gamble', 'bonus', 'arrivee']);
    const braqueur = etat.course!.ordre[0]!;
    etat = jouer(etat, { type: 'lancerDe', option: 'booste' }, joueur(etat), braquage);
    expect(etat.course?.cagnotte).toBe(5);
    etat = jouer(etat, { type: 'miserRoue', montant: 10 }, joueur(etat), braquage);
    expect(etat.course?.positions[braqueur]).toBe(1);
    expect(etat.course?.cagnotte).toBe(4);
    expect(argent(etat.transactions, braqueur)).toBe(36);
    const effet = etat.course?.historique.effets.find((entree) => entree.roue?.option === 'braquage');
    expect(effet?.roue).toMatchObject({ mise: 10, rendu: 11 });
    expect(effet?.gpGagnes).toBe(11);
    expect(effet?.gpPerdus).toBe(10);
  });

  it('passe la roue à 0 et refuse une mise trop haute ou une mise de l\'hôte', () => {
    const ctx = contexte({ alea: (max) => (max <= 0 ? 0 : max - 1) });
    let etat = pret(ctx, [4, 30]);
    poser(etat, ['depart', 'gamble', 'bonus', 'arrivee']);
    const mira = etat.course!.ordre[0]!;
    etat = jouer(etat, { type: 'lancerDe', option: 'normal' }, joueur(etat), ctx);
    expect(refuser(etat, { type: 'miserRoue', montant: 10 }, joueur(etat), ctx)).toMatch(/assez/);
    expect(refuser(etat, { type: 'miserRoue', montant: 5 }, hote, ctx)).toMatch(/hôte/);
    const present = contexte({ ...ctx, estEnLigne: () => true });
    expect(refuser(etat, { type: 'miserRoue', montant: 0 }, hote, present)).toMatch(/connecté/);
    etat = jouer(etat, { type: 'miserRoue', montant: 0 }, joueur(etat), ctx);
    expect(etat.course?.positions[mira]).toBe(1);
    expect(argent(etat.transactions, mira)).toBe(4);
    expect(etat.course?.historique.effets.some((effet) => effet.roue?.option === 'passe')).toBe(true);
    expect(etat.transactions.every((tx) => tx.montant >= 0 || tx.joueurId === mira || tx.source === 'carte')).toBe(true);
  });
});
