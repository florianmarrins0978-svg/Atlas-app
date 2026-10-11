import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import { nettoyerBase } from "./_test-db";
import { creerEntreprise, mettreAJourEntreprise, getEntreprise } from "../src/server/repositories/entreprises";
import { creerChantier } from "../src/server/repositories/chantiers";
import { ajouterLignePrix, supprimerLignePrix } from "../src/server/repositories/lignes-prix";
import { getOuCreerDevisBrouillon, mettreAJourEnTeteDevis } from "../src/server/repositories/devis";
import { conditionsDepuisEntreprise } from "../src/lib/conditions-documents";
import { TEXTE_ORIGINE_CONDITIONS_GENERALES } from "../src/lib/conditions-generales";
import type { Ctx } from "../src/server/repositories/context";

/**
 * LA PLANCHE B DU DEVIS, CONTRE LA BASE — ce que la suite pure ne peut pas voir :
 *
 *   · les conditions générales descendent sur le devis comme les cinq
 *     conditions de la 0064 : un brouillon rouvert reprend le réglage du jour,
 *     un devis envoyé est figé (trigger) ;
 *   · « dont main d'œuvre HT » s'écrit par le dépôt, bornée au brut HT du
 *     devis du moment, et `null` retire la ligne ;
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
  let ligneGazon!: string;
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

  console.log("\n=== « dont main d'œuvre HT », par le dépôt ===\n");

  await essai("elle s'écrit, à deux décimales, et les totaux ne bougent pas", async () => {
    await ajouterLignePrix(ctx, devisA.chantierId, "Terrassement", "380.00");
    ligneGazon = (await ajouterLignePrix(ctx, devisA.chantierId, "Gazon", "780.00")).id;
    await getOuCreerDevisBrouillon(ctx, devisA.chantierId);
    const d = await mettreAJourEnTeteDevis(ctx, devisA.id, { mainDoeuvreHt: "450" });
    assert.equal(d?.mainDoeuvreHt, "450.00");
    assert.equal(d?.totalHt, "1160.00", "la main d'œuvre a changé le total : elle est « dont », pas « plus »");
  });

  await essai("« dont » ne dépasse pas le tout : 4 500 sur 1 160 de lignes est ramené à 1 160", async () => {
    const d = await mettreAJourEnTeteDevis(ctx, devisA.id, { mainDoeuvreHt: "4500" });
    assert.equal(d?.mainDoeuvreHt, "1160.00");
  });

  await essai("quand les lignes fondent sous elle, un brouillon rouvert la ramène au nouveau brut", async () => {
    await mettreAJourEnTeteDevis(ctx, devisA.id, { mainDoeuvreHt: "1000" });
    await supprimerLignePrix(ctx, ligneGazon);
    const d = await getOuCreerDevisBrouillon(ctx, devisA.chantierId);
    assert.equal(d.totalHt, "380.00");
    assert.equal(d.mainDoeuvreHt, "380.00", `« dont ${d.mainDoeuvreHt} » sous un total de 380`);
  });

  await essai("sur un devis sans ligne chiffrée, elle se garde — à la saisie ET au brouillon rouvert", async () => {
    // Sa plainte du 14 septembre 2026 : ouverte sur un devis encore vide, la
    // ligne partait au premier enregistrement, puis au rechargement.
    const chantier = await creerChantier(ctx, { nom: "Gazon — vide" });
    const d0 = await getOuCreerDevisBrouillon(ctx, chantier.id);
    const d1 = await mettreAJourEnTeteDevis(ctx, d0.id, { mainDoeuvreHt: "450" });
    assert.equal(d1?.mainDoeuvreHt, "450.00", "effacée à la saisie sur un devis vide");
    const d2 = await getOuCreerDevisBrouillon(ctx, chantier.id);
    assert.equal(d2.mainDoeuvreHt, "450.00", "effacée au rechargement sur un devis vide");
    // Et la borne se pose dès qu'une ligne existe.
    await ajouterLignePrix(ctx, chantier.id, "Bordures", "380.00");
    const d3 = await getOuCreerDevisBrouillon(ctx, chantier.id);
    assert.equal(d3.mainDoeuvreHt, "380.00", `« dont ${d3.mainDoeuvreHt} » sous un total de 380`);
  });

  await essai("vide ou nul la retire ; les autres champs de l'en-tête ne bougent pas", async () => {
    const d = await mettreAJourEnTeteDevis(ctx, devisA.id, { mainDoeuvreHt: null });
    assert.equal(d?.mainDoeuvreHt, null);
    const d2 = await mettreAJourEnTeteDevis(ctx, devisA.id, { conditionsPaiement: "Accès par le portail." });
    assert.equal(d2?.mainDoeuvreHt, null, "une écriture voisine a ressuscité la main d'œuvre");
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
