import assert from "node:assert/strict";
import { LIBELLE_REDUCTION, libelleReduction } from "../src/lib/reduction-devis";
import { LIBELLE_MAIN_DOEUVRE, montantMainDoeuvreValide } from "../src/lib/main-doeuvre-devis";
import {
  TEXTE_ORIGINE_CONDITIONS_GENERALES,
  TITRE_CONDITIONS_GENERALES,
  crochetsRestants,
  paragraphesConditionsGenerales,
} from "../src/lib/conditions-generales";
import { conditionsDepuisEntreprise, lireConditions, normaliserConditions } from "../src/lib/conditions-documents";
import { composerDevisPdf } from "../src/server/pdf/devis-pdf";

/**
 * LA PLANCHE DU 12 SEPTEMBRE 2026, LA B — la règle et le papier, sans base.
 *
 *   · « Prix accordé au client » → « Remise de N % » ;
 *   · « dont main d'œuvre HT » (lecture B) : nommée sous le total HT, jamais
 *     comptée, bornée au brut, facultative ;
 *   · les conditions réglées EN GRAS sous ses notes ;
 *   · ses conditions générales : remplies d'office, effaçables, imprimées après
 *     le bon pour accord sur une page à elles.
 *
 * Le papier est éprouvé par sa TRACE : ce qui est écrit, où, et en quelle
 * graisse — `gras` a été ajouté à la trace pour ce lot, sans quoi « en gras »
 * ne se mesurait pas (`CLAUDE.md` §5).
 */

let echecs = 0;
function cas(nom: string, f: () => void | Promise<void>) {
  return Promise.resolve()
    .then(f)
    .then(() => console.log(`  ✓ ${nom}`))
    .catch((e) => {
      echecs++;
      console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
    });
}

const COMMUN = {
  entrepriseNom: "Eden Nature",
  entrepriseAdresse: "12 chemin des Vignes, Avignon",
  clientNom: "Mme Grospiron",
  devise: "EUR",
  tauxTva: "20.00",
  numeroCommercial: "D2026-000014",
  numeroVersion: 1,
  statut: "brouillon" as const,
  dateEmission: "2026-09-12",
  validiteJours: 30,
  totalHt: "1592.00",
  totalTva: "318.40",
  totalTtc: "1910.40",
  lignes: [
    { libelle: "Terrassement et préparation du sol", quantite: "1", prixUnitaire: "380.00", montant: "380.00" },
    { libelle: "Fourniture de gazon en rouleau", quantite: "120", unite: "m²", prixUnitaire: "6.50", montant: "780.00" },
    { libelle: "Bordures acier corten", quantite: "24", unite: "ml", prixUnitaire: "18.00", montant: "432.00" },
  ],
};

async function composer(extra: Record<string, unknown>, options: Record<string, unknown> = {}) {
  const { trace } = await composerDevisPdf(
    { ...COMMUN, ...extra } as Parameters<typeof composerDevisPdf>[0],
    options as Parameters<typeof composerDevisPdf>[1]
  );
  return trace;
}
const y = (trace: Awaited<ReturnType<typeof composer>>, debut: string, page = 1) => {
  const t = trace.textes.find((x) => x.page === page && x.contenu.startsWith(debut));
  assert.ok(t, `« ${debut} » n'est pas sur la page ${page}`);
  return t.y;
};

async function main() {
  console.log("\n=== « Remise de N % » — son mot du 12 septembre ===\n");

  await cas("le libellé dit « Remise de 5 % », plus « Prix accordé au client »", () => {
    assert.equal(LIBELLE_REDUCTION, "Remise");
    assert.equal(libelleReduction("5"), "Remise de 5 %");
    assert.equal(libelleReduction("7.5"), "Remise de 7,5 %");
    assert.equal(libelleReduction(null), null);
  });

  console.log("\n=== « dont main d'œuvre HT » — la lecture B ===\n");

  await cas("le libellé est celui de la planche : « dont », pas « plus »", () => {
    assert.equal(LIBELLE_MAIN_DOEUVRE, "dont main d’œuvre HT");
  });

  await cas("un montant tapé se garde à deux décimales ; vide, zéro ou illisible valent « pas de ligne »", () => {
    assert.equal(montantMainDoeuvreValide("450", "1592.00"), "450.00");
    assert.equal(montantMainDoeuvreValide("450,5", "1592.00"), "450.50");
    assert.equal(montantMainDoeuvreValide("1 200", "1592.00"), "1200.00");
    assert.equal(montantMainDoeuvreValide("", "1592.00"), null);
    assert.equal(montantMainDoeuvreValide("0", "1592.00"), null);
    assert.equal(montantMainDoeuvreValide("-12", "1592.00"), null);
    assert.equal(montantMainDoeuvreValide("abc", "1592.00"), null);
    assert.equal(montantMainDoeuvreValide(null, "1592.00"), null);
  });

  await cas("« dont » ne dépasse jamais le tout : borné au brut HT", () => {
    assert.equal(montantMainDoeuvreValide("4500", "1592.00"), "1592.00");
  });

  // Sa plainte du 14 septembre 2026 : *« je mets le prix, elle s'efface toute
  // seule »* — sur un devis encore vide. Cette suite exigeait alors `null` sur
  // un brut nul, et c'est ce qu'il a payé : un total de zéro n'est pas un
  // plafond, c'est l'absence de plafond.
  await cas("sans ligne chiffrée, le montant tapé se GARDE — rien à borner encore", () => {
    assert.equal(montantMainDoeuvreValide("450", "0.00"), "450.00");
    assert.equal(montantMainDoeuvreValide("450", 0), "450.00");
  });

  await cas("sur le papier : sous le total HT, au-dessus de la TVA, et les totaux n'ont pas bougé", async () => {
    const trace = await composer({ mainDoeuvreHt: "450.00" });
    const tout = trace.textes.map((t) => t.contenu);
    assert.ok(tout.includes("dont main d’œuvre HT"), "la ligne manque");
    assert.ok(y(trace, "Total HT") > y(trace, "dont main d’œuvre HT"), "elle n'est pas sous le total HT");
    assert.ok(y(trace, "dont main d’œuvre HT") > y(trace, "TVA 20 %"), "elle n'est pas au-dessus de la TVA");
    // Le papier sépare les milliers d'une insécable (U+00A0) : on lit comme lui.
    const sansInsecable = tout.map((t) => t.replace(/ /g, " "));
    assert.ok(sansInsecable.includes("1 592,00 €") && sansInsecable.includes("1 910,40 €"), "un total a bougé");
    assert.equal(sansInsecable.filter((t) => t === "450,00 €").length, 1, "le montant de la main d'œuvre n'est pas écrit une fois");
  });

  await cas("avec une remise, elle se pose sous le PREMIER total HT — le brut —, pas sous le net", async () => {
    const trace = await composer({
      mainDoeuvreHt: "450.00",
      reductionPourcent: "5",
      reductionMontant: "79.60",
      totalHt: "1512.40",
      totalTva: "302.48",
      totalTtc: "1814.88",
    });
    assert.ok(y(trace, "Total HT") > y(trace, "dont main d’œuvre HT"));
    assert.ok(y(trace, "dont main d’œuvre HT") > y(trace, "Remise de 5 %"));
    assert.ok(y(trace, "Remise de 5 %") > y(trace, "Total HT après remise"));
  });

  await cas("sans main d'œuvre, rien : la feuille d'avant sort à l'identique", async () => {
    const trace = await composer({});
    assert.ok(!trace.textes.some((t) => t.contenu.startsWith("dont main")));
  });

  await cas("pas sur la feuille de chantier : pas un prix chez le salarié", async () => {
    const trace = await composer({ mainDoeuvreHt: "450.00" }, { sansChiffrage: true });
    assert.ok(!trace.textes.some((t) => t.contenu.startsWith("dont main")));
  });

  console.log("\n=== Les conditions réglées, en gras sous ses notes ===\n");

  await cas("ses notes en maigre, les conditions réglées en gras — dans cet ordre", async () => {
    const trace = await composer({
      conditionsPaiement: "Accès par le portail de gauche.",
      conditionsReglees: { acomptePourcent: "30", moyensPaiement: "virement, chèque", rappelerPenalites: true, conditionsGenerales: "" },
    });
    const sien = trace.textes.find((t) => t.contenu.startsWith("Accès par le portail"));
    const acompte = trace.textes.find((t) => t.contenu.startsWith("Mode de règlement : 30 %"));
    const moyens = trace.textes.find((t) => t.contenu.startsWith("Moyens de paiement"));
    assert.ok(sien && acompte && moyens, "une des trois lignes manque");
    assert.equal(sien.gras, false, "son texte est passé en gras");
    assert.equal(acompte.gras, true, "l'acompte n'est pas en gras");
    assert.equal(moyens.gras, true, "les moyens de paiement ne sont pas en gras");
    assert.ok(sien.y > acompte.y && acompte.y > moyens.y, "l'ordre n'est pas le sien");
  });

  await cas("le bloc s'ouvre même sans une note de sa main, dès qu'une condition est réglée", async () => {
    const trace = await composer({ conditionsReglees: { acomptePourcent: "30", conditionsGenerales: "" } });
    assert.ok(trace.textes.some((t) => t.contenu === "NOTES / CONDITIONS"));
    assert.ok(trace.textes.some((t) => t.contenu.startsWith("Mode de règlement : 30 %") && t.gras));
  });

  console.log("\n=== Ses conditions générales, après le bon pour accord ===\n");

  await cas("le texte d'origine : onze articles, une adhésion en tête, et deux crochets à lui", () => {
    const paragraphes = paragraphesConditionsGenerales(TEXTE_ORIGINE_CONDITIONS_GENERALES);
    assert.equal(paragraphes.length, 12);
    assert.match(paragraphes[0], /^L’acceptation de nos devis/);
    assert.match(paragraphes[11], /^11\. Médiation/);
    assert.equal(crochetsRestants(TEXTE_ORIGINE_CONDITIONS_GENERALES), 2);
  });

  await cas("ce qui a été LAISSÉ de la photo du menuisier n'y est pas : 1,5 fois, « aucune indemnité », tribunal imposé", () => {
    const t = TEXTE_ORIGINE_CONDITIONS_GENERALES.toLowerCase();
    assert.ok(!t.includes("1,5"), "les pénalités à 1,5 fois sont revenues");
    assert.ok(t.includes("trois fois le taux"), "le taux légal n'est pas le bon");
    assert.ok(!t.includes("aucune indemnité"), "la clause abusive est revenue");
    assert.ok(!t.includes("marennes"), "le tribunal imposé est revenu");
    assert.ok(t.includes("14 jours") && t.includes("médiateur"), "les mentions de la loi manquent");
  });

  await cas("jamais réglé → le texte d'origine ; effacé → vide ; le sien → le sien", () => {
    // Le texte d'origine se pose sur le RÉGLAGE de l'entreprise, jamais sur
    // l'instantané d'un devis : un devis d'avant la migration 0090 n'a pas de
    // texte, et il doit sortir sans CGV — identique à lui-même.
    assert.equal(conditionsDepuisEntreprise({}).conditionsGenerales, TEXTE_ORIGINE_CONDITIONS_GENERALES);
    assert.equal(conditionsDepuisEntreprise({ conditionsGenerales: null }).conditionsGenerales, TEXTE_ORIGINE_CONDITIONS_GENERALES);
    assert.equal(conditionsDepuisEntreprise({ conditionsGenerales: "" }).conditionsGenerales, "");
    assert.equal(lireConditions({}).conditionsGenerales, "");
    assert.equal(lireConditions({ conditionsGenerales: null }).conditionsGenerales, "");
    assert.equal(lireConditions({ conditionsGenerales: "" }).conditionsGenerales, "");
    assert.equal(lireConditions({ conditionsGenerales: "  \n " }).conditionsGenerales, "");
    assert.equal(lireConditions({ conditionsGenerales: "Mes conditions." }).conditionsGenerales, "Mes conditions.");
    // Ce qui part en base garde la chaîne vide : c'est elle qui dit « effacé ».
    assert.equal(normaliserConditions({ conditionsGenerales: "" }).conditionsGenerales, "");
  });

  await cas("sur le papier : une page NEUVE après le bon pour accord, le titre, les articles", async () => {
    const trace = await composer({
      conditionsReglees: { conditionsGenerales: TEXTE_ORIGINE_CONDITIONS_GENERALES },
    });
    assert.equal(trace.pages, 2, `${trace.pages} page(s)`);
    const titre = trace.textes.find((t) => t.contenu === TITRE_CONDITIONS_GENERALES);
    assert.ok(titre && titre.page === 2, "le titre n'ouvre pas la page 2");
    const cadre = trace.cadres[trace.cadres.length - 1];
    assert.equal(cadre.page, 1, "le bon pour accord n'est plus sur la page du devis");
    assert.ok(trace.textes.some((t) => t.page === 2 && t.contenu.startsWith("11. Médiation")), "le dernier article manque");
    assert.ok(trace.textes.some((t) => t.page === 2 && t.contenu.startsWith("Page 2 / 2")), "la pagination ne compte pas l'annexe");
  });

  await cas("effacées : ni page, ni titre — et un devis d'avant la 0064 non plus", async () => {
    assert.equal((await composer({ conditionsReglees: { conditionsGenerales: "" } })).pages, 1);
    assert.equal((await composer({})).pages, 1);
  });

  await cas("pas sur la feuille de chantier : elle ne s'accepte pas", async () => {
    const trace = await composer(
      { conditionsReglees: { conditionsGenerales: TEXTE_ORIGINE_CONDITIONS_GENERALES } },
      { sansChiffrage: true }
    );
    assert.equal(trace.pages, 1);
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} La planche B du devis — ${echecs} échec(s)\n`);
  process.exit(echecs === 0 ? 0 : 1);
}

main();
