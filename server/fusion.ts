import { SCHEMA } from '../shared/constantes';
import type { ConfigPartie, Course, EtatJeu } from '../shared/types';
import { etatInitial } from './etat-initial';

export type DonneesPersistees = {
  etat: EtatJeu;
  jetons: Record<string, string>;
  prochainIdEvenement: number;
};

function estObjet(valeur: unknown): valeur is Record<string, unknown> {
  return !!valeur && typeof valeur === 'object' && !Array.isArray(valeur);
}

const ICONES_DE: Record<string, string> = { normal: 'de', booste: 'de-dore', super: 'super-de' };

const OPTIONS_DEFAUT = [
  { id: 'normal', nom: 'Dé normal', faces: 6, mise: 0, icone: 'de' },
  { id: 'booste', nom: 'Dé boosté', faces: 7, mise: 1, icone: 'de-dore' },
  { id: 'super', nom: 'Super dé', faces: 8, mise: 2, icone: 'super-de' },
];

function normaliserCourse(valeur: unknown): Course | null {
  if (!estObjet(valeur)) return null;
  if (!Array.isArray(valeur.disposition) || typeof valeur.phase !== 'string' || !estObjet(valeur.regles)) return null;
  if (!estObjet(valeur.positions)) return null;
  if (!Array.isArray(valeur.pioche) && !estObjet(valeur.pioches)) return null;
  valeur.disposition = valeur.disposition.map((type) => (type === 'duel' ? 'gamble' : type));
  const course = valeur as Course;
  if (!course.pioches || !Array.isArray(course.pioches.chance) || !Array.isArray(course.pioches.malchance)) {
    course.pioches = { chance: [], malchance: [] };
  }
  if (!course.defausses || !Array.isArray(course.defausses.chance) || !Array.isArray(course.defausses.malchance)) {
    course.defausses = { chance: [], malchance: [] };
  }
  if (!course.historique || !Array.isArray(course.historique.lancers)) {
    course.historique = { lancers: [], effets: [], instantanes: [] };
  }
  if (!Array.isArray(course.historique.effets) || course.historique.effets.some((effet) => !effet || typeof effet.gpGagnes !== 'number')) {
    course.historique.effets = [];
  }
  if (!Array.isArray(course.historique.instantanes)) course.historique.instantanes = [];
  if (!Array.isArray(course.arrivees)) course.arrivees = [];
  if (!Array.isArray(course.regles.optionsDe) || course.regles.optionsDe.length === 0) {
    course.regles.optionsDe = OPTIONS_DEFAUT.map((option) => ({ ...option }));
  }
  for (const option of course.regles.optionsDe) {
    if (typeof option.icone !== 'string' || option.icone === '') option.icone = ICONES_DE[option.id] ?? 'de';
  }
  if (!Array.isArray(course.regles.recompenseArrivee) || course.regles.recompenseArrivee.length !== 4) {
    course.regles.recompenseArrivee = [0, 0, 0, 0];
  }
  if (
    course.regles.coupDePouce !== 'aucun' &&
    course.regles.coupDePouce !== 'de7' &&
    course.regles.coupDePouce !== 'de8'
  ) {
    course.regles.coupDePouce = 'aucun';
  }
  if (typeof course.coupDePouceActif !== 'boolean') course.coupDePouceActif = false;
  for (const lancer of course.historique.lancers) {
    if (typeof lancer.mise !== 'number') lancer.mise = 0;
    if (typeof lancer.faces !== 'number') lancer.faces = 6;
    if (typeof lancer.esperance !== 'number') lancer.esperance = (lancer.faces + 1) / 2;
    if (typeof lancer.option !== 'string') lancer.option = null;
  }
  if (course.etape && course.etape.genre !== 'lancer' && course.etape.genre !== 'roue') {
    course.etape = { genre: 'lancer' };
  }
  const phase = course.phase as string;
  if (phase === 'mises' || phase === 'revelation') {
    course.phase = course.tour > 0 ? 'choixMiniJeu' : 'preparation';
  }
  if (!Array.isArray(course.ordre) || course.ordre.length === 0) {
    course.ordre = Object.keys(course.positions);
  }
  if (typeof course.miniJeuId !== 'string') course.miniJeuId = null;
  if (!Array.isArray(course.joues)) course.joues = [];
  if (typeof course.grilleVisible !== 'boolean') course.grilleVisible = false;
  if (typeof course.ecranMini !== 'string') course.ecranMini = null;
  if (typeof course.resultatsSaisis !== 'boolean') course.resultatsSaisis = false;
  if (typeof course.dernierTour !== 'boolean') course.dernierTour = false;
  if (
    !course.ceremonie ||
    (course.ceremonie.etape !== 'podium' &&
      course.ceremonie.etape !== 'cagnotte' &&
      course.ceremonie.etape !== 'trophees' &&
      course.ceremonie.etape !== 'classement' &&
      course.ceremonie.etape !== 'gagnant') ||
    !Array.isArray(course.ceremonie.tirage) ||
    typeof course.ceremonie.reveles !== 'number'
  ) {
    course.ceremonie = null;
  } else if (
    !course.ceremonie.cagnotteEnAttente ||
    typeof course.ceremonie.cagnotteEnAttente.joueurId !== 'string' ||
    typeof course.ceremonie.cagnotteEnAttente.montant !== 'number'
  ) {
    course.ceremonie.cagnotteEnAttente = null;
  }
  if (!course.minuteur ||
    (course.minuteur.etat !== 'arrete' && course.minuteur.etat !== 'enCours' && course.minuteur.etat !== 'enPause')
  ) {
    course.minuteur = { etat: 'arrete', finA: null, resteMs: 0, libelle: '' };
  }
  if (!course.poker || typeof course.poker.actif !== 'boolean' || typeof course.poker.niveau !== 'number') {
    course.poker = { actif: false, niveau: 0 };
  }
  if (!Array.isArray(course.motsSoiree)) {
    const legacy =
      course.codenames && Array.isArray(course.codenames.motsJoues) ? course.codenames.motsJoues : [];
    course.motsSoiree = [...legacy];
  }
  const topten = course.topten;
  if (
    !topten ||
    !Array.isArray(topten.captens) ||
    !Array.isArray(topten.manches) ||
    !Array.isArray(topten.themesJoues) ||
    typeof topten.recap !== 'boolean'
  ) {
    course.topten = null;
  }
  const jeopardy = course.jeopardy;
  if (
    !jeopardy ||
    !Array.isArray(jeopardy.jouees) ||
    !estObjet(jeopardy.gains) ||
    typeof jeopardy.termine !== 'boolean' ||
    (jeopardy.question !== null && (!estObjet(jeopardy.question) || !Array.isArray(jeopardy.question.elimines)))
  ) {
    course.jeopardy = null;
  }
  const undercover = course.undercover;
  if (
    !undercover ||
    typeof undercover.nbManches !== 'number' ||
    !Array.isArray(undercover.manches) ||
    !Array.isArray(undercover.pairesJouees) ||
    typeof undercover.recap !== 'boolean'
  ) {
    course.undercover = null;
  }
  const justone = course.justone;
  if (
    !justone ||
    typeof justone.cycles !== 'number' ||
    typeof justone.hoteDevine !== 'boolean' ||
    !Array.isArray(justone.ordreDevineurs) ||
    typeof justone.indexDevineur !== 'number' ||
    !Array.isArray(justone.manches) ||
    typeof justone.recap !== 'boolean' ||
    !estObjet(justone.gains)
  ) {
    course.justone = null;
  }
  const choix = course.regles.choixMiniJeu as string;
  if (choix === 'premier' || choix !== 'dernierAuClassement') course.regles.choixMiniJeu = 'rotation';
  if (choix === 'dernier') course.regles.choixMiniJeu = 'dernierAuClassement';
  return course;
}

export function fusionnerEtat(titre: string, brut: Record<string, unknown>, sousTitre = ''): EtatJeu {
  const defaut = etatInitial(titre, sousTitre);
  if (!estObjet(brut.partie) || !Array.isArray(brut.joueurs) || !Array.isArray(brut.transactions)) {
    throw new Error('forme inattendue');
  }
  const partieBrute = brut.partie;
  const etat: EtatJeu = {
    ...defaut,
    ...brut,
    schema: typeof brut.schema === 'number' ? brut.schema : SCHEMA,
    version: typeof brut.version === 'number' ? brut.version : 0,
    partie: {
      ...defaut.partie,
      ...partieBrute,
      titre: typeof partieBrute.titre === 'string' ? partieBrute.titre : defaut.partie.titre,
      sousTitre: typeof partieBrute.sousTitre === 'string' ? partieBrute.sousTitre : defaut.partie.sousTitre,
      inscriptionsVerrouillees: partieBrute.inscriptionsVerrouillees === true,
      ecranTv:
        partieBrute.ecranTv === 'scores' ||
        partieBrute.ecranTv === 'plateau' ||
        partieBrute.ecranTv === 'presentation'
          ? partieBrute.ecranTv
          : 'accueil',
      presentationId:
        typeof partieBrute.presentationId === 'number' ? Math.max(0, Math.floor(partieBrute.presentationId)) : 0,
      animationsReduites: partieBrute.animationsReduites === true,
      diagnosticTvAffiche: partieBrute.diagnosticTvAffiche === true,
    },
    joueurs: brut.joueurs as EtatJeu['joueurs'],
    transactions: (Array.isArray(brut.transactions) ? brut.transactions : []) as EtatJeu['transactions'],
    evenements: (Array.isArray(brut.evenements) ? brut.evenements : []) as EtatJeu['evenements'],
    demandesReprise: (Array.isArray(brut.demandesReprise) ? brut.demandesReprise : []) as EtatJeu['demandesReprise'],
    course: normaliserCourse(brut.course),
    bots: brut.bots === true,
  };
  for (const cle of Object.keys(brut)) {
    if (!(cle in etat)) {
      (etat as Record<string, unknown>)[cle] = brut[cle];
    }
  }
  return etat;
}

export function lireDonnees(texte: string, titre: string, sousTitre = ''): DonneesPersistees {
  const brut: unknown = JSON.parse(texte);
  if (!estObjet(brut)) throw new Error('JSON invalide');
  const enveloppe = estObjet(brut.etat);
  const etatBrut = enveloppe ? (brut.etat as Record<string, unknown>) : brut;
  const etat = fusionnerEtat(titre, etatBrut, sousTitre);
  const jetons: Record<string, string> = {};
  if (enveloppe && estObjet(brut.jetons)) {
    for (const [joueurId, jeton] of Object.entries(brut.jetons)) {
      if (typeof jeton === 'string') jetons[joueurId] = jeton;
    }
  }
  const ids = etat.evenements.map((evenement) => evenement.id).filter((id) => typeof id === 'number');
  const plusGrand = ids.length > 0 ? Math.max(...ids) + 1 : 1;
  const annonce = enveloppe && typeof brut.prochainIdEvenement === 'number' ? brut.prochainIdEvenement : 1;
  return {
    etat,
    jetons,
    prochainIdEvenement: Math.max(annonce, plusGrand, 1),
  };
}

export function donneesInitiales(titre: string, sousTitre = ''): DonneesPersistees {
  return { etat: etatInitial(titre, sousTitre), jetons: {}, prochainIdEvenement: 1 };
}

export function configValide(brut: unknown): ConfigPartie {
  if (!estObjet(brut)) throw new Error('config/partie.json est illisible');
  if (typeof brut.titre !== 'string' || !brut.titre.trim()) throw new Error('Le titre manque dans config/partie.json');
  if (typeof brut.codeHote !== 'string' || !brut.codeHote) throw new Error('Le code hôte manque dans config/partie.json');
  if (typeof brut.nbJoueursMax !== 'number' || brut.nbJoueursMax < 1) {
    throw new Error('nbJoueursMax est invalide dans config/partie.json');
  }
  if (typeof brut.port !== 'number' || brut.port < 1) throw new Error('Le port est invalide dans config/partie.json');
  if (brut.ipForcee !== null && typeof brut.ipForcee !== 'string') {
    throw new Error('ipForcee doit être une adresse ou null');
  }
  if (typeof brut.nomHote !== 'string' || !brut.nomHote.trim() || brut.nomHote.trim().length > 20) {
    throw new Error('nomHote doit être un nom de 1 à 20 caractères dans config/partie.json');
  }
  return {
    titre: brut.titre.trim(),
    sousTitre: typeof brut.sousTitre === 'string' ? brut.sousTitre.trim() : '',
    nbJoueursMax: brut.nbJoueursMax,
    codeHote: brut.codeHote,
    port: brut.port,
    ipForcee: typeof brut.ipForcee === 'string' && brut.ipForcee.trim() ? brut.ipForcee.trim() : null,
    nomHote: brut.nomHote.trim(),
  };
}
