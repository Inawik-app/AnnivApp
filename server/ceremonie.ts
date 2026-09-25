import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { solde } from '../shared/soldes';
import { trophees, type TropheeConfig } from '../shared/trophees';
import type { Action, Ceremonie, EtatJeu, Origine, TropheeTire, Visibilite } from '../shared/types';
import { lireCatalogueTrophees } from './course-config';
import type { ContexteCourse } from './course';
import { crediter } from './mini-jeux';
import { melanger } from './plateau';

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

type Ajouter = (
  draft: EtatJeu,
  type: string,
  visibilite: Visibilite,
  libelle: string,
  donnees?: Record<string, unknown>,
) => void;

const ACTIONS = new Set<Action['type']>([
  'ouvrirPodium',
  'tirerTrophees',
  'revelerTrophee',
  'revelerClassement',
  'revelerGagnant',
]);

export function estActionCeremonie(type: Action['type']): boolean {
  return ACTIONS.has(type);
}

export function messageGainsMasques(nombre: number): string {
  if (nombre <= 1) return "1 gain masqué n'est pas révélé";
  return `${nombre} gains masqués ne sont pas révélés`;
}

function gainsMasques(etat: EtatJeu): number {
  return etat.transactions.filter((transaction) => transaction.masquee).length;
}

function catalogueActif(ctx: ContexteCourse): { nombre: number; trophees: TropheeConfig[] } {
  if (ctx.trophees) return { nombre: ctx.nombreCeremonie ?? 4, trophees: ctx.trophees };
  const lu = lireCatalogueTrophees(RACINE);
  return { nombre: ctx.nombreCeremonie ?? lu.nombreCeremonie, trophees: lu.trophees };
}

export function refuserCeremonie(etat: EtatJeu, action: Action, origine: Origine): string | null | undefined {
  if (!ACTIONS.has(action.type)) return undefined;
  if (origine.role !== 'hote') return "Seul l'hôte peut faire cette action";
  const course = etat.course;
  if (!course || !course.active || course.phase !== 'terminee') return "La course n'est pas terminée";
  const ceremonie = course.ceremonie;
  switch (action.type) {
    case 'ouvrirPodium': {
      if (ceremonie) return 'Le podium est déjà affiché';
      const masques = gainsMasques(etat);
      if (masques > 0 && action.forcer !== true) return messageGainsMasques(masques);
      return null;
    }
    case 'tirerTrophees':
      if (!ceremonie || ceremonie.etape !== 'podium') return "Affiche d'abord le podium";
      return null;
    case 'revelerTrophee':
      if (!ceremonie || ceremonie.etape !== 'trophees') return "Tire d'abord les trophées";
      if (ceremonie.reveles >= ceremonie.tirage.length) return 'Tous les trophées sont révélés';
      return null;
    case 'revelerClassement':
      if (!ceremonie || (ceremonie.etape !== 'trophees' && ceremonie.etape !== 'classement')) return "Termine d'abord les trophées";
      if (ceremonie.reveles < ceremonie.tirage.length) return 'Il reste des trophées à révéler';
      if (ceremonie.classementRevele) return 'Le classement est déjà révélé';
      return null;
    case 'revelerGagnant':
      if (!ceremonie || !ceremonie.classementRevele) return "Révèle d'abord le classement";
      if (ceremonie.gagnantRevele) return 'Le gagnant est déjà révélé';
      return null;
    default:
      return undefined;
  }
}

function copierTrophee(trophee: {
  id: string;
  nom: string;
  description: string;
  icone: string;
  montant: number;
  gagnants: string[];
  phrase: string;
}): TropheeTire {
  return {
    id: trophee.id,
    nom: trophee.nom,
    description: trophee.description,
    icone: trophee.icone,
    montant: trophee.montant,
    gagnants: [...trophee.gagnants],
    phrase: trophee.phrase,
  };
}

function lignesClassement(etat: EtatJeu): Array<{ joueurId: string; gp: number }> {
  const lignes = etat.joueurs.map((joueur) => ({
    joueurId: joueur.id,
    gp: solde(etat.transactions, joueur.id, 'visibles'),
    pseudo: joueur.pseudo,
  }));
  lignes.sort((a, b) => b.gp - a.gp || a.pseudo.localeCompare(b.pseudo, 'fr'));
  const meilleur = lignes[0]?.gp ?? 0;
  return lignes
    .filter((ligne) => ligne.gp < meilleur)
    .reverse()
    .map((ligne) => ({ joueurId: ligne.joueurId, gp: ligne.gp }));
}

function gagnantsFinaux(etat: EtatJeu): string[] {
  const lignes = etat.joueurs.map((joueur) => ({
    id: joueur.id,
    gp: solde(etat.transactions, joueur.id, 'visibles'),
  }));
  const meilleur = lignes.reduce((courant, ligne) => Math.max(courant, ligne.gp), 0);
  return lignes.filter((ligne) => ligne.gp === meilleur).map((ligne) => ligne.id);
}

export function appliquerCeremonie(draft: EtatJeu, action: Action, ctx: ContexteCourse, ajouter: Ajouter): boolean {
  if (!ACTIONS.has(action.type)) return false;
  const course = draft.course;
  if (!course) return true;
  switch (action.type) {
    case 'ouvrirPodium': {
      course.ceremonie = {
        masqueesIgnorees: gainsMasques(draft) > 0,
        etape: 'podium',
        tirage: [],
        reveles: 0,
        classementRevele: false,
        gagnantRevele: false,
      };
      ajouter(draft, 'ceremonie.podium', 'public', 'Podium de la course', {
        ordre: [...(course.classement ?? [])],
      });
      return true;
    }
    case 'tirerTrophees': {
      const ceremonie = course.ceremonie;
      if (!ceremonie) return true;
      const catalogue = catalogueActif(ctx);
      const attribuables = trophees(draft, catalogue.trophees).filter((trophee) => trophee.attribuable);
      const choisis = melanger(attribuables, ctx.alea).slice(0, Math.min(catalogue.nombre, attribuables.length));
      ceremonie.tirage = choisis.map((trophee) => copierTrophee(trophee));
      ceremonie.reveles = 0;
      ceremonie.etape = 'trophees';
      ajouter(draft, 'ceremonie.tirage', 'hote', 'Les trophées de la cérémonie sont tirés', {
        nombre: ceremonie.tirage.length,
      });
      return true;
    }
    case 'revelerTrophee': {
      const ceremonie = course.ceremonie;
      if (!ceremonie) return true;
      const trophee = ceremonie.tirage[ceremonie.reveles];
      if (!trophee) return true;
      ceremonie.reveles += 1;
      ajouter(draft, 'trophee.revele', 'public', `${trophee.nom} — ${trophee.phrase}`, {
        id: trophee.id,
        nom: trophee.nom,
        description: trophee.description,
        icone: trophee.icone,
        montant: trophee.montant,
        gagnants: [...trophee.gagnants],
        phrase: trophee.phrase,
      });
      for (const joueurId of trophee.gagnants) {
        crediter(draft, ctx, ajouter, joueurId, trophee.montant, `Trophée : ${trophee.nom}`, 'trophee');
      }
      return true;
    }
    case 'revelerClassement': {
      const ceremonie = course.ceremonie;
      if (!ceremonie) return true;
      ceremonie.classementRevele = true;
      ceremonie.etape = 'classement';
      ajouter(draft, 'classement.revele', 'public', 'Classement final', { lignes: lignesClassement(draft) });
      return true;
    }
    case 'revelerGagnant': {
      const ceremonie = course.ceremonie;
      if (!ceremonie) return true;
      ceremonie.gagnantRevele = true;
      ceremonie.etape = 'gagnant';
      const ids = gagnantsFinaux(draft);
      const texte = ids.length > 1 ? 'remportent le bon de 20 €' : 'remporte le bon de 20 €';
      ajouter(draft, 'gagnant.revele', 'public', texte, { gagnants: ids, texte });
      return true;
    }
    default:
      return false;
  }
}

export function projeterTirage(ceremonie: Ceremonie, cible: 'tv' | 'joueur' | 'hote'): {
  reveles: TropheeTire[];
  suivants: TropheeTire[];
} {
  const reveles = ceremonie.tirage.slice(0, ceremonie.reveles).map((trophee) => copierTrophee(trophee));
  const suivants = cible === 'hote' ? ceremonie.tirage.slice(ceremonie.reveles).map((trophee) => copierTrophee(trophee)) : [];
  return { reveles, suivants };
}
