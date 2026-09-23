import type { CatalogueMiniJeux, ConfigPoker } from './mini-jeux';
import type { Devines, ScoreTopTen, ThemeTopTen } from './topten';
import type { CouleurBuzzer, QuestionEnCours } from './jeopardy';
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

export type EcranTv = 'accueil' | 'scores' | 'plateau';

export type TypeCase = 'depart' | 'bonus' | 'chance' | 'cagnotte' | 'duel' | 'arrivee';

export type PhaseCourse =
  | 'preparation'
  | 'choixMiniJeu'
  | 'miniJeu'
  | 'deplacements'
  | 'finTour'
  | 'terminee';

export type EffetCarte =
  | { type: 'gain'; montant: number }
  | { type: 'gainTous'; montant: number }
  | { type: 'cadeau'; montant: number }
  | { type: 'gainDe' }
  | { type: 'neutre' };

export type CarteChance = {
  id: string;
  titre: string;
  texte: string;
  effet: EffetCarte;
};

export type UsageDe = 'deplacement' | 'chance';

export type LancerDe = {
  tour: number;
  joueurId: string;
  valeur: number;
  usage: UsageDe;
  /** Mise de tour associée. 0 pour un dé normal (mise nulle ou dé de carte chance). */
  mise: number;
  /** Espérance de la distribution utilisée pour ce lancer. */
  esperance: number;
};

export type ReglesCourse = {
  longueur: number;
  gainBonus: number;
  miseMax: number;
  /** Distribution des faces 1 à 6 lorsque la mise atteint miseMax. */
  probasMiseMax: number[];
  /** `rotation` : le choix tourne dans l'ordre de passage. `dernierAuClassement` : le moins de GP visibles choisit. */
  choixMiniJeu: 'rotation' | 'dernierAuClassement';
  duel: { miseMax: number; bonusVainqueur: number; defis: string[] };
};

export type DuelEnCours = {
  joueurId: string;
  etape: 'adversaire' | 'mises' | 'resultat';
  adversaireId: string | null;
  defi: string | null;
  mises: Record<string, number | null>;
  revelees: boolean;
};

export type EtapeDeplacement =
  | { genre: 'lancer' }
  | { genre: 'cadeau'; carteId: string }
  | { genre: 'duel'; duel: DuelEnCours };

export type HistoriqueCourse = {
  lancers: LancerDe[];
  mises: Array<{ tour: number; joueurId: string; montant: number; duel: boolean }>;
  effets: Array<{ tour: number; joueurId: string; caseIndex: number; type: string; detail: Record<string, unknown> }>;
  duels: Array<{
    tour: number;
    joueurId: string;
    adversaireId: string;
    defi: string;
    miseJoueur: number;
    miseAdversaire: number;
    resultat: 'joueur' | 'adversaire' | 'egalite';
  }>;
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

export type Course = {
  active: boolean;
  disposition: TypeCase[];
  positions: Record<string, number>;
  arrivees: string[];
  cagnotte: number;
  pioche: string[];
  defausse: string[];
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
  choisitId: string | null;
  carteCourante: { joueurId: string; carte: CarteChance } | null;
  dernierDe: { joueurId: string; valeur: number; usage: UsageDe } | null;
  classement: string[] | null;
  regles: ReglesCourse;
  historique: HistoriqueCourse;
};

export type ConfigPlateau = {
  longueur: number;
  repartition: { bonus: number; chance: number; cagnotte: number; duel: number };
  gainBonus: number;
  miseMax: number;
  /** Distribution des faces 1 à 6 lorsque la mise atteint miseMax. La somme vaut 1. */
  probasMiseMax: number[];
  choixMiniJeu: 'rotation' | 'dernierAuClassement';
  duel: { miseMax: number; bonusVainqueur: number; defis: string[] };
  disposition?: TypeCase[];
};

export type Partie = {
  titre: string;
  inscriptionsVerrouillees: boolean;
  ecranTv: EcranTv;
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
  | { type: 'passerAuxDeplacements' }
  | { type: 'lancerDe'; mise: number }
  | { type: 'choisirBeneficiaire'; joueurId: string }
  | { type: 'choisirAdversaire'; joueurId: string }
  | { type: 'miserDuel'; montant: number }
  | { type: 'cloreMisesDuel' }
  | { type: 'autreDefi' }
  | { type: 'resultatDuel'; resultat: 'joueur' | 'adversaire' | 'egalite' }
  | { type: 'definirPosition'; joueurId: string; position: number }
  | { type: 'passerJoueur' }
  | { type: 'terminerCourse' }
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

export type MiseVue = {
  joueurId: string;
  aMise: boolean;
  montant?: number;
};

export type DuelVue = {
  joueurId: string;
  etape: 'adversaire' | 'mises' | 'resultat';
  adversaireId: string | null;
  defi: string | null;
  mises: MiseVue[];
};

export type MancheTopTenVue = {
  numero: number;
  captenId: string;
  theme: ThemeTopTen;
  repondants: string[];
  etape: 'reponses' | 'revelee';
  /** Le numéro du répondant qui regarde (joueur ou hôte), sinon null. */
  monNumero: number | null;
  /** Tous les numéros : l'hôte toujours, les autres seulement après la révélation. */
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
  catalogue: CatalogueMiniJeux;
  pokerConfig: ConfigPoker;
  etape: 'lancer' | 'cadeau' | 'duel' | null;
  carte: CarteChance | null;
  duel: DuelVue | null;
  dernierDe: { joueurId: string; valeur: number; usage: UsageDe } | null;
  classement: string[] | null;
  gainBonus: number;
  miseMax: number;
  probasMiseMax: number[];
  miseMaxDuel: number;
  bonusDuel: number;
};

export type VueTv = {
  role: 'tv';
  version: number;
  heureServeur: number;
  idDemarrage: string;
  partie: {
    titre: string;
    ecranTv: EcranTv;
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
  bots: boolean;
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
  nbJoueursMax: number;
  codeHote: string;
  port: number;
  ipForcee: string | null;
};
