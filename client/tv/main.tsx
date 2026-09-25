import { render } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { CourseVue, EcranTv, JoueurPublic, VueTv } from '../../shared/types';
import { avatarsDisponibles } from '../commun/avatars';
import { Avatar, Couronne, CompteurRouleaux, GainFlottant, Tuile, VoileConnexion } from '../commun/composants';
import { connecter } from '../commun/connexion';
import { useFlip } from '../commun/flip';
import { attendre, creerFile } from '../commun/file-animations';
import '../commun/polices';
import { sons } from '../commun/sons';
import {
  ecranDepuis,
  gainsSuivants,
  joueurIdDe,
  libelleRang,
  montantDe,
  actualiserPlaces,
  trierAccueil,
} from '../commun/spectacle';
import '../commun/base.css';
import { animerPlateau, PlateauTv, type Spectacle } from './plateau';
import { FinaleTv, jouerCeremonie, sceneDepuis, type SceneFinale } from './finale';
import { GrilleTv, PodiumMini, PokerTv, ReglesTv } from './mini-jeux';
import { TopTenTv, dureeRevelationTopTen } from './topten';
import { JeopardyTv } from './jeopardy';
import { UndercoverTv } from './undercover';
import { CodenamesTv } from './codenames';
import { PerudoTv, dureeRevelationPerudo } from './perudo';
import { JustOneTv, dureeRevelationJustOne } from './justone';
import { REPONDANT_HOTE } from '../../shared/topten';
import { JUSTONE_HOTE } from '../../shared/justone';
import './tv.css';

type Gain = { id: string; montant: number; cle: number };

type EtapeChrono = { evenement: string; etape: string; debut: number; fin: number };

type InstantaneCourse = {
  phase: string | null;
  cagnotte: number;
  ordre: string[];
  positions: Record<string, number>;
  gp: Record<string, number>;
};

declare global {
  interface Window {
    __chronologieAnimations?: EtapeChrono[];
    __etapeCourante?: { evenement: string; etape: string } | null;
    __etatAffiche?: InstantaneCourse;
    __etatRecu?: InstantaneCourse;
    __fileVide?: boolean;
    __sauts?: number;
  }
}

function instantane(course: CourseVue | null, joueurs: JoueurPublic[], cagnotte: number, positions: Record<string, number>): InstantaneCourse {
  return {
    phase: course?.phase ?? null,
    cagnotte,
    ordre: course ? [...course.ordre] : [],
    positions: { ...positions },
    gp: Object.fromEntries(joueurs.map((joueur) => [joueur.id, joueur.gpVisibles])),
  };
}

function collerPresence(affiches: JoueurPublic[], source: JoueurPublic[]): JoueurPublic[] {
  const parId = new Map(source.map((joueur) => [joueur.id, joueur]));
  return affiches.map((joueur) => {
    const frais = parId.get(joueur.id);
    if (!frais) return joueur;
    return { ...joueur, enLigne: frais.enLigne, avatar: frais.avatar, couleur: frais.couleur };
  });
}

function ajouterSolde(liste: JoueurPublic[], id: string, montant: number): JoueurPublic[] {
  return liste.map((joueur) => (joueur.id === id ? { ...joueur, gpVisibles: joueur.gpVisibles + montant } : joueur));
}

function etatModules(course: CourseVue | null | undefined): Partial<CourseVue> {
  if (!course) return {};
  return { ecranMini: course.ecranMini, topten: course.topten, jeopardy: course.jeopardy, undercover: course.undercover, codenames: course.codenames, perudo: course.perudo, justone: course.justone, resultatsSaisis: course.resultatsSaisis };
}

function patchCourse(course: CourseVue | null, partiel: Partial<CourseVue>): CourseVue | null {
  if (!course) return course;
  return { ...course, ...partiel };
}

function pleinEcran(): void {
  const element = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
  };
  const demande = element.requestFullscreen?.bind(element) ?? element.webkitRequestFullscreen?.bind(element);
  if (!demande) return;
  const resultat = demande() as Promise<void> | void;
  if (resultat && typeof resultat.catch === 'function') void resultat.catch(() => undefined);
}

function Confettis() {
  return (
    <div class="confettis" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
        <span
          key={index}
          class={index % 2 === 0 ? 'confetti or' : 'confetti tomate'}
          style={{ left: `${6 + index * 12}%`, animationDelay: `${index * 0.7}s` }}
        />
      ))}
    </div>
  );
}

function PlaceAccueil({
  joueur,
  retourner,
  reduit,
  gain,
}: {
  joueur: JoueurPublic;
  retourner: boolean;
  reduit: boolean;
  gain: Gain | null;
}) {
  const [revele, setRevele] = useState(!retourner || reduit);
  useEffect(() => {
    if (!retourner || reduit) {
      setRevele(true);
      return;
    }
    setRevele(false);
    const cadre = requestAnimationFrame(() => {
      requestAnimationFrame(() => setRevele(true));
    });
    return () => cancelAnimationFrame(cadre);
  }, [retourner, reduit, joueur.id]);

  const face = (
    <Tuile className="tuile-inscrit">
      <Avatar avatar={joueur.avatar} couleur={joueur.couleur} pseudo={joueur.pseudo} taille={120} />
      <p class={joueur.enLigne ? 'pseudo-tv' : 'pseudo-tv hors'}>{joueur.pseudo}</p>
      {gain && gain.id === joueur.id ? <GainFlottant key={gain.cle} montant={gain.montant} /> : null}
    </Tuile>
  );

  if (reduit) return <div class="place fondu">{face}</div>;

  return (
    <div class="place">
      <div class="flip">
        <div class={revele ? 'flip-inner revele' : 'flip-inner'}>
          <div class="face">
            <Tuile vide>
              <p class="attente">En attente…</p>
            </Tuile>
          </div>
          <div class="face face-devant">{face}</div>
        </div>
      </div>
    </div>
  );
}

function ColonneScore({
  joueur,
  premier,
  signature,
  animerFlip,
  gain,
  fondu,
  duree,
}: {
  joueur: JoueurPublic;
  premier: boolean;
  signature: string;
  animerFlip: { current: boolean };
  gain: Gain | null;
  fondu: boolean;
  duree: number;
}) {
  const ref = useFlip(joueur.id, signature, animerFlip);
  return (
    <div class={premier ? 'colonne premier' : 'colonne'} ref={ref}>
      <Tuile className={fondu ? 'tuile-score fondu' : 'tuile-score'}>
        {premier ? <Couronne /> : null}
        <p class="rang-tv">{libelleRang(joueur.place)}</p>
        <Avatar avatar={joueur.avatar} couleur={joueur.couleur} pseudo={joueur.pseudo} taille={140} />
        <p class={joueur.enLigne ? 'pseudo-tv' : 'pseudo-tv hors'}>{joueur.pseudo}</p>
        <CompteurRouleaux valeur={joueur.gpVisibles} duree={duree} taille={96} />
        {gain && gain.id === joueur.id ? <GainFlottant key={gain.cle} montant={gain.montant} /> : null}
      </Tuile>
    </div>
  );
}

function EcranTv() {
  const scene = useRef<HTMLDivElement>(null);
  const file = useRef(creerFile());
  const joueursRef = useRef<JoueurPublic[]>([]);
  const ecranRef = useRef<EcranTv>('accueil');
  const reduitRef = useRef(false);
  const dernierId = useRef(0);
  const animerFlip = useRef(false);
  const [vue, setVue] = useState<VueTv | null>(null);
  const [joueurs, setJoueurs] = useState<JoueurPublic[]>([]);
  const [ecran, setEcran] = useState<EcranTv>('accueil');
  const [phase, setPhase] = useState<'sort' | 'entre' | 'pose'>('pose');
  const [poseAnime, setPoseAnime] = useState(false);
  const [retour, setRetour] = useState<string | null>(null);
  const [gain, setGain] = useState<Gain | null>(null);
  const [fondu, setFondu] = useState<string | null>(null);
  const [connecte, setConnecte] = useState(false);
  const [transport, setTransport] = useState('hors ligne');
  const [latence, setLatence] = useState<number | null>(null);
  const [fps, setFps] = useState<number | null>(null);
  const [sonOk, setSonOk] = useState(false);
  const [courseAffichee, setCourseAffichee] = useState<CourseVue | null>(null);
  const [positions, setPositions] = useState<Record<string, number>>({});
  const [cagnotte, setCagnotte] = useState(0);
  const [spectacle, setSpectacle] = useState<Spectacle | null>(null);
  const [sceneFinale, setSceneFinale] = useState<SceneFinale | null>(null);
  const sceneFinaleRef = useRef<SceneFinale | null>(null);
  const [brassage, setBrassage] = useState<string[] | null>(null);
  const [lanceId, setLanceId] = useState<string | null>(null);
  const courseRef = useRef<CourseVue | null>(null);
  const versionRef = useRef(0);
  const serieRef = useRef(0);
  const recuRef = useRef<VueTv | null>(null);
  const positionsRef = useRef<Record<string, number>>({});
  const cagnotteRef = useRef(0);
  const chrono = useRef<EtapeChrono[]>([]);
  const etapeCourante = useRef<{ evenement: string; etape: string } | null>(null);
  const evenementCourant = useRef('');
  const debutRetard = useRef(0);
  const fileVide = useRef(true);
  const parametres = new URLSearchParams(window.location.search);
  const vitesseDemandee = Math.max(0.25, Number(parametres.get('vitesse')) || 1);
  const debug = parametres.get('debug') === '1';
  const diagForce = parametres.get('diag') === '1';

  const publier = () => {
    if (!debug) return;
    const recue = recuRef.current;
    window.__chronologieAnimations = chrono.current;
    window.__etapeCourante = etapeCourante.current;
    window.__fileVide = fileVide.current;
    window.__etatAffiche = instantane(courseRef.current, joueursRef.current, cagnotteRef.current, positionsRef.current);
    window.__etatRecu = recue
      ? instantane(recue.course, recue.joueurs, recue.course?.cagnotte ?? 0, recue.course?.positions ?? {})
      : undefined;
  };

  const facteur = () => {
    const age = debutRetard.current === 0 ? 0 : Date.now() - debutRetard.current;
    return vitesseDemandee * (age > 8000 ? 2 : 1);
  };

  const attendreAnime = (ms: number) => {
    scene.current?.style.setProperty('--vitesse', String(facteur()));
    return attendre(ms / facteur());
  };

  const marquer = (etape: string) => {
    etapeCourante.current = { evenement: evenementCourant.current, etape };
    if (debug && etape === 'saut') window.__sauts = (window.__sauts ?? 0) + 1;
    publier();
  };

  const segment = async (etape: string, travail: () => Promise<void>) => {
    const debut = performance.now();
    marquer(etape);
    await travail();
    if (debug) chrono.current.push({ evenement: evenementCourant.current, etape, debut, fin: performance.now() });
    if (etapeCourante.current?.etape === etape) etapeCourante.current = null;
    publier();
  };

  const poserJoueurs = (liste: JoueurPublic[]) => {
    joueursRef.current = liste;
    setJoueurs(liste);
  };
  const poserScene = (course: CourseVue | null, liste: JoueurPublic[]) => {
    const scene = sceneDepuis(course, liste);
    sceneFinaleRef.current = scene;
    setSceneFinale(scene);
  };
  const poserCourse = (course: CourseVue | null) => {
    courseRef.current = course;
    setCourseAffichee(course);
    if (!course) {
      positionsRef.current = {};
      cagnotteRef.current = 0;
      setPositions({});
      setCagnotte(0);
      setBrassage(null);
      setSpectacle(null);
      setLanceId(null);
      return;
    }
    positionsRef.current = { ...course.positions };
    cagnotteRef.current = course.cagnotte;
    setPositions(positionsRef.current);
    setCagnotte(cagnotteRef.current);
    setBrassage(null);
    setSpectacle(null);
    setLanceId(null);
  };
  const memoriserCourse = (course: CourseVue | null) => {
    courseRef.current = course;
    setCourseAffichee(course);
  };
  const setEcranLocal = (suivant: EcranTv) => {
    ecranRef.current = suivant;
    setEcran(suivant);
  };

  useLayoutEffect(() => {
    animerFlip.current = false;
  });

  const traiterRef = useRef<(recue: VueTv, animer: boolean) => void>(() => undefined);
  traiterRef.current = (recue, animer) => {
    recuRef.current = recue;
    sons().reglerVolume(recue.volume);
    reduitRef.current = recue.partie.animationsReduites;
    const maxId = recue.evenements.reduce((plus, evenement) => Math.max(plus, evenement.id), 0);
    const snap = () => {
      file.current.couper();
      const source = recuRef.current ?? recue;
      const parArrivee = trierAccueil(source.joueurs);
      const liste = source.partie.ecranTv === 'scores' ? actualiserPlaces(parArrivee) : parArrivee;
      poserJoueurs(liste);
      setEcranLocal(source.partie.ecranTv);
      poserCourse(source.course);
      poserScene(source.course, liste);
      versionRef.current = source.version;
      debutRetard.current = 0;
      fileVide.current = true;
      etapeCourante.current = null;
      setPhase('pose');
      setPoseAnime(false);
      setGain(null);
      setRetour(null);
      setFondu(null);
      publier();
    };
    if (!animer) {
      snap();
      dernierId.current = maxId;
      return;
    }
    const frais = recue.evenements.filter((evenement) => evenement.id > dernierId.current).sort((a, b) => a.id - b.id);
    dernierId.current = Math.max(dernierId.current, maxId);
    if (frais.length === 0) {
      if (recue.version !== versionRef.current) {
        snap();
        return;
      }
      if (fileVide.current) poserJoueurs(collerPresence(joueursRef.current, recue.joueurs));
      publier();
      return;
    }
    versionRef.current = recue.version;
    if (!courseRef.current && recue.course) poserCourse(recue.course);
    if (debutRetard.current === 0) debutRetard.current = Date.now();
    fileVide.current = false;
    const serie = ++serieRef.current;
    let abandon = false;
    frais.forEach((evenement, index) => {
      file.current.ajouter(async () => {
        const age = debutRetard.current === 0 ? 0 : Date.now() - debutRetard.current;
        if (abandon || age > 20000) {
          abandon = true;
          snap();
          return;
        }
        evenementCourant.current = evenement.type;
        await jouer(evenement, frais, index, recue);
        if (index === frais.length - 1 && serie === serieRef.current) {
          const source = recuRef.current ?? recue;
          poserCourse(source.course);
          const liste = trierAccueil(source.joueurs);
          const affiches = ecranRef.current === 'scores' ? actualiserPlaces(liste) : liste;
          poserJoueurs(affiches);
          poserScene(source.course, source.partie.ecranTv === 'scores' ? actualiserPlaces(liste) : liste);
          if (ecranRef.current !== source.partie.ecranTv) setEcranLocal(source.partie.ecranTv);
          debutRetard.current = 0;
          fileVide.current = true;
          publier();
        }
      });
    });
  };

  async function basculer(cible: EcranTv) {
    if (cible === ecranRef.current) return;
    const duree = reduitRef.current ? 150 : 700;
    sons().jouer('transition');
    setPoseAnime(true);
    setPhase('sort');
    await attendreAnime(reduitRef.current ? 150 : 300);
    const parArrivee = trierAccueil(joueursRef.current);
    poserJoueurs(cible === 'scores' ? actualiserPlaces(parArrivee) : parArrivee);
    setEcranLocal(cible);
    setPhase('entre');
    await attendreAnime(40);
    setPhase('pose');
    await attendreAnime(duree);
  }

  async function jouerModule(evenement: VueTv['evenements'][number], recue: VueTv) {
    const reduit = reduitRef.current;
    const poser = () => memoriserCourse(patchCourse(courseRef.current, { phase: recue.course?.phase ?? 'miniJeu', ...etatModules(recue.course) }));
    const tenir = async (etape: string, son: string | null, ms: number) => {
      await segment(etape, async () => {
        poser();
        if (son) sons().jouer(son);
        await attendreAnime(reduit ? 150 : ms);
      });
    };
    switch (evenement.type) {
      case 'jeopardy.case':
        await tenir('question', 'transition', 900);
        return;
      case 'jeopardy.buzz':
        await tenir('buzz', 'buzzer', 1200);
        return;
      case 'undercover.manche':
        await tenir('ordre', 'transition', 900);
        return;
      case 'undercover.elimine':
        await tenir('revelation', 'revelation', 2000);
        return;
      case 'undercover.fin':
        await tenir('mots', 'revelation', 1500);
        return;
      case 'codenames.indice':
        await tenir('indice', 'transition', 900);
        return;
      case 'codenames.carte':
        await tenir('carte', 'revelation', 900);
        return;
      case 'codenames.fin':
        await tenir('cle', 'revelation', 1500);
        return;
      case 'perudo.annonce':
        await tenir('annonce', 'transition', 700);
        return;
      case 'perudo.revelation': {
        const avecDes = recue.course?.perudo?.joueurs.filter((joueur) => (recue.course?.perudo?.revelation?.faces[joueur.id]?.length ?? 0) > 0).length ?? 0;
        await segment('revelation', async () => {
          poser();
          await attendreAnime(dureeRevelationPerudo(avecDes, reduit));
        });
        return;
      }
      case 'justone.revelation':
      case 'justone.fin':
        await segment('revelation', async () => {
          poser();
          await attendreAnime(dureeRevelationJustOne(reduit));
        });
        return;
      case 'topten.revelation': {
        const cartes = recue.course?.topten?.courante?.repondants.length ?? 0;
        await segment('revelation', async () => {
          poser();
          await attendreAnime(dureeRevelationTopTen(cartes, reduit));
        });
        return;
      }
      default:
        poser();
    }
  }

  async function jouer(
    evenement: VueTv['evenements'][number],
    frais: VueTv['evenements'],
    index: number,
    recue: VueTv,
  ) {
    const duree = reduitRef.current ? 150 : 700;
    if (evenement.type === 'joueur.rejoint') {
      const id = joueurIdDe(evenement);
      const final = id ? recue.joueurs.find((joueur) => joueur.id === id) : undefined;
      if (!id || !final || joueursRef.current.some((joueur) => joueur.id === id)) return;
      const joueur = { ...final, gpVisibles: final.gpVisibles - gainsSuivants(frais, index, id) };
      const liste = trierAccueil([...joueursRef.current, joueur]);
      if (ecranRef.current !== 'accueil' || reduitRef.current) {
        if (reduitRef.current) setFondu(id);
        poserJoueurs(ecranRef.current === 'scores' ? actualiserPlaces(liste) : liste);
        await attendreAnime(150);
        setFondu(null);
        return;
      }
      setRetour(id);
      poserJoueurs(liste);
      sons().jouer('rejoindre');
      await attendreAnime(duree);
      setRetour(null);
      return;
    }
    if (evenement.type === 'gp.ajoutes' || evenement.type === 'gp.reveles') {
      const id = joueurIdDe(evenement);
      const montant = montantDe(evenement);
      if (!id || montant === null) return;
      await segment('gp', async () => {
        if (!reduitRef.current) {
          setGain({ id, montant, cle: evenement.id });
          sons().jouer('gain');
        } else {
          setFondu(id);
          sons().jouer('gain');
        }
        poserJoueurs(actualiserPlaces(ajouterSolde(joueursRef.current, id, montant)));
        await attendreAnime(duree);
        setGain(null);
        setFondu(null);
      });
      return;
    }
    if (evenement.type === 'ecran') {
      const cible = ecranDepuis(evenement);
      if (cible) await basculer(cible);
      return;
    }
    if (evenement.type === 'joueur.retire') {
      const id = joueurIdDe(evenement);
      if (!id) return;
      poserJoueurs(joueursRef.current.filter((joueur) => joueur.id !== id));
      return;
    }
    if (evenement.type === 'joueur.renomme') {
      const id = joueurIdDe(evenement);
      const pseudo = evenement.donnees.pseudo;
      if (!id || typeof pseudo !== 'string') return;
      poserJoueurs(joueursRef.current.map((joueur) => (joueur.id === id ? { ...joueur, pseudo } : joueur)));
      return;
    }
    if (evenement.type === 'partie.reinitialisee') {
      poserJoueurs([]);
      poserCourse(null);
      setEcranLocal('accueil');
      setPhase('pose');
      setPoseAnime(false);
      return;
    }
    if (evenement.type === 'minijeu.podium') {
      const brut = evenement.donnees.lignes;
      const lignes = Array.isArray(brut)
        ? brut.flatMap((entree) => {
            if (!entree || typeof entree !== 'object') return [];
            const ligne = entree as { joueurId?: unknown; pseudo?: unknown; montant?: unknown; rang?: unknown };
            if (typeof ligne.joueurId !== 'string' || typeof ligne.pseudo !== 'string' || typeof ligne.montant !== 'number') return [];
            return [{
              joueurId: ligne.joueurId,
              pseudo: ligne.pseudo,
              montant: ligne.montant,
              rang: typeof ligne.rang === 'number' ? ligne.rang : null,
            }];
          })
        : [];
      const dureePodium = reduitRef.current ? 150 : 700;
      await segment('podium', async () => {
        sons().jouer('victoire');
        setSpectacle({ type: 'podium', lignes });
        await attendreAnime(dureePodium);
        setSpectacle(null);
      });
      return;
    }
    if (evenement.type === 'poker.niveau') {
      const dureeNiveau = reduitRef.current ? 150 : 700;
      await segment('annonce', async () => {
        sons().jouer('transition');
        setSpectacle({ type: 'annonce', texte: evenement.libelle });
        await attendreAnime(dureeNiveau);
        setSpectacle(null);
      });
      return;
    }
    if (/^(jeopardy|undercover|topten|codenames|perudo|justone)\./.test(evenement.type)) {
      await jouerModule(evenement, recue);
      return;
    }
    const pseudo = (idJoueur: string) => joueursRef.current.find((joueur) => joueur.id === idJoueur)?.pseudo ?? 'Un joueur';
    if (evenement.type === 'tour.nouveau') {
      const tour = typeof evenement.donnees.tour === 'number' ? evenement.donnees.tour : (courseRef.current?.tour ?? 0) + 1;
      memoriserCourse(patchCourse(courseRef.current, { phase: 'choixMiniJeu', tour, joueurCourantId: null, etape: null, miniJeu: null }));
    } else if (evenement.type === 'ordre.tire') {
      const ordre = Array.isArray(evenement.donnees.ordre)
        ? evenement.donnees.ordre.filter((item): item is string => typeof item === 'string')
        : courseRef.current?.ordre ?? [];
      memoriserCourse(patchCourse(courseRef.current, { ordre }));
    } else if (evenement.type === 'minijeu.annonce') {
      const idJoueur = typeof evenement.donnees.joueurId === 'string' ? evenement.donnees.joueurId : null;
      memoriserCourse(patchCourse(courseRef.current, { phase: 'choixMiniJeu', choisitId: idJoueur }));
    } else if (evenement.type === 'minijeu.choisi') {
      const nom = typeof evenement.donnees.nom === 'string' ? evenement.donnees.nom : null;
      memoriserCourse(patchCourse(courseRef.current, { phase: 'miniJeu', miniJeu: nom, ...etatModules(recue.course) }));
    } else if (evenement.type === 'deplacements.commences') {
      memoriserCourse(patchCourse(courseRef.current, {
        phase: 'deplacements',
        etape: 'lancer',
        joueurCourantId: recue.course?.joueurCourantId ?? null,
        ordre: recue.course?.ordre ?? [],
        indexCourant: recue.course?.indexCourant ?? 0,
      }));
    } else if (evenement.type === 'de.lance' && evenement.donnees.usage !== 'chance') {
      const idLanceur = typeof evenement.donnees.joueurId === 'string' ? evenement.donnees.joueurId : null;
      if (idLanceur && courseRef.current) {
        setLanceId(idLanceur);
        const index = courseRef.current.ordre.indexOf(idLanceur);
        memoriserCourse(patchCourse(courseRef.current, {
          phase: 'deplacements',
          etape: 'lancer',
          joueurCourantId: idLanceur,
          indexCourant: index >= 0 ? index : courseRef.current.indexCourant,
        }));
      }
    } else if (evenement.type === 'tour.fini') {
      memoriserCourse(patchCourse(courseRef.current, { phase: 'finTour', etape: null, joueurCourantId: null }));
    } else if (evenement.type === 'course.dernierTour') {
      memoriserCourse(patchCourse(courseRef.current, { dernierTour: true }));
    } else if (evenement.type === 'course.terminee') {
      memoriserCourse(patchCourse(courseRef.current, { phase: 'terminee', etape: null, classement: recue.course?.classement ?? null }));
    } else if (evenement.type === 'roue.annonce') {
      memoriserCourse(patchCourse(courseRef.current, { etape: 'roue' }));
    }
    const ceremonieJouee = await jouerCeremonie(evenement, {
      attendre: attendreAnime,
      reduit: reduitRef.current,
      setScene: (scene) => {
        sceneFinaleRef.current = scene;
        setSceneFinale(scene);
      },
      jouerSon: (nom) => sons().jouer(nom),
    });
    if (ceremonieJouee) return;
    await animerPlateau(evenement, {
      reduit: reduitRef.current,
      pseudo,
      setPositions: (valeur) => {
        const suivant = typeof valeur === 'function' ? valeur(positionsRef.current) : valeur;
        positionsRef.current = suivant;
        setPositions(suivant);
        if (courseRef.current) {
          courseRef.current = { ...courseRef.current, positions: suivant };
          setCourseAffichee(courseRef.current);
        }
      },
      setCagnotte: (valeur) => {
        cagnotteRef.current = valeur;
        setCagnotte(valeur);
        if (courseRef.current) {
          courseRef.current = { ...courseRef.current, cagnotte: valeur };
          setCourseAffichee(courseRef.current);
        }
      },
      ajouterCagnotte: (delta) => {
        const valeur = cagnotteRef.current + delta;
        cagnotteRef.current = valeur;
        setCagnotte(valeur);
        if (courseRef.current) {
          courseRef.current = { ...courseRef.current, cagnotte: valeur };
          setCourseAffichee(courseRef.current);
        }
      },
      setSpectacle,
      setBrassage,
      ajusterSolde: (idJoueur, delta) => poserJoueurs(ajouterSolde(joueursRef.current, idJoueur, delta)),
      attendre: attendreAnime,
      segment,
      marquer,
    });
  }

  useEffect(() => {
    sons().precharger();
    for (const avatar of avatarsDisponibles()) {
      const image = new Image();
      image.src = avatar.url;
    }
    const qr = new Image();
    qr.src = '/qr/joueur.svg';
  }, []);

  useEffect(() => {
    const actuelle = connecter({
      role: 'tv',
      onVue: (recue, infos) => {
        if (recue.role !== 'tv') return;
        setVue(recue);
        traiterRef.current(recue, infos.animer);
      },
      onConnecte: setConnecte,
      onBonjour: () => undefined,
      onTransport: setTransport,
      onMesure: (mesure) => setLatence(mesure.latenceMs),
    });
    return () => actuelle.fermer();
  }, []);

  useEffect(() => {
    const ajuster = () => {
      const element = scene.current;
      if (!element) return;
      const echelle = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
      const x = (window.innerWidth - 1920 * echelle) / 2;
      const y = (window.innerHeight - 1080 * echelle) / 2;
      element.style.transform = `translate(${x}px, ${y}px) scale(${echelle})`;
      element.style.setProperty('--vitesse', String(vitesseDemandee));
    };
    ajuster();
    window.addEventListener('resize', ajuster);
    return () => window.removeEventListener('resize', ajuster);
  }, []);

  useEffect(() => {
    if (sonOk) return;
    const agir = (event: Event) => {
      if (event.type === 'keydown' && (event as KeyboardEvent).key !== 'Enter') return;
      sons().deverrouiller();
      pleinEcran();
      setSonOk(true);
    };
    window.addEventListener('click', agir);
    window.addEventListener('keydown', agir);
    return () => {
      window.removeEventListener('click', agir);
      window.removeEventListener('keydown', agir);
    };
  }, [sonOk]);

  const diagVisible = diagForce || vue?.partie.diagnosticTvAffiche === true;
  useEffect(() => {
    if (!diagVisible) return;
    let images = 0;
    let dernier = performance.now();
    let identifiant = 0;
    const tick = (now: number) => {
      images += 1;
      if (now - dernier >= 1000) {
        setFps(Math.round((images * 1000) / (now - dernier)));
        images = 0;
        dernier = now;
      }
      identifiant = requestAnimationFrame(tick);
    };
    identifiant = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(identifiant);
  }, [diagVisible]);

  const reduit = vue?.partie.animationsReduites === true;
  const placesMax = vue?.placesMax ?? 4;
  const signature = joueurs.map((joueur) => joueur.id).join('|');
  const inscrits = ecran === 'accueil' ? joueurs : [];
  const places = Array.from({ length: Math.max(placesMax, inscrits.length) }, (_, index) => inscrits[index] ?? null);

  const live = vue?.course ?? null;
  const podiumVisible = spectacle?.type === 'podium';
  const grille = ecran === 'plateau' && !podiumVisible && live?.grilleVisible === true;
  const poker = ecran === 'plateau' && !podiumVisible && !grille && live?.phase === 'miniJeu' && live.ecranMini === 'poker';
  const regles = ecran === 'plateau' && !podiumVisible && !grille && live?.phase === 'miniJeu' && live.ecranMini === 'regles';
  const affichee = courseAffichee;
  const moduleAffiche = (module: string) =>
    ecran === 'plateau' && !podiumVisible && !grille && affichee?.phase === 'miniJeu' && affichee.ecranMini === module;
  const topten = moduleAffiche('topten') && !!affichee?.topten;
  const jeopardy = moduleAffiche('jeopardy') && !!affichee?.jeopardy;
  const undercover = moduleAffiche('undercover') && !!affichee?.undercover;
  const codenames = moduleAffiche('codenames') && !!affichee?.codenames;
  const perudo = moduleAffiche('perudo') && !!affichee?.perudo;
  const justone = moduleAffiche('justone') && !!affichee?.justone;
  const moduleVisible = topten || jeopardy || undercover || codenames || perudo || justone;
  const pseudosTv = new Map((vue?.joueurs ?? []).map((joueur) => [joueur.id, joueur.pseudo]));
  const nomTv = (id: string) => pseudosTv.get(id) ?? 'Joueur';
  const nomTopTen = (id: string) => (id === REPONDANT_HOTE ? affichee?.topten?.nomHote ?? 'Hôte' : nomTv(id));
  const nomJustOne = (id: string) => (id === JUSTONE_HOTE ? affichee?.justone?.nomHote ?? 'Hôte' : nomTv(id));

  return (
    <div class={`${reduit ? 'scene animations-reduites' : 'scene'}${ecran === 'plateau' ? ' scene-plateau' : ''}`} ref={scene}>
      {ecran === 'accueil' && !reduit ? <Confettis /> : null}
      {grille && live ? <GrilleTv course={live} /> : null}
      {poker && live ? <PokerTv course={live} /> : null}
      {regles && live ? <ReglesTv course={live} /> : null}
      {topten && affichee?.topten ? (
        <TopTenTv course={affichee} topten={affichee.topten} nom={nomTopTen} vitesse={vitesseDemandee} reduit={reduit} />
      ) : null}
      {jeopardy && affichee?.jeopardy ? <JeopardyTv jeopardy={affichee.jeopardy} ordre={affichee.ordre} nom={nomTv} /> : null}
      {undercover && affichee?.undercover ? <UndercoverTv course={affichee} undercover={affichee.undercover} nom={nomTv} /> : null}
      {codenames && affichee?.codenames ? <CodenamesTv course={affichee} codenames={affichee.codenames} nom={nomTv} /> : null}
      {perudo && affichee?.perudo ? (
        <PerudoTv perudo={affichee.perudo} joueurs={joueurs} nom={nomTv} vitesse={vitesseDemandee} reduit={reduit} />
      ) : null}
      {justone && affichee?.justone ? <JustOneTv justone={affichee.justone} nom={nomJustOne} /> : null}
      {spectacle?.type === 'podium' ? <PodiumMini lignes={spectacle.lignes} /> : null}
      {(grille || poker || regles || moduleVisible) && spectacle?.type === 'annonce' ? <p class="annonce-flottante">{spectacle.texte}</p> : null}
      <div class="contenu">
        <span class={connecte ? 'point-lien' : 'point-lien coupe'} data-connecte={connecte ? '1' : '0'} />
        {!connecte ? <p class="bandeau-hors-ligne">Hors ligne</p> : null}
        {sonOk || ecran === 'plateau' ? null : <p class="bandeau-son">Appuie sur OK pour activer le son</p>}
        <div class={`plan ${phase}${poseAnime ? '' : ' sans-transition'}`} style={sonOk || ecran === 'plateau' ? undefined : { height: 'calc(100% - 96px)' }}>
          {ecran === 'plateau' && sceneFinale ? (
            <FinaleTv scene={sceneFinale} joueurs={joueurs} reduit={reduit} />
          ) : ecran === 'plateau' ? (
            courseAffichee && !grille && !poker && !regles && !moduleVisible && !podiumVisible ? (
              <PlateauTv
                course={courseAffichee}
                joueurs={joueurs}
                positions={positions}
                cagnotte={cagnotte}
                spectacle={spectacle}
                brassage={brassage}
                reduit={reduit}
                aLance={lanceId !== null && lanceId === courseAffichee.joueurCourantId}
              />
            ) : null
          ) : ecran === 'scores' ? (
            <section class="podium" data-ecran="scores" data-panneau="principal">
              {joueurs.length === 0 ? <p class="texte-tv">Aucun joueur pour l'instant</p> : null}
              {joueurs.map((joueur) => (
                <ColonneScore
                  key={joueur.id}
                  joueur={joueur}
                  premier={joueur.place === 1}
                  signature={signature}
                  animerFlip={animerFlip}
                  gain={gain}
                  fondu={fondu === joueur.id}
                  duree={reduit ? 150 : 700}
                />
              ))}
            </section>
          ) : (
            <section class="accueil" data-ecran="accueil" data-panneau="principal">
              <div class="accueil-haut">
                <Tuile>
                  <img class="qr" src="/qr/joueur.svg" alt="QR code vers la page joueur" />
                </Tuile>
                <div>
                  <h1 class="titre-tv">{vue?.partie.titre ?? 'GP Party'}</h1>
                  <p class="texte-tv">Scanne pour rejoindre</p>
                  <p class="texte-tv" style={{ marginTop: '16px' }}>
                    {vue?.urlJoueur ?? ''}
                  </p>
                </div>
              </div>
              <div class="places" style={{ gridTemplateColumns: `repeat(${Math.max(places.length, 1)}, 1fr)` }}>
                {places.map((joueur, index) =>
                  joueur ? (
                    <PlaceAccueil
                      key={joueur.id}
                      joueur={joueur}
                      retourner={retour === joueur.id}
                      reduit={reduit}
                      gain={gain}
                    />
                  ) : (
                    <div class="place" key={`vide-${index}`}>
                      <Tuile vide>
                        <p class="attente">En attente…</p>
                      </Tuile>
                    </div>
                  ),
                )}
              </div>
            </section>
          )}
        </div>
        {diagVisible ? (
          <aside class="panneau-diag">
            <p>Transport : {transport}</p>
            <p>Latence : {latence === null ? '—' : `${latence} ms`}</p>
            <p>Images : {fps === null ? '—' : `${fps} / s`}</p>
            <p>Démarrage : {vue?.idDemarrage ?? '—'}</p>
          </aside>
        ) : null}
        <VoileConnexion visible={!connecte} local />
      </div>
    </div>
  );
}

function PlanchePolices() {
  const texte = '0O 1Il 2Z 5S 6G 8B · Quinte flush royale · Carré · Brelan · Blinds 1 / 2 · Niveau 1 sur 3 · 26 GP · é è à ç û';
  const roles = ['chiffres', 'titre', 'texte'] as const;
  return (
    <main class="planche">
      {roles.map((role) =>
        [32, 48, 96].map((taille) => (
          <p key={`${role}-${taille}`} class={`planche-${role}`} style={{ fontSize: `${taille}px`, lineHeight: 1.4 }}>
            {texte}
          </p>
        )),
      )}
    </main>
  );
}

function RacineTv() {
  if (new URLSearchParams(window.location.search).get('planche') === '1') return <PlanchePolices />;
  return <EcranTv />;
}

render(<RacineTv />, document.getElementById('app')!);
