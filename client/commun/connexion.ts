import { io, type Socket } from 'socket.io-client';
import type {
  Action,
  Bonjour,
  EvenementsClient,
  EvenementsServeur,
  ReponseAction,
  ReponseBonjour,
  VueClient,
} from '../../shared/types';

type SocketPage = Socket<EvenementsServeur, EvenementsClient>;

let decalageCourant = 0;

export function lireDecalageMs(): number {
  return decalageCourant;
}

export type OptionsConnexion = {
  role: 'tv' | 'joueur' | 'hote';
  obtenirJeton?: () => string | null;
  obtenirCode?: () => string | null;
  onVue: (vue: VueClient, infos: { animer: boolean }) => void;
  onConnecte: (connecte: boolean) => void;
  onBonjour: (reponse: ReponseBonjour) => void;
  onRepriseValidee?: (message: { jeton: string; joueurId: string }) => void;
  onRepriseRefusee?: (message: { joueurId: string }) => void;
  onMesure?: (mesure: { latenceMs: number; decalageMs: number }) => void;
  onTransport?: (transport: string) => void;
};

export type Session = {
  envoyer: (action: Action) => Promise<ReponseAction>;
  reglerVolume: (volume: number) => void;
  rebonjour: () => void;
  transport: () => string;
  fermer: () => void;
};

function nomTransport(socket: SocketPage): string {
  const nom = socket.io.engine?.transport?.name;
  if (nom === 'websocket' || nom === 'polling') return nom;
  return 'hors ligne';
}

export function connecter(options: OptionsConnexion): Session {
  const socket: SocketPage = io({
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 400,
    reconnectionDelayMax: 2000,
    timeout: 8000,
  });
  let idDemarrage: string | null = null;
  let premiereVue = true;

  const verifierDemarrage = (id: string) => {
    if (idDemarrage && idDemarrage !== id) {
      window.location.reload();
      return;
    }
    idDemarrage = id;
  };

  const signalerTransport = () => {
    options.onTransport?.(nomTransport(socket));
  };

  const bonjour = () => {
    const message: Bonjour = { role: options.role };
    const jeton = options.obtenirJeton?.();
    const code = options.obtenirCode?.();
    if (jeton) message.jeton = jeton;
    if (code) message.codeHote = code;
    socket.timeout(8000).emit('bonjour', message, (erreur, reponse) => {
      if (erreur || !reponse) {
        options.onBonjour({ ok: false, erreur: 'Pas de réponse du serveur' });
        return;
      }
      if (reponse.ok) verifierDemarrage(reponse.idDemarrage);
      options.onBonjour(reponse);
    });
  };

  socket.on('connect', () => {
    options.onConnecte(true);
    signalerTransport();
    const moteur = socket.io.engine;
    moteur?.once('upgrade', signalerTransport);
    bonjour();
  });
  socket.on('disconnect', () => options.onConnecte(false));
  socket.on('connect_error', () => options.onConnecte(false));
  socket.on('vue', (vue) => {
    verifierDemarrage(vue.idDemarrage);
    const animer = !premiereVue;
    premiereVue = false;
    options.onVue(vue, { animer });
  });
  socket.on('pingHorloge', (_message, ack) => {
    ack({ heureClient: Date.now() });
  });
  socket.on('mesure', (mesure) => {
    decalageCourant = mesure.decalageMs;
    options.onMesure?.(mesure);
  });
  socket.on('repriseValidee', (message) => options.onRepriseValidee?.(message));
  socket.on('repriseRefusee', (message) => options.onRepriseRefusee?.(message));

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (socket.connected) socket.disconnect();
    socket.connect();
  });

  return {
    reglerVolume: (volume) => {
      socket.emit('reglerVolume', { volume });
    },
    rebonjour: bonjour,
    transport: () => (socket.connected ? nomTransport(socket) : 'hors ligne'),
    fermer: () => {
      socket.removeAllListeners();
      socket.disconnect();
    },
    envoyer: (action) =>
      new Promise((resoudre) => {
        socket.timeout(8000).emit('action', action, (erreur, reponse) => {
          if (erreur || !reponse) resoudre({ ok: false, erreur: 'Pas de réponse du serveur' });
          else resoudre(reponse);
        });
      }),
  };
}
