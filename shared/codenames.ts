export type EquipeCodenames = 'rouge' | 'bleu';
export type CouleurCarte = EquipeCodenames | 'neutre' | 'assassin';
export type NombreIndice = number | 'infini';

export type RepartitionCodenames = {
  equipeDebut: number;
  autreEquipe: number;
  neutres: number;
  assassin: number;
};

export type ConfigCodenames = {
  grille: number;
  repartition: RepartitionCodenames;
  manches: number;
  gainGagnant: number;
  gainPerdant: number;
  dureeIndice: number;
  mots: string[];
};

const LETTRES = /^[a-zA-ZàâäéèêëïîôùûüçœæÀÂÄÉÈÊËÏÎÔÙÛÜÇŒÆ]+$/;

export function plier(mot: string): string {
  return mot
    .trim()
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function autreEquipe(equipe: EquipeCodenames): EquipeCodenames {
  return equipe === 'rouge' ? 'bleu' : 'rouge';
}

export function libelleEquipe(equipe: EquipeCodenames): string {
  return equipe === 'rouge' ? 'rouge' : 'bleue';
}

export function libelleNombre(nombre: NombreIndice): string {
  return nombre === 'infini' ? '∞' : String(nombre);
}

export function nombreIndiceValide(nombre: unknown): nombre is NombreIndice {
  if (nombre === 'infini') return true;
  return typeof nombre === 'number' && Number.isInteger(nombre) && nombre >= 0 && nombre <= 9;
}

export function essaisPour(nombre: NombreIndice): number | null {
  if (nombre === 'infini') return null;
  return nombre + 1;
}

/** `null` si l'indice est accepté, sinon le message de refus. */
export function indiceValide(brut: string, motsCaches: readonly string[]): string | null {
  const mot = brut.trim();
  if (!mot) return "L'indice est vide";
  if (/\s/u.test(mot) || mot.includes('-') || mot.includes("'") || mot.includes('’')) {
    return 'Un indice tient en un seul mot';
  }
  if (!LETTRES.test(mot)) return 'Un indice tient en un seul mot';
  const plie = plier(mot);
  for (const carte of motsCaches) {
    const autre = plier(carte);
    if (!autre) continue;
    if (plie === autre || plie.includes(autre) || autre.includes(plie)) {
      return `L'indice touche le mot ${carte}`;
    }
  }
  return null;
}

export function compositionCle(equipeDebut: EquipeCodenames, repartition: RepartitionCodenames): CouleurCarte[] {
  const autre = autreEquipe(equipeDebut);
  return [
    ...Array.from({ length: repartition.equipeDebut }, () => equipeDebut),
    ...Array.from({ length: repartition.autreEquipe }, () => autre),
    ...Array.from({ length: repartition.neutres }, (): CouleurCarte => 'neutre'),
    ...Array.from({ length: repartition.assassin }, (): CouleurCarte => 'assassin'),
  ];
}

export function validerCodenames(brut: unknown): ConfigCodenames {
  if (!brut || typeof brut !== 'object') throw new Error('codenames.json : fichier illisible');
  const config = brut as Partial<ConfigCodenames>;
  if (config.grille !== 5) throw new Error('codenames.json : la grille doit faire 5');
  const repartition = config.repartition;
  if (!repartition || typeof repartition !== 'object') throw new Error('codenames.json : repartition absente');
  const { equipeDebut, autreEquipe, neutres, assassin } = repartition;
  if (equipeDebut !== 9 || autreEquipe !== 8 || neutres !== 7 || assassin !== 1) {
    throw new Error('codenames.json : la répartition doit être 9, 8, 7 et 1');
  }
  if (equipeDebut + autreEquipe + neutres + assassin !== config.grille * config.grille) {
    throw new Error('codenames.json : la répartition ne couvre pas la grille');
  }
  if (config.manches !== 2) throw new Error('codenames.json : il faut 2 manches');
  if (config.gainGagnant !== 8 || config.gainPerdant !== 2) {
    throw new Error('codenames.json : les gains doivent être 8 et 2');
  }
  if (config.dureeIndice !== 120) throw new Error('codenames.json : dureeIndice doit valoir 120');
  if (!Array.isArray(config.mots)) throw new Error('codenames.json : mots absents');
  const vus = new Set<string>();
  for (const mot of config.mots) {
    if (typeof mot !== 'string' || !LETTRES.test(mot) || mot !== mot.trim()) {
      throw new Error(`codenames.json : « ${String(mot)} » n'est pas un seul mot`);
    }
    const plie = plier(mot);
    if (vus.has(plie)) throw new Error(`codenames.json : « ${mot} » est en double`);
    vus.add(plie);
  }
  if (vus.size < 400) throw new Error(`codenames.json : ${vus.size} mots, il en faut au moins 400`);
  return {
    grille: config.grille,
    repartition: { equipeDebut, autreEquipe, neutres, assassin },
    manches: config.manches,
    gainGagnant: config.gainGagnant,
    gainPerdant: config.gainPerdant,
    dureeIndice: config.dureeIndice,
    mots: [...config.mots],
  };
}
