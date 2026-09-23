import type { MancheUndercoverVue, UndercoverVue } from '../../shared/types';
import { SecretAuDoigt } from './secret';
import './undercover.css';

export function texteIssue(manche: { issue: 'civils' | 'undercover' | null; devine?: boolean | null }): string {
  if (manche.issue === 'undercover') return "L'undercover survit";
  if (manche.issue === 'civils') return manche.devine ? "Les civils gagnent, l'undercover trouve le mot" : 'Les civils gagnent';
  return 'Manche en cours';
}

export function GainsUndercover({ gains, nom }: { gains: Record<string, number>; nom: (id: string) => string }) {
  const lignes = Object.entries(gains).filter(([, montant]) => montant > 0);
  if (lignes.length === 0) return <p>Aucun gain</p>;
  return (
    <ul class="recap-ordre">
      {lignes.map(([id, montant]) => (
        <li key={id}>
          {nom(id)} : +{montant} GP
        </li>
      ))}
    </ul>
  );
}

export function BilanUndercover({ undercover, nom }: { undercover: UndercoverVue; nom: (id: string) => string }) {
  const totaux: Record<string, number> = {};
  for (const manche of undercover.bilan) {
    for (const [id, montant] of Object.entries(manche.gains)) totaux[id] = (totaux[id] ?? 0) + montant;
  }
  return <GainsUndercover gains={totaux} nom={nom} />;
}

function Mots({ manche }: { manche: MancheUndercoverVue }) {
  if (!manche.paire) return null;
  return (
    <p class="mots-undercover">
      Civils : {manche.paire.civils} · undercover : {manche.paire.undercover}
    </p>
  );
}

/** Le téléphone n'a pas d'écran de vote : le mot au doigt, puis « Éliminé ». */
export function UndercoverJoueur({ undercover, nom }: { undercover: UndercoverVue; nom: (id: string) => string }) {
  const manche = undercover.courante;
  if (undercover.recap) {
    return (
      <div class="pile" data-undercover-joueur="fin">
        <h3>Undercover terminé</h3>
        <BilanUndercover undercover={undercover} nom={nom} />
      </div>
    );
  }
  if (!manche) {
    return (
      <div class="pile" data-undercover-joueur="attente">
        <h3>Undercover</h3>
        <p>La manche va commencer.</p>
      </div>
    );
  }
  return (
    <div class="pile" data-undercover-joueur={manche.jeSuisElimine ? 'elimine' : manche.etape}>
      <h3>
        Undercover · manche {manche.numero} sur {undercover.nbManches}
      </h3>
      {manche.etape === 'finie' ? (
        <>
          <p>{texteIssue(manche)}</p>
          <Mots manche={manche} />
          <GainsUndercover gains={manche.gains} nom={nom} />
        </>
      ) : manche.jeSuisElimine ? (
        <p class="elimine-undercover">Éliminé</p>
      ) : manche.monMot ? (
        <>
          <SecretAuDoigt aide="Maintiens ton doigt ici pour voir ton mot">
            <span class="mot-secret">{manche.monMot}</span>
          </SecretAuDoigt>
          <p>Donne un indice à voix haute quand vient ton tour, sans dire ton mot.</p>
        </>
      ) : null}
    </div>
  );
}
