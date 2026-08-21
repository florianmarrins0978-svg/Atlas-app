import assert from "node:assert";
import { decrireEtatIA, auMoinsUnEnDefaut, aFaireIA, etatVision, decrireVision } from "../src/lib/etat-ia";

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

// Toutes les clés posées par défaut : ces cas éprouvent la description des
// fournisseurs, pas l'absence de clé — qui a ses propres cas plus bas.
const TOUTES = ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY", "DEEPGRAM_API_KEY", "GOOGLE_API_KEY"];
const transcription = (t: string, l = "dev", cles = TOUTES) => decrireEtatIA(t, l, cles)[0];
const redaction = (l: string, t = "dev", cles = TOUTES) => decrireEtatIA(t, l, cles)[1];

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
    // `openai` en rédaction a quitté cette liste le 6 août 2026 : il est écrit.
    assert.equal(redaction("gemini").nature, "non_raccorde");
  });

  test("La casse et les espaces ne changent rien", () => {
    assert.equal(redaction("  Anthropic ").nature, "reel");
    assert.equal(transcription("DEV").nature, "simule");
  });

  test("Les deux rôles sont décrits, dans l'ordre, sans se mélanger", () => {
    const etats = decrireEtatIA("openai", "anthropic", TOUTES);
    assert.equal(etats.length, 2);
    assert.equal(etats[0].role, "Transcription");
    assert.equal(etats[1].role, "Rédaction");
    assert.match(etats[0].libelle, /Whisper/);
    assert.match(etats[1].libelle, /Claude/);
  });

  test("Tout branché : rien n'est signalé", () => {
    assert.equal(auMoinsUnEnDefaut(decrireEtatIA("openai", "anthropic", TOUTES)), false);
  });

  test("Un seul des deux en défaut suffit à le signaler", () => {
    assert.equal(auMoinsUnEnDefaut(decrireEtatIA("openai", "dev", TOUTES)), true);
    assert.equal(auMoinsUnEnDefaut(decrireEtatIA("dev", "anthropic", TOUTES)), true);
  });

  // Ajouté le 6 août 2026. Le patron avait choisi ses fournisseurs et payé ses
  // comptes ; il manquait la clé, et l'écran affichait un prestataire réel
  // comme si tout allait bien. Un « clé absente » se corrige en collant une
  // clé, un « non raccordé » en écrivant du code : les confondre fait perdre
  // une journée.
  test("Choisi sans sa clé : le dire, et nommer la variable", () => {
    const e = redaction("anthropic", "dev", []);
    assert.equal(e.nature, "cle_absente");
    assert.match(e.libelle, /clé absente/);
    assert.equal(e.variableManquante, "ANTHROPIC_API_KEY");
    assert.match(e.explication, /ANTHROPIC_API_KEY/);
    assert.match(e.explication, /Rien ne part chez personne/);
  });

  test("La clé d'un autre fournisseur ne branche pas celui-ci", () => {
    assert.equal(redaction("anthropic", "dev", ["OPENAI_API_KEY"]).nature, "cle_absente");
    assert.equal(redaction("openai", "dev", ["OPENAI_API_KEY"]).nature, "reel");
  });

  test("OpenAI rédige pour de bon depuis le 6 août 2026", () => {
    const e = redaction("openai", "dev", ["OPENAI_API_KEY"]);
    assert.equal(e.nature, "reel");
    assert.match(e.libelle, /OpenAI/);
  });

  // Deux constats identiques valent moins qu'un geste à faire.
  test("Tout déterministe : l'écran dit quoi faire, et une seule fois", () => {
    const conseil = aFaireIA(decrireEtatIA("dev", "dev"));
    assert.match(conseil ?? "", /OPENAI_API_KEY/);
    assert.match(conseil ?? "", /ANTHROPIC_API_KEY/);
    // Dès qu'un fournisseur est branché, ce conseil n'a plus lieu d'être.
    assert.equal(aFaireIA(decrireEtatIA("openai", "anthropic", TOUTES)), undefined);
    // Une faute de frappe porte déjà son propre message : ne pas la noyer.
    assert.equal(aFaireIA(decrireEtatIA("dev", "antropic")), undefined);
  });

  // Une clé n'a rien à faire dans du HTML rendu, et la fonction ne la reçoit
  // même pas — ce test verrouille le fait qu'elle ne puisse pas fuir par ici.
  test("Aucune clé ne peut transiter par cette fonction", () => {
    // Les NOMS des variables entrent ; leurs valeurs, jamais.
    const rendu = JSON.stringify(decrireEtatIA("openai", "anthropic", TOUTES));
    assert.doesNotMatch(rendu, /sk-/);
  });

  // ── QUI REGARDE LES PHOTOS ────────────────────────────────────────────────
  //
  // **Ce que ces cas tiennent, et pourquoi ils sont nés le 21 août 2026.**
  // L'écran d'arrosage annonçait « aucune clé d'IA n'est posée sur ce serveur »
  // dès qu'il ne trouvait ni Anthropic ni OpenAI. Le patron a repris trois fois
  // pour dire que ses clés SONT posées et qu'elles servent déjà à rédiger ses
  // devis. Il avait raison : la question posée n'était pas la bonne. Ce qui
  // compte n'est pas qu'une clé existe, mais que **celui qui va lire l'image**
  // ait la sienne — les deux se séparent depuis `VISION_PROVIDER`.

  test("La vision est prête quand SON fournisseur a SA clé", () => {
    const e = etatVision({ visionProvider: "anthropic", anthropicApiKey: "sk-x" });
    assert.equal(e.prete, true);
  });

  // **Le cas qui coûte le plus cher : promettre une lecture qui n'aura pas
  // lieu.** Une clé posée chez l'un, la vision réglée chez l'autre — l'écran
  // disait « tout va bien », il photographiait, et rien ne revenait. C'est le
  // « troisième bouton qui ne répond pas », déjà payé trois fois ici.
  test("Une clé posée AILLEURS ne rend pas la vision prête", () => {
    const e = etatVision({ visionProvider: "openai", anthropicApiKey: "sk-x", openaiApiKey: null });
    assert.equal(
      e.prete,
      false,
      "la vision est annoncée prête alors que la clé est posée chez un AUTRE fournisseur : il photographiera pour rien"
    );
  });

  // **Et le message désigne le bon coupable** (`CLAUDE.md` §5) : la variable à
  // renseigner, nommée, plutôt qu'un « aucune clé » qui envoie chercher partout.
  test("Le motif nomme la variable exacte, pas « aucune clé »", () => {
    const e = etatVision({ visionProvider: "openai", anthropicApiKey: "sk-x" });
    assert.equal(e.prete, false, "la clé d'Anthropic ne fait pas lire OpenAI");
    if (e.prete) return;
    assert.match(e.raison, /OPENAI_API_KEY/);
    assert.doesNotMatch(e.raison, /aucune clé/i);
  });

  // Gemini est annoncé et non écrit : poser sa clé n'y changerait rien, et le
  // dire évite d'aller la chercher.
  test("Un fournisseur qui ne sait pas lire le DIT, au lieu de réclamer une clé", () => {
    const e = etatVision({ visionProvider: "gemini", anthropicApiKey: "sk-x" });
    assert.equal(e.prete, false, "Gemini est annoncé capable de lire une image alors que son raccordement n'est pas écrit");
    if (e.prete) return;
    assert.doesNotMatch(e.raison, /_API_KEY/);
    assert.match(e.raison, /Gemini/);
  });

  test("Sans fournisseur du tout, on le dit sans accuser une clé", () => {
    const e = etatVision({ visionProvider: "dev" });
    assert.equal(e.prete, false);
    if (e.prete) return;
    assert.doesNotMatch(e.raison, /_API_KEY/);
  });

  // Une clé n'a rien à faire dans un écran : seul le FAIT qu'elle existe voyage.
  test("Aucune clé ne ressort du motif", () => {
    const e = etatVision({ visionProvider: "anthropic", anthropicApiKey: null, openaiApiKey: "sk-secret-42" });
    assert.doesNotMatch(JSON.stringify(e), /sk-secret/);
  });

  // ── La carte « Lecture d'image » de l'écran Atlas IA ──────────────────────
  //
  // Sa question du 21 août : « va voir ce qu'il y a de posé dans l'application
  // et dis-moi si c'est bon ou s'il faut qu'on rajoute une clé ». L'écran doit
  // savoir y répondre tout seul, le jour où il se la repose.

  test("Quand tout est en place, la carte nomme le prestataire", () => {
    const c = decrireVision("anthropic", TOUTES);
    assert.equal(c.nature, "reel");
    assert.match(c.libelle, /Anthropic/);
    // Un prestataire à qui partent des photos de jardins est un sous-traitant.
    assert.match(c.explication, /sous-traitant/);
  });

  // **Les deux échecs ne se réparent pas de la même façon**, et la distinction
  // se paie en temps : l'un se corrige en collant une clé, l'autre en écrivant
  // du code. Les confondre envoie chercher au mauvais endroit (`CLAUDE.md` §5).
  test("Clé manquante : la carte nomme la variable à poser", () => {
    const c = decrireVision("openai", ["ANTHROPIC_API_KEY"]);
    assert.equal(c.nature, "cle_absente");
    assert.equal(c.variableManquante, "OPENAI_API_KEY");
  });

  test("Fournisseur non raccordé : aucune clé n'est réclamée", () => {
    const c = decrireVision("gemini", TOUTES);
    assert.equal(c.nature, "non_raccorde");
    assert.equal(c.variableManquante, undefined);
  });

  // La carte doit peser dans le voyant d'ensemble : une lecture en panne est un
  // défaut, même quand la dictée et la rédaction vont bien.
  test("Une lecture d'image en panne fait rougir l'écran", () => {
    assert.equal(auMoinsUnEnDefaut([decrireVision("gemini", TOUTES)]), true);
    assert.equal(auMoinsUnEnDefaut([decrireVision("anthropic", TOUTES)]), false);
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  if (failed > 0) process.exit(1);
}

main();
