import assert from "node:assert/strict";
import { jourDuPatron } from "./_jour-e2e";
import { devices } from "playwright";
import type { Page } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { pool } from "../src/server/db/client";
import { texteDuPdf } from "./_lecteur-pdf-protege";

/**
 * Ce que la note ne doit JAMAIS quitter : l'application.
 *
 * *Sa décision du 23 août 2026,* posée devant la planche 93 : le pense-bête de
 * la feuille de chantier **ne part sur aucun document** — ni devis, ni facture,
 * ni le PDF sans les prix que ses gars emportent. Dedans, elle serait devenue un
 * écrit qui sort de l'entreprise, et *« client pas disponible avant neuf
 * heures »* se serait rédigé en sachant que le client peut le lire.
 *
 * **C'est cette promesse qui l'autorise à écrire librement.**
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QUE CETTE SUITE AJOUTE À `test-planning-repo`**, qui tient déjà la règle
 * d'écriture côté base : le parcours réel, au navigateur — et surtout la seule
 * mesure qui éprouve la promesse ci-dessus, en ouvrant le document lui-même.
 *
 * **ET LE PIÈGE QU'ELLE A PAYÉ DEUX FOIS.** Ce contrôle a été vert deux fois de
 * suite en confrontation avec une note délibérément versée dans le PDF :
 *
 *   1. il cherchait les mots dans les **octets bruts** — le texte d'un PDF est
 *      comprimé, et rien n'y est jamais trouvé ;
 *   2. les flux décomprimés, il les cherchait **en clair** — le texte s'y écrit
 *      en hexadécimal, `<4174656C696572> Tj`.
 *
 * Deux fois, il promettait le silence d'un document qu'il ne savait pas ouvrir.
 * D'où la mesure qui garde les deux : **il prouve d'abord qu'il sait LIRE ce
 * PDF**, en y retrouvant une ligne du devis, et refuse de conclure autrement.
 * Ne pas retirer cette vérification préalable en croyant simplifier
 * (`ARCHITECTURE.md` §154).
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

/** Ouvrir la feuille du chantier planifié, depuis le planning. */
async function ouvrirLaFeuille(page: Page, nom: string) {
  await page.goto(`${BASE}/planning`, { waitUntil: "networkidle" });
  const ligne = page.getByText(nom).first();
  await ligne.waitFor({ state: "visible", timeout: 30_000 });
  await ligne.click();
  await page.waitForSelector('[data-atlas="note-etat"]', { timeout: 30_000 });
  // **Attendre que la feuille soit CHARGÉE, et non qu'elle soit à l'écran.**
  // Le cadre paraît tout de suite (sa proposition A), la note tombe une
  // fraction de seconde plus tard : lire aussitôt donnait un cadre vide, et la
  // suite accusait le produit d'une lenteur qui est la sienne. On attend donc
  // la fin du chargement — jamais la valeur qu'on s'apprête à éprouver, ce qui
  // rendrait la mesure vide de sens.
  await page
    .locator('[data-atlas="feuille"]')
    .getByText("Lecture du devis…")
    .waitFor({ state: "detached", timeout: 30_000 })
    .catch(() => {});
  await page.waitForFunction(
    () => {
      const f = document.querySelector('[data-atlas="feuille"]');
      return !!f && !/Lecture du devis…/.test(f.textContent ?? "");
    },
    undefined,
    { timeout: 30_000 }
  );
}

/**
 * Le texte lisible d'un PDF — les flux décomprimés, mis bout à bout.
 *
 * **Pourquoi ce détour plutôt qu'une recherche dans les octets.** Le texte d'un
 * PDF est comprimé (`FlateDecode`) : chercher « broyeur » dans le fichier brut
 * ne trouve rien, jamais, y compris quand le mot y est bel et bien imprimé.
 * C'est exactement l'erreur qu'a faite la première version de ce contrôle, et
 * elle est restée verte en confrontation avec le défaut qu'elle prétendait
 * interdire.
 */
/**
 * **Ce lecteur a dû apprendre à DÉCHIFFRER, le 31 août 2026.** Depuis ce
 * jour-là, tout ce qu'Atlas produit part protégé contre la retouche
 * (`src/server/pdf/proteger-pdf.ts`) : les flux ne se décompriment plus, et ce
 * contrôle-ci a fait exactement ce qu'il fallait — il a REFUSÉ de conclure,
 * plutôt que de rendre un vert en ne trouvant rien. Sa garde ci-dessous est ce
 * qui l'a sauvé.
 *
 * Le déchiffrement vit dans `_lecteur-pdf-protege.ts`, partagé avec
 * `test-devis-lisible.ts`, et n'importe rien du produit : un lecteur qui
 * appellerait la fonction qui a chiffré ne prouverait que sa cohérence avec
 * elle-même.
 */

async function main() {
  console.log("=== Le pense-bête de la feuille de chantier ===\n");

  // **Son propre chantier, planifié en base.** Emprunter celui d'une autre
  // suite ferait gagner celle-ci seule et tomber en batterie — la faute déjà
  // payée par `test-choisir-la-date-e2e.ts` le 20 août.
  const nom = `Note feuille ${Date.now()}`;
  const { rows } = await pool.query<{ id: string }>(
    // **Pas `CURRENT_DATE`** : c'est le jour de PostgreSQL, en UTC, et
    // l'application compte les siens à l'heure de l'atelier (§177). Entre
    // minuit et 2 h du matin, le chantier « du jour » posé ainsi n'était plus
    // au planning, et la feuille que cette suite ouvre n'existait pas.
    `INSERT INTO chantiers (entreprise_id, nom, date_planifiee, duree_demi_journees)
     SELECT id, $1, $2::date, 2 FROM entreprises WHERE nom = 'Atelier Démo'
     RETURNING id`,
    [nom, jourDuPatron()]
  );
  assert.ok(rows[0], "aucune entreprise « Atelier Démo » : la base de démonstration n'est pas montée");
  const chantierId = rows[0].id;

  // **Un devis, sans quoi la promesse du PDF ne s'éprouve pas.** Sans devis, la
  // route du PDF répond 404 par dessein — et un contrôle qui interroge une page
  // absente ne prouve rien de ce qu'elle contiendrait (`AGENTS.md` : un contrôle
  // qui mesure zéro ne mesure rien).
  const { rows: dv } = await pool.query<{ id: string }>(
    `INSERT INTO devis (entreprise_id, chantier_id, numero_commercial, numero_version,
                        statut, entreprise_nom, date_emission, taux_tva,
                        total_ht, total_tva, total_ttc)
     SELECT e.id, $1::uuid, $2, 1,
            'brouillon', e.nom, CURRENT_DATE, 20.00, 100, 20, 120
     FROM entreprises e WHERE e.nom = 'Atelier Démo'
     RETURNING id`,
    [chantierId, `NOTE-${chantierId.slice(0, 8)}`]
  );
  await pool.query(
    `INSERT INTO lignes_devis (devis_id, entreprise_id, ordre, libelle, quantite, prix_unitaire, montant)
     SELECT $1::uuid, e.id, 1, 'Taille d''une haie de laurier', 18, 50, 900
     FROM entreprises e WHERE e.nom = 'Atelier Démo'`,
    [dv[0]!.id]
  );

  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ ...devices["iPhone 13"] });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  await ouvrirLaFeuille(page, nom);

  await cas("le cadre est OUVERT d'emblée — sa proposition A", async () => {
    const zone = page.locator('[data-atlas="note-chantier"]');
    assert.ok(
      await zone.isVisible(),
      "le cadre n'est pas ouvert : c'est la proposition B (une ligne qui s'ouvre au doigt), " +
        "pas la A qu'il a retenue."
    );
  });

  await cas("il est entre « Copier l'adresse » et « Ouvrir le PDF »", async () => {
    const boite = async (s: string, quoi: string) => {
      const b = await page.locator(s).first().boundingBox();
      assert.ok(b, `${quoi} n'a aucune boîte.`);
      return b.y;
    };
    const adresse = await boite("text=Copier l’adresse", "« Copier l'adresse »");
    const note = await boite('[data-atlas="note-etat"]', "Le cadre de la note");
    const pdf = await boite('[data-atlas="pdf-sans-prix"]', "« Ouvrir le PDF sans les prix »");
    assert.ok(
      adresse < note && note < pdf,
      `Le cadre n'est plus à la place qu'il a nommée (adresse y=${Math.round(adresse)}, ` +
        `note y=${Math.round(note)}, PDF y=${Math.round(pdf)}). Sa demande était « ENTRE ` +
        `Copier l'adresse et Ouvrir le PDF ».`
    );
  });

  await cas("le champ fait 16 px au moins — sinon iOS zoome et l'écran saute", async () => {
    const px = await page
      .locator('[data-atlas="note-chantier"]')
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    assert.ok(
      px >= 16,
      `Le champ est à ${px} px. En dessous de 16, iOS zoome à la mise au point : la feuille ` +
        `se déplace sous son doigt au moment précis où il commence à écrire.`
    );
  });

  const TEXTE = "Prendre le broyeur. Client pas dispo avant 9 h.";

  await cas("elle s'enregistre en SORTANT du cadre, sans toucher de bouton", async () => {
    await page.locator('[data-atlas="note-chantier"]').fill(TEXTE);
    // Sortir du cadre, et rien d'autre : aucun bouton n'est touché.
    await page.locator('[data-atlas="feuille"] p').first().click();
    await page.waitForFunction(
      () => /Enregistré\.|n'a pas pu/.test(document.querySelector('[data-atlas="note-etat"]')?.textContent ?? ""),
      undefined,
      { timeout: 30_000 }
    );
    const dit = await page.locator('[data-atlas="note-etat"]').innerText();
    assert.match(
      dit,
      /Enregistré\./,
      `L'écran ne dit pas qu'elle est enregistrée : « ${dit.replace(/\s+/g, " ")} »`
    );
  });

  await cas("elle SURVIT au rechargement — c'est la seule mesure qui compte", async () => {
    await ouvrirLaFeuille(page, nom);
    const relu = await page.locator('[data-atlas="note-chantier"]').inputValue();
    assert.equal(
      relu,
      TEXTE,
      `Après rechargement le cadre porte « ${relu} ». Une note qui s'affiche puis disparaît ` +
        `est pire qu'un cadre absent : il l'écrit, part en camion, et trouve le vide sur place.`
    );
  });

  await cas("elle est bien en base, sur le chantier", async () => {
    const { rows: r } = await pool.query<{ note: string | null }>(
      "SELECT note FROM chantiers WHERE id = $1",
      [chantierId]
    );
    assert.equal(r[0]?.note, TEXTE, "la base ne porte pas la note : l'écran ment");
  });

  await cas("SA RÈGLE : elle ne part sur AUCUN document — pas même le PDF des gars", async () => {
    const reponse = await page.request.get(`${BASE}/api/chantiers/${chantierId}/feuille/pdf`);
    assert.equal(reponse.status(), 200, `le PDF répond ${reponse.status()}`);
    const lisible = texteDuPdf(new Uint8Array(await reponse.body()));

    // **Le contrôle doit d'abord prouver qu'il SAIT LIRE ce PDF.** Sa première
    // version cherchait les mots dans les octets bruts : le texte d'un PDF étant
    // comprimé, elle ne trouvait jamais rien — et restait verte en confrontation
    // avec une note délibérément versée dans le document. Un contrôle qui mesure
    // zéro ne mesure rien (`CLAUDE.md` §5), et celui-là promettait la seule
    // chose qui autorise le patron à écrire librement.
    assert.ok(
      lisible.includes("laurier"),
      "Ce contrôle ne sait pas lire ce PDF : il n'y retrouve même pas la ligne du devis. " +
        "Tant qu'il ne la lit pas, son verdict sur la note ne vaut rien."
    );

    for (const mot of ["broyeur", "dispo"]) {
      assert.ok(
        !lisible.includes(mot),
        `Le PDF sans les prix contient « ${mot} » : la note est partie chez ses gars. ` +
          `Il a tranché le 23 août qu'elle reste dans l'application — c'est cette promesse ` +
          `qui l'autorise à y écrire ce qu'il ne dirait pas devant le client.`
      );
    }
  });

  await cas("vider le cadre EFFACE la note, jusqu'en base", async () => {
    await page.locator('[data-atlas="note-chantier"]').fill("");
    await page.locator('[data-atlas="feuille"] p').first().click();
    await page.waitForFunction(
      () => /Enregistré\./.test(document.querySelector('[data-atlas="note-etat"]')?.textContent ?? ""),
      undefined,
      { timeout: 30_000 }
    );
    const { rows: r } = await pool.query<{ note: string | null }>(
      "SELECT note FROM chantiers WHERE id = $1",
      [chantierId]
    );
    assert.equal(
      r[0]?.note,
      null,
      `La base porte encore « ${r[0]?.note} ». Une note fausse qu'on ne peut pas ` +
        `effacer est pire que pas de note.`
    );
  });

  await navigateur.close();
  // Le devis d'abord : il référence le chantier, et l'effacement échouerait
  // sinon — un rangement qui rate laisse la suite suivante devant un planning
  // encombré de ses restes.
  await pool.query(
    "DELETE FROM lignes_devis WHERE devis_id IN (SELECT id FROM devis WHERE chantier_id = $1)",
    [chantierId]
  );
  await pool.query("DELETE FROM devis WHERE chantier_id = $1", [chantierId]);
  await pool.query("DELETE FROM chantiers WHERE id = $1", [chantierId]);
  await pool.end();

  console.log(`\n${reussis} réussis, ${echecs} échecs`);
  if (echecs > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
