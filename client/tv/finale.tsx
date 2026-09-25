import type { CourseVue, EvenementVue, JoueurPublic, TropheeTire } from '../../shared/types';
import { Avatar, CompteurRouleaux } from '../commun/composants';
import { Icone, estNomIcone } from '../commun/icones';
import { libelleRang } from '../commun/spectacle';
import './finale.css';

export type SceneFinale =
  | { genre: 'podium'; ordre: string[] }
  | { genre: 'trophee'; trophee: TropheeTire; phase: 'titre' | 'suspense' | 'gagnants' }
  | { genre: 'classement'; lignes: Array<{ id: string; gp: number }>; visibles: number }
  | { genre: 'gagnant'; ids: string[]; texte: string; revele: boolean };

function styleRoulement(nombre: number, reduit: boolean): { animation?: string } {
  if (reduit || nombre <= 0) return {};
  return { animation: `roulement-noms 0.8s steps(${nombre}, end) infinite` };
}

function lireTexte(valeur: unknown): string | null {
  return typeof valeur === 'string' && valeur.trim() !== '' ? valeur : null;
}

function lireIds(valeur: unknown): string[] {
  if (!Array.isArray(valeur)) return [];
  return valeur.filter((id): id is string => typeof id === 'string');
}

function tropheeDepuis(donnees: Record<string, unknown>): TropheeTire | null {
  const id = lireTexte(donnees.id);
  const nom = lireTexte(donnees.nom);
  const description = lireTexte(donnees.description);
  const icone = lireTexte(donnees.icone);
  const phrase = typeof donnees.phrase === 'string' ? donnees.phrase : '';
  const montant = typeof donnees.montant === 'number' ? donnees.montant : 0;
  if (!id || !nom || !description || !icone) return null;
  return { id, nom, description, icone, montant, gagnants: lireIds(donnees.gagnants), phrase };
}

export async function jouerCeremonie(
  evenement: EvenementVue,
  deps: {
    attendre: (ms: number) => Promise<void>;
    reduit: boolean;
    setScene: (scene: SceneFinale) => void;
    jouerSon: (nom: string) => void;
  },
): Promise<boolean> {
  const court = deps.reduit ? 80 : 0;
  if (evenement.type === 'ceremonie.podium') {
    deps.setScene({ genre: 'podium', ordre: lireIds(evenement.donnees.ordre) });
    return true;
  }
  if (evenement.type === 'trophee.revele') {
    const trophee = tropheeDepuis(evenement.donnees);
    if (!trophee) return true;
    deps.setScene({ genre: 'trophee', trophee, phase: 'titre' });
    await deps.attendre(court || 500);
    deps.setScene({ genre: 'trophee', trophee, phase: 'suspense' });
    await deps.attendre(court || 900);
    deps.setScene({ genre: 'trophee', trophee, phase: 'gagnants' });
    await deps.attendre(court || 400);
    return true;
  }
  if (evenement.type === 'classement.revele') {
    const brut = evenement.donnees.lignes;
    const lignes = Array.isArray(brut)
      ? brut.flatMap((entree) => {
          if (!entree || typeof entree !== 'object') return [];
          const ligne = entree as { joueurId?: unknown; gp?: unknown };
          if (typeof ligne.joueurId !== 'string' || typeof ligne.gp !== 'number') return [];
          return [{ id: ligne.joueurId, gp: ligne.gp }];
        })
      : [];
    for (let visibles = 1; visibles <= lignes.length; visibles += 1) {
      deps.setScene({ genre: 'classement', lignes, visibles });
      await deps.attendre(court || 700);
    }
    if (lignes.length === 0) deps.setScene({ genre: 'classement', lignes, visibles: 0 });
    return true;
  }
  if (evenement.type === 'gagnant.revele') {
    const ids = lireIds(evenement.donnees.gagnants);
    const texte = lireTexte(evenement.donnees.texte) ?? 'remporte le bon de 20 €';
    deps.setScene({ genre: 'gagnant', ids, texte, revele: false });
    await deps.attendre(court || 1800);
    deps.setScene({ genre: 'gagnant', ids, texte, revele: true });
    deps.jouerSon('victoire');
    return true;
  }
  return false;
}

function FicheJoueur({ joueur, rang }: { joueur: JoueurPublic; rang?: string }) {
  return (
    <div class="finale-fiche">
      <Avatar avatar={joueur.avatar} couleur={joueur.couleur} pseudo={joueur.pseudo} taille={128} />
      <p class="finale-nom">{joueur.pseudo}</p>
      {rang ? <p class="finale-rang">{rang}</p> : null}
    </div>
  );
}

export function sceneDepuis(course: CourseVue | null, joueurs: JoueurPublic[]): SceneFinale | null {
  const ceremonie = course?.ceremonie;
  if (!course || !ceremonie) return null;
  if (ceremonie.gagnantRevele) {
    const ids = joueurs.filter((joueur) => joueur.place === 1).map((joueur) => joueur.id);
    const texte = ids.length > 1 ? 'remportent le bon de 20 €' : 'remporte le bon de 20 €';
    return { genre: 'gagnant', ids, texte, revele: true };
  }
  if (ceremonie.classementRevele) {
    const tries = [...joueurs].sort((a, b) => b.gpVisibles - a.gpVisibles || a.pseudo.localeCompare(b.pseudo, 'fr'));
    const meilleur = tries[0]?.gpVisibles ?? 0;
    const lignes = tries
      .filter((joueur) => joueur.gpVisibles < meilleur)
      .reverse()
      .map((joueur) => ({ id: joueur.id, gp: joueur.gpVisibles }));
    return { genre: 'classement', lignes, visibles: lignes.length };
  }
  const dernier = ceremonie.reveles[ceremonie.reveles.length - 1];
  if (dernier) return { genre: 'trophee', trophee: dernier, phase: 'gagnants' };
  return { genre: 'podium', ordre: course.classement ? [...course.classement] : [] };
}

export function FinaleTv({
  scene,
  joueurs,
  reduit,
}: {
  scene: SceneFinale;
  joueurs: JoueurPublic[];
  reduit: boolean;
}) {
  const parId = new Map(joueurs.map((joueur) => [joueur.id, joueur]));
  const joueurDe = (id: string) => parId.get(id);

  if (scene.genre === 'podium') {
    return (
      <section class="finale" data-ecran="finale" data-ceremonie="podium">
        <h2 class="finale-titre">Podium de la course</h2>
        <div class="finale-rangee">
          {scene.ordre.map((id, index) => {
            const joueur = joueurDe(id);
            if (!joueur) return null;
            return <FicheJoueur key={id} joueur={joueur} rang={libelleRang(index + 1)} />;
          })}
        </div>
      </section>
    );
  }

  if (scene.genre === 'trophee') {
    const { trophee, phase } = scene;
    const icone = estNomIcone(trophee.icone) ? trophee.icone : null;
    return (
      <section class="finale" data-ecran="finale" data-ceremonie="trophee" data-trophee={trophee.id} data-phase={phase}>
        {icone ? <Icone nom={icone} taille={192} /> : null}
        <h2 class="finale-titre">{trophee.nom}</h2>
        <p class="finale-detail">{trophee.description}</p>
        {phase === 'suspense' ? (
          <div class={reduit ? 'roulement-cadre' : 'roulement-cadre actif'} aria-hidden="true">
            <div class="roulement-bande" style={styleRoulement(joueurs.length, reduit)}>
              {joueurs.map((joueur) => (
                <p key={joueur.id} class="roulement-nom">
                  {joueur.pseudo}
                </p>
              ))}
            </div>
          </div>
        ) : null}
        {phase === 'gagnants' ? (
          <div class="finale-rangee">
            {trophee.gagnants.map((id) => {
              const joueur = joueurDe(id);
              if (!joueur) return null;
              return <FicheJoueur key={id} joueur={joueur} />;
            })}
          </div>
        ) : null}
        {phase === 'gagnants' ? <p class="finale-phrase">{trophee.phrase}</p> : null}
        {phase === 'gagnants' ? <CompteurRouleaux valeur={trophee.montant} taille={96} duree={reduit ? 80 : 700} /> : null}
      </section>
    );
  }

  if (scene.genre === 'classement') {
    const montre = scene.lignes.slice(0, scene.visibles);
    return (
      <section
        class="finale"
        data-ecran="finale"
        data-ceremonie="classement"
        data-complet={scene.visibles >= scene.lignes.length ? '1' : '0'}
      >
        <h2 class="finale-titre">Classement final</h2>
        <div class="finale-colonne">
          {montre.map((ligne, index) => {
            const joueur = joueurDe(ligne.id);
            if (!joueur) return null;
            const rang = scene.lignes.length - index + 1;
            return (
              <div key={ligne.id} class="finale-ligne">
                <FicheJoueur joueur={joueur} rang={libelleRang(rang)} />
                <CompteurRouleaux valeur={ligne.gp} taille={96} duree={reduit ? 80 : 700} />
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <section class="finale" data-ecran="finale" data-ceremonie="gagnant" data-revele={scene.revele ? '1' : '0'}>
      <h2 class="finale-titre">{scene.revele ? 'Le gagnant' : 'Qui remporte la soirée ?'}</h2>
      {scene.revele ? (
        <div class="finale-gagnant">
          {!reduit ? (
            <div class="finale-confettis" aria-hidden="true">
              <Icone nom="confettis" taille={128} />
              <Icone nom="confettis" taille={128} />
            </div>
          ) : null}
          <Icone nom="trophee" taille={192} />
          <div class="finale-rangee">
            {scene.ids.map((id) => {
              const joueur = joueurDe(id);
              if (!joueur) return null;
              return <FicheJoueur key={id} joueur={joueur} />;
            })}
          </div>
          <p class="finale-phrase">{scene.texte}</p>
        </div>
      ) : (
        <div class={reduit ? 'roulement-cadre' : 'roulement-cadre actif'} aria-hidden="true">
          <div class="roulement-bande" style={styleRoulement(joueurs.length, reduit)}>
            {joueurs.map((joueur) => (
              <p key={joueur.id} class="roulement-nom">
                {joueur.pseudo}
              </p>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
