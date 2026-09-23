import { render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import catalogueAvatars from '../../config/avatars.json';
import type { NomIcone } from '../../shared/icones';
import type { VueJoueur } from '../../shared/types';
import { Avatar, Bouton, CompteurRouleaux, GainFlottant, Tuile, VoileConnexion } from '../commun/composants';
import { connecter, type Session } from '../commun/connexion';
import { attendre, creerFile } from '../commun/file-animations';
import { Icone } from '../commun/icones';
import '../commun/polices';
import { ecrireJeton, lireJeton, oublierJeton } from '../commun/stockage';
import { joueurIdDe, montantDe } from '../commun/spectacle';
import { CourseJoueur } from './course';
import '../commun/base.css';

function vibrer(ms: number): void {
  const navigation = navigator as Navigator & { vibrate?: (motif: number) => boolean };
  navigation.vibrate?.(ms);
}

function PageJoueur() {
  const session = useRef<Session | null>(null);
  const file = useRef(creerFile());
  const soldeRef = useRef(0);
  const dernierId = useRef(0);
  const [vue, setVue] = useState<VueJoueur | null>(null);
  const [solde, setSolde] = useState(0);
  const [gain, setGain] = useState<{ montant: number; cle: number } | null>(null);
  const [connecte, setConnecte] = useState(false);
  const [pseudo, setPseudo] = useState('');
  const [avatar, setAvatar] = useState(catalogueAvatars[0]?.id ?? 'perso-carpe');
  const [erreur, setErreur] = useState<string | null>(null);
  const [attenteReprise, setAttenteReprise] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    const occupes = new Set((vue?.joueurs ?? []).map((joueur) => joueur.avatar));
    if (!occupes.has(avatar)) return;
    const libre = catalogueAvatars.find((entree) => !occupes.has(entree.id));
    if (libre) setAvatar(libre.id);
  }, [vue, avatar]);

  const traiterRef = useRef<(recue: VueJoueur, animer: boolean) => void>(() => undefined);
  traiterRef.current = (recue, animer) => {
    const moi = recue.moi;
    const maxId = recue.evenements.reduce((plus, evenement) => Math.max(plus, evenement.id), 0);
    if (!moi) {
      file.current.couper();
      soldeRef.current = 0;
      setSolde(0);
      setGain(null);
      dernierId.current = maxId;
      return;
    }
    if (!animer) {
      file.current.couper();
      soldeRef.current = moi.gpVisibles;
      setSolde(moi.gpVisibles);
      setGain(null);
      dernierId.current = maxId;
      return;
    }
    const frais = recue.evenements.filter((evenement) => evenement.id > dernierId.current).sort((a, b) => a.id - b.id);
    dernierId.current = Math.max(dernierId.current, maxId);
    const gains = frais.filter((evenement) => {
      if (evenement.type !== 'gp.ajoutes' && evenement.type !== 'gp.reveles') return false;
      return joueurIdDe(evenement) === moi.id && montantDe(evenement) !== null;
    });
    if (gains.length === 0) {
      if (soldeRef.current !== moi.gpVisibles) {
        soldeRef.current = moi.gpVisibles;
        setSolde(moi.gpVisibles);
      }
      return;
    }
    const reduit = recue.partie.animationsReduites;
    for (const evenement of gains) {
      const montant = montantDe(evenement) ?? 0;
      file.current.ajouter(async () => {
        if (!reduit) {
          setGain({ montant, cle: evenement.id });
          await attendre(700);
          setGain(null);
        }
        soldeRef.current += montant;
        setSolde(soldeRef.current);
        vibrer(reduit ? 20 : 40);
        await attendre(reduit ? 150 : 700);
      });
    }
  };

  useEffect(() => {
    const actuelle = connecter({
      role: 'joueur',
      obtenirJeton: lireJeton,
      onVue: (recue, infos) => {
        if (recue.role !== 'joueur') return;
        setVue(recue);
        traiterRef.current(recue, infos.animer);
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

  const moi = vue?.moi ?? null;
  useEffect(() => {
    document.body.style.background = moi ? moi.couleur : '';
    document.body.style.color = moi ? '#1C1633' : '';
    return () => {
      document.body.style.background = '';
      document.body.style.color = '';
    };
  }, [moi]);

  const horsLigne = [...(vue?.joueurs ?? [])]
    .sort((a, b) => a.rejointA - b.rejointA || a.pseudo.localeCompare(b.pseudo, 'fr'))
    .filter((joueur) => !joueur.enLigne);
  const reduit = vue?.partie.animationsReduites === true;

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

  return (
    <main class={reduit ? 'page animations-reduites' : 'page'}>
      <h1>{vue?.partie.titre ?? 'GP Party'}</h1>
      <p>{connecte ? 'Connecté' : 'Hors ligne'}</p>
      {erreur ? <p class="erreur">{erreur}</p> : null}
      {moi ? (
        <Tuile className="tuile-joueur">
          <Avatar avatar={moi.avatar} couleur={moi.couleur} pseudo={moi.pseudo} taille={160} />
          <p class="pseudo-joueur">{moi.pseudo}</p>
          <CompteurRouleaux valeur={solde} duree={reduit ? 150 : 700} taille={72} />
          <CourseJoueur
            course={vue?.course ?? null}
            moi={moi}
            joueurs={vue?.joueurs ?? []}
            solde={solde}
            occupe={envoi}
            envoyer={async (action) => {
              if (!session.current) return;
              setEnvoi(true);
              setErreur(null);
              const reponse = await session.current.envoyer(action);
              setEnvoi(false);
              // Un buzz arrivé après celui d'un autre n'est pas une erreur à afficher.
              if (!reponse.ok && action.type !== 'buzzJeopardy') setErreur(reponse.erreur);
            }}
          />
          {gain ? <GainFlottant key={gain.cle} montant={gain.montant} /> : null}
        </Tuile>
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
            <div class="grille-avatars">
              {catalogueAvatars.map((entree) => {
                const occupe = (vue?.joueurs ?? []).some((joueur) => joueur.avatar === entree.id);
                return (
                  <button
                    key={entree.id}
                    type="button"
                    class="choix-avatar"
                    aria-label={entree.nom}
                    aria-pressed={avatar === entree.id}
                    disabled={occupe}
                    onClick={() => setAvatar(entree.id)}
                  >
                    <Icone nom={entree.icone as NomIcone} taille={64} />
                  </button>
                );
              })}
            </div>
            <Bouton type="submit" plein disabled={envoi || vue?.partie.inscriptionsVerrouillees === true}>
              Rejoindre la partie
            </Bouton>
          </form>
          {attenteReprise ? <p>Demande envoyée. L'hôte doit valider.</p> : null}
          {horsLigne.length > 0 ? (
            <Tuile taille="petite">
              <h2>Reprendre ma place</h2>
              <div class="pile">
                {horsLigne.map((joueur) => (
                  <Bouton key={joueur.id} variante="secondaire" plein disabled={envoi} onClick={() => demanderReprise(joueur.id)}>
                    Reprendre la place de {joueur.pseudo}
                  </Bouton>
                ))}
              </div>
            </Tuile>
          ) : null}
        </div>
      )}
      <VoileConnexion visible={!connecte && vue !== null} />
    </main>
  );
}

render(<PageJoueur />, document.getElementById('app')!);
