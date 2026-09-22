import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { composerFicheChantierPdf, type FicheChantierPdfData } from "../src/server/pdf/fiche-chantier-pdf";
import { composerFacturePdf, type FacturePdfData } from "../src/server/pdf/facture-pdf";
import { composerDevisPdf } from "../src/server/pdf/devis-pdf";
import type { TraceDocument } from "../src/server/pdf/document-commun";

// La fiche de chantier — le troisième document, demandé le 20 août 2026 :
// « fais en sorte que les fiches chantiers soient au format PDF maintenant ».
//
// **LE CONTRÔLE QUI COMPTE EST CELUI DE LA NON-RÉGRESSION.** La fiche est née
// d'une option posée dans le moteur qui fabrique DÉJÀ le devis et la facture.
// Ces deux-là sont les pièces que le client reçoit, et l'une est ce qu'il paie :
// si un `if` mal placé décalait un total de deux points, personne ne le verrait
// avant que ce soit imprimé. L'empreinte ci-dessous fige leur trace entière —
// chaque texte, sa position au centième de point, sa taille, sa couleur, sa
// page — et refuse le moindre écart.
//
// Les empreintes ont été relevées AVANT la première ligne de `sansChiffrage`.
//
// Le reste vérifie ce qu'une fiche doit dire, et surtout ce qu'elle ne doit
// PAS dire : aucun prix, aucun total, aucune TVA, aucun IBAN, aucun cadre de
// signature. Une fiche qui ressemble à une facture est une fiche qu'on paie
// deux fois.

const echecs: string[] = [];
const dire = (bon: boolean, quoi: string) => {
  console.log(`${bon ? "  ✓" : "  ✗"} ${quoi}`);
  if (!bon) echecs.push(quoi);
};

// ── Les empreintes du dernier relevé ────────────────────────────────────────
//
// **RELEVÉES LE 25 AOÛT 2026**, après sa demande : l'en-tête porte désormais
// toute l'identité de l'entreprise, une ligne par information, et le bloc
// « ÉMETTEUR » du bas a disparu (`ARCHITECTURE.md` §174). Les valeurs d'avant
// décrivaient une mise en page qu'il a fait retirer — les garder aurait rendu
// son devis impossible à changer (`CLAUDE.md` §5 bis).
//
// **Ce qui autorise un nouveau relevé, et rien d'autre :** avoir REGARDÉ le
// document rendu. Celui-ci l'a été, fond clair et fond sombre, logo carré et
// logo en bandeau (`scripts/capture-allure-devis.mts`). Recopier l'empreinte
// affichée sans ouvrir le PDF ne prouverait plus rien du tout.
// **RELEVÉES DE NOUVEAU LE 30 AOÛT 2026**, après sa demande : l'en-tête de la
// colonne de chaque ligne s'appelle « MONTANT HT » et non plus « TOTAL HT »
// (le récapitulatif du bas, lui, garde « Total HT » — les deux se
// ressemblaient assez pour qu'il les confonde en lisant son devis).
//
// **CE QUI A AUTORISÉ CE RELEVÉ, et ce n'est pas un regard à l'œil.** Le
// visualiseur PDF de cet environnement rend une page vide, et il n'y a ni
// `pdftoppm` ni `pdfjs` : une capture aurait mesuré ZÉRO, ce qui est pire
// qu'absent (`CLAUDE.md` §5). La trace des deux documents a donc été relevée
// des DEUX CÔTÉS — sur `origin/main` dans un arbre de travail séparé, et ici —
// puis comparée ligne à ligne. Résultat, sur 917 lignes de trace :
//
//   | ce qui diffère | avant | après |
//   |---|---|---|
//   | le texte de l'en-tête | « TOTAL HT » | « MONTANT HT » |
//   | son abscisse | 523,55 | 509,10 |
//
//   et **rien d'autre**, dans aucun des deux documents. L'étiquette est calée
//   à droite : un mot plus long commence plus à gauche, il ne pousse rien.
//
// Le seul risque d'un en-tête rallongé — cogner la colonne d'à côté — a été
// mesuré : « PRIX UNITAIRE HT » finit à x = 424,28 et « MONTANT HT » commence
// à 509,10, soit 85 points d'écart.
//
// **RELEVÉES DE NOUVEAU LE 14 SEPTEMBRE 2026**, après sa planche
// `appli/le-papier-devis-et-facture.html` — *« PARFAIT ! Code exactement
// cette planche »* : le devis et la facture sortent du même papier, avec les
// colonnes des pros (Désignation · Qté · Unité · P.U. HT · Rem. % · Total HT ·
// TVA % · Total TTC), le taux SUR la ligne et les bases par taux dessous, le
// numéro à droite du titre (`ARCHITECTURE.md` §364). Ce qui a autorisé ce
// relevé : les deux PDF rendus dans la visionneuse de l'application et
// regardés en grand, contre la planche — colonnes, gras et fontes.
//
// **RELEVÉES DE NOUVEAU LE 15 SEPTEMBRE 2026**, après sa capture d'une facture
// sans remise sous une colonne « REM. % » vide : *« si il n'y a pas de remise,
// la case rem % ne doit pas apparaître »*. Ces deux documents n'en ont pas :
// la colonne disparaît et Qté · Unité · P.U. HT se resserrent de 24 points
// vers la droite. Ce qui a autorisé ce relevé : les deux PDF rendus par pdf.js
// dans un navigateur, regardés — sans remise (la colonne absente, le tableau
// serré) et avec une remise de 5 % (la colonne revenue, la mise en page du
// 14 septembre intacte).
//
// **ET LE MÊME JOUR, une seconde fois :** *« que l'u soit mise sur le devis ou
// facture par défaut : si on ne touche à rien, elle se pose, on la voit »*.
// Les trois lignes de ce document n'ont aucune unité : elles s'impriment
// désormais « u » (`unite-de-ligne.ts`). Rendu regardé — « u » sur les deux
// lignes sans unité, « ml » gardé sur celle qui en a une.
//
// **RELEVÉES DE NOUVEAU LE 17 SEPTEMBRE 2026**, après ses trois demandes sur le
// papier : *« toute la ligne désignation jusqu'à total ttc, tu la mets en
// gras »*, *« mets toutes les écritures en noir, rien en gris »*, *« en bas à
// gauche, base ht et les deux autres en gras aussi »*. Ce qui change dans la
// trace : la TEINTE des étiquettes de colonnes, des coordonnées et des
// mentions légales — du gris à l'encre — et rien d'autre : ni abscisse, ni
// texte, ni fonte (`ARCHITECTURE.md` §374).
//
// **CE QUI A AUTORISÉ CE RELEVÉ** : le PDF du devis rendu par pdf.js dans la
// visionneuse de l'application, en grand, et REGARDÉ — en-tête de tableau noir
// et gras d'un bout à l'autre, « BASE HT · TAUX · TVA » de même, coordonnées et
// mentions légales à l'encre, filets du tableau inchangés.
//
// **LE DEVIS SEUL, RELEVÉ DE NOUVEAU LE 22 SEPTEMBRE 2026**, après sa règle :
// *« Je ne veux plus de tiret, je veux des phrases normales, sans tiret en
// plein milieu. »* Le cadre de signature dit désormais « Bon pour accord,
// signature du client ».
//
// **CE QUI A AUTORISÉ CE RELEVÉ** : les deux traces entières, relevées ici et
// sur `HEAD` dans un arbre de travail séparé, puis comparées ligne à ligne.
// Sur 134 lignes, UNE diffère — ce texte-là, et l'abscisse qui suit sa
// longueur, la phrase étant centrée. La facture, elle, ne bouge pas : son
// empreinte est inchangée. C'est la méthode du relevé du 30 août, faute de
// pouvoir ouvrir un PDF à l'œil dans cet environnement (`CLAUDE.md` §5).
const EMPREINTE_FACTURE = "930faf494840c0075cb50da535e3b03e60813fe1409b9947fce0b0541eba9ae6";
const EMPREINTE_DEVIS = "bb47afb09d38ba8f4c982055569dcf404926ca89e2f0ec41cee94ff4716be7a6";

const DOCUMENT: FacturePdfData = {
  numeroCommercial: "F-2026-0004",
  statut: "emise",
  dateEmission: "2026-08-03",
  dateEcheance: "2026-09-02",
  numeroDevis: "2026-0006",
  entrepriseNom: "Eden Nature",
  entrepriseAdresse: "10 rue des Artisans, 78200 Buchelay",
  entrepriseSiret: "123 456 789 00012",
  entrepriseTelephone: "06 79 98 45 14",
  entrepriseEmail: "contact@eden-nature.fr",
  entrepriseIban: "FR76 3123 3123 4500 2348 1091 175",
  clientNom: "M. Bernard",
  clientAdresse: "10 rue des Moutons, 78200 Buchelay",
  clientTelephone: "06 12 34 56 78",
  adresseChantier: "10 rue des Moutons, 78200 Buchelay",
  conditionsPaiement: "Merci de votre confiance.",
  devise: "EUR",
  tauxTva: "10.00",
  totalHt: "2450.00",
  totalTva: "245.00",
  totalTtc: "2695.00",
  lignes: [
    {
      libelle: "Démontage d'un chêne en bordure de rue, avec rétention des charpentières",
      quantite: "1",
      prixUnitaire: "1400.00",
      montant: "1400.00",
    },
    { libelle: "Taille de haie de laurier", quantite: "18", prixUnitaire: "35.00", montant: "630.00" },
    { libelle: "Broyage sur place", quantite: "1", prixUnitaire: "420.00", montant: "420.00" },
  ],
};

/**
 * L'empreinte d'une trace : tout ce qui se voit sur la feuille.
 *
 * Les coordonnées sont arrondies au centième de point — non pour tolérer un
 * écart, mais parce qu'un flottant binaire ne se compare pas à lui-même d'une
 * exécution à l'autre. Un demi-millième de point n'existe sur aucune imprimante.
 */
const empreinte = (t: TraceDocument) =>
  createHash("sha256")
    .update(
      JSON.stringify({
        pages: t.pages,
        textes: t.textes.map((x) => [
          x.contenu,
          Math.round(x.x * 100),
          Math.round(x.y * 100),
          x.taille,
          x.couleur,
          x.page,
        ]),
        traits: t.traits,
        cadres: t.cadres,
        fonds: t.fonds,
      })
    )
    .digest("hex");

const FICHE: FicheChantierPdfData = {
  chantierNom: "Élagage de trois chênes",
  jour: "2026-08-12",
  creneau: "matin",
  demiJournees: 2,
  equipe: "Nord",
  numeroDevis: "2026-0031",
  entrepriseNom: "Eden Nature",
  entrepriseAdresse: "10 rue des Artisans, 78200 Buchelay",
  entrepriseSiret: "123 456 789 00012",
  entrepriseTelephone: "06 79 98 45 14",
  entrepriseEmail: "contact@eden-nature.fr",
  entrepriseIban: "FR76 3123 3123 4500 2348 1091 175",
  clientNom: "M. Martins",
  clientAdresse: "10 rue d'Enfer, 44000 Nantes",
  clientTelephone: "06 79 98 45 14",
  adresseChantier: "10 rue d'Enfer, 44000 Nantes",
  prestations: [
    "Démontage de trois chênes en tête de chat, avec rétention des charpentières",
    "Broyage des branches sur place",
    "Évacuation des gravats",
  ],
  materiel: ["Nacelle 16 m", "Broyeur de branches", "Benne 12 m³"],
  observations: "Le troisième chêne présente un départ de pourriture au collet. À revoir à l'automne.",
  photos: 6,
};

async function main() {
  console.log("=== La fiche de chantier, et ce qu'elle n'a pas cassé ===\n");

  // ── 1. Le devis et la facture n'ont pas bougé d'un centième de point ──────
  const facture = await composerFacturePdf(DOCUMENT);
  const devis = await composerDevisPdf({
    ...DOCUMENT,
    numeroCommercial: "2026-0006",
    statut: "envoye",
  } as never);
  // **L'empreinte lue s'AFFICHE quand elle diverge.** Sans cela, une mise en
  // page changée EXPRÈS — ce qui arrive, le patron en demande — oblige à
  // rouvrir le fichier pour instrumenter le calcul avant de pouvoir relever la
  // nouvelle valeur. Le contrôle garde toute sa force : il refuse toujours
  // l'écart, il dit seulement par quoi le remplacer une fois le nouveau
  // document REGARDÉ.
  const compare = (lue: string, figee: string, quoi: string) => {
    dire(lue === figee, quoi);
    if (lue !== figee) console.log(`      empreinte lue : ${lue}`);
  };
  compare(
    empreinte(facture.trace),
    EMPREINTE_FACTURE,
    "la FACTURE est au pixel ce qu'elle était au dernier relevé",
  );
  compare(
    empreinte(devis.trace),
    EMPREINTE_DEVIS,
    "le DEVIS est au pixel ce qu'il était au dernier relevé",
  );

  // ── 2. Ce que la fiche dit ────────────────────────────────────────────────
  const { trace } = await composerFicheChantierPdf(FICHE);
  const mots = trace.textes.map((t) => t.contenu);
  const tout = mots.join(" • ");

  dire(mots.includes("FICHE DE CHANTIER"), "elle porte son titre");
  dire(/Élagage de trois chênes/.test(tout), "elle nomme le chantier");
  dire(/12\/08\/2026/.test(tout), `elle porte le jour de l'intervention (lu : ${tout.match(/\d\d\/\d\d\/\d{4}/)?.[0] ?? "aucun"})`);
  dire(/Matin · 2 demi-journées · équipe Nord/.test(tout), "elle dit quand on est venu, et avec qui");
  dire(/M\. Martins/.test(tout), "elle nomme le client");
  dire(
    FICHE.prestations.every((p) => tout.includes(p.slice(0, 30))),
    "elle porte les trois prestations, en entier",
  );
  dire(mots.includes("CE QUI A ÉTÉ FAIT"), "la colonne s'appelle « ce qui a été fait », pas « description »");
  dire(mots.includes("MATÉRIEL EMPLOYÉ") && /Nacelle 16 m/.test(tout), "elle liste le matériel");
  dire(mots.includes("OBSERVATIONS") && /pourriture au collet/.test(tout), "elle porte ce qui a été dicté");
  dire(mots.includes("PHOTOS") && /6 photos jointes/.test(tout), "elle dit combien de photos accompagnent le chantier");

  // ── 3. Ce qu'elle ne dit PAS, et c'est ce qui la rend transmissible ───────
  //
  // Un prix imprimé ici, et la fiche ne peut plus être donnée à un locataire, à
  // un syndic ou à l'assurance d'un voisin sans divulguer ce que le
  // propriétaire a payé.
  const INTERDITS: [RegExp, string][] = [
    [/€/, "un montant en euros"],
    [/Total (HT|TTC)/, "une ligne de total"],
    [/\bTVA\b/, "la TVA"],
    [/PRIX UNITAIRE/, "une colonne de prix"],
    [/\bQTÉ\b/, "une colonne de quantité"],
    [/IBAN/, "un IBAN"],
    [/MODALITÉS DE PAIEMENT/, "des modalités de paiement"],
    [/Bon pour accord/, "un cadre de signature"],
  ];
  for (const [motif, quoi] of INTERDITS) {
    dire(!motif.test(tout), `elle ne porte pas ${quoi}`);
  }
  dire(trace.cadres.length === 0, `elle ne porte aucun cadre (${trace.cadres.length} trouvé(s))`);

  // ── 4. Une fiche vide le dit, plutôt que de paraître tronquée ─────────────
  const nue = await composerFicheChantierPdf({
    ...FICHE,
    prestations: [],
    materiel: [],
    observations: null,
    photos: 0,
    jour: null,
    creneau: null,
    demiJournees: null,
    equipe: null,
    numeroDevis: null,
  });
  const motsNus = nue.trace.textes.map((t) => t.contenu).join(" • ");
  dire(
    /Aucune prestation n'a été notée/.test(motsNus),
    "une fiche sans prestation le DIT, au lieu de sembler tronquée",
  );
  // **Rien ne se comble.** Un chantier sans créneau n'est pas « journée entière
  // à partir du matin » : c'est une supposition, et elle s'imprimerait sur un
  // document que le client garde.
  dire(!/Matin|Après-midi|demi-journée|équipe/.test(motsNus), "un créneau absent ne s'invente pas");
  dire(!/\d\d\/\d\d\/\d{4}/.test(motsNus), "une date absente ne devient pas celle du jour");
  dire(!/MATÉRIEL EMPLOYÉ|OBSERVATIONS|PHOTOS/.test(motsNus), "les blocs vides ne laissent pas d'intertitre orphelin");

  // ── 5. Le PDF est un vrai PDF ─────────────────────────────────────────────
  const { pdf } = await composerFicheChantierPdf(FICHE);
  const entete = Buffer.from(pdf.slice(0, 5)).toString("latin1");
  dire(entete === "%PDF-", `le fichier commence par %PDF- (lu : ${JSON.stringify(entete)})`);
  dire(pdf.byteLength > 2000, `le fichier pèse ${pdf.byteLength} octets`);

  console.log(
    echecs.length === 0
      ? "\n✅ La fiche de chantier tient, et n'a rien cassé."
      : `\n❌ ${echecs.length} défaut(s) sur la fiche de chantier.`,
  );
  if (echecs.length > 0) process.exit(1);
  assert.equal(echecs.length, 0);
}

main();
