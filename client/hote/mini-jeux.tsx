import { useEffect, useState } from 'preact/hooks';
import type { Action, VueHote } from '../../shared/types';
import { Bouton } from '../commun/composants';
import { IconeMiniJeu } from '../commun/icones';
import { PanneauTopTen } from './topten';
import { PanneauJeopardy } from './jeopardy';
import { PanneauUndercover } from './undercover';
import {
  baremeClassement,
  dureeNiveauMs,
  gainsClassement,
  gainsEquipes,
  libelleBareme,
  modulePret,
  repartirTapisHote,
  texteMinuteur,
  resteMinuteur,
} from '../../shared/mini-jeux';

/** Modules arbitrés depuis leur propre panneau, sans saisie de résultats. */
const ARBITRES = new Set(['topten', 'jeopardy', 'undercover']);

function entier(valeur: string): number {
  const nombre = Number(valeur);
  if (!Number.isInteger(nombre) || nombre < 0) return 0;
  return nombre;
}

export function PanneauMiniJeux({
  vue,
  envoi,
  agir,
}: {
  vue: VueHote;
  envoi: boolean;
  agir: (action: Action) => void;
}) {
  const course = vue.course;
  const [confirmerId, setConfirmerId] = useState<string | null>(null);
  const [saisieOuverte, setSaisieOuverte] = useState(false);
  const [conversionOuverte, setConversionOuverte] = useState(false);
  const [prochainExAequo, setProchainExAequo] = useState(false);
  const [ordre, setOrdre] = useState<Array<{ joueurId: string; exAequo: boolean }>>([]);
  const [equipeA, setEquipeA] = useState<string[]>([]);
  const [equipeB, setEquipeB] = useState<string[]>([]);
  const [gagnante, setGagnante] = useState<'A' | 'B' | null>(null);
  const [cible, setCible] = useState<'A' | 'B'>('A');
  const [montants, setMontants] = useState<Record<string, string>>({});
  const [tapis, setTapis] = useState<Record<string, string>>({});
  const [tapisHote, setTapisHote] = useState('0');
  const [horloge, setHorloge] = useState(() => Date.now());
  const cle = `${course?.tour ?? 0}|${course?.miniJeuId ?? ''}`;
  useEffect(() => {
    setConfirmerId(null);
    setSaisieOuverte(false);
    setConversionOuverte(false);
    setProchainExAequo(false);
    setOrdre([]);
    setEquipeA([]);
    setEquipeB([]);
    setGagnante(null);
    setCible('A');
    setMontants({});
    setTapis({});
    setTapisHote('0');
  }, [cle]);
  useEffect(() => {
    if (course?.minuteur.etat !== 'enCours') return;
    const id = window.setInterval(() => setHorloge(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [course?.minuteur.etat, course?.minuteur.finA]);
  if (!course || course.tour < 1) return null;

  const joueurs = [...vue.joueurs].sort((a, b) => a.rejointA - b.rejointA || a.pseudo.localeCompare(b.pseudo, 'fr'));
  const pseudos = new Map(joueurs.map((joueur) => [joueur.id, joueur.pseudo]));
  const jeu = course.catalogue.jeux.find((candidat) => candidat.id === course.miniJeuId) ?? null;
  const minuteur = course.minuteur;
  const reste = texteMinuteur(resteMinuteur(minuteur, horloge));

  const choisir = (id: string) => {
    const deja = course.joues.includes(id);
    if (deja) {
      setConfirmerId(id);
      return;
    }
    agir({ type: 'choisirMiniJeu', id });
  };

  const gainsApercu = () => {
    if (!jeu) return [];
    if (jeu.saisie === 'classement') return gainsClassement(ordre, baremeClassement(jeu, course.catalogue));
    if (jeu.saisie === 'equipes' && gagnante) return gainsEquipes(equipeA, equipeB, gagnante, course.catalogue.baremes.equipes);
    if (jeu.saisie === 'libre') return joueurs.map((joueur) => ({ joueurId: joueur.id, montant: entier(montants[joueur.id] ?? '0') }));
    return [];
  };

  const saisiePrete = () => {
    if (!jeu || course.resultatsSaisis) return false;
    if (jeu.saisie === 'classement') return ordre.length === joueurs.length;
    if (jeu.saisie === 'equipes') {
      return gagnante !== null && equipeA.length > 0 && equipeB.length > 0 && equipeA.length + equipeB.length === joueurs.length;
    }
    return true;
  };

  const apercuPoker = () => {
    const parts = repartirTapisHote(
      entier(tapisHote),
      joueurs.map((joueur) => ({ id: joueur.id, gpVisibles: joueur.gpVisibles })),
    );
    const partDe = new Map(parts.map((part) => [part.joueurId, part.montant]));
    return joueurs.map((joueur) => ({
      joueurId: joueur.id,
      tapis: entier(tapis[joueur.id] ?? '0'),
      part: partDe.get(joueur.id) ?? 0,
      total: entier(tapis[joueur.id] ?? '0') + (partDe.get(joueur.id) ?? 0),
    }));
  };

  const placer = (joueurId: string) => {
    if (ordre.some((entree) => entree.joueurId === joueurId)) return;
    setOrdre([...ordre, { joueurId, exAequo: prochainExAequo && ordre.length > 0 }]);
    setProchainExAequo(false);
  };

  const basculerEquipe = (joueurId: string) => {
    if (equipeA.includes(joueurId)) {
      setEquipeA(equipeA.filter((id) => id !== joueurId));
      return;
    }
    if (equipeB.includes(joueurId)) {
      setEquipeB(equipeB.filter((id) => id !== joueurId));
      return;
    }
    if (cible === 'A') setEquipeA([...equipeA, joueurId]);
    else setEquipeB([...equipeB, joueurId]);
  };

  const valider = () => {
    if (!jeu || !saisiePrete()) return;
    if (jeu.saisie === 'classement') {
      agir({ type: 'validerResultats', saisie: { mode: 'classement', ordre } });
      return;
    }
    if (jeu.saisie === 'equipes' && gagnante) {
      agir({ type: 'validerResultats', saisie: { mode: 'equipes', equipeA, equipeB, gagnante } });
      return;
    }
    const montantsFinaux: Record<string, number> = {};
    for (const joueur of joueurs) montantsFinaux[joueur.id] = entier(montants[joueur.id] ?? '0');
    agir({ type: 'validerResultats', saisie: { mode: 'libre', montants: montantsFinaux } });
  };

  const secondesNiveau = Math.round(dureeNiveauMs(course.pokerConfig) / 1000);
  const blinds = course.pokerConfig.niveaux[course.poker.niveau];

  return (
    <div class="pile">
      <Bouton variante="secondaire" disabled={envoi} onClick={() => agir({ type: 'afficherGrille' })}>
        {course.grilleVisible ? 'Masquer la grille' : 'Afficher la grille sur la télé'}
      </Bouton>
      {course.phase === 'choixMiniJeu' ? (
        <div class="grille-hote">
          {course.catalogue.jeux.map((candidat) => {
            const joue = course.joues.includes(candidat.id);
            return (
              <div key={candidat.id} class="tuile-hote">
                <Bouton plein disabled={envoi} onClick={() => choisir(candidat.id)}>
                  <IconeMiniJeu id={candidat.icone} nom={candidat.nom} taille={64} /> {candidat.nom}
                  {joue ? ' · joué' : ''}
                </Bouton>
                {joue ? (
                  <Bouton variante="secondaire" disabled={envoi} onClick={() => agir({ type: 'remettreMiniJeu', id: candidat.id })}>
                    Remettre en jeu
                  </Bouton>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
      {confirmerId ? (
        <div class="pile">
          <p>Ce mini-jeu a déjà été joué. Le relancer ?</p>
          <Bouton
            plein
            disabled={envoi}
            onClick={() => {
              agir({ type: 'choisirMiniJeu', id: confirmerId });
              setConfirmerId(null);
            }}
          >
            Relancer
          </Bouton>
          <Bouton variante="secondaire" disabled={envoi} onClick={() => setConfirmerId(null)}>
            Annuler
          </Bouton>
        </div>
      ) : null}
      {course.phase === 'miniJeu' && jeu ? (
        <div class="pile">
          <h3>{jeu.nom}</h3>
          {!ARBITRES.has(jeu.module) ? <p>{libelleBareme(jeu, course.catalogue)}</p> : null}
          {!modulePret(jeu.module) ? <p>Module disponible à la prochaine étape</p> : null}
          {jeu.module === 'topten' && course.topten ? (
            <PanneauTopTen topten={course.topten} pseudos={pseudos} envoi={envoi} agir={agir} />
          ) : null}
          {jeu.module === 'jeopardy' && course.jeopardy ? (
            <PanneauJeopardy jeopardy={course.jeopardy} ordre={course.ordre} pseudos={pseudos} envoi={envoi} agir={agir} />
          ) : null}
          {jeu.module === 'undercover' && course.undercover ? (
            <PanneauUndercover undercover={course.undercover} pseudos={pseudos} envoi={envoi} agir={agir} />
          ) : null}
          {jeu.duree ? (
            <Bouton
              disabled={envoi}
              onClick={() => agir({ type: 'demarrerMinuteur', duree: jeu.duree ?? 0, libelle: jeu.nom })}
            >
              Démarrer le minuteur ({jeu.duree} s)
            </Bouton>
          ) : null}
          {jeu.module === 'poker' ? (
            <div class="pile">
              <p>
                Niveau {course.poker.niveau + 1}
                {blinds ? ` · blinds ${blinds.petite} / ${blinds.grosse}` : ''}
              </p>
              <Bouton
                disabled={envoi}
                onClick={() =>
                  agir({
                    type: 'demarrerMinuteur',
                    duree: secondesNiveau,
                    libelle: blinds ? `Blinds ${blinds.petite} / ${blinds.grosse}` : 'Blinds',
                  })
                }
              >
                Démarrer
              </Bouton>
              <Bouton
                variante="secondaire"
                disabled={envoi || course.poker.niveau + 1 >= course.pokerConfig.niveaux.length}
                onClick={() => agir({ type: 'niveauSuivant' })}
              >
                Niveau suivant
              </Bouton>
              <Bouton variante="secondaire" disabled={envoi || course.resultatsSaisis} onClick={() => setConversionOuverte(true)}>
                Terminer
              </Bouton>
            </div>
          ) : ARBITRES.has(jeu.module) ? null : (
            <Bouton variante="secondaire" disabled={envoi || course.resultatsSaisis} onClick={() => setSaisieOuverte(true)}>
              Saisir les résultats
            </Bouton>
          )}
          {minuteur.etat !== 'arrete' ? (
            <div class="pile">
              <p>
                {minuteur.libelle} · {minuteur.etat === 'enPause' ? 'en pause' : 'en cours'} · {reste}
              </p>
              {minuteur.etat === 'enCours' ? (
                <Bouton variante="secondaire" disabled={envoi} onClick={() => agir({ type: 'pauseMinuteur' })}>
                  Pause
                </Bouton>
              ) : (
                <Bouton variante="secondaire" disabled={envoi} onClick={() => agir({ type: 'reprendreMinuteur' })}>
                  Reprendre
                </Bouton>
              )}
              <Bouton variante="secondaire" disabled={envoi} onClick={() => agir({ type: 'ajouter30s' })}>
                +30 s
              </Bouton>
              <Bouton variante="secondaire" disabled={envoi} onClick={() => agir({ type: 'arreterMinuteur' })}>
                Arrêter le minuteur
              </Bouton>
            </div>
          ) : null}
          {saisieOuverte && jeu.saisie === 'classement' ? (
            <div class="pile">
              <p>Touche les joueurs dans l'ordre d'arrivée.</p>
              {ordre.map((entree, index) => (
                <p key={entree.joueurId}>
                  {index + 1}. {pseudos.get(entree.joueurId) ?? 'Joueur'}
                  {entree.exAequo ? ' · ex aequo' : ''}
                </p>
              ))}
              <div class="grille-hote">
                {joueurs
                  .filter((joueur) => !ordre.some((entree) => entree.joueurId === joueur.id))
                  .map((joueur) => (
                    <Bouton key={joueur.id} disabled={envoi} onClick={() => placer(joueur.id)}>
                      {joueur.pseudo}
                    </Bouton>
                  ))}
              </div>
              <Bouton
                variante="secondaire"
                disabled={envoi || ordre.length === 0}
                onClick={() => setProchainExAequo(!prochainExAequo)}
              >
                ex aequo avec le précédent
              </Bouton>
              {prochainExAequo ? <p>Le prochain joueur sera ex aequo.</p> : null}
              <Bouton
                variante="secondaire"
                disabled={ordre.length === 0}
                onClick={() => setOrdre(ordre.slice(0, -1))}
              >
                Retirer le dernier
              </Bouton>
            </div>
          ) : null}
          {saisieOuverte && jeu.saisie === 'equipes' ? (
            <div class="pile">
              <p>Compose les deux équipes, puis désigne la gagnante.</p>
              <Bouton variante={cible === 'A' ? 'or' : 'secondaire'} onClick={() => setCible('A')}>
                Équipe A
              </Bouton>
              <Bouton variante={cible === 'B' ? 'or' : 'secondaire'} onClick={() => setCible('B')}>
                Équipe B
              </Bouton>
              {joueurs.map((joueur) => {
                const camp = equipeA.includes(joueur.id) ? 'A' : equipeB.includes(joueur.id) ? 'B' : '';
                return (
                  <Bouton key={joueur.id} disabled={envoi} onClick={() => basculerEquipe(joueur.id)}>
                    {joueur.pseudo}
                    {camp ? ` · équipe ${camp}` : ''}
                  </Bouton>
                );
              })}
              <Bouton variante={gagnante === 'A' ? 'or' : 'secondaire'} disabled={equipeA.length === 0} onClick={() => setGagnante('A')}>
                L'équipe A a gagné
              </Bouton>
              <Bouton variante={gagnante === 'B' ? 'or' : 'secondaire'} disabled={equipeB.length === 0} onClick={() => setGagnante('B')}>
                L'équipe B a gagné
              </Bouton>
            </div>
          ) : null}
          {saisieOuverte && jeu.saisie === 'libre' ? (
            <div class="pile">
              {joueurs.map((joueur) => (
                <label key={joueur.id}>
                  {joueur.pseudo}
                  <input
                    type="number"
                    min="0"
                    value={montants[joueur.id] ?? '0'}
                    onInput={(event) =>
                      setMontants({ ...montants, [joueur.id]: (event.currentTarget as HTMLInputElement).value })
                    }
                  />
                </label>
              ))}
            </div>
          ) : null}
          {saisieOuverte ? (
            <div class="pile">
              <h3>Aperçu</h3>
              {gainsApercu().map((gain) => (
                <p key={gain.joueurId}>
                  {pseudos.get(gain.joueurId) ?? 'Joueur'} : {gain.montant} GP
                </p>
              ))}
              <Bouton plein disabled={envoi || !saisiePrete()} onClick={valider}>
                Valider les résultats
              </Bouton>
            </div>
          ) : null}
          {conversionOuverte ? (
            <div class="pile">
              <h3>Tapis final</h3>
              {joueurs.map((joueur) => (
                <label key={joueur.id}>
                  {joueur.pseudo}
                  <input
                    type="number"
                    min="0"
                    value={tapis[joueur.id] ?? '0'}
                    onInput={(event) => setTapis({ ...tapis, [joueur.id]: (event.currentTarget as HTMLInputElement).value })}
                  />
                </label>
              ))}
              <label>
                Tapis de l'hôte
                <input type="number" min="0" value={tapisHote} onInput={(event) => setTapisHote((event.currentTarget as HTMLInputElement).value)} />
              </label>
              <h3>Aperçu</h3>
              {apercuPoker().map((ligne) => (
                <p key={ligne.joueurId}>
                  {pseudos.get(ligne.joueurId) ?? 'Joueur'} : {ligne.tapis} + {ligne.part} = {ligne.total} GP
                </p>
              ))}
              <Bouton
                plein
                disabled={envoi || course.resultatsSaisis}
                onClick={() => {
                  const finaux: Record<string, number> = {};
                  for (const joueur of joueurs) finaux[joueur.id] = entier(tapis[joueur.id] ?? '0');
                  agir({ type: 'validerPoker', tapis: finaux, tapisHote: entier(tapisHote) });
                }}
              >
                Valider la conversion
              </Bouton>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
