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
  | 'mises'
  | 'revelation'
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
};

export type ReglesCourse = {
  longueur: number;
  gainBonus: number;
  miseMax: number;
  choixMiniJeu: 'premier' | 'dernier';
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
  misesCloturees: boolean;
  mises: Record<string, number | null>;
  ordre: string[];
  indexCourant: number;
  etape: EtapeDeplacement | null;
  miniJeu: string | null;
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
  choixMiniJeu: 'premier' | 'dernier';
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
  | { type: 'miser'; montant: number }
  | { type: 'cloreMises' }
  | { type: 'revelerMises' }
  | { type: 'passerAuChoix' }
  | { type: 'choisirMiniJeu'; nom: string }
  | { type: 'passerAuxDeplacements' }
  | { type: 'lancerDe' }
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

export type CourseVue = {
  active: boolean;
  phase: PhaseCourse;
  disposition: TypeCase[];
  longueur: number;
  positions: Record<string, number>;
  arrivees: string[];
  cagnotte: number;
  tour: number;
  mises: MiseVue[];
  ordre: string[];
  indexCourant: number;
  joueurCourantId: string | null;
  choisitId: string | null;
  miniJeu: string | null;
  etape: 'lancer' | 'cadeau' | 'duel' | null;
  carte: CarteChance | null;
  duel: DuelVue | null;
  dernierDe: { joueurId: string; valeur: number; usage: UsageDe } | null;
  classement: string[] | null;
  gainBonus: number;
  miseMax: number;
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
