import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import {
  ajouterLigneDeFacture,
  creerFactureSansDevis,
  emettreFacture,
  getFacturePourChantier,
  majLigneDeFacture,
  majReductionDeFacture,
} from "../src/server/repositories/factures";
import { withEntreprise } from "../src/server/db/with-entreprise";
import { factures } from "../src/server/db/schema";
import { nettoyerBase } from "./_test-db";
import { totauxAvecReduction } from "../src/lib/reduction-devis";

// ═══════════════════════════════════════════════════════════════════════════
// LE PRIX ACCORDÉ AU CLIENT, SUR UNE FACTURE — sa demande du 11 septembre 2026
// ═══════════════════════════════════════════════════════════════════════════
//
// *« On n'a pas mis la réduction client cliquable comme sur le devis. »*
//
// L'écran savait AFFICHER une remise reprise du devis ; rien, côté serveur, ne
// savait en poser une. Cette suite tient l'écriture, pas le dessin :
//
//   - le pourcentage se pose, se change, et se retire ;
//   - ce qui n'est pas un pourcentage utile EFFACE la remise au lieu d'en
//     garder une à zéro — un « 0 % » stocké ferait imprimer au client une ligne
//     dorée sans montant ;
//   - une facture ARRÊTÉE refuse, comme pour tout le reste de son en-tête.
//
// **Suite base, sous `atlas_app`** : ce qui se joue est un droit d'écriture, et
// les suites navigateur tournent sous un rôle qui traverse la RLS
// (`CLAUDE.md` §5).

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
    const cause = (err as { cause?: unknown }).cause;
    if (cause) console.error("   cause :", cause);
    failed++;
  }
}

type Ctx = { utilisateurId: string; entrepriseId: string };

async function contexte(): Promise<Ctx> {
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: "Jardins du Val" },
    { email: `remise-${Date.now()}@t.test` }
  );
  return { utilisateurId, entrepriseId: entreprise.id };
}

/** Le chemin du patron : une fiche client, puis « Faire la facture ». */
async function factureAvecUneLigne(ctx: Ctx, prix = "250.00") {
  const client = await clientsRepo.creerClient(ctx, { nom: "M. Frédéric" });
  const chantier = await chantiersRepo.creerChantier(ctx, {
    nom: "Chez M. Frédéric",
    clientId: client.id,
  });
  const facture = await creerFactureSansDevis(ctx, chantier.id);
  const ajout = await ajouterLigneDeFacture(ctx, facture.id, null);
  assert.ok(ajout.ok, "la ligne n'a pas été ajoutée : le décor ne mesure rien");
  await majLigneDeFacture(ctx, facture.id, ajout.ligne.id, {
    libelle: "Taille des graminées",
    quantite: "1",
    prixUnitaire: prix,
  });
  return { chantierId: chantier.id, factureId: facture.id };
}

const remiseEnBase = (ctx: Ctx, factureId: string) =>
  withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [f] = await tx
      .select({ pourcent: factures.reductionPourcent })
      .from(factures)
      .where(eq(factures.id, factureId))
      .limit(1);
    return f?.pourcent ?? null;
  });

async function main() {
  await nettoyerBase();

  await test("le prix accordé se pose, et le total de la facture le suit", async () => {
    const ctx = await contexte();
    const { chantierId, factureId } = await factureAvecUneLigne(ctx);

    const r = await majReductionDeFacture(ctx, factureId, "5");
    assert.ok(r.ok, "la remise a été refusée sur une facture en brouillon");
    assert.equal(await remiseEnBase(ctx, factureId), "5.00");

    // **Ce que l'écran et le PDF liront** — la même fonction pour les deux.
    const vue = await getFacturePourChantier(ctx, chantierId);
    assert.ok(vue);
    const totaux = totauxAvecReduction(vue.lignes, vue.facture.tauxTva, vue.facture.reductionPourcent);
    assert.equal(totaux.brutHt, "250.00");
    assert.equal(totaux.reductionMontant, "12.50", "les 5 % ne sont pas retirés du prix plein");
    assert.equal(totaux.totalHt, "237.50");
  });

  await test("il le change, puis il le retire — la colonne redevient nulle", async () => {
    const ctx = await contexte();
    const { factureId } = await factureAvecUneLigne(ctx);

    await majReductionDeFacture(ctx, factureId, "5");
    await majReductionDeFacture(ctx, factureId, "12,5");
    assert.equal(await remiseEnBase(ctx, factureId), "12.50", "la virgule n'est pas relue");

    const retrait = await majReductionDeFacture(ctx, factureId, null);
    assert.ok(retrait.ok);
    assert.equal(await remiseEnBase(ctx, factureId), null, "la remise retirée dort encore en base");
  });

  await test("« 0 », une case vide ou un charabia EFFACENT la remise", async () => {
    // Un « 0 % » gardé ferait imprimer au client une ligne dorée sans montant :
    // c'est le défaut que le patron a signalé sur le devis le 17 août 2026.
    for (const saisi of ["0", "0,00", "", "  ", "beaucoup"]) {
      const ctx = await contexte();
      const { factureId } = await factureAvecUneLigne(ctx);
      await majReductionDeFacture(ctx, factureId, "5");
      const r = await majReductionDeFacture(ctx, factureId, saisi);
      assert.ok(r.ok, `« ${saisi} » a été refusé au lieu d'effacer`);
      assert.equal(
        await remiseEnBase(ctx, factureId),
        null,
        `« ${saisi} » laisse une remise en base`
      );
    }
  });

  await test("une facture ARRÊTÉE ne se remise plus", async () => {
    const ctx = await contexte();
    const { factureId } = await factureAvecUneLigne(ctx);
    await emettreFacture(ctx, factureId);

    const r = await majReductionDeFacture(ctx, factureId, "5");
    assert.equal(r.ok, false, "on a pu remiser une facture déjà partie chez le client");
    assert.match(
      (r as { raison: string }).raison,
      /arrêtée/,
      "le refus ne dit pas POURQUOI : il enverrait chercher ailleurs"
    );
    assert.equal(await remiseEnBase(ctx, factureId), null);
  });

  await test("une facture d'une AUTRE entreprise n'existe pas", async () => {
    const moi = await contexte();
    const voisin = await contexte();
    const { factureId } = await factureAvecUneLigne(voisin);

    const r = await majReductionDeFacture(moi, factureId, "5");
    assert.equal(r.ok, false, "la remise a traversé la cloison entre deux entreprises");
    assert.equal(await remiseEnBase(voisin, factureId), null);
  });
}

main()
  .catch((e) => {
    console.error(e);
    failed++;
  })
  .finally(async () => {
    await pool.end();
    console.log(
      `\n${failed === 0 ? "✅" : "❌"} Le prix accordé au client sur une facture — ${passed} réussi(s), ${failed} échec(s).`
    );
    process.exit(failed === 0 ? 0 : 1);
  });
