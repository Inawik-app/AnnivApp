import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { demarrerServeur } from './demarrer';
import { configValide } from './fusion';

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

async function main(): Promise<void> {
  const config = configValide(JSON.parse(fs.readFileSync(path.join(RACINE, 'config', 'partie.json'), 'utf8')));
  const portDemande = Number(process.env.PORT);
  const port = Number.isInteger(portDemande) && portDemande > 0 && portDemande < 65536 ? portDemande : config.port;
  const dossierData = process.env.GP_DONNEES ? path.resolve(process.env.GP_DONNEES) : path.join(RACINE, 'data');
  await demarrerServeur({ port, dossierData });
}

main().catch((erreur: unknown) => {
  console.error(erreur);
  process.exit(1);
});
