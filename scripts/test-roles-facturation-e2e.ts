import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { Pool } from "pg";
import { donnerUnAcces, listerAcces } from "../src/server/repositories/membres-entreprise";
import { documentsAAccepter, enregistrerAcceptations } from "../src/server/repositories/documents-legaux";
import type { Ctx } from "../src/server/repositories/context";

// UN COMMERCIAL NE FACTURE PAS — MÊME EN FABRIQUANT LA REQUÊTE.
//
// ═══════════════════════════════════════════════════════════════════════════
// **LA RÈGLE EST DU 13 AOÛT 2026**, et elle vient de lui
// (`docs/QUESTIONS.md` §10) : *« Le commercial : les chantiers, le planning,
// les devis et les prix — il en a besoin pour vendre. Ni les factures, ni la
// TVA. »* Elle n'avait jamais été appliquée.
//
// Sa consigne sur la manière, 30 août : *« Ne protège pas seulement /factures.
// Protège les CAPACITÉS de facturation. Un commercial qui connaît
// l'identifiant d'une Server Action de facture doit être refusé même si son
// écran Factures n'existe pas. »*
//
// ═══════════════════════════════════════════════════════════════════════════
// **CE QUE CETTE SUITE FAIT, ET QU'AUCUNE AUTRE NE PEUT FAIRE.**
//
// `test-roles-capacites-db.ts` prouve que la garde refuse. Il serait vert même
// si personne ne l'appelait — c'est le raccord qui casse, jamais la formule.
// Ici on **fabrique la requête** :
//
//   1. le patron enregistre un achat depuis l'écran de TVA. On INTERCEPTE
//      l'appel : son adresse, son en-tête `Next-Action` — l'identifiant de
//      l'action serveur — et son corps ;
//   2. on rejoue **exactement** cette requête avec le cookie du COMMERCIAL,
//      sous un autre nom de fournisseur ;
//   3. on relit la base : rien ne doit être entré.
//
// **Et deux moitiés indispensables**, sans lesquelles on serait vert en ayant
// cassé la facturation pour tout le monde :
//
//   4. la même requête, rejouée par la FACTURATION, écrit pour de bon ;
//   5. le commercial garde ses devis — c'est ce pour quoi le rôle existe.
//
// ═══════════════════════════════════════════════════════════════════════════
// **L'ACHAT DE TVA PLUTÔT QUE L'ÉMISSION D'UNE FACTURE, ET C'EST DÉLIBÉRÉ.**
// Émettre exige un devis envoyé, donc un décor long à monter et fragile ; ce
// qui se prouve ici est le MÉCANISME — une action du cycle comptable postée à
// la main est refusée. Que les dix la portent toutes est prouvé fichier par
// fichier par la suite base, qui rougit si l'une l'oublie.

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE = "http://localhost:3000";
const CAPTURES = "artifacts/screenshots/roles-facturation";
const MOT_DE_PASSE = "trois-mots-courts";

let echecs = 0;
async function cas(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

async function compterAchats(entrepriseId: string, marque: string): Promise<number> {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS n FROM achats_tva WHERE entreprise_id = $1 AND fournisseur = $2`,
    [entrepriseId, marque]
  );
  return rows[0].n;
}

async function creerCompte(ctx: Ctx, role: "commercial" | "facturation", email: string) {
  const donne = await donnerUnAcces(ctx, {
    nom: role === "commercial" ? "Commercial d'essai" : "Facturation d'essai",
    email,
    motDePasse: MOT_DE_PASSE,
    confirmation: MOT_DE_PASSE,
    role,
  });
  assert.deepEqual(donne, { ok: true }, `le compte ${role} n'a pas pu être créé`);
  // Les documents légaux, acceptés d'avance : un compte neuf est renvoyé à
  // `/documents-legaux`, et cette garde-là s'exécute avant celle des rôles.
  const lui = (await listerAcces(ctx)).find((l) => l.email === email)!;
  const aAccepter = await documentsAAccepter(lui.utilisateurId);
  if (aAccepter.length > 0) {
    await enregistrerAcceptations(
      lui.utilisateurId,
      aAccepter.map((d) => d.id),
      { adresseIp: "127.0.0.1", agentUtilisateur: "suite d'essai" }
    );
  }
}

async function seConnecter(navigateur: Awaited<ReturnType<typeof lancerNavigateur>>, email: string, motDePasse: string) {
  const ctx = await navigateur.newContext({ viewport: { width: 390, height: 664 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', motDePasse);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
  return page;
}

async function main() {
  console.log("=== Le commercial ne facture pas, dans un navigateur ===\n");

  const { rows } = await pool.query(
    `SELECT me.utilisateur_id AS u, me.entreprise_id AS e
       FROM membres_entreprise me
       JOIN users usr ON usr.id = me.utilisateur_id
      WHERE usr.email = 'demo@atlas.local' AND me.role = 'proprietaire'
      LIMIT 1`
  );
  assert.ok(rows[0], "le compte de démonstration n'est pas patron : la base n'est pas amorcée");
  const ctxPatron: Ctx = { utilisateurId: rows[0].u, entrepriseId: rows[0].e };

  const marque = Date.now().toString(36);
  const NOM_PATRON = `Essai patron ${marque}`;
  const NOM_COMMERCIAL = `Essai commercial ${marque}`;
  const NOM_FACTURATION = `Essai facturation ${marque}`;

  const emailC = `commercial-facture-${marque}@essai.local`;
  const emailF = `facturation-${marque}@essai.local`;
  await creerCompte(ctxPatron, "commercial", emailC);
  await creerCompte(ctxPatron, "facturation", emailF);

  mkdirSync(CAPTURES, { recursive: true });
  const navigateur = await lancerNavigateur();

  // ─── LE PATRON : on capture SA requête de facturation ────────────────────
  const pageP = await seConnecter(navigateur, "demo@atlas.local", "demo1234");

  type Capturee = { url: string; enTetes: Record<string, string>; corps: string };
  let capturee: Capturee | null = null;
  pageP.on("request", (r) => {
    if (r.method() !== "POST") return;
    const enTetes = r.headers();
    if (!enTetes["next-action"]) return;
    const corps = r.postData() ?? "";
    // Celle de l'achat, reconnue au nom du fournisseur qu'on vient de taper.
    if (!corps.includes(NOM_PATRON)) return;
    capturee = { url: r.url(), enTetes, corps };
  });

  await cas("le patron enregistre un achat de TVA — on capture l'appel", async () => {
    await pageP.goto(`${BASE}/termines/tva`, { waitUntil: "networkidle" });
    // Le second geste du bloc « Pour faire monter la déductible » : écrire à la
    // main. On vise la STRUCTURE, jamais le libellé (`CLAUDE.md` §5 bis).
    const gestes = pageP.locator('[data-atlas="gestes-deductible"] button');
    await gestes.first().waitFor({ state: "visible", timeout: 30_000 });
    await gestes.nth(1).click();
    await pageP.fill('input[placeholder="Station, magasin…"]', NOM_PATRON);
    await pageP.fill('input[placeholder="0,00 €"]', "120,00");
    await pageP.fill('input[placeholder="20"]', "20");
    await pageP.screenshot({ path: `${CAPTURES}/patron-achat.png` });
    // Le bouton d'engagement : le dernier de la feuille, plein.
    await pageP.locator('button:has-text("Ajouter")').last().click();
    await pageP.waitForFunction(
      (nom) => !document.body.textContent?.includes("Envoi…") && document.body.textContent?.includes(nom),
      NOM_PATRON,
      { timeout: 30_000 }
    );
    assert.equal(await compterAchats(ctxPatron.entrepriseId, NOM_PATRON), 1, "l'achat du patron n'est pas en base");
    assert.ok(capturee, "aucune requête d'action serveur n'a été interceptée : la suite ne mesurerait rien");
  });

  // ─── LE COMMERCIAL : il rejoue la MÊME requête ───────────────────────────
  const pageC = await seConnecter(navigateur, emailC, MOT_DE_PASSE);

  await cas("LA REQUÊTE DE FACTURATION FORGÉE EST REFUSÉE AU COMMERCIAL", async () => {
    const c = capturee!;
    const forgee = c.corps.replace(NOM_PATRON, NOM_COMMERCIAL);
    assert.notEqual(forgee, c.corps, "le corps n'a pas été modifié : on ne saurait pas distinguer les deux achats");

    const reponse = await pageC.request.post(c.url, {
      headers: {
        // **Les mêmes en-têtes**, cookie mis à part : c'est le contexte du
        // commercial qui porte le sien. Reproduire l'appel à l'identique est
        // tout l'objet — un refus obtenu en changeant la requête ne prouverait
        // rien.
        "next-action": c.enTetes["next-action"],
        "content-type": c.enTetes["content-type"] ?? "text/plain;charset=UTF-8",
      },
      data: forgee,
    });

    assert.equal(
      await compterAchats(ctxPatron.entrepriseId, NOM_COMMERCIAL),
      0,
      `LE COMMERCIAL A ÉCRIT DANS LE RELEVÉ DE TVA (réponse ${reponse.status()}) : ` +
        "la garde serveur ne tient pas, et fermer l'onglet ne servait à rien"
    );
  });

  await cas("LA MÊME REQUÊTE, REJOUÉE PAR LA FACTURATION, ÉCRIT — on n'a pas cassé le rôle", async () => {
    // Sans cette moitié, on serait vert en ayant fermé la facturation à tout le
    // monde : le refus serait alors une panne, pas une garde.
    const pageF = await seConnecter(navigateur, emailF, MOT_DE_PASSE);
    const c = capturee!;
    await pageF.request.post(c.url, {
      headers: {
        "next-action": c.enTetes["next-action"],
        "content-type": c.enTetes["content-type"] ?? "text/plain;charset=UTF-8",
      },
      data: c.corps.replace(NOM_PATRON, NOM_FACTURATION),
    });
    assert.equal(
      await compterAchats(ctxPatron.entrepriseId, NOM_FACTURATION),
      1,
      "la facturation non plus n'écrit plus : la garde refuse tout le monde"
    );
    await pageF.goto(`${BASE}/termines/tva`, { waitUntil: "networkidle" });
    await pageF.screenshot({ path: `${CAPTURES}/facturation-tva.png` });
    assert.ok(
      pageF.url().includes("/termines/tva"),
      `la facturation est renvoyée de son propre écran de TVA (${pageF.url()})`
    );
  });

  // ─── L'ÉCRAN DU COMMERCIAL ───────────────────────────────────────────────
  await cas("le commercial n'a plus « Terminés » dans sa barre, et l'adresse le renvoie", async () => {
    await pageC.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await pageC.waitForSelector('nav[aria-label="Navigation principale"]', { timeout: 30_000 });
    await pageC.screenshot({ path: `${CAPTURES}/commercial-accueil.png` });
    const onglets = await pageC.locator('nav[aria-label="Navigation principale"] a').evaluateAll((a) =>
      a.map((x) => (x as HTMLAnchorElement).getAttribute("href"))
    );
    // Un contrôle qui mesure zéro ne mesure rien (`CLAUDE.md` §5).
    assert.ok(onglets.length >= 3, `la barre du bas n'a pas été lue (${onglets.length} onglets)`);
    assert.ok(!onglets.includes("/termines"), `« Terminés » est encore proposé au commercial : ${onglets.join(", ")}`);
    assert.ok(onglets.includes("/planning"), "le commercial a perdu son planning");

    // **Et l'adresse tapée à la main est refusée** : masquer n'est pas fermer.
    await pageC.goto(`${BASE}/termines/tva`, { waitUntil: "networkidle" });
    assert.ok(
      !pageC.url().includes("/termines"),
      `le commercial atteint encore /termines/tva (${pageC.url()})`
    );
  });

  await cas("LE COMMERCIAL GARDE SES DEVIS ET SON PLANNING — on ne l'a pas amputé", async () => {
    // La contrepartie du contrôle précédent. Sans elle, on aurait pu tout
    // fermer et croire l'application sûre en ayant cassé le métier de
    // quelqu'un.
    await pageC.goto(`${BASE}/planning`, { waitUntil: "networkidle" });
    assert.ok(pageC.url().includes("/planning"), `le commercial est renvoyé de son planning (${pageC.url()})`);
    await pageC.goto(`${BASE}/clients`, { waitUntil: "networkidle" });
    assert.ok(pageC.url().includes("/clients"), `le commercial est renvoyé des clients (${pageC.url()})`);
    await pageC.screenshot({ path: `${CAPTURES}/commercial-clients.png` });
  });

  await cas("la facturation n'atteint pas Paysage ni les réglages de l'entreprise", async () => {
    const pageF2 = await seConnecter(navigateur, emailF, MOT_DE_PASSE);
    for (const ferme of ["/paysage", "/reglages/identite", "/reglages/tarifs", "/reglages/equipe"]) {
      await pageF2.goto(`${BASE}${ferme}`, { waitUntil: "networkidle" });
      assert.ok(!pageF2.url().includes(ferme), `la facturation atteint ${ferme} (${pageF2.url()})`);
    }
    // Et ses propres réglages restent à elle : sinon elle ne peut plus changer
    // son mot de passe.
    await pageF2.goto(`${BASE}/reglages/connexion`, { waitUntil: "networkidle" });
    assert.ok(
      pageF2.url().includes("/reglages/connexion"),
      `la facturation ne peut plus changer son mot de passe (${pageF2.url()})`
    );
    await pageF2.goto(`${BASE}/reglages`, { waitUntil: "networkidle" });
    await pageF2.screenshot({ path: `${CAPTURES}/facturation-reglages.png` });
  });

  await navigateur.close();
  console.log(
    echecs === 0
      ? `\n✅ Le commercial ne facture pas — 0 échec(s). Captures dans ${CAPTURES}/.`
      : `\n❌ Le commercial ne facture pas — ${echecs} échec(s).`
  );
  await pool.end();
  process.exit(echecs === 0 ? 0 : 1);
}

main();
