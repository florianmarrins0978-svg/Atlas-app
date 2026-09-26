import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import { creerClient } from "../src/server/repositories/clients";
import {
  dernierContratDuClient,
  enregistrerContrat,
  envoyerContrat,
  lireContratParJeton,
  repondreAuContrat,
  poserLesPassagesArrives,
  pdfDuContratPourLePatron,
  pdfDuContratParJeton,
} from "../src/server/repositories/contrats-entretien";
import type { ContratSaisi } from "../src/lib/contrats-entretien";

// Les contrats d'entretien, sous `atlas_app` : c'est ce rôle qui prouve la RLS.
//
// Ce qui est éprouvé, et pourquoi :
//   1. **la RLS est armée** sur la table, et l'isolation tient : c'est la seule
//      chose dont un défaut ne se voit pas à l'écran ;
//   2. **le lien** : un brouillon ne se lit jamais par jeton, un contrat envoyé
//      oui, et la réponse ne se donne qu'une fois ;
//   3. **l'arrivée des passages est idempotente** : deux ouvertures du planning
//      ne posent jamais un passage deux fois.

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
    { email: `contrat-${suffixe}-${Date.now()}@atlas.test` }
  );
  const ctx = { utilisateurId, entrepriseId: entreprise.id };
  const client = await creerClient(ctx, { nom: "Costa", civilite: "mme", adresse: "12 chemin des Vignes" });
  return { ctx, clientId: client.id };
}

const SAISI: ContratSaisi = {
  prestations: [
    { libelle: "Tonte et ébarbage", famille: "Pelouse", mois: [4, 5, 6, 7, 8, 9, 10], foisParMois: 2, prixPassageHt: "45" },
    { libelle: "Taille de haie automne", famille: "Tailles", mois: [10], foisParMois: 1, prixPassageHt: "180" },
  ],
  debut: "2027-03-01",
  dureeMois: 12,
  reconduit: true,
  facturation: "passage",
  avecCompteRendu: false,
};

async function main() {
  console.log("=== Les contrats d'entretien, en base ===");

  await cas("la RLS est armée et forcée, avec l'isolation et la lecture par jeton", async () => {
    const { rows } = await pool.query(
      `select c.relrowsecurity, c.relforcerowsecurity,
              (select string_agg(policyname, ',' order by policyname) from pg_policies p
                where p.tablename = 'contrats_entretien') as politiques
         from pg_class c where c.relname = 'contrats_entretien'`
    );
    assert.equal(rows[0]?.relrowsecurity, true);
    assert.equal(rows[0]?.relforcerowsecurity, true);
    assert.equal(rows[0]?.politiques, "contrats_entretien_isolation,contrats_entretien_lecture_par_jeton");
  });

  const a = await contexte(`a${Date.now()}`);
  const b = await contexte(`b${Date.now()}`);

  let contratId = "";
  await cas("un brouillon s'enregistre, se relit, et prend le taux des réglages", async () => {
    const r = await enregistrerContrat(a.ctx, { id: null, clientId: a.clientId, saisi: SAISI });
    assert.ok(r.ok, r.ok ? "" : r.refus);
    if (!r.ok) return;
    contratId = r.contrat.id;
    assert.equal(r.contrat.statut, "brouillon");
    assert.equal(r.contrat.prestations[0].prixPassageHt, "45.00");
    assert.match(r.contrat.tauxTva, /^\d+\.\d{2}$/);
    const relu = await dernierContratDuClient(a.ctx, a.clientId);
    assert.equal(relu?.id, contratId);
  });

  await cas("une autre entreprise ne voit ni le contrat ni le client", async () => {
    assert.equal(await dernierContratDuClient(b.ctx, a.clientId), null);
    const r = await enregistrerContrat(b.ctx, { id: contratId, clientId: a.clientId, saisi: SAISI });
    assert.equal(r.ok, false);
    assert.equal(await pdfDuContratPourLePatron(b.ctx, contratId), null);
  });

  await cas("un refus de relecture se rend, il ne lève pas", async () => {
    const r = await enregistrerContrat(a.ctx, { id: contratId, clientId: a.clientId, saisi: { ...SAISI, dureeMois: 40 } });
    assert.equal(r.ok, false);
  });

  await cas("un contrat à chiffrer ne part pas, et le dit", async () => {
    const r = await enregistrerContrat(a.ctx, {
      id: null,
      clientId: a.clientId,
      saisi: { ...SAISI, prestations: [{ ...SAISI.prestations[0], prixPassageHt: null }] },
    });
    assert.ok(r.ok);
    if (!r.ok) return;
    const e = await envoyerContrat(a.ctx, r.contrat.id);
    assert.deepEqual(e, { ok: false, refus: "À compléter : Tonte et ébarbage." });
  });

  let jeton = "";
  await cas("l'aperçu PDF du brouillon se compose", async () => {
    const pdf = await pdfDuContratPourLePatron(a.ctx, contratId);
    assert.ok(pdf && pdf.length > 1000);
    assert.equal(Buffer.from(pdf.slice(0, 5)).toString(), "%PDF-");
  });

  await cas("un brouillon ne se lit jamais par jeton ; l'envoi le fige, et rend le même jeton deux fois", async () => {
    assert.equal(await lireContratParJeton("jeton-invente"), null);
    const e1 = await envoyerContrat(a.ctx, contratId);
    const e2 = await envoyerContrat(a.ctx, contratId);
    assert.ok(e1.ok && e2.ok);
    if (!e1.ok || !e2.ok) return;
    assert.equal(e1.jeton, e2.jeton);
    jeton = e1.jeton;
    const r = await enregistrerContrat(a.ctx, { id: contratId, clientId: a.clientId, saisi: SAISI });
    assert.deepEqual(r, { ok: false, refus: "Ce contrat est parti chez le client : il ne se modifie plus.", fige: true });
  });

  await cas("le client lit son contrat et son PDF par le lien", async () => {
    const lu = await lireContratParJeton(jeton);
    assert.equal(lu?.contrat.id, contratId);
    assert.equal(lu?.clientNom, "Costa");
    const pdf = await pdfDuContratParJeton(jeton);
    assert.ok(pdf && pdf.length > 1000);
  });

  await cas("rien n'arrive au planning tant qu'il n'a pas accepté", async () => {
    assert.equal(await poserLesPassagesArrives(a.ctx, "2027-04-30"), 0);
  });

  await cas("la réponse ne se donne qu'une fois", async () => {
    const r1 = await repondreAuContrat(jeton, { decision: "accepte", adresseIp: "203.0.113.4", agent: "essai" }, new Date("2027-02-10T10:00:00Z"));
    assert.deepEqual(r1, { ok: true });
    const r2 = await repondreAuContrat(jeton, { decision: "refuse" });
    assert.deepEqual(r2, { ok: false, motif: "deja_repondu" });
    assert.deepEqual(await repondreAuContrat("inconnu", { decision: "accepte" }), { ok: false, motif: "introuvable" });
    const relu = await dernierContratDuClient(a.ctx, a.clientId);
    assert.equal(relu?.statut, "brouillon", "le dernier contrat du client est le brouillon à chiffrer, créé après");
  });

  await cas("les passages arrivent le 20 du mois d'avant, et une seule fois", async () => {
    assert.equal(await poserLesPassagesArrives(a.ctx, "2027-03-19"), 0);
    assert.equal(await poserLesPassagesArrives(a.ctx, "2027-03-20"), 2);
    assert.equal(await poserLesPassagesArrives(a.ctx, "2027-03-20"), 0);
    // Deux arrivées au même instant : l'index unique tranche.
    const [x, y] = await Promise.all([
      poserLesPassagesArrives(a.ctx, "2027-04-20"),
      poserLesPassagesArrives(a.ctx, "2027-04-20"),
    ]);
    assert.equal(x + y, 2);
    // Sous `atlas_app`, sans contexte, la RLS ne montre rien : on le pose,
    // dans une transaction, comme le fait `withEntreprise`.
    const connexion = await pool.connect();
    let rows: { nom: string; contrat_passage: string; date_planifiee: string | null }[] = [];
    try {
      await connexion.query("begin");
      await connexion.query("select set_config('app.entreprise_id', $1, true)", [a.ctx.entrepriseId]);
      ({ rows } = await connexion.query(
        `select nom, contrat_passage, date_planifiee from chantiers where contrat_entretien_id = $1 order by contrat_passage`,
        [contratId]
      ));
      await connexion.query("commit");
    } finally {
      connexion.release();
    }
    assert.equal(rows.length, 4);
    assert.equal(rows[0].nom, "Mme Costa, Tonte et ébarbage");
    assert.equal(rows[0].date_planifiee, null);
  });

  await cas("les passages d'une entreprise ne se posent pas chez l'autre", async () => {
    assert.equal(await poserLesPassagesArrives(b.ctx, "2027-12-31"), 0);
  });

  await pool.end();
  if (echecs > 0) {
    console.error(`\n${echecs} cas en échec.`);
    process.exit(1);
  }
  console.log("\n✅ Les contrats d'entretien tiennent en base.");
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
