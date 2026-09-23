import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { CourseVue, Minuteur } from '../../shared/types';
import { Coche, Icone, IconeMiniJeu, multipleIcone } from '../commun/icones';
import { lireDecalageMs } from '../commun/connexion';
import { sons } from '../commun/sons';
import { dureeNiveauMs, libelleBareme, resteMinuteur, texteMinuteur } from '../../shared/mini-jeux';
import './mini-jeux.css';

function resteAffiche(minuteur: Minuteur, idleMs: number | undefined): number {
  if (minuteur.etat === 'arrete') return idleMs ?? 0;
  return resteMinuteur(minuteur, Date.now() - lireDecalageMs());
}

export function MinuteurTv({
  minuteur,
  idleMs,
  geant = false,
  detail,
  milieu,
}: {
  minuteur: Minuteur;
  idleMs?: number;
  geant?: boolean;
  detail?: (resteMs: number) => string;
  milieu?: ComponentChildren;
}) {
  const [reste, setReste] = useState(() => resteAffiche(minuteur, idleMs));
  useEffect(() => {
    let derniereSeconde = -1;
    let sonne = false;
    const tick = () => {
      const valeur = resteAffiche(minuteur, idleMs);
      setReste(valeur);
      if (minuteur.etat !== 'enCours') return;
      const seconde = Math.ceil(valeur / 1000);
      if (seconde <= 10 && seconde > 0 && seconde !== derniereSeconde) {
        derniereSeconde = seconde;
        sons().jouer('tictac');
      }
      if (valeur <= 0 && !sonne) {
        sonne = true;
        sons().jouer('victoire');
      }
    };
    tick();
    if (minuteur.etat !== 'enCours') return;
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [minuteur.etat, minuteur.finA, minuteur.resteMs, minuteur.libelle, idleMs]);
  const alerte = minuteur.etat === 'enCours' && Math.ceil(reste / 1000) <= 10;
  return (
    <div>
      <div class="minuteur-ligne">
        <Icone nom="sablier" taille={multipleIcone('sablier', geant ? 96 : 64, geant ? 128 : 96)} />
        <p class={geant ? 'minuteur minuteur-geant' : 'minuteur'} data-alerte={alerte ? '1' : '0'}>
          {texteMinuteur(reste)}
        </p>
      </div>
      {milieu}
      {detail ? <p class="blinds-suite">{detail(reste)}</p> : null}
    </div>
  );
}

export function GrilleTv({ course }: { course: CourseVue }) {
  return (
    <section class="ecran-mini" data-ecran="grille" data-zone="grille" data-panneau="principal">
      <h2>Mini-jeux</h2>
      <div class="grille-tuiles">
        {course.catalogue.jeux.map((jeu) => {
          const joue = course.joues.includes(jeu.id);
          return (
            <div key={jeu.id} class="socle-pixel">
            <div class={joue ? 'tuile-mini joue' : 'tuile-mini'} data-joue={joue ? '1' : '0'} data-id={jeu.id}>
              <IconeMiniJeu id={jeu.icone} nom={jeu.nom} taille={64} />
              <p class="nom-mini">{jeu.nom}</p>
              <p class="resume-mini">{jeu.resume}</p>
              {joue ? <Coche /> : null}
            </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function ReglesTv({ course }: { course: CourseVue }) {
  const jeu = course.catalogue.jeux.find((candidat) => candidat.id === course.miniJeuId);
  if (!jeu) return null;
  return (
    <section class="ecran-mini" data-ecran="regles" data-zone="regles" data-panneau="principal">
      <div class="regles-tete">
        <IconeMiniJeu id={jeu.icone} nom={jeu.nom} taille={128} />
        <h2 class="nom-regles">{jeu.nom}</h2>
      </div>
      <p class="resume-regles">{jeu.resume}</p>
      <ul class="lignes-regles">
        {jeu.regles.map((ligne) => (
          <li class="regle-ligne" key={ligne}>
            {ligne}
          </li>
        ))}
      </ul>
      {jeu.materiel ? <p class="materiel">Matériel : {jeu.materiel}</p> : null}
      <p class="bareme">{libelleBareme(jeu, course.catalogue)}</p>
      {jeu.duree ? <MinuteurTv minuteur={course.minuteur} idleMs={jeu.duree * 1000} /> : null}
    </section>
  );
}

type Enseigne = 'coeur' | 'carreau' | 'pique' | 'trefle';

type CarteMain = { valeur: string; enseigne: Enseigne; hors?: boolean };

const COMBINAISONS: Array<{ nom: string; cartes: CarteMain[] }> = [
  {
    nom: 'Quinte flush royale',
    cartes: ['A', 'R', 'D', 'V', '10'].map((valeur) => ({ valeur, enseigne: 'coeur' as const })),
  },
  {
    nom: 'Quinte flush',
    cartes: ['9', '8', '7', '6', '5'].map((valeur) => ({ valeur, enseigne: 'pique' as const })),
  },
  {
    nom: 'Carré',
    cartes: [
      { valeur: 'A', enseigne: 'coeur' },
      { valeur: 'A', enseigne: 'carreau' },
      { valeur: 'A', enseigne: 'pique' },
      { valeur: 'A', enseigne: 'trefle' },
      { valeur: 'R', enseigne: 'pique', hors: true },
    ],
  },
  {
    nom: 'Full',
    cartes: [
      { valeur: 'R', enseigne: 'coeur' },
      { valeur: 'R', enseigne: 'carreau' },
      { valeur: 'R', enseigne: 'pique' },
      { valeur: '9', enseigne: 'trefle' },
      { valeur: '9', enseigne: 'coeur' },
    ],
  },
  {
    nom: 'Couleur',
    cartes: ['A', 'V', '8', '6', '2'].map((valeur) => ({ valeur, enseigne: 'trefle' as const })),
  },
  {
    nom: 'Suite',
    cartes: [
      { valeur: '10', enseigne: 'coeur' },
      { valeur: '9', enseigne: 'pique' },
      { valeur: '8', enseigne: 'carreau' },
      { valeur: '7', enseigne: 'trefle' },
      { valeur: '6', enseigne: 'coeur' },
    ],
  },
  {
    nom: 'Brelan',
    cartes: [
      { valeur: 'D', enseigne: 'coeur' },
      { valeur: 'D', enseigne: 'carreau' },
      { valeur: 'D', enseigne: 'pique' },
      { valeur: 'R', enseigne: 'trefle', hors: true },
      { valeur: '9', enseigne: 'coeur', hors: true },
    ],
  },
  {
    nom: 'Double paire',
    cartes: [
      { valeur: '10', enseigne: 'coeur' },
      { valeur: '10', enseigne: 'pique' },
      { valeur: '8', enseigne: 'carreau' },
      { valeur: '8', enseigne: 'trefle' },
      { valeur: 'A', enseigne: 'pique', hors: true },
    ],
  },
  {
    nom: 'Paire',
    cartes: [
      { valeur: '10', enseigne: 'coeur' },
      { valeur: '10', enseigne: 'trefle' },
      { valeur: 'A', enseigne: 'pique', hors: true },
      { valeur: 'R', enseigne: 'carreau', hors: true },
      { valeur: '4', enseigne: 'pique', hors: true },
    ],
  },
  {
    nom: 'Carte haute',
    cartes: [
      { valeur: 'A', enseigne: 'coeur' },
      { valeur: 'R', enseigne: 'pique', hors: true },
      { valeur: 'D', enseigne: 'carreau', hors: true },
      { valeur: '8', enseigne: 'trefle', hors: true },
      { valeur: '3', enseigne: 'pique', hors: true },
    ],
  },
];

function Symbole({ enseigne }: { enseigne: Enseigne }) {
  if (enseigne === 'coeur') {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path fill="currentColor" d="M16 29 L5 17 C1 13 1 6 7 5 C11 4 14 7 16 10 C18 7 21 4 25 5 C31 6 31 13 27 17 Z" />
      </svg>
    );
  }
  if (enseigne === 'carreau') {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <polygon fill="currentColor" points="16,2 30,16 16,30 2,16" />
      </svg>
    );
  }
  if (enseigne === 'pique') {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path fill="currentColor" d="M16 2 C16 2 3 13 3 19 C3 24 7 27 11 27 C13 27 15 26 16 23 C17 26 19 27 21 27 C25 27 29 24 29 19 C29 13 16 2 16 2 Z" />
        <path fill="currentColor" d="M14 24 H18 L20 30 H12 Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="9" r="6" fill="currentColor" />
      <circle cx="8" cy="18" r="6" fill="currentColor" />
      <circle cx="24" cy="18" r="6" fill="currentColor" />
      <path fill="currentColor" d="M14 20 H18 L20 30 H12 Z" />
    </svg>
  );
}

function CartePoker({ carte }: { carte: CarteMain }) {
  return (
    <div class={carte.hors ? 'carte-poker hors' : 'carte-poker'} data-carte="1" data-hors={carte.hors ? '1' : '0'}>
      <span class={`valeur-carte enseigne-${carte.enseigne}`}>{carte.valeur}</span>
      <span class={`symbole-carte enseigne-${carte.enseigne}`}>
        <Symbole enseigne={carte.enseigne} />
      </span>
    </div>
  );
}

export function PokerTv({ course }: { course: CourseVue }) {
  const config = course.pokerConfig;
  const index = course.poker.niveau;
  const niveau = config.niveaux[index];
  const prochain = config.niveaux[index + 1];
  const precedent = useRef(index);
  const [clignote, setClignote] = useState(false);
  useEffect(() => {
    if (precedent.current === index) return;
    precedent.current = index;
    setClignote(true);
    const id = window.setTimeout(() => setClignote(false), 1600);
    return () => window.clearTimeout(id);
  }, [index]);
  const minutes = Math.max(1, Math.round(config.dureeMinutes / Math.max(1, config.niveaux.length)));
  return (
    <section class="ecran-mini ecran-poker" data-ecran="poker" data-zone="poker" data-panneau="principal">
      <div class="poker-gauche">
        <div class="socle-pixel socle-temps">
          <div class={clignote ? 'panneau panneau-temps clignote' : 'panneau panneau-temps'}>
            <MinuteurTv
              minuteur={course.minuteur}
              idleMs={dureeNiveauMs(config)}
              milieu={
                <>
                  {niveau ? (
                    <p class="blinds">
                      Blinds {niveau.petite} / {niveau.grosse}
                    </p>
                  ) : null}
                  <p class="niveau-poker">
                    Niveau {index + 1} sur {config.niveaux.length}
                  </p>
                </>
              }
              detail={(reste) => (prochain ? `Prochain niveau dans ${texteMinuteur(reste)}` : 'Dernier niveau')}
            />
          </div>
        </div>
        <div class="socle-pixel">
          <div class="panneau panneau-regles-poker">
            <p class="regle-ligne">Blinds ×2 toutes les {minutes} min</p>
            <p class="regle-ligne">Se retirer : tu gardes la moitié de ton tapis</p>
            <p class="regle-ligne">1 jeton = 1 GP à la fin</p>
          </div>
        </div>
      </div>
      <div class="socle-pixel socle-combi">
        <div class="panneau panneau-combinaisons" data-zone="combinaisons">
          <div class="liste-combi">
            {COMBINAISONS.map((combinaison, rang) => (
              <div class="ligne-combi" data-combinaison={combinaison.nom} key={combinaison.nom}>
              <div class="entete-combi">
                <span class="rang-combi">{rang + 1}</span>
                <span class="nom-combi">{combinaison.nom}</span>
              </div>
                <span class="cartes-combi">
                  {combinaison.cartes.map((carte, position) => (
                    <CartePoker key={`${combinaison.nom}-${position}`} carte={carte} />
                  ))}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function PodiumMini({
  lignes,
}: {
  lignes: Array<{ joueurId: string; pseudo: string; montant: number; rang: number | null }>;
}) {
  return (
    <section class="ecran-mini podium-mini" data-ecran="podium" data-zone="podium" data-panneau="principal">
      <h2>Résultats</h2>
      <ul>
        {lignes.map((ligne) => (
          <li key={ligne.joueurId}>
            <span class="podium-nom">{ligne.rang ? `${ligne.rang}. ${ligne.pseudo}` : ligne.pseudo}</span>
            <span class="podium-gp">{ligne.montant}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
