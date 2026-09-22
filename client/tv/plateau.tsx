import { useEffect, useRef, useState } from 'preact/hooks';
import type { CourseVue, EvenementVue, JoueurPublic } from '../../shared/types';
import { Avatar, CompteurRouleaux, Piece, Tuile } from '../commun/composants';
import { textePhase } from '../commun/course-texte';
import { attendre } from '../commun/file-animations';
import { useFlip } from '../commun/flip';
import { initiale, libelleRang } from '../commun/spectacle';
import { sons } from '../commun/sons';
import './plateau.css';

const PAR_LIGNE = [9, 9, 9, 8];
const Y_LIGNE = [0, 96, 392, 488];

export type Spectacle =
  | { type: 'de'; valeur: number }
  | { type: 'effet'; titre: string; texte: string }
  | { type: 'arrivee'; pseudo: string; rang: number }
  | { type: 'duel'; titre: string; texte: string }
  | { type: 'reveal'; cartes: Array<{ joueurId: string; pseudo: string; montant: number; ordre: number }>; ouverte: boolean; rangee: boolean; pieces: boolean };

export function coordonnee(index: number): { x: number; y: number } {
  let reste = index;
  let ligne = 0;
  while (ligne < PAR_LIGNE.length && reste >= (PAR_LIGNE[ligne] ?? 0)) {
    reste -= PAR_LIGNE[ligne] ?? 0;
    ligne += 1;
  }
  const largeur = PAR_LIGNE[ligne] ?? 9;
  const colonne = ligne % 2 === 0 ? reste : largeur - 1 - reste;
  return { x: 20 + colonne * 186, y: Y_LIGNE[ligne] ?? 0 };
}

function Icone({ type }: { type: string }) {
  if (type === 'bonus') return <Piece taille={42} />;
  if (type === 'chance') {
    return (
      <svg class="icone-case" viewBox="0 0 64 64" aria-hidden="true">
        <path d="M22 26c0-8 6-14 14-14s12 5 12 11c0 8-10 9-10 16" fill="none" stroke="#1C1633" strokeWidth="5" strokeLinecap="round" />
        <circle cx="38" cy="50" r="3.5" fill="#1C1633" />
      </svg>
    );
  }
  if (type === 'cagnotte') {
    return (
      <svg class="icone-case" viewBox="0 0 64 64" aria-hidden="true">
        <rect x="8" y="24" width="48" height="28" rx="6" fill="#FFC21A" stroke="#1C1633" strokeWidth="4" />
        <path d="M16 24 V16 H48 V24" fill="none" stroke="#1C1633" strokeWidth="4" />
      </svg>
    );
  }
  if (type === 'duel') {
    return (
      <svg class="icone-case" viewBox="0 0 64 64" aria-hidden="true">
        <path d="M10 8h12L16 30h10L8 58l10-22H8z" fill="#1C1633" />
        <path d="M54 8H42l6 22H38l18 28-10-22h10z" fill="#1C1633" />
      </svg>
    );
  }
  if (type === 'arrivee') {
    return (
      <svg class="icone-case" viewBox="0 0 64 64" aria-hidden="true">
        <path d="M16 56 V8 H48 L40 22 L48 36 H16" fill="#FF5B4A" stroke="#1C1633" strokeWidth="4" />
      </svg>
    );
  }
  return (
    <svg class="icone-case" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="16" fill="none" stroke="#1C1633" strokeWidth="4" />
    </svg>
  );
}

function FaceDe({ valeur }: { valeur: number }) {
  const points: Record<number, Array<[number, number]>> = {
    1: [[32, 32]],
    2: [[18, 18], [46, 46]],
    3: [[18, 18], [32, 32], [46, 46]],
    4: [[18, 18], [46, 18], [18, 46], [46, 46]],
    5: [[18, 18], [46, 18], [32, 32], [18, 46], [46, 46]],
    6: [[18, 16], [46, 16], [18, 32], [46, 32], [18, 48], [46, 48]],
  };
  return (
    <svg viewBox="0 0 64 64" width="140" height="140" aria-hidden="true">
      {(points[valeur] ?? points[1]!).map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="6" fill="#1C1633" />
      ))}
    </svg>
  );
}

const ROTATION: Record<number, string> = {
  1: 'rotateX(0deg) rotateY(0deg)',
  2: 'rotateY(90deg)',
  3: 'rotateX(-90deg)',
  4: 'rotateX(90deg)',
  5: 'rotateY(-90deg)',
  6: 'rotateY(180deg)',
};

function De3D({ valeur, reduit }: { valeur: number; reduit: boolean }) {
  const [pose, setPose] = useState(reduit);
  useEffect(() => {
    if (reduit) {
      setPose(true);
      return;
    }
    setPose(false);
    const cadre = requestAnimationFrame(() => setPose(true));
    return () => cancelAnimationFrame(cadre);
  }, [reduit, valeur]);
  const faces = [
    { valeur: 1, transform: 'rotateY(0deg) translateZ(90px)' },
    { valeur: 6, transform: 'rotateY(180deg) translateZ(90px)' },
    { valeur: 2, transform: 'rotateY(-90deg) translateZ(90px)' },
    { valeur: 5, transform: 'rotateY(90deg) translateZ(90px)' },
    { valeur: 3, transform: 'rotateX(90deg) translateZ(90px)' },
    { valeur: 4, transform: 'rotateX(-90deg) translateZ(90px)' },
  ];
  return (
    <div class="de-scene">
      <div
        class={reduit ? 'de pose' : 'de'}
        style={{ transform: pose ? (ROTATION[valeur] ?? ROTATION[1]) : 'rotateX(540deg) rotateY(540deg)' }}
      >
        {faces.map((face) => (
          <div key={face.valeur} class="de-face" style={{ transform: face.transform }}>
            <FaceDe valeur={face.valeur} />
          </div>
        ))}
      </div>
    </div>
  );
}

function CarteMise({
  carte,
  ouverte,
  rangee,
}: {
  carte: { joueurId: string; pseudo: string; montant: number; ordre: number };
  ouverte: boolean;
  rangee: boolean;
}) {
  const animer = useRef(true);
  const ref = useFlip(`mise-${carte.joueurId}`, rangee ? 'ordre' : 'tas', animer);
  return (
    <div ref={ref} class={ouverte ? 'carte-mise ouverte' : 'carte-mise'}>
      <div class="flip-inner">
        <div class="face dos" />
        <div class="face devant">
          <Tuile>
            <p class="texte-tv">{carte.pseudo}</p>
            <CompteurRouleaux valeur={carte.montant} duree={0} taille={64} />
            {rangee ? <p class="rang-tv">{carte.ordre}</p> : null}
          </Tuile>
        </div>
      </div>
    </div>
  );
}

export function PlateauTv({
  course,
  joueurs,
  positions,
  cagnotte,
  spectacle,
  reduit,
  coches,
}: {
  course: CourseVue;
  joueurs: JoueurPublic[];
  positions: Record<string, number>;
  cagnotte: number;
  spectacle: Spectacle | null;
  reduit: boolean;
  coches: string[];
}) {
  const pseudos = new Map(joueurs.map((joueur) => [joueur.id, joueur.pseudo]));
  const ordre = new Map(course.ordre.map((id, index) => [id, index + 1]));
  return (
    <section>
      <div class="en-tete-course">
        <h2>{course.tour > 0 ? `Tour ${course.tour}` : 'Course'}</h2>
        <p>{textePhase(course, pseudos)}</p>
        {course.classement && course.classement.length > 0 ? (
          <p class="classement-course">
            {course.classement.map((id, index) => `${index + 1}. ${pseudos.get(id) ?? 'Joueur'}`).join(' · ')}
          </p>
        ) : null}
      </div>
      <div class="parcours">
        {course.disposition.map((type, index) => {
          const { x, y } = coordonnee(index);
          const presents = joueurs.filter((joueur) => positions[joueur.id] === index);
          return (
            <div key={index} class={`case-plateau case-${type}`} style={{ left: `${x}px`, top: `${y}px` }}>
              <Tuile className="case-interieur">
                <Icone type={type} />
                <div class="pions">
                  {presents.map((joueur, place) => (
                    <span
                      key={`${joueur.id}-${index}`}
                      class={reduit ? 'pion fondu' : 'pion'}
                      style={{ left: `${place * 18}px`, background: joueur.couleur }}
                    >
                      {initiale(joueur.pseudo)}
                    </span>
                  ))}
                </div>
              </Tuile>
            </div>
          );
        })}
        <div class="cagnotte-tv">
          <Tuile>
            <h2>Cagnotte</h2>
            <CompteurRouleaux valeur={cagnotte} duree={reduit ? 150 : 700} taille={90} />
          </Tuile>
        </div>
        {spectacle?.type === 'de' ? (
          <div class="spectacle">
            <De3D valeur={spectacle.valeur} reduit={reduit} />
          </div>
        ) : null}
        {spectacle?.type === 'effet' ? (
          <div class="spectacle">
            <div class="carte-effet">
              <h2>{spectacle.titre}</h2>
              <p class="texte-tv">{spectacle.texte}</p>
            </div>
          </div>
        ) : null}
        {spectacle?.type === 'arrivee' ? (
          <div class="spectacle">
            <div class="annonce-arrivee">
              <h2>{spectacle.pseudo} arrive {spectacle.rang === 1 ? '1er' : `${spectacle.rang}e`} !</h2>
            </div>
          </div>
        ) : null}
        {spectacle?.type === 'duel' ? (
          <div class="spectacle">
            <div class="panneau-duel">
              <h2>Duel !</h2>
              <p class="texte-tv">{spectacle.titre}</p>
              <p class="texte-tv">{spectacle.texte}</p>
            </div>
          </div>
        ) : null}
        {spectacle?.type === 'reveal' ? (
          <div class="spectacle" style={{ width: '1400px', textAlign: 'center' }}>
            {(spectacle.rangee ? [...spectacle.cartes].sort((a, b) => a.ordre - b.ordre) : spectacle.cartes).map((carte) => (
              <CarteMise key={carte.joueurId} carte={carte} ouverte={spectacle.ouverte} rangee={spectacle.rangee} />
            ))}
            {spectacle.pieces ? (
              <div class="pieces-vol" aria-hidden="true">
                {spectacle.cartes.map((carte) => (
                  <span key={carte.joueurId} class={reduit ? 'piece-vol fondu' : 'piece-vol'}>
                    <Piece taille={64} />
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <div class="bandeau-course">
        {joueurs.map((joueur) => (
          <div key={joueur.id} class={joueur.id === course.joueurCourantId ? 'fiche-course courant' : 'fiche-course'}>
            {coches.includes(joueur.id) ? (
              <svg class="coche" viewBox="0 0 64 64" aria-hidden="true">
                <path d="M12 34 L26 48 L52 16" fill="none" stroke="#1C1633" strokeWidth="8" />
              </svg>
            ) : null}
            <Avatar avatar={joueur.avatar} couleur={joueur.couleur} pseudo={joueur.pseudo} taille={56} />
            <p style={{ margin: '4px 0', fontWeight: 800 }}>{joueur.pseudo}</p>
            {ordre.has(joueur.id) ? <p style={{ margin: 0 }}>{libelleRang(ordre.get(joueur.id) ?? 1)} au passage</p> : null}
            <CompteurRouleaux valeur={joueur.gpVisibles} duree={reduit ? 150 : 700} taille={32} />
          </div>
        ))}
      </div>
    </section>
  );
}

type ApiPlateau = {
  reduit: boolean;
  pseudo: (id: string) => string;
  setPositions: (valeur: Record<string, number> | ((precedent: Record<string, number>) => Record<string, number>)) => void;
  setCagnotte: (valeur: number) => void;
  setSpectacle: (valeur: Spectacle | null) => void;
  ajusterSolde: (joueurId: string, delta: number) => void;
  setCoches: (ids: string[]) => void;
  ajouterCoche: (id: string) => void;
};

function nombre(valeur: unknown): number | null {
  return typeof valeur === 'number' ? valeur : null;
}

function texte(valeur: unknown): string | null {
  return typeof valeur === 'string' ? valeur : null;
}

export async function animerPlateau(evenement: EvenementVue, api: ApiPlateau): Promise<boolean> {
  const id = texte(evenement.donnees.joueurId);
  const duree = api.reduit ? 150 : 700;
  if (evenement.type === 'mise.posee' && id) {
    api.ajouterCoche(id);
    return true;
  }
  if (evenement.type === 'mises.revelees') {
    const brut = evenement.donnees.mises;
    const ordre = Array.isArray(evenement.donnees.ordre) ? evenement.donnees.ordre.filter((item): item is string => typeof item === 'string') : [];
    if (!Array.isArray(brut)) return true;
    const cartes = brut.flatMap((entree) => {
      if (!entree || typeof entree !== 'object') return [];
      const mise = entree as { joueurId?: unknown; montant?: unknown };
      if (typeof mise.joueurId !== 'string' || typeof mise.montant !== 'number') return [];
      return [{ joueurId: mise.joueurId, pseudo: api.pseudo(mise.joueurId), montant: mise.montant, ordre: ordre.indexOf(mise.joueurId) + 1 }];
    });
    sons().jouer('revelation');
    api.setSpectacle({ type: 'reveal', cartes, ouverte: false, rangee: false, pieces: false });
    await attendre(api.reduit ? 40 : 80);
    api.setSpectacle({ type: 'reveal', cartes, ouverte: true, rangee: false, pieces: false });
    await attendre(duree);
    api.setSpectacle({ type: 'reveal', cartes, ouverte: true, rangee: false, pieces: true });
    const total = nombre(evenement.donnees.cagnotte);
    if (total !== null) api.setCagnotte(total);
    for (const carte of cartes) api.ajusterSolde(carte.joueurId, -carte.montant);
    await attendre(duree);
    api.setSpectacle({ type: 'reveal', cartes, ouverte: true, rangee: true, pieces: false });
    await attendre(duree);
    api.setSpectacle(null);
    api.setCoches([]);
    return true;
  }
  if (evenement.type === 'de.lance') {
    const valeur = nombre(evenement.donnees.valeur);
    if (valeur === null) return true;
    sons().jouer('de');
    api.setSpectacle({ type: 'de', valeur });
    await attendre(api.reduit ? 150 : 1000);
    api.setSpectacle(null);
    return true;
  }
  if (evenement.type === 'pion.avance' && id) {
    const cases = Array.isArray(evenement.donnees.cases) ? evenement.donnees.cases.filter((item): item is number => typeof item === 'number') : [];
    for (const caseIndex of cases) {
      api.setPositions((precedent) => ({ ...precedent, [id]: caseIndex }));
      if (!api.reduit) await attendre(250);
    }
    return true;
  }
  if (evenement.type === 'case.bonus') {
    sons().jouer('gain');
    api.setSpectacle({ type: 'effet', titre: `+${nombre(evenement.donnees.montant) ?? 0}`, texte: 'Case bonus' });
    await attendre(duree);
    api.setSpectacle(null);
    return true;
  }
  if (evenement.type === 'case.cagnotte') {
    const montant = nombre(evenement.donnees.montant) ?? 0;
    const reste = nombre(evenement.donnees.reste);
    if (reste !== null) api.setCagnotte(reste);
    api.setSpectacle({
      type: 'effet',
      titre: montant > 0 ? `+${montant}` : 'Vide',
      texte: montant > 0 ? 'La cagnotte se partage' : 'La cagnotte est vide',
    });
    await attendre(duree);
    api.setSpectacle(null);
    return true;
  }
  if (evenement.type === 'case.chance') {
    api.setSpectacle({
      type: 'effet',
      titre: texte(evenement.donnees.titre) ?? 'Chance',
      texte: texte(evenement.donnees.texte) ?? '',
    });
    await attendre(duree);
    api.setSpectacle(null);
    return true;
  }
  if (evenement.type === 'joueur.arrive') {
    sons().jouer('victoire');
    api.setSpectacle({
      type: 'arrivee',
      pseudo: api.pseudo(id ?? ''),
      rang: nombre(evenement.donnees.rang) ?? 1,
    });
    await attendre(duree);
    api.setSpectacle(null);
    return true;
  }
  if (evenement.type === 'duel.annonce' || evenement.type === 'duel.adversaire' || evenement.type === 'duel.resultat') {
    api.setSpectacle({
      type: 'duel',
      titre: evenement.libelle,
      texte: texte(evenement.donnees.defi) ?? '',
    });
    await attendre(duree);
    api.setSpectacle(null);
    return true;
  }
  if (evenement.type === 'duel.reveles') {
    sons().jouer('revelation');
    const brut = evenement.donnees.mises;
    if (Array.isArray(brut)) {
      for (const entree of brut) {
        if (!entree || typeof entree !== 'object') continue;
        const mise = entree as { joueurId?: unknown; montant?: unknown };
        if (typeof mise.joueurId === 'string' && typeof mise.montant === 'number') api.ajusterSolde(mise.joueurId, -mise.montant);
      }
    }
    api.setSpectacle({ type: 'duel', titre: 'Les mises du duel', texte: evenement.libelle });
    await attendre(duree);
    api.setSpectacle(null);
    return true;
  }
  if (
    evenement.type === 'course.demarree' ||
    evenement.type === 'plateau.regenere' ||
    evenement.type === 'tour.nouveau' ||
    evenement.type === 'minijeu.annonce' ||
    evenement.type === 'minijeu.choisi' ||
    evenement.type === 'deplacements.commences' ||
    evenement.type === 'tour.fini' ||
    evenement.type === 'course.terminee' ||
    evenement.type === 'cadeau.donne' ||
    evenement.type === 'joueur.passe' ||
    evenement.type === 'position.corrigee' ||
    evenement.type === 'mises.cloturees' ||
    evenement.type === 'duel.mise' ||
    evenement.type === 'duel.defi'
  ) {
    if (evenement.type === 'position.corrigee' && id) {
      const vers = nombre(evenement.donnees.vers);
      if (vers !== null) api.setPositions((precedent) => ({ ...precedent, [id]: vers }));
    }
    if (api.reduit) await attendre(150);
    return true;
  }
  return false;
}
