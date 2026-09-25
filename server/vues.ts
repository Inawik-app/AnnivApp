import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lireCatalogue, lireJeopardy, lirePoker, lireTopTen, lireUndercover } from './mini-jeux-config';
import { couleurBuzzer } from '../shared/jeopardy';
import { statistiques } from '../shared/statistiques';
import { trophees } from '../shared/trophees';
import { solde } from '../shared/soldes';
import { projeterTirage } from './ceremonie';
import { lireCatalogueTrophees, lireConfigPlateau } from './course-config';
import { REPONDANT_HOTE } from '../shared/topten';
import type {
  AppareilVue,
  Course,
  CourseVue,
  DiagnosticTv,
  EtatJeu,
  Evenement,
  JeopardyVue,
  JoueurPublic,
  MancheTopTenVue,
  MancheUndercoverVue,
  QuestionJeopardyVue,
  UndercoverVue,
  TopTenVue,
  ReseauVue,
  VueHote,
  VueJoueur,
  VueTv,
} from '../shared/types';

export type Presence = {
  enLigne: Record<string, boolean>;
  latenceJoueur: Record<string, number | null>;
  appareils: AppareilVue[];
};

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function visibles(evenements: Evenement[], cible: 'tv' | 'joueur' | 'hote', joueurId: string | null, limite: number): Evenement[] {
  const filtres = evenements.filter((evenement) => {
    if (cible === 'hote') return true;
    if (evenement.visibilite === 'public') return true;
    return (
      cible === 'joueur' &&
      !!joueurId &&
      typeof evenement.visibilite === 'object' &&
      evenement.visibilite.joueurId === joueurId
    );
  });
  return filtres.slice(-limite);
}

/** Les numéros ne partent qu'à leur répondant et à l'hôte, puis à tout le monde une fois la manche révélée. */
export function projeterTopTen(course: Course, cible: 'tv' | 'joueur' | 'hote', joueurId: string | null): TopTenVue | null {
  const topten = course.topten;
  if (!topten) return null;
  const config = lireTopTen(RACINE);
  const manche = topten.manches[topten.manches.length - 1];
  let courante: MancheTopTenVue | null = null;
  if (manche) {
    const revelee = manche.etape === 'revelee';
    const cle = cible === 'hote' ? REPONDANT_HOTE : cible === 'joueur' ? joueurId : null;
    const monNumero = cle && manche.repondants.includes(cle) ? (manche.numeros[cle] ?? null) : null;
    courante = {
      numero: manche.numero,
      captenId: manche.captenId,
      theme: { ...manche.theme },
      repondants: [...manche.repondants],
      etape: manche.etape,
      monNumero,
      numeros: revelee || cible === 'hote' ? { ...manche.numeros } : null,
      proposition: revelee && manche.proposition
        ? { ordre: [...manche.proposition.ordre], devines: { ...manche.proposition.devines } }
        : null,
      score: revelee && manche.score ? manche.score : null,
    };
  }
  return {
    nomHote: config.nomHote,
    pointsParPaire: config.pointsParPaire,
    bonusOrdreParfait: config.bonusOrdreParfait,
    bonusChiffresExacts: [...config.bonusChiffresExacts],
    captens: [...topten.captens],
    courante,
    bilan: topten.manches
      .filter((passee) => passee.etape === 'revelee')
      .map((passee) => ({
        numero: passee.numero,
        captenId: passee.captenId,
        theme: passee.theme.intitule,
        total: passee.score?.total ?? 0,
      })),
    recap: topten.recap,
  };
}

/** La question ne part qu'une fois la case choisie ; la réponse ne part qu'à l'hôte. */
export function projeterJeopardy(course: Course, cible: 'tv' | 'joueur' | 'hote', joueurId: string | null): JeopardyVue | null {
  const jeu = course.jeopardy;
  if (!jeu) return null;
  const config = lireJeopardy(RACINE);
  let question: QuestionJeopardyVue | null = null;
  if (jeu.question) {
    const source = config.themes[jeu.question.theme]?.questions[jeu.question.niveau];
    question = {
      ...jeu.question,
      elimines: [...jeu.question.elimines],
      valeur: config.valeurs[jeu.question.niveau] ?? 0,
      texte: source?.question ?? '',
      ...(cible === 'hote' ? { reponse: source?.reponse ?? null, accepte: [...(source?.accepte ?? [])] } : {}),
    };
  }
  return {
    valeurs: [...config.valeurs],
    themes: config.themes.map((theme) => theme.nom),
    jouees: jeu.jouees.map((jouee) => ({ ...jouee })),
    choisisseurId: jeu.choisisseurId,
    question,
    monBuzzer: cible === 'joueur' && joueurId ? couleurBuzzer(jeu.question, joueurId) : null,
    gains: { ...jeu.gains },
    penalite: config.penaliteMauvaiseReponse,
    termine: jeu.termine,
  };
}

/** Chaque mot ne part qu'à son joueur ; le rôle d'un joueur n'est public qu'une fois éliminé. */
export function projeterUndercover(course: Course, cible: 'tv' | 'joueur' | 'hote', joueurId: string | null): UndercoverVue | null {
  const jeu = course.undercover;
  if (!jeu) return null;
  const config = lireUndercover(RACINE);
  const manche = jeu.manches[jeu.manches.length - 1];
  let courante: MancheUndercoverVue | null = null;
  if (manche) {
    const hote = cible === 'hote';
    const finie = manche.etape === 'finie';
    const demasque = manche.elimines.includes(manche.undercoverId);
    const joue = cible === 'joueur' && !!joueurId && manche.ordreParole.includes(joueurId);
    courante = {
      numero: manche.numero,
      ordreParole: [...manche.ordreParole],
      elimines: manche.elimines.map((id) => ({ id, role: id === manche.undercoverId ? 'undercover' : 'civil' })),
      tour: manche.elimines.length + 1,
      etape: manche.etape,
      issue: manche.issue,
      devine: manche.devine,
      monMot: joue ? (joueurId === manche.undercoverId ? manche.paire.undercover : manche.paire.civils) : null,
      jeSuisElimine: joue && manche.elimines.includes(joueurId as string),
      undercoverId: hote || finie || demasque ? manche.undercoverId : null,
      paire: hote || finie ? { ...manche.paire } : null,
      gains: { ...manche.gains },
    };
  }
  return {
    nbManches: jeu.nbManches,
    gainCivils: config.gainCivils,
    gainUndercoverDevine: config.gainUndercoverDevine,
    gainUndercoverSurvit: config.gainUndercoverSurvit,
    courante,
    bilan: jeu.manches
      .filter((passee) => passee.etape === 'finie')
      .map((passee) => ({ numero: passee.numero, issue: passee.issue, gains: { ...passee.gains } })),
    recap: jeu.recap,
  };
}

export function projeterCourse(course: Course | null, cible: 'tv' | 'joueur' | 'hote', joueurId: string | null): CourseVue | null {
  if (!course) return null;
  const etape: CourseVue['etape'] = course.etape?.genre === 'lancer' || course.etape?.genre === 'roue' ? course.etape.genre : null;
  const courant = course.phase === 'deplacements' ? (course.ordre[course.indexCourant] ?? null) : null;
  return {
    active: course.active,
    phase: course.phase,
    disposition: course.disposition,
    longueur: course.regles.longueur,
    positions: { ...course.positions },
    arrivees: [...course.arrivees],
    cagnotte: course.cagnotte,
    tour: course.tour,
    ordre: [...course.ordre],
    indexCourant: course.indexCourant,
    joueurCourantId: courant,
    choisitId: course.choisitId,
    miniJeu: course.miniJeu,
    miniJeuId: course.miniJeuId ?? null,
    joues: [...(course.joues ?? [])],
    grilleVisible: course.grilleVisible === true,
    ecranMini: course.ecranMini ?? null,
    resultatsSaisis: course.resultatsSaisis === true,
    minuteur: course.minuteur ?? { etat: 'arrete', finA: null, resteMs: 0, libelle: '' },
    poker: course.poker ?? { actif: false, niveau: 0 },
    topten: course.ecranMini === 'topten' ? projeterTopTen(course, cible, joueurId) : null,
    jeopardy: course.ecranMini === 'jeopardy' ? projeterJeopardy(course, cible, joueurId) : null,
    undercover: course.ecranMini === 'undercover' ? projeterUndercover(course, cible, joueurId) : null,
    catalogue: lireCatalogue(RACINE),
    pokerConfig: lirePoker(RACINE),
    etape,
    carte: course.carteCourante?.carte ?? null,
    dernierDe: course.dernierDe,
    classement: course.classement ? [...course.classement] : null,
    dernierTour: course.dernierTour === true,
    ceremonie: course.ceremonie
      ? {
          etape: course.ceremonie.etape,
          ...projeterTirage(course.ceremonie, cible),
          classementRevele: course.ceremonie.classementRevele,
          gagnantRevele: course.ceremonie.gagnantRevele,
        }
      : null,
    gainBonus: course.regles.gainBonus,
    optionsDe: course.regles.optionsDe.map((option) => ({ ...option })),
    iconesCases: { ...lireConfigPlateau(RACINE).iconesCases },
  };
}

function classer(etat: EtatJeu, presence: Presence): JoueurPublic[] {
  const liste = etat.joueurs.map((joueur) => ({
    id: joueur.id,
    pseudo: joueur.pseudo,
    avatar: joueur.avatar,
    couleur: joueur.couleur,
    enLigne: presence.enLigne[joueur.id] === true,
    gpVisibles: solde(etat.transactions, joueur.id, 'visibles'),
    place: 0,
    rejointA: joueur.rejointA,
  }));
  const parScore = [...liste].sort((a, b) => b.gpVisibles - a.gpVisibles || a.pseudo.localeCompare(b.pseudo, 'fr'));
  let place = 1;
  const places = new Map<string, number>();
  for (let index = 0; index < parScore.length; index += 1) {
    const courant = parScore[index]!;
    const precedent = parScore[index - 1];
    if (precedent && courant.gpVisibles < precedent.gpVisibles) place = index + 1;
    places.set(courant.id, place);
  }
  for (const joueur of liste) joueur.place = places.get(joueur.id) ?? liste.length;
  liste.sort((a, b) => a.rejointA - b.rejointA || a.pseudo.localeCompare(b.pseudo, 'fr'));
  return liste;
}

export function vueTv(
  etat: EtatJeu,
  presence: Presence,
  heureServeur: number,
  idDemarrage: string,
  urlJoueur: string,
  placesMax = 4,
  volume = 0.8,
): VueTv {
  return {
    role: 'tv',
    version: etat.version,
    heureServeur,
    idDemarrage,
    partie: {
      titre: etat.partie.titre,
      ecranTv: etat.partie.ecranTv,
      animationsReduites: etat.partie.animationsReduites,
      diagnosticTvAffiche: etat.partie.diagnosticTvAffiche,
    },
    urlJoueur,
    placesMax,
    volume,
    joueurs: classer(etat, presence),
    evenements: visibles(etat.evenements, 'tv', null, 30),
    course: projeterCourse(etat.course, 'tv', null),
  };
}

export function vueJoueur(
  etat: EtatJeu,
  presence: Presence,
  heureServeur: number,
  idDemarrage: string,
  joueurId: string | null,
): VueJoueur {
  const joueurs = classer(etat, presence);
  const moi = joueurId ? joueurs.find((joueur) => joueur.id === joueurId) ?? null : null;
  return {
    role: 'joueur',
    version: etat.version,
    heureServeur,
    idDemarrage,
    partie: {
      titre: etat.partie.titre,
      inscriptionsVerrouillees: etat.partie.inscriptionsVerrouillees,
      animationsReduites: etat.partie.animationsReduites,
    },
    joueurs,
    moi: moi
      ? {
          id: moi.id,
          pseudo: moi.pseudo,
          avatar: moi.avatar,
          couleur: moi.couleur,
          gpVisibles: moi.gpVisibles,
        }
      : null,
    evenements: visibles(etat.evenements, 'joueur', joueurId, 30),
    course: projeterCourse(etat.course, 'joueur', joueurId),
  };
}

export function vueHote(
  etat: EtatJeu,
  presence: Presence,
  heureServeur: number,
  idDemarrage: string,
  dev: boolean,
  reseau: ReseauVue,
  diagnostic: DiagnosticTv | null,
  annulation: string | null,
  volume = 0.8,
  erreursConfig: string[] = [],
): VueHote {
  const joueurs = classer(etat, presence).map((joueur) => ({
    ...joueur,
    gpMasques: solde(etat.transactions, joueur.id, 'masques'),
    latenceMs: presence.latenceJoueur[joueur.id] ?? null,
  }));
  const pseudos = new Map(etat.joueurs.map((joueur) => [joueur.id, joueur.pseudo]));
  return {
    role: 'hote',
    version: etat.version,
    heureServeur,
    idDemarrage,
    dev,
    partie: {
      titre: etat.partie.titre,
      inscriptionsVerrouillees: etat.partie.inscriptionsVerrouillees,
      ecranTv: etat.partie.ecranTv,
      animationsReduites: etat.partie.animationsReduites,
      diagnosticTvAffiche: etat.partie.diagnosticTvAffiche,
    },
    joueurs,
    appareils: presence.appareils,
    evenements: visibles(etat.evenements, 'hote', null, 20),
    demandesReprise: etat.demandesReprise.map((demande) => ({
      id: demande.id,
      joueurId: demande.joueurId,
      pseudo: pseudos.get(demande.joueurId) ?? 'Joueur',
      demandeA: demande.demandeA,
    })),
    transactionsMasquees: etat.transactions
      .filter((transaction) => transaction.masquee)
      .map((transaction) => ({
        id: transaction.id,
        joueurId: transaction.joueurId,
        pseudo: pseudos.get(transaction.joueurId) ?? 'Joueur',
        montant: transaction.montant,
        libelle: transaction.libelle,
        ...(transaction.groupeRevelation ? { groupeRevelation: transaction.groupeRevelation } : {}),
      })),
    annulation,
    nbMasquees: etat.transactions.filter((transaction) => transaction.masquee).length,
    reseau,
    diagnostic,
    volume,
    course: projeterCourse(etat.course, 'hote', null),
    erreursConfig: [...erreursConfig],
    bots: etat.bots === true,
    statistiques: statistiques(etat),
    trophees: trophees(etat, lireCatalogueTrophees(RACINE).trophees),
  };
}
