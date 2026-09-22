export function cleJetonJoueur(): string {
  const profil = new URLSearchParams(window.location.search).get('profil');
  return profil ? `gp-party.jeton.profil-${profil}` : 'gp-party.jeton';
}

export function cleCodeHote(): string {
  return 'gp-party.code-hote';
}

export function lireJeton(): string | null {
  return localStorage.getItem(cleJetonJoueur());
}

export function ecrireJeton(jeton: string): void {
  localStorage.setItem(cleJetonJoueur(), jeton);
}

export function oublierJeton(): void {
  localStorage.removeItem(cleJetonJoueur());
}
