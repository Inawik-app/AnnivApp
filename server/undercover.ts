import type { Action, Course, EtatJeu, MancheUndercover, Origine, UndercoverCourse, Visibilite } from '../shared/types';
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

export const ACTIONS_UNDERCOVER = new Set<Action['type']>([
  'lancerMancheUndercover',
  'eliminerUndercover',
  'devinerUndercover',
  'recapUndercover',
]);

export const JOUEURS_MIN_UNDERCOVER = 3;
export const SURVIVANTS_UNDERCOVER = 2;

function pseudo(etat: EtatJeu, joueurId: string): string {
  return trouverJoueur(etat.joueurs, joueurId)?.pseudo ?? 'Un joueur';
}

export function undercoverInitial(nbManches: number, pairesJouees: number[]): UndercoverCourse {
  return { nbManches, manches: [], pairesJouees: [...pairesJouees], recap: false };
}

export function mancheUndercover(course: Course): MancheUndercover | null {
  const manches = course.undercover?.manches ?? [];
  return manches[manches.length - 1] ?? null;
}

export function enJeu(manche: MancheUndercover): string[] {
  return manche.ordreParole.filter((id) => !manche.elimines.includes(id));
}

/** Civils mélangés, puis l'undercover inséré n'importe où sauf en premier. */
export function tirerOrdreParole(ids: string[], undercoverId: string, alea: (max: number) => number): string[] {
  const civils = melanger(
    ids.filter((id) => id !== undercoverId),
    alea,
  );
  const position = 1 + alea(civils.length);
  return [...civils.slice(0, position), undercoverId, ...civils.slice(position)];
}

function pairesLibres(jouees: number[], nbPaires: number): number[] {
  const deja = new Set(jouees);
  const libres: number[] = [];
  for (let index = 0; index < nbPaires; index += 1) if (!deja.has(index)) libres.push(index);
  return libres;
}

export function refuserUndercover(etat: EtatJeu, action: Action, origine: Origine, ctx: ContexteCourse): string | null {
  const course = etat.course;
  const jeu = course?.undercover;
  if (!course || course.phase !== 'miniJeu' || course.ecranMini !== 'undercover' || !jeu) return "L'Undercover n'est pas en cours";
  if (origine.role !== 'hote') return "Seul l'hôte peut faire cette action";
  if (jeu.recap) return "L'Undercover est terminé";
  const manche = mancheUndercover(course);
  switch (action.type) {
    case 'lancerMancheUndercover':
      if (manche && manche.etape !== 'finie') return "La manche en cours n'est pas finie";
      if (jeu.manches.length >= jeu.nbManches) return 'Toutes les manches sont jouées';
      if (course.ordre.length < JOUEURS_MIN_UNDERCOVER) return `Il faut au moins ${JOUEURS_MIN_UNDERCOVER} joueurs`;
      if (pairesLibres(jeu.pairesJouees, ctx.undercover.paires.length).length === 0) {
        return 'Toutes les paires ont déjà été jouées ce soir';
      }
      return null;
    case 'eliminerUndercover':
      if (!manche || manche.etape !== 'indices') return "Personne n'est à éliminer";
      if (!enJeu(manche).includes(action.joueurId)) return "Ce joueur n'est plus en jeu";
      return null;
    case 'devinerUndercover':
      if (!manche || manche.etape !== 'devine') return "L'undercover n'a rien à deviner";
      return null;
    case 'recapUndercover':
      if (!manche || manche.etape !== 'finie') return "La manche en cours n'est pas finie";
      if (jeu.manches.length < jeu.nbManches) return 'Toutes les manches ne sont pas jouées';
      return null;
    default:
      return 'Action inconnue';
  }
}

function gagner(draft: EtatJeu, ctx: ContexteCourse, ajouter: Ajouter, manche: MancheUndercover, joueurId: string, montant: number): void {
  if (montant <= 0) return;
  manche.gains[joueurId] = (manche.gains[joueurId] ?? 0) + montant;
  crediter(draft, ctx, ajouter, joueurId, montant, 'Undercover', 'mini-jeu');
}

function finir(draft: EtatJeu, ajouter: Ajouter, manche: MancheUndercover): void {
  manche.etape = 'finie';
  ajouter(
    draft,
    'undercover.fin',
    'public',
    `Undercover : ${manche.paire.civils} contre ${manche.paire.undercover}`,
    { numero: manche.numero, issue: manche.issue, devine: manche.devine, civils: manche.paire.civils, undercover: manche.paire.undercover },
  );
}

export function appliquerUndercover(draft: EtatJeu, action: Action, ctx: ContexteCourse, ajouter: Ajouter): void {
  const course = draft.course;
  const jeu = course?.undercover;
  if (!course || !jeu) return;
  const manche = mancheUndercover(course);
  switch (action.type) {
    case 'lancerMancheUndercover': {
      const deja = new Set(jeu.manches.map((m) => m.undercoverId));
      const candidats = course.ordre.filter((id) => !deja.has(id));
      const parmi = candidats.length > 0 ? candidats : course.ordre;
      const undercoverId = parmi[ctx.alea(parmi.length)]!;
      const libres = pairesLibres(jeu.pairesJouees, ctx.undercover.paires.length);
      const indexPaire = libres[ctx.alea(libres.length)]!;
      const paire = ctx.undercover.paires[indexPaire]!;
      const ordreParole = tirerOrdreParole(course.ordre, undercoverId, ctx.alea);
      const numero = jeu.manches.length + 1;
      jeu.pairesJouees.push(indexPaire);
      jeu.manches.push({
        numero,
        indexPaire,
        paire: { ...paire },
        undercoverId,
        ordreParole,
        elimines: [],
        etape: 'indices',
        issue: null,
        devine: null,
        gains: {},
      });
      ajouter(draft, 'undercover.manche', 'public', `Undercover, manche ${numero} : ${pseudo(draft, ordreParole[0]!)} parle en premier`, {
        numero,
        ordreParole,
      });
      return;
    }
    case 'eliminerUndercover': {
      if (!manche) return;
      manche.elimines.push(action.joueurId);
      if (action.joueurId === manche.undercoverId) {
        manche.issue = 'civils';
        manche.etape = 'devine';
        ajouter(draft, 'undercover.elimine', 'public', `${pseudo(draft, action.joueurId)} était l'undercover`, {
          numero: manche.numero,
          joueurId: action.joueurId,
          role: 'undercover',
        });
        for (const id of manche.ordreParole) {
          if (id !== manche.undercoverId) gagner(draft, ctx, ajouter, manche, id, ctx.undercover.gainCivils);
        }
        return;
      }
      ajouter(draft, 'undercover.elimine', 'public', `${pseudo(draft, action.joueurId)} était civil`, {
        numero: manche.numero,
        joueurId: action.joueurId,
        role: 'civil',
      });
      if (enJeu(manche).length <= SURVIVANTS_UNDERCOVER) {
        manche.issue = 'undercover';
        finir(draft, ajouter, manche);
        gagner(draft, ctx, ajouter, manche, manche.undercoverId, ctx.undercover.gainUndercoverSurvit);
      }
      return;
    }
    case 'devinerUndercover': {
      if (!manche) return;
      manche.devine = action.trouve;
      finir(draft, ajouter, manche);
      if (action.trouve) gagner(draft, ctx, ajouter, manche, manche.undercoverId, ctx.undercover.gainUndercoverDevine);
      return;
    }
    case 'recapUndercover':
      jeu.recap = true;
      course.resultatsSaisis = true;
      ajouter(draft, 'undercover.recap', 'public', 'Undercover : récapitulatif', {
        gains: jeu.manches.map((m) => ({ numero: m.numero, gains: { ...m.gains } })),
      });
      return;
    default:
      return;
  }
}
