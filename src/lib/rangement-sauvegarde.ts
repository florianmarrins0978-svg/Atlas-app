/**
 * Où chaque fichier se range dans la sauvegarde que le patron télécharge.
 *
 * **Sa remarque du 26 septembre 2026, capture de l'app Fichiers à l'appui :**
 * *« regarde comment ça apparaît, un utilisateur va rien comprendre ! Pourquoi
 * c'est pas rangé avec le nom des clients ? »* L'archive recopiait la clé de
 * stockage (`chantiers/0b2034d5-…/photos/…`) : un dossier par identifiant, et
 * pas un nom qu'il reconnaisse.
 *
 * La clé de stockage reste dans `donnees.json`, à côté du chemin rendu ici :
 * c'est elle qui permettra de remettre chaque fichier à sa place ailleurs. Le
 * chemin, lui, sert à celui qui ouvre l'archive sur son téléphone.
 *
 * Règle pure, sans base : le dépôt lit les lignes, cette fonction décide.
 */

export type OrigineFichier =
  | "photo"
  | "note-vocale"
  | "devis-pdf"
  | "facture-pdf"
  | "avoir-pdf"
  | "logo"
  | "ticket-tva";

export type FichierARanger = {
  storageKey: string;
  origine: OrigineFichier;
  /** Le chantier auquel il appartient, quand il en a un. */
  chantierId: string | null;
  /** Ce qui le nomme : un numéro de devis ou de facture, un fournisseur. */
  libelle: string | null;
  /** La date qui le situe (AAAA-MM-JJ), quand elle est connue. */
  jour: string | null;
};

export type ChantierDeRangement = { nom: string; client: string | null };

const DOSSIER_PAR_ORIGINE: Record<OrigineFichier, string> = {
  photo: "Photos",
  "note-vocale": "Notes vocales",
  "devis-pdf": "Devis",
  "facture-pdf": "Factures",
  "avoir-pdf": "Factures",
  logo: "Entreprise",
  "ticket-tva": "Tickets de caisse",
};

const NOM_PAR_ORIGINE: Record<OrigineFichier, string> = {
  photo: "Photo",
  "note-vocale": "Note vocale",
  "devis-pdf": "Devis",
  "facture-pdf": "Facture",
  "avoir-pdf": "Avoir",
  logo: "Logo",
  "ticket-tva": "Ticket",
};

/**
 * Un nom qui s'écrit sur tous les systèmes. Windows refuse `\ / : * ? " < > |`,
 * et un `/` laissé dans un nom de client (« Dupont / Martin ») créerait un
 * dossier de plus. Les accents restent : l'archive les écrit en UTF-8.
 */
function nomSur(texte: string | null | undefined): string {
  const propre = (texte ?? "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+|\.+$/g, "")
    .trim()
    .slice(0, 60)
    .trim();
  return propre;
}

function extension(storageKey: string): string {
  const dernier = storageKey.split("/").pop() ?? "";
  const point = dernier.lastIndexOf(".");
  if (point <= 0) return "";
  const ext = dernier.slice(point).toLowerCase();
  return /^\.[a-z0-9]{1,5}$/.test(ext) ? ext : "";
}

/**
 * Le chemin de chaque fichier dans l'archive, sous `fichiers/`, dans l'ordre
 * reçu. Deux fichiers qui tomberaient sur le même nom sont numérotés : un
 * doublon dans une archive, certains décompresseurs refusent de l'extraire.
 */
export function rangerLesFichiers(
  fichiers: FichierARanger[],
  chantiers: ReadonlyMap<string, ChantierDeRangement>
): string[] {
  const pris = new Set<string>();

  return fichiers.map((f) => {
    const chantier = f.chantierId ? chantiers.get(f.chantierId) : undefined;
    const dossiers: string[] = [];
    if (chantier) {
      dossiers.push(nomSur(chantier.client) || "Sans client");
      dossiers.push(nomSur(chantier.nom) || "Chantier sans nom");
      dossiers.push(DOSSIER_PAR_ORIGINE[f.origine]);
    } else if (f.origine === "logo") {
      dossiers.push(DOSSIER_PAR_ORIGINE.logo);
    } else if (f.origine === "ticket-tva") {
      dossiers.push(DOSSIER_PAR_ORIGINE["ticket-tva"]);
    } else {
      // Un diagnostic fait hors chantier : rien ne le rattache à un client.
      dossiers.push("Sans chantier", DOSSIER_PAR_ORIGINE[f.origine]);
    }

    const base = [NOM_PAR_ORIGINE[f.origine], nomSur(f.libelle), f.jour ?? ""].filter(Boolean).join(" ");
    const ext = extension(f.storageKey);
    const dossier = ["fichiers", ...dossiers].join("/");

    let chemin = `${dossier}/${base}${ext}`;
    for (let n = 2; pris.has(chemin.toLowerCase()); n++) chemin = `${dossier}/${base} (${n})${ext}`;
    // Comparé sans la casse : l'app Fichiers et Windows confondent « Photo » et
    // « photo », et le second écraserait le premier à l'extraction.
    pris.add(chemin.toLowerCase());
    return chemin;
  });
}
