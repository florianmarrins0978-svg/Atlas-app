import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { pool } from "../src/server/db/client";
import { withEntreprise } from "../src/server/db/with-entreprise";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import { ajouterMouvements, type MouvementEnBase } from "../src/server/repositories/banque";
import { marquerTicketPerdu, lignesDuReleve } from "../src/server/repositories/pour-mon-comptable";
import { ajouterBilan, dossierEnCours, fichierDuBilan, fichierDuDossier, listerDossiers, rangerDossier, retirerBilan } from "../src/server/repositories/dossiers-comptables";
import { arreterLeDossier } from "../src/server/dossier-comptable";
import { lireObjet } from "../src/server/storage";
import { fermerLimiteur } from "../src/server/rate-limit";
import { nettoyerBase } from "./_test-db";

// ═══════════════════════════════════════════════════════════════════════════
// POUR MON COMPTABLE, LOT 3 — arrêter le dossier, le ranger, son bilan
// ═══════════════════════════════════════════════════════════════════════════
//
// **Une suite BASE, sous `atlas_app`** (`CLAUDE.md` §5). Ce qu'elle défend :
//   · le premier dossier part du jour qu'il choisit, les suivants du lendemain
//     du précédent, et jamais d'un autre jour ;
//   · un dossier ne s'arrête pas tant qu'une ligne attend sa pièce ;
//   · un dossier rangé ne se réécrit ni ne s'efface : la base le refuse ;
//   · le PDF rangé est bien un PDF, relu du stockage ;
//   · le bilan s'ajoute et se retire, et une autre entreprise ne voit rien.

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

type Ctx = { utilisateurId: string; entrepriseId: string };

async function contexte(suffixe: string): Promise<Ctx> {
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: `Atelier Dossier ${suffixe}` },
    { email: `dossier-${suffixe}-${Date.now()}@t.test` }
  );
  return { utilisateurId, entrepriseId: entreprise.id };
}

const sortie = (cle: string, jour: string, montant: string): MouvementEnBase => ({
  cle,
  date: jour,
  montant,
  sens: "sortie",
  contrepartie: null,
  libelle: `CB ${cle}`,
});

/** Le code PostgreSQL d'un refus, que Drizzle range dans `cause`. */
async function codeDuRefus(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (err) {
    const e = err as { code?: string; cause?: { code?: string } };
    return e?.cause?.code ?? e?.code ?? "inconnu";
  }
}

const MAINTENANT = new Date("2026-10-24T10:00:00Z");

async function main() {
  await nettoyerBase();
  const ctx = await contexte("a");
  const autre = await contexte("b");

  await test("le tout premier dossier se dit « premier », et part du 1er janvier par défaut", async () => {
    const d = await dossierEnCours(ctx, MAINTENANT);
    assert.deepEqual(d, { du: "2026-01-01", au: "2026-10-24", premier: true });
  });

  await ajouterMouvements(ctx, [sortie("GASOIL", "2026-03-10", "61.40"), sortie("ROUEN", "2026-06-02", "18.00")]);

  await test("un dossier ne s'arrête pas tant qu'une ligne attend sa pièce", async () => {
    const r = await arreterLeDossier(ctx, { du: "2026-02-01", au: "2026-06-30", maintenant: MAINTENANT });
    assert.equal(r.ok, false);
    assert.match((r as { raison: string }).raison, /^2 lignes attendent encore un justificatif/);
    assert.equal((await listerDossiers(ctx)).length, 0, "rien ne doit avoir été rangé");
  });

  await test("une date d'arrêt dans le futur est refusée", async () => {
    const r = await arreterLeDossier(ctx, { du: "2026-02-01", au: "2026-12-31", maintenant: MAINTENANT });
    assert.equal(r.ok, false);
  });

  let premierId = "";
  await test("une fois justifié, le premier dossier se range du jour choisi au jour d'arrêt", async () => {
    for (const l of await lignesDuReleve(ctx, "2026-01-01", "2026-06-30")) {
      const r = await marquerTicketPerdu(ctx, l.id);
      assert.equal(r.ok, true);
    }
    const r = await arreterLeDossier(ctx, { du: "2026-02-01", au: "2026-06-30", maintenant: MAINTENANT });
    assert.equal(r.ok, true, JSON.stringify(r));
    premierId = (r as { id: string }).id;
    const [d] = await listerDossiers(ctx);
    assert.equal(d.du, "2026-02-01");
    assert.equal(d.au, "2026-06-30");
    assert.equal(d.gardeJusquAu, "2036-06-30");
    assert.ok(d.tailleOctets > 1000, `un PDF de ${d.tailleOctets} octets ne porte rien`);
  });

  await test("le fichier rangé est un PDF, relu du stockage", async () => {
    const f = await fichierDuDossier(ctx, premierId);
    assert.ok(f, "le dossier rangé est introuvable");
    const octets = await lireObjet(f.cle);
    assert.equal(octets.subarray(0, 5).toString("latin1"), "%PDF-");
  });

  await test("le dossier suivant part du lendemain, et la date demandée est ignorée", async () => {
    assert.deepEqual(await dossierEnCours(ctx, MAINTENANT), { du: "2026-07-01", au: "2026-10-24", premier: false });
    const r = await arreterLeDossier(ctx, { du: "2025-01-01", au: "2026-09-30", maintenant: MAINTENANT });
    assert.equal(r.ok, true, JSON.stringify(r));
    const [dernier] = await listerDossiers(ctx);
    assert.equal(dernier.du, "2026-07-01", "deux dossiers ne couvrent jamais un même jour");
  });

  await test("le même dossier ne se range pas deux fois (deux appuis rapprochés)", async () => {
    const r = await rangerDossier(ctx, { du: "2026-07-01", au: "2026-09-30", fichierCle: "x", tailleOctets: 1, empreinte: "0".repeat(64), gardeJusquAu: "2036-09-30" });
    assert.deepEqual(r, { ok: false, raison: "Ce dossier est déjà rangé." });
  });

  await test("un dossier rangé ne se réécrit pas : la base refuse l'UPDATE", async () => {
    const code = await codeDuRefus(() =>
      withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) => tx.execute(sql`UPDATE dossiers_comptables SET au = '2026-12-31' WHERE id = ${premierId}`))
    );
    assert.equal(code, "42501");
  });

  await test("un dossier rangé ne s'efface pas : la base refuse le DELETE", async () => {
    const code = await codeDuRefus(() =>
      withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) => tx.execute(sql`DELETE FROM dossiers_comptables WHERE id = ${premierId}`))
    );
    assert.equal(code, "42501");
    assert.equal((await listerDossiers(ctx)).length, 2);
  });

  let bilanId = "";
  await test("le bilan du comptable se range avec son dossier", async () => {
    const r = await ajouterBilan(ctx, { dossierId: premierId, fichierCle: "entreprises/x/bilans/b.pdf", fichierNom: "Bilan 2026.pdf", nature: "pdf", tailleOctets: 1200, empreinte: "1".repeat(64) });
    assert.equal(r.ok, true, JSON.stringify(r));
    bilanId = (r as { id: string }).id;
    const d = (await listerDossiers(ctx)).find((x) => x.id === premierId);
    assert.equal(d?.bilans.length, 1);
    assert.equal(d?.bilans[0].fichierNom, "Bilan 2026.pdf");
  });

  await test("une autre entreprise ne voit ni les dossiers, ni les bilans", async () => {
    assert.equal((await listerDossiers(autre)).length, 0);
    assert.equal(await fichierDuDossier(autre, premierId), null);
    assert.equal(await fichierDuBilan(autre, bilanId), null);
    assert.equal(await retirerBilan(autre, bilanId), null);
    assert.ok(await fichierDuBilan(ctx, bilanId), "le bilan a été retiré par l'autre entreprise");
  });

  await test("une autre entreprise ne peut pas poser un bilan sur un dossier qui n'est pas le sien", async () => {
    const r = await ajouterBilan(autre, { dossierId: premierId, fichierCle: "y", fichierNom: null, nature: "photo", tailleOctets: 1, empreinte: "2".repeat(64) });
    assert.deepEqual(r, { ok: false, raison: "Ce dossier n'existe pas." });
  });

  await test("un bilan ajouté par erreur se retire, et rend sa clé pour effacer le fichier", async () => {
    assert.equal(await retirerBilan(ctx, bilanId), "entreprises/x/bilans/b.pdf");
    assert.equal(await fichierDuBilan(ctx, bilanId), null);
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  await fermerLimiteur();
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  await fermerLimiteur();
  await pool.end();
  process.exit(1);
});
