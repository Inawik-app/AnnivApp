import type { Action, EtatJeu, Joueur } from '../shared/types';

function pseudoDe(etat: EtatJeu, joueurId: string): string {
  return etat.joueurs.find((joueur) => joueur.id === joueurId)?.pseudo ?? 'un joueur';
}

export function libelleAction(action: Action, etat: EtatJeu): string {
  switch (action.type) {
    case 'rejoindre':
      return `Inscription de ${action.pseudo.trim() || 'joueur'}`;
    case 'demanderReprise':
      return `Demande de reprise de ${pseudoDe(etat, action.joueurId)}`;
    case 'ajouterGP':
      return `GP de ${pseudoDe(etat, action.joueurId)}`;
    case 'revelerMasquees':
      return 'Révélation des GP masqués';
    case 'renommerJoueur':
      return `Renommage de ${pseudoDe(etat, action.joueurId)}`;
    case 'retirerJoueur':
      return `Retrait de ${pseudoDe(etat, action.joueurId)}`;
    case 'validerReprise':
      return 'Validation de la reprise';
    case 'refuserReprise':
      return 'Refus de la reprise';
    case 'verrouillerInscriptions':
      return 'Inscriptions';
    case 'choisirEcranTv':
      return 'Écran de la télé';
    case 'basculerAnimationsReduites':
      return 'Animations';
    case 'basculerDiagnosticTv':
      return 'Diagnostic télé';
    case 'annuler':
      return 'Annulation';
    case 'reinitialiserPartie':
      return 'Réinitialisation de la partie';
    case 'ajouterJoueursFictifs':
      return 'Joueurs fictifs';
    default:
      return 'Action';
  }
}

export function trouverJoueur(joueurs: Joueur[], joueurId: string): Joueur | undefined {
  return joueurs.find((joueur) => joueur.id === joueurId);
}
