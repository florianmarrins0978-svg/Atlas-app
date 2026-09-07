import { createHash, createHmac, createCipheriv, randomBytes } from "node:crypto";
import {
  PDFArray,
  PDFBool,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFRef,
  PDFString,
  type PDFObject,
} from "pdf-lib";

/**
 * LE DEVIS QUE LE CLIENT REÇOIT NE DOIT PAS POUVOIR SE RETOUCHER.
 *
 * **Sa capture du 31 août 2026 :** son client ouvre le lien du devis sur son
 * téléphone, le PDF s'affiche dans Acrobat — et Acrobat lui propose « Ajouter
 * du texte », « Ajouter une image ». Rien n'empêchait de changer un montant sur
 * le document qui engage les deux parties, puis de le renvoyer.
 *
 * **Ce que cette protection fait, et ce qu'elle ne fait pas.** Un PDF porte des
 * autorisations (impression, copie, modification, annotation, assemblage) que
 * seul le mot de passe *propriétaire* peut lever. Les lecteurs — Acrobat le
 * premier — les respectent : sur un document protégé, les outils d'édition sont
 * éteints et la barre du haut affiche « SÉCURISÉ ».
 *
 * Ce n'est pas un coffre-fort : le format est public, et un outil déterminé
 * réécrit un PDF quoi qu'on fasse. Ce n'est pas non plus le but. Le but est
 * qu'un client de bonne foi ne puisse pas modifier son devis **par mégarde ou
 * d'un doigt**, et que la pièce qui fait foi reste celle qu'Atlas a archivée à
 * l'envoi. Écrire l'inverse au patron serait lui promettre ce qu'aucun format
 * ne tient.
 *
 * **Le mot de passe d'ouverture reste VIDE, délibérément.** Le client doit
 * ouvrir son devis d'un appui, sans rien taper — un mot de passe à lui
 * transmettre coûterait un coup de fil par devis, et la moitié des chantiers.
 * Seul le mot de passe propriétaire existe, et personne ne l'a : il est tiré au
 * sort et jeté.
 */

// Le bourrage de la norme (ISO 32000-1, 7.6.3.3) : ce qui complète un mot de
// passe court, et qui EST le mot de passe quand celui-ci est vide.
const BOURRAGE = Uint8Array.from([
  0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41, 0x64, 0x00, 0x4e, 0x56, 0xff, 0xfa, 0x01, 0x08,
  0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80, 0x2f, 0x0c, 0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a,
]);

/**
 * CE QUI RESTE PERMIS, ET CE QUI NE L'EST PLUS.
 *
 * Un entier signé de 32 bits, un bit par autorisation (ISO 32000-1, tableau 22).
 * Les bits sont numérotés à partir de 1, et ceux que la norme réserve doivent
 * rester à 1 — d'où le « tout permis » de départ, dont on retire.
 *
 * | | |
 * |---|---|
 * | **imprimer** (3) et **imprimer en pleine définition** (12) | gardés : un client imprime son devis pour le signer |
 * | **copier le texte** (5) et **extraction pour l'accessibilité** (10) | gardés : une adresse se recopie, et une liseuse d'écran doit lire ce document |
 * | **modifier le contenu** (4) | RETIRÉ — c'est la demande |
 * | **annoter et remplir** (6), **remplir un formulaire** (9) | RETIRÉS : une annotation par-dessus un montant se photographie comme un montant |
 * | **assembler** (11) | RETIRÉ : retirer une page d'un devis de deux feuilles, c'est en changer le sens |
 */
export const AUTORISATIONS_CLIENT =
  ~0 & // tout à 1 : les bits réservés (7, 8, 13 à 32) doivent le rester
  ~0b11 & // bits 1 et 2 : la norme les veut à 0
  ~(1 << 3) & // 4 — modifier le contenu
  ~(1 << 5) & // 6 — annoter, remplir
  ~(1 << 8) & // 9 — remplir un formulaire
  ~(1 << 10); // 11 — assembler

/**
 * La graine qui rend le mot de passe propriétaire imprévisible.
 *
 * **Pourquoi elle est tirée une fois par processus, et non par document.** Deux
 * compositions du même devis, à la même seconde, doivent rendre le même fichier
 * octet pour octet : c'est ce que vérifie `scripts/test-allure-pdf.ts`, et ce
 * contrôle-là garde une promesse qui compte — *« aucun artisan ne doit voir son
 * devis changer parce qu'un écran est apparu quelque part »*. Un tirage par
 * document l'aurait rendu impossible à tenir, et on aurait retiré le contrôle
 * au lieu du défaut.
 *
 * Le mot de passe, lui, reste **propre à chaque document** : il dérive de la
 * graine ET de l'empreinte du fichier. Deux devis n'ont donc jamais le même, et
 * le connaître pour l'un n'apprend rien de l'autre ni de la graine.
 */
const GRAINE = randomBytes(32);

/** RC4, que la norme impose pour /O et /U — même quand le reste est en AES. */
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

/** La clé RC4 décalée d'un tour, pour les dix-neuf passes de la norme. */
const cleDecalee = (cle: Uint8Array, tour: number): Uint8Array =>
  cle.map((octet) => octet ^ tour);

/** Algorithme 3 : le mot de passe propriétaire, brouillé, devient /O. */
function calculerO(motDePasseProprietaire: Uint8Array): Uint8Array {
  let empreinte = md5(motDePasseProprietaire);
  // Cinquante tours : c'est ce qui rend une attaque par dictionnaire coûteuse,
  // et la norme les exige à partir de la révision 3.
  for (let i = 0; i < 50; i++) empreinte = md5(empreinte);
  const cle = empreinte.slice(0, 16);
  let sortie = rc4(cle, BOURRAGE); // le mot de passe d'ouverture est vide
  for (let tour = 1; tour <= 19; tour++) sortie = rc4(cleDecalee(cle, tour), sortie);
  return sortie;
}

/** Algorithme 2 : la clé qui chiffre réellement le document. */
function calculerCle(o: Uint8Array, autorisations: number, identifiant: Uint8Array): Uint8Array {
  const p = new Uint8Array(4);
  new DataView(p.buffer).setInt32(0, autorisations, true); // petit-boutiste, signé
  let empreinte = md5(BOURRAGE, o, p, identifiant);
  for (let i = 0; i < 50; i++) empreinte = md5(empreinte.slice(0, 16));
  return empreinte.slice(0, 16);
}

/** Algorithme 5 : /U, ce qu'un lecteur recalcule pour savoir qu'il peut ouvrir. */
function calculerU(cle: Uint8Array, identifiant: Uint8Array): Uint8Array {
  let sortie = rc4(cle, md5(BOURRAGE, identifiant));
  for (let tour = 1; tour <= 19; tour++) sortie = rc4(cleDecalee(cle, tour), sortie);
  const u = new Uint8Array(32); // les seize derniers octets sont libres
  u.set(sortie.slice(0, 16), 0);
  return u;
}

/**
 * Algorithme 1 : la clé d'UN objet.
 *
 * Chaque objet a la sienne, dérivée de son numéro. Sans cela, deux textes
 * identiques donneraient deux chiffrés identiques, et le document se lirait par
 * recoupement.
 */
function cleDObjet(cle: Uint8Array, numero: number, generation: number): Uint8Array {
  const queue = Uint8Array.from([
    numero & 0xff,
    (numero >> 8) & 0xff,
    (numero >> 16) & 0xff,
    generation & 0xff,
    (generation >> 8) & 0xff,
    // « sAlT » : la norme l'ajoute pour l'AES, et l'oublier rend un fichier que
    // rien n'ouvre — sans que rien ne le signale ici.
    0x73,
    0x41,
    0x6c,
    0x54,
  ]);
  return md5(cle, queue).slice(0, 16);
}

/**
 * AES-128 en CBC, avec le vecteur en tête comme la norme le demande.
 *
 * **Le vecteur est DÉRIVÉ, non tiré au sort**, pour la raison dite plus haut :
 * deux compositions du même devis doivent rendre le même fichier. Ce n'est pas
 * une entorse — un vecteur ne doit jamais servir deux fois avec la même clé, et
 * ici chaque clé d'objet ne chiffre qu'un seul contenu, dans un seul document.
 */
function chiffrer(cleObjet: Uint8Array, clair: Uint8Array): Uint8Array {
  const vecteur = md5(cleObjet, Uint8Array.from([0x76, 0x69])).slice(0, 16);
  const c = createCipheriv("aes-128-cbc", cleObjet, vecteur);
  return new Uint8Array(Buffer.concat([Buffer.from(vecteur), c.update(clair), c.final()]));
}

const hexa = (octets: Uint8Array): string =>
  Array.from(octets, (o) => o.toString(16).padStart(2, "0")).join("");

/** Un texte du document, remplacé par son chiffré — toujours en hexadécimal. */
function texteChiffre(valeur: PDFString | PDFHexString, cleObjet: Uint8Array): PDFHexString {
  // En hexadécimal, jamais entre parenthèses : un chiffré contient des octets
  // nuls et des parenthèses qui casseraient la syntaxe littérale.
  return PDFHexString.of(hexa(chiffrer(cleObjet, valeur.asBytes())));
}

/** Descend un dictionnaire ou un tableau et chiffre les textes qu'il porte. */
function chiffrerLesTextes(objet: PDFObject, cleObjet: Uint8Array): void {
  if (objet instanceof PDFDict) {
    for (const [nom, valeur] of objet.entries()) {
      if (valeur instanceof PDFString || valeur instanceof PDFHexString) {
        objet.set(nom, texteChiffre(valeur, cleObjet));
      } else if (!(valeur instanceof PDFRef)) {
        // Une référence désigne un AUTRE objet, qui a sa propre clé : la suivre
        // ici le chiffrerait deux fois.
        chiffrerLesTextes(valeur, cleObjet);
      }
    }
    return;
  }
  if (objet instanceof PDFArray) {
    for (let i = 0; i < objet.size(); i++) {
      const valeur = objet.get(i);
      if (valeur instanceof PDFString || valeur instanceof PDFHexString) {
        objet.set(i, texteChiffre(valeur, cleObjet));
      } else if (!(valeur instanceof PDFRef)) {
        chiffrerLesTextes(valeur, cleObjet);
      }
    }
  }
}

/**
 * Rend le même document, protégé contre la retouche.
 *
 * Ce qui entre est un PDF déjà composé ; ce qui sort porte le même dessin, les
 * mêmes pages et les mêmes textes — mais chiffré, et accompagné de ses
 * autorisations. Le tout s'ouvre sans rien taper.
 */
export async function protegerContreModification(octets: Uint8Array): Promise<Uint8Array> {
  const doc = await PDFDocument.load(octets, {
    // **Sans cela, pdf-lib réécrit la date de modification** à l'instant du
    // chargement : le document ne serait plus le même d'une seconde à l'autre,
    // et l'égalité octet pour octet que le dépôt vérifie tomberait — sur un
    // défaut invisible, qui ne se montre qu'une fois sur deux.
    updateMetadata: false,
  });
  const ctx = doc.context;

  // L'identifiant du fichier est l'empreinte de son contenu : la norme le
  // suggère, et cela le rend unique par document sans rien tirer au sort.
  const empreinte = new Uint8Array(createHash("sha256").update(octets).digest()).slice(0, 16);
  const proprietaire = new Uint8Array(
    createHmac("sha256", GRAINE).update(empreinte).digest()
  ).slice(0, 32);

  const o = calculerO(proprietaire);
  const cle = calculerCle(o, AUTORISATIONS_CLIENT, empreinte);
  const u = calculerU(cle, empreinte);

  // **Le chiffrement AVANT la pose du dictionnaire /Encrypt**, et l'ordre n'est
  // pas indifférent : ce dictionnaire est le seul objet du fichier qui ne se
  // chiffre pas. Le poser d'abord obligerait à l'exclure de la descente — une
  // exception de plus à tenir, pour rien.
  for (const [reference, objet] of ctx.enumerateIndirectObjects()) {
    const cleObjet = cleDObjet(cle, reference.objectNumber, reference.generationNumber);
    if (objet instanceof PDFRawStream) {
      chiffrerLesTextes(objet.dict, cleObjet);
      ctx.assign(reference, PDFRawStream.of(objet.dict, chiffrer(cleObjet, objet.contents)));
    } else {
      chiffrerLesTextes(objet, cleObjet);
    }
  }

  const protection = ctx.obj({
    Filter: "Standard",
    V: 4,
    R: 4,
    Length: 128,
    CF: { StdCF: { CFM: "AESV2", AuthEvent: "DocOpen", Length: 16 } },
    StmF: "StdCF",
    StrF: "StdCF",
  }) as PDFDict;
  protection.set(PDFName.of("O"), PDFHexString.of(hexa(o)));
  protection.set(PDFName.of("U"), PDFHexString.of(hexa(u)));
  protection.set(PDFName.of("P"), PDFNumber.of(AUTORISATIONS_CLIENT));
  protection.set(PDFName.of("EncryptMetadata"), PDFBool.True);

  ctx.trailerInfo.Encrypt = ctx.register(protection);
  ctx.trailerInfo.ID = ctx.obj([PDFHexString.of(hexa(empreinte)), PDFHexString.of(hexa(empreinte))]);

  // **Aucun flux d'objets, et c'est une nécessité, pas un réglage.** Un flux
  // d'objets rassemble plusieurs objets dans un seul flux, chiffré d'un bloc :
  // les textes qu'il contient se retrouveraient chiffrés deux fois, et le
  // fichier ne s'ouvrirait nulle part.
  return doc.save({ useObjectStreams: false });
}
