import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { pool } from "../src/server/db/client";
import { withEntreprise } from "../src/server/db/with-entreprise";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import { ajouterMouvements, type MouvementEnBase } from "../src/server/repositories/banque";
import { lignesDuReleve, marquerTicketPerdu } from "../src/server/repositories/pour-mon-comptable";
import { rangerDossier } from "../src/server/repositories/dossiers-comptables";
import {
  attestationParJeton,
  attestationsAMontrer,
  creerLienComptable,
  fichierDeLAttestation,
  fichierDeLAttestationParJeton,
  marquerAttestationVue,
  poserVerdictParJeton,
  verificationsDesDossiers,
} from "../src/server/repositories/verification-comptable";
import { signerLAttestation } from "../src/server/attestation-comptable";
import { lireLaSaisie, type SaisieLue } from "../src/lib/attestation-comptable";
import { lireObjet } from "../src/server/storage";
import { fermerLimiteur } from "../src/server/rate-limit";
import { nettoyerBase } from "./_test-db";

// ═══════════════════════════════════════════════════════════════════════════
// POUR MON COMPTABLE, LOT 6 : l'attestation que le comptable signe
// ═══════════════════════════════════════════════════════════════════════════
//
// **Une suite BASE, sous `atlas_app`**, comme toute écriture par jeton
// (`CLAUDE.md` §5). Ce qu'elle défend :
//   · un dossier inachevé ne se signe pas ;
//   · les comptes de l'attestation sont faits au serveur, sur les verdicts ;
//   · le PDF signé est rangé, et le patron le lit dans Mes dossiers ;
//   · une attestation signée ne se réécrit pas et ne s'efface pas ;
//   · une autre entreprise ne voit rien, un jeton expiré ne signe rien ;
//   · un verdict changé après la signature la rend périmée.

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
    { nom: `Jardins Attestés ${suffixe}` },
    { email: `attest-${suffixe}-${Date.now()}@t.test` }
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

// La justification d'une ligne se date à l'horloge réelle (`marquerTicketPerdu`) :
// la signature vient après, comme chez lui.
const MAINTENANT = new Date(Date.now() + 60_000);
const PLUS_TARD = new Date(MAINTENANT.getTime() + 3_600_000);
const EXPIRE = new Date(MAINTENANT.getTime() + 400 * 86_400_000);
// Un PNG d'un point : ce que la toile du comptable envoie, en plus petit.
const SIGNATURE = new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64"));

function saisie(conclusion: string): SaisieLue {
  const r = lireLaSaisie({
    conclusion,
    observations: "Dossier tenu avec soin.",
    signataire: { nom: "Claire Bernard", fonction: "expert_comptable", societe: "Cabinet Bernard & Associés", ordre: "14-0087654", siren: "812 345 678", adresse: "14 rue du Commerce, 49100 Angers", email: "claire@cabinet-bernard.fr", telephone: "02 41 00 00 00" },
  });
  assert.ok(r.ok);
  return r.valeur;
}

async function main() {
  await nettoyerBase();
  const ctx = await contexte("a");
  const autre = await contexte("b");
  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) => tx.execute(sql`UPDATE entreprises SET email = 'contact@jardins-a.test'`));

  await ajouterMouvements(ctx, [sortie("GASOIL", "2026-01-09", "48.11"), sortie("POSTE", "2026-01-07", "12.55")]);
  const lignes = await lignesDuReleve(ctx, "2026-01-01", "2026-01-31");
  const id = (lib: string) => lignes.find((l) => l.libelle === `CB ${lib}`)!.id;
  assert.equal((await marquerTicketPerdu(ctx, id("POSTE"))).ok, true);
  assert.equal((await marquerTicketPerdu(ctx, id("GASOIL"))).ok, true);
  const range = await rangerDossier(ctx, { du: "2026-01-01", au: "2026-01-31", fichierCle: "entreprises/x/dossiers/janvier.pdf", tailleOctets: 4000, empreinte: "b".repeat(64), gardeJusquAu: "2036-01-31" });
  assert.ok(range.ok);
  const dossierId = (range as { id: string }).id;
  const lien = await creerLienComptable(ctx, dossierId, MAINTENANT);
  assert.ok(lien.ok);
  const jeton = (lien as { jeton: string }).jeton;

  await test("un dossier inachevé ne se signe pas", async () => {
    assert.ok((await poserVerdictParJeton(jeton, id("GASOIL"), "valide", null, MAINTENANT)).ok);
    const r = await signerLAttestation(jeton, saisie("conforme"), SIGNATURE, MAINTENANT);
    assert.deepEqual(r, { ok: false, raison: "Il reste des lignes à vérifier." });
    assert.equal(await attestationParJeton(jeton, MAINTENANT), null);
  });

  let attestationId = "";
  await test("le dossier vérifié se signe : comptes faits au serveur, PDF rangé, avis au patron", async () => {
    assert.ok((await poserVerdictParJeton(jeton, id("POSTE"), "rejete", "Pas de pièce.", MAINTENANT)).ok);
    const r = await signerLAttestation(jeton, saisie("reserves"), SIGNATURE, MAINTENANT);
    assert.ok(r.ok, r.ok ? "" : r.raison);
    attestationId = r.attestation.id;
    assert.equal(r.attestation.conclusion, "reserves");
    assert.deepEqual([r.attestation.lignes, r.attestation.validees, r.attestation.rejetees], [2, 1, 1]);
    assert.equal(r.courriel?.a, "contact@jardins-a.test");
    assert.ok(!r.courriel!.texte.includes("CB POSTE"), "une ligne de banque est partie dans le courriel");
    const cle = await fichierDeLAttestationParJeton(jeton, MAINTENANT);
    assert.ok(cle);
    const pdf = await lireObjet(cle.cle);
    assert.equal(pdf.subarray(0, 5).toString("latin1"), "%PDF-");
  });

  await test("le comptable retrouve son attestation, à jour", async () => {
    const a = await attestationParJeton(jeton, MAINTENANT);
    assert.ok(a);
    assert.equal(a.conclusion, "reserves");
    assert.equal(a.signataireNom, "Claire Bernard");
    assert.equal(a.aJour, true);
  });

  await test("le patron la lit dans Mes dossiers, et la carte de l'accueil se tait sur « J'ai vu »", async () => {
    const [v] = await verificationsDesDossiers(ctx);
    assert.equal(v.attestation?.id, attestationId);
    assert.equal(v.attestation?.conclusion, "reserves");
    assert.ok(await fichierDeLAttestation(ctx, attestationId));
    assert.deepEqual((await attestationsAMontrer(ctx)).map((a) => a.id), [attestationId]);
    await marquerAttestationVue(ctx, attestationId);
    assert.deepEqual(await attestationsAMontrer(ctx), []);
  });

  await test("une autre entreprise ne voit rien", async () => {
    assert.equal(await fichierDeLAttestation(autre, attestationId), null);
    assert.deepEqual(await attestationsAMontrer(autre), []);
    assert.equal((await verificationsDesDossiers(autre)).length, 0);
  });

  await test("une attestation signée ne se réécrit pas et ne s'efface pas", async () => {
    const ecrire = (requete: ReturnType<typeof sql>) => () => withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) => tx.execute(requete));
    assert.equal(await codeDuRefus(ecrire(sql`UPDATE attestations_comptable SET conclusion = 'conforme'`)), "42501");
    assert.equal(await codeDuRefus(ecrire(sql`UPDATE attestations_comptable SET rejetees = 0, validees = 2`)), "42501");
    assert.equal(await codeDuRefus(ecrire(sql`DELETE FROM attestations_comptable`)), "42501");
  });

  await test("une signature illisible ou un jeton expiré ne signent rien", async () => {
    const r1 = await signerLAttestation(jeton, saisie("conforme"), new Uint8Array([1, 2, 3]), MAINTENANT);
    assert.deepEqual(r1, { ok: false, raison: "La signature n'est pas lisible. Signez à nouveau." });
    const r2 = await signerLAttestation(jeton, saisie("conforme"), SIGNATURE, EXPIRE);
    assert.equal(r2.ok, false);
  });

  await test("un verdict changé après la signature la rend périmée", async () => {
    assert.ok((await poserVerdictParJeton(jeton, id("POSTE"), "valide", null, PLUS_TARD)).ok);
    const a = await attestationParJeton(jeton, PLUS_TARD);
    assert.ok(a);
    assert.equal(a.aJour, false);
    const [v] = await verificationsDesDossiers(ctx);
    assert.equal(v.attestation?.aJour, false);
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
