export type OptionRoue = {
  id: string;
  nom: string;
  /** Pourcentage entier. La somme du catalogue vaut 100. */
  probabilite: number;
  multiplicateur: number;
  avance?: number;
  recule?: number;
  /** Part de la cagnotte ajoutée après le multiplicateur, entre 0 et 1. */
  partCagnotte?: number;
  couleur: string;
  /** Absente pour une option qui reste sans dessin. */
  icone?: string;
};

export type ConfigRoue = {
  options: OptionRoue[];
};

export type PortionRoue = {
  id: string;
  debut: number;
  angle: number;
};

/** Angles en degrés, dans l'ordre des options, à partir du haut, dans le sens horaire. */
export function portionsRoue(options: readonly { id: string; probabilite: number }[]): PortionRoue[] {
  const total = options.reduce((somme, option) => somme + option.probabilite, 0);
  let curseur = 0;
  return options.map((option) => {
    const angle = total <= 0 ? 0 : (option.probabilite / total) * 360;
    const portion = { id: option.id, debut: curseur, angle };
    curseur += angle;
    return portion;
  });
}

/**
 * Rotation finale de la roue, en degrés, pour amener `position` (0 à 1 dans la portion)
 * sous le pointeur du haut. Plusieurs tours complets précèdent l'arrêt.
 */
export function rotationRoue(portion: PortionRoue, position: number, tours = 5): number {
  const place = portion.debut + portion.angle * Math.min(1, Math.max(0, position));
  return tours * 360 + (360 - place);
}

/** GP rendus au joueur pour la mise, arrondis à l'entier inférieur. */
export function renduRoue(mise: number, multiplicateur: number): number {
  if (mise <= 0 || multiplicateur <= 0) return 0;
  return Math.floor(mise * multiplicateur);
}

/** Espérance du multiplicateur. Le quart de cagnotte du Braquage n'y entre pas. */
export function esperanceMultiplicateur(options: readonly OptionRoue[]): number {
  const total = options.reduce((somme, option) => somme + option.probabilite, 0);
  if (total <= 0) return 0;
  return options.reduce((somme, option) => somme + (option.probabilite / total) * option.multiplicateur, 0);
}

/** Libellé court pour la légende de la télé. */
export function texteOptionRoue(option: OptionRoue): string {
  const facteur =
    option.multiplicateur === 0.5 ? '×0,5' : option.multiplicateur === 1.5 ? '×1,5' : `×${option.multiplicateur}`;
  if (option.avance) return `${facteur}, avance de ${option.avance} cases`;
  if (option.recule) return `${facteur}, recule de ${option.recule} cases`;
  if (option.partCagnotte) return `${facteur}, plus un quart de la cagnotte`;
  return facteur;
}

/** Tirage d'une option. `tirage` est dans [0, total). */
export function optionSelonTirage(options: readonly OptionRoue[], tirage: number): OptionRoue {
  let reste = tirage;
  for (const option of options) {
    reste -= option.probabilite;
    if (reste < 0) return option;
  }
  return options[options.length - 1] ?? options[0]!;
}
