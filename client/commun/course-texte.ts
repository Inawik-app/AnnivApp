import type { Action, CourseVue } from '../../shared/types';

export function pseudoDe(pseudos: ReadonlyMap<string, string>, id: string | null): string {
  if (!id) return 'Un joueur';
  return pseudos.get(id) ?? 'Un joueur';
}

export function textePhase(course: CourseVue, pseudos: ReadonlyMap<string, string>): string {
  if (course.phase === 'preparation') return 'Le plateau est prêt';
  if (course.phase === 'choixMiniJeu') return `${pseudoDe(pseudos, course.choisitId)} choisit le mini-jeu`;
  if (course.phase === 'miniJeu') return course.miniJeu ?? 'Mini-jeu';
  if (course.phase === 'finTour') return 'Fin du tour';
  if (course.phase === 'terminee') return 'Course terminée';
  if (course.etape === 'roue') return `${pseudoDe(pseudos, course.joueurCourantId)} mise à la roue`;
  if (course.joueurCourantId) return `${pseudoDe(pseudos, course.joueurCourantId)} choisit son dé`;
  return 'Déplacements';
}

export function etapeSuivante(course: CourseVue): { libelle: string; action: Action } | null {
  if (course.phase === 'preparation') return { libelle: 'Commencer le tour 1', action: { type: 'nouveauTour' } };
  if (course.phase === 'miniJeu') return { libelle: 'Passer aux déplacements', action: { type: 'passerAuxDeplacements' } };
  if (course.phase === 'finTour' && !course.dernierTour) return { libelle: 'Nouveau tour', action: { type: 'nouveauTour' } };
  return null;
}
