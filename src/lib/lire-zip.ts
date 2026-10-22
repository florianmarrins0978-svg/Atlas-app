/**
 * OUVRIR UN ZIP PAR MORCEAUX, sur le téléphone.
 *
 * Pour l'import de devis et factures (22 octobre 2026) : dix ans de pièces,
 * 1 Go peut-être. Charger le fichier entier tuerait l'onglet. On ne lit que le
 * répertoire central (la table des matières, à la fin du fichier), puis chaque
 * entrée à son tour, par `Blob.slice`. Mesuré : 4 840 PDF sortis en 17,5 s avec
 * 10 Mo de mémoire (`docs/importer-devis-factures.md`).
 *
 * **Le zip simple seulement** : au-delà de 4 Go ou de 65 535 entrées, le format
 * passe en ZIP64, que ce lecteur ne lit pas. L'envoi est de toute façon borné à
 * 1 Go et 2 000 pièces (`LIMITES_IMPORT`), et un ZIP64 se refuse en le disant.
 *
 * Aucune dépendance : le dépôt lit et écrit déjà ses zips à la main, pour ne pas
 * embarquer une bibliothèque qui lit tout (`src/server/import/lire-classeur.ts`).
 */

export type EntreeZip = {
  chemin: string;
  /** Taille une fois décompressée, telle que l'archive l'annonce. */
  taille: number;
  methode: number;
  compressee: number;
  debutEnTete: number;
};

export class ZipIllisible extends Error {}

const FIN_CENTRAL = 0x06054b50;
const ENTREE_CENTRALE = 0x02014b50;

async function octets(blob: Blob, debut: number, fin: number): Promise<DataView> {
  return new DataView(await blob.slice(debut, fin).arrayBuffer());
}

/** La table des matières, sans rien décompresser. */
export async function entreesDuZip(zip: Blob): Promise<EntreeZip[]> {
  // La fin du répertoire central est dans les 22 derniers octets, plus un
  // commentaire de 64 Ko au plus.
  const debutQueue = Math.max(0, zip.size - 65_557);
  const queue = await octets(zip, debutQueue, zip.size);
  let fin = -1;
  for (let i = queue.byteLength - 22; i >= 0; i--) {
    if (queue.getUint32(i, true) === FIN_CENTRAL) {
      fin = i;
      break;
    }
  }
  if (fin < 0) throw new ZipIllisible("Ce fichier n'est pas un zip lisible.");
  const nombre = queue.getUint16(fin + 10, true);
  const taille = queue.getUint32(fin + 12, true);
  const debut = queue.getUint32(fin + 16, true);
  if (nombre === 0xffff || taille === 0xffffffff || debut === 0xffffffff) {
    throw new ZipIllisible("Ce zip est trop gros pour être lu d'un coup. Envoyez-le en plusieurs fois, par exemple une année par envoi.");
  }
  if (debut + taille > zip.size) throw new ZipIllisible("Ce zip est incomplet.");

  const central = await octets(zip, debut, debut + taille);
  const decodeur = new TextDecoder();
  const entrees: EntreeZip[] = [];
  let o = 0;
  for (let k = 0; k < nombre; k++) {
    if (o + 46 > central.byteLength || central.getUint32(o, true) !== ENTREE_CENTRALE) {
      throw new ZipIllisible("Ce zip est abîmé.");
    }
    const lnom = central.getUint16(o + 28, true);
    const lext = central.getUint16(o + 30, true);
    const lcom = central.getUint16(o + 32, true);
    entrees.push({
      chemin: decodeur.decode(new Uint8Array(central.buffer, central.byteOffset + o + 46, lnom)),
      methode: central.getUint16(o + 10, true),
      compressee: central.getUint32(o + 20, true),
      taille: central.getUint32(o + 24, true),
      debutEnTete: central.getUint32(o + 42, true),
    });
    o += 46 + lnom + lext + lcom;
  }
  return entrees;
}

/**
 * Le contenu d'une entrée. Stockée (0) ou compressée en deflate (8), les deux
 * seules méthodes qu'écrivent les outils courants. Le flux s'arrête à la taille
 * annoncée : une entrée qui gonflerait au-delà (une « bombe ») est refusée.
 */
export async function lireEntree(zip: Blob, e: EntreeZip, plafond: number): Promise<Uint8Array> {
  if (e.taille > plafond) throw new ZipIllisible(`« ${e.chemin} » pèse plus que permis.`);
  const tete = await octets(zip, e.debutEnTete, e.debutEnTete + 30);
  const debut = e.debutEnTete + 30 + tete.getUint16(26, true) + tete.getUint16(28, true);
  const brut = zip.slice(debut, debut + e.compressee);
  let flux: ReadableStream<Uint8Array>;
  if (e.methode === 0) flux = brut.stream();
  else if (e.methode === 8) flux = brut.stream().pipeThrough(new DecompressionStream("deflate-raw"));
  else throw new ZipIllisible(`« ${e.chemin} » est compressé d'une façon que l'appli ne lit pas.`);

  const morceaux: Uint8Array[] = [];
  let total = 0;
  const lecteur = flux.getReader();
  for (;;) {
    const { value, done } = await lecteur.read();
    if (done) break;
    total += value.length;
    if (total > plafond) {
      await lecteur.cancel();
      throw new ZipIllisible(`« ${e.chemin} » pèse plus que permis.`);
    }
    morceaux.push(value);
  }
  const sortie = new Uint8Array(total);
  let p = 0;
  for (const m of morceaux) {
    sortie.set(m, p);
    p += m.length;
  }
  return sortie;
}
