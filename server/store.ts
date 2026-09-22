import { nanoid } from 'nanoid';
import { INTERVALLE_SAUVEGARDE_MS, LIMITE_ANNULATIONS } from '../shared/constantes';
import type { Action, EtatJeu, Origine, ReponseAction } from '../shared/types';
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
};

export type OptionsStore = {
  dossierData: string;
  titre: string;
  nbJoueursMax: number;
  dev: boolean;
  maintenant?: () => number;
  nouvelId?: () => string;
  socketVivant?: (socketId: string) => boolean;
  estEnLigne?: (joueurId: string) => boolean;
  notifier?: (notification: Notification) => void;
  sauvegardesAuto?: boolean;
  intervalleSauvegardeMs?: number;
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
  const charge = creerPersistance(options.dossierData, options.titre, {
    sauvegardesAuto: options.sauvegardesAuto ?? true,
    intervalleMs: options.intervalleSauvegardeMs ?? INTERVALLE_SAUVEGARDE_MS,
  });
  const persistance: Persistance = charge.persistance;
  let etat = charge.donnees.etat;
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

  const empiler = (action: Action) => {
    pile.push({
      libelle: libelleAction(action, etat),
      etat: cloner(etat),
      jetons: { ...jetons },
      suivis: [...suivis.entries()],
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

      const resultat = reduire(etat, action, origine, {
        maintenant: maintenant(),
        id: nouvelId,
        prochainIdEvenement,
        dev: options.dev,
        nbJoueursMax: options.nbJoueursMax,
        estEnLigne,
      });
      if (!resultat.ok) return resultat;

      empiler(action);
      etat = resultat.etat;
      prochainIdEvenement = Math.max(prochainIdEvenement, resultat.prochainIdEvenement);
      const extra = appliquerEffets(resultat.effets, socketId);
      persister();
      return { ok: true, ...extra };
    },
  };
}
