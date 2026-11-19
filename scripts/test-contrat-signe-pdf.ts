import assert from "node:assert";
import { composerContratPdf, type DonneesContratPdf } from "../src/server/pdf/contrat-pdf";
import { SIGNATURE_ESSAI_OCTETS } from "./_signature-essai";

/**
 * LE CONTRAT D'ENTRETIEN SIGNÉ EN LIGNE, SUR LE PAPIER — sa question du
 * 18 novembre 2026 (*« même pour un contrat d'entretien, il y aura la
 * signature ? »*) et sa planche B du même jour.
 *
 *   A. signé : le trait est DANS le cadre, et dessous, qui et le jour ;
 *      la mention du pied dit l'accord en ligne ;
 *   B. non signé : le cadre reste vide, la mention d'avant.
 *
 * **Sait échouer** : sans le passage de `signature` à `composerDocument`, A tombe.
 */

const BASE: DonneesContratPdf = {
  entrepriseNom: "Perret Paysage",
  entrepriseAdresse: "3 rue des Tilleuls, 78000 Versailles",
  entrepriseSiret: "123 456 789 00012",
  entrepriseTelephone: "06 12 34 56 78",
  entrepriseEmail: "contact@perret-paysage.fr",
  entrepriseIban: null,
  clientNom: "Lefèvre",
  clientCivilite: "mme",
  clientAdresse: "8 allée des Charmes, 78000 Versailles",
  clientTelephone: null,
  adresseChantier: "8 allée des Charmes, 78000 Versailles",
  conditionsPaiement: null,
  prestations: [{ libelle: "Tonte et ébarbage", famille: "Pelouse", mois: [4, 5, 6, 7, 8, 9, 10], foisParMois: 2, prixPassageHt: "45.00" }],
  periode: { debut: "2027-04-01", dureeMois: 12 },
  reconduit: true,
  facturation: "passage",
  tauxTva: "20.00",
  statut: "accepte",
  dateDuDocument: "2026-11-18",
};

const texte = (trace: { textes: { contenu: string }[] }) => trace.textes.map((t) => t.contenu).join(" ").replace(/\s+/g, " ");

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

console.log("=== Le contrat d'entretien signé en ligne ===\n");

async function main() {
  await essai("A. signé : le trait dans le cadre, qui et le jour, l'accord en ligne au pied", async () => {
    const { trace } = await composerContratPdf({ ...BASE, signature: { png: SIGNATURE_ESSAI_OCTETS, nom: "Mme Lefèvre", jour: "2026-11-18" } });
    assert.equal(trace.signatures.length, 1, "La signature n'est pas posée.");
    const [s] = trace.signatures;
    const [c] = trace.cadres;
    assert.ok(c, "Le cadre du contrat a disparu.");
    assert.ok(
      s.x >= c.x && s.y >= c.y && s.x + s.largeur <= c.x + c.largeur && s.y + s.hauteur <= c.y + c.hauteur,
      "La signature déborde du cadre."
    );
    const lu = texte(trace);
    assert.ok(lu.includes("Signé en ligne par Mme Lefèvre, le 18/11/2026."), `La phrase manque : ${lu.slice(-300)}`);
    assert.ok(lu.includes("Accepté et signé en ligne par le client le 18/11/2026."), "La mention de l'accord en ligne manque.");
    assert.ok(!lu.includes("ou daté et signé ci-contre"), "Le contrat signé réclame encore une signature à la main.");
  });

  await essai("B. non signé : le cadre vide, la mention d'avant", async () => {
    const { trace } = await composerContratPdf({ ...BASE, statut: "envoye" });
    assert.equal(trace.signatures.length, 0);
    assert.equal(trace.cadres.length, 1);
    assert.ok(texte(trace).includes("ou daté et signé ci-contre"), "La mention d'avant a changé.");
  });

  console.log(echecs ? `\n❌ ${echecs} échec(s)` : "\n✅ Le contrat signé se lit sur le papier.");
  process.exit(echecs ? 1 : 0);
}

main();
