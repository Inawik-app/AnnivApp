import { useState } from 'preact/hooks';
import { libelleEquipe, libelleNombre, type EquipeCodenames } from '../../shared/codenames';
import type { Action, CodenamesVue } from '../../shared/types';
import { Bouton } from '../commun/composants';
import { FormulaireIndice, GrilleCodenames } from '../commun/codenames';

export function PanneauCodenames({
  codenames,
  ordre,
  pseudos,
  envoi,
  agir,
}: {
  codenames: CodenamesVue;
  ordre: string[];
  pseudos: Map<string, string>;
  envoi: boolean;
  agir: (action: Action) => void;
}) {
  const nom = (id: string) => pseudos.get(id) ?? 'Joueur';
  const manche = codenames.courante;
  const prep = codenames.preparation;
  const [equipeCible, setEquipeCible] = useState<EquipeCodenames>('rouge');

  const equipeDe = (id: string): EquipeCodenames | null => {
    if (prep.equipes.rouge.includes(id) || manche?.equipes.rouge.includes(id)) return 'rouge';
    if (prep.equipes.bleu.includes(id) || manche?.equipes.bleu.includes(id)) return 'bleu';
    return null;
  };

  const basculer = (id: string) => {
    const actuelle = equipeDe(id);
    if (actuelle === equipeCible) {
      agir({ type: 'affecterCodenames', joueurId: id, equipe: null });
      return;
    }
    agir({ type: 'affecterCodenames', joueurId: id, equipe: equipeCible });
  };

  const peutLancerPrep =
    prep.equipes.rouge.length === 2 &&
    prep.equipes.bleu.length === 2 &&
    !!prep.espions.rouge &&
    !!prep.espions.bleu;

  if (!manche) {
    return (
      <div class="pile" data-panneau-codenames="preparation">
        <p>
          Gains : {codenames.gainGagnant} GP gagnants · {codenames.gainPerdant} GP perdants · {codenames.nbManches} manches
        </p>
        <p>Compose les équipes (2 et 2), puis désigne un espion par équipe.</p>
        <div class="grille-hote">
          <Bouton variante={equipeCible === 'rouge' ? 'or' : 'secondaire'} disabled={envoi} onClick={() => setEquipeCible('rouge')}>
            Placer en rouge
          </Bouton>
          <Bouton variante={equipeCible === 'bleu' ? 'or' : 'secondaire'} disabled={envoi} onClick={() => setEquipeCible('bleu')}>
            Placer en bleu
          </Bouton>
        </div>
        <div class="grille-hote">
          {ordre.map((id) => {
            const equipe = equipeDe(id);
            return (
              <Bouton key={id} disabled={envoi} onClick={() => basculer(id)}>
                {nom(id)}
                {equipe ? ` · ${libelleEquipe(equipe)}` : ''}
              </Bouton>
            );
          })}
        </div>
        <Bouton variante="secondaire" disabled={envoi} onClick={() => agir({ type: 'equipesHasardCodenames' })}>
          Équipes au hasard
        </Bouton>
        <div class="grille-hote">
          {(['rouge', 'bleu'] as EquipeCodenames[]).map((equipe) => (
            <div key={equipe} class="pile">
              <p>Espion {libelleEquipe(equipe)}</p>
              {prep.equipes[equipe].map((id) => (
                <Bouton
                  key={id}
                  variante={prep.espions[equipe] === id ? 'or' : 'secondaire'}
                  disabled={envoi}
                  onClick={() => agir({ type: 'designerEspionCodenames', equipe, joueurId: id })}
                >
                  {nom(id)}
                </Bouton>
              ))}
            </div>
          ))}
        </div>
        {peutLancerPrep ? (
          <Bouton plein disabled={envoi} onClick={() => agir({ type: 'lancerGrilleCodenames' })}>
            Lancer la grille
          </Bouton>
        ) : null}
      </div>
    );
  }

  return (
    <div class="pile" data-panneau-codenames={manche.etape}>
      <h3>
        Manche {manche.numero} sur {codenames.nbManches} · équipe {libelleEquipe(manche.equipeCourante)}
      </h3>
      <p>
        Restants : rouge {manche.restants.rouge} · bleu {manche.restants.bleu}
      </p>
      {manche.indicePropose ? (
        <>
          <p class="reponse-jeopardy">
            Proposition : {manche.indicePropose.mot} {libelleNombre(manche.indicePropose.nombre)}
          </p>
          <Bouton plein disabled={envoi} onClick={() => agir({ type: 'validerIndiceCodenames' })}>
            Valider l’indice
          </Bouton>
          <Bouton plein variante="danger" disabled={envoi} onClick={() => agir({ type: 'refuserIndiceCodenames' })}>
            Refuser l’indice
          </Bouton>
        </>
      ) : null}
      {manche.etape === 'indice' && !manche.indicePropose ? (
        <>
          <p>Donner l’indice pour {nom(manche.espions[manche.equipeCourante])}</p>
          <FormulaireIndice occupe={envoi} envoyer={(action) => agir(action)} />
        </>
      ) : null}
      {manche.indice ? (
        <p>
          Indice : {manche.indice.mot} {libelleNombre(manche.indice.nombre)}
          {manche.essaisRestants !== null ? ` · ${manche.essaisRestants} essai(s)` : ' · ∞'}
        </p>
      ) : null}
      <p>Clé (toujours visible)</p>
      <GrilleCodenames
        cartes={manche.cartes}
        interactive={manche.etape === 'choix'}
        onTap={
          manche.etape === 'choix'
            ? (carte) => {
                if (!carte.revelee) agir({ type: 'retournerMotCodenames', index: carte.index });
              }
            : undefined
        }
      />
      {manche.etape === 'choix' ? (
        <Bouton variante="secondaire" disabled={envoi} onClick={() => agir({ type: 'finirTourCodenames' })}>
          Fin du tour
        </Bouton>
      ) : null}
      {manche.etape === 'finie' ? (
        <>
          <p>{manche.gagnant ? `L’équipe ${libelleEquipe(manche.gagnant)} gagne` : 'Manche terminée'}</p>
          <ul class="recap-ordre">
            {Object.entries(manche.gains)
              .filter(([, montant]) => montant > 0)
              .map(([id, montant]) => (
                <li key={id}>
                  {nom(id)} : +{montant} GP
                </li>
              ))}
          </ul>
          {manche.numero < codenames.nbManches ? (
            <Bouton plein disabled={envoi} onClick={() => agir({ type: 'lancerGrilleCodenames' })}>
              Lancer la grille suivante
            </Bouton>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
