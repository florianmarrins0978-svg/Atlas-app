import { intituleDuCompte, nomCategorie, type CleCompta } from "./categories-comptables";
import { codeDuTiers, tauxEnMots, type LigneComptable, type RangDuRegistre } from "./dossier-du-comptable";

/**
 * LE FEC D'IMPORT DU DOSSIER : les écritures en partie double, au format du
 * fichier des écritures comptables (article A47 A-1 du livre des procédures
 * fiscales), pour que le logiciel du comptable les reprenne sans saisie.
 *
 * **Ce fichier n'est PAS le FEC de l'exercice**, et son nom le dit. Le FEC
 * légal se nomme `SirenFECAAAAMMJJ` (date de clôture) et seul le logiciel qui
 * tient la comptabilité le produit (BOI-CF-IOR-60-40-20, § 10 et 40) : Cause
 * ne prend pas ce nom, pour qu'aucun des deux ne passe pour l'autre. Sa
 * colonne ValidDate reste vide pour la même raison : ce n'est pas Cause qui
 * valide une écriture, c'est le comptable.
 *
 * **Trois journaux**, ceux de la planche : VT les ventes, HA les factures de
 * fournisseur, BQ la banque. Un ticket ou un prélèvement payé sur le moment va
 * droit de la banque à son compte : il n'a jamais été une dette.
 *
 * **La TVA d'une vente suit son régime.** Aux encaissements (les travaux, le
 * cas courant), elle attend au 44574 que le client paie, puis passe au 44571
 * au prorata de chaque paiement ; aux débits, elle est due dès la facture. En
 * franchise, aucune TVA ne s'écrit.
 *
 * **Le lettrage** relie une facture à ce qui la solde dans CE fichier : la
 * facture de fournisseur et son paiement, la vente et les virements de son
 * client quand ils la soldent ici, avoirs compris. Une facture payée par un
 * moyen que la banque ne voit pas (des espèces) reste ouverte : la lettrer
 * mentirait.
 */

export type Journal = "VT" | "HA" | "BQ";
const NOM_JOURNAL: Record<Journal, string> = { VT: "Ventes", HA: "Achats", BQ: "Banque" };

/** Les numéros des comptes que le dossier emploie hors des catégories de dépenses. */
export type ComptesDuDossier = Record<"clients" | "fournisseurs" | "banque" | "ventes" | "tvaCollectee" | "tvaEnAttente", string>;

export type EcritureFec = {
  journal: Journal;
  num: string;
  date: string;
  compte: string;
  compteLib: string;
  aux: string;
  auxLib: string;
  piece: string;
  pieceDate: string;
  lib: string;
  /** En centimes. */
  debit: number;
  credit: number;
  lettre: string;
  dateLettre: string;
};

export type EntreeDuFec = {
  du: string;
  au: string;
  exigibilite: "encaissements" | "debits";
  franchise: boolean;
  comptes: ComptesDuDossier;
  /** Les ventes de la période, avoirs compris (`registreDesVentes`). */
  ventes: readonly RangDuRegistre[];
  lignes: readonly LigneComptable[];
};

export const COLONNES_FEC = [
  "JournalCode",
  "JournalLib",
  "EcritureNum",
  "EcritureDate",
  "CompteNum",
  "CompteLib",
  "CompAuxNum",
  "CompAuxLib",
  "PieceRef",
  "PieceDate",
  "EcritureLib",
  "Debit",
  "Credit",
  "EcritureLet",
  "DateLet",
  "ValidDate",
  "Montantdevise",
  "Idevise",
] as const;

type Mouvement = { compte: string; lib?: string; aux?: string; auxLib?: string; debit?: number; credit?: number; lettre?: string; dateLettre?: string };

/** Le code de lettrage : AA, AB, … AZ, BA. Deux lettres suffisent à 676 rapprochements par dossier. */
function lettreDe(n: number): string {
  const a = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return n < 676 ? `${a[Math.floor(n / 26)]}${a[n % 26]}` : `${a[Math.floor(n / 676) % 26]}${a[Math.floor(n / 26) % 26]}${a[n % 26]}`;
}

export function ecrituresDuDossier(e: EntreeDuFec, intitule: (compte: string, cle?: CleCompta) => string = libelleDuCompte): EcritureFec[] {
  const brutes: (Omit<EcritureFec, "num"> & { ordre: number })[] = [];
  let ordre = 0;
  const ecrire = (journal: Journal, date: string, piece: string, pieceDate: string, lib: string, mouvements: Mouvement[]) => {
    ordre += 1;
    for (const m of mouvements) {
      if (!m.debit && !m.credit) continue;
      brutes.push({
        journal,
        date,
        compte: m.compte,
        compteLib: m.lib ?? intitule(m.compte),
        aux: m.aux ?? "",
        auxLib: m.auxLib ?? "",
        piece,
        pieceDate,
        lib,
        debit: m.debit ?? 0,
        credit: m.credit ?? 0,
        lettre: m.lettre ?? "",
        dateLettre: m.dateLettre ?? "",
        ordre,
      });
    }
  };
  const { comptes: C } = e;
  const tvaDeVente = e.exigibilite === "encaissements" ? C.tvaEnAttente : C.tvaCollectee;
  let lettres = 0;

  // ─── Ce qui solde une vente ICI : ses avoirs de la période et ses virements du dossier.
  const virementsDe = new Map<string, LigneComptable[]>();
  for (const l of e.lignes) if (l.facture) virementsDe.set(l.facture.numero, [...(virementsDe.get(l.facture.numero) ?? []), l]);
  const lettreDeLaFacture = new Map<string, { lettre: string; date: string }>();
  for (const v of e.ventes.filter((r) => r.genre === "facture")) {
    const avoirs = e.ventes.filter((r) => r.genre === "avoir" && r.facture === v.numero);
    const recus = virementsDe.get(v.numero) ?? [];
    const solde = v.ttc + avoirs.reduce((s, a) => s + a.ttc, 0) - recus.reduce((s, l) => s + l.ttc, 0);
    if (solde === 0 && (recus.length > 0 || avoirs.length > 0)) {
      const dates = [...avoirs.map((a) => a.date), ...recus.map((l) => l.jour)].sort();
      lettreDeLaFacture.set(v.numero, { lettre: lettreDe(lettres++), date: dates.at(-1)! });
    }
  }
  const lettreDuClient = (numero: string) => lettreDeLaFacture.get(numero);

  // ─── VT : les ventes de la période, puis leurs avoirs, au journal des ventes.
  for (const v of e.ventes) {
    const aux = codeDuTiers(v.client);
    const l = lettreDuClient(v.facture);
    const client: Mouvement = { compte: C.clients, aux, auxLib: v.client, lettre: l?.lettre, dateLettre: l?.date };
    const tva = e.franchise ? [] : v.parTaux.filter((t) => t.tva !== 0);
    const ht = e.franchise ? v.ttc : v.ht;
    if (v.genre === "facture") {
      ecrire("VT", v.date, v.numero, v.date, `Facture ${v.numero}, ${v.client}`, [
        { ...client, debit: v.ttc },
        { compte: C.ventes, credit: ht },
        ...tva.map((t) => ({ compte: tvaDeVente, lib: libelleTva(tvaDeVente, t.taux, intitule), credit: t.tva })),
      ]);
    } else {
      // Un avoir retire : ses montants sont négatifs dans le registre, ses
      // écritures passent de l'autre côté, toujours positives.
      ecrire("VT", v.date, v.numero, v.date, `Avoir ${v.numero} sur ${v.facture}, ${v.client}`, [
        { ...client, credit: -v.ttc },
        { compte: C.ventes, debit: -ht },
        ...tva.map((t) => ({ compte: tvaDeVente, lib: libelleTva(tvaDeVente, t.taux, intitule), debit: -t.tva })),
      ]);
    }
  }

  // ─── Les lignes de la banque.
  for (const l of e.lignes) {
    const lib = l.libelle || nomCategorie(l.cle);
    if (l.sens === "entree") {
      if (l.cle === "clients") {
        const client = l.facture?.client ?? l.tiers;
        const lettre = l.facture ? lettreDuClient(l.facture.numero) : undefined;
        // Aux encaissements, la TVA de ce que le client paie devient due, au
        // prorata de la facture après ses avoirs (`exigibilite-tva.ts`).
        const part = l.facture && !e.franchise && e.exigibilite === "encaissements" && l.facture.ttc > 0 ? Math.round((l.ttc * l.facture.tva) / l.facture.ttc) : 0;
        ecrire("BQ", l.jour, l.ref, l.jour, lib, [
          { compte: C.banque, debit: l.ttc },
          { compte: C.clients, aux: codeDuTiers(client), auxLib: client ?? "Divers", credit: l.ttc, lettre: lettre?.lettre, dateLettre: lettre?.date },
          { compte: C.tvaEnAttente, debit: part },
          { compte: C.tvaCollectee, credit: part },
        ]);
      } else {
        ecrire("BQ", l.jour, l.ref, l.jour, lib, [
          { compte: C.banque, debit: l.ttc },
          { compte: l.compte, lib: intitule(l.compte, l.cle), credit: l.ttc },
        ]);
      }
      continue;
    }
    const charge: Mouvement[] = [
      { compte: l.compte, lib: intitule(l.compte, l.cle), debit: l.ht },
      ...(l.compteTva && l.tva > 0 ? [{ compte: l.compteTva, debit: l.tva }] : []),
    ];
    if (l.achat) {
      // La facture du fournisseur au journal des achats, datée de la pièce ;
      // son paiement en banque ; les deux lettrés ensemble.
      const lettre = lettreDe(lettres++);
      const fournisseur: Mouvement = { compte: C.fournisseurs, aux: codeDuTiers(l.tiers), auxLib: l.tiers ?? "Divers", lettre, dateLettre: l.jour };
      const jourDeLaPiece = l.pieceDate ?? l.jour;
      ecrire("HA", jourDeLaPiece, l.ref, jourDeLaPiece, l.tiers ? `Facture ${l.tiers}` : lib, [...charge, { ...fournisseur, credit: l.ttc }]);
      ecrire("BQ", l.jour, l.ref, l.jour, lib, [
        { ...fournisseur, debit: l.ttc },
        { compte: C.banque, credit: l.ttc },
      ]);
    } else {
      ecrire("BQ", l.jour, l.ref, l.pieceDate ?? l.jour, lib, [...charge, { compte: C.banque, credit: l.ttc }]);
    }
  }

  // Le fichier se trie par journal, puis par date d'écriture ; chaque journal
  // se numérote sans trou dans cet ordre (un achat se date de sa facture, qui
  // peut précéder la ligne de banque d'avant lui). Le numéro porte le premier
  // jour du dossier : deux dossiers n'en partagent jamais un.
  const rangDuJournal: Record<Journal, number> = { VT: 0, HA: 1, BQ: 2 };
  brutes.sort((a, b) => rangDuJournal[a.journal] - rangDuJournal[b.journal] || a.date.localeCompare(b.date) || a.ordre - b.ordre);
  const numeros = new Map<number, string>();
  const compte: Record<Journal, number> = { VT: 0, HA: 0, BQ: 0 };
  const prefixe = e.du.replace(/-/g, "");
  return brutes.map(({ ordre: o, ...b }) => {
    if (!numeros.has(o)) numeros.set(o, `${b.journal}${prefixe}${String(++compte[b.journal]).padStart(4, "0")}`);
    return { ...b, num: numeros.get(o)! };
  });
}

/** L'intitulé d'un compte : celui du plan comptable, sinon le nom de la catégorie qui l'emploie. */
export function libelleDuCompte(compte: string, cle?: CleCompta): string {
  return intituleDuCompte(compte) ?? (cle ? nomCategorie(cle) : `Compte ${compte}`);
}

function libelleTva(compte: string, taux: string, intitule: (c: string) => string): string {
  return `${intitule(compte)}, ${tauxEnMots(taux).replace(" ", " ")}`;
}

/** Ce que les écritures doivent : autant au débit qu'au crédit, écriture par écriture. */
export function ecrituresEquilibrees(ecritures: readonly EcritureFec[]): { ok: boolean; desequilibrees: string[] } {
  const par = new Map<string, number>();
  for (const x of ecritures) par.set(x.num, (par.get(x.num) ?? 0) + x.debit - x.credit);
  const desequilibrees = [...par.entries()].filter(([, s]) => s !== 0).map(([n]) => n);
  return { ok: desequilibrees.length === 0, desequilibrees };
}

// ─── Le fichier lui-même ─────────────────────────────────────────────────────

/** « 1234,56 » : la virgule décimale, aucun séparateur de milliers ; zéro s'écrit « 0,00 ». */
export function montantFec(centimes: number): string {
  const signe = centimes < 0 ? "-" : "";
  const a = Math.abs(centimes);
  return `${signe}${Math.floor(a / 100)},${String(a % 100).padStart(2, "0")}`;
}

const aaaammjj = (iso: string) => iso.replace(/-/g, "");

/** Une valeur de colonne : la tabulation sépare les colonnes, un retour de ligne sépare les écritures. */
const champ = (t: string) => t.replace(/[\t\r\n]+/g, " ").trim();

/** Le texte du fichier : un en-tête, puis une ligne par mouvement, séparés par des tabulations. */
export function texteDuFec(ecritures: readonly EcritureFec[]): string {
  const lignes = [COLONNES_FEC.join("\t")];
  for (const x of ecritures) {
    lignes.push(
      [
        x.journal,
        NOM_JOURNAL[x.journal],
        x.num,
        aaaammjj(x.date),
        x.compte,
        x.compteLib,
        x.aux,
        x.auxLib,
        x.piece,
        aaaammjj(x.pieceDate),
        x.lib,
        montantFec(x.debit),
        montantFec(x.credit),
        x.lettre,
        x.dateLettre ? aaaammjj(x.dateLettre) : "",
        "",
        "",
        "",
      ]
        .map(champ)
        .join("\t")
    );
  }
  return `${lignes.join("\r\n")}\r\n`;
}

/**
 * Le texte en ISO 8859-15, le jeu de caractères que l'administration admet
 * pour le FEC et que tous les logiciels comptables relisent. Il diffère du
 * Latin 1 sur huit cases, dont l'euro (A4). Ce qu'il ne sait pas écrire se
 * ramène à sa lettre sans accent, puis à « ? » : un caractère perdu se voit,
 * un octet faux casserait la ligne.
 */
export function enIso885915(texte: string): Uint8Array {
  const propres: Record<string, number> = { "€": 0xa4, Š: 0xa6, š: 0xa8, Ž: 0xb4, ž: 0xb8, Œ: 0xbc, œ: 0xbd, Ÿ: 0xbe };
  const remplacees = new Set([0xa4, 0xa6, 0xa8, 0xb4, 0xb8, 0xbc, 0xbd, 0xbe]);
  const remplacants: Record<string, string> = { "’": "'", "‘": "'", "“": '"', "”": '"', "–": "-", "—": "-", "…": "...", " ": " ", " ": " " };
  const octets: number[] = [];
  for (const c of texte) {
    const p = propres[c];
    if (p !== undefined) {
      octets.push(p);
      continue;
    }
    const r = remplacants[c] ?? c;
    for (const x of r) {
      const code = x.codePointAt(0)!;
      if (code < 0x100 && !remplacees.has(code)) {
        octets.push(code);
        continue;
      }
      const sansAccent = x.normalize("NFD").replace(/[̀-ͯ]/g, "");
      const s = sansAccent.codePointAt(0)!;
      octets.push(sansAccent.length === 1 && s < 0x100 && !remplacees.has(s) ? s : 0x3f);
    }
  }
  return Uint8Array.from(octets);
}

/**
 * Le nom du fichier : « 123456789_import_FEC_2026-10.txt » pour un mois
 * entier, « …_2026-10-01_2026-10-15.txt » sinon. Jamais le nom légal
 * (`SirenFECAAAAMMJJ`), réservé au FEC de l'exercice.
 */
export function nomDuFec(siret: string | null, du: string, au: string): string {
  const siren = (siret ?? "").replace(/\D/g, "").slice(0, 9) || "sans-siren";
  const finDuMois = (j: string) => {
    const [a, m] = j.split("-").map(Number);
    return new Date(Date.UTC(a!, m!, 0)).toISOString().slice(0, 10);
  };
  const moisEntier = du.slice(0, 7) === au.slice(0, 7) && du.endsWith("-01") && au === finDuMois(au);
  return `${siren}_import_FEC_${moisEntier ? du.slice(0, 7) : `${du}_${au}`}.txt`;
}
