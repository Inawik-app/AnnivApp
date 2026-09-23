import type { Action, UndercoverVue } from '../../shared/types';
import { Bouton } from '../commun/composants';
import { BilanUndercover, GainsUndercover, texteIssue } from '../commun/undercover';

export function PanneauUndercover({
  undercover,
  pseudos,
  envoi,
  agir,
}: {
  undercover: UndercoverVue;
  pseudos: Map<string, string>;
  envoi: boolean;
  agir: (action: Action) => void;
}) {
  const nom = (id: string) => pseudos.get(id) ?? 'Joueur';
  const manche = undercover.courante;
  const jouees = undercover.bilan.length;
  const libre = !manche || manche.etape === 'finie';
  const peutLancer = !undercover.recap && libre && jouees < undercover.nbManches;
  const peutRecap = !undercover.recap && libre && jouees >= undercover.nbManches;
  const enJeu = manche ? manche.ordreParole.filter((id) => !manche.elimines.some((entree) => entree.id === id)) : [];
  return (
    <div class="pile" data-panneau-undercover={manche?.etape ?? 'attente'}>
      <p>
        Civils : {undercover.gainCivils} GP chacun si l'undercover est éliminé · undercover : {undercover.gainUndercoverDevine} GP
        s'il devine le mot, {undercover.gainUndercoverSurvit} GP s'il reste parmi les 2 derniers
      </p>
      {manche ? (
        <div class="pile">
          <h3>
            Manche {manche.numero} sur {undercover.nbManches}
            {manche.etape === 'indices' ? ` · tour ${manche.tour}` : ''}
          </h3>
          {manche.paire ? (
            <p class="reponse-jeopardy">
              Civils : {manche.paire.civils} · undercover : {manche.paire.undercover}
              {manche.undercoverId ? ` (${nom(manche.undercoverId)})` : ''}
            </p>
          ) : null}
          <p>Ordre de parole : {manche.ordreParole.map(nom).join(', ')}</p>
          {manche.elimines.length > 0 ? (
            <p>
              Éliminés : {manche.elimines.map((entree) => `${nom(entree.id)} (${entree.role})`).join(', ')}
            </p>
          ) : null}
          {manche.etape === 'indices' ? (
            <>
              <p>Qui est éliminé ?</p>
              <div class="grille-hote">
                {enJeu.map((id) => (
                  <Bouton key={id} variante="danger" disabled={envoi} onClick={() => agir({ type: 'eliminerUndercover', joueurId: id })}>
                    Éliminer {nom(id)}
                  </Bouton>
                ))}
              </div>
            </>
          ) : null}
          {manche.etape === 'devine' && manche.undercoverId ? (
            <>
              <p>{nom(manche.undercoverId)} tente de deviner le mot des civils.</p>
              <Bouton plein disabled={envoi} onClick={() => agir({ type: 'devinerUndercover', trouve: true })}>
                Mot trouvé
              </Bouton>
              <Bouton plein variante="secondaire" disabled={envoi} onClick={() => agir({ type: 'devinerUndercover', trouve: false })}>
                Raté
              </Bouton>
            </>
          ) : null}
          {manche.etape === 'finie' ? (
            <>
              <p>{texteIssue(manche)}</p>
              <GainsUndercover gains={manche.gains} nom={nom} />
            </>
          ) : null}
        </div>
      ) : null}
      {peutLancer ? (
        <Bouton plein disabled={envoi} onClick={() => agir({ type: 'lancerMancheUndercover' })}>
          Lancer la manche {jouees + 1}
        </Bouton>
      ) : null}
      {peutRecap ? (
        <Bouton plein disabled={envoi} onClick={() => agir({ type: 'recapUndercover' })}>
          Afficher le récapitulatif
        </Bouton>
      ) : null}
      {undercover.recap ? <BilanUndercover undercover={undercover} nom={nom} /> : null}
    </div>
  );
}
