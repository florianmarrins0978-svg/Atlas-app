// L'ASSISTANT JOINT LE DOCUMENT QU'IL A TROUVÉ, ET RIEN D'AUTRE.
//
// **Sa demande du 27 octobre 2026 :** *« quand je lui demande d'aller me
// chercher une ligne dans un devis, qu'il me sorte le PDF du devis dans la
// discussion »*, puis *« pareil pour chaque document demandé : la facture, la
// fiche d'inter, le bilan comptable, un ticket de carburant, un ticket resto »*.
// Planche B retenue : la ligne trouvée est elle-même ce qu'on touche.
//
// Ce que ce contrôle tient : une adresse ne vient JAMAIS du modèle. Les outils
// fabriquent la pièce depuis la base, le modèle n'en voit qu'une clé, et seule
// une clé rendue pendant ce tour devient une pièce à l'écran.

import assert from "node:assert/strict";
import {
  creerPiece,
  nouveauRegistre,
  rangerLesPieces,
  piecesCitees,
  pieceDuDevis,
  pieceDeLaFacture,
  pieceDuFournisseur,
  pieceDuVehicule,
} from "../src/lib/pieces-de-l-assistant";
import { fichierDemandeALaVisionneuse } from "../src/lib/visionneuse-pdf";

let passed = 0;
let failed = 0;
function test(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${nom}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

const devis = pieceDuDevis(
  { devisId: "11111111-1111-1111-1111-111111111111", numero: "2026-0009", date: "2026-03-14" },
  { titre: "Coupe de cheveux", montant: "25.00" }
);

test("LE MODÈLE NE VOIT QU'UNE CLÉ, JAMAIS L'ADRESSE", () => {
  const registre = nouveauRegistre();
  const vu = rangerLesPieces({ trouve: true, lignes: [{ libelle: "Coupe de cheveux", piece: devis }] }, registre);
  const texte = JSON.stringify(vu);
  assert.doesNotMatch(texte, /\/api\/|\/documents\//, "une adresse part au modèle");
  assert.match(texte, /"piece":"P1"/);
  assert.equal(registre.size, 1);
});

test("LA PIÈCE D'UN DEVIS S'OUVRE DANS LA VISIONNEUSE, SUR SON PDF", () => {
  assert.match(devis.adresse, /^\/documents\/pdf\?/);
  assert.match(decodeURIComponent(devis.adresse), /fichier=\/api\/devis\/11111111-1111-1111-1111-111111111111\/pdf/);
  assert.equal(devis.titre, "Coupe de cheveux");
  assert.equal(devis.montant, "25.00");
  assert.equal(devis.detail, "Devis 2026-0009, 14 mars 2026");
});

test("SEULE UNE CLÉ RENDUE PENDANT LE TOUR DEVIENT UNE PIÈCE", () => {
  const registre = nouveauRegistre();
  rangerLesPieces({ piece: devis }, registre);
  const { texte, pieces } = piecesCitees("Le voici [[P1]]. Et celui-là [[P7]].", registre);
  assert.equal(pieces.length, 1);
  assert.equal(pieces[0].titre, "Coupe de cheveux");
  assert.equal(texte, "Le voici. Et celui-là.");
});

test("UNE PIÈCE CITÉE DEUX FOIS NE S'AFFICHE QU'UNE FOIS, DANS L'ORDRE DU TEXTE", () => {
  const registre = nouveauRegistre();
  const facture = pieceDeLaFacture({ factureId: "22222222-2222-2222-2222-222222222222", numero: "F-2026-0012", date: "2026-04-02", montant: "250.00" });
  rangerLesPieces([{ piece: devis }, { piece: facture }], registre);
  const { pieces } = piecesCitees("La facture [[P2]], puis le devis [[P1]], encore [[P2]].", registre);
  assert.deepEqual(pieces.map((p) => p.genre), ["facture", "devis"]);
});

test("UN OBJET QUI RESSEMBLE À UNE PIÈCE N'EN EST PAS UNE", () => {
  // Une ligne de base nommée « piece » ou un JSON recopié ne doit pas
  // devenir un lien : seule `creerPiece` fabrique une pièce.
  const registre = nouveauRegistre();
  const imitation = { genre: "devis", adresse: "/api/devis/x/pdf", titre: "x", detail: "x", format: "pdf" };
  const vu = rangerLesPieces({ piece: imitation }, registre);
  assert.equal(registre.size, 0);
  assert.deepEqual(vu, { piece: imitation });
});

test("UNE ADRESSE HORS DE L'APPLICATION EST REFUSÉE À LA FABRICATION", () => {
  assert.throws(() =>
    creerPiece({ genre: "devis", adresse: "https://ailleurs.example/x.pdf", titre: "x", detail: "x", format: "pdf" })
  );
  assert.throws(() => creerPiece({ genre: "devis", adresse: "//ailleurs/x", titre: "x", detail: "x", format: "pdf" }));
});

test("UNE RÉPONSE SANS CLÉ RESTE TELLE QUELLE", () => {
  const registre = nouveauRegistre();
  rangerLesPieces({ piece: devis }, registre);
  const { texte, pieces } = piecesCitees("Rien trouvé.", registre);
  assert.equal(texte, "Rien trouvé.");
  assert.equal(pieces.length, 0);
});

test("UN PDF DE FOURNISSEUR OU DE VÉHICULE PASSE LA VISIONNEUSE, UNE PHOTO N'Y VA PAS", () => {
  const pdf = pieceDuFournisseur({ recuId: "r1", nom: "Facture Point P", societe: "Point P", genre: "facture", nature: "pdf", montant: "120.00", date: "2026-10-01" });
  assert.ok(pdf && fichierDemandeALaVisionneuse(pdf.adresse), "la visionneuse refuserait la facture du fournisseur");
  const photo = pieceDuFournisseur({ recuId: "r2", nom: "x", societe: "Point P", genre: "devis", nature: "photo", montant: null, date: null });
  assert.equal(photo?.adresse, "/reglages/fournisseurs/devis/r2");
  assert.equal(pieceDuFournisseur({ recuId: "r3", nom: "x", societe: "y", genre: "devis", nature: "tableur", montant: null, date: null }), null);
  const carte = pieceDuVehicule({ vehiculeId: "v1", vehicule: "Master", nature: "carte_grise", format: "pdf", date: "2026-01-02" });
  assert.ok(fichierDemandeALaVisionneuse(carte.adresse), "la visionneuse refuserait la carte grise");
  assert.equal(carte.titre, "Carte grise, Master");
});

console.log(`\n${passed} test(s) réussi(s), ${failed} échec(s)`);
if (failed > 0) process.exit(1);
