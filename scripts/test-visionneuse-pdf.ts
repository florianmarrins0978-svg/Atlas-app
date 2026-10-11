import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
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

// ─── CE QUE pdf.js EXIGE DU NAVIGATEUR DU CLIENT ───────────────────────────

cas("pdf.js n'appelle aucune méthode que les téléphones n'ont pas encore", () => {
  // **Ce contrôle vaut un écran blanc chez son client — 13 septembre 2026.**
  // Avec `pdfjs-dist` 6.3, la visionneuse rendait « Le document ne s'ouvre
  // pas » sur le Chromium de l'atelier : à partir de la 5.5, pdf.js appelle
  // `Map.prototype.getOrInsertComputed`, arrivée dans les navigateurs en 2025.
  //
  // Et ce n'est pas l'atelier qui décide : la page publique du devis est
  // ouverte par SES CLIENTS, avec le téléphone qu'ils ont. La version est donc
  // épinglée dans `package.json`, et ce contrôle tient l'épingle — une montée
  // de version qui ramènerait la méthode fait rougir le lot, au lieu de se
  // découvrir chez un client qui ne voit pas son devis.
  const paquet = path.join(__dirname, "..", "node_modules", "pdfjs-dist", "build", "pdf.mjs");
  if (!existsSync(paquet)) {
    // Refuser de conclure plutôt que de rendre un vert sans rien mesurer
    // (`CLAUDE.md` §5, payé le 15 août 2026).
    throw new Error("pdfjs-dist n'est pas installé : ce contrôle ne peut rien mesurer");
  }
  const code = readFileSync(paquet, "utf8");
  for (const recente of ["getOrInsertComputed", "getOrInsert("]) {
    assert.ok(
      !code.includes(recente),
      `pdf.js appelle « ${recente} » : les navigateurs qui ne l'ont pas n'ouvriront AUCUN document`
    );
  }
});

console.log(echecs ? `\n${echecs} échec(s)` : "\nTout est vert.");
process.exit(echecs ? 1 : 0);
