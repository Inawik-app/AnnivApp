import type {
  Action,
  CodenamesCourse,
  EtatJeu,
  IndiceCodenames,
  MancheCodenames,
  Origine,
  PreparationCodenames,
  Visibilite,
} from '../shared/types';
import {
  autreEquipe,
  compositionCle,
  essaisPour,
  indiceValide,
  libelleEquipe,
  libelleNombre,
  nombreIndiceValide,
  plier,
  type ConfigCodenames,
  type CouleurCarte,
  type EquipeCodenames,
} from '../shared/codenames';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ContexteCourse } from './course';
import { trouverJoueur } from './libelles';
import { crediter } from './mini-jeux';
import { lireCodenames } from './mini-jeux-config';
import { melanger } from './plateau';

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

type Ajouter = (
  draft: EtatJeu,
  type: string,
  visibilite: Visibilite,
  libelle: string,
  donnees?: Record<string, unknown>,
) => void;

export const ACTIONS_CODENAMES = new Set<Action['type']>([
  'affecterCodenames',
  'equipesHasardCodenames',
  'designerEspionCodenames',
  'lancerGrilleCodenames',
  'proposerIndiceCodenames',
  'validerIndiceCodenames',
  'refuserIndiceCodenames',
  'retournerMotCodenames',
  'finirTourCodenames',
]);

const TAILLE = 25;

function pseudo(etat: EtatJeu, joueurId: string): string {
  return trouverJoueur(etat.joueurs, joueurId)?.pseudo ?? 'Un joueur';
}

export function preparationVide(): PreparationCodenames {
  return { equipes: { rouge: [], bleu: [] }, espions: { rouge: null, bleu: null } };
}

export function codenamesInitial(nbManches: number, motsJoues: string[]): CodenamesCourse {
  return { nbManches, motsJoues: [...motsJoues], preparation: preparationVide(), manches: [] };
}

function configDe(ctx: ContexteCourse): ConfigCodenames {
  return ctx.codenames ?? lireCodenames(RACINE);
}

export function mancheCodenames(course: { codenames?: CodenamesCourse | null }): MancheCodenames | null {
  const manches = course.codenames?.manches ?? [];
  return manches[manches.length - 1] ?? null;
}

function enPreparation(jeu: CodenamesCourse): boolean {
  const manche = jeu.manches[jeu.manches.length - 1];
  return !manche || manche.etape === 'finie';
}

function agentDe(manche: MancheCodenames, equipe: EquipeCodenames): string | null {
  return manche.equipes[equipe].find((id) => id !== manche.espions[equipe]) ?? null;
}

function motsCaches(manche: MancheCodenames): string[] {
  return manche.cartes.filter((carte) => !carte.revelee).map((carte) => carte.mot);
}

function restants(manche: MancheCodenames, equipe: EquipeCodenames): number {
  return manche.cartes.filter((carte) => carte.couleur === equipe && !carte.revelee).length;
}

function joueurAutorise(origine: Origine, joueurId: string): boolean {
  return origine.role === 'hote' || (origine.role === 'joueur' && origine.joueurId === joueurId);
}

function equipesCompletes(preparation: PreparationCodenames): boolean {
  return preparation.equipes.rouge.length === 2 && preparation.equipes.bleu.length === 2;
}

export function refuserCodenames(etat: EtatJeu, action: Action, origine: Origine, ctx: ContexteCourse): string | null {
  const course = etat.course;
  const jeu = course?.codenames;
  if (!course || course.phase !== 'miniJeu' || course.ecranMini !== 'codenames' || !jeu) return "Le Codenames n'est pas en cours";
  const manche = mancheCodenames(course);
  const hote = origine.role === 'hote';
  switch (action.type) {
    case 'affecterCodenames':
    case 'equipesHasardCodenames':
    case 'designerEspionCodenames':
      if (!hote) return "Seul l'hôte compose les équipes";
      if (jeu.manches.length > 0) return 'Les équipes sont déjà parties';
      if (action.type === 'affecterCodenames' && !trouverJoueur(etat.joueurs, action.joueurId)) {
        return "Ce joueur n'est plus dans la partie";
      }
      if (action.type === 'designerEspionCodenames') {
        if (!jeu.preparation.equipes[action.equipe].includes(action.joueurId)) return "Ce joueur n'est pas dans l'équipe";
      }
      if (action.type === 'equipesHasardCodenames' && course.ordre.length !== 4) return 'Codenames se joue à 4';
      return null;
    case 'lancerGrilleCodenames': {
      if (!hote) return "Seul l'hôte lance la grille";
      if (manche && manche.etape !== 'finie') return "La manche en cours n'est pas finie";
      if (jeu.manches.length >= jeu.nbManches) return 'Les deux manches sont jouées';
      if (jeu.manches.length === 0) {
        if (!equipesCompletes(jeu.preparation)) return 'Chaque équipe doit avoir 2 joueurs';
        if (!jeu.preparation.espions.rouge || !jeu.preparation.espions.bleu) return 'Chaque équipe doit avoir un espion';
      }
      const soiree = course.motsSoiree ?? jeu.motsJoues;
      const libres = configDe(ctx).mots.filter((mot) => !soiree.some((joue) => plier(joue) === plier(mot)));
      if (libres.length < TAILLE) return 'Il ne reste pas assez de mots pour une grille';
      return null;
    }
    case 'proposerIndiceCodenames': {
      if (!manche || manche.etape !== 'indice' || manche.indice || manche.indicePropose) return "Ce n'est pas le moment de l'indice";
      const espion = manche.espions[manche.equipeCourante];
      if (!joueurAutorise(origine, espion)) return "Ce n'est pas à toi de donner l'indice";
      if (!nombreIndiceValide(action.nombre)) return 'Le nombre doit aller de 0 à 9, ou être infini';
      return indiceValide(action.mot, motsCaches(manche));
    }
    case 'validerIndiceCodenames':
      if (!hote) return "Seul l'hôte valide l'indice";
      if (!manche || manche.etape !== 'indice' || !manche.indicePropose) return 'Aucun indice à valider';
      return null;
    case 'refuserIndiceCodenames':
      if (!hote) return "Seul l'hôte refuse l'indice";
      if (!manche) return 'Aucune manche en cours';
      if (manche.indicePropose) return null;
      if (manche.etape === 'choix' && manche.indice && manche.cartesTour === 0) return null;
      return 'Aucun indice à refuser';
    case 'retournerMotCodenames': {
      if (!manche || manche.etape !== 'choix') return "Ce n'est pas le moment de retourner une carte";
      const agent = agentDe(manche, manche.equipeCourante);
      if (!agent || !joueurAutorise(origine, agent)) return "Ce n'est pas à toi de choisir";
      const carte = manche.cartes[action.index];
      if (!carte) return "Cette carte n'existe pas";
      if (carte.revelee) return 'Cette carte est déjà retournée';
      return null;
    }
    case 'finirTourCodenames': {
      if (!manche || manche.etape !== 'choix') return "Ce n'est pas le moment de finir le tour";
      const agent = agentDe(manche, manche.equipeCourante);
      if (!agent || !joueurAutorise(origine, agent)) return "Ce n'est pas à toi de finir le tour";
      return null;
    }
    default:
      return null;
  }
}

function passerTour(manche: MancheCodenames): void {
  manche.equipeCourante = autreEquipe(manche.equipeCourante);
  manche.indice = null;
  manche.indicePropose = null;
  manche.essaisRestants = null;
  manche.cartesTour = 0;
  manche.etape = 'indice';
}

function cloturer(draft: EtatJeu, ctx: ContexteCourse, ajouter: Ajouter, manche: MancheCodenames, gagnant: EquipeCodenames): void {
  const config = configDe(ctx);
  manche.etape = 'finie';
  manche.gagnant = gagnant;
  manche.indicePropose = null;
  const perdant = autreEquipe(gagnant);
  const gains: Record<string, number> = {};
  for (const id of manche.equipes[gagnant]) gains[id] = config.gainGagnant;
  for (const id of manche.equipes[perdant]) gains[id] = config.gainPerdant;
  manche.gains = gains;
  ajouter(draft, 'codenames.fin', 'public', `L'équipe ${libelleEquipe(gagnant)} gagne la manche`, {
    gagnant,
    numero: manche.numero,
  });
  for (const [id, montant] of Object.entries(gains)) {
    crediter(draft, ctx, ajouter, id, montant, 'Codenames', 'mini-jeu');
  }
}

export function appliquerCodenames(draft: EtatJeu, action: Action, _origine: Origine, ctx: ContexteCourse, ajouter: Ajouter): void {
  const course = draft.course;
  const jeu = course?.codenames;
  if (!course || !jeu) return;
  switch (action.type) {
    case 'affecterCodenames': {
      const { rouge, bleu } = jeu.preparation.equipes;
      jeu.preparation.equipes.rouge = rouge.filter((id) => id !== action.joueurId);
      jeu.preparation.equipes.bleu = bleu.filter((id) => id !== action.joueurId);
      if (jeu.preparation.espions.rouge === action.joueurId) jeu.preparation.espions.rouge = null;
      if (jeu.preparation.espions.bleu === action.joueurId) jeu.preparation.espions.bleu = null;
      if (action.equipe) {
        const equipe = jeu.preparation.equipes[action.equipe];
        if (equipe.length >= 2) return;
        equipe.push(action.joueurId);
      }
      ajouter(draft, 'codenames.equipe', 'public', `${pseudo(draft, action.joueurId)} rejoint une équipe`, {
        joueurId: action.joueurId,
        equipe: action.equipe,
      });
      return;
    }
    case 'equipesHasardCodenames': {
      const melanges = melanger(course.ordre, ctx.alea);
      jeu.preparation = {
        equipes: { rouge: melanges.slice(0, 2), bleu: melanges.slice(2, 4) },
        espions: { rouge: null, bleu: null },
      };
      ajouter(draft, 'codenames.equipes', 'public', 'Les équipes sont tirées au hasard');
      return;
    }
    case 'designerEspionCodenames': {
      jeu.preparation.espions[action.equipe] = action.joueurId;
      ajouter(draft, 'codenames.espion', 'public', `${pseudo(draft, action.joueurId)} est l'espion ${libelleEquipe(action.equipe)}`, {
        joueurId: action.joueurId,
        equipe: action.equipe,
      });
      return;
    }
    case 'lancerGrilleCodenames': {
      const config = configDe(ctx);
      const precedente = mancheCodenames(course);
      const equipes = precedente
        ? { rouge: [...precedente.equipes.rouge], bleu: [...precedente.equipes.bleu] }
        : { rouge: [...jeu.preparation.equipes.rouge], bleu: [...jeu.preparation.equipes.bleu] };
      const espions = precedente
        ? {
            rouge: agentDe(precedente, 'rouge') ?? precedente.espions.rouge,
            bleu: agentDe(precedente, 'bleu') ?? precedente.espions.bleu,
          }
        : { rouge: jeu.preparation.espions.rouge ?? '', bleu: jeu.preparation.espions.bleu ?? '' };
      const soiree = course.motsSoiree ?? jeu.motsJoues;
      const libres = config.mots.filter((mot) => !soiree.some((joue) => plier(joue) === plier(mot)));
      const tires = melanger(libres, ctx.alea).slice(0, TAILLE);
      const equipeDebut: EquipeCodenames = ctx.alea(2) === 0 ? 'rouge' : 'bleu';
      const couleurs = melanger(compositionCle(equipeDebut, config.repartition), ctx.alea);
      const cartes = tires.map((mot, index) => ({
        mot,
        couleur: couleurs[index] ?? ('neutre' as CouleurCarte),
        revelee: false,
      }));
      jeu.motsJoues.push(...tires);
      course.motsSoiree = [...(course.motsSoiree ?? []), ...tires];
      const manche: MancheCodenames = {
        numero: jeu.manches.length + 1,
        cartes,
        equipeDebut,
        equipes,
        espions,
        etape: 'indice',
        equipeCourante: equipeDebut,
        indicePropose: null,
        indice: null,
        essaisRestants: null,
        cartesTour: 0,
        dernierRevele: null,
        gagnant: null,
        gains: {},
      };
      jeu.manches.push(manche);
      ajouter(draft, 'codenames.grille', 'public', `Manche ${manche.numero} : l'équipe ${libelleEquipe(equipeDebut)} commence`, {
        numero: manche.numero,
        equipeDebut,
      });
      return;
    }
    case 'proposerIndiceCodenames': {
      const manche = mancheCodenames(course);
      if (!manche) return;
      const mot = action.mot.trim();
      manche.indicePropose = { mot, nombre: action.nombre };
      ajouter(draft, 'codenames.proposition', { joueurId: manche.espions[manche.equipeCourante] }, `${pseudo(draft, manche.espions[manche.equipeCourante])} propose un indice`, {
        mot,
        nombre: action.nombre,
      });
      return;
    }
    case 'validerIndiceCodenames': {
      const manche = mancheCodenames(course);
      if (!manche || !manche.indicePropose) return;
      const indice: IndiceCodenames = { ...manche.indicePropose };
      manche.indice = indice;
      manche.indicePropose = null;
      manche.etape = 'choix';
      manche.essaisRestants = essaisPour(indice.nombre);
      manche.cartesTour = 0;
      ajouter(draft, 'codenames.indice', 'public', `Indice : ${indice.mot} ${libelleNombre(indice.nombre)}`, {
        mot: indice.mot,
        nombre: indice.nombre,
        equipe: manche.equipeCourante,
      });
      return;
    }
    case 'refuserIndiceCodenames': {
      const manche = mancheCodenames(course);
      if (!manche) return;
      manche.indicePropose = null;
      manche.indice = null;
      manche.essaisRestants = null;
      manche.etape = 'indice';
      ajouter(draft, 'codenames.refus', 'public', "L'hôte refuse l'indice");
      return;
    }
    case 'retournerMotCodenames': {
      const manche = mancheCodenames(course);
      const carte = manche?.cartes[action.index];
      if (!manche || !carte || carte.revelee) return;
      carte.revelee = true;
      manche.dernierRevele = action.index;
      manche.cartesTour += 1;
      ajouter(draft, 'codenames.carte', 'public', `${carte.mot} : ${carte.couleur === 'assassin' ? 'assassin' : carte.couleur}`, {
        index: action.index,
        couleur: carte.couleur,
      });
      if (carte.couleur === 'assassin') {
        cloturer(draft, ctx, ajouter, manche, autreEquipe(manche.equipeCourante));
        return;
      }
      const rouge = restants(manche, 'rouge');
      const bleu = restants(manche, 'bleu');
      if (rouge === 0 || bleu === 0) {
        cloturer(draft, ctx, ajouter, manche, rouge === 0 ? 'rouge' : 'bleu');
        return;
      }
      if (carte.couleur === manche.equipeCourante) {
        if (manche.essaisRestants !== null) {
          manche.essaisRestants -= 1;
          if (manche.essaisRestants <= 0) {
            const suivante = autreEquipe(manche.equipeCourante);
            passerTour(manche);
            ajouter(draft, 'codenames.tour', 'public', `Au tour de l'équipe ${libelleEquipe(suivante)}`, { equipe: suivante });
          }
        }
        return;
      }
      const suivante = autreEquipe(manche.equipeCourante);
      passerTour(manche);
      ajouter(draft, 'codenames.tour', 'public', `Au tour de l'équipe ${libelleEquipe(suivante)}`, { equipe: suivante });
      return;
    }
    case 'finirTourCodenames': {
      const manche = mancheCodenames(course);
      if (!manche) return;
      const suivante = autreEquipe(manche.equipeCourante);
      passerTour(manche);
      ajouter(draft, 'codenames.tour', 'public', `Au tour de l'équipe ${libelleEquipe(suivante)}`, { equipe: suivante });
      return;
    }
    default:
      return;
  }
}

export function oublierJoueurCodenames(course: { codenames?: CodenamesCourse | null }, joueurId: string): void {
  const jeu = course.codenames;
  if (!jeu || !enPreparation(jeu) || jeu.manches.length > 0) return;
  jeu.preparation.equipes.rouge = jeu.preparation.equipes.rouge.filter((id) => id !== joueurId);
  jeu.preparation.equipes.bleu = jeu.preparation.equipes.bleu.filter((id) => id !== joueurId);
  if (jeu.preparation.espions.rouge === joueurId) jeu.preparation.espions.rouge = null;
  if (jeu.preparation.espions.bleu === joueurId) jeu.preparation.espions.bleu = null;
}
