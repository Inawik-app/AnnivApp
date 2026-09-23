import { useState } from 'preact/hooks';
import { TAILLES_ICONES, type NomIcone } from '../../shared/icones';

export function estNomIcone(valeur: string): valeur is NomIcone {
  return Object.prototype.hasOwnProperty.call(TAILLES_ICONES, valeur);
}

/** Plus grand multiple de la taille source qui tient sous le plafond. 0 si même 1× dépasse. */
export function multipleIcone(nom: NomIcone, souhaite: number, plafond = souhaite): number {
  const source = TAILLES_ICONES[nom];
  if (plafond < source) return 0;
  let cran = Math.max(1, Math.round(Math.min(souhaite, plafond) / source));
  while (cran > 1 && cran * source > plafond) cran -= 1;
  return cran * source <= plafond ? cran * source : 0;
}

export function Icone({ nom, taille, couleur }: { nom: NomIcone; taille: number; couleur?: string }) {
  const source = TAILLES_ICONES[nom];
  const [manque, setManque] = useState(false);
  const nette = taille >= source && taille % source === 0;
  const cote = Math.max(taille, source);
  if (!nette || manque) {
    return (
      <span
        class="icone icone-repli"
        data-repli="1"
        data-icone={nom}
        style={{ width: `${cote}px`, height: `${cote}px`, background: couleur ?? '#c8bda6' }}
      />
    );
  }
  return (
    <img
      class="icone"
      data-icone={nom}
      src={`/assets/icones/${nom}.png`}
      alt=""
      width={taille}
      height={taille}
      onError={() => setManque(true)}
    />
  );
}

export function IconeMiniJeu({ id, nom, taille }: { id: string; nom: string; taille: number }) {
  if (estNomIcone(id)) {
    const cote = multipleIcone(id, taille, Math.max(taille, TAILLES_ICONES[id])) || TAILLES_ICONES[id];
    return <Icone nom={id} taille={cote} />;
  }
  const lettre = nom.trim().charAt(0).toLocaleUpperCase('fr-FR') || '?';
  return (
    <svg class="icone-repli" data-repli="1" width={taille} height={taille} viewBox="0 0 64 64" aria-hidden="true">
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
