import { solde } from '../shared/soldes';
import type { Action, Course, EtatJeu, JeopardyCourse, Origine, Visibilite } from '../shared/types';
import type { ContexteCourse } from './course';
import { trouverJoueur } from './libelles';
import { crediter } from './mini-jeux';

type Ajouter = (
  draft: EtatJeu,
  type: string,
  visibilite: Visibilite,
  libelle: string,
  donnees?: Record<string, unknown>,
) => void;

export const ACTIONS_JEOPARDY = new Set<Action['type']>([
  'choisirChoisisseurJeopardy',
  'choisirCaseJeopardy',
  'buzzJeopardy',
  'jugerJeopardy',
  'personneJeopardy',
  'terminerJeopardy',
]);

function pseudo(etat: EtatJeu, joueurId: string): string {
  return trouverJoueur(etat.joueurs, joueurId)?.pseudo ?? 'Un joueur';
}

export function jeopardyInitial(course: Course): JeopardyCourse {
  return { choisisseurId: course.ordre[0] ?? null, jouees: [], question: null, gains: {}, termine: false };
}

/** Le suivant dans l'ordre de passage, après celui qui vient de choisir. */
export function choisisseurSuivant(ordre: string[], dernier: string): string | null {
  if (ordre.length === 0) return null;
  const index = ordre.indexOf(dernier);
  return ordre[(index + 1) % ordre.length] ?? null;
}

export function refuserJeopardy(etat: EtatJeu, action: Action, origine: Origine, ctx: ContexteCourse): string | null {
  const hote = origine.role === 'hote';
  const course = etat.course;
  const jeu = course?.jeopardy;
  if (!course || course.phase !== 'miniJeu' || course.ecranMini !== 'jeopardy' || !jeu) return "Le Jeopardy n'est pas en cours";
  if (action.type !== 'buzzJeopardy' && !hote) return "Seul l'hôte peut faire cette action";
  if (jeu.termine) return 'Le Jeopardy est terminé';
  const question = jeu.question;
  switch (action.type) {
    case 'choisirChoisisseurJeopardy':
      if (question) return 'Une question est en cours';
      if (!course.ordre.includes(action.joueurId)) return "Ce joueur n'est pas dans la partie";
      return null;
    case 'choisirCaseJeopardy': {
      if (question) return 'Une question est en cours';
      if (!jeu.choisisseurId) return 'Choisis d\'abord qui choisit';
      const theme = ctx.jeopardy.themes[action.theme];
      if (!Number.isInteger(action.theme) || !theme) return "Ce thème n'existe pas";
      if (!Number.isInteger(action.niveau) || !theme.questions[action.niveau]) return "Cette case n'existe pas";
      if (jeu.jouees.some((jouee) => jouee.theme === action.theme && jouee.niveau === action.niveau)) {
        return 'Cette case a déjà été jouée';
      }
      return null;
    }
    case 'buzzJeopardy': {
      if (origine.role !== 'joueur' || !origine.joueurId) return 'Seul un joueur peut buzzer';
      if (!course.ordre.includes(origine.joueurId)) return "Tu n'es pas dans la partie";
      if (!question) return 'Aucune question en cours';
      if (question.elimines.includes(origine.joueurId)) return "Tu t'es déjà trompé sur cette question";
      if (!question.ouverte || question.mainId !== null) return 'Les buzzers sont fermés';
      return null;
    }
    case 'jugerJeopardy':
      if (!question || !question.mainId) return "Personne n'a la main";
      return null;
    case 'personneJeopardy':
      if (!question) return 'Aucune question en cours';
      return null;
    case 'terminerJeopardy':
      if (question) return "Termine d'abord la question en cours";
      return null;
    default:
      return 'Action inconnue';
  }
}

function terminer(draft: EtatJeu, course: Course, jeu: JeopardyCourse, ajouter: Ajouter): void {
  jeu.termine = true;
  course.resultatsSaisis = true;
  ajouter(draft, 'jeopardy.fin', 'public', 'Jeopardy : récapitulatif', { gains: { ...jeu.gains } });
}

function clore(draft: EtatJeu, course: Course, jeu: JeopardyCourse, ctx: ContexteCourse, ajouter: Ajouter, gagnantId: string | null): void {
  const question = jeu.question;
  if (!question) return;
  jeu.jouees.push({ theme: question.theme, niveau: question.niveau, choisisseurId: question.choisisseurId, gagnantId });
  jeu.question = null;
  jeu.choisisseurId = choisisseurSuivant(course.ordre, question.choisisseurId);
  const total = ctx.jeopardy.themes.reduce((somme, theme) => somme + theme.questions.length, 0);
  if (jeu.jouees.length >= total) terminer(draft, course, jeu, ajouter);
}

export function appliquerJeopardy(draft: EtatJeu, action: Action, ctx: ContexteCourse, ajouter: Ajouter, origine: Origine): void {
  const course = draft.course;
  const jeu = course?.jeopardy;
  if (!course || !jeu) return;
  switch (action.type) {
    case 'choisirChoisisseurJeopardy':
      jeu.choisisseurId = action.joueurId;
      ajouter(draft, 'jeopardy.choisisseur', 'public', `${pseudo(draft, action.joueurId)} choisit la case`, {
        joueurId: action.joueurId,
      });
      return;
    case 'choisirCaseJeopardy': {
      const choisisseurId = jeu.choisisseurId;
      if (!choisisseurId) return;
      const valeur = ctx.jeopardy.valeurs[action.niveau] ?? 0;
      jeu.question = { theme: action.theme, niveau: action.niveau, choisisseurId, mainId: choisisseurId, ouverte: false, elimines: [] };
      ajouter(
        draft,
        'jeopardy.case',
        'public',
        `${ctx.jeopardy.themes[action.theme]?.nom ?? 'Thème'} pour ${valeur} : ${pseudo(draft, choisisseurId)} a la priorité`,
        { theme: action.theme, niveau: action.niveau, valeur, choisisseurId },
      );
      return;
    }
    case 'buzzJeopardy': {
      const question = jeu.question;
      if (!question || origine.role !== 'joueur' || !origine.joueurId) return;
      question.mainId = origine.joueurId;
      question.ouverte = false;
      ajouter(draft, 'jeopardy.buzz', 'public', `${pseudo(draft, origine.joueurId)} buzze`, { joueurId: origine.joueurId });
      return;
    }
    case 'jugerJeopardy': {
      const question = jeu.question;
      const mainId = question?.mainId;
      if (!question || !mainId) return;
      const valeur = ctx.jeopardy.valeurs[question.niveau] ?? 0;
      if (action.juste) {
        jeu.gains[mainId] = (jeu.gains[mainId] ?? 0) + valeur;
        ajouter(draft, 'jeopardy.juste', 'public', `${pseudo(draft, mainId)} a juste`, { joueurId: mainId, valeur });
        crediter(draft, ctx, ajouter, mainId, valeur, 'Jeopardy', 'mini-jeu');
        clore(draft, course, jeu, ctx, ajouter, mainId);
        return;
      }
      const penalite = Math.min(ctx.jeopardy.penaliteMauvaiseReponse, Math.max(0, solde(draft.transactions, mainId, 'visibles')));
      if (penalite > 0) {
        jeu.gains[mainId] = (jeu.gains[mainId] ?? 0) - penalite;
        draft.transactions.push({
          id: ctx.id(),
          joueurId: mainId,
          montant: -penalite,
          source: 'penalite',
          libelle: 'Jeopardy',
          horodatage: ctx.maintenant,
          masquee: false,
        });
      }
      question.elimines.push(mainId);
      question.mainId = null;
      const restants = course.ordre.filter((id) => !question.elimines.includes(id));
      ajouter(draft, 'jeopardy.faux', 'public', `${pseudo(draft, mainId)} s'est trompé`, { joueurId: mainId, penalite });
      if (restants.length === 0) {
        ajouter(draft, 'jeopardy.personne', 'public', 'Personne ne marque');
        clore(draft, course, jeu, ctx, ajouter, null);
        return;
      }
      question.ouverte = true;
      return;
    }
    case 'personneJeopardy':
      ajouter(draft, 'jeopardy.personne', 'public', 'Personne ne marque');
      clore(draft, course, jeu, ctx, ajouter, null);
      return;
    case 'terminerJeopardy':
      terminer(draft, course, jeu, ajouter);
      return;
    default:
      return;
  }
}

export function oublierJoueurJeopardy(course: Course, joueurId: string): void {
  const jeu = course.jeopardy;
  if (!jeu) return;
  if (jeu.choisisseurId === joueurId) jeu.choisisseurId = course.ordre[0] ?? null;
  if (jeu.question?.mainId === joueurId) {
    jeu.question.mainId = null;
    jeu.question.ouverte = true;
  }
}
