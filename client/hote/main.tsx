import { render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Action, DiagnosticTv, VueHote } from '../../shared/types';
import { connecter, type Session } from '../commun/connexion';
import { cleCodeHote } from '../commun/stockage';
import '../commun/base.css';

function initiale(pseudo: string): string {
  const texte = pseudo.trim();
  return texte ? texte.charAt(0).toLocaleUpperCase('fr-FR') : '?';
}

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

function PageHote() {
  const session = useRef<Session | null>(null);
  const [code, setCode] = useState(() => localStorage.getItem(cleCodeHote()) ?? '');
  const [pret, setPret] = useState(() => !!localStorage.getItem(cleCodeHote()));
  const [vue, setVue] = useState<VueHote | null>(null);
  const [connecte, setConnecte] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [confirmerReset, setConfirmerReset] = useState(false);
  const [pseudos, setPseudos] = useState<Record<string, string>>({});
  const [montants, setMontants] = useState<Record<string, string>>({});
  const [libelles, setLibelles] = useState<Record<string, string>>({});
  const [masques, setMasques] = useState<Record<string, boolean>>({});
  const [groupes, setGroupes] = useState<Record<string, string>>({});

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
    if (!session.current || envoi) return null;
    setEnvoi(true);
    setErreur(null);
    const reponse = await session.current.envoyer(action);
    setEnvoi(false);
    if (!reponse.ok) setErreur(reponse.erreur);
    return reponse;
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
      <main class="page">
        <h1>GP Party — Hôte</h1>
        {erreur ? <p class="erreur">{erreur}</p> : null}
        <form class="pile" onSubmit={validerCode}>
          <label>
            Code hôte
            <input type="password" value={code} onInput={(event) => setCode((event.currentTarget as HTMLInputElement).value)} />
          </label>
          <button type="submit">Entrer dans la partie</button>
        </form>
      </main>
    );
  }

  if (!vue) {
    return (
      <main class="page">
        <h1>GP Party — Hôte</h1>
        {erreur ? <p class="erreur">{erreur}</p> : null}
        <p class={connecte ? '' : 'hors-ligne'}>{connecte ? 'Connexion…' : 'Hors ligne'}</p>
      </main>
    );
  }

  const journal = [...vue.evenements].reverse();

  return (
    <main class={vue.partie.animationsReduites ? 'page animations-reduites' : 'page'}>
      <h1>{vue.partie.titre} — Hôte</h1>
      <p class={connecte ? '' : 'hors-ligne'}>{connecte ? 'Connecté' : 'Hors ligne'}</p>
      {erreur ? <p class="erreur">{erreur}</p> : null}
      <section class="carte pile">
        <p>IP retenue : {vue.reseau.ip}</p>
        <p>Autres : {vue.reseau.autres.length > 0 ? vue.reseau.autres.join(', ') : 'aucune'}</p>
        <p>{vue.reseau.urlJoueur}</p>
      </section>
      <div class="rangee" style={{ marginTop: '12px' }}>
        <button type="button" class="secondaire" disabled={envoi} onClick={() => agir({ type: 'choisirEcranTv', ecran: 'accueil' })}>
          Afficher l'accueil sur la télé
        </button>
        <button type="button" class="secondaire" disabled={envoi} onClick={() => agir({ type: 'choisirEcranTv', ecran: 'scores' })}>
          Afficher les scores sur la télé
        </button>
        <button type="button" class="secondaire" disabled={envoi} onClick={() => agir({ type: 'verrouillerInscriptions' })}>
          {vue.partie.inscriptionsVerrouillees ? 'Ouvrir les inscriptions' : 'Fermer les inscriptions'}
        </button>
        <button type="button" class="secondaire" disabled={envoi} onClick={() => agir({ type: 'basculerAnimationsReduites' })}>
          {vue.partie.animationsReduites ? 'Rétablir les animations' : 'Réduire les animations'}
        </button>
        <button type="button" class="secondaire" disabled={envoi} onClick={() => agir({ type: 'basculerDiagnosticTv' })}>
          {vue.partie.diagnosticTvAffiche ? 'Masquer le diagnostic sur la télé' : 'Afficher le diagnostic sur la télé'}
        </button>
        {vue.dev ? (
          <button type="button" class="secondaire" disabled={envoi} onClick={() => agir({ type: 'ajouterJoueursFictifs' })}>
            Ajouter 4 joueurs fictifs
          </button>
        ) : null}
      </div>
      <h2 style={{ marginTop: '20px' }}>Joueurs</h2>
      {vue.joueurs.length === 0 ? <p>Aucun joueur.</p> : null}
      {vue.joueurs.map((joueur) => (
        <section class="carte pile" key={joueur.id} style={{ marginTop: '12px' }}>
          <div class="ligne" style={{ display: 'flex', alignItems: 'center' }}>
            <span
              class="pastille"
              style={{ background: joueur.couleur, width: '64px', height: '64px', lineHeight: '64px', fontSize: '28px', marginRight: '12px' }}
            >
              {initiale(joueur.pseudo)}
            </span>
            <div>
              <strong>{joueur.pseudo}</strong>
              <p style={{ margin: '4px 0 0' }}>
                {joueur.enLigne ? 'En ligne' : 'Hors ligne'}
                {joueur.latenceMs !== null ? ` · ${joueur.latenceMs} ms` : ''}
              </p>
            </div>
          </div>
          <p class="gp" style={{ fontSize: '36px' }}>
            {joueur.gpVisibles} GP
          </p>
          <p>Masqués : {joueur.gpMasques} GP</p>
          <div class="rangee">
            {[1, 5, 10, -1, -5].map((montant) => (
              <button
                key={montant}
                type="button"
                class={montant < 0 ? 'danger' : ''}
                disabled={envoi}
                onClick={() => agir({ type: 'ajouterGP', joueurId: joueur.id, montant, libelle: 'Ajustement' })}
              >
                {montant > 0 ? `+${montant}` : montant}
              </button>
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
          <label>
            Libellé
            <input
              type="text"
              value={libelles[joueur.id] ?? ''}
              onInput={(event) => setLibelles({ ...libelles, [joueur.id]: (event.currentTarget as HTMLInputElement).value })}
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
          <label>
            Groupe (optionnel)
            <input
              type="text"
              value={groupes[joueur.id] ?? ''}
              onInput={(event) => setGroupes({ ...groupes, [joueur.id]: (event.currentTarget as HTMLInputElement).value })}
            />
          </label>
          <button
            type="button"
            disabled={envoi}
            onClick={() => {
              const montant = Number(montants[joueur.id]);
              void agir({
                type: 'ajouterGP',
                joueurId: joueur.id,
                montant,
                libelle: libelles[joueur.id] ?? '',
                masquee: masques[joueur.id] === true,
                ...(groupes[joueur.id]?.trim() ? { groupeRevelation: groupes[joueur.id]!.trim() } : {}),
              });
            }}
          >
            Ajouter ces GP
          </button>
          <label>
            Nouveau pseudo
            <input
              type="text"
              maxLength={16}
              value={pseudos[joueur.id] ?? ''}
              onInput={(event) => setPseudos({ ...pseudos, [joueur.id]: (event.currentTarget as HTMLInputElement).value })}
            />
          </label>
          <button type="button" class="secondaire" disabled={envoi} onClick={() => agir({ type: 'renommerJoueur', joueurId: joueur.id, pseudo: pseudos[joueur.id] ?? '' })}>
            Renommer
          </button>
          <button type="button" class="danger" disabled={envoi} onClick={() => agir({ type: 'retirerJoueur', joueurId: joueur.id })}>
            Retirer
          </button>
        </section>
      ))}
      <button type="button" style={{ marginTop: '16px', width: '100%' }} disabled={envoi || vue.nbMasquees === 0} onClick={() => agir({ type: 'revelerMasquees' })}>
        Révéler les GP masqués ({vue.nbMasquees})
      </button>
      <h2 style={{ marginTop: '20px' }}>Demandes de reprise</h2>
      {vue.demandesReprise.length === 0 ? <p>Aucune demande.</p> : null}
      {vue.demandesReprise.map((demande) => (
        <div class="carte rangee" key={demande.id} style={{ marginTop: '12px' }}>
          <p style={{ width: '100%' }}>{demande.pseudo}</p>
          <button type="button" disabled={envoi} onClick={() => agir({ type: 'validerReprise', demandeId: demande.id })}>
            Valider la reprise
          </button>
          <button type="button" class="danger" disabled={envoi} onClick={() => agir({ type: 'refuserReprise', demandeId: demande.id })}>
            Refuser la reprise
          </button>
        </div>
      ))}
      <h2 style={{ marginTop: '20px' }}>Appareils</h2>
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
      <h2 style={{ marginTop: '20px' }}>Journal</h2>
      {journal.length === 0 ? <p>Aucune action.</p> : null}
      <ul class="journal">
        {journal.map((evenement) => (
          <li key={evenement.id}>{evenement.libelle}</li>
        ))}
      </ul>
      <h2 style={{ marginTop: '20px' }}>Diagnostic télé</h2>
      <p>{vue.reseau.urlDiag}</p>
      {vue.diagnostic ? (
        <div class="carte pile">
          {ligneDiagnostic(vue.diagnostic).map((ligne) => (
            <p key={ligne}>{ligne}</p>
          ))}
        </div>
      ) : (
        <p>Aucun diagnostic reçu. Ouvre l'adresse ci-dessus sur la télé.</p>
      )}
      <div style={{ marginTop: '24px' }}>
        {confirmerReset ? (
          <div class="rangee">
            <button
              type="button"
              class="danger"
              disabled={envoi}
              onClick={() => {
                setConfirmerReset(false);
                void agir({ type: 'reinitialiserPartie' });
              }}
            >
              Confirmer la réinitialisation
            </button>
            <button type="button" class="secondaire" onClick={() => setConfirmerReset(false)}>
              Revenir
            </button>
          </div>
        ) : (
          <button type="button" class="danger" onClick={() => setConfirmerReset(true)}>
            Réinitialiser la partie
          </button>
        )}
      </div>
      <div class="barre-annuler">
        <button type="button" disabled={envoi || !vue.annulation} onClick={() => agir({ type: 'annuler' })}>
          {vue.annulation ? `Annuler : ${vue.annulation}` : 'Annuler'}
        </button>
      </div>
    </main>
  );
}

render(<PageHote />, document.getElementById('app')!);
