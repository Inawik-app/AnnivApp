import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import {
  JUSTONE_HOTE,
  annulerIndices,
  indiceValide,
  normaliserIndice,
  ordreDevineursJustOne,
  validerJustOne,
} from '../shared/justone';
import { solde } from '../shared/soldes';
import type { Action, EtatJeu, Origine } from '../shared/types';
import { lireCartesChance, lireCartesMalchance, lireConfigPlateau, lireRoue } from './course-config';
import { etatInitial } from './etat-initial';
import {
  lireCatalogue,
  lireCodenames,
  lireJeopardy,
  lireJustOne,
  lirePerudo,
  lirePoker,
  lireTopTen,
  lireUndercover,
} from './mini-jeux-config';
import { reduire, type ContexteReduction } from './reducteur';
import { projeterCourse } from './vues';

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const hote: Origine = { role: 'hote' };
const config = lireJustOne(RACINE);

function contexte(alea: (max: number) => number = () => 0): ContexteReduction {
  let n = 0;
  return {
    maintenant: 1_700_000_000_000,
    id: () => `id-${String(++n)}`,
    prochainIdEvenement: 1,
    dev: true,
    nbJoueursMax: 4,
    estEnLigne: () => false,
    alea,
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
    justone: config,
    nomHote: 'Yanis',
  };
}

function jouer(etat: EtatJeu, action: Action, origine: Origine, ctx: ContexteReduction): EtatJeu {
  const resultat = reduire(etat, action, origine, ctx);
  expect(resultat.ok, !resultat.ok ? resultat.erreur : '').toBe(true);
  if (!resultat.ok) throw new Error(resultat.erreur);
  return resultat.etat;
}

function partieJustOne(ctx: ContexteReduction): EtatJeu {
  let etat = etatInitial('GP Party');
  for (const fiche of [
    { pseudo: 'Inès', avatar: 'perso-carpe' },
    { pseudo: 'Noé', avatar: 'perso-verre-eau' },
    { pseudo: 'Lina', avatar: 'perso-piment' },
    { pseudo: 'Léo', avatar: 'perso-planete' },
  ]) {
    etat = jouer(etat, { type: 'rejoindre', pseudo: fiche.pseudo, avatar: fiche.avatar }, { role: 'joueur', joueurId: '' }, ctx);
  }
  etat = jouer(etat, { type: 'demarrerCourse' }, hote, ctx);
  etat = jouer(etat, { type: 'nouveauTour' }, hote, ctx);
  return jouer(etat, { type: 'choisirMiniJeu', id: 'just-one' }, hote, ctx);
}

describe('Just One — normalisation et validation', () => {
  it('normalise accents et pluriel grossier', () => {
    expect(normaliserIndice('Châteaux')).toBe('chateau');
    expect(normaliserIndice('Éléphants')).toBe('elephant');
    expect(normaliserIndice('voix')).toBe('voi');
  });

  it('refuse un indice égal ou trop proche du secret', () => {
    expect(indiceValide('chat', 'chat')).toMatch(/secret/);
    expect(indiceValide('chats', 'chat')).toMatch(/proche|secret/);
    expect(indiceValide('deux mots', 'chat')).toMatch(/seul mot/);
    expect(indiceValide('miaou', 'chat')).toBeNull();
  });

  it('annule les doublons entre joueurs, et seulement l\'hôte s\'il copie un joueur', () => {
    const resultat = annulerIndices([
      { auteurId: 'a', mot: 'rouge' },
      { auteurId: 'b', mot: 'Rouge' },
      { auteurId: JUSTONE_HOTE, mot: 'rouge' },
      { auteurId: 'c', mot: 'bleu' },
    ]);
    expect(resultat.map((ligne) => ligne.annule)).toEqual([true, true, true, false]);
    const seulHote = annulerIndices([
      { auteurId: 'a', mot: 'vert' },
      { auteurId: JUSTONE_HOTE, mot: 'Vert' },
      { auteurId: 'b', mot: 'jaune' },
    ]);
    expect(seulHote.map((ligne) => ligne.annule)).toEqual([false, true, false]);
  });

  it('construit la rotation avec l\'hôte', () => {
    expect(ordreDevineursJustOne(['a', 'b'], 2, true)).toEqual(['a', 'b', JUSTONE_HOTE, 'a', 'b', JUSTONE_HOTE]);
    expect(ordreDevineursJustOne(['a', 'b'], 1, false)).toEqual(['a', 'b']);
  });

  it('valide la config', () => {
    expect(config.cycles).toBe(2);
    expect(config.hoteDevine).toBe(true);
    expect(config.mots.length).toBeGreaterThanOrEqual(250);
    expect(() => validerJustOne({ ...config, mots: config.mots.slice(0, 10) })).toThrow(/250/);
  });
});

describe('Just One — moteur', () => {
  it('crédite le devineur et les indiceurs, jamais l\'hôte', () => {
    const ctx = contexte(() => 0);
    let etat = partieJustOne(ctx);
    etat = jouer(etat, { type: 'lancerMancheJustOne' }, hote, ctx);
    const manche = etat.course!.justone!.manches[0]!;
    const devineur = manche.devineurId;
    expect(devineur).not.toBe(JUSTONE_HOTE);
    const ordre = etat.course!.ordre;
    const indices = ['Abricot', 'Banane', 'Cerise'];
    let i = 0;
    for (const id of ordre.filter((joueurId) => joueurId !== devineur)) {
      etat = jouer(
        etat,
        { type: 'proposerIndiceJustOne', mot: indices[i++]! },
        { role: 'joueur', joueurId: id },
        ctx,
      );
    }
    etat = jouer(etat, { type: 'proposerIndiceJustOne', mot: 'HoteSeul' }, hote, ctx);
    etat = jouer(etat, { type: 'revelerIndicesJustOne' }, hote, ctx);
    etat = jouer(etat, { type: 'jugerJustOne', issue: 'trouve' }, hote, ctx);
    const finie = etat.course!.justone!.manches[0]!;
    expect(finie.gains[devineur]).toBe(config.gainDevineur);
    expect(finie.gains[JUSTONE_HOTE]).toBeUndefined();
    expect(etat.transactions.every((transaction) => transaction.joueurId !== JUSTONE_HOTE)).toBe(true);
    expect(solde(etat.transactions, devineur, 'visibles')).toBe(config.gainDevineur);
  });

  it('n\'annule que l\'hôte quand la proposition trop proche le vise', () => {
    const ctx = contexte(() => 0);
    let etat = partieJustOne(ctx);
    etat = jouer(etat, { type: 'lancerMancheJustOne' }, hote, ctx);
    const manche = etat.course!.justone!.manches[0]!;
    const [a, b, c] = etat.course!.ordre.filter((id) => id !== manche.devineurId);
    etat = jouer(etat, { type: 'proposerIndiceJustOne', mot: 'Soleil' }, { role: 'joueur', joueurId: a! }, ctx);
    etat = jouer(etat, { type: 'proposerIndiceJustOne', mot: 'Lune' }, { role: 'joueur', joueurId: b! }, ctx);
    etat = jouer(etat, { type: 'proposerIndiceJustOne', mot: 'Etoile' }, { role: 'joueur', joueurId: c! }, ctx);
    etat = jouer(etat, { type: 'proposerIndiceJustOne', mot: 'Astre' }, hote, ctx);
    const indices = etat.course!.justone!.manches[0]!.indices;
    const indexJoueur = indices.findIndex((indice) => indice.auteurId === a);
    const indexHote = indices.findIndex((indice) => indice.auteurId === JUSTONE_HOTE);
    etat = jouer(etat, { type: 'proposerAnnulationJustOne', indexA: indexJoueur, indexB: indexHote }, hote, ctx);
    etat = jouer(etat, { type: 'validerAnnulationJustOne', accepter: true }, hote, ctx);
    const apres = etat.course!.justone!.manches[0]!.indices;
    expect(apres[indexJoueur]?.annule).toBe(false);
    expect(apres[indexHote]?.annule).toBe(true);
  });

  it('ne reprend pas un mot déjà dans motsSoiree', () => {
    const ctx = contexte(() => 0);
    let etat = partieJustOne(ctx);
    const premier = config.mots[0]!;
    etat = produce(etat, (draft) => {
      draft.course!.motsSoiree = [premier];
    });
    etat = jouer(etat, { type: 'lancerMancheJustOne' }, hote, ctx);
    expect(etat.course!.justone!.manches[0]!.mot).not.toBe(premier);
    expect(etat.course!.motsSoiree).toContain(etat.course!.justone!.manches[0]!.mot);
  });

  it('fait tourner les devineurs y compris l\'hôte', () => {
    const ctx = contexte(() => 0);
    let etat = partieJustOne(ctx);
    const ordre = etat.course!.justone!.ordreDevineurs;
    expect(ordre.filter((id) => id === JUSTONE_HOTE)).toHaveLength(config.cycles);
    expect(ordre).toHaveLength(4 * config.cycles + config.cycles);
  });

  it('ne laisse pas l\'hôte dans Perudo ni Codenames comme joueur', () => {
    const catalogue = lireCatalogue(RACINE);
    expect(catalogue.jeux.find((jeu) => jeu.id === 'perudo')?.hoteParticipe).toBe(false);
    expect(catalogue.jeux.find((jeu) => jeu.id === 'codenames')?.hoteParticipe).toBe(false);
    expect(catalogue.jeux.find((jeu) => jeu.id === 'undercover')?.hoteParticipe).toBe(false);
  });

  it('propriété : avec hôte, aucun joueur ne gagne moins qu\'sans hôte (même indices)', () => {
    const seed = 42;
    const alea = (max: number) => {
      // LCG déterministe
      const x = Math.sin(seed + max) * 10000;
      return Math.floor((x - Math.floor(x)) * Math.max(1, max));
    };
    for (let i = 0; i < 1000; i += 1) {
      const indicesJoueurs = ['alpha', 'beta', 'gamma'];
      const avec = annulerIndices([
        { auteurId: 'a', mot: indicesJoueurs[0]! },
        { auteurId: 'b', mot: indicesJoueurs[1]! },
        { auteurId: 'c', mot: indicesJoueurs[2]! },
        { auteurId: JUSTONE_HOTE, mot: i % 7 === 0 ? indicesJoueurs[0]! : `hote${i}` },
      ]);
      const sans = annulerIndices([
        { auteurId: 'a', mot: indicesJoueurs[0]! },
        { auteurId: 'b', mot: indicesJoueurs[1]! },
        { auteurId: 'c', mot: indicesJoueurs[2]! },
      ]);
      for (const id of ['a', 'b', 'c']) {
        const gainAvec = avec.find((ligne) => ligne.auteurId === id)?.annule ? 0 : 2;
        const gainSans = sans.find((ligne) => ligne.auteurId === id)?.annule ? 0 : 2;
        expect(gainAvec).toBeGreaterThanOrEqual(gainSans);
      }
      void alea;
    }
  });

  it('projette le secret hors du devineur et hors de la télé avant la fin', () => {
    const ctx = contexte(() => 0);
    let etat = partieJustOne(ctx);
    etat = jouer(etat, { type: 'lancerMancheJustOne' }, hote, ctx);
    const manche = etat.course!.justone!.manches[0]!;
    const vueTv = projeterCourse(etat.course!, 'tv', null)?.justone?.courante;
    expect(vueTv?.mot).toBeNull();
    expect(JSON.stringify(vueTv)).not.toContain(manche.mot);
    const vueDev = projeterCourse(etat.course!, 'joueur', manche.devineurId)?.justone?.courante;
    expect(vueDev?.mot).toBeNull();
    const indiceur = etat.course!.ordre.find((id) => id !== manche.devineurId)!;
    expect(projeterCourse(etat.course!, 'joueur', indiceur)?.justone?.courante?.mot).toBe(manche.mot);
  });
});
