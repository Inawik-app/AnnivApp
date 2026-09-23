import { esperanceDe, probabilitesDe } from '../shared/de';
import { repartirTapisHote } from '../shared/mini-jeux';
import { solde } from '../shared/soldes';
import { REPONDANT_HOTE, scoreTopTen, type Devines } from '../shared/topten';
import type { CouleurBuzzer } from '../shared/jeopardy';
import type { Action, VueClient } from '../shared/types';
import { demarrerServeur, type ServeurJeu } from '../server/demarrer';
import { lireJeopardy } from '../server/mini-jeux-config';
import {
  CODE_HOTE,
  DISPOSITION,
  agir,
  attendreVue,
  connecter,
  fermerSession,
  fuitesJeopardy,
  fuitesMises,
  fuitesTopTen,
  fuitesUndercover,
  memeVue,
  ouvrirServeur,
  stabiliser,
  portDisponible,
  verifierInvariants,
  type Participant,
} from './session';

const DES = [
  1, 2, 4, 6,
  6, 6, 1, 1,
  6, 1, 1, 2,
  6, 1, 1, 1,
  6, 1, 2, 1,
  6, 1, 1, 1,
  6, 1, 1, 1,
  1, 1, 1, 1,
];

const CONFIG_JEOPARDY = lireJeopardy(process.cwd());

type Monde = {
  serveur: ServeurJeu;
  dossier: string;
  hote: Participant;
  tv: Participant;
  joueurs: Participant[];
};

const pages = (monde: Monde) => [monde.hote, monde.tv, ...monde.joueurs];

async function toutLeMonde(monde: Monde, plancher: number): Promise<void> {
  await Promise.all(pages(monde).map((page) => attendreVue(page, () => (page.vue?.version ?? 0) > plancher)));
}

async function jouer(monde: Monde, acteur: Participant, action: Action, nom: string): Promise<void> {
  const plancher = Math.max(...pages(monde).map((page) => page.vue?.version ?? 0));
  const reponse = await agir(acteur, action);
  if (!reponse.ok) throw new Error(`${nom} : ${reponse.erreur}`);
  await toutLeMonde(monde, plancher);
  verifierInvariants(monde.serveur.etat());
  const course = monde.tv.vue?.course;
  if (course && course.duel?.etape === 'mises') {
    const fuitesTv = fuitesMises(monde.tv.vue as VueClient, null);
    if (fuitesTv.length > 0) throw new Error(`Mise visible sur la TV (${nom}) : ${fuitesTv.join(', ')}`);
    for (const joueur of monde.joueurs) {
      const fuites = fuitesMises(joueur.vue as VueClient, joueur.joueurId);
      if (fuites.length > 0) throw new Error(`Mise visible pour ${joueur.pseudo} (${nom}) : ${fuites.join(', ')}`);
    }
  }
  verifierSecretsTopTen(monde, nom);
  verifierSecretsJeopardy(monde, nom);
  verifierSecretsUndercover(monde, nom);
  console.log(`OK     ${nom}`);
}

function verifierSecretsTopTen(monde: Monde, nom: string): void {
  const manches = monde.serveur.etat().course?.topten?.manches ?? [];
  const manche = manches[manches.length - 1];
  if (!manche || manche.etape !== 'reponses') return;
  const fuitesTv = fuitesTopTen(monde.tv.vue as VueClient, null, manche.numeros);
  if (fuitesTv.length > 0) throw new Error(`Numéro visible sur la TV (${nom}) : ${fuitesTv.join(', ')}`);
  for (const joueur of monde.joueurs) {
    const repondant = manche.repondants.includes(joueur.joueurId) ? joueur.joueurId : null;
    const fuites = fuitesTopTen(joueur.vue as VueClient, repondant, manche.numeros);
    if (fuites.length > 0) throw new Error(`Numéro visible pour ${joueur.pseudo} (${nom}) : ${fuites.join(', ')}`);
    const monNumero = joueur.vue?.course?.topten?.courante?.monNumero ?? null;
    if (repondant && monNumero !== manche.numeros[repondant]) throw new Error(`${joueur.pseudo} ne voit pas son numéro`);
  }
  const hote = monde.hote.vue?.course?.topten?.courante;
  if (JSON.stringify(hote?.numeros) !== JSON.stringify(manche.numeros)) throw new Error("L'hôte ne voit pas tous les numéros");
  if (hote?.monNumero !== manche.numeros[REPONDANT_HOTE]) throw new Error("L'hôte ne voit pas son numéro");
}

async function jouerTopTen(monde: Monde): Promise<void> {
  await annulerPuisRejouer(monde, 'le choix du Top Ten', async () => {
    await jouer(monde, monde.hote, { type: 'choisirMiniJeu', id: 'top-ten' }, 'Top Ten choisi');
  });
  const ordre = monde.serveur.etat().course?.ordre ?? [];
  const propositions: Array<(numeros: Record<string, number>, repondants: string[]) => { ordre: string[]; devines: Devines }> = [
    (numeros, repondants) => ({ ordre: [...repondants].sort((a, b) => (numeros[a] ?? 0) - (numeros[b] ?? 0)), devines: {} }),
    (numeros, repondants) => ({ ordre: [...repondants].sort((a, b) => (numeros[b] ?? 0) - (numeros[a] ?? 0)), devines: {} }),
    (numeros, repondants) => {
      const trie = [...repondants].sort((a, b) => (numeros[a] ?? 0) - (numeros[b] ?? 0));
      const [a, b, ...reste] = trie;
      const devines: Devines = { [trie[3]!]: numeros[trie[3]!] ?? null, [trie[2]!]: null };
      return { ordre: [b!, a!, ...reste], devines };
    },
    (numeros, repondants) => {
      const devines: Devines = {};
      for (const id of repondants) devines[id] = numeros[id] ?? null;
      return { ordre: [...repondants].sort((a, b) => (numeros[a] ?? 0) - (numeros[b] ?? 0)), devines };
    },
  ];
  const attendus = [10, 0, 6, 16];
  for (let index = 0; index < 4; index += 1) {
    await annulerPuisRejouer(monde, `le lancement de la manche ${index + 1} du Top Ten`, async () => {
      await jouer(monde, monde.hote, { type: 'lancerMancheTopTen' }, `Top Ten, manche ${index + 1}`);
    });
    const manches = monde.serveur.etat().course?.topten?.manches ?? [];
    const manche = manches[manches.length - 1];
    if (!manche) throw new Error('Manche de Top Ten absente');
    if (manche.captenId !== ordre[index]) throw new Error(`Cap'Ten inattendu pour la manche ${index + 1}`);
    if (manche.repondants.length !== 4 || manche.repondants[3] !== REPONDANT_HOTE) throw new Error("L'hôte doit être répondant");
    const valeurs = manche.repondants.map((id) => manche.numeros[id]);
    if (new Set(valeurs).size !== 4 || valeurs.some((valeur) => !valeur || valeur < 1 || valeur > 10)) {
      throw new Error(`Numéros invalides : ${valeurs.join(', ')}`);
    }
    const capten = monde.joueurs.find((joueur) => joueur.joueurId === manche.captenId);
    if (!capten) throw new Error("Cap'Ten introuvable");
    const autre = monde.joueurs.find((joueur) => joueur.joueurId !== manche.captenId);
    const proposition = propositions[index]!(manche.numeros, manche.repondants);
    if (autre) {
      const refus = await agir(autre, { type: 'validerOrdreTopTen', ...proposition });
      if (refus.ok) throw new Error("Un répondant ne doit pas pouvoir classer à la place du Cap'Ten");
    }
    const acteur = index === 3 ? monde.hote : capten;
    const avant = new Map(monde.joueurs.map((joueur) => [joueur.joueurId, solde(monde.serveur.etat().transactions, joueur.joueurId, 'visibles')]));
    await annulerPuisRejouer(monde, `l'ordre de la manche ${index + 1} du Top Ten`, async () => {
      await jouer(monde, acteur, { type: 'validerOrdreTopTen', ...proposition }, `Ordre du Cap'Ten ${capten.pseudo}`);
    });
    const attendu = scoreTopTen(proposition.ordre, manche.numeros, proposition.devines, {
      pointsParPaire: 1,
      bonusOrdreParfait: 4,
      bonusChiffresExacts: [0, 1, 2, 4, 6],
    }).total;
    if (attendu !== attendus[index]) throw new Error(`Score calculé inattendu : ${attendu}`);
    for (const joueur of monde.joueurs) {
      const gain = solde(monde.serveur.etat().transactions, joueur.joueurId, 'visibles') - (avant.get(joueur.joueurId) ?? 0);
      const voulu = joueur.joueurId === manche.captenId ? attendu : 0;
      if (gain !== voulu) throw new Error(`${joueur.pseudo} gagne ${gain} GP au lieu de ${voulu}`);
    }
    const revelee = monde.tv.vue?.course?.topten?.courante;
    if (revelee?.etape !== 'revelee' || revelee.score?.total !== attendu || !revelee.numeros) {
      throw new Error('La TV ne reçoit pas la révélation');
    }
  }
  if (monde.serveur.etat().transactions.some((transaction) => transaction.joueurId === REPONDANT_HOTE)) {
    throw new Error("L'hôte ne doit jamais recevoir de GP");
  }
  const encore = await agir(monde.hote, { type: 'lancerMancheTopTen' });
  if (encore.ok) throw new Error('Une cinquième manche ne doit pas démarrer');
  await annulerPuisRejouer(monde, 'le récapitulatif du Top Ten', async () => {
    await jouer(monde, monde.hote, { type: 'recapTopTen' }, 'Récapitulatif du Top Ten');
  });
  const bilan = monde.tv.vue?.course?.topten?.bilan.map((ligne) => ligne.total) ?? [];
  if (bilan.join(',') !== attendus.join(',')) throw new Error(`Récapitulatif inattendu : ${bilan.join(', ')}`);
  console.log("OK     Top Ten : Cap'Ten dans l'ordre, hôte répondant sans GP, numéros secrets jusqu'à la révélation");
}

function verifierSecretsJeopardy(monde: Monde, nom: string): void {
  const jeu = monde.serveur.etat().course?.jeopardy;
  if (!jeu || monde.serveur.etat().course?.ecranMini !== 'jeopardy') return;
  const courante = jeu.question ? { theme: jeu.question.theme, niveau: jeu.question.niveau } : null;
  for (const page of [monde.tv, ...monde.joueurs]) {
    const fuites = fuitesJeopardy(page.vue as VueClient, CONFIG_JEOPARDY, courante);
    if (fuites.length > 0) throw new Error(`Secret du Jeopardy visible pour ${page.pseudo} (${nom}) : ${fuites.join(', ')}`);
  }
  if (courante) {
    const source = CONFIG_JEOPARDY.themes[courante.theme]?.questions[courante.niveau];
    const vueHote = monde.hote.vue?.course?.jeopardy?.question;
    if (!source || vueHote?.reponse !== source.reponse) throw new Error(`L'hôte ne voit pas la réponse (${nom})`);
    if (monde.tv.vue?.course?.jeopardy?.question?.texte !== source.question) throw new Error(`La TV ne voit pas la question (${nom})`);
  }
}

function verifierSecretsUndercover(monde: Monde, nom: string): void {
  const course = monde.serveur.etat().course;
  const manches = course?.undercover?.manches ?? [];
  const manche = manches[manches.length - 1];
  if (!manche || course?.ecranMini !== 'undercover') return;
  const fuitesTv = fuitesUndercover(monde.tv.vue as VueClient, null, manche);
  if (fuitesTv.length > 0) throw new Error(`Secret de l'Undercover visible sur la TV (${nom}) : ${fuitesTv.join(', ')}`);
  for (const joueur of monde.joueurs) {
    const fuites = fuitesUndercover(joueur.vue as VueClient, joueur.joueurId, manche);
    if (fuites.length > 0) throw new Error(`Secret de l'Undercover visible pour ${joueur.pseudo} (${nom}) : ${fuites.join(', ')}`);
    const attendu = joueur.joueurId === manche.undercoverId ? manche.paire.undercover : manche.paire.civils;
    if (joueur.vue?.course?.undercover?.courante?.monMot !== attendu) throw new Error(`${joueur.pseudo} ne voit pas son mot (${nom})`);
  }
  const hote = monde.hote.vue?.course?.undercover?.courante;
  if (hote?.undercoverId !== manche.undercoverId || hote.paire?.civils !== manche.paire.civils) {
    throw new Error(`L'hôte ne voit pas les rôles et les mots (${nom})`);
  }
}

function verifierBuzzers(monde: Monde, attendus: Record<string, CouleurBuzzer>, etape: string): void {
  for (const joueur of monde.joueurs) {
    const couleur = joueur.vue?.course?.jeopardy?.monBuzzer;
    if (couleur !== attendus[joueur.joueurId]) {
      throw new Error(`Buzzer de ${joueur.pseudo} ${String(couleur)} au lieu de ${attendus[joueur.joueurId]} (${etape})`);
    }
  }
  if (monde.tv.vue?.course?.jeopardy?.monBuzzer !== null || monde.hote.vue?.course?.jeopardy?.monBuzzer !== null) {
    throw new Error(`Seuls les joueurs ont un buzzer (${etape})`);
  }
  console.log(`OK     Buzzers ${etape} : ${monde.joueurs.map((joueur) => `${joueur.pseudo} ${attendus[joueur.joueurId]}`).join(', ')}`);
}

function gainsDe(monde: Monde, libelle: string): Record<string, number> {
  const gains: Record<string, number> = {};
  for (const transaction of monde.serveur.etat().transactions) {
    if (transaction.libelle !== libelle) continue;
    gains[transaction.joueurId] = (gains[transaction.joueurId] ?? 0) + transaction.montant;
  }
  return gains;
}

async function jouerJeopardy(monde: Monde): Promise<void> {
  await annulerPuisRejouer(monde, 'le choix du Jeopardy', async () => {
    await jouer(monde, monde.hote, { type: 'choisirMiniJeu', id: 'jeopardy' }, 'Jeopardy choisi');
  });
  const ordre = monde.serveur.etat().course?.ordre ?? [];
  const participant = (id: string) => {
    const joueur = monde.joueurs.find((candidat) => candidat.joueurId === id);
    if (!joueur) throw new Error('Joueur introuvable');
    return joueur;
  };
  const couleurs = (liste: CouleurBuzzer[]) => Object.fromEntries(ordre.map((id, index) => [id, liste[index]!]));
  const jeu = () => monde.serveur.etat().course?.jeopardy;
  verifierBuzzers(monde, couleurs(['rouge', 'rouge', 'rouge', 'rouge']), 'avant la question');
  const attendus: Record<string, number> = {};
  const crediter = (id: string, niveau: number) => {
    attendus[id] = (attendus[id] ?? 0) + (CONFIG_JEOPARDY.valeurs[niveau] ?? 0);
  };
  let prochain = ordre[0]!;

  // Question 1 : chaque étape, chaque couleur, chaque annulation.
  if (jeu()?.choisisseurId !== prochain) throw new Error('Le premier choisisseur doit être le premier de l\'ordre');
  await annulerPuisRejouer(monde, 'le choix du choisisseur', async () => {
    await jouer(monde, monde.hote, { type: 'choisirChoisisseurJeopardy', joueurId: ordre[0]! }, `${participant(ordre[0]!).pseudo} choisit`);
  });
  await annulerPuisRejouer(monde, 'le choix d\'une case', async () => {
    await jouer(monde, monde.hote, { type: 'choisirCaseJeopardy', theme: 1, niveau: 0 }, 'Case Espace pour 1');
  });
  verifierBuzzers(monde, couleurs(['bleu', 'rouge', 'rouge', 'rouge']), 'priorité du choisisseur');
  const tropTot = await agir(participant(ordre[1]!), { type: 'buzzJeopardy' });
  if (tropTot.ok) throw new Error('Un buzz pendant la priorité doit être refusé');
  await annulerPuisRejouer(monde, 'une mauvaise réponse', async () => {
    await jouer(monde, monde.hote, { type: 'jugerJeopardy', juste: false }, 'Faux du choisisseur');
  });
  verifierBuzzers(monde, couleurs(['gris', 'vert', 'vert', 'vert']), 'buzzers ouverts');
  const grise = await agir(participant(ordre[0]!), { type: 'buzzJeopardy' });
  if (grise.ok) throw new Error('Un joueur qui s\'est trompé ne doit pas rebuzzer');
  await annulerPuisRejouer(monde, 'un buzz', async () => {
    await jouer(monde, participant(ordre[2]!), { type: 'buzzJeopardy' }, `Buzz de ${participant(ordre[2]!).pseudo}`);
  });
  if (jeu()?.question?.mainId !== ordre[2]) throw new Error('Le premier buzz doit prendre la main');
  verifierBuzzers(monde, couleurs(['gris', 'rouge', 'bleu', 'rouge']), 'main au premier buzz');
  for (const retard of [ordre[1]!, ordre[2]!, ordre[3]!]) {
    const refus = await agir(participant(retard), { type: 'buzzJeopardy' });
    if (refus.ok) throw new Error('Un second buzz doit être refusé');
  }
  await jouer(monde, monde.hote, { type: 'jugerJeopardy', juste: false }, 'Faux après le buzz');
  verifierBuzzers(monde, couleurs(['gris', 'vert', 'gris', 'vert']), 'réouverture après un faux');
  await jouer(monde, participant(ordre[3]!), { type: 'buzzJeopardy' }, `Buzz de ${participant(ordre[3]!).pseudo}`);
  verifierBuzzers(monde, couleurs(['gris', 'rouge', 'gris', 'bleu']), 'second buzz');
  await annulerPuisRejouer(monde, 'une bonne réponse', async () => {
    await jouer(monde, monde.hote, { type: 'jugerJeopardy', juste: true }, 'Juste après le buzz');
  });
  crediter(ordre[3]!, 0);
  verifierBuzzers(monde, couleurs(['rouge', 'rouge', 'rouge', 'rouge']), 'question close');
  prochain = ordre[1]!;

  // Question 2 : le choisisseur suivant répond juste, personne n'est plus grisé.
  if (jeu()?.choisisseurId !== prochain) throw new Error('Le choisisseur suivant doit être présélectionné');
  await jouer(monde, monde.hote, { type: 'choisirCaseJeopardy', theme: 2, niveau: 3 }, 'Case Jeux vidéo pour 7');
  verifierBuzzers(monde, couleurs(['rouge', 'bleu', 'rouge', 'rouge']), 'nouvelle question');
  await jouer(monde, monde.hote, { type: 'jugerJeopardy', juste: true }, 'Juste du choisisseur');
  crediter(ordre[1]!, 3);

  // Question 3 : personne.
  await jouer(monde, monde.hote, { type: 'choisirCaseJeopardy', theme: 0, niveau: 0 }, 'Case Yanis pour 1');
  const vueHote = monde.hote.vue?.course?.jeopardy?.question;
  if (vueHote?.reponse !== null) throw new Error('Une question sans réponse écrite doit envoyer null à l\'hôte');
  await annulerPuisRejouer(monde, 'une question sans gagnant', async () => {
    await jouer(monde, monde.hote, { type: 'personneJeopardy' }, 'Personne');
  });

  // Le reste de la grille, sauf la dernière case, en alternant juste et personne.
  let restantes = 0;
  for (let theme = 0; theme < CONFIG_JEOPARDY.themes.length; theme += 1) {
    for (let niveau = 0; niveau < CONFIG_JEOPARDY.valeurs.length; niveau += 1) {
      if (jeu()?.jouees.some((entree) => entree.theme === theme && entree.niveau === niveau)) continue;
      restantes += 1;
      if (theme === 3 && niveau === 3) continue;
      const choisisseur = jeu()?.choisisseurId ?? '';
      await jouer(monde, monde.hote, { type: 'choisirCaseJeopardy', theme, niveau }, `Case ${theme + 1}-${niveau + 1}`);
      if (restantes % 2 === 0) {
        await jouer(monde, monde.hote, { type: 'jugerJeopardy', juste: true }, `Juste ${theme + 1}-${niveau + 1}`);
        crediter(choisisseur, niveau);
      } else {
        await jouer(monde, monde.hote, { type: 'personneJeopardy' }, `Personne ${theme + 1}-${niveau + 1}`);
      }
    }
  }
  if (jeu()?.termine) throw new Error('Le Jeopardy ne doit pas finir avant la dernière case');
  await annulerPuisRejouer(monde, 'l\'arrêt du Jeopardy', async () => {
    await jouer(monde, monde.hote, { type: 'terminerJeopardy' }, 'Arrêt du Jeopardy');
  });
  if (!jeu()?.termine || !monde.serveur.etat().course?.resultatsSaisis) throw new Error('Le Jeopardy devrait être terminé');
  const recus = gainsDe(monde, 'Jeopardy');
  for (const id of ordre) {
    if ((recus[id] ?? 0) !== (attendus[id] ?? 0) || (jeu()?.gains[id] ?? 0) !== (attendus[id] ?? 0)) {
      throw new Error(`Gains du Jeopardy inattendus pour ${participant(id).pseudo} : ${recus[id] ?? 0} au lieu de ${attendus[id] ?? 0}`);
    }
  }
  if (JSON.stringify(monde.tv.vue?.course?.jeopardy?.gains) !== JSON.stringify(jeu()?.gains)) throw new Error('La TV n\'a pas le récapitulatif');
  console.log('OK     Jeopardy : rotation, priorité, buzzers, valeurs 1/2/4/7 et secrets tenus');
}

async function jouerUndercover(monde: Monde): Promise<void> {
  await annulerPuisRejouer(monde, 'le choix de l\'Undercover', async () => {
    await jouer(monde, monde.hote, { type: 'choisirMiniJeu', id: 'undercover' }, 'Undercover choisi');
  });
  const manche = () => {
    const manches = monde.serveur.etat().course?.undercover?.manches ?? [];
    const derniere = manches[manches.length - 1];
    if (!derniere) throw new Error('Manche d\'Undercover absente');
    return derniere;
  };
  const avant = gainsDe(monde, 'Undercover');
  if (Object.keys(avant).length > 0) throw new Error('Aucun gain d\'Undercover attendu avant la partie');

  await annulerPuisRejouer(monde, 'le lancement d\'une manche d\'Undercover', async () => {
    await jouer(monde, monde.hote, { type: 'lancerMancheUndercover' }, 'Undercover, manche 1');
  });
  const premiere = manche();
  if (premiere.ordreParole[0] === premiere.undercoverId) throw new Error('L\'undercover ne doit pas parler en premier');
  const civils1 = premiere.ordreParole.filter((id) => id !== premiere.undercoverId);
  if (JSON.stringify(monde.tv.vue?.course?.undercover?.courante?.ordreParole) !== JSON.stringify(premiere.ordreParole)) {
    throw new Error('La TV n\'affiche pas l\'ordre de parole');
  }
  await annulerPuisRejouer(monde, 'l\'élimination d\'un civil', async () => {
    await jouer(monde, monde.hote, { type: 'eliminerUndercover', joueurId: civils1[0]! }, 'Élimination d\'un civil');
  });
  const revele = monde.tv.vue?.course?.undercover?.courante?.elimines;
  if (JSON.stringify(revele) !== JSON.stringify([{ id: civils1[0], role: 'civil' }])) throw new Error('La TV ne révèle pas le civil');
  const elimine = monde.joueurs.find((joueur) => joueur.joueurId === civils1[0]);
  if (elimine?.vue?.course?.undercover?.courante?.jeSuisElimine !== true) throw new Error('Le civil éliminé ne le voit pas');
  await annulerPuisRejouer(monde, 'l\'élimination de l\'undercover', async () => {
    await jouer(monde, monde.hote, { type: 'eliminerUndercover', joueurId: premiere.undercoverId }, 'Élimination de l\'undercover');
  });
  if (monde.tv.vue?.course?.undercover?.courante?.undercoverId !== premiere.undercoverId) throw new Error('La TV ne révèle pas l\'undercover');
  await annulerPuisRejouer(monde, 'la devinette de l\'undercover', async () => {
    await jouer(monde, monde.hote, { type: 'devinerUndercover', trouve: true }, 'Mot trouvé');
  });
  const paireTv = monde.tv.vue?.course?.undercover?.courante?.paire;
  if (paireTv?.civils !== premiere.paire.civils || paireTv.undercover !== premiere.paire.undercover) {
    throw new Error('La TV ne révèle pas les deux mots');
  }
  const apres1 = gainsDe(monde, 'Undercover');
  for (const id of civils1) if (apres1[id] !== 6) throw new Error(`Un civil devrait avoir 6 GP (${apres1[id] ?? 0})`);
  if (apres1[premiere.undercoverId] !== 8) throw new Error('L\'undercover qui devine devrait avoir 8 GP');

  await jouer(monde, monde.hote, { type: 'lancerMancheUndercover' }, 'Undercover, manche 2');
  const seconde = manche();
  if (seconde.undercoverId === premiere.undercoverId) throw new Error('L\'undercover doit changer à chaque manche');
  if (seconde.indexPaire === premiere.indexPaire) throw new Error('Une paire ne doit pas être rejouée');
  const civils2 = seconde.ordreParole.filter((id) => id !== seconde.undercoverId);
  await jouer(monde, monde.hote, { type: 'eliminerUndercover', joueurId: civils2[0]! }, 'Premier civil éliminé');
  await jouer(monde, monde.hote, { type: 'eliminerUndercover', joueurId: civils2[1]! }, 'Second civil éliminé');
  if (manche().issue !== 'undercover' || manche().etape !== 'finie') throw new Error('L\'undercover devrait survivre');
  const apres2 = gainsDe(monde, 'Undercover');
  if ((apres2[seconde.undercoverId] ?? 0) - (apres1[seconde.undercoverId] ?? 0) !== 15) throw new Error('L\'undercover survivant devrait avoir 15 GP');
  for (const id of civils2) {
    if ((apres2[id] ?? 0) !== (apres1[id] ?? 0)) throw new Error('Les civils ne gagnent rien si l\'undercover survit');
  }
  await annulerPuisRejouer(monde, 'le récapitulatif de l\'Undercover', async () => {
    await jouer(monde, monde.hote, { type: 'recapUndercover' }, 'Récapitulatif de l\'Undercover');
  });
  if (!monde.serveur.etat().course?.resultatsSaisis) throw new Error('L\'Undercover devrait être clos');
  console.log('OK     Undercover : ordre de parole, révélations, gains 6/8/15 et mots secrets');
}

async function annulerPuisRejouer(monde: Monde, nom: string, refaire: () => Promise<void>): Promise<void> {
  const avant = pages(monde).map((page) => structuredClone(page.vue));
  await refaire();
  const plancher = Math.max(...pages(monde).map((page) => page.vue?.version ?? 0));
  const reponse = await agir(monde.hote, { type: 'annuler' });
  if (!reponse.ok) throw new Error(`Annulation ${nom} : ${reponse.erreur}`);
  await toutLeMonde(monde, plancher);
  pages(monde).forEach((page, index) => {
    if (!memeVue(avant[index] ?? null, page.vue)) {
      const gauche = JSON.stringify(stabiliser(avant[index] ?? null));
      const droite = JSON.stringify(stabiliser(page.vue));
      let curseur = 0;
      while (curseur < gauche.length && gauche[curseur] === droite[curseur]) curseur += 1;
      throw new Error(
        `Annulation ${nom} : la vue ${page.pseudo} diffère de l'état d'avant\n${gauche.slice(Math.max(0, curseur - 80), curseur + 80)}\n${droite.slice(Math.max(0, curseur - 80), curseur + 80)}`,
      );
    }
  });
  verifierInvariants(monde.serveur.etat());
  console.log(`OK     Annulation : ${nom}`);
  await refaire();
}

async function preparer(desForces: number[]): Promise<Monde> {
  const { serveur, dossier } = await ouvrirServeur({ desForces, disposition: DISPOSITION });
  const hote = await connecter(serveur.url, 'hote', { codeHote: CODE_HOTE });
  const tv = await connecter(serveur.url, 'tv');
  const joueurs: Participant[] = [];
  const fiches = [
    { pseudo: 'Léo', avatar: 'soleil' },
    { pseudo: 'Inès', avatar: 'lune' },
    { pseudo: 'Noé', avatar: 'feuille' },
    { pseudo: 'Lina', avatar: 'goutte' },
  ];
  for (const fiche of fiches) {
    const joueur = await connecter(serveur.url, 'joueur');
    joueur.pseudo = fiche.pseudo;
    const reponse = await agir(joueur, { type: 'rejoindre', pseudo: fiche.pseudo, avatar: fiche.avatar });
    if (!reponse.ok || !reponse.joueurId || !reponse.jeton) throw new Error(reponse.ok ? 'Joueur sans id' : reponse.erreur);
    joueur.joueurId = reponse.joueurId;
    joueur.jeton = reponse.jeton;
    joueurs.push(joueur);
  }
  const monde: Monde = { serveur, dossier, hote, tv, joueurs };
  const version = Math.max(...joueurs.map((joueur) => joueur.vue?.version ?? 0));
  await Promise.all(pages(monde).map((page) => attendreVue(page, () => (page.vue?.version ?? 0) >= version && (page.vue?.joueurs.length ?? 0) >= 4)));
  return monde;
}

async function main(): Promise<void> {
  const debut = Date.now();
  let monde: Monde | null = null;
  try {
    monde = await preparer(DES);
    const [leo, ines, noe, lina] = monde.joueurs;
    if (!leo || !ines || !noe || !lina) throw new Error('Il manque un joueur');

    await annulerPuisRejouer(monde, 'un ajout de GP', async () => {
      await jouer(monde as Monde, (monde as Monde).hote, {
        type: 'ajouterGP',
        joueurId: leo.joueurId,
        montant: 30,
        libelle: 'Départ',
      }, 'Ajout de GP');
    });
    for (const joueur of [ines, noe, lina]) {
      await jouer(monde, monde.hote, { type: 'ajouterGP', joueurId: joueur.joueurId, montant: 30, libelle: 'Départ' }, `Ajout de GP pour ${joueur.pseudo}`);
    }

    await jouer(monde, monde.hote, { type: 'demarrerCourse' }, 'Démarrage de la course');
    const ordreInitial = monde.serveur.etat().course?.ordre ?? [];
    if (monde.serveur.etat().course?.regles.longueur !== 38) throw new Error('La course devrait faire 38 cases');
    if (ordreInitial.join('|') !== [ines.joueurId, noe.joueurId, lina.joueurId, leo.joueurId].join('|')) {
      throw new Error(`Ordre inattendu : ${ordreInitial.join(', ')}`);
    }
    await jouer(monde, monde.hote, { type: 'nouveauTour' }, 'Tour 1');
    if ((monde.serveur.etat().course?.ordre ?? []).join('|') !== ordreInitial.join('|')) throw new Error('L\'ordre a changé au premier tour');
    const ordreApresTour = await agir(monde.hote, { type: 'retirerOrdre' });
    if (ordreApresTour.ok) throw new Error('L\'ordre ne devrait plus pouvoir être retiré');
    console.log('OK     Ordre figé après le premier tour');

    await annulerPuisRejouer(monde, 'le mini-jeu choisi', async () => {
      await jouer(monde as Monde, (monde as Monde).hote, { type: 'choisirMiniJeu', id: 'pong-gobelets' }, 'Mini-jeu choisi');
    });
    if (monde.serveur.etat().course?.ecranMini !== 'regles') throw new Error('Un mini-jeu physique ouvre les règles');
    if (!monde.serveur.etat().course?.joues.includes('pong-gobelets')) throw new Error('Le mini-jeu devrait être marqué joué');
    await jouer(monde, monde.hote, { type: 'afficherGrille' }, 'Grille affichée');
    if (monde.tv.vue?.course?.grilleVisible !== true) throw new Error('La grille devrait être visible sur la télé');
    await jouer(monde, monde.hote, { type: 'afficherGrille' }, 'Grille masquée');
    if (monde.tv.vue?.course?.grilleVisible !== false) throw new Error('La grille devrait être masquée');
    await jouer(monde, monde.hote, { type: 'demarrerMinuteur', duree: 90, libelle: 'Pong gobelets' }, 'Minuteur démarré');
    await jouer(monde, monde.hote, { type: 'pauseMinuteur' }, 'Minuteur en pause');
    const enPause = monde.serveur.etat().course?.minuteur;
    if (!enPause || enPause.etat !== 'enPause' || enPause.resteMs < 80_000 || enPause.resteMs > 90_000) {
      throw new Error(`Temps restant inattendu après la pause : ${enPause?.resteMs ?? 'absent'}`);
    }
    await jouer(monde, monde.hote, { type: 'reprendreMinuteur' }, 'Minuteur repris');
    if (monde.serveur.etat().course?.minuteur.etat !== 'enCours') throw new Error('Le minuteur devrait avoir repris');
    await jouer(monde, monde.hote, { type: 'arreterMinuteur' }, 'Minuteur arrêté');
    await annulerPuisRejouer(monde, 'la saisie des résultats', async () => {
      await jouer(monde as Monde, (monde as Monde).hote, {
        type: 'validerResultats',
        saisie: {
          mode: 'classement',
          ordre: [
            { joueurId: ines.joueurId, exAequo: false },
            { joueurId: noe.joueurId, exAequo: true },
            { joueurId: lina.joueurId, exAequo: false },
            { joueurId: leo.joueurId, exAequo: false },
          ],
        },
      }, 'Classement avec ex aequo');
    });
    const classement = new Map(
      monde.serveur.etat().transactions
        .filter((transaction) => transaction.source === 'mini-jeu' && transaction.libelle === 'Pong gobelets')
        .map((transaction) => [transaction.joueurId, transaction.montant]),
    );
    if (classement.get(ines.joueurId) !== 10 || classement.get(noe.joueurId) !== 10) {
      throw new Error('Les ex aequo devraient recevoir 10 GP');
    }
    if (classement.get(lina.joueurId) !== 3 || classement.get(leo.joueurId) !== 1) {
      throw new Error('Le barème après l\'égalité est incorrect');
    }
    await jouer(monde, monde.hote, { type: 'passerAuxDeplacements' }, 'Passage aux déplacements');

    await annulerPuisRejouer(monde, 'un lancer suivi de l\'effet de sa case', async () => {
      await jouer(monde as Monde, ines, { type: 'lancerDe', mise: 4 }, 'Lancer d\'Inès sur un bonus');
    });
    if (monde.serveur.etat().course?.positions[ines.joueurId] !== 1) throw new Error('Inès devrait être sur la case bonus');
    if (monde.serveur.etat().course?.cagnotte !== 4) throw new Error('La mise devrait être dans la cagnotte');

    await jouer(monde, noe, { type: 'lancerDe', mise: 0 }, 'Lancer de Noé sur une chance');
    const carte = monde.serveur.etat().course?.carteCourante?.carte;
    if (carte?.effet.type !== 'cadeau') throw new Error(`La carte piochée n'est pas un cadeau (${carte?.id ?? 'aucune'})`);
    console.log('OK     Carte chance cadeau');
    await jouer(monde, noe, { type: 'choisirBeneficiaire', joueurId: ines.joueurId }, 'Noé offre le cadeau');

    await jouer(monde, lina, { type: 'lancerDe', mise: 0 }, 'Lancer de Lina sur un duel');
    await annulerPuisRejouer(monde, 'le choix de l\'adversaire d\'un duel', async () => {
      await jouer(monde as Monde, lina, { type: 'choisirAdversaire', joueurId: leo.joueurId }, 'Lina choisit Léo');
    });
    await jouer(monde, lina, { type: 'miserDuel', montant: 2 }, 'Mise de duel de Lina');
    console.log('OK     Secrets des mises de duel');
    await annulerPuisRejouer(monde, 'une mise de duel', async () => {
      await jouer(monde as Monde, leo, { type: 'miserDuel', montant: 2 }, 'Mise de duel de Léo');
    });
    await annulerPuisRejouer(monde, 'le résultat d\'un duel', async () => {
      await jouer(monde as Monde, (monde as Monde).hote, { type: 'resultatDuel', resultat: 'joueur' }, 'Victoire de Lina');
    });
    await jouer(monde, leo, { type: 'lancerDe', mise: 0 }, 'Lancer de Léo sur la cagnotte');
    if (monde.serveur.etat().course?.phase !== 'finTour') throw new Error('Le tour 1 devrait être fini');
    console.log('OK     Duel en victoire');

    await annulerPuisRejouer(monde, 'un nouveau tour', async () => {
      await jouer(monde as Monde, (monde as Monde).hote, { type: 'nouveauTour' }, 'Tour 2');
    });
    await jouer(monde, monde.hote, { type: 'choisirMiniJeu', id: 'poker' }, 'Poker du tour 2');
    if (monde.serveur.etat().course?.ecranMini !== 'poker') throw new Error('Le poker devrait ouvrir son module');
    await jouer(monde, monde.hote, { type: 'demarrerMinuteur', duree: 600, libelle: 'Blinds' }, 'Minuteur du poker');
    await jouer(monde, monde.hote, { type: 'pauseMinuteur' }, 'Pause du poker');
    await jouer(monde, monde.hote, { type: 'reprendreMinuteur' }, 'Reprise du poker');
    await jouer(monde, monde.hote, { type: 'niveauSuivant' }, 'Niveau de blinds suivant');
    if (monde.serveur.etat().course?.poker.niveau !== 1) throw new Error('Le poker devrait être au niveau 2');
    const joueursPoker = [...monde.serveur.etat().joueurs].sort(
      (a, b) => a.rejointA - b.rejointA || a.pseudo.localeCompare(b.pseudo, 'fr'),
    );
    const parts = repartirTapisHote(
      10,
      joueursPoker.map((joueur) => ({
        id: joueur.id,
        gpVisibles: solde(monde.serveur.etat().transactions, joueur.id, 'visibles'),
      })),
    );
    const tapis: Record<string, number> = {};
    for (const joueur of joueursPoker) tapis[joueur.id] = 5;
    await annulerPuisRejouer(monde, 'la conversion du poker', async () => {
      await jouer(monde as Monde, (monde as Monde).hote, { type: 'validerPoker', tapis, tapisHote: 10 }, 'Conversion des tapis');
    });
    const credits = monde.serveur.etat().transactions.filter((transaction) => transaction.source === 'poker');
    for (const part of parts) {
      const credit = credits.find((transaction) => transaction.joueurId === part.joueurId);
      if (!credit || credit.montant !== part.montant + 5) {
        throw new Error(`Conversion incorrecte pour ${part.joueurId} : ${credit?.montant ?? 'absente'}`);
      }
    }
    const finMinuteur = monde.serveur.etat().course?.minuteur.finA;
    if (!finMinuteur || monde.serveur.etat().course?.minuteur.etat !== 'enCours') {
      throw new Error('Le minuteur du poker devrait encore tourner');
    }
    await jouer(monde, monde.hote, { type: 'passerAuxDeplacements' }, 'Dés du tour 2');

    const courseAvant = monde.serveur.etat().course;
    if (!courseAvant || courseAvant.phase !== 'deplacements') throw new Error('Le redémarrage doit avoir lieu pendant les déplacements');
    const memoire = {
      phase: courseAvant.phase,
      tour: courseAvant.tour,
      cagnotte: courseAvant.cagnotte,
      positions: { ...courseAvant.positions },
      etape: courseAvant.etape?.genre ?? null,
    };
    const dossier = monde.dossier;
    for (const page of pages(monde)) page.socket.close();
    await monde.serveur.fermer();
    monde.serveur = await demarrerServeur({
      port: await portDisponible(),
      dossierData: dossier,
      config: { desForces: DES.slice(4), disposition: DISPOSITION },
    });
    monde.hote = await connecter(monde.serveur.url, 'hote', { codeHote: CODE_HOTE });
    monde.tv = await connecter(monde.serveur.url, 'tv');
    const reconnectes: Participant[] = [];
    for (const ancien of [leo, ines, noe, lina]) {
      const joueur = await connecter(monde.serveur.url, 'joueur', { jeton: ancien.jeton });
      joueur.pseudo = ancien.pseudo;
      joueur.joueurId = ancien.joueurId;
      reconnectes.push(joueur);
    }
    monde.joueurs = reconnectes;
    const course = monde.serveur.etat().course;
    if (!course) throw new Error('La course a disparu au redémarrage');
    if (course.phase !== memoire.phase || course.tour !== memoire.tour || course.cagnotte !== memoire.cagnotte) {
      throw new Error('L\'état repris ne correspond pas à la phase interrompue');
    }
    if ((course.etape?.genre ?? null) !== memoire.etape) throw new Error('L\'étape reprise est différente');
    for (const [id, position] of Object.entries(memoire.positions)) {
      if (course.positions[id] !== position) throw new Error('Une position a changé au redémarrage');
    }
    if (monde.tv.vue?.course?.phase !== 'deplacements') throw new Error('La TV ne retrouve pas les déplacements');
    const minuteurRepris = monde.serveur.etat().course?.minuteur;
    if (!minuteurRepris || minuteurRepris.etat !== 'enCours' || minuteurRepris.finA !== finMinuteur) {
      throw new Error('Le minuteur n\'a pas repris à la même heure de fin');
    }
    const resteApres = finMinuteur - Date.now();
    if (resteApres < 540_000) throw new Error(`Temps restant trop court après redémarrage : ${resteApres}`);
    console.log('OK     Redémarrage en phase de déplacements');

    const [leo2, ines2, noe2, lina2] = monde.joueurs;
    if (!leo2 || !ines2 || !noe2 || !lina2) throw new Error('Joueurs perdus');
    await jouer(monde, ines2, { type: 'lancerDe', mise: 0 }, 'Inès avance, tour 2');
    await jouer(monde, noe2, { type: 'lancerDe', mise: 0 }, 'Noé tombe sur un duel');
    await jouer(monde, noe2, { type: 'choisirAdversaire', joueurId: lina2.joueurId }, 'Noé choisit Lina');
    await jouer(monde, noe2, { type: 'miserDuel', montant: 1 }, 'Mise de duel de Noé');
    await jouer(monde, lina2, { type: 'miserDuel', montant: 1 }, 'Mise de duel de Lina');
    await jouer(monde, monde.hote, { type: 'resultatDuel', resultat: 'egalite' }, 'Égalité du duel');
    console.log('OK     Duel en égalité');
    await jouer(monde, lina2, { type: 'lancerDe', mise: 0 }, 'Lancer de Lina, tour 2');
    await jouer(monde, leo2, { type: 'lancerDe', mise: 0 }, 'Lancer de Léo, tour 2');

    for (const tour of [3, 4, 5, 6, 7]) {
      await jouer(monde, monde.hote, { type: 'nouveauTour' }, `Tour ${tour}`);
      if (tour === 3) {
        await jouer(monde, monde.hote, { type: 'choisirMiniJeu', id: 'mime-express' }, 'Mime express');
        await jouer(monde, monde.hote, {
          type: 'validerResultats',
          saisie: {
            mode: 'equipes',
            equipeA: [ines2.joueurId, noe2.joueurId],
            equipeB: [lina2.joueurId, leo2.joueurId],
            gagnante: 'A',
          },
        }, 'Résultats en équipes');
        const equipe = monde.serveur.etat().transactions.filter((transaction) => transaction.libelle === 'Mime express');
        const montant = (id: string) => equipe.find((transaction) => transaction.joueurId === id)?.montant;
        if (montant(ines2.joueurId) !== 8 || montant(noe2.joueurId) !== 8) throw new Error('Les gagnants devraient recevoir 8 GP');
        if (montant(lina2.joueurId) !== 2 || montant(leo2.joueurId) !== 2) throw new Error('Les perdants devraient recevoir 2 GP');
      } else if (tour === 4) {
        await jouerTopTen(monde);
      } else if (tour === 5) {
        await jouerJeopardy(monde);
      } else if (tour === 6) {
        await jouerUndercover(monde);
      } else {
        await jouer(monde, monde.hote, { type: 'choisirMiniJeu', id: 'pong-gobelets' }, `Mini-jeu du tour ${tour}`);
      }
      await jouer(monde, monde.hote, { type: 'passerAuxDeplacements' }, `Dés du tour ${tour}`);
      await jouer(monde, ines2, { type: 'lancerDe', mise: 0 }, `Lancer d'Inès, tour ${tour}`);
      await jouer(monde, noe2, { type: 'lancerDe', mise: 0 }, `Lancer de Noé, tour ${tour}`);
      await jouer(monde, lina2, { type: 'lancerDe', mise: 0 }, `Lancer de Lina, tour ${tour}`);
      await jouer(monde, leo2, { type: 'lancerDe', mise: 0 }, `Lancer de Léo, tour ${tour}`);
    }

    await jouer(monde, monde.hote, { type: 'nouveauTour' }, 'Tour 8');
    await jouer(monde, monde.hote, { type: 'choisirMiniJeu', id: 'pong-gobelets' }, 'Mini-jeu du tour 8');
    await jouer(monde, monde.hote, { type: 'passerAuxDeplacements' }, 'Dés du tour 8');
    await annulerPuisRejouer(monde, 'une arrivée', async () => {
      await jouer(monde, ines2, { type: 'lancerDe', mise: 0 }, 'Inès arrive');
    });
    const finale = monde.serveur.etat().course;
    if (!finale?.arrivees.includes(ines2.joueurId)) throw new Error('Inès devrait être arrivée');
    if (finale.positions[ines2.joueurId] !== finale.regles.longueur) throw new Error('Inès n\'est pas sur l\'arrivée');
    if (finale.ordre[finale.indexCourant] === ines2.joueurId) throw new Error('Inès relance alors qu\'elle est arrivée');
    await jouer(monde, noe2, { type: 'lancerDe', mise: 0 }, 'Noé joue après l\'arrivée');
    await jouer(monde, lina2, { type: 'lancerDe', mise: 0 }, 'Lancer de Lina, tour 8');
    await jouer(monde, leo2, { type: 'lancerDe', mise: 0 }, 'Lancer de Léo, tour 8');
    const effets = new Set(finale && monde.serveur.etat().course?.historique.effets.map((effet) => effet.type));
    for (const type of ['bonus', 'cagnotte', 'chance']) {
      if (!effets.has(type)) throw new Error(`Aucun effet ${type} dans l'historique`);
    }
    const duels = monde.serveur.etat().course?.historique.duels ?? [];
    if (!duels.some((duel) => duel.resultat === 'joueur') || !duels.some((duel) => duel.resultat === 'egalite')) {
      throw new Error('Il manque une victoire ou une égalité de duel');
    }
    const courseFinale = monde.serveur.etat().course;
    const lancers = courseFinale?.historique.lancers ?? [];
    if (lancers.length === 0) throw new Error('Aucun lancer enregistré');
    for (const lancer of lancers) {
      if (typeof lancer.mise !== 'number' || typeof lancer.esperance !== 'number') {
        throw new Error('Un lancer n\'a pas de mise ou d\'espérance');
      }
      const attendue = esperanceDe(
        probabilitesDe(lancer.usage === 'deplacement' ? lancer.mise : 0, courseFinale?.regles.miseMax ?? 0, courseFinale?.regles.probasMiseMax ?? []),
      );
      if (Math.abs(lancer.esperance - attendue) > 1e-9) throw new Error(`Espérance inattendue pour une mise de ${lancer.mise}`);
    }
    console.log('OK     Chaque lancer a sa mise et son espérance');
    console.log('OK     Bonus, cagnotte, chance, duels et arrivée');
    console.log('OK     Invariants tenus après chaque action');
  } catch (erreur) {
    console.log(`ÉCHEC  ${erreur instanceof Error ? erreur.message : String(erreur)}`);
    process.exitCode = 1;
  } finally {
    if (monde) {
      await fermerSession({
        serveur: monde.serveur,
        dossier: monde.dossier,
        sockets: pages(monde).map((page) => page.socket),
      }).catch(() => undefined);
    }
  }
  if (process.exitCode) return;
  console.log(`Durée  ${((Date.now() - debut) / 1000).toFixed(1)} s`);
}

void main();
