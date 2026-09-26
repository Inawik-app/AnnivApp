import type { CatalogueMiniJeux, ConfigPoker } from './mini-jeux';
import type { Devines, ScoreTopTen, ThemeTopTen } from './topten';
import type { CouleurBuzzer, QuestionEnCours } from './jeopardy';
import type { CouleurCarte, EquipeCodenames, NombreIndice } from './codenames';
import type { PaireUndercover, RoleUndercover } from './undercover';

export type Joueur = {
  id: string;
  pseudo: string;
  avatar: string;
  couleur: string;
  rejointA: number;
};

export type SourceTransaction = 'manuel' | 'correction' | (string & {});

export type Transaction = {
  id: string;
  joueurId: string;
  montant: number;
  source: SourceTransaction;
  libelle: string;
  horodatage: number;
  masquee: boolean;
  groupeRevelation?: string;
};

export type Visibilite = 'public' | 'hote' | { joueurId: string };

export type Evenement = {
  id: number;
  type: string;
  visibilite: Visibilite;
  libelle: string;
  donnees: Record<string, unknown>;
  horodatage: number;
};

export type EcranTv = 'accueil' | 'scores' | 'plateau' | 'presentation';

export type TypeCase = 'depart' | 'bonus' | 'chance' | 'malchance' | 'cagnotte' | 'gamble' | 'arrivee';

export type PhaseCourse =
  | 'preparation'
  | 'choixMiniJeu'
  | 'miniJeu'
  | 'deplacements'
  | 'finTour'
  | 'terminee';

export type EffetCarte =
  | { type: 'gain'; montant: number }
  | { type: 'gainDe' }
  | { type: 'avancer'; cases: number }
  | { type: 'reculer'; cases: number }
  | { type: 'cotisation'; montant: number }
  | { type: 'cagnotte'; sens: 'avant' | 'arriere'; part: number }
  | { type: 'perte'; montant: number }
  | { type: 'tournee'; montant: number }
  | { type: 'neutre' };

export type FamilleCarte = 'chance' | 'malchance';

export type CarteChance = {
  id: string;
  titre: string;
  texte: string;
  icone: string;
  famille: FamilleCarte;
  poids: number;
  effet: EffetCarte;
};

export type OptionDe = {
  id: string;
  nom: string;
  faces: number;
  mise: number;
  icone: string;
};

export type UsageDe = 'deplacement' | 'chance';

export type LancerDe = {
  tour: number;
  joueurId: string;
  valeur: number;
  usage: UsageDe;
  /** Nombre de faces du dé lancé. 6 pour le dé d'une carte. */
  faces: number;
  /** Mise associée. 0 pour le dé gratuit ou le dé d'une carte. */
  mise: number;
  /** Espérance du dé : (faces + 1) / 2. */
  esperance: number;
  /** Identifiant de l'option, absent pour le dé d'une carte. */
  option: string | null;
};

export type ReglesCourse = {
  longueur: number;
  gainBonus: number;
  /** `rotation` : le choix tourne dans l'ordre de passage. `dernierAuClassement` : le moins de GP visibles choisit. */
  choixMiniJeu: 'rotation' | 'dernierAuClassement';
  optionsDe: OptionDe[];
  /** GP crédités à l'ouverture du podium, dans l'ordre du classement d'arrivée. */
  recompenseArrivee: number[];
  /** Dé gratuit (7 ou 8 faces) pour le joueur le plus pauvre encore en course. */
  coupDePouce: 'aucun' | 'de7' | 'de8';
};

export type EtapeDeplacement = { genre: 'lancer' } | { genre: 'roue' };

export type ContrepartiePlateau = {
  /** Montant reçu (positif) ou payé (négatif) par un autre joueur. */
  joueurs: Array<{ id: string; montant: number }>;
  /** Variation de la cagnotte : positif si elle grossit. */
  cagnotte: number;
};

export type EffetPlateau = {
  tour: number;
  joueurId: string;
  type: string;
  /** Cases avancées (positif) ou reculées (négatif). */
  cases: number;
  gpGagnes: number;
  gpPerdus: number;
  gpDonnes: number;
  gpRecus: number;
  contrepartie: ContrepartiePlateau;
  miseDe?: { option: string; faces: number; mise: number; valeur: number; esperance: number };
  roue?: { option: string; mise: number; rendu: number };
};

export type InstantaneTour = {
  tour: number;
  /** Cases restantes entre le joueur le plus avancé et l'arrivée. */
  distanceLeader: number;
  joueurs: Array<{ id: string; position: number; rang: number; gpVisibles: number }>;
};

export type HistoriqueCourse = {
  lancers: LancerDe[];
  effets: EffetPlateau[];
  instantanes: InstantaneTour[];
};

export type SaisieMiniJeu = 'classement' | 'equipes' | 'libre';

export type MiniJeu = {
  id: string;
  nom: string;
  resume: string;
  icone: string;
  regles: string[];
  materiel?: string;
  /** Secondes. Présent seulement pour un mini-jeu chronométré. */
  duree?: number;
  saisie: SaisieMiniJeu;
  /** Remplace le barème classement par défaut. */
  bareme?: number[];
  /** `aucun` pour un jeu physique, sinon le nom du module à l'écran. */
  module: string;
  /** L'hôte joue comme un participant (sans jamais gagner de GP). */
  hoteParticipe: boolean;
};

export type EtatMinuteur = 'arrete' | 'enCours' | 'enPause';

export type Minuteur = {
  etat: EtatMinuteur;
  /** Heure serveur de la fin, quand le minuteur tourne. */
  finA: number | null;
  resteMs: number;
  libelle: string;
};

export type PokerCourse = {
  actif: boolean;
  /** Index du niveau de blinds en cours, à partir de 0. */
  niveau: number;
};

export type MancheTopTen = {
  numero: number;
  captenId: string;
  indexTheme: number;
  theme: ThemeTopTen;
  /** Les autres joueurs dans l'ordre de passage, puis l'hôte (`REPONDANT_HOTE`). */
  repondants: string[];
  /** Numéro secret de chaque répondant, tiré sur le serveur. */
  numeros: Record<string, number>;
  etape: 'reponses' | 'revelee';
  proposition: { ordre: string[]; devines: Devines } | null;
  score: ScoreTopTen | null;
};

export type TopTenCourse = {
  /** Cap'Ten dans l'ordre de passage : une manche par joueur. */
  captens: string[];
  manches: MancheTopTen[];
  /** Index des thèmes déjà joués dans la soirée. */
  themesJoues: number[];
  recap: boolean;
};

export type CaseJoueeJeopardy = { theme: number; niveau: number; choisisseurId: string; gagnantId: string | null };

export type JeopardyCourse = {
  /** Choisisseur de la prochaine case (présélectionné, modifiable par l'hôte). */
  choisisseurId: string | null;
  jouees: CaseJoueeJeopardy[];
  question: QuestionEnCours | null;
  gains: Record<string, number>;
  termine: boolean;
};

export type MancheUndercover = {
  numero: number;
  indexPaire: number;
  paire: PaireUndercover;
  undercoverId: string;
  ordreParole: string[];
  /** Éliminés, dans l'ordre. */
  elimines: string[];
  etape: 'indices' | 'devine' | 'finie';
  issue: 'civils' | 'undercover' | null;
  devine: boolean | null;
  gains: Record<string, number>;
};

export type UndercoverCourse = {
  nbManches: number;
  manches: MancheUndercover[];
  /** Index des paires déjà jouées dans la soirée. */
  pairesJouees: number[];
  recap: boolean;
};

export type CarteCodenames = {
  mot: string;
  couleur: CouleurCarte;
  revelee: boolean;
};

export type IndiceCodenames = {
  mot: string;
  nombre: NombreIndice;
};

export type PreparationCodenames = {
  equipes: { rouge: string[]; bleu: string[] };
  espions: { rouge: string | null; bleu: string | null };
};

export type MancheCodenames = {
  numero: number;
  cartes: CarteCodenames[];
  equipeDebut: EquipeCodenames;
  equipes: { rouge: string[]; bleu: string[] };
  espions: { rouge: string; bleu: string };
  etape: 'indice' | 'choix' | 'finie';
  equipeCourante: EquipeCodenames;
  indicePropose: IndiceCodenames | null;
  indice: IndiceCodenames | null;
  essaisRestants: number | null;
  /** Cartes retournées depuis l'indice en cours. */
  cartesTour: number;
  dernierRevele: number | null;
  gagnant: EquipeCodenames | null;
  gains: Record<string, number>;
};

export type CodenamesCourse = {
  nbManches: number;
  /** Mots déjà sortis dans la soirée, pour ne pas les rejouer. */
  motsJoues: string[];
  preparation: PreparationCodenames;
  manches: MancheCodenames[];
};

export type JoueurPerudo = {
  id: string;
  desRestants: number;
  faces: number[];
  aLance: boolean;
};

export type AnnoncePerudoEtat = {
  joueurId: string;
  nombre: number;
  valeur: number;
};

export type RevelationPerudo = {
  faces: Record<string, number[]>;
  annonce: AnnoncePerudoEtat;
  compte: number;
  genre: 'dudo' | 'calza';
  concerneId: string;
  delta: -1 | 0 | 1;
  libelle: string;
};

export type PerudoCourse = {
  desParJoueur: number;
  calzaAutorise: boolean;
  numeroManche: number;
  joueurs: JoueurPerudo[];
  indexCourant: number;
  etape: 'lancers' | 'encheres' | 'revelation' | 'terminee';
  annonce: AnnoncePerudoEtat | null;
  historique: AnnoncePerudoEtat[];
  revelation: RevelationPerudo | null;
  /** Premier sorti en tête. */
  elimines: string[];
  premierId: string;
  gains: Record<string, number>;
};

export type IndiceJustOne = {
  auteurId: string;
  mot: string;
  annule: boolean;
};

export type MancheJustOne = {
  numero: number;
  devineurId: string;
  /** Mot secret : toujours dans l'état serveur. */
  mot: string;
  etape: 'indices' | 'verification' | 'revelation' | 'reponse' | 'finie';
  indices: IndiceJustOne[];
  propositionAnnulation: { auteurId: string; indexA: number; indexB: number } | null;
  issue: 'trouve' | 'rate' | 'passe' | null;
  gains: Record<string, number>;
};

export type JustOneCourse = {
  cycles: number;
  hoteDevine: boolean;
  dureeIndices: number;
  gainDevineur: number;
  gainIndice: number;
  /** Rotation : joueurs × cycles, puis hôte × cycles si hoteDevine. */
  ordreDevineurs: string[];
  indexDevineur: number;
  manches: MancheJustOne[];
  recap: boolean;
  gains: Record<string, number>;
};

export type Course = {
  active: boolean;
  disposition: TypeCase[];
  positions: Record<string, number>;
  arrivees: string[];
  cagnotte: number;
  pioches: Record<FamilleCarte, string[]>;
  defausses: Record<FamilleCarte, string[]>;
  tour: number;
  phase: PhaseCourse;
  /** Ordre de passage, tiré une fois au démarrage de la course. */
  ordre: string[];
  indexCourant: number;
  etape: EtapeDeplacement | null;
  miniJeu: string | null;
  miniJeuId: string | null;
  /** Identifiants des mini-jeux déjà choisis pendant cette course. */
  joues: string[];
  grilleVisible: boolean;
  /** `regles`, `poker`, ou un module branché plus tard. */
  ecranMini: string | null;
  resultatsSaisis: boolean;
  minuteur: Minuteur;
  poker: PokerCourse;
  topten?: TopTenCourse | null;
  jeopardy?: JeopardyCourse | null;
  undercover?: UndercoverCourse | null;
  codenames?: CodenamesCourse | null;
  perudo?: PerudoCourse | null;
  justone?: JustOneCourse | null;
  /** Registre commun des mots déjà tirés (Codenames + Just One). */
  motsSoiree: string[];
  choisitId: string | null;
  carteCourante: { joueurId: string; carte: CarteChance } | null;
  dernierDe: { joueurId: string; valeur: number; faces: number; usage: UsageDe; option: string | null } | null;
  classement: string[] | null;
  /** Vrai dès la première arrivée : le tour en cours va au bout, puis la course s'arrête. */
  dernierTour: boolean;
  ceremonie: Ceremonie | null;
  /** Vrai quand le lanceur courant a droit au dé gratuit du coup de pouce. */
  coupDePouceActif?: boolean;
  regles: ReglesCourse;
  historique: HistoriqueCourse;
};

export type TropheeTire = {
  id: string;
  nom: string;
  description: string;
  icone: string;
  montant: number;
  gagnants: string[];
  phrase: string;
};

export type Ceremonie = {
  masqueesIgnorees: boolean;
  etape: 'podium' | 'cagnotte' | 'trophees' | 'classement' | 'gagnant';
  tirage: TropheeTire[];
  reveles: number;
  classementRevele: boolean;
  gagnantRevele: boolean;
  /** Cagnotte de consolation en attente de versement. */
  cagnotteEnAttente?: { joueurId: string; montant: number } | null;
};

export type ConfigPlateau = {
  longueur: number;
  repartition: { bonus: number; chance: number; malchance: number; cagnotte: number; gamble: number };
  gainBonus: number;
  choixMiniJeu: 'rotation' | 'dernierAuClassement';
  optionsDe: OptionDe[];
  iconesCases: Record<TypeCase, string>;
  disposition?: TypeCase[];
  recompenseArrivee: number[];
  coupDePouce: 'aucun' | 'de7' | 'de8';
};

export type Partie = {
  titre: string;
  sousTitre: string;
  inscriptionsVerrouillees: boolean;
  ecranTv: EcranTv;
  /** Incrémenté à chaque lancement de la présentation (rejouable). */
  presentationId: number;
  animationsReduites: boolean;
  diagnosticTvAffiche: boolean;
};

export type DemandeReprise = {
  id: string;
  joueurId: string;
  demandeA: number;
};

export type EtatJeu = {
  schema: number;
  version: number;
  partie: Partie;
  joueurs: Joueur[];
  transactions: Transaction[];
  evenements: Evenement[];
  demandesReprise: DemandeReprise[];
  course: Course | null;
  bots: boolean;
};

export type Action =
  | { type: 'rejoindre'; pseudo: string; avatar: string }
  | { type: 'demanderReprise'; joueurId: string }
  | {
      type: 'ajouterGP';
      joueurId: string;
      montant: number;
      libelle: string;
      masquee?: boolean;
      groupeRevelation?: string;
      /** Défaut `manuel`. `ping-pong` alimente les statistiques. */
      source?: string;
    }
  | { type: 'revelerMasquees'; groupe?: string }
  | { type: 'renommerJoueur'; joueurId: string; pseudo: string }
  | { type: 'retirerJoueur'; joueurId: string }
  | { type: 'validerReprise'; demandeId: string }
  | { type: 'refuserReprise'; demandeId: string }
  | { type: 'verrouillerInscriptions' }
  | { type: 'choisirEcranTv'; ecran: EcranTv }
  | { type: 'basculerAnimationsReduites' }
  | { type: 'basculerDiagnosticTv' }
  | { type: 'annuler' }
  | { type: 'reinitialiserPartie' }
  | { type: 'ajouterJoueursFictifs' }
  | { type: 'demarrerCourse' }
  | { type: 'regenererPlateau' }
  | { type: 'nouveauTour' }
  | { type: 'retirerOrdre' }
  | { type: 'choisirMiniJeu'; id: string }
  | { type: 'afficherGrille' }
  | { type: 'remettreMiniJeu'; id: string }
  | { type: 'demarrerMinuteur'; duree: number; libelle: string }
  | { type: 'pauseMinuteur' }
  | { type: 'reprendreMinuteur' }
  | { type: 'ajouter30s' }
  | { type: 'arreterMinuteur' }
  | { type: 'echeanceMinuteur' }
  | { type: 'niveauSuivant' }
  | {
      type: 'validerResultats';
      saisie:
        | { mode: 'classement'; ordre: Array<{ joueurId: string; exAequo: boolean }> }
        | { mode: 'equipes'; equipeA: string[]; equipeB: string[]; gagnante: 'A' | 'B' }
        | { mode: 'libre'; montants: Record<string, number> };
    }
  | { type: 'validerPoker'; tapis: Record<string, number>; tapisHote: number }
  | { type: 'lancerMancheTopTen' }
  | { type: 'validerOrdreTopTen'; ordre: string[]; devines: Devines }
  | { type: 'recapTopTen' }
  | { type: 'choisirChoisisseurJeopardy'; joueurId: string }
  | { type: 'choisirCaseJeopardy'; theme: number; niveau: number }
  | { type: 'buzzJeopardy' }
  | { type: 'jugerJeopardy'; juste: boolean }
  | { type: 'personneJeopardy' }
  | { type: 'terminerJeopardy' }
  | { type: 'lancerMancheUndercover' }
  | { type: 'eliminerUndercover'; joueurId: string }
  | { type: 'devinerUndercover'; trouve: boolean }
  | { type: 'recapUndercover' }
  | { type: 'affecterCodenames'; joueurId: string; equipe: EquipeCodenames | null }
  | { type: 'equipesHasardCodenames' }
  | { type: 'designerEspionCodenames'; equipe: EquipeCodenames; joueurId: string }
  | { type: 'lancerGrilleCodenames' }
  | { type: 'proposerIndiceCodenames'; mot: string; nombre: NombreIndice }
  | { type: 'validerIndiceCodenames' }
  | { type: 'refuserIndiceCodenames' }
  | { type: 'retournerMotCodenames'; index: number }
  | { type: 'finirTourCodenames' }
  | { type: 'lancerDesPerudo'; joueurId?: string }
  | { type: 'annoncerPerudo'; nombre: number; valeur: number }
  | { type: 'dudoPerudo' }
  | { type: 'calzaPerudo' }
  | { type: 'mancheSuivantePerudo' }
  | { type: 'lancerMancheJustOne' }
  | { type: 'proposerIndiceJustOne'; mot: string; joueurId?: string }
  | { type: 'proposerAnnulationJustOne'; indexA: number; indexB: number }
  | { type: 'validerAnnulationJustOne'; accepter: boolean }
  | { type: 'revelerIndicesJustOne' }
  | { type: 'jugerJustOne'; issue: 'trouve' | 'rate' | 'passe' }
  | { type: 'recapJustOne' }
  | { type: 'passerAuxDeplacements' }
  | { type: 'lancerDe'; option: string }
  | { type: 'miserRoue'; montant: number }
  | { type: 'definirPosition'; joueurId: string; position: number }
  | { type: 'passerJoueur' }
  | { type: 'terminerCourse' }
  | { type: 'ouvrirPodium'; forcer?: boolean }
  | { type: 'verserCagnotteConsolation' }
  | { type: 'tirerTrophees' }
  | { type: 'revelerTrophee' }
  | { type: 'revelerClassement' }
  | { type: 'revelerGagnant' }
  | { type: 'basculerBots' };

export type Origine =
  | { role: 'hote' }
  | { role: 'joueur'; joueurId: string | null }
  | { role: 'tv' };

export type ReponseAction =
  | { ok: true; jeton?: string; joueurId?: string }
  | { ok: false; erreur: string };

export type Bonjour = {
  role: 'tv' | 'joueur' | 'hote';
  jeton?: string;
  codeHote?: string;
};

export type ReponseBonjour =
  | { ok: true; idDemarrage: string }
  | { ok: false; erreur: string };

export type JoueurPublic = {
  id: string;
  pseudo: string;
  avatar: string;
  couleur: string;
  enLigne: boolean;
  gpVisibles: number;
  place: number;
  rejointA: number;
};

export type EvenementVue = Evenement;

export type MancheTopTenVue = {
  numero: number;
  captenId: string;
  theme: ThemeTopTen;
  repondants: string[];
  etape: 'reponses' | 'revelee';
  /** Le numéro du répondant qui regarde (joueur ou hôte), sinon null. */
  monNumero: number | null;
  /** Tous les numéros : après révélation, ou hôte hors participation ; sinon null. */
  numeros: Record<string, number> | null;
  proposition: { ordre: string[]; devines: Devines } | null;
  score: ScoreTopTen | null;
};

export type TopTenVue = {
  nomHote: string;
  pointsParPaire: number;
  bonusOrdreParfait: number;
  bonusChiffresExacts: number[];
  captens: string[];
  courante: MancheTopTenVue | null;
  bilan: Array<{ numero: number; captenId: string; theme: string; total: number }>;
  recap: boolean;
};

export type QuestionJeopardyVue = QuestionEnCours & {
  valeur: number;
  texte: string;
  /** Hôte seulement ; null si l'hôte connaît la réponse sans qu'elle soit écrite. */
  reponse?: string | null;
  accepte?: string[];
};

export type JeopardyVue = {
  valeurs: number[];
  themes: string[];
  jouees: CaseJoueeJeopardy[];
  choisisseurId: string | null;
  question: QuestionJeopardyVue | null;
  /** Couleur du buzzer du joueur qui regarde, null ailleurs. */
  monBuzzer: CouleurBuzzer | null;
  gains: Record<string, number>;
  penalite: number;
  termine: boolean;
};

export type MancheUndercoverVue = {
  numero: number;
  ordreParole: string[];
  elimines: Array<{ id: string; role: RoleUndercover }>;
  tour: number;
  etape: 'indices' | 'devine' | 'finie';
  issue: 'civils' | 'undercover' | null;
  devine: boolean | null;
  /** Le mot du joueur qui regarde. */
  monMot: string | null;
  jeSuisElimine: boolean;
  /** Hôte toujours, les autres une fois l'undercover éliminé ou la manche finie. */
  undercoverId: string | null;
  /** Hôte toujours, les autres à la fin de la manche. */
  paire: PaireUndercover | null;
  gains: Record<string, number>;
};

export type UndercoverVue = {
  nbManches: number;
  gainCivils: number;
  gainUndercoverDevine: number;
  gainUndercoverSurvit: number;
  courante: MancheUndercoverVue | null;
  bilan: Array<{ numero: number; issue: 'civils' | 'undercover' | null; gains: Record<string, number> }>;
  recap: boolean;
};

export type CarteCodenamesVue = {
  index: number;
  mot: string;
  couleur: CouleurCarte | null;
  revelee: boolean;
};

export type MancheCodenamesVue = {
  numero: number;
  cartes: CarteCodenamesVue[];
  equipeDebut: EquipeCodenames;
  equipes: { rouge: string[]; bleu: string[] };
  espions: { rouge: string; bleu: string };
  etape: 'indice' | 'choix' | 'finie';
  equipeCourante: EquipeCodenames;
  acteurId: string;
  indicePropose: IndiceCodenames | null;
  indice: IndiceCodenames | null;
  essaisRestants: number | null;
  restants: { rouge: number; bleu: number };
  dernierRevele: number | null;
  gagnant: EquipeCodenames | null;
  gains: Record<string, number>;
  monRole: 'espion' | 'agent' | null;
  monEquipe: EquipeCodenames | null;
};

export type CodenamesVue = {
  nbManches: number;
  dureeIndice: number;
  gainGagnant: number;
  gainPerdant: number;
  preparation: PreparationCodenames;
  courante: MancheCodenamesVue | null;
};

export type JoueurPerudoVue = {
  id: string;
  desRestants: number;
  faces: number[] | null;
  aLance: boolean;
  elimine: boolean;
};

export type PerudoVue = {
  desParJoueur: number;
  calza: boolean;
  numeroManche: number;
  etape: PerudoCourse['etape'];
  joueurs: JoueurPerudoVue[];
  courantId: string | null;
  annonce: AnnoncePerudoEtat | null;
  historique: AnnoncePerudoEtat[];
  revelation: RevelationPerudo | null;
  elimines: string[];
  totalDes: number;
  gains: Record<string, number>;
  premierId: string;
  /** Vrai tant que la première manche n'a pas commencé : la télé montre les règles. */
  regles: boolean;
};

export type IndiceJustOneVue = {
  auteurId: string;
  /** Texte : visible selon le rôle ; null si annulé sur la télé, ou secret non encore révélé. */
  mot: string | null;
  annule: boolean;
};

export type MancheJustOneVue = {
  numero: number;
  devineurId: string;
  etape: 'indices' | 'verification' | 'revelation' | 'reponse' | 'finie';
  /** Mot secret : indiceurs pendant indices/vérif ; tout le monde à la fin. */
  mot: string | null;
  indices: IndiceJustOneVue[];
  propositionAnnulation: { auteurId: string; indexA: number; indexB: number } | null;
  issue: 'trouve' | 'rate' | 'passe' | null;
  gains: Record<string, number>;
  /** Indice déjà proposé par le regardant. */
  monIndice: string | null;
  /** Vrai si le regardant est le devineur. */
  jeSuisDevineur: boolean;
  /** Vrai si le regardant doit encore proposer un indice. */
  doitIndiquer: boolean;
};

export type JustOneVue = {
  cycles: number;
  hoteDevine: boolean;
  dureeIndices: number;
  gainDevineur: number;
  gainIndice: number;
  ordreDevineurs: string[];
  indexDevineur: number;
  nomHote: string;
  courante: MancheJustOneVue | null;
  bilan: Array<{ numero: number; devineurId: string; issue: 'trouve' | 'rate' | 'passe' | null; gains: Record<string, number> }>;
  recap: boolean;
  gains: Record<string, number>;
  totalManches: number;
};

export type CourseVue = {
  active: boolean;
  phase: PhaseCourse;
  disposition: TypeCase[];
  longueur: number;
  positions: Record<string, number>;
  arrivees: string[];
  cagnotte: number;
  tour: number;
  ordre: string[];
  indexCourant: number;
  joueurCourantId: string | null;
  choisitId: string | null;
  miniJeu: string | null;
  miniJeuId: string | null;
  joues: string[];
  grilleVisible: boolean;
  ecranMini: string | null;
  resultatsSaisis: boolean;
  minuteur: Minuteur;
  poker: PokerCourse;
  topten: TopTenVue | null;
  jeopardy: JeopardyVue | null;
  undercover: UndercoverVue | null;
  codenames: CodenamesVue | null;
  perudo: PerudoVue | null;
  justone: JustOneVue | null;
  catalogue: CatalogueMiniJeux;
  pokerConfig: ConfigPoker;
  etape: 'lancer' | 'roue' | null;
  carte: CarteChance | null;
  dernierDe: { joueurId: string; valeur: number; faces: number; usage: UsageDe; option: string | null } | null;
  classement: string[] | null;
  dernierTour: boolean;
  ceremonie: CeremonieVue | null;
  coupDePouceActif: boolean;
  gainBonus: number;
  optionsDe: OptionDe[];
  iconesCases: Record<TypeCase, string>;
};

export type VueTv = {
  role: 'tv';
  version: number;
  heureServeur: number;
  idDemarrage: string;
  partie: {
    titre: string;
    sousTitre: string;
    ecranTv: EcranTv;
    presentationId: number;
    animationsReduites: boolean;
    diagnosticTvAffiche: boolean;
  };
  urlJoueur: string;
  placesMax: number;
  volume: number;
  joueurs: JoueurPublic[];
  evenements: EvenementVue[];
  course: CourseVue | null;
};

export type VueJoueur = {
  role: 'joueur';
  version: number;
  heureServeur: number;
  idDemarrage: string;
  partie: {
    titre: string;
    ecranTv: EcranTv;
    inscriptionsVerrouillees: boolean;
    animationsReduites: boolean;
  };
  joueurs: JoueurPublic[];
  moi: {
    id: string;
    pseudo: string;
    avatar: string;
    couleur: string;
    gpVisibles: number;
  } | null;
  evenements: EvenementVue[];
  course: CourseVue | null;
};

export type AppareilVue = {
  role: 'tv' | 'joueur' | 'hote';
  joueurId: string | null;
  pseudo: string | null;
  latenceMs: number | null;
  decalageMs: number | null;
};

export type TransactionMasqueeVue = {
  id: string;
  joueurId: string;
  pseudo: string;
  montant: number;
  libelle: string;
  groupeRevelation?: string;
};

export type DiagnosticTv = {
  recuA: number;
  userAgent?: string;
  moteur?: { nom: string; version: string };
  es2015?: { flechees: boolean; classes: boolean; letConst: boolean };
  es2020?: { optionalChaining: boolean };
  proxy?: boolean;
  promise?: boolean;
  fetch?: boolean;
  webSocket?: boolean;
  css?: { grid: boolean; flexGap: boolean; variables: boolean; transforms3d: boolean };
  woff2?: boolean;
  audio?: { mp3: boolean; ogg: boolean; lectureSansInteraction: boolean | null };
  fullscreen?: boolean;
  fps?: number | null;
};

export type ReseauVue = {
  ip: string;
  port: number;
  autres: string[];
  urlTv: string;
  urlJoueur: string;
  urlHote: string;
  urlDiag: string;
};

export type StatistiquesJoueur = {
  lancers: number;
  indiceChance: number | null;
  misesDe: number;
  misesRoue: number;
  misesTotales: number;
  resultatRoue: number;
  jackpots: number;
  cartesMalchance: number;
  gpMalchance: number;
  casesReculees: number;
  casesReculeesCartes: number;
  casesReculeesPacte: number;
  casesAvanceesHorsDe: number;
  gpDonnes: number;
  gpRecus: number;
  gpParJeu: Record<string, number>;
  gpHorsPlateau: number;
  rangs: number[];
  pireRang: number | null;
  retardMax: number;
  rangArrivee: number | null;
  rangGpMi: number | null;
  rangGpFinal: number | null;
  remontee: number | null;
  retardRattrape: number;
  placesGp: number | null;
  legendaire: boolean;
};

export type CeremonieVue = {
  etape: Ceremonie['etape'];
  /** Trophées déjà révélés. La télé et les joueurs ne reçoivent que ceux-là. */
  reveles: TropheeTire[];
  /** Reste du tirage. Réservé à l'hôte : tableau vide pour les autres. */
  suivants: TropheeTire[];
  classementRevele: boolean;
  gagnantRevele: boolean;
  cagnotteEnAttente: { joueurId: string; montant: number } | null;
};

export type TropheeVue = {
  id: string;
  nom: string;
  description: string;
  icone: string;
  montant: number;
  attribuable: boolean;
  gagnants: string[];
  valeurs: Record<string, number | null>;
  phrase: string;
};

export type VueHote = {
  role: 'hote';
  version: number;
  heureServeur: number;
  idDemarrage: string;
  dev: boolean;
  partie: Partie;
  joueurs: Array<
    JoueurPublic & {
      gpMasques: number;
      latenceMs: number | null;
    }
  >;
  appareils: AppareilVue[];
  evenements: EvenementVue[];
  demandesReprise: Array<{ id: string; joueurId: string; pseudo: string; demandeA: number }>;
  transactionsMasquees: TransactionMasqueeVue[];
  annulation: string | null;
  nbMasquees: number;
  reseau: ReseauVue;
  diagnostic: DiagnosticTv | null;
  volume: number;
  course: CourseVue | null;
  /** Icônes de config inconnues. Vide quand tout correspond. */
  erreursConfig: string[];
  bots: boolean;
  statistiques: Record<string, StatistiquesJoueur>;
  trophees: TropheeVue[];
};

export type VueClient = VueTv | VueJoueur | VueHote;

export type Mesure = {
  latenceMs: number;
  decalageMs: number;
};

export interface EvenementsClient {
  bonjour: (message: Bonjour, ack: (reponse: ReponseBonjour) => void) => void;
  action: (action: Action, ack: (reponse: ReponseAction) => void) => void;
  reglerVolume: (message: { volume: number }) => void;
}

export interface EvenementsServeur {
  vue: (vue: VueClient) => void;
  mesure: (mesure: Mesure) => void;
  repriseValidee: (message: { jeton: string; joueurId: string }) => void;
  repriseRefusee: (message: { joueurId: string }) => void;
  pingHorloge: (
    message: { heureServeur: number },
    ack: (reponse: { heureClient: number }) => void,
  ) => void;
}

export type ConfigPartie = {
  titre: string;
  /** Sous-titre de la présentation télé ; vide = rien. */
  sousTitre: string;
  nbJoueursMax: number;
  codeHote: string;
  port: number;
  ipForcee: string | null;
  /** Nom affiché de l'hôte quand il participe (Top Ten, Just One…). */
  nomHote: string;
};
