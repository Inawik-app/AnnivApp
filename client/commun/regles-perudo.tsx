import type { ComponentChildren } from 'preact';
import { LIGNES_REGLES_PERUDO } from '../../shared/perudo';

function Ligne({ texte }: { texte: string }) {
  const parts: ComponentChildren[] = [];
  const motif = /\*\*(.+?)\*\*/g;
  let dernier = 0;
  let match: RegExpExecArray | null;
  while ((match = motif.exec(texte)) !== null) {
    if (match.index > dernier) parts.push(texte.slice(dernier, match.index));
    parts.push(<strong key={match.index}>{match[1]}</strong>);
    dernier = match.index + match[0].length;
  }
  if (dernier < texte.length) parts.push(texte.slice(dernier));
  return <li class="regle-perudo-ligne">{parts}</li>;
}

/** Texte exact de `LIGNES_REGLES_PERUDO`, en Baloo 2. */
export function ReglesPerudo({ className = '' }: { className?: string }) {
  return (
    <ul class={`regles-perudo ${className}`.trim()}>
      {LIGNES_REGLES_PERUDO.map((ligne) => (
        <Ligne key={ligne} texte={ligne} />
      ))}
    </ul>
  );
}
