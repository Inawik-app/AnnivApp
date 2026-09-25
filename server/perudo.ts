import { gainsClassement } from '../shared/mini-jeux';
import {
  annonceLegale,
  classementPerudo,
  compterDes,
  gainDe,
  perteDe,
  premierSuivant,
  type ConfigPerudo,
} from '../shared/perudo';
import type { Action, AnnoncePerudoEtat, EtatJeu, JoueurPerudo, Origine, PerudoCourse, Visibilite } from '../shared/types';
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

export const ACTIONS_PERUDO = new Set<Action['type']>([
  'lancerDesPerudo',
  'annoncerPerudo',
  'dudoPerudo',
  'calzaPerudo',
  'mancheSuivantePerudo',
]);

function pseudo(etat: EtatJeu, joueurId: string): string {
  return trouverJoueur(etat.joueurs, joueurId)?.pseudo ?? 'Un joueur';
}

function enJeu(jeu: PerudoCourse): JoueurPerudo[] {
  return jeu.joueurs.filter((joueur) => joueur.desRestants > 0);
}

function courant(jeu: PerudoCourse): JoueurPerudo | null {
  return jeu.joueurs[jeu.indexCourant] ?? null;
}

function indexDe(jeu: PerudoCourse, joueurId: string): number {
  return jeu.joueurs.findIndex((joueur) => joueur.id === joueurId);
}

function suivant(jeu: PerudoCourse, depuis: number): number {
  for (let pas = 1; pas <= jeu.joueurs.length; pas += 1) {
    const index = (depuis + pas) % jeu.joueurs.length;
    if ((jeu.joueurs[index]?.desRestants ?? 0) > 0) return index;
  }
  return depuis;
}

function joueurAutorise(origine: Origine, joueurId: string): boolean {
  return origine.role === 'hote' || (origine.role === 'joueur' && origine.joueurId === joueurId);
}

function lancerFaces(nombre: number, alea: (max: number) => number): number[] {
  return Array.from({ length: nombre }, () => 1 + alea(6));
}

export function perudoInitial(ordre: readonly string[], config: ConfigPerudo, alea: (max: number) => number): PerudoCourse {
  const premierId = ordre[alea(Math.max(1, ordre.length))] ?? ordre[0] ?? '';
  return {
    desParJoueur: config.desParJoueur,
    calzaAutorise: config.calza,
    numeroManche: 1,
    joueurs: ordre.map((id) => ({ id, desRestants: config.desParJoueur, faces: [], aLance: false })),
    indexCourant: Math.max(0, ordre.indexOf(premierId)),
    etape: 'lancers',
    annonce: null,
    historique: [],
    revelation: null,
    elimines: [],
    premierId,
    gains: {},
  };
}

function libelleFace(valeur: number): string {
  return valeur === 1 ? 'Paco' : String(valeur);
}

function libelleVerdict(
  compte: number,
  nombre: number,
  nom: string,
  delta: number,
  genre: 'dudo' | 'calza',
): string {
  const base = `Il y en a ${compte} pour ${nombre} annoncés`;
  if (genre === 'calza' && delta > 0) return `${base} : ${nom} regagne un dé`;
  if (genre === 'calza' && delta === 0) return `${base} : ${nom} a déjà tous ses dés`;
  return `${base} : ${nom} perd un dé`;
}

export function refuserPerudo(etat: EtatJeu, action: Action, origine: Origine): string | null {
  const course = etat.course;
  const jeu = course?.perudo;
  if (!course || course.phase !== 'miniJeu' || course.ecranMini !== 'perudo' || !jeu) return "Le Perudo n'est pas en cours";
  if (jeu.etape === 'terminee') return 'Le Perudo est terminé';
  const hote = origine.role === 'hote';
  switch (action.type) {
    case 'lancerDesPerudo': {
      if (jeu.etape !== 'lancers') return "Ce n'est pas le moment de lancer";
      const id = hote ? action.joueurId : origine.role === 'joueur' ? origine.joueurId : null;
      if (!id) return 'Choisis qui lance';
      const joueur = jeu.joueurs.find((candidat) => candidat.id === id);
      if (!joueur || joueur.desRestants <= 0) return "Ce joueur n'a plus de dé";
      if (joueur.aLance) return 'Ces dés sont déjà lancés';
      return null;
    }
    case 'annoncerPerudo': {
      if (jeu.etape !== 'encheres') return "Ce n'est pas le moment d'annoncer";
      const joueur = courant(jeu);
      if (!joueur || !joueurAutorise(origine, joueur.id)) return "Ce n'est pas ton tour";
      if (!annonceLegale(jeu.annonce, { nombre: action.nombre, valeur: action.valeur })) return 'Cette annonce est illégale';
      return null;
    }
    case 'dudoPerudo':
    case 'calzaPerudo': {
      if (jeu.etape !== 'encheres' || !jeu.annonce) return 'Personne n\'a encore annoncé';
      if (action.type === 'calzaPerudo' && !jeu.calzaAutorise) return "Calza n'est pas joué";
      const joueur = courant(jeu);
      if (!joueur || !joueurAutorise(origine, joueur.id)) return "Ce n'est pas ton tour";
      if (joueur.id === jeu.annonce.joueurId) return "Tu ne peux pas contester ta propre annonce";
      return null;
    }
    case 'mancheSuivantePerudo':
      if (!hote) return "Seul l'hôte lance la manche suivante";
      if (jeu.etape !== 'revelation') return "La manche n'est pas à relancer";
      return null;
    default:
      return null;
  }
}

function resoudre(
  draft: EtatJeu,
  ctx: ContexteCourse,
  ajouter: Ajouter,
  jeu: PerudoCourse,
  genre: 'dudo' | 'calza',
  acteurId: string,
): void {
  const annonce = jeu.annonce;
  if (!annonce) return;
  const faces: Record<string, number[]> = {};
  for (const joueur of jeu.joueurs) {
    if (joueur.desRestants > 0) faces[joueur.id] = [...joueur.faces];
  }
  const compte = compterDes(Object.values(faces), annonce.valeur);
  let concerneId = acteurId;
  let delta: -1 | 0 | 1 = -1;
  if (genre === 'dudo') {
    const tient = compte >= annonce.nombre;
    concerneId = tient ? acteurId : annonce.joueurId;
    const joueur = jeu.joueurs.find((candidat) => candidat.id === concerneId);
    if (joueur) joueur.desRestants = perteDe(joueur.desRestants);
    delta = -1;
  } else {
    const exact = compte === annonce.nombre;
    concerneId = acteurId;
    const joueur = jeu.joueurs.find((candidat) => candidat.id === concerneId);
    if (joueur && exact) {
      const gain = gainDe(joueur.desRestants, jeu.desParJoueur);
      joueur.desRestants = gain.des;
      delta = gain.delta;
    } else if (joueur) {
      joueur.desRestants = perteDe(joueur.desRestants);
      delta = -1;
    }
  }
  const concerne = jeu.joueurs.find((candidat) => candidat.id === concerneId);
  if (concerne && concerne.desRestants === 0 && !jeu.elimines.includes(concerneId)) jeu.elimines.push(concerneId);
  const des: Record<string, number> = {};
  for (const joueur of jeu.joueurs) des[joueur.id] = joueur.desRestants;
  const calzaReussie = genre === 'calza' && compte === annonce.nombre;
  jeu.premierId = premierSuivant(
    jeu.joueurs.map((joueur) => joueur.id),
    des,
    concerneId,
    calzaReussie,
  );
  const nom = pseudo(draft, concerneId);
  const libelle = libelleVerdict(compte, annonce.nombre, nom, delta, genre);
  jeu.revelation = { faces, annonce: { ...annonce }, compte, genre, concerneId, delta, libelle };
  jeu.etape = 'revelation';
  ajouter(draft, 'perudo.revelation', 'public', libelle, {
    compte,
    nombre: annonce.nombre,
    valeur: annonce.valeur,
    genre,
    concerneId,
    delta,
  });
  const vivants = enJeu(jeu);
  if (vivants.length > 1) return;
  jeu.etape = 'terminee';
  const survivant = vivants[0]?.id ?? null;
  const ordre = classementPerudo(survivant, jeu.elimines);
  const lignes = gainsClassement(
    ordre.map((joueurId) => ({ joueurId, exAequo: false })),
    ctx.catalogue.baremes.classement,
  );
  const gains: Record<string, number> = {};
  for (const ligne of lignes) gains[ligne.joueurId] = ligne.montant;
  jeu.gains = gains;
  for (const ligne of lignes) crediter(draft, ctx, ajouter, ligne.joueurId, ligne.montant, 'Perudo', 'mini-jeu');
}

export function appliquerPerudo(draft: EtatJeu, action: Action, origine: Origine, ctx: ContexteCourse, ajouter: Ajouter): void {
  const course = draft.course;
  const jeu = course?.perudo;
  if (!course || !jeu) return;
  switch (action.type) {
    case 'lancerDesPerudo': {
      const id = origine.role === 'hote' ? action.joueurId : origine.role === 'joueur' ? origine.joueurId : null;
      const joueur = jeu.joueurs.find((candidat) => candidat.id === id);
      if (!joueur) return;
      joueur.faces = lancerFaces(joueur.desRestants, ctx.alea);
      joueur.aLance = true;
      ajouter(draft, 'perudo.lancer', { joueurId: joueur.id }, `${pseudo(draft, joueur.id)} lance ses dés`, {
        joueurId: joueur.id,
        faces: [...joueur.faces],
      });
      if (jeu.joueurs.some((candidat) => candidat.desRestants > 0 && !candidat.aLance)) {
        ajouter(draft, 'perudo.secret', 'public', `${pseudo(draft, joueur.id)} a lancé`, { joueurId: joueur.id });
        return;
      }
      const index = indexDe(jeu, jeu.premierId);
      jeu.indexCourant = index >= 0 ? index : suivant(jeu, -1);
      jeu.etape = 'encheres';
      const ouvreur = courant(jeu);
      ajouter(draft, 'perudo.encheres', 'public', ouvreur ? `${pseudo(draft, ouvreur.id)} ouvre les annonces` : 'Les annonces commencent', {
        joueurId: ouvreur?.id ?? null,
      });
      return;
    }
    case 'annoncerPerudo': {
      const joueur = courant(jeu);
      if (!joueur) return;
      const annonce: AnnoncePerudoEtat = { joueurId: joueur.id, nombre: action.nombre, valeur: action.valeur };
      jeu.annonce = annonce;
      jeu.historique.push(annonce);
      jeu.indexCourant = suivant(jeu, jeu.indexCourant);
      const face = libelleFace(action.valeur);
      ajouter(draft, 'perudo.annonce', 'public', `${pseudo(draft, joueur.id)} annonce ${action.nombre} × ${face}`, {
        joueurId: joueur.id,
        nombre: action.nombre,
        valeur: action.valeur,
      });
      return;
    }
    case 'dudoPerudo':
    case 'calzaPerudo': {
      const joueur = courant(jeu);
      if (!joueur) return;
      resoudre(draft, ctx, ajouter, jeu, action.type === 'dudoPerudo' ? 'dudo' : 'calza', joueur.id);
      return;
    }
    case 'mancheSuivantePerudo': {
      jeu.numeroManche += 1;
      jeu.etape = 'lancers';
      jeu.annonce = null;
      jeu.historique = [];
      jeu.revelation = null;
      for (const joueur of jeu.joueurs) {
        joueur.faces = [];
        joueur.aLance = joueur.desRestants <= 0;
      }
      const index = indexDe(jeu, jeu.premierId);
      jeu.indexCourant = index >= 0 ? index : 0;
      ajouter(draft, 'perudo.manche', 'public', `Manche ${jeu.numeroManche}`, { numero: jeu.numeroManche, premierId: jeu.premierId });
      return;
    }
    default:
      return;
  }
}
