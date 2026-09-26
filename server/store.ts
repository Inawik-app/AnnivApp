import { randomInt } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nanoid } from 'nanoid';
import { INTERVALLE_SAUVEGARDE_MS, LIMITE_ANNULATIONS } from '../shared/constantes';
import type { Action, EtatJeu, Origine, ReponseAction, TypeCase } from '../shared/types';
import { lireCartesChance, lireCartesMalchance, lireCatalogueTrophees, lireConfigPlateau, lireRoue } from './course-config';
import { lireCatalogue, lireCodenames, lireJeopardy, lireJustOne, lireConfigPartie, lirePerudo, lirePoker, lireTopTen, lireUndercover } from './mini-jeux-config';
import { libelleAction } from './libelles';
import { creerPersistance, type Persistance } from './persistance';
import { reduire, type Effet } from './reducteur';

export type Notification =
  | { type: 'repriseValidee'; socketId: string; jeton: string; joueurId: string }
  | { type: 'repriseRefusee'; socketId: string; joueurId: string };

type Instantane = {
  libelle: string;
  etat: EtatJeu;
  jetons: Record<string, string>;
  suivis: Array<[string, string]>;
  /** Files du mode test, pour qu'une annulation rejoue les mêmes tirages. */
  desForces: number[];
  cartesForcees: string[];
  roueForcees: string[];
};

/** Surcharges en mémoire pour la simulation / le balayage (ne touche pas aux fichiers). */
export type SurchargesSimulation = {
  recompenseArrivee?: number[];
  coupDePouce?: 'aucun' | 'de7' | 'de8';
  cagnotteConsolation?: 'aucune' | 'dernier';
  montantTrophees?: number;
  /** Coûts de mise du dé boosté et du super dé (les autres options inchangées). */
  misesDe?: { booste: number; super: number };
};

export type OptionsStore = {
  dossierData: string;
  titre: string;
  sousTitre?: string;
  nbJoueursMax: number;
  dev: boolean;
  maintenant?: () => number;
  nouvelId?: () => string;
  socketVivant?: (socketId: string) => boolean;
  estEnLigne?: (joueurId: string) => boolean;
  notifier?: (notification: Notification) => void;
  sauvegardesAuto?: boolean;
  intervalleSauvegardeMs?: number;
  alea?: (max: number) => number;
  /** Mode test : dés imposés, cartes, roue et disposition explicite. Ignoré hors test. */
  test?: boolean;
  desForces?: number[];
  cartesForcees?: string[];
  roueForcees?: string[];
  disposition?: TypeCase[];
  /** Partie jouée en mémoire : pas de pile d'annulation, pas d'écriture disque. */
  simulation?: boolean;
  /** Leviers d'équilibrage appliqués après lecture des JSON. */
  surcharges?: SurchargesSimulation;
  /**
   * Simulation seulement : réduit les dés Perudo pour accélérer
   * (le classement final reste tiré, les GP de barème inchangés).
   */
  perudoDesSimulation?: number;
  /** Simulation seulement : nombre de cycles Just One (défaut config). */
  justoneCyclesSimulation?: number;
};

export type Store = {
  source: string;
  etat: () => EtatJeu;
  dispatch: (action: Action, origine: Origine, socketId?: string) => ReponseAction;
  joueurIdDuJeton: (jeton: string) => string | null;
  libelleAnnulation: () => string | null;
  flush: () => Promise<void>;
  fermer: () => void;
};

function cloner<T>(valeur: T): T {
  return JSON.parse(JSON.stringify(valeur)) as T;
}

export function creerStore(options: OptionsStore): Store {
  const maintenant = options.maintenant ?? (() => Date.now());
  const nouvelId = options.nouvelId ?? (() => nanoid());
  const socketVivant = options.socketVivant ?? (() => true);
  const estEnLigne = options.estEnLigne ?? (() => false);
  const racine = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const plateau = lireConfigPlateau(racine);
  if (options.test && options.disposition) {
    plateau.longueur = options.disposition.length - 1;
    plateau.disposition = options.disposition;
  }
  const cartes = lireCartesChance(racine);
  const cartesMalchance = lireCartesMalchance(racine);
  const roue = lireRoue(racine);
  const catalogue = lireCatalogue(racine);
  const poker = lirePoker(racine);
  const topten = lireTopTen(racine);
  const jeopardy = lireJeopardy(racine);
  const undercover = lireUndercover(racine);
  const codenames = lireCodenames(racine);
  const perudo = lirePerudo(racine);
  if (options.simulation && typeof options.perudoDesSimulation === 'number' && options.perudoDesSimulation >= 1) {
    perudo.desParJoueur = Math.floor(options.perudoDesSimulation);
  }
  const justone = lireJustOne(racine);
  if (options.simulation && typeof options.justoneCyclesSimulation === 'number' && options.justoneCyclesSimulation >= 1) {
    justone.cycles = Math.floor(options.justoneCyclesSimulation);
  }
  const nomHote = lireConfigPartie(racine).nomHote;
  const trophees = lireCatalogueTrophees(racine);
  const surcharges = options.surcharges;
  if (surcharges?.recompenseArrivee) {
    plateau.recompenseArrivee = [...surcharges.recompenseArrivee];
  }
  if (surcharges?.coupDePouce) plateau.coupDePouce = surcharges.coupDePouce;
  if (surcharges?.cagnotteConsolation) trophees.cagnotteConsolation = surcharges.cagnotteConsolation;
  if (typeof surcharges?.montantTrophees === 'number') {
    for (const trophee of trophees.trophees) trophee.montant = surcharges.montantTrophees;
  }
  if (surcharges?.misesDe) {
    for (const option of plateau.optionsDe) {
      if (option.id === 'booste') option.mise = surcharges.misesDe.booste;
      if (option.id === 'super') option.mise = surcharges.misesDe.super;
    }
  }
  const simulation = options.simulation === true;
  const alea = options.alea ?? ((max: number) => randomInt(0, Math.max(1, max)));
  const desForces = options.test ? [...(options.desForces ?? [])] : [];
  const cartesForcees = options.test ? [...(options.cartesForcees ?? [])] : [];
  const roueForcees = options.test ? [...(options.roueForcees ?? [])] : [];
  const tirerDe = options.test
    ? () => {
        const force = desForces.shift();
        return force;
      }
    : undefined;
  const tirerCarte = options.test ? () => cartesForcees.shift() : undefined;
  const tirerRoue = options.test ? () => roueForcees.shift() : undefined;
  const charge = creerPersistance(options.dossierData, options.titre, {
    sauvegardesAuto: options.sauvegardesAuto ?? true,
    intervalleMs: options.intervalleSauvegardeMs ?? INTERVALLE_SAUVEGARDE_MS,
  });
  const persistance: Persistance = charge.persistance;
  let etat = charge.donnees.etat;
  etat = {
    ...etat,
    partie: {
      ...etat.partie,
      titre: options.titre,
      sousTitre: options.sousTitre ?? etat.partie.sousTitre ?? '',
      presentationId: typeof etat.partie.presentationId === 'number' ? etat.partie.presentationId : 0,
    },
  };
  let jetons: Record<string, string> = { ...charge.donnees.jetons };
  let prochainIdEvenement = charge.donnees.prochainIdEvenement;
  const suivis = new Map<string, string>();
  const pile: Instantane[] = [];

  const persister = () => {
    persistance.ecrire({ etat, jetons, prochainIdEvenement });
  };

  const taillerSuivis = () => {
    for (const demandeId of [...suivis.keys()]) {
      if (!etat.demandesReprise.some((demande) => demande.id === demandeId)) suivis.delete(demandeId);
    }
  };

  const appliquerEffets = (effets: Effet[], socketId: string | undefined): { jeton?: string; joueurId?: string } => {
    let jeton: string | undefined;
    let joueurId: string | undefined;
    for (const effet of effets) {
      if (effet.type === 'creerJeton') {
        const cree = nouvelId();
        jetons[effet.joueurId] = cree;
        jeton = cree;
        joueurId = effet.joueurId;
      } else if (effet.type === 'suivreDemande') {
        if (socketId) suivis.set(effet.demandeId, socketId);
      } else if (effet.type === 'remplacerJeton') {
        const cible = suivis.get(effet.demandeId);
        const cree = nouvelId();
        jetons[effet.joueurId] = cree;
        suivis.delete(effet.demandeId);
        if (cible) {
          options.notifier?.({ type: 'repriseValidee', socketId: cible, jeton: cree, joueurId: effet.joueurId });
        }
      } else if (effet.type === 'signalerRefus') {
        const cible = suivis.get(effet.demandeId);
        suivis.delete(effet.demandeId);
        if (cible) options.notifier?.({ type: 'repriseRefusee', socketId: cible, joueurId: effet.joueurId });
      } else if (effet.type === 'oublierJeton') {
        delete jetons[effet.joueurId];
      } else if (effet.type === 'oublierTousLesJetons') {
        jetons = {};
        suivis.clear();
      }
    }
    taillerSuivis();
    const reponse: { jeton?: string; joueurId?: string } = {};
    if (jeton) reponse.jeton = jeton;
    if (joueurId) reponse.joueurId = joueurId;
    return reponse;
  };

  const restaurerFiles = (instantane: Instantane) => {
    desForces.splice(0, desForces.length, ...instantane.desForces);
    cartesForcees.splice(0, cartesForcees.length, ...instantane.cartesForcees);
    roueForcees.splice(0, roueForcees.length, ...instantane.roueForcees);
  };

  const empiler = (action: Action, files: Pick<Instantane, 'desForces' | 'cartesForcees' | 'roueForcees'>) => {
    pile.push({
      libelle: libelleAction(action, etat),
      etat: cloner(etat),
      jetons: { ...jetons },
      suivis: [...suivis.entries()],
      desForces: files.desForces,
      cartesForcees: files.cartesForcees,
      roueForcees: files.roueForcees,
    });
    if (pile.length > LIMITE_ANNULATIONS) pile.shift();
  };

  return {
    source: persistance.source,
    etat: () => etat,
    libelleAnnulation: () => pile[pile.length - 1]?.libelle ?? null,
    joueurIdDuJeton: (jeton) => {
      for (const [joueurId, valeur] of Object.entries(jetons)) {
        if (valeur === jeton) return joueurId;
      }
      return null;
    },
    flush: () => persistance.flush(),
    fermer: () => persistance.fermer(),
    dispatch: (action, origine, socketId) => {
      if (!action || typeof action !== 'object' || typeof action.type !== 'string') {
        return { ok: false, erreur: 'Action inconnue' };
      }
      if (action.type === 'annuler') {
        if (origine.role !== 'hote') return { ok: false, erreur: "Seul l'hôte peut faire cette action" };
        const instantane = pile.pop();
        if (!instantane) return { ok: false, erreur: 'Rien à annuler' };
        const version = etat.version + 1;
        etat = cloner(instantane.etat);
        etat.version = version;
        jetons = { ...instantane.jetons };
        restaurerFiles(instantane);
        suivis.clear();
        for (const [demandeId, suiviSocket] of instantane.suivis) suivis.set(demandeId, suiviSocket);
        taillerSuivis();
        persister();
        return { ok: true };
      }

      if (action.type === 'demanderReprise') {
        if (!socketId) return { ok: false, erreur: "Ce téléphone n'est plus connecté" };
        if (estEnLigne(action.joueurId)) return { ok: false, erreur: 'Ce joueur est déjà en ligne' };
        const existante = etat.demandesReprise.find((demande) => demande.joueurId === action.joueurId);
        if (existante) {
          const suivi = suivis.get(existante.id);
          if (suivi && suivi !== socketId && socketVivant(suivi)) {
            return { ok: false, erreur: 'Une demande est déjà en cours pour ce joueur' };
          }
          suivis.set(existante.id, socketId);
          return { ok: true };
        }
      }

      if (action.type === 'validerReprise') {
        const demande = etat.demandesReprise.find((candidat) => candidat.id === action.demandeId);
        if (demande) {
          const suivi = suivis.get(demande.id);
          if (!suivi || !socketVivant(suivi)) {
            return { ok: false, erreur: "Ce téléphone n'est plus connecté" };
          }
        }
      }

      const filesAvant: Instantane = {
        libelle: '',
        etat,
        jetons,
        suivis: [],
        desForces: [...desForces],
        cartesForcees: [...cartesForcees],
        roueForcees: [...roueForcees],
      };
      const resultat = reduire(etat, action, origine, {
        maintenant: maintenant(),
        id: nouvelId,
        prochainIdEvenement,
        dev: options.dev,
        nbJoueursMax: options.nbJoueursMax,
        estEnLigne,
        alea,
        tirerDe,
        tirerCarte,
        tirerRoue,
        plateau,
        cartes,
        cartesMalchance,
        roue,
        catalogue,
        poker,
        topten,
        jeopardy,
        undercover,
        codenames,
        perudo,
        justone,
        nomHote,
        trophees: trophees.trophees,
        nombreCeremonie: trophees.nombreCeremonie,
        cagnotteConsolation: trophees.cagnotteConsolation,
        simulation,
      });
      if (!resultat.ok) {
        restaurerFiles(filesAvant);
        return resultat;
      }

      if (!simulation) empiler(action, filesAvant);
      etat = resultat.etat;
      prochainIdEvenement = Math.max(prochainIdEvenement, resultat.prochainIdEvenement);
      const extra = appliquerEffets(resultat.effets, socketId);
      if (!simulation) persister();
      return { ok: true, ...extra };
    },
  };
}
