import { randomInt } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { esperanceDe, probabilitesDe, tirerDePondere } from '../shared/de';
import { lireConfigPlateau } from './course-config';
import { lireCatalogue, lirePoker } from './mini-jeux-config';
import { etatInitial } from './etat-initial';
import { reduire, type ContexteReduction } from './reducteur';
import type { Action, EtatJeu, Origine } from '../shared/types';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const REFERENCE = [1 / 12, 7 / 60, 3 / 20, 11 / 60, 13 / 60, 1 / 4];

function contexte(partiel: Partial<ContexteReduction> = {}): ContexteReduction {
  let n = 0;
  return {
    maintenant: 1_700_000_000_000,
    id: () => `id-${String(++n)}`,
    prochainIdEvenement: 1,
    dev: true,
    nbJoueursMax: 4,
    estEnLigne: () => false,
    alea: (max) => (max <= 0 ? 0 : 0),
    plateau: lireConfigPlateau(RACINE),
    cartes: [{ id: 'de-dore', titre: 'Dé doré', texte: 'Le dé rapporte.', effet: { type: 'gainDe' } }],
    catalogue: lireCatalogue(RACINE),
    poker: lirePoker(RACINE),
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

describe('dé boosté par la mise', () => {
  const config = lireConfigPlateau(RACINE);

  it('est uniforme à mise nulle et égal à probasMiseMax à la mise maximale', () => {
    expect(config.probasMiseMax).toHaveLength(6);
    config.probasMiseMax.forEach((probabilite, index) => {
      expect(probabilite).toBeCloseTo(REFERENCE[index] ?? 0, 12);
    });
    const nulle = probabilitesDe(0, config.miseMax, config.probasMiseMax);
    nulle.forEach((probabilite) => expect(probabilite).toBeCloseTo(1 / 6, 12));
    const pleine = probabilitesDe(config.miseMax, config.miseMax, config.probasMiseMax);
    pleine.forEach((probabilite, index) => expect(probabilite).toBeCloseTo(config.probasMiseMax[index] ?? 0, 12));
    for (const mise of [0, 1, 3, 7, 10, 15]) {
      const somme = probabilitesDe(mise, config.miseMax, config.probasMiseMax).reduce((total, probabilite) => total + probabilite, 0);
      expect(somme).toBeCloseTo(1, 10);
    }
    expect(esperanceDe(nulle)).toBeCloseTo(3.5, 10);
    expect(esperanceDe(pleine)).toBeGreaterThan(4);
    expect(esperanceDe(pleine)).toBeLessThan(4.2);
  });

  it('rapproche les fréquences à 1 % sur 200 000 tirages', () => {
    for (const mise of [0, 4, config.miseMax]) {
      const probas = probabilitesDe(mise, config.miseMax, config.probasMiseMax);
      const effectifs = [0, 0, 0, 0, 0, 0];
      for (let tirage = 0; tirage < 200_000; tirage += 1) {
        const face = tirerDePondere(probas, (max) => randomInt(0, max));
        const compte = effectifs[face - 1];
        if (compte === undefined) throw new Error(`Face inattendue ${face}`);
        effectifs[face - 1] = compte + 1;
      }
      effectifs.forEach((effectif, index) => {
        expect(Math.abs(effectif / 200_000 - (probas[index] ?? 0))).toBeLessThan(0.01);
      });
    }
  });

  it('enregistre la même espérance que shared/ pour le déplacement, et un dé normal pour une carte', () => {
    const ctx = contexte();
    const forces = [1, 2];
    let appelsForces = 0;
    ctx.tirerDe = () => {
      appelsForces += 1;
      return forces.shift() ?? 1;
    };
    let etat = etatInitial('GP Party');
    const hote: Origine = { role: 'hote' };
    etat = jouer(etat, { type: 'rejoindre', pseudo: 'Mira', avatar: 'soleil' }, { role: 'joueur', joueurId: null }, ctx);
    etat = jouer(etat, { type: 'rejoindre', pseudo: 'Noé', avatar: 'lune' }, { role: 'joueur', joueurId: null }, ctx);
    const mira = etat.joueurs[0]!.id;
    const noe = etat.joueurs[1]!.id;
    etat = jouer(etat, { type: 'ajouterGP', joueurId: mira, montant: 30, libelle: 'Départ' }, hote, ctx);
    etat = jouer(etat, { type: 'ajouterGP', joueurId: noe, montant: 30, libelle: 'Départ' }, hote, ctx);
    ctx.plateau = {
      ...ctx.plateau,
      longueur: 5,
      disposition: ['depart', 'chance', 'bonus', 'bonus', 'bonus', 'arrivee'],
    };
    etat = jouer(etat, { type: 'demarrerCourse' }, hote, ctx);
    etat = jouer(etat, { type: 'nouveauTour' }, hote, ctx);
    etat = jouer(etat, { type: 'choisirMiniJeu', id: 'pong-gobelets' }, hote, ctx);
    etat = jouer(etat, { type: 'passerAuxDeplacements' }, hote, ctx);
    const premier = etat.course?.ordre[0];
    const second = etat.course?.ordre[1];
    etat = jouer(etat, { type: 'lancerDe', mise: 10 }, { role: 'joueur', joueurId: premier ?? mira }, ctx);
    const chance = etat.course?.historique.lancers.find((lancer) => lancer.usage === 'chance');
    expect(chance?.mise).toBe(0);
    expect(chance?.esperance).toBeCloseTo(3.5, 10);
    expect(chance?.valeur).toBe(1);
    etat = jouer(etat, { type: 'lancerDe', mise: 0 }, { role: 'joueur', joueurId: second ?? noe }, ctx);
    const deplacement = etat.course?.historique.lancers.filter((lancer) => lancer.usage === 'deplacement') ?? [];
    expect(deplacement.map((lancer) => lancer.mise)).toEqual([10, 0]);
    expect(deplacement.map((lancer) => lancer.valeur)).toEqual([1, 2]);
    expect(deplacement[0]?.esperance).toBeCloseTo(esperanceDe(probabilitesDe(10, config.miseMax, config.probasMiseMax)), 10);
    expect(deplacement[1]?.esperance).toBeCloseTo(3.5, 10);
    expect(appelsForces).toBe(2);
  });
});
