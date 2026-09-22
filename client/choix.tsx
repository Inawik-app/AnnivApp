import { render } from 'preact';
import './commun/polices';
import './commun/base.css';

function Choix() {
  return (
    <main class="page">
      <h1>GP Party</h1>
      <a class="lien-choix" href="/tv">
        Télé
      </a>
      <a class="lien-choix" href="/joueur">
        Joueur
      </a>
      <a class="lien-choix" href="/hote">
        Hôte
      </a>
    </main>
  );
}

render(<Choix />, document.getElementById('app')!);
