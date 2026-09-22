import fs from 'node:fs';
import path from 'node:path';
import type { CarteChance, ConfigPlateau, EffetCarte, TypeCase } from '../shared/types';
import { dispositionValide } from './plateau';

function estObjet(valeur: unknown): valeur is Record<string, unknown> {
  return !!valeur && typeof valeur === 'object' && !Array.isArray(valeur);
}

const TYPES = new Set<TypeCase>(['depart', 'bonus', 'chance', 'cagnotte', 'duel', 'arrivee']);

function lireEffet(brut: unknown): EffetCarte | null {
  if (!estObjet(brut) || typeof brut.type !== 'string') return null;
  if (brut.type === 'gain' || brut.type === 'gainTous' || brut.type === 'cadeau') {
    if (typeof brut.montant !== 'number' || !Number.isInteger(brut.montant) || brut.montant < 0) return null;
    return { type: brut.type, montant: brut.montant };
  }
  if (brut.type === 'gainDe' || brut.type === 'neutre') return { type: brut.type };
  return null;
}

export function lireConfigPlateau(racine: string): ConfigPlateau {
  const brut: unknown = JSON.parse(fs.readFileSync(path.join(racine, 'config', 'plateau.json'), 'utf8'));
  if (!estObjet(brut) || !estObjet(brut.repartition) || !estObjet(brut.duel)) {
    throw new Error('config/plateau.json est illisible');
  }
  const longueur = brut.longueur;
  const gainBonus = brut.gainBonus;
  const miseMax = brut.miseMax;
  const choix = brut.choixMiniJeu;
  const repartition = brut.repartition;
  const duel = brut.duel;
  if (typeof longueur !== 'number' || longueur < 4) throw new Error('longueur du plateau invalide');
  if (typeof gainBonus !== 'number' || gainBonus < 0) throw new Error('gainBonus invalide');
  if (typeof miseMax !== 'number' || miseMax < 0) throw new Error('miseMax invalide');
  if (choix !== 'premier' && choix !== 'dernier') throw new Error('choixMiniJeu invalide');
  const nombres = ['bonus', 'chance', 'cagnotte', 'duel'] as const;
  const compte: Record<(typeof nombres)[number], number> = { bonus: 0, chance: 0, cagnotte: 0, duel: 0 };
  for (const cle of nombres) {
    const valeur = repartition[cle];
    if (typeof valeur !== 'number' || valeur < 0 || !Number.isInteger(valeur)) {
      throw new Error(`repartition.${cle} invalide`);
    }
    compte[cle] = valeur;
  }
  if (compte.bonus + compte.chance + compte.cagnotte + compte.duel !== longueur - 1) {
    throw new Error('La répartition ne couvre pas les cases 1 à l’avant-dernière');
  }
  if (compte.cagnotte + compte.duel > longueur - 4) {
    throw new Error('Trop de cagnottes et de duels pour les cases autorisées');
  }
  if (typeof duel.miseMax !== 'number' || typeof duel.bonusVainqueur !== 'number' || !Array.isArray(duel.defis)) {
    throw new Error('Réglage des duels invalide');
  }
  if (duel.bonusVainqueur < 0 || duel.miseMax < 0) throw new Error('Réglage des duels invalide');
  const defis = duel.defis.filter((defi): defi is string => typeof defi === 'string' && defi.trim().length > 0);
  if (defis.length === 0) throw new Error('La liste des défis est vide');
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
  return {
    longueur,
    repartition: compte,
    gainBonus,
    miseMax,
    choixMiniJeu: choix,
    duel: { miseMax: duel.miseMax, bonusVainqueur: duel.bonusVainqueur, defis: defis.map((defi) => defi.trim()) },
    ...(disposition ? { disposition } : {}),
  };
}

export function lireCartesChance(racine: string): CarteChance[] {
  const brut: unknown = JSON.parse(fs.readFileSync(path.join(racine, 'config', 'cartes-chance.json'), 'utf8'));
  if (!Array.isArray(brut) || brut.length === 0) throw new Error('config/cartes-chance.json est vide');
  const vues = new Set<string>();
  return brut.map((entree) => {
    if (!estObjet(entree) || typeof entree.id !== 'string' || typeof entree.titre !== 'string' || typeof entree.texte !== 'string') {
      throw new Error('Carte chance invalide');
    }
    const effet = lireEffet(entree.effet);
    if (!effet) throw new Error(`Effet invalide pour la carte ${entree.id}`);
    if (vues.has(entree.id)) throw new Error(`Carte chance en double : ${entree.id}`);
    vues.add(entree.id);
    if ((effet.type === 'gain' || effet.type === 'gainTous' || effet.type === 'cadeau') && effet.montant < 0) {
      throw new Error(`La carte ${entree.id} retire des GP`);
    }
    return { id: entree.id, titre: entree.titre.trim(), texte: entree.texte.trim(), effet };
  });
}
