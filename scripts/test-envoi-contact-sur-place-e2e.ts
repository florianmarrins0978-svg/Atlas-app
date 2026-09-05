import { lancerNavigateur } from "./e2e-browser";
import { Pool } from "pg";
import { creerPuisFiche } from "./_creer-chantier-e2e";

// **Un devis dont le client n'a pas de coordonnée peut quand même partir.**
//
// Le patron, le 11 août 2026, capture à l'appui : *« l'encart qui permet
// d'envoyer aux clients par SMS, par e-mail, a disparu. »* Il ne voyait plus que
// « Indiquez d'abord comment joindre ce client — sur sa fiche », et un bouton
// grisé.
//
// **C'était un cul-de-sac, refermé le soir même.** L'écran « Informations » —
// le seul endroit où saisir un téléphone ou un e-mail — avait quitté le tiroir
// de la fiche quelques heures plus tôt, à sa demande. La phrase renvoyait donc
// vers une porte qui n'existait plus, et un chantier né d'une dictée, dont le
// client reste « non renseigné », ne pouvait plus jamais partir.
//
// **Ce que ce contrôle attrape, et qu'aucun autre ne pouvait voir.** Toutes les
// suites d'envoi créent leur chantier AVEC un numéro — `test-envoi-raison`
// remplit le champ téléphone dès la création. Le chemin le plus courant chez le
// patron — créer, laisser le contact vide, envoyer — n'était donc emprunté par
// personne. Celui-ci l'emprunte, et par l'écran, comme lui.
//
// Il va jusqu'au bout du parcours plutôt que de regarder un encart : la
// coordonnée saisie ICI doit débloquer l'envoi **et** se retrouver sur le client
// en base. Un écran qui accepterait la saisie sans la ranger serait vert à
// l'œil, et faux — elle serait à ressaisir au prochain envoi.

const BASE = "http://localhost:3000";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const NUMERO = "0611223344";

let echecs = 0;

async function cas(nom: string, verifier: () => Promise<void>) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

async function main() {
  console.log("=== Un client sans coordonnée n'est pas un cul-de-sac ===\n");

  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext();
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  // **Le chantier du patron : un nom, et rien d'autre.** Le champ téléphone est
  // délibérément laissé vide — c'est tout l'objet de cette suite.
  const nom = `Contact sur place ${Date.now()}`;
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', nom);
  const idChantier = await creerPuisFiche(page);
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 30_000 });
  const chantierId = idChantier;

  // Un devis chiffré, sans quoi l'envoi bute sur un autre motif.
  await page.goto(`${BASE}/chantiers/${chantierId}/devis-complet`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Total TTC", { timeout: 30_000 });
  await page.getByRole("button", { name: "+ Ajouter une ligne" }).click();
  await page.waitForTimeout(900);
  await page.getByLabel("Description 1").fill("Taille d'une haie de laurier");
  await page.getByLabel("Prix unitaire 1").fill("700");
  await page.getByLabel("Description 1").click();
  await page.waitForTimeout(1400);

  await cas("le client créé n'a bien AUCUNE coordonnée (sinon rien n'est éprouvé)", async () => {
    const { rows } = await pool.query(
      `select cl.canal_communication, cl.telephone, cl.email
         from chantiers c join clients cl on cl.id = c.client_id
        where c.id = $1`,
      [chantierId]
    );
    const c = rows[0];
    if (!c) throw new Error("aucun client rattaché au chantier créé");
    if (c.canal_communication || c.telephone || c.email) {
      throw new Error(
        `le client porte déjà une coordonnée (canal = ${c.canal_communication}, tél = ${c.telephone}, ` +
          "e-mail = " + c.email + "). L'écran de création la pré-remplit-il ? Ce contrôle ne verrait rien."
      );
    }
  });

  await page.goto(`${BASE}/chantiers/${chantierId}/devis-complet`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: /Choisir la date/i }).click();
  await page.waitForTimeout(2500);

  await cas("la feuille propose les deux canaux, au lieu de renvoyer sur une fiche", async () => {
    const ecran = await page.locator("body").innerText();
    // **La phrase qui trahit le cul-de-sac.** Elle désignait un écran retiré du
    // tiroir : la revoir signifie que le renvoi est revenu.
    if (/sur sa fiche/i.test(ecran)) {
      throw new Error(
        "la feuille renvoie encore « sur sa fiche » — or cet écran n'est plus " +
          "atteignable depuis le tiroir du chantier. C'est une porte qui n'existe pas."
      );
    }
    for (const attendu of ["Par SMS", "Par e-mail"]) {
      if (!ecran.includes(attendu)) {
        throw new Error(
          `« ${attendu} » manque : le patron ne peut pas choisir comment joindre son client.\n      ` +
            ecran.split("\n").filter((l) => l.trim()).slice(0, 14).join("\n      ")
        );
      }
    }
  });

  await cas("la coordonnée se saisit ici, et débloque l'envoi", async () => {
    await page.getByLabel("Numéro de téléphone").fill(NUMERO);
    await page.getByRole("button", { name: /Enregistrer et continuer/i }).click();
    await page.waitForTimeout(4000);

    const envoyer = page.getByRole("button", { name: /Envoyer le devis/i });
    if (await envoyer.isDisabled()) {
      const ecran = await page.locator("body").innerText();
      throw new Error(
        "le bouton d'envoi reste grisé après la saisie : le blocage n'a pas été levé.\n      " +
          ecran.split("\n").filter((l) => l.trim()).slice(0, 14).join("\n      ")
      );
    }
  });

  await cas("la coordonnée est rangée sur le client, pas seulement affichée", async () => {
    const { rows } = await pool.query(
      `select cl.canal_communication, cl.telephone
         from chantiers c join clients cl on cl.id = c.client_id
        where c.id = $1`,
      [chantierId]
    );
    const c = rows[0];
    if (c?.canal_communication !== "sms" || !c?.telephone) {
      throw new Error(
        `le client n'a pas été mis à jour (canal = ${c?.canal_communication ?? "null"}, ` +
          `téléphone = ${c?.telephone ?? "null"}). L'écran a accepté une saisie qu'il n'a pas rangée : ` +
          "elle serait à ressaisir au prochain envoi."
      );
    }
  });

  await navigateur.close();
  await pool.end();

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Contact saisi sur place — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
