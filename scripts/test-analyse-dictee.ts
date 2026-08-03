import assert from "node:assert/strict";
import { analyserDemandeTexte } from "../src/server/orchestrateur/analyse-demande";
import { fournisseurLLMDev } from "../src/server/ai/providers/llm/dev";
import type { PropositionExtraction } from "../src/server/ai/schemas/extraction";

// Ce que la dictée du patron devient à l'écran.
//
// Le 3 août 2026 il a écrit trois lignes et reçu, en face, une seule prestation
// au libellé collé, aucun matériel, aucune gestion de déchets. Son mot : « ça
// n'a rien à voir ». Il avait raison, et rien ne le signalait : l'écran
// affirmait « Rien de détecté dans la dictée » en face de trois machines
// nommées. C'est le silence qui coûte, pas l'imprécision.
//
// La règle éprouvée ici est plus forte que « le résultat est correct » — une
// heuristique ne comprendra jamais un chantier. Elle est : **rien de ce qui a
// été dicté ne disparaît**. Ce qu'on ne sait pas classer ressort quelque part,
// jamais dans le vide.

const DICTEE_DU_PATRON = `Taille de haie laurier 20 m linéaires
Abattage chêne mort, couper le bois en 50 cm fendre laisser sur place
Estimation 2 jours 2 hommes broyeur plus camion plus fendeuse`;

let echecs = 0;
function cas(nom: string, verifier: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(verifier)
    .then(() => console.log(`  ✓ ${nom}`))
    .catch((e: Error) => {
      echecs++;
      console.error(`  ✗ ${nom}\n    ${e.message}`);
    });
}

async function extraire(texte: string): Promise<PropositionExtraction> {
  const resultat = await fournisseurLLMDev.genererTexte("", texte);
  assert.ok(resultat.succes, "Le fournisseur a refusé le texte.");
  return JSON.parse(resultat.texte) as PropositionExtraction;
}

/** Tout ce que l'extraction a produit, en un seul texte comparable. */
function toutCeQuiRessort(p: PropositionExtraction): string {
  return [
    ...p.prestations.map((l) => `${l.libelle} ${l.quantite ?? ""} ${l.unite ?? ""}`),
    ...p.materiel.map((l) => `${l.libelle} ${l.quantite ?? ""} ${l.unite ?? ""}`),
    p.dureePrevue ?? "",
    p.tailleEquipe ?? "",
    p.gestionDechets ?? "",
    p.contraintesAcces ?? "",
    p.remarques ?? "",
    ...p.ambiguites,
  ]
    .join(" ")
    .toLowerCase();
}

// Mots que l'analyse a le droit d'absorber : liaisons, articles, et les amorces
// de dictée (« Estimation… ») qui n'appartiennent à aucune prestation. La liste
// est courte et explicite — c'est elle qui empêche l'invariant de devenir
// complaisant à force d'exceptions.
const ABSORBABLES = new Set([
  "de", "du", "des", "le", "la", "les", "l", "un", "une", "au", "aux",
  "en", "et", "plus", "sur", "dans", "par", "pour", "avec", "à", "a",
  "estimation", "estime", "prévoir", "prévu", "compter", "il", "faut",
]);

function motsPerdus(source: string, resultat: string): string[] {
  return source
    .toLowerCase()
    .split(/[^0-9a-zà-öø-ÿ]+/i)
    .filter((m) => m.length > 0 && !ABSORBABLES.has(m))
    .filter((m) => !resultat.includes(m));
}

async function main() {
  console.log("=== La dictée arrive entière à l'écran ===");

  await cas("la dictée du patron rend ses trois prestations, pas une seule collée", async () => {
    const p = await extraire(DICTEE_DU_PATRON);
    const libelles = p.prestations.map((l) => l.libelle);
    assert.ok(
      libelles.some((l) => /taille de haie/i.test(l)),
      `La taille de haie a disparu. Reçu : ${JSON.stringify(libelles)}`
    );
    assert.ok(
      libelles.some((l) => /abattage/i.test(l)),
      `L'abattage a disparu. Reçu : ${JSON.stringify(libelles)}`
    );
    assert.ok(
      !libelles.some((l) => /taille de haie[\s\S]*abattage/i.test(l)),
      "Deux prestations sont collées dans un même libellé : le retour à la ligne n'a pas été vu."
    );
  });

  await cas("le matériel nommé après la durée n'est plus jeté avec elle", async () => {
    // Le défaut exact : sa troisième ligne portait la durée, l'équipe ET son
    // matériel. Le segment entier était écarté parce qu'il contenait « 2 jours ».
    const p = await extraire(DICTEE_DU_PATRON);
    const materiels = p.materiel.map((l) => l.libelle.toLowerCase()).join(" ");
    for (const machine of ["broyeur", "camion", "fendeuse"]) {
      assert.ok(materiels.includes(machine), `« ${machine} » n'apparaît nulle part dans le matériel.`);
    }
  });

  await cas("« laisser sur place » nourrit les déchets sans emporter la prestation", async () => {
    const p = await extraire(DICTEE_DU_PATRON);
    assert.ok(p.gestionDechets, "La gestion des déchets est restée « non mentionné » alors qu'elle est dictée.");
    assert.ok(
      p.prestations.some((l) => /couper|fendre/i.test(l.libelle)),
      "Le travail sur le bois a été reclassé en déchets : il a disparu du devis."
    );
  });

  await cas("durée et équipe restent lues", async () => {
    const p = await extraire(DICTEE_DU_PATRON);
    assert.match(p.dureePrevue ?? "", /2\s*jours/i);
    assert.match(p.tailleEquipe ?? "", /2\s*hommes/i);
  });

  await cas("la gestion des déchets n'est plus réclamée alors qu'elle est là", async () => {
    const p = await extraire(DICTEE_DU_PATRON);
    assert.ok(
      !p.informationsManquantes.some((m) => /d[ée]chet/i.test(m)),
      "L'écran réclame une information que le patron a pourtant dictée."
    );
  });

  await cas("INVARIANT — aucun mot de la dictée ne se perd", async () => {
    const p = await extraire(DICTEE_DU_PATRON);
    const perdus = motsPerdus(DICTEE_DU_PATRON, toutCeQuiRessort(p));
    assert.deepEqual(perdus, [], `Ces mots dictés n'apparaissent nulle part : ${perdus.join(", ")}`);
  });

  await cas("INVARIANT — tenu aussi sur d'autres dictées", async () => {
    const dictees = [
      "Élagage de trois tilleuls\nBroyage des branches sur place\nUne journée, deux hommes, nacelle",
      "Abattage sapin 12 m, accès par ruelle étroite, évacuation des déchets en benne",
      "Taille douce pommier ; débroussailleuse et tronçonneuse ; environ une journée",
    ];
    for (const dictee of dictees) {
      const perdus = motsPerdus(dictee, toutCeQuiRessort(await extraire(dictee)));
      assert.deepEqual(perdus, [], `Perdu dans « ${dictee.split("\n")[0]}… » : ${perdus.join(", ")}`);
    }
  });

  console.log("=== Ce que l'analyse ne doit pas faire ===");

  await cas("« environ » ne fait plus disparaître la prestation qu'il accompagne", async () => {
    // Elle partait tout entière dans les ambiguïtés, donc hors de l'écran.
    const analyse = analyserDemandeTexte("Environ 20 m de haie à tailler");
    assert.equal(analyse.prestations.length, 1, "La prestation incertaine a été retirée au lieu d'être signalée.");
    assert.equal(analyse.ambiguites.length, 1, "L'incertitude n'est plus signalée.");
  });

  await cas("un nombre décimal ne se coupe pas en deux", async () => {
    const analyse = analyserDemandeTexte("Haie de 1,5 m de haut");
    assert.ok(
      analyse.prestations.some((s) => s.includes("1,5")),
      `« 1,5 » a été scindé : ${JSON.stringify(analyse.prestations)}`
    );
  });

  await cas("« évacuation des déchets » reste entière côté déchets", async () => {
    // Le risque introduit par la séparation : ne retirer que le mot trouvé et
    // laisser « des déchets » traîner en prestation.
    const p = await extraire("Poser la cloison, évacuation des déchets");
    assert.ok(p.gestionDechets, "L'évacuation n'a pas été reconnue.");
    assert.ok(
      !p.prestations.some((l) => /d[ée]chet/i.test(l.libelle)),
      `Un résidu de déchets traîne en prestation : ${JSON.stringify(p.prestations.map((l) => l.libelle))}`
    );
  });

  await cas("une unité n'est pas un matériel", async () => {
    const analyse = analyserDemandeTexte("Débroussaillage 300 m² de terrain");
    assert.equal(analyse.materiel.length, 0, `« m² » a été pris pour du matériel : ${JSON.stringify(analyse.materiel)}`);
    assert.equal(analyse.prestations.length, 1, "Le débroussaillage n'est plus une prestation.");
  });

  await cas("rien n'est inventé : un texte sans matériel n'en produit aucun", async () => {
    const p = await extraire("Taille de haie");
    assert.equal(p.materiel.length, 0, "Du matériel est apparu sans avoir été dicté.");
    assert.equal(p.dureePrevue, null, "Une durée est apparue sans avoir été dictée.");
    assert.equal(p.tailleEquipe, null, "Une équipe est apparue sans avoir été dictée.");
    assert.equal(p.gestionDechets, null, "Une gestion des déchets est apparue sans avoir été dictée.");
  });

  await cas("un texte vide est refusé, jamais complété", async () => {
    const resultat = await fournisseurLLMDev.genererTexte("", "   ");
    assert.equal(resultat.succes, false, "Un texte vide a produit une extraction.");
  });

  if (echecs > 0) {
    console.error(`\n${echecs} contrôle(s) en échec.`);
    process.exit(1);
  }
  console.log("Tous les contrôles de l'analyse de dictée sont passés.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
