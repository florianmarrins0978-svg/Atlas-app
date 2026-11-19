import assert from "node:assert";
import { composerRapportEntretienPdf } from "../src/server/pdf/rapport-entretien-pdf";
import type { RapportPublic } from "../src/server/repositories/passages-entretien";
import { SIGNATURE_ESSAI_PNG } from "./_signature-essai";

/**
 * LE RETOUR D'INTERVENTION SIGNÉ SUR PLACE, SUR LE PAPIER — sa planche du
 * 17 novembre 2026 (`appli/soignee/fiche-signee-par-le-client.html`).
 *
 *   A. signé : la signature est DANS le cadre du devis, et dessous, qui et le
 *      jour, sans l'heure ni « Bon pour accord » (ce retour ne vaut pas accord) ;
 *   B. non signé : ni cadre ni phrase, jamais « Non signé » (la règle du
 *      16 août, qui reste vraie).
 *
 * **Sait échouer** : sans `cadreSignature: rapport.signature !== null`, A tombe.
 */

const BASE: RapportPublic = {
  jour: "2026-11-17",
  minutes: 135,
  observations: "La haie côté rue est reprise.",
  clientNom: "Lefèvre",
  clientCivilite: "mme",
  entrepriseNom: "Perret Paysage",
  faites: [
    { famille: "Pelouse", libelle: "Tonte et ébarbage" },
    { famille: "Tailles", libelle: "Taille de haie automne" },
  ],
  signature: null,
};

const SIGNEE: RapportPublic = {
  ...BASE,
  signature: { png: SIGNATURE_ESSAI_PNG, signataire: "Mme Lefèvre", jour: "2026-11-17" },
};

const papier = async (rapport: RapportPublic) =>
  (
    await composerRapportEntretienPdf({
      rapport,
      entrepriseAdresse: null,
      entrepriseSiret: null,
      entrepriseTelephone: null,
      entrepriseEmail: null,
      entrepriseIban: null,
      clientAdresse: null,
      clientTelephone: null,
    })
  ).trace;

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

console.log("=== Le retour d'intervention signé sur place ===\n");

async function main() {
  await essai("A. signé : la signature dans le cadre, qui et le jour dessous", async () => {
    const trace = await papier(SIGNEE);
    assert.equal(trace.cadres.length, 1, "Le cadre de la signature manque.");
    assert.equal(trace.signatures.length, 1, "La signature n'est pas posée.");
    const [s] = trace.signatures;
    const [c] = trace.cadres;
    assert.ok(
      s.x >= c.x && s.y >= c.y && s.x + s.largeur <= c.x + c.largeur && s.y + s.hauteur <= c.y + c.hauteur,
      "La signature déborde du cadre."
    );
    const lu = texte(trace);
    assert.ok(lu.includes("Signée par Mme Lefèvre, sur place, le 17/11/2026."), `La phrase manque : ${lu.slice(-300)}`);
    assert.ok(!lu.includes("Bon pour accord"), "Un retour d'intervention se présente comme un accord.");
  });

  await essai("B. non signé : ni cadre, ni phrase, jamais « Non signé »", async () => {
    const trace = await papier(BASE);
    assert.equal(trace.cadres.length, 0, "Un cadre vide fait passer le rapport pour inachevé.");
    assert.equal(trace.signatures.length, 0);
    const lu = texte(trace);
    assert.ok(!/sign/i.test(lu), `Le rapport non signé parle de signature : ${lu.slice(-300)}`);
  });

  console.log(echecs ? `\n❌ ${echecs} échec(s)` : "\n✅ Le retour signé se lit sur le papier.");
  process.exit(echecs ? 1 : 0);
}

main();
