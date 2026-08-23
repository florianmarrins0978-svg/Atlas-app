import assert from "node:assert";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import { getPlanificationEtat, trierParDatePlanifiee } from "../src/lib/chantier-etat";
import { nettoyerBase } from "./_test-db";
import { NOTE_MAX } from "../src/lib/note-chantier";

/** Rend un chantier visible au planning, comme le fait un envoi de devis. */
async function marquerDevisEnvoye(chantierId: string, entrepriseId: string) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query(`SELECT set_config('app.entreprise_id', $1, true)`, [entrepriseId]);
    await c.query(`UPDATE chantiers SET devis_envoye_at = now() WHERE id = $1`, [chantierId]);
    await c.query("COMMIT");
  } finally {
    c.release();
  }
}

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
    failed++;
  }
}

async function main() {
  await nettoyerBase();

  const { entreprise: entA, utilisateurId: userA } = await entreprisesRepo.creerEntreprise(
    { nom: "Entreprise Planning A" },
    { email: "planning-a@test.local", nom: "A" }
  );
  const A = { entrepriseId: entA.id, utilisateurId: userA };
  const { entreprise: entB, utilisateurId: userB } = await entreprisesRepo.creerEntreprise(
    { nom: "Entreprise Planning B" },
    { email: "planning-b@test.local", nom: "B" }
  );
  const B = { entrepriseId: entB.id, utilisateurId: userB };

  // Chantier sans devis envoyé : ne doit jamais apparaître dans le planning.
  await chantiersRepo.creerChantier(A, { nom: "Chantier brouillon" });

  // Deux chantiers éligibles (devis envoyé simulé directement en base).
  const c1 = await chantiersRepo.creerChantier(A, { nom: "Chantier à planifier" });
  const c2 = await chantiersRepo.creerChantier(A, { nom: "Chantier à planifier 2" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT set_config('app.entreprise_id', $1, true)`, [A.entrepriseId]);
    await client.query(`UPDATE chantiers SET devis_envoye_at = now() WHERE id = ANY($1)`, [[c1.id, c2.id]]);
    await client.query("COMMIT");
  } finally {
    client.release();
  }

  await test("listerChantiersPourPlanning ne retourne que les chantiers avec devis envoyé", async () => {
    const liste = await chantiersRepo.listerChantiersPourPlanning(A);
    assert.equal(liste.length, 2);
    assert.ok(liste.every((c) => c.devisEnvoyeAt !== null));
  });

  await test("getPlanificationEtat : 'a_planifier' tant qu'aucune date n'est fixée", async () => {
    const liste = await chantiersRepo.listerChantiersPourPlanning(A);
    for (const c of liste) {
      assert.equal(getPlanificationEtat(c), "a_planifier");
    }
  });

  await test("Création d'une intervention (planifierChantier) : passe à 'planifie'", async () => {
    const maj = await chantiersRepo.planifierChantier(A, c1.id, "2026-09-15");
    assert.equal(maj.datePlanifiee, "2026-09-15");
    assert.equal(getPlanificationEtat(maj), "planifie");
  });

  await test("Modification d'une intervention : la date change", async () => {
    const maj = await chantiersRepo.planifierChantier(A, c1.id, "2026-09-20");
    assert.equal(maj.datePlanifiee, "2026-09-20");
  });

  await test("Persistance après relecture", async () => {
    const relu = await chantiersRepo.getChantier(A, c1.id);
    assert.equal(relu?.datePlanifiee, "2026-09-20");
  });

  await test("Tri par date de planification : chantiers sans date en dernier", async () => {
    const liste = await chantiersRepo.listerChantiersPourPlanning(A);
    const tries = trierParDatePlanifiee(liste);
    const indexC1 = tries.findIndex((c) => c.id === c1.id);
    const indexC2 = tries.findIndex((c) => c.id === c2.id);
    assert.ok(indexC1 < indexC2, "c1 (daté) doit précéder c2 (sans date)");
  });

  await test("Suppression d'une intervention (deplanifierChantier) : redevient 'a_planifier'", async () => {
    const maj = await chantiersRepo.deplanifierChantier(A, c1.id);
    assert.equal(maj.datePlanifiee, null);
    assert.equal(getPlanificationEtat(maj), "a_planifier");
  });

  // **« Y aller » se sert ici, et nulle part ailleurs.** Le patron ouvre la
  // feuille en voiture, souvent sans réseau : l'adresse et le numéro doivent
  // descendre AVEC la liste. Les oublier de ce `select` ne casserait rien de
  // visible — la feuille dirait simplement « Adresse non renseignée » sur un
  // chantier qui en a une, et il croirait la base vide.
  await test("Le planning descend l'adresse du chantier et le numéro du client", async () => {
    const client = await clientsRepo.creerClient(A, { nom: "M. Bernard", telephone: "05 56 00 00 12" });
    const c3 = await chantiersRepo.creerChantier(A, {
      nom: "Chêne — M. Bernard",
      adresseChantier: "12 chemin des Chênes, 33600 Pessac",
      clientId: client.id,
    });
    const co = await pool.connect();
    try {
      await co.query("BEGIN");
      await co.query(`SELECT set_config('app.entreprise_id', $1, true)`, [A.entrepriseId]);
      await co.query(`UPDATE chantiers SET devis_envoye_at = now() WHERE id = $1`, [c3.id]);
      await co.query("COMMIT");
    } finally {
      co.release();
    }

    const liste = await chantiersRepo.listerChantiersPourPlanning(A);
    const ligne = liste.find((c) => c.id === c3.id);
    assert.ok(ligne, "le chantier doit figurer au planning");
    assert.equal(ligne.adresseChantier, "12 chemin des Chênes, 33600 Pessac");
    assert.equal(ligne.clientTelephone, "05 56 00 00 12");
  });

  await test("Un chantier sans adresse la rend nulle, pas vide — rien ne s'invente", async () => {
    const liste = await chantiersRepo.listerChantiersPourPlanning(A);
    const ligne = liste.find((c) => c.id === c2.id);
    assert.ok(ligne);
    assert.equal(ligne.adresseChantier, null);
    assert.equal(ligne.clientTelephone, null);
  });

  await test("Isolation : B ne voit aucun chantier de A dans son planning", async () => {
    const liste = await chantiersRepo.listerChantiersPourPlanning(B);
    assert.equal(liste.length, 0);
  });

  await test("Isolation : une tentative de B sur un chantier de A n'a aucun effet", async () => {
    const resultat = await chantiersRepo.planifierChantier(B, c2.id, "2026-10-01");
    assert.equal(resultat, undefined, "RLS doit filtrer silencieusement (0 ligne affectée), pas d'exception");
    const relu = await chantiersRepo.getChantier(A, c2.id);
    assert.equal(relu?.datePlanifiee, null, "La tentative de B ne doit avoir aucun effet sur le chantier de A");
  });

  // ─── LE PENSE-BÊTE DU CHANTIER — sa demande du 23 août 2026 ─────────────
  //
  // *« Un petit encadré où l'utilisateur peut marquer quelque chose — penser à
  // prendre le broyeur, client plus disponible à partir de neuf heures. »*

  await test("la note d'un chantier s'écrit, se relit, et s'efface", async () => {
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Haie à noter" });
    await marquerDevisEnvoye(chantier.id, A.entrepriseId);

    const ecrit = await chantiersRepo.ecrireNoteChantier(A, chantier.id, "  Prendre le broyeur.  ");
    // Rognée aux deux bouts : une note qui commence par une espace se relit mal.
    assert.strictEqual(ecrit?.note, "Prendre le broyeur.");

    const relu = await chantiersRepo.listerChantiersPourPlanning(A);
    assert.strictEqual(
      relu.find((c) => c.id === chantier.id)?.note,
      "Prendre le broyeur.",
      "la note ne descend pas avec la liste du planning : la feuille l'afficherait vide"
    );

    // **Le vide EFFACE, il ne stocke pas une chaîne creuse.** Sans quoi l'écran
    // montrerait un cadre « rempli de rien », indistinguable d'une note oubliée.
    const vide = await chantiersRepo.ecrireNoteChantier(A, chantier.id, "   ");
    assert.strictEqual(vide?.note, null);
  });

  await test("une note démesurée est tronquée, jamais refusée", async () => {
    // **Tronquée plutôt que refusée**, et ce n'est pas de la complaisance : la
    // borne vit en base, et un refus lui ferait perdre ce qu'il vient d'écrire
    // au doigt — alors qu'il n'a aucun moyen de compter ses caractères.
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Haie bavarde" });
    const ecrit = await chantiersRepo.ecrireNoteChantier(A, chantier.id, "b".repeat(NOTE_MAX + 500));
    assert.strictEqual(ecrit?.note?.length, NOTE_MAX);
  });

  await test("la note d'une AUTRE entreprise reste hors de portée", async () => {
    // L'isolation vaut ici comme partout : une note porte des habitudes de
    // chantier, et parfois le code d'un portail.
    const sien = await chantiersRepo.creerChantier(A, { nom: "Chez A" });
    await chantiersRepo.ecrireNoteChantier(A, sien.id, "Le code du portail est 1234.");
    await marquerDevisEnvoye(sien.id, A.entrepriseId);

    const vole = await chantiersRepo.ecrireNoteChantier(B, sien.id, "effacé par B");
    assert.strictEqual(vole, null, "une entreprise a écrit dans la note d'une autre");

    const chezA = await chantiersRepo.listerChantiersPourPlanning(A);
    assert.strictEqual(
      chezA.find((c) => c.id === sien.id)?.note,
      "Le code du portail est 1234.",
      "la note de A a été touchée par B"
    );
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
