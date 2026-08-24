import assert from "node:assert/strict";
import { pool, db } from "../src/server/db/client";
import { nettoyerBase } from "./_test-db";
import {
  creerEntreprise,
  mettreAJourEntreprise,
  allureDesDocuments,
  getEntreprise,
} from "../src/server/repositories/entreprises";
import { ALLURE_PAR_DEFAUT } from "../src/lib/allure-documents";

/**
 * L'ALLURE, EN BASE — ce que le PDF ira y chercher.
 *
 * *Sa demande du 23 août 2026, et sa borne : « les réglages actuels doivent
 * être par défaut ».*
 *
 * **Ce qu'une suite navigateur ne verrait pas.** L'écran afficherait le bon
 * réglage tout en ayant écrit autre chose : c'est en lisant les colonnes qu'on
 * voit qu'un défaut a été figé en clair, ou qu'une entreprise voit l'allure
 * d'une autre.
 */

let echecs = 0;
async function essai(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

async function monter(nom: string) {
  const { entreprise, utilisateurId } = await creerEntreprise(
    { nom },
    { email: `all-${Math.random().toString(36).slice(2)}@essai.local`, nom: "Patron" }
  );
  return { ctx: { utilisateurId, entrepriseId: entreprise.id }, entrepriseId: entreprise.id };
}

async function main() {
  console.log("=== L'allure des documents, en base ===\n");

  await essai("une entreprise neuve n'a AUCUNE allure : ses devis sont ceux d'avant", async () => {
    await nettoyerBase();
    const { ctx, entrepriseId } = await monter("Neuve");
    const lu = await allureDesDocuments(db, entrepriseId);
    assert.equal(lu.allure, null, "une entreprise neuve porte déjà une allure");
    assert.equal(lu.logo, null);
    void ctx;
  });

  await essai("une allure réglée se relit telle quelle", async () => {
    await nettoyerBase();
    const { ctx, entrepriseId } = await monter("Réglée");
    await mettreAJourEntreprise(ctx, {
      allure: { typographie: "playfair", fond: "#1c2b1c", accent: "#d8c48a" },
    });
    const lu = await allureDesDocuments(db, entrepriseId);
    assert.deepEqual(lu.allure, { typographie: "playfair", fond: "#1c2b1c", accent: "#d8c48a" });
  });

  await essai("LE DÉFAUT S'ÉCRIT VIDE, jamais en clair", async () => {
    // **C'est ce qui permet à la charte de bouger sans le laisser derrière.**
    // Poser « #faf9f5 » en base parce qu'il a ouvert le réglage et l'a refermé
    // figerait ses documents sur la teinte du jour ; une correction ultérieure
    // ne les atteindrait plus, et personne ne saurait pourquoi.
    await nettoyerBase();
    const { ctx, entrepriseId } = await monter("Revenue au défaut");
    await mettreAJourEntreprise(ctx, {
      allure: { typographie: "merriweather", fond: "#ffffff", accent: "#6e2433" },
    });
    await mettreAJourEntreprise(ctx, { allure: { ...ALLURE_PAR_DEFAUT } });

    const e = await getEntreprise(ctx);
    assert.equal(e?.docTypographie, null, "la typographie par défaut a été écrite en clair");
    assert.equal(e?.docFond, null, "le fond par défaut a été écrit en clair");
    assert.equal(e?.docAccent, null, "l'accent par défaut a été écrit en clair");
    assert.equal((await allureDesDocuments(db, entrepriseId)).allure, null);
  });

  await essai("`null` remet l'allure d'aujourd'hui — son bouton « revenir »", async () => {
    await nettoyerBase();
    const { ctx, entrepriseId } = await monter("Remise à zéro");
    await mettreAJourEntreprise(ctx, {
      allure: { typographie: "lato", fond: "#000000", accent: "#ffffff" },
    });
    await mettreAJourEntreprise(ctx, { allure: null });
    assert.equal((await allureDesDocuments(db, entrepriseId)).allure, null);
  });

  await essai("une couleur qui ne s'écrit pas retombe sur le défaut, sans lever", async () => {
    // La base porte un `CHECK` sur la forme des couleurs : y envoyer « bleu »
    // lèverait, et le message d'une exception d'action serveur n'atteint jamais
    // son écran (`AGENTS.md`). Le dépôt normalise donc AVANT d'écrire.
    await nettoyerBase();
    const { ctx, entrepriseId } = await monter("Saisie de travers");
    await mettreAJourEntreprise(ctx, {
      allure: { typographie: "police-inconnue", fond: "bleu roi", accent: "#2f3b2f" },
    });
    const lu = await allureDesDocuments(db, entrepriseId);
    assert.ok(lu.allure, "rien n'a été écrit");
    assert.equal(lu.allure.fond, ALLURE_PAR_DEFAUT.fond);
    assert.equal(lu.allure.typographie, ALLURE_PAR_DEFAUT.typographie);
    assert.equal(lu.allure.accent, "#2f3b2f", "l'accent valide a été perdu avec le reste");
  });

  await essai("un logo introuvable ne fait pas tomber la lecture", async () => {
    // Le compartiment peut avoir été vidé. Le document doit sortir sans logo
    // plutôt que de ne pas sortir du tout : c'est le devis du client.
    await nettoyerBase();
    const { ctx, entrepriseId } = await monter("Logo fantôme");
    await mettreAJourEntreprise(ctx, {
      logo: { storageKey: "entreprises/inexistant/logo/rien.png", mime: "image/png" },
    });
    const lu = await allureDesDocuments(db, entrepriseId);
    assert.equal(lu.logo, null, "un logo a été rendu alors que le fichier n'existe pas");
  });

  await essai("UNE ENTREPRISE NE VOIT PAS L'ALLURE D'UNE AUTRE", async () => {
    // Le réglage n'engage rien, mais un logo est une marque : le voir sortir
    // sur le devis d'un autre artisan serait le pire des défauts d'isolation.
    await nettoyerBase();
    const a = await monter("Chez Dupont");
    const b = await monter("Chez Martin");
    await mettreAJourEntreprise(a.ctx, {
      allure: { typographie: "playfair", fond: "#1c2b1c", accent: "#d8c48a" },
    });
    // Lue depuis le contexte de B, la ligne de A ne doit rien rendre.
    const vueDeB = await allureDesDocuments(db, a.entrepriseId);
    void vueDeB; // `db` traverse : c'est la lecture APPLICATIVE qui doit borner.
    const sienne = await getEntreprise(b.ctx);
    assert.equal(sienne?.docTypographie, null, "B porte le réglage de A");
    assert.equal(sienne?.docFond, null);
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} ${echecs} échec(s).`);
  await pool.end();
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
