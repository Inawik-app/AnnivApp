import { describe, expect, it } from 'vitest';
import { etatInitial } from './etat-initial';
import { lireCartesChance, lireConfigPlateau } from './course-config';
import { reduire, type ContexteReduction } from './reducteur';
import { creerStore } from './store';
import { vueJoueur, vueTv } from './vues';
import { solde } from '../shared/soldes';
import type { Action, ConfigPlateau, EtatJeu, Origine } from '../shared/types';
import { calculerOrdre, creditsDuel, genererDisposition } from './plateau';
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

  it('classe par mise, puis par GP, puis par tirage', () => {
    const stable = calculerOrdre(
      [
        { id: 'gros', mise: 8, gp: 20 },
        { id: 'petit', mise: 8, gp: 3 },
        { id: 'faible', mise: 1, gp: 0 },
      ],
      aleaFixe(0),
    );
    expect(stable.ordre).toEqual(['petit', 'gros', 'faible']);
    expect(stable.tirage).toBe(false);
    const garde = calculerOrdre(
      [
        { id: 'a', mise: 4, gp: 5 },
        { id: 'b', mise: 4, gp: 5 },
      ],
      aleaFixe(1),
    );
    const echange = calculerOrdre(
      [
        { id: 'a', mise: 4, gp: 5 },
        { id: 'b', mise: 4, gp: 5 },
      ],
      aleaFixe(0),
    );
    expect(garde.tirage).toBe(true);
    expect(echange.tirage).toBe(true);
    expect(garde.ordre).not.toEqual(echange.ordre);
  });

  it('refuse une mise au-dessus du solde ou du maximum', () => {
    const ctx = contexte();
    let etat = partie(ctx, ['Mira', 'Noé']);
    const mira = etat.joueurs[0]!.id;
    etat = jouer(etat, { type: 'ajouterGP', joueurId: mira, montant: 4, libelle: 'Bonus' }, hote, ctx);
    etat = jouer(etat, { type: 'demarrerCourse' }, hote, ctx);
    etat = jouer(etat, { type: 'nouveauTour' }, hote, ctx);
    const trop = reduire(etat, { type: 'miser', montant: 11 }, { role: 'joueur', joueurId: mira }, ctx);
    expect(trop.ok).toBe(false);
    const pauvre = reduire(etat, { type: 'miser', montant: 5 }, { role: 'joueur', joueurId: mira }, ctx);
    expect(pauvre.ok).toBe(false);
    etat = jouer(etat, { type: 'miser', montant: 4 }, { role: 'joueur', joueurId: mira }, ctx);
    expect(etat.course?.mises[mira]).toBe(4);
  });

  it('verse la moitié basse de la cagnotte et garde le reste', () => {
    const plateau: ConfigPlateau = {
      ...lireConfigPlateau(RACINE),
      disposition: ['depart', 'cagnotte', 'bonus', 'bonus', 'bonus', 'arrivee'],
      longueur: 5,
    };
    const ctx = contexte({ plateau, alea: aleaFixe(0) });
    let etat = partie(ctx, ['Mira', 'Noé']);
    const mira = etat.joueurs[0]!.id;
    const noe = etat.joueurs[1]!.id;
    etat = jouer(etat, { type: 'ajouterGP', joueurId: mira, montant: 20, libelle: 'Bonus' }, hote, ctx);
    etat = jouer(etat, { type: 'ajouterGP', joueurId: noe, montant: 20, libelle: 'Bonus' }, hote, ctx);
    etat = jouer(etat, { type: 'demarrerCourse' }, hote, ctx);
    etat = jouer(etat, { type: 'nouveauTour' }, hote, ctx);
    etat = jouer(etat, { type: 'miser', montant: 5 }, { role: 'joueur', joueurId: mira }, ctx);
    etat = jouer(etat, { type: 'miser', montant: 0 }, { role: 'joueur', joueurId: noe }, ctx);
    etat = jouer(etat, { type: 'revelerMises' }, hote, ctx);
    expect(etat.course?.cagnotte).toBe(5);
    etat = jouer(etat, { type: 'passerAuChoix' }, hote, ctx);
    etat = jouer(etat, { type: 'choisirMiniJeu', nom: 'Quiz' }, hote, ctx);
    etat = jouer(etat, { type: 'passerAuxDeplacements' }, hote, ctx);
    etat = jouer(etat, { type: 'lancerDe' }, { role: 'joueur', joueurId: mira }, ctx);
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
      alea: aleaFixe(0),
      cartes: [{ id: 'cadeau', titre: 'Cadeau', texte: 'Offre.', effet: { type: 'cadeau', montant: 6 } }],
    });
    let etat = partie(ctx, ['Mira', 'Noé']);
    const mira = etat.joueurs[0]!.id;
    const noe = etat.joueurs[1]!.id;
    etat = jouer(etat, { type: 'ajouterGP', joueurId: mira, montant: 10, libelle: 'Bonus' }, hote, ctx);
    etat = jouer(etat, { type: 'ajouterGP', joueurId: noe, montant: 10, libelle: 'Bonus' }, hote, ctx);
    etat = jouer(etat, { type: 'demarrerCourse' }, hote, ctx);
    etat = jouer(etat, { type: 'nouveauTour' }, hote, ctx);
    etat = jouer(etat, { type: 'miser', montant: 1 }, { role: 'joueur', joueurId: mira }, ctx);
    etat = jouer(etat, { type: 'miser', montant: 0 }, { role: 'joueur', joueurId: noe }, ctx);
    etat = jouer(etat, { type: 'revelerMises' }, hote, ctx);
    etat = jouer(etat, { type: 'passerAuChoix' }, hote, ctx);
    etat = jouer(etat, { type: 'choisirMiniJeu', nom: 'Quiz' }, hote, ctx);
    etat = jouer(etat, { type: 'passerAuxDeplacements' }, hote, ctx);
    etat = jouer(etat, { type: 'lancerDe' }, { role: 'joueur', joueurId: mira }, ctx);
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
    const ctx = contexte({ plateau, alea: (max) => (max <= 1 ? 0 : 0) });
    let etat = partie(ctx, ['Mira', 'Noé']);
    const mira = etat.joueurs[0]!.id;
    const noe = etat.joueurs[1]!.id;
    etat = jouer(etat, { type: 'ajouterGP', joueurId: mira, montant: 30, libelle: 'Bonus' }, hote, ctx);
    etat = jouer(etat, { type: 'ajouterGP', joueurId: noe, montant: 30, libelle: 'Bonus' }, hote, ctx);
    etat = jouer(etat, { type: 'demarrerCourse' }, hote, ctx);
    etat = jouer(etat, { type: 'nouveauTour' }, hote, ctx);
    etat = jouer(etat, { type: 'miser', montant: 1 }, { role: 'joueur', joueurId: mira }, ctx);
    etat = jouer(etat, { type: 'miser', montant: 0 }, { role: 'joueur', joueurId: noe }, ctx);
    etat = jouer(etat, { type: 'revelerMises' }, hote, ctx);
    etat = jouer(etat, { type: 'passerAuChoix' }, hote, ctx);
    etat = jouer(etat, { type: 'choisirMiniJeu', nom: 'Quiz' }, hote, ctx);
    etat = jouer(etat, { type: 'passerAuxDeplacements' }, hote, ctx);
    etat = jouer(etat, { type: 'lancerDe' }, { role: 'joueur', joueurId: mira }, ctx);
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
    etat = jouer(etat, { type: 'miser', montant: 1 }, { role: 'joueur', joueurId: mira }, ctx);
    etat = jouer(etat, { type: 'cloreMises' }, hote, ctx);
    etat = jouer(etat, { type: 'revelerMises' }, hote, ctx);
    etat = jouer(etat, { type: 'passerAuChoix' }, hote, ctx);
    etat = jouer(etat, { type: 'choisirMiniJeu', nom: 'Quiz' }, hote, ctx);
    etat = jouer(etat, { type: 'passerAuxDeplacements' }, hote, ctx);
    etat = jouer(etat, { type: 'lancerDe' }, { role: 'joueur', joueurId: mira }, ctx);
    expect(etat.course?.positions[mira]).toBe(4);
    expect(etat.course?.arrivees).toEqual([mira]);
    const relance = reduire(etat, { type: 'lancerDe' }, { role: 'joueur', joueurId: mira }, ctx);
    expect(relance.ok).toBe(false);
  });

  it('cache les mises des autres avant la révélation', () => {
    const ctx = contexte();
    let etat = partie(ctx, ['Mira', 'Noé']);
    const mira = etat.joueurs[0]!.id;
    const noe = etat.joueurs[1]!.id;
    etat = jouer(etat, { type: 'ajouterGP', joueurId: mira, montant: 20, libelle: 'Bonus' }, hote, ctx);
    etat = jouer(etat, { type: 'demarrerCourse' }, hote, ctx);
    etat = jouer(etat, { type: 'nouveauTour' }, hote, ctx);
    etat = jouer(etat, { type: 'miser', montant: 7 }, { role: 'joueur', joueurId: mira }, ctx);
    const tv = vueTv(etat, { enLigne: {}, latenceJoueur: {}, appareils: [] }, 1, 'dem', 'http://x');
    const autre = vueJoueur(etat, { enLigne: {}, latenceJoueur: {}, appareils: [] }, 1, 'dem', noe);
    const moi = vueJoueur(etat, { enLigne: {}, latenceJoueur: {}, appareils: [] }, 1, 'dem', mira);
    expect(JSON.stringify(tv)).not.toContain('pioche');
    expect(JSON.stringify(tv)).not.toContain('"montant":7');
    expect(JSON.stringify(autre)).not.toContain('"montant":7');
    expect(moi.course?.mises.find((mise) => mise.joueurId === mira)?.montant).toBe(7);
    expect(tv.course?.mises.find((mise) => mise.joueurId === mira)?.aMise).toBe(true);
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
      for (const joueur of etat.joueurs) {
        const plafond = Math.min(etat.course?.regles.miseMax ?? 0, solde(etat.transactions, joueur.id, 'visibles'));
        etat = jouer(etat, { type: 'miser', montant: alea(plafond + 1) }, { role: 'joueur', joueurId: joueur.id }, ctx);
      }
      etat = jouer(etat, { type: 'revelerMises' }, hote, ctx);
      etat = jouer(etat, { type: 'passerAuChoix' }, hote, ctx);
      etat = jouer(etat, { type: 'choisirMiniJeu', nom: 'Épreuve' }, hote, ctx);
      etat = jouer(etat, { type: 'passerAuxDeplacements' }, hote, ctx);
      let garde = 0;
      while (etat.course?.phase === 'deplacements' && garde < 40) {
        garde += 1;
        verifier();
        const course = etat.course;
        const courant = course.ordre[course.indexCourant];
        if (course.etape?.genre === 'lancer' && courant) {
          etat = jouer(etat, { type: 'lancerDe' }, { role: 'joueur', joueurId: courant }, ctx);
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
    const mira = store.etat().joueurs[0]!.id;
    store.dispatch({ type: 'ajouterGP', joueurId: mira, montant: 8, libelle: 'Bonus' }, hote);
    store.dispatch({ type: 'demarrerCourse' }, hote);
    store.dispatch({ type: 'nouveauTour' }, hote);
    store.dispatch({ type: 'miser', montant: 1 }, { role: 'joueur', joueurId: mira });
    store.dispatch({ type: 'cloreMises' }, hote);
    store.dispatch({ type: 'revelerMises' }, hote);
    store.dispatch({ type: 'passerAuChoix' }, hote);
    store.dispatch({ type: 'choisirMiniJeu', nom: 'Quiz' }, hote);
    store.dispatch({ type: 'passerAuxDeplacements' }, hote);
    const avant = store.etat().course?.positions[mira];
    store.dispatch({ type: 'lancerDe' }, { role: 'joueur', joueurId: mira });
    expect(store.etat().course?.positions[mira]).not.toBe(avant);
    store.dispatch({ type: 'annuler' }, hote);
    expect(store.etat().course?.positions[mira]).toBe(avant);
    const relance = store.dispatch({ type: 'lancerDe' }, { role: 'joueur', joueurId: mira });
    expect(relance.ok).toBe(true);
    store.fermer();
    fs.rmSync(dossier, { recursive: true, force: true });
  });
});
