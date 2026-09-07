/**
 * REGARDER un devis dans chaque typographie — parce qu'aucun test ne le voit.
 *
 * Le défaut du 24 août 2026 — EB Garamond qui n'imprimait presque rien — n'a
 * levé aucune erreur et n'a fait rougir aucune suite. Il s'est vu à l'image, et
 * c'est la cinquième fois dans ce dépôt (`CLAUDE.md` §5).
 *
 *     npx tsx scripts/capture-allure-devis.mts /tmp/captures
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import path from "node:path";
import { chromium } from "playwright";
import { composerDevisPdf, type DevisPdfData } from "../src/server/pdf/devis-pdf";
import { TYPOGRAPHIES, ALLURE_PAR_DEFAUT } from "../src/lib/allure-documents";

const SORTIE = process.argv[2] ?? "/tmp/captures";
mkdirSync(SORTIE, { recursive: true });

const DEVIS: DevisPdfData = {
  numeroCommercial: "2026-0006",
  numeroVersion: 1,
  statut: "envoye",
  dateEmission: "2026-08-03",
  // **La validité est portée par le DEVIS depuis la migration 0040**, elle
  // n'est plus une constante du composeur (`ARCHITECTURE.md` §102). Trente
  // jours : ce que la constante écrivait, et ce que le rattrapage a posé sur
  // les devis existants. Absente, aucune ligne « Validité » ne s'imprime — un
  // artisan peut l'avoir retirée, et une ligne « Validité : — » ferait croire à
  // une donnée perdue.
  validiteJours: 30,
  entrepriseNom: "Eden Nature",
  entrepriseAdresse: "10 rue des Artisans, 78200 Buchelay",
  entrepriseSiret: "123 456 789 00012",
  entrepriseTelephone: "06 79 98 45 14",
  entrepriseEmail: "contact@eden-nature.fr",
  entrepriseIban: "FR76 3123 3123 4500 2348 1091 175",
  clientNom: "Mme Éléonore Chäteauneuf",
  clientAdresse: "10 rue des Moutons, 78200 Buchelay",
  clientTelephone: "06 12 34 56 78",
  adresseChantier: "10 rue des Moutons, 78200 Buchelay",
  conditionsPaiement:
    "Acompte de 30 % à la signature, solde à réception des travaux. Devis gratuit et sans engagement.",
  devise: "EUR",
  tauxTva: "10.00",
  totalHt: "2450.00",
  totalTva: "245.00",
  totalTtc: "2695.00",
  lignes: [
    {
      libelle:
        "Démontage d'un chêne en bordure de rue, avec rétention des charpentières au-dessus du portail",
      quantite: "1",
      prixUnitaire: "1400.00",
      montant: "1400.00",
    },
    { libelle: "Taille de haie — 42 ml, façade et retour « côté rue »", quantite: "18", prixUnitaire: "35.00", montant: "630.00" },
    {
      libelle: "Broyage sur place et bois coupé en 50 cm laissé au client",
      quantite: "1",
      prixUnitaire: "420.00",
      montant: "420.00",
    },
  ],
};

const nav = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const page = await nav.newPage({ viewport: { width: 900, height: 1180 } });

/** Un logo d'essai en bandeau — c'est le cas qui déborde sur les références. */
function logoDEssai(largeur: number, hauteur: number): { octets: Uint8Array; mime: string } {
  const morceau = (nom: string, corps: Buffer) => {
    const e = Buffer.alloc(8);
    e.writeUInt32BE(corps.length, 0);
    e.write(nom, 4, "ascii");
    let c = 0xffffffff;
    for (const o of Buffer.concat([Buffer.from(nom, "ascii"), corps])) {
      c ^= o;
      for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
    }
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE((c ^ 0xffffffff) >>> 0, 0);
    return Buffer.concat([e, corps, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largeur, 0);
  ihdr.writeUInt32BE(hauteur, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const brut = Buffer.concat(
    Array.from({ length: hauteur }, (_, y) =>
      Buffer.concat([
        Buffer.from([0]),
        Buffer.from(
          Array.from({ length: largeur * 3 }, (_, i) => {
            const bord = y < 2 || y > hauteur - 3 || i < 6 || i > largeur * 3 - 7;
            return bord ? 40 : i % 3 === 1 ? 120 : 60;
          })
        ),
      ])
    )
  );
  return {
    octets: Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      morceau("IHDR", ihdr),
      morceau("IDAT", deflateSync(brut)),
      morceau("IEND", Buffer.alloc(0)),
    ]),
    mime: "image/png",
  };
}

const CAS: [string, Parameters<typeof composerDevisPdf>[1]][] = [
  ["habille", { allure: { typographie: "playfair", fond: "#1c2b1c", accent: "#d8c48a" }, logo: logoDEssai(240, 60) }],
  ["logo-carre", { logo: logoDEssai(120, 120) }],
  ["logo-bandeau", { logo: logoDEssai(900, 90) }],
];
for (const [nom, options] of CAS) {
  const { pdf } = await composerDevisPdf(DEVIS, options);
  const chemin = path.join(SORTIE, `devis-${nom}.pdf`);
  writeFileSync(chemin, pdf);
  await page.goto("file://" + chemin);
  // **Quatre secondes, et non une et demie.** Le 31 août 2026, le cas le plus
  // lourd — police sur mesure, logo, fond sombre — sortait une capture VIDE :
  // le lecteur n'avait pas fini de peindre. Une capture vide se lit comme un
  // document cassé, et fait chercher un défaut qui n'existe pas.
  await page.waitForTimeout(4000);
  await page.screenshot({ path: path.join(SORTIE, `devis-${nom}.png`) });
  console.log(`${nom.padEnd(22)} ${String(Math.round(pdf.length / 1024)).padStart(4)} ko`);
}

for (const typo of TYPOGRAPHIES) {
  const { pdf } = await composerDevisPdf(DEVIS, {
    allure: { ...ALLURE_PAR_DEFAUT, typographie: typo.clef },
  });
  const chemin = path.join(SORTIE, `devis-${typo.clef}.pdf`);
  writeFileSync(chemin, pdf);
  await page.goto("file://" + chemin);
  await page.waitForTimeout(4000);
  await page.screenshot({ path: path.join(SORTIE, `devis-${typo.clef}.png`) });
  console.log(`${typo.nom.padEnd(22)} ${String(Math.round(pdf.length / 1024)).padStart(4)} ko`);
}
await nav.close();
console.log(`\nCaptures dans ${SORTIE}`);
