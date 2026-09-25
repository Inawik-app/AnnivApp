import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { trophees } from '../shared/trophees';
import type { Action, EtatJeu, Origine, ReseauVue, TypeCase } from '../shared/types';
import { lireCatalogueTrophees, lireCartesMalchance, lireConfigPlateau, lireRoue } from './course-config';
import { etatInitial } from './etat-initial';
import { lireCatalogue, lireJeopardy, lirePoker, lireTopTen, lireUndercover } from './mini-jeux-config';
import { reduire, type ContexteReduction } from './reducteur';
import { vueHote, vueJoueur, vueTv, type Presence } from './vues';

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOTE: Origine = { role: 'hote' };
const PRESENCE: Presence = { enLigne: {}, latenceJoueur: {}, appareils: [] };
const RESEAU: ReseauVue = {
  ip: '127.0.0.1',
  port: 1,
  autres: [],
  urlTv: '',
  urlJoueur: '',
  urlHote: '',
  urlDiag: '',
};

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
    cartes: [],
    cartesMalchance: lireCartesMalchance(RACINE),
    roue: lireRoue(RACINE),
    catalogue: lireCatalogue(RACINE),
    poker: lirePoker(RACINE),
    topten: lireTopTen(RACINE),
    jeopardy: lireJeopardy(RACINE),
    undercover: lireUndercover(RACINE),
    ...partiel,
  };
}

function jouer(etat: EtatJeu, action: Action, origine: Origine, ctx: ContexteReduction): EtatJeu {
  const resultat = reduire(etat, action, origine, ctx);
  expect(resultat.ok, resultat.ok ? '' : resultat.erreur).toBe(true);
  if (!resultat.ok) throw new Error(resultat.erreur);
  ctx.prochainIdEvenement = resultat.prochainIdEvenement;
  return resultat.etat;
}

function refuser(etat: EtatJeu, action: Action, ctx: ContexteReduction): string {
  const resultat = reduire(etat, action, HOTE, ctx);
  expect(resultat.ok).toBe(false);
  if (resultat.ok) throw new Error('action acceptée');
  return resultat.erreur;
}

function inscrire(etat: EtatJeu, ctx: ContexteReduction, pseudos: string[]): EtatJeu {
  let courant = etat;
  for (const [index, pseudo] of pseudos.entries()) {
    const avatars = ['perso-carpe', 'perso-verre-eau', 'perso-piment', 'perso-planete'];
    courant = jouer(
      courant,
      { type: 'rejoindre', pseudo, avatar: avatars[index] ?? 'perso-carpe' },
      { role: 'joueur', joueurId: null },
      ctx,
    );
  }
  return courant;
}

describe('fin de course', () => {
  it('laisse finir le tour après la première arrivée, puis refuse un nouveau tour', () => {
    const faces = [4, 4, 1];
    const plateau = lireConfigPlateau(RACINE);
    plateau.longueur = 4;
    plateau.disposition = ['depart', 'bonus', 'bonus', 'bonus', 'arrivee'] as TypeCase[];
    const ctx = contexte({
      plateau,
      tirerDe: () => faces.shift(),
    });
    let etat = inscrire(etatInitial('GP Party'), ctx, ['Inès', 'Noé', 'Lina']);
    etat = jouer(etat, { type: 'demarrerCourse' }, HOTE, ctx);
    etat = jouer(etat, { type: 'nouveauTour' }, HOTE, ctx);
    etat = jouer(etat, { type: 'choisirMiniJeu', id: 'pong-gobelets' }, HOTE, ctx);
    etat = jouer(etat, { type: 'passerAuxDeplacements' }, HOTE, ctx);
    const ordre = etat.course?.ordre ?? [];
    etat = jouer(etat, { type: 'lancerDe', option: 'normal' }, { role: 'joueur', joueurId: ordre[0] ?? null }, ctx);
    expect(etat.course?.dernierTour).toBe(true);
    expect(etat.course?.phase).toBe('deplacements');
    expect(etat.course?.arrivees).toEqual([ordre[0]]);
    expect(etat.evenements.some((evenement) => evenement.type === 'course.dernierTour' && evenement.libelle === 'Dernier tour !')).toBe(true);
    etat = jouer(etat, { type: 'lancerDe', option: 'normal' }, { role: 'joueur', joueurId: ordre[1] ?? null }, ctx);
    expect(etat.course?.phase).toBe('deplacements');
    expect(etat.course?.arrivees).toEqual([ordre[0], ordre[1]]);
    etat = jouer(etat, { type: 'lancerDe', option: 'normal' }, { role: 'joueur', joueurId: ordre[2] ?? null }, ctx);
    expect(etat.course?.phase).toBe('terminee');
    expect(etat.course?.arrivees).toHaveLength(2);
    expect(etat.course?.classement?.[0]).toBe(ordre[0]);
    expect(etat.course?.classement?.[1]).toBe(ordre[1]);
    expect(refuser(etat, { type: 'nouveauTour' }, ctx)).toBe('La course est terminée');
  });
});

describe('cérémonie', () => {
  const catalogue = lireCatalogueTrophees(RACINE);

  function courseTerminee(pseudos: string[]): { etat: EtatJeu; ctx: ContexteReduction; ids: string[] } {
    const ctx = contexte();
    const etat = etatInitial('GP Party');
    pseudos.forEach((pseudo, index) => {
      etat.joueurs.push({
        id: `j${index}`,
        pseudo,
        avatar: ['perso-carpe', 'perso-verre-eau', 'perso-piment', 'perso-planete'][index] ?? 'perso-carpe',
        couleur: '#fff',
        rejointA: index,
      });
    });
    const ids = etat.joueurs.map((joueur) => joueur.id);
    const positions: Record<string, number> = {};
    for (const id of ids) positions[id] = 0;
    etat.course = {
      active: true,
      disposition: ['depart', 'bonus', 'arrivee'],
      positions,
      arrivees: [...ids],
      cagnotte: 0,
      pioches: { chance: [], malchance: [] },
      defausses: { chance: [], malchance: [] },
      tour: 4,
      phase: 'terminee',
      ordre: [...ids],
      indexCourant: 0,
      etape: null,
      miniJeu: null,
      miniJeuId: null,
      joues: [],
      grilleVisible: false,
      ecranMini: null,
      resultatsSaisis: false,
      minuteur: { etat: 'arrete', finA: null, resteMs: 0, libelle: '' },
      poker: { actif: false, niveau: 0 },
      topten: null,
      jeopardy: null,
      undercover: null,
      choisitId: null,
      carteCourante: null,
      dernierDe: null,
      classement: [...ids],
      dernierTour: true,
      ceremonie: null,
      regles: {
        longueur: 2,
        gainBonus: 5,
        choixMiniJeu: 'rotation',
        optionsDe: [
          { id: 'normal', nom: 'Dé normal', faces: 6, mise: 0, icone: 'de' },
          { id: 'booste', nom: 'Dé boosté', faces: 7, mise: 5, icone: 'de-dore' },
          { id: 'super', nom: 'Super dé', faces: 8, mise: 10, icone: 'super-de' },
        ],
      },
      historique: { lancers: [], effets: [], instantanes: [] },
    };
    return { etat, ctx, ids };
  }

  it('avertit quand des gains masqués ne sont pas révélés', () => {
    const ctx = contexte();
    let etat = inscrire(etatInitial('GP Party'), ctx, ['Inès', 'Noé']);
    const premier = etat.joueurs[0]?.id ?? '';
    for (let index = 0; index < 3; index += 1) {
      etat = jouer(etat, { type: 'ajouterGP', joueurId: premier, montant: 2, libelle: 'Secret', masquee: true }, HOTE, ctx);
    }
    etat = jouer(etat, { type: 'demarrerCourse' }, HOTE, ctx);
    etat = jouer(etat, { type: 'terminerCourse' }, HOTE, ctx);
    expect(refuser(etat, { type: 'ouvrirPodium' }, ctx)).toBe('3 gains masqués ne sont pas révélés');
    const force = jouer(etat, { type: 'ouvrirPodium', forcer: true }, HOTE, ctx);
    expect(force.course?.ceremonie?.etape).toBe('podium');
    expect(force.course?.ceremonie?.masqueesIgnorees).toBe(true);
    etat = jouer(etat, { type: 'revelerMasquees' }, HOTE, ctx);
    etat = jouer(etat, { type: 'ouvrirPodium' }, HOTE, ctx);
    expect(etat.course?.ceremonie?.etape).toBe('podium');
  });

  it('tire 4 trophées attribuables, ou tous ceux qui le sont', () => {
    const { etat, ctx, ids } = courseTerminee(['Inès', 'Noé', 'Lina', 'Léo']);
    const course = etat.course;
    if (!course) throw new Error('course');
    course.arrivees = [...ids];
    course.classement = [...ids];
    course.historique.effets.push(
      { tour: 1, joueurId: ids[0]!, type: 'malchance', cases: -2, gpGagnes: 0, gpPerdus: 4, gpDonnes: 0, gpRecus: 0, contrepartie: { joueurs: [], cagnotte: 0 } },
      { tour: 1, joueurId: ids[1]!, type: 'roue', cases: 0, gpGagnes: 10, gpPerdus: 8, gpDonnes: 3, gpRecus: 0, contrepartie: { joueurs: [], cagnotte: 0 }, roue: { option: 'jackpot', mise: 8, rendu: 10 } },
      { tour: 1, joueurId: ids[2]!, type: 'chance', cases: 3, gpGagnes: 6, gpPerdus: 0, gpDonnes: 0, gpRecus: 0, contrepartie: { joueurs: [], cagnotte: 0 } },
    );
    course.historique.lancers.push(
      { tour: 1, joueurId: ids[0]!, valeur: 1, usage: 'deplacement', faces: 6, mise: 0, esperance: 3.5, option: 'normal' },
      { tour: 1, joueurId: ids[0]!, valeur: 2, usage: 'deplacement', faces: 6, mise: 0, esperance: 3.5, option: 'normal' },
      { tour: 1, joueurId: ids[0]!, valeur: 1, usage: 'deplacement', faces: 6, mise: 0, esperance: 3.5, option: 'normal' },
      { tour: 1, joueurId: ids[1]!, valeur: 6, usage: 'deplacement', faces: 6, mise: 4, esperance: 3.5, option: 'normal' },
      { tour: 1, joueurId: ids[1]!, valeur: 5, usage: 'deplacement', faces: 6, mise: 4, esperance: 3.5, option: 'normal' },
      { tour: 1, joueurId: ids[1]!, valeur: 6, usage: 'deplacement', faces: 6, mise: 4, esperance: 3.5, option: 'normal' },
    );
    const attribuables = new Set(trophees(etat, catalogue.trophees).filter((trophee) => trophee.attribuable).map((trophee) => trophee.id));
    expect(attribuables.size).toBeGreaterThanOrEqual(4);
    const tire = jouer(jouer(etat, { type: 'ouvrirPodium' }, HOTE, ctx), { type: 'tirerTrophees' }, HOTE, ctx);
    const tirage = tire.course?.ceremonie?.tirage ?? [];
    expect(tirage).toHaveLength(4);
    for (const trophee of tirage) expect(attribuables.has(trophee.id)).toBe(true);
    expect(tire.evenements.some((evenement) => evenement.type === 'ceremonie.tirage' && evenement.visibilite === 'hote')).toBe(true);
    expect(JSON.stringify(vueTv(tire, PRESENCE, 0, 'x', ''))).not.toContain(tirage[0]?.nom ?? '___');

    const peu = courseTerminee(['Inès', 'Noé', 'Lina']);
    const courte = peu.etat.course;
    if (!courte) throw new Error('course');
    courte.arrivees = peu.etat.joueurs.map((joueur) => joueur.id);
    courte.classement = [...courte.arrivees];
    const seuls = trophees(peu.etat, catalogue.trophees).filter((trophee) => trophee.attribuable);
    expect(seuls.map((trophee) => trophee.id)).toEqual(['touriste']);
    const petitTirage = jouer(jouer(peu.etat, { type: 'ouvrirPodium' }, HOTE, peu.ctx), { type: 'tirerTrophees' }, HOTE, peu.ctx);
    expect(petitTirage.course?.ceremonie?.tirage.map((trophee) => trophee.id)).toEqual(['touriste']);
  });

  it('donne le trophée à tous les ex aequo, et la Remontada légendaire à part', () => {
    const poissard = catalogue.trophees.find((trophee) => trophee.id === 'poissard');
    const remontada = catalogue.trophees.find((trophee) => trophee.id === 'contre-attentes');
    if (!poissard || !remontada) throw new Error('catalogue');
    const prepare = courseTerminee(['Inès', 'Noé', 'Lina']);
    const ctx = prepare.ctx;
    ctx.trophees = [poissard];
    ctx.nombreCeremonie = 4;
    let etat = prepare.etat;
    const ids = prepare.ids;
    const course = etat.course;
    if (!course) throw new Error('course');
    for (const id of [ids[0], ids[1]]) {
      course.historique.effets.push({
        tour: 1,
        joueurId: id!,
        type: 'malchance',
        cases: 0,
        gpGagnes: 0,
        gpPerdus: 1,
        gpDonnes: 0,
        gpRecus: 0,
        contrepartie: { joueurs: [], cagnotte: 0 },
      });
    }
    etat = jouer(etat, { type: 'ouvrirPodium' }, HOTE, ctx);
    etat = jouer(etat, { type: 'tirerTrophees' }, HOTE, ctx);
    const tire = etat.course?.ceremonie?.tirage ?? [];
    expect(tire).toHaveLength(1);
    expect(tire[0]?.gagnants.slice().sort()).toEqual([ids[0], ids[1]].sort());
    etat = jouer(etat, { type: 'revelerTrophee' }, HOTE, ctx);
    const credits = etat.transactions.filter((transaction) => transaction.source === 'trophee');
    expect(credits).toHaveLength(2);
    expect(credits.every((transaction) => transaction.montant === 12)).toBe(true);

    const prepareLegende = courseTerminee(['Inès', 'Noé', 'Lina', 'Léo']);
    const ctxLegende = prepareLegende.ctx;
    ctxLegende.trophees = [remontada];
    ctxLegende.nombreCeremonie = 4;
    let legende = prepareLegende.etat;
    const legendeIds = prepareLegende.ids as [string, string, string, string];
    const [ines, noe, lina, leo] = legendeIds;
    const plateau = legende.course;
    if (!plateau) throw new Error('course');
    plateau.regles.longueur = 38;
    plateau.arrivees = [ines, noe, lina, leo];
    plateau.historique.instantanes.push(
      {
        tour: 3,
        distanceLeader: 8,
        joueurs: [
          { id: ines, position: 5, rang: 4, gpVisibles: 1 },
          { id: noe, position: 30, rang: 1, gpVisibles: 40 },
          { id: lina, position: 20, rang: 2, gpVisibles: 20 },
          { id: leo, position: 12, rang: 3, gpVisibles: 10 },
        ],
      },
      {
        tour: 4,
        distanceLeader: 0,
        joueurs: [
          { id: ines, position: 38, rang: 1, gpVisibles: 30 },
          { id: noe, position: 38, rang: 2, gpVisibles: 20 },
          { id: lina, position: 38, rang: 3, gpVisibles: 10 },
          { id: leo, position: 38, rang: 4, gpVisibles: 5 },
        ],
      },
    );
    const vue = trophees(legende, [remontada])[0];
    expect(vue?.nom).toBe('Remontada légendaire');
    expect(vue?.montant).toBe(20);
    expect(vue?.icone).toBe('couronne-flammes');
    legende = jouer(legende, { type: 'ouvrirPodium' }, HOTE, ctxLegende);
    legende = jouer(legende, { type: 'tirerTrophees' }, HOTE, ctxLegende);
    expect(legende.course?.ceremonie?.tirage[0]?.nom).toBe('Remontada légendaire');
    expect(legende.course?.ceremonie?.tirage[0]?.montant).toBe(20);
    const avant = JSON.stringify(vueTv(legende, PRESENCE, 0, 'x', ''));
    expect(avant).not.toContain('Remontada légendaire');
    const hote = vueHote(legende, PRESENCE, 0, 'x', true, RESEAU, null, null);
    expect(hote.course?.ceremonie?.suivants[0]?.nom).toBe('Remontada légendaire');
    expect(vueJoueur(legende, PRESENCE, 0, 'x', ines).course?.ceremonie?.suivants).toEqual([]);
    legende = jouer(legende, { type: 'revelerTrophee' }, HOTE, ctxLegende);
    const gain = legende.transactions.find((transaction) => transaction.source === 'trophee');
    expect(gain?.montant).toBe(20);
    expect(gain?.libelle).toContain('Remontada légendaire');
    expect(gain?.joueurId).toBe(ines);
    expect(JSON.stringify(vueTv(legende, PRESENCE, 0, 'x', ''))).toContain('Remontada légendaire');
  });
});

describe('pouvoirs', () => {
  it('ne laisse plus de draft dans le cahier ni dans la config', () => {
    const cahier = fs.readFileSync(path.join(RACINE, 'docs', 'cahier-des-charges.md'), 'utf8');
    expect(cahier).not.toContain('Draft des pouvoirs');
    expect(cahier).not.toContain('carte pouvoir');
    expect(cahier).toContain('trophées de rattrapage');
    expect(fs.existsSync(path.join(RACINE, 'config', 'pouvoirs.json'))).toBe(false);
    const types = fs.readFileSync(path.join(RACINE, 'shared', 'types.ts'), 'utf8');
    expect(types).not.toContain('draftPouvoir');
  });
});
