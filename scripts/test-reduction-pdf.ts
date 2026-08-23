import assert from "node:assert/strict";
import { composerDevisPdf } from "../src/server/pdf/devis-pdf";

// Le prix accordé au client, tel qu'il s'IMPRIME.
//
// **Le PDF est ce que le client reçoit** — pas l'écran. Le patron a choisi
// l'arrangement B le 16 août 2026 : le prix plein, ce qui a été consenti, puis
// le net. Un écran qui montrerait la remise pendant qu'un PDF partirait au prix
// plein serait la pire des deux versions, et c'est le client qui s'en
// apercevrait.
//
// **Cette suite existe surtout à cause d'un défaut qu'elle a trouvé.** La
// première écriture du bloc employait le « moins » typographique (U+2212, « − »).
// Les polices standard du PDF sont encodées en WinAnsi, qui ne le connaît pas :
// `pdf-lib` levait « WinAnsi cannot encode "−" » et **tout le devis cessait de
// se générer**. L'écran, lui, l'affichait très bien — le défaut était donc
// invisible partout ailleurs que dans le fichier envoyé.
//
// On lit la TRACE du document plutôt que les octets : c'est ce que fait déjà
// `test-devis-pdf.ts`, et c'est ce qui permet de dire OÙ un texte se trouve
// plutôt que de se contenter de sa présence.

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

const COMMUN = {
  entrepriseNom: "Atelier Démo",
  entrepriseAdresse: "10 rue des Artisans, Nantes",
  clientNom: "Mme Bracquemont",
  devise: "EUR",
  tauxTva: "20.00",
  numeroCommercial: "2026-0011",
  numeroVersion: 1,
  statut: "envoye" as const,
  dateEmission: "2026-08-16",
  validiteJours: 30,
  lignes: [
    { libelle: "Élagage — 3 chênes", quantite: "1", prixUnitaire: "450.00", montant: "450.00" },
    { libelle: "Broyage des branches", quantite: "1", prixUnitaire: "180.00", montant: "180.00" },
    { libelle: "Évacuation des déchets verts", quantite: "1", prixUnitaire: "240.00", montant: "240.00" },
  ],
};

/** Les textes du document, dans l'ordre où on les lit — de haut en bas. */
async function composer(extra: Record<string, unknown>) {
  const { trace } = await composerDevisPdf({ ...COMMUN, ...extra } as Parameters<typeof composerDevisPdf>[0]);
  const textes = trace.textes
    .slice()
    .sort((a, b) => b.y - a.y)
    .map((t) => ({ contenu: t.contenu, y: t.y, x: t.x }));
  return { textes, tout: textes.map((t) => t.contenu).join("\n") };
}

async function main() {
  console.log("=== Le prix accordé au client, tel qu'il s'imprime ===\n");

  await essai("un devis SANS remise s'imprime exactement comme avant", async () => {
    const { tout } = await composer({ totalHt: "870.00", totalTva: "174.00", totalTtc: "1044.00" });
    assert.ok(tout.includes("Total HT"), "le total HT a disparu");
    assert.ok(tout.includes("Total TTC"), "le total TTC a disparu");
    // Les milliers de devis déjà émis ne doivent pas gagner une ligne.
    assert.ok(!tout.includes("Prix accordé"), "une remise s'imprime alors qu'il n'y en a aucune");
    assert.ok(!tout.includes("après remise"), "« après remise » s'imprime sans remise");
  });

  await essai("le bloc s'imprime, et se lit dans le bon ordre", async () => {
    const { textes, tout } = await composer({
      totalHt: "739.50",
      totalTva: "147.90",
      totalTtc: "887.40",
      reductionPourcent: "15.00",
      reductionMontant: "130.50",
    });
    assert.ok(tout.includes("Prix accordé au client 15 %"), `phrase absente :\n${tout}`);
    assert.ok(tout.includes("Total HT après remise"), "le net n'est pas nommé");

    // **L'ordre, mesuré en pixels** : le prix plein AU-DESSUS de la remise, la
    // remise au-dessus du net. C'est ce qui permet au client de refaire le
    // calcul, et c'est précisément ce qu'il a choisi.
    const y = (quoi: string) => {
      const t = textes.find((t) => t.contenu === quoi);
      assert.ok(t, `« ${quoi} » ne s'imprime nulle part`);
      return t!.y;
    };
    assert.ok(
      y("Total HT") > y("Prix accordé au client 15 %"),
      "le prix plein doit être AU-DESSUS de la remise"
    );
    assert.ok(
      y("Prix accordé au client 15 %") > y("Total HT après remise"),
      "la remise doit être AU-DESSUS du net"
    );
    assert.ok(y("Total HT après remise") > y("Total TTC"), "le net doit être au-dessus du TTC");
  });

  await essai("les trois montants sont là, et le retiré est en négatif", async () => {
    const { tout } = await composer({
      totalHt: "739.50",
      totalTva: "147.90",
      totalTtc: "887.40",
      reductionPourcent: "15.00",
      reductionMontant: "130.50",
    });
    assert.ok(/870,00/.test(tout), "le prix plein ne s'imprime pas — le client ne peut pas refaire le calcul");
    assert.ok(/-\s?130,50/.test(tout), `le montant retiré ne s'imprime pas en négatif :\n${tout}`);
    assert.ok(/739,50/.test(tout), "le net ne s'imprime pas");
    assert.ok(/887,40/.test(tout), "le TTC ne s'imprime pas");
    // La TVA du prix plein serait 174,00 € : une déclaration fausse.
    assert.ok(!/174,00/.test(tout), "la TVA du prix plein s'imprime : le document est faux");
  });

  await essai("aucun caractère que la police du PDF ne sait écrire", async () => {
    // **Le défaut qui a motivé cette suite.** Le « moins » typographique
    // (U+2212) fait lever `pdf-lib` : plus aucun devis ne se génère. Un simple
    // trait d'union s'imprime partout.
    const { tout } = await composer({
      totalHt: "739.50",
      totalTva: "147.90",
      totalTtc: "887.40",
      reductionPourcent: "15.00",
      reductionMontant: "130.50",
    });
    // On vise le coupable NOMMÉMENT plutôt que de balayer tout ce qui dépasse
    // 0xFF : « € », « — » et « ’ » sont hors ASCII et parfaitement écrits par
    // WinAnsi. Un balayage large rendait rouge un document sain — un contrôle
    // qui accuse à tort coûte plus cher que pas de contrôle du tout.
    assert.ok(
      !tout.includes("\u2212"),
      "le « moins » typographique (U+2212) est revenu : pdf-lib lèvera « WinAnsi cannot encode », et plus AUCUN devis ne se générera"
    );
    // Et la preuve par le fait : ce document-ci s'est composé sans lever.
    assert.ok(tout.length > 0, "le document est vide : la composition a échoué en silence");
  });

  await essai("100 % offert s'imprime sans rien casser", async () => {
    const { tout } = await composer({
      totalHt: "0.00",
      totalTva: "0.00",
      totalTtc: "0.00",
      reductionPourcent: "100.00",
      reductionMontant: "870.00",
    });
    assert.ok(tout.includes("Prix accordé au client 100 %"));
    assert.ok(/0,00/.test(tout), "un chantier offert doit afficher zéro, pas un blanc");
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main();
