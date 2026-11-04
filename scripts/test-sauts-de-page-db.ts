// LES SAUTS DE PAGE DU DEVIS, EN BASE — sa planche du 3 novembre 2026, codée le 4.
//
// Ce que la suite du PDF (`test-mise-en-page-devis.ts`) ne peut pas voir : où
// le saut est GARDÉ, et qu'il désigne toujours la même ligne. Les lignes d'un
// brouillon sont réécrites à chaque modification ; un saut accroché à elles
// aurait sauté de ligne, ou disparu, au premier prix changé. Il est accroché à
// la ligne de prix du chantier, et c'est ce qui s'éprouve ici, sous `atlas_app`.

import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { pool } from "../src/server/db/client";
import { withEntreprise } from "../src/server/db/with-entreprise";
import { lignesDevis } from "../src/server/db/schema";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as clientsRepo from "../src/server/repositories/clients";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as lignesPrixRepo from "../src/server/repositories/lignes-prix";
import * as devisRepo from "../src/server/repositories/devis";

let echecs = 0;
async function cas(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

type Ctx = { utilisateurId: string; entrepriseId: string };

async function contexte(suffixe: string): Promise<Ctx> {
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: "Atelier" },
    { email: `sauts-${suffixe}-${Date.now()}@t.test` }
  );
  return { utilisateurId, entrepriseId: entreprise.id };
}

/** Un chantier de vingt lignes : assez pour que la page 2 existe. */
async function unDevis(ctx: Ctx) {
  const client = await clientsRepo.creerClient(ctx, { nom: "M. Bernard" });
  const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Jardin", clientId: client.id });
  const prix: string[] = [];
  for (let i = 0; i < 20; i++) {
    const l = await lignesPrixRepo.ajouterLignePrix(ctx, chantier.id, `Prestation ${i + 1}`, "100.00");
    prix.push(l.id);
  }
  const d = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
  return { chantierId: chantier.id, devisId: d.id, prix };
}

const ou = (mise: Awaited<ReturnType<typeof devisRepo.miseEnPageDuDevis>>, cle: string) =>
  mise.elements.find((e) => e.cle === cle);

async function main() {
  console.log("=== Les sauts de page du devis, en base ===\n");

  await cas("chaque ligne du devis garde la ligne de prix d'où elle vient", async () => {
    const ctx = await contexte("origine");
    const { devisId, prix } = await unDevis(ctx);
    const lignes = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
      tx.select({ lignePrixId: lignesDevis.lignePrixId }).from(lignesDevis).where(eq(lignesDevis.devisId, devisId))
    );
    assert.deepEqual(new Set(lignes.map((l) => l.lignePrixId)), new Set(prix));
  });

  await cas("un saut posé devant une ligne la met en haut de la page suivante, et se retire", async () => {
    const ctx = await contexte("poser");
    const { devisId, prix } = await unDevis(ctx);
    const cle = `ligne:${prix[4]}`;
    const avant = await devisRepo.miseEnPageDuDevis(ctx, devisId);
    assert.equal(avant.modifiable, true);
    assert.equal(ou(avant, cle)?.page, 1, "le décor ne prouve rien : la ligne 5 n'était pas en page 1");

    const pose = await devisRepo.basculerSautDePage(ctx, devisId, cle);
    assert.deepEqual(pose, { ok: true, sauts: [cle] });
    const apres = await devisRepo.miseEnPageDuDevis(ctx, devisId);
    assert.equal(ou(apres, cle)?.page, 2, "le saut n'a pas envoyé la ligne 5 en page 2");
    assert.equal(ou(apres, `ligne:${prix[3]}`)?.page, 1, "la ligne 4 a suivi la ligne 5");

    assert.deepEqual(await devisRepo.basculerSautDePage(ctx, devisId, cle), { ok: true, sauts: [] });
    assert.equal(ou(await devisRepo.miseEnPageDuDevis(ctx, devisId), cle)?.page, 1, "retiré, le saut agit encore");
  });

  await cas("le saut reste devant SA ligne quand une ligne s'ajoute et que le brouillon se réécrit", async () => {
    const ctx = await contexte("suivre");
    const { chantierId, devisId, prix } = await unDevis(ctx);
    const cle = `ligne:${prix[10]}`;
    await devisRepo.basculerSautDePage(ctx, devisId, cle);
    // Une ligne de plus, glissée en tête : toutes les lignes du devis sont
    // effacées puis recopiées, chacune avec un identifiant neuf.
    const neuve = await lignesPrixRepo.ajouterLignePrix(ctx, chantierId, "Prestation ajoutée", "50.00");
    await lignesPrixRepo.reordonnerLignesPrix(ctx, chantierId, [neuve.id, ...prix]);
    const reecrit = await devisRepo.getOuCreerDevisBrouillon(ctx, chantierId);
    assert.equal(reecrit.id, devisId, "le brouillon a changé de devis : le décor ne prouve rien");
    const mise = await devisRepo.miseEnPageDuDevis(ctx, devisId);
    const saute = ou(mise, cle);
    const precedente = ou(mise, `ligne:${prix[9]}`);
    assert.ok(saute && precedente, "les lignes ne se retrouvent plus par leur ligne de prix");
    assert.equal(saute.page, precedente.page + 1, "le saut n'est plus devant la même ligne");
  });

  await cas("tout remettre retire tous les sauts", async () => {
    const ctx = await contexte("tout");
    const { devisId, prix } = await unDevis(ctx);
    await devisRepo.basculerSautDePage(ctx, devisId, `ligne:${prix[2]}`);
    await devisRepo.basculerSautDePage(ctx, devisId, "totaux");
    assert.deepEqual(await devisRepo.retirerLesSautsDePage(ctx, devisId), { ok: true });
    assert.deepEqual((await devisRepo.miseEnPageDuDevis(ctx, devisId)).sauts, []);
  });

  await cas("un devis envoyé garde ses sauts et refuse d'en changer", async () => {
    const ctx = await contexte("envoye");
    const { chantierId, devisId, prix } = await unDevis(ctx);
    const cle = `ligne:${prix[6]}`;
    await devisRepo.basculerSautDePage(ctx, devisId, cle);
    await devisRepo.envoyerDevis(ctx, devisId);

    const refus = await devisRepo.basculerSautDePage(ctx, devisId, "notes");
    assert.equal(refus.ok, false, "un devis envoyé a changé de mise en page");
    assert.equal((await devisRepo.retirerLesSautsDePage(ctx, devisId)).ok, false);
    const mise = await devisRepo.miseEnPageDuDevis(ctx, devisId);
    assert.equal(mise.modifiable, false);
    assert.deepEqual(mise.sauts, [cle], "le devis envoyé a perdu le saut avec lequel il est parti");

    // « Corriger le devis » : la version suivante reprend ses sauts.
    const v2 = await devisRepo.getOuCreerDevisBrouillon(ctx, chantierId);
    assert.notEqual(v2.id, devisId, "aucune nouvelle version : le décor ne prouve rien");
    assert.deepEqual((await devisRepo.miseEnPageDuDevis(ctx, v2.id)).sauts, [cle], "la correction a perdu ses sauts");
  });

  await cas("une autre entreprise ne touche pas à ses sauts", async () => {
    const a = await contexte("iso-a");
    const b = await contexte("iso-b");
    const { devisId } = await unDevis(a);
    const refus = await devisRepo.basculerSautDePage(b, devisId, "totaux");
    assert.equal(refus.ok, false);
    assert.deepEqual((await devisRepo.miseEnPageDuDevis(a, devisId)).sauts, [], "le devis de A a reçu un saut posé par B");
  });

  console.log(`\nLes sauts de page en base : ${echecs} échec(s).`);
  await pool.end();
  process.exit(echecs > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
