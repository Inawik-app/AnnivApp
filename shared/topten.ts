/** Identifiant de l'hôte parmi les répondants. Il n'est jamais un joueur, ne marque rien et n'est jamais Cap'Ten. */
export const REPONDANT_HOTE = 'hote';

export const NUMERO_MIN = 1;
export const NUMERO_MAX = 10;

export type ThemeTopTen = {
  intitule: string;
  /** Ce que vaut le 1, par exemple « le moins utile ». */
  bas: string;
  /** Ce que vaut le 10, par exemple « le plus utile ». */
  haut: string;
};

export type ConfigTopTen = {
  nomHote: string;
  pointsParPaire: number;
  bonusOrdreParfait: number;
  /** Bonus total pour 0, 1, 2… numéros devinés exactement. */
  bonusChiffresExacts: number[];
  themes: ThemeTopTen[];
};

export type PaireTopTen = { avant: string; apres: string; ok: boolean };

export type ScoreTopTen = {
  paires: PaireTopTen[];
  pointsOrdre: number;
  parfait: boolean;
  bonusParfait: number;
  /** Répondants dont le numéro a été deviné exactement. */
  exacts: string[];
  bonusExacts: number;
  total: number;
};

export type Devines = Record<string, number | null>;

export function texteTheme(theme: ThemeTopTen): string {
  return `${NUMERO_MIN} = ${theme.bas} · ${NUMERO_MAX} = ${theme.haut}`;
}

/**
 * Chaque paire de répondants, prise dans l'ordre proposé, compte si le premier a un numéro plus petit.
 * L'ordre parfait ajoute son bonus ; les numéros devinés exactement ajoutent le bonus de leur nombre.
 */
export function scoreTopTen(
  ordre: string[],
  numeros: Record<string, number>,
  devines: Devines,
  config: Pick<ConfigTopTen, 'pointsParPaire' | 'bonusOrdreParfait' | 'bonusChiffresExacts'>,
): ScoreTopTen {
  const paires: PaireTopTen[] = [];
  for (let gauche = 0; gauche < ordre.length; gauche += 1) {
    for (let droite = gauche + 1; droite < ordre.length; droite += 1) {
      const avant = ordre[gauche]!;
      const apres = ordre[droite]!;
      paires.push({ avant, apres, ok: (numeros[avant] ?? 0) < (numeros[apres] ?? 0) });
    }
  }
  const bonnes = paires.filter((paire) => paire.ok).length;
  const pointsOrdre = bonnes * config.pointsParPaire;
  const parfait = paires.length > 0 && bonnes === paires.length;
  const bonusParfait = parfait ? config.bonusOrdreParfait : 0;
  const exacts = ordre.filter((id) => {
    const devine = devines[id];
    return typeof devine === 'number' && devine === numeros[id];
  });
  const table = config.bonusChiffresExacts;
  const bonusExacts = table.length === 0 ? 0 : table[Math.min(exacts.length, table.length - 1)] ?? 0;
  return {
    paires,
    pointsOrdre,
    parfait,
    bonusParfait,
    exacts,
    bonusExacts,
    total: pointsOrdre + bonusParfait + bonusExacts,
  };
}

export function numeroValide(valeur: unknown): valeur is number {
  return typeof valeur === 'number' && Number.isInteger(valeur) && valeur >= NUMERO_MIN && valeur <= NUMERO_MAX;
}

function estObjet(valeur: unknown): valeur is Record<string, unknown> {
  return !!valeur && typeof valeur === 'object' && !Array.isArray(valeur);
}

function entierPositif(valeur: unknown): valeur is number {
  return typeof valeur === 'number' && Number.isInteger(valeur) && valeur >= 0;
}

function texte(valeur: unknown): valeur is string {
  return typeof valeur === 'string' && valeur.trim().length > 0;
}

export function validerTopTen(brut: unknown): ConfigTopTen {
  function echec(message: string): never {
    throw new Error(`topten.json : ${message}`);
  }
  if (!estObjet(brut)) echec('le fichier est illisible');
  if (!texte(brut.nomHote) || brut.nomHote.trim().length > 20) echec("nomHote doit être un nom de 1 à 20 caractères");
  if (!entierPositif(brut.pointsParPaire)) echec('pointsParPaire doit être un entier positif ou nul');
  if (!entierPositif(brut.bonusOrdreParfait)) echec('bonusOrdreParfait doit être un entier positif ou nul');
  if (!Array.isArray(brut.bonusChiffresExacts) || brut.bonusChiffresExacts.length < 1) {
    echec('bonusChiffresExacts doit lister le bonus pour 0, 1, 2… numéros exacts');
  }
  const bonusChiffresExacts = brut.bonusChiffresExacts.map((valeur, index) => {
    if (!entierPositif(valeur)) echec(`bonusChiffresExacts n'a pas un entier positif ou nul en position ${index + 1}`);
    return valeur;
  });
  if (!Array.isArray(brut.themes) || brut.themes.length < 1) echec('il faut au moins un thème');
  const vus = new Set<string>();
  const themes = brut.themes.map((entree, index) => {
    if (!estObjet(entree) || !texte(entree.intitule) || !texte(entree.bas) || !texte(entree.haut)) {
      echec(`le thème ${index + 1} doit avoir un intitulé, un pôle bas et un pôle haut`);
    }
    const intitule = entree.intitule.trim();
    if (vus.has(intitule)) echec(`le thème « ${intitule} » est en double`);
    vus.add(intitule);
    return { intitule, bas: entree.bas.trim(), haut: entree.haut.trim() };
  });
  return {
    nomHote: brut.nomHote.trim(),
    pointsParPaire: brut.pointsParPaire,
    bonusOrdreParfait: brut.bonusOrdreParfait,
    bonusChiffresExacts,
    themes,
  };
}
