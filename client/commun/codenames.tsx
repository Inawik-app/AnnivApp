import { useEffect, useRef, useState } from 'preact/hooks';
import { libelleEquipe, libelleNombre, type EquipeCodenames, type NombreIndice } from '../../shared/codenames';
import type { Action, CarteCodenamesVue, CodenamesVue, MancheCodenamesVue } from '../../shared/types';
import { Bouton } from './composants';
import './codenames.css';

function classeCouleur(carte: CarteCodenamesVue): string {
  if (!carte.couleur) return '';
  return `couleur-${carte.couleur}`;
}

import { Icone } from './icones';

function Crane() {
  return <Icone nom="crane" taille={64} />;
}

export function CarteCodenames({
  carte,
  onPointerDown,
  onPointerUp,
  onClick,
  agrandie,
  interactive,
}: {
  carte: CarteCodenamesVue;
  onPointerDown?: () => void;
  onPointerUp?: () => void;
  onClick?: () => void;
  agrandie?: boolean;
  interactive?: boolean;
}) {
  const classes = ['carte-codenames', classeCouleur(carte)];
  if (carte.revelee) classes.push('revelee');
  if (agrandie) classes.push('agrandie');
  if (interactive) {
    return (
      <button
        type="button"
        class={classes.join(' ')}
        data-index={carte.index}
        data-revelee={carte.revelee ? '1' : '0'}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={onClick}
      >
        {carte.couleur === 'assassin' && carte.revelee ? <Crane /> : null}
        <span>{carte.mot}</span>
      </button>
    );
  }
  return (
    <div
      class={classes.join(' ')}
      data-index={carte.index}
      data-revelee={carte.revelee ? '1' : '0'}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {carte.couleur === 'assassin' && carte.revelee ? <Crane /> : null}
      <span>{carte.mot}</span>
    </div>
  );
}

export function GrilleCodenames({
  cartes,
  onLongPress,
  onTap,
  interactive,
}: {
  cartes: CarteCodenamesVue[];
  onLongPress?: (carte: CarteCodenamesVue) => void;
  onTap?: (carte: CarteCodenamesVue) => void;
  interactive?: boolean;
}) {
  const [agrandie, setAgrandie] = useState<number | null>(null);
  const timer = useRef<number | null>(null);
  const long = useRef(false);

  const debut = (carte: CarteCodenamesVue) => {
    long.current = false;
    if (!onLongPress) return;
    timer.current = window.setTimeout(() => {
      long.current = true;
      setAgrandie(carte.index);
      onLongPress(carte);
    }, 450);
  };

  const fin = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    setAgrandie(null);
  };

  return (
    <div class="grille-codenames">
      {cartes.map((carte) => (
        <CarteCodenames
          key={carte.index}
          carte={carte}
          agrandie={agrandie === carte.index}
          interactive={interactive || !!onLongPress || !!onTap}
          onPointerDown={() => debut(carte)}
          onPointerUp={fin}
          onClick={() => {
            if (long.current) return;
            onTap?.(carte);
          }}
        />
      ))}
    </div>
  );
}

const NOMBRES: NombreIndice[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 'infini'];

export function FormulaireIndice({
  occupe,
  envoyer,
}: {
  occupe: boolean;
  envoyer: (action: Action) => void | Promise<void>;
}) {
  const [mot, setMot] = useState('');
  const [nombre, setNombre] = useState<NombreIndice>(1);
  return (
    <div class="saisie-indice" data-indice="saisie">
      <input
        type="text"
        value={mot}
        placeholder="Indice"
        autocomplete="off"
        autocapitalize="characters"
        disabled={occupe}
        onInput={(event) => setMot((event.currentTarget as HTMLInputElement).value)}
      />
      <div class="nombres-indice">
        {NOMBRES.map((candidat) => (
          <button
            key={String(candidat)}
            type="button"
            class={nombre === candidat ? 'choisi' : undefined}
            disabled={occupe}
            onClick={() => setNombre(candidat)}
          >
            {libelleNombre(candidat)}
          </button>
        ))}
      </div>
      <Bouton
        plein
        disabled={occupe || !mot.trim()}
        onClick={() => void envoyer({ type: 'proposerIndiceCodenames', mot: mot.trim(), nombre })}
      >
        Proposer l’indice
      </Bouton>
    </div>
  );
}

function InfosManche({ manche, nom }: { manche: MancheCodenamesVue; nom: (id: string) => string }) {
  return (
    <>
      <p>
        Manche {manche.numero} · équipe {libelleEquipe(manche.equipeCourante)}
        {manche.acteurId ? ` · ${nom(manche.acteurId)}` : ''}
      </p>
      <p>
        Restants : rouge {manche.restants.rouge} · bleu {manche.restants.bleu}
      </p>
      {manche.indice ? (
        <p>
          Indice : {manche.indice.mot} {libelleNombre(manche.indice.nombre)}
          {manche.essaisRestants !== null ? ` · ${manche.essaisRestants} essai${manche.essaisRestants > 1 ? 's' : ''}` : ' · ∞'}
        </p>
      ) : null}
      {manche.indicePropose ? (
        <p>
          Proposition : {manche.indicePropose.mot} {libelleNombre(manche.indicePropose.nombre)}
        </p>
      ) : null}
    </>
  );
}

export function CodenamesJoueur({
  codenames,
  nom,
  occupe,
  envoyer,
}: {
  codenames: CodenamesVue;
  nom: (id: string) => string;
  occupe: boolean;
  envoyer: (action: Action) => void | Promise<void>;
}) {
  const manche = codenames.courante;
  const [aRetourner, setARetourner] = useState<CarteCodenamesVue | null>(null);

  useEffect(() => {
    setARetourner(null);
  }, [manche?.etape, manche?.equipeCourante, manche?.indice?.mot]);

  if (!manche) {
    return (
      <div class="pile" data-codenames-joueur="attente">
        <h3>Codenames</h3>
        <p class="attente-codenames">Composition des équipes…</p>
      </div>
    );
  }

  if (manche.etape === 'finie') {
    return (
      <div class="pile" data-codenames-joueur="finie">
        <h3>Codenames</h3>
        <p>
          {manche.gagnant
            ? `L’équipe ${libelleEquipe(manche.gagnant)} gagne`
            : 'Manche terminée'}
        </p>
        <ul class="recap-ordre">
          {Object.entries(manche.gains)
            .filter(([, montant]) => montant > 0)
            .map(([id, montant]) => (
              <li key={id}>
                {nom(id)} : +{montant} GP
              </li>
            ))}
        </ul>
        <GrilleCodenames cartes={manche.cartes} />
      </div>
    );
  }

  if (!manche.monRole || !manche.monEquipe) {
    return (
      <div class="pile" data-codenames-joueur="spectateur">
        <h3>Codenames</h3>
        <p class="attente-codenames">Tu n’es pas dans une équipe.</p>
      </div>
    );
  }

  const monTour = manche.acteurId !== '' && (
    (manche.monRole === 'espion' && manche.etape === 'indice' && manche.monEquipe === manche.equipeCourante) ||
    (manche.monRole === 'agent' && manche.etape === 'choix' && manche.monEquipe === manche.equipeCourante)
  );
  const adversaire = manche.monEquipe !== manche.equipeCourante;

  if (aRetourner) {
    return (
      <div class="pile" data-codenames-joueur="confirm">
        <div class="confirm-retourner">
          <p>Retourner {aRetourner.mot} ?</p>
          <Bouton
            plein
            disabled={occupe}
            onClick={() => {
              void envoyer({ type: 'retournerMotCodenames', index: aRetourner.index });
              setARetourner(null);
            }}
          >
            Retourner
          </Bouton>
          <Bouton variante="secondaire" disabled={occupe} onClick={() => setARetourner(null)}>
            Annuler
          </Bouton>
        </div>
      </div>
    );
  }

  return (
    <div class="pile" data-codenames-joueur={manche.monRole}>
      <h3>
        Codenames · {manche.monRole === 'espion' ? 'espion' : 'agent'} {libelleEquipe(manche.monEquipe)}
      </h3>
      <InfosManche manche={manche} nom={nom} />
      {adversaire ? (
        <p class="attente-codenames">Au tour de l’équipe {libelleEquipe(manche.equipeCourante)}</p>
      ) : null}
      {manche.monRole === 'espion' && monTour && !manche.indicePropose ? (
        <FormulaireIndice occupe={occupe} envoyer={envoyer} />
      ) : null}
      {manche.monRole === 'espion' && manche.indicePropose ? (
        <p>Indice envoyé, en attente de l’hôte…</p>
      ) : null}
      <GrilleCodenames
        cartes={manche.cartes}
        interactive={manche.monRole === 'agent' && monTour}
        onLongPress={manche.monRole === 'espion' ? () => undefined : undefined}
        onTap={
          manche.monRole === 'agent' && monTour
            ? (carte) => {
                if (!carte.revelee) setARetourner(carte);
              }
            : undefined
        }
      />
      {manche.monRole === 'agent' && monTour ? (
        <Bouton plein variante="secondaire" disabled={occupe} onClick={() => void envoyer({ type: 'finirTourCodenames' })}>
          Fin du tour
        </Bouton>
      ) : null}
    </div>
  );
}

export function libelleEquipeCodenames(equipe: EquipeCodenames): string {
  return libelleEquipe(equipe);
}
