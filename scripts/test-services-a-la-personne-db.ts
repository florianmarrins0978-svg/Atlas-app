import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import { pool } from "../src/server/db/client";
import { withEntreprise } from "../src/server/db/with-entreprise";
import { avoirs, devis, entreprises, equipes, factures } from "../src/server/db/schema";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import * as devisRepo from "../src/server/repositories/devis";
import * as prixRepo from "../src/server/repositories/lignes-prix";
import { nommerEquipe } from "../src/server/repositories/equipes";
import {
  emettreFacture,
  majServicesALaPersonneFacture,
  terminerChantier,
} from "../src/server/repositories/factures";
import { faireUnAvoir } from "../src/server/repositories/avoirs";
import {
  compteDeLActiviteACote,
  numerosDesIntervenants,
  reglerServicesALaPersonne,
} from "../src/server/repositories/services-a-la-personne";
import { saisieServicesALaPersonneLue } from "../src/lib/services-a-la-personne";
import { fermerLimiteur } from "../src/server/rate-limit";
import { nettoyerBase } from "./_test-db";
import { texteDuPdf } from "./_lecteur-pdf-protege";

/**
 * LES SERVICES À LA PERSONNE EN BASE, sous `atlas_app` (migration 0178).
 *
 * Les deux suites pures tiennent la règle et le papier ; celle-ci tient le
 * CHEMIN du patron (`CLAUDE.md` §5 quater) : il règle Mon entreprise, rédige
 * un devis, l'envoie, finit le chantier, et la facture reprend la case. Puis
 * ce qui ne doit jamais arriver : une case qui bouge sur une pièce partie, un
 * numéro d'intervenant redonné, une entreprise qui voit ou touche celle d'à
 * côté.
 *
 * **Sous le rôle applicatif**, comme toute suite base : c'est lui qui porte
 * la RLS, et le déclencheur des numéros écrit sur `entreprises` depuis une
 * ligne d'`equipes` sous FORCE RLS.
 */

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

async function contexte(nom: string): Promise<Ctx> {
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom },
    { email: `sap-${nom.replace(/\W/g, "").toLowerCase()}-${Date.now()}@t.test`, nom: "Patron" }
  );
  return { utilisateurId, entrepriseId: entreprise.id };
}

/** Les réglages passent par la règle de l'écran, comme l'action. */
async function declarer(ctx: Ctx, activiteACote = false) {
  const lue = saisieServicesALaPersonneLue(
    { declaree: true, numero: "sap 123 456 789", declareeLe: "2024-03-12", activiteACote },
    "2026-11-08"
  );
  assert.ok(lue.ok, "la saisie de référence est refusée");
  if (lue.ok) await reglerServicesALaPersonne(ctx, lue.valeurs);
}

/** Un chantier chiffré, son client, et son devis brouillon. */
async function devisPour(ctx: Ctx, client: { nom: string; civilite?: "mr" | "mme" | "entreprise" }, montant = "100.00") {
  const c = await clientsRepo.creerClient(ctx, { nom: client.nom, civilite: client.civilite, telephone: "0612345678" });
  const chantier = await chantiersRepo.creerChantier(ctx, {
    nom: `Chez ${client.nom}`,
    adresseChantier: "12 rue des Lilas, Rezé",
    clientId: c.id,
  });
  await prixRepo.ajouterLignePrix(ctx, chantier.id, "Taille des haies", montant);
  const brouillon = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
  return { chantier, brouillon };
}

async function ligneDevis(ctx: Ctx, id: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [d] = await tx.select().from(devis).where(eq(devis.id, id)).limit(1);
    return d;
  });
}

async function ligneFacture(ctx: Ctx, id: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [f] = await tx.select().from(factures).where(eq(factures.id, id)).limit(1);
    return f;
  });
}

async function numeroDuRang(ctx: Ctx, rang: number) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [l] = await tx
      .select({ numero: equipes.numeroIntervenant })
      .from(equipes)
      .where(and(eq(equipes.entrepriseId, ctx.entrepriseId), eq(equipes.rang, rang)))
      .limit(1);
    return l?.numero ?? null;
  });
}

const texte = (octets: Uint8Array) => texteDuPdf(octets).replace(/\s+/g, " ");

async function main() {
  await nettoyerBase();
  const a = await contexte("Jardins Atlas");
  const b = await contexte("Paysages Voisins");

  // ─── 1. Mon entreprise ────────────────────────────────────────────────────

  await test("les réglages s'enregistrent, le numéro rangé en capitales collées", async () => {
    await declarer(a);
    const e = await entreprisesRepo.getEntreprise(a);
    assert.equal(e?.sapDeclaree, true);
    assert.equal(e?.sapNumero, "SAP123456789");
    assert.equal(e?.sapDeclareeLe, "2024-03-12");
    assert.equal(e?.sapActiviteACote, false);
  });

  await test("une case vidée efface, elle ne laisse pas l'ancienne valeur", async () => {
    const lue = saisieServicesALaPersonneLue({ declareeLe: "" }, "2026-11-08");
    assert.ok(lue.ok);
    if (lue.ok) await reglerServicesALaPersonne(a, lue.valeurs);
    assert.equal((await entreprisesRepo.getEntreprise(a))?.sapDeclareeLe, null);
    await declarer(a);
  });

  await test("la base refuse un numéro faux écrit sans passer par la règle", async () => {
    await assert.rejects(
      withEntreprise(a.utilisateurId, a.entrepriseId, (tx) =>
        tx.update(entreprises).set({ sapNumero: "SAP12" }).where(eq(entreprises.id, a.entrepriseId))
      ),
      "entreprises_sap_numero_ck n'a pas refusé « SAP12 »"
    );
  });

  await test("ISOLATION : l'entreprise voisine n'est ni déclarée ni numérotée par la mienne", async () => {
    const e = await entreprisesRepo.getEntreprise(b);
    assert.equal(e?.sapDeclaree, false);
    assert.equal(e?.sapNumero, null);
  });

  // ─── 2. La case, du devis à la facture ────────────────────────────────────

  let factureSap = "";
  let chantierSap = "";
  await test("un devis neuf pour un particulier d'une entreprise déclarée part coché", async () => {
    const { chantier, brouillon } = await devisPour(a, { nom: "Lambert", civilite: "mr" });
    chantierSap = chantier.id;
    assert.equal((await ligneDevis(a, brouillon.id))?.servicesALaPersonne, true);
  });

  await test("le PDF du devis coché porte la mention ; décoché, il ne la porte plus", async () => {
    const d = await devisRepo.getOuCreerDevisBrouillon(a, chantierSap);
    assert.ok(texte(await devisRepo.genererPdfPourApercu(a, d.id)).includes("Déclaration SAP123456789"));
    const r = await devisRepo.majServicesALaPersonneDevis(a, chantierSap, false);
    assert.deepEqual(r, { ok: true, servicesALaPersonne: false });
    assert.ok(!texte(await devisRepo.genererPdfPourApercu(a, d.id)).includes("199 sexdecies"));
    await devisRepo.majServicesALaPersonneDevis(a, chantierSap, true);
  });

  await test("la régénération du brouillon garde la case", async () => {
    await prixRepo.ajouterLignePrix(a, chantierSap, "Tonte", "50.00");
    const d = await devisRepo.getOuCreerDevisBrouillon(a, chantierSap);
    assert.equal((await ligneDevis(a, d.id))?.servicesALaPersonne, true);
  });

  await test("LA FACTURE REPREND LA CASE DU DEVIS ENVOYÉ", async () => {
    const d = await devisRepo.getOuCreerDevisBrouillon(a, chantierSap);
    await devisRepo.envoyerDevis(a, d.id);
    const f = await terminerChantier(a, chantierSap);
    factureSap = f.id;
    assert.equal((await ligneFacture(a, f.id))?.servicesALaPersonne, true);
  });

  await test("un devis parti ne change plus de case", async () => {
    const r = await devisRepo.majServicesALaPersonneDevis(a, chantierSap, false);
    assert.equal(r.ok, false);
  });

  await test("ISOLATION : l'entreprise voisine ne touche pas la case de ma facture", async () => {
    const r = await majServicesALaPersonneFacture(b, factureSap, false);
    assert.equal(r.ok, false);
    assert.equal((await ligneFacture(a, factureSap))?.servicesALaPersonne, true);
  });

  await test("la facture brouillon se décoche et se recoche", async () => {
    assert.deepEqual(await majServicesALaPersonneFacture(a, factureSap, false), { ok: true, servicesALaPersonne: false });
    assert.equal((await ligneFacture(a, factureSap))?.servicesALaPersonne, false);
    assert.deepEqual(await majServicesALaPersonneFacture(a, factureSap, true), { ok: true, servicesALaPersonne: true });
  });

  await test("LE VERROU : arrêtée, la case ne bouge plus, ni par le dépôt ni en base", async () => {
    await emettreFacture(a, factureSap);
    const r = await majServicesALaPersonneFacture(a, factureSap, false);
    assert.equal(r.ok, false, "une facture arrêtée a changé de case");
    await assert.rejects(
      withEntreprise(a.utilisateurId, a.entrepriseId, (tx) =>
        tx.update(factures).set({ servicesALaPersonne: false }).where(eq(factures.id, factureSap))
      ),
      "trg_facture_immuable a laissé passer la case"
    );
    assert.equal((await ligneFacture(a, factureSap))?.servicesALaPersonne, true);
  });

  let factureEntreprise = "";
  await test("un client Entreprise : décoché d'office, et la case se refuse", async () => {
    const { chantier, brouillon } = await devisPour(a, { nom: "Jardins Martin", civilite: "entreprise" }, "200.00");
    assert.equal((await ligneDevis(a, brouillon.id))?.servicesALaPersonne, false);
    const r = await devisRepo.majServicesALaPersonneDevis(a, chantier.id, true);
    assert.equal(r.ok, false);
    await devisRepo.envoyerDevis(a, brouillon.id);
    const f = await terminerChantier(a, chantier.id);
    factureEntreprise = f.id;
    assert.equal((await ligneFacture(a, f.id))?.servicesALaPersonne, false);
    assert.equal((await majServicesALaPersonneFacture(a, f.id, true)).ok, false);
    await emettreFacture(a, f.id);
  });

  await test("avec une activité à côté, un devis neuf part DÉCOCHÉ", async () => {
    await declarer(a, true);
    const { brouillon } = await devisPour(a, { nom: "Roux", civilite: "mme" });
    assert.equal((await ligneDevis(a, brouillon.id))?.servicesALaPersonne, false);
    await declarer(a, false);
  });

  // ─── 3. Le compte de l'activité à côté ────────────────────────────────────

  await test("le compte : le HT sans la case sur le HT de tout, avoirs déduits de leur côté", async () => {
    const sap = await ligneFacture(a, factureSap);
    const pro = await ligneFacture(a, factureEntreprise);
    assert.ok(sap && pro);
    const avoir = await faireUnAvoir(a, factureEntreprise, { portee: null, montantTtc: "24", motif: "Geste commercial" });
    assert.ok(avoir.ok, "l'avoir n'a pas été fait");
    const compte = await compteDeLActiviteACote(a);
    const centimes = (m: string) => Math.round(Number(m) * 100);
    const [ligneAvoir] = avoir.ok
      ? await withEntreprise(a.utilisateurId, a.entrepriseId, (tx) =>
          tx.select({ totalHt: avoirs.totalHt }).from(avoirs).where(eq(avoirs.id, avoir.avoir.id)).limit(1)
        )
      : [];
    const avoirHt = ligneAvoir ? centimes(ligneAvoir.totalHt) : 0;
    assert.ok(avoirHt > 0, "l'avoir n'a pas de HT");
    assert.equal(compte.horsSapCentimes, centimes(pro!.totalHt) - avoirHt);
    assert.equal(compte.totalCentimes, centimes(sap!.totalHt) + centimes(pro!.totalHt) - avoirHt);
  });

  await test("ISOLATION : le compte de la voisine ne voit aucune de mes factures", async () => {
    const compte = await compteDeLActiviteACote(b);
    assert.equal(compte.totalCentimes, 0);
  });

  // ─── 4. Le numéro de chaque intervenant ───────────────────────────────────

  await test("chaque salarié créé reçoit le sien, dans l'ordre d'arrivée", async () => {
    await nommerEquipe(a, 1, "Martin Julien");
    await nommerEquipe(a, 2, "Roux Léa");
    assert.equal(await numeroDuRang(a, 1), 1);
    assert.equal(await numeroDuRang(a, 2), 2);
  });

  await test("UN NUMÉRO NE SE REDONNE JAMAIS, même quand sa ligne disparaît", async () => {
    await withEntreprise(a.utilisateurId, a.entrepriseId, (tx) =>
      tx.delete(equipes).where(and(eq(equipes.entrepriseId, a.entrepriseId), eq(equipes.rang, 2)))
    );
    await nommerEquipe(a, 2, "Petit Marc");
    assert.equal(await numeroDuRang(a, 2), 3, "le n° 2 a été redonné");
  });

  await test("deux salariés ne partagent jamais un numéro (contrainte d'unicité)", async () => {
    await assert.rejects(
      withEntreprise(a.utilisateurId, a.entrepriseId, (tx) =>
        tx
          .update(equipes)
          .set({ numeroIntervenant: 1 })
          .where(and(eq(equipes.entrepriseId, a.entrepriseId), eq(equipes.rang, 2)))
      ),
      "equipes_numero_intervenant_uk a laissé passer un doublon"
    );
  });

  await test("une ligne d'avant, et un salarié sans ligne : numérotés à la lecture d'Équipe", async () => {
    // La ligne d'avant la migration 0178 : sans numéro.
    await withEntreprise(a.utilisateurId, a.entrepriseId, (tx) =>
      tx
        .update(equipes)
        .set({ numeroIntervenant: null })
        .where(and(eq(equipes.entrepriseId, a.entrepriseId), eq(equipes.rang, 1)))
    );
    await entreprisesRepo.mettreAJourEntreprise(a, { nombreSalaries: 3 });
    const numeros = await numerosDesIntervenants(a);
    assert.ok(numeros, "une entreprise déclarée rend ses numéros");
    // Le rang 1 reçoit le suivant (4), le rang 3, sans ligne, le d'après (5).
    assert.deepEqual(numeros, { 1: 4, 2: 3, 3: 5 });
    // Relire ne retire rien de plus.
    assert.deepEqual(await numerosDesIntervenants(a), { 1: 4, 2: 3, 3: 5 });
  });

  await test("une entreprise non déclarée : pas de numéros à montrer", async () => {
    assert.equal(await numerosDesIntervenants(b), null);
  });

  await test("ISOLATION : la voisine numérote de son côté, à partir de 1", async () => {
    await nommerEquipe(b, 1, "Dupont Paul");
    assert.equal(await numeroDuRang(b, 1), 1);
    // Et mes numéros n'ont pas bougé.
    assert.equal(await numeroDuRang(a, 1), 4);
  });

  console.log(`\n${failed} échec(s), ${passed} réussi(s).`);
  await fermerLimiteur();
  await pool.end();
  if (failed > 0) process.exit(1);
}

void main();
