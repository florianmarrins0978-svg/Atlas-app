import assert from "node:assert";
import { decrireEtatIA, auMoinsUnEnDefaut } from "../src/lib/etat-ia";

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

const transcription = (t: string, l = "dev") => decrireEtatIA(t, l)[0];
const redaction = (l: string, t = "dev") => decrireEtatIA(t, l)[1];

function main() {
  test("Le mode par défaut se nomme, et dit que rien ne part", () => {
    const e = transcription("dev");
    assert.equal(e.nature, "simule");
    assert.match(e.libelle, /aucun prestataire/i);
    assert.match(e.explication, /Rien ne part chez personne/);
  });

  // Défaut vu sur une capture, invisible pour les tests d'alors : les deux
  // rôles servaient la même phrase, et la carte « Rédaction » annonçait donc
  // des transcriptions simulées, ce qui n'est pas son sujet.
  test("En mode déterministe, chaque rôle explique CE QU'IL fait, pas celui de l'autre", () => {
    const [t, r] = decrireEtatIA("dev", "dev");
    assert.match(t.explication, /Transcription simulée/);
    assert.doesNotMatch(r.explication, /[Tt]ranscription/);
    assert.match(r.explication, /modèle de langage/);
    assert.notEqual(t.explication, r.explication);
  });

  test("Une variable vide vaut le mode déterministe, pas une erreur", () => {
    assert.equal(transcription("").nature, "simule");
  });

  // Le défaut que cet écran existe pour rendre visible : les fabriques
  // retombent sur `dev` par leur `default:`, donc une faute de frappe donnait
  // exactement le même comportement qu'une absence de configuration.
  test("Un nom mal orthographié est signalé COMME TEL, pas confondu avec le défaut", () => {
    const e = redaction("antropic");
    assert.equal(e.nature, "simule");
    assert.match(e.libelle, /antropic/);
    assert.match(e.libelle, /n'est pas reconnu/);
    assert.match(e.explication, /anthropic/); // propose l'orthographe juste
    assert.doesNotMatch(e.libelle, /aucun prestataire/i); // ≠ du cas « dev »
  });

  test("Un fournisseur écrit et complet s'affiche par son nom, et annonce ce qui part", () => {
    const e = redaction("anthropic");
    assert.equal(e.nature, "reel");
    assert.equal(e.libelle, "Anthropic (Claude)");
    assert.match(e.explication, /sous-traitant/);
  });

  test("La transcription réelle nomme OpenAI et parle de l'audio", () => {
    const e = transcription("openai");
    assert.equal(e.nature, "reel");
    assert.match(e.libelle, /Whisper/);
    assert.match(e.explication, /audio/i);
  });

  // Sans ça, choisir Deepgram donnait un écran rassurant et une panne à chaque
  // dictée — c'est le piège décrit dans docs/TRANSCRIPTION.md.
  test("Un fournisseur reconnu mais non raccordé le dit, plutôt que de rassurer à tort", () => {
    for (const nom of ["deepgram", "google"]) {
      const e = transcription(nom);
      assert.equal(e.nature, "non_raccorde", nom);
      assert.match(e.libelle, /non écrit/, nom);
      assert.match(e.explication, /échouera/, nom);
    }
    for (const nom of ["openai", "gemini"]) {
      assert.equal(redaction(nom).nature, "non_raccorde", nom);
    }
  });

  test("La casse et les espaces ne changent rien", () => {
    assert.equal(redaction("  Anthropic ").nature, "reel");
    assert.equal(transcription("DEV").nature, "simule");
  });

  test("Les deux rôles sont décrits, dans l'ordre, sans se mélanger", () => {
    const etats = decrireEtatIA("openai", "anthropic");
    assert.equal(etats.length, 2);
    assert.equal(etats[0].role, "Transcription");
    assert.equal(etats[1].role, "Rédaction");
    assert.match(etats[0].libelle, /Whisper/);
    assert.match(etats[1].libelle, /Claude/);
  });

  test("Tout branché : rien n'est signalé", () => {
    assert.equal(auMoinsUnEnDefaut(decrireEtatIA("openai", "anthropic")), false);
  });

  test("Un seul des deux en défaut suffit à le signaler", () => {
    assert.equal(auMoinsUnEnDefaut(decrireEtatIA("openai", "dev")), true);
    assert.equal(auMoinsUnEnDefaut(decrireEtatIA("dev", "anthropic")), true);
  });

  // Une clé n'a rien à faire dans du HTML rendu, et la fonction ne la reçoit
  // même pas — ce test verrouille le fait qu'elle ne puisse pas fuir par ici.
  test("Aucune clé ne peut transiter par cette fonction", () => {
    const rendu = JSON.stringify(decrireEtatIA("openai", "anthropic"));
    assert.doesNotMatch(rendu, /sk-/);
    assert.equal(decrireEtatIA.length, 2); // deux noms, et rien d'autre
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  if (failed > 0) process.exit(1);
}

main();
