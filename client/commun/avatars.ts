const fichiers = import.meta.glob('../public/assets/avatars/*.png', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

export type AvatarImage = { id: string; url: string };

export function avatarsDisponibles(): AvatarImage[] {
  return Object.entries(fichiers)
    .map(([chemin, url]) => {
      const fichier = chemin.split('/').pop() ?? chemin;
      return { id: fichier.replace(/\.png$/i, ''), url };
    })
    .filter((avatar) => avatar.id.length > 0)
    .sort((a, b) => a.id.localeCompare(b.id, 'fr'));
}

export function urlAvatar(id: string): string | null {
  return avatarsDisponibles().find((avatar) => avatar.id === id)?.url ?? null;
}
