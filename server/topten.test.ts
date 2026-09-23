import path from 'node:path';
import { randomInt } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { etatInitial } from './etat-initial';
import { lireCatalogue, lireJeopardy, lirePoker, lireTopTen, lireUndercover } from './mini-jeux-config';
import { lireCartesChance, lireConfigPlateau } from './course-config';
import { reduire, type ContexteReduction } from './reducteur';
import { projeterCourse } from './vues';
import { solde } from '../shared/soldes';
import { REPONDANT_HOTE, scoreTopTen, validerTopTen } from '../shared/topten';
import type { Action, EtatJeu, MancheTopTen, Origine } from '../shared/types';

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const hote: Origine = { role: 'hote' };
const config = lireTopTen(RACINE);

function contexte(partiel: Partial<ContexteReduction> = {}): ContexteReduction {
  let n = 0;
  return {
    maintenant: 1_700_000_000_000,
    id: () => `id-${String(++n)}`,
    prochainIdEvenement: 1,
    dev: true,
    nbJoueursMax: 4,
    estEnLigne: () => false,
    alea: (max: number) => randomInt(0, Math.max(1, max)),
    plateau: lireConfigPlateau(RACINE),
    cartes: lireCartesChance(RACINE),
    catalogue: lireCatalogue(RACINE),
    poker: lirePoker(RACINE),
    topten: config,
    jeopardy: lireJeopardy(RACINE),
    undercover: lireUndercover(RACINE),
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

function partieTopTen(ctx: ContexteReduction): EtatJeu {
  let etat = etatInitial('GP Party');
  const fiches = [
    ['Mira', 'soleil'],
    ['Noé', 'lune'],
    ['Lina', 'feuille'],
    ['Sacha', 'goutte'],
  ] as const;
  for (const [pseudo, avatar] of fiches) {
    etat = jouer(etat, { type: 'rejoindre', pseudo, avatar }, { role: 'joueur', joueurId: null }, ctx);
  }
  etat = jouer(etat, { type: 'demarrerCourse' }, hote, ctx);
  etat = jouer(etat, { type: 'nouveauTour' }, hote, ctx);
  return jouer(etat, { type: 'choisirMiniJeu', id: 'top-ten' }, hote, ctx);
}

function manche(etat: EtatJeu): MancheTopTen {
  const manches = etat.course?.topten?.manches ?? [];
  const derniere = manches[manches.length - 1];
  if (!derniere) throw new Error('aucune manche');
  return derniere;
}

function ordreCroissant(courante: MancheTopTen): string[] {
  return [...courante.repondants].sort((a, b) => (courante.numeros[a] ?? 0) - (courante.numeros[b] ?? 0));
}

const bareme = { pointsParPaire: 1, bonusOrdreParfait: 4, bonusChiffresExacts: [0, 1, 2, 4, 6] };
const numeros = { a: 2, b: 5, c: 7, d: 9 };

describe('Top Ten', () => {
  it('lit la configuration prévue et refuse un thème incomplet', () => {
    expect(config.nomHote).toBe('Yanis');
    expect(config.pointsParPaire).toBe(1);
    expect(config.bonusOrdreParfait).toBe(4);
    expect(config.bonusChiffresExacts).toEqual([0, 1, 2, 4, 6]);
    expect(config.themes).toHaveLength(16);
    expect(config.themes[0]).toEqual({
      intitule: 'Quel objet emporter sur une île déserte ?',
      bas: 'le moins utile',
      haut: 'le plus utile',
    });
    expect(() => validerTopTen({ ...config, themes: [{ intitule: 'Sans pôles' }] })).toThrow(
      'topten.json : le thème 1 doit avoir un intitulé, un pôle bas et un pôle haut',
    );
  });

  it('compte 10 GP pour un ordre parfait et 0 pour un ordre inversé', () => {
    const parfait = scoreTopTen(['a', 'b', 'c', 'd'], numeros, {}, bareme);
    expect(parfait.paires).toHaveLength(6);
    expect(parfait).toMatchObject({ pointsOrdre: 6, parfait: true, bonusParfait: 4, bonusExacts: 0, total: 10 });
    const inverse = scoreTopTen(['d', 'c', 'b', 'a'], numeros, {}, bareme);
    expect(inverse).toMatchObject({ pointsOrdre: 0, parfait: false, bonusParfait: 0, total: 0 });
  });

  it('compte chaque paire dans le bon ordre relatif pour un ordre intermédiaire', () => {
    const score = scoreTopTen(['b', 'a', 'c', 'd'], numeros, {}, bareme);
    expect(score.paires.filter((paire) => !paire.ok)).toEqual([{ avant: 'b', apres: 'a', ok: false }]);
    expect(score).toMatchObject({ pointsOrdre: 5, parfait: false, total: 5 });
    expect(scoreTopTen(['a', 'd', 'c', 'b'], numeros, {}, bareme).pointsOrdre).toBe(3);
  });

  it('ajoute le bonus des numéros exacts de 0 à 4, champs vides compris', () => {
    const ordre = ['d', 'c', 'b', 'a'];
    expect(scoreTopTen(ordre, numeros, { a: null, b: null, c: null, d: null }, bareme).bonusExacts).toBe(0);
    expect(scoreTopTen(ordre, numeros, { a: 2 }, bareme).bonusExacts).toBe(1);
    expect(scoreTopTen(ordre, numeros, { a: 2, b: 5, c: 1 }, bareme).bonusExacts).toBe(2);
    expect(scoreTopTen(ordre, numeros, { a: 2, b: 5, c: 7, d: null }, bareme).bonusExacts).toBe(4);
    const tout = scoreTopTen(['a', 'b', 'c', 'd'], numeros, { a: 2, b: 5, c: 7, d: 9 }, bareme);
    expect(tout).toMatchObject({ exacts: ['a', 'b', 'c', 'd'], bonusExacts: 6, total: 16 });
  });

  it('tire quatre numéros distincts de 1 à 10, dont celui de l\'hôte', () => {
    for (let essai = 0; essai < 20; essai += 1) {
      const ctx = contexte();
      const etat = jouer(partieTopTen(ctx), { type: 'lancerMancheTopTen' }, hote, ctx);
      const courante = manche(etat);
      expect(courante.repondants).toHaveLength(4);
      expect(courante.repondants).toContain(REPONDANT_HOTE);
      expect(courante.repondants).not.toContain(courante.captenId);
      const valeurs = courante.repondants.map((id) => courante.numeros[id]);
      expect(new Set(valeurs).size).toBe(4);
      for (const valeur of valeurs) {
        expect(Number.isInteger(valeur)).toBe(true);
        expect(valeur).toBeGreaterThanOrEqual(1);
        expect(valeur).toBeLessThanOrEqual(10);
      }
    }
  });

  it('fait tourner les Cap\'Ten dans l\'ordre de passage, sans l\'hôte, et crédite seulement le Cap\'Ten', () => {
    const ctx = contexte();
    let etat = partieTopTen(ctx);
    const ordre = etat.course?.ordre ?? [];
    const captens: string[] = [];
    for (let index = 0; index < 4; index += 1) {
      etat = jouer(etat, { type: 'lancerMancheTopTen' }, hote, ctx);
      const courante = manche(etat);
      captens.push(courante.captenId);
      const avant = new Map(etat.joueurs.map((joueur) => [joueur.id, solde(etat.transactions, joueur.id, 'visibles')]));
      const autre = etat.joueurs.find((joueur) => joueur.id !== courante.captenId);
      if (!autre) throw new Error('joueur');
      expect(
        reduire(etat, { type: 'validerOrdreTopTen', ordre: ordreCroissant(courante), devines: {} }, { role: 'joueur', joueurId: autre.id }, ctx).ok,
      ).toBe(false);
      etat = jouer(
        etat,
        { type: 'validerOrdreTopTen', ordre: ordreCroissant(courante), devines: {} },
        { role: 'joueur', joueurId: courante.captenId },
        ctx,
      );
      for (const joueur of etat.joueurs) {
        const gain = solde(etat.transactions, joueur.id, 'visibles') - (avant.get(joueur.id) ?? 0);
        expect(gain).toBe(joueur.id === courante.captenId ? 10 : 0);
      }
      expect(etat.transactions.every((transaction) => transaction.joueurId !== REPONDANT_HOTE)).toBe(true);
      expect(etat.transactions[etat.transactions.length - 1]?.source).toBe('mini-jeu');
    }
    expect(captens).toEqual(ordre);
    expect(captens).not.toContain(REPONDANT_HOTE);
    const refus = reduire(etat, { type: 'lancerMancheTopTen' }, hote, ctx);
    expect(refus.ok ? '' : refus.erreur).toBe('Toutes les manches sont jouées');
    etat = jouer(etat, { type: 'recapTopTen' }, hote, ctx);
    expect(etat.course?.topten?.recap).toBe(true);
    expect(etat.course?.resultatsSaisis).toBe(true);
  });

  it('ne rejoue jamais un thème de la soirée, même dans une nouvelle course', () => {
    const ctx = contexte();
    let etat = partieTopTen(ctx);
    const vus: number[] = [];
    for (let partie = 0; partie < 4; partie += 1) {
      for (let index = 0; index < 4; index += 1) {
        etat = jouer(etat, { type: 'lancerMancheTopTen' }, hote, ctx);
        const courante = manche(etat);
        expect(vus).not.toContain(courante.indexTheme);
        vus.push(courante.indexTheme);
        etat = jouer(etat, { type: 'validerOrdreTopTen', ordre: courante.repondants, devines: {} }, hote, ctx);
      }
      etat = jouer(etat, { type: 'terminerCourse' }, hote, ctx);
      etat = jouer(etat, { type: 'demarrerCourse' }, hote, ctx);
      etat = jouer(etat, { type: 'nouveauTour' }, hote, ctx);
      etat = jouer(etat, { type: 'choisirMiniJeu', id: 'top-ten' }, hote, ctx);
    }
    expect(new Set(vus).size).toBe(16);
    const refus = reduire(etat, { type: 'lancerMancheTopTen' }, hote, ctx);
    expect(refus.ok ? '' : refus.erreur).toBe('Tous les thèmes ont déjà été joués ce soir');
  });

  it('refuse un ordre incomplet ou un numéro deviné hors de 1 à 10', () => {
    const ctx = contexte();
    const etat = jouer(partieTopTen(ctx), { type: 'lancerMancheTopTen' }, hote, ctx);
    const courante = manche(etat);
    const incomplet = reduire(etat, { type: 'validerOrdreTopTen', ordre: courante.repondants.slice(1), devines: {} }, hote, ctx);
    expect(incomplet.ok ? '' : incomplet.erreur).toBe('Classe tous les répondants');
    const horsBornes = reduire(
      etat,
      { type: 'validerOrdreTopTen', ordre: courante.repondants, devines: { [REPONDANT_HOTE]: 11 } },
      hote,
      ctx,
    );
    expect(horsBornes.ok ? '' : horsBornes.erreur).toBe('Un numéro deviné va de 1 à 10');
  });

  it('ne montre un numéro qu\'à son répondant et à l\'hôte avant la révélation', () => {
    const ctx = contexte();
    let etat = jouer(partieTopTen(ctx), { type: 'lancerMancheTopTen' }, hote, ctx);
    const courante = manche(etat);
    const course = etat.course!;
    const [premier, second] = courante.repondants.filter((id) => id !== REPONDANT_HOTE);
    if (!premier || !second) throw new Error('répondants');
    expect(projeterCourse(course, 'tv', null)?.topten?.courante).toMatchObject({ monNumero: null, numeros: null });
    expect(projeterCourse(course, 'joueur', courante.captenId)?.topten?.courante).toMatchObject({ monNumero: null, numeros: null });
    const vuePremier = projeterCourse(course, 'joueur', premier)?.topten?.courante;
    expect(vuePremier).toMatchObject({ monNumero: courante.numeros[premier], numeros: null });
    expect(JSON.stringify(vuePremier)).not.toContain(`"${second}":`);
    const vueHote = projeterCourse(course, 'hote', null)?.topten?.courante;
    expect(vueHote?.monNumero).toBe(courante.numeros[REPONDANT_HOTE]);
    expect(vueHote?.numeros).toEqual(courante.numeros);
    etat = jouer(etat, { type: 'validerOrdreTopTen', ordre: courante.repondants, devines: {} }, hote, ctx);
    expect(projeterCourse(etat.course!, 'tv', null)?.topten?.courante?.numeros).toEqual(courante.numeros);
  });
});
