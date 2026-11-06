import type { CauseGardee } from "@/lib/note-gardee";

/**
 * LES NOTES GARDÉES SUR LE TÉLÉPHONE — son choix B du 6 novembre 2026
 * (`appli/soignee/note-sans-reseau.html`).
 *
 * Une note dictée qui n'a pas pu partir reste ici, dans la base du navigateur
 * (IndexedDB), jusqu'à ce que son appui sur Envoyer la fasse partir. Une page
 * rouverte sur le même chantier la retrouve.
 *
 * **Une note par chantier**, comme sur le serveur (`notes_vocales_chantier_uk`) :
 * la clé est le chantier. Une fiche NEUVE n'a pas encore de chantier ; sa note
 * ne vit que dans la page (`AnneauNoteVocale`), et la phrase le dit.
 *
 * **Le son se range en octets, pas en `Blob`** : un `Blob` rangé tel quel a
 * longtemps été refusé par Safari sur iPhone, son téléphone. Des octets et
 * leur type passent partout.
 *
 * **Rien ne lève ici.** Un téléphone peut refuser de ranger (navigation privée,
 * mémoire pleine, réglage) : la réponse le DIT, en valeur, et l'écran en tire
 * sa phrase. Une exception partie d'ici laisserait l'anneau sans issue.
 *
 * **La voix du client ne reste que tant qu'elle n'est pas partie** : un envoi
 * réussi, ou Jeter, l'efface (`oublierLaNote`).
 */

const BASE = "atlas-notes-gardees";
const MAGASIN = "notes";

export type NoteGardee = {
  chantierId: string;
  /** L'identifiant de l'envoi : le même à chaque appui, pour que le serveur
   *  reconnaisse un envoi déjà reçu. */
  envoiId: string;
  octets: ArrayBuffer;
  type: string;
  secondes: number;
  cause: CauseGardee;
  gardeeLe: string;
};

function ouvrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const requete = indexedDB.open(BASE, 1);
    requete.onupgradeneeded = () => {
      requete.result.createObjectStore(MAGASIN, { keyPath: "chantierId" });
    };
    requete.onsuccess = () => resolve(requete.result);
    requete.onerror = () => reject(requete.error ?? new Error("IndexedDB refusé"));
    requete.onblocked = () => reject(new Error("IndexedDB bloqué par un autre onglet"));
  });
}

function attendre<T>(requete: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    requete.onsuccess = () => resolve(requete.result);
    requete.onerror = () => reject(requete.error ?? new Error("IndexedDB : requête refusée"));
  });
}

async function avecLeMagasin<T>(mode: IDBTransactionMode, faire: (magasin: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const base = await ouvrir();
  try {
    return await attendre(faire(base.transaction(MAGASIN, mode).objectStore(MAGASIN)));
  } finally {
    base.close();
  }
}

/** Range la note. `ok: false` : le téléphone a refusé, elle ne vit que dans la page. */
export async function garderLaNote(note: NoteGardee): Promise<{ ok: true } | { ok: false; motif: string }> {
  try {
    await avecLeMagasin("readwrite", (m) => m.put(note));
    return { ok: true };
  } catch (e) {
    // Journalisé dans la console du téléphone : c'est le seul endroit où cette
    // panne est lisible, et l'écran, lui, dit déjà qu'il faut rester sur la page.
    console.error("Note gardée : le téléphone refuse de la ranger", e);
    return { ok: false, motif: e instanceof Error ? e.message : String(e) };
  }
}

/** La note gardée de ce chantier, s'il y en a une. `null` aussi quand le téléphone refuse de lire. */
export async function noteGardeeDe(chantierId: string): Promise<NoteGardee | null> {
  try {
    const note = await avecLeMagasin("readonly", (m) => m.get(chantierId) as IDBRequest<NoteGardee | undefined>);
    return note ?? null;
  } catch (e) {
    console.error("Note gardée : le téléphone refuse de la relire", e);
    return null;
  }
}

/** Efface la note gardée de ce chantier : partie, ou jetée. */
export async function oublierLaNote(chantierId: string): Promise<void> {
  try {
    await avecLeMagasin("readwrite", (m) => m.delete(chantierId));
  } catch (e) {
    // Une note qu'on n'arrive pas à effacer reviendra à la prochaine ouverture,
    // où Jeter la retirera : rien n'est perdu, rien n'est envoyé deux fois
    // (l'envoi porte son identifiant). On le dit dans la console, sans plus.
    console.error("Note gardée : le téléphone refuse de l'effacer", e);
  }
}
