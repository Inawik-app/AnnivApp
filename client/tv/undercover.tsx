import type { ComponentChildren } from 'preact';
import type { CourseVue, MancheUndercoverVue, UndercoverVue } from '../../shared/types';
import { Icone } from '../commun/icones';
import { texteIssue } from '../commun/undercover';
import './undercover.css';

function Section({ etape, children, revelation }: { etape: string; revelation?: string; children: ComponentChildren }) {
  return (
    <section
      class="ecran-mini ecran-undercover"
      data-ecran="undercover"
      data-zone="undercover"
      data-etape={etape}
      data-revelation={revelation}
      data-panneau="principal"
    >
      {children}
    </section>
  );
}

function Tete({ manche, undercover }: { manche: MancheUndercoverVue; undercover: UndercoverVue }) {
  return (
    <div class="undercover-tete">
      <h2>
        Manche {manche.numero} sur {undercover.nbManches}
      </h2>
      {manche.etape === 'indices' ? <p class="undercover-tour">Tour {manche.tour}</p> : null}
    </div>
  );
}

function Ordre({ manche, nom }: { manche: MancheUndercoverVue; nom: (id: string) => string }) {
  return (
    <ol class="undercover-ordre">
      {manche.ordreParole.map((id, index) => {
        const elimine = manche.elimines.find((entree) => entree.id === id);
        return (
          <li key={id} class={elimine ? 'elimine' : undefined} data-joueur={id}>
            <span class="undercover-rang">{index + 1}</span>
            <span class="undercover-nom">{nom(id)}</span>
            <span class="undercover-role">{elimine ? (elimine.role === 'undercover' ? 'undercover' : 'civil') : 'en jeu'}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Gains({ gains, nom }: { gains: Record<string, number>; nom: (id: string) => string }) {
  const lignes = Object.entries(gains).filter(([, montant]) => montant > 0);
  return (
    <ul class="undercover-gains">
      {lignes.map(([id, montant]) => (
        <li key={id}>
          <span class="podium-nom">{nom(id)}</span>
          <span class="podium-gp">+{montant}</span>
        </li>
      ))}
    </ul>
  );
}

export function UndercoverTv({ course, undercover, nom }: { course: CourseVue; undercover: UndercoverVue; nom: (id: string) => string }) {
  const manche = undercover.courante;
  if (undercover.recap) {
    const totaux: Record<string, number> = {};
    for (const passee of undercover.bilan) {
      for (const [id, montant] of Object.entries(passee.gains)) totaux[id] = (totaux[id] ?? 0) + montant;
    }
    return (
      <Section etape="recap">
        <h2>Undercover : les gains</h2>
        <Gains gains={totaux} nom={nom} />
      </Section>
    );
  }
  if (!manche) {
    const jeu = course.catalogue.jeux.find((candidat) => candidat.id === course.miniJeuId);
    return (
      <Section etape="intro">
        <h2>{jeu?.nom ?? 'Undercover'}</h2>
        <ul class="lignes-regles">
          {(jeu?.regles ?? []).map((ligne) => (
            <li class="regle-ligne" key={ligne}>
              {ligne}
            </li>
          ))}
        </ul>
        <p class="undercover-consigne">Chacun regarde son mot sur son téléphone, en cachette.</p>
      </Section>
    );
  }
  if (manche.etape === 'finie' && manche.paire) {
    return (
      <Section etape="finie">
        <Tete manche={manche} undercover={undercover} />
        <p class="undercover-issue">{texteIssue(manche)}</p>
        <div class="undercover-mots">
          <div class="undercover-mot">
            <p class="undercover-mot-titre">Civils</p>
            <p class="undercover-mot-texte">{manche.paire.civils}</p>
          </div>
          <div class="undercover-mot intrus">
            <p class="undercover-mot-titre">Undercover{manche.undercoverId ? ` : ${nom(manche.undercoverId)}` : ''}</p>
            <p class="undercover-mot-texte">{manche.paire.undercover}</p>
          </div>
        </div>
        <Gains gains={manche.gains} nom={nom} />
      </Section>
    );
  }
  const dernier = manche.elimines[manche.elimines.length - 1] ?? null;
  const revelation = dernier ? dernier.role : undefined;
  return (
    <Section etape={manche.etape} revelation={revelation}>
      <Tete manche={manche} undercover={undercover} />
      <Ordre manche={manche} nom={nom} />
      {dernier ? (
        <div class={`undercover-revelation role-${dernier.role}`} key={dernier.id} data-role={dernier.role}>
          <Icone nom={dernier.role === 'undercover' ? 'masques' : 'enveloppe'} taille={128} />
          <div class="undercover-revelation-texte">
            <p class="undercover-annonce">
              {nom(dernier.id)} {dernier.role === 'undercover' ? "était l'undercover" : 'était civil'}
            </p>
            <p class="undercover-suite">
              {manche.etape === 'devine'
                ? `Les civils gagnent ${undercover.gainCivils} GP chacun. ${nom(dernier.id)} tente de deviner leur mot.`
                : 'La partie continue.'}
            </p>
          </div>
        </div>
      ) : (
        <p class="undercover-consigne">Un indice chacun, dans l'ordre, puis on élimine un joueur.</p>
      )}
    </Section>
  );
}
