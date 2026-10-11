import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert/strict";
import { Client } from "pg";
import { ADRESSE } from "./_adresse";
import { empreinteDuCode } from "../src/server/empreinte-du-code";

/**
 * « CRÉER UN COMPTE » — le parcours entier, dans un vrai navigateur.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **POURQUOI CETTE SUITE N'EXISTAIT PAS, ET CE QUE CELA A COÛTÉ.**
 *
 * Le 13 septembre 2026, le patron : *« je peux toujours pas créer de compte ! »*
 * — capture à l'appui, l'écran « Une erreur · Cette page n'a pas pu s'afficher ·
 * Référence : 3285538552 ».
 *
 * La règle était pourtant éprouvée (`test-creation-compte.ts`), l'écriture en
 * base aussi (`test-compte-db.ts`). **Aucune suite n'entrait par la porte** :
 * répondre aux seize questions et appuyer sur « Créer mon compte ». C'est
 * exactement la faute du 28 août (`CLAUDE.md` §5 quater) — éprouver la moitié
 * qu'on vient d'écrire, jamais le chemin qu'il emprunte, lui.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **CE QUE LE SECOND CAS DÉFEND, ET C'EST LE CŒUR.**
 *
 * Une base à laquelle il manque une migration fait lever l'écriture, l'action
 * serveur meurt avec, et Next.js jette le patron sur la frontière d'erreur de
 * TOUTE l'application — un numéro opaque, rien dans le journal, seize questions
 * à refaire. La migration est donc réellement retirée ici, et l'on exige que
 * l'écran rende un REFUS LISIBLE plutôt que cet écran-là.
 *
 * Elle rougit sur le code d'avant : c'est ce qui la rend digne de foi
 * (`AGENTS.md`, « un contrôle doit savoir échouer »).
 *
 * **La contrainte est remise dans un `finally`, quoi qu'il arrive.** Une suite
 * qui laisse la base amputée ferait rougir les trente suivantes sur du code
 * juste — et l'on chercherait le défaut n'importe où sauf ici.
 */

const BASE = ADRESSE;
const MOT_DE_PASSE = "chene-tilleul-08";

/** Ce qu'on tape dans chaque case, reconnue par ce qui y est écrit en gris. */
const REPONSES: Record<string, string> = {
  "Prénom": "Camille",
  "Nom": "Perret",
  "Un mot de passe": MOT_DE_PASSE,
  "Confirmez le mot de passe": MOT_DE_PASSE,
  "Numéro de téléphone": "0612345678",
  "Adresse e-mail": "contact@perret-paysage.fr",
  "Nom de l’entreprise": "Perret Paysage",
  "1 000": "1000",
  "Versailles": "Versailles",
  "14 chiffres": "12345678901234",
  "Adresse du siège": "3 rue des Tilleuls, 78000 Versailles",
  "FR…": "FR12345678901",
  "IBAN": "FR7630001007941234567890185",
  "Titulaire du compte": "Perret Paysage",
};

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

/**
 * Répondre aux questions jusqu'au bout, puis appuyer sur « Créer mon compte ».
 *
 * Rend le titre de l'écran d'arrivée — c'est lui qui tranche : « Tout est
 * prêt. » quand le compte existe, « Une erreur » quand la panne est passée à
 * travers.
 */
async function repondreATout(
  page: import("playwright").Page,
  email: string
): Promise<{ titre: string; refus: string }> {
  // **On arrive SANS session, comme quiconque pousse cette porte.** La création
  // de compte ouvre la session elle-même (`creer-un-compte/actions.ts`, et
  // c'est ce qui évite de retaper son mot de passe juste après) : sans ce
  // nettoyage, le second parcours part en « Avant de commencer » — l'écran des
  // documents à accepter — et l'on chercherait le défaut dans la porte.
  await page.context().clearCookies();
  // **`domcontentloaded`, et non `networkidle`.** Sur un banc servi en mode
  // développement, le bandeau de construction interroge le serveur toutes
  // les cinq secondes : le réseau ne se tait jamais, et l'attente expire sur
  // une page parfaitement affichée. On attend ce dont on a besoin — la
  // première question — plutôt qu'un silence qui ne viendra pas.
  await page.goto(`${BASE}/creer-un-compte`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Madame", exact: true }).waitFor({ timeout: 30_000 });

  for (let etape = 0; etape < 30; etape += 1) {
    const titre = ((await page.locator("h1, h2").first().textContent()) ?? "").trim();
    // « Le code reçu à … » : la dix-septième question, celle du code envoyé
    // à l'adresse. Le parcours s'arrête là ; `entrerLeCode` prend la suite.
    if (/Une erreur|Tout est prêt|C’est fait|Le code reçu à/.test(titre)) {
      const refus = ((await page.locator("[role=alert]").first().textContent()) ?? "").trim();
      return { titre, refus };
    }

    // La civilité : deux cases côte à côte, qui n'avancent pas toutes seules.
    const madame = page.getByRole("button", { name: "Madame", exact: true });
    if (await madame.count()) await madame.click();

    // La TVA : deux grandes cartes, qui avancent d'elles-mêmes.
    const oui = page.getByRole("button", { name: /^Oui/ });
    if (await oui.count()) {
      await oui.first().click();
      await page.waitForTimeout(250);
      continue;
    }

    // La forme juridique : le déroulant dessiné par Atlas, jamais celui du
    // téléphone.
    const viseur = page.getByRole("button", { name: /Choisissez/ });
    if (await viseur.count()) {
      await viseur.click();
      await page.getByRole("option").first().click();
    }

    for (const champ of await page.locator("input").all()) {
      const placeholder = (await champ.getAttribute("placeholder")) ?? "";
      const valeur = placeholder === "Votre e-mail" ? email : REPONSES[placeholder];
      if (valeur !== undefined) await champ.fill(valeur);
    }

    const bouton = page.getByRole("button", { name: /Continuer|Créer mon compte/ });
    assert.ok(await bouton.count(), `aucun bouton pour avancer sur « ${titre} »`);
    const dernier = /Créer mon compte/.test((await bouton.textContent()) ?? "");
    await bouton.click();
    // Le serveur écrit trois lignes et ouvre la session : on lui laisse le
    // temps, sans quoi la suite lirait l'écran d'avant et conclurait à tort.
    await page.waitForTimeout(dernier ? 6000 : 300);

    // **Un refus du serveur laisse l'écran sur la dernière question**, et c'est
    // voulu : ce qui vient d'être tapé reste là. Sans cette sortie, la boucle
    // rappuierait sur « Créer mon compte » jusqu'à épuiser le limiteur, et la
    // suite accuserait un dépassement de délai plutôt que de lire le refus.
    if (dernier) {
      const refus = ((await page.locator("[role=alert]").first().textContent()) ?? "").trim();
      if (refus) return { titre: ((await page.locator("h1, h2").first().textContent()) ?? "").trim(), refus };
    }
  }

  // Le message nomme où l'on s'est arrêté : « jamais abouti », seul, envoie
  // chercher dans la création de compte un défaut qui peut être ailleurs.
  throw new Error(
    `le parcours n'a jamais abouti en trente étapes — dernier écran : « ${(
      (await page.locator("h1, h2").first().textContent()) ?? ""
    ).trim()} », refus : « ${((await page.locator("[role=alert]").first().textContent()) ?? "").trim()} »`
  );
}

/**
 * Le rôle sous lequel cette suite regarde et touche la base.
 *
 * **`DATABASE_URL` d'abord, et ce n'est pas l'ordre habituel.** Les suites
 * navigateur tournent délibérément sous un rôle qui TRAVERSE la RLS, parce
 * qu'elles inspectent la base pour vérifier ce qu'elles affirment
 * (`CLAUDE.md` §5). Prendre `DATABASE_ADMIN_URL` ici rendrait zéro ligne sur
 * `membres_entreprise`, qui porte `FORCE ROW LEVEL SECURITY` — un rouge sur du
 * code juste, et l'on chercherait le défaut dans la création de compte.
 */
function adressePourInspecter(): string {
  const url = process.env.DATABASE_URL ?? process.env.DATABASE_ADMIN_URL;
  assert.ok(url, "ni DATABASE_URL ni DATABASE_ADMIN_URL : on ne conclut pas");
  return url;
}

async function surLaBase<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: adressePourInspecter() });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/**
 * « Recevoir » le code sans service d'envoi.
 *
 * Le code n'existe nulle part en clair — la base ne porte que son empreinte
 * HMAC. La suite fait donc ce que ferait la boîte mail : elle POSE un code
 * connu, en écrivant l'empreinte avec le même secret que le serveur
 * (`AUTH_SECRET`, que la batterie lui donne). Rien n'est contourné : l'écran
 * doit ensuite taper ce code, et un mauvais code doit être refusé.
 */
async function forgerLeCode(email: string, code: string) {
  const secret = process.env.AUTH_SECRET;
  assert.ok(secret, "AUTH_SECRET absent : impossible de forger un code");
  await surLaBase(async (c) => {
    const { rows } = await c.query("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);
    assert.equal(rows.length, 1, "le compte n'est pas en base");
    const { rowCount } = await c.query(
      "UPDATE codes_verification_email SET empreinte = $2 WHERE utilisateur_id = $1",
      [rows[0].id, empreinteDuCode(code, rows[0].id, secret)]
    );
    assert.equal(rowCount, 1, "aucune ligne d'attente : le compte est entré sans code");
  });
}

async function entrerLeCode(page: import("playwright").Page, code: string) {
  await page.getByRole("textbox", { name: "Le code reçu par e-mail" }).fill(code);
  await page.getByRole("button", { name: "Continuer" }).click();
}

async function main() {
  console.log("=== Créer un compte, par la porte ===\n");

  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext();
  const page = await contexte.newPage();

  const email = `porte-${Date.now()}@exemple.fr`;

  await cas("les seize questions mènent au code, et le compte attend son code", async () => {
    const { titre } = await repondreATout(page, email);
    assert.equal(titre, `Le code reçu à ${email}`, `le parcours a fini sur « ${titre} »`);

    const lignes = await surLaBase(async (c) => {
      const { rows } = await c.query(
        `SELECT a.statut FROM users u
           JOIN membres_entreprise m ON m.utilisateur_id = u.id
           JOIN abonnements a ON a.entreprise_id = m.entreprise_id
          WHERE u.email = $1`,
        [email]
      );
      return rows;
    });
    // Trois lignes ou aucune : la transaction est le point délicat de
    // `creation-compte.ts`, et c'est ici qu'on le vérifie pour de bon.
    assert.equal(lignes.length, 1, "le compte, l'adhésion et l'abonnement ne sont pas tous les trois là");
    assert.equal(lignes[0].statut, "essai", "l'essai de quinze jours n'a pas été ouvert");
  });

  await cas("tant que le code n'est pas entré, l'accueil renvoie sur le code", async () => {
    // Le geste du patron : il ferme la porte à mi-chemin et rouvre
    // l'application. La session est là ; la garde doit le ramener au code.
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/verifier-email(?:\?|$)/, { timeout: 30_000 });
    await page.getByRole("heading", { name: `Le code reçu à ${email}` }).waitFor({ timeout: 30_000 });
    // Et les documents légaux non plus ne se lisent pas avant le code.
    await page.goto(`${BASE}/documents-legaux`, { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/verifier-email(?:\?|$)/, { timeout: 30_000 });
  });

  await cas("« Retour » sur l'écran du code rend la porte d'entrée — on n'y reste pas enfermé", async () => {
    // Sa remarque du 14 septembre 2026 au soir : *« je suis bloqué à cette
    // page, il n'existe pas de touche retour si on ne reçoit pas l'email »*.
    await page.goto(`${BASE}/verifier-email`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Retour", exact: true }).click();
    await page.waitForURL(/\/bienvenue(?:\?|$)/, { timeout: 30_000 });
    // La session est bien fermée : l'accueil ne renvoie plus au code, il
    // renvoie à la porte.
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/bienvenue(?:\?|$)/, { timeout: 30_000 });
    // Et le compte, lui, attend toujours son code — rien n'a été perdu.
    const [ligne] = await surLaBase(async (c) => {
      const { rows } = await c.query(
        "SELECT count(*)::int AS attente FROM codes_verification_email v JOIN users u ON u.id = v.utilisateur_id WHERE u.email = $1",
        [email]
      );
      return rows;
    });
    assert.equal(ligne.attente, 1, "la déconnexion a emporté la ligne d'attente");
    // On se reconnecte pour la suite : la connexion d'un compte en attente
    // mène au code, c'est la règle d'`accueilPourEmail`.
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', MOT_DE_PASSE);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/verifier-email(?:\?|$)/, { timeout: 30_000 });
  });

  await cas("un mauvais code est refusé, le bon mène aux documents légaux", async () => {
    await forgerLeCode(email, "004213");
    await page.goto(`${BASE}/verifier-email`, { waitUntil: "domcontentloaded" });
    await entrerLeCode(page, "000000");
    await page.locator("[role=alert]").filter({ hasText: "Code incorrect." }).first().waitFor({ timeout: 30_000 });

    await entrerLeCode(page, "004213");
    await page.waitForURL(/\/documents-legaux(?:\?|$)/, { timeout: 30_000 });
    await page.getByRole("heading", { name: "Avant de commencer" }).waitFor({ timeout: 30_000 });

    const [ligne] = await surLaBase(async (c) => {
      const { rows } = await c.query(
        `SELECT u.email_verified,
                (SELECT count(*)::int FROM codes_verification_email v WHERE v.utilisateur_id = u.id) AS attente
           FROM users u WHERE u.email = $1`,
        [email]
      );
      return rows;
    });
    assert.ok(ligne.email_verified, "email_verified n'est pas daté après le bon code");
    assert.equal(ligne.attente, 0, "la ligne d'attente n'a pas été effacée");
  });

  await cas("« Entrer dans Atlas » passe par les documents légaux AVANT l'accueil", async () => {
    // **Le geste du patron, pas la route.** Sa capture du 14 septembre 2026 :
    // entré par ce bouton, il a travaillé, et les conditions ne lui sont
    // parvenues qu'en rechargeant. La garde du layout ne se rejoue pas sur
    // une navigation côté client — c'est donc CE clic qu'on éprouve, et l'on
    // exige la page d'acceptation, pas seulement « pas l'accueil ».
    //
    // Un second compte, dont le code se tape SUR LA PORTE cette fois : c'est
    // le chemin ordinaire, et c'est lui qui montre l'écran de fin.
    const second = `porte-fin-${Date.now()}@exemple.fr`;
    const { titre } = await repondreATout(page, second);
    assert.equal(titre, `Le code reçu à ${second}`, `le parcours a fini sur « ${titre} »`);
    await forgerLeCode(second, "004213");
    await entrerLeCode(page, "004213");
    await page.getByRole("heading", { name: /Tout est prêt|C’est fait/ }).waitFor({ timeout: 30_000 });
    await page.getByRole("link", { name: "Entrer dans Atlas" }).click();
    await page.waitForURL(/\/documents-legaux(?:\?|$)/, { timeout: 30_000 });
    await page.getByRole("heading", { name: "Avant de commencer" }).waitFor({ timeout: 30_000 });
    assert.ok(
      (await page.getByRole("checkbox").count()) > 0,
      "la page des documents ne propose rien à accepter : un compte neuf devrait avoir les deux textes en attente"
    );
  });

  await cas("UNE BASE EN RETARD SE DIT — elle ne jette plus sur « Une erreur »", async () => {
    // On retire vraiment la migration 0089 : la base refuse alors l'essai,
    // exactement comme sur un espace qui n'a pas rejoué ses migrations.
    await surLaBase(async (c) => {
      await c.query("ALTER TABLE abonnements DROP CONSTRAINT abonnements_statut_connu");
      // **`NOT VALID`, et c'est ce qui évite d'effacer le travail des autres
      // suites.** Une contrainte ordinaire refuserait de se poser tant qu'une
      // ligne « essai » existe — celle que le premier cas vient de créer, et
      // celle que `test-essai-e2e` pose pour son compte. Il faudrait les
      // supprimer, donc défaire ce qu'une autre suite a mis en place. `NOT
      // VALID` ne regarde pas les lignes en place et refuse les nouvelles :
      // exactement l'état d'une base qui n'a pas rejoué sa migration.
      await c.query(
        "ALTER TABLE abonnements ADD CONSTRAINT abonnements_statut_connu CHECK (statut IN ('actif','impaye','resilie')) NOT VALID"
      );
    });

    try {
      const { titre, refus } = await repondreATout(page, `retard-${Date.now()}@exemple.fr`);
      assert.notEqual(titre, "Une erreur", "la panne de base est repassée par l'écran d'erreur muet");
      assert.ok(
        refus.length > 0,
        `aucun refus lisible à l'écran (titre : « ${titre} ») — le patron ne saurait toujours pas pourquoi`
      );
      // **On exige LE message du décalage, pas n'importe quel refus.** Accepter
      // « Réessayez » laisserait passer un vert sur « Trop d'essais depuis cet
      // appareil » — le limiteur, pas la base : un contrôle qui se contente du
      // premier texte venu ne défend rien.
      assert.ok(
        /pas à jour avec sa base|en cours de mise à jour/.test(refus),
        `le refus ne nomme pas la base en retard : « ${refus} »`
      );
    } finally {
      await surLaBase(async (c) => {
        await c.query("ALTER TABLE abonnements DROP CONSTRAINT abonnements_statut_connu");
        await c.query(
          "ALTER TABLE abonnements ADD CONSTRAINT abonnements_statut_connu CHECK (statut IN ('essai','actif','impaye','resilie'))"
        );
      });
    }
  });

  await navigateur.close();

  console.log(`\nCréer un compte par la porte — ${echecs} échec(s).`);
  if (echecs > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
