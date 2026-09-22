export type FileAnimations = {
  ajouter: (tache: () => Promise<void> | void) => void;
  couper: () => void;
};

export function creerFile(): FileAnimations {
  let chaine = Promise.resolve();
  let jeton = 0;
  return {
    couper() {
      jeton += 1;
    },
    ajouter(tache) {
      const moi = jeton;
      chaine = chaine
        .then(() => (moi === jeton ? tache() : undefined))
        .then(
          () => undefined,
          () => undefined,
        );
    },
  };
}

export function attendre(ms: number): Promise<void> {
  return new Promise((resoudre) => {
    setTimeout(resoudre, ms);
  });
}
