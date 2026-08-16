// Les deux rappels, contre la base : ce qui sort, quand, et pour qui.
//
// **CE QUE CETTE SUITE TIENT, ET QU'AUCUNE RÈGLE PURE NE PEUT DIRE :**
//
//   · **le seuil est respecté dans LES DEUX SENS.** Un rappel qui sortirait
//     trop tôt est aussi faux qu'un rappel qui ne sort jamais — et le premier
//     est pire : il crie sur un devis parti ce matin, et le patron apprend à
//     ne plus lire les cartes ;
//   · **un rappel éteint ne rappelle RIEN.** C'est tout l'objet de
//     l'interrupteur ; sans ce contrôle, il serait un ornement ;
//   · **rien ne déborde d'une entreprise sur l'autre.** Ces requêtes passent
//     par `withEntreprise` : elles doivent ne rien voir de la voisine ;
//   · **un devis EXPIRÉ n'est pas rappelé deux fois.** Il a déjà sa carte de
//     devis caduc sur l'accueil ; en ajouter une seconde ferait chercher la
//     différence entre les deux.
//
// Jouée sous `atlas_app`, comme la production — c'est ce qui rend le contrôle
// d'isolation crédible.

import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import { nettoyerBase } from "./_test-db";
import { creerEntreprise } from "../src/server/repositories/entreprises";
import { creerChantier } from "../src/server/repositories/chantiers";
import { getOuCreerDevisBrouillon } from "../src/server/repositories/devis";
import { creerEnvoi } from "../src/server/repositories/envois-devis";
import { lireReglagesRappels, ecrireReglagesRappels, rappelsEnCours } from "../src/server/repositories/rappels";
import { RAPPELS_PAR_DEFAUT } from "../src/lib/rappels";
import { withEntreprise } from "../src/server/db/with-entreprise";
import { chantiers, envoisDevis } from "../src/server/db/schema";
import { eq } from "drizzle-orm";

let echecs = 0;
async function essai(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

/** Le présent des essais. Figé, pour que « au bout de 7 jours » soit vérifiable. */
const MAINTENANT = new Date("2026-08-14T12:00:00Z");
const ilYA = (jours: number) => new Date(MAINTENANT.getTime() - jours * 24 * 3600 * 1000);

async function monter() {
  await nettoyerBase();
  const a = await creerEntreprise({ nom: "Chez A" }, { email: "a@essai.local", nom: "Anne" });
  const b = await creerEntreprise({ nom: "Chez B" }, { email: "b@essai.local", nom: "Bruno" });
  return {
    ctxA: { utilisateurId: a.utilisateurId, entrepriseId: a.entreprise.id },
    ctxB: { utilisateurId: b.utilisateurId, entrepriseId: b.entreprise.id },
  };
}

type Ctx = { utilisateurId: string; entrepriseId: string };

/**
 * Un devis parti il y a N jours, sans réponse.
 *
 * **L'envoi est créé PAR LE VRAI CHEMIN**, avec son instant passé en paramètre
 * — `creerEnvoi` l'accepte précisément pour ça. Fabriquer la ligne à la main
 * aurait éprouvé une forme de donnée que l'application ne produit pas.
 *
 * Seule l'expiration est ensuite ramenée, quand l'essai a besoin d'un lien
 * mort : sa durée est calculée à partir des dates proposées, qui doivent être
 * dans le futur du jour d'envoi.
 */
async function devisPartiIlYA(ctx: Ctx, nom: string, jours: number, joursAvantExpiration?: number) {
  const chantier = await creerChantier(ctx, { nom });
  const devis = await getOuCreerDevisBrouillon(ctx, chantier.id);
  const partiLe = ilYA(jours);
  // Une date de chantier proposée bien après l'envoi : c'est elle qui fixe la
  // fenêtre du client, donc l'expiration du lien.
  const dansTroisMois = new Date(partiLe.getTime() + 90 * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);
  const envoi = await creerEnvoi(
    ctx,
    {
      chantierId: chantier.id,
      devisId: devis.id,
      canal: "email",
      datesProposees: [dansTroisMois],
      contenuDevis: `devis ${nom}`,
    },
    partiLe
  );
  if (joursAvantExpiration !== undefined) {
    await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
      tx
        .update(envoisDevis)
        .set({ expireAt: new Date(partiLe.getTime() + joursAvantExpiration * 24 * 3600 * 1000) })
        .where(eq(envoisDevis.id, envoi.id))
    );
  }
  return chantier;
}

/**
 * Poser un jalon de fin de chantier.
 *
 * Aucune fonction de dépôt ne l'expose : la fin de chantier se pose depuis
 * l'écran « Terminés » et la facture depuis la sienne. Le montage écrit donc
 * directement — **mais À TRAVERS `withEntreprise`**, sans quoi la RLS refuserait
 * silencieusement l'écriture et l'essai serait vert pour une mauvaise raison.
 */
async function poserJalon(ctx: Ctx, chantierId: string, jalon: { termineAt?: Date; factureEnvoyeeAt?: Date }) {
  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx.update(chantiers).set(jalon).where(eq(chantiers.id, chantierId))
  );
}

async function main() {
  console.log("=== Les rappels, contre la base ===\n");

  await essai("sans réglage, les deux rappels sont allumés", async () => {
    const { ctxA } = await monter();
    assert.deepEqual(await lireReglagesRappels(ctxA), RAPPELS_PAR_DEFAUT);
  });

  await essai("le réglage s'écrit et se relit", async () => {
    const { ctxA } = await monter();
    await ecrireReglagesRappels(ctxA, { devisSansReponseJours: 14, chantierNonFactureJours: null });
    const lu = await lireReglagesRappels(ctxA);
    assert.equal(lu.devisSansReponseJours, 14);
    assert.equal(lu.chantierNonFactureJours, null);
  });

  await essai("et il ne déborde pas sur l'entreprise voisine", async () => {
    const { ctxA, ctxB } = await monter();
    await ecrireReglagesRappels(ctxA, { devisSansReponseJours: 14, chantierNonFactureJours: null });
    assert.deepEqual(await lireReglagesRappels(ctxB), RAPPELS_PAR_DEFAUT);
  });

  console.log("");

  // ── Le seuil, dans les deux sens ────────────────────────────────────────
  await essai("un devis parti il y a 8 jours, sans réponse, est rappelé", async () => {
    const { ctxA } = await monter();
    await devisPartiIlYA(ctxA, "Abattage", 8);
    const rappels = await rappelsEnCours(ctxA, MAINTENANT);
    assert.equal(rappels.length, 1, `${rappels.length} rappel(s)`);
    assert.equal(rappels[0].genre, "devis-sans-reponse");
    assert.equal(rappels[0].chantierNom, "Abattage");
  });

  // **LE CONTRÔLE INVERSE, et il vaut le premier.** Sans lui, une requête qui
  // rappellerait TOUT passerait au vert : il suffirait de sortir toutes les
  // lignes pour que le contrôle ci-dessus soit content.
  await essai("un devis parti il y a 2 jours ne l'est PAS", async () => {
    const { ctxA } = await monter();
    await devisPartiIlYA(ctxA, "Élagage", 2);
    assert.deepEqual(await rappelsEnCours(ctxA, MAINTENANT), []);
  });

  await essai("un devis EXPIRÉ n'est pas rappelé — il a déjà sa carte de devis caduc", async () => {
    const { ctxA } = await monter();
    // Parti il y a 20 jours, valable 10 : le lien est mort depuis 10 jours.
    await devisPartiIlYA(ctxA, "Haie", 20, 10);
    assert.deepEqual(await rappelsEnCours(ctxA, MAINTENANT), []);
  });

  await essai("éteint, le rappel des devis ne rappelle plus rien", async () => {
    const { ctxA } = await monter();
    await devisPartiIlYA(ctxA, "Abattage", 30);
    await ecrireReglagesRappels(ctxA, { devisSansReponseJours: null, chantierNonFactureJours: null });
    assert.deepEqual(await rappelsEnCours(ctxA, MAINTENANT), []);
  });

  console.log("");

  await essai("un chantier terminé il y a 5 jours et non facturé est rappelé", async () => {
    const { ctxA } = await monter();
    const c = await creerChantier(ctxA, { nom: "Dessouchage" });
    await poserJalon(ctxA, c.id, { termineAt: ilYA(5) });
    const rappels = await rappelsEnCours(ctxA, MAINTENANT);
    assert.equal(rappels.length, 1, `${rappels.length} rappel(s)`);
    assert.equal(rappels[0].genre, "chantier-non-facture");
  });

  await essai("terminé ce matin, il ne l'est pas encore", async () => {
    const { ctxA } = await monter();
    const c = await creerChantier(ctxA, { nom: "Dessouchage" });
    await poserJalon(ctxA, c.id, { termineAt: ilYA(0) });
    assert.deepEqual(await rappelsEnCours(ctxA, MAINTENANT), []);
  });

  await essai("une fois la facture partie, le rappel s'éteint tout seul", async () => {
    const { ctxA } = await monter();
    const c = await creerChantier(ctxA, { nom: "Dessouchage" });
    await poserJalon(ctxA, c.id, { termineAt: ilYA(5) });
    assert.equal((await rappelsEnCours(ctxA, MAINTENANT)).length, 1);
    await poserJalon(ctxA, c.id, { factureEnvoyeeAt: ilYA(1) });
    assert.deepEqual(await rappelsEnCours(ctxA, MAINTENANT), []);
  });

  console.log("");

  // **L'ISOLATION.** `withEntreprise` la pose ; ce contrôle la prouve.
  await essai("aucun rappel de l'entreprise voisine ne remonte", async () => {
    const { ctxA, ctxB } = await monter();
    await devisPartiIlYA(ctxB, "Chez le voisin", 30);
    assert.deepEqual(await rappelsEnCours(ctxA, MAINTENANT), []);
    assert.equal((await rappelsEnCours(ctxB, MAINTENANT)).length, 1);
  });

  await essai("le plus ancien vient en premier — c'est celui qu'on oublie", async () => {
    const { ctxA } = await monter();
    await devisPartiIlYA(ctxA, "Récent", 8);
    await devisPartiIlYA(ctxA, "Ancien", 25);
    const rappels = await rappelsEnCours(ctxA, MAINTENANT);
    assert.deepEqual(rappels.map((r) => r.chantierNom), ["Ancien", "Récent"]);
  });

  console.log("");
  await pool.end();
  if (echecs) {
    console.log(`${echecs} ÉCHEC(S).`);
    process.exit(1);
  }
  console.log("Les rappels en base — 0 échec(s).");
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
