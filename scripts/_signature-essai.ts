// Une signature au doigt pour les suites : un VRAI PNG, fabriqué ici.
//
// Les suites qui acceptent un devis ou signent une fiche doivent passer par la
// règle de `src/lib/signature-au-doigt.ts` comme le client, et un PDF doit
// pouvoir l'embarquer : un faux PNG les ferait tomber pour une autre raison
// que celle qu'elles éprouvent. Le trait est une diagonale ondulée, 120 × 52,
// noir sur transparent, comme `pngDeLaSignature` en produit.
import { deflateSync } from "node:zlib";

function crc32(octets: Buffer): number {
  let crc = 0xffffffff;
  for (const o of octets) {
    crc ^= o;
    for (let k = 0; k < 8; k++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function morceau(type: string, donnees: Buffer): Buffer {
  const longueur = Buffer.alloc(4);
  longueur.writeUInt32BE(donnees.length);
  const corps = Buffer.concat([Buffer.from(type, "ascii"), donnees]);
  const controle = Buffer.alloc(4);
  controle.writeUInt32BE(crc32(corps));
  return Buffer.concat([longueur, corps, controle]);
}

function fabriquer(): Buffer {
  const largeur = 120;
  const hauteur = 52;
  const lignes: Buffer[] = [];
  for (let y = 0; y < hauteur; y++) {
    const ligne = Buffer.alloc(1 + largeur * 4); // filtre 0, puis RGBA
    for (let x = 0; x < largeur; x++) {
      const courbe = 26 + Math.sin(x / 9) * 14;
      if (Math.abs(y - courbe) < 2) ligne.writeUInt32BE(0x1c1c1aff, 1 + x * 4);
    }
    lignes.push(ligne);
  }
  const entete = Buffer.alloc(13);
  entete.writeUInt32BE(largeur, 0);
  entete.writeUInt32BE(hauteur, 4);
  entete[8] = 8; // 8 bits par canal
  entete[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    morceau("IHDR", entete),
    morceau("IDAT", deflateSync(Buffer.concat(lignes))),
    morceau("IEND", Buffer.alloc(0)),
  ]);
}

export const SIGNATURE_ESSAI_OCTETS = new Uint8Array(fabriquer());
export const SIGNATURE_ESSAI_PNG = `data:image/png;base64,${Buffer.from(SIGNATURE_ESSAI_OCTETS).toString("base64")}`;
/** Le nombre de points d'un vrai trait : bien au-dessus du minimum. */
export const SIGNATURE_ESSAI_POINTS = 60;
/** Ce que posterait le formulaire du client : le trait et son nombre de points. */
export const SIGNATURE_ESSAI = { png: SIGNATURE_ESSAI_PNG, points: SIGNATURE_ESSAI_POINTS };
