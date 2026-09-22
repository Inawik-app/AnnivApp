import type { EtatJeu, Origine, Transaction } from '../shared/types';

export function verifierRegleOr(avant: EtatJeu, apres: EtatJeu, origine: Origine): string | null {
  if (origine.role !== 'joueur') return null;
  const avantParId = new Map<string, Transaction>(avant.transactions.map((transaction) => [transaction.id, transaction]));
  for (const transaction of apres.transactions) {
    const ancienne = avantParId.get(transaction.id);
    if (!ancienne) {
      if (transaction.montant < 0 && transaction.joueurId !== origine.joueurId) {
        return 'Cette action retirerait des GP à un autre joueur';
      }
      continue;
    }
    if (transaction.joueurId !== origine.joueurId && transaction.montant < ancienne.montant) {
      return 'Cette action retirerait des GP à un autre joueur';
    }
  }
  return null;
}
