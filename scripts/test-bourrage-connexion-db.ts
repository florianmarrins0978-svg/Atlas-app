// Le bourrage d'identifiants, en base — la couche qui tient sans Redis.
//
// **CE QUE CETTE SUITE PROTÈGE, ET POURQUOI ELLE EXISTE.**
//
// Audit du 23 août 2026, constat C1. Trois défauts se composaient : un seuil
// par visiteur calé sur un en-tête que l'attaquant écrit lui-même, un garde-fou
// par compte à 300 essais par quart d'heure, et — le pire — **une protection
// qui disparaissait entièrement dès que Redis ne répondait plus**.
//
// La réponse est ici : un compteur d'échecs consécutifs qui vit avec les
// données, pas dans un service annexe. **Cette suite ne touche jamais à Redis**,
// et c'est exactement ce qu'elle démontre : la protection est là quand même.
//
// Elle rougirait sur l'ancien code — il n'y avait rien à appeler.
//
// Éprouvée SOUS `atlas_app`, comme la production.

import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { db, pool } from "../src/server/db/client";
import { tentativesConnexion } from "../src/server/db/schema";
import { nettoyerBase } from "./_test-db";
import {
  attenteAvantEssai,
  empreinteDe,
  noterEchec,
  oublierEchecs,
} from "../src/server/repositories/tentatives-connexion";
import {
  FENETRE_OUBLI_MS,
  PALIERS_MS,
  SEUIL_AVANT_TEMPORISATION,
} from "../src/lib/tentatives-connexion";

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

const VICTIME = "patron@essai.local";
const AUTRE = "voisin@essai.local";
const T0 = new Date("2026-08-23T10:00:00.000Z");
const plus = (ms: number) => new Date(T0.getTime() + ms);

async function main() {
  console.log("=== Bourrage d'identifiants : ce que la base retient ===\n");

  await nettoyerBase();

  await essai("les premiers essais ne temporisent rien", async () => {
    for (let n = 1; n < SEUIL_AVANT_TEMPORISATION; n++) {
      await noterEchec(VICTIME, plus(n));
      assert.equal(await attenteAvantEssai(VICTIME, plus(n)), null, `temporisé dès le ${n}ᵉ échec`);
    }
  });

  await essai("au seuil, l'essai suivant est REFUSÉ D'AVANCE", async () => {
    await noterEchec(VICTIME, plus(SEUIL_AVANT_TEMPORISATION));
    const attente = await attenteAvantEssai(VICTIME, plus(SEUIL_AVANT_TEMPORISATION));
    assert.notEqual(attente, null, "le compte n'est pas temporisé après le seuil");
    assert.equal(attente, PALIERS_MS[0]);
  });

  await essai("temporiser un compte n'en temporise aucun autre", async () => {
    assert.equal(await attenteAvantEssai(AUTRE, plus(SEUIL_AVANT_TEMPORISATION)), null);
  });

  await essai("la casse et les espaces ne fabriquent pas un compteur neuf", async () => {
    // Sans normalisation, « Patron@Essai.LOCAL » repartirait de zéro — le même
    // contournement que l'en-tête inventé, une porte plus loin.
    for (const forme of [` ${VICTIME} `, VICTIME.toUpperCase(), "Patron@Essai.Local"]) {
      assert.notEqual(
        await attenteAvantEssai(forme, plus(SEUIL_AVANT_TEMPORISATION)),
        null,
        `« ${forme} » a échappé à la temporisation`
      );
    }
  });

  await essai("l'attente s'écoule : passé le palier, on repasse", async () => {
    const apres = plus(SEUIL_AVANT_TEMPORISATION + PALIERS_MS[0]);
    assert.equal(await attenteAvantEssai(VICTIME, apres), null);
  });

  await essai("chaque échec de plus coûte plus cher", async () => {
    await noterEchec(VICTIME, plus(SEUIL_AVANT_TEMPORISATION + PALIERS_MS[0]));
    const attente = await attenteAvantEssai(VICTIME, plus(SEUIL_AVANT_TEMPORISATION + PALIERS_MS[0]));
    assert.equal(attente, PALIERS_MS[1]);
  });

  // ─── Ce que l'attaquant obtient VRAIMENT, sur une journée ─────────────────
  //
  // **Le plafond de la journée est le PALIER LE PLUS HAUT, et rien d'autre.**
  // Ce n'est pas un chiffre choisi : il se déduit des paliers, et il se
  // recalcule ici plutôt que de s'écrire en dur — un seuil écrit à la main
  // finirait par ne plus décrire ce que le code fait (`CLAUDE.md` §3).
  await essai("sur vingt-quatre heures, la journée est plafonnée par le dernier palier", async () => {
    await oublierEchecs(AUTRE);
    let instant = T0;
    const fin = T0.getTime() + 24 * 60 * 60 * 1000;
    let obtenus = 0;
    while (instant.getTime() < fin) {
      const attente = await attenteAvantEssai(AUTRE, instant);
      if (attente !== null) {
        instant = new Date(instant.getTime() + attente);
        continue;
      }
      await noterEchec(AUTRE, instant);
      obtenus++;
      instant = new Date(instant.getTime() + 1);
    }

    const plafond = PALIERS_MS[PALIERS_MS.length - 1];
    // Les essais gratuits du début, la montée des paliers, puis le régime de
    // croisière : un essai par plafond jusqu'au bout de la journée.
    const attendu = SEUIL_AVANT_TEMPORISATION + PALIERS_MS.length + Math.ceil((24 * 60 * 60 * 1000) / plafond);
    assert.ok(
      obtenus <= attendu,
      `l'attaquant obtient ${obtenus} essais par jour, au-delà des ${attendu} que les paliers autorisent`
    );
    // Et la comparaison qui donne son sens au reste : avant ce lot, le seuil
    // « 300 par quart d'heure » en laissait passer 28 800 dans la même journée.
    assert.ok(obtenus * 100 < 28_800, `seulement ${obtenus} essais — la réduction n'atteint pas un facteur cent`);
    console.log(`      (${obtenus} essais en 24 h, contre 28 800 avant ce lot)`);
  });

  // ─── Le patron n'est pas muré ─────────────────────────────────────────────
  await essai("une connexion réussie efface tout — il n'attend pas son tour", async () => {
    await oublierEchecs(VICTIME);
    assert.equal(await attenteAvantEssai(VICTIME, plus(1)), null);
    const [reste] = await db
      .select()
      .from(tentativesConnexion)
      .where(eq(tentativesConnexion.empreinte, empreinteDe(VICTIME)))
      .limit(1);
    assert.equal(reste, undefined, "la ligne survit à une connexion réussie");
  });

  await essai("le blocage ne dépasse jamais le plafond — jamais de compte muré", async () => {
    await oublierEchecs(VICTIME);
    for (let n = 1; n <= 60; n++) await noterEchec(VICTIME, plus(n));
    const attente = await attenteAvantEssai(VICTIME, plus(60));
    assert.ok(attente !== null && attente <= PALIERS_MS[PALIERS_MS.length - 1]);
  });

  await essai("des échecs assez vieux ne comptent plus", async () => {
    assert.equal(await attenteAvantEssai(VICTIME, plus(60 + FENETRE_OUBLI_MS)), null);
  });

  // **Le défaut trouvé en relisant ce lot d'un œil hostile.** La première
  // rédaction parait la course entre deux essais simultanés par un
  // `GREATEST(echecs + 1, …)` en SQL — et ce GREATEST ressuscitait les échecs
  // que la fenêtre d'oubli venait d'effacer. Neuf fautes lundi, UNE seule
  // mardi, et l'artisan repartait au plafond : un quart d'heure d'attente pour
  // une faute isolée. La règle d'oubli existait, et le SQL la contredisait.
  //
  // Sans ce cas, le contrôle du dessus restait vert : il ne regarde que le
  // blocage en cours, pas le compte des échecs qui survit dessous.
  await essai("un échec ISOLÉ après l'oubli ne renvoie pas au plafond", async () => {
    await oublierEchecs(AUTRE);
    // Une rafale, puis une longue accalmie.
    for (let n = 1; n <= 9; n++) await noterEchec(AUTRE, plus(n));
    const bienPlusTard = plus(9 + FENETRE_OUBLI_MS + 1);

    await noterEchec(AUTRE, bienPlusTard);
    assert.equal(
      await attenteAvantEssai(AUTRE, bienPlusTard),
      null,
      "une faute isolée, des heures plus tard, temporise encore : l'oubli ne s'applique pas"
    );
  });

  // ─── Ce que la table ne doit PAS devenir ──────────────────────────────────
  await essai("l'adresse n'est écrite nulle part — seulement son empreinte", async () => {
    await oublierEchecs(VICTIME);
    await noterEchec(VICTIME, plus(1));
    const lignes = await db.select().from(tentativesConnexion);
    const brut = JSON.stringify(lignes);
    assert.ok(!brut.includes(VICTIME), "l'adresse en clair se trouve dans la table");
    assert.ok(brut.includes(empreinteDe(VICTIME)), "l'empreinte attendue n'y est pas");
  });

  await essai("le ménage empêche la table de grossir sans fin", async () => {
    // N'importe qui peut faire naître une ligne en tapant une adresse. Sans
    // coupe, une rafale sur dix mille adresses inventées les laisserait toutes.
    const vieux = new Date(T0.getTime() - FENETRE_OUBLI_MS * 3);
    const inventees = Array.from({ length: 20 }, (_, i) => `invente-${i}@essai.local`);
    for (const adresse of inventees) await noterEchec(adresse, vieux);

    // **Ce qu'on vérifie, c'est que les PÉRIMÉES partent — pas un compte de
    // lignes.** Les autres cas de cette suite ont laissé leurs propres lignes,
    // récentes et légitimes : compter le total ferait rougir ce contrôle pour
    // un motif qui n'a rien à voir, et l'on chercherait au mauvais endroit.
    const empreintesInventees = new Set(inventees.map(empreinteDe));
    const avant = await db.select().from(tentativesConnexion);
    assert.ok(
      avant.some((l) => empreintesInventees.has(l.empreinte)),
      "les lignes périmées n'ont même pas été écrites : ce contrôle n'éprouve rien"
    );

    // Un échec récent déclenche la coupe.
    await noterEchec("declencheur@essai.local", T0);

    const apres = await db.select().from(tentativesConnexion);
    const survivantes = apres.filter((l) => empreintesInventees.has(l.empreinte));
    assert.equal(
      survivantes.length,
      0,
      `${survivantes.length} lignes périmées survivent alors qu'elles ne comptent plus pour personne`
    );
    // Et le ménage ne doit pas emporter ce qui compte encore.
    assert.ok(
      apres.some((l) => l.empreinte === empreinteDe("declencheur@essai.local")),
      "le ménage a emporté une ligne récente"
    );
  });

  console.log("");
  console.log(`Bourrage d'identifiants — ${echecs} échec(s).`);
  await pool.end();
  process.exit(echecs > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
