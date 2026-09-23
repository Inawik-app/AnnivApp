import { useEffect, useState } from 'preact/hooks';
import type { Action, VueHote } from '../../shared/types';
import { Bouton, Tuile } from '../commun/composants';
import { etapeSuivante, textePhase } from '../commun/course-texte';
import { PanneauMiniJeux } from './mini-jeux';
import '../commun/course.css';

const NOMS_CASES: Record<string, string> = {
  depart: 'Départ',
  bonus: 'Bonus',
  chance: 'Chance',
  cagnotte: 'Cagnotte',
  duel: 'Duel',
  arrivee: 'Arrivée',
};

export function PanneauCourse({
  vue,
  envoi,
  agir,
}: {
  vue: VueHote;
  envoi: boolean;
  agir: (action: Action) => void;
}) {
  const [miseLancer, setMiseLancer] = useState(0);
  const [positions, setPositions] = useState<Record<string, string>>({});
  const [confirmerFin, setConfirmerFin] = useState(false);
  const course = vue.course;
  const pseudos = new Map(vue.joueurs.map((joueur) => [joueur.id, joueur.pseudo]));
  const suite = course ? etapeSuivante(course) : null;
  const cleLancer = `${course?.tour ?? 0}|${course?.joueurCourantId ?? ''}`;
  useEffect(() => {
    setMiseLancer(0);
  }, [cleLancer]);
  const joueurs = [...vue.joueurs].sort((a, b) => a.rejointA - b.rejointA || a.pseudo.localeCompare(b.pseudo, 'fr'));

  return (
    <section class="pile" style={{ marginTop: '16px' }}>
      <h2>Course</h2>
      {vue.dev ? (
        <Bouton variante="secondaire" disabled={envoi} onClick={() => agir({ type: 'basculerBots' })}>
          {vue.bots ? 'Arrêter les bots' : 'Activer les bots'}
        </Bouton>
      ) : null}
      {!course || course.phase === 'terminee' ? (
        <Bouton plein disabled={envoi || vue.joueurs.length < 2} onClick={() => agir({ type: 'demarrerCourse' })}>
          {course?.phase === 'terminee' ? 'Démarrer une nouvelle course' : 'Démarrer la course'}
        </Bouton>
      ) : null}
      {course ? (
        <Tuile taille="petite" className="pile">
          <p>{course.tour > 0 ? `Tour ${course.tour}` : 'Préparation'} · {textePhase(course, pseudos)}</p>
          <p>Cagnotte : {course.cagnotte} GP</p>
          <div class="apercu-plateau" aria-hidden="true">
            {course.disposition.map((type, index) => (
              <span key={index} class={`pastille pastille-${type}`} title={`${NOMS_CASES[type] ?? type} ${index}`} />
            ))}
          </div>
          {course.ordre.length > 0 ? (
            <div>
              <h3>Ordre de passage</h3>
              {course.ordre.map((id, index) => (
                <p key={id}>
                  {index + 1}. {pseudos.get(id) ?? 'Joueur'}
                  {course.arrivees.includes(id) ? ' · arrivé' : ''}
                </p>
              ))}
              {course.phase === 'preparation' ? (
                <Bouton variante="secondaire" disabled={envoi} onClick={() => agir({ type: 'retirerOrdre' })}>
                  Tirer à nouveau l'ordre
                </Bouton>
              ) : null}
            </div>
          ) : null}
          {course.tour > 0 && course.choisitId ? (
            <p>{pseudos.get(course.choisitId) ?? 'Un joueur'} choisit le mini-jeu ce tour-ci</p>
          ) : null}
          {course.phase === 'preparation' ? (
            <Bouton variante="secondaire" disabled={envoi} onClick={() => agir({ type: 'regenererPlateau' })}>
              Regénérer le plateau
            </Bouton>
          ) : null}
          <Bouton variante="secondaire" disabled={envoi} onClick={() => agir({ type: 'choisirEcranTv', ecran: 'plateau' })}>
            Afficher le plateau sur la télé
          </Bouton>
          {course.tour >= 1 ? <PanneauMiniJeux vue={vue} envoi={envoi} agir={agir} /> : null}
          {suite ? (
            <div class="bouton-etape">
              <Bouton plein disabled={envoi} onClick={() => agir(suite.action)}>
                {suite.libelle}
              </Bouton>
            </div>
          ) : null}
          {course.phase === 'deplacements' && course.etape === 'lancer' && course.joueurCourantId ? (
            <div class="pile">
              <h3>Lancer pour {pseudos.get(course.joueurCourantId) ?? 'le joueur'}</h3>
              <label>
                Mise
                <input
                  type="number"
                  min="0"
                  max={course.miseMax}
                  value={miseLancer}
                  onInput={(event) => setMiseLancer(Math.max(0, Number((event.currentTarget as HTMLInputElement).value) || 0))}
                />
              </label>
              <Bouton
                disabled={envoi}
                onClick={() => agir({ type: 'lancerDe', mise: miseLancer })}
              >
                Lancer pour {pseudos.get(course.joueurCourantId) ?? 'le joueur'}
              </Bouton>
            </div>
          ) : null}
          {course.duel ? (
            <div class="pile">
              <h3>Duel</h3>
              <p>
                {pseudos.get(course.duel.joueurId) ?? 'Joueur'}
                {course.duel.adversaireId ? ` contre ${pseudos.get(course.duel.adversaireId) ?? 'Joueur'}` : ' choisit un adversaire'}
              </p>
              {course.duel.defi ? <p>{course.duel.defi}</p> : null}
              {course.duel.etape === 'adversaire' ? (
                <div class="grille-choix">
                  {joueurs
                    .filter((joueur) => joueur.id !== course.duel?.joueurId)
                    .map((joueur) => (
                      <Bouton key={joueur.id} disabled={envoi} onClick={() => agir({ type: 'choisirAdversaire', joueurId: joueur.id })}>
                        {joueur.pseudo}
                      </Bouton>
                    ))}
                </div>
              ) : null}
              {course.duel.etape === 'mises' || course.duel.etape === 'resultat' ? (
                <div>
                  {course.duel.mises.map((mise) => (
                    <p key={mise.joueurId}>
                      {pseudos.get(mise.joueurId) ?? 'Joueur'} : {mise.montant !== undefined ? `${mise.montant} GP` : 'en attente'}
                    </p>
                  ))}
                  {course.duel.etape === 'mises' ? (
                    <Bouton variante="secondaire" disabled={envoi} onClick={() => agir({ type: 'autreDefi' })}>
                      Un autre défi
                    </Bouton>
                  ) : null}
                  {course.duel.etape === 'mises' && course.duel.mises.some((mise) => !mise.aMise) ? (
                    <Bouton disabled={envoi} onClick={() => agir({ type: 'cloreMisesDuel' })}>
                      Clore les mises du duel
                    </Bouton>
                  ) : null}
                </div>
              ) : null}
              {course.duel.etape === 'resultat' && course.duel.adversaireId ? (
                <div class="grille-choix">
                  <Bouton disabled={envoi} onClick={() => agir({ type: 'resultatDuel', resultat: 'joueur' })}>
                    {pseudos.get(course.duel.joueurId) ?? 'Joueur'} gagne
                  </Bouton>
                  <Bouton disabled={envoi} onClick={() => agir({ type: 'resultatDuel', resultat: 'adversaire' })}>
                    {pseudos.get(course.duel.adversaireId) ?? 'Joueur'} gagne
                  </Bouton>
                  <Bouton variante="secondaire" disabled={envoi} onClick={() => agir({ type: 'resultatDuel', resultat: 'egalite' })}>
                    Égalité
                  </Bouton>
                </div>
              ) : null}
            </div>
          ) : null}
          {course.etape === 'cadeau' && course.joueurCourantId ? (
            <div class="pile">
              <h3>Cadeau</h3>
              <p>{course.carte ? `${course.carte.titre}. ${course.carte.texte}` : 'Choisis le bénéficiaire.'}</p>
              <div class="grille-choix">
                {joueurs
                  .filter((joueur) => joueur.id !== course.joueurCourantId)
                  .map((joueur) => (
                    <Bouton key={joueur.id} disabled={envoi} onClick={() => agir({ type: 'choisirBeneficiaire', joueurId: joueur.id })}>
                      {joueur.pseudo}
                    </Bouton>
                  ))}
              </div>
            </div>
          ) : null}
          <h3>Corrections</h3>
          {joueurs.map((joueur) => (
            <div key={joueur.id} class="rangee">
              <span>{joueur.pseudo} · case {course.positions[joueur.id] ?? 0}</span>
              <input
                type="number"
                min="0"
                max={course.longueur}
                value={positions[joueur.id] ?? ''}
                onInput={(event) => setPositions({ ...positions, [joueur.id]: (event.currentTarget as HTMLInputElement).value })}
              />
              <Bouton
                variante="secondaire"
                disabled={envoi}
                onClick={() => agir({ type: 'definirPosition', joueurId: joueur.id, position: Number(positions[joueur.id]) })}
              >
                Placer
              </Bouton>
            </div>
          ))}
          {course.phase === 'deplacements' && course.etape && course.duel?.etape !== 'resultat' ? (
            <Bouton variante="secondaire" disabled={envoi} onClick={() => agir({ type: 'passerJoueur' })}>
              Passer le joueur
            </Bouton>
          ) : null}
          {confirmerFin ? (
            <div class="rangee">
              <Bouton
                variante="danger"
                disabled={envoi}
                onClick={() => {
                  setConfirmerFin(false);
                  agir({ type: 'terminerCourse' });
                }}
              >
                Confirmer la fin de la course
              </Bouton>
              <Bouton variante="secondaire" onClick={() => setConfirmerFin(false)}>
                Revenir
              </Bouton>
            </div>
          ) : (
            <Bouton variante="danger" onClick={() => setConfirmerFin(true)}>
              Terminer la course
            </Bouton>
          )}
        </Tuile>
      ) : (
        <p>Le plateau se génère au démarrage. Tous les pions partent de la case 0.</p>
      )}
    </section>
  );
}
