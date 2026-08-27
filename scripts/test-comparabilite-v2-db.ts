import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as prestationsRepo from "../src/server/repositories/prestations";
import { ajouterLignePrix, lierPrestationsALaLigne } from "../src/server/repositories/lignes-prix";
import { retenirLecon, leconsComparables } from "../src/server/repositories/lecons-prix";
import { nettoyerBase } from "./_test-db";

// **« 15 chantiers comparables » — et ils ne l'étaient pas.**
//
// La clé V1 comparait trois jetons — nature, technique, tranche de diamètre —
// par égalité de chaîne en SQL. **50 ml et 800 ml de haie y avaient la même
// clé** : le rappel présentait le prix de l'une comme l'expérience de l'autre.
//
// Ce que la suite pure (`test-dictee-devis-identite.ts`) tient : la règle. Ce
// que CELLE-CI tient, et qu'aucune fonction pure ne peut tenir : **que le
// chemin complet l'emprunte** — l'écriture de la leçon depuis une vraie ligne
// de devis, la clé V2 réellement stockée à côté de la V1, et la relecture qui
// retrouve les leçons d'avant sans les réécrire.

let reussites = 0;
let echecs = 0;
async function test(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${nom}`);
    reussites++;
  } catch (err) {
    console.error(`❌ ${nom}\n   ${err instanceof Error ? err.message : err}`);
    echecs++;
  }
}

type Ctx = { entrepriseId: string; utilisateurId: string };

/**
 * Une ligne de devis, avec la prestation structurée qu'elle vend.
 *
 * **`montant` absent = la ligne qui INTERROGE la mémoire.** Elle n'est pas
 * retenue comme leçon : sans cette précaution, elle se rappellerait elle-même
 * et chaque contrôle passerait pour la mauvaise raison — c'est exactement ce
 * qu'a fait la première version de ce fichier.
 */
async function ligneVendue(
  ctx: Ctx,
  nomChantier: string,
  prestation: { libelle: string; nature: string; espece?: string; quantite?: string; unite?: string },
  montant?: string
) {
  const chantier = await chantiersRepo.creerChantier(ctx, { nom: nomChantier });
  const p = await prestationsRepo.ajouterPrestation(ctx, chantier.id, prestation.libelle, {
    nature: prestation.nature,
    espece: prestation.espece ?? null,
    quantite: prestation.quantite ?? null,
    unite: prestation.unite ?? null,
  });
  const ligne = await ajouterLignePrix(ctx, chantier.id, prestation.libelle, montant ?? "0");
  await lierPrestationsALaLigne(ctx, ligne.id, [p.id]);
  if (montant) await retenirLecon(ctx, ligne.id);
  return { chantier, ligne };
}

async function main() {
  await nettoyerBase();
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: "Comparabilité" },
    { email: "comparabilite@test.local", nom: "Le patron" }
  );
  const A: Ctx = { entrepriseId: entreprise.id, utilisateurId };

  console.log("\n=== L'ordre de grandeur sépare deux chantiers ===\n");

  await test("800 ml de haie ne rappellent pas le prix de 50 ml", async () => {
    await ligneVendue(
      A,
      "Petite haie",
      { libelle: "Taille de haie", nature: "haie", espece: "laurier", quantite: "50.00", unite: "ml" },
      "350.00"
    );
    const { ligne } = await ligneVendue(
      A,
      "Grande haie",
      { libelle: "Taille de haie", nature: "haie", espece: "laurier", quantite: "800.00", unite: "ml" }
    );
    const vues = await leconsComparables(A, { libelle: "Taille de haie", id: ligne.id });
    assert.equal(
      vues.length,
      0,
      `${vues.length} rappel(s) : le prix d'une haie de 50 ml est présenté comme l'expérience d'une de 800`
    );
  });

  await test("50 et 55 ml, eux, se rappellent bien", async () => {
    // L'autre sens, et il compte autant : rendre toutes les haies incomparables
    // passerait le contrôle précédent et détruirait sa mémoire.
    const { ligne } = await ligneVendue(
      A,
      "Haie voisine",
      { libelle: "Taille de haie", nature: "haie", espece: "laurier", quantite: "55.00", unite: "ml" }
    );
    const vues = await leconsComparables(A, { libelle: "Taille de haie", id: ligne.id });
    assert.ok(vues.length >= 1, "deux haies de 50 et 55 ml ne se rapprochent plus : la mémoire ne sert plus à rien");
    assert.ok(
      vues.some((v) => Number(v.prix) === 350),
      `les 350 € de la haie de 50 ml n'ont pas été rappelés : ${vues.map((v) => v.prix).join(", ")}`
    );
  });

  console.log("\n=== L'espèce écarte, quand les DEUX côtés la connaissent ===\n");

  await test("un buis ne rappelle pas le prix d'un laurier", async () => {
    await ligneVendue(
      A,
      "Haie de buis",
      { libelle: "Taille de haie", nature: "haie", espece: "buis", quantite: "60.00", unite: "ml" },
      "900.00"
    );
    const { ligne } = await ligneVendue(
      A,
      "Haie de laurier à chiffrer",
      { libelle: "Taille de haie", nature: "haie", espece: "laurier", quantite: "52.00", unite: "ml" }
    );
    const vues = await leconsComparables(A, { libelle: "Taille de haie", id: ligne.id });
    assert.ok(
      !vues.some((v) => Number(v.prix) === 900),
      "le prix d'un buis a été rappelé sur un laurier"
    );
  });

  console.log("\n=== Les leçons d'AVANT restent lisibles ===\n");

  await test("une leçon sans clé V2 se retrouve par son libellé", async () => {
    // Exactement la forme d'une leçon d'avant le 27 août 2026 : une ligne sans
    // prestation liée, donc sans colonnes — son libellé est tout ce qu'elle a.
    const ancien = await chantiersRepo.creerChantier(A, { nom: "Chêne d'avant" });
    const ligneAncienne = await ajouterLignePrix(
      A,
      ancien.id,
      "Abattage d'un chêne — démontage avec rétention, ⌀ 70 cm",
      "1400.00"
    );
    await retenirLecon(A, ligneAncienne.id);

    const neuf = await chantiersRepo.creerChantier(A, { nom: "Chêne d'aujourd'hui" });
    const ligneNeuve = await ajouterLignePrix(
      A,
      neuf.id,
      "Abattage d'un chêne — démontage avec rétention, ⌀ 70 cm",
      "0"
    );
    const vues = await leconsComparables(A, { libelle: ligneNeuve.libelle, id: ligneNeuve.id }, {
      chantierExclu: neuf.id,
    });
    assert.ok(
      vues.some((v) => Number(v.prix) === 1400),
      `la mémoire d'avant est devenue introuvable : ${vues.map((v) => v.prix).join(", ") || "aucun rappel"}`
    );
  });

  await test("une espèce inconnue n'écarte pas une leçon d'avant", async () => {
    // Le bord qui aurait effacé sa mémoire : toutes les leçons d'avant ont
    // l'espèce à NULL. La traiter comme « différente de laurier » les rendrait
    // toutes introuvables du jour au lendemain.
    const ancien = await chantiersRepo.creerChantier(A, { nom: "Haie d'avant" });
    const ligneAncienne = await ajouterLignePrix(A, ancien.id, "Taille de haie (70 ml)", "1200.00");
    await retenirLecon(A, ligneAncienne.id);

    const { ligne } = await ligneVendue(
      A,
      "Haie d'aujourd'hui",
      { libelle: "Taille de haie", nature: "haie", espece: "laurier", quantite: "75.00", unite: "ml" }
    );
    const vues = await leconsComparables(A, { libelle: "Taille de haie", id: ligne.id });
    assert.ok(
      vues.some((v) => Number(v.prix) === 1200),
      `la leçon d'avant a été écartée : ${vues.map((v) => v.prix).join(", ") || "aucun rappel"}`
    );
  });

  console.log("\n=== La V1 n'est jamais réécrite ===\n");

  await test("la clé V1 reste exactement celle d'hier, et la V2 vit à côté", async () => {
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Deux clés" });
    const ligne = await ajouterLignePrix(
      A,
      chantier.id,
      "Abattage d'un chêne mort — démontage avec rétention, ⌀ 70 cm",
      "1500.00"
    );
    await retenirLecon(A, ligne.id);

    // Lecture directe, sous le contexte d'isolation : sans lui, la RLS rend
    // zéro ligne et le contrôle accuserait le produit (piège du 27 août).
    const client = await pool.connect();
    try {
      await client.query("SELECT set_config('app.entreprise_id', $1, false)", [A.entrepriseId]);
      const { rows } = await client.query(
        "SELECT signature, signature_v2 FROM lecons_prix WHERE ligne_prix_id = $1",
        [ligne.id]
      );
      assert.equal(rows.length, 1, "la leçon n'a pas été écrite");
      assert.equal(
        rows[0].signature,
        "abattage|retention|d70",
        "la clé V1 a changé : les leçons déjà enregistrées sous l'ancienne ne se retrouveront plus"
      );
      assert.ok(String(rows[0].signature_v2).startsWith("v2|abattage|"), `clé V2 : ${rows[0].signature_v2}`);
    } finally {
      client.release();
    }
  });

  console.log("\n=== Une tonte, que la V1 ne savait pas nommer, se retient quand même ===\n");

  await test("le prix d'une tonte devient une leçon", async () => {
    // Aucun vocabulaire V1 ne connaissait la tonte : son prix ne se retenait
    // nulle part. La V2 la nomme, et sa mémoire s'en souvient.
    await ligneVendue(
      A,
      "Pelouse de juin",
      { libelle: "Tonte de la pelouse", nature: "tonte", quantite: "1200.00", unite: "m²" },
      "200.00"
    );
    const { ligne } = await ligneVendue(
      A,
      "Pelouse de juillet",
      { libelle: "Tonte de la pelouse", nature: "tonte", quantite: "1100.00", unite: "m²" }
    );
    const vues = await leconsComparables(A, { libelle: "Tonte de la pelouse", id: ligne.id });
    assert.ok(
      vues.some((v) => Number(v.prix) === 200),
      `la tonte n'a rien retenu : ${vues.map((v) => v.prix).join(", ") || "aucun rappel"}`
    );
  });

  console.log(`\n${reussites} réussite(s), ${echecs} échec(s).`);
  if (echecs > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
