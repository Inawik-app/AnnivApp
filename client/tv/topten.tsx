import { useEffect, useRef, useState } from 'preact/hooks';
import type { CourseVue, MancheTopTenVue, TopTenVue } from '../../shared/types';
import { texteTheme } from '../../shared/topten';
import { Piece } from '../commun/composants';
import { Icone } from '../commun/icones';
import { sons } from '../commun/sons';
import './topten.css';

type Revelation = { retournees: number; marques: boolean; total: boolean; anime: boolean };

const CACHEES: Revelation = { retournees: 0, marques: false, total: false, anime: false };

const ATTENTE_MS = 2000;
const CARTE_MS = 1400;
const MARQUES_MS = 1200;
const CHUTE_MS = 400;
const PAS_REDUIT_MS = 150;

/** Durée totale de la révélation, pour que la file d'animations l'attende. */
export function dureeRevelationTopTen(cartes: number, reduit: boolean): number {
  if (reduit) return PAS_REDUIT_MS * (cartes + 3);
  return ATTENTE_MS + CARTE_MS * cartes + MARQUES_MS + CHUTE_MS;
}

function finale(manche: MancheTopTenVue | null): Revelation {
  return { retournees: manche?.repondants.length ?? 0, marques: true, total: true, anime: false };
}

function CarteDevinee({
  id,
  nom,
  devine,
  bonRang,
  exacte,
  anime,
}: {
  id: string;
  nom: string;
  devine: number | null;
  bonRang: boolean;
  exacte: boolean;
  anime: boolean;
}) {
  const classes = ['carte-topten', 'carte-devinee'];
  if (bonRang) classes.push('bon-rang');
  if (anime) classes.push('posee');
  return (
    <div class={classes.join(' ')} data-carte="devinee" data-repondant={id} data-bon-rang={bonRang ? '1' : '0'}>
      <div class="face-carte face-avant">
        <p class="nom-carte">{nom}</p>
        <p class={exacte ? 'chiffre-carte exact' : 'chiffre-carte'} data-exact={exacte ? '1' : '0'}>
          {devine ?? '?'}
        </p>
      </div>
    </div>
  );
}

function CarteBonOrdre({
  id,
  nom,
  numero,
  retournee,
  anime,
}: {
  id: string;
  nom: string;
  numero: number | null;
  retournee: boolean;
  anime: boolean;
}) {
  const classes = ['carte-topten', 'carte-bon-ordre'];
  if (retournee) classes.push('retournee');
  if (!anime) classes.push('sans-anim');
  return (
    <div
      class={classes.join(' ')}
      data-carte="bon-ordre"
      data-repondant={retournee ? id : undefined}
      data-numero={retournee && numero !== null ? numero : undefined}
      data-retournee={retournee ? '1' : '0'}
    >
      <div class="face-carte face-dos">
        <span class="dos-carte">?</span>
      </div>
      <div class="face-carte face-avant">
        <p class="nom-carte">{retournee ? nom : ''}</p>
        <p class="chiffre-carte">{retournee && numero !== null ? numero : ''}</p>
      </div>
    </div>
  );
}

function Tete({ manche, topten, nom }: { manche: MancheTopTenVue; topten: TopTenVue; nom: (id: string) => string }) {
  return (
    <div class="topten-tete">
      <p class="topten-manche">
        Manche {manche.numero} sur {topten.captens.length}
      </p>
      <p class="topten-capten">
        <Icone nom="casquette-capitaine" taille={64} /> Cap'Ten : {nom(manche.captenId)}
      </p>
    </div>
  );
}

export function TopTenTv({
  course,
  topten,
  nom,
  vitesse,
  reduit,
}: {
  course: CourseVue;
  topten: TopTenVue;
  nom: (id: string) => string;
  vitesse: number;
  reduit: boolean;
}) {
  const manche = topten.courante;
  const numero = manche?.numero ?? 0;
  const etape = manche?.etape ?? null;
  const [revelation, setRevelation] = useState<Revelation>(() => (etape === 'revelee' ? finale(manche) : CACHEES));
  const precedent = useRef<{ numero: number; etape: string | null } | null>(null);
  const reglages = useRef({ vitesse, reduit, manche });
  reglages.current = { vitesse, reduit, manche };

  useEffect(() => {
    const avant = precedent.current;
    precedent.current = { numero, etape };
    const courante = reglages.current.manche;
    if (etape !== 'revelee') {
      setRevelation(CACHEES);
      return;
    }
    if (!avant || avant.numero !== numero || avant.etape !== 'reponses') {
      setRevelation(finale(courante));
      return;
    }
    const pas = (ms: number) => (reglages.current.reduit ? PAS_REDUIT_MS : ms) / Math.max(0.25, reglages.current.vitesse);
    const minuteurs: number[] = [];
    let instant = pas(ATTENTE_MS);
    setRevelation({ ...CACHEES, anime: true });
    const total = courante?.repondants.length ?? 0;
    for (let rang = 1; rang <= total; rang += 1) {
      minuteurs.push(
        window.setTimeout(() => {
          sons().jouer('transition');
          setRevelation((etat) => ({ ...etat, retournees: rang }));
        }, instant),
      );
      instant += pas(CARTE_MS);
    }
    minuteurs.push(window.setTimeout(() => setRevelation((etat) => ({ ...etat, marques: true })), instant));
    instant += pas(MARQUES_MS);
    minuteurs.push(
      window.setTimeout(() => {
        sons().jouer('victoire');
        setRevelation((etat) => ({ ...etat, total: true }));
      }, instant),
    );
    return () => minuteurs.forEach((id) => window.clearTimeout(id));
  }, [numero, etape]);

  if (topten.recap) {
    return (
      <section class="ecran-mini ecran-topten" data-ecran="topten" data-zone="topten" data-etape="recap" data-panneau="principal">
        <h2>Top Ten : les gains des Cap'Ten</h2>
        <ul class="topten-bilan">
          {topten.bilan.map((ligne) => (
            <li key={ligne.numero}>
              <span class="podium-nom">
                {nom(ligne.captenId)} · manche {ligne.numero}
              </span>
              <span class="podium-gp">{ligne.total}</span>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (!manche) {
    const jeu = course.catalogue.jeux.find((candidat) => candidat.id === course.miniJeuId);
    return (
      <section class="ecran-mini ecran-topten" data-ecran="topten" data-zone="topten" data-etape="intro" data-panneau="principal">
        <h2>{jeu?.nom ?? 'Top Ten'}</h2>
        <ul class="lignes-regles">
          {(jeu?.regles ?? []).map((ligne) => (
            <li class="regle-ligne" key={ligne}>
              {ligne}
            </li>
          ))}
        </ul>
        <p class="topten-consigne">Cap'Ten dans l'ordre : {topten.captens.map(nom).join(', ')}</p>
      </section>
    );
  }

  if (manche.etape === 'reponses') {
    return (
      <section class="ecran-mini ecran-topten" data-ecran="topten" data-zone="topten" data-etape="reponses" data-panneau="principal">
        <Tete manche={manche} topten={topten} nom={nom} />
        <div class="topten-theme">
          <p class="theme-tv">{manche.theme.intitule}</p>
          <p class="poles-tv">{texteTheme(manche.theme)}</p>
        </div>
        <div class="topten-cartes">
          {manche.repondants.map((id) => (
            <div class="repondant-tv" key={id} data-repondant={id}>
              <p class="nom-carte">{nom(id)}</p>
              <div class="faces-carte">
                <div class="face-carte face-dos">
                  <span class="dos-carte">?</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p class="topten-consigne">Chacun répond à voix haute, puis {nom(manche.captenId)} classe les réponses.</p>
      </section>
    );
  }

  const score = manche.score;
  const proposition = manche.proposition;
  const numeros = manche.numeros ?? {};
  const devinees = proposition?.ordre ?? manche.repondants;
  const bonOrdre = [...manche.repondants].sort((a, b) => (numeros[a] ?? 0) - (numeros[b] ?? 0));
  const etat = revelation.total ? 'fin' : revelation.marques ? 'marques' : revelation.retournees > 0 ? 'retournement' : 'cachees';
  return (
    <section
      class="ecran-mini ecran-topten"
      data-ecran="topten"
      data-zone="topten"
      data-etape="revelee"
      data-revelation={etat}
      data-panneau="principal"
    >
      <Tete manche={manche} topten={topten} nom={nom} />
      <div class="topten-rangees">
        <p class="rangee-libelle">Deviné</p>
        {devinees.map((id, index) => (
          <CarteDevinee
            key={id}
            id={id}
            nom={nom(id)}
            devine={proposition?.devines[id] ?? null}
            bonRang={revelation.marques && bonOrdre[index] === id}
            exacte={revelation.marques && score?.exacts.includes(id) === true}
            anime={revelation.anime}
          />
        ))}
        <p class="rangee-libelle">Bon ordre</p>
        {bonOrdre.map((id, index) => (
          <CarteBonOrdre
            key={id}
            id={id}
            nom={nom(id)}
            numero={numeros[id] ?? null}
            retournee={index < revelation.retournees}
            anime={revelation.anime}
          />
        ))}
      </div>
      <div
        class={['topten-total', revelation.total ? 'visible' : '', revelation.anime ? '' : 'sans-anim'].join(' ').trim()}
        data-total={score?.total ?? 0}
      >
        <p class="detail-total">
          Ordre {score?.pointsOrdre ?? 0} · ordre parfait +{score?.bonusParfait ?? 0} · chiffres exacts +{score?.bonusExacts ?? 0}
        </p>
        <p class="gp-total">
          <Piece taille={128} />
          <span class="montant-total">{score?.total ?? 0}GP</span>
        </p>
      </div>
    </section>
  );
}
