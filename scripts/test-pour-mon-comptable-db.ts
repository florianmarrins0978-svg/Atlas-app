import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import { ajouterMouvements, ajouterVirements, confirmerLaLigneRecue, ecarterVirement, virementsDepuis, type MouvementEnBase } from "../src/server/repositories/banque";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import * as devisRepo from "../src/server/repositories/devis";
import * as prixRepo from "../src/server/repositories/lignes-prix";
import { terminerChantier, emettreFacture } from "../src/server/repositories/factures";
import { facturesEnAttente } from "../src/server/repositories/paiements-facture";
import { withEntreprise } from "../src/server/db/with-entreprise";
import { sql } from "drizzle-orm";
import { suiteDeLaPiece } from "../src/lib/pour-mon-comptable";
import { creerAchatTva, supprimerAchatTva } from "../src/server/repositories/achats-tva";
import { ajouterDevisRecu, creerSociete, poserTotauxDuDevisRecu } from "../src/server/repositories/fournisseurs-partenaires";
import {
  appliquerCheckUp,
  delier,
  facturesRecuesLibres,
  joindreFactureHorsAtlas,
  joindreFactureRecue,
  pieceDeLaLigne,
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
//   · une autre entreprise ne voit rien, et ne peut rien relier chez l'autre ;
//   · (0150) une pièce d'un autre montant ne se joint pas sans son accord ;
//     un virement reçu se règle dans sa ligne : facture d'Atlas, facture faite
//     hors d'Atlas, ou ses cinq réponses à lui.

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

async function factureEmise(ctx: Ctx, qui: string, montant: string) {
  const client = await clientsRepo.creerClient(ctx, { nom: qui, telephone: "0612345678" });
  const chantier = await chantiersRepo.creerChantier(ctx, { nom: `Chez ${qui}`, adresseChantier: "5 rue des Lilas", clientId: client.id });
  await prixRepo.ajouterLignePrix(ctx, chantier.id, "Taille de haies", montant);
  const brouillon = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
  await devisRepo.envoyerDevis(ctx, brouillon.id);
  const facture = await terminerChantier(ctx, chantier.id);
  await emettreFacture(ctx, facture.id);
  const enAttente = (await facturesEnAttente(ctx)).find((f) => f.id === facture.id);
  assert.ok(enAttente, "la facture émise n'est pas en attente : le montage ne mesure rien");
  return enAttente;
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
    // Joint quand même malgré l'écart : c'est l'unicité qu'on éprouve ici.
    const r = await relierTicket(ctx, t.id, tInterA, "patron", true);
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

  // ─── 0150 : l'écart de montant, le virement reçu réglé dans sa ligne ──────

  await test("un ticket d'un autre montant ne se relie pas sans son accord, et l'écart reste écrit", async () => {
    await ajouterMouvements(ctx, [sortie("LEROY", "2026-10-23", "48.90")]);
    const tLeroy = await ticket(ctx, "2026-10-22", 52, "LEROY MERLIN");
    const l = await ligne(ctx, "LEROY");
    assert.deepEqual(await relierTicket(ctx, l.id, tLeroy, "patron"), { ok: false, raison: "Pas le même montant.", ecart: { ligne: 4890, piece: 5200 } });
    assert.equal((await ligne(ctx, "LEROY")).justification, null, "le ticket a été relié sans son accord");
    assert.deepEqual(await relierTicket(ctx, l.id, tLeroy, "patron", true), { ok: true });
    const apres = await ligne(ctx, "LEROY");
    assert.equal(apres.justification, "ticket");
    assert.deepEqual(apres.ecart, { genre: "ecart", ligne: 4890, piece: 5200 });
  });

  await test("une facture de fournisseur d'un autre montant demande son accord", async () => {
    await ajouterMouvements(ctx, [sortie("MOTO", "2026-10-24", "1450.00")]);
    const societe = await creerSociete(ctx, "fournisseur", "Motoculture Ouest");
    const f = await ajouterDevisRecu(ctx, societe.id, { nom: "Facture débroussailleuse", fichierCle: `entreprises/${ctx.entrepriseId}/devis/m.pdf`, fichierNom: "m.pdf", nature: "pdf", genre: "facture" });
    await poserTotauxDuDevisRecu(ctx, f.id, { totalHt: "1155.33", totalTtc: "1386.40" });
    const m = await ligne(ctx, "MOTO");
    const r = await joindreFactureRecue(ctx, m.id, f.id);
    assert.equal(r.ok, false);
    assert.deepEqual(!r.ok ? r.ecart : null, { ligne: 145000, piece: 138640 });
    assert.deepEqual(await joindreFactureRecue(ctx, m.id, f.id, true), { ok: true });
    const apres = await ligne(ctx, "MOTO");
    assert.equal(suiteDeLaPiece(apres.ecart, "sortie").includes("pas le montant"), true);
  });

  await test("un virement reçu sans facture d'Atlas se justifie par sa nature, et l'accueil cesse de le demander", async () => {
    await ajouterVirements(ctx, [{ cle: "LALA", date: "2026-10-21", montant: "1200.00", payeur: "LALA", libelle: "VIR LALA" }]);
    const e = (await lignesDuReleve(ctx, "2026-10-21", "2026-10-21"))[0];
    assert.deepEqual(await poserMotif(ctx, e.id, "salaire"), { ok: false, raison: "Dites ce qu'est ce virement." });
    assert.deepEqual(await poserMotif(ctx, e.id, "remboursement"), { ok: true });
    const apres = (await lignesDuReleve(ctx, "2026-10-21", "2026-10-21"))[0];
    assert.equal(apres.motif, "remboursement");
    assert.equal(ligneAJustifier(apres), false);
    const [v] = (await virementsDepuis(ctx, "2026-10-21")).filter((x) => x.libelle === "VIR LALA");
    assert.equal(v?.etat, "ecarte", "l'accueil demanderait encore quelle facture ce remboursement paie");
  });

  await test("une réponse de virement reçu ne s'écrit pas sur une sortie", async () => {
    const m = await ligne(ctx, "LEROY");
    assert.deepEqual(await poserMotif(ctx, m.id, "remboursement"), { ok: false, raison: "Dites ce qu'est ce virement." });
  });

  await test("une facture faite hors d'Atlas justifie un virement reçu, avec son accord quand le montant diffère", async () => {
    await ajouterMouvements(ctx, [{ cle: "COSTA", date: "2026-10-24", montant: "864.00", sens: "entree", contrepartie: "MME COSTA", libelle: "VIR MME COSTA" }]);
    const c = (await lignesDuReleve(ctx, "2026-10-24", "2026-10-24")).find((x) => x.sens === "entree");
    assert.ok(c, "la ligne de Mme Costa est introuvable : le montage ne mesure rien");
    const piece = { cle: `entreprises/${ctx.entrepriseId}/factures-hors-atlas/costa.jpg`, nature: "photo" as const, total: "1728.00" };
    assert.deepEqual(await joindreFactureHorsAtlas(ctx, c.id, piece), { ok: false, raison: "Pas le même montant.", ecart: { ligne: 86400, piece: 172800 } });
    assert.deepEqual(await joindreFactureHorsAtlas(ctx, c.id, piece, true), { ok: true });
    const apres = (await lignesDuReleve(ctx, "2026-10-24", "2026-10-24")).find((x) => x.id === c.id)!;
    assert.equal(apres.justification, "facture_hors_atlas");
    assert.equal(ligneAJustifier(apres), false);
    assert.equal(suiteDeLaPiece(apres.ecart, "entree"), ", payée en partie");
    assert.deepEqual(pieceDeLaLigne(apres), { cle: piece.cle, nature: "photo" });
  });

  await test("une facture faite hors d'Atlas remplacée rend son fichier, pour qu'il ne reste rien", async () => {
    const c = (await lignesDuReleve(ctx, "2026-10-24", "2026-10-24")).find((x) => x.sens === "entree")!;
    assert.deepEqual(await poserMotif(ctx, c.id, "aide"), { ok: true, pieceRetiree: `entreprises/${ctx.entrepriseId}/factures-hors-atlas/costa.jpg` });
    const apres = (await lignesDuReleve(ctx, "2026-10-24", "2026-10-24")).find((x) => x.id === c.id)!;
    assert.equal(apres.pieceJointe, null);
    assert.deepEqual(await delier(ctx, c.id), { ok: true });
  });

  await test("une facture faite hors d'Atlas ne justifie pas une sortie", async () => {
    const m = await ligne(ctx, "LEROY");
    const r = await joindreFactureHorsAtlas(ctx, m.id, { cle: `entreprises/${ctx.entrepriseId}/factures-hors-atlas/x.pdf`, nature: "pdf", total: "48.90" });
    assert.equal(r.ok, false);
  });

  await test("la base refuse une facture faite hors d'Atlas sans son fichier", async () => {
    const c = (await lignesDuReleve(ctx, "2026-10-24", "2026-10-24")).find((x) => x.sens === "entree")!;
    await assert.rejects(
      withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
        tx.execute(sql`UPDATE mouvements_bancaires SET justification = 'facture_hors_atlas', relie_par = 'patron' WHERE id = ${c.id}`)
      ),
      (err: unknown) => ((err as { cause?: { code?: string }; code?: string }).cause?.code ?? (err as { code?: string }).code) === "23514"
    );
  });

  await test("un virement reçu se confirme depuis sa ligne, même quand l'accueil n'en demande rien", async () => {
    const facture = await factureEmise(ctx, "M. Morin", "1000.00");
    const moitie = (Math.round(Number(facture.reste) * 50) / 100).toFixed(2);
    // Le jour de la facture : un règlement ne la précède jamais (`noterPaiementDans`).
    const jour = facture.dateEmission;
    await ajouterMouvements(ctx, [{ cle: "MORIN", date: jour, montant: moitie, sens: "entree", contrepartie: "M MORIN", libelle: "VIR M MORIN ACOMPTE" }]);
    // Un « non » donné sur l'accueil ne ferme pas la porte.
    await ajouterVirements(ctx, [{ cle: "MORIN", date: jour, montant: moitie, payeur: "M MORIN", libelle: "VIR M MORIN ACOMPTE" }]);
    const [v] = (await virementsDepuis(ctx, jour)).filter((x) => x.libelle === "VIR M MORIN ACOMPTE");
    assert.equal((await ecarterVirement(ctx, v.id)).ok, true);
    const m = (await lignesDuReleve(ctx, jour, jour)).find((x) => x.libelle === "VIR M MORIN ACOMPTE")!;

    const r = await confirmerLaLigneRecue(autre, m.id, facture.id, moitie);
    assert.equal(r.ok, false, "une autre entreprise a confirmé une ligne qui n'est pas la sienne");

    assert.equal((await confirmerLaLigneRecue(ctx, m.id, facture.id, moitie)).ok, true);
    const apres = (await lignesDuReleve(ctx, jour, jour)).find((x) => x.id === m.id)!;
    assert.equal(apres.factureEmise?.numero, facture.numeroCommercial);
    assert.equal(ligneAJustifier(apres), false);
    assert.equal(suiteDeLaPiece(apres.ecart, "entree"), ", payée en partie");
    const reste = (await facturesEnAttente(ctx)).find((f) => f.id === facture.id)?.reste;
    assert.equal(Number(reste), Number(facture.reste) - Number(moitie), "le paiement n'a pas été noté sur la facture");

    assert.equal((await confirmerLaLigneRecue(ctx, m.id, facture.id, moitie)).ok, false, "le même virement a payé deux fois");
    assert.deepEqual(await poserMotif(ctx, m.id, "pret"), { ok: false, raison: "Ce virement paie déjà une facture d'Atlas." });
  });

  await test("un virement reçu se confirme même sans virement en attente sur l'accueil", async () => {
    const facture = await factureEmise(ctx, "M. Petit", "300.00");
    const jour = facture.dateEmission;
    await ajouterMouvements(ctx, [{ cle: "PETIT", date: jour, montant: facture.reste, sens: "entree", contrepartie: "M PETIT", libelle: "VIR M PETIT" }]);
    const p = (await lignesDuReleve(ctx, jour, jour)).find((x) => x.libelle === "VIR M PETIT")!;
    assert.equal((await confirmerLaLigneRecue(ctx, p.id, facture.id, facture.reste)).ok, true);
    const apres = (await lignesDuReleve(ctx, jour, jour)).find((x) => x.id === p.id)!;
    assert.deepEqual(apres.ecart, { genre: "juste" });
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
