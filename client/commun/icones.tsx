const fichiers = import.meta.glob('../public/assets/icones/*.{png,svg}', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

function urlIcone(id: string): string | null {
  const entree = Object.entries(fichiers).find(([chemin]) => {
    const fichier = chemin.split('/').pop() ?? chemin;
    return fichier.replace(/\.(png|svg)$/i, '') === id;
  });
  return entree ? entree[1] : null;
}

export function IconeMiniJeu({ id, nom, taille }: { id: string; nom: string; taille: number }) {
  const url = urlIcone(id);
  if (url) return <img src={url} alt="" width={taille} height={taille} />;
  const lettre = nom.trim().charAt(0).toLocaleUpperCase('fr-FR') || '?';
  return (
    <svg class="icone-repli" width={taille} height={taille} viewBox="0 0 64 64" aria-hidden="true">
      <rect x="4" y="4" width="56" height="56" rx="16" fill="#ffc21a" stroke="#1c1633" strokeWidth="4" />
      <text x="32" y="44" textAnchor="middle" fontSize="32" fontFamily="DotGothic16, sans-serif" fill="#1c1633">
        {lettre}
      </text>
    </svg>
  );
}

export function Coche({ taille = 36 }: { taille?: number }) {
  return (
    <svg class="coche" width={taille} height={taille} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="28" fill="#1f9d55" stroke="#1c1633" strokeWidth="4" />
      <path d="M18 34 l10 10 l18 -22" fill="none" stroke="#fff4dc" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
