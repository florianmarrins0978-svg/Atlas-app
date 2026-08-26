import assert from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { FICHES_MODE_EMPLOI, chercherFiches, type FicheModeEmploi } from "../src/lib/mode-emploi";

/**
 * Le mode d'emploi que récite l'assistant, confronté au CODE.
 *
 * **Pourquoi cette suite existe.** Une fiche dit un geste — « glissez, puis
 * Retirer ». Le jour où ce bouton change de nom, disparaît, ou change d'écran,
 * l'assistant continuerait de l'enseigner : l'artisan chercherait cinq minutes
 * avant de conclure que l'application est cassée. Une documentation périmée est
 * pire qu'absente, on s'y fie encore (`CLAUDE.md` §1).
 *
 * Chaque fiche porte donc son fichier source et des `preuves` — des morceaux de
 * texte qui doivent s'y trouver. C'est cette confrontation qui est éprouvée
 * ici, et rien d'autre.
 */

let passed = 0;
let failed = 0;
function test(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${nom}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

const RACINE = path.join(__dirname, "..");

/**
 * Ce qu'une fiche doit prouver — extrait pour pouvoir être RETOURNÉ contre une
 * fausse fiche plus bas. Un contrôle qui n'a jamais échoué ne prouve rien
 * (`AGENTS.md`).
 */
function defautsDeLaFiche(fiche: FicheModeEmploi): string[] {
  const defauts: string[] = [];
  const chemin = path.join(RACINE, fiche.source);
  if (!existsSync(chemin)) {
    defauts.push(`le fichier ${fiche.source} n'existe pas`);
    return defauts;
  }
  const source = readFileSync(chemin, "utf8");
  for (const preuve of fiche.preuves) {
    if (!source.includes(preuve)) defauts.push(`« ${preuve} » ne se trouve plus dans ${fiche.source}`);
  }
  return defauts;
}

function main() {
  test("Chaque fiche prouve son geste contre son fichier source", () => {
    const defauts = FICHES_MODE_EMPLOI.flatMap((f) => defautsDeLaFiche(f).map((d) => `${f.id} : ${d}`));
    assert.deepEqual(
      defauts,
      [],
      `Le code a bougé sous le mode d'emploi. Corrigez la fiche AVANT que l'assistant n'enseigne un geste mort :\n${defauts.join("\n")}`
    );
  });

  test("Le contrôle sait échouer : une fiche qui invente un bouton est refusée", () => {
    const inventee: FicheModeEmploi = {
      id: "inventee",
      ecran: "Chantiers",
      ou: "nulle part",
      intitule: "Un geste qui n'existe pas",
      motsCles: ["inventer"],
      geste: "Appuyez sur « Supprimer définitivement ».",
      source: "src/app/EcranChantiers.tsx",
      preuves: ["Supprimer définitivement"],
    };
    assert.equal(defautsDeLaFiche(inventee).length, 1, "Une preuve absente du code doit être signalée");
  });

  test("Le contrôle sait échouer : un fichier source disparu est signalé", () => {
    const orpheline: FicheModeEmploi = {
      ...FICHES_MODE_EMPLOI[0],
      id: "orpheline",
      source: "src/app/EcranQuiNExistePas.tsx",
    };
    assert.equal(defautsDeLaFiche(orpheline).length, 1);
  });

  test("Aucun identifiant en double", () => {
    const ids = FICHES_MODE_EMPLOI.map((f) => f.id);
    assert.equal(new Set(ids).size, ids.length, "Deux fiches portent le même identifiant");
  });

  test("Chaque fiche porte un geste, un écran et au moins une preuve", () => {
    for (const f of FICHES_MODE_EMPLOI) {
      assert.ok(f.geste.trim().length > 10, `${f.id} : le geste est vide ou trop court`);
      assert.ok(f.ecran.trim().length > 0, `${f.id} : pas d'écran`);
      assert.ok(f.motsCles.length >= 3, `${f.id} : trop peu de mots-clés pour être retrouvée`);
      assert.ok(f.preuves.length >= 1, `${f.id} : aucune preuve — la fiche ne peut plus être confrontée au code`);
    }
  });

  // **Sa règle du 25 août 2026 : « arrête de mettre des flèches, c'est moche ».**
  // Elle vise l'ORNEMENT — la flèche au bout d'un libellé —, pas le chevron qui
  // porte une vraie fonction : « ‹ » et « › » désignent le feuilletage des
  // semaines, et les nommer est le seul moyen de dire où appuyer. Le contrôle
  // fait donc la même distinction que la règle, sinon il réclamerait le
  // contraire de ce qui est à l'écran (`CLAUDE.md` §5 bis).
  test("Aucune flèche décorative au bout d'un geste (sa règle du 25 août 2026)", () => {
    for (const f of FICHES_MODE_EMPLOI) {
      const texte = `${f.geste} ${f.intitule} ${f.reserve ?? ""}`;
      assert.ok(!texte.includes("→"), `${f.id} : la flèche « → » est de l'ornement`);
      assert.ok(!/[›‹]\s*$/.test(f.geste.trim()), `${f.id} : chevron décoratif en fin de geste`);
    }
  });

  // --- Ce qu'il demandera vraiment ---------------------------------------
  //
  // La question de sa demande du 25 août 2026, mot pour mot, et la réponse
  // qu'il attend. Si un jour elle ne sort plus, c'est la recherche qu'il faut
  // corriger — pas la question.
  test("Sa question du 25 août ressort le glissement, mot pour mot", () => {
    const fiches = chercherFiches(
      "comment je fais pour supprimer un client en attente de rédaction de son devis sur la page chantier"
    );
    assert.ok(fiches.length > 0, "Aucune fiche trouvée pour sa question");
    assert.equal(fiches[0].id, "chantiers-retirer");
    assert.match(fiches[0].geste, /Glissez la ligne de droite à gauche/);
    assert.match(fiches[0].geste, /Retirer/);
  });

  const ATTENDUS: [string, string][] = [
    ["comment changer mon mot de passe", "reglages-mot-de-passe"],
    ["comment envoyer le devis au client", "devis-envoyer"],
    ["comment on fait une facture", "facture-creer"],
    ["comment je déplace un chantier sur le planning", "planning-deplacer"],
    ["où je vois ma tva", "tva"],
    ["comment ajouter une photo", "photos-ajouter"],
    ["comment faire une remise à mon client", "devis-remise"],
    ["comment corriger un devis déjà envoyé", "devis-corriger-envoye"],
    ["comment dicter mon chantier", "fiche-note-vocale"],
    ["comment relier mon agenda google", "reglages-agenda"],
    ["comment ajouter un tarif", "reglages-tarifs"],
    ["comment mettre face id", "reglages-face-id"],
    ["comment changer le siret de mon entreprise", "reglages-identite"],
    ["je veux mettre le mode sombre", "reglages-apparence"],
    ["comment donner la feuille de chantier à mes gars sans les prix", "planning-feuille"],
    ["comment télécharger mes données", "reglages-donnees"],
  ];

  test("Les questions telles qu'il les pose retrouvent la bonne fiche", () => {
    const ecarts = ATTENDUS.filter(([question, attendu]) => chercherFiches(question)[0]?.id !== attendu).map(
      ([question, attendu]) => `« ${question} » → ${chercherFiches(question)[0]?.id ?? "(rien)"} au lieu de ${attendu}`
    );
    assert.deepEqual(ecarts, [], ecarts.join("\n"));
  });

  test("Une question qui n'en est pas une ne rend RIEN", () => {
    // Le refus est la moitié de l'intérêt : sans lui, l'assistant répondrait
    // toujours quelque chose, et l'on cesserait de le croire.
    for (const hors of ["quel temps fait-il à Nantes", "combien coûte un abattage de chêne", "bonjour"]) {
      assert.deepEqual(chercherFiches(hors), [], `« ${hors} » ne devrait rien trouver`);
    }
  });

  test("Une question vide ne rend rien plutôt que la première fiche venue", () => {
    assert.deepEqual(chercherFiches(""), []);
    assert.deepEqual(chercherFiches("   "), []);
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échec(s)`);
  if (failed > 0) process.exit(1);
}

main();
