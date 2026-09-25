import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compositionCle, indiceValide, plier, validerCodenames } from '../shared/codenames';
import type { Action, EtatJeu, Origine } from '../shared/types';
import { lireCartesChance, lireCartesMalchance, lireConfigPlateau, lireRoue } from './course-config';
import { etatInitial } from './etat-initial';
import { lireCatalogue, lireCodenames, lireJeopardy, lirePerudo, lirePoker, lireTopTen, lireUndercover, lireJustOne } from './mini-jeux-config';
import { reduire, type ContexteReduction } from './reducteur';
import { projeterCourse } from './vues';

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const hote: Origine = { role: 'hote' };
const config = lireCodenames(RACINE);

function contexte(alea: (max: number) => number = () => 0): ContexteReduction {
  let n = 0;
  return {
    maintenant: 1_700_000_000_000,
    id: () => `id-${String(++n)}`,
    prochainIdEvenement: 1,
    dev: true,
    nbJoueursMax: 4,
    estEnLigne: () => false,
    alea,
    plateau: lireConfigPlateau(RACINE),
    cartes: lireCartesChance(RACINE),
    cartesMalchance: lireCartesMalchance(RACINE),
    roue: lireRoue(RACINE),
    catalogue: lireCatalogue(RACINE),
    poker: lirePoker(RACINE),
    topten: lireTopTen(RACINE),
    jeopardy: lireJeopardy(RACINE),
    undercover: lireUndercover(RACINE),
    codenames: config,
    perudo: lirePerudo(RACINE),
    justone: lireJustOne(RACINE),
    nomHote: 'Yanis',
  };
}

function jouer(etat: EtatJeu, action: Action, origine: Origine, ctx: ContexteReduction): EtatJeu {
  const resultat = reduire(etat, action, origine, ctx);
  expect(resultat.ok, !resultat.ok ? resultat.erreur : '').toBe(true);
  if (!resultat.ok) throw new Error(resultat.erreur);
  ctx.prochainIdEvenement = resultat.prochainIdEvenement;
  return resultat.etat;
}

function partie(ctx: ContexteReduction): { etat: EtatJeu; ids: string[] } {
  let etat = etatInitial('Test');
  const ids: string[] = [];
  for (const fiche of [
    { pseudo: 'Inès', avatar: 'perso-carpe' },
    { pseudo: 'Noé', avatar: 'perso-verre-eau' },
    { pseudo: 'Lina', avatar: 'perso-piment' },
    { pseudo: 'Léo', avatar: 'perso-planete' },
  ]) {
    etat = jouer(etat, { type: 'rejoindre', pseudo: fiche.pseudo, avatar: fiche.avatar }, { role: 'joueur', joueurId: '' }, ctx);
    ids.push(etat.joueurs[etat.joueurs.length - 1]!.id);
  }
  etat = jouer(etat, { type: 'demarrerCourse' }, hote, ctx);
  etat = jouer(etat, { type: 'nouveauTour' }, hote, ctx);
  etat = jouer(etat, { type: 'choisirMiniJeu', id: 'codenames' }, hote, ctx);
  return { etat, ids };
}

function preparer(etat: EtatJeu, _ids: string[], ctx: ContexteReduction): EtatJeu {
  let suivant = etat;
  suivant = jouer(suivant, { type: 'equipesHasardCodenames' }, hote, ctx);
  const prep = suivant.course!.codenames!.preparation;
  suivant = jouer(suivant, { type: 'designerEspionCodenames', equipe: 'rouge', joueurId: prep.equipes.rouge[0]! }, hote, ctx);
  suivant = jouer(suivant, { type: 'designerEspionCodenames', equipe: 'bleu', joueurId: prep.equipes.bleu[0]! }, hote, ctx);
  return jouer(suivant, { type: 'lancerGrilleCodenames' }, hote, ctx);
}

describe('Codenames', () => {
  it('valide la bibliothèque et la répartition 9-8-7-1', () => {
    expect(config.mots.length).toBeGreaterThanOrEqual(400);
    const plies = new Set(config.mots.map(plier));
    expect(plies.size).toBe(config.mots.length);
    expect(validerCodenames(config).grille).toBe(5);
    const cle = compositionCle('rouge', config.repartition);
    expect(cle.filter((c) => c === 'rouge')).toHaveLength(9);
    expect(cle.filter((c) => c === 'bleu')).toHaveLength(8);
    expect(cle.filter((c) => c === 'neutre')).toHaveLength(7);
    expect(cle.filter((c) => c === 'assassin')).toHaveLength(1);
  });

  it('refuse un indice de plusieurs mots ou qui touche la grille', () => {
    expect(indiceValide('deux mots', ['Canon'])).toMatch(/seul mot/);
    expect(indiceValide('Canon', ['Canon'])).toMatch(/touche/);
    expect(indiceValide('cano', ['Canon'])).toMatch(/touche/);
    expect(indiceValide('canonique', ['Canon'])).toMatch(/touche/);
    expect(indiceValide('Soleil', ['Canon'])).toBeNull();
  });

  it('compose une grille de 25 cases et inverse les rôles à la 2e manche', () => {
    const ctx = contexte(() => 0);
    let { etat, ids } = partie(ctx);
    etat = preparer(etat, ids, ctx);
    const manche = etat.course!.codenames!.manches[0]!;
    expect(manche.cartes).toHaveLength(25);
    expect(manche.cartes.filter((c) => c.couleur === manche.equipeDebut)).toHaveLength(9);
    expect(manche.cartes.filter((c) => c.couleur === 'assassin')).toHaveLength(1);
    const espions1 = { ...manche.espions };
    const agents1 = {
      rouge: manche.equipes.rouge.find((id) => id !== manche.espions.rouge)!,
      bleu: manche.equipes.bleu.find((id) => id !== manche.espions.bleu)!,
    };
    // Finir vite : assassin
    const assassin = manche.cartes.findIndex((c) => c.couleur === 'assassin');
    const equipe = manche.equipeCourante;
    const espion = manche.espions[equipe];
    etat = jouer(etat, { type: 'proposerIndiceCodenames', mot: 'Nuage', nombre: 1 }, { role: 'joueur', joueurId: espion }, ctx);
    etat = jouer(etat, { type: 'validerIndiceCodenames' }, hote, ctx);
    const agent = agents1[equipe];
    etat = jouer(etat, { type: 'retournerMotCodenames', index: assassin }, { role: 'joueur', joueurId: agent }, ctx);
    expect(etat.course!.codenames!.manches[0]!.etape).toBe('finie');
    etat = jouer(etat, { type: 'lancerGrilleCodenames' }, hote, ctx);
    const manche2 = etat.course!.codenames!.manches[1]!;
    expect(manche2.espions.rouge).toBe(agents1.rouge);
    expect(manche2.espions.bleu).toBe(agents1.bleu);
    expect(espions1.rouge).not.toBe(manche2.espions.rouge);
  });

  it('limite les essais au nombre + 1 et passe le tour sur un neutre', () => {
    const ctx = contexte(() => 0);
    let { etat } = partie(ctx);
    etat = preparer(etat, [], ctx);
    const manche = etat.course!.codenames!.manches[0]!;
    const equipe = manche.equipeCourante;
    const espion = manche.espions[equipe];
    const agent = manche.equipes[equipe].find((id) => id !== espion)!;
    etat = jouer(etat, { type: 'proposerIndiceCodenames', mot: 'Nuage', nombre: 0 }, { role: 'joueur', joueurId: espion }, ctx);
    etat = jouer(etat, { type: 'validerIndiceCodenames' }, hote, ctx);
    expect(etat.course!.codenames!.manches[0]!.essaisRestants).toBe(1);
    const allie = manche.cartes.findIndex((c) => c.couleur === equipe && !c.revelee);
    etat = jouer(etat, { type: 'retournerMotCodenames', index: allie }, { role: 'joueur', joueurId: agent }, ctx);
    expect(etat.course!.codenames!.manches[0]!.etape).toBe('indice');
    expect(etat.course!.codenames!.manches[0]!.equipeCourante).not.toBe(equipe);
  });

  it('fait gagner si tous les mots d’une équipe sont révélés, y compris par l’adversaire', () => {
    const ctx = contexte(() => 0);
    let { etat } = partie(ctx);
    etat = preparer(etat, [], ctx);
    const manche0 = etat.course!.codenames!.manches[0]!;
    const cible = manche0.equipeDebut === 'rouge' ? 'bleu' : 'rouge';
    const indices = manche0.cartes.map((c, i) => (c.couleur === cible ? i : -1)).filter((i) => i >= 0);
    for (const index of indices) {
      const manche = etat.course!.codenames!.manches[0]!;
      if (manche.etape === 'finie') break;
      if (manche.etape === 'indice') {
        const espion = manche.espions[manche.equipeCourante];
        etat = jouer(etat, { type: 'proposerIndiceCodenames', mot: `Zzz${'abcdefghijklmnop'[index % 16]}`, nombre: 9 }, { role: 'joueur', joueurId: espion }, ctx);
        etat = jouer(etat, { type: 'validerIndiceCodenames' }, hote, ctx);
      }
      if (etat.course!.codenames!.manches[0]!.cartes[index]!.revelee) continue;
      etat = jouer(etat, { type: 'retournerMotCodenames', index }, hote, ctx);
    }
    const finie = etat.course!.codenames!.manches[0]!;
    expect(finie.etape).toBe('finie');
    expect(finie.gagnant).toBe(cible);
  });

  it('ne répète aucun mot d’une grille à l’autre et cache la clé aux agents', () => {
    const ctx = contexte(() => 0);
    let { etat } = partie(ctx);
    etat = preparer(etat, [], ctx);
    const mots1 = etat.course!.codenames!.manches[0]!.cartes.map((c) => c.mot);
    const assassin = etat.course!.codenames!.manches[0]!.cartes.findIndex((c) => c.couleur === 'assassin');
    const manche = etat.course!.codenames!.manches[0]!;
    const espion = manche.espions[manche.equipeCourante];
    etat = jouer(etat, { type: 'proposerIndiceCodenames', mot: 'Nuage', nombre: 1 }, { role: 'joueur', joueurId: espion }, ctx);
    etat = jouer(etat, { type: 'validerIndiceCodenames' }, hote, ctx);
    etat = jouer(etat, { type: 'retournerMotCodenames', index: assassin }, hote, ctx);
    etat = jouer(etat, { type: 'lancerGrilleCodenames' }, hote, ctx);
    const mots2 = etat.course!.codenames!.manches[1]!.cartes.map((c) => c.mot);
    expect(mots1.some((mot) => mots2.includes(mot))).toBe(false);

    const agent = etat.course!.codenames!.manches[1]!.equipes.rouge.find(
      (id) => id !== etat.course!.codenames!.manches[1]!.espions.rouge,
    )!;
    const vueAgent = projeterCourse(etat.course, 'joueur', agent);
    expect(vueAgent?.codenames?.courante?.cartes.every((c) => c.revelee || c.couleur === null)).toBe(true);
    const vueEspion = projeterCourse(etat.course, 'joueur', etat.course!.codenames!.manches[1]!.espions.rouge);
    expect(vueEspion?.codenames?.courante?.cartes.every((c) => c.couleur !== null)).toBe(true);
    const vueTv = projeterCourse(etat.course, 'tv', null);
    expect(vueTv?.codenames?.courante?.cartes.every((c) => c.revelee || c.couleur === null)).toBe(true);
  });
});
