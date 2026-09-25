import fs from 'node:fs';
import path from 'node:path';
import type { ConfigRoue, OptionRoue } from '../shared/roue';
import { lireTrophees, type CatalogueTrophees } from '../shared/trophees';
import type { CarteChance, ConfigPlateau, EffetCarte, FamilleCarte, OptionDe, TypeCase } from '../shared/types';
import { dispositionValide } from './plateau';

function estObjet(valeur: unknown): valeur is Record<string, unknown> {
  return !!valeur && typeof valeur === 'object' && !Array.isArray(valeur);
}

const TYPES_CASES: TypeCase[] = ['depart', 'bonus', 'chance', 'malchance', 'cagnotte', 'gamble', 'arrivee'];
const TYPES = new Set<TypeCase>(TYPES_CASES);

function lireIcone(entree: Record<string, unknown>, fichier: string, id: string): string {
  if (typeof entree.icone !== 'string' || entree.icone.trim() === '') {
    throw new Error(`config/${fichier} : ${id} : icône manquante`);
  }
  return entree.icone.trim();
}

function entierPositif(valeur: unknown): valeur is number {
  return typeof valeur === 'number' && Number.isInteger(valeur) && valeur > 0;
}

function lireEffet(brut: unknown): EffetCarte | null {
  if (!estObjet(brut) || typeof brut.type !== 'string') return null;
  if (brut.type === 'gain' || brut.type === 'perte' || brut.type === 'cotisation' || brut.type === 'tournee') {
    if (!entierPositif(brut.montant)) return null;
    return { type: brut.type, montant: brut.montant };
  }
  if (brut.type === 'avancer' || brut.type === 'reculer') {
    if (!entierPositif(brut.cases)) return null;
    return { type: brut.type, cases: brut.cases };
  }
  if (brut.type === 'cagnotte') {
    if (brut.sens !== 'avant' && brut.sens !== 'arriere') return null;
    if (typeof brut.part !== 'number' || brut.part < 0 || brut.part > 1) return null;
    return { type: 'cagnotte', sens: brut.sens, part: brut.part };
  }
  if (brut.type === 'gainDe' || brut.type === 'neutre') return { type: brut.type };
  return null;
}

function lirePaquet(racine: string, fichier: string, famille: FamilleCarte): CarteChance[] {
  const brut: unknown = JSON.parse(fs.readFileSync(path.join(racine, 'config', fichier), 'utf8'));
  if (!Array.isArray(brut) || brut.length === 0) throw new Error(`config/${fichier} est vide`);
  const vues = new Set<string>();
  return brut.map((entree) => {
    if (!estObjet(entree) || typeof entree.id !== 'string' || typeof entree.titre !== 'string' || typeof entree.texte !== 'string') {
      throw new Error(`Carte illisible dans ${fichier}`);
    }
    if (!entierPositif(entree.poids)) throw new Error(`Poids invalide pour ${entree.id}`);
    const effet = lireEffet(entree.effet);
    if (!effet) throw new Error(`Effet invalide pour la carte ${entree.id}`);
    if (vues.has(entree.id)) throw new Error(`Carte en double : ${entree.id}`);
    vues.add(entree.id);
    return {
      id: entree.id,
      titre: entree.titre.trim(),
      texte: entree.texte.trim(),
      icone: lireIcone(entree, fichier, entree.id),
      famille,
      poids: entree.poids,
      effet,
    };
  });
}

function lireOptions(brut: unknown): OptionDe[] {
  if (!Array.isArray(brut) || brut.length === 0) throw new Error('optionsDe est vide');
  const vues = new Set<string>();
  return brut.map((entree) => {
    if (!estObjet(entree) || typeof entree.id !== 'string' || typeof entree.nom !== 'string') {
      throw new Error('Option de dé illisible');
    }
    if (!entierPositif(entree.faces) || entree.faces > 12) throw new Error(`Faces invalides pour ${entree.id}`);
    if (typeof entree.mise !== 'number' || !Number.isInteger(entree.mise) || entree.mise < 0) {
      throw new Error(`Mise invalide pour ${entree.id}`);
    }
    if (vues.has(entree.id)) throw new Error(`Dé en double : ${entree.id}`);
    vues.add(entree.id);
    return { id: entree.id, nom: entree.nom.trim(), faces: entree.faces, mise: entree.mise, icone: lireIcone(entree, 'plateau.json', entree.id) };
  });
}

export function lireConfigPlateau(racine: string): ConfigPlateau {
  const brut: unknown = JSON.parse(fs.readFileSync(path.join(racine, 'config', 'plateau.json'), 'utf8'));
  if (!estObjet(brut) || !estObjet(brut.repartition)) throw new Error('config/plateau.json est illisible');
  const longueur = brut.longueur;
  const gainBonus = brut.gainBonus;
  const choix = brut.choixMiniJeu;
  const repartition = brut.repartition;
  if (typeof longueur !== 'number' || longueur < 4) throw new Error('longueur du plateau invalide');
  if (typeof gainBonus !== 'number' || gainBonus < 0) throw new Error('gainBonus invalide');
  if (choix !== 'rotation' && choix !== 'dernierAuClassement') throw new Error('choixMiniJeu invalide');
  const nombres = ['bonus', 'chance', 'malchance', 'cagnotte', 'gamble'] as const;
  const compte = { bonus: 0, chance: 0, malchance: 0, cagnotte: 0, gamble: 0 };
  for (const cle of nombres) {
    const valeur = repartition[cle];
    if (typeof valeur !== 'number' || valeur < 0 || !Number.isInteger(valeur)) {
      throw new Error(`repartition.${cle} invalide`);
    }
    compte[cle] = valeur;
  }
  if (compte.bonus + compte.chance + compte.malchance + compte.cagnotte + compte.gamble !== longueur - 1) {
    throw new Error('La répartition ne couvre pas les cases 1 à l’avant-dernière');
  }
  const optionsDe = lireOptions(brut.optionsDe);
  const iconesCases = lireIconesCases(brut.iconesCases);
  let disposition: TypeCase[] | undefined;
  if (brut.disposition !== undefined) {
    if (!Array.isArray(brut.disposition)) throw new Error('disposition invalide');
    disposition = brut.disposition.map((type) => {
      if (typeof type !== 'string' || !TYPES.has(type as TypeCase)) throw new Error('disposition invalide');
      return type as TypeCase;
    });
    const erreur = dispositionValide(disposition, longueur);
    if (erreur) throw new Error(erreur);
  }
  const recompenseArrivee = lireRecompenseArrivee(brut.recompenseArrivee);
  const coupDePouce = lireCoupDePouce(brut.coupDePouce);
  return {
    longueur,
    repartition: compte,
    gainBonus,
    choixMiniJeu: choix,
    optionsDe,
    iconesCases,
    recompenseArrivee,
    coupDePouce,
    ...(disposition ? { disposition } : {}),
  };
}

function lireRecompenseArrivee(brut: unknown): number[] {
  if (brut === undefined) return [0, 0, 0, 0];
  if (!Array.isArray(brut) || brut.length !== 4) {
    throw new Error('recompenseArrivee doit être une liste de 4 montants');
  }
  return brut.map((montant, index) => {
    if (typeof montant !== 'number' || !Number.isInteger(montant) || montant < 0) {
      throw new Error(`recompenseArrivee[${index}] invalide`);
    }
    return montant;
  });
}

function lireCoupDePouce(brut: unknown): 'aucun' | 'de7' | 'de8' {
  if (brut === undefined) return 'aucun';
  if (brut === 'aucun' || brut === 'de7' || brut === 'de8') return brut;
  throw new Error('coupDePouce doit être « aucun », « de7 » ou « de8 »');
}

function lireIconesCases(brut: unknown): Record<TypeCase, string> {
  if (!estObjet(brut)) throw new Error('config/plateau.json : iconesCases est illisible');
  const resultat = {} as Record<TypeCase, string>;
  for (const type of TYPES_CASES) {
    const entree = brut[type];
    if (!estObjet(entree)) throw new Error(`config/plateau.json : ${type} : icône manquante`);
    resultat[type] = lireIcone(entree, 'plateau.json', type);
  }
  return resultat;
}

export function lireCartesChance(racine: string): CarteChance[] {
  return lirePaquet(racine, 'cartes-chance.json', 'chance');
}

export function lireCartesMalchance(racine: string): CarteChance[] {
  return lirePaquet(racine, 'cartes-malchance.json', 'malchance');
}

export function lireRoue(racine: string): ConfigRoue {
  const brut: unknown = JSON.parse(fs.readFileSync(path.join(racine, 'config', 'roue.json'), 'utf8'));
  if (!estObjet(brut) || !Array.isArray(brut.options) || brut.options.length === 0) {
    throw new Error('config/roue.json est illisible');
  }
  const vues = new Set<string>();
  const options: OptionRoue[] = brut.options.map((entree) => {
    if (!estObjet(entree) || typeof entree.id !== 'string' || typeof entree.nom !== 'string' || typeof entree.couleur !== 'string') {
      throw new Error('Option de roue illisible');
    }
    if (typeof entree.probabilite !== 'number' || !Number.isInteger(entree.probabilite) || entree.probabilite <= 0) {
      throw new Error(`Probabilité invalide pour ${entree.id}`);
    }
    if (typeof entree.multiplicateur !== 'number' || entree.multiplicateur < 0) {
      throw new Error(`Multiplicateur invalide pour ${entree.id}`);
    }
    if (vues.has(entree.id)) throw new Error(`Option de roue en double : ${entree.id}`);
    vues.add(entree.id);
    const option: OptionRoue = {
      id: entree.id,
      nom: entree.nom.trim(),
      probabilite: entree.probabilite,
      multiplicateur: entree.multiplicateur,
      couleur: entree.couleur,
    };
    if (entree.avance !== undefined) {
      if (!entierPositif(entree.avance)) throw new Error(`Avance invalide pour ${entree.id}`);
      option.avance = entree.avance;
    }
    if (entree.recule !== undefined) {
      if (!entierPositif(entree.recule)) throw new Error(`Recul invalide pour ${entree.id}`);
      option.recule = entree.recule;
    }
    if (entree.partCagnotte !== undefined) {
      if (typeof entree.partCagnotte !== 'number' || entree.partCagnotte < 0 || entree.partCagnotte > 1) {
        throw new Error(`Part de cagnotte invalide pour ${entree.id}`);
      }
      option.partCagnotte = entree.partCagnotte;
    }
    if (entree.icone !== undefined) option.icone = lireIcone(entree, 'roue.json', entree.id);
    return option;
  });
  const somme = options.reduce((total, option) => total + option.probabilite, 0);
  if (somme !== 100) throw new Error(`Les probabilités de la roue somment à ${somme}, pas à 100`);
  return { options };
}

export function lireCatalogueTrophees(racine: string): CatalogueTrophees {
  const brut: unknown = JSON.parse(fs.readFileSync(path.join(racine, 'config', 'trophees.json'), 'utf8'));
  return lireTrophees(brut);
}
