import assert from "node:assert/strict";
import { Pool } from "pg";
import type { Browser, Page } from "playwright";
import { lancerNavigateur, ECRAN_DU_PATRON } from "./e2e-browser";
import { ADRESSE } from "./_adresse";

// ─────────────────────────────────────────────────────────────────────────────
// **« LE CLIENT S'EST TROMPÉ » — son choix 3 du 7 octobre 2026**
// (`appli/devis-accepte-par-erreur.html`), avec la barre des six secondes.
//
// *« Si jamais un client valide un devis sans faire exprès [...] il nous appelle
// pour nous dire : je me suis trompé. »*
//
// **Elle passe par SON chemin** (`CLAUDE.md` §5 quater) : le client accepte sur
// SA page, le patron ouvre la page Devis, touche le mot, choisit, et attend.
// Puis la base : ce que l'écran affiche ne prouve rien d'une écriture perdue.
//
// Le devis de démonstration « Reprise de toiture » sert de cobaye ; son envoi
// est relevé avant et RENDU tel quel à la fin : les suites se suivent sur la
// même démonstration (`run-e2e-tests.ts`).
// ─────────────────────────────────────────────────────────────────────────────

const BASE = ADRESSE;
const JETON = "demonstration-reprise-toiture";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

let echecs = 0;
async function cas(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** Le client accepte sur sa page, au premier jour qu'elle lui propose. */
async function leClientAccepte(navigateur: Browser) {
  await pool.query(
    "update envois_devis set reponse = null, repondu_at = null, precision_client = null, jours_souhaites = null, expire_at = now() + interval '14 days' where jeton = $1",
    [JETON]
  );
  const contexte = await navigateur.newContext({ ...ECRAN_DU_PATRON });
  const page = await contexte.newPage();
  await page.goto(`${BASE}/devis/${JETON}`, { waitUntil: "networkidle" });
  await page.locator("text=Quelle date vous arrange").waitFor({ timeout: 30_000 });
  // Le premier jour que sa page lui propose, par son libellé (« le samedi 10 octobre »).
  await page.getByText(/^le (lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche) \d+ /).first().click();
  // Un jour dans ses 14 jours demande sa demande écrite : il la coche, comme lui.
  const demande = page.getByText(/Je demande expressément/);
  if (await demande.count()) await demande.click();
  await page.getByRole("button", { name: /J'accepte ce devis/ }).click();
  await page.locator("text=C'est noté").waitFor({ timeout: 30_000 });
  await contexte.close();
  const { rows } = await pool.query(
    "select e.reponse, c.date_planifiee from envois_devis e join chantiers c on c.id = e.chantier_id where e.jeton = $1",
    [JETON]
  );
  assert.equal(rows[0]?.reponse, "acceptee", "Le client n'a pas pu accepter : le cas ne mesure rien.");
  assert.ok(rows[0]?.date_planifiee, "L'acceptation n'a pas posé le chantier : le cas ne mesure rien.");
}

async function ouvrirLaPageDevis(page: Page, chantierId: string) {
  await page.goto(`${BASE}/chantiers/${chantierId}/export`, { waitUntil: "networkidle" });
  await page.locator('[data-atlas="devis-parti"]').waitFor({ timeout: 30_000 });
}

async function etat(): Promise<{ reponse: string | null; date: string | null; traces: number }> {
  const { rows } = await pool.query(
    `select e.reponse, c.date_planifiee::text as date,
            (select count(*)::int from acceptations_defaites a where a.envoi_id = e.id) as traces
       from envois_devis e join chantiers c on c.id = e.chantier_id where e.jeton = $1`,
    [JETON]
  );
  return { reponse: rows[0].reponse, date: rows[0].date, traces: rows[0].traces };
}

async function main() {
  const { rows: avant } = await pool.query("select * from envois_devis where jeton = $1", [JETON]);
  assert.ok(avant[0], "Le devis de démonstration n'existe pas : la base n'est pas amorcée.");
  const chantierId = avant[0].chantier_id as string;
  const { rows: chantierAvant } = await pool.query(
    "select date_planifiee, creneau_debut from chantiers where id = $1",
    [chantierId]
  );

  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ ...ECRAN_DU_PATRON });
  const page = await contexte.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 20_000 });

  try {
    // ── 1. « Il veut une autre date » : la question, la barre, puis l'écriture
    await leClientAccepte(navigateur);
    await ouvrirLaPageDevis(page, chantierId);

    await cas("« Le client s'est trompé » est sous le total, et un appui ne défait rien", async () => {
      const mot = page.locator('[data-atlas="le-client-s-est-trompe"]');
      assert.equal(await mot.count(), 1, "La page d'un devis accepté ne propose pas « Le client s'est trompé ».");
      await mot.click();
      await page.locator('[data-atlas="erreur-du-client"]').waitFor({ timeout: 5_000 });
      assert.equal((await etat()).reponse, "acceptee", "Ouvrir la question a déjà défait l'acceptation.");
      await page.locator('[data-atlas="erreur-du-client"]').getByRole("button", { name: "Annuler" }).click();
      await page.waitForTimeout(300);
      assert.equal(await page.locator('[data-atlas="erreur-du-client"]').count(), 0, "« Annuler » ne referme pas la question.");
    });

    await cas("« Une autre date » : la barre diminue, puis il redevient en attente, hors du planning", async () => {
      await page.locator('[data-atlas="le-client-s-est-trompe"]').click();
      await page.locator('[data-atlas="vers-attente"]').click();
      await page.waitForTimeout(400);
      assert.equal(await page.locator('[data-atlas="barre-qui-diminue"]').count(), 1, "Aucune barre de six secondes.");
      assert.ok(
        await page.getByRole("button", { name: /^Annuler le retrait de / }).isVisible(),
        "« Annuler » ne se voit pas pendant les six secondes."
      );
      assert.ok(
        (await page.locator('[data-atlas="devis-parti"]').innerText()).includes("En attente de réponse"),
        "La page ne dit pas ce qu'elle va devenir."
      );
      assert.equal((await etat()).reponse, "acceptee", "L'écriture est partie avant la fin des six secondes.");
      await page.waitForTimeout(7_500);
      const apres = await etat();
      assert.equal(apres.reponse, null, "Six secondes plus tard, le devis est encore accepté.");
      assert.equal(apres.date, null, "Le chantier est resté au planning.");
      assert.equal(apres.traces, 1, "L'acceptation défaite n'a laissé aucune trace.");
    });

    // ── 2. « Annuler » pendant les six secondes : rien n'est écrit ─────────
    await leClientAccepte(navigateur);
    await ouvrirLaPageDevis(page, chantierId);

    await cas("« Annuler » rend l'acceptation, et la base n'a rien défait", async () => {
      const tracesAvant = (await etat()).traces;
      await page.locator('[data-atlas="le-client-s-est-trompe"]').click();
      await page.locator('[data-atlas="vers-refus"]').click();
      await page.waitForTimeout(400);
      await page.getByRole("button", { name: /^Annuler le retrait de / }).click();
      await page.waitForTimeout(7_000);
      const apres = await etat();
      assert.equal(apres.reponse, "acceptee", "« Annuler » touché, le devis a quand même été noté refusé.");
      assert.ok(apres.date, "« Annuler » touché, le chantier a quand même quitté le planning.");
      assert.equal(apres.traces, tracesAvant, "Une annulation a écrit une trace.");
      assert.ok(
        (await page.locator('[data-atlas="devis-parti"]').innerText()).includes("Devis accepté"),
        "La page ne dit plus « Devis accepté » après l'annulation."
      );
    });

    // ── 3. « Il ne veut plus du devis » ─────────────────────────────────────
    await cas("« Plus de devis » : noté refusé, hors du planning, et la page dit « Devis retourné »", async () => {
      await page.locator('[data-atlas="le-client-s-est-trompe"]').click();
      await page.locator('[data-atlas="vers-refus"]').click();
      await page.waitForTimeout(7_500);
      const apres = await etat();
      assert.equal(apres.reponse, "refusee");
      assert.equal(apres.date, null);
      await ouvrirLaPageDevis(page, chantierId);
      const texte = await page.locator('[data-atlas="devis-parti"]').innerText();
      assert.ok(texte.includes("Devis retourné"), `La page ne dit pas « Devis retourné » : ${texte.slice(0, 200)}`);
      assert.equal(await page.locator('[data-atlas="le-client-s-est-trompe"]').count(), 0, "Le mot reste sur un devis refusé.");
    });
  } finally {
    // **On rend l'envoi et le chantier tels qu'on les a trouvés.** Les traces
    // écrites ici ne s'effacent pas sous `atlas_app` ; ce rôle-ci le peut, et
    // une démonstration rejouée ne doit pas les accumuler.
    const e = avant[0];
    await pool.query("delete from acceptations_defaites where envoi_id = $1", [e.id]);
    await pool.query(
      `update envois_devis set reponse = $2, repondu_at = $3, date_retenue = $4, jours_retenus = $5,
              precision_client = $6, jours_souhaites = $7, expire_at = $8, vu_par_patron_at = $9,
              adresse_ip = $10, agent_utilisateur = $11, demarrage_anticipe = $12
        where id = $1`,
      [
        e.id, e.reponse, e.repondu_at, e.date_retenue, e.jours_retenus ? JSON.stringify(e.jours_retenus) : null,
        e.precision_client, e.jours_souhaites ? JSON.stringify(e.jours_souhaites) : null, e.expire_at,
        e.vu_par_patron_at, e.adresse_ip, e.agent_utilisateur, e.demarrage_anticipe,
      ]
    );
    await pool.query("delete from creneaux_chantier where chantier_id = $1", [chantierId]);
    await pool.query("update chantiers set date_planifiee = $2, creneau_debut = $3 where id = $1", [
      chantierId,
      chantierAvant[0].date_planifiee,
      chantierAvant[0].creneau_debut,
    ]);
    await navigateur.close();
    await pool.end();
  }

  if (echecs > 0) {
    console.error(`\n${echecs} cas en échec.`);
    process.exit(1);
  }
  console.log("\nLe client s'est trompé : la question, six secondes, puis la base.");
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
