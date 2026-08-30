import assert from "node:assert/strict";
import { composerDevisPdf, type DevisPdfData, type TraceDevis } from "../src/server/pdf/devis-pdf";

// Le capital social, la forme juridique et le RCS, dessinés pour de vrai sur
// le PDF (migration 0071) — `test-mentions-legales.ts` couvre déjà le calcul
// pur des lignes ; cette suite-ci vérifie que `document-commun.ts` les
// dessine bien à l'endroit choisi, et nulle part ailleurs.

const BASE: DevisPdfData = {
  numeroCommercial: "2026-0006",
  numeroVersion: 1,
  statut: "envoye",
  dateEmission: "2026-08-03",
  entrepriseNom: "Atlas",
  entrepriseAdresse: "10 rue des Artisans, 78200 Buchelay",
  entrepriseSiret: "123 456 789 00012",
  entrepriseTelephone: "06 79 98 45 14",
  entrepriseEmail: "contact@atlas.fr",
  clientNom: "M. Bernard",
  devise: "EUR",
  tauxTva: "10.00",
  totalHt: "2450.00",
  totalTva: "245.00",
  totalTtc: "2695.00",
  lignes: [{ libelle: "Taille de haie", quantite: "1", prixUnitaire: "560.00", montant: "560.00" }],
};

const contenus = (trace: TraceDevis) => trace.textes.map((t) => t.contenu);

let echecs = 0;
async function cas(nom: string, verifier: () => void | Promise<void>) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

async function main() {
  console.log("=== Le capital, la forme juridique et le RCS sur le devis ===");

  await cas("aucun réglage : rien ne s'imprime, comme avant la migration 0071", async () => {
    const { trace } = await composerDevisPdf(BASE);
    const textes = contenus(trace);
    assert.ok(!textes.some((t) => t.includes("SASU")));
    assert.ok(!textes.some((t) => t.includes("RCS")));
  });

  await cas('« aucune » retient tout, même les trois mentions remplies', async () => {
    const { trace } = await composerDevisPdf({
      ...BASE,
      entrepriseFormeJuridique: "SASU",
      entrepriseCapitalSocial: "1000.00",
      entrepriseVilleRcs: "Versailles",
      entrepriseMentionsLegalesPosition: "aucune",
    });
    const textes = contenus(trace);
    assert.ok(!textes.some((t) => t.includes("SASU")));
    assert.ok(!textes.some((t) => t.includes("RCS")));
  });

  await cas('« sous_nom » : les deux lignes sont dessinées, entre le nom et l\'adresse', async () => {
    const { trace } = await composerDevisPdf({
      ...BASE,
      entrepriseFormeJuridique: "SASU",
      entrepriseCapitalSocial: "1000.00",
      entrepriseVilleRcs: "Versailles",
      entrepriseMentionsLegalesPosition: "sous_nom",
    });
    const nom = trace.textes.find((t) => t.contenu === "Atlas");
    const mention = trace.textes.find((t) => t.contenu.includes("SASU au capital de"));
    const rcs = trace.textes.find((t) => t.contenu.includes("RCS Versailles"));
    const adresse = trace.textes.find((t) => t.contenu === BASE.entrepriseAdresse);
    assert.ok(nom && mention && rcs && adresse, "une des quatre lignes manque au PDF");
    // Le PDF descend : une ordonnée plus GRANDE veut dire plus HAUT sur la page.
    assert.ok(nom!.y > mention!.y, "la mention devrait être sous le nom");
    assert.ok(mention!.y > rcs!.y, "le RCS devrait suivre la mention de capital");
    assert.ok(rcs!.y > adresse!.y, "l'adresse devrait suivre les mentions légales");
  });

  await cas('« bas » : les deux lignes rejoignent le SIRET, pas le nom', async () => {
    const { trace } = await composerDevisPdf({
      ...BASE,
      entrepriseFormeJuridique: "SASU",
      entrepriseCapitalSocial: "1000.00",
      entrepriseVilleRcs: "Versailles",
      entrepriseMentionsLegalesPosition: "bas",
    });
    const adresse = trace.textes.find((t) => t.contenu === BASE.entrepriseAdresse);
    const mention = trace.textes.find((t) => t.contenu.includes("SASU au capital de"));
    const rcs = trace.textes.find((t) => t.contenu.includes("RCS Versailles"));
    const siret = trace.textes.find((t) => t.contenu.includes("SIRET"));
    assert.ok(mention && rcs && adresse && siret, "une des quatre lignes manque au PDF");
    // Ici la mention précède l'adresse, qui précède elle-même le SIRET.
    assert.ok(mention!.y > rcs!.y, "la mention de capital précède le RCS");
    assert.ok(rcs!.y > adresse!.y, "le RCS précède l'adresse");
    assert.ok(adresse!.y > siret!.y, "l'adresse précède le SIRET, en dernier");
  });

  await cas("une entreprise individuelle ne montre rien, même réglée sur « sous_nom »", async () => {
    const { trace } = await composerDevisPdf({
      ...BASE,
      entrepriseFormeJuridique: "EI",
      entrepriseCapitalSocial: "1000.00",
      entrepriseVilleRcs: "Versailles",
      entrepriseMentionsLegalesPosition: "sous_nom",
    });
    const textes = contenus(trace);
    assert.ok(!textes.some((t) => t.includes("EI")), "une EI n'a pas de capital ni de RCS");
    assert.ok(!textes.some((t) => t.includes("RCS")));
  });

  console.log(`\n${echecs === 0 ? "✅ Toutes les vérifications passent." : `❌ ${echecs} échec(s).`}`);
  process.exit(echecs === 0 ? 0 : 1);
}

main();
