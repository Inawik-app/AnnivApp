import { solde } from '../shared/soldes';
import type {
  Action,
  CarteChance,
  Course,
  DuelEnCours,
  EtatJeu,
  HistoriqueCourse,
  Origine,
  ReglesCourse,
  Visibilite,
} from '../shared/types';
import { trouverJoueur } from './libelles';
import {
  type Alea,
  calculerClassement,
  calculerOrdre,
  creditsDuel,
  genererDisposition,
  melanger,
  plafondMise,
} from './plateau';
import type { ConfigPlateau } from '../shared/types';

export type ContexteCourse = {
  maintenant: number;
  id: () => string;
  alea: Alea;
  plateau: ConfigPlateau;
  cartes: CarteChance[];
  dev: boolean;
};

type Ajouter = (
  draft: EtatJeu,
  type: string,
  visibilite: Visibilite,
  libelle: string,
  donnees?: Record<string, unknown>,
) => void;

const ACTIONS = new Set<Action['type']>([
  'demarrerCourse',
  'regenererPlateau',
  'nouveauTour',
  'miser',
  'cloreMises',
  'revelerMises',
  'passerAuChoix',
  'choisirMiniJeu',
  'passerAuxDeplacements',
  'lancerDe',
  'choisirBeneficiaire',
  'choisirAdversaire',
  'miserDuel',
  'cloreMisesDuel',
  'autreDefi',
  'resultatDuel',
  'definirPosition',
  'passerJoueur',
  'terminerCourse',
  'basculerBots',
]);

export function estActionCourse(action: Action): boolean {
  return ACTIONS.has(action.type);
}

function pseudo(etat: EtatJeu, joueurId: string): string {
  return trouverJoueur(etat.joueurs, joueurId)?.pseudo ?? 'Un joueur';
}

function historiqueVide(): HistoriqueCourse {
  return { lancers: [], mises: [], effets: [], duels: [] };
}

function reglesDepuis(config: ConfigPlateau): ReglesCourse {
  return {
    longueur: config.longueur,
    gainBonus: config.gainBonus,
    miseMax: config.miseMax,
    choixMiniJeu: config.choixMiniJeu,
    duel: {
      miseMax: config.duel.miseMax,
      bonusVainqueur: config.duel.bonusVainqueur,
      defis: [...config.duel.defis],
    },
  };
}

function soldeVisible(etat: EtatJeu, joueurId: string): number {
  return solde(etat.transactions, joueurId, 'visibles');
}

function montantAutorise(valeur: number, soldeActuel: number, maximum: number): string | null {
  if (typeof valeur !== 'number' || !Number.isInteger(valeur) || valeur < 0) return 'La mise doit être un nombre entier';
  const plafond = plafondMise(soldeActuel, maximum);
  if (valeur > plafond) {
    if (valeur > maximum) return `La mise maximum est ${maximum} GP`;
    return "Tu n'as pas assez de GP visibles";
  }
  return null;
}

function joueurCourant(course: Course): string | null {
  if (course.phase !== 'deplacements') return null;
  return course.ordre[course.indexCourant] ?? null;
}

function crediter(
  draft: EtatJeu,
  ctx: ContexteCourse,
  ajouter: Ajouter,
  joueurId: string,
  montant: number,
  libelle: string,
): void {
  if (montant <= 0) return;
  draft.transactions.push({
    id: ctx.id(),
    joueurId,
    montant,
    source: 'plateau',
    libelle,
    horodatage: ctx.maintenant,
    masquee: false,
  });
  ajouter(draft, 'gp.ajoutes', 'public', `${pseudo(draft, joueurId)} reçoit ${montant} GP (${libelle})`, {
    joueurId,
    montant,
    masquee: false,
  });
}

function debiterMise(
  draft: EtatJeu,
  ctx: ContexteCourse,
  joueurId: string,
  montant: number,
  libelle: string,
): void {
  if (montant <= 0) return;
  draft.transactions.push({
    id: ctx.id(),
    joueurId,
    montant: -montant,
    source: 'mise',
    libelle,
    horodatage: ctx.maintenant,
    masquee: false,
  });
}

function piocher(course: Course, ctx: ContexteCourse): CarteChance {
  if (course.pioche.length === 0) {
    course.pioche = melanger(course.defausse, ctx.alea);
    course.defausse = [];
  }
  const id = course.pioche.pop();
  const carte = ctx.cartes.find((candidat) => candidat.id === id) ?? ctx.cartes[0];
  if (!carte) throw new Error('Aucune carte chance');
  course.defausse.push(carte.id);
  return carte;
}

function toutLeMondeArrive(course: Course): boolean {
  const ids = Object.keys(course.positions);
  return ids.length > 0 && ids.every((id) => (course.positions[id] ?? 0) >= course.regles.longueur);
}

function figerClassement(draft: EtatJeu, ctx: ContexteCourse, ajouter: Ajouter): void {
  const course = draft.course;
  if (!course) return;
  const joueurs = draft.joueurs
    .filter((joueur) => course.positions[joueur.id] !== undefined)
    .map((joueur) => ({
      id: joueur.id,
      position: course.positions[joueur.id] ?? 0,
      gp: soldeVisible(draft, joueur.id),
      arrivee: course.arrivees.includes(joueur.id) ? course.arrivees.indexOf(joueur.id) : null,
    }));
  course.classement = calculerClassement(joueurs, ctx.alea);
  course.phase = 'terminee';
  course.etape = null;
  course.active = true;
  ajouter(draft, 'course.terminee', 'public', 'La course est terminée', { classement: course.classement });
}

function finirTour(draft: EtatJeu, ctx: ContexteCourse, ajouter: Ajouter): void {
  const course = draft.course;
  if (!course) return;
  course.phase = 'finTour';
  course.etape = null;
  ajouter(draft, 'tour.fini', 'public', `Fin du tour ${course.tour}`, { tour: course.tour });
  if (toutLeMondeArrive(course)) figerClassement(draft, ctx, ajouter);
}

function avancer(draft: EtatJeu, ctx: ContexteCourse, ajouter: Ajouter): void {
  const course = draft.course;
  if (!course) return;
  let index = course.indexCourant + 1;
  while (index < course.ordre.length) {
    const id = course.ordre[index];
    if (id && (course.positions[id] ?? 0) < course.regles.longueur) break;
    index += 1;
  }
  if (index >= course.ordre.length) {
    finirTour(draft, ctx, ajouter);
    return;
  }
  course.indexCourant = index;
  course.etape = { genre: 'lancer' };
}

function noterEffet(course: Course, joueurId: string, caseIndex: number, type: string, detail: Record<string, unknown>): void {
  course.historique.effets.push({ tour: course.tour, joueurId, caseIndex, type, detail });
}

function appliquerCarte(
  draft: EtatJeu,
  ctx: ContexteCourse,
  ajouter: Ajouter,
  joueurId: string,
  carte: CarteChance,
  caseIndex: number,
): void {
  const course = draft.course;
  if (!course) return;
  course.carteCourante = { joueurId, carte };
  ajouter(draft, 'case.chance', 'public', `${pseudo(draft, joueurId)} pioche « ${carte.titre} »`, {
    joueurId,
    carteId: carte.id,
    titre: carte.titre,
    texte: carte.texte,
    effet: carte.effet.type,
    ...('montant' in carte.effet ? { montant: carte.effet.montant } : {}),
  });
  noterEffet(course, joueurId, caseIndex, 'chance', { carteId: carte.id, effet: carte.effet.type });
  if (carte.effet.type === 'gain') {
    crediter(draft, ctx, ajouter, joueurId, carte.effet.montant, carte.titre);
    avancer(draft, ctx, ajouter);
    return;
  }
  if (carte.effet.type === 'gainTous') {
    for (const joueur of draft.joueurs) {
      if (course.positions[joueur.id] === undefined) continue;
      crediter(draft, ctx, ajouter, joueur.id, carte.effet.montant, carte.titre);
    }
    avancer(draft, ctx, ajouter);
    return;
  }
  if (carte.effet.type === 'cadeau') {
    course.etape = { genre: 'cadeau', carteId: carte.id };
    return;
  }
  if (carte.effet.type === 'gainDe') {
    const valeur = ctx.alea(6) + 1;
    course.dernierDe = { joueurId, valeur, usage: 'chance' };
    course.historique.lancers.push({ tour: course.tour, joueurId, valeur, usage: 'chance' });
    ajouter(draft, 'de.lance', 'public', `${pseudo(draft, joueurId)} lance un dé doré : ${valeur}`, {
      joueurId,
      valeur,
      usage: 'chance',
    });
    crediter(draft, ctx, ajouter, joueurId, valeur * 2, carte.titre);
    avancer(draft, ctx, ajouter);
    return;
  }
  avancer(draft, ctx, ajouter);
}

function appliquerCase(
  draft: EtatJeu,
  ctx: ContexteCourse,
  ajouter: Ajouter,
  joueurId: string,
  caseIndex: number,
): void {
  const course = draft.course;
  if (!course) return;
  const type = course.disposition[caseIndex];
  if (type === 'bonus') {
    ajouter(draft, 'case.bonus', 'public', `${pseudo(draft, joueurId)} gagne ${course.regles.gainBonus} GP sur une case bonus`, {
      joueurId,
      montant: course.regles.gainBonus,
    });
    crediter(draft, ctx, ajouter, joueurId, course.regles.gainBonus, 'Case bonus');
    noterEffet(course, joueurId, caseIndex, 'bonus', { montant: course.regles.gainBonus });
    avancer(draft, ctx, ajouter);
    return;
  }
  if (type === 'cagnotte') {
    const montant = Math.floor(course.cagnotte / 2);
    if (montant <= 0) {
      ajouter(draft, 'case.cagnotte', 'public', 'La cagnotte est vide', { joueurId, montant: 0, reste: course.cagnotte });
      noterEffet(course, joueurId, caseIndex, 'cagnotte', { montant: 0 });
    } else {
      course.cagnotte -= montant;
      ajouter(draft, 'case.cagnotte', 'public', `${pseudo(draft, joueurId)} ramasse ${montant} GP dans la cagnotte`, {
        joueurId,
        montant,
        reste: course.cagnotte,
      });
      crediter(draft, ctx, ajouter, joueurId, montant, 'Cagnotte');
      noterEffet(course, joueurId, caseIndex, 'cagnotte', { montant, reste: course.cagnotte });
    }
    avancer(draft, ctx, ajouter);
    return;
  }
  if (type === 'chance') {
    const carte = piocher(course, ctx);
    appliquerCarte(draft, ctx, ajouter, joueurId, carte, caseIndex);
    return;
  }
  if (type === 'duel') {
    const duel: DuelEnCours = {
      joueurId,
      etape: 'adversaire',
      adversaireId: null,
      defi: null,
      mises: {},
      revelees: false,
    };
    course.etape = { genre: 'duel', duel };
    ajouter(draft, 'duel.annonce', 'public', `${pseudo(draft, joueurId)} tombe sur un duel`, { joueurId });
    noterEffet(course, joueurId, caseIndex, 'duel', {});
  }
}

function revelerDuel(draft: EtatJeu, ctx: ContexteCourse, ajouter: Ajouter, duel: DuelEnCours): void {
  const course = draft.course;
  if (!course || !duel.adversaireId) return;
  const miseJoueur = duel.mises[duel.joueurId] ?? 0;
  const miseAdversaire = duel.mises[duel.adversaireId] ?? 0;
  duel.mises[duel.joueurId] = miseJoueur;
  duel.mises[duel.adversaireId] = miseAdversaire;
  duel.revelees = true;
  duel.etape = 'resultat';
  debiterMise(draft, ctx, duel.joueurId, miseJoueur, `Mise de duel, tour ${course.tour}`);
  debiterMise(draft, ctx, duel.adversaireId, miseAdversaire, `Mise de duel, tour ${course.tour}`);
  course.historique.mises.push(
    { tour: course.tour, joueurId: duel.joueurId, montant: miseJoueur, duel: true },
    { tour: course.tour, joueurId: duel.adversaireId, montant: miseAdversaire, duel: true },
  );
  ajouter(draft, 'duel.reveles', 'public', 'Les mises du duel sont révélées', {
    mises: [
      { joueurId: duel.joueurId, montant: miseJoueur },
      { joueurId: duel.adversaireId, montant: miseAdversaire },
    ],
  });
}

export function oublierJoueurCourse(draft: EtatJeu, joueurId: string): void {
  const course = draft.course;
  if (!course) return;
  delete course.positions[joueurId];
  delete course.mises[joueurId];
  course.arrivees = course.arrivees.filter((id) => id !== joueurId);
  course.ordre = course.ordre.filter((id) => id !== joueurId);
  if (course.classement) course.classement = course.classement.filter((id) => id !== joueurId);
  if (course.choisitId === joueurId) course.choisitId = course.ordre[0] ?? null;
  if (course.indexCourant >= course.ordre.length) course.indexCourant = Math.max(0, course.ordre.length - 1);
  if (course.etape?.genre === 'duel' && (course.etape.duel.joueurId === joueurId || course.etape.duel.adversaireId === joueurId)) {
    course.etape = { genre: 'lancer' };
  }
}

export function refuserCourse(etat: EtatJeu, action: Action, origine: Origine, ctx: ContexteCourse): string | null {
  if (!estActionCourse(action)) return null;
  const hote = origine.role === 'hote';
  const joueurId = origine.role === 'joueur' ? origine.joueurId : null;
  if (action.type === 'basculerBots') {
    if (!hote) return "Seul l'hôte peut faire cette action";
    if (!ctx.dev) return 'Action indisponible';
    return null;
  }
  if (
    action.type === 'demarrerCourse' ||
    action.type === 'regenererPlateau' ||
    action.type === 'cloreMises' ||
    action.type === 'revelerMises' ||
    action.type === 'passerAuChoix' ||
    action.type === 'choisirMiniJeu' ||
    action.type === 'passerAuxDeplacements' ||
    action.type === 'cloreMisesDuel' ||
    action.type === 'autreDefi' ||
    action.type === 'resultatDuel' ||
    action.type === 'definirPosition' ||
    action.type === 'passerJoueur' ||
    action.type === 'terminerCourse' ||
    action.type === 'nouveauTour'
  ) {
    if (!hote) return "Seul l'hôte peut faire cette action";
  }
  const course = etat.course;
  if (action.type === 'demarrerCourse') {
    if (etat.joueurs.length < 2) return 'Il faut au moins 2 joueurs';
    if (course && course.phase !== 'terminee') return 'Une course est déjà en cours';
    return null;
  }
  if (!course || !course.active) return "La course n'a pas commencé";
  if (course.phase === 'terminee') return 'La course est terminée';

  switch (action.type) {
    case 'regenererPlateau':
      if (course.phase !== 'preparation') return 'Le plateau ne peut plus changer';
      return null;
    case 'nouveauTour':
      if (course.phase !== 'preparation' && course.phase !== 'finTour') return "Ce n'est pas le moment de lancer un tour";
      return null;
    case 'miser': {
      if (!joueurId) return "Seul un joueur peut miser";
      if (course.phase !== 'mises' || course.misesCloturees) return 'Les mises sont closes';
      if (course.positions[joueurId] === undefined) return "Tu n'es pas dans cette course";
      return montantAutorise(action.montant, soldeVisible(etat, joueurId), course.regles.miseMax);
    }
    case 'cloreMises':
      if (course.phase !== 'mises' || course.misesCloturees) return 'Les mises sont déjà closes';
      return null;
    case 'revelerMises': {
      if (course.phase !== 'mises') return "Ce n'est pas le moment de révéler les mises";
      const manque = Object.values(course.mises).some((montant) => montant === null);
      if (manque) return 'Il reste des mises en attente';
      return null;
    }
    case 'passerAuChoix':
      if (course.phase !== 'revelation') return "Ce n'est pas le moment";
      return null;
    case 'choisirMiniJeu':
      if (course.phase !== 'choixMiniJeu') return "Ce n'est pas le moment de choisir le mini-jeu";
      if (typeof action.nom !== 'string' || !action.nom.trim()) return 'Indique le nom du mini-jeu';
      if (action.nom.trim().length > 40) return 'Le nom du mini-jeu est trop long';
      return null;
    case 'passerAuxDeplacements':
      if (course.phase !== 'miniJeu') return "Ce n'est pas le moment des déplacements";
      return null;
    case 'lancerDe': {
      if (course.phase !== 'deplacements' || course.etape?.genre !== 'lancer') return "Ce n'est pas le moment de lancer le dé";
      const courant = joueurCourant(course);
      if (!courant) return 'Personne ne doit lancer';
      if (!hote && joueurId !== courant) return "Ce n'est pas ton tour";
      if ((course.positions[courant] ?? 0) >= course.regles.longueur) return 'Tu es déjà arrivé';
      return null;
    }
    case 'choisirBeneficiaire': {
      if (course.phase !== 'deplacements' || course.etape?.genre !== 'cadeau') return "Personne n'attend de cadeau";
      const courant = joueurCourant(course);
      if (!hote && joueurId !== courant) return "Ce n'est pas à toi de choisir";
      if (!courant || action.joueurId === courant) return 'Choisis un autre joueur';
      if (course.positions[action.joueurId] === undefined) return "Ce joueur n'est plus dans la partie";
      return null;
    }
    case 'choisirAdversaire': {
      if (course.phase !== 'deplacements' || course.etape?.genre !== 'duel' || course.etape.duel.etape !== 'adversaire') {
        return "Personne ne choisit d'adversaire";
      }
      const courant = course.etape.duel.joueurId;
      if (!hote && joueurId !== courant) return "Ce n'est pas à toi de choisir";
      if (action.joueurId === courant) return 'Choisis un autre joueur';
      if (course.positions[action.joueurId] === undefined) return "Ce joueur n'est plus dans la partie";
      return null;
    }
    case 'miserDuel': {
      if (!joueurId) return "Seul un joueur peut miser";
      if (course.phase !== 'deplacements' || course.etape?.genre !== 'duel' || course.etape.duel.etape !== 'mises') {
        return 'Les mises du duel sont closes';
      }
      const duel = course.etape.duel;
      if (joueurId !== duel.joueurId && joueurId !== duel.adversaireId) return 'Tu ne participes pas à ce duel';
      return montantAutorise(action.montant, soldeVisible(etat, joueurId), course.regles.duel.miseMax);
    }
    case 'cloreMisesDuel':
      if (course.phase !== 'deplacements' || course.etape?.genre !== 'duel' || course.etape.duel.etape !== 'mises') {
        return 'Les mises du duel sont déjà closes';
      }
      return null;
    case 'autreDefi':
      if (course.phase !== 'deplacements' || course.etape?.genre !== 'duel' || course.etape.duel.revelees) {
        return 'Le défi ne peut plus changer';
      }
      if (!course.etape.duel.defi) return "Le défi n'est pas encore tiré";
      return null;
    case 'resultatDuel':
      if (course.phase !== 'deplacements' || course.etape?.genre !== 'duel' || course.etape.duel.etape !== 'resultat') {
        return "Ce n'est pas le moment du résultat";
      }
      if (action.resultat !== 'joueur' && action.resultat !== 'adversaire' && action.resultat !== 'egalite') {
        return 'Résultat inconnu';
      }
      return null;
    case 'definirPosition': {
      if (!trouverJoueur(etat.joueurs, action.joueurId)) return "Ce joueur n'est plus dans la partie";
      if (!Number.isInteger(action.position) || action.position < 0 || action.position > course.regles.longueur) {
        return 'Cette case n’existe pas';
      }
      return null;
    }
    case 'passerJoueur': {
      if (course.phase !== 'deplacements' || !course.etape) return "Personne n'a le tour";
      if (course.etape.genre === 'duel' && course.etape.duel.revelees) return "Le duel a déjà engagé les mises";
      return null;
    }
    case 'terminerCourse':
      return null;
    default:
      return null;
  }
}

export function appliquerCourse(
  draft: EtatJeu,
  action: Action,
  origine: Origine,
  ctx: ContexteCourse,
  ajouter: Ajouter,
): void {
  if (action.type === 'basculerBots') {
    draft.bots = !draft.bots;
    ajouter(draft, 'bots', 'hote', draft.bots ? 'Les bots jouent' : 'Les bots sont arrêtés');
    return;
  }
  if (action.type === 'demarrerCourse') {
    const disposition = genererDisposition(ctx.plateau, ctx.alea);
    const positions: Record<string, number> = {};
    for (const joueur of draft.joueurs) positions[joueur.id] = 0;
    draft.course = {
      active: true,
      disposition,
      positions,
      arrivees: [],
      cagnotte: 0,
      pioche: melanger(ctx.cartes.map((carte) => carte.id), ctx.alea),
      defausse: [],
      tour: 0,
      phase: 'preparation',
      misesCloturees: false,
      mises: {},
      ordre: [],
      indexCourant: 0,
      etape: null,
      miniJeu: null,
      choisitId: null,
      carteCourante: null,
      dernierDe: null,
      classement: null,
      regles: reglesDepuis(ctx.plateau),
      historique: historiqueVide(),
    };
    draft.partie.ecranTv = 'plateau';
    ajouter(draft, 'course.demarree', 'public', 'La course commence');
    ajouter(draft, 'ecran', 'public', 'La télé affiche le plateau', { ecran: 'plateau' });
    return;
  }

  const course = draft.course;
  if (!course) return;

  switch (action.type) {
    case 'regenererPlateau': {
      course.disposition = genererDisposition(ctx.plateau, ctx.alea);
      for (const id of Object.keys(course.positions)) course.positions[id] = 0;
      course.arrivees = [];
      course.pioche = melanger(ctx.cartes.map((carte) => carte.id), ctx.alea);
      course.defausse = [];
      ajouter(draft, 'plateau.regenere', 'public', 'Le plateau est mélangé à nouveau');
      break;
    }
    case 'nouveauTour': {
      course.tour += 1;
      course.phase = 'mises';
      course.misesCloturees = false;
      course.mises = {};
      for (const id of Object.keys(course.positions)) course.mises[id] = null;
      course.ordre = [];
      course.indexCourant = 0;
      course.etape = null;
      course.miniJeu = null;
      course.choisitId = null;
      course.carteCourante = null;
      ajouter(draft, 'tour.nouveau', 'public', `Tour ${course.tour} : misez sur vos téléphones`, { tour: course.tour });
      break;
    }
    case 'miser': {
      const id = origine.role === 'joueur' ? origine.joueurId : null;
      if (!id) return;
      course.mises[id] = action.montant;
      ajouter(draft, 'mise.posee', 'public', `${pseudo(draft, id)} a misé`, { joueurId: id });
      break;
    }
    case 'cloreMises': {
      for (const id of Object.keys(course.mises)) {
        if (course.mises[id] === null) course.mises[id] = 0;
      }
      course.misesCloturees = true;
      ajouter(draft, 'mises.cloturees', 'public', 'Les mises sont closes');
      break;
    }
    case 'revelerMises': {
      const liste = Object.entries(course.mises).map(([id, montant]) => ({
        id,
        mise: montant ?? 0,
        gp: soldeVisible(draft, id),
      }));
      let total = 0;
      for (const entree of liste) {
        debiterMise(draft, ctx, entree.id, entree.mise, `Mise du tour ${course.tour}`);
        course.cagnotte += entree.mise;
        total += entree.mise;
        course.historique.mises.push({ tour: course.tour, joueurId: entree.id, montant: entree.mise, duel: false });
      }
      const { ordre, tirage } = calculerOrdre(liste, ctx.alea);
      course.ordre = ordre;
      course.phase = 'revelation';
      const mises = liste.map((entree) => ({ joueurId: entree.id, montant: entree.mise }));
      ajouter(
        draft,
        'mises.revelees',
        'public',
        tirage ? 'Les mises sont révélées. Un tirage au sort départage une égalité.' : 'Les mises sont révélées',
        { mises, ordre, cagnotte: course.cagnotte, total, tirage },
      );
      break;
    }
    case 'passerAuChoix': {
      const id = course.regles.choixMiniJeu === 'dernier' ? course.ordre[course.ordre.length - 1] : course.ordre[0];
      course.choisitId = id ?? null;
      course.phase = 'choixMiniJeu';
      ajouter(draft, 'minijeu.annonce', 'public', `${id ? pseudo(draft, id) : 'Un joueur'} choisit le mini-jeu`, {
        joueurId: id ?? null,
      });
      break;
    }
    case 'choisirMiniJeu': {
      course.miniJeu = action.nom.trim();
      course.phase = 'miniJeu';
      ajouter(draft, 'minijeu.choisi', 'public', `Mini-jeu : ${course.miniJeu}`, {
        nom: course.miniJeu,
        joueurId: course.choisitId,
      });
      break;
    }
    case 'passerAuxDeplacements': {
      course.phase = 'deplacements';
      course.indexCourant = -1;
      course.etape = null;
      ajouter(draft, 'deplacements.commences', 'public', 'Place aux dés');
      avancer(draft, ctx, ajouter);
      break;
    }
    case 'lancerDe': {
      const id = joueurCourant(course);
      if (!id) return;
      const valeur = ctx.alea(6) + 1;
      const depuis = course.positions[id] ?? 0;
      const vers = Math.min(depuis + valeur, course.regles.longueur);
      course.positions[id] = vers;
      course.dernierDe = { joueurId: id, valeur, usage: 'deplacement' };
      course.historique.lancers.push({ tour: course.tour, joueurId: id, valeur, usage: 'deplacement' });
      const cases: number[] = [];
      for (let curseur = depuis + 1; curseur <= vers; curseur += 1) cases.push(curseur);
      ajouter(draft, 'de.lance', 'public', `${pseudo(draft, id)} lance un ${valeur}`, { joueurId: id, valeur, usage: 'deplacement' });
      ajouter(draft, 'pion.avance', 'public', `${pseudo(draft, id)} avance jusqu'à la case ${vers}`, {
        joueurId: id,
        depuis,
        vers,
        cases,
      });
      if (vers >= course.regles.longueur) {
        if (!course.arrivees.includes(id)) course.arrivees.push(id);
        const rang = course.arrivees.indexOf(id) + 1;
        ajouter(draft, 'joueur.arrive', 'public', `${pseudo(draft, id)} arrive ${rang === 1 ? '1er' : `${rang}e`} !`, {
          joueurId: id,
          rang,
        });
        noterEffet(course, id, vers, 'arrivee', { rang });
        avancer(draft, ctx, ajouter);
      } else {
        appliquerCase(draft, ctx, ajouter, id, vers);
      }
      break;
    }
    case 'choisirBeneficiaire': {
      const carte = course.carteCourante?.carte;
      const montant = carte && carte.effet.type === 'cadeau' ? carte.effet.montant : 0;
      crediter(draft, ctx, ajouter, action.joueurId, montant, carte?.titre ?? 'Cadeau');
      ajouter(
        draft,
        'cadeau.donne',
        'public',
        `${pseudo(draft, joueurCourant(course) ?? '')} offre ${montant} GP à ${pseudo(draft, action.joueurId)}`,
        { joueurId: joueurCourant(course), beneficiaireId: action.joueurId, montant },
      );
      avancer(draft, ctx, ajouter);
      break;
    }
    case 'choisirAdversaire': {
      if (course.etape?.genre !== 'duel') return;
      const duel = course.etape.duel;
      duel.adversaireId = action.joueurId;
      duel.etape = 'mises';
      const defis = course.regles.duel.defis;
      duel.defi = defis[ctx.alea(defis.length)] ?? defis[0] ?? 'Défi';
      duel.mises = { [duel.joueurId]: null, [action.joueurId]: null };
      duel.revelees = false;
      ajouter(draft, 'duel.adversaire', 'public', `${pseudo(draft, duel.joueurId)} défie ${pseudo(draft, action.joueurId)}`, {
        joueurId: duel.joueurId,
        adversaireId: action.joueurId,
        defi: duel.defi,
      });
      break;
    }
    case 'miserDuel': {
      if (course.etape?.genre !== 'duel' || origine.role !== 'joueur' || !origine.joueurId) return;
      const duel = course.etape.duel;
      duel.mises[origine.joueurId] = action.montant;
      ajouter(draft, 'duel.mise', 'public', `${pseudo(draft, origine.joueurId)} a misé pour le duel`, {
        joueurId: origine.joueurId,
      });
      const valeurs = Object.values(duel.mises);
      if (valeurs.length >= 2 && valeurs.every((montant) => montant !== null)) revelerDuel(draft, ctx, ajouter, duel);
      break;
    }
    case 'cloreMisesDuel': {
      if (course.etape?.genre !== 'duel') return;
      const duel = course.etape.duel;
      for (const id of Object.keys(duel.mises)) {
        if (duel.mises[id] === null) duel.mises[id] = 0;
      }
      revelerDuel(draft, ctx, ajouter, duel);
      break;
    }
    case 'autreDefi': {
      if (course.etape?.genre !== 'duel') return;
      const duel = course.etape.duel;
      const autres = course.regles.duel.defis.filter((defi) => defi !== duel.defi);
      const suivant = (autres.length > 0 ? autres : course.regles.duel.defis)[ctx.alea(Math.max(autres.length, 1))] ?? duel.defi;
      duel.defi = suivant ?? duel.defi;
      ajouter(draft, 'duel.defi', 'public', `Nouveau défi : ${duel.defi}`, { defi: duel.defi });
      break;
    }
    case 'resultatDuel': {
      if (course.etape?.genre !== 'duel' || !course.etape.duel.adversaireId || !course.etape.duel.defi) return;
      const duel = course.etape.duel;
      const adversaireId = duel.adversaireId;
      if (!adversaireId || !duel.defi) return;
      const miseJoueur = duel.mises[duel.joueurId] ?? 0;
      const miseAdversaire = duel.mises[adversaireId] ?? 0;
      const credits = creditsDuel(miseJoueur, miseAdversaire, action.resultat, course.regles.duel.bonusVainqueur);
      const vainqueurId = action.resultat === 'joueur' ? duel.joueurId : action.resultat === 'adversaire' ? adversaireId : null;
      course.historique.duels.push({
        tour: course.tour,
        joueurId: duel.joueurId,
        adversaireId,
        defi: duel.defi ?? '',
        miseJoueur,
        miseAdversaire,
        resultat: action.resultat,
      });
      const texte = vainqueurId
        ? `${pseudo(draft, vainqueurId)} gagne le duel`
        : 'Égalité : chacun récupère sa mise';
      ajouter(draft, 'duel.resultat', 'public', texte, {
        joueurId: duel.joueurId,
        adversaireId,
        resultat: action.resultat,
        vainqueurId,
      });
      crediter(draft, ctx, ajouter, duel.joueurId, credits.joueur, 'Duel');
      crediter(draft, ctx, ajouter, adversaireId, credits.adversaire, 'Duel');
      avancer(draft, ctx, ajouter);
      break;
    }
    case 'definirPosition': {
      const avant = course.positions[action.joueurId] ?? 0;
      course.positions[action.joueurId] = action.position;
      if (action.position >= course.regles.longueur) {
        if (!course.arrivees.includes(action.joueurId)) course.arrivees.push(action.joueurId);
      } else {
        course.arrivees = course.arrivees.filter((id) => id !== action.joueurId);
      }
      ajouter(
        draft,
        'position.corrigee',
        'public',
        `${pseudo(draft, action.joueurId)} est placé sur la case ${action.position}`,
        { joueurId: action.joueurId, depuis: avant, vers: action.position },
      );
      break;
    }
    case 'passerJoueur': {
      const id = joueurCourant(course);
      if (id) ajouter(draft, 'joueur.passe', 'public', `${pseudo(draft, id)} passe son tour`, { joueurId: id });
      avancer(draft, ctx, ajouter);
      break;
    }
    case 'terminerCourse':
      figerClassement(draft, ctx, ajouter);
      break;
    default:
      break;
  }
}
