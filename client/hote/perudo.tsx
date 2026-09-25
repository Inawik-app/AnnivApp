import { useEffect, useState } from 'preact/hooks';
import { annonceLegale, plusPetiteAnnonce } from '../../shared/perudo';
import type { Action, PerudoVue } from '../../shared/types';
import { Bouton } from '../commun/composants';
import { AnnonceVisuelle, FaceDe, libelleAnnonce, libelleFace } from '../commun/perudo';
import { ReglesPerudo } from '../commun/regles-perudo';

export function PanneauPerudo({
  perudo,
  pseudos,
  envoi,
  agir,
}: {
  perudo: PerudoVue;
  pseudos: Map<string, string>;
  envoi: boolean;
  agir: (action: Action) => void;
}) {
  const nom = (id: string) => pseudos.get(id) ?? 'Joueur';
  const [regles, setRegles] = useState(false);
  const debut = plusPetiteAnnonce(perudo.annonce);
  const [nombre, setNombre] = useState(debut?.nombre ?? 1);
  const [valeur, setValeur] = useState(debut?.valeur ?? 2);
  const cle = `${perudo.numeroManche}|${perudo.etape}|${perudo.courantId}|${perudo.annonce?.nombre ?? 0}|${perudo.annonce?.valeur ?? 0}`;

  useEffect(() => {
    const suivante = plusPetiteAnnonce(perudo.annonce);
    if (suivante) {
      setNombre(suivante.nombre);
      setValeur(suivante.valeur);
    }
  }, [cle]);

  if (regles) {
    return (
      <div class="pile" data-panneau-perudo="regles">
        <ReglesPerudo />
        <Bouton variante="secondaire" onClick={() => setRegles(false)}>
          Fermer
        </Bouton>
      </div>
    );
  }

  if (perudo.etape === 'terminee') {
    return (
      <div class="pile" data-panneau-perudo="fin">
        <h3>Perudo terminé</h3>
        <ul class="recap-ordre">
          {Object.entries(perudo.gains)
            .filter(([, montant]) => montant > 0)
            .map(([id, montant]) => (
              <li key={id}>
                {nom(id)} : +{montant} GP
              </li>
            ))}
        </ul>
      </div>
    );
  }

  return (
    <div class="pile" data-panneau-perudo={perudo.etape}>
      <h3>Perudo · manche {perudo.numeroManche}</h3>
      <Bouton variante="secondaire" onClick={() => setRegles(true)}>
        Règles
      </Bouton>
      <p>Dés en jeu : {perudo.totalDes}</p>
      {perudo.annonce ? (
        <AnnonceVisuelle nombre={perudo.annonce.nombre} valeur={perudo.annonce.valeur} />
      ) : (
        <p>Pas encore d’annonce</p>
      )}
      <p>Tour : {perudo.courantId ? nom(perudo.courantId) : '—'}</p>
      {perudo.joueurs.map((joueur) => (
        <div key={joueur.id} class="pile">
          <p>
            {nom(joueur.id)}
            {joueur.elimine ? ' · éliminé' : ` · ${joueur.desRestants} dé(s)`}
            {joueur.id === perudo.courantId ? ' · à jouer' : ''}
          </p>
          {joueur.faces ? (
            <div class="mains-perudo">
              {joueur.faces.map((face, index) => (
                <FaceDe key={`${index}-${face}`} valeur={face} taille={64} />
              ))}
            </div>
          ) : (
            <p>{joueur.aLance ? 'Dés lancés' : 'Pas encore lancé'}</p>
          )}
          {perudo.etape === 'lancers' && !joueur.aLance && !joueur.elimine ? (
            <Bouton disabled={envoi} onClick={() => agir({ type: 'lancerDesPerudo', joueurId: joueur.id })}>
              Lancer pour {nom(joueur.id)}
            </Bouton>
          ) : null}
        </div>
      ))}
      {perudo.etape === 'encheres' && perudo.courantId ? (
        <>
          <p>Jouer pour {nom(perudo.courantId)}</p>
          <div class="compteur-perudo">
            <button type="button" disabled={envoi || nombre <= 1} onClick={() => setNombre(nombre - 1)}>
              −
            </button>
            <span class="valeur">{nombre}</span>
            <button type="button" disabled={envoi} onClick={() => setNombre(nombre + 1)}>
              +
            </button>
          </div>
          <div class="faces-annonce">
            {[1, 2, 3, 4, 5, 6].map((face) => {
              const legale = annonceLegale(perudo.annonce, { nombre, valeur: face });
              return (
                <button
                  key={face}
                  type="button"
                  class={valeur === face ? 'choisie' : undefined}
                  disabled={envoi || !legale}
                  onClick={() => setValeur(face)}
                >
                  <FaceDe valeur={face} taille={64} />
                </button>
              );
            })}
          </div>
          <Bouton
            plein
            disabled={envoi || !annonceLegale(perudo.annonce, { nombre, valeur })}
            onClick={() => agir({ type: 'annoncerPerudo', nombre, valeur })}
          >
            Annoncer {nombre} × {libelleFace(valeur)}
          </Bouton>
          <Bouton plein variante="danger" disabled={envoi || !perudo.annonce} onClick={() => agir({ type: 'dudoPerudo' })}>
            Dudo !
          </Bouton>
          {perudo.calza ? (
            <span class="bouton-calza">
              <Bouton plein disabled={envoi || !perudo.annonce} onClick={() => agir({ type: 'calzaPerudo' })}>
                Calza !
              </Bouton>
            </span>
          ) : null}
        </>
      ) : null}
      {perudo.etape === 'revelation' && perudo.revelation ? (
        <>
          <p>{perudo.revelation.libelle}</p>
          <Bouton plein disabled={envoi} onClick={() => agir({ type: 'mancheSuivantePerudo' })}>
            Manche suivante
          </Bouton>
        </>
      ) : null}
      {perudo.historique.length > 0 ? (
        <ul class="historique-perudo">
          {[...perudo.historique].reverse().map((annonce, index) => (
            <li key={`${annonce.joueurId}-${index}`}>{libelleAnnonce(annonce, nom)}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
