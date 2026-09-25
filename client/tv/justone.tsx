import type { JustOneVue } from '../../shared/types';
import './justone.css';

export function dureeRevelationJustOne(reduit: boolean): number {
  return reduit ? 150 : 1800;
}

export function JustOneTv({
  justone,
  nom,
}: {
  justone: JustOneVue;
  nom: (id: string) => string;
}) {
  const manche = justone.courante;
  if (justone.recap) {
    return (
      <div class="fenetre justone-tv" data-zone="justone" data-ecran="justone">
        <h2>Just One</h2>
        <ul class="justone-bilan">
          {justone.bilan.map((ligne) => (
            <li key={ligne.numero}>
              <span>{nom(ligne.devineurId)}</span>
              <span>{ligne.issue === 'trouve' ? 'trouvé' : ligne.issue === 'passe' ? 'passé' : 'raté'}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (!manche) {
    return (
      <div class="fenetre justone-tv" data-zone="justone" data-ecran="justone" data-etape="attente">
        <h2>Just One</h2>
        <p class="justone-attente">Préparez vos indices…</p>
      </div>
    );
  }
  if (manche.etape === 'indices' || manche.etape === 'verification') {
    return (
      <div class="fenetre justone-tv" data-zone="justone" data-ecran="justone" data-etape={manche.etape}>
        <h2>
          Manche {manche.numero} · {nom(manche.devineurId)} devine
        </h2>
        <p class="justone-attente">Les indices s’écrivent en secret</p>
        <div class="justone-grille-tv">
          {manche.indices.map((indice, index) => (
            <div key={index} class="justone-carte-tv cachee">
              <span class="justone-auteur-tv">{nom(indice.auteurId)}</span>
              <span class="justone-mot-tv">?</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div class="fenetre justone-tv" data-zone="justone" data-ecran="justone" data-etape={manche.etape}>
      <h2>
        Manche {manche.numero} · {nom(manche.devineurId)} devine
      </h2>
      <div class="justone-grille-tv">
        {manche.indices.map((indice, index) => (
          <div key={index} class={`justone-carte-tv${indice.annule ? ' annulee' : ''}`}>
            <span class="justone-auteur-tv">{nom(indice.auteurId)}</span>
            <span class="justone-mot-tv">{indice.annule ? '' : indice.mot ?? ''}</span>
          </div>
        ))}
      </div>
      {manche.etape === 'finie' && manche.mot ? <p class="justone-mot-revele">Le mot était {manche.mot}</p> : null}
      {manche.etape === 'finie' && manche.issue ? (
        <p class="justone-issue">
          {manche.issue === 'trouve' ? 'Trouvé !' : manche.issue === 'passe' ? 'Passé' : 'Raté'}
        </p>
      ) : null}
    </div>
  );
}
