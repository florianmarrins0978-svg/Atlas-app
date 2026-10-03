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
// LE NUMÉRO DE TVA DE L'ARTISAN PART SUR SA FACTURE — 3 octobre 2026
// ═══════════════════════════════════════════════════════════════════════════
//
// Mention obligatoire de toute facture d'un assujetti (CGI, annexe II,
// art. 242 nonies A, I-4°). Il le saisissait dans Réglages depuis la création
// de son compte, et AUCUNE facture ne le portait : `identiteDeLEmetteur` ne le
// recopiait pas. Trouvé en vérifiant la facture en autoliquidation, sa demande :
// *« corrige à la racine ce problème »*.
//
// Le chemin éprouvé est le sien : il règle son numéro, il facture, la facture
// part. Pas un PDF composé à la main avec le champ déjà rempli : celui-là
// serait vert même si rien ne le recopiait (`CLAUDE.md` §5 quater).
//
// Sous `atlas_app`, comme chez lui : une lecture hors de son entreprise ne
// rendrait rien, et la suite conclurait à tort.

const NUMERO = "FR12345678901";
const AUTRE = "FR98765432109";

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
    { email: `tva-${suffixe}-${Date.now()}@t.test` }
  );
  return { utilisateurId, entrepriseId: entreprise.id };
}

/** Un devis parti, puis la facture en brouillon : le chemin ordinaire. */
async function factureEnBrouillon(ctx: Ctx) {
  const client = await clientsRepo.creerClient(ctx, { nom: "Mme Larousse" });
  const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Chez Mme Larousse", clientId: client.id });
  await prixRepo.ajouterLignePrix(ctx, chantier.id, "Création de massifs", "1200.00");
  const devis = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
  await devisRepo.envoyerDevis(ctx, devis.id);
  return terminerChantier(ctx, chantier.id);
}

async function ligne(ctx: Ctx, factureId: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [f] = await tx.select().from(factures).where(eq(factures.id, factureId)).limit(1);
    return f;
  });
}

async function papier(ctx: Ctx, factureId: string) {
  return texteDuPdf(await genererPdfFacturePourApercu(ctx, factureId));
}

async function main() {
  await nettoyerBase();

  await test("réglé avant de facturer : l'aperçu ET la facture émise le portent", async () => {
    const ctx = await contexte("avant");
    await entreprisesRepo.mettreAJourEntreprise(ctx, { numeroTva: NUMERO });
    const f = await factureEnBrouillon(ctx);

    assert.match(await papier(ctx, f.id), new RegExp(`TVA intracommunautaire ${NUMERO}`), "l'aperçu du brouillon ne le porte pas");

    await emettreFacture(ctx, f.id);
    const emise = await ligne(ctx, f.id);
    assert.equal(emise?.statut, "emise");
    assert.equal(emise?.entrepriseNumeroTva, NUMERO, "la facture émise n'a pas figé le numéro");
    assert.match(await papier(ctx, f.id), new RegExp(`TVA intracommunautaire ${NUMERO}`), "le papier de la facture émise ne le porte pas");
  });

  await test("réglé APRÈS le brouillon : la facture le prend en partant", async () => {
    // Le cas des brouillons ouverts avant la correction : ils ne doivent pas
    // partir sans la mention.
    const ctx = await contexte("apres");
    const f = await factureEnBrouillon(ctx);
    await entreprisesRepo.mettreAJourEntreprise(ctx, { numeroTva: NUMERO });

    assert.match(await papier(ctx, f.id), new RegExp(`TVA intracommunautaire ${NUMERO}`), "l'aperçu montre l'émetteur d'hier");
    await emettreFacture(ctx, f.id);
    assert.equal((await ligne(ctx, f.id))?.entrepriseNumeroTva, NUMERO, "le brouillon est parti sans le numéro");
  });

  await test("une facture émise garde SON numéro quand il change ensuite", async () => {
    const ctx = await contexte("fige");
    await entreprisesRepo.mettreAJourEntreprise(ctx, { numeroTva: NUMERO });
    const f = await factureEnBrouillon(ctx);
    await emettreFacture(ctx, f.id);
    await entreprisesRepo.mettreAJourEntreprise(ctx, { numeroTva: AUTRE });

    assert.equal((await ligne(ctx, f.id))?.entrepriseNumeroTva, NUMERO, "une pièce partie a été réécrite");
    const texte = await papier(ctx, f.id);
    assert.match(texte, new RegExp(NUMERO), "le papier a perdu le numéro d'origine");
    assert.doesNotMatch(texte, new RegExp(AUTRE), "le papier d'une pièce partie montre le numéro d'aujourd'hui");
  });

  await test("jamais réglé : rien ne s'imprime, pas de mention à trou", async () => {
    const ctx = await contexte("vide");
    const f = await factureEnBrouillon(ctx);
    await emettreFacture(ctx, f.id);

    assert.equal((await ligne(ctx, f.id))?.entrepriseNumeroTva, null);
    const texte = await papier(ctx, f.id);
    // Refuser de conclure sur un papier vide : une absence n'est une preuve que
    // si le reste du document est bien là (`CLAUDE.md` §5).
    assert.match(texte, /Création de massifs/, "le papier est vide : rien n'est mesuré");
    assert.doesNotMatch(texte, /TVA intracommunautaire/, "une mention à trou s'est imprimée");
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
