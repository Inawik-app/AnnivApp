import os from 'node:os';

export type CarteReseau = {
  nom: string;
  adresse: string;
  interne: boolean;
  famille: string;
};

const EXCLUSIONS = [/vethernet/i, /wsl/i, /hyper-?v/i, /virtualbox/i, /vmware/i, /\bvpn\b/i];

export function estCarteVirtuelle(nom: string): boolean {
  return EXCLUSIONS.some((motif) => motif.test(nom));
}

function score(adresse: string): number {
  if (adresse.startsWith('192.168.')) return 0;
  if (adresse.startsWith('10.')) return 1;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(adresse)) return 2;
  return 3;
}

export function choisirIp(
  cartes: CarteReseau[],
  ipForcee: string | null,
): { retenue: string; autres: string[] } {
  const ipv4 = cartes.filter((carte) => {
    const famille = String(carte.famille);
    return (famille === 'IPv4' || famille === '4') && !carte.interne && carte.adresse !== '127.0.0.1';
  });
  const propres = ipv4.filter((carte) => !estCarteVirtuelle(carte.nom));
  const base = propres.length > 0 ? propres : ipv4;
  const adresses = [...new Set(base.map((carte) => carte.adresse))].sort(
    (a, b) => score(a) - score(b) || a.localeCompare(b),
  );
  const retenue = ipForcee?.trim() ? ipForcee.trim() : (adresses[0] ?? '127.0.0.1');
  return { retenue, autres: adresses.filter((adresse) => adresse !== retenue) };
}

export function listerCartes(): CarteReseau[] {
  const cartes: CarteReseau[] = [];
  for (const [nom, adresses] of Object.entries(os.networkInterfaces())) {
    for (const adresse of adresses ?? []) {
      cartes.push({
        nom,
        adresse: adresse.address,
        interne: adresse.internal,
        famille: String(adresse.family),
      });
    }
  }
  return cartes;
}
