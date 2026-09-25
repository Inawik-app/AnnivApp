import { solde } from '../shared/soldes';
import { esperanceDe } from '../shared/de';
import { optionSelonTirage, portionsRoue, renduRoue, rotationRoue, texteOptionRoue, type ConfigRoue, type OptionRoue } from '../shared/roue';
import { distanceLeaderArrivee, rangsCourse } from '../shared/statistiques';
import type {
  Action,
  CarteChance,
  ConfigPlateau,
  ContrepartiePlateau,
  Course,
  EffetPlateau,
  EtatJeu,
  FamilleCarte,
  HistoriqueCourse,
  OptionDe,
  Origine,
  ReglesCourse,
  UsageDe,
  Visibilite,
} from '../shared/types';
import { trouverJoueur } from './libelles';
import { type Alea, calculerClassement, genererDisposition, melanger } from './plateau';
import type { CatalogueMiniJeux, ConfigPoker } from '../shared/mini-jeux';
import type { ConfigTopTen } from '../shared/topten';
import type { ConfigJeopardy } from '../shared/jeopardy';
import type { ConfigUndercover } from '../shared/undercover';
import { appliquerCeremonie, estActionCeremonie, refuserCeremonie } from './ceremonie';
import { appliquerActivite, appliquerChoix, refuserActivite, refuserChoix } from './mini-jeux';
import type { TropheeConfig } from '../shared/trophees';
import { ACTIONS_TOPTEN, appliquerTopTen, oublierJoueurTopTen, refuserTopTen } from './topten';
import { ACTIONS_JEOPARDY, appliquerJeopardy, oublierJoueurJeopardy, refuserJeopardy } from './jeopardy';
import { ACTIONS_UNDERCOVER, appliquerUndercover, refuserUndercover, undercoverInitial } from './undercover';

export type ContexteCourse = {
  maintenant: number;
  id: () => string;
  alea: Alea;
  /** Présent quand le serveur connaît les connexions. Absent dans certains tests. */
  estEnLigne?: (joueurId: string) => boolean;
  /** Mode test : valeur imposée, ou `undefined` quand la file est vide. */
  tirerDe?: () => number | undefined;
  tirerCarte?: () => string | undefined;
  tirerRoue?: () => string | undefined;
  plateau: ConfigPlateau;
  cartes: CarteChance[];
  cartesMalchance: CarteChance[];
  roue: ConfigRoue;
  catalogue: CatalogueMiniJeux;
  poker: ConfigPoker;
  topten: ConfigTopTen;
  jeopardy: ConfigJeopardy;
  undercover: ConfigUndercover;
  dev: boolean;
  /** Partie simulée : le fil d'événements n'est pas conservé. */
  simulation?: boolean;
  /** Catalogue déjà lu, pour éviter de relire le disque à chaque cérémonie. */
  trophees?: TropheeConfig[];
  nombreCeremonie?: number;
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
  'retirerOrdre',
  'choisirMiniJeu',
  'afficherGrille',
  'remettreMiniJeu',
  'demarrerMinuteur',
  'pauseMinuteur',
  'reprendreMinuteur',
  'ajouter30s',
  'arreterMinuteur',
  'echeanceMinuteur',
  'niveauSuivant',
  'validerResultats',
  'validerPoker',
  'passerAuxDeplacements',
  'lancerDe',
  'miserRoue',
  'definirPosition',
  'passerJoueur',
  'terminerCourse',
  'ouvrirPodium',
  'tirerTrophees',
  'revelerTrophee',
  'revelerClassement',
  'revelerGagnant',
  'basculerBots',
]);

export function estActionCourse(action: Action): boolean {
  return ACTIONS.has(action.type) || ACTIONS_TOPTEN.has(action.type) || ACTIONS_JEOPARDY.has(action.type) || ACTIONS_UNDERCOVER.has(action.type);
}

function pseudo(etat: EtatJeu, joueurId: string): string {
  return trouverJoueur(etat.joueurs, joueurId)?.pseudo ?? 'Un joueur';
}

function historiqueVide(): HistoriqueCourse {
  return { lancers: [], effets: [], instantanes: [] };
}

function videContrepartie(): ContrepartiePlateau {
  return { joueurs: [], cagnotte: 0 };
}

function noter(course: Course, effet: Omit<EffetPlateau, 'tour'>): void {
  course.historique.effets.push({ tour: course.tour, ...effet });
}

function noterLancer(
  course: Course,
  joueurId: string,
  valeur: number,
  usage: UsageDe,
  faces: number,
  mise: number,
  option: string | null,
): void {
  course.historique.lancers.push({
    tour: course.tour,
    joueurId,
    valeur,
    usage,
    faces,
    mise,
    esperance: esperanceDe(faces),
    option,
  });
}

function reglesDepuis(config: ConfigPlateau): ReglesCourse {
  return {
    longueur: config.longueur,
    gainBonus: config.gainBonus,
    choixMiniJeu: config.choixMiniJeu,
    optionsDe: config.optionsDe.map((option) => ({ ...option })),
  };
}

function soldeVisible(etat: EtatJeu, joueurId: string): number {
  return solde(etat.transactions, joueurId, 'visibles');
}

function optionChoisie(course: Course, id: string): OptionDe | undefined {
  return course.regles.optionsDe.find((option) => option.id === id);
}

function faceDe(ctx: ContexteCourse, faces: number, forcer: boolean): number {
  if (forcer) {
    const forcee = ctx.tirerDe?.();
    if (typeof forcee === 'number' && Number.isFinite(forcee)) {
      return Math.max(1, Math.min(faces, Math.round(forcee)));
    }
  }
  return ctx.alea(Math.max(1, faces)) + 1;
}

function quiChoisit(draft: EtatJeu, course: Course): string | null {
  const ordre = course.ordre;
  const premier = ordre[0];
  if (!premier) return null;
  if (course.regles.choixMiniJeu === 'dernierAuClassement') {
    let choisi = premier;
    let plancher = soldeVisible(draft, choisi);
    for (const id of ordre) {
      const gp = soldeVisible(draft, id);
      if (gp < plancher) {
        plancher = gp;
        choisi = id;
      }
    }
    return choisi;
  }
  return ordre[(course.tour - 1) % ordre.length] ?? null;
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
  source = 'plateau',
): void {
  if (montant <= 0) return;
  draft.transactions.push({
    id: ctx.id(),
    joueurId,
    montant,
    source,
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

function debiter(
  draft: EtatJeu,
  ctx: ContexteCourse,
  joueurId: string,
  montant: number,
  source: string,
  libelle: string,
  plancher: boolean,
): number {
  if (montant <= 0) return 0;
  const paye = plancher ? Math.min(montant, Math.max(0, soldeVisible(draft, joueurId))) : montant;
  if (paye <= 0) return 0;
  draft.transactions.push({
    id: ctx.id(),
    joueurId,
    montant: -paye,
    source,
    libelle,
    horodatage: ctx.maintenant,
    masquee: false,
  });
  return paye;
}

function exemplaires(cartes: readonly CarteChance[]): string[] {
  const ids: string[] = [];
  for (const carte of cartes) {
    for (let index = 0; index < Math.max(1, carte.poids); index += 1) ids.push(carte.id);
  }
  return ids;
}

function paquetDe(ctx: ContexteCourse, famille: FamilleCarte): CarteChance[] {
  return famille === 'chance' ? ctx.cartes : ctx.cartesMalchance;
}

function piochesVides(ctx: ContexteCourse): { chance: string[]; malchance: string[] } {
  return {
    chance: melanger(exemplaires(ctx.cartes), ctx.alea),
    malchance: melanger(exemplaires(ctx.cartesMalchance), ctx.alea),
  };
}

function piocher(course: Course, ctx: ContexteCourse, famille: FamilleCarte): CarteChance {
  const forcee = ctx.tirerCarte?.();
  const paquet = paquetDe(ctx, famille);
  if (forcee) {
    const trouvee = paquet.find((carte) => carte.id === forcee);
    if (trouvee) return trouvee;
  }
  if (course.pioches[famille].length === 0) {
    const source = course.defausses[famille].length > 0 ? course.defausses[famille] : exemplaires(paquet);
    course.pioches[famille] = melanger(source, ctx.alea);
    course.defausses[famille] = [];
  }
  const id = course.pioches[famille].pop();
  const carte = paquet.find((candidat) => candidat.id === id) ?? paquet[0];
  if (!carte) throw new Error('Aucune carte');
  course.defausses[famille].push(carte.id);
  return carte;
}

function photographier(draft: EtatJeu): void {
  const course = draft.course;
  if (!course) return;
  const ids = draft.joueurs.filter((joueur) => course.positions[joueur.id] !== undefined).map((joueur) => joueur.id);
  const rangs = rangsCourse(ids, (id) => course.positions[id] ?? 0, course.arrivees);
  course.historique.instantanes.push({
    tour: course.tour,
    distanceLeader: distanceLeaderArrivee(
      course.regles.longueur,
      ids.map((id) => course.positions[id] ?? 0),
    ),
    joueurs: ids.map((id) => ({
      id,
      position: course.positions[id] ?? 0,
      rang: rangs[id] ?? ids.length,
      gpVisibles: soldeVisible(draft, id),
    })),
  });
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

function marquerDernierTour(draft: EtatJeu, ajouter: Ajouter): void {
  const course = draft.course;
  if (!course || course.dernierTour) return;
  if (course.phase !== 'deplacements' && course.phase !== 'finTour') return;
  course.dernierTour = true;
  ajouter(draft, 'course.dernierTour', 'public', 'Dernier tour !');
}

function finirTour(draft: EtatJeu, ctx: ContexteCourse, ajouter: Ajouter): void {
  const course = draft.course;
  if (!course) return;
  photographier(draft);
  ajouter(draft, 'tour.fini', 'public', `Fin du tour ${course.tour}`, { tour: course.tour });
  if (course.dernierTour) {
    figerClassement(draft, ctx, ajouter);
    return;
  }
  course.phase = 'finTour';
  course.etape = null;
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

function poser(course: Course, joueurId: string, delta: number): { depuis: number; vers: number; cases: number; arrive: boolean } {
  const depuis = course.positions[joueurId] ?? 0;
  const vers = Math.max(0, Math.min(course.regles.longueur, depuis + delta));
  const etait = course.arrivees.includes(joueurId);
  course.positions[joueurId] = vers;
  if (vers >= course.regles.longueur && !etait) course.arrivees.push(joueurId);
  else if (vers < course.regles.longueur) course.arrivees = course.arrivees.filter((id) => id !== joueurId);
  return { depuis, vers, cases: vers - depuis, arrive: vers >= course.regles.longueur && !etait };
}

function annoncerMouvement(draft: EtatJeu, ajouter: Ajouter, joueurId: string, depuis: number, vers: number): void {
  const course = draft.course;
  if (!course || vers === depuis) return;
  const liste: number[] = [];
  const pas = vers > depuis ? 1 : -1;
  for (let curseur = depuis + pas; pas > 0 ? curseur <= vers : curseur >= vers; curseur += pas) liste.push(curseur);
  ajouter(
    draft,
    vers > depuis ? 'pion.avance' : 'pion.recule',
    'public',
    vers > depuis
      ? `${pseudo(draft, joueurId)} avance jusqu'à la case ${vers}`
      : `${pseudo(draft, joueurId)} recule jusqu'à la case ${vers}`,
    { joueurId, depuis, vers, cases: liste },
  );
  if (vers >= course.regles.longueur) {
    const rang = course.arrivees.indexOf(joueurId) + 1;
    ajouter(draft, 'joueur.arrive', 'public', `${pseudo(draft, joueurId)} arrive ${rang === 1 ? '1er' : `${rang}e`} !`, {
      joueurId,
      rang,
    });
  }
}

function cagnotteVers(course: Course, depuis: number, sens: 'avant' | 'arriere'): number | null {
  const pas = sens === 'avant' ? 1 : -1;
  for (let index = depuis + pas; index > 0 && index < course.regles.longueur; index += pas) {
    if (course.disposition[index] === 'cagnotte') return index;
  }
  return null;
}

function joueursEnCourse(draft: EtatJeu, course: Course, sauf: string): string[] {
  return draft.joueurs.filter((joueur) => joueur.id !== sauf && course.positions[joueur.id] !== undefined).map((joueur) => joueur.id);
}

function appliquerCarte(
  draft: EtatJeu,
  ctx: ContexteCourse,
  ajouter: Ajouter,
  joueurId: string,
  carte: CarteChance,
): void {
  const course = draft.course;
  if (!course) return;
  course.carteCourante = { joueurId, carte };
  const effet = carte.effet;
  let cases = 0;
  let gpGagnes = 0;
  let gpPerdus = 0;
  let gpDonnes = 0;
  let gpRecus = 0;
  const contrepartie = videContrepartie();
  const paiements: Array<{ id: string; montant: number }> = [];
  let deplacement: { depuis: number; vers: number; arrive: boolean } | null = null;

  if (effet.type === 'gain') {
    gpGagnes = effet.montant;
  } else if (effet.type === 'gainDe') {
    const valeur = faceDe(ctx, 6, false);
    course.dernierDe = { joueurId, valeur, faces: 6, usage: 'chance', option: null };
    noterLancer(course, joueurId, valeur, 'chance', 6, 0, null);
    ajouter(draft, 'de.lance', 'public', `${pseudo(draft, joueurId)} lance un dé normal : ${valeur}`, {
      joueurId,
      valeur,
      faces: 6,
      usage: 'chance',
      mise: 0,
      option: 'normal',
      nom: 'dé normal',
    });
    gpGagnes = valeur * 2;
  } else if (effet.type === 'avancer' || effet.type === 'reculer') {
    const delta = effet.type === 'avancer' ? effet.cases : -effet.cases;
    const bouge = poser(course, joueurId, delta);
    cases = bouge.cases;
    deplacement = bouge;
  } else if (effet.type === 'cotisation') {
    for (const autre of joueursEnCourse(draft, course, joueurId)) {
      const paye = debiter(draft, ctx, autre, effet.montant, 'carte', carte.titre, true);
      if (paye <= 0) continue;
      gpRecus += paye;
      contrepartie.joueurs.push({ id: autre, montant: -paye });
      paiements.push({ id: autre, montant: -paye });
    }
    gpGagnes = gpRecus;
  } else if (effet.type === 'perte') {
    const paye = debiter(draft, ctx, joueurId, effet.montant, 'carte', carte.titre, true);
    course.cagnotte += paye;
    gpPerdus = paye;
    contrepartie.cagnotte = paye;
    if (paye > 0) paiements.push({ id: joueurId, montant: -paye });
  } else if (effet.type === 'tournee') {
    const autres = joueursEnCourse(draft, course, joueurId);
    const disponible = Math.min(effet.montant, Math.max(0, soldeVisible(draft, joueurId)));
    const part = autres.length > 0 ? Math.floor(disponible / autres.length) : 0;
    const distribue = part * autres.length;
    const reste = disponible - distribue;
    const paye = debiter(draft, ctx, joueurId, disponible, 'carte', carte.titre, true);
    course.cagnotte += reste;
    gpPerdus = paye;
    gpDonnes = distribue;
    contrepartie.cagnotte = reste;
    if (paye > 0) paiements.push({ id: joueurId, montant: -paye });
    for (const autre of autres) {
      if (part <= 0) continue;
      contrepartie.joueurs.push({ id: autre, montant: part });
    }
  } else if (effet.type === 'cagnotte') {
    const depuis = course.positions[joueurId] ?? 0;
    const cible = cagnotteVers(course, depuis, effet.sens);
    if (cible !== null) {
      const bouge = poser(course, joueurId, cible - depuis);
      cases = bouge.cases;
      deplacement = bouge;
    }
    if (effet.part > 0) {
      const montant = Math.floor(course.cagnotte * effet.part);
      if (montant > 0) {
        course.cagnotte -= montant;
        gpGagnes = montant;
        contrepartie.cagnotte = -montant;
      }
    }
  }

  ajouter(draft, carte.famille === 'malchance' ? 'case.malchance' : 'case.chance', 'public', `${pseudo(draft, joueurId)} pioche « ${carte.titre} »`, {
    joueurId,
    carteId: carte.id,
    titre: carte.titre,
    texte: carte.texte,
    icone: carte.icone,
    famille: carte.famille,
    effet: effet.type,
    paiements,
    cagnotte: course.cagnotte,
  });
  if (deplacement) {
    annoncerMouvement(draft, ajouter, joueurId, deplacement.depuis, deplacement.vers);
    if (deplacement.arrive) marquerDernierTour(draft, ajouter);
  }
  if (gpGagnes > 0) crediter(draft, ctx, ajouter, joueurId, gpGagnes, carte.titre, 'carte');
  if (effet.type === 'tournee') {
    for (const ligne of contrepartie.joueurs) {
      if (ligne.montant > 0) crediter(draft, ctx, ajouter, ligne.id, ligne.montant, carte.titre, 'carte');
    }
  }
  noter(course, {
    joueurId,
    type: carte.famille,
    cases,
    gpGagnes,
    gpPerdus,
    gpDonnes,
    gpRecus,
    contrepartie,
  });
  avancer(draft, ctx, ajouter);
}

function appliquerCase(draft: EtatJeu, ctx: ContexteCourse, ajouter: Ajouter, joueurId: string, caseIndex: number): void {
  const course = draft.course;
  if (!course) return;
  const type = course.disposition[caseIndex];
  if (type === 'bonus') {
    ajouter(draft, 'case.bonus', 'public', `${pseudo(draft, joueurId)} gagne ${course.regles.gainBonus} GP sur une case bonus`, {
      joueurId,
      montant: course.regles.gainBonus,
    });
    crediter(draft, ctx, ajouter, joueurId, course.regles.gainBonus, 'Case bonus');
    noter(course, {
      joueurId,
      type: 'bonus',
      cases: 0,
      gpGagnes: course.regles.gainBonus,
      gpPerdus: 0,
      gpDonnes: 0,
      gpRecus: 0,
      contrepartie: videContrepartie(),
    });
    avancer(draft, ctx, ajouter);
    return;
  }
  if (type === 'cagnotte') {
    const montant = Math.floor(course.cagnotte / 2);
    if (montant > 0) course.cagnotte -= montant;
    ajouter(draft, 'case.cagnotte', 'public', montant > 0 ? `${pseudo(draft, joueurId)} ramasse ${montant} GP dans la cagnotte` : 'La cagnotte est vide', {
      joueurId,
      montant,
      reste: course.cagnotte,
    });
    if (montant > 0) crediter(draft, ctx, ajouter, joueurId, montant, 'Cagnotte');
    noter(course, {
      joueurId,
      type: 'cagnotte',
      cases: 0,
      gpGagnes: montant,
      gpPerdus: 0,
      gpDonnes: 0,
      gpRecus: 0,
      contrepartie: { joueurs: [], cagnotte: -montant },
    });
    avancer(draft, ctx, ajouter);
    return;
  }
  if (type === 'chance' || type === 'malchance') {
    appliquerCarte(draft, ctx, ajouter, joueurId, piocher(course, ctx, type));
    return;
  }
  if (type === 'gamble') {
    course.etape = { genre: 'roue' };
    ajouter(draft, 'roue.annonce', 'public', `${pseudo(draft, joueurId)} arrive sur la roue`, { joueurId });
  }
}

function tournerRoue(draft: EtatJeu, ctx: ContexteCourse, ajouter: Ajouter, joueurId: string, mise: number): void {
  const course = draft.course;
  if (!course) return;
  if (mise === 0) {
    ajouter(draft, 'roue.passe', 'public', `${pseudo(draft, joueurId)} passe la roue`, { joueurId, mise: 0 });
    noter(course, {
      joueurId,
      type: 'roue',
      cases: 0,
      gpGagnes: 0,
      gpPerdus: 0,
      gpDonnes: 0,
      gpRecus: 0,
      contrepartie: videContrepartie(),
      roue: { option: 'passe', mise: 0, rendu: 0 },
    });
    avancer(draft, ctx, ajouter);
    return;
  }
  debiter(draft, ctx, joueurId, mise, 'roue', `Mise de roue, tour ${course.tour}`, false);
  const forcee = ctx.tirerRoue?.();
  const trouvee = forcee ? ctx.roue.options.find((option) => option.id === forcee) : undefined;
  const option: OptionRoue =
    trouvee ??
    optionSelonTirage(
      ctx.roue.options,
      ctx.alea(ctx.roue.options.reduce((total, candidat) => total + candidat.probabilite, 0)),
    );
  const position = (ctx.alea(999) + 1) / 1000;
  const rendu = renduRoue(mise, option.multiplicateur);
  const garde = Math.max(0, mise - rendu);
  course.cagnotte += garde;
  const extra = option.partCagnotte ? Math.floor(course.cagnotte * option.partCagnotte) : 0;
  if (extra > 0) course.cagnotte -= extra;
  const portion = portionsRoue(ctx.roue.options).find((candidat) => candidat.id === option.id);
  const rotation = portion ? rotationRoue(portion, position) : 0;
  const delta = (option.avance ?? 0) - (option.recule ?? 0);
  ajouter(draft, 'roue.tournee', 'public', `${pseudo(draft, joueurId)} : ${option.nom}`, {
    joueurId,
    option: option.id,
    nom: option.nom,
    mise,
    rendu,
    extra,
    cagnotte: course.cagnotte,
    rotation,
    cases: delta,
    ...(option.icone ? { icone: option.icone } : {}),
    options: ctx.roue.options.map((candidat) => ({
      id: candidat.id,
      nom: candidat.nom,
      probabilite: candidat.probabilite,
      couleur: candidat.couleur,
      texte: texteOptionRoue(candidat),
      ...(candidat.icone ? { icone: candidat.icone } : {}),
    })),
  });
  const gagne = rendu + extra;
  if (gagne > 0) crediter(draft, ctx, ajouter, joueurId, gagne, option.nom, 'roue');
  let ecart = 0;
  if (delta !== 0) {
    const bouge = poser(course, joueurId, delta);
    ecart = bouge.cases;
    annoncerMouvement(draft, ajouter, joueurId, bouge.depuis, bouge.vers);
    if (bouge.arrive) marquerDernierTour(draft, ajouter);
  }
  noter(course, {
    joueurId,
    type: 'roue',
    cases: ecart,
    gpGagnes: gagne,
    gpPerdus: mise,
    gpDonnes: 0,
    gpRecus: 0,
    contrepartie: { joueurs: [], cagnotte: garde - extra },
    roue: { option: option.id, mise, rendu: gagne },
  });
  avancer(draft, ctx, ajouter);
}

export function oublierJoueurCourse(draft: EtatJeu, joueurId: string): void {
  const course = draft.course;
  if (!course) return;
  delete course.positions[joueurId];
  course.arrivees = course.arrivees.filter((id) => id !== joueurId);
  course.ordre = course.ordre.filter((id) => id !== joueurId);
  if (course.classement) course.classement = course.classement.filter((id) => id !== joueurId);
  if (course.choisitId === joueurId) course.choisitId = course.ordre[0] ?? null;
  if (course.indexCourant >= course.ordre.length) course.indexCourant = Math.max(0, course.ordre.length - 1);
  if (joueurCourant(course) === joueurId) course.etape = { genre: 'lancer' };
  oublierJoueurTopTen(course, joueurId);
  oublierJoueurJeopardy(course, joueurId);
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
    action.type === 'retirerOrdre' ||
    action.type === 'choisirMiniJeu' ||
    action.type === 'afficherGrille' ||
    action.type === 'remettreMiniJeu' ||
    action.type === 'demarrerMinuteur' ||
    action.type === 'pauseMinuteur' ||
    action.type === 'reprendreMinuteur' ||
    action.type === 'ajouter30s' ||
    action.type === 'arreterMinuteur' ||
    action.type === 'echeanceMinuteur' ||
    action.type === 'niveauSuivant' ||
    action.type === 'validerResultats' ||
    action.type === 'validerPoker' ||
    action.type === 'passerAuxDeplacements' ||
    action.type === 'definirPosition' ||
    action.type === 'passerJoueur' ||
    action.type === 'terminerCourse' ||
    action.type === 'nouveauTour' ||
    estActionCeremonie(action.type)
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
  if (estActionCeremonie(action.type)) return refuserCeremonie(etat, action, origine) ?? null;
  if (course.phase === 'terminee') return 'La course est terminée';

  switch (action.type) {
    case 'regenererPlateau':
      if (course.phase !== 'preparation') return 'Le plateau ne peut plus changer';
      return null;
    case 'nouveauTour':
      if (course.dernierTour) return 'Le dernier tour est déjà lancé';
      if (course.phase !== 'preparation' && course.phase !== 'finTour') return "Ce n'est pas le moment de lancer un tour";
      return null;
    case 'retirerOrdre':
      if (course.phase !== 'preparation' || course.tour !== 0) return "L'ordre ne peut plus être retiré";
      return null;
    case 'choisirMiniJeu':
      return refuserChoix(etat, action, ctx);
    case 'passerAuxDeplacements':
      if (course.phase !== 'miniJeu') return "Ce n'est pas le moment des déplacements";
      return null;
    case 'lancerDe': {
      if (course.phase !== 'deplacements' || course.etape?.genre !== 'lancer') return "Ce n'est pas le moment de lancer le dé";
      const courant = joueurCourant(course);
      if (!courant) return 'Personne ne doit lancer';
      if (!hote && joueurId !== courant) return "Ce n'est pas ton tour";
      if ((course.positions[courant] ?? 0) >= course.regles.longueur) return 'Tu es déjà arrivé';
      const option = optionChoisie(course, action.option);
      if (!option) return "Ce dé n'existe pas";
      if (option.mise > soldeVisible(etat, courant)) return "Tu n'as pas assez de GP visibles";
      return null;
    }
    case 'miserRoue': {
      if (course.phase !== 'deplacements' || course.etape?.genre !== 'roue') return "Ce n'est pas le moment de la roue";
      const courant = joueurCourant(course);
      if (!courant) return 'Personne ne doit miser';
      if (!hote && joueurId !== courant) return "Ce n'est pas ton tour";
      if (typeof action.montant !== 'number' || !Number.isInteger(action.montant) || action.montant < 0) {
        return 'La mise doit être un nombre entier';
      }
      if (hote && action.montant !== 0) return "L'hôte passe la roue sans miser";
      if (hote && ctx.estEnLigne?.(courant)) return "Le joueur est connecté : c'est à lui de faire tourner la roue";
      if (action.montant > soldeVisible(etat, courant)) return "Tu n'as pas assez de GP visibles";
      return null;
    }
    case 'definirPosition': {
      if (!trouverJoueur(etat.joueurs, action.joueurId)) return "Ce joueur n'est plus dans la partie";
      if (!Number.isInteger(action.position) || action.position < 0 || action.position > course.regles.longueur) {
        return 'Cette case n’existe pas';
      }
      return null;
    }
    case 'passerJoueur':
      if (course.phase !== 'deplacements' || !course.etape) return "Personne n'a le tour";
      return null;
    case 'terminerCourse':
      return null;
    default: {
      if (ACTIONS_TOPTEN.has(action.type)) return refuserTopTen(etat, action, origine, ctx);
      if (ACTIONS_JEOPARDY.has(action.type)) return refuserJeopardy(etat, action, origine, ctx);
      if (ACTIONS_UNDERCOVER.has(action.type)) return refuserUndercover(etat, action, origine, ctx);
      const erreur = refuserActivite(etat, action, origine, ctx);
      return erreur === undefined ? null : erreur;
    }
  }
}

function courseNeuve(draft: EtatJeu, ctx: ContexteCourse): Course {
  const disposition = genererDisposition(ctx.plateau, ctx.alea);
  const positions: Record<string, number> = {};
  for (const joueur of draft.joueurs) positions[joueur.id] = 0;
  const themesJoues = draft.course?.topten?.themesJoues ?? [];
  const pairesJouees = draft.course?.undercover?.pairesJouees ?? [];
  return {
    active: true,
    disposition,
    positions,
    arrivees: [],
    cagnotte: 0,
    pioches: piochesVides(ctx),
    defausses: { chance: [], malchance: [] },
    tour: 0,
    phase: 'preparation',
    ordre: melanger(draft.joueurs.map((joueur) => joueur.id), ctx.alea),
    indexCourant: 0,
    etape: null,
    miniJeu: null,
    miniJeuId: null,
    joues: [],
    grilleVisible: false,
    ecranMini: null,
    resultatsSaisis: false,
    minuteur: { etat: 'arrete', finA: null, resteMs: 0, libelle: '' },
    poker: { actif: false, niveau: 0 },
    topten: themesJoues.length > 0 ? { captens: [], manches: [], themesJoues: [...themesJoues], recap: false } : null,
    undercover: pairesJouees.length > 0 ? undercoverInitial(ctx.undercover.manches, pairesJouees) : null,
    choisitId: null,
    carteCourante: null,
    dernierDe: null,
    classement: null,
    dernierTour: false,
    ceremonie: null,
    regles: reglesDepuis(ctx.plateau),
    historique: historiqueVide(),
  };
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
    draft.course = courseNeuve(draft, ctx);
    draft.partie.ecranTv = 'plateau';
    ajouter(draft, 'course.demarree', 'public', 'La course commence');
    ajouter(draft, 'ecran', 'public', 'La télé affiche le plateau', { ecran: 'plateau' });
    const premier = draft.course.ordre[0];
    ajouter(draft, 'ordre.tire', 'public', `${premier ? pseudo(draft, premier) : 'Un joueur'} commence !`, {
      ordre: draft.course.ordre,
    });
    return;
  }

  const course = draft.course;
  if (!course) return;
  if (appliquerCeremonie(draft, action, ctx, ajouter)) return;

  switch (action.type) {
    case 'regenererPlateau': {
      course.disposition = genererDisposition(ctx.plateau, ctx.alea);
      for (const id of Object.keys(course.positions)) course.positions[id] = 0;
      course.arrivees = [];
      course.pioches = piochesVides(ctx);
      course.defausses = { chance: [], malchance: [] };
      ajouter(draft, 'plateau.regenere', 'public', 'Le plateau est mélangé à nouveau');
      break;
    }
    case 'nouveauTour': {
      course.tour += 1;
      course.indexCourant = 0;
      course.etape = null;
      course.miniJeu = null;
      course.miniJeuId = null;
      course.ecranMini = null;
      course.resultatsSaisis = false;
      course.poker = { actif: false, niveau: 0 };
      course.minuteur = { etat: 'arrete', finA: null, resteMs: 0, libelle: '' };
      course.carteCourante = null;
      course.phase = 'choixMiniJeu';
      course.choisitId = quiChoisit(draft, course);
      ajouter(draft, 'tour.nouveau', 'public', `Tour ${course.tour}`, { tour: course.tour });
      ajouter(draft, 'minijeu.annonce', 'public', `${course.choisitId ? pseudo(draft, course.choisitId) : 'Un joueur'} choisit le mini-jeu`, {
        joueurId: course.choisitId,
      });
      break;
    }
    case 'retirerOrdre': {
      course.ordre = melanger(
        draft.joueurs.filter((joueur) => course.positions[joueur.id] !== undefined).map((joueur) => joueur.id),
        ctx.alea,
      );
      const premier = course.ordre[0];
      ajouter(draft, 'ordre.tire', 'public', `${premier ? pseudo(draft, premier) : 'Un joueur'} commence !`, {
        ordre: course.ordre,
      });
      break;
    }
    case 'choisirMiniJeu':
      appliquerChoix(draft, action, ctx, ajouter);
      break;
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
      const option = optionChoisie(course, action.option);
      if (!id || !option) return;
      const mise = option.mise;
      debiter(draft, ctx, id, mise, 'mise', `Mise du tour ${course.tour}`, false);
      course.cagnotte += mise;
      const valeur = faceDe(ctx, option.faces, true);
      const bouge = poser(course, id, valeur);
      course.dernierDe = { joueurId: id, valeur, faces: option.faces, usage: 'deplacement', option: option.id };
      noterLancer(course, id, valeur, 'deplacement', option.faces, mise, option.id);
      const nomDe = option.nom.toLowerCase();
      ajouter(
        draft,
        'de.lance',
        'public',
        mise > 0 ? `${pseudo(draft, id)} lance le ${nomDe} (${mise} GP)` : `${pseudo(draft, id)} lance le ${nomDe}`,
        { joueurId: id, valeur, usage: 'deplacement', mise, faces: option.faces, option: option.id, nom: nomDe },
      );
      annoncerMouvement(draft, ajouter, id, bouge.depuis, bouge.vers);
      if (bouge.arrive) marquerDernierTour(draft, ajouter);
      noter(course, {
        joueurId: id,
        type: 'de',
        cases: bouge.cases,
        gpGagnes: 0,
        gpPerdus: mise,
        gpDonnes: 0,
        gpRecus: 0,
        contrepartie: { joueurs: [], cagnotte: mise },
        miseDe: { option: option.id, faces: option.faces, mise, valeur, esperance: esperanceDe(option.faces) },
      });
      if (bouge.vers >= course.regles.longueur) avancer(draft, ctx, ajouter);
      else appliquerCase(draft, ctx, ajouter, id, bouge.vers);
      break;
    }
    case 'miserRoue':
      if (joueurCourant(course)) tournerRoue(draft, ctx, ajouter, joueurCourant(course)!, action.montant);
      break;
    case 'definirPosition': {
      const avant = course.positions[action.joueurId] ?? 0;
      course.positions[action.joueurId] = action.position;
      const etaitArrive = course.arrivees.includes(action.joueurId);
      if (action.position >= course.regles.longueur) {
        if (!etaitArrive) course.arrivees.push(action.joueurId);
      } else {
        course.arrivees = course.arrivees.filter((id) => id !== action.joueurId);
      }
      if (action.position >= course.regles.longueur && !etaitArrive) marquerDernierTour(draft, ajouter);
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
      if (ACTIONS_TOPTEN.has(action.type)) appliquerTopTen(draft, action, ctx, ajouter);
      else if (ACTIONS_JEOPARDY.has(action.type)) appliquerJeopardy(draft, action, ctx, ajouter, origine);
      else if (ACTIONS_UNDERCOVER.has(action.type)) appliquerUndercover(draft, action, ctx, ajouter);
      else appliquerActivite(draft, action, ctx, ajouter);
      break;
  }
}
