import { randomInt } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { esperanceDe, tirerDeUniforme } from '../shared/de';
import { lireCartesMalchance, lireConfigPlateau, lireRoue } from './course-config';
import { lireCatalogue, lireJeopardy, lirePoker, lireTopTen, lireCodenames, lirePerudo, lireUndercover, lireJustOne } from './mini-jeux-config';
import { etatInitial } from './etat-initial';
import { reduire, type ContexteReduction } from './reducteur';
import { solde } from '../shared/soldes';
import type { Action, EtatJeu, Origine } from '../shared/types';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

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
    cartes: [{ id: 'coup-de-des', titre: 'Coup de dés', texte: 'Le dé rapporte.', icone: 'de', famille: 'chance', poids: 1, effet: { type: 'gainDe' } }],
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

describe('dés à 6, 7 et 8 faces', () => {
  const config = lireConfigPlateau(RACINE);

  it('donne une face équiprobable, et enregistre (faces + 1) / 2', () => {
    expect(config.optionsDe.map((option) => [option.id, option.faces, option.mise])).toEqual([
      ['normal', 6, 0],
      ['booste', 7, 5],
      ['super', 8, 10],
    ]);
    for (const faces of [6, 7, 8]) {
      expect(esperanceDe(faces)).toBe((faces + 1) / 2);
      const effectifs = Array.from({ length: faces }, () => 0);
      for (let tirage = 0; tirage < 100_000; tirage += 1) {
        const face = tirerDeUniforme(faces, (max) => randomInt(0, max));
        const compte = effectifs[face - 1];
        if (compte === undefined) throw new Error(`Face inattendue ${face}`);
        effectifs[face - 1] = compte + 1;
      }
      effectifs.forEach((effectif) => {
        expect(Math.abs(effectif / 100_000 - 1 / faces)).toBeLessThan(0.01);
      });
    }
  });

  it('refuse une option trop chère, alimente la cagnotte et enregistre l\'espérance', () => {
    const ctx = contexte();
    const forces = [1, 2];
    let appelsForces = 0;
    ctx.tirerDe = () => {
      appelsForces += 1;
      return forces.shift();
    };
    let etat = etatInitial('GP Party');
    const hote: Origine = { role: 'hote' };
    etat = jouer(etat, { type: 'rejoindre', pseudo: 'Mira', avatar: 'soleil' }, { role: 'joueur', joueurId: null }, ctx);
    etat = jouer(etat, { type: 'rejoindre', pseudo: 'Noé', avatar: 'lune' }, { role: 'joueur', joueurId: null }, ctx);
    const mira = etat.joueurs[0]!.id;
    const noe = etat.joueurs[1]!.id;
    ctx.plateau = {
      ...ctx.plateau,
      longueur: 5,
      disposition: ['depart', 'chance', 'bonus', 'bonus', 'bonus', 'arrivee'],
    };
    etat = jouer(etat, { type: 'demarrerCourse' }, hote, ctx);
    const premier = etat.course?.ordre[0] ?? mira;
    const second = etat.course?.ordre[1] ?? noe;
    etat = jouer(etat, { type: 'ajouterGP', joueurId: premier, montant: 4, libelle: 'Départ' }, hote, ctx);
    etat = jouer(etat, { type: 'ajouterGP', joueurId: second, montant: 30, libelle: 'Départ' }, hote, ctx);
    etat = jouer(etat, { type: 'nouveauTour' }, hote, ctx);
    etat = jouer(etat, { type: 'choisirMiniJeu', id: 'poker' }, hote, ctx);
    etat = jouer(etat, { type: 'passerAuxDeplacements' }, hote, ctx);
    const refuse = reduire(etat, { type: 'lancerDe', option: 'super' }, { role: 'joueur', joueurId: premier }, ctx);
    expect(refuse.ok).toBe(false);
    etat = jouer(etat, { type: 'lancerDe', option: 'normal' }, { role: 'joueur', joueurId: premier }, ctx);
    expect(solde(etat.transactions, premier, 'visibles')).toBe(6);
    etat = jouer(etat, { type: 'lancerDe', option: 'super' }, { role: 'joueur', joueurId: second }, ctx);
    expect(etat.course?.cagnotte).toBeGreaterThanOrEqual(10);
    const chance = etat.course?.historique.lancers.find((lancer) => lancer.usage === 'chance');
    expect(chance?.mise).toBe(0);
    expect(chance?.faces).toBe(6);
    expect(chance?.esperance).toBeCloseTo(3.5, 10);
    expect(chance?.valeur).toBe(1);
    const deplacement = etat.course?.historique.lancers.filter((lancer) => lancer.usage === 'deplacement') ?? [];
    expect(deplacement.map((lancer) => lancer.mise)).toEqual([0, 10]);
    expect(deplacement.map((lancer) => lancer.faces)).toEqual([6, 8]);
    expect(deplacement.map((lancer) => lancer.valeur)).toEqual([1, 2]);
    expect(deplacement[0]?.esperance).toBeCloseTo(3.5, 10);
    expect(deplacement[1]?.esperance).toBeCloseTo(esperanceDe(8), 10);
    expect(appelsForces).toBe(2);
  });
});
