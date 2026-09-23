import { NUMERO_MAX, NUMERO_MIN, REPONDANT_HOTE, numeroValide, scoreTopTen, type Devines } from '../shared/topten';
import type { Action, Course, EtatJeu, MancheTopTen, Origine, Visibilite } from '../shared/types';
import type { ContexteCourse } from './course';
import { trouverJoueur } from './libelles';
import { crediter } from './mini-jeux';
import { melanger } from './plateau';

type Ajouter = (
  draft: EtatJeu,
  type: string,
  visibilite: Visibilite,
  libelle: string,
  donnees?: Record<string, unknown>,
) => void;

export const ACTIONS_TOPTEN = new Set<Action['type']>(['lancerMancheTopTen', 'validerOrdreTopTen', 'recapTopTen']);

function pseudo(etat: EtatJeu, joueurId: string): string {
  return trouverJoueur(etat.joueurs, joueurId)?.pseudo ?? 'Un joueur';
}

export function mancheCourante(course: Course): MancheTopTen | null {
  const manches = course.topten?.manches ?? [];
  return manches[manches.length - 1] ?? null;
}

function toutesJouees(course: Course): boolean {
  const topten = course.topten;
  if (!topten) return false;
  const derniere = mancheCourante(course);
  return topten.manches.length >= topten.captens.length && (!derniere || derniere.etape === 'revelee');
}

export function themesDisponibles(themesJoues: number[], nbThemes: number): number[] {
  const joues = new Set(themesJoues);
  const libres: number[] = [];
  for (let index = 0; index < nbThemes; index += 1) if (!joues.has(index)) libres.push(index);
  return libres;
}

function refuserOrdre(manche: MancheTopTen, ordre: unknown, devines: unknown): string | null {
  if (!Array.isArray(ordre) || ordre.length !== manche.repondants.length) return 'Classe tous les répondants';
  const vus = new Set<string>();
  for (const id of ordre) {
    if (typeof id !== 'string' || !manche.repondants.includes(id)) return "Ce répondant ne joue pas cette manche";
    if (vus.has(id)) return 'Un répondant apparaît deux fois';
    vus.add(id);
  }
  if (!devines || typeof devines !== 'object' || Array.isArray(devines)) return 'Les numéros devinés sont illisibles';
  for (const [id, valeur] of Object.entries(devines as Record<string, unknown>)) {
    if (!manche.repondants.includes(id)) return "Ce répondant ne joue pas cette manche";
    if (valeur !== null && !numeroValide(valeur)) return `Un numéro deviné va de ${NUMERO_MIN} à ${NUMERO_MAX}`;
  }
  return null;
}

export function refuserTopTen(etat: EtatJeu, action: Action, origine: Origine, ctx: ContexteCourse): string | null {
  const hote = origine.role === 'hote';
  const course = etat.course;
  if (!course || course.phase !== 'miniJeu' || course.ecranMini !== 'topten' || !course.topten) {
    return "Le Top Ten n'est pas en cours";
  }
  const topten = course.topten;
  const manche = mancheCourante(course);
  switch (action.type) {
    case 'lancerMancheTopTen': {
      if (!hote) return "Seul l'hôte peut faire cette action";
      if (topten.recap) return 'Le Top Ten est terminé';
      if (manche && manche.etape !== 'revelee') return "La manche en cours n'est pas révélée";
      if (topten.manches.length >= topten.captens.length) return 'Toutes les manches sont jouées';
      if (themesDisponibles(topten.themesJoues, ctx.topten.themes.length).length === 0) {
        return 'Tous les thèmes ont déjà été joués ce soir';
      }
      return null;
    }
    case 'validerOrdreTopTen': {
      if (!manche || manche.etape !== 'reponses') return "Aucun ordre n'est attendu";
      if (!hote && (origine.role !== 'joueur' || origine.joueurId !== manche.captenId)) {
        return "Seul le Cap'Ten classe les réponses";
      }
      return refuserOrdre(manche, action.ordre, action.devines);
    }
    case 'recapTopTen':
      if (!hote) return "Seul l'hôte peut faire cette action";
      if (topten.recap) return 'Le récapitulatif est déjà affiché';
      if (topten.manches.length === 0 || !toutesJouees(course)) return 'Toutes les manches ne sont pas jouées';
      return null;
    default:
      return 'Action inconnue';
  }
}

export function appliquerTopTen(draft: EtatJeu, action: Action, ctx: ContexteCourse, ajouter: Ajouter): void {
  const course = draft.course;
  const topten = course?.topten;
  if (!course || !topten) return;
  switch (action.type) {
    case 'lancerMancheTopTen': {
      const captenId = topten.captens[topten.manches.length];
      if (!captenId) return;
      const libres = themesDisponibles(topten.themesJoues, ctx.topten.themes.length);
      const indexTheme = libres[ctx.alea(libres.length)]!;
      const theme = ctx.topten.themes[indexTheme]!;
      const repondants = [...course.ordre.filter((id) => id !== captenId), REPONDANT_HOTE];
      const tirage = melanger(
        Array.from({ length: NUMERO_MAX - NUMERO_MIN + 1 }, (_, index) => NUMERO_MIN + index),
        ctx.alea,
      );
      const numeros: Record<string, number> = {};
      repondants.forEach((id, index) => {
        numeros[id] = tirage[index]!;
      });
      const numero = topten.manches.length + 1;
      topten.themesJoues.push(indexTheme);
      topten.manches.push({
        numero,
        captenId,
        indexTheme,
        theme: { ...theme },
        repondants,
        numeros,
        etape: 'reponses',
        proposition: null,
        score: null,
      });
      ajouter(draft, 'topten.manche', 'public', `Top Ten, manche ${numero} : ${pseudo(draft, captenId)} est Cap'Ten`, {
        numero,
        captenId,
        theme: theme.intitule,
      });
      return;
    }
    case 'validerOrdreTopTen': {
      const manche = mancheCourante(course);
      if (!manche) return;
      const devines: Devines = {};
      for (const id of manche.repondants) {
        const valeur = action.devines[id];
        devines[id] = numeroValide(valeur) ? valeur : null;
      }
      const score = scoreTopTen(action.ordre, manche.numeros, devines, ctx.topten);
      manche.proposition = { ordre: [...action.ordre], devines };
      manche.score = score;
      manche.etape = 'revelee';
      ajouter(
        draft,
        'topten.revelation',
        'public',
        `Top Ten : ${pseudo(draft, manche.captenId)} marque ${score.total} GP`,
        { numero: manche.numero, captenId: manche.captenId, total: score.total },
      );
      crediter(draft, ctx, ajouter, manche.captenId, score.total, 'Top Ten', 'mini-jeu');
      return;
    }
    case 'recapTopTen': {
      topten.recap = true;
      course.resultatsSaisis = true;
      ajouter(draft, 'topten.recap', 'public', 'Top Ten : récapitulatif', {
        gains: topten.manches.map((manche) => ({ captenId: manche.captenId, total: manche.score?.total ?? 0 })),
      });
      return;
    }
    default:
      return;
  }
}

/** Un joueur retiré ne sera plus Cap'Ten ; une manche déjà lancée garde ses répondants. */
export function oublierJoueurTopTen(course: Course, joueurId: string): void {
  const topten = course.topten;
  if (!topten) return;
  const joues = topten.captens.slice(0, topten.manches.length);
  const restants = topten.captens.slice(topten.manches.length).filter((id) => id !== joueurId);
  topten.captens = [...joues, ...restants];
}
