import { REPONSE_AUCUNE } from '../../shared/jeopardy';
import type { Action, JeopardyVue } from '../../shared/types';
import { Bouton } from '../commun/composants';
import { texteGains } from '../commun/jeopardy';

export function PanneauJeopardy({
  jeopardy,
  ordre,
  pseudos,
  envoi,
  agir,
}: {
  jeopardy: JeopardyVue;
  ordre: string[];
  pseudos: Map<string, string>;
  envoi: boolean;
  agir: (action: Action) => void;
}) {
  const nom = (id: string) => pseudos.get(id) ?? 'Joueur';
  const gains = (
    <ul class="recap-ordre">
      {texteGains(jeopardy, ordre, nom).map((ligne) => (
        <li key={ligne}>{ligne}</li>
      ))}
    </ul>
  );
  if (jeopardy.termine) {
    return (
      <div class="pile" data-panneau-jeopardy="fin">
        <h3>Jeopardy terminé</h3>
        {gains}
      </div>
    );
  }
  const question = jeopardy.question;
  if (question) {
    return (
      <div class="pile" data-panneau-jeopardy="question">
        <h3>
          {jeopardy.themes[question.theme]} pour {question.valeur} GP · choisie par {nom(question.choisisseurId)}
        </h3>
        <p class="question-jeopardy">{question.texte}</p>
        <p class="reponse-jeopardy">
          {question.reponse ?? REPONSE_AUCUNE}
          {question.accepte && question.accepte.length > 0 ? ` · accepté : ${question.accepte.join(', ')}` : ''}
        </p>
        {question.elimines.length > 0 ? <p>Déjà trompés : {question.elimines.map(nom).join(', ')}</p> : null}
        {question.mainId ? (
          <>
            <Bouton plein disabled={envoi} onClick={() => agir({ type: 'jugerJeopardy', juste: true })}>
              Juste : {nom(question.mainId)}
            </Bouton>
            <Bouton plein variante="danger" disabled={envoi} onClick={() => agir({ type: 'jugerJeopardy', juste: false })}>
              Faux
            </Bouton>
          </>
        ) : (
          <p>Buzzers ouverts : le premier qui buzze prend la main.</p>
        )}
        <Bouton plein variante="secondaire" disabled={envoi} onClick={() => agir({ type: 'personneJeopardy' })}>
          Personne
        </Bouton>
      </div>
    );
  }
  return (
    <div class="pile" data-panneau-jeopardy="grille">
      <p>Qui choisit la case ?</p>
      <div class="grille-hote">
        {ordre.map((id) => (
          <Bouton
            key={id}
            variante={id === jeopardy.choisisseurId ? 'or' : 'secondaire'}
            disabled={envoi}
            onClick={() => agir({ type: 'choisirChoisisseurJeopardy', joueurId: id })}
          >
            {nom(id)}
          </Bouton>
        ))}
      </div>
      <p>Touche la case annoncée{jeopardy.choisisseurId ? ` par ${nom(jeopardy.choisisseurId)}` : ''} :</p>
      {jeopardy.themes.map((theme, indexTheme) => (
        <div key={theme} class="case-jeopardy-hote">
          <h4>{theme}</h4>
          <div class="grille-hote">
            {jeopardy.valeurs.map((valeur, niveau) => {
              const jouee = jeopardy.jouees.some((entree) => entree.theme === indexTheme && entree.niveau === niveau);
              return (
                <Bouton
                  key={valeur}
                  disabled={envoi || jouee || !jeopardy.choisisseurId}
                  onClick={() => agir({ type: 'choisirCaseJeopardy', theme: indexTheme, niveau })}
                >
                  {jouee ? 'joué' : `${valeur} GP`}
                </Bouton>
              );
            })}
          </div>
        </div>
      ))}
      {gains}
      <Bouton variante="secondaire" disabled={envoi} onClick={() => agir({ type: 'terminerJeopardy' })}>
        Arrêter le Jeopardy
      </Bouton>
    </div>
  );
}
