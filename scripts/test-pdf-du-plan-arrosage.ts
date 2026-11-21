/**
 * LE PDF D'UN PLAN D'ARROSAGE ENREGISTRÉ (`src/server/pdf/plan-arrosage-pdf.ts`)
 * — ses demandes du 21 novembre 2026, sur la planche `appli/arrosage-dossiers.html`.
 *
 * Ce qu'il doit tenir, lu dans le PDF produit (son texte, ses pages) :
 *   1. une page de garde, UNE PAGE PAR RÉSEAU, puis la liste ;
 *   2. AUCUNE réserve, ni la phrase « Nous ne garantissons pas… », ni pied de page ;
 *   3. chaque pièce de la liste y est, avec sa quantité ;
 *   4. le dessin de l'écran passe ENTIER : aucun élément de `PlanDessine`
 *      laissé de côté par le traceur, sans quoi un trait manquerait en silence ;
 *   5. aucun caractère sans glyphe dans les polices embarquées : il
 *      s'imprimerait en case vide (le « ≤ » de la fiche de sécurité, 2026).
 *
 * `--images <dossier>` écrit aussi chaque page en PNG, pour la regarder.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument } from "pdf-lib";
import { donneesDuPdf } from "../src/app/paysage/dossiers-arrosage/donnees-du-pdf";
import { figerLePlan, type SaisieDuPlan } from "../src/lib/arrosage/plan-enregistre";
import { RETOUCHES_VIERGES } from "../src/lib/arrosage/retouches";
import type { ParametresPlan } from "../src/lib/arrosage/consignes";
import { composerLePdfDuPlan } from "../src/server/pdf/plan-arrosage-pdf";
import { tracerSvg, type NoeudSvg } from "../src/server/pdf/svg-vers-pdf";
import { pourLePapier } from "../src/lib/texte-pdf";

let echecs = 0;
async function cas(nom: string, verifier: () => Promise<void> | void) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

// Le jardin de la planche : deux pelouses, un massif, un couloir, au compteur.
const JARDIN = {
  seau: 10, temps: 18, pression: 3, compteur: "oui", regardVersZone: 0, amenee: 0,
  zones: [
    { id: 1, type: "gazon", nom: "Pelouse arrière", x: 0, y: 0, L: 12, l: 12 },
    { id: 2, type: "gazon", nom: "Pelouse avant", x: 14, y: 0, L: 8, l: 8 },
    { id: 3, type: "massif", nom: "Massif", x: 14, y: 10, L: 20, l: 2.4, sortieGoutte: "boucle" },
    { id: 4, type: "gazon", nom: "Couloir", x: 0, y: 14, L: 10, l: 2, materiel: "tuyere" },
  ],
  nourrice: { x: 13, y: 6 },
  couronne: 50,
} as unknown as ParametresPlan;

const RESERVE_DU_CROQUIS = "Amenée de 5,5 m, du piquage à la nourrice, calculée sur le croquis.";
const saisie: SaisieDuPlan = { parametres: JARDIN, retouches: RETOUCHES_VIERGES, reservesDuCroquis: [RESERVE_DU_CROQUIS], sansDessin: null, lecture: null };

async function texteDuPdf(octets: Uint8Array): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(octets), useSystemFonts: false }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const contenu = await (await doc.getPage(i)).getTextContent();
    pages.push(contenu.items.map((x) => ("str" in x ? x.str : "")).join(" ").replace(/\s+/g, " "));
  }
  return pages;
}

async function main() {
  console.log("=== Le PDF d'un plan d'arrosage enregistré ===\n");
  const fige = figerLePlan(saisie);
  const donnees = donneesDuPdf({ entreprise: "Atelier Démo", dossier: "Plan d’arrosage de Madame Intel", enregistreLe: new Date("2026-11-21T08:41:00Z"), saisie, fige });
  const octets = await composerLePdfDuPlan(donnees);
  const pages = await texteDuPdf(octets);
  const tout = pages.join("\n");

  await cas("une page de garde, une page par réseau, puis la liste", () => {
    assert.ok(fige.plan.secteurs.length >= 3, "le jardin d'essai a perdu ses réseaux : le contrôle ne mesure rien");
    assert.match(pages[0], /Plan d.arrosage/);
    // Les surtitres sont espacés : un lecteur de PDF y voit des espaces entre les lettres.
    const serre = (t: string) => t.replace(/\s/g, "");
    assert.ok(serre(pages[0]).includes("LIRELESPLANS"), "pas de légende en page 1");
    fige.postes.reseaux.forEach((r, k) => assert.match(pages[1 + k], new RegExp(`Réseau ${r.i + 1}`), `page ${k + 2} : pas le réseau ${r.i + 1}`));
    assert.ok(serre(pages[1 + fige.postes.reseaux.length]).includes("LALISTEDESPIÈCES"), "la liste ne suit pas les réseaux");
  });

  await cas("aucune réserve, ni la phrase « Nous ne garantissons pas… », ni pied de page", () => {
    assert.ok(fige.reserves.length > 1, "le plan d'essai n'a pas de réserve : le contrôle ne mesure rien");
    for (const r of fige.reserves) assert.ok(!tout.includes(pourLePapier(r).texte.slice(0, 40)), `réserve imprimée : ${r.slice(0, 60)}`);
    assert.ok(!/garantissons/i.test(tout));
    assert.ok(!/Page \d+ sur \d+|Empreinte/i.test(tout));
  });

  await cas("chaque pièce de la liste y est, avec sa quantité", () => {
    const lignes = donnees.groupes.flatMap((g) => g.lignes);
    assert.ok(lignes.length > 10);
    for (const l of lignes) {
      const nom = pourLePapier(l.nom).texte;
      assert.ok(tout.includes(nom.split(" ").slice(0, 3).join(" ")), `absente : ${l.quantite} ${nom}`);
    }
  });

  await cas("le dessin de l'écran passe entier : le traceur ne laisse rien de côté", async () => {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const police = await doc.embedFont(readFileSync("src/server/pdf/polices/inter-400.ttf"));
    const page = doc.addPage();
    let tracees = 0;
    for (const r of donnees.reseaux) {
      assert.ok(r.plan, `${r.titre} : pas de dessin`);
      const t = tracerSvg(page, r.plan as NoeudSvg, { gauche: 0, haut: 800, largeur: 200, hauteur: 150 }, { texte: police, titres: police });
      assert.deepEqual(t.ignores, [], `${r.titre} : éléments ignorés ${t.ignores.join(", ")}`);
      tracees++;
    }
    for (const l of donnees.legende) assert.deepEqual(tracerSvg(page, l.symbole, { gauche: 0, haut: 10, largeur: 10, hauteur: 10 }, { texte: police, titres: police }).ignores, []);
    assert.equal(tracees, fige.postes.reseaux.length);
  });

  await cas("aucun caractère sans glyphe dans les polices du PDF", () => {
    const textes = [
      donnees.entreprise, donnees.dossier, donnees.date, donnees.resume, "Plan d’arrosage", "LIRE LES PLANS", "LES PIÈCES", "UNE TÊTE, DE BAS EN HAUT", "LA LISTE DES PIÈCES, SUITE",
      ...donnees.legende.flatMap((l) => l.texte.map((s) => s.texte)),
      ...donnees.reseaux.flatMap((r) => [r.titre, ...r.zones, ...r.lignes.flatMap((l) => [l.quantite ?? "", l.texte]), r.tuyau.texte, ...(r.chaine ?? []).map((m) => m.libelle), ...r.rail.map((p) => p.detail || p.nom)]),
      ...donnees.groupes.flatMap((g) => [g.titre, ...g.lignes.flatMap((l) => [l.quantite, l.nom])]),
    ];
    for (const f of ["inter-400.ttf", "inter-700.ttf", "atlas-archive-serif-400.ttf"]) {
      const police = fontkit.create(readFileSync(path.join("src/server/pdf/polices", f)));
      const manque = new Set<string>();
      for (const t of textes) for (const c of pourLePapier(t).texte) if (c.trim() && !police.hasGlyphForCodePoint(c.codePointAt(0) as number)) manque.add(c);
      assert.deepEqual([...manque], [], `${f} n'a pas : ${[...manque].join(" ")}`);
    }
  });

  const i = process.argv.indexOf("--images");
  if (i > 0) {
    const dossier = process.argv[i + 1];
    mkdirSync(dossier, { recursive: true });
    writeFileSync(path.join(dossier, "plan.pdf"), octets);
    execFileSync("pdftoppm", ["-r", "70", "-png", path.join(dossier, "plan.pdf"), path.join(dossier, "page")]);
    console.log(`\n  ${pages.length} pages écrites dans ${dossier}`);
  }

  console.log(echecs ? `\n❌ ${echecs} échec(s)` : "\n✅ Le PDF du plan : un réseau par page, sans réserve, rien de perdu.");
  process.exit(echecs ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
