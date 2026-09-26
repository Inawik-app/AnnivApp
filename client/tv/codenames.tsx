import type { ComponentChildren } from 'preact';
import { libelleEquipe, libelleNombre } from '../../shared/codenames';
import type { CarteCodenamesVue, CodenamesVue, CourseVue, MancheCodenamesVue } from '../../shared/types';
import { Icone } from '../commun/icones';
import './codenames.css';

function Section({ etape, children }: { etape: string; children: ComponentChildren }) {
  return (
    <section
      class="ecran-mini ecran-codenames"
      data-ecran="codenames"
      data-zone="codenames"
      data-etape={etape}
      data-panneau="principal"
    >
      {children}
    </section>
  );
}

function Crane() {
  return <Icone nom="crane" taille={64} />;
}

function classeMot(mot: string): string {
  return mot.length >= 10 ? 'mot-long' : mot.length >= 8 ? 'mot-moyen' : '';
}

function CarteTv({ carte, anime }: { carte: CarteCodenamesVue; anime?: boolean }) {
  const couleur = carte.couleur;
  const classes = ['carte-tv'];
  if (carte.revelee && couleur) classes.push(`couleur-${couleur}`);
  if (carte.revelee) classes.push('ouverte');
  if (anime) classes.push('retourne');
  return (
    <div
      class={classes.join(' ')}
      data-index={carte.index}
      data-revelee={carte.revelee ? '1' : '0'}
      data-couleur={couleur ?? ''}
    >
      <div class={`carte-tv-inner ${classeMot(carte.mot)}`}>
        {couleur === 'assassin' && carte.revelee ? <Crane /> : null}
        <span class="mot-tv">{carte.mot}</span>
      </div>
    </div>
  );
}

function Panneau({ manche, nom }: { manche: MancheCodenamesVue; nom: (id: string) => string }) {
  return (
    <aside class="codenames-panneau">
      <p class="codenames-restants">
        <span class="restant-rouge">{manche.restants.rouge}</span>
        <span class="restant-sep">·</span>
        <span class="restant-bleu">{manche.restants.bleu}</span>
      </p>
      <p class="codenames-tour">Tour : équipe {libelleEquipe(manche.equipeCourante)}</p>
      {manche.acteurId ? <p class="codenames-acteur">{nom(manche.acteurId)}</p> : null}
      {manche.indice ? (
        <p class="codenames-indice">
          {manche.indice.mot}
          <span class="codenames-nombre">{libelleNombre(manche.indice.nombre)}</span>
        </p>
      ) : (
        <p class="codenames-indice mute">En attente d’indice</p>
      )}
      {manche.essaisRestants !== null ? (
        <p class="codenames-essais">{manche.essaisRestants} essai{manche.essaisRestants > 1 ? 's' : ''}</p>
      ) : manche.indice ? (
        <p class="codenames-essais">∞</p>
      ) : null}
    </aside>
  );
}

export function CodenamesTv({
  course,
  codenames,
  nom,
}: {
  course: CourseVue;
  codenames: CodenamesVue;
  nom: (id: string) => string;
}) {
  const manche = codenames.courante;
  if (!manche) {
    const jeu = course.catalogue.jeux.find((candidat) => candidat.id === course.miniJeuId);
    const prep = codenames.preparation;
    return (
      <Section etape="intro">
        <h2>{jeu?.nom ?? 'Codenames'}</h2>
        <div class="codenames-equipes">
          <div class="equipe-bloc rouge">
            <p class="equipe-titre">Rouge</p>
            {(prep.equipes.rouge.length ? prep.equipes.rouge : ['…']).map((id) => (
              <p key={id} class="equipe-nom">
                {id === '…' ? '…' : nom(id)}
                {prep.espions.rouge === id ? ' · espion' : ''}
              </p>
            ))}
          </div>
          <div class="equipe-bloc bleu">
            <p class="equipe-titre">Bleue</p>
            {(prep.equipes.bleu.length ? prep.equipes.bleu : ['…']).map((id) => (
              <p key={id} class="equipe-nom">
                {id === '…' ? '…' : nom(id)}
                {prep.espions.bleu === id ? ' · espion' : ''}
              </p>
            ))}
          </div>
        </div>
      </Section>
    );
  }

  const finie = manche.etape === 'finie';
  if (finie) {
    return (
      <Section etape="finie">
        <div class="codenames-fin-plein">
          <p class="codenames-issue">
            {manche.gagnant ? `L’équipe ${libelleEquipe(manche.gagnant)} gagne` : 'Manche terminée'}
          </p>
          <div class="codenames-grille cle-finale" data-cle="1">
            {manche.cartes.map((carte) => (
              <CarteTv
                key={carte.index}
                carte={carte.couleur ? { ...carte, revelee: true } : carte}
                anime={manche.dernierRevele === carte.index && carte.revelee}
              />
            ))}
          </div>
          <ul class="codenames-gains">
            {Object.entries(manche.gains)
              .filter(([, montant]) => montant > 0)
              .map(([id, montant]) => (
                <li key={id}>
                  <span class="podium-nom">{nom(id)}</span>
                  <span class="podium-gp">+{montant}</span>
                </li>
              ))}
          </ul>
        </div>
      </Section>
    );
  }
  return (
    <Section etape={manche.etape}>
      <div class="codenames-corps">
        <div class="codenames-grille" data-cle="0">
          {manche.cartes.map((carte) => (
            <CarteTv
              key={carte.index}
              carte={carte}
              anime={manche.dernierRevele === carte.index && carte.revelee}
            />
          ))}
        </div>
        <Panneau manche={manche} nom={nom} />
      </div>
    </Section>
  );
}
