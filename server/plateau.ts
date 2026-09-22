import type { ConfigPlateau, TypeCase } from '../shared/types';

export type Alea = (max: number) => number;

export function melanger<T>(liste: readonly T[], alea: Alea): T[] {
  const copie = [...liste];
  for (let index = copie.length - 1; index > 0; index -= 1) {
    const autre = alea(index + 1);
    const temporaire = copie[index]!;
    copie[index] = copie[autre]!;
    copie[autre] = temporaire;
  }
  return copie;
}

const TYPES: TypeCase[] = ['depart', 'bonus', 'chance', 'cagnotte', 'duel', 'arrivee'];

export function dispositionValide(disposition: TypeCase[], longueur: number): string | null {
  if (disposition.length !== longueur + 1) return 'La disposition ne couvre pas le plateau';
  if (disposition[0] !== 'depart') return 'La case 0 doit être le départ';
  if (disposition[longueur] !== 'arrivee') return "La dernière case doit être l'arrivée";
  if (disposition.some((type) => !TYPES.includes(type))) return 'Type de case inconnu';
  return null;
}

function placerSansVoisins(candidats: number[], nombre: number, alea: Alea): number[] | null {
  const melange = melanger(candidats, alea);
  const pris: number[] = [];
  for (const index of melange) {
    if (pris.some((autre) => Math.abs(autre - index) === 1)) continue;
    pris.push(index);
    if (pris.length === nombre) return pris;
  }
  return null;
}

export function genererDisposition(config: ConfigPlateau, alea: Alea): TypeCase[] {
  if (config.disposition) {
    const erreur = dispositionValide(config.disposition, config.longueur);
    if (erreur) throw new Error(erreur);
    return [...config.disposition];
  }
  const longueur = config.longueur;
  const autorises: number[] = [];
  for (let index = 4; index < longueur; index += 1) autorises.push(index);
  for (let essai = 0; essai < 80; essai += 1) {
    const cagnottes = placerSansVoisins(autorises, config.repartition.cagnotte, alea);
    if (!cagnottes) continue;
    const pris = new Set(cagnottes);
    const reste = autorises.filter((index) => !pris.has(index));
    const duels = placerSansVoisins(reste, config.repartition.duel, alea);
    if (!duels) continue;
    const cases: TypeCase[] = Array.from({ length: longueur + 1 }, () => 'bonus');
    cases[0] = 'depart';
    cases[longueur] = 'arrivee';
    for (const index of cagnottes) cases[index] = 'cagnotte';
    for (const index of duels) cases[index] = 'duel';
    const vides: number[] = [];
    for (let index = 1; index < longueur; index += 1) {
      if (cases[index] === 'bonus') vides.push(index);
    }
    const remplissage: TypeCase[] = [
      ...Array.from({ length: config.repartition.bonus }, () => 'bonus' as const),
      ...Array.from({ length: config.repartition.chance }, () => 'chance' as const),
    ];
    if (remplissage.length !== vides.length) continue;
    const melange = melanger(remplissage, alea);
    vides.forEach((index, position) => {
      cases[index] = melange[position]!;
    });
    return cases;
  }
  throw new Error('Impossible de générer le plateau');
}

export type ParticipantOrdre = { id: string; mise: number; gp: number };

export function calculerOrdre(participants: ParticipantOrdre[], alea: Alea): { ordre: string[]; tirage: boolean } {
  const groupes = new Map<string, ParticipantOrdre[]>();
  for (const participant of participants) {
    const cle = `${participant.mise}|${participant.gp}`;
    const liste = groupes.get(cle) ?? [];
    liste.push(participant);
    groupes.set(cle, liste);
  }
  const cles = [...groupes.keys()].sort((gauche, droite) => {
    const [miseGauche, gpGauche] = gauche.split('|').map(Number);
    const [miseDroite, gpDroite] = droite.split('|').map(Number);
    if (miseDroite !== miseGauche) return (miseDroite ?? 0) - (miseGauche ?? 0);
    return (gpGauche ?? 0) - (gpDroite ?? 0);
  });
  const ordre: string[] = [];
  let tirage = false;
  for (const cle of cles) {
    let groupe = groupes.get(cle) ?? [];
    if (groupe.length > 1) {
      groupe = melanger(groupe, alea);
      tirage = true;
    }
    for (const participant of groupe) ordre.push(participant.id);
  }
  return { ordre, tirage };
}

export function calculerClassement(
  joueurs: Array<{ id: string; position: number; gp: number; arrivee: number | null }>,
  alea: Alea,
): string[] {
  const arrives = joueurs
    .filter((joueur) => joueur.arrivee !== null)
    .sort((a, b) => (a.arrivee ?? 0) - (b.arrivee ?? 0))
    .map((joueur) => joueur.id);
  const autres = joueurs.filter((joueur) => joueur.arrivee === null);
  const groupes = new Map<string, typeof autres>();
  for (const joueur of autres) {
    const cle = `${joueur.position}|${joueur.gp}`;
    const liste = groupes.get(cle) ?? [];
    liste.push(joueur);
    groupes.set(cle, liste);
  }
  const cles = [...groupes.keys()].sort((gauche, droite) => {
    const [positionGauche, gpGauche] = gauche.split('|').map(Number);
    const [positionDroite, gpDroite] = droite.split('|').map(Number);
    if (positionDroite !== positionGauche) return (positionDroite ?? 0) - (positionGauche ?? 0);
    return (gpGauche ?? 0) - (gpDroite ?? 0);
  });
  const suite: string[] = [];
  for (const cle of cles) {
    let groupe = groupes.get(cle) ?? [];
    if (groupe.length > 1) groupe = melanger(groupe, alea);
    for (const joueur of groupe) suite.push(joueur.id);
  }
  return [...arrives, ...suite];
}

export function creditsDuel(
  miseJoueur: number,
  miseAdversaire: number,
  resultat: 'joueur' | 'adversaire' | 'egalite',
  bonus: number,
): { joueur: number; adversaire: number } {
  if (resultat === 'egalite') return { joueur: miseJoueur, adversaire: miseAdversaire };
  if (resultat === 'joueur') return { joueur: miseJoueur + miseAdversaire + bonus, adversaire: 0 };
  return { joueur: 0, adversaire: miseJoueur + miseAdversaire + bonus };
}

export function plafondMise(soldeVisible: number, maximum: number): number {
  return Math.max(0, Math.min(maximum, soldeVisible));
}
