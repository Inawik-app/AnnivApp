import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { TAILLES_ICONES } from '../../shared/icones';
import { estNomIcone, Icone, multipleIcone } from './icones';
import { initiale } from './spectacle';
import './composants.css';

export function Tuile({
  children,
  taille = 'grande',
  vide = false,
  className = '',
}: {
  children?: ComponentChildren;
  taille?: 'grande' | 'petite';
  vide?: boolean;
  className?: string;
}) {
  return (
    <div class={vide ? 'socle-pixel socle-vide' : 'socle-pixel'}>
      <div class={`tuile tuile-${taille}${vide ? ' tuile-vide' : ''} ${className}`.trim()}>{children}</div>
    </div>
  );
}

type BoutonProps = {
  children?: ComponentChildren;
  variante?: 'or' | 'danger' | 'secondaire';
  plein?: boolean;
} & Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, 'class'>;

export function Bouton({ children, variante = 'or', plein = false, type = 'button', ...reste }: BoutonProps) {
  return (
    <span class={plein ? 'bouton-socle plein' : 'bouton-socle'}>
      <button type={type} class={`bouton ${variante}`} {...reste}>
        {children}
      </button>
    </span>
  );
}

export function Avatar({
  avatar,
  couleur,
  pseudo,
  taille,
  plancher = 0,
}: {
  avatar: string;
  couleur: string;
  pseudo: string;
  taille: number;
  plancher?: number;
}) {
  if (estNomIcone(avatar)) {
    const cote = multipleIcone(avatar, taille, taille + TAILLES_ICONES[avatar]) || TAILLES_ICONES[avatar];
    return (
      <span class="avatar" data-icone={avatar} style={{ width: `${cote}px`, height: `${cote}px`, borderColor: couleur }}>
        <Icone nom={avatar} taille={cote} couleur={couleur} />
      </span>
    );
  }
  const cran = [24, 32, 40, 48, 64, 96, 128].find((valeur) => valeur >= Math.max(plancher, Math.round(taille * 0.42))) ?? 128;
  return (
    <span class="avatar" style={{ width: `${taille}px`, height: `${taille}px`, fontSize: `${cran}px`, background: couleur }}>
      {initiale(pseudo)}
    </span>
  );
}

export function Piece({ taille = 64 }: { taille?: number }) {
  const cote = multipleIcone('gp-piece', taille, Math.max(taille, TAILLES_ICONES['gp-piece'])) || TAILLES_ICONES['gp-piece'];
  return <Icone nom="gp-piece" taille={cote} />;
}

export function Couronne() {
  return <Icone nom="couronne" taille={TAILLES_ICONES.couronne} />;
}

const PAS_ROULEAU = 1.4;

function Rouleau({ chiffre, duree }: { chiffre: number; duree: number }) {
  const [index, setIndex] = useState(chiffre);
  const [anime, setAnime] = useState(false);
  const precedent = useRef(chiffre);

  useEffect(() => {
    const depart = precedent.current % 10;
    const delta = (chiffre - depart + 10) % 10;
    if (delta === 0 || duree <= 0) {
      precedent.current = chiffre;
      setAnime(false);
      setIndex(chiffre);
      return;
    }
    setAnime(false);
    setIndex(depart);
    const cadre = requestAnimationFrame(() => {
      setAnime(true);
      setIndex(depart + delta);
      precedent.current = depart + delta;
    });
    return () => cancelAnimationFrame(cadre);
  }, [chiffre, duree]);

  const bande = Array.from({ length: 20 }, (_, position) => position % 10);
  return (
    <span class="rouleau" style={{ height: `${PAS_ROULEAU}em` }} aria-hidden="true">
      <span
        class="rouleau-bande"
        style={{
          transform: `translateY(${-index * PAS_ROULEAU}em)`,
          transition: anime ? `transform calc(${duree}ms / var(--vitesse, 1)) steps(8, end)` : 'none',
        }}
      >
        {bande.map((valeur, position) => (
          <span key={position} style={{ height: `${PAS_ROULEAU}em`, lineHeight: PAS_ROULEAU }}>
            {valeur}
          </span>
        ))}
      </span>
    </span>
  );
}

export function CompteurRouleaux({
  valeur,
  duree = 700,
  taille = 96,
  className = '',
}: {
  valeur: number;
  duree?: number;
  taille?: number;
  className?: string;
}) {
  const negatif = valeur < 0;
  const chiffres = String(Math.abs(Math.trunc(valeur))).split('');
  return (
    <span class={`rouleaux ${className}`.trim()} style={{ fontSize: `${taille}px` }} aria-label={`${valeur} GP`}>
      <Piece taille={Math.round(taille * 0.72)} />
      {negatif ? <span class="rouleau-signe">−</span> : null}
      {chiffres.map((chiffre, position) => (
        <Rouleau key={`${chiffres.length - position}`} chiffre={Number(chiffre)} duree={duree} />
      ))}
    </span>
  );
}

export function GainFlottant({ montant }: { montant: number }) {
  const texte = montant > 0 ? `+${montant}` : String(montant);
  return (
    <span class="gain-flottant">
      <svg viewBox="0 0 64 64" width="72" height="72" aria-hidden="true">
        <path
          fill="#FFC21A"
          stroke="#1C1633"
          strokeWidth="3"
          d="M32 4 L39 24 H60 L43 36 L49 56 L32 44 L15 56 L21 36 L4 24 H25 Z"
        />
      </svg>
      <span>{texte}</span>
    </span>
  );
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div class="socle-pixel socle-toast" role="status">
      <p class="toast">{message}</p>
    </div>
  );
}

export function VoileConnexion({ visible, local = false }: { visible: boolean; local?: boolean }) {
  if (!visible) return null;
  return (
    <div class={local ? 'voile voile-local' : 'voile'} role="status">
      <p>Reconnexion…</p>
    </div>
  );
}
