import { useEffect, useState } from 'preact/hooks';
import type { Action, CourseVue, JoueurPublic, VueJoueur } from '../../shared/types';
import { Bouton, CompteurRouleaux } from '../commun/composants';
import { textePhase } from '../commun/course-texte';
import { libelleRang } from '../commun/spectacle';
import '../commun/course.css';

type Moi = NonNullable<VueJoueur['moi']>;

function vibrer(ms: number): void {
  const navigation = navigator as Navigator & { vibrate?: (motif: number) => boolean };
  navigation.vibrate?.(ms);
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
        <Bouton variante="secondaire" disabled={occupe} onClick={() => fixer(Math.min(5, maximum))}>
          5
        </Bouton>
        <Bouton variante="secondaire" disabled={occupe} onClick={() => fixer(maximum)}>
          Max
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
  const [modifie, setModifie] = useState(false);
  const [parti, setParti] = useState(false);
  const cleMise = `${course?.phase ?? ''}|${course?.tour ?? 0}|${course?.duel?.etape ?? ''}`;
  useEffect(() => {
    setMontant(0);
    setModifie(false);
  }, [cleMise]);
  if (!course || !course.active) return <p style={{ marginTop: '16px' }}>En attente de la suite.</p>;

  const pseudos = new Map(joueurs.map((joueur) => [joueur.id, joueur.pseudo]));
  const position = course.positions[moi.id];
  const rangPassage = course.ordre.indexOf(moi.id);
  const mise = course.mises.find((entree) => entree.joueurId === moi.id);
  const plafond = Math.max(0, Math.min(course.miseMax, solde));
  const aMoiDeLancer = course.phase === 'deplacements' && course.etape === 'lancer' && course.joueurCourantId === moi.id;
  const cadeau = course.phase === 'deplacements' && course.etape === 'cadeau' && course.joueurCourantId === moi.id;
  const duel = course.duel;
  const jeDuelliste = duel !== null && (duel.joueurId === moi.id || duel.adversaireId === moi.id);
  const choisisAdversaire = duel !== null && duel.etape === 'adversaire' && duel.joueurId === moi.id;
  const maMiseDuel = duel?.mises.find((entree) => entree.joueurId === moi.id);
  const autres = joueurs.filter((joueur) => joueur.id !== moi.id && course.positions[joueur.id] !== undefined);

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
      {course.dernierDe?.joueurId === moi.id ? <p>Tu as fait {course.dernierDe.valeur}.</p> : null}
      {course.phase === 'mises' && mise && mise.aMise && mise.montant !== undefined && !modifie ? (
        <div class="pile">
          <p>Mise enregistrée : {mise.montant} GP</p>
          <Bouton variante="secondaire" disabled={occupe} onClick={() => { setMontant(mise.montant ?? 0); setModifie(true); }}>
            Modifier
          </Bouton>
        </div>
      ) : null}
      {course.phase === 'mises' && (!mise?.aMise || modifie) ? (
        <Selecteur
          montant={montant}
          maximum={plafond}
          onChange={setMontant}
          occupe={occupe}
          libelle="Valider ma mise"
          onValider={() => {
            setModifie(false);
            void envoyer({ type: 'miser', montant });
          }}
        />
      ) : null}
      {cadeau ? (
        <div>
          <p>{course.carte ? `${course.carte.titre}. ${course.carte.texte}` : 'Choisis qui reçoit le cadeau.'}</p>
          <div class="grille-choix">
            {autres.map((joueur) => (
              <Bouton key={joueur.id} disabled={occupe} onClick={() => void envoyer({ type: 'choisirBeneficiaire', joueurId: joueur.id })}>
                {joueur.pseudo}
              </Bouton>
            ))}
          </div>
        </div>
      ) : null}
      {choisisAdversaire ? (
        <div>
          <p>Choisis ton adversaire.</p>
          <div class="grille-choix">
            {autres.map((joueur) => (
              <Bouton key={joueur.id} disabled={occupe} onClick={() => void envoyer({ type: 'choisirAdversaire', joueurId: joueur.id })}>
                {joueur.pseudo}
              </Bouton>
            ))}
          </div>
        </div>
      ) : null}
      {duel && jeDuelliste && duel.etape === 'mises' && maMiseDuel && (!maMiseDuel.aMise || modifie) ? (
        <div>
          <p>{duel.defi ?? 'Duel'}</p>
          <Selecteur
            montant={montant}
            maximum={Math.max(0, Math.min(course.miseMaxDuel, solde))}
            onChange={setMontant}
            occupe={occupe}
            libelle="Valider ma mise"
            onValider={() => {
              setModifie(false);
              void envoyer({ type: 'miserDuel', montant });
            }}
          />
        </div>
      ) : null}
      {duel && jeDuelliste && duel.etape === 'mises' && maMiseDuel?.aMise && maMiseDuel.montant !== undefined && !modifie ? (
        <div class="pile">
          <p>{duel.defi}</p>
          <p>Mise enregistrée : {maMiseDuel.montant} GP</p>
          <Bouton variante="secondaire" disabled={occupe} onClick={() => { setMontant(maMiseDuel.montant ?? 0); setModifie(true); }}>
            Modifier
          </Bouton>
        </div>
      ) : null}
      {aMoiDeLancer ? (
        <button
          type="button"
          class="lancer-plein"
          disabled={occupe || parti}
          onPointerDown={(event) => {
            if (parti || occupe) return;
            event.preventDefault();
            setParti(true);
            vibrer(40);
            void envoyer({ type: 'lancerDe' }).finally(() => setParti(false));
          }}
        >
          Lancer le dé
        </button>
      ) : null}
    </div>
  );
}
