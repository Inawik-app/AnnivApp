import { describe, expect, it } from 'vitest';
import { etatInitial } from './etat-initial';
import { reduire, type ContexteReduction } from './reducteur';
import type { Action, EtatJeu, Origine } from '../shared/types';
import { solde } from '../shared/soldes';
import { verifierRegleOr } from './regle-or';

function contexte(): ContexteReduction {
  let n = 0;
  return {
    maintenant: 1_700_000_000_000,
    id: () => `id-${String(++n)}`,
    prochainIdEvenement: 1,
    dev: true,
    nbJoueursMax: 4,
    estEnLigne: () => false,
    alea: (max) => (max <= 1 ? 0 : max - 1),
    plateau: {
      longueur: 34,
      repartition: { bonus: 13, chance: 9, cagnotte: 5, duel: 6 },
      gainBonus: 5,
      miseMax: 10,
      choixMiniJeu: 'premier',
      duel: { miseMax: 10, bonusVainqueur: 5, defis: ['Défi'] },
    },
    cartes: [{ id: 'bourse', titre: 'Bourse', texte: 'Tu gagnes.', effet: { type: 'gain', montant: 3 } }],
  };
}

function jouer(etat: EtatJeu, action: Action, origine: Origine, ctx: ContexteReduction): EtatJeu {
  const resultat = reduire(etat, action, origine, ctx);
  expect(resultat.ok, !resultat.ok ? resultat.erreur : '').toBe(true);
  if (!resultat.ok) throw new Error(resultat.erreur);
  ctx.prochainIdEvenement = resultat.prochainIdEvenement;
  return resultat.etat;
}

const hote: Origine = { role: 'hote' };
const joueur: Origine = { role: 'joueur', joueurId: null };

describe('réducteur', () => {
  it('ajoute des GP et révèle les montants masqués, un événement par joueur', () => {
    const ctx = contexte();
    let etat = etatInitial('GP Party');
    etat = jouer(etat, { type: 'rejoindre', pseudo: 'Mira', avatar: 'soleil' }, joueur, ctx);
    etat = jouer(etat, { type: 'rejoindre', pseudo: 'Noé', avatar: 'lune' }, joueur, ctx);
    const mira = etat.joueurs[0]!.id;
    const noe = etat.joueurs[1]!.id;
    etat = jouer(etat, { type: 'ajouterGP', joueurId: mira, montant: 5, libelle: 'Bonus' }, hote, ctx);
    etat = jouer(etat, { type: 'ajouterGP', joueurId: mira, montant: 8, libelle: 'Secret mira', masquee: true, groupeRevelation: 'soir' }, hote, ctx);
    etat = jouer(etat, { type: 'ajouterGP', joueurId: noe, montant: 3, libelle: 'Secret noé', masquee: true, groupeRevelation: 'soir' }, hote, ctx);
    expect(solde(etat.transactions, mira, 'visibles')).toBe(5);
    expect(solde(etat.transactions, mira, 'masques')).toBe(8);
    etat = jouer(etat, { type: 'revelerMasquees', groupe: 'soir' }, hote, ctx);
    expect(solde(etat.transactions, mira, 'visibles')).toBe(13);
    expect(solde(etat.transactions, noe, 'visibles')).toBe(3);
    expect(solde(etat.transactions, mira, 'masques')).toBe(0);
    const revelations = etat.evenements.filter((evenement) => evenement.type === 'gp.reveles');
    expect(revelations).toHaveLength(2);
    expect(revelations.every((evenement) => evenement.visibilite === 'public')).toBe(true);
  });

  it('refuse un pseudo déjà pris, trop long, ou une partie complète', () => {
    const ctx = contexte();
    let etat = etatInitial('GP Party');
    etat = jouer(etat, { type: 'rejoindre', pseudo: 'Mira', avatar: 'soleil' }, joueur, ctx);
    const doublon = reduire(etat, { type: 'rejoindre', pseudo: ' mira ', avatar: 'lune' }, joueur, ctx);
    expect(doublon).toEqual({ ok: false, erreur: 'Ce pseudo est déjà pris, choisis-en un autre' });
    const long = reduire(etat, { type: 'rejoindre', pseudo: 'abcdefghijklmnopq', avatar: 'lune' }, joueur, ctx);
    expect(long.ok).toBe(false);
    etat = jouer(etat, { type: 'rejoindre', pseudo: 'Noé', avatar: 'lune' }, joueur, ctx);
    etat = jouer(etat, { type: 'rejoindre', pseudo: 'Lina', avatar: 'feuille' }, joueur, ctx);
    etat = jouer(etat, { type: 'rejoindre', pseudo: 'Sacha', avatar: 'goutte' }, joueur, ctx);
    const plein = reduire(etat, { type: 'rejoindre', pseudo: 'Eva', avatar: 'flamme' }, joueur, ctx);
    expect(plein).toEqual({ ok: false, erreur: 'La partie est complète (4 joueurs)' });
  });

  it('verrouille puis rouvre les inscriptions', () => {
    const ctx = contexte();
    let etat = etatInitial('GP Party');
    etat = jouer(etat, { type: 'verrouillerInscriptions' }, hote, ctx);
    const refuse = reduire(etat, { type: 'rejoindre', pseudo: 'Mira', avatar: 'soleil' }, joueur, ctx);
    expect(refuse).toEqual({ ok: false, erreur: 'Les inscriptions sont fermées' });
    etat = jouer(etat, { type: 'verrouillerInscriptions' }, hote, ctx);
    etat = jouer(etat, { type: 'rejoindre', pseudo: 'Mira', avatar: 'soleil' }, joueur, ctx);
    expect(etat.joueurs).toHaveLength(1);
  });

  it('refuse les actions hôte venant d\'un joueur, y compris un retrait de GP', () => {
    const ctx = contexte();
    let etat = etatInitial('GP Party');
    etat = jouer(etat, { type: 'rejoindre', pseudo: 'Mira', avatar: 'soleil' }, joueur, ctx);
    etat = jouer(etat, { type: 'rejoindre', pseudo: 'Noé', avatar: 'lune' }, joueur, ctx);
    const mira = etat.joueurs[0]!.id;
    const noe = etat.joueurs[1]!.id;
    const retrait = reduire(
      etat,
      { type: 'ajouterGP', joueurId: noe, montant: -5, libelle: 'Vol' },
      { role: 'joueur', joueurId: mira },
      ctx,
    );
    expect(retrait.ok).toBe(false);
    expect(etat.transactions).toHaveLength(0);
  });

  it('laisse l\'hôte corriger un solde à la baisse', () => {
    const ctx = contexte();
    let etat = etatInitial('GP Party');
    etat = jouer(etat, { type: 'rejoindre', pseudo: 'Mira', avatar: 'soleil' }, joueur, ctx);
    etat = jouer(etat, { type: 'ajouterGP', joueurId: etat.joueurs[0]!.id, montant: -2, libelle: 'Correction' }, hote, ctx);
    expect(solde(etat.transactions, etat.joueurs[0]!.id, 'visibles')).toBe(-2);
  });

  it('bloque une transaction négative visant un autre joueur', () => {
    const avant = etatInitial('GP Party');
    avant.joueurs = [
      { id: 'a', pseudo: 'Mira', avatar: 'soleil', couleur: '#e23d3d', rejointA: 1 },
      { id: 'b', pseudo: 'Noé', avatar: 'lune', couleur: '#2f6fed', rejointA: 2 },
    ];
    const apres = {
      ...avant,
      transactions: [
        {
          id: 't1',
          joueurId: 'b',
          montant: -4,
          source: 'manuel' as const,
          libelle: 'Piège',
          horodatage: 1,
          masquee: false,
        },
      ],
    };
    expect(verifierRegleOr(avant, apres, { role: 'joueur', joueurId: 'a' })).toBe(
      'Cette action retirerait des GP à un autre joueur',
    );
    expect(verifierRegleOr(avant, apres, { role: 'hote' })).toBeNull();
  });
});
