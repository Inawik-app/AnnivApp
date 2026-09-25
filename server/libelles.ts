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
    case 'lancerMancheTopTen':
      return 'Manche de Top Ten';
    case 'validerOrdreTopTen':
      return "Ordre du Cap'Ten";
    case 'recapTopTen':
      return 'Récapitulatif du Top Ten';
    case 'choisirChoisisseurJeopardy':
      return 'Choisisseur du Jeopardy';
    case 'choisirCaseJeopardy':
      return 'Case du Jeopardy';
    case 'buzzJeopardy':
      return 'Buzz';
    case 'jugerJeopardy':
      return action.juste ? 'Bonne réponse' : 'Mauvaise réponse';
    case 'personneJeopardy':
      return 'Question sans gagnant';
    case 'terminerJeopardy':
      return 'Fin du Jeopardy';
    case 'lancerMancheUndercover':
      return "Manche d'Undercover";
    case 'eliminerUndercover':
      return 'Élimination';
    case 'devinerUndercover':
      return action.trouve ? 'Mot trouvé' : 'Mot raté';
    case 'recapUndercover':
      return "Récapitulatif de l'Undercover";
    case 'passerAuxDeplacements':
      return 'Déplacements';
    case 'lancerDe':
      return 'Lancer de dé';
    case 'miserRoue':
      return action.montant > 0 ? `Roue : ${action.montant} GP` : 'Roue passée';
    case 'definirPosition':
      return `Position de ${pseudoDe(etat, action.joueurId)}`;
    case 'passerJoueur':
      return 'Tour passé';
    case 'terminerCourse':
      return 'Fin de la course';
    case 'ouvrirPodium':
      return 'Podium de la course';
    case 'tirerTrophees':
      return 'Tirage des trophées';
    case 'revelerTrophee':
      return 'Trophée suivant';
    case 'revelerClassement':
      return 'Classement final';
    case 'revelerGagnant':
      return 'Gagnant';
    case 'basculerBots':
      return 'Bots';
    default:
      return 'Action';
  }
}

export function trouverJoueur(joueurs: Joueur[], joueurId: string): Joueur | undefined {
  return joueurs.find((joueur) => joueur.id === joueurId);
}
