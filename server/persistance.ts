import fs from 'node:fs';
import path from 'node:path';
import { LIMITE_SAUVEGARDES } from '../shared/constantes';
import type { DonneesPersistees } from './fusion';
import { donneesInitiales, lireDonnees } from './fusion';

export type Persistance = {
  source: string;
  ecrire: (donnees: DonneesPersistees) => void;
  flush: () => Promise<void>;
  fermer: () => void;
};

async function ecrireAtomique(fichier: string, contenu: string): Promise<void> {
  await fs.promises.mkdir(path.dirname(fichier), { recursive: true });
  let derniere: unknown;
  for (let essai = 0; essai < 5; essai += 1) {
    const temporaire = `${fichier}.${process.pid}.${Date.now()}.${essai}.tmp`;
    try {
      await fs.promises.writeFile(temporaire, contenu, 'utf8');
      try {
        await fs.promises.rename(temporaire, fichier);
      } catch {
        await fs.promises.copyFile(temporaire, fichier);
      }
      await fs.promises.rm(temporaire, { force: true });
      return;
    } catch (erreur) {
      derniere = erreur;
      await fs.promises.rm(temporaire, { force: true }).catch(() => undefined);
      await new Promise((resoudre) => setTimeout(resoudre, 20 * (essai + 1)));
    }
  }
  throw derniere;
}

function sauvegarderCopie(dossier: string, donnees: DonneesPersistees): void {
  const dossierSauvegardes = path.join(dossier, 'sauvegardes');
  fs.mkdirSync(dossierSauvegardes, { recursive: true });
  const nom = `etat-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const fichier = path.join(dossierSauvegardes, nom);
  fs.writeFileSync(fichier, JSON.stringify(donnees), 'utf8');
  const fichiers = fs
    .readdirSync(dossierSauvegardes)
    .filter((entree) => entree.endsWith('.json'))
    .map((entree) => {
      const chemin = path.join(dossierSauvegardes, entree);
      return { chemin, mtime: fs.statSync(chemin).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
  for (const ancien of fichiers.slice(LIMITE_SAUVEGARDES)) {
    fs.rmSync(ancien.chemin, { force: true });
  }
}

function chargerDepuis(dossier: string, titre: string): { donnees: DonneesPersistees; source: string } {
  const principal = path.join(dossier, 'etat.json');
  if (fs.existsSync(principal)) {
    try {
      return { donnees: lireDonnees(fs.readFileSync(principal, 'utf8'), titre), source: principal };
    } catch (erreur) {
      const secours = chercherSauvegarde(dossier, titre);
      if (secours) return secours;
      const quarantaine = `${principal}.illisible`;
      fs.rmSync(quarantaine, { force: true });
      fs.renameSync(principal, quarantaine);
      console.error('etat.json illisible, mis de côté :', quarantaine, erreur);
      return { donnees: donneesInitiales(titre), source: 'état initial (etat.json illisible)' };
    }
  }
  return { donnees: donneesInitiales(titre), source: 'état initial' };
}

function chercherSauvegarde(dossier: string, titre: string): { donnees: DonneesPersistees; source: string } | null {
  const dossierSauvegardes = path.join(dossier, 'sauvegardes');
  if (!fs.existsSync(dossierSauvegardes)) return null;
  const fichiers = fs
    .readdirSync(dossierSauvegardes)
    .filter((entree) => entree.endsWith('.json'))
    .map((entree) => {
      const chemin = path.join(dossierSauvegardes, entree);
      return { chemin, mtime: fs.statSync(chemin).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
  for (const fichier of fichiers) {
    try {
      return {
        donnees: lireDonnees(fs.readFileSync(fichier.chemin, 'utf8'), titre),
        source: `${fichier.chemin} (etat.json illisible)`,
      };
    } catch {
      continue;
    }
  }
  return null;
}

export function creerPersistance(
  dossier: string,
  titre: string,
  options: { sauvegardesAuto: boolean; intervalleMs: number },
): { persistance: Persistance; donnees: DonneesPersistees } {
  fs.mkdirSync(dossier, { recursive: true });
  const charge = chargerDepuis(dossier, titre);
  let dernier: DonneesPersistees = charge.donnees;
  let attente: DonneesPersistees | null = null;
  let chaine: Promise<void> = Promise.resolve();
  const fichier = path.join(dossier, 'etat.json');

  const ecrire = (donnees: DonneesPersistees) => {
    dernier = donnees;
    attente = donnees;
    chaine = chaine
      .then(async () => {
        while (attente) {
          const actuel = attente;
          attente = null;
          await ecrireAtomique(fichier, JSON.stringify(actuel));
        }
      })
      .catch((erreur: unknown) => {
        console.error('Écriture de l\'état impossible', erreur);
      });
  };

  const minuteur = options.sauvegardesAuto
    ? setInterval(() => {
        try {
          sauvegarderCopie(dossier, dernier);
        } catch (erreur) {
          console.error('Sauvegarde périodique impossible', erreur);
        }
      }, options.intervalleMs)
    : null;
  minuteur?.unref();

  return {
    donnees: charge.donnees,
    persistance: {
      source: charge.source,
      ecrire,
      flush: () => chaine,
      fermer: () => {
        if (minuteur) clearInterval(minuteur);
      },
    },
  };
}
