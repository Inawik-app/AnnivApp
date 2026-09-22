import { render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { connecter } from '../commun/connexion';
import '../commun/base.css';
import type { VueTv } from '../../shared/types';
import './tv.css';

function initiale(pseudo: string): string {
  const texte = pseudo.trim();
  return texte ? texte.charAt(0).toLocaleUpperCase('fr-FR') : '?';
}

function deverrouillerSon(): void {
  const fenetre = window as Window & { webkitAudioContext?: typeof AudioContext };
  const Ctor = window.AudioContext ?? fenetre.webkitAudioContext;
  if (Ctor) {
    const audio = new Ctor();
    void audio.resume();
    const buffer = audio.createBuffer(1, 1, 22050);
    const source = audio.createBufferSource();
    source.buffer = buffer;
    source.connect(audio.destination);
    source.start(0);
  }
  const element = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
  };
  const demande = element.requestFullscreen?.bind(element) ?? element.webkitRequestFullscreen?.bind(element);
  if (!demande) return;
  const resultat = demande() as Promise<void> | void;
  if (resultat && typeof resultat.catch === 'function') void resultat.catch(() => undefined);
}

function EcranTv() {
  const scene = useRef<HTMLDivElement>(null);
  const [vue, setVue] = useState<VueTv | null>(null);
  const [connecte, setConnecte] = useState(false);
  const [transport, setTransport] = useState('hors ligne');
  const [latence, setLatence] = useState<number | null>(null);
  const [fps, setFps] = useState<number | null>(null);
  const [sonOk, setSonOk] = useState(false);
  const diagForce = new URLSearchParams(window.location.search).get('diag') === '1';

  useEffect(() => {
    const actuelle = connecter({
      role: 'tv',
      onVue: (recue) => {
        if (recue.role === 'tv') setVue(recue);
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
      deverrouillerSon();
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

  const titre = vue?.partie.titre ?? 'GP Party';
  const joueurs = vue?.joueurs ?? [];

  return (
    <div class={vue?.partie.animationsReduites ? 'scene animations-reduites' : 'scene'} ref={scene}>
      <div class="contenu">
        <p class="etat-lien">{connecte ? 'Connecté' : 'Hors ligne'}</p>
        {sonOk ? null : <p class="bandeau-son">Appuie sur OK pour activer le son</p>}
        {vue?.partie.ecranTv === 'scores' ? (
          <section>
            <h1 class="titre-tv">Scores</h1>
            {joueurs.length === 0 ? <p class="texte-tv">Aucun joueur pour l'instant</p> : null}
            {joueurs.map((joueur) => (
              <div class={joueur.enLigne ? 'ligne-joueur bloc' : 'ligne-joueur bloc hors'} key={joueur.id}>
                <span class="pastille" style={{ background: joueur.couleur, width: '96px', height: '96px', lineHeight: '96px', fontSize: '42px' }}>
                  {initiale(joueur.pseudo)}
                </span>
                <p class="nom-tv">
                  {joueur.place}. {joueur.pseudo}
                </p>
                <p class="score-tv">{joueur.gpVisibles} GP</p>
              </div>
            ))}
          </section>
        ) : (
          <section>
            <h1 class="titre-tv">{titre}</h1>
            <img class="qr" src="/qr/joueur.svg" alt="QR code vers la page joueur" />
            <p class="texte-tv bloc">{vue?.urlJoueur ?? ''}</p>
            <div class="bloc">
              {joueurs.length === 0 ? <p class="texte-tv">En attente des joueurs</p> : null}
              {joueurs.map((joueur) => (
                <div class={joueur.enLigne ? 'ligne-joueur bloc' : 'ligne-joueur bloc hors'} key={joueur.id}>
                  <span class="pastille" style={{ background: joueur.couleur, width: '84px', height: '84px', lineHeight: '84px', fontSize: '36px' }}>
                    {initiale(joueur.pseudo)}
                  </span>
                  <p class="nom-tv">{joueur.pseudo}</p>
                </div>
              ))}
            </div>
          </section>
        )}
        {diagVisible ? (
          <aside class="panneau-diag">
            <p class="texte-tv">Transport : {transport}</p>
            <p class="texte-tv">Latence : {latence === null ? '—' : `${latence} ms`}</p>
            <p class="texte-tv">Images : {fps === null ? '—' : `${fps} / s`}</p>
            <p class="texte-tv">Démarrage : {vue?.idDemarrage ?? '—'}</p>
          </aside>
        ) : null}
      </div>
    </div>
  );
}

render(<EcranTv />, document.getElementById('app')!);
