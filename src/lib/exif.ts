/**
 * Retirer les métadonnées d'une image AVANT de la ranger.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Pourquoi, et ce que ça évite concrètement.** Une photo de jardin prise au
 * téléphone porte, sans que personne l'ait voulu : les **coordonnées GPS** du
 * domicile du client, l'horodatage exact, le modèle d'appareil, parfois un
 * numéro de série, parfois une vignette d'aperçu qui a survécu à un recadrage.
 *
 * Ces données partent chez le fournisseur d'IA avec l'image, et restent dans le
 * stockage aussi longtemps que la photo. Rien dans le module de diagnostic n'en
 * a le moindre usage : l'adresse du client n'aide pas à reconnaître un
 * champignon. **Ce qui n'est pas conservé ne peut pas fuir** (`docs/RGPD.md`
 * §4) — et c'est ici la mesure la moins coûteuse qui soit.
 *
 * **Le nettoyage est SANS RÉENCODAGE, et c'est délibéré.** Réencoder aurait
 * demandé une bibliothèque d'images — donc une dépendance de plus, du temps de
 * calcul sur chaque photo, et une perte de qualité au moment précis où le
 * détail compte (une pustule fait deux millimètres). On se contente de retirer
 * les blocs de métadonnées et de recopier les octets de l'image, à l'identique.
 *
 * **Ce que ça ne fait PAS, et qu'il faut savoir :** l'image reste l'image. Une
 * maison, une plaque d'immatriculation ou un visage au second plan y sont
 * toujours. C'est la conservation limitée qui répond à cela
 * (`src/lib/retention-diagnostic.ts`), pas ce fichier.
 *
 * Éprouvé sans réseau ni base par `scripts/test-exif.ts`, y compris contre des
 * fichiers tronqués ou malformés : une photo abîmée doit être refusée
 * proprement, jamais faire tomber une action serveur.
 */

export type ResultatNettoyage = {
  octets: Uint8Array;
  /** Vrai si le format est reconnu ET que le nettoyage a pu être mené. */
  nettoye: boolean;
  /** Les blocs effectivement retirés — pour le journal, jamais pour l'écran. */
  retires: string[];
};

/** Les types que l'on sait nettoyer. Tout ce qui n'y figure pas est refusé. */
export const TYPES_IMAGE_ACCEPTES = ["image/jpeg", "image/png", "image/webp"] as const;

export function typeImageAccepte(mimeType: string): boolean {
  return (TYPES_IMAGE_ACCEPTES as readonly string[]).includes(mimeType.split(";")[0].trim().toLowerCase());
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QU'ON ACCEPTE DE RANGER — plus large que ce qu'on sait nettoyer
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * **Deux listes, et ce n'est pas une duplication : elles répondent à deux
 * questions différentes.** « Sais-je retirer les métadonnées de ce format ? »
 * (ci-dessus) et « ai-je le droit de le ranger ? » (ci-dessous). Les confondre
 * ferait refuser des photos parfaitement inoffensives.
 *
 * **Le vrai danger n'est pas le format d'image, c'est le SVG.** Un SVG est un
 * document, pas une image : il porte du script, et servi depuis notre domaine
 * il s'exécute avec la session de l'artisan (audit du 23 août 2026, constat
 * M1). `startsWith("image/")` — ce que faisaient les photos de chantier et les
 * tickets de TVA — l'acceptait.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **HEIC ET HEIF ONT ÉTÉ RETIRÉS DE CETTE LISTE LE 24 AOÛT 2026, ET C'EST UN
 * REVIREMENT — il faut dire pourquoi, sinon quelqu'un les remettra.**
 *
 * Le matin même, ils y étaient : « ils ne portent aucun script, les refuser
 * serait un artisan qui photographie son ticket et lit un refus ». Le
 * raisonnement était juste sur le risque de script, et **il passait à côté du
 * vrai sujet** : nous ne savons pas retirer les métadonnées d'un HEIC. Les
 * accepter, c'était donc ranger les coordonnées GPS du domicile d'un client —
 * exactement ce que ce fichier existe pour empêcher.
 *
 * **Et le garde-fou était le mauvais.** On comptait sur iOS pour transcoder en
 * JPEG parce que l'attribut `accept` ne propose pas le HEIC. C'est vrai d'un
 * iPhone honnête, et cela ne vaut rien comme protection : `accept` est un
 * confort d'écran, pas une frontière. Qui poste directement au serveur ne
 * regarde aucun attribut.
 *
 * **Cette liste ne contient donc plus que ce qu'on sait NETTOYER**, et c'est sa
 * seule définition tenable. Le refus d'un HEIC brut, lui, se dit dans les mots
 * de l'artisan et lui donne le geste (`MESSAGE_HEIC_REFUSE`).
 *
 * **Ce qui a été écarté : convertir le HEIC côté serveur.** Il faudrait un
 * décodeur natif (libheif) — une bibliothèque en C qui analyserait un fichier
 * hostile, soit plus de surface d'attaque que ce qu'on referme. On refuse, on
 * l'explique, et le réglage de son iPhone règle le cas une fois pour toutes.
 */
export const TYPES_PHOTO_ACCEPTES = TYPES_IMAGE_ACCEPTES;

export function photoAcceptee(mimeType: string): boolean {
  return (TYPES_PHOTO_ACCEPTES as readonly string[]).includes(mimeType.split(";")[0].trim().toLowerCase());
}

/** Le format natif de l'iPhone — accepté nulle part, et nommé pour être expliqué. */
const TYPES_HEIC = ["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"];

export function estHeic(mimeType: string): boolean {
  return TYPES_HEIC.includes(mimeType.split(";")[0].trim().toLowerCase());
}

/**
 * L'attribut `accept` des champs photo — **et il ne contient PAS le HEIC.**
 *
 * iOS regarde cette liste : quand le HEIC n'y figure pas, il **transcode en
 * JPEG** avant l'envoi, appareil photo comme photothèque. C'est ce qui fait
 * qu'un iPhone ordinaire n'atteint jamais le refus du serveur.
 *
 * **Mais ce n'est PAS ce qui protège**, et la nuance a coûté un revirement le
 * 24 août : `accept` est un confort d'écran. La protection est la liste
 * serveur, qui ne contient que ce qu'on sait nettoyer. Les deux se ressemblent
 * désormais parce qu'elles disent la même chose, plus parce que l'une couvre
 * l'autre.
 */
export const ACCEPT_PHOTOS = TYPES_IMAGE_ACCEPTES.join(",");

/** Le refus à montrer, dans ses mots, quand le format n'est pas une photo. */
export const MESSAGE_PHOTO_REFUSEE =
  "Ce fichier n'est pas une photo. Prenez-la avec votre appareil, ou choisissez un JPEG, un PNG ou un WebP.";

/**
 * Le refus d'un HEIC — **il donne le geste, pas seulement le verdict**.
 *
 * Un artisan qui lit « format non pris en charge » sur un chantier n'a aucun
 * moyen d'avancer : c'est son téléphone qui décide du format, pas lui, et il ne
 * sait pas que ça se règle. La phrase nomme donc l'endroit exact.
 */
export const MESSAGE_HEIC_REFUSE =
  "Votre iPhone a envoyé cette photo au format HEIC, dont Atlas ne sait pas retirer les données de localisation. " +
  "Sur votre téléphone : Réglages, Appareil photo, Formats, « Le plus compatible ». Reprenez ensuite la photo.";

/**
 * Le refus quand le fichier n'est pas ce qu'il prétend être.
 *
 * **Ce cas-là n'est pas un format exotique : c'est un fichier maquillé.** Le
 * nettoyage vérifie la signature ; un SVG annoncé `image/jpeg` échoue ici, et
 * c'est ce refus qu'il lit.
 */
export const MESSAGE_PHOTO_ILLISIBLE =
  "Cette photo n'a pas pu être lue — elle est peut-être abîmée, ou ce n'est pas le format annoncé. Reprenez-la.";

/**
 * L'extension à poser sur la clé de stockage — **et c'est elle qui décidera du
 * type servi** (`src/lib/type-de-fichier.ts`). Une extension fausse ferait
 * afficher une image comme autre chose.
 */
export function extensionPhoto(mimeType: string): string {
  switch (mimeType.split(";")[0].trim().toLowerCase()) {
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/heic":
      return ".heic";
    case "image/heif":
      return ".heif";
    default:
      return ".jpg";
  }
}

/**
 * Nettoyer selon le type déclaré.
 *
 * **Le type n'est jamais deviné depuis le contenu, et le contenu doit
 * correspondre au type déclaré.** Un fichier annoncé `image/jpeg` qui ne
 * commence pas par la signature JPEG est refusé plutôt que passé tel quel :
 * laisser filer un fichier qu'on n'a pas su lire, c'est ranger des métadonnées
 * en croyant les avoir retirées — le pire des deux mondes, puisque la colonne
 * `exif_retire` affirmerait alors quelque chose de faux.
 */
export function retirerMetadonnees(octets: Uint8Array, mimeType: string): ResultatNettoyage {
  const type = mimeType.split(";")[0].trim().toLowerCase();
  try {
    if (type === "image/jpeg") return nettoyerJpeg(octets);
    if (type === "image/png") return nettoyerPng(octets);
    if (type === "image/webp") return nettoyerWebp(octets);
  } catch {
    // Un fichier malformé ne doit pas faire tomber une action serveur : le
    // patron verrait « Une erreur est survenue » sans rien pour comprendre.
    return { octets, nettoye: false, retires: [] };
  }
  return { octets, nettoye: false, retires: [] };
}

// ── JPEG ───────────────────────────────────────────────────────────────────
//
// Structure : `FFD8`, puis une suite de segments `FF <marqueur> <longueur sur
// 2 octets> <données>`, jusqu'à `FFDA` (début du balayage) après quoi viennent
// les données compressées, qu'on recopie telles quelles.
//
// **Ce qu'on retire :** APP1 (EXIF et XMP), APP2 (FlashPix), APP3 à APP13
// (Photoshop/IPTC, entre autres), APP15, et les commentaires (COM).
//
// **Ce qu'on GARDE, et pourquoi ce n'est pas un oubli :**
//  - `APP0` (JFIF) porte la densité de l'image — le retirer peut changer sa
//    taille d'affichage ;
//  - `APP14` (Adobe) porte la transformation de couleur. Sans lui, une image
//    CMJN ou YCCK se décode avec des couleurs fausses — et sur un diagnostic
//    où la couleur d'une tache est un critère, ce serait un défaut grave et
//    silencieux.
//
// Ces deux blocs ne contiennent aucune donnée personnelle.

const JPEG_SEGMENTS_A_RETIRER = new Set<number>([
  0xe1, 0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xeb, 0xec, 0xed, 0xef, 0xfe,
]);

function nomSegmentJpeg(marqueur: number): string {
  if (marqueur === 0xfe) return "COM";
  return `APP${marqueur - 0xe0}`;
}

function nettoyerJpeg(octets: Uint8Array): ResultatNettoyage {
  if (octets.length < 4 || octets[0] !== 0xff || octets[1] !== 0xd8) {
    return { octets, nettoye: false, retires: [] };
  }

  const morceaux: Uint8Array[] = [octets.subarray(0, 2)];
  const retires: string[] = [];
  let i = 2;

  while (i + 1 < octets.length) {
    if (octets[i] !== 0xff) {
      // Octet de remplissage toléré entre deux segments ; au-delà, le fichier
      // n'est pas ce qu'il prétend être.
      i++;
      continue;
    }
    const marqueur = octets[i + 1];

    // Fin du balayage : tout ce qui suit est de l'image compressée.
    if (marqueur === 0xda) {
      morceaux.push(octets.subarray(i));
      i = octets.length;
      break;
    }
    // Marqueurs sans charge utile.
    if (marqueur === 0xd8 || marqueur === 0xd9 || (marqueur >= 0xd0 && marqueur <= 0xd7) || marqueur === 0x01) {
      morceaux.push(octets.subarray(i, i + 2));
      i += 2;
      continue;
    }

    if (i + 3 >= octets.length) break;
    const longueur = (octets[i + 2] << 8) | octets[i + 3];
    // Une longueur inférieure à 2 rendrait la boucle infinie : le fichier est
    // corrompu, on s'arrête plutôt que de tourner.
    if (longueur < 2) break;
    const fin = Math.min(i + 2 + longueur, octets.length);

    if (JPEG_SEGMENTS_A_RETIRER.has(marqueur)) {
      retires.push(nomSegmentJpeg(marqueur));
    } else {
      morceaux.push(octets.subarray(i, fin));
    }
    i = fin;
  }

  return { octets: concatener(morceaux), nettoye: true, retires };
}

// ── PNG ────────────────────────────────────────────────────────────────────
//
// Signature de 8 octets, puis des blocs `<longueur 4> <type 4> <données> <CRC 4>`.
// Chaque bloc portant son propre CRC, en retirer un entier laisse les autres
// parfaitement valides — aucun recalcul nécessaire.

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
/** `eXIf` porte l'EXIF ; les trois blocs de texte et `tIME` portent le reste. */
const PNG_BLOCS_A_RETIRER = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "tIME"]);

function nettoyerPng(octets: Uint8Array): ResultatNettoyage {
  if (octets.length < 8 || !PNG_SIGNATURE.every((v, k) => octets[k] === v)) {
    return { octets, nettoye: false, retires: [] };
  }

  const morceaux: Uint8Array[] = [octets.subarray(0, 8)];
  const retires: string[] = [];
  const vue = new DataView(octets.buffer, octets.byteOffset, octets.byteLength);
  let i = 8;

  while (i + 8 <= octets.length) {
    const longueur = vue.getUint32(i);
    const type = String.fromCharCode(octets[i + 4], octets[i + 5], octets[i + 6], octets[i + 7]);
    const fin = i + 12 + longueur;
    if (fin > octets.length) break;

    if (PNG_BLOCS_A_RETIRER.has(type)) retires.push(type);
    else morceaux.push(octets.subarray(i, fin));

    i = fin;
    if (type === "IEND") break;
  }

  return { octets: concatener(morceaux), nettoye: true, retires };
}

// ── WebP ───────────────────────────────────────────────────────────────────
//
// Conteneur RIFF : `RIFF <taille 4, petit-boutiste> WEBP`, puis des blocs
// `<fourcc 4> <taille 4> <données, complétées à une taille paire>`.
//
// **Deux gestes, et le second est celui qu'on oublie :** retirer les blocs
// `EXIF` et `XMP `, ET éteindre les drapeaux correspondants dans `VP8X`. Un
// décodeur qui lit un drapeau EXIF sans trouver le bloc peut refuser l'image
// entière — on aurait alors « protégé » une photo devenue illisible.
// Et la taille annoncée par l'en-tête RIFF doit suivre, sans quoi le fichier
// est invalide.

const WEBP_BLOCS_A_RETIRER = new Set(["EXIF", "XMP "]);
const VP8X_DRAPEAU_EXIF = 0x08;
const VP8X_DRAPEAU_XMP = 0x04;

function nettoyerWebp(octets: Uint8Array): ResultatNettoyage {
  const enTete = (k: number) => String.fromCharCode(octets[k], octets[k + 1], octets[k + 2], octets[k + 3]);
  if (octets.length < 12 || enTete(0) !== "RIFF" || enTete(8) !== "WEBP") {
    return { octets, nettoye: false, retires: [] };
  }

  const vue = new DataView(octets.buffer, octets.byteOffset, octets.byteLength);
  const morceaux: Uint8Array[] = [];
  const retires: string[] = [];
  let i = 12;

  while (i + 8 <= octets.length) {
    const fourcc = enTete(i);
    const taille = vue.getUint32(i + 4, true);
    // Un bloc de taille impaire est suivi d'un octet de remplissage.
    const fin = Math.min(i + 8 + taille + (taille % 2), octets.length);

    if (WEBP_BLOCS_A_RETIRER.has(fourcc)) {
      retires.push(fourcc.trim());
    } else if (fourcc === "VP8X" && taille >= 10) {
      const copie = octets.slice(i, fin);
      copie[8] &= ~(VP8X_DRAPEAU_EXIF | VP8X_DRAPEAU_XMP);
      morceaux.push(copie);
    } else {
      morceaux.push(octets.subarray(i, fin));
    }

    i = fin;
  }

  const corps = concatener(morceaux);
  const resultat = new Uint8Array(12 + corps.length);
  resultat.set(octets.subarray(0, 12));
  resultat.set(corps, 12);
  // La taille RIFF compte tout ce qui suit ce champ : « WEBP » (4) plus les blocs.
  new DataView(resultat.buffer).setUint32(4, 4 + corps.length, true);

  return { octets: resultat, nettoye: true, retires };
}

function concatener(morceaux: Uint8Array[]): Uint8Array {
  const total = morceaux.reduce((n, m) => n + m.length, 0);
  const resultat = new Uint8Array(total);
  let position = 0;
  for (const morceau of morceaux) {
    resultat.set(morceau, position);
    position += morceau.length;
  }
  return resultat;
}

/**
 * Reste-t-il un bloc de métadonnées ?
 *
 * **Un contrôle qui ne sait pas échouer ne prouve rien** (`CLAUDE.md` §5).
 * Cette fonction sert aux suites à le vérifier sur l'octet, plutôt qu'à croire
 * la fonction de nettoyage sur parole — c'est-à-dire à vérifier une chose avec
 * la chose elle-même, ce qui ne vérifie rien.
 */
export function porteEncoreDesMetadonnees(octets: Uint8Array, mimeType: string): boolean {
  const type = mimeType.split(";")[0].trim().toLowerCase();

  if (type === "image/jpeg") {
    for (let i = 2; i + 3 < octets.length; ) {
      if (octets[i] !== 0xff) {
        i++;
        continue;
      }
      const marqueur = octets[i + 1];
      if (marqueur === 0xda) return false;
      if (marqueur === 0xd8 || marqueur === 0xd9 || (marqueur >= 0xd0 && marqueur <= 0xd7) || marqueur === 0x01) {
        i += 2;
        continue;
      }
      if (JPEG_SEGMENTS_A_RETIRER.has(marqueur)) return true;
      const longueur = (octets[i + 2] << 8) | octets[i + 3];
      if (longueur < 2) return false;
      i += 2 + longueur;
    }
    return false;
  }

  if (type === "image/png") {
    for (let i = 8; i + 8 <= octets.length; ) {
      const longueur = new DataView(octets.buffer, octets.byteOffset, octets.byteLength).getUint32(i);
      const bloc = String.fromCharCode(octets[i + 4], octets[i + 5], octets[i + 6], octets[i + 7]);
      if (PNG_BLOCS_A_RETIRER.has(bloc)) return true;
      if (bloc === "IEND") return false;
      i += 12 + longueur;
    }
    return false;
  }

  if (type === "image/webp") {
    const vue = new DataView(octets.buffer, octets.byteOffset, octets.byteLength);
    for (let i = 12; i + 8 <= octets.length; ) {
      const fourcc = String.fromCharCode(octets[i], octets[i + 1], octets[i + 2], octets[i + 3]);
      const taille = vue.getUint32(i + 4, true);
      if (WEBP_BLOCS_A_RETIRER.has(fourcc)) return true;
      if (fourcc === "VP8X" && taille >= 10 && (octets[i + 8] & (VP8X_DRAPEAU_EXIF | VP8X_DRAPEAU_XMP)) !== 0) {
        return true;
      }
      i += 8 + taille + (taille % 2);
    }
    return false;
  }

  return false;
}
