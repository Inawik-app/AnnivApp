export type ConfigPerudo = {
  desParJoueur: number;
  calza: boolean;
  /** Réservé. Le moteur n'applique aucune règle spéciale quand il vaut true. */
  palifico: boolean;
};

export type AnnoncePerudo = {
  nombre: number;
  valeur: number;
};

export const LIGNES_REGLES_PERUDO = [
  '**But :** être le dernier joueur à qui il reste des dés.',
  '1. Chacun lance ses dés en secret, sur son téléphone.',
  '2. À tour de rôle, on fait une annonce sur **tous les dés de la table** : « au moins 4 dés de valeur 5 ».',
  '3. Les **1 (Pacos) sont des jokers** : ils comptent pour n\'importe quelle valeur.',
  '4. **Surenchérir**, c\'est annoncer plus de dés, sur n\'importe quelle valeur, ou le même nombre de dés avec une valeur plus haute.',
  '5. **Annoncer des Pacos :** on divise le nombre par deux, arrondi au-dessus (6 dés de 4 → 3 Pacos). **En sortir :** on double le nombre et on ajoute 1 (3 Pacos → 7 dés de n\'importe quelle valeur). La première annonce d\'une manche ne peut pas porter sur les Pacos.',
  '6. **« Dudo ! »** Au lieu de surenchérir, tu doutes de l\'annonce précédente. On révèle tous les dés. S\'il y en a moins qu\'annoncé, l\'annonceur perd un dé ; sinon, c\'est toi qui en perds un.',
  '7. **« Calza ! »** Tu paries que le compte est **exactement** celui de l\'annonce. Si c\'est le cas, tu regagnes un dé ; sinon, tu en perds un.',
  '8. Celui qui perd un dé commence la manche suivante, et tout le monde relance.',
  '**Exemple :** 16 dés en jeu. Inès annonce « 3 dés de 5 ». Léo surenchérit : « 4 dés de 5 », ou « 3 dés de 6 ». Noé doute : « Dudo ! » On compte les 5 et les 1 : il y en a 5, donc l\'annonce tient et Noé perd un dé.',
];

export const RAPPEL_PERUDO = [
  'Plus de dés, ou même nombre et valeur plus haute',
  'Les 1 sont des jokers',
  'Dudo : tu doutes · Calza : compte exact',
];

export function validerPerudo(brut: unknown): ConfigPerudo {
  if (!brut || typeof brut !== 'object') throw new Error('perudo.json : fichier illisible');
  const config = brut as Partial<ConfigPerudo>;
  if (config.desParJoueur !== 4) throw new Error('perudo.json : desParJoueur doit valoir 4');
  if (config.calza !== true) throw new Error('perudo.json : calza doit valoir true');
  if (typeof config.palifico !== 'boolean') throw new Error('perudo.json : palifico doit être un booléen');
  return { desParJoueur: config.desParJoueur, calza: config.calza, palifico: config.palifico };
}

export function estPaco(valeur: number): boolean {
  return valeur === 1;
}

/** Vrai si `suivante` peut suivre `precedente`. `null` : ouverture de manche, sans Pacos. */
export function annonceLegale(precedente: AnnoncePerudo | null, suivante: AnnoncePerudo): boolean {
  if (!Number.isInteger(suivante.nombre) || suivante.nombre < 1) return false;
  if (!Number.isInteger(suivante.valeur) || suivante.valeur < 1 || suivante.valeur > 6) return false;
  if (!precedente) return !estPaco(suivante.valeur);
  if (!Number.isInteger(precedente.nombre) || precedente.nombre < 1) return false;
  if (!Number.isInteger(precedente.valeur) || precedente.valeur < 1 || precedente.valeur > 6) return false;
  const avant = estPaco(precedente.valeur);
  const apres = estPaco(suivante.valeur);
  if (!avant && !apres) {
    return suivante.nombre > precedente.nombre || (suivante.nombre === precedente.nombre && suivante.valeur > precedente.valeur);
  }
  if (!avant && apres) return suivante.nombre >= Math.ceil(precedente.nombre / 2);
  if (avant && !apres) return suivante.nombre >= precedente.nombre * 2 + 1;
  return suivante.nombre > precedente.nombre;
}

/** Plus petite annonce légale : d'abord le plus petit nombre, puis la plus petite valeur. */
export function plusPetiteAnnonce(precedente: AnnoncePerudo | null): AnnoncePerudo | null {
  const plafond = Math.max(40, (precedente?.nombre ?? 1) * 2 + 2);
  let meilleure: AnnoncePerudo | null = null;
  for (let nombre = 1; nombre <= plafond; nombre += 1) {
    for (const valeur of [1, 2, 3, 4, 5, 6]) {
      const candidate = { nombre, valeur };
      if (!annonceLegale(precedente, candidate)) continue;
      if (
        !meilleure ||
        candidate.nombre < meilleure.nombre ||
        (candidate.nombre === meilleure.nombre && candidate.valeur < meilleure.valeur)
      ) {
        meilleure = candidate;
      }
    }
  }
  return meilleure;
}

/** Les 1 comptent pour la valeur annoncée. Une annonce de Pacos ne compte que les 1. */
export function compterDes(mains: readonly (readonly number[])[], valeur: number): number {
  let total = 0;
  for (const main of mains) {
    for (const face of main) {
      if (estPaco(valeur)) {
        if (face === 1) total += 1;
      } else if (face === valeur || face === 1) total += 1;
    }
  }
  return total;
}

export function gainDe(des: number, plafond: number): { des: number; delta: 0 | 1 } {
  if (des >= plafond) return { des, delta: 0 };
  return { des: des + 1, delta: 1 };
}

export function perteDe(des: number): number {
  return Math.max(0, des - 1);
}

/** Après une Calza réussie, c'est celui qui l'a annoncée. Sinon, celui qui a perdu un dé, ou le suivant s'il est éliminé. */
export function premierSuivant(
  ordre: readonly string[],
  des: Readonly<Record<string, number>>,
  concerneId: string,
  calzaReussie: boolean,
): string {
  if (calzaReussie && (des[concerneId] ?? 0) > 0) return concerneId;
  if ((des[concerneId] ?? 0) > 0) return concerneId;
  const index = Math.max(0, ordre.indexOf(concerneId));
  for (let pas = 1; pas <= ordre.length; pas += 1) {
    const id = ordre[(index + pas) % ordre.length];
    if (id && (des[id] ?? 0) > 0) return id;
  }
  return concerneId;
}

/** Le survivant d'abord, puis le dernier éliminé, jusqu'au premier sorti. */
export function classementPerudo(survivantId: string | null, elimines: readonly string[]): string[] {
  return survivantId ? [survivantId, ...elimines.slice().reverse()] : [...elimines].reverse();
}
