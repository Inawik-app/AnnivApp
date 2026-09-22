import { SCHEMA } from '../shared/constantes';
import type { EtatJeu } from '../shared/types';

export function etatInitial(titre: string): EtatJeu {
  return {
    schema: SCHEMA,
    version: 0,
    partie: {
      titre,
      inscriptionsVerrouillees: false,
      ecranTv: 'accueil',
      animationsReduites: false,
      diagnosticTvAffiche: false,
    },
    joueurs: [],
    transactions: [],
    evenements: [],
    demandesReprise: [],
  };
}
