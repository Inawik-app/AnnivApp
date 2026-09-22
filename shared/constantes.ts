export const SCHEMA = 1;
export const LIMITE_EVENEMENTS = 300;
export const LIMITE_ANNULATIONS = 50;
export const LIMITE_SAUVEGARDES = 30;
export const INTERVALLE_SAUVEGARDE_MS = 5 * 60 * 1000;
export const INTERVALLE_PING_MS = 5000;
export const PSEUDO_MAX = 16;
export const LIBELLE_MAX = 80;

export const AVATARS = ['soleil', 'lune', 'feuille', 'goutte', 'flamme', 'etoile'] as const;
export type AvatarId = (typeof AVATARS)[number];

export const COULEURS = ['#FF5B4A', '#2D9CFF', '#1FD1A0', '#9B5CFF', '#FF9A2E', '#FF6FB1'] as const;

export const JOUEURS_FICTIFS: Array<{ pseudo: string; avatar: AvatarId }> = [
  { pseudo: 'Mira', avatar: 'soleil' },
  { pseudo: 'Noé', avatar: 'lune' },
  { pseudo: 'Lina', avatar: 'feuille' },
  { pseudo: 'Sacha', avatar: 'goutte' },
];
