import { JUSTONE_HOTE } from '../../shared/justone';
import type { Action, JustOneVue } from '../../shared/types';
import { Bouton } from '../commun/composants';
import {
  FormulaireIndiceJustOne,
  ListeIndices,
  nomJustOne,
} from '../commun/justone';

export function PanneauJustOne({
  justone,
  pseudos,
  envoi,
  agir,
}: {
  justone: JustOneVue;
  pseudos: Map<string, string>;
  envoi: boolean;
  agir: (action: Action) => void;
}) {
  const nom = nomJustOne(justone, pseudos);
  const manche = justone.courante;
  const jouees = justone.bilan.length;
  const peutLancer = !justone.recap && (!manche || manche.etape === 'finie') && jouees < justone.totalManches;
  const peutRecap = !justone.recap && jouees >= justone.totalManches && (!manche || manche.etape === 'finie');
  const hoteIndique = !!manche && manche.devineurId !== JUSTONE_HOTE && manche.doitIndiquer;
  const hoteDevine = !!manche && manche.devineurId === JUSTONE_HOTE;

  return (
    <div class="pile justone-zones" data-panneau-justone="1">
      <p>
        +{justone.gainDevineur} GP au devineur · +{justone.gainIndice} GP par indice utile · {justone.totalManches} manches
      </p>

      {manche ? (
        <>
          <section class="pile" data-zone="mon-jeu">
            <h3>Mon jeu</h3>
            {hoteDevine && (manche.etape === 'indices' || manche.etape === 'verification') ? (
              <p class="justone-avertissement">Ne regarde pas les indices des autres.</p>
            ) : null}
            {hoteIndique ? <FormulaireIndiceJustOne occupe={envoi} envoyer={agir} /> : null}
            {manche.monIndice && manche.etape === 'indices' ? <p>Ton indice : {manche.monIndice}</p> : null}
            {manche.mot && !hoteDevine ? (
              <p class="justone-secret">
                Mot secret : <strong>{manche.mot}</strong>
              </p>
            ) : null}
            {(manche.etape === 'verification' ||
              manche.etape === 'revelation' ||
              manche.etape === 'reponse' ||
              manche.etape === 'finie') &&
            !hoteDevine ? (
              <ListeIndices
                manche={manche}
                nom={nom}
                selectionnable={manche.etape === 'verification'}
                surProposer={(indexA, indexB) => agir({ type: 'proposerAnnulationJustOne', indexA, indexB })}
              />
            ) : null}
            {hoteDevine && (manche.etape === 'revelation' || manche.etape === 'reponse') ? (
              <>
                <ListeIndices manche={manche} nom={nom} />
                <p>Propose le mot à voix haute.</p>
              </>
            ) : null}
          </section>

          <section class="pile" data-zone="arbitrage">
            <h3>Arbitrage</h3>
            <p>
              Manche {manche.numero} sur {justone.totalManches} · {nom(manche.devineurId)} devine
            </p>
            {manche.propositionAnnulation ? (
              <div class="grille-hote">
                <Bouton disabled={envoi} onClick={() => agir({ type: 'validerAnnulationJustOne', accepter: true })}>
                  Accepter l'annulation
                </Bouton>
                <Bouton
                  variante="secondaire"
                  disabled={envoi}
                  onClick={() => agir({ type: 'validerAnnulationJustOne', accepter: false })}
                >
                  Refuser
                </Bouton>
              </div>
            ) : null}
            {(manche.etape === 'verification' || manche.etape === 'indices') &&
            manche.indices.length > 0 &&
            !manche.propositionAnnulation ? (
              <Bouton plein disabled={envoi} onClick={() => agir({ type: 'revelerIndicesJustOne' })}>
                Révéler les indices
              </Bouton>
            ) : null}
            {(manche.etape === 'revelation' || manche.etape === 'reponse') && (
              <div class="grille-hote">
                <Bouton disabled={envoi} onClick={() => agir({ type: 'jugerJustOne', issue: 'trouve' })}>
                  Trouvé
                </Bouton>
                <Bouton variante="secondaire" disabled={envoi} onClick={() => agir({ type: 'jugerJustOne', issue: 'rate' })}>
                  Raté
                </Bouton>
                <Bouton variante="secondaire" disabled={envoi} onClick={() => agir({ type: 'jugerJustOne', issue: 'passe' })}>
                  Passe
                </Bouton>
              </div>
            )}
            {manche.etape === 'finie' ? (
              <p>
                {manche.issue === 'trouve' ? 'Trouvé' : manche.issue === 'passe' ? 'Passé' : 'Raté'} · mot : {manche.mot}
              </p>
            ) : null}
          </section>
        </>
      ) : (
        <p>Ordre des devineurs : {justone.ordreDevineurs.map(nom).join(', ')}</p>
      )}

      {peutLancer ? (
        <Bouton plein disabled={envoi} onClick={() => agir({ type: 'lancerMancheJustOne' })}>
          Lancer la manche {jouees + 1}
        </Bouton>
      ) : null}
      {peutRecap ? (
        <Bouton plein disabled={envoi} onClick={() => agir({ type: 'recapJustOne' })}>
          Afficher le récapitulatif
        </Bouton>
      ) : null}
      {justone.recap || jouees > 0 ? (
        <ul class="recap-ordre">
          {justone.bilan.map((ligne) => (
            <li key={ligne.numero}>
              Manche {ligne.numero} · {nom(ligne.devineurId)} · {ligne.issue ?? '—'}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
