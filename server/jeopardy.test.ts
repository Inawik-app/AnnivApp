import path from 'node:path';
import { randomInt } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { etatInitial } from './etat-initial';
import { lireCatalogue, lireJeopardy, lirePoker, lireTopTen, lireUndercover } from './mini-jeux-config';
import { lireCartesChance, lireCartesMalchance, lireConfigPlateau, lireRoue } from './course-config';
import { reduire, type ContexteReduction } from './reducteur';
import { projeterCourse } from './vues';
import { couleurBuzzer, reponseChiffree, validerJeopardy } from '../shared/jeopardy';
import { solde } from '../shared/soldes';
import type { Action, EtatJeu, Origine } from '../shared/types';

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const hote: Origine = { role: 'hote' };
const config = lireJeopardy(RACINE);

function contexte(partiel: Partial<ContexteReduction> = {}): ContexteReduction {
  let n = 0;
  return {
    maintenant: 1_700_000_000_000,
    id: () => `id-${String(++n)}`,
    prochainIdEvenement: 1,
    dev: true,
    nbJoueursMax: 4,
    estEnLigne: () => false,
    alea: (max: number) => randomInt(0, Math.max(1, max)),
    plateau: lireConfigPlateau(RACINE),
    cartes: lireCartesChance(RACINE),
    cartesMalchance: lireCartesMalchance(RACINE),
    roue: lireRoue(RACINE),
    catalogue: lireCatalogue(RACINE),
    poker: lirePoker(RACINE),
    topten: lireTopTen(RACINE),
    jeopardy: config,
    undercover: lireUndercover(RACINE),
    ...partiel,
  };
}

function jouer(etat: EtatJeu, action: Action, origine: Origine, ctx: ContexteReduction): EtatJeu {
  const resultat = reduire(etat, action, origine, ctx);
  expect(resultat.ok, !resultat.ok ? resultat.erreur : '').toBe(true);
  if (!resultat.ok) throw new Error(resultat.erreur);
  ctx.prochainIdEvenement = resultat.prochainIdEvenement;
  return resultat.etat;
}

function refus(etat: EtatJeu, action: Action, origine: Origine, ctx: ContexteReduction): string {
  const resultat = reduire(etat, action, origine, ctx);
  return resultat.ok ? '' : resultat.erreur;
}

const joueur = (joueurId: string): Origine => ({ role: 'joueur', joueurId });

function partieJeopardy(ctx: ContexteReduction): EtatJeu {
  let etat = etatInitial('GP Party');
  for (const [pseudo, avatar] of [
    ['Mira', 'soleil'],
    ['Noé', 'lune'],
    ['Lina', 'feuille'],
    ['Sacha', 'goutte'],
  ] as const) {
    etat = jouer(etat, { type: 'rejoindre', pseudo, avatar }, { role: 'joueur', joueurId: null }, ctx);
  }
  etat = jouer(etat, { type: 'demarrerCourse' }, hote, ctx);
  etat = jouer(etat, { type: 'nouveauTour' }, hote, ctx);
  return jouer(etat, { type: 'choisirMiniJeu', id: 'jeopardy' }, hote, ctx);
}

function gp(etat: EtatJeu, id: string): number {
  return solde(etat.transactions, id, 'visibles');
}

function ordre(etat: EtatJeu): string[] {
  return etat.course?.ordre ?? [];
}

describe('Jeopardy', () => {
  it('lit la configuration prévue et refuse une réponse faite uniquement de chiffres', () => {
    expect(config.valeurs).toEqual([1, 2, 4, 7]);
    expect(config.penaliteMauvaiseReponse).toBe(0);
    expect(config.themes.length).toBeGreaterThanOrEqual(1);
    for (const theme of config.themes) expect(theme.questions).toHaveLength(4);
    const theme = { nom: 'Chiffres', questions: config.valeurs.map(() => ({ question: 'Combien ?', reponse: 'Paris' })) };
    expect(() => validerJeopardy({ ...config, themes: [theme] })).not.toThrow();
    const chiffre = { ...theme, questions: [{ question: 'En quelle année ?', reponse: '1998' }, ...theme.questions.slice(1)] };
    expect(() => validerJeopardy({ ...config, themes: [chiffre] })).toThrow('interdit');
    const date = { ...theme, questions: [{ question: 'Quand ?', reponse: 'Paris', accepte: ['14/07/1789'] }, ...theme.questions.slice(1)] };
    expect(() => validerJeopardy({ ...config, themes: [date] })).toThrow('interdit');
    expect(reponseChiffree('42')).toBe(true);
    expect(reponseChiffree('Apollo 11')).toBe(false);
    expect(() => validerJeopardy({ ...config, themes: [{ nom: 'Court', questions: [{ question: 'Une seule' }] }] })).toThrow(
      'jeopardy.json : le thème « Court » doit avoir 4 questions, une par valeur',
    );
  });

  it('fait tourner les choisisseurs dans l\'ordre de passage', () => {
    const ctx = contexte();
    let etat = partieJeopardy(ctx);
    const vus: string[] = [];
    for (let tour = 0; tour < 6; tour += 1) {
      const choisisseur = etat.course?.jeopardy?.choisisseurId ?? '';
      vus.push(choisisseur);
      etat = jouer(etat, { type: 'choisirCaseJeopardy', theme: tour % config.themes.length, niveau: Math.floor(tour / config.themes.length) }, hote, ctx);
      etat = jouer(etat, { type: 'personneJeopardy' }, hote, ctx);
    }
    const o = ordre(etat);
    expect(vus).toEqual([o[0], o[1], o[2], o[3], o[0], o[1]]);
    etat = jouer(etat, { type: 'choisirChoisisseurJeopardy', joueurId: o[3]! }, hote, ctx);
    etat = jouer(etat, { type: 'choisirCaseJeopardy', theme: 0, niveau: 3 }, hote, ctx);
    etat = jouer(etat, { type: 'personneJeopardy' }, hote, ctx);
    expect(etat.course?.jeopardy?.choisisseurId).toBe(o[0]);
    expect(refus(etat, { type: 'choisirCaseJeopardy', theme: 0, niveau: 3 }, hote, ctx)).toBe('Cette case a déjà été jouée');
  });

  it('donne la priorité au choisisseur, puis ouvre les buzzers aux autres après un faux', () => {
    const ctx = contexte();
    let etat = partieJeopardy(ctx);
    const [a, b, c, d] = ordre(etat) as [string, string, string, string];
    etat = jouer(etat, { type: 'choisirCaseJeopardy', theme: 0, niveau: 1 }, hote, ctx);
    const question = () => etat.course!.jeopardy!.question;
    expect(question()).toMatchObject({ choisisseurId: a, mainId: a, ouverte: false });
    expect([a, b, c, d].map((id) => couleurBuzzer(question(), id))).toEqual(['bleu', 'rouge', 'rouge', 'rouge']);
    expect(refus(etat, { type: 'buzzJeopardy' }, joueur(b), ctx)).toBe('Les buzzers sont fermés');
    etat = jouer(etat, { type: 'jugerJeopardy', juste: false }, hote, ctx);
    expect([a, b, c, d].map((id) => couleurBuzzer(question(), id))).toEqual(['gris', 'vert', 'vert', 'vert']);
    expect(refus(etat, { type: 'buzzJeopardy' }, joueur(a), ctx)).toBe("Tu t'es déjà trompé sur cette question");
    etat = jouer(etat, { type: 'buzzJeopardy' }, joueur(c), ctx);
    expect(refus(etat, { type: 'buzzJeopardy' }, joueur(b), ctx)).toBe('Les buzzers sont fermés');
    expect(refus(etat, { type: 'buzzJeopardy' }, joueur(c), ctx)).toBe('Les buzzers sont fermés');
    expect([a, b, c, d].map((id) => couleurBuzzer(question(), id))).toEqual(['gris', 'rouge', 'bleu', 'rouge']);
    etat = jouer(etat, { type: 'jugerJeopardy', juste: false }, hote, ctx);
    expect([a, b, c, d].map((id) => couleurBuzzer(question(), id))).toEqual(['gris', 'vert', 'gris', 'vert']);
    etat = jouer(etat, { type: 'buzzJeopardy' }, joueur(d), ctx);
    etat = jouer(etat, { type: 'jugerJeopardy', juste: true }, hote, ctx);
    expect(question()).toBeNull();
    expect(gp(etat, d)).toBe(2);
    expect([a, b, c].map((id) => gp(etat, id))).toEqual([0, 0, 0]);
    // Question suivante : plus personne n'est grisé.
    etat = jouer(etat, { type: 'choisirCaseJeopardy', theme: 1, niveau: 0 }, hote, ctx);
    expect([a, b, c, d].map((id) => couleurBuzzer(question(), id))).toEqual(['rouge', 'bleu', 'rouge', 'rouge']);
  });

  it('clôt la question sans points quand tout le monde s\'est trompé', () => {
    const ctx = contexte();
    let etat = partieJeopardy(ctx);
    const ids = ordre(etat);
    etat = jouer(etat, { type: 'choisirCaseJeopardy', theme: 0, niveau: 0 }, hote, ctx);
    etat = jouer(etat, { type: 'jugerJeopardy', juste: false }, hote, ctx);
    for (const id of ids.slice(1)) {
      etat = jouer(etat, { type: 'buzzJeopardy' }, joueur(id), ctx);
      etat = jouer(etat, { type: 'jugerJeopardy', juste: false }, hote, ctx);
    }
    expect(etat.course?.jeopardy?.question).toBeNull();
    expect(etat.course?.jeopardy?.jouees[0]).toMatchObject({ gagnantId: null });
    expect(etat.transactions).toHaveLength(0);
  });

  it('crédite les valeurs 1, 2, 4 et 7, puis termine quand toutes les cases sont jouées', () => {
    const ctx = contexte();
    let etat = partieJeopardy(ctx);
    const gagnant = ordre(etat)[0]!;
    let attendu = 0;
    for (let theme = 0; theme < config.themes.length; theme += 1) {
      for (let niveau = 0; niveau < 4; niveau += 1) {
        const avant = gp(etat, gagnant);
        etat = jouer(etat, { type: 'choisirChoisisseurJeopardy', joueurId: gagnant }, hote, ctx);
        etat = jouer(etat, { type: 'choisirCaseJeopardy', theme, niveau }, hote, ctx);
        etat = jouer(etat, { type: 'jugerJeopardy', juste: true }, hote, ctx);
        expect(gp(etat, gagnant) - avant).toBe([1, 2, 4, 7][niveau]);
        attendu += [1, 2, 4, 7][niveau]!;
      }
    }
    expect(etat.course?.jeopardy?.termine).toBe(true);
    expect(etat.course?.resultatsSaisis).toBe(true);
    expect(etat.course?.jeopardy?.gains[gagnant]).toBe(attendu);
    expect(etat.transactions.every((transaction) => transaction.source === 'mini-jeu')).toBe(true);
    expect(refus(etat, { type: 'choisirChoisisseurJeopardy', joueurId: gagnant }, hote, ctx)).toBe('Le Jeopardy est terminé');
  });

  it('retire la pénalité au seul joueur qui s\'est trompé, sans passer sous zéro', () => {
    const ctx = contexte({ jeopardy: { ...config, penaliteMauvaiseReponse: 3 } });
    let etat = partieJeopardy(ctx);
    const [a, b, c, d] = ordre(etat) as [string, string, string, string];
    etat = jouer(etat, { type: 'choisirCaseJeopardy', theme: 0, niveau: 3 }, hote, ctx);
    etat = jouer(etat, { type: 'jugerJeopardy', juste: true }, hote, ctx);
    expect(gp(etat, a)).toBe(7);
    etat = jouer(etat, { type: 'choisirChoisisseurJeopardy', joueurId: a }, hote, ctx);
    etat = jouer(etat, { type: 'choisirCaseJeopardy', theme: 1, niveau: 0 }, hote, ctx);
    etat = jouer(etat, { type: 'jugerJeopardy', juste: false }, hote, ctx);
    expect([a, b, c, d].map((id) => gp(etat, id))).toEqual([4, 0, 0, 0]);
    etat = jouer(etat, { type: 'buzzJeopardy' }, joueur(b), ctx);
    etat = jouer(etat, { type: 'jugerJeopardy', juste: false }, hote, ctx);
    expect([a, b, c, d].map((id) => gp(etat, id))).toEqual([4, 0, 0, 0]);
    const negatives = etat.transactions.filter((transaction) => transaction.montant < 0);
    expect(negatives).toEqual([expect.objectContaining({ joueurId: a, montant: -3, source: 'penalite' })]);
  });

  it('ne montre la question qu\'une fois la case choisie et la réponse qu\'à l\'hôte', () => {
    const ctx = contexte();
    let etat = partieJeopardy(ctx);
    const [a, b] = ordre(etat) as [string, string];
    expect(projeterCourse(etat.course, 'tv', null)?.jeopardy?.question).toBeNull();
    const theme = config.themes.findIndex((entree) => entree.questions[0]?.reponse);
    const source = config.themes[theme]!.questions[0]!;
    const avant = JSON.stringify(projeterCourse(etat.course, 'joueur', b));
    expect(avant).not.toContain(source.question);
    etat = jouer(etat, { type: 'choisirCaseJeopardy', theme, niveau: 0 }, hote, ctx);
    for (const [cible, id] of [['tv', null], ['joueur', a], ['joueur', b]] as const) {
      const vue = projeterCourse(etat.course, cible, id);
      expect(vue?.jeopardy?.question?.texte).toBe(source.question);
      expect(JSON.stringify(vue)).not.toContain(`"reponse"`);
      expect(JSON.stringify(vue)).not.toContain(source.reponse!);
    }
    expect(projeterCourse(etat.course, 'joueur', a)?.jeopardy?.monBuzzer).toBe('bleu');
    expect(projeterCourse(etat.course, 'joueur', b)?.jeopardy?.monBuzzer).toBe('rouge');
    expect(projeterCourse(etat.course, 'hote', null)?.jeopardy?.question?.reponse).toBe(source.reponse);
  });
});
