/**
 * REGARDER un devis à plusieurs TVA — parce qu'aucun test ne voit une feuille.
 *
 * Cinq défauts réels de ce dépôt sont sortis d'une image et d'aucune suite
 * (`CLAUDE.md` §5). Les catégories de TVA ajoutent des titres, des sous-totaux
 * et une ligne de plus dans les totaux : autant d'occasions de chevaucher un
 * trait ou de pousser le cadre de signature hors de la page.
 *
 * Les trois cas sont ceux qui se comportent différemment, pas trois variantes
 * du même :
 *
 *   - `taux-unique`   ce que voient TOUS ses devis existants. Il ne doit porter
 *                     aucun titre de catégorie, aucun sous-total ;
 *   - `deux-taux`     sa demande du 1er septembre 2026 ;
 *   - `trois-remise`  le cas qui casse : trois catégories, un prix accordé
 *                     réparti au prorata, et assez de lignes pour changer de
 *                     page — c'est là qu'un titre se retrouve seul en bas.
 *
 *     npx tsx scripts/capture-devis-tva-multiple.mts /tmp/captures
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { composerDevisPdf, type DevisPdfData } from "../src/server/pdf/devis-pdf";
import { totauxAvecReduction } from "../src/lib/reduction-devis";

const SORTIE = process.argv[2] ?? "/tmp/captures";
mkdirSync(SORTIE, { recursive: true });

type Ligne = { libelle: string; quantite: string; prixUnitaire: string; montant: string; unite?: string; tauxTva?: string | null };

/** Les totaux viennent de la RÈGLE, jamais d'un chiffre tapé ici. */
function devisAvec(lignes: Ligne[], reduction: string | null): DevisPdfData {
  const t = totauxAvecReduction(lignes, "20.00", reduction);
  return {
    numeroCommercial: "2026-0042",
    numeroVersion: 1,
    statut: "envoye",
    dateEmission: "2026-09-01",
    validiteJours: 30,
    entrepriseNom: "Eden Nature",
    entrepriseAdresse: "10 rue des Artisans, 78200 Buchelay",
    entrepriseSiret: "123 456 789 00012",
    entrepriseTelephone: "06 79 98 45 14",
    entrepriseEmail: "contact@eden-nature.fr",
    entrepriseIban: "FR76 3123 3123 4500 2348 1091 175",
    clientNom: "M. Bernard Legrand",
    clientAdresse: "42 avenue de la Paix, 69600 Oullins",
    clientTelephone: "06 12 34 56 78",
    adresseChantier: "42 avenue de la Paix, 69600 Oullins",
    conditionsPaiement: "Acompte de 30 % à la signature, solde à réception des travaux.",
    devise: "EUR",
    tauxTva: "20.00",
    totalHt: t.totalHt,
    totalTva: t.totalTva,
    totalTtc: t.totalTtc,
    reductionPourcent: t.reductionPourcent,
    reductionMontant: t.reductionMontant,
    lignes,
  };
}

const MAIN_DOEUVRE: Ligne[] = [
  { libelle: "Taille de haie de charmille — hauteur 1,80 m", quantite: "80", unite: "ml", prixUnitaire: "17.50", montant: "1400.00" },
  { libelle: "Évacuation des déchets verts", quantite: "1", prixUnitaire: "180.00", montant: "180.00" },
  { libelle: "Plantation et mise en place", quantite: "1", prixUnitaire: "640.00", montant: "640.00" },
];
const VEGETAUX: Ligne[] = [
  { libelle: "Charmille en motte — 1,50/1,75 m", quantite: "45", prixUnitaire: "22.00", montant: "990.00", tauxTva: "10.00" },
  { libelle: "Terreau de plantation — sac 40 L", quantite: "12", prixUnitaire: "8.90", montant: "106.80", tauxTva: "10.00" },
];

/** De quoi déborder sur une seconde page, où les titres se coupent. */
const BEAUCOUP: Ligne[] = Array.from({ length: 14 }, (_, i) => ({
  libelle: `Abattage et rognage de souche — sujet n° ${i + 1}, accès par le portail de gauche`,
  quantite: "1",
  prixUnitaire: "240.00",
  montant: "240.00",
  tauxTva: i % 3 === 0 ? null : i % 3 === 1 ? "10.00" : "5.50",
}));

const CAS: [string, DevisPdfData][] = [
  ["taux-unique", devisAvec(MAIN_DOEUVRE, null)],
  ["deux-taux", devisAvec([...MAIN_DOEUVRE, ...VEGETAUX], null)],
  ["trois-remise", devisAvec(BEAUCOUP, "10")],
];

const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await nav.newPage({ viewport: { width: 900, height: 1180 } });

for (const [nom, donnees] of CAS) {
  const { pdf, trace } = await composerDevisPdf(donnees);
  const chemin = path.join(SORTIE, `devis-tva-${nom}.pdf`);
  writeFileSync(chemin, pdf);
  await page.goto("file://" + chemin);
  // Quatre secondes : une capture prise trop tôt sort blanche, et une page
  // blanche se lit comme un document cassé (leçon du 31 août 2026).
  await page.waitForTimeout(4000);
  await page.screenshot({ path: path.join(SORTIE, `devis-tva-${nom}.png`), fullPage: true });
  const lignesTva = trace.textes.filter((t) => t.contenu.startsWith("TVA ("));
  console.log(
    `${nom.padEnd(14)} ${String(trace.pages)} page(s) · ${lignesTva.length} ligne(s) de TVA · ` +
      `TTC ${donnees.totalTtc}`
  );
}
await nav.close();
console.log(`\nCaptures dans ${SORTIE}`);
