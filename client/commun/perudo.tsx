import { useEffect, useState } from 'preact/hooks';
import { annonceLegale, plusPetiteAnnonce, RAPPEL_PERUDO } from '../../shared/perudo';
import type { Action, AnnoncePerudoEtat, PerudoVue } from '../../shared/types';
import { Bouton } from './composants';
import { ReglesPerudo } from './regles-perudo';
import './perudo.css';

export function libelleFace(valeur: number): string {
  return valeur === 1 ? 'Paco' : String(valeur);
}

export function libelleAnnonce(annonce: AnnoncePerudoEtat, nom: (id: string) => string): string {
  return `${nom(annonce.joueurId)} : ${annonce.nombre} × ${libelleFace(annonce.valeur)}`;
}

const PIPS: Record<number, string[]> = {
  1: ['c'],
  2: ['tl', 'br'],
  3: ['tl', 'c', 'br'],
  4: ['tl', 'tr', 'bl', 'br'],
  5: ['tl', 'tr', 'c', 'bl', 'br'],
  6: ['tl', 'tr', 'ml', 'mr', 'bl', 'br'],
};

export function FaceDe({
  valeur,
  taille = 64,
  allumee = false,
  cachee = false,
}: {
  valeur: number;
  taille?: 64 | 128 | 192;
  allumee?: boolean;
  cachee?: boolean;
}) {
  const paco = valeur === 1 && !cachee;
  const classes = ['face-de', `taille-${taille}`];
  if (paco) classes.push('paco');
  if (allumee) classes.push('allumee');
  if (cachee) classes.push('cachee');
  return (
    <span class={classes.join(' ')} data-face={cachee ? '?' : valeur} aria-label={cachee ? 'Dé caché' : libelleFace(valeur)}>
      {cachee || paco
        ? null
        : (PIPS[valeur] ?? []).map((pip) => <span key={pip} class={`pip ${pip}`} />)}
      {paco ? <span class="libelle-paco">Paco</span> : null}
    </span>
  );
}

export function AnnonceVisuelle({ nombre, valeur, taille = 64 }: { nombre: number; valeur: number; taille?: 64 | 128 | 192 }) {
  return (
    <div class="annonce-perudo-ligne">
      <span class="nombre-annonce">{nombre} ×</span>
      <FaceDe valeur={valeur} taille={taille} />
    </div>
  );
}

export function RappelPerudo() {
  return (
    <ul class="historique-perudo" data-rappel="1">
      {RAPPEL_PERUDO.map((ligne) => (
        <li key={ligne}>{ligne}</li>
      ))}
    </ul>
  );
}

function placeElimine(perudo: PerudoVue, moiId: string): number {
  const index = perudo.elimines.indexOf(moiId);
  if (index < 0) return perudo.joueurs.length;
  return perudo.joueurs.length - index;
}

type Confirmation = 'annoncer' | 'dudo' | 'calza' | null;

export function PerudoJoueur({
  perudo,
  moiId,
  nom,
  occupe,
  envoyer,
}: {
  perudo: PerudoVue;
  moiId: string;
  nom: (id: string) => string;
  occupe: boolean;
  envoyer: (action: Action) => void | Promise<void>;
}) {
  const moi = perudo.joueurs.find((joueur) => joueur.id === moiId);
  const aMoi = perudo.courantId === moiId;
  const debut = plusPetiteAnnonce(perudo.annonce);
  const [nombre, setNombre] = useState(debut?.nombre ?? 1);
  const [valeur, setValeur] = useState(debut?.valeur ?? 2);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [regles, setRegles] = useState(false);
  const cleTour = `${perudo.numeroManche}|${perudo.etape}|${perudo.courantId}|${perudo.annonce?.nombre ?? 0}|${perudo.annonce?.valeur ?? 0}`;

  useEffect(() => {
    const suivante = plusPetiteAnnonce(perudo.annonce);
    if (suivante) {
      setNombre(suivante.nombre);
      setValeur(suivante.valeur);
    }
    setConfirmation(null);
  }, [cleTour]);

  if (regles) {
    return (
      <div class="pile" data-perudo-joueur="regles">
        <ReglesPerudo />
        <Bouton variante="secondaire" onClick={() => setRegles(false)}>
          Fermer les règles
        </Bouton>
      </div>
    );
  }

  if (perudo.etape === 'terminee') {
    return (
      <div class="pile" data-perudo-joueur="fin">
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

  if (moi?.elimine) {
    return (
      <div class="pile" data-perudo-joueur="elimine">
        <p class="elimine-perudo">Tu es éliminé, place n°{placeElimine(perudo, moiId)}</p>
      </div>
    );
  }

  if (confirmation) {
    const texte =
      confirmation === 'dudo'
        ? 'Dudo ! Tu doutes de l’annonce.'
        : confirmation === 'calza'
          ? 'Calza ! Tu paries sur le compte exact.'
          : `Annoncer ${nombre} × ${libelleFace(valeur)} ?`;
    return (
      <div class="pile" data-perudo-joueur="confirm">
        <p>{texte}</p>
        <Bouton
          plein
          disabled={occupe}
          onClick={() => {
            if (confirmation === 'annoncer') void envoyer({ type: 'annoncerPerudo', nombre, valeur });
            else if (confirmation === 'dudo') void envoyer({ type: 'dudoPerudo' });
            else void envoyer({ type: 'calzaPerudo' });
            setConfirmation(null);
          }}
        >
          Confirmer
        </Bouton>
        <Bouton variante="secondaire" disabled={occupe} onClick={() => setConfirmation(null)}>
          Annuler
        </Bouton>
      </div>
    );
  }

  return (
    <div class="pile" data-perudo-joueur={perudo.etape}>
      <h3>Perudo · manche {perudo.numeroManche}</h3>
      <Bouton variante="secondaire" onClick={() => setRegles(true)}>
        Règles
      </Bouton>
      {moi?.faces ? (
        <div class="mains-perudo" data-mes-des="1">
          {moi.faces.map((face, index) => (
            <FaceDe key={`${index}-${face}`} valeur={face} taille={64} />
          ))}
        </div>
      ) : perudo.etape === 'lancers' && moi && !moi.aLance ? (
        <Bouton plein disabled={occupe} onClick={() => void envoyer({ type: 'lancerDesPerudo' })}>
          Lancer mes dés
        </Bouton>
      ) : (
        <p>En attente des lancers…</p>
      )}
      <p>Dés en jeu : {perudo.totalDes}</p>
      {perudo.annonce ? <AnnonceVisuelle nombre={perudo.annonce.nombre} valeur={perudo.annonce.valeur} /> : <p>Pas encore d’annonce</p>}
      {perudo.etape === 'revelation' && perudo.revelation ? <p>{perudo.revelation.libelle}</p> : null}
      {perudo.etape === 'encheres' && aMoi ? (
        <>
          <div class="compteur-perudo">
            <button type="button" disabled={occupe || nombre <= 1} onClick={() => setNombre(nombre - 1)}>
              −
            </button>
            <span class="valeur">{nombre}</span>
            <button type="button" disabled={occupe} onClick={() => setNombre(nombre + 1)}>
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
                  disabled={occupe || !legale}
                  onClick={() => setValeur(face)}
                >
                  <FaceDe valeur={face} taille={64} />
                </button>
              );
            })}
          </div>
          <Bouton
            plein
            disabled={occupe || !annonceLegale(perudo.annonce, { nombre, valeur })}
            onClick={() => setConfirmation('annoncer')}
          >
            Annoncer
          </Bouton>
          <Bouton plein variante="danger" disabled={occupe || !perudo.annonce} onClick={() => setConfirmation('dudo')}>
            Dudo !
          </Bouton>
          {perudo.calza ? (
            <span class="bouton-calza">
              <Bouton plein disabled={occupe || !perudo.annonce} onClick={() => setConfirmation('calza')}>
                Calza !
              </Bouton>
            </span>
          ) : null}
        </>
      ) : perudo.etape === 'encheres' ? (
        <p>Au tour de {nom(perudo.courantId ?? '')}</p>
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
