import { JOUEURS_FICTIFS } from '../shared/constantes';
import { clePseudo, solde } from '../shared/soldes';
import type { Action, EtatJeu, Origine } from '../shared/types';
import { plafondMise } from './plateau';

const FICTIFS = new Set(JOUEURS_FICTIFS.map((fictif) => clePseudo(fictif.pseudo)));

export function actionBot(etat: EtatJeu, alea: (max: number) => number): { action: Action; origine: Origine } | null {
  if (!etat.bots || !etat.course?.active) return null;
  const course = etat.course;
  const bots = etat.joueurs.filter((joueur) => FICTIFS.has(clePseudo(joueur.pseudo)) && course.positions[joueur.id] !== undefined);
  if (bots.length === 0) return null;

  if (course.phase === 'mises' && !course.misesCloturees) {
    const enAttente = bots.find((joueur) => course.mises[joueur.id] === null || course.mises[joueur.id] === undefined);
    if (!enAttente) return null;
    const plafond = plafondMise(solde(etat.transactions, enAttente.id, 'visibles'), course.regles.miseMax);
    return {
      action: { type: 'miser', montant: alea(plafond + 1) },
      origine: { role: 'joueur', joueurId: enAttente.id },
    };
  }

  if (course.phase !== 'deplacements' || !course.etape) return null;
  const courantId = course.ordre[course.indexCourant];
  const courant = bots.find((joueur) => joueur.id === courantId);

  if (course.etape.genre === 'lancer' && courant) {
    return { action: { type: 'lancerDe' }, origine: { role: 'joueur', joueurId: courant.id } };
  }
  if (course.etape.genre === 'cadeau' && courant) {
    const autres = etat.joueurs.filter((joueur) => joueur.id !== courant.id && course.positions[joueur.id] !== undefined);
    if (autres.length === 0) return null;
    const choisi = autres[alea(autres.length)];
    if (!choisi) return null;
    return {
      action: { type: 'choisirBeneficiaire', joueurId: choisi.id },
      origine: { role: 'joueur', joueurId: courant.id },
    };
  }
  if (course.etape.genre === 'duel' && course.etape.duel.etape === 'adversaire' && courant) {
    const autres = etat.joueurs.filter((joueur) => joueur.id !== courant.id && course.positions[joueur.id] !== undefined);
    if (autres.length === 0) return null;
    const choisi = autres[alea(autres.length)];
    if (!choisi) return null;
    return {
      action: { type: 'choisirAdversaire', joueurId: choisi.id },
      origine: { role: 'joueur', joueurId: courant.id },
    };
  }
  if (course.etape.genre === 'duel' && course.etape.duel.etape === 'mises') {
    const duel = course.etape.duel;
    const enAttente = bots.find((joueur) => duel.mises[joueur.id] === null);
    if (!enAttente) return null;
    const plafond = plafondMise(solde(etat.transactions, enAttente.id, 'visibles'), course.regles.duel.miseMax);
    return {
      action: { type: 'miserDuel', montant: alea(plafond + 1) },
      origine: { role: 'joueur', joueurId: enAttente.id },
    };
  }
  return null;
}

export function delaiBot(etat: EtatJeu): number {
  return etat.course?.phase === 'deplacements' && etat.course.etape?.genre === 'lancer' ? 1000 : 400;
}
