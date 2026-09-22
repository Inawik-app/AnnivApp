import { solde } from '../shared/soldes';
import type {
  AppareilVue,
  DiagnosticTv,
  EtatJeu,
  Evenement,
  JoueurPublic,
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

function classer(etat: EtatJeu, presence: Presence): JoueurPublic[] {
  const liste = etat.joueurs.map((joueur) => ({
    id: joueur.id,
    pseudo: joueur.pseudo,
    avatar: joueur.avatar,
    couleur: joueur.couleur,
    enLigne: presence.enLigne[joueur.id] === true,
    gpVisibles: solde(etat.transactions, joueur.id, 'visibles'),
    place: 0,
  }));
  liste.sort((a, b) => b.gpVisibles - a.gpVisibles || a.pseudo.localeCompare(b.pseudo, 'fr'));
  let place = 1;
  for (let index = 0; index < liste.length; index += 1) {
    const courant = liste[index]!;
    const precedent = liste[index - 1];
    if (precedent && courant.gpVisibles < precedent.gpVisibles) place = index + 1;
    courant.place = place;
  }
  return liste;
}

export function vueTv(
  etat: EtatJeu,
  presence: Presence,
  heureServeur: number,
  idDemarrage: string,
  urlJoueur: string,
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
    joueurs: classer(etat, presence),
    evenements: visibles(etat.evenements, 'tv', null, 30),
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
  };
}
