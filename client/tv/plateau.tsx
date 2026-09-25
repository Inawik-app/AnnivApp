import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { CourseVue, EvenementVue, JoueurPublic } from '../../shared/types';
import type { NomIcone } from '../../shared/icones';
import { Avatar, CompteurRouleaux, Piece, Tuile } from '../commun/composants';
import { useFlip } from '../commun/flip';
import { Icone, estNomIcone, multipleIcone } from '../commun/icones';
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

function slotsPions(taille: number, numero: number): { pion: number; numero: number; slots: Array<{ x: number; y: number }> } {
  const marge = Math.max(4, Math.floor(taille * 0.04));
  const degagement = numero + 12;
  const pion = Math.max(
    12,
    Math.min(Math.floor(taille * 0.4), Math.floor((taille - 2 * marge - 2) / 2), Math.floor((taille - degagement - marge) / 2)),
  );
  const bloc = 2 * pion + 2;
  const x0 = Math.max(marge, Math.floor((taille - bloc) / 2));
  const y0 = Math.max(degagement, taille - marge - bloc);
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
  if (courant && course.etape === 'roue') return `À ${courant} de jouer`;
  if (courant) return `À ${courant} de jouer`;
  return 'Déplacements';
}

function nomIcone(valeur: string | undefined): NomIcone | undefined {
  return valeur && estNomIcone(valeur) ? valeur : undefined;
}

function DePixel({
  valeur,
  faces,
  option,
  reduit,
}: {
  valeur: number;
  faces: number;
  option: string;
  reduit: boolean;
}) {
  const tours = Math.max(faces, 8);
  const bande = Array.from({ length: tours + 1 }, (_, index) => (index % faces) + 1);
  bande[bande.length - 1] = valeur;
  const [pose, setPose] = useState(reduit);
  useEffect(() => {
    if (reduit) {
      setPose(true);
      return;
    }
    setPose(false);
    const cadre = requestAnimationFrame(() => setPose(true));
    return () => cancelAnimationFrame(cadre);
  }, [reduit, valeur, faces]);
  return (
    <div class="de-pixel" data-de={option} data-faces={faces}>
      <div class="de-rangee">
        {Array.from({ length: faces }, (_, index) => {
          const face = index + 1;
          return (
            <span key={face} class={face >= 7 ? 'face-doree' : undefined} data-dore={face >= 7 ? '1' : undefined}>
              {face}
            </span>
          );
        })}
      </div>
      <div class="de-fenetre">
        <div
          class={reduit ? 'de-bande pose' : 'de-bande'}
          style={{
            transform: pose ? `translateY(-${(bande.length - 1) * 160}px)` : 'translateY(0px)',
            ['--pas' as string]: String(bande.length - 1),
          }}
        >
          {bande.map((face, index) => (
            <span key={index} class={face >= 7 ? 'face-doree' : undefined}>
              {face}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

type OptionRoueVue = { id: string; nom: string; probabilite: number; couleur: string; texte: string; icone?: string };

function pointRoue(angle: number, rayon: number): [number, number] {
  const radians = ((angle - 90) * Math.PI) / 180;
  return [200 + rayon * Math.cos(radians), 200 + rayon * Math.sin(radians)];
}

function RoueTv({
  rotation,
  options,
  reduit,
}: {
  rotation: number;
  options: OptionRoueVue[];
  reduit: boolean;
}) {
  const [pose, setPose] = useState(false);
  useEffect(() => {
    setPose(false);
    const cadre = requestAnimationFrame(() => setPose(true));
    return () => cancelAnimationFrame(cadre);
  }, [rotation]);
  let debut = 0;
  return (
    <div class={reduit ? 'roue-scene reduit' : 'roue-scene'} data-roue="1">
      <div class="roue-colonne">
        <div class="roue-pointeur" />
        <svg class="roue-disque" viewBox="0 0 400 400" width="520" height="520" style={{ transform: pose ? `rotate(${rotation}deg)` : 'rotate(0deg)' }}>
          {options.map((option) => {
            const angle = (option.probabilite / 100) * 360;
            const [x0, y0] = pointRoue(debut, 180);
            const [x1, y1] = pointRoue(debut + angle, 180);
            const grand = angle > 180 ? 1 : 0;
            const trace = `M 200 200 L ${x0} ${y0} A 180 180 0 ${grand} 1 ${x1} ${y1} Z`;
            const milieu = debut + angle / 2;
            const [lx, ly] = pointRoue(milieu, 110);
            debut += angle;
            return (
              <g key={option.id}>
                <path d={trace} fill={option.couleur} data-option={option.id} data-angle={angle} />
                {angle >= 48 ? (
                  <text x={lx} y={ly} fill="#fff4dc" fontSize="40" textAnchor="middle" dominantBaseline="middle">
                    {option.nom}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
      <ul class="roue-legende">
        {options.map((option) => {
          const dessin = nomIcone(option.icone);
          return (
            <li key={option.id}>
              {dessin ? <Icone nom={dessin} taille={64} /> : null}
              <span class="roue-couleur" style={{ background: option.couleur }} />
              <span>{option.nom}</span>
              <span>{option.texte}</span>
              <span>{option.probabilite} %</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export type Spectacle =
  | { type: 'de'; valeur: number; faces: number; mise: number; option: string; nom: string }
  | { type: 'effet'; titre: string; texte: string; icone?: NomIcone; sombre?: boolean }
  | { type: 'arrivee'; pseudo: string; rang: number }
  | { type: 'roue'; rotation: number; options: OptionRoueVue[]; reduit: boolean }
  | { type: 'annonce'; texte: string }
  | { type: 'podium'; lignes: Array<{ joueurId: string; pseudo: string; montant: number; rang: number | null }> };

function palier(px: number, plancher = 40): number {
  const vise = Math.max(plancher, px);
  return [32, 40, 48, 64, 96, 128].find((cran) => cran >= vise) ?? 128;
}

/** Pastille du numéro : la hauteur de son chiffre, au plus 30 % de la tuile, collée au coin. */
function mesureNumero(taille: number): { hauteur: number; fonte: number } {
  const fonte = 24;
  const contenu = Math.ceil(fonte * 1.4) + 4;
  return { hauteur: Math.max(0, Math.min(Math.floor(taille * 0.3), contenu)), fonte };
}

/** L'icône reste au moins deux fois plus haute que la pastille, sans que le chiffre soit rogné. */
function mesureCase(taille: number): { numero: { hauteur: number; fonte: number }; icone: number } {
  const numero = mesureNumero(taille);
  const icone = coteIconeCase(taille, numero.hauteur);
  if (icone === 0) return { numero, icone };
  const hauteur = Math.max(Math.min(numero.hauteur, Math.floor(icone / 2)), numero.fonte + 4);
  return { numero: { ...numero, hauteur }, icone };
}

/** Multiple de 64 le plus proche de 65 % de la tuile, sans dépasser l'espace sous le numéro. */
function coteIconeCase(taille: number, badge: number): number {
  const cible = taille * 0.65;
  const max = Math.max(0, taille - badge - 4);
  const candidats = [64, 128, 192].filter((cote) => cote <= max);
  if (candidats.length === 0) return 0;
  return candidats.reduce((retenu, cote) => (Math.abs(cote - cible) < Math.abs(retenu - cible) ? cote : retenu));
}

/** Coupe au trait d'union quand le pseudo ne tient pas à côté du numéro de case. */
function useCoupurePseudo(pseudo: string, ref: { readonly current: HTMLElement | null }): boolean {
  const [coupe, setCoupe] = useState(false);
  useLayoutEffect(() => {
    const ligne = ref.current?.querySelector('.fiche-haut .pseudo-fiche');
    if (!(ligne instanceof HTMLElement)) return;
    const sonde = document.createElement('span');
    sonde.className = 'pseudo-fiche';
    sonde.style.whiteSpace = 'nowrap';
    sonde.style.position = 'absolute';
    sonde.style.visibility = 'hidden';
    sonde.textContent = pseudo;
    document.body.appendChild(sonde);
    const largeur = sonde.getBoundingClientRect().width;
    sonde.remove();
    const index = pseudo.indexOf('-');
    setCoupe(largeur > ligne.clientWidth + 1 && index > 0 && index < pseudo.length - 1);
  }, [pseudo, ref]);
  return coupe;
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
  const corpsRef = useRef<HTMLDivElement>(null);
  const coupe = useCoupurePseudo(joueur.pseudo, corpsRef);
  const index = coupe ? joueur.pseudo.indexOf('-') : -1;
  const ligne1 = index > 0 ? joueur.pseudo.slice(0, index + 1) : joueur.pseudo;
  const ligne2 = index > 0 ? joueur.pseudo.slice(index + 1) : '';
  return (
    <div ref={ref} class="socle-pixel fiche-socle">
    <div class={courant ? 'fiche-joueur courant' : 'fiche-joueur'} style={courant ? { borderColor: joueur.couleur } : undefined}>
      {coche ? (
        <svg class="coche" viewBox="0 0 64 64" aria-hidden="true">
          <path d="M12 34 L26 48 L52 16" fill="none" stroke="#FFF4DC" strokeWidth="8" />
        </svg>
      ) : null}
      <div class="fiche-ligne">
        <Avatar avatar={joueur.avatar} couleur={joueur.couleur} pseudo={joueur.pseudo} taille={64} />
        <div class="fiche-corps" ref={corpsRef}>
          <div class="fiche-haut">
            <p class="pseudo-fiche">{ligne1}</p>
            <p class="case-fiche">n°{position}</p>
          </div>
          <div class="fiche-bas">
            {ligne2 ? <p class="pseudo-fiche">{ligne2}</p> : <span class="fiche-vide" />}
            <div class="fiche-gp">
              <CompteurRouleaux valeur={joueur.gpVisibles} duree={reduit ? 150 : 700} taille={40} />
            </div>
            {ensuite && !ligne2 ? <p class="ensuite">Ensuite</p> : null}
          </div>
          {rang !== null ? <p class="ensuite ensuite-pose">Arrivé {libelleRang(rang)}</p> : null}
        </div>
      </div>
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
          <CompteurRouleaux valeur={valeur} duree={reduit ? 150 : 700} taille={40} />
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
  const [boite, setBoite] = useState({ largeur: 0, hauteur: 0, gauche: 0 });
  useEffect(() => {
    const zone = zoneRef.current;
    if (!zone) return;
    const lire = () => {
      const largeur = zone.clientWidth;
      const hauteur = zone.clientHeight;
      // offsetLeft est relatif à .plateau-scene, calée sur le bord gauche de la scène de 1920 px.
      const gauche = zone.offsetLeft;
      setBoite((precedent) =>
        precedent.largeur === largeur && precedent.hauteur === hauteur && precedent.gauche === gauche
          ? precedent
          : { largeur, hauteur, gauche },
      );
    };
    lire();
    const observateur = new ResizeObserver(lire);
    observateur.observe(zone);
    return () => observateur.disconnect();
  }, []);
  const ordre = brassage ?? course.ordre;
  const signature = ordre.join('|');
  const cadreL = Math.min(boite.largeur, Math.round(1920 * 0.43));
  const cadreH = Math.min(boite.hauteur, Math.round(1080 * 0.8));
  const grille = meilleureGrille(course.disposition.length, cadreL, cadreH);
  const libreX = Math.max(0, boite.largeur - cadreL);
  const decalageX = Math.min(libreX, Math.max(0, 960 - boite.gauche - cadreL / 2));
  const decalageY = Math.max(0, (boite.hauteur - cadreH) / 2);
  const mesures = mesureCase(grille.taille);
  const numeroCase = mesures.numero;
  const tailleIcone = mesures.icone;
  const places = slotsPions(grille.taille, numeroCase.hauteur);
  const haloId = course.joueurCourantId;
  const joueurBandeau = nomJoueur(joueurs, course.joueurCourantId);
  const enDeplacement = course.phase === 'deplacements' && joueurBandeau !== null;
  const titre = titreCourse(course, joueurs);
  const detail = spectacle?.type === 'de'
    ? spectacle.mise > 0
      ? `lance le ${spectacle.nom} (${spectacle.mise} GP)`
      : `lance le ${spectacle.nom}`
    : enDeplacement && course.etape === 'roue'
      ? 'choisit sa mise à la roue'
      : enDeplacement && course.etape === 'lancer' && !aLance
        ? 'choisit son dé'
        : null;
  const iconesEntete: NomIcone[] = [];
  if (spectacle?.type === 'de') {
    const lancee = nomIcone(course.optionsDe.find((option) => option.id === spectacle.option)?.icone);
    if (lancee) iconesEntete.push(lancee);
  } else if (detail === 'choisit son dé') {
    for (const option of course.optionsDe) {
      const dessin = nomIcone(option.icone);
      if (dessin) iconesEntete.push(dessin);
    }
  }
  const suivantId = (() => {
    if (course.phase !== 'deplacements') return null;
    for (let index = course.indexCourant + 1; index < course.ordre.length; index += 1) {
      const id = course.ordre[index];
      if (id && !course.arrivees.includes(id)) return id;
    }
    return null;
  })();

  return (
    <section class="plateau-scene" data-ecran="plateau">
      {course.dernierTour && course.phase !== 'terminee' ? (
        <p class="bandeau-dernier-tour" data-bandeau="dernier-tour">Dernier tour !</p>
      ) : null}
      {course.coupDePouceActif ? (
        <p class="bandeau-dernier-tour" data-bandeau="coup-de-pouce">Coup de pouce !</p>
      ) : null}
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
          {iconesEntete.length > 0 ? (
            <span class="entete-des">
              {iconesEntete.map((nom) => (
                <Icone key={nom} nom={nom} taille={64} />
              ))}
            </span>
          ) : null}
          <h2>{titre}</h2>
          {detail ? <p>{detail}</p> : null}
        </header>
        <div class="zone-plateau" data-zone="plateau" ref={zoneRef}>
          {grille.taille > 0 ? (
            <div class="monde">
              <div
                class="grille-plateau"
                style={{ width: `${cadreL}px`, height: `${cadreH}px`, transform: `translate(${decalageX}px, ${decalageY}px)` }}
              >
              <svg class="sentier" width={cadreL} height={cadreH} aria-hidden="true">
                <polyline class="route-encre" points={grille.chemin} />
                <polyline class="route-carton" points={grille.chemin} />
              </svg>
              {course.disposition.map((type, index) => {
                const point = grille.cases[index];
                const nomCase = nomIcone(course.iconesCases[type]);
                if (!point) return null;
                return (
                  <div
                    key={index}
                    class={`case-plateau case-${type}`}
                    data-case={index}
                    style={{ left: `${point.x}px`, top: `${point.y}px`, width: `${grille.taille}px`, height: `${grille.taille}px` }}
                  >
                    <div class="pastille-case" style={{ paddingTop: `${numeroCase.hauteur}px` }}>
                      {nomCase && tailleIcone > 0 ? <Icone nom={nomCase} taille={tailleIcone} /> : null}
                    </div>
                    <span
                      class="numero-case"
                      data-numero={index}
                      style={{ height: `${numeroCase.hauteur}px`, fontSize: `${numeroCase.fonte}px`, lineHeight: 1.4 }}
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
                  const nomPion = estNomIcone(joueur.avatar) ? joueur.avatar : null;
                  const taillePion = nomPion ? multipleIcone(nomPion, places.pion, places.pion) : 0;
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
                        style={{
                          background: taillePion > 0 ? '#fff4dc' : joueur.couleur,
                          borderColor: joueur.couleur,
                          fontSize: `${palier(Math.floor(places.pion * 0.42))}px`,
                          lineHeight: 1.4,
                        }}
                      >
                        {nomPion && taillePion > 0 ? <Icone nom={nomPion} taille={taillePion} couleur={joueur.couleur} /> : initiale(joueur.pseudo)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
          {spectacle ? (
            <div class="spectacle">
              {spectacle.type === 'de' ? (
                <DePixel valeur={spectacle.valeur} faces={spectacle.faces} option={spectacle.option} reduit={reduit} />
              ) : null}
              {spectacle.type === 'roue' ? <RoueTv rotation={spectacle.rotation} options={spectacle.options} reduit={reduit} /> : null}
              {spectacle.type === 'effet' ? (
                <div class={spectacle.sombre ? 'carte-effet carte-malchance' : 'carte-effet'}>
                  {spectacle.icone ? <Icone nom={spectacle.icone} taille={128} /> : null}
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
};

function nombre(valeur: unknown): number | null {
  return typeof valeur === 'number' ? valeur : null;
}

function texte(valeur: unknown): string | null {
  return typeof valeur === 'string' ? valeur : null;
}

function carteEffet(
  api: ApiPlateau,
  titre: string,
  texteCarte: string,
  duree: number,
  icone?: NomIcone,
  sombre = false,
): Promise<void> {
  return api.segment('effet', async () => {
    api.setSpectacle({ type: 'effet', titre, texte: texteCarte, icone, sombre });
    await api.attendre(duree);
    api.setSpectacle(null);
  });
}

function appliquerPaiements(api: ApiPlateau, donnees: Record<string, unknown>): void {
  const paiements = donnees.paiements;
  if (!Array.isArray(paiements)) return;
  for (const entree of paiements) {
    if (!entree || typeof entree !== 'object') continue;
    const ligne = entree as { id?: unknown; montant?: unknown };
    if (typeof ligne.id === 'string' && typeof ligne.montant === 'number') api.ajusterSolde(ligne.id, ligne.montant);
  }
  const cagnotte = nombre(donnees.cagnotte);
  if (cagnotte !== null) api.setCagnotte(cagnotte);
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
    const faces = nombre(evenement.donnees.faces) ?? 6;
    const option = texte(evenement.donnees.option) ?? 'normal';
    const nom = texte(evenement.donnees.nom) ?? 'dé normal';
    await api.segment('de', async () => {
      sons().jouer('de');
      api.marquer('de');
      if (evenement.donnees.usage === 'deplacement' && id && mise > 0) {
        api.ajusterSolde(id, -mise);
        api.ajouterCagnotte(mise);
      }
      api.setSpectacle({ type: 'de', valeur, faces, mise, option, nom });
      await api.attendre(api.reduit ? 150 : 1200);
      api.marquer('de-arrete');
      await api.attendre(api.reduit ? 40 : 400);
      api.setSpectacle(null);
    });
    return true;
  }
  if ((evenement.type === 'pion.avance' || evenement.type === 'pion.recule') && id) {
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
  if (evenement.type === 'case.chance' || evenement.type === 'case.malchance') {
    const malchance = evenement.type === 'case.malchance' || evenement.donnees.famille === 'malchance';
    const iconeCarte = nomIcone(texte(evenement.donnees.icone) ?? undefined);
    await api.segment('effet', async () => {
      appliquerPaiements(api, evenement.donnees);
      api.setSpectacle({
        type: 'effet',
        titre: texte(evenement.donnees.titre) ?? (malchance ? 'Malchance' : 'Chance'),
        texte: texte(evenement.donnees.texte) ?? '',
        ...(iconeCarte ? { icone: iconeCarte } : {}),
        sombre: malchance,
      });
      await api.attendre(duree);
      api.setSpectacle(null);
    });
    return true;
  }
  if (evenement.type === 'roue.tournee') {
    const options = Array.isArray(evenement.donnees.options)
      ? evenement.donnees.options.flatMap((entree) => {
          if (!entree || typeof entree !== 'object') return [];
          const option = entree as { id?: unknown; nom?: unknown; probabilite?: unknown; couleur?: unknown; texte?: unknown; icone?: unknown };
          if (typeof option.id !== 'string' || typeof option.nom !== 'string' || typeof option.probabilite !== 'number' || typeof option.couleur !== 'string') {
            return [];
          }
          return [{
            id: option.id,
            nom: option.nom,
            probabilite: option.probabilite,
            couleur: option.couleur,
            texte: typeof option.texte === 'string' ? option.texte : '',
            ...(typeof option.icone === 'string' ? { icone: option.icone } : {}),
          }];
        })
      : [];
    const mise = nombre(evenement.donnees.mise) ?? 0;
    const cagnotte = nombre(evenement.donnees.cagnotte);
    await api.segment('roue', async () => {
      if (id && mise > 0) api.ajusterSolde(id, -mise);
      if (cagnotte !== null) api.setCagnotte(cagnotte);
      api.setSpectacle({ type: 'roue', rotation: nombre(evenement.donnees.rotation) ?? 0, options, reduit: api.reduit });
      await api.attendre(api.reduit ? 150 : 4000);
      const iconeRoue = nomIcone(texte(evenement.donnees.icone) ?? undefined);
      api.setSpectacle({
        type: 'effet',
        titre: texte(evenement.donnees.nom) ?? 'Roue',
        texte: evenement.libelle,
        ...(iconeRoue ? { icone: iconeRoue } : {}),
      });
      await api.attendre(duree);
      api.setSpectacle(null);
    });
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
  if (
    evenement.type === 'course.demarree' ||
    evenement.type === 'plateau.regenere' ||
    evenement.type === 'tour.nouveau' ||
    evenement.type === 'minijeu.annonce' ||
    evenement.type === 'minijeu.choisi' ||
    evenement.type === 'deplacements.commences' ||
    evenement.type === 'tour.fini' ||
    evenement.type === 'course.terminee' ||
    evenement.type === 'joueur.passe' ||
    evenement.type === 'position.corrigee' ||
    evenement.type === 'roue.annonce' ||
    evenement.type === 'roue.passe'
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
