import { useState } from 'preact/hooks';
import { REPONDANT_HOTE } from '../../shared/topten';
import type { Action, TopTenVue } from '../../shared/types';
import { Bouton } from '../commun/composants';
import { BilanTopTen, ClassementTopTen, NumeroSecret, ResultatManche, nommeur, texteTheme } from '../commun/topten';

export function PanneauTopTen({
  topten,
  pseudos,
  envoi,
  agir,
}: {
  topten: TopTenVue;
  pseudos: Map<string, string>;
  envoi: boolean;
  agir: (action: Action) => void;
}) {
  const [aLaPlace, setALaPlace] = useState<number | null>(null);
  const nom = nommeur(topten, pseudos);
  const manche = topten.courante;
  const nbManches = topten.captens.length;
  const jouees = topten.bilan.length;
  const peutLancer = !topten.recap && (!manche || manche.etape === 'revelee') && jouees < nbManches;
  const peutRecap = !topten.recap && jouees > 0 && jouees >= nbManches && manche?.etape === 'revelee';
  return (
    <div class="pile" data-panneau-topten="1">
      <p>
        {topten.pointsParPaire} GP par paire bien ordonnée · +{topten.bonusOrdreParfait} si l'ordre est parfait · chiffres exacts :{' '}
        {topten.bonusChiffresExacts.join(' / ')}
      </p>
      {manche ? (
        <div class="pile">
          <h3>
            Manche {manche.numero} sur {nbManches} · Cap'Ten : {nom(manche.captenId)}
          </h3>
          <p class="theme-topten">{manche.theme.intitule}</p>
          <p>{texteTheme(manche.theme)}</p>
          {manche.etape === 'reponses' ? (
            <>
              {manche.monNumero !== null ? (
                <>
                  <p>Ton numéro :</p>
                  <NumeroSecret numero={manche.monNumero} />
                </>
              ) : null}
              {manche.numeros ? (
                <ul class="recap-ordre" data-numeros-hote="1">
                  {manche.repondants.map((id) => (
                    <li key={id}>
                      {nom(id)}
                      {id === REPONDANT_HOTE ? ' (toi)' : ''} : {manche.numeros?.[id]}
                    </li>
                  ))}
                </ul>
              ) : null}
              {aLaPlace === manche.numero ? (
                <ClassementTopTen key={manche.numero} manche={manche} nom={nom} occupe={envoi} envoyer={agir} />
              ) : (
                <Bouton variante="secondaire" disabled={envoi} onClick={() => setALaPlace(manche.numero)}>
                  Classer à la place du Cap'Ten
                </Bouton>
              )}
            </>
          ) : (
            <ResultatManche manche={manche} nom={nom} />
          )}
        </div>
      ) : (
        <p>Cap'Ten dans l'ordre : {topten.captens.map(nom).join(', ')}</p>
      )}
      {peutLancer ? (
        <Bouton plein disabled={envoi} onClick={() => agir({ type: 'lancerMancheTopTen' })}>
          Lancer la manche {jouees + 1}
        </Bouton>
      ) : null}
      {peutRecap ? (
        <Bouton plein disabled={envoi} onClick={() => agir({ type: 'recapTopTen' })}>
          Afficher le récapitulatif
        </Bouton>
      ) : null}
      {topten.recap || jouees > 0 ? <BilanTopTen topten={topten} nom={nom} /> : null}
    </div>
  );
}
