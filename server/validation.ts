import { LIBELLE_MAX, PSEUDO_MAX } from '../shared/constantes';
import { clePseudo } from '../shared/soldes';
import type { Joueur } from '../shared/types';

export function controlerPseudo(
  valeur: unknown,
  joueurs: Joueur[],
  saufId?: string,
): { ok: true; pseudo: string } | { ok: false; erreur: string } {
  if (typeof valeur !== 'string') return { ok: false, erreur: 'Choisis un pseudo' };
  const pseudo = valeur.trim();
  if (!pseudo) return { ok: false, erreur: 'Choisis un pseudo' };
  if (pseudo.length > PSEUDO_MAX) {
    return { ok: false, erreur: 'Le pseudo doit faire au maximum 16 caractères' };
  }
  if (/[\u0000-\u001F]/.test(pseudo)) return { ok: false, erreur: 'Ce pseudo n\'est pas valide' };
  const cle = clePseudo(pseudo);
  const pris = joueurs.some((joueur) => joueur.id !== saufId && clePseudo(joueur.pseudo) === cle);
  if (pris) return { ok: false, erreur: 'Ce pseudo est déjà pris, choisis-en un autre' };
  return { ok: true, pseudo };
}

const ID_AVATAR = /^[a-z0-9][a-z0-9-]{0,31}$/i;

export function controlerAvatar(valeur: unknown): { ok: true; avatar: string } | { ok: false; erreur: string } {
  if (typeof valeur !== 'string' || !ID_AVATAR.test(valeur)) {
    return { ok: false, erreur: 'Choisis un avatar' };
  }
  return { ok: true, avatar: valeur };
}

export function controlerMontant(valeur: unknown): { ok: true; montant: number } | { ok: false; erreur: string } {
  if (typeof valeur !== 'number' || !Number.isSafeInteger(valeur) || valeur === 0) {
    return { ok: false, erreur: 'Le montant doit être un nombre entier différent de zéro' };
  }
  return { ok: true, montant: valeur };
}

export function controlerLibelle(valeur: unknown): { ok: true; libelle: string } | { ok: false; erreur: string } {
  if (typeof valeur !== 'string' || !valeur.trim()) return { ok: false, erreur: 'Indique un libellé' };
  const libelle = valeur.trim();
  if (libelle.length > LIBELLE_MAX) return { ok: false, erreur: 'Le libellé est trop long' };
  return { ok: true, libelle };
}

export function controlerGroupe(valeur: unknown): { ok: true; groupe?: string } | { ok: false; erreur: string } {
  if (valeur === undefined || valeur === null || valeur === '') return { ok: true };
  if (typeof valeur !== 'string') return { ok: false, erreur: 'Groupe invalide' };
  const groupe = valeur.trim();
  if (!groupe) return { ok: true };
  if (groupe.length > 40) return { ok: false, erreur: 'Le groupe est trop long' };
  return { ok: true, groupe };
}

export function messagePartieComplete(maximum: number): string {
  return `La partie est complète (${maximum} joueurs)`;
}
