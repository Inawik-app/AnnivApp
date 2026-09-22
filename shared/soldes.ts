import type { Transaction } from './types';

export function solde(
  transactions: Transaction[],
  joueurId: string,
  mode: 'visibles' | 'masques',
): number {
  let total = 0;
  for (const transaction of transactions) {
    if (transaction.joueurId !== joueurId) continue;
    if (mode === 'visibles' && transaction.masquee) continue;
    if (mode === 'masques' && !transaction.masquee) continue;
    total += transaction.montant;
  }
  return total;
}

export function clePseudo(pseudo: string): string {
  return pseudo.trim().toLocaleLowerCase('fr');
}
