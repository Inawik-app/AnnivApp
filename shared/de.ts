/** Échelle des poids entiers utilisés pour le tirage (crypto.randomInt côté serveur). */
export const ECHELLE_DE = 10_000;

/**
 * Interpolation entre un dé normal et la distribution à mise maximale.
 * p(k) = (1 − m/miseMax) × 1/6 + (m/miseMax) × probasMiseMax[k]
 */
export function probabilitesDe(mise: number, miseMax: number, probasMiseMax: readonly number[]): number[] {
  const ratio = miseMax <= 0 ? 0 : Math.min(1, Math.max(0, mise / miseMax));
  return probasMiseMax.map((poids) => (1 - ratio) * (1 / 6) + ratio * poids);
}

export function esperanceDe(probas: readonly number[]): number {
  return probas.reduce((total, probabilite, index) => total + probabilite * (index + 1), 0);
}

/** Poids entiers qui somment à ECHELLE_DE. Le dernier absorbe l'écart d'arrondi. */
export function poidsDe(probas: readonly number[]): number[] {
  const poids = probas.map((probabilite) => Math.max(0, Math.round(probabilite * ECHELLE_DE)));
  const somme = poids.reduce((total, poidsFace) => total + poidsFace, 0);
  const dernier = poids.length - 1;
  if (dernier >= 0) poids[dernier] = Math.max(0, (poids[dernier] ?? 0) + (ECHELLE_DE - somme));
  return poids;
}

export function faceSelonPoids(poids: readonly number[], tirage: number): number {
  let reste = tirage;
  for (let index = 0; index < poids.length; index += 1) {
    reste -= poids[index] ?? 0;
    if (reste < 0) return index + 1;
  }
  return Math.max(1, poids.length);
}

/** Tirage d'une face de 1 à 6. `alea(max)` renvoie un entier dans [0, max). */
export function tirerDePondere(probas: readonly number[], alea: (max: number) => number): number {
  const poids = poidsDe(probas);
  const total = poids.reduce((somme, poidsFace) => somme + poidsFace, 0);
  return faceSelonPoids(poids, alea(Math.max(1, total)));
}
