import type { MiniJeu, SaisieMiniJeu } from './types';

export type BaremeEquipes = { gagnant: number; perdant: number };

export type CatalogueMiniJeux = {
  baremes: { classement: number[]; equipes: BaremeEquipes };
  jeux: MiniJeu[];
};

export type NiveauBlind = { petite: number; grosse: number };

export type ConfigPoker = {
  jetonsOfferts: number;
  dureeMinutes: number;
  niveaux: NiveauBlind[];
  regles: string[];
};

export type EntreeClassement = { joueurId: string; exAequo: boolean };

export type GainMiniJeu = { joueurId: string; montant: number; rang?: number };

/** Modules dont l'écran existe. Les autres affichent les règles, en attendant l'étape suivante. */
export const MODULES_PRETS = new Set(['poker']);

export function modulePret(module: string): boolean {
  return module === 'aucun' || MODULES_PRETS.has(module);
}

export function ecranPour(module: string): string {
  if (MODULES_PRETS.has(module)) return module;
  return 'regles';
}

export function minuteurArrete(): { etat: 'arrete'; finA: null; resteMs: 0; libelle: '' } {
  return { etat: 'arrete', finA: null, resteMs: 0, libelle: '' };
}

export function dureeNiveauMs(config: ConfigPoker): number {
  return Math.round((config.dureeMinutes * 60 * 1000) / config.niveaux.length);
}

export function resteMinuteur(
  minuteur: { etat: 'arrete' | 'enCours' | 'enPause'; finA: number | null; resteMs: number },
  maintenantServeur: number,
): number {
  if (minuteur.etat === 'arrete') return 0;
  if (minuteur.etat === 'enPause' || minuteur.finA === null) return Math.max(0, minuteur.resteMs);
  return Math.max(0, minuteur.finA - maintenantServeur);
}

export function texteMinuteur(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const secondes = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(secondes).padStart(2, '0')}`;
}

export function baremeClassement(jeu: MiniJeu, catalogue: CatalogueMiniJeux): number[] {
  return jeu.bareme ?? catalogue.baremes.classement;
}

export function libelleBareme(jeu: MiniJeu, catalogue: CatalogueMiniJeux): string {
  if (jeu.saisie === 'classement') {
    const rangs = ['1er', '2e', '3e', '4e', '5e', '6e', '7e', '8e'];
    return baremeClassement(jeu, catalogue)
      .map((gp, index) => `${rangs[index] ?? `${index + 1}e`} ${gp}${index === 0 ? ' GP' : ''}`)
      .join(' · ');
  }
  if (jeu.saisie === 'equipes') {
    const { gagnant, perdant } = catalogue.baremes.equipes;
    return `Gagnants ${gagnant} GP · perdants ${perdant} GP`;
  }
  return "GP saisis par l'hôte";
}

/**
 * Rang de compétition : un groupe ex aequo prend le rang du premier du groupe.
 * Le joueur suivant reçoit le rang qui saute les égalités (1, 1, 3…).
 * Le drapeau du premier joueur est ignoré : il ouvre toujours un groupe.
 */
export function gainsClassement(ordre: EntreeClassement[], bareme: number[]): GainMiniJeu[] {
  const gains: GainMiniJeu[] = [];
  let index = 0;
  while (index < ordre.length) {
    const debut = index;
    index += 1;
    while (index < ordre.length && ordre[index]?.exAequo) index += 1;
    const rang = debut + 1;
    const montant = bareme[rang - 1] ?? 0;
    for (let curseur = debut; curseur < index; curseur += 1) {
      const entree = ordre[curseur];
      if (!entree) continue;
      gains.push({ joueurId: entree.joueurId, montant, rang });
    }
  }
  return gains;
}

export function gainsEquipes(
  equipeA: string[],
  equipeB: string[],
  gagnante: 'A' | 'B',
  bareme: BaremeEquipes,
): GainMiniJeu[] {
  const gagnants = gagnante === 'A' ? equipeA : equipeB;
  const perdants = gagnante === 'A' ? equipeB : equipeA;
  return [
    ...gagnants.map((joueurId) => ({ joueurId, montant: bareme.gagnant })),
    ...perdants.map((joueurId) => ({ joueurId, montant: bareme.perdant })),
  ];
}

/**
 * Part entière pour chacun. Le reste de la division va au joueur
 * qui a le moins de GP visibles. Égalité : le plus tôt dans la liste.
 */
export function repartirTapisHote(
  montant: number,
  joueurs: Array<{ id: string; gpVisibles: number }>,
): GainMiniJeu[] {
  if (joueurs.length === 0 || montant <= 0) {
    return joueurs.map((joueur) => ({ joueurId: joueur.id, montant: 0 }));
  }
  const part = Math.floor(montant / joueurs.length);
  const reste = montant - part * joueurs.length;
  let moins = 0;
  for (let index = 1; index < joueurs.length; index += 1) {
    const courant = joueurs[index];
    const retenu = joueurs[moins];
    if (courant && retenu && courant.gpVisibles < retenu.gpVisibles) moins = index;
  }
  return joueurs.map((joueur, index) => ({
    joueurId: joueur.id,
    montant: part + (index === moins ? reste : 0),
  }));
}

function estObjet(valeur: unknown): valeur is Record<string, unknown> {
  return !!valeur && typeof valeur === 'object' && !Array.isArray(valeur);
}

function entierPositif(valeur: unknown, zeroAutorise = false): valeur is number {
  return typeof valeur === 'number' && Number.isInteger(valeur) && (zeroAutorise ? valeur >= 0 : valeur > 0);
}

const SAISIES = new Set<SaisieMiniJeu>(['classement', 'equipes', 'libre']);

export function validerCatalogue(brut: unknown): CatalogueMiniJeux {
  function echec(message: string): never {
    throw new Error(`mini-jeux.json : ${message}`);
  }
  if (!estObjet(brut) || !estObjet(brut.baremes) || !Array.isArray(brut.jeux)) {
    echec('il faut un objet avec « baremes » et « jeux »');
  }
  const baremes = brut.baremes;
  if (!Array.isArray(baremes.classement) || baremes.classement.length < 1 || baremes.classement.length > 8) {
    echec('le barème classement doit contenir entre 1 et 8 valeurs');
  }
  const classement = baremes.classement.map((valeur, index) => {
    if (!entierPositif(valeur, true)) echec(`le barème classement n'a pas un entier positif ou nul en position ${index + 1}`);
    return valeur;
  });
  if (!estObjet(baremes.equipes)) echec('le barème équipes est absent');
  if (!entierPositif(baremes.equipes.gagnant, true) || !entierPositif(baremes.equipes.perdant, true)) {
    echec('le barème équipes doit indiquer les GP du gagnant et du perdant');
  }
  if (brut.jeux.length === 0) echec('la liste des mini-jeux est vide');
  const vus = new Set<string>();
  const jeux: MiniJeu[] = brut.jeux.map((entree, index) => {
    if (!estObjet(entree)) echec(`l'entrée ${index + 1} n'est pas un mini-jeu`);
    const id = entree.id;
    if (typeof id !== 'string' || !/^[a-z0-9-]+$/.test(id)) echec(`l'entrée ${index + 1} n'a pas un identifiant valide`);
    if (vus.has(id)) echec(`l'identifiant « ${id} » est en double`);
    vus.add(id);
    if (typeof entree.nom !== 'string' || entree.nom.trim().length === 0) echec(`le mini-jeu « ${id} » n'a pas de nom`);
    if (typeof entree.resume !== 'string' || entree.resume.trim().length === 0) {
      echec(`le mini-jeu « ${id} » n'a pas de résumé`);
    }
    if (typeof entree.icone !== 'string' || entree.icone.trim().length === 0) {
      echec(`le mini-jeu « ${id} » n'a pas d'icône`);
    }
    if (!Array.isArray(entree.regles) || entree.regles.length < 3 || entree.regles.length > 5) {
      echec(`le mini-jeu « ${id} » doit avoir entre 3 et 5 règles`);
    }
    const regles = entree.regles.map((ligne, ligneIndex) => {
      if (typeof ligne !== 'string' || ligne.trim().length === 0) {
        echec(`le mini-jeu « ${id} » a une règle vide (ligne ${ligneIndex + 1})`);
      }
      return ligne.trim();
    });
    let materiel: string | undefined;
    if (entree.materiel !== undefined) {
      if (typeof entree.materiel !== 'string' || entree.materiel.trim().length === 0) {
        echec(`le mini-jeu « ${id} » a un matériel illisible`);
      }
      materiel = entree.materiel.trim();
    }
    let duree: number | undefined;
    if (entree.duree !== undefined) {
      if (!entierPositif(entree.duree)) echec(`le mini-jeu « ${id} » a une durée invalide`);
      duree = entree.duree;
    }
    if (typeof entree.saisie !== 'string' || !SAISIES.has(entree.saisie as SaisieMiniJeu)) {
      echec(`le mini-jeu « ${id} » a une saisie inconnue`);
    }
    let bareme: number[] | undefined;
    if (entree.bareme !== undefined) {
      if (!Array.isArray(entree.bareme) || entree.bareme.length < 1) {
        echec(`le mini-jeu « ${id} » a un barème illisible`);
      }
      bareme = entree.bareme.map((valeur, valeurIndex) => {
        if (!entierPositif(valeur, true)) echec(`le mini-jeu « ${id} » a un barème invalide en position ${valeurIndex + 1}`);
        return valeur;
      });
    }
    if (typeof entree.module !== 'string' || entree.module.trim().length === 0) {
      echec(`le mini-jeu « ${id} » n'a pas de module`);
    }
    const jeu: MiniJeu = {
      id,
      nom: entree.nom.trim(),
      resume: entree.resume.trim(),
      icone: entree.icone.trim(),
      regles,
      saisie: entree.saisie as SaisieMiniJeu,
      module: entree.module.trim(),
    };
    if (materiel) jeu.materiel = materiel;
    if (duree !== undefined) jeu.duree = duree;
    if (bareme) jeu.bareme = bareme;
    return jeu;
  });
  return {
    baremes: {
      classement,
      equipes: { gagnant: baremes.equipes.gagnant, perdant: baremes.equipes.perdant },
    },
    jeux,
  };
}

export function validerPoker(brut: unknown): ConfigPoker {
  function echec(message: string): never {
    throw new Error(`poker.json : ${message}`);
  }
  if (!estObjet(brut)) echec('le fichier est illisible');
  if (!entierPositif(brut.jetonsOfferts)) echec('jetonsOfferts doit être un entier positif');
  if (!entierPositif(brut.dureeMinutes)) echec('dureeMinutes doit être un entier positif');
  if (!Array.isArray(brut.niveaux) || brut.niveaux.length < 1) echec('il faut au moins un niveau de blinds');
  const niveaux = brut.niveaux.map((entree, index) => {
    if (!estObjet(entree) || !entierPositif(entree.petite) || !entierPositif(entree.grosse)) {
      echec(`le niveau ${index + 1} doit indiquer une petite et une grosse blind`);
    }
    return { petite: entree.petite, grosse: entree.grosse };
  });
  if (!Array.isArray(brut.regles) || brut.regles.length < 3 || brut.regles.length > 8) {
    echec('les règles doivent tenir en 3 à 8 lignes');
  }
  const regles = brut.regles.map((ligne, index) => {
    if (typeof ligne !== 'string' || ligne.trim().length === 0) echec(`la règle ${index + 1} est vide`);
    return ligne.trim();
  });
  return { jetonsOfferts: brut.jetonsOfferts, dureeMinutes: brut.dureeMinutes, niveaux, regles };
}

export function jeuParId(catalogue: CatalogueMiniJeux, id: string): MiniJeu | undefined {
  return catalogue.jeux.find((jeu) => jeu.id === id);
}
