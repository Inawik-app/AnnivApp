import type { EffetPlateau, EtatJeu, InstantaneTour, StatistiquesJoueur, Transaction } from './types.js';

const VIDE = {
  lancers: 0,
  indiceChance: null,
  misesDe: 0,
  misesRoue: 0,
  misesTotales: 0,
  resultatRoue: 0,
  jackpots: 0,
  cartesMalchance: 0,
  gpMalchance: 0,
  casesReculees: 0,
  casesReculeesCartes: 0,
  casesReculeesPacte: 0,
  casesAvanceesHorsDe: 0,
  gpDonnes: 0,
  gpRecus: 0,
  gpParJeu: {},
  gpHorsPlateau: 0,
  rangs: [],
  pireRang: null,
  retardMax: 0,
  rangArrivee: null,
  rangGpMi: null,
  rangGpFinal: null,
  remontee: null,
  retardRattrape: 0,
  placesGp: null,
  legendaire: false,
} satisfies StatistiquesJoueur;

/** Rang de compétition : 1 est le meilleur. Les égalités partagent le rang. */
export function rangsCompetition(
  ids: readonly string[],
  valeur: (id: string) => number,
  plusGrandMieux: boolean,
): Record<string, number> {
  const tries = [...ids].sort((a, b) => (plusGrandMieux ? valeur(b) - valeur(a) : valeur(a) - valeur(b)));
  const rangs: Record<string, number> = {};
  tries.forEach((id, index) => {
    const precedent = tries[index - 1];
    rangs[id] = precedent && valeur(precedent) === valeur(id) ? rangs[precedent]! : index + 1;
  });
  return rangs;
}

/**
 * Rang dans la course. Les arrivés passent devant, dans l'ordre d'arrivée.
 * Les autres sont classés par position, avec égalité en cas de case identique.
 */
export function rangsCourse(
  ids: readonly string[],
  position: (id: string) => number,
  arrivees: readonly string[],
): Record<string, number> {
  const rangs: Record<string, number> = {};
  const deja = arrivees.filter((id) => ids.includes(id));
  deja.forEach((id, index) => {
    rangs[id] = index + 1;
  });
  const reste = ids.filter((id) => rangs[id] === undefined);
  reste.sort((a, b) => position(b) - position(a));
  reste.forEach((id, index) => {
    const precedent = reste[index - 1];
    rangs[id] =
      precedent && position(precedent) === position(id) ? rangs[precedent]! : deja.length + index + 1;
  });
  return rangs;
}

export function distanceLeaderArrivee(longueur: number, positions: readonly number[]): number {
  const max = positions.reduce((courant, position) => Math.max(courant, position), 0);
  return Math.max(0, longueur - max);
}

function cleJeu(transaction: Transaction): string | null {
  if (transaction.montant <= 0) return null;
  if (transaction.source === 'poker') return 'poker';
  if (transaction.source === 'ping-pong') return 'ping-pong';
  if (transaction.source === 'arrivee') return 'arrivée';
  if (transaction.source !== 'mini-jeu') return null;
  const libelle = transaction.libelle.toLowerCase();
  if (libelle.includes('ping-pong') || libelle.includes('ping pong')) return 'ping-pong';
  return transaction.libelle;
}

function appliquerEffet(stats: StatistiquesJoueur, effet: EffetPlateau, joueurId: string): void {
  if (effet.joueurId === joueurId && effet.cases < 0) {
    const recul = -effet.cases;
    stats.casesReculees += recul;
    if (effet.type === 'chance' || effet.type === 'malchance') stats.casesReculeesCartes += recul;
    if (effet.roue?.option === 'pacte') stats.casesReculeesPacte += recul;
  } else if (effet.joueurId === joueurId && effet.cases > 0 && effet.type !== 'de') {
    stats.casesAvanceesHorsDe += effet.cases;
  }
  if (effet.joueurId === joueurId) {
    stats.gpDonnes += effet.gpDonnes;
    stats.gpRecus += effet.gpRecus;
    if (effet.type === 'malchance') {
      stats.cartesMalchance += 1;
      stats.gpMalchance += effet.gpPerdus;
    }
    if (effet.type === 'roue') {
      stats.misesRoue += effet.roue?.mise ?? 0;
      stats.resultatRoue += effet.gpGagnes - effet.gpPerdus;
      if (effet.roue?.option === 'jackpot') stats.jackpots += 1;
    }
  }
  for (const ligne of effet.contrepartie.joueurs) {
    if (ligne.id !== joueurId) continue;
    if (ligne.montant < 0) stats.gpDonnes += -ligne.montant;
    if (ligne.montant > 0) stats.gpRecus += ligne.montant;
  }
}

function retard(instantane: InstantaneTour, joueurId: string, longueur: number): number {
  const ligne = instantane.joueurs.find((joueur) => joueur.id === joueurId);
  const leader = longueur - instantane.distanceLeader;
  return Math.max(0, leader - (ligne?.position ?? 0));
}

function copie(stats: StatistiquesJoueur): StatistiquesJoueur {
  return { ...stats, gpParJeu: { ...stats.gpParJeu }, rangs: [...stats.rangs] };
}

/** Statistiques pures : rien n'est stocké à part de l'état et de son historique. */
export function statistiques(etat: EtatJeu): Record<string, StatistiquesJoueur> {
  const resultat: Record<string, StatistiquesJoueur> = {};
  for (const joueur of etat.joueurs) resultat[joueur.id] = copie(VIDE);
  const course = etat.course;
  if (!course) return resultat;

  const ecarts: Record<string, number[]> = {};
  for (const lancer of course.historique.lancers) {
    if (lancer.usage !== 'deplacement') continue;
    const stats = resultat[lancer.joueurId];
    if (!stats) continue;
    stats.lancers += 1;
    stats.misesDe += lancer.mise;
    const liste = ecarts[lancer.joueurId] ?? [];
    liste.push(lancer.valeur - lancer.esperance);
    ecarts[lancer.joueurId] = liste;
  }
  for (const [id, liste] of Object.entries(ecarts)) {
    const stats = resultat[id];
    if (!stats || liste.length === 0) continue;
    stats.indiceChance = liste.reduce((somme, ecart) => somme + ecart, 0) / liste.length;
  }

  for (const effet of course.historique.effets) {
    for (const joueur of etat.joueurs) {
      const stats = resultat[joueur.id];
      if (stats) appliquerEffet(stats, effet, joueur.id);
    }
  }

  for (const transaction of etat.transactions) {
    const cle = cleJeu(transaction);
    const stats = resultat[transaction.joueurId];
    if (!cle || !stats) continue;
    stats.gpParJeu[cle] = (stats.gpParJeu[cle] ?? 0) + transaction.montant;
    stats.gpHorsPlateau += transaction.montant;
  }

  for (const stats of Object.values(resultat)) {
    stats.misesTotales = stats.misesDe + stats.misesRoue;
  }

  const instantanes = course.historique.instantanes;
  for (const instantane of instantanes) {
    for (const ligne of instantane.joueurs) {
      const stats = resultat[ligne.id];
      if (!stats) continue;
      stats.rangs.push(ligne.rang);
      const deficit = retard(instantane, ligne.id, course.regles.longueur);
      stats.retardMax = Math.max(stats.retardMax, deficit);
      if (instantane.tour >= 3) stats.retardRattrape = Math.max(stats.retardRattrape, deficit);
    }
  }

  const rangsFinaux = rangsCourse(
    etat.joueurs.map((joueur) => joueur.id),
    (id) => course.positions[id] ?? 0,
    course.arrivees,
  );
  for (const joueur of etat.joueurs) {
    const stats = resultat[joueur.id];
    if (!stats) continue;
    stats.rangArrivee = rangsFinaux[joueur.id] ?? null;
    const apres = stats.rangs.length === 0 ? [] : instantanes.filter((instantane) => instantane.tour >= 3);
    const pires = apres
      .map((instantane) => instantane.joueurs.find((ligne) => ligne.id === joueur.id)?.rang)
      .filter((rang): rang is number => rang !== undefined);
    stats.pireRang = pires.length > 0 ? Math.max(...pires) : null;
    stats.remontee =
      stats.pireRang !== null && stats.rangArrivee !== null ? stats.pireRang - stats.rangArrivee : null;
    stats.legendaire = instantanes.some(
      (instantane) =>
        instantane.distanceLeader <= 8 &&
        instantane.joueurs.find((ligne) => ligne.id === joueur.id)?.rang === etat.joueurs.length,
    );
  }

  const dernier = instantanes[instantanes.length - 1];
  const moitieTour = instantanes.length === 0 ? 0 : Math.ceil(instantanes[instantanes.length - 1]!.tour / 2);
  const moitie = [...instantanes].reverse().find((instantane) => instantane.tour <= moitieTour) ?? instantanes[0];
  if (dernier) {
    const final = rangsCompetition(
      etat.joueurs.map((joueur) => joueur.id),
      (id) => dernier.joueurs.find((ligne) => ligne.id === id)?.gpVisibles ?? 0,
      true,
    );
    const milieu = moitie
      ? rangsCompetition(
          etat.joueurs.map((joueur) => joueur.id),
          (id) => moitie.joueurs.find((ligne) => ligne.id === id)?.gpVisibles ?? 0,
          true,
        )
      : null;
    for (const joueur of etat.joueurs) {
      const stats = resultat[joueur.id];
      if (!stats) continue;
      stats.rangGpFinal = final[joueur.id] ?? null;
      stats.rangGpMi = milieu ? (milieu[joueur.id] ?? null) : null;
      stats.placesGp =
        stats.rangGpMi !== null && stats.rangGpFinal !== null ? stats.rangGpMi - stats.rangGpFinal : null;
    }
  }
  return resultat;
}
