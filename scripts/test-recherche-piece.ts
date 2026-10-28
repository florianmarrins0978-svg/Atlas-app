import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { estUnMontant, montantRepond, piecesQuiRepondent, rienNeRepond } from "../src/lib/recherche-piece";

// **LA LOUPE DES PIÈCES D'UN CLIENT.**
//
// Sa demande du 28 octobre 2026 : *« il faut rajouter la loupe pour faire une
// recherche par nom ou montant »*, puis la phrase qu'il veut lire dans la case,
// *« Chercher un nom, un titre, un montant »*. Planches `appli/soignee/client.html`
// et `appli/soignee/clients-importer.html`, regardées avant le code.
//
// Les cas sont ceux de la planche : Mme Costa, deux devis, deux factures, deux
// fiches. Une règle de montant se trompe sur les centimes et sur les milliers,
// une règle de texte sur les accents ; chacun a sa ligne.

let echecs = 0;
const dire = (bon: boolean, quoi: string) => {
  console.log(`${bon ? "  ✓" : "  ✗"} ${quoi}`);
  if (!bon) echecs++;
};

const COSTA = "Mme Costa";
const pieces = [
  { id: "d24", titre: "n° 2026-000024", jour: "2026-10-03", precision: "3 oct. 2026", href: "/api/devis/d24/pdf", objet: "Taille de haie de thuyas", montant: "1380.00" },
  { id: "d12", titre: "n° 2026-000012", jour: "2026-06-02", precision: "2 juin 2026", href: "/api/devis/d12/pdf", objet: "Entretien de printemps", montant: "640.00" },
  { id: "f14", titre: "n° F2026-000014", jour: "2026-10-22", precision: "22 oct. 2026", href: "/api/factures/f14/pdf", objet: "Taille de haie de thuyas", montant: "1380.00" },
  { id: "f04", titre: "n° F2026-000004", jour: "2026-06-19", precision: "19 juin 2026", href: "/api/factures/f04/pdf", objet: "Entretien de printemps", montant: "640.00" },
  { id: "x1", titre: "n° 2026-000031", jour: "2026-09-01", precision: "1 sept. 2026", href: "/api/devis/x1/pdf", montant: "6400.50" },
  { id: "fi8", titre: "8 oct. 2026", jour: "2026-10-08", precision: "6 prestations", href: "/entretien/a", format: "page" as const, objet: "Tonte de la pelouse" },
  { id: "fi9", titre: "10 sept. 2026", jour: "2026-09-10", precision: "4 prestations", href: "/entretien/b", format: "page" as const, objet: "Taille des rosiers" },
];
const ids = (saisie: string) => piecesQuiRepondent(pieces, saisie, COSTA).map((p) => p.id).join(",");

console.log("=== La loupe des pièces d'un client ===\n");

dire(ids("") === pieces.map((p) => p.id).join(","), "rien tapé : tout reste, rien ne disparaît");
dire(ids("   ") === ids(""), "des espaces seules ne filtrent rien");

// ── Un titre ────────────────────────────────────────────────────────────────
dire(ids("thuyas") === "d24,f14", "un mot du titre trouve le devis ET sa facture");
dire(ids("THUYAS") === "d24,f14", "la casse ne décide de rien");
dire(ids("entretien printemps") === "d12,f04", "chaque mot tapé, dans n'importe quel ordre");
dire(ids("printemps entretien") === "d12,f04", "l'ordre des mots ne compte pas");
dire(ids("haie rosiers") === "", "deux mots qui ne vont pas ensemble ne trouvent rien");

// ── Le nom du client ─────────────────────────────────────────────────────────
// La case dit « un nom » : sur sa fiche, taper son nom rend tout son dossier.
dire(ids("costa") === ids(""), "le nom du client rend toutes ses pièces");

// ── Les fiches : leur tâche, leur date, jamais un montant ────────────────────
dire(ids("rosiers") === "fi9", "une fiche se trouve par sa première tâche");
dire(ids("tonte") === "fi8", "et une autre par la sienne");
// **La date s'écrit « 8 oct. 2026 » à l'écran, et il tape « octobre ».** Les
// deux doivent répondre : on cherche avec le mot entier qu'on a en tête.
dire(ids("octobre") === "fi8", "« octobre » trouve la fiche du 8 oct.");
dire(ids("oct") === "fi8", "et « oct » aussi");
dire(ids("septembre") === "fi9", "« septembre » trouve celle du 10 sept.");

// ── Le numéro ────────────────────────────────────────────────────────────────
dire(ids("2026-000024") === "d24", "le numéro imprimé trouve sa pièce");
dire(ids("F2026-000014") === "f14", "celui d'une facture aussi");

// ── Un montant ───────────────────────────────────────────────────────────────
dire(estUnMontant("640") && estUnMontant("1 380,00 €") && estUnMontant("4 180"), "des chiffres sont un montant");
dire(!estUnMontant("thuyas") && !estUnMontant("2026-000024") && !estUnMontant("€") && !estUnMontant(""), "des lettres, un numéro ou un « € » seul n'en sont pas");
dire(ids("640") === "d12,f04,x1", "« 640 » trouve 640 € et ce qui commence par 640");
dire(ids("640,00") === "d12,f04", "avec ses centimes, le montant exact seulement");
dire(ids("1 380") === "d24,f14", "l'espace des milliers se tape ou non");
dire(ids("1380") === "d24,f14", "sans l'espace aussi");
dire(ids("1 380,00 €") === "d24,f14", "recopié tel qu'il s'affiche, il répond");
dire(ids("6400,5") === "x1", "« 6400,5 » vaut 6 400,50 €");
dire(ids("6400.50") === "x1", "le point vaut la virgule");
// Une fiche n'a pas de prix : un montant ne la trouve jamais.
dire(!ids("6").split(",").some((id) => id.startsWith("fi")), "un montant ne trouve jamais une fiche");
dire(!montantRepond(null, "640") && !montantRepond(undefined, "640"), "une pièce sans montant ne répond à aucun");
dire(montantRepond("1380.00", "1380.") , "une virgule laissée en fin de frappe ne fait rien perdre");

dire(rienNeRepond("  haie rosiers ") === "Rien ne répond à « haie rosiers ».", "rien trouvé : la phrase cite ce qui a été tapé");

// ── La règle ne se réécrit pas dans l'écran ─────────────────────────────────
// Le jour où un `.includes()` reviendra dans le composant, « octobre » cessera
// de trouver « 8 oct. », et rien d'autre ne le verrait (`CLAUDE.md` §3).
const ecran = readFileSync(path.join(__dirname, "..", "src/app/clients/[id]/RegistresDuDossier.tsx"), "utf8");
dire(ecran.includes("piecesQuiRepondent("), "le dossier du client filtre par cette règle, et pas par la sienne");

console.log(echecs === 0 ? "\n✅ 0 échec." : `\n❌ ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
assert.equal(echecs, 0);
