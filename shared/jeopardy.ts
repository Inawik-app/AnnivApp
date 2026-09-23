export type QuestionJeopardy = {
  question: string;
  /** null : l'hôte connaît la réponse, elle n'est pas écrite. */
  reponse: string | null;
  accepte: string[];
};

export type ThemeJeopardy = { nom: string; questions: QuestionJeopardy[] };

export type ConfigJeopardy = {
  valeurs: number[];
  penaliteMauvaiseReponse: number;
  themes: ThemeJeopardy[];
};

/**
 * Vert : peut buzzer. Rouge : buzzers fermés ou priorité du choisisseur.
 * Bleu : a la main. Gris : s'est déjà trompé sur cette question.
 */
export type CouleurBuzzer = 'vert' | 'rouge' | 'bleu' | 'gris';

export type QuestionEnCours = {
  theme: number;
  niveau: number;
  choisisseurId: string;
  /** Qui a la main : le choisisseur d'abord, puis le premier buzz. */
  mainId: string | null;
  /** Buzzers ouverts : personne n'a la main. */
  ouverte: boolean;
  elimines: string[];
};

export function couleurBuzzer(question: QuestionEnCours | null, joueurId: string): CouleurBuzzer {
  if (!question) return 'rouge';
  if (question.mainId === joueurId) return 'bleu';
  if (question.elimines.includes(joueurId)) return 'gris';
  if (question.ouverte && question.mainId === null) return 'vert';
  return 'rouge';
}

export const REPONSE_AUCUNE = "Réponse connue de l'hôte";

/** Une réponse faite seulement de chiffres (nombre, date) est interdite : tout se dit à l'oral. */
export function reponseChiffree(texte: string): boolean {
  return /\d/.test(texte) && /^[\d\s.,:/'h-]+$/i.test(texte.trim());
}

function estObjet(valeur: unknown): valeur is Record<string, unknown> {
  return !!valeur && typeof valeur === 'object' && !Array.isArray(valeur);
}

function texte(valeur: unknown): valeur is string {
  return typeof valeur === 'string' && valeur.trim().length > 0;
}

export function validerJeopardy(brut: unknown): ConfigJeopardy {
  function echec(message: string): never {
    throw new Error(`jeopardy.json : ${message}`);
  }
  if (!estObjet(brut)) echec('le fichier est illisible');
  if (!Array.isArray(brut.valeurs) || brut.valeurs.length < 1) echec('valeurs doit lister au moins une valeur');
  const valeurs = brut.valeurs.map((valeur, index) => {
    if (typeof valeur !== 'number' || !Number.isInteger(valeur) || valeur < 1) {
      echec(`la valeur ${index + 1} doit être un entier positif`);
    }
    return valeur;
  });
  const penalite = brut.penaliteMauvaiseReponse;
  if (typeof penalite !== 'number' || !Number.isInteger(penalite) || penalite < 0) {
    echec('penaliteMauvaiseReponse doit être un entier positif ou nul');
  }
  if (!Array.isArray(brut.themes) || brut.themes.length < 1) echec('il faut au moins un thème');
  const noms = new Set<string>();
  const themes = brut.themes.map((theme, indexTheme) => {
    if (!estObjet(theme) || !texte(theme.nom)) echec(`le thème ${indexTheme + 1} n'a pas de nom`);
    const nom = theme.nom.trim();
    if (noms.has(nom)) echec(`le thème « ${nom} » est en double`);
    noms.add(nom);
    if (!Array.isArray(theme.questions) || theme.questions.length !== valeurs.length) {
      echec(`le thème « ${nom} » doit avoir ${valeurs.length} questions, une par valeur`);
    }
    const questions = theme.questions.map((entree, niveau) => {
      const lieu = `le thème « ${nom} », question ${niveau + 1}`;
      if (!estObjet(entree) || !texte(entree.question)) echec(`${lieu} n'a pas de question`);
      if (entree.reponse !== undefined && entree.reponse !== null && !texte(entree.reponse)) echec(`${lieu} a une réponse vide`);
      if (entree.accepte !== undefined && (!Array.isArray(entree.accepte) || !entree.accepte.every(texte))) {
        echec(`${lieu} : accepte doit lister des textes`);
      }
      const reponse = texte(entree.reponse) ? entree.reponse.trim() : null;
      const accepte = Array.isArray(entree.accepte) ? (entree.accepte as string[]).map((variante) => variante.trim()) : [];
      for (const candidat of [reponse, ...accepte]) {
        if (candidat && reponseChiffree(candidat)) echec(`${lieu} attend un chiffre ou une date (« ${candidat} »), ce qui est interdit`);
      }
      return { question: entree.question.trim(), reponse, accepte };
    });
    return { nom, questions };
  });
  return { valeurs, penaliteMauvaiseReponse: penalite, themes };
}
