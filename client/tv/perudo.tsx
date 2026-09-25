import { useEffect, useRef, useState } from 'preact/hooks';
import { RAPPEL_PERUDO } from '../../shared/perudo';
import type { JoueurPublic, PerudoVue } from '../../shared/types';
import { Avatar } from '../commun/composants';
import { FaceDe, libelleFace } from '../commun/perudo';
import { ReglesPerudo } from '../commun/regles-perudo';
import { sons } from '../commun/sons';
import './perudo.css';

const JOUEUR_MS = 900;
const COMPTE_MS = 1200;
const VERDICT_MS = 1800;
const PERTE_MS = 900;
const PAS_REDUIT_MS = 150;

type PhaseRevelation = {
  joueursOuverts: number;
  compteAffiche: number;
  allumes: boolean;
  verdict: boolean;
  perte: boolean;
};

const CACHE: PhaseRevelation = {
  joueursOuverts: 0,
  compteAffiche: 0,
  allumes: false,
  verdict: false,
  perte: false,
};

function finale(perudo: PerudoVue): PhaseRevelation {
  const reveles = perudo.joueurs.filter((joueur) => (perudo.revelation?.faces[joueur.id]?.length ?? 0) > 0);
  return {
    joueursOuverts: reveles.length,
    compteAffiche: perudo.revelation?.compte ?? 0,
    allumes: true,
    verdict: true,
    perte: true,
  };
}

/** Durée totale de la révélation pour la file d’animations TV. */
export function dureeRevelationPerudo(joueursAvecDes: number, reduit: boolean): number {
  if (reduit) return PAS_REDUIT_MS * (joueursAvecDes + 4);
  return JOUEUR_MS * joueursAvecDes + COMPTE_MS + VERDICT_MS + PERTE_MS;
}

function ficheJoueur(joueurs: JoueurPublic[], id: string): JoueurPublic | undefined {
  return joueurs.find((joueur) => joueur.id === id);
}

export function PerudoTv({
  perudo,
  joueurs,
  nom,
  vitesse,
  reduit,
}: {
  perudo: PerudoVue;
  joueurs: JoueurPublic[];
  nom: (id: string) => string;
  vitesse: number;
  reduit: boolean;
}) {
  const [phase, setPhase] = useState<PhaseRevelation>(() =>
    perudo.etape === 'revelation' || perudo.etape === 'terminee' ? finale(perudo) : CACHE,
  );
  const precedent = useRef<{ manche: number; etape: string } | null>(null);
  const reglages = useRef({ vitesse, reduit, perudo });
  reglages.current = { vitesse, reduit, perudo };

  useEffect(() => {
    const avant = precedent.current;
    const etape = perudo.etape;
    precedent.current = { manche: perudo.numeroManche, etape };
    if (etape !== 'revelation' && etape !== 'terminee') {
      setPhase(CACHE);
      return;
    }
    const depuisEncheres = avant?.etape === 'encheres' && avant.manche === perudo.numeroManche;
    if (!depuisEncheres) {
      setPhase(finale(perudo));
      return;
    }
    const pas = (ms: number) => (reglages.current.reduit ? PAS_REDUIT_MS : ms) / Math.max(0.25, reglages.current.vitesse);
    const reveles = perudo.joueurs.filter((joueur) => (perudo.revelation?.faces[joueur.id]?.length ?? 0) > 0);
    const minuteurs: number[] = [];
    let instant = 0;
    setPhase({ ...CACHE });
    reveles.forEach((_, index) => {
      minuteurs.push(
        window.setTimeout(() => {
          sons().jouer('transition');
          setPhase((etat) => ({ ...etat, joueursOuverts: index + 1 }));
        }, instant),
      );
      instant += pas(JOUEUR_MS);
    });
    minuteurs.push(
      window.setTimeout(() => {
        sons().jouer('revelation');
        setPhase((etat) => ({ ...etat, allumes: true }));
      }, instant),
    );
    instant += pas(400);
    const cible = perudo.revelation?.compte ?? 0;
    const paliers = Math.max(1, cible);
    for (let n = 1; n <= paliers; n += 1) {
      const delai = instant + (pas(COMPTE_MS) / paliers) * n;
      minuteurs.push(
        window.setTimeout(() => {
          setPhase((etat) => ({ ...etat, compteAffiche: n }));
        }, delai),
      );
    }
    instant += pas(COMPTE_MS);
    minuteurs.push(
      window.setTimeout(() => {
        sons().jouer('victoire');
        setPhase((etat) => ({ ...etat, verdict: true, compteAffiche: cible }));
      }, instant),
    );
    instant += pas(VERDICT_MS);
    minuteurs.push(window.setTimeout(() => setPhase((etat) => ({ ...etat, perte: true })), instant));
    return () => minuteurs.forEach((id) => window.clearTimeout(id));
  }, [perudo.numeroManche, perudo.etape, perudo.revelation?.compte]);

  if (perudo.regles) {
    return (
      <section class="ecran-mini ecran-perudo" data-ecran="perudo" data-zone="perudo" data-etape="regles" data-panneau="principal">
        <h2>Perudo</h2>
        <div class="perudo-regles-tv">
          <ReglesPerudo className="regles-tv-texte" />
        </div>
      </section>
    );
  }

  if (perudo.etape === 'terminee') {
    return (
      <section class="ecran-mini ecran-perudo" data-ecran="perudo" data-zone="perudo" data-etape="terminee" data-panneau="principal">
        <h2>Perudo : les gains</h2>
        <ul class="perudo-gains">
          {Object.entries(perudo.gains)
            .filter(([, montant]) => montant > 0)
            .map(([id, montant]) => (
              <li key={id}>
                <span class="podium-nom">{nom(id)}</span>
                <span class="podium-gp">+{montant}</span>
              </li>
            ))}
        </ul>
      </section>
    );
  }

  const revelation = perudo.revelation;
  const valeurAnnonce = revelation?.annonce.valeur ?? perudo.annonce?.valeur ?? 0;
  const reveles = perudo.joueurs.filter((joueur) => (revelation?.faces[joueur.id]?.length ?? 0) > 0);
  const annonceAffichee = revelation?.annonce ?? perudo.annonce;

  return (
    <section
      class="ecran-mini ecran-perudo"
      data-ecran="perudo"
      data-zone="perudo"
      data-etape={perudo.etape}
      data-revelation={phase.verdict ? 'verdict' : phase.allumes ? 'compte' : 'flip'}
      data-panneau="principal"
    >
      <div class="perudo-corps">
        <div class="perudo-joueurs">
          {perudo.joueurs.map((joueur) => {
            const fiche = ficheJoueur(joueurs, joueur.id);
            const courant = joueur.id === perudo.courantId;
            const faces = revelation?.faces[joueur.id] ?? null;
            const rangRevele = reveles.findIndex((candidat) => candidat.id === joueur.id);
            const ouvert =
              (perudo.etape === 'revelation' || perudo.etape === 'terminee') &&
              rangRevele >= 0 &&
              rangRevele < phase.joueursOuverts;
            const classes = ['perudo-fiche'];
            if (courant) classes.push('courant');
            if (joueur.elimine) classes.push('elimine');
            if (phase.perte && revelation?.concerneId === joueur.id && revelation.delta < 0) classes.push('perd-de');
            if (phase.perte && revelation?.concerneId === joueur.id && revelation.delta > 0) classes.push('gagne-de');
            return (
              <div key={joueur.id} class={classes.join(' ')} data-joueur={joueur.id}>
                {fiche ? (
                  <Avatar avatar={fiche.avatar} couleur={fiche.couleur} pseudo={fiche.pseudo} taille={64} />
                ) : (
                  <span class="avatar-vide" />
                )}
                <div class="perudo-fiche-texte">
                  <p class="perudo-pseudo">{nom(joueur.id)}</p>
                  <p class="perudo-des-count">{joueur.desRestants}</p>
                </div>
                <div class="perudo-mains-tv">
                  {ouvert && faces
                    ? faces.map((face, faceIndex) => {
                        const compte =
                          valeurAnnonce > 0 &&
                          (valeurAnnonce === 1 ? face === 1 : face === valeurAnnonce || face === 1);
                        return (
                          <FaceDe
                            key={`${faceIndex}-${face}`}
                            valeur={face}
                            taille={64}
                            allumee={phase.allumes && compte}
                          />
                        );
                      })
                    : Array.from({ length: Math.max(0, joueur.desRestants) }, (_, faceIndex) => (
                        <FaceDe key={faceIndex} valeur={1} taille={64} cachee />
                      ))}
                </div>
              </div>
            );
          })}
        </div>
        <div class="perudo-centre">
          {annonceAffichee ? (
            <div class="perudo-annonce-geante">
              <span class="perudo-nombre-geant">{annonceAffichee.nombre} ×</span>
              <FaceDe valeur={annonceAffichee.valeur} taille={192} />
            </div>
          ) : (
            <p class="perudo-attente">Manche {perudo.numeroManche}</p>
          )}
          {perudo.etape === 'revelation' && revelation ? (
            <div class="perudo-revelation-bloc">
              <p class="perudo-compteur" data-compte={phase.compteAffiche}>
                {phase.compteAffiche}
              </p>
              {phase.verdict ? <p class="perudo-verdict">{revelation.libelle}</p> : null}
            </div>
          ) : null}
        </div>
        <aside class="perudo-cote">
          <p class="perudo-total">Dés : {perudo.totalDes}</p>
          <ul class="perudo-historique">
            {[...perudo.historique].reverse().slice(0, 6).map((annonce, index) => (
              <li key={`${annonce.joueurId}-${index}`}>
                {nom(annonce.joueurId)} : {annonce.nombre} × {libelleFace(annonce.valeur)}
              </li>
            ))}
          </ul>
          <ul class="perudo-rappel">
            {RAPPEL_PERUDO.map((ligne) => (
              <li key={ligne}>{ligne}</li>
            ))}
          </ul>
        </aside>
      </div>
    </section>
  );
}
