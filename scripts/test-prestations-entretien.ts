import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import {
  listerPrestations,
  ajouterPrestation,
  retirerPrestation,
  renommerPrestation,
  renommerFamille,
  poserModeleFourni,
} from "../src/server/repositories/prestations-entretien";
import {
  MODELE_FOURNI,
  MAX_PRESTATIONS,
  libelleNettoye,
  memeLibelle,
  parFamilles,
} from "../src/lib/prestations-entretien";

// Le modèle de fiche d'entretien.
//
// **Sa demande du 16 août 2026**, et sa décision sur le rangement : « il n'y
// aura qu'une seule fiche ». Ce qui est éprouvé ici :
//
//   1. **l'isolation** — c'est la seule chose dont un défaut ne se voit pas à
//      l'écran, et qui montrerait à un artisan les prestations d'un autre ;
//   2. les refus se RENDENT, ils ne lèvent pas : une exception d'action serveur
//      n'arrive jamais jusqu'au patron ;
//   3. le modèle fourni ne se pose qu'une fois ;
//   4. le modèle du code et celui des maquettes ne divergent pas — l'écart se
//      verrait précisément là où il compare ce qu'on lui a montré et ce qu'il
//      obtient.

let echecs = 0;
async function cas(nom: string, verifier: () => Promise<void> | void) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${e instanceof Error ? e.message : e}`);
  }
}

async function contexte(suffixe: string) {
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: `Atelier ${suffixe}` },
    { email: `fiche-${suffixe}-${Date.now()}@atlas.test` }
  );
  return { utilisateurId, entrepriseId: entreprise.id };
}

async function main() {
  console.log("=== Le modèle de fiche d'entretien ===");

  await cas("la RLS est bien armée sur la table, pas seulement le filtre du code", async () => {
    // **Sans ce cas, l'isolation ci-dessus ne prouverait pas ce qu'elle promet.**
    // Les fonctions filtrent déjà sur `entreprise_id` ; elles passeraient donc
    // au vert même si la migration avait oublié la politique. Or c'est la RLS
    // qui protège d'une requête écrite de travers demain.
    const { rows } = await pool.query(
      `select c.relrowsecurity, c.relforcerowsecurity,
              (select count(*) from pg_policies p
                where p.tablename = 'prestations_entretien') as politiques
         from pg_class c where c.relname = 'prestations_entretien'`
    );
    assert.equal(rows[0]?.relrowsecurity, true, "ROW LEVEL SECURITY n'est pas activée");
    assert.equal(rows[0]?.relforcerowsecurity, true, "FORCE ROW LEVEL SECURITY n'est pas posée");
    assert.ok(Number(rows[0]?.politiques) >= 1, "aucune politique d'isolation sur la table");
  });

  await cas("les règles pures : nettoyage, doublons indulgents, familles", () => {
    assert.equal(libelleNettoye("  Tonte   et  ébarbage "), "Tonte et ébarbage");
    assert.equal(libelleNettoye("   "), null);
    assert.equal(libelleNettoye(null), null);
    // Deux textes tapés à la main, à deux moments : la même prestation.
    assert.equal(memeLibelle("Tonte et ébarbage", "tonte et ebarbage"), true);
    assert.equal(memeLibelle("Propreté", "PROPRETE"), true);
    assert.equal(memeLibelle("Tonte", "Taille"), false);
    // L'ordre des familles vient des lignes, jamais de l'alphabet : il range ses
    // gestes dans l'ordre où il les fait.
    const groupes = parFamilles([
      { famille: "Pelouse", libelle: "Tonte" },
      { famille: "Propreté", libelle: "Feuilles" },
      { famille: "pelouse", libelle: "Engrais" },
    ]);
    assert.deepEqual(
      groupes.map((g) => g.famille),
      ["Pelouse", "Propreté"]
    );
    assert.equal(groupes[0].lignes.length, 2, "la casse a coupé la famille en deux");
  });

  await cas("le modèle du code et celui des maquettes disent la même chose", () => {
    // **Le témoin qui empêche la dérive.** Les planches lui ont montré vingt
    // prestations ; l'application doit poser les mêmes. Sans ce cas, l'une des
    // deux pourrait être retouchée seule, et l'écart se verrait à l'endroit
    // exact où il compare.
    const planche = readFileSync("docs/maquettes/62-la-fiche-dentretien.html", "utf8");
    const surLaPlanche = [...planche.matchAll(/<span class="mot">([^<]+)<\/span>/g)].map(
      (m) => m[1]
    );
    assert.ok(surLaPlanche.length > 0, "la planche ne porte plus de prestations lisibles");
    for (const p of MODELE_FOURNI) {
      assert.ok(
        surLaPlanche.some((m) => memeLibelle(m, p.libelle)),
        `« ${p.libelle} » est dans le code mais absente de la maquette`
      );
    }
    const uniques = new Set(surLaPlanche.map((m) => m.toLowerCase()));
    assert.equal(
      uniques.size,
      MODELE_FOURNI.length,
      `la maquette porte ${uniques.size} prestations, le code ${MODELE_FOURNI.length}`
    );
  });

  const ctx = await contexte("a");

  await cas("une fiche neuve est VIDE, et le modèle ne se pose pas tout seul", async () => {
    // Semer vingt lignes parce que quelqu'un a ouvert un écran serait écrire en
    // base pour un regard — y compris chez qui ne fait pas d'entretien.
    assert.deepEqual(await listerPrestations(ctx), []);
  });

  await cas("le modèle fourni se pose, et une seule fois", async () => {
    const pose = await poserModeleFourni(ctx);
    assert.deepEqual(pose, { ok: true, posees: MODELE_FOURNI.length });
    const lignes = await listerPrestations(ctx);
    assert.equal(lignes.length, MODELE_FOURNI.length);
    assert.equal(lignes[0].libelle, MODELE_FOURNI[0].libelle, "l'ordre du modèle n'est pas tenu");

    // Un second appui doublerait la fiche, et il ne saurait plus laquelle des
    // deux « Tonte » il vient de cocher.
    const encore = await poserModeleFourni(ctx);
    assert.deepEqual(encore, { ok: false, refus: "fiche_non_vide" });
    assert.equal((await listerPrestations(ctx)).length, MODELE_FOURNI.length);
  });

  await cas("ajouter : la ligne se range dans SA famille, pas au bas de la fiche", async () => {
    const ajout = await ajouterPrestation(ctx, { famille: "Pelouse", libelle: "Aération" });
    assert.equal(ajout.ok, true);
    const groupes = parFamilles(await listerPrestations(ctx));
    const pelouse = groupes.find((g) => g.famille === "Pelouse");
    assert.ok(pelouse, "la famille Pelouse a disparu");
    assert.ok(
      pelouse.lignes.some((l) => l.libelle === "Aération"),
      "la ligne ajoutée n'est pas dans sa famille"
    );
    // Et les familles suivantes n'ont pas bougé de place.
    assert.deepEqual(
      groupes.map((g) => g.famille),
      ["Pelouse", "Tailles", "Massifs", "Propreté"]
    );
  });

  await cas("les refus se RENDENT, ils ne lèvent pas", async () => {
    // Une exception d'action serveur n'arrive jamais jusqu'au patron : Next.js
    // la remplace par un identifiant opaque (`HANDOVER.md`, piège 0 ter).
    assert.deepEqual(await ajouterPrestation(ctx, { famille: "Pelouse", libelle: "   " }), {
      ok: false,
      refus: "libelle_vide",
    });
    assert.deepEqual(await ajouterPrestation(ctx, { famille: " ", libelle: "Quelque chose" }), {
      ok: false,
      refus: "famille_vide",
    });
    // Le doublon est refusé même écrit autrement — deux cases pour un geste
    // donneraient une ligne en double sur le rapport du client.
    assert.deepEqual(
      await ajouterPrestation(ctx, { famille: "Massifs", libelle: "tonte et EBARBAGE" }),
      { ok: false, refus: "doublon" }
    );
    assert.deepEqual(await retirerPrestation(ctx, "00000000-0000-0000-0000-000000000000"), {
      ok: false,
      refus: "introuvable",
    });
  });

  await cas("renommer une prestation, et une famille entière", async () => {
    const [premiere] = await listerPrestations(ctx);
    assert.deepEqual(await renommerPrestation(ctx, premiere.id, "Tonte, ébarbage et finitions"), {
      ok: true,
    });
    const relue = (await listerPrestations(ctx)).find((p) => p.id === premiere.id);
    assert.equal(relue?.libelle, "Tonte, ébarbage et finitions");

    // La casse ne doit pas couper la famille en deux : l'écran renvoie le nom
    // tel qu'il l'affiche.
    const renommee = await renommerFamille(ctx, "pelouse", "Gazon");
    assert.equal(renommee.ok, true);
    const familles = parFamilles(await listerPrestations(ctx)).map((g) => g.famille);
    assert.ok(familles.includes("Gazon"), `familles après renommage : ${familles.join(", ")}`);
    assert.ok(!familles.includes("Pelouse"), "une moitié de la famille est restée en arrière");
  });

  await cas("retirer une prestation la retire pour de bon", async () => {
    const avant = await listerPrestations(ctx);
    const cible = avant.find((p) => p.libelle === "Aération");
    assert.ok(cible);
    assert.deepEqual(await retirerPrestation(ctx, cible.id), { ok: true });
    const apres = await listerPrestations(ctx);
    assert.equal(apres.length, avant.length - 1);
    assert.ok(!apres.some((p) => p.id === cible.id));
  });

  await cas("ISOLATION : B ne voit ni ne touche la fiche de A", async () => {
    // **Le seul défaut qui ne se verrait pas à l'écran** — et qui montrerait à
    // un artisan les prestations d'un autre.
    const ctxB = await contexte("b");
    assert.deepEqual(await listerPrestations(ctxB), [], "B voit la fiche de A");

    const deA = await listerPrestations(ctx);
    assert.ok(deA.length > 0, "le décor est faux : A n'a aucune prestation");

    // Viser une ligne de A par son identifiant, depuis B, ne doit RIEN faire.
    assert.deepEqual(await retirerPrestation(ctxB, deA[0].id), {
      ok: false,
      refus: "introuvable",
    });
    assert.deepEqual(await renommerPrestation(ctxB, deA[0].id, "Volé"), {
      ok: false,
      refus: "introuvable",
    });
    // Et la ligne de A est intacte.
    const relueA = (await listerPrestations(ctx)).find((p) => p.id === deA[0].id);
    assert.equal(relueA?.libelle, deA[0].libelle, "B a modifié une prestation de A");

    // B pose son propre modèle sans que celui de A bouge.
    assert.equal((await poserModeleFourni(ctxB)).ok, true);
    assert.equal((await listerPrestations(ctx)).length, deA.length, "poser chez B a touché A");
  });

  await cas("la fiche a une borne, et le refus le DIT", async () => {
    const ctxC = await contexte("c");
    for (let i = 0; i < MAX_PRESTATIONS; i++) {
      const r = await ajouterPrestation(ctxC, { famille: "Divers", libelle: `Geste ${i}` });
      assert.equal(r.ok, true, `refus inattendu à la ${i + 1}ᵉ ligne`);
    }
    assert.deepEqual(await ajouterPrestation(ctxC, { famille: "Divers", libelle: "Une de trop" }), {
      ok: false,
      refus: "trop_de_prestations",
    });
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Fiche d'entretien — ${echecs} échec(s).`);
  await pool.end();
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
