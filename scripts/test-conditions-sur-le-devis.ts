import assert from "node:assert";
import { composerDevisPdf, type DevisPdfData } from "../src/server/pdf/devis-pdf";

/**
 * LES CINQ CONDITIONS RÉGLÉES ARRIVENT SUR LE DEVIS — et s'en vont quand on les
 * éteint.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **SON CONSTAT DU 25 AOÛT 2026**, et il l'a vu tout seul : *« les autres qui
 * sont en ON doivent-ils être visibles sur le devis ? car je ne vois rien, est-ce
 * normal ? »*
 *
 * Non. Six réglages se saisissaient dans Réglages → Documents depuis le 14 août,
 * **un seul atteignait le document** : la validité. `lignesConditionsDevis`
 * composait bien les cinq autres phrases — et personne ne l'appelait hors de
 * l'aperçu de cet écran-là. Il réglait, il voyait l'aperçu, son client ne
 * recevait rien.
 *
 * **CE QUI RENDAIT LE DÉFAUT INVISIBLE, et c'est ce qui l'a fait durer onze
 * jours.** Sur son écran de devis, « Acompte de 30 % à la signature… » s'affiche
 * bel et bien — mais en GRIS, comme exemple dans un champ libre vide
 * (`placeholder`) ; et « Modalités de paiement / IBAN » vient de ses coordonnées
 * bancaires. Deux choses vraies à l'écran donnaient l'impression que le réglage
 * marchait.
 *
 * **POURQUOI ON LIT LA TRACE DU PDF ET NON UNE FONCTION PURE.** Une suite sur
 * `lignesConditionsDevis` était déjà verte le 24 août, et elle l'est restée
 * pendant tout le défaut : la fonction n'a jamais été en cause. Ce qui manquait,
 * c'est le CHEMIN entre le réglage et le papier. Un contrôle qui n'éprouve pas
 * le chemin ne peut pas voir une pièce débranchée (`CLAUDE.md` §5).
 *
 * **Sait échouer** : débrancher `conditionsReglees` de `composerDevisPdf` fait
 * tomber le premier cas en nommant la ligne absente.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const BASE: DevisPdfData = {
  numeroCommercial: "2026-0012",
  numeroVersion: 1,
  statut: "envoye",
  dateEmission: "2026-08-25",
  validiteJours: 30,
  entrepriseNom: "Eden Nature",
  entrepriseAdresse: "10 rue des Artisans, 78200 Buchelay",
  entrepriseSiret: "123 456 789 00012",
  entrepriseTelephone: "06 79 98 45 14",
  entrepriseEmail: "contact@eden-nature.fr",
  entrepriseIban: null,
  clientNom: "Mme Éléonore Châteauneuf",
  clientAdresse: "3 allée des Œillets, 78711 Mantes-la-Ville",
  clientTelephone: null,
  adresseChantier: "3 allée des Œillets, 78711 Mantes-la-Ville",
  conditionsPaiement: null,
  devise: "EUR",
  tauxTva: "20.00",
  totalHt: "870.00",
  totalTva: "174.00",
  totalTtc: "1044.00",
  lignes: [
    { libelle: "Élagage — 3 chênes", quantite: "1", prixUnitaire: "450.00", montant: "450.00" },
    { libelle: "Évacuation des déchets verts", quantite: "1", prixUnitaire: "420.00", montant: "420.00" },
  ],
};

/** Les cinq réglages allumés, comme sur son écran. */
const TOUT_ALLUME = {
  acomptePourcent: "30",
  delaiPaiementJours: 30,
  moyensPaiement: "virement, chèque",
  rappelerPenalites: true,
  textePied: "Sous réserve d'accès au chantier.",
};

/** Le papier, à plat : ce qu'un client lit, sans se soucier des retours à la ligne. */
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

console.log("=== Les conditions réglées arrivent sur le devis ===\n");

async function main() {

  await essai("les cinq lignes s'impriment quand elles sont allumées", async () => {
  const lu = await papier({ ...BASE, conditionsReglees: TOUT_ALLUME });
  for (const attendu of [
    "Acompte de 30 %",
    "Paiement à 30 jours",
    "Moyens de paiement acceptés : virement, chèque",
    "pénalités au taux de trois fois le taux d'intérêt légal",
    "Sous réserve d'accès au chantier",
  ]) {
    assert.ok(
      lu.includes(attendu),
      `« ${attendu} » n'est pas sur le devis. Son réglage est allumé et le client n'en voit rien —\n` +
        `      c'est exactement ce qu'il a signalé le 25 août 2026.`
    );
  }
});

// **CE QU'IL A DEMANDÉ EN MÊME TEMPS**, et il fallait le lui confirmer : *« si je
// décoche le bouton OFF, ils sont censés disparaître ? »* — oui. Sans ce
// contrôle, brancher les lignes aurait pu les rendre indélébiles, ce qui est
// pire que de ne pas les avoir : il croirait pouvoir les retirer.
  await essai("éteints, ils disparaissent — sa question du 25 août", async () => {
  const lu = await papier({ ...BASE, conditionsReglees: {} });
  for (const interdit of ["Acompte", "Moyens de paiement acceptés", "pénalités au taux"]) {
    assert.ok(!lu.includes(interdit), `« ${interdit} » s'imprime alors que le réglage est éteint`);
  }
});

// **Un devis d'avant la migration 0064 n'a AUCUNE de ces colonnes.** Le poser
// rétroactivement ajouterait des conditions à des documents déjà partis.
  await essai("un devis d'avant sort identique à lui-même", async () => {
  const lu = await papier(BASE);
  for (const interdit of ["Acompte", "Moyens de paiement acceptés", "pénalités au taux"]) {
    assert.ok(!lu.includes(interdit), `« ${interdit} » est apparu sur un devis qui ne le portait pas`);
  }
});

// **SON TEXTE À LUI PASSE EN PREMIER, et il n'est jamais remplacé.** Ce qu'il
// écrit parle de CE chantier ; les conditions sont les mêmes sur tous ses devis.
// Le perdre serait le pire des deux défauts : silencieux, et sur un document
// parti chez un client.
  await essai("ce qu'il a écrit à la main reste, et vient avant", async () => {
  const sien = "Accès par le portail de gauche, merci de dégager la cour la veille.";
  const lu = await papier({ ...BASE, conditionsPaiement: sien, conditionsReglees: TOUT_ALLUME });
  assert.ok(lu.includes("Accès par le portail de gauche"), "son texte libre a disparu du devis");
  // **L'ordre ne se juge que si les deux sont là.** Sinon le message accuse
  // l'ordre pour une ligne absente, et envoie chercher au mauvais endroit
  // (`CLAUDE.md` §5). Vu en débranchant le raccordement exprès.
  assert.ok(lu.includes("Acompte de 30 %"), "la ligne d'acompte n'est pas sur le devis du tout");
  assert.ok(
    lu.indexOf("portail de gauche") < lu.indexOf("Acompte de 30 %"),
    "les conditions réglées passent AVANT ce qu'il a écrit pour ce chantier-là"
  );
});

// **LE MONTANT DE L'ACOMPTE SE CALCULE ICI**, là où le total est connu. Dans
// l'aperçu des Réglages il ne l'est pas, et la fonction le tait plutôt que
// d'inventer un chiffre — un montant supposé finirait imprimé (`CLAUDE.md` §4).
  await essai("l'acompte porte son montant, calculé sur le total TTC", async () => {
  const lu = await papier({ ...BASE, conditionsReglees: TOUT_ALLUME });
  assert.ok(
    lu.includes("313,20"),
    `le montant de l'acompte manque : 30 % de 1044,00 € font 313,20 €. Lu : ${lu.slice(0, 400)}`
  );
});

// **RIEN DE TOUT CELA SUR LA FEUILLE DE CHANTIER.** Elle part chez un salarié,
// délibérément sans un prix (sa décision du 21 août 2026) : « acompte de 30 % —
// soit 313,20 € » y serait un montant, et le document cesserait d'être ce qu'il
// annonce. C'est la règle que suit déjà l'IBAN.
  await essai("la feuille de chantier n'en porte aucune", async () => {
  const lu = await papier({ ...BASE, conditionsReglees: TOUT_ALLUME }, { sansChiffrage: true });
  for (const interdit of ["Acompte", "313,20", "Moyens de paiement acceptés"]) {
    assert.ok(!lu.includes(interdit), `« ${interdit} » est sur la feuille sans prix du salarié`);
  }
});

  console.log("");
  if (echecs) {
    console.log(`${echecs} ÉCHEC(S).`);
    process.exit(1);
  }
  console.log("Conditions sur le devis — 0 échec(s).");
}

main();
