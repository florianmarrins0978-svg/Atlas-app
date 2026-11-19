import assert from "node:assert";
import { composerDevisPdf, type DevisPdfData } from "../src/server/pdf/devis-pdf";
import { SIGNATURE_ESSAI_OCTETS } from "./_signature-essai";

/**
 * LE DEVIS SIGNÉ EN LIGNE, SUR LE PAPIER — sa planche du 17 novembre 2026
 * (`appli/soignee/devis-signe-par-le-client.html`) et son « tu peux coder »
 * du 18.
 *
 * Ce que la suite tient, sur la TRACE du PDF :
 *   A. la signature est posée DANS l'encadré « Bon pour accord », pas à côté ;
 *   B. sous la légende, qui a signé et le jour, sans l'heure (sa demande du 18) ;
 *   C. la mention du pied ne réclame plus la mention manuscrite ;
 *   D. sans signature, le devis sort comme avant : encadré vide, mention d'avant ;
 *   E. la feuille de travail (sans les prix) ne porte jamais de signature.
 *
 * **Sait échouer** : sans le passage de `signature` à `composerDocument`, A, B
 * et C tombent en nommant ce qui manque.
 */

const BASE: DevisPdfData = {
  numeroCommercial: "2026-0042",
  numeroVersion: 1,
  statut: "envoye",
  dateEmission: "2026-11-17",
  validiteJours: 30,
  entrepriseNom: "Perret Paysage",
  entrepriseAdresse: "3 rue des Tilleuls, 78000 Versailles",
  entrepriseSiret: "123 456 789 00012",
  entrepriseTelephone: "06 12 34 56 78",
  entrepriseEmail: "contact@perret-paysage.fr",
  entrepriseIban: null,
  clientNom: "Mme Lefèvre",
  clientAdresse: "8 allée des Charmes, 78000 Versailles",
  clientTelephone: null,
  adresseChantier: "8 allée des Charmes, 78000 Versailles",
  conditionsPaiement: null,
  devise: "EUR",
  tauxTva: "20.00",
  totalHt: "660.00",
  totalTva: "132.00",
  totalTtc: "792.00",
  lignes: [
    { libelle: "Taille de la haie de charmes, côté rue, 24 m", quantite: "1", prixUnitaire: "540.00", montant: "540.00" },
    { libelle: "Évacuation des déchets verts en déchetterie", quantite: "1", prixUnitaire: "120.00", montant: "120.00" },
  ],
};

const SIGNATURE = { png: SIGNATURE_ESSAI_OCTETS, nom: "Mme Lefèvre", jour: "2026-11-18" };

const texte = (trace: { textes: { contenu: string }[] }) =>
  trace.textes.map((t) => t.contenu).join(" ").replace(/\s+/g, " ");

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

console.log("=== Le devis signé en ligne, sur le papier ===\n");

async function main() {
  await essai("A. la signature est posée dans l'encadré, pas à côté", async () => {
    const { trace } = await composerDevisPdf(BASE, { signature: SIGNATURE });
    assert.equal(trace.signatures.length, 1, `${trace.signatures.length} signature(s) posée(s) au lieu d'une.`);
    assert.equal(trace.cadres.length, 1, "L'encadré « Bon pour accord » a disparu.");
    const [s] = trace.signatures;
    const [c] = trace.cadres;
    assert.equal(s.page, c.page, "La signature est sur une autre page que son encadré.");
    assert.ok(
      s.x >= c.x && s.y >= c.y && s.x + s.largeur <= c.x + c.largeur && s.y + s.hauteur <= c.y + c.hauteur,
      `La signature déborde de l'encadré : ${JSON.stringify(s)} dans ${JSON.stringify(c)}.`
    );
    assert.ok(s.largeur > 0 && s.hauteur > 0, "Une signature de zéro point ne prouve rien.");
  });

  await essai("B. sous la légende : qui a signé, et le jour, sans l'heure", async () => {
    const lu = texte((await composerDevisPdf(BASE, { signature: SIGNATURE })).trace);
    assert.ok(lu.includes("Bon pour accord, signature du client"), "La légende de l'encadré a disparu.");
    assert.ok(lu.includes("Signé en ligne par Mme Lefèvre, le 18/11/2026."), `La phrase de la signature manque : ${lu.slice(-400)}`);
    assert.ok(!/\d{1,2} ?h ?\d{2}|\d{1,2}:\d{2}/.test(lu.slice(lu.indexOf("Signé en ligne"))), "L'heure de la signature s'imprime.");
  });

  await essai("C. la mention du pied ne réclame plus la mention manuscrite", async () => {
    const lu = texte((await composerDevisPdf(BASE, { signature: SIGNATURE })).trace);
    assert.ok(!lu.includes("mention manuscrite"), "Le devis signé réclame encore une signature manuscrite.");
    assert.ok(lu.includes("Accepté et signé en ligne par le client le 18/11/2026."), "La mention de l'accord en ligne manque.");
  });

  await essai("D. sans signature : encadré vide, mention d'avant", async () => {
    const { trace } = await composerDevisPdf(BASE);
    assert.equal(trace.signatures.length, 0, "Une signature est apparue sur un devis non signé.");
    assert.equal(trace.cadres.length, 1);
    const lu = texte(trace);
    assert.ok(lu.includes("Bon pour accord précédé de la mention manuscrite"), "La mention d'avant a changé.");
    assert.ok(!lu.includes("Signé en ligne"), "Un devis non signé se dit signé.");
  });

  await essai("E. la feuille de travail ne porte jamais de signature", async () => {
    const { trace } = await composerDevisPdf(BASE, { sansChiffrage: true, signature: SIGNATURE });
    assert.equal(trace.signatures.length, 0, "La feuille de chantier porte la signature du client.");
    assert.equal(trace.cadres.length, 0, "La feuille de chantier a un encadré à signer.");
    assert.ok(!texte(trace).includes("Signé en ligne"));
  });

  console.log(echecs ? `\n❌ ${echecs} échec(s)` : "\n✅ Le devis signé se lit sur le papier.");
  process.exit(echecs ? 1 : 0);
}

main();
