/** Espérance d'un dé équitable à `faces` faces : (faces + 1) / 2. */
export function esperanceDe(faces: number): number {
  return (Math.max(1, faces) + 1) / 2;
}

/** Tirage uniforme de 1 à `faces`. `alea(max)` renvoie un entier dans [0, max). */
export function tirerDeUniforme(faces: number, alea: (max: number) => number): number {
  const nombre = Math.max(1, Math.floor(faces));
  return alea(nombre) + 1;
}
