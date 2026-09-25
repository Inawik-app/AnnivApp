import { useEffect, useState } from 'preact/hooks';
import type { Action, CourseVue, JoueurPublic, OptionDe, VueJoueur } from '../../shared/types';
import { Bouton, CompteurRouleaux } from '../commun/composants';
import { Icone, estNomIcone } from '../commun/icones';
import { textePhase } from '../commun/course-texte';
import { libelleRang } from '../commun/spectacle';
import { TopTenJoueur } from '../commun/topten';
import { JeopardyJoueur } from '../commun/jeopardy';
import { UndercoverJoueur } from '../commun/undercover';
import '../commun/course.css';

type Moi = NonNullable<VueJoueur['moi']>;

function vibrer(ms: number): void {
  const navigation = navigator as Navigator & { vibrate?: (motif: number) => boolean };
  navigation.vibrate?.(ms);
}

function prixOption(option: OptionDe): string {
  return option.mise <= 0 ? 'gratuit' : `${option.mise} GP`;
}

function FacesDe({ faces }: { faces: number }) {
  return (
    <span class="faces-de" aria-hidden="true">
      {Array.from({ length: faces }, (_, index) => {
        const valeur = index + 1;
        return (
          <span key={valeur} class={valeur >= 7 ? 'face-doree' : undefined}>
            {valeur}
          </span>
        );
      })}
    </span>
  );
}

function Selecteur({
  montant,
  maximum,
  onChange,
  onValider,
  libelle,
  occupe,
}: {
  montant: number;
  maximum: number;
  onChange: (valeur: number) => void;
  onValider: () => void;
  libelle: string;
  occupe: boolean;
}) {
  const fixer = (valeur: number) => onChange(Math.max(0, Math.min(maximum, valeur)));
  const moitie = Math.floor(maximum / 2);
  return (
    <div>
      <div class="selecteur-mise">
        <Bouton variante="secondaire" disabled={occupe || montant <= 0} onClick={() => fixer(montant - 1)}>
          −
        </Bouton>
        <span class="montant-mise">
          <CompteurRouleaux valeur={montant} duree={0} taille={64} />
        </span>
        <Bouton variante="secondaire" disabled={occupe || montant >= maximum} onClick={() => fixer(montant + 1)}>
          +
        </Bouton>
      </div>
      <div class="raccourcis">
        <Bouton variante="secondaire" disabled={occupe} onClick={() => fixer(0)}>
          0
        </Bouton>
        <Bouton variante="secondaire" disabled={occupe || maximum < 5} onClick={() => fixer(5)}>
          5
        </Bouton>
        <Bouton variante="secondaire" disabled={occupe || maximum < 10} onClick={() => fixer(10)}>
          10
        </Bouton>
        <Bouton variante="secondaire" disabled={occupe} onClick={() => fixer(moitie)}>
          Moitié
        </Bouton>
        <Bouton variante="secondaire" disabled={occupe} onClick={() => fixer(maximum)}>
          Tout
        </Bouton>
      </div>
      <Bouton plein disabled={occupe} onClick={onValider}>
        {libelle}
      </Bouton>
    </div>
  );
}

export function CourseJoueur({
  course,
  moi,
  joueurs,
  solde,
  envoyer,
  occupe,
}: {
  course: CourseVue | null;
  moi: Moi;
  joueurs: JoueurPublic[];
  solde: number;
  envoyer: (action: Action) => Promise<void>;
  occupe: boolean;
}) {
  const [montant, setMontant] = useState(0);
  const [optionId, setOptionId] = useState('normal');
  const [parti, setParti] = useState(false);
  const cleMise = `${course?.phase ?? ''}|${course?.tour ?? 0}|${course?.etape ?? ''}|${course?.joueurCourantId ?? ''}`;
  useEffect(() => {
    setMontant(0);
    setOptionId('normal');
    setParti(false);
  }, [cleMise]);
  if (!course || !course.active) return <p style={{ marginTop: '16px' }}>En attente de la suite.</p>;

  const pseudos = new Map(joueurs.map((joueur) => [joueur.id, joueur.pseudo]));
  const nom = (id: string) => (id === moi.id ? 'toi' : pseudos.get(id) ?? 'Joueur');
  const position = course.positions[moi.id];
  const rangPassage = course.ordre.indexOf(moi.id);
  const aMoiDeLancer = course.phase === 'deplacements' && course.etape === 'lancer' && course.joueurCourantId === moi.id;
  const aMoiLaRoue = course.phase === 'deplacements' && course.etape === 'roue' && course.joueurCourantId === moi.id;
  const debut = course.phase === 'deplacements' ? Math.max(0, course.indexCourant) : 0;
  let joueursAvant = 0;
  if (rangPassage >= 0) {
    for (let index = debut; index < rangPassage; index += 1) {
      const id = course.ordre[index];
      if (id && !course.arrivees.includes(id)) joueursAvant += 1;
    }
  }
  const dejaJoue = course.phase === 'deplacements' && rangPassage >= 0 && rangPassage < course.indexCourant;
  const attente = course.arrivees.includes(moi.id)
    ? 'Tu es arrivé'
    : dejaJoue
      ? 'Tu as déjà joué'
      : joueursAvant === 0
        ? "C'est bientôt à toi"
        : joueursAvant === 1
          ? 'Encore 1 joueur avant toi'
          : `Encore ${joueursAvant} joueurs avant toi`;
  const option = course.optionsDe.find((candidat) => candidat.id === optionId) ?? course.optionsDe[0];

  if (course.ceremonie) {
    const fiche = joueurs.find((joueur) => joueur.id === moi.id);
    const rang = fiche ? libelleRang(fiche.place) : '';
    if (!course.ceremonie.classementRevele) {
      return (
        <p class="regarde-tv" data-ceremonie="telephone">
          Regarde la télé !
        </p>
      );
    }
    const celebration = course.ceremonie.gagnantRevele && fiche?.place === 1;
    return (
      <div class="pile" data-ceremonie="telephone" style={{ marginTop: '12px' }}>
        {!course.ceremonie.gagnantRevele ? <p class="regarde-tv">Regarde la télé !</p> : null}
        <p>
          Tu es {rang} avec {solde} GP.
        </p>
        {celebration ? (
          <div data-celebration="1">
            <Icone nom="trophee" taille={128} />
            <p>Tu remportes le bon de 20 €.</p>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div class="pile" style={{ marginTop: '12px' }}>
      {position !== undefined ? (
        <p>
          Case {position} sur {course.longueur}
          {course.arrivees.includes(moi.id) ? ' · arrivé' : ''}
          {rangPassage >= 0 ? ` · ${libelleRang(rangPassage + 1)} au passage` : ''}
        </p>
      ) : null}
      <p>{textePhase(course, pseudos)}</p>
      {course.phase === 'miniJeu' && course.topten ? (
        <TopTenJoueur topten={course.topten} moiId={moi.id} pseudos={pseudos} occupe={occupe} envoyer={envoyer} />
      ) : null}
      {course.phase === 'miniJeu' && course.jeopardy ? (
        <JeopardyJoueur jeopardy={course.jeopardy} ordre={course.ordre} nom={nom} envoyer={envoyer} />
      ) : null}
      {course.phase === 'miniJeu' && course.undercover ? <UndercoverJoueur undercover={course.undercover} nom={nom} /> : null}
      {course.dernierDe?.joueurId === moi.id ? <p>Tu as fait {course.dernierDe.valeur}.</p> : null}
      {!aMoiDeLancer && !aMoiLaRoue && rangPassage >= 0 ? (
        <div>
          <p>{attente}</p>
          <ol class="ordre-joueur">
            {course.ordre.map((id) => (
              <li key={id} class={id === moi.id ? 'moi' : undefined}>
                {pseudos.get(id) ?? 'Joueur'}
                {id === moi.id ? ' · toi' : ''}
                {course.arrivees.includes(id) ? ' · arrivé' : ''}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {aMoiDeLancer ? (
        <div class="pile" data-choix-de="1">
          {course.optionsDe.map((candidat) => {
            const cher = candidat.mise > solde;
            return (
              <button
                key={candidat.id}
                type="button"
                class={optionId === candidat.id ? 'tuile-de choisie' : 'tuile-de'}
                data-option={candidat.id}
                disabled={occupe || parti || cher}
                onClick={() => setOptionId(candidat.id)}
              >
                {estNomIcone(candidat.icone) ? <Icone nom={candidat.icone} taille={64} /> : null}
                <span class="tuile-de-corps">
                  <span>
                    {candidat.nom} · 1 à {candidat.faces} · {prixOption(candidat)}
                  </span>
                  <FacesDe faces={candidat.faces} />
                </span>
              </button>
            );
          })}
          <Bouton
            plein
            disabled={occupe || parti || !option || option.mise > solde}
            onClick={() => {
              if (parti || occupe || !option) return;
              setParti(true);
              vibrer(40);
              void envoyer({ type: 'lancerDe', option: option.id }).finally(() => setParti(false));
            }}
          >
            Lancer
          </Bouton>
        </div>
      ) : null}
      {aMoiLaRoue ? (
        <div class="pile">
          <p>Choisis ta mise. 0 passe la roue.</p>
          <Selecteur
            montant={montant}
            maximum={Math.max(0, solde)}
            onChange={setMontant}
            occupe={occupe || parti}
            libelle="Faire tourner la roue"
            onValider={() => {
              if (parti || occupe) return;
              setParti(true);
              vibrer(40);
              void envoyer({ type: 'miserRoue', montant }).finally(() => setParti(false));
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
