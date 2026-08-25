import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { donnerUnAcces, listerAcces } from "../src/server/repositories/membres-entreprise";
import { documentsAAccepter, enregistrerAcceptations } from "../src/server/repositories/documents-legaux";
import type { Ctx } from "../src/server/repositories/context";

// UN VRAI SALARIÉ, DANS UN VRAI NAVIGATEUR — et ce qu'il n'obtient pas.
//
// ═══════════════════════════════════════════════════════════════════════════
// **POURQUOI CETTE SUITE EXISTE, ALORS QUE LA RÈGLE EST DÉJÀ ÉPROUVÉE.**
//
// `test-acces-roles.ts` prouve que la RÈGLE refuse. Il serait vert même si
// personne ne l'appelait — c'est le raccord qui casse, jamais la formule. Ce
// qu'il ne peut pas voir :
//
//   1. **la garde est bien MONTÉE** dans la mise en page, et s'exécute ;
//   2. **le compte créé par le patron OUVRE VRAIMENT une session.** Sans ce
//      contrôle, on aurait pu livrer un écran qui crée des comptes que personne
//      ne peut ouvrir — et c'est son salarié qui l'aurait découvert au pied du
//      chantier, un lundi matin ;
//   3. **le serveur REFUSE, il ne se contente pas de cacher.** Sa demande du
//      25 août, mot pour mot : *« les restrictions d'accès doivent être
//      appliquées côté serveur, et pas uniquement en masquant des boutons ou des
//      pages dans l'interface. »*
//
// ═══════════════════════════════════════════════════════════════════════════
// **CE QU'ON MESURE, ET POURQUOI PAS LE TEXTE DE L'ÉCRAN.**
//
// On lit **l'adresse d'arrivée** et **le code de la réponse**, jamais un
// libellé : si le patron fait retirer un mot demain, ce contrôle défend encore
// quelque chose (`CLAUDE.md` §5 bis). Un salarié qui tape l'adresse d'un devis
// n'arrive pas sur le devis — c'est cela qui compte, pas ce qui est écrit à la
// place.
//
// **Et le PDF se demande hors navigation**, par une requête directe qui porte
// le cookie de session : c'est exactement ce que ferait quelqu'un qui a copié
// l'adresse. Une page ouverte à l'écran aurait pu paraître vide en ayant
// pourtant reçu le fichier.

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE = "http://localhost:3000";
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

async function main() {
  console.log("=== Un salarié, dans un vrai navigateur ===\n");

  // Le contexte du patron de démonstration, lu en base : la suite ne le
  // fabrique pas, elle se branche sur le jeu que le serveur sert déjà.
  const { rows } = await pool.query(
    `SELECT me.utilisateur_id AS u, me.entreprise_id AS e
       FROM membres_entreprise me
       JOIN users usr ON usr.id = me.utilisateur_id
      WHERE usr.email = 'demo@atlas.local' AND me.role = 'proprietaire'
      LIMIT 1`
  );
  assert.ok(rows[0], "le compte de démonstration n'est pas patron : rien à éprouver");
  const ctxPatron: Ctx = { utilisateurId: rows[0].u, entrepriseId: rows[0].e };

  const email = `salarie-${Date.now()}@essai.local`;
  const donne = await donnerUnAcces(ctxPatron, {
    nom: "Malik Benali",
    email,
    motDePasse: MOT_DE_PASSE,
    role: "salarie",
  });
  assert.deepEqual(donne, { ok: true }, "le compte du salarié n'a pas pu être créé");

  /**
   * **Les documents légaux, acceptés d'avance — et c'est cette suite qui l'a
   * appris.**
   *
   * Sa première version attendait `/planning` partout et rendait cinq rouges :
   * un compte NEUF est renvoyé à `/documents-legaux` tant qu'il n'a pas accepté
   * les conditions, et cette garde-là s'exécute avant celle des rôles. Le
   * produit avait raison — le salarié était bien refusé, simplement ailleurs.
   *
   * On accepte donc ici, pour que la suite éprouve ce qu'elle prétend éprouver :
   * le cloisonnement par RÔLE, et non le passage obligé par les conditions, qui
   * a sa propre suite. Sans cela, elle serait restée verte le jour où le rôle
   * cesserait de refuser quoi que ce soit — tout le monde tombant sur
   * `/documents-legaux`.
   */
  const lui = (await listerAcces(ctxPatron)).find((l) => l.email === email)!;
  const aAccepter = await documentsAAccepter(lui.utilisateurId);
  if (aAccepter.length > 0) {
    await enregistrerAcceptations(
      lui.utilisateurId,
      aAccepter.map((d) => d.id),
      { adresseIp: "127.0.0.1", agentUtilisateur: "suite d'essai" }
    );
  }

  // Un devis et une facture réels de l'entreprise : sans eux, un 404 ne
  // prouverait rien — il dirait seulement que la pièce n'existe pas.
  const { rows: pieces } = await pool.query(
    `SELECT (SELECT id FROM devis WHERE entreprise_id = $1 LIMIT 1) AS devis,
            (SELECT id FROM factures WHERE entreprise_id = $1 LIMIT 1) AS facture,
            (SELECT id FROM chantiers WHERE entreprise_id = $1 AND deleted_at IS NULL LIMIT 1) AS chantier`,
    [ctxPatron.entrepriseId]
  );
  const { devis: devisId, facture: factureId, chantier: chantierId } = pieces[0];

  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ viewport: { width: 390, height: 664 } });
  const page = await contexte.newPage();

  await cas("le compte créé par le patron OUVRE une session", async () => {
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', MOT_DE_PASSE);
    await page.click('button[type="submit"]');
    // **Il n'arrive PAS sur `/`** — cet écran ne lui est pas ouvert : la garde
    // le renvoie à son planning. Attendre `/` aurait fait rougir cette suite
    // sur le comportement qu'elle vient prouver.
    await page.waitForURL(`${BASE}/planning`, { timeout: 30_000 });
  });

  await cas("il ne voit que deux onglets", async () => {
    // **On ATTEND la barre avant de la lire.** Sa première version lisait juste
    // après la redirection : elle a rendu une liste VIDE, et « aucun onglet
    // interdit » serait passé pour un succès alors que rien n'avait été mesuré
    // (`CLAUDE.md` §5 — un contrôle qui mesure zéro ne mesure rien).
    await page.waitForSelector('nav[aria-label="Navigation principale"] a', { timeout: 30_000 });
    const onglets = await page.$$eval('nav[aria-label="Navigation principale"] a', (as) =>
      as.map((a) => (a.textContent ?? "").trim())
    );
    assert.ok(onglets.length > 0, "la barre du bas n'a rendu aucun onglet : rien n'a été mesuré");
    assert.deepEqual(onglets, ["Planning", "Réglages"]);
  });

  await cas("l'accueil, les clients et les terminés le renvoient à son planning", async () => {
    for (const chemin of ["/", "/clients", "/termines", "/catalogue"]) {
      await page.goto(`${BASE}${chemin}`, { waitUntil: "networkidle" });
      assert.equal(page.url(), `${BASE}/planning`, `${chemin} ne l'a pas renvoyé au planning`);
    }
  });

  if (chantierId) {
    await cas("la fiche d'un chantier — celle qui porte les prix — lui est fermée", async () => {
      await page.goto(`${BASE}/chantiers/${chantierId}/prix`, { waitUntil: "networkidle" });
      assert.equal(page.url(), `${BASE}/planning`);
    });
  }

  await cas("les réglages de l'entreprise lui sont fermés, les siens lui restent", async () => {
    for (const ferme of ["/reglages/tarifs", "/reglages/identite", "/reglages/equipe", "/reglages/donnees"]) {
      await page.goto(`${BASE}${ferme}`, { waitUntil: "networkidle" });
      assert.equal(page.url(), `${BASE}/planning`, `${ferme} lui est resté ouvert`);
    }
    await page.goto(`${BASE}/reglages/compte`, { waitUntil: "networkidle" });
    assert.equal(page.url(), `${BASE}/reglages/compte`, "son propre compte lui a été fermé");
  });

  /**
   * **LE CŒUR DE CETTE SUITE.** Le PDF d'un devis porte les prix ET les marges.
   * Une page vide ne prouverait rien ; ce qui compte est que le SERVEUR ne
   * produise pas le fichier. On le demande donc comme le ferait quelqu'un qui a
   * copié l'adresse — requête directe, cookie de session porté.
   */
  await cas("aucun PDF de devis ni de facture ne sort pour lui", async () => {
    for (const [quoi, adresse] of [
      ["devis", devisId && `${BASE}/api/devis/${devisId}/pdf`],
      ["facture", factureId && `${BASE}/api/factures/${factureId}/pdf`],
      ["export intégral", `${BASE}/api/mes-donnees`],
    ] as const) {
      if (!adresse) continue;
      const reponse = await page.request.get(adresse);
      assert.notEqual(reponse.status(), 200, `le ${quoi} lui a été servi (${reponse.status()})`);
      const type = reponse.headers()["content-type"] ?? "";
      assert.ok(!type.includes("application/pdf"), `le ${quoi} est arrivé en PDF malgré tout`);
    }
  });

  if (chantierId) {
    await cas("mais SA feuille de chantier, elle, sort — sans un seul montant", async () => {
      // Sans ce contrôle, un refus trop large passerait pour une réussite : on
      // aurait fermé la seule porte qu'il doit avoir (sa décision du 21 août).
      const reponse = await page.request.get(`${BASE}/api/chantiers/${chantierId}/feuille/pdf`);
      // 200 s'il y a un devis, 404 s'il n'y en a pas — jamais un refus de rôle,
      // qui serait indiscernable ici. On éprouve donc que ce n'est PAS le refus
      // de rôle : un chantier sans devis rend le même 404 pour le patron.
      const memeChoseAuPatron = await (async () => {
        const p = await contexte.browser()!.newContext({ viewport: { width: 390, height: 664 } });
        const q = await p.newPage();
        await q.goto(`${BASE}/login`, { waitUntil: "networkidle" });
        await q.fill('input[name="email"]', "demo@atlas.local");
        await q.fill('input[name="password"]', "demo1234");
        await q.click('button[type="submit"]');
        await q.waitForURL(`${BASE}/`, { timeout: 30_000 });
        const r = await q.request.get(`${BASE}/api/chantiers/${chantierId}/feuille/pdf`);
        await p.close();
        return r.status();
      })();
      assert.equal(reponse.status(), memeChoseAuPatron, "la feuille ne répond pas la même chose au salarié");
    });
  }

  await cas("le patron le voit dans « Qui a accès », avec son rôle", async () => {
    const liste = await listerAcces(ctxPatron);
    const lui = liste.find((l) => l.email === email);
    assert.ok(lui, "le salarié n'apparaît pas dans la liste des accès");
    assert.equal(lui.role, "salarie");
  });

  await navigateur.close();
  await pool.end();

  console.log("");
  console.log(`Un salarié dans un vrai navigateur — ${echecs} échec(s).`);
  process.exit(echecs > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
