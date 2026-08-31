import { createDecipheriv, createHash } from "node:crypto";
import { inflateSync } from "node:zlib";

/**
 * UN LECTEUR DE PDF PROTÉGÉ, ÉCRIT POUR LES CONTRÔLES — et volontairement
 * séparé du produit.
 *
 * **Pourquoi il existe.** Depuis le 31 août 2026, tout ce qu'Atlas produit part
 * chiffré (`src/server/pdf/proteger-pdf.ts`). Deux contrôles ont besoin de LIRE
 * ces documents :
 *
 * | | |
 * |---|---|
 * | `test-devis-lisible.ts` | qu'un lecteur qui ne sait rien d'Atlas y arrive, sans mot de passe |
 * | `test-note-hors-documents-e2e.ts` | que le pense-bête du patron ne soit sur aucun document |
 *
 * **Il n'importe RIEN de `proteger-pdf.ts`, et c'est tout l'intérêt.** Il refait
 * le chemin inverse d'après la norme (ISO 32000-1, 7.6.3) : si la protection
 * dérivait mal sa clé, oubliait le sel de l'AES ou se trompait de vecteur, ce
 * lecteur-ci ne déchiffrerait rien. Appeler la fonction du produit pour se
 * relire ne prouverait que sa cohérence avec elle-même.
 *
 * **Ce qu'il ne prouve pas :** qu'Acrobat en fasse autant. Cela s'est vérifié
 * le 31 août avec deux moteurs qui ne sont pas dans ce dépôt — `qpdf` et le
 * lecteur PDF de Chromium (voir `ARCHITECTURE.md` §222). La CI, elle, n'installe
 * que le « headless shell » de Playwright, qui n'embarque aucun lecteur PDF :
 * il TÉLÉCHARGE le fichier au lieu de le peindre, et c'est ce qui a fait rougir
 * la première version de ce contrôle.
 */

const BOURRAGE = Uint8Array.from([
  0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41, 0x64, 0x00, 0x4e, 0x56, 0xff, 0xfa, 0x01, 0x08,
  0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80, 0x2f, 0x0c, 0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a,
]);

function rc4(cle: Uint8Array, entree: Uint8Array): Uint8Array {
  const s = new Uint8Array(256);
  for (let i = 0; i < 256; i++) s[i] = i;
  for (let i = 0, j = 0; i < 256; i++) {
    j = (j + s[i] + cle[i % cle.length]) & 0xff;
    [s[i], s[j]] = [s[j], s[i]];
  }
  const sortie = new Uint8Array(entree.length);
  for (let k = 0, i = 0, j = 0; k < entree.length; k++) {
    i = (i + 1) & 0xff;
    j = (j + s[i]) & 0xff;
    [s[i], s[j]] = [s[j], s[i]];
    sortie[k] = entree[k] ^ s[(s[i] + s[j]) & 0xff];
  }
  return sortie;
}

const md5 = (...morceaux: Uint8Array[]): Uint8Array => {
  const h = createHash("md5");
  for (const m of morceaux) h.update(m);
  return new Uint8Array(h.digest());
};

const octetsHexa = (hexa: string): Uint8Array =>
  Uint8Array.from(Buffer.from(hexa.replace(/\s+/g, ""), "hex"));

export type PdfProtege = {
  /** Les autorisations, telles qu'un lecteur les lit. */
  autorisations: number;
  /** Vrai si le document s'ouvre avec un mot de passe VIDE (algorithme 6). */
  ouvrableSansMotDePasse: boolean;
  /** Le contenu déchiffré de chaque flux, dans l'ordre du fichier. */
  flux: Uint8Array[];
};

/** Ce que le fichier annonce : ses autorisations, sa clé, ses flux. */
export function ouvrirPdfProtege(octets: Uint8Array): PdfProtege {
  const brut = Buffer.from(octets).toString("latin1");

  const ref = /\/Encrypt\s+(\d+)\s+(\d+)\s+R/.exec(brut);
  if (!ref) throw new Error("ce document ne porte aucune protection");
  const dict = new RegExp(`(?:^|[^0-9])${ref[1]}\\s+${ref[2]}\\s+obj([\\s\\S]*?)endobj`).exec(brut);
  if (!dict) throw new Error("le dictionnaire de protection est introuvable");
  const protection = dict[1];

  const lireHexa = (clef: string) => {
    const m = new RegExp(`/${clef}\\s*<([0-9A-Fa-f\\s]+)>`).exec(protection);
    if (!m) throw new Error(`/${clef} absent de la protection`);
    return octetsHexa(m[1]);
  };
  const o = lireHexa("O");
  const u = lireHexa("U");
  const p = Number(/\/P\s+(-?\d+)/.exec(protection)?.[1]);
  const identifiant = octetsHexa(
    /\/ID\s*\[\s*<([0-9A-Fa-f\s]+)>/.exec(brut)?.[1] ?? ""
  );

  // Algorithme 2 : la clé du fichier, à partir d'un mot de passe d'ouverture vide.
  const quatre = new Uint8Array(4);
  new DataView(quatre.buffer).setInt32(0, p, true);
  let empreinte = md5(BOURRAGE, o, quatre, identifiant);
  for (let i = 0; i < 50; i++) empreinte = md5(empreinte.slice(0, 16));
  const cle = empreinte.slice(0, 16);

  // Algorithme 6 : ce que le lecteur recalcule pour savoir s'il peut ouvrir.
  let attendu = rc4(cle, md5(BOURRAGE, identifiant));
  for (let tour = 1; tour <= 19; tour++) {
    attendu = rc4(cle.map((octet) => octet ^ tour), attendu);
  }
  const ouvrableSansMotDePasse = Buffer.compare(
    Buffer.from(attendu.slice(0, 16)),
    Buffer.from(u.slice(0, 16))
  ) === 0;

  const flux: Uint8Array[] = [];
  if (ouvrableSansMotDePasse) {
    const objets = brut.matchAll(/(\d+)\s+(\d+)\s+obj([\s\S]*?)endobj/g);
    for (const objet of objets) {
      const debutFlux = objet[3].indexOf("stream");
      if (debutFlux < 0) continue;
      const longueur = Number(/\/Length\s+(\d+)/.exec(objet[3])?.[1] ?? NaN);
      if (!Number.isFinite(longueur)) continue;
      const apres = objet[3].slice(debutFlux + "stream".length);
      const depart = apres.startsWith("\r\n") ? 2 : 1;
      const chiffre = Buffer.from(apres.slice(depart, depart + longueur), "latin1");
      if (chiffre.length < 32) continue;

      // Algorithme 1 : la clé de CET objet — numéro, génération, puis le sel de l'AES.
      const numero = Number(objet[1]);
      const generation = Number(objet[2]);
      const cleObjet = md5(
        cle,
        Uint8Array.from([
          numero & 0xff,
          (numero >> 8) & 0xff,
          (numero >> 16) & 0xff,
          generation & 0xff,
          (generation >> 8) & 0xff,
          0x73,
          0x41,
          0x6c,
          0x54,
        ])
      ).slice(0, 16);
      try {
        const d = createDecipheriv("aes-128-cbc", cleObjet, chiffre.subarray(0, 16));
        flux.push(new Uint8Array(Buffer.concat([d.update(chiffre.subarray(16)), d.final()])));
      } catch {
        // Un flux qui ne se déchiffre pas : on le laisse de côté plutôt que de
        // rendre un texte partiel qu'on croirait complet.
      }
    }
  }

  return { autorisations: p, ouvrableSansMotDePasse, flux };
}

/**
 * Le texte que porte un PDF — protégé ou non.
 *
 * **Deux pièges déjà payés par le contrôle du pense-bête :** les flux sont
 * comprimés (chercher les mots dans les octets bruts ne trouve jamais rien), et
 * le texte y est écrit en HEXADÉCIMAL — `<4174656C696572> Tj`.
 */
export function texteDuPdf(octets: Uint8Array): string {
  let flux: Uint8Array[];
  try {
    const lu = ouvrirPdfProtege(octets);
    flux = lu.ouvrableSansMotDePasse ? lu.flux : [];
  } catch {
    // Document non protégé : ses flux se lisent tels quels.
    flux = [];
    const brut = Buffer.from(octets).toString("latin1");
    for (const m of brut.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
      flux.push(Uint8Array.from(Buffer.from(m[1], "latin1")));
    }
  }

  let lisible = "";
  for (const f of flux) {
    let contenu: string;
    try {
      contenu = inflateSync(Buffer.from(f)).toString("latin1");
    } catch {
      // Police, image, flux non comprimé : on le prend tel quel plutôt que de
      // le perdre — un flux ignoré serait un endroit où un texte pourrait
      // dormir sans que rien ne le dise.
      contenu = Buffer.from(f).toString("latin1");
    }
    for (const t of contenu.matchAll(/<([0-9A-Fa-f\s]+)>\s*Tj/g)) {
      lisible += Buffer.from(t[1].replace(/\s+/g, ""), "hex").toString("latin1") + "\n";
    }
    for (const t of contenu.matchAll(/\(((?:[^()\\]|\\.)*)\)\s*Tj/g)) {
      lisible += t[1] + "\n";
    }
  }
  return lisible;
}
