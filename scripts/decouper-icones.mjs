import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dossierIcones = path.join(racine, 'client', 'public', 'assets', 'icones');
const fichierListe = path.join(racine, 'shared', 'icones.ts');
const plancheControle = path.join(racine, 'test-results', 'icones', 'verification.png');
const DEBORDEMENT_MAX = 40;
const COTE_ICONE = 64;
/** Le dessin tient dans 56 px : 4 px de marge de chaque côté, pour rentrer dans les cadres. */
const BORD_CADRE = 4;

const PLANCHES = [
  {
    fichier: path.join(racine, 'docs', 'ressources', 'planche-1.png'),
    colonnes: 6,
    rangees: 4,
    noms: [
      'perso-carpe', 'perso-verre-eau', 'perso-piment', 'perso-planete', 'perso-appareil-photo', 'perso-chocolatine',
      'perso-sac-rando', 'perso-cerveau', 'case-bonus', 'case-chance', 'case-cagnotte', 'case-duel',
      'case-depart', 'case-arrivee', 'gp-piece', 'de', 'couronne', 'trophee',
      'cadeau', 'sablier', 'buzzer', 'ping-pong', 'poker', 'enveloppe',
    ],
  },
  {
    fichier: path.join(racine, 'docs', 'ressources', 'planche-2.png'),
    colonnes: 4,
    rangees: 4,
    noms: [
      'pouvoir-double', 'pouvoir-pari', 'pouvoir-assurance', 'pouvoir-tout-ou-rien',
      'trophee-malchanceux', 'trophee-dernier-pingpong', 'trophee-genereux', 'trophee-prudent',
      'trophee-audacieux', 'trophee-touriste', 'medaille', 'confettis',
      'manette', 'musique', 'megaphone', 'masques',
    ],
  },
  {
    fichier: path.join(racine, 'docs', 'ressources', 'planche-3.png'),
    colonnes: 6,
    rangees: 4,
    noms: [
      'roue', 'chat-noir', 'de-dore', 'super-de', 'machine-a-sous', 'sac-argent',
      'botte-ailee', 'ressort', 'tirelire', 'fleche-doree', 'fleche-retour', 'parchemin-pacte',
      'peau-banane', 'eboulement', 'poche-trouee', 'masque-voleur', 'chopes', 'panneau-casse',
      'fleche-montante', 'couronne-flammes', 'manette-cassee', 'ecrevisse', 'podium', 'deguisement',
    ],
  },
  {
    fichier: path.join(racine, 'docs', 'ressources', 'planche-4.png'),
    colonnes: 3,
    rangees: 2,
    noms: [
      'codenames', 'ampoule', 'gobelet-des',
      'crane', 'croix', 'casquette-capitaine',
    ],
  },
];

const LOGO_SOURCE = path.join(racine, 'docs', 'ressources', 'logo.png');
const LOGO_CIBLE = path.join(racine, 'client', 'public', 'assets', 'logo.png');
const NOMBRE_ICONES = 70;
const GLYPHES = {
  a: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  b: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  c: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  d: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  e: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  f: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  g: ['01110', '10001', '10000', '10111', '10001', '10001', '01110'],
  h: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  i: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  j: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  k: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  l: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  m: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  n: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  o: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  p: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  r: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  s: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  t: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  u: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  v: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  w: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  x: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['10010', '10010', '10010', '11111', '00010', '00010', '00010'],
  '5': ['11111', '10000', '10000', '11110', '00001', '00001', '11110'],
  '6': ['01110', '10000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
};

function echec(message) {
  throw new Error(message);
}

function attendre(ms) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) {
    /* Le disque Windows peut garder un PNG verrouillé juste après l'écriture. */
  }
}

function ecrireFichier(fichier, contenu) {
  let dernier;
  for (let essai = 0; essai < 12; essai += 1) {
    try {
      fs.writeFileSync(fichier, contenu);
      return;
    } catch (erreur) {
      const code = erreur && erreur.code;
      if (code !== 'UNKNOWN' && code !== 'EBUSY' && code !== 'EPERM') throw erreur;
      dernier = erreur;
      attendre(250 * (essai + 1));
    }
  }
  throw dernier;
}

function index(largeur, x, y) {
  return (largeur * y + x) * 4;
}

function estMagenta(r, g, b) {
  return r > 180 && b > 180 && g < 120;
}

function estHalo(r, g, b) {
  return r > g + 28 && b > g + 28 && Math.abs(r - b) < 36;
}

function preparerPlanche(source) {
  const image = new PNG({ width: source.width, height: source.height });
  image.data.set(source.data);
  for (let i = 0; i < image.data.length; i += 4) {
    const r = image.data[i] ?? 0;
    const g = image.data[i + 1] ?? 0;
    const b = image.data[i + 2] ?? 0;
    if (estMagenta(r, g, b)) {
      image.data[i + 3] = 0;
      continue;
    }
    if (estHalo(r, g, b)) {
      image.data[i] = g;
      image.data[i + 2] = g;
    }
  }
  return image;
}

function opaque(image, x, y) {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return false;
  return (image.data[index(image.width, x, y) + 3] ?? 0) > 0;
}

function composant(image, sx, sy, vu) {
  const pile = [[sx, sy]];
  vu[sy * image.width + sx] = 1;
  const pixels = [];
  let minX = sx;
  let minY = sy;
  let maxX = sx;
  let maxY = sy;
  while (pile.length > 0) {
    const point = pile.pop();
    if (!point) break;
    const [x, y] = point;
    pixels.push(x, y);
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      const cle = ny * image.width + nx;
      if (!opaque(image, nx, ny) || vu[cle]) continue;
      vu[cle] = 1;
      pile.push([nx, ny]);
    }
  }
  return { pixels, minX, minY, maxX, maxY };
}

function graine(image, x0, y0, largeur, hauteur, vu) {
  const cx = x0 + Math.floor(largeur / 2);
  const cy = y0 + Math.floor(hauteur / 2);
  const portee = Math.max(largeur, hauteur);
  for (let rayon = 0; rayon <= portee; rayon += 1) {
    for (let y = cy - rayon; y <= cy + rayon; y += 1) {
      for (let x = cx - rayon; x <= cx + rayon; x += 1) {
        if (x < x0 || y < y0 || x >= x0 + largeur || y >= y0 + hauteur) continue;
        if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) !== rayon) continue;
        if (!opaque(image, x, y) || vu[y * image.width + x]) continue;
        return [x, y];
      }
    }
  }
  return null;
}

function extraire(image, minX, minY, maxX, maxY) {
  const largeur = maxX - minX + 1;
  const hauteur = maxY - minY + 1;
  const sortie = new PNG({ width: largeur, height: hauteur });
  for (let y = 0; y < hauteur; y += 1) {
    for (let x = 0; x < largeur; x += 1) {
      const source = index(image.width, minX + x, minY + y);
      const cible = index(largeur, x, y);
      sortie.data[cible] = image.data[source] ?? 0;
      sortie.data[cible + 1] = image.data[source + 1] ?? 0;
      sortie.data[cible + 2] = image.data[source + 2] ?? 0;
      sortie.data[cible + 3] = image.data[source + 3] ?? 0;
    }
  }
  return sortie;
}

function cleCouleur(data, i) {
  return `${data[i]},${data[i + 1]},${data[i + 2]},${data[i + 3]}`;
}

function facteurPixel(image) {
  const candidats = [];
  const limite = Math.min(image.width, image.height);
  for (let facteur = limite; facteur >= 2; facteur -= 1) {
    if (image.width % facteur === 0 && image.height % facteur === 0) candidats.push(facteur);
  }
  for (const facteur of candidats) {
    const colonnes = image.width / facteur;
    const rangees = image.height / facteur;
    const blocs = colonnes * rangees;
    let impurs = 0;
    for (let by = 0; by < rangees; by += 1) {
      for (let bx = 0; bx < colonnes; bx += 1) {
        const comptes = new Map();
        for (let y = 0; y < facteur; y += 1) {
          for (let x = 0; x < facteur; x += 1) {
            const cle = cleCouleur(image.data, index(image.width, bx * facteur + x, by * facteur + y));
            comptes.set(cle, (comptes.get(cle) ?? 0) + 1);
          }
        }
        let max = 0;
        for (const nombre of comptes.values()) if (nombre > max) max = nombre;
        if (max < facteur * facteur * 0.9) impurs += 1;
      }
    }
    if (impurs / blocs <= 0.1) return facteur;
  }
  return 0;
}

function reduire(image, facteur) {
  const largeur = image.width / facteur;
  const hauteur = image.height / facteur;
  const sortie = new PNG({ width: largeur, height: hauteur });
  for (let by = 0; by < hauteur; by += 1) {
    for (let bx = 0; bx < largeur; bx += 1) {
      const comptes = new Map();
      for (let y = 0; y < facteur; y += 1) {
        for (let x = 0; x < facteur; x += 1) {
          const i = index(image.width, bx * facteur + x, by * facteur + y);
          const cle = cleCouleur(image.data, i);
          const entree = comptes.get(cle) ?? {
            n: 0,
            r: image.data[i],
            g: image.data[i + 1],
            b: image.data[i + 2],
            a: image.data[i + 3],
          };
          entree.n += 1;
          comptes.set(cle, entree);
        }
      }
      let gagnant = null;
      for (const entree of comptes.values()) {
        if (!gagnant || entree.n > gagnant.n) gagnant = entree;
      }
      const i = index(largeur, bx, by);
      sortie.data[i] = gagnant?.r ?? 0;
      sortie.data[i + 1] = gagnant?.g ?? 0;
      sortie.data[i + 2] = gagnant?.b ?? 0;
      sortie.data[i + 3] = gagnant?.a ?? 0;
    }
  }
  return sortie;
}

function marge(image, bord) {
  const sortie = new PNG({ width: image.width + bord * 2, height: image.height + bord * 2 });
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const source = index(image.width, x, y);
      const cible = index(sortie.width, x + bord, y + bord);
      sortie.data[cible] = image.data[source] ?? 0;
      sortie.data[cible + 1] = image.data[source + 1] ?? 0;
      sortie.data[cible + 2] = image.data[source + 2] ?? 0;
      sortie.data[cible + 3] = image.data[source + 3] ?? 0;
    }
  }
  return sortie;
}

function versCarre(image, cote) {
  const sortie = new PNG({ width: cote, height: cote });
  const echelle = cote / Math.max(image.width, image.height);
  const largeur = Math.max(1, Math.round(image.width * echelle));
  const hauteur = Math.max(1, Math.round(image.height * echelle));
  const ox = Math.floor((cote - largeur) / 2);
  const oy = Math.floor((cote - hauteur) / 2);
  for (let y = 0; y < hauteur; y += 1) {
    for (let x = 0; x < largeur; x += 1) {
      const sx = Math.min(image.width - 1, Math.round(((x + 0.5) * image.width) / largeur - 0.5));
      const sy = Math.min(image.height - 1, Math.round(((y + 0.5) * image.height) / hauteur - 0.5));
      const source = index(image.width, sx, sy);
      const cible = index(cote, ox + x, oy + y);
      sortie.data[cible] = image.data[source] ?? 0;
      sortie.data[cible + 1] = image.data[source + 1] ?? 0;
      sortie.data[cible + 2] = image.data[source + 2] ?? 0;
      sortie.data[cible + 3] = image.data[source + 3] ?? 0;
    }
  }
  return sortie;
}

function decouperPlanche(planche) {
  if (!fs.existsSync(planche.fichier)) echec(`Planche introuvable : ${planche.fichier}`);
  const source = PNG.sync.read(fs.readFileSync(planche.fichier));
  const caseL = Math.floor(source.width / planche.colonnes);
  const caseH = Math.floor(source.height / planche.rangees);
  if (caseL < 8 || caseH < 8) {
    echec(`${path.basename(planche.fichier)} est trop petite pour une grille ${planche.colonnes}×${planche.rangees}`);
  }
  const attendu = planche.colonnes * planche.rangees;
  if (planche.noms.length !== attendu) {
    echec(`${path.basename(planche.fichier)} : ${planche.noms.length} noms pour ${attendu} cases`);
  }
  const image = preparerPlanche(source);
  const vu = new Uint8Array(image.width * image.height);
  const sprites = [];
  const replis = [];
  const touches = [];
  planche.noms.forEach((nom, position) => {
    const colonne = position % planche.colonnes;
    const rangee = Math.floor(position / planche.colonnes);
    const x0 = colonne * caseL;
    const y0 = rangee * caseH;
    const depart = graine(image, x0, y0, caseL, caseH, vu);
    if (!depart) echec(`${nom} est une case vide`);
    const forme = composant(image, depart[0], depart[1], vu);
    const debord = Math.max(x0 - forme.minX, y0 - forme.minY, forme.maxX - (x0 + caseL - 1), forme.maxY - (y0 + caseH - 1), 0);
    if (debord > DEBORDEMENT_MAX) {
      echec(`${nom} déborde de sa case de ${debord} px : la grille ne tombe pas sur les icônes`);
    }
    const touche = forme.pixels.some((_, i) => {
      if (i % 2 !== 0) return false;
      const x = forme.pixels[i];
      const y = forme.pixels[i + 1];
      return x === x0 || y === y0 || x === x0 + caseL - 1 || y === y0 + caseH - 1;
    });
    if (touche && debord === 0) touches.push(nom);
    const contenu = extraire(image, forme.minX, forme.minY, forme.maxX, forme.maxY);
    const facteur = facteurPixel(contenu);
    let sprite;
    if (facteur >= 2) {
      sprite = marge(reduire(contenu, facteur), 2);
    } else {
      replis.push(nom);
      sprite = marge(versCarre(contenu, COTE_ICONE - BORD_CADRE * 2), BORD_CADRE);
    }
    sprites.push({ nom, sprite, taille: sprite.width });
  });
  if (sprites.length !== attendu) {
    echec(`${path.basename(planche.fichier)} : ${sprites.length} icônes au lieu de ${attendu}`);
  }
  if (touches.length > 0) {
    console.warn(`${path.basename(planche.fichier)} : ${touches.join(', ')} touchent le bord de leur case, le sprite reste entier`);
  }
  return { sprites, replis };
}

function ecrireListe(sprites) {
  const lignes = sprites.map((sprite) => `  '${sprite.nom}': ${sprite.taille},`).join('\n');
  const contenu = `// Généré par scripts/decouper-icones.mjs — ne pas modifier à la main.

export const TAILLES_ICONES = {
${lignes}
} as const;

export type NomIcone = keyof typeof TAILLES_ICONES;

export const NOMS_ICONES = Object.keys(TAILLES_ICONES) as NomIcone[];
`;
  ecrireFichier(fichierListe, contenu);
}

function pixel(image, x, y, r, g, b) {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return;
  const i = index(image.width, x, y);
  image.data[i] = r;
  image.data[i + 1] = g;
  image.data[i + 2] = b;
  image.data[i + 3] = 255;
}

function dessinerTexte(image, texte, x, y) {
  let curseur = x;
  for (const caractere of texte) {
    const glyphe = GLYPHES[caractere] ?? GLYPHES['-'];
    if (!glyphe) continue;
    for (let ligne = 0; ligne < glyphe.length; ligne += 1) {
      const rangee = glyphe[ligne] ?? '';
      for (let colonne = 0; colonne < rangee.length; colonne += 1) {
        if (rangee[colonne] === '1') pixel(image, curseur + colonne, y + ligne, 255, 244, 220);
      }
    }
    curseur += 6;
  }
}

function plancheDeControle(sprites) {
  const colonnes = 8;
  const caseL = 220;
  const caseH = 110;
  const rangees = Math.ceil(sprites.length / colonnes);
  const image = new PNG({ width: colonnes * caseL, height: rangees * caseH });
  for (let i = 0; i < image.data.length; i += 4) {
    image.data[i] = 7;
    image.data[i + 1] = 20;
    image.data[i + 2] = 51;
    image.data[i + 3] = 255;
  }
  sprites.forEach((entree, position) => {
    const colonne = position % colonnes;
    const rangee = Math.floor(position / colonnes);
    const echelle = Math.min(3, Math.floor(72 / entree.sprite.width));
    const zoom = Math.max(1, echelle);
    const ox = colonne * caseL + Math.floor((caseL - entree.sprite.width * zoom) / 2);
    const oy = rangee * caseH + 8;
    for (let y = 0; y < entree.sprite.height; y += 1) {
      for (let x = 0; x < entree.sprite.width; x += 1) {
        const source = index(entree.sprite.width, x, y);
        const alpha = entree.sprite.data[source + 3] ?? 0;
        if (alpha === 0) continue;
        const r = entree.sprite.data[source] ?? 0;
        const g = entree.sprite.data[source + 1] ?? 0;
        const b = entree.sprite.data[source + 2] ?? 0;
        for (let dy = 0; dy < zoom; dy += 1) {
          for (let dx = 0; dx < zoom; dx += 1) pixel(image, ox + x * zoom + dx, oy + y * zoom + dy, r, g, b);
        }
      }
    }
    dessinerTexte(image, entree.nom, colonne * caseL + 8, rangee * caseH + caseH - 14);
  });
  fs.mkdirSync(path.dirname(plancheControle), { recursive: true });
  ecrireFichier(plancheControle, PNG.sync.write(image));
}

function borneOpaque(image) {
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if ((image.data[index(image.width, x, y) + 3] ?? 0) === 0) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) echec('Le logo est entièrement transparent après nettoyage');
  return { minX, minY, maxX, maxY };
}

export function traiterLogo() {
  if (!fs.existsSync(LOGO_SOURCE)) echec(`Logo introuvable : ${LOGO_SOURCE}`);
  const source = PNG.sync.read(fs.readFileSync(LOGO_SOURCE));
  const nettoye = preparerPlanche(source);
  const borne = borneOpaque(nettoye);
  let sprite = extraire(nettoye, borne.minX, borne.minY, borne.maxX, borne.maxY);
  const facteur = facteurPixel(sprite);
  if (facteur >= 2) sprite = reduire(sprite, facteur);
  fs.mkdirSync(path.dirname(LOGO_CIBLE), { recursive: true });
  ecrireFichier(LOGO_CIBLE, PNG.sync.write(sprite));
  return { largeur: sprite.width, hauteur: sprite.height, facteur };
}

export function decouperIcones() {
  fs.mkdirSync(dossierIcones, { recursive: true });
  const sprites = [];
  const replis = [];
  for (const planche of PLANCHES) {
    const resultat = decouperPlanche(planche);
    sprites.push(...resultat.sprites);
    replis.push(...resultat.replis);
  }
  if (sprites.length !== NOMBRE_ICONES) echec(`${sprites.length} icônes au lieu de ${NOMBRE_ICONES}`);
  const noms = new Set(sprites.map((sprite) => sprite.nom));
  if (noms.size !== sprites.length) echec('Deux icônes portent le même nom');
  for (const entree of fs.readdirSync(dossierIcones)) {
    if (entree.endsWith('.png') && !noms.has(entree.replace(/\.png$/, ''))) {
      fs.rmSync(path.join(dossierIcones, entree));
    }
  }
  for (const entree of sprites) {
    ecrireFichier(path.join(dossierIcones, `${entree.nom}.png`), PNG.sync.write(entree.sprite));
  }
  ecrireListe(sprites);
  plancheDeControle(sprites);
  const logo = traiterLogo();
  if (replis.length > 0) {
    console.warn(`Facteur de pixel introuvable (tolérance 10 %) : réduction au plus proche vers 64×64 pour ${replis.join(', ')}`);
  }
  console.log(`Logo ${logo.largeur}×${logo.hauteur} (facteur ${logo.facteur || 'aucun'}) → assets/logo.png`);
  return sprites.map((entree) => entree.nom);
}

const lanceDirectement = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (lanceDirectement) {
  const noms = decouperIcones();
  console.log(`${noms.length} icônes écrites dans client/public/assets/icones`);
}
