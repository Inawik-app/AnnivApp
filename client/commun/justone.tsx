import { useState } from 'preact/hooks';
import { JUSTONE_HOTE } from '../../shared/justone';
import type { Action, JustOneVue, MancheJustOneVue } from '../../shared/types';
import { Bouton } from './composants';
import { Icone } from './icones';
import './justone.css';

export function nomJustOne(justone: JustOneVue, pseudos: Map<string, string>): (id: string) => string {
  return (id) => (id === JUSTONE_HOTE ? justone.nomHote : pseudos.get(id) ?? 'Joueur');
}

export function FormulaireIndiceJustOne({
  occupe,
  envoyer,
  joueurId,
}: {
  occupe: boolean;
  envoyer: (action: Action) => void;
  joueurId?: string;
}) {
  const [mot, setMot] = useState('');
  return (
    <div class="pile justone-formulaire" data-formulaire-indice="1">
      <label>
        Ton indice (un seul mot)
        <input
          type="text"
          value={mot}
          autocomplete="off"
          autocorrect="off"
          spellcheck={false}
          disabled={occupe}
          onInput={(event) => setMot((event.target as HTMLInputElement).value)}
        />
      </label>
      <Bouton
        plein
        disabled={occupe || !mot.trim()}
        onClick={() => {
          const action: Action = joueurId
            ? { type: 'proposerIndiceJustOne', mot: mot.trim(), joueurId }
            : { type: 'proposerIndiceJustOne', mot: mot.trim() };
          envoyer(action);
          setMot('');
        }}
      >
        Envoyer mon indice
      </Bouton>
    </div>
  );
}

export function ListeIndices({
  manche,
  nom,
  selectionnable,
  surProposer,
}: {
  manche: MancheJustOneVue;
  nom: (id: string) => string;
  selectionnable?: boolean;
  surProposer?: (indexA: number, indexB: number) => void;
}) {
  const [choix, setChoix] = useState<number[]>([]);
  const basculer = (index: number) => {
    if (!selectionnable || !surProposer) return;
    setChoix((actuel) => {
      if (actuel.includes(index)) return actuel.filter((valeur) => valeur !== index);
      const suivant = [...actuel, index].slice(-2);
      if (suivant.length === 2) {
        surProposer(suivant[0]!, suivant[1]!);
        return [];
      }
      return suivant;
    });
  };
  return (
    <ul class="justone-indices" data-indices="1">
      {manche.indices.map((indice, index) => {
        const classes = ['justone-carte'];
        if (indice.annule) classes.push('annulee');
        if (choix.includes(index)) classes.push('choisie');
        return (
          <li key={`${indice.auteurId}-${index}`}>
            <button
              type="button"
              class={classes.join(' ')}
              disabled={!selectionnable || !!manche.propositionAnnulation}
              onClick={() => basculer(index)}
            >
              <span class="justone-auteur">{nom(indice.auteurId)}</span>
              {indice.annule ? <Icone nom="croix" taille={64} /> : <span class="justone-mot">{indice.mot ?? '…'}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function JustOneJoueur({
  justone,
  pseudos,
  occupe,
  envoyer,
}: {
  justone: JustOneVue;
  moiId?: string;
  pseudos: Map<string, string>;
  occupe: boolean;
  envoyer: (action: Action) => void;
}) {
  const nom = nomJustOne(justone, pseudos);
  const manche = justone.courante;
  if (!manche) {
    return (
      <div class="pile" data-justone-joueur="attente">
        <p>Just One · {justone.totalManches} manches · +{justone.gainDevineur} / +{justone.gainIndice} GP</p>
        <p>En attente de la manche…</p>
      </div>
    );
  }
  if (manche.jeSuisDevineur && (manche.etape === 'indices' || manche.etape === 'verification')) {
    return (
      <div class="pile" data-justone-joueur="devineur-attente">
        <p class="justone-avertissement">Ne regarde pas les autres écrans.</p>
        <p>Les autres écrivent leurs indices pour toi.</p>
      </div>
    );
  }
  return (
    <div class="pile" data-justone-joueur={manche.etape}>
      <p>
        Manche {manche.numero} · {nom(manche.devineurId)} devine
      </p>
      {manche.mot ? <p class="justone-secret">Mot secret : <strong>{manche.mot}</strong></p> : null}
      {manche.doitIndiquer ? <FormulaireIndiceJustOne occupe={occupe} envoyer={envoyer} /> : null}
      {manche.monIndice && manche.etape === 'indices' ? <p>Ton indice : {manche.monIndice}</p> : null}
      {(manche.etape === 'verification' ||
        manche.etape === 'revelation' ||
        manche.etape === 'reponse' ||
        manche.etape === 'finie') && (
        <ListeIndices
          manche={manche}
          nom={nom}
          selectionnable={manche.etape === 'verification' && !manche.jeSuisDevineur}
          surProposer={(indexA, indexB) => envoyer({ type: 'proposerAnnulationJustOne', indexA, indexB })}
        />
      )}
      {manche.etape === 'revelation' || manche.etape === 'reponse' ? (
        <p>{manche.jeSuisDevineur ? 'Propose le mot à voix haute.' : 'Le devineur cherche…'}</p>
      ) : null}
      {manche.etape === 'finie' ? (
        <p>
          {manche.issue === 'trouve' ? 'Trouvé !' : manche.issue === 'passe' ? 'Passé.' : 'Raté.'}
          {manche.mot ? ` Le mot était ${manche.mot}.` : ''}
        </p>
      ) : null}
    </div>
  );
}
