import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { solde } from '../shared/soldes';
import type { EtatJeu, Origine } from '../shared/types';
import { lireDonnees } from './fusion';
import { choisirIp } from './ip';
import { creerStore, type Notification } from './store';

const hote: Origine = { role: 'hote' };
const joueur: Origine = { role: 'joueur', joueurId: null };
const dossiers: string[] = [];
const storesOuverts: Array<{ flush: () => Promise<void>; fermer: () => void }> = [];

function storeTemporaire(partiel: Partial<Parameters<typeof creerStore>[0]> = {}) {
  const dossierData = fs.mkdtempSync(path.join(os.tmpdir(), 'gp-party-'));
  dossiers.push(dossierData);
  let n = 0;
  const store = creerStore({
    titre: 'GP Party',
    nbJoueursMax: 4,
    dev: true,
    sauvegardesAuto: false,
    maintenant: () => 1_700_000_000_000,
    nouvelId: () => `id-${String(++n)}`,
    ...partiel,
    dossierData,
  });
  storesOuverts.push(store);
  return store;
}

afterEach(async () => {
  for (const store of storesOuverts.splice(0)) {
    await store.flush();
    store.fermer();
  }
  for (const dossier of dossiers.splice(0)) fs.rmSync(dossier, { recursive: true, force: true });
});

describe('store', () => {
  it('annule en restaurant l\'état, sans faire reculer la version ni les id', async () => {
    const store = storeTemporaire();
    const entree = store.dispatch({ type: 'rejoindre', pseudo: 'Mira', avatar: 'soleil' }, joueur, 's0');
    expect(entree.ok).toBe(true);
    const mira = store.etat().joueurs[0]!.id;
    store.dispatch({ type: 'ajouterGP', joueurId: mira, montant: 5, libelle: 'Bonus' }, hote);
    expect(solde(store.etat().transactions, mira, 'visibles')).toBe(5);
    expect(store.libelleAnnulation()).toBe('GP de Mira');
    const versionAvant = store.etat().version;
    const plusGrand = Math.max(...store.etat().evenements.map((evenement) => evenement.id));
    const annule = store.dispatch({ type: 'annuler' }, hote);
    expect(annule.ok).toBe(true);
    expect(solde(store.etat().transactions, mira, 'visibles')).toBe(0);
    expect(store.etat().version).toBeGreaterThan(versionAvant);
    expect(store.libelleAnnulation()).toBe('Inscription de Mira');
    store.dispatch({ type: 'ajouterGP', joueurId: mira, montant: 2, libelle: 'Suite' }, hote);
    const nouveaux = store.etat().evenements.map((evenement) => evenement.id);
    expect(Math.max(...nouveaux)).toBeGreaterThan(plusGrand);
    await store.flush();
    store.fermer();
  });

  it('retrouve les joueurs et les jetons après redémarrage', async () => {
    const dossierData = fs.mkdtempSync(path.join(os.tmpdir(), 'gp-party-'));
    dossiers.push(dossierData);
    let n = 0;
    const premier = creerStore({
      dossierData,
      titre: 'GP Party',
      nbJoueursMax: 4,
      dev: false,
      sauvegardesAuto: false,
      nouvelId: () => `id-${String(++n)}`,
    });
    const entree = premier.dispatch({ type: 'rejoindre', pseudo: 'Lina', avatar: 'feuille' }, joueur, 's0');
    expect(entree.ok && entree.jeton).toBeTruthy();
    const jeton = entree.ok ? entree.jeton : undefined;
    await premier.flush();
    premier.fermer();
    const second = creerStore({
      dossierData,
      titre: 'GP Party',
      nbJoueursMax: 4,
      dev: false,
      sauvegardesAuto: false,
    });
    expect(second.etat().joueurs.map((item) => item.pseudo)).toEqual(['Lina']);
    expect(jeton && second.joueurIdDuJeton(jeton)).toBe(second.etat().joueurs[0]!.id);
    second.fermer();
  });

  it('remplace le jeton quand la reprise est validée', () => {
    const notes: Notification[] = [];
    const store = storeTemporaire({ notifier: (notification) => notes.push(notification) });
    const entree = store.dispatch({ type: 'rejoindre', pseudo: 'Sacha', avatar: 'goutte' }, joueur, 's0');
    if (!entree.ok || !entree.jeton || !entree.joueurId) throw new Error('inscription');
    store.dispatch({ type: 'demanderReprise', joueurId: entree.joueurId }, joueur, 'telephone');
    const demande = store.etat().demandesReprise[0];
    expect(demande).toBeTruthy();
    const validation = store.dispatch({ type: 'validerReprise', demandeId: demande!.id }, hote);
    expect(validation.ok).toBe(true);
    expect(notes[0]).toMatchObject({ type: 'repriseValidee', socketId: 'telephone', joueurId: entree.joueurId });
    expect(store.joueurIdDuJeton(entree.jeton)).toBeNull();
    const nouveau = notes[0]?.type === 'repriseValidee' ? notes[0].jeton : '';
    expect(store.joueurIdDuJeton(nouveau)).toBe(entree.joueurId);
    store.fermer();
  });
});

describe('fusion et réseau', () => {
  it('tolère un champ ajouté et ne réutilise pas les id d\'événements', () => {
    const donnees = lireDonnees(
      JSON.stringify({
        etat: {
          schema: 1,
          version: 3,
          partie: { titre: 'GP Party', inscriptionsVerrouillees: false, ecranTv: 'accueil', animationsReduites: false },
          joueurs: [],
          transactions: [],
          evenements: [{ id: 4, type: 'x', visibilite: 'public', libelle: 'a', donnees: {}, horodatage: 1 }],
          futur: { ok: true },
        },
        jetons: { a: 'tok' },
        prochainIdEvenement: 2,
      }),
      'GP Party',
    );
    expect(donnees.etat.partie.diagnosticTvAffiche).toBe(false);
    expect((donnees.etat as EtatJeu & { futur?: { ok: boolean } }).futur).toEqual({ ok: true });
    expect(donnees.prochainIdEvenement).toBe(5);
    expect(donnees.jetons.a).toBe('tok');
  });

  it('écarte les cartes virtuelles et laisse ipForcee gagner', () => {
    const choisi = choisirIp(
      [
        { nom: 'vEthernet (WSL)', adresse: '172.22.0.1', interne: false, famille: 'IPv4' },
        { nom: 'Wi-Fi', adresse: '192.168.1.20', interne: false, famille: 'IPv4' },
        { nom: 'Loopback Pseudo-Interface', adresse: '127.0.0.1', interne: true, famille: 'IPv4' },
      ],
      null,
    );
    expect(choisi.retenue).toBe('192.168.1.20');
    expect(choisi.autres).not.toContain('172.22.0.1');
    const force = choisirIp(
      [{ nom: 'Ethernet', adresse: '10.0.0.4', interne: false, famille: 'IPv4' }],
      '192.168.0.8',
    );
    expect(force.retenue).toBe('192.168.0.8');
    expect(force.autres).toContain('10.0.0.4');
  });
});
