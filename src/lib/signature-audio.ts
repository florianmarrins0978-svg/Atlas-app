/**
 * Le format d'un audio — **lu dans ses octets, jamais dans ce que le téléphone
 * annonce.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **LA PROPRIÉTÉ VISÉE, posée par le patron le 26 août 2026 :**
 *
 *   « Un fichier audio n'est accepté, stocké ou envoyé à un fournisseur de
 *     transcription que si Atlas peut identifier son format avec un niveau de
 *     confiance suffisant. Le type déclaré par le navigateur peut aider à
 *     vérifier la cohérence, mais ne doit jamais constituer à lui seul la
 *     décision finale. »
 *
 * **Format inconnu → REFUS.** C'est sa correction à ce qui avait été proposé —
 * « laisser passer quand la signature est illisible » aurait gardé une moitié
 * du défaut. Et sa règle vaut pour la suite : **si un format légitime échoue
 * chez lui, on n'ouvre pas de repli sur `File.type`, on élargit ce fichier.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **CE QUE CE FICHIER N'EST PAS : un décodeur.**
 *
 * Aucun conteneur n'est parcouru. Lire un Matroska ou un ISO-BMFF entier, c'est
 * écrire un analyseur binaire sur une entrée hostile : on remplacerait un abus
 * de ressource par une vraie surface d'attaque, et le remède serait pire que le
 * mal. On lit des en-têtes, à des positions fixes, sur quelques kilo-octets au
 * plus.
 *
 * **Et reconnaître n'est pas garantir qu'un son se décode.** Un enregistrement
 * coupé garde son en-tête et reste reconnaissable ; s'il porte du son, c'est la
 * transcription qui le dira. Le promettre serait mentir.
 *
 * **Le précédent est dans le dépôt :** `src/lib/exif.ts` vérifie déjà des
 * signatures d'images en TypeScript nu, sans la moindre bibliothèque. Celui-ci
 * fait de même. Éprouvé sans base ni réseau — `scripts/test-signature-audio.ts`.
 */

export type FormatAudio = "webm" | "mp4" | "ogg" | "wav" | "flac" | "mp3" | "aac";

/**
 * Ce qu'Atlas ANNONCE pour un format reconnu — et ce qu'il range.
 *
 * **Ces deux tables sont la raison d'être du lot.** Avant, l'extension sortait
 * de `extensionPour(fichier.type)`, donc de la chaîne du navigateur ; et c'est
 * cette extension qui décidait plus tard, via `typeDepuisCle`, du
 * `Content-Type` servi. Le téléphone commandait donc, indirectement, ce
 * qu'Atlas annoncerait à un navigateur. Désormais, c'est le format réel.
 */
export const MIME_PAR_FORMAT: Record<FormatAudio, string> = {
  webm: "audio/webm",
  mp4: "audio/mp4",
  ogg: "audio/ogg",
  wav: "audio/wav",
  flac: "audio/flac",
  mp3: "audio/mpeg",
  aac: "audio/aac",
};

export const EXTENSION_PAR_FORMAT: Record<FormatAudio, string> = {
  webm: ".webm",
  // `.m4a` et non `.mp4` : c'est l'extension d'un MP4 qui ne porte que du son,
  // et c'est celle que `typeDepuisCle` associe déjà à `audio/mp4`.
  mp4: ".m4a",
  ogg: ".ogg",
  wav: ".wav",
  flac: ".flac",
  mp3: ".mp3",
  aac: ".aac",
};

// ─────────────────────────────────────────────────────────────────────────────
// Outils de lecture — bornés, et qui ne lèvent jamais.
// ─────────────────────────────────────────────────────────────────────────────

function estAscii(octets: Uint8Array, position: number, texte: string): boolean {
  if (position + texte.length > octets.length) return false;
  for (let i = 0; i < texte.length; i++) {
    if (octets[position + i] !== texte.charCodeAt(i)) return false;
  }
  return true;
}

/** Cherche une suite de caractères dans les `limite` premiers octets. */
function contient(octets: Uint8Array, texte: string, limite: number): boolean {
  const fin = Math.min(octets.length, limite) - texte.length;
  for (let i = 0; i <= fin; i++) if (estAscii(octets, i, texte)) return true;
  return false;
}

function entier32(octets: Uint8Array, position: number): number {
  return (
    (octets[position] << 24) |
    (octets[position + 1] << 16) |
    (octets[position + 2] << 8) |
    octets[position + 3]
  ) >>> 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// LES CONTENEURS À SIGNATURE — simples, et suffisants.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * WebM / Matroska.
 *
 * La marque EBML `1A 45 DF A3`, **plus le `DocType`**. La marque seule
 * couvrirait tout Matroska, vidéo comprise ; le `DocType` est le tout premier
 * élément qu'écrit un encodeur, et il tient dans les 64 premiers octets.
 */
function estWebm(octets: Uint8Array): boolean {
  if (octets.length < 8) return false;
  if (!(octets[0] === 0x1a && octets[1] === 0x45 && octets[2] === 0xdf && octets[3] === 0xa3)) {
    return false;
  }
  return contient(octets, "webm", 64) || contient(octets, "matroska", 64);
}

/**
 * MP4 / M4A — ce que Safari écrit sur iPhone.
 *
 * **`ftyp` est à l'octet 4, jamais à 0** : les quatre premiers octets portent
 * la TAILLE de la boîte. Une vérification écrite « en tête » refuserait toutes
 * les dictées d'iPhone — c'est le risque de régression n° 1 de ce lot.
 *
 * Trois contrôles au lieu d'un, et chacun a sa raison :
 *   1. la taille annoncée est plausible — une boîte `ftyp` fait quelques
 *      dizaines d'octets, jamais des méga-octets ;
 *   2. elle est alignée sur quatre, comme toute boîte ISO-BMFF ;
 *   3. la marque majeure est imprimable — c'est un code à quatre lettres.
 *
 * Ensemble, ils rendent une collision fortuite très improbable, sans parcourir
 * le fichier.
 */
function estMp4(octets: Uint8Array): boolean {
  if (octets.length < 16) return false;
  if (!estAscii(octets, 4, "ftyp")) return false;

  const taille = entier32(octets, 0);
  if (taille < 16 || taille > 4096 || taille % 4 !== 0) return false;

  for (let i = 8; i < 12; i++) {
    if (octets[i] < 0x20 || octets[i] > 0x7e) return false;
  }
  return true;
}

/**
 * OGG.
 *
 * « OggS », la version 0, et le drapeau « début de flux » sur la première page.
 * **Plus le codec** : sans lui, une vidéo Theora passerait pour de l'audio. Le
 * premier paquet tient dans les premières centaines d'octets.
 */
function estOgg(octets: Uint8Array): boolean {
  if (octets.length < 28) return false;
  if (!estAscii(octets, 0, "OggS")) return false;
  if (octets[4] !== 0x00) return false;
  if ((octets[5] & 0x02) === 0) return false; // première page = début de flux

  return (
    contient(octets, "OpusHead", 256) ||
    contient(octets, "vorbis", 256) ||
    contient(octets, "Speex", 256) ||
    contient(octets, "FLAC", 256)
  );
}

/** WAV — « RIFF », « WAVE », et le morceau « fmt » qui décrit le son. */
function estWav(octets: Uint8Array): boolean {
  if (octets.length < 16) return false;
  if (!estAscii(octets, 0, "RIFF")) return false;
  if (!estAscii(octets, 8, "WAVE")) return false;
  return contient(octets, "fmt ", 64);
}

/**
 * FLAC — « fLaC », puis le premier bloc de métadonnées.
 *
 * Le type de bloc tient sur sept bits et ne dépasse jamais 6. Un STREAMINFO
 * (type 0) fait exactement 34 octets : c'est une constante du format, donc un
 * contrôle gratuit et sûr.
 */
function estFlac(octets: Uint8Array): boolean {
  if (octets.length < 8) return false;
  if (!estAscii(octets, 0, "fLaC")) return false;

  const type = octets[4] & 0x7f;
  if (type > 6) return false;
  const longueur = (octets[5] << 16) | (octets[6] << 8) | octets[7];
  if (longueur === 0) return false;
  if (type === 0 && longueur !== 34) return false;
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// LES DEUX FORMATS SANS SIGNATURE — MP3 et AAC.
//
// **Deux octets ne prouvent RIEN.** `FF Ex` apparaît par hasard dans n'importe
// quel fichier binaire : un contrôle qui s'y arrêterait accepterait une image,
// une archive, du texte. Ce qui prouve, c'est une SUITE de trames dont chacune
// tombe exactement là où la précédente annonçait qu'elle finirait — et dont les
// caractéristiques ne changent pas en route.
//
// C'est ce que fait un décodeur pour se synchroniser, sans rien décoder.
// ─────────────────────────────────────────────────────────────────────────────

/** Combien de trames d'affilée il faut pour être sûr. */
const TRAMES_EXIGEES = 3;
/** Jusqu'où l'on cherche un début de trame. Au-delà, ce n'est pas de l'audio. */
const FENETRE_DE_RECHERCHE = 8192;

// Débits MPEG audio, en kbit/s, par index (1 à 14).
const DEBITS_V1_L1 = [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448];
const DEBITS_V1_L2 = [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384];
const DEBITS_V1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const DEBITS_V2_L1 = [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256];
const DEBITS_V2_L23 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];

const FREQUENCES_V1 = [44100, 48000, 32000];
const FREQUENCES_V2 = [22050, 24000, 16000];
const FREQUENCES_V25 = [11025, 12000, 8000];

type TrameMpeg = { longueur: number; version: number; couche: number; frequence: number };

/** Lit un en-tête de trame MPEG audio. Rend `null` si quoi que ce soit cloche. */
function lireTrameMpeg(octets: Uint8Array, position: number): TrameMpeg | null {
  if (position + 4 > octets.length) return null;
  if (octets[position] !== 0xff) return null;
  if ((octets[position + 1] & 0xe0) !== 0xe0) return null; // onze bits de synchro

  const version = (octets[position + 1] >> 3) & 0x03; // 1 = réservé
  const couche = (octets[position + 1] >> 1) & 0x03; // 0 = réservé
  if (version === 1 || couche === 0) return null;

  const indexDebit = (octets[position + 2] >> 4) & 0x0f;
  const indexFrequence = (octets[position + 2] >> 2) & 0x03;
  const bourrage = (octets[position + 2] >> 1) & 0x01;
  // 0 = « libre », 15 = interdit : ni l'un ni l'autre n'apparaît dans un
  // fichier produit par un encodeur réel.
  if (indexDebit === 0 || indexDebit === 15 || indexFrequence === 3) return null;

  const estV1 = version === 3;
  const frequences = estV1 ? FREQUENCES_V1 : version === 2 ? FREQUENCES_V2 : FREQUENCES_V25;
  const frequence = frequences[indexFrequence];

  const table = estV1
    ? couche === 3
      ? DEBITS_V1_L1
      : couche === 2
        ? DEBITS_V1_L2
        : DEBITS_V1_L3
    : couche === 3
      ? DEBITS_V2_L1
      : DEBITS_V2_L23;
  const debit = table[indexDebit] * 1000;
  if (!debit) return null;

  let longueur: number;
  if (couche === 3) {
    // Couche I : les trames se comptent en groupes de quatre octets.
    longueur = (Math.floor((12 * debit) / frequence) + bourrage) * 4;
  } else {
    // Couches II et III. MPEG-2 et 2.5 ont deux fois moins d'échantillons par
    // trame en couche III : l'oublier décale la trame suivante, et la chaîne
    // casse sur un fichier parfaitement valable.
    const echantillons = estV1 || couche === 2 ? 144 : 72;
    longueur = Math.floor((echantillons * debit) / frequence) + bourrage;
  }
  if (longueur < 8) return null;
  return { longueur, version, couche, frequence };
}

/**
 * Y a-t-il une chaîne de trames MPEG cohérente à partir d'ici ?
 *
 * **La cohérence, et pas seulement la validité :** un fichier quelconque peut
 * contenir un en-tête plausible par hasard ; il n'en contient pas trois qui
 * s'enchaînent au bon endroit avec la même version, la même couche et la même
 * fréquence.
 *
 * **Le débit, lui, a le droit de changer** — c'est tout le principe du débit
 * variable, et l'exiger constant refuserait la moitié des MP3 du monde.
 */
function chaineMpeg(octets: Uint8Array, depart: number): boolean {
  const premiere = lireTrameMpeg(octets, depart);
  if (!premiere) return false;

  let position = depart;
  let precedente = premiere;
  for (let n = 1; n < TRAMES_EXIGEES; n++) {
    position += precedente.longueur;
    const suivante = lireTrameMpeg(octets, position);
    if (!suivante) return false;
    if (
      suivante.version !== premiere.version ||
      suivante.couche !== premiere.couche ||
      suivante.frequence !== premiere.frequence
    ) {
      return false;
    }
    precedente = suivante;
  }
  return true;
}

function estMp3(octets: Uint8Array): boolean {
  let depart = 0;

  // L'étiquette ID3v2 : sa taille est « syncsafe » — sept bits utiles par
  // octet, le huitième étant toujours à zéro. La sauter mène droit aux trames.
  if (estAscii(octets, 0, "ID3") && octets.length > 10) {
    const taille =
      ((octets[6] & 0x7f) << 21) |
      ((octets[7] & 0x7f) << 14) |
      ((octets[8] & 0x7f) << 7) |
      (octets[9] & 0x7f);
    const pied = (octets[5] & 0x10) !== 0 ? 10 : 0;
    depart = 10 + taille + pied;
    if (chaineMpeg(octets, depart)) return true;
    // L'étiquette peut mentir sur sa taille : on repart de la fin annoncée, et
    // à défaut du début. **`ID3` seul ne suffit jamais** — trois octets de
    // texte ne font pas un MP3.
    depart = Math.min(depart, octets.length);
  }

  const fin = Math.min(octets.length, depart + FENETRE_DE_RECHERCHE);
  for (let i = depart; i < fin; i++) {
    if (octets[i] !== 0xff) continue;
    if (chaineMpeg(octets, i)) return true;
  }
  // Une étiquette ID3 dont on n'a rien trouvé derrière : on tente aussi depuis
  // le tout début, au cas où la taille annoncée aurait sauté par-dessus.
  if (depart > 0) {
    const finDepuisZero = Math.min(octets.length, FENETRE_DE_RECHERCHE);
    for (let i = 0; i < finDepuisZero; i++) {
      if (octets[i] !== 0xff) continue;
      if (chaineMpeg(octets, i)) return true;
    }
  }
  return false;
}

type TrameAdts = { longueur: number; profil: number; frequence: number; canaux: number };

/**
 * Lit un en-tête ADTS — sept octets, et il porte SA PROPRE LONGUEUR.
 *
 * C'est ce champ qui rend la vérification en chaîne possible sans rien décoder.
 */
function lireTrameAdts(octets: Uint8Array, position: number): TrameAdts | null {
  if (position + 7 > octets.length) return null;
  if (octets[position] !== 0xff) return null;
  if ((octets[position + 1] & 0xf0) !== 0xf0) return null; // douze bits de synchro
  if (((octets[position + 1] >> 1) & 0x03) !== 0) return null; // la couche vaut toujours 00

  const profil = (octets[position + 2] >> 6) & 0x03;
  const indexFrequence = (octets[position + 2] >> 2) & 0x0f;
  if (indexFrequence > 12) return null; // 13, 14 réservés ; 15 = explicite, hors ADTS

  const canaux = ((octets[position + 2] & 0x01) << 2) | ((octets[position + 3] >> 6) & 0x03);
  if (canaux === 0) return null; // 0 = « décrit ailleurs », ce qu'ADTS ne fait pas

  const longueur =
    ((octets[position + 3] & 0x03) << 11) |
    (octets[position + 4] << 3) |
    ((octets[position + 5] >> 5) & 0x07);
  const entete = (octets[position + 1] & 0x01) === 0 ? 9 : 7; // avec ou sans CRC
  if (longueur <= entete || longueur > 8192) return null;

  return { longueur, profil, frequence: indexFrequence, canaux };
}

function chaineAdts(octets: Uint8Array, depart: number): boolean {
  const premiere = lireTrameAdts(octets, depart);
  if (!premiere) return false;

  let position = depart;
  let precedente = premiere;
  for (let n = 1; n < TRAMES_EXIGEES; n++) {
    position += precedente.longueur;
    const suivante = lireTrameAdts(octets, position);
    if (!suivante) return false;
    if (
      suivante.profil !== premiere.profil ||
      suivante.frequence !== premiere.frequence ||
      suivante.canaux !== premiere.canaux
    ) {
      return false;
    }
    precedente = suivante;
  }
  return true;
}

function estAac(octets: Uint8Array): boolean {
  const fin = Math.min(octets.length, FENETRE_DE_RECHERCHE);
  for (let i = 0; i < fin; i++) {
    if (octets[i] !== 0xff) continue;
    if (chaineAdts(octets, i)) return true;
  }
  return false;
}

/**
 * Le format de ces octets — ou `null` si Atlas ne peut pas l'affirmer.
 *
 * **L'ordre compte.** Les conteneurs à signature passent d'abord : ils sont
 * sûrs et coûtent quatre comparaisons. MP3 et AAC viennent en dernier, parce
 * qu'eux seuls parcourent des octets — et il serait absurde de chercher une
 * trame dans un fichier qui a déjà dit « je suis un WAV ».
 */
export function reconnaitreAudio(octets: Uint8Array): FormatAudio | null {
  if (octets.length < 8) return null;

  if (estWebm(octets)) return "webm";
  if (estMp4(octets)) return "mp4";
  if (estOgg(octets)) return "ogg";
  if (estWav(octets)) return "wav";
  if (estFlac(octets)) return "flac";
  if (estMp3(octets)) return "mp3";
  if (estAac(octets)) return "aac";
  return null;
}

export type AudioDecrit =
  | { ok: true; format: FormatAudio; mime: string; extension: string }
  | { ok: false; message: string };

export const MESSAGE_AUDIO_NON_RECONNU =
  "Ce fichier n'est pas un enregistrement audio reconnu. " +
  "Atlas accepte les formats des téléphones et des ordinateurs : webm, m4a, ogg, wav, mp3, aac, flac.";

/**
 * La porte : des octets et ce que le navigateur en dit, vers ce qu'Atlas range.
 *
 * **Le type déclaré ne décide de RIEN**, et c'est tout le lot. Il ne sert qu'à
 * nommer le coupable dans le message de refus — un patron qui lit « le
 * téléphone a annoncé audio/webm » sait quoi nous dire.
 *
 * **Et une DISCORDANCE ne refuse pas : elle est ignorée.** C'est un choix, et
 * il mérite d'être défendu. Le danger d'un type menteur était qu'Atlas le
 * recopie — or il ne le recopie plus nulle part : le format réel commande
 * l'extension rangée et le type servi. Refuser en plus rejetterait un cas
 * banal et parfaitement honnête : un fichier importé depuis un téléphone dont
 * l'extension ment sur le contenu. On perdrait une dictée réelle pour rien.
 */
export function decrireAudioEntrant(octets: Uint8Array, typeDeclare: string): AudioDecrit {
  const format = reconnaitreAudio(octets);
  if (!format) {
    const annonce = typeDeclare.trim() ? `« ${typeDeclare} »` : "aucun type";
    return {
      ok: false,
      message: `${MESSAGE_AUDIO_NON_RECONNU} (le téléphone a annoncé ${annonce})`,
    };
  }
  return {
    ok: true,
    format,
    mime: MIME_PAR_FORMAT[format],
    extension: EXTENSION_PAR_FORMAT[format],
  };
}
