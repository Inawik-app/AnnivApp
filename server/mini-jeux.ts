import { LIBELLE_MAX } from '../shared/constantes';
import {
  baremeClassement,
  dureeNiveauMs,
  ecranPour,
  gainsClassement,
  gainsEquipes,
  jeuParId,
  repartirTapisHote,
  type GainMiniJeu,
} from '../shared/mini-jeux';
import { solde } from '../shared/soldes';
import { REPONDANT_HOTE } from '../shared/topten';
import type { Action, EtatJeu, Joueur, Minuteur, Origine, Visibilite } from '../shared/types';
import type { ContexteCourse } from './course';
import { trouverJoueur } from './libelles';
import { justoneInitial } from './justone';

type Ajouter = (
  draft: EtatJeu,
  type: string,
  visibilite: Visibilite,
  libelle: string,
  donnees?: Record<string, unknown>,
) => void;

const ACTIONS = new Set<Action['type']>([
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
]);

function pseudo(etat: EtatJeu, joueurId: string): string {
  return trouverJoueur(etat.joueurs, joueurId)?.pseudo ?? 'Un joueur';
}

function joueursTries(etat: EtatJeu): Joueur[] {
  return [...etat.joueurs].sort((a, b) => a.rejointA - b.rejointA || a.pseudo.localeCompare(b.pseudo, 'fr'));
}

function entierPositif(valeur: unknown, zeroAutorise = false): valeur is number {
  return typeof valeur === 'number' && Number.isInteger(valeur) && (zeroAutorise ? valeur >= 0 : valeur > 0);
}

function idsConnus(etat: EtatJeu, ids: string[]): string | null {
  const connus = new Set(etat.joueurs.map((joueur) => joueur.id));
  for (const id of ids) {
    if (!connus.has(id)) return "Ce joueur n'est plus dans la partie";
  }
  return null;
}

export function crediter(
  draft: EtatJeu,
  ctx: ContexteCourse,
  ajouter: Ajouter,
  joueurId: string,
  montant: number,
  libelle: string,
  source: string,
): void {
  if (montant <= 0) return;
  if (joueurId === 'hote' || joueurId === REPONDANT_HOTE) return;
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

function poserPodium(draft: EtatJeu, ajouter: Ajouter, nom: string, lignes: GainMiniJeu[]): void {
  ajouter(draft, 'minijeu.podium', 'public', `Résultats : ${nom}`, {
    nom,
    lignes: lignes.map((ligne) => ({
      joueurId: ligne.joueurId,
      pseudo: pseudo(draft, ligne.joueurId),
      montant: ligne.montant,
      rang: ligne.rang ?? null,
    })),
  });
}

function libelleNiveau(ctx: ContexteCourse, niveau: number): string {
  const blinds = ctx.poker.niveaux[niveau];
  if (!blinds) return 'Blinds';
  return `Blinds ${blinds.petite} / ${blinds.grosse}`;
}

function lancerMinuteur(ctx: ContexteCourse, dureeMs: number, libelle: string): Minuteur {
  return { etat: 'enCours', finA: ctx.maintenant + dureeMs, resteMs: dureeMs, libelle };
}

function avancerNiveau(draft: EtatJeu, ctx: ContexteCourse, ajouter: Ajouter): string | null {
  const course = draft.course;
  if (!course || !course.poker.actif) return "Le poker n'est pas en cours";
  const suivant = course.poker.niveau + 1;
  if (suivant >= ctx.poker.niveaux.length) return "C'est déjà le dernier niveau";
  course.poker.niveau = suivant;
  const ms = dureeNiveauMs(ctx.poker);
  course.minuteur = lancerMinuteur(ctx, ms, libelleNiveau(ctx, suivant));
  const blinds = ctx.poker.niveaux[suivant];
  ajouter(
    draft,
    'poker.niveau',
    'public',
    blinds ? `Niveau ${suivant + 1} : petites blinds ${blinds.petite}, grosses blinds ${blinds.grosse}` : 'Niveau suivant',
    { niveau: suivant, petite: blinds?.petite ?? 0, grosse: blinds?.grosse ?? 0 },
  );
  return null;
}

export function refuserChoix(etat: EtatJeu, action: Extract<Action, { type: 'choisirMiniJeu' }>, ctx: ContexteCourse): string | null {
  const course = etat.course;
  if (!course || course.phase !== 'choixMiniJeu') return "Ce n'est pas le moment de choisir le mini-jeu";
  if (!jeuParId(ctx.catalogue, action.id)) return "Ce mini-jeu n'existe pas";
  return null;
}

export function appliquerChoix(
  draft: EtatJeu,
  action: Extract<Action, { type: 'choisirMiniJeu' }>,
  ctx: ContexteCourse,
  ajouter: Ajouter,
): void {
  const course = draft.course;
  const jeu = course ? jeuParId(ctx.catalogue, action.id) : undefined;
  if (!course || !jeu) return;
  course.miniJeu = jeu.nom;
  course.miniJeuId = jeu.id;
  course.phase = 'miniJeu';
  course.ecranMini = ecranPour(jeu.module);
  course.resultatsSaisis = false;
  course.minuteur = { etat: 'arrete', finA: null, resteMs: 0, libelle: '' };
  course.poker = jeu.module === 'poker' ? { actif: true, niveau: 0 } : { actif: false, niveau: 0 };
  if (jeu.module === 'topten') {
    course.topten = {
      captens: [...course.ordre],
      manches: [],
      themesJoues: [...(course.topten?.themesJoues ?? [])],
      recap: false,
    };
  }
  if (jeu.module === 'jeopardy') {
    course.jeopardy = { choisisseurId: course.ordre[0] ?? null, jouees: [], question: null, gains: {}, termine: false };
  }
  if (jeu.module === 'undercover') {
    course.undercover = {
      nbManches: ctx.undercover.manches,
      manches: [],
      pairesJouees: [...(course.undercover?.pairesJouees ?? [])],
      recap: false,
    };
  }
  if (jeu.module === 'codenames') {
    const mots = [...(course.motsSoiree ?? course.codenames?.motsJoues ?? [])];
    course.motsSoiree = mots;
    course.codenames = {
      nbManches: ctx.codenames.manches,
      motsJoues: [...mots],
      preparation: { equipes: { rouge: [], bleu: [] }, espions: { rouge: null, bleu: null } },
      manches: [],
    };
  }
  if (jeu.module === 'perudo') {
    const config = ctx.perudo;
    const premierId = course.ordre[ctx.alea(Math.max(1, course.ordre.length))] ?? course.ordre[0] ?? '';
    course.perudo = {
      desParJoueur: config.desParJoueur,
      calzaAutorise: config.calza,
      numeroManche: 1,
      joueurs: course.ordre.map((id) => ({ id, desRestants: config.desParJoueur, faces: [], aLance: false })),
      indexCourant: Math.max(0, course.ordre.indexOf(premierId)),
      etape: 'lancers',
      annonce: null,
      historique: [],
      revelation: null,
      elimines: [],
      premierId,
      gains: {},
    };
  }
  if (jeu.module === 'justone') {
    course.justone = justoneInitial(course.ordre, ctx.justone);
  }
  if (!course.joues.includes(jeu.id)) course.joues.push(jeu.id);
  ajouter(draft, 'minijeu.choisi', 'public', `Mini-jeu : ${jeu.nom}`, {
    nom: jeu.nom,
    id: jeu.id,
    module: jeu.module,
    joueurId: course.choisitId,
  });
}

export function refuserActivite(etat: EtatJeu, action: Action, origine: Origine, ctx: ContexteCourse): string | null | undefined {
  if (!ACTIONS.has(action.type)) return undefined;
  if (origine.role !== 'hote') return "Seul l'hôte peut faire cette action";
  const course = etat.course;
  if (!course || !course.active) return "La course n'a pas commencé";
  if (course.phase === 'terminee') return 'La course est terminée';

  switch (action.type) {
    case 'afficherGrille':
      if (course.tour < 1) return "La grille s'affiche à partir du premier tour";
      return null;
    case 'remettreMiniJeu':
      if (!course.joues.includes(action.id)) return "Ce mini-jeu n'est pas marqué comme joué";
      return null;
    case 'demarrerMinuteur':
      if (!entierPositif(action.duree) || action.duree > 24 * 3600) return 'Indique une durée en secondes';
      if (typeof action.libelle !== 'string' || action.libelle.trim().length === 0) return 'Indique le libellé du minuteur';
      if (action.libelle.trim().length > LIBELLE_MAX) return 'Le libellé du minuteur est trop long';
      return null;
    case 'pauseMinuteur':
      if (course.minuteur.etat !== 'enCours' || course.minuteur.finA === null) return 'Le minuteur ne tourne pas';
      return null;
    case 'reprendreMinuteur':
      if (course.minuteur.etat !== 'enPause') return "Le minuteur n'est pas en pause";
      if (course.minuteur.resteMs <= 0) return 'Le minuteur est terminé';
      return null;
    case 'ajouter30s':
      if (course.minuteur.etat === 'arrete') return 'Le minuteur est arrêté';
      return null;
    case 'arreterMinuteur':
      if (course.minuteur.etat === 'arrete') return 'Le minuteur est déjà arrêté';
      return null;
    case 'echeanceMinuteur':
      if (course.minuteur.etat !== 'enCours' || course.minuteur.finA === null) return 'Le minuteur ne tourne pas';
      if (ctx.maintenant < course.minuteur.finA) return "Le minuteur n'est pas terminé";
      return null;
    case 'niveauSuivant':
      if (!course.poker.actif) return "Le poker n'est pas en cours";
      if (course.poker.niveau + 1 >= ctx.poker.niveaux.length) return "C'est déjà le dernier niveau";
      return null;
    case 'validerResultats': {
      if (course.phase !== 'miniJeu' || !course.miniJeuId) return "Ce n'est pas le moment de saisir les résultats";
      if (course.resultatsSaisis) return 'Les résultats sont déjà enregistrés';
      const jeu = jeuParId(ctx.catalogue, course.miniJeuId);
      if (!jeu) return "Ce mini-jeu n'existe pas";
      if (jeu.module === 'poker') return 'Le poker se termine par la conversion des tapis';
      if (jeu.module === 'topten') return 'Le Top Ten se joue manche par manche depuis son panneau';
      if (jeu.module === 'jeopardy') return 'Le Jeopardy se joue case par case depuis son panneau';
      if (jeu.module === 'undercover') return "L'Undercover se joue manche par manche depuis son panneau";
      if (jeu.module === 'codenames') return 'Le Codenames se joue depuis son panneau';
      if (jeu.module === 'perudo') return 'Le Perudo se joue depuis son panneau';
      if (jeu.module === 'justone') return 'Le Just One se joue depuis son panneau';
      if (action.saisie.mode !== jeu.saisie) return 'Cette saisie ne correspond pas au mini-jeu';
      return refuserSaisie(etat, action);
    }
    case 'validerPoker': {
      if (course.phase !== 'miniJeu' || !course.poker.actif) return "Le poker n'est pas en cours";
      if (course.resultatsSaisis) return 'Les résultats sont déjà enregistrés';
      const ids = joueursTries(etat).map((joueur) => joueur.id);
      if (!entierPositif(action.tapisHote, true)) return 'Le tapis de l\'hôte est invalide';
      for (const id of ids) {
        if (!entierPositif(action.tapis[id], true)) return 'Indique le tapis de chaque joueur';
      }
      return idsConnus(etat, Object.keys(action.tapis));
    }
    default:
      return undefined;
  }
}

function refuserSaisie(etat: EtatJeu, action: Extract<Action, { type: 'validerResultats' }>): string | null {
  const ids = joueursTries(etat).map((joueur) => joueur.id);
  const saisie = action.saisie;
  if (saisie.mode === 'classement') {
    if (saisie.ordre.length !== ids.length) return 'Classe tous les joueurs';
    const vus = new Set<string>();
    for (const entree of saisie.ordre) {
      if (!ids.includes(entree.joueurId)) return "Ce joueur n'est plus dans la partie";
      if (vus.has(entree.joueurId)) return 'Un joueur apparaît deux fois dans le classement';
      if (typeof entree.exAequo !== 'boolean') return 'Le classement est illisible';
      vus.add(entree.joueurId);
    }
    return null;
  }
  if (saisie.mode === 'equipes') {
    if (saisie.gagnante !== 'A' && saisie.gagnante !== 'B') return "Désigne l'équipe gagnante";
    const tous = [...saisie.equipeA, ...saisie.equipeB];
    if (saisie.equipeA.length === 0 || saisie.equipeB.length === 0) return 'Chaque équipe doit avoir au moins un joueur';
    if (tous.length !== ids.length || new Set(tous).size !== ids.length) return 'Chaque joueur doit être dans une équipe';
    return idsConnus(etat, tous);
  }
  for (const id of ids) {
    if (!entierPositif(saisie.montants[id], true)) return 'Indique les GP de chaque joueur';
  }
  return idsConnus(etat, Object.keys(saisie.montants));
}

export function appliquerActivite(draft: EtatJeu, action: Action, ctx: ContexteCourse, ajouter: Ajouter): boolean {
  if (!ACTIONS.has(action.type)) return false;
  const course = draft.course;
  if (!course) return true;

  switch (action.type) {
    case 'afficherGrille':
      course.grilleVisible = !course.grilleVisible;
      ajouter(draft, 'grille', 'public', course.grilleVisible ? 'Grille des mini-jeux' : 'Grille masquée', {
        visible: course.grilleVisible,
      });
      return true;
    case 'remettreMiniJeu':
      course.joues = course.joues.filter((id) => id !== action.id);
      ajouter(draft, 'minijeu.remis', 'hote', 'Mini-jeu remis en jeu', { id: action.id });
      return true;
    case 'demarrerMinuteur': {
      const ms = action.duree * 1000;
      course.minuteur = lancerMinuteur(ctx, ms, action.libelle.trim());
      ajouter(draft, 'minuteur.demarre', 'public', course.minuteur.libelle, { dureeMs: ms });
      return true;
    }
    case 'pauseMinuteur': {
      const fin = course.minuteur.finA ?? ctx.maintenant;
      course.minuteur = {
        etat: 'enPause',
        finA: null,
        resteMs: Math.max(0, fin - ctx.maintenant),
        libelle: course.minuteur.libelle,
      };
      ajouter(draft, 'minuteur.pause', 'public', 'Minuteur en pause', { resteMs: course.minuteur.resteMs });
      return true;
    }
    case 'reprendreMinuteur':
      course.minuteur = lancerMinuteur(ctx, course.minuteur.resteMs, course.minuteur.libelle);
      ajouter(draft, 'minuteur.repris', 'public', 'Minuteur repris', { resteMs: course.minuteur.resteMs });
      return true;
    case 'ajouter30s':
      if (course.minuteur.etat === 'enCours' && course.minuteur.finA !== null) {
        course.minuteur.finA += 30_000;
        course.minuteur.resteMs += 30_000;
      } else if (course.minuteur.etat === 'enPause') {
        course.minuteur.resteMs += 30_000;
      }
      ajouter(draft, 'minuteur.prolonge', 'public', '30 secondes de plus', { resteMs: course.minuteur.resteMs });
      return true;
    case 'arreterMinuteur':
      course.minuteur = { etat: 'arrete', finA: null, resteMs: 0, libelle: '' };
      ajouter(draft, 'minuteur.arrete', 'public', 'Minuteur arrêté');
      return true;
    case 'echeanceMinuteur':
      if (course.poker.actif && course.poker.niveau + 1 < ctx.poker.niveaux.length) {
        avancerNiveau(draft, ctx, ajouter);
        return true;
      }
      course.minuteur = { etat: 'arrete', finA: null, resteMs: 0, libelle: course.minuteur.libelle };
      ajouter(draft, 'minuteur.termine', 'public', 'Minuteur terminé');
      return true;
    case 'niveauSuivant':
      avancerNiveau(draft, ctx, ajouter);
      return true;
    case 'validerResultats':
      appliquerResultats(draft, action, ctx, ajouter);
      return true;
    case 'validerPoker':
      appliquerPoker(draft, action, ctx, ajouter);
      return true;
    default:
      return false;
  }
}

function appliquerResultats(
  draft: EtatJeu,
  action: Extract<Action, { type: 'validerResultats' }>,
  ctx: ContexteCourse,
  ajouter: Ajouter,
): void {
  const course = draft.course;
  if (!course || !course.miniJeuId) return;
  const jeu = jeuParId(ctx.catalogue, course.miniJeuId);
  if (!jeu) return;
  const saisie = action.saisie;
  let gains: GainMiniJeu[] = [];
  if (saisie.mode === 'classement') gains = gainsClassement(saisie.ordre, baremeClassement(jeu, ctx.catalogue));
  if (saisie.mode === 'equipes') gains = gainsEquipes(saisie.equipeA, saisie.equipeB, saisie.gagnante, ctx.catalogue.baremes.equipes);
  if (saisie.mode === 'libre') {
    gains = joueursTries(draft).map((joueur) => ({ joueurId: joueur.id, montant: saisie.montants[joueur.id] ?? 0 }));
  }
  course.resultatsSaisis = true;
  poserPodium(draft, ajouter, jeu.nom, gains);
  for (const gain of gains) crediter(draft, ctx, ajouter, gain.joueurId, gain.montant, jeu.nom, 'mini-jeu');
}

function appliquerPoker(
  draft: EtatJeu,
  action: Extract<Action, { type: 'validerPoker' }>,
  ctx: ContexteCourse,
  ajouter: Ajouter,
): void {
  const course = draft.course;
  if (!course) return;
  const jeu = course.miniJeuId ? jeuParId(ctx.catalogue, course.miniJeuId) : undefined;
  const nom = jeu?.nom ?? 'Poker';
  const joueurs = joueursTries(draft);
  const parts = repartirTapisHote(
    action.tapisHote,
    joueurs.map((joueur) => ({ id: joueur.id, gpVisibles: solde(draft.transactions, joueur.id, 'visibles') })),
  );
  const partDe = new Map(parts.map((part) => [part.joueurId, part.montant]));
  const gains = joueurs.map((joueur) => ({
    joueurId: joueur.id,
    montant: (action.tapis[joueur.id] ?? 0) + (partDe.get(joueur.id) ?? 0),
  }));
  course.resultatsSaisis = true;
  course.poker.actif = false;
  poserPodium(draft, ajouter, nom, gains);
  for (const gain of gains) crediter(draft, ctx, ajouter, gain.joueurId, gain.montant, nom, 'poker');
}
