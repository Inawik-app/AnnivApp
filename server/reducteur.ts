import { produce } from 'immer';
import { COULEURS, JOUEURS_FICTIFS, LIMITE_EVENEMENTS } from '../shared/constantes';
import { clePseudo } from '../shared/soldes';
import type { Action, EtatJeu, Evenement, Joueur, Origine, Visibilite } from '../shared/types';
import { appliquerCourse, estActionCourse, oublierJoueurCourse, refuserCourse, type ContexteCourse } from './course';
import { verifierRegleOr } from './regle-or';
import { trouverJoueur } from './libelles';
import {
  controlerAvatar,
  controlerGroupe,
  controlerLibelle,
  controlerMontant,
  controlerPseudo,
  messagePartieComplete,
} from './validation';

export type Effet =
  | { type: 'creerJeton'; joueurId: string }
  | { type: 'suivreDemande'; demandeId: string }
  | { type: 'remplacerJeton'; joueurId: string; demandeId: string }
  | { type: 'signalerRefus'; joueurId: string; demandeId: string }
  | { type: 'oublierJeton'; joueurId: string }
  | { type: 'oublierTousLesJetons' };

export type ContexteReduction = ContexteCourse & {
  prochainIdEvenement: number;
  nbJoueursMax: number;
  estEnLigne: (joueurId: string) => boolean;
};

export type ResultatReduction =
  | { ok: true; etat: EtatJeu; effets: Effet[]; prochainIdEvenement: number }
  | { ok: false; erreur: string };

function sourceAjout(valeur: unknown): string {
  if (typeof valeur !== 'string') return 'manuel';
  const texte = valeur.trim();
  if (!/^[a-z0-9-]{1,32}$/.test(texte)) return 'manuel';
  return texte;
}

const ACTIONS_HOTE = new Set<Action['type']>([
  'ajouterGP',
  'revelerMasquees',
  'renommerJoueur',
  'retirerJoueur',
  'validerReprise',
  'refuserReprise',
  'verrouillerInscriptions',
  'choisirEcranTv',
  'basculerAnimationsReduites',
  'basculerDiagnosticTv',
  'reinitialiserPartie',
  'ajouterJoueursFictifs',
]);

function refuser(etat: EtatJeu, action: Action, origine: Origine, ctx: ContexteReduction): string | null {
  if (action.type === 'annuler') return 'Action inconnue';
  if (estActionCourse(action)) return refuserCourse(etat, action, origine, ctx);
  if (ACTIONS_HOTE.has(action.type)) {
    if (origine.role !== 'hote') return "Seul l'hôte peut faire cette action";
  }
  if (action.type === 'rejoindre' || action.type === 'demanderReprise') {
    if (origine.role !== 'joueur') return "Seul un joueur peut faire cette action";
  }

  switch (action.type) {
    case 'rejoindre': {
      if (etat.partie.inscriptionsVerrouillees) return 'Les inscriptions sont fermées';
      if (etat.joueurs.length >= ctx.nbJoueursMax) return messagePartieComplete(ctx.nbJoueursMax);
      const pseudo = controlerPseudo(action.pseudo, etat.joueurs);
      if (!pseudo.ok) return pseudo.erreur;
      const avatar = controlerAvatar(action.avatar);
      if (!avatar.ok) return avatar.erreur;
      if (etat.joueurs.some((joueur) => joueur.avatar === avatar.avatar)) return 'Ce personnage est déjà pris';
      return null;
    }
    case 'demanderReprise': {
      const joueur = trouverJoueur(etat.joueurs, action.joueurId);
      if (!joueur) return "Ce joueur n'est plus dans la partie";
      if (ctx.estEnLigne(joueur.id)) return 'Ce joueur est déjà en ligne';
      if (etat.demandesReprise.some((demande) => demande.joueurId === joueur.id)) {
        return 'Une demande est déjà en cours pour ce joueur';
      }
      return null;
    }
    case 'ajouterGP': {
      if (!trouverJoueur(etat.joueurs, action.joueurId)) return "Ce joueur n'est plus dans la partie";
      const montant = controlerMontant(action.montant);
      if (!montant.ok) return montant.erreur;
      const libelle = controlerLibelle(action.libelle);
      if (!libelle.ok) return libelle.erreur;
      if (action.masquee !== undefined && typeof action.masquee !== 'boolean') return 'Paramètre invalide';
      const groupe = controlerGroupe(action.groupeRevelation);
      if (!groupe.ok) return groupe.erreur;
      return null;
    }
    case 'revelerMasquees': {
      const groupe = controlerGroupe(action.groupe);
      if (!groupe.ok) return groupe.erreur;
      const cible = etat.transactions.some(
        (transaction) => transaction.masquee && (!groupe.groupe || transaction.groupeRevelation === groupe.groupe),
      );
      if (!cible) return 'Aucun GP masqué à révéler';
      return null;
    }
    case 'renommerJoueur': {
      if (!trouverJoueur(etat.joueurs, action.joueurId)) return "Ce joueur n'est plus dans la partie";
      const pseudo = controlerPseudo(action.pseudo, etat.joueurs, action.joueurId);
      if (!pseudo.ok) return pseudo.erreur;
      return null;
    }
    case 'retirerJoueur':
      if (!trouverJoueur(etat.joueurs, action.joueurId)) return "Ce joueur n'est plus dans la partie";
      return null;
    case 'validerReprise':
    case 'refuserReprise':
      if (!etat.demandesReprise.some((demande) => demande.id === action.demandeId)) {
        return "Cette demande n'existe plus";
      }
      return null;
    case 'choisirEcranTv':
      if (action.ecran !== 'accueil' && action.ecran !== 'scores' && action.ecran !== 'plateau') return 'Écran inconnu';
      return null;
    case 'ajouterJoueursFictifs': {
      if (!ctx.dev) return 'Action indisponible';
      if (etat.joueurs.length >= ctx.nbJoueursMax) return messagePartieComplete(ctx.nbJoueursMax);
      const places = ctx.nbJoueursMax - etat.joueurs.length;
      const disponibles = JOUEURS_FICTIFS.filter(
        (fictif) =>
          !etat.joueurs.some(
            (joueur) => clePseudo(joueur.pseudo) === clePseudo(fictif.pseudo) || joueur.avatar === fictif.avatar,
          ),
      );
      if (disponibles.length === 0 || places <= 0) return messagePartieComplete(ctx.nbJoueursMax);
      return null;
    }
    default:
      return null;
  }
}

function couleurLibre(joueurs: Joueur[]): string {
  const prises = new Set(joueurs.map((joueur) => joueur.couleur));
  return COULEURS.find((couleur) => !prises.has(couleur)) ?? COULEURS[joueurs.length % COULEURS.length]!;
}

export function reduire(etat: EtatJeu, action: Action, origine: Origine, ctx: ContexteReduction): ResultatReduction {
  const erreur = refuser(etat, action, origine, ctx);
  if (erreur) return { ok: false, erreur };

  const effets: Effet[] = [];
  let prochain = ctx.prochainIdEvenement;

  const ajouterEvenement = (
    draft: EtatJeu,
    type: string,
    visibilite: Visibilite,
    libelle: string,
    donnees: Record<string, unknown> = {},
  ) => {
    if (ctx.simulation) {
      prochain += 1;
      return;
    }
    const evenement: Evenement = {
      id: prochain,
      type,
      visibilite,
      libelle,
      donnees,
      horodatage: ctx.maintenant,
    };
    prochain += 1;
    draft.evenements.push(evenement);
    if (draft.evenements.length > LIMITE_EVENEMENTS) {
      draft.evenements.splice(0, draft.evenements.length - LIMITE_EVENEMENTS);
    }
  };

  const etatSuivant = produce(etat, (draft) => {
    draft.version += 1;
    switch (action.type) {
      case 'rejoindre': {
        const pseudo = controlerPseudo(action.pseudo, draft.joueurs);
        const avatar = controlerAvatar(action.avatar);
        if (!pseudo.ok || !avatar.ok) return;
        const joueur: Joueur = {
          id: ctx.id(),
          pseudo: pseudo.pseudo,
          avatar: avatar.avatar,
          couleur: couleurLibre(draft.joueurs),
          rejointA: ctx.maintenant,
        };
        draft.joueurs.push(joueur);
        if (draft.course?.positions) draft.course.positions[joueur.id] = 0;
        effets.push({ type: 'creerJeton', joueurId: joueur.id });
        ajouterEvenement(draft, 'joueur.rejoint', 'public', `${joueur.pseudo} rejoint la partie`, {
          joueurId: joueur.id,
        });
        break;
      }
      case 'demanderReprise': {
        const joueur = trouverJoueur(draft.joueurs, action.joueurId);
        if (!joueur) return;
        const demande = { id: ctx.id(), joueurId: joueur.id, demandeA: ctx.maintenant };
        draft.demandesReprise.push(demande);
        effets.push({ type: 'suivreDemande', demandeId: demande.id });
        ajouterEvenement(draft, 'reprise.demandee', 'hote', `${joueur.pseudo} demande à reprendre sa place`, {
          joueurId: joueur.id,
          demandeId: demande.id,
        });
        break;
      }
      case 'ajouterGP': {
        const joueur = trouverJoueur(draft.joueurs, action.joueurId);
        const montant = controlerMontant(action.montant);
        const libelle = controlerLibelle(action.libelle);
        const groupe = controlerGroupe(action.groupeRevelation);
        if (!joueur || !montant.ok || !libelle.ok || !groupe.ok) return;
        const masquee = action.masquee === true;
        const source = sourceAjout(action.source);
        draft.transactions.push({
          id: ctx.id(),
          joueurId: joueur.id,
          montant: montant.montant,
          source,
          libelle: libelle.libelle,
          horodatage: ctx.maintenant,
          masquee,
          ...(groupe.groupe ? { groupeRevelation: groupe.groupe } : {}),
        });
        const texte =
          masquee
            ? `${montant.montant} GP masqués pour ${joueur.pseudo} (${libelle.libelle})`
            : montant.montant > 0
              ? `${joueur.pseudo} reçoit ${montant.montant} GP (${libelle.libelle})`
              : `${joueur.pseudo} : ${montant.montant} GP (${libelle.libelle})`;
        ajouterEvenement(draft, 'gp.ajoutes', masquee ? 'hote' : 'public', texte, {
          joueurId: joueur.id,
          montant: montant.montant,
          masquee,
        });
        break;
      }
      case 'revelerMasquees': {
        const groupe = controlerGroupe(action.groupe);
        const filtre = groupe.ok ? groupe.groupe : undefined;
        const totaux = new Map<string, number>();
        for (const transaction of draft.transactions) {
          if (!transaction.masquee) continue;
          if (filtre && transaction.groupeRevelation !== filtre) continue;
          transaction.masquee = false;
          totaux.set(transaction.joueurId, (totaux.get(transaction.joueurId) ?? 0) + transaction.montant);
        }
        for (const joueur of draft.joueurs) {
          const total = totaux.get(joueur.id);
          if (total === undefined) continue;
          ajouterEvenement(
            draft,
            'gp.reveles',
            'public',
            `Les GP masqués de ${joueur.pseudo} sont révélés (${total} GP)`,
            { joueurId: joueur.id, montant: total },
          );
        }
        break;
      }
      case 'renommerJoueur': {
        const joueur = trouverJoueur(draft.joueurs, action.joueurId);
        const pseudo = controlerPseudo(action.pseudo, draft.joueurs, action.joueurId);
        if (!joueur || !pseudo.ok) return;
        const ancien = joueur.pseudo;
        joueur.pseudo = pseudo.pseudo;
        ajouterEvenement(draft, 'joueur.renomme', 'public', `${ancien} s'appelle maintenant ${joueur.pseudo}`, {
          joueurId: joueur.id,
          pseudo: joueur.pseudo,
        });
        break;
      }
      case 'retirerJoueur': {
        const joueur = trouverJoueur(draft.joueurs, action.joueurId);
        if (!joueur) return;
        draft.joueurs = draft.joueurs.filter((candidat) => candidat.id !== joueur.id);
        draft.transactions = draft.transactions.filter((transaction) => transaction.joueurId !== joueur.id);
        draft.demandesReprise = draft.demandesReprise.filter((demande) => demande.joueurId !== joueur.id);
        oublierJoueurCourse(draft, joueur.id);
        effets.push({ type: 'oublierJeton', joueurId: joueur.id });
        ajouterEvenement(draft, 'joueur.retire', 'public', `${joueur.pseudo} quitte la partie`, {
          joueurId: joueur.id,
        });
        break;
      }
      case 'validerReprise': {
        const demande = draft.demandesReprise.find((candidat) => candidat.id === action.demandeId);
        const joueur = demande ? trouverJoueur(draft.joueurs, demande.joueurId) : undefined;
        if (!demande || !joueur) return;
        draft.demandesReprise = draft.demandesReprise.filter((candidat) => candidat.id !== demande.id);
        effets.push({ type: 'remplacerJeton', joueurId: joueur.id, demandeId: demande.id });
        ajouterEvenement(draft, 'reprise.validee', 'public', `${joueur.pseudo} a repris sa place`, {
          joueurId: joueur.id,
        });
        break;
      }
      case 'refuserReprise': {
        const demande = draft.demandesReprise.find((candidat) => candidat.id === action.demandeId);
        const joueur = demande ? trouverJoueur(draft.joueurs, demande.joueurId) : undefined;
        if (!demande || !joueur) return;
        draft.demandesReprise = draft.demandesReprise.filter((candidat) => candidat.id !== demande.id);
        effets.push({ type: 'signalerRefus', joueurId: joueur.id, demandeId: demande.id });
        ajouterEvenement(draft, 'reprise.refusee', { joueurId: joueur.id }, `Reprise refusée pour ${joueur.pseudo}`, {
          joueurId: joueur.id,
        });
        ajouterEvenement(draft, 'reprise.refusee', 'hote', `Reprise refusée pour ${joueur.pseudo}`, {
          joueurId: joueur.id,
        });
        break;
      }
      case 'verrouillerInscriptions': {
        draft.partie.inscriptionsVerrouillees = !draft.partie.inscriptionsVerrouillees;
        ajouterEvenement(
          draft,
          'inscriptions',
          'public',
          draft.partie.inscriptionsVerrouillees ? 'Les inscriptions sont fermées' : 'Les inscriptions sont ouvertes',
        );
        break;
      }
      case 'choisirEcranTv': {
        draft.partie.ecranTv = action.ecran;
        const libelle =
          action.ecran === 'scores'
            ? 'La télé affiche les scores'
            : action.ecran === 'plateau'
              ? 'La télé affiche le plateau'
              : "La télé affiche l'accueil";
        ajouterEvenement(draft, 'ecran', 'public', libelle, { ecran: action.ecran });
        break;
      }
      case 'basculerAnimationsReduites': {
        draft.partie.animationsReduites = !draft.partie.animationsReduites;
        ajouterEvenement(
          draft,
          'animations',
          'public',
          draft.partie.animationsReduites ? 'Animations réduites' : 'Animations rétablies',
        );
        break;
      }
      case 'basculerDiagnosticTv': {
        draft.partie.diagnosticTvAffiche = !draft.partie.diagnosticTvAffiche;
        ajouterEvenement(
          draft,
          'diagnostic',
          'hote',
          draft.partie.diagnosticTvAffiche ? 'Diagnostic affiché sur la télé' : 'Diagnostic masqué sur la télé',
        );
        break;
      }
      case 'reinitialiserPartie': {
        const titre = draft.partie.titre;
        draft.joueurs = [];
        draft.transactions = [];
        draft.demandesReprise = [];
        draft.evenements = [];
        draft.partie = {
          titre,
          inscriptionsVerrouillees: false,
          ecranTv: 'accueil',
          animationsReduites: false,
          diagnosticTvAffiche: false,
        };
        draft.course = null;
        draft.bots = false;
        effets.push({ type: 'oublierTousLesJetons' });
        ajouterEvenement(draft, 'partie.reinitialisee', 'public', 'La partie est réinitialisée');
        break;
      }
      case 'ajouterJoueursFictifs': {
        for (const fictif of JOUEURS_FICTIFS) {
          if (draft.joueurs.length >= ctx.nbJoueursMax) break;
          if (draft.joueurs.some((joueur) => clePseudo(joueur.pseudo) === clePseudo(fictif.pseudo) || joueur.avatar === fictif.avatar)) continue;
          const joueur: Joueur = {
            id: ctx.id(),
            pseudo: fictif.pseudo,
            avatar: fictif.avatar,
            couleur: couleurLibre(draft.joueurs),
            rejointA: ctx.maintenant,
          };
          draft.joueurs.push(joueur);
          if (draft.course) draft.course.positions[joueur.id] = 0;
          ajouterEvenement(draft, 'joueur.rejoint', 'public', `${joueur.pseudo} rejoint la partie`, {
            joueurId: joueur.id,
            fictif: true,
          });
        }
        break;
      }
      default:
        if (estActionCourse(action)) appliquerCourse(draft, action, origine, ctx, ajouterEvenement);
        break;
    }
  });

  const violation = verifierRegleOr(etat, etatSuivant, origine);
  if (violation) return { ok: false, erreur: violation };
  return { ok: true, etat: etatSuivant, effets, prochainIdEvenement: prochain };
}
