import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { pool } from "../src/server/db/client";
import { withEntreprise } from "../src/server/db/with-entreprise";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import { ajouterMouvements, type MouvementEnBase } from "../src/server/repositories/banque";
import { creerAchatTva } from "../src/server/repositories/achats-tva";
import { delier, lignesDuReleve, marquerTicketPerdu, relierTicket } from "../src/server/repositories/pour-mon-comptable";
import { rangerDossier } from "../src/server/repositories/dossiers-comptables";
import {
  creerLienComptable,
  dossierParJeton,
  pieceParJeton,
  poserVerdictParJeton,
  verificationsDesDossiers,
} from "../src/server/repositories/verification-comptable";
import { fermerLimiteur } from "../src/server/rate-limit";
import { nettoyerBase } from "./_test-db";

// ═══════════════════════════════════════════════════════════════════════════
// POUR MON COMPTABLE, LOT 4 — le comptable vérifie par un lien privé
// ═══════════════════════════════════════════════════════════════════════════
//
// **Une suite BASE, sous `atlas_app`**, comme toute page publique par jeton
// (`CLAUDE.md` §5 : les suites navigateur traversent la RLS et ne verraient
// pas une fuite). Ce qu'elle défend :
//   · un jeton n'ouvre que SON dossier, et dans sa période ;
//   · la base ne garde que l'empreinte du jeton ;
//   · valider, rejeter (avec sa raison), changer d'avis, enlever ;
//   · le patron lit les rejets ; une ligne qu'il re-justifie revient au comptable ;
//   · un lien expiré, inconnu ou d'une autre entreprise ne rend rien.

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
    { nom: `Jardins Vérif ${suffixe}` },
    { email: `verif-${suffixe}-${Date.now()}@t.test` }
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
const pause = () => new Promise((r) => setTimeout(r, 15));

async function main() {
  await nettoyerBase();
  const ctx = await contexte("a");
  const autre = await contexte("b");

  // Le dossier de janvier : deux lignes dedans, une en février, hors du dossier.
  await ajouterMouvements(ctx, [sortie("GASOIL", "2026-01-09", "48.11"), sortie("POSTE", "2026-01-07", "12.55"), sortie("FEVRIER", "2026-02-03", "30.00")]);
  const ticket = await creerAchatTva(ctx, { dateAchat: "2026-01-09", fournisseur: "INTERMARCHE", totalTtc: 48.11, tauxTva: 20, tvaTicket: 8.02, nature: "carburant", vehicule: "utilitaire", photoCle: "entreprises/x/tickets/gasoil.jpg", saisie: "main" });
  const ticket2 = await creerAchatTva(ctx, { dateAchat: "2026-01-08", fournisseur: "ESSO", totalTtc: 48.11, tauxTva: 20, tvaTicket: 8.02, nature: "carburant", vehicule: "utilitaire", saisie: "main" });
  const lignes = await lignesDuReleve(ctx, "2026-01-01", "2026-02-28");
  const id = (lib: string) => lignes.find((l) => l.libelle === `CB ${lib}`)!.id;
  assert.equal((await relierTicket(ctx, id("GASOIL"), ticket.id, "patron")).ok, true);
  assert.equal((await marquerTicketPerdu(ctx, id("POSTE"))).ok, true);
  const range = await rangerDossier(ctx, { du: "2026-01-01", au: "2026-01-31", fichierCle: "entreprises/x/dossiers/janvier.pdf", tailleOctets: 4000, empreinte: "a".repeat(64), gardeJusquAu: "2036-01-31" });
  assert.ok(range.ok);
  const dossierId = (range as { id: string }).id;

  let jeton = "";
  await test("le lien se crée, et la base n'en garde que l'empreinte", async () => {
    const r = await creerLienComptable(ctx, dossierId, MAINTENANT);
    assert.ok(r.ok);
    jeton = (r as { jeton: string }).jeton;
    assert.ok(jeton.length >= 40);
    const garde = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
      tx.execute<{ jeton_empreinte: string }>(sql`SELECT jeton_empreinte FROM envois_comptable`)
    );
    const lignesLues = (garde as unknown as { rows: { jeton_empreinte: string }[] }).rows;
    assert.equal(lignesLues.length, 1);
    assert.equal(lignesLues[0].jeton_empreinte, createHash("sha256").update(jeton).digest("hex"));
    assert.notEqual(lignesLues[0].jeton_empreinte, jeton);
  });

  await test("le comptable ouvre le dossier : ses lignes, et rien hors de sa période", async () => {
    const d = await dossierParJeton(jeton, MAINTENANT);
    assert.ok(d, "le lien n'ouvre rien");
    assert.equal(d.entreprise, "Jardins Vérif a");
    assert.deepEqual(d.lignes.map((l) => l.libelle).sort(), ["CB GASOIL", "CB POSTE"]);
    assert.ok(d.lignes.every((l) => l.verification.etat === "a_verifier"));
  });

  await test("un jeton inconnu, mal formé ou expiré n'ouvre rien", async () => {
    assert.equal(await dossierParJeton("x".repeat(43), MAINTENANT), null);
    assert.equal(await dossierParJeton("'; DROP TABLE x; --", MAINTENANT), null);
    assert.equal(await dossierParJeton("", MAINTENANT), null);
    assert.equal(await dossierParJeton(jeton, new Date("2027-12-01T00:00:00Z")), null);
    const r = await poserVerdictParJeton(jeton, id("GASOIL"), "valide", null, new Date("2027-12-01T00:00:00Z"));
    assert.equal(r.ok, false);
  });

  await test("une ligne hors du dossier ne se vérifie pas par ce lien", async () => {
    const r = await poserVerdictParJeton(jeton, id("FEVRIER"), "valide", null, MAINTENANT);
    assert.deepEqual(r, { ok: false, raison: "Cette ligne n'est pas dans le dossier." });
  });

  await test("valider, puis changer d'avis : le rejet garde sa raison et « il l'avait validée »", async () => {
    assert.ok((await poserVerdictParJeton(jeton, id("GASOIL"), "valide", null, MAINTENANT)).ok);
    let d = (await dossierParJeton(jeton, MAINTENANT))!;
    assert.deepEqual(d.lignes.find((l) => l.id === id("GASOIL"))!.verification, { etat: "valide" });
    assert.ok((await poserVerdictParJeton(jeton, id("GASOIL"), "rejete", "  Pas le bon   ticket ", MAINTENANT)).ok);
    d = (await dossierParJeton(jeton, MAINTENANT))!;
    assert.deepEqual(d.lignes.find((l) => l.id === id("GASOIL"))!.verification, { etat: "rejete", note: "Pas le bon ticket", avaitValide: true });
  });

  await test("le patron lit le rejet dans Mes dossiers, avec sa raison", async () => {
    const [v] = await verificationsDesDossiers(ctx);
    assert.equal(v.dossierId, dossierId);
    assert.equal(v.envoye, true);
    assert.equal(v.verifiees, 1);
    assert.equal(v.total, 2);
    assert.equal(v.rejets.length, 1);
    assert.equal(v.rejets[0].note, "Pas le bon ticket");
    assert.equal(v.rejets[0].avaitValide, true);
  });

  await test("le patron relie un autre ticket : la ligne revient au comptable, « corrigée »", async () => {
    await pause();
    assert.ok((await delier(ctx, id("GASOIL"))).ok);
    assert.ok((await relierTicket(ctx, id("GASOIL"), ticket2.id, "patron")).ok);
    const d = (await dossierParJeton(jeton, MAINTENANT))!;
    assert.deepEqual(d.lignes.find((l) => l.id === id("GASOIL"))!.verification, { etat: "corrigee", note: "Pas le bon ticket" });
    const [v] = await verificationsDesDossiers(ctx);
    assert.equal(v.rejets.length, 0, "un rejet déjà corrigé n'attend plus le patron");
    assert.equal(v.verifiees, 0);
  });

  await test("un second appui enlève le verdict", async () => {
    assert.ok((await poserVerdictParJeton(jeton, id("POSTE"), "valide", null, MAINTENANT)).ok);
    assert.ok((await poserVerdictParJeton(jeton, id("POSTE"), null, null, MAINTENANT)).ok);
    const d = (await dossierParJeton(jeton, MAINTENANT))!;
    assert.equal(d.lignes.find((l) => l.id === id("POSTE"))!.verification.etat, "a_verifier");
  });

  await test("la pièce d'une ligne se sert par le jeton, jamais celle d'une ligne hors du dossier", async () => {
    // GASOIL porte désormais le ticket ESSO, sans photo.
    assert.equal(await pieceParJeton(jeton, id("GASOIL"), MAINTENANT), null);
    await delier(ctx, id("GASOIL"));
    await relierTicket(ctx, id("GASOIL"), ticket.id, "patron");
    assert.deepEqual(await pieceParJeton(jeton, id("GASOIL"), MAINTENANT), { cle: "entreprises/x/tickets/gasoil.jpg", nature: "photo" });
    assert.equal(await pieceParJeton(jeton, id("FEVRIER"), MAINTENANT), null);
    assert.equal(await pieceParJeton("y".repeat(43), id("GASOIL"), MAINTENANT), null);
  });

  await test("une autre entreprise ne crée pas de lien sur ce dossier, et son lien n'atteint pas ces lignes", async () => {
    assert.deepEqual(await creerLienComptable(autre, dossierId, MAINTENANT), { ok: false, raison: "Ce dossier n'existe pas." });
    await ajouterMouvements(autre, [sortie("AUTRE", "2026-01-05", "9.00")]);
    const sien = await rangerDossier(autre, { du: "2026-01-01", au: "2026-01-31", fichierCle: "b", tailleOctets: 1, empreinte: "b".repeat(64), gardeJusquAu: "2036-01-31" });
    const lien = await creerLienComptable(autre, (sien as { id: string }).id, MAINTENANT);
    const jetonB = (lien as { jeton: string }).jeton;
    const d = (await dossierParJeton(jetonB, MAINTENANT))!;
    assert.deepEqual(d.lignes.map((l) => l.libelle), ["CB AUTRE"]);
    assert.deepEqual(await poserVerdictParJeton(jetonB, id("POSTE"), "rejete", "x", MAINTENANT), { ok: false, raison: "Cette ligne n'est pas dans le dossier." });
    assert.equal(await pieceParJeton(jetonB, id("GASOIL"), MAINTENANT), null);
    assert.equal((await verificationsDesDossiers(autre))[0].rejets.length, 0);
  });

  await test("un lien ne se réécrit pas : la base refuse l'UPDATE", async () => {
    const code = await codeDuRefus(() =>
      withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) => tx.execute(sql`UPDATE envois_comptable SET expire_le = now() + interval '50 years'`))
    );
    assert.equal(code, "42501");
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
