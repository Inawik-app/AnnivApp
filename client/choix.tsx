import { render } from 'preact';
import './commun/base.css';

function Choix() {
  return (
    <main class="page">
      <h1>GP Party</h1>
      <a class="lien" href="/tv">
        Télé
      </a>
      <a class="lien" href="/joueur">
        Joueur
      </a>
      <a class="lien" href="/hote">
        Hôte
      </a>
    </main>
  );
}

render(<Choix />, document.getElementById('app')!);
