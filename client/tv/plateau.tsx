import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { CourseVue, EvenementVue, JoueurPublic } from '../../shared/types';
import { Avatar, CompteurRouleaux, Piece, Tuile } from '../commun/composants';
import { useFlip } from '../commun/flip';
import { initiale, libelleRang } from '../commun/spectacle';
import { sons } from '../commun/sons';
import './plateau.css';

const ECART = 20;
const MARGE = 8;

export type Grille = {
  colonnes: number;
  rangees: number;
  taille: number;
  cases: Array<{ x: number; y: number }>;
  chemin: string;
};

export function meilleureGrille(nombre: number, largeur: number, hauteur: number): Grille {
  if (nombre <= 0 || largeur <= 0 || hauteur <= 0) {
    return { colonnes: 1, rangees: 1, taille: 0, cases: [], chemin: '' };
  }
  let colonnes = 1;
  let rangees = nombre;
  let taille = 0;
  const utileL = Math.max(0, largeur - 2 * MARGE);
  const utileH = Math.max(0, hauteur - 2 * MARGE);
  for (let cols = 1; cols <= Math.max(1, nombre); cols += 1) {
    const rows = Math.ceil(nombre / cols);
    const cote = Math.floor(Math.min((utileL - (cols - 1) * ECART) / cols, (utileH - (rows - 1) * ECART) / rows));
    if (cote > taille) {
      taille = cote;
      colonnes = cols;
      rangees = rows;
    }
  }
  const cases: Array<{ x: number; y: number }> = [];
  const grilleL = colonnes * taille + Math.max(0, colonnes - 1) * ECART;
  const grilleH = rangees * taille + Math.max(0, rangees - 1) * ECART;
  const origineX = (largeur - grilleL) / 2;
  const origineY = (hauteur - grilleH) / 2;
  for (let index = 0; index < nombre; index += 1) {
    const rangee = Math.floor(index / colonnes);
    const place = index % colonnes;
    const colonne = rangee % 2 === 0 ? place : colonnes - 1 - place;
    cases.push({
      x: origineX + colonne * (taille + ECART),
      y: origineY + (rangees - 1 - rangee) * (taille + ECART),
    });
  }
  return {
    colonnes,
    rangees,
    taille: Math.max(0, taille),
    cases,
    chemin: cases.map((c) => `${c.x + taille / 2},${c.y + taille / 2}`).join(' '),
  };
}

function slotsPions(taille: number): { pion: number; numero: number; slots: Array<{ x: number; y: number }> } {
  const numero = Math.max(56, Math.floor(taille * 0.16));
  const marge = Math.max(4, Math.floor(taille * 0.04));
  const plafond = numero + 16;
  const pion = Math.max(
    12,
    Math.min(Math.floor(taille * 0.4), Math.floor((taille - 2 * marge - 2) / 2), Math.floor((taille - plafond - marge - 2) / 2)),
  );
  const bloc = 2 * pion + 2;
  const x0 = Math.max(marge, Math.floor((taille - bloc) / 2));
  const y0 = Math.max(plafond, taille - marge - bloc);
  return {
    pion,
    numero,
    slots: [
      { x: x0, y: y0 },
      { x: x0 + pion + 2, y: y0 },
      { x: x0, y: y0 + pion + 2 },
      { x: x0 + pion + 2, y: y0 + pion + 2 },
    ],
  };
}

function nomJoueur(joueurs: readonly JoueurPublic[], id: string | null): string | null {
  if (!id) return null;
  return joueurs.find((joueur) => joueur.id === id)?.pseudo ?? null;
}

function titreCourse(course: CourseVue, joueurs: readonly JoueurPublic[]): string {
  if (course.phase === 'preparation') return 'Le plateau est prêt';
  if (course.phase === 'choixMiniJeu') {
    const qui = nomJoueur(joueurs, course.choisitId);
    return qui ? `${qui} choisit le mini-jeu` : 'Choix du mini-jeu';
  }
  if (course.phase === 'miniJeu') return course.miniJeu ?? 'Mini-jeu';
  if (course.phase === 'finTour') return 'Fin du tour';
  if (course.phase === 'terminee') return 'Course terminée';
  const courant = nomJoueur(joueurs, course.joueurCourantId);
  if (courant && course.etape === 'cadeau') return `${courant} choisit un cadeau`;
  if (courant && course.etape === 'duel') return `${courant} est en duel`;
  if (courant) return `À ${courant} de jouer`;
  return 'Déplacements';
}

function Icone({ type }: { type: string }) {
  if (type === 'bonus') {
    return (
      <svg class="icone-case" viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r="26" fill="#FFF6E4" stroke="#1C1633" strokeWidth="7" />
        <circle cx="32" cy="32" r="12" fill="#E39B00" stroke="#1C1633" strokeWidth="6" />
      </svg>
    );
  }
  if (type === 'chance') {
    return (
      <svg class="icone-case" viewBox="0 0 64 64" aria-hidden="true">
        <path d="M18 28c0-10 8-18 16-18s14 6 14 14c0 10-12 11-12 20" fill="none" stroke="#1C1633" strokeWidth="8" strokeLinecap="round" />
        <circle cx="36" cy="52" r="5" fill="#1C1633" />
      </svg>
    );
  }
  if (type === 'cagnotte') {
    return (
      <svg class="icone-case" viewBox="0 0 64 64" aria-hidden="true">
        <rect x="6" y="22" width="52" height="32" rx="8" fill="#FFC21A" stroke="#1C1633" strokeWidth="8" />
        <path d="M14 22 V12 H50 V22" fill="none" stroke="#1C1633" strokeWidth="8" />
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
        <path d="M14 56 V8 H50 L40 24 L50 38 H14" fill="#FF5B4A" stroke="#1C1633" strokeWidth="8" />
      </svg>
    );
  }
  return (
    <svg class="icone-case" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="22" fill="none" stroke="#1C1633" strokeWidth="8" />
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

function De3D({ valeur, reduit, boost }: { valeur: number; reduit: boolean; boost: number }) {
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
      {boost > 0 ? <div class="de-halo" style={{ opacity: boost }} /> : null}
      <div class={reduit ? 'de pose' : 'de'} style={{ transform: pose ? (ROTATION[valeur] ?? ROTATION[1]) : 'rotateX(540deg) rotateY(540deg)' }}>
        {faces.map((face) => (
          <div key={face.valeur} class="de-face" style={{ transform: face.transform }}>
            <FaceDe valeur={face.valeur} />
          </div>
        ))}
      </div>
    </div>
  );
}

export type Spectacle =
  | { type: 'de'; valeur: number; mise: number; miseMax: number }
  | { type: 'effet'; titre: string; texte: string }
  | { type: 'arrivee'; pseudo: string; rang: number }
  | { type: 'duel'; titre: string; texte: string }
  | { type: 'annonce'; texte: string }
  | { type: 'podium'; lignes: Array<{ joueurId: string; pseudo: string; montant: number; rang: number | null }> };

function palier(px: number, plancher = 40): number {
  const vise = Math.max(plancher, px);
  return [32, 40, 48, 64, 96, 128].find((cran) => cran >= vise) ?? 128;
}

function PseudoFiche({ pseudo }: { pseudo: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    for (const taille of [48, 40]) {
      el.style.fontSize = `${taille}px`;
      if (el.scrollWidth <= el.clientWidth + 1) return;
    }
  }, [pseudo]);
  return (
    <p class="pseudo-fiche" ref={ref}>
      {pseudo}
    </p>
  );
}

function FicheJoueur({
  joueur,
  position,
  courant,
  ensuite,
  coche,
  rang,
  signature,
  animer,
  reduit,
}: {
  joueur: JoueurPublic;
  position: number;
  courant: boolean;
  ensuite: boolean;
  coche: boolean;
  rang: number | null;
  signature: string;
  animer: { current: boolean };
  reduit: boolean;
}) {
  const ref = useFlip(joueur.id, signature, animer);
  return (
    <div ref={ref} class="socle-pixel fiche-socle">
    <div class={courant ? 'fiche-joueur courant' : 'fiche-joueur'} style={courant ? { borderColor: joueur.couleur } : undefined}>
      {coche ? (
        <svg class="coche" viewBox="0 0 64 64" aria-hidden="true">
          <path d="M12 34 L26 48 L52 16" fill="none" stroke="#FFF4DC" strokeWidth="8" />
        </svg>
      ) : null}
      <div class="fiche-ligne">
        <Avatar avatar={joueur.avatar} couleur={joueur.couleur} pseudo={joueur.pseudo} taille={48} plancher={40} />
        <div class="fiche-texte">
          <p class="case-fiche">Case {position}</p>
          {ensuite ? <p class="ensuite">Ensuite</p> : null}
          {rang !== null ? <p class="ensuite">Arrivé {libelleRang(rang)}</p> : null}
        </div>
        <CompteurRouleaux valeur={joueur.gpVisibles} duree={reduit ? 150 : 700} taille={40} />
      </div>
      <PseudoFiche pseudo={joueur.pseudo} />
    </div>
    </div>
  );
}

function TuileCagnotte({ valeur, reduit }: { valeur: number; reduit: boolean }) {
  const avant = useRef(valeur);
  const [vol, setVol] = useState<'entre' | 'sort' | null>(null);
  useEffect(() => {
    if (valeur === avant.current) return;
    setVol(valeur > avant.current ? 'entre' : 'sort');
    avant.current = valeur;
    const timer = window.setTimeout(() => setVol(null), reduit ? 160 : 800);
    return () => window.clearTimeout(timer);
  }, [valeur, reduit]);
  return (
    <div class="cagnotte-colonne" data-zone="cagnotte">
      <Tuile>
        <p class="libelle-cagnotte">Cagnotte</p>
        <div class="cagnotte-ligne">
          <CompteurRouleaux valeur={valeur} duree={reduit ? 150 : 700} taille={96} />
        </div>
      </Tuile>
      {vol ? (
        <div class="pieces-cagnotte" aria-hidden="true">
          <span class={reduit ? 'piece-vol fondu' : 'piece-vol'}><Piece taille={40} /></span>
          <span class={reduit ? 'piece-vol fondu' : 'piece-vol'}><Piece taille={40} /></span>
        </div>
      ) : null}
    </div>
  );
}

export function PlateauTv({
  course,
  joueurs,
  positions,
  cagnotte,
  spectacle,
  brassage,
  reduit,
  aLance,
}: {
  course: CourseVue;
  joueurs: JoueurPublic[];
  positions: Record<string, number>;
  cagnotte: number;
  spectacle: Spectacle | null;
  brassage: string[] | null;
  reduit: boolean;
  aLance: boolean;
}) {
  const animerFiches = useRef(false);
  useEffect(() => {
    animerFiches.current = true;
  }, []);
  const zoneRef = useRef<HTMLDivElement>(null);
  const [boite, setBoite] = useState({ largeur: 0, hauteur: 0 });
  useEffect(() => {
    const zone = zoneRef.current;
    if (!zone) return;
    const lire = () => {
      const largeur = zone.clientWidth;
      const hauteur = zone.clientHeight;
      setBoite((precedent) => (precedent.largeur === largeur && precedent.hauteur === hauteur ? precedent : { largeur, hauteur }));
    };
    lire();
    const observateur = new ResizeObserver(lire);
    observateur.observe(zone);
    return () => observateur.disconnect();
  }, []);
  const ordre = brassage ?? course.ordre;
  const signature = ordre.join('|');
  const grille = meilleureGrille(course.disposition.length, boite.largeur, boite.hauteur);
  const places = slotsPions(grille.taille);
  const haloId = course.joueurCourantId;
  const joueurBandeau = nomJoueur(joueurs, course.joueurCourantId);
  const enDeplacement = course.phase === 'deplacements' && joueurBandeau !== null;
  const miseVisible = spectacle?.type === 'de' ? spectacle.mise : null;
  const titre = titreCourse(course, joueurs);
  const detail = miseVisible !== null
    ? miseVisible > 0
      ? `Mise : ${miseVisible} GP, dé boosté`
      : 'Mise : 0 GP'
    : enDeplacement && course.etape === 'lancer' && !aLance && joueurBandeau
      ? `${joueurBandeau} choisit sa mise…`
      : null;
  const boost = spectacle?.type === 'de' && spectacle.miseMax > 0 ? spectacle.mise / spectacle.miseMax : 0;
  const suivantId = (() => {
    if (course.phase !== 'deplacements') return null;
    for (let index = course.indexCourant + 1; index < course.ordre.length; index += 1) {
      const id = course.ordre[index];
      if (id && !course.arrivees.includes(id)) return id;
    }
    return null;
  })();

  return (
    <section class="plateau-scene" data-panneau="principal" data-ecran="plateau">
      <div class="colonne-fiches" data-zone="fiches">
        {ordre.map((id) => {
          const joueur = joueurs.find((candidat) => candidat.id === id);
          if (!joueur) return null;
          const index = course.ordre.indexOf(id);
          const arrive = course.arrivees.includes(id);
          return (
            <FicheJoueur
              key={id}
              joueur={joueur}
              position={positions[id] ?? 0}
              courant={id === haloId && course.phase === 'deplacements'}
              ensuite={id === suivantId}
              coche={course.phase === 'deplacements' && index >= 0 && index < course.indexCourant && !arrive}
              rang={arrive ? course.arrivees.indexOf(id) + 1 : null}
              signature={signature}
              animer={animerFiches}
              reduit={reduit}
            />
          );
        })}
      </div>

      <div class="milieu">
        <header class="entete-plateau" data-zone="entete">
          <h2>{titre}</h2>
          {detail ? <p>{detail}</p> : null}
        </header>
        <div class="zone-plateau" data-zone="plateau" ref={zoneRef}>
          {grille.taille > 0 ? (
            <div class="monde">
              <svg class="sentier" width={boite.largeur} height={boite.hauteur} aria-hidden="true">
                <polyline class="route-encre" points={grille.chemin} />
                <polyline class="route-carton" points={grille.chemin} />
              </svg>
              {course.disposition.map((type, index) => {
                const point = grille.cases[index];
                if (!point) return null;
                return (
                  <div
                    key={index}
                    class={`case-plateau case-${type}`}
                    data-case={index}
                    style={{ left: `${point.x}px`, top: `${point.y}px`, width: `${grille.taille}px`, height: `${grille.taille}px` }}
                  >
                    <div class="pastille-case">
                      <Icone type={type} />
                    </div>
                    <span
                      class="numero-case"
                      data-numero={index}
                      style={{ height: `${places.numero}px`, fontSize: `${palier(places.numero - 16)}px`, lineHeight: 1.4 }}
                    >
                      {index}
                    </span>
                  </div>
                );
              })}
              {[...joueurs]
                .sort((a, b) => (a.id === haloId ? 1 : b.id === haloId ? -1 : a.id.localeCompare(b.id)))
                .map((joueur) => {
                  const index = positions[joueur.id];
                  if (index === undefined) return null;
                  const point = grille.cases[index];
                  if (!point) return null;
                  const presents = joueurs.filter((autre) => positions[autre.id] === index).sort((a, b) => a.id.localeCompare(b.id));
                  const place = Math.max(0, presents.findIndex((autre) => autre.id === joueur.id));
                  const slot = places.slots[place] ?? places.slots[0];
                  if (!slot) return null;
                  const suivi = joueur.id === haloId;
                  return (
                    <div
                      key={joueur.id}
                      class={reduit ? 'pion-ancre reduit' : suivi ? 'pion-ancre suivi' : 'pion-ancre'}
                      style={{ width: `${places.pion}px`, height: `${places.pion}px`, transform: `translate(${point.x + slot.x}px, ${point.y + slot.y}px)`, zIndex: suivi ? 3 : 2 }}
                    >
                      {suivi ? <span class="halo-pion" style={{ background: joueur.couleur }} /> : null}
                      <span
                        key={`${joueur.id}-${index}`}
                        class={reduit ? 'pion fondu' : 'pion'}
                        data-sur-case={index}
                        style={{ background: joueur.couleur, fontSize: `${palier(Math.floor(places.pion * 0.42))}px`, lineHeight: 1.4 }}
                      >
                        {initiale(joueur.pseudo)}
                      </span>
                    </div>
                  );
                })}
            </div>
          ) : null}
          {spectacle ? (
            <div class="spectacle">
              {spectacle.type === 'de' ? <De3D valeur={spectacle.valeur} reduit={reduit} boost={boost} /> : null}
              {spectacle.type === 'effet' ? (
                <div class="carte-effet">
                  <h2>{spectacle.titre}</h2>
                  <p>{spectacle.texte}</p>
                </div>
              ) : null}
              {spectacle.type === 'arrivee' ? (
                <div class="annonce-arrivee">
                  <h2>{spectacle.pseudo}</h2>
                  <p>arrive {libelleRang(spectacle.rang)}</p>
                </div>
              ) : null}
              {spectacle.type === 'duel' ? (
                <div class="panneau-duel">
                  <h2>{spectacle.titre}</h2>
                  {spectacle.texte ? <p>{spectacle.texte}</p> : null}
                </div>
              ) : null}
              {spectacle.type === 'annonce' ? (
                <div class="annonce-arrivee">
                  <h2>{spectacle.texte}</h2>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div class="colonne-droite">
        <TuileCagnotte valeur={cagnotte} reduit={reduit} />
      </div>
    </section>
  );
}

type ApiPlateau = {
  reduit: boolean;
  pseudo: (id: string) => string;
  setPositions: (valeur: Record<string, number> | ((precedent: Record<string, number>) => Record<string, number>)) => void;
  setCagnotte: (valeur: number) => void;
  ajouterCagnotte: (delta: number) => void;
  setSpectacle: (valeur: Spectacle | null) => void;
  setBrassage: (ordre: string[] | null) => void;
  ajusterSolde: (joueurId: string, delta: number) => void;
  attendre: (ms: number) => Promise<void>;
  segment: (etape: string, travail: () => Promise<void>) => Promise<void>;
  marquer: (etape: string) => void;
  miseMax: number;
};

function nombre(valeur: unknown): number | null {
  return typeof valeur === 'number' ? valeur : null;
}

function texte(valeur: unknown): string | null {
  return typeof valeur === 'string' ? valeur : null;
}

function carteEffet(api: ApiPlateau, titre: string, texteCarte: string, duree: number): Promise<void> {
  return api.segment('effet', async () => {
    api.setSpectacle({ type: 'effet', titre, texte: texteCarte });
    await api.attendre(duree);
    api.setSpectacle(null);
  });
}

export async function animerPlateau(evenement: EvenementVue, api: ApiPlateau): Promise<boolean> {
  const id = texte(evenement.donnees.joueurId);
  const duree = api.reduit ? 150 : 700;
  if (evenement.type === 'ordre.tire') {
    const ordre = Array.isArray(evenement.donnees.ordre) ? evenement.donnees.ordre.filter((item): item is string => typeof item === 'string') : [];
    if (ordre.length === 0) return true;
    await api.segment('tirage', async () => {
      const melange = ordre.length > 1 ? [...ordre.slice(1), ordre[0]!] : ordre;
      api.setBrassage(melange);
      await api.attendre(api.reduit ? 80 : 450);
      api.setBrassage(ordre);
      await api.attendre(api.reduit ? 80 : 600);
      api.setSpectacle({ type: 'annonce', texte: evenement.libelle });
      await api.attendre(duree);
      api.setSpectacle(null);
      api.setBrassage(null);
    });
    return true;
  }
  if (evenement.type === 'de.lance') {
    const valeur = nombre(evenement.donnees.valeur);
    if (valeur === null) return true;
    const mise = nombre(evenement.donnees.mise) ?? 0;
    await api.segment('de', async () => {
      sons().jouer('de');
      api.marquer('de');
      if (evenement.donnees.usage === 'deplacement' && id && mise > 0) {
        api.ajusterSolde(id, -mise);
        api.ajouterCagnotte(mise);
      }
      api.setSpectacle({ type: 'de', valeur, mise, miseMax: api.miseMax });
      await api.attendre(api.reduit ? 150 : 1000);
      api.marquer('de-arrete');
      await api.attendre(api.reduit ? 40 : 800);
      api.setSpectacle(null);
    });
    return true;
  }
  if (evenement.type === 'pion.avance' && id) {
    const cases = Array.isArray(evenement.donnees.cases) ? evenement.donnees.cases.filter((item): item is number => typeof item === 'number') : [];
    await api.segment('sauts', async () => {
      api.setSpectacle(null);
      for (const caseIndex of cases) {
        api.marquer('saut');
        api.setPositions((precedent) => ({ ...precedent, [id]: caseIndex }));
        if (!api.reduit) await api.attendre(250);
      }
      api.marquer('pion-arrive');
      await api.attendre(api.reduit ? 40 : 800);
    });
    return true;
  }
  if (evenement.type === 'case.bonus') {
    sons().jouer('gain');
    await carteEffet(api, `+${nombre(evenement.donnees.montant) ?? 0}`, 'Case bonus', duree);
    return true;
  }
  if (evenement.type === 'case.cagnotte') {
    const montant = nombre(evenement.donnees.montant) ?? 0;
    const reste = nombre(evenement.donnees.reste);
    await carteEffet(api, montant > 0 ? `+${montant}` : 'Vide', montant > 0 ? 'La cagnotte se partage' : 'La cagnotte est vide', duree);
    if (reste !== null) {
      await api.segment('gp', async () => {
        api.setCagnotte(reste);
        await api.attendre(duree);
      });
    }
    return true;
  }
  if (evenement.type === 'case.chance') {
    await carteEffet(api, texte(evenement.donnees.titre) ?? 'Chance', texte(evenement.donnees.texte) ?? '', duree);
    return true;
  }
  if (evenement.type === 'joueur.arrive') {
    sons().jouer('victoire');
    await api.segment('arrivee', async () => {
      api.setSpectacle({ type: 'arrivee', pseudo: api.pseudo(id ?? ''), rang: nombre(evenement.donnees.rang) ?? 1 });
      await api.attendre(duree);
      api.setSpectacle(null);
    });
    return true;
  }
  if (evenement.type === 'duel.annonce' || evenement.type === 'duel.adversaire' || evenement.type === 'duel.resultat') {
    await api.segment('duel', async () => {
      api.setSpectacle({ type: 'duel', titre: evenement.libelle, texte: texte(evenement.donnees.defi) ?? '' });
      await api.attendre(duree);
      api.setSpectacle(null);
    });
    return true;
  }
  if (evenement.type === 'duel.reveles') {
    const brut = evenement.donnees.mises;
    await api.segment('duel', async () => {
      sons().jouer('revelation');
      api.setSpectacle({ type: 'duel', titre: 'Les mises du duel', texte: evenement.libelle });
      await api.attendre(duree);
      api.setSpectacle(null);
    });
    await api.segment('gp', async () => {
      if (Array.isArray(brut)) {
        for (const entree of brut) {
          if (!entree || typeof entree !== 'object') continue;
          const mise = entree as { joueurId?: unknown; montant?: unknown };
          if (typeof mise.joueurId === 'string' && typeof mise.montant === 'number') api.ajusterSolde(mise.joueurId, -mise.montant);
        }
      }
      await api.attendre(duree);
    });
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
    evenement.type === 'duel.mise' ||
    evenement.type === 'duel.defi'
  ) {
    if (evenement.type === 'position.corrigee' && id) {
      const vers = nombre(evenement.donnees.vers);
      if (vers !== null) api.setPositions((precedent) => ({ ...precedent, [id]: vers }));
    }
    if (api.reduit) await api.attendre(150);
    return true;
  }
  return false;
}
