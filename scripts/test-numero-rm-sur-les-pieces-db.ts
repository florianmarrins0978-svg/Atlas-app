import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import * as devisRepo from "../src/server/repositories/devis";
import * as prixRepo from "../src/server/repositories/lignes-prix";
import { emettreFacture, genererPdfFacturePourApercu, terminerChantier } from "../src/server/repositories/factures";
import { withEntreprise } from "../src/server/db/with-entreprise";
import { factures } from "../src/server/db/schema";
import { nettoyerBase } from "./_test-db";
import { texteDuPdf } from "./_lecteur-pdf-protege";

// ═══════════════════════════════════════════════════════════════════════════
// LA MENTION DU RÉPERTOIRE DES MÉTIERS — son choix B du 9 octobre 2026
// ═══════════════════════════════════════════════════════════════════════════
//
// Planche `appli/numero-rm.html`. Un champ libre et facultatif dans Mon
// entreprise ; rempli, il s'imprime tel qu'écrit après le SIRET, SUR LA MÊME
// LIGNE (« SIRET …, RM 33 »), sur le devis comme sur la facture ; vide, rien ne
// change. Aucun texte trouvé ne dit quelle mention un artisan doit écrire
// depuis le RNE : l'application n'en invente aucune.
//
// Le chemin éprouvé est le sien : il règle la mention dans Mon entreprise, il
// fait son devis, il facture. Pas un PDF composé à la main avec le champ déjà
// rempli : celui-là serait vert même si rien ne le recopiait (`CLAUDE.md`
// §5 quater). Sous `atlas_app`, comme chez lui.

const SIRET = "12345678900012";
const RM = "RM 33";
const AUTRE = "RM 40";

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
    { nom: "Jardins de l'Erdre" },
    { email: `rm-${suffixe}-${Date.now()}@t.test` }
  );
  const ctx = { utilisateurId, entrepriseId: entreprise.id };
  await entreprisesRepo.mettreAJourEntreprise(ctx, { siret: SIRET });
  return ctx;
}

async function chantierAvecPrix(ctx: Ctx) {
  const client = await clientsRepo.creerClient(ctx, { nom: "Mme Larousse" });
  const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Chez Mme Larousse", clientId: client.id });
  await prixRepo.ajouterLignePrix(ctx, chantier.id, "Création de massifs", "1200.00");
  return chantier;
}

async function factureEnBrouillon(ctx: Ctx) {
  const chantier = await chantierAvecPrix(ctx);
  const devis = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
  await devisRepo.envoyerDevis(ctx, devis.id);
  return terminerChantier(ctx, chantier.id);
}

async function ligneFacture(ctx: Ctx, factureId: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [f] = await tx.select().from(factures).where(eq(factures.id, factureId)).limit(1);
    return f;
  });
}

/** Le texte du papier, refusé s'il est vide : une absence ne prouve rien sur rien. */
function lisible(texte: string): string {
  assert.match(texte, /Création de massifs/, "le papier est vide : rien n'est mesuré");
  return texte.replace(/\s+/g, " ");
}

async function main() {
  await nettoyerBase();

  await test("rempli : le devis l'imprime après le SIRET, sur la même ligne", async () => {
    const ctx = await contexte("devis");
    await entreprisesRepo.mettreAJourEntreprise(ctx, { numeroRm: RM });
    const chantier = await chantierAvecPrix(ctx);
    const devis = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);

    const texte = lisible(await texteDuPdf(await devisRepo.genererPdfPourApercu(ctx, devis.id)));
    assert.match(texte, new RegExp(`SIRET ${SIRET}, ${RM}`), "le devis ne porte pas « SIRET …, RM 33 »");
  });

  await test("rempli : la facture émise le fige et l'imprime pareil", async () => {
    const ctx = await contexte("facture");
    await entreprisesRepo.mettreAJourEntreprise(ctx, { numeroRm: RM });
    const f = await factureEnBrouillon(ctx);
    await emettreFacture(ctx, f.id);

    assert.equal((await ligneFacture(ctx, f.id))?.entrepriseNumeroRm, RM, "la facture émise ne l'a pas figé");
    const texte = lisible(await texteDuPdf(await genererPdfFacturePourApercu(ctx, f.id)));
    assert.match(texte, new RegExp(`SIRET ${SIRET}, ${RM}`), "la facture ne porte pas « SIRET …, RM 33 »");
  });

  await test("une facture émise garde SA mention quand elle change ensuite", async () => {
    const ctx = await contexte("fige");
    await entreprisesRepo.mettreAJourEntreprise(ctx, { numeroRm: RM });
    const f = await factureEnBrouillon(ctx);
    await emettreFacture(ctx, f.id);
    await entreprisesRepo.mettreAJourEntreprise(ctx, { numeroRm: AUTRE });

    const texte = lisible(await texteDuPdf(await genererPdfFacturePourApercu(ctx, f.id)));
    assert.match(texte, new RegExp(RM), "le papier a perdu la mention d'origine");
    assert.doesNotMatch(texte, new RegExp(AUTRE), "une pièce partie montre la mention d'aujourd'hui");
  });

  await test("vide : rien ne s'imprime, le SIRET reste seul", async () => {
    const ctx = await contexte("vide");
    const f = await factureEnBrouillon(ctx);
    await emettreFacture(ctx, f.id);

    assert.equal((await ligneFacture(ctx, f.id))?.entrepriseNumeroRm, null);
    const texte = lisible(await texteDuPdf(await genererPdfFacturePourApercu(ctx, f.id)));
    assert.match(texte, new RegExp(`SIRET ${SIRET}`), "le SIRET a disparu");
    assert.doesNotMatch(texte, new RegExp(`SIRET ${SIRET},`), "une virgule à trou s'est imprimée");
  });

  await test("effacé : une chaîne vide vaut « rien », pas une virgule seule", async () => {
    const ctx = await contexte("efface");
    await entreprisesRepo.mettreAJourEntreprise(ctx, { numeroRm: RM });
    await entreprisesRepo.mettreAJourEntreprise(ctx, { numeroRm: "   " });
    const chantier = await chantierAvecPrix(ctx);
    const devis = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);

    const texte = lisible(await texteDuPdf(await devisRepo.genererPdfPourApercu(ctx, devis.id)));
    assert.doesNotMatch(texte, new RegExp(`SIRET ${SIRET},`), "un champ effacé imprime encore quelque chose");
  });

  console.log(`\n${passed} réussi(s), ${failed} échoué(s)`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
