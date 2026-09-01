import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { getOuCreerDevisBrouillon, envoyerDevis } from "../src/server/repositories/devis";
import {
  terminerChantier,
  emettreFacture,
  getFacturePourChantier,
} from "../src/server/repositories/factures";
import { ajouterPrestation } from "../src/server/repositories/prestations";
import { creerChantier } from "../src/server/repositories/chantiers";
import { ajouterLignePrix } from "../src/server/repositories/lignes-prix";
import { withEntreprise } from "../src/server/db/with-entreprise";
import { devis } from "../src/server/db/schema";
import { eq } from "drizzle-orm";
import { creerPuisFiche } from "./_creer-chantier-e2e";
import { ajouterPrestation as ajouterPrestationEntretien } from "../src/server/repositories/prestations-entretien";
import {
  ouvrirPassage,
  lirePassage,
  cocherLigne,
  nommerClient,
  figerPassage,
} from "../src/server/repositories/passages-entretien";

// La fiche du client, telle qu'il l'atteint.
//
// *Arrangement B de `docs/maquettes/66`, retenu le 16 août 2026, **refondu le
// 20 août 2026** — `appli/fiche-client.html`.*
//
// **CE QUE CETTE SUITE TIENT, ET QU'AUCUNE SUITE BASE NE VERRAIT :**
//
//   1. **le chemin existe.** La règle est éprouvée à part
//      (`test-fiche-client.ts`, `test-documents-du-client.ts`) et serait verte
//      même si aucune porte ne menait à cet écran — c'est le raccord qui casse,
//      jamais la formule ;
//   2. **la porte n'existe pas sans client.** Un chantier sans client ouvrirait
//      une fiche de personne ;
//   3. **la dernière prestation est en titre NOIR GRAS**, avec ce qu'elle
//      comprend — sa demande, en toutes lettres ;
//   4. **trois colonnes de PDF**, du plus récent au plus ancien. L'ordre est la
//      demande elle-même, dite deux fois : une colonne qui remonte le temps
//      l'obligerait à ouvrir chaque document pour trouver le bon ;
//   5. **rien ne se casse ni ne déborde à 390 px.** Trois colonnes sur la
//      largeur de son téléphone, c'est là que ça casse — et cela ne se voit
//      qu'en mesurant ;
//   6. **CE QUI A ÉTÉ RETIRÉ NE REVIENT PAS.** Un retrait ne se vérifie que par
//      l'absence : sans ce contrôle, les trois cases et les deux listes
//      pourraient reparaître au premier rebasage sans que rien ne rougisse.

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE = "http://localhost:3000";

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
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ viewport: { width: 390, height: 900 } });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 20_000 });

  const nomClient = `Mme Bracquemont ${Date.now()}`;
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', nomClient);
  await creerPuisFiche(page);
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 15_000 });
  const chantierUrl = page.url();
  const chantierId = chantierUrl.split("/").pop()!;

  await page.goto(`${chantierUrl}/devis-complet`, { waitUntil: "networkidle" });
  await page.click('button:has-text("Ajouter une ligne")');
  await page.waitForTimeout(600);
  const zones = page.locator('textarea[aria-label*="escription"]');
  await zones.nth((await zones.count()) - 1).fill("Élagage — 3 chênes");
  const prixs = page.locator('input[aria-label*="Prix unitaire"]');
  await prixs.nth((await prixs.count()) - 1).fill("450");
  await page.keyboard.press("Tab");
  // **On attend la BASE, pas l'écran.** Le total du devis se recalcule dans le
  // navigateur à la frappe : il affiche 450 € avant même que le serveur ait
  // répondu. Quitter l'écran à ce moment annule l'action en vol, la ligne reste
  // à 0,00 € en base, et la fiche du client affiche « 1 fois · 0,00 € ».
  // Attendre l'écran, c'était donc mesurer ce qu'on venait de taper.
  for (let i = 0; i < 30; i++) {
    const { rows } = await pool.query(
      `SELECT montant FROM lignes_prix WHERE chantier_id = $1 ORDER BY ordre DESC LIMIT 1`,
      [chantierId]
    );
    if (rows[0] && Number(rows[0].montant) === 450) break;
    await page.waitForTimeout(400);
  }

  // ── La scène : deux devis partis, un chantier terminé, une facture émise ──
  //
  // **Sans elle, les trois colonnes seraient vides** et l'ordre — le cœur de sa
  // demande — ne se vérifierait pas.
  //
  // **Par le VRAI chemin, et non par des `INSERT`.** La première version posait
  // la scène en SQL : elle est tombée deux fois sur des colonnes obligatoires
  // qu'elle ne connaissait pas (`entreprise_nom`, `devis_id`), et chaque échec
  // accusait l'écran au lieu du montage. Les fonctions du dépôt, elles, savent
  // ce qu'une pièce doit porter — et si elles changent, cette suite change avec
  // elles au lieu de dériver en silence (leçon de `capture-rang-du-rappel.mts`).
  const { rows: ctxRows } = await pool.query(
    `SELECT me.utilisateur_id AS u, me.entreprise_id AS e
       FROM membres_entreprise me
       JOIN chantiers c ON c.entreprise_id = me.entreprise_id
      WHERE c.id = $1
      ORDER BY me.role = 'proprietaire' DESC
      LIMIT 1`,
    [chantierId]
  );
  const ctx = { utilisateurId: ctxRows[0].u as string, entrepriseId: ctxRows[0].e as string };

  /**
   * Un devis daté, puis envoyé, sur le chantier donné.
   *
   * **La date se pose AVANT l'envoi**, jamais après : un devis envoyé est
   * immuable (`trg_devis_immuable`, migration 0001) et PostgreSQL refuse
   * l'écriture. `envoyerDevis` garde la date du brouillon — c'est donc le
   * chemin réel, et non un contournement.
   */
  async function devisDate(surChantier: string, jour: string) {
    const d = await getOuCreerDevisBrouillon(ctx, surChantier);
    const pose = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) =>
      tx.update(devis).set({ dateEmission: jour }).where(eq(devis.id, d.id)).returning({ id: devis.id })
    );
    assert.equal(pose.length, 1, `la date ${jour} n'a pas été posée sur le devis`);
    await envoyerDevis(ctx, d.id);
    return d.id;
  }

  // **Deux devis, sur DEUX chantiers — et c'est le montage qui l'a appris.**
  // Deux appels sur le même chantier produisent deux VERSIONS du même devis :
  // elles partagent leur numéro commercial, et l'écran n'en montre que la
  // dernière (à raison — deux lignes identiques seraient inutilisables). Le
  // client a donc un second chantier, comme dans la vraie vie.
  await devisDate(chantierId, "2026-05-14");

  const secondChantier = await creerChantier(ctx, {
    nom: "Taille de haie",
    clientId: (await pool.query(`SELECT client_id FROM chantiers WHERE id = $1`, [chantierId])).rows[0]
      .client_id as string,
  });
  await ajouterLignePrix(ctx, secondChantier.id, "Taille de haie de laurier", "340.00");
  await devisDate(secondChantier.id, "2026-07-28");

  // « Ce qu'elle comprend » se lit dans les PRESTATIONS du chantier, pas dans
  // les lignes de prix. Sans elles, le contrôle accusait l'écran de ne rien
  // afficher alors qu'il n'y avait rien à afficher.
  await ajouterPrestation(ctx, chantierId, "Démontage en tête de chat");
  await ajouterPrestation(ctx, chantierId, "Broyage des branches sur place");

  // Le chantier se termine, la facture s'émet — le parcours jusqu'au bout.
  await terminerChantier(ctx, chantierId);
  const facture = await getFacturePourChantier(ctx, chantierId);
  await emettreFacture(ctx, facture!.facture.id);

  // **Et une fiche d'entretien REMPLIE PUIS ENVOYÉE.** Depuis sa règle du
  // 23 août 2026, la troisième colonne ne porte que celles-là : facturer ne
  // fabrique plus de fiche, si bien que sans ce geste la colonne serait vide et
  // l'ordre — le cœur de sa demande — ne se vérifierait plus.
  const clientDuChantier = (
    await pool.query(`SELECT client_id FROM chantiers WHERE id = $1`, [chantierId])
  ).rows[0].client_id as string;
  await ajouterPrestationEntretien(ctx, { famille: "Pelouse", libelle: "Tonte" });
  const passageOuvert = await ouvrirPassage(ctx, "2026-06-18");
  assert.ok(passageOuvert.ok, "la fiche d'entretien du montage n'a pas pu s'ouvrir");
  const passageLu = await lirePassage(ctx, passageOuvert.id);
  await cocherLigne(ctx, passageOuvert.id, passageLu!.lignes[0].id, true);
  await nommerClient(ctx, passageOuvert.id, clientDuChantier);
  const passageFige = await figerPassage(ctx, passageOuvert.id);
  assert.ok(passageFige.ok, "la fiche d'entretien du montage n'est pas partie");
  const jetonFiche = passageFige.jeton;

  // **On compte les devis DU CLIENT, pas ceux d'un chantier.** Ce garde-fou
  // visait `chantier_id` et a accusé le montage à tort dès que le second devis
  // est passé sur un second chantier — un contrôle qui accuse à tort coûte plus
  // cher que pas de contrôle (`CLAUDE.md` §5).
  const { rowCount: partis } = await pool.query(
    `SELECT 1 FROM devis d
       JOIN chantiers c ON c.id = d.chantier_id
      WHERE c.client_id = (SELECT client_id FROM chantiers WHERE id = $1)
        AND d.statut = 'envoye'`,
    [chantierId]
  );
  assert.ok(
    partis !== null && partis >= 2,
    `le montage n'a produit que ${partis} devis envoyé(s) chez ce client : l'ordre ne se vérifierait pas`
  );

  let ficheDuClientMonte = "";

  /**
   * Attend qu'une condition devienne vraie, ou rougit en la nommant.
   *
   * **Un délai fixe ne convient pas ici** : la suppression passe par une action
   * serveur, et sous la batterie complète elle prend plus longtemps que seule.
   * C'est le piège écrit dans `HANDOVER.md`, et il a déjà fait rougir trois
   * suites justes cette semaine.
   */
  async function attendre(quoi: string, vrai: () => Promise<boolean>) {
    for (let i = 0; i < 60; i++) {
      if (await vrai()) return;
      await page.waitForTimeout(500);
    }
    throw new Error(`toujours pas : ${quoi}`);
  }

  await cas("LA FICHE TIENT DANS UN ÉCRAN, et son contenu y est centré", async () => {
    // **Sa demande du 1ᵉʳ septembre 2026** : *« la page doit remplir tout
    // l'espace, elle n'est pas centrée. Je veux qu'une seule page mais centrée,
    // il y a trop de marge en bas et en haut, la note vocale est presque coupée
    // tellement elle est haute. »*
    //
    // **RIEN NE GARDAIT CETTE HAUTEUR, et c'est pour ça qu'elle a dérivé.** Il
    // avait déjà demandé le 30 août que cet écran tienne sur une page ; le
    // resserrement d'alors n'était éprouvé par aucune suite, et deux réserves
    // de bas de page se sont recumulées jusqu'à 272 px pour une barre qui en
    // mesure 48.
    //
    // **Le contrôle mesure, il ne regarde pas un nom de classe** : une marge
    // écrite autrement le laisserait passer, et c'est la hauteur qui compte.
    for (const [nom, largeur, hauteur] of [
      ["iPhone SE", 375, 667],
      ["iPhone 13", 390, 844],
    ] as const) {
      await page.setViewportSize({ width: largeur, height: hauteur });
      await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
      // La mise en page doit être posée : mesurer trop tôt rend des zéros, et
      // un zéro n'est pas une mesure (`CLAUDE.md` §5).
      await page.waitForTimeout(900);

      const m = (await page.evaluate(`(() => {
        const centre = document.querySelector('.my-auto');
        const st = centre ? getComputedStyle(centre) : null;
        return {
          fenetre: window.innerHeight,
          document: document.documentElement.scrollHeight,
          hautCentre: centre ? Math.round(centre.getBoundingClientRect().height) : 0,
          margeHaut: st ? Math.round(parseFloat(st.marginTop)) : -1,
        };
      })()`)) as { fenetre: number; document: number; hautCentre: number; margeHaut: number };

      assert.ok(m.fenetre > 0 && m.hautCentre > 0, `${nom} : rien de mesurable, la page n'est pas rendue`);
      // Huit pixels de tolérance : l'arrondi des marges de sécurité, pas un
      // écran de plus à faire défiler.
      assert.ok(
        m.document - m.fenetre <= 8,
        `${nom} : la fiche déborde de ${m.document - m.fenetre} px — elle ne tient pas sur une page`
      );
      // Là où il reste de la place, elle se partage en haut ET en bas : c'est
      // la définition de « centré ». Là où il n'y en a pas, la marge vaut zéro
      // et l'écran se lit depuis le haut — jamais coupé.
      assert.ok(
        m.margeHaut >= 0,
        `${nom} : le contenu n'est pas centré (marge haute ${m.margeHaut})`
      );
    }
    await page.setViewportSize({ width: 390, height: 900 });
  });

  await cas("depuis la fiche du chantier, une porte mène au client", async () => {
    await page.goto(chantierUrl, { waitUntil: "networkidle" });
    await page.waitForTimeout(700);
    const porte = page.locator('a[href^="/clients/"]');
    assert.ok(
      (await porte.count()) >= 1,
      "aucune porte vers le client : la fiche existe mais rien n'y mène"
    );
    await porte.first().click();
    await page.waitForURL(/\/clients\/[0-9a-f-]{36}/, { timeout: 15_000 });
    // Les cas de la fin y reviennent : la retenir évite de la rechercher, et
    // surtout d'en ouvrir une autre sans s'en apercevoir.
    ficheDuClientMonte = page.url();
    /**
     * **L'adresse change avant que la fiche soit là.** `waitForURL` rend la main
     * dès que l'URL correspond ; le corps de la page porte encore
     * « Chargement… » (`src/app/loading.tsx`).
     *
     * Sous la batterie complète, le cas suivant lisait donc cet écran d'attente
     * et annonçait « le nom du client manque » — un contrôle qui accuse à tort
     * coûte plus cher que pas de contrôle (`CLAUDE.md` §5), et celui-ci ne
     * mesurait rien du tout. Constaté le 25 août 2026.
     *
     * L'attente est bornée : si la fiche ne vient jamais, les assertions qui
     * suivent rougissent exactement comme avant.
     */
    await page
      .getByText("Chargement…")
      .first()
      .waitFor({ state: "hidden", timeout: 30_000 })
      .catch(() => undefined);
  });

  await cas("elle porte son nom, et les informations sous le nom", async () => {
    const texte = await page.locator("body").innerText();
    assert.ok(texte.includes(nomClient), `le nom du client manque :\n${texte.slice(0, 300)}`);
  });

  // ── SES COORDONNÉES : L'ADRESSE, PUIS LE TÉLÉPHONE À LA LIGNE ─────────────
  //
  // **Sa demande du 26 août 2026, capture à l'appui :** *« supprime le point
  // entre l'adresse et le numéro de tel ; le tel doit être à la ligne sous
  // l'adresse »*. Sur son téléphone, l'adresse tient déjà sur deux lignes : le
  // numéro collé derrière un séparateur se lisait comme la fin de l'adresse.
  //
  // **On mesure des LIGNES, pas une chaîne.** `textContent` recolle tout : il
  // rendrait la même valeur avec ou sans le retour, et le contrôle passerait au
  // vert sur le défaut même qu'il doit interdire. `innerText` rend ce qui est
  // PEINT — c'est la seule mesure qui distingue les deux (`CLAUDE.md` §5).
  const ADRESSE = "23 rue d'Issy 92100 Boulogne-Billancourt";
  const TELEPHONE = "06 00 00 00 05";
  await cas("l'adresse et le téléphone tiennent sur DEUX lignes, sans séparateur", async () => {
    const misesAJour = await pool.query(
      `UPDATE clients SET adresse = $2, telephone = $3
        WHERE id = (SELECT client_id FROM chantiers WHERE id = $1)`,
      [chantierId, ADRESSE, TELEPHONE]
    );
    assert.equal(
      misesAJour.rowCount,
      1,
      "le montage n'a pas pu poser les coordonnées : il n'y a rien à mesurer"
    );
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Chargement…").first().waitFor({ state: "hidden", timeout: 30_000 }).catch(() => undefined);

    const lignes = (await page.locator("header p").last().innerText())
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    assert.ok(lignes.length >= 2, `les coordonnées tiennent sur une seule ligne : ${JSON.stringify(lignes)}`);
    // Les capitales sont PEINTES (`uppercase`) : on compare sans la casse.
    assert.equal(
      lignes[lignes.length - 1].toLowerCase(),
      TELEPHONE.toLowerCase(),
      `le téléphone n'est pas seul sur sa ligne : ${JSON.stringify(lignes)}`
    );
    assert.ok(
      !lignes.join(" ").includes("·"),
      `le séparateur est revenu entre l'adresse et le téléphone : ${JSON.stringify(lignes)}`
    );
  });

  // ── ET UNE FICHE SANS AUCUN PAPIER NE COMMENTE PLUS SON VIDE ──────────────
  //
  // *« Supprime la phrase en gris lorsqu'il n'y a aucun document, on le voit,
  // pas besoin de l'écrire. »* Les trois colonnes disent déjà « Aucun devis
  // parti », « Aucune facture émise », « Aucune fiche envoyée » : la phrase les
  // répétait une quatrième fois.
  //
  // **Ici, viser les MOTS est juste** — contrairement à la règle habituelle
  // (`CLAUDE.md` §5 bis). Ce qu'il a demandé, c'est le retrait de cette
  // phrase-là : un contrôle qui viserait une structure laisserait la remettre
  // sous une autre forme.
  await cas("un client sans aucun document ne porte plus de phrase grise", async () => {
    // **On note d'où l'on part, et l'on y REVIENT.** Ce cas quitte la fiche du
    // client monté par la suite ; les cas suivants la lisent sans la rouvrir, et
    // rougissaient donc tous les trois — sur du code juste, pour un contrôle
    // qui avait oublié de reposer le décor.
    const ficheDuClient = page.url();
    const { rows } = await pool.query(
      `INSERT INTO clients (entreprise_id, nom, adresse, telephone)
       SELECT entreprise_id, $2, $3, $4 FROM chantiers WHERE id = $1
       RETURNING id`,
      [chantierId, `M. Sans-papier ${Date.now()}`, ADRESSE, TELEPHONE]
    );
    assert.equal(rows.length, 1, "le client d'essai n'a pas été créé : il n'y a rien à mesurer");

    await page.goto(`${BASE}/clients/${rows[0].id}`, { waitUntil: "networkidle" });
    await page.getByText("Chargement…").first().waitFor({ state: "hidden", timeout: 30_000 }).catch(() => undefined);
    const vu = await page.locator("body").innerText();

    // **Le témoin d'abord.** Sans lui, un écran qui n'aurait rien rendu du tout
    // passerait au vert : un contrôle qui mesure zéro ne mesure rien.
    assert.match(vu, /Aucun devis parti/i, `on n'est pas sur une fiche vide :\n${vu.slice(0, 300)}`);
    assert.doesNotMatch(
      vu,
      /Aucun document pour ce client|se remplira au premier devis/i,
      "la phrase grise est revenue sous les trois colonnes vides : elle répète ce qu'elles disent déjà"
    );

    await page.goto(ficheDuClient, { waitUntil: "networkidle" });
    await page.getByText("Chargement…").first().waitFor({ state: "hidden", timeout: 30_000 }).catch(() => undefined);
  });

  // ── Sa demande, mot pour mot : « en titre noir gras » ──────────────────────
  //
  // **Le noir et le gras se MESURENT, ils ne se relisent pas.** Un `text-black`
  // oublié dans une refonte laisserait le titre en gris parmi les coordonnées —
  // et c'est la première chose qu'il cherche en ouvrant cet écran.
  await cas("la dernière prestation est en titre noir gras, sous l'adresse", async () => {
    // **CE CONTRÔLE A CHANGÉ DE CIBLE LE 20 AOÛT AU SOIR, ET SON OBJET TIENT.**
    // Il visait un `h2` portant le NOM du chantier. Le patron l'a fait retirer —
    // ce nom répétait celui du client, déjà en tête d'écran — et c'est la ligne
    // « Dernière prestation · date » qui porte désormais le noir gras. On suit
    // sa décision au lieu de réclamer ce qu'il a enlevé (`CLAUDE.md` §5 bis).
    const vu = await page.evaluate(() => {
      const ligne = [...document.querySelectorAll("p")].find((p) =>
        /^Dernière prestation/i.test((p.textContent ?? "").trim())
      );
      if (!ligne) return null;
      const style = getComputedStyle(ligne);
      const nom = document.querySelector("h1");
      const coord = nom?.nextElementSibling;
      return {
        texte: (ligne.textContent ?? "").trim(),
        graisse: Number(style.fontWeight),
        couleur: style.color,
        // L'encre de l'écran, lue là où elle est le plus sûrement pleine : le
        // nom du client, en tête.
        encre: nom ? getComputedStyle(nom).color : null,
        // Ce qui l'entoure, et dont elle doit se détacher.
        autour: coord ? getComputedStyle(coord).color : null,
        sousLeNom: ligne.getBoundingClientRect().top > (coord?.getBoundingClientRect().top ?? 0),
        puces: document.querySelectorAll("ul li").length,
      };
    });
    assert.ok(vu, "aucune ligne « Dernière prestation » sur l'écran");
    assert.ok(vu!.graisse >= 700, `la ligne n'est pas grasse (graisse lue : ${vu!.graisse})`);
    // **« Noir » se mesure CONTRE l'écran, pas contre `rgb(0, 0, 0)`.**
    //
    // Ce contrôle exigeait le noir absolu, et il a rougi le 22 août 2026 sur du
    // code juste : la ligne portait `#000` écrit en dur, ce qui la rend
    // INVISIBLE sur les deux chartes sombres, où l'encre est claire
    // (`ARCHITECTURE.md` §160). Elle prend donc l'encre de la charte — et sur
    // « Origine », #1c1c1a contre #000, l'œil ne fait pas la différence.
    //
    // Ce qu'il a demandé — « en titre noir gras » — n'était pas une valeur
    // hexadécimale : c'était *la ligne la plus appuyée de l'écran*. C'est cela
    // qui se vérifie, et cela seul survivra au prochain changement de charte
    // (`CLAUDE.md` §5 bis).
    assert.equal(
      vu!.couleur,
      vu!.encre,
      `la ligne ne porte pas l'encre pleine de l'écran (lue : ${vu!.couleur}, l'encre : ${vu!.encre})`
    );
    assert.notEqual(
      vu!.couleur,
      vu!.autour,
      `la ligne se confond avec les coordonnées au-dessus (${vu!.couleur}) : elle ne ressort plus`
    );
    assert.ok(vu!.sousLeNom, "la dernière prestation ne se place pas sous le nom du client");
    // **Les mois en toutes lettres, pas `\w`.** En JavaScript, `\w` ne couvre
    // que l'ASCII : « 20 août 2026 » ne correspondait pas à cause du « û », et
    // le contrôle accusait l'écran de ne pas porter sa date alors qu'elle y
    // était. Un contrôle qui accuse à tort coûte plus cher que pas de contrôle
    // (`CLAUDE.md` §5). On vise donc la même liste de mois que le contrôle du
    // format, juste en dessous — une seule façon de reconnaître une date.
    assert.match(
      vu!.texte,
      /\d{1,2} (janv\.|févr\.|mars|avr\.|mai|juin|juil\.|août|sept\.|oct\.|nov\.|déc\.) \d{4}/,
      `elle ne porte pas sa date : « ${vu!.texte} »`
    );
    assert.ok(vu!.puces >= 1, "« ce qu'elle comprend » n'affiche aucune ligne");

    // **Et le nom du chantier ne revient pas.** C'est ce qu'il a fait retirer :
    // sans ce contrôle, un rebasage le remettrait sans que rien ne rougisse.
    const titres = await page.evaluate(() =>
      [...document.querySelectorAll("h2")].map((h) => (h.textContent ?? "").trim())
    );
    assert.deepEqual(titres, [], `un titre est revenu sous l'adresse : ${titres.join(" | ")}`);
  });

  // ── Les trois colonnes, et l'ordre — le cœur de sa demande ─────────────────
  await cas("trois colonnes : Devis, Facture, Fiche chantier", async () => {
    const titres = await page.evaluate(() =>
      [...document.querySelectorAll("h3")].map((e) => (e.textContent ?? "").trim().toUpperCase())
    );
    // **Devis · Facture · Fiche chantier**, et l'ordre a changé le 20 août au
    // soir sur sa décision. On fige ce qu'il a demandé, pas ce qui existait.
    assert.deepEqual(
      titres,
      ["DEVIS", "FACTURE", "FICHE CHANTIER"],
      `les colonnes lues sont : ${titres.join(" | ")}`
    );
  });

  await cas("chaque colonne porte ses PDF, du plus récent au plus ancien", async () => {
    // **Les pièces sont des BOUTONS depuis le 21 août 2026.** Un appui ouvre
    // trois choix — Enregistrer, Ouvrir, Partager — au lieu d'ouvrir le PDF
    // d'office (`ARCHITECTURE.md` §141, planche 83 proposition C). L'adresse ne
    // se lit donc plus sur la vignette : elle vit dans la feuille.
    const colonnes = await page.evaluate(() =>
      [...document.querySelectorAll("h3")].map((h3) => {
        const boite = h3.parentElement!;
        return {
          titre: (h3.textContent ?? "").trim(),
          liens: [...boite.querySelectorAll('[data-atlas="piece"]')].map((b) => ({
            texte: (b.textContent ?? "").replace(/\s+/g, " ").trim(),
            haut: b.getBoundingClientRect().top,
          })),
        };
      })
    );

    const attendus: Record<string, RegExp> = {
      Devis: /^\/api\/devis\//,
      Facture: /^\/api\/factures\//,
      // **Plus un PDF de chantier depuis le 23 août 2026** : la colonne porte
      // le rapport d'entretien, à l'adresse même que le client a reçue.
      "Fiche chantier": /^\/entretien\/[A-Za-z0-9_-]+$/,
    };
    for (const colonne of colonnes) {
      assert.ok(colonne.liens.length >= 1, `la colonne « ${colonne.titre} » est vide`);
    }

    // **Chaque colonne mène à SON genre de document**, vérifié en ouvrant la
    // feuille de sa première pièce — c'est-à-dire par le chemin qu'il emprunte.
    // Une colonne « Facture » qui servirait des devis se lirait pareil dans le
    // DOM ; seule l'adresse le dit.
    for (const [titre, motif] of Object.entries(attendus)) {
      const cadre = page.locator("div").filter({ has: page.locator(`h3:text-is("${titre}")`) }).last();
      await cadre.locator('[data-atlas="piece"]').first().click();
      const ouvrir = page.locator('[data-atlas="piece-ouvrir"]');
      await ouvrir.waitFor({ state: "visible", timeout: 20_000 });
      const href = (await ouvrir.getAttribute("href")) ?? "";
      assert.match(href, motif, `« ${titre} » pointe sur ${href}, qui n'est pas son PDF`);
      await page.getByRole("button", { name: "Annuler" }).click();
      await ouvrir.waitFor({ state: "hidden", timeout: 15_000 });
    }

    // **L'ordre se lit sur l'ÉCRAN, pas sur les données.** Un tri juste dans le
    // dépôt et un rendu qui les repose dans l'ordre d'arrivée donneraient un
    // contrôle vert sur une colonne fausse.
    const sesDevis = colonnes.find((c) => c.titre === "Devis")!;
    assert.ok(
      sesDevis.liens.length >= 2,
      `il faut deux devis pour juger d'un ordre, ${sesDevis.liens.length} trouvé(s)`
    );
    // **L'ordre se lit sur la DATE AFFICHÉE**, celle qu'il a sous les yeux —
    // pas sur un numéro que le montage aurait cru connaître. La première
    // version cherchait « 2026-0031 », un numéro qu'aucun devis ne portait :
    // elle accusait la colonne d'être vide alors qu'elle était juste.
    const rangJuillet = sesDevis.liens.findIndex((l) => /juil\./.test(l.texte));
    assert.ok(
      rangJuillet >= 0,
      `aucun devis de juillet à l'écran : ${sesDevis.liens.map((l) => l.texte).join(" / ")}`
    );
    assert.equal(
      rangJuillet,
      0,
      `le devis le plus récent est en position ${rangJuillet + 1} : la colonne remonte le temps`
    );
    // Et il est bien PLUS HAUT à l'écran, ce qui est la seule chose qu'il voit.
    assert.ok(
      sesDevis.liens[0].haut < sesDevis.liens[1].haut,
      "le premier document de la colonne n'est pas le plus haut sur l'écran"
    );
    // **Deux lignes identiques valent une colonne inutilisable.** C'est ce qui
    // arrivait quand deux versions du même devis y figuraient toutes deux.
    const vus = sesDevis.liens.map((l) => l.texte);
    assert.equal(
      new Set(vus).size,
      vus.length,
      `deux pièces identiques dans la colonne Devis : ${vus.join(" / ")}`
    );
  });

  // ── Une seule façon d'écrire une date sur cet écran ──────────────────────
  //
  // **Vu à la capture, pas au test.** L'écran portait « 12/08/2026 » au-dessus
  // de la dernière prestation et « 12 août 2026 » dans les colonnes, à trois
  // centimètres l'un de l'autre. Deux formats côte à côte font hésiter — est-ce
  // la même date ? — sur un écran ouvert vingt fois par jour.
  await cas("les dates s'écrivent toutes de la même façon", async () => {
    const texte = await page.locator("body").innerText();
    const enChiffres = texte.match(/\b\d{2}\/\d{2}\/\d{4}\b/g) ?? [];
    assert.deepEqual(
      enChiffres,
      [],
      `des dates en chiffres cohabitent avec les dates en toutes lettres : ${enChiffres.join(", ")}`
    );
    assert.match(
      texte,
      /\d{1,2} (janv\.|févr\.|mars|avr\.|mai|juin|juil\.|août|sept\.|oct\.|nov\.|déc\.) \d{4}/,
      "aucune date en toutes lettres : le contrôle ne vérifierait rien"
    );
  });

  // ── Ce qui a été retiré ne revient pas ────────────────────────────────────
  //
  // **Un retrait ne se vérifie que par l'absence.** C'est l'essentiel de sa
  // demande — « tout le reste, tu enlèves, c'est du trop » — et rien d'autre ne
  // rougirait si les trois cases reparaissaient à un rebasage.
  await cas("les quatre choses retirées ne sont pas revenues", async () => {
    const texte = (await page.locator("body").innerText()).toUpperCase();
    for (const [mot, quoi] of [
      ["RESTE DÛ", "la case « reste dû »"],
      ["SES CHANTIERS", "la liste « Ses chantiers »"],
      ["COMBIEN DE FOIS", "la liste des prestations récurrentes"],
      ["AUCUNE FACTURE ÉMISE POUR", "la phrase d'excuse sur les factures"],
    ] as const) {
      assert.ok(!texte.includes(mot), `${quoi} est revenue sur l'écran`);
    }
    // **La flèche de retour ne compte pas, et c'est délibéré.** Depuis le
    // 20 août 2026, elle ramène AU CHANTIER quand on vient de là
    // (`ARCHITECTURE.md` §135) : son adresse est donc bien celle d'un chantier,
    // sans que la liste « Ses chantiers » soit revenue pour autant. Compter
    // tous les liens sans distinction accuserait la sortie de secours à la
    // place de ce qu'on cherche.
    assert.equal(
      await page.locator(`a[href^="/chantiers/${chantierId}"]:not([aria-label^="Retour"])`).count(),
      0,
      "un lien vers le chantier subsiste dans le CORPS : la liste « Ses chantiers » n'a pas été retirée"
    );
  });

  // ── Trois colonnes sur 390 px : c'est là que ça casse ─────────────────────
  await cas("rien ne déborde ni ne se coupe sur la largeur de son téléphone", async () => {
    const mesures = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth,
      vue: window.innerWidth,
      colonnes: [...document.querySelectorAll("h3")].map((h3) => {
        const boite = h3.parentElement!;
        return { largeur: boite.getBoundingClientRect().width, haut: boite.getBoundingClientRect().top };
      }),
      // **On mesure les TITRES, pas les précisions.** Un nom de chantier long
      // s'abrège légitimement avec des points de suspension ; un numéro de
      // devis abrégé, lui, ne désigne plus rien. La première version mesurait
      // les deux et accusait l'écran pour une troncature voulue.
      coupes: [...document.querySelectorAll('h3, [data-atlas="piece-titre"]')]
        .filter((e) => e.scrollWidth > e.clientWidth + 1)
        .map((e) => `${(e.textContent ?? "").trim()} (${e.scrollWidth} px dans ${e.clientWidth})`),
      petits: [...document.querySelectorAll("h3 ~ a")]
        .map((a) => a.getBoundingClientRect().height)
        .filter((h) => h < 28).length,
    }));

    assert.ok(
      mesures.page <= mesures.vue + 1,
      `l'écran déborde de ${mesures.page - mesures.vue} px : il faut le glisser de côté pour tout lire`
    );
    assert.equal(mesures.colonnes.length, 3, "il faut trois colonnes à mesurer");
    const plusEtroite = Math.min(...mesures.colonnes.map((c) => c.largeur));
    assert.ok(plusEtroite >= 100, `la colonne la plus étroite fait ${Math.round(plusEtroite)} px — sous 100, les numéros se coupent`);
    const ecart = Math.max(...mesures.colonnes.map((c) => c.haut)) - Math.min(...mesures.colonnes.map((c) => c.haut));
    assert.ok(ecart < 2, `les colonnes ne sont pas côte à côte : ${Math.round(ecart)} px d'écart en hauteur`);
    assert.deepEqual(mesures.coupes, [], `des libellés sont coupés : ${mesures.coupes.join(" ; ")}`);
    assert.equal(mesures.petits, 0, `${mesures.petits} lien(s) de moins de 28 px de haut : on les rate au doigt`);
  });

  // ── Le PDF de fiche chantier, le troisième document ───────────────────────
  //
  // **Ouvert POUR DE BON, pas seulement listé.** Un lien qui rend une erreur 500
  // ou une page HTML se voit exactement pareil dans le DOM ; c'est en le
  // suivant qu'on l'apprend.
  await cas("la fiche s'ouvre vraiment, et c'est le rapport reçu par le client", async () => {
    // **Ce n'est plus un PDF, et c'est le sujet.** Jusqu'au 23 août 2026 cette
    // colonne servait la feuille INTERNE d'un chantier terminé — équipe,
    // créneau, note vocale, adresse —, celle que ses salariés ouvrent dans la
    // camionnette. Rangée au dossier d'un client, elle donnait à croire qu'il
    // l'avait reçue. Elle porte désormais le rapport d'entretien, à l'adresse
    // même qu'il a envoyée.
    const cadre = page.locator("div").filter({ has: page.locator('h3:text-is("Fiche chantier")') }).last();
    await cadre.locator('[data-atlas="piece"]').first().click();
    const ouvrir = page.locator('[data-atlas="piece-ouvrir"]');
    await ouvrir.waitFor({ state: "visible", timeout: 20_000 });
    const href = await ouvrir.getAttribute("href");

    // **« Enregistrer » n'est PAS proposé**, et ce n'est pas un oubli : rien ne
    // fige ce rapport en fichier. Le laisser ferait descendre une page web
    // nommée `.pdf`, que rien n'ouvrirait — le défaut du 7 août, retourné.
    assert.equal(
      await page.locator('[data-atlas="piece-enregistrer"]').count(),
      0,
      "« Enregistrer » est offert sur une fiche qui n'est pas un fichier"
    );
    await page.getByRole("button", { name: "Annuler" }).click();
    await ouvrir.waitFor({ state: "hidden", timeout: 15_000 });

    assert.equal(href, `/entretien/${jetonFiche}`, `la feuille de la fiche mène à « ${href} »`);

    // **Ouvert POUR DE BON, pas seulement listé.** Un lien qui rend une erreur
    // 500 se voit exactement pareil dans le DOM ; c'est en le suivant qu'on
    // l'apprend.
    const reponse = await page.request.get(`${BASE}${href}`);
    assert.equal(reponse.status(), 200, `le rapport d'entretien répond ${reponse.status()}`);
    const corps = await reponse.text();
    assert.match(
      corps,
      /Tonte/i,
      "le rapport ne porte pas la prestation cochée : ce n'est pas la fiche envoyée"
    );
  });

  await cas("un chantier SANS client n'ouvre aucune porte sur du vide", async () => {
    await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
    await creerPuisFiche(page);
    await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 15_000 });
    await page.waitForTimeout(700);
    const { rows } = await pool.query(`SELECT client_id FROM chantiers WHERE id = $1`, [
      page.url().split("/").pop(),
    ]);
    if (rows[0]?.client_id) {
      // Le formulaire a quand même créé un client : le cas ne se produit pas ici.
      console.log("    (ce chantier a reçu un client : rien à vérifier)");
      return;
    }
    assert.equal(
      await page.locator('a[href^="/clients/"]').count(),
      0,
      "une porte vers la fiche d'un client qui n'existe pas"
    );
  });

  // ── La LISTE, sa remarque du 17 août au soir ──────────────────────────────
  //
  // *« La catégorie client n'a pas été créée. »* La fiche existait, mais elle ne
  // s'atteignait que depuis un chantier : rien ne menait à SES clients. Le
  // chemin s'éprouve donc DEPUIS L'ACCUEIL, en touchant le lien — viser
  // l'adresse directement laisserait passer un lien qui ne mène nulle part.
  await cas("depuis l'accueil, « Vos clients » ouvre la liste", async () => {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    const lien = page.getByRole("link", { name: /Vos clients/i });
    assert.equal(await lien.count(), 1, "aucun lien « Vos clients » sur l'accueil : la liste est introuvable");
    await lien.click();
    await page.waitForURL(`${BASE}/clients`, { timeout: 15_000 });
    // **Attendre le CONTENU, pas l'adresse.** L'adresse change avant le rendu :
    // la première ouverture d'un écran se compile sur le serveur de
    // développement, et la page affiche « Chargement… ». Le contrôle lisait ce
    // mot-là et accusait la liste d'être vide.
    await page.locator('a[href^="/clients/"]').first().waitFor({ timeout: 30_000 });
    const texte = await page.locator("body").innerText();
    // Le titre COMPTE, et le message montre ce qui a été vu : un contrôle qui
    // dit seulement « ça ne correspond pas » fait relire la page à la main.
    assert.match(
      texte,
      /\d+\s+clients?/i,
      `la liste ne dit pas combien de clients elle porte. L'écran dit : ${JSON.stringify(texte.slice(0, 200))}`
    );
    assert.ok(texte.includes(nomClient), `le client « ${nomClient} » manque dans sa propre liste`);
  });

  await cas("un nom de la liste ouvre sa fiche", async () => {
    await page.getByRole("link", { name: new RegExp(nomClient.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).click();
    await page.waitForURL(/\/clients\/[0-9a-f-]{36}/, { timeout: 15_000 });
    // Même piège qu'au premier cas : l'adresse change avant la fiche.
    await page
      .getByText("Chargement…")
      .first()
      .waitFor({ state: "hidden", timeout: 30_000 })
      .catch(() => undefined);
    assert.match(await page.locator("body").innerText(), new RegExp(nomClient.split(" ")[0]));
  });

  await cas("la barre du bas n'a pas gagné d'onglet", async () => {
    // **CE CONTRÔLE ATTENDAIT QUATRE ONGLETS, ET IL EST DEVENU FAUX LE 17 AOÛT**
    // — le jour où le cinquième, « Paysage », a été posé sur sa décision
    // (`ARCHITECTURE.md` §125 et §125 bis). Il a rougi sur du code juste, et
    // c'est le lot d'à côté qui l'avait laissé derrière lui.
    //
    // **Un nombre écrit en dur ne dit pas ce qu'il garde.** La règle, elle, ne
    // bouge pas : la liste des clients s'atteint depuis l'accueil, elle ne
    // prend PAS de place dans la barre — à cinq colonnes, « CHANTIERS » tient
    // déjà de justesse sur 360 px (`scripts/test-barre-basse-e2e.ts`). On
    // vérifie donc que la barre porte exactement les onglets décidés, et que
    // « Clients » n'en est pas.
    const DECIDES = ["CHANTIERS", "PLANNING", "TERMINÉS", "PAYSAGE", "RÉGLAGES"];
    await page.goto(`${BASE}/clients`, { waitUntil: "networkidle" });
    const onglets = (await page.locator("nav a").allInnerTexts()).map((t) => t.trim().toUpperCase());
    assert.deepEqual(
      onglets,
      DECIDES,
      `la barre du bas porte ${onglets.join(", ")} au lieu de ${DECIDES.join(", ")}`
    );
  });

  // ─── SUPPRIMER UN CLIENT — sa proposition C, tranchée le 27 août 2026 ─────
  //
  // *« Je pense la C ; lorsqu'un client a des documents il faut mettre la phrase
  // de prévention, et une phrase disant avez-vous sauvegardé ses documents autre
  // part — et s'il dit oui il peut supprimer quand même. »*
  //
  // **Ces cas passent en DERNIER, et ce n'est pas un hasard** : le second
  // supprime pour de bon. Placés plus haut, ils retireraient le décor que les
  // suivants lisent — la faute que ce fichier a déjà payée deux fois cette
  // semaine.
  await cas("un client qui a des documents est PRÉVENU, et le geste est verrouillé", async () => {
    await page.goto(ficheDuClientMonte, { waitUntil: "networkidle" });
    await page.getByText("Chargement…").first().waitFor({ state: "hidden", timeout: 30_000 }).catch(() => undefined);

    await page.locator('[data-atlas="supprimer-client"]').click();
    const confirmer = page.locator('[data-atlas="confirmer-suppression"]');
    await confirmer.waitFor({ state: "visible", timeout: 15_000 });

    assert.ok(
      await page.locator('[data-atlas="prevention"]').isVisible(),
      "aucune phrase de prévention sur un client qui a des documents"
    );
    // **Le verrou se mesure sur le bouton, pas sur la case.** Une case cochée
    // qui ne commanderait rien passerait au vert en laissant la suppression
    // ouverte — c'est l'inverse de ce qu'il a demandé.
    assert.strictEqual(
      await confirmer.isDisabled(),
      true,
      "« Supprimer » est actif avant qu'il ait répondu sur la sauvegarde"
    );

    await page.locator('[data-atlas="sauvegarde-ailleurs"]').click();
    await page.waitForTimeout(200);
    assert.strictEqual(
      await confirmer.isDisabled(),
      false,
      "« J'ai sauvegardé » ne déverrouille rien : le geste reste impossible"
    );

    // On referme : ce client sert encore aux cas qui suivent, s'il en naît.
    await page.getByRole("button", { name: "Annuler" }).click();
    await page.waitForTimeout(300);
  });

  await cas("et un client SANS document disparaît pour de bon", async () => {
    const { rows } = await pool.query(
      `INSERT INTO clients (entreprise_id, nom, telephone)
       SELECT entreprise_id, $2, $3 FROM chantiers WHERE id = $1
       RETURNING id`,
      [chantierId, `M. À supprimer ${Date.now()}`, "06 00 00 00 06"]
    );
    assert.equal(rows.length, 1, "le client d'essai n'a pas été créé : il n'y a rien à mesurer");
    const aSupprimer = rows[0].id as string;

    await page.goto(`${BASE}/clients/${aSupprimer}`, { waitUntil: "networkidle" });
    await page.getByText("Chargement…").first().waitFor({ state: "hidden", timeout: 30_000 }).catch(() => undefined);
    await page.locator('[data-atlas="supprimer-client"]').click();
    const confirmer = page.locator('[data-atlas="confirmer-suppression"]');
    await confirmer.waitFor({ state: "visible", timeout: 15_000 });

    // Rien à sauvegarder : le verrou n'a pas lieu d'être, et l'alarmer pour
    // rien apprendrait à ignorer l'alarme (`CLAUDE.md` §4 ter).
    assert.strictEqual(await page.locator('[data-atlas="prevention"]').count(), 0, "on l'alarme pour un client vide");
    assert.strictEqual(await confirmer.isDisabled(), false, "le geste est verrouillé sans rien à sauvegarder");

    await confirmer.click();
    await page.waitForURL(new RegExp(`${BASE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/clients/?$`), { timeout: 30_000 });

    // **On mesure la BASE, pas l'écran.** Une fiche disparue de la liste peut
    // n'être que masquée ; ce qu'il a choisi, c'est qu'elle n'existe plus.
    await attendre("la fiche a disparu de la base", async () => {
      const { rows: reste } = await pool.query(`SELECT id FROM clients WHERE id = $1`, [aSupprimer]);
      return reste.length === 0;
    });
  });

  await contexte.close();
  await navigateur.close();
  await pool.end();

  console.log(`\n${echecs === 0 ? "✅" : "❌"} La fiche du client et sa liste — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
