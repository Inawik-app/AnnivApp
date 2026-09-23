import fs from 'node:fs';
import path from 'node:path';
import { validerCatalogue, validerPoker, type CatalogueMiniJeux, type ConfigPoker } from '../shared/mini-jeux';

const catalogues = new Map<string, CatalogueMiniJeux>();
const pokers = new Map<string, ConfigPoker>();

export function lireCatalogue(racine: string): CatalogueMiniJeux {
  const deja = catalogues.get(racine);
  if (deja) return deja;
  const fichier = path.join(racine, 'config', 'mini-jeux.json');
  let brut: unknown;
  try {
    brut = JSON.parse(fs.readFileSync(fichier, 'utf8'));
  } catch (erreur) {
    const detail = erreur instanceof Error ? erreur.message : String(erreur);
    throw new Error(`mini-jeux.json illisible : ${detail}`);
  }
  const catalogue = validerCatalogue(brut);
  catalogues.set(racine, catalogue);
  return catalogue;
}

export function lirePoker(racine: string): ConfigPoker {
  const deja = pokers.get(racine);
  if (deja) return deja;
  const fichier = path.join(racine, 'config', 'poker.json');
  let brut: unknown;
  try {
    brut = JSON.parse(fs.readFileSync(fichier, 'utf8'));
  } catch (erreur) {
    const detail = erreur instanceof Error ? erreur.message : String(erreur);
    throw new Error(`poker.json illisible : ${detail}`);
  }
  const config = validerPoker(brut);
  pokers.set(racine, config);
  return config;
}
