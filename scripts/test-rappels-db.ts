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
import { getOuCreerDevisBrouillon, envoyerDevis } from "../src/server/repositories/devis";
import { ajouterLignePrix } from "../src/server/repositories/lignes-prix";
import { creerEnvoi } from "../src/server/repositories/envois-devis";
import {
  lireReglagesRappels,
  ecrireReglagesRappels,
  rappelsEnCours,
  repousserRappelFacture,
} from "../src/server/repositories/rappels";
import { RAPPELS_PAR_DEFAUT } from "../src/lib/rappels";
import { terminerChantier, emettreFacture } from "../src/server/repositories/factures";
import { noterPaiement } from "../src/server/repositories/paiements-facture";
import { mettreAJourEntreprise } from "../src/server/repositories/entreprises";
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
async function poserJalon(ctx: Ctx, chantierId: string, jalon: { termineAt?: Date; factureEnvoyeeAt?: Date; devisEnvoyeAt?: Date }) {
  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx.update(chantiers).set(jalon).where(eq(chantiers.id, chantierId))
  );
}

/**
 * Un chantier ouvert il y a N jours, dont aucun devis n'est parti.
 *
 * **`createdAt` s'écrit à la main, faute de mieux.** `creerChantier` pose
 * l'instant lui-même — c'est ce qu'on veut en production — et aucun paramètre
 * ne l'ouvre. L'écriture passe donc par `withEntreprise`, sans quoi la RLS la
 * refuserait EN SILENCE et l'essai serait vert pour une mauvaise raison : le
 * chantier daterait d'aujourd'hui, donc aucun rappel, donc « rien à rappeler »
 * — la même sortie que le cas qu'on croit éprouver.
 */
async function chantierOuvertIlYA(ctx: Ctx, nom: string, jours: number) {
  const chantier = await creerChantier(ctx, { nom });
  const r = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx.update(chantiers).set({ createdAt: ilYA(jours) }).where(eq(chantiers.id, chantier.id))
  );
  if (r.rowCount !== 1) {
    throw new Error(
      "le montage n'a pas pu vieillir le chantier : sans cela l'essai serait vert " +
        "en n'éprouvant rien (voir CLAUDE.md §4, la RLS refuse en silence)"
    );
  }
  return chantier;
}

/**
 * Un chantier terminé, sa facture émise et partie il y a N jours.
 *
 * **Le chemin réel, pas une ligne fabriquée** : `terminerChantier` puis
 * `emettreFacture` sont ce que fait l'application. Seule la date d'envoi est
 * ensuite reculée — attendre trente jours n'est pas une option.
 */
async function factureEnvoyeeIlYA(ctx: Ctx, nom: string, jours: number) {
  const chantier = await creerChantier(ctx, { nom });
  // **Une facture ne naît pas d'un chantier nu** : `terminerChantier` exige un
  // devis ENVOYÉ (`FinChantierImpossibleError("devis_absent")`). Le montage
  // suit donc le vrai parcours — ligne de prix, devis, envoi — plutôt que de
  // fabriquer une facture que l'application ne produirait jamais.
  await ajouterLignePrix(ctx, chantier.id, "Main d'œuvre", "1000.00");
  const brouillon = await getOuCreerDevisBrouillon(ctx, chantier.id);
  await envoyerDevis(ctx, brouillon.id);
  const facture = await terminerChantier(ctx, chantier.id, ilYA(jours));
  await emettreFacture(ctx, facture.id, ilYA(jours));
  const partie = ilYA(jours);
  const r = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx.update(chantiers).set({ factureEnvoyeeAt: partie }).where(eq(chantiers.id, chantier.id))
  );
  if (r.rowCount !== 1) {
    throw new Error("le montage n'a pas pu dater l'envoi de la facture (la RLS refuse en silence)");
  }
  // **Le total ne se force PAS après coup.** Une facture émise est immuable —
  // un déclencheur en base le fait respecter, et c'est exactement ce qu'on veut
  // d'une pièce comptable. Il vient donc de la ligne de prix : 1 000 € HT à
  // 20 % font 1 200 € TTC, le montant que ces essais attendent.
  return { chantier, factureId: facture.id };
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

  // ── Le troisième : un chantier ouvert dont AUCUN devis n'est parti ──────
  //
  // Sa demande du 14 août 2026, et elle n'est couverte par aucun des deux
  // autres : « devis sans réponse » part d'un ENVOI, et un devis jamais parti
  // n'en laisse aucun.
  await essai("un chantier ouvert il y a 6 jours sans devis est rappelé", async () => {
    const { ctxA } = await monter();
    await chantierOuvertIlYA(ctxA, "Mme Félicie", 6);
    const rappels = await rappelsEnCours(ctxA, MAINTENANT);
    assert.equal(rappels.length, 1, `${rappels.length} rappel(s)`);
    assert.equal(rappels[0].genre, "chantier-sans-devis");
    assert.equal(rappels[0].chantierNom, "Mme Félicie");
  });

  // **LE CONTRÔLE INVERSE.** Sans lui, une requête qui rappellerait TOUS les
  // chantiers passerait au vert — et l'accueil se couvrirait de cartes dès le
  // premier chantier créé.
  await essai("ouvert ce matin, il ne l'est pas — le seuil est à 4 jours", async () => {
    const { ctxA } = await monter();
    await chantierOuvertIlYA(ctxA, "Tout frais", 1);
    assert.deepEqual(await rappelsEnCours(ctxA, MAINTENANT), []);
  });

  // **La règle qu'il a posée en premier, et qui est gratuite ici** : le rappel
  // s'efface tout seul quand le devis part. Rien à ranger à la main.
  await essai("dès que le devis part, le rappel disparaît de lui-même", async () => {
    const { ctxA } = await monter();
    const c = await chantierOuvertIlYA(ctxA, "Mme Félicie", 20);
    assert.equal((await rappelsEnCours(ctxA, MAINTENANT)).length, 1);
    await poserJalon(ctxA, c.id, { devisEnvoyeAt: ilYA(1) });
    assert.deepEqual(await rappelsEnCours(ctxA, MAINTENANT), []);
  });

  // **Un chantier fini sans devis ne réclame plus rien.** Un dépannage fait et
  // clos de la main à la main est justement le cas où il a eu raison de ne pas
  // faire de devis : le lui rappeler pour toujours serait le punir.
  await essai("un chantier TERMINÉ sans devis ne rappelle pas de devis", async () => {
    const { ctxA } = await monter();
    const c = await chantierOuvertIlYA(ctxA, "Dépannage", 20);
    await poserJalon(ctxA, c.id, { termineAt: ilYA(2) });
    const genres = (await rappelsEnCours(ctxA, MAINTENANT)).map((r) => r.genre);
    assert.deepEqual(genres, [], `restait : ${genres.join(", ")}`);
  });

  await essai("éteint, le rappel du devis non parti ne rappelle plus rien", async () => {
    const { ctxA } = await monter();
    await chantierOuvertIlYA(ctxA, "Mme Félicie", 20);
    await ecrireReglagesRappels(ctxA, {
      chantierSansDevisJours: null,
      devisSansReponseJours: null,
      chantierNonFactureJours: null,
    });
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

  // ── Le quatrième rappel : la facture impayée ──────────────────────────────
  //
  // **« A plus B », sa réponse du 16 août 2026.** L'échéance quand un délai de
  // paiement est réglé, le jour de l'envoi sinon.
  await essai("A : avec un délai de 30 jours, rien n'est rappelé au dixième", async () => {
    const { ctxA } = await monter();
    await mettreAJourEntreprise(ctxA, { conditions: { delaiPaiementJours: 30 } });
    await factureEnvoyeeIlYA(ctxA, "Toiture", 10);
    const rappels = (await rappelsEnCours(ctxA, MAINTENANT)).filter((r) => r.genre === "facture-impayee");
    assert.deepEqual(rappels, []);
  });

  await essai("A : passée l'échéance, elle est rappelée avec son montant", async () => {
    const { ctxA } = await monter();
    await mettreAJourEntreprise(ctxA, { conditions: { delaiPaiementJours: 30 } });
    await factureEnvoyeeIlYA(ctxA, "Toiture", 40);
    const rappels = (await rappelsEnCours(ctxA, MAINTENANT)).filter((r) => r.genre === "facture-impayee");
    assert.equal(rappels.length, 1, `${rappels.length}`);
    assert.equal(rappels[0].facture?.resteDuCts, 120000);
    assert.equal(rappels[0].facture?.totalCts, 120000);
  });

  // **B : sans délai réglé, on compte depuis l'envoi.** Rendre `null` aurait
  // laissé un rappel muet qu'on croit allumé.
  await essai("B : sans délai réglé, le compte part de l'envoi", async () => {
    const { ctxA } = await monter();
    await factureEnvoyeeIlYA(ctxA, "Toiture", 3);
    const rappels = (await rappelsEnCours(ctxA, MAINTENANT)).filter((r) => r.genre === "facture-impayee");
    assert.equal(rappels.length, 1, "aucun rappel alors qu'aucun délai n'est réglé");
  });

  // **LE PREMIER PIÈGE DE SA PLANCHE.** C'est la somme des règlements qui
  // décide, jamais un état posé à la main.
  await essai("soldée, elle sort du rappel le jour même", async () => {
    const { ctxA } = await monter();
    const { factureId } = await factureEnvoyeeIlYA(ctxA, "Toiture", 40);
    await noterPaiement(ctxA, factureId, { date: "2026-08-13", montant: "1200.00" });
    const rappels = (await rappelsEnCours(ctxA, MAINTENANT)).filter((r) => r.genre === "facture-impayee");
    assert.deepEqual(rappels, []);
  });

  // **LE DEUXIÈME PIÈGE.** Un acompte ne solde pas : la facture reste rappelée
  // et c'est le RESTE qui s'affiche. La faire disparaître ferait oublier 720 €.
  await essai("un acompte ne solde pas : le RESTE dû est rappelé", async () => {
    const { ctxA } = await monter();
    const { factureId } = await factureEnvoyeeIlYA(ctxA, "Toiture", 40);
    await noterPaiement(ctxA, factureId, { date: "2026-08-13", montant: "480.00" });
    const rappels = (await rappelsEnCours(ctxA, MAINTENANT)).filter((r) => r.genre === "facture-impayee");
    assert.equal(rappels.length, 1, "l'acompte a fait disparaître la facture");
    assert.equal(rappels[0].facture?.resteDuCts, 72000, "le reste dû est faux");
    assert.equal(rappels[0].facture?.totalCts, 120000);
  });

  // **LE RYTHME — sa demande du 16 août.** Sans lui, la carte reviendrait
  // chaque jour jusqu'au paiement.
  await essai("« Plus tard » fait taire le rappel le temps du rythme", async () => {
    const { ctxA } = await monter();
    const { factureId } = await factureEnvoyeeIlYA(ctxA, "Toiture", 40);
    assert.equal((await rappelsEnCours(ctxA, MAINTENANT)).filter((r) => r.genre === "facture-impayee").length, 1);

    await repousserRappelFacture(ctxA, factureId, "2026-08-14");
    const lendemain = new Date("2026-08-15T12:00:00Z");
    assert.deepEqual(
      (await rappelsEnCours(ctxA, lendemain)).filter((r) => r.genre === "facture-impayee"),
      [],
      "repoussé, il parle encore le lendemain"
    );

    // Sept jours plus tard, il revient — c'est « chaque semaine », le défaut.
    const septJours = new Date("2026-08-21T12:00:00Z");
    assert.equal(
      (await rappelsEnCours(ctxA, septJours)).filter((r) => r.genre === "facture-impayee").length,
      1,
      "repoussé, il n'est jamais revenu"
    );
  });

  await essai("éteint, il ne rappelle plus rien", async () => {
    const { ctxA } = await monter();
    await factureEnvoyeeIlYA(ctxA, "Toiture", 40);
    await ecrireReglagesRappels(ctxA, { factureImpayeeJours: null });
    assert.deepEqual(
      (await rappelsEnCours(ctxA, MAINTENANT)).filter((r) => r.genre === "facture-impayee"),
      []
    );
  });

  await essai("et rien ne déborde de l'entreprise voisine", async () => {
    const { ctxA, ctxB } = await monter();
    await factureEnvoyeeIlYA(ctxB, "Chez le voisin", 40);
    assert.deepEqual(
      (await rappelsEnCours(ctxA, MAINTENANT)).filter((r) => r.genre === "facture-impayee"),
      []
    );
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
