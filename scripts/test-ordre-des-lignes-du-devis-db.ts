// LE DEVIS PART DANS L'ORDRE DE L'ÉCRAN — en base, sous `atlas_app`.
//
// **Le défaut, trouvé le 2 novembre 2026 en codant la planche du devis.**
// `getOuCreerDevisBrouillon` lisait les lignes du chantier sans `ORDER BY`,
// puis les recopiait sur le devis avec `ordre: i`. L'ordre du devis envoyé au
// client était donc celui où PostgreSQL rangeait les lignes sur le disque, et
// une ligne retouchée (un `UPDATE` écrit une nouvelle version de la ligne, au
// bout de la table) passait derrière les autres. L'écran, lui, lit par
// `ordre` : il montrait « Taille, Tonte, Évacuation », le client recevait
// « Tonte, Évacuation, Taille ».
//
// **Et le PDF relisait ses propres lignes sans ordre** (aperçu, envoi, feuille
// sans prix) : aucun geste ne réécrit aujourd'hui `lignes_devis`, donc l'ordre
// du disque tombait juste par accident. Le contrôle le provoque.
//
// **Le piège se pose en remplissant la page.** Une ligne retouchée sur une
// page qui a encore de la place garde sa place dans l'index (mise à jour
// « HOT »), et la lecture sans ordre tombe juste par chance : la première
// version de ce contrôle était verte contre le code fautif. Sur la base d'un
// artisan, les pages sont pleines : la nouvelle version part sur une autre
// page, l'index la range au bout. C'est ce que fait `remplirLaPage`.
//
// Chaque cas vérifie d'abord que le piège est posé (l'ordre du disque n'est
// plus celui de l'écran) : sans cela, un vert ne prouverait rien.

import assert from "node:assert/strict";
import { eq, sql } from "drizzle-orm";
import { pool } from "../src/server/db/client";
import { withEntreprise } from "../src/server/db/with-entreprise";
import { lignesDevis, lignesPrix } from "../src/server/db/schema";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as devisRepo from "../src/server/repositories/devis";
import * as prixRepo from "../src/server/repositories/lignes-prix";
import { nettoyerBase } from "./_test-db";
import { texteDuPdf } from "./_lecteur-pdf-protege";

let echecs = 0;
async function essai(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

async function main() {
  console.log("L'ordre des lignes du devis, en base\n");
  await nettoyerBase();
  const A = await entreprisesRepo.creerEntreprise(
    { nom: "Paysages A" },
    { email: `ordre-lignes-${Date.now()}@test.local`, nom: "Anne" }
  );
  const ctx = { utilisateurId: A.utilisateurId, entrepriseId: A.entreprise.id };

  /** L'ordre où PostgreSQL range les lignes sur le disque : celui d'une lecture sans `ORDER BY`. */
  const ordreDuDisque = (table: "lignes_prix" | "lignes_devis", colonne: string, id: string) =>
    withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
      const r: unknown = await tx.execute(
        sql`SELECT libelle FROM ${sql.identifier(table)} WHERE ${sql.identifier(colonne)} = ${id} ORDER BY ctid`
      );
      const lignes = Array.isArray(r) ? r : (r as { rows: { libelle: string }[] }).rows;
      return (lignes as { libelle: string }[]).map((l) => l.libelle);
    });

  /** Les lignes d'un autre chantier, qui remplissent la page où vivent celles du test. */
  const remplissage = await chantiersRepo.creerChantier(ctx, { nom: "Remplissage" });
  const remplirLaPage = () =>
    withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
      tx.insert(lignesPrix).values(
        Array.from({ length: 80 }, (_, i) => ({
          entrepriseId: ctx.entrepriseId,
          chantierId: remplissage.id,
          libelle: `Ligne de remplissage numéro ${i}, assez longue pour occuper sa place`,
          montant: "10.00",
          prixUnitaire: "10.00",
          ordre: i,
        }))
      )
    );

  const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Bernard" });
  const taille = await prixRepo.ajouterLignePrix(ctx, chantier.id, "Taille de haie", "300.00");
  await prixRepo.ajouterLignePrix(ctx, chantier.id, "Tonte", "120.00");
  await prixRepo.ajouterLignePrix(ctx, chantier.id, "Évacuation des déchets", "80.00");
  await remplirLaPage();
  // Il retouche la première ligne : sa nouvelle version part sur une autre page.
  await prixRepo.modifierLignePrix(ctx, taille.id, { libelle: "Taille de haie basse" });
  const ATTENDU = ["Taille de haie basse", "Tonte", "Évacuation des déchets"];

  await essai("le devis prend les lignes dans l'ordre de l'écran, pas dans celui du disque", async () => {
    assert.deepEqual(
      (await prixRepo.listerLignesPrix(ctx, chantier.id)).map((l) => l.libelle),
      ATTENDU,
      "l'écran lui-même n'est plus dans l'ordre"
    );
    assert.notDeepEqual(
      await ordreDuDisque("lignes_prix", "chantier_id", chantier.id),
      ATTENDU,
      "le piège n'est pas posé : la ligne retouchée est restée à sa place sur le disque"
    );
    const d = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
    const lignes = await devisRepo.getLignesDevis(ctx, d.id);
    assert.deepEqual(
      lignes.map((l) => [l.libelle, l.ordre]),
      ATTENDU.map((libelle, i) => [libelle, i])
    );
  });

  await essai("le PDF du devis relit ses lignes par leur rang, quel que soit le disque", async () => {
    // Le brouillon du premier cas, tel quel : le régénérer réécrirait ses lignes.
    const d = (await devisRepo.getDevisPourChantier(ctx, chantier.id))!;
    // Un second devis remplit la page des lignes de devis.
    await devisRepo.getOuCreerDevisBrouillon(ctx, remplissage.id);
    // Aucun geste ne réécrit une ligne de devis aujourd'hui : on déplace donc à
    // la main la première au bout de la table, comme le ferait n'importe quel
    // `UPDATE` de demain.
    await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
      await tx
        .update(lignesDevis)
        .set({ libelle: sql`${lignesDevis.libelle}` })
        .where(sql`${lignesDevis.devisId} = ${d.id} AND ${lignesDevis.ordre} = 0`);
    });
    assert.notDeepEqual(
      await ordreDuDisque("lignes_devis", "devis_id", d.id),
      ATTENDU,
      "le piège n'est pas posé : la ligne du devis est restée à sa place sur le disque"
    );
    assert.deepEqual(
      (await devisRepo.getLignesDevis(ctx, d.id)).map((l) => l.libelle),
      ATTENDU,
      "les lignes du devis se relisent dans le désordre"
    );
    const texte = texteDuPdf(await devisRepo.genererPdfPourApercu(ctx, d.id)).replace(/\s+/g, " ");
    const places = ATTENDU.map((libelle) => texte.indexOf(libelle));
    assert.ok(
      places.every((p) => p >= 0),
      `une ligne manque au PDF : ${JSON.stringify(places)}`
    );
    assert.deepEqual(
      [...places].sort((a, b) => a - b),
      places,
      `le PDF imprime les lignes dans le désordre : ${JSON.stringify(places)}`
    );
  });

  await essai("deux lignes au même rang gardent l'ordre où elles sont nées", async () => {
    // `ajouterLignePrix` compte les lignes pour se donner un rang : après un
    // retrait, la nouvelle prend celui de la dernière. L'écran et le devis
    // doivent alors trancher de la même façon, et pas au hasard du disque.
    const c = await chantiersRepo.creerChantier(ctx, { nom: "Claire" });
    const a = await prixRepo.ajouterLignePrix(ctx, c.id, "Plantation", "200.00");
    await prixRepo.ajouterLignePrix(ctx, c.id, "Paillage", "60.00");
    await prixRepo.ajouterLignePrix(ctx, c.id, "Arrosage", "40.00");
    const arrosage = (await prixRepo.listerLignesPrix(ctx, c.id)).find((l) => l.libelle === "Arrosage")!;
    await prixRepo.supprimerLignePrix(ctx, a.id);
    await prixRepo.ajouterLignePrix(ctx, c.id, "Tuteurage", "30.00");
    await remplirLaPage();
    // Retouchée après la naissance de « Tuteurage » : sur le disque, elle passe derrière.
    await prixRepo.modifierLignePrix(ctx, arrosage.id, { libelle: "Arrosage au goutte à goutte" });
    const ecran = (await prixRepo.listerLignesPrix(ctx, c.id)).map((l) => l.libelle);
    assert.deepEqual(ecran, ["Paillage", "Arrosage au goutte à goutte", "Tuteurage"]);
    const d = await devisRepo.getOuCreerDevisBrouillon(ctx, c.id);
    const lignes = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
      tx.select().from(lignesDevis).where(eq(lignesDevis.devisId, d.id))
    );
    assert.deepEqual(
      lignes.sort((x, y) => x.ordre - y.ordre).map((l) => l.libelle),
      ecran
    );
  });

  await pool.end();
  console.log(`\n${echecs === 0 ? "✅" : "❌"} L'ordre des lignes du devis, en base : ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
