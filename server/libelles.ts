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
    case 'demarrerCourse':
      return 'Démarrage de la course';
    case 'regenererPlateau':
      return 'Nouveau plateau';
    case 'nouveauTour':
      return 'Nouveau tour';
    case 'retirerOrdre':
      return "Tirage de l'ordre";
    case 'choisirMiniJeu':
      return 'Mini-jeu';
    case 'afficherGrille':
      return 'Grille des mini-jeux';
    case 'remettreMiniJeu':
      return 'Remettre un mini-jeu en jeu';
    case 'demarrerMinuteur':
      return 'Minuteur';
    case 'pauseMinuteur':
      return 'Pause du minuteur';
    case 'reprendreMinuteur':
      return 'Reprise du minuteur';
    case 'ajouter30s':
      return '30 secondes de plus';
    case 'arreterMinuteur':
      return 'Arrêt du minuteur';
    case 'echeanceMinuteur':
      return 'Échéance du minuteur';
    case 'niveauSuivant':
      return 'Niveau de blinds suivant';
    case 'validerResultats':
      return 'Résultats du mini-jeu';
    case 'validerPoker':
      return 'Conversion du poker';
    case 'passerAuxDeplacements':
      return 'Déplacements';
    case 'lancerDe':
      return 'Lancer de dé';
    case 'choisirBeneficiaire':
      return 'Cadeau';
    case 'choisirAdversaire':
      return 'Adversaire du duel';
    case 'miserDuel':
      return 'Mise de duel';
    case 'cloreMisesDuel':
      return 'Clôture du duel';
    case 'autreDefi':
      return 'Nouveau défi';
    case 'resultatDuel':
      return 'Résultat du duel';
    case 'definirPosition':
      return `Position de ${pseudoDe(etat, action.joueurId)}`;
    case 'passerJoueur':
      return 'Tour passé';
    case 'terminerCourse':
      return 'Fin de la course';
    case 'basculerBots':
      return 'Bots';
    default:
      return 'Action';
  }
}

export function trouverJoueur(joueurs: Joueur[], joueurId: string): Joueur | undefined {
  return joueurs.find((joueur) => joueur.id === joueurId);
}
