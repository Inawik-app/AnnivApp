/** Identifiant de l'hôte quand il participe (devineur ou indiceur). */
export const JUSTONE_HOTE = 'hote';

export type ConfigJustOne = {
  cycles: number;
  hoteDevine: boolean;
  dureeIndices: number;
  gainDevineur: number;
  gainIndice: number;
  mots: string[];
};

export const LIGNES_REGLES_JUSTONE = [
  'Un joueur doit faire trouver un mot secret.',
  'Les autres écrivent un indice d\'un seul mot.',
  'Les indices identiques s\'annulent et restent cachés.',
  'Le devineur lit les indices restants et propose le mot.',
];

const LETTRES = /^[a-zA-ZàâäéèêëïîôùûüçœæÀÂÄÉÈÊËÏÎÔÙÛÜÇŒÆ]+$/;

/** Minuscules, sans accents, sans s/x final (pluriel grossier). */
export function normaliserIndice(mot: string): string {
  let plie = mot
    .trim()
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (plie.length > 3 && (plie.endsWith('s') || plie.endsWith('x'))) {
    plie = plie.slice(0, -1);
  }
  return plie;
}

/** `null` si l'indice est accepté, sinon le message de refus. */
export function indiceValide(motBrut: string, secret: string): string | null {
  const mot = motBrut.trim();
  if (!mot) return "L'indice est vide";
  if (/\s/u.test(mot) || mot.includes('-') || mot.includes("'") || mot.includes('’')) {
    return 'Un indice tient en un seul mot';
  }
  if (!LETTRES.test(mot)) return 'Un indice tient en un seul mot';
  const plie = normaliserIndice(mot);
  const cible = normaliserIndice(secret);
  if (!plie) return "L'indice est vide";
  if (plie === cible) return "L'indice ne peut pas être le mot secret";
  if (plie.includes(cible) || cible.includes(plie)) return "L'indice est trop proche du mot secret";
  return null;
}

export type IndiceAnnulation = { auteurId: string; mot: string };

/**
 * Annule les indices identiques entre joueurs.
 * Si l'hôte a le même indice qu'un joueur, seul l'hôte est annulé ;
 * les joueurs s'annulent entre eux s'ils sont plusieurs à avoir le même.
 */
export function annulerIndices(
  indices: IndiceAnnulation[],
  hoteId: string = JUSTONE_HOTE,
): Array<IndiceAnnulation & { annule: boolean }> {
  const normalises = indices.map((indice) => ({
    ...indice,
    cle: normaliserIndice(indice.mot),
  }));
  const parCle = new Map<string, typeof normalises>();
  for (const indice of normalises) {
    const liste = parCle.get(indice.cle) ?? [];
    liste.push(indice);
    parCle.set(indice.cle, liste);
  }
  const annules = new Set<number>();
  for (const groupe of parCle.values()) {
    if (groupe.length < 2) continue;
    const joueurs = groupe.filter((indice) => indice.auteurId !== hoteId);
    const hotes = groupe.filter((indice) => indice.auteurId === hoteId);
    if (joueurs.length >= 2) {
      for (const indice of joueurs) {
        const index = normalises.indexOf(indice);
        if (index >= 0) annules.add(index);
      }
    }
    if (hotes.length > 0 && joueurs.length >= 1) {
      for (const indice of hotes) {
        const index = normalises.indexOf(indice);
        if (index >= 0) annules.add(index);
      }
    } else if (hotes.length >= 2 && joueurs.length === 0) {
      for (const indice of hotes) {
        const index = normalises.indexOf(indice);
        if (index >= 0) annules.add(index);
      }
    }
  }
  return indices.map((indice, index) => ({ ...indice, annule: annules.has(index) }));
}

/** Ordre des devineurs : pour chaque cycle, chaque joueur puis l'hôte si `hoteDevine`. */
export function ordreDevineursJustOne(
  joueurs: readonly string[],
  cycles: number,
  hoteDevine: boolean,
  hoteId: string = JUSTONE_HOTE,
): string[] {
  const ordre: string[] = [];
  for (let cycle = 0; cycle < cycles; cycle += 1) {
    for (const id of joueurs) ordre.push(id);
    if (hoteDevine) ordre.push(hoteId);
  }
  return ordre;
}

function estObjet(valeur: unknown): valeur is Record<string, unknown> {
  return !!valeur && typeof valeur === 'object' && !Array.isArray(valeur);
}

function entierPositif(valeur: unknown): valeur is number {
  return typeof valeur === 'number' && Number.isInteger(valeur) && valeur > 0;
}

function entierNonNegatif(valeur: unknown): valeur is number {
  return typeof valeur === 'number' && Number.isInteger(valeur) && valeur >= 0;
}

function texte(valeur: unknown): valeur is string {
  return typeof valeur === 'string' && valeur.trim().length > 0;
}

export function validerJustOne(brut: unknown): ConfigJustOne {
  function echec(message: string): never {
    throw new Error(`justone.json : ${message}`);
  }
  if (!estObjet(brut)) echec('le fichier est illisible');
  if (!entierPositif(brut.cycles)) echec('cycles doit être un entier positif');
  if (typeof brut.hoteDevine !== 'boolean') echec('hoteDevine doit être un booléen');
  if (!entierPositif(brut.dureeIndices)) echec('dureeIndices doit être un entier positif');
  if (!entierNonNegatif(brut.gainDevineur)) echec('gainDevineur doit être un entier positif ou nul');
  if (!entierNonNegatif(brut.gainIndice)) echec('gainIndice doit être un entier positif ou nul');
  if (!Array.isArray(brut.mots) || brut.mots.length < 250) {
    echec('il faut au moins 250 mots');
  }
  const vus = new Set<string>();
  const mots = brut.mots.map((entree, index) => {
    if (!texte(entree)) echec(`le mot ${index + 1} est vide`);
    const mot = entree.trim();
    if (/\s/u.test(mot) || mot.includes('-')) echec(`le mot « ${mot} » doit être un seul mot`);
    const cle = normaliserIndice(mot);
    if (vus.has(cle)) echec(`le mot « ${mot} » est en double`);
    vus.add(cle);
    return mot;
  });
  return {
    cycles: brut.cycles,
    hoteDevine: brut.hoteDevine,
    dureeIndices: brut.dureeIndices,
    gainDevineur: brut.gainDevineur,
    gainIndice: brut.gainIndice,
    mots,
  };
}
