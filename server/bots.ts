import { JOUEURS_FICTIFS } from '../shared/constantes';
import { clePseudo } from '../shared/soldes';
import type { Action, EtatJeu, Origine } from '../shared/types';

const FICTIFS = new Set(JOUEURS_FICTIFS.map((fictif) => clePseudo(fictif.pseudo)));

export function actionBot(etat: EtatJeu, alea: (max: number) => number): { action: Action; origine: Origine } | null {
  void alea;
  if (!etat.bots || !etat.course?.active) return null;
  const course = etat.course;
  const bots = etat.joueurs.filter((joueur) => FICTIFS.has(clePseudo(joueur.pseudo)) && course.positions[joueur.id] !== undefined);
  if (bots.length === 0) return null;

  if (course.phase !== 'deplacements' || !course.etape) return null;
  const courantId = course.ordre[course.indexCourant];
  const courant = bots.find((joueur) => joueur.id === courantId);
  if (!courant) return null;

  if (course.etape.genre === 'lancer') {
    return { action: { type: 'lancerDe', option: 'normal' }, origine: { role: 'joueur', joueurId: courant.id } };
  }
  if (course.etape.genre === 'roue') {
    return { action: { type: 'miserRoue', montant: 0 }, origine: { role: 'joueur', joueurId: courant.id } };
  }
  return null;
}

export function delaiBot(etat: EtatJeu): number {
  return etat.course?.phase === 'deplacements' && etat.course.etape?.genre === 'lancer' ? 1000 : 400;
}
