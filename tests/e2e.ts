import { esperanceDe, probabilitesDe } from '../shared/de';
import { repartirTapisHote } from '../shared/mini-jeux';
import { solde } from '../shared/soldes';
import type { Action, VueClient } from '../shared/types';
import { demarrerServeur, type ServeurJeu } from '../server/demarrer';
import {
  CODE_HOTE,
  DISPOSITION,
  agir,
  attendreVue,
  connecter,
  fermerSession,
  fuitesMises,
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
  console.log(`OK     ${nom}`);
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
