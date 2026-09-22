import type { Action, CourseVue } from '../../shared/types';

export function pseudoDe(pseudos: ReadonlyMap<string, string>, id: string | null): string {
  if (!id) return 'Un joueur';
  return pseudos.get(id) ?? 'Un joueur';
}

export function textePhase(course: CourseVue, pseudos: ReadonlyMap<string, string>): string {
  if (course.phase === 'preparation') return 'Le plateau est prêt';
  if (course.phase === 'mises') return 'Misez sur vos téléphones';
  if (course.phase === 'revelation') return 'Révélation des mises';
  if (course.phase === 'choixMiniJeu') return `${pseudoDe(pseudos, course.choisitId)} choisit le mini-jeu`;
  if (course.phase === 'miniJeu') return course.miniJeu ?? 'Mini-jeu';
  if (course.phase === 'finTour') return 'Fin du tour';
  if (course.phase === 'terminee') return 'Course terminée';
  if (course.etape === 'duel') return 'Duel !';
  if (course.etape === 'cadeau') return `${pseudoDe(pseudos, course.joueurCourantId)} choisit un cadeau`;
  if (course.joueurCourantId) return `${pseudoDe(pseudos, course.joueurCourantId)} lance le dé`;
  return 'Déplacements';
}

export function etapeSuivante(
  course: CourseVue,
  pseudos: ReadonlyMap<string, string>,
): { libelle: string; action: Action } | null {
  if (course.phase === 'preparation') return { libelle: 'Commencer le tour 1', action: { type: 'nouveauTour' } };
  if (course.phase === 'mises') {
    const faites = course.mises.filter((mise) => mise.aMise).length;
    if (faites < course.mises.length) {
      return { libelle: `Clore les mises (${faites}/${course.mises.length})`, action: { type: 'cloreMises' } };
    }
    return { libelle: 'Révéler les mises', action: { type: 'revelerMises' } };
  }
  if (course.phase === 'revelation') return { libelle: 'Passer au choix du mini-jeu', action: { type: 'passerAuChoix' } };
  if (course.phase === 'miniJeu') return { libelle: 'Passer aux déplacements', action: { type: 'passerAuxDeplacements' } };
  if (course.phase === 'deplacements' && course.etape === 'lancer' && course.joueurCourantId) {
    return {
      libelle: `Lancer le dé pour ${pseudoDe(pseudos, course.joueurCourantId)}`,
      action: { type: 'lancerDe' },
    };
  }
  if (course.phase === 'finTour') return { libelle: 'Nouveau tour', action: { type: 'nouveauTour' } };
  return null;
}
