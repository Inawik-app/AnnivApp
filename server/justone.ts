import { plier } from '../shared/codenames';
import {
  JUSTONE_HOTE,
  annulerIndices,
  indiceValide,
  ordreDevineursJustOne,
  type ConfigJustOne,
} from '../shared/justone';
import type { Action, Course, EtatJeu, JustOneCourse, MancheJustOne, Origine, Visibilite } from '../shared/types';
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

export const ACTIONS_JUSTONE = new Set<Action['type']>([
  'lancerMancheJustOne',
  'proposerIndiceJustOne',
  'proposerAnnulationJustOne',
  'validerAnnulationJustOne',
  'revelerIndicesJustOne',
  'jugerJustOne',
  'recapJustOne',
]);

function pseudo(etat: EtatJeu, joueurId: string, nomHote: string): string {
  if (joueurId === JUSTONE_HOTE) return nomHote;
  return trouverJoueur(etat.joueurs, joueurId)?.pseudo ?? 'Un joueur';
}

export function mancheCouranteJustOne(course: Course): MancheJustOne | null {
  const manches = course.justone?.manches ?? [];
  return manches[manches.length - 1] ?? null;
}

export function justoneInitial(ordre: readonly string[], config: ConfigJustOne): JustOneCourse {
  return {
    cycles: config.cycles,
    hoteDevine: config.hoteDevine,
    dureeIndices: config.dureeIndices,
    gainDevineur: config.gainDevineur,
    gainIndice: config.gainIndice,
    ordreDevineurs: ordreDevineursJustOne(ordre, config.cycles, config.hoteDevine),
    indexDevineur: 0,
    manches: [],
    recap: false,
    gains: {},
  };
}

function estHote(id: string): boolean {
  return id === JUSTONE_HOTE;
}

/** Indiceurs d'une manche : tous les joueurs sauf le devineur, plus l'hôte s'il ne devine pas. */
export function indiceursManche(manche: MancheJustOne, ordre: readonly string[]): string[] {
  const ids = ordre.filter((id) => id !== manche.devineurId);
  if (!estHote(manche.devineurId)) ids.push(JUSTONE_HOTE);
  return ids;
}

function motsLibres(course: Course, config: ConfigJustOne): string[] {
  const joues = new Set((course.motsSoiree ?? []).map((mot) => plier(mot)));
  return config.mots.filter((mot) => !joues.has(plier(mot)));
}

function appliquerAnnulationsAuto(manche: MancheJustOne): void {
  const resultat = annulerIndices(
    manche.indices.map((indice) => ({ auteurId: indice.auteurId, mot: indice.mot })),
    JUSTONE_HOTE,
  );
  for (let index = 0; index < manche.indices.length; index += 1) {
    manche.indices[index]!.annule = resultat[index]?.annule === true;
  }
}

function tousOntIndique(manche: MancheJustOne, auteursAttendus: string[]): boolean {
  const presentes = new Set(manche.indices.map((indice) => indice.auteurId));
  return auteursAttendus.every((id) => presentes.has(id));
}

function auteurIndice(action: Extract<Action, { type: 'proposerIndiceJustOne' }>, origine: Origine): string | null {
  if (origine.role === 'joueur' && origine.joueurId) return origine.joueurId;
  if (origine.role === 'hote') {
    if (typeof action.joueurId === 'string' && action.joueurId.trim()) return action.joueurId;
    return JUSTONE_HOTE;
  }
  return null;
}

export function refuserJustOne(etat: EtatJeu, action: Action, origine: Origine, ctx: ContexteCourse): string | null {
  const course = etat.course;
  const jeu = course?.justone;
  if (!course || course.phase !== 'miniJeu' || course.ecranMini !== 'justone' || !jeu) {
    return "Le Just One n'est pas en cours";
  }
  const manche = mancheCouranteJustOne(course);
  const hote = origine.role === 'hote';
  switch (action.type) {
    case 'lancerMancheJustOne': {
      if (!hote) return "Seul l'hôte lance une manche";
      if (jeu.recap) return 'Le Just One est terminé';
      if (manche && manche.etape !== 'finie') return "La manche en cours n'est pas finie";
      if (jeu.indexDevineur >= jeu.ordreDevineurs.length) return 'Toutes les manches sont jouées';
      if (motsLibres(course, ctx.justone).length === 0) return 'Il ne reste plus de mots pour ce soir';
      return null;
    }
    case 'proposerIndiceJustOne': {
      if (!manche || manche.etape !== 'indices') return "Ce n'est pas le moment des indices";
      const auteur = auteurIndice(action, origine);
      if (!auteur) return "Tu ne peux pas proposer d'indice";
      const attendus = indiceursManche(manche, course.ordre);
      if (!attendus.includes(auteur)) return "Tu n'indiques pas cette manche";
      if (manche.indices.some((indice) => indice.auteurId === auteur)) return 'Tu as déjà proposé un indice';
      if (origine.role === 'joueur' && action.joueurId && action.joueurId !== origine.joueurId) {
        return 'Tu ne peux indiquer qu\'à ta place';
      }
      return indiceValide(action.mot, manche.mot);
    }
    case 'proposerAnnulationJustOne': {
      if (!manche || (manche.etape !== 'verification' && manche.etape !== 'indices')) {
        return "Ce n'est pas le moment d'annuler des indices";
      }
      const attendus = indiceursManche(manche, course.ordre);
      if (manche.etape === 'indices' && !tousOntIndique(manche, attendus)) {
        return 'Tous les indices ne sont pas encore là';
      }
      if (manche.propositionAnnulation) return 'Une proposition est déjà en cours';
      const { indexA, indexB } = action;
      if (
        !Number.isInteger(indexA) ||
        !Number.isInteger(indexB) ||
        indexA === indexB ||
        indexA < 0 ||
        indexB < 0 ||
        indexA >= manche.indices.length ||
        indexB >= manche.indices.length
      ) {
        return 'Choisis deux indices à comparer';
      }
      if (origine.role === 'joueur') {
        if (!origine.joueurId || !attendus.includes(origine.joueurId)) {
          return "Tu n'arbitrages pas cette annulation";
        }
      } else if (!hote) {
        return 'Action refusée';
      }
      return null;
    }
    case 'validerAnnulationJustOne': {
      if (!hote) return "Seul l'hôte valide l'annulation";
      if (!manche || !manche.propositionAnnulation) return 'Aucune proposition à valider';
      if (manche.etape !== 'verification' && manche.etape !== 'indices') return "Ce n'est pas le moment";
      return null;
    }
    case 'revelerIndicesJustOne': {
      if (!hote) return "Seul l'hôte révèle les indices";
      if (!manche || (manche.etape !== 'verification' && manche.etape !== 'indices')) {
        return "Ce n'est pas le moment de révéler";
      }
      const attendus = indiceursManche(manche, course.ordre);
      if (!tousOntIndique(manche, attendus)) return 'Tous les indices ne sont pas encore là';
      if (manche.propositionAnnulation) return "Valide d'abord la proposition d'annulation";
      return null;
    }
    case 'jugerJustOne': {
      if (!hote) return "Seul l'hôte juge la réponse";
      if (!manche || (manche.etape !== 'revelation' && manche.etape !== 'reponse')) {
        return "Ce n'est pas le moment de juger";
      }
      if (action.issue !== 'trouve' && action.issue !== 'rate' && action.issue !== 'passe') {
        return 'Issue inconnue';
      }
      return null;
    }
    case 'recapJustOne': {
      if (!hote) return "Seul l'hôte affiche le récapitulatif";
      if (jeu.recap) return 'Le récapitulatif est déjà affiché';
      if (jeu.indexDevineur < jeu.ordreDevineurs.length) return 'Toutes les manches ne sont pas jouées';
      if (manche && manche.etape !== 'finie') return "La dernière manche n'est pas finie";
      return null;
    }
    default:
      return 'Action inconnue';
  }
}

function crediterManche(
  draft: EtatJeu,
  ctx: ContexteCourse,
  ajouter: Ajouter,
  manche: MancheJustOne,
  jeu: JustOneCourse,
): void {
  const gains: Record<string, number> = {};
  if (manche.issue === 'trouve') {
    if (!estHote(manche.devineurId)) {
      gains[manche.devineurId] = (gains[manche.devineurId] ?? 0) + jeu.gainDevineur;
    }
    for (const indice of manche.indices) {
      if (indice.annule || estHote(indice.auteurId)) continue;
      gains[indice.auteurId] = (gains[indice.auteurId] ?? 0) + jeu.gainIndice;
    }
  }
  manche.gains = gains;
  for (const [id, montant] of Object.entries(gains)) {
    jeu.gains[id] = (jeu.gains[id] ?? 0) + montant;
    crediter(draft, ctx, ajouter, id, montant, 'Just One', 'mini-jeu');
  }
}

function enregistrerMot(course: Course, mot: string): void {
  course.motsSoiree = [...(course.motsSoiree ?? []), mot];
  if (course.codenames) course.codenames.motsJoues = [...course.motsSoiree];
}

export function appliquerJustOne(
  draft: EtatJeu,
  action: Action,
  origine: Origine,
  ctx: ContexteCourse,
  ajouter: Ajouter,
): void {
  const course = draft.course;
  const jeu = course?.justone;
  if (!course || !jeu) return;
  const nomHote = ctx.nomHote;
  switch (action.type) {
    case 'lancerMancheJustOne': {
      const devineurId = jeu.ordreDevineurs[jeu.indexDevineur];
      if (!devineurId) return;
      const libres = motsLibres(course, ctx.justone);
      const mot = libres[ctx.alea(libres.length)]!;
      enregistrerMot(course, mot);
      const numero = jeu.manches.length + 1;
      jeu.manches.push({
        numero,
        devineurId,
        mot,
        etape: 'indices',
        indices: [],
        propositionAnnulation: null,
        issue: null,
        gains: {},
      });
      jeu.indexDevineur += 1;
      ajouter(draft, 'justone.manche', 'public', `Just One, manche ${numero} : ${pseudo(draft, devineurId, nomHote)} devine`, {
        numero,
        devineurId,
      });
      return;
    }
    case 'proposerIndiceJustOne': {
      const manche = mancheCouranteJustOne(course);
      if (!manche) return;
      const auteur = auteurIndice(action, origine);
      if (!auteur) return;
      manche.indices.push({ auteurId: auteur, mot: action.mot.trim(), annule: false });
      const attendus = indiceursManche(manche, course.ordre);
      if (tousOntIndique(manche, attendus)) {
        appliquerAnnulationsAuto(manche);
        manche.etape = 'verification';
        ajouter(draft, 'justone.verification', 'public', 'Just One : vérification des indices', {
          numero: manche.numero,
        });
      } else {
        const visibilite: Visibilite = auteur === JUSTONE_HOTE ? 'hote' : { joueurId: auteur };
        ajouter(draft, 'justone.indice', visibilite, `${pseudo(draft, auteur, nomHote)} a proposé un indice`, {
          numero: manche.numero,
          auteurId: auteur,
        });
      }
      return;
    }
    case 'proposerAnnulationJustOne': {
      const manche = mancheCouranteJustOne(course);
      if (!manche) return;
      if (manche.etape === 'indices') {
        appliquerAnnulationsAuto(manche);
        manche.etape = 'verification';
      }
      const auteur =
        origine.role === 'hote' ? JUSTONE_HOTE : origine.role === 'joueur' ? origine.joueurId ?? JUSTONE_HOTE : JUSTONE_HOTE;
      manche.propositionAnnulation = { auteurId: auteur, indexA: action.indexA, indexB: action.indexB };
      ajouter(draft, 'justone.proposition', 'public', 'Just One : proposition d\'annulation', {
        numero: manche.numero,
        indexA: action.indexA,
        indexB: action.indexB,
      });
      return;
    }
    case 'validerAnnulationJustOne': {
      const manche = mancheCouranteJustOne(course);
      if (!manche || !manche.propositionAnnulation) return;
      if (action.accepter) {
        const { indexA, indexB } = manche.propositionAnnulation;
        const a = manche.indices[indexA];
        const b = manche.indices[indexB];
        if (a && b) {
          // Trop proche : si l'un est l'hôte, seul l'hôte est annulé ; sinon les deux.
          if (estHote(a.auteurId) !== estHote(b.auteurId)) {
            if (estHote(a.auteurId)) a.annule = true;
            if (estHote(b.auteurId)) b.annule = true;
          } else {
            a.annule = true;
            b.annule = true;
          }
        }
      }
      manche.propositionAnnulation = null;
      ajouter(
        draft,
        'justone.annulation',
        'public',
        action.accepter ? 'Just One : indices annulés' : 'Just One : annulation refusée',
        { accepter: action.accepter },
      );
      return;
    }
    case 'revelerIndicesJustOne': {
      const manche = mancheCouranteJustOne(course);
      if (!manche) return;
      if (manche.etape === 'indices') appliquerAnnulationsAuto(manche);
      manche.etape = 'revelation';
      ajouter(draft, 'justone.revelation', 'public', 'Just One : les indices sont révélés', {
        numero: manche.numero,
      });
      return;
    }
    case 'jugerJustOne': {
      const manche = mancheCouranteJustOne(course);
      if (!manche) return;
      manche.etape = 'reponse';
      manche.issue = action.issue;
      crediterManche(draft, ctx, ajouter, manche, jeu);
      manche.etape = 'finie';
      const libelle =
        action.issue === 'trouve'
          ? `Just One : ${pseudo(draft, manche.devineurId, nomHote)} a trouvé`
          : action.issue === 'passe'
            ? `Just One : ${pseudo(draft, manche.devineurId, nomHote)} passe`
            : `Just One : ${pseudo(draft, manche.devineurId, nomHote)} a raté`;
      ajouter(draft, 'justone.fin', 'public', libelle, {
        numero: manche.numero,
        issue: action.issue,
        mot: manche.mot,
        gains: { ...manche.gains },
      });
      return;
    }
    case 'recapJustOne': {
      jeu.recap = true;
      course.resultatsSaisis = true;
      ajouter(draft, 'justone.recap', 'public', 'Just One : récapitulatif', { gains: { ...jeu.gains } });
      return;
    }
    default:
      return;
  }
}
