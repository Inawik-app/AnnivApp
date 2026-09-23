export const SCHEMA = 1;
export const LIMITE_EVENEMENTS = 300;
export const LIMITE_ANNULATIONS = 50;
export const LIMITE_SAUVEGARDES = 30;
export const INTERVALLE_SAUVEGARDE_MS = 5 * 60 * 1000;
export const INTERVALLE_PING_MS = 5000;
export const PSEUDO_MAX = 20;
export const LIBELLE_MAX = 80;

export const AVATARS = [
  'perso-carpe',
  'perso-verre-eau',
  'perso-piment',
  'perso-planete',
  'perso-appareil-photo',
  'perso-chocolatine',
  'perso-sac-rando',
  'perso-cerveau',
] as const;
export type AvatarId = (typeof AVATARS)[number];

export const COULEURS = ['#FF5B4A', '#2D9CFF', '#1FD1A0', '#9B5CFF', '#FF9A2E', '#FF6FB1'] as const;

export const JOUEURS_FICTIFS: Array<{ pseudo: string; avatar: AvatarId }> = [
  { pseudo: 'Mira', avatar: 'perso-carpe' },
  { pseudo: 'Noé', avatar: 'perso-verre-eau' },
  { pseudo: 'Lina', avatar: 'perso-piment' },
  { pseudo: 'Sacha', avatar: 'perso-planete' },
];
