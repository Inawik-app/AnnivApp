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
import './tv.css';

type Gain = { id: string; montant: number; cle: number };

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
  const [coches, setCoches] = useState<string[]>([]);
  const [spectacle, setSpectacle] = useState<Spectacle | null>(null);
  const courseRef = useRef<CourseVue | null>(null);
  const versionRef = useRef(0);
  const serieRef = useRef(0);
  const diagForce = new URLSearchParams(window.location.search).get('diag') === '1';

  const poserJoueurs = (liste: JoueurPublic[]) => {
    joueursRef.current = liste;
    setJoueurs(liste);
  };
  const poserCourse = (course: CourseVue | null) => {
    courseRef.current = course;
    setCourseAffichee(course);
    if (!course) {
      setPositions({});
      setCagnotte(0);
      setCoches([]);
      setSpectacle(null);
      return;
    }
    setPositions({ ...course.positions });
    setCagnotte(course.cagnotte);
    setCoches(course.phase === 'mises' ? course.mises.filter((mise) => mise.aMise).map((mise) => mise.joueurId) : []);
    setSpectacle(null);
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
    sons().reglerVolume(recue.volume);
    reduitRef.current = recue.partie.animationsReduites;
    const maxId = recue.evenements.reduce((plus, evenement) => Math.max(plus, evenement.id), 0);
    const snap = () => {
      file.current.couper();
      const parArrivee = trierAccueil(recue.joueurs);
      const liste = recue.partie.ecranTv === 'scores' ? actualiserPlaces(parArrivee) : parArrivee;
      poserJoueurs(liste);
      setEcranLocal(recue.partie.ecranTv);
      poserCourse(recue.course);
      versionRef.current = recue.version;
      setPhase('pose');
      setPoseAnime(false);
      setGain(null);
      setRetour(null);
      setFondu(null);
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
      poserJoueurs(collerPresence(joueursRef.current, recue.joueurs));
      return;
    }
    versionRef.current = recue.version;
    if (!courseRef.current && recue.course) poserCourse(recue.course);
    const serie = ++serieRef.current;
    frais.forEach((evenement, index) => {
      file.current.ajouter(async () => {
        await jouer(evenement, frais, index, recue);
        if (index === frais.length - 1 && serie === serieRef.current) {
          poserCourse(recue.course);
          const liste = trierAccueil(recue.joueurs);
          poserJoueurs(ecranRef.current === 'scores' ? actualiserPlaces(liste) : liste);
          if (ecranRef.current !== recue.partie.ecranTv) setEcranLocal(recue.partie.ecranTv);
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
    await attendre(reduitRef.current ? 150 : 300);
    const parArrivee = trierAccueil(joueursRef.current);
    poserJoueurs(cible === 'scores' ? actualiserPlaces(parArrivee) : parArrivee);
    setEcranLocal(cible);
    setPhase('entre');
    await attendre(40);
    setPhase('pose');
    await attendre(duree);
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
        await attendre(150);
        setFondu(null);
        return;
      }
      setRetour(id);
      poserJoueurs(liste);
      sons().jouer('rejoindre');
      await attendre(duree);
      setRetour(null);
      return;
    }
    if (evenement.type === 'gp.ajoutes' || evenement.type === 'gp.reveles') {
      const id = joueurIdDe(evenement);
      const montant = montantDe(evenement);
      if (!id || montant === null) return;
      if (!reduitRef.current) {
        setGain({ id, montant, cle: evenement.id });
        sons().jouer('gain');
        await attendre(duree);
        setGain(null);
      } else {
        setFondu(id);
        sons().jouer('gain');
      }
      poserJoueurs(actualiserPlaces(ajouterSolde(joueursRef.current, id, montant)));
      await attendre(duree);
      setFondu(null);
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
    const pseudo = (idJoueur: string) => joueursRef.current.find((joueur) => joueur.id === idJoueur)?.pseudo ?? 'Un joueur';
    if (evenement.type === 'tour.nouveau') {
      const tour = typeof evenement.donnees.tour === 'number' ? evenement.donnees.tour : (courseRef.current?.tour ?? 0) + 1;
      memoriserCourse(patchCourse(courseRef.current, { phase: 'mises', tour, ordre: [], joueurCourantId: null, etape: null, miniJeu: null }));
      setCoches([]);
    } else if (evenement.type === 'mises.revelees') {
      memoriserCourse(patchCourse(courseRef.current, { phase: 'revelation' }));
    } else if (evenement.type === 'minijeu.annonce') {
      const idJoueur = typeof evenement.donnees.joueurId === 'string' ? evenement.donnees.joueurId : null;
      memoriserCourse(patchCourse(courseRef.current, { phase: 'choixMiniJeu', choisitId: idJoueur }));
    } else if (evenement.type === 'minijeu.choisi') {
      const nom = typeof evenement.donnees.nom === 'string' ? evenement.donnees.nom : null;
      memoriserCourse(patchCourse(courseRef.current, { phase: 'miniJeu', miniJeu: nom }));
    } else if (evenement.type === 'deplacements.commences') {
      memoriserCourse(patchCourse(courseRef.current, {
        phase: 'deplacements',
        etape: 'lancer',
        joueurCourantId: recue.course?.joueurCourantId ?? null,
      }));
    } else if (evenement.type === 'tour.fini') {
      memoriserCourse(patchCourse(courseRef.current, { phase: 'finTour', etape: null, joueurCourantId: null }));
    } else if (evenement.type === 'course.terminee') {
      memoriserCourse(patchCourse(courseRef.current, { phase: 'terminee', etape: null, classement: recue.course?.classement ?? null }));
    } else if (evenement.type === 'duel.annonce' || evenement.type === 'duel.adversaire') {
      memoriserCourse(patchCourse(courseRef.current, { etape: 'duel' }));
    }
    await animerPlateau(evenement, {
      reduit: reduitRef.current,
      pseudo,
      setPositions,
      setCagnotte,
      setSpectacle,
      ajusterSolde: (idJoueur, delta) => poserJoueurs(ajouterSolde(joueursRef.current, idJoueur, delta)),
      setCoches,
      ajouterCoche: (idJoueur) => setCoches((liste) => (liste.includes(idJoueur) ? liste : [...liste, idJoueur])),
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

  return (
    <div class={reduit ? 'scene animations-reduites' : 'scene'} ref={scene}>
      {ecran === 'accueil' && !reduit ? <Confettis /> : null}
      <div class="contenu">
        <p class="etat-lien">{connecte ? 'Connecté' : 'Hors ligne'}</p>
        {sonOk ? null : <p class="bandeau-son">Appuie sur OK pour activer le son</p>}
        <div class={`plan ${phase}${poseAnime ? '' : ' sans-transition'}`} style={sonOk ? undefined : { height: 'calc(100% - 96px)' }}>
          {ecran === 'plateau' && courseAffichee ? (
            <PlateauTv
              course={courseAffichee}
              joueurs={joueurs}
              positions={positions}
              cagnotte={cagnotte}
              spectacle={spectacle}
              reduit={reduit}
              coches={coches}
            />
          ) : ecran === 'scores' ? (
            <section class="podium">
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
            <section class="accueil">
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

render(<EcranTv />, document.getElementById('app')!);
