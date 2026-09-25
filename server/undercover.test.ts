import path from 'node:path';
import { randomInt } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { etatInitial } from './etat-initial';
import { lireCatalogue, lireJeopardy, lirePoker, lireTopTen, lireCodenames, lirePerudo, lireUndercover, lireJustOne } from './mini-jeux-config';
import { lireCartesChance, lireCartesMalchance, lireConfigPlateau, lireRoue } from './course-config';
import { reduire, type ContexteReduction } from './reducteur';
import { tirerOrdreParole } from './undercover';
import { projeterCourse } from './vues';
import { solde } from '../shared/soldes';
import { validerUndercover } from '../shared/undercover';
import type { Action, EtatJeu, MancheUndercover, Origine } from '../shared/types';

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const hote: Origine = { role: 'hote' };
const config = lireUndercover(RACINE);

function contexte(): ContexteReduction {
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
    cartesMalchance: lireCartesMalchance(RACINE),
    roue: lireRoue(RACINE),
    catalogue: lireCatalogue(RACINE),
    poker: lirePoker(RACINE),
    topten: lireTopTen(RACINE),
    jeopardy: lireJeopardy(RACINE),
    undercover: config,
    codenames: lireCodenames(RACINE),
    perudo: lirePerudo(RACINE),
    justone: lireJustOne(RACINE),
    nomHote: 'Yanis',
  };
}

function jouer(etat: EtatJeu, action: Action, origine: Origine, ctx: ContexteReduction): EtatJeu {
  const resultat = reduire(etat, action, origine, ctx);
  expect(resultat.ok, !resultat.ok ? resultat.erreur : '').toBe(true);
  if (!resultat.ok) throw new Error(resultat.erreur);
  ctx.prochainIdEvenement = resultat.prochainIdEvenement;
  return resultat.etat;
}

function refus(etat: EtatJeu, action: Action, ctx: ContexteReduction): string {
  const resultat = reduire(etat, action, hote, ctx);
  return resultat.ok ? '' : resultat.erreur;
}

function partieUndercover(ctx: ContexteReduction): EtatJeu {
  let etat = etatInitial('GP Party');
  for (const [pseudo, avatar] of [
    ['Mira', 'soleil'],
    ['Noé', 'lune'],
    ['Lina', 'feuille'],
    ['Sacha', 'goutte'],
  ] as const) {
    etat = jouer(etat, { type: 'rejoindre', pseudo, avatar }, { role: 'joueur', joueurId: null }, ctx);
  }
  etat = jouer(etat, { type: 'demarrerCourse' }, hote, ctx);
  etat = jouer(etat, { type: 'nouveauTour' }, hote, ctx);
  etat = jouer(etat, { type: 'choisirMiniJeu', id: 'undercover' }, hote, ctx);
  return jouer(etat, { type: 'lancerMancheUndercover' }, hote, ctx);
}

function manche(etat: EtatJeu): MancheUndercover {
  const manches = etat.course?.undercover?.manches ?? [];
  const derniere = manches[manches.length - 1];
  if (!derniere) throw new Error('aucune manche');
  return derniere;
}

function gains(etat: EtatJeu, ids: string[]): number[] {
  return ids.map((id) => solde(etat.transactions, id, 'visibles'));
}

describe('Undercover', () => {
  it('lit la configuration prévue et refuse une paire au mot identique', () => {
    expect(config).toMatchObject({ manches: 2, gainCivils: 6, gainUndercoverDevine: 8, gainUndercoverSurvit: 15 });
    expect(config.paires).toHaveLength(16);
    expect(() => validerUndercover({ ...config, paires: [{ civils: 'Chat', undercover: 'chat' }] })).toThrow(
      'undercover.json : la paire 1 a deux fois le même mot',
    );
  });

  it('ne fait jamais parler l\'undercover en premier au premier tour, sur 1 000 tirages', () => {
    const ids = ['a', 'b', 'c', 'd'];
    const positions = new Set<number>();
    for (let essai = 0; essai < 1000; essai += 1) {
      const undercover = ids[randomInt(0, ids.length)]!;
      const ordre = tirerOrdreParole(ids, undercover, (max) => randomInt(0, Math.max(1, max)));
      expect([...ordre].sort()).toEqual(ids);
      expect(ordre[0]).not.toBe(undercover);
      positions.add(ordre.indexOf(undercover));
    }
    expect([...positions].sort()).toEqual([1, 2, 3]);
  });

  it('tire un undercover différent à chaque manche et une paire jamais rejouée', () => {
    const ctx = contexte();
    let etat = partieUndercover(ctx);
    const premiere = manche(etat);
    expect(refus(etat, { type: 'lancerMancheUndercover' }, ctx)).toBe("La manche en cours n'est pas finie");
    etat = jouer(etat, { type: 'eliminerUndercover', joueurId: premiere.undercoverId }, hote, ctx);
    etat = jouer(etat, { type: 'devinerUndercover', trouve: false }, hote, ctx);
    etat = jouer(etat, { type: 'lancerMancheUndercover' }, hote, ctx);
    const seconde = manche(etat);
    expect(seconde.undercoverId).not.toBe(premiere.undercoverId);
    expect(seconde.indexPaire).not.toBe(premiere.indexPaire);
    expect(seconde.ordreParole[0]).not.toBe(seconde.undercoverId);
  });

  it('donne 6 GP à chaque civil, éliminé ou non, puis 8 GP à l\'undercover s\'il devine le mot', () => {
    const ctx = contexte();
    let etat = partieUndercover(ctx);
    const courante = manche(etat);
    const civils = courante.ordreParole.filter((id) => id !== courante.undercoverId);
    etat = jouer(etat, { type: 'eliminerUndercover', joueurId: civils[0]! }, hote, ctx);
    expect(manche(etat).etape).toBe('indices');
    expect(gains(etat, courante.ordreParole)).toEqual([0, 0, 0, 0]);
    etat = jouer(etat, { type: 'eliminerUndercover', joueurId: courante.undercoverId }, hote, ctx);
    expect(manche(etat)).toMatchObject({ etape: 'devine', issue: 'civils' });
    expect(gains(etat, civils)).toEqual([6, 6, 6]);
    expect(gains(etat, [courante.undercoverId])).toEqual([0]);
    etat = jouer(etat, { type: 'devinerUndercover', trouve: true }, hote, ctx);
    expect(manche(etat)).toMatchObject({ etape: 'finie', devine: true });
    expect(gains(etat, [courante.undercoverId])).toEqual([8]);
  });

  it('ne donne rien à l\'undercover s\'il rate le mot', () => {
    const ctx = contexte();
    let etat = partieUndercover(ctx);
    const courante = manche(etat);
    etat = jouer(etat, { type: 'eliminerUndercover', joueurId: courante.undercoverId }, hote, ctx);
    etat = jouer(etat, { type: 'devinerUndercover', trouve: false }, hote, ctx);
    expect(gains(etat, [courante.undercoverId])).toEqual([0]);
  });

  it('donne 15 GP à l\'undercover s\'il reste parmi les 2 derniers', () => {
    const ctx = contexte();
    let etat = partieUndercover(ctx);
    const courante = manche(etat);
    const civils = courante.ordreParole.filter((id) => id !== courante.undercoverId);
    etat = jouer(etat, { type: 'eliminerUndercover', joueurId: civils[0]! }, hote, ctx);
    etat = jouer(etat, { type: 'eliminerUndercover', joueurId: civils[1]! }, hote, ctx);
    expect(manche(etat)).toMatchObject({ etape: 'finie', issue: 'undercover' });
    expect(gains(etat, [courante.undercoverId, ...civils])).toEqual([15, 0, 0, 0]);
    expect(refus(etat, { type: 'eliminerUndercover', joueurId: civils[2]! }, ctx)).toBe("Personne n'est à éliminer");
    expect(refus(etat, { type: 'recapUndercover' }, ctx)).toBe('Toutes les manches ne sont pas jouées');
    etat = jouer(etat, { type: 'lancerMancheUndercover' }, hote, ctx);
    const seconde = manche(etat);
    etat = jouer(etat, { type: 'eliminerUndercover', joueurId: seconde.undercoverId }, hote, ctx);
    etat = jouer(etat, { type: 'devinerUndercover', trouve: false }, hote, ctx);
    expect(refus(etat, { type: 'lancerMancheUndercover' }, ctx)).toBe('Toutes les manches sont jouées');
    etat = jouer(etat, { type: 'recapUndercover' }, hote, ctx);
    expect(etat.course?.resultatsSaisis).toBe(true);
  });

  it('ne donne chaque mot qu\'à son joueur et les rôles qu\'à l\'hôte avant la révélation', () => {
    const ctx = contexte();
    let etat = partieUndercover(ctx);
    const courante = manche(etat);
    const civil = courante.ordreParole.find((id) => id !== courante.undercoverId)!;
    const tv = JSON.stringify(projeterCourse(etat.course, 'tv', null));
    expect(tv).not.toContain(courante.paire.civils);
    expect(tv).not.toContain(courante.paire.undercover);
    expect(projeterCourse(etat.course, 'tv', null)?.undercover?.courante?.undercoverId).toBeNull();
    const vueCivil = JSON.stringify(projeterCourse(etat.course, 'joueur', civil));
    expect(projeterCourse(etat.course, 'joueur', civil)?.undercover?.courante?.monMot).toBe(courante.paire.civils);
    expect(vueCivil).not.toContain(courante.paire.undercover);
    expect(projeterCourse(etat.course, 'joueur', civil)?.undercover?.courante?.undercoverId).toBeNull();
    const vueUndercover = projeterCourse(etat.course, 'joueur', courante.undercoverId);
    expect(vueUndercover?.undercover?.courante?.monMot).toBe(courante.paire.undercover);
    expect(JSON.stringify(vueUndercover)).not.toContain(courante.paire.civils);
    const vueHote = projeterCourse(etat.course, 'hote', null)?.undercover?.courante;
    expect(vueHote).toMatchObject({ undercoverId: courante.undercoverId, paire: courante.paire });
    etat = jouer(etat, { type: 'eliminerUndercover', joueurId: civil }, hote, ctx);
    expect(projeterCourse(etat.course, 'tv', null)?.undercover?.courante?.elimines).toEqual([{ id: civil, role: 'civil' }]);
    expect(projeterCourse(etat.course, 'joueur', civil)?.undercover?.courante?.jeSuisElimine).toBe(true);
  });
});
