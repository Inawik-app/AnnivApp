import { describe, expect, it } from 'vitest';
import type { EtatJeu } from '../shared/types';
import { etatInitial } from './etat-initial';
import { vueHote, vueJoueur, vueTv, type Presence } from './vues';

function aCle(valeur: unknown, cle: string): boolean {
  if (!valeur || typeof valeur !== 'object') return false;
  if (Object.prototype.hasOwnProperty.call(valeur, cle)) return true;
  const liste = Array.isArray(valeur) ? valeur : Object.values(valeur as Record<string, unknown>);
  return liste.some((item) => aCle(item, cle));
}

const presence: Presence = { enLigne: { mira: true }, latenceJoueur: {}, appareils: [] };

describe('vues', () => {
  it('cache les jetons, le code hôte, les GP masqués et les événements privés', () => {
    const base = etatInitial('GP Party');
    const etat: EtatJeu = {
      ...base,
      joueurs: [
        { id: 'mira', pseudo: 'Mira', avatar: 'soleil', couleur: '#e23d3d', rejointA: 1 },
        { id: 'lina', pseudo: 'Lina', avatar: 'feuille', couleur: '#1f9d55', rejointA: 2 },
      ],
      transactions: [
        {
          id: 'visible',
          joueurId: 'mira',
          montant: 5,
          source: 'manuel',
          libelle: 'Bonus public',
          horodatage: 1,
          masquee: false,
        },
        {
          id: 'secret',
          joueurId: 'mira',
          montant: 9,
          source: 'manuel',
          libelle: 'LIBELLE-MASQUE-UNIQUE',
          horodatage: 2,
          masquee: true,
        },
      ],
      evenements: [
        { id: 1, type: 'public', visibilite: 'public', libelle: 'PUBLIC-OK', donnees: {}, horodatage: 1 },
        { id: 2, type: 'hote', visibilite: 'hote', libelle: 'SECRET-HOTE', donnees: {}, horodatage: 2 },
        { id: 3, type: 'prive', visibilite: { joueurId: 'lina' }, libelle: 'SECRET-LINA', donnees: {}, horodatage: 3 },
        { id: 4, type: 'prive', visibilite: { joueurId: 'mira' }, libelle: 'SECRET-MIRA', donnees: {}, horodatage: 4 },
      ],
    };
    const pollue = Object.assign(etat, { codeHote: 'change-moi', jeton: 'jeton-secret-abc' });
    const tv = vueTv(pollue, presence, 10, 'dem', 'http://192.168.1.10:3000/joueur');
    const vueMira = vueJoueur(pollue, presence, 10, 'dem', 'mira');
    const hote = vueHote(
      pollue,
      presence,
      10,
      'dem',
      true,
      { ip: '192.168.1.10', port: 3000, autres: [], urlTv: '', urlJoueur: '', urlHote: '', urlDiag: '' },
      null,
      null,
    );

    for (const vue of [tv, vueMira]) {
      const texte = JSON.stringify(vue);
      expect(texte).not.toContain('LIBELLE-MASQUE-UNIQUE');
      expect(texte).not.toContain('SECRET-HOTE');
      expect(texte).not.toContain('SECRET-LINA');
      expect(texte).not.toContain('change-moi');
      expect(texte).not.toContain('jeton-secret-abc');
      expect(texte).not.toContain('"masquee":true');
      expect(aCle(vue, 'jeton')).toBe(false);
      expect(aCle(vue, 'codeHote')).toBe(false);
    }

    expect(JSON.stringify(vueMira)).toContain('SECRET-MIRA');
    expect(JSON.stringify(vueMira)).toContain('PUBLIC-OK');
    expect(JSON.stringify(tv)).not.toContain('SECRET-MIRA');
    expect(JSON.stringify(hote)).toContain('LIBELLE-MASQUE-UNIQUE');
    expect(JSON.stringify(hote)).toContain('SECRET-HOTE');
    expect(JSON.stringify(hote)).not.toContain('jeton-secret-abc');
    expect(aCle(hote, 'jeton')).toBe(false);
    expect(aCle(hote, 'codeHote')).toBe(false);
    expect(vueMira.moi?.gpVisibles).toBe(5);
    expect(hote.erreursConfig).toEqual([]);
  });

  it('garde l’ordre d’arrivée et calcule le rang à part', () => {
    const base = etatInitial('GP Party');
    const etat: EtatJeu = {
      ...base,
      joueurs: [
        { id: 'mira', pseudo: 'Mira', avatar: 'soleil', couleur: '#e23d3d', rejointA: 1 },
        { id: 'lina', pseudo: 'Lina', avatar: 'feuille', couleur: '#1f9d55', rejointA: 2 },
      ],
      transactions: [
        {
          id: 'bonus-lina',
          joueurId: 'lina',
          montant: 10,
          source: 'manuel',
          libelle: 'Bonus',
          horodatage: 1,
          masquee: false,
        },
      ],
    };
    const tv = vueTv(etat, presence, 10, 'dem', 'http://192.168.1.10:3000/joueur');
    expect(tv.joueurs.map((joueur) => joueur.id)).toEqual(['mira', 'lina']);
    expect(tv.joueurs.map((joueur) => joueur.place)).toEqual([2, 1]);
  });
});
