import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import { creerClient } from "../src/server/repositories/clients";
import {
  enregistrerContrat,
  envoyerContrat,
  repondreAuContrat,
  poserLesPassagesArrives,
} from "../src/server/repositories/contrats-entretien";
import { listerChantiersPourPlanning, planifierChantier } from "../src/server/repositories/chantiers";
import {
  datesDuMoisPourLePlanning,
  envoyerDatesDuMois,
  lireDatesParJeton,
  validerDatesDuMois,
} from "../src/server/repositories/dates-du-mois";
import type { ContratSaisi } from "../src/lib/contrats-entretien";

// Les dates du mois d'un contrat, sous `atlas_app` (planche 130, sa demande du
// 27 septembre 2026). Ce qui est éprouvé :
//   1. la RLS est armée, et le lien ne s'ouvre que par son jeton exact ;
//   2. l'envoi attend la DERNIÈRE date, et rend le même lien deux fois ;
//   3. le client ne voit que les jours libres, et seulement si c'est permis ;
//   4. un jour changé se revérifie, et une réponse refusée n'écrit RIEN.

let echecs = 0;
async function cas(nom: string, verifier: () => Promise<void>) {
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
    { nom: `Jardins ${suffixe}` },
    { email: `dates-${suffixe}-${Date.now()}@atlas.test` }
  );
  const ctx = { utilisateurId, entrepriseId: entreprise.id };
  const client = await creerClient(ctx, { nom: "Costa", civilite: "mme", adresse: "12 chemin des Vignes", telephone: "0612345678" });
  return { ctx, clientId: client.id };
}

const SAISI: ContratSaisi = {
  prestations: [{ libelle: "Tonte et ébarbage", famille: "Pelouse", mois: [4, 5], foisParMois: 2, prixPassageHt: "45" }],
  debut: "2027-04-01",
  dureeMois: 2,
  reconduit: false,
  facturation: "passage",
  avecCompteRendu: false,
};

async function passagesDuMois(ctx: { utilisateurId: string; entrepriseId: string }, mois: string) {
  const tous = await listerChantiersPourPlanning(ctx);
  return tous
    .filter((c) => c.contratEntretienId && c.contratPassage?.includes(`-${mois.slice(0, 7)}-`))
    .sort((x, y) => (x.contratPassage ?? "").localeCompare(y.contratPassage ?? ""));
}

async function main() {
  console.log("=== Les dates du mois, en base ===");

  await cas("la RLS est armée et forcée, avec l'isolation et la lecture par jeton", async () => {
    const { rows } = await pool.query(
      `select c.relrowsecurity, c.relforcerowsecurity,
              (select string_agg(policyname, ',' order by policyname) from pg_policies p
                where p.tablename = 'envois_dates_contrat') as politiques
         from pg_class c where c.relname = 'envois_dates_contrat'`
    );
    assert.equal(rows[0]?.relrowsecurity, true);
    assert.equal(rows[0]?.relforcerowsecurity, true);
    assert.equal(rows[0]?.politiques, "envois_dates_contrat_isolation,envois_dates_contrat_lecture_par_jeton");
  });

  const a = await contexte(`a${Date.now()}`);
  const b = await contexte(`b${Date.now()}`);
  const r = await enregistrerContrat(a.ctx, { id: null, clientId: a.clientId, saisi: SAISI });
  assert.ok(r.ok);
  if (!r.ok) return;
  const contratId = r.contrat.id;
  const e = await envoyerContrat(a.ctx, contratId);
  assert.ok(e.ok);
  if (!e.ok) return;
  await repondreAuContrat(e.jeton, { decision: "accepte" });
  await poserLesPassagesArrives(a.ctx, "2027-04-20");
  const AVRIL = "2027-04-01";
  const MAI = "2027-05-01";
  const aujourdhui = "2027-03-25";

  await cas("tant qu'une date manque, l'envoi refuse et le dit", async () => {
    const [t1] = await passagesDuMois(a.ctx, AVRIL);
    await planifierChantier(a.ctx, t1.id, "2027-04-06");
    const envoi = await envoyerDatesDuMois(a.ctx, { contratEntretienId: contratId, mois: AVRIL, canal: "sms", autreDateAutorisee: true }, aujourdhui);
    assert.deepEqual(envoi, { ok: false, refus: "Posez toutes les dates du mois avant de les envoyer." });
  });

  let jeton = "";
  await cas("la dernière date posée, l'envoi part et rend le même lien deux fois", async () => {
    const [, t2] = await passagesDuMois(a.ctx, AVRIL);
    await planifierChantier(a.ctx, t2.id, "2027-04-20");
    const demande = { contratEntretienId: contratId, mois: AVRIL, canal: "sms" as const, autreDateAutorisee: true };
    const e1 = await envoyerDatesDuMois(a.ctx, demande, aujourdhui);
    const e2 = await envoyerDatesDuMois(a.ctx, demande, aujourdhui);
    assert.ok(e1.ok && e2.ok);
    if (!e1.ok || !e2.ok) return;
    assert.equal(e1.jeton, e2.jeton);
    jeton = e1.jeton;
    const vu = await datesDuMoisPourLePlanning(a.ctx, aujourdhui);
    assert.equal(vu.envois.length, 1);
    assert.equal(vu.envois[0].reponduLe, null);
    assert.equal(vu.contacts[0]?.telephone, "0612345678");
  });

  await cas("une autre entreprise n'envoie pas les dates de ce contrat et n'en voit rien", async () => {
    const x = await envoyerDatesDuMois(b.ctx, { contratEntretienId: contratId, mois: AVRIL, canal: "sms", autreDateAutorisee: true }, aujourdhui);
    assert.deepEqual(x, { ok: false, refus: "Ce contrat n'est pas accepté." });
    const vu = await datesDuMoisPourLePlanning(b.ctx, aujourdhui);
    assert.equal(vu.envois.length + vu.contacts.length, 0);
  });

  await cas("le client lit ses dates ; chaque passage ne lui offre que des jours libres du mois", async () => {
    assert.equal(await lireDatesParJeton("jeton-invente", aujourdhui), null);
    const lu = await lireDatesParJeton(jeton, aujourdhui);
    assert.ok(lu);
    if (!lu) return;
    assert.equal(lu.passages.length, 2);
    assert.deepEqual(lu.passages.map((p) => p.jour), ["2027-04-06", "2027-04-20"]);
    assert.equal(lu.passages[0].libelle, "Tonte et ébarbage");
    // Le mois ENTIER, pas la semaine : le 29 est offert au premier passage.
    assert.ok(lu.passages[0].joursPossibles.includes("2027-04-29"));
    // Le jour de son frère est pris : une équipe, une journée.
    assert.ok(!lu.passages[0].joursPossibles.includes("2027-04-20"));
    assert.ok(lu.passages[0].joursPossibles.every((j) => j >= AVRIL && j <= "2027-04-30"));
  });

  await cas("un jour qui ne tient plus refuse TOUTE la réponse : le premier passage ne bouge pas", async () => {
    const [t1, t2] = await passagesDuMois(a.ctx, AVRIL);
    const v = await validerDatesDuMois(jeton, { changements: { [t1.id]: "2027-04-08", [t2.id]: "2027-04-08" } }, aujourdhui);
    assert.deepEqual(v, { ok: false, motif: "date_prise" });
    const apres = await passagesDuMois(a.ctx, AVRIL);
    assert.deepEqual(apres.map((p) => p.datePlanifiee), ["2027-04-06", "2027-04-20"]);
  });

  await cas("un autre chantier ne se déplace pas par ce lien", async () => {
    const [m1] = await passagesDuMois(a.ctx, MAI);
    const v = await validerDatesDuMois(jeton, { changements: { [m1.id]: "2027-04-09" } }, aujourdhui);
    assert.deepEqual(v, { ok: false, motif: "date_prise" });
  });

  await cas("il valide en déplaçant un passage : le planning suit, et il ne répond qu'une fois", async () => {
    const [t1] = await passagesDuMois(a.ctx, AVRIL);
    const v = await validerDatesDuMois(jeton, { changements: { [t1.id]: "2027-04-13" } }, aujourdhui);
    assert.deepEqual(v, { ok: true, changes: 1 });
    const apres = await passagesDuMois(a.ctx, AVRIL);
    assert.deepEqual(apres.map((p) => p.datePlanifiee).sort(), ["2027-04-13", "2027-04-20"]);
    assert.deepEqual(await validerDatesDuMois(jeton, { changements: {} }, aujourdhui), { ok: false, motif: "deja_repondu" });
    const relu = await lireDatesParJeton(jeton, aujourdhui);
    assert.equal(relu?.repondu, true);
    assert.ok(relu?.passages.every((p) => p.joursPossibles.length === 0));
    const envoi = await envoyerDatesDuMois(a.ctx, { contratEntretienId: contratId, mois: AVRIL, canal: "sms", autreDateAutorisee: true }, aujourdhui);
    assert.deepEqual(envoi, { ok: false, refus: "Le client a déjà validé ses dates de ce mois." });
  });

  await cas("sans autre date permise : aucun jour offert, un changement est refusé, la validation seule passe", async () => {
    const [m1, m2] = await passagesDuMois(a.ctx, MAI);
    await planifierChantier(a.ctx, m1.id, "2027-05-04");
    await planifierChantier(a.ctx, m2.id, "2027-05-18");
    const envoi = await envoyerDatesDuMois(a.ctx, { contratEntretienId: contratId, mois: MAI, canal: "email", autreDateAutorisee: false }, aujourdhui);
    assert.ok(envoi.ok);
    if (!envoi.ok) return;
    const lu = await lireDatesParJeton(envoi.jeton, aujourdhui);
    assert.equal(lu?.autreDateAutorisee, false);
    assert.ok(lu?.passages.every((p) => p.joursPossibles.length === 0));
    assert.deepEqual(await validerDatesDuMois(envoi.jeton, { changements: { [m1.id]: "2027-05-06" } }, aujourdhui), {
      ok: false,
      motif: "autre_date_refusee",
    });
    assert.deepEqual(await validerDatesDuMois(envoi.jeton, { changements: {} }, aujourdhui), { ok: true, changes: 0 });
  });

  await pool.end();
  if (echecs > 0) {
    console.error(`\n${echecs} cas en échec.`);
    process.exit(1);
  }
  console.log("\n✅ Les dates du mois tiennent en base.");
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
