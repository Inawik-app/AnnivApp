import fs from 'node:fs';
import path from 'node:path';
import { NOMS_ICONES } from '../shared/icones';

function estObjet(valeur: unknown): valeur is Record<string, unknown> {
  return !!valeur && typeof valeur === 'object' && !Array.isArray(valeur);
}

function elementDe(objet: Record<string, unknown>, chemin: string): string {
  if (typeof objet.id === 'string' && objet.id.trim() !== '') return objet.id;
  if (typeof objet.titre === 'string' && objet.titre.trim() !== '') return objet.titre;
  if (typeof objet.nom === 'string' && objet.nom.trim() !== '') return objet.nom;
  const dernier = chemin.split('.').filter((morceau) => morceau !== '').pop();
  return dernier ?? chemin;
}

function collecter(valeur: unknown, fichier: string, chemin: string, messages: string[], connus: ReadonlySet<string>): void {
  if (Array.isArray(valeur)) {
    for (const entree of valeur) collecter(entree, fichier, chemin, messages, connus);
    return;
  }
  if (!estObjet(valeur)) return;
  const element = elementDe(valeur, chemin);
  for (const [cle, contenu] of Object.entries(valeur)) {
    if ((cle === 'icone' || cle.startsWith('icone')) && typeof contenu === 'string' && !connus.has(contenu)) {
      messages.push(`${fichier} : ${element} : icône « ${contenu} » inconnue`);
      continue;
    }
    const suite = chemin === '' ? cle : `${chemin}.${cle}`;
    collecter(contenu, fichier, suite, messages, connus);
  }
}

/** Chaque champ `icone` des JSON de `config/` doit nommer une icône découpée. */
export function verifierIconesConfig(racine: string, connus: ReadonlySet<string> = new Set(NOMS_ICONES)): string[] {
  const dossier = path.join(racine, 'config');
  const messages: string[] = [];
  const fichiers = fs.readdirSync(dossier).filter((nom) => nom.endsWith('.json')).sort();
  for (const nom of fichiers) {
    const brut: unknown = JSON.parse(fs.readFileSync(path.join(dossier, nom), 'utf8'));
    collecter(brut, `config/${nom}`, '', messages, connus);
  }
  messages.sort();
  return messages;
}
