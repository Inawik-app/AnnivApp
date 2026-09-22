import { SCHEMA } from '../shared/constantes';
import type { ConfigPartie, Course, EtatJeu } from '../shared/types';
import { etatInitial } from './etat-initial';

export type DonneesPersistees = {
  etat: EtatJeu;
  jetons: Record<string, string>;
  prochainIdEvenement: number;
};

function estObjet(valeur: unknown): valeur is Record<string, unknown> {
  return !!valeur && typeof valeur === 'object' && !Array.isArray(valeur);
}

function normaliserCourse(valeur: unknown): Course | null {
  if (!estObjet(valeur)) return null;
  if (!Array.isArray(valeur.disposition) || typeof valeur.phase !== 'string' || !estObjet(valeur.regles)) return null;
  if (!estObjet(valeur.positions) || !Array.isArray(valeur.pioche)) return null;
  const course = valeur as Course;
  if (!Array.isArray(course.defausse)) course.defausse = [];
  if (!course.historique) course.historique = { lancers: [], mises: [], effets: [], duels: [] };
  if (!Array.isArray(course.arrivees)) course.arrivees = [];
  return course;
}

export function fusionnerEtat(titre: string, brut: Record<string, unknown>): EtatJeu {
  const defaut = etatInitial(titre);
  if (!estObjet(brut.partie) || !Array.isArray(brut.joueurs) || !Array.isArray(brut.transactions)) {
    throw new Error('forme inattendue');
  }
  const partieBrute = brut.partie;
  const etat: EtatJeu = {
    ...defaut,
    ...brut,
    schema: typeof brut.schema === 'number' ? brut.schema : SCHEMA,
    version: typeof brut.version === 'number' ? brut.version : 0,
    partie: {
      ...defaut.partie,
      ...partieBrute,
      titre: typeof partieBrute.titre === 'string' ? partieBrute.titre : defaut.partie.titre,
      inscriptionsVerrouillees: partieBrute.inscriptionsVerrouillees === true,
      ecranTv:
        partieBrute.ecranTv === 'scores' || partieBrute.ecranTv === 'plateau' ? partieBrute.ecranTv : 'accueil',
      animationsReduites: partieBrute.animationsReduites === true,
      diagnosticTvAffiche: partieBrute.diagnosticTvAffiche === true,
    },
    joueurs: brut.joueurs as EtatJeu['joueurs'],
    transactions: (Array.isArray(brut.transactions) ? brut.transactions : []) as EtatJeu['transactions'],
    evenements: (Array.isArray(brut.evenements) ? brut.evenements : []) as EtatJeu['evenements'],
    demandesReprise: (Array.isArray(brut.demandesReprise) ? brut.demandesReprise : []) as EtatJeu['demandesReprise'],
    course: normaliserCourse(brut.course),
    bots: brut.bots === true,
  };
  for (const cle of Object.keys(brut)) {
    if (!(cle in etat)) {
      (etat as Record<string, unknown>)[cle] = brut[cle];
    }
  }
  return etat;
}

export function lireDonnees(texte: string, titre: string): DonneesPersistees {
  const brut: unknown = JSON.parse(texte);
  if (!estObjet(brut)) throw new Error('JSON invalide');
  const enveloppe = estObjet(brut.etat);
  const etatBrut = enveloppe ? (brut.etat as Record<string, unknown>) : brut;
  const etat = fusionnerEtat(titre, etatBrut);
  const jetons: Record<string, string> = {};
  if (enveloppe && estObjet(brut.jetons)) {
    for (const [joueurId, jeton] of Object.entries(brut.jetons)) {
      if (typeof jeton === 'string') jetons[joueurId] = jeton;
    }
  }
  const ids = etat.evenements.map((evenement) => evenement.id).filter((id) => typeof id === 'number');
  const plusGrand = ids.length > 0 ? Math.max(...ids) + 1 : 1;
  const annonce = enveloppe && typeof brut.prochainIdEvenement === 'number' ? brut.prochainIdEvenement : 1;
  return {
    etat,
    jetons,
    prochainIdEvenement: Math.max(annonce, plusGrand, 1),
  };
}

export function donneesInitiales(titre: string): DonneesPersistees {
  return { etat: etatInitial(titre), jetons: {}, prochainIdEvenement: 1 };
}

export function configValide(brut: unknown): ConfigPartie {
  if (!estObjet(brut)) throw new Error('config/partie.json est illisible');
  if (typeof brut.titre !== 'string' || !brut.titre.trim()) throw new Error('Le titre manque dans config/partie.json');
  if (typeof brut.codeHote !== 'string' || !brut.codeHote) throw new Error('Le code hôte manque dans config/partie.json');
  if (typeof brut.nbJoueursMax !== 'number' || brut.nbJoueursMax < 1) {
    throw new Error('nbJoueursMax est invalide dans config/partie.json');
  }
  if (typeof brut.port !== 'number' || brut.port < 1) throw new Error('Le port est invalide dans config/partie.json');
  if (brut.ipForcee !== null && typeof brut.ipForcee !== 'string') {
    throw new Error('ipForcee doit être une adresse ou null');
  }
  return {
    titre: brut.titre.trim(),
    nbJoueursMax: brut.nbJoueursMax,
    codeHote: brut.codeHote,
    port: brut.port,
    ipForcee: typeof brut.ipForcee === 'string' && brut.ipForcee.trim() ? brut.ipForcee.trim() : null,
  };
}
