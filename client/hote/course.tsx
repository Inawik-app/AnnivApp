import { useState } from 'preact/hooks';
import type { Action, VueHote } from '../../shared/types';
import { Bouton, Tuile } from '../commun/composants';
import { etapeSuivante, textePhase } from '../commun/course-texte';
import { PanneauMiniJeux } from './mini-jeux';
import '../commun/course.css';

const NOMS_CASES: Record<string, string> = {
  depart: 'Départ',
  bonus: 'Bonus',
  chance: 'Chance',
  malchance: 'Malchance',
  cagnotte: 'Cagnotte',
  gamble: 'Gamble',
  arrivee: 'Arrivée',
};

function messageMasques(nombre: number): string {
  if (nombre <= 1) return "1 gain masqué n'est pas révélé";
  return `${nombre} gains masqués ne sont pas révélés`;
}

function CeremonieHote({
  vue,
  envoi,
  agir,
}: {
  vue: VueHote;
  envoi: boolean;
  agir: (action: Action) => void;
}) {
  const ceremonie = vue.course?.ceremonie;
  if (!ceremonie) {
    return (
      <div class="pile">
        {vue.nbMasquees > 0 ? (
          <>
            <p class="erreur" data-masquees="1">
              {messageMasques(vue.nbMasquees)}
            </p>
            <div class="rangee">
              <Bouton variante="secondaire" disabled={envoi} onClick={() => agir({ type: 'revelerMasquees' })}>
                Révéler les gains
              </Bouton>
              <Bouton disabled={envoi} onClick={() => agir({ type: 'ouvrirPodium', forcer: true })}>
                Continuer quand même
              </Bouton>
            </div>
          </>
        ) : (
          <Bouton disabled={envoi} onClick={() => agir({ type: 'ouvrirPodium' })}>
            Afficher le podium
          </Bouton>
        )}
      </div>
    );
  }
  const restants = ceremonie.suivants;
  return (
    <div class="pile" data-ceremonie-hote={ceremonie.etape}>
      {ceremonie.etape === 'cagnotte' ? (
        <Bouton disabled={envoi} onClick={() => agir({ type: 'verserCagnotteConsolation' })}>
          Verser la cagnotte
        </Bouton>
      ) : null}
      {ceremonie.etape === 'podium' ? (
        <Bouton disabled={envoi} onClick={() => agir({ type: 'tirerTrophees' })}>
          Tirer les trophées
        </Bouton>
      ) : null}
      {ceremonie.reveles.length > 0 || restants.length > 0 ? (
        <ul class="liste-trophees">
          {ceremonie.reveles.map((trophee) => (
            <li key={trophee.id}>Révélé : {trophee.nom}</li>
          ))}
          {restants.map((trophee) => (
            <li key={trophee.id}>{trophee.nom}</li>
          ))}
        </ul>
      ) : null}
      {ceremonie.etape === 'trophees' && restants.length > 0 ? (
        <Bouton disabled={envoi} onClick={() => agir({ type: 'revelerTrophee' })}>
          Trophée suivant
        </Bouton>
      ) : null}
      {ceremonie.etape === 'trophees' && restants.length === 0 && !ceremonie.classementRevele ? (
        <Bouton disabled={envoi} onClick={() => agir({ type: 'revelerClassement' })}>
          Révéler le classement
        </Bouton>
      ) : null}
      {ceremonie.classementRevele && !ceremonie.gagnantRevele ? (
        <Bouton disabled={envoi} onClick={() => agir({ type: 'revelerGagnant' })}>
          Révéler le gagnant
        </Bouton>
      ) : null}
    </div>
  );
}

export function PanneauCourse({
  vue,
  envoi,
  agir,
}: {
  vue: VueHote;
  envoi: boolean;
  agir: (action: Action) => void;
}) {
  const [positions, setPositions] = useState<Record<string, string>>({});
  const [confirmerFin, setConfirmerFin] = useState(false);
  const course = vue.course;
  const pseudos = new Map(vue.joueurs.map((joueur) => [joueur.id, joueur.pseudo]));
  const suite = course ? etapeSuivante(course) : null;
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
          <p>
            {course.tour > 0 ? `Tour ${course.tour}` : 'Préparation'} · {textePhase(course, pseudos)}
            {course.dernierTour && course.phase !== 'terminee' ? ' · Dernier tour' : ''}
          </p>
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
              {course.optionsDe.map((option) => (
                <Bouton
                  key={option.id}
                  variante="secondaire"
                  disabled={envoi}
                  onClick={() => agir({ type: 'lancerDe', option: option.id })}
                >
                  {option.nom}
                  {option.mise > 0 ? ` · ${option.mise} GP` : ' · gratuit'}
                </Bouton>
              ))}
            </div>
          ) : null}
          {course.phase === 'deplacements' && course.etape === 'roue' && course.joueurCourantId && joueurs.find((joueur) => joueur.id === course.joueurCourantId)?.enLigne === false ? (
            <Bouton disabled={envoi} onClick={() => agir({ type: 'miserRoue', montant: 0 })}>
              Passer la roue pour {pseudos.get(course.joueurCourantId) ?? 'le joueur'}
            </Bouton>
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
          {course.phase === 'deplacements' && course.etape ? (
            <Bouton variante="secondaire" disabled={envoi} onClick={() => agir({ type: 'passerJoueur' })}>
              Passer le joueur
            </Bouton>
          ) : null}
          {course.phase === 'terminee' ? (
            <CeremonieHote vue={vue} envoi={envoi} agir={agir} />
          ) : confirmerFin ? (
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
