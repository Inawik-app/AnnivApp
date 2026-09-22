const NOMS = ['rejoindre', 'gain', 'transition', 'de', 'revelation', 'buzzer', 'victoire', 'tictac'] as const;

const fichiers = import.meta.glob('../public/assets/sons/*.{mp3,ogg}', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

function trouver(nom: string): string | null {
  const entrees = Object.entries(fichiers);
  const mp3 = entrees.find(([chemin]) => chemin.endsWith(`/${nom}.mp3`));
  if (mp3) return mp3[1];
  const ogg = entrees.find(([chemin]) => chemin.endsWith(`/${nom}.ogg`));
  return ogg ? ogg[1] : null;
}

export type Sons = {
  precharger: () => void;
  deverrouiller: () => void;
  jouer: (nom: string) => void;
  reglerVolume: (volume: number) => void;
};

export function creerSons(): Sons {
  const pistes = new Map<string, HTMLAudioElement>();
  let volume = 0.8;
  let pret = false;

  const assurer = (nom: string): HTMLAudioElement | null => {
    const existant = pistes.get(nom);
    if (existant) return existant;
    const url = trouver(nom);
    if (!url) return null;
    const audio = new Audio(url);
    audio.preload = 'auto';
    pistes.set(nom, audio);
    return audio;
  };

  return {
    precharger() {
      for (const nom of NOMS) assurer(nom);
    },
    deverrouiller() {
      const fenetre = window as Window & { webkitAudioContext?: typeof AudioContext };
      const Ctor = window.AudioContext ?? fenetre.webkitAudioContext;
      if (Ctor) {
        const contexte = new Ctor();
        void contexte.resume();
        const buffer = contexte.createBuffer(1, 1, 22050);
        const source = contexte.createBufferSource();
        source.buffer = buffer;
        source.connect(contexte.destination);
        source.start(0);
      }
      pret = true;
      for (const audio of pistes.values()) {
        audio.volume = 0;
        const lecture = audio.play();
        if (!lecture) continue;
        void lecture
          .then(() => {
            audio.pause();
            audio.currentTime = 0;
            audio.volume = volume;
          })
          .catch(() => undefined);
      }
    },
    jouer(nom: string) {
      if (!pret) return;
      const audio = assurer(nom);
      if (!audio) return;
      audio.volume = volume;
      audio.currentTime = 0;
      void audio.play().catch(() => undefined);
    },
    reglerVolume(valeur: number) {
      volume = Math.min(1, Math.max(0, valeur));
      for (const audio of pistes.values()) audio.volume = volume;
    },
  };
}

let instance: Sons | null = null;

export function sons(): Sons {
  instance ??= creerSons();
  return instance;
}
