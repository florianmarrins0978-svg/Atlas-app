/**
 * Des fichiers audio de laboratoire — **fabriqués ici, jamais téléchargés.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **POURQUOI ILS SONT FABRIQUÉS PLUTÔT QUE POSÉS DANS LE DÉPÔT.**
 *
 * Un octet écrit à la main se relit : on voit POURQUOI il est là. Un fichier
 * binaire déposé à côté ne se relit pas — on le croit sur parole, et le jour où
 * un contrôle rougit dessus, personne ne sait s'il faut accuser le contrôle ou
 * le fichier. Ici, chaque en-tête porte son commentaire.
 *
 * **Ce que ces témoins SONT :** des en-têtes réels, conformes à ce que produit
 * un vrai encodeur, suivis d'un corps de remplissage. Ce sont donc de vrais
 * conteneurs, pas des chaînes magiques recopiées.
 *
 * **Ce qu'ils NE SONT PAS :** de l'audio décodable. Aucun ne contient un son.
 * C'est délibéré et il faut le dire — une reconnaissance de format ne prétend
 * pas qu'un fichier se décode, seulement qu'il annonce honnêtement ce qu'il est.
 * Confondre les deux serait promettre ce qu'on ne tient pas.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **CE QUI NE PEUT PAS ÊTRE ÉPROUVÉ ICI, ET QUI DOIT L'ÊTRE AILLEURS.**
 *
 * Ce poste n'a ni iPhone, ni Safari, ni Android. Les témoins reproduisent ce
 * que ces appareils écrivent — relevé des spécifications, pas d'un appareil —,
 * et cela ne remplace pas une vraie dictée sur son espace. La règle du patron
 * tient : si un format légitime échoue chez lui, on n'ouvre pas de repli sur le
 * type déclaré, **on élargit la reconnaissance**.
 */

/** Un corps de remplissage, pour que le fichier ait un poids réaliste. */
function bourrage(n: number, valeur = 0x00): Uint8Array {
  return new Uint8Array(n).fill(valeur);
}

function concat(...morceaux: Uint8Array[]): Uint8Array {
  const total = morceaux.reduce((n, m) => n + m.length, 0);
  const sortie = new Uint8Array(total);
  let i = 0;
  for (const m of morceaux) {
    sortie.set(m, i);
    i += m.length;
  }
  return sortie;
}

function ascii(texte: string): Uint8Array {
  return new Uint8Array([...texte].map((c) => c.charCodeAt(0)));
}

// ─────────────────────────────────────────────────────────────────────────────
// WebM / Matroska — ce que produit Chrome sur Android et sur PC.
//
// L'en-tête EBML : la marque `1A 45 DF A3`, puis sa taille, puis les éléments
// de l'en-tête. Le `DocType` (`42 82`) vaut « webm » et il arrive TÔT — c'est
// le premier élément que tout encodeur écrit, et c'est ce qui distingue un
// WebM d'un Matroska vidéo quelconque.
// ─────────────────────────────────────────────────────────────────────────────
export function temoinWebm(): Uint8Array {
  const docType = concat(new Uint8Array([0x42, 0x82, 0x85]), ascii("webm\0"));
  const entete = concat(
    new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]), // EBML
    new Uint8Array([0x9f]), // taille de l'en-tête, sur un octet
    new Uint8Array([0x42, 0x86, 0x81, 0x01]), // EBMLVersion = 1
    new Uint8Array([0x42, 0xf7, 0x81, 0x01]), // EBMLReadVersion = 1
    docType,
    new Uint8Array([0x42, 0x87, 0x81, 0x02]), // DocTypeVersion = 2
    new Uint8Array([0x42, 0x85, 0x81, 0x02]) // DocTypeReadVersion = 2
  );
  // Le Segment qui suit, de taille inconnue — exactement ce qu'écrit un
  // enregistrement en direct, qui ne connaît pas encore sa durée.
  const segment = new Uint8Array([0x18, 0x53, 0x80, 0x67, 0xff]);
  return concat(entete, segment, bourrage(2048));
}

// ─────────────────────────────────────────────────────────────────────────────
// MP4 / M4A — ce que produit Safari sur iPhone.
//
// **La signature `ftyp` est à l'octet 4, jamais à 0** : les quatre premiers
// octets portent la TAILLE de la boîte. Une vérification écrite « en tête »
// refuserait toutes les dictées d'iPhone — c'est le risque de régression n° 1.
// ─────────────────────────────────────────────────────────────────────────────
export function temoinM4aIphone(): Uint8Array {
  const marques = concat(ascii("M4A "), ascii("mp42"), ascii("isom"));
  const corpsFtyp = concat(
    ascii("M4A "), // marque majeure
    new Uint8Array([0x00, 0x00, 0x00, 0x00]), // version mineure
    marques // marques compatibles
  );
  const taille = 8 + corpsFtyp.length;
  const ftyp = concat(
    new Uint8Array([(taille >> 24) & 255, (taille >> 16) & 255, (taille >> 8) & 255, taille & 255]),
    ascii("ftyp"),
    corpsFtyp
  );
  // Une boîte `mdat` derrière : un fichier qui n'aurait que son `ftyp` ne
  // ressemblerait à rien de réel.
  const mdat = concat(new Uint8Array([0x00, 0x00, 0x04, 0x08]), ascii("mdat"), bourrage(1024));
  return concat(ftyp, mdat);
}

/** La même chose, marque `isom` — ce que produisent d'autres encodeurs. */
export function temoinMp4Isom(): Uint8Array {
  const corpsFtyp = concat(ascii("isom"), new Uint8Array([0, 0, 2, 0]), ascii("isomiso2mp41"));
  const taille = 8 + corpsFtyp.length;
  return concat(
    new Uint8Array([(taille >> 24) & 255, (taille >> 16) & 255, (taille >> 8) & 255, taille & 255]),
    ascii("ftyp"),
    corpsFtyp,
    bourrage(512)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OGG / Opus — ce que produit Firefox.
//
// Une page Ogg : « OggS », la version (0), le type de page (bit 2 = début de
// flux), puis les compteurs. Le premier paquet porte « OpusHead », qui dit que
// c'est de l'audio Opus et pas une vidéo Theora.
// ─────────────────────────────────────────────────────────────────────────────
export function temoinOggOpus(): Uint8Array {
  const entete = concat(
    ascii("OggS"),
    new Uint8Array([0x00]), // version
    new Uint8Array([0x02]), // début de flux
    bourrage(8), // position granulaire
    new Uint8Array([0x01, 0x02, 0x03, 0x04]), // numéro de série
    new Uint8Array([0x00, 0x00, 0x00, 0x00]), // numéro de page
    new Uint8Array([0x00, 0x00, 0x00, 0x00]), // somme de contrôle
    new Uint8Array([0x01]), // un segment
    new Uint8Array([19]) // sa longueur
  );
  const opusHead = concat(
    ascii("OpusHead"),
    new Uint8Array([0x01, 0x02]), // version, canaux
    new Uint8Array([0x38, 0x01]), // pré-remplissage
    new Uint8Array([0x80, 0xbb, 0x00, 0x00]), // 48000 Hz
    new Uint8Array([0x00, 0x00, 0x00])
  );
  return concat(entete, opusHead, bourrage(1024));
}

// ─────────────────────────────────────────────────────────────────────────────
// WAV — « RIFF », la taille, « WAVE », puis le morceau « fmt ».
// ─────────────────────────────────────────────────────────────────────────────
export function temoinWav(): Uint8Array {
  const donnees = bourrage(1024);
  const fmt = concat(
    ascii("fmt "),
    new Uint8Array([16, 0, 0, 0]), // taille du morceau
    new Uint8Array([1, 0]), // PCM
    new Uint8Array([1, 0]), // mono
    new Uint8Array([0x44, 0xac, 0, 0]), // 44100 Hz
    new Uint8Array([0x88, 0x58, 0x01, 0]), // octets par seconde
    new Uint8Array([2, 0]), // alignement
    new Uint8Array([16, 0]) // bits par échantillon
  );
  const morceauDonnees = concat(
    ascii("data"),
    new Uint8Array([
      donnees.length & 255,
      (donnees.length >> 8) & 255,
      (donnees.length >> 16) & 255,
      (donnees.length >> 24) & 255,
    ]),
    donnees
  );
  const taille = 4 + fmt.length + morceauDonnees.length;
  return concat(
    ascii("RIFF"),
    new Uint8Array([taille & 255, (taille >> 8) & 255, (taille >> 16) & 255, (taille >> 24) & 255]),
    ascii("WAVE"),
    fmt,
    morceauDonnees
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FLAC — « fLaC », puis le bloc STREAMINFO (type 0), long de 34 octets.
// ─────────────────────────────────────────────────────────────────────────────
export function temoinFlac(): Uint8Array {
  const streamInfo = concat(
    new Uint8Array([0x00]), // dernier bloc = non, type 0
    new Uint8Array([0x00, 0x00, 0x22]), // 34 octets
    bourrage(34)
  );
  return concat(ascii("fLaC"), streamInfo, bourrage(512));
}

// ─────────────────────────────────────────────────────────────────────────────
// MP3 — le format qui n'a PAS de signature fiable, et c'est tout le sujet.
//
// Une trame MPEG-1 Layer III commence par onze bits à 1 (la « synchro »), puis
// la version, la couche, le débit et la fréquence. **Deux octets `FF Ex` ne
// prouvent rien** : ils apparaissent par hasard dans n'importe quel fichier
// binaire. Ce qui prouve, c'est une SUITE de trames dont chacune tombe
// exactement là où la précédente annonçait qu'elle finirait.
//
// Ici : MPEG-1 Layer III, 128 kbit/s, 44,1 kHz, sans bourrage.
// Longueur d'une trame = 144 × 128000 ÷ 44100 = 417 octets.
// ─────────────────────────────────────────────────────────────────────────────
export function trameMp3(): Uint8Array {
  const trame = new Uint8Array(417);
  trame[0] = 0xff;
  trame[1] = 0xfb; // MPEG-1, Layer III, pas de CRC
  trame[2] = 0x90; // débit 128 kbit/s, 44,1 kHz, pas de bourrage
  trame[3] = 0x00;
  return trame;
}

/** Un MP3 sans ID3 : rien que des trames, comme en produit un encodeur brut. */
export function temoinMp3SansId3(nombreDeTrames = 12): Uint8Array {
  return concat(...Array.from({ length: nombreDeTrames }, () => trameMp3()));
}

/** Un MP3 précédé de son étiquette ID3v2 — le cas le plus courant. */
export function temoinMp3AvecId3(): Uint8Array {
  const contenuEtiquette = bourrage(200);
  // La taille d'ID3 est « syncsafe » : sept bits utiles par octet.
  const n = contenuEtiquette.length;
  const taille = new Uint8Array([
    (n >> 21) & 0x7f,
    (n >> 14) & 0x7f,
    (n >> 7) & 0x7f,
    n & 0x7f,
  ]);
  const entete = concat(ascii("ID3"), new Uint8Array([0x04, 0x00, 0x00]), taille);
  return concat(entete, contenuEtiquette, temoinMp3SansId3(8));
}

// ─────────────────────────────────────────────────────────────────────────────
// AAC brut (ADTS) — même piège que MP3, même remède.
//
// L'en-tête fait sept octets et porte LA LONGUEUR DE LA TRAME sur treize bits :
// c'est elle qui permet d'aller vérifier la trame suivante.
// ─────────────────────────────────────────────────────────────────────────────
export function trameAdts(longueur = 200): Uint8Array {
  const trame = new Uint8Array(longueur);
  const profil = 1; // AAC LC
  const indexFrequence = 4; // 44,1 kHz
  const canaux = 2;
  const remplissage = 0x7ff; // débit variable

  trame[0] = 0xff;
  trame[1] = 0xf1; // MPEG-4, couche 00, pas de CRC
  trame[2] = (profil << 6) | (indexFrequence << 2) | ((canaux >> 2) & 1);
  trame[3] = ((canaux & 3) << 6) | ((longueur >> 11) & 3);
  trame[4] = (longueur >> 3) & 0xff;
  trame[5] = ((longueur & 7) << 5) | ((remplissage >> 6) & 0x1f);
  trame[6] = ((remplissage & 0x3f) << 2) | 0x00; // une seule unité par trame
  return trame;
}

export function temoinAacAdts(nombreDeTrames = 10): Uint8Array {
  return concat(...Array.from({ length: nombreDeTrames }, () => trameAdts()));
}

// ─────────────────────────────────────────────────────────────────────────────
// LES HOSTILES
// ─────────────────────────────────────────────────────────────────────────────

export function temoinHtml(): Uint8Array {
  return ascii("<!doctype html><html><script>alert(document.cookie)</script></html>");
}

export function temoinSvg(): Uint8Array {
  return ascii('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
}

export function temoinZip(): Uint8Array {
  return concat(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), bourrage(512));
}

/**
 * Un faux MP3 : deux octets qui RESSEMBLENT à une synchro, et rien derrière.
 *
 * C'est exactement ce qu'un contrôle à deux octets laisserait passer — et c'est
 * pourquoi la reconnaissance exige une suite de trames cohérentes.
 */
export function temoinFausseSynchroMp3(): Uint8Array {
  const faux = bourrage(2048, 0x41); // du texte, en réalité
  faux[0] = 0xff;
  faux[1] = 0xfb;
  faux[2] = 0x90;
  faux[3] = 0x00;
  return faux;
}

/** Le même piège pour l'AAC : un en-tête plausible, aucune trame derrière. */
export function temoinFausseSynchroAac(): Uint8Array {
  const faux = bourrage(2048, 0x42);
  const entete = trameAdts(200).subarray(0, 7);
  faux.set(entete, 0);
  return faux;
}
