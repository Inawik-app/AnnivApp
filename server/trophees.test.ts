import { describe, expect, it } from 'vitest';
import { statistiques } from '../shared/statistiques';
import { trophees, type TropheeConfig } from '../shared/trophees';
import type { EffetPlateau, EtatJeu, InstantaneTour, LancerDe } from '../shared/types';
import { lireCatalogueTrophees } from './course-config';
import { etatInitial } from './etat-initial';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function partie(): { etat: EtatJeu; ids: string[] } {
  const etat = etatInitial('GP Party');
  const pseudos = ['Inès', 'Noé', 'Lina', 'Léo'];
  pseudos.forEach((pseudo, index) => {
    etat.joueurs.push({
      id: `j${index}`,
      pseudo,
      avatar: 'soleil',
      couleur: '#fff',
      rejointA: index,
    });
  });
  etat.course = {
    active: true,
    disposition: ['depart', 'bonus', 'arrivee'],
    positions: { j0: 0, j1: 0, j2: 0, j3: 0 },
    arrivees: [],
    cagnotte: 0,
    pioches: { chance: [], malchance: [] },
    defausses: { chance: [], malchance: [] },
    carteCourante: null,
    dernierDe: null,
    tour: 4,
    phase: 'finTour',
    ordre: ['j0', 'j1', 'j2', 'j3'],
    indexCourant: 0,
    etape: null,
    choisitId: null,
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
    classement: null,
    dernierTour: false,
    ceremonie: null,
    historique: { lancers: [], effets: [], instantanes: [] },
    regles: {
      longueur: 38,
      gainBonus: 5,
      choixMiniJeu: 'rotation',
      optionsDe: [
        { id: 'normal', nom: 'Dé normal', faces: 6, mise: 0, icone: 'de' },
        { id: 'booste', nom: 'Dé boosté', faces: 7, mise: 5, icone: 'de-dore' },
        { id: 'super', nom: 'Super dé', faces: 8, mise: 10, icone: 'super-de' },
      ],
    },
  };
  return { etat, ids: ['j0', 'j1', 'j2', 'j3'] };
}

function lancer(joueurId: string, faces: number, valeur: number, mise: number): LancerDe {
  return {
    tour: 1,
    joueurId,
    valeur,
    usage: 'deplacement',
    faces,
    mise,
    esperance: (faces + 1) / 2,
    option: faces === 8 ? 'super' : faces === 7 ? 'booste' : 'normal',
  };
}

function effet(partiel: Partial<EffetPlateau> & Pick<EffetPlateau, 'joueurId' | 'type'>): EffetPlateau {
  return {
    tour: 1,
    cases: 0,
    gpGagnes: 0,
    gpPerdus: 0,
    gpDonnes: 0,
    gpRecus: 0,
    contrepartie: { joueurs: [], cagnotte: 0 },
    ...partiel,
  };
}

function photo(tour: number, distanceLeader: number, lignes: InstantaneTour['joueurs']): InstantaneTour {
  return { tour, distanceLeader, joueurs: lignes };
}

function catalogue(): TropheeConfig[] {
  return lireCatalogueTrophees(RACINE).trophees;
}

function parId(etat: EtatJeu, id: string) {
  const trouve = trophees(etat, catalogue()).find((trophee) => trophee.id === id);
  if (!trouve) throw new Error(id);
  return trouve;
}

describe('statistiques et trophées', () => {
  it('calcule l\'indice de chance avec les trois dés', () => {
    const { etat, ids } = partie();
    const [ines, noe] = ids;
    etat.course!.historique.lancers.push(
      lancer(ines!, 6, 3, 0),
      lancer(ines!, 7, 3, 5),
      lancer(ines!, 8, 3, 10),
      lancer(noe!, 6, 4, 0),
      lancer(noe!, 6, 3, 0),
      lancer(noe!, 6, 4, 0),
    );
    const stats = statistiques(etat);
    expect(stats[ines!]?.lancers).toBe(3);
    expect(stats[ines!]?.indiceChance).toBeCloseTo(-1, 8);
    expect(stats[ines!]?.misesDe).toBe(15);
    expect(stats[noe!]?.indiceChance).toBeCloseTo(1 / 6, 8);
    const trophee = parId(etat, 'malchanceux');
    expect(trophee.attribuable).toBe(true);
    expect(trophee.gagnants).toEqual([ines]);
    expect(trophee.phrase).toBe('Inès : \u22121,0 par lancer en moyenne');
  });

  it('n\'attribue pas un trophée à égalité, ni sans données', () => {
    const { etat, ids } = partie();
    etat.course!.historique.lancers.push(
      lancer(ids[0]!, 6, 2, 0),
      lancer(ids[0]!, 6, 2, 0),
      lancer(ids[0]!, 6, 2, 0),
      lancer(ids[1]!, 6, 2, 0),
      lancer(ids[1]!, 6, 2, 0),
      lancer(ids[1]!, 6, 2, 0),
    );
    expect(parId(etat, 'malchanceux').attribuable).toBe(false);
    expect(parId(etat, 'poissard').attribuable).toBe(false);
    expect(parId(etat, 'dernier-pingpong').attribuable).toBe(false);
    expect(parId(etat, 'pas-verni').attribuable).toBe(false);
    expect(parId(etat, 'touriste').attribuable).toBe(false);
    const premier = trophees(etat, catalogue());
    const second = trophees(etat, catalogue());
    expect(JSON.stringify(premier)).toBe(JSON.stringify(second));
  });

  it('compte malchance, reculs, échanges, mises et jeux', () => {
    const { etat, ids } = partie();
    const [ines, noe, lina] = ids;
    etat.course!.historique.effets.push(
      effet({
        joueurId: ines!,
        type: 'malchance',
        cases: -2,
        gpPerdus: 5,
        gpDonnes: 4,
        contrepartie: { joueurs: [{ id: noe!, montant: 2 }, { id: lina!, montant: 2 }], cagnotte: 1 },
      }),
      effet({
        joueurId: noe!,
        type: 'chance',
        gpRecus: 2,
        contrepartie: { joueurs: [{ id: ines!, montant: -2 }], cagnotte: 0 },
      }),
      effet({
        joueurId: ines!,
        type: 'roue',
        cases: -3,
        gpGagnes: 20,
        gpPerdus: 10,
        roue: { option: 'pacte', mise: 10, rendu: 20 },
      }),
      effet({
        joueurId: noe!,
        type: 'roue',
        gpGagnes: 50,
        gpPerdus: 10,
        roue: { option: 'jackpot', mise: 10, rendu: 50 },
      }),
      effet({ joueurId: lina!, type: 'chance', cases: 4 }),
    );
    etat.transactions.push(
      { id: 't1', joueurId: ines!, montant: 8, source: 'mini-jeu', libelle: 'Pong gobelets', horodatage: 1, masquee: false },
      { id: 't2', joueurId: noe!, montant: 4, source: 'mini-jeu', libelle: 'Ping-pong', horodatage: 1, masquee: false },
      { id: 't3', joueurId: lina!, montant: 6, source: 'poker', libelle: 'Poker', horodatage: 1, masquee: false },
    );
    const stats = statistiques(etat);
    expect(stats[ines!]).toMatchObject({
      cartesMalchance: 1,
      gpMalchance: 5,
      casesReculees: 5,
      casesReculeesCartes: 2,
      casesReculeesPacte: 3,
      gpDonnes: 6,
      misesRoue: 10,
      resultatRoue: 10,
      gpHorsPlateau: 8,
    });
    expect(stats[noe!]?.gpRecus).toBe(4);
    expect(stats[noe!]?.jackpots).toBe(1);
    expect(stats[noe!]?.gpParJeu['ping-pong']).toBe(4);
    expect(stats[lina!]?.casesAvanceesHorsDe).toBe(4);
    expect(stats[lina!]?.gpParJeu.poker).toBe(6);
    expect(parId(etat, 'poissard').gagnants).toEqual([ines]);
    expect(parId(etat, 'marche-arriere').gagnants).toEqual([ines]);
    expect(parId(etat, 'genereux').gagnants).toEqual([ines]);
    expect(parId(etat, 'flambeur').gagnants).toEqual([ines, noe]);
    expect(parId(etat, 'prudent').gagnants).toEqual([lina, ids[3]]);
    expect(parId(etat, 'dernier-pingpong').gagnants).toEqual([ines, lina, ids[3]]);
    expect(parId(etat, 'pas-verni').gagnants).toEqual([ids[3]]);
  });

  it('désigne la remontada légendaire, une remontée ordinaire, et départage au retard', () => {
    const { etat, ids } = partie();
    const [ines, noe, lina, leo] = ids as [string, string, string, string];
    etat.course!.regles.longueur = 38;
    etat.course!.arrivees = [ines, noe, lina, leo];
    etat.course!.historique.instantanes.push(
      photo(3, 8, [
        { id: ines, position: 5, rang: 4, gpVisibles: 1 },
        { id: noe, position: 30, rang: 1, gpVisibles: 40 },
        { id: lina, position: 20, rang: 2, gpVisibles: 20 },
        { id: leo, position: 12, rang: 3, gpVisibles: 10 },
      ]),
      photo(4, 0, [
        { id: ines, position: 38, rang: 1, gpVisibles: 30 },
        { id: noe, position: 38, rang: 2, gpVisibles: 20 },
        { id: lina, position: 38, rang: 3, gpVisibles: 10 },
        { id: leo, position: 38, rang: 4, gpVisibles: 5 },
      ]),
    );
    const stats = statistiques(etat);
    expect(stats[ines]?.pireRang).toBe(4);
    expect(stats[ines]?.rangArrivee).toBe(1);
    expect(stats[ines]?.remontee).toBe(3);
    expect(stats[ines]?.legendaire).toBe(true);
    expect(stats[ines]?.retardMax).toBe(25);
    const legendaire = parId(etat, 'contre-attentes');
    expect(legendaire.nom).toBe('Remontada légendaire');
    expect(legendaire.icone).toBe('couronne-flammes');
    expect(legendaire.montant).toBe(20);
    expect(legendaire.gagnants).toEqual([ines]);
    expect(parId(etat, 'touriste').gagnants).toEqual([leo]);

    etat.course!.historique.instantanes[0]!.distanceLeader = 9;
    const ordinaire = parId(etat, 'contre-attentes');
    expect(ordinaire.nom).toBe('Contre toutes attentes');
    expect(ordinaire.icone).toBe('trophee-audacieux');
    expect(ordinaire.montant).toBe(12);
    expect(ordinaire.attribuable).toBe(true);

    etat.course!.arrivees = [noe, ines, lina, leo];
    etat.course!.historique.instantanes[0] = photo(3, 8, [
      { id: ines, position: 5, rang: 4, gpVisibles: 1 },
      { id: noe, position: 22, rang: 3, gpVisibles: 10 },
      { id: lina, position: 30, rang: 1, gpVisibles: 10 },
      { id: leo, position: 28, rang: 2, gpVisibles: 10 },
    ]);
    const departage = parId(etat, 'contre-attentes');
    expect(statistiques(etat)[ines]?.remontee).toBe(2);
    expect(statistiques(etat)[noe]?.remontee).toBe(2);
    expect(departage.gagnants).toEqual([ines]);
    expect(departage.nom).toBe('Contre toutes attentes');
  });

  it('mesure les places gagnées au classement GP entre la mi-partie et la fin', () => {
    const { etat, ids } = partie();
    const [ines, noe, lina, leo] = ids as [string, string, string, string];
    etat.course!.arrivees = [ines, noe, lina, leo];
    etat.course!.historique.instantanes.push(
      photo(1, 30, [
        { id: ines, position: 2, rang: 4, gpVisibles: 1 },
        { id: noe, position: 8, rang: 1, gpVisibles: 40 },
        { id: lina, position: 6, rang: 2, gpVisibles: 20 },
        { id: leo, position: 4, rang: 3, gpVisibles: 10 },
      ]),
      photo(2, 20, [
        { id: ines, position: 4, rang: 4, gpVisibles: 2 },
        { id: noe, position: 18, rang: 1, gpVisibles: 30 },
        { id: lina, position: 12, rang: 2, gpVisibles: 20 },
        { id: leo, position: 8, rang: 3, gpVisibles: 15 },
      ]),
      photo(4, 0, [
        { id: ines, position: 38, rang: 1, gpVisibles: 50 },
        { id: noe, position: 38, rang: 2, gpVisibles: 10 },
        { id: lina, position: 38, rang: 3, gpVisibles: 8 },
        { id: leo, position: 38, rang: 4, gpVisibles: 4 },
      ]),
    );
    const stats = statistiques(etat);
    expect(stats[ines]?.rangGpMi).toBe(4);
    expect(stats[ines]?.rangGpFinal).toBe(1);
    expect(stats[ines]?.placesGp).toBe(3);
    expect(parId(etat, 'retour-gagnant').gagnants).toEqual([ines]);
    expect(stats[ines]?.rangs).toEqual([4, 4, 1]);
  });

  it('charge un catalogue dont chaque critère est connu', () => {
    const lu = lireCatalogueTrophees(RACINE);
    expect(lu.nombreCeremonie).toBe(4);
    expect(lu.trophees.map((trophee) => trophee.id)).toEqual([
      'malchanceux',
      'poissard',
      'marche-arriere',
      'genereux',
      'pas-verni',
      'dernier-pingpong',
      'flambeur',
      'prudent',
      'touriste',
      'contre-attentes',
      'retour-gagnant',
    ]);
  });
});
