import fs from 'node:fs';
import path from 'node:path';
import { validerCatalogue, validerPoker, type CatalogueMiniJeux, type ConfigPoker } from '../shared/mini-jeux';
import { validerTopTen, type ConfigTopTen } from '../shared/topten';
import { validerJeopardy, type ConfigJeopardy } from '../shared/jeopardy';
import { validerUndercover, type ConfigUndercover } from '../shared/undercover';

const catalogues = new Map<string, CatalogueMiniJeux>();
const pokers = new Map<string, ConfigPoker>();
const toptens = new Map<string, ConfigTopTen>();
const jeopardys = new Map<string, ConfigJeopardy>();
const undercovers = new Map<string, ConfigUndercover>();

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

function lireFichier<T>(cache: Map<string, T>, racine: string, nom: string, valider: (brut: unknown) => T): T {
  const deja = cache.get(racine);
  if (deja) return deja;
  let brut: unknown;
  try {
    brut = JSON.parse(fs.readFileSync(path.join(racine, 'config', nom), 'utf8'));
  } catch (erreur) {
    const detail = erreur instanceof Error ? erreur.message : String(erreur);
    throw new Error(`${nom} illisible : ${detail}`);
  }
  const config = valider(brut);
  cache.set(racine, config);
  return config;
}

export function lireJeopardy(racine: string): ConfigJeopardy {
  return lireFichier(jeopardys, racine, 'jeopardy.json', validerJeopardy);
}

export function lireUndercover(racine: string): ConfigUndercover {
  return lireFichier(undercovers, racine, 'undercover.json', validerUndercover);
}

export function lireTopTen(racine: string): ConfigTopTen {
  const deja = toptens.get(racine);
  if (deja) return deja;
  const fichier = path.join(racine, 'config', 'topten.json');
  let brut: unknown;
  try {
    brut = JSON.parse(fs.readFileSync(fichier, 'utf8'));
  } catch (erreur) {
    const detail = erreur instanceof Error ? erreur.message : String(erreur);
    throw new Error(`topten.json illisible : ${detail}`);
  }
  const config = validerTopTen(brut);
  toptens.set(racine, config);
  return config;
}
