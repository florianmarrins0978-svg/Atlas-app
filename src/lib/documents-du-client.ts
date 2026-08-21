/**
 * Les pièces d'un client, rangées — la règle, sans base.
 *
 * **D'où elle vient.** Le patron, le 20 août 2026, sur la fiche d'un client :
 * *« les devis rangés sous l'encadré devis au format PDF, trié par date, de la
 * plus récente à la moins récente »*, puis *« tu peux rajouter une colonne
 * facture et ranger les factures dans le même ordre »*.
 *
 * **UNE SEULE FONCTION POUR LES TROIS COLONNES.** Il a dit « le même ordre »
 * deux fois : trois tris écrits séparément finiraient par diverger, et c'est LUI
 * qui verrait une colonne remonter le temps pendant que les deux autres la
 * descendent (`CLAUDE.md` §3). Le jour où il voudra l'ordre inverse, un seul
 * endroit change.
 *
 * **Une pièce sans date passe en dernier**, jamais en premier. Un document dont
 * on ignore le jour n'est pas le plus récent : le mettre en tête ferait croire
 * qu'on vient de l'établir.
 */

export type PieceDuClient = {
  id: string;
  /** Ce qui se lit en gras : un numéro de devis, ou le jour d'une intervention. */
  titre: string;
  /** Le jour de la pièce, au format `AAAA-MM-JJ`. `null` : inconnu. */
  jour: string | null;
  /** La ligne grise sous le titre — le jour, ou le nom du chantier. */
  precision: string | null;
  /** L'adresse qui ouvre le PDF. */
  href: string;
};

/**
 * Du plus récent au plus ancien, les pièces sans date à la fin.
 *
 * **Le tri est stable à date égale** : deux devis émis le même jour gardent
 * l'ordre dans lequel la base les a rendus — c'est-à-dire leur numéro. Un tri
 * qui les intervertirait d'un rafraîchissement à l'autre donnerait l'impression
 * que l'écran bouge tout seul.
 */
export function rangerDuPlusRecent<T extends { jour: string | null }>(pieces: T[]): T[] {
  return pieces
    .map((piece, rang) => ({ piece, rang }))
    .sort((a, b) => {
      if (a.piece.jour === b.piece.jour) return a.rang - b.rang;
      if (a.piece.jour === null) return 1;
      if (b.piece.jour === null) return -1;
      // Les dates sont en `AAAA-MM-JJ` : leur ordre alphabétique EST leur ordre
      // chronologique. Passer par `new Date()` coûterait un fuseau horaire, et
      // un devis du 1er janvier changerait d'année selon l'endroit où on le lit.
      return a.piece.jour < b.piece.jour ? 1 : -1;
    })
    .map(({ piece }) => piece);
}

export type DerniereePrestation = {
  /** Le nom du chantier — « Élagage de trois chênes ». */
  nom: string;
  jour: string | null;
  /** Ce qu'elle comprend : les prestations notées sur ce chantier. */
  comprend: string[];
};

/**
 * La dernière chose qu'on a faite chez ce client, et ce qu'elle comprenait.
 *
 * *Sa demande du 20 août :* « en dessous de l'adresse, en titre noir gras,
 * dernière prestation avec ce qu'elle comprend ».
 *
 * **« Dernière » se lit sur la date, pas sur l'ordre d'arrivée en base.** Un
 * chantier créé hier pour une intervention du mois prochain n'est pas la
 * dernière prestation — c'est la prochaine.
 *
 * Rend `null` quand le client n'a aucun chantier : l'écran n'affiche alors rien
 * plutôt qu'un titre vide.
 */
export function dernierePrestation(
  chantiers: { id: string; nom: string; jour: string | null }[],
  prestationsParChantier: Map<string, string[]>
): DerniereePrestation | null {
  const [premier] = rangerDuPlusRecent(chantiers);
  if (!premier) return null;
  return {
    nom: premier.nom,
    jour: premier.jour,
    // **Les libellés vides ne comptent pas.** La table `prestations` les
    // autorise (`default("")`) : une ligne ouverte puis abandonnée y reste, et
    // s'afficherait comme une puce sans texte sous le titre.
    comprend: (prestationsParChantier.get(premier.id) ?? [])
      .map((l) => l.trim())
      .filter((l) => l.length > 0),
  };
}

const MOIS_COURTS = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
] as const;

/**
 * « 12 août 2026 » — la seule façon d'écrire une date sur la fiche d'un client.
 *
 * **Vue à la capture, pas au test :** l'écran portait « 12/08/2026 » au-dessus
 * de la dernière prestation et « 12 août 2026 » dans les colonnes, à trois
 * centimètres l'un de l'autre. Deux formats côte à côte font hésiter — est-ce
 * la même date ? — et c'est exactement le genre de détail qui use un écran
 * qu'on ouvre vingt fois par jour (`CLAUDE.md` §5).
 *
 * Le mois est abrégé : sur une colonne de 97 px, « septembre » ne tient pas.
 */
export function jourCourt(iso: string): string {
  const [annee, mois, jour] = iso.split("-");
  const nom = MOIS_COURTS[Number(mois) - 1];
  // Une date qu'on ne sait pas lire se rend telle quelle plutôt que de sortir
  // « undefined » sur l'écran d'un client.
  if (!nom || !annee || !jour) return iso;
  return `${Number(jour)} ${nom} ${annee}`;
}

/**
 * Le nom sous lequel une pièce doit ARRIVER dans son téléphone.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Le patron, le 21 août 2026 :** *« Alors oui, je veux pouvoir
 * l'enregistrer »* — devant des vignettes qui ne savaient qu'ouvrir le PDF.
 * Retenu sur planche : `docs/maquettes/83-enregistrer-le-pdf.html`,
 * **proposition C**.
 *
 * **Pourquoi ce n'est pas un détail.** Un fichier enregistré sans nom prend
 * celui de la page — c'est exactement le défaut du 7 août 2026, sur la
 * facture : *« quand je clique sur télécharger le PDF, ça me propose pas de
 * l'enregistrer »*. Le remède tenait à trois conditions, et le NOM en est une :
 * sans lui, Safari nomme le fichier d'après l'écran, sans extension. Il se
 * retrouve alors avec dix documents indistinguables dans son dossier.
 *
 * **La nature de la pièce se lit dans son adresse, jamais dans son titre.** Le
 * titre est ce qu'il LIT (« n° 2026-0029 », ou un jour) ; l'adresse est ce que
 * le serveur SERT. Deviner « c'est un devis » à partir d'un libellé, c'est se
 * fier à un mot que la prochaine demande peut changer.
 */
export function nomDuFichierDeLaPiece(piece: PieceDuClient): string {
  const genre = piece.href.includes("/api/factures/")
    ? "facture"
    : piece.href.includes("/api/devis/")
      ? "devis"
      : "fiche-chantier";

  // Un numéro commercial s'écrit « n° 2026-0029 » à l'écran : on garde les
  // chiffres et le tiret, on jette le reste. Un nom de fichier qui porterait
  // « n° » et son espace insécable se recopie mal et se cherche encore plus mal.
  const numero = piece.titre.replace(/^n[°o]\s*/i, "").trim();
  const ressembleAUnNumero = /^[0-9]{4}-[0-9]+$/.test(numero);
  if (ressembleAUnNumero) return `${genre}-${numero}.pdf`;

  // Une fiche de chantier n'a pas de numéro : elle porte son JOUR, et au format
  // de tri (AAAA-MM-JJ) plutôt que « 12 août ». Rangés dans un dossier, dix
  // fichiers se classent alors d'eux-mêmes dans l'ordre du temps.
  if (piece.jour) return `${genre}-${piece.jour}.pdf`;

  // Ni numéro ni jour : on ne fabrique pas un nom qui ferait croire à une date.
  return `${genre}.pdf`;
}
