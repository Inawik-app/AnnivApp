import { useLayoutEffect, useRef } from 'preact/hooks';

const memoire = new Map<string, DOMRect>();

export function useFlip(id: string, signature: string, animer: { current: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const maintenant = element.getBoundingClientRect();
    const avant = memoire.get(id);
    const doit = animer.current && !!avant;
    memoire.set(id, maintenant);
    if (!doit || !avant) return;
    const largeur = element.offsetWidth || 1;
    const echelle = maintenant.width / largeur || 1;
    const dx = (avant.left - maintenant.left) / echelle;
    const dy = (avant.top - maintenant.top) / echelle;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    element.style.transition = 'none';
    element.style.transform = `translate(${dx}px, ${dy}px)`;
    requestAnimationFrame(() => {
      element.style.transition = 'transform var(--duree-spectacle) var(--pose)';
      element.style.transform = 'translate(0px, 0px)';
    });
  }, [id, signature, animer]);
  return ref;
}
