import { render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { AVATARS } from '../../shared/constantes';
import type { VueJoueur } from '../../shared/types';
import { connecter, type Session } from '../commun/connexion';
import { ecrireJeton, lireJeton, oublierJeton } from '../commun/stockage';
import '../commun/base.css';

const PASTILLES: Record<string, string> = {
  soleil: '#e0a106',
  lune: '#8a4bdb',
  feuille: '#1f9d55',
  goutte: '#2f6fed',
  flamme: '#e23d3d',
  etoile: '#d4537e',
};

function initiale(pseudo: string): string {
  const texte = pseudo.trim();
  return texte ? texte.charAt(0).toLocaleUpperCase('fr-FR') : '?';
}

function PageJoueur() {
  const session = useRef<Session | null>(null);
  const [vue, setVue] = useState<VueJoueur | null>(null);
  const [connecte, setConnecte] = useState(false);
  const [pseudo, setPseudo] = useState('');
  const [avatar, setAvatar] = useState<string>(AVATARS[0]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [attenteReprise, setAttenteReprise] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    const actuelle = connecter({
      role: 'joueur',
      obtenirJeton: lireJeton,
      onVue: (recue) => {
        if (recue.role === 'joueur') setVue(recue);
      },
      onConnecte: setConnecte,
      onBonjour: (reponse) => {
        if (reponse.ok) {
          setErreur(null);
          return;
        }
        if (reponse.erreur.includes('session')) {
          oublierJeton();
          setErreur(reponse.erreur);
          actuelle.rebonjour();
          return;
        }
        setErreur(reponse.erreur);
      },
      onRepriseValidee: (message) => {
        ecrireJeton(message.jeton);
        setAttenteReprise(null);
        setErreur(null);
        actuelle.rebonjour();
      },
      onRepriseRefusee: () => {
        setAttenteReprise(null);
        setErreur("L'hôte a refusé la reprise");
      },
    });
    session.current = actuelle;
    return () => actuelle.fermer();
  }, []);

  const horsLigne = (vue?.joueurs ?? []).filter((joueur) => !joueur.enLigne);

  async function rejoindre(event: Event) {
    event.preventDefault();
    if (!session.current || envoi) return;
    setEnvoi(true);
    setErreur(null);
    const reponse = await session.current.envoyer({ type: 'rejoindre', pseudo, avatar });
    setEnvoi(false);
    if (!reponse.ok) {
      setErreur(reponse.erreur);
      return;
    }
    if (reponse.jeton) ecrireJeton(reponse.jeton);
  }

  async function demanderReprise(joueurId: string) {
    if (!session.current || envoi) return;
    setEnvoi(true);
    setErreur(null);
    const reponse = await session.current.envoyer({ type: 'demanderReprise', joueurId });
    setEnvoi(false);
    if (!reponse.ok) {
      setErreur(reponse.erreur);
      return;
    }
    setAttenteReprise(joueurId);
  }

  const moi = vue?.moi ?? null;

  return (
    <main class={vue?.partie.animationsReduites ? 'page animations-reduites' : 'page'}>
      <h1>{vue?.partie.titre ?? 'GP Party'}</h1>
      <p class={connecte ? '' : 'hors-ligne'}>{connecte ? 'Connecté' : 'Hors ligne'}</p>
      {erreur ? <p class="erreur">{erreur}</p> : null}
      {moi ? (
        <section class="carte pile">
          <span
            class="pastille"
            style={{ background: moi.couleur, width: '96px', height: '96px', lineHeight: '96px', fontSize: '40px' }}
          >
            {initiale(moi.pseudo)}
          </span>
          <p class="nom">{moi.pseudo}</p>
          <p class="gp">{moi.gpVisibles} GP</p>
          <p>En attente de la suite.</p>
        </section>
      ) : (
        <div class="pile">
          {vue?.partie.inscriptionsVerrouillees ? <p>Les inscriptions sont fermées.</p> : null}
          <form class="pile" onSubmit={rejoindre}>
            <label>
              Pseudo
              <input
                type="text"
                maxLength={16}
                value={pseudo}
                autocomplete="off"
                onInput={(event) => setPseudo((event.currentTarget as HTMLInputElement).value)}
              />
            </label>
            <div class="rangee">
              {AVATARS.map((id) => (
                <button
                  key={id}
                  type="button"
                  class={avatar === id ? 'pastille choisie' : 'pastille'}
                  style={{ background: PASTILLES[id], width: '72px', height: '72px', lineHeight: '66px', fontSize: '28px' }}
                  aria-pressed={avatar === id}
                  onClick={() => setAvatar(id)}
                >
                  {initiale(pseudo || id)}
                </button>
              ))}
            </div>
            <button type="submit" disabled={envoi || vue?.partie.inscriptionsVerrouillees === true}>
              Rejoindre la partie
            </button>
          </form>
          {attenteReprise ? <p>Demande envoyée. L'hôte doit valider.</p> : null}
          {horsLigne.length > 0 ? (
            <section class="carte pile">
              <h2>Reprendre ma place</h2>
              {horsLigne.map((joueur) => (
                <button key={joueur.id} type="button" class="secondaire" disabled={envoi} onClick={() => demanderReprise(joueur.id)}>
                  Reprendre la place de {joueur.pseudo}
                </button>
              ))}
            </section>
          ) : null}
        </div>
      )}
    </main>
  );
}

render(<PageJoueur />, document.getElementById('app')!);
