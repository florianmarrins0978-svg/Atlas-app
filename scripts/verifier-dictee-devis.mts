import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { getFournisseurLLM } from "../src/server/ai/providers/llm/fabrique";
import { getConfigIA } from "../src/server/ai/config";
import { systeme } from "../src/server/ai/services/retouches-devis-service";
import { lireObjetJson } from "../src/lib/json-du-modele";
import { lireRetouchesDuModele, type LigneDevis, type Retouche } from "../src/lib/retouches-devis";
import { defautsDeRedaction } from "../src/lib/redaction-lignes";

/**
 * **« Que l'intelligence artificielle comprenne et rédige ça sous forme de
 * belles phrases »** — le contrôle qui le vérifie pour de bon.
 *
 * Sa demande du 20 août 2026 : appuyer sur le micro du devis, raconter le
 * chantier à voix haute, et retrouver des lignes de devis rédigées.
 *
 * **Pourquoi une commande à part, hors de la batterie de livraison.** Cette
 * rédaction-là est faite par un modèle de langage : sans clé, il n'y a rien à
 * mesurer, et l'environnement de développement n'en a pas — pas plus que la CI,
 * qui pose une clé de remplacement (`ci.yml`). Un contrôle qui mesure zéro est
 * pire qu'absent (`CLAUDE.md` §5) : celui-ci refuse donc de rendre un vert
 * quand il n'a rien appelé.
 *
 *   npm run verifier:dictee     depuis son espace, où ses clés sont posées
 *
 * La RÈGLE de rédaction, elle, est éprouvée sans clé et sait rougir :
 * `scripts/test-retouches-devis.ts`, section « Une ligne de devis, ou une
 * phrase recopiée ? ».
 */

// Même chargement de clés que `verifier-ia.ts` : le modèle de `.env.local`
// contient des lignes vides qui écraseraient des clés déjà posées.
try {
  const script = new URL("../.devcontainer/charger-cles.sh", import.meta.url).pathname;
  const fichier = new URL("../.env.local", import.meta.url).pathname;
  for (const ligne of execFileSync("bash", [script, fichier], { encoding: "utf8" }).split("\n")) {
    const separateur = ligne.indexOf("=");
    if (separateur > 0) process.env[ligne.slice(0, separateur)] = ligne.slice(separateur + 1);
  }
} catch {
  // Hors de son espace, ce fichier n'existe pas : ce n'est pas une anomalie.
}

/**
 * Sa dictée, telle qu'il l'a décrite le 20 août 2026 — hésitations comprises.
 *
 * **Elle n'est pas nettoyée, et c'est tout l'objet du contrôle.** Trois travaux
 * y sont noyés dans une réflexion à voix haute, un seul porte une mesure, et
 * aucun ne porte de prix.
 */
const SA_DICTEE = `J'aimerais tailler ma haie, c'est une haie qui fait, enfin je ne sais plus, mais je crois que c'est quelque chose comme vingt mètres linéaires. Alors mon client, qu'est-ce qu'il me disait déjà mon client ? Ah oui, c'est ça, il veut tailler sa haie, mais il y avait autre chose aussi. Ah oui, il y avait également couper les inflorescences des hortensias, et tondre la pelouse je crois, mais je ne suis plus sûr.`;

/** Le devis du 15 août, pour vérifier que les corrections marchent toujours. */
const DEVIS: LigneDevis[] = [
  { id: "a", libelle: "Taille de haie — 12 m", quantite: "12", prixUnitaire: "250" },
  { id: "b", libelle: "Fendage du bois", quantite: "1", prixUnitaire: "180" },
  { id: "c", libelle: "Évacuation des déchets verts", quantite: "1", prixUnitaire: "90" },
];

let echecs = 0;
async function cas(nom: string, verifier: () => Promise<void>): Promise<void> {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

async function comprendre(dictee: string, lignes: readonly LigneDevis[]): Promise<Retouche[]> {
  const reponse = await getFournisseurLLM().genererTexte(systeme(lignes, null), dictee);
  assert.equal(reponse.succes, true, `le modèle n'a pas répondu : ${JSON.stringify(reponse)}`);
  const brut = lireObjetJson(reponse.succes ? reponse.texte : "");
  assert.notEqual(brut, null, "la réponse du modèle n'est pas un JSON lisible");
  return lireRetouchesDuModele(brut);
}

async function main() {
  const config = getConfigIA();
  if (config.llmProvider === "dev") {
    console.error(
      "\n❌ AUCUN MODÈLE BRANCHÉ — ce contrôle n'a RIEN vérifié.\n" +
        "   La rédaction des lignes dictées se joue dans un modèle de langage : sans clé,\n" +
        "   il n'y a rien à mesurer, et rendre un vert ici ferait croire l'inverse.\n" +
        "   Jouez-le depuis votre espace de travail, où vos clés sont posées.\n"
    );
    process.exit(1);
  }

  console.log(`\n=== Sa dictée du chantier, comprise par « ${config.llmProvider} » ===\n`);

  const retouches = await comprendre(SA_DICTEE, []);
  const ajouts = retouches.filter((r) => r.type === "ajouter");
  console.log(`  Ce que le modèle a rendu :\n${JSON.stringify(retouches, null, 2).replace(/^/gm, "    ")}\n`);

  await cas("ses trois travaux donnent trois lignes, pas une de plus", async () => {
    assert.equal(retouches.length, ajouts.length, "un devis vide ne peut recevoir que des ajouts");
    assert.equal(
      ajouts.length,
      3,
      `${ajouts.length} ligne(s) au lieu de 3 : ${ajouts.map((a) => (a.type === "ajouter" ? a.libelle : "")).join(" | ")}`
    );
  });

  await cas("chaque ligne est rédigée, et non recopiée de sa dictée", async () => {
    for (const a of ajouts) {
      if (a.type !== "ajouter") continue;
      const defauts = defautsDeRedaction(a.libelle);
      assert.deepEqual(defauts, [], `« ${a.libelle} » ${defauts.join(", ")}`);
    }
  });

  await cas("la haie, la taille des hortensias et la tonte y sont toutes les trois", async () => {
    const dit = ajouts.map((a) => (a.type === "ajouter" ? a.libelle.toLowerCase() : "")).join(" | ");
    for (const attendu of ["haie", "hortensia", "pelouse"]) {
      assert.match(dit, new RegExp(attendu), `« ${attendu} » a été perdu : ${dit}`);
    }
  });

  await cas("les vingt mètres linéaires sont retenus, et sur la bonne ligne", async () => {
    const haie = ajouts.find((a) => a.type === "ajouter" && /haie/i.test(a.libelle));
    assert.ok(haie && haie.type === "ajouter", "aucune ligne de haie");
    assert.equal(haie.quantite, "20", "sa mesure a été perdue — il devra la redire");
    assert.equal(haie.unite, "ml", `unité « ${haie.unite} » : le moteur de prix ne la reconnaîtra pas`);
  });

  await cas("aucun prix n'a été inventé : il n'en a dit aucun", async () => {
    for (const a of ajouts) {
      assert.equal(
        a.type === "ajouter" && a.prixUnitaire,
        null,
        `${a.type === "ajouter" ? a.libelle : ""} arrive chiffrée alors qu'il n'a annoncé aucun montant`
      );
    }
  });

  // **Le 15 août n'a pas disparu.** L'invite tient les deux façons de parler ;
  // celle qu'on ne rejoue pas est celle qui casserait sans qu'on le voie.
  console.log("\n=== Ses corrections du 15 août, sur un devis déjà écrit ===\n");
  const corrections = await comprendre(
    "Supprime-moi la deuxième ligne, et remplace-moi le deux cent cinquante par trois cent cinquante sur la taille de haie.",
    DEVIS
  );
  console.log(`${JSON.stringify(corrections, null, 2).replace(/^/gm, "    ")}\n`);

  await cas("« supprime la deuxième ligne » retire toujours une ligne", async () => {
    assert.ok(
      corrections.some((r) => r.type === "retirer"),
      "la dictée de correction n'est plus comprise comme telle"
    );
  });

  await cas("« deux cent cinquante par trois cent cinquante » change toujours un prix", async () => {
    const prix = corrections.find((r) => r.type === "prix");
    assert.ok(prix && prix.type === "prix", "aucun changement de prix compris");
    assert.equal(prix.prixUnitaire, "350");
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(`\n❌ ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
