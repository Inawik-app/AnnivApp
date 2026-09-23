export type PaireUndercover = { civils: string; undercover: string };

export type ConfigUndercover = {
  manches: number;
  gainCivils: number;
  gainUndercoverDevine: number;
  gainUndercoverSurvit: number;
  paires: PaireUndercover[];
};

export type RoleUndercover = 'civil' | 'undercover';

function estObjet(valeur: unknown): valeur is Record<string, unknown> {
  return !!valeur && typeof valeur === 'object' && !Array.isArray(valeur);
}

function texte(valeur: unknown): valeur is string {
  return typeof valeur === 'string' && valeur.trim().length > 0;
}

function entier(valeur: unknown, minimum: number): valeur is number {
  return typeof valeur === 'number' && Number.isInteger(valeur) && valeur >= minimum;
}

export function validerUndercover(brut: unknown): ConfigUndercover {
  function echec(message: string): never {
    throw new Error(`undercover.json : ${message}`);
  }
  if (!estObjet(brut)) echec('le fichier est illisible');
  if (!entier(brut.manches, 1)) echec('manches doit être un entier d\'au moins 1');
  for (const cle of ['gainCivils', 'gainUndercoverDevine', 'gainUndercoverSurvit'] as const) {
    if (!entier(brut[cle], 0)) echec(`${cle} doit être un entier positif ou nul`);
  }
  if (!Array.isArray(brut.paires) || brut.paires.length < 1) echec('il faut au moins une paire de mots');
  const vus = new Set<string>();
  const paires = brut.paires.map((paire, index) => {
    if (!estObjet(paire) || !texte(paire.civils) || !texte(paire.undercover)) {
      echec(`la paire ${index + 1} doit avoir un mot civils et un mot undercover`);
    }
    const civils = paire.civils.trim();
    const undercover = paire.undercover.trim();
    if (civils.toLowerCase() === undercover.toLowerCase()) echec(`la paire ${index + 1} a deux fois le même mot`);
    const cle = `${civils}|${undercover}`.toLowerCase();
    if (vus.has(cle)) echec(`la paire « ${civils} / ${undercover} » est en double`);
    vus.add(cle);
    return { civils, undercover };
  });
  return {
    manches: brut.manches as number,
    gainCivils: brut.gainCivils as number,
    gainUndercoverDevine: brut.gainUndercoverDevine as number,
    gainUndercoverSurvit: brut.gainUndercoverSurvit as number,
    paires,
  };
}
