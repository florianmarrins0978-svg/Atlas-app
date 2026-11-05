import assert from "node:assert";
import { eq } from "drizzle-orm";
import { pool } from "../src/server/db/client";
import { withEntreprise, AccesRefuseError, LectureSeuleError } from "../src/server/db/with-entreprise";
import {
  clients as clientsTable,
  devis as devisTable,
  factures as facturesTable,
} from "../src/server/db/schema";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import * as devisRepo from "../src/server/repositories/devis";
import * as facturesRepo from "../src/server/repositories/factures";
import * as lignesPrixRepo from "../src/server/repositories/lignes-prix";
import { creerEnvoi, enregistrerReponse } from "../src/server/repositories/envois-devis";
import { donnerUnAcces } from "../src/server/repositories/membres-entreprise";
import {
  effacerLeResteDesComptesFermes,
  lireLaFermeture,
  programmerLaFermeture,
  retirerLaFermeture,
} from "../src/server/repositories/fermeture-compte";
import { versJourIso, ajouterJours } from "../src/lib/disponibilites";
import { nettoyerBase } from "./_test-db";

// ═══════════════════════════════════════════════════════════════════════════
// FERMER SON COMPTE, EN BASE — sous `atlas_app`, donc sous la RLS
// ═══════════════════════════════════════════════════════════════════════════
//
// Ses décisions du 5 novembre 2026 (`docs/QUESTIONS.md`, question 33).
//
// **Éprouvé sur une base HABITÉE** (`.claude/rules/migrations.md`) : le compte
// fermé porte une facture émise, un devis accepté, un devis envoyé jamais
// accepté, un brouillon ; un second compte, ouvert, porte les mêmes pièces.
// La purge écrit sur des tables sous FORCE RLS sans session : ce contrôle
// PROUVE qu'elle y voit des lignes (invariant 7 de `CLAUDE.md`), en comptant
// ce qui est parti, et pas seulement ce qui reste.

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

const JOUR = 86_400_000;
const MAINTENANT = new Date();
const ilYA = (jours: number) => new Date(MAINTENANT.getTime() - jours * JOUR);
type Ctx = { utilisateurId: string; entrepriseId: string };

async function contexte(suffixe: string): Promise<Ctx> {
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: `Atelier ${suffixe}` },
    { email: `fermer-${suffixe}-${Date.now()}@t.test` }
  );
  return { utilisateurId, entrepriseId: entreprise.id };
}

/** Un compte rempli comme un vrai : ce que la loi garde, et ce qui part. */
async function remplir(ctx: Ctx) {
  const facture = await clientsRepo.creerClient(ctx, { nom: "M. Vasseur", telephone: "0622000022" });
  const ch1 = await chantiersRepo.creerChantier(ctx, { nom: "Terrasse", clientId: facture.id });
  await lignesPrixRepo.ajouterLignePrix(ctx, ch1.id, "Dallage", "900.00");
  const d1 = await devisRepo.getOuCreerDevisBrouillon(ctx, ch1.id);
  await devisRepo.envoyerDevis(ctx, d1.id);
  await facturesRepo.terminerChantier(ctx, ch1.id, ilYA(60));
  const f = await facturesRepo.getFacturePourChantier(ctx, ch1.id);
  assert.ok(f, "le montage n'a pas produit de facture : il n'y aurait rien à mesurer");
  await facturesRepo.emettreFacture(ctx, f.facture.id, ilYA(60));

  const accepte = await clientsRepo.creerClient(ctx, { nom: "Mme Costa", telephone: "0655443322" });
  const ch2 = await chantiersRepo.creerChantier(ctx, { nom: "Muret", clientId: accepte.id });
  const d2 = await devisRepo.getOuCreerDevisBrouillon(ctx, ch2.id);
  const envoi = await creerEnvoi(
    ctx,
    { chantierId: ch2.id, devisId: d2.id, canal: "sms", datesProposees: [versJourIso(ajouterJours(ilYA(50), 10))], contenuDevis: "devis" },
    ilYA(50)
  );
  await enregistrerReponse(
    envoi.jeton,
    { decision: "accepte" as const, demarrageAnticipe: true, dateRetenue: versJourIso(ajouterJours(ilYA(50), 10)) },
    ilYA(50)
  );

  const jamais = await clientsRepo.creerClient(ctx, { nom: "M. Prospect", telephone: "0611111111" });
  const ch3 = await chantiersRepo.creerChantier(ctx, { nom: "Haie", clientId: jamais.id });
  await lignesPrixRepo.ajouterLignePrix(ctx, ch3.id, "Taille", "300.00");
  const d3 = await devisRepo.getOuCreerDevisBrouillon(ctx, ch3.id);
  await devisRepo.envoyerDevis(ctx, d3.id);

  const brouillon = await clientsRepo.creerClient(ctx, { nom: "Mme Brouillon" });
  const ch4 = await chantiersRepo.creerChantier(ctx, { nom: "Gazon", clientId: brouillon.id });
  await devisRepo.getOuCreerDevisBrouillon(ctx, ch4.id);

  return { factureId: f.facture.id, devisAccepteId: d2.id, devisJamaisId: d3.id, clients: { facture, accepte, jamais, brouillon } };
}

async function compter(ctx: Ctx) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => ({
    clients: (await tx.select({ id: clientsTable.id, nom: clientsTable.nom, telephone: clientsTable.telephone }).from(clientsTable)),
    devis: (await tx.select({ id: devisTable.id }).from(devisTable)).map((d) => d.id),
    factures: (await tx.select({ id: facturesTable.id, statut: facturesTable.statut }).from(facturesTable)),
  }));
}

/** La fermeture posée dans le passé, comme si les jours avaient passé. */
async function fermerIlYA(ctx: Ctx, jours: number) {
  await programmerLaFermeture(ctx, ilYA(jours), ilYA(jours + 1));
}

async function idDe(email: string): Promise<string> {
  const { rows } = await pool.query<{ id: string }>("SELECT id FROM users WHERE email = $1", [email]);
  assert.ok(rows[0], `utilisateur ${email} introuvable`);
  return rows[0].id;
}

async function main() {
  await nettoyerBase();

  await test("une fermeture DEMANDÉE ne ferme rien : il écrit jusqu'à la fin de ce qui est payé", async () => {
    const ctx = await contexte("programmee");
    await programmerLaFermeture(ctx, new Date(MAINTENANT.getTime() + 20 * JOUR), MAINTENANT);
    const { etat } = await lireLaFermeture(ctx);
    assert.equal(etat.statut, "programmee");
    const c = await clientsRepo.creerClient(ctx, { nom: "Encore permis" });
    assert.ok(c.id, "l'écriture a été refusée avant l'échéance");
  });

  await test("fermé : le patron lit, rien ne s'écrit", async () => {
    const ctx = await contexte("lecture");
    await clientsRepo.creerClient(ctx, { nom: "Avant" });
    await fermerIlYA(ctx, 1);
    const lu = await compter(ctx);
    assert.equal(lu.clients.length, 1, "le patron doit encore lire ses données");
    await assert.rejects(() => clientsRepo.creerClient(ctx, { nom: "Après" }), LectureSeuleError);
  });

  await test("fermé : un salarié n'entre plus, avant la fermeture il entrait", async () => {
    const ctx = await contexte("salarie");
    const email = `salarie-fermeture-${Date.now()}@t.test`;
    const r = await donnerUnAcces(ctx, { nom: "Julien", email, motDePasse: "motdepasse-douze", confirmation: "motdepasse-douze", role: "salarie" });
    assert.equal(r.ok, true, "le montage n'a pas donné d'accès");
    const salarie = { utilisateurId: await idDe(email), entrepriseId: ctx.entrepriseId };
    await withEntreprise(salarie.utilisateurId, salarie.entrepriseId, async () => undefined);
    await fermerIlYA(ctx, 1);
    await assert.rejects(() => withEntreprise(salarie.utilisateurId, salarie.entrepriseId, async () => undefined), AccesRefuseError);
  });

  await test("rouvrir un compte fermé sans abonnement : il écrit de nouveau", async () => {
    const ctx = await contexte("rouvrir");
    await fermerIlYA(ctx, 2);
    const { etat, aUneLigneDAbonnement } = await lireLaFermeture(ctx);
    assert.equal(etat.statut, "fermee");
    assert.equal(aUneLigneDAbonnement, false);
    await retirerLaFermeture(ctx);
    assert.equal((await lireLaFermeture(ctx)).etat.statut, "ouvert");
    assert.ok((await clientsRepo.creerClient(ctx, { nom: "De retour" })).id);
  });

  // ─── L'EFFACEMENT DU RESTE, SUR UNE BASE HABITÉE ─────────────────────────
  const ferme = await contexte("efface");
  const ouvert = await contexte("voisin");
  const dansFerme = await remplir(ferme);
  await remplir(ouvert);
  const avant = await compter(ferme);
  const voisinAvant = await compter(ouvert);

  await test("le montage porte bien de quoi mesurer", async () => {
    assert.equal(avant.clients.length, 4);
    assert.ok(avant.devis.length >= 4, `devis : ${avant.devis.length}`);
    assert.equal(avant.factures.filter((f) => f.statut === "emise").length, 1);
  });

  await test("vingt-neuf jours après la fermeture, rien ne part", async () => {
    await fermerIlYA(ferme, 29);
    const r = await effacerLeResteDesComptesFermes(MAINTENANT);
    assert.equal(r.comptesEffaces, 0);
    assert.deepEqual((await compter(ferme)).devis.sort(), avant.devis.sort());
  });

  await test("trente jours après : le reste part, la facture et le devis accepté restent", async () => {
    await fermerIlYA(ferme, 31);
    const r = await effacerLeResteDesComptesFermes(MAINTENANT);
    assert.equal(r.comptesEffaces, 1, "le compte fermé n'a pas été traité");
    assert.equal(r.clientsEffaces, 4, "la purge n'a pas VU les clients : la RLS l'aveuglait");

    const apres = await compter(ferme);
    assert.equal(apres.factures.length, avant.factures.length, "une facture a disparu");
    assert.ok(apres.devis.includes(dansFerme.devisAccepteId), "le devis accepté a disparu");
    assert.ok(!apres.devis.includes(dansFerme.devisJamaisId), "le devis jamais accepté est resté");
    assert.ok(apres.devis.length < avant.devis.length, "aucun devis n'est parti : la purge n'a rien fait");

    const noms = apres.clients.map((c) => c.nom).sort();
    assert.deepEqual(noms, ["M. Vasseur", "Mme Costa"], `clients restants : ${noms.join(", ")}`);
    for (const c of apres.clients) assert.equal(c.telephone, null, `${c.nom} garde de quoi être recontacté`);
  });

  await test("archivé : la date est posée, et rien ne repasse", async () => {
    const { etat } = await lireLaFermeture(ferme);
    assert.equal(etat.statut, "archivee");
    const r = await effacerLeResteDesComptesFermes(new Date(MAINTENANT.getTime() + 400 * JOUR));
    assert.equal(r.comptesEffaces, 0);
  });

  await test("le patron lit toujours ses pièces gardées", async () => {
    const lu = await compter(ferme);
    assert.equal(lu.factures.length, 1);
  });

  await test("le compte voisin, ouvert, n'a rien perdu", async () => {
    const voisin = await compter(ouvert);
    assert.equal(voisin.clients.length, voisinAvant.clients.length);
    assert.deepEqual(voisin.devis.sort(), voisinAvant.devis.sort());
  });

  await test("la colonne d'effacement est bien celle du compte fermé, et de lui seul", async () => {
    const { rows } = await pool.query<{ id: string; reste: Date | null }>(
      "SELECT id, reste_efface_le AS reste FROM entreprises WHERE id = ANY($1)",
      [[ferme.entrepriseId, ouvert.entrepriseId]]
    );
    const parId = new Map(rows.map((r) => [r.id, r.reste]));
    assert.ok(parId.get(ferme.entrepriseId));
    assert.equal(parId.get(ouvert.entrepriseId), null);
  });

  // La facture émise est clouée par la base : la purge ne l'a pas contournée.
  await test("la facture émise garde son statut", async () => {
    const lu = await withEntreprise(ferme.utilisateurId, ferme.entrepriseId, async (tx) =>
      tx.select({ statut: facturesTable.statut }).from(facturesTable).where(eq(facturesTable.id, dansFerme.factureId))
    );
    assert.equal(lu[0]?.statut, "emise");
  });

  console.log(`\n${passed} réussi(s), ${failed} échec(s)`);
  await pool.end();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
