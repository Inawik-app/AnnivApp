import type { JeopardyVue } from '../../shared/types';
import { Icone } from '../commun/icones';
import './jeopardy.css';

function Gains({ jeopardy, ordre, nom }: { jeopardy: JeopardyVue; ordre: string[]; nom: (id: string) => string }) {
  return (
    <section class="ecran-mini ecran-jeopardy" data-ecran="jeopardy" data-zone="jeopardy" data-etape="fin" data-panneau="principal">
      <h2>Jeopardy : les gains</h2>
      <ul class="jeopardy-bilan">
        {ordre.map((id) => (
          <li key={id}>
            <span class="podium-nom">{nom(id)}</span>
            <span class="podium-gp">{jeopardy.gains[id] ?? 0}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function JeopardyTv({ jeopardy, ordre, nom }: { jeopardy: JeopardyVue; ordre: string[]; nom: (id: string) => string }) {
  if (jeopardy.termine) return <Gains jeopardy={jeopardy} ordre={ordre} nom={nom} />;
  const question = jeopardy.question;
  if (!question) {
    return (
      <section class="ecran-mini ecran-jeopardy" data-ecran="jeopardy" data-zone="jeopardy" data-etape="grille" data-panneau="principal">
        <div class="jeopardy-tete">
          <h2>Jeopardy</h2>
          {jeopardy.choisisseurId ? (
            <p class="jeopardy-prochain" data-choisisseur={jeopardy.choisisseurId}>
              Au tour de {nom(jeopardy.choisisseurId)}
            </p>
          ) : null}
        </div>
        <div class="jeopardy-grille" style={{ gridTemplateColumns: `repeat(${jeopardy.themes.length}, minmax(0, 1fr))` }}>
          {jeopardy.themes.map((theme, indexTheme) => (
            <div class="jeopardy-colonne" key={theme}>
              <p class="jeopardy-theme">{theme}</p>
              {jeopardy.valeurs.map((valeur, niveau) => {
                const jouee = jeopardy.jouees.some((entree) => entree.theme === indexTheme && entree.niveau === niveau);
                return (
                  <div class={jouee ? 'jeopardy-case jouee' : 'jeopardy-case'} key={valeur} data-jouee={jouee ? '1' : '0'}>
                    {jouee ? '' : valeur}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </section>
    );
  }
  const buzz = question.mainId !== null && question.mainId !== question.choisisseurId;
  const etat = question.mainId === null ? 'ouvert' : buzz ? 'buzz' : 'priorite';
  return (
    <section
      class="ecran-mini ecran-jeopardy"
      data-ecran="jeopardy"
      data-zone="jeopardy"
      data-etape="question"
      data-main={question.mainId ?? ''}
      data-panneau="principal"
    >
      <div class="jeopardy-tete">
        <p class="jeopardy-theme-question">{jeopardy.themes[question.theme]}</p>
        <p class="jeopardy-valeur">
          <span class="podium-gp">{question.valeur}</span> <span class="jeopardy-unite">GP</span>
        </p>
      </div>
      <p class="jeopardy-question">{question.texte}</p>
      <div class={`jeopardy-main main-${etat}`} data-etat={etat} key={`${etat}-${question.mainId ?? ''}`}>
        <Icone nom="buzzer" taille={128} />
        {etat === 'ouvert' ? (
          <p class="jeopardy-annonce">Buzzers ouverts</p>
        ) : (
          <div class="jeopardy-qui">
            <p class="jeopardy-annonce">{buzz ? 'A buzzé' : 'Choisie par'}</p>
            <p class="jeopardy-nom">{nom(question.mainId ?? '')}</p>
          </div>
        )}
      </div>
      <p class="jeopardy-elimines">
        {question.elimines.length > 0 ? `Déjà trompés : ${question.elimines.map(nom).join(', ')}` : 'Réponse à voix haute'}
      </p>
    </section>
  );
}
