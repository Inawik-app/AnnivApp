import { statistiques } from './statistiques.js';
import type { EtatJeu, StatistiquesJoueur, TropheeVue } from './types.js';

export type CritereTrophee =
  | 'indiceChance'
  | 'cartesMalchance'
  | 'casesReculees'
  | 'gpDonnes'
  | 'gpHorsPlateau'
  | 'pingpong'
  | 'misesRoue'
  | 'misesTotales'
  | 'rangArrivee'
  | 'remontee'
  | 'placesGp';

export type TropheeConfig = {
  id: string;
  nom: string;
  description: string;
  icone: string;
  /** Remplace `icone` quand le trophée devient Remontada légendaire. */
  iconeLegendaire?: string;
  critere: CritereTrophee;
  sens: 'maximum' | 'minimum';
  montant: number;
  phrase: string;
};

const CRITERES = new Set<string>([
  'indiceChance',
  'cartesMalchance',
  'casesReculees',
  'gpDonnes',
  'gpHorsPlateau',
  'pingpong',
  'misesRoue',
  'misesTotales',
  'rangArrivee',
  'remontee',
  'placesGp',
]);

export type CatalogueTrophees = {
  nombreCeremonie: number;
  trophees: TropheeConfig[];
};

export function lireTrophees(contenu: unknown): CatalogueTrophees {
  if (Array.isArray(contenu)) return { nombreCeremonie: 4, trophees: lireListeTrophees(contenu) };
  if (!contenu || typeof contenu !== 'object') throw new Error('Le catalogue des trophées est illisible.');
  const brut = contenu as Record<string, unknown>;
  if (!Array.isArray(brut.trophees)) throw new Error('Le catalogue des trophées doit contenir une liste.');
  const nombre = brut.nombreCeremonie;
  if (typeof nombre !== 'number' || !Number.isInteger(nombre) || nombre < 1) {
    throw new Error('nombreCeremonie doit être un entier au moins égal à 1.');
  }
  return { nombreCeremonie: nombre, trophees: lireListeTrophees(brut.trophees) };
}

function lireListeTrophees(contenu: unknown[]): TropheeConfig[] {
  return contenu.map((entree) => {
    if (!entree || typeof entree !== 'object') throw new Error('Entrée de trophée illisible.');
    const brut = entree as Record<string, unknown>;
    if (typeof brut.id !== 'string' || typeof brut.nom !== 'string' || typeof brut.description !== 'string') {
      throw new Error('Un trophée doit avoir un id, un nom et une description.');
    }
    if (typeof brut.icone !== 'string' || typeof brut.phrase !== 'string') {
      throw new Error(`Le trophée ${brut.id} doit avoir une icône et une phrase.`);
    }
    if (!CRITERES.has(String(brut.critere))) throw new Error(`Critère inconnu pour ${brut.id}.`);
    if (brut.sens !== 'maximum' && brut.sens !== 'minimum') throw new Error(`Sens inconnu pour ${brut.id}.`);
    const iconeLegendaire = typeof brut.iconeLegendaire === 'string' ? brut.iconeLegendaire : undefined;
    return {
      id: brut.id,
      nom: brut.nom,
      description: brut.description,
      icone: brut.icone,
      ...(iconeLegendaire ? { iconeLegendaire } : {}),
      critere: brut.critere as CritereTrophee,
      sens: brut.sens,
      montant: typeof brut.montant === 'number' ? brut.montant : 12,
      phrase: brut.phrase,
    };
  });
}

function valeurCritere(stats: StatistiquesJoueur, critere: CritereTrophee, activitePing: boolean): number | null {
  switch (critere) {
    case 'indiceChance':
      return stats.lancers >= 3 ? stats.indiceChance : null;
    case 'cartesMalchance':
      return stats.cartesMalchance;
    case 'casesReculees':
      return stats.casesReculees;
    case 'gpDonnes':
      return stats.gpDonnes;
    case 'gpHorsPlateau':
      return stats.gpHorsPlateau;
    case 'pingpong':
      return activitePing ? (stats.gpParJeu['ping-pong'] ?? 0) : null;
    case 'misesRoue':
      return stats.misesRoue;
    case 'misesTotales':
      return stats.misesTotales;
    case 'rangArrivee':
      return stats.rangArrivee;
    case 'remontee':
      return stats.remontee;
    case 'placesGp':
      return stats.placesGp;
    default:
      return null;
  }
}

function formaterNombre(valeur: number, critere: CritereTrophee): string {
  if (critere === 'rangArrivee') return valeur === 1 ? '1er' : `${valeur}e`;
  if (critere === 'indiceChance') {
    const texte = valeur.toFixed(1).replace('.', ',');
    return valeur < 0 ? `\u2212${texte.slice(1)}` : texte;
  }
  return String(Math.round(valeur));
}

function phrasePour(modele: string, noms: string[], valeur: string): string {
  const sujet = noms.length <= 1 ? (noms[0] ?? '') : `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]}`;
  return modele.replace('{noms}', sujet).replace('{valeur}', valeur);
}

/**
 * Attribution des trophées. Rien n'est stocké : une annulation recalcule le même résultat.
 * Un trophée n'est pas attribuable si les données manquent, si tout le monde est à 0,
 * ou si tous les joueurs éligibles sont à égalité.
 */
export function trophees(etat: EtatJeu, catalogue: readonly TropheeConfig[]): TropheeVue[] {
  const stats = statistiques(etat);
  const ids = etat.joueurs.map((joueur) => joueur.id);
  const activitePing = ids.some((id) => (stats[id]?.gpParJeu['ping-pong'] ?? 0) > 0);
  return catalogue.map((trophee) => {
    const valeurs: Record<string, number | null> = {};
    for (const id of ids) valeurs[id] = valeurCritere(stats[id] ?? ({} as StatistiquesJoueur), trophee.critere, activitePing);
    const eligibles = ids.filter((id) => valeurs[id] !== null);
    const nombres = eligibles.map((id) => valeurs[id]!);
    const toutNul = nombres.length > 0 && nombres.every((nombre) => nombre === 0);
    const exigeTous = trophee.critere !== 'indiceChance';
    const incomplet = exigeTous && eligibles.length !== ids.length;
    const cible = nombres.length === 0 ? null : trophee.sens === 'maximum' ? Math.max(...nombres) : Math.min(...nombres);
    const tousEgaux = cible !== null && eligibles.length >= 2 && nombres.every((nombre) => nombre === cible);
    const remonteeVide = trophee.critere === 'remontee' && (cible === null || cible <= 0);
    const sansEcart = tousEgaux || toutNul || incomplet || eligibles.length === 0 || remonteeVide;
    let gagnants = sansEcart || cible === null ? [] : eligibles.filter((id) => valeurs[id] === cible);
    if (trophee.critere === 'remontee' && gagnants.length > 1) {
      const meilleur = Math.max(...gagnants.map((id) => stats[id]?.retardRattrape ?? 0));
      const departages = gagnants.filter((id) => (stats[id]?.retardRattrape ?? 0) === meilleur);
      if (departages.length < gagnants.length) gagnants = departages;
    }
    const legendaire =
      trophee.critere === 'remontee' &&
      gagnants.length > 0 &&
      gagnants.every((id) => stats[id]?.legendaire && stats[id]?.rangArrivee === 1);
    const nom = legendaire ? 'Remontada légendaire' : trophee.nom;
    const montant = legendaire ? trophee.montant + 8 : trophee.montant;
    const phrase =
      gagnants.length === 0 || cible === null
        ? ''
        : phrasePour(trophee.phrase, gagnants.map((id) => etat.joueurs.find((joueur) => joueur.id === id)?.pseudo ?? id), formaterNombre(cible, trophee.critere));
    return {
      id: trophee.id,
      nom,
      description: trophee.description,
      icone: legendaire && trophee.iconeLegendaire ? trophee.iconeLegendaire : trophee.icone,
      montant,
      attribuable: gagnants.length > 0,
      gagnants,
      valeurs,
      phrase,
    };
  });
}
