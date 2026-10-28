import { adresseDeLaVisionneuse } from "./visionneuse-pdf";
import { adresseOuvrirLaPiece, jourCourt, type PieceDuClient } from "./documents-du-client";
import { NOM_DOCUMENT_VEHICULE, type NatureDocumentVehicule } from "./vehicules";

/**
 * LES DOCUMENTS QUE L'ASSISTANT JOINT À SA RÉPONSE.
 *
 * **Sa demande du 27 octobre 2026 :** *« quand je lui demande d'aller me
 * chercher une ligne dans un devis, qu'il me sorte le PDF du devis dans la
 * discussion, comme ça j'ai juste à cliquer »*, puis *« pareil pour chaque
 * document demandé : la facture, la fiche d'inter, le bilan comptable, un
 * ticket de carburant, un ticket resto »*. Planche retenue :
 * `appli/assistant-ouvre-le-devis.html`, **B** (la ligne trouvée est
 * elle-même ce qu'on touche).
 *
 * **Une adresse ne vient JAMAIS du modèle.** Un lien qu'il écrirait pourrait
 * viser n'importe quoi : un autre document, un autre site. Le chemin est donc
 * à sens unique :
 *
 * | | |
 * |---|---|
 * | l'outil | fabrique la pièce depuis ce qu'il a lu en base (`creerPiece`) |
 * | `rangerLesPieces` | la garde, et ne laisse partir au modèle qu'une clé, « P1 » |
 * | le modèle | cite la clé dans sa phrase, « [[P1]] » |
 * | `piecesCitees` | ne rend que les clés rangées pendant CE tour |
 *
 * Une clé inventée ne mène à rien ; un objet qui imite une pièce n'en est pas
 * une, seule `creerPiece` la marque. Et la route qui sert le fichier refait
 * ses propres contrôles : la pièce n'ouvre aucune porte, elle évite de
 * chercher.
 */

export type GenreDePiece =
  | "devis"
  | "facture"
  | "avoir"
  | "rapport"
  | "contrat"
  | "feuille"
  | "fiche_chantier"
  | "fiche_securite"
  | "ticket"
  | "piece_fournisseur"
  | "papier_vehicule"
  | "bilan"
  | "photo";

export type PieceJointe = {
  genre: GenreDePiece;
  /** L'adresse dans l'application : la visionneuse pour un PDF, l'image pour une photo. */
  adresse: string;
  /** Ce qui se lit en gras : la ligne trouvée, ou le document lui-même. */
  titre: string;
  /** À droite du titre, quand la pièce a un montant. Chaîne décimale, comme en base. */
  montant?: string | null;
  /** La ligne grise : le document et son jour. */
  detail: string;
  /** Un PDF et une page s'ouvrent dans l'application ; une photo, par-dessus la discussion. */
  format: "pdf" | "photo" | "page";
};

/** La marque que seule `creerPiece` pose : un objet recopié ne la porte pas. */
const MARQUE = Symbol("piece-de-l-assistant");

export function creerPiece(piece: PieceJointe): PieceJointe {
  // Une adresse de l'application commence par un seul « / ». « // » et
  // « https: » sortiraient du site.
  if (!piece.adresse.startsWith("/") || piece.adresse.startsWith("//")) {
    throw new Error(`Une pièce ne vise que l'application : ${piece.adresse}`);
  }
  return Object.defineProperty({ ...piece }, MARQUE, { value: true, enumerable: false });
}

function estUnePiece(valeur: unknown): valeur is PieceJointe {
  return typeof valeur === "object" && valeur !== null && (valeur as Record<symbol, unknown>)[MARQUE] === true;
}

/** Le jour lisible d'un document, ou rien s'il n'en a pas. */
function avecLeJour(nom: string, jour: string | null | undefined): string {
  return jour ? `${nom}, ${jourCourt(jour.slice(0, 10))}` : nom;
}

/**
 * Le PDF d'un devis. `titre` est la ligne trouvée quand on en cherchait une ;
 * sans elle, le devis lui-même.
 */
export function pieceDuDevis(
  devis: { devisId: string; numero: string | null; date: string | null },
  ligne?: { titre: string; montant?: string | null }
): PieceJointe {
  const nom = devis.numero ? `Devis ${devis.numero}` : "Devis";
  return creerPiece({
    genre: "devis",
    adresse: adresseDeLaVisionneuse(`/api/devis/${devis.devisId}/pdf`, { surtitre: "Devis", titre: devis.numero ?? "" }),
    titre: ligne?.titre ?? nom,
    montant: ligne?.montant ?? null,
    detail: avecLeJour(nom, devis.date),
    format: "pdf",
  });
}

/** Le PDF d'une facture émise. */
export function pieceDeLaFacture(facture: {
  factureId: string;
  numero: string | null;
  date: string | null;
  montant?: string | null;
  client?: string | null;
}): PieceJointe {
  const nom = facture.numero ? `Facture ${facture.numero}` : "Facture";
  return creerPiece({
    genre: "facture",
    adresse: adresseDeLaVisionneuse(`/api/factures/${facture.factureId}/pdf`, {
      surtitre: "Facture",
      titre: facture.numero ?? "",
    }),
    titre: facture.client ? `${nom}, ${facture.client}` : nom,
    montant: facture.montant ?? null,
    detail: avecLeJour(nom, facture.date),
    format: "pdf",
  });
}

export type RegistreDesPieces = Map<string, PieceJointe>;

export function nouveauRegistre(): RegistreDesPieces {
  return new Map();
}

/**
 * Ce que le modèle reçoit d'un outil : chaque pièce y est remplacée par sa clé.
 *
 * Le parcours descend dans les tableaux et les objets simples ; il ne touche
 * pas au résultat d'origine, qui peut servir ailleurs.
 */
export function rangerLesPieces(valeur: unknown, registre: RegistreDesPieces): unknown {
  if (estUnePiece(valeur)) {
    const cle = `P${registre.size + 1}`;
    registre.set(cle, valeur);
    return cle;
  }
  if (Array.isArray(valeur)) return valeur.map((v) => rangerLesPieces(v, registre));
  if (typeof valeur === "object" && valeur !== null && Object.getPrototypeOf(valeur) === Object.prototype) {
    return Object.fromEntries(Object.entries(valeur).map(([k, v]) => [k, rangerLesPieces(v, registre)]));
  }
  return valeur;
}

const CITATION = /\s*\[\[(P\d+)\]\]/g;

/**
 * Les pièces que la réponse cite, dans l'ordre où elle les cite, une fois
 * chacune ; et le texte débarrassé des clés, qui n'ont rien à faire à l'écran.
 */
export function piecesCitees(texte: string, registre: RegistreDesPieces): { texte: string; pieces: PieceJointe[] } {
  const vues = new Set<string>();
  const pieces: PieceJointe[] = [];
  for (const [, cle] of texte.matchAll(CITATION)) {
    const piece = registre.get(cle);
    if (!piece || vues.has(cle)) continue;
    vues.add(cle);
    pieces.push(piece);
  }
  // Les champs seuls, sans la marque : la pièce part au navigateur en JSON.
  const simples = pieces.map(({ genre, adresse, titre, montant, detail, format }) => ({
    genre,
    adresse,
    titre,
    montant: montant ?? null,
    detail,
    format,
  }));
  return { texte: texte.replace(CITATION, "").trim(), pieces: simples };
}

/** La photo d'un ticket de caisse, ouverte par l'identifiant de l'achat. */
export function pieceDuTicket(ticket: {
  achatId: string;
  fournisseur: string;
  date: string;
  montant: string | null;
  nature: string | null;
}): PieceJointe {
  return creerPiece({
    genre: "ticket",
    adresse: `/termines/tva/ticket/${ticket.achatId}`,
    titre: ticket.fournisseur || "Ticket",
    montant: ticket.montant,
    detail: avecLeJour(ticket.nature ? `Ticket ${ticket.nature.toLowerCase()}` : "Ticket", ticket.date),
    format: "photo",
  });
}

/** Un bilan déposé par le comptable : un PDF dans la visionneuse, ou sa photo. */
export function pieceDuBilan(bilan: {
  bilanId: string;
  nom: string;
  nature: "pdf" | "photo";
  du: string;
  au: string;
}): PieceJointe {
  const fichier = `/termines/comptable/bilans/${bilan.bilanId}/${bilan.nature}`;
  const periode = `Bilan du ${jourCourt(bilan.du)} au ${jourCourt(bilan.au)}`;
  return creerPiece({
    genre: "bilan",
    adresse: bilan.nature === "pdf" ? adresseDeLaVisionneuse(fichier, { surtitre: "Bilan", titre: bilan.nom }) : fichier,
    titre: bilan.nom,
    detail: periode,
    format: bilan.nature,
  });
}

/** Une photo d'un chantier. */
export function pieceDeLaPhoto(photo: { storageKey: string; nom: string | null; date: string | null }): PieceJointe {
  return creerPiece({
    genre: "photo",
    adresse: `/api/fichiers/${photo.storageKey}`,
    titre: photo.nom || "Photo du chantier",
    detail: avecLeJour("Photo du chantier", photo.date),
    format: "photo",
  });
}

/**
 * Une pièce du dossier d'un client, telle que sa fiche la range : devis
 * (importés compris), factures, avoirs, rapports d'entretien. Elle s'ouvre par
 * la MÊME règle que sur la fiche (`adresseOuvrirLaPiece`).
 */
export function pieceDuDossier(
  genre: "devis" | "facture" | "avoir" | "rapport",
  piece: PieceDuClient,
  client: string
): PieceJointe {
  const nom = { devis: "Devis", facture: "Facture", avoir: "Avoir", rapport: "Rapport d'entretien" }[genre];
  const numero = piece.titre.replace(/^n[°o]\s*/i, "");
  return creerPiece({
    genre,
    adresse: adresseOuvrirLaPiece(piece),
    titre: genre === "rapport" ? `${nom}, ${client}` : `${nom} ${numero}, ${client}`,
    detail: avecLeJour(nom, piece.jour),
    format: piece.format === "page" ? "page" : "pdf",
  });
}

/** Le contrat d'entretien d'un client, en PDF. */
export function pieceDuContrat(contrat: { contratId: string; client: string; date: string | null }): PieceJointe {
  return creerPiece({
    genre: "contrat",
    adresse: adresseDeLaVisionneuse(`/api/contrats/${contrat.contratId}/pdf`, { surtitre: "Contrat", titre: contrat.client }),
    titre: `Contrat d'entretien, ${contrat.client}`,
    detail: avecLeJour("Contrat", contrat.date),
    format: "pdf",
  });
}

/**
 * Les trois PDF d'un chantier : la feuille sans les prix (celle du salarié),
 * la fiche chantier, la fiche de sécurité. Sa réponse du 28 octobre 2026 à
 * « la fiche d'inter, c'est laquelle ? » : *« de toute façon, il faut qu'il
 * puisse nous donner tous les documents »*.
 */
export function pieceDuChantier(
  genre: "feuille" | "fiche_chantier" | "fiche_securite",
  chantier: { chantierId: string; nom: string }
): PieceJointe {
  const { fichier, nom } = {
    feuille: { fichier: `/api/chantiers/${chantier.chantierId}/feuille/pdf`, nom: "Feuille de chantier" },
    fiche_chantier: { fichier: `/api/chantiers/${chantier.chantierId}/fiche/pdf`, nom: "Fiche chantier" },
    fiche_securite: { fichier: `/planning/fiche-de-securite/${chantier.chantierId}/pdf`, nom: "Fiche de sécurité" },
  }[genre];
  return creerPiece({
    genre,
    adresse: adresseDeLaVisionneuse(fichier, { surtitre: nom, titre: chantier.nom }),
    titre: `${nom}, ${chantier.nom}`,
    detail: genre === "feuille" ? "Le devis sans les prix" : nom,
    format: "pdf",
  });
}

/**
 * Une facture ou un devis REÇU d'un fournisseur ou d'un partenaire. Un tableur
 * ne s'ouvre pas à l'écran : il n'a pas de pièce.
 */
export function pieceDuFournisseur(recu: {
  recuId: string;
  nom: string;
  societe: string;
  genre: "devis" | "facture";
  nature: "photo" | "pdf" | "tableur";
  montant: string | null;
  date: string | null;
}): PieceJointe | null {
  if (recu.nature === "tableur") return null;
  const fichier = `/reglages/fournisseurs/devis/${recu.recuId}`;
  const nom = recu.genre === "facture" ? `Facture de ${recu.societe}` : `Devis de ${recu.societe}`;
  return creerPiece({
    genre: "piece_fournisseur",
    adresse:
      recu.nature === "pdf" ? adresseDeLaVisionneuse(`${fichier}/pdf`, { surtitre: nom, titre: recu.nom }) : fichier,
    titre: recu.nom || nom,
    montant: recu.montant,
    detail: avecLeJour(nom, recu.date),
    format: recu.nature,
  });
}

/** Un papier d'un véhicule : carte grise, assurance, contrôle technique. */
export function pieceDuVehicule(papier: {
  vehiculeId: string;
  vehicule: string;
  nature: NatureDocumentVehicule;
  format: "pdf" | "photo";
  date: string | null;
}): PieceJointe {
  const nom = NOM_DOCUMENT_VEHICULE[papier.nature];
  const fichier = `/reglages/vehicules/${papier.vehiculeId}/document/${papier.nature}`;
  return creerPiece({
    genre: "papier_vehicule",
    adresse: papier.format === "pdf" ? adresseDeLaVisionneuse(`${fichier}/pdf`, { surtitre: nom, titre: papier.vehicule }) : fichier,
    titre: `${nom}, ${papier.vehicule}`,
    detail: avecLeJour(nom, papier.date),
    format: papier.format,
  });
}
