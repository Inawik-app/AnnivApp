import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { etatInitial } from './etat-initial';
import { lireCatalogue, lireJeopardy, lirePoker, lireTopTen, lireCodenames, lirePerudo, lireUndercover, lireJustOne } from './mini-jeux-config';
import { lireCartesChance, lireCartesMalchance, lireConfigPlateau, lireRoue } from './course-config';
import { reduire, type ContexteReduction } from './reducteur';
import { solde } from '../shared/soldes';
import {
  dureeNiveauMs,
  ecranPour,
  gainsClassement,
  modulePret,
  repartirTapisHote,
  validerCatalogue,
} from '../shared/mini-jeux';
import type { Action, EtatJeu, Origine } from '../shared/types';

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

function partie(ctx: ContexteReduction): EtatJeu {
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
  return etat;
}

describe('mini-jeux', () => {
  it('donne le barème du meilleur rang partagé, y compris les ex aequo', () => {
    const bareme = [10, 6, 3, 1];
    expect(
      gainsClassement(
        [
          { joueurId: 'a', exAequo: false },
          { joueurId: 'b', exAequo: true },
          { joueurId: 'c', exAequo: false },
          { joueurId: 'd', exAequo: false },
        ],
        bareme,
      ),
    ).toEqual([
      { joueurId: 'a', montant: 10, rang: 1 },
      { joueurId: 'b', montant: 10, rang: 1 },
      { joueurId: 'c', montant: 3, rang: 3 },
      { joueurId: 'd', montant: 1, rang: 4 },
    ]);
    expect(
      gainsClassement(
        [
          { joueurId: 'a', exAequo: true },
          { joueurId: 'b', exAequo: false },
          { joueurId: 'c', exAequo: true },
        ],
        bareme,
      ),
    ).toEqual([
      { joueurId: 'a', montant: 10, rang: 1 },
      { joueurId: 'b', montant: 6, rang: 2 },
      { joueurId: 'c', montant: 6, rang: 2 },
    ]);
  });

  it('refuse un fichier de mini-jeux avec un message précis', () => {
    const brut = JSON.parse(fs.readFileSync(path.join(RACINE, 'config', 'mini-jeux.json'), 'utf8')) as {
      jeux: Array<{ id: string; regles: string[] }>;
    };
    const poker = brut.jeux.find((jeu) => jeu.id === 'poker');
    if (!poker) throw new Error('poker absent');
    poker.regles = ['Une ligne', 'Deux lignes'];
    expect(() => validerCatalogue(brut)).toThrow(
      'mini-jeux.json : le mini-jeu « poker » doit avoir entre 3 et 5 règles',
    );
  });

  it('charge les mini-jeux et le poker prévus', () => {
    const catalogue = lireCatalogue(RACINE);
    expect(catalogue.baremes.classement).toEqual([10, 6, 3, 1]);
    expect(catalogue.baremes.equipes).toEqual({ gagnant: 8, perdant: 2 });
    expect(catalogue.jeux.map((jeu) => [jeu.id, jeu.saisie, jeu.duree ?? null, jeu.module, jeu.hoteParticipe])).toEqual([
      ['poker', 'libre', null, 'poker', false],
      ['jeopardy', 'libre', null, 'jeopardy', false],
      ['top-ten', 'libre', null, 'topten', true],
      ['undercover', 'libre', null, 'undercover', false],
      ['codenames', 'libre', null, 'codenames', false],
      ['perudo', 'libre', null, 'perudo', false],
      ['just-one', 'libre', null, 'justone', true],
    ]);
    const poker = lirePoker(RACINE);
    expect(poker.jetonsOfferts).toBe(20);
    expect(poker.dureeMinutes).toBe(30);
    expect(poker.niveaux).toEqual([
      { petite: 1, grosse: 2 },
      { petite: 2, grosse: 4 },
      { petite: 4, grosse: 8 },
    ]);
    expect(dureeNiveauMs(poker)).toBe(600_000);
    expect(poker.regles.join(' ')).toMatch(/moitié/);
    expect(poker.regles.join(' ')).toMatch(/1 pour 1/);
    expect(modulePret('jeopardy')).toBe(true);
    expect(modulePret('undercover')).toBe(true);
    expect(modulePret('codenames')).toBe(true);
    expect(modulePret('perudo')).toBe(true);
    expect(modulePret('inconnu')).toBe(false);
    expect(ecranPour('inconnu')).toBe('regles');
    expect(ecranPour('aucun')).toBe('regles');
    expect(ecranPour('jeopardy')).toBe('jeopardy');
    expect(ecranPour('poker')).toBe('poker');
    expect(ecranPour('codenames')).toBe('codenames');
  });

  it('donne le reste du tapis de l\'hôte au joueur le moins riche, le plus tôt en cas d\'égalité', () => {
    expect(
      repartirTapisHote(10, [
        { id: 'a', gpVisibles: 10 },
        { id: 'b', gpVisibles: 3 },
        { id: 'c', gpVisibles: 8 },
        { id: 'd', gpVisibles: 3 },
      ]),
    ).toEqual([
      { joueurId: 'a', montant: 2 },
      { joueurId: 'b', montant: 4 },
      { joueurId: 'c', montant: 2 },
      { joueurId: 'd', montant: 2 },
    ]);
  });

  it('enregistre un classement avec ex aequo et refuse un montant négatif', () => {
    const catalogue = lireCatalogue(RACINE);
    const libre = { ...catalogue.jeux[0]!, id: 'libre-test', nom: 'Libre', saisie: 'libre' as const, module: 'aucun' as const, resume: 'Test', icone: 'de', regles: ['a', 'b', 'c'] };
    const physique = {
      ...catalogue.jeux[0]!,
      id: 'classement-test',
      nom: 'Classement test',
      saisie: 'classement' as const,
      module: 'aucun' as const,
      resume: 'Test',
      icone: 'de',
      regles: ['a', 'b', 'c'],
    };
    const ctx = contexte({ catalogue: { ...catalogue, jeux: [...catalogue.jeux, libre, physique] } });
    let etat = partie(ctx);
    etat = jouer(etat, { type: 'choisirMiniJeu', id: 'libre-test' }, hote, ctx);
    expect(etat.course?.ecranMini).toBe('regles');
    const [mira, noe, lina, sacha] = etat.joueurs;
    if (!mira || !noe || !lina || !sacha) throw new Error('joueurs');
    const refuse = reduire(
      etat,
      {
        type: 'validerResultats',
        saisie: {
          mode: 'libre',
          montants: { [mira.id]: -1, [noe.id]: 0, [lina.id]: 0, [sacha.id]: 0 },
        },
      },
      hote,
      ctx,
    );
    expect(refuse.ok).toBe(false);
    etat = partie(ctx);
    etat = jouer(etat, { type: 'choisirMiniJeu', id: 'classement-test' }, hote, ctx);
    const joueurs = etat.joueurs;
    const premier = joueurs[0];
    const deuxieme = joueurs[1];
    const troisieme = joueurs[2];
    const quatrieme = joueurs[3];
    if (!premier || !deuxieme || !troisieme || !quatrieme) throw new Error('joueurs');
    etat = jouer(
      etat,
      {
        type: 'validerResultats',
        saisie: {
          mode: 'classement',
          ordre: [
            { joueurId: premier.id, exAequo: false },
            { joueurId: deuxieme.id, exAequo: true },
            { joueurId: troisieme.id, exAequo: false },
            { joueurId: quatrieme.id, exAequo: false },
          ],
        },
      },
      hote,
      ctx,
    );
    const montants = new Map(
      etat.transactions.filter((transaction) => transaction.source === 'mini-jeu').map((transaction) => [transaction.joueurId, transaction.montant]),
    );
    expect(montants.get(premier.id)).toBe(10);
    expect(montants.get(deuxieme.id)).toBe(10);
    expect(montants.get(troisieme.id)).toBe(3);
    expect(montants.get(quatrieme.id)).toBe(1);
    expect(etat.evenements.some((evenement) => evenement.type === 'minijeu.podium')).toBe(true);
    expect(etat.course?.joues).toContain('classement-test');
  });

  it('enchaîne les niveaux de blinds puis convertit les tapis', () => {
    const ctx = contexte();
    let etat = partie(ctx);
    for (const [index, montant] of [10, 3, 8, 3].entries()) {
      etat = jouer(etat, { type: 'ajouterGP', joueurId: etat.joueurs[index]!.id, montant, libelle: 'Bonus' }, hote, ctx);
    }
    etat = jouer(etat, { type: 'choisirMiniJeu', id: 'poker' }, hote, ctx);
    expect(etat.course?.ecranMini).toBe('poker');
    expect(etat.course?.poker).toEqual({ actif: true, niveau: 0 });
    etat = jouer(etat, { type: 'demarrerMinuteur', duree: 600, libelle: 'Blinds' }, hote, ctx);
    for (const niveau of [1, 2]) {
      const fin = etat.course?.minuteur.finA;
      if (fin === null || fin === undefined) throw new Error('fin absente');
      ctx.maintenant = fin;
      etat = jouer(etat, { type: 'echeanceMinuteur' }, hote, ctx);
      expect(etat.course?.poker.niveau).toBe(niveau);
      expect(etat.course?.minuteur.etat).toBe('enCours');
      expect(etat.course?.minuteur.finA).toBe(ctx.maintenant + 600_000);
    }
    const finDernier = etat.course?.minuteur.finA;
    if (finDernier === null || finDernier === undefined) throw new Error('fin absente');
    ctx.maintenant = finDernier;
    etat = jouer(etat, { type: 'echeanceMinuteur' }, hote, ctx);
    expect(etat.course?.poker.niveau).toBe(2);
    expect(etat.course?.minuteur.etat).toBe('arrete');
    const bloque = reduire(etat, { type: 'niveauSuivant' }, hote, ctx);
    expect(bloque.ok).toBe(false);

    const ids = etat.joueurs.map((joueur) => joueur.id);
    const tapis = Object.fromEntries(ids.map((id) => [id, 5]));
    const avant = new Map(ids.map((id) => [id, solde(etat.transactions, id, 'visibles')]));
    etat = jouer(etat, { type: 'validerPoker', tapis, tapisHote: 10 }, hote, ctx);
    const credits = etat.transactions.filter((transaction) => transaction.source === 'poker');
    expect(credits.every((transaction) => transaction.montant > 0)).toBe(true);
    const parJoueur = new Map(credits.map((transaction) => [transaction.joueurId, transaction.montant]));
    expect(parJoueur.get(ids[0]!)).toBe(7);
    expect(parJoueur.get(ids[1]!)).toBe(9);
    expect(parJoueur.get(ids[2]!)).toBe(7);
    expect(parJoueur.get(ids[3]!)).toBe(7);
    expect(solde(etat.transactions, ids[1]!, 'visibles')).toBe((avant.get(ids[1]!) ?? 0) + 9);
  });
});
