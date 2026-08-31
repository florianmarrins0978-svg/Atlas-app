import assert from "node:assert/strict";
import { composerDevisPdf, type DevisPdfData } from "../src/server/pdf/devis-pdf";
import { ouvrirPdfProtege, texteDuPdf } from "./_lecteur-pdf-protege";

/**
 * UN DEVIS PROTÉGÉ DOIT QUAND MÊME S'OUVRIR — ET C'EST TOUT L'ENJEU.
 *
 * Depuis le 31 août 2026, le devis part chiffré pour qu'Acrobat n'y laisse plus
 * retoucher un montant. Le danger est l'inverse du défaut corrigé, et il est
 * pire : un fichier mal chiffré ne s'ouvre **nulle part**, et le client ne voit
 * plus son devis du tout.
 *
 * **Le lecteur employé ici ne sait rien d'Atlas** : il refait le chemin de la
 * norme (`_lecteur-pdf-protege.ts`) sans rien importer de la protection. Si
 * celle-ci dérivait mal sa clé ou oubliait le sel de l'AES, rien ne se lirait.
 *
 * **Ce contrôle a d'abord été écrit avec un vrai navigateur, et il a rougi en
 * CI.** Playwright y installe le « headless shell » de Chromium, qui n'embarque
 * aucun lecteur PDF : il TÉLÉCHARGE le fichier au lieu de le peindre, et
 * l'erreur — « Download is starting » — accusait le devis alors qu'il allait
 * bien. Les vrais moteurs ont quand même dit leur mot le même jour, à la main :
 * `qpdf` a lu les autorisations une par une, et le lecteur PDF du Chromium
 * complet a peint le document (`ARCHITECTURE.md` §223).
 */

const DEVIS: DevisPdfData = {
  numeroCommercial: "2026-000008",
  numeroVersion: 1,
  statut: "envoye",
  dateEmission: "2026-08-31",
  validiteJours: 30,
  entrepriseNom: "Atlas",
  entrepriseAdresse: "10 rue des Artisans, 78200 Buchelay",
  clientNom: "Huguette Groupiron",
  clientCivilite: "mme",
  adresseChantier: "Rue du Tourigou 29950 Bénodet",
  devise: "EUR",
  tauxTva: "20.00",
  totalHt: "550.00",
  totalTva: "110.00",
  totalTtc: "660.00",
  lignes: [
    { libelle: "Taille de haies 40 ml", quantite: "1", prixUnitaire: "200.00", montant: "200.00" },
    { libelle: "Taille des graminées", quantite: "1", prixUnitaire: "200.00", montant: "200.00" },
    { libelle: "Menus travaux", quantite: "1", prixUnitaire: "150.00", montant: "150.00" },
  ],
};

/** Le même fichier, dont un seul chiffre de la clé d'ouverture est faux. */
function clefFaussee(octets: Uint8Array): Uint8Array {
  const copie = Buffer.from(octets);
  const debut = copie.indexOf("/U <");
  assert.ok(debut > 0, "aucune clé /U dans le devis : la protection n'est pas posée");
  const chiffre = debut + 4;
  copie[chiffre] = copie[chiffre] === 0x30 /* « 0 » */ ? 0x31 : 0x30;
  return new Uint8Array(copie);
}

let reussis = 0;
let echecs = 0;
async function essai(nom: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
    reussis++;
  } catch (err) {
    console.error(`  ✗ ${nom}`);
    console.error(`    ${err instanceof Error ? err.message : err}`);
    echecs++;
  }
}

async function main() {
  console.log("=== Un devis protégé s'ouvre quand même ===\n");
  const { pdf } = await composerDevisPdf(DEVIS);

  await essai("il s'ouvre sans qu'on tape le moindre mot de passe", () => {
    const lu = ouvrirPdfProtege(pdf);
    assert.equal(lu.ouvrableSansMotDePasse, true, "le lecteur réclamerait un mot de passe");
  });

  await essai("et son contenu s'y lit, mot pour mot", () => {
    const texte = texteDuPdf(pdf);
    for (const attendu of ["Huguette Groupiron", "Taille de haies 40 ml", "660,00"]) {
      assert.ok(
        texte.includes(attendu),
        `« ${attendu} » ne se lit pas dans le devis déchiffré — le client ne verrait rien`
      );
    }
  });

  await essai("un seul chiffre faussé dans la clé, et le lecteur refuse", () => {
    // **Le plancher de la mesure.** Sans lui, un lecteur qui rendrait « vrai »
    // quoi qu'on lui donne passerait les deux contrôles ci-dessus sans rien
    // prouver (`CLAUDE.md` §5, un contrôle qui mesure zéro).
    const lu = ouvrirPdfProtege(clefFaussee(pdf));
    assert.equal(lu.ouvrableSansMotDePasse, false, "le lecteur ouvre un document dont la clé est fausse");
    assert.equal(texteDuPdf(clefFaussee(pdf)), "", "il en lit le texte malgré une clé fausse");
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} ${reussis} contrôle(s) passé(s), ${echecs} échec(s).`);
  if (echecs > 0) process.exit(1);
}

main();
