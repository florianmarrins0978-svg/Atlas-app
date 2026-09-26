import assert from "node:assert/strict";
import { eq, sql } from "drizzle-orm";
import { pool } from "../src/server/db/client";
import { withEntreprise } from "../src/server/db/with-entreprise";
import { factures } from "../src/server/db/schema";
import { nettoyerBase } from "./_test-db";
import { texteDuPdf } from "./_lecteur-pdf-protege";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import { attribuerNumeroFacture, genererPdfFactureExemple } from "../src/server/repositories/factures";
import { factureDExemple } from "../src/lib/facture-d-exemple";
import type { Ctx } from "../src/server/repositories/context";

/**
 * LA FACTURE D'EXEMPLE DES RÉGLAGES — sa demande du 26 septembre 2026 :
 * *« un bouton pour visualiser à quoi il ressemblera, avec deux trois lignes
 * factices avec des TVA différentes »* (planche `appli/apercu-du-document.html`).
 *
 * Sous `atlas_app`, donc sous la RLS : une route PDF éprouvée au seul
 * navigateur ne l'est pas de ce point de vue (`CLAUDE.md` §5).
 *
 *   · le papier est le sien : son nom, ses trois taux, EXEMPLE en travers ;
 *   · RIEN ne s'écrit : aucune facture, et surtout aucun numéro pris — le
 *     numéro montré est celui que la prochaine vraie facture reçoit ;
 *   · en franchise, les mêmes lignes à 0 %, avec la mention 293 B.
 */

let echecs = 0;
async function essai(nom: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

/** Le papier pose certains mots lettre à lettre : on tolère les blancs. */
function espace(mot: string): RegExp {
  return new RegExp([...mot].map((c) => (/[.*+?^${}()|[\]\\]/.test(c) ? `\\${c}` : c)).join("\\s*"));
}

const MAINTENANT = new Date("2026-09-26T10:00:00Z");

async function compteur(ctx: Ctx): Promise<number> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const r: unknown = await tx.execute(
      sql`SELECT prochain_numero_facture AS n FROM entreprise_compteurs WHERE entreprise_id = ${ctx.entrepriseId}`
    );
    return Number((r as { rows: { n: number }[] }).rows[0].n);
  });
}

async function main() {
  await nettoyerBase();

  console.log("\n=== Les lignes d'exemple (règle pure) ===\n");

  await essai("trois lignes, trois taux différents", () => {
    const e = factureDExemple("assujettie");
    assert.equal(e.lignes.length, 3);
    assert.deepEqual(e.lignes.map((l) => l.tauxTva), ["20.00", "10.00", "5.50"]);
  });

  await essai("en franchise, tout à 0 %, et aucun taux dans les désignations", () => {
    const e = factureDExemple("franchise");
    assert.ok(e.lignes.every((l) => l.tauxTva === "0.00"));
    assert.equal(e.tauxDuDocument, "0.00");
    assert.ok(e.lignes.every((l) => !l.libelle.includes("%")), "une ligne en franchise annonce un taux");
  });

  console.log("\n=== Le papier, par le dépôt ===\n");

  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: "Eden Nature" },
    { email: `exemple-${Math.random().toString(36).slice(2)}@essai.local`, nom: "Patron" }
  );
  const ctx: Ctx = { utilisateurId, entrepriseId: entreprise.id };
  await entreprisesRepo.mettreAJourEntreprise(ctx, { regimeTva: "assujettie", siret: "12345678900012" });

  let texte = "";
  await essai("le PDF porte son nom, le client « Mr. Exemple », EXEMPLE et les trois taux", async () => {
    texte = texteDuPdf(await genererPdfFactureExemple(ctx, MAINTENANT));
    assert.match(texte, espace("Eden Nature"));
    assert.match(texte, espace("Mr. Exemple"));
    assert.match(texte, espace("EXEMPLE"));
    for (const t of ["20 %", "10 %", "5,5 %"]) {
      assert.match(texte, espace(`Ligne d'exemple à ${t}`), `la ligne à ${t} manque`);
    }
    assert.doesNotMatch(texte, espace("293 B"), "une entreprise assujettie reçoit la mention de franchise");
  });

  await essai("aucune facture n'est créée, aucun numéro n'est pris", async () => {
    const avant = await compteur(ctx);
    await genererPdfFactureExemple(ctx, MAINTENANT);
    await genererPdfFactureExemple(ctx, MAINTENANT);
    assert.equal(await compteur(ctx), avant, "l'exemple a consommé un numéro : la suite des factures aurait un trou");
    const lignes = await withEntreprise(utilisateurId, entreprise.id, (tx) =>
      tx.select({ id: factures.id }).from(factures).where(eq(factures.entrepriseId, entreprise.id))
    );
    assert.equal(lignes.length, 0, "l'exemple a écrit une facture");
  });

  await essai("le numéro montré est celui que reçoit la prochaine vraie facture", async () => {
    const montre = texteDuPdf(await genererPdfFactureExemple(ctx));
    const vrai = await withEntreprise(utilisateurId, entreprise.id, (tx) => attribuerNumeroFacture(tx, entreprise.id));
    assert.match(montre, espace(vrai), `l'exemple ne montre pas ${vrai}`);
  });

  await essai("en franchise : la mention 293 B, et aucune ligne à 20 %", async () => {
    await entreprisesRepo.mettreAJourEntreprise(ctx, { regimeTva: "franchise" });
    const t = texteDuPdf(await genererPdfFactureExemple(ctx, MAINTENANT));
    assert.match(t, espace("293 B"));
    assert.doesNotMatch(t, espace("Ligne d'exemple à"));
  });

  await pool.end();
  if (echecs > 0) {
    console.log(`\n${echecs} échec(s)`);
    process.exit(1);
  }
  console.log("\nTout est vert.");
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
