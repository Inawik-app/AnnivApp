import { solde } from '../shared/soldes';
import type {
  AppareilVue,
  Course,
  CourseVue,
  DiagnosticTv,
  DuelVue,
  EtatJeu,
  Evenement,
  JoueurPublic,
  MiseVue,
  ReseauVue,
  VueHote,
  VueJoueur,
  VueTv,
} from '../shared/types';

export type Presence = {
  enLigne: Record<string, boolean>;
  latenceJoueur: Record<string, number | null>;
  appareils: AppareilVue[];
};

function visibles(evenements: Evenement[], cible: 'tv' | 'joueur' | 'hote', joueurId: string | null, limite: number): Evenement[] {
  const filtres = evenements.filter((evenement) => {
    if (cible === 'hote') return true;
    if (evenement.visibilite === 'public') return true;
    return (
      cible === 'joueur' &&
      !!joueurId &&
      typeof evenement.visibilite === 'object' &&
      evenement.visibilite.joueurId === joueurId
    );
  });
  return filtres.slice(-limite);
}

function miseVue(joueurId: string, montant: number | null, voirMontant: boolean): MiseVue {
  if (voirMontant && montant !== null) return { joueurId, aMise: true, montant };
  return { joueurId, aMise: montant !== null };
}

export function projeterCourse(course: Course | null, cible: 'tv' | 'joueur' | 'hote', joueurId: string | null): CourseVue | null {
  if (!course) return null;
  const misesPubliques = course.phase !== 'preparation' && course.phase !== 'mises';
  const mises = Object.entries(course.mises).map(([id, montant]) =>
    miseVue(id, montant, cible === 'hote' || (misesPubliques && montant !== null) || (id === joueurId && montant !== null)),
  );
  let duel: DuelVue | null = null;
  let etape: CourseVue['etape'] = null;
  if (course.etape?.genre === 'lancer') etape = 'lancer';
  if (course.etape?.genre === 'cadeau') etape = 'cadeau';
  if (course.etape?.genre === 'duel') {
    etape = 'duel';
    const enCours = course.etape.duel;
    duel = {
      joueurId: enCours.joueurId,
      etape: enCours.etape,
      adversaireId: enCours.adversaireId,
      defi: enCours.defi,
      mises: Object.entries(enCours.mises).map(([id, montant]) =>
        miseVue(id, montant, enCours.revelees || cible === 'hote' || id === joueurId),
      ),
    };
  }
  const courant = course.phase === 'deplacements' ? (course.ordre[course.indexCourant] ?? null) : null;
  return {
    active: course.active,
    phase: course.phase,
    disposition: course.disposition,
    longueur: course.regles.longueur,
    positions: { ...course.positions },
    arrivees: [...course.arrivees],
    cagnotte: course.cagnotte,
    tour: course.tour,
    mises,
    ordre: [...course.ordre],
    indexCourant: course.indexCourant,
    joueurCourantId: courant,
    choisitId: course.choisitId,
    miniJeu: course.miniJeu,
    etape,
    carte: course.carteCourante?.carte ?? null,
    duel,
    dernierDe: course.dernierDe,
    classement: course.classement ? [...course.classement] : null,
    gainBonus: course.regles.gainBonus,
    miseMax: course.regles.miseMax,
    miseMaxDuel: course.regles.duel.miseMax,
    bonusDuel: course.regles.duel.bonusVainqueur,
  };
}

function classer(etat: EtatJeu, presence: Presence): JoueurPublic[] {
  const liste = etat.joueurs.map((joueur) => ({
    id: joueur.id,
    pseudo: joueur.pseudo,
    avatar: joueur.avatar,
    couleur: joueur.couleur,
    enLigne: presence.enLigne[joueur.id] === true,
    gpVisibles: solde(etat.transactions, joueur.id, 'visibles'),
    place: 0,
    rejointA: joueur.rejointA,
  }));
  const parScore = [...liste].sort((a, b) => b.gpVisibles - a.gpVisibles || a.pseudo.localeCompare(b.pseudo, 'fr'));
  let place = 1;
  const places = new Map<string, number>();
  for (let index = 0; index < parScore.length; index += 1) {
    const courant = parScore[index]!;
    const precedent = parScore[index - 1];
    if (precedent && courant.gpVisibles < precedent.gpVisibles) place = index + 1;
    places.set(courant.id, place);
  }
  for (const joueur of liste) joueur.place = places.get(joueur.id) ?? liste.length;
  liste.sort((a, b) => a.rejointA - b.rejointA || a.pseudo.localeCompare(b.pseudo, 'fr'));
  return liste;
}

export function vueTv(
  etat: EtatJeu,
  presence: Presence,
  heureServeur: number,
  idDemarrage: string,
  urlJoueur: string,
  placesMax = 4,
  volume = 0.8,
): VueTv {
  return {
    role: 'tv',
    version: etat.version,
    heureServeur,
    idDemarrage,
    partie: {
      titre: etat.partie.titre,
      ecranTv: etat.partie.ecranTv,
      animationsReduites: etat.partie.animationsReduites,
      diagnosticTvAffiche: etat.partie.diagnosticTvAffiche,
    },
    urlJoueur,
    placesMax,
    volume,
    joueurs: classer(etat, presence),
    evenements: visibles(etat.evenements, 'tv', null, 30),
    course: projeterCourse(etat.course, 'tv', null),
  };
}

export function vueJoueur(
  etat: EtatJeu,
  presence: Presence,
  heureServeur: number,
  idDemarrage: string,
  joueurId: string | null,
): VueJoueur {
  const joueurs = classer(etat, presence);
  const moi = joueurId ? joueurs.find((joueur) => joueur.id === joueurId) ?? null : null;
  return {
    role: 'joueur',
    version: etat.version,
    heureServeur,
    idDemarrage,
    partie: {
      titre: etat.partie.titre,
      inscriptionsVerrouillees: etat.partie.inscriptionsVerrouillees,
      animationsReduites: etat.partie.animationsReduites,
    },
    joueurs,
    moi: moi
      ? {
          id: moi.id,
          pseudo: moi.pseudo,
          avatar: moi.avatar,
          couleur: moi.couleur,
          gpVisibles: moi.gpVisibles,
        }
      : null,
    evenements: visibles(etat.evenements, 'joueur', joueurId, 30),
    course: projeterCourse(etat.course, 'joueur', joueurId),
  };
}

export function vueHote(
  etat: EtatJeu,
  presence: Presence,
  heureServeur: number,
  idDemarrage: string,
  dev: boolean,
  reseau: ReseauVue,
  diagnostic: DiagnosticTv | null,
  annulation: string | null,
  volume = 0.8,
): VueHote {
  const joueurs = classer(etat, presence).map((joueur) => ({
    ...joueur,
    gpMasques: solde(etat.transactions, joueur.id, 'masques'),
    latenceMs: presence.latenceJoueur[joueur.id] ?? null,
  }));
  const pseudos = new Map(etat.joueurs.map((joueur) => [joueur.id, joueur.pseudo]));
  return {
    role: 'hote',
    version: etat.version,
    heureServeur,
    idDemarrage,
    dev,
    partie: {
      titre: etat.partie.titre,
      inscriptionsVerrouillees: etat.partie.inscriptionsVerrouillees,
      ecranTv: etat.partie.ecranTv,
      animationsReduites: etat.partie.animationsReduites,
      diagnosticTvAffiche: etat.partie.diagnosticTvAffiche,
    },
    joueurs,
    appareils: presence.appareils,
    evenements: visibles(etat.evenements, 'hote', null, 20),
    demandesReprise: etat.demandesReprise.map((demande) => ({
      id: demande.id,
      joueurId: demande.joueurId,
      pseudo: pseudos.get(demande.joueurId) ?? 'Joueur',
      demandeA: demande.demandeA,
    })),
    transactionsMasquees: etat.transactions
      .filter((transaction) => transaction.masquee)
      .map((transaction) => ({
        id: transaction.id,
        joueurId: transaction.joueurId,
        pseudo: pseudos.get(transaction.joueurId) ?? 'Joueur',
        montant: transaction.montant,
        libelle: transaction.libelle,
        ...(transaction.groupeRevelation ? { groupeRevelation: transaction.groupeRevelation } : {}),
      })),
    annulation,
    nbMasquees: etat.transactions.filter((transaction) => transaction.masquee).length,
    reseau,
    diagnostic,
    volume,
    course: projeterCourse(etat.course, 'hote', null),
    bots: etat.bots === true,
  };
}
