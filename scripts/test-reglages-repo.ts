import assert from "node:assert";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as tarifsRepo from "../src/server/repositories/tarifs";
import { nettoyerBase } from "./_test-db";
import { MESSAGE_PAR_DEFAUT } from "../src/lib/message-client";

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
    { nom: "Entreprise Tarifs A" },
    { email: "tarifs-a@test.local", nom: "A" }
  );
  const A = { entrepriseId: entA.id, utilisateurId: userA };
  const { entreprise: entB, utilisateurId: userB } = await entreprisesRepo.creerEntreprise(
    { nom: "Entreprise Tarifs B" },
    { email: "tarifs-b@test.local", nom: "B" }
  );
  const B = { entrepriseId: entB.id, utilisateurId: userB };

  await test("Lecture : aucun tarif au départ", async () => {
    const liste = await tarifsRepo.listerTarifs(A);
    assert.equal(liste.length, 0);
  });

  let tarifId: string;
  await test("Création d'un tarif", async () => {
    const t = await tarifsRepo.creerTarif(A, { intitule: "Main d'œuvre", prix: "280.00" });
    tarifId = t.id;
    assert.equal(t.intitule, "Main d'œuvre");
    assert.equal(t.prix, "280.00");
  });

  await test("Modification d'un tarif : intitulé et prix", async () => {
    const maj = await tarifsRepo.modifierTarif(A, tarifId, { intitule: "Main d'œuvre (jour)", prix: "300.00" });
    assert.equal(maj.intitule, "Main d'œuvre (jour)");
    assert.equal(maj.prix, "300.00");
  });

  await test("Persistance après relecture", async () => {
    const liste = await tarifsRepo.listerTarifs(A);
    const t = liste.find((x) => x.id === tarifId)!;
    assert.equal(t.intitule, "Main d'œuvre (jour)");
    assert.equal(t.prix, "300.00");
  });

  await test("Validation : un prix négatif est rejeté (CHECK déjà en place)", async () => {
    await assert.rejects(() => tarifsRepo.creerTarif(A, { intitule: "Invalide", prix: "-10.00" }));
  });

  await test("Validation : un prix négatif en modification est aussi rejeté", async () => {
    await assert.rejects(() => tarifsRepo.modifierTarif(A, tarifId, { prix: "-5.00" }));
    // Le tarif ne doit pas avoir été altéré par la tentative.
    const liste = await tarifsRepo.listerTarifs(A);
    assert.equal(liste.find((x) => x.id === tarifId)?.prix, "300.00");
  });

  await test("Suppression douce : disparaît de la liste", async () => {
    const t2 = await tarifsRepo.creerTarif(A, { intitule: "Temporaire", prix: "10.00" });
    await tarifsRepo.supprimerTarif(A, t2.id);
    const liste = await tarifsRepo.listerTarifs(A);
    assert.ok(!liste.some((x) => x.id === t2.id));
  });

  await test("Isolation : B ne voit pas les tarifs de A", async () => {
    const liste = await tarifsRepo.listerTarifs(B);
    assert.equal(liste.length, 0);
  });

  await test("Isolation : B ne peut pas modifier un tarif de A", async () => {
    const resultat = await tarifsRepo.modifierTarif(B, tarifId, { prix: "1.00" });
    assert.equal(resultat, undefined, "RLS doit filtrer silencieusement, pas d'exception");
    const liste = await tarifsRepo.listerTarifs(A);
    assert.equal(liste.find((x) => x.id === tarifId)?.prix, "300.00", "Le tarif de A ne doit pas être affecté");
  });

  // ─── SON MESSAGE AU CLIENT — sa décision du 23 août 2026 ─────────────────
  //
  // *« Message client A. Liens obligatoire. Et message pour tous. »*

  await test("le message s'écrit, se relit, et le lien y est obligatoire", async () => {
    const sien = "Salut [client] !\n[document]\n[lien]\nÀ bientôt, [entreprise]";
    await entreprisesRepo.mettreAJourEntreprise(A, { messageClient: sien });
    assert.strictEqual((await entreprisesRepo.getEntreprise(A))?.messageClient, sien);

    // **Le serveur REFUSE aussi, pas seulement l'écran.** Une adresse tapée à la
    // main, ou une page restée ouverte depuis une version d'avant, arriverait
    // sinon jusqu'ici — et le message partirait sans lien.
    await entreprisesRepo.mettreAJourEntreprise(A, { messageClient: "Bonjour [client], sans lien." });
    assert.strictEqual(
      (await entreprisesRepo.getEntreprise(A))?.messageClient,
      sien,
      "un message sans lien a été écrit en base"
    );
  });

  await test("vide, ou le texte d'Atlas retapé : on retombe sur celui d'Atlas", async () => {
    // **`null` suit le produit, un texte lui appartient.** Figer le message par
    // défaut dans la colonne ferait qu'une correction ultérieure de ce texte
    // n'atteindrait plus cette entreprise, et personne ne s'en apercevrait.
    await entreprisesRepo.mettreAJourEntreprise(A, { messageClient: "" });
    assert.strictEqual((await entreprisesRepo.getEntreprise(A))?.messageClient, null);

    await entreprisesRepo.mettreAJourEntreprise(A, { messageClient: MESSAGE_PAR_DEFAUT });
    assert.strictEqual(
      (await entreprisesRepo.getEntreprise(A))?.messageClient,
      null,
      "le texte d'Atlas retapé a été figé dans la colonne"
    );
  });

  await test("le message d'une AUTRE entreprise reste hors de portée", async () => {
    const sien = "Bonjour [client], voici [document] : [lien] — [entreprise]";
    await entreprisesRepo.mettreAJourEntreprise(A, { messageClient: sien });
    await entreprisesRepo.mettreAJourEntreprise(B, { messageClient: "Message de B [lien]" });

    assert.strictEqual((await entreprisesRepo.getEntreprise(A))?.messageClient, sien,
      "le message de A a été touché par B");
    assert.strictEqual((await entreprisesRepo.getEntreprise(B))?.messageClient, "Message de B [lien]");
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
