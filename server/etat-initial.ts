import { SCHEMA } from '../shared/constantes';
import type { EtatJeu } from '../shared/types';

export function etatInitial(titre: string, sousTitre = ''): EtatJeu {
  return {
    schema: SCHEMA,
    version: 0,
    partie: {
      titre,
      sousTitre,
      inscriptionsVerrouillees: false,
      ecranTv: 'accueil',
      presentationId: 0,
      animationsReduites: false,
      diagnosticTvAffiche: false,
    },
    joueurs: [],
    transactions: [],
    evenements: [],
    demandesReprise: [],
    course: null,
    bots: false,
  };
}
