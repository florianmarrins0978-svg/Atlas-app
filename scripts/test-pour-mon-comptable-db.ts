import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import { ajouterMouvements, type MouvementEnBase } from "../src/server/repositories/banque";
import { creerAchatTva, supprimerAchatTva } from "../src/server/repositories/achats-tva";
import { ajouterDevisRecu, creerSociete } from "../src/server/repositories/fournisseurs-partenaires";
import {
  appliquerCheckUp,
  delier,
  facturesRecuesLibres,
  joindreFactureRecue,
  ligneAJustifier,
  lignesDuReleve,
  marquerTicketPerdu,
  poserMotif,
  relierTicket,
  ticketsLibres,
} from "../src/server/repositories/pour-mon-comptable";
import { fermerLimiteur } from "../src/server/rate-limit";
import { nettoyerBase } from "./_test-db";

// ═══════════════════════════════════════════════════════════════════════════
// POUR MON COMPTABLE, LOT 2 — ce qui justifie une ligne (migration 0143)
// ═══════════════════════════════════════════════════════════════════════════
//
// **Une suite BASE, sous `atlas_app`** (`CLAUDE.md` §5). Ce qu'elle défend :
//   · le Check up relie seul un ticket qui tombe juste, demande entre deux,
//     prévient quand il n'y en a aucun ;
//   · un ticket ne justifie qu'une seule ligne ;
//   · un lien posé par le patron n'est jamais réécrit par le Check up ;
//   · ticket perdu, facture jointe, motif, et « défaire » qui rend la ligne ;
//   · un ticket effacé rend sa ligne « à justifier » sans être refusé ;
//   · une autre entreprise ne voit rien, et ne peut rien relier chez l'autre.

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
    { nom: `Atelier Comptable ${suffixe}` },
    { email: `comptable-${suffixe}-${Date.now()}@t.test` }
  );
  return { utilisateurId, entrepriseId: entreprise.id };
}

const sortie = (cle: string, jour: string, montant: string, libelle = `CB ${cle}`): MouvementEnBase => ({
  cle,
  date: jour,
  montant,
  sens: "sortie",
  contrepartie: null,
  libelle,
});

async function ticket(ctx: Ctx, dateAchat: string, totalTtc: number, fournisseur = "TOTALENERGIES") {
  const t = await creerAchatTva(ctx, { dateAchat, fournisseur, totalTtc, tauxTva: 20, tvaTicket: 1, nature: "carburant", vehicule: "utilitaire", saisie: "main" });
  return t.id as string;
}

async function ligne(ctx: Ctx, cle: string) {
  const l = (await lignesDuReleve(ctx, "2000-01-01", "2100-01-01")).find((x) => x.libelle === `CB ${cle}` || x.id === cle);
  assert.ok(l, `la ligne ${cle} est introuvable : le montage ne mesure rien`);
  return l;
}

async function main() {
  await nettoyerBase();
  const ctx = await contexte("a");
  const autre = await contexte("b");

  await ajouterMouvements(ctx, [
    sortie("KILOU", "2026-10-16", "1194.00"),
    sortie("INTER", "2026-10-18", "23.80"),
    sortie("TOTAL", "2026-10-14", "62.40"),
    { cle: "LALA", date: "2026-10-21", montant: "1200.00", sens: "entree", contrepartie: "LALA", libelle: "VIR LALA" },
  ]);
  const tKilou = await ticket(ctx, "2026-10-15", 1194, "KILOUTOU");
  const tInterA = await ticket(ctx, "2026-10-17", 23.8, "INTERMARCHE");
  const tInterB = await ticket(ctx, "2026-10-14", 23.8, "INTERMARCHE");

  await test("le Check up relie seul le ticket qui tombe juste, et dit que c'est lui", async () => {
    const b = await appliquerCheckUp(ctx, "2026-10-01", "2026-10-31");
    assert.equal(b.vues, 3);
    const k = await ligne(ctx, "KILOU");
    assert.equal(b.relies.includes(k.id), true);
    assert.equal(k.justification, "ticket");
    assert.equal(k.reliePar, "atlas");
    assert.equal(k.ticket?.id, tKilou);
    assert.equal(k.ticket?.nature, "carburant");
  });

  await test("deux tickets possibles : il demande, sans rien relier", async () => {
    const i = await ligne(ctx, "INTER");
    assert.equal(i.justification, null);
    const b = await appliquerCheckUp(ctx, "2026-10-01", "2026-10-31");
    assert.deepEqual([...(b.choix.get(i.id) ?? [])].sort(), [tInterA, tInterB].sort());
  });

  await test("aucun ticket : il prévient", async () => {
    const t = await ligne(ctx, "TOTAL");
    const b = await appliquerCheckUp(ctx, "2026-10-01", "2026-10-31");
    assert.ok(b.aucun.includes(t.id));
  });

  await test("une ligne déjà justifiée n'est plus passée en revue", async () => {
    const b = await appliquerCheckUp(ctx, "2026-10-01", "2026-10-31");
    assert.equal(b.vues, 2);
  });

  await test("le patron choisit, et le ticket choisi n'est plus libre", async () => {
    const i = await ligne(ctx, "INTER");
    assert.deepEqual(await relierTicket(ctx, i.id, tInterA, "patron"), { ok: true });
    const libres = await ticketsLibres(ctx, "2026-10-01", "2026-10-31");
    assert.equal(libres.some((t) => t.id === tInterA), false);
    assert.equal(libres.some((t) => t.id === tInterB), true);
  });

  await test("un ticket ne justifie qu'une seule ligne", async () => {
    const t = await ligne(ctx, "TOTAL");
    const r = await relierTicket(ctx, t.id, tInterA, "patron");
    assert.equal(r.ok, false);
    assert.match(!r.ok ? r.raison : "", /justifie déjà une autre ligne/);
  });

  await test("le Check up ne réécrit jamais un choix du patron", async () => {
    const i = await ligne(ctx, "INTER");
    const r = await relierTicket(ctx, i.id, tInterB, "atlas");
    assert.equal(r.ok, false);
    assert.equal((await ligne(ctx, "INTER")).ticket?.id, tInterA);
  });

  await test("défaire rend la ligne à justifier et le ticket libre", async () => {
    const k = await ligne(ctx, "KILOU");
    assert.deepEqual(await delier(ctx, k.id), { ok: true });
    const apres = await ligne(ctx, "KILOU");
    assert.equal(apres.justification, null);
    assert.equal(apres.reliePar, null);
    assert.equal(ligneAJustifier(apres), true);
    assert.ok((await ticketsLibres(ctx, "2026-10-01", "2026-10-31")).some((t) => t.id === tKilou));
  });

  await test("ticket perdu : validée avec la mention, et plus à justifier", async () => {
    const t = await ligne(ctx, "TOTAL");
    assert.deepEqual(await marquerTicketPerdu(ctx, t.id), { ok: true });
    const apres = await ligne(ctx, "TOTAL");
    assert.equal(apres.justification, "ticket_perdu");
    assert.equal(ligneAJustifier(apres), false);
  });

  await test("un virement envoyé se justifie par une facture de fournisseur, qui n'est plus libre ensuite", async () => {
    await ajouterMouvements(ctx, [sortie("DURAND", "2026-10-24", "1740.00", "VIR SEPA PEPINIERES DURAND")]);
    const societe = await creerSociete(ctx, "fournisseur", "Pépinières Durand");
    const f = await ajouterDevisRecu(ctx, societe.id, { nom: "Facture 2026-418", fichierCle: `entreprises/${ctx.entrepriseId}/devis/x.pdf`, fichierNom: "x.pdf", nature: "pdf", genre: "facture" });
    const d = (await lignesDuReleve(ctx, "2026-10-24", "2026-10-24"))[0];
    assert.equal((await facturesRecuesLibres(ctx)).length, 1);
    assert.deepEqual(await joindreFactureRecue(ctx, d.id, f.id), { ok: true });
    const apres = (await lignesDuReleve(ctx, "2026-10-24", "2026-10-24"))[0];
    assert.equal(apres.justification, "facture");
    assert.equal(apres.factureRecue?.societe, "Pépinières Durand");
    assert.equal((await facturesRecuesLibres(ctx)).length, 0);
  });

  await test("un virement sans facture se justifie par sa nature", async () => {
    await ajouterMouvements(ctx, [sortie("URSSAF", "2026-10-25", "230.00", "PRLV URSSAF")]);
    const u = (await lignesDuReleve(ctx, "2026-10-25", "2026-10-25"))[0];
    assert.deepEqual(await poserMotif(ctx, u.id, "impots"), { ok: true });
    const apres = (await lignesDuReleve(ctx, "2026-10-25", "2026-10-25"))[0];
    assert.equal(apres.justification, "motif");
    assert.equal(apres.motif, "impots");
  });

  await test("un ticket effacé rend sa ligne à justifier, et l'effacement n'est pas refusé", async () => {
    const i = await ligne(ctx, "INTER");
    assert.ok(await supprimerAchatTva(ctx, tInterA), "l'effacement du ticket a été refusé");
    const apres = await ligne(ctx, "INTER");
    assert.equal(apres.justification, null);
    assert.equal(apres.ticket, null);
    assert.equal(ligneAJustifier(apres), true);
    assert.equal(i.justification, "ticket");
  });

  await test("une entrée sans facture confirmée reste à justifier", async () => {
    const e = (await lignesDuReleve(ctx, "2026-10-21", "2026-10-21"))[0];
    assert.equal(e.sens, "entree");
    assert.equal(ligneAJustifier(e), true);
  });

  await test("une autre entreprise ne voit aucune ligne ni aucun ticket", async () => {
    assert.equal((await lignesDuReleve(autre, "2000-01-01", "2100-01-01")).length, 0);
    assert.equal((await ticketsLibres(autre, "2000-01-01", "2100-01-01")).length, 0);
    assert.equal((await facturesRecuesLibres(autre)).length, 0);
  });

  await test("une autre entreprise ne peut justifier aucune ligne de la première", async () => {
    const t = await ligne(ctx, "KILOU");
    const r = await marquerTicketPerdu(autre, t.id);
    assert.equal(r.ok, false);
    assert.equal((await ligne(ctx, "KILOU")).justification, null);
  });

  await test("un ticket de la première ne peut pas justifier une ligne de l'autre", async () => {
    await ajouterMouvements(autre, [sortie("AUTRE", "2026-10-16", "1194.00")]);
    const sienne = (await lignesDuReleve(autre, "2026-10-16", "2026-10-16"))[0];
    const r = await relierTicket(autre, sienne.id, tKilou, "patron");
    assert.deepEqual(r, { ok: false, raison: "Cette pièce n'existe pas." });
    assert.equal((await lignesDuReleve(autre, "2026-10-16", "2026-10-16"))[0].justification, null);
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
