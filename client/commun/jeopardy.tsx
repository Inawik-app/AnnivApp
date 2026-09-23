import { useState } from 'preact/hooks';
import type { Action, JeopardyVue } from '../../shared/types';
import './jeopardy.css';

function vibrer(ms: number): void {
  const navigation = navigator as Navigator & { vibrate?: (motif: number) => boolean };
  navigation.vibrate?.(ms);
}

export function texteGains(jeopardy: JeopardyVue, ordre: string[], nom: (id: string) => string): string[] {
  return ordre.map((id) => `${nom(id)} : ${jeopardy.gains[id] ?? 0} GP`);
}

function consigne(jeopardy: JeopardyVue, nom: (id: string) => string): string {
  const question = jeopardy.question;
  switch (jeopardy.monBuzzer) {
    case 'vert':
      return 'Buzze !';
    case 'bleu':
      return 'À toi de répondre';
    case 'gris':
      return 'Raté pour cette question';
    default:
      if (!question) return 'Attends la question';
      if (question.mainId && question.mainId === question.choisisseurId) return `Priorité à ${nom(question.mainId)}`;
      if (question.mainId) return `${nom(question.mainId)} a la main`;
      return 'Buzzers fermés';
  }
}

/** Un seul gros bouton ; seul le vert envoie un buzz, une seule fois par ouverture. */
export function BuzzerJeopardy({
  jeopardy,
  nom,
  envoyer,
}: {
  jeopardy: JeopardyVue;
  nom: (id: string) => string;
  envoyer: (action: Action) => void | Promise<void>;
}) {
  const question = jeopardy.question;
  const cle = question ? `${question.theme}|${question.niveau}|${question.elimines.length}` : '';
  const [envoye, setEnvoye] = useState<string | null>(null);
  const couleur = jeopardy.monBuzzer ?? 'rouge';
  const enAttente = couleur === 'vert' && envoye === cle;
  return (
    <button
      type="button"
      class={`buzzer-jeopardy buzzer-${couleur}${enAttente ? ' enfonce' : ''}`}
      data-buzzer={couleur}
      onPointerDown={(event) => {
        event.preventDefault();
        if (couleur !== 'vert' || envoye === cle) return;
        setEnvoye(cle);
        vibrer(60);
        void envoyer({ type: 'buzzJeopardy' });
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <span class="buzzer-texte">{consigne(jeopardy, nom)}</span>
    </button>
  );
}

export function JeopardyJoueur({
  jeopardy,
  ordre,
  nom,
  envoyer,
}: {
  jeopardy: JeopardyVue;
  ordre: string[];
  nom: (id: string) => string;
  envoyer: (action: Action) => void | Promise<void>;
}) {
  if (jeopardy.termine) {
    return (
      <div class="pile" data-jeopardy-joueur="fin">
        <h3>Jeopardy terminé</h3>
        <ul class="recap-ordre">
          {texteGains(jeopardy, ordre, nom).map((ligne) => (
            <li key={ligne}>{ligne}</li>
          ))}
        </ul>
      </div>
    );
  }
  const question = jeopardy.question;
  return (
    <div class="pile" data-jeopardy-joueur={question ? 'question' : 'grille'}>
      <h3>Jeopardy</h3>
      {question ? (
        <p class="question-jeopardy">
          {jeopardy.themes[question.theme]} pour {question.valeur} GP : {question.texte}
        </p>
      ) : (
        <p>{jeopardy.choisisseurId ? `${nom(jeopardy.choisisseurId)} choisit la case` : 'Choix de la case'}</p>
      )}
      <BuzzerJeopardy jeopardy={jeopardy} nom={nom} envoyer={envoyer} />
    </div>
  );
}
