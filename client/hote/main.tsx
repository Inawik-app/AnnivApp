import { render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Action, DiagnosticTv, VueHote } from '../../shared/types';
import { Avatar, Bouton, CompteurRouleaux, Toast, Tuile, VoileConnexion } from '../commun/composants';
import { connecter, type Session } from '../commun/connexion';
import '../commun/polices';
import { cleCodeHote } from '../commun/stockage';
import { PanneauCourse } from './course';
import '../commun/base.css';

function ligneDiagnostic(diagnostic: DiagnosticTv): string[] {
  const lignes = [`Reçu à ${new Date(diagnostic.recuA).toLocaleTimeString('fr-FR')}`];
  if (diagnostic.moteur) lignes.push(`Moteur : ${diagnostic.moteur.nom} ${diagnostic.moteur.version}`);
  if (diagnostic.userAgent) lignes.push(diagnostic.userAgent);
  if (diagnostic.fps !== undefined && diagnostic.fps !== null) lignes.push(`Images : ${diagnostic.fps} / s`);
  if (diagnostic.es2015) {
    lignes.push(
      `ES2015 : flèches ${diagnostic.es2015.flechees ? 'oui' : 'non'}, classes ${diagnostic.es2015.classes ? 'oui' : 'non'}, let/const ${diagnostic.es2015.letConst ? 'oui' : 'non'}`,
    );
  }
  if (diagnostic.es2020) lignes.push(`ES2020 : ${diagnostic.es2020.optionalChaining ? 'oui' : 'non'}`);
  if (diagnostic.css) {
    lignes.push(
      `CSS : grid ${diagnostic.css.grid ? 'oui' : 'non'}, flex gap ${diagnostic.css.flexGap ? 'oui' : 'non'}, variables ${diagnostic.css.variables ? 'oui' : 'non'}, 3D ${diagnostic.css.transforms3d ? 'oui' : 'non'}`,
    );
  }
  if (diagnostic.audio) {
    lignes.push(
      `Audio : mp3 ${diagnostic.audio.mp3 ? 'oui' : 'non'}, ogg ${diagnostic.audio.ogg ? 'oui' : 'non'}, lecture auto ${diagnostic.audio.lectureSansInteraction ? 'oui' : 'non'}`,
    );
  }
  const drapeaux = [
    ['Proxy', diagnostic.proxy],
    ['Promise', diagnostic.promise],
    ['fetch', diagnostic.fetch],
    ['WebSocket', diagnostic.webSocket],
    ['woff2', diagnostic.woff2],
    ['Plein écran', diagnostic.fullscreen],
  ] as const;
  for (const [nom, valeur] of drapeaux) {
    if (valeur !== undefined) lignes.push(`${nom} : ${valeur ? 'oui' : 'non'}`);
  }
  return lignes;
}

function messageAction(action: Action, vue: VueHote): string {
  if (action.type === 'ajouterGP') {
    const pseudo = vue.joueurs.find((joueur) => joueur.id === action.joueurId)?.pseudo ?? 'ce joueur';
    if (action.masquee) return `${Math.abs(action.montant)} GP masqués pour ${pseudo}`;
    if (action.montant > 0) return `${action.montant} GP ajoutés à ${pseudo}`;
    return `${Math.abs(action.montant)} GP retirés à ${pseudo}`;
  }
  if (action.type === 'revelerMasquees') return 'GP masqués révélés';
  if (action.type === 'renommerJoueur') return 'Joueur renommé';
  if (action.type === 'retirerJoueur') return 'Joueur retiré';
  if (action.type === 'validerReprise') return 'Reprise validée';
  if (action.type === 'refuserReprise') return 'Reprise refusée';
  if (action.type === 'verrouillerInscriptions') {
    return vue.partie.inscriptionsVerrouillees ? 'Inscriptions ouvertes' : 'Inscriptions fermées';
  }
  if (action.type === 'choisirEcranTv') {
    if (action.ecran === 'scores') return 'La télé affiche les scores';
    if (action.ecran === 'plateau') return 'La télé affiche le plateau';
    return "La télé affiche l'accueil";
  }
  if (action.type === 'demarrerCourse') return 'La course commence';
  if (action.type === 'regenererPlateau') return 'Plateau mélangé à nouveau';
  if (action.type === 'basculerBots') return vue.bots ? 'Bots arrêtés' : 'Bots activés';
  if (action.type === 'terminerCourse') return 'Course terminée';
  if (action.type === 'basculerAnimationsReduites') {
    return vue.partie.animationsReduites ? 'Animations rétablies' : 'Animations réduites';
  }
  if (action.type === 'basculerDiagnosticTv') {
    return vue.partie.diagnosticTvAffiche ? 'Diagnostic masqué' : 'Diagnostic affiché sur la télé';
  }
  if (action.type === 'annuler') return 'Dernière action annulée';
  if (action.type === 'reinitialiserPartie') return 'Partie réinitialisée';
  if (action.type === 'ajouterJoueursFictifs') return 'Joueurs fictifs ajoutés';
  return 'Action envoyée';
}

function PageHote() {
  const session = useRef<Session | null>(null);
  const [code, setCode] = useState(() => localStorage.getItem(cleCodeHote()) ?? '');
  const [pret, setPret] = useState(() => !!localStorage.getItem(cleCodeHote()));
  const [vue, setVue] = useState<VueHote | null>(null);
  const [connecte, setConnecte] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [confirmerReset, setConfirmerReset] = useState(false);
  const [pseudos, setPseudos] = useState<Record<string, string>>({});
  const [montants, setMontants] = useState<Record<string, string>>({});
  const [masques, setMasques] = useState<Record<string, boolean>>({});

  useEffect(() => {
    document.body.classList.add('fond-encre');
    return () => document.body.classList.remove('fond-encre');
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (!pret) return;
    const actuelle = connecter({
      role: 'hote',
      obtenirCode: () => localStorage.getItem(cleCodeHote()),
      onVue: (recue) => {
        if (recue.role === 'hote') setVue(recue);
      },
      onConnecte: setConnecte,
      onBonjour: (reponse) => {
        if (reponse.ok) {
          setErreur(null);
          return;
        }
        if (reponse.erreur.includes('incorrect') || reponse.erreur.includes('Indique')) {
          localStorage.removeItem(cleCodeHote());
          setPret(false);
        }
        setErreur(reponse.erreur);
      },
    });
    session.current = actuelle;
    return () => {
      actuelle.fermer();
      session.current = null;
    };
  }, [pret]);

  async function agir(action: Action) {
    if (!session.current || envoi || !vue) return;
    setEnvoi(true);
    setErreur(null);
    const reponse = await session.current.envoyer(action);
    setEnvoi(false);
    if (!reponse.ok) {
      setErreur(reponse.erreur);
      return;
    }
    setToast(messageAction(action, vue));
  }

  function validerCode(event: Event) {
    event.preventDefault();
    const nettoye = code.trim();
    if (!nettoye) {
      setErreur('Indique le code hôte');
      return;
    }
    localStorage.setItem(cleCodeHote(), nettoye);
    setPret(true);
  }

  if (!pret) {
    return (
      <main class="page fond-encre">
        <h1>GP Party — Hôte</h1>
        {erreur ? <p class="erreur">{erreur}</p> : null}
        <form class="pile" onSubmit={validerCode}>
          <label>
            Code hôte
            <input type="password" value={code} onInput={(event) => setCode((event.currentTarget as HTMLInputElement).value)} />
          </label>
          <Bouton type="submit" plein>
            Entrer dans la partie
          </Bouton>
        </form>
      </main>
    );
  }

  if (!vue) {
    return (
      <main class="page fond-encre">
        <h1>GP Party — Hôte</h1>
        {erreur ? <p class="erreur">{erreur}</p> : null}
        <p>{connecte ? 'Connexion…' : 'Hors ligne'}</p>
        <VoileConnexion visible={!connecte} />
      </main>
    );
  }

  const journal = [...vue.evenements].reverse();

  return (
    <main class="page page-hote fond-encre">
      <Toast message={toast} />
      <h1>{vue.partie.titre} — Hôte</h1>
      <p>{connecte ? 'Connecté' : 'Hors ligne'}</p>
      {erreur ? <p class="erreur">{erreur}</p> : null}
      <PanneauCourse vue={vue} envoi={envoi} agir={(action) => void agir(action)} />
      <Tuile taille="petite">
        <p>IP retenue : {vue.reseau.ip}</p>
        <p>Autres : {vue.reseau.autres.length > 0 ? vue.reseau.autres.join(', ') : 'aucune'}</p>
        <p>{vue.reseau.urlJoueur}</p>
        <label>
          Volume de la télé
          <input
            type="range"
            min="0"
            max="100"
            value={Math.round(vue.volume * 100)}
            onInput={(event) => {
              const valeur = Number((event.currentTarget as HTMLInputElement).value) / 100;
              session.current?.reglerVolume(valeur);
            }}
          />
        </label>
      </Tuile>
      <div class="rangee" style={{ marginTop: '12px' }}>
        <Bouton variante="secondaire" disabled={envoi} onClick={() => agir({ type: 'choisirEcranTv', ecran: 'accueil' })}>
          Afficher l'accueil sur la télé
        </Bouton>
        <Bouton variante="secondaire" disabled={envoi} onClick={() => agir({ type: 'choisirEcranTv', ecran: 'scores' })}>
          Afficher les scores sur la télé
        </Bouton>
        <Bouton variante="secondaire" disabled={envoi} onClick={() => agir({ type: 'verrouillerInscriptions' })}>
          {vue.partie.inscriptionsVerrouillees ? 'Ouvrir les inscriptions' : 'Fermer les inscriptions'}
        </Bouton>
        <Bouton variante="secondaire" disabled={envoi} onClick={() => agir({ type: 'basculerAnimationsReduites' })}>
          {vue.partie.animationsReduites ? 'Rétablir les animations' : 'Réduire les animations'}
        </Bouton>
        <Bouton variante="secondaire" disabled={envoi} onClick={() => agir({ type: 'basculerDiagnosticTv' })}>
          {vue.partie.diagnosticTvAffiche ? 'Masquer le diagnostic sur la télé' : 'Afficher le diagnostic sur la télé'}
        </Bouton>
        {vue.dev ? (
          <Bouton variante="secondaire" disabled={envoi} onClick={() => agir({ type: 'ajouterJoueursFictifs' })}>
            Ajouter 4 joueurs fictifs
          </Bouton>
        ) : null}
      </div>
      <h2>Joueurs</h2>
      {vue.joueurs.length === 0 ? <p>Aucun joueur.</p> : null}
      {[...vue.joueurs]
        .sort((a, b) => a.rejointA - b.rejointA || a.pseudo.localeCompare(b.pseudo, 'fr'))
        .map((joueur) => (
        <Tuile taille="petite" key={joueur.id} className="pile">
          <div class="rangee">
            <Avatar avatar={joueur.avatar} couleur={joueur.couleur} pseudo={joueur.pseudo} taille={64} />
            <div>
              <strong>{joueur.pseudo}</strong>
              <p>
                {joueur.enLigne ? 'En ligne' : 'Hors ligne'}
                {joueur.latenceMs !== null ? ` · ${joueur.latenceMs} ms` : ''}
              </p>
            </div>
          </div>
          <CompteurRouleaux valeur={joueur.gpVisibles} duree={0} taille={40} />
          <p>Masqués : {joueur.gpMasques} GP</p>
          <div class="rangee">
            {[1, 5, 10, -1, -5].map((montant) => (
              <Bouton
                key={montant}
                variante={montant < 0 ? 'danger' : 'or'}
                disabled={envoi}
                onClick={() => agir({ type: 'ajouterGP', joueurId: joueur.id, montant, libelle: 'Ajustement' })}
              >
                {montant > 0 ? `+${montant}` : montant}
              </Bouton>
            ))}
          </div>
          <label>
            Montant
            <input
              type="number"
              value={montants[joueur.id] ?? ''}
              onInput={(event) => setMontants({ ...montants, [joueur.id]: (event.currentTarget as HTMLInputElement).value })}
            />
          </label>
          <label class="case">
            <input
              type="checkbox"
              checked={masques[joueur.id] === true}
              onChange={(event) => setMasques({ ...masques, [joueur.id]: (event.currentTarget as HTMLInputElement).checked })}
            />
            Masqué
          </label>
          <Bouton
            plein
            disabled={envoi}
            onClick={() => {
              const montant = Number(montants[joueur.id]);
              void agir({
                type: 'ajouterGP',
                joueurId: joueur.id,
                montant,
                libelle: 'Ajustement',
                masquee: masques[joueur.id] === true,
              });
            }}
          >
            Ajouter ces GP
          </Bouton>
          <label>
            Nouveau pseudo
            <input
              type="text"
              maxLength={16}
              value={pseudos[joueur.id] ?? ''}
              onInput={(event) => setPseudos({ ...pseudos, [joueur.id]: (event.currentTarget as HTMLInputElement).value })}
            />
          </label>
          <div class="rangee">
            <Bouton variante="secondaire" disabled={envoi} onClick={() => agir({ type: 'renommerJoueur', joueurId: joueur.id, pseudo: pseudos[joueur.id] ?? '' })}>
              Renommer
            </Bouton>
            <Bouton variante="danger" disabled={envoi} onClick={() => agir({ type: 'retirerJoueur', joueurId: joueur.id })}>
              Retirer
            </Bouton>
          </div>
        </Tuile>
      ))}
      <Bouton plein disabled={envoi || vue.nbMasquees === 0} onClick={() => agir({ type: 'revelerMasquees' })}>
        Révéler les GP masqués ({vue.nbMasquees})
      </Bouton>
      <h2>Demandes de reprise</h2>
      {vue.demandesReprise.length === 0 ? <p>Aucune demande.</p> : null}
      {vue.demandesReprise.map((demande) => (
        <Tuile taille="petite" key={demande.id}>
          <p>{demande.pseudo}</p>
          <div class="rangee">
            <Bouton disabled={envoi} onClick={() => agir({ type: 'validerReprise', demandeId: demande.id })}>
              Valider la reprise
            </Bouton>
            <Bouton variante="danger" disabled={envoi} onClick={() => agir({ type: 'refuserReprise', demandeId: demande.id })}>
              Refuser la reprise
            </Bouton>
          </div>
        </Tuile>
      ))}
      <h2>Appareils</h2>
      {vue.appareils.length === 0 ? <p>Aucun appareil connecté.</p> : null}
      <ul class="journal">
        {vue.appareils.map((appareil, index) => (
          <li key={`${appareil.role}-${appareil.joueurId ?? index}`}>
            {appareil.role === 'tv' ? 'Télé' : appareil.role === 'hote' ? 'Hôte' : appareil.pseudo ?? 'Joueur'}
            {' · '}
            {appareil.latenceMs === null ? 'latence inconnue' : `${appareil.latenceMs} ms`}
          </li>
        ))}
      </ul>
      <h2>Journal</h2>
      {journal.length === 0 ? <p>Aucune action.</p> : null}
      <ul class="journal">
        {journal.map((evenement) => (
          <li key={evenement.id}>{evenement.libelle}</li>
        ))}
      </ul>
      <h2>Diagnostic télé</h2>
      <p>{vue.reseau.urlDiag}</p>
      {vue.diagnostic ? (
        <Tuile taille="petite">
          {ligneDiagnostic(vue.diagnostic).map((ligne) => (
            <p key={ligne}>{ligne}</p>
          ))}
        </Tuile>
      ) : (
        <p>Aucun diagnostic reçu. Ouvre l'adresse ci-dessus sur la télé.</p>
      )}
      <div style={{ marginTop: '24px' }}>
        {confirmerReset ? (
          <div class="rangee">
            <Bouton
              variante="danger"
              disabled={envoi}
              onClick={() => {
                setConfirmerReset(false);
                void agir({ type: 'reinitialiserPartie' });
              }}
            >
              Confirmer la réinitialisation
            </Bouton>
            <Bouton variante="secondaire" onClick={() => setConfirmerReset(false)}>
              Revenir
            </Bouton>
          </div>
        ) : (
          <Bouton variante="danger" onClick={() => setConfirmerReset(true)}>
            Réinitialiser la partie
          </Bouton>
        )}
      </div>
      <div class="barre-annuler">
        <Bouton plein disabled={envoi || !vue.annulation} onClick={() => agir({ type: 'annuler' })}>
          {vue.annulation ? `Annuler : ${vue.annulation}` : 'Annuler'}
        </Bouton>
      </div>
      <VoileConnexion visible={!connecte} />
    </main>
  );
}

render(<PageHote />, document.getElementById('app')!);
