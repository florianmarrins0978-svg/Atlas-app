import { lancerNavigateur } from "./e2e-browser";
import { devices } from "playwright";
import { Pool } from "pg";
import { avecCivilite } from "../src/lib/civilite";

// **« Mme » choisi à la création se retrouve PARTOUT, jusque chez la cliente.**
//
// ─────────────────────────────────────────────────────────────────────────────
// Le patron, le 13 août 2026 : *« tu as raison, il faut intégrer une case
// monsieur-madame. Mais je veux que ça soit sous la forme Mr Mme, en cliquable,
// on choisit au-dessus du nom. »*
//
// **Ce qui est en jeu n'est pas la pastille, c'est ce qu'elle empêche.** Le
// matin même, l'application posait « Mr. » devant tout patronyme nu — y compris
// dans le SMS qui part chez le client. Une cliente lisait « Bonjour Mr. Roux ».
// La règle pure est éprouvée sans navigateur (`test-civilite`) ; ce qui ne
// s'éprouve qu'ici, c'est que le choix **traverse** : formulaire → base →
// devis → message → page publique. Une seule de ces étapes qui oublie de le
// transmettre, et la cliente est mal nommée là précisément où ça se voit.
//
// Le nom est saisi NU, sans « Mme » devant : c'est le cas du patron, et le seul
// où la pastille sert à quelque chose.

const BASE = "http://localhost:3000";
const ECRAN_DU_PATRON = devices["iPhone 13"];
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

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
  console.log("=== La civilité choisie traverse tout le parcours ===\n");

  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ ...ECRAN_DU_PATRON });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  const CLIENTE = `Roux ${Date.now()}`;

  // --- La pastille, au-dessus du nom, comme il l'a demandé -----------------
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });

  await cas("les deux pastilles sont là, et AU-DESSUS du champ du nom", async () => {
    const mr = page.locator('[data-atlas="civilite-mr"]');
    const mme = page.locator('[data-atlas="civilite-mme"]');
    if ((await mr.count()) !== 1 || (await mme.count()) !== 1) {
      throw new Error("« Mr » et « Mme » ne sont pas tous les deux à l'écran");
    }
    // Mesuré, pas déduit de l'ordre du code : c'est la position à l'écran qu'il
    // a demandée, et deux éléments qui se suivent dans le code peuvent
    // s'afficher côte à côte.
    const boiteMme = await mme.boundingBox();
    const boiteNom = await page.locator('input[placeholder="Bernard"]').boundingBox();
    if (!boiteMme || !boiteNom) throw new Error("pastille ou champ absent de l'écran");
    if (boiteMme.y + boiteMme.height > boiteNom.y + 1) {
      throw new Error(
        `la pastille est SOUS le nom (y=${boiteMme.y.toFixed(0)} contre ${boiteNom.y.toFixed(0)})`
      );
    }
  });

  await cas("rien n'est présélectionné — son silence n'est pas un choix", async () => {
    for (const cle of ["mr", "mme"]) {
      const presse = await page.locator(`[data-atlas="civilite-${cle}"]`).getAttribute("aria-pressed");
      if (presse !== "false") throw new Error(`« ${cle} » est présélectionné (aria-pressed=${presse})`);
    }
  });

  await cas("un second appui REND le choix — sinon une erreur ne se reprend plus", async () => {
    const mme = page.locator('[data-atlas="civilite-mme"]');
    await mme.click();
    if ((await mme.getAttribute("aria-pressed")) !== "true") throw new Error("le premier appui ne prend pas");
    await mme.click();
    if ((await mme.getAttribute("aria-pressed")) !== "false") throw new Error("le second appui ne rend pas le choix");
  });

  await page.locator('[data-atlas="civilite-mme"]').click();
  await page.locator('input[placeholder="Bernard"]').fill(CLIENTE);
  await page.locator('input[placeholder="06 12 34 56 78"]').fill("0679984514");
  await page.click('[data-atlas="action-dicter"]');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 30_000 });
  const chantierId = page.url().split("/").pop()!.split("?")[0];

  await cas("le choix est ENREGISTRÉ, pas seulement affiché", async () => {
    const { rows } = await pool.query(`SELECT civilite FROM clients WHERE nom = $1`, [CLIENTE]);
    if (!rows[0]) throw new Error("aucune cliente de ce nom en base");
    if (rows[0].civilite !== "mme") throw new Error(`la base porte « ${rows[0].civilite} »`);
  });

  await cas("le chantier porte « Mme … », et non le défaut", async () => {
    const { rows } = await pool.query(`SELECT nom FROM chantiers WHERE id = $1`, [chantierId]);
    if (rows[0]?.nom !== `Mme ${CLIENTE}`) {
      throw new Error(`le chantier s'appelle « ${rows[0]?.nom} »`);
    }
  });

  // --- Le devis, puis l'envoi ---------------------------------------------
  await page.goto(`${BASE}/chantiers/${chantierId}/devis-complet`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Total TTC", { timeout: 30_000 });

  await cas("le devis ÉCRIT « Mme », et ne propose AUCUNE pastille", async () => {
    // **Le patron, le 13 août 2026 :** *« il ne faut pas qu'il y ait les
    // pastilles cliquables sur le devis. En gros quand on rentre les
    // informations dans la fiche client, si on clique sur monsieur, sur le
    // devis ça sera marqué monsieur. »*
    //
    // Les pastilles y avaient été posées le jour même pour offrir une seconde
    // porte ; il les a retirées. Le devis est le document, pas la fiche : il
    // MONTRE ce qui partira.
    const pastilles = await page.locator('[data-atlas^="civilite-"]').count();
    if (pastilles > 0) {
      throw new Error(`${pastilles} pastille(s) sur l'écran du devis : il n'en veut aucune`);
    }
    // Et le mot doit bien y être, sans quoi le retrait aurait emporté la
    // civilité avec lui — c'est le défaut que ce contrôle existe pour empêcher.
    const bloc = await page.getByText("Client", { exact: true }).locator("..").innerText();
    if (!/\bMme\b/.test(bloc)) {
      throw new Error(`le bloc « Client » n'écrit pas « Mme » : ${bloc.replace(/\s+/g, " ").slice(0, 120)}`);
    }
  });

  await cas("et le nom reste seul dans son champ, sans la civilité", async () => {
    // **Le mot est écrit À CÔTÉ du champ, jamais dedans.** Dans le champ, il
    // deviendrait modifiable et s'enregistrerait comme nom du client : le
    // document suivant porterait « Mme Mme Roux ».
    const saisi = await page.getByLabel("Nom du client").inputValue();
    if (saisi !== CLIENTE) throw new Error(`le champ du nom porte « ${saisi} »`);
  });

  await page.getByRole("button", { name: "+ Ajouter une ligne" }).click();
  await page.waitForTimeout(900);
  await page.getByLabel("Description 1").fill("Taille d'une haie de laurier (20 ml)");
  await page.getByLabel("Prix unitaire 1").fill("350");
  await page.getByLabel("Description 1").click();
  await page.waitForTimeout(1400);

  await page.goto(`${BASE}/chantiers/${chantierId}/devis-complet`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Total TTC", { timeout: 30_000 });

  await cas("le devis la nomme « Mme … » — le mot devant le nom", async () => {
    // **Relu sur le devis, et non plus sur la synthèse d'avant l'envoi.** Cette
    // synthèse a été supprimée le 20 août 2026 (`ARCHITECTURE.md` §135) : c'est
    // désormais le devis lui-même qu'il a sous les yeux au moment d'envoyer.
    //
    // Le mot n'est pas dans le champ — il serait alors recopié dans le nom, et
    // le document suivant porterait « Mme Mme Roux ». Il vit à côté, dans le
    // même bloc : on lit donc les deux ensemble, comme elle les lira.
    const champ = page.getByLabel("Nom du client");
    const mot = (await champ.locator("xpath=..").innerText()).trim();
    if (mot !== "Mme") throw new Error(`le devis écrit « ${mot} » devant le nom`);
    const saisi = await champ.inputValue();
    if (saisi !== CLIENTE) throw new Error(`le champ du nom porte « ${saisi} »`);
  });

  await page.click("text=Choisir la date");
  await page.getByRole("button", { name: /Envoyer le devis/i }).click();
  await page.waitForTimeout(3500);

  await cas("LE MESSAGE QUI PART CHEZ ELLE dit « Bonjour Mme … »", async () => {
    // **Le seul texte qu'elle lit avant d'ouvrir son devis.** C'est ici que
    // l'erreur du matin se voyait, et c'est donc ici qu'il faut regarder.
    const lien = page.locator('a[href^="sms:"], a[href^="mailto:"]');
    await lien.first().waitFor({ state: "visible", timeout: 20_000 }).catch(() => undefined);
    if ((await lien.count()) === 0) throw new Error("aucun message tout prêt sur l'écran");
    const href = decodeURIComponent((await lien.first().getAttribute("href")) ?? "");
    if (!href.includes(`Bonjour Mme ${CLIENTE},`)) {
      const debut = href.slice(href.indexOf("Bonjour"), href.indexOf("Bonjour") + 60);
      throw new Error(`le message s'ouvre sur « ${debut} »`);
    }
  });

  const { rows: envoi } = await pool.query(
    `SELECT e.jeton, d.client_civilite FROM envois_devis e
     JOIN devis d ON d.id = e.devis_id WHERE d.chantier_id = $1`,
    [chantierId]
  );

  await cas("le devis en garde une COPIE — le corriger plus tard ne le réécrit pas", async () => {
    if (!envoi[0]) throw new Error("aucun envoi : le devis n'est pas parti");
    if (envoi[0].client_civilite !== "mme") {
      throw new Error(`le devis porte « ${envoi[0].client_civilite} » au lieu de « mme »`);
    }
  });

  await cas("et la page qu'elle ouvre la nomme de la même façon", async () => {
    await page.goto(`${BASE}/devis/${envoi[0].jeton}`, { waitUntil: "networkidle" });
    const ecran = await page.locator("body").innerText();
    if (!ecran.includes(`Pour Mme ${CLIENTE}`)) {
      const vu = /Pour\s+.*/.exec(ecran)?.[0] ?? "(aucune ligne « Pour … »)";
      throw new Error(`la page dit « ${vu} »`);
    }
  });

  // --- Le client d'AVANT la case, celui qui n'a rien choisi ----------------
  await cas("un client sans choix garde l'apparence qu'il avait ce matin", async () => {
    // **La garantie qui protège ses chantiers en cours.** Le jour où la case est
    // apparue, aucune fiche ne la portait : si l'absence de choix avait effacé
    // la civilité, tous ses devis auraient changé d'en-tête d'un coup.
    const sansChoix = `Martins ${Date.now()}`;
    await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
    await page.locator('input[placeholder="Bernard"]').fill(sansChoix);
    await page.click('[data-atlas="action-dicter"]');
    await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 30_000 });
    const id = page.url().split("/").pop()!.split("?")[0];
    const { rows } = await pool.query(`SELECT nom FROM chantiers WHERE id = $1`, [id]);
    if (rows[0]?.nom !== avecCivilite(sansChoix)) {
      throw new Error(`le chantier s'appelle « ${rows[0]?.nom} » au lieu de « ${avecCivilite(sansChoix)} »`);
    }
    const { rows: c } = await pool.query(`SELECT civilite FROM clients WHERE nom = $1`, [sansChoix]);
    if (c[0]?.civilite !== null) throw new Error(`la base a inventé « ${c[0]?.civilite} »`);
  });

  await navigateur.close();
  await pool.end();

  console.log(`\n${echecs === 0 ? "✅" : "❌"} La civilité choisie — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
