import assert from "node:assert";
import { asc, eq } from "drizzle-orm";
import { pool } from "../src/server/db/client";
import { withEntreprise } from "../src/server/db/with-entreprise";
import { lignesFacture, lignesPrix } from "../src/server/db/schema";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import * as devisRepo from "../src/server/repositories/devis";
import * as prixRepo from "../src/server/repositories/lignes-prix";
import { ajouterLigneDeFacture, majLigneDeFacture, terminerChantier } from "../src/server/repositories/factures";
import { fermerLimiteur } from "../src/server/rate-limit";
import { nettoyerBase } from "./_test-db";

// **« Dans l'unité, il ne peut pas y avoir la mention arbre. »** Sa règle du
// 29 septembre 2026, capture à l'appui : une dictée « démontage d'un chêne
// mort » avait posé « arbre » dans la case Unité du devis. Seules les unités
// de la rangée s'écrivent sur une ligne ; un arbre, un arbuste, une plante se
// comptent en « u ».
//
// La règle est tenue AU DÉPÔT, là où la ligne s'écrit : la dictée, l'IA, la
// reprise d'un tarif et le doigt passent tous par là. Une garde posée dans un
// seul appelant laisserait passer les autres.

let passed = 0;
let failed = 0;
async function test(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${nom}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

type Ctx = { utilisateurId: string; entrepriseId: string };

async function contexte(): Promise<Ctx> {
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: "Atelier des unités" },
    { email: `unites-${Date.now()}@t.test` }
  );
  return { utilisateurId, entrepriseId: entreprise.id };
}

async function uniteEnBase(ctx: Ctx, ligneId: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [l] = await tx.select({ unite: lignesPrix.unite }).from(lignesPrix).where(eq(lignesPrix.id, ligneId));
    assert.ok(l, "la ligne n'est pas lisible dans son entreprise : il n'y a rien à éprouver");
    return l.unite;
  });
}

async function main() {
  await nettoyerBase();
  const ctx = await contexte();
  const client = await clientsRepo.creerClient(ctx, { nom: "M. Chêne" });
  const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Chêne mort", clientId: client.id });

  await test("une ligne créée avec « arbre » s'enregistre sans unité, donc en « u »", async () => {
    const l = await prixRepo.ajouterLignePrix(ctx, chantier.id, "Démontage en rétention d'un chêne mort", "0", {
      unite: "arbre",
      aChiffrer: true,
    });
    assert.equal(await uniteEnBase(ctx, l.id), null, "« arbre » est resté dans la case Unité");
  });

  await test("une unité de la rangée se garde, et sa forme dite se ramène à la rangée", async () => {
    const l = await prixRepo.ajouterLignePrix(ctx, chantier.id, "Taille de haie", "100.00", { unite: "ml" });
    assert.equal(await uniteEnBase(ctx, l.id), "ml");
    const m = await prixRepo.ajouterLignePrix(ctx, chantier.id, "Engazonnement", "100.00", { unite: "mètres carrés" });
    assert.equal(await uniteEnBase(ctx, m.id), "m²", "« mètres carrés » ne devient pas « m² »");
  });

  await test("une ligne retouchée avec « arbuste » s'enregistre sans unité", async () => {
    const l = await prixRepo.ajouterLignePrix(ctx, chantier.id, "Plantation", "50.00", { unite: "ml" });
    await prixRepo.modifierLignePrix(ctx, l.id, { unite: "arbuste" });
    assert.equal(await uniteEnBase(ctx, l.id), null, "« arbuste » est resté dans la case Unité");
    await prixRepo.modifierLignePrix(ctx, l.id, { unite: "m3" });
    assert.equal(await uniteEnBase(ctx, l.id), "m³");
  });

  await test("sur une facture, une ligne ajoutée avec « plante » s'enregistre sans unité", async () => {
    const autre = await chantiersRepo.creerChantier(ctx, { nom: "Massif", clientId: client.id });
    await prixRepo.ajouterLignePrix(ctx, autre.id, "Massif", "300.00");
    const brouillon = await devisRepo.getOuCreerDevisBrouillon(ctx, autre.id);
    await devisRepo.envoyerDevis(ctx, brouillon.id);
    const facture = await terminerChantier(ctx, autre.id);
    const r = await ajouterLigneDeFacture(ctx, facture.id);
    assert.ok(r.ok, `l'ajout est refusé : ${r.ok ? "" : r.raison}`);
    const maj = await majLigneDeFacture(ctx, facture.id, r.ligne.id, { libelle: "Lavande", quantite: "6", unite: "plante" });
    assert.ok(maj.ok, `la correction est refusée : ${maj.ok ? "" : maj.raison}`);
    const lignes = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
      tx
        .select({ id: lignesFacture.id, unite: lignesFacture.unite })
        .from(lignesFacture)
        .where(eq(lignesFacture.factureId, facture.id))
        .orderBy(asc(lignesFacture.ordre))
    );
    const ajoutee = lignes.find((x) => x.id === r.ligne.id);
    assert.ok(ajoutee, "la ligne ajoutée a disparu");
    assert.equal(ajoutee.unite, null, "« plante » est resté dans la case Unité de la facture");
  });

  console.log(`\n${passed} réussi(s), ${failed} échoué(s)`);
  await fermerLimiteur();
  await pool.end();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
