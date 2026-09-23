import { useRef, useState } from 'preact/hooks';
import { NUMERO_MAX, NUMERO_MIN, REPONDANT_HOTE, texteTheme } from '../../shared/topten';
import type { Action, MancheTopTenVue, TopTenVue } from '../../shared/types';
import { Bouton } from './composants';
import { SecretAuDoigt } from './secret';
import './topten.css';

export { texteTheme };

export function nommeur(topten: TopTenVue, pseudos: Map<string, string>): (id: string) => string {
  return (id) => (id === REPONDANT_HOTE ? topten.nomHote : pseudos.get(id) ?? 'Joueur');
}

export function NumeroSecret({ numero }: { numero: number }) {
  return (
    <SecretAuDoigt aide="Maintiens ton doigt ici pour voir ton numéro">
      <span class="numero-secret-chiffre">{numero}</span>
    </SecretAuDoigt>
  );
}

function deplacer(liste: string[], depuis: number, vers: number): string[] {
  if (depuis === vers || vers < 0 || vers >= liste.length) return liste;
  const copie = [...liste];
  const [pris] = copie.splice(depuis, 1);
  if (pris !== undefined) copie.splice(vers, 0, pris);
  return copie;
}

function lireDevine(valeur: string | undefined): number | null {
  if (!valeur || !valeur.trim()) return null;
  const nombre = Number(valeur);
  return Number.isInteger(nombre) && nombre >= NUMERO_MIN && nombre <= NUMERO_MAX ? nombre : null;
}

export function ClassementTopTen({
  manche,
  nom,
  occupe,
  envoyer,
}: {
  manche: MancheTopTenVue;
  nom: (id: string) => string;
  occupe: boolean;
  envoyer: (action: Action) => void | Promise<void>;
}) {
  const [ordre, setOrdre] = useState<string[]>(() => [...manche.repondants]);
  const [devines, setDevines] = useState<Record<string, string>>({});
  const [confirmer, setConfirmer] = useState(false);
  const [saisi, setSaisi] = useState<string | null>(null);
  const liste = useRef<HTMLOListElement>(null);

  const invalides = ordre.filter((id) => (devines[id] ?? '').trim() !== '' && lireDevine(devines[id]) === null);

  const glisser = (id: string, y: number) => {
    const racine = liste.current;
    if (!racine) return;
    const lignes = Array.from(racine.children) as HTMLElement[];
    let cible = lignes.length - 1;
    for (let index = 0; index < lignes.length; index += 1) {
      const boite = lignes[index]!.getBoundingClientRect();
      if (y < boite.top + boite.height / 2) {
        cible = index;
        break;
      }
    }
    const depuis = ordre.indexOf(id);
    if (depuis >= 0 && cible !== depuis) setOrdre(deplacer(ordre, depuis, cible));
  };

  const valider = () => {
    const finaux: Record<string, number | null> = {};
    for (const id of ordre) finaux[id] = lireDevine(devines[id]);
    void envoyer({ type: 'validerOrdreTopTen', ordre, devines: finaux });
  };

  if (confirmer) {
    return (
      <div class="pile classement-topten" data-confirmation="1">
        <p>Ton ordre, du plus petit au plus grand :</p>
        <ol class="recap-ordre">
          {ordre.map((id) => {
            const devine = lireDevine(devines[id]);
            return (
              <li key={id}>
                {nom(id)}
                {devine !== null ? ` · ${devine}` : ''}
              </li>
            );
          })}
        </ol>
        <Bouton plein disabled={occupe} onClick={valider}>
          Confirmer mon ordre
        </Bouton>
        <Bouton variante="secondaire" disabled={occupe} onClick={() => setConfirmer(false)}>
          Modifier mon ordre
        </Bouton>
      </div>
    );
  }

  return (
    <div class="pile classement-topten">
      <p>Classe les réponses du plus petit au plus grand numéro.</p>
      <ol class="liste-topten" ref={liste}>
        {ordre.map((id, index) => (
          <li key={id} class={saisi === id ? 'ligne-topten saisie' : 'ligne-topten'} data-repondant={id}>
            <label class="devine-topten">
              Numéro deviné (facultatif)
              <input
                type="number"
                inputMode="numeric"
                min={NUMERO_MIN}
                max={NUMERO_MAX}
                value={devines[id] ?? ''}
                onInput={(event) => setDevines({ ...devines, [id]: (event.currentTarget as HTMLInputElement).value })}
              />
            </label>
            <div class="corps-topten">
              <span
                class="poignee-topten"
                aria-label={`Glisser ${nom(id)}`}
                onPointerDown={(event) => {
                  event.preventDefault();
                  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
                  setSaisi(id);
                }}
                onPointerMove={(event) => {
                  if (saisi === id) glisser(id, event.clientY);
                }}
                onPointerUp={() => setSaisi(null)}
                onPointerCancel={() => setSaisi(null)}
              >
                ≡
              </span>
              <span class="rang-topten">{index + 1}</span>
              <span class="nom-topten">{nom(id)}</span>
              <button
                type="button"
                class="fleche-topten"
                aria-label={`Monter ${nom(id)}`}
                disabled={index === 0}
                onClick={() => setOrdre(deplacer(ordre, index, index - 1))}
              >
                ▲
              </button>
              <button
                type="button"
                class="fleche-topten"
                aria-label={`Descendre ${nom(id)}`}
                disabled={index === ordre.length - 1}
                onClick={() => setOrdre(deplacer(ordre, index, index + 1))}
              >
                ▼
              </button>
            </div>
          </li>
        ))}
      </ol>
      {invalides.length > 0 ? <p>Un numéro deviné va de {NUMERO_MIN} à {NUMERO_MAX}.</p> : null}
      <Bouton plein disabled={occupe || invalides.length > 0} onClick={() => setConfirmer(true)}>
        Valider mon ordre
      </Bouton>
    </div>
  );
}

export function ResultatManche({ manche, nom }: { manche: MancheTopTenVue; nom: (id: string) => string }) {
  const score = manche.score;
  const proposition = manche.proposition;
  if (!score || !proposition || !manche.numeros) return null;
  const numeros = manche.numeros;
  return (
    <div class="pile">
      <p>
        {nom(manche.captenId)} marque {score.total} GP
      </p>
      <ol class="recap-ordre">
        {proposition.ordre.map((id) => (
          <li key={id}>
            {nom(id)} : {numeros[id]}
            {score.exacts.includes(id) ? ' · deviné' : ''}
          </li>
        ))}
      </ol>
      <p>
        Ordre {score.pointsOrdre} · ordre parfait {score.bonusParfait} · chiffres exacts {score.bonusExacts}
      </p>
    </div>
  );
}

export function BilanTopTen({ topten, nom }: { topten: TopTenVue; nom: (id: string) => string }) {
  return (
    <ul class="recap-ordre">
      {topten.bilan.map((ligne) => (
        <li key={ligne.numero}>
          {nom(ligne.captenId)} : {ligne.total} GP
        </li>
      ))}
    </ul>
  );
}

/** Ce que voit un joueur : son numéro s'il répond, le classement s'il est Cap'Ten. */
export function TopTenJoueur({
  topten,
  moiId,
  pseudos,
  occupe,
  envoyer,
}: {
  topten: TopTenVue;
  moiId: string;
  pseudos: Map<string, string>;
  occupe: boolean;
  envoyer: (action: Action) => void | Promise<void>;
}) {
  const nom = nommeur(topten, pseudos);
  const manche = topten.courante;
  if (topten.recap) {
    return (
      <div class="pile topten-telephone">
        <h3>Top Ten terminé</h3>
        <BilanTopTen topten={topten} nom={nom} />
      </div>
    );
  }
  if (!manche) {
    return (
      <div class="pile topten-telephone">
        <h3>Top Ten</h3>
        <p>Cap'Ten dans l'ordre : {topten.captens.map(nom).join(', ')}</p>
      </div>
    );
  }
  const capten = manche.captenId === moiId;
  return (
    <div class="pile topten-telephone" data-topten-manche={manche.numero}>
      <h3>
        Manche {manche.numero} sur {topten.captens.length} · Cap'Ten : {capten ? 'toi' : nom(manche.captenId)}
      </h3>
      <p class="theme-topten">{manche.theme.intitule}</p>
      <p>{texteTheme(manche.theme)}</p>
      {manche.etape === 'reponses' && capten ? (
        <ClassementTopTen key={manche.numero} manche={manche} nom={nom} occupe={occupe} envoyer={envoyer} />
      ) : null}
      {manche.etape === 'reponses' && !capten && manche.monNumero !== null ? (
        <div class="pile">
          <NumeroSecret numero={manche.monNumero} />
          <p>Réponds au thème à voix haute selon ton numéro, sans le dire.</p>
        </div>
      ) : null}
      {manche.etape === 'revelee' ? <ResultatManche manche={manche} nom={nom} /> : null}
    </div>
  );
}
