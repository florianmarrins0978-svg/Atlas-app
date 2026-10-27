import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { pool } from "../src/server/db/client";
import { withEntreprise } from "../src/server/db/with-entreprise";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import { ajouterMouvements, type MouvementEnBase } from "../src/server/repositories/banque";
import { lignesDuReleve, marquerTicketPerdu } from "../src/server/repositories/pour-mon-comptable";
import { rangerDossier } from "../src/server/repositories/dossiers-comptables";
import {
  creerLienComptable,
  dernierRetourParJeton,
  marquerRetourVu,
  poserVerdictParJeton,
  renvoyerParJeton,
  retoursAMontrer,
  verificationsDesDossiers,
} from "../src/server/repositories/verification-comptable";
import { fermerLimiteur } from "../src/server/rate-limit";
import { nettoyerBase } from "./_test-db";

// ═══════════════════════════════════════════════════════════════════════════
// POUR MON COMPTABLE, LOT 7 : le comptable renvoie le dossier à corriger
// ═══════════════════════════════════════════════════════════════════════════
//
// **Une suite BASE, sous `atlas_app`**, comme toute écriture par jeton
// (`CLAUDE.md` §5). Ce qu'elle défend :
//   · sans ligne rejetée, rien ne se renvoie ;
//   · le renvoi garde le mot et l'adresse, et l'avis au patron n'en porte rien ;
//   · le patron lit la demande, puis « Tout est corrigé » quand il a repris les lignes ;
//   · un renvoi ne se réécrit pas et ne s'efface pas ;
//   · une autre entreprise ne voit rien, un jeton expiré ne renvoie rien.

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
    { nom: `Jardins Renvoyés ${suffixe}` },
    { email: `retour-${suffixe}-${Date.now()}@t.test` }
  );
  return { utilisateurId, entrepriseId: entreprise.id };
}

const sortie = (cle: string, jour: string, montant: string): MouvementEnBase => ({ cle, date: jour, montant, sens: "sortie", contrepartie: null, libelle: `CB ${cle}` });

async function codeDuRefus(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (err) {
    const e = err as { code?: string; cause?: { code?: string } };
    return e?.cause?.code ?? e?.code ?? "inconnu";
  }
}

// La justification d'une ligne se date à l'horloge réelle : le reste suit.
const MAINTENANT = new Date(Date.now() + 60_000);
const EXPIRE = new Date(MAINTENANT.getTime() + 400 * 86_400_000);

async function main() {
  await nettoyerBase();
  const ctx = await contexte("a");
  const autre = await contexte("b");
  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) => tx.execute(sql`UPDATE entreprises SET email = 'contact@jardins-a.test'`));

  await ajouterMouvements(ctx, [sortie("GASOIL", "2026-01-09", "48.11"), sortie("EDF", "2026-01-12", "9.28")]);
  const lignes = await lignesDuReleve(ctx, "2026-01-01", "2026-01-31");
  const id = (lib: string) => lignes.find((l) => l.libelle === `CB ${lib}`)!.id;
  for (const l of lignes) assert.equal((await marquerTicketPerdu(ctx, l.id)).ok, true);
  const range = await rangerDossier(ctx, { du: "2026-01-01", au: "2026-01-31", fichierCle: "entreprises/x/dossiers/janvier.pdf", tailleOctets: 4000, empreinte: "d".repeat(64), gardeJusquAu: "2036-01-31" });
  assert.ok(range.ok);
  const dossierId = (range as { id: string }).id;
  const lien = await creerLienComptable(ctx, dossierId, MAINTENANT);
  assert.ok(lien.ok);
  const jeton = (lien as { jeton: string }).jeton;

  await test("sans ligne rejetée, rien ne se renvoie", async () => {
    assert.ok((await poserVerdictParJeton(jeton, id("GASOIL"), "valide", null, MAINTENANT)).ok);
    const r = await renvoyerParJeton(jeton, { message: "Rien à dire.", email: null }, MAINTENANT);
    assert.deepEqual(r, { ok: false, raison: "Aucune ligne rejetée à renvoyer." });
    assert.equal(await dernierRetourParJeton(jeton, MAINTENANT), null);
  });

  await test("le renvoi garde le mot et l'adresse, et l'avis au patron n'en porte rien", async () => {
    assert.ok((await poserVerdictParJeton(jeton, id("EDF"), "rejete", "Contrat du domicile.", MAINTENANT)).ok);
    const r = await renvoyerParJeton(jeton, { message: "Une ligne à reprendre avant que je signe.", email: "claire@cabinet.test" }, MAINTENANT);
    assert.ok(r.ok, r.ok ? "" : r.raison);
    assert.equal(r.retour.rejetees, 1);
    assert.equal(r.courriel?.a, "contact@jardins-a.test");
    assert.ok(!r.courriel!.texte.includes("avant que je signe"), "le mot du comptable est parti dans le courriel");
    assert.ok(!r.courriel!.texte.includes("CB EDF"), "une ligne de banque est partie dans le courriel");
    const dernier = await dernierRetourParJeton(jeton, MAINTENANT);
    assert.equal(dernier?.rejetees, 1);
  });

  await test("le patron lit la demande, puis sa carte se range sur « J'ai vu »", async () => {
    const [v] = await verificationsDesDossiers(ctx);
    assert.equal(v.retour?.message, "Une ligne à reprendre avant que je signe.");
    assert.equal(v.retour?.email, "claire@cabinet.test");
    assert.equal(v.rejets.length, 1);
    assert.equal(v.corrigees, 0);
    const cartes = await retoursAMontrer(ctx);
    assert.equal(cartes.length, 1);
    assert.equal(cartes[0].message, "Une ligne à reprendre avant que je signe.");
    await marquerRetourVu(ctx, cartes[0].id);
    assert.deepEqual(await retoursAMontrer(ctx), []);
  });

  await test("le patron reprend la ligne : plus de rejet, une ligne « corrigée » attend le comptable", async () => {
    assert.equal((await marquerTicketPerdu(ctx, id("EDF"))).ok, true);
    const [v] = await verificationsDesDossiers(ctx);
    assert.equal(v.rejets.length, 0);
    assert.equal(v.corrigees, 1);
  });

  await test("une autre entreprise ne voit rien", async () => {
    assert.deepEqual(await retoursAMontrer(autre), []);
    assert.equal((await verificationsDesDossiers(autre)).length, 0);
  });

  await test("un renvoi ne se réécrit pas et ne s'efface pas", async () => {
    const ecrire = (requete: ReturnType<typeof sql>) => () => withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) => tx.execute(requete));
    assert.equal(await codeDuRefus(ecrire(sql`UPDATE retours_comptable SET message = 'autre chose'`)), "42501");
    assert.equal(await codeDuRefus(ecrire(sql`DELETE FROM retours_comptable`)), "42501");
  });

  await test("un jeton expiré ne renvoie rien", async () => {
    const r1 = await renvoyerParJeton(jeton, { message: null, email: null }, EXPIRE);
    assert.equal(r1.ok, false);
    assert.equal(await dernierRetourParJeton(jeton, EXPIRE), null);
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
