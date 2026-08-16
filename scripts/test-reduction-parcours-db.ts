// Le prix accordé au client, du devis jusqu'à la facture émise.
//
// **CE QUE CETTE SUITE EMPÊCHE, ET C'EST DE L'ARGENT.** Le patron a choisi
// l'arrangement B le 16 août 2026 — « sous le total et prix accordé au client ».
// Il lui a été dit ce que B coûte, avant qu'il choisisse : la réduction n'est
// PAS une ligne du tableau, donc elle ne voyage pas toute seule. Il faut la
// porter à la main dans le devis, dans la facture, dans les totaux de chacun.
// **Chaque endroit oublié est un montant faux sur un document qui part chez un
// client** — et celui qu'on oublierait en premier est la facture, parce qu'elle
// est écrite loin du devis.
//
// Une suite navigateur ne verrait rien de tout cela : l'écran du devis
// afficherait fièrement sa remise pendant que la facture partirait au prix
// plein. C'est en LISANT LA BASE, des deux côtés, que l'écart apparaît.
//
// Ce qu'elle tient, dans l'ordre du parcours :
//
//   1. la réduction s'enregistre sur le devis, et les totaux la suivent —
//      la TVA est calculée sur le NET, jamais sur le prix plein ;
//   2. elle survit à l'ajout d'une ligne. Elle a été accordée au client ;
//      corriger le devis ensuite ne la révoque pas, et la perdre en silence
//      lui ferait renvoyer un document plus cher que celui qu'il a promis ;
//   3. elle arrive sur la FACTURE, avec son montant recalculé ;
//   4. elle survit à l'émission, où les totaux sont refigés une dernière fois ;
//   5. le relevé de TVA voit le montant NET. Y déclarer le prix plein, c'est
//      payer de la TVA sur de l'argent que le client n'a jamais versé ;
//   6. la retirer remet le devis à son prix plein, sans reliquat.

import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import { nettoyerBase } from "./_test-db";
import { creerEntreprise } from "../src/server/repositories/entreprises";
import { creerChantier } from "../src/server/repositories/chantiers";
import { ajouterLignePrix } from "../src/server/repositories/lignes-prix";
import {
  getOuCreerDevisBrouillon,
  mettreAJourEnTeteDevis,
  getDevisPourChantier,
  envoyerDevis,
} from "../src/server/repositories/devis";
import {
  terminerChantier,
  emettreFacture,
  getFacturePourChantier,
  releveTvaCollectee,
} from "../src/server/repositories/factures";
import { soldera } from "../src/server/repositories/paiements-facture";

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

/** Un chantier à 870,00 € HT — le devis de la maquette 61, aux mêmes chiffres. */
async function monterDevis() {
  await nettoyerBase();
  const { entreprise, utilisateurId } = await creerEntreprise(
    { nom: "Essai remise" },
    { email: `rem-${Math.random().toString(36).slice(2)}@essai.local`, nom: "Patron" }
  );
  const ctx = { utilisateurId, entrepriseId: entreprise.id };
  const chantier = await creerChantier(ctx, { nom: "Élagage Bracquemont" });
  await ajouterLignePrix(ctx, chantier.id, "Élagage — 3 chênes", "450.00");
  await ajouterLignePrix(ctx, chantier.id, "Broyage des branches", "180.00");
  await ajouterLignePrix(ctx, chantier.id, "Évacuation des déchets verts", "240.00");
  const devis = await getOuCreerDevisBrouillon(ctx, chantier.id);
  return { ctx, chantierId: chantier.id, devisId: devis.id };
}

async function main() {
  console.log("=== Le prix accordé au client, du devis à la facture ===\n");

  await essai("il s'enregistre sur le devis, et la TVA suit le NET", async () => {
    const { ctx, devisId } = await monterDevis();
    const d = await mettreAJourEnTeteDevis(ctx, devisId, { reductionPourcent: "15" });
    assert.ok(d, "le devis n'a pas été mis à jour");
    assert.equal(d.reductionPourcent, "15.00");
    assert.equal(d.reductionMontant, "130.50");
    assert.equal(d.totalHt, "739.50", "le HT doit être NET de la réduction");
    assert.equal(d.totalTva, "147.90", "la TVA se calcule après la réduction");
    assert.notEqual(d.totalTva, "174.00", "174,00 € serait la TVA du prix plein : une déclaration fausse");
    assert.equal(d.totalTtc, "887.40");
  });

  await essai("il survit à une ligne ajoutée après coup", async () => {
    const { ctx, chantierId, devisId } = await monterDevis();
    await mettreAJourEnTeteDevis(ctx, devisId, { reductionPourcent: "10" });

    // Le patron corrige son devis : il ajoute une prestation oubliée.
    await ajouterLignePrix(ctx, chantierId, "Rognage de souche", "130.00");
    const regenere = await getOuCreerDevisBrouillon(ctx, chantierId);

    assert.equal(regenere.reductionPourcent, "10.00", "la remise accordée a disparu à la régénération");
    // 1 000,00 € brut désormais, donc 100,00 € retirés.
    assert.equal(regenere.reductionMontant, "100.00", "le montant retiré n'a pas suivi le nouveau total");
    assert.equal(regenere.totalHt, "900.00");
    assert.equal(regenere.totalTva, "180.00");
  });

  await essai("il arrive sur la facture, et n'y est pas oublié", async () => {
    const { ctx, chantierId, devisId } = await monterDevis();
    await mettreAJourEnTeteDevis(ctx, devisId, { reductionPourcent: "15" });

    await envoyerDevis(ctx, devisId);
    await terminerChantier(ctx, chantierId);
    const trouvee = await getFacturePourChantier(ctx, chantierId);
    assert.ok(trouvee, "aucune facture n'a été créée");
    const facture = trouvee.facture;
    assert.equal(
      facture.reductionPourcent,
      "15.00",
      "la remise accordée sur le devis n'est pas sur la facture : le client paierait ce qu'on venait de lui retirer"
    );
    assert.equal(facture.reductionMontant, "130.50");
    assert.equal(facture.totalHt, "739.50");
    assert.equal(facture.totalTva, "147.90");
  });

  await essai("il survit à l'émission, où les totaux sont refigés", async () => {
    const { ctx, chantierId, devisId } = await monterDevis();
    await mettreAJourEnTeteDevis(ctx, devisId, { reductionPourcent: "15" });
    await envoyerDevis(ctx, devisId);
    await terminerChantier(ctx, chantierId);
    const avant = await getFacturePourChantier(ctx, chantierId);
    await emettreFacture(ctx, avant!.facture.id);

    const apres = (await getFacturePourChantier(ctx, chantierId))!.facture;
    assert.equal(apres.statut, "emise");
    assert.equal(apres.reductionPourcent, "15.00");
    assert.equal(apres.reductionMontant, "130.50");
    assert.equal(apres.totalHt, "739.50", "l'émission a recalculé les totaux SANS la remise");
    assert.equal(apres.totalTtc, "887.40");
  });

  await essai("le relevé de TVA voit le NET, jamais le prix plein", async () => {
    const { ctx, chantierId, devisId } = await monterDevis();
    await mettreAJourEnTeteDevis(ctx, devisId, { reductionPourcent: "15" });
    await envoyerDevis(ctx, devisId);
    await terminerChantier(ctx, chantierId);
    const f = await getFacturePourChantier(ctx, chantierId);
    await emettreFacture(ctx, f!.facture.id);
    // **La facture doit être RÉGLÉE pour entrer au relevé** : depuis le 16 août
    // 2026, la TVA est exigible au paiement et non à l'envoi (`ARCHITECTURE.md`
    // §110). Sans ce règlement, le relevé rend 0,00 € — et le contrôle
    // accuserait la réduction d'un défaut qui n'est pas le sien.
    await soldera(ctx, f!.facture.id, "2099-01-01");

    const releve = await releveTvaCollectee(ctx, "2020-01-01", "2099-12-31");
    assert.equal(
      releve.totalHt,
      "739.50",
      "le relevé déclare le prix plein : c'est payer de la TVA sur de l'argent que le client n'a pas versé"
    );
    assert.equal(releve.totalTva, "147.90");
  });

  await essai("la retirer remet le devis à son prix plein, sans reliquat", async () => {
    const { ctx, chantierId, devisId } = await monterDevis();
    await mettreAJourEnTeteDevis(ctx, devisId, { reductionPourcent: "15" });
    const remis = await mettreAJourEnTeteDevis(ctx, devisId, { reductionPourcent: null });

    assert.equal(remis!.reductionPourcent, null);
    assert.equal(remis!.reductionMontant, null, "un montant sans pourcentage laisserait la base incohérente");
    assert.equal(remis!.totalHt, "870.00");
    assert.equal(remis!.totalTva, "174.00");

    // Et ce que l'écran relira ensuite doit dire la même chose.
    const relu = await getDevisPourChantier(ctx, chantierId);
    assert.equal(relu!.reductionPourcent, null);
  });

  await essai("un devis sans remise reste EXACTEMENT ce qu'il était", async () => {
    // Les milliers de devis déjà émis ne doivent pas bouger d'un centime.
    const { ctx, devisId } = await monterDevis();
    const d = await mettreAJourEnTeteDevis(ctx, devisId, { tauxTva: "20" });
    assert.equal(d!.reductionPourcent, null);
    assert.equal(d!.reductionMontant, null);
    assert.equal(d!.totalHt, "870.00");
    assert.equal(d!.totalTva, "174.00");
    assert.equal(d!.totalTtc, "1044.00");
  });

  await essai("la base refuse ce que la règle refuse — les deux gardes existent", async () => {
    const { ctx, devisId } = await monterDevis();
    // Un pourcentage hors bornes est ramené par la règle avant d'arriver en base.
    const borne = await mettreAJourEnTeteDevis(ctx, devisId, { reductionPourcent: "150" });
    assert.equal(borne!.reductionPourcent, "100.00", "150 % doit être borné, pas enregistré");

    // **Et la contrainte SQL existe, en second garde.**
    //
    // On vérifie sa PRÉSENCE plutôt que de tenter une écriture interdite : sous
    // RLS, un `UPDATE` de ce rôle sur un devis qu'il ne voit pas ne touche
    // aucune ligne et ne lève donc rien — le contrôle passerait au vert en
    // n'ayant rien éprouvé. Une mesure impossible n'est pas un succès
    // (`CLAUDE.md` §5). Le refus lui-même a été confronté à la main sur les cinq
    // formes fautives, en écrivant la migration 0048.
    const gardes = await pool.query(
      `SELECT conname FROM pg_constraint
        WHERE conrelid IN ('devis'::regclass, 'factures'::regclass)
          AND conname LIKE '%reduction%'`
    );
    const noms = gardes.rows.map((r) => r.conname as string).sort();
    assert.deepEqual(
      noms,
      [
        "devis_reduction_paire_ck",
        "devis_reduction_pourcent_ck",
        "factures_reduction_paire_ck",
        "factures_reduction_pourcent_ck",
      ],
      "un garde de base a disparu : l'écran redeviendrait le seul rempart"
    );
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} ${echecs} échec(s).`);
  await pool.end();
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
