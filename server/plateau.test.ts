import { describe, expect, it } from 'vitest';
import { etatInitial } from './etat-initial';
import { lireCartesChance, lireConfigPlateau } from './course-config';
import { lireCatalogue, lirePoker } from './mini-jeux-config';
import { reduire, type ContexteReduction } from './reducteur';
import { creerStore } from './store';
import { vueJoueur, vueTv } from './vues';
import { esperanceDe, probabilitesDe } from '../shared/de';
import { solde } from '../shared/soldes';
import type { Action, ConfigPlateau, EtatJeu, Origine } from '../shared/types';
import { creditsDuel, genererDisposition } from './plateau';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const hote: Origine = { role: 'hote' };

function aleaFixe(valeur: number): (max: number) => number {
  return (max) => (max <= 0 ? 0 : valeur % max);
}

function contexte(partiel: Partial<ContexteReduction> = {}): ContexteReduction {
  let n = 0;
  const plateau = lireConfigPlateau(RACINE);
  return {
    maintenant: 1_700_000_000_000,
    id: () => `id-${String(++n)}`,
    prochainIdEvenement: 1,
    dev: true,
    nbJoueursMax: 4,
    estEnLigne: () => false,
    alea: aleaFixe(0),
    plateau,
    cartes: lireCartesChance(RACINE),
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

function partie(ctx: ContexteReduction, pseudos = ['Mira', 'Noé', 'Lina', 'Sacha']): EtatJeu {
  let etat = etatInitial('GP Party');
  for (const [index, pseudo] of pseudos.entries()) {
    etat = jouer(etat, { type: 'rejoindre', pseudo, avatar: ['soleil', 'lune', 'feuille', 'goutte'][index] ?? 'soleil' }, { role: 'joueur', joueurId: null }, ctx);
  }
  return etat;
}

describe('plateau', () => {
  it('répartit les cases sans cagnottes ni duels collés, ni au début', () => {
    const config = lireConfigPlateau(RACINE);
    for (let graine = 0; graine < 30; graine += 1) {
      let n = graine + 1;
      const disposition = genererDisposition(config, (max) => {
        n = (n * 17 + 3) % 997;
        return max <= 0 ? 0 : n % max;
      });
      expect(disposition[0]).toBe('depart');
      expect(disposition[config.longueur]).toBe('arrivee');
      expect(disposition.slice(1, 4).every((type) => type === 'bonus' || type === 'chance')).toBe(true);
      for (let index = 1; index < disposition.length - 1; index += 1) {
        if (disposition[index] === 'cagnotte') expect(disposition[index - 1]).not.toBe('cagnotte');
        if (disposition[index] === 'duel') expect(disposition[index - 1]).not.toBe('duel');
      }
    }
  });

  it('tire l\'ordre une fois et ne le retire qu\'avant le premier tour', () => {
    let n = 0;
    const ctx = contexte({
      alea: (max) => {
        n += 1;
        return max <= 0 ? 0 : n % max;
      },
    });
    let etat = partie(ctx, ['Mira', 'Noé', 'Lina']);
    etat = jouer(etat, { type: 'demarrerCourse' }, hote, ctx);
    const premier = etat.course?.ordre ?? [];
    expect(premier).toHaveLength(3);
    etat = jouer(etat, { type: 'retirerOrdre' }, hote, ctx);
    const second = etat.course?.ordre ?? [];
    expect(second).not.toEqual(premier);
    etat = jouer(etat, { type: 'nouveauTour' }, hote, ctx);
    expect(etat.course?.ordre).toEqual(second);
    const refuse = reduire(etat, { type: 'retirerOrdre' }, hote, ctx);
    expect(refuse.ok).toBe(false);
  });

  it('fait tourner le choix du mini-jeu, ou le donne au dernier du classement', () => {
    const plateauSimple: ConfigPlateau = {
      ...lireConfigPlateau(RACINE),
      longueur: 6,
      disposition: ['depart', 'bonus', 'bonus', 'bonus', 'bonus', 'bonus', 'arrivee'],
    };
    const ctx = contexte({ alea: () => 0, tirerDe: () => 1, plateau: plateauSimple });
    let etat = partie(ctx, ['Mira', 'Noé']);
    const mira = etat.joueurs[0]!.id;
    const noe = etat.joueurs[1]!.id;
    etat = jouer(etat, { type: 'ajouterGP', joueurId: mira, montant: 30, libelle: 'Bonus' }, hote, ctx);
    etat = jouer(etat, { type: 'ajouterGP', joueurId: noe, montant: 10, libelle: 'Bonus' }, hote, ctx);
    etat = jouer(etat, { type: 'demarrerCourse' }, hote, ctx);
    const ordre = etat.course?.ordre ?? [];
    etat = jouer(etat, { type: 'nouveauTour' }, hote, ctx);
    expect(etat.course?.choisitId).toBe(ordre[0]);
    etat = jouer(etat, { type: 'choisirMiniJeu', id: 'pong-gobelets' }, hote, ctx);
    etat = jouer(etat, { type: 'passerAuxDeplacements' }, hote, ctx);
    while (etat.course?.phase === 'deplacements') {
      const courant = etat.course.ordre[etat.course.indexCourant];
      etat = jouer(etat, { type: 'lancerDe', mise: 0 }, { role: 'joueur', joueurId: courant! }, ctx);
    }
    etat = jouer(etat, { type: 'nouveauTour' }, hote, ctx);
    expect(etat.course?.choisitId).toBe(ordre[1]);
    const classement = contexte({
      alea: () => 0,
      plateau: { ...lireConfigPlateau(RACINE), choixMiniJeu: 'dernierAuClassement' },
    });
    let autre = partie(classement, ['Mira', 'Noé']);
    const riche = autre.joueurs[0]!.id;
    const pauvre = autre.joueurs[1]!.id;
    autre = jouer(autre, { type: 'ajouterGP', joueurId: riche, montant: 30, libelle: 'Bonus' }, hote, classement);
    autre = jouer(autre, { type: 'ajouterGP', joueurId: pauvre, montant: 4, libelle: 'Bonus' }, hote, classement);
    autre = jouer(autre, { type: 'demarrerCourse' }, hote, classement);
    autre = jouer(autre, { type: 'nouveauTour' }, hote, classement);
    expect(autre.course?.choisitId).toBe(pauvre);
  });

  it('refuse une mise au-dessus du solde ou du maximum, booste le dé, et l\'annulation remet tout', () => {
    const ctx = contexte({ alea: (max) => Math.max(0, max - 1), tirerDe: () => 1 });
    let etat = partie(ctx, ['Mira', 'Noé']);
    const mira = etat.joueurs[0]!.id;
    etat = jouer(etat, { type: 'ajouterGP', joueurId: mira, montant: 4, libelle: 'Bonus' }, hote, ctx);
    etat = jouer(etat, { type: 'demarrerCourse' }, hote, ctx);
    etat = jouer(etat, { type: 'nouveauTour' }, hote, ctx);
    etat = jouer(etat, { type: 'choisirMiniJeu', id: 'pong-gobelets' }, hote, ctx);
    etat = jouer(etat, { type: 'passerAuxDeplacements' }, hote, ctx);
    const trop = reduire(etat, { type: 'lancerDe', mise: 11 }, { role: 'joueur', joueurId: mira }, ctx);
    expect(trop.ok).toBe(false);
    const pauvre = reduire(etat, { type: 'lancerDe', mise: 5 }, { role: 'joueur', joueurId: mira }, ctx);
    expect(pauvre.ok).toBe(false);
    const avantPosition = etat.course?.positions[mira];
    etat = jouer(etat, { type: 'lancerDe', mise: 4 }, { role: 'joueur', joueurId: mira }, ctx);
    expect(etat.course?.cagnotte).toBeGreaterThanOrEqual(4);
    expect(etat.transactions.some((transaction) => transaction.joueurId === mira && transaction.montant === -4 && transaction.source === 'mise')).toBe(true);
    const lancer = etat.course?.historique.lancers.find((entree) => entree.usage === 'deplacement');
    const regles = etat.course?.regles;
    expect(lancer?.mise).toBe(4);
    expect(lancer?.esperance).toBeCloseTo(esperanceDe(probabilitesDe(4, regles?.miseMax ?? 0, regles?.probasMiseMax ?? [])), 10);
    expect(etat.course?.positions[mira]).not.toBe(avantPosition);
    expect(etat.course?.historique.effets.length).toBeGreaterThan(0);
  });

  it('verse la moitié basse de la cagnotte et garde le reste', () => {
    const plateau: ConfigPlateau = {
      ...lireConfigPlateau(RACINE),
      disposition: ['depart', 'cagnotte', 'bonus', 'bonus', 'bonus', 'arrivee'],
      longueur: 5,
    };
    const ctx = contexte({ plateau, alea: (max) => Math.max(0, max - 1), tirerDe: () => 1 });
    let etat = partie(ctx, ['Mira', 'Noé']);
    const mira = etat.joueurs[0]!.id;
    const noe = etat.joueurs[1]!.id;
    etat = jouer(etat, { type: 'ajouterGP', joueurId: mira, montant: 20, libelle: 'Bonus' }, hote, ctx);
    etat = jouer(etat, { type: 'ajouterGP', joueurId: noe, montant: 20, libelle: 'Bonus' }, hote, ctx);
    etat = jouer(etat, { type: 'demarrerCourse' }, hote, ctx);
    etat = jouer(etat, { type: 'nouveauTour' }, hote, ctx);
    etat = jouer(etat, { type: 'choisirMiniJeu', id: 'pong-gobelets' }, hote, ctx);
    etat = jouer(etat, { type: 'passerAuxDeplacements' }, hote, ctx);
    etat = jouer(etat, { type: 'lancerDe', mise: 5 }, { role: 'joueur', joueurId: mira }, ctx);
    expect(etat.course?.positions[mira]).toBe(1);
    expect(etat.course?.cagnotte).toBe(3);
    expect(solde(etat.transactions, mira, 'visibles')).toBe(20 - 5 + 2);
  });

  it('ne retire des GP à personne avec une carte chance, et le cadeau est gratuit', () => {
    const cartes = lireCartesChance(RACINE);
    for (const carte of cartes) {
      if (carte.effet.type === 'gain' || carte.effet.type === 'gainTous' || carte.effet.type === 'cadeau') {
        expect(carte.effet.montant).toBeGreaterThan(0);
      }
    }
    const plateau: ConfigPlateau = {
      ...lireConfigPlateau(RACINE),
      longueur: 4,
      disposition: ['depart', 'chance', 'bonus', 'bonus', 'arrivee'],
    };
    const ctx = contexte({
      plateau,
      alea: (max) => Math.max(0, max - 1),
      tirerDe: () => 1,
      cartes: [{ id: 'cadeau', titre: 'Cadeau', texte: 'Offre.', effet: { type: 'cadeau', montant: 6 } }],
    });
    let etat = partie(ctx, ['Mira', 'Noé']);
    const mira = etat.joueurs[0]!.id;
    const noe = etat.joueurs[1]!.id;
    etat = jouer(etat, { type: 'ajouterGP', joueurId: mira, montant: 10, libelle: 'Bonus' }, hote, ctx);
    etat = jouer(etat, { type: 'ajouterGP', joueurId: noe, montant: 10, libelle: 'Bonus' }, hote, ctx);
    etat = jouer(etat, { type: 'demarrerCourse' }, hote, ctx);
    etat = jouer(etat, { type: 'nouveauTour' }, hote, ctx);
    etat = jouer(etat, { type: 'choisirMiniJeu', id: 'pong-gobelets' }, hote, ctx);
    etat = jouer(etat, { type: 'passerAuxDeplacements' }, hote, ctx);
    etat = jouer(etat, { type: 'lancerDe', mise: 1 }, { role: 'joueur', joueurId: mira }, ctx);
    expect(etat.course?.etape?.genre).toBe('cadeau');
    const avant = solde(etat.transactions, mira, 'visibles');
    etat = jouer(etat, { type: 'choisirBeneficiaire', joueurId: noe }, { role: 'joueur', joueurId: mira }, ctx);
    expect(solde(etat.transactions, mira, 'visibles')).toBe(avant);
    expect(solde(etat.transactions, noe, 'visibles')).toBe(16);
  });

  it('règle un duel : victoire, défaite et égalité', () => {
    expect(creditsDuel(4, 2, 'joueur', 5)).toEqual({ joueur: 11, adversaire: 0 });
    expect(creditsDuel(4, 2, 'adversaire', 5)).toEqual({ joueur: 0, adversaire: 11 });
    expect(creditsDuel(4, 2, 'egalite', 5)).toEqual({ joueur: 4, adversaire: 2 });
    const plateau: ConfigPlateau = {
      ...lireConfigPlateau(RACINE),
      longueur: 4,
      disposition: ['depart', 'duel', 'bonus', 'bonus', 'arrivee'],
    };
    const ctx = contexte({ plateau, alea: (max) => Math.max(0, max - 1), tirerDe: () => 1 });
    let etat = partie(ctx, ['Mira', 'Noé']);
    const mira = etat.joueurs[0]!.id;
    const noe = etat.joueurs[1]!.id;
    etat = jouer(etat, { type: 'ajouterGP', joueurId: mira, montant: 30, libelle: 'Bonus' }, hote, ctx);
    etat = jouer(etat, { type: 'ajouterGP', joueurId: noe, montant: 30, libelle: 'Bonus' }, hote, ctx);
    etat = jouer(etat, { type: 'demarrerCourse' }, hote, ctx);
    etat = jouer(etat, { type: 'nouveauTour' }, hote, ctx);
    etat = jouer(etat, { type: 'choisirMiniJeu', id: 'pong-gobelets' }, hote, ctx);
    etat = jouer(etat, { type: 'passerAuxDeplacements' }, hote, ctx);
    etat = jouer(etat, { type: 'lancerDe', mise: 1 }, { role: 'joueur', joueurId: mira }, ctx);
    etat = jouer(etat, { type: 'choisirAdversaire', joueurId: noe }, { role: 'joueur', joueurId: mira }, ctx);
    etat = jouer(etat, { type: 'miserDuel', montant: 4 }, { role: 'joueur', joueurId: mira }, ctx);
    etat = jouer(etat, { type: 'miserDuel', montant: 2 }, { role: 'joueur', joueurId: noe }, ctx);
    etat = jouer(etat, { type: 'resultatDuel', resultat: 'adversaire' }, hote, ctx);
    expect(solde(etat.transactions, mira, 'visibles')).toBe(30 - 1 - 4);
    expect(solde(etat.transactions, noe, 'visibles')).toBe(30 - 2 + 4 + 2 + 5);
  });

  it("plaque l'arrivée, donne le rang, et empêche de relancer", () => {
    const plateau: ConfigPlateau = {
      ...lireConfigPlateau(RACINE),
      longueur: 4,
      disposition: ['depart', 'bonus', 'bonus', 'bonus', 'arrivee'],
    };
    const ctx = contexte({ plateau, alea: (max) => Math.max(0, max - 1) });
    let etat = partie(ctx, ['Mira', 'Noé']);
    const mira = etat.joueurs[0]!.id;
    etat = jouer(etat, { type: 'ajouterGP', joueurId: mira, montant: 5, libelle: 'Bonus' }, hote, ctx);
    etat = jouer(etat, { type: 'demarrerCourse' }, hote, ctx);
    etat = jouer(etat, { type: 'nouveauTour' }, hote, ctx);
    etat = jouer(etat, { type: 'choisirMiniJeu', id: 'pong-gobelets' }, hote, ctx);
    etat = jouer(etat, { type: 'passerAuxDeplacements' }, hote, ctx);
    etat = jouer(etat, { type: 'lancerDe', mise: 1 }, { role: 'joueur', joueurId: mira }, ctx);
    expect(etat.course?.positions[mira]).toBe(4);
    expect(etat.course?.arrivees).toEqual([mira]);
    const relance = reduire(etat, { type: 'lancerDe', mise: 1 }, { role: 'joueur', joueurId: mira }, ctx);
    expect(relance.ok).toBe(false);
  });

  it('garde secrètes les mises de duel tant qu\'elles ne sont pas révélées', () => {
    const plateau: ConfigPlateau = {
      ...lireConfigPlateau(RACINE),
      longueur: 4,
      disposition: ['depart', 'duel', 'bonus', 'bonus', 'arrivee'],
    };
    const ctx = contexte({ plateau, alea: (max) => Math.max(0, max - 1), tirerDe: () => 1 });
    let etat = partie(ctx, ['Mira', 'Noé']);
    const mira = etat.joueurs[0]!.id;
    const noe = etat.joueurs[1]!.id;
    etat = jouer(etat, { type: 'ajouterGP', joueurId: mira, montant: 20, libelle: 'Bonus' }, hote, ctx);
    etat = jouer(etat, { type: 'ajouterGP', joueurId: noe, montant: 20, libelle: 'Bonus' }, hote, ctx);
    etat = jouer(etat, { type: 'demarrerCourse' }, hote, ctx);
    etat = jouer(etat, { type: 'nouveauTour' }, hote, ctx);
    etat = jouer(etat, { type: 'choisirMiniJeu', id: 'pong-gobelets' }, hote, ctx);
    etat = jouer(etat, { type: 'passerAuxDeplacements' }, hote, ctx);
    etat = jouer(etat, { type: 'lancerDe', mise: 0 }, { role: 'joueur', joueurId: mira }, ctx);
    etat = jouer(etat, { type: 'choisirAdversaire', joueurId: noe }, { role: 'joueur', joueurId: mira }, ctx);
    etat = jouer(etat, { type: 'miserDuel', montant: 7 }, { role: 'joueur', joueurId: mira }, ctx);
    const tv = vueTv(etat, { enLigne: {}, latenceJoueur: {}, appareils: [] }, 1, 'dem', 'http://x');
    const autre = vueJoueur(etat, { enLigne: {}, latenceJoueur: {}, appareils: [] }, 1, 'dem', noe);
    expect(JSON.stringify(tv)).not.toContain('pioche');
    expect(tv.course?.duel?.mises.find((mise) => mise.joueurId === mira)?.montant).toBeUndefined();
    expect(autre.course?.duel?.mises.find((mise) => mise.joueurId === mira)?.montant).toBeUndefined();
  });

  it('joue 12 tours avec 4 joueurs sans casser les invariants', () => {
    let graine = 11;
    const alea = (max: number) => {
      graine = (graine * 1664525 + 1013904223) >>> 0;
      return max <= 0 ? 0 : graine % max;
    };
    const ctx = contexte({ alea });
    let etat = partie(ctx);
    for (const joueur of etat.joueurs) {
      etat = jouer(etat, { type: 'ajouterGP', joueurId: joueur.id, montant: 80, libelle: 'Cagnotte de départ' }, hote, ctx);
    }
    etat = jouer(etat, { type: 'demarrerCourse' }, hote, ctx);
    const verifier = () => {
      const course = etat.course;
      expect(course).toBeTruthy();
      if (!course) return;
      expect(course.cagnotte).toBeGreaterThanOrEqual(0);
      for (const joueur of etat.joueurs) {
        const position = course.positions[joueur.id] ?? 0;
        expect(position).toBeGreaterThanOrEqual(0);
        expect(position).toBeLessThanOrEqual(course.regles.longueur);
        expect(solde(etat.transactions, joueur.id, 'visibles')).toBeGreaterThanOrEqual(0);
      }
      for (const transaction of etat.transactions) {
        if (transaction.montant < 0) expect(transaction.source).toBe('mise');
      }
    };
    for (let tour = 0; tour < 12 && etat.course?.phase !== 'terminee'; tour += 1) {
      etat = jouer(etat, { type: 'nouveauTour' }, hote, ctx);
      etat = jouer(etat, { type: 'choisirMiniJeu', id: 'pong-gobelets' }, hote, ctx);
      etat = jouer(etat, { type: 'passerAuxDeplacements' }, hote, ctx);
      let garde = 0;
      while (etat.course?.phase === 'deplacements' && garde < 40) {
        garde += 1;
        verifier();
        const course = etat.course;
        const courant = course.ordre[course.indexCourant];
        if (course.etape?.genre === 'lancer' && courant) {
          const plafond = Math.min(course.regles.miseMax, solde(etat.transactions, courant, 'visibles'));
          etat = jouer(etat, { type: 'lancerDe', mise: alea(plafond + 1) }, { role: 'joueur', joueurId: courant }, ctx);
        } else if (course.etape?.genre === 'cadeau' && courant) {
          const autre = etat.joueurs.find((joueur) => joueur.id !== courant);
          etat = jouer(etat, { type: 'choisirBeneficiaire', joueurId: autre!.id }, { role: 'joueur', joueurId: courant }, ctx);
        } else if (course.etape?.genre === 'duel' && course.etape.duel.etape === 'adversaire' && courant) {
          const autre = etat.joueurs.find((joueur) => joueur.id !== courant);
          etat = jouer(etat, { type: 'choisirAdversaire', joueurId: autre!.id }, { role: 'joueur', joueurId: courant }, ctx);
        } else if (course.etape?.genre === 'duel' && course.etape.duel.etape === 'mises') {
          const duel = course.etape.duel;
          const ids = [duel.joueurId, duel.adversaireId].filter((id): id is string => !!id);
          for (const id of ids) {
            if (duel.mises[id] !== null) continue;
            const plafond = Math.min(course.regles.duel.miseMax, solde(etat.transactions, id, 'visibles'));
            etat = jouer(etat, { type: 'miserDuel', montant: alea(plafond + 1) }, { role: 'joueur', joueurId: id }, ctx);
          }
        } else if (course.etape?.genre === 'duel' && course.etape.duel.etape === 'resultat') {
          const issus = ['joueur', 'adversaire', 'egalite'] as const;
          etat = jouer(etat, { type: 'resultatDuel', resultat: issus[alea(3)] ?? 'egalite' }, hote, ctx);
        } else {
          throw new Error(`Tour bloqué : ${course.etape?.genre ?? 'sans étape'}`);
        }
      }
      verifier();
      expect(etat.course?.phase === 'finTour' || etat.course?.phase === 'terminee').toBe(true);
    }
    expect(etat.course?.historique.lancers.length).toBeGreaterThan(0);
  });

  it('annule un lancer et permet de relancer', () => {
    const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'gp-course-'));
    const store = creerStore({
      dossierData: dossier,
      titre: 'GP Party',
      nbJoueursMax: 4,
      dev: true,
      sauvegardesAuto: false,
      alea: () => 0,
    });
    store.dispatch({ type: 'rejoindre', pseudo: 'Mira', avatar: 'soleil' }, { role: 'joueur', joueurId: null });
    store.dispatch({ type: 'rejoindre', pseudo: 'Noé', avatar: 'lune' }, { role: 'joueur', joueurId: null });
    const courant = store.etat().joueurs[0]!.id;
    store.dispatch({ type: 'ajouterGP', joueurId: courant, montant: 8, libelle: 'Bonus' }, hote);
    store.dispatch({ type: 'ajouterGP', joueurId: store.etat().joueurs[1]!.id, montant: 8, libelle: 'Bonus' }, hote);
    store.dispatch({ type: 'demarrerCourse' }, hote);
    const lanceur = store.etat().course?.ordre[0] ?? courant;
    store.dispatch({ type: 'nouveauTour' }, hote);
    store.dispatch({ type: 'choisirMiniJeu', id: 'pong-gobelets' }, hote);
    store.dispatch({ type: 'passerAuxDeplacements' }, hote);
    const avant = store.etat().course?.positions[lanceur];
    const soldeAvant = solde(store.etat().transactions, lanceur, 'visibles');
    store.dispatch({ type: 'lancerDe', mise: 2 }, { role: 'joueur', joueurId: lanceur });
    expect(store.etat().course?.positions[lanceur]).not.toBe(avant);
    expect(store.etat().course?.cagnotte).toBeGreaterThanOrEqual(2);
    expect(store.etat().course?.historique.effets.length).toBeGreaterThan(0);
    store.dispatch({ type: 'annuler' }, hote);
    expect(store.etat().course?.positions[lanceur]).toBe(avant);
    expect(store.etat().course?.cagnotte).toBe(0);
    expect(store.etat().course?.historique.effets).toHaveLength(0);
    expect(solde(store.etat().transactions, lanceur, 'visibles')).toBe(soldeAvant);
    const relance = store.dispatch({ type: 'lancerDe', mise: 2 }, { role: 'joueur', joueurId: lanceur });
    expect(relance.ok).toBe(true);
    store.fermer();
    fs.rmSync(dossier, { recursive: true, force: true });
  });
});
