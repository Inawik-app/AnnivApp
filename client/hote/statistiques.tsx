import type { VueHote } from '../../shared/types';
import { Icone, estNomIcone } from '../commun/icones';

const LIBELLES: Array<{ cle: keyof VueHote['statistiques'][string]; texte: string }> = [
  { cle: 'lancers', texte: 'Lancers' },
  { cle: 'indiceChance', texte: 'Indice de chance' },
  { cle: 'misesDe', texte: 'Misés au dé' },
  { cle: 'misesRoue', texte: 'Misés à la roue' },
  { cle: 'misesTotales', texte: 'Misés au total' },
  { cle: 'resultatRoue', texte: 'Résultat net de la roue' },
  { cle: 'jackpots', texte: 'Jackpots' },
  { cle: 'cartesMalchance', texte: 'Cartes malchance' },
  { cle: 'gpMalchance', texte: 'GP perdus par malchance' },
  { cle: 'casesReculees', texte: 'Cases reculées' },
  { cle: 'casesReculeesCartes', texte: 'dont cartes' },
  { cle: 'casesReculeesPacte', texte: 'dont Pacte' },
  { cle: 'casesAvanceesHorsDe', texte: 'Cases avancées hors dé' },
  { cle: 'gpDonnes', texte: 'GP donnés' },
  { cle: 'gpRecus', texte: 'GP reçus' },
  { cle: 'gpHorsPlateau', texte: 'GP hors plateau' },
  { cle: 'pireRang', texte: 'Pire rang dès le tour 3' },
  { cle: 'retardMax', texte: 'Retard max' },
  { cle: 'rangArrivee', texte: "Rang d'arrivée" },
  { cle: 'rangGpMi', texte: 'Rang GP à mi-partie' },
  { cle: 'rangGpFinal', texte: 'Rang GP actuel' },
  { cle: 'remontee', texte: 'Remontée' },
  { cle: 'placesGp', texte: 'Places GP reprises' },
];

function nombre(valeur: number | null): string {
  if (valeur === null) return '—';
  if (Number.isInteger(valeur)) return String(valeur);
  return valeur.toFixed(1).replace('.', ',');
}

/** Panneau d'hôte seulement : rien de ceci n'est envoyé à la télé. */
export function PanneauStatistiques({ vue }: { vue: VueHote }) {
  const pseudos = new Map(vue.joueurs.map((joueur) => [joueur.id, joueur.pseudo]));
  const nom = (id: string) => pseudos.get(id) ?? id;
  return (
    <details class="statistiques-hote">
      <summary>Statistiques</summary>
      <div class="pile">
        {vue.trophees.map((trophee) => (
          <div key={trophee.id}>
            <p>
              {estNomIcone(trophee.icone) ? <Icone nom={trophee.icone} taille={64} /> : null}
              <strong>{trophee.nom}</strong>
              {trophee.attribuable ? ` · ${trophee.montant} GP` : ' · pas attribuable'}
            </p>
            {trophee.phrase ? <p>{trophee.phrase}</p> : null}
            <p>
              {Object.entries(trophee.valeurs)
                .map(([id, valeur]) => `${nom(id)} ${nombre(valeur)}`)
                .join(' · ')}
            </p>
          </div>
        ))}
        {vue.joueurs.map((joueur) => {
          const stats = vue.statistiques[joueur.id];
          if (!stats) return null;
          return (
            <div key={joueur.id}>
              <h3>{joueur.pseudo}</h3>
              {LIBELLES.map((ligne) => (
                <p key={ligne.cle}>
                  {ligne.texte} : {nombre(stats[ligne.cle] as number | null)}
                </p>
              ))}
              {Object.entries(stats.gpParJeu).map(([jeu, montant]) => (
                <p key={jeu}>
                  {jeu} : {montant} GP
                </p>
              ))}
            </div>
          );
        })}
      </div>
    </details>
  );
}
