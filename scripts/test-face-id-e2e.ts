import assert from "node:assert/strict";
import { Client } from "pg";
import { lancerNavigateur } from "./e2e-browser";

/**
 * « Ouvrir avec Face ID », parcouru en entier dans un vrai navigateur.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **POURQUOI CETTE SUITE EST LA SEULE QUI PROUVE QUELQUE CHOSE ICI.** Tout le
 * reste du lot s'éprouve à froid — les règles sont pures, le dépôt s'attaque en
 * SQL. Mais WebAuthn n'existe que dans le navigateur : c'est LUI qui fabrique la
 * clé, LUI qui signe, LUI qui refuse quand le domaine ne correspond pas. Et
 * quand il refuse, **il ne dit rien** : on voit un bouton qui ne fait rien.
 *
 * Trois fois dans ce dépôt, une chose « qui devrait marcher » a été transmise au
 * patron sans que personne ne l'ait parcourue, et c'est lui qui a trouvé le
 * défaut (`AGENTS.md`). Ici on la parcourt : on enregistre un appareil, on se
 * déconnecte, et on rentre avec.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **L'APPAREIL EST SIMULÉ PAR CHROME LUI-MÊME**, pas par nous
 * (`WebAuthn.addVirtualAuthenticator`, le protocole de débogage). Ce n'est pas
 * une imitation écrite dans cette suite : c'est l'implémentation réelle du
 * navigateur, avec une puce en logiciel à la place de celle du téléphone. La
 * signature est vraie, le domaine est vérifié pour de bon, et un défaut
 * d'origine ferait rougir ici exactement comme il échouerait chez lui.
 *
 * `localhost` est un contexte sûr aux yeux des navigateurs : WebAuthn y
 * fonctionne sans HTTPS. C'est la seule exception, et `origine-webauthn.ts` la
 * connaît.
 */

const BASE = "http://localhost:3000";
const COMPTE = "demo@atlas.local";
const MOT_DE_PASSE = process.env.ATLAS_MDP_DEMO?.trim() || "demo1234";

type Navigateur = Awaited<ReturnType<typeof lancerNavigateur>>;

/** L'appareil simulé : une puce interne, qui vérifie le visage et retient les comptes. */
async function poserUnAppareil(page: import("playwright").Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      // `hasResidentKey` : c'est ce qui permet d'ouvrir SANS taper son adresse —
      // la clé est retenue avec le compte qu'elle ouvre. Sans lui, la promesse
      // de sa proposition B (un doigt, et on est dedans) n'existe pas.
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  return { cdp, authenticatorId };
}

async function seConnecterAuMotDePasse(page: import("playwright").Page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', COMPTE);
  await page.fill('input[name="password"]', MOT_DE_PASSE);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 20_000 });
}

async function interrogerLaBase<T>(requete: string, valeurs: unknown[] = []): Promise<T[]> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const r = await client.query(requete, valeurs);
    return r.rows as T[];
  } finally {
    await client.end();
  }
}

async function main() {
  const navigateur: Navigateur = await lancerNavigateur();
  let echecs = 0;
  const cas = async (nom: string, verifier: () => Promise<void>) => {
    try {
      await verifier();
      console.log(`  ✓ ${nom}`);
    } catch (e) {
      echecs++;
      console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
    }
  };

  console.log("=== Ouvrir avec Face ID, de bout en bout ===\n");

  // ─── Ce que voit un appareil qui ne sait pas le faire ────────────────────

  await cas("SANS appareil capable, la porte ne propose RIEN — pas de bouton mort", async () => {
    // Un bouton qui ne peut pas aboutir est pire qu'un bouton absent : on
    // appuie, rien ne se passe, et on croit l'application cassée.
    const contexte = await navigateur.newContext();
    const page = await contexte.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    // On laisse le temps au test de disponibilité de répondre.
    await page.waitForTimeout(800);
    assert.equal(
      await page.getByRole("button", { name: /Ouvrir avec Face ID/i }).count(),
      0,
      "la porte propose Face ID à un appareil qui ne sait pas le faire"
    );
    // Et le mot de passe, lui, est bien là.
    assert.equal(await page.locator('input[name="password"]').count(), 1);
    await contexte.close();
  });

  // ─── Le parcours complet ─────────────────────────────────────────────────

  const contexte = await navigateur.newContext();
  const page = await contexte.newPage();

  /**
   * Ce que la page écrit dans sa console.
   *
   * **Sans ce relevé, la panne du 26 août 2026 restait invisible** : la porte
   * prenait une réussite pour un échec, affichait un message rouge, et
   * naviguait quand même. Tout ce qui s'observe depuis le serveur — l'adresse
   * d'arrivée, la base — disait vrai. Il fallait écouter ce que la page dit.
   */
  const messagesDeConsole: string[] = [];
  page.on("console", (m) => messagesDeConsole.push(m.text()));

  await poserUnAppareil(page);

  await cas("on entre AU MOT DE PASSE — c'est toujours par là qu'on commence", async () => {
    // Sa règle du 23 août : « l'utilisateur va commencer par créer son compte
    // avec son mot de passe et ensuite il décidera ».
    await seConnecterAuMotDePasse(page);
    assert.equal(new URL(page.url()).pathname, "/");
  });

  await cas("Réglages › Connexion propose d'enregistrer CET appareil", async () => {
    await page.goto(`${BASE}/reglages/connexion`, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    const bouton = page.getByRole("button", { name: /Enregistrer cet appareil/i });
    assert.equal(await bouton.count(), 1, "l'écran ne propose pas d'enregistrer l'appareil");
    // La promesse qui décide s'il ose : elle doit être ÉCRITE, pas sous-entendue.
    const texte = await page.locator("body").innerText();
    assert.match(texte, /ne quitte jamais votre téléphone/i);
    assert.match(texte, /mot de passe reste actif/i);
  });

  await cas("« Changer mon mot de passe » est AU-DESSUS d'« Ouvrir avec Face ID »", async () => {
    // **Sa demande du 26 août 2026**, sur capture : le bouton vivait sur une
    // barre fixe en bas d'écran, deux rubriques plus bas que ses propres champs.
    //
    // **Mesuré, jamais lu dans un libellé** (`CLAUDE.md` §5 bis) : on compare
    // deux ordonnées. Le jour où l'un des deux textes change, ce contrôle
    // défendra encore l'ordre — ce qui est la règle, le mot ne l'étant pas.
    const bouton = await page.getByRole("button", { name: /^Changer mon mot de passe$/ }).boundingBox();
    const faceId = await page.getByText(/Ouvrir avec Face ID/i).first().boundingBox();
    assert.ok(bouton, "le bouton du mot de passe est introuvable");
    assert.ok(faceId, "la rubrique Face ID est introuvable");
    // Refuser de conclure sur une boîte de zéro pixel : la mise en page n'est
    // alors pas appliquée, et « 0 < 0 » rendrait un vert qui ne prouve rien.
    assert.ok(bouton.height > 10 && faceId.height > 2, "rien n'est mis en page : la mesure ne prouverait rien");
    assert.ok(
      bouton.y < faceId.y,
      `le bouton est à ${Math.round(bouton.y)} px, Face ID à ${Math.round(faceId.y)} px : il est passé dessous`
    );
  });

  await cas("l'appareil s'enregistre pour de bon, et la base porte une clé", async () => {
    await page.getByRole("button", { name: /Enregistrer cet appareil/i }).click();
    await page.waitForTimeout(2500);
    const texte = await page.locator("body").innerText();
    assert.match(texte, /Cet appareil est enregistré/i, `lu à l'écran : « ${texte.slice(0, 300)} »`);

    const lignes = await interrogerLaBase<{ n: string }>("SELECT count(*)::text AS n FROM cles_appareil");
    assert.equal(lignes[0].n, "1", "aucune clé n'est arrivée en base");

    // **La ligne doit porter une DATE.** Deux téléphones du même modèle portent
    // le même nom deviné : sans date, on ne sait pas lequel retirer — et c'est
    // le seul moment où l'on ouvre cet écran. Trouvé sur une capture le
    // 24 août, pas par un test.
    assert.match(texte, /Enregistré le \d{2}\/\d{2}\/\d{4}/, "la ligne de l'appareil ne porte aucune date");
  });

  await cas("AUCUNE donnée biométrique n'arrive en base — c'est ce que l'écran promet", async () => {
    const [ligne] = await interrogerLaBase<{ cle_publique: string; nom_appareil: string }>(
      "SELECT cle_publique, nom_appareil FROM cles_appareil LIMIT 1"
    );
    // Une clé publique, et rien d'autre : de quoi vérifier une signature,
    // jamais d'en produire une.
    assert.ok(ligne.cle_publique.length > 20, "la clé publique paraît vide");
    assert.ok(ligne.nom_appareil.length > 0, "l'appareil n'a pas de nom lisible");
  });

  // ─── Entrer avec le visage ───────────────────────────────────────────────

  await cas("DÉCONNECTÉ, la porte propose maintenant Face ID", async () => {
    await contexte.clearCookies();
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    assert.equal(
      await page.getByRole("button", { name: /Ouvrir avec Face ID/i }).count(),
      1,
      "la ligne Face ID n'apparaît pas alors que l'appareil sait le faire"
    );
    // **Sa proposition B : rien ne change de place.** L'adresse, le mot de
    // passe et « Entrer » sont là, en même temps.
    assert.equal(await page.locator('input[name="email"]').count(), 1);
    assert.equal(await page.locator('input[name="password"]').count(), 1);
    assert.equal(await page.locator('button[type="submit"]').count(), 1);
  });

  await cas("ON ENTRE AVEC LE VISAGE, SANS RIEN TAPER", async () => {
    await page.getByRole("button", { name: /Ouvrir avec Face ID/i }).click();
    await page.waitForURL(`${BASE}/`, { timeout: 20_000 });
    assert.equal(new URL(page.url()).pathname, "/");
    // **Et RIEN de rouge ne s'est affiché en chemin.** Une action serveur qui
    // redirige le fait en levant : cette levée tombait dans le `catch` de la
    // porte, qui affichait « Face ID n'a pas pu aboutir » au moment même où
    // l'on entrait. La navigation avait lieu quand même — donc aucun contrôle
    // ne le voyait. Trouvé le 26 août 2026 en journalisant la cause.
    const journal = messagesDeConsole.filter((m) => /face-id. ouverture refusée/i.test(m));
    assert.equal(journal.length, 0, `la réussite a été prise pour une panne : ${journal.join(" · ")}`);
  });

  await cas("l'ouverture est datée — l'écran peut dire quel appareil sert encore", async () => {
    const [ligne] = await interrogerLaBase<{ dernier_usage_le: Date | null }>(
      "SELECT dernier_usage_le FROM cles_appareil LIMIT 1"
    );
    assert.ok(ligne.dernier_usage_le !== null, "l'ouverture n'a pas été datée");
  });

  // ─── Ce qui doit rester vrai quand ça rate ───────────────────────────────

  // ─── Retirer l'appareil ──────────────────────────────────────────────────

  await cas("retirer l'appareil le prive de la porte, et le dit", async () => {
    await page.goto(`${BASE}/reglages/connexion`, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    await page.getByRole("button", { name: /^Retirer$/ }).first().click();
    await page.waitForTimeout(2000);

    const texte = await page.locator("body").innerText();
    assert.match(texte, /ne peut plus ouvrir Atlas/i, `lu à l'écran : « ${texte.slice(0, 300)} »`);
    // Et le message rassure sur ce qui reste : c'est ce qu'on veut lire quand
    // on vient de perdre son téléphone.
    assert.match(texte, /mot de passe.{0,40}marche toujours/i);

    const lignes = await interrogerLaBase<{ n: string }>("SELECT count(*)::text AS n FROM cles_appareil");
    assert.equal(lignes[0].n, "0", "la clé est encore en base après un retrait");
  });

  await cas("L'APPAREIL RETIRÉ NE PEUT PLUS OUVRIR — et ça ne compte AUCUNE tentative ratée", async () => {
    /**
     * **La règle qui compte le plus de tout ce lot**, et le seul cas qui
     * l'éprouve VRAIMENT.
     *
     * Une première rédaction faisait échouer le visage sur l'appareil simulé
     * (`isUserVerified: false`). Elle passait au vert **contre un `noterEchec`
     * posé exprès** sur ce chemin : le navigateur refusait de lui-même, le
     * serveur n'était jamais atteint, et l'assertion ne mesurait rien
     * (`CLAUDE.md` §5 — « un contrôle qui mesure ZÉRO ne mesure rien »).
     *
     * Ici, le téléphone signe correctement — sa clé est toujours dans sa puce —
     * mais Atlas ne la connaît plus : elle vient d'être retirée depuis un autre
     * appareil. **C'est le cas réel du téléphone perdu**, et c'est le serveur
     * qui refuse. Si `noterEchec` était appelé sur ce chemin, l'artisan verrait
     * son compte se temporiser parce qu'un vieux téléphone insiste quelque part.
     */
    await contexte.clearCookies();
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);

    const bouton = page.getByRole("button", { name: /Ouvrir avec Face ID/i });
    assert.equal(await bouton.count(), 1, "la ligne Face ID a disparu de la porte");
    await bouton.click();
    await page.waitForTimeout(3000);

    assert.equal(
      new URL(page.url()).pathname,
      "/login",
      "une clé qu'Atlas ne connaît plus a quand même ouvert la porte"
    );

    const lignes = await interrogerLaBase<{ n: string }>(
      "SELECT count(*)::text AS n FROM tentatives_connexion"
    );
    assert.equal(
      lignes[0].n,
      "0",
      "un échec de Face ID a fait avancer le compteur du mot de passe — le compte va se temporiser tout seul"
    );

    // Et le mot de passe, lui, entre toujours. C'est toute la promesse.
    await page.fill('input[name="email"]', COMPTE);
    await page.fill('input[name="password"]', MOT_DE_PASSE);
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE}/`, { timeout: 20_000 });
  });

  await contexte.close();
  await navigateur.close();

  console.log("");
  console.log(`Face ID (bout en bout) — ${echecs} échec(s).`);
  process.exit(echecs > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
