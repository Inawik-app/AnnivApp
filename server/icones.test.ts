import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { verifierIconesConfig } from './icones-config';

const racine = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dossier = path.join(racine, 'client', 'public', 'assets', 'icones');
const logo = path.join(racine, 'client', 'public', 'assets', 'logo.png');

function nomsGeneres(): string[] {
  const liste = fs.readFileSync(path.join(racine, 'shared', 'icones.ts'), 'utf8');
  return [...liste.matchAll(/'([a-z0-9-]+)':/g)].map((correspondance) => correspondance[1] ?? '');
}

describe('découpage des icônes', () => {
  it('produit 70 fichiers, le logo, et shared/icones.ts les liste tous', () => {
    execFileSync(process.execPath, ['scripts/decouper-icones.mjs'], { cwd: racine, stdio: 'pipe' });
    const fichiers = fs.readdirSync(dossier).filter((nom) => nom.endsWith('.png')).sort();
    expect(fichiers).toHaveLength(70);
    expect(fs.existsSync(logo)).toBe(true);
    expect(fs.statSync(logo).size).toBeGreaterThan(0);
    const noms = nomsGeneres();
    expect(noms).toHaveLength(70);
    for (const fichier of fichiers) {
      expect(noms).toContain(fichier.replace(/\.png$/, ''));
      expect(fs.statSync(path.join(dossier, fichier)).size).toBeGreaterThan(0);
    }
    for (const nom of [
      'roue',
      'chat-noir',
      'de-dore',
      'super-de',
      'podium',
      'deguisement',
      'codenames',
      'ampoule',
      'gobelet-des',
      'crane',
      'croix',
      'casquette-capitaine',
    ]) {
      expect(noms).toContain(nom);
    }
    expect(verifierIconesConfig(racine, new Set(noms))).toEqual([]);
    execFileSync(process.execPath, ['scripts/decouper-icones.mjs'], { cwd: racine, stdio: 'pipe' });
    expect(fs.readdirSync(dossier).filter((nom) => nom.endsWith('.png'))).toHaveLength(70);
    expect(fs.existsSync(logo)).toBe(true);
  }, 30000);

  it('signale une icône inconnue avec le fichier, l’élément et le nom', () => {
    const temporaire = fs.mkdtempSync(path.join(os.tmpdir(), 'gp-icones-'));
    try {
      fs.mkdirSync(path.join(temporaire, 'config'));
      fs.writeFileSync(
        path.join(temporaire, 'config', 'mini-jeux.json'),
        JSON.stringify({ baremes: { classement: [1], equipes: { gagnant: 1, perdant: 0 } }, jeux: [{ id: 'x', nom: 'X', resume: 'x', icone: 'icone-fantome', regles: ['a', 'b', 'c'], saisie: 'libre', module: 'aucun', hoteParticipe: false }] }),
        'utf8',
      );
      const erreurs = verifierIconesConfig(temporaire, new Set(['poker']));
      expect(erreurs.some((ligne) => ligne.includes('icone-fantome'))).toBe(true);
    } finally {
      fs.rmSync(temporaire, { recursive: true, force: true });
    }
  });
});
