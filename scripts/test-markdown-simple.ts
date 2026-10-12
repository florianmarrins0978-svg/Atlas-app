// LE MARKDOWN MINIMAL — éprouvé sans navigateur.
//
// La planche `appli/documents-legaux-accepter.html` (11 octobre 2026) : le
// texte d'un document légal se lit en clair, sans dièses ni astérisques. Le
// même lecteur sert les bulles de l'assistant : ce qu'il faisait avant (gras,
// puces, retours à la ligne gardés) doit rester vrai.
import assert from "node:assert/strict";
import { lireMarkdownSimple, type LigneMarkdown } from "../src/lib/markdown-simple";
import { VERSIONS_DOCUMENTS } from "../src/server/documents-legaux/versions";

let echecs = 0;
function essai(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs += 1;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${e instanceof Error ? e.message : String(e)}`);
  }
}

const texte = (ligne: LigneMarkdown) => ligne.map((s) => s.texte).join("");

essai("un titre perd ses dièses et garde son niveau", () => {
  const [bloc] = lireMarkdownSimple("## 1. Qui est qui");
  assert.deepEqual(bloc, { genre: "titre", niveau: 2, ligne: [{ texte: "1. Qui est qui", gras: false }] });
});

essai("le gras perd ses astérisques", () => {
  const [bloc] = lireMarkdownSimple("**Nous sommes sous-traitant.** Nous traitons");
  assert.equal(bloc.genre, "paragraphe");
  if (bloc.genre !== "paragraphe") return;
  assert.deepEqual(bloc.lignes[0], [
    { texte: "Nous sommes sous-traitant.", gras: true },
    { texte: " Nous traitons", gras: false },
  ]);
});

essai("une citation perd ses chevrons, et ses lignes se joignent quand on le demande", () => {
  const [bloc] = lireMarkdownSimple("> **Canevas.** Ce document doit\n> être relu.", { joindreLesLignes: true });
  assert.equal(bloc.genre, "citation");
  if (bloc.genre !== "citation") return;
  assert.equal(bloc.lignes.length, 1);
  assert.equal(texte(bloc.lignes[0]), "Canevas. Ce document doit être relu.");
});

essai("une puce coupée en retrait reste la même puce", () => {
  const [bloc] = lireMarkdownSimple("- **Durée** : celle de votre abonnement, plus les délais\n  prévus au §6.\n- **Nature** : collecte.");
  assert.equal(bloc.genre, "liste");
  if (bloc.genre !== "liste") return;
  assert.equal(bloc.elements.length, 2);
  assert.equal(texte(bloc.elements[0]), "Durée : celle de votre abonnement, plus les délais prévus au §6.");
});

essai("un titre collé à son paragraphe s'en sépare", () => {
  const blocs = lireMarkdownSimple("## Objet\nAtlas aide.");
  assert.deepEqual(blocs.map((b) => b.genre), ["titre", "paragraphe"]);
});

essai("l'assistant garde ses retours à la ligne par défaut", () => {
  const [bloc] = lireMarkdownSimple("Première ligne\nseconde ligne");
  assert.equal(bloc.genre, "paragraphe");
  if (bloc.genre !== "paragraphe") return;
  assert.equal(bloc.lignes.length, 2);
});

essai("les puces « • » des CGU restent des puces", () => {
  const [bloc] = lireMarkdownSimple("• Langue. La version française fait seule foi.");
  assert.equal(bloc.genre, "liste");
});

essai("aucun document légal publié ne laisse passer un dièse, un astérisque double ou un chevron", () => {
  for (const doc of VERSIONS_DOCUMENTS) {
    for (const bloc of lireMarkdownSimple(doc.contenu, { joindreLesLignes: true })) {
      const lignes =
        bloc.genre === "titre" ? [bloc.ligne] : bloc.genre === "liste" ? bloc.elements : bloc.lignes;
      for (const ligne of lignes) {
        const lu = texte(ligne);
        assert.ok(!/^#|\*\*|^>/.test(lu), `${doc.type}@${doc.version} : « ${lu.slice(0, 60)} »`);
      }
    }
  }
});

console.log("");
console.log(`Le markdown minimal — ${echecs} échec(s).`);
process.exit(echecs > 0 ? 1 : 0);
