import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import { nettoyerBase } from "./_test-db";
import { creerEntreprise, mettreAJourEntreprise, getEntreprise } from "../src/server/repositories/entreprises";
import { creerChantier } from "../src/server/repositories/chantiers";
import { ajouterLignePrix, modifierLignePrix, supprimerLignePrix } from "../src/server/repositories/lignes-prix";
import { getLignesDevis, getOuCreerDevisBrouillon, mettreAJourEnTeteDevis } from "../src/server/repositories/devis";
import { conditionsDepuisEntreprise } from "../src/lib/conditions-documents";
import { TEXTE_ORIGINE_CONDITIONS_GENERALES } from "../src/lib/conditions-generales";
import type { Ctx } from "../src/server/repositories/context";

/**
 * LA PLANCHE B DU DEVIS, CONTRE LA BASE — ce que la suite pure ne peut pas voir :
 *
 *   · les conditions générales descendent sur le devis comme les cinq
 *     conditions de la 0064 : un brouillon rouvert reprend le réglage du jour,
 *     un devis envoyé est figé (trigger) ;
 *   · la main d'œuvre est une LIGNE qui s'additionne, à 10 % comme à 20 %, et
 *     « dont main d'œuvre HT » est la somme de ces lignes, jamais un montant
 *     tapé à part (sa réponse A du 13 octobre 2026) ;
 *
 * Ce que le PDF en fait est éprouvé par sa trace dans `test-planche-b-devis.ts`.
 *
 * Sous `atlas_app`, comme l'application.
 */

let echecs = 0;
async function essai(nom: string, fn: () => Promise<void> | void) {
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
  await nettoyerBase();
  const { entreprise, utilisateurId } = await creerEntreprise(
    { nom: "Planche B" },
    { email: `pb-${Math.random().toString(36).slice(2)}@essai.local`, nom: "Patron" }
  );
  const ctx: Ctx = { utilisateurId, entrepriseId: entreprise.id };

  console.log("\n=== Les conditions générales, figées sur le devis ===\n");

  await essai("une entreprise qui n'a rien réglé lit le texte d'origine — la case arrive remplie", async () => {
    const c = conditionsDepuisEntreprise(await getEntreprise(ctx));
    assert.equal(c.conditionsGenerales, TEXTE_ORIGINE_CONDITIONS_GENERALES);
  });

  let devisA!: { id: string; chantierId: string };

  await essai("un devis créé sans rien avoir réglé porte le texte d'origine", async () => {
    const chantier = await creerChantier(ctx, { nom: "Gazon — A" });
    const d = await getOuCreerDevisBrouillon(ctx, chantier.id);
    devisA = { id: d.id, chantierId: chantier.id };
    assert.equal(d.conditionsGenerales, TEXTE_ORIGINE_CONDITIONS_GENERALES);
  });

  await essai("il réécrit ses conditions : un brouillon rouvert et un devis neuf prennent les nouvelles", async () => {
    await mettreAJourEntreprise(ctx, { conditions: { conditionsGenerales: "Mes conditions à moi." } });
    assert.equal(conditionsDepuisEntreprise(await getEntreprise(ctx)).conditionsGenerales, "Mes conditions à moi.");
    // Un BROUILLON rouvert reprend le réglage du jour — c'est la règle des cinq
    // autres conditions (la validité, l'acompte…) ; seul un devis envoyé est figé.
    const a = await getOuCreerDevisBrouillon(ctx, devisA.chantierId);
    assert.equal(a.conditionsGenerales, "Mes conditions à moi.", "le brouillon rouvert garde un réglage périmé");
    const chantierB = await creerChantier(ctx, { nom: "Gazon — B" });
    const b = await getOuCreerDevisBrouillon(ctx, chantierB.id);
    assert.equal(b.conditionsGenerales, "Mes conditions à moi.");
  });

  await essai("il efface tout : la base garde la chaîne VIDE, pas NULL — sinon le texte d'origine reviendrait", async () => {
    await mettreAJourEntreprise(ctx, { conditions: { conditionsGenerales: "" } });
    // Lu SOUS le contexte de l'entreprise : sans lui, la RLS ne rend rien.
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.entreprise_id', $1, true)", [entreprise.id]);
      const { rows } = await client.query("SELECT conditions_generales FROM entreprises WHERE id = $1", [entreprise.id]);
      assert.equal(rows[0]?.conditions_generales, "");
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
    assert.equal(conditionsDepuisEntreprise(await getEntreprise(ctx)).conditionsGenerales, "");
    const chantierC = await creerChantier(ctx, { nom: "Gazon — C" });
    const c = await getOuCreerDevisBrouillon(ctx, chantierC.id);
    assert.equal(c.conditionsGenerales, "", "le devis porterait des conditions qu'il a effacées");
  });

  await essai("un geste qui ne règle que l'acompte ne touche pas aux conditions générales", async () => {
    // Le 14 septembre 2026 : la photo d'un devis renvoyait les six réglages
    // relus SANS cette clef, et `normaliserConditions` lisait l'absence comme
    // « effacé » — plus rien ne s'imprimait après le bon pour accord.
    await mettreAJourEntreprise(ctx, { conditions: { conditionsGenerales: "Mes conditions à moi." } });
    await mettreAJourEntreprise(ctx, { conditions: { acomptePourcent: "40" } });
    const c = conditionsDepuisEntreprise(await getEntreprise(ctx));
    assert.equal(c.acomptePourcent, 40);
    assert.equal(c.conditionsGenerales, "Mes conditions à moi.", "régler l'acompte a effacé les conditions générales");
    await mettreAJourEntreprise(ctx, { conditions: { conditionsGenerales: "" } });
  });

  // ── LA A DU 13 OCTOBRE 2026 ─────────────────────────────────────────────
  // *« Dire main d'œuvre 500 € et que ça s'additionne comme une tâche
  // normale, pour les lignes TVA à 10 et TVA à 20. »* La main d'œuvre est une
  // ligne ; « dont main d'œuvre HT » est la somme de ces lignes.
  console.log("\n=== La main d'œuvre qui s'additionne, dans chaque TVA ===\n");

  let moDix!: string;
  let moVingt!: string;
  await essai("500 € à 10 % et 500 € à 20 % s'ajoutent au total et à la TVA de leur taux", async () => {
    await ajouterLignePrix(ctx, devisA.chantierId, "Terrassement", "380.00");
    await ajouterLignePrix(ctx, devisA.chantierId, "Gazon", "780.00", { tauxTva: "10.00" });
    moDix = (await ajouterLignePrix(ctx, devisA.chantierId, "Main d’œuvre", "500.00", { tauxTva: "10.00", mainDoeuvre: true })).id;
    moVingt = (await ajouterLignePrix(ctx, devisA.chantierId, "Main d’œuvre", "500.00", { mainDoeuvre: true })).id;
    const d = await getOuCreerDevisBrouillon(ctx, devisA.chantierId);
    assert.equal(d.totalHt, "2160.00", "la main d'œuvre ne s'additionne pas au total HT");
    // 10 % de (780 + 500) + 20 % de (380 + 500) = 128 + 176
    assert.equal(d.totalTva, "304.00", "la main d'œuvre n'est pas comptée à la TVA de sa catégorie");
    assert.equal(d.mainDoeuvreHt, "1000.00", "« dont main d'œuvre HT » n'est pas la somme des deux lignes");
  });

  await essai("la ligne du devis garde qu'elle est de la main d'œuvre, à son taux", async () => {
    const d = await getOuCreerDevisBrouillon(ctx, devisA.chantierId);
    const lignes = await getLignesDevis(ctx, d.id);
    const mo = lignes.filter((l) => l.mainDoeuvre);
    assert.equal(mo.length, 2, "le drapeau ne descend pas du chantier au devis");
    assert.deepEqual(mo.map((l) => l.tauxTva ?? "taux du devis").sort(), ["10.00", "taux du devis"]);
  });

  await essai("le libellé changé au doigt ne la fait pas sortir de « dont »", async () => {
    await modifierLignePrix(ctx, moDix, { libelle: "Main d’œuvre plantation" });
    const d = await getOuCreerDevisBrouillon(ctx, devisA.chantierId);
    assert.equal(d.mainDoeuvreHt, "1000.00");
  });

  await essai("une ligne ORDINAIRE nommée « Main d'œuvre » n'entre pas dans « dont »", async () => {
    const id = (await ajouterLignePrix(ctx, devisA.chantierId, "Main d’œuvre", "200.00")).id;
    const d = await getOuCreerDevisBrouillon(ctx, devisA.chantierId);
    assert.equal(d.mainDoeuvreHt, "1000.00", "le libellé a été pris pour le drapeau");
    await supprimerLignePrix(ctx, id);
  });

  await essai("retirée, elle sort du total et de « dont » ; les deux retirées, « dont » disparaît", async () => {
    await supprimerLignePrix(ctx, moVingt);
    const d1 = await getOuCreerDevisBrouillon(ctx, devisA.chantierId);
    assert.equal(d1.totalHt, "1660.00");
    assert.equal(d1.mainDoeuvreHt, "500.00");
    await supprimerLignePrix(ctx, moDix);
    const d2 = await getOuCreerDevisBrouillon(ctx, devisA.chantierId);
    assert.equal(d2.mainDoeuvreHt, null, "« dont main d'œuvre 0,00 € » sous un devis sans main d'œuvre");
  });

  await essai("une écriture voisine de l'en-tête ne la touche pas", async () => {
    await ajouterLignePrix(ctx, devisA.chantierId, "Main d’œuvre", "300.00", { mainDoeuvre: true });
    const d = await getOuCreerDevisBrouillon(ctx, devisA.chantierId);
    assert.equal(d.mainDoeuvreHt, "300.00");
    const d2 = await mettreAJourEnTeteDevis(ctx, d.id, { conditionsPaiement: "Accès par le portail." });
    assert.equal(d2?.mainDoeuvreHt, "300.00", "une écriture voisine a effacé la main d'œuvre");
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} La planche B du devis, en base — ${echecs} échec(s).`);
  await pool.end();
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
