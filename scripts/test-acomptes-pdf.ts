import assert from "node:assert";
import { composerDevisPdf, type DevisPdfData } from "../src/server/pdf/devis-pdf";

/**
 * L'ÉCHÉANCIER ARRIVE SUR LE PAPIER — sa demande du 12 septembre 2026 :
 * *« chez le client il faut marquer reste à régler après acompte et le montant »*.
 *
 * On lit la TRACE du PDF, pas une fonction pure : `test-acomptes-devis.ts`
 * tient déjà le calcul. Ce qui se casse sans cette suite, c'est le CHEMIN —
 * une pièce débranchée entre le devis et la feuille que le client garde
 * (`CLAUDE.md` §5, et la leçon des conditions du 25 août).
 *
 * **Sait échouer** : retirer `apresTotal` de `composerDevisPdf` fait tomber le
 * premier cas en nommant la ligne absente.
 */

const BASE: DevisPdfData = {
  numeroCommercial: "2026-0017",
  numeroVersion: 1,
  statut: "envoye",
  dateEmission: "2026-09-12",
  validiteJours: 30,
  entrepriseNom: "Eden Nature",
  entrepriseAdresse: "10 rue des Artisans, 78200 Buchelay",
  entrepriseSiret: "123 456 789 00012",
  entrepriseTelephone: "06 79 98 45 14",
  entrepriseEmail: "contact@eden-nature.fr",
  entrepriseIban: null,
  clientNom: "M. Chausson",
  clientAdresse: "6 rue des Mureaux, 78130 Les Mureaux",
  clientTelephone: null,
  adresseChantier: "6 rue des Mureaux, 78130 Les Mureaux",
  conditionsPaiement: "Accès par le portail de gauche, cour à dégager la veille.",
  devise: "EUR",
  tauxTva: "20.00",
  totalHt: "2370.00",
  totalTva: "474.00",
  totalTtc: "2844.00",
  conditionsReglees: { acomptePourcent: "30" },
  lignes: [
    { libelle: "Élagage du platane, taille douce", quantite: "1", prixUnitaire: "850.00", montant: "850.00" },
    { libelle: "Abattage du cerisier mort et dessouchage", quantite: "1", prixUnitaire: "1200.00", montant: "1200.00" },
    { libelle: "Évacuation des déchets verts", quantite: "4", unite: "m³", prixUnitaire: "80.00", montant: "320.00" },
  ],
};

const TROIS = [
  { rang: 1, tauxCumule: "30" },
  { rang: 2, tauxCumule: "50" },
  { rang: 3, tauxCumule: "75" },
];

async function papier(data: DevisPdfData, options = {}): Promise<string> {
  const { trace } = await composerDevisPdf(data, options);
  return trace.textes.map((t) => t.contenu).join(" ").replace(/\s+/g, " ");
}

let echecs = 0;
async function essai(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

console.log("=== L'échéancier du devis arrive-t-il sur le papier ? ===\n");

async function main() {
  await essai("sous le total : chaque acompte, son montant, puis le reste à régler", async () => {
    const lu = await papier({ ...BASE, acomptes: TROIS });
    for (const attendu of [
      "Acompte 30 % à la signature",
      "853,20",
      "Acompte à mi-parcours 50 %",
      "568,80",
      "Acompte à l'avancement 75 %",
      "711,00",
      "Reste à régler après acomptes",
    ]) {
      assert.ok(lu.includes(attendu), `« ${attendu} » n'est pas sur le devis. Lu : ${lu.slice(-700)}`);
    }
    // Le reste (711,00) vient APRÈS le total TTC, et après le dernier acompte.
    assert.ok(lu.indexOf("Total TTC") < lu.indexOf("Reste à régler"), "le reste à régler est avant le total");
    assert.ok(lu.indexOf("Acompte à l'avancement") < lu.indexOf("Reste à régler"), "le reste précède un acompte");
  });

  await essai("les notes disent chaque acompte, en cumul clair, sans tiret", async () => {
    const lu = await papier({ ...BASE, acomptes: TROIS });
    assert.ok(lu.includes("Acompte de 30 % à la signature, soit"), "la phrase du premier acompte manque");
    assert.ok(lu.includes("Acompte à mi-parcours 50 %, soit"), "le cumul du deuxième n'est pas dit");
    assert.ok(!lu.includes("réglés)"), "les parenthèses sont revenues — retirées le 13 septembre 2026");
    assert.ok(!lu.includes("— soit"), "le tiret qu'il a fait retirer est revenu");
    // Un seul acompte de 30 % dans les notes : celui POSÉ, pas le réglage en plus.
    assert.equal((lu.match(/Acompte de 30 %/g) ?? []).length, 1, "l'acompte s'imprime deux fois dans les notes");
  });

  await essai("ligne retirée : rien sous le total, mais la phrase du réglage reste — « quoi qu'il arrive »", async () => {
    const lu = await papier({ ...BASE, acomptes: [] });
    assert.ok(!lu.includes("Reste à régler"), "un reste à régler sans acompte");
    assert.ok(lu.includes("Acompte de 30 % à la commande, soit 853,20"), "la phrase des Réglages a disparu des notes");
  });

  await essai("un devis d'avant (sans la colonne) sort identique à lui-même", async () => {
    const sans = await papier({ ...BASE, conditionsReglees: undefined });
    assert.ok(!sans.includes("Acompte"), "un acompte est apparu sur un devis qui n'en portait pas");
  });

  await essai("la feuille de chantier n'en porte aucun — pas un prix chez le salarié", async () => {
    const lu = await papier({ ...BASE, acomptes: TROIS }, { sansChiffrage: true });
    for (const interdit of ["Acompte", "853,20", "Reste à régler"]) {
      assert.ok(!lu.includes(interdit), `« ${interdit} » est sur la feuille sans prix du salarié`);
    }
  });

  await essai("l'unité s'imprime avec la quantité : « 4 m³ »", async () => {
    const lu = await papier({ ...BASE, acomptes: [] });
    assert.ok(lu.includes("4 m³"), `« 4 m³ » manque : ${lu.slice(0, 600)}`);
  });

  console.log("");
  if (echecs) {
    console.log(`${echecs} ÉCHEC(S).`);
    process.exit(1);
  }
  console.log("Tout est au vert.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
