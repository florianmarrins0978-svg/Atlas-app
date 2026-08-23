import assert from "node:assert/strict";
import { devices } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { pool } from "../src/server/db/client";
import { creerPuisFiche } from "./_creer-chantier-e2e";

/**
 * Envoyer la facture en un seul geste.
 *
 * *Le patron, le 22 août 2026, capture à l'appui :* **« Quand je clique sur
 * confirmer le départ de la facture, ça me l'arrête. Après, je clique pour
 * l'envoyer. Ensuite, je dois recliquer pour ouvrir l'application SMS. Ça fait
 * beaucoup trop de clics. […] Envoyer la facture sans la flèche. […] Au-dessus
 * du bouton, remettre le petit encart, soit SMS soit e-mail. »*
 *
 * Retenu sur planche : `docs/maquettes/84-envoyer-la-facture.html`,
 * **proposition B** — et *« le choix SMS ou e-mail, mais de la même forme que
 * sur la page fiche client »*.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QUE CETTE SUITE TIENT, ET QU'AUCUNE AUTRE NE VOIT.**
 *
 * Les suites de facture éprouvent ce qui suit l'émission — le message tout
 * prêt, le PDF, la relance. Elles resteraient toutes vertes si les trois appuis
 * revenaient : elles les feraient l'un après l'autre sans rien signaler.
 *
 * Et surtout : ce bouton **arrête la facture**, ce qui est sans retour. La
 * phrase qui le dit est tout ce qui reste pour l'en avertir, depuis que les
 * deux gestes n'en font qu'un. La perdre ne casserait rien — c'est bien le
 * problème.
 */

const BASE = "http://localhost:3000";

let reussis = 0;
let echecs = 0;
async function cas(nom: string, verifier: () => Promise<void>) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
    reussis++;
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

async function main() {
  console.log("=== Envoyer la facture en un seul geste ===\n");

  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ ...devices["iPhone 13"] });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  // **SON PROPRE CHANTIER, et non le premier venu.** Une suite qui emprunte
  // l'état laissé par une autre gagne seule et tombe en batterie : c'est la
  // faute déjà payée par `test-choisir-la-date-e2e.ts` le 20 août.
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.getByLabel(/Nom du client/i).fill(`Facture ${Date.now()}`);
  await page.fill('input[placeholder="06 12 34 56 78"]', "07 11 22 33 44");
  // La création passe par l'aide PARTAGÉE : le bouton a déjà changé de nom une
  // fois (`action-dicter` → `action-ecrire`), et une suite qui le recopie
  // rougit alors sur la création au lieu de ce qu'elle éprouve.
  const chantierId = await creerPuisFiche(page, BASE);

  // Une ligne de prix, sans quoi la facture serait à zéro euro.
  await page.goto(`${BASE}/chantiers/${chantierId}/devis-complet`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Total TTC", { timeout: 60_000 });
  await page.getByRole("button", { name: "+ Ajouter une ligne" }).click();
  await page.waitForTimeout(900);
  await page.getByLabel("Description 1").fill("Taille d'une haie de laurier");
  await page.getByLabel("Prix unitaire 1").fill("850");
  await page.getByLabel("Description 1").click();
  await page.waitForTimeout(1200);

  // **Le devis doit être PARTI avant de facturer**, et l'écran le refuse
  // autrement : *« facturer un prix que le client n'a pas vu n'a pas de sens »*.
  // Ce refus nomme le bon coupable — c'est lui qui m'a mis sur la voie.
  await page.goto(`${BASE}/chantiers/${chantierId}/devis-complet`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Choisir la date" }).click();
  // **Visé par son repère, jamais par sa phrase.** Cette suite attendait
  // « Une date, ou deux au choix du client ? » — un libellé que le patron a fait
  // changer le 23 août même (« marque quelque chose qui stipule que
  // l'utilisateur peut choisir »). La suite est alors morte sur un délai
  // dépassé, sur du code juste et pour une demande exaucée : c'est `CLAUDE.md`
  // §5 bis, et le repère `data-atlas="invite-dates"` existe exactement pour ça.
  await page.waitForSelector('[data-atlas="invite-dates"]', { timeout: 30_000 });
  await page.getByRole("button", { name: "Envoyer le devis" }).click();
  await page.waitForURL(/localhost:3000\/$/, { timeout: 30_000 });

  await page.goto(`${BASE}/chantiers/${chantierId}/facture`, { waitUntil: "networkidle" });
  // « Le chantier est réalisé ? » → la facture se bâtit depuis le devis. Visé
  // par son libellé EXACT : un motif large attrapait le titre de l'écran.
  const creer = page.getByRole("button", { name: /Créer la facture/i });
  if (await creer.count()) await creer.click();
  // Repéré par son `data-atlas`, jamais par son libellé : c'est justement le
  // libellé qu'on éprouve, et l'attendre lui ferait mourir la suite sur un délai
  // dépassé — un rouge qui n'accuse personne.
  await page.waitForSelector('[data-atlas="envoyer-la-facture"]', { timeout: 60_000 });

  await cas("le bouton dit « Envoyer la facture », SANS flèche", async () => {
    const bouton = page.locator('[data-atlas="envoyer-la-facture"]');
    const dit = (await bouton.innerText()).trim();
    assert.equal(dit, "Envoyer la facture", `le bouton dit « ${dit} »`);
    assert.ok(!/[→>]/.test(dit), `il porte encore une flèche : « ${dit} »`);
    // « Confirmer le départ » ne faisait partir RIEN : il arrêtait. Le mot est
    // parti avec les trois appuis, et ne doit pas revenir.
    const corps = await page.locator("body").innerText();
    assert.ok(
      !/Confirmer le départ/.test(corps),
      "« Confirmer le départ de la facture » est revenu : ce mot promettait un envoi qui n'avait pas lieu"
    );
  });

  await cas("l'encart du canal est là, à la forme de la fiche client", async () => {
    const capsules = page.locator('[data-atlas^="canal-"]');
    assert.equal(await capsules.count(), 2, "les deux capsules SMS / e-mail ne sont pas toutes deux à l'écran");
    // La MÊME capsule que la fiche client : `aria-pressed` la distingue d'un
    // bouton ordinaire, et c'est ce que porte `ChoixCanal`.
    assert.ok(
      await capsules.first().getAttribute("aria-pressed"),
      "la capsule n'annonce pas son état : ce n'est pas la capsule de la fiche client"
    );
  });

  await cas("SA RÈGLE : un canal sans coordonnée reste inerte, jamais masqué", async () => {
    // *« Refuse l'envoi : ça veut dire qu'il communique avec le client par SMS,
    // donc il enverra par SMS. »* Le masquer ferait chercher où il est passé.
    const sansCoordonnee = page.locator('[data-atlas="canal-email"]');
    assert.equal(await sansCoordonnee.count(), 1, "la capsule « Par e-mail » a disparu de l'écran");
    const inerte = await sansCoordonnee.isDisabled();
    const courriel = await page.locator("text=@").count();
    assert.ok(
      inerte || courriel > 0,
      "« Par e-mail » est proposé alors qu'aucune adresse n'est connue : le message s'ouvrirait sans destinataire"
    );
  });

  await cas("CE QUE LE BOUTON ENGAGE est dit sous lui", async () => {
    // Le libellé parle d'envoi ; l'appui ARRÊTE la facture, sans retour. Depuis
    // que les deux gestes n'en font qu'un, cette phrase est tout ce qui reste.
    const corps = await page.locator("body").innerText();
    assert.match(
      corps,
      /vous l['’]arrêtez/i,
      "rien ne dit que l'envoi arrête la facture : le mot « envoyer » cache alors un acte sans retour"
    );
    assert.match(corps, /avoir/i, "la sortie — l'avoir — n'est pas nommée");
  });

  await cas("UN SEUL APPUI : la facture est arrêtée ET la messagerie s'ouvre", async () => {
    await page.locator('[data-atlas="envoyer-la-facture"]').click();

    // Le lien touché pour lui reste dans le document (`ouvrirAdresse` le pose
    // sur `document.body`, hors de l'arbre React) : c'est la seule trace
    // lisible de l'ouverture, et elle survit au rafraîchissement de l'écran.
    const porte = page.locator("a[data-transmission-directe]");
    await porte.waitFor({ state: "attached", timeout: 30_000 });
    const adresse = (await porte.getAttribute("href")) ?? "";
    assert.match(
      adresse,
      /^(sms:|mailto:)/,
      `l'appui n'a ouvert aucune messagerie (« ${adresse.slice(0, 40)} »)`
    );
    assert.ok(
      decodeURIComponent(adresse).includes("/factures/"),
      "le message ouvert ne porte pas le lien de la facture"
    );

    // Et l'acte comptable a bien eu lieu : le mot seul ne suffirait pas.
    const { rows: apres } = await pool.query(
      `SELECT statut FROM factures WHERE chantier_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [chantierId]
    );
    assert.equal(
      apres[0]?.statut,
      "emise",
      "la facture n'a pas été arrêtée : le geste a ouvert un message pour une facture encore en brouillon"
    );
  });

  await contexte.close();
  await navigateur.close();
  await pool.end();

  console.log(
    echecs === 0
      ? `\n✅ Envoyer la facture — ${reussis} réussis, 0 échec.\n`
      : `\n❌ Envoyer la facture — ${echecs} échec(s).\n`
  );
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
