import assert from "node:assert/strict";
import {
  CHEMIN_VISIONNEUSE,
  adresseDeLaVisionneuse,
  fichierAccepteParLaVisionneuse,
  fichierDemandeALaVisionneuse,
} from "../src/lib/visionneuse-pdf";

// **« Quand j'ouvre le pdf pour voir la facture j'ai pas de touche retour. »**
//
// Sa capture du 11 septembre 2026. Le PDF se peint désormais dans un écran de
// l'application (`/documents/pdf`), et cette suite tient ce que cet écran
// accepte de peindre : une adresse de CE site qui sert un PDF, rien d'autre.
// Le paramètre arrive de l'adresse, donc de n'importe qui — une adresse
// étrangère y ferait charger un document d'ailleurs sous l'en-tête d'Atlas.

let echecs = 0;
function cas(nom: string, verifier: () => void) {
  try {
    verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

console.log("=== La visionneuse de PDF ===\n");

const FACTURE = "/api/factures/1de975a7-7f2c-43c3-98e6-63de23c61f8f/pdf";

cas("l'adresse d'un écran porte le fichier et le titre, et se relit", () => {
  const adresse = adresseDeLaVisionneuse(FACTURE, { surtitre: "Facture", titre: "F2026-000007" });
  assert.ok(adresse.startsWith(`${CHEMIN_VISIONNEUSE}?`));
  assert.equal(fichierDemandeALaVisionneuse(adresse), FACTURE);
  const params = new URLSearchParams(adresse.split("?")[1]);
  assert.equal(params.get("de"), "Facture");
  assert.equal(params.get("titre"), "F2026-000007");
});

cas("les routes PDF du dépôt passent — devis, facture, fiche, feuille, lien public", () => {
  for (const f of [
    "/api/devis/x/pdf",
    FACTURE,
    "/api/chantiers/x/fiche/pdf",
    "/api/chantiers/x/feuille/pdf",
    "/devis/jeton/pdf",
    "/factures/jeton/pdf",
  ]) {
    assert.equal(fichierAccepteParLaVisionneuse(f), f);
  }
});

cas("une adresse étrangère est refusée — absolue ou protocolaire", () => {
  assert.equal(fichierAccepteParLaVisionneuse("https://ailleurs.example/x/pdf"), null);
  assert.equal(fichierAccepteParLaVisionneuse("//ailleurs.example/x/pdf"), null);
});

cas("une page qui n'est pas un PDF est refusée : pdf.js rougirait sans dire pourquoi", () => {
  assert.equal(fichierAccepteParLaVisionneuse("/chantiers/x/facture"), null);
  assert.equal(fichierAccepteParLaVisionneuse("/api/factures/x/pdf.html"), null);
});

cas("un retour arrière dans le chemin est refusé", () => {
  assert.equal(fichierAccepteParLaVisionneuse("/api/../factures/x/pdf"), null);
});

cas("rien, ou vide, ne se peint", () => {
  assert.equal(fichierAccepteParLaVisionneuse(undefined), null);
  assert.equal(fichierAccepteParLaVisionneuse(""), null);
});

cas("une adresse qui n'est pas celle de la visionneuse ne se relit pas", () => {
  assert.equal(fichierDemandeALaVisionneuse(FACTURE), null);
  assert.equal(fichierDemandeALaVisionneuse(`${CHEMIN_VISIONNEUSE}?titre=x`), null);
});

console.log(echecs ? `\n${echecs} échec(s)` : "\nTout est vert.");
process.exit(echecs ? 1 : 0);
