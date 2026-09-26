import { useEffect, useMemo, useState } from 'preact/hooks';
import { Icone } from '../commun/icones';
import './presentation.css';

type Phase = 'etoiles' | 'pieces' | 'impact' | 'reflet' | 'sousTitre' | 'repos';

const ETOILES = [
  { x: 12, y: 18, d: 0 },
  { x: 78, y: 12, d: 120 },
  { x: 22, y: 72, d: 240 },
  { x: 88, y: 64, d: 80 },
  { x: 48, y: 28, d: 200 },
  { x: 64, y: 80, d: 40 },
  { x: 34, y: 48, d: 160 },
  { x: 8, y: 52, d: 280 },
];

const PIECES = [
  { x: -40, y: -28, delay: 0 },
  { x: 42, y: -32, delay: 60 },
  { x: -48, y: 18, delay: 120 },
  { x: 46, y: 22, delay: 180 },
  { x: 0, y: -38, delay: 90 },
  { x: -28, y: 34, delay: 150 },
  { x: 30, y: 36, delay: 30 },
  { x: 8, y: 8, delay: 210 },
];

function attendre(ms: number, signal: { stop: boolean }): Promise<void> {
  return new Promise((resoudre) => {
    const debut = performance.now();
    const tick = () => {
      if (signal.stop) {
        resoudre();
        return;
      }
      if (performance.now() - debut >= ms) {
        resoudre();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

function echelleEntiere(source: number, plafond: number): number {
  if (source <= 0) return plafond;
  if (source <= plafond) return Math.max(1, Math.floor(plafond / source)) * source;
  return Math.max(1, Math.round((plafond / source) * source));
}

export function LogoGp({
  classe,
  plafond,
  alt,
}: {
  classe?: string;
  plafond: number;
  alt: string;
}) {
  const [taille, setTaille] = useState<{ w: number; h: number } | null>(null);
  return (
    <img
      class={`logo-gp ${classe ?? ''}`.trim()}
      src="/assets/logo.png"
      alt={alt}
      width={taille?.w}
      height={taille?.h}
      onLoad={(event) => {
        const img = event.currentTarget;
        const sw = img.naturalWidth || 1;
        const sh = img.naturalHeight || 1;
        const maxCote = Math.max(sw, sh);
        const cible = echelleEntiere(maxCote, plafond);
        const facteur = cible / maxCote;
        setTaille({ w: Math.max(1, Math.round(sw * facteur)), h: Math.max(1, Math.round(sh * facteur)) });
      }}
    />
  );
}

export function PresentationTv({
  presentationId,
  sousTitre,
  reduit,
  vitesse,
}: {
  presentationId: number;
  sousTitre: string;
  reduit: boolean;
  vitesse: number;
}) {
  const [phase, setPhase] = useState<Phase>(reduit ? 'repos' : 'etoiles');
  const [lettres, setLettres] = useState(0);
  const [flash, setFlash] = useState(false);
  const texte = sousTitre.trim();

  const duree = useMemo(() => (ms: number) => Math.max(16, Math.round(ms / Math.max(0.25, vitesse))), [vitesse]);

  useEffect(() => {
    const signal = { stop: false };
    setLettres(0);
    setFlash(false);
    if (reduit) {
      setPhase('repos');
      return () => {
        signal.stop = true;
      };
    }
    void (async () => {
      setPhase('etoiles');
      await attendre(duree(1400), signal);
      if (signal.stop) return;
      setPhase('pieces');
      await attendre(duree(1600), signal);
      if (signal.stop) return;
      setPhase('impact');
      await attendre(duree(700), signal);
      if (signal.stop) return;
      setFlash(true);
      await attendre(duree(100), signal);
      setFlash(false);
      await attendre(duree(200), signal);
      if (signal.stop) return;
      setPhase('reflet');
      await attendre(duree(1200), signal);
      if (signal.stop) return;
      if (texte) {
        setPhase('sousTitre');
        for (let i = 1; i <= texte.length; i += 1) {
          if (signal.stop) return;
          setLettres(i);
          await attendre(duree(45), signal);
        }
        await attendre(duree(400), signal);
      }
      if (signal.stop) return;
      setPhase('repos');
    })();
    return () => {
      signal.stop = true;
    };
  }, [presentationId, reduit, duree, texte]);

  const classes = ['presentation', `phase-${phase}`];
  if (reduit) classes.push('presentation-reduite');
  if (flash) classes.push('avec-flash');

  return (
    <section class={classes.join(' ')} data-ecran="presentation" data-phase={phase} data-panneau="principal">
      <div class="presentation-fond" aria-hidden="true" />
      <div class="presentation-etoiles" aria-hidden="true">
        {ETOILES.map((etoile, index) => (
          <span
            key={index}
            class="presentation-etoile"
            style={{ left: `${etoile.x}%`, top: `${etoile.y}%`, animationDelay: `${etoile.d}ms` }}
          />
        ))}
      </div>
      <div class="presentation-pieces" aria-hidden="true">
        {PIECES.map((piece, index) => (
          <span
            key={index}
            class="presentation-piece"
            style={{
              transform: `translate(${piece.x}vw, ${piece.y}vh) rotate(0deg)`,
              animationDelay: `${piece.delay}ms`,
            }}
          >
            <Icone nom="gp-piece" taille={64} />
          </span>
        ))}
      </div>
      <div class="presentation-centre">
        <div class="presentation-logo-bloc">
          <LogoGp classe="presentation-logo" plafond={900} alt="GP exploiteur" />
          <span class="presentation-reflet" aria-hidden="true" />
        </div>
        {texte ? (
          <p class="presentation-sous-titre" aria-live="polite">
            {texte.slice(0, lettres)}
          </p>
        ) : null}
      </div>
      <div class="presentation-flash" aria-hidden="true" />
    </section>
  );
}
