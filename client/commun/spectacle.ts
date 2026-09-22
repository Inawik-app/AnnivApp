import type { EvenementVue, JoueurPublic } from '../../shared/types';

export function initiale(pseudo: string): string {
  const texte = pseudo.trim();
  return texte ? texte.charAt(0).toLocaleUpperCase('fr-FR') : '?';
}

export function libelleRang(place: number): string {
  return place === 1 ? '1er' : `${place}e`;
}

export function joueurIdDe(evenement: EvenementVue): string | null {
  const id = evenement.donnees.joueurId;
  return typeof id === 'string' ? id : null;
}

export function montantDe(evenement: EvenementVue): number | null {
  const montant = evenement.donnees.montant;
  return typeof montant === 'number' ? montant : null;
}

export function gainsSuivants(evenements: EvenementVue[], index: number, joueurId: string): number {
  let total = 0;
  for (let curseur = index + 1; curseur < evenements.length; curseur += 1) {
    const evenement = evenements[curseur];
    if (!evenement || (evenement.type !== 'gp.ajoutes' && evenement.type !== 'gp.reveles')) continue;
    if (joueurIdDe(evenement) !== joueurId) continue;
    const montant = montantDe(evenement);
    if (montant !== null) total += montant;
  }
  return total;
}

export function trierAccueil(joueurs: JoueurPublic[]): JoueurPublic[] {
  return [...joueurs].sort((a, b) => a.rejointA - b.rejointA || a.pseudo.localeCompare(b.pseudo, 'fr'));
}

export function actualiserPlaces(joueurs: JoueurPublic[]): JoueurPublic[] {
  const parScore = [...joueurs].sort((a, b) => b.gpVisibles - a.gpVisibles || a.pseudo.localeCompare(b.pseudo, 'fr'));
  const places = new Map<string, number>();
  let place = 1;
  parScore.forEach((joueur, index) => {
    const precedent = parScore[index - 1];
    if (precedent && joueur.gpVisibles < precedent.gpVisibles) place = index + 1;
    places.set(joueur.id, place);
  });
  return joueurs.map((joueur) => ({ ...joueur, place: places.get(joueur.id) ?? joueur.place }));
}

export function ecranDepuis(evenement: EvenementVue): 'accueil' | 'scores' | 'plateau' | null {
  const brut = evenement.donnees.ecran;
  if (brut === 'accueil' || brut === 'scores' || brut === 'plateau') return brut;
  if (evenement.libelle.includes('plateau')) return 'plateau';
  if (evenement.libelle.includes('scores')) return 'scores';
  if (evenement.libelle.includes('accueil')) return 'accueil';
  return null;
}
