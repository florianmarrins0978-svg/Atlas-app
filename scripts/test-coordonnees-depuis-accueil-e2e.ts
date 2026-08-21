import { lancerNavigateur } from "./e2e-browser";
import { devices } from "playwright";
import { pool } from "../src/server/db/client";

// **« Adresse non renseignée » ouvre l'écran du chantier.**
//
// ─────────────────────────────────────────────────────────────────────────────
// Le patron, le 17 août 2026, capture de son accueil à l'appui : *« j'ai oublié
// de rentrer les infos du client. Il faut qu'à partir de cette page, il y a
// marqué adresse non renseignée, que je puisse cliquer dessus »*. Puis, devant
// une planche qui inventait une fiche client de toutes pièces : ***« que ça
// m'amène sur la page que je t'ai envoyée sur la deuxième photo. RIEN DE PLUS,
// RIEN DE MOINS. »*** — sa seconde photo montrait l'écran de création.
//
// ─────────────────────────────────────────────────────────────────────────────
// **CE QUE CE CONTRÔLE TIENT, ET QUE LES DEUX AUTRES NE PEUVENT PAS VOIR.**
// `test-nom-chantier` éprouve la règle sans base ; `test-reprendre-chantier-db`
// l'éprouve contre la base. Ni l'un ni l'autre ne sait si le doigt trouve la
// cible, ni où elle mène : les deux seraient verts sur une application où rien
// n'est branché à l'accueil.
//
//   1. la mention est un LIEN, et elle mène aux coordonnées du chantier ;
//   2. **le nom du chantier, lui, ne mène PAS là** — il garde sa reprise. C'est
//      « rien de plus, rien de moins » : il a dit « cliquer DESSUS » ;
//   3. l'écran d'arrivée est celui de la création, avec SES champs ;
//   4. les deux mots que la reprise oblige à changer sont changés — « Nouveau »
//      et « Créer le chantier » mentiraient sur un chantier qui existe ;
//   5. **ce qu'il saisit tient**, et le NOM DU CHANTIER SUIT : sans ce
//      recalcul, la ligne afficherait « Chantier du … » pour toujours, et le
//      défaut serait corrigé partout sauf là où il l'a vu ;
//   6. et la mention disparaît de l'accueil — il n'y a plus rien à compléter.

const BASE = "http://localhost:3000";
const ECRAN_DU_PATRON = devices["iPhone 13"];

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
  console.log("=== « Adresse non renseignée » ouvre l'écran du chantier ===\n");

  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ ...ECRAN_DU_PATRON });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  // **Le chantier de sa capture : ni client, ni adresse.** On le crée par le
  // vrai chemin, en laissant tout vide — c'est ce qu'il a fait, et c'est ce qui
  // produit « Chantier du … ». Fabriquer la ligne à la main éprouverait une
  // forme de donnée que l'application ne produit pas.
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.click('[data-atlas="action-dicter"]');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 30_000 });
  const chantierId = page.url().split("/").pop()!.split("?")[0];

  // **La mention n'est PAS une ancre, et c'est voulu.** Une ligne de l'accueil
  // est un seul `<a>` — trois suites l'ont prouvé le 17 août en tombant d'un
  // coup quand ce lien avait été coupé en trois. La mention vit donc dans
  // l'ancre et détourne le geste ; son `data-href` dit où elle mène.
  const ligne = page.locator(
    `[data-atlas="lieu-manquant"][data-href="/chantiers/${chantierId}/coordonnees"]`
  );

  await cas("la mention est un lien, et elle mène aux coordonnées de CE chantier", async () => {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    if ((await ligne.count()) === 0) {
      const ecran = await page.locator("body").innerText();
      throw new Error(
        "aucune mention cliquable pour ce chantier à l'accueil.\n      " +
          ecran.split("\n").filter((l) => l.trim()).slice(0, 14).join("\n      ")
      );
    }
    const dit = (await ligne.innerText()).trim();
    if (dit !== "Adresse non renseignée") {
      throw new Error(`la mention dit « ${dit} » : ce n'est pas la phrase qu'il a lue`);
    }

    // **Sous un pouce ganté, un texte de 11,5 px n'est pas une cible.** Mesuré
    // à l'écran, pas déduit d'une classe : c'est la hauteur RENDUE qui décide.
    const boite = await ligne.boundingBox();
    if (!boite) throw new Error("la mention n'a aucune boîte : rien à toucher");
    if (boite.height < 34) {
      throw new Error(`la mention fait ${Math.round(boite.height)} px de haut, il en faut 34`);
    }
  });

  await cas("le NOM du chantier, lui, garde sa reprise — « rien de plus »", async () => {
    // S'il menait lui aussi aux coordonnées, la ligne changerait de destination
    // et sa règle du 13 août — « que ça me renvoie à l'étape où je me suis
    // arrêté » — cesserait de valoir. Il a dit « cliquer DESSUS ».
    const cible = await page
      .locator(`a.atlas-brin:has-text("Chantier du")`)
      .first()
      .getAttribute("href");
    if (cible === null) throw new Error("le nom du chantier ne mène nulle part");
    if (/\/coordonnees$/.test(cible)) {
      throw new Error(`la ligne mène aux coordonnées (${cible}) : la mention n'est plus seule`);
    }
  });

  await cas("et la ligne reste UN SEUL lien — l'invariant que trois suites tiennent", async () => {
    // **Payé le 17 août 2026.** La mention avait d'abord été posée en second
    // `<a>`, ce qui obligeait à couper le lien de la ligne en trois : HTML
    // valide, et trois suites tombées d'un coup — `test-dashboard` compte
    // `a.atlas-brin`, `test-suivi-devis` remonte à `ancestor::a[1]` pour lire
    // l'état, `test-transcription` clique au milieu de `.atlas-ligne`. Ce
    // contrôle existe pour que personne ne recommence sans le voir.
    // **On compte les ancres de SA ligne, pas de toutes.** La première version
    // visait `.atlas-ligne:has([data-atlas="lieu-manquant"])` : jouée seule elle
    // trouvait une ligne, jouée dans la batterie elle en trouvait huit — les
    // autres suites créent elles aussi des chantiers sans adresse. Le contrôle
    // annonçait « 8 liens dans la ligne » et accusait la ligne d'un défaut qui
    // était le sien (`AGENTS.md` : un contrôle doit désigner le bon coupable).
    const saLigne = page.locator(
      `.atlas-ligne:has([data-href="/chantiers/${chantierId}/coordonnees"])`
    );
    const ancres = await saLigne.locator("a").count();
    if (ancres !== 1) {
      throw new Error(`${ancres} lien(s) dans SA ligne : il en faut exactement un`);
    }
    // Et cette ancre porte bien tout ce qu'on lit sur la ligne.
    const brin = saLigne.locator("a.atlas-brin").first();
    const dedans = (await brin.innerText()).replace(/\s+/g, " ");
    if (!/Adresse non renseignée/.test(dedans) || !/BROUILLON|DEVIS/i.test(dedans)) {
      throw new Error(`la ligne ne porte pas tout dans son lien : « ${dedans} »`);
    }
  });

  await cas("elle ouvre l'écran de la création, avec SES champs", async () => {
    await ligne.click();
    await page.waitForURL(new RegExp(`/chantiers/${chantierId}/coordonnees$`), { timeout: 30_000 });
    await page.waitForTimeout(400);
    const ecran = await page.locator("body").innerText();
    // Les mots de sa seconde photo, et pas d'autres.
    //
    // **« (facultatif) » a disparu de ces quatre intitulés le 21 août 2026**, à
    // sa demande : *« tu me retires tous les facultatifs, je ne veux plus qu'il
    // y ait marqué facultatif nulle part »*. Ce contrôle réclamait donc ce
    // qu'il venait de faire enlever — on adapte le contrôle, on ne remet pas le
    // mot (`CLAUDE.md` §5 bis). Ce qu'il défend ne change pas : cet écran est
    // bien celui de sa photo, avec SES champs.
    for (const attendu of [
      "Nom du client",
      "Téléphone",
      "E-mail",
      "Adresse du chantier",
      "Ajouter une adresse client différente",
    ]) {
      if (!ecran.toUpperCase().includes(attendu.toUpperCase())) {
        throw new Error(
          `« ${attendu} » manque de l'écran d'arrivée — ce n'est pas celui de sa photo.\n      ` +
            ecran.split("\n").filter((l) => l.trim()).slice(0, 18).join("\n      ")
        );
      }
    }
  });

  await cas("plus un seul « facultatif » sur cet écran", async () => {
    // Un retrait ne tient que par ce qui ne doit PLUS apparaître : sans cela il
    // revient à la première réécriture, et c'est sa demande qui se défait.
    const ecran = await page.locator("body").innerText();
    if (/facultatif/i.test(ecran)) {
      throw new Error(
        "« facultatif » est revenu sur la fiche client — il a demandé de tous les retirer le 21 août"
      );
    }
  });

  await cas("les deux mots qui mentiraient sont changés", async () => {
    const ecran = await page.locator("body").innerText();
    // « Nouveau » au-dessus d'un chantier ouvert il y a trois jours fait douter
    // d'avoir cliqué au bon endroit ; « Créer le chantier » ne créerait rien.
    if (/\bNOUVEAU\b/.test(ecran)) {
      throw new Error("l'écran dit encore « Nouveau » sur un chantier qui existe");
    }
    const bouton = page.locator('[data-atlas="action-creation"]');
    const dit = (await bouton.innerText()).replace(/\s+/g, " ").trim();
    if (/Créer le chantier/i.test(dit)) {
      throw new Error(`le bouton dit « ${dit} » : il ne créerait rien`);
    }
    if (!/Enregistrer/i.test(dit)) throw new Error(`le bouton dit « ${dit} » au lieu d'enregistrer`);
  });

  const CLIENT = `Martins ${Date.now()}`;
  await cas("ce qu'il saisit tient, et le NOM DU CHANTIER suit", async () => {
    await page.locator('input[placeholder="Bernard"]').fill(CLIENT);
    await page.locator('input[placeholder="06 12 34 56 78"]').fill("0679984514");
    await page.locator('input[placeholder="12 rue des Lilas, Nantes"]').fill("10 rue des Lilas, Nantes");
    await page.getByRole("button", { name: /Enregistrer/ }).click();
    await page.waitForURL(new RegExp(`/chantiers/${chantierId}$`), { timeout: 30_000 });

    // **Le nom recalculé est ce qui fait disparaître la ligne fautive.** Sans
    // lui, la base porterait le bon client et l'accueil dirait encore
    // « Chantier du … » : le défaut corrigé partout sauf là où il l'a vu.
    const { rows } = await pool.query(
      `SELECT c.nom, c.adresse_chantier AS adresse, cl.nom AS client, cl.telephone
         FROM chantiers c LEFT JOIN clients cl ON cl.id = c.client_id
        WHERE c.id = $1`,
      [chantierId]
    );
    if (rows.length !== 1) throw new Error("le chantier a disparu de la base");
    if (rows[0].client !== CLIENT) throw new Error(`client « ${rows[0].client} » au lieu de « ${CLIENT} »`);
    // **Le numéro s'espace à l'écran depuis le 21 août 2026, PAS en base.**
    // Cette ligne-là ne bouge donc pas, et c'est tout l'intérêt : la jolie
    // forme est un affichage, les chiffres sont la donnée. Si elle rougit un
    // jour, c'est que l'espacement a débordé jusqu'au stockage — et le
    // rapprochement des clients, le lien d'appel et l'envoi du devis
    // trouveraient tous un numéro qu'ils ne reconnaissent plus.
    if (rows[0].telephone !== "0679984514") throw new Error(`téléphone « ${rows[0].telephone} »`);
    if (rows[0].adresse !== "10 rue des Lilas, Nantes") {
      throw new Error(`adresse « ${rows[0].adresse ?? "vide"} »`);
    }
    if (!rows[0].nom.includes(CLIENT)) {
      throw new Error(`le chantier s'appelle encore « ${rows[0].nom} » : le nom n'a pas suivi`);
    }
  });

  await cas("et la mention a disparu de l'accueil — plus rien à compléter", async () => {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    if ((await ligne.count()) !== 0) {
      throw new Error("la mention est toujours là alors que le client est renseigné");
    }
    const ecran = await page.locator("body").innerText();
    if (!ecran.includes("10 rue des Lilas")) {
      throw new Error("l'adresse saisie ne s'affiche pas sous le nom du chantier");
    }
  });

  await navigateur.close();
  await pool.end();

  console.log(`\n${echecs === 0 ? "✅" : "❌"} La mention qui ouvre le chantier — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
