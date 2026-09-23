import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const racine = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dossier = path.join(racine, 'client', 'public', 'assets', 'icones');

describe('découpage des icônes', () => {
  it('produit 40 fichiers et shared/icones.ts les liste tous', () => {
    execFileSync(process.execPath, ['scripts/decouper-icones.mjs'], { cwd: racine, stdio: 'pipe' });
    const fichiers = fs.readdirSync(dossier).filter((nom) => nom.endsWith('.png')).sort();
    expect(fichiers).toHaveLength(40);
    const liste = fs.readFileSync(path.join(racine, 'shared', 'icones.ts'), 'utf8');
    const noms = [...liste.matchAll(/'([a-z0-9-]+)':/g)].map((correspondance) => correspondance[1]);
    expect(noms).toHaveLength(40);
    for (const fichier of fichiers) {
      expect(noms).toContain(fichier.replace(/\.png$/, ''));
      expect(fs.statSync(path.join(dossier, fichier)).size).toBeGreaterThan(0);
    }
    execFileSync(process.execPath, ['scripts/decouper-icones.mjs'], { cwd: racine, stdio: 'pipe' });
    expect(fs.readdirSync(dossier).filter((nom) => nom.endsWith('.png'))).toHaveLength(40);
  }, 20000);
});
