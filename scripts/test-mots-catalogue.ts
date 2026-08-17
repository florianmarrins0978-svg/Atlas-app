import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import {
  ajouterMot,
  creerEntree,
  listerCartes,
  rechercherCartes,
  retirerMot,
} from "../src/server/repositories/mots-catalogue";
import { creerPrestationCatalogue } from "../src/server/repositories/catalogue-prestations";
import { creerMaterielCatalogue } from "../src/server/repositories/catalogue-materiels";
import {
  MAX_MOTS_PAR_ENTREE,
  carteCorrespond,
  fusionnerCatalogue,
  memeMot,
  motNettoye,
  refusDuMot,
} from "../src/lib/mots-catalogue";

// Ses mots à lui, par-dessus le vocabulaire commun (migration 0052).
//
// **Sa question du 17 août 2026**, posée pour la seconde fois sur le même
// écran : *« À quoi sert cette page ?? On peut rien modifier rajouter »*.
// Arrangement B de la planche 69.
//
// Ce qui est éprouvé ici, et pourquoi chaque cas existe :
//
//   1. **l'isolation** — c'est le seul défaut qui ne se verrait pas à l'écran,
//      et qui montrerait à un artisan le vocabulaire d'un autre ;
//   2. **le catalogue commun reste intact** : ajouter un mot ne doit RIEN
//      écrire dans `catalogue_prestations`, qui appartient à tout le monde ;
//   3. **un mot ajouté est un mot RECONNU** — visible à l'écran et muet à la
//      dictée serait le pire des deux mondes, et personne ne le verrait ;
//   4. les refus se RENDENT, ils ne lèvent pas : le message d'une exception
//      d'action serveur n'arrive jamais jusqu'au patron ;
//   5. retirer un de ses mots ne touche pas au commun.

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
    { email: `mots-${suffixe}-${Date.now()}@atlas.test` }
  );
  return { utilisateurId, entrepriseId: entreprise.id };
}

async function main() {
  console.log("=== Ses mots au catalogue ===");

  // Une entrée commune bien à nous : le catalogue est partagé, et une suite qui
  // s'appuierait sur « Élagage » dépendrait du semis d'une autre.
  const commune = await creerPrestationCatalogue({
    nomCanonique: `Élagage suite ${Date.now()}`,
    variantes: ["sapin"],
    synonymes: ["abattage"],
  });
  const materielCommun = await creerMaterielCatalogue({
    nomCanonique: `Nacelle suite ${Date.now()}`,
    variantes: ["plateforme élévatrice"],
  });

  await cas("la RLS est bien armée sur la table, pas seulement le filtre du code", async () => {
    // Sans ce cas, l'isolation éprouvée plus bas ne prouverait rien : les
    // fonctions filtrent déjà sur `entreprise_id` et passeraient au vert même
    // si la migration avait oublié la politique.
    const { rows } = await pool.query(
      `select c.relrowsecurity, c.relforcerowsecurity,
              (select count(*) from pg_policies p where p.tablename = 'mots_catalogue') as politiques
         from pg_class c where c.relname = 'mots_catalogue'`
    );
    assert.equal(rows[0]?.relrowsecurity, true, "ROW LEVEL SECURITY n'est pas activée");
    assert.equal(rows[0]?.relforcerowsecurity, true, "FORCE ROW LEVEL SECURITY n'est pas posée");
    assert.ok(Number(rows[0]?.politiques) >= 1, "aucune politique d'isolation sur la table");
  });

  await cas("les règles pures : nettoyage, doublons indulgents, superposition", () => {
    assert.equal(motNettoye("  écime  moi "), "écime moi");
    assert.equal(motNettoye("   "), null);
    assert.equal(memeMot("Écimage", "ecimage"), true);
    assert.equal(memeMot("écimage", "étêtage"), false);

    const cartes = fusionnerCatalogue({
      communes: [{ id: "c1", nomCanonique: "Élagage", mots: ["sapin"] }],
      miens: [
        { id: "m1", mot: "écime", referenceId: "c1", parentId: null },
        { id: "m2", mot: "Rogneuse", referenceId: null, parentId: null },
        { id: "m3", mot: "rogne", referenceId: null, parentId: "m2" },
      ],
    });
    assert.equal(cartes.length, 2, "une carte commune et une à lui");
    assert.deepEqual(cartes[0].mesMots.map((m) => m.mot), ["écime"]);
    assert.equal(cartes[0].aMoi, false);
    assert.equal(cartes[1].nom, "Rogneuse");
    assert.equal(cartes[1].aMoi, true);
    assert.deepEqual(cartes[1].mesMots.map((m) => m.mot), ["rogne"]);

    // **Le cas qui porte toute la promesse de l'arrangement B.** Le mot posé
    // doit se retrouver dans la phrase dictée, telle qu'il la dit.
    assert.equal(carteCorrespond(cartes[0], "faut m'écimer le tilleul du fond"), true);
    assert.equal(carteCorrespond(cartes[0], "refaire la terrasse"), false);
  });

  await cas("un mot qu'Atlas connaît déjà est refusé, et le refus le DIT", () => {
    assert.equal(
      refusDuMot({
        mot: "Abattage",
        motsDuCommun: ["Élagage", "abattage"],
        mesMotsDeLaFamille: [],
        dejaSurCetteEntree: 0,
      }),
      "deja_chez_atlas"
    );
    assert.equal(
      refusDuMot({ mot: "  ", motsDuCommun: [], mesMotsDeLaFamille: [], dejaSurCetteEntree: 0 }),
      "vide"
    );
    assert.equal(
      refusDuMot({ mot: "écime", motsDuCommun: [], mesMotsDeLaFamille: ["Écime"], dejaSurCetteEntree: 0 }),
      "deja_chez_moi"
    );
  });

  const ctxA = await contexte("a");
  const ctxB = await contexte("b");

  await cas("un mot posé s'accroche à l'entrée d'Atlas, et se relit", async () => {
    const pose = await ajouterMot(ctxA, { famille: "prestation", entreeId: commune.id, mot: "écime" });
    assert.equal(pose.ok, true, "le mot a été refusé");

    const cartes = await listerCartes(ctxA, "prestation");
    const carte = cartes.find((c) => c.id === commune.id);
    assert.ok(carte, "l'entrée d'Atlas a disparu de l'écran");
    assert.deepEqual(carte.mesMots.map((m) => m.mot), ["écime"]);
    assert.equal(carte.aMoi, false, "l'entrée reste celle d'Atlas");
    assert.ok(carte.motsCommuns.includes("sapin"), "les mots d'Atlas ont été perdus");
  });

  await cas("le catalogue PARTAGÉ n'a pas bougé d'un mot", async () => {
    // C'est la raison d'être de la table : une ligne écrite depuis son
    // téléphone changerait le vocabulaire de tous les autres artisans.
    const { rows } = await pool.query(
      `select variantes, synonymes from catalogue_prestations where id = $1`,
      [commune.id]
    );
    assert.deepEqual(rows[0]?.variantes, ["sapin"]);
    assert.deepEqual(rows[0]?.synonymes, ["abattage"]);
  });

  await cas("une entreprise ne voit jamais les mots d'une autre", async () => {
    const cartesB = await listerCartes(ctxB, "prestation");
    const chezB = cartesB.find((c) => c.id === commune.id);
    assert.ok(chezB, "l'entrée commune manque chez B");
    assert.deepEqual(chezB.mesMots, [], "B voit les mots de A");
  });

  await cas("un mot ajouté est un mot RECONNU par la recherche", async () => {
    // Sans ce cas, l'écran pourrait afficher ses mots pendant que la dictée les
    // ignore : il croirait avoir appris quelque chose à Atlas, sans qu'aucun
    // message ne le détrompe.
    const trouvees = await rechercherCartes(ctxA, "prestation", "faut m'écimer le tilleul");
    assert.ok(
      trouvees.some((c) => c.id === commune.id),
      "le mot ajouté par l'entreprise n'est pas reconnu par la recherche"
    );

    const chezB = await rechercherCartes(ctxB, "prestation", "faut m'écimer le tilleul");
    assert.equal(
      chezB.some((c) => c.id === commune.id),
      false,
      "le mot de A fait reconnaître la demande chez B"
    );

    // Et le vocabulaire commun continue de fonctionner pour tout le monde.
    const parSapin = await rechercherCartes(ctxB, "prestation", "un sapin à démonter");
    assert.ok(parSapin.some((c) => c.id === commune.id), "« sapin » ne trouve plus l'entrée d'Atlas");
  });

  await cas("une entrée à lui existe, porte ses mots, et reste à lui", async () => {
    const creee = await creerEntree(ctxA, { famille: "materiel", nom: "Rogneuse" });
    assert.equal(creee.ok, true);
    if (!creee.ok) return;

    const pose = await ajouterMot(ctxA, { famille: "materiel", entreeId: creee.mot.id, mot: "rogne" });
    assert.equal(pose.ok, true);

    const cartes = await listerCartes(ctxA, "materiel");
    const sienne = cartes.find((c) => c.id === creee.mot.id);
    assert.ok(sienne, "son entrée a disparu");
    assert.equal(sienne.aMoi, true);
    assert.deepEqual(sienne.mesMots.map((m) => m.mot), ["rogne"]);

    // Elle n'entre PAS dans le catalogue partagé.
    const { rows } = await pool.query(`select count(*)::int as n from catalogue_materiels where nom_canonique = 'Rogneuse'`);
    assert.equal(rows[0]?.n, 0, "son entrée a été écrite dans le catalogue partagé");

    // Et B, qui cherche le même mot, ne trouve que ce qu'Atlas connaît.
    const chezB = await rechercherCartes(ctxB, "materiel", "la rogneuse");
    assert.equal(chezB.some((c) => c.id === creee.mot.id), false, "B voit l'entrée de A");
    assert.ok(materielCommun, "le matériel commun de la suite manque");
  });

  await cas("les refus se RENDENT, ils ne lèvent pas", async () => {
    const dejaChezAtlas = await ajouterMot(ctxA, { famille: "prestation", entreeId: commune.id, mot: "sapin" });
    assert.deepEqual(dejaChezAtlas, { ok: false, refus: "deja_chez_atlas" });

    const dejaChezMoi = await ajouterMot(ctxA, { famille: "prestation", entreeId: commune.id, mot: "Écime" });
    assert.deepEqual(dejaChezMoi, { ok: false, refus: "deja_chez_moi" });

    const introuvable = await ajouterMot(ctxA, {
      famille: "prestation",
      entreeId: "00000000-0000-0000-0000-000000000000",
      mot: "peu importe",
    });
    assert.deepEqual(introuvable, { ok: false, refus: "introuvable" });
  });

  await cas("une entrée a une borne de mots, et le refus le dit", async () => {
    const ctxC = await contexte("c");
    for (let i = 0; i < MAX_MOTS_PAR_ENTREE; i++) {
      const r = await ajouterMot(ctxC, { famille: "prestation", entreeId: commune.id, mot: `motdetest${i}` });
      assert.equal(r.ok, true, `refus inattendu au ${i + 1}ᵉ mot`);
    }
    assert.deepEqual(
      await ajouterMot(ctxC, { famille: "prestation", entreeId: commune.id, mot: "un de trop" }),
      { ok: false, refus: "trop_de_mots" }
    );
  });

  await cas("retirer un de ses mots ne touche pas au vocabulaire commun", async () => {
    const cartes = await listerCartes(ctxA, "prestation");
    const carte = cartes.find((c) => c.id === commune.id);
    assert.ok(carte);
    const sien = carte.mesMots[0];
    assert.ok(sien, "aucun mot à retirer");

    assert.deepEqual(await retirerMot(ctxA, sien.id), { retire: true });

    const apres = (await listerCartes(ctxA, "prestation")).find((c) => c.id === commune.id);
    assert.ok(apres);
    assert.equal(apres.mesMots.some((m) => m.id === sien.id), false, "le mot est toujours là");
    assert.ok(apres.motsCommuns.includes("sapin"), "le vocabulaire d'Atlas a été touché");
  });

  await cas("une entreprise ne peut pas retirer le mot d'une autre", async () => {
    const pose = await ajouterMot(ctxB, { famille: "prestation", entreeId: commune.id, mot: "motdeb" });
    assert.equal(pose.ok, true);
    if (!pose.ok) return;

    assert.deepEqual(await retirerMot(ctxA, pose.mot.id), { retire: false }, "A a effacé le mot de B");

    const chezB = (await listerCartes(ctxB, "prestation")).find((c) => c.id === commune.id);
    assert.ok(chezB?.mesMots.some((m) => m.id === pose.mot.id), "le mot de B a disparu");
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Ses mots au catalogue — ${echecs} échec(s).`);
  await pool.end();
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
