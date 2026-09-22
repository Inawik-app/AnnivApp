import { randomInt, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { nanoid } from 'nanoid';
import QRCode from 'qrcode';
import { Server, type Socket } from 'socket.io';
import { createServer as creerServeurVite, type ViteDevServer } from 'vite';
import { INTERVALLE_PING_MS } from '../shared/constantes';
import type {
  AppareilVue,
  DiagnosticTv,
  EtatJeu,
  EvenementsClient,
  EvenementsServeur,
  ReseauVue,
  TypeCase,
} from '../shared/types';
import { actionBot, delaiBot } from './bots';
import { configValide } from './fusion';
import { choisirIp, listerCartes } from './ip';
import { creerStore } from './store';
import { vueHote, vueJoueur, vueTv, type Presence } from './vues';

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const PAGES: Record<string, string> = {
  '/': 'index.html',
  '/tv': 'tv/index.html',
  '/joueur': 'joueur/index.html',
  '/hote': 'hote/index.html',
};

type SocketClient = Socket<EvenementsClient, EvenementsServeur>;

type Lien = {
  authentifie: boolean;
  role: 'tv' | 'joueur' | 'hote' | null;
  joueurId: string | null;
  latenceMs: number | null;
  decalageMs: number | null;
};

export type ConfigTest = {
  /** Valeurs de dé (1 à 6) consommées dans l'ordre. Le reste du hasard est figé. */
  desForces?: number[];
  /** Cases explicites, de la case 0 à l'arrivée. La longueur du plateau suit cette liste. */
  disposition?: TypeCase[];
};

export type OptionsDemarrage = {
  port: number;
  dossierData: string;
  config?: ConfigTest;
  /** Sert les pages. En test, laisser absent : le serveur ne fait alors que les sockets. */
  servirClient?: boolean;
};

export type ServeurJeu = {
  url: string;
  port: number;
  etat: () => EtatJeu;
  fermer: () => Promise<void>;
};

function codeIdentique(saisi: string, attendu: string): boolean {
  const gauche = Buffer.from(saisi);
  const droite = Buffer.from(attendu);
  if (gauche.length !== droite.length) return false;
  return timingSafeEqual(gauche, droite);
}

function lireDiagnostic(fichier: string): DiagnosticTv | null {
  try {
    const brut: unknown = JSON.parse(fs.readFileSync(fichier, 'utf8'));
    if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return null;
    return brut as DiagnosticTv;
  } catch {
    return null;
  }
}

function ecrireDiagnostic(fichier: string, diagnostic: DiagnosticTv): void {
  fs.mkdirSync(path.dirname(fichier), { recursive: true });
  const temporaire = `${fichier}.tmp`;
  fs.writeFileSync(temporaire, JSON.stringify(diagnostic), 'utf8');
  try {
    fs.renameSync(temporaire, fichier);
  } catch {
    fs.rmSync(fichier, { force: true });
    fs.renameSync(temporaire, fichier);
  }
}

/**
 * Hasard figé du mode test, hors dés.
 * Le mélange d'un paquet de 14 cartes place « cadeau » en dernière position, donc en première pioche.
 */
function aleaTest(max: number): number {
  if (max === 14) return 6;
  return 0;
}

export async function demarrerServeur(options: OptionsDemarrage): Promise<ServeurJeu> {
  const modeTest = options.config !== undefined;
  if (modeTest && process.env.NODE_ENV === 'production') {
    throw new Error('Les leviers de test sont impossibles en production');
  }
  const desForces = options.config?.desForces;
  if (desForces?.some((valeur) => !Number.isInteger(valeur) || valeur < 1 || valeur > 6)) {
    throw new Error('desForces ne contient que des valeurs de dé, de 1 à 6');
  }
  const partie = configValide(JSON.parse(fs.readFileSync(path.join(RACINE, 'config', 'partie.json'), 'utf8')));
  const devOutils = process.env.NODE_ENV !== 'production';
  const dev = devOutils && !modeTest;
  const idDemarrage = nanoid();
  const fichierDiagnostic = path.join(options.dossierData, 'diagnostic-tv.json');
  const reseauChoisi = choisirIp(listerCartes(), partie.ipForcee);
  const urlDe = (ip: string, chemin: string) => `http://${ip}:${options.port}${chemin}`;
  const reseau: ReseauVue = {
    ip: reseauChoisi.retenue,
    port: options.port,
    autres: reseauChoisi.autres,
    urlTv: urlDe(reseauChoisi.retenue, '/tv'),
    urlJoueur: urlDe(reseauChoisi.retenue, '/joueur'),
    urlHote: urlDe(reseauChoisi.retenue, '/hote'),
    urlDiag: urlDe(reseauChoisi.retenue, '/diag.html'),
  };

  const app = express();
  app.disable('x-powered-by');
  const httpServer = createServer(app);
  const io = new Server<EvenementsClient, EvenementsServeur>(httpServer);
  const liens = new Map<string, Lien>();
  const minuteurs = new Map<string, NodeJS.Timeout>();
  let diagnostic = lireDiagnostic(fichierDiagnostic);
  let diffusionPrevue: NodeJS.Timeout | null = null;
  let volumeSon = 0.8;
  let minuteurBots: NodeJS.Timeout | null = null;

  const store = creerStore({
    dossierData: options.dossierData,
    titre: partie.titre,
    nbJoueursMax: partie.nbJoueursMax,
    dev,
    test: modeTest,
    desForces,
    disposition: options.config?.disposition,
    alea: modeTest ? aleaTest : undefined,
    sauvegardesAuto: !modeTest,
    estEnLigne: (joueurId) => [...liens.values()].some((lien) => lien.authentifie && lien.joueurId === joueurId),
    socketVivant: (socketId) => io.sockets.sockets.has(socketId),
    notifier: (notification) => {
      const socket = io.sockets.sockets.get(notification.socketId);
      if (!socket) return;
      if (notification.type === 'repriseValidee') {
        const lien = liens.get(socket.id);
        if (lien) {
          lien.authentifie = true;
          lien.role = 'joueur';
          lien.joueurId = notification.joueurId;
          ranger(socket, lien);
        }
        socket.emit('repriseValidee', { jeton: notification.jeton, joueurId: notification.joueurId });
      } else {
        socket.emit('repriseRefusee', { joueurId: notification.joueurId });
      }
    },
  });

  const planifierBots = () => {
    if (minuteurBots) clearTimeout(minuteurBots);
    if (!dev) return;
    const etat = store.etat();
    if (!actionBot(etat, () => 0)) return;
    minuteurBots = setTimeout(() => {
      minuteurBots = null;
      const action = actionBot(store.etat(), (max) => randomInt(0, Math.max(1, max)));
      if (!action) return;
      const reponse = store.dispatch(action.action, action.origine);
      if (!reponse.ok) return;
      diffuser();
      planifierBots();
    }, delaiBot(etat));
    minuteurBots.unref();
  };

  const presence = (): Presence => {
    const enLigne: Record<string, boolean> = {};
    const latenceJoueur: Record<string, number | null> = {};
    const appareils: AppareilVue[] = [];
    const joueurs = store.etat().joueurs;
    for (const lien of liens.values()) {
      if (!lien.authentifie || !lien.role) continue;
      const pseudo = lien.joueurId ? (joueurs.find((joueur) => joueur.id === lien.joueurId)?.pseudo ?? null) : null;
      appareils.push({
        role: lien.role,
        joueurId: lien.joueurId,
        pseudo,
        latenceMs: lien.latenceMs,
        decalageMs: lien.decalageMs,
      });
      if (lien.joueurId) {
        enLigne[lien.joueurId] = true;
        latenceJoueur[lien.joueurId] = lien.latenceMs;
      }
    }
    return { enLigne, latenceJoueur, appareils };
  };

  const diffuser = () => {
    const etat = store.etat();
    const actuel = presence();
    const heure = Date.now();
    io.to('tv').emit('vue', vueTv(etat, actuel, heure, idDemarrage, reseau.urlJoueur, partie.nbJoueursMax, volumeSon));
    io.to('hote').emit(
      'vue',
      vueHote(etat, actuel, heure, idDemarrage, dev, reseau, diagnostic, store.libelleAnnulation(), volumeSon),
    );
    io.to('joueur:anonyme').emit('vue', vueJoueur(etat, actuel, heure, idDemarrage, null));
    for (const joueur of etat.joueurs) {
      io.to(`joueur:${joueur.id}`).emit('vue', vueJoueur(etat, actuel, heure, idDemarrage, joueur.id));
    }
  };

  const planifierDiffusion = () => {
    if (diffusionPrevue) return;
    diffusionPrevue = setTimeout(() => {
      diffusionPrevue = null;
      diffuser();
    }, 50);
    diffusionPrevue.unref();
  };

  const ranger = (socket: SocketClient, lien: Lien) => {
    for (const room of socket.rooms) {
      if (room !== socket.id) socket.leave(room);
    }
    if (lien.role === 'tv') socket.join('tv');
    else if (lien.role === 'hote') socket.join('hote');
    else if (lien.joueurId) socket.join(`joueur:${lien.joueurId}`);
    else socket.join('joueur:anonyme');
  };

  io.on('connection', (socket) => {
    liens.set(socket.id, {
      authentifie: false,
      role: null,
      joueurId: null,
      latenceMs: null,
      decalageMs: null,
    });

    const sonder = () => {
      const envoyeA = Date.now();
      socket.timeout(4000).emit('pingHorloge', { heureServeur: envoyeA }, (erreur, reponse) => {
        if (erreur || !reponse) return;
        const lien = liens.get(socket.id);
        if (!lien) return;
        const latenceMs = Math.max(0, Math.round((Date.now() - envoyeA) / 2));
        lien.latenceMs = latenceMs;
        lien.decalageMs = Math.round(reponse.heureClient - (envoyeA + latenceMs));
        socket.emit('mesure', { latenceMs, decalageMs: lien.decalageMs });
        planifierDiffusion();
      });
    };
    sonder();
    const minuteur = setInterval(sonder, INTERVALLE_PING_MS);
    minuteur.unref();
    minuteurs.set(socket.id, minuteur);

    socket.on('bonjour', (message, ack) => {
      if (!message || (message.role !== 'tv' && message.role !== 'joueur' && message.role !== 'hote')) {
        ack({ ok: false, erreur: 'Rôle inconnu' });
        return;
      }
      if (message.role === 'hote') {
        if (!message.codeHote) {
          ack({ ok: false, erreur: 'Indique le code hôte' });
          return;
        }
        if (!codeIdentique(message.codeHote, partie.codeHote)) {
          ack({ ok: false, erreur: 'Code hôte incorrect' });
          return;
        }
      }
      let joueurId: string | null = null;
      if (message.role === 'joueur' && message.jeton) {
        joueurId = store.joueurIdDuJeton(message.jeton);
        if (!joueurId) {
          ack({ ok: false, erreur: 'Ta session a expiré. Reprends ta place ou inscris-toi.' });
          return;
        }
      }
      const lien: Lien = {
        authentifie: true,
        role: message.role,
        joueurId,
        latenceMs: liens.get(socket.id)?.latenceMs ?? null,
        decalageMs: liens.get(socket.id)?.decalageMs ?? null,
      };
      liens.set(socket.id, lien);
      ranger(socket, lien);
      ack({ ok: true, idDemarrage });
      diffuser();
    });

    socket.on('action', (action, ack) => {
      const lien = liens.get(socket.id);
      if (!lien?.authentifie || !lien.role) {
        ack({ ok: false, erreur: "Connecte-toi avant d'envoyer une action" });
        return;
      }
      if (lien.role === 'tv') {
        ack({ ok: false, erreur: 'La télé ne pilote pas la partie' });
        return;
      }
      const origine = lien.role === 'hote' ? { role: 'hote' as const } : { role: 'joueur' as const, joueurId: lien.joueurId };
      const reponse = store.dispatch(action, origine, socket.id);
      if (reponse.ok && action?.type === 'rejoindre' && reponse.joueurId) {
        lien.joueurId = reponse.joueurId;
        ranger(socket, lien);
      }
      if (reponse.ok && (action?.type === 'reinitialiserPartie' || action?.type === 'retirerJoueur')) {
        const presents = new Set(store.etat().joueurs.map((joueur) => joueur.id));
        for (const [id, lienCourant] of liens) {
          if (lienCourant.role !== 'joueur' || !lienCourant.joueurId || presents.has(lienCourant.joueurId)) continue;
          lienCourant.joueurId = null;
          const autre = io.sockets.sockets.get(id);
          if (autre) ranger(autre, lienCourant);
        }
      }
      ack(reponse);
      if (reponse.ok) {
        diffuser();
        planifierBots();
      }
    });

    socket.on('reglerVolume', (message) => {
      const lien = liens.get(socket.id);
      if (!lien?.authentifie || lien.role !== 'hote') return;
      if (!message || typeof message.volume !== 'number' || !Number.isFinite(message.volume)) return;
      volumeSon = Math.min(1, Math.max(0, message.volume));
      diffuser();
    });

    socket.on('disconnect', () => {
      const minuteurSocket = minuteurs.get(socket.id);
      if (minuteurSocket) clearInterval(minuteurSocket);
      minuteurs.delete(socket.id);
      liens.delete(socket.id);
      diffuser();
    });
  });

  const servirClient = options.servirClient ?? !modeTest;
  if (servirClient) {
    app.use((requete, _reponse, suite) => {
      const indexQuery = requete.url.indexOf('?');
      const chemin = indexQuery === -1 ? requete.url : requete.url.slice(0, indexQuery);
      const query = indexQuery === -1 ? '' : requete.url.slice(indexQuery);
      if (chemin.length > 1 && chemin.endsWith('/')) requete.url = chemin.replace(/\/+$/, '') + query;
      suite();
    });
    app.use((_requete, reponse, suite) => {
      reponse.setHeader('Cache-Control', 'no-store');
      suite();
    });

    app.get('/qr/joueur.svg', async (_requete, reponse, suite) => {
      try {
        const svg = await QRCode.toString(reseau.urlJoueur, {
          type: 'svg',
          margin: 1,
          errorCorrectionLevel: 'M',
          color: { dark: '#14171c', light: '#f7f4ee' },
        });
        reponse.type('image/svg+xml').send(svg);
      } catch (erreur) {
        suite(erreur);
      }
    });

    app.post('/api/diagnostic', express.json({ limit: '100kb' }), (requete, reponse) => {
      if (!requete.body || typeof requete.body !== 'object' || Array.isArray(requete.body)) {
        reponse.status(400).json({ ok: false, erreur: 'Diagnostic invalide' });
        return;
      }
      diagnostic = { ...(requete.body as DiagnosticTv), recuA: Date.now() };
      ecrireDiagnostic(fichierDiagnostic, diagnostic);
      diffuser();
      reponse.json({ ok: true });
    });

    app.get('/diag.html', (_requete, reponse) => {
      const fichier = devOutils
        ? path.join(RACINE, 'client', 'public', 'diag.html')
        : path.join(RACINE, 'dist', 'diag.html');
      reponse.sendFile(fichier);
    });
  }

  let vite: ViteDevServer | null = null;
  if (servirClient && devOutils) {
    vite = await creerServeurVite({
      configFile: path.join(RACINE, 'vite.config.ts'),
      server: { middlewareMode: true, hmr: modeTest ? false : { server: httpServer } },
      appType: 'custom',
    });
  }

  if (servirClient) {
    app.use(async (requete, reponse, suite) => {
      if (requete.method !== 'GET' && requete.method !== 'HEAD') {
        suite();
        return;
      }
      const page = PAGES[requete.path];
      if (!page) {
        suite();
        return;
      }
      try {
        if (vite) {
          const fichier = path.join(RACINE, 'client', page);
          let html = await fs.promises.readFile(fichier, 'utf8');
          html = await vite.transformIndexHtml(requete.originalUrl, html);
          reponse.status(200).set({ 'Content-Type': 'text/html; charset=utf-8' }).end(html);
        } else {
          reponse.sendFile(path.join(RACINE, 'dist', page));
        }
      } catch (erreur) {
        suite(erreur);
      }
    });

    if (vite) app.use(vite.middlewares);
    else app.use(express.static(path.join(RACINE, 'dist'), { index: false }));

    app.use((_requete, reponse) => {
      reponse.status(404).type('text/plain; charset=utf-8').send('Page introuvable');
    });
  }

  const hote = modeTest ? '127.0.0.1' : '0.0.0.0';
  await new Promise<void>((resoudre) => {
    httpServer.listen(options.port, hote, () => resoudre());
  });
  planifierBots();

  if (!modeTest) {
    const source = store.source.startsWith(RACINE) ? path.relative(RACINE, store.source) : store.source;
    console.log('');
    console.log(partie.titre);
    console.log(`État chargé : ${source}`);
    console.log('');
    console.log('Sur ce PC');
    console.log(`  http://localhost:${options.port}/`);
    console.log(`  http://localhost:${options.port}/tv`);
    console.log(`  http://localhost:${options.port}/joueur`);
    console.log(`  http://localhost:${options.port}/hote`);
    console.log('');
    console.log(`Sur le réseau (${reseau.ip})`);
    console.log(`  TV          ${reseau.urlTv}`);
    console.log(`  Joueur      ${reseau.urlJoueur}`);
    console.log(`  Hôte        ${reseau.urlHote}`);
    console.log(`  Diagnostic  ${reseau.urlDiag}`);
    if (reseau.autres.length > 0) console.log(`  Autres IP   ${reseau.autres.join(', ')}`);
    console.log('');
    console.log('Pare-feu : à la première alerte, autorise Node.js sur les réseaux privés.');
    console.log('Ou en PowerShell administrateur :');
    console.log(
      `New-NetFirewallRule -DisplayName "GP Party" -Direction Inbound -Protocol TCP -LocalPort ${options.port} -Action Allow -Profile Private`,
    );
    console.log('');
  }

  return {
    url: `http://127.0.0.1:${options.port}`,
    port: options.port,
    etat: () => store.etat(),
    fermer: async () => {
      if (minuteurBots) clearTimeout(minuteurBots);
      if (diffusionPrevue) clearTimeout(diffusionPrevue);
      for (const minuteur of minuteurs.values()) clearInterval(minuteur);
      minuteurs.clear();
      await store.flush();
      store.fermer();
      io.close();
      if (vite) await vite.close();
      if (httpServer.listening) {
        await new Promise<void>((resoudre, rejeter) => {
          httpServer.close((erreur) => (erreur ? rejeter(erreur) : resoudre()));
        });
      }
    },
  };
}
