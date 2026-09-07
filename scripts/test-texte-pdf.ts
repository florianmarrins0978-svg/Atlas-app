import assert from "node:assert/strict";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { pourLePapier, texteDuPapier } from "../src/lib/texte-pdf";
import { composerDevisPdf, type DevisPdfData } from "../src/server/pdf/devis-pdf";

/**
 * AUCUN CARACTÈRE NE DOIT PLUS EMPÊCHER UN DEVIS DE PARTIR.
 *
 * ─── Ce qu'il a vu, le 7 septembre 2026 ────────────────────────────────────
 *
 * Sous le bouton « Envoyer le devis », en rouge :
 *
 *     WinAnsi cannot encode "⌀" (0x2300)
 *
 * Le devis était juste, la date choisie. Il ne partait pas — à cause du signe
 * de diamètre que le produit écrit lui-même, et qu'il venait de valider.
 *
 * ─── Pourquoi cette suite entre par la PORTE DU PATRON ─────────────────────
 *
 * `CLAUDE.md` §5 quater : un contrôle qui construit son texte à la main
 * n'éprouve que la moitié qu'on vient d'écrire. Le dernier cas compose donc un
 * VRAI devis, avec un libellé tel que `questions-chiffrage.ts` le produit —
 * c'est le chemin qu'il emprunte, lui, et c'est celui qui était fermé.
 *
 * ─── Et elle sait échouer ──────────────────────────────────────────────────
 *
 * Le premier cas confronte `pdf-lib` au caractère BRUT et exige son refus. Si
 * un jour WinAnsi l'acceptait, ce cas rougirait et dirait que le garde-fou n'a
 * plus de raison d'être — plutôt que de le laisser dormir pour toujours.
 */

const cas = (nom: string, f: () => void | Promise<void>) => essais.push([nom, f]);
const essais: [string, () => void | Promise<void>][] = [];

const DIAMETRE = "\u2300"; // ⌀ — celui du produit
const O_BARRE = "\u00d8"; // Ø — celui que le papier sait écrire

cas("le mur existe bien : pdf-lib REFUSE le signe brut", async () => {
  const doc = await PDFDocument.create();
  const page = doc.addPage();
  const police = await doc.embedFont(StandardFonts.Helvetica);

  assert.throws(
    () => page.drawText(`${DIAMETRE} 80 cm`, { x: 40, y: 700, size: 10, font: police }),
    /WinAnsi cannot encode/,
    "si ce refus disparaissait, tout ce fichier serait devenu inutile — et il faudrait le dire"
  );

  // **Mesurer échoue autant qu'écrire**, et c'est ce qui obligeait à assainir
  // avant les calculs de retrait, pas seulement au moment de poser l'encre.
  assert.throws(
    () => police.widthOfTextAtSize(`${DIAMETRE} 80 cm`, 10),
    /WinAnsi cannot encode/
  );
});

cas("assaini, le même texte passe — et garde son rond barré", async () => {
  const doc = await PDFDocument.create();
  const page = doc.addPage();
  const police = await doc.embedFont(StandardFonts.Helvetica);

  const propre = texteDuPapier(`${DIAMETRE} 80 cm`);
  assert.equal(propre, `${O_BARRE} 80 cm`, "le signe doit rester un rond barré, pas devenir un mot");
  page.drawText(propre, { x: 40, y: 700, size: 10, font: police });
  police.widthOfTextAtSize(propre, 10);
});

cas("les deux caractères déjà payés ne peuvent plus revenir", () => {
  // U+202F, l'espace fine des montants ; U+2212, le moins de la remise.
  assert.equal(texteDuPapier("1\u202f400,00\u00a0\u20ac"), "1\u00a0400,00\u00a0\u20ac");
  assert.equal(texteDuPapier("\u2212 120,00"), "- 120,00");
});

cas("ce que WinAnsi sait déjà écrire ne bouge pas d'un cheveu", () => {
  const intact = "Mme Éléonore Chäteauneuf — 3 allée des Œillets · 78 % · 12 m² · « oui »";
  assert.equal(texteDuPapier(intact), intact);
});

cas("un caractère inconnu ne bloque plus — il est retiré, et il se dit", () => {
  const { texte, retraits } = pourLePapier("Devis pour 佐藤 \u{1f600}");
  assert.equal(texte, "Devis pour  ", "ce qui reste doit rester lisible");
  assert.deepEqual(
    retraits.map((r) => r.pointDeCode),
    ["U+4F50", "U+85E4", "U+1F600"],
    "chaque retrait se consigne : un mot amputé en silence ne s'apprendrait jamais"
  );
});

cas("un accent que la police ignore perd son signe, jamais sa lettre", () => {
  // « ā » n'est pas dans WinAnsi ; « é » y est, et ne doit pas être touché.
  assert.equal(texteDuPapier("Bālā, été"), "Bala, été");
});

cas("la même chaîne deux fois de suite ne s'abîme pas", () => {
  const une = texteDuPapier(`${DIAMETRE} 80 cm — 1\u202f400,00 \u20ac`);
  assert.equal(texteDuPapier(une), une, "les fonctions du moteur PDF s'appellent entre elles");
});

cas("le saut de ligne survit : c'est lui qui découpe les paragraphes", () => {
  assert.equal(texteDuPapier("une ligne\nune autre"), "une ligne\nune autre");
});

// ─────────────────────────────────────────────────────────────────────────
// SON DEVIS, EN ENTIER
// ─────────────────────────────────────────────────────────────────────────

const SON_DEVIS: DevisPdfData = {
  numeroCommercial: "2026-0031",
  numeroVersion: 1,
  statut: "brouillon",
  dateEmission: "2026-09-07",
  validiteJours: 30,
  entrepriseNom: "Eden Nature",
  entrepriseAdresse: "10 rue des Artisans, 78200 Buchelay",
  entrepriseSiret: "123 456 789 00012",
  entrepriseTelephone: "06 79 98 45 14",
  entrepriseEmail: "contact@eden-nature.fr",
  entrepriseIban: null,
  clientNom: "Mr. Ludovic",
  clientAdresse: "10 Rue de Nantes 77400 Lagny-sur-Marne",
  clientTelephone: "0679984514",
  adresseChantier: "10 Rue de Nantes 77400 Lagny-sur-Marne",
  conditionsPaiement: null,
  devise: "EUR",
  tauxTva: "20.00",
  totalHt: "1100.00",
  totalTva: "220.00",
  totalTtc: "1320.00",
  lignes: [
    { libelle: "Rabattage de haie de laurier", quantite: "50", prixUnitaire: "15.00", montant: "750.00" },
    // Le libellé exact que `precisionLisible` produit, ⌀ compris.
    {
      libelle: `Démontage d'un chêne mort — 20 m de haut, ${DIAMETRE} 80 cm`,
      quantite: "1",
      prixUnitaire: "350.00",
      montant: "350.00",
    },
  ],
} as unknown as DevisPdfData;

cas("SON devis du 7 septembre se compose, ⌀ compris", async () => {
  const { pdf, trace } = await composerDevisPdf(SON_DEVIS);
  assert.ok(pdf.length > 1000, "un PDF vide n'est pas un PDF composé");

  // **Le signe est bien SUR le papier**, pas seulement absent des erreurs. Un
  // assainissement qui aurait effacé la mesure passerait le test précédent :
  // le devis se composerait, et le client lirait un tronc sans diamètre.
  const surLeDevis = trace.textes.map((t) => t.contenu).join(" | ");
  assert.ok(
    surLeDevis.includes(`${O_BARRE} 80 cm`),
    "le diamètre doit se lire sur le devis, en rond barré"
  );
  assert.ok(
    !surLeDevis.includes(DIAMETRE),
    "aucun caractère refusé par WinAnsi ne doit rester dans la trace"
  );
});

(async () => {
  let echecs = 0;
  for (const [nom, f] of essais) {
    try {
      await f();
      console.log(`  \u2713 ${nom}`);
    } catch (e) {
      echecs++;
      console.log(`  \u2717 ${nom}\n    ${(e as Error).message}\n`);
    }
  }
  console.log(echecs === 0 ? "\n\u2705 Toutes les vérifications passent." : `\n\u274c ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
})();
