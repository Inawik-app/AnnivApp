import { render } from 'preact';
import './commun/polices';
import './commun/base.css';
import './commun/composants.css';

function Choix() {
  return (
    <main class="page">
      <h1>GP exploiteur</h1>
      <span class="socle-pixel socle-lien">
        <a class="lien-choix" href="/tv">
          Télé
        </a>
      </span>
      <span class="socle-pixel socle-lien">
        <a class="lien-choix" href="/joueur">
          Joueur
        </a>
      </span>
      <span class="socle-pixel socle-lien">
        <a class="lien-choix" href="/hote">
          Hôte
        </a>
      </span>
    </main>
  );
}

render(<Choix />, document.getElementById('app')!);
