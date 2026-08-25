/**
 * REGARDER le bas d'un devis qui porte les conditions réglées.
 *
 * Le défaut du 25 août 2026 — cinq réglages qui n'atteignaient aucun document —
 * n'a fait rougir aucune suite pendant onze jours, et c'est LUI qui l'a vu. La
 * réparation ne se juge donc pas non plus sur un vert : ce bloc s'ajoute au bas
 * d'une page déjà chargée, juste au-dessus du cadre de signature, et c'est là
 * qu'un débordement se verrait — nulle part ailleurs (`CLAUDE.md` §5).
 *
 *     npx tsx scripts/capture-conditions-devis.mts /tmp/captures
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { composerDevisPdf, type DevisPdfData } from "../src/server/pdf/devis-pdf";

const SORTIE = process.argv[2] ?? "/tmp/captures";
mkdirSync(SORTIE, { recursive: true });

const DEVIS: DevisPdfData = {
  numeroCommercial: "2026-0012",
  numeroVersion: 1,
  statut: "envoye",
  dateEmission: "2026-08-25",
  validiteJours: 30,
  entrepriseNom: "Eden Nature",
  entrepriseAdresse: "10 rue des Artisans, 78200 Buchelay",
  entrepriseSiret: "123 456 789 00012",
  entrepriseTelephone: "06 79 98 45 14",
  entrepriseEmail: "contact@eden-nature.fr",
  entrepriseIban: "FR76 3123 3123 4500 2348 1091 175",
  clientNom: "Mme Éléonore Châteauneuf",
  clientAdresse: "3 allée des Œillets, 78711 Mantes-la-Ville",
  clientTelephone: "06 12 34 56 78",
  adresseChantier: "3 allée des Œillets, 78711 Mantes-la-Ville",
  conditionsPaiement: null,
  devise: "EUR",
  tauxTva: "20.00",
  totalHt: "870.00",
  totalTva: "174.00",
  totalTtc: "1044.00",
  lignes: [
    { libelle: "Élagage — 3 chênes en fond de parcelle", quantite: "1", prixUnitaire: "450.00", montant: "450.00" },
    { libelle: "Broyage des branches sur place", quantite: "1", prixUnitaire: "180.00", montant: "180.00" },
    { libelle: "Évacuation des déchets verts", quantite: "1", prixUnitaire: "240.00", montant: "240.00" },
  ],
};

const REGLES = {
  acomptePourcent: "30",
  delaiPaiementJours: 30,
  moyensPaiement: "virement, chèque",
  rappelerPenalites: true,
  textePied: "Sous réserve d'accès au chantier et de conditions météorologiques praticables.",
};

const SIEN = "Accès par le portail de gauche. Merci de dégager la cour la veille de l'intervention.";

// Les trois états qui comptent : rien de réglé (le devis d'avant), tout réglé,
// et tout réglé PAR-DESSUS son propre texte — le cas le plus long, donc celui
// qui pousserait le bloc sur le cadre de signature.
const CAS: [string, DevisPdfData][] = [
  ["01-rien-de-regle", DEVIS],
  ["02-tout-regle", { ...DEVIS, conditionsReglees: REGLES }],
  ["03-son-texte-puis-les-regles", { ...DEVIS, conditionsPaiement: SIEN, conditionsReglees: REGLES }],
];

const nav = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const page = await nav.newPage({ viewport: { width: 900, height: 1180 } });

for (const [nom, data] of CAS) {
  const { pdf, trace } = await composerDevisPdf(data);
  const chemin = path.join(SORTIE, `conditions-${nom}.pdf`);
  writeFileSync(chemin, pdf);
  await page.goto("file://" + chemin);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SORTIE, `conditions-${nom}.png`), fullPage: true });
  console.log(`${nom.padEnd(30)} ${String(trace.textes.length).padStart(4)} textes · ${trace.pages ?? "?"} page(s)`);
}
await nav.close();
console.log(`\nCaptures dans ${SORTIE}`);
